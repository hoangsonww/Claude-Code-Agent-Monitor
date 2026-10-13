/**
 * @file Exercises actual asynchronous process-probe code with controlled OS
 * commands: each caller gets a fresh census, the event loop stays free,
 * and partial/failed process censuses never become negative liveness evidence
 * unless the missing processes have already exited.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { promisify } = require("node:util");
function fixture({
  failure = null,
  platform = "darwin",
  disabled = false,
  missingPid = false,
  missingCwd = false,
  gone = [],
  uid = null,
  foreign = false,
} = {}) {
  const calls = [];
  const exec = () => {
    throw new Error("unpromisified call");
  };
  exec[promisify.custom] = async (command, args, options) => {
    calls.push({ command, args, options });
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (command === "ps")
      return {
        stdout:
          "42 501 /bin/claude\n43 501 /bin/codex\n" +
          (foreign ? "44 777 /bin/claude\n45 777 /bin/codex\n" : ""),
      };
    if (failure) throw Object.assign(new Error("census failed"), failure);
    if (missingPid) return { stdout: "p99\nn/tmp/unrelated\n" };
    if (missingCwd && args.includes("cwd")) return { stdout: "p42\nfcwd\n" };
    return {
      stdout: args.includes("cwd")
        ? "p42\nfcwd\nn/tmp/provider\n"
        : "p43\nn/tmp/rollout-live.jsonl\n",
    };
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../lib/session-liveness.js"), "utf8"), {
    module,
    require: (name) =>
      name === "node:child_process"
        ? {
            execFile: exec,
            execFileSync: () => {
              throw new Error("sync command called");
            },
          }
        : name === "../../scripts/install-hooks"
          ? { isInsideContainer: () => false }
          : require(name),
    process: {
      platform,
      env: { DASHBOARD_LIVENESS_PROBE: disabled ? "0" : "1" },
      ...(uid === null ? {} : { getuid: () => uid }),
      kill: (pid) => {
        if (gone.includes(String(pid))) throw Object.assign(new Error("gone"), { code: "ESRCH" });
        return true;
      },
    },
  });
  return { probe: module.exports, calls };
}
it("real async probes free the event loop and never join an older census", async () => {
  const { probe, calls } = fixture();
  let done = false;
  const first = probe.probeLiveCwdsAsync();
  const independent = probe.probeLiveCwdsAsync();
  assert.notEqual(independent, first);
  first.then(() => {
    done = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(done, false);
  assert.deepEqual([...(await first).cwds], ["/tmp/provider"]);
  await independent;
  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.timeout, 5000);
  assert.equal(calls.find((c) => c.command === "lsof").options.timeout, 10000);
  const next = probe.probeLiveCwdsAsync();
  assert.notEqual(next, first);
  await next;
  assert.equal(calls.length, 6);
  const rollouts = await probe.probeLiveCodexRolloutsAsync();
  assert.equal(rollouts.available, true);
  assert.deepEqual([...rollouts.paths], ["/tmp/rollout-live.jsonl"]);
});
it("a successful but incomplete lsof census is unavailable", async () => {
  const { probe } = fixture({ missingPid: true });
  assert.equal((await probe.probeLiveCwdsAsync()).available, false);
  assert.equal((await probe.probeLiveCodexRolloutsAsync()).available, false);
});
it("PID headers without a resolved CWD cannot prove process absence", async () => {
  const { probe } = fixture({ missingCwd: true });
  assert.equal((await probe.probeLiveCwdsAsync()).available, false);
});
for (const failure of [
  { code: 1, stdout: "p42\nn/tmp/partial\n" },
  { code: 1, killed: true, signal: "SIGTERM", stdout: "p42\nn/tmp/partial\n" },
  { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", stdout: "p42\nn/tmp/partial\n" },
])
  it(`partial failed census ${failure.code}/${failure.signal || "exit"} is unavailable`, async () => {
    const { probe } = fixture({ failure });
    assert.equal((await probe.probeLiveCwdsAsync()).available, false);
    assert.equal((await probe.probeLiveCodexRolloutsAsync()).available, false);
  });
it("an lsof exit explained by processes that already exited keeps the census", async () => {
  const failure = { code: 1, stdout: "p99\nfcwd\nn/tmp/other\n" };
  const vanished = fixture({ failure, gone: ["42", "43"] }).probe;
  const cwds = await vanished.probeLiveCwdsAsync();
  assert.equal(cwds.available, true);
  assert.deepEqual([...cwds.cwds], ["/tmp/other"]);
  assert.equal((await vanished.probeLiveCodexRolloutsAsync()).available, true);
  for (const unexplained of [
    { code: 1, killed: true, signal: "SIGTERM", stdout: failure.stdout },
    { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", stdout: failure.stdout },
  ]) {
    const { probe } = fixture({ failure: unexplained, gone: ["42", "43"] });
    assert.equal((await probe.probeLiveCwdsAsync()).available, false);
    assert.equal((await probe.probeLiveCodexRolloutsAsync()).available, false);
  }
});
it("another user's agent processes do not make the census incomplete", async () => {
  const { probe, calls } = fixture({ uid: 501, foreign: true });
  const cwds = await probe.probeLiveCwdsAsync();
  assert.equal(cwds.available, true);
  assert.deepEqual([...cwds.cwds], ["/tmp/provider"]);
  assert.equal((await probe.probeLiveCodexRolloutsAsync()).available, true);
  for (const call of calls.filter((c) => c.command === "lsof"))
    assert.doesNotMatch(call.args.join(" "), /44|45/);
});
it("unsupported hosts and the escape hatch never run OS commands", async () => {
  for (const options of [{ platform: "win32" }, { disabled: true }]) {
    const { probe, calls } = fixture(options);
    assert.equal((await probe.probeLiveCwdsAsync()).available, false);
    assert.equal((await probe.probeLiveCodexRolloutsAsync()).available, false);
    assert.equal(calls.length, 0);
  }
});
