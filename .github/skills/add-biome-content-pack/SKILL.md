---
name: add-biome-content-pack
description: >
  Add a complete Repo Dungeon biome content pack, including tileset references, prop/NPC
  dressing, palette cues, and ambient audio hooks for a language or topic zone.
---

# Skill: Add Biome Content Pack

Use this skill when introducing or expanding a biome so its assets, props, and audio remain consistent across Repo Dungeon.

---

## Process

### Step 1: Identify the biome contract

Start from the language/topic mapping and determine the biome ID, palette, room dressing expectations, and any special props or NPC flavor.

### Step 2: Gather asset inputs

Confirm which tilesets, sprites, loot art, and audio cues are needed. Note any placeholder or licensed assets that must be documented.

### Step 3: Wire runtime content

Attach the asset pack to biome configuration, room props, NPC presentation, and any tutorial or map-facing labels.

```ts
export const biomeContent = {
  id: 'example-biome',
  tilesetKey: 'example-tileset',
  ambientTrackKey: 'example-ambient',
};
```

### Step 4: Respect accessibility and performance

Provide mute-safe audio hooks, reduced-motion fallbacks, and bundle-conscious asset loading behavior.

### Step 5: Verify in context

Test the biome inside a generated zone to confirm visuals, interactions, and audio remain coherent with the rest of the dungeon.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 8.2** — Biome-linked dungeon generation
- **Section 8.3** — Room props and NPC interactions
- **Section 11** — Reduced-motion and audio accessibility
- **Section 12.1** — Overall visual style
- **Section 12.2** — Biome visual themes
- **Section 14** — Polish and biome implementation phase
