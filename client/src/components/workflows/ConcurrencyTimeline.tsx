/**
 * @file ConcurrencyTimeline.tsx
 * @description Defines the ConcurrencyTimeline component that visualizes concurrency data for agent sessions using horizontal bars. Each lane represents an agent type (main or subagent) with the bar width proportional to the number of sessions and timing indicated as a percentage of the session duration. The component handles empty states gracefully and assigns distinct colors to different agent types for clarity.
 * @author Son Nguyen <hoangson091104@gmail.com>
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

const MAIN_COLOR = "#6366f1"; // indigo

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

interface LaneRowProps {
  lane: ConcurrencyLane;
  color: string;
  maxCount: number;
  onShowTip: (lane: ConcurrencyLane, color: string, anchor: HTMLElement) => void;
  onHideTip: () => void;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

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

export interface ConcurrencyTimelineProps {
  data: ConcurrencyData;
}

export function ConcurrencyTimeline({ data }: ConcurrencyTimelineProps) {
  const { t } = useTranslation("workflows");
  const tipRef = useRef<HTMLDivElement>(null);
  const lanes = data.aggregateLanes;

  const hideTip = useCallback(() => {
    const tip = tipRef.current;
    if (tip) tip.style.opacity = "0";
  }, []);

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

// Re-export helper so callers can import the color fn if needed
export function laneColor(name: string, subagentIndex: number): string {
  if (name === "Main Agent") return MAIN_COLOR;
  return SUBAGENT_PALETTE[subagentIndex % SUBAGENT_PALETTE.length] ?? MAIN_COLOR;
}
