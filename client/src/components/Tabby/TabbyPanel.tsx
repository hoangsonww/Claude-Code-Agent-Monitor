/**
 * @file TabbyPanel.tsx
 * @description Expanded Tabby panel: a live status strip (live / waiting /
 *   errored stat chips + connection state), quick navigation actions, and a
 *   local "Ask" box. Pure presentational - all data and the ask/navigation
 *   behavior are injected by the container.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Tabby/TabbyPanel.tsx
 * **Area:** client Tabby component
 * **Responsibility:**
 * Expanded Tabby panel: a live status strip (live / waiting / errored stat chips + connection
 * state), quick navigation actions, and a local "Ask" box. Pure presentational - all data and the
 * ask/navigation behavior are injected by the container.
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
 * - `./brain` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `TabbyPanel` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ActionButton` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `StatChip` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyPanel` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabbyPanelProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `Tone` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TONE_MUTED` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TONES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Tabby/TabbyPanel.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/TabbyPanel.tsx`
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
 * - `./brain`
 *
 * ## Public surface
 * - `TabbyPanel` — exported API; see TSDoc on the symbol for behavior.
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
 * **TabbyPanel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Play,
  Activity,
  LayoutList,
  Bell,
  BellOff,
  Trash2,
  X,
  Send,
  AlertTriangle,
  Hourglass,
  Radio,
  type LucideIcon,
} from "lucide-react";
import type { TabbyStatus } from "./brain";

/** Props for {@link TabbyPanel}. */
interface TabbyPanelProps {
  /** Live counts Tabby derived from the event stream. */
  status: TabbyStatus;
  /** Whether Tabby's speech is muted. */
  muted: boolean;
  /** Toggles mute. */
  onToggleMute: () => void;
  /** Clears the alert badge. */
  onClearAlerts: () => void;
  /** Navigates to an app route. */
  onNavigate: (route: string) => void;
  /** Returns an answer to display, or null when the query was handed off. */
  onAsk: (query: string) => string | null;
  /** Closes the panel. */
  onClose: () => void;
}

/**
 * Tabby's expanded panel: live status chips (live, waiting, and errored), quick links to Run
 * Claude, Activity, Sessions, and errored sessions, mute and clear-alerts buttons, and an ask box.
 * Typed questions are answered inline, or handed off to the Run page when they need Claude.
 */
export function TabbyPanel({
  status,
  muted,
  onToggleMute,
  onClearAlerts,
  onNavigate,
  onAsk,
  onClose,
}: TabbyPanelProps) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  /**
   * Submit a question: show the inline answer, or nothing when it was handed off to the Run page
   * (the container then navigates and closes the panel).
   */
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = onAsk(query);
    setAnswer(result); // null means it handed off (container navigates/closes)
    setQuery("");
  };

  return (
    <div
      className="w-72 overflow-hidden rounded-2xl border border-border-light bg-surface-2/95 shadow-2xl shadow-black/50 backdrop-blur-md animate-slide-up"
      role="dialog"
      aria-label="Tabby companion"
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-gradient-to-r from-accent/10 to-transparent px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none" aria-hidden>
            🐾
          </span>
          <span className="text-sm font-semibold text-gray-100">Tabby</span>
          <span
            className={`ml-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              status.connected ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status.connected ? "bg-emerald-400" : "bg-red-500"
              }`}
              aria-hidden
            />
            {status.connected ? "Live" : "Offline"}
          </span>
        </div>
        <button
          className="rounded-md p-1 text-gray-500 transition-colors hover:bg-surface-4 hover:text-gray-200"
          onClick={onClose}
          aria-label="Close Tabby"
        >
          <X size={15} />
        </button>
      </div>

      <div className="p-3">
        {/* status stat chips */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          <StatChip
            icon={Radio}
            label="live"
            value={status.liveCount}
            tone={status.liveCount > 0 ? "accent" : "muted"}
          />
          <StatChip
            icon={Hourglass}
            label="waiting"
            value={status.waitingCount}
            tone={status.waitingCount > 0 ? "amber" : "muted"}
          />
          <StatChip
            icon={AlertTriangle}
            label="errored"
            value={status.errorCount}
            tone={status.errorCount > 0 ? "red" : "muted"}
          />
        </div>

        {/* quick actions */}
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <ActionButton icon={Play} label="Run Claude" onClick={() => onNavigate("/run")} />
          <ActionButton icon={Activity} label="Activity" onClick={() => onNavigate("/activity")} />
          <ActionButton
            icon={LayoutList}
            label="Sessions"
            onClick={() => onNavigate("/sessions")}
          />
          <ActionButton
            icon={AlertTriangle}
            label="Errored"
            disabled={status.errorCount === 0}
            onClick={() => onNavigate("/sessions")}
          />
          <ActionButton
            icon={muted ? BellOff : Bell}
            label={muted ? "Unmute" : "Mute"}
            onClick={onToggleMute}
          />
          <ActionButton
            icon={Trash2}
            label="Clear alerts"
            disabled={status.errorCount === 0}
            onClick={onClearAlerts}
          />
        </div>

        {/* ask */}
        <form onSubmit={submit} className="flex items-center gap-1.5">
          <input
            className="flex-1 rounded-lg border border-border bg-surface-1 px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-500 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
            placeholder="Ask Tabby… (e.g. any errors?)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Ask Tabby"
          />
          <button
            type="submit"
            className="flex items-center justify-center rounded-lg bg-accent px-2.5 py-2 text-white transition-colors hover:bg-accent-hover"
            aria-label="Send"
          >
            <Send size={14} />
          </button>
        </form>
        {answer && (
          <p className="mt-2 rounded-lg bg-surface-1/70 px-2.5 py-2 text-xs leading-relaxed text-gray-300">
            {answer}
          </p>
        )}
      </div>
    </div>
  );
}

/** Tailwind classes for a status chip's border and background, value text, and icon. */
interface Tone {
  /** Border and background classes. */
  wrap: string;
  /** Value text class. */
  value: string;
  /** Icon color class. */
  icon: string;
}

/** Fallback tone, also passed by callers for zero counts. */
const TONE_MUTED: Tone = {
  wrap: "border-border bg-surface-1",
  value: "text-gray-300",
  icon: "text-gray-500",
};

/** Chip tones by name. */
const TONES: Record<string, Tone> = {
  accent: { wrap: "border-accent/30 bg-accent/10", value: "text-gray-100", icon: "text-accent" },
  amber: {
    wrap: "border-amber-500/30 bg-amber-500/10",
    value: "text-amber-200",
    icon: "text-amber-400",
  },
  red: { wrap: "border-red-500/30 bg-red-500/10", value: "text-red-200", icon: "text-red-400" },
  muted: TONE_MUTED,
};

/**
 * Status chip with an icon, a label, and a count. Callers pass the `muted` tone when the count is
 * zero; an unknown tone also falls back to it.
 */
function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  /** Icon component. */
  icon: LucideIcon;
  /** Short label. */
  label: string;
  /** Count to show. */
  value: number;
  /** Tone name; `muted` for zero counts. */
  tone: string;
}): ReactNode {
  const t = TONES[tone] ?? TONE_MUTED;
  return (
    <div className={`flex flex-col items-center gap-0.5 rounded-xl border py-1.5 ${t.wrap}`}>
      <Icon size={13} className={t.icon} aria-hidden />
      <span className={`text-base font-semibold leading-none tabular-nums ${t.value}`}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-gray-500">{label}</span>
    </div>
  );
}

/** Compact icon-and-label button in the panel's action row. */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  /** Icon component. */
  icon: LucideIcon;
  /** Button label. */
  label: string;
  /** Called on click. */
  onClick: () => void;
  /** Disables the button. */
  disabled?: boolean;
}) {
  return (
    <button
      className="flex items-center gap-1.5 rounded-lg bg-surface-1 px-2 py-1.5 text-xs text-gray-300 transition-colors hover:bg-surface-4 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
