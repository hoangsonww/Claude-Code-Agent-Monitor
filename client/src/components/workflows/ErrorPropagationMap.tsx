import { useState } from "react";
import type { ErrorPropagationData } from "../../lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPTH_LABELS: Record<number, string> = {
  0: "Session / Main",
  1: "Direct Subagent",
  2: "Nested (depth 2)",
  3: "Deep (depth 3+)",
};

function depthLabel(depth: number): string {
  return DEPTH_LABELS[depth] ?? `Depth ${depth}`;
}

const DEPTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#a855f7"];

// ── Component ─────────────────────────────────────────────────────────────────

export interface ErrorPropagationMapProps {
  data: ErrorPropagationData;
}

export function ErrorPropagationMap({ data }: ErrorPropagationMapProps) {
  const [hoveredDepth, setHoveredDepth] = useState<number | null>(null);

  const hasErrors =
    data.byDepth.some((d) => d.count > 0) ||
    data.byType.some((t) => t.count > 0) ||
    (data.eventErrors && data.eventErrors.length > 0) ||
    data.sessionsWithErrors > 0;

  if (!hasErrors) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <span className="text-sm text-emerald-400 font-medium">No errors recorded</span>
        <span className="text-xs text-gray-600">All sessions completed successfully</span>
      </div>
    );
  }

  const errorRatePct = data.errorRate;
  const totalErrors = data.byDepth.reduce((s, d) => s + d.count, 0);
  const maxDepthCount = Math.max(...data.byDepth.map((d) => d.count), 1);
  const topTypes = [...data.byType].sort((a, b) => b.count - a.count).slice(0, 6);
  const hasDepthData = data.byDepth.some((d) => d.count > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Error rate summary bar */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
        <div className="flex-shrink-0 min-w-[2.75rem] h-10 px-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <span className="text-[13px] font-bold text-red-400 tabular-nums whitespace-nowrap">
            {errorRatePct}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-red-300">
            {data.sessionsWithErrors} of {data.totalSessions} sessions had errors
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {totalErrors > 0
              ? `${totalErrors} agent-level error${totalErrors !== 1 ? "s" : ""} across hierarchy`
              : "Session-level errors only"}
          </p>
        </div>
      </div>

      {/* Errors by depth — horizontal bars */}
      {hasDepthData && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2.5">
            Errors by hierarchy depth
          </p>
          <div className="flex flex-col gap-1.5">
            {data.byDepth
              .filter((d) => d.count > 0)
              .map((d) => {
                const pct = (d.count / maxDepthCount) * 100;
                const color = DEPTH_COLORS[d.depth] ?? DEPTH_COLORS[DEPTH_COLORS.length - 1];
                const isHovered = hoveredDepth === d.depth;
                return (
                  <div
                    key={d.depth}
                    className="flex items-center gap-2.5 group"
                    onMouseEnter={() => setHoveredDepth(d.depth)}
                    onMouseLeave={() => setHoveredDepth(null)}
                  >
                    <span className="text-[11px] text-gray-500 w-24 flex-shrink-0 text-right truncate">
                      {depthLabel(d.depth)}
                    </span>
                    <div className="flex-1 h-5 bg-surface-3 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-300"
                        style={{
                          width: `${Math.max(pct, 4)}%`,
                          backgroundColor: color,
                          opacity: isHovered ? 1 : 0.75,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-semibold tabular-nums w-7 text-right transition-colors"
                      style={{ color: isHovered ? color : "#9ca3af" }}
                    >
                      {d.count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Error-prone agent types */}
      {topTypes.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2.5">
            Error-prone agent types
          </p>
          <div className="flex flex-col gap-1">
            {topTypes.map((t, i) => {
              const maxCount = topTypes[0]?.count ?? 1;
              const pct = (t.count / maxCount) * 100;
              return (
                <div
                  key={t.subagent_type}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-3/50 transition-colors"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: DEPTH_COLORS[Math.min(i, DEPTH_COLORS.length - 1)] }}
                  />
                  <span className="text-xs text-gray-300 truncate flex-1 min-w-0">
                    {t.subagent_type}
                  </span>
                  <div className="w-16 h-1.5 bg-surface-4 rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className="h-full rounded-full bg-red-400/60"
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-red-300 tabular-nums w-5 text-right flex-shrink-0">
                    {t.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API & session errors */}
      {data.eventErrors && data.eventErrors.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2.5">
            API &amp; session errors
          </p>
          <div className="flex flex-col gap-1">
            {data.eventErrors.map((e) => (
              <div
                key={e.summary}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-xs text-gray-300 truncate flex-1 min-w-0" title={e.summary}>
                  {e.summary}
                </span>
                <span className="flex-shrink-0 text-[11px] font-semibold text-amber-400 tabular-nums">
                  {e.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
