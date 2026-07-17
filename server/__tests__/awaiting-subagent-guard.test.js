/**
 * @file Regression: a BACKGROUND subagent's tool events must not clear a
 * genuine 'notification' waiting flag held by the MAIN agent (blocked on the
 * user via AskUserQuestion / permission). Before the fix, PreToolUse/PostToolUse
 * cleared awaiting_input_since unconditionally, so a session that was truly
 * "waiting for you" oscillated back to active on every subagent tool event —
 * AI-Deck (12s poll) and deck-web (5s WS) then disagreed about the same session.
 *
 * The guard reuses the existing subagent-actor heuristic (findDeepestWorkingAgent
 * while main is 'waiting'): when a subagent is the actor, only PASSIVE waits
 * (stop/session_start/interrupted) are cleared; a 'notification' wait is
 * preserved. When MAIN is the actor, clearing is unconditional (keeps the
 * documented permission-mid-tool path intact).
 *
 * This test lives in the fork's own suite so a future upstream merge that
 * silently reverts the guard fails loudly here (home-network monitor fork,
 * see decisions/).
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `awaiting-guard-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");

let server;
let BASE;

function fetch(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...options.headers },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const post = (p, body) => fetch(p, { method: "POST", body });
const hook = (hook_type, data) => post("/api/hooks/event", { hook_type, data });
const sessionOf = async (id) => (await fetch(`/api/sessions/${id}`)).body.session;

/**
 * Drive a session into: main agent 'waiting' with the given reason, AND a live
 * working subagent (so findDeepestWorkingAgent returns it). Returns nothing;
 * asserts each precondition so a harness regression is obvious.
 */
async function sessionWaitingWithWorkingSubagent(sid, { notification }) {
  await hook("SessionStart", { session_id: sid });
  // UserPromptSubmit clears the session_start wait and promotes main → working.
  await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
  // Main (working) spawns a subagent → subagent row inserted with status working.
  await hook("PreToolUse", {
    session_id: sid,
    tool_name: "Agent",
    tool_input: { subagent_type: "reviewer", prompt: "review" },
  });
  // Now block the MAIN agent. A waiting-for-user Notification stamps
  // reason='notification'; a Stop stamps the passive reason='stop'.
  if (notification) {
    await hook("Notification", { session_id: sid, message: "Claude is waiting for your input" });
  } else {
    await hook("Stop", { session_id: sid });
  }
  const sess = await sessionOf(sid);
  assert.ok(sess.awaiting_input_since, "precondition: session should be awaiting");
  assert.equal(
    sess.awaiting_reason,
    notification ? "notification" : "stop",
    "precondition: expected awaiting_reason"
  );
}

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
});

describe("awaiting guard: subagent tool events vs. main-agent waiting", () => {
  it("PRESERVES a 'notification' wait when a background subagent fires PreToolUse", async () => {
    const sid = "guard-notif-pre";
    await sessionWaitingWithWorkingSubagent(sid, { notification: true });

    // Subagent (deepest working, main is waiting) runs a tool. This must NOT
    // clear the main agent's genuine "waiting for you" flag.
    await hook("PreToolUse", { session_id: sid, tool_name: "Bash" });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since, "notification wait must survive subagent PreToolUse");
    assert.equal(sess.awaiting_reason, "notification");
  });

  it("PRESERVES a 'notification' wait when a background subagent fires PostToolUse", async () => {
    const sid = "guard-notif-post";
    await sessionWaitingWithWorkingSubagent(sid, { notification: true });

    await hook("PostToolUse", { session_id: sid, tool_name: "Bash" });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since, "notification wait must survive subagent PostToolUse");
    assert.equal(sess.awaiting_reason, "notification");
  });

  it("CLEARS a passive 'stop' wait when a background subagent fires a tool event", async () => {
    // Passive-clear is desirable: a backgrounded subagent's activity should flip
    // a merely-Stopped session back to active ("done/idle only while no agent works").
    const sid = "guard-stop-pre";
    await sessionWaitingWithWorkingSubagent(sid, { notification: false });

    await hook("PreToolUse", { session_id: sid, tool_name: "Bash" });

    const sess = await sessionOf(sid);
    assert.equal(
      sess.awaiting_input_since,
      null,
      "passive stop wait should be cleared by subagent activity"
    );
    assert.equal(sess.awaiting_reason, null);
  });

  it("CLEARS a 'notification' wait when MAIN (no working subagent) resumes with a tool", async () => {
    // Control: main was waiting on the user, no subagent running. A PreToolUse
    // means main itself resumed — clearing is correct (unchanged behaviour).
    const sid = "guard-notif-mainactor";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    await hook("Notification", { session_id: sid, message: "Claude is waiting for your input" });
    let sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since && sess.awaiting_reason === "notification", "precondition");

    await hook("PreToolUse", { session_id: sid, tool_name: "Bash" });

    sess = await sessionOf(sid);
    assert.equal(sess.awaiting_input_since, null, "main resuming must clear its own wait");
    assert.equal(sess.awaiting_reason, null);
  });
});
