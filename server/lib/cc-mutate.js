/**
 * @file cc-mutate.js
 * @description Mutation helpers for the Claude Config Explorer. Handles
 * create / overwrite / delete on the low-risk text-file surfaces only:
 * skills, subagents, slash commands, output styles, CLAUDE.md memory, and
 * per-project file-based memory (~/.claude/projects/<slug>/memory/*.md).
 *
 * Hard constraints (do not relax without a follow-up review):
 *   - Plugins, MCP servers, hooks-in-settings, and settings.json files are
 *     NEVER touched here. Those have concurrent-write races with the live
 *     Claude Code CLI and need different handling.
 *   - Every write/delete creates a timestamped backup BEFORE the mutation.
 *     Backups land under <root>/cc-config-backups/<type>/, well outside the
 *     directories Claude Code scans, so a deleted skill cannot reappear as
 *     a backup-named skill.
 *   - Writes are atomic via temp file + fs.renameSync. Tmp is removed on
 *     any failure path.
 *   - Names are validated against a strict allowlist regex; resolved paths
 *     are double-checked to live under the expected root before any I/O.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");
const { getClaudeHome } = require("./claude-home");
const { isUnder, MAX_FILE_BYTES } = require("./cc-discovery");

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
// Auto-memory files are arbitrary flat *.md filenames inside a project's
// memory dir; the project is the ~/.claude/projects/<slug> dir name.
const MEMORY_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.md$/i;
// Project slugs are an absolute cwd with "/" → "-", so they begin with "-".
// Allow alnum/_/- as the first char (never "." — blocks hidden/weird dirs);
// traversal is additionally blocked by the !includes("..") + isUnder guards.
const PROJECT_SLUG_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,255}$/;

const TYPES = {
  skills: { kind: "dir", subdir: "skills", filename: "SKILL.md" },
  agents: { kind: "file", subdir: "agents", ext: ".md" },
  commands: { kind: "file", subdir: "commands", ext: ".md" },
  "output-styles": { kind: "file", subdir: "output-styles", ext: ".md" },
  memory: { kind: "memory" }, // CLAUDE.md at root, no `name`
  // Per-project file-based memory: ~/.claude/projects/<project>/memory/<name>.md.
  // Keyed by (project, name); scope is irrelevant (always under CLAUDE_HOME).
  "auto-memory": { kind: "auto-memory" },
};

function getProjectRoot(cwd) {
  return path.resolve(cwd || process.cwd());
}

function getProjectClaudeDir(cwd) {
  return path.join(getProjectRoot(cwd), ".claude");
}

function rootForScope(scope, opts = {}) {
  if (scope === "user") return getClaudeHome();
  if (scope === "project") return getProjectClaudeDir(opts.cwd);
  throw makeError("EBADSCOPE", `unknown scope: ${scope}`);
}

function memoryPathForScope(scope, opts = {}) {
  if (scope === "user") return path.join(getClaudeHome(), "CLAUDE.md");
  if (scope === "project") return path.join(getProjectRoot(opts.cwd), "CLAUDE.md");
  throw makeError("EBADSCOPE", `unknown scope: ${scope}`);
}

/**
 * Resolve (and validate) the memory dir for a per-project file-based memory
 * store: ~/.claude/projects/<project>/memory/. Rejects slugs that could
 * traverse out of the projects root.
 */
function autoMemoryDir(project) {
  if (typeof project !== "string" || !PROJECT_SLUG_RE.test(project) || project.includes("..")) {
    throw makeError("EBADPROJECT", `invalid project slug: ${project}`);
  }
  const projectsRoot = path.join(getClaudeHome(), "projects");
  const dir = path.join(projectsRoot, project, "memory");
  if (!isUnder(projectsRoot, dir)) {
    throw makeError("EOUTOFROOT", "project escapes the projects root");
  }
  return dir;
}

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Resolve the on-disk target for a (scope, type, name) tuple AND the
 * containment root used for path-traversal checks.
 *
 * Returns:
 *   { kind: "file" | "dir" | "memoryFile",
 *     target: <abs path of file or skill dir>,
 *     filePath: <abs path of the actual .md file inside target>,
 *     containmentRoot: <abs path that must contain target> }
 */
function resolveTarget(scope, type, name, opts = {}) {
  const spec = TYPES[type];
  if (!spec) throw makeError("EBADTYPE", `unknown type: ${type}`);

  if (spec.kind === "memory") {
    const filePath = memoryPathForScope(scope, opts);
    // Memory's containment root is the parent dir (CLAUDE_HOME or project root).
    return {
      kind: "memoryFile",
      target: filePath,
      filePath,
      containmentRoot: path.dirname(filePath),
    };
  }

  if (spec.kind === "auto-memory") {
    const memDir = autoMemoryDir(opts.project);
    if (typeof name !== "string" || !MEMORY_FILE_RE.test(name) || name.includes("..")) {
      throw makeError("EBADNAME", `auto-memory name must be a flat *.md filename`);
    }
    const target = path.join(memDir, name);
    return { kind: "file", target, filePath: target, containmentRoot: memDir };
  }

  if (typeof name !== "string" || !NAME_RE.test(name)) {
    throw makeError("EBADNAME", `name must match ${NAME_RE}`);
  }

  const root = rootForScope(scope, opts);
  const subdirAbs = path.join(root, spec.subdir);

  if (spec.kind === "dir") {
    const target = path.join(subdirAbs, name);
    return {
      kind: "dir",
      target,
      filePath: path.join(target, spec.filename),
      containmentRoot: subdirAbs,
    };
  }

  // file
  const target = path.join(subdirAbs, name + spec.ext);
  return {
    kind: "file",
    target,
    filePath: target,
    containmentRoot: subdirAbs,
  };
}

function backupRoot(scope, type, opts = {}) {
  return path.join(rootForScope(scope, opts), "cc-config-backups", type);
}

function memoryBackupRoot(scope, opts = {}) {
  // Memory's "type" for backup bookkeeping is just "memory"; root sits beside
  // the file itself.
  const dir = path.dirname(memoryPathForScope(scope, opts));
  return path.join(dir, ".cc-config-backups", "memory");
}

function autoMemoryBackupRoot(memDir) {
  // Backups live in a dotted subdir of the memory dir. Claude Code only loads
  // *.md directly in the dir, so .bak files tucked under a subdir stay inert.
  return path.join(memDir, ".cc-config-backups", "auto-memory");
}

function timestamp() {
  return new Date().toISOString().replace(/[:]/g, "-");
}

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyDirSync(s, d);
    else if (ent.isFile()) fs.copyFileSync(s, d);
    // symlinks/sockets/etc skipped intentionally — these surfaces are
    // text-file-only by spec
  }
}

function rmTreeSync(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

/**
 * Always-on backup. For files, copies to <backupRoot>/<name>.<ts>.bak. For
 * dirs (skills), copies the whole tree. Returns the backup path (or null
 * if there was nothing to back up — e.g. brand-new file).
 */
function createBackup({ scope, type, target, kind, opts }) {
  if (!fs.existsSync(target)) return null;
  let root;
  if (type === "memory") root = memoryBackupRoot(scope, opts);
  else if (type === "auto-memory") root = autoMemoryBackupRoot(path.dirname(target));
  else root = backupRoot(scope, type, opts);
  fs.mkdirSync(root, { recursive: true });
  const base = path.basename(target);
  const stamp = timestamp();
  if (kind === "dir") {
    const dst = path.join(root, `${base}.${stamp}.bak`);
    copyDirSync(target, dst);
    return dst;
  }
  // file
  const dst = path.join(root, `${base}.${stamp}.bak`);
  fs.copyFileSync(target, dst);
  return dst;
}

/**
 * Atomic write: tmp file → fsync (best-effort) → rename. Tmp is unlinked
 * on any failure path. Caller is responsible for ensuring parent dir exists.
 */
function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tmp, "wx");
    fs.writeSync(fd, content);
    try {
      fs.fsyncSync(fd);
    } catch {
      // fsync may fail on some filesystems / tmpfs — non-fatal
    }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      if (fd != null) fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Create or overwrite a single text artifact. Returns metadata including
 * the backup path (null if this was a fresh create).
 *
 * @param {{scope:string, type:string, name?:string, content:string, cwd?:string}} args
 */
function writeArtifact(args) {
  const { scope, type, name, content, cwd, project } = args;
  if (typeof content !== "string") throw makeError("EBADCONTENT", "content must be a string");
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw makeError("ETOOLARGE", `content exceeds ${MAX_FILE_BYTES} bytes`);
  }
  const r = resolveTarget(scope, type, name, { cwd, project });

  // Containment guard: even after our regex, double-check that the resolved
  // path actually lives under the expected root. Defends against quirks like
  // Windows drive letters or normalize-then-resolve mismatches.
  if (!isUnder(r.containmentRoot, r.target)) {
    throw makeError("EOUTOFROOT", "resolved path is outside containment root");
  }

  const existedBefore = fs.existsSync(r.filePath);
  const backupPath = existedBefore
    ? createBackup({
        scope,
        type,
        target: r.kind === "dir" ? r.target : r.filePath,
        kind: r.kind,
        opts: { cwd },
      })
    : null;

  if (r.kind === "dir") {
    fs.mkdirSync(r.target, { recursive: true });
  }
  atomicWriteFile(r.filePath, content);

  return {
    ok: true,
    file: r.filePath,
    target: r.target,
    backupPath,
    created: !existedBefore,
  };
}

/**
 * Delete a single text artifact. Backup is mandatory and runs first; if
 * the backup fails, the original is left intact.
 */
function deleteArtifact(args) {
  const { scope, type, name, cwd, project } = args;
  const r = resolveTarget(scope, type, name, { cwd, project });

  if (!isUnder(r.containmentRoot, r.target)) {
    throw makeError("EOUTOFROOT", "resolved path is outside containment root");
  }

  if (!fs.existsSync(r.target)) {
    throw makeError("ENOTFOUND", `${type}/${name || "CLAUDE.md"} does not exist`);
  }

  const backupPath = createBackup({
    scope,
    type,
    target: r.target,
    kind: r.kind === "memoryFile" ? "file" : r.kind,
    opts: { cwd },
  });

  if (r.kind === "dir") {
    rmTreeSync(r.target);
  } else {
    fs.unlinkSync(r.target);
  }

  return { ok: true, file: r.filePath, target: r.target, backupPath };
}

/**
 * List backups for either all types or a specific (scope, type) bucket.
 * Returns [{ scope, type, name, backupPath, mtime, size }].
 */
function listBackups(opts = {}) {
  const out = [];
  const scopes = opts.scope ? [opts.scope] : ["user", "project"];
  // auto-memory backups live per-project, not under a user/project root — they
  // are scanned separately below.
  const types = (opts.type ? [opts.type] : Object.keys(TYPES)).filter((t) => t !== "auto-memory");
  for (const scope of scopes) {
    if (scope === "auto-memory") continue;
    for (const type of types) {
      const root =
        type === "memory" ? memoryBackupRoot(scope, opts) : backupRoot(scope, type, opts);
      let entries = [];
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        const full = path.join(root, ent.name);
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        out.push({
          scope,
          type,
          name: ent.name,
          backupPath: full,
          isDir: ent.isDirectory(),
          mtime: stat.mtimeMs,
          size: ent.isDirectory() ? null : stat.size,
        });
      }
    }
  }

  // Per-project auto-memory backups: ~/.claude/projects/<slug>/memory/
  // .cc-config-backups/auto-memory/. Best-effort — never throw.
  const wantAuto =
    (!opts.type || opts.type === "auto-memory") && (!opts.scope || opts.scope === "auto-memory");
  if (wantAuto) {
    try {
      const projectsRoot = path.join(getClaudeHome(), "projects");
      for (const proj of fs.readdirSync(projectsRoot)) {
        const root = autoMemoryBackupRoot(path.join(projectsRoot, proj, "memory"));
        let entries;
        try {
          entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const ent of entries) {
          const full = path.join(root, ent.name);
          let stat;
          try {
            stat = fs.statSync(full);
          } catch {
            continue;
          }
          out.push({
            scope: "auto-memory",
            project: proj,
            type: "auto-memory",
            name: ent.name,
            backupPath: full,
            isDir: ent.isDirectory(),
            mtime: stat.mtimeMs,
            size: ent.isDirectory() ? null : stat.size,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  return out.sort((a, b) => b.mtime - a.mtime);
}

module.exports = {
  writeArtifact,
  deleteArtifact,
  listBackups,
  resolveTarget, // exported for tests
  TYPES,
  NAME_RE,
};
