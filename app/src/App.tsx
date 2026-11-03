import { useEffect } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Search from './pages/Search';
import Watch from './pages/Watch';
import History from './pages/History';
import Favorites from './pages/Favorites';
import Playlists from './pages/Playlists';
import Settings from './pages/Settings';
import { useUI } from './store';
import { pv, unwrap } from './api';

const links = [
  { to: '/', label: 'Home', icon: 'M3 10.8 12 3l9 7.8v9a1.2 1.2 0 0 1-1.2 1.2h-5.3v-6.2h-5v6.2H4.2A1.2 1.2 0 0 1 3 19.8z' },
  { to: '/search', label: 'Discover', icon: 'm20.8 20.8-4.4-4.4M18 10.8a7.2 7.2 0 1 1-14.4 0 7.2 7.2 0 0 1 14.4 0Z' },
  { to: '/history', label: 'Watch history', icon: 'M3.3 12a8.7 8.7 0 1 0 2.5-6.1L3 8.5M3 4v4.5h4.5M12 7v5l3.2 2' },
  { to: '/favorites', label: 'Favorites', icon: 'M20.4 8.5c0 4.1-8.4 10-8.4 10s-8.4-5.9-8.4-10a4.2 4.2 0 0 1 8.4-1.1 4.2 4.2 0 0 1 8.4 1.1Z' },
  { to: '/playlists', label: 'Playlists', icon: 'M4 5h16M4 10h16M4 15h10M4 20h10M18 15v6m-3-3h6' },
];

function Icon({ path }: { path: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

export default function App() {
  const nav = useNavigate();
  const location = useLocation();
  const show = useUI(s => s.show);
  const toast = useUI(s => s.toast);
  const page = links.find(link => link.to === location.pathname)?.label ?? (location.pathname === '/watch' ? 'Now playing' : 'Workspace');

  useEffect(() => {
    void Promise.resolve()
      .then(() => unwrap(pv().settings.get()))
      .then(s => { document.documentElement.dataset.theme = s.theme; })
      .catch(e => show((e as Error).message, 'err'));
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 'k') { e.preventDefault(); nav('/search'); }
      else if (k === 'h') { e.preventDefault(); nav('/history'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav, show]);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <NavLink to="/" className="brand" aria-label="PureView home">
          <span className="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12 8 5.8Z" /></svg></span>
          <span className="brand-name">pure<span>view</span></span>
        </NavLink>

        <p className="nav-caption">Workspace</p>
        <nav className="nav-links">
          {links.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon path={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <section className="privacy-card">
          <div className="privacy-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5.3c0 4.4-2.9 7.7-7 9.7-4.1-2-7-5.3-7-9.7V6l7-3Z" /><path d="m9 12 2 2 4-4" /></svg></div>
          <div><strong>Your space, your rules</strong><span>Private by default</span></div>
          <span className="privacy-dot" />
        </section>
        <NavLink to="/settings" aria-label="Settings" className={({ isActive }) => `nav-link settings-link${isActive ? ' active' : ''}`}>
          <Icon path="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4ZM19.4 13.5a7.7 7.7 0 0 0 0-3l1.5-1.2-1.6-2.8-1.8.7a7.5 7.5 0 0 0-2.6-1.5L14.6 4h-3.2l-.3 1.8a7.5 7.5 0 0 0-2.6 1.5l-1.8-.7-1.6 2.8L6.6 11a7.7 7.7 0 0 0 0 3l-1.5 1.2 1.6 2.8 1.8-.7a7.5 7.5 0 0 0 2.6 1.5l.3 1.8h3.2l.3-1.8a7.5 7.5 0 0 0 2.6-1.5l1.8.7 1.6-2.8-1.5-1.2Z" />
          <span>Settings</span>
        </NavLink>
        <div className="sidebar-footer"><span className="footer-dot" /> Local-first · This browser</div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="topbar-title"><span>YOUR PERSONAL VIDEO SPACE</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <button className="quick-search" onClick={() => nav('/search')} aria-label="Search videos (Ctrl+K)">
              <Icon path={links[1].icon} /><span>Search videos</span><kbd>Ctrl K</kbd>
            </button>
            <span className="privacy-status"><i /> Local &amp; private</span>
          </div>
        </header>
        <div className="page-scroll">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/history" element={<History />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </main>
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.msg}</div>}
    </div>
  );
}
