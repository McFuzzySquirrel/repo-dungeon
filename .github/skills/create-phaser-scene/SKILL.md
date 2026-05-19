---
name: create-phaser-scene
description: >
  Scaffold a Repo Dungeon Phaser scene with lifecycle hooks, typed event wiring, and
  integration points for generation, UI overlays, and progression events.
---

# Skill: Create Phaser Scene

Use this skill to add a new Phaser scene or substantially expand an existing scene in Repo Dungeon.

---

## Process

### Step 1: Confirm the scene's responsibility

Read the PRD sections that describe the target screen or runtime state and identify whether the scene belongs to boot, menu, exploration, room interaction, or overlay orchestration.

### Step 2: Define scene contracts

Identify the inbound data, owned runtime state, and outbound events the scene needs. Confirm which concerns stay outside the scene:

- GitHub API work stays with `github-platform-engineer`
- React DOM surfaces stay with `ui-experience-engineer`
- Progression rules stay with `progression-rewards-engineer`
- Dungeon topology stays with `dungeon-generation-engineer`

### Step 3: Scaffold the scene file

Create or update the scene under `src/game/scenes/` with explicit preload/create/update responsibilities and typed event hooks.

```ts
export class ExampleScene extends Phaser.Scene {
  constructor() {
    super('ExampleScene');
  }

  preload(): void {
    // asset registration only
  }

  create(): void {
    // scene objects, event wiring, store subscriptions
  }

  update(_time: number, _delta: number): void {
    // frame-safe runtime behavior
  }
}
```

### Step 4: Wire shared contracts

Register the scene with the app bootstrap, connect it to shared stores or typed events, and ensure ownership boundaries stay intact.

### Step 5: Verify runtime behavior

Run the relevant lint, build, and gameplay-focused tests. Confirm keyboard flow, performance-sensitive updates, and scene transitions behave as expected.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 6.1** — Core exploration loop
- **Section 7.1** — Phaser's role in the stack
- **Section 7.2** — Scene file layout
- **Section 13** — System state transitions
- **Section 14** — Phase sequencing for gameplay delivery
