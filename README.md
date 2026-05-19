# Repo Dungeon

## Local validation

```bash
npm ci
npm run lint
npm run typecheck
npm run test -- --run
npm run build:web
npm run check:bundle-size
```

## Electron packaging (Phase 6)

```bash
npm run build:electron
npm run package:electron
npm run package:electron:full
```

Platform-specific packaging:

```bash
npm run package:electron:mac
npm run package:electron:win
npm run package:electron:linux
```

Use `VITE_BASE_PATH` (for example `/repo-dungeon/`) when building for GitHub Pages.

## Release and deploy workflow

- `ci.yml` enforces lint, typecheck, tests, web build, bundle budget, and Electron main-process build.
- `deploy-pages.yml` re-runs release verification before publishing `dist/` to GitHub Pages.
- `release-desktop.yml` builds signed-ready desktop artifacts for macOS/Windows/Linux on `v*` tags and attaches them to GitHub Releases.

## Bundle/performance profiling

```bash
npm run build:web:profile
npm run check:bundle-size
```

`build:web:profile` emits sourcemaps for runtime profiling while preserving production-equivalent chunking.
