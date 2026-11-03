import { useNavigate } from 'react-router-dom';
import type { Video } from '../types';

export function watchLink(v: Video) { return `/watch?v=${encodeURIComponent(v.video_id)}`; }

export default function VideoCard({ v, actions }: { v: Video; actions?: React.ReactNode }) {
  const nav = useNavigate();
  const open = () => nav(watchLink(v), { state: { video: v } });
  return (
    <div className="card">
      <button className="thumb" onClick={open} aria-label={`Play ${v.title ?? 'video'}`}>
        {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" loading="lazy" /> : <div className="nothumb">No image</div>}
        {v.duration != null && <span className="duration">{formatDuration(v.duration)}</span>}
      </button>
      <div className="meta">
        <button className="title" title={v.title ?? ''} onClick={open}>{v.title ?? '(untitled)'}</button>
        <div className="sub">{v.channel_name ?? v.platform}</div>
        {actions && <div className="row">{actions}</div>}
      </div>
    </div>
  );
}

export function Grid({ children }: { children: React.ReactNode }) { return <div className="grid">{children}</div>; }
export function Empty({ text }: { text: string }) { return <p className="empty">{text}</p>; }

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
