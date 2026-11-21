'use client';
import { useEffect, useRef, useState } from 'react';
// Drag a card by its ".grip" bar (works with mouse, pen and touch). Position is remembered.
export default function Draggable({ id, className = '', children }) {
  const [p, setP] = useState({ x: 0, y: 0 });
  const d = useRef(null);
  const el = useRef(null);
  useEffect(() => {
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
    const constrain = (position) => {
      if (isMobile()) return { x: 0, y: 0 };
      if (!el.current) return position;
      const rect = el.current.getBoundingClientRect();
      const baseLeft = rect.left - position.x;
      const baseTop = rect.top - position.y;
      return {
        x: Math.max(8 - baseLeft, Math.min(position.x, window.innerWidth - baseLeft - rect.width - 8)),
        y: Math.max(8 - baseTop, Math.min(position.y, window.innerHeight - baseTop - rect.height - 8)),
      };
    };
    try {
      const s = JSON.parse(localStorage.getItem('kp_pos_' + id));
      if (s) setP(constrain(s));
    } catch {}
    const reset = () => { setP({ x: 0, y: 0 }); try { localStorage.removeItem('kp_pos_' + id); } catch {} };
    const resize = () => setP((position) => constrain(position));
    window.addEventListener('kp-reset', reset);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('kp-reset', reset);
      window.removeEventListener('resize', resize);
    };
  }, [id]);
  const down = (e) => {
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (!e.target.closest('.grip')) return;
    d.current = { sx: e.clientX - p.x, sy: e.clientY - p.y, el: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!d.current) return;
    const rect = d.current.el.getBoundingClientRect();
    const baseLeft = rect.left - p.x;
    const baseTop = rect.top - p.y;
    const x = e.clientX - d.current.sx;
    const y = e.clientY - d.current.sy;
    setP({
      x: Math.max(8 - baseLeft, Math.min(x, window.innerWidth - baseLeft - rect.width - 8)),
      y: Math.max(8 - baseTop, Math.min(y, window.innerHeight - baseTop - rect.height - 8)),
    });
  };
  const up = () => {
    if (!d.current) return;
    d.current = null;
    try { localStorage.setItem('kp_pos_' + id, JSON.stringify(p)); } catch {}
  };
  return (
    <div ref={el} className={`drag ${className}`} style={{ transform: `translate(${p.x}px,${p.y}px)` }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {children}
    </div>
  );
}
