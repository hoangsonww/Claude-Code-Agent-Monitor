/**
 * @file WorkflowPatterns.tsx
 * @description Defines the WorkflowPatterns React component that visualizes common workflow patterns detected from session data. It displays a ranked list of patterns based on their frequency, showing the sequence of agent steps in each pattern along with an icon representing the type of workflow. The component also handles cases where no patterns are detected and includes a special item for solo sessions without subagents. Users can click on a pattern to trigger a callback with the pattern's steps for further analysis or filtering.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/WorkflowPatterns.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * Defines the WorkflowPatterns React component that visualizes common workflow patterns detected
 * from session data. It displays a ranked list of patterns based on their frequency, showing the
 * sequence of agent steps in each pattern along with an icon representing the type of workflow. The
 * component also handles cases where no patterns are detected and includes a special item for solo
 * sessions without subagents. Users can click on a pattern to trigger a callback with the pattern's
 * steps for further analysis or filtering.
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
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `WorkflowPatterns` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `describePattern` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `DetailStat` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `EmptyPatterns` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `findRepeatedStep` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MAX_VISIBLE_STEPS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `PatternDetail` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PatternFrequency` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `patternIcon` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PatternItem` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PatternItemProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SoloSessionItem` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `StepFlow` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `StepPill` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `suggestionForPattern` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `TFn` (type) — top-level declaration that helps orient code review and focused test selection.
 * - `WorkflowPatterns` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `WorkflowPatternsProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/WorkflowPatterns.tsx`
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

/** Translation function signature used by the pattern description helpers. */
type TFn = (key: string, options?: Record<string, unknown>) => string;

// ── Constants ─────────────────────────────────────────────────────────────────

/** Steps shown in a collapsed pattern row before the rest are summarized as `+N`. */
const MAX_VISIBLE_STEPS = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pick an icon that hints at what a pattern does, from keywords in its step names: debugging,
 * security or audit, code review, documentation, or a generic bolt.
 *
 * @param steps - Subagent types in order.
 * @returns A Lucide icon component.
 */
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
 *
 * @param steps - Subagent types in order.
 * @returns The repeated type, or null.
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
 *
 * @param pattern - Pattern to describe.
 * @param t - Translation function.
 * @returns The description, or an empty string for an empty pattern.
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
 *
 * @param pattern - Pattern to advise on.
 * @param t - Translation function.
 * @returns The suggestion text.
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

/** Pill for one step (a subagent type) in a pattern. */
function StepPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
      {label}
    </span>
  );
}

/**
 * A pattern's steps as pills joined by arrows, showing at most {@link MAX_VISIBLE_STEPS} and a `+N
 * more` marker for the rest.
 */
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

/** Right-aligned count and share of sessions for a pattern row. */
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

/** Props for {@link PatternItem}. */
interface PatternItemProps {
  /** The pattern to show. */
  pattern: WorkflowPattern;
  /** 1-based rank in the list. */
  rank: number;
  /** Whether the row is expanded. */
  isSelected: boolean;
  /** Toggles the row. */
  onClick: () => void;
}

/**
 * One recurring pattern: rank, icon, the step flow, and its frequency. Expanding it shows {@link
 * PatternDetail}.
 */
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

/**
 * Expanded view of a pattern: the full step sequence, stats (occurrences, share of sessions, steps,
 * distinct agents), a plain-language description of what the sequence does, and a suggestion based
 * on its shape.
 */
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

/** Small value-over-label stat inside the pattern detail. */
function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-md px-2.5 py-2">
      <p className="text-sm font-semibold text-gray-100 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5 truncate">{label}</p>
    </div>
  );
}

/** Row for sessions that ran without any subagents, with their count and share. */
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

/** Placeholder shown when no recurring patterns were found. */
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

/** Props for {@link WorkflowPatterns}. */
interface WorkflowPatternsProps {
  /** Detected subagent sequences and solo-session counts from `/api/workflows`. */
  data: WorkflowPatternsData;
  /**
   * Called with a pattern's steps when it is expanded, so the page can highlight related charts.
   */
  onPatternClick?: (steps: string[]) => void;
}

/**
 * Workflow patterns list on the Workflows page: the most common subagent sequences across sessions,
 * ranked by frequency, plus the solo-session row. One pattern can be expanded at a time; clicking
 * it again collapses it.
 */
export function WorkflowPatterns({ data, onPatternClick }: WorkflowPatternsProps) {
  const { t } = useTranslation("workflows");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  /**
   * Expand a pattern, or collapse it when it is already expanded. Expanding also reports its steps
   * to the page.
   */
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
