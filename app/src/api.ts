import type { Result } from './types';
import { backend } from './backend';
export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
}
export const pv = () => backend;
