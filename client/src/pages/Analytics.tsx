import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { RefreshCw, Download, Zap, Bot, FolderOpen, Cpu, DollarSign, Clock } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { fmt, fmtCost } from "../lib/format";
import { Tip } from "../components/Tip";
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

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

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
  const maxCount = Math.max(...weeks.flatMap((w) => w.map((c) => c.count)), 1);

  // Compute month label positions (which week index a month starts)
  const monthPositions: Array<{ label: string; col: number }> = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const firstCell = week[0];
    if (!firstCell) return;
    const m = new Date(firstCell.date + "T12:00:00").getMonth();
    if (m !== lastMonth) {
      monthPositions.push({ label: MONTH_LABELS[m] ?? "", col: wi });
      lastMonth = m;
    }
  });

  return (
    <div>
      {node}
      {/* Month labels */}
      <div className="flex mb-1 ml-7" style={{ gap: "3px" }}>
        {weeks.map((_, wi) => {
          const mp = monthPositions.find((m) => m.col === wi);
          return (
            <div key={wi} className="text-[10px] text-gray-600 flex-shrink-0" style={{ width: 13 }}>
              {mp ? mp.label : ""}
            </div>
          );
        })}
      </div>
      <div className="flex" style={{ gap: "3px" }}>
        {/* Day labels */}
        <div className="flex flex-col mr-1" style={{ gap: "3px" }}>
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-[10px] text-gray-600 flex items-center"
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
                onMouseEnter={(e) =>
                  show(
                    e,
                    <>
                      <span className="text-gray-400">{cell.date}</span>
                      <span className="ml-2 font-medium">
                        {cell.count} event{cell.count !== 1 ? "s" : ""}
                      </span>
                    </>
                  )
                }
                onMouseMove={move}
                onMouseLeave={hide}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 2,
                  backgroundColor: cellColor(cell.count, maxCount),
                  border: "1px solid rgba(255,255,255,0.06)",
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
        <span>Less</span>
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
        <span>More</span>
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
                <span className="ml-2 font-medium">{count} events</span>
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

// ── Donut segment via SVG ─────────────────────────────────────────────────────

function DonutChart({
  segments,
  formatTotal,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  formatTotal?: (total: number) => string;
}) {
  const { show, move, hide, node } = useTooltip();
  const total = segments.reduce((s, g) => s + g.value, 0);
  if (total === 0) return <div className="text-xs text-gray-500">No data</div>;

  const r = 52;
  const cx = 64;
  const cy = 64;
  const stroke = 18;
  const circumference = 2 * Math.PI * r;

  // offset starts at circumference/4 (top of circle) and decrements by each segment's arc.
  // strokeDashoffset = offset (not negated) is the correct formula for starting at 12 o'clock.
  let offset = circumference / 4;
  return (
    <div className="flex items-center gap-6">
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
          total
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
}: {
  label: string;
  value: string | number;
  raw?: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{raw ? <Tip raw={raw}>{value}</Tip> : value}</p>
      {sub && <p className="text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [costData, setCostData] = useState<CostResult | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tokens" | "workflow" | "productivity">("tokens");
  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

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
  }, []);

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
        msg.type === "agent_created"
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

  // Local date string helper — avoids UTC offset issues where toISOString()
  // can show tomorrow's date if the user is behind UTC.
  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Server returns UTC dates — reindex events by local date so the heatmap
  // and sparkline align with the user's calendar.
  const dailyMap: Record<string, number> = {};
  for (const d of data?.daily_events ?? []) {
    // d.date is "YYYY-MM-DD" in UTC — parse as noon UTC to avoid DST edge cases,
    // then convert to local date string
    const local = localDateStr(new Date(d.date + "T12:00:00Z"));
    dailyMap[local] = (dailyMap[local] ?? 0) + d.count;
  }

  // Build heatmap: 52 weeks × 7 days
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 363);

  const weeks: Array<Array<{ date: string; count: number }>> = [];
  for (let w = 0; w < 52; w++) {
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

  // Convert daily_sessions from UTC to local dates
  const dailySessionsLocal: Array<{ date: string; count: number }> = [];
  const sessMap: Record<string, number> = {};
  for (const d of data?.daily_sessions ?? []) {
    const local = localDateStr(new Date(d.date + "T12:00:00Z"));
    sessMap[local] = (sessMap[local] ?? 0) + d.count;
  }
  for (const [date, count] of Object.entries(sessMap)) {
    dailySessionsLocal.push({ date, count });
  }
  dailySessionsLocal.sort((a, b) => a.date.localeCompare(b.date));

  const totalTokens =
    (data?.tokens.total_input ?? 0) +
    (data?.tokens.total_output ?? 0) +
    (data?.tokens.total_cache_read ?? 0) +
    (data?.tokens.total_cache_write ?? 0);

  const maxToolCount = data?.tool_usage[0]?.count ?? 1;
  const maxAgentTypeCount = data?.agent_types[0]?.count ?? 1;
  const maxEventTypeCount = data?.event_types[0]?.count ?? 1;

  const cacheHitPct =
    totalTokens > 0 ? Math.round(((data?.tokens.total_cache_read ?? 0) / totalTokens) * 100) : 0;

  const sessionOutcomeSegments = [
    { label: "Completed", value: data?.sessions_by_status?.completed ?? 0, color: "#8b5cf6" },
    { label: "Active", value: data?.sessions_by_status?.active ?? 0, color: "#10b981" },
    { label: "Error", value: data?.sessions_by_status?.error ?? 0, color: "#ef4444" },
    { label: "Abandoned", value: data?.sessions_by_status?.abandoned ?? 0, color: "#f59e0b" },
  ].filter((s) => s.value > 0);

  const agentStatusSegments = [
    { label: "Completed", value: data?.agents_by_status?.completed ?? 0, color: "#8b5cf6" },
    { label: "Working", value: data?.agents_by_status?.working ?? 0, color: "#10b981" },
    { label: "Connected", value: data?.agents_by_status?.connected ?? 0, color: "#3b82f6" },
    { label: "Idle", value: data?.agents_by_status?.idle ?? 0, color: "#6b7280" },
    { label: "Error", value: data?.agents_by_status?.error ?? 0, color: "#ef4444" },
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
            <h2 className="text-xl font-semibold text-gray-100">Analytics</h2>
            {wsConnected ? (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Offline
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>Real-time monitoring and analytics for Claude Code sessions</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 bg-surface-2 px-2 py-0.5 rounded-md font-mono">
              <Clock className="w-3 h-3" />
              {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-ghost" disabled={!data}>
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatPill
          label="Total Sessions"
          value={fmt(data?.overview.total_sessions ?? 0)}
          raw={(data?.overview.total_sessions ?? 0).toLocaleString()}
          sub={`${data?.overview.active_sessions ?? 0} active`}
          icon={FolderOpen}
          color="text-blue-400"
        />
        <StatPill
          label="Total Agents"
          value={fmt(data?.overview.total_agents ?? 0)}
          raw={(data?.overview.total_agents ?? 0).toLocaleString()}
          sub={`${data?.overview.active_agents ?? 0} active`}
          icon={Bot}
          color="text-emerald-400"
        />
        <StatPill
          label="Total Tokens"
          value={fmt(totalTokens)}
          raw={totalTokens.toLocaleString()}
          sub={`${cacheHitPct}% cache hit rate`}
          icon={Cpu}
          color="text-violet-400"
        />
        <StatPill
          label="Total Cost"
          value={costData ? fmtCost(costData.total_cost) : "$0.00"}
          raw={costData ? `$${costData.total_cost.toFixed(2)}` : undefined}
          sub={
            costData
              ? `${costData.breakdown.length} model${costData.breakdown.length !== 1 ? "s" : ""}`
              : "No data"
          }
          icon={DollarSign}
          color="text-emerald-400"
        />
        <StatPill
          label="Total Events"
          value={fmt(data?.overview.total_events ?? 0)}
          raw={(data?.overview.total_events ?? 0).toLocaleString()}
          sub={`~${data?.avg_events_per_session ?? 0} per session`}
          icon={Zap}
          color="text-yellow-400"
        />
      </div>

      {/* Activity heatmap + 30-day sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2 overflow-x-auto">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Event Activity — Last 52 Weeks</h3>
          <div className="overflow-x-auto">
            <Heatmap weeks={weeks} />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-1">Last 30 Days</h3>
          <p className="text-[11px] text-gray-600 mb-4">Daily event count</p>
          <Sparkline data={last30} />
          <div className="flex justify-between text-[11px] text-gray-600 mt-2">
            <span>{last30[0]?.date?.slice(5)}</span>
            <span>{last30[last30.length - 1]?.date?.slice(5)}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Peak day</span>
              <span className="text-gray-300 font-mono">
                <Tip raw={Math.max(...last30.map((d) => d.count)).toLocaleString()}>
                  {fmt(Math.max(...last30.map((d) => d.count)))}
                </Tip>{" "}
                events
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total (30d)</span>
              <span className="text-gray-300 font-mono">
                <Tip raw={last30.reduce((s, d) => s + d.count, 0).toLocaleString()}>
                  {fmt(last30.reduce((s, d) => s + d.count, 0))}
                </Tip>{" "}
                events
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
              { key: "tokens", label: "Token Analytics" },
              { key: "workflow", label: "Workflow Intelligence" },
              { key: "productivity", label: "Productivity Analytics" },
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
              <h3 className="text-sm font-medium text-gray-300 mb-5">Token Distribution</h3>
              <div className="space-y-4">
                {[
                  { label: "Input", value: data?.tokens.total_input ?? 0, color: "bg-blue-400" },
                  {
                    label: "Output",
                    value: data?.tokens.total_output ?? 0,
                    color: "bg-emerald-400",
                  },
                  {
                    label: "Cache Read",
                    value: data?.tokens.total_cache_read ?? 0,
                    color: "bg-violet-400",
                  },
                  {
                    label: "Cache Write",
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
                  <span>Total tokens</span>
                  <Tip raw={totalTokens.toLocaleString()}>
                    <span className="text-gray-300 font-mono">{fmt(totalTokens)}</span>
                  </Tip>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Cache efficiency</span>
                  <span className="text-violet-400 font-mono">{cacheHitPct}%</span>
                </div>
              </div>
            </div>

            {/* Token summary */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-5">Token Breakdown</h3>
              <div className="space-y-3">
                {[
                  { label: "Input", value: data?.tokens.total_input ?? 0, color: "text-blue-400" },
                  {
                    label: "Output",
                    value: data?.tokens.total_output ?? 0,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Cache Read",
                    value: data?.tokens.total_cache_read ?? 0,
                    color: "text-violet-400",
                  },
                  {
                    label: "Cache Write",
                    value: data?.tokens.total_cache_write ?? 0,
                    color: "text-yellow-400",
                  },
                  { label: "Total", value: totalTokens, color: "text-gray-100" },
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
                <p className="text-[11px] text-gray-600 mt-4">
                  Token data captured from Claude Code Stop events.
                </p>
              )}
            </div>

            {/* Cost by model */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-5">Cost by Model</h3>
              {costData && costData.breakdown.length > 0 ? (
                <>
                  <DonutChart
                    segments={costData.breakdown
                      .filter((b) => b.cost > 0)
                      .map((b, i) => ({
                        label: b.model,
                        value: Math.round(b.cost * 100),
                        color:
                          ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"][
                            i % 6
                          ] ?? "#6b7280",
                      }))}
                    formatTotal={(cents) => fmtCost(cents / 100)}
                  />
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {costData.breakdown
                      .filter((b) => b.cost > 0)
                      .map((b) => (
                        <div key={b.model} className="flex justify-between text-xs">
                          <span className="text-gray-400 font-mono truncate">{b.model}</span>
                          <span className="text-emerald-400 font-mono font-medium ml-2">
                            <Tip raw={`$${b.cost.toFixed(2)}`}>{fmtCost(b.cost)}</Tip>
                          </span>
                        </div>
                      ))}
                    <div className="flex justify-between text-xs pt-2 border-t border-border">
                      <span className="text-gray-300 font-medium">Total</span>
                      <span className="text-emerald-400 font-mono font-semibold">
                        <Tip raw={`$${costData.total_cost.toFixed(2)}`}>
                          {fmtCost(costData.total_cost)}
                        </Tip>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">No cost data yet.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "workflow" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Agent type distribution */}
            <div className="card p-5">
              <h3 className="text-sm font-medium text-gray-300 mb-5">Subagent Types</h3>
              {(data?.agent_types ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No subagent data yet.</p>
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
              <h3 className="text-sm font-medium text-gray-300 mb-5">Agent Status</h3>
              <DonutChart segments={agentStatusSegments} />
              <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total agents</span>
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
              <h3 className="text-sm font-medium text-gray-300 mb-5">Event Types</h3>
              {(data?.event_types ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No event data yet.</p>
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
              <h3 className="text-sm font-medium text-gray-300 mb-5">Tool Usage</h3>
              {(data?.tool_usage ?? []).length === 0 ? (
                <p className="text-sm text-gray-500">No tool usage data yet.</p>
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
              <h3 className="text-sm font-medium text-gray-300 mb-5">Session Outcomes</h3>
              <DonutChart segments={sessionOutcomeSegments} />
              <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total sessions</span>
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
              <h3 className="text-sm font-medium text-gray-300 mb-5">Daily Session Trends</h3>
              {dailySessionsLocal.length === 0 ? (
                <p className="text-sm text-gray-500">No session trend data yet.</p>
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
                  <p className="text-[11px] text-gray-600 mt-3">Last 7 days</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
