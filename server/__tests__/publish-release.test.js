/**
 * @file Exercises release upload retries, recovery, and publication safeguards.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { publishRelease } = require("../../scripts/publish-release");

/**
 * Builds an isolated publisher fixture with recorded gh calls and simulated
 * releases, upload failures, and asset metadata; no network or disk I/O occurs.
 * @param {object} [options] - Existing releases and injected failure scenarios.
 * @returns {{calls: string[][], options: object}} Recorded calls and publisher dependencies.
 */
function fixture({ existing = [], failUploads = 0, badAsset = false, listError = false } = {}) {
  const calls = [];
  const assets = [];
  let failures = failUploads;
  const options = {
    tag: "v2.2.1",
    sha: "a".repeat(40),
    repo: "owner/repo",
    sleep: () => {},
    size: () => 100,
    run(args) {
      calls.push(args);
      if (args[0] === "api") {
        if (listError) throw new Error("network error");
        return JSON.stringify([existing]);
      }
      if (args[1] === "upload") {
        if (failures-- > 0) throw new Error("ReleaseAsset.name already exists");
        assets.push({ name: args[3].split("/").pop(), size: 100, state: "uploaded" });
      }
      if (args[1] === "view") {
        if (badAsset) assets[0].size = 0;
        return JSON.stringify({ assets });
      }
      return "";
    },
  };
  return { calls, options };
}

test("creates a draft, retries duplicate uploads, verifies all assets, then publishes", () => {
  const { calls, options } = fixture({ failUploads: 1 });
  publishRelease(options);
  assert.ok(calls.find((call) => call[1] === "create").includes("--draft"));
  const uploads = calls.filter((call) => call[1] === "upload");
  assert.equal(uploads.length, 5);
  assert.ok(uploads.every((call) => call.includes("--clobber")));
  assert.deepEqual(uploads[0], uploads[1]);
  assert.equal(calls.at(-2)[1], "view");
  assert.deepEqual(calls.at(-1), [
    "release",
    "edit",
    "v2.2.1",
    "--repo",
    "owner/repo",
    "--draft=false",
    "--latest",
  ]);
});

test("resumes an existing draft from the same commit without recreating it", () => {
  const { calls, options } = fixture({
    existing: [{ tag_name: "v2.2.1", draft: true, target_commitish: "a".repeat(40) }],
  });
  publishRelease(options);
  assert.ok(!calls.some((call) => call[1] === "create"));
  assert.equal(calls.at(-1)[1], "edit");
});

test("leaves published releases untouched", () => {
  const { calls, options } = fixture({ existing: [{ tag_name: "v2.2.1", draft: false }] });
  options.size = () => {
    throw new Error("must not read artifacts");
  };
  publishRelease(options);
  assert.equal(calls.length, 1);
});

test("rejects drafts from another commit", () => {
  const { calls, options } = fixture({
    existing: [{ tag_name: "v2.2.1", draft: true, target_commitish: "b".repeat(40) }],
  });
  assert.throws(() => publishRelease(options), /another commit/);
  assert.equal(calls.length, 1);
});

test("never creates a release after a lookup failure", () => {
  const { calls, options } = fixture({ listError: true });
  assert.throws(() => publishRelease(options), /network error/);
  assert.equal(calls.length, 1);
});

test("retains the draft after three failed uploads", () => {
  const { calls, options } = fixture({ failUploads: 3 });
  assert.throws(() => publishRelease(options), /already exists/);
  assert.equal(calls.filter((call) => call[1] === "upload").length, 3);
  assert.ok(!calls.some((call) => call[1] === "edit"));
});

test("does not publish incomplete remote assets", () => {
  const { calls, options } = fixture({ badAsset: true });
  assert.throws(() => publishRelease(options), /verification failed/);
  assert.ok(!calls.some((call) => call[1] === "edit"));
});

test("validates all local artifacts before creating a draft", () => {
  const { calls, options } = fixture();
  options.size = () => 0;
  assert.throws(() => publishRelease(options), /Empty artifact/);
  assert.equal(calls.length, 1);
});
