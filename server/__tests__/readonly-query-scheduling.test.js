/**
 * @file Exercises reader dispatch, freshness boundaries and recovery races with
 * a controlled Worker transport and deterministic deadlines; real SQLite tests
 * cover the same transport's production path separately.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { performance } = require("node:perf_hooks");
const { ReadonlyQuery } = require("../lib/readonly-query");
const query = { op: "get", sql: "SELECT 1 AS count", params: [] };
class ControlledWorker extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
    this.terminations = 0;
  }
  ref() {}
  unref() {}
  postMessage(message) {
    this.sent.push(message);
  }
  terminate() {
    this.terminations++;
    return new Promise((resolve) => (this.resolveTermination = resolve));
  }
  finish(result = { count: 1 }) {
    this.emit("message", { id: this.sent.at(-1).id, result });
  }
  exit(code = 1) {
    this.emit("exit", code);
    this.resolveTermination?.(code);
  }
}
function fixture(options = {}) {
  const workers = [];
  const reader = new ReadonlyQuery("/unused-test.db", {
    ...options,
    workerFactory: () => {
      const worker = new ControlledWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { reader, workers };
}
async function close(reader, workers) {
  const closed = reader.close();
  for (const worker of workers) worker.exit();
  await closed;
}
it("marks dispatched work active before started and bounds coalesced generation churn", async () => {
  const { reader, workers } = fixture({ maxPending: 2 });
  try {
    const old = reader.read(query, "before");
    assert.equal(reader.read(query, "before"), old);
    const fresh = reader.read(query, "after-commit");
    assert.notEqual(fresh, old, "a missing started message does not allow stale sharing");
    for (let n = 0; n < 100; n++) assert.equal(reader.read(query, `write-${n}`), fresh);
    assert.equal(reader.pending.size, 2);
    assert.equal(workers[0].sent.length, 1);
    await assert.rejects(
      reader.read({ op: "get", sql: "SELECT 2" }),
      (error) => error.status === 503
    );
    workers[0].finish({ count: 1 });
    assert.equal((await old).count, 1);
    assert.equal(workers[0].sent.length, 2);
    workers[0].finish({ count: 101 });
    assert.equal((await fresh).count, 101);
  } finally {
    await close(reader, workers);
  }
});
it("preserves FIFO fairness and copies accepted query objects", async () => {
  const { reader, workers } = fixture();
  try {
    const old = reader.read(query, "old");
    const coldQuery = { op: "get", sql: "SELECT ? AS cold", params: ["original"] };
    const cold = reader.read(coldQuery, "g1");
    const hot = reader.read(query, "g2");
    coldQuery.params[0] = "mutated";
    coldQuery.sql = "SELECT 'wrong'";
    for (let n = 0; n < 100; n++) assert.equal(reader.read(query, `hot-${n}`), hot);
    workers[0].finish();
    await old;
    assert.equal(workers[0].sent[1].query.sql, "SELECT ? AS cold");
    assert.deepEqual(workers[0].sent[1].query.params, ["original"]);
    workers[0].finish({ cold: "original" });
    assert.equal((await cold).cold, "original");
    workers[0].finish({ count: 2 });
    assert.equal((await hot).count, 2);
  } finally {
    await close(reader, workers);
  }
});
it("queued expiration retains the first deadline and never aborts active work", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { reader, workers } = fixture({ timeoutMs: 1000 });
  try {
    const active = reader.read(query, "g1");
    reader.timeoutMs = 20;
    const waitingQuery = { op: "get", sql: "SELECT 2" };
    const waiting = reader.read(waitingQuery, "g2");
    const rejected = assert.rejects(
      waiting,
      (error) => error.status === 503 && /timed out/.test(error.message)
    );
    t.mock.timers.tick(10);
    assert.equal(reader.read(waitingQuery, "g3"), waiting);
    t.mock.timers.tick(10);
    await rejected;
    assert.equal(reader.pending.size, 1);
    assert.equal(reader.queued.size, 0);
    assert.equal(workers[0].terminations, 0);
    workers[0].finish();
    assert.equal((await active).count, 1);
  } finally {
    await close(reader, workers);
  }
});
it("active timeout fences termination, accepts bounded queued reads and ignores stale results", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { reader, workers } = fixture({ timeoutMs: 20 });
  try {
    const active = reader.read(query, "old");
    const rejected = assert.rejects(active, /timed out/);
    reader.timeoutMs = 1000;
    const queued = reader.read(query, "committed");
    t.mock.timers.tick(20);
    await rejected;
    assert.equal(workers.length, 1);
    assert.equal(reader.worker, null);
    assert.equal(reader.read(query, "newer"), queued);
    workers[0].finish({ count: -1 });
    assert.equal(reader.pending.size, 1);
    workers[0].exit();
    await reader.terminating;
    assert.equal(workers.length, 2);
    workers[0].emit("message", { id: workers[1].sent[0].id, result: { count: -2 } });
    workers[1].finish({ count: 2 });
    assert.equal((await queued).count, 2);
  } finally {
    await close(reader, workers);
  }
});
it("close during termination rejects queued work once without respawning", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { reader, workers } = fixture({ timeoutMs: 20 });
  const active = reader.read(query);
  const activeRejected = assert.rejects(active, /timed out/);
  reader.timeoutMs = 1000;
  const queued = reader.read(query, "next");
  const queuedRejected = assert.rejects(queued, /closed/);
  t.mock.timers.tick(20);
  await activeRejected;
  const closing = reader.close();
  await queuedRejected;
  workers[0].exit();
  await closing;
  assert.equal(workers.length, 1);
  assert.equal(reader.pending.size, 0);
  await assert.rejects(reader.read(query), /unavailable/);
});
it("fatal worker error rejects the queue without a restart storm", async () => {
  const { reader, workers } = fixture();
  const first = reader.read(query);
  const firstRejected = assert.rejects(first, /fatal/);
  const next = reader.read(query, "different");
  const nextRejected = assert.rejects(next, /fatal/);
  workers[0].emit("error", new Error("fatal startup"));
  await Promise.all([firstRejected, nextRejected]);
  workers[0].exit();
  await reader.terminating;
  assert.equal(workers.length, 1);
  assert.equal(reader.pending.size, 0);
  await close(reader, workers);
});

it("a heap limit during a started read rejects only that read", async () => {
  const { reader, workers } = fixture();
  const first = reader.read(query);
  workers[0].emit("message", { id: workers[0].sent[0].id, started: true });
  const next = reader.read(query, "different");
  const oom = Object.assign(new Error("Worker terminated due to reaching memory limit"), {
    code: "ERR_WORKER_OUT_OF_MEMORY",
  });
  workers[0].emit("error", oom);
  await assert.rejects(first, (error) => error.status === 503 && error.cause === oom);
  workers[0].exit();
  await reader.terminating;
  assert.equal(workers.length, 2, "queued work starts one replacement");
  workers[1].finish({ count: 7 });
  assert.deepEqual(await next, { count: 7 });
  assert.equal(reader.pending.size, 0);
  await close(reader, workers);
});

it("a heap limit before a read starts still rejects the queue", async () => {
  const { reader, workers } = fixture();
  const first = assert.rejects(reader.read(query), /memory limit/);
  const next = assert.rejects(reader.read(query, "different"), /memory limit/);
  workers[0].emit(
    "error",
    Object.assign(new Error("Worker terminated due to reaching memory limit"), {
      code: "ERR_WORKER_OUT_OF_MEMORY",
    })
  );
  await Promise.all([first, next]);
  workers[0].exit();
  await reader.terminating;
  assert.equal(workers.length, 1);
  await close(reader, workers);
});

it("a rejected terminate call cannot release the actual-exit fence", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { reader, workers } = fixture({ timeoutMs: 20 });
  try {
    const active = reader.read(query, "old");
    const rejected = assert.rejects(active, /timed out/);
    reader.timeoutMs = 1000;
    const waiting = reader.read(query, "new");
    workers[0].terminate = () => Promise.reject(new Error("terminate failed"));
    t.mock.timers.tick(20);
    await rejected;
    await Promise.resolve();
    assert.ok(reader.terminating);
    assert.equal(workers.length, 1);
    workers[0].exit();
    await reader.terminating;
    workers[1].finish({ count: 2 });
    assert.equal((await waiting).count, 2);
  } finally {
    await close(reader, workers);
  }
});

it("an uncloneable query rejects only its caller", async () => {
  const { reader, workers } = fixture();
  try {
    const active = reader.read(query);
    await assert.rejects(reader.read({ op: "get", sql: "SELECT ?", params: [() => 1] }), /clone/i);
    assert.equal(reader.pending.size, 1);
    assert.equal(workers[0].terminations, 0);
    workers[0].finish();
    assert.equal((await active).count, 1);
  } finally {
    await close(reader, workers);
  }
});

it("checks elapsed budgets when timer delivery is delayed: results, dispatch and joins", async (t) => {
  let now = 0;
  t.mock.method(performance, "now", () => now);
  const { reader, workers } = fixture({ timeoutMs: 100 });
  try {
    const active = reader.read(query, "old");
    reader.timeoutMs = 20;
    const expired = reader.read({ op: "get", sql: "SELECT 2" });
    const expiredRejected = assert.rejects(expired, /timed out/);
    now = 50; // Advance elapsed time without delivering any timeout callback.
    workers[0].finish();
    assert.equal((await active).count, 1);
    await expiredRejected;
    assert.equal(workers[0].sent.length, 1, "overdue queued job is never dispatched");
    // A separate active job receives its result after its deadline.
    reader.timeoutMs = 100;
    const late = reader.read(query, "next");
    const lateRejected = assert.rejects(late, /timed out/);
    now = 151;
    workers[0].finish();
    await lateRejected;
    assert.equal(workers[0].terminations, 1);
    workers[0].exit();
    await reader.terminating;
    const join = reader.read(query, "same");
    const joinRejected = assert.rejects(join, /timed out/);
    now = 252;
    const fresh = reader.read(query, "same");
    assert.notEqual(fresh, join, "new caller cannot join an overdue active job");
    await joinRejected;
    const queued = [...reader.queued.values()][0];
    const freshRejected = assert.rejects(fresh, /timed out/);
    now = 353;
    const newer = reader.read(query, "newer");
    assert.notEqual(newer, fresh, "new caller cannot join an overdue queued job");
    await freshRejected;
    assert.equal(reader.pending.has(queued.id), false);
    workers[1].exit();
    await reader.terminating;
    workers[2].finish({ count: 3 });
    assert.equal((await newer).count, 3);
  } finally {
    await close(reader, workers);
  }
});
