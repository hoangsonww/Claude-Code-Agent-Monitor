/**
 * @file Analytics.tsx
 * @description Provides a comprehensive analytics dashboard for monitoring Claude Code sessions, agents, token usage, and events in real-time. Features include an activity heatmap, token distribution charts, session outcome breakdowns, and more, all with interactive tooltips and live updates via WebSocket.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback, useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  RefreshCw,
  Download,
  Zap,
  Bot,
  FolderOpen,
  Cpu,
  DollarSign,
  Clock,
  BarChart3,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { useDataScope } from "../lib/dataScope";
import { fmt, fmtCost, fmtCostFull, formatModelName } from "../lib/format";
import { Tip } from "../components/Tip";
import { Skeleton, StatValueSkeleton, TextSkeleton } from "../components/Skeleton";
import type { Analytics as AnalyticsData, CostResult } from "../lib/types";

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const nearRight = x > window.innerWidth - 200;
  return (
    <div
      className="fixed z-50 px-2 py-1.5 text-xs bg-[#12121f] border border-[#2a2a4a] rounded shadow-xl text-gray-200 pointer-events-none whitespace-nowrap"
      style={{
        left: nearRight ? x - 14 : x + 14,
        top: y - 10,
        transform: nearRight ? "translateX(-100%)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function useTooltip() {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  const show = (e: React.MouseEvent, content: React.ReactNode) => {
    setTooltip({ x: e.clientX, y: e.clientY, content });
  };
  const move = (e: React.MouseEvent) => {
    setTooltip((t) => t && { ...t, x: e.clientX, y: e.clientY });
  };
  const hide = () => setTooltip(null);

  const node = tooltip ? (
    <ChartTooltip x={tooltip.x} y={tooltip.y}>
      {tooltip.content}
    </ChartTooltip>
  ) : null;

  return { show, move, hide, node };
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

function cellColor(count: number, max: number) {
  if (count === 0) return "#161625";
  // Log scale + RGB interpolation across a wide color ramp for maximum perceptual range
  const t = Math.log(count + 1) / Math.log(Math.max(max, 1) + 1);
  // Ramp: near-black indigo → deep indigo → bright indigo → lavender
  type RGB = [number, number, number];
  const stops: RGB[] = [
    [22, 20, 60], // near-black indigo
    [55, 48, 163], // deep indigo
    [99, 102, 241], // bright indigo
    [199, 210, 254], // lavender
  ];
  const scaled = t * (stops.length - 1);
  const lo = Math.min(Math.floor(scaled), stops.length - 2);
  const frac = scaled - lo;
  const [r1, g1, b1]: RGB = stops[lo] as RGB;
  const [r2, g2, b2]: RGB = stops[lo + 1] as RGB;
  const r = Math.round(r1 + (r2 - r1) * frac);
  const g = Math.round(g1 + (g2 - g1) * frac);
  const b = Math.round(b1 + (b2 - b1) * frac);
  return `rgb(${r},${g},${b})`;
}

function Heatmap({ weeks }: { weeks: Array<Array<{ date: string; count: number }>> }) {
  const { show, move, hide, node } = useTooltip();
  const { t, i18n } = useTranslation(["analytics", "common"]);
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, month) =>
        new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2026, month, 1))
      ),
    [locale]
  );

  const dayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, day) =>
        new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
          new Date(2026, 0, 4 + day) // Jan 4, 2026 is Sunday
        )
      ),
    [locale]
  );

  // Labels on the left: Sun (0), Tue (2), Thu (4)
  const dayLabels = [dayNames[0], "", dayNames[2], "", dayNames[4], "", ""];
  const maxCount = Math.max(...weeks.flatMap((w) => w.map((c) => c.count)), 1);

  // Compute month label positions accurately. A label is ~3 columns wide (each
  // column is 16px, a 3-letter month ≈ 22px). The very first month is often a
  // stub - the 52-week window starts mid-month, so e.g. "May" sits at col 0 and
  // "Jun" at col 1 and they overlap. Drop the *stub* (the earlier, partial one)
  // rather than the full month after it, so the next label isn't pushed away.
  const monthPositions = useMemo(() => {
    const MIN_LABEL_GAP = 3; // columns a label needs to itself
    const starts: Array<{ label: string; col: number }> = [];
    let prevMonth = -1;

    weeks.forEach((week, wi) => {
      const firstCell = week[0];
      if (!firstCell) return;
      const parts = firstCell.date.split("-").map(Number);
      const m = (parts[1] || 1) - 1; // 0-indexed month
      if (m !== prevMonth) {
        starts.push({ label: monthLabels[m] ?? "", col: wi });
        prevMonth = m;
      }
    });

    // Drop a label when the *next* month starts too soon after it (it would
    // collide). Suppressing the earlier label leaves the later, full month in
    // place - no gap is introduced.
    return starts.filter((s, i) => {
      const next = starts[i + 1];
      return !next || next.col - s.col >= MIN_LABEL_GAP;
    });
  }, [weeks, monthLabels]);

  return (
    <div className="relative">
      {node}
      {/* Month labels */}
      <div className="flex mb-2 ml-[32px] relative h-4">
        {monthPositions.map((mp, i) => (
          <div
            key={i}
            className="absolute text-[10px] text-gray-600 font-medium whitespace-nowrap"
            style={{ left: mp.col * 16 }}
          >
            {mp.label}
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: "3px" }}>
        {/* Day labels */}
        <div className="flex flex-col mr-1 w-7" style={{ gap: "3px" }}>
          {dayLabels.map((d, i) => (
            <div
              key={i}
              className="text-[9px] text-gray-700 flex items-center justify-end pr-1.5"
              style={{ height: 13 }}
            >
              {d}
            </div>
          ))}
        </div>
        {/* Cells */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col" style={{ gap: "3px" }}>
            {week.map((cell) => (
              <div
                key={cell.date}
                onMouseEnter={(e) => {
                  const parts = cell.date.split("-").map(Number);
                  const y = parts[0] || 0;
                  const m = (parts[1] || 1) - 1;
                  const d = parts[2] || 1;
                  const date = new Date(y, m, d, 12);
                  const dow = date.getDay();
                  show(
                    e,
                    <>
                      <span className="text-gray-400">
                        {dayNames[dow] ?? ""}, {cell.date}
                      </span>
                      <span className="ml-2 font-medium">
                        {t("eventCountLabel", { count: cell.count })}
                      </span>
                    </>
                  );
                }}
                onMouseMove={move}
                onMouseLeave={hide}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 2,
                  backgroundColor: cellColor(cell.count, maxCount),
                  border: "1px solid rgba(255,255,255,0.04)",
                  flexShrink: 0,
                  cursor: "default",
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 text-[11px] text-gray-600">
        <span>{t("less")}</span>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = Math.round(f * maxCount);
          return (
            <div
              key={f}
              style={{
                width: 13,
                height: 13,
                borderRadius: 2,
                backgroundColor: cellColor(v, maxCount),
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
          );
        })}
        <span>{t("more")}</span>
      </div>
    </div>
  );
}

// ── Sparkline bar chart ───────────────────────────────────────────────────────

function Sparkline({
  data,
  color = "#6366f1",
}: {
  data: Array<{ date: string; count: number }>;
  color?: string;
}) {
  const { t } = useTranslation("analytics");
  const { show, move, hide, node } = useTooltip();
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="relative flex items-end gap-px h-16">
      {node}
      {data.map(({ date, count }) => (
        <div
          key={date}
          className="flex-1 rounded-sm transition-all cursor-default"
          style={{
            height: `${Math.max(4, Math.round((count / max) * 100))}%`,
            backgroundColor: color,
            opacity: count === 0 ? 0.15 : 0.85,
          }}
          onMouseEnter={(e) =>
            show(
              e,
              <>
                <span className="text-gray-400">{date}</span>
                <span className="ml-2 font-medium">{t("eventCountLabel", { count })}</span>
              </>
            )
          }
          onMouseMove={move}
          onMouseLeave={hide}
        />
      ))}
    </div>
  );
}

function CostTrendLine({
  data,
  color = "#10b981",
}: {
  data: Array<{ date: string; cost: number }>;
  color?: string;
}) {
  const { show, move, hide, node } = useTooltip();
  if (data.length === 0) return null;

  const width = 320;
  const height = 88;
  const padX = 8;
  const padY = 8;
  const min = Math.min(...data.map((d) => d.cost), 0);
  const max = Math.max(...data.map((d) => d.cost), 0);
  const span = Math.max(max - min, 0.0001);
  const step = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

  const points = data.map(({ date, cost }, i) => {
    const x = padX + i * step;
    const y = height - padY - ((cost - min) / span) * (height - padY * 2);
    return { date, cost, x, y };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const firstX = points[0]?.x ?? padX;
  const lastX = points[points.length - 1]?.x ?? padX;
  const areaPoints = `${firstX},${height - padY} ${linePoints} ${lastX},${height - padY}`;

  return (
    <div className="relative">
      {node}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[88px] overflow-visible">
        <defs>
          <linearGradient id="daily-cost-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <polyline points={areaPoints} fill="url(#daily-cost-fill)" stroke="none" />
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point) => (
          <g key={point.date}>
            <circle
              cx={point.x}
              cy={point.y}
              r={2.5}
              fill={color}
              style={{ pointerEvents: "none" }}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={8}
              fill="transparent"
              onMouseEnter={(e) =>
                show(
                  e,
                  <>
                    <span className="text-gray-400">{point.date}</span>
                    <span className="ml-2 font-medium">{fmtCostFull(point.cost)}</span>
                  </>
                )
              }
              onMouseMove={move}
              onMouseLeave={hide}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Bar row ───────────────────────────────────────────────────────────────────

function BarRow({
  label,
  count,
  max,
  color = "bg-accent",
  pct,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
  pct?: number;
}) {
  const width = pct !== undefined ? pct : max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-28 truncate flex-shrink-0" title={label}>
        {label}
      </span>
      <div className="flex-1 bg-surface-3 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <Tip raw={count.toLocaleString()}>
        <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">{fmt(count)}</span>
      </Tip>
    </div>
  );
}

function CostBarRow({
  label,
  cost,
  max,
  color = "bg-emerald-400",
}: {
  label: string;
  cost: number;
  max: number;
  color?: string;
}) {
  const width = max > 0 ? Math.max(2, Math.round((cost / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-24 truncate flex-shrink-0" title={label}>
        {label}
      </span>
      <div className="flex-1 bg-surface-3 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-emerald-400 font-mono w-16 text-right flex-shrink-0">
        <Tip raw={fmtCostFull(cost)}>{fmtCost(cost)}</Tip>
      </span>
    </div>
  );
}

// ── Donut segment via SVG ─────────────────────────────────────────────────────

function DonutChart({
  segments,
  formatTotal,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  formatTotal?: (total: number) => string;
}) {
  const { t } = useTranslation(["analytics", "common"]);
  const { show, move, hide, node } = useTooltip();
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return <div className="text-xs text-gray-500">{t("common:noData")}</div>;

  const r = 52;
  const cx = 64;
  const cy = 64;
  const stroke = 18;
  const circumference = 2 * Math.PI * r;

  // offset starts at circumference/4 (top of circle) and decrements by each segment's arc.
  // strokeDashoffset = offset (not negated) is the correct formula for starting at 12 o'clock.
  let offset = circumference / 4;
  return (
    <div className="flex items-center justify-center gap-6 w-full">
      {node}
      <svg width={128} height={128} viewBox="0 0 128 128" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e2e" strokeWidth={stroke} />
        {segments.map(({ label, value, color }, i) => {
          const dash = (value / total) * circumference;
          const gap = circumference - dash;
          const pct = Math.round((value / total) * 100);
          const currentOffset = offset;
          offset -= dash;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={currentOffset}
              style={{ cursor: "default" }}
              onMouseEnter={(e) =>
                show(
                  e,
                  <>
                    <span style={{ color }}>{label}</span>
                    <span className="ml-2 font-medium">{pct}%</span>
                  </>
                )
              }
              onMouseMove={move}
              onMouseLeave={hide}
            />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-300" fontSize={11}>
          {(formatTotal ?? fmt)(total)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-600" fontSize={9}>
          {t("common:total_lower")}
        </text>
      </svg>
      <div className="space-y-2">
        {segments.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-400">{label}</span>
            <span className="text-gray-500 ml-auto pl-4">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  raw,
  sub,
  icon: Icon,
  color = "text-accent",
  loading = false,
}: {
  label: string;
  value: string | number;
  raw?: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      {loading ? (
        <StatValueSkeleton />
      ) : (
        <p className={`text-2xl font-bold ${color}`}>
          {raw ? <Tip raw={raw}>{value}</Tip> : value}
        </p>
      )}
      {loading ? (
        <TextSkeleton width="w-20" />
      ) : (
        sub && <p className="text-[11px] text-gray-500">{sub}</p>
      )}
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────

/** A single chart-card placeholder: title bar, chart body, two footer lines.
 *  Uses the shared pulsing <Skeleton> so the whole grid shimmers while data
 *  loads (mirrors the chart-card layout so nothing jumps when data arrives). */
function ChartCardSkeleton({
  className = "",
  bodyH = "h-32",
}: {
  className?: string;
  bodyH?: string;
}) {
  return (
    <div className={`card p-5 space-y-4 ${className}`} aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className={`block w-full ${bodyH}`} rounded="lg" />
      <div className="space-y-2 pt-1">
        <Skeleton className="block h-3 w-2/3" />
        <Skeleton className="block h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Pulsing placeholder for the Analytics chart region (heatmap + sparkline row,
 *  tab bar, and the three-up chart grid) shown while the analytics payload is
 *  still being fetched. */
function AnalyticsChartsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics charts">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCardSkeleton className="lg:col-span-2" bodyH="h-32" />
        <ChartCardSkeleton bodyH="h-32" />
      </div>
      <Skeleton className="block h-9 w-80" rounded="lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ChartCardSkeleton bodyH="h-44" />
        <ChartCardSkeleton bodyH="h-44" />
        <ChartCardSkeleton bodyH="h-44" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Analytics() {
  const { t, i18n } = useTranslation("analytics");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [costData, setCostData] = useState<CostResult | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tokens" | "cost" | "workflow" | "productivity">(
    "cost"
  );
  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);
  // Global data scope; a change re-runs `load` (api injects the `sources` param).
  const [scope] = useDataScope();

  const load = useCallback(async () => {
    try {
      const [result, cost] = await Promise.all([
        api.analytics.get(),
        api.pricing.totalCost().catch(() => null),
      ]);
      setData(result);
      setCostData(cost);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (
        msg.type === "session_created" ||
        msg.type === "session_updated" ||
        msg.type === "new_event" ||
        msg.type === "agent_created" ||
        msg.type === "remote_source.status" ||
        (msg.type === "import.progress" && (msg.data as { phase?: string })?.phase === "complete")
      ) {
        load();
      }
    });
  }, [load]);

  function handleExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Format a local Date object as a YYYY-MM-DD string for heatmap lookups
  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Server now returns dates grouped by the user's local timezone (via tz_offset),
  // so we can use them directly without conversion.
  const dailyMap: Record<string, number> = {};
  for (const d of data?.daily_events ?? []) {
    dailyMap[d.date] = (dailyMap[d.date] ?? 0) + d.count;
  }

  // Build heatmap: 52 weeks × 7 days
  // Align start to Sunday (day 0) so row indices match day-of-week labels correctly.
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Normalize to noon

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 364); // Exactly 52 weeks ago
  // Roll back to the previous Sunday
  const startDow = startDate.getDay();
  startDate.setDate(startDate.getDate() - startDow);

  const weeks: Array<Array<{ date: string; count: number }>> = [];
  for (let w = 0; w < 53; w++) {
    const week: Array<{ date: string; count: number }> = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(startDate);
      cell.setDate(startDate.getDate() + w * 7 + d);
      if (cell > today) break;
      const dateStr = localDateStr(cell);
      week.push({ date: dateStr, count: dailyMap[dateStr] ?? 0 });
    }
    if (week.length > 0) weeks.push(week);
  }

  // Last 30 days for sparkline
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    const dateStr = localDateStr(d);
    return { date: dateStr, count: dailyMap[dateStr] ?? 0 };
  });

  // Convert daily_sessions - server already returns local dates
  const dailySessionsLocal: Array<{ date: string; count: number }> = [];
  const sessMap: Record<string, number> = {};
  for (const d of data?.daily_sessions ?? []) {
    sessMap[d.date] = (sessMap[d.date] ?? 0) + d.count;
  }
  for (const [date, count] of Object.entries(sessMap)) {
    dailySessionsLocal.push({ date, count });
  }
  dailySessionsLocal.sort((a, b) => a.date.localeCompare(b.date));

  // Convert daily_costs - server already returns local dates
  const dailyCostsLocal: Array<{ date: string; cost: number }> = [];
  const costMap: Record<string, number> = {};
  for (const d of costData?.daily_costs ?? []) {
    costMap[d.date] = (costMap[d.date] ?? 0) + d.cost;
  }
  for (const [date, cost] of Object.entries(costMap)) {
    dailyCostsLocal.push({ date, cost });
  }
  dailyCostsLocal.sort((a, b) => a.date.localeCompare(b.date));

  const dailyCostLast30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (29 - i));
    const dateStr = localDateStr(d);
    return { date: dateStr, cost: costMap[dateStr] ?? 0 };
  });
  const peakCostDay = dailyCostLast30.reduce(
    (max, curr) => (curr.cost > max.cost ? curr : max),
    dailyCostLast30[0] ?? { date: "", cost: 0 }
  );
  const totalCost30d = dailyCostLast30.reduce((sum, day) => sum + day.cost, 0);
  const costBreakdown = [...(costData?.breakdown ?? [])]
    .filter((b) => b.cost > 0)
    .sort((a, b) => b.cost - a.cost);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayCosts = weekdayOrder.map((dow) => {
    const label = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
      new Date(Date.UTC(2026, 0, 4 + dow))
    );
    const cost = dailyCostLast30
      .filter((day) => new Date(day.date + "T12:00:00").getDay() === dow)
      .reduce((sum, day) => sum + day.cost, 0);
    return { label, cost };
  });
  const maxWeekdayCost = Math.max(...weekdayCosts.map((d) => d.cost), 1);

  const totalTokens =
    (data?.tokens.total_input ?? 0) +
    (data?.tokens.total_output ?? 0) +
    (data?.tokens.total_cache_read ?? 0) +
    (data?.tokens.total_cache_write ?? 0);
  const tokenMixSegments = [
    { label: t("common:token.input"), value: data?.tokens.total_input ?? 0, color: "#60a5fa" },
    { label: t("common:token.output"), value: data?.tokens.total_output ?? 0, color: "#34d399" },
    {
      label: t("common:token.cacheRead"),
      value: data?.tokens.total_cache_read ?? 0,
      color: "#a78bfa",
    },
    {
      label: t("common:token.cacheWrite"),
      value: data?.tokens.total_cache_write ?? 0,
      color: "#facc15",
    },
  ].filter((s) => s.value > 0);

  const maxToolCount = data?.tool_usage[0]?.count ?? 1;
  const maxAgentTypeCount = data?.agent_types[0]?.count ?? 1;
  const maxEventTypeCount = data?.event_types[0]?.count ?? 1;

  const cacheHitPct =
    totalTokens > 0 ? Math.round(((data?.tokens.total_cache_read ?? 0) / totalTokens) * 100) : 0;

  const sessionOutcomeSegments = [
    {
      label: t("common:status.completed"),
      value: data?.sessions_by_status?.completed ?? 0,
      color: "#8b5cf6",
    },
    {
      label: t("common:status.active"),
      value: data?.sessions_by_status?.active ?? 0,
      color: "#10b981",
    },
    {
      label: t("common:status.error"),
      value: data?.sessions_by_status?.error ?? 0,
      color: "#ef4444",
    },
    {
      label: t("common:status.abandoned"),
      value: data?.sessions_by_status?.abandoned ?? 0,
      color: "#f59e0b",
    },
  ].filter((s) => s.value > 0);

  const agentStatusSegments = [
    {
      label: t("common:status.completed"),
      value: data?.agents_by_status?.completed ?? 0,
      color: "#8b5cf6",
    },
    {
      label: t("common:status.working"),
      value: data?.agents_by_status?.working ?? 0,
      color: "#10b981",
    },
    {
      label: t("common:status.waiting"),
      value: data?.agents_by_status?.waiting ?? 0,
      color: "#eab308",
    },
    {
      label: t("common:status.error"),
      value: data?.agents_by_status?.error ?? 0,
      color: "#ef4444",
    },
  ].filter((s) => s.value > 0);

  const EVENT_TYPE_COLORS: Record<string, string> = {
    PreToolUse: "bg-emerald-400",
    PostToolUse: "bg-blue-400",
    Stop: "bg-violet-400",
    SubagentStop: "bg-yellow-400",
    Notification: "bg-orange-400",
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
              <BarChart3 className="w-4.5 h-4.5 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
                {wsConnected ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                    {t("common:live")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                    {t("common:offline")}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                {t("subtitle")}
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 bg-surface-2 border border-border px-2 py-0.5 rounded-md font-mono ml-2">
                  <Clock className="w-3 h-3" />
                  {lastUpdate.toLocaleTimeString()}
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("common:refresh")}
          </button>
          <button onClick={handleExport} className="btn-ghost" disabled={!data}>
            <Download className="w-4 h-4" />
            {t("export")}
          </button>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatPill
          label={t("totalSessions")}
          value={data ? fmt(data.overview.total_sessions) : ""}
          raw={data ? data.overview.total_sessions.toLocaleString() : undefined}
          sub={data ? `${data.overview.active_sessions} ${t("common:active")}` : undefined}
          icon={FolderOpen}
          color="text-blue-400"
          loading={!data}
        />
        <StatPill
          label={t("totalAgents")}
          value={data ? fmt(data.overview.total_agents) : ""}
          raw={data ? data.overview.total_agents.toLocaleString() : undefined}
          sub={data ? `${data.overview.active_agents} ${t("common:active")}` : undefined}
          icon={Bot}
          color="text-emerald-400"
          loading={!data}
        />
        <StatPill
          label={t("totalTokens")}
          value={data ? fmt(totalTokens) : ""}
          raw={data ? totalTokens.toLocaleString() : undefined}
          sub={data ? `${cacheHitPct}${t("cacheHitRate")}` : undefined}
          icon={Cpu}
          color="text-violet-400"
          loading={!data}
        />
        <StatPill
          label={t("totalCost")}
          value={costData ? fmtCost(costData.total_cost) : ""}
          raw={costData ? fmtCostFull(costData.total_cost) : undefined}
          sub={
            costData
              ? `${costData.breakdown.length} ${t("common:cost.model", { count: costData.breakdown.length })}`
              : undefined
          }
          icon={DollarSign}
          color="text-emerald-400"
          loading={!costData}
        />
        <StatPill
          label={t("totalEvents")}
          value={data ? fmt(data.overview.total_events) : ""}
          raw={data ? data.overview.total_events.toLocaleString() : undefined}
          sub={data ? `~${data.avg_events_per_session}${t("perSession")}` : undefined}
          icon={Zap}
          color="text-yellow-400"
          loading={!data}
        />
      </div>

      {!data ? (
        <AnalyticsChartsSkeleton />
      ) : (
        <>
          {/* Activity heatmap + 30-day sparkline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-5 lg:col-span-2">
              <h3 className="text-sm font-medium text-gray-300 mb-4">{t("eventActivity")}</h3>
              <div className="overflow-x-auto">
                <div className="w-fit min-w-max mx-auto">
                  <Heatmap weeks={weeks} />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-1">{t("last30Days")}</h3>
              <p className="text-[11px] text-gray-600 mb-4">{t("dailyEventCount")}</p>
              <Sparkline data={last30} />
              <div className="flex justify-between text-[11px] text-gray-600 mt-2">
                <span>{last30[0]?.date?.slice(5)}</span>
                <span>{last30[last30.length - 1]?.date?.slice(5)}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-border space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("peakDay")}</span>
                  <span className="text-gray-300 font-mono">
                    <Tip raw={Math.max(...last30.map((d) => d.count)).toLocaleString()}>
                      {fmt(Math.max(...last30.map((d) => d.count)))}
                    </Tip>{" "}
                    {t("common:events")}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("total30d")}</span>
                  <span className="text-gray-300 font-mono">
                    <Tip raw={last30.reduce((s, d) => s + d.count, 0).toLocaleString()}>
                      {fmt(last30.reduce((s, d) => s + d.count, 0))}
                    </Tip>{" "}
                    {t("common:events")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div>
            <div className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-6 w-fit">
              {(
                [
                  { key: "cost" as const, label: t("tabs.costAnalytics") },
                  { key: "tokens" as const, label: t("tabs.tokenAnalytics") },
                  { key: "productivity" as const, label: t("tabs.productivityAnalytics") },
                  { key: "workflow" as const, label: t("tabs.workflowIntelligence") },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === key
                      ? "bg-surface-4 text-gray-200"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "tokens" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Token bars */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">
                    {t("tokenDistribution")}
                  </h3>
                  <div className="space-y-4">
                    {[
                      {
                        label: t("common:token.input"),
                        value: data?.tokens.total_input ?? 0,
                        color: "bg-blue-400",
                      },
                      {
                        label: t("common:token.output"),
                        value: data?.tokens.total_output ?? 0,
                        color: "bg-emerald-400",
                      },
                      {
                        label: t("common:token.cacheRead"),
                        value: data?.tokens.total_cache_read ?? 0,
                        color: "bg-violet-400",
                      },
                      {
                        label: t("common:token.cacheWrite"),
                        value: data?.tokens.total_cache_write ?? 0,
                        color: "bg-yellow-400",
                      },
                    ].map(({ label, value, color }) => (
                      <BarRow
                        key={label}
                        label={label}
                        count={value}
                        max={Math.max(totalTokens, 1)}
                        color={color}
                      />
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t("common:token.totalTokens")}</span>
                      <Tip raw={totalTokens.toLocaleString()}>
                        <span className="text-gray-300 font-mono">{fmt(totalTokens)}</span>
                      </Tip>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t("cacheEfficiency")}</span>
                      <span className="text-violet-400 font-mono">{cacheHitPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Token summary */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("tokenBreakdown")}</h3>
                  <div className="space-y-3">
                    {[
                      {
                        label: t("common:token.input"),
                        value: data?.tokens.total_input ?? 0,
                        color: "text-blue-400",
                      },
                      {
                        label: t("common:token.output"),
                        value: data?.tokens.total_output ?? 0,
                        color: "text-emerald-400",
                      },
                      {
                        label: t("common:token.cacheRead"),
                        value: data?.tokens.total_cache_read ?? 0,
                        color: "text-violet-400",
                      },
                      {
                        label: t("common:token.cacheWrite"),
                        value: data?.tokens.total_cache_write ?? 0,
                        color: "text-yellow-400",
                      },
                      { label: t("common:total"), value: totalTokens, color: "text-gray-100" },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        className="flex justify-between items-center py-2 border-b border-border last:border-0"
                      >
                        <span className="text-xs text-gray-400">{label}</span>
                        <span className={`text-sm font-mono font-medium ${color}`}>
                          {value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  {totalTokens === 0 && (
                    <p className="text-[11px] text-gray-600 mt-4">{t("tokenInfo")}</p>
                  )}
                </div>

                {/* Token mix donut */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("tokenMix")}</h3>
                  {tokenMixSegments.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("common:noData")}</p>
                  ) : (
                    <>
                      <DonutChart segments={tokenMixSegments} formatTotal={(total) => fmt(total)} />
                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        {tokenMixSegments.map((segment) => (
                          <div key={segment.label} className="flex justify-between text-xs">
                            <span className="text-gray-400">{segment.label}</span>
                            <span className="text-gray-300 font-mono">
                              <Tip raw={segment.value.toLocaleString()}>{fmt(segment.value)}</Tip>
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === "cost" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Daily cost trends */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-1">{t("dailyCostTrends")}</h3>
                  {dailyCostsLocal.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("noDailyCostData")}</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-gray-600 mb-4">{t("costPerDay")}</p>
                      <CostTrendLine data={dailyCostLast30} />
                      <div className="flex justify-between text-[11px] text-gray-600 mt-2">
                        <span>{dailyCostLast30[0]?.date?.slice(5)}</span>
                        <span>{dailyCostLast30[dailyCostLast30.length - 1]?.date?.slice(5)}</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-border space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">{t("peakCostDay")}</span>
                          <span className="text-emerald-400 font-mono">
                            <Tip raw={`${peakCostDay.date} • ${fmtCostFull(peakCostDay.cost)}`}>
                              {fmtCost(peakCostDay.cost)}
                            </Tip>
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">{t("totalCost30d")}</span>
                          <span className="text-emerald-400 font-mono">
                            <Tip raw={fmtCostFull(totalCost30d)}>{fmtCost(totalCost30d)}</Tip>
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Cost by model */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("costByModel")}</h3>
                  {costBreakdown.length > 0 ? (
                    <>
                      <DonutChart
                        segments={costBreakdown.map((b, i) => ({
                          label: formatModelName(b.model) ?? b.model,
                          value: Math.round(b.cost * 100),
                          color:
                            ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"][
                              i % 6
                            ] ?? "#6b7280",
                        }))}
                        formatTotal={(cents) => fmtCost(cents / 100)}
                      />
                      <div className="mt-4 pt-4 border-t border-border space-y-2">
                        {costBreakdown.map((b) => (
                          <div key={b.model} className="flex justify-between text-xs">
                            <span className="text-gray-400 font-mono truncate">
                              {formatModelName(b.model)}
                            </span>
                            <span className="text-emerald-400 font-mono font-medium ml-2">
                              <Tip raw={fmtCostFull(b.cost)}>{fmtCost(b.cost)}</Tip>
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs pt-2 border-t border-border">
                          <span className="text-gray-300 font-medium">{t("common:total")}</span>
                          <span className="text-emerald-400 font-mono font-semibold">
                            <Tip raw={fmtCostFull(costData?.total_cost ?? 0)}>
                              {fmtCost(costData?.total_cost ?? 0)}
                            </Tip>
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">{t("noCostData")}</p>
                  )}
                </div>

                {/* Cost by weekday */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-1">{t("costByWeekday")}</h3>
                  {dailyCostsLocal.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("noDailyCostData")}</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-gray-600 mb-4">{t("last30Days")}</p>
                      <div className="space-y-3">
                        {weekdayCosts.map(({ label, cost }) => (
                          <CostBarRow
                            key={label}
                            label={label}
                            cost={cost}
                            max={maxWeekdayCost}
                            color="bg-cyan-400"
                          />
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-border text-xs flex justify-between">
                        <span className="text-gray-500">{t("common:total")}</span>
                        <span className="text-cyan-400 font-mono">
                          <Tip raw={fmtCostFull(totalCost30d)}>{fmtCost(totalCost30d)}</Tip>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === "workflow" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Agent type distribution */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("subagentTypes")}</h3>
                  {(data?.agent_types ?? []).length === 0 ? (
                    <p className="text-sm text-gray-500">{t("noSubagentData")}</p>
                  ) : (
                    <div className="space-y-3">
                      {(data?.agent_types ?? []).slice(0, 10).map(({ subagent_type, count }) => (
                        <BarRow
                          key={subagent_type}
                          label={subagent_type}
                          count={count}
                          max={maxAgentTypeCount}
                          color="bg-violet-400"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Agent status donut */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("agentStatus")}</h3>
                  <DonutChart segments={agentStatusSegments} />
                  <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t("totalAgentsLabel")}</span>
                      <Tip raw={(data?.overview.total_agents ?? 0).toLocaleString()}>
                        <span className="text-gray-300 font-mono">
                          {fmt(data?.overview.total_agents ?? 0)}
                        </span>
                      </Tip>
                    </div>
                    {agentStatusSegments.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between text-xs text-gray-500"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.label}
                        </span>
                        <Tip raw={s.value.toLocaleString()}>
                          <span className="text-gray-400 font-mono">{fmt(s.value)}</span>
                        </Tip>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Event type breakdown */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("eventTypes")}</h3>
                  {(data?.event_types ?? []).length === 0 ? (
                    <p className="text-sm text-gray-500">{t("noEventData")}</p>
                  ) : (
                    <div className="space-y-3">
                      {(data?.event_types ?? []).map(({ event_type, count }) => (
                        <BarRow
                          key={event_type}
                          label={event_type}
                          count={count}
                          max={maxEventTypeCount}
                          color={EVENT_TYPE_COLORS[event_type] ?? "bg-gray-400"}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "productivity" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Top tools */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("toolUsage")}</h3>
                  {(data?.tool_usage ?? []).length === 0 ? (
                    <p className="text-sm text-gray-500">{t("noToolData")}</p>
                  ) : (
                    <div className="space-y-3">
                      {(data?.tool_usage ?? []).slice(0, 12).map(({ tool_name, count }) => (
                        <BarRow
                          key={tool_name}
                          label={tool_name}
                          count={count}
                          max={maxToolCount}
                          color="bg-yellow-400"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Session outcomes donut */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">{t("sessionOutcomes")}</h3>
                  <DonutChart segments={sessionOutcomeSegments} />
                  <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{t("totalSessionsLabel")}</span>
                      <Tip raw={(data?.overview.total_sessions ?? 0).toLocaleString()}>
                        <span className="text-gray-300 font-mono">
                          {fmt(data?.overview.total_sessions ?? 0)}
                        </span>
                      </Tip>
                    </div>
                    {sessionOutcomeSegments.map((s) => (
                      <div
                        key={s.label}
                        className="flex items-center justify-between text-xs text-gray-500"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.label}
                        </span>
                        <Tip raw={s.value.toLocaleString()}>
                          <span className="text-gray-400 font-mono">{fmt(s.value)}</span>
                        </Tip>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily session trends */}
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-300 mb-5">
                    {t("dailySessionTrends")}
                  </h3>
                  {dailySessionsLocal.length === 0 ? (
                    <p className="text-sm text-gray-500">{t("noSessionTrendData")}</p>
                  ) : (
                    <>
                      <Sparkline data={dailySessionsLocal.slice(-30)} color="#6366f1" />
                      <div className="mt-4 space-y-2">
                        {dailySessionsLocal
                          .slice(-7)
                          .reverse()
                          .map(({ date, count }) => {
                            const maxD = Math.max(
                              ...(dailySessionsLocal.length > 0
                                ? dailySessionsLocal
                                : [{ count: 1 }]
                              ).map((d) => d.count)
                            );
                            return (
                              <div key={date} className="flex items-center gap-3">
                                <span className="text-[11px] text-gray-500 font-mono w-20 flex-shrink-0">
                                  {date.slice(5)}
                                </span>
                                <div className="flex-1 bg-surface-3 rounded-full h-1.5">
                                  <div
                                    className="bg-accent h-1.5 rounded-full"
                                    style={{
                                      width: `${Math.round((count / Math.max(maxD, 1)) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-[11px] text-gray-500 w-4 text-right">
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-[11px] text-gray-600 mt-3">{t("last7Days")}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
