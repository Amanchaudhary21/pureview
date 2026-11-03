import type { Result } from './types';
import { backend } from './backend';
import { remote } from './remote';

// `vite --mode mysql` (npm run dev / npm start) uses the local MySQL server;
// the normal build (GitHub Pages) keeps data in the browser.
const api = import.meta.env.MODE === 'mysql' ? remote : backend;

export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}
export const pv = () => api;
