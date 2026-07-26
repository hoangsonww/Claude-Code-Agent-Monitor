/**
 * @file Regression + feature coverage for the `awaiting_reason` self-block
 * classification in server/routes/hooks.js.
 *
 * Original regression (kept): a BACKGROUND subagent's tool events must not
 * clear a genuine 'notification' waiting flag held by the MAIN agent (blocked
 * on the user via AskUserQuestion / permission). Before that fix,
 * PreToolUse/PostToolUse cleared awaiting_input_since unconditionally, so a
 * session that was truly "waiting for you" oscillated back to active on every
 * subagent tool event — AI-Deck (12s poll) and deck-web (5s WS) then
 * disagreed about the same session.
 *
 * Newer feature (this file): the dashboard used to leave a session reading
 * "Active" (Stop handler) or a misleading generic "Waiting" (Notification
 * handler) whenever main was actually blocked on its OWN still-running child —
 * a subagent fleet, a synchronous Bash call, or a Monitor tool call — not on
 * the human. Three new awaiting_reason values ('subagent'/'shell'/'monitor')
 * let the row say so honestly:
 *   - Stop now proactively stamps 'subagent' the moment it sees a working
 *     subagent (was: silently clear and stay "Active"). The
 *     clearAwaitingInputRespectingActor guard now also preserves 'subagent'
 *     (not just 'notification') from a subagent's own routine tool events.
 *     The SubagentStop drain check downgrades 'subagent' -> 'stop' once the
 *     fleet truly drains.
 *   - Notification's classifyWaitingReason re-derives the true reason instead
 *     of always assuming 'notification': a permission/approval-worded message
 *     always wins (someone still has to answer it); otherwise a working
 *     subagent -> 'subagent', current_tool === 'Bash' -> 'shell',
 *     current_tool === 'Monitor' -> 'monitor'.
 *
 * This test lives in the fork's own suite so a future upstream merge that
 * silently reverts any of this fails loudly here (home-network monitor fork,
 * see decisions/).
 * @author Son Nguyen <hoangson091104@gmail.com>
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
 * Drive a session to: SessionStart -> UserPromptSubmit -> main (working)
 * spawns a subagent via the "Agent" tool (subagent row inserted with
 * status='working'). Returns nothing; the caller drives whatever happens
 * next (Stop vs Notification) and asserts on it.
 */
async function spawnWorkingSubagent(sid) {
  await hook("SessionStart", { session_id: sid });
  await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
  await hook("PreToolUse", {
    session_id: sid,
    tool_name: "Agent",
    tool_input: { subagent_type: "reviewer", prompt: "review" },
  });
}

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
});

describe("awaiting_reason: 'subagent' (Stop proactively stamps it, drain downgrades to 'stop')", () => {
  it("Stop proactively stamps 'subagent' while a subagent is still working", async () => {
    const sid = "guard-stop-subagent";
    await spawnWorkingSubagent(sid);

    await hook("Stop", { session_id: sid });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since, "Stop with a working subagent must stamp the flag");
    assert.equal(sess.awaiting_reason, "subagent");
    assert.equal(sess.status, "active", "session stays active, not error/completed");
  });

  it("PRESERVES 'subagent' when the fleet's own PreToolUse/PostToolUse fire", async () => {
    const sid = "guard-subagent-pre-post";
    await spawnWorkingSubagent(sid);
    await hook("Stop", { session_id: sid });
    let sess = await sessionOf(sid);
    assert.equal(sess.awaiting_reason, "subagent", "precondition");

    // The subagent (deepest working, main is waiting) runs tools. These must
    // NOT clear the 'subagent' flag Stop just stamped.
    await hook("PreToolUse", { session_id: sid, tool_name: "Grep" });
    sess = await sessionOf(sid);
    assert.equal(sess.awaiting_reason, "subagent", "subagent PreToolUse must not clear it");
    assert.ok(sess.awaiting_input_since);

    await hook("PostToolUse", { session_id: sid, tool_name: "Grep" });
    sess = await sessionOf(sid);
    assert.equal(sess.awaiting_reason, "subagent", "subagent PostToolUse must not clear it");
    assert.ok(sess.awaiting_input_since);
  });

  it("downgrades 'subagent' -> 'stop' when the last working subagent drains", async () => {
    const sid = "guard-subagent-drain";
    await spawnWorkingSubagent(sid);
    await hook("Stop", { session_id: sid });
    await hook("PreToolUse", { session_id: sid, tool_name: "Grep" });
    await hook("PostToolUse", { session_id: sid, tool_name: "Grep" });

    // The last working subagent finishes.
    await hook("SubagentStop", { session_id: sid, agent_type: "reviewer" });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since, "drain must land the fresh 'stop' stamp");
    assert.equal(sess.awaiting_reason, "stop");
  });

  it("a generic Notification while a subagent is working classifies as 'subagent', not 'notification'", async () => {
    const sid = "guard-notif-subagent";
    await spawnWorkingSubagent(sid);

    await hook("Notification", { session_id: sid, message: "Claude is waiting for your input" });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since);
    assert.equal(sess.awaiting_reason, "subagent");
  });
});

describe("awaiting_reason: 'notification' (genuine ask-the-human always wins)", () => {
  it("a permission-worded message stays 'notification' even while a subagent is working", async () => {
    const sid = "guard-notif-permission-over-subagent";
    await spawnWorkingSubagent(sid);

    await hook("Notification", {
      session_id: sid,
      message: "Claude needs your permission to run this command",
    });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since);
    assert.equal(sess.awaiting_reason, "notification");
  });

  it("PRESERVES a 'notification' wait when a background subagent fires PreToolUse/PostToolUse", async () => {
    const sid = "guard-notif-pre-post";
    await spawnWorkingSubagent(sid);
    await hook("Notification", {
      session_id: sid,
      message: "Claude needs your approval to proceed",
    });
    let sess = await sessionOf(sid);
    assert.equal(sess.awaiting_reason, "notification", "precondition");

    await hook("PreToolUse", { session_id: sid, tool_name: "Grep" });
    sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since, "notification wait must survive subagent PreToolUse");
    assert.equal(sess.awaiting_reason, "notification");

    await hook("PostToolUse", { session_id: sid, tool_name: "Grep" });
    sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since, "notification wait must survive subagent PostToolUse");
    assert.equal(sess.awaiting_reason, "notification");
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

describe("awaiting_reason: 'shell' and 'monitor' (main blocked mid its own tool call)", () => {
  it("a generic Notification mid-Bash classifies as 'shell', cleared by that Bash's own PostToolUse", async () => {
    const sid = "guard-notif-shell";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    // Main starts a (synchronous, still-running) Bash call.
    await hook("PreToolUse", { session_id: sid, tool_name: "Bash" });

    await hook("Notification", { session_id: sid, message: "Claude is waiting for your input" });
    let sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since);
    assert.equal(sess.awaiting_reason, "shell");

    // The Bash call returns.
    await hook("PostToolUse", { session_id: sid, tool_name: "Bash" });
    sess = await sessionOf(sid);
    assert.equal(sess.awaiting_input_since, null, "the finishing Bash call must clear 'shell'");
    assert.equal(sess.awaiting_reason, null);
  });

  it("a generic Notification mid-Monitor classifies as 'monitor', cleared by that call's own PostToolUse", async () => {
    const sid = "guard-notif-monitor";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    await hook("PreToolUse", { session_id: sid, tool_name: "Monitor" });

    await hook("Notification", { session_id: sid, message: "Claude is waiting for your input" });
    let sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since);
    assert.equal(sess.awaiting_reason, "monitor");

    await hook("PostToolUse", { session_id: sid, tool_name: "Monitor" });
    sess = await sessionOf(sid);
    assert.equal(
      sess.awaiting_input_since,
      null,
      "the finishing Monitor call must clear 'monitor'"
    );
    assert.equal(sess.awaiting_reason, null);
  });

  it("a permission-worded message mid-Bash still stays 'notification' (real ask wins)", async () => {
    const sid = "guard-notif-permission-over-shell";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    await hook("PreToolUse", { session_id: sid, tool_name: "Bash" });

    await hook("Notification", {
      session_id: sid,
      message: "Claude needs your permission to run this command",
    });

    const sess = await sessionOf(sid);
    assert.ok(sess.awaiting_input_since);
    assert.equal(sess.awaiting_reason, "notification");
  });
});
