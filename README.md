# Kawaii Pixel Pomodoro

## Local setup

1. Run `npm install`.
2. Create an app at https://developer.spotify.com/dashboard.
3. Enable **Web Playback SDK**.
4. Add `http://127.0.0.1:3000/` as a redirect URI. The trailing slash is required.
5. Copy `.env.example` to `.env.local`.
6. Set `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` and `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI`.
7. Run `npm run dev`, then open `http://127.0.0.1:3000/`.

## Deploy with Vercel

1. Create a GitHub repository and push this project.
2. Import the repository at https://vercel.com/new.
3. In Vercel project settings, add:
   - `NEXT_PUBLIC_SPOTIFY_CLIENT_ID=<your Spotify client ID>`
   - `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=https://YOUR-PROJECT.vercel.app/`
4. Redeploy the project.
5. In the Spotify Developer Dashboard, add the exact Vercel URL ending in `/` as a redirect URI.
6. Open the deployed app and connect Spotify.

The app is publicly usable through Vercel. Spotify login still requires each user to authorize the app with their own Spotify account. Browser playback requires Spotify Premium.
