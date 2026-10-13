/**
 * @file Runs the actual Codex sweep with delayed discovery, census, stat and
 * cooperative slices to verify home changes cannot finish an obsolete pass.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const start = source.indexOf("function startCodexSessionSync(broadcast) {");
const implementation = source.slice(start, source.indexOf("\n/**", start));
for (const stage of ["discovery", "census", "stat", "slice"])
  it(`home changes during ${stage} abort the old epoch, even after returning to the same root`, async () => {
    let home = "/old",
      listener,
      initial,
      release,
      entered,
      held = false;
    const arrived = new Promise((r) => (entered = r)),
      gate = new Promise((r) => (release = r));
    const calls = { discovery: 0, state: 0, titles: 0, ingest: [], tools: [], reconcile: 0 };
    async function pause(kind) {
      if (stage === kind && !held) {
        held = true;
        entered();
        await gate;
      }
    }
    const transcripts = Array.from({ length: 14 }, (_, i) => `/old/sessions/rollout-${i}.jsonl`);
    const ingestor = {
      findCodexTranscriptsAsync: async () => {
        calls.discovery++;
        await pause("discovery");
        return transcripts;
      },
      syncCodexStateSessions: () => {
        calls.state++;
        return [];
      },
      refreshCodexSessionTitles: () => {
        calls.titles++;
        return [];
      },
      ingestCodexTranscript: (file) => {
        calls.ingest.push(file);
        return {};
      },
      ingestCodexToolEvents: (file) => {
        calls.tools.push(file);
        return {};
      },
      reconcileCodexSessionLiveness: () => {
        calls.reconcile++;
        return [];
      },
    };
    const modules = {
      fs: {
        existsSync: () => false,
        promises: {
          stat: async () => {
            await pause("stat");
            return { size: 1, mtimeMs: 1 };
          },
        },
      },
      "./lib/codex-home": {
        getCodexHome: () => home,
        getCodexSessionsDir: () => home + "/sessions",
        onCodexHomeChanged: (f) => (listener = f),
      },
      "./lib/codex-ingest": ingestor,
      "./lib/session-liveness": {
        probeLiveCodexRolloutsAsync: async () => {
          await pause("census");
          return { available: false };
        },
      },
      "./db": { db: {} },
    };
    vm.runInNewContext(implementation + "\nstartCodexSessionSync(()=>{});", {
      require: (name) => {
        assert.ok(name in modules, name);
        return modules[name];
      },
      path,
      console,
      process: { env: { DASHBOARD_CODEX_SYNC_MS: "0" }, platform: "darwin" },
      createCodexProbeFence: () => Object.assign(() => null, { ownWrites: (write) => write() }),
      createIngestRetryBudget: () => ({ exhausted: () => false, succeed: () => {} }),
      setTimeout: (f) => {
        initial = f;
        return { unref() {} };
      },
      setImmediate: (f) =>
        setImmediate(async () => {
          await pause("slice");
          f();
        }),
    });
    initial();
    await arrived;
    const countBefore = calls.ingest.length;
    home = "/new";
    listener();
    home = "/old";
    listener();
    // Deliver both settings triggers while the obsolete sweep is still waiting.
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const until = Date.now() + 2000;
    while (calls.reconcile < 1 && Date.now() < until) await new Promise((r) => setTimeout(r, 2));
    assert.equal(calls.reconcile, 1);
    assert.equal(calls.discovery, 2);
    assert.equal(calls.ingest.length - countBefore, transcripts.length);
    assert.equal(calls.tools.length - countBefore, transcripts.length);
    if (stage === "discovery" || stage === "census") {
      assert.equal(calls.state, 1);
      assert.equal(calls.titles, 1);
    }
  });
