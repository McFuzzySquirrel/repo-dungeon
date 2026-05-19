# Repo Dungeon

## Local validation

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build:web
```

## Electron packaging (Phase 1 scaffold)

```bash
npm run build:electron
npm run package:electron
```

Use `VITE_BASE_PATH` (for example `/repo-dungeon/`) when building for GitHub Pages.
