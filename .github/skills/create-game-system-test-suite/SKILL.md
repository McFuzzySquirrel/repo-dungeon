---
name: create-game-system-test-suite
description: >
  Add Repo Dungeon unit, component, or integration coverage for a gameplay, UI, or platform
  subsystem using Vitest, React Testing Library, and MSW as appropriate.
---

# Skill: Create Game System Test Suite

Use this skill when a Repo Dungeon feature needs new automated verification tied back to PRD requirements or acceptance criteria.

---

## Process

### Step 1: Map the feature to requirements

Identify the exact FR, NF, SP, ACC, or acceptance-criteria items the test suite must cover.

### Step 2: Pick the test level

Use the PRD testing strategy to choose the smallest effective level:

- Unit test for isolated systems such as generation, loot, or progress logic
- Component test for React panels, HUD, or selection screens
- Integration test for auth, dungeon generation, or cross-system flows

### Step 3: Build deterministic fixtures

Create mocked repo lists, room payloads, user states, or event streams that make the target behavior reproducible.

```ts
import { describe, expect, it } from 'vitest';

describe('example requirement', () => {
  it('satisfies the targeted scenario', () => {
    expect(true).toBe(true);
  });
});
```

### Step 4: Assert risk edges

Include at least one degraded or boundary scenario when the PRD calls out rate limits, missing data, large repo counts, or persistence concerns.

### Step 5: Report traceability

Name the test or suite so the covered requirement is obvious to future maintainers and reviewers.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 8** — Functional requirements to map
- **Section 9** — Non-functional quality targets
- **Section 10** — Security-sensitive behaviors
- **Section 11** — Accessibility checks
- **Section 15** — Official testing strategy
- **Section 17** — Acceptance criteria for release gating
