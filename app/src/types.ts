export interface Video {
  id?: number; platform: string; video_id: string; title: string | null; thumbnail_url: string | null;
  channel_name: string | null; duration: number | null; video_url: string; item_id?: number; hid?: number; watched_at?: string;
}
export interface Playlist { id: number; name: string; description: string | null; count: number }
export type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export interface SettingsInfo { hasApiKey: boolean; theme: string }
export interface LogRow { id: number; error_id: string; module: string; severity: string; message: string; created_at: string }

export interface PvApi {
  search(q: string): Promise<Result<Video[]>>;
  play(v: Video): Promise<Result<number>>;
  history: { list(): Promise<Result<Video[]>>; clear(): Promise<Result<boolean>>; remove(id: number): Promise<Result<boolean>> };
  fav: { list(): Promise<Result<Video[]>>; has(p: string, id: string): Promise<Result<boolean>>; toggle(v: Video): Promise<Result<boolean>> };
  pl: {
    list(): Promise<Result<Playlist[]>>; create(p: { name: string; description?: string }): Promise<Result<number>>;
    delete(id: number): Promise<Result<boolean>>; items(id: number): Promise<Result<Video[]>>;
    add(id: number, v: Video): Promise<Result<boolean>>; remove(itemId: number): Promise<Result<boolean>>;
  };
  settings: {
    get(): Promise<Result<SettingsInfo>>; setApiKey(k: string): Promise<Result<boolean>>; set(k: string, v: string): Promise<Result<boolean>>;
    logs(): Promise<Result<LogRow[]>>; exportData(): Promise<Result<string>>; importData(json: string): Promise<Result<boolean>>;
  };
  openExternal(u: string): Promise<Result<void>>;
}
