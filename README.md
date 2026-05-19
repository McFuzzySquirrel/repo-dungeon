# Repo Dungeon

Turn a GitHub profile into a playable dungeon crawler.

Each repository becomes a room. You explore the dungeon, open room info panels, collect loot, unlock badges, and jump to GitHub when you find something interesting.

<img src="docs/screenshots/welcome-page.png" alt="Repo Dungeon welcome screen" width="720" />

## What you can do in-game

- Generate a dungeon from GitHub repositories
- Move through rooms and corridors with keyboard controls on desktop or touch controls on mobile
- Open repo room details (README, files, contributors, stats)
- Use minimap/full map overlays while exploring
- Pick a class and gain XP, loot, and badges
- Track progress with visited room stamps and profile stats
- Sign in from the welcome screen to include private repositories and higher GitHub API rate limits

## Quick start (play locally)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL shown by Vite in your terminal.

If you want authenticated GitHub login in the browser during local development, you also need a local token exchange proxy:

```bash
GITHUB_CLIENT_SECRET=your_oauth_app_client_secret npm run auth:proxy
```

## GitHub OAuth setup

GitHub login is optional for public repositories, but required if you want private repositories or higher API rate limits.

Important: browser builds need a separate token exchange endpoint after GitHub redirects back with the authorization code. This repo now supports two authenticated paths:

- Electron: the desktop app can exchange the code in the main process when `GITHUB_CLIENT_SECRET` is set at launch time.
- Web: browser builds can call a separate Node/serverless exchange endpoint via `VITE_GITHUB_TOKEN_EXCHANGE_URL`.

GitHub Pages is still a static host, so it cannot host that exchange endpoint itself. You need to deploy the proxy separately and point the Pages build at it.

### Where to create the OAuth app

GitHub OAuth apps live under your GitHub account settings, not the repository settings.

1. Open `Settings` from your GitHub profile menu.
2. Open `Developer settings`.
3. Open `OAuth Apps`.
4. Click `New OAuth App`.

Direct links:

- `https://github.com/settings/apps`
- `https://github.com/settings/applications/new`

### Local development setup

Create a local OAuth app with:

- `Homepage URL`: `http://localhost:5173/`
- `Authorization callback URL`: `http://localhost:5173/`

Then copy `.env.example` to `.env.local` and replace the placeholder client ID:

```bash
VITE_GITHUB_CLIENT_ID=your_local_oauth_app_client_id
VITE_GITHUB_REDIRECT_URI=http://localhost:5173/
VITE_GITHUB_OAUTH_SCOPE=read:user repo
VITE_GITHUB_TOKEN_EXCHANGE_URL=http://localhost:8787/api/github/oauth/exchange
```

Restart `npm run dev` after editing `.env.local`.

For local browser login, run the auth proxy in a separate terminal:

```bash
GITHUB_CLIENT_SECRET=your_local_oauth_app_client_secret npm run auth:proxy
```

For local Electron login, launch Electron with the same secret available in the environment:

```bash
GITHUB_CLIENT_SECRET=your_local_oauth_app_client_secret npm run electron
```

### GitHub Pages setup

Create a separate OAuth app for the deployed site with:

- `Homepage URL`: `https://mcfuzzysquirrel.github.io/repo-dungeon/`
- `Authorization callback URL`: `https://mcfuzzysquirrel.github.io/repo-dungeon/`

Then add these repository-level GitHub Actions variables:

1. Open repository `Settings`.
2. Open `Secrets and variables`.
3. Open `Actions`.
4. Add variable `VITE_GITHUB_CLIENT_ID` with the GitHub Pages OAuth app client ID.
5. Add variable `VITE_GITHUB_REDIRECT_URI` with `https://mcfuzzysquirrel.github.io/repo-dungeon/`.
6. Add variable `VITE_GITHUB_TOKEN_EXCHANGE_URL` with the public URL of your deployed token exchange endpoint.

The GitHub Pages deployment workflow reads those variables at build time. The token exchange endpoint itself must be deployed somewhere other than GitHub Pages. The local proxy script in `scripts/github-oauth-proxy.mjs` can be used as the basis for a Node-hosted deployment.

### Important security note

- `VITE_GITHUB_CLIENT_ID` is public and safe to ship in the frontend bundle.
- Do not put a GitHub client secret in `VITE_*` variables or in the browser build.
- `GITHUB_CLIENT_SECRET` belongs only on the Electron main process or a server-side/serverless token exchange endpoint.

## Controls

- **Move (desktop)**: `WASD` or arrow keys
- **Move (mobile/touch)**: on-screen D-pad shown during gameplay on touch devices
- **Interact (mobile/touch)**: on-screen `Interact` button
- **Full map**: `M`
- **Room info / close panels**: `Tab`, `I`, `Esc`
- **Inventory**: `I` (when progression UI is active)

## Manual testing flow (game-first)

1. Start the game and generate a dungeon.
2. Walk into several rooms and confirm room details load.
3. Open and close the full map (`M`) and confirm player marker updates.
4. Choose a class and confirm XP/level progress updates while exploring.
5. Confirm loot and badge unlock overlays appear during exploration.
6. Click **Visit on GitHub** from room info and confirm it opens the repo.
7. Reload and verify visited-room progress persists.

### Mobile touch verification

1. Open the GitHub Pages build on a phone or in a mobile device emulator.
2. Start gameplay and confirm the on-screen D-pad and `Interact` button appear.
3. Hold each direction and confirm the player keeps moving while pressed.
4. Confirm diagonal movement works by pressing two directions together.
5. Stand near a contributor or room object and confirm the `Interact` button triggers the same interaction flow as keyboard `E` on desktop.

## Project docs

- Product requirements: `docs/PRD.md`
- Build and orchestration status: `docs/PROGRESS.md`
- Agent ownership map: `docs/agent-responsibility-matrix.md`

## Validation and release commands

```bash
npm run lint
npm run typecheck
npm run test -- --run
npm run build:web
npm run check:bundle-size
```

Electron packaging:

```bash
npm run build:electron
npm run package:electron
npm run package:electron:mac
npm run package:electron:win
npm run package:electron:linux
```

Release workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/release-desktop.yml`

## Deploy and profiling notes

- Use `VITE_BASE_PATH` (for example `/repo-dungeon/`) for GitHub Pages web builds.
- Set repository Actions variables `VITE_GITHUB_CLIENT_ID`, `VITE_GITHUB_REDIRECT_URI`, and `VITE_GITHUB_TOKEN_EXCHANGE_URL` if you want the Pages build to generate the correct GitHub authorize URL and call your hosted exchange endpoint.
- Use `npm run build:web:profile` for sourcemap-enabled production profiling.
