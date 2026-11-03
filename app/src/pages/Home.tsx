import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pv, unwrap } from '../api';
import type { Playlist, Video } from '../types';
import VideoCard, { Empty, Grid } from '../components/VideoCard';
import { useUI } from '../store';

const topics = ['Technology', 'Design', 'Music', 'Learning', 'Documentaries'];

export default function Home() {
  const nav = useNavigate();
  const show = useUI(s => s.show);
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<Video[]>([]);
  const [favs, setFavs] = useState<Video[]>([]);
  const [pls, setPls] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [history, favorites, playlists] = await Promise.all([
          unwrap(pv().history.list()),
          unwrap(pv().fav.list()),
          unwrap(pv().pl.list()),
        ]);
        if (!active) return;
        const seen = new Set<string>();
        const unique = history.filter(video => {
          const key = `${video.platform}:${video.video_id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setRecent(unique);
        setFavs(favorites);
        setPls(playlists);
      } catch (e) {
        if (active) {
          const message = (e as Error).message;
          setError(message);
          show(message, 'err');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [show]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> A quieter corner of the internet</p>
          <h1>Your videos.<br /><span>Your way.</span></h1>
          <p className="hero-description">Find something worth watching, pick up where you left off, and keep your library close.</p>
          <form className="hero-search" onSubmit={submit}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search videos or paste a YouTube link" aria-label="Search videos" />
            <button type="submit" disabled={!q.trim()}>Explore <span aria-hidden="true">→</span></button>
          </form>
          <div className="hero-note"><span className="shield-check">✓</span> Your history and favorites stay on this device</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-glow" />
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-window">
            <div className="art-window-bar"><i /><i /><i /><span>pureview / now playing</span></div>
            <div className="art-video">
              <div className="art-mountain mountain-back" />
              <div className="art-mountain mountain-front" />
              <div className="art-play"><svg viewBox="0 0 24 24"><path d="M8.5 5.8v12.4L18 12 8.5 5.8Z" /></svg></div>
              <div className="art-progress"><i /></div>
            </div>
            <div className="art-meta"><span className="art-avatar">P</span><span><b>A little more space to focus</b><small>Your next favorite is out there.</small></span><i className="art-favorite">♥</i></div>
          </div>
          <div className="art-tag"><span>✦</span> YOUR PERSONAL LIBRARY</div>
        </div>
      </section>

      <div className="home-stats" aria-label="Your library at a glance">
        <div className="stat-item"><span className="stat-icon blue">▶</span><span><strong>{loading ? '—' : recent.length}</strong><small>Recently watched</small></span></div>
        <div className="stat-item"><span className="stat-icon coral">♡</span><span><strong>{loading ? '—' : favs.length}</strong><small>Saved favorites</small></span></div>
        <div className="stat-item"><span className="stat-icon mint">▤</span><span><strong>{loading ? '—' : pls.length}</strong><small>Your playlists</small></span></div>
        <div className="stat-local"><span /> Synced to this device</div>
      </div>

      <section className="home-section topic-section">
        <div className="section-heading">
          <div><p className="eyebrow">A good place to start</p><h2>What are you in the mood for?</h2></div>
          <span className="section-hint">Pick a topic to explore</span>
        </div>
        <div className="topic-list">
          {topics.map((topic, index) => (
            <button key={topic} className={`topic-chip topic-${index + 1}`} onClick={() => nav(`/search?q=${encodeURIComponent(topic)}`)}>
              <span>{['✳', '◈', '♫', '⌘', '◉'][index]}</span>{topic}<i aria-hidden="true">↗</i>
            </button>
          ))}
        </div>
      </section>

      {error && <div className="load-error" role="alert">{error}</div>}
      <section className="home-section">
        <div className="section-heading">
          <div><p className="eyebrow">Pick up where you left off</p><h2>Continue watching</h2></div>
          <button className="text-button" onClick={() => nav('/history')}>View history <span aria-hidden="true">→</span></button>
        </div>
        {loading ? <div className="loading-row"><span /> Loading your library…</div>
          : recent.length ? <Grid>{recent.slice(0, 4).map(v => <VideoCard key={v.hid} v={v} />)}</Grid>
            : <Empty text="Videos you watch will be waiting here when you come back." />}
      </section>

      <section className="home-section favorites-section">
        <div className="section-heading">
          <div><p className="eyebrow">Kept close</p><h2>Your favorites</h2></div>
          <button className="text-button" onClick={() => nav('/favorites')}>See all <span aria-hidden="true">→</span></button>
        </div>
        {loading ? <div className="loading-row"><span /> Loading your library…</div>
          : favs.length ? <Grid>{favs.slice(0, 4).map(v => <VideoCard key={v.id} v={v} />)}</Grid>
            : <Empty text="Save a video you love and it will be right here." />}
      </section>

      {pls.length > 0 && (
        <section className="home-section">
          <div className="section-heading"><div><p className="eyebrow">Made for you</p><h2>Your playlists</h2></div><button className="text-button" onClick={() => nav('/playlists')}>Manage playlists <span aria-hidden="true">→</span></button></div>
          <div className="chips">{pls.slice(0, 6).map(p => <button key={p.id} className="chip" onClick={() => nav('/playlists')}>{p.name} <span>· {p.count}</span></button>)}</div>
        </section>
      )}
    </div>
  );
}
