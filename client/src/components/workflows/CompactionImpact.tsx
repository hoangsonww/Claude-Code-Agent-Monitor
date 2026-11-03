/**
 * @file CompactionImpact.tsx
 * @description Visualizes how context compaction is spread across sessions.
 * Compaction is when Claude Code compresses older conversation history into a
 * summary once a session's context window fills up. This panel surfaces the
 * at-a-glance stats (total events, sessions affected, average and peak per
 * session) and a histogram answering "how many sessions compacted N times?"
 * so the distribution is legible regardless of how many sessions exist.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/CompactionImpact.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * Visualizes how context compaction is spread across sessions. Compaction is when Claude Code
 * compresses older conversation history into a summary once a session's context window fills up.
 * This panel surfaces the at-a-glance stats (total events, sessions affected, average and peak per
 * session) and a histogram answering "how many sessions compacted N times?" so the distribution is
 * legible regardless of how many sessions exist.
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
 * - `d3` — external package boundary; keep usage within the installed version and the repository's
 *   existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `CompactionImpact` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `CompactionImpactProps` (interface) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CHART_HEIGHT` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `CompactionImpact` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `CompactionImpactProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `fmtTokens` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `HistogramBucket` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `HistogramOpts` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MARGIN` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderHistogram` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `StatBox` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `StatBoxProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `toHistogram` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/CompactionImpact.tsx`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/CompactionImpact.tsx`
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
 * - `CompactionImpactProps` — exported API; see TSDoc on the symbol for behavior.
 * - `CompactionImpact` — exported API; see TSDoc on the symbol for behavior.
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
 * **CompactionImpactProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CompactionImpact**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { CompactionImpactData } from "../../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compact token count: `1.2B`, `3.4M`, `5.6K`, or the plain number.
 *
 * @param n - Token count.
 * @returns The formatted count.
 */
function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Roll the per-session list into a histogram: for each compaction count k
 *  (1..peak), how many sessions compacted exactly k times. */
function toHistogram(perSession: CompactionImpactData["perSession"]): Array<{
  count: number;
  sessions: number;
}> {
  const peak = perSession.reduce((m, s) => Math.max(m, s.compactions), 0);
  const buckets: Array<{ count: number; sessions: number }> = [];
  for (let k = 1; k <= peak; k++) {
    buckets.push({ count: k, sessions: perSession.filter((s) => s.compactions === k).length });
  }
  return buckets;
}

// ── Chart constants ───────────────────────────────────────────────────────────

/**
 * Space around the histogram plot, in pixels; the bottom and left margins hold the axes and their
 * labels.
 */
const MARGIN = { top: 18, right: 16, bottom: 46, left: 48 };
/** Histogram height in pixels; the width follows the container. */
const CHART_HEIGHT = 200;

// ── D3 renderer ───────────────────────────────────────────────────────────────

/** One histogram bar. */
interface HistogramBucket {
  /** Number of compactions (the x value). */
  count: number;
  /** How many sessions compacted exactly that many times (the bar height). */
  sessions: number;
}

/** Axis labels and hover handlers for {@link renderHistogram}. */
interface HistogramOpts {
  /** X-axis label. */
  x: string;
  /** Y-axis label. */
  y: string;
  /** Called when the pointer enters a bar. */
  onHover: (e: MouseEvent, d: HistogramBucket) => void;
  /** Called as the pointer moves over a bar, to move the tooltip. */
  onMove: (e: MouseEvent) => void;
  /** Called when the pointer leaves a bar. */
  onLeave: () => void;
}

/**
 * Draw the compactions-per-session histogram with D3 into the SVG, sized to its container width.
 * Clears the SVG first, so it can be called on every data change.
 *
 * @param svg - Target SVG element.
 * @param histo - Bars to draw.
 * @param opts - Axis labels and hover handlers.
 */
function renderHistogram(svg: SVGSVGElement, histo: HistogramBucket[], opts: HistogramOpts): void {
  const container = svg.parentElement;
  const width = container ? container.clientWidth : 400;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const root = d3.select(svg);
  root.selectAll("*").remove();
  root.attr("viewBox", `0 0 ${width} ${CHART_HEIGHT}`).attr("preserveAspectRatio", "xMidYMid meet");

  const defs = root.append("defs");
  const grad = defs
    .append("linearGradient")
    .attr("id", "compact-bar-grad")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", "#818cf8");
  grad
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#3730a3")
    .attr("stop-opacity", 0.7);

  const g = root.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  const maxSessions = d3.max(histo, (d) => d.sessions) ?? 1;

  const xScale = d3
    .scaleBand<number>()
    .domain(histo.map((d) => d.count))
    .range([0, innerW])
    .padding(histo.length > 12 ? 0.18 : 0.34);

  const yScale = d3.scaleLinear().domain([0, maxSessions]).nice().range([innerH, 0]);

  // Horizontal grid lines (integer session counts)
  const yTicks = yScale.ticks(Math.min(4, maxSessions)).filter((d) => Number.isInteger(d));
  g.selectAll<SVGLineElement, number>(".grid-line")
    .data(yTicks)
    .join("line")
    .attr("class", "grid-line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", (d) => yScale(d))
    .attr("y2", (d) => yScale(d))
    .attr("stroke", "#2a2a3d")
    .attr("stroke-width", 1);

  // Y axis (sessions)
  g.append("g")
    .call(
      d3
        .axisLeft(yScale)
        .tickValues(yTicks)
        .tickSize(0)
        .tickPadding(8)
        .tickFormat((d) => String(d))
    )
    .call((ax) => ax.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "#6b7280")
    .attr("font-size", 10)
    .attr("font-family", "Inter, sans-serif");

  // X axis (compactions per session - one tick per bucket)
  g.append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).tickSize(0).tickPadding(8))
    .call((ax) => ax.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "#9ca3af")
    .attr("font-size", 10)
    .attr("font-family", "Inter, sans-serif");

  // Axis titles
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 38)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 10)
    .attr("font-weight", 500)
    .attr("font-family", "Inter, sans-serif")
    .text(opts.x);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -38)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 10)
    .attr("font-weight", 500)
    .attr("font-family", "Inter, sans-serif")
    .text(opts.y);

  // Bars + count labels + rich hover tooltip (full-height hit-area so every
  // column - including empty buckets - responds, matching the other charts).
  histo.forEach((d) => {
    const bx = xScale(d.count);
    if (bx === undefined) return;
    const bw = xScale.bandwidth();
    const by = yScale(d.sessions);
    const barH = innerH - by;

    const bg = g.append("g");
    let bar: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;

    if (d.sessions > 0) {
      bar = bg
        .append("rect")
        .attr("x", bx)
        .attr("y", by)
        .attr("width", bw)
        .attr("height", barH)
        .attr("rx", Math.min(4, bw / 2))
        .attr("fill", "url(#compact-bar-grad)")
        .style("transition", "fill 120ms ease");

      bg.append("text")
        .attr("x", bx + bw / 2)
        .attr("y", by - 5)
        .attr("text-anchor", "middle")
        .attr("fill", "#a5b4fc")
        .attr("font-size", 10)
        .attr("font-weight", "600")
        .attr("font-family", "Inter, sans-serif")
        .attr("pointer-events", "none")
        .text(d.sessions);
    } else {
      // Empty bucket: faint baseline tick so the gap reads as "zero", not missing
      bg.append("rect")
        .attr("x", bx)
        .attr("y", innerH - 1)
        .attr("width", bw)
        .attr("height", 1)
        .attr("fill", "#2a2a3d");
    }

    // Transparent, full-height hover target on top of the bar.
    bg.append("rect")
      .attr("x", bx)
      .attr("y", 0)
      .attr("width", bw)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "pointer")
      .on("mouseenter", (event: MouseEvent) => {
        if (bar) bar.attr("fill", "#a5b4fc");
        opts.onHover(event, d);
      })
      .on("mousemove", (event: MouseEvent) => opts.onMove(event))
      .on("mouseleave", () => {
        if (bar) bar.attr("fill", "url(#compact-bar-grad)");
        opts.onLeave();
      });
  });
}

// ── Stat box ──────────────────────────────────────────────────────────────────

/** Props for {@link StatBox}. */
interface StatBoxProps {
  /** Metric name. */
  label: string;
  /** Formatted value. */
  value: string;
  /** Optional secondary line under the label. */
  sub?: string;
  /** Tailwind text class for the value; defaults to the accent color. */
  accent?: string;
}

/** Large value tile in the compaction summary row. */
function StatBox({ label, value, sub, accent = "text-accent" }: StatBoxProps) {
  return (
    <div className="flex flex-col gap-1 bg-surface-3 border border-border rounded-xl px-4 py-3.5 flex-1 min-w-0">
      <span className={`text-2xl font-semibold tabular-nums ${accent}`}>{value}</span>
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider leading-tight">
        {label}
      </span>
      {sub && <span className="text-[11px] text-gray-600 tabular-nums">{sub}</span>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Props for {@link CompactionImpact}. */
export interface CompactionImpactProps {
  /** Compaction statistics from `/api/workflows`. */
  data: CompactionImpactData;
}

/**
 * Compaction impact section on the Workflows page: total compactions, sessions affected, average
 * compactions per affected session, and the peak for a single session; a histogram of how many
 * sessions compacted 1, 2, 3, and more times; and a plain-language summary with the share of
 * sessions affected and, when known, the tokens freed. Shows an empty state when no session has
 * compacted.
 */
export function CompactionImpact({ data }: CompactionImpactProps) {
  const { t } = useTranslation("workflows");
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; title: string; detail: string } | null>(
    null
  );

  const hasData = data.totalCompactions > 0;
  const affected = data.sessionsWithCompactions;
  const sessionPct = data.totalSessions > 0 ? Math.round((affected / data.totalSessions) * 100) : 0;
  const avgPerSession = affected > 0 ? data.totalCompactions / affected : 0;
  const peak = data.perSession.reduce((m, s) => Math.max(m, s.compactions), 0);

  useEffect(() => {
    if (!svgRef.current || !hasData) return;
    const histo = toHistogram(data.perSession);
    const affectedN = data.sessionsWithCompactions;
    renderHistogram(svgRef.current, histo, {
      x: t("compaction.xAxis"),
      y: t("compaction.yAxis"),
      onHover: (e, d) => {
        const pct = affectedN > 0 ? Math.round((d.sessions / affectedN) * 100) : 0;
        setTip({
          x: e.clientX,
          y: e.clientY,
          title: t("compaction.tipTitle", { count: d.count }),
          detail: t("compaction.tipDetail", { sessions: d.sessions, pct }),
        });
      },
      onMove: (e) => setTip((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p)),
      onLeave: () => setTip(null),
    });
  }, [data, hasData, t]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" />
          <path d="M13 21l2-2 4 4" />
          <path d="M17 21v-6" />
          <path d="M21 17h-6" />
        </svg>
        <span className="text-sm">{t("compaction.noData")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* What compaction is - one line so the numbers below make sense */}
      <p className="text-xs text-gray-500 leading-relaxed">{t("compaction.help")}</p>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox
          label={t("compaction.totalCompactions")}
          value={data.totalCompactions.toLocaleString()}
          accent="text-accent-hover"
        />
        <StatBox
          label={t("compaction.sessionsAffected")}
          value={affected.toLocaleString()}
          sub={t("compaction.ofTotal", { total: data.totalSessions.toLocaleString() })}
          accent="text-violet-300"
        />
        <StatBox
          label={t("compaction.avgPerSession")}
          value={avgPerSession.toFixed(1)}
          accent="text-blue-300"
        />
        <StatBox
          label={t("compaction.peakSession")}
          value={peak.toLocaleString()}
          accent="text-emerald-400"
        />
      </div>

      {/* Histogram: sessions by compaction count */}
      <div className="w-full overflow-hidden">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          {t("compaction.distribution")}
        </p>
        <svg
          ref={svgRef}
          className="w-full"
          style={{ height: CHART_HEIGHT }}
          aria-label={t("compaction.ariaLabel")}
          role="img"
        />
      </div>

      {/* Plain-English summary + (when present) tokens freed */}
      <p className="text-xs text-gray-500 leading-relaxed">
        {t("compaction.summary", {
          affected: affected.toLocaleString(),
          total: data.totalSessions.toLocaleString(),
          pct: sessionPct,
        })}
        {data.tokensRecovered > 0 && (
          <> {t("compaction.tokensFreed", { tokens: fmtTokens(data.tokensRecovered) })}</>
        )}
      </p>

      {/* Hover tooltip (matches the app's other chart tooltips) */}
      {tip && (
        <div
          className="fixed z-50 pointer-events-none rounded-md border border-[#2a2a4a] bg-[#12121f] px-2.5 py-1.5 text-xs shadow-xl"
          style={{
            left: tip.x > window.innerWidth - 220 ? tip.x - 14 : tip.x + 14,
            top: tip.y - 10,
            transform: tip.x > window.innerWidth - 220 ? "translateX(-100%)" : undefined,
          }}
        >
          <div className="font-medium text-gray-100">{tip.title}</div>
          <div className="mt-0.5 text-gray-400">{tip.detail}</div>
        </div>
      )}
    </div>
  );
}
