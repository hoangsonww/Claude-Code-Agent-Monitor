/**
 * @file orphan-watch.test.ts
 * @description Unit tests for the stdio orphan watcher. Covers the re-parenting predicate (including the regression where a server legitimately launched under an init-like parent, e.g. tini as PID 1 in a container, must not be mistaken for an orphan), the stdin end/close detection paths, single-fire semantics, the hard exit deadline that fires when shutdown hangs, and the stop() escape hatch used by the signal handlers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/__tests__/orphan-watch.test.ts
 * **Area:** MCP test
 * **Responsibility:**
 * Unit tests for the stdio orphan watcher. Covers the re-parenting predicate (including the
 * regression where a server legitimately launched under an init-like parent, e.g. tini as PID 1 in
 * a container, must not be mistaken for an orphan), the stdin end/close detection paths,
 * single-fire semantics, the hard exit deadline that fires when shutdown hangs, and the stop()
 * escape hatch used by the signal handlers.
 *
 * ## Architectural boundary
 * - Protects MCP schema, policy, API-client, formatting, lifecycle, or transport behavior using
 *   Node's test runner.
 * - Tests should exercise public contracts with realistic SDK and HTTP boundaries while keeping
 *   external state local.
 * - Fixtures must not contain usable credentials or depend on the operator's real dashboard
 *   configuration.
 *
 * ## Local dependency edges
 * - `../src/core/orphan-watch.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:assert/strict` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:events` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:test` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `wait` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `does not report an orphan while the startup parent is intact` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `does not treat a server born under PID 1 as an orphan` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `exits after a rejecting shutdown and reports the error` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `exits on the hard deadline when shutdown never settles` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `fires only once across repeated signals` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `isOrphaned` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `reports an orphan reparented to a subreaper rather than PID 1` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `reports an orphan when the parent pid changed` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `routes a synchronously throwing shutdown into onShutdownError and still exits` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `shuts down and exits when stdin ends` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `shuts down when stdin closes` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `shuts down when the process is reparented, even with stdin open` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `stays up indefinitely for a server whose parent is PID 1 from birth` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `stop() detaches every listener and the poll without shutting down` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `watchForOrphanedHost` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the exact protocol or policy contract in each test so a failure identifies the broken
 *   boundary.
 * - Use ephemeral ports, temporary directories, and isolated environment values for concurrent-safe
 *   execution.
 * - Restore process globals, environment variables, clocks, fetch stubs, and listeners after every
 *   case.
 * - Assert structured results and error shapes rather than only checking that a call throws.
 * - Cover redaction and permission denial for every secret-bearing or state-changing path.
 * - Avoid snapshotting unstable SDK internals when a focused schema or result assertion is clearer.
 * - Test cleanup and idempotence because abandoned transports and timers can keep the process
 *   alive.
 * - Keep test doubles behaviorally faithful to the API client methods used by the subject.
 * - Exercise malformed and boundary inputs at schema and direct-function layers where each owns
 *   distinct validation.
 * - Prove regression tests fail against the broken behavior before accepting a fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/__tests__/orphan-watch.test.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
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
