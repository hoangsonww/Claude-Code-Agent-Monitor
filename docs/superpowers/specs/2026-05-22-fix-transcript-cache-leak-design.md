# Design: Fix Agent-Monitor server memory leak

- **Date**: 2026-05-22
- **Author**: zhihua + Claude (brainstorming collaboration)
- **Status**: Design Approved, pending implementation plan

## Background

After running `npm start` locally, the server process memory grows continuously over time and eventually exhausts host memory when combined with Claude / IDE / browser. The initial proposal was to deploy Agent-Monitor on a remote server and access it via the local browser, but investigation showed this only relocates the problem — the root cause is in the server itself, and a long-running remote instance will also OOM.

This design focuses on **root-cause remediation**, not remote deployment. Once memory is stable post-fix, we can revisit whether remote deployment is still desirable.

## Current diagnosis (with code evidence)

Measured locally:

| Metric | Value |
|---|---|
| `data/dashboard.db` | 192 MB |
| `events` row count | 251,244 |
| `sessions` count | 1130 (completed 1015 + abandoned 110 + active 5) |
| Largest single event size | 369 KB |
| `~/.claude/projects` | 58 MB |

Three leak / performance sources were identified:

### Leak #1: TranscriptCache entry has no per-entry size cap

In `server/lib/transcript-cache.js`, every cache entry holds three push-only arrays:

- `state.turnDurations.push(...)` (l.327)
- `state.errors.push(...)` (l.332, 343)
- `state.compaction.entries.push(...)` (l.315)

`_merge()` incremental merging (l.456, 462, 468) likewise only pushes and never trims.

`MAX_CACHE_ENTRIES = 200` bounds the number of entries, but **each entry is unbounded in size**. A long session emits one turnDuration per turn (~50 bytes), so a few thousand turns = MB-scale per entry; 200 entries × tens of MB = **multiple GB**.

### Leak #2: `_set()` stores everything twice (per-entry memory doubled)

`server/lib/transcript-cache.js:51-58`:

```js
this._set(key, {
  errors: result?.errors ? [...result.errors] : null,           // top-level shallow copy
  turnDurations: result?.turnDurations ? [...result.turnDurations] : null,
  compaction: this._cloneCompaction(result.compaction),
  ...
  result,                                                        // contains references to the same fields
});
```

The top-level fields are shallow-copied (`[...result.errors]`) new array objects that do not share references with `result.errors`. **Each array exists twice on the heap per cache entry.**

### Performance issue: the sweep does a full scan over events

`server/index.js:329` runs every 60-300s:

```sql
SELECT DISTINCT e.session_id, json_extract(e.data,'$.transcript_path') AS tp
FROM events e JOIN sessions s ON s.id=e.session_id
WHERE s.status='active' AND json_extract(e.data,'$.transcript_path') IS NOT NULL
GROUP BY e.session_id ORDER BY MAX(e.id) DESC
```

Doing `json_extract` + DISTINCT + ORDER BY across 250k events rows produces large temporary SQLite memory spikes and is slow.

## Goals and constraints

**Goals**:

1. Server process RSS stays stable over long runs (< 300 MB)
2. No Agent log loss (events table remains complete; no retention)
3. Reversible changes confined to `server/`; no changes to hook-handler / UI / WebSocket protocol

**Non-goals** (explicitly out of scope):

- Remote deployment
- Events table retention / archival
- DB engine swap / compression / sharding
- UI / frontend / CLI changes

## Design

### Change A: TranscriptCache per-entry sliding window

Add a configurable cap:

```js
const MAX_ARRAY_LEN = parseInt(process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN, 10) || 1000;
```

After each push in `_streamRange` parsing (l.315/327/332/343 etc.) and in `_merge` incremental merging (l.456/462/468), trim immediately:

```js
if (arr.length > MAX_ARRAY_LEN) arr.splice(0, arr.length - MAX_ARRAY_LEN);
```

Applies to `turnDurations`, `errors`, `compaction.entries`, and `usageExtras.{service_tiers, speeds, inference_geos}` (these Set→Array conversions can also accumulate).

**Why no data loss**:

`routes/hooks.js:583, 633` already inserts `result.errors` / `result.turnDurations` into the events table on every hook trigger, with dedup (`SELECT 1 ... WHERE summary=?` / `WHERE created_at=?`). After cache truncation, the next hook re-reads the transcript file → dedup skips existing rows → only new rows are inserted. The events table stays complete.

**Capacity estimate**:
- 1 turn ≈ 50 bytes
- 1000 turns = 50 KB / cache entry
- 200 entries full ≈ 10 MB

### Change B: Eliminate `_set()` double storage

Simplify the cache entry shape:

```js
this._cache.set(key, { mtimeMs, size, bytesRead, result });
```

Drop all top-level `errors` / `turnDurations` / `compaction` / `usageExtras` / `tokensByModel` / `thinkingBlockCount` / `latestModel` fields. `_merge` computes via local variables and writes back only into `result`.

**Expected effect**: ~50% memory reduction per entry.

### Change C: Stop sweeping events for transcript_path

**Schema migration** (`server/db.js`):

```sql
-- Add column (idempotent)
ALTER TABLE sessions ADD COLUMN transcript_path TEXT;

-- One-time backfill (runs once at startup, gated by a .migrations marker file to prevent reruns)
UPDATE sessions SET transcript_path = (
  SELECT json_extract(data,'$.transcript_path') FROM events
  WHERE events.session_id=sessions.id
    AND json_extract(data,'$.transcript_path') IS NOT NULL
  LIMIT 1
) WHERE transcript_path IS NULL;
```

Follow the idempotent migration pattern at `server/db.js:284` (the `agents_new` rebuild).

**Write path** (`server/routes/hooks.js` `ensureSession`):

When `transcript_path` is first seen, run `UPDATE sessions SET transcript_path=? WHERE id=? AND transcript_path IS NULL`.

**Sweep query rewrite** (`server/index.js:329`):

```sql
SELECT id, transcript_path FROM sessions
WHERE status='active' AND transcript_path IS NOT NULL
```

The query at `server/index.js:309` that fetches `transcript_path` on abandonment is also rewritten to read from the sessions table.

**Complexity**: drops from O(total events rows) to O(active sessions ≈ single digits). **Not a single events row is removed.**

## Verification strategy

### Unit tests (new `server/__tests__/transcript-cache-bounded.test.js`)

1. With `MAX_ARRAY_LEN=100`, feed 500 turns → `result.turnDurations.length === 100`, tail retained
2. After cache truncation, re-extracting → events table dedup skips existing rows, insert count == 0
3. Coarse memory assertion: 200 entries × 1000 turns, `process.memoryUsage().heapUsed` delta < 30 MB

### Integration tests

- `npm run test:server` green
- `npm run test:client` green
- `npm run mcp:typecheck` passes

### Measurement script (one-off)

New `scripts/memory-soak-test.js`:

- Generate fake transcript jsonl with 10000 turns
- Start the server, simulate 10 concurrent active sessions, fire a hook every 1s
- Run for 30 minutes, log `process.memoryUsage().rss` per minute
- Assert: RSS growth at minute 30 < 50 MB

### Verification checklist (pre-merge)

- [ ] Unit + integration tests green
- [ ] `npm run mcp:typecheck` passes
- [ ] Local `npm start` for 1h, `ps -o rss=` monitoring shows a flat curve
- [ ] DB migration idempotent: two consecutive `npm start` runs without errors
- [ ] Old DB (no `transcript_path` column) → migrate + backfill → sweep works
- [ ] After cache truncation, the UI events list still shows all old turns/errors

## Risks and rollback

### Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `MAX_ARRAY_LEN=1000` too small for ultra-long sessions | Low | Medium | Env var tunable to 5000-10000; events table is always complete, UI can still query |
| Extra dedup SELECTs after cache truncation | Medium | Low | Sweep runs every 60-300s; an extra 100-1000 primary-key lookups per run is acceptable |
| ALTER TABLE fails on old DB | Very low | High | Use the migration pattern at `db.js:284` — try-catch + column-existence check |
| transcript_path backfill is slow due to events scan | Low | Low | One-time migration takes ~1s; use EXISTS subquery instead of join |
| `_set()` shape change breaks other readers | Low | Medium | Grep the repo to confirm all external consumers of `extract()` only read `result.*` |

### Rollback

- All changes are confined to `server/`; **hook-handler / UI / WebSocket protocol untouched**
- Rollback at any phase = `git revert` of the matching commit
- DB schema: `ALTER TABLE ... ADD COLUMN` is not reversible, but an unread/unwritten new column is harmless; once code is reverted, sessions just has an extra empty column

## Optional follow-ups (out of scope here)

- Add a `(session_id, event_type, created_at)` composite index on events (UI query performance)
- Add a `lastProcessedTurnTimestamp` cursor to the cache so `extract` only returns new turns (eliminates dedup SELECTs entirely)
- `/api/internal/memory` diagnostic endpoint returning `cache.stats()` + `process.memoryUsage()`

## Decision record

| Option | Choice | Rationale |
|---|---|---|
| Remote deployment vs fix leak | Fix leak | Remote deployment relocates the problem; the leak hits remote too |
| Permanent events retention vs retention policy | Permanent | Hard user constraint: guarantee Agent log integrity |
| Truncate cache vs not truncate | Truncate to MAX_ARRAY_LEN | Events table already persists raw data; the cache is a derived view |
| Delete events vs rewrite the sweep query | Rewrite the query | Satisfies the "no log loss" constraint |
| Introduce LRU byte-budget instead of entry count | No | Entry-count cap + per-entry cap is already enough; byte accounting adds complexity |
