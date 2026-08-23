/**
 * @file orphan-watch.ts
 * @description Orphan detection for the MCP stdio transport. The SDK's StdioServerTransport only listens for stdin "data"/"error" events, so a stdio-mode server never notices when its host process (Claude Code, an IDE, Codex) dies without sending SIGTERM/SIGINT first — stdin closes silently and the child lingers forever with nothing left to talk to. This module watches two independent signals, stdin reaching end/close and the process being re-parented away from the parent it was launched under, and runs the caller's shutdown function the moment either fires. Re-parenting is detected by comparing against the ppid captured at startup rather than testing for ppid 1, so servers that are legitimately launched with init as their parent (containers running tini as PID 1, exec-style launchers) are not mistaken for orphans, and Linux hosts that reparent to a systemd user instance or another subreaper instead of PID 1 are still caught. A hard exit deadline guarantees termination even when the shutdown path itself hangs, which is the failure mode that leaves orphans spinning at high CPU.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
 */
export function isOrphaned(initialPpid: number, currentPpid: number): boolean {
  return currentPpid !== initialPpid;
}

/**
 * Watch for the host process disappearing and run `shutdown()` exactly once
 * when it does, then exit. Safe to call only in stdio mode; the returned
 * handle lets signal handlers skip a duplicate teardown.
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
