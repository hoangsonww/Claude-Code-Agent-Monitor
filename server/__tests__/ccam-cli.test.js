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

describe("ccam CLI — offline mode (server down, DB read directly)", () => {
  // The online admin suite ends with clear-data, so re-seed one session here
  // (through the live server) for the offline reads to find.
  before(async () => {
    const code = await post("/api/hooks/event", {
      hook_type: "Stop",
      data: { session_id: "cli-test-offline-0002", cwd: "/tmp/ccam-cli-off" },
    });
    assert.equal(code, 200);
  });

  /** Run the CLI with an unreachable port so it falls back to offline reads
   *  of the SAME database file the in-test server uses (WAL second reader). */
  function offline(...args) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, ...args], {
        env: { ...process.env, DASHBOARD_PORT: "1" },
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

  it("sessions falls back to offline reads with the banner", async () => {
    const { code, out } = await offline("sessions", "--limit", "5");
    assert.equal(code, 0);
    assert.match(out, /Offline mode/);
    assert.match(out, /ccam start/);
    assert.match(out, /cli-test/);
    assert.match(out, /of 1 session/);
  });

  it("stats works offline", async () => {
    const { code, out } = await offline("stats");
    assert.equal(code, 0);
    assert.match(out, /Total sessions/);
    assert.match(out, /offline/);
  });

  it("session <id> works offline and flags cost as server-only", async () => {
    const { code, out } = await offline("session", "cli-test-offline-0002");
    assert.equal(code, 0);
    assert.match(out, /Agents/);
    assert.match(out, /Cost\s+requires the server/);
  });

  it("kanban works offline", async () => {
    const { code, out } = await offline("kanban");
    assert.equal(code, 0);
    assert.match(out, /Sessions/);
    assert.match(out, /Agents/);
  });

  it("pricing list works offline; pricing set is refused with a reason", async () => {
    const list = await offline("pricing");
    assert.equal(list.code, 0);
    assert.match(list.out, /claude/);
    const set = await offline("pricing", "set", "x%", "--input", "1", "--output", "1");
    assert.equal(set.code, 1);
    assert.match(set.err, /pricing changes must go through the server/);
  });

  it("rules and alerts list offline", async () => {
    const rules = await offline("rules");
    assert.equal(rules.code, 0);
    const alerts = await offline("alerts");
    assert.equal(alerts.code, 0);
    assert.match(alerts.out, /unacknowledged of/);
  });

  it("export works offline and marks the payload", async () => {
    const file = path.join(TMP, "offline-export.json");
    const { code } = await offline("export", file);
    assert.equal(code, 0);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(data.exported_offline, true);
    assert.ok(JSON.stringify(data.sessions).includes("cli-test-offline-0002"));
  });

  it("doctor works offline and reports the server as down", async () => {
    const { code, out } = await offline("doctor");
    assert.equal(code, 0);
    assert.match(out, /NOT running/);
    assert.match(out, /Database/);
    assert.match(out, /rows: sessions/);
  });

  it("cost refuses offline with the server-side-math reason", async () => {
    const { code, err } = await offline("cost");
    assert.equal(code, 1);
    assert.match(err, /cost math .* runs server-side/);
  });

  it("clear-data --yes refuses offline — data stays intact", async () => {
    const { code, err } = await offline("clear-data", "--yes");
    assert.equal(code, 1);
    assert.match(err, /data wipes must go through the server/);
    const { out } = await offline("sessions");
    assert.match(out, /of 1 session/);
  });

  it("prints the staleness caveat when the liveness probe is unavailable", async () => {
    // The suite env sets DASHBOARD_LIVENESS_PROBE=0, so the probe reports
    // unavailable and offline output must carry the "statuses as stored"
    // caveat instead of silently showing possibly-stale active rows.
    const { code, out } = await offline("sessions");
    assert.equal(code, 0);
    assert.match(out, /Statuses are as stored/);
  });

  it("corrects dead active sessions display-side when the probe can answer", async (t) => {
    // Only meaningful where the real probe works (macOS/Linux, not container).
    const { spawnSync } = require("child_process");
    const avail = spawnSync(
      process.execPath,
      [
        "-e",
        "const p=require(process.argv[1]).probeLiveCwds();console.log(p.available)",
        path.resolve(__dirname, "..", "lib", "session-liveness.js"),
      ],
      { encoding: "utf8", env: { ...process.env, DASHBOARD_LIVENESS_PROBE: "" } }
    ).stdout.trim();
    if (avail !== "true") {
      t.skip("liveness probe unavailable on this platform");
      return;
    }
    // Run offline WITHOUT the probe kill-switch: the seeded session's cwd
    // (/tmp/ccam-cli-off) has no running claude process, so its stored
    // "active" status must be DISPLAYED as completed, with the footnote —
    // and the database itself must keep the stored status.
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "sessions"], {
        env: { ...process.env, DASHBOARD_PORT: "1", DASHBOARD_LIVENESS_PROBE: "" },
      });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ code, out }));
    });
    assert.equal(r.code, 0);
    assert.match(r.out, /displayed as completed by the process-liveness probe/);
    // DB unchanged: the stored status is still whatever the server left there.
    const stored = db
      .prepare("SELECT status FROM sessions WHERE id = 'cli-test-offline-0002'")
      .get();
    assert.equal(stored.status, "active");
  });

  it("analytics/workflows/tail refuse offline with reasons", async () => {
    for (const cmd of ["analytics", "workflows", "tail"]) {
      const { code, err } = await offline(cmd);
      assert.equal(code, 1, `${cmd} should refuse offline`);
      assert.match(err, /No offline fallback/);
    }
  });
});

describe("ccam CLI — help & errors", () => {
  it("help lists every command group", async () => {
    const { code, out } = await ccam("help");
    assert.equal(code, 0);
    for (const word of [
      "status",
      "start",
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

  it("version prints the package version", async () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "..", "package.json"), "utf8")
    );
    const { code, out } = await ccam("version");
    assert.equal(code, 0);
    assert.equal(out.trim(), `ccam ${pkg.version}`);
    const flag = await ccam("--version");
    assert.equal(flag.out.trim(), `ccam ${pkg.version}`);
  });

  it("--no-color is accepted anywhere on the command line", async () => {
    const before = await ccam("--no-color", "health");
    assert.equal(before.code, 0);
    assert.match(before.out, /Dashboard/);
    const after = await ccam("sessions", "--no-color");
    assert.equal(after.code, 0);
    assert.match(after.out, /of 1 session/);
  });

  it("piped output contains no ANSI escape codes (colors off when not a TTY)", async () => {
    const { out } = await ccam("stats");
    assert.ok(!out.includes("\x1b["), "piped output must be plain text");
  });

  it("tables render with box-drawing borders and an Updated column", async () => {
    const { out } = await ccam("sessions");
    assert.ok(out.includes("╭"), "table should have a top border");
    assert.ok(out.includes("│"), "table should have column separators");
    assert.match(out, /Updated/);
  });

  it("unknown command exits 1 with an error", async () => {
    const { code, err } = await ccam("frobnicate");
    assert.equal(code, 1);
    assert.match(err, /Unknown command/);
  });

  it("unreachable server exits 1 with the not-running indicator + start hint", async () => {
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "health"], {
        env: { ...process.env, DASHBOARD_PORT: "1" }, // nothing listens on port 1
      });
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => resolve({ code, err }));
    });
    assert.equal(r.code, 1);
    assert.match(r.err, /Dashboard server is NOT running/);
    assert.match(r.err, /ccam start/);
    assert.match(r.err, /npm run dev/);
  });

  it("status reports running when the server is up", async () => {
    const { code, out } = await ccam("status");
    assert.equal(code, 0);
    assert.match(out, /running/);
    assert.match(out, new RegExp(String(PORT)));
  });

  it("status exits 1 with the down indicator when the server is down", async () => {
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, [CLI, "status"], {
        env: { ...process.env, DASHBOARD_PORT: "1" },
      });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ code, out }));
    });
    assert.equal(r.code, 1);
    assert.match(r.out, /NOT running/);
    assert.match(r.out, /ccam start/);
  });

  it("start no-ops with a pointer when a server is already running", async () => {
    const { code, out } = await ccam("start");
    assert.equal(code, 0);
    assert.match(out, /already running/);
  });
});
