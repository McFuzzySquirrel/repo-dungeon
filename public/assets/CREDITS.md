# Repo Dungeon Asset Notes (Phase 5)

- Biome tilesets currently use Phaser-generated placeholders (`tileset-<biome-id>` texture keys) from `src/game/config/biomePresentation.ts`.
- Ambient audio is mapped per biome to `/public/assets/audio/ambient/*.ogg` and loaded with runtime fallbacks if files are missing.
- When replacing placeholders with shipped assets, use CC0 or CC-BY packs per PRD Section 20 and document exact attribution here.
