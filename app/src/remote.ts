import type { PvApi, Result } from './types';
import { backend } from './backend';

// Talks to the local PureView server (server/index.ts), which stores everything in MySQL.
const rpc = (method: string) => async (...args: unknown[]): Promise<Result<any>> => {
  try {
    const r = await fetch('/api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return { ok: false, error: { code: 'PV-API-OFFLINE', message: 'Cannot reach the PureView server. Start it with "npm run dev" (check the terminal for MySQL errors).' } };
  }
};

export const remote: PvApi = {
  search: rpc('search'),
  play: rpc('play'),
  history: { list: rpc('history.list'), clear: rpc('history.clear'), remove: rpc('history.remove') },
  fav: { list: rpc('fav.list'), has: rpc('fav.has'), toggle: rpc('fav.toggle') },
  pl: {
    list: rpc('pl.list'), create: rpc('pl.create'), delete: rpc('pl.delete'),
    items: rpc('pl.items'), add: rpc('pl.add'), remove: rpc('pl.remove')
  },
  settings: {
    get: rpc('settings.get'), setApiKey: rpc('settings.setApiKey'), set: rpc('settings.set'),
    logs: rpc('settings.logs'), exportData: rpc('settings.exportData'), importData: rpc('settings.importData')
  },
  openExternal: backend.openExternal // opening a tab happens in the browser
};
