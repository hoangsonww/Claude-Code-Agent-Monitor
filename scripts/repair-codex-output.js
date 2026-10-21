#!/usr/bin/env node
/**
 * @file Dry-run-first, journaled repair of Codex output tokens that previously
 * counted the reasoning breakdown twice. Reproduces legacy totals before writes,
 * checks ownership/cursors/files again, and never changes events or baselines.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const fs = require("node:fs");
const path = require("node:path");
const { codexTokenDelta } = require("../server/lib/codex-token-accounting");
const NUMBERS = ["input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens"];
const fingerprint = (file) => {
  try {
    const s = fs.statSync(file);
    return [s.dev, s.ino, s.size, s.mtimeMs];
  } catch {
    return null;
  }
};
const plain = (rows) => rows.map((row) => ({ ...row }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const key = (row) => JSON.stringify([row.model, row.speed, row.context_size]);

function createAccumulator(session, soleBucket) {
  let model = session.model || "unknown",
    speed = "standard",
    previous = {},
    identity = null,
    seen = 0;
  const buckets = new Map();
  const accept = (record) => {
    const p = record.payload || {};
    if (record.type === "session_meta") {
      identity = p.id;
      if (session.id && identity !== session.id) throw new Error("transcript-identity-mismatch");
    }
    if (
      record.type === "turn_context" ||
      (record.type === "event_msg" && p.type === "thread_settings_applied")
    ) {
      model = record.type === "turn_context" ? p.model || model : p.thread_settings?.model || model;
      const tier =
        p.service_tier ||
        p.serviceTier ||
        p.thread_settings?.service_tier ||
        p.thread_settings?.serviceTier;
      speed = tier === "fast" || tier === "priority" ? "fast" : "standard";
    }
    const total =
      record.type === "event_msg" && p.type === "token_count" ? p.info?.total_token_usage : null;
    if (!total) return;
    seen++;
    const d = codexTokenDelta(total, previous);
    previous = d.current;
    const descriptor = soleBucket || { model, speed, context_size: d.context };
    const k = key(descriptor);
    const b = buckets.get(k) || {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      legacy_output: 0,
    };
    b.input_tokens += d.input;
    b.output_tokens += d.output;
    b.cache_read_tokens += d.cached;
    b.cache_write_tokens += d.write;
    b.legacy_output += d.legacyOutput;
    buckets.set(k, b);
  };
  return { accept, result: () => ({ buckets, identity, seen }) };
}

function accumulate(records, session, soleBucket) {
  const a = createAccumulator(session, soleBucket);
  for (const record of records) a.accept(record);
  return a.result();
}

async function readPrefix(file, bytes, accumulator) {
  const { StringDecoder } = require("node:string_decoder");
  const zlib = require("node:zlib");
  const compressed = /\.(zst|gz)$/.test(file);
  const source = fs.createReadStream(file, {
    ...(compressed ? {} : { start: 0, end: bytes - 1 }),
    highWaterMark: 64 * 1024,
  });
  let stream = source;
  if (compressed) {
    const decompress = file.endsWith(".gz") ? zlib.createGunzip : zlib.createZstdDecompress;
    if (!decompress) {
      source.destroy();
      throw new Error("unsupported-compression");
    }
    stream = decompress();
    source.on("error", (error) => stream.destroy(error));
    source.pipe(stream);
  }
  const decoder = new StringDecoder("utf8");
  let pending = "",
    read = 0;
  try {
    for await (const chunk of stream) {
      const part = chunk.subarray(0, bytes - read);
      read += part.length;
      pending += decoder.write(part);
      if (pending.length > 8 * 1024 * 1024) throw new Error("record-window-too-large");
      let at;
      while ((at = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, at);
        pending = pending.slice(at + 1);
        if (!line) continue;
        let r;
        try {
          r = JSON.parse(line);
        } catch {
          continue;
        }
        if (
          r.type === "session_meta" ||
          r.type === "turn_context" ||
          (r.type === "event_msg" &&
            ["thread_settings_applied", "token_count"].includes(r.payload?.type))
        )
          accumulator.accept(r);
      }
      if (read === bytes) break;
    }
    pending += decoder.end();
    if (read !== bytes || pending) throw new Error("incomplete-prefix");
    return accumulator.result();
  } finally {
    stream.destroy();
    source.destroy();
  }
}

async function planRepair(db, { limit = Number.MAX_SAFE_INTEGER, sessionId = null } = {}) {
  const sessions = plain(
    db
      .prepare(
        `SELECT id,provider,source,transcript_path,model FROM sessions
    WHERE provider='codex' AND EXISTS(SELECT 1 FROM token_usage t WHERE t.session_id=sessions.id)
    AND (? IS NULL OR sessions.id=?) ORDER BY id LIMIT ?`
      )
      .all(sessionId, sessionId, limit)
  );
  const rows = db.prepare(
    "SELECT * FROM token_usage WHERE session_id=? ORDER BY model,speed,inference_geo,service_tier,context_size"
  );
  const state = db.prepare("SELECT * FROM codex_ingest_state WHERE transcript_path=?");
  const entries = [],
    skipped = [];
  let unchanged = 0;
  for (const session of sessions) {
    const before = plain(rows.all(session.id));
    if (before.every((row) => row.output_tokens === 0)) {
      unchanged++;
      continue;
    }
    if (
      before.some(
        (row) =>
          row.inference_geo !== "global" ||
          row.service_tier !== "standard" ||
          ["baseline_input", "baseline_output", "baseline_cache_read", "baseline_cache_write"].some(
            (k) => row[k] !== 0
          )
      )
    ) {
      skipped.push({ id: session.id, reason: "unsupported-bucket-or-baseline" });
      continue;
    }
    const cursor = state.get(session.transcript_path || "");
    const canonicalStat = fingerprint(session.transcript_path || "");
    const sourceFile = canonicalStat
      ? session.transcript_path
      : [".zst", ".gz"]
          .map((ext) => (session.transcript_path || "") + ext)
          .find((file) => fingerprint(file));
    const stat = fingerprint(sourceFile || "");
    let parsed;
    try {
      if (
        stat &&
        cursor?.session_id === session.id &&
        cursor.byte_offset > 0 &&
        (sourceFile !== session.transcript_path || cursor.byte_offset <= stat[2]) &&
        !cursor.remainder
      ) {
        parsed = await readPrefix(sourceFile, cursor.byte_offset, createAccumulator(session));
        if (parsed.identity !== session.id) throw new Error("transcript-identity-mismatch");
      } else throw new Error("missing-complete-transcript");
      if (!parsed.seen) throw new Error("missing-token-records");
      if (stat && !same(stat, fingerprint(sourceFile))) throw new Error("transcript-changed");
      const after = [];
      for (const row of before) {
        const b = parsed.buckets.get(key(row));
        if (!b || NUMBERS.filter((k) => k !== "output_tokens").some((k) => row[k] !== b[k]))
          throw new Error("legacy-input-mismatch");
        if (row.output_tokens !== b.legacy_output && row.output_tokens !== b.output_tokens)
          throw new Error("legacy-output-mismatch");
        after.push({ ...row, output_tokens: b.output_tokens });
      }
      if (
        [...parsed.buckets.entries()].some(
          ([k, b]) =>
            !before.some((row) => key(row) === k) && NUMBERS.some((n) => b[n] || b.legacy_output)
        )
      )
        throw new Error("missing-bucket");
      if (same(before, after)) {
        unchanged++;
        continue;
      }
      entries.push({
        session,
        before,
        after,
        cursor: cursor ? { ...cursor } : null,
        sourceFile,
        canonicalStat,
        stat,
      });
    } catch (error) {
      skipped.push({
        id: session.id,
        reason:
          error.code || (error instanceof SyntaxError ? "invalid-token-record" : error.message),
      });
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  return { entries, skipped, unchanged, scanned: sessions.length };
}

function writeExclusive(file, content, { syncDirectory = true } = {}) {
  const fd = fs.openSync(file, "wx", 0o600);
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  // Flush the new directory entry before committing any application-data change.
  // If the filesystem cannot provide this guarantee, refuse repair writes. A
  // preview plan changes no data, so it does not need (or fail on) this flush.
  if (!syncDirectory) return;
  const directory = fs.openSync(path.dirname(path.resolve(file)), "r");
  try {
    fs.fsyncSync(directory);
  } finally {
    fs.closeSync(directory);
  }
}

function applyRepair(db, plan, journalPath) {
  // A durable, exclusive before/after journal must exist before the first UPDATE.
  writeExclusive(journalPath, JSON.stringify(plan) + "\n");
  const rows = db.prepare(
    "SELECT * FROM token_usage WHERE session_id=? ORDER BY model,speed,inference_geo,service_tier,context_size"
  );
  const update =
    db.prepare(`UPDATE token_usage SET output_tokens=? WHERE session_id=? AND model=? AND speed=?
    AND inference_geo=? AND service_tier=? AND context_size=?`);
  const apply = db.transaction((entry) => {
    const current = db
      .prepare("SELECT id,provider,source,transcript_path,model FROM sessions WHERE id=?")
      .get(entry.session.id);
    const cursor = db
      .prepare("SELECT * FROM codex_ingest_state WHERE transcript_path=?")
      .get(entry.session.transcript_path || "");
    if (
      !same(current ? { ...current } : null, entry.session) ||
      !same(cursor ? { ...cursor } : null, entry.cursor) ||
      !same(plain(rows.all(entry.session.id)), entry.before) ||
      !same(fingerprint(entry.sourceFile || ""), entry.stat) ||
      !same(fingerprint(entry.session.transcript_path || ""), entry.canonicalStat)
    )
      return false;
    for (const row of entry.after)
      update.run(
        row.output_tokens,
        row.session_id,
        row.model,
        row.speed,
        row.inference_geo,
        row.service_tier,
        row.context_size
      );
    return true;
  });
  let repaired = 0,
    changed = 0;
  for (const entry of plan.entries) (apply.immediate || apply)(entry) ? repaired++ : changed++;
  return { repaired, changed };
}

async function main(args) {
  const values = new Map();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--help", "--apply"].includes(arg)) {
      values.set(arg, true);
    } else if (["--db", "--out", "--journal", "--session"].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith("--") || values.has(arg))
        throw new Error(`Missing or repeated value for ${arg}`);
      values.set(arg, args[++i]);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (values.has("--help")) {
    console.log(
      "Usage: node scripts/repair-codex-output.js [--db file] [--session id] [--out new-plan.json] [--apply --journal new-backup.json]\nDry-run by default. Stop the monitor before applying; --apply requires an explicit --db."
    );
    return;
  }
  const apply = values.has("--apply");
  if (apply && (!values.has("--db") || !values.has("--journal")))
    throw new Error("--apply requires --db <file> and --journal <new-file.json>");
  const option = (name) => values.get(name);
  const file =
    option("--db") ||
    process.env.DASHBOARD_DB_PATH ||
    path.join(require("../server/lib/claude-home").getDataDir(), "dashboard.db");
  let Database;
  try {
    Database = require("better-sqlite3");
    new Database(":memory:").close();
  } catch {
    Database = require("../server/compat-sqlite");
  }
  const db = new Database(file, { readonly: !apply, fileMustExist: true });
  try {
    db.pragma("busy_timeout = 1000");
    const plan = await planRepair(db, { sessionId: option("--session") || null });
    if (args.includes("--out"))
      writeExclusive(option("--out"), JSON.stringify(plan, null, 2) + "\n", {
        syncDirectory: false,
      });
    const result = apply ? applyRepair(db, plan, option("--journal")) : {};
    console.log(
      JSON.stringify({
        scanned: plan.scanned,
        eligible: plan.entries.length,
        unchanged: plan.unchanged,
        skipped: plan.skipped.length,
        reasons: plan.skipped.reduce((a, r) => ((a[r.reason] = (a[r.reason] || 0) + 1), a), {}),
        ...result,
      })
    );
  } finally {
    db.close();
  }
}
if (require.main === module)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { planRepair, applyRepair, accumulate, writeExclusive };
