'use client';
import { useEffect, useRef, useState } from 'react';
import Draggable from './Draggable';
const CID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
const LOFI = 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn';
const exchangingCodes = new Set();
const b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const store = () => JSON.parse(localStorage.getItem('sp_t') || 'null');

async function login() {
  const redirectUri = REDIRECT_URI || `${location.origin}/`;
  const v = b64(crypto.getRandomValues(new Uint8Array(32)));
  const ch = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  localStorage.setItem('sp_v', v);
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: CID, response_type: 'code', redirect_uri: redirectUri, scope: SCOPES, code_challenge_method: 'S256', code_challenge: ch,
  });
}
async function tokenReq(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, ...body }),
  });
  const j = await r.json();
  if (!r.ok) {
    const detail = j.error_description || j.error || `HTTP ${r.status}`;
    throw new Error(detail);
  }
  const s = { access: j.access_token, refresh: j.refresh_token || store()?.refresh, exp: Date.now() + j.expires_in * 1000 - 60000 };
  localStorage.setItem('sp_t', JSON.stringify(s));
  return s;
}
async function freshToken() {
  let s = store();
  if (s && Date.now() > s.exp) s = await tokenReq({ grant_type: 'refresh_token', refresh_token: s.refresh });
  return s?.access;
}
const toBody = (link) => {
  const m = link.match(/(playlist|album|artist|track)[/:]([A-Za-z0-9]+)/);
  if (!m) return null;
  const uri = `spotify:${m[1]}:${m[2]}`;
  return m[1] === 'track' ? { uris: [uri] } : { context_uri: uri };
};
// Hand-made pixel icons (1 = filled pixel)
const next = ['100001', '110001', '111001', '111101', '111001', '110001', '100001'];
const ICONS = {
  play: ['1000000', '1100000', '1110000', '1111000', '1110000', '1100000', '1000000'],
  pause: Array(7).fill('1100110'),
  next,
  prev: next.map((row) => [...row].reverse().join('')),
};
function Icon({ n }) {
  const g = ICONS[n];
  return (
    <svg viewBox={`0 0 ${g[0].length} 7`} width={g[0].length * 4} height="28" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      {g.flatMap((row, y) => [...row].map((c, x) => c === '1' && <rect key={x + '-' + y} x={x} y={y} width="1" height="1" />))}
    </svg>
  );
}

export default function Spotify() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [st, setSt] = useState(null);
  const [vol, setVol] = useState(4);
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState(LOFI);
  const [err, setErr] = useState('');
  const player = useRef(null);
  const device = useRef(null);

  useEffect(() => {
    (async () => {
      const q = new URLSearchParams(location.search);
      if (q.get('error')) {
        setErr(`Spotify login was cancelled or rejected: ${q.get('error')}`);
        history.replaceState({}, '', '/');
        return;
      }
      if (q.get('code')) {
        const redirectUri = REDIRECT_URI || `${location.origin}/`;
        const code = q.get('code');
        if (exchangingCodes.has(code)) return;
        exchangingCodes.add(code);
        try { await tokenReq({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: localStorage.getItem('sp_v') }); }
        catch (error) {
          console.error('Spotify token exchange failed:', error);
          setErr(`Spotify login failed: ${error.message}. Check the redirect URI and restart the app.`);
        }
        history.replaceState({}, '', '/');
      }
      if (store()) setAuthed(true);
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({ name: 'Kawaii Pomodoro', volume: 0.5, getOAuthToken: async (cb) => cb(await freshToken()) });
      p.addListener('ready', ({ device_id }) => { device.current = device_id; setReady(true); });
      p.addListener('player_state_changed', (s) => setSt(s));
      p.addListener('authentication_error', () => { localStorage.removeItem('sp_t'); setAuthed(false); });
      p.addListener('account_error', () => setErr('Spotify Premium is needed to play music in the browser.'));
      p.connect(); player.current = p;
    };
    if (window.Spotify) window.onSpotifyWebPlaybackSDKReady();
    else { const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; document.body.appendChild(s); }
    return () => player.current?.disconnect();
  }, [authed]);

  const play = async () => {
    const body = toBody(link);
    if (!body) return setErr('Paste a Spotify playlist, album, artist or track link.');
    setErr(''); player.current?.activateElement();
    const r = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + device.current, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + (await freshToken()), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) setErr('Could not start that link. Check it and try again.');
  };
  const p = player.current;
  const name = st?.track_window?.current_track?.name || (ready ? 'Pick a playlist' : 'Connecting…');

  return (
    <Draggable id="music" className="card mini">
      <div className="grip" title="Drag to move" />
      {!CID && <p>Add NEXT_PUBLIC_SPOTIFY_CLIENT_ID to .env.local to enable Spotify.</p>}
      {CID && !authed && <button className="px go" onClick={login}>♪ Connect Spotify</button>}
      {authed && (<>
        <div className="song" aria-live="polite">♪ {name}</div>
        <div className="row">
          <button className="px" onClick={() => p?.previousTrack()} aria-label="Previous"><Icon n="prev" /></button>
          <button className="px go" onClick={() => { p?.activateElement(); p?.togglePlay(); }} aria-label={st && !st.paused ? 'Pause' : 'Play'}><Icon n={st && !st.paused ? 'pause' : 'play'} /></button>
          <button className="px" onClick={() => p?.nextTrack()} aria-label="Next"><Icon n="next" /></button>
        </div>
        <div className="row mid">
          <div className="vol" role="group" aria-label="Volume">
            {[...Array(8)].map((_, i) => (
              <button key={i} style={{ height: 6 + i * 3 }} className={i < vol ? 'f' : ''} aria-label={`Volume ${i + 1} of 8`}
                onClick={() => { setVol(i + 1); p?.setVolume((i + 1) / 8); }} />
            ))}
          </div>
          <button className="px sm" onClick={() => setShowLink(!showLink)}>{showLink ? 'Close' : 'Playlist'}</button>
        </div>
        {showLink && <div className="row"><input type="text" value={link} onChange={(e) => setLink(e.target.value)} aria-label="Spotify link" />
          <button className="px go sm" disabled={!ready} onClick={play}>Play link</button></div>}
      </>)}
      {err && <p role="alert">{err}</p>}
    </Draggable>
  );
}
