/**
 * @file Verifies the development server watcher's source filtering and restart
 * burst coalescing without launching a real dashboard process. The watched tree
 * is real; the OS change notifications are injected through the watcher's
 * `watch` seam, because real ones are droppable and made this suite flaky (see
 * createWatchRecorder below).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createRestartScheduler,
  createSourceWatcher,
  directoriesBelow,
  isRuntimeSource,
} = require("../../scripts/dev-server");

const ROOT = path.resolve(__dirname, "../..");
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * Collects the fs.watch listener the watcher installs per directory, so a test
 * can deliver a change notification itself.
 *
 * The tree under test is REAL — every directory and file below is created on
 * disk before the matching notification is fired, so `directoriesBelow` and the
 * `statSync` directory probe inside the watcher run against exactly what they
 * see in production. Only delivery of the notification is synthesized, because
 * delivery cannot be relied on: libuv keeps one FSEvents stream per event loop
 * on macOS and restarts it whenever a watch handle is added, silently dropping
 * changes that land during the restart. Waiting on a real notification made this
 * test fail under full-suite load, and it failed with a 30s budget as readily as
 * with 2s — the event was lost, not late.
 */
function createWatchRecorder() {
  const listeners = new Map();
  return {
    listeners,
    watch(directory, listener) {
      listeners.set(directory, listener);
      return { on() {}, close() {} };
    },
    /** Delivers a change for `name` inside `directory`, as fs.watch would. */
    emit(directory, name) {
      const listener = listeners.get(directory);
      assert.ok(listener, `no watcher was installed on ${directory}`);
      listener("rename", name);
    },
  };
}

describe("development server watcher", () => {
  it("restarts for runtime sources but ignores tests, docs, and client HMR files", () => {
    assert.equal(isRuntimeSource(path.join(ROOT, "server", "index.js")), true);
    assert.equal(isRuntimeSource(path.join(ROOT, "scripts", "import-history.js")), true);
    assert.equal(isRuntimeSource(path.join(ROOT, "package.json")), true);
    assert.equal(isRuntimeSource(path.join(ROOT, ".env")), true);
    assert.equal(isRuntimeSource(path.join(ROOT, "server", "__tests__", "api.test.js")), false);
    assert.equal(isRuntimeSource(path.join(ROOT, "client", "src", "App.tsx")), false);
    assert.equal(isRuntimeSource(path.join(ROOT, "sw.js")), false);
    assert.equal(isRuntimeSource(path.join(ROOT, "README.md")), false);
  });

  it("coalesces a formatting burst into one restart", async () => {
    let restarts = 0;
    const scheduler = createRestartScheduler(() => {
      restarts += 1;
    }, 20);
    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(restarts, 1);
    scheduler.cancel();
  });

  it("does not descend into test or dependency directories", () => {
    const directories = directoriesBelow(path.join(ROOT, "server"));
    assert.ok(directories.includes(path.join(ROOT, "server", "lib")));
    assert.ok(!directories.some((directory) => directory.includes(`${path.sep}__tests__`)));
    assert.ok(!directories.some((directory) => directory.includes(`${path.sep}node_modules`)));
  });

  it("watches source files created beneath a new directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-dev-watch-"));
    temporaryDirectories.push(root);
    const changes = [];
    const recorder = createWatchRecorder();
    const watcher = createSourceWatcher([root], (changedPath) => changes.push(changedPath), {
      isSource: (changedPath) => path.extname(changedPath) === ".js",
      onWarning: (message) => assert.fail(message),
      watch: recorder.watch,
    });
    try {
      assert.ok(recorder.listeners.has(root), "the root is watched from creation");

      // A directory appearing under a watched root is reported as a change AND
      // becomes watched itself. Without that second half, sources created in a
      // brand new directory would never restart the dev server.
      const nested = path.join(root, "new-source-directory");
      fs.mkdirSync(nested);
      recorder.emit(root, "new-source-directory");
      assert.deepEqual(changes, [nested]);
      assert.ok(recorder.listeners.has(nested), "the new directory is watched too");
      changes.length = 0;

      // A source file created beneath it arrives through that new watcher.
      const source = path.join(nested, "module.js");
      fs.writeFileSync(source, "module.exports = true;\n");
      recorder.emit(nested, "module.js");
      assert.deepEqual(changes, [source]);

      // The source filter still applies below a newly discovered directory.
      fs.writeFileSync(path.join(nested, "README.md"), "# not a runtime source\n");
      recorder.emit(nested, "README.md");
      assert.deepEqual(changes, [source], "non-source files must not restart the server");
    } finally {
      watcher.close();
    }
  });

  it("reports a source file that no longer exists when its change arrives", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-dev-watch-"));
    temporaryDirectories.push(root);
    const changes = [];
    const recorder = createWatchRecorder();
    const watcher = createSourceWatcher([root], (changedPath) => changes.push(changedPath), {
      isSource: (changedPath) => path.extname(changedPath) === ".js",
      onWarning: (message) => assert.fail(message),
      watch: recorder.watch,
    });
    try {
      // Editors save atomically, so the pathname can already be gone when the
      // change is delivered and the directory probe throws. That must still
      // count as a source change rather than being swallowed.
      recorder.emit(root, "replaced.js");
      assert.deepEqual(changes, [path.join(root, "replaced.js")]);
    } finally {
      watcher.close();
    }
  });
});
