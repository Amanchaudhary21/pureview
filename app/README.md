# PUREVIEW – Personal Video Library

A private, local-first YouTube library that runs entirely in your browser (React + TypeScript + Vite).

## Features
- Home dashboard (continue watching, favorites, playlists)
- YouTube search (YouTube Data API v3) or paste any YouTube link (no key needed)
- Official YouTube embedded player (YouTube's own ads/rules apply; no player modification)
- History, Favorites, Playlists, saved in this browser's localStorage only
- Download / restore a JSON backup of your data (the API key is never included)
- Dark/Light theme, keyboard shortcuts: Ctrl+K search, Ctrl+H history

## Run locally
1. Install Node.js 22 or newer.
2. In this folder run: `npm install`
3. Development server: `npm run dev` (http://localhost:5173)
4. Production build: `npm run build` -> `dist/` (static files, host anywhere); `npm run preview` to try it

## Deploy
Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
One-time setup: repo **Settings -> Pages -> Source: GitHub Actions**.

## YouTube API key (optional, for keyword search)
Google Cloud Console -> create project -> enable "YouTube Data API v3" -> Credentials -> API key.
Under "Application restrictions" choose **Websites** and add your site address (e.g. `https://yourname.github.io/*`),
so the key only works from your site. Paste it in Settings. It is stored in this browser only and sent only to Google.

## Tests
`npm test` (URL/ID parsing, validation, and the storage layer).

## Troubleshooting
- Search says "access denied/quota": key invalid, website restriction doesn't match, or daily quota (10,000 units, ~100 searches) used up.
- Data is per browser and per device. Clearing site data deletes it, so download a backup now and then.

## Structure
src/ (React UI; `backend.ts` = storage + YouTube API, `validation.ts`) · tests/
