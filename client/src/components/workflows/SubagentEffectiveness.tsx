/**
 * @file SubagentEffectiveness.tsx
 * @description Defines the SubagentEffectiveness React component that visualizes the effectiveness of subagents in a workflow. It displays a success rate as a circular progress ring, key metrics such as total sessions and average duration, and a sparkline showing weekly activity trends. The component is designed to handle cases with no data gracefully and uses a consistent color scheme for clarity.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/SubagentEffectiveness.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * Defines the SubagentEffectiveness React component that visualizes the effectiveness of subagents
 * in a workflow. It displays a success rate as a circular progress ring, key metrics such as total
 * sessions and average duration, and a sparkline showing weekly activity trends. The component is
 * designed to handle cases with no data gracefully and uses a consistent color scheme for clarity.
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
 * - `react-dom` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `SubagentEffectiveness` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `SubagentEffectivenessProps` (interface) — exported contract; search downstream imports and
 *   tests before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `COLORS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `formatDurationSec` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `MetricBox` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `MetricBoxProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `RING_CIRCUMFERENCE` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `RING_RADIUS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `RING_STROKE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ScoreCard` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ScoreCardProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `Sparkline` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SparklineProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SparklineTooltip` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SparklineTooltipState` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SubagentEffectiveness` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SubagentEffectivenessProps` (interface) — top-level declaration that helps orient code review
 *   and focused test selection.
 * - `SuccessRing` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SuccessRingProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useLayoutEffect` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/SubagentEffectiveness.tsx`
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

/**
 * Accent colors cycled across the score cards in order, so neighboring subagent types are easy to
 * tell apart.
 */
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

/** Radius of the success-rate ring, in SVG units. */
const RING_RADIUS = 28;
/** Stroke width of the success-rate ring. */
const RING_STROKE = 5;
/** Circumference of the ring, used to turn a percentage into a stroke dash length. */
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Format a duration as `1h 5m`, `3m 20s`, or `45s`.
 *
 * @param seconds - Duration in seconds, or null when unknown.
 * @returns The formatted duration, or `-` for null or negative input.
 */
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

/** Props for {@link SuccessRing}. */
interface SuccessRingProps {
  /** Success rate as a percentage; clamped to 0 to 100. */
  rate: number;
  /** Ring color. */
  color: string;
}

/**
 * Circular progress ring showing a subagent type's success rate with the percentage in the middle.
 */
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

/** Props for {@link Sparkline}. */
interface SparklineProps {
  /** Seven invocation counts, Monday first, covering the last eight weeks. */
  data: number[];
  /** Bar color. */
  color: string;
}

/** Which sparkline bar is hovered and where it is on screen, for positioning its tooltip. */
interface SparklineTooltipState {
  /** Index of the hovered bar (0 is Monday). */
  index: number;
  /** Bounding rect of the hovered bar (in viewport coordinates). */
  rect: DOMRect;
}

/**
 * Day-of-week bar chart of a subagent type's invocations. Weekday labels are localized with
 * `Intl.DateTimeFormat`; bars are scaled to the busiest day, with a small minimum height so days
 * with few or no invocations stay visible. Hovering a bar shows that day's count.
 */
function Sparkline({ data, color }: SparklineProps) {
  const { t, i18n } = useTranslation(["workflows", "common"]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  /** Localized short weekday names, Monday first (January 5, 2026 is a Monday). */
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
  /** Screen rectangle of the hovered bar, used to position the tooltip. */
  rect: DOMRect;
  /** Weekday label. */
  label: string;
  /** Invocations on that weekday. */
  value: number;
  /** Accent color of the card. */
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

/** Props for {@link MetricBox}. */
interface MetricBoxProps {
  /** Metric name. */
  label: string;
  /** Formatted value. */
  value: string;
}

/** Small value-over-label tile inside a score card. */
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

/** Props for {@link ScoreCard}. */
interface ScoreCardProps {
  /** Subagent type statistics to show. */
  item: SubagentEffectivenessItem;
  /** Position of the card, used to pick its accent color. */
  colorIndex: number;
}

/**
 * Score card for one subagent type: name, success ring, session count, and average duration, plus a
 * day-of-week activity sparkline.
 */
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

/** Props for {@link SubagentEffectiveness}. */
export interface SubagentEffectivenessProps {
  /** Per-subagent-type statistics from `/api/workflows`. */
  data: SubagentEffectivenessItem[];
}

/**
 * Subagent effectiveness section on the Workflows page: a responsive grid of score cards, one per
 * subagent type, or an empty message when no subagents ran.
 */
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
