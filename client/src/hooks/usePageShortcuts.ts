/**
 * @file usePageShortcuts.ts
 * @description Keeps a page's tab or filter selection in the URL.
 *
 * This is what lets the command palette address a page's interior — a Settings
 * section, an Analytics tab, the active-session filter — and what makes those
 * links shareable. Without it the palette could only ever reach a page, never a
 * view inside it.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/hooks/usePageShortcuts.ts
 * **Area:** client hook
 * **Responsibility:**
 * Keeps a page's tab or filter selection in the URL. This is what lets the command palette address
 * a page's interior — a Settings section, an Analytics tab, the active-session filter — and what
 * makes those links shareable. Without it the palette could only ever reach a page, never a view
 * inside it.
 *
 * ## Architectural boundary
 * - Owns a reusable React side-effect or stateful subscription while exposing a small declarative
 *   interface.
 * - The hook is responsible for setup, freshness, cleanup, and race handling; consumers should not
 *   duplicate that lifecycle.
 * - Shared transport and API semantics remain in library modules rather than being hidden inside
 *   component-specific closures.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `useUrlTab` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `useUrlTab` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useSearchParams` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Area invariants
 * - List every reactive dependency honestly or use stable refs intentionally with an explanatory
 *   comment.
 * - Clean up timers, sockets, observers, media objects, DOM listeners, and event-bus subscriptions
 *   on every exit path.
 * - Prevent stale async completions from updating state after unmount, reconnection, or parameter
 *   changes.
 * - Keep StrictMode mount-cleanup-remount behavior free of duplicate subscriptions and duplicate
 *   messages.
 * - Use functional state updates when the next value depends on the previous value across
 *   asynchronous callbacks.
 * - Keep callbacks stable only when consumers benefit; unnecessary memoization makes dependency
 *   contracts harder to audit.
 * - Surface recoverable status to consumers rather than swallowing failures into a permanently
 *   stale state.
 * - Do not expose mutable internal refs as if they were stable public state.
 * - Keep browser-only globals inside effect or capability checks so tests and non-browser tooling
 *   can load the module.
 * - Test mount, update, cleanup, failure, and retry behavior with the narrowest realistic
 *   dependency boundary.
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
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/hooks/usePageShortcuts.ts` .
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
 * **Path:** `client/src/hooks/usePageShortcuts.ts`
 * **Purpose:** React hook: isolates side effects and subscription wiring so presentational components stay declarative.
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
 * - `useUrlTab` — exported API; see TSDoc on the symbol for behavior.
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
 * **useUrlTab**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * Keep a tab selection in the URL so the palette (and any bookmark, or a link a
 * user pastes to a colleague) can address a page's sub-view directly.
 *
 * The URL is the source of truth when it carries a valid value; otherwise the
 * optional `storageKey` restores the last choice, and finally `fallback` applies.
 * Selections replace the history entry rather than pushing one — flipping
 * between two tabs should not make Back mean "the tab I was just on".
 *
 * @param valid      Every accepted value; anything else in the URL is ignored.
 * @param fallback   Used when neither the URL nor storage has a valid value.
 * @param options.param      Query parameter name (default `tab`).
 * @param options.storageKey `localStorage` key to mirror the choice into.
 */
export function useUrlTab<T extends string>(
  valid: readonly T[],
  fallback: T,
  options: { param?: string; storageKey?: string } = {}
): [T, (tab: T) => void] {
  const { param = "tab", storageKey } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const fromUrl = searchParams.get(param);
  const stored = (() => {
    if (!storageKey) return null;
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  })();

  /** Whether a URL value is one of the page's valid tabs. */
  const isValid = (value: string | null): value is T =>
    value !== null && (valid as readonly string[]).includes(value);

  const active: T = isValid(fromUrl) ? fromUrl : isValid(stored) ? stored : fallback;

  /**
   * Select a tab: remember it in localStorage (when a storage key is given) and write it to the URL
   * without adding a history entry. The empty "no filter" value removes the parameter instead of
   * leaving an empty one in shared links.
   */
  const setActive = useCallback(
    (tab: T) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, tab);
        } catch {
          /* preference persistence is best-effort */
        }
      }
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          // An empty value is a page's "no filter" pseudo-option; writing
          // `?status=` for it would leave a meaningless parameter in every
          // link the user copies.
          if (tab === "") next.delete(param);
          else next.set(param, tab);
          return next;
        },
        { replace: true }
      );
    },
    [param, storageKey, setSearchParams]
  );

  return [active, setActive];
}
