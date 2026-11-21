export default function manifest() {
  return {
    name: 'Kawaii Pomodoro',
    short_name: 'Pomodoro',
    description: 'A cozy kawaii pixel focus timer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff6e6',
    theme_color: '#ff8fb8',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
