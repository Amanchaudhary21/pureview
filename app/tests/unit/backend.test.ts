import { beforeAll, describe, it, expect } from 'vitest';
import type { PvApi, Video } from '../../src/types';

const mem = new Map<string, string>();
let backend: PvApi;

beforeAll(async () => {
  (globalThis as any).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v); },
    removeItem: (k: string) => { mem.delete(k); }
  };
  ({ backend } = await import('../../src/backend'));
});

const vid = (over: Partial<Video> = {}): Video => ({
  platform: 'youtube', video_id: 'dQw4w9WgXcQ', title: 'Song', thumbnail_url: null,
  channel_name: 'Rick', duration: null, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ...over
});
const ok = async <T>(p: Promise<{ ok: boolean; data?: T }>) => { const r = await p; expect(r.ok).toBe(true); return r.data as T; };

describe('backend', () => {
  it('records history without wiping a known title', async () => {
    await ok(backend.play(vid()));
    await ok(backend.play(vid({ title: null, channel_name: null })));
    const h = await ok(backend.history.list());
    expect(h).toHaveLength(1);
    expect(h[0].title).toBe('Song');
    expect(h[0].channel_name).toBe('Rick');
  });

  it('keeps one history entry per video, most recent first', async () => {
    await ok(backend.play(vid({ video_id: 'aaaaaaaaaaa', video_url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' })));
    await ok(backend.play(vid()));
    const h = await ok(backend.history.list());
    expect(h.map(v => v.video_id)).toEqual(['dQw4w9WgXcQ', 'aaaaaaaaaaa']);
    await ok(backend.history.remove(h[1].hid!));
  });

  it('toggles favorites', async () => {
    expect(await ok(backend.fav.toggle(vid()))).toBe(true);
    expect(await ok(backend.fav.has('youtube', 'dQw4w9WgXcQ'))).toBe(true);
    expect(await ok(backend.fav.toggle(vid()))).toBe(false);
    expect(await ok(backend.fav.list())).toHaveLength(0);
  });

  it('manages playlists and ignores duplicates', async () => {
    const id = await ok(backend.pl.create({ name: 'Mix' }));
    expect(await ok(backend.pl.add(id, vid()))).toBe(true);
    expect(await ok(backend.pl.add(id, vid()))).toBe(false);
    expect((await ok(backend.pl.list()))[0].count).toBe(1);
    await ok(backend.pl.delete(id));
    expect(await ok(backend.pl.list())).toHaveLength(0);
  });

  it('exports without the API key and restores a backup', async () => {
    await ok(backend.settings.setApiKey('AIzaSyA-abcdefghijklmnopqrstuvwxyz12345'));
    const json = await ok(backend.settings.exportData());
    expect(json).not.toContain('AIzaSy');
    await ok(backend.history.clear());
    await ok(backend.settings.importData(json));
    expect(await ok(backend.history.list())).toHaveLength(1);
    expect((await ok(backend.settings.get())).hasApiKey).toBe(true);
    expect((await backend.settings.importData('{"nope":1}')).ok).toBe(false);
  });

  it('rejects bad settings and invalid videos', async () => {
    expect((await backend.settings.set('theme', 'neon')).ok).toBe(false);
    expect((await backend.play(vid({ video_url: 'not a url' }))).ok).toBe(false);
  });
});
