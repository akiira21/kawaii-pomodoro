import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Kawaii Pomodoro - Cozy Pixel Focus Timer',
    template: '%s | Kawaii Pomodoro',
  },
  description: 'A cute pixel Pomodoro timer with focus and break modes, customizable themes, backgrounds, and optional Spotify playback.',
  keywords: ['Pomodoro timer', 'focus timer', 'kawaii', 'pixel timer', 'study timer', 'Spotify timer'],
  applicationName: 'Kawaii Pomodoro',
  authors: [{ name: 'Kawaii Pomodoro' }],
  creator: 'Kawaii Pomodoro',
  publisher: 'Kawaii Pomodoro',
  category: 'productivity',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    title: 'Kawaii Pomodoro - Cozy Pixel Focus Timer',
    description: 'Stay focused with a cute pixel Pomodoro timer and customizable kawaii themes.',
    siteName: 'Kawaii Pomodoro',
  },
  twitter: {
    card: 'summary',
    title: 'Kawaii Pomodoro',
    description: 'A cozy pixel focus timer with themes and optional Spotify playback.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fff6e6',
};

export default function RootLayout({ children }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Kawaii Pomodoro',
    description: 'A kawaii pixel Pomodoro timer with focus, break, stopwatch, themes, and Spotify playback.',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
  };

  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
