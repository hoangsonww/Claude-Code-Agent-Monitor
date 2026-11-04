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
 * When both `raw` and `content` are omitted the component returns `children`
 * unchanged — callers do not need conditional wrappers.
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
 * **Module:** client/src/components/Tip.tsx
 * **Area:** client component
 * **Responsibility:**
 * Cursor-following tooltip for revealing extra detail on hover — used by {@link StatCard} for raw
 * metric values and anywhere a compact display needs a full-precision expansion without cluttering
 * the layout. ## Portal rendering Tooltip content is portaled to `document.body` with
 * `position: fixed` so parent `overflow: hidden` cannot clip it. Placement flips left/up when the
 * cursor is near viewport edges. ## No-op mode When both `raw` and `content` are omitted the
 * component returns `children` unchanged — callers do not need conditional wrappers.
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
 * - `react-dom` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `Tip` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `Tip` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TipProps` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useId` — lifecycle/state dependency detected in this module; preserve dependency freshness and
 *   cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tip.tsx` .
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

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";

/** Props for {@link Tip}. */
interface TipProps {
  /** Tooltip body; when absent, only `children` are rendered. */
  raw?: string;
  /** Optional rich tooltip body, used when the panel contains an actionable link. */
  content?: React.ReactNode;
  /** Element that triggers the tooltip on hover. */
  children: React.ReactNode;
  /** Max tooltip width in pixels. Default `320`. */
  maxWidth?: number;
  /** Use a block-level wrapper instead of inline `span` for full-width targets. */
  block?: boolean;
  /** Accessible name for compact non-text triggers such as an info icon. */
  ariaLabel?: string;
  /** Additional classes applied to the focusable trigger wrapper. */
  triggerClassName?: string;
  /** Visual treatment for compact values or explanatory information. */
  variant?: "value" | "info";
  /** Keep the panel open while its links or controls are hovered and focused. */
  interactive?: boolean;
}

/**
 * Hover tooltip anchored to the mouse cursor.
 * @param props See {@link TipProps}.
 */
export function Tip({
  raw,
  content,
  children,
  maxWidth = 320,
  block = false,
  ariaLabel,
  triggerClassName = "",
  variant = "value",
  interactive = false,
}: TipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const tipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLSpanElement & HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  /** Follow the pointer with the tooltip. */
  const updatePos = useCallback((e: React.MouseEvent) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  if (!raw && !content) return <>{children}</>;

  const cancelHide = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };
  const hide = () => {
    cancelHide();
    setShow(false);
  };
  const scheduleHide = () => {
    cancelHide();
    if (!interactive) {
      setShow(false);
      return;
    }
    hideTimerRef.current = setTimeout(() => setShow(false), 100);
  };

  const Wrapper = block ? "div" : "span";
  const baseWrapperClass = block ? "cursor-default" : "relative inline-block cursor-default";
  const wrapperClass = triggerClassName
    ? `${baseWrapperClass} ${triggerClassName}`
    : baseWrapperClass;
  const infoLines = variant === "info" && raw ? raw.split("\n").filter(Boolean) : [];

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
      ref={triggerRef}
      className={wrapperClass}
      tabIndex={0}
      aria-label={ariaLabel}
      aria-describedby={show ? tipId : undefined}
      onMouseEnter={(e: React.MouseEvent) => {
        cancelHide();
        setShow(true);
        updatePos(e);
      }}
      onMouseMove={updatePos}
      onMouseLeave={scheduleHide}
      onFocus={() => {
        const bounds = triggerRef.current?.getBoundingClientRect();
        if (bounds) setPos({ x: bounds.left + bounds.width / 2, y: bounds.bottom });
        setShow(true);
      }}
      onBlur={(event: React.FocusEvent) => {
        if (tipRef.current?.contains(event.relatedTarget as Node | null)) return;
        hide();
      }}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Escape") setShow(false);
      }}
    >
      {children}
      {show &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            ref={tipRef}
            style={tipStyle}
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            onFocus={cancelHide}
            onBlur={(event) => {
              if (triggerRef.current?.contains(event.relatedTarget as Node | null)) return;
              hide();
            }}
            className={
              variant === "info"
                ? `min-w-[260px] px-3.5 py-3 text-xs leading-5 font-sans text-gray-300 bg-[#12121f] border border-[#30304d] rounded-xl shadow-2xl break-words ${interactive ? "pointer-events-auto" : "pointer-events-none"}`
                : "px-2.5 py-1.5 text-[11px] leading-relaxed font-mono text-gray-100 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-xl pointer-events-none whitespace-pre-wrap break-words"
            }
          >
            {content ||
              (variant === "info" ? (
                <div className="space-y-1.5">
                  {infoLines.map((line, index) => (
                    <p
                      key={`${index}-${line}`}
                      className={
                        index === 0
                          ? "font-semibold text-gray-100"
                          : index === infoLines.length - 1 && infoLines.length > 2
                            ? "rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-amber-200"
                            : "text-gray-400"
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                raw
              ))}
          </div>,
          document.body
        )}
    </Wrapper>
  );
}
