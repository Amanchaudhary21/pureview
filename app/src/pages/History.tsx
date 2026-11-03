import { useEffect, useState } from 'react';
import { pv, unwrap } from '../api';
import type { Video } from '../types';
import VideoCard, { Empty, Grid } from '../components/VideoCard';
import { useUI } from '../store';

export default function History() {
  const show = useUI(s => s.show);
  const [items, setItems] = useState<Video[]>([]);
  const load = () => unwrap(pv().history.list()).then(setItems).catch(e => show((e as Error).message, 'err'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const clear = async () => {
    if (!window.confirm('Clear all watch history?')) return;
    try { await unwrap(pv().history.clear()); setItems([]); show('History cleared'); } catch (e) { show((e as Error).message, 'err'); }
  };
  const remove = async (hid: number) => { try { await unwrap(pv().history.remove(hid)); load(); } catch (e) { show((e as Error).message, 'err'); } };
  return (
    <>
      <div className="row between"><h1>History</h1>{items.length > 0 && <button className="danger" onClick={clear}>Clear history</button>}</div>
      {items.length ? <Grid>{items.map(v => <VideoCard key={v.hid} v={v} actions={<><span className="sub">{v.watched_at && new Date(v.watched_at).toLocaleString()}</span><button className="ghost" onClick={() => remove(v.hid!)}>Remove</button></>} />)}</Grid> : <Empty text="No watch history yet." />}
    </>
  );
}
