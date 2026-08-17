/**
 * @file WorkflowPatterns.tsx
 * @description Defines the WorkflowPatterns React component that visualizes common workflow patterns detected from session data. It displays a ranked list of patterns based on their frequency, showing the sequence of agent steps in each pattern along with an icon representing the type of workflow. The component also handles cases where no patterns are detected and includes a special item for solo sessions without subagents. Users can click on a pattern to trigger a callback with the pattern's steps for further analysis or filtering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/WorkflowPatterns.tsx`
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
 * - `WorkflowPatterns` — exported API; see TSDoc on the symbol for behavior.
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
 * **WorkflowPatterns**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Zap, Code2, Shield, Bug, FileText, Lightbulb, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowPattern, WorkflowPatternsData } from "../../lib/types";

type TFn = (key: string, options?: Record<string, unknown>) => string;

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

/**
 * Find the first agent that appears more than once in the sequence (loop indicator).
 * Returns null if every step is unique.
 */
function findRepeatedStep(steps: string[]): string | null {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s !== undefined && steps.indexOf(s) !== i) return s;
  }
  return null;
}

/**
 * Build a deterministic, value-dependent narrative for a workflow pattern.
 * Pure rule-based mapping - same input always yields the same output, so the
 * UI never produces hallucinated descriptions for ambiguous patterns.
 */
function describePattern(pattern: WorkflowPattern, t: TFn): string {
  const { steps, percentage } = pattern;
  if (steps.length === 0) return "";

  const first = steps[0] ?? "";
  const last = steps[steps.length - 1] ?? first;
  const repeated = findRepeatedStep(steps);

  // Shape of the chain
  let core: string;
  if (steps.length === 1) {
    core = t("patterns.detail.narrative.soloFmt", { first });
  } else if (steps.length === 2) {
    core = t("patterns.detail.narrative.twoStepFmt", { first, last });
  } else if (steps.length <= 5) {
    core = t("patterns.detail.narrative.shortFmt", { count: steps.length, first, last });
  } else {
    core = t("patterns.detail.narrative.longFmt", { count: steps.length, first, last });
  }

  if (repeated) {
    core += t("patterns.detail.narrative.loopHintFmt", { agent: repeated });
  }

  // Frequency bucket
  let freq: string;
  if (percentage > 50) freq = t("patterns.detail.narrative.dominant");
  else if (percentage > 25) freq = t("patterns.detail.narrative.common");
  else if (percentage > 10) freq = t("patterns.detail.narrative.regular");
  else freq = t("patterns.detail.narrative.niche");

  return core + freq;
}

/**
 * Pick a suggestion bucket based on chain length and whether a loop exists.
 * Loop wins over length so the user is reminded to confirm intentional loops.
 */
function suggestionForPattern(pattern: WorkflowPattern, t: TFn): string {
  const { steps } = pattern;
  if (findRepeatedStep(steps)) return t("patterns.detail.suggestion.loop");
  if (steps.length <= 1) return t("patterns.detail.suggestion.solo");
  if (steps.length <= 3) return t("patterns.detail.suggestion.shortChain");
  if (steps.length <= 6) return t("patterns.detail.suggestion.mediumChain");
  return t("patterns.detail.suggestion.longChain");
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
  const { t } = useTranslation("workflows");
  const Icon = patternIcon(pattern.steps);

  return (
    <div
      className={[
        "rounded-lg border transition-colors duration-150 overflow-hidden",
        isSelected
          ? "bg-indigo-500/10 border-indigo-500/30"
          : "bg-surface-2 border-transparent hover:bg-white/5 hover:border-white/10",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        aria-expanded={isSelected}
        title={t("patterns.detail.clickHint")}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
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

        {/* Click affordance - visible only when not yet expanded so users know the row is interactive. */}
        {!isSelected && (
          <Info className="hidden sm:block w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
        )}
      </button>

      {isSelected && <PatternDetail pattern={pattern} />}
    </div>
  );
}

function PatternDetail({ pattern }: { pattern: WorkflowPattern }) {
  const { t } = useTranslation("workflows");
  const uniqueAgents = new Set(pattern.steps).size;
  const narrative = describePattern(pattern, t);
  const suggestion = suggestionForPattern(pattern, t);

  return (
    <div className="border-t border-indigo-500/20 bg-surface-1/40 px-4 py-3.5 space-y-3.5">
      {/* Full step sequence (no truncation) */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {t("patterns.detail.stepsHeading")}
        </p>
        <div className="flex items-center flex-wrap gap-1.5">
          {pattern.steps.map((step, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-200 border border-indigo-500/25">
                <span className="text-indigo-400/70 mr-1.5 text-[10px] font-bold">{i + 1}</span>
                {step}
              </span>
              {i < pattern.steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <DetailStat
          label={t("patterns.detail.stepsCount", { count: pattern.steps.length })}
          value={String(pattern.steps.length)}
        />
        <DetailStat label={t("patterns.detail.uniqueAgents")} value={String(uniqueAgents)} />
        <DetailStat
          label={t("patterns.detail.occurrences")}
          value={pattern.count.toLocaleString()}
        />
        <DetailStat
          label={t("patterns.detail.shareOfSessions")}
          value={`${pattern.percentage.toFixed(1)}%`}
        />
      </div>

      {/* Narrative - what this means */}
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Info className="w-3 h-3 text-indigo-400" />
          {t("patterns.detail.narrativeHeading")}
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">{narrative}</p>
      </div>

      {/* Suggestion */}
      <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-md px-3 py-2.5">
        <p className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3" />
          {t("patterns.detail.suggestionHeading")}
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">{suggestion}</p>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-md px-2.5 py-2">
      <p className="text-sm font-semibold text-gray-100 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5 truncate">{label}</p>
    </div>
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
