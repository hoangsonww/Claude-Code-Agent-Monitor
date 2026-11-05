/**
 * @file Checks delayed Codex discovery censuses against real rollout ingestion:
 * stale negative evidence cannot close sessions changed during the OS wait.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-sweep-fence-"));
process.env.CLAUDE_HOME = path.join(root, "claude");
process.env.DASHBOARD_DB_PATH = path.join(root, "test.db");
process.env.DASHBOARD_CODEX_HOME = path.join(root, "codex");
process.env.DASHBOARD_CURSOR_HOME = path.join(root, "cursor");
process.env.DASHBOARD_LIVENESS_PROBE = "0";
const { db } = require("../db");
const { createCodexProbeFence } = require("../index");
const { ingestCodexTranscript } = require("../lib/codex-ingest");
let sequence = 0;
function fixture() {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  const file = path.join(process.env.DASHBOARD_CODEX_HOME, "sessions", `rollout-${id}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({
      type: "session_meta",
      payload: { id, cwd: root, timestamp: "2020-01-01T00:00:00Z" },
    }) + "\n"
  );
  return { id, file };
}
const absent = { available: true, paths: new Set() };
after(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
it("unchanged cold history can use a fresh negative census", async () => {
  const { id, file } = fixture();
  const select = createCodexProbeFence([file], db);
  await Promise.resolve();
  ingestCodexTranscript(file, { liveTranscripts: select(absent, file, fs.statSync(file)) });
  assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "completed");
});
for (const kind of [
  "new session",
  "hook activity",
  "transcript append",
  "transcript replacement",
]) {
  it(`a delayed absent census cannot close ${kind} arriving after capture`, async () => {
    const { id, file } = fixture();
    if (kind !== "new session") ingestCodexTranscript(file, { liveTranscripts: new Set([file]) });
    const select = createCodexProbeFence([file], db);
    let finish;
    const census = new Promise((resolve) => {
      finish = resolve;
    });
    if (kind === "new session") ingestCodexTranscript(file, { liveTranscripts: new Set([file]) });
    if (kind === "hook activity")
      db.prepare("INSERT INTO events(session_id,event_type)VALUES(?,'UserPromptSubmit')").run(id);
    if (kind === "transcript append") fs.appendFileSync(file, "{}\n");
    if (kind === "transcript replacement") {
      const content = fs.readFileSync(file);
      fs.renameSync(file, file + ".old");
      fs.writeFileSync(file, content);
    }
    finish(absent);
    const liveTranscripts = select(await census, file, fs.statSync(file));
    assert.equal(liveTranscripts, null);
    ingestCodexTranscript(file, { liveTranscripts });
    assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "active");
  });
}
it("the sweep's own ingest of one cold rollout keeps the census for the next", async () => {
  const first = fixture();
  const second = fixture();
  const select = createCodexProbeFence([first.file, second.file], db);
  await Promise.resolve();
  for (const { file } of [first, second])
    select.ownWrites(() =>
      ingestCodexTranscript(file, { liveTranscripts: select(absent, file, fs.statSync(file)) })
    );
  for (const { id } of [first, second])
    assert.equal(db.prepare("SELECT status FROM sessions WHERE id=?").get(id).status, "completed");
});
it("activity between the sweep's own writes still voids the remaining census", async () => {
  const first = fixture();
  const second = fixture();
  const select = createCodexProbeFence([first.file, second.file], db);
  select.ownWrites(() =>
    ingestCodexTranscript(first.file, {
      liveTranscripts: select(absent, first.file, fs.statSync(first.file)),
    })
  );
  await Promise.resolve();
  db.prepare("INSERT INTO events(session_id,event_type)VALUES(?,'UserPromptSubmit')").run(first.id);
  const liveTranscripts = select(absent, second.file, fs.statSync(second.file));
  assert.equal(liveTranscripts, null);
  select.ownWrites(() => ingestCodexTranscript(second.file, { liveTranscripts }));
  assert.equal(
    db.prepare("SELECT status FROM sessions WHERE id=?").get(second.id).status,
    "active"
  );
});
it("another process committing during the sweep's own write still voids the census", async () => {
  const { DatabaseSync } = require("node:sqlite");
  const first = fixture();
  const second = fixture();
  const other = new DatabaseSync(process.env.DASHBOARD_DB_PATH);
  try {
    const select = createCodexProbeFence([first.file, second.file], db);
    await Promise.resolve();
    select.ownWrites(() => {
      ingestCodexTranscript(first.file, {
        liveTranscripts: select(absent, first.file, fs.statSync(first.file)),
      });
      other.exec("CREATE TABLE IF NOT EXISTS other_writer(x); INSERT INTO other_writer VALUES(1)");
    });
    assert.equal(select(absent, second.file, fs.statSync(second.file)), null);
  } finally {
    other.close();
  }
});
it("unobserved paths and unavailable census remain unknown, positive evidence stays safe", () => {
  const { file } = fixture();
  const select = createCodexProbeFence([], db),
    stat = fs.statSync(file);
  assert.equal(select(absent, file, stat), null);
  assert.equal(select({ available: false }, file, stat), null);
  const positive = { available: true, paths: new Set([file]) };
  assert.equal(select(positive, file, stat), positive.paths);
});

it("async discovery observations preserve the negative fence without another synchronous stat pass", async (t) => {
  const { file } = fixture();
  const { findCodexTranscriptsAsync } = require("../lib/codex-ingest");
  const observations = new Map();
  const transcripts = await findCodexTranscriptsAsync(path.dirname(file), { observations });
  const statSync = fs.statSync;
  t.after(() => {
    fs.statSync = statSync;
  });
  fs.statSync = () => {
    throw new Error("synchronous fence metadata pass");
  };
  const select = createCodexProbeFence(transcripts, db, observations);
  const fresh = await fs.promises.stat(file);
  assert.equal(select(absent, file, fresh), absent.paths);
  fs.appendFileSync(file, "{}\n");
  assert.equal(select(absent, file, await fs.promises.stat(file)), null);
});
