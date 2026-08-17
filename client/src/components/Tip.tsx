/**
 * @file Tip.tsx
 * @description Cursor-following tooltip for revealing extra detail on hover — used
 * by {@link StatCard} for raw metric values and anywhere a compact display needs
 * a full-precision expansion without cluttering the layout.
 *
 * ## Portal rendering
 * Tooltip content is portaled to `document.body` with `position: fixed` so
 * parent `overflow: hidden` cannot clip it. Placement flips left/up when the
 * cursor is near viewport edges.
 *
 * ## No-op mode
 * When `raw` is omitted the component returns `children` unchanged — callers
 * do not need conditional wrappers.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tip.tsx`
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
 * - `Tip` — exported API; see TSDoc on the symbol for behavior.
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
 * **Tip**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

/** Props for {@link Tip}. */
interface TipProps {
  /** Tooltip body; when absent, only `children` are rendered. */
  raw?: string;
  /** Element that triggers the tooltip on hover. */
  children: React.ReactNode;
  /** Max tooltip width in pixels. Default `320`. */
  maxWidth?: number;
  /** Use a block-level wrapper instead of inline `span` for full-width targets. */
  block?: boolean;
}

/**
 * Hover tooltip anchored to the mouse cursor.
 * @param props See {@link TipProps}.
 */
export function Tip({ raw, children, maxWidth = 320, block = false }: TipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const tipRef = useRef<HTMLDivElement>(null);

  const updatePos = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  if (!raw) return <>{children}</>;

  const Wrapper = block ? "div" : "span";
  const wrapperClass = block ? "cursor-default" : "relative inline-block cursor-default";

  // Compute tooltip placement avoiding screen edges
  let tipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 99999,
    maxWidth,
    visibility: "hidden",
  };
  if (show) {
    const tipW = tipRef.current?.offsetWidth ?? 200;
    const tipH = tipRef.current?.offsetHeight ?? 32;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const pad = 12;

    // Default: below-right of cursor
    let left = pos.x + pad;
    let top = pos.y + pad;

    // If goes off right edge, flip to left of cursor
    if (left + tipW > vw - pad) {
      left = pos.x - tipW - pad;
    }
    // If goes off left edge, clamp
    if (left < pad) left = pad;

    // If goes off bottom, show above cursor
    if (top + tipH > vh - pad) {
      top = pos.y - tipH - pad;
    }
    // If goes off top, clamp
    if (top < pad) top = pad;

    tipStyle = { position: "fixed", left, top, zIndex: 99999, maxWidth, visibility: "visible" };
  }

  return (
    <Wrapper
      className={wrapperClass}
      onMouseEnter={(e: React.MouseEvent) => {
        setShow(true);
        updatePos(e);
      }}
      onMouseMove={updatePos}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show &&
        createPortal(
          <div
            ref={tipRef}
            style={tipStyle}
            className="px-2.5 py-1.5 text-[11px] leading-relaxed font-mono text-gray-100 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-xl pointer-events-none whitespace-pre-wrap break-words"
          >
            {raw}
          </div>,
          document.body
        )}
    </Wrapper>
  );
}
