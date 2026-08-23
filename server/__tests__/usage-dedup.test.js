/**
 * @file Tests that transcript token accounting counts each API response's
 * `usage` exactly once, using the LAST record per message.id. Claude Code
 * writes one JSONL record per content block, so a single response (one
 * message.id) appears as several records carrying the message's usage —
 * summing every record inflates token totals 2-4x, and the copies are not
 * always identical (streaming writes partial usage first, so the final
 * record is authoritative). Covers full reads, evolving usage, incremental
 * reads whose boundary splits a message's records, and id-less records
 * (still counted).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const TranscriptCache = require("../lib/transcript-cache");
const { USAGE_RECONCILE_WINDOW } = require("../lib/token-usage");

// The live cache sizes its reconciliation window from
// TRANSCRIPT_CACHE_MAX_ARRAY_LEN (same default as the shared constant), so the
// window tests below derive their fixture sizes from the effective value
// instead of hard-coding one.
const WINDOW = (() => {
  const raw = parseInt(process.env.TRANSCRIPT_CACHE_MAX_ARRAY_LEN, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : USAGE_RECONCILE_WINDOW;
})();

let tmpDir;
before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-dedup-"));
});
after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const USAGE_A = {
  input_tokens: 10,
  output_tokens: 100,
  cache_read_input_tokens: 5000,
  cache_creation_input_tokens: 300,
};
const USAGE_B = {
  input_tokens: 7,
  output_tokens: 40,
  cache_read_input_tokens: 2000,
  cache_creation_input_tokens: 0,
};

function assistantRecord(msgId, usage, blockType = "text") {
  return JSON.stringify({
    type: "assistant",
    timestamp: new Date().toISOString(),
    message: {
      id: msgId,
      model: "claude-test-1",
      usage,
      content: [{ type: blockType, [blockType === "text" ? "text" : "thinking"]: "x" }],
    },
  });
}

function totalsOf(result) {
  const buckets = Object.values(result.tokensByModel || {});
  assert.equal(buckets.length, 1, "expected a single model bucket");
  return buckets[0];
}

describe("usage dedup by message.id", () => {
  it("counts a message split across several records exactly once (full read)", () => {
    const p = path.join(tmpDir, "full.jsonl");
    fs.writeFileSync(
      p,
      [
        assistantRecord("msg_a", USAGE_A, "thinking"),
        assistantRecord("msg_a", USAGE_A),
        assistantRecord("msg_a", USAGE_A),
        assistantRecord("msg_b", USAGE_B),
      ].join("\n") + "\n"
    );
    const cache = new TranscriptCache();
    const t = totalsOf(cache.extract(p));
    assert.equal(t.output, USAGE_A.output_tokens + USAGE_B.output_tokens);
    assert.equal(t.cacheRead, USAGE_A.cache_read_input_tokens + USAGE_B.cache_read_input_tokens);
    assert.equal(t.input, USAGE_A.input_tokens + USAGE_B.input_tokens);
  });

  it("still counts thinking blocks on every record (blocks are distinct)", () => {
    const p = path.join(tmpDir, "blocks.jsonl");
    fs.writeFileSync(
      p,
      [assistantRecord("msg_a", USAGE_A, "thinking"), assistantRecord("msg_a", USAGE_A)].join(
        "\n"
      ) + "\n"
    );
    const cache = new TranscriptCache();
    const result = cache.extract(p);
    assert.equal(result.thinkingBlockCount, 1);
    assert.equal(totalsOf(result).output, USAGE_A.output_tokens);
  });

  it("uses the last record's usage when it evolves across records", () => {
    const p = path.join(tmpDir, "evolving.jsonl");
    const partial = { ...USAGE_A, output_tokens: 5, cache_read_input_tokens: 0 };
    fs.writeFileSync(
      p,
      [
        assistantRecord("msg_a", partial, "thinking"),
        assistantRecord("msg_a", USAGE_A), // final, authoritative
        assistantRecord("msg_b", USAGE_B),
      ].join("\n") + "\n"
    );
    const cache = new TranscriptCache();
    const t = totalsOf(cache.extract(p));
    assert.equal(t.output, USAGE_A.output_tokens + USAGE_B.output_tokens);
    assert.equal(t.cacheRead, USAGE_A.cache_read_input_tokens + USAGE_B.cache_read_input_tokens);
  });

  it("uses the final record when the evolution straddles an incremental boundary", () => {
    const p = path.join(tmpDir, "evolving-incremental.jsonl");
    const partial = { ...USAGE_A, output_tokens: 5, cache_read_input_tokens: 0 };
    fs.writeFileSync(p, assistantRecord("msg_a", partial) + "\n");
    const cache = new TranscriptCache();
    assert.equal(totalsOf(cache.extract(p)).output, 5);

    fs.appendFileSync(p, assistantRecord("msg_a", USAGE_A) + "\n");
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(p, later, later);

    const t = totalsOf(cache.extract(p));
    assert.equal(t.output, USAGE_A.output_tokens);
    assert.equal(t.cacheRead, USAGE_A.cache_read_input_tokens);
  });

  it("skips duplicates that straddle an incremental read boundary", () => {
    const p = path.join(tmpDir, "incremental.jsonl");
    fs.writeFileSync(p, assistantRecord("msg_a", USAGE_A) + "\n");
    const cache = new TranscriptCache();
    const first = totalsOf(cache.extract(p));
    assert.equal(first.output, USAGE_A.output_tokens);

    // Append the same message's remaining records plus a new message; bump
    // mtime so the stat-based cache sees growth and takes the incremental path.
    fs.appendFileSync(
      p,
      [assistantRecord("msg_a", USAGE_A), assistantRecord("msg_b", USAGE_B)].join("\n") + "\n"
    );
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(p, later, later);

    const t = totalsOf(cache.extract(p));
    assert.equal(t.output, USAGE_A.output_tokens + USAGE_B.output_tokens);
    assert.equal(t.cacheRead, USAGE_A.cache_read_input_tokens + USAGE_B.cache_read_input_tokens);
  });

  it("counts records without a message id unconditionally", () => {
    const p = path.join(tmpDir, "no-id.jsonl");
    fs.writeFileSync(
      p,
      [assistantRecord(undefined, USAGE_A), assistantRecord(undefined, USAGE_A)].join("\n") + "\n"
    );
    const cache = new TranscriptCache();
    const t = totalsOf(cache.extract(p));
    assert.equal(t.output, USAGE_A.output_tokens * 2);
  });
});

/**
 * Append `lines` one at a time, re-extracting after each — the pattern live
 * hook ingestion actually produces, where every record can land in its own
 * incremental read. Bumps mtime monotonically so the stat-based cache takes
 * the incremental path each time.
 */
function growLineByLine(cache, filePath, lines) {
  let clock = Date.now();
  let result = null;
  fs.writeFileSync(filePath, "");
  for (const line of lines) {
    fs.appendFileSync(filePath, line + "\n");
    clock += 1000;
    const stamp = new Date(clock);
    fs.utimesSync(filePath, stamp, stamp);
    result = cache.extract(filePath);
  }
  return result;
}

function bucketsOf(result) {
  return Object.values((result && result.tokensByModel) || {});
}

function sumField(result, field) {
  return bucketsOf(result).reduce((acc, b) => acc + (b[field] || 0), 0);
}

function negativeBuckets(result) {
  const bad = [];
  for (const b of bucketsOf(result)) {
    for (const field of ["input", "output", "cacheRead", "cacheWrite"]) {
      if ((b[field] || 0) < 0) bad.push(`${b.model}/${b.speed}/${b.geo}/${b.tier}.${field}`);
    }
  }
  return bad;
}

describe("usage reconciliation across incremental reads", () => {
  it("reconciles when every record lands in its own incremental read", () => {
    // The live hook pattern: a record is appended and the file re-read before
    // the next record exists, so a message's partial usage is already cached
    // when its final record arrives.
    const p = path.join(tmpDir, "grow.jsonl");
    const partial = { ...USAGE_A, output_tokens: 5, cache_read_input_tokens: 0 };
    const result = growLineByLine(new TranscriptCache(), p, [
      assistantRecord("msg_a", partial, "thinking"),
      assistantRecord("msg_a", partial),
      assistantRecord("msg_a", USAGE_A),
      assistantRecord("msg_b", USAGE_B),
    ]);

    assert.equal(sumField(result, "output"), USAGE_A.output_tokens + USAGE_B.output_tokens);
    assert.equal(
      sumField(result, "cacheRead"),
      USAGE_A.cache_read_input_tokens + USAGE_B.cache_read_input_tokens
    );
    assert.equal(sumField(result, "input"), USAGE_A.input_tokens + USAGE_B.input_tokens);
    assert.deepEqual(negativeBuckets(result), [], "no bucket may be written negative");

    // A full re-read of the same bytes must agree with the incremental result.
    const full = new TranscriptCache().extract(p);
    assert.equal(sumField(full, "output"), sumField(result, "output"));
  });

  it("nets a drifting pricing bucket to zero instead of going negative", () => {
    // A message whose partial record is priced in one bucket and whose final
    // record lands in another (service_tier drift). The retraction targets a
    // bucket that only exists in the CACHED result, so the incremental chunk
    // holds a transient negative that `_merge` must net out — nothing
    // negative may reach the DB writer.
    const p = path.join(tmpDir, "bucket-drift.jsonl");
    const partial = { ...USAGE_A, output_tokens: 5, service_tier: "standard" };
    const final = { ...USAGE_A, service_tier: "batch" };
    const result = growLineByLine(new TranscriptCache(), p, [
      assistantRecord("msg_a", partial),
      assistantRecord("msg_a", final),
    ]);

    assert.deepEqual(negativeBuckets(result), [], "a drifted bucket must not go negative");
    assert.equal(sumField(result, "output"), USAGE_A.output_tokens);
    assert.equal(sumField(result, "cacheRead"), USAGE_A.cache_read_input_tokens);

    const batch = bucketsOf(result).find((b) => b.tier === "batch");
    const standard = bucketsOf(result).find((b) => b.tier === "standard");
    assert.equal(batch.output, USAGE_A.output_tokens, "final usage belongs to the batch bucket");
    assert.equal(standard ? standard.output : 0, 0, "the abandoned bucket nets to zero");
  });

  it("starts from a clean reconciliation state when a transcript is rewritten", () => {
    // Compaction rewrites the file smaller; the cache falls back to a full
    // re-read, and no message id or bucket from the old content may survive.
    const p = path.join(tmpDir, "rewritten.jsonl");
    const cache = new TranscriptCache();
    let clock = Date.now();
    fs.writeFileSync(
      p,
      [
        assistantRecord("old_a", USAGE_A),
        assistantRecord("old_a", USAGE_A),
        assistantRecord("old_b", USAGE_B),
      ].join("\n") + "\n"
    );
    fs.utimesSync(p, new Date(clock), new Date(clock));
    assert.equal(
      sumField(cache.extract(p), "output"),
      USAGE_A.output_tokens + USAGE_B.output_tokens
    );

    fs.writeFileSync(
      p,
      [assistantRecord("new_c", USAGE_B), assistantRecord("new_c", USAGE_B)].join("\n") + "\n"
    );
    clock += 5000;
    fs.utimesSync(p, new Date(clock), new Date(clock));

    const after = cache.extract(p);
    assert.equal(sumField(after, "output"), USAGE_B.output_tokens, "only the new content counts");
    assert.deepEqual(negativeBuckets(after), []);
  });

  it("bounds the over-count when a message's records fall outside the window", () => {
    // The reconciliation window is a bounded tail (TRANSCRIPT_CACHE_MAX_ARRAY_LEN,
    // default 1000). Across every real transcript on record a message's records
    // are strictly ADJACENT, so the window never bites; this pins the failure
    // mode when it theoretically does — one un-retracted record, never
    // unbounded drift and never a negative bucket.
    const p = path.join(tmpDir, "window-evict.jsonl");
    const tiny = {
      input_tokens: 0,
      output_tokens: 1,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    const far = { ...tiny, output_tokens: 7 };
    // Derive the filler count from the EFFECTIVE window rather than hard-coding
    // it, so the expectation follows TRANSCRIPT_CACHE_MAX_ARRAY_LEN if the env
    // var is set or the default changes.
    const filler = WINDOW + 100;
    const lines = [assistantRecord("msg_far", far)];
    for (let i = 0; i < filler; i++) lines.push(assistantRecord(`filler_${i}`, tiny));
    lines.push(assistantRecord("msg_far", far));
    fs.writeFileSync(p, lines.join("\n") + "\n");

    const result = new TranscriptCache().extract(p);
    const correct = far.output_tokens + filler;
    assert.equal(
      sumField(result, "output"),
      correct + far.output_tokens,
      "exactly one record is double-counted past the window"
    );
    assert.deepEqual(negativeBuckets(result), []);
  });

  it("reconciles a message whose records stay inside the window", () => {
    // The complement of the test above: just inside the window, the earlier
    // record is still retractable and the message counts exactly once.
    const p = path.join(tmpDir, "window-inside.jsonl");
    const tiny = {
      input_tokens: 0,
      output_tokens: 1,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    const near = { ...tiny, output_tokens: 7 };
    // WINDOW - 1 fillers is the LARGEST separation that stays retractable: the
    // map then holds exactly WINDOW entries (msg_near plus the fillers) and
    // evicts nothing. Anything derived from a fraction of WINDOW would stop
    // testing the boundary — and would break outright at WINDOW = 1.
    const filler = Math.max(0, WINDOW - 1);
    const lines = [assistantRecord("msg_near", near)];
    for (let i = 0; i < filler; i++) lines.push(assistantRecord(`inside_${i}`, tiny));
    lines.push(assistantRecord("msg_near", near));
    fs.writeFileSync(p, lines.join("\n") + "\n");

    const result = new TranscriptCache().extract(p);
    assert.equal(sumField(result, "output"), near.output_tokens + filler);
    assert.deepEqual(negativeBuckets(result), []);
  });
});
