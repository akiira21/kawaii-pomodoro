'use client';
import { useEffect, useRef } from 'react';
const W = 320, H = 180;
const hs = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const ridge = (i, b, a, f, p) => b + Math.sin((i + p) * f) * a + Math.sin((i + p) * f * 2.3) * a * 0.4;
const sky = (r, cols, to = H) => { const h = Math.ceil(to / cols.length); cols.forEach((c, i) => r(0, i * h, W, h, c)); };
const disc = (r, cx, cy, rad, c, half) => { for (let dy = -rad; dy <= (half ? 0 : rad); dy++) { const hw = Math.round(Math.sqrt(rad * rad - dy * dy)); r(cx - hw, cy + dy, hw * 2, 1, c); } };
const cloud = (r, x, y, w, under) => { r(x, y + 6, w, 6, '#fff'); r(x + 4, y + 2, w - 10, 5, '#fff'); r(x + 8, y - 1, 10, 4, '#fff'); r(x, y + 11, w, 2, under); };
const mkClouds = (n) => [...Array(n)].map((_, i) => ({ x: i * (W / n), y: 10 + ((i * 29) % 50), s: 0.05 + (i % 3) * 0.03, w: 20 + (i % 3) * 8 }));
const drift = (r, cs, under) => cs.forEach((c) => { c.x = (c.x + c.s) % (W + 60); cloud(r, c.x - 40, c.y, c.w, under); });
// Swaying grass blades: tips lean with the wind.
const grass = (r, t, yf, cols, step, wind, hmin = 3, hr = 4) => {
  for (let i = 0; i < W; i += step) {
    const h = hmin + Math.floor(hs(i) * hr), c = cols[Math.floor(hs(i + 9) * cols.length)], y = Math.round(yf(i));
    const sw = Math.round(Math.sin(t / 22 + i * 0.25) * 1.4 * wind + wind);
    r(i, y - h + 2, 1, h, c); r(i + sw, y - h, 1, 2, c);
  }
};
const fill = (r, yf, c) => { for (let i = 0; i < W; i++) r(i, yf(i), 1, H, c); };

const THEMES = {
  meadow: (r) => {
    const cs = mkClouds(6), pet = [...Array(30)].map(() => ({ x: Math.random() * W, y: Math.random() * H, v: 0.12 + Math.random() * 0.25, p: Math.random() * 6 }));
    return (t) => {
      const wind = 0.6 + Math.sin(t / 150) * 0.4;
      sky(r, ['#8fd3ff', '#a9ddff', '#c6ebff', '#e4f4ff', '#fff0f0', '#ffdcec']);
      disc(r, 262, 36, 9, '#fff3c4'); drift(r, cs, '#ffd9ec');
      fill(r, (i) => ridge(i, 100, 14, 0.018, 30), '#c8b8ff');
      fill(r, (i) => ridge(i, 118, 10, 0.03, 90), '#a5e3c0');
      fill(r, (i) => ridge(i, 140, 8, 0.04, 10), '#7fd49c');
      for (let i = 6; i < W; i += 23) { const by = Math.round(ridge(i, 140, 8, 0.04, 10)) + 2, h = 4 + (i % 3); r(i, by - 4, 2, 5, '#7a5a4a'); for (let k = 0; k < h; k++) r(i - 1 - Math.floor((h - k) / 2) + (k > h / 2 ? Math.round(Math.sin(t / 40 + i) * wind) : 0), by - 5 - k * 2, 4 + (h - k), 2, k % 2 ? '#4fb87a' : '#6fd49a'); }
      const g = (i) => ridge(i, 160, 5, 0.06, 40);
      fill(r, g, '#5cc183');
      grass(r, t, (i) => g(i) + 3, ['#4fb877', '#3a9a62', '#7fd49c'], 2, wind);
      for (let i = 3; i < W; i += 9) { const y = Math.round(g(i)) + 6 + (i % 4) * 3, c = ['#ff8fb8', '#fff', '#ffe08a', '#d9b8ff'][Math.floor(i / 9) % 4]; r(i, y, 1, 3, '#3a9a62'); r(i - 1, y - 2, 3, 1, c); r(i, y - 3, 1, 3, c); r(i, y - 2, 1, 1, '#ffe08a'); }
      pet.forEach((p) => { p.y += p.v; p.x += wind * 0.5 + Math.sin(t / 30 + p.p) * 0.3; if (p.y > H) { p.y = -2; p.x = Math.random() * W; } if (p.x > W) p.x = 0; r(p.x, p.y, 2, 2, '#ffc2dc'); r(p.x + 1, p.y, 1, 1, '#fff'); });
    };
  },
  sakura: (r) => {
    const cs = mkClouds(4), pal = ['#ffc2dc', '#ffd6e8', '#ff9fc6', '#fff0f6'];
    const bl = [...Array(300)].map((_, i) => { const a = hs(i) * 6.283, d = Math.sqrt(hs(i + 50)); return { x: 92 + Math.cos(a) * d * 70, y: 62 + Math.sin(a) * d * 38, c: pal[Math.floor(hs(i + 7) * 4)], s: 2 + Math.floor(hs(i + 3) * 3) }; });
    const spawn = () => ({ x: 25 + Math.random() * 140, y: 45 + Math.random() * 70, v: 0.2 + Math.random() * 0.3, p: Math.random() * 6 });
    const pet = [...Array(50)].map(spawn);
    const g = (i) => ridge(i, 152, 3, 0.03, 0);
    return (t) => {
      const wind = 0.55 + Math.sin(t / 140) * 0.45;
      sky(r, ['#ffd9ec', '#ffe3f1', '#ffeef6', '#fff5ef', '#eaf7ff', '#d6f0ff']);
      disc(r, 255, 40, 10, '#fff6dc'); drift(r, cs, '#ffd0e4');
      fill(r, (i) => ridge(i, 108, 12, 0.017, 60), '#e6d6ff');
      fill(r, (i) => ridge(i, 128, 9, 0.028, 5), '#cdeedd');
      for (let y = 168; y > 90; y--) { const w = Math.round(4 + ((y - 90) / 78) * 6), cx = 92 + Math.round(Math.sin(y / 14) * 1.5); r(cx - w / 2, y, w, 1, '#8a5a6a'); r(cx - w / 2, y, 1, 1, '#6a4252'); }
      for (let k = 0; k < 26; k++) { r(92 + k * 1.3, 112 - k * 0.8, 3, 2, '#8a5a6a'); r(92 - k * 1.3, 108 - k * 0.7, 3, 2, '#8a5a6a'); }
      bl.forEach((b) => r(b.x + Math.round(Math.sin(t / 50 + b.y * 0.08) * wind * 1.5), b.y, b.s + 1, b.s, b.c));
      fill(r, g, '#bfe8b5'); fill(r, () => 168, '#a6dc9f');
      grass(r, t, (i) => g(i) + 3, ['#7fd49c', '#5cc183', '#a6e8b8'], 2, wind * 1.4, 3, 5);
      pet.forEach((p, k) => { p.x += wind * 0.9 + Math.sin(t / 20 + p.p) * 0.3; p.y += p.v; if (p.y > H - 8 || p.x > W) pet[k] = spawn(); r(p.x, p.y, 2, 2, '#ffc2dc'); r(p.x + 1, p.y, 1, 1, '#fff'); });
      grass(r, t, () => H, ['#5cc183', '#4aa872', '#7fd49c'], 3, wind * 1.8, 5, 6);
    };
  },
  night: (r) => {
    const stars = [...Array(70)].map((_, i) => ({ x: hs(i) * W, y: hs(i + 99) * 110, p: hs(i + 5) * 6 }));
    const fl = [...Array(18)].map((_, i) => ({ x: hs(i + 200) * W, y: 110 + hs(i + 300) * 55, p: hs(i) * 6 }));
    const g = (i) => ridge(i, 150, 4, 0.04, 20);
    return (t) => {
      const wind = 0.5 + Math.sin(t / 130) * 0.4;
      sky(r, ['#1b1442', '#2a1f5e', '#3b2a7a', '#52388f', '#6e4a9e', '#8d5fa8']);
      stars.forEach((s) => { const on = Math.sin(t / 25 + s.p) > -0.3; r(s.x, s.y, on ? 2 : 1, on ? 2 : 1, '#fff6c8'); });
      disc(r, 255, 42, 12, '#fff3c4'); r(250, 38, 3, 3, '#f0dc9c'); r(258, 47, 4, 3, '#f0dc9c');
      const k = t % 420; if (k < 30) { r(300 - k * 8, 10 + k * 3, 6, 1, '#fff'); r(306 - k * 8, 10 + k * 3, 3, 1, '#c8b8ff'); }
      fill(r, (i) => ridge(i, 110, 14, 0.018, 70), '#3b3170');
      fill(r, (i) => ridge(i, 128, 10, 0.03, 20), '#2c2a5c');
      fill(r, g, '#1f3a4a');
      grass(r, t, (i) => g(i) + 3, ['#2f6a6a', '#3b8a78', '#5fb59a'], 2, wind, 3, 5);
      fl.forEach((f) => { const x = f.x + Math.sin(t / 37 + f.p) * 14, y = f.y + Math.cos(t / 29 + f.p) * 8, on = Math.sin(t / 15 + f.p) > 0; r(x, y, on ? 2 : 1, on ? 2 : 1, on ? '#ffe66d' : '#b89a3c'); });
    };
  },
  sea: (r) => {
    const cs = mkClouds(4), birds = [...Array(4)].map((_, i) => ({ x: i * 80, y: 30 + i * 12, s: 0.25 + i * 0.05 }));
    return (t) => {
      sky(r, ['#7a6bd6', '#b27ad0', '#e88fc0', '#ff9fae', '#ffbf9b', '#ffdf9f'], 100);
      disc(r, 160, 100, 24, '#ffd98a', true); disc(r, 160, 100, 18, '#fff0b8', true);
      drift(r, cs, '#ffb4c4');
      ['#6ec1e4', '#5eb3dc', '#4fa5d3', '#4396c8'].forEach((c, k) => r(0, 100 + k * 20, W, 20, c));
      for (let y = 103; y < H; y += 5) for (let x = 0; x < W; x += 24) r((x + t * (0.2 + y / H) + y * 7) % W, y, 7, 1, '#bfe6f5');
      for (let y = 101; y < H; y += 3) { const w = Math.max(4, 40 - (y - 100) * 0.5); r(160 + Math.sin(t / 20 + y) * 3 - w / 2, y, w, 1, '#ffe9a6'); }
      birds.forEach((b) => { b.x = (b.x + b.s) % (W + 20); const up = Math.sin(t / 6 + b.x) > 0; r(b.x, b.y, 3, 1, '#4a3a5c'); r(b.x - 1, b.y + (up ? -1 : 1), 1, 1, '#4a3a5c'); r(b.x + 3, b.y + (up ? -1 : 1), 1, 1, '#4a3a5c'); });
    };
  },
};

export default function PixelBackground({ theme }) {
  const ref = useRef();
  useEffect(() => {
    const x = ref.current.getContext('2d');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), w, h); };
    const draw = (THEMES[theme] || THEMES.meadow)(r);
    let t = 0, raf;
    const loop = () => { draw(t++); if (!still) raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [theme]);
  return <canvas ref={ref} className="bg" width={W} height={H} aria-hidden="true" />;
}
