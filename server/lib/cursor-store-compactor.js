/**
 * @file Runs bounded legacy Cursor native-store migration in a lazy,
 * heap-limited worker so database copying and verification never stalls the
 * HTTP/hook event loop. One worker is reused to retain same-process retry
 * accounting, and is unreferenced whenever idle.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const path = require("node:path");
const { Worker } = require("node:worker_threads");

const WORKER_HEAP_MB = 64;
let worker = null;
let active = null;
let nextId = 0;

/** Return the stable no-work result used when an isolated migration fails. */
function failedResult() {
  return { scanned: 0, compacted: 0, remaining: 0, failed: true };
}

/** Resolve the active request once and release the worker's event-loop ref. */
function settle(result) {
  if (!active) return;
  const current = active;
  active = null;
  worker?.unref();
  current.resolve(result);
}

/** Drop a failed worker; the next sync lazily starts a clean replacement. */
function retire(failedWorker) {
  if (worker !== failedWorker) return;
  worker = null;
  settle(failedResult());
}

/** Start the persistent migration worker and wire its single-flight protocol. */
function startWorker() {
  const started = new Worker(path.join(__dirname, "cursor-store-compactor-worker.js"), {
    resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_MB },
  });
  worker = started;
  started.on("message", ({ id, result }) => {
    if (worker !== started || active?.id !== id) return;
    settle(result || failedResult());
  });
  started.on("error", () => retire(started));
  started.on("exit", () => retire(started));
  started.unref();
}

/**
 * Compact one bounded batch off-thread. Concurrent sync passes share the
 * in-flight batch instead of queueing duplicate scans.
 */
function compactLegacyCursorStores(options = {}) {
  if (active) return active.promise;
  if (!worker) {
    try {
      startWorker();
    } catch {
      return Promise.resolve(failedResult());
    }
  }
  const id = ++nextId;
  const promise = new Promise((resolve) => {
    active = { id, resolve, promise: null };
  });
  active.promise = promise;
  worker.ref();
  try {
    worker.postMessage({ id, options });
  } catch {
    const failedWorker = worker;
    worker = null;
    settle(failedResult());
    void failedWorker?.terminate();
  }
  return promise;
}

/** Terminate the lazy worker; used by tests and orderly shutdown paths. */
async function closeCursorStoreCompactor() {
  const current = worker;
  worker = null;
  settle(failedResult());
  if (current) await current.terminate().catch(() => undefined);
}

module.exports = { closeCursorStoreCompactor, compactLegacyCursorStores };
