/**
 * @file Tests for hook payload trimming: the pure trimHookPayload() rules and
 * the end-to-end guarantee that a PostToolUse carrying a whole file is stored
 * small while the caller's payload object is left untouched.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const TEST_DB = path.join(os.tmpdir(), `dashboard-trim-test-${Date.now()}-${process.pid}.db`);
process.env.DASHBOARD_DB_PATH = TEST_DB;
process.env.DASHBOARD_LIVENESS_PROBE = "0";

const { trimHookPayload } = require("../lib/event-payload");
const { createApp, startServer } = require("../index");
const { db } = require("../db");

describe("trimHookPayload", () => {
  it("returns the same object when nothing needs trimming", () => {
    const data = {
      session_id: "s",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_response: { stdout: "a\nb\n", stderr: "", interrupted: false },
    };
    assert.equal(trimHookPayload(data), data);
  });

  it("drops whole-file mirrors and records their size", () => {
    const originalFile = "x".repeat(50_000);
    const data = {
      tool_name: "Edit",
      tool_input: { file_path: "/a.js", old_string: "a", new_string: "b" },
      tool_response: { filePath: "/a.js", originalFile, structuredPatch: [] },
    };
    const out = trimHookPayload(data);
    assert.notEqual(out, data);
    assert.equal(out.tool_response.originalFile, undefined);
    assert.equal(out.tool_response.filePath, "/a.js");
    assert.deepEqual(out.tool_response.structuredPatch, []);
    assert.equal(out._trimmed.dropped["tool_response.originalFile"], 50_002);
    // The caller's object is untouched.
    assert.equal(data.tool_response.originalFile, originalFile);
    assert.equal(data._trimmed, undefined);
  });

  it("drops Read file content and base64 images but keeps the metadata", () => {
    const text = trimHookPayload({
      tool_name: "Read",
      tool_response: {
        type: "text",
        file: { filePath: "/f", content: "z".repeat(9000), numLines: 3 },
      },
    });
    assert.deepEqual(text.tool_response, { type: "text", file: { filePath: "/f", numLines: 3 } });
    const image = trimHookPayload({
      tool_name: "Read",
      tool_response: { type: "image", file: { base64: "A".repeat(9000), type: "image/png" } },
    });
    assert.deepEqual(image.tool_response, { type: "image", file: { type: "image/png" } });
    assert.equal(image._trimmed.dropped["tool_response.file.base64"], 9002);
  });

  it("drops mirrors only for the native tools that produce them", () => {
    const mcp = {
      tool_name: "mcp__files__get",
      tool_response: { file: { content: "short but precious", base64: "AAAA" }, originalFile: "x" },
    };
    assert.equal(trimHookPayload(mcp), mcp);
    const write = trimHookPayload({
      tool_name: "Write",
      tool_response: { filePath: "/w", originalFile: "o".repeat(10), type: "create" },
    });
    assert.deepEqual(write.tool_response, { filePath: "/w", type: "create" });
    assert.deepEqual(write._trimmed, { dropped: { "tool_response.originalFile": 12 } });
  });

  it("cuts long strings anywhere inside tool_input / tool_response", () => {
    const stdout = "line\n".repeat(1000);
    const out = trimHookPayload(
      { tool_input: { command: "x" }, tool_response: { stdout, nested: [{ s: stdout }] } },
      { stringCap: 100 }
    );
    assert.equal(out.tool_response.stdout.startsWith("line\n".repeat(20)), true);
    assert.match(out.tool_response.stdout, /… \[trimmed 4900 more chars\]$/);
    assert.match(out.tool_response.nested[0].s, /trimmed 4900 more chars/);
    assert.equal(out._trimmed.strings, 2);
    assert.equal(out.tool_input.command, "x");
  });

  it("keeps only short scalars of a field that is still over budget", () => {
    const structuredPatch = Array.from({ length: 400 }, (_, i) => ({
      oldStart: i,
      lines: ["+" + "y".repeat(40)],
    }));
    const out = trimHookPayload(
      {
        tool_input: { file_path: "/big.js", content: "c".repeat(50) },
        tool_response: {
          filePath: "/big.js",
          userModified: false,
          structuredPatch,
          type: "update",
        },
      },
      { stringCap: 2048, fieldCap: 4096 }
    );
    assert.deepEqual(out.tool_response, {
      filePath: "/big.js",
      userModified: false,
      type: "update",
    });
    assert.ok(Buffer.byteLength(JSON.stringify(out.tool_response)) <= 4096);
    assert.equal(out._trimmed.replaced.tool_response > 4096, true);
    assert.deepEqual(out.tool_input, { file_path: "/big.js", content: "c".repeat(50) });
  });

  it("keeps a flat map of scalars within the field budget too", () => {
    const flat = {};
    for (let i = 0; i < 200; i++) flat[`key_${i}`] = `value number ${i}`;
    const out = trimHookPayload({ tool_response: flat }, { stringCap: 2048, fieldCap: 400 });
    const bytes = Buffer.byteLength(JSON.stringify(out.tool_response));
    assert.ok(bytes <= 400, `kept ${bytes} bytes`);
    assert.ok(Object.keys(out.tool_response).length > 0, "keeps what fits");
    assert.equal(out.tool_response.key_0, "value number 0");
    assert.equal(out._trimmed.replaced.tool_response > 400, true);
  });

  it("applies the field cap to tool_input as well, and only above the cap", () => {
    const input = { file_path: "/x", lines: Array.from({ length: 300 }, (_, i) => `l${i}`) };
    const over = trimHookPayload({ tool_input: input }, { stringCap: 2048, fieldCap: 1024 });
    assert.deepEqual(over.tool_input, { file_path: "/x" });
    assert.equal(over._trimmed.replaced.tool_input > 1024, true);
    const exact = { tool_input: { a: "b" } };
    const bytes = Buffer.byteLength(JSON.stringify(exact.tool_input));
    assert.equal(trimHookPayload(exact, { stringCap: 2048, fieldCap: bytes }), exact);
  });

  it("never splits a surrogate pair when cutting a string", () => {
    const out = trimHookPayload({ tool_response: { s: "a😀b" } }, { stringCap: 2 });
    assert.equal(out.tool_response.s, "a… [trimmed 3 more chars]");
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(out)));
    const fits = trimHookPayload({ tool_response: { s: "😀" } }, { stringCap: 2 });
    assert.equal(fits.tool_response.s, "😀");
  });

  it("keeps a key literally named __proto__ as data", () => {
    const parsed = JSON.parse(
      '{"tool_response":{"__proto__":{"polluted":true},"stdout":"' + "x".repeat(50) + '"}}'
    );
    const out = trimHookPayload(parsed, { stringCap: 10 });
    assert.equal(JSON.stringify(out).includes('"__proto__":{"polluted":true}'), true);
    assert.equal({}.polluted, undefined);
  });

  it("merges with an existing _trimmed marker instead of replacing it", () => {
    const stored = {
      tool_name: "Bash",
      tool_response: { stdout: "y".repeat(100) },
      _trimmed: { dropped: { "tool_response.originalFile": 500 }, strings: 1 },
    };
    const out = trimHookPayload(stored, { stringCap: 10 });
    assert.deepEqual(out._trimmed, { dropped: { "tool_response.originalFile": 500 }, strings: 2 });
    // A row that needs nothing more is returned as-is, marker and all.
    const settled = { tool_response: { stdout: "ok" }, _trimmed: { strings: 3 } };
    assert.equal(trimHookPayload(settled, { stringCap: 10 }), settled);
  });

  it("is idempotent: trimming an already-trimmed payload changes nothing", () => {
    const first = trimHookPayload(
      {
        tool_name: "Edit",
        tool_input: { new_string: "n".repeat(3000) },
        tool_response: { originalFile: "o".repeat(3000), stdout: "s".repeat(3000) },
      },
      { stringCap: 2048 }
    );
    assert.equal(trimHookPayload(first, { stringCap: 2048 }), first);
    assert.match(first.tool_response.stdout, /… \[trimmed 952 more chars\]$/);
    assert.equal(first._trimmed.strings, 2);
  });

  it("counts the field budget exactly", () => {
    const exact = trimHookPayload(
      { tool_response: { a: "x", big: "y".repeat(500) } },
      { stringCap: 2048, fieldCap: 9 }
    );
    assert.deepEqual(exact.tool_response, { a: "x" });
    assert.equal(Buffer.byteLength(JSON.stringify(exact.tool_response)), 9);
  });

  it("treats a blank env value as unset", () => {
    const data = { tool_response: { s: "q".repeat(5000) } };
    const prev = process.env.DASHBOARD_EVENT_STRING_CAP;
    process.env.DASHBOARD_EVENT_STRING_CAP = "   ";
    try {
      assert.match(trimHookPayload(data).tool_response.s, /trimmed 2952 more chars/);
    } finally {
      if (prev === undefined) delete process.env.DASHBOARD_EVENT_STRING_CAP;
      else process.env.DASHBOARD_EVENT_STRING_CAP = prev;
    }
  });

  it("stores payloads untouched when the string cap is 0", () => {
    const data = { tool_response: { originalFile: "q".repeat(5000) } };
    assert.equal(trimHookPayload(data, { stringCap: 0 }), data);
    const prev = process.env.DASHBOARD_EVENT_STRING_CAP;
    process.env.DASHBOARD_EVENT_STRING_CAP = "0";
    try {
      assert.equal(trimHookPayload(data), data);
    } finally {
      if (prev === undefined) delete process.env.DASHBOARD_EVENT_STRING_CAP;
      else process.env.DASHBOARD_EVENT_STRING_CAP = prev;
    }
  });

  it("never throws on odd input", () => {
    for (const odd of [null, undefined, "text", 42, [], { tool_response: "s".repeat(5000) }]) {
      assert.doesNotThrow(() => trimHookPayload(odd));
    }
    assert.equal(trimHookPayload(null), null);
    assert.match(trimHookPayload({ tool_response: "s".repeat(5000) }).tool_response, /trimmed/);
  });
});

describe("POST /api/hooks/event stores trimmed data", () => {
  let server;
  let BASE;

  before(async () => {
    const app = createApp();
    server = await startServer(app, 0);
    BASE = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    if (server) server.close();
    if (db) db.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(TEST_DB + suffix);
      } catch {
        /* ignore */
      }
    }
  });

  function post(urlPath, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlPath, BASE);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          let text = "";
          res.on("data", (chunk) => (text += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body: text }));
        }
      );
      req.on("error", reject);
      req.end(JSON.stringify(body));
    });
  }

  it("keeps a whole-file Edit response out of the events table", async () => {
    const session_id = "trim-test-session";
    await post("/api/hooks/event", { hook_type: "SessionStart", data: { session_id, cwd: "/p" } });
    const res = await post("/api/hooks/event", {
      hook_type: "PostToolUse",
      data: {
        session_id,
        tool_name: "Edit",
        tool_input: { file_path: "/p/a.js", old_string: "a", new_string: "b" },
        tool_response: {
          filePath: "/p/a.js",
          originalFile: "x".repeat(300_000),
          structuredPatch: [{ oldStart: 1, lines: ["-a", "+b"] }],
        },
      },
    });
    assert.equal(res.status, 200);
    const row = db
      .prepare("SELECT data FROM events WHERE session_id = ? AND event_type = 'PostToolUse'")
      .get(session_id);
    assert.ok(row, "event row stored");
    assert.ok(row.data.length < 2000, `stored ${row.data.length} bytes`);
    const stored = JSON.parse(row.data);
    assert.equal(stored.tool_response.originalFile, undefined);
    assert.deepEqual(stored.tool_response.structuredPatch, [{ oldStart: 1, lines: ["-a", "+b"] }]);
    assert.equal(stored._trimmed.dropped["tool_response.originalFile"], 300_002);
  });
});
