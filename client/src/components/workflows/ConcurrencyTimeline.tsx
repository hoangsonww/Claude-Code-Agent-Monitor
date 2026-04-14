/**
 * @file ConcurrencyTimeline.tsx
 * @description Defines the ConcurrencyTimeline component that visualizes concurrency data for agent sessions using horizontal bars. Each lane represents an agent type (main or subagent) with the bar width proportional to the number of sessions and timing indicated as a percentage of the session duration. The component handles empty states gracefully and assigns distinct colors to different agent types for clarity.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
}

function LaneRow({ lane, color, maxCount }: LaneRowProps) {
  // Bar width proportional to session count (the metric with meaningful variance)
  const barPct = maxCount > 0 ? (lane.count / maxCount) * 100 : 0;

  // Duration as percentage of session (backend returns 0-1 fractions)
  const startPct = (lane.avgStart * 100).toFixed(0);
  const endPct = (lane.avgEnd * 100).toFixed(0);

  return (
    <div className="flex items-center gap-3 py-1.5 group">
      {/* Label column */}
      <div className="flex-shrink-0 w-[140px] text-right" title={lane.name}>
        <span className="text-xs font-medium text-gray-400 truncate block group-hover:text-gray-200 transition-colors">
          {lane.name}
        </span>
      </div>

      {/* Bar area */}
      <div className="relative flex-1 h-6 bg-surface-3 rounded overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-0 rounded transition-all duration-300"
          style={{
            width: `${barPct}%`,
            minWidth: barPct > 0 ? "4px" : undefined,
            backgroundColor: color,
            opacity: 0.85,
          }}
          title={`${lane.count} session${lane.count !== 1 ? "s" : ""} — active ${startPct}%–${endPct}% of session`}
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
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
      <p className="text-sm font-medium text-gray-400">No concurrency data</p>
      <p className="text-xs text-gray-600 mt-1">
        Concurrency data appears once sessions with subagents have been recorded.
      </p>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface ConcurrencyTimelineProps {
  data: ConcurrencyData;
}

export function ConcurrencyTimeline({ data }: ConcurrencyTimelineProps) {
  const lanes = data.aggregateLanes;

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
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-shrink-0 w-[140px]" />
        <div className="flex-1 flex items-center justify-between">
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">Sessions</span>
          <span className="text-[10px] text-gray-600 tabular-nums">{maxCount} max</span>
        </div>
        <div className="flex-shrink-0 w-[72px] text-[10px] text-gray-600 uppercase tracking-wider">
          Timing
        </div>
      </div>

      {/* Lane rows */}
      <div className="flex flex-col divide-y divide-surface-4">
        {coloredLanes.map(({ lane, color }) => (
          <LaneRow key={lane.name} lane={lane} color={color} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}

// Re-export helper so callers can import the color fn if needed
export function laneColor(name: string, subagentIndex: number): string {
  if (name === "Main Agent") return MAIN_COLOR;
  return SUBAGENT_PALETTE[subagentIndex % SUBAGENT_PALETTE.length] ?? MAIN_COLOR;
}
