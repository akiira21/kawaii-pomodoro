'use client';
import { useEffect, useRef, useState } from 'react';
import Draggable from './Draggable';
const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function beep() {
  try {
    const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
    o.type = 'square'; o.frequency.value = 880; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(0.08, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.7);
    o.start(); o.stop(a.currentTime + 0.7);
  } catch {}
}
// Circular clock made of 60 pixel ticks that fill as time passes.
function Ring({ filled, accent, children }) {
  const ticks = [...Array(60)].map((_, i) => {
    const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
    return <rect key={i} x={Math.round(120 + Math.cos(a) * 104 - 4)} y={Math.round(120 + Math.sin(a) * 104 - 4)} width="8" height="8" fill={i < filled ? accent : '#e9dcc6'} />;
  });
  return (
    <div className="ring">
      <svg viewBox="0 0 240 240" shapeRendering="crispEdges" aria-hidden="true">{ticks}</svg>
      <div className="mid">{children}</div>
    </div>
  );
}
export default function Timer({ s }) {
  const { durs, clock, accent } = s;
  const [tab, setTab] = useState('pomo');
  const [mode, setMode] = useState('focus');
  const [left, setLeft] = useState(durs.focus * 60);
  const [sw, setSw] = useState(0);
  const [run, setRun] = useState(false);
  const [rounds, setRounds] = useState(0);
  const mark = useRef(0);
  const total = durs[mode] * 60;
  const val = fmt(tab === 'pomo' ? left : sw);

  useEffect(() => { if (!run) setLeft(durs[mode] * 60); }, [durs, mode]);
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => {
      if (tab === 'pomo') {
        const l = Math.max(0, Math.ceil((mark.current - Date.now()) / 1000));
        setLeft(l);
        if (l === 0) { setRun(false); beep(); if (mode === 'focus') setRounds((n) => n + 1); }
      } else setSw((Date.now() - mark.current) / 1000);
    }, 200);
    return () => clearInterval(id);
  }, [run, tab, mode]);
  useEffect(() => { document.title = (run ? val + ' · ' : '') + 'Kawaii Pomodoro'; }, [run, val]);

  const toggle = () => { if (!run) mark.current = tab === 'pomo' ? Date.now() + left * 1000 : Date.now() - sw * 1000; setRun(!run); };
  const reset = () => { setRun(false); tab === 'pomo' ? setLeft(total) : setSw(0); };
  const pickMode = (m) => { setMode(m); setRun(false); };
  const pickTab = (t) => { setTab(t); setRun(false); };
  const n = tab === 'pomo' ? (total - left) / total : (sw % 60) / 60;

  return (
    <Draggable id="timer" className="card">
      <div className="grip" title="Drag to move" />
      <h1 className="title">✿ Kawaii Pomodoro</h1>
      <div className="row">
        <button className={`px ${tab === 'pomo' ? 'on' : ''}`} onClick={() => pickTab('pomo')}>Timer</button>
        <button className={`px ${tab === 'sw' ? 'on' : ''}`} onClick={() => pickTab('sw')}>Stopwatch</button>
      </div>
      {tab === 'pomo' && (
        <div className="row">
          {Object.keys(LABEL).map((k) => <button key={k} className={`px ${mode === k ? 'on' : ''}`} onClick={() => pickMode(k)}>{LABEL[k]}</button>)}
        </div>
      )}
      {clock === 'ring' ? (
        <Ring filled={Math.round(n * 60)} accent={accent}><span className="digits sm" role="timer">{val}</span></Ring>
      ) : (<>
        <div className="digits" role="timer">{val}</div>
        <div className="bar" aria-hidden="true">{[...Array(20)].map((_, i) => <i key={i} className={i < Math.round(n * 20) ? 'f' : ''} />)}</div>
      </>)}
      <div className="row">
        <button className="px go" onClick={toggle}>{run ? 'Pause' : 'Start'}</button>
        <button className="px" onClick={reset}>Reset</button>
      </div>
      {tab === 'pomo' && <p className="muted">Focus rounds done: {rounds}</p>}
    </Draggable>
  );
}
