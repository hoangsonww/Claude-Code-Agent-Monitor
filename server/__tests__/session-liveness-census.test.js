/**
 * @file Runs the asynchronous liveness census against stand-in ps and lsof
 * binaries: a process that exits between ps and the per-pid read is skipped,
 * while a live process whose state cannot be read still makes the census
 * unavailable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, spawnSync } = require("node:child_process");
const liveness = require("../lib/session-liveness");

const skip = process.platform === "win32" ? "the probe is disabled on Windows" : false;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-census-"));
const bin = path.join(root, "bin");
const rollout = path.join(root, "rollout-2026-10-13T00-00-00-census.jsonl");
const savedPath = process.env.PATH;
const savedProbe = process.env.DASHBOARD_LIVENESS_PROBE;
let rolloutFd;
const uid = typeof process.getuid === "function" ? process.getuid() : 0;
let unreadable;

before(() => {
  fs.mkdirSync(bin);
  fs.writeFileSync(rollout, "{}\n");
  rolloutFd = fs.openSync(rollout, "r");
  // lsof prints records only for the test process and exits 1, as real lsof
  // does when some requested pids no longer exist.
  fs.writeFileSync(path.join(bin, "ps"), '#!/bin/sh\nprintf "%s" "$CENSUS_PS"\n', { mode: 0o755 });
  fs.writeFileSync(
    path.join(bin, "lsof"),
    `#!/bin/sh
case "$*" in
  *cwd*) printf 'p%s\\nfcwd\\nn%s\\n' "$CENSUS_ALIVE" "$CENSUS_CWD" ;;
  *) printf 'p%s\\nf9\\nn%s\\n' "$CENSUS_ALIVE" "$CENSUS_ROLLOUT" ;;
esac
exit 1
`,
    { mode: 0o755 }
  );
  process.env.PATH = `${bin}${path.delimiter}${savedPath}`;
  process.env.DASHBOARD_LIVENESS_PROBE = "1";
  process.env.CENSUS_ALIVE = String(process.pid);
  process.env.CENSUS_CWD = process.cwd();
  process.env.CENSUS_ROLLOUT = rollout;
});

after(() => {
  process.env.PATH = savedPath;
  if (savedProbe === undefined) delete process.env.DASHBOARD_LIVENESS_PROBE;
  else process.env.DASHBOARD_LIVENESS_PROBE = savedProbe;
  if (unreadable) unreadable.kill();
  fs.closeSync(rolloutFd);
  fs.rmSync(root, { recursive: true, force: true });
});

function exitedPid() {
  return spawnSync(process.execPath, ["-e", ""]).pid;
}

it("a process that exited before its cwd was read does not void the census", { skip }, async () => {
  const gone = exitedPid();
  process.env.CENSUS_PS = `${process.pid} ${uid} claude --resume\n${gone} ${uid} claude\n`;
  const result = await liveness.probeLiveCwdsAsync("claude");
  assert.equal(result.available, true);
  assert.ok(result.cwds.has(path.resolve(process.cwd())));
});

it(
  "a Codex process that exited before its descriptors were read is skipped",
  { skip },
  async () => {
    const gone = exitedPid();
    process.env.CENSUS_PS = `${process.pid} ${uid} codex resume\n${gone} ${uid} codex\n`;
    const result = await liveness.probeLiveCodexRolloutsAsync();
    assert.equal(result.available, true);
    assert.ok(result.paths.has(fs.realpathSync(rollout)) || result.paths.has(rollout));
  }
);

it(
  "a live process without an lsof record still makes the census unavailable",
  { skip: skip || (process.platform === "linux" && "Linux reads /proc, not lsof") },
  async () => {
    unreadable = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"]);
    process.env.CENSUS_PS = `${process.pid} ${uid} claude\n${unreadable.pid} ${uid} claude\n`;
    assert.equal((await liveness.probeLiveCwdsAsync("claude")).available, false);
    process.env.CENSUS_PS = `${process.pid} ${uid} codex\n${unreadable.pid} ${uid} codex\n`;
    assert.equal((await liveness.probeLiveCodexRolloutsAsync()).available, false);
  }
);
