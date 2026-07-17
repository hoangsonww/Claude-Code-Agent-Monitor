/**
 * @file Regression: the generic idle-timeout notification "Claude is waiting for
 * your input" (fires ~60 s after a turn ends) must NOT be treated as an
 * actionable "asked you something" wait. It is semantically identical to Stop —
 * the session is simply idle — so it is stamped as the passive 'stop' reason
 * (idle everywhere: AI-Deck Zzz, deck-web PASSIV, no toast). Only ACTIONABLE
 * notifications (permission / a real question) get reason 'notification' (???).
 *
 * home-network monitor fork (see ai-deck decisions/). Lives in the fork's suite
 * so an upstream merge that reverts the split fails loudly here.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `notif-split-${Date.now()}-${process.pid}.db`);
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
        headers: { "Content-Type": "application/json" },
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

const hook = (hook_type, data) =>
  fetch("/api/hooks/event", { method: "POST", body: { hook_type, data } });
const reasonOf = async (id) => (await fetch(`/api/sessions/${id}`)).body.session.awaiting_reason;

before(async () => {
  server = await startServer(createApp(), 0);
  BASE = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
});

describe("Notification: idle-timeout vs. actionable", () => {
  it("'Claude is waiting for your input' → passive 'stop' (idle, no false ???)", async () => {
    const sid = "notif-idle";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    await hook("Notification", { session_id: sid, message: "Claude is waiting for your input" });
    assert.equal(
      await reasonOf(sid),
      "stop",
      "generic idle-wait must be passive, not 'notification'"
    );
  });

  it("'Claude needs your permission' → actionable 'notification' (???)", async () => {
    const sid = "notif-perm";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    await hook("Notification", {
      session_id: sid,
      message: "Claude needs your permission to use Bash",
    });
    assert.equal(await reasonOf(sid), "notification", "permission prompt must stay actionable");
  });

  it("a real question notification stays actionable 'notification'", async () => {
    const sid = "notif-q";
    await hook("SessionStart", { session_id: sid });
    await hook("UserPromptSubmit", { session_id: sid, prompt: "go" });
    // AskUserQuestion-style: awaiting your approval/response — actionable.
    await hook("Notification", {
      session_id: sid,
      message: "Waiting for your approval to proceed",
    });
    assert.equal(await reasonOf(sid), "notification");
  });
});
