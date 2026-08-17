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

// Avatar footprint + edge gap, in px. SIZE matches CatAvatar's default size.
export const TABBY_SIZE = 60;
export const TABBY_MARGIN = 16;
const DRAG_THRESHOLD = 5;

const vw = () => (typeof window !== "undefined" ? window.innerWidth : 1024);
const vh = () => (typeof window !== "undefined" ? window.innerHeight : 768);

function defaultPos(): TabbyPos {
  return { side: "right", y: 0.5 }; // right edge, vertically centered
}

/** Resting top-left screen coords for a docked position. */
function restingScreen(pos: TabbyPos) {
  const avail = Math.max(0, vh() - TABBY_SIZE - 2 * TABBY_MARGIN);
  const left = pos.side === "left" ? TABBY_MARGIN : vw() - TABBY_SIZE - TABBY_MARGIN;
  const top = TABBY_MARGIN + pos.y * avail;
  return { left, top };
}

export interface TabbyPlacement {
  /** Avatar top-left, in screen px. */
  left: number;
  top: number;
  size: number;
  side: "left" | "right";
  /** True when the avatar sits in the lower half - flyouts open upward. */
  openUp: boolean;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  /** Returns true (once) if a drag just ended, so the click handler can skip. */
  consumeDrag: () => boolean;
}

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
    const onResize = () => force((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resting = restingScreen(pos);
  const screen = drag ?? resting;

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
