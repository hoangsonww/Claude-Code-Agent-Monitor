/**
 * @file WorkflowPatterns.tsx
 * @description Defines the WorkflowPatterns React component that visualizes common workflow patterns detected from session data. It displays a ranked list of patterns based on their frequency, showing the sequence of agent steps in each pattern along with an icon representing the type of workflow. The component also handles cases where no patterns are detected and includes a special item for solo sessions without subagents. Users can click on a pattern to trigger a callback with the pattern's steps for further analysis or filtering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Zap, Code2, Shield, Bug, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowPattern, WorkflowPatternsData } from "../../lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE_STEPS = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

function patternIcon(steps: string[]): LucideIcon {
  const joined = steps.join(" ").toLowerCase();
  if (joined.includes("debug")) return Bug;
  if (joined.includes("security") || joined.includes("audit")) return Shield;
  if (joined.includes("code-review") || joined.includes("review")) return Code2;
  if (joined.includes("doc") || joined.includes("text")) return FileText;
  return Zap;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
      {label}
    </span>
  );
}

function StepFlow({ steps }: { steps: string[] }) {
  const { t } = useTranslation("workflows");
  const visible = steps.slice(0, MAX_VISIBLE_STEPS);
  const overflow = steps.length - MAX_VISIBLE_STEPS;

  return (
    <div className="flex items-center flex-wrap gap-1 min-w-0">
      {visible.map((step, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <StepPill label={step} />
          {(idx < visible.length - 1 || overflow > 0) && (
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600/20 whitespace-nowrap">
          {t("common:plusMore", { count: overflow })}
        </span>
      )}
    </div>
  );
}

function PatternFrequency({ count, percentage }: { count: number; percentage: number }) {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex-shrink-0 text-right">
      <p className="text-sm font-semibold text-gray-100">{count.toLocaleString()}</p>
      <p className="text-xs text-gray-500">
        {percentage.toFixed(1)}% {t("common:ofSessions", { defaultValue: "of sessions" })}
      </p>
    </div>
  );
}

interface PatternItemProps {
  pattern: WorkflowPattern;
  rank: number;
  isSelected: boolean;
  onClick: () => void;
}

function PatternItem({ pattern, rank, isSelected, onClick }: PatternItemProps) {
  const Icon = patternIcon(pattern.steps);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors duration-150",
        isSelected
          ? "bg-indigo-500/10 border-indigo-500/30"
          : "bg-surface-2 border-transparent hover:bg-white/5 hover:border-white/10",
      ].join(" ")}
    >
      {/* Rank / icon */}
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
        {rank <= 3 ? (
          <span className="text-xs font-bold text-indigo-400">{rank}</span>
        ) : (
          <Icon className="w-3.5 h-3.5 text-indigo-400" />
        )}
      </div>

      {/* Step flow */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <StepFlow steps={pattern.steps} />
      </div>

      {/* Frequency */}
      <PatternFrequency count={pattern.count} percentage={pattern.percentage} />
    </button>
  );
}

function SoloSessionItem({ count, percentage }: { count: number; percentage: number }) {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-yellow-500/5 border-yellow-500/20">
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-500/15 text-yellow-300 border border-yellow-500/20">
          {t("patterns.solo")}
        </span>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-100">{count.toLocaleString()}</p>
        <p className="text-xs text-gray-500">
          {percentage.toFixed(1)}% {t("common:ofSessions", { defaultValue: "of sessions" })}
        </p>
      </div>
    </div>
  );
}

function EmptyPatterns() {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-10 h-10 rounded-xl bg-surface-4 flex items-center justify-center mb-3">
        <Zap className="w-5 h-5 text-gray-600" />
      </div>
      <p className="text-sm font-medium text-gray-400">{t("patterns.noData")}</p>
      <p className="text-xs text-gray-600 mt-1">{t("patterns.noDataDesc")}</p>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface WorkflowPatternsProps {
  data: WorkflowPatternsData;
  onPatternClick?: (steps: string[]) => void;
}

export function WorkflowPatterns({ data, onPatternClick }: WorkflowPatternsProps) {
  const { t } = useTranslation("workflows");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handlePatternClick = (index: number, steps: string[]) => {
    const next = selectedIndex === index ? null : index;
    setSelectedIndex(next);
    if (next !== null) {
      onPatternClick?.(steps);
    }
  };

  const hasContent = data.patterns.length > 0 || data.soloSessionCount > 0;

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
        {t("patterns.label")}
      </h2>

      {!hasContent ? (
        <EmptyPatterns />
      ) : (
        <div className="flex flex-col gap-2">
          {data.patterns.map((pattern, idx) => (
            <PatternItem
              key={idx}
              pattern={pattern}
              rank={idx + 1}
              isSelected={selectedIndex === idx}
              onClick={() => handlePatternClick(idx, pattern.steps)}
            />
          ))}

          {data.soloSessionCount > 0 && (
            <SoloSessionItem count={data.soloSessionCount} percentage={data.soloPercentage} />
          )}
        </div>
      )}
    </div>
  );
}
