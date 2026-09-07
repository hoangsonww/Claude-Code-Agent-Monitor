/**
 * @file Verifies the development server watcher's source filtering and restart
 * burst coalescing without launching a real dashboard process.
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

async function waitFor(predicate, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for filesystem event");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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

  it("watches source files created beneath a new directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-dev-watch-"));
    temporaryDirectories.push(root);
    const changes = [];
    const watcher = createSourceWatcher([root], (changedPath) => changes.push(changedPath), {
      isSource: (changedPath) => path.extname(changedPath) === ".js",
      onWarning: (message) => assert.fail(message),
    });
    try {
      const nested = path.join(root, "new-source-directory");
      fs.mkdirSync(nested);
      await waitFor(() => changes.includes(nested));
      changes.length = 0;

      const source = path.join(nested, "module.js");
      fs.writeFileSync(source, "module.exports = true;\n");
      await waitFor(() => changes.includes(source));
    } finally {
      watcher.close();
    }
  });
});
