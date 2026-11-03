import { create } from 'zustand';
interface UI { toast: { msg: string; kind: 'ok' | 'err' } | null; show: (msg: string, kind?: 'ok' | 'err') => void }
let timer: number | undefined;
export const useUI = create<UI>(set => ({
  toast: null,
  show: (msg, kind = 'ok') => { set({ toast: { msg, kind } }); window.clearTimeout(timer); timer = window.setTimeout(() => set({ toast: null }), 3500); }
}));
