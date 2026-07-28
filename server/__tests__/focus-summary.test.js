/**
 * @file Tests for the stakeholder window-summary layer: the pure helpers in
 * server/lib/focus-summary.js (prompt building, envelope parsing, input
 * digest, bullet-budget scaling, local-day chunking, the recency-biased
 * session cap), `generateWindowSummary`'s digest-gated caching (generate
 * once, serve cached while the underlying data is unchanged, regenerate
 * when it changes), the hierarchical multi-day path (per-day map summaries
 * cached under scope-qualified keys, one rollup reduce, zero-spawn serving
 * of an unchanged window, failed days degrading to raw fact lines), and the
 * `GET /api/focus-report/summary` route contract — shared validation with
 * GET /api/focus-report, `{ summary: null }` (200, never an error) when the
 * LLM path is off/unavailable or the window is empty, and the success
 * envelope. Uses focus-inference's `__injectSpawnForTest` seam, so no real
 * `claude` CLI is ever spawned.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-focus-summary-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_FOCUS_IDLE_GRACE_SECONDS = "0";

const { createApp, startServer } = require("../index");
const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  generateWindowSummary,
  buildWindowSummaryPrompt,
  parseWindowSummaryOutput,
  computeInputDigest,
  bulletBudget,
  localDayChunks,
} = require("../lib/focus-summary");
const { buildProjectFocusReport } = require("../lib/focus-report");
const { __injectSpawnForTest } = require("../lib/focus-inference");

let server;
let BASE;

// --- HTTP helper, copied per this repo's own one-helper-per-file convention
// (see server/__tests__/focus-report-route.test.js) rather than cross-imported. ---
function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || "GET",
      headers: { "Content-Type": "application/json", ...options.headers },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

/** Fake ChildProcess factory: exits with the given stdout after a tick. */
function fakeSpawn({ exitCode = 0, stdout = "" } = {}) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stderr.resume = () => {};
    child.kill = () => {};
    setImmediate(() => {
      if (stdout) child.stdout.emit("data", stdout);
      child.emit("exit", exitCode);
    });
    return child;
  };
}

/** LLM envelope the `claude -p --output-format json` spawn would print. */
function envelope(result) {
  return JSON.stringify({ result: JSON.stringify(result) });
}

/**
 * Sequenced fake spawn: `claude --version` probes always succeed; each
 * `claude -p …` call consumes the next queued response ({stdout} or
 * {exitCode}). Records every `-p` call's args in `calls` for assertions.
 */
function fakeSpawnSequence(responses) {
  const queue = [...responses];
  const calls = [];
  const impl = (cmd, args) => {
    const isProbe = Array.isArray(args) && args.includes("--version");
    const spec = isProbe ? { exitCode: 0, stdout: "" } : (queue.shift() ?? { exitCode: 1 });
    if (!isProbe) calls.push(args);
    return fakeSpawn(spec)();
  };
  return { impl, calls };
}

/** Minimal report shape carrying only what the summary layer reads. */
function fakeReport(sessions) {
  return { sessions };
}

function seg(overrides = {}) {
  return {
    kind: "none",
    item_number: null,
    label: null,
    inferred_reason: "did some work",
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-01T01:00:00.000Z",
    wall_ms: 3_600_000,
    active_ms: 1_800_000,
    idle_ms: 1_800_000,
    inferred: true,
    ...overrides,
  };
}

const setSessionTimesRaw = db.prepare(
  "UPDATE sessions SET started_at = ?, ended_at = ? WHERE id = ?"
);

function seedSession(id, cwd, startedAt, endedAt) {
  stmts.insertSession.run(id, "Summary Test", "active", cwd, "claude-opus-4-8", null);
  setSessionTimesRaw.run(startedAt, endedAt, id);
}

function dayIso(hour = 0, minute = 0) {
  return new Date(Date.UTC(2026, 0, 1, hour, minute, 0)).toISOString();
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  const addr = server.address();
  BASE = `http://127.0.0.1:${addr.port}`;
});

after(() => {
  __injectSpawnForTest(null);
  server?.close();
  try {
    db.close();
  } catch {
    /* already closed */
  }
});

beforeEach(() => {
  __injectSpawnForTest(null);
  delete process.env.DASHBOARD_FOCUS_INFER_MODE;
  delete process.env.DASHBOARD_FOCUS_SUMMARY_MODEL;
  db.exec("DELETE FROM focus_summaries");
});

describe("parseWindowSummaryOutput", () => {
  it("parses a clean bullets envelope", () => {
    const out = parseWindowSummaryOutput(envelope({ bullets: ["Did a thing.", "Did another."] }));
    assert.deepEqual(out, ["Did a thing.", "Did another."]);
  });

  it("strips markdown code fences around the inner JSON", () => {
    const inner = '```json\n{"bullets": ["Fenced bullet."]}\n```';
    const out = parseWindowSummaryOutput(JSON.stringify({ result: inner }));
    assert.deepEqual(out, ["Fenced bullet."]);
  });

  it("returns null for garbage, a missing list, and an empty/blank list", () => {
    assert.equal(parseWindowSummaryOutput("not json"), null);
    assert.equal(parseWindowSummaryOutput(envelope({ nope: true })), null);
    assert.equal(parseWindowSummaryOutput(envelope({ bullets: [] })), null);
    assert.equal(parseWindowSummaryOutput(envelope({ bullets: ["  ", 42] })), null);
  });

  it("caps at 4 bullets and drops non-string entries", () => {
    const out = parseWindowSummaryOutput(envelope({ bullets: ["a", 1, "b", "c", "d", "e"] }));
    assert.deepEqual(out, ["a", "b", "c", "d"]);
  });
});

describe("computeInputDigest", () => {
  it("is stable for an unchanged report and changes when a reason changes", () => {
    const r1 = fakeReport([{ name: "s1", segments: [seg()] }]);
    const r2 = fakeReport([{ name: "s1", segments: [seg()] }]);
    assert.equal(computeInputDigest(r1), computeInputDigest(r2));

    const r3 = fakeReport([{ name: "s1", segments: [seg({ inferred_reason: "different" })] }]);
    assert.notEqual(computeInputDigest(r1), computeInputDigest(r3));
  });
});

describe("buildWindowSummaryPrompt", () => {
  it("includes each segment's story, kind and time, and the JSON-only instruction", () => {
    const prompt = buildWindowSummaryPrompt(
      fakeReport([
        { name: "eng-mgr", segments: [seg({ inferred_reason: "found the IDOR vuln" })] },
        {
          name: "planner",
          segments: [
            seg({ kind: "item", item_number: 3, label: "Ship exports", inferred_reason: null }),
          ],
        },
      ])
    );
    assert.match(prompt, /eng-mgr/);
    assert.match(prompt, /found the IDOR vuln/);
    assert.match(prompt, /plan item 3 \(Ship exports\)/);
    assert.match(prompt, /1h 0m wall \/ 30m active/);
    assert.match(prompt, /ONLY JSON/);
  });
});

describe("generateWindowSummary caching", () => {
  it("generates once, then serves the cache while the input digest is unchanged", async () => {
    __injectSpawnForTest(fakeSpawn({ stdout: envelope({ bullets: ["First synthesis."] }) }));
    const report = fakeReport([{ name: "s1", segments: [seg()] }]);

    const first = await generateWindowSummary(dbModule, "key-a", report);
    assert.deepEqual(first.bullets, ["First synthesis."]);
    assert.equal(first.cached, false);

    // Any further spawn attempt would blow up — proving the cache is served.
    __injectSpawnForTest(() => {
      throw new Error("no LLM call expected on a cache hit");
    });
    const second = await generateWindowSummary(dbModule, "key-a", report);
    assert.deepEqual(second.bullets, ["First synthesis."]);
    assert.equal(second.cached, true);
  });

  it("regenerates when the underlying report data changes", async () => {
    __injectSpawnForTest(fakeSpawn({ stdout: envelope({ bullets: ["Old story."] }) }));
    const report = fakeReport([{ name: "s1", segments: [seg()] }]);
    await generateWindowSummary(dbModule, "key-b", report);

    __injectSpawnForTest(fakeSpawn({ stdout: envelope({ bullets: ["New story."] }) }));
    const changed = fakeReport([
      { name: "s1", segments: [seg({ inferred_reason: "something new happened" })] },
    ]);
    const result = await generateWindowSummary(dbModule, "key-b", changed);
    assert.deepEqual(result.bullets, ["New story."]);
    assert.equal(result.cached, false);
  });

  it("spawns with DASHBOARD_FOCUS_SUMMARY_MODEL when set and records it as the stored model", async () => {
    process.env.DASHBOARD_FOCUS_SUMMARY_MODEL = "sonnet";
    const spawnedArgs = [];
    const inner = fakeSpawn({ stdout: envelope({ bullets: ["Sonnet-written bullet."] }) });
    __injectSpawnForTest((cmd, args) => {
      spawnedArgs.push(args);
      return inner();
    });

    const report = fakeReport([{ name: "s1", segments: [seg()] }]);
    const result = await generateWindowSummary(dbModule, "key-model", report);
    assert.deepEqual(result.bullets, ["Sonnet-written bullet."]);
    assert.equal(result.model, "sonnet");

    // The `-p` synthesis spawn (not the `--version` probe) carries the override.
    const promptArgs = spawnedArgs.find((a) => a.includes("-p"));
    assert.equal(promptArgs[promptArgs.indexOf("--model") + 1], "sonnet");
  });

  it("returns null for an empty window, a non-llm mode, and a failed call", async () => {
    assert.equal(await generateWindowSummary(dbModule, "key-c", fakeReport([])), null);

    process.env.DASHBOARD_FOCUS_INFER_MODE = "heuristic";
    const report = fakeReport([{ name: "s1", segments: [seg()] }]);
    assert.equal(await generateWindowSummary(dbModule, "key-c", report), null);

    delete process.env.DASHBOARD_FOCUS_INFER_MODE;
    __injectSpawnForTest(fakeSpawn({ exitCode: 1 })); // probe fails -> unavailable
    assert.equal(await generateWindowSummary(dbModule, "key-c", report), null);
  });
});

describe("bulletBudget / localDayChunks", () => {
  it("scales the bullet budget with the window's day span", () => {
    assert.equal(bulletBudget(1), 4);
    assert.equal(bulletBudget(2), 4);
    assert.equal(bulletBudget(3), 6);
    assert.equal(bulletBudget(7), 6);
    assert.equal(bulletBudget(8), 8);
    assert.equal(bulletBudget(21), 8);
  });

  it("splits a window at local midnights, honoring partial edge days", () => {
    const from = new Date(2026, 0, 5, 12, 0, 0).getTime(); // noon Jan 5
    const to = new Date(2026, 0, 7, 6, 0, 0).getTime(); // 6am Jan 7
    const chunks = localDayChunks(from, to);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].startMs, from);
    assert.equal(chunks[0].endMs, new Date(2026, 0, 6).getTime());
    assert.equal(chunks[2].endMs, to);
  });
});

describe("recency-biased session cap", () => {
  it("keeps the MOST RECENT sessions and notes the earlier omissions", () => {
    const sessions = Array.from({ length: 45 }, (_, i) => ({
      name: `sess-${i}`,
      segments: [seg({ inferred_reason: `story ${i}` })],
    }));
    const prompt = buildWindowSummaryPrompt(fakeReport(sessions));
    assert.match(prompt, /\(\+5 earlier sessions omitted\)/);
    assert.match(prompt, /story 44/); // newest survives
    assert.doesNotMatch(prompt, /"sess-0"/); // oldest dropped
  });
});

describe("hierarchical (multi-day) summaries", () => {
  // Three fixed local days in Jan 2026, one seeded session per day.
  const D5 = new Date(2026, 0, 5).getTime();
  const D8 = new Date(2026, 0, 8).getTime();
  const scope = { project_id: null, session_id: null, unassigned: false, sources: null };

  function hourIso(dayMs, hour) {
    return new Date(dayMs + hour * 3_600_000).toISOString();
  }

  let rows;
  before(() => {
    rows = [0, 1, 2].map((d) => {
      const dayMs = D5 + d * 24 * 3_600_000;
      const id = `hier-s${d}`;
      seedSession(id, "/tmp/hier-repo", hourIso(dayMs, 10), hourIso(dayMs, 12));
      return dbModule.db
        .prepare("SELECT id, name, cwd, started_at, ended_at FROM sessions WHERE id = ?")
        .get(id);
    });
  });

  function windowReport() {
    return buildProjectFocusReport(dbModule, rows, D5, D8);
  }

  it("summarizes each day, rolls them up, and caches every layer", async () => {
    const seq = fakeSpawnSequence([
      { stdout: envelope({ bullets: ["Day-one story."] }) },
      { stdout: envelope({ bullets: ["Day-two story."] }) },
      { stdout: envelope({ bullets: ["Day-three story."] }) },
      { stdout: envelope({ bullets: ["Whole-window rollup."] }) },
    ]);
    __injectSpawnForTest(seq.impl);

    const result = await generateWindowSummary(dbModule, "hier-key", windowReport(), {
      fromMs: D5,
      toMs: D8,
      scope,
      sessions: rows,
    });
    assert.deepEqual(result.bullets, ["Whole-window rollup."]);
    assert.equal(result.cached, false);
    assert.equal(seq.calls.length, 4); // 3 day maps + 1 rollup

    // The rollup prompt was built FROM the day bullets, labeled by day.
    const rollupPrompt = seq.calls[3][seq.calls[3].indexOf("-p") + 1];
    assert.match(rollupPrompt, /2026-01-05:/);
    assert.match(rollupPrompt, /Day-one story\./);
    assert.match(rollupPrompt, /Day-three story\./);
    assert.match(rollupPrompt, /2-6 plain-language bullets/); // 3-day budget

    // Every day landed in the cache under its own scope-qualified key.
    const dayRow = dbModule.stmts.getFocusSummary.get(JSON.stringify({ day: D5, scope }));
    assert.deepEqual(JSON.parse(dayRow.bullets), ["Day-one story."]);

    // Unchanged window: served from cache with ZERO spawns.
    __injectSpawnForTest(() => {
      throw new Error("no LLM call expected on an unchanged window");
    });
    const again = await generateWindowSummary(dbModule, "hier-key", windowReport(), {
      fromMs: D5,
      toMs: D8,
      scope,
      sessions: rows,
    });
    assert.deepEqual(again.bullets, ["Whole-window rollup."]);
    assert.equal(again.cached, true);
  });

  it("degrades a failed day to raw fact lines instead of dropping it", async () => {
    db.exec("DELETE FROM focus_summaries");
    const seq = fakeSpawnSequence([
      { stdout: envelope({ bullets: ["Day-one story."] }) },
      { exitCode: 1 }, // day two's own synthesis fails
      { stdout: envelope({ bullets: ["Day-three story."] }) },
      { stdout: envelope({ bullets: ["Rollup despite the gap."] }) },
    ]);
    __injectSpawnForTest(seq.impl);

    const result = await generateWindowSummary(dbModule, "hier-key-2", windowReport(), {
      fromMs: D5,
      toMs: D8,
      scope,
      sessions: rows,
    });
    assert.deepEqual(result.bullets, ["Rollup despite the gap."]);

    // Day two still appears in the rollup input - as raw facts, not bullets.
    const rollupPrompt = seq.calls[3][seq.calls[3].indexOf("-p") + 1];
    assert.match(rollupPrompt, /2026-01-06:/);
    assert.match(rollupPrompt, /unplanned work/); // its raw fact line
  });
});

describe("GET /api/focus-report/summary/config", () => {
  it("returns the configured summary model, honoring the SUMMARY override", async () => {
    const base = await fetch("/api/focus-report/summary/config");
    assert.equal(base.status, 200);
    assert.equal(base.body.model, "haiku"); // no overrides set in this suite

    process.env.DASHBOARD_FOCUS_SUMMARY_MODEL = "sonnet";
    const overridden = await fetch("/api/focus-report/summary/config");
    assert.equal(overridden.body.model, "sonnet");
  });
});

describe("GET /api/focus-report/summary", () => {
  it("shares GET /'s validation: 400 without from/to", async () => {
    const res = await fetch("/api/focus-report/summary");
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "BAD_REQUEST");
  });

  it("responds { summary: null } with a 200 when the LLM path is off", async () => {
    process.env.DASHBOARD_FOCUS_INFER_MODE = "off";
    seedSession("sum-s1", "/tmp/sum-repo", dayIso(1), dayIso(2));
    const res = await fetch(`/api/focus-report/summary?from=${dayIso(0)}&to=${dayIso(23)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.summary, null);
  });

  it("responds { summary: null } for a window with no sessions", async () => {
    __injectSpawnForTest(fakeSpawn({ stdout: envelope({ bullets: ["Should not appear."] }) }));
    const res = await fetch(
      "/api/focus-report/summary?from=2030-01-01T00:00:00.000Z&to=2030-01-02T00:00:00.000Z"
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.summary, null);
  });

  it("returns synthesized bullets for a real window", async () => {
    __injectSpawnForTest(
      fakeSpawn({ stdout: envelope({ bullets: ["Shipped the export feature.", "Fixed auth."] }) })
    );
    seedSession("sum-s2", "/tmp/sum-repo", dayIso(1), dayIso(2));
    const res = await fetch(`/api/focus-report/summary?from=${dayIso(0)}&to=${dayIso(23)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.summary.bullets, ["Shipped the export feature.", "Fixed auth."]);
    assert.equal(res.body.summary.cached, false);
    assert.equal(typeof res.body.summary.generated_at, "string");
  });
});
