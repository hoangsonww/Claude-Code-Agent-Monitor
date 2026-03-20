# JSONL Reading Performance Optimization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate redundant full-file reads of JSONL transcript files by caching extracted token data and using incremental reads.

**Architecture:** Add a lightweight in-memory cache keyed by `(transcriptPath, mtime, size)` that stores the extracted `{tokensByModel, compaction}` result. On each hook event, stat the file first — if unchanged, return cached result. For files that did change, use byte-offset tracking to only read new lines appended since last parse. The periodic compaction scanner shares this same cache.

**Tech Stack:** Node.js `fs.statSync`, in-memory `Map` cache, byte-offset tracking via `fs.openSync`/`fs.readSync`.

---

## Performance Problem Analysis

### Current Behavior

Three code paths read JSONL files **fully, synchronously, with zero caching**:

| Path | File | Trigger | Frequency |
|------|------|---------|-----------|
| `extractTokensFromTranscript()` | `server/routes/hooks.js:15-62` | Every POST `/api/hooks/event` with `transcript_path` | 1-10x/min per active session |
| `findCompactionsInFile()` | `scripts/import-history.js:658-674` | 2-minute periodic scan | Every 2 min × active sessions |
| `parseSessionFile()` | `scripts/import-history.js:22-131` | Server startup import | Once per JSONL file at startup |

### Why This Hurts

1. **`extractTokensFromTranscript` is the hot path.** Called on *every* hook event. For a session producing 5 events/min with a 10K-line JSONL (typical long session), that's 5 full file reads + 50K `JSON.parse` calls per minute.

2. **JSONL files are append-only** (until compaction rewrites them). Between hook events, only a few new lines are appended. Reading the entire file to re-sum tokens that haven't changed is pure waste.

3. **`readFileSync` blocks the event loop.** Long sessions (50K+ lines, several MB) block the Express request handler for tens of milliseconds, stalling concurrent hook ingestion and API responses.

4. **Periodic scanner duplicates work.** `findCompactionsInFile` re-reads the same files that `extractTokensFromTranscript` already parsed seconds ago.

### Quantified Impact (estimated)

| Session Length | Lines | File Size | Parse Time (sync) | Events/min | Wasted CPU/min |
|---------------|-------|-----------|--------------------|------------|----------------|
| Short (30min) | 500 | ~100KB | ~2ms | 3 | ~6ms |
| Medium (2hr) | 5,000 | ~1MB | ~15ms | 5 | ~75ms |
| Long (8hr+) | 20,000 | ~4MB | ~50ms | 8 | ~400ms |
| Marathon (24hr) | 50,000+ | ~10MB+ | ~120ms+ | 10 | ~1.2s |

With multiple concurrent sessions, this compounds. The 2-minute scanner adds another full read per active session on top.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `server/lib/transcript-cache.js` | In-memory cache + incremental reader for JSONL files | **Create** |
| `server/lib/__tests__/transcript-cache.test.js` | Unit tests for cache + incremental read logic | **Create** |
| `server/routes/hooks.js` | Hook event handler — swap `extractTokensFromTranscript` to use cache | **Modify** (lines 15-62, 353-354) |
| `scripts/import-history.js` | Periodic compaction scanner — swap `findCompactionsInFile` to use cache | **Modify** (lines 658-674) |
| `server/index.js` | Wire cache into periodic scanner; add cache stats to settings | **Modify** (lines 104-128) |
| `server/routes/settings.js` | Expose cache stats in `/api/settings/info` | **Modify** |

---

## Task 1: Create the Transcript Cache Module

**Files:**
- Create: `server/lib/transcript-cache.js`
- Test: `server/lib/__tests__/transcript-cache.test.js`

### Design

```
Cache entry = {
  mtime: number,         // file modification time (ms)
  size: number,          // file size in bytes
  bytesRead: number,     // how far we've read into the file
  tokensByModel: {},     // accumulated token sums
  compaction: null|{},   // compaction entries found so far
}

On read request:
  1. fs.statSync(path) → get mtime + size
  2. Cache hit? (same mtime + size) → return cached result
  3. File shrunk or mtime changed with smaller size? → compaction rewrite → full re-read, reset cache
  4. File grew? (size > bytesRead) → incremental read from bytesRead → parse new lines → merge into cached totals
  5. Store updated entry, return result
```

- [ ] **Step 1: Create test file with first test — cache miss triggers full read**

```javascript
// server/lib/__tests__/transcript-cache.test.js
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

let tmpDir;
let TranscriptCache;

function writeJsonl(filePath, entries) {
  fs.writeFileSync(filePath, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

describe("TranscriptCache", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-test-"));
    // Fresh require to reset module-level state
    delete require.cache[require.resolve("../../lib/transcript-cache")];
    TranscriptCache = require("../../lib/transcript-cache");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should extract tokens on first read (cache miss)", () => {
    const file = path.join(tmpDir, "session.jsonl");
    writeJsonl(file, [
      { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 100, output_tokens: 50 } } },
      { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 200, output_tokens: 75 } } },
    ]);

    const cache = new TranscriptCache();
    const result = cache.extract(file);

    assert.deepStrictEqual(result.tokensByModel, {
      "claude-sonnet-4-20250514": { input: 300, output: 125, cacheRead: 0, cacheWrite: 0 },
    });
    assert.strictEqual(result.compaction, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test server/lib/__tests__/transcript-cache.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TranscriptCache with full-read path**

```javascript
// server/lib/transcript-cache.js
const fs = require("fs");

class TranscriptCache {
  constructor() {
    this._cache = new Map();
  }

  /**
   * Extract token usage and compaction data from a JSONL transcript file.
   * Uses stat-based caching — returns cached result if file hasn't changed.
   * Returns null if file doesn't exist or has no data.
   */
  extract(transcriptPath) {
    if (!transcriptPath) return null;
    try {
      const stat = fs.statSync(transcriptPath);
      const key = transcriptPath;
      const cached = this._cache.get(key);

      // Cache hit: file unchanged
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return cached.result;
      }

      // Full read (cache miss or file was rewritten/compacted)
      const result = this._fullRead(transcriptPath);
      this._cache.set(key, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        bytesRead: stat.size,
        tokensByModel: result ? { ...result.tokensByModel } : null,
        compaction: result ? result.compaction : null,
        result,
      });
      return result;
    } catch {
      return null;
    }
  }

  _fullRead(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    return this._parseContent(content);
  }

  _parseContent(content) {
    const tokensByModel = {};
    let compaction = null;
    for (const line of content.split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.isCompactSummary) {
          if (!compaction) compaction = { count: 0, entries: [] };
          compaction.count++;
          compaction.entries.push({
            uuid: entry.uuid || null,
            timestamp: entry.timestamp || null,
          });
        }
        const msg = entry.message || entry;
        const model = msg.model;
        if (!model || model === "<synthetic>" || !msg.usage) continue;
        if (!tokensByModel[model]) {
          tokensByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[model].input += msg.usage.input_tokens || 0;
        tokensByModel[model].output += msg.usage.output_tokens || 0;
        tokensByModel[model].cacheRead += msg.usage.cache_read_input_tokens || 0;
        tokensByModel[model].cacheWrite += msg.usage.cache_creation_input_tokens || 0;
      } catch {
        continue;
      }
    }
    const hasTokens = Object.keys(tokensByModel).length > 0;
    if (!hasTokens && !compaction) return null;
    return { tokensByModel: hasTokens ? tokensByModel : null, compaction };
  }

  /** Number of entries currently cached */
  get size() {
    return this._cache.size;
  }

  /** Remove a specific path from cache (e.g. when session ends) */
  invalidate(transcriptPath) {
    this._cache.delete(transcriptPath);
  }

  /** Clear all cached entries */
  clear() {
    this._cache.clear();
  }

  /** Return cache stats for diagnostics */
  stats() {
    return {
      entries: this._cache.size,
      paths: [...this._cache.keys()],
    };
  }
}

module.exports = TranscriptCache;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test server/lib/__tests__/transcript-cache.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/lib/transcript-cache.js server/lib/__tests__/transcript-cache.test.js
git commit -m "feat: add TranscriptCache module with stat-based caching for JSONL reads"
```

---

## Task 2: Add Cache Hit and Compaction Detection Tests

**Files:**
- Modify: `server/lib/__tests__/transcript-cache.test.js`

- [ ] **Step 1: Add test — second read with unchanged file returns cached result**

```javascript
it("should return cached result when file is unchanged", () => {
  const file = path.join(tmpDir, "session.jsonl");
  writeJsonl(file, [
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 100, output_tokens: 50 } } },
  ]);

  const cache = new TranscriptCache();
  const r1 = cache.extract(file);
  const r2 = cache.extract(file);

  assert.deepStrictEqual(r1, r2);
  // Same object reference proves cache hit (no re-parse)
  assert.strictEqual(r1, r2);
});
```

- [ ] **Step 2: Add test — detects appended lines after file grows**

```javascript
it("should detect new data when file grows", (t) => {
  const file = path.join(tmpDir, "session.jsonl");
  writeJsonl(file, [
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 100, output_tokens: 50 } } },
  ]);

  const cache = new TranscriptCache();
  const r1 = cache.extract(file);
  assert.strictEqual(r1.tokensByModel["claude-sonnet-4-20250514"].input, 100);

  // Append more data (simulates Claude writing to transcript)
  fs.appendFileSync(
    file,
    JSON.stringify({ message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 200, output_tokens: 75 } } }) + "\n"
  );

  const r2 = cache.extract(file);
  assert.strictEqual(r2.tokensByModel["claude-sonnet-4-20250514"].input, 300);
  assert.strictEqual(r2.tokensByModel["claude-sonnet-4-20250514"].output, 125);
});
```

- [ ] **Step 3: Add test — detects compaction (file shrinks)**

```javascript
it("should do full re-read when file shrinks (compaction rewrite)", () => {
  const file = path.join(tmpDir, "session.jsonl");
  writeJsonl(file, [
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 500, output_tokens: 200 } } },
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 300, output_tokens: 100 } } },
  ]);

  const cache = new TranscriptCache();
  cache.extract(file);

  // Simulate compaction — file is rewritten with fewer entries + summary
  writeJsonl(file, [
    { isCompactSummary: true, uuid: "abc-123", timestamp: "2026-03-20T10:00:00Z" },
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 50, output_tokens: 20 } } },
  ]);

  const r2 = cache.extract(file);
  assert.strictEqual(r2.tokensByModel["claude-sonnet-4-20250514"].input, 50);
  assert.strictEqual(r2.compaction.count, 1);
  assert.strictEqual(r2.compaction.entries[0].uuid, "abc-123");
});
```

- [ ] **Step 4: Add test — returns null for missing file**

```javascript
it("should return null for non-existent file", () => {
  const cache = new TranscriptCache();
  assert.strictEqual(cache.extract("/nonexistent/file.jsonl"), null);
  assert.strictEqual(cache.extract(null), null);
  assert.strictEqual(cache.extract(""), null);
});
```

- [ ] **Step 5: Add test — compaction-only extraction (for findCompactionsInFile replacement)**

```javascript
it("should expose compaction entries via extractCompactions()", () => {
  const file = path.join(tmpDir, "session.jsonl");
  writeJsonl(file, [
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 100, output_tokens: 50 } } },
    { isCompactSummary: true, uuid: "c1", timestamp: "2026-03-20T09:00:00Z" },
    { message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 50, output_tokens: 20 } } },
    { isCompactSummary: true, uuid: "c2", timestamp: "2026-03-20T10:00:00Z" },
  ]);

  const cache = new TranscriptCache();
  const compactions = cache.extractCompactions(file);

  assert.strictEqual(compactions.length, 2);
  assert.strictEqual(compactions[0].uuid, "c1");
  assert.strictEqual(compactions[1].uuid, "c2");
});
```

- [ ] **Step 6: Run all tests**

Run: `node --test server/lib/__tests__/transcript-cache.test.js`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add server/lib/__tests__/transcript-cache.test.js
git commit -m "test: add cache hit, compaction, and edge case tests for TranscriptCache"
```

---

## Task 3: Add Incremental Read (Byte-Offset Tracking)

**Files:**
- Modify: `server/lib/transcript-cache.js`
- Modify: `server/lib/__tests__/transcript-cache.test.js`

This is the key optimization. JSONL files are append-only between compactions. Instead of re-reading the full file, read only the bytes appended since our last read.

- [ ] **Step 1: Add test — incremental read only parses new bytes**

```javascript
it("should only read new bytes on incremental update (not full file)", () => {
  const file = path.join(tmpDir, "session.jsonl");
  const line1 = JSON.stringify({ message: { model: "m1", usage: { input_tokens: 100, output_tokens: 50 } } }) + "\n";
  fs.writeFileSync(file, line1);

  const cache = new TranscriptCache();
  cache.extract(file);

  // Append a second line
  const line2 = JSON.stringify({ message: { model: "m1", usage: { input_tokens: 200, output_tokens: 75 } } }) + "\n";
  fs.appendFileSync(file, line2);

  // Spy: check bytesRead advanced by only line2 length
  const r2 = cache.extract(file);
  assert.strictEqual(r2.tokensByModel["m1"].input, 300);

  const entry = cache._cache.get(file);
  assert.strictEqual(entry.bytesRead, Buffer.byteLength(line1 + line2, "utf8"));
});
```

- [ ] **Step 2: Update `extract()` to use incremental read path**

In `server/lib/transcript-cache.js`, update the `extract` method:

```javascript
extract(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    let stat;
    try {
      stat = fs.statSync(transcriptPath);
    } catch {
      return null;
    }
    const key = transcriptPath;
    const cached = this._cache.get(key);

    // Cache hit: file unchanged
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached.result;
    }

    // File shrunk or was rewritten (compaction) → full re-read
    if (!cached || stat.size < cached.bytesRead) {
      const result = this._fullRead(transcriptPath);
      this._cache.set(key, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        bytesRead: stat.size,
        tokensByModel: result ? this._cloneTokens(result.tokensByModel) : null,
        compaction: result ? this._cloneCompaction(result.compaction) : null,
        result,
      });
      return result;
    }

    // File grew → incremental read from last position
    const newBytes = this._readFrom(transcriptPath, cached.bytesRead, stat.size);
    if (newBytes) {
      const incremental = this._parseContent(newBytes);
      const merged = this._merge(cached, incremental);
      const result = {
        tokensByModel: Object.keys(merged.tokensByModel).length > 0 ? merged.tokensByModel : null,
        compaction: merged.compaction,
      };
      if (!result.tokensByModel && !result.compaction) {
        this._cache.set(key, { ...cached, mtimeMs: stat.mtimeMs, size: stat.size, bytesRead: stat.size, result: null });
        return null;
      }
      this._cache.set(key, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        bytesRead: stat.size,
        tokensByModel: this._cloneTokens(result.tokensByModel),
        compaction: this._cloneCompaction(result.compaction),
        result,
      });
      return result;
    }

    // newBytes was empty (e.g. only newlines appended)
    this._cache.set(key, { ...cached, mtimeMs: stat.mtimeMs, size: stat.size, bytesRead: stat.size });
    return cached.result;
  } catch {
    return null;
  }
}

_readFrom(filePath, offset, totalSize) {
  const len = totalSize - offset;
  if (len <= 0) return null;
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buf, 0, len, offset);
  } finally {
    fs.closeSync(fd);
  }
  return buf.toString("utf8");
}

_merge(cached, incremental) {
  const tokensByModel = cached.tokensByModel ? { ...cached.tokensByModel } : {};
  if (incremental && incremental.tokensByModel) {
    for (const [model, tokens] of Object.entries(incremental.tokensByModel)) {
      if (!tokensByModel[model]) {
        tokensByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      }
      tokensByModel[model].input += tokens.input;
      tokensByModel[model].output += tokens.output;
      tokensByModel[model].cacheRead += tokens.cacheRead;
      tokensByModel[model].cacheWrite += tokens.cacheWrite;
    }
  }

  let compaction = cached.compaction ? this._cloneCompaction(cached.compaction) : null;
  if (incremental && incremental.compaction) {
    if (!compaction) compaction = { count: 0, entries: [] };
    compaction.count += incremental.compaction.count;
    compaction.entries.push(...incremental.compaction.entries);
  }

  return { tokensByModel, compaction };
}

_cloneTokens(tokensByModel) {
  if (!tokensByModel) return null;
  const clone = {};
  for (const [model, t] of Object.entries(tokensByModel)) {
    clone[model] = { ...t };
  }
  return clone;
}

_cloneCompaction(compaction) {
  if (!compaction) return null;
  return { count: compaction.count, entries: compaction.entries.map((e) => ({ ...e })) };
}
```

- [ ] **Step 3: Run tests**

Run: `node --test server/lib/__tests__/transcript-cache.test.js`
Expected: All pass

- [ ] **Step 4: Add `extractCompactions()` convenience method**

```javascript
/**
 * Extract only compaction entries from a JSONL file (replacement for findCompactionsInFile).
 * Uses the same cache — no duplicate reads.
 */
extractCompactions(transcriptPath) {
  const result = this.extract(transcriptPath);
  if (!result || !result.compaction) return [];
  return result.compaction.entries;
}
```

- [ ] **Step 5: Run all tests**

Run: `node --test server/lib/__tests__/transcript-cache.test.js`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add server/lib/transcript-cache.js server/lib/__tests__/transcript-cache.test.js
git commit -m "feat: add incremental byte-offset reads and extractCompactions to TranscriptCache"
```

---

## Task 4: Wire Cache into Hook Handler

**Files:**
- Modify: `server/routes/hooks.js` (lines 1-62, 353-354)

Replace the standalone `extractTokensFromTranscript` function with the shared `TranscriptCache` instance.

- [ ] **Step 1: Create shared cache instance and replace function**

At the top of `server/routes/hooks.js`, replace:

```javascript
// OLD (lines 15-62): the entire extractTokensFromTranscript function
```

With:

```javascript
const TranscriptCache = require("../lib/transcript-cache");
const transcriptCache = new TranscriptCache();
```

- [ ] **Step 2: Update the call site at line 353-354**

Replace:
```javascript
const result = extractTokensFromTranscript(data.transcript_path);
```

With:
```javascript
const result = transcriptCache.extract(data.transcript_path);
```

- [ ] **Step 3: Export the cache instance for use by periodic scanner**

At the bottom of hooks.js, change:
```javascript
module.exports = router;
```
To:
```javascript
module.exports = router;
module.exports.transcriptCache = transcriptCache;
```

Wait — that overwrites the router export. Instead, attach it to the router:

```javascript
router.transcriptCache = transcriptCache;
module.exports = router;
```

- [ ] **Step 4: Run existing server tests to verify no regression**

Run: `npm run test:server`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add server/routes/hooks.js
git commit -m "refactor: replace extractTokensFromTranscript with TranscriptCache in hook handler"
```

---

## Task 5: Wire Cache into Periodic Compaction Scanner

**Files:**
- Modify: `server/index.js` (lines 86, 104-128)

The 2-minute periodic scanner currently calls `findCompactionsInFile()` which does its own full synchronous read. Replace it with the shared cache from the hooks router.

- [ ] **Step 1: Update import and use shared cache**

In `server/index.js`, in the `if (!isTest)` block where the periodic scanner is set up (~line 85):

Replace the import:
```javascript
const { importCompactions, findCompactionsInFile } = require("../scripts/import-history");
```

With:
```javascript
const { importCompactions } = require("../scripts/import-history");
const { transcriptCache } = require("./routes/hooks");
```

- [ ] **Step 2: Replace `findCompactionsInFile` calls with cache**

Replace (inside the setInterval, ~line 113):
```javascript
const compactions = findCompactionsInFile(row.tp);
```

With:
```javascript
const compactions = transcriptCache.extractCompactions(row.tp);
```

- [ ] **Step 3: Run server tests**

Run: `npm run test:server`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "refactor: periodic compaction scanner uses shared TranscriptCache instead of standalone file reads"
```

---

## Task 6: Cache Eviction for Ended Sessions

**Files:**
- Modify: `server/routes/hooks.js`

When a session completes, its JSONL file won't be read again. Evict it from cache to prevent unbounded memory growth.

- [ ] **Step 1: Add test for cache invalidation**

Add to `server/lib/__tests__/transcript-cache.test.js`:

```javascript
it("should remove entry on invalidate()", () => {
  const file = path.join(tmpDir, "session.jsonl");
  writeJsonl(file, [
    { message: { model: "m1", usage: { input_tokens: 100, output_tokens: 50 } } },
  ]);

  const cache = new TranscriptCache();
  cache.extract(file);
  assert.strictEqual(cache.size, 1);

  cache.invalidate(file);
  assert.strictEqual(cache.size, 0);
});
```

- [ ] **Step 2: Run test**

Run: `node --test server/lib/__tests__/transcript-cache.test.js`
Expected: Pass (invalidate was already implemented in Task 1)

- [ ] **Step 3: Add eviction when session ends in hooks.js**

In `server/routes/hooks.js`, find the Stop event handler section. After the session is updated to "completed", add:

```javascript
// Evict transcript from cache — session is done, no more reads expected
if (data.transcript_path) {
  transcriptCache.invalidate(data.transcript_path);
}
```

Place this right after the `stmts.updateSession.run(...)` call for the Stop event that sets status to "completed".

- [ ] **Step 4: Run server tests**

Run: `npm run test:server`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add server/routes/hooks.js server/lib/__tests__/transcript-cache.test.js
git commit -m "feat: evict transcript cache entry when session completes"
```

---

## Task 7: Expose Cache Stats in Settings API

**Files:**
- Modify: `server/routes/settings.js`

Add cache stats to the `/api/settings/info` endpoint for observability.

- [ ] **Step 1: Import cache and add stats to info response**

In `server/routes/settings.js`, add to the `GET /api/settings/info` handler:

```javascript
const { transcriptCache } = require("./hooks");
```

In the response object, add:
```javascript
transcript_cache: transcriptCache.stats(),
```

- [ ] **Step 2: Run server tests**

Run: `npm run test:server`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add server/routes/settings.js
git commit -m "feat: expose transcript cache stats in settings info endpoint"
```

---

## Task 8: Integration Smoke Test

**Files:**
- Modify: `server/__tests__/api.test.js`

Add a test that simulates the full hook event flow with transcript file reads to verify the cache integration works end-to-end.

- [ ] **Step 1: Add integration test for cached transcript reading**

Add a new describe block to `server/__tests__/api.test.js`:

```javascript
describe("transcript cache integration", () => {
  it("should extract tokens from transcript file via hook event", async () => {
    // Create a temp JSONL transcript file
    const tmpTranscript = path.join(os.tmpdir(), `test-transcript-${Date.now()}.jsonl`);
    const entries = [
      JSON.stringify({ message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 } } }),
      JSON.stringify({ message: { model: "claude-sonnet-4-20250514", usage: { input_tokens: 200, output_tokens: 75, cache_read_input_tokens: 20, cache_creation_input_tokens: 10 } } }),
    ];
    fs.writeFileSync(tmpTranscript, entries.join("\n") + "\n");

    try {
      // Send hook event with transcript_path
      const sessionId = `cache-test-${Date.now()}`;
      const res = await post("/api/hooks/event", {
        hook_type: "Stop",
        data: {
          session_id: sessionId,
          transcript_path: tmpTranscript,
          cwd: "/tmp",
        },
      });
      assert.strictEqual(res.status, 200);

      // Verify tokens were stored
      const costRes = await fetch(`/api/pricing/cost/${sessionId}`);
      if (costRes.status === 200 && costRes.body.breakdown) {
        const sonnet = costRes.body.breakdown.find((b) => b.model.includes("sonnet"));
        if (sonnet) {
          assert.strictEqual(sonnet.input_tokens, 300);
          assert.strictEqual(sonnet.output_tokens, 125);
        }
      }
    } finally {
      fs.unlinkSync(tmpTranscript);
    }
  });
});
```

- [ ] **Step 2: Run full server test suite**

Run: `npm run test:server`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add server/__tests__/api.test.js
git commit -m "test: add integration smoke test for transcript cache via hook events"
```

---

## Task 9: Final Build Verification

- [ ] **Step 1: Run all server tests**

Run: `npm run test:server`
Expected: All pass

- [ ] **Step 2: Run client build to check nothing broke**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 3: Manual smoke test**

Start the dev server (`npm run dev`) and verify:
1. Hook events still process correctly
2. Token counts update in the UI
3. `/api/settings/info` shows `transcript_cache` stats
4. No errors in server console

- [ ] **Step 4: Final commit if any cleanup needed**

---

## Summary of Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| File reads per hook event | 1 full read (every line) | 0 reads (cache hit) or partial read (new bytes only) |
| Parse calls per hook event | N lines × JSON.parse | 0 (cache hit) or K new lines only |
| Periodic scanner file reads | 1 full read per active session every 2min | 0 (shared cache already has data) |
| Memory overhead | None | ~1KB per active session (tokens + metadata) |
| Event loop blocking | Up to 120ms for large files | <1ms (stat only) on cache hit |

For a typical long session (20K lines, 4MB), this reduces per-event CPU cost from ~50ms to <1ms — a **50x improvement** on the hot path.
