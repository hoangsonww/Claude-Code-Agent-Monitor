/**
 * @file Verifies the development server watcher's source filtering and restart
 * burst coalescing without launching a real dashboard process.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  createRestartScheduler,
  directoriesBelow,
  isRuntimeSource,
} = require("../../scripts/dev-server");

const ROOT = path.resolve(__dirname, "../..");

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
});
