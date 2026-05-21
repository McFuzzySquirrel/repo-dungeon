# Agent Responsibility Matrix

Validation target: `docs/PRD.md` Section 8 (FR-01 to FR-43).

## Validation Result

- Every functional requirement (FR-01 through FR-43) has exactly one **primary owner**.
- No ownership gaps were found.
- No conflicting primary ownership assignments were found.

## Responsibility Matrix

| PRD Requirement(s) | Primary Owner Agent | Responsibility Scope |
|---|---|---|
| FR-01, FR-02, FR-03, FR-04, FR-05, FR-15, FR-17 | `github-platform-engineer` | GitHub auth, token handling, Octokit data loading, pagination/rate-limit behavior, room data retrieval |
| FR-06, FR-18, FR-19, FR-20, FR-25, FR-37, FR-38, FR-39, FR-40, FR-41, FR-42, FR-43 | `ui-experience-engineer` | Onboarding/UI overlays, room info panel UX, HUD/minimap/full-map rendering, sharing UX |
| FR-07, FR-08, FR-10, FR-11, FR-12, FR-14, FR-16 | `dungeon-generation-engineer` | BSP dungeon generation, zone grouping, room/corridor topology, profile room placement, deterministic seeding, generation performance |
| FR-09, FR-23, FR-24, FR-28 | `world-content-engineer` | Biome presentation, room prop dressing, contributor NPC behavior, pixel-art avatar/animation asset integration |
| FR-13 | `project-architect` | Client-side-only architecture boundary and foundational app structure decisions |
| FR-21, FR-22, FR-26, FR-27, FR-31, FR-32, FR-33, FR-34, FR-35, FR-36 | `progression-rewards-engineer` | Class system, visited-state persistence/stamps, XP/leveling, loot, inventory, badges, progression rules |
| FR-29, FR-30 | `phaser-gameplay-engineer` | Core player movement and input handling (keyboard/gamepad/touch controls) |

## Notes on Boundary Clarity

- UX rendering responsibilities are centralized under `ui-experience-engineer`; underlying progression state remains under `progression-rewards-engineer`.
- Dungeon topology and generation logic are centralized under `dungeon-generation-engineer`; biome art/content expression remains under `world-content-engineer`.
- GitHub data access and auth are centralized under `github-platform-engineer`; gameplay and UI consumers integrate that data without owning platform concerns.

## Feature Increment Matrix (Local Repositories)

Validation target: `docs/features/FT-local-repo-dungeons.md` (FT-FR-01 through FT-FR-17).

| Feature Requirement(s) | Primary Owner Agent | Responsibility Scope |
|---|---|---|
| FT-FR-01, FT-FR-02, FT-FR-03, FT-FR-04, FT-FR-08, FT-FR-16 | `ui-experience-engineer` | Source selection UX, hosted/trusted runtime messaging, local scan progress/error states, local room details/basement UI integration |
| FT-FR-05, FT-FR-06, FT-FR-10, FT-FR-12, FT-FR-13, FT-FR-15, FT-FR-17 | `local-repo-platform-engineer` | Local filesystem access wrappers, recursive discovery, ignore filtering, git fallback handling, secure preload/main IPC, local open-path actions |
| FT-FR-07, FT-FR-08, FT-FR-14 | `project-architect` | Source-aware domain/persistence contracts and share-url safety boundaries across sources |
| FT-FR-11, FT-FR-12 | `phaser-gameplay-engineer` | Basement traversal and in-scene exploration handoffs for local repository rooms |
| FT-FR-09, FT-FR-11, FT-FR-13 | `dungeon-generation-engineer` | Local repo room modeling and basement metadata mapping into dungeon/exploration structures |
| FT-FR-02, FT-FR-03, FT-FR-15, FT-FR-17 | `release-infra-engineer` | Hosted-build constraints, runtime packaging constraints, and secure rollout guardrails |
| FT-FR-01 through FT-FR-17 (verification) | `qa-test-engineer` | Feature-level unit/integration/regression coverage and rollout hardening validation |
