# Repo Dungeon

Turn a GitHub profile into a playable dungeon crawler.

Each repository becomes a room. You explore the dungeon, open room info panels, collect loot, unlock badges, and jump to GitHub when you find something interesting.

## What you can do in-game

- Generate a dungeon from GitHub repositories
- Move through rooms and corridors with keyboard controls
- Open repo room details (README, files, contributors, stats)
- Use minimap/full map overlays while exploring
- Pick a class and gain XP, loot, and badges
- Track progress with visited room stamps and profile stats

## Quick start (play locally)

```bash
npm install
npm run dev
```

Open the local URL shown by Vite in your terminal.

## Controls

- **Move**: `WASD` or arrow keys
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
- Use `npm run build:web:profile` for sourcemap-enabled production profiling.
