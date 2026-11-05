/**
 * @file PaletteActionProvider.tsx
 * @description Registry of the actions a mounted page offers to the command
 * palette.
 *
 * This is not a keyboard layer. The dashboard binds exactly one chord — ⌘/Ctrl+K
 * to open the palette (plus Tabby's pre-existing ⌘/Ctrl+B) — and everything else
 * is reached by opening the palette and typing. What this provider does is let a
 * page say "while I am on screen, these commands exist", so the palette can list
 * page-specific work like *Pause the live stream* or *Copy this session's id*.
 *
 * ## Why it exists at all
 * The palette originally listed a fixed set of quick actions on every page and
 * wired them on none: "Show active sessions" navigated to /sessions and applied
 * no filter. A launcher that offers commands it cannot run teaches you to stop
 * trusting it. Registration inverts that — the palette reads {@link boundIds},
 * so an action whose page is not mounted is not offered at all, and it is
 * impossible to ship a row that does nothing.
 *
 * ## Precedence
 * `register` pushes onto a per-id stack, so the most recently mounted handler
 * wins and unmounting restores the one beneath it. That is what lets every page
 * register `page.refresh` under its own reload without any of them knowing about
 * the others.
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
 * **Module:** client/src/components/PaletteActionProvider.tsx
 * **Area:** client component
 * **Responsibility:**
 * Registry of the actions a mounted page offers to the command palette. This is not a keyboard
 * layer. The dashboard binds exactly one chord — ⌘/Ctrl+K to open the palette (plus Tabby's
 * pre-existing ⌘/Ctrl+B) — and everything else is reached by opening the palette and typing. What
 * this provider does is let a page say "while I am on screen, these commands exist", so the palette
 * can list page-specific work like *Pause the live stream* or *Copy this session's id*. ## Why it
 * exists at all The palette originally listed a fixed set of quick actions on every page and wired
 * them on none: "Show active sessions" navigated to /sessions and applied no filter. A launcher
 * that offers commands it cannot run teaches you to stop trusting it. Registration inverts that —
 * the palette reads {@link boundIds}, so an action whose page is not mounted is not offered at all,
 * and it is impossible to ship a row that does nothing. ## Precedence `register` pushes onto a
 * per-id stack, so the most recently mounted handler wins and unmounting restores the one beneath
 * it. That is what lets every page register `page.refresh` under its own reload without any of them
 * knowing about the others.
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `PaletteActionHandler` (type) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `PaletteActionProvider` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `usePaletteAction` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `usePaletteActions` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `noopUnregister` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PaletteActionContext` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `PaletteActionContextValue` (interface) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `PaletteActionHandler` (type) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PaletteActionProvider` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `usePaletteAction` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `usePaletteActions` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useContext` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `usePaletteActions` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 *
 * ## Area invariants
 * - Keep prop meaning and callback timing stable; parent components often rely on both even when
 *   types still compile.
 * - Render valid semantic controls with accessible names, focus behavior, disabled states, and
 *   keyboard operation.
 * - Keep visible strings in the appropriate i18n namespace rather than embedding English-only
 *   literals.
 * - Use shared design tokens and existing primitives so light/dark styling and compact layouts
 *   remain coherent.
 * - Avoid mutating arrays or objects received through props; derived display data should be
 *   computed immutably.
 * - Make empty and unavailable values explicit instead of rendering misleading zeroes or
 *   placeholder punctuation.
 * - Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction
 *   requires it.
 * - Do not duplicate server validation or destructive gates as if client-side checks were
 *   authoritative.
 * - Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated
 *   copy.
 * - Prefer stable keys derived from entity identity over array indexes for live, filtered, or
 *   reordered collections.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/PaletteActionProvider.tsx`
 *   .
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
 * **Path:** `client/src/components/PaletteActionProvider.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * - `PaletteActionHandler` — exported API; see TSDoc on the symbol for behavior.
 * - `usePaletteActions` — exported API; see TSDoc on the symbol for behavior.
 * - `usePaletteAction` — exported API; see TSDoc on the symbol for behavior.
 * - `PaletteActionProvider` — exported API; see TSDoc on the symbol for behavior.
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
 * **PaletteActionHandler**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **usePaletteActions**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **usePaletteAction**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **PaletteActionProvider**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** A registered action. Returning `false` declines, so the stack falls through. */
export type PaletteActionHandler = () => void | boolean;

/** What the palette action context provides to pages and to the palette. */
interface PaletteActionContextValue {
  /** Ids with at least one live handler, so the palette lists only real work. */
  boundIds: ReadonlySet<string>;
  /** Register a handler for `id` for the lifetime of the caller's mount. */
  register: (id: string, handler: PaletteActionHandler) => () => void;
  /** Run the topmost handler for `id`; walks down the stack if one declines. */
  run: (id: string) => boolean;
}

/** Unregister function returned by the default context, used outside a provider. */
const noopUnregister = () => {};

/**
 * Context for page-registered palette actions. The default value lets components render outside the
 * provider without crashing: nothing is bound and nothing runs.
 */
const PaletteActionContext = createContext<PaletteActionContextValue>({
  boundIds: new Set(),
  register: () => noopUnregister,
  run: () => false,
});

/** Access the action registry. Safe outside the provider (inert defaults). */
export function usePaletteActions(): PaletteActionContextValue {
  return useContext(PaletteActionContext);
}

/**
 * Offer `id` as a palette command while the calling component is mounted.
 *
 * The handler is stored in a ref and re-read on every run, so callers may pass an
 * inline closure without re-registering each render — re-registering on identity
 * change would tear the stack down and rebuild it constantly, silently changing
 * precedence.
 *
 * @param id      Must match an entry in `PAGE_ACTION_COMMANDS`, which supplies
 *                the label and icon the palette renders.
 * @param handler What running the command does. Return `false` to decline (for
 *                example when the datum it would copy has not loaded yet).
 */
export function usePaletteAction(
  id: string,
  handler: PaletteActionHandler | null | undefined,
  enabled = true
): void {
  const { register } = usePaletteActions();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !handler) return;
    return register(id, () => handlerRef.current?.());
    // `handler` is intentionally excluded: identity changes must not re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, register, !!handler]);
}

/** Mounts the registry. Place it above the palette and every routed page. */
export function PaletteActionProvider({ children }: { children: ReactNode }) {
  const [boundIds, setBoundIds] = useState<ReadonlySet<string>>(() => new Set());
  const handlersRef = useRef<Map<string, PaletteActionHandler[]>>(new Map());

  /** Publish the set of ids that currently have a handler. */
  const syncBoundIds = useCallback(() => {
    setBoundIds(new Set(handlersRef.current.keys()));
  }, []);

  /**
   * Register a handler for an id, stacking it above earlier ones. Returns a function that removes
   * exactly this handler.
   */
  const register = useCallback(
    (id: string, handler: PaletteActionHandler) => {
      const stack = handlersRef.current.get(id) ?? [];
      stack.push(handler);
      handlersRef.current.set(id, stack);
      syncBoundIds();
      return () => {
        const current = handlersRef.current.get(id);
        if (!current) return;
        const index = current.lastIndexOf(handler);
        if (index >= 0) current.splice(index, 1);
        if (current.length === 0) handlersRef.current.delete(id);
        syncBoundIds();
      };
    },
    [syncBoundIds]
  );

  /**
   * Run the newest handler for an id. If it returns `false` (declined), try the one below it.
   *
   * @returns True when a handler ran.
   */
  const run = useCallback((id: string): boolean => {
    const stack = handlersRef.current.get(id);
    if (!stack || stack.length === 0) return false;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i]?.() !== false) return true;
    }
    return false;
  }, []);

  /** Context value, memoized so consumers only re-render when the bound ids change. */
  const value = useMemo<PaletteActionContextValue>(
    () => ({ boundIds, register, run }),
    [boundIds, register, run]
  );

  return <PaletteActionContext.Provider value={value}>{children}</PaletteActionContext.Provider>;
}
