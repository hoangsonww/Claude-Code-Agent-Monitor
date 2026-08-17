/**
 * @file SubagentEffectiveness.tsx
 * @description Defines the SubagentEffectiveness React component that visualizes the effectiveness of subagents in a workflow. It displays a success rate as a circular progress ring, key metrics such as total sessions and average duration, and a sparkline showing weekly activity trends. The component is designed to handle cases with no data gracefully and uses a consistent color scheme for clarity.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/SubagentEffectiveness.tsx`
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
 * - `SubagentEffectivenessProps` — exported API; see TSDoc on the symbol for behavior.
 * - `SubagentEffectiveness` — exported API; see TSDoc on the symbol for behavior.
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
 * **SubagentEffectivenessProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SubagentEffectiveness**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { SubagentEffectivenessItem } from "../../lib/types";

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
  "#f97316",
  "#6366f1",
] as const;

const RING_RADIUS = 28;
const RING_STROKE = 5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function formatDurationSec(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "-";
  const totalSec = Math.floor(seconds);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

interface SuccessRingProps {
  rate: number;
  color: string;
}

function SuccessRing({ rate, color }: SuccessRingProps) {
  const { t } = useTranslation("workflows");
  const clampedRate = Math.max(0, Math.min(100, rate));
  const filled = (clampedRate / 100) * RING_CIRCUMFERENCE;
  const gap = RING_CIRCUMFERENCE - filled;
  const viewSize = (RING_RADIUS + RING_STROKE) * 2 + 4;
  const center = viewSize / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={viewSize}
        height={viewSize}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        aria-label={t("effectiveness.successRateAria", { rate: clampedRate.toFixed(1) })}
        role="img"
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={RING_RADIUS}
          fill="none"
          stroke="#2a2a3d"
          strokeWidth={RING_STROKE}
        />
        {/* Arc */}
        <circle
          cx={center}
          cy={center}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeDasharray={`${filled} ${gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Percentage label */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e4e4ed"
          fontSize="13"
          fontWeight="600"
          fontFamily="Inter, sans-serif"
        >
          {clampedRate.toFixed(0)}%
        </text>
      </svg>
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
        {t("effectiveness.success")}
      </span>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color: string;
}

interface SparklineTooltipState {
  index: number;
  /** Bounding rect of the hovered bar (in viewport coordinates). */
  rect: DOMRect;
}

function Sparkline({ data, color }: SparklineProps) {
  const { t, i18n } = useTranslation(["workflows", "common"]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const dayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, day) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
          new Date(Date.UTC(2026, 0, 5 + day))
        )
      ),
    [locale]
  );
  const [tip, setTip] = useState<SparklineTooltipState | null>(null);
  const bars = data.length > 0 ? data : Array.from({ length: 7 }, () => 0);
  const max = Math.max(...bars, 1);

  return (
    <div aria-label={t("effectiveness.weeklyActivityAria")}>
      {/* Bars */}
      <div className="flex items-end gap-1 h-8 relative" onMouseLeave={() => setTip(null)}>
        {bars.map((value, i) => {
          const heightPct = Math.max((value / max) * 100, value > 0 ? 8 : 4);
          return (
            <div
              key={i}
              className="flex-1 relative"
              style={{ height: "100%" }}
              onMouseEnter={(e) =>
                setTip({ index: i, rect: e.currentTarget.getBoundingClientRect() })
              }
            >
              {/* Bar (anchored to bottom) */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-sm transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: value > 0 ? color : "#2a2a3d",
                  opacity: tip?.index === i ? 1 : value > 0 ? 0.85 : 0.4,
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Day labels */}
      <div className="flex gap-1 mt-1">
        {bars.map((_, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[8px] text-gray-600 leading-none select-none"
          >
            {dayLabels[i % dayLabels.length] ?? ""}
          </span>
        ))}
      </div>
      {tip && (
        <SparklineTooltip
          rect={tip.rect}
          label={dayLabels[tip.index % dayLabels.length] ?? ""}
          value={bars[tip.index] ?? 0}
          color={color}
        />
      )}
    </div>
  );
}

/**
 * Tooltip is rendered into `document.body` via a portal so the parent
 * ScoreCard's `overflow-hidden` (and hover-transform that would otherwise
 * become its containing block) cannot clip it. Coordinates are computed
 * from the hovered bar's bounding rect and clamped to the viewport with an
 * 8 px margin, so the tooltip can never be cut off on any day of the week.
 */
function SparklineTooltip({
  rect,
  label,
  value,
  color,
}: {
  rect: DOMRect;
  label: string;
  value: number;
  color: string;
}) {
  const { t } = useTranslation("workflows");
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: rect.left,
    top: rect.top,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;

    // Center horizontally over the bar, then clamp to viewport.
    let left = rect.left + rect.width / 2 - w / 2;
    if (left < margin) left = margin;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;

    // Default above the bar; flip below if there isn't room.
    let top = rect.top - h - 8;
    if (top < margin) top = rect.bottom + 8;

    setPos({ left, top });
  }, [rect]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="fixed z-[60] px-2 py-1 bg-[#12121f] border border-[#2a2a4a] rounded-md shadow-xl text-[10px] text-gray-200 whitespace-nowrap pointer-events-none"
      style={{ left: pos.left, top: pos.top }}
    >
      <span className="font-medium">{label}</span>
      <span className="text-gray-400 mx-1">·</span>
      <span className="tabular-nums" style={{ color }}>
        {t("effectiveness.sessionCount", { count: value })}
      </span>
    </div>,
    document.body
  );
}

interface MetricBoxProps {
  label: string;
  value: string;
}

function MetricBox({ label, value }: MetricBoxProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-surface-3 rounded-lg px-2 py-2 flex-1 min-w-0 overflow-hidden">
      <span className="text-xs font-semibold text-gray-200 tabular-nums truncate w-full text-center">
        {value}
      </span>
      <span className="text-[9px] text-gray-500 uppercase tracking-wider truncate w-full text-center">
        {label}
      </span>
    </div>
  );
}

interface ScoreCardProps {
  item: SubagentEffectivenessItem;
  colorIndex: number;
}

function ScoreCard({ item, colorIndex }: ScoreCardProps) {
  const { t } = useTranslation("workflows");
  const color = COLORS[colorIndex % COLORS.length] ?? COLORS[0];

  return (
    <div
      className="
        bg-surface-2 border border-border rounded-xl p-4
        flex flex-col gap-4 min-w-0 overflow-hidden
        transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:border-border-light
      "
    >
      {/* Header */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-gray-200 truncate" title={item.subagent_type}>
          {item.subagent_type}
        </span>
      </div>

      {/* Success ring */}
      <div className="flex justify-center">
        <SuccessRing rate={item.successRate} color={color} />
      </div>

      {/* Metric boxes */}
      <div className="flex gap-2">
        <MetricBox label={t("effectiveness.sessions")} value={String(item.sessions)} />
        <MetricBox
          label={t("effectiveness.avgDuration")}
          value={formatDurationSec(item.avgDuration)}
        />
      </div>

      {/* Sparkline */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
          {t("effectiveness.weeklyActivity")}
        </span>
        <Sparkline data={item.trend} color={color} />
      </div>
    </div>
  );
}

export interface SubagentEffectivenessProps {
  data: SubagentEffectivenessItem[];
}

export function SubagentEffectiveness({ data }: SubagentEffectivenessProps) {
  const { t } = useTranslation("workflows");
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
        {t("effectiveness.noData")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((item, i) => (
        <ScoreCard key={item.subagent_type} item={item} colorIndex={i} />
      ))}
    </div>
  );
}
