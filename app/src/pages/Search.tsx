import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pv, unwrap } from '../api';
import type { Video } from '../types';
import VideoCard, { Empty, Grid } from '../components/VideoCard';

export default function Search() {
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
    try { setRes(await unwrap(pv().search(term))); }
    catch (e) { setRes(null); setErr((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    setQ(initial);
    if (initial) void run(initial);
    else { setRes(null); setErr(''); }
  }, [initial, run]);

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
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search YouTube or paste a video link" aria-label="Search" />
        <button disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>
      {err && <p className="error" role="alert">{err}</p>}
      {res && (res.length ? <Grid>{res.map(v => <VideoCard key={v.video_id} v={v} />)}</Grid> : <Empty text="No results." />)}
    </>
  );
}
