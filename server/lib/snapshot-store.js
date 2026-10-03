/**
 * @file Filesystem layer for the dashboard's durable transcript snapshots
 * (`<dataDir>/transcripts`, `codex-transcripts`, `cursor-transcripts`). Claude
 * Code, Codex and Cursor delete their own transcripts after a retention TTL;
 * these snapshots are what keeps the Conversation tab working afterwards, so
 * every operation here is written to never lose the last complete copy:
 *
 *   - writes are copy-to-temp + rename (a crash never leaves a half-written
 *     snapshot in place of a good one) and never shrink an existing snapshot;
 *   - copies request a copy-on-write clone (`COPYFILE_FICLONE`), which shares
 *     blocks on APFS/btrfs/XFS/ReFS and silently degrades to a plain copy on
 *     every other filesystem;
 *   - compression is verified (decompress + SHA-256 + length) before the plain
 *     file is removed, and the gzip header records the exact uncompressed
 *     length so size comparisons never need a decompression pass;
 *   - deletes are contained to the snapshot root, never follow symlinks, and
 *     retry the transient lock errors Windows raises for open files.
 *
 * Pure Node (fs/path/zlib/crypto) with no platform branches, so it behaves the
 * same on every OS Node runs on. Policy (what to compress or prune, and when)
 * lives in snapshot-retention.js; this module only knows how to do it safely.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const readline = require("readline");
const { pipeline } = require("stream");
const { pipeline: pipelineAsync } = require("stream/promises");
const { Transform } = require("stream");

const GZ_SUFFIX = ".gz";
const TOMBSTONE_DIR = ".pruned";
const TEMP_SUFFIX = ".tmp";
// gzip FEXTRA subfield ("CS" = claude snapshot) carrying the uncompressed
// length as a uint64 LE. gzip's own ISIZE trailer is only length mod 2^32,
// which is ambiguous for the multi-GB transcripts this dashboard handles.
const EXTRA_SI1 = 0x43;
const EXTRA_SI2 = 0x53;
const GZ_HEADER_BYTES = 24; // 10 fixed + 2 XLEN + 4 subfield header + 8 length
// Error codes that mean "someone has the file open / it's busy right now",
// mostly raised on Windows (open handles, antivirus scans). Worth a retry.
const TRANSIENT_LOCK_CODES = new Set(["EBUSY", "EPERM", "EACCES", "ENOTEMPTY", "EMFILE", "ENFILE"]);
const LOCK_RETRIES = 4;
const LOCK_RETRY_DELAY_MS = 50;

// zlib.crc32 ships with Node >= 20.15 / 22.2. The table fallback keeps this
// module working on older or alternative runtimes.
const crc32 =
  typeof zlib.crc32 === "function"
    ? (buf, prev) => zlib.crc32(buf, prev)
    : (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          table[n] = c >>> 0;
        }
        return (buf, prev = 0) => {
          let c = (prev ^ 0xffffffff) >>> 0;
          for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
          return (c ^ 0xffffffff) >>> 0;
        };
      })();

function isCompressedPath(filePath) {
  return typeof filePath === "string" && filePath.endsWith(GZ_SUFFIX);
}

/** Strip a trailing `.gz` so callers can work with the logical `.jsonl` name. */
function logicalPath(filePath) {
  return isCompressedPath(filePath) ? filePath.slice(0, -GZ_SUFFIX.length) : filePath;
}

function lstatOrNull(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch {
    return null;
  }
}

function statOrNull(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

/** Strict-descendant check that tolerates case-insensitive filesystems. */
function isInside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return true;
}

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    /* Atomics.wait unavailable on this thread — retry immediately instead */
  }
}

/** Run a sync fs mutation, retrying briefly while the target is locked. */
function withLockRetrySync(fn) {
  let lastError;
  for (let attempt = 0; attempt <= LOCK_RETRIES; attempt++) {
    try {
      return fn();
    } catch (err) {
      lastError = err;
      if (!TRANSIENT_LOCK_CODES.has(err && err.code) || attempt === LOCK_RETRIES) break;
      sleepSync(LOCK_RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError;
}

async function withLockRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt <= LOCK_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!TRANSIENT_LOCK_CODES.has(err && err.code) || attempt === LOCK_RETRIES) break;
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw lastError;
}

function tempPathFor(target) {
  const rand = crypto.randomBytes(4).toString("hex");
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${rand}${TEMP_SUFFIX}`
  );
}

function removeQuietly(filePath) {
  try {
    fs.rmSync(filePath, { force: true, maxRetries: LOCK_RETRIES, retryDelay: LOCK_RETRY_DELAY_MS });
  } catch {
    /* best-effort: a leftover temp file is swept by cleanupStaleTemp */
  }
}

// ── gzip framing ─────────────────────────────────────────────────────────────

function buildGzipHeader(uncompressedLength) {
  const header = Buffer.alloc(GZ_HEADER_BYTES);
  header[0] = 0x1f;
  header[1] = 0x8b;
  header[2] = 8; // CM = deflate
  header[3] = 0x04; // FLG = FEXTRA
  // MTIME (4..7) = 0, XFL (8) = 0
  header[9] = 255; // OS = unknown — the archive is OS-neutral
  header.writeUInt16LE(12, 10); // XLEN
  header[12] = EXTRA_SI1;
  header[13] = EXTRA_SI2;
  header.writeUInt16LE(8, 14); // subfield LEN
  header.writeBigUInt64LE(BigInt(uncompressedLength), 16);
  return header;
}

/**
 * Exact uncompressed length recorded in a snapshot's gzip header, or null when
 * the file is not one of ours (foreign gzip, truncated, unreadable).
 */
function readRecordedLength(gzPath) {
  let fd;
  try {
    fd = fs.openSync(gzPath, "r");
    const header = Buffer.alloc(GZ_HEADER_BYTES);
    if (fs.readSync(fd, header, 0, GZ_HEADER_BYTES, 0) !== GZ_HEADER_BYTES) return null;
    if (header[0] !== 0x1f || header[1] !== 0x8b || (header[3] & 0x04) === 0) return null;
    if (header[12] !== EXTRA_SI1 || header[13] !== EXTRA_SI2) return null;
    if (header.readUInt16LE(14) !== 8) return null;
    const length = header.readBigUInt64LE(16);
    return length <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(length) : null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

// ── read side ────────────────────────────────────────────────────────────────

/**
 * Resolve a snapshot by its logical `.jsonl` path: the plain file when present
 * (it is the newer of the two after an interrupted compression), else the
 * compressed `.jsonl.gz`. Returns null when neither is a regular file.
 */
function resolveSnapshotFile(jsonlPath) {
  if (!jsonlPath) return null;
  const plain = statOrNull(jsonlPath);
  if (plain && plain.isFile()) return jsonlPath;
  const gz = statOrNull(jsonlPath + GZ_SUFFIX);
  if (gz && gz.isFile()) return jsonlPath + GZ_SUFFIX;
  return null;
}

/**
 * Uncompressed byte length of a transcript (plain or compressed snapshot), or
 * null when it can't be determined.
 */
function transcriptLength(filePath) {
  if (!filePath) return null;
  if (isCompressedPath(filePath)) return readRecordedLength(filePath);
  const stat = statOrNull(filePath);
  return stat && stat.isFile() ? stat.size : null;
}

/**
 * Pick the more complete of a live transcript and its snapshot. The live file
 * wins ties and unknowns (it is the one still being written); the snapshot wins
 * only when it is strictly longer — i.e. the live file was truncated or
 * rewritten shorter, and the snapshot still holds turns the original lost.
 */
function pickMoreComplete(livePath, snapshotPath) {
  if (!livePath) return snapshotPath || null;
  if (!snapshotPath) return livePath;
  const liveLength = transcriptLength(livePath);
  const snapshotLength = transcriptLength(snapshotPath);
  if (liveLength === null) return snapshotLength === null ? livePath : snapshotPath;
  if (snapshotLength !== null && snapshotLength > liveLength) return snapshotPath;
  return livePath;
}

/**
 * Readable stream of a transcript's UTF-8 text, transparently decompressing a
 * `.jsonl.gz` snapshot. Errors from either stage surface on the returned
 * stream, like a plain fs stream.
 */
function createTranscriptReadStream(filePath) {
  if (!isCompressedPath(filePath)) return fs.createReadStream(filePath, { encoding: "utf8" });
  const gunzip = zlib.createGunzip();
  pipeline(fs.createReadStream(filePath), gunzip, () => {
    /* errors are forwarded to `gunzip` by pipeline */
  });
  gunzip.setEncoding("utf8");
  return gunzip;
}

/**
 * readline interface over a transcript (plain or compressed). Closing the
 * interface — including an early `break` out of `for await` — destroys the
 * underlying file stream so its handle is released immediately. That matters
 * on Windows, where an open handle blocks the rename/delete of that file.
 */
function createTranscriptLineReader(filePath) {
  const input = createTranscriptReadStream(filePath);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  rl.on("close", () => input.destroy());
  return rl;
}

/**
 * Whole decompressed content of a `.jsonl.gz` snapshot as a Buffer, refusing
 * (null) anything larger than `maxBytes` so a huge archive can never exhaust
 * memory. Used by the synchronous random-access readers.
 */
function readCompressedSync(gzPath, maxBytes) {
  const recorded = readRecordedLength(gzPath);
  if (recorded !== null && recorded > maxBytes) return null;
  try {
    return zlib.gunzipSync(fs.readFileSync(gzPath), { maxOutputLength: maxBytes });
  } catch {
    return null;
  }
}

// ── write side ───────────────────────────────────────────────────────────────

function tombstonePath(root, sessionId) {
  return path.join(root, TOMBSTONE_DIR, sessionId);
}

/**
 * Record that a session's snapshot was pruned by the retention cap, so a later
 * re-import does not recreate it. The tombstone's mtime is the prune time: a
 * source that grows *after* it (a resumed session) is snapshotted again.
 */
function writeTombstone(root, sessionId) {
  const target = tombstonePath(root, sessionId);
  if (!isInside(root, target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, new Date().toISOString());
}

function removeTombstone(root, sessionId) {
  const target = tombstonePath(root, sessionId);
  if (!isInside(root, target)) return;
  removeQuietly(target);
}

function isTombstoned(root, sessionId, sourceMtimeMs) {
  const stat = lstatOrNull(tombstonePath(root, sessionId));
  return !!stat && sourceMtimeMs <= stat.mtimeMs;
}

/**
 * Copy `source` into the snapshot root as `relPath`. Never shrinks a snapshot:
 * when the existing copy (plain or compressed) is longer, it is kept — that is
 * exactly the case where the original was truncated and the snapshot is now
 * the only complete record. Equal-length sources are re-copied only when newer
 * (an in-place rewrite). Best-effort: never throws.
 *
 * @param {object} opts
 * @param {string} opts.root      snapshot root (e.g. <dataDir>/transcripts)
 * @param {string} opts.sessionId owning session (tombstone lookup)
 * @param {string} opts.source    live transcript to copy
 * @param {string} opts.relPath   destination path relative to `root`
 * @param {number|null} [opts.maxAgeDays] skip sources idle longer than this
 * @returns {{ path: string|null, written: boolean, reason?: string }}
 */
function writeSnapshot({ root, sessionId, source, relPath, maxAgeDays = null }) {
  const dest = path.resolve(root, relPath);
  if (!isInside(root, dest)) return { path: null, written: false, reason: "outside-root" };
  if (path.resolve(source) === dest) return { path: dest, written: false, reason: "same-file" };

  const src = statOrNull(source);
  if (!src || !src.isFile()) {
    return { path: resolveSnapshotFile(dest), written: false, reason: "source-missing" };
  }
  if (sessionId && isTombstoned(root, sessionId, src.mtimeMs)) {
    return { path: resolveSnapshotFile(dest), written: false, reason: "tombstoned" };
  }
  if (maxAgeDays && Date.now() - src.mtimeMs > maxAgeDays * 86400 * 1000) {
    return { path: resolveSnapshotFile(dest), written: false, reason: "aged-out" };
  }

  const plain = statOrNull(dest);
  const gzLength = transcriptLength(dest + GZ_SUFFIX);
  const plainLength = plain && plain.isFile() ? plain.size : -1;
  const existingLength = Math.max(plainLength, gzLength === null ? -1 : gzLength);
  if (src.size < existingLength) {
    return { path: resolveSnapshotFile(dest), written: false, reason: "snapshot-longer" };
  }
  if (src.size === existingLength) {
    // A compressed snapshot of equal length is the frozen copy of this same
    // content; a plain one is only refreshed for an in-place rewrite.
    if (plainLength !== src.size || src.mtimeMs <= plain.mtimeMs) {
      return { path: resolveSnapshotFile(dest), written: false, reason: "up-to-date" };
    }
  }

  const tmp = tempPathFor(dest);
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, tmp, fs.constants.COPYFILE_FICLONE);
    try {
      fs.utimesSync(tmp, src.atime, src.mtime);
    } catch {
      /* timestamp preservation is optional; content is what matters */
    }
    withLockRetrySync(() => fs.renameSync(tmp, dest));
  } catch (err) {
    removeQuietly(tmp);
    return {
      path: resolveSnapshotFile(dest),
      written: false,
      reason: `error:${(err && err.code) || "unknown"}`,
    };
  }
  // The fresh plain copy is longer than any compressed one; drop the stale
  // archive (the reader would prefer the plain file anyway).
  if (gzLength !== null) removeQuietly(dest + GZ_SUFFIX);
  return { path: dest, written: true };
}

/**
 * Compress a plain `.jsonl` snapshot to `.jsonl.gz` in place. The plain file is
 * removed only after the archive has been decompressed again and matched
 * byte-for-byte (SHA-256 + length), and only if the plain file did not change
 * meanwhile. Any failure leaves the plain file untouched.
 *
 * @returns {Promise<{ ok: boolean, bytesBefore?: number, bytesAfter?: number,
 *   plainRemoved?: boolean, reason?: string }>}
 */
async function compressSnapshotFile(jsonlPath) {
  const before = lstatOrNull(jsonlPath);
  if (!before || !before.isFile()) return { ok: false, reason: "not-a-file" };
  const gzPath = jsonlPath + GZ_SUFFIX;
  const tmp = tempPathFor(gzPath);

  const sourceHash = crypto.createHash("sha256");
  let sourceLength = 0;
  let crc = 0;
  let handle;
  try {
    handle = await fs.promises.open(tmp, "wx");
    await handle.write(buildGzipHeader(before.size));
    const tap = new Transform({
      transform(chunk, _enc, cb) {
        sourceHash.update(chunk);
        crc = crc32(chunk, crc);
        sourceLength += chunk.length;
        cb(null, chunk);
      },
    });
    await pipelineAsync(
      fs.createReadStream(jsonlPath),
      tap,
      zlib.createDeflateRaw({ level: 6 }),
      async function (compressed) {
        for await (const chunk of compressed) await handle.write(chunk);
      }
    );
    const trailer = Buffer.alloc(8);
    trailer.writeUInt32LE(crc >>> 0, 0);
    trailer.writeUInt32LE(sourceLength % 0x100000000, 4);
    await handle.write(trailer);
    await handle.sync();
    await handle.close();
    handle = undefined;

    const after = lstatOrNull(jsonlPath);
    if (
      sourceLength !== before.size ||
      !after ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs
    ) {
      removeQuietly(tmp);
      return { ok: false, reason: "changed-during-compression" };
    }

    // Verify with the standard gunzip (checks CRC32 + ISIZE itself) and our
    // own hash/length before trusting the archive with the only copy.
    const verifyHash = crypto.createHash("sha256");
    let verifyLength = 0;
    await pipelineAsync(fs.createReadStream(tmp), zlib.createGunzip(), async function (plainOut) {
      for await (const chunk of plainOut) {
        verifyHash.update(chunk);
        verifyLength += chunk.length;
      }
    });
    if (
      verifyLength !== sourceLength ||
      verifyHash.digest("hex") !== sourceHash.digest("hex") ||
      readRecordedLength(tmp) !== sourceLength
    ) {
      removeQuietly(tmp);
      return { ok: false, reason: "verify-failed" };
    }

    try {
      fs.utimesSync(tmp, before.atime, before.mtime);
    } catch {
      /* keep the archive even if its timestamp can't be preserved */
    }
    await withLockRetry(() => fs.promises.rename(tmp, gzPath));
  } catch (err) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        /* ignore */
      }
    }
    removeQuietly(tmp);
    return { ok: false, reason: `error:${(err && err.code) || "unknown"}` };
  }

  const bytesAfter = (lstatOrNull(gzPath) || { size: 0 }).size;
  // Only remove the plain file if it is still exactly the one we archived. A
  // sync writer may have replaced it while we awaited (the original came back
  // and grew); that newer, longer copy must survive — the reader prefers the
  // plain file, and its next write drops the now-stale archive.
  const current = lstatOrNull(jsonlPath);
  if (
    !current ||
    current.ino !== before.ino ||
    current.size !== before.size ||
    current.mtimeMs !== before.mtimeMs
  ) {
    return { ok: true, bytesBefore: before.size, bytesAfter, plainRemoved: false };
  }
  let plainRemoved = true;
  try {
    await withLockRetry(() => fs.promises.unlink(jsonlPath));
  } catch {
    // Both copies are now on disk and identical; the reader prefers the plain
    // one and the next maintenance pass retries the removal.
    plainRemoved = false;
  }
  return { ok: true, bytesBefore: before.size, bytesAfter, plainRemoved };
}

// ── inventory & delete ───────────────────────────────────────────────────────

/**
 * Walk a snapshot root without following symlinks, skipping dot-entries
 * (tombstones, temp files). Each file is attributed to a session: top-level
 * `<sid>.jsonl[.gz]` and everything under a top-level `<sid>/` directory.
 *
 * @returns {Array<{ path: string, sessionId: string|null, size: number,
 *   compressed: boolean, mtimeMs: number, topLevel: boolean }>}
 */
function listSnapshotFiles(root) {
  const out = [];
  let top;
  try {
    top = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of top) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    if (entry.isFile()) {
      const stat = lstatOrNull(full);
      if (!stat) continue;
      const logical = logicalPath(entry.name);
      out.push({
        path: full,
        sessionId: logical.endsWith(".jsonl") ? logical.slice(0, -".jsonl".length) : null,
        size: stat.size,
        compressed: isCompressedPath(entry.name),
        mtimeMs: stat.mtimeMs,
        topLevel: true,
      });
    } else if (entry.isDirectory()) {
      const pending = [full];
      while (pending.length) {
        const dir = pending.pop();
        let children;
        try {
          children = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const child of children) {
          if (child.name.startsWith(".")) continue;
          const childPath = path.join(dir, child.name);
          if (child.isDirectory()) pending.push(childPath);
          else if (child.isFile()) {
            const stat = lstatOrNull(childPath);
            if (!stat) continue;
            out.push({
              path: childPath,
              sessionId: entry.name,
              size: stat.size,
              compressed: isCompressedPath(child.name),
              mtimeMs: stat.mtimeMs,
              topLevel: false,
            });
          }
        }
      }
    }
  }
  return out;
}

/** Bytes + file counts for a snapshot root, split by plain vs compressed. */
function summarizeSnapshotRoot(root) {
  const summary = {
    path: root,
    files: 0,
    bytes: 0,
    compressed_files: 0,
    compressed_bytes: 0,
    sessions: 0,
  };
  const sessions = new Set();
  for (const file of listSnapshotFiles(root)) {
    summary.files++;
    summary.bytes += file.size;
    if (file.compressed) {
      summary.compressed_files++;
      summary.compressed_bytes += file.size;
    }
    if (file.sessionId) sessions.add(file.sessionId);
  }
  summary.sessions = sessions.size;
  return summary;
}

/**
 * Delete every snapshot file of one session under `root` (main transcript,
 * its compressed twin, the `<sid>/` subagent tree) plus any tombstone. Refuses
 * anything that resolves outside `root`; a symlink is removed as a link, never
 * followed. Locked files are retried, then left for a later pass.
 *
 * @returns {{ files: number, bytes: number, failed: number }}
 */
function deleteSessionSnapshots(root, sessionId) {
  const result = { files: 0, bytes: 0, failed: 0 };
  if (!sessionId || /[\\/]/.test(sessionId) || sessionId.startsWith(".")) return result;
  const targets = [
    path.join(root, `${sessionId}.jsonl`),
    path.join(root, `${sessionId}.jsonl${GZ_SUFFIX}`),
    path.join(root, sessionId),
  ];
  for (const target of targets) {
    if (!isInside(root, target)) continue;
    const stat = lstatOrNull(target);
    if (!stat) continue;
    let files = 1;
    let bytes = stat.isFile() ? stat.size : 0;
    if (stat.isDirectory()) {
      files = 0;
      const pending = [target];
      while (pending.length) {
        const dir = pending.pop();
        let children = [];
        try {
          children = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          /* unreadable subtree: rm below still tries */
        }
        for (const child of children) {
          const childPath = path.join(dir, child.name);
          if (child.isDirectory()) pending.push(childPath);
          else {
            files++;
            bytes += (lstatOrNull(childPath) || { size: 0 }).size;
          }
        }
      }
    }
    try {
      // rmSync never follows symlinks: a link is unlinked, a directory is
      // removed with its links (not their targets).
      fs.rmSync(target, {
        recursive: stat.isDirectory(),
        force: true,
        maxRetries: LOCK_RETRIES,
        retryDelay: LOCK_RETRY_DELAY_MS,
      });
      result.files += files;
      result.bytes += bytes;
    } catch {
      result.failed += files || 1;
    }
  }
  removeTombstone(root, sessionId);
  return result;
}

/** Remove abandoned temp files (from a crash mid-write) older than `maxAgeMs`. */
function cleanupStaleTemp(root, maxAgeMs = 60 * 60 * 1000) {
  let removed = 0;
  const pending = [root];
  while (pending.length) {
    const dir = pending.pop();
    let children;
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      const childPath = path.join(dir, child.name);
      if (child.isDirectory() && child.name !== TOMBSTONE_DIR) pending.push(childPath);
      else if (child.isFile() && child.name.startsWith(".") && child.name.endsWith(TEMP_SUFFIX)) {
        const stat = lstatOrNull(childPath);
        if (stat && Date.now() - stat.mtimeMs > maxAgeMs) {
          removeQuietly(childPath);
          removed++;
        }
      }
    }
  }
  return removed;
}

/** Session ids carrying a tombstone under `root`. */
function listTombstones(root) {
  try {
    return fs
      .readdirSync(path.join(root, TOMBSTONE_DIR), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

module.exports = {
  GZ_SUFFIX,
  cleanupStaleTemp,
  compressSnapshotFile,
  createTranscriptLineReader,
  createTranscriptReadStream,
  deleteSessionSnapshots,
  isCompressedPath,
  listSnapshotFiles,
  listTombstones,
  logicalPath,
  pickMoreComplete,
  readCompressedSync,
  readRecordedLength,
  removeTombstone,
  resolveSnapshotFile,
  summarizeSnapshotRoot,
  transcriptLength,
  writeSnapshot,
  writeTombstone,
};
