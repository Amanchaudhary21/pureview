import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '../src/errors';
import { closeDb, friendlyDbError, initDb } from './db';
import { handlers, isValidationError, log } from './api';

const here = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(here, '.env')); } catch { /* no .env: use defaults / real env vars */ }

const PORT = Number(process.env.PORT || 3001);
const HOST = '127.0.0.1'; // never reachable from other computers: this API has no login
const STATIC_DIR = path.join(here, '..', 'dist-mysql'); // built by `npm start`
const MAX_BODY = 20 * 1024 * 1024;

// Only this app may call the API. Blocks other websites open in your browser
// (they can't send a JSON POST without CORS approval, and the Host check stops DNS rebinding).
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, 'localhost:5173', '127.0.0.1:5173']);
const allowedOrigin = (o: string | undefined) => !o || [...ALLOWED_HOSTS].some(h => o === `http://${h}`);

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new AppError('PV-API-413', 'Request too large.');
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function rpc(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { ok: false, error: { code: 'PV-API-415', message: 'JSON only' } });
  let method = 'unknown';
  try {
    const body = JSON.parse(await readBody(req)) as { method?: unknown; args?: unknown };
    method = String(body.method);
    const fn = Object.hasOwn(handlers, method) ? handlers[method] : undefined;
    if (!fn) throw new AppError('PV-API-404', 'Unknown action.');
    const data = await fn(...(Array.isArray(body.args) ? body.args : []));
    send(res, 200, { ok: true, data });
  } catch (err) {
    const known = err instanceof AppError ? err : friendlyDbError(err);
    const code = known?.code ?? 'PV-GEN-001';
    const message = isValidationError(err) ? 'Invalid data.' : known?.message ?? 'Unexpected server error.';
    if (!known && !isValidationError(err)) console.error(`[${method}]`, err);
    await log(method, 'ERROR', message, code);
    send(res, 200, { ok: false, error: { code, message } });
  }
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const file = path.normalize(path.join(STATIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end(fs.existsSync(STATIC_DIR) ? 'Not found' : 'Run "npm start" to build the app, or use "npm run dev".');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (!ALLOWED_HOSTS.has(req.headers.host ?? '') || !allowedOrigin(req.headers.origin)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Forbidden');
  }
  const url = req.url ?? '/';
  if (url === '/api/health') return send(res, 200, { ok: true });
  if (url === '/api/rpc' && req.method === 'POST') return void rpc(req, res);
  if (url.startsWith('/api/')) return send(res, 404, { ok: false, error: { code: 'PV-API-404', message: 'Not found' } });
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end();
});

initDb().then(info => {
  server.listen(PORT, HOST, () => {
    console.log(`PureView API: MySQL ${info.user}@${info.host}:${info.port}/${info.database}`);
    console.log(`Listening on http://localhost:${PORT}${fs.existsSync(STATIC_DIR) ? '  (open this in your browser)' : ''}`);
  });
}).catch(err => {
  console.error('\nCould not start: ' + (friendlyDbError(err)?.message ?? (err as Error).message));
  console.error('Set your MySQL login in app/server/.env (copy server/.env.example).\n');
  process.exit(1);
});

const stop = () => { server.close(); void closeDb()?.finally(() => process.exit(0)); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
