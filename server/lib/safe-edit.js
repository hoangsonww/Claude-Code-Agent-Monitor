/**
 * @file Backup-before-write helper for orchestrator file mutations. Mirrors the
 * pattern used in this project's hook installation: snapshot the existing file
 * to a timestamped .bak, then atomically replace via temp + rename.
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * Atomically write content to filePath, after creating a timestamped backup.
 * Returns the backup path on success (or null if the file did not previously
 * exist). Throws on failure — caller decides recovery.
 */
function safeWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let backupPath = null;
  if (fs.existsSync(filePath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${filePath}.${ts}.bak`;
    fs.copyFileSync(filePath, backupPath);
  }

  const tmpPath = `${filePath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // best-effort cleanup
      }
    }
    throw err;
  }
  return backupPath;
}

module.exports = { safeWriteFile };
