# Optimization Research: Reducing GitHub REST API Calls

## Context

Repo Dungeon is a public-repos-only app (OAuth has been removed) and therefore
operates under GitHub's **unauthenticated REST limit of 60 requests per hour per
IP**. The existing mitigation is a persistent `localStorage` cache
(`src/github/cache.ts`) that stores repo lists with a 24 h TTL and room details
with a 7 d TTL, keyed by username and repo full name.

On a cold cache, loading a single room costs ~5 REST calls
(`repo` + `languages` + `contents/` (tree) + `contributors` + `readme`) plus 1
call for the repo list. A heavy explorer can exhaust 60 calls in well under
ten minutes once the cache starts expiring.

This document captures additional techniques that can drive the per-session
budget down further, ranked by impact and implementation effort.

---

## Recommended techniques (ranked)

### 1. Conditional requests with `ETag` / `If-None-Match` — **biggest win**

GitHub's REST API supports `ETag` and `Last-Modified` response headers. A
follow-up request that returns **`304 Not Modified` does not count against the
rate limit** ([REST API rate limits docs][gh-rate-limit]).

Today the cache is purely TTL-based: once an entry expires we throw the payload
away and pay full price for a fresh fetch.

**Change**

- Persist the `ETag` (and/or `Last-Modified`) header alongside each cached
  payload in `localStorage`.
- After TTL expiry, re-issue the request with `If-None-Match: <etag>`. On a 304,
  refresh the cached timestamp and reuse the cached body — **0 quota consumed**.
- Applies to all five room endpoints and the repo-list endpoint. For a
  returning player whose target repos rarely change, almost every refresh
  becomes a free 304.

**Estimated impact:** 80–95 % reduction in *post-TTL* calls for active repos.
This single change makes the 60/hr ceiling effectively a non-issue for daily
players.

**Sketch**

```ts
// cache.ts — store etag alongside payload
interface RoomDetailSnapshot {
  schemaVersion: 1;
  repoFullName: string;
  fetchedAt: string;
  etag?: string;          // ← new
  data: GitHubRoomData;
}

// api.ts — requestWithCache, post-TTL path
const cached = loadCachedRoomDetail(owner, repo);
const res = await this.requester<T>(route, {
  ...params,
  headers: cached?.etag ? { 'if-none-match': cached.etag } : {},
});

if (res.status === 304 && cached) {
  // Refresh timestamp, keep payload + etag
  saveCachedRoomDetail(owner, repo, cached.data, cached.etag);
  return { data: cached.data, status: 200, headers: res.headers };
}
// 200 → persist new etag from res.headers.etag
```

---

### 2. Reuse the repo summary returned by the list call — **−1 call/room**

`loadRoomData` currently re-fetches `GET /repos/{owner}/{repo}` even though
the same repo object was already returned (and cached) by the repo-list call.

**Change:** pass the `GitHubRepoSummary` into `loadRoomData` and only re-fetch
when a field that is actually needed is missing. Saves **1 call per first-time
room visit** and is essentially a free refactor.

---

### 3. Lazy-load `/contributors` and `/languages` — **−2 calls/room**

Neither contributors nor the full language breakdown is required to render a
room. `repo.language` (from the summary) already covers biome selection.

**Change:** fetch contributors only when the player opens the NPC roster, and
`/languages` only when the full breakdown panel is displayed. Many rooms a
player walks through are never inspected in detail — those become **0–1 calls
instead of 5**.

---

### 4. Fold the README fetch into the tree fetch

`GET /repos/{owner}/{repo}/contents/` already returns the top-level entries,
including the README filename. Detect the README from that listing and fetch
the blob only when needed, instead of issuing a separate `GET /readme` call up
front. Combined with #3, the per-room cost drops from 5 to ~2 on cache miss.

---

### 5. Static dungeon snapshot for the demo username

For a default/demo dungeon (e.g. `McFuzzySquirrel`'s own repos used for the
welcome experience), bake a JSON manifest into the build/CDN. First-time
visitors get the demo with **0 REST calls** and only hit the API when they
refresh or pick a different username.

---

### 6. Cross-tab in-flight de-duplication

The current `inFlight` map dedupes requests **within a single
`GitHubApiClient` instance**, but two browser tabs opening the same room will
each fire their own request.

**Change:** coordinate via `BroadcastChannel` + a short-lived `localStorage`
flag so concurrent tabs share the response.

---

### 7. Events-driven cache invalidation

`GET /users/{user}/events/public` returns a user's recent activity in **a
single call** and reveals which repos changed. Use it instead of blanket TTL
expiry to invalidate selectively: 1 call replaces N stale-check calls when
only a handful of repos have actually changed.

---

### 8. Rate-limit-aware graceful degradation

Read `X-RateLimit-Remaining` from every response. When it drops below a
threshold (e.g. 5), automatically serve stale-but-cached data for the
remainder of the window instead of failing. This doesn't reduce calls, but it
converts the cliff at 60 into smooth degradation.

---

### 9. Surface the budget in the HUD

Display "API calls remaining this hour: N/60" in the HUD. Players self-
regulate exploration when the cost is visible. Cheap to add, gives users
agency, and reduces support load when someone does hit the limit.

---

### 10. Optional escape hatch — per-user PAT

Add an opt-in "paste a personal access token" field. A user-provided classic
PAT or fine-grained read-only token raises the budget to **5 000 calls/hr**
with no OAuth complexity (no redirect, no server). The token stays in
`localStorage`. Frames it as "power user" mode without re-introducing the
OAuth flow that was removed.

---

## Suggested implementation order

| # | Change | Effort | Expected impact |
|---|--------|--------|-----------------|
| 1 | ETag / 304 revalidation                          | Medium | Largest single reduction, no UX change |
| 2 | Reuse repo summary from list call                | Low    | −1 call/room |
| 3 | Lazy-load contributors + languages               | Medium | −2 calls/room for shallow visits |
| 4 | Fold README into tree fetch                      | Low    | −1 call/room |
| 5 | Rate-limit-aware degradation + HUD counter       | Low    | UX/reliability |
| 6 | Optional PAT input                               | Low    | Escape hatch if telemetry shows users still hit the wall |

Items 1–4 alone take a typical returning-player session from ~5 calls/room on
cache miss to ~1–2 — and effectively to 0 for any repo whose ETag still
matches — comfortably within the 60/hr ceiling even for heavy explorers.

---

## References

- GitHub REST API rate limits — <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>
- Conditional requests / `ETag` — <https://docs.github.com/en/rest/overview/resources-in-the-rest-api#conditional-requests>
- Current cache implementation — `src/github/cache.ts`
- Current API client / fan-out — `src/github/api.ts`, `src/ui/hooks/useGitHubData.ts`

[gh-rate-limit]: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
