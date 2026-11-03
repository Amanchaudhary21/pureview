import { z } from 'zod';
import type { LogRow, Video } from './types';

// Shape of a backup file. Shared by browser storage and the MySQL server,
// so a backup from one can be restored into the other.
export type StoredVideo = Omit<Video, 'item_id' | 'hid' | 'watched_at'> & { id: number };
export interface Data {
  seq: number;
  videos: StoredVideo[];
  history: { id: number; video_id: number; watched_at: string }[];
  favorites: { video_id: number; created_at: string }[];
  playlists: { id: number; name: string; description: string | null; created_at: string }[];
  playlist_items: { id: number; playlist_id: number; video_id: number; position: number }[];
  settings: Record<string, string>;
  logs: LogRow[];
}

const id = z.number().int().positive();
const time = z.string().max(40);
export const DataSchema = z.object({
  seq: z.number().int().nonnegative(),
  videos: z.array(z.object({
    id, platform: z.string().min(1).max(30), video_id: z.string().min(1).max(200),
    title: z.string().max(500).nullable(), thumbnail_url: z.string().max(1000).nullable(),
    channel_name: z.string().max(300).nullable(), duration: z.number().int().nullable(), video_url: z.string().max(2000)
  })),
  history: z.array(z.object({ id, video_id: id, watched_at: time })),
  favorites: z.array(z.object({ video_id: id, created_at: time })),
  playlists: z.array(z.object({ id, name: z.string().min(1).max(100), description: z.string().max(500).nullable(), created_at: time })),
  playlist_items: z.array(z.object({ id, playlist_id: id, video_id: id, position: z.number().int() })),
  settings: z.record(z.string(), z.string()),
  logs: z.array(z.object({
    id, error_id: z.string(), module: z.string(), severity: z.string(), message: z.string(), created_at: time
  }))
});
