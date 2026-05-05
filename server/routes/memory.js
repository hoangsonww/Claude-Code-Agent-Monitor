/**
 * @file Read-only memory browse routes. Exposes Claude Code's auto-memory
 * directories (`~/.claude/projects/<encoded>/memory/*.md`) plus user-scoped
 * and project-root CLAUDE.md files. Disabled by default — gated behind
 * ORCHESTRATOR_ENABLED=1 (same flag as the orchestrator surface) so this
 * filesystem-reading endpoint isn't exposed unless the operator opts in.
 *
 * Endpoints are strictly read-only; editing belongs to a later phase.
 */

const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const router = express.Router();

const ENABLED = process.env.ORCHESTRATOR_ENABLED === "1";
const CLAUDE_HOME = process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_HOME, "projects");

// Project-id and file-name validators reject anything that could escape the
// expected directory (slashes, "..", null bytes, etc.). Keep these strict.
const PROJECT_ID_RE = /^[A-Za-z0-9_.-]+$/;
const MD_FILE_RE = /^[A-Za-z0-9_.-]+\.md$/;

// Cap individual file reads so a runaway memory file can't OOM the server.
const MAX_BYTES = 1024 * 1024; // 1 MB

// Same gating model as the orchestrator router: 404 (not 403) hides the
// endpoint entirely when disabled.
router.use((req, res, next) => {
  if (!ENABLED) {
    return res.status(404).json({
      error: "memory routes disabled",
      hint: "Set ORCHESTRATOR_ENABLED=1 to enable read-only memory browse.",
    });
  }
  next();
});

function decodeProjectId(id) {
  // ~/.claude/projects encodes the absolute project path by replacing "/" with
  // "-", so "-Users-foo-Bar" -> "/Users/foo/Bar". This is a best-effort
  // reconstruction for display only; original casing/dashes inside path
  // segments are not recoverable. The encoded id remains the source of truth.
  if (!id) return null;
  return "/" + id.replace(/^-/, "").replace(/-/g, "/");
}

function listMemoryFiles(memDir) {
  return fs
    .readdirSync(memDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => d.name);
}

router.get("/projects", (_req, res) => {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return res.json({ projects: [], projectsDir: PROJECTS_DIR });
  }
  const projects = [];
  let entries;
  try {
    entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  } catch (err) {
    return res.status(500).json({ error: `cannot read projects dir: ${err.message}` });
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!PROJECT_ID_RE.test(entry.name)) continue;
    const memDir = path.join(PROJECTS_DIR, entry.name, "memory");
    if (!fs.existsSync(memDir)) continue;
    let files = [];
    try {
      files = listMemoryFiles(memDir);
    } catch {
      continue;
    }
    let totalBytes = 0;
    let latestMtime = 0;
    for (const f of files) {
      try {
        const st = fs.statSync(path.join(memDir, f));
        totalBytes += st.size;
        if (st.mtimeMs > latestMtime) latestMtime = st.mtimeMs;
      } catch {
        // ignore unreadable files
      }
    }
    projects.push({
      id: entry.name,
      decodedPath: decodeProjectId(entry.name),
      fileCount: files.length,
      totalBytes,
      latestMtime,
    });
  }
  // Most recently touched first — matches typical "what was I just working on" UX.
  projects.sort((a, b) => b.latestMtime - a.latestMtime);
  res.json({ projects, projectsDir: PROJECTS_DIR });
});

router.get("/projects/:project/files", (req, res) => {
  const { project } = req.params;
  if (!PROJECT_ID_RE.test(project)) {
    return res.status(400).json({ error: "invalid project id" });
  }
  const memDir = path.join(PROJECTS_DIR, project, "memory");
  if (!fs.existsSync(memDir)) {
    return res.status(404).json({ error: "no memory for project" });
  }
  let files;
  try {
    files = listMemoryFiles(memDir).map((name) => {
      const stat = fs.statSync(path.join(memDir, name));
      return { name, size: stat.size, mtime: stat.mtimeMs };
    });
  } catch (err) {
    return res.status(500).json({ error: `cannot read memory dir: ${err.message}` });
  }
  files.sort((a, b) => b.mtime - a.mtime);
  res.json({ project, decodedPath: decodeProjectId(project), files });
});

router.get("/projects/:project/files/:file", (req, res) => {
  const { project, file } = req.params;
  if (!PROJECT_ID_RE.test(project)) {
    return res.status(400).json({ error: "invalid project id" });
  }
  if (!MD_FILE_RE.test(file)) {
    return res.status(400).json({ error: "invalid file name" });
  }
  const memDir = path.join(PROJECTS_DIR, project, "memory");
  const filePath = path.join(memDir, file);

  // Defense in depth: even though regexes block traversal, verify the resolved
  // path stays inside the expected memory dir before reading.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(memDir) + path.sep)) {
    return res.status(400).json({ error: "path traversal blocked" });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: "file not found" });
  }
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (err) {
    return res.status(500).json({ error: `cannot stat: ${err.message}` });
  }
  if (!stat.isFile()) {
    return res.status(400).json({ error: "not a regular file" });
  }
  if (stat.size > MAX_BYTES) {
    return res.status(413).json({ error: `file too large (>${MAX_BYTES} bytes)` });
  }
  let content;
  try {
    content = fs.readFileSync(resolved, "utf8");
  } catch (err) {
    return res.status(500).json({ error: `cannot read: ${err.message}` });
  }
  res.json({
    project,
    name: file,
    content,
    size: stat.size,
    mtime: stat.mtimeMs,
  });
});

router.get("/claude-md", (_req, res) => {
  const userClaudeMd = path.join(CLAUDE_HOME, "CLAUDE.md");
  const projectRoot = process.cwd();
  const projectClaudeMd = path.join(projectRoot, "CLAUDE.md");
  const projectClaudeLocalMd = path.join(projectRoot, "CLAUDE.local.md");

  function readIf(p) {
    try {
      if (!fs.existsSync(p)) return null;
      const st = fs.statSync(p);
      if (!st.isFile()) return null;
      if (st.size > MAX_BYTES) {
        return { path: p, error: "file too large", size: st.size };
      }
      return {
        path: p,
        content: fs.readFileSync(p, "utf8"),
        size: st.size,
        mtime: st.mtimeMs,
      };
    } catch (err) {
      return { path: p, error: err.message };
    }
  }

  res.json({
    user: readIf(userClaudeMd),
    project: readIf(projectClaudeMd),
    projectLocal: readIf(projectClaudeLocalMd),
  });
});

module.exports = router;
