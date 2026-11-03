import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { pv, unwrap } from '../api';
import type { LogRow, SettingsInfo } from '../types';
import { useUI } from '../store';

export default function Settings() {
  const show = useUI(s => s.show);
  const [s, setS] = useState<SettingsInfo | null>(null);
  const [key, setKey] = useState('');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const err = (e: unknown) => show((e as Error).message, 'err');
  const load = () => { unwrap(pv().settings.get()).then(setS).catch(err); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const saveKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!key && !window.confirm('Remove the saved API key?')) return;
    try { await unwrap(pv().settings.setApiKey(key)); setKey(''); show(key ? 'API key saved' : 'API key removed'); load(); } catch (x) { err(x); }
  };
  const setTheme = async (t: string) => { try { await unwrap(pv().settings.set('theme', t)); document.documentElement.dataset.theme = t; load(); } catch (x) { err(x); } };
  const exportData = async () => {
    try {
      const json = await unwrap(pv().settings.exportData());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `pureview-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      show('Backup downloaded');
    } catch (x) { err(x); }
  };
  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !window.confirm('Replace all current history, favorites and playlists with this backup?')) return;
    try { await unwrap(pv().settings.importData(await file.text())); show('Backup restored'); load(); } catch (x) { err(x); }
  };
  const showLogs = () => unwrap(pv().settings.logs()).then(setLogs).catch(err);

  if (!s) return <p>Loading…</p>;
  const mysql = s.storage === 'mysql';
  const where = mysql ? 'in the MySQL database on this PC' : 'in this browser';
  return (
    <>
      <h1>Settings</h1>
      <section className="panel"><h2>YouTube search</h2>
        <p className="sub">Status: {s.hasApiKey ? `API key saved ${where} (never shown again)` : 'no key. Pasting a video link still works.'}</p>
        <form className="searchbar" onSubmit={saveKey}>
          <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="YouTube Data API v3 key" autoComplete="off" aria-label="API key" />
          <button disabled={!key && !s.hasApiKey}>{key ? 'Save' : 'Remove key'}</button>
        </form>
        <p className="sub">Create a free key in Google Cloud Console → enable "YouTube Data API v3". The key is stored only {where} and sent only to Google.{!mysql && " Restrict it to this website's address in the console."}</p>
      </section>

      <section className="panel"><h2>Appearance</h2>
        <div className="row">
          <button className={s.theme === 'dark' ? '' : 'ghost'} onClick={() => setTheme('dark')}>Dark</button>
          <button className={s.theme === 'light' ? '' : 'ghost'} onClick={() => setTheme('light')}>Light</button>
        </div>
      </section>

      <section className="panel"><h2>Data</h2>
        <div className="row">
          <button onClick={exportData}>Download backup</button>
          <button className="ghost" onClick={() => fileInput.current?.click()}>Restore backup</button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={importData} hidden />
          <button className="ghost" onClick={showLogs}>Show error log</button>
        </div>
        {logs.length > 0 && <pre className="log">{logs.map(l => `${l.created_at}  ${l.severity}  ${l.error_id}  ${l.module}: ${l.message}`).join('\n')}</pre>}
        <p className="sub">Storage: <strong>{mysql ? 'MySQL (this PC)' : 'this browser'}</strong>. Your history, favorites and playlists are saved {where}.
          {mysql ? ' Backups use the same file format as the website, so you can move data between them.' : ' Clearing site data deletes them, so download a backup now and then.'}</p>
      </section>
      <p className="sub">PUREVIEW 1.0.0</p>
    </>
  );
}
