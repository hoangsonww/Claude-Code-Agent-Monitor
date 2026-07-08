/**
 * @file Process-liveness probe for Claude Code sessions. Answers "could any
 * running `claude` CLI process own this session?" by listing live claude
 * processes and their working directories. Used by the hooks watchdog to
 * reap sessions whose SessionEnd hook was lost because the dashboard was not
 * running when the user quit (e.g. Ctrl+C while the server was down) — the
 * only signal that a session ended is that hook, so a missed one previously
 * left the session stuck in Waiting until the 3 h stale sweep.
 *
 * Fail-safe by design: whenever the probe cannot produce a trustworthy
 * answer it reports `available: false` and the caller must change nothing.
 * That covers Windows (no probe implementation), containers (host processes
 * are invisible, so an empty process list would be a lie), missing `ps` /
 * `lsof` binaries, and the DASHBOARD_LIVENESS_PROBE=0 escape hatch for
 * setups where hooks arrive from another machine.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { isInsideContainer } = require("../../scripts/install-hooks");

const UNAVAILABLE = () => ({ available: false, cwds: new Set() });

/**
 * True when a `ps` args string is a Claude Code CLI process. Matches the
 * bare binary (`claude`, `/usr/local/bin/claude`) and interpreter-launched
 * shims (`node /path/to/claude`, `bun /path/to/claude`). The basename must
 * be exactly "claude" so lookalikes (claude-mem, Claude.app's `Claude`
 * binary, this project's own processes) never match.
 */
function isClaudeCommand(args) {
  if (typeof args !== "string") return false;
  const tokens = args.trim().split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) return false;
  if (path.basename(tokens[0]) === "claude") return true;
  const interpreter = path.basename(tokens[0]);
  if ((interpreter === "node" || interpreter === "bun") && tokens[1]) {
    return path.basename(tokens[1]) === "claude";
  }
  return false;
}

/** True when the probe is explicitly disabled via env. */
function probeDisabledByEnv() {
  const raw = (process.env.DASHBOARD_LIVENESS_PROBE || "").trim().toLowerCase();
  return raw === "0" || raw === "false" || raw === "no" || raw === "off";
}

/**
 * Enumerate the working directories of every live `claude` CLI process.
 *
 * @returns {{ available: boolean, cwds: Set<string> }} `available: false`
 * means "no trustworthy answer — do not act"; an `available: true` result
 * with an empty set genuinely means no claude process is running.
 */
function probeLiveCwds() {
  if (probeDisabledByEnv()) return UNAVAILABLE();
  if (process.platform === "win32") return UNAVAILABLE();
  if (isInsideContainer()) return UNAVAILABLE();

  let psOut;
  try {
    psOut = execFileSync("ps", ["-Ao", "pid=,args="], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return UNAVAILABLE();
  }

  const pids = [];
  for (const line of psOut.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (m && isClaudeCommand(m[2])) pids.push(m[1]);
  }
  const cwds = new Set();
  if (pids.length === 0) return { available: true, cwds };

  if (process.platform === "linux") {
    // /proc is authoritative and needs no external binary.
    for (const pid of pids) {
      try {
        cwds.add(path.resolve(fs.readlinkSync(`/proc/${pid}/cwd`)));
      } catch {
        /* process exited between ps and readlink — skip */
      }
    }
    return { available: true, cwds };
  }

  // macOS (and other BSD-likes): resolve each pid's cwd via lsof. `-Fn`
  // machine format emits `p<pid>` / `f cwd` / `n<path>` records.
  let lsofOut;
  try {
    lsofOut = execFileSync("lsof", ["-a", "-p", pids.join(","), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    // lsof exits non-zero when SOME of the pids vanished between ps and
    // lsof but still prints records for the rest — keep that partial
    // output. No stdout at all (binary missing, hard failure) → no answer.
    lsofOut = err && typeof err.stdout === "string" && err.stdout ? err.stdout : null;
    if (lsofOut === null) return UNAVAILABLE();
  }
  for (const line of lsofOut.split("\n")) {
    if (line.startsWith("n") && line.length > 1) cwds.add(path.resolve(line.slice(1)));
  }
  return { available: true, cwds };
}

module.exports = { probeLiveCwds, isClaudeCommand };
