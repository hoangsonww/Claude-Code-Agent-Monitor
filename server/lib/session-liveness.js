/**
 * @file Process-liveness probes for Claude Code and Codex sessions. Answers
 * "could a live provider CLI own this session?" by listing matching processes
 * and their working directories. Used by the hooks watchdog to reap sessions
 * whose SessionEnd hook was lost while the dashboard was offline.
 *
 * Fail-safe by design: whenever the probe cannot produce a trustworthy
 * answer it reports `available: false` and the caller must change nothing.
 * That covers Windows (no probe implementation), containers (host processes
 * are invisible, so an empty process list would be a lie), missing `ps` /
 * `lsof` binaries, and the DASHBOARD_LIVENESS_PROBE=0 escape hatch for
 * setups where hooks arrive from another machine.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { execFileSync, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const execFileAsync = promisify(execFile);
const fs = require("node:fs");
const path = require("node:path");
const { isInsideContainer } = require("../../scripts/install-hooks");

const UNAVAILABLE = () => ({ available: false, cwds: new Set() });

/**
 * True when a `ps` args string launches the requested agent CLI. Matches the
 * bare binary and interpreter-launched shims while requiring an exact basename
 * so lookalike commands never make a stale session appear alive.
 */
function isAgentCommand(args, binary) {
  if (typeof args !== "string") return false;
  if (typeof binary !== "string" || !binary) return false;
  const tokens = args.trim().split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) return false;
  if (path.basename(tokens[0]) === binary) return true;
  const interpreter = path.basename(tokens[0]);
  if ((interpreter === "node" || interpreter === "bun") && tokens[1]) {
    return path.basename(tokens[1]) === binary;
  }
  return false;
}

function isClaudeCommand(args) {
  return isAgentCommand(args, "claude");
}

function isCodexCommand(args) {
  return isAgentCommand(args, "codex");
}

/** True when the probe is explicitly disabled via env. */
function probeDisabledByEnv() {
  const raw = (process.env.DASHBOARD_LIVENESS_PROBE || "").trim().toLowerCase();
  return raw === "0" || raw === "false" || raw === "no" || raw === "off";
}

/**
 * Enumerate the working directories of every live provider CLI process.
 *
 * @returns {{ available: boolean, cwds: Set<string> }} `available: false`
 * means "no trustworthy answer — do not act"; an `available: true` result
 * with an empty set genuinely means no claude process is running.
 */
function probeLiveCwds(binary = "claude") {
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
    if (m && isAgentCommand(m[2], binary)) pids.push(m[1]);
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

/**
 * Enumerate the exact rollout JSONL files held open by live Codex processes.
 * This is stronger than cwd matching: multiple historical and live Codex
 * sessions commonly share one repository, while each live native process keeps
 * only its own rollout open. Unavailable means callers must fall back to the
 * conservative cwd probe and must not infer that any session is dead.
 */
function probeLiveCodexRollouts() {
  if (probeDisabledByEnv() || process.platform === "win32" || isInsideContainer()) {
    return { available: false, paths: new Set() };
  }

  let psOut;
  try {
    psOut = execFileSync("ps", ["-Ao", "pid=,args="], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return { available: false, paths: new Set() };
  }
  const pids = [];
  for (const line of psOut.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(.*)$/);
    if (match && isCodexCommand(match[2])) pids.push(match[1]);
  }
  const paths = new Set();
  if (pids.length === 0) return { available: true, paths };

  const remember = (candidate) => {
    if (typeof candidate !== "string") return;
    if (!candidate.endsWith(".jsonl") || !path.basename(candidate).startsWith("rollout-")) return;
    paths.add(path.resolve(candidate));
  };

  if (process.platform === "linux") {
    for (const pid of pids) {
      let descriptors;
      try {
        descriptors = fs.readdirSync(`/proc/${pid}/fd`);
      } catch {
        continue;
      }
      for (const descriptor of descriptors) {
        try {
          remember(fs.readlinkSync(`/proc/${pid}/fd/${descriptor}`));
        } catch {
          /* descriptor closed between listing and read */
        }
      }
    }
    return { available: true, paths };
  }

  let lsofOut;
  try {
    lsofOut = execFileSync("lsof", ["-a", "-p", pids.join(","), "-Fn"], {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    lsofOut = err && typeof err.stdout === "string" && err.stdout ? err.stdout : null;
    if (lsofOut === null) return { available: false, paths: new Set() };
  }
  for (const line of lsofOut.split("\n")) {
    if (line.startsWith("n")) remember(line.slice(1));
  }
  return { available: true, paths };
}

// Each consumer starts its census after capturing its own lifecycle fence.
// Watchdog/reaper and discovery callers bound their complete work separately;
// sharing an older discovery census could close a newly active session at boot.
// A process that exited between ps and the per-pid read holds nothing open, so
// skipping it keeps the census complete. A pid that still exists but cannot be
// read (another user's process, a timeout) still makes the census unavailable.
function processGone(pid) {
  try {
    process.kill(Number(pid), 0);
    return false;
  } catch (error) {
    return error?.code === "ESRCH";
  }
}
function exitedBeforeRead(error, pid) {
  return error?.code === "ENOENT" || error?.code === "ESRCH" || processGone(pid);
}
// Only this user's processes can be this dashboard's sessions, and another
// user's cwd and descriptors are unreadable; listing them would leave every
// census incomplete on a shared host. Without getuid (Windows) keep all rows.
const PS_ARGS = ["-Ao", "pid=,uid=,args="];
function ownProcessRows(psOut) {
  const uid = typeof process.getuid === "function" ? String(process.getuid()) : null;
  const rows = [];
  for (const line of psOut.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
    if (m && (uid === null || m[2] === uid)) rows.push({ pid: m[1], args: m[3] });
  }
  return rows;
}

// lsof exits 1 when some requested pids vanished but still prints the rest.
// A killed or truncated run is never usable; a completed non-zero exit is
// usable only when the caller finds exited pids that explain it.
async function lsofRecords(args, maxBuffer) {
  try {
    const { stdout } = await execFileAsync("lsof", args, {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer,
    });
    return { stdout, failed: false };
  } catch (error) {
    const exited = typeof error?.code === "number" && !error.killed && !error.signal;
    return exited && typeof error.stdout === "string"
      ? { stdout: error.stdout, failed: true }
      : null;
  }
}

function probeLiveCwdsAsync(binary = "claude") {
  return probeLiveCwdsAsyncImpl(binary);
}
function probeLiveCodexRolloutsAsync() {
  return probeLiveCodexRolloutsAsyncImpl();
}
async function probeLiveCwdsAsyncImpl(binary = "claude") {
  if (probeDisabledByEnv()) return UNAVAILABLE();
  if (process.platform === "win32") return UNAVAILABLE();
  if (isInsideContainer()) return UNAVAILABLE();

  let psOut;
  try {
    psOut = (
      await execFileAsync("ps", PS_ARGS, {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 16 * 1024 * 1024,
      })
    ).stdout;
  } catch {
    return UNAVAILABLE();
  }

  const pids = ownProcessRows(psOut)
    .filter((row) => isAgentCommand(row.args, binary))
    .map((row) => row.pid);
  const cwds = new Set();
  if (pids.length === 0) return { available: true, cwds };

  if (process.platform === "linux") {
    // /proc is authoritative and needs no external binary.
    for (const pid of pids) {
      try {
        cwds.add(path.resolve(await fs.promises.readlink(`/proc/${pid}/cwd`)));
      } catch (error) {
        if (exitedBeforeRead(error, pid)) continue;
        return UNAVAILABLE(); // An incomplete census cannot prove absence.
      }
    }
    return { available: true, cwds };
  }

  // macOS (and other BSD-likes): resolve each pid's cwd via lsof. `-Fn`
  // machine format emits `p<pid>` / `f cwd` / `n<path>` records.
  const census = await lsofRecords(
    ["-a", "-p", pids.join(","), "-d", "cwd", "-Fn"],
    16 * 1024 * 1024
  );
  if (!census) return UNAVAILABLE();
  const lsofOut = census.stdout;
  const resolvedPids = new Set();
  let currentPid = null;
  for (const line of lsofOut.split("\n")) {
    if (/^p\d+$/.test(line)) currentPid = line.slice(1);
    if (line.startsWith("n") && path.posix.isAbsolute(line.slice(1))) {
      cwds.add(path.resolve(line.slice(1)));
      resolvedPids.add(currentPid);
    }
  }
  // Partial output proves absence only for pids that no longer exist.
  const missing = pids.filter((pid) => !resolvedPids.has(pid));
  if (missing.some((pid) => !processGone(pid))) return UNAVAILABLE();
  if (census.failed && missing.length === 0) return UNAVAILABLE();
  return { available: true, cwds };
}

async function probeLiveCodexRolloutsAsyncImpl() {
  if (probeDisabledByEnv() || process.platform === "win32" || isInsideContainer()) {
    return { available: false, paths: new Set() };
  }

  let psOut;
  try {
    psOut = (
      await execFileAsync("ps", PS_ARGS, {
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 16 * 1024 * 1024,
      })
    ).stdout;
  } catch {
    return { available: false, paths: new Set() };
  }
  const pids = ownProcessRows(psOut)
    .filter((row) => isCodexCommand(row.args))
    .map((row) => row.pid);
  const paths = new Set();
  if (pids.length === 0) return { available: true, paths };

  const remember = (candidate) => {
    if (typeof candidate !== "string") return;
    if (!candidate.endsWith(".jsonl") || !path.basename(candidate).startsWith("rollout-")) return;
    paths.add(path.resolve(candidate));
  };

  if (process.platform === "linux") {
    for (const pid of pids) {
      let descriptors;
      try {
        descriptors = await fs.promises.readdir(`/proc/${pid}/fd`);
      } catch (error) {
        if (exitedBeforeRead(error, pid)) continue;
        return { available: false, paths: new Set() };
      }
      for (const descriptor of descriptors) {
        try {
          remember(await fs.promises.readlink(`/proc/${pid}/fd/${descriptor}`));
        } catch (error) {
          // A descriptor closed between readdir and readlink is skipped: the file
          // it held is no longer open, so it cannot prove the session live.
          if (error?.code === "ENOENT" || processGone(pid)) continue;
          return { available: false, paths: new Set() };
        }
      }
    }
    return { available: true, paths };
  }

  const census = await lsofRecords(["-a", "-p", pids.join(","), "-Fn"], 32 * 1024 * 1024);
  if (!census) return { available: false, paths: new Set() };
  const lsofOut = census.stdout;
  const observedPids = new Set(
    lsofOut
      .split("\n")
      .filter((line) => /^p\d+$/.test(line))
      .map((line) => line.slice(1))
  );
  const missing = pids.filter((pid) => !observedPids.has(pid));
  if (missing.some((pid) => !processGone(pid)) || (census.failed && missing.length === 0))
    return { available: false, paths: new Set() };
  for (const line of lsofOut.split("\n")) {
    if (line.startsWith("n")) remember(line.slice(1));
  }
  return { available: true, paths };
}

module.exports = {
  probeLiveCwds,
  probeLiveCwdsAsync,
  probeLiveCodexRolloutsAsync,
  probeLiveCodexRollouts,
  isAgentCommand,
  isClaudeCommand,
  isCodexCommand,
};
