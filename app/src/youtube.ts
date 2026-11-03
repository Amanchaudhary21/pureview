import { AppError } from './errors';
import type { Video } from './types';
import { looksLikeYouTubeLink, parsePlaylistId, parseYouTubeId } from './validation';

// YouTube search, shared by the browser-storage backend and the MySQL server.

async function fetchJson(url: string, tries = 3): Promise<any> {
  let delay = 1000;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) return await r.json();
      if (r.status === 403) throw new AppError('PV-NET-403', 'YouTube API: access denied or quota exceeded. Check your API key and its website restrictions.');
      if (r.status === 400) throw new AppError('PV-NET-400', 'YouTube API: bad request (is the API key valid?)');
      if (r.status === 401 || r.status === 404) throw new AppError(`PV-NET-${r.status}`, `Request failed (${r.status})`);
      if (i === tries - 1) throw new AppError(`PV-NET-${r.status}`, `Server error (${r.status}). Try again later.`);
    } catch (err) {
      clearTimeout(t);
      if (err instanceof AppError) throw err;
      if (i === tries - 1) throw new AppError('PV-NET-OFFLINE', 'Network unavailable or request timed out.');
    }
    await new Promise(r => setTimeout(r, delay)); delay *= 2;
  }
  throw new AppError('PV-NET-000', 'Request failed');
}

const searchCache = new Map<string, { t: number; data: Video[] }>();
export const clearSearchCache = () => searchCache.clear();
const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export async function searchYouTube(query: string, getKey: () => Promise<string | undefined>): Promise<Video[]> {
  const q = query.trim();
  if (!q) throw new AppError('PV-SEARCH-001', 'Search is empty.');

  // check for a link before the length limit: copied links are often long
  const listId = parsePlaylistId(q);
  const id = parseYouTubeId(q);
  if (listId) { // playlist link: list all of its videos (needs the API key)
    const key = await getKey();
    if (key) return playlistVideos(listId, key);
    if (!id) throw new AppError('PV-SEARCH-KEY', 'Add a YouTube Data API key in Settings to open a whole playlist.');
  }
  if (id) { // pasted link: no API key needed
    let title = `YouTube video ${id}`, channel: string | null = null;
    try {
      const o = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, 1);
      title = o.title ?? title; channel = o.author_name ?? null;
    } catch { /* keep fallback title */ }
    return [{ platform: 'youtube', video_id: id, title, channel_name: channel,
      thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: null, video_url: `https://www.youtube.com/watch?v=${id}` }];
  }
  if (looksLikeYouTubeLink(q))
    throw new AppError('PV-SEARCH-LINK', 'That YouTube link is not a video or playlist (it may be a channel or a mix). Open a video or playlist and copy its link.');
  if (q.length > 200) throw new AppError('PV-SEARCH-002', 'Search is too long.');

  const key = await getKey();
  if (!key) throw new AppError('PV-SEARCH-KEY', 'Add a YouTube Data API key in Settings to search. (You can still paste a YouTube link.)');
  const hit = searchCache.get(q.toLowerCase());
  if (hit && Date.now() - hit.t < 10 * 60_000) return hit.data;

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=24&safeSearch=moderate&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`;
  const j = await fetchJson(url);
  const out: Video[] = (j.items ?? []).filter((i: any) => i?.id?.videoId).map((i: any) => ({
    platform: 'youtube', video_id: i.id.videoId, title: decodeEntities(i.snippet?.title ?? ''),
    channel_name: decodeEntities(i.snippet?.channelTitle ?? ''),
    thumbnail_url: i.snippet?.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${i.id.videoId}/mqdefault.jpg`,
    duration: null, video_url: `https://www.youtube.com/watch?v=${i.id.videoId}`
  }));
  if (searchCache.size > 50) searchCache.clear();
  searchCache.set(q.toLowerCase(), { t: Date.now(), data: out });
  return out;
}

const MAX_PLAYLIST = 200;

async function playlistVideos(listId: string, key: string): Promise<Video[]> {
  const hit = searchCache.get('list:' + listId);
  if (hit && Date.now() - hit.t < 10 * 60_000) return hit.data;
  const out: Video[] = [];
  let page = '';
  do {
    const j = await fetchJson(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(listId)}&key=${encodeURIComponent(key)}${page && '&pageToken=' + encodeURIComponent(page)}`)
      .catch(e => { throw e instanceof AppError && e.code === 'PV-NET-404' ? new AppError('PV-SEARCH-LIST', 'That playlist was not found or is private.') : e; });
    for (const i of j.items ?? []) {
      const vid = i?.snippet?.resourceId?.videoId;
      // deleted and private videos stay in playlists but can't be played
      if (!vid || !i.snippet.thumbnails || out.some(v => v.video_id === vid)) continue;
      out.push({ platform: 'youtube', video_id: vid, title: decodeEntities(i.snippet.title ?? ''),
        channel_name: decodeEntities(i.snippet.videoOwnerChannelTitle ?? i.snippet.channelTitle ?? ''),
        thumbnail_url: i.snippet.thumbnails.medium?.url ?? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
        duration: null, video_url: `https://www.youtube.com/watch?v=${vid}` });
    }
    page = j.nextPageToken ?? '';
  } while (page && out.length < MAX_PLAYLIST);
  const data = out.slice(0, MAX_PLAYLIST);
  if (searchCache.size > 50) searchCache.clear();
  searchCache.set('list:' + listId, { t: Date.now(), data });
  return data;
}

export const API_KEY_RE = /^[A-Za-z0-9_-]{20,80}$/;
