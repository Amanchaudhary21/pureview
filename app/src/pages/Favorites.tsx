import { useEffect, useState } from 'react';
import { pv, unwrap } from '../api';
import type { Video } from '../types';
import VideoCard, { Empty, Grid } from '../components/VideoCard';
import { useUI } from '../store';

export default function Favorites() {
  const show = useUI(s => s.show);
  const [items, setItems] = useState<Video[]>([]);
  const load = () => unwrap(pv().fav.list()).then(setItems).catch(e => show((e as Error).message, 'err'));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const unfav = async (v: Video) => { try { await unwrap(pv().fav.toggle(v)); load(); } catch (e) { show((e as Error).message, 'err'); } };
  return (
    <>
      <h1>Favorites</h1>
      {items.length ? <Grid>{items.map(v => <VideoCard key={v.id} v={v} actions={<button className="ghost" onClick={() => unfav(v)}>Remove</button>} />)}</Grid> : <Empty text="No favorites yet. Open a video and press ☆ Favorite." />}
    </>
  );
}
