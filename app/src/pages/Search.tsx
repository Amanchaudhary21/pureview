import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { pv, unwrap } from '../api';
import type { Video } from '../types';
import { parsePlaylistId, parseYouTubeId } from '../validation';
import VideoCard, { Empty, Grid, watchLink } from '../components/VideoCard';
import { useUI } from '../store';

export default function Search() {
  const nav = useNavigate();
  const show = useUI(s => s.show);
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<Video[] | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (term: string) => {
    setErr(''); 
    if (!term.trim()) { setErr('Type something to search.'); return; }
    setLoading(true);
    try {
      const found = await unwrap(pv().search(term));
      // a pasted video link: go straight to the player
      if (found.length === 1 && parseYouTubeId(term)) { nav(watchLink(found[0]), { replace: true, state: { video: found[0] } }); return; }
      setRes(found);
    }
    catch (e) { setRes(null); setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [nav]);
  useEffect(() => {
    setQ(initial);
    if (initial) void run(initial);
    else { setRes(null); setErr(''); }
  }, [initial, run]);

  const isList = !!parsePlaylistId(initial);
  const [saving, setSaving] = useState(false);
  const saveAll = async () => {
    const name = window.prompt('Name for the new playlist:', 'YouTube playlist')?.trim();
    if (!name || !res) return;
    setSaving(true);
    try {
      const plId = await unwrap(pv().pl.create({ name }));
      for (const v of res) await unwrap(pv().pl.add(plId, v));
      show(`Saved ${res.length} videos to "${name}"`);
    } catch (e) { show((e as Error).message, 'err'); }
    finally { setSaving(false); }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) { setErr('Type something to search.'); return; }
    if (term === initial) void run(term);
    else setParams({ q: term });
  };

  return (
    <>
      <h1>Search</h1>
      <form className="searchbar" onSubmit={submit}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search YouTube or paste a video or playlist link" aria-label="Search" />
        <button disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {err && <p className="error" role="alert">{err}</p>}
      {res && isList && res.length > 0 && (
        <div className="row between"><h2>YouTube playlist · {res.length} videos</h2>
          <button disabled={saving} onClick={saveAll}>{saving ? 'Saving…' : 'Save as playlist'}</button></div>)}
      {res && (res.length ? <Grid>{res.map(v => <VideoCard key={v.video_id} v={v} />)}</Grid> : <Empty text="No results." />)}
    </>
  );
}
