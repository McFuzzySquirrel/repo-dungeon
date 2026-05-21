# Feature: Local Repository Dungeon Generation

## 1. Feature Overview

**Feature Name:** Local Repository Dungeon Generation  
**Parent Document:** [docs/PRD.md](../PRD.md)
**Status:** Complete (Shipped)  
**Summary:** Add a second dungeon-generation source that allows users to generate and explore dungeons from Git repositories stored on their local machine, while preserving the existing GitHub username flow unchanged. Local mode must only be available in Electron or trusted locally hosted web builds, never from remotely hosted deployments.  
**Scope:** Introduce a local-repository source picker, trusted-environment gating, parent-folder selection, recursive Git repo discovery, git/filesystem-derived room metadata, subdirectory-based basement exploration, source-aware persistence, and local launch actions for editors. Explicitly excluded: nested Git repositories as gameplay content, remote hosted local-folder access, URL sharing for local dungeons, and any change to the existing GitHub username experience beyond additive source selection.  
**Dependencies:** Completed Phases 1-6 from [docs/PRD.md](../PRD.md); existing Phaser dungeon generation, React onboarding/room UI, Electron preload/main-process bridge, public-GitHub repo loading, and persistence/cache systems.

---

## 2. Context: Existing System State

**Completed PRD Phases:**  
- Phase 1: Foundation complete  
- Phase 2: Dungeon Generation complete  
- Phase 3: Room Content complete  
- Phase 4: Progression System complete  
- Phase 5: Polish & Biomes complete  
- Phase 6: Desktop & Release hardening complete  
- Post-completion updates shipped: OAuth removal, public-repos-only GitHub flow, persistent local cache, rate-limit optimization, HUD polish, mobile touch support, and release packaging hardening

**Relevant Existing Components:**  
- `src/ui/components/WelcomeScreen.tsx` for source-entry UX  
- `src/ui/AppShell.tsx` for startup flow, share-url restore, and overlay gating  
- `src/ui/hooks/useGitHubData.ts` and `src/github/api.ts` for current repo acquisition patterns  
- `src/github/types.ts` for repo-shaped domain types currently consumed by dungeon generation and room UI  
- `src/game/systems/DungeonGenerator.ts` and `src/game/scenes/DungeonScene.ts` for deterministic room generation and traversal  
- `src/ui/components/RoomInfoPanel.tsx` for repo detail presentation  
- `src/store/persistence.ts`, `src/store/sessionStore.ts`, and `src/store/dungeonStore.ts` for source identity and persistence assumptions  
- `src/ui/systems/shareUrl.ts` for current GitHub-source URL sharing rules  
- `src/electron/main.ts`, `src/electron/preload.ts`, and `src/electron/secureStorage.ts` for secure desktop bridge patterns

**Existing Agents Involved:**  
- `project-architect`  
- `ui-experience-engineer`  
- `dungeon-generation-engineer`  
- `phaser-gameplay-engineer`  
- `release-infra-engineer`  
- `qa-test-engineer`
- `local-repo-platform-engineer`

**Established Conventions:**  
- The shipped product is client-side only; no backend should be introduced for this feature.  
- React owns onboarding, overlays, and accessible information panels; Phaser owns traversal and world interaction.  
- Electron renderer remains sandboxed with `contextIsolation: true` and must access privileged capabilities only through preload-exposed IPC.  
- Current shipped behavior is public-GitHub-by-username only; OAuth is removed and must not be reintroduced.  
- Caching and persistence are deterministic and keyed to a source identity; local mode must extend those patterns rather than bypass them.  
- Hosted web builds already share code with Electron and local dev; local-folder access must be explicitly gated by runtime environment rather than assumed safe.

---

## 3. Feature Goals and Non-Goals

### 3.1 Goals
- Let a user choose a single parent folder and generate a dungeon from Git repositories discovered recursively beneath it.
- Preserve the existing GitHub username flow as-is, adding local repos as a parallel source option rather than a replacement flow.
- Expose meaningful local-room metadata using Git and filesystem signals when GitHub stats are unavailable.
- Introduce basement exploration based on ordinary subdirectories inside a repository, with noisy/generated folders excluded by default.
- Ensure local-folder access is impossible from remotely hosted builds and only available from Electron or trusted local web origins.
- Allow players to open local repos or basement paths in their editor or default system app from room actions.

### 3.2 Non-Goals
- Reintroducing GitHub OAuth or any authenticated GitHub flow.
- Allowing local repo access from any remote hosted deployment.
- Supporting nested Git repositories as separate basement content in this feature.
- Making local-source dungeons shareable through URL parameters.
- Replacing the current GitHub room model everywhere with a single undifferentiated view if source-specific presentation is clearer.
- Adding cloud sync, cross-device restoration, or remote indexing of local repository metadata.

---

## 4. User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| FT-US-01 | Tinkerer | pick a parent folder on my machine and generate a dungeon from the repos inside it | I can explore my local work without publishing it to GitHub | Must |
| FT-US-02 | Tinkerer | use local repo mode only in trusted local environments | my machine's files are never exposed through a hosted site | Must |
| FT-US-03 | Explorer | see git-derived stats and file-structure details for a local repo room | the room still feels informative without GitHub stars/forks | Must |
| FT-US-04 | Completionist | descend into basement areas representing repo subdirectories | I can explore a repo's internal structure as part of gameplay | Should |
| FT-US-05 | Tinkerer | open a local repo or selected path in my preferred editor or default system app | I can jump from discovery into real work quickly | Must |
| FT-US-06 | Returning Player | have my selected folder and local dungeon cache restored on the same machine | I do not have to rebuild the same local dungeon every session | Should |

---

## 5. Technical Approach

### 5.1 Impact on Existing Architecture
The current acquisition flow is shaped around `GitHub username -> GitHubRepoSummary[]`. This feature requires a source-aware acquisition layer so dungeon generation can consume either GitHub-backed or local-backed repository summaries without changing the existing GitHub behavior. The onboarding UI must grow from a single username entry to a source picker with additive local mode. Persistence keys, dungeon identity, and room-detail caches must become source-aware rather than username-only. `RoomInfoPanel` must support source-specific data presentation, and gameplay needs a basement-navigation contract for subdirectory exploration inside a local repo. Electron requires new secure IPC for folder selection, repo scanning, git metadata extraction, and editor launching. Local web builds require a browser-side path using the File System Access API, but only on trusted local origins.

### 5.2 New Components
- `src/repository/types.ts` — shared source-agnostic repository and source identity models
- `src/repository/source.ts` — source contracts for GitHub and local acquisition paths
- `src/localRepos/types.ts` — local repo metadata, basement nodes, scan progress, and launch config types
- `src/localRepos/browserAccess.ts` — trusted-local-origin browser access wrapper using File System Access API
- `src/localRepos/electronAccess.ts` — renderer-facing wrapper around preload APIs
- `src/localRepos/scan.ts` — recursive folder scan and Git repo detection orchestration
- `src/localRepos/metadata.ts` — filesystem-derived metadata extraction and ignored-folder filtering
- `src/localRepos/git.ts` — git CLI probing and normalization for branches, remotes, authors, and history-derived stats
- `src/localRepos/cache.ts` — local source caching and restoration helpers
- `src/ui/components/WelcomeScreen.tsx` (source-aware extension) — parent-folder selection UI and trusted-environment messaging
- `src/ui/components/RoomInfoPanel.tsx` (source-aware extension) — local room details and local launch actions
- `src/ui/components/BasementExplorer.tsx` — subdirectory exploration surface for local rooms
- `src/ui/hooks/useRepositorySource.ts` — source-aware onboarding and repo acquisition hook
- `src/electron/localRepos.ts` — Electron main-process handlers for scan, metadata, and launch actions
- `src/store/sessionStore.ts` and `src/ui/hooks/useRepositorySource.ts` — source selection and local scan/progress state wiring

### 5.3 Technology Additions
- **Browser File System Access API** — native browser capability for folder picking and directory traversal in trusted local web environments only. No package dependency required; availability must be feature-detected and explicitly gated to local origins.
- **Electron main/preload IPC extensions** — use existing Electron runtime capabilities (`dialog`, `shell`, sandboxed IPC, Node `fs`/`path`) rather than adding a new Electron dependency.
- **Local `git` CLI integration** — use the installed Git executable when present to derive commit history, contributors, remotes, branches, and working-tree status. This is an environment dependency rather than an npm package and must degrade gracefully when unavailable.

No new npm libraries are required for the initial implementation. If a later iteration needs cross-platform git parsing or richer browser polyfills, that should be evaluated separately.

---

## 6. Functional Requirements

| ID | Requirement | Affects Existing | Priority |
|----|-------------|-----------------|----------|
| FT-FR-01 | The welcome flow must offer local repository generation as a second source option while preserving the current GitHub username flow unchanged. | Yes (`src/ui/components/WelcomeScreen.tsx`, `src/ui/AppShell.tsx`) | Must |
| FT-FR-02 | The app must allow local repo mode only in Electron or trusted local web origins such as `localhost`, and must not allow it on remote hosted origins. | Yes (`src/ui/components/WelcomeScreen.tsx`, runtime boot/gating) | Must |
| FT-FR-03 | Hosted builds that cannot access local repos must show the local option in a disabled state with an explanation of why it is unavailable. | Yes (`src/ui/components/WelcomeScreen.tsx`) | Must |
| FT-FR-04 | Local mode must let the user pick a single parent folder as the root for repo discovery. | Yes (`src/ui/components/WelcomeScreen.tsx`) | Must |
| FT-FR-05 | Local repo discovery must recurse through nested folders under the selected parent and include only actual Git repositories as top-level dungeon rooms. | Yes (new local scan pipeline; dungeon input layer) | Must |
| FT-FR-06 | Local repo discovery must ignore common generated/noisy folders such as `.git`, `node_modules`, `dist`, `build`, `.next`, and `coverage` during scanning and basement generation. | Yes (new local scan and basement logic) | Must |
| FT-FR-07 | The app must normalize local repositories into a source-aware domain model consumable by existing dungeon generation without breaking GitHub-source generation. | Yes (`src/github/types.ts`, generator inputs, room data contracts) | Must |
| FT-FR-08 | The selected local source and its cached metadata must persist across sessions on the same machine and restore when permissions/runtime capabilities still allow access. | Yes (`src/store/persistence.ts`, new local cache/store) | Should |
| FT-FR-09 | Local room details must present git-derived and filesystem-derived stats, including commit/activity signals, branch/remotes info, language or file-type breakdown, file tree cues, and README/license/project-file presence when available. | Yes (`src/ui/components/RoomInfoPanel.tsx` or split panel) | Must |
| FT-FR-10 | Local room details must degrade gracefully when the local `git` CLI is unavailable, still showing filesystem-derived metadata and a clear unavailable-state message for git-specific stats. | Yes (new metadata pipeline and room UI) | Must |
| FT-FR-11 | Local rooms must support basement exploration based on ordinary subdirectories inside the repository, with ignored folders excluded by default. | Yes (`src/game/scenes/DungeonScene.ts`, room UI/gameplay integration) | Should |
| FT-FR-12 | Basement exploration must not treat nested Git repositories as a supported gameplay construct in this feature. | Yes (new local scan and basement logic) | Must |
| FT-FR-13 | Local room actions must allow the player to open the current repo or selected basement path using the system default app and optionally a configured preferred editor command. | Yes (room actions, Electron/browser integration) | Must |
| FT-FR-14 | URL sharing must remain limited to GitHub-source dungeons; local dungeons must not serialize filesystem references into share URLs. | Yes (`src/ui/systems/shareUrl.ts`, share UI) | Must |
| FT-FR-15 | Local repo access must remain local-only: scanned metadata, folder paths, and launch targets must not be transmitted to a remote service by this feature. | Yes (cross-cutting platform and UI behavior) | Must |
| FT-FR-16 | The app must surface scan progress, errors, and permission-denied states clearly during local repo discovery. | Yes (new source hook and onboarding UI) | Should |
| FT-FR-17 | The Electron build must expose local repo scanning and launch actions through explicit preload APIs rather than granting direct Node access to the renderer. | Yes (`src/electron/main.ts`, `src/electron/preload.ts`) | Must |

---

## 7. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FT-NF-01 | Local-folder access must be explicitly gated by runtime and origin so remote hosted builds can never browse arbitrary local directories. | Must |
| FT-NF-02 | The renderer must remain sandboxed; privileged filesystem and process-launch operations must execute only through reviewed Electron IPC or browser permission-gated APIs. | Must |
| FT-NF-03 | Repo scanning must keep the UI responsive and provide progress feedback for large parent folders rather than blocking the main thread. | Must |
| FT-NF-04 | The feature must degrade gracefully when browser APIs, filesystem permissions, or the local `git` CLI are unavailable. | Must |
| FT-NF-05 | Cached local metadata must remain machine-local and must not expose absolute filesystem paths in share URLs, analytics payloads, or remote requests. | Must |
| FT-NF-06 | Basement traversal and local room data rendering should feel near-instant after cache warm-up for previously scanned repos on the same machine. | Should |
| FT-NF-07 | Onboarding, disabled states, permission prompts, and local-room panels must remain accessible via keyboard and screen readers. | Must |

---

## 8. Agent Impact Assessment

### 8.1 Existing Agents — Extended Responsibilities

| Agent | New Responsibilities | Modified Boundaries |
|-------|---------------------|-------------------|
| `project-architect` | Define shared source-aware repository contracts, source identity models, and persistence boundaries that let GitHub and local modes coexist cleanly. | Expands from GitHub-shaped shared types to multi-source domain modeling and store/persistence partitioning. |
| `ui-experience-engineer` | Add source selection UX, trusted-environment messaging, local scan/progress states, disabled hosted-build messaging, and source-specific room/basement panels. | Expands from GitHub-only onboarding and room details to source-aware onboarding and local-room presentation. |
| `dungeon-generation-engineer` | Integrate source-aware repo summaries and define how basement/subdirectory metadata maps into dungeon or intra-room exploration structures. | Extends from repo-room topology to include local subdirectory exploration hooks without changing GitHub layout behavior. |
| `phaser-gameplay-engineer` | Wire basement entry/exit traversal and interactions between Phaser room movement and local subdirectory exploration states. | Expands traversal ownership to include basement transitions for local rooms. |
| `release-infra-engineer` | Harden Electron IPC, editor-launch behavior, local build gating, and trusted-origin packaging/documentation expectations. | Expands from packaging and release hardening to local-access runtime governance and platform launch integration. |
| `qa-test-engineer` | Add coverage for trusted-origin gating, local scan flows, git CLI degradation, basement exploration, and editor-launch behavior. | Expands from GitHub/public-flow validation to mixed-source/local-platform verification. |

### 8.2 New Agents Required

| Agent | Role | Why Existing Agents Can't Cover This |
|-------|------|--------------------------------------|
| `local-repo-platform-engineer` | Own local filesystem access, browser File System Access integration, Electron scan IPC, git CLI normalization, local metadata caching, and editor-launch plumbing. | Existing agents split this surface awkwardly: `github-platform-engineer` is explicitly scoped to GitHub/Octokit/auth concerns, while `release-infra-engineer` owns packaging rather than repository scanning/data extraction. The local source introduces a distinct platform/data-ingestion domain that should not overload either existing boundary. |

### 8.3 Existing Agents — No Changes

| Agent | Reason |
|-------|--------|
| `github-platform-engineer` | GitHub username mode remains unchanged; this feature adds a parallel local source rather than altering GitHub API behavior. |
| `progression-rewards-engineer` | XP, loot, badges, and player progression rules can consume source-agnostic room events without feature-specific rule changes in the first increment. |
| `world-content-engineer` | Biome dressing and room-content flavor can remain source-agnostic for this feature; local mode reuses existing presentation conventions. |
| `project-orchestrator` | Coordination responsibility remains unchanged and does not require a feature-specific boundary change. |

---

## 9. Implementation Phases

### Phase F1: Source Model and Security Gating
- [x] Define source-aware repository/domain types that separate GitHub-specific and local-specific metadata cleanly.
- [x] Add runtime/origin detection so local repo mode is enabled only in Electron and trusted local web environments.
- [x] Update onboarding state to support additive source selection without regressing GitHub username flow.
- [x] Define source-aware persistence keys and restoration rules.

### Phase F2: Local Acquisition Pipeline
- [x] Implement parent-folder selection for Electron and trusted local web builds.
- [x] Implement recursive scan for Git repositories under the selected parent folder.
- [x] Add ignored-folder filtering and scan-progress reporting.
- [x] Integrate optional `git` CLI metadata extraction with graceful fallback when unavailable.
- [x] Persist local source selection and scan cache on the same machine.

### Phase F3: Room Details and Basement Exploration
- [x] Extend room data loading and presentation to support local repo stats and local-specific actions.
- [x] Add basement exploration for ordinary subdirectories inside a repo.
- [x] Exclude noisy/generated folders from basement traversal by default.
- [x] Ensure local rooms can open the repo or selected path in the system default app or preferred editor command.

### Phase F4: Validation and Rollout Hardening
- [x] Add test coverage for hosted-build disabled states, local-origin gating, and Electron IPC boundaries.
- [x] Add integration coverage for recursive scanning, cache restore, git CLI fallback, and basement interactions.
- [x] Update player-facing docs to explain where local mode works and why hosted builds disable it.
- [x] Verify no share URL or remote request path leaks local filesystem references.

#### F4 Player-Facing Messaging (Shipped)
- Local repository mode is available only in trusted runtimes: the packaged Electron app and local development origins (for example `localhost` or `127.0.0.1`).
- Remote hosted deployments keep local mode disabled to enforce a strict browser security and privacy boundary around local filesystem access.
- Share URLs continue to represent GitHub-source dungeons only. Local filesystem paths, folder handles, and basement paths are never serialized into share links.
- Local "Open" actions use platform-native behavior: opening in the system default app is supported broadly, while preferred-editor command behavior can vary by OS, shell quoting, and editor CLI availability.

---

## 10. Testing Strategy

How this feature will be tested:

| Level | Scope | Approach |
|-------|-------|----------|
| Unit Tests | Local scan filters, source normalization, git CLI parsing, origin gating helpers, persistence key generation | Vitest coverage over pure helpers with mocked filesystem/git outputs and environment flags |
| Integration Tests | Welcome flow source switching, local scan progress/errors, local room panel data, basement navigation, Electron preload/main IPC contracts | React Testing Library and Vitest mocks for trusted local browser APIs and Electron bridge methods |
| Regression Tests | Existing GitHub username loading, share URL behavior, room info panel behavior for GitHub source, release build gating | Re-run existing tests and add focused cases to confirm local mode remains additive and hosted deployments stay safe |

Key test scenarios:

1. Local repo option is visible but disabled with explanation on hosted origins.
2. Local repo option is enabled in Electron and on trusted local web origins.
3. Selecting a parent folder recursively finds Git repos and ignores common noisy directories.
4. Non-Git folders do not become dungeon rooms.
5. Missing `git` CLI still produces a usable local dungeon with reduced stats.
6. Local room panels show git/filesystem-derived metadata without rendering GitHub-only actions.
7. Basement exploration lists supported subdirectories and excludes ignored folders.
8. Launch actions open via system default or configured editor command without exposing direct renderer Node access.
9. Existing GitHub username generation and share URLs remain unchanged.
10. No local filesystem paths appear in share URLs or remote hosted contexts.

---

## 11. Rollback Considerations

What happens if this feature needs to be reverted:
- Modified existing files will likely include onboarding, room-info, persistence, and Electron preload/main surfaces. These changes can be reverted to restore the current GitHub-only flow.
- New local-source files under `src/localRepos/`, `src/repository/`, and related UI/store modules can be removed entirely if the feature is backed out.
- No database migrations are expected; rollback mainly requires removing persisted local-source keys and cache entries from browser storage or Electron app data.
- Regression tests for GitHub username generation, share URLs, room info rendering, and hosted-build startup should verify the original behavior still works after rollback.

---

## 12. Acceptance Criteria

1. A player can generate a dungeon from a selected parent folder containing local Git repos without changing the existing GitHub username flow.
2. Local repo mode is available only in Electron and trusted local web builds, and is unavailable on remote hosted builds.
3. Hosted builds show the local mode option disabled with a clear explanation.
4. Recursive scanning discovers Git repositories under the selected parent folder and excludes common noisy/generated folders.
5. Local repo rooms display useful git/filesystem-derived metadata, and degrade gracefully when `git` is unavailable.
6. Local repo rooms support opening the repo or a selected path in the system default app and optionally a configured preferred editor command.
7. Basement exploration lets players traverse ordinary subdirectories within a repo while excluding ignored folders.
8. Selected local source and local cache can be restored across sessions on the same machine when permissions remain valid.
9. No local filesystem paths are exposed through share URLs or hosted web builds.
10. Existing GitHub-source dungeon generation, caching, room details, and sharing continue to behave as they do today.

---

## 13. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | How should the preferred editor command be configured in the UI and persisted across platforms? | Provide a simple optional setting for an override command; fall back to system default opener when unset or invalid. |
| 2 | How aggressively should browser-side cache restoration rely on previously granted File System Access handles versus asking the user to re-confirm access? | Attempt restoration when a handle is available and valid; fall back to a re-pick flow when permission is missing or stale. |
| 3 | Should the ignored-folder list remain fixed for the first release or become user-configurable later? | Ship with a fixed curated ignore list in v1 of the feature and evaluate configurability in a later increment. |