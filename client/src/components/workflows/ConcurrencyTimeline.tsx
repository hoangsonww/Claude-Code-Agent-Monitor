/**
 * @file ConcurrencyTimeline.tsx
 * @description Defines the ConcurrencyTimeline component that visualizes concurrency data for agent sessions using horizontal bars. Each lane represents an agent type (main or subagent) with the bar width proportional to the number of sessions and timing indicated as a percentage of the session duration. The component handles empty states gracefully and assigns distinct colors to different agent types for clarity.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/ConcurrencyTimeline.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * Defines the ConcurrencyTimeline component that visualizes concurrency data for agent sessions
 * using horizontal bars. Each lane represents an agent type (main or subagent) with the bar width
 * proportional to the number of sessions and timing indicated as a percentage of the session
 * duration. The component handles empty states gracefully and assigns distinct colors to different
 * agent types for clarity.
 *
 * ## Architectural boundary
 * - Transforms workflow analytics into an explanatory visualization without redefining the server's
 *   aggregate semantics.
 * - Layout geometry, interaction state, and rendering adapters stay local; canonical workflow types
 *   stay in shared contracts.
 * - Every graphical encoding needs a readable textual label or surrounding explanation for
 *   accessibility and debugging.
 *
 * ## Local dependency edges
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `ConcurrencyTimeline` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `ConcurrencyTimelineProps` (interface) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `laneColor` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `buildLaneTooltip` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ConcurrencyTimeline` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `ConcurrencyTimelineProps` (interface) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `describeLaneTiming` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `EmptyState` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `laneColor` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `LaneRow` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `LaneRowProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MAIN_COLOR` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SUBAGENT_PALETTE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TFn` (type) — top-level declaration that helps orient code review and focused test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `workflows` — visible copy resolves through this namespace; key and interpolation parity
 *   applies to every supported locale.
 *
 * ## Area invariants
 * - Use stable entity identifiers for nodes, links, colors, selections, legends, and React keys.
 * - Treat missing timestamps, models, token values, parents, and terminal states as expected
 *   partial-data cases.
 * - Keep scales and domains deterministic so identical data does not jump between renders.
 * - Bound SVG/canvas dimensions and event listeners; resize observers and D3 selections require
 *   cleanup.
 * - Do not silently discard filtered records when a visual limit is applied; explain truncation in
 *   the UI.
 * - Keep tooltip and legend values aligned with the exact encoding shown in the chart.
 * - Preserve keyboard and screen-reader paths to information that is otherwise available only by
 *   pointer hover.
 * - Avoid mutating API-owned arrays while sorting, grouping, or assigning visualization
 *   coordinates.
 * - Keep provider and model labels canonical through shared formatting helpers.
 * - Snapshot tests should assert stable structure, while focused unit tests own geometry and
 *   derivation edge cases.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/ConcurrencyTimeline.tsx`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/ConcurrencyTimeline.tsx`
 * **Purpose:** Workflow analytics visualization built on D3; consumes aggregated session/run metrics from the workflows API.
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
 * - `../../lib/types`
 *
 * ## Public surface
 * - `ConcurrencyTimelineProps` — exported API; see TSDoc on the symbol for behavior.
 * - `ConcurrencyTimeline` — exported API; see TSDoc on the symbol for behavior.
 * - `laneColor` — exported API; see TSDoc on the symbol for behavior.
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
 * **ConcurrencyTimelineProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ConcurrencyTimeline**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **laneColor**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ConcurrencyData, ConcurrencyLane } from "../../lib/types";

// ── Color palette ─────────────────────────────────────────────────────────────

/** Lane color for the main agent. */
const MAIN_COLOR = "#6366f1"; // indigo

/** Lane colors for subagent types, cycled by subagent index. */
const SUBAGENT_PALETTE = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#06b6d4", // cyan
  "#f97316", // orange
  "#a855f7", // purple
  "#84cc16", // lime
];

// ── Lane row ──────────────────────────────────────────────────────────────────

/** Props for {@link LaneRow}. */
interface LaneRowProps {
  /** Aggregated lane to draw. */
  lane: ConcurrencyLane;
  /** Lane color. */
  color: string;
  /** Session count of the busiest lane, used to scale the count bar. */
  maxCount: number;
  /** Shows the lane's tooltip anchored to the row. */
  onShowTip: (lane: ConcurrencyLane, color: string, anchor: HTMLElement) => void;
  /** Hides the tooltip. */
  onHideTip: () => void;
}

/** Translation function signature used by the imperative tooltip builder. */
type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Describe when in a session a lane typically runs, from its average start and end as fractions of
 * the session: the whole session, front-loaded, back-loaded, a tight window, or a middle stretch.
 *
 * @param start - Average start, 0 to 1.
 * @param end - Average end, 0 to 1.
 * @param t - Translation function.
 * @returns The timing description.
 */
function describeLaneTiming(start: number, end: number, t: TFn): string {
  // start/end are 0–1 fractions of session timeline.
  const startPct = Math.round(start * 100);
  const endPct = Math.round(end * 100);
  const span = Math.max(0, endPct - startPct);

  if (startPct < 15 && endPct > 85) return t("concurrency.tooltip.timing.wholeSession");
  if (startPct < 15) return t("concurrency.tooltip.timing.frontLoadedFmt", { end: endPct });
  if (endPct > 85) return t("concurrency.tooltip.timing.backLoadedFmt", { start: startPct });
  if (span < 15) return t("concurrency.tooltip.timing.tightFmt", { start: startPct, end: endPct });
  return t("concurrency.tooltip.timing.midSessionFmt", { start: startPct, end: endPct });
}

/**
 * One lane: name, a bar showing how many sessions used it relative to the busiest lane, and a band
 * marking its average start and end within a session.
 */
function LaneRow({ lane, color, maxCount, onShowTip, onHideTip }: LaneRowProps) {
  const { t } = useTranslation("workflows");
  const displayName = lane.name === "Main Agent" ? t("orchestration.mainAgent") : lane.name;
  // Bar width proportional to session count (the metric with meaningful variance)
  const barPct = maxCount > 0 ? (lane.count / maxCount) * 100 : 0;

  // Duration as percentage of session (backend returns 0-1 fractions)
  const startPct = (lane.avgStart * 100).toFixed(0);
  const endPct = (lane.avgEnd * 100).toFixed(0);

  return (
    <div className="flex items-center gap-3 py-1.5 group">
      {/* Label column */}
      <div className="flex-shrink-0 w-[140px] text-right" title={displayName}>
        <span className="text-xs font-medium text-gray-400 truncate block group-hover:text-gray-200 transition-colors">
          {displayName}
        </span>
      </div>

      {/* Bar area */}
      <div
        className="relative flex-1 h-6 bg-surface-3 rounded overflow-hidden"
        onMouseEnter={(e) => onShowTip(lane, color, e.currentTarget)}
        onMouseLeave={onHideTip}
      >
        <div
          className="absolute top-0 bottom-0 left-0 rounded transition-all duration-300"
          style={{
            width: `${barPct}%`,
            minWidth: barPct > 0 ? "4px" : undefined,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
        {/* Count label inside bar if wide enough, outside if not */}
        <span
          className="absolute top-0 bottom-0 flex items-center text-[11px] font-medium tabular-nums"
          style={{
            left: barPct > 15 ? "8px" : `calc(${barPct}% + 6px)`,
            color: barPct > 15 ? "white" : "var(--color-gray-400)",
          }}
        >
          {lane.count}
        </span>
      </div>

      {/* Timing range */}
      <div className="flex-shrink-0 w-[72px] text-[11px] text-gray-600 tabular-nums">
        {startPct}%&ndash;{endPct}%
      </div>
    </div>
  );
}

/**
 * Fill the tooltip element for a lane: name, sessions using it, average start and end as
 * percentages of the session, a timing description, and a hint explaining the bar. Built with DOM
 * calls so hovering does not touch React state.
 *
 * @param el - Tooltip container; its children are replaced.
 * @param lane - Hovered lane.
 * @param displayName - Localized lane name.
 * @param color - Lane color.
 * @param t - Translation function.
 */
function buildLaneTooltip(
  el: HTMLDivElement,
  lane: ConcurrencyLane,
  displayName: string,
  color: string,
  t: TFn
) {
  while (el.firstChild) el.removeChild(el.firstChild);

  const startPct = (lane.avgStart * 100).toFixed(0);
  const endPct = (lane.avgEnd * 100).toFixed(0);

  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px";
  const dot = document.createElement("span");
  dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color}`;
  const title = document.createElement("p");
  title.style.cssText = "font-size:12px;font-weight:600;color:#e2e8f0;margin:0";
  title.textContent = displayName;
  header.appendChild(dot);
  header.appendChild(title);
  el.appendChild(header);

  const subtitle = document.createElement("p");
  subtitle.style.cssText =
    "font-size:10px;color:#64748b;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em";
  subtitle.textContent = t("concurrency.tooltip.lane");
  el.appendChild(subtitle);

  /** Append a label/value row to the tooltip. */
  const addRow = (label: string, value: string) => {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;justify-content:space-between;gap:16px;font-size:11px;line-height:1.6";
    const lbl = document.createElement("span");
    lbl.style.color = "#64748b";
    lbl.textContent = label;
    const val = document.createElement("span");
    val.style.cssText = "color:#cbd5e1;font-weight:500;font-variant-numeric:tabular-nums";
    val.textContent = value;
    row.appendChild(lbl);
    row.appendChild(val);
    el.appendChild(row);
  };

  addRow(t("concurrency.tooltip.sessionsWith"), String(lane.count));
  addRow(t("concurrency.tooltip.avgStart"), `${startPct}%`);
  addRow(t("concurrency.tooltip.avgEnd"), `${endPct}%`);

  const desc = document.createElement("p");
  desc.style.cssText =
    "font-size:11px;color:#94a3b8;line-height:1.45;border-top:1px solid #2a2a4a;padding-top:8px;margin:8px 0 0";
  desc.textContent = describeLaneTiming(lane.avgStart, lane.avgEnd, t);
  el.appendChild(desc);

  const hint = document.createElement("p");
  hint.style.cssText = "font-size:10px;color:#64748b;line-height:1.45;margin:6px 0 0";
  hint.textContent = t("concurrency.tooltip.barHint");
  el.appendChild(hint);
}

// ── Empty state ───────────────────────────────────────────────────────────────

/** Placeholder shown when there are no lanes. */
function EmptyState() {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-xl bg-surface-4 flex items-center justify-center mb-3">
        <svg
          className="w-5 h-5 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="3" y="4" width="18" height="4" rx="1" />
          <rect x="3" y="10" width="12" height="4" rx="1" />
          <rect x="3" y="16" width="15" height="4" rx="1" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-400">{t("concurrency.noData")}</p>
      <p className="text-xs text-gray-600 mt-1">{t("concurrency.noDataDesc")}</p>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

/** Props for {@link ConcurrencyTimeline}. */
export interface ConcurrencyTimelineProps {
  /** Aggregated lanes from `/api/workflows`. */
  data: ConcurrencyData;
}

/**
 * Concurrency timeline on the Workflows page: one lane for the main agent and one per subagent
 * type, showing how widely each is used and where in a typical session it runs.
 */
export function ConcurrencyTimeline({ data }: ConcurrencyTimelineProps) {
  const { t } = useTranslation("workflows");
  const tipRef = useRef<HTMLDivElement>(null);
  const lanes = data.aggregateLanes;

  /** Hide the tooltip. */
  const hideTip = useCallback(() => {
    const tip = tipRef.current;
    if (tip) tip.style.opacity = "0";
  }, []);

  /** Fill the tooltip for a lane and anchor it next to the row, kept inside the container. */
  const showTip = useCallback(
    (lane: ConcurrencyLane, color: string, anchor: HTMLElement) => {
      const tip = tipRef.current;
      if (!tip) return;
      const displayName = lane.name === "Main Agent" ? t("orchestration.mainAgent") : lane.name;
      buildLaneTooltip(tip, lane, displayName, color, t);

      const r = anchor.getBoundingClientRect();
      tip.style.opacity = "0";
      tip.style.display = "block";
      const tipW = tip.offsetWidth || 280;
      const tipH = tip.offsetHeight || 160;
      const margin = 8;

      let left = r.left + r.width / 2 - tipW / 2;
      if (left < margin) left = margin;
      if (left + tipW > window.innerWidth - margin) left = window.innerWidth - tipW - margin;
      let top = r.top - tipH - 10;
      if (top < margin) top = r.bottom + 10;

      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.style.opacity = "1";
    },
    [t]
  );

  if (lanes.length === 0) {
    return <EmptyState />;
  }

  // Sort by session count descending so the most-used agent types are on top
  const sorted = [...lanes].sort((a, b) => b.count - a.count);
  const maxCount = sorted[0]?.count ?? 1;

  // Assign colors
  let subagentIndex = 0;
  const coloredLanes = sorted.map((lane) => {
    const isMain = lane.name === "Main Agent";
    const color = isMain
      ? MAIN_COLOR
      : (SUBAGENT_PALETTE[subagentIndex % SUBAGENT_PALETTE.length] ?? MAIN_COLOR);
    if (!isMain) subagentIndex++;
    return { lane, color };
  });

  return (
    <div className="w-full" onMouseLeave={hideTip}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-shrink-0 w-[140px]" />
        <div className="flex-1 flex items-center justify-between">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">
            {t("concurrency.sessions")}
          </span>
          <span className="text-[10px] text-gray-600 tabular-nums">
            {maxCount}
            {t("concurrency.max")}
          </span>
        </div>
        <div className="flex-shrink-0 w-[72px] text-[10px] text-gray-600 uppercase tracking-wider">
          {t("concurrency.timing")}
        </div>
      </div>

      {/* Lane rows */}
      <div className="flex flex-col divide-y divide-surface-4">
        {coloredLanes.map(({ lane, color }) => (
          <LaneRow
            key={lane.name}
            lane={lane}
            color={color}
            maxCount={maxCount}
            onShowTip={showTip}
            onHideTip={hideTip}
          />
        ))}
      </div>

      <div
        ref={tipRef}
        role="tooltip"
        aria-hidden="true"
        className="fixed z-50 px-3 py-2 rounded-lg shadow-2xl pointer-events-none"
        style={{
          display: "none",
          opacity: 0,
          left: 0,
          top: 0,
          background: "#12121f",
          border: "1px solid #2a2a4a",
          color: "#e2e8f0",
          minWidth: 240,
          maxWidth: 320,
          transition: "opacity 120ms ease-out",
        }}
      />
    </div>
  );
}

/**
 * Lane color for a lane name: the main agent's fixed color, or a subagent palette color cycled by
 * index. Exported so other components can color lanes consistently.
 *
 * @param name - Lane name (`Main Agent` for the main lane).
 * @param subagentIndex - Index among subagent lanes.
 * @returns A hex color.
 */
export function laneColor(name: string, subagentIndex: number): string {
  if (name === "Main Agent") return MAIN_COLOR;
  return SUBAGENT_PALETTE[subagentIndex % SUBAGENT_PALETTE.length] ?? MAIN_COLOR;
}
