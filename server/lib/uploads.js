/**
 * @file Filesystem helpers for the Composer's per-cwd upload area. Files land
 * under `<cwd>/.launcher-uploads/<uuid>/<filename>` so the spawned `claude`
 * can read them via the existing Read tool without any --add-dir gymnastics.
 * The `.launcher-uploads/` directory is auto-added to `<cwd>/.gitignore` on
 * first use (idempotent).
 */
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const UPLOAD_DIR = ".launcher-uploads";
const IGNORE_LINE = `${UPLOAD_DIR}/`;

const TEXT_EXT = new Set([".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".scss", ".sql", ".sh", ".py", ".go", ".rs", ".java", ".c", ".cc", ".cpp", ".h", ".hpp", ".yaml", ".yml", ".toml", ".csv", ".xml", ".log", ""]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

function detectKind(name) {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (TEXT_EXT.has(ext)) return "text";
  return "binary";
}

function sanitizeName(originalName) {
  // Strip any directory component; keep the basename only.
  const base = path.basename(String(originalName || "file"));
  // Disallow leading dot to keep listings clean (rename ".env" → "env").
  const cleaned = base.replace(/^\.+/, "").replace(/[\\/:]/g, "_");
  return cleaned.slice(0, 255) || "file";
}

function uploadDirFor(cwd) {
  return path.join(cwd, UPLOAD_DIR);
}

function saveUpload({ cwd, originalName, buffer }) {
  if (!cwd || typeof cwd !== "string" || !path.isAbsolute(cwd)) throw new Error("cwd must be absolute");
  if (!buffer || !Buffer.isBuffer(buffer)) throw new Error("buffer required");
  const id = randomUUID();
  const safeName = sanitizeName(originalName);
  const dir = path.join(uploadDirFor(cwd), id);
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, safeName);
  fs.writeFileSync(fullPath, buffer);
  ensureGitignore(cwd);
  return {
    id,
    name: safeName,
    size: buffer.length,
    kind: detectKind(safeName),
    path: `./${UPLOAD_DIR}/${id}/${safeName}`,
  };
}

function removeUpload({ cwd, id }) {
  if (!cwd || !path.isAbsolute(cwd)) throw new Error("cwd must be absolute");
  if (!id || typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("invalid id");
  const dir = path.join(uploadDirFor(cwd), id);
  // Containment check: the resolved path must still be under uploadDirFor(cwd).
  const resolved = path.resolve(dir);
  const expectedPrefix = path.resolve(uploadDirFor(cwd)) + path.sep;
  if (!resolved.startsWith(expectedPrefix)) throw new Error("invalid id");
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function ensureGitignore(cwd) {
  const gi = path.join(cwd, ".gitignore");
  let text = "";
  try {
    text = fs.readFileSync(gi, "utf8");
  } catch {
    /* missing — will create */
  }
  const lines = text.split("\n");
  if (lines.some((l) => l.trim() === IGNORE_LINE)) return;
  if (text.length && !text.endsWith("\n")) text += "\n";
  text += IGNORE_LINE + "\n";
  fs.writeFileSync(gi, text);
}

module.exports = { saveUpload, removeUpload, ensureGitignore, UPLOAD_DIR };
