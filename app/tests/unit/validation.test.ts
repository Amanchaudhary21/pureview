import { describe, it, expect } from 'vitest';
import { looksLikeYouTubeLink, parsePlaylistId, parseYouTubeId, VideoSchema, PlaylistSchema } from '../../src/validation';

describe('parseYouTubeId', () => {
  it('parses common URL shapes', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses links as people actually copy them', () => {
    const id = 'dQw4w9WgXcQ';
    for (const link of [
      'https://youtu.be/dQw4w9WgXcQ?si=AbCdEfGh12345678',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&index=2&t=42s',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
      'https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ',
      'https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=x',
      'https://youtube.com/shorts/dQw4w9WgXcQ?si=xyz',
      'https://www.youtube.com/live/dQw4w9WgXcQ?si=xyz',
      'youtu.be/dQw4w9WgXcQ',
      'www.youtube.com/watch?v=dQw4w9WgXcQ',
      'YOUTUBE.COM/watch?v=dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=10',
      'https://www.youtube.com/v/dQw4w9WgXcQ',
      'Check this out! https://youtu.be/dQw4w9WgXcQ?si=abc',
      '  https://youtu.be/dQw4w9WgXcQ\n',
      'https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3DdQw4w9WgXcQ%26feature%3Dshare',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&pp=' + 'x'.repeat(250),
    ]) expect(parseYouTubeId(link), link).toBe(id);
  });
  it('rejects non-YouTube input', () => {
    expect(parseYouTubeId('java tutorial')).toBeNull();
    expect(parseYouTubeId('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeId('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeId('https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/playlist?list=PLabc')).toBeNull();
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQextra')).toBeNull();
  });
  it('finds playlist IDs', () => {
    expect(parsePlaylistId('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toBe('PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
    expect(parsePlaylistId('youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=2')).toBe('PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
    expect(parsePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ')).toBeNull(); // mix
    expect(parsePlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parsePlaylistId('https://evil.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG')).toBeNull();
  });
  it('recognises non-video YouTube links', () => {
    expect(looksLikeYouTubeLink('https://www.youtube.com/@somechannel')).toBe(true);
    expect(looksLikeYouTubeLink('cooking videos')).toBe(false);
  });
});

describe('schemas', () => {
  it('validates video and playlist', () => {
    expect(VideoSchema.safeParse({ platform: 'youtube', video_id: 'x', video_url: 'not a url' }).success).toBe(false);
    expect(VideoSchema.safeParse({ platform: 'youtube', video_id: 'x', video_url: 'https://a.com/x' }).success).toBe(true);
    expect(PlaylistSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});
