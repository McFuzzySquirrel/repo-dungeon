# Optimization Research: Reducing GitHub REST API Calls

> **Status — implemented in this PR:** items #1, #2, #3, #4, and #5 (rate-limit
> HUD + graceful degradation) are now live. See "Implementation notes" at the
> bottom of each section and `src/github/api.ts` + `src/github/cache.ts` +
> `src/ui/components/RoomInfoPanel.tsx` + `src/ui/components/RateLimitHud.tsx`.
> Item #6 (PAT escape hatch) and the deferred follow-ups are still open.

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

### 1. Conditional requests with `ETag` / `If-None-Match` — **biggest win** ✅ **Implemented**

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

**Implementation notes**

- Per-endpoint ETags are persisted in a new `etags: RoomDetailEtags` field on
  `RoomDetailSnapshot` (and `pageEtags: Record<number, string>` on
  `RepoListSnapshot`) — see `src/github/cache.ts`.
- `GitHubApiClient.loadRoomData(roomRef, { persisted })` and
  `listPublicReposWithRevalidation(username, { persisted })` send
  `If-None-Match` on every sub-fetch and reuse the persisted slice on 304.
- When **every** fetched endpoint returns 304, the helpers call
  `touchCachedRoomDetailFreshness` / `touchCachedRepoListFreshness` so we
  bump the `fetchedAt` timestamp without re-serializing the body.
- `RoomInfoPanel` and `useGitHubData` now thread the persisted snapshot
  through these calls.

---

### 2. Reuse the repo summary returned by the list call — **−1 call/room** ✅ **Implemented**

`loadRoomData` currently re-fetches `GET /repos/{owner}/{repo}` even though
the same repo object was already returned (and cached) by the repo-list call.

**Change:** pass the `GitHubRepoSummary` into `loadRoomData` and only re-fetch
when a field that is actually needed is missing. Saves **1 call per first-time
room visit** and is essentially a free refactor.

**Implementation notes**

- `loadRoomData` accepts `options.summary?: GitHubRepoSummary`. When supplied
  (and the owner/repo match), `GET /repos/{owner}/{repo}` is skipped entirely.
- `RoomInfoPanel.fetchRoomData` reconstructs the summary from the
  `RoomEnteredEvent.repo` payload (the DungeonScene already spreads the full
  summary into the event), via the `buildSummaryFromEvent` helper.

---

### 3. Lazy-load `/contributors` and `/languages` — **−2 calls/room** ✅ **Implemented (contributors + README; languages kept eager)**

Neither contributors nor the full language breakdown is required to render a
room. `repo.language` (from the summary) already covers biome selection.

**Implementation notes**

- `loadRoomData` accepts `skipReadme` and `skipContributors` flags.
  `RoomInfoPanel` sets both to `true`; the data is fetched lazily via
  `loadReadme(roomRef, { etag })` / `loadContributors(roomRef, { etag })` only
  when the user opens the README or Contributors tab.
- `GitHubRoomData.deferred?: Array<'readme' | 'contributors'>` marks endpoints
  that were intentionally skipped (distinct from `unavailable`, which means a
  fetch was attempted and failed). The panel shows a spinner for deferred tabs
  until the lazy load resolves, then merges the slice back into the persisted
  snapshot so the next session gets a complete cache hit.
- `/languages` is **kept in the initial fan-out** because the default Overview
  tab renders the language bar; lazy-loading it would degrade first-paint UX.
  Net per-room cost on cold cache: **languages + tree = 2 calls** (with summary
  reuse, item #2). With ETags (#1), subsequent loads cost 0.

---

### 4. Fold the README fetch into the tree fetch ✅ **Implemented via lazy README**

Rather than parsing the README path out of the tree response, the
implementation simply defers the README fetch to first README-tab open (see
item #3 above). The end-to-end savings are identical (−1 call on rooms that
are never inspected) and the code path is simpler.

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

### 8. Rate-limit-aware graceful degradation ✅ **Implemented**

Read `X-RateLimit-Remaining` from every response. When it drops below a
threshold (e.g. 5), automatically serve stale-but-cached data for the
remainder of the window instead of failing. This doesn't reduce calls, but it
converts the cliff at 60 into smooth degradation.

**Implementation notes**

- `GitHubApiClient.recordRateLimit` extracts `x-ratelimit-{limit,remaining,reset}`
  from every response (including 304s) and publishes a `RateLimitSnapshot` to
  both per-client subscribers and the module-level `rateLimitTracker`.
- `RoomInfoPanel.fetchRoomData` falls back to a stale persisted snapshot when a
  request fails with `kind: 'rate_limit'`, so players still see room contents
  past the cliff.

---

### 9. Surface the budget in the HUD ✅ **Implemented**

Display "API calls remaining this hour: N/60" in the HUD. Players self-
regulate exploration when the cost is visible. Cheap to add, gives users
agency, and reduces support load when someone does hit the limit.

**Implementation notes**

- `src/ui/components/RateLimitHud.tsx` subscribes to `rateLimitTracker`,
  renders `N/limit resets in Xm`, and colour-codes warn/critical when
  `remaining` drops below 15 / 5. A `✓ cached` pip flashes briefly whenever
  the most recent request was a free `304 Not Modified`.

---

### 10. Optional escape hatch — per-user PAT (not yet implemented)

Add an opt-in "paste a personal access token" field. A user-provided classic
PAT or fine-grained read-only token raises the budget to **5 000 calls/hr**
with no OAuth complexity (no redirect, no server). The token stays in
`localStorage`. Frames it as "power user" mode without re-introducing the
OAuth flow that was removed.

---

## Suggested implementation order

| # | Change | Effort | Expected impact | Status |
|---|--------|--------|-----------------|--------|
| 1 | ETag / 304 revalidation                          | Medium | Largest single reduction, no UX change | ✅ |
| 2 | Reuse repo summary from list call                | Low    | −1 call/room | ✅ |
| 3 | Lazy-load contributors + languages               | Medium | −2 calls/room for shallow visits | ✅ (contributors + README; languages kept eager) |
| 4 | Fold README into tree fetch                      | Low    | −1 call/room | ✅ (via lazy README, simpler than tree-fold) |
| 5 | Rate-limit-aware degradation + HUD counter       | Low    | UX/reliability | ✅ |
| 6 | Optional PAT input                               | Low    | Escape hatch if telemetry shows users still hit the wall | ⏩ deferred |

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
