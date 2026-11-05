/**
 * @file SessionComplexityScatter.tsx
 * @description A React component that renders a scatter plot visualization of session complexity using D3.js. Each session is represented as a bubble, where the x-axis represents the session duration, the y-axis represents the number of agents involved, and the size of the bubble corresponds to the total tokens used. The color of each bubble indicates the session status (e.g., completed, active, error, abandoned). The component also includes tooltips for detailed information on hover and a legend for status colors. It is designed to be responsive and provides an empty state when no data is available.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/SessionComplexityScatter.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * A React component that renders a scatter plot visualization of session complexity using D3.js.
 * Each session is represented as a bubble, where the x-axis represents the session duration, the
 * y-axis represents the number of agents involved, and the size of the bubble corresponds to the
 * total tokens used. The color of each bubble indicates the session status (e.g., completed,
 * active, error, abandoned). The component also includes tooltips for detailed information on hover
 * and a legend for status colors. It is designed to be responsive and provides an empty state when
 * no data is available.
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
 * - `../../lib/format` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `d3` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `SessionComplexityScatter` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `SessionComplexityScatterProps` (interface) — exported contract; search downstream imports and
 *   tests before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `EmptyState` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `fmtTokens` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `fmtXTick` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `formatDurationSec` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `Legend` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `LEGEND_STATUSES` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MARGIN` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `MAX_BUBBLE_R` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MIN_BUBBLE_R` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionComplexityScatter` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SessionComplexityScatterProps` (interface) — top-level declaration that helps orient code
 *   review and focused test selection.
 * - `STATUS_COLOR` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `statusColor` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Tooltip` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TooltipState` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/SessionComplexityScatter.tsx`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/SessionComplexityScatter.tsx`
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
 * - `../../lib/format`
 *
 * ## Public surface
 * - `SessionComplexityScatterProps` — exported API; see TSDoc on the symbol for behavior.
 * - `SessionComplexityScatter` — exported API; see TSDoc on the symbol for behavior.
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
 * **SessionComplexityScatterProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SessionComplexityScatter**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { SessionComplexityItem } from "../../lib/types";
import { formatModelName } from "../../lib/format";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Space around the plot, in pixels; the bottom and left margins hold the axes, their labels, and
 * the legend.
 */
const MARGIN = { top: 20, right: 24, bottom: 60, left: 52 };
/** Radius of the bubble for the session with the fewest tokens. */
const MIN_BUBBLE_R = 4;
/** Radius of the bubble for the session with the most tokens. */
const MAX_BUBBLE_R = 32;

/** Bubble color for each session status. */
const STATUS_COLOR: Record<string, string> = {
  completed: "#22c55e",
  error: "#ef4444",
  active: "#6366f1",
  abandoned: "#eab308",
};

/**
 * Bubble color for a session status, gray for unknown statuses.
 *
 * @param status - Session status.
 * @returns A hex color.
 */
function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? "#6b7280";
}

// ── Duration formatting ───────────────────────────────────────────────────────

/**
 * Format a duration for the tooltip: `45s`, `3m 20s`, `3m`, or `1h 5m`.
 *
 * @param sec - Duration in seconds.
 * @returns The formatted duration.
 */
function formatDurationSec(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Format an x-axis tick: `0`, `30s`, `5m`, `2h`, or `2h 30m`.
 *
 * @param sec - Tick value in seconds.
 * @returns The tick label.
 */
function fmtXTick(sec: number): string {
  if (sec === 0) return "0";
  if (sec < 60) return `${Math.round(sec)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ""}`;
  return `${m}m`;
}

/**
 * Compact token count: `1.2M`, `340K`, or the plain number.
 *
 * @param n - Token count.
 * @returns The formatted count.
 */
function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

/** Hovered bubble and the pointer position for the tooltip. */
interface TooltipState {
  /** Pointer x in viewport coordinates. */
  x: number;
  /** Pointer y in viewport coordinates. */
  y: number;
  /** Session under the pointer. */
  item: SessionComplexityItem;
}

/**
 * Fixed-position tooltip for a hovered session: name (or id), model, duration, agents, subagents,
 * and tokens. Flips to the left of the pointer near the right edge of the window.
 */
function Tooltip({ state }: { state: TooltipState }) {
  const { t } = useTranslation("workflows");
  const nearRight = state.x > window.innerWidth - 220;

  return (
    <div
      className="fixed z-50 px-3 py-2 text-xs bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-xl text-gray-200 pointer-events-none whitespace-nowrap"
      style={{
        left: nearRight ? state.x - 12 : state.x + 12,
        top: state.y - 10,
        transform: nearRight ? "translateX(-100%)" : undefined,
      }}
    >
      <p className="font-semibold text-gray-100 mb-1 truncate max-w-[180px]">
        {state.item.name ?? state.item.id.slice(0, 12)}
      </p>
      <div className="flex flex-col gap-0.5 text-gray-400">
        <span>
          {t("complexity.tooltip.duration")} {formatDurationSec(state.item.duration)}
        </span>
        <span>
          {t("complexity.tooltip.agents")} {state.item.agentCount}
        </span>
        <span>
          {t("complexity.tooltip.subagents")} {state.item.subagentCount}
        </span>
        <span>
          {t("complexity.tooltip.tokens")} {fmtTokens(state.item.totalTokens)}
        </span>
        {state.item.model && (
          <span>
            {t("complexity.tooltip.model")} {formatModelName(state.item.model)}
          </span>
        )}
      </div>
      <div className="mt-1 pt-1 border-t border-[#2a2a4a]">
        <span className="font-medium" style={{ color: statusColor(state.item.status) }}>
          {t(`common:status.${state.item.status}`, { defaultValue: state.item.status })}
        </span>
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

/** Statuses listed in the legend, in display order. */
const LEGEND_STATUSES = ["completed", "active", "error", "abandoned"] as const;

/** Status color legend shown under the plot. */
function Legend() {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex flex-wrap items-center gap-4 justify-center mt-2">
      {LEGEND_STATUSES.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusColor(s) }}
          />
          <span className="text-xs text-gray-500">
            {t(`common:status.${s}`, { defaultValue: s })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

/** Placeholder shown when there are no sessions to plot. */
function EmptyState() {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 rounded-xl bg-surface-4 flex items-center justify-center mb-3">
        <svg
          className="w-5 h-5 text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <circle cx="7" cy="12" r="3" />
          <circle cx="17" cy="8" r="2" />
          <circle cx="14" cy="17" r="4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-400">{t("complexity.noData")}</p>
      <p className="text-xs text-gray-600 mt-1">{t("complexity.noDataDesc")}</p>
    </div>
  );
}

// ── Main chart ────────────────────────────────────────────────────────────────

/** Props for {@link SessionComplexityScatter}. */
export interface SessionComplexityScatterProps {
  /** Per-session complexity figures from `/api/workflows`. */
  data: SessionComplexityItem[];
  /** Called with a session id when its bubble is clicked, typically to open the drill-in. */
  onSessionClick?: (id: string) => void;
}

/**
 * Session complexity bubble chart on the Workflows page, drawn with D3 and sized to its container:
 * session duration on the x axis, agent count on the y axis, bubble area by total tokens, and color
 * by status. Hovering shows a tooltip; clicking a bubble reports its session.
 */
export function SessionComplexityScatter({ data, onSessionClick }: SessionComplexityScatterProps) {
  const { t } = useTranslation("workflows");
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [width, setWidth] = useState(600);

  // Track container width for responsiveness
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const height = Math.max(280, Math.min(420, width * 0.5));

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.duration) ?? 1])
      .nice()
      .range([0, innerW]);

    const yScale = d3
      .scaleLinear()
      .domain([0, (d3.max(data, (d) => d.agentCount) ?? 1) + 1])
      .nice()
      .range([innerH, 0]);

    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(data, (d) => d.totalTokens) ?? 1])
      .range([MIN_BUBBLE_R, MAX_BUBBLE_R]);

    // Grid lines
    const gridColor = "#2a2a3d";

    g.append("g")
      .attr("class", "grid-x")
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickSize(-innerH)
          .tickFormat(() => "")
      )
      .attr("transform", `translate(0,${innerH})`)
      .call((sel) => {
        sel.select(".domain").remove();
        sel.selectAll(".tick line").attr("stroke", gridColor).attr("stroke-dasharray", "3,3");
      });

    g.append("g")
      .attr("class", "grid-y")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerW)
          .tickFormat(() => "")
      )
      .call((sel) => {
        sel.select(".domain").remove();
        sel.selectAll(".tick line").attr("stroke", gridColor).attr("stroke-dasharray", "3,3");
      });

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => fmtXTick(d as number))
      )
      .call((sel) => {
        sel.select(".domain").attr("stroke", "#363650");
        sel.selectAll(".tick line").attr("stroke", "#363650");
        sel.selectAll(".tick text").attr("fill", "#6b7280").attr("font-size", "11");
      });

    // X axis label
    g.append("text")
      .attr("x", innerW / 2)
      .attr("y", innerH + 44)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .attr("font-size", "11")
      .text(t("complexity.duration"));

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("d")))
      .call((sel) => {
        sel.select(".domain").attr("stroke", "#363650");
        sel.selectAll(".tick line").attr("stroke", "#363650");
        sel.selectAll(".tick text").attr("fill", "#6b7280").attr("font-size", "11");
      });

    // Y axis label
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerH / 2)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .attr("fill", "#6b7280")
      .attr("font-size", "11")
      .text(t("complexity.agentCount"));

    // Bubbles - sort largest to back so small ones are clickable
    const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);

    g.selectAll<SVGCircleElement, SessionComplexityItem>("circle")
      .data(sorted)
      .join("circle")
      .attr("cx", (d) => xScale(d.duration))
      .attr("cy", (d) => yScale(d.agentCount))
      .attr("r", (d) => rScale(d.totalTokens))
      .attr("fill", (d) => statusColor(d.status))
      .attr("fill-opacity", 0.75)
      .attr("stroke", (d) => statusColor(d.status))
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.9)
      .style("cursor", onSessionClick ? "pointer" : "default")
      .on("mouseenter", (event: MouseEvent, d) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .attr("fill-opacity", 1)
          .attr("stroke-width", 2.5);
        setTooltip({ x: event.clientX, y: event.clientY, item: d });
      })
      .on("mousemove", (event: MouseEvent) => {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : null));
      })
      .on("mouseleave", (event: MouseEvent) => {
        d3.select(event.currentTarget as SVGCircleElement)
          .attr("fill-opacity", 0.75)
          .attr("stroke-width", 1.5);
        setTooltip(null);
      })
      .on("click", (_event: MouseEvent, d) => {
        onSessionClick?.(d.id);
      });
  }, [data, width, height, onSessionClick, t]);

  if (data.length === 0) return <EmptyState />;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-center"
      onMouseLeave={handleMouseLeave}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        aria-label={t("complexity.ariaLabel")}
        role="img"
      />
      <Legend />
      {tooltip && <Tooltip state={tooltip} />}
    </div>
  );
}
