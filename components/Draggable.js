'use client';
import { useEffect, useRef, useState } from 'react';
// Drag a card by its ".grip" bar (works with mouse, pen and touch). Position is remembered.
export default function Draggable({ id, className = '', children }) {
  const [p, setP] = useState({ x: 0, y: 0 });
  const d = useRef(null);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('kp_pos_' + id)); if (s) setP(s); } catch {}
    const reset = () => { setP({ x: 0, y: 0 }); try { localStorage.removeItem('kp_pos_' + id); } catch {} };
    window.addEventListener('kp-reset', reset);
    return () => window.removeEventListener('kp-reset', reset);
  }, [id]);
  const down = (e) => {
    if (!e.target.closest('.grip')) return;
    d.current = { sx: e.clientX - p.x, sy: e.clientY - p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => { if (d.current) setP({ x: e.clientX - d.current.sx, y: e.clientY - d.current.sy }); };
  const up = () => {
    if (!d.current) return;
    d.current = null;
    try { localStorage.setItem('kp_pos_' + id, JSON.stringify(p)); } catch {}
  };
  return (
    <div className={`drag ${className}`} style={{ transform: `translate(${p.x}px,${p.y}px)` }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {children}
    </div>
  );
}
