/**
 * @file Bounded, lazy read-only SQLite worker for dashboard counts, cost snapshots,
 * task events and event pages.
 * Active reads share only within one database write generation; identical queued
 * reads share their future snapshot. Idle workers hold no connection or Node ref.
 * A worker that runs out of heap during a started read rejects only that read;
 * queued reads continue on a replacement worker.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { EventEmitter } = require("node:events");
const { performance } = require("node:perf_hooks");

// The worker's old generation is capped at 32 MB. Measured on Node 22.22 and 24
// with both drivers, a .all() page of 64 KB rows survives 18.8 MB of UTF-8 and
// runs out of heap at 20 MB (larger rows last longer); 8 MiB leaves headroom.
const WORKER_HEAP_MB = 32;
const EVENT_PAGE_BUDGET_BYTES = 8 * 1024 * 1024;

class ReadonlyQuery extends EventEmitter {
  constructor(
    dbPath,
    {
      driver = "auto",
      timeoutMs = 30000,
      maxPending = 64,
      eventPageBudgetBytes = EVENT_PAGE_BUDGET_BYTES,
      workerFactory = (file, options) => new Worker(file, options),
    } = {}
  ) {
    super();
    this.dbPath = path.resolve(dbPath);
    this.driver = driver;
    this.timeoutMs = timeoutMs;
    this.maxPending = maxPending;
    this.eventPageBudgetBytes = eventPageBudgetBytes;
    this.workerFactory = workerFactory;
    this.worker = null;
    this.workerExit = null;
    this.terminating = null;
    this.closed = false;
    this.pending = new Map();
    this.queued = new Map();
    this.active = null;
    this.nextId = 0;
  }

  read(query, generation = "") {
    if (this.closed) return Promise.reject(this.busyError("Database reader is unavailable"));
    let key;
    let copy;
    try {
      key = JSON.stringify(query);
      if (this.active && this.active.deadlineAt <= performance.now()) this.expire(this.active.id);
      const expired = this.queued.get(key);
      if (expired && expired.deadlineAt <= performance.now()) this.expire(expired.id);
      if (this.active && this.active.key === key && this.active.generation === generation)
        return this.active.promise;
      const waiting = this.queued.get(key);
      if (waiting) {
        // This job has never been sent to the worker: its future snapshot is
        // newer than every merged request, even across committed writes.
        waiting.generation = generation;
        return waiting.promise;
      }
      if (this.pending.size >= this.maxPending)
        return Promise.reject(this.busyError("Database reader queue is full"));
      copy = structuredClone(query);
    } catch (error) {
      return Promise.reject(error);
    }
    const entry = {
      id: ++this.nextId,
      key,
      query: copy,
      generation,
      deadlineAt: performance.now() + this.timeoutMs,
    };
    entry.promise = new Promise((resolve, reject) => {
      entry.resolve = resolve;
      entry.reject = reject;
      // The first caller's total deadline is never extended by joining reads.
      entry.timer = setTimeout(() => this.expire(entry.id), this.timeoutMs);
    });
    this.pending.set(entry.id, entry);
    this.queued.set(key, entry);
    this.dispatch();
    return entry.promise;
  }

  busyError(message) {
    const error = new Error(message);
    error.status = 503;
    return error;
  }

  settle(entry, error, result) {
    if (!entry || !this.pending.delete(entry.id)) return;
    if (this.queued.get(entry.key) === entry) this.queued.delete(entry.key);
    clearTimeout(entry.timer);
    if (error) entry.reject(error);
    else entry.resolve(result);
  }

  dispatch() {
    if (this.closed || this.active || this.terminating || !this.queued.size) return;
    let entry;
    while (this.queued.size) {
      entry = this.queued.values().next().value;
      if (entry.deadlineAt > performance.now()) break;
      this.expire(entry.id);
      entry = null;
    }
    if (!entry) {
      this.worker?.unref();
      return;
    }
    if (!this.worker) {
      try {
        this.start();
      } catch (error) {
        this.fail(error); // Fatal startup cannot spin through queued jobs.
        return;
      }
    }
    this.queued.delete(entry.key);
    // Mark active BEFORE posting; the worker may pin its snapshot before the
    // main thread can receive its started message. Never merge a new generation.
    this.active = entry;
    this.worker.ref();
    try {
      this.worker.postMessage({ id: entry.id, query: entry.query });
    } catch (error) {
      this.fail(error);
    }
  }

  start() {
    const worker = this.workerFactory(path.join(__dirname, "readonly-query-worker.js"), {
      workerData: {
        dbPath: this.dbPath,
        driver: this.driver,
        eventPageBudgetBytes: this.eventPageBudgetBytes,
      },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
    });
    this.worker = worker;
    // Actual exit is the fence, including when terminate() itself rejects.
    this.workerExit = new Promise((resolve) => worker.once("exit", resolve));
    worker.on("message", (message) => {
      if (this.worker !== worker || this.active?.id !== message.id) return;
      if (message.started) {
        this.active.started = true;
        this.emit("started", message.id);
        return;
      }
      const entry = this.active;
      if (entry.deadlineAt <= performance.now()) {
        this.expire(entry.id);
        return;
      }
      this.active = null;
      this.settle(entry, message.error ? new Error(message.error) : null, message.result);
      if (this.pending.size === 0) worker.unref();
      this.dispatch();
    });
    worker.on("error", (error) => {
      if (this.worker !== worker) return;
      // A heap limit hit while serving a started read belongs to that read.
      // Startup and other fatal errors still reject the whole queue.
      if (error?.code === "ERR_WORKER_OUT_OF_MEMORY" && this.active?.started)
        this.failActive(error);
      else this.fail(error);
    });
    worker.on("exit", (code) => {
      if (this.worker === worker) this.fail(new Error(`Database reader exited (${code})`));
    });
    worker.unref();
  }

  retireWorker() {
    const worker = this.worker;
    const exit = this.workerExit;
    this.worker = null;
    this.workerExit = null;
    if (worker && !this.terminating) {
      worker.unref();
      this.terminating = exit.finally(() => {
        this.terminating = null;
        this.dispatch();
      });
      try {
        Promise.resolve(worker.terminate()).catch(() => {});
      } catch {
        // Keep waiting for exit; spawning another native reader is unsafe.
      }
    }
    return this.terminating || Promise.resolve();
  }

  expire(id) {
    const entry = this.pending.get(id);
    if (!entry) return;
    const error = this.busyError("Database read timed out");
    this.settle(entry, error);
    if (this.active === entry) {
      this.active = null;
      this.retireWorker();
    }
    // A queued expiry releases its slot without aborting unrelated work.
  }

  failActive(error) {
    const entry = this.active;
    const failure = this.busyError(error.message);
    failure.cause = error;
    this.active = null;
    this.settle(entry, failure);
    return this.retireWorker();
  }

  fail(error) {
    const failure = this.busyError(error?.message || "Database reader is unavailable");
    failure.cause = error;
    for (const entry of this.pending.values()) this.settle(entry, failure);
    this.active = null;
    return this.retireWorker();
  }

  close() {
    this.closed = true;
    return this.fail(new Error("Database reader closed"));
  }
}

/** Own/external commits and own schema changes invalidate snapshot sharing. */
function databaseGeneration(db) {
  return `${db.prepare("SELECT total_changes() AS n").get().n}:${db.pragma("data_version", { simple: true })}:${db.pragma("schema_version", { simple: true })}`;
}

module.exports = { ReadonlyQuery, databaseGeneration, EVENT_PAGE_BUDGET_BYTES };
