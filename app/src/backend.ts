import { z } from 'zod';
import type { LogRow, Playlist, PvApi, Result, Video } from './types';
import { PlaylistSchema, VideoSchema, parseYouTubeId } from './validation';

// All data lives in this browser's localStorage. Nothing is sent anywhere except
// YouTube/Google API requests made directly from the browser.
const KEY = 'pureview:v1';

type StoredVideo = Omit<Video, 'item_id' | 'hid' | 'watched_at'> & { id: number };
interface Data {
  seq: number;
  videos: StoredVideo[];
  history: { id: number; video_id: number; watched_at: string }[];
  favorites: { video_id: number; created_at: string }[];
  playlists: { id: number; name: string; description: string | null; created_at: string }[];
  playlist_items: { id: number; playlist_id: number; video_id: number; position: number }[];
  settings: Record<string, string>;
  logs: LogRow[];
}

const DataSchema = z.object({
  seq: z.number().int().nonnegative(),
  videos: z.array(z.any()), history: z.array(z.any()), favorites: z.array(z.any()),
  playlists: z.array(z.any()), playlist_items: z.array(z.any()),
  settings: z.record(z.string(), z.string()), logs: z.array(z.any())
});

const empty = (): Data => ({ seq: 0, videos: [], history: [], favorites: [], playlists: [], playlist_items: [], settings: {}, logs: [] });
const now = () => new Date().toISOString();
const MAX_HISTORY = 500, MAX_LOGS = 100;

let cache: Data | null = null;
function load(): Data {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? DataSchema.safeParse(JSON.parse(raw)) : null;
    cache = parsed?.success ? (parsed.data as Data) : empty();
  } catch { cache = empty(); }
  return cache;
}
function save(d: Data) {
  // drop videos nothing points at any more, and cap history/log size
  d.history = d.history.slice(0, MAX_HISTORY);
  d.logs = d.logs.slice(0, MAX_LOGS);
  const used = new Set([...d.history, ...d.favorites, ...d.playlist_items].map(r => r.video_id));
  d.videos = d.videos.filter(v => used.has(v.id));
  try { localStorage.setItem(KEY, JSON.stringify(d)); }
  catch { throw new AppError('PV-STORE-FULL', 'Browser storage is full. Clear some history and try again.'); }
}
const nextId = (d: Data) => ++d.seq;

class AppError extends Error { constructor(public code: string, message: string) { super(message); } }

function log(module: string, severity: string, message: string, id = 'PV-GEN-000') {
  try {
    const d = load();
    d.logs.unshift({ id: nextId(d), error_id: id, module, severity, message: message.slice(0, 500), created_at: now() });
    save(d);
  } catch { /* ignore */ }
}

async function handle<T>(channel: string, fn: () => T | Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() }; }
  catch (err) {
    const code = err instanceof AppError ? err.code : 'PV-GEN-001';
    const message = err instanceof z.ZodError ? 'Invalid data.' : err instanceof Error ? err.message : 'Unknown error';
    log(channel, 'ERROR', message, code);
    return { ok: false, error: { code, message } };
  }
}

// ---------- videos ----------
function upsertVideo(d: Data, raw: unknown): number {
  const v = VideoSchema.parse(raw);
  const existing = d.videos.find(x => x.platform === v.platform && x.video_id === v.video_id);
  if (existing) {
    // only overwrite details we actually have, so a bare link never wipes a stored title
    existing.title = v.title ?? existing.title;
    existing.thumbnail_url = v.thumbnail_url ?? existing.thumbnail_url;
    existing.channel_name = v.channel_name ?? existing.channel_name;
    existing.duration = v.duration ?? existing.duration;
    return existing.id;
  }
  const id = nextId(d);
  d.videos.push({ id, platform: v.platform, video_id: v.video_id, title: v.title ?? null, thumbnail_url: v.thumbnail_url ?? null,
    channel_name: v.channel_name ?? null, duration: v.duration ?? null, video_url: v.video_url });
  return id;
}
const videoById = (d: Data, id: number) => d.videos.find(v => v.id === id);

// ---------- network ----------
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
const decodeEntities = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function searchVideos(query: string): Promise<Video[]> {
  const q = query.trim();
  if (!q) throw new AppError('PV-SEARCH-001', 'Search is empty.');
  if (q.length > 200) throw new AppError('PV-SEARCH-002', 'Search is too long.');

  const id = parseYouTubeId(q);
  if (id) { // pasted link: no API key needed
    let title = `YouTube video ${id}`, channel: string | null = null;
    try {
      const o = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`, 1);
      title = o.title ?? title; channel = o.author_name ?? null;
    } catch { /* keep fallback title */ }
    return [{ platform: 'youtube', video_id: id, title, channel_name: channel,
      thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: null, video_url: `https://www.youtube.com/watch?v=${id}` }];
  }

  const key = load().settings.youtube_api_key;
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

// ---------- api ----------
export const backend: PvApi = {
  search: q => handle('search', () => searchVideos(String(q))),

  play: video => handle('video:play', () => {
    const d = load(); const id = upsertVideo(d, video);
    d.history.unshift({ id: nextId(d), video_id: id, watched_at: now() });
    save(d); return id;
  }),

  history: {
    list: () => handle('history:list', () => {
      const d = load();
      return d.history.slice(0, 200).flatMap(h => {
        const v = videoById(d, h.video_id);
        return v ? [{ ...v, hid: h.id, watched_at: h.watched_at }] : [];
      });
    }),
    clear: () => handle('history:clear', () => { const d = load(); d.history = []; save(d); return true; }),
    remove: hid => handle('history:remove', () => { const d = load(); d.history = d.history.filter(h => h.id !== Number(hid)); save(d); return true; })
  },

  fav: {
    list: () => handle('fav:list', () => {
      const d = load();
      return [...d.favorites].sort((a, b) => b.created_at.localeCompare(a.created_at)).flatMap(f => {
        const v = videoById(d, f.video_id); return v ? [{ ...v }] : [];
      });
    }),
    has: (platform, vid) => handle('fav:has', () => {
      const d = load(); const v = d.videos.find(x => x.platform === platform && x.video_id === vid);
      return !!v && d.favorites.some(f => f.video_id === v.id);
    }),
    toggle: video => handle('fav:toggle', () => {
      const d = load(); const id = upsertVideo(d, video);
      const had = d.favorites.some(f => f.video_id === id);
      d.favorites = had ? d.favorites.filter(f => f.video_id !== id) : [...d.favorites, { video_id: id, created_at: now() }];
      save(d); return !had;
    })
  },

  pl: {
    list: () => handle('pl:list', () => {
      const d = load();
      return [...d.playlists].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((p): Playlist => ({
        id: p.id, name: p.name, description: p.description, count: d.playlist_items.filter(i => i.playlist_id === p.id).length
      }));
    }),
    create: p => handle('pl:create', () => {
      const v = PlaylistSchema.parse(p); const d = load(); const id = nextId(d);
      d.playlists.push({ id, name: v.name, description: v.description ?? null, created_at: now() });
      save(d); return id;
    }),
    delete: id => handle('pl:delete', () => {
      const d = load();
      d.playlists = d.playlists.filter(p => p.id !== Number(id));
      d.playlist_items = d.playlist_items.filter(i => i.playlist_id !== Number(id));
      save(d); return true;
    }),
    items: id => handle('pl:items', () => {
      const d = load();
      return d.playlist_items.filter(i => i.playlist_id === Number(id)).sort((a, b) => a.position - b.position || a.id - b.id)
        .flatMap(i => { const v = videoById(d, i.video_id); return v ? [{ ...v, item_id: i.id }] : []; });
    }),
    add: (plId, video) => handle('pl:add', () => {
      const d = load();
      if (!d.playlists.some(p => p.id === Number(plId))) throw new AppError('PV-PL-404', 'That playlist no longer exists.');
      const vid = upsertVideo(d, video);
      const items = d.playlist_items.filter(i => i.playlist_id === Number(plId));
      if (items.some(i => i.video_id === vid)) return false;
      d.playlist_items.push({ id: nextId(d), playlist_id: Number(plId), video_id: vid, position: Math.max(0, ...items.map(i => i.position)) + 1 });
      save(d); return true;
    }),
    remove: itemId => handle('pl:remove', () => { const d = load(); d.playlist_items = d.playlist_items.filter(i => i.id !== Number(itemId)); save(d); return true; })
  },

  settings: {
    get: () => handle('settings:get', () => { const s = load().settings; return { hasApiKey: !!s.youtube_api_key, theme: s.theme ?? 'dark' }; }),
    setApiKey: k => handle('settings:setApiKey', () => {
      const key = String(k).trim();
      if (key && !/^[A-Za-z0-9_-]{20,80}$/.test(key)) throw new AppError('PV-SET-001', 'That does not look like a valid API key.');
      const d = load();
      if (key) d.settings.youtube_api_key = key; else delete d.settings.youtube_api_key;
      save(d); searchCache.clear(); return true;
    }),
    set: (k, v) => handle('settings:set', () => {
      if (k !== 'theme' || !['dark', 'light'].includes(v)) throw new AppError('PV-SET-002', 'Unknown setting');
      const d = load(); d.settings[k] = v; save(d); return true;
    }),
    logs: () => handle('logs:list', () => load().logs),
    // export leaves the API key out so a shared backup file never leaks it
    exportData: () => handle('data:export', () => {
      const { youtube_api_key: _omit, ...settings } = load().settings;
      return JSON.stringify({ ...load(), settings }, null, 2);
    }),
    importData: json => handle('data:import', () => {
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch { throw new AppError('PV-IMP-001', 'That file is not valid JSON.'); }
      const r = DataSchema.safeParse(parsed);
      if (!r.success) throw new AppError('PV-IMP-002', 'That file is not a PureView backup.');
      const key = load().settings.youtube_api_key;
      const next = r.data as Data;
      if (key && !next.settings.youtube_api_key) next.settings.youtube_api_key = key;
      cache = next; save(next); return true;
    })
  },

  openExternal: u => handle('external:open', () => {
    const url = new URL(String(u));
    if (url.protocol !== 'https:') throw new AppError('PV-URL-001', 'Invalid URL');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  })
};
