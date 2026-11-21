import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './globals.css';
export const metadata = { title: 'Kawaii Pomodoro', description: 'A cozy pixel focus timer with Spotify' };
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
