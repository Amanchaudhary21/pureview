import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { AppError } from '../src/errors';

let pool: Pool;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    platform VARCHAR(30) NOT NULL, video_id VARCHAR(200) NOT NULL, title VARCHAR(500) NULL,
    thumbnail_url VARCHAR(1000) NULL, channel_name VARCHAR(300) NULL, duration INT NULL,
    video_url VARCHAR(2000) NOT NULL, created_at DATETIME(3) NOT NULL,
    UNIQUE KEY uq_video (platform, video_id))`,
  `CREATE TABLE IF NOT EXISTS history (
    id INT AUTO_INCREMENT PRIMARY KEY, video_id INT NOT NULL, watched_at DATETIME(3) NOT NULL,
    KEY ix_watched (watched_at),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS playlists (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, description VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS playlist_items (
    id INT AUTO_INCREMENT PRIMARY KEY, playlist_id INT NOT NULL, video_id INT NOT NULL, position INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_item (playlist_id, video_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS favorites (
    id INT AUTO_INCREMENT PRIMARY KEY, video_id INT NOT NULL UNIQUE, created_at DATETIME(3) NOT NULL,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(100) PRIMARY KEY, setting_value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_logs (
    id INT AUTO_INCREMENT PRIMARY KEY, error_id VARCHAR(50), module VARCHAR(50), severity VARCHAR(20),
    message VARCHAR(500), created_at DATETIME(3) NOT NULL)`
];

export async function initDb() {
  const database = process.env.MYSQL_DATABASE || 'pureview';
  if (!/^\w{1,64}$/.test(database)) throw new Error('MYSQL_DATABASE may only contain letters, digits and _');
  const base = {
    host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD ?? '',
    // all times are stored and read as UTC; the app always passes JS Dates
    timezone: 'Z' as const
  };
  const setup = await mysql.createConnection(base);
  try { await setup.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); }
  finally { await setup.end(); }

  pool = mysql.createPool({ ...base, database, connectionLimit: 5, charset: 'utf8mb4' });
  for (const sql of TABLES) await pool.query(sql);
  return { database, host: base.host, port: base.port, user: base.user };
}

export const closeDb = () => pool?.end();

export async function rows<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await pool.query<RowDataPacket[]>(sql, params);
  return r as T[];
}
export async function one<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, params))[0];
}
export async function run(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [r] = await pool.query<ResultSetHeader>(sql, params);
  return r;
}
export async function transaction<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) { await c.rollback(); throw e; }
  finally { c.release(); }
}

/** Turns MySQL driver errors into messages a person can act on. */
export function friendlyDbError(err: unknown): AppError | null {
  const code = (err as { code?: string })?.code;
  if (code === 'ECONNREFUSED') return new AppError('PV-DB-CONN', 'Cannot connect to MySQL. Is the MySQL80 service running?');
  if (code === 'ER_ACCESS_DENIED_ERROR') return new AppError('PV-DB-AUTH', 'MySQL refused the login. Check MYSQL_USER / MYSQL_PASSWORD in server/.env.');
  if (code === 'ER_NO_REFERENCED_ROW_2') return new AppError('PV-DB-REF', 'That item no longer exists.');
  if (code?.startsWith('ER_')) return new AppError('PV-DB-' + code, 'Database error: ' + code);
  return null;
}

export async function log(module: string, severity: string, message: string, id = 'PV-GEN-000') {
  try {
    await run('INSERT INTO app_logs(error_id,module,severity,message,created_at) VALUES (?,?,?,?,?)',
      [id, module.slice(0, 50), severity, message.slice(0, 500), new Date()]);
  } catch { /* ignore */ }
}
