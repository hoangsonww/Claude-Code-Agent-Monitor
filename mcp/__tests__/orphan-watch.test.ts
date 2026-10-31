/**
 * @file orphan-watch.test.ts
 * @description Unit tests for the stdio orphan watcher. Covers the re-parenting predicate (including the regression where a server legitimately launched under an init-like parent, e.g. tini as PID 1 in a container, must not be mistaken for an orphan), the stdin end/close detection paths, single-fire semantics, the hard exit deadline that fires when shutdown hangs, and the stop() escape hatch used by the signal handlers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `mcp/__tests__/orphan-watch.test.ts`
 *
 * Scope
 * Unit tests for the stdio orphan watcher. Covers the re-parenting predicate (including the
 * regression where a server legitimately launched under an init-like parent, e.g. tini as PID 1 in a
 * container, must not be mistaken for an orphan), the stdin end/close detection paths, single-fire
 * semantics, the hard exit deadline that fires when shutdown hangs, and the stop() escape hatch used
 * by the signal handlers.
 *
 * Subjects and collaborators
 * - `../src/core/orphan-watch.js` — local module imported by this suite.
 *
 * Harness and isolation
 * - Node's built-in test runner supplies suite lifecycle and isolation; `node:assert/strict` keeps
 *   equality and failure semantics explicit. Every case must be order-independent.
 *
 * Suite groups
 * - `isOrphaned`
 * - `watchForOrphanedHost`
 *
 * Protected behavior
 * - reports an orphan when the parent pid changed
 * - does not report an orphan while the startup parent is intact
 * - does not treat a server born under PID 1 as an orphan
 * - reports an orphan reparented to a subreaper rather than PID 1
 * - shuts down and exits when stdin ends
 * - shuts down when stdin closes
 * - shuts down when the process is reparented, even with stdin open
 * - stays up indefinitely for a server whose parent is PID 1 from birth
 * - fires only once across repeated signals
 * - exits on the hard deadline when shutdown never settles
 * - exits after a rejecting shutdown and reports the error
 * - routes a synchronously throwing shutdown into onShutdownError and still exits
 * - stop() detaches every listener and the poll without shutting down
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep MCP assertions aligned with tool schemas and JSON-RPC error semantics; transport failures must
 *   stay diagnosable.
 *
 * Verification
 * - Run `npm run test:mcp`, `npm run mcp:typecheck`, and `npm run mcp:build` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { isOrphaned, watchForOrphanedHost } from "../src/core/orphan-watch.js";

/** Resolve after `ms`, letting real timers inside the watcher fire. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("isOrphaned", () => {
  it("reports an orphan when the parent pid changed", () => {
    assert.equal(isOrphaned(4242, 1), true);
    assert.equal(isOrphaned(4242, 9001), true);
  });

  it("does not report an orphan while the startup parent is intact", () => {
    assert.equal(isOrphaned(4242, 4242), false);
  });

  it("does not treat a server born under PID 1 as an orphan", () => {
    // Containers running tini/init as PID 1 give the server ppid 1 from birth.
    assert.equal(isOrphaned(1, 1), false);
  });

  it("reports an orphan reparented to a subreaper rather than PID 1", () => {
    // Linux systemd user sessions reparent orphans to the user manager.
    assert.equal(isOrphaned(4242, 777), true);
  });
});

describe("watchForOrphanedHost", () => {
  it("shuts down and exits when stdin ends", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];
    const reasons: string[] = [];
    let shutdowns = 0;

    watchForOrphanedHost({
      shutdown: async () => {
        shutdowns += 1;
      },
      onDetect: (reason) => reasons.push(reason),
      stdin,
      getPpid: () => 4242,
      intervalMs: 5,
      exit: (code) => exits.push(code),
    });

    stdin.emit("end");
    await wait(10);

    assert.deepEqual(reasons, ["stdin_end"]);
    assert.equal(shutdowns, 1);
    assert.deepEqual(exits, [0]);
  });

  it("shuts down when stdin closes", async () => {
    const stdin = new EventEmitter();
    const reasons: string[] = [];

    watchForOrphanedHost({
      shutdown: async () => {},
      onDetect: (reason) => reasons.push(reason),
      stdin,
      getPpid: () => 4242,
      intervalMs: 5,
      exit: () => {},
    });

    stdin.emit("close");
    await wait(10);

    assert.deepEqual(reasons, ["stdin_close"]);
  });

  it("shuts down when the process is reparented, even with stdin open", async () => {
    const stdin = new EventEmitter();
    const reasons: string[] = [];
    let ppid = 4242;

    watchForOrphanedHost({
      shutdown: async () => {},
      onDetect: (reason) => reasons.push(reason),
      stdin,
      getPpid: () => ppid,
      intervalMs: 5,
      exit: () => {},
    });

    await wait(20);
    assert.deepEqual(reasons, [], "must stay up while the parent is unchanged");

    ppid = 1;
    await wait(20);
    assert.deepEqual(reasons, ["reparented"]);
  });

  it("stays up indefinitely for a server whose parent is PID 1 from birth", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];

    watchForOrphanedHost({
      shutdown: async () => {},
      onDetect: () => assert.fail("must not detect an orphan"),
      stdin,
      getPpid: () => 1,
      intervalMs: 5,
      exit: (code) => exits.push(code),
    });

    await wait(30);
    assert.deepEqual(exits, []);
  });

  it("fires only once across repeated signals", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];
    let shutdowns = 0;
    let ppid = 4242;

    const watch = watchForOrphanedHost({
      shutdown: async () => {
        shutdowns += 1;
      },
      stdin,
      getPpid: () => ppid,
      intervalMs: 5,
      exit: (code) => exits.push(code),
    });

    stdin.emit("end");
    stdin.emit("close");
    ppid = 1;
    await wait(20);

    assert.equal(shutdowns, 1);
    assert.deepEqual(exits, [0]);
    assert.equal(watch.hasTriggered(), true);
  });

  it("exits on the hard deadline when shutdown never settles", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];

    watchForOrphanedHost({
      shutdown: () => new Promise<void>(() => {}),
      stdin,
      getPpid: () => 4242,
      intervalMs: 5,
      shutdownTimeoutMs: 15,
      exit: (code) => exits.push(code),
    });

    stdin.emit("end");
    await wait(5);
    assert.deepEqual(exits, [], "no exit before the deadline");

    await wait(30);
    assert.deepEqual(exits, [0], "deadline forces the exit");
  });

  it("exits after a rejecting shutdown and reports the error", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];
    const errors: unknown[] = [];

    watchForOrphanedHost({
      shutdown: async () => {
        throw new Error("transport already closed");
      },
      onShutdownError: (error) => errors.push(error),
      stdin,
      getPpid: () => 4242,
      intervalMs: 5,
      exit: (code) => exits.push(code),
    });

    stdin.emit("end");
    await wait(10);

    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /transport already closed/);
    assert.deepEqual(exits, [0]);
  });

  it("routes a synchronously throwing shutdown into onShutdownError and still exits", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];
    const errors: unknown[] = [];

    watchForOrphanedHost({
      // Throws before ever returning a promise — must not escape into the
      // process-level exception path.
      shutdown: (() => {
        throw new Error("closed synchronously");
      }) as unknown as () => Promise<void>,
      onShutdownError: (error) => errors.push(error),
      stdin,
      getPpid: () => 4242,
      intervalMs: 5,
      exit: (code) => exits.push(code),
    });

    stdin.emit("end");
    await wait(10);

    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /closed synchronously/);
    assert.deepEqual(exits, [0]);
  });

  it("stop() detaches every listener and the poll without shutting down", async () => {
    const stdin = new EventEmitter();
    const exits: number[] = [];
    let ppid = 4242;
    let shutdowns = 0;

    const watch = watchForOrphanedHost({
      shutdown: async () => {
        shutdowns += 1;
      },
      stdin,
      getPpid: () => ppid,
      intervalMs: 5,
      exit: (code) => exits.push(code),
    });

    watch.stop();
    stdin.emit("end");
    ppid = 1;
    await wait(20);

    assert.equal(shutdowns, 0);
    assert.deepEqual(exits, []);
    assert.equal(watch.hasTriggered(), false);
    assert.equal(stdin.listenerCount("end"), 0);
    assert.equal(stdin.listenerCount("close"), 0);
  });
});
