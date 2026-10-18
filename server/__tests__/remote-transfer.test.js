/**
 * @file Tests unpublished SSH transfer generations, rollback and recovery, timestamp
 * preservation, and configuration changes without contacting a real SSH host.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-transfer-test-"));
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_DATA_DIR = path.join(root, "data");
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
const source = { id: "src_transfer", host: "test.invalid", enabled: 1 };
after(() => {
  require("../db").db.close();
  fs.rmSync(root, { recursive: true, force: true });
});

/** Load the real module with only command spawning replaced by deterministic test children. */
function loadSync(transfer) {
  const filename = require.resolve("../lib/remote-sync");
  const localRequire = Module.createRequire(filename);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (name) =>
    name !== "child_process"
      ? localRequire(name)
      : {
          execFileSync: () => "",
          spawn: (command, args) => {
            const child = new EventEmitter();
            child.stdout = new EventEmitter();
            child.stderr = new EventEmitter();
            child.kill = () => {
              process.nextTick(() => child.emit("close", 1));
              return true;
            };
            process.nextTick(() => {
              try {
                if (args.includes("-G")) {
                  child.emit("close", 0);
                  return;
                }
                const result = transfer(command, args, child);
                if (result !== undefined) child.emit("close", result);
              } catch (error) {
                child.emit("error", error);
              }
            });
            return child;
          },
        };
  loaded._compile(fs.readFileSync(filename, "utf8"), filename);
  return loaded.exports;
}

function stage(name) {
  const dest = path.join(root, name);
  fs.mkdirSync(dest);
  fs.writeFileSync(path.join(dest, "previous.jsonl"), "complete old history\n");
  return dest;
}

it("a failed partial SCP leaves the previous published tree intact", async () => {
  const dest = stage("failed");
  const sync = loadSync((_cmd, args, child) => {
    const incoming = args.at(-1);
    assert.notEqual(incoming, dest);
    assert.equal(
      fs.readFileSync(path.join(dest, "previous.jsonl"), "utf8"),
      "complete old history\n"
    );
    fs.writeFileSync(path.join(incoming, "partial.jsonl"), "unfinished");
    child.stderr.emit("data", "connection reset");
    return 1;
  });
  await assert.rejects(sync.mirrorRemoteTree(source, dest, 1000), /scp failed/);
  assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
  assert.equal(
    fs.readdirSync(root).some((name) => name.startsWith("failed.incoming-")),
    false
  );
});

it("only a completed generation replaces the old tree and requests remote mtimes", async () => {
  const dest = stage("success");
  const sync = loadSync((_cmd, args) => {
    assert.ok(args.includes("-p"));
    assert.ok(args.includes("-r"));
    fs.writeFileSync(path.join(args.at(-1), "new.jsonl"), "new history\n");
    return 0;
  });
  await sync.mirrorRemoteTree(source, dest, 1000);
  assert.deepEqual(fs.readdirSync(dest), ["new.jsonl"]);
  assert.equal(fs.existsSync(`${dest}.previous`), false);
});

it("a timed-out command cannot publish its partial generation", async () => {
  const dest = stage("timeout");
  const sync = loadSync((_cmd, args) => {
    fs.writeFileSync(path.join(args.at(-1), "partial.jsonl"), "unfinished");
    return undefined;
  });
  await assert.rejects(sync.mirrorRemoteTree(source, dest, 10), /timed out/);
  assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
});

it("rejects a completed transfer whose registration changed before publication", async () => {
  const dest = stage("changed");
  const sync = loadSync((_cmd, args) => {
    fs.writeFileSync(path.join(args.at(-1), "new.jsonl"), "wrong registration\n");
    return 0;
  });
  await assert.rejects(
    sync.mirrorRemoteTree(source, dest, 1000, "claude", {
      beforePublish: () => {
        throw new Error("configuration changed");
      },
    }),
    /configuration changed/
  );
  assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
});

it("restores the old generation when the second directory rename fails", () => {
  const dest = stage("rename-failure");
  const sync = loadSync(() => 0);
  assert.throws(
    () => sync.publishMirroredTree(path.join(root, "missing-incoming"), dest),
    /ENOENT/
  );
  assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
});

it("recovers a crash between renames before another transfer", () => {
  const dest = stage("crash");
  const sync = loadSync(() => 0);
  fs.renameSync(dest, `${dest}.previous`);
  sync.recoverPublishedTree(dest);
  assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
  assert.equal(fs.existsSync(`${dest}.previous`), false);
});

it("can replace and clean up a generation containing read-only directories", async () => {
  const dest = stage("read-only");
  const readonly = path.join(dest, "readonly");
  fs.mkdirSync(readonly);
  fs.writeFileSync(path.join(readonly, "session.jsonl"), "old history\n", { mode: 0o400 });
  const external = path.join(root, "external.jsonl");
  fs.writeFileSync(external, "outside staging\n", { mode: 0o400 });
  const externalMode = fs.statSync(external).mode;
  if (process.platform !== "win32") fs.symlinkSync(external, path.join(readonly, "outside-link"));
  fs.chmodSync(readonly, 0o500);
  const sync = loadSync((_cmd, args) => {
    fs.writeFileSync(path.join(args.at(-1), "new.jsonl"), "new history\n");
    return 0;
  });
  try {
    await sync.mirrorRemoteTree(source, dest, 1000);
    await sync.mirrorRemoteTree(source, dest, 1000);
    assert.equal(fs.existsSync(`${dest}.previous`), false);
    assert.equal(fs.readFileSync(external, "utf8"), "outside staging\n");
    assert.equal(fs.statSync(external).mode, externalMode);
  } finally {
    const retained = path.join(`${dest}.previous`, "readonly");
    if (fs.existsSync(retained)) fs.chmodSync(retained, 0o700);
  }
});

it("cleans dead-process attempts while preserving an active process's unpublished tree", () => {
  const dest = stage("orphan");
  const sync = loadSync(() => 0);
  const abandoned = fs.mkdtempSync(`${dest}.incoming-2147483647-`);
  const active = fs.mkdtempSync(`${dest}.incoming-${process.pid}-`);
  fs.writeFileSync(path.join(abandoned, "partial.jsonl"), "crashed");
  sync.recoverPublishedTree(dest);
  assert.equal(fs.existsSync(abandoned), false);
  assert.equal(fs.existsSync(active), true);
});

it(
  "recovers the previous tree and a partial attempt after a real child process crash",
  { timeout: 20000 },
  async () => {
    const dest = stage("process-crash");
    const script = `
    const fs = require('node:fs');
    const path = require('node:path');
    const dest = process.argv[1];
    const incoming = fs.mkdtempSync(dest + '.incoming-' + process.pid + '-');
    fs.writeFileSync(path.join(incoming, 'partial.jsonl'), 'unfinished');
    fs.renameSync(dest, dest + '.previous');
    process.stdout.write('ready\\n');
    setInterval(() => {}, 1000);
  `;
    const child = spawn(process.execPath, ["-e", script, dest], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const closed = new Promise((resolve) => child.once("close", resolve));
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("crash fixture did not become ready")),
          15000
        );
        let output = "";
        child.once("error", reject);
        child.once("close", () => {
          clearTimeout(timer);
          reject(new Error("fixture exited before readiness"));
        });
        child.stdout.on("data", (data) => {
          output += data.toString();
          if (output.includes("ready\n")) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      child.kill("SIGKILL");
      await closed;
      loadSync(() => 0).recoverPublishedTree(dest);
      assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
      assert.equal(
        fs.readdirSync(root).some((name) => name.startsWith("process-crash.incoming-")),
        false
      );
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await closed;
    }
  }
);

it("compares every stored connection field and ignores display/status updates", () => {
  const sync = loadSync(() => 0);
  assert.equal(
    sync.sourceConfigurationMatches(source, { ...source, label: "renamed", status: "syncing" }),
    true
  );
  assert.equal(sync.sourceConfigurationMatches(source, null), false);
  for (const key of [
    "id",
    "host",
    "ssh_port",
    "identity_file",
    "remote_home",
    "remote_codex_home",
    "enabled",
  ]) {
    assert.equal(
      sync.sourceConfigurationMatches(source, { ...source, [key]: "changed" }),
      false,
      key
    );
  }
});

for (const change of ["patch", "delete"]) {
  it(`${change} during transfer preserves the old tree and stops before the second provider`, async () => {
    const registration = { ...source, id: `src_${change}` };
    let current = { ...registration };
    const statuses = [];
    const broadcasts = [];
    const fakeDb = {
      stmts: {
        getRemoteSource: { get: () => current },
        setRemoteSourceProviderStatus: { run: (...args) => statuses.push(args) },
        setRemoteSourceStatus: { run: (...args) => statuses.push(args) },
      },
    };
    let copies = 0;
    const sync = loadSync((_cmd, args) => {
      copies++;
      fs.writeFileSync(path.join(args.at(-1), "new.jsonl"), "unpublished\n");
      current =
        change === "delete" ? null : { ...current, host: "replacement.invalid", status: "idle" };
      return 0;
    });
    const dest = sync.stagingDir(registration.id, "claude");
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, "previous.jsonl"), "complete old history\n");
    await assert.rejects(
      sync.syncSource(fakeDb, registration, { broadcast: (...args) => broadcasts.push(args) }),
      (error) => error.code === "SOURCE_CHANGED"
    );
    assert.equal(copies, 1);
    assert.equal(statuses.length, 1);
    assert.equal(broadcasts.length, 1);
    assert.deepEqual(fs.readdirSync(dest), ["previous.jsonl"]);
    if (current) assert.equal(current.status, "idle");
  });
}

it("retries retain the previous failure until a completed sync clears it", async () => {
  const m = require("../db");
  m.db
    .prepare(
      "INSERT INTO remote_sources(id,label,host,status,last_error,last_sync_at,last_sync_counts) VALUES('src_retry','Retry test','test.invalid','error','previous timeout','2020-01-01','{\"skipped\":20}')"
    )
    .run();
  const row = m.stmts.getRemoteSource.get("src_retry");
  const events = [];
  const failing = loadSync((_command, _args, child) => {
    child.stderr.emit("data", "new failure");
    return 1;
  });
  await assert.rejects(
    failing.syncSource(m, row, { broadcast: (type, data) => events.push({ type, data }) }),
    /new failure/
  );
  const retries = events.filter(
    (e) => e.type === "remote_source.status" && e.data.status === "syncing"
  );
  assert.ok(retries.length > 0);
  assert.ok(retries.every((e) => e.data.error === "previous timeout"));
  const failed = m.stmts.getRemoteSource.get(row.id);
  assert.match(failed.last_error, /new failure/);
  assert.equal(failed.last_sync_at, row.last_sync_at);
  assert.equal(failed.last_sync_counts, row.last_sync_counts);
  await loadSync(() => 0).syncSource(m, failed);
  assert.equal(m.stmts.getRemoteSource.get(row.id).last_error, null);
});
