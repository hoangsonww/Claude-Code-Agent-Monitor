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

const FLYOUT_GAP = 10; // px between avatar and flyout
const VIEWPORT_MARGIN = 12; // min gap from any screen edge

interface Anchor {
  left: number;
  top: number;
  size: number;
  side: "left" | "right";
  openUp: boolean;
}

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

  const onNavigate = useCallback(
    (route: string) => {
      navigate(route);
      setOpen(false);
    },
    [navigate]
  );

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
