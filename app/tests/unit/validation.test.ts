import { describe, it, expect } from 'vitest';
import { parseYouTubeId, VideoSchema, PlaylistSchema } from '../../src/validation';

describe('parseYouTubeId', () => {
  it('parses common URL shapes', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('rejects non-YouTube input', () => {
    expect(parseYouTubeId('java tutorial')).toBeNull();
    expect(parseYouTubeId('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('schemas', () => {
  it('validates video and playlist', () => {
    expect(VideoSchema.safeParse({ platform: 'youtube', video_id: 'x', video_url: 'not a url' }).success).toBe(false);
    expect(VideoSchema.safeParse({ platform: 'youtube', video_id: 'x', video_url: 'https://a.com/x' }).success).toBe(true);
    expect(PlaylistSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});
