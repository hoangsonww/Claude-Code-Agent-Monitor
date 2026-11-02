/**
 * @file Cost snapshot tool (scripts/cost-snapshot.js): read-only per-session snapshot
 * and the local-vs-source split of a before/after comparison.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { createHash } = require("node:crypto");

// Module-level paths are read at require time: set the environment first.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `cost-snapshot-${process.pid}-`));
process.env.CLAUDE_HOME = path.join(TMP_ROOT, "claude");
process.env.DASHBOARD_DATA_DIR = path.join(TMP_ROOT, "data");
process.env.DASHBOARD_DB_PATH = path.join(TMP_ROOT, "dashboard.db");
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { db, stmts } = require("../db");
const snap = require("../../scripts/cost-snapshot");

let seq = 0;
const uid = (p) => `${p}-${process.pid}-${++seq}`;
const TOOL = path.join(__dirname, "../../scripts/cost-snapshot.js");
// node:sqlite backs the builtin driver; only its absence skips builtin-path cases.
const builtinSkip = (() => {
  try {
    require("node:sqlite");
    return false;
  } catch {
    return "node:sqlite is unavailable";
  }
})();

after(() => {
  db.close();
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

function seed(id, source, input) {
  if (!stmts.getSession.get(id)) {
    stmts.insertSession.run(id, id, "completed", "/tmp/p", "claude-opus-4-8", null);
    if (source) stmts.setSessionSource.run(source, id);
  }
  db.prepare(
    "INSERT OR REPLACE INTO token_usage (session_id, model, input_tokens, output_tokens) VALUES (?, 'claude-opus-4-8', ?, 5)"
  ).run(id, input);
}

/** A rollback-journal copy of the test database that a read-only open can use. */
function copyDatabase(target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const handle = new db.constructor(target);
  try {
    handle.pragma("journal_mode = DELETE");
  } finally {
    handle.close();
  }
}

describe("cost snapshot", () => {
  it("keeps an already loaded caller database and its environment intact", () => {
    const originalDbPath = process.env.DASHBOARD_DB_PATH;
    const originalDataDir = process.env.DASHBOARD_DATA_DIR;
    const out = path.join(TMP_ROOT, "embedded.tsv");
    snap.takeSnapshot(originalDbPath, out);
    assert.equal(db.prepare("SELECT 1 AS alive").get().alive, 1);
    assert.equal(process.env.DASHBOARD_DB_PATH, originalDbPath);
    assert.equal(process.env.DASHBOARD_DATA_DIR, originalDataDir);
    assert.ok(fs.existsSync(out));
  });

  it("closes its owned scratch connection before removing the directory", () => {
    const tool = path.join(__dirname, "../../scripts/cost-snapshot.js");
    const dbModule = path.join(__dirname, "../db.js");
    const code = `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const originalRemove = fs.rmSync;
      let checked = false;
      fs.rmSync = function (target, options) {
        const module = require.cache[${JSON.stringify(dbModule)}]?.exports;
        if (module && module.DB_PATH.startsWith(target + require('node:path').sep)) {
          assert.equal(module.db.open, false, 'scratch DB must close before directory removal');
          checked = true;
        }
        return originalRemove.call(this, target, options);
      };
      require(${JSON.stringify(tool)}).takeSnapshot(process.argv[1], process.argv[2]);
      assert.equal(checked, true, 'scratch cleanup was observed');
    `;
    const result = spawnSync(
      process.execPath,
      ["-e", code, process.env.DASHBOARD_DB_PATH, path.join(TMP_ROOT, "cleanup.tsv")],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("restores the caller's environment and module cache after a cold snapshot", () => {
    const dbModule = path.join(__dirname, "../db.js");
    const code = `
      const assert = require('node:assert/strict');
      const callerEnv = [process.env.DASHBOARD_DB_PATH, process.env.DASHBOARD_DATA_DIR];
      require(${JSON.stringify(TOOL)}).takeSnapshot(process.argv[1], process.argv[2]);
      assert.deepEqual([process.env.DASHBOARD_DB_PATH, process.env.DASHBOARD_DATA_DIR], callerEnv);
      // A caller without the variables must not inherit the scratch values.
      delete process.env.DASHBOARD_DB_PATH;
      delete process.env.DASHBOARD_DATA_DIR;
      require(${JSON.stringify(TOOL)}).takeSnapshot(process.argv[1], process.argv[3]);
      assert.equal('DASHBOARD_DB_PATH' in process.env, false);
      assert.equal('DASHBOARD_DATA_DIR' in process.env, false);
      process.env.DASHBOARD_DB_PATH = callerEnv[0];
      process.env.DASHBOARD_DATA_DIR = callerEnv[1];
      assert.equal(require.cache[${JSON.stringify(dbModule)}], undefined, 'scratch db module left the cache');
      const { db, DB_PATH } = require(${JSON.stringify(dbModule)});
      assert.equal(DB_PATH, callerEnv[0]);
      assert.equal(db.open, true);
      db.close();
    `;
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        code,
        process.env.DASHBOARD_DB_PATH,
        path.join(TMP_ROOT, "cold-restore.tsv"),
        path.join(TMP_ROOT, "cold-restore-unset.tsv"),
      ],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("closes both connections when pricing initialization fails", () => {
    const tool = path.join(__dirname, "../../scripts/cost-snapshot.js");
    const dbModule = path.join(__dirname, "../db.js");
    const pricingModule = path.join(__dirname, "../routes/pricing.js");
    const code = `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const Module = require('node:module');
      const NativeDatabase = require('better-sqlite3');
      const originalLoad = Module._load;
      const handles = [];
      const callerEnv = [process.env.DASHBOARD_DB_PATH, process.env.DASHBOARD_DATA_DIR];
      let scratchDir;
      Module._load = function (request, parent, isMain) {
        if (request === 'better-sqlite3') {
          return class extends NativeDatabase {
            constructor(...args) { super(...args); handles.push(this); }
          };
        }
        if (Module._resolveFilename(request, parent) === ${JSON.stringify(pricingModule)}) {
          scratchDir = require('node:path').dirname(process.env.DASHBOARD_DB_PATH);
          originalLoad(${JSON.stringify(dbModule)}, parent, false);
          throw new Error('fixture pricing initialization failed');
        }
        return originalLoad.call(this, request, parent, isMain);
      };
      assert.throws(
        () => require(${JSON.stringify(tool)}).takeSnapshot(process.argv[1], process.argv[2]),
        /fixture pricing initialization failed/
      );
      assert.ok(handles.length >= 2, 'target and scratch were opened');
      assert.ok(handles.every(db => !db.open), 'all owned handles must close after load failure');
      assert.ok(scratchDir, 'pricing was loaded against the scratch database');
      assert.equal(fs.existsSync(scratchDir), false);
      assert.deepEqual([process.env.DASHBOARD_DB_PATH, process.env.DASHBOARD_DATA_DIR], callerEnv);
      assert.equal(require.cache[${JSON.stringify(dbModule)}], undefined, 'scratch db module left the cache');
    `;
    const result = spawnSync(
      process.execPath,
      ["-e", code, process.env.DASHBOARD_DB_PATH, path.join(TMP_ROOT, "failed-load.tsv")],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });

  it("fails the local-change gate for reassignment or removal, but allows remote-only changes", () => {
    const before = path.join(TMP_ROOT, "gate-before.tsv");
    const after = path.join(TMP_ROOT, "gate-after.tsv");
    const header =
      "session_id\tprovider\tsource\tinput\toutput\tcache_read\tcache_write\tcache_write_1h\tweb_search\tweb_fetch\tcode_execution\tcost_usd\n";
    const row = (source, provider = "claude") =>
      `gate-id\t${provider}\t${source}\t10\t20\t300\t4\t0\t0\t0\t0\t0.01\n`;
    for (const [from, to, expected, toProvider] of [
      ["local", "src-box", 1],
      ["src-box", "local", 1],
      ["local", null, 1],
      ["src-one", "src-two", 0],
      ["local", "local", 1, "codex"],
    ]) {
      fs.writeFileSync(before, header + row(from));
      fs.writeFileSync(after, header + (to === null ? "" : row(to, toProvider)));
      const result = spawnSync(
        process.execPath,
        [
          path.join(__dirname, "../../scripts/cost-snapshot.js"),
          "compare",
          before,
          after,
          "--fail-on-local-change",
        ],
        { encoding: "utf8" }
      );
      assert.equal(result.status, expected, result.stderr + result.stdout);
      if (toProvider) assert.match(result.stdout, /gate-id\tclaude\/local -> codex\/local/);
    }
  });

  it("includes every additional usage dimension and detects it independently of cost", () => {
    const id = uid("unpriced");
    seed(id, null, 10);
    db.prepare("UPDATE token_usage SET model = 'unpriced-fixture-model' WHERE session_id = ?").run(
      id
    );
    const dimensions = [
      ["cache_write_1h_tokens", "baseline_cache_write_1h", "cacheWrite1h"],
      ["web_search_requests", "baseline_web_search", "webSearch"],
      ["web_fetch_requests", "baseline_web_fetch", "webFetch"],
      ["code_execution_requests", "baseline_code_execution", "codeExecution"],
    ];
    for (const [column, baseline, field] of dimensions) {
      const beforeFile = path.join(TMP_ROOT, `dimensions-${field}-before.tsv`);
      const afterFile = path.join(TMP_ROOT, `dimensions-${field}-after.tsv`);
      db.prepare(`UPDATE token_usage SET ${baseline} = 4 WHERE session_id = ?`).run(id);
      snap.takeSnapshot(process.env.DASHBOARD_DB_PATH, beforeFile);
      const before = snap.readSnapshot(beforeFile);
      assert.equal(before.get(id)[field], 4, `baseline included for ${column}`);
      db.prepare(`UPDATE token_usage SET ${column} = 1 WHERE session_id = ?`).run(id);
      snap.takeSnapshot(process.env.DASHBOARD_DB_PATH, afterFile);
      const after = snap.readSnapshot(afterFile);
      assert.equal(after.get(id)[field], 5, `usage plus baseline for ${column}`);
      if (field === "cacheWrite1h") {
        assert.equal(before.get(id).cost, 0);
        assert.equal(after.get(id).cost, 0);
      }
      // Tool requests may carry provider-level charges even without a model
      // rate. Hold the TSV cost constant to test the usage guard independently
      // of pricing, while retaining the real snapshot's usage and baselines.
      after.get(id).cost = before.get(id).cost;
      const lines = fs.readFileSync(afterFile, "utf8").trimEnd().split("\n");
      fs.writeFileSync(
        afterFile,
        lines
          .map((line, index) => {
            const fields = line.split("\t");
            if (index > 0 && fields[0] === id)
              fields[fields.length - 1] = before.get(id).cost.toFixed(6);
            return fields.join("\t");
          })
          .join("\n") + "\n"
      );
      assert.deepEqual(
        snap.compareSnapshots(before, after).local.changed.map((e) => e.id),
        [id]
      );
      const result = spawnSync(
        process.execPath,
        [
          path.join(__dirname, "../../scripts/cost-snapshot.js"),
          "compare",
          beforeFile,
          afterFile,
          "--fail-on-local-change",
        ],
        { encoding: "utf8" }
      );
      assert.equal(result.status, 1, result.stderr + result.stdout);
    }
  });

  it("refuses existing output files including the input database and hardlink aliases", async () => {
    const copy = path.join(TMP_ROOT, "disposable-copy.db");
    const alias = path.join(TMP_ROOT, "disposable-hardlink.db");
    await db.backup(copy);
    fs.linkSync(copy, alias);
    const original = fs.readFileSync(copy);
    const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
    for (const output of [copy, alias]) {
      let failure;
      try {
        snap.takeSnapshot(copy, output);
      } catch (error) {
        failure = error;
      }
      assert.equal(
        hash(fs.readFileSync(copy)),
        hash(original),
        "input database bytes remain intact"
      );
      assert.equal(failure?.code, "EEXIST");
      assert.deepEqual(fs.readFileSync(copy), original);
      assert.deepEqual(fs.readFileSync(alias), original);
    }
    const previous = path.join(TMP_ROOT, "existing-baseline.tsv");
    fs.writeFileSync(previous, "previous baseline\n");
    assert.throws(
      () => snap.takeSnapshot(copy, previous),
      (error) => error.code === "EEXIST"
    );
    assert.equal(fs.readFileSync(previous, "utf8"), "previous baseline\n");
  });

  it("refuses a row with a missing or non-numeric field instead of comparing NaN", () => {
    const header =
      "session_id\tprovider\tsource\tinput\toutput\tcache_read\tcache_write\tcache_write_1h\tweb_search\tweb_fetch\tcode_execution\tcost_usd\n";
    for (const [name, row] of [
      ["short-row", "id-1\tclaude\tlocal\t10\t20\t300\t4\t0\t0\t0\t0\n"],
      ["nan-cost", "id-1\tclaude\tlocal\t10\t20\t300\t4\t0\t0\t0\t0\tn/a\n"],
      ["blank-cost", "id-1\tclaude\tlocal\t10\t20\t300\t4\t0\t0\t0\t0\t \n"],
      ["hex-input", "id-1\tclaude\tlocal\t0x10\t20\t300\t4\t0\t0\t0\t0\t0.01\n"],
      ["overflow-cost", "id-1\tclaude\tlocal\t10\t20\t300\t4\t0\t0\t0\t0\t1e400\n"],
    ]) {
      const file = path.join(TMP_ROOT, `${name}.tsv`);
      fs.writeFileSync(file, header + row);
      assert.throws(() => snap.readSnapshot(file), /row 2 is incomplete or not numeric/, name);
    }
  });

  it("refuses older partial snapshot columns instead of assuming missing usage is zero", () => {
    const file = path.join(TMP_ROOT, "partial-columns.tsv");
    fs.writeFileSync(
      file,
      "session_id\tprovider\tsource\tinput\toutput\tcache_read\tcache_write\tcost_usd\n"
    );
    assert.throws(
      () => snap.readSnapshot(file),
      /unsupported cost snapshot columns; regenerate both snapshots/
    );
  });

  it("captures rates, ownership and usage from one committed WAL snapshot", () => {
    const id = uid("atomic");
    const source = uid("source");
    const model = `claude-${id}`;
    seed(id, null, 1000000);
    stmts.insertRemoteSource.run(source, "Fixture", "fixture.invalid", null, null, null, null, 1);
    db.prepare(
      "INSERT INTO model_pricing(model_pattern, display_name, input_per_mtok) VALUES(?, ?, 5)"
    ).run(model, model);
    db.prepare("UPDATE token_usage SET model = ?, output_tokens = 0 WHERE session_id = ?").run(
      model,
      id
    );
    assert.equal(db.pragma("journal_mode", { simple: true }), "wal");
    const Database = require("better-sqlite3");
    const prepare = Database.prototype.prepare;
    let committed = false;
    Database.prototype.prepare = function (sql) {
      const statement = prepare.call(this, sql);
      if (this.readonly && sql === "SELECT * FROM model_pricing") {
        const all = statement.all.bind(statement);
        statement.all = (...params) => {
          const rows = all(...params);
          db.transaction(() => {
            db.prepare("UPDATE model_pricing SET input_per_mtok = 10 WHERE model_pattern = ?").run(
              model
            );
            db.prepare("UPDATE token_usage SET input_tokens = 2000000 WHERE session_id = ?").run(
              id
            );
            stmts.setSessionSource.run(source, id);
          })();
          committed = true;
          return rows;
        };
      }
      return statement;
    };
    const beforeFile = path.join(TMP_ROOT, "atomic-before.tsv");
    try {
      snap.takeSnapshot(process.env.DASHBOARD_DB_PATH, beforeFile);
    } finally {
      Database.prototype.prepare = prepare;
    }
    assert.equal(committed, true, "the other connection committed after the first real rate read");
    assert.equal(
      db.prepare("SELECT input_tokens FROM token_usage WHERE session_id = ?").get(id).input_tokens,
      2000000
    );
    const before = snap.readSnapshot(beforeFile).get(id);
    assert.deepEqual(
      { source: before.source, input: before.input, cost: before.cost },
      { source: "local", input: 1000000, cost: 5 }
    );
    const afterFile = path.join(TMP_ROOT, "atomic-after.tsv");
    snap.takeSnapshot(process.env.DASHBOARD_DB_PATH, afterFile);
    const after = snap.readSnapshot(afterFile).get(id);
    assert.equal(after.source, source);
    assert.equal(after.input, 2000000);
    assert.equal(after.cost, 20);
  });

  it("snapshots read-only and splits local from source changes on compare", () => {
    const src = uid("src");
    stmts.insertRemoteSource.run(src, "Box", "u@box", null, null, null, null, 1);
    const loc = uid("loc");
    const rem = uid("rem");
    const still = uid("still");
    seed(loc, null, 100);
    seed(rem, src, 100);
    seed(still, null, 100);
    const f1 = path.join(TMP_ROOT, "before.tsv");
    const f2 = path.join(TMP_ROOT, "after.tsv");
    const run = (out) =>
      spawnSync(
        process.execPath,
        [
          path.join(__dirname, "../../scripts/cost-snapshot.js"),
          "snapshot",
          "--db",
          process.env.DASHBOARD_DB_PATH,
          "--out",
          out,
        ],
        { encoding: "utf8" }
      );
    const r1 = run(f1);
    assert.equal(r1.status, 0, r1.stderr);
    const before = snap.readSnapshot(f1);
    assert.equal(before.get(loc).source, "local");
    assert.equal(before.get(rem).source, src);
    assert.ok(before.get(loc).cost > 0);

    seed(loc, null, 5000); // local session undercounted -> grows
    seed(rem, src, 7000); // box kept working
    assert.equal(run(f2).status, 0);
    const result = snap.compareSnapshots(before, snap.readSnapshot(f2));
    assert.deepEqual(
      result.local.changed.map((e) => e.id),
      [loc]
    );
    assert.deepEqual(
      result.source.changed.map((e) => e.id),
      [rem]
    );
    assert.ok(result.local.changed[0].delta > 0);
    assert.ok(result.local.unchanged >= 1 && result.local.changed.every((e) => e.id !== still));

    const cmp = spawnSync(
      process.execPath,
      [
        path.join(__dirname, "../../scripts/cost-snapshot.js"),
        "compare",
        f1,
        f2,
        "--fail-on-local-change",
      ],
      { encoding: "utf8" }
    );
    assert.equal(cmp.status, 1);
    assert.match(cmp.stdout, /LOCAL sessions: changed=1/);
    assert.match(cmp.stdout, /SOURCE sessions: changed=1/);
  });

  it("defaults to the server's database, including dotenv overrides, and keeps DASHBOARD_DB_PATH first", () => {
    const id = uid("default-path");
    seed(id, null, 42);
    const home = path.join(TMP_ROOT, "default-home");
    const dataDir = path.join(TMP_ROOT, "default-data");
    const pinned = path.join(TMP_ROOT, "default-pinned.db");
    const missing = path.join(TMP_ROOT, "default-missing");
    copyDatabase(path.join(home, "agent-dashboard", "dashboard.db"));
    copyDatabase(path.join(dataDir, "dashboard.db"));
    copyDatabase(pinned);
    // A dotenv file holding CLAUDE_HOME, as Settings persists it for the server.
    const dotenv = path.join(TMP_ROOT, "default-settings.env");
    fs.writeFileSync(dotenv, `CLAUDE_HOME=${home}\n`);
    const noDotenv = path.join(missing, ".env");
    const cases = [
      ["claude-home", { CLAUDE_HOME: home, DASHBOARD_ENV_PATH: noDotenv }],
      [
        "data-dir",
        { CLAUDE_HOME: missing, DASHBOARD_DATA_DIR: dataDir, DASHBOARD_ENV_PATH: noDotenv },
      ],
      [
        "db-path",
        {
          CLAUDE_HOME: missing,
          DASHBOARD_DATA_DIR: missing,
          DASHBOARD_DB_PATH: pinned,
          DASHBOARD_ENV_PATH: noDotenv,
        },
      ],
      ["dotenv", { DASHBOARD_ENV_PATH: dotenv }],
    ];
    for (const [label, overrides] of cases) {
      // HOME points nowhere, so the old ~/.claude fallback cannot satisfy a case.
      const env = { ...process.env, HOME: missing, USERPROFILE: missing };
      delete env.DASHBOARD_DB_PATH;
      delete env.DASHBOARD_DATA_DIR;
      delete env.CLAUDE_HOME;
      Object.assign(env, overrides);
      const out = path.join(TMP_ROOT, `default-${label}.tsv`);
      const result = spawnSync(process.execPath, [TOOL, "snapshot", "--out", out], {
        encoding: "utf8",
        env,
      });
      assert.equal(result.status, 0, `${label}: ${result.stdout}${result.stderr}`);
      assert.equal(snap.readSnapshot(out).get(id).input, 42, label);
    }
  });

  it(
    "falls back to the builtin driver, read-only, when the native driver cannot load",
    { skip: builtinSkip },
    () => {
      const id = uid("builtin");
      seed(id, null, 77);
      const copy = path.join(TMP_ROOT, "builtin-copy.db");
      copyDatabase(copy);
      const digest = () => createHash("sha256").update(fs.readFileSync(copy)).digest("hex");
      const original = digest();
      const out = path.join(TMP_ROOT, "builtin.tsv");
      const code = `
        const Module = require('node:module');
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
          if (request === 'better-sqlite3') throw new Error('fixture: native driver unavailable');
          return originalLoad.call(this, request, parent, isMain);
        };
        require(${JSON.stringify(TOOL)}).takeSnapshot(process.argv[1], process.argv[2]);
      `;
      const result = spawnSync(process.execPath, ["-e", code, copy, out], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(snap.readSnapshot(out).get(id).input, 77);
      assert.equal(digest(), original, "the input database bytes stay intact");
    }
  );

  it("opens builtin connections read-only only when asked", { skip: builtinSkip }, () => {
    const Compat = require("../compat-sqlite");
    const file = path.join(TMP_ROOT, "compat-readonly.db");
    const writable = new Compat(file);
    try {
      writable.exec("CREATE TABLE fixture(x INTEGER); INSERT INTO fixture VALUES (1)");
    } finally {
      writable.close();
    }
    const original = fs.readFileSync(file);
    const reader = new Compat(file, { readonly: true, fileMustExist: true });
    try {
      assert.equal(reader.prepare("SELECT x FROM fixture").get().x, 1);
      assert.throws(() => reader.exec("INSERT INTO fixture VALUES (2)"));
    } finally {
      reader.close();
    }
    assert.deepEqual(fs.readFileSync(file), original);
    const missing = path.join(TMP_ROOT, "compat-missing.db");
    assert.throws(
      () => new Compat(missing, { readonly: true, fileMustExist: true }),
      (error) => error.code === "SQLITE_CANTOPEN"
    );
    assert.equal(fs.existsSync(missing), false);
  });

  it(
    "opens in-memory and temporary builtin databases despite fileMustExist",
    { skip: builtinSkip },
    () => {
      const Compat = require("../compat-sqlite");
      const cwd = process.cwd();
      process.chdir(TMP_ROOT);
      try {
        for (const name of [":memory:", "", " :memory: "]) {
          const handle = new Compat(name, { fileMustExist: true });
          try {
            assert.equal(handle.prepare("SELECT 1 AS one").get().one, 1, JSON.stringify(name));
          } finally {
            handle.close();
          }
        }
        // Like better-sqlite3, the padded name is trimmed rather than creating a file.
        assert.equal(fs.existsSync(path.join(TMP_ROOT, " :memory: ")), false);
      } finally {
        process.chdir(cwd);
      }
    }
  );
});
