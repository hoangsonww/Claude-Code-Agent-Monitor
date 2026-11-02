/**
 * @file orphan-watch.ts
 * @description Orphan detection for the MCP stdio transport. The SDK's StdioServerTransport only listens for stdin "data"/"error" events, so a stdio-mode server never notices when its host process (Claude Code, an IDE, Codex) dies without sending SIGTERM/SIGINT first — stdin closes silently and the child lingers forever with nothing left to talk to. This module watches two independent signals, stdin reaching end/close and the process being re-parented away from the parent it was launched under, and runs the caller's shutdown function the moment either fires. Re-parenting is detected by comparing against the ppid captured at startup rather than testing for ppid 1, so servers that are legitimately launched with init as their parent (containers running tini as PID 1, exec-style launchers) are not mistaken for orphans, and Linux hosts that reparent to a systemd user instance or another subreaper instead of PID 1 are still caught. A hard exit deadline guarantees termination even when the shutdown path itself hangs, which is the failure mode that leaves orphans spinning at high CPU.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/core/orphan-watch.ts
 * **Area:** MCP server
 * **Responsibility:**
 * Orphan detection for the MCP stdio transport. The SDK's StdioServerTransport only listens for
 * stdin "data"/"error" events, so a stdio-mode server never notices when its host process (Claude
 * Code, an IDE, Codex) dies without sending SIGTERM/SIGINT first — stdin closes silently and the
 * child lingers forever with nothing left to talk to. This module watches two independent signals,
 * stdin reaching end/close and the process being re-parented away from the parent it was launched
 * under, and runs the caller's shutdown function the moment either fires. Re-parenting is detected
 * by comparing against the ppid captured at startup rather than testing for ppid 1, so servers that
 * are legitimately launched with init as their parent (containers running tini as PID 1, exec-style
 * launchers) are not mistaken for orphans, and Linux hosts that reparent to a systemd user instance
 * or another subreaper instead of PID 1 are still caught. A hard exit deadline guarantees
 * termination even when the shutdown path itself hangs, which is the failure mode that leaves
 * orphans spinning at high CPU.
 *
 * ## Architectural boundary
 * - Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent
 *   server behavior.
 * - Domain modules own individual tools; this layer owns consistent registration and process-level
 *   coordination.
 * - Host disappearance and signals must converge on bounded, idempotent cleanup.
 *
 * ## Package dependency edges
 * - `node:events` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `isOrphaned` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `OrphanReason` (type) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `OrphanWatch` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `OrphanWatchOptions` (interface) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `watchForOrphanedHost` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `isOrphaned` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `OrphanReason` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `OrphanWatch` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `OrphanWatchOptions` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `watchForOrphanedHost` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Area invariants
 * - Keep server metadata and advertised capabilities synchronized with the actual registered
 *   implementation.
 * - Do not let one tool-registration failure leave a partially initialized server accepting
 *   requests.
 * - Preserve transport neutrality for tool behavior and result formatting.
 * - Route logs away from protocol stdout and redact secret-bearing fields.
 * - Make startup failures explicit and nonzero while allowing graceful close to finish in-flight
 *   cleanup.
 * - Keep orphan detection bounded and compare against the correct startup parent semantics.
 * - Avoid module-evaluation side effects that complicate tests or create resources before
 *   configuration validates.
 * - Keep tool collection deterministic so schemas and help output do not reorder between runs.
 * - Treat unhandled rejection and exception paths as process health failures without double-running
 *   shutdown.
 * - Test server construction independently from real network transports where the SDK permits it.
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
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/core/orphan-watch.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `mcp/src/core/orphan-watch.ts`
 * **Purpose:** Part of the local MCP server (`npm run mcp:start`) that exposes dashboard operations as MCP tools for Claude Code and other hosts.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Public surface
 * - `OrphanReason` — exported API; see TSDoc on the symbol for behavior.
 * - `OrphanWatch` — exported API; see TSDoc on the symbol for behavior.
 * - `OrphanWatchOptions` — exported API; see TSDoc on the symbol for behavior.
 * - `isOrphaned` — exported API; see TSDoc on the symbol for behavior.
 * - `watchForOrphanedHost` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **OrphanReason**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **OrphanWatch**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **OrphanWatchOptions**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **isOrphaned**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **watchForOrphanedHost**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { EventEmitter } from "node:events";

/** Why {@link watchForOrphanedHost} decided the host process is gone. */
export type OrphanReason = "stdin_end" | "stdin_close" | "reparented";

/** Handle returned by {@link watchForOrphanedHost}. */
export interface OrphanWatch {
  /** `true` once orphan shutdown has been triggered (shutdown may still be in flight). */
  hasTriggered(): boolean;
  /** Stop polling and detach listeners without triggering shutdown. */
  stop(): void;
}

/** Injectable seams; every field defaults to the real `process`/timer behavior. */
export interface OrphanWatchOptions {
  /** Runs the transport/server teardown. Rejections are logged, never thrown. */
  shutdown: () => Promise<void>;
  /** Called with the detected reason before shutdown starts. */
  onDetect?: (reason: OrphanReason) => void;
  /** Called when `shutdown()` rejects. */
  onShutdownError?: (error: unknown) => void;
  /** Stream whose `end`/`close` marks the host's side of the pipe going away. */
  stdin?: EventEmitter;
  /** Reads the current parent pid. Defaults to `() => process.ppid`. */
  getPpid?: () => number;
  /** Parent pid captured at startup. Defaults to the first `getPpid()` call. */
  initialPpid?: number;
  /** Re-parenting poll interval in ms. Default 5000. */
  intervalMs?: number;
  /**
   * Hard deadline in ms after which the process exits even if `shutdown()`
   * never settles. Default 2000. The host is already gone at this point, so
   * there is nothing left to drain gracefully.
   */
  shutdownTimeoutMs?: number;
  /** Terminates the process. Defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/**
 * Decide whether the process has been orphaned, i.e. re-parented away from the
 * parent it was launched under.
 *
 * Deliberately *not* `currentPpid === 1`: a server started by an init-like
 * parent (tini as PID 1 inside a container, a launcher that execs away) has
 * ppid 1 from birth while perfectly healthy, and a Linux orphan under a
 * subreaper is reparented to that subreaper rather than to PID 1.
 *
 * @param initialPpid - Parent process id at startup.
 * @param currentPpid - Parent process id now.
 * @returns True when the parent changed.
 */
export function isOrphaned(initialPpid: number, currentPpid: number): boolean {
  return currentPpid !== initialPpid;
}

/**
 * Watch for the host process disappearing and run `shutdown()` exactly once
 * when it does, then exit. Safe to call only in stdio mode; the returned
 * handle lets signal handlers skip a duplicate teardown.
 *
 * @param options - What to watch and what to do when the host goes away.
 * @returns A handle that stops watching.
 */
export function watchForOrphanedHost(options: OrphanWatchOptions): OrphanWatch {
  const {
    shutdown,
    onDetect,
    onShutdownError,
    stdin = process.stdin,
    getPpid = () => process.ppid,
    intervalMs = 5000,
    shutdownTimeoutMs = 2000,
    exit = (code: number) => process.exit(code),
  } = options;

  const initialPpid = options.initialPpid ?? getPpid();
  let triggered = false;

  const onEnd = () => trigger("stdin_end");
  const onClose = () => trigger("stdin_close");

  const interval = setInterval(() => {
    if (isOrphaned(initialPpid, getPpid())) trigger("reparented");
  }, intervalMs);
  // Never keep the event loop alive on our account.
  interval.unref?.();

  function detach() {
    clearInterval(interval);
    stdin.removeListener("end", onEnd);
    stdin.removeListener("close", onClose);
  }

  function trigger(reason: OrphanReason) {
    if (triggered) return;
    triggered = true;
    detach();
    onDetect?.(reason);

    // The host is gone, so an unresponsive shutdown must not keep us alive —
    // that is exactly how these processes end up orphaned and spinning.
    const deadline = setTimeout(() => exit(0), shutdownTimeoutMs);
    deadline.unref?.();

    // `shutdown` is injectable, so a caller's implementation may throw
    // synchronously before returning a promise. Starting the chain from a
    // resolved promise routes that into the same handler instead of letting
    // it escape into the process-level exception path.
    Promise.resolve()
      .then(shutdown)
      .catch((error) => onShutdownError?.(error))
      .finally(() => {
        clearTimeout(deadline);
        exit(0);
      });
  }

  stdin.on("end", onEnd);
  stdin.on("close", onClose);

  return {
    hasTriggered: () => triggered,
    stop: detach,
  };
}
