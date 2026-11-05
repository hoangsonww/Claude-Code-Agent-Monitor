/**
 * @file useTabbyPosition.ts
 * @description AssistiveTouch-style draggable docking for the Tabby avatar. The
 *   avatar follows the pointer 1:1 while dragging (via Pointer Capture, so it
 *   keeps tracking even if the cursor outruns it), and on release snaps to the
 *   nearest left/right edge, remembering its vertical offset (persisted as a
 *   viewport fraction so it survives resizes). A small movement threshold tells
 *   a drag apart from a tap so dragging never opens the panel.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/useTabbyPosition.ts
 * **Area:** client Tabby component
 * **Responsibility:**
 * AssistiveTouch-style draggable docking for the Tabby avatar. The avatar follows the pointer 1:1
 * while dragging (via Pointer Capture, so it keeps tracking even if the cursor outruns it), and on
 * release snaps to the nearest left/right edge, remembering its vertical offset (persisted as a
 * viewport fraction so it survives resizes). A small movement threshold tells a drag apart from a
 * tap so dragging never opens the panel.
 *
 * ## Architectural boundary
 * - Provides the optional Tabby companion layer without becoming a dependency of core monitoring
 *   workflows.
 * - Intent recognition, state transitions, positioning, and rendering remain separable so
 *   decoration cannot block data views.
 * - Reduced-motion, hidden, and disabled states are first-class outcomes rather than exceptional
 *   branches.
 *
 * ## Local dependency edges
 * - `./prefs` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `TABBY_MARGIN` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TABBY_SIZE` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TabbyPlacement` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `useTabbyPosition` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `defaultPos` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `DRAG_THRESHOLD` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `restingScreen` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TABBY_MARGIN` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TABBY_SIZE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyPlacement` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `useTabbyPosition` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `vh` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `vw` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 *
 * ## Area invariants
 * - Keep companion reactions deterministic for a given event/state input when tests assert a
 *   specific response.
 * - Bound timers, animation frames, listeners, and persisted position state; clean them up on
 *   unmount.
 * - Respect reduced-motion preferences and never require animation to communicate dashboard status.
 * - Keep the companion out of keyboard focus order unless an element performs an actual interactive
 *   action.
 * - Constrain dragging and restored coordinates to the current viewport after resizes or display
 *   changes.
 * - Avoid coupling core API requests or monitoring state transitions to companion visibility.
 * - Keep quips and intent vocabulary aligned with the localization decision already established by
 *   the module.
 * - Do not let decorative overlays cover destructive confirmations, navigation, or primary session
 *   controls.
 * - Prefer explicit state-machine transitions over intersecting booleans that allow impossible
 *   poses.
 * - Test cleanup with fake timers where time drives behavior, then restore timer globals after each
 *   case.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/useTabbyPosition.ts`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/useTabbyPosition.ts`
 * **Purpose:** Tabby is the optional on-screen cat assistant — quips, intents, and lightweight event reactions layered above the dashboard chrome. React hook: isolates side effects and subscription wiring so presentational components stay declarative.
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
 * ## Internal dependencies
 * - `./prefs`
 *
 * ## Public surface
 * - `TABBY_SIZE` — exported API; see TSDoc on the symbol for behavior.
 * - `TABBY_MARGIN` — exported API; see TSDoc on the symbol for behavior.
 * - `TabbyPlacement` — exported API; see TSDoc on the symbol for behavior.
 * - `useTabbyPosition` — exported API; see TSDoc on the symbol for behavior.
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
 * **TABBY_SIZE**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TABBY_MARGIN**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TabbyPlacement**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **useTabbyPosition**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { tabbyPrefs, type TabbyPos } from "./prefs";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Avatar width and height in pixels. Matches `CatAvatar`'s default size. */
export const TABBY_SIZE = 60;
/** Gap kept between the avatar and the viewport edges, in pixels. */
export const TABBY_MARGIN = 16;
/**
 * Pointer travel in pixels before a press becomes a drag, so a plain click still opens the panel.
 */
const DRAG_THRESHOLD = 5;

/** Viewport width, with a fallback for non-browser environments such as tests. */
const vw = () => (typeof window !== "undefined" ? window.innerWidth : 1024);
/** Viewport height, with a fallback for non-browser environments such as tests. */
const vh = () => (typeof window !== "undefined" ? window.innerHeight : 768);

/**
 * Resting position for a first visit: docked to the right edge, vertically centered.
 *
 * @returns The default position.
 */
function defaultPos(): TabbyPos {
  return { side: "right", y: 0.5 }; // right edge, vertically centered
}

/**
 * Resting top-left screen coords for a docked position.
 *
 * @param pos - Docked side and vertical fraction.
 * @returns Screen coordinates of the avatar's top-left corner.
 */
function restingScreen(pos: TabbyPos) {
  const avail = Math.max(0, vh() - TABBY_SIZE - 2 * TABBY_MARGIN);
  const left = pos.side === "left" ? TABBY_MARGIN : vw() - TABBY_SIZE - TABBY_MARGIN;
  const top = TABBY_MARGIN + pos.y * avail;
  return { left, top };
}

/**
 * Where to draw Tabby and the pointer handlers that make it draggable, returned by {@link
 * useTabbyPosition}.
 */
export interface TabbyPlacement {
  /** Avatar top-left, in screen px. */
  left: number;
  /** Avatar top edge, in screen pixels. */
  top: number;
  /** Avatar width and height, in pixels. */
  size: number;
  /** Edge the avatar is docked to; the panel opens toward the other side. */
  side: "left" | "right";
  /** True when the avatar sits in the lower half - flyouts open upward. */
  openUp: boolean;
  /**
   * True while the avatar is being dragged. Tabby hides its panel and speech bubble meanwhile so
   * they do not chase the cursor.
   */
  dragging: boolean;
  /** Starts tracking a press and captures the pointer so moves keep arriving outside the avatar. */
  onPointerDown: (e: ReactPointerEvent) => void;
  /** Moves the avatar once the press has travelled past the drag threshold. */
  onPointerMove: (e: ReactPointerEvent) => void;
  /**
   * Ends the press. After a drag, docks to the nearer side and saves the position; after a plain
   * press, does nothing so the click handler can run.
   */
  onPointerUp: (e: ReactPointerEvent) => void;
  /** Returns true (once) if a drag just ended, so the click handler can skip. */
  consumeDrag: () => boolean;
}

/**
 * Draggable, edge-docked placement for Tabby. The resting position is stored as a side (left or
 * right) plus a vertical fraction of the viewport, so it survives window resizes and is persisted
 * through `tabbyPrefs`. While dragging, the avatar follows the pointer exactly; on release it snaps
 * to the nearer edge.
 *
 * @returns Coordinates, docking side, drag state, and pointer handlers.
 */
export function useTabbyPosition(): TabbyPlacement {
  const [pos, setPos] = useState<TabbyPos>(() => tabbyPrefs.getPos() ?? defaultPos());
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
  const [, force] = useState(0); // re-derive resting coords on resize

  const draggedRef = useRef(false);
  const startRef = useRef<{ px: number; py: number; left: number; top: number } | null>(null);
  const movedRef = useRef(false);
  // Latest dragged coords, mirrored in a ref so pointerup can read them
  // synchronously - the setDrag state may not have committed yet under React's
  // event batching, so we never rely on its functional-updater `cur`.
  const liveRef = useRef<{ left: number; top: number } | null>(null);

  useEffect(() => {
    /** Re-derive the resting coordinates when the window resizes. */
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resting = restingScreen(pos);
  const screen = drag ?? resting;

  /**
   * Start tracking a primary-button press and capture the pointer so moves keep arriving even when
   * it leaves the avatar.
   */
  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;
      // Capture so the avatar keeps receiving move/up events even when the
      // pointer leaves it - essential for a fast, 1:1 drag.
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        /* capture unsupported - window-free fallback still works via props */
      }
      startRef.current = { px: e.clientX, py: e.clientY, left: screen.left, top: screen.top };
      movedRef.current = false;
    },
    [screen.left, screen.top]
  );

  /**
   * Follow the pointer once it has moved past the drag threshold, so small jitters still count as a
   * click.
   */
  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;
    const left = Math.min(
      vw() - TABBY_SIZE - TABBY_MARGIN,
      Math.max(TABBY_MARGIN, start.left + dx)
    );
    const top = Math.min(vh() - TABBY_SIZE - TABBY_MARGIN, Math.max(TABBY_MARGIN, start.top + dy));
    liveRef.current = { left, top };
    setDrag({ left, top });
  }, []);

  /** Release the pointer. After a drag, dock to the nearer side and save the position. */
  const onPointerUp = useCallback((e: ReactPointerEvent) => {
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const live = liveRef.current;
    if (live) {
      draggedRef.current = true;
      const side: "left" | "right" = live.left + TABBY_SIZE / 2 < vw() / 2 ? "left" : "right";
      const avail = Math.max(1, vh() - TABBY_SIZE - 2 * TABBY_MARGIN);
      const y = Math.min(1, Math.max(0, (live.top - TABBY_MARGIN) / avail));
      const next: TabbyPos = { side, y };
      tabbyPrefs.setPos(next);
      setPos(next);
      setDrag(null); // leave drag mode; resting coords (with transition) take over
    }
    liveRef.current = null;
    startRef.current = null;
    movedRef.current = false;
  }, []);

  /**
   * Report whether the last press was a drag, and reset the flag, so the click handler can ignore
   * the click that ends a drag.
   */
  const consumeDrag = useCallback(() => {
    const was = draggedRef.current;
    draggedRef.current = false;
    return was;
  }, []);

  return {
    left: screen.left,
    top: screen.top,
    size: TABBY_SIZE,
    side: pos.side,
    openUp: screen.top + TABBY_SIZE / 2 > vh() / 2,
    dragging: drag !== null,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    consumeDrag,
  };
}
