import { FormEvent, useEffect, useState } from 'react';
import { pv, unwrap } from '../api';
import type { Playlist, Video } from '../types';
import VideoCard, { Empty, Grid } from '../components/VideoCard';
import { useUI } from '../store';

export default function Playlists() {
  const show = useUI(s => s.show);
  const [pls, setPls] = useState<Playlist[]>([]);
  const [sel, setSel] = useState<Playlist | null>(null);
  const [items, setItems] = useState<Video[]>([]);
  const [name, setName] = useState('');

  const err = (e: unknown) => show((e as Error).message, 'err');
  const load = () => unwrap(pv().pl.list()).then(setPls).catch(err);
  const loadItems = (p: Playlist) => unwrap(pv().pl.items(p.id)).then(setItems).catch(err);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try { await unwrap(pv().pl.create({ name })); setName(''); load(); } catch (x) { err(x); }
  };
  const del = async (p: Playlist) => {
    if (!window.confirm(`Delete playlist "${p.name}"?`)) return;
    try { await unwrap(pv().pl.delete(p.id)); if (sel?.id === p.id) { setSel(null); setItems([]); } load(); } catch (x) { err(x); }
  };
  const open = (p: Playlist) => { setSel(p); loadItems(p); };
  const remove = async (v: Video) => { try { await unwrap(pv().pl.remove(v.item_id!)); if (sel) { loadItems(sel); load(); } } catch (x) { err(x); } };

  return (
    <>
      <h1>Playlists</h1>
      <form className="searchbar" onSubmit={create}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New playlist name" maxLength={100} aria-label="Playlist name" />
        <button>Create</button>
      </form>
      {pls.length ? (
        <div className="chips">{pls.map(p => (
          <span key={p.id} className={`chip ${sel?.id === p.id ? 'on' : ''}`}>
            <button className="plain" onClick={() => open(p)}>{p.name} ({p.count})</button>
            <button className="plain x" aria-label={`Delete ${p.name}`} onClick={() => del(p)}>✕</button>
          </span>))}
        </div>) : <Empty text="No playlists yet." />}
      {sel && (<><h2>{sel.name}</h2>
        {items.length ? <Grid>{items.map(v => <VideoCard key={v.item_id} v={v} actions={<button className="ghost" onClick={() => remove(v)}>Remove</button>} />)}</Grid> : <Empty text="This playlist is empty. Add videos from the player page." />}</>)}
    </>
  );
}
