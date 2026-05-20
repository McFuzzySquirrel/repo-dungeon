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
- Repository data is cached locally so revisiting the same user loads instantly

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

## GitHub setup

No authentication is required. The game loads public repositories by GitHub username.

Repository data and room details are cached in your browser's `localStorage` for up to 24 hours (room details for 7 days), so dungeon generation is instant after the first load. Use the **🔄 Refresh** button on the welcome screen to re-fetch the latest data for a username at any time.

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
