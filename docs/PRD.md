# Repo Dungeon

## 1. Overview

**Product Name:** Repo Dungeon
**Summary:** Repo Dungeon is a 2D dungeon crawler where every room is a GitHub repository. Players navigate a procedurally generated dungeon built from their own (or any public user's) GitHub profile, discovering repo contents as they explore rooms. The game transforms the passive act of browsing a GitHub profile into an engaging, rewarding adventure — surfacing forgotten projects, showcasing skills, and compelling players to visit repos they'd never have found otherwise. The visual style is clean and modern, using SVG/vector assets for all gameplay and UI elements to ensure a cohesive, accessible experience.
**Target Platform:** Web browser (desktop + mobile) and desktop app (Electron wrapper). Primary development target is the web build; Electron packaging is a secondary deliverable.
**Key Constraints:**
- GitHub source uses public-repos-only data loading via unauthenticated GitHub REST (60 req/hr/IP budget). Local repository source is supported only in trusted local runtimes (see `docs/features/FT-local-repo-dungeons.md`).
- Solo developer project assisted by GitHub Copilot agents
- Clean SVG/vector visual style throughout (pixel art assets deprecated)
- No real-time multiplayer in v1

---

## 2. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-19 | @McFuzzySquirrel | Initial PRD |
| 1.1 | 2026-05-20 | GitHub Copilot | Align documentation with shipped web/Electron OAuth exchange flow, welcome-screen auth UX, and mobile touch controls |
| 1.2 | 2026-05-20 | GitHub Copilot | **Post-MVP architectural pivot:** removed GitHub OAuth flow entirely; the app now loads public repositories only by GitHub username, with a persistent `localStorage` cache (24 h repo lists / 7 d room details). Added a GitHub REST optimization layer — ETag/`If-None-Match` revalidation (free `304 Not Modified` on unchanged data), repo-summary reuse from the list call, lazy README/contributors fetching tied to tab activation, rate-limit-aware degradation, and an in-HUD `N/60 · resets in Xm` budget counter. See [`docs/optimization-research.md`](./optimization-research.md) for the authoritative description of the current GitHub data flow. Earlier OAuth-flavoured requirements in §5.2, §7, §8.1, §10, §15, §17, and §18 are retained for historical context but **are no longer in effect**. |
| 1.3 | 2026-05-20 | GitHub Copilot | **Post-MVP UX/presentation refresh:** corridor rendering now uses dedicated pathway sprites trimmed to room entrances, room zoom adapts more aggressively for exploration, player and NPC visuals use class/variant SVG placeholders, the class picker is a one-card left/right carousel, and progression UI now lives in a vertical left-rail HUD with separate inventory and badge buttons. |
| 1.4 | 2026-05-20 | GitHub Copilot | **Visual style update:** All gameplay and UI assets now use clean SVG/vector art for a unified, modern look. Pixel art assets are deprecated. |
| 1.5 | 2026-05-21 | GitHub Copilot | **Feature increment shipped:** local repository dungeon generation delivered in `docs/features/FT-local-repo-dungeons.md` (trusted-runtime gating, local scan/cache pipeline, source-aware room details, basement exploration, secure local open actions, and rollout hardening). |

---

## 3. Goals and Non-Goals

### 3.1 Goals
- Enable a player to enter any GitHub username and have a playable dungeon generated from that user's repositories in under 10 seconds
- Surface at least 3 repositories per play session that the player acknowledges discovering for the first time (measured by "I didn't know this existed" badge trigger)
- Create enough gameplay depth (classes, loot, XP, puzzles) that players return to re-explore their dungeon as their repos change
- Ship a web-playable build playable without installation, plus an Electron desktop build
- Demonstrate GitHub Copilot agent-assisted solo development as a reference workflow

### 3.2 Non-Goals
- Real-time or async multiplayer (v1)
- Modifying or writing back to GitHub repos in any way
- Mobile-native apps (iOS/Android) — responsive web on mobile is acceptable but not a first-class target
- Supporting GitLab, Bitbucket, or other source hosts
- A general-purpose dungeon roguelike unrelated to GitHub data
- Leaderboards or public high-score sharing (v1)

---

## 4. User Stories / Personas

### 4.1 Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| The Tinkerer | A developer with 50+ repos, many half-finished, wants to rediscover old projects | Find forgotten repos, feel nostalgic, be motivated to revisit old code |
| The Showcase Builder | A developer building a portfolio, wants an impressive way to share their GitHub with others | Shareable dungeon link, repos presented attractively with key stats |
| The Explorer | Wants to learn about another developer's work without reading a raw GitHub profile page | Fun discovery mechanic, clear repo info, easy path to GitHub |
| The Completionist | Wants to explore every room and collect all badges/loot | Full dungeon map, persistent progress, "visited" stamps, completionist badges |

### 4.2 User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-01 | Tinkerer | Enter my GitHub username and have a dungeon generated from my repos | I can explore my own projects in a new way | Must |
| US-02 | Tinkerer | ~~Authenticate with GitHub OAuth~~ *(removed in v1.2)* | ~~My private repos are included in the dungeon~~ | Removed |
| US-03 | Explorer | Enter any public GitHub username | I can explore someone else's repos | Must |
| US-04 | Explorer | Read a room's information panel | I can learn about the repo without leaving the game | Must |
| US-05 | Explorer | Click a link to visit the repo on GitHub | I can explore the real repo when interested | Must |
| US-06 | Completionist | See a dungeon map showing visited and unvisited rooms | I know my progress and what remains | Must |
| US-07 | Completionist | Earn XP and loot for each room I fully explore | I feel rewarded for thorough exploration | Must |
| US-08 | Completionist | Collect a "visited" stamp for each room | I can track which repos I've been to | Must |
| US-09 | Showcase Builder | Share a link to my dungeon | Others can explore my repos | Should |
| US-10 | Tinkerer | Choose a character class at game start | My playstyle feels personal | Should |
| US-11 | Completionist | Earn themed loot items based on repo properties | The rewards feel connected to the repos | Should |
| US-12 | Completionist | Earn discovery badges for milestones | Exploration is rewarded with recognition | Should |
| US-13 | Explorer | See repos grouped into themed dungeon zones by language/topic | Navigation feels logical and the dungeon has variety | Should |
| US-14 | Tinkerer | See my dungeon refresh when I gain new repos | The dungeon stays current with my GitHub activity | Could |
| US-15 | Explorer | Encounter puzzles or challenges inside repo-rooms | Exploration has light interactive depth | Could |

---

## 5. Research Findings

### 5.1 Technology Selection

The following options were evaluated against the project's requirements (2D game rendering, web + desktop, solo dev, trusted-local runtime support):

| Framework | Browser | Desktop | Pixel Art Support | Solo Dev Ergonomics | Notes |
|-----------|---------|---------|-------------------|---------------------|-------|
| **Phaser.js 3** | ✅ Native | ✅ Electron wrapper | ✅ Excellent (tilemaps, spritesheets) | ✅ High — large community, Copilot-friendly JS/TS | **Recommended** |
| Godot 4 (Web export) | ✅ Web export | ✅ Native | ✅ Excellent | ⚠️ GDScript is less Copilot-optimized; web export has quirks | Strong alternative, higher friction for web |
| Unity (WebGL export) | ✅ WebGL | ✅ Native | ✅ Good | ⚠️ WebGL builds are large; C# less fluid for solo web dev | Enterprise-grade overkill for this scope |
| React + Canvas (vanilla) | ✅ Native | ✅ Electron | ⚠️ Requires building game systems from scratch | ⚠️ High — no built-in game loop, physics, tilemap | Suitable for simple UI-heavy games, not a full dungeon crawler |
| Vanilla JS + Canvas | ✅ Native | ✅ Electron | ⚠️ Same as above | ⚠️ High friction | Not recommended for this scope |

**Recommendation: Phaser.js 3 + TypeScript + React (for menus/UI overlays) + Electron (for desktop)**

Rationale:
- Phaser 3 has mature tilemap support (Tiled editor integration), sprite animation, scene management, and input handling — all necessary for a 2D dungeon crawler
- TypeScript improves Copilot agent code generation quality significantly
- React handles the non-game UI (login screen, username input, room info panel, inventory) without fighting the Phaser canvas
- Electron provides desktop packaging with minimal additional code
- The combined stack is the most GitHub Copilot-friendly combination for a solo developer

### 5.2 GitHub API

| Concern | Detail |
|---------|--------|
| Auth | No authentication in the current shipped flow; public repositories are loaded by username only |
| Rate limits | Unauthenticated public REST budget: 60 req/hr/IP |
| Repo data | REST API: `GET /users/{username}/repos` (public) |
| README | `GET /repos/{owner}/{repo}/readme` — returns base64-encoded content |
| File tree | `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` |
| Languages | `GET /repos/{owner}/{repo}/languages` |
| Contributors | `GET /repos/{owner}/{repo}/contributors` |
| Topics | Included in repo object (`topics` field) |
| Token storage | Not used in the current public-repos-only flow |

### 5.3 Current Technology Versions (as of May 2026)

        │           ├──▶ [Interact with Room Objects / NPCs] ──▶ [XP / Loot / Badge] │
|------------|--------------------|----|
| Phaser.js | 3.87.x | Stable; v4 is in early development, not production-ready |
| React | 19.x | Stable; concurrent features available |
| TypeScript | 5.x | Stable |
| Electron | 42.x | Stable; use `contextIsolation: true`, `nodeIntegration: false` |
| Vite | 8.x | Build tool; excellent Phaser + React integration |
| Tiled Map Editor | 1.11.x | Free tilemap editor for dungeon room templates |

### 5.4 Dungeon Generation Approach

Procedural dungeon generation will use a zone-partitioned BSP (Binary Space Partitioning) approach:
- Repos are grouped into zones by primary language or topic tag
- Each zone is a dungeon "biome" with a distinct visual theme (e.g., JavaScript = neon city ruins, Python = ancient library, Rust = iron forge)
- Within a zone, rooms are connected by corridors; rooms represent individual repos
- The player starts in a "hub" room representing the user's profile (avatar, bio, total stars, follower count)

---

## 6. Concept

### 6.1 Core Loop

```
1. ENTER — Player types a GitHub username or selects a local repository folder (trusted local runtimes only)
         ↓
2. GENERATE — GitHub API fetches all repos; dungeon is procedurally generated
              Repos → grouped by language/topic → zones → rooms + corridors
         ↓
3. EXPLORE — Player navigates dungeon rooms with keyboard/gamepad/touch
             Moving into a new room triggers a GitHub API fetch for that repo's details
         ↓
4. DISCOVER — Room info panel appears: README excerpt, language bar, stars/forks,
              topics, file tree highlights, top contributors
              Player can click "Visit on GitHub" to open the repo in a new tab
         ↓
5. REWARD — Player earns XP + repo-themed loot for fully reading a room
            "Visited" stamp applied to room on the dungeon map
         ↓
6. PROGRESS — Player levels up, collects badges, completes zones
              All explored rooms persist in session (localStorage)
         ↓
7. SHARE (optional) — Player copies a shareable URL to their dungeon
         ↓
    LOOP back to 3 until all rooms visited or player exits
```

### 6.2 Success / Completion Criteria

From the player's perspective, success means:
- The dungeon is generated and navigable within 10 seconds of entering a username
- At least one room surface something the player marks as "new discovery" (triggers "Archaeologist" badge after 3 such rooms)
- The player exits via "Visit on GitHub" at least once per session
- The full dungeon map is completable in a single session for profiles with ≤ 50 repos

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Component | Technology | Version | Role |
|-----------|-----------|---------|------|
| Game Engine | Phaser.js | 3.87.x | 2D rendering, tilemap, scene management, input |
| UI Layer | React | 19.x | Menus, overlays, info panels, HUD (outside canvas) |
| Language | TypeScript | 5.x | Type safety, improved Copilot suggestions |
| Build Tool | Vite | 8.x | Dev server, bundling, HMR |
| Desktop | Electron | 42.x | Wraps web build for macOS/Windows/Linux |
| Map Editor | Tiled | 1.11.x | Room template authoring |
| Asset Pipeline | TexturePacker / free-tex-packer | Latest | Sprite atlas generation |
| State Management | Zustand | 4.x | Lightweight global state for player, dungeon, session |
| HTTP Client | Octokit.js | 22.x | Typed GitHub REST API client |
| Testing | Vitest + React Testing Library | Latest | Unit + component tests |
| CI/CD | GitHub Actions | — | Build, test, and package desktop artifacts |
| Deployment (web, optional) | Static host (Netlify/Vercel/etc.) | — | Optional static web hosting |
| Deployment (desktop) | electron-builder | Latest | macOS/Windows/Linux installers |

### 7.2 Project Structure

```
repo-dungeon/
├── public/
│   └── assets/
│       ├── sprites/        # Player/NPC SVG variants, pathway pieces, props
│       ├── tilesets/       # Dungeon tileset placeholders / biome art
│       └── audio/          # SFX + ambient music
├── src/
│   ├── game/               # Phaser game scenes and systems
│   │   ├── scenes/
│   │   │   ├── BootScene.ts
│   │   │   ├── DungeonScene.ts       # Core dungeon navigation
│   │   ├── systems/
│   │   │   ├── DungeonGenerator.ts   # BSP + zone generation
│   │   │   ├── RoomLoader.ts         # Fetches repo data for a room
│   │   │   ├── LootGenerator.ts      # Reward generation
│   │   │   ├── ProgressionTracker.ts # XP / level progression
│   │   │   └── BadgeTracker.ts       # Badge milestones + unlocks
│   │   ├── entities/
│   │   │   ├── Player.ts
│   │   │   ├── RoomObject.ts         # Interactable in-room objects
│   │   │   └── NPCContributor.ts     # Contributor NPCs
│   │   └── config/
│   │       ├── biomes.ts             # Language → biome mapping
│   │       ├── classes.ts            # Player class definitions
│   │       ├── pathwayPresentation.ts
│   │       └── characterSprites.ts
│   ├── ui/                 # React components (outside canvas)
│   │   ├── components/
│   │   │   ├── WelcomeScreen.tsx
│   │   │   ├── RoomInfoPanel.tsx     # README, stats, file tree
│   │   │   ├── Minimap.tsx
│   │   │   ├── FullMapOverlay.tsx
│   │   │   ├── InventoryPanel.tsx
│   │   │   ├── BadgePanel.tsx
│   │   │   ├── CharacterSelect.tsx
│   │   │   └── XpHud.tsx             # XP bar, badges, level
│   │   └── hooks/
│   │       └── useGitHubData.ts
│   ├── github/             # GitHub API integration
│   │   ├── api.ts           # REST wrapper + caching
│   │   └── types.ts         # Typed repo/user models
│   ├── store/              # Zustand stores
│   │   ├── playerStore.ts
│   │   ├── dungeonStore.ts
│   │   └── sessionStore.ts
│   ├── electron/           # Electron main process
│   │   └── main.ts
│   └── main.tsx            # React + Phaser bootstrap
├── maps/                   # Tiled .tmx room templates
├── tests/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release-desktop.yml
├── electron-builder.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### 7.3 Key APIs / Interfaces

| API / Interface | Purpose | Notes |
|----------------|---------|-------|
| `GitHub REST API v3` | All repo/user data | Via Octokit.js |
| `GET /users/{user}/repos` | List public repos | Paginated, max 100/page |
| `GET /repos/{owner}/{repo}/readme` | Fetch README content | Base64 encoded |
| `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` | File tree | May be truncated for huge repos |
| `GET /repos/{owner}/{repo}/languages` | Language byte counts | Used for language bar |
| `GET /repos/{owner}/{repo}/contributors` | Contributor list | Shown as NPCs in room |
| `DungeonGenerator.generate(repos[])` | Produces dungeon graph | Returns `DungeonMap` with zones, rooms, corridors |
| `RoomLoader.load(room)` | Fetches and caches repo data for a room | Lazy-loaded on room entry |
| `LootSystem.generateLoot(repo)` | Returns themed loot items | Deterministic based on repo properties |
| `ProgressTracker.visitRoom(roomId)` | Stamps room, awards XP/loot | Persisted to localStorage |

---

## 8. Functional Requirements

### 8.1 Source Selection & Onboarding

> **v1.2 update:** As of v1.2 the OAuth flow has been removed. FR-02, FR-03, and FR-04 below are retained for historical context but are no longer in effect. FR-05 has been superseded by the rate-limit-aware degradation + HUD counter described in v1.2 of the Version History.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Player can enter any GitHub username to generate a dungeon from public repos, without authentication | Must |
| FR-02 | ~~Player can authenticate via GitHub OAuth to include private repos and increase API rate limits~~ *(removed in v1.2)* | ~~Must~~ Removed |
| FR-03 | ~~OAuth token is stored in client-controlled browser storage (web) or Electron secure storage (desktop); browser builds may use a dedicated server-side/serverless token exchange endpoint, and secrets must never ship to the frontend bundle~~ *(removed in v1.2)* | ~~Must~~ Removed |
| FR-04 | ~~Player can log out, clearing the stored token~~ *(removed in v1.2)* | ~~Must~~ Removed |
| FR-05 | If unauthenticated and rate limit is hit, display a friendly prompt and degrade gracefully (HUD counter + stale-cache fallback) | Must |
| FR-06 | On first visit, a tutorial/intro sequence walks the player through the game concept | Should |
| FR-15 *(v1.2)* | The app displays the remaining hourly GitHub REST budget in the HUD and falls back to the persisted cache when a request fails with `kind: 'rate_limit'` | Must |
| FR-16 *(v1.2)* | All repo-list and room-detail requests must persist `ETag` headers and re-issue requests with `If-None-Match` after TTL expiry, treating `304 Not Modified` as a free cache hit | Must |
| FR-17 *(v1.2)* | README and contributors data must be lazy-loaded on first tab open rather than fetched as part of the initial room fan-out | Should |

### 8.2 Dungeon Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07 | The dungeon is generated procedurally from the user's repo list using a BSP algorithm | Must |
| FR-08 | Repos are grouped into zones by primary programming language; repos with no language are grouped by their first topic tag, or placed in a "Miscellaneous" zone | Must |
| FR-09 | Each zone has a distinct visual biome (tileset + color palette) reflecting its language/topic | Must |
| FR-10 | Each repo becomes exactly one room in the dungeon | Must |
| FR-11 | A hub "Profile Room" is placed at the dungeon entrance, showing user avatar, bio, total public repos, total stars, followers | Must |
| FR-12 | Corridors connect rooms within a zone; zones are connected by guarded "gateway" rooms | Must |
| FR-13 | The dungeon map is generated client-side for GitHub-source play, with local-source onboarding gated to trusted local runtimes (Electron or trusted local web origins) | Must |
| FR-14 | Dungeons with ≤ 100 repos generate in under 10 seconds on a standard connection | Must |
| FR-15 | If a user has > 100 repos, paginate API calls and show a loading progress bar | Should |
| FR-16 | A seed can be saved/shared so the same username always produces the same dungeon layout | Should |

### 8.3 Room Exploration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-17 | Entering a room triggers loading of that repo's details (README, languages, file tree, contributors) | Must |
| FR-18 | A Room Info Panel displays: repo name, description, primary language, star/fork counts, topics (as badges), README excerpt (first 500 chars), file tree (top-level files/folders), top 5 contributors (with avatars) | Must |
| FR-19 | The Room Info Panel includes a "Visit on GitHub" button that opens the repo URL in a new browser tab | Must |
| FR-20 | Room Info Panel can be dismissed; player can re-open it with a key shortcut (I or Tab) | Must |
| FR-21 | A "visited" stamp is visually applied to a room on the map after the player has opened and dismissed its info panel | Must |
| FR-22 | Rooms already visited in a prior session (same username) restore their visited state from localStorage | Should |
| FR-23 | Interactable objects in each room represent notable repo properties (e.g., a "README Scroll" object, a "Contributors' Gallery" object, a "File Tree Archive" chest) | Should |
| FR-24 | Contributor NPCs wander the room, and interacting with them shows the contributor's avatar, username, and contribution count | Should |
| FR-25 | Language breakdown is shown as a horizontal color-coded bar (matching GitHub's language colors) | Should |

### 8.4 Player & Classes

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-26 | Player selects a class before entering the dungeon; class affects starting stats and special abilities | Must |
| FR-27 | Classes available (v1): **Explorer** (balanced, +discovery XP), **Archivist** (reads faster, more loot from READMEs), **Hacker** (unlocks hidden files/topics, +XP from code-heavy repos), **Contributor** (bonus XP when a repo has multiple contributors) | Should |
| FR-28 | Player character is animated with pixel art walk cycles (4-direction) | Must |
| FR-29 | Player navigates with WASD or arrow keys; gamepad support optional | Must |
| FR-30 | On mobile/touch, a virtual D-pad and interaction affordance are shown during gameplay | Should |

### 8.5 Progression & Rewards

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-31 | Player earns XP for entering a new room, for opening the info panel, and for clicking "Visit on GitHub" | Must |
| FR-32 | XP thresholds trigger level-ups, shown with a pixel art animation | Must |
| FR-33 | Each repo-room drops themed loot based on repo properties (see Loot table below) | Must |
| FR-34 | Loot items are collected into an Inventory accessible via HUD | Must |
| FR-35 | Badges are awarded for milestones (see Badge table below) | Should |
| FR-36 | "Visited" stamps persist in localStorage per username | Must |

**Loot Theming Logic:**

| Repo Property | Loot Item |
|--------------|-----------|
| Primary language = JavaScript | "Golden Console" trinket |
| Primary language = Python | "Serpent Tome" |
| Primary language = Rust | "Iron Ingot" |
| Primary language = TypeScript | "Blueprint Scroll" |
| Has topics | "Tag Rune" (one per topic) |
| Stars ≥ 100 | "Star Fragment" |
| Stars ≥ 1000 | "Legendary Star Crystal" |
| Has contributors > 5 | "Guild Crest" |
| Has README | "Ancient Scroll" |
| Is a fork | "Mirror Shard" |
| Is archived | "Fossilized Code" |

**Badges:**

| Badge | Trigger |
|-------|---------|
| 🗺️ First Steps | Entered first room |
| 🔍 Archaeologist | Marked 3 rooms as "new discovery" |
| 📚 Lore Keeper | Read 10 full READMEs |
| ⭐ Star Gazer | Visited a repo with ≥ 1000 stars |
| 🧭 Zone Cleared | Visited all rooms in a zone |
| 🏰 Dungeon Master | Visited all rooms in the dungeon |
| 🔗 Portal Walker | Clicked "Visit on GitHub" 5 times |
| 👥 Guild Finder | Discovered a repo with > 10 contributors |
| 🕯️ Archivist | Explored an archived repo |

### 8.6 Dungeon Map

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-37 | A minimap is always visible in the HUD corner showing the current zone | Must |
| FR-38 | A full dungeon map overlay is toggled with M key | Must |
| FR-39 | Visited rooms are highlighted on the map; unvisited rooms are shown as unexplored | Must |
| FR-40 | The current room is marked with the player's icon | Must |
| FR-41 | Zone labels and biome colors are shown on the full map | Should |

### 8.7 Sharing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-42 | A shareable URL encodes the target GitHub username (e.g., `repodungeon.app?user=octocat`) so others can load the same dungeon | Should |
| FR-43 | Share button copies URL to clipboard with one click | Should |

---

## 9. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-01 | Dungeon generation completes in < 10 seconds for up to 100 repos on a 50 Mbps connection | Must |
| NF-02 | Room info panel loads within 2 seconds of room entry (with cached API responses) | Must |
| NF-03 | The web build is playable on Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ | Must |
| NF-04 | The Electron desktop build runs on macOS 13+, Windows 10+, Ubuntu 22.04+ | Should |
| NF-05 | GitHub API responses are cached in memory for the duration of a session to minimize requests | Must |
| NF-06 | The web build bundle size is < 5 MB (excluding game assets) | Should |
| NF-07 | Game runs at a stable 60 FPS on mid-range hardware (integrated GPU) | Should |
| NF-08 | Public-profile exploration works fully client-side; hosted builds must not expose local filesystem access | Must |
| NF-09 | Graceful degradation: if a GitHub API call fails, the room still loads with a "data unavailable" state | Must |

---

## 10. Security and Privacy

| ID | Requirement | Priority |
|----|-------------|----------|
| SP-01 | No GitHub authentication tokens or app secrets are required in the shipped runtime; frontend bundles must not embed credentials | Must |
| SP-02 | Hosted deployments must not expose local filesystem scanning, folder handles, or local-path launch actions | Must |
| SP-03 | Share URLs must encode only GitHub-source-safe data (username and room context) and must never include local paths or folder identifiers | Must |
| SP-04 | The Electron build uses `contextIsolation: true` and `nodeIntegration: false` | Must |
| SP-05 | "Visit on GitHub" links open in a new tab using `rel="noopener noreferrer"` | Must |
| SP-06 | No analytics or telemetry are collected in v1 | Must |
| SP-07 | README content is rendered as plain text (no HTML rendering) to prevent XSS | Must |
| SP-08 | Rate limit headers are respected; exponential backoff is applied on 403/429 responses | Must |
| SP-09 | The application complies with GitHub's API Terms of Service regarding caching and display of data | Must |

**Data Collected / Stored:**
- Selected repository source (`github` or `local`) in local storage
- Visited room IDs per username (localStorage, user's own browser/device only)
- Player class selection and XP (localStorage)
- Public GitHub API requests are sent directly to GitHub; local repository metadata stays on-device in trusted local runtimes

---

## 11. Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| ACC-01 | All React UI components (menus, info panels, HUD) meet WCAG 2.1 AA color contrast ratios | Must |
| ACC-02 | Full keyboard navigation for all React UI components (tab order, focus indicators) | Must |
| ACC-03 | The game canvas supports keyboard-only play (WASD/arrow keys + interaction key) | Must |
| ACC-04 | All interactive UI elements have accessible labels (aria-label or visible text) | Must |
| ACC-05 | Room Info Panel content is readable by screen readers (rendered in DOM, not canvas) | Must |
| ACC-06 | Animations respect `prefers-reduced-motion` — sprite animations pause, canvas effects are reduced | Should |
| ACC-07 | Pixel art is rendered at a minimum 2x scale; UI text is scalable | Should |
| ACC-08 | Audio has a master volume control and can be fully muted | Should |

---

## 12. User Interface / Interaction Design

### 12.1 Visual Style
- **Aesthetic:** 16-bit pixel art, inspired by classic SNES RPGs (Link to the Past, Final Fantasy VI)
- **Palette:** Each biome has a 16-color palette; the UI chrome uses a dark dungeon stone theme with gold accents
- **Font:** A pixel-art monospace font (e.g., Press Start 2P via Google Fonts) for all in-game text
- **Resolution:** Base resolution 320×240 upscaled with integer scaling; canvas fills the viewport

### 12.2 Biome Visual Themes

| Language / Topic | Biome Name | Visual Theme |
|-----------------|-----------|-------------|
| JavaScript / TypeScript | Neon Circuit City | Glowing cyan/purple grid floors, circuit-board walls |
| Python | Ancient Library | Stone shelves, scrolls, warm amber torchlight |
| Rust | Iron Forge | Metal grates, forge fires, orange/grey palette |
| Go | Wind Temple | Light stone, sky motifs, green/white palette |
| C / C++ | Deep Dungeon | Classic grey stone, darker palette |
| Shell / Config | Utility Vault | Industrial pipes, utility theme |
| HTML / CSS | Garden Ruins | Vines, pastel colours, ruined stonework |
| Unknown / Mixed | Lost Archive | Sepia tones, dusty parchment textures |

### 12.3 Key Screens

**1. Title Screen**
- Game logo, animated pixel art background
- Username input field + load/start button for public repositories
- Sample-dungeon quick-start option
- Credits / About link

**2. Character Select Screen**
- One-card left/right carousel of 4 selectable classes with class portrait
- Class name, description, bonus, and special ability with explicit previous/next navigation

**3. Dungeon View (main game)**
- Phaser canvas (full viewport)
- React HUD overlay: left-rail XP/progression card, inventory button, badge button, help/zoom controls, minimap, mute button, and rate-limit indicator
- On room entry: animated Room Info Panel slides in from the right (React component)

**4. Room Info Panel**
- Repo name (large pixel font)
- Stars ⭐ / Forks 🍴 counts
- Language bar (colour-coded)
- Topics (badge chips)
- README excerpt (scrollable, 500 char max)
- File tree (top-level, expandable)
- Contributors (avatar row, max 5)
- "Visit on GitHub →" button
- Dismiss (X) button

**5. Dungeon Map Overlay (M key)**
- Full-screen map showing all zones and rooms
- Visited rooms: lit; unvisited: dark
- Zone labels, current position marker

**6. Inventory Screen (I key)**
- Grid of collected loot items with tooltips

**7. Badge Panel (B key)**
- Dedicated badge browser with unlocked and locked states
- Badge descriptions and completion status

---

## 13. System States / Lifecycle

```
[Idle / Title Screen]
        │
        ▼ (GitHub username entered or local folder selected)
[Fetching Repos]  ──── (error) ──▶ [Error State: show message, retry]
        │
        ▼ (repos received)
[Generating Dungeon]
        │
        ▼
[Character Select]
        │
        ▼
[Dungeon Exploration] ◀────────────────────────────────┐
        │                                               │
        ├──▶ [Room Entry: Fetch Room Data]              │
        │           │                                   │
        │           ▼                                   │
        │    [Room Info Panel Open]                     │
        │           │                                   │
        │           ├──▶ [Interact with Room Objects / NPCs] ──▶ [XP / Loot / Badge] │
        │           └──▶ [Visit GitHub] (new tab)       │
        │                                               │
        ├──▶ [Map Overlay]                              │
        ├──▶ [Inventory Screen]                         │
        └──▶ [All Rooms Visited] ──▶ [Completion Screen]─┘
                                           │
                                           ▼
                                    [Share / Restart]
```

**Error States:**
- Rate limit exceeded → show budget warning and use cached data when available
- Repo data unavailable → room shows "Mysterious Chamber" with placeholder content
- Network offline → toast notification, cached rooms remain navigable

---

## 14. Implementation Phases

### Phase 1: Foundation
- [ ] Initialize Vite + Phaser 3 + React + TypeScript project
- [ ] Configure Electron wrapper
- [ ] Set up GitHub Actions CI (lint, type-check, unit tests, web build)
- [x] ~~Implement GitHub OAuth flow (web + Electron)~~ *(removed in v1.2 architecture pivot)*
- [ ] Implement GitHub API client (Octokit) with caching layer
- [ ] Implement `GET /users/{user}/repos` with pagination
- [ ] Create a basic Phaser scene that renders a static tilemap room
- [ ] (Optional) Deploy web stub to a static host

### Phase 2: Dungeon Generation
- [ ] Implement BSP dungeon generator
- [ ] Implement language/topic zone grouping
- [ ] Implement room → repo mapping
- [ ] Implement corridor generation between rooms and zones
- [ ] Render generated dungeon as Phaser tilemap
- [ ] Implement player character (pixel art sprite, 4-direction movement, WASD/arrow keys)
- [ ] Implement minimap HUD component (React)
- [ ] Implement full dungeon map overlay (M key)

### Phase 3: Room Content
- [ ] Design and implement Room Info Panel (React component)
- [ ] Fetch and display: repo name, description, stars, forks, topics, language bar
- [ ] Fetch and render README excerpt
- [ ] Fetch and render file tree (top-level)
- [ ] Fetch and render contributor list with avatars
- [ ] Implement "Visit on GitHub" button
- [ ] Implement visited stamp system (localStorage persistence)

### Phase 4: Progression System
- [ ] Design and implement player class selection screen (4 classes)
- [ ] Implement XP system (room entry, info panel open, GitHub visit)
- [ ] Implement level-up animation
- [ ] Implement loot generation logic (repo-property-based)
- [ ] Implement inventory UI (React)
- [ ] Implement badge system and badge unlock animations
- [ ] Implement Profile Room (hub room with user stats)

### Phase 5: Polish & Biomes
- [ ] Create pixel art tilesets for all 8 biomes
- [ ] Create pixel art player class sprites (4 classes × 4 directions)
- [ ] Create pixel art loot item sprites
- [ ] Add ambient SFX and background music per biome
- [ ] Implement contributor NPCs (wandering, interactable)
- [ ] Implement interactable room objects (README Scroll, File Tree Archive, Contributors' Gallery)
- [ ] Implement intro/tutorial sequence
- [ ] Add shareable URL encoding/decoding

### Phase 6: Desktop & Release
- [ ] Finalize Electron packaging (macOS, Windows, Linux)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Performance profiling and optimization
- [ ] Accessibility audit (WCAG 2.1 AA on all React UI)
- [ ] Write README with setup instructions and screenshots
- [ ] Desktop release automation + tagged build publish

---

## 15. Testing Strategy

| Level | Scope | Tools / Approach |
|-------|-------|-----------------|
| Unit Tests | DungeonGenerator, LootSystem, ProgressTracker, GitHub API client | Vitest, mocked GitHub API responses |
| Component Tests | React UI components (RoomInfoPanel, CharacterSelect, HUD, DungeonMap) | Vitest + React Testing Library |
| Integration Tests | Source selection flow, full dungeon generation from mocked repo list, local-source runtime gating | Vitest, MSW (Mock Service Worker) |
| Manual / Exploratory | End-to-end dungeon exploration, room interactions, badge triggers | Manual playtesting with real GitHub accounts |
| Performance | FPS stability, dungeon generation time, bundle size | Chrome DevTools, Lighthouse, Vite bundle analyser |
| Cross-Browser | Core game loop and UI | Manual on Chrome, Firefox, Safari, Edge |
| Electron | Desktop build packaging, trusted local repository access, secure local open actions | Manual on macOS + Windows |

**Key Test Scenarios:**
1. Enter a username with 0 repos → dungeon shows empty state gracefully
2. Enter a username with 1 repo → dungeon generates a single room correctly
3. Enter a username with 100+ repos → generation completes within 10 seconds
4. Enter a username with repos of 8+ different languages → all biomes represented
5. Unauthenticated user hits rate limit → friendly prompt appears
6. Local repository mode is available in Electron and trusted local web origins, but unavailable on hosted deployments
7. Local room open actions launch only validated local targets and reject invalid tokens/paths
8. Visit all rooms in a zone → "Zone Cleared" badge awarded
9. Visit all rooms in dungeon → "Dungeon Master" badge awarded
10. Refresh page mid-session → visited stamps restored from localStorage
11. Invalid username → API 404 handled with user-facing error message
12. Shareable URL loads correct dungeon for another user's browser

---

## 16. Analytics / Success Metrics

No telemetry is collected in v1. Success is evaluated through:

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Discovery engagement | ≥ 3 "Visit on GitHub" clicks per session | localStorage event log (session-only, not transmitted) |
| "Archaeologist" badge completion | Triggered in ≥ 50% of 10-room+ play sessions | Badge unlock event in localStorage |
| Dungeon completion rate | ≥ 20% of sessions visit all rooms (for ≤ 30 repo dungeons) | ProgressTracker state in localStorage |
| Session length | ≥ 10 minutes average | Not automatically measured; estimated via GitHub repo star/watch signals post-share |
| Player feedback | Qualitative positive reception | GitHub Discussions / Issues on the repo |

---

## 17. Acceptance Criteria

1. A player can enter any public GitHub username and have a playable, navigable dungeon rendered within 10 seconds
2. The dungeon contains one room per repository (up to 100 repos in v1)
3. Each room displays: repo name, description, language bar, star/fork counts, topics, README excerpt, file tree, and top contributors
4. A "Visit on GitHub" button in every room opens the correct repo URL
5. Repos are visually grouped into language/topic-themed biomes with distinct tilesets
6. Local repository mode is available only in trusted local runtimes and remains disabled on hosted deployments
7. Four selectable character classes are available at game start, each with distinct XP bonuses
8. XP is awarded for room entry, opening the info panel, and clicking "Visit on GitHub"
9. All 9 badges are implementable and at least 5 are triggerable in a standard play session
10. Visited room state persists across browser refreshes for the same username
11. The full dungeon map overlay (M key) and minimap HUD are functional
12. The web build runs in Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ without errors
13. The Electron desktop build installs and runs on macOS and Windows
14. All React UI components pass WCAG 2.1 AA color contrast checks
15. Frontend/share-link flows do not expose local filesystem paths, local folder identifiers, or secrets

---

## 18. Dependencies and Risks

### 18.1 Dependencies

| Dependency | Type | Risk if Unavailable | Mitigation |
|------------|------|---------------------|------------|
| GitHub REST API v3 | External API | Game cannot generate dungeons | Cache aggressively; degrade gracefully; show clear error |
| Trusted local runtime APIs (Electron + local browser capabilities) | Platform/runtime | Local repository mode unavailable | Keep GitHub-source flow fully functional; clearly disable local mode on unsupported runtimes |
| Phaser.js 3 | npm | Core game engine unavailable | Pinned version; vendored fallback if needed |
| Octokit.js | npm | API client unavailable | Could replace with fetch calls |
| Vite | npm (build) | Build tooling unavailable | Replaceable with webpack or esbuild |
| Electron | npm (desktop) | Desktop build unavailable | Web build remains fully functional |
| Google Fonts (Press Start 2P) | CDN | Pixel font unavailable | Bundle the font locally |
| Static host (optional) | Hosting | Web build hosting unavailable | Continue desktop distribution; deploy to Netlify/Vercel if needed |

### 18.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GitHub API schema changes | Low | Breaking data fetch | Pin Octokit version; add integration tests against mock API |
| README content contains very long/complex markdown | Medium | Info panel cluttered | Strip markdown to plain text; hard-cap at 500 characters |
| File tree API truncation (repos with > 100,000 files) | Low | Incomplete file tree in room | Show "Large Repo — tree truncated" note in panel |
| Pixel art asset creation bottleneck (solo dev) | High | Biomes look incomplete at launch | Use freely licensed pixel art asset packs for v1; replace with custom art in v2 |
| Electron packaging complexity per platform | Medium | Desktop builds broken on some platforms | Use electron-builder; test on at least macOS + Windows in CI |
| Phaser.js v4 released during development | Low | Migration disruption | Pin to Phaser 3.87.x; defer upgrade to v2 |

## 19. Future Considerations

| Item | Description | Potential Version |
|------|-------------|-------------------|
| Multiplayer co-op | Two players explore the same dungeon simultaneously | v2 |
| Organization dungeons | Generate a dungeon from a GitHub organization's repos | v2 |
| Combat encounters | Random encounters triggered by repo health metrics (stale issues, no README) | v2 |
| Dungeon "boss" | A special challenge room for the user's most-starred repo | v2 |
| Commit history timeline | A room's "past" can be explored via commit history as dungeon sub-floors | v2 |
| Leaderboards / public profiles | Share your completion stats publicly | v2 |
| Mobile-native apps | iOS and Android builds via Capacitor | v3 |
| Theme customization | Players can edit dungeon colour palettes | v3 |
| GitLab / Bitbucket support | Connect to other source hosts | v3 |
| AI-generated room descriptions | Use GitHub Copilot API to generate flavour text for each repo-room | v2 |

---

## 20. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should forked repos be included in the dungeon, or only original repos? | Include forks; mark them visually as "Mirror Rooms" |
| 2 | What happens if the user has more than 100 repos? (API pagination) | Paginate all repos up to 500; beyond that show a warning |
| 3 | Should the dungeon layout change between sessions (re-roll)? | No: same username = same layout (deterministic seed) unless user chooses "Re-roll" |
| 4 | What freely licensed pixel art asset packs are acceptable for v1? | Open Game Art (opengameart.org) CC0/CC-BY assets; documented in credits |
| 5 | Should audio be included in v1 or deferred? | Include a minimal set: ambient dungeon music + 3 SFX (footstep, room entry, loot collect) |
| 6 | How should future badge unlocks be surfaced without interrupting play too often? | Keep the current popup for unlock moments and the persistent badge panel for detailed review |
| 7 | Should the shareable URL include local repository path details? | No — shared URLs remain GitHub-source only and must never encode local paths, handles, or basement context |
| 8 | What is the minimum supported screen resolution? | 1024×600 for web; no hard minimum for desktop |

---

## 21. Glossary

| Term | Definition |
|------|------------|
| Dungeon | The full procedurally generated map built from a user's GitHub repositories |
| Room | A single node in the dungeon representing one GitHub repository |
| Zone | A cluster of rooms grouped by primary programming language or topic |
| Biome | The visual theme (tileset, colour palette) applied to a zone |
| Hub Room | The entrance room representing the GitHub user's profile |
| Room Info Panel | The React overlay displaying repository metadata when a room is entered |
| Visited Stamp | A persistent marker indicating the player has fully explored a room |
| Loot | Virtual reward items generated from a repo's properties |
| Badge | An achievement awarded for exploration milestones |
| XP | Experience points earned by exploring rooms and interacting with content |
| BSP | Binary Space Partitioning — the algorithm used to generate room layouts |
| Octokit | The official GitHub REST API client library for JavaScript/TypeScript |
| ETag Revalidation | Conditional HTTP request flow using `ETag` and `If-None-Match` to reuse unchanged API responses and receive free `304 Not Modified` replies |
| Biome Seed | A deterministic value derived from the GitHub username used to ensure consistent dungeon layouts |
