# Repo Dungeon Asset Notes (Phase 5)

- Biome tilesets currently use Phaser-generated placeholders (`tileset-<biome-id>` texture keys) from `src/game/config/biomePresentation.ts`.
- Ambient audio is mapped per biome to `/public/assets/audio/ambient/*.ogg` and loaded with runtime fallbacks if files are missing.
- When replacing placeholders with shipped assets, use CC0 or CC-BY packs per PRD Section 20 and document exact attribution here.

## Included Placeholder Art (Phase 6)

- Basic tilesets in `/public/assets/tilesets/*.svg` are original lightweight SVG placeholders created for this repository.
- Basic sprites in `/public/assets/sprites/*.svg` (`player.svg`, `player-hero.svg`, `player-explorer.svg`, `player-archivist.svg`, `player-hacker.svg`, `player-contributor.svg`, `npc-scribe.svg`, `npc-smith.svg`, `npc-scout.svg`, `door.svg`, `npc-contributor.svg`) are original lightweight SVG placeholders created for this repository.
- Pathway sprite pieces in `/public/assets/sprites/pathways/*.svg` are original lightweight SVG placeholders created for this repository.
- These assets are intended as temporary visual stand-ins until production-quality packs are selected.
