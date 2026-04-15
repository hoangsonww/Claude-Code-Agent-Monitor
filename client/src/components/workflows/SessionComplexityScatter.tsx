/**
 * @file SessionComplexityScatter.tsx
 * @description A React component that renders a scatter plot visualization of session complexity using D3.js. Each session is represented as a bubble, where the x-axis represents the session duration, the y-axis represents the number of agents involved, and the size of the bubble corresponds to the total tokens used. The color of each bubble indicates the session status (e.g., completed, active, error, abandoned). The component also includes tooltips for detailed information on hover and a legend for status colors. It is designed to be responsive and provides an empty state when no data is available.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import type { SessionComplexityItem } from "../../lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN = { top: 20, right: 24, bottom: 60, left: 52 };
const MIN_BUBBLE_R = 4;
const MAX_BUBBLE_R = 32;

const STATUS_COLOR: Record<string, string> = {
  completed: "#22c55e",
  error: "#ef4444",
  active: "#6366f1",
  abandoned: "#eab308",
};

function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? "#6b7280";
}

// ── Duration formatting ───────────────────────────────────────────────────────

function formatDurationSec(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.round(sec % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtXTick(sec: number): string {
  if (sec === 0) return "0";
  if (sec < 60) return `${Math.round(sec)}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ""}`;
  return `${m}m`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  item: SessionComplexityItem;
}

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
            {t("complexity.tooltip.model")} {state.item.model}
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

const LEGEND_STATUSES = ["completed", "active", "error", "abandoned"] as const;

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

export interface SessionComplexityScatterProps {
  data: SessionComplexityItem[];
  onSessionClick?: (id: string) => void;
}

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

    // Bubbles — sort largest to back so small ones are clickable
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
    <div ref={containerRef} className="w-full" onMouseLeave={handleMouseLeave}>
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
