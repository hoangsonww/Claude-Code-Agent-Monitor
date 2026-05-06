// server/__tests__/uploads-lib.test.js
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-lib-"));
});
after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("uploads lib", () => {
  beforeEach(() => {
    delete require.cache[require.resolve("../lib/uploads")];
  });

  it("saveUpload writes file under <cwd>/.launcher-uploads/<id>/<safeName> and returns metadata", () => {
    const { saveUpload } = require("../lib/uploads");
    const r = saveUpload({
      cwd: tmp,
      originalName: "hello.txt",
      buffer: Buffer.from("hi"),
    });
    assert.equal(r.name, "hello.txt");
    assert.equal(r.size, 2);
    assert.equal(r.kind, "text");
    assert.match(r.id, /^[a-f0-9-]{36}$/);
    assert.equal(r.path, `./.launcher-uploads/${r.id}/hello.txt`);
    const onDisk = fs.readFileSync(path.join(tmp, ".launcher-uploads", r.id, "hello.txt"), "utf8");
    assert.equal(onDisk, "hi");
  });

  it("saveUpload sanitizes filenames (path traversal stripped)", () => {
    const { saveUpload } = require("../lib/uploads");
    const r = saveUpload({
      cwd: tmp,
      originalName: "../../etc/passwd",
      buffer: Buffer.from("x"),
    });
    assert.equal(r.name, "passwd");
    assert.ok(!r.path.includes(".."));
  });

  it("saveUpload kind detection: text vs image vs binary", () => {
    const { saveUpload } = require("../lib/uploads");
    const txt = saveUpload({ cwd: tmp, originalName: "a.md", buffer: Buffer.from("x") });
    const img = saveUpload({ cwd: tmp, originalName: "a.png", buffer: Buffer.from("x") });
    const bin = saveUpload({ cwd: tmp, originalName: "a.bin", buffer: Buffer.from("x") });
    assert.equal(txt.kind, "text");
    assert.equal(img.kind, "image");
    assert.equal(bin.kind, "binary");
  });

  it("ensureGitignore appends .launcher-uploads/ on first call, idempotent on repeat", () => {
    const { ensureGitignore } = require("../lib/uploads");
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "gi-"));
    fs.writeFileSync(path.join(cwd, ".gitignore"), "node_modules\n");
    ensureGitignore(cwd);
    const after1 = fs.readFileSync(path.join(cwd, ".gitignore"), "utf8");
    assert.match(after1, /node_modules\n/);
    assert.match(after1, /\.launcher-uploads\//);
    ensureGitignore(cwd);
    const after2 = fs.readFileSync(path.join(cwd, ".gitignore"), "utf8");
    assert.equal(after1, after2);
    fs.rmSync(cwd, { recursive: true });
  });

  it("ensureGitignore creates .gitignore when missing", () => {
    const { ensureGitignore } = require("../lib/uploads");
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "gi-"));
    ensureGitignore(cwd);
    const text = fs.readFileSync(path.join(cwd, ".gitignore"), "utf8");
    assert.match(text, /\.launcher-uploads\//);
    fs.rmSync(cwd, { recursive: true });
  });

  it("removeUpload deletes the file's whole id-folder; rejects path traversal", () => {
    const { saveUpload, removeUpload } = require("../lib/uploads");
    const r = saveUpload({ cwd: tmp, originalName: "x.txt", buffer: Buffer.from("x") });
    assert.equal(removeUpload({ cwd: tmp, id: r.id }), true);
    assert.equal(fs.existsSync(path.join(tmp, ".launcher-uploads", r.id)), false);
    assert.throws(() => removeUpload({ cwd: tmp, id: "../etc" }), /invalid id/);
  });
});
