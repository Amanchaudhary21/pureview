import { z } from 'zod';
import { AppError } from '../src/errors';
import { DataSchema, type Data } from '../src/backup';
import { PlaylistSchema, VideoSchema } from '../src/validation';
import { API_KEY_RE, clearSearchCache, searchYouTube } from '../src/youtube';
import type { Video } from '../src/types';
import { log, one, rows, run, transaction } from './db';

const getSetting = async (k: string) => (await one<{ v: string }>('SELECT setting_value v FROM settings WHERE setting_key=?', [k]))?.v;
const setSetting = (k: string, v: string) =>
  run('INSERT INTO settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', [k, v]);

async function upsertVideo(raw: unknown): Promise<number> {
  const v = VideoSchema.parse(raw);
  // keep stored details when the new copy has none (a bare link must not wipe a title);
  // LAST_INSERT_ID(id) makes insertId return the existing row's id on a duplicate
  const r = await run(`INSERT INTO videos(platform,video_id,title,thumbnail_url,channel_name,duration,video_url,created_at)
    VALUES(?,?,?,?,?,?,?,?) AS n
    ON DUPLICATE KEY UPDATE title=COALESCE(n.title, videos.title), thumbnail_url=COALESCE(n.thumbnail_url, videos.thumbnail_url),
      channel_name=COALESCE(n.channel_name, videos.channel_name), duration=COALESCE(n.duration, videos.duration), id=LAST_INSERT_ID(videos.id)`,
    [v.platform, v.video_id, v.title ?? null, v.thumbnail_url ?? null, v.channel_name ?? null, v.duration ?? null, v.video_url, new Date()]);
  return r.insertId;
}

const VIDEO_COLS = 'v.id, v.platform, v.video_id, v.title, v.thumbnail_url, v.channel_name, v.duration, v.video_url';
const iso = (d: Date | string) => new Date(d).toISOString();
const toDate = (s: string) => { const d = new Date(s); if (isNaN(+d)) throw new AppError('PV-IMP-003', 'The backup contains an invalid date.'); return d; };

type Handler = (...args: any[]) => Promise<unknown>;

export const handlers: Record<string, Handler> = {
  search: q => searchYouTube(String(q), () => getSetting('youtube_api_key')),

  play: async video => {
    const id = await upsertVideo(video);
    await run('INSERT INTO history(video_id,watched_at) VALUES(?,?)', [id, new Date()]);
    return id;
  },

  'history.list': async () => (await rows(`SELECT ${VIDEO_COLS}, h.id hid, h.watched_at FROM history h JOIN videos v ON v.id=h.video_id
    ORDER BY h.watched_at DESC, h.id DESC LIMIT 200`)).map(r => ({ ...r, watched_at: iso(r.watched_at) })),
  'history.clear': async () => { await run('DELETE FROM history'); return true; },
  'history.remove': async hid => { await run('DELETE FROM history WHERE id=?', [Number(hid)]); return true; },

  'fav.list': () => rows<Video>(`SELECT ${VIDEO_COLS} FROM favorites f JOIN videos v ON v.id=f.video_id ORDER BY f.created_at DESC, f.id DESC`),
  'fav.has': async (platform, vid) =>
    !!(await one('SELECT 1 FROM favorites f JOIN videos v ON v.id=f.video_id WHERE v.platform=? AND v.video_id=?', [String(platform), String(vid)])),
  'fav.toggle': async video => {
    const id = await upsertVideo(video);
    const r = await run('DELETE FROM favorites WHERE video_id=?', [id]);
    if (r.affectedRows) return false;
    await run('INSERT INTO favorites(video_id,created_at) VALUES(?,?)', [id, new Date()]);
    return true;
  },

  'pl.list': () => rows(`SELECT p.id, p.name, p.description, (SELECT COUNT(*) FROM playlist_items i WHERE i.playlist_id=p.id) AS count
    FROM playlists p ORDER BY p.created_at DESC, p.id DESC`),
  'pl.create': async p => {
    const v = PlaylistSchema.parse(p);
    return (await run('INSERT INTO playlists(name,description,created_at) VALUES(?,?,?)', [v.name, v.description ?? null, new Date()])).insertId;
  },
  'pl.delete': async id => { await run('DELETE FROM playlists WHERE id=?', [Number(id)]); return true; },
  'pl.items': id => rows(`SELECT ${VIDEO_COLS}, i.id AS item_id FROM playlist_items i JOIN videos v ON v.id=i.video_id
    WHERE i.playlist_id=? ORDER BY i.position, i.id`, [Number(id)]),
  'pl.add': async (plId, video) => {
    if (!(await one('SELECT 1 FROM playlists WHERE id=?', [Number(plId)]))) throw new AppError('PV-PL-404', 'That playlist no longer exists.');
    const vid = await upsertVideo(video);
    const r = await run(`INSERT IGNORE INTO playlist_items(playlist_id,video_id,position)
      SELECT ?, ?, COALESCE(MAX(position),0)+1 FROM playlist_items WHERE playlist_id=?`, [Number(plId), vid, Number(plId)]);
    return r.affectedRows > 0;
  },
  'pl.remove': async itemId => { await run('DELETE FROM playlist_items WHERE id=?', [Number(itemId)]); return true; },

  'settings.get': async () => ({ hasApiKey: !!(await getSetting('youtube_api_key')), theme: (await getSetting('theme')) ?? 'dark', storage: 'mysql' }),
  'settings.setApiKey': async k => {
    const key = String(k).trim();
    if (key && !API_KEY_RE.test(key)) throw new AppError('PV-SET-001', 'That does not look like a valid API key.');
    if (key) await setSetting('youtube_api_key', key); else await run("DELETE FROM settings WHERE setting_key='youtube_api_key'");
    clearSearchCache(); return true;
  },
  'settings.set': async (k, v) => {
    if (k !== 'theme' || !['dark', 'light'].includes(v)) throw new AppError('PV-SET-002', 'Unknown setting');
    await setSetting(k, v); return true;
  },
  'settings.logs': async () => (await rows('SELECT * FROM app_logs ORDER BY id DESC LIMIT 100')).map(r => ({ ...r, created_at: iso(r.created_at) })),

  // same file format as the browser version; the API key is never exported
  'settings.exportData': async () => {
    const [videos, history, favorites, playlists, playlist_items, settings, logs] = await Promise.all([
      rows('SELECT id, platform, video_id, title, thumbnail_url, channel_name, duration, video_url FROM videos ORDER BY id'),
      rows('SELECT id, video_id, watched_at FROM history ORDER BY watched_at DESC, id DESC'),
      rows('SELECT video_id, created_at FROM favorites ORDER BY id'),
      rows('SELECT id, name, description, created_at FROM playlists ORDER BY id'),
      rows('SELECT id, playlist_id, video_id, position FROM playlist_items ORDER BY id'),
      rows<{ setting_key: string; setting_value: string }>("SELECT setting_key, setting_value FROM settings WHERE setting_key <> 'youtube_api_key'"),
      rows('SELECT * FROM app_logs ORDER BY id DESC LIMIT 100')
    ]);
    const data: Data = {
      seq: Math.max(0, ...[videos, history, playlists, playlist_items, logs].flat().map((r: any) => r.id)),
      videos,
      history: history.map(h => ({ ...h, watched_at: iso(h.watched_at) })),
      favorites: favorites.map(f => ({ ...f, created_at: iso(f.created_at) })),
      playlists: playlists.map(p => ({ ...p, created_at: iso(p.created_at) })),
      playlist_items,
      settings: Object.fromEntries(settings.map(s => [s.setting_key, s.setting_value])),
      logs: logs.map(l => ({ ...l, created_at: iso(l.created_at) }))
    };
    return JSON.stringify(data, null, 2);
  },
  'settings.importData': async json => {
    let parsed: unknown;
    try { parsed = JSON.parse(String(json)); } catch { throw new AppError('PV-IMP-001', 'That file is not valid JSON.'); }
    const r = DataSchema.safeParse(parsed);
    if (!r.success) throw new AppError('PV-IMP-002', 'That file is not a PureView backup.');
    const d = r.data;
    await transaction(async c => {
      const bulk = async (sql: string, values: unknown[][]) => { if (values.length) await c.query(sql, [values]); };
      for (const t of ['playlist_items', 'favorites', 'history', 'playlists', 'videos', 'app_logs']) await c.query(`DELETE FROM ${t}`);
      await c.query("DELETE FROM settings WHERE setting_key <> 'youtube_api_key'");
      const now = new Date();
      await bulk('INSERT INTO videos(id,platform,video_id,title,thumbnail_url,channel_name,duration,video_url,created_at) VALUES ?',
        d.videos.map(v => [v.id, v.platform, v.video_id, v.title, v.thumbnail_url, v.channel_name, v.duration, v.video_url, now]));
      await bulk('INSERT INTO history(id,video_id,watched_at) VALUES ?', d.history.map(h => [h.id, h.video_id, toDate(h.watched_at)]));
      await bulk('INSERT INTO favorites(video_id,created_at) VALUES ?', d.favorites.map(f => [f.video_id, toDate(f.created_at)]));
      await bulk('INSERT INTO playlists(id,name,description,created_at) VALUES ?', d.playlists.map(p => [p.id, p.name, p.description, toDate(p.created_at)]));
      await bulk('INSERT INTO playlist_items(id,playlist_id,video_id,position) VALUES ?', d.playlist_items.map(i => [i.id, i.playlist_id, i.video_id, i.position]));
      // a backup made elsewhere may carry an API key; keep the one already saved here if there is one
      const settings = Object.entries(d.settings).filter(([k]) => /^[\w.-]{1,100}$/.test(k));
      await bulk('INSERT INTO settings(setting_key,setting_value) VALUES ? ON DUPLICATE KEY UPDATE setting_key=setting_key', settings);
    });
    clearSearchCache();
    return true;
  }
};

export { log };
export const isValidationError = (e: unknown) => e instanceof z.ZodError;
