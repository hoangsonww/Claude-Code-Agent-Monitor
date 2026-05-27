# Fix Transcript-Cache Memory Leak — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate server-side memory growth caused by unbounded TranscriptCache entries and full-table `events` scans in the periodic sweep, while keeping the `events` table 100% intact.

**Architecture:** Three independent fixes, all confined to `server/`:
1. Bounded sliding-window arrays inside each TranscriptCache entry (`turnDurations`/`errors`/`compaction.entries`/`usageExtras.*`).
2. Single-storage refactor of cache entries — drop the duplicated top-level fields, keep only `{ mtimeMs, size, bytesRead, result }`.
3. Add `sessions.transcript_path` column (idempotent migration + backfill) so the periodic sweep stops doing `SELECT DISTINCT ... json_extract` on the 250k-row `events` table.

**Tech Stack:** Node.js, `better-sqlite3`, `node:test` (built-in), Express, WebSocket (`ws`).

**Design doc:** `docs/superpowers/specs/2026-05-22-fix-transcript-cache-leak-design.md`.

**Constraints (do not violate):**
- `events` table is **read-only** to this work — never DELETE/TRUNCATE.
- Only `server/` and `scripts/memory-soak-test.js` may be touched. No changes to hook-handler, UI, MCP, WebSocket protocol, REST response shapes.
- Every commit must keep `npm run test:server` green.

---

## Task 0: Pre-flight check

**Step 1: Confirm clean working tree**

Run:
```bash
git status
git log --oneline -3
```
Expected: working tree clean (or only this plan untracked); HEAD is `46bd0c6` or descendant.

**Step 2: Baseline test run**

Run: `npm run test:server`
Expected: all green. Note the count for comparison after each task.

**Step 3: Note current cache file size**

Run: `wc -l server/lib/transcript-cache.js`
Expected: `578` (anchor for line-number references in this plan).

---

## Task 1: Add bounded sliding-window trim helper

**Files:**
- Modify: `server/lib/transcript-cache.js` (add constant + helper near top)
- Test: `server/__tests__/transcript-cache-bounded.test.js` (new file)

**Step 1: Write the failing test**

Create `server/__tests__/transcript-cache-bounded.test.js`:

```js
/**
 * @file Tests that TranscriptCache caps the size of each per-entry array
 * (turnDurations / errors / compaction.entries / usageExtras.*) so a long
 * session cannot grow a single cache entry without bound.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TranscriptCache = require("../lib/transcript-cache");

let tmpDir;
before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-bounded-"));
});
after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeJsonl(name, lines) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return p;
}

describe("TranscriptCache._trimArray", () => {
  it("exists and trims arrays to the given max length, keeping the tail", () => {
    const cache = new TranscriptCache();
    assert.equal(typeof cache._trimArray, "function");
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    cache._trimArray(arr, 3);
    assert.deepEqual(arr, [8, 9, 10]);
  });

  it("is a no-op when array is within the cap", () => {
    const cache = new TranscriptCache();
    const arr = [1, 2, 3];
    cache._trimArray(arr, 5);
    assert.deepEqual(arr, [1, 2, 3]);
  });

  it("handles null/undefined safely", () => {
    const cache = new TranscriptCache();
    assert.doesNotThrow(() => cache._trimArray(null, 5));
    assert.doesNotThrow(() => cache._trimArray(undefined, 5));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test server/__tests__/transcript-cache-bounded.test.js`
Expected: FAIL — `cache._trimArray is not a function`.

**Step 3: Add helper + constant**

In `server/lib/transcript-cache.js`, just after the existing `MAX_CACHE_ENTRIES` constant (~line 9), add:

```js
const MAX_CACHE_ENTRIES = 200;

// Hard cap on the length of each per-entry growable array (turnDurations,
// errors, compaction.entries, usageExtras.{service_tiers,speeds,inference_geos}).
// Past this point we keep the *tail* — the most recent N items — so the
// cache reflects current state. Older items are NOT lost from the system:
// they are already persisted to the events table by routes/hooks.js, with
// dedup logic that prevents re-insertion when the cache re-reads them.
// Configurable via TRANSCRIPT_CACHE_MAX_ARRAY_LEN env var.
const MAX_ARRAY_LEN = (() => {
  const raw = parseInt(process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1000;
})();
```

Then inside the `TranscriptCache` class body, add the helper method (after `_set`, before `get size()`):

```js
/** Trim an array in-place to keep only the last `maxLen` items. No-op on falsy. */
_trimArray(arr, maxLen = MAX_ARRAY_LEN) {
  if (!arr || !Array.isArray(arr) || arr.length <= maxLen) return;
  arr.splice(0, arr.length - maxLen);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test server/__tests__/transcript-cache-bounded.test.js`
Expected: PASS — 3 subtests under `TranscriptCache._trimArray`.

**Step 5: Run full suite — no regressions**

Run: `npm run test:server`
Expected: all green.

**Step 6: Commit**

```bash
git add server/lib/transcript-cache.js server/__tests__/transcript-cache-bounded.test.js
git commit -m "feat(transcript-cache): add MAX_ARRAY_LEN config + _trimArray helper

Introduces a tunable hard cap (env: TRANSCRIPT_CACHE_MAX_ARRAY_LEN, default
1000) and an in-place tail-keeping trim helper. Wiring follows in next commit."
```

---

## Task 2: Wire `_trimArray` into `_finalizeState` and `_merge`

**Files:**
- Modify: `server/lib/transcript-cache.js` `_finalizeState` (~line 376), `_merge` (~line 437-510)
- Test: `server/__tests__/transcript-cache-bounded.test.js` (extend)

**Step 1: Write failing tests**

Append to `server/__tests__/transcript-cache-bounded.test.js`:

```js
describe("TranscriptCache.extract — array caps", () => {
  it("caps turnDurations at MAX_ARRAY_LEN on full read, keeping the tail", () => {
    // 1500 turn_duration entries, ascending timestamps
    const lines = [];
    for (let i = 0; i < 1500; i++) {
      lines.push({
        type: "system",
        subtype: "turn_duration",
        durationMs: i + 1,
        timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
    }
    const p = writeJsonl("turns.jsonl", lines);

    process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN = "100";
    // Re-require fresh to pick up the env override
    delete require.cache[require.resolve("../lib/transcript-cache")];
    const Fresh = require("../lib/transcript-cache");
    const cache = new Fresh();

    const result = cache.extract(p);
    assert.ok(result, "expected non-null result");
    assert.equal(result.turnDurations.length, 100);
    // Tail-kept: durationMs should be 1401..1500
    assert.equal(result.turnDurations[0].durationMs, 1401);
    assert.equal(result.turnDurations[99].durationMs, 1500);

    delete process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN;
    delete require.cache[require.resolve("../lib/transcript-cache")];
  });

  it("caps errors and compaction.entries on full read", () => {
    const lines = [];
    for (let i = 0; i < 300; i++) {
      lines.push({
        isApiErrorMessage: true,
        error: "rate_limit",
        message: { content: [{ text: `err-${i}` }] },
        timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
      lines.push({
        isCompactSummary: true,
        uuid: `c-${i}`,
        timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
    }
    const p = writeJsonl("err-compact.jsonl", lines);

    process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN = "50";
    delete require.cache[require.resolve("../lib/transcript-cache")];
    const Fresh = require("../lib/transcript-cache");
    const cache = new Fresh();
    const result = cache.extract(p);

    assert.equal(result.errors.length, 50);
    assert.equal(result.compaction.entries.length, 50);
    assert.equal(result.compaction.count, 300, "count must reflect ALL parsed entries, not just retained");

    delete process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN;
    delete require.cache[require.resolve("../lib/transcript-cache")];
  });

  it("incremental merge respects cap (append to existing capped entry)", () => {
    process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN = "100";
    delete require.cache[require.resolve("../lib/transcript-cache")];
    const Fresh = require("../lib/transcript-cache");
    const cache = new Fresh();

    // First batch: 80 turns
    const linesA = [];
    for (let i = 0; i < 80; i++) {
      linesA.push({
        type: "system",
        subtype: "turn_duration",
        durationMs: i + 1,
        timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
    }
    const p = writeJsonl("incr.jsonl", linesA);
    let result = cache.extract(p);
    assert.equal(result.turnDurations.length, 80);

    // Append 50 more — total 130, cache should retain only last 100
    const fd = fs.openSync(p, "a");
    for (let i = 80; i < 130; i++) {
      const line = JSON.stringify({
        type: "system",
        subtype: "turn_duration",
        durationMs: i + 1,
        timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      }) + "\n";
      fs.writeSync(fd, line);
    }
    fs.closeSync(fd);

    result = cache.extract(p);
    assert.equal(result.turnDurations.length, 100);
    // Tail check: last entry should be durationMs=130
    assert.equal(result.turnDurations[99].durationMs, 130);
    // Head should be durationMs=31 (130 - 100 + 1)
    assert.equal(result.turnDurations[0].durationMs, 31);

    delete process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN;
    delete require.cache[require.resolve("../lib/transcript-cache")];
  });
});
```

**Step 2: Run tests — verify they fail**

Run: `node --test server/__tests__/transcript-cache-bounded.test.js`
Expected: 3 new tests under `extract — array caps` all FAIL (lengths are 1500 / 300 / 130, not the caps).

**Step 3: Wire trim into `_finalizeState`**

In `server/lib/transcript-cache.js`, modify `_finalizeState` (~line 376). Just before the final `return` block (~line 405, right after `serializedExtras` is computed), trim each growable array. Replace:

```js
    const serializedExtras = hasUsageExtras
      ? {
          service_tiers: [...state.usageExtras.service_tiers],
          speeds: [...state.usageExtras.speeds],
          inference_geos: [...state.usageExtras.inference_geos],
        }
      : null;
```

with:

```js
    this._trimArray(state.errors);
    this._trimArray(state.turnDurations);
    if (state.compaction) this._trimArray(state.compaction.entries);

    // For usageExtras (Sets), bound by converting to array, trimming, back to Set
    const serializedExtras = hasUsageExtras
      ? {
          service_tiers: this._capArrayFromSet(state.usageExtras.service_tiers),
          speeds: this._capArrayFromSet(state.usageExtras.speeds),
          inference_geos: this._capArrayFromSet(state.usageExtras.inference_geos),
        }
      : null;
```

Then add the helper next to `_trimArray`:

```js
/** Convert Set to array with the same MAX_ARRAY_LEN tail cap. */
_capArrayFromSet(set) {
  const arr = [...set];
  this._trimArray(arr);
  return arr;
}
```

**Step 4: Wire trim into `_merge`**

In `_merge` (~line 437), each `push(...)` of `entries` / `errors` / `turnDurations` is followed by a re-assignment to the merged collection. After each push add a trim. Specifically:

Replace (~line 455-457):
```js
      compaction.entries.push(...incremental.compaction.entries);
    }
```
with:
```js
      compaction.entries.push(...incremental.compaction.entries);
      this._trimArray(compaction.entries);
    }
```

Replace (~line 461-463):
```js
      if (!errors) errors = [];
      errors.push(...incremental.errors);
    }
```
with:
```js
      if (!errors) errors = [];
      errors.push(...incremental.errors);
      this._trimArray(errors);
    }
```

Replace (~line 467-469):
```js
      if (!turnDurations) turnDurations = [];
      turnDurations.push(...incremental.turnDurations);
    }
```
with:
```js
      if (!turnDurations) turnDurations = [];
      turnDurations.push(...incremental.turnDurations);
      this._trimArray(turnDurations);
    }
```

For the `usageExtras` Set merging block (~line 200-216), wrap the final array output:

```js
      usageExtras = {
        service_tiers: this._capArrayFromSet(merged.service_tiers),
        speeds: this._capArrayFromSet(merged.speeds),
        inference_geos: this._capArrayFromSet(merged.inference_geos),
      };
```

**Step 5: Run new tests — verify pass**

Run: `node --test server/__tests__/transcript-cache-bounded.test.js`
Expected: all subtests PASS.

**Step 6: Run full suite — no regressions**

Run: `npm run test:server`
Expected: all green.

**Step 7: Commit**

```bash
git add server/lib/transcript-cache.js server/__tests__/transcript-cache-bounded.test.js
git commit -m "feat(transcript-cache): bound per-entry arrays via _trimArray

Wires MAX_ARRAY_LEN through _finalizeState and _merge so turnDurations,
errors, compaction.entries, and usageExtras.* keep only the most recent N
items. Older items remain in the events table (persisted by hooks.js with
dedup), so the bound is safe — UI history is unaffected, only the in-memory
cache footprint is capped.

compaction.count still reflects the total parsed count even when entries
is trimmed."
```

---

## Task 3: Eliminate cache-entry double storage

**Files:**
- Modify: `server/lib/transcript-cache.js` `extract()` body (~line 23-148), `_merge` (~line 437-515)
- Test: `server/__tests__/transcript-cache-bounded.test.js` (extend)

**Step 1: Write failing test**

Append to the bounded-test file:

```js
describe("TranscriptCache._set — single storage", () => {
  it("cache entry contains ONLY {mtimeMs, size, bytesRead, result}", () => {
    const p = writeJsonl("single.jsonl", [
      { type: "system", subtype: "turn_duration", durationMs: 100, timestamp: "2026-01-01T00:00:00Z" },
    ]);
    const cache = new TranscriptCache();
    cache.extract(p);
    const entry = cache._cache.get(p);
    assert.ok(entry, "entry should be cached");
    const keys = Object.keys(entry).sort();
    assert.deepEqual(keys, ["bytesRead", "mtimeMs", "result", "size"]);
  });

  it("does not store duplicate top-level errors/turnDurations/compaction", () => {
    const p = writeJsonl("dup.jsonl", [
      { type: "system", subtype: "turn_duration", durationMs: 1, timestamp: "2026-01-01T00:00:00Z" },
      { isApiErrorMessage: true, error: "x", message: { content: [{ text: "y" }] }, timestamp: "2026-01-01T00:00:01Z" },
      { isCompactSummary: true, uuid: "u1", timestamp: "2026-01-01T00:00:02Z" },
    ]);
    const cache = new TranscriptCache();
    cache.extract(p);
    const entry = cache._cache.get(p);
    assert.equal(entry.errors, undefined);
    assert.equal(entry.turnDurations, undefined);
    assert.equal(entry.compaction, undefined);
    assert.equal(entry.tokensByModel, undefined);
    assert.equal(entry.usageExtras, undefined);
    assert.equal(entry.thinkingBlockCount, undefined);
    assert.equal(entry.latestModel, undefined);
  });
});
```

**Step 2: Run tests — verify they fail**

Run: `node --test server/__tests__/transcript-cache-bounded.test.js`
Expected: both new tests FAIL — entry has extra top-level fields.

**Step 3: Simplify `_set` call sites in `extract()`**

In `server/lib/transcript-cache.js` `extract()` method, there are **4 places** that call `this._set(key, { ...lots of fields..., result })`. Replace each one to keep only `{ mtimeMs, size, bytesRead, result }`.

Find these four blocks by their location (line numbers approximate):

**Block 1** (~line 45-58, full re-read path):
```js
        const result = this._fullRead(transcriptPath);
        this._set(key, {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          bytesRead: stat.size,
          tokensByModel: result ? this._cloneTokens(result.tokensByModel) : null,
          compaction: result ? this._cloneCompaction(result.compaction) : null,
          errors: result?.errors ? [...result.errors] : null,
          turnDurations: result?.turnDurations ? [...result.turnDurations] : null,
          thinkingBlockCount: result?.thinkingBlockCount || 0,
          usageExtras: result ? this._cloneUsageExtras(result.usageExtras) : null,
          latestModel: result?.latestModel || null,
          result,
        });
        return result;
```
Replace with:
```js
        const result = this._fullRead(transcriptPath);
        this._set(key, { mtimeMs: stat.mtimeMs, size: stat.size, bytesRead: stat.size, result });
        return result;
```

**Block 2** (~line 90-104, incremental "only whitespace" path):
```js
            this._set(key, {
              mtimeMs: stat.mtimeMs,
              size: stat.size,
              bytesRead: stat.size,
              tokensByModel: null,
              compaction: null,
              errors: null,
              turnDurations: null,
              thinkingBlockCount: 0,
              usageExtras: null,
              latestModel: null,
              result: null,
            });
            return null;
```
Replace with:
```js
            this._set(key, { mtimeMs: stat.mtimeMs, size: stat.size, bytesRead: stat.size, result: null });
            return null;
```

**Block 3** (~line 106-119, incremental success path):
```js
          this._set(key, {
            mtimeMs: stat.mtimeMs,
            size: stat.size,
            bytesRead: stat.size,
            tokensByModel: this._cloneTokens(result.tokensByModel),
            compaction: this._cloneCompaction(result.compaction),
            errors: result.errors ? [...result.errors] : null,
            turnDurations: result.turnDurations ? [...result.turnDurations] : null,
            thinkingBlockCount: result.thinkingBlockCount || 0,
            usageExtras: this._cloneUsageExtras(result.usageExtras),
            latestModel: result.latestModel || null,
            result,
          });
          return result;
```
Replace with:
```js
          this._set(key, { mtimeMs: stat.mtimeMs, size: stat.size, bytesRead: stat.size, result });
          return result;
```

**Block 4** (~line 123-130, "only whitespace, no change" fallthrough):
```js
        this._set(key, {
          ...cached,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          bytesRead: stat.size,
        });
        return cached.result;
```
This one is already correct (it spreads `...cached`, which after this change has no extras). Leave as is, but verify after refactor: `cached` now contains only `{ mtimeMs, size, bytesRead, result }`.

**Block 5** (~line 133-148, same-size-different-mtime path):
```js
      const result = this._fullRead(transcriptPath);
      this._set(key, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        bytesRead: stat.size,
        tokensByModel: result ? this._cloneTokens(result.tokensByModel) : null,
        compaction: result ? this._cloneCompaction(result.compaction) : null,
        errors: result?.errors ? [...result.errors] : null,
        turnDurations: result?.turnDurations ? [...result.turnDurations] : null,
        thinkingBlockCount: result?.thinkingBlockCount || 0,
        usageExtras: result ? this._cloneUsageExtras(result.usageExtras) : null,
        latestModel: result?.latestModel || null,
        result,
      });
      return result;
```
Replace with:
```js
      const result = this._fullRead(transcriptPath);
      this._set(key, { mtimeMs: stat.mtimeMs, size: stat.size, bytesRead: stat.size, result });
      return result;
```

**Step 4: Update `_merge` to read from `cached.result` instead of `cached.*`**

In `_merge(cached, incremental)` (~line 437), every reference to `cached.tokensByModel`, `cached.compaction`, `cached.errors`, `cached.turnDurations`, `cached.usageExtras`, `cached.latestModel` must read from `cached.result?.*` instead. Concretely:

- `cached.tokensByModel` → `cached.result?.tokensByModel`
- `cached.compaction` → `cached.result?.compaction`
- `cached.errors` → `cached.result?.errors`
- `cached.turnDurations` → `cached.result?.turnDurations`
- `cached.usageExtras` → `cached.result?.usageExtras`
- `cached.thinkingBlockCount` → `cached.result?.thinkingBlockCount`
- `cached.latestModel` → `cached.result?.latestModel`

Use sed-style careful edits — there are about 10 such references. After editing, grep to verify:

Run:
```bash
grep -n "cached\.\(tokensByModel\|compaction\|errors\|turnDurations\|usageExtras\|thinkingBlockCount\|latestModel\)" server/lib/transcript-cache.js
```
Expected: 0 matches (all should now read `cached.result?.*`).

**Step 5: Delete now-unused clone helpers**

The methods `_cloneTokens`, `_cloneCompaction`, `_cloneUsageExtras` were only used to populate the duplicated top-level fields. With those gone, check if any caller remains:

Run:
```bash
grep -n "_cloneTokens\|_cloneCompaction\|_cloneUsageExtras" server/lib/transcript-cache.js
```
If only the method definitions match (no callers), delete the three methods.

If `_merge` still uses them for its internal computation, keep them — only delete if zero callers.

**Step 6: Run tests — verify pass**

Run: `node --test server/__tests__/transcript-cache-bounded.test.js`
Expected: all PASS (including the two new single-storage tests).

**Step 7: Run full suite — no regressions**

Run: `npm run test:server`
Expected: all green. Pay special attention to any `api.test.js` test that exercises `/api/hooks/event` end-to-end — it covers the integration with `routes/hooks.js` reading `result.errors`/`result.turnDurations`.

**Step 8: Commit**

```bash
git add server/lib/transcript-cache.js server/__tests__/transcript-cache-bounded.test.js
git commit -m "refactor(transcript-cache): collapse cache entry to {meta, result} only

Previously _set stored both top-level errors/turnDurations/compaction (shallow
copies via [...]) and the full result reference — so each array existed twice
in memory per cache entry. This commit makes cache entries hold only meta
(mtimeMs/size/bytesRead) plus the result reference, and updates _merge to
read prior state from cached.result.* instead of cached.*.

Memory per entry: ~50% reduction for entries with substantial errors or
turnDurations."
```

---

## Task 4: Add `sessions.transcript_path` column (idempotent migration)

**Files:**
- Modify: `server/db.js` (add migration block before line 320)
- Test: `server/__tests__/sessions-transcript-path-migration.test.js` (new file)

**Step 1: Write failing test**

Create `server/__tests__/sessions-transcript-path-migration.test.js`:

```js
/**
 * @file Verifies the idempotent ALTER TABLE migration adds a transcript_path
 * column to sessions and that a fresh db.js load on an existing DB does not
 * throw or duplicate the column.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

let TEST_DB;

before(() => {
  TEST_DB = path.join(os.tmpdir(), `dashboard-tp-migration-${Date.now()}-${process.pid}.db`);
  process.env.DASHBOARD_DB_PATH = TEST_DB;
});

after(() => {
  try { fs.unlinkSync(TEST_DB); } catch {}
  try { fs.unlinkSync(TEST_DB + "-wal"); } catch {}
  try { fs.unlinkSync(TEST_DB + "-shm"); } catch {}
});

describe("sessions.transcript_path migration", () => {
  it("adds transcript_path column on first load", () => {
    // Drop any cached require so this load runs all migrations afresh
    delete require.cache[require.resolve("../db")];
    const { db } = require("../db");
    const cols = db.prepare("PRAGMA table_info(sessions)").all();
    const names = cols.map((c) => c.name);
    assert.ok(names.includes("transcript_path"), `expected transcript_path; got: ${names.join(",")}`);
  });

  it("is idempotent — loading db.js a second time does not throw", () => {
    delete require.cache[require.resolve("../db")];
    assert.doesNotThrow(() => require("../db"));
  });

  it("transcript_path is nullable and accepts an UPDATE", () => {
    const { db, stmts } = require("../db");
    stmts.insertSession.run("s-tp-1", "name", "active", "/tmp/proj", "claude", null);
    db.prepare("UPDATE sessions SET transcript_path = ? WHERE id = ?").run("/tmp/foo.jsonl", "s-tp-1");
    const row = db.prepare("SELECT transcript_path FROM sessions WHERE id = ?").get("s-tp-1");
    assert.equal(row.transcript_path, "/tmp/foo.jsonl");
  });
});
```

**Step 2: Run test — verify it fails**

Run: `node --test server/__tests__/sessions-transcript-path-migration.test.js`
Expected: FAIL — column not present.

**Step 3: Add migration in `server/db.js`**

Open `server/db.js`. Find the existing migration block that adds `awaiting_input_since` (~line 252-267). Insert a new block **after** that one and **before** the `agents` CHECK-constraint rebuild block (~line 270):

```js
// Migrate: add `transcript_path` to sessions for fast active-session sweep.
// Before this, the periodic compaction sweep had to do
//   SELECT DISTINCT json_extract(events.data, '$.transcript_path') ...
// across the entire events table (250k+ rows in mature DBs). Storing the
// path on sessions lets the sweep query touch only active session rows.
// Backfilled once from the events table; thereafter populated by
// routes/hooks.js ensureSession() and the first event that carries
// transcript_path.
try {
  db.prepare("SELECT transcript_path FROM sessions LIMIT 1").get();
} catch {
  db.prepare("ALTER TABLE sessions ADD COLUMN transcript_path TEXT").run();
  // Backfill: pull the first transcript_path we can find in events for each
  // session. Uses a correlated subquery so SQLite limits the inner scan to
  // each session's rows (still bounded by events row count, but only runs
  // once per DB lifetime).
  db.prepare(
    `UPDATE sessions SET transcript_path = (
       SELECT json_extract(e.data, '$.transcript_path')
       FROM events e
       WHERE e.session_id = sessions.id
         AND json_extract(e.data, '$.transcript_path') IS NOT NULL
       LIMIT 1
     ) WHERE transcript_path IS NULL`
  ).run();
}

// Partial index for the periodic active-session sweep — covers only the
// handful of rows the sweep actually reads.
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_sessions_active_tp
   ON sessions(status, transcript_path)
   WHERE status='active' AND transcript_path IS NOT NULL`
);
```

**Step 4: Run test — verify pass**

Run: `node --test server/__tests__/sessions-transcript-path-migration.test.js`
Expected: all 3 subtests PASS.

**Step 5: Run full suite**

Run: `npm run test:server`
Expected: all green. Note: `api.test.js` creates its own test DB so it will trigger the migration too — confirm it still passes.

**Step 6: Commit**

```bash
git add server/db.js server/__tests__/sessions-transcript-path-migration.test.js
git commit -m "feat(db): add sessions.transcript_path column with idempotent migration

Adds a TEXT column to sessions and a one-time backfill from the events
table. Adds a partial index on (status, transcript_path) for active rows
to support the upcoming sweep query optimization.

The events table is untouched — this is purely additive on sessions.
Migration is idempotent via SELECT-LIMIT-1 / catch-ALTER, matching the
existing pattern at db.js:232-238."
```

---

## Task 5: Populate `sessions.transcript_path` from hooks ingestion

**Files:**
- Modify: `server/db.js` add `setSessionTranscriptPath` prepared statement (~line 405)
- Modify: `server/routes/hooks.js` `ensureSession` (~line 55-65) — write transcript_path when seen
- Test: `server/__tests__/sessions-transcript-path-migration.test.js` (extend with hooks integration)

**Step 1: Write failing test**

Append to `server/__tests__/sessions-transcript-path-migration.test.js`:

```js
describe("hooks ingestion populates sessions.transcript_path", () => {
  it("sets transcript_path on first event that carries it", async () => {
    delete require.cache[require.resolve("../db")];
    const { db, stmts } = require("../db");

    // Pre-create a session without transcript_path (simulate legacy state)
    stmts.insertSession.run("s-hook-1", "n", "active", "/tmp/proj", "claude", null);
    let row = db.prepare("SELECT transcript_path FROM sessions WHERE id = ?").get("s-hook-1");
    assert.equal(row.transcript_path, null);

    // Spin up app and POST a hook event with transcript_path
    delete require.cache[require.resolve("../index")];
    const { createApp, startServer } = require("../index");
    const app = createApp();
    const server = await startServer(app, 0);
    const port = server.address().port;

    const payload = JSON.stringify({
      hook_type: "PostToolUse",
      data: {
        session_id: "s-hook-1",
        transcript_path: "/tmp/somewhere/session.jsonl",
        cwd: "/tmp/proj",
      },
    });
    await new Promise((resolve, reject) => {
      const http = require("http");
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/hooks/event",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
        },
        (res) => { res.resume(); res.once("end", resolve); }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
    server.close();

    row = db.prepare("SELECT transcript_path FROM sessions WHERE id = ?").get("s-hook-1");
    assert.equal(row.transcript_path, "/tmp/somewhere/session.jsonl");
  });
});
```

**Step 2: Run test — verify it fails**

Run: `node --test server/__tests__/sessions-transcript-path-migration.test.js`
Expected: FAIL — `transcript_path` still null after the POST.

**Step 3: Add prepared statement**

In `server/db.js`, inside the `stmts` object (~line 388, just after `updateSessionModel`), add:

```js
  setSessionTranscriptPath: db.prepare(
    "UPDATE sessions SET transcript_path = ? WHERE id = ? AND (transcript_path IS NULL OR transcript_path = '')"
  ),
```

The `AND transcript_path IS NULL OR ''` guard makes this a one-shot write per session — subsequent events with the same path are no-ops at the SQL level.

**Step 4: Wire into `ensureSession`**

In `server/routes/hooks.js`, locate `ensureSession` (~line 55). After the `session = stmts.getSession.get(sessionId);` block (whether session was just created or already existed), add a transcript_path backfill. Insert at the end of the function body, just before `return session;`:

Find the function's end (the function returns `session` near line 130 or wherever). Add right before that return:

```js
  // First-seen transcript_path → write to session row so the sweep doesn't
  // have to scan events for it. Idempotent via the SQL guard.
  if (data.transcript_path) {
    stmts.setSessionTranscriptPath.run(data.transcript_path, sessionId);
  }
```

Verify the exact insertion site by reading lines 55-135 of `server/routes/hooks.js` first. The backfill must fire on **every** call to `ensureSession`, not just creation, so an already-existing legacy session without `transcript_path` gets backfilled on its next hook event.

**Step 5: Run test — verify pass**

Run: `node --test server/__tests__/sessions-transcript-path-migration.test.js`
Expected: the new hooks-ingestion subtest PASS.

**Step 6: Run full suite**

Run: `npm run test:server`
Expected: all green.

**Step 7: Commit**

```bash
git add server/db.js server/routes/hooks.js server/__tests__/sessions-transcript-path-migration.test.js
git commit -m "feat(hooks): persist transcript_path on sessions row from each hook event

Adds setSessionTranscriptPath prepared statement (one-shot via NULL/'' guard)
and wires it into ensureSession so every hook event with transcript_path
backfills the new column. Idempotent: only the first hook for a given session
writes, subsequent ones are SQL no-ops.

This is the prerequisite for replacing the events-table scan in the periodic
sweep (next commit)."
```

---

## Task 6: Switch periodic sweep to `sessions.transcript_path`

**Files:**
- Modify: `server/index.js` (~line 309 single-row lookup, ~line 329 active sweep)
- Test: `server/__tests__/transcript-path-sweep.test.js` (new file)

**Step 1: Write failing test**

Create `server/__tests__/transcript-path-sweep.test.js`:

```js
/**
 * @file Verifies the sweep queries used in server/index.js have been migrated
 * from json_extract(events.data,...) to sessions.transcript_path. Tests by
 * checking the SQL strings that appear in the file rather than running the
 * full setInterval — the unit-level guarantee is what matters here.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

describe("server/index.js sweep queries", () => {
  it("does NOT contain json_extract on events.data for transcript_path", () => {
    const matches = SRC.match(/json_extract\([^)]*events?\.data[^)]*transcript_path/gi) || [];
    assert.equal(
      matches.length,
      0,
      `expected zero events.data json_extract for transcript_path; found:\n${matches.join("\n")}`
    );
  });

  it("queries sessions.transcript_path for the active sweep", () => {
    assert.match(
      SRC,
      /FROM sessions[^;]*WHERE[^;]*status\s*=\s*'active'[^;]*transcript_path/is,
      "expected a SELECT from sessions with status='active' and transcript_path"
    );
  });
});
```

**Step 2: Run test — verify it fails**

Run: `node --test server/__tests__/transcript-path-sweep.test.js`
Expected: FAIL — the json_extract pattern is still present.

**Step 3: Rewrite the abandoned-session transcript_path lookup**

In `server/index.js` (~line 307-316), replace:

```js
        // Evict transcript cache for abandoned sessions to bound memory growth
        const tpRow = cleanupDb.db
          .prepare(
            "SELECT json_extract(data, '$.transcript_path') as tp FROM events WHERE session_id = ? AND json_extract(data, '$.transcript_path') IS NOT NULL LIMIT 1"
          )
          .get(s.id);
        if (tpRow?.tp) transcriptCache.invalidate(tpRow.tp);
```

with:

```js
        // Evict transcript cache for abandoned sessions to bound memory growth
        const tpRow = cleanupDb.db
          .prepare("SELECT transcript_path AS tp FROM sessions WHERE id = ?")
          .get(s.id);
        if (tpRow?.tp) transcriptCache.invalidate(tpRow.tp);
```

**Step 4: Rewrite the active-session compaction sweep**

In `server/index.js` (~line 327-332), replace:

```js
    // 2. Scan active sessions for new compaction entries
    const active = cleanupDb.db
      .prepare(
        "SELECT DISTINCT e.session_id, json_extract(e.data, '$.transcript_path') as tp FROM events e JOIN sessions s ON s.id = e.session_id WHERE s.status = 'active' AND json_extract(e.data, '$.transcript_path') IS NOT NULL GROUP BY e.session_id ORDER BY MAX(e.id) DESC"
      )
      .all();
```

with:

```js
    // 2. Scan active sessions for new compaction entries.
    // Reads from sessions.transcript_path (populated by hooks ensureSession +
    // one-time backfill in db.js migration) rather than scanning events —
    // O(active sessions) instead of O(events rows).
    const active = cleanupDb.db
      .prepare(
        "SELECT id AS session_id, transcript_path AS tp FROM sessions WHERE status = 'active' AND transcript_path IS NOT NULL ORDER BY updated_at DESC"
      )
      .all();
```

Verify the loop body that follows still references `row.session_id` and `row.tp` (it does — the alias names are preserved).

**Step 5: Run unit test — verify pass**

Run: `node --test server/__tests__/transcript-path-sweep.test.js`
Expected: both PASS.

**Step 6: Run full suite**

Run: `npm run test:server`
Expected: all green. Verify `api.test.js` end-to-end hook tests still work, since they exercise the same code path.

**Step 7: Commit**

```bash
git add server/index.js server/__tests__/transcript-path-sweep.test.js
git commit -m "perf(sweep): query sessions.transcript_path instead of scanning events

The periodic sweep used to do a full json_extract scan across the events
table (250k+ rows in mature DBs) every 60-300s. With the new
sessions.transcript_path column populated by hooks ingestion, both the
abandoned-session cache-eviction lookup and the active-session compaction
sweep now read from sessions — O(active sessions) instead of O(events).

Events table is unchanged; this is a query rewrite only."
```

---

## Task 7: Memory-soak test script (manual verification)

**Files:**
- Create: `scripts/memory-soak-test.js`
- Modify: `package.json` (add `soak` script entry)

This is a **manual** acceptance harness — not run by CI, but the canonical way to verify the leak is gone.

**Step 1: Create the soak script**

Create `scripts/memory-soak-test.js`:

```js
#!/usr/bin/env node

/**
 * Manual memory-soak verification for the TranscriptCache leak fix.
 *
 * Boots the server in-process on an ephemeral port, generates a fake
 * transcript jsonl with thousands of turn_duration entries, and fires
 * hook events at it for N minutes while sampling process.memoryUsage()
 * each minute.
 *
 * Expectation post-fix: RSS levels off well below 300 MB and does not
 * grow monotonically over the run.
 *
 * Usage:
 *   DURATION_MIN=30 node scripts/memory-soak-test.js
 *   TRANSCRIPT_CACHE_MAX_ARRAY_LEN=500 DURATION_MIN=10 node scripts/memory-soak-test.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "soak-"));
process.env.DASHBOARD_DB_PATH = path.join(TMP_DIR, "soak.db");
process.env.CLAUDE_HOME = TMP_DIR;

const DURATION_MIN = parseInt(process.env.DURATION_MIN || "30", 10);
const CONCURRENT_SESSIONS = parseInt(process.env.CONCURRENT_SESSIONS || "10", 10);
const TURNS_PER_SESSION = parseInt(process.env.TURNS_PER_SESSION || "10000", 10);
const HOOK_INTERVAL_MS = parseInt(process.env.HOOK_INTERVAL_MS || "1000", 10);

console.log(`[soak] DURATION_MIN=${DURATION_MIN} CONCURRENT=${CONCURRENT_SESSIONS} TURNS=${TURNS_PER_SESSION}`);
console.log(`[soak] data dir = ${TMP_DIR}`);

// Generate fake transcripts
const transcriptPaths = [];
for (let s = 0; s < CONCURRENT_SESSIONS; s++) {
  const p = path.join(TMP_DIR, `session-${s}.jsonl`);
  const lines = [];
  for (let i = 0; i < TURNS_PER_SESSION; i++) {
    lines.push(JSON.stringify({
      type: "system",
      subtype: "turn_duration",
      durationMs: 1000 + i,
      timestamp: new Date(Date.now() - (TURNS_PER_SESSION - i) * 1000).toISOString(),
    }));
  }
  fs.writeFileSync(p, lines.join("\n") + "\n");
  transcriptPaths.push(p);
}

const { createApp, startServer } = require("../server/index");
const app = createApp();

startServer(app, 0).then((server) => {
  const port = server.address().port;
  console.log(`[soak] server on :${port}`);

  // Fire hook events round-robin across sessions
  let tick = 0;
  const fireHook = () => {
    const idx = tick % CONCURRENT_SESSIONS;
    const payload = JSON.stringify({
      hook_type: "PostToolUse",
      data: {
        session_id: `soak-${idx}`,
        transcript_path: transcriptPaths[idx],
        cwd: TMP_DIR,
      },
    });
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/api/hooks/event", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => { res.resume(); }
    );
    req.on("error", () => {});
    req.write(payload);
    req.end();
    tick++;
  };
  const hookTimer = setInterval(fireHook, HOOK_INTERVAL_MS);

  // Sample memory every minute
  const samples = [];
  const sampleTimer = setInterval(() => {
    if (global.gc) global.gc();
    const m = process.memoryUsage();
    const sample = {
      minute: samples.length,
      rssMB: +(m.rss / 1024 / 1024).toFixed(1),
      heapMB: +(m.heapUsed / 1024 / 1024).toFixed(1),
      external: +(m.external / 1024 / 1024).toFixed(1),
    };
    samples.push(sample);
    console.log(`[soak] t=${sample.minute}m  rss=${sample.rssMB}MB  heap=${sample.heapMB}MB  external=${sample.external}MB`);
  }, 60_000);

  setTimeout(() => {
    clearInterval(hookTimer);
    clearInterval(sampleTimer);
    const first = samples[0];
    const last = samples[samples.length - 1];
    const growthMB = last && first ? last.rssMB - first.rssMB : 0;
    console.log(`[soak] DONE. RSS growth over ${DURATION_MIN}m: ${growthMB.toFixed(1)}MB`);
    if (growthMB > 50) {
      console.error(`[soak] FAIL — RSS grew by more than 50MB (likely leak still present)`);
      process.exit(1);
    }
    console.log(`[soak] PASS`);
    process.exit(0);
  }, DURATION_MIN * 60_000);
});
```

**Step 2: Add a convenience npm script**

In `package.json`, under `"scripts"`, add:

```json
"soak": "node --expose-gc scripts/memory-soak-test.js"
```

**Step 3: Smoke-run for 1 minute to confirm it works**

Run:
```bash
DURATION_MIN=1 HOOK_INTERVAL_MS=200 CONCURRENT_SESSIONS=3 TURNS_PER_SESSION=500 npm run soak
```

Expected output: one or two `[soak] t=*` lines, then `[soak] DONE`, then `[soak] PASS`. RSS growth in 1 min should be < 20 MB.

If it FAILs, investigate before continuing. The 1-min smoke isn't a real verification, just a sanity check that the harness wires up.

**Step 4: Commit**

```bash
git add scripts/memory-soak-test.js package.json
git commit -m "test(soak): add manual memory-soak harness for transcript-cache fix

scripts/memory-soak-test.js boots the server in-process, fires hook events
across N synthetic sessions backed by large transcript jsonl files, and
samples RSS each minute. Asserts RSS growth < 50 MB after the configured
duration.

Run via: DURATION_MIN=30 npm run soak"
```

---

## Task 8: Full real-run verification

This task has no code changes — it's the gating final verification.

**Step 1: Verify clean build**

Run:
```bash
npm run test:server
npm run mcp:typecheck
```
Expected: all green.

**Step 2: Verify DB migration on a real existing DB**

Make a backup copy of `data/dashboard.db` to `/tmp/`:
```bash
cp data/dashboard.db /tmp/dashboard.db.preupgrade.bak
```

Start the server briefly:
```bash
timeout 5 npm start || true
```

Verify the column was added and backfilled:
```bash
sqlite3 data/dashboard.db "PRAGMA table_info(sessions);" | grep transcript_path
sqlite3 data/dashboard.db "SELECT COUNT(*) FROM sessions WHERE transcript_path IS NOT NULL"
sqlite3 data/dashboard.db "SELECT COUNT(*) FROM sessions"
```

Expected:
- First line shows the `transcript_path TEXT` column.
- Backfilled count > 0 and ≤ total sessions count. (Sessions that never had a transcript_path in events will stay NULL; that's fine.)

**Step 3: Run the real 30-minute soak**

```bash
DURATION_MIN=30 npm run soak
```

Expected: `[soak] PASS` at the end, and per-minute RSS line should level off (not grow monotonically). Document the result.

**Step 4: Real UI smoke**

Run `npm run dev` and open `http://localhost:5173` (or wherever the dev server lives). Verify:
- Existing sessions list loads.
- Click into a session that has compactions / errors / turn durations — these still display.
- Trigger Claude in a real session, hooks land, UI updates in real time.

If anything is broken, **do not ship**. Diagnose and fix.

**Step 5: No commit** (this task is verification, no artifact).

---

## Task 9: Update docs and finalize

**Files:**
- Modify: `docs/superpowers/specs/2026-05-22-fix-transcript-cache-leak-design.md` — append a "Result" section.

**Step 1: Append result section to design doc**

Add to the bottom of `docs/superpowers/specs/2026-05-22-fix-transcript-cache-leak-design.md`:

```markdown

## Implementation Result (filled in after merge)

- Implementation plan: `docs/superpowers/plans/2026-05-22-fix-transcript-cache-leak-plan.md`
- Soak run result: RSS growth over 30 min = **___ MB** (target < 50 MB)
- Backfill stats on real DB: ___ / ___ sessions got transcript_path populated
- Commit range: `<first-commit>..<last-commit>`
- Known follow-ups: events table retention (out of scope) — track separately
```

Fill in the blanks from Task 8's real measurements.

**Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-22-fix-transcript-cache-leak-design.md
git commit -m "docs(plans): record transcript-cache leak fix result"
```

**Step 3: Final summary to user**

Print: commits added, files changed, soak result, any caveats.

---

## Done criteria checklist

- [ ] All 9 tasks complete with their commits in order.
- [ ] `npm run test:server` green at every commit.
- [ ] `npm run mcp:typecheck` green at the end.
- [ ] `npm run soak` (30 min) passes with RSS growth < 50 MB.
- [ ] `events` table row count and content **unchanged** before/after the migration (verify with `SELECT COUNT(*), MIN(id), MAX(id) FROM events` before and after).
- [ ] Real UI smoke confirms sessions/events/compactions/errors all still display.
- [ ] Design doc's "Implementation Result" section filled in.

## Rollback

Each task is a single commit; revert from the tip in reverse order if needed. The schema change (`ALTER TABLE sessions ADD COLUMN transcript_path`) is not reversible, but a column the code no longer references is harmless.
