'use client';
import { useEffect, useRef, useState } from 'react';
import PixelBackground from '../components/PixelBackground';
import Timer from '../components/Timer';
import Spotify from '../components/Spotify';
import Draggable from '../components/Draggable';

const DEF = { theme: 'sakura', clock: 'ring', accent: '#ff8fb8', durs: { focus: 25, short: 5, long: 15 } };
const THEMES = [['sakura', 'Sakura'], ['meadow', 'Meadow'], ['night', 'Night'], ['sea', 'Sunset sea']];
const COLORS = [['#ff8fb8', 'Pink'], ['#8fe3b0', 'Mint'], ['#7cc8f0', 'Sky'], ['#c9a8ff', 'Lavender'], ['#ffc247', 'Honey']];

export default function Page() {
  const [s, setS] = useState(DEF);
  const [bg, setBg] = useState(null); // {type:'image'|'video', url}
  const [open, setOpen] = useState(false);
  const file = useRef();

  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem('kp_settings')); if (v) setS({ ...DEF, ...v, durs: { ...DEF.durs, ...v.durs } }); } catch {}
  }, []);
  const set = (p) => { const n = { ...s, ...p }; setS(n); try { localStorage.setItem('kp_settings', JSON.stringify(n)); } catch {} };
  const clearBg = () => { if (bg) URL.revokeObjectURL(bg.url); setBg(null); };
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    clearBg();
    setBg({ type: f.type.startsWith('video') ? 'video' : 'image', url: URL.createObjectURL(f) });
    e.target.value = '';
  };
  const dur = (k, v) => set({ durs: { ...s.durs, [k]: Math.min(120, Math.max(1, Number(v) || 1)) } });

  return (
    <div style={{ '--accent': s.accent }}>
      {!bg && <PixelBackground theme={s.theme} />}
      {bg?.type === 'image' && <img className="bg" src={bg.url} alt="" />}
      {bg?.type === 'video' && <video className="bg" src={bg.url} autoPlay loop muted playsInline />}
      <input ref={file} type="file" accept="image/*,video/*" hidden onChange={pick} />
      <div className="top"><button className="px" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Customize'}</button></div>
      {open && (
        <Draggable id="settings" className="card float">
          <div className="grip" title="Drag to move" />
          <h2 className="title">Customize</h2>
          <p className="muted">Background</p>
          <div className="row">
            {THEMES.map(([k, n]) => <button key={k} className={`px sm ${!bg && s.theme === k ? 'on' : ''}`} onClick={() => { clearBg(); set({ theme: k }); }}>{n}</button>)}
            <button className={`px sm ${bg ? 'on' : ''}`} onClick={() => file.current.click()}>Upload</button>
          </div>
          <p className="muted">Clock style</p>
          <div className="row">
            <button className={`px sm ${s.clock === 'ring' ? 'on' : ''}`} onClick={() => set({ clock: 'ring' })}>Circle</button>
            <button className={`px sm ${s.clock === 'digital' ? 'on' : ''}`} onClick={() => set({ clock: 'digital' })}>Digital</button>
          </div>
          <p className="muted">Accent color</p>
          <div className="row">
            {COLORS.map(([c, n]) => <button key={c} className={`sw ${s.accent === c ? 'on' : ''}`} style={{ background: c }} aria-label={n} onClick={() => set({ accent: c })} />)}
          </div>
          <p className="muted">Minutes</p>
          <div className="row">
            {[['focus', 'Focus'], ['short', 'Short'], ['long', 'Long']].map(([k, n]) => (
              <label key={k} className="num">{n}<input type="number" min="1" max="120" value={s.durs[k]} onChange={(e) => dur(k, e.target.value)} /></label>
            ))}
          </div>
          <button className="px sm" onClick={() => window.dispatchEvent(new Event('kp-reset'))}>Reset card positions</button>
        </Draggable>
      )}
      <main className="stage">
        <Timer s={s} />
        <Spotify />
      </main>
    </div>
  );
}
