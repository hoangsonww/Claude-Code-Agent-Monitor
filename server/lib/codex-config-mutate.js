/**
 * @file Carefully mutates the small, text-only Codex configuration surface:
 * config.toml, profile overlays, hooks.json, user rules, user skills, and
 * instruction files. Every overwrite and allowed deletion is path-whitelisted
 * and backup-backed; writes are size-bounded and atomic.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");
const { getCodexHome } = require("./codex-home");
const {
  MAX_FILE_BYTES,
  PROFILE_NAME_RE,
  PROFILE_SUFFIX,
  deletablePath,
  editablePath,
} = require("./codex-config-discovery");

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function timestamp() {
  return new Date().toISOString().replace(/[:]/g, "-");
}

function backupPathFor(file) {
  const home = getCodexHome();
  const root = path.join(home, "codex-config-backups");
  const relative = path.relative(home, file);
  const segment =
    relative && !relative.startsWith("..") && !path.isAbsolute(relative)
      ? relative.replace(/[\\/]/g, "__")
      : `project__${path.basename(file)}`;
  return path.join(root, `${segment}.${timestamp()}.bak`);
}

function atomicWrite(file, content) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`
  );
  let fd = null;
  try {
    fd = fs.openSync(temporary, "wx");
    fs.writeSync(fd, content);
    try {
      fs.fsyncSync(fd);
    } catch {
      // fsync is best effort on local/temporary filesystems.
    }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temporary, file);
  } catch (error) {
    try {
      if (fd !== null) fs.closeSync(fd);
    } catch {
      // Preserve the original write error.
    }
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {
      // A failed cleanup must not mask the original write error.
    }
    throw error;
  }
}

function profileTemplate(name) {
  return [
    `# Codex profile: ${name}`,
    `# Loaded after ~/.codex/config.toml when you run: codex --profile ${name}`,
    "# Add only settings that should override your base configuration.",
    "#",
    '# model = "gpt-5.6-terra"',
    '# model_reasoning_effort = "xhigh"',
    '# approval_policy = "on-request"',
    "",
  ].join("\n");
}

// An allowlisted lexical path can still escape through a symlinked parent.
// Validate every existing path component and require its canonical parent to
// remain inside the canonical allowlisted root before any read or mutation.
function rejectSymlinkEscape(file) {
  const home = getCodexHome();
  const projectInstructions = path.resolve(process.cwd(), "AGENTS.md");
  const allowedRoot = file === projectInstructions ? path.dirname(projectInstructions) : home;
  const canonicalRoot = fs.realpathSync(allowedRoot);
  const relative = path.relative(allowedRoot, path.resolve(file));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw makeError("ESYMLINK", "Configuration path resolves outside its allowed root");
  }
  let current = allowedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw makeError("ESYMLINK", "Configuration path must not contain symbolic links");
      }
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
  const parent = path.dirname(file);
  try {
    const canonicalParent = fs.realpathSync(parent);
    if (
      canonicalParent !== canonicalRoot &&
      !canonicalParent.startsWith(`${canonicalRoot}${path.sep}`)
    ) {
      throw makeError("ESYMLINK", "Configuration path resolves outside its allowed root");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function readEditableFile(file) {
  const target = editablePath(file);
  if (!target) throw makeError("EEDITDENIED", "This Codex file is not editable from the dashboard");
  rejectSymlinkEscape(target);
  let stat = null;
  try {
    stat = fs.statSync(target);
  } catch {
    // config.toml and hooks.json can be created by the first edit.
  }
  if (stat && !stat.isFile()) throw makeError("ENOTFILE", "Configuration target is not a file");
  if (stat && stat.size > MAX_FILE_BYTES) {
    throw makeError("ETOOLARGE", `file exceeds ${MAX_FILE_BYTES} bytes`);
  }
  return {
    path: target,
    text: stat ? fs.readFileSync(target, "utf8") : "",
    size: stat?.size || 0,
    mtime: stat?.mtimeMs || null,
    truncated: false,
    exists: Boolean(stat),
  };
}

function writeEditableFile({ file, content }) {
  const target = editablePath(file);
  if (!target) throw makeError("EEDITDENIED", "This Codex file is not editable from the dashboard");
  rejectSymlinkEscape(target);
  if (typeof content !== "string") throw makeError("EBADCONTENT", "content must be a string");
  if (content.includes("[redacted]")) {
    throw makeError(
      "EREDACTED",
      "Refusing to save redacted preview content; open the explicit editor to load the original file"
    );
  }
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw makeError("ETOOLARGE", `content exceeds ${MAX_FILE_BYTES} bytes`);
  }
  let existing = null;
  try {
    existing = fs.statSync(target);
  } catch {
    // First-time file creation is supported for known config surfaces.
  }
  if (existing && !existing.isFile())
    throw makeError("ENOTFILE", "Configuration target is not a file");
  let backupPath = null;
  if (existing) {
    backupPath = backupPathFor(target);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(target, backupPath);
  }
  atomicWrite(target, content);
  return { ok: true, file: target, backupPath, created: !existing };
}

function skillDirectoryFor(file) {
  const root = path.join(getCodexHome(), "skills");
  const parent = path.dirname(file);
  const relative = path.relative(root, parent);
  if (
    path.basename(file) === "SKILL.md" &&
    relative &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  ) {
    return parent;
  }
  return null;
}

/**
 * Removes a deliberately small set of user-maintained Codex artifacts. The
 * base config is intentionally excluded; deleting a skill removes its whole
 * directory so bundled references cannot leave a broken, discoverable skill
 * behind. Backups are made before the final unlink/rm operation.
 */
function deleteEditableFile({ file }) {
  const target = deletablePath(file);
  if (!target) {
    throw makeError(
      "EDELETE_DENIED",
      "This Codex file cannot be deleted from the dashboard; config.toml is edit-only"
    );
  }
  rejectSymlinkEscape(target);
  let existing;
  try {
    existing = fs.statSync(target);
  } catch {
    throw makeError("ENOENT", "Configuration target does not exist");
  }
  if (!existing.isFile()) throw makeError("ENOTFILE", "Configuration target is not a file");

  const skillDirectory = skillDirectoryFor(target);
  const backupPath = `${backupPathFor(skillDirectory || target)}${skillDirectory ? ".dir" : ""}`;
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  if (skillDirectory) {
    fs.cpSync(skillDirectory, backupPath, { recursive: true, errorOnExist: true });
    fs.rmSync(skillDirectory, { recursive: true, force: false });
  } else {
    fs.copyFileSync(target, backupPath, fs.constants.COPYFILE_EXCL);
    fs.unlinkSync(target);
  }
  return { ok: true, file: target, backupPath, deletedDirectory: Boolean(skillDirectory) };
}

/** Creates an empty, documented profile overlay without ever overwriting a
 * pre-existing configuration file. The caller then opens the normal editor to
 * add top-level Codex settings. */
function createProfile({ name }) {
  if (typeof name !== "string" || !PROFILE_NAME_RE.test(name)) {
    throw makeError(
      "EBADPROFILE",
      "Profile names may contain only letters, numbers, hyphens, and underscores"
    );
  }
  const file = path.join(getCodexHome(), `${name}${PROFILE_SUFFIX}`);
  rejectSymlinkEscape(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let fd = null;
  const text = profileTemplate(name);
  try {
    fd = fs.openSync(file, "wx");
    fs.writeSync(fd, text);
    try {
      fs.fsyncSync(fd);
    } catch {
      // fsync is best effort on local/temporary filesystems.
    }
    fs.closeSync(fd);
    fd = null;
  } catch (error) {
    try {
      if (fd !== null) fs.closeSync(fd);
    } catch {
      // Preserve the original creation error.
    }
    if (error?.code === "EEXIST") {
      throw makeError("EEXIST", `Profile \"${name}\" already exists`);
    }
    throw error;
  }
  return {
    path: file,
    text,
    size: Buffer.byteLength(text, "utf8"),
    exists: true,
    mtime: Date.now(),
    truncated: false,
  };
}

module.exports = { createProfile, deleteEditableFile, readEditableFile, writeEditableFile };
