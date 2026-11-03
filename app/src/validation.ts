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

// a YouTube address anywhere in the text, with or without https://
const YT_LINK = /(?<![a-z0-9.-])(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)(?![a-z0-9.-])(?:\/[^\s<>"']*)?/i;

/** True if the text contains a YouTube address (even one that isn't a single video). */
export const looksLikeYouTubeLink = (input: string) => YT_LINK.test(input);

/**
 * Accepts a bare 11-char ID or any YouTube link, also one copied together with other text
 * (e.g. from a phone's share sheet) or without https://. Returns the video ID or null.
 */
export function parseYouTubeId(input: string, depth = 0): string | null {
  const s = input.trim();
  if (YT_ID.test(s)) return s;
  const found = s.match(YT_LINK)?.[0];
  if (!found) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(found) ? found : 'https://' + found);
    const h = u.hostname.toLowerCase().replace(/^(?:www|m|music|gaming)\./, '');
    const fromPath = (re: RegExp) => u.pathname.match(re)?.[1] ?? null;
    if (h === 'youtu.be') return fromPath(/^\/([A-Za-z0-9_-]{11})(?:$|[/?#])/);
    if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && YT_ID.test(v)) return v;
      // old share links wrap the real address: /attribution_link?u=/watch?v=ID
      const inner = u.searchParams.get('u');
      if (inner && depth < 2) return parseYouTubeId('https://www.youtube.com' + inner, depth + 1);
      return fromPath(/^\/(?:embed|shorts|live|v|e)\/([A-Za-z0-9_-]{11})(?:$|[/?#])/);
    }
  } catch { /* not a URL */ }
  return null;
}
