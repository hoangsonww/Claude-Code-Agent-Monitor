/**
 * @file Tests for the `ccam` umbrella CLI (bin/ccam.js). Spawns the real CLI
 * as a subprocess against a live in-test dashboard server and asserts each
 * command's output shape across the whole surface: monitoring (health, stats,
 * kanban), data browsing (sessions, session detail, agents, events), insights
 * (analytics, workflows, runs, cost), alerts/rules/webhooks, pricing CRUD,
 * import, administration (doctor, info, export, cleanup, clear-data guard),
 * plus help and error paths.
 *
 * The CLI must be spawned ASYNCHRONOUSLY (child_process.spawn, not
 * spawnSync): the dashboard server lives in THIS process, so a synchronous
 * spawn would block the event loop and deadlock every request the child
 * makes. Port targeting uses the DASHBOARD_PORT env override, which takes
 * precedence over ~/.claude/.agent-dashboard.json discovery.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const { spawn } = require("child_process");

const STAMP = `ccam-cli-${Date.now()}-${process.pid}`;
const TMP = path.join(os.tmpdir(), STAMP);
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "home");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { createApp, startServer } = require("../index");
const { db } = require("../db");

const CLI = path.resolve(__dirname, "..", "..", "bin", "ccam.js");

let server;
let PORT;

/**
 * Run the CLI asynchronously against the test server. Async is load-bearing:
 * the server runs in this same process, so a blocking spawnSync would starve
 * its event loop and every CLI request would hang until timeout.
 */
function ccam(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, DASHBOARD_PORT: String(PORT) },
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const killer = setTimeout(() => child.kill("SIGKILL"), 20_000);
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({ code, out, err });
    });
  });
}

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: urlPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

before(async () => {
  const app = createApp();
  server = await startServer(app, 0);
  PORT = server.address().port;
  // Seed one session via the real hook path so list commands have a row.
  const code = await post("/api/hooks/event", {
    hook_type: "Stop",
    data: { session_id: "cli-test-session-0001", cwd: "/tmp/ccam-cli" },
  });
  assert.equal(code, 200);
});

after(() => {
  if (server) server.close();
  if (db) db.close();
  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("ccam CLI — monitoring", () => {
  it("health reports the dashboard as up", async () => {
    const { code, out } = await ccam("health");
    assert.equal(code, 0);
    assert.match(out, /Dashboard/);
    assert.match(out, /up/);
    assert.match(out, new RegExp(String(PORT)));
  });

  it("stats prints totals including the seeded session", async () => {
    const { code, out } = await ccam("stats");
    assert.equal(code, 0);
    assert.match(out, /Total sessions/);
    assert.match(out, /Events today/);
    assert.match(out, /Sessions by status/);
  });

  it("kanban groups sessions and agents into status columns", async () => {
    const { code, out } = await ccam("kanban");
    assert.equal(code, 0);
    assert.match(out, /Sessions/);
    assert.match(out, /Agents/);
    assert.match(out, /active \(1\)/);
    assert.match(out, /waiting \(1\)/); // the main agent lands in waiting after Stop
  });
});

describe("ccam CLI — data browsing", () => {
  it("sessions lists the seeded session", async () => {
    const { code, out } = await ccam("sessions", "--limit", "5");
    assert.equal(code, 0);
    assert.match(out, /cli-test/);
    assert.match(out, /of 1 session/);
  });

  it("sessions --status filters correctly", async () => {
    const { code, out } = await ccam("sessions", "--status", "completed");
    assert.equal(code, 0);
    assert.match(out, /of 0 session/);
  });

  it("session <id> shows detail with agents and recent events", async () => {
    const { code, out } = await ccam("session", "cli-test-session-0001");
    assert.equal(code, 0);
    assert.match(out, /cli-test-session-0001/);
    assert.match(out, /Agents/);
    assert.match(out, /Recent events/);
  });

  it("session without an id exits 1 with usage", async () => {
    const { code, err } = await ccam("session");
    assert.equal(code, 1);
    assert.match(err, /Usage: ccam session/);
  });

  it("agents lists the auto-created main agent", async () => {
    const { code, out } = await ccam("agents", "--session", "cli-test-session-0001");
    assert.equal(code, 0);
    assert.match(out, /main/);
  });

  it("events lists the seeded Stop event", async () => {
    const { code, out } = await ccam("events", "--session", "cli-test-session-0001");
    assert.equal(code, 0);
    assert.match(out, /Stop/);
  });
});

describe("ccam CLI — insights", () => {
  it("analytics prints token totals and averages", async () => {
    const { code, out } = await ccam("analytics");
    assert.equal(code, 0);
    assert.match(out, /Tokens/);
    assert.match(out, /Input/);
  });

  it("workflows prints intelligence stats", async () => {
    const { code, out } = await ccam("workflows");
    assert.equal(code, 0);
    assert.match(out, /Workflow intelligence/);
    assert.match(out, /Sessions analyzed/);
  });

  it("runs lists dynamic workflow runs (empty is fine)", async () => {
    const { code, out } = await ccam("runs");
    assert.equal(code, 0);
    assert.match(out, /Run/);
    assert.match(out, /Status/);
  });

  it("cost prints a total", async () => {
    const { code, out } = await ccam("cost");
    assert.equal(code, 0);
    assert.match(out, /Total estimated cost: \$/);
  });
});

describe("ccam CLI — alerts, rules, webhooks", () => {
  it("alerts lists the (empty) fired-alert feed", async () => {
    const { code, out } = await ccam("alerts");
    assert.equal(code, 0);
    assert.match(out, /unacknowledged of/);
  });

  it("alerts ack-all succeeds on an empty feed", async () => {
    const { code, out } = await ccam("alerts", "ack-all");
    assert.equal(code, 0);
    assert.match(out, /Acknowledged/);
  });

  it("rules lists alert rules", async () => {
    const { code, out } = await ccam("rules");
    assert.equal(code, 0);
    assert.match(out, /Enabled/);
  });

  it("webhooks lists targets", async () => {
    const { code, out } = await ccam("webhooks");
    assert.equal(code, 0);
    assert.match(out, /Provider/);
  });
});

describe("ccam CLI — pricing", () => {
  it("pricing lists the default rules", async () => {
    const { code, out } = await ccam("pricing");
    assert.equal(code, 0);
    assert.match(out, /Pattern/);
    assert.match(out, /claude/);
  });

  it("pricing set / delete round-trips a custom rule", async () => {
    const set = await ccam(
      "pricing",
      "set",
      "ccam-test-model%",
      "--input",
      "1",
      "--output",
      "2",
      "--cache-read",
      "0.1",
      "--cache-write",
      "1.25"
    );
    assert.equal(set.code, 0, `stderr: ${set.err} stdout: ${set.out}`);
    assert.match(set.out, /saved/);
    const list = await ccam("pricing");
    assert.match(list.out, /ccam-test-model%/);
    const del = await ccam("pricing", "delete", "ccam-test-model%");
    assert.equal(del.code, 0);
    assert.match(del.out, /deleted/);
  });
});

describe("ccam CLI — import & administration", () => {
  it("import rescan runs against the (empty) default projects dir", async () => {
    const { code, out } = await ccam("import", "rescan");
    assert.equal(code, 0);
    assert.match(out, /imported \d+/);
  });

  it("import without a subcommand exits 1 with usage", async () => {
    const { code, err } = await ccam("import");
    assert.equal(code, 1);
    assert.match(err, /Usage: ccam import/);
  });

  it("doctor reports API, hooks, database, and uptime lines", async () => {
    const { code, out } = await ccam("doctor");
    assert.equal(code, 0);
    assert.match(out, /API reachable/);
    assert.match(out, /Claude Code hooks/);
    assert.match(out, /Database/);
    assert.match(out, /Server uptime/);
  });

  it("info dumps system info JSON", async () => {
    const { code, out } = await ccam("info");
    assert.equal(code, 0);
    const parsed = JSON.parse(out);
    assert.ok(parsed.db);
    assert.ok(parsed.server);
  });

  it("export writes a JSON file containing the seeded session", async () => {
    const file = path.join(TMP, "export.json");
    const { code, out } = await ccam("export", file);
    assert.equal(code, 0);
    assert.match(out, /Exported to/);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.ok(JSON.stringify(data).includes("cli-test-session-0001"));
  });

  it("cleanup without flags exits 1 with usage", async () => {
    const { code, err } = await ccam("cleanup");
    assert.equal(code, 1);
    assert.match(err, /Usage: ccam cleanup/);
  });

  it("cleanup with flags runs", async () => {
    const { code, out } = await ccam("cleanup", "--days", "3650");
    assert.equal(code, 0);
    assert.match(out, /Cleanup done/);
  });

  it("clear-data REFUSES without --yes", async () => {
    const { code, err } = await ccam("clear-data");
    assert.equal(code, 1);
    assert.match(err, /--yes/);
    // Data must be intact.
    const { out } = await ccam("sessions");
    assert.match(out, /of 1 session/);
  });

  it("clear-data --yes wipes rows (runs last)", async () => {
    const { code, out } = await ccam("clear-data", "--yes");
    assert.equal(code, 0);
    assert.match(out, /cleared/);
    const { out: after } = await ccam("sessions");
    assert.match(after, /of 0 session/);
  });
});

describe("ccam CLI — help & errors", () => {
  it("help lists every command group", async () => {
    const { code, out } = await ccam("help");
    assert.equal(code, 0);
    for (const word of [
      "health",
      "stats",
      "kanban",
      "tail",
      "sessions",
      "session <id>",
      "agents",
      "events",
      "analytics",
      "workflows",
      "runs",
      "cost",
      "alerts",
      "rules",
      "webhooks",
      "pricing",
      "import",
      "doctor",
      "info",
      "export",
      "cleanup",
      "reinstall-hooks",
      "clear-data",
      "open",
    ]) {
      assert.ok(out.includes(word), `help should mention ${word}`);
    }
  });

  it("no arguments prints help and exits 0", async () => {
    const { code, out } = await ccam();
    assert.equal(code, 0);
    assert.match(out, /Usage: ccam <command>/);
  });

  it("unknown command exits 1 with an error", async () => {
    const { code, err } = await ccam("frobnicate");
    assert.equal(code, 1);
    assert.match(err, /Unknown command/);
  });

  it("unreachable server exits 1 with a start hint", async () => {
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "health"], {
        env: { ...process.env, DASHBOARD_PORT: "1" }, // nothing listens on port 1
      });
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => resolve({ code, err }));
    });
    assert.equal(r.code, 1);
    assert.match(r.err, /Cannot reach the dashboard/);
    assert.match(r.err, /npm run dev/);
  });
});
