/**
 * @file remote-transcript.js
 * @description Path-safe, append-only storage for Claude Code transcripts pushed from other
 * machines (POST /api/hooks/ingest-transcript). Files are written into the server's Claude
 * projects directory using Claude Code's own layout, so every existing reader (transcript viewer,
 * watchdog, subagent scan, token/compaction extraction) works on them unchanged:
 *
 *   <projects>/<project>/<sessionId>.jsonl
 *   <projects>/<project>/<sessionId>/subagents/<file>.jsonl
 *   <projects>/<project>/<sessionId>/subagents/workflows/<runId>/<file>.jsonl
 *
 * Uploads are offset-based and byte-exact: a chunk is accepted only when its offset equals the file's current
 * size, which makes retries idempotent and lets a restarted client resume from the server's size.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("fs");
const path = require("path");

const SEGMENT_RE = /^[A-Za-z0-9._-]{1,200}$/;
const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Max raw bytes accepted in one chunk. The client sends base64 (x1.33) inside JSON, and the route
 * mounts its own 8 MB body parser (server/index.js), so a 4 MB chunk fits with headroom.
 */
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

class TranscriptPathError extends Error {}

/** Node's base64 decoder skips bad characters silently; accept only input that round-trips. */
function decodeBase64Strict(str) {
  const buf = Buffer.from(str, "base64");
  return buf.toString("base64") === str ? buf : null;
}

function isSafeSegment(seg) {
  return SEGMENT_RE.test(seg) && seg !== "." && seg !== "..";
}

function isValidSessionId(sessionId) {
  return (
    typeof sessionId === "string" && SESSION_ID_RE.test(sessionId) && !sessionId.includes("..")
  );
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
  );
}

/** Resolve the deepest existing ancestor, preserving the missing suffix without following a dangling symlink. */
function canonicalizeExistingAncestor(absPath) {
  const missing = [];
  let cursor = absPath;
  while (true) {
    try {
      return path.join(fs.realpathSync(cursor), ...missing);
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
      try {
        if (fs.lstatSync(cursor).isSymbolicLink()) {
          throw new TranscriptPathError("path contains a dangling symlink");
        }
      } catch (lstatErr) {
        if (lstatErr instanceof TranscriptPathError) throw lstatErr;
        if (lstatErr?.code !== "ENOENT") throw lstatErr;
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) throw err;
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

function assertCanonicalContainment(projectsDir, target) {
  const root = path.resolve(projectsDir);
  const abs = path.resolve(target);
  if (!isWithin(root, abs)) throw new TranscriptPathError("path escapes projects dir");
  const canonicalRoot = canonicalizeExistingAncestor(root);
  const canonicalTarget = canonicalizeExistingAncestor(abs);
  if (!isWithin(canonicalRoot, canonicalTarget)) {
    throw new TranscriptPathError("path escapes projects dir");
  }
}

function statRegularTarget(abs) {
  try {
    const stat = fs.lstatSync(abs);
    if (stat.isSymbolicLink()) {
      throw new TranscriptPathError("transcript target must not be a symbolic link");
    }
    if (!stat.isFile()) throw new TranscriptPathError("transcript target must be a regular file");
    return stat;
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Validate `relPath` (posix, relative to the projects dir) as a transcript file belonging to
 * `sessionId`, and resolve it under `projectsDir`.
 * @returns {{ abs: string, mainAbs: string, isMain: boolean }}
 * @throws {TranscriptPathError}
 */
function resolveTranscriptPath(projectsDir, sessionId, relPath) {
  if (!isValidSessionId(sessionId)) throw new TranscriptPathError("invalid session_id");
  if (typeof relPath !== "string" || !relPath || relPath.length > 600) {
    throw new TranscriptPathError("rel_path is required");
  }
  const segs = relPath.split("/");
  if (!segs.every(isSafeSegment)) throw new TranscriptPathError("rel_path has an unsafe segment");
  const last = segs[segs.length - 1];
  if (!last.endsWith(".jsonl")) throw new TranscriptPathError("rel_path must end in .jsonl");

  let isMain;
  if (segs.length === 2) {
    if (last !== `${sessionId}.jsonl`)
      throw new TranscriptPathError("main file must be <session_id>.jsonl");
    isMain = true;
  } else if (segs.length === 4 || segs.length === 6) {
    if (segs[1] !== sessionId || segs[2] !== "subagents") {
      throw new TranscriptPathError("subagent file must live under <session_id>/subagents/");
    }
    if (segs.length === 6 && segs[3] !== "workflows") {
      throw new TranscriptPathError("unexpected nested layout");
    }
    isMain = false;
  } else {
    throw new TranscriptPathError("unsupported rel_path depth");
  }

  const root = path.resolve(projectsDir);
  const abs = path.resolve(root, ...segs);
  assertCanonicalContainment(root, abs);
  const mainAbs = path.join(root, segs[0], `${sessionId}.jsonl`);
  assertCanonicalContainment(root, mainAbs);
  statRegularTarget(mainAbs);
  return { abs, mainAbs, isMain };
}

/**
 * Append `buf` to `abs` iff `offset` equals the current file size.
 * @returns {{ ok: true, size: number } | { ok: false, status: 400|409|413, code: string, size: number }}
 */
function appendChunk(
  abs,
  offset,
  buf,
  { maxFileBytes = 256 * 1024 * 1024, projectsDir = null } = {}
) {
  if (projectsDir) assertCanonicalContainment(projectsDir, abs);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return { ok: false, status: 400, code: "INVALID_OFFSET", size: 0 };
  }
  if (!Buffer.isBuffer(buf) || buf.length > MAX_CHUNK_BYTES) {
    return { ok: false, status: 413, code: "CHUNK_TOO_LARGE", size: 0 };
  }
  let size = statRegularTarget(abs)?.size || 0;
  if (offset !== size) return { ok: false, status: 409, code: "OFFSET_MISMATCH", size };
  if (buf.length === 0) return { ok: true, size };
  // Chunks are raw byte ranges, so a single huge line (an inlined image, a giant tool result) can
  // span several chunks. Clients only send up to the last complete line of the source file, so the
  // stored file ends on a line boundary except while an upload is mid-flight.
  if (size + buf.length > maxFileBytes)
    return { ok: false, status: 413, code: "FILE_TOO_LARGE", size };
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (projectsDir) assertCanonicalContainment(projectsDir, abs);
  statRegularTarget(abs);

  const flags =
    fs.constants.O_WRONLY |
    fs.constants.O_APPEND |
    fs.constants.O_CREAT |
    (fs.constants.O_NOFOLLOW || 0);
  let fd;
  try {
    fd = fs.openSync(abs, flags, 0o666);
  } catch (err) {
    if (err?.code === "ELOOP") {
      throw new TranscriptPathError("transcript target must not be a symbolic link");
    }
    throw err;
  }
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile()) throw new TranscriptPathError("transcript target must be a regular file");
    size = opened.size;
    if (offset !== size) return { ok: false, status: 409, code: "OFFSET_MISMATCH", size };
    if (size + buf.length > maxFileBytes) {
      return { ok: false, status: 413, code: "FILE_TOO_LARGE", size };
    }
    let written = 0;
    while (written < buf.length) {
      const count = fs.writeSync(fd, buf, written, buf.length - written);
      if (count === 0) throw new Error("transcript append wrote zero bytes");
      written += count;
    }
    return { ok: true, size: size + written };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  MAX_CHUNK_BYTES,
  TranscriptPathError,
  decodeBase64Strict,
  isValidSessionId,
  resolveTranscriptPath,
  appendChunk,
};
