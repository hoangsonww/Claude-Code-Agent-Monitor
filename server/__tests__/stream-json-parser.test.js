// server/__tests__/stream-json-parser.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createLineParser } = require("../lib/stream-json-parser");

describe("createLineParser", () => {
  it("emits one event per complete line", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push('{"a":1}\n{"b":2}\n');
    assert.deepEqual(events, [{ a: 1 }, { b: 2 }]);
  });

  it("buffers partial lines across pushes", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push('{"a":');
    p.push("1}\n");
    assert.deepEqual(events, [{ a: 1 }]);
  });

  it("ignores empty lines", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push("\n\n");
    assert.deepEqual(events, []);
  });

  it("forwards malformed lines to the error callback without throwing", () => {
    const events = [];
    const errors = [];
    const p = createLineParser(
      (obj) => events.push(obj),
      (err, raw) => errors.push({ msg: err.message, raw }),
    );
    p.push("{not json}\n");
    p.push('{"ok":true}\n');
    assert.equal(events.length, 1);
    assert.equal(errors.length, 1);
    assert.match(errors[0].raw, /not json/);
  });

  it("flush emits any pending complete object on close", () => {
    const events = [];
    const p = createLineParser((obj) => events.push(obj));
    p.push('{"x":1}');
    p.flush();
    assert.deepEqual(events, [{ x: 1 }]);
  });
});
