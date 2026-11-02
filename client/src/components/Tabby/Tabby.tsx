/**
 * @file Tabby.tsx
 * @description Floating cat companion shell. Mounts once (next to UpdateNotifier
 *   in Layout) so it persists across routes and shares the single WebSocket.
 *   Owns the open/closed panel state, the ⌘B / Esc shortcuts, reduced-motion
 *   detection, and route navigation. Reactive personality + status/Ask come
 *   from useTabbyBrain; the avatar is draggable (AssistiveTouch-style) via
 *   useTabbyPosition, a compact hover greeting, and the bubble/panel render in
 *   a self-clamping flyout so they never spill off any screen edge regardless
 *   of where the cat is docked.
 *
 *   The "do the job" path reuses the existing Run page: unmatched Ask queries
 *   deep-link to /run?prompt=…&autostart=1 - no new LLM backend.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/Tabby.tsx
 * **Area:** client Tabby component
 * **Responsibility:**
 * Floating cat companion shell. Mounts once (next to UpdateNotifier in Layout) so it persists
 * across routes and shares the single WebSocket. Owns the open/closed panel state, the ⌘B / Esc
 * shortcuts, reduced-motion detection, and route navigation. Reactive personality + status/Ask come
 * from useTabbyBrain; the avatar is draggable (AssistiveTouch-style) via useTabbyPosition, a
 * compact hover greeting, and the bubble/panel render in a self-clamping flyout so they never spill
 * off any screen edge regardless of where the cat is docked. The "do the job" path reuses the
 * existing Run page: unmatched Ask queries deep-link to /run?prompt=…&autostart=1 - no new LLM
 * backend.
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
 * - `./CatAvatar` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./intents` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./prefs` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./SpeechBubble` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./tabby.css` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./TabbyPanel` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./useTabbyBrain` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./useTabbyPosition` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `Tabby` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `Anchor` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FLYOUT_GAP` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Tabby` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyFlyout` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `usePrefersReducedMotion` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `VIEWPORT_MARGIN` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useLayoutEffect` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useNavigate` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `usePrefersReducedMotion` — lifecycle/state dependency detected in this module; preserve
 *   dependency freshness and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTabbyBrain` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useTabbyPosition` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/Tabby.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/Tabby.tsx`
 * **Purpose:** Tabby is the optional on-screen cat assistant — quips, intents, and lightweight event reactions layered above the dashboard chrome.
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
 * - `./CatAvatar`
 * - `./SpeechBubble`
 * - `./TabbyPanel`
 * - `./useTabbyBrain`
 * - `./useTabbyPosition`
 * - `./intents`
 * - `./prefs`
 *
 * ## Public surface
 * - `Tabby` — exported API; see TSDoc on the symbol for behavior.
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
 * **Tabby**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { CatAvatar } from "./CatAvatar";
import { SpeechBubble } from "./SpeechBubble";
import { TabbyPanel } from "./TabbyPanel";
import { useTabbyBrain } from "./useTabbyBrain";
import { useTabbyPosition, TABBY_SIZE } from "./useTabbyPosition";
import { matchIntent } from "./intents";
import { tabbyPrefs } from "./prefs";
import "./tabby.css";

/** Gap between the avatar and its panel or speech bubble, in pixels. */
const FLYOUT_GAP = 10; // px between avatar and flyout
/** Minimum distance kept between a flyout and any viewport edge, in pixels. */
const VIEWPORT_MARGIN = 12; // min gap from any screen edge

/** Where Tabby's avatar sits, used to position its flyouts next to it. */
interface Anchor {
  /** Avatar left edge, in screen pixels. */
  left: number;
  /** Avatar top edge, in screen pixels. */
  top: number;
  /** Avatar size, in pixels. */
  size: number;
  /** Edge the avatar is docked to; flyouts open toward the opposite side. */
  side: "left" | "right";
  /** Whether flyouts open upward, chosen when the avatar sits in the lower half of the screen. */
  openUp: boolean;
}

/**
 * Track the user's `prefers-reduced-motion` setting, updating live when it changes.
 *
 * @returns True when the user prefers reduced motion.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * Fixed-position wrapper that places its content next to the avatar and clamps
 * it inside the viewport. It measures itself (and re-measures on content/size
 * changes via ResizeObserver) so a tall panel near a screen edge slides fully
 * into view instead of being cropped.
 */
function TabbyFlyout({ anchor, children }: { anchor: Anchor; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  /**
   * Position the flyout: hug the avatar's docked edge horizontally, open above or below it, and
   * clamp the result inside the viewport. Re-run on resize and when the flyout's size changes.
   */
  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: hug the avatar's docked edge, then clamp on-screen.
    let left = anchor.side === "left" ? anchor.left : anchor.left + anchor.size - w;
    left = Math.min(vw - w - VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, left));

    // Vertical: prefer above the cat (feels natural). Only drop below when
    // there isn't room above - i.e. the cat is near the top edge.
    const above = anchor.top - h - FLYOUT_GAP;
    const below = anchor.top + anchor.size + FLYOUT_GAP;
    let top = above >= VIEWPORT_MARGIN ? above : below;
    top = Math.min(vh - h - VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, top));

    setStyle({ left, top, visibility: "visible" });
  }, [anchor.left, anchor.top, anchor.size, anchor.side, anchor.openUp]);

  useLayoutEffect(() => {
    place();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [place]);

  return (
    <div ref={ref} className="tabby-flyout" style={style}>
      {children}
    </div>
  );
}

/**
 * Tabby, the floating cat companion pinned to a screen edge. Renders the draggable avatar with a
 * mood-driven animation, its speech bubble, and the expandable panel. Cmd/Ctrl+B toggles the panel
 * and Escape closes it. Hidden entirely when disabled in Settings, and calmer when the user prefers
 * reduced motion.
 */
export function Tabby() {
  const [enabled, setEnabled] = useState(() => tabbyPrefs.getEnabled());
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const brain = useTabbyBrain();
  const place = useTabbyPosition();

  // Keep enabled in sync with Settings / other tabs.
  useEffect(() => tabbyPrefs.subscribe(() => setEnabled(tabbyPrefs.getEnabled())), []);

  // ⌘B / Ctrl+B toggles the panel; Esc closes it.
  useEffect(() => {
    /** Cmd/Ctrl+B toggles the panel; Escape closes it. */
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Navigate from a panel link and close the panel. */
  const onNavigate = useCallback(
    (route: string) => {
      navigate(route);
      setOpen(false);
    },
    [navigate]
  );

  /**
   * Answer a typed question. Status questions are answered inline from the live counts; anything
   * else is handed off to the Run page with the question prefilled and `autostart=1`, so it is
   * actually sent to Claude rather than left in the composer.
   *
   * @param query - What the user typed.
   * @returns The inline answer, or null when the question was handed off.
   */
  const onAsk = useCallback(
    (query: string): string | null => {
      const result = matchIntent(query, brain.status);
      if (result.kind === "answer") return result.text;
      // Handoff: spawn a real claude via the existing Run page. `autostart=1`
      // tells Run to fire the prompt automatically once it's prefilled, so the
      // question is actually sent instead of just dropped into the composer.
      navigate(`/run?prompt=${encodeURIComponent(result.prompt)}&autostart=1`);
      setOpen(false);
      return null;
    },
    [brain, navigate]
  );

  if (!enabled) return null;

  const anchor: Anchor = {
    left: place.left,
    top: place.top,
    size: place.size,
    side: place.side,
    openUp: place.openUp,
  };

  return (
    <>
      {/* Flyouts are hidden while dragging so they don't chase the cat. */}
      {!place.dragging && open && (
        <TabbyFlyout anchor={anchor}>
          <TabbyPanel
            status={brain.status}
            muted={brain.muted}
            onToggleMute={brain.toggleMute}
            onClearAlerts={brain.clearAlerts}
            onNavigate={onNavigate}
            onAsk={onAsk}
            onClose={() => setOpen(false)}
          />
        </TabbyFlyout>
      )}

      {!place.dragging && !open && brain.bubble && (
        <TabbyFlyout anchor={anchor}>
          <SpeechBubble text={brain.bubble} onDismiss={brain.dismissBubble} />
        </TabbyFlyout>
      )}

      <button
        className="tabby-avatar-btn"
        data-dragging={place.dragging ? "1" : "0"}
        style={{ left: place.left, top: place.top, width: TABBY_SIZE, height: TABBY_SIZE }}
        onPointerDown={(event) => {
          setHovered(false);
          place.onPointerDown(event);
        }}
        onPointerMove={place.onPointerMove}
        onPointerUp={(event) => {
          place.onPointerUp(event);
          setHovered(false);
        }}
        onMouseEnter={() => {
          if (!place.dragging) setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          // A drag just ended - swallow the synthetic click so the panel
          // doesn't toggle when the user only repositioned the avatar.
          if (place.consumeDrag()) return;
          setOpen((v) => !v);
        }}
        aria-label={open ? "Close Tabby" : "Open Tabby companion"}
        aria-expanded={open}
        title="Tabby - ⌘B · drag to move"
      >
        <CatAvatar mood={brain.mood} reducedMotion={reducedMotion} hovered={hovered} />
        {brain.status.errorCount > 0 && (
          <span className="tabby-error-dot" aria-hidden>
            {brain.status.errorCount > 9 ? "9+" : brain.status.errorCount}
          </span>
        )}
      </button>
    </>
  );
}
