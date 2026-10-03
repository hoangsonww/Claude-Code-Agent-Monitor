/**
 * @file Cross-platform tests for server/lib/snapshot-store.js — the
 * filesystem layer behind durable transcript snapshots (issue #358). Covers
 * never-shrink atomic writes, tombstones, the opt-in age skip, verified gzip
 * compression with the recorded-length header, transparent reads of
 * compressed snapshots, the more-complete-copy pick, contained deletes that
 * never follow symlinks, and deletes while a reader holds the file open.
 * Pure filesystem (no database), so CI runs it on Linux, macOS and Windows.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const store = require("../lib/snapshot-store");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-store-"));
let counter = 0;

function freshDir(name) {
  const dir = path.join(ROOT, `${name}-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function jsonlLines(count, tag = "line") {
  let out = "";
  for (let i = 1; i <= count; i++) {
    out += `${JSON.stringify({ type: "user", n: i, text: `${tag} ${i} ${"x".repeat(80)}` })}\n`;
  }
  return out;
}

async function readAllLines(filePath) {
  const lines = [];
  for await (const line of store.createTranscriptLineReader(filePath)) lines.push(line);
  return lines;
}

function setOld(filePath, daysAgo) {
  const t = new Date(Date.now() - daysAgo * 86400 * 1000);
  fs.utimesSync(filePath, t, t);
}

after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe("writeSnapshot", () => {
  it("copies a new transcript, preserving content and mtime", () => {
    const dir = freshDir("write");
    const src = path.join(dir, "live.jsonl");
    fs.writeFileSync(src, jsonlLines(5));
    setOld(src, 3);
    const root = path.join(dir, "snap");
    const result = store.writeSnapshot({ root, sessionId: "s1", source: src, relPath: "s1.jsonl" });
    assert.equal(result.written, true);
    const dest = path.join(root, "s1.jsonl");
    assert.equal(fs.readFileSync(dest, "utf8"), fs.readFileSync(src, "utf8"));
    assert.ok(Math.abs(fs.statSync(dest).mtimeMs - fs.statSync(src).mtimeMs) < 2000);
    // No temp files left behind.
    assert.deepEqual(
      fs.readdirSync(root).filter((f) => f.startsWith(".")),
      []
    );
  });

  it("re-copies when the source grows", () => {
    const dir = freshDir("grow");
    const src = path.join(dir, "live.jsonl");
    const root = path.join(dir, "snap");
    fs.writeFileSync(src, jsonlLines(3));
    store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    fs.appendFileSync(src, jsonlLines(2, "more"));
    const result = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(result.written, true);
    assert.equal(fs.readFileSync(path.join(root, "s.jsonl"), "utf8"), fs.readFileSync(src, "utf8"));
  });

  it("never shrinks a snapshot when the original is truncated", () => {
    const dir = freshDir("shrink");
    const src = path.join(dir, "live.jsonl");
    const root = path.join(dir, "snap");
    const full = jsonlLines(50);
    fs.writeFileSync(src, full);
    store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    fs.writeFileSync(src, jsonlLines(4)); // provider truncated the original
    const result = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(result.written, false);
    assert.equal(result.reason, "snapshot-longer");
    assert.equal(fs.readFileSync(path.join(root, "s.jsonl"), "utf8"), full);
  });

  it("refreshes an equal-length snapshot only for a newer in-place rewrite", () => {
    const dir = freshDir("rewrite");
    const src = path.join(dir, "live.jsonl");
    const root = path.join(dir, "snap");
    fs.writeFileSync(src, "aaaa\n");
    setOld(src, 2);
    store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    const unchanged = store.writeSnapshot({
      root,
      sessionId: "s",
      source: src,
      relPath: "s.jsonl",
    });
    assert.equal(unchanged.written, false);
    fs.writeFileSync(src, "bbbb\n"); // same length, newer mtime
    const rewritten = store.writeSnapshot({
      root,
      sessionId: "s",
      source: src,
      relPath: "s.jsonl",
    });
    assert.equal(rewritten.written, true);
    assert.equal(fs.readFileSync(path.join(root, "s.jsonl"), "utf8"), "bbbb\n");
  });

  it("refuses destinations outside the root", () => {
    const dir = freshDir("escape");
    const src = path.join(dir, "live.jsonl");
    fs.writeFileSync(src, "x\n");
    const root = path.join(dir, "snap");
    const result = store.writeSnapshot({
      root,
      sessionId: "s",
      source: src,
      relPath: path.join("..", "escaped.jsonl"),
    });
    assert.equal(result.reason, "outside-root");
    assert.equal(fs.existsSync(path.join(dir, "escaped.jsonl")), false);
  });

  it("skips tombstoned sessions until the source changes again", () => {
    const dir = freshDir("tomb");
    const src = path.join(dir, "live.jsonl");
    const root = path.join(dir, "snap");
    fs.writeFileSync(src, jsonlLines(3));
    setOld(src, 10);
    store.writeTombstone(root, "s");
    // Prunes land on sessions idle for days; date the tombstone back so the
    // "resumed" write below is strictly newer even on coarse/fast clocks.
    setOld(path.join(root, ".pruned", "s"), 1);
    const skipped = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(skipped.reason, "tombstoned");
    assert.equal(fs.existsSync(path.join(root, "s.jsonl")), false);
    // A resumed session (source written after the prune) is snapshotted again.
    fs.appendFileSync(src, jsonlLines(1, "resumed"));
    const resumed = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(resumed.written, true);
  });

  it("skips sources idle longer than the opt-in age cap", () => {
    const dir = freshDir("age");
    const src = path.join(dir, "live.jsonl");
    const root = path.join(dir, "snap");
    fs.writeFileSync(src, jsonlLines(2));
    setOld(src, 40);
    const result = store.writeSnapshot({
      root,
      sessionId: "s",
      source: src,
      relPath: "s.jsonl",
      maxAgeDays: 30,
    });
    assert.equal(result.reason, "aged-out");
    const uncapped = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(uncapped.written, true);
  });
});

describe("compressSnapshotFile + reads", () => {
  it("compresses losslessly, records the exact length, and removes the plain file", async () => {
    const dir = freshDir("compress");
    const plain = path.join(dir, "s.jsonl");
    const content = jsonlLines(400);
    fs.writeFileSync(plain, content);
    const result = await store.compressSnapshotFile(plain);
    assert.equal(result.ok, true);
    assert.equal(result.plainRemoved, true);
    assert.equal(fs.existsSync(plain), false);
    const gz = `${plain}.gz`;
    assert.ok(result.bytesAfter < result.bytesBefore);
    assert.equal(store.readRecordedLength(gz), Buffer.byteLength(content));
    // Standard gunzip reads it back (the custom header is valid gzip).
    assert.equal(zlib.gunzipSync(fs.readFileSync(gz)).toString("utf8"), content);
    assert.equal(store.resolveSnapshotFile(plain), gz);
    assert.equal(store.transcriptLength(gz), Buffer.byteLength(content));
    const lines = await readAllLines(gz);
    assert.equal(lines.length, 400);
    assert.equal(JSON.parse(lines[399]).n, 400);
  });

  it("keeps a newer plain copy written while the archive was being finalized", async () => {
    const dir = freshDir("race");
    const plain = path.join(dir, "s.jsonl");
    fs.writeFileSync(plain, jsonlLines(30));
    const newer = jsonlLines(40, "newer");
    // Simulate a sync writer replacing the plain file (temp + rename, like
    // writeSnapshot) in the window after the archive is renamed into place.
    const realRename = fs.promises.rename;
    fs.promises.rename = async (from, to) => {
      await realRename(from, to);
      if (to === `${plain}.gz`) {
        const tmp = path.join(dir, ".swap.tmp");
        fs.writeFileSync(tmp, newer);
        fs.renameSync(tmp, plain);
      }
    };
    try {
      const result = await store.compressSnapshotFile(plain);
      assert.equal(result.ok, true);
      assert.equal(result.plainRemoved, false);
    } finally {
      fs.promises.rename = realRename;
    }
    assert.equal(fs.readFileSync(plain, "utf8"), newer, "the newer copy survives");
    assert.equal(store.resolveSnapshotFile(plain), plain, "reader prefers the plain copy");
  });

  it("handles multi-byte UTF-8 across chunk boundaries", async () => {
    const dir = freshDir("utf8");
    const plain = path.join(dir, "s.jsonl");
    let content = "";
    for (let i = 0; i < 3000; i++)
      content += `${JSON.stringify({ t: `héllo — 日本語 🚀 ${i}` })}\n`;
    fs.writeFileSync(plain, content);
    assert.equal((await store.compressSnapshotFile(plain)).ok, true);
    const lines = await readAllLines(`${plain}.gz`);
    assert.equal(lines.join("\n") + "\n", content);
  });

  it("prefers the plain twin after an interrupted compression", async () => {
    const dir = freshDir("twin");
    const plain = path.join(dir, "s.jsonl");
    fs.writeFileSync(plain, jsonlLines(10));
    fs.writeFileSync(`${plain}.gz`, zlib.gzipSync(fs.readFileSync(plain)));
    assert.equal(store.resolveSnapshotFile(plain), plain);
  });

  it("a longer source replaces a compressed snapshot with a fresh plain copy", async () => {
    const dir = freshDir("regrow");
    const root = path.join(dir, "snap");
    fs.mkdirSync(root);
    const snapPlain = path.join(root, "s.jsonl");
    fs.writeFileSync(snapPlain, jsonlLines(20));
    assert.equal((await store.compressSnapshotFile(snapPlain)).ok, true);

    const src = path.join(dir, "live.jsonl");
    fs.writeFileSync(src, jsonlLines(20)); // same content reappears (remount)
    const same = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(same.written, false);
    assert.equal(same.path, `${snapPlain}.gz`);

    fs.appendFileSync(src, jsonlLines(5, "new"));
    const grown = store.writeSnapshot({ root, sessionId: "s", source: src, relPath: "s.jsonl" });
    assert.equal(grown.written, true);
    assert.equal(fs.existsSync(`${snapPlain}.gz`), false);
    assert.equal(fs.readFileSync(snapPlain, "utf8"), fs.readFileSync(src, "utf8"));
  });

  it("readCompressedSync refuses archives over the cap", async () => {
    const dir = freshDir("cap");
    const plain = path.join(dir, "s.jsonl");
    fs.writeFileSync(plain, jsonlLines(200));
    await store.compressSnapshotFile(plain);
    assert.equal(store.readCompressedSync(`${plain}.gz`, 100), null);
    assert.ok(store.readCompressedSync(`${plain}.gz`, 10 * 1024 * 1024).length > 100);
  });

  it("a foreign gzip without the length header reports an unknown length", () => {
    const dir = freshDir("foreign");
    const gz = path.join(dir, "s.jsonl.gz");
    fs.writeFileSync(gz, zlib.gzipSync(Buffer.from("x\n")));
    assert.equal(store.readRecordedLength(gz), null);
  });
});

describe("pickMoreComplete", () => {
  it("prefers live unless the snapshot is strictly longer", async () => {
    const dir = freshDir("pick");
    const live = path.join(dir, "live.jsonl");
    const snap = path.join(dir, "snap.jsonl");
    fs.writeFileSync(live, jsonlLines(5));
    fs.writeFileSync(snap, jsonlLines(5));
    assert.equal(store.pickMoreComplete(live, snap), live);
    fs.writeFileSync(snap, jsonlLines(9));
    assert.equal(store.pickMoreComplete(live, snap), snap);
    assert.equal(store.pickMoreComplete(null, snap), snap);
    assert.equal(store.pickMoreComplete(live, null), live);
    await store.compressSnapshotFile(snap);
    assert.equal(store.pickMoreComplete(live, `${snap}.gz`), `${snap}.gz`);
  });
});

describe("inventory and deletes", () => {
  let root;
  before(() => {
    root = freshDir("inv");
    fs.writeFileSync(path.join(root, "a.jsonl"), "a\n");
    fs.mkdirSync(path.join(root, "a", "subagents"), { recursive: true });
    fs.writeFileSync(path.join(root, "a", "subagents", "agent-1.jsonl"), "sub\n");
    fs.writeFileSync(path.join(root, "b.jsonl.gz"), zlib.gzipSync(Buffer.from("b\n")));
    store.writeTombstone(root, "z");
    fs.writeFileSync(path.join(root, ".a.jsonl.123.abcd.tmp"), "partial");
  });

  it("lists files per session, skipping dot-entries", () => {
    const files = store.listSnapshotFiles(root);
    const bySession = files.reduce((acc, f) => {
      acc[f.sessionId] = (acc[f.sessionId] || 0) + 1;
      return acc;
    }, {});
    assert.deepEqual(bySession, { a: 2, b: 1 });
    const summary = store.summarizeSnapshotRoot(root);
    assert.equal(summary.files, 3);
    assert.equal(summary.compressed_files, 1);
    assert.equal(summary.sessions, 2);
    assert.deepEqual(store.listTombstones(root), ["z"]);
  });

  it("cleans stale temp files only", () => {
    const tmp = path.join(root, ".a.jsonl.123.abcd.tmp");
    assert.equal(store.cleanupStaleTemp(root), 0); // fresh → kept
    setOld(tmp, 1);
    assert.equal(store.cleanupStaleTemp(root), 1);
    assert.equal(fs.existsSync(tmp), false);
    assert.equal(fs.existsSync(path.join(root, "a.jsonl")), true);
  });

  it("deletes one session's files and tombstone, nothing else", () => {
    store.writeTombstone(root, "a");
    const removed = store.deleteSessionSnapshots(root, "a");
    assert.equal(removed.files, 2);
    assert.equal(removed.failed, 0);
    assert.equal(fs.existsSync(path.join(root, "a.jsonl")), false);
    assert.equal(fs.existsSync(path.join(root, "a")), false);
    assert.equal(fs.existsSync(path.join(root, "b.jsonl.gz")), true);
    assert.equal(store.listTombstones(root).includes("a"), false);
  });

  it("rejects session ids that would escape the root", () => {
    const outside = path.join(path.dirname(root), "victim.jsonl");
    fs.writeFileSync(outside, "keep\n");
    for (const bad of ["../victim", "..", ".", "", "a/../../victim"]) {
      store.deleteSessionSnapshots(root, bad);
    }
    assert.equal(fs.readFileSync(outside, "utf8"), "keep\n");
  });

  it("removes a symlinked session dir as a link, never its target", (t) => {
    const target = freshDir("link-target");
    fs.writeFileSync(path.join(target, "precious.jsonl"), "keep\n");
    const link = path.join(root, "linked");
    try {
      fs.symlinkSync(target, link, "junction");
    } catch {
      t.skip("symlinks/junctions not permitted on this platform/account");
      return;
    }
    store.deleteSessionSnapshots(root, "linked");
    assert.equal(fs.existsSync(link), false);
    assert.equal(fs.readFileSync(path.join(target, "precious.jsonl"), "utf8"), "keep\n");
  });

  it("does not throw when a reader holds the file open (Windows locking)", () => {
    const dir = freshDir("locked");
    const file = path.join(dir, "s.jsonl");
    fs.writeFileSync(file, "locked\n");
    const fd = fs.openSync(file, "r");
    try {
      const result = store.deleteSessionSnapshots(dir, "s");
      assert.equal(result.files + result.failed, 1);
    } finally {
      fs.closeSync(fd);
    }
    // Whatever the platform decided, a retry after release succeeds.
    store.deleteSessionSnapshots(dir, "s");
    assert.equal(fs.existsSync(file), false);
  });

  it("a line reader closed early releases its file handle", async () => {
    const dir = freshDir("early");
    const file = path.join(dir, "s.jsonl");
    fs.writeFileSync(file, jsonlLines(1000));
    for await (const line of store.createTranscriptLineReader(file)) {
      assert.ok(line);
      break;
    }
    await new Promise((resolve) => setImmediate(resolve));
    fs.rmSync(file); // would fail with EBUSY on Windows if the handle leaked
    assert.equal(fs.existsSync(file), false);
  });
});
