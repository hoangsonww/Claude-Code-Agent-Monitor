/**
 * @file server-info.js
 * @description Live discovery of every running dashboard server's TCP port.
 *
 * The conventional port is 4820, and a plain `npm start` setup almost always
 * binds it. But more than one dashboard can run on a single machine — most
 * commonly the macOS desktop app side-by-side with `npm run dev`. The hook
 * handler fans out to every live dashboard that uses a **different** SQLite
 * data directory. Servers sharing the same `dataDir` receive hooks through a
 * single lowest-port ingest target so events are never duplicated.
 *
 * The on-disk file is a JSON document under the Claude Code home directory.
 * Every server writes its own entry on startup, prunes any stale entries it
 * finds, and the hook handler reads the file and fans out one POST per live
 * entry. Stale entries (process gone) are dropped on every read.
 *
 * Backwards compatibility: the file always carries the **legacy** single-
 * record fields (`port`, `pid`, `startedAt`) at its root, set to the most
 * recently started live server. Older hook handlers — e.g. the one bundled
 * inside a previously-installed `.app` that predates this multi-server
 * format — still parse the file successfully and reach at least one live
 * server. The new shape lives under `servers: [...]`.
 *
 * Recovery ownership uses a separate per-process marker directory inside the
 * SQLite data directory. Unlike the Claude-home discovery file, these markers
 * are shared by every process that opens the same database even when those
 * processes use different `CLAUDE_HOME` values.
 *
 * Every function here is best-effort and never throws: discovery must never
 * block server startup, and the hook handler must never fail because of it.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");

const { getClaudeHome, getDataDir } = require("./claude-home");

/** Conventional dashboard port — used when discovery yields nothing. */
const DEFAULT_PORT = 4820;

/** Per-process liveness markers shared by every server using one data dir. */
const DATA_DIR_OWNER_DIRECTORY = ".agent-dashboard-owners";

/** Absolute path of the discovery file. */
function getServerInfoPath() {
  return path.join(getClaudeHome(), ".agent-dashboard.json");
}

/**
 * Canonical absolute path for comparing data directories across processes.
 * Falls back to `path.resolve` when the directory does not exist yet.
 *
 * @param {string} dir
 * @returns {string}
 */
function normalizeDataDir(dir) {
  if (!dir || typeof dir !== "string") return "";
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

/**
 * Grouping key for hook-ingest deduplication. Entries without `dataDir` are
 * treated as unique (legacy servers before this field existed).
 *
 * @param {{ port: number, dataDir?: string }} server
 * @returns {string}
 */
function ingestGroupKey(server) {
  if (server.dataDir) return normalizeDataDir(server.dataDir);
  return `__legacy__:${server.port}`;
}

/**
 * Canonical directory containing the effective SQLite database. An explicit
 * database-file override wins over the broader dashboard data directory.
 */
function getOwnershipDataDir() {
  const dbPath = process.env.DASHBOARD_DB_PATH;
  if (dbPath) {
    if (dbPath === ":memory:") return "";
    return normalizeDataDir(path.dirname(path.resolve(dbPath)));
  }
  return normalizeDataDir(getDataDir());
}

/** Absolute directory containing per-process ownership markers for this DB. */
function getDataDirOwnerDirectory() {
  const dataDir = getOwnershipDataDir();
  return dataDir ? path.join(dataDir, DATA_DIR_OWNER_DIRECTORY) : "";
}

/** Absolute ownership marker path for a process using this DB. */
function getDataDirOwnerPath(pid = process.pid) {
  const ownerDirectory = getDataDirOwnerDirectory();
  return ownerDirectory && Number.isInteger(pid) && pid > 0
    ? path.join(ownerDirectory, `${pid}.json`)
    : "";
}

/** Publish this process's shared-data ownership marker atomically. */
function writeDataDirOwner() {
  let tmpPath = "";
  try {
    const ownerDirectory = getDataDirOwnerDirectory();
    const ownerPath = getDataDirOwnerPath();
    if (!ownerDirectory || !ownerPath) return false;
    fs.mkdirSync(ownerDirectory, { recursive: true });
    tmpPath = `${ownerPath}.${Date.now()}.tmp`;
    fs.writeFileSync(
      tmpPath,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })
    );
    fs.renameSync(tmpPath, ownerPath);
    return true;
  } catch {
    if (tmpPath) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* best-effort cleanup */
      }
    }
    return false;
  }
}

/**
 * Read live ownership markers for this data directory. A malformed marker is
 * ambiguous and returns `null`; dead-process markers are pruned best-effort.
 *
 * @returns {Array<{pid: number, startedAt?: string}> | null}
 */
function readDataDirOwners() {
  try {
    const ownerDirectory = getDataDirOwnerDirectory();
    if (!ownerDirectory) return null;
    let names;
    try {
      names = fs.readdirSync(ownerDirectory);
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      return null;
    }
    const live = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const ownerPath = path.join(ownerDirectory, name);
      let owner;
      try {
        owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
      } catch {
        return null;
      }
      if (!Number.isInteger(owner?.pid) || owner.pid <= 0) return null;
      if (name !== `${owner.pid}.json`) return null;
      if (isPidAlive(owner.pid)) {
        live.push(owner);
      } else {
        try {
          fs.unlinkSync(ownerPath);
        } catch {
          /* another process may have pruned it */
        }
      }
    }
    return live;
  } catch {
    return null;
  }
}

/**
 * Read the discovery file and return its `servers` list, normalised. Handles
 * both the new array shape and the legacy single-record shape so a file
 * written by an older server is still understood.
 *
 * @returns {Array<{port: number, pid: number, startedAt: string}>}
 */
function readInfoFile() {
  try {
    const raw = fs.readFileSync(getServerInfoPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.servers)) {
      return parsed.servers.filter((s) => s && Number.isInteger(s.port));
    }
    if (Number.isInteger(parsed.port)) {
      // Legacy single-record file written by a server that predates this
      // format. Treat the root object as the lone server entry.
      return [{ port: parsed.port, pid: parsed.pid, startedAt: parsed.startedAt }];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Whether a process is still running. `process.kill(pid, 0)` sends no signal;
 * it only probes existence. EPERM means the process exists but is owned by
 * another user — still "alive" for our purposes.
 *
 * @param {number} pid
 * @returns {boolean}
 */
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return Boolean(err) && err.code === "EPERM";
  }
}

/** Most recently started entry — used to populate the legacy root fields. */
function mostRecent(servers) {
  return servers.reduce((a, b) => {
    const at = Date.parse(a.startedAt) || 0;
    const bt = Date.parse(b.startedAt) || 0;
    return bt > at ? b : a;
  });
}

/**
 * Write `{ servers, ...legacy }` to disk via temp file + atomic rename. The
 * read-modify-write here is not file-system locked — if two servers race to
 * write at the exact same millisecond one entry may be momentarily lost; the
 * loser's next write (or any read that triggers a prune) self-heals.
 */
function persist(servers) {
  if (servers.length === 0) {
    try {
      fs.unlinkSync(getServerInfoPath());
    } catch {
      /* already gone */
    }
    return;
  }
  const recent = mostRecent(servers);
  const payload = JSON.stringify(
    {
      // Legacy fields so an older hook handler (e.g. one bundled inside a
      // previously-installed .app that predates the multi-server format)
      // still resolves to a reachable port.
      port: recent.port,
      pid: recent.pid,
      startedAt: recent.startedAt,
      // The full list of live servers — the field new readers consume.
      servers,
    },
    null,
    2
  );
  const finalPath = getServerInfoPath();
  const tmpPath = `${finalPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, payload);
  fs.renameSync(tmpPath, finalPath);
}

/**
 * Record the live server port so the hook handler (and any other local
 * consumer) can find it. Other servers' entries are preserved; dead entries
 * are pruned. Best-effort — a failure here never interrupts server startup.
 *
 * @param {number} port - The port the HTTP server is listening on.
 */
function writeServerInfo(port) {
  if (!Number.isInteger(port) || port <= 0) return;
  writeDataDirOwner();
  try {
    const dir = getClaudeHome();
    fs.mkdirSync(dir, { recursive: true });
    const existing = readInfoFile().filter(
      (s) => Number.isInteger(s.port) && s.port > 0 && s.pid !== process.pid && isPidAlive(s.pid)
    );
    const ours = {
      port,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      dataDir: normalizeDataDir(getDataDir()),
    };
    persist([...existing, ours]);
  } catch {
    // Discovery is an optimization, not a requirement — never block startup.
  }
}

/** Remove this process's entry from the file. Safe to call when absent. */
function removeServerInfo() {
  try {
    const remaining = readInfoFile().filter((s) => s.pid !== process.pid);
    persist(remaining);
  } catch {
    // Already gone, never written, or unreadable — nothing to do.
  }
}

/**
 * Resolve every live dashboard server's port. Result is ordered most-recent
 * last (the order entries appear in the file).
 *
 *   1. `CLAUDE_DASHBOARD_PORT` — explicit operator override; returned as the
 *      sole target so a test or one-off override doesn't fan out.
 *   2. Live entries from the discovery file, pruned by PID liveness.
 *   3. `[DEFAULT_PORT]` (`[4820]`) — the conventional fallback when nothing
 *      else resolves.
 *
 * @returns {number[]}
 */
function resolveAllDashboardPorts() {
  const envPort = parseInt(process.env.CLAUDE_DASHBOARD_PORT || "", 10);
  if (Number.isInteger(envPort) && envPort > 0) return [envPort];

  const live = readInfoFile().filter(
    (s) => Number.isInteger(s.port) && s.port > 0 && isPidAlive(s.pid)
  );
  if (live.length > 0) {
    // Dedupe by port in case the same port appears twice (defensive).
    return [...new Set(live.map((s) => s.port))];
  }
  return [DEFAULT_PORT];
}

/**
 * Ports that should receive hook POSTs. When several live servers share the
 * same SQLite data directory, only the lowest port per directory is returned
 * so parallel instances (Docker + dev, two terminals on the same DB) never
 * double-ingest events.
 *
 * @returns {number[]}
 */
function resolveHookIngestPorts() {
  const envPort = parseInt(process.env.CLAUDE_DASHBOARD_PORT || "", 10);
  if (Number.isInteger(envPort) && envPort > 0) return [envPort];

  const live = readInfoFile().filter(
    (s) => Number.isInteger(s.port) && s.port > 0 && isPidAlive(s.pid)
  );
  if (live.length === 0) return [DEFAULT_PORT];

  const byDataDir = new Map();
  for (const server of live) {
    const key = ingestGroupKey(server);
    const prev = byDataDir.get(key);
    if (!prev || server.port < prev.port) {
      byDataDir.set(key, server);
    }
  }
  return [...byDataDir.values()].map((s) => s.port).sort((a, b) => a - b);
}

/**
 * Other live dashboard processes using the same SQLite data directory as this
 * one. Used for startup warnings when multiple UIs point at one database.
 *
 * @returns {Array<{port: number, pid: number, startedAt: string}>}
 */
function peersSharingDataDir() {
  try {
    const mine = normalizeDataDir(getDataDir());
    if (!mine) return [];
    return readInfoFile().filter((s) => {
      if (!Number.isInteger(s.port) || s.port <= 0) return false;
      if (s.pid === process.pid) return false;
      if (!isPidAlive(s.pid)) return false;
      if (!s.dataDir) return false;
      return normalizeDataDir(s.dataDir) === mine;
    });
  } catch {
    return [];
  }
}

/**
 * Whether the data-directory ownership markers prove this process is the only
 * live owner of its database. Missing, unreadable, or malformed metadata is
 * ambiguous so startup repair never rewrites another process's live state.
 *
 * @returns {boolean}
 */
function hasExclusiveDataDirOwnership() {
  try {
    const live = readDataDirOwners();
    if (!live || !live.some((owner) => owner.pid === process.pid)) return false;
    return live.every((owner) => owner.pid === process.pid);
  } catch {
    return false;
  }
}

/**
 * Single-port helper kept for callers that have always asked the file for
 * "the" port (e.g. legacy code paths and tests). Returns the first live
 * server's port, or the default if none are alive.
 *
 * @returns {number}
 */
function resolveDashboardPort() {
  return resolveAllDashboardPorts()[0] ?? DEFAULT_PORT;
}

module.exports = {
  DEFAULT_PORT,
  getServerInfoPath,
  writeServerInfo,
  removeServerInfo,
  resolveDashboardPort,
  resolveAllDashboardPorts,
  resolveHookIngestPorts,
  peersSharingDataDir,
  hasExclusiveDataDirOwnership,
  // Exported for tests.
  normalizeDataDir,
  ingestGroupKey,
  getOwnershipDataDir,
  getDataDirOwnerPath,
};
