/**
 * @file Verifies real HTTP responsiveness during a batch of session task reads,
 * preserves all task summaries and forwards failures after yielding to Express.
 * The child uses real synchronous SQLite work so the client can observe stalls.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-session-responsive-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));
const childCode = `
  const { createApp, startServer } = require('./server/index');
  const { db, stmts } = require('./server/db');
  for (let n = 0; n < 8; n++) {
    const id = 'responsive-' + n;
    db.prepare('INSERT INTO sessions(id,name,cwd,provider) VALUES(?,?,?,?)').run(id,id,process.env.CLAUDE_HOME,'claude');
    db.prepare('INSERT INTO agents(id,session_id,name,type) VALUES(?,?,?,?)').run(id,id,id,'main');
    db.prepare('INSERT INTO events(session_id,agent_id,event_type,summary,data) VALUES(?,?,?,?,?)').run(id,id,'TaskCreated','One task',JSON.stringify({task_id:'one',status:'pending'}));
  }
  const slow = db.prepare('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<400000) SELECT MAX(x) FROM n');
  const original = stmts.listTaskEventsBySession.all;
  let calls = 0, failAt = 0;
  stmts.listTaskEventsBySession.all = function(...args) {
    calls++;
    if (calls === 1) process.send({type:'summary-started'});
    slow.get();
    if (calls === failAt) throw new Error('task read failed');
    return original.apply(this,args);
  };
  process.on('message', message => {
    if (message.type === 'reset') { calls=0;failAt=message.failAt||0;process.send({type:'reset'}); }
    if (message.type === 'read-count') process.send({type:'read-count',calls});
  });
  startServer(createApp(),0).then(server => {
    server.on('request',(req,res)=>{
      if(req.url.includes('tag=abort'))res.once('close',()=>process.send({type:'abort-closed',calls}));
    });
    process.send({type:'ready',port:server.address().port});
    process.on('message', message => {
      if (message.type !== 'close') return;
      server.close();server.closeAllConnections();db.close();process.exit(0);
    });
  });
`;
function message(child, type) {
  return new Promise((resolve, reject) => {
    const onMessage = (row) => {
      if (row.type !== type) return;
      child.off("message", onMessage);
      child.off("exit", onExit);
      resolve(row);
    };
    const onExit = (code) => {
      child.off("message", onMessage);
      reject(new Error(`Child exited (${code}) before ${type}`));
    };
    child.on("message", onMessage);
    child.once("exit", onExit);
  });
}
it(
  "health finishes before session summaries, whose complete output and later errors are preserved",
  { timeout: 30000 },
  async () => {
    const child = spawn(process.execPath, ["-e", childCode], {
      cwd: path.resolve(__dirname, "../.."),
      env: {
        ...process.env,
        NODE_OPTIONS: "",
        NODE_ENV: "test",
        CLAUDE_HOME: path.join(root, "claude"),
        DASHBOARD_CODEX_HOME: path.join(root, "codex"),
        DASHBOARD_CURSOR_HOME: path.join(root, "cursor"),
        DASHBOARD_DATA_DIR: path.join(root, "data"),
        DASHBOARD_DB_PATH: path.join(root, "test.db"),
        DASHBOARD_REMOTE_SYNC_MS: "0",
        DASHBOARD_CODEX_SYNC_MS: "0",
        DASHBOARD_CURSOR_SYNC_MS: "0",
        DASHBOARD_SESSION_SYNC_MS: "0",
        DASHBOARD_LIVENESS_PROBE: "0",
        DASHBOARD_TOKEN_REPAIR: "0",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    try {
      const { port } = await message(child, "ready");
      const base = `http://127.0.0.1:${port}`;
      const started = message(child, "summary-started");
      let listDone = false;
      const list = fetch(base + "/api/sessions?limit=8&include_task_progress=1").then(
        async (res) => {
          assert.equal(res.status, 200);
          const result = await res.json();
          listDone = true;
          return result;
        }
      );
      await started;
      assert.equal((await fetch(base + "/api/health")).status, 200);
      assert.equal(listDone, false, "health must be served before the whole task batch finishes");
      const result = await list;
      assert.equal(result.sessions.length, 8);
      assert.equal(result.total, 8);
      for (const session of result.sessions) {
        assert.equal(session.todo_summary.total, 1);
        assert.equal(session.todo_summary.pending, 1);
      }
      const reset = message(child, "reset");
      child.send({ type: "reset", failAt: 2 });
      await reset;
      const failed = await fetch(base + "/api/sessions?limit=8&include_task_progress=true");
      assert.equal(
        failed.status,
        500,
        "an error after yielding must reach Express's error handler"
      );
      assert.deepEqual(await failed.json(), {
        error: { code: "INTERNAL_ERROR", message: "Internal server error" },
      });
      const resetAbort = message(child, "reset");
      child.send({ type: "reset" });
      await resetAbort;
      const controller = new AbortController();
      const abortStarted = message(child, "summary-started");
      const abortClosed = message(child, "abort-closed");
      const abandoned = fetch(base + "/api/sessions?limit=8&include_task_progress=1&tag=abort", {
        signal: controller.signal,
      });
      const rejected = assert.rejects(abandoned, (error) => error.name === "AbortError");
      await abortStarted;
      controller.abort();
      await rejected;
      const closed = await abortClosed;
      assert.ok(closed.calls < 8, "disconnect is observed between summary reads");
      for (let n = 0; n < 2; n++) {
        assert.equal((await fetch(base + "/api/health")).status, 200);
        const count = message(child, "read-count");
        child.send({ type: "read-count" });
        assert.equal((await count).calls, closed.calls, "no session reads follow response close");
      }
    } catch (error) {
      error.message += `\n${output.slice(-2000)}`;
      throw error;
    } finally {
      const closed = once(child, "exit");
      if (child.exitCode === null) child.kill("SIGTERM");
      await closed;
    }
  }
);
