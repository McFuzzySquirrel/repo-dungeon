---
name: implement-github-data-flow
description: >
  Add or extend a Repo Dungeon GitHub data flow, including Octokit access, typed models,
  caching, backoff, and mocked verification coverage.
---

# Skill: Implement GitHub Data Flow

Use this skill when Repo Dungeon needs a new GitHub API call, repo-detail payload, or authentication-related data path.

---

## Process

### Step 1: Choose the authoritative endpoint

Start from the PRD's GitHub API section and identify the exact REST endpoint, scope requirements, pagination rules, and fallback behavior.

### Step 2: Model the data contract

Update the typed models in `src/github/types.ts` so downstream systems receive normalized data rather than raw API payloads.

### Step 3: Implement the client path

Add or update the Octokit call, caching policy, retry behavior, and error normalization in `src/github/api.ts` or `src/game/systems/RoomLoader.ts`.

```ts
export async function fetchExample(): Promise<ExampleResult> {
  // request
  // normalize
  // cache
  // return typed payload
}
```

### Step 4: Expose the flow safely

Surface the new capability through a hook or typed helper, ensuring tokens remain client-only and README-like content stays plain text if rendered.

### Step 5: Verify edge cases

Test unauthenticated limits, authenticated success, 404/403/429 handling, truncation cases, and mocked success paths before handing the flow to UI or gameplay agents.

---

## Reference

See [docs/PRD.md](../../../docs/PRD.md) for the full specification:

- **Section 5.2** — GitHub API endpoints and scopes
- **Section 7.3** — Core GitHub interfaces
- **Section 8.1** — Authentication requirements
- **Section 8.3** — Room detail loading requirements
- **Section 10** — Security and privacy constraints
- **Section 15** — Integration testing expectations
