# PUREVIEW – Personal Video Library

A private, local-first YouTube library that runs entirely in your browser (React + TypeScript + Vite).

## Features
- Home dashboard (continue watching, favorites, playlists)
- YouTube search (YouTube Data API v3) or paste any YouTube link (no key needed)
- Official YouTube embedded player (YouTube's own ads/rules apply; no player modification)
- History, Favorites, Playlists, saved in this browser's localStorage only
- Download / restore a JSON backup of your data (the API key is never included)
- Dark/Light theme, keyboard shortcuts: Ctrl+K search, Ctrl+H history

## Storage
- **Website (GitHub Pages):** data is saved in the browser (localStorage).
- **On your PC with MySQL:** data is saved in a local MySQL database through a small API server
  (`server/`) that only listens on 127.0.0.1.

Backups use the same file format in both, so you can move data with Download / Restore backup.

## Run locally with MySQL
1. Install Node.js 22 or newer and MySQL 8.0.19 or newer.
2. In this folder run: `npm install`
3. Copy `server/.env.example` to `server/.env` and set `MYSQL_PASSWORD` (and `MYSQL_USER` if not root).
   The `pureview` database and its tables are created automatically on first start.
4. Development: `npm run dev` (API + site, open http://localhost:5173)
5. Or build once and serve everything from the API: `npm start` (open http://localhost:3001)

Browser-storage mode without a server: `npm run dev:browser`.
Static build for hosting: `npm run build` -> `dist/`.

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

- "Cannot reach the PureView server": start it with `npm run dev` and read the `api` lines in the terminal.
- "MySQL refused the login": check `MYSQL_USER` / `MYSQL_PASSWORD` in `server/.env`.

## Structure
src/ (React UI; `backend.ts` = browser storage, `remote.ts` = MySQL API client, `youtube.ts`, `validation.ts`) ·
server/ (Node API + MySQL) · tests/
