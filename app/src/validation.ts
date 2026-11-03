import { z } from 'zod';

export const VideoSchema = z.object({
  platform: z.string().min(1).max(30),
  video_id: z.string().min(1).max(200),
  title: z.string().max(500).nullable().optional(),
  thumbnail_url: z.string().max(1000).nullable().optional(),
  channel_name: z.string().max(300).nullable().optional(),
  duration: z.number().int().nullable().optional(),
  video_url: z.string().url().max(2000)
});
export type VideoInput = z.infer<typeof VideoSchema>;

export const PlaylistSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(500).optional() });

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
export const isYouTubeId = (s: string) => YT_ID.test(s);

/** Accepts a YouTube URL or bare 11-char ID, returns the video ID or null. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s);
    const h = u.hostname.replace(/^www\.|^m\./, '');
    if (h === 'youtu.be') { const id = u.pathname.slice(1); return YT_ID.test(id) ? id : null; }
    if (h === 'youtube.com' || h === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && YT_ID.test(v)) return v;
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* not a URL */ }
  return null;
}
