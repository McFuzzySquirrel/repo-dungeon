# Project Progress

## Current State
**Phase**: Phase 6 — Desktop & Release hardening (Complete) + Post-completion optimization layer
**Status**: Complete with post-release UX, mobile, OAuth removal, GitHub REST optimization, and documentation updates  
**Last Updated**: 2026-05-20T22:20:00Z  
**PRD**: /home/runner/work/repo-dungeon/repo-dungeon/docs/PRD.md

## Post-Completion Updates
- [x] Refined the gameplay HUD into a vertical left-rail layout with a larger XP card, separate inventory and badge buttons, and a dedicated badge details panel.
  - Files: `src/ui/AppShell.tsx`, `src/ui/components/XpHud.tsx`, `src/ui/components/InventoryPanel.tsx`, `src/ui/components/BadgePanel.tsx`, `src/ui/components/HelpOverlay.tsx`, `src/ui/styles/xp-hud.css`, `src/ui/styles/inventory-panel.css`, `src/ui/styles/badge-panel.css`, `src/ui/styles/game-hud-controls.css`, `src/styles.css`, `tests/app-shell.test.tsx`, `tests/inventory-panel.test.tsx`, `tests/badge-panel.test.tsx`
- [x] Added sprite-based corridor/pathway presentation, doorway-trimmed corridor endpoints, contextual room zoom, class/NPC SVG variants, and a single-card left/right class picker.
  - Files: `src/game/scenes/DungeonScene.ts`, `src/game/config/pathwayPresentation.ts`, `src/game/config/characterSprites.ts`, `src/game/entities/Player.ts`, `src/game/entities/NPCContributor.ts`, `src/ui/components/CharacterSelect.tsx`, `src/ui/components/WelcomeScreen.tsx`, `src/ui/components/ProfileRoom.tsx`, `src/ui/components/Minimap.tsx`, `src/ui/components/FullMapOverlay.tsx`, `src/ui/constants/playerAvatar.ts`, `src/ui/styles/character-select.css`, `public/assets/sprites/pathways/*`, `public/assets/sprites/player-*.svg`, `public/assets/sprites/npc-*.svg`, `tests/pathway-presentation.test.ts`, `tests/character-sprites.test.ts`, `tests/character-select.test.tsx`
- [x] Removed GitHub OAuth flow and migrated to public-repos-only loading with a persistent `localStorage` cache (24 h repo lists / 7 d room details).
  - Files: `src/github/api.ts`, `src/github/cache.ts`, `src/github/types.ts`, `src/ui/hooks/useGitHubData.ts`, `src/ui/components/WelcomeScreen.tsx`
- [x] Implemented GitHub REST optimization layer (items #1–#5 from `docs/optimization-research.md`):
  - **ETag / `If-None-Match` revalidation** — per-endpoint ETags persisted on `RoomDetailSnapshot`; per-page ETags on `RepoListSnapshot`. Re-issued requests return `304 Not Modified` and reuse the persisted body for **0 quota**.
  - **Repo summary reuse** — `loadRoomData({ summary })` skips `GET /repos/{owner}/{repo}` when the caller already has it (cold-cache cost per room: 5 → 4 calls).
  - **Lazy README & contributors** — defer until the relevant tab is opened (cold-cache cost per room: 4 → 2 calls in the common case).
  - **Rate-limit-aware degradation** — `RoomInfoPanel` falls back to a stale persisted snapshot when a fetch fails with `kind: 'rate_limit'`.
  - **HUD budget counter** — new `RateLimitHud` overlay surfaces `N/limit · resets in Xm`, colour-codes warn/critical, and flashes a `✓ cached` pip on free 304s.
  - Files: `src/github/api.ts`, `src/github/cache.ts`, `src/github/types.ts`, `src/ui/components/RoomInfoPanel.tsx`, `src/ui/components/RateLimitHud.tsx`, `src/ui/styles/rate-limit-hud.css`, `src/ui/AppShell.tsx`, `tests/github-api.test.ts`, `tests/github-cache.test.ts`, `docs/optimization-research.md`
- [x] Simplified GitHub entry UX so auth is owned once at the app shell, restored sessions are reflected on the welcome screen, and gameplay no longer renders a duplicate GitHub auth panel.
  - Files: `src/ui/AppShell.tsx`, `src/ui/components/WelcomeScreen.tsx`, `src/ui/hooks/useGitHubAuth.ts`, `tests/app-shell.test.tsx`, `tests/welcome-screen-auth.test.tsx`
- [x] Corrected GitHub OAuth token exchange architecture for deployed web builds and Electron. *(superseded by the OAuth removal above)*
  - Files: `src/github/auth.ts`, `src/electron/main.ts`, `src/electron/preload.ts`, `scripts/github-oauth-proxy.mjs`, `.github/workflows/deploy-pages.yml`, `README.md`, `tests/github-auth-exchange.test.ts`, `tests/github-auth-errors.test.ts`
- [x] Added friendlier auth/setup error messaging and deployment guidance for local development and GitHub Pages. *(no longer needed after OAuth removal)*
  - Files: `src/ui/hooks/useGitHubAuth.ts`, `README.md`
- [x] Added mobile touch controls for gameplay on coarse-pointer devices, including a virtual D-pad and interact button.
  - Files: `src/game/scenes/DungeonScene.ts`, `src/ui/components/TouchControls.tsx`, `src/ui/AppShell.tsx`, `src/ui/styles/touch-controls.css`, `tests/dungeon-scene.test.ts`, `tests/touch-controls.test.tsx`
- [x] Added README welcome-screen screenshot and updated player-facing documentation.
  - Files: `README.md`, `docs/screenshots/welcome-page.png`

## Completed Tasks
- [x] Phase 1, Task 1.1: Initialize Vite + Phaser + React + TypeScript scaffold (`project-architect`) [model: default]
  - Files: `package.json`, `vite.config.ts`, `tsconfig*.json`, `src/main.tsx`, `src/ui/AppShell.tsx`, `src/game/*`, `src/styles.css`
- [x] Phase 1, Task 1.2: Implement GitHub OAuth flow for web/Electron token storage (`github-platform-engineer`) [model: default]
  - Files: `src/github/auth.ts`, `src/electron/preload.ts`, `src/electron/secureStorage.ts`
- [x] Phase 1, Task 1.3: Implement GitHub API client with caching, pagination, room data loading (`github-platform-engineer`) [model: default]
  - Files: `src/github/api.ts`, `src/github/types.ts`, `src/game/systems/RoomLoader.ts`, `src/ui/hooks/useGitHubData.ts`, `tests/github-api.test.ts`
- [x] Phase 1, Task 1.4: Add Electron main process and packaging config (`release-infra-engineer`) [model: default]
  - Files: `src/electron/main.ts`, `electron-builder.config.js`
- [x] Phase 1, Task 1.5: Add CI and Pages deploy workflows (`release-infra-engineer`) [model: default]
  - Files: `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`
- [x] Phase 2, Task 2.1: Implement deterministic BSP dungeon generator, zone grouping, room mapping, corridor/gateway connectivity (`dungeon-generation-engineer`) [model: default]
  - Files: `src/game/systems/DungeonGenerator.ts`, `src/game/systems/dungeonTypes.ts`, `src/game/config/biomes.ts`, `tests/dungeon-generator.test.ts`
- [x] Phase 2, Task 2.2: Render generated dungeon in Phaser scene with player movement (`phaser-gameplay-engineer`) [model: default]
  - Files: `src/game/entities/Player.ts`, `src/game/scenes/DungeonScene.ts`, `src/game/config/gameConfig.ts`, `src/game/scenes/BootScene.ts`, `tests/dungeon-scene.test.ts`
- [x] Phase 2, Task 2.3–2.4: Build minimap HUD and full-map overlay UI with GameContext integration (`ui-experience-engineer`) [model: default]
  - Files: `src/ui/context/GameContext.tsx`, `src/ui/components/Minimap.tsx`, `src/ui/components/FullMapOverlay.tsx`, `src/ui/styles/map.css`, `tests/minimap.test.tsx`, `tests/full-map-overlay.test.tsx`, `tests/game-context.test.tsx`
- [x] Phase 3, Task 3.1–3.2: Build room info panel with GitHub data loading and visited stamp persistence (`ui-experience-engineer`) [model: default]
  - Files: `src/ui/components/RoomInfoPanel.tsx`, `src/ui/systems/VisitedStamps.ts`, `src/ui/styles/room-info.css`, `tests/room-info-panel.test.tsx`, `tests/visited-stamps.test.ts`
- [x] Phase 4, Task 4.1–4.3: Implement character classes, XP progression, loot generation, badges, inventory/profile overlays (`progression-rewards-engineer`) [model: default]
  - Files: `src/game/config/classes.ts`, `src/game/systems/ProgressionTracker.ts`, `src/game/systems/LootGenerator.ts`, `src/game/systems/BadgeTracker.ts`, `src/store/progressionStore.ts`, `src/ui/components/CharacterSelect.tsx`, `src/ui/components/LevelUpOverlay.tsx`, `src/ui/components/BadgeUnlockOverlay.tsx`, `src/ui/components/InventoryPanel.tsx`, `src/ui/components/ProfileRoom.tsx`, `src/ui/hooks/useProgression.ts`, `tests/progression-tracker.test.ts`, `tests/loot-generator.test.ts`, `tests/badge-tracker.test.ts`, `tests/character-select.test.tsx`, `tests/inventory-panel.test.tsx`, `src/ui/AppShell.tsx`
- [x] Phase 5, Task 5.1–5.3: Biome polish, NPC/object interaction scaffolding, ambient hooks, tutorial/share-url support (`world-content-engineer`) [model: default]
  - Files: `src/game/config/biomePresentation.ts`, `src/game/entities/NPCContributor.ts`, `src/game/entities/RoomObject.ts`, `src/game/entities/roomContent.ts`, `src/game/scenes/DungeonScene.ts`, `src/game/audio/audioSettings.ts`, `src/ui/components/AudioControls.tsx`, `src/ui/components/GamePolishOverlay.tsx`, `src/ui/context/GameContext.tsx`, `src/ui/components/RoomInfoPanel.tsx`, `src/ui/components/GitHubAuthPanel.tsx`, `src/ui/systems/shareUrl.ts`, `src/ui/AppShell.tsx`, `tests/biome-presentation.test.ts`, `tests/room-content.test.ts`, `tests/share-url.test.ts`, `public/assets/CREDITS.md`
- [x] Phase 6, Task 6.1–6.4: Desktop packaging, cross-browser/perf/accessibility audits, release hardening (`release-infra-engineer`) [model: default]
  - Files: `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`, `.github/workflows/release-desktop.yml`, `electron-builder.config.js`, `vite.config.ts`, `scripts/check-bundle-size.mjs`, `src/electron/main.ts`, `src/electron/secureStorage.ts`, `src/ui/components/GitHubAuthPanel.tsx`, `src/ui/systems/clipboard.ts`, `src/styles.css`, `README.md`, `package.json`, `package-lock.json`, `eslint.config.js`

## Phase Summaries

### ✅ Phase 1: Foundation
**Built**
- Full TypeScript/Vite/React/Phaser foundation.
- GitHub OAuth/session flow with local web storage and Electron secure-storage bridge.
- Octokit-based GitHub data client with in-memory caching, pagination, backoff, and room-detail loading support.
- Baseline static Phaser room scene.
- Electron packaging setup and GitHub Actions CI/Pages workflows.

**Tests/Checks Passed**
- `npm run lint`
- `npm run typecheck`
- `npm run test -- --run`
- `npm run build:web`

**Next Phase Requires**
- Replace static gameplay scene usage with generated dungeon rendering.
- Implement interactive player movement and map UI contracts before room-content work.

### ✅ Phase 2: Dungeon Generation (Complete)
**Built**
- Deterministic BSP-based dungeon generation with language/topic/misc biome assignment and one-repo-per-room mapping.
- Phaser scene rendering with generated rooms, doorway-trimmed corridor pathways, biome-aware presentation, and contextual room zoom.
- Player entity with WASD/arrow key movement, collision detection, and room transition tracking.
- Event emission for room entry and player movement (accessible to React UI).
- Minimap HUD (corner-fixed, shows current/adjacent rooms, player position, room label).
- Full-map overlay (M key toggle, zoom/pan, biome legend, entire dungeon view).
- GameContext and hooks for React access to dungeon data and player state.

**Tests/Checks Passed**
- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run test -- --run` ✓ (52 new tests, all passing)
- `npm run build:web` ✓

**Next Phase Requires**
- Room Info Panel (displays repo metadata on room entry).
- NPC/contributor profiles (guest NPCs with dialogue).
- Interactive content hooks for Phase 4 progression integration.

### ✅ Phase 3: Room Content (Complete)
**Built**
- Room Info Panel with 4 tabs: Overview (stats, description), README excerpt, top-level file tree, top 5 contributors with avatars.
- GitHub API integration for async repo data loading (README, file tree, contributors).
- Visited stamp system with localStorage persistence (per-username).
- Visual visited indicators on minimap and full-map overlays (blue checkmark, reduced opacity).
- Data caching in GameContext (max 50 entries, LRU eviction).
- Keyboard accessibility (Escape to close, Tab navigation).
- WCAG AA color contrast and semantic HTML.

**Tests/Checks Passed**
- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run test -- --run` ✓ (70 tests, all passing)
- `npm run build:web` ✓

**Next Phase Requires**
- Character class selection screen (4 classes).
- XP and level system (room entry, info panel open, GitHub visit).
- Loot generation (repo property-based).
- Badge system and profile hub.

### ✅ Phase 4: Progression System (Complete)
**Built**
- Character class system with selection UI, propagated class-specific avatars, and per-class XP modifiers.
- Progression tracker with XP awards for room entry, room-object/contributor interactions, badge progression, and GitHub visits.
- Loot generation system mapped to repo properties (language, stars, topics, contributors, archived/fork/readme flags).
- Badge tracker with milestone unlock logic, unlock overlays, and a dedicated badge details panel.
- Inventory panel, level-up overlay, HUD rail, and profile room UI components.
- Progression state store and hook integration for React overlays.

**Tests/Checks Passed**
- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run test -- --run` ✓
- `npm run build:web` ✓

**Next Phase Requires**
- Pixel art biome tilesets and class sprites.
- Ambient audio and biome presentation polish.
- Contributor NPC behaviors and interactable props.

### ✅ Phase 5: Polish & Biomes (Complete)
**Built**
- Biome presentation layer with per-biome palette/pattern/audio metadata and scene integration.
- Contributor NPC scaffolding with deterministic spawn/movement and interaction payloads.
- Interactable room objects (README Scroll, File Tree Archive, Contributors' Gallery) with event hooks.
- Ambient audio hooks and user-facing audio controls with safe fallback behavior.
- Tutorial/intro scaffolding with non-blocking overlay integration.
- Share URL encode/decode helpers integrated into app flow.

**Tests/Checks Passed**
- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run test -- --run` ✓
- `npm run build:web` ✓

**Next Phase Requires**
- Finalize Electron packaging for target platforms.
- Cross-browser validation and performance profiling.
- Accessibility audit pass and release/deploy readiness.

### ✅ Phase 6: Desktop & Release hardening (Complete)
**Built**
- Hardened Electron packaging for desktop release targets with improved builder configuration and release workflow automation.
- Added cross-browser compatibility hardening via legacy build support and runtime clipboard fallback handling.
- Added performance/release verification scripts for bundle-size checks and release validation workflow gates.
- Tightened accessibility defaults and release pipeline hardening in CI/deploy workflows.
- Updated README with release, packaging, and deployment guidance.

**Tests/Checks Passed**
- `npm run lint` ✓
- `npm run typecheck` ✓
- `npm run test -- --run` ✓
- `npm run build:web` ✓

**Release Validation**
- `npm run check:bundle-size` ✓
- `npm run package:electron` ✓ (linux unpacked artifact)

## Current Task
- [ ] None (project complete)
  - Status: Complete
  - Notes: All PRD phases (1–6) are completed.

## Remaining
- [ ] None.

## Blockers
- None

## Notes
- Post-completion HUD rail and badge details panel landed in commit `c526447`.
- Post-completion pathway sprite, character variant, and class-picker UX polish landed in commit `65abcfe`.
- Phase 5 polish/content scaffolding completed in commit `6eaa1ef`.
- Phase 6 release hardening completed in commit `3e4f061`.
- Post-completion documentation refresh (game-focused README) completed in commit `aea748a`.
- Post-completion input-routing hotfix (typing vs gameplay shortcut conflicts) completed in commit `c51c149`.
- Post-completion dungeon reload/auth-start visibility fix completed in commit `4496bc9`.
- Post-completion welcome/auth UX and GitHub Pages OAuth exchange updates landed across commits `6992c24` and `e70dbd9`.
- Post-completion mobile touch controls landed in commit `9e8da9f`, with follow-up CI/build fixes in `2343fc1` and `0634de2`, and final mobile/render + README screenshot updates in `c49a90c`.
- Post-completion OAuth removal landed in an earlier commit on `main`; the app is now public-repos-only with a persistent `localStorage` cache keyed by username.
- Post-completion GitHub REST optimization layer (ETag/304 revalidation, summary reuse, lazy README/contributors, rate-limit HUD, graceful degradation) landed in this PR. Cold-cache cost per room: **5 → 2** calls. Returning visits with unchanged data: **0 quota**.
- Full-project validation currently passes (lint, typecheck, tests, build:web).
