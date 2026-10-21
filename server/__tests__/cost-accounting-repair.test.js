/**
 * @file Exercises published GPT-6.1 rates, preserved custom rules, interrupted
 * source status recovery, and journaled/idempotent Codex reasoning-output repair.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-cost-repair-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_DATA_DIR = root;
process.env.DASHBOARD_DB_PATH = path.join(root, "base.db");
const { db, seedGptPricing } = require("../db");
// better-sqlite3 is optional; fall back to the built-in adapter as the app does.
let Database;
try {
  Database = require("better-sqlite3");
  new Database(":memory:").close();
} catch {
  Database = require("../compat-sqlite");
}
const { calculateGptCost } = require("../routes/pricing");
const {
  planRepair,
  applyRepair,
  accumulate,
  writeExclusive,
} = require("../../scripts/repair-codex-output");
const { codexTokenDelta } = require("../lib/codex-token-accounting");
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
const tables = [
  "sessions",
  "events",
  "token_usage",
  "codex_ingest_state",
  "gpt_model_pricing",
  "remote_sources",
];
function fixture() {
  const d = new Database(":memory:");
  for (const name of tables)
    d.exec(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name).sql);
  return d;
}

it("GPT-6.1 Sol is priced in all four published bands", () => {
  const d = fixture();
  try {
    seedGptPricing(d);
    const rules = d.prepare("SELECT * FROM gpt_model_pricing").all();
    for (const [speed, context_size, expected] of [
      ["standard", "short", 14.6],
      ["standard", "long", 24.2],
      ["fast", "short", 29.2],
      ["fast", "long", 48.4],
    ]) {
      const result = calculateGptCost(
        [
          {
            model: "gpt-6.1-sol",
            speed,
            context_size,
            input_tokens: 1e6,
            output_tokens: 1e6,
            cache_read_tokens: 1e6,
            cache_write_tokens: 1e6,
          },
        ],
        rules
      );
      assert.equal(result.total_cost, expected);
      assert.deepEqual(result.unpriced_models, []);
    }
  } finally {
    d.close();
  }
});
it("new defaults preserve exact and effective broad custom GPT rules", () => {
  for (const pattern of ["gpt-6.1-sol%", "gpt-%"]) {
    const d = fixture();
    try {
      d.prepare(
        "INSERT INTO gpt_model_pricing(model_pattern,display_name,short_input_per_mtok,short_output_per_mtok) VALUES(?,?,?,?)"
      ).run(pattern, "Custom", 7, 77);
      seedGptPricing(d);
      const row = d.prepare("SELECT * FROM gpt_model_pricing WHERE model_pattern=?").get(pattern);
      assert.equal(row.short_input_per_mtok, 7);
      assert.equal(row.short_output_per_mtok, 77);
      if (pattern === "gpt-%")
        assert.equal(
          d.prepare("SELECT 1 FROM gpt_model_pricing WHERE model_pattern='gpt-6.1-sol%'").get(),
          undefined
        );
    } finally {
      d.close();
    }
  }
  const d = fixture();
  try {
    d.prepare("INSERT INTO gpt_model_pricing(model_pattern,display_name) VALUES(?,?)").run(
      "gpt_%",
      "Literal underscore"
    );
    seedGptPricing(d);
    assert.ok(
      d.prepare("SELECT 1 FROM gpt_model_pricing WHERE model_pattern='gpt-6.1-sol%'").get()
    );
  } finally {
    d.close();
  }
});
it("reasoning is not added to output, duplicates and counter resets remain free", () => {
  const total = {
    input_tokens: 100,
    cached_input_tokens: 40,
    output_tokens: 20,
    reasoning_output_tokens: 5,
    total_tokens: 120,
  };
  const first = codexTokenDelta(total);
  assert.equal(first.output, 20);
  assert.equal(first.legacyOutput, 25);
  assert.equal(first.input, 60);
  assert.equal(codexTokenDelta(total, first.current).output, 0);
  const reset = codexTokenDelta(
    { ...total, output_tokens: 2, reasoning_output_tokens: 1 },
    first.current
  );
  assert.equal(reset.output, 0);
  assert.equal(
    codexTokenDelta({ ...total, output_tokens: 7, reasoning_output_tokens: 2 }, reset.current)
      .output,
    5
  );
});

it("thread settings route usage by the nested model exactly as ingestion does", () => {
  const total = {
    input_tokens: 100,
    cached_input_tokens: 40,
    output_tokens: 20,
    reasoning_output_tokens: 5,
  };
  const result = accumulate(
    [
      { type: "turn_context", payload: { model: "first" } },
      { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: total } } },
      {
        type: "event_msg",
        payload: {
          type: "thread_settings_applied",
          model: "wrong-top-level",
          thread_settings: { model: "second", service_tier: "fast" },
        },
      },
      {
        type: "event_msg",
        payload: {
          type: "token_count",
          info: {
            total_token_usage: {
              input_tokens: 200,
              cached_input_tokens: 80,
              output_tokens: 40,
              reasoning_output_tokens: 10,
            },
          },
        },
      },
    ],
    { model: "fallback" }
  );
  assert.equal(
    result.buckets.get(JSON.stringify(["first", "standard", "short"])).output_tokens,
    20
  );
  assert.equal(result.buckets.get(JSON.stringify(["second", "fast", "short"])).output_tokens, 20);
  assert.equal(result.buckets.has(JSON.stringify(["wrong-top-level", "fast", "short"])), false);
});

it("dry-run output creation cannot overwrite an existing database or receipt", () => {
  const file = path.join(root, "exclusive-existing");
  fs.writeFileSync(file, "original");
  assert.throws(() => writeExclusive(file, "replacement"), /EEXIST/);
  assert.equal(fs.readFileSync(file, "utf8"), "original");
});

it("a foreign metadata prefix is not legitimized by a later matching metadata record", () => {
  assert.throws(
    () =>
      accumulate(
        [
          { type: "session_meta", payload: { id: "foreign" } },
          { type: "session_meta", payload: { id: "owned" } },
        ],
        { id: "owned" }
      ),
    /identity-mismatch/
  );
});

it("failed directory durability refuses all repair writes", async (t) => {
  const d = fixture();
  try {
    legacy(d, "directory-durability");
    const plan = await planRepair(d);
    const original = fs.fsyncSync;
    t.mock.method(fs, "fsyncSync", (fd) => {
      if (fs.fstatSync(fd).isDirectory()) throw new Error("directory durability failed");
      return original(fd);
    });
    assert.throws(
      () => applyRepair(d, plan, path.join(root, "directory.journal")),
      /directory durability failed/
    );
    assert.equal(d.prepare("SELECT output_tokens FROM token_usage").get().output_tokens, 25);
  } finally {
    d.close();
  }
});
it("a preview plan is written without the directory flush that repair writes need", (t) => {
  const original = fs.fsyncSync;
  t.mock.method(fs, "fsyncSync", (fd) => {
    if (fs.fstatSync(fd).isDirectory()) throw new Error("directory durability failed");
    return original(fd);
  });
  const plan = path.join(root, "preview-plan.json");
  writeExclusive(plan, "{}\n", { syncDirectory: false });
  assert.equal(fs.readFileSync(plan, "utf8"), "{}\n");
  assert.throws(
    () => writeExclusive(path.join(root, "receipt.json"), "{}\n"),
    /directory durability failed/
  );
});
function legacy(d, id, compressed = false) {
  const file = path.join(root, id + ".jsonl");
  const total = {
    input_tokens: 100,
    cached_input_tokens: 40,
    output_tokens: 20,
    reasoning_output_tokens: 5,
    total_tokens: 120,
  };
  const records = [
    { type: "session_meta", payload: { id } },
    { type: "turn_context", payload: { model: "gpt-6.1-sol" } },
    { type: "event_msg", payload: { type: "token_count", info: { total_token_usage: total } } },
  ];
  const raw = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.writeFileSync(compressed ? file + ".gz" : file, compressed ? zlib.gzipSync(raw) : raw);
  d.prepare(
    "INSERT INTO sessions(id,name,provider,source,model,transcript_path) VALUES(?,?,'codex','src_box','gpt-6.1-sol',?)"
  ).run(id, id, file);
  d.prepare(
    "INSERT INTO token_usage(session_id,model,input_tokens,output_tokens,cache_read_tokens) VALUES(?,'gpt-6.1-sol',60,25,40)"
  ).run(id);
  d.prepare(
    "INSERT INTO codex_ingest_state(transcript_path,session_id,byte_offset,input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens) VALUES(?,?,?,100,40,20,5)"
  ).run(file, id, Buffer.byteLength(raw));
  return file;
}
it("plain/compressed history repair changes output only and is idempotent", async () => {
  for (const compressed of [false, true]) {
    const d = fixture();
    try {
      const id = compressed ? "compressed" : "plain";
      legacy(d, id, compressed);
      const before = d.prepare("SELECT * FROM token_usage").get();
      const plan = await planRepair(d);
      assert.equal(plan.entries.length, 1);
      assert.equal(plan.skipped.length, 0);
      assert.equal(d.prepare("SELECT output_tokens FROM token_usage").get().output_tokens, 25);
      const journal = path.join(root, id + ".journal");
      assert.deepEqual(applyRepair(d, plan, journal), { repaired: 1, changed: 0 });
      const after = d.prepare("SELECT * FROM token_usage").get();
      assert.deepEqual(after, { ...before, output_tokens: 20 });
      assert.equal(JSON.parse(fs.readFileSync(journal)).entries[0].before[0].output_tokens, 25);
      assert.equal((await planRepair(d)).entries.length, 0);
      assert.equal(d.prepare("SELECT COUNT(*) AS n FROM events").get().n, 0);
      assert.equal(d.prepare("SELECT source FROM sessions").get().source, "src_box");
    } finally {
      d.close();
    }
  }
});
it("repair refuses reassignment, changed tokens, missing backup and changed files", async () => {
  for (const kind of ["owner", "tokens", "file", "journal"]) {
    const d = fixture();
    try {
      const file = legacy(d, kind);
      const plan = await planRepair(d);
      const journal = path.join(root, kind + ".journal");
      if (kind === "owner") d.prepare("UPDATE sessions SET source='local'").run();
      if (kind === "tokens") d.prepare("UPDATE token_usage SET output_tokens=26").run();
      if (kind === "file") fs.appendFileSync(file, "{}\n");
      if (kind === "journal") {
        fs.writeFileSync(journal, "exists");
        assert.throws(() => applyRepair(d, plan, journal), /EEXIST/);
      } else assert.equal(applyRepair(d, plan, journal).repaired, 0);
      assert.equal(
        d.prepare("SELECT output_tokens FROM token_usage").get().output_tokens,
        kind === "tokens" ? 26 : 25
      );
    } finally {
      d.close();
    }
  }
});
it("interrupted source sync is an error and preserves the preceding receipt", () => {
  const d = fixture();
  try {
    d.exec(
      "INSERT INTO remote_sources(id,label,host,status,claude_status,codex_status,last_sync_at,last_sync_counts) VALUES('box','Box','fixture','syncing','error','syncing','2026-10-01','{\"imported\":20}')"
    );
    const { recoverInterruptedSyncs } = require("../lib/remote-sync");
    assert.equal(recoverInterruptedSyncs({ db: d }), 1);
    const row = d.prepare("SELECT * FROM remote_sources").get();
    assert.equal(row.status, "error");
    assert.equal(row.claude_status, "error");
    assert.equal(row.codex_status, "error");
    assert.equal(row.last_sync_at, "2026-10-01");
    assert.equal(row.last_sync_counts, '{"imported":20}');
    assert.match(row.last_error, /interrupted/);
    assert.equal(recoverInterruptedSyncs({ db: d }), 0);
  } finally {
    d.close();
  }
});

it("a session filter never widens a repair plan", async () => {
  const d = fixture();
  try {
    d.prepare("INSERT INTO sessions(id,provider) VALUES(?, 'codex')").run("selected");
    d.prepare("INSERT INTO sessions(id,provider) VALUES(?, 'codex')").run("other");
    for (const id of ["selected", "other"])
      d.prepare(
        "INSERT INTO token_usage(session_id,model,output_tokens) VALUES(?,'gpt-6.1-sol',0)"
      ).run(id);
    const all = await planRepair(d);
    const one = await planRepair(d, { sessionId: "selected" });
    const absent = await planRepair(d, { sessionId: "absent" });
    assert.equal(all.scanned, 2);
    assert.equal(one.scanned, 1);
    assert.equal(one.unchanged, 1);
    assert.equal(absent.scanned, 0);
  } finally {
    d.close();
  }
});
