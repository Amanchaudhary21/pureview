import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { pv, unwrap } from '../api';
import type { Playlist, Video } from '../types';
import { useUI } from '../store';

export default function Watch() {
  const [params] = useSearchParams();
  const loc = useLocation();
  const show = useUI(s => s.show);
  const id = params.get('v') ?? '';
  const stateVideo = (loc.state as { video?: Video } | null)?.video;
  const video: Video = stateVideo && stateVideo.video_id === id ? stateVideo : {
    platform: 'youtube', video_id: id, title: null, channel_name: null, duration: null,
    thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, video_url: `https://www.youtube.com/watch?v=${id}`
  };
  const valid = /^[A-Za-z0-9_-]{11}$/.test(id);
  const [fav, setFav] = useState(false);
  const [pls, setPls] = useState<Playlist[]>([]);
  const logged = useRef('');

  useEffect(() => {
    if (!valid || logged.current === id) return;
    logged.current = id; // StrictMode guard: record history once per video
    unwrap(pv().play(video)).catch(e => show((e as Error).message, 'err'));
    unwrap(pv().fav.has('youtube', id)).then(setFav).catch(() => {});
    unwrap(pv().pl.list()).then(setPls).catch(() => {});
    // eslint-disable-next-line
  }, [id]);

  if (!valid) return <p className="error">Invalid video link.</p>;

  const toggleFav = async () => { try { setFav(await unwrap(pv().fav.toggle(video))); } catch (e) { show((e as Error).message, 'err'); } };
  const addTo = async (plId: number) => {
    try { show((await unwrap(pv().pl.add(plId, video))) ? 'Added to playlist' : 'Already in that playlist'); }
    catch (e) { show((e as Error).message, 'err'); }
  };

  return (
    <>
      <div className="player">
        <iframe title="YouTube player" src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      </div>
      <h1 className="wtitle">{video.title ?? 'Now playing'}</h1>
      <p className="sub">{video.channel_name}</p>
      <div className="row">
        <button onClick={toggleFav}>{fav ? '★ Favorited' : '☆ Favorite'}</button>
        <select aria-label="Add to playlist" value="" onChange={e => e.target.value && addTo(Number(e.target.value))}>
          <option value="">{pls.length ? 'Add to playlist…' : 'No playlists yet'}</option>
          {pls.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="ghost" onClick={() => unwrap(pv().openExternal(video.video_url)).catch(e => show((e as Error).message, 'err'))}>Open on YouTube</button>
      </div>
      <p className="sub">Playback uses YouTube's official player, so YouTube's own ads and rules apply.</p>
    </>
  );
}
