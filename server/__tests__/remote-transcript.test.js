/**
 * @file remote-transcript.test.js
 * @description Path resolution and append-only chunk storage for POST /api/hooks/ingest-transcript.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  resolveTranscriptPath,
  appendChunk,
  decodeBase64Strict,
  MAX_CHUNK_BYTES,
} = require("../lib/remote-transcript");

const SID = "3d9c5424-7921-402a-acef-e038490164e2";
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rt-"));
const DIRECTORY_LINK_TYPE = process.platform === "win32" ? "junction" : "dir";

test("main and subagent layouts resolve under the projects dir", () => {
  const root = tmp();
  const main = resolveTranscriptPath(root, SID, `-Users-me-proj/${SID}.jsonl`);
  assert.equal(main.isMain, true);
  assert.equal(main.abs, path.join(root, "-Users-me-proj", `${SID}.jsonl`));
  const sub = resolveTranscriptPath(root, SID, `-Users-me-proj/${SID}/subagents/agent-a1.jsonl`);
  assert.equal(sub.isMain, false);
  assert.equal(sub.mainAbs, main.abs);
  const wf = resolveTranscriptPath(
    root,
    SID,
    `-Users-me-proj/${SID}/subagents/workflows/run1/agent-x.jsonl`
  );
  assert.equal(wf.isMain, false);
});

test("rejects traversal, wrong session, wrong extension and odd layouts", () => {
  const root = tmp();
  const bad = [
    `../${SID}.jsonl`,
    `proj/../${SID}.jsonl`,
    `proj/${SID}.txt`,
    `proj/other-session.jsonl`,
    `proj/${SID}/subagents/../../x.jsonl`,
    `proj/${SID}/notsub/a.jsonl`,
    `proj/${SID}/subagents/nested/deeper/a.jsonl`,
    `/abs/${SID}.jsonl`,
    `proj//${SID}.jsonl`,
    `proj/${SID}`,
    "",
  ];
  for (const rel of bad) assert.throws(() => resolveTranscriptPath(root, SID, rel), /./, rel);
  assert.throws(() => resolveTranscriptPath(root, "../evil", "p/../evil.jsonl"));
  assert.throws(() => resolveTranscriptPath(root, "", "p/.jsonl"));
});

test("rejects an existing project symlink that escapes the projects dir", () => {
  const base = tmp();
  const root = path.join(base, "projects");
  const outside = path.join(base, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, "redirected-project"), DIRECTORY_LINK_TYPE);

  assert.throws(
    () => resolveTranscriptPath(root, SID, `redirected-project/${SID}.jsonl`),
    /path escapes projects dir/
  );
  assert.equal(fs.readdirSync(outside).length, 0);
});

test("append rechecks containment when a project path becomes a symlink after resolution", () => {
  const base = tmp();
  const root = path.join(base, "projects");
  const outside = path.join(base, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  const resolved = resolveTranscriptPath(root, SID, `redirected-project/${SID}.jsonl`);
  fs.symlinkSync(outside, path.join(root, "redirected-project"), DIRECTORY_LINK_TYPE);

  assert.throws(
    () =>
      appendChunk(resolved.abs, 0, Buffer.from("outside-root\n"), {
        projectsDir: root,
      }),
    /path escapes projects dir/
  );
  assert.equal(fs.readdirSync(outside).length, 0);
});

test(
  "subagent resolution rejects a main transcript symlink that escapes the projects dir",
  {
    skip:
      process.platform === "win32" ? "creating file symlinks requires elevated privileges" : false,
  },
  () => {
    const base = tmp();
    const root = path.join(base, "projects");
    const projectDir = path.join(root, "project");
    const outsideFile = path.join(base, "outside.jsonl");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(outsideFile, "{}\n");
    fs.symlinkSync(outsideFile, path.join(projectDir, `${SID}.jsonl`), "file");

    assert.throws(
      () => resolveTranscriptPath(root, SID, `project/${SID}/subagents/agent-a.jsonl`),
      /path escapes projects dir/
    );
  }
);

test(
  "append rejects a final-file symlink after path resolution",
  {
    skip:
      process.platform === "win32" ? "creating file symlinks requires elevated privileges" : false,
  },
  () => {
    const root = tmp();
    const resolved = resolveTranscriptPath(root, SID, `project/${SID}.jsonl`);
    fs.mkdirSync(path.dirname(resolved.abs), { recursive: true });
    const realFile = path.join(root, "real.jsonl");
    fs.writeFileSync(realFile, "");
    fs.symlinkSync(realFile, resolved.abs, "file");

    assert.throws(
      () => appendChunk(resolved.abs, 0, Buffer.from("must-not-follow\n"), { projectsDir: root }),
      /symbolic link/
    );
    assert.equal(fs.readFileSync(realFile, "utf8"), "");
  }
);

test("append is offset-checked and idempotent on retry", () => {
  const root = tmp();
  const { abs } = resolveTranscriptPath(root, SID, `p/${SID}.jsonl`);
  const a = Buffer.from('{"a":1}\n');
  const b = Buffer.from('{"b":2}\n');
  assert.deepEqual(appendChunk(abs, 0, a), { ok: true, size: a.length });
  // A retried chunk (same offset) is refused with the server's size, not duplicated.
  const retry = appendChunk(abs, 0, a);
  assert.equal(retry.ok, false);
  assert.equal(retry.status, 409);
  assert.equal(retry.size, a.length);
  assert.deepEqual(appendChunk(abs, a.length, b), { ok: true, size: a.length + b.length });
  assert.equal(fs.readFileSync(abs, "utf8"), '{"a":1}\n{"b":2}\n');
  // A gap is refused too.
  assert.equal(appendChunk(abs, 999, a).status, 409);
});

test("a line may span chunks; oversize chunks and oversize files are refused without writing", () => {
  const root = tmp();
  const { abs } = resolveTranscriptPath(root, SID, `p/${SID}.jsonl`);
  const first = Buffer.from('{"big":"aaaa');
  const second = Buffer.from('bbbb"}\n');
  assert.equal(appendChunk(abs, 0, first).ok, true);
  assert.equal(appendChunk(abs, first.length, second).ok, true);
  assert.equal(fs.readFileSync(abs, "utf8"), '{"big":"aaaabbbb"}\n');
  fs.rmSync(abs);
  assert.equal(appendChunk(abs, 0, Buffer.alloc(MAX_CHUNK_BYTES + 1, 0x61)).status, 413);
  assert.equal(
    appendChunk(abs, 0, Buffer.from('{"a":1}\n'), { maxFileBytes: 4 }).code,
    "FILE_TOO_LARGE"
  );
  assert.equal(fs.existsSync(abs), false);
  assert.equal(appendChunk(abs, -1, Buffer.from("x\n")).status, 400);
});

test("an empty chunk is a no-op that reports the current size", () => {
  const root = tmp();
  const { abs } = resolveTranscriptPath(root, SID, `p/${SID}.jsonl`);
  assert.deepEqual(appendChunk(abs, 0, Buffer.alloc(0)), { ok: true, size: 0 });
  assert.equal(fs.existsSync(abs), false);
});

test("strict base64 accepts valid input and rejects bytes the decoder would silently drop", () => {
  assert.equal(decodeBase64Strict(Buffer.from("hello\n").toString("base64")).toString(), "hello\n");
  assert.equal(decodeBase64Strict("").length, 0);
  assert.equal(decodeBase64Strict("@@@@ab"), null);
});
