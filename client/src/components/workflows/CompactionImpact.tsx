/**
 * @file CompactionImpact.tsx
 * @description Defines the CompactionImpact React component that visualizes the impact of compactions across sessions. It displays key statistics such as total compactions and tokens recovered, and renders a bar chart showing the distribution of compactions per session using D3.js. The component handles cases where no compactions are recorded and provides a clear summary of the data.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { CompactionImpactData } from "../../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Chart constants ───────────────────────────────────────────────────────────

const MARGIN = { top: 16, right: 16, bottom: 32, left: 36 };
const CHART_HEIGHT = 160;

// ── D3 renderer ───────────────────────────────────────────────────────────────

function renderBars(
  svg: SVGSVGElement,
  perSession: CompactionImpactData["perSession"],
  t: (key: string) => string
): void {
  const container = svg.parentElement;
  const width = container ? container.clientWidth : 400;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  // Sort descending by compaction count
  const sorted = [...perSession].sort((a, b) => b.compactions - a.compactions);

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

  const maxCount = d3.max(sorted, (d) => d.compactions) ?? 1;

  const xScale = d3
    .scaleBand()
    .domain(sorted.map((d) => d.session_id))
    .range([0, innerW])
    .padding(sorted.length > 20 ? 0.15 : 0.3);

  const yScale = d3.scaleLinear().domain([0, maxCount]).nice().range([innerH, 0]);

  // Grid lines
  const yTicks = yScale.ticks(4);
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

  // Y axis
  g.append("g")
    .call(
      d3
        .axisLeft(yScale)
        .ticks(4)
        .tickSize(0)
        .tickFormat((d) => (Number(d) % 1 === 0 ? String(d) : ""))
    )
    .call((ax) => ax.select(".domain").remove())
    .selectAll("text")
    .attr("fill", "#6b7280")
    .attr("font-size", 10)
    .attr("font-family", "Inter, sans-serif");

  // X axis label (sessions, not individual tick labels — too many)
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 28)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 10)
    .attr("font-family", "Inter, sans-serif")
    .text(`${sorted.length} ${t("compaction.sortedByCompaction")}`);

  // Bars
  sorted.forEach((d) => {
    const bx = xScale(d.session_id);
    if (bx === undefined) return;
    const bw = xScale.bandwidth();
    const barH = innerH - yScale(d.compactions);
    const by = yScale(d.compactions);

    const bg = g.append("g");

    bg.append("rect")
      .attr("x", bx)
      .attr("y", by)
      .attr("width", bw)
      .attr("height", barH)
      .attr("rx", Math.min(3, bw / 2))
      .attr("fill", "url(#compact-bar-grad)");

    // Show count label only when bars are wide enough
    if (bw >= 18 && d.compactions > 0) {
      bg.append("text")
        .attr("x", bx + bw / 2)
        .attr("y", by - 4)
        .attr("text-anchor", "middle")
        .attr("fill", "#a5b4fc")
        .attr("font-size", 9)
        .attr("font-weight", "600")
        .attr("font-family", "Inter, sans-serif")
        .text(d.compactions);
    }
  });
}

// ── Stat box ──────────────────────────────────────────────────────────────────

interface StatBoxProps {
  label: string;
  value: string;
  accent?: string;
}

function StatBox({ label, value, accent = "text-accent" }: StatBoxProps) {
  return (
    <div className="flex flex-col gap-1 bg-surface-3 border border-border rounded-xl px-5 py-4 flex-1 min-w-0">
      <span className={`text-2xl font-semibold tabular-nums ${accent}`}>{value}</span>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface CompactionImpactProps {
  data: CompactionImpactData;
}

export function CompactionImpact({ data }: CompactionImpactProps) {
  const { t } = useTranslation("workflows");
  const svgRef = useRef<SVGSVGElement>(null);

  const hasData = data.totalCompactions > 0;
  const sessionPct =
    data.totalSessions > 0
      ? Math.round((data.sessionsWithCompactions / data.totalSessions) * 100)
      : 0;

  useEffect(() => {
    if (!svgRef.current || !hasData) return;
    const nonZero = data.perSession.filter((s) => s.compactions > 0);
    renderBars(svgRef.current, nonZero, t);
  }, [data, hasData]);

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
      {/* Stat boxes */}
      <div className="flex gap-3">
        <StatBox
          label={t("compaction.totalCompactions")}
          value={data.totalCompactions.toLocaleString()}
          accent="text-accent-hover"
        />
        <StatBox
          label={t("compaction.tokensRecovered")}
          value={fmtTokens(data.tokensRecovered)}
          accent="text-emerald-400"
        />
      </div>

      {/* Bar chart */}
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

      {/* Summary line */}
      <p className="text-xs text-gray-500">{t("compaction.hadCompactions", { pct: sessionPct })}</p>
    </div>
  );
}
