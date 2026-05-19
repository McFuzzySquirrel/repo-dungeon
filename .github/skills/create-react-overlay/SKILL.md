---
name: create-react-overlay
description: >
  Build an accessible Repo Dungeon React overlay, panel, or screen that consumes shared
  game state without moving feature logic out of its specialist owner.
---

# Skill: Create React Overlay

Use this skill when adding or refactoring Login, HUD, Room Info, Map, Inventory, or other React-rendered UI surfaces in Repo Dungeon.

---

## Process

### Step 1: Identify the player-facing requirement

Read the relevant PRD screen, accessibility, and functional requirement sections. Confirm whether the UI is an entry screen, persistent HUD, modal panel, or full-screen overlay.

### Step 2: Define state inputs and events

List the store slices, hooks, and scene events the overlay consumes. Keep logic ownership with the correct specialist agent and only bind to typed inputs.

### Step 3: Scaffold the component

Create the component under `src/ui/components/` with semantic HTML, explicit labels, and keyboard/focus management.

```tsx
type OverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function ExampleOverlay({ open, onClose }: OverlayProps) {
  if (!open) return null;

  return (
    <section aria-label="Example overlay">
      <button type="button" onClick={onClose}>Close</button>
    </section>
  );
}
```

### Step 4: Apply accessibility and motion rules

Verify focus order, visible labels, contrast, and any reduced-motion handling required by the PRD.

### Step 5: Verify component behavior

Run component tests and any related accessibility checks. Confirm the overlay works with keyboard-only interaction and screen readers where required.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 8.3** — Room info and overlay behavior
- **Section 8.6** — Map overlay requirements
- **Section 8.7** — Sharing UX
- **Section 11** — Accessibility requirements
- **Section 12.3** — Key screen layouts
