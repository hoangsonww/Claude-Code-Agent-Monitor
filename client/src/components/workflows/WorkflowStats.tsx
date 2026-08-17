/**
 * @file WorkflowStats.tsx
 * @description Six headline statistics rendered as cards. Each card has the accent icon top-right and an info popover (i icon) bottom-right that explains how the metric is calculated and gives a deterministic, value-dependent interpretation. The popover is fixed-positioned and clamped to the viewport so it never gets clipped by the sidebar or screen edges. All copy is i18n-driven (workflows.stats.tooltip.*).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/WorkflowStats.tsx`
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
 * - `WorkflowStatsProps` — exported API; see TSDoc on the symbol for behavior.
 * - `WorkflowStats` — exported API; see TSDoc on the symbol for behavior.
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
 * **WorkflowStatsProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowStats**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitFork, Users, CheckCircle, ArrowRightLeft, Layers, Clock, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkflowStats } from "../../lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDurationSec(sec: number): string {
  if (sec <= 0) return "0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function successRateColor(rate: number): string {
  if (rate > 90) return "text-emerald-400";
  if (rate > 70) return "text-yellow-400";
  return "text-red-400";
}

// ── Deterministic interpreters - return an i18n key + params ─────────────────
// Pure rule-based mapping so the same input always yields the same explanation.

type TFn = (key: string, options?: Record<string, unknown>) => string;
type Interp = { key: string; params?: Record<string, unknown> };

function interpAvgDepth(v: number): Interp {
  if (v <= 0) return { key: "stats.tooltip.depth.zero" };
  if (v < 0.5) return { key: "stats.tooltip.depth.rare" };
  if (v < 1.5) return { key: "stats.tooltip.depth.single" };
  if (v < 2.5) return { key: "stats.tooltip.depth.multi" };
  return { key: "stats.tooltip.depth.deep" };
}

function interpAvgSubagents(v: number): Interp {
  if (v <= 0) return { key: "stats.tooltip.subagents.zero" };
  if (v < 1) {
    const oneIn = v > 0 ? Math.round(1 / v) : 0;
    return { key: "stats.tooltip.subagents.lowFreq", params: { count: Math.max(2, oneIn) } };
  }
  if (v < 3) return { key: "stats.tooltip.subagents.moderate" };
  if (v < 6) return { key: "stats.tooltip.subagents.heavy" };
  return { key: "stats.tooltip.subagents.veryHeavy" };
}

function interpSuccessRate(v: number): Interp {
  if (v >= 99) return { key: "stats.tooltip.success.perfect" };
  if (v >= 95) return { key: "stats.tooltip.success.healthy" };
  if (v >= 80) return { key: "stats.tooltip.success.acceptable" };
  if (v >= 50) return { key: "stats.tooltip.success.concerning" };
  return { key: "stats.tooltip.success.critical" };
}

function interpTopFlow(source: string | null, target: string | null): Interp {
  if (!source || !target) return { key: "stats.tooltip.topFlow.none" };
  if (source === target) {
    return { key: "stats.tooltip.topFlow.selfLoop", params: { tool: source } };
  }
  return {
    key: "stats.tooltip.topFlow.pair",
    params: {
      source,
      target,
      sourceLower: source.toLowerCase(),
      targetLower: target.toLowerCase(),
    },
  };
}

function interpAvgCompactions(v: number): Interp {
  if (v <= 0) return { key: "stats.tooltip.compactions.zero" };
  if (v < 0.5) {
    const oneIn = v > 0 ? Math.round(1 / v) : 0;
    return { key: "stats.tooltip.compactions.lowFreq", params: { count: Math.max(2, oneIn) } };
  }
  if (v < 2) return { key: "stats.tooltip.compactions.moderate" };
  return { key: "stats.tooltip.compactions.high" };
}

function interpAvgDuration(sec: number): Interp {
  if (sec <= 0) return { key: "stats.tooltip.duration.zero" };
  if (sec < 60) return { key: "stats.tooltip.duration.veryShort" };
  if (sec < 5 * 60) return { key: "stats.tooltip.duration.short" };
  if (sec < 30 * 60) return { key: "stats.tooltip.duration.medium" };
  if (sec < 60 * 60) return { key: "stats.tooltip.duration.long" };
  if (sec < 3 * 60 * 60) return { key: "stats.tooltip.duration.veryLong" };
  return { key: "stats.tooltip.duration.marathon" };
}

// ── Info popover ──────────────────────────────────────────────────────────────

const POPOVER_W = 300;
const POPOVER_MARGIN = 12;

interface InfoPopoverProps {
  calculationKey: string;
  interp: Interp;
  valueDisplay: string;
  metricPhraseKey: string;
}

function InfoPopover({ calculationKey, interp, valueDisplay, metricPhraseKey }: InfoPopoverProps) {
  const { t } = useTranslation("workflows");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const btn = buttonRef.current;
      const pop = popoverRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const popH = pop?.offsetHeight ?? 240;

      let left = r.right - POPOVER_W;
      if (left < POPOVER_MARGIN) left = POPOVER_MARGIN;
      if (left + POPOVER_W > window.innerWidth - POPOVER_MARGIN) {
        left = window.innerWidth - POPOVER_W - POPOVER_MARGIN;
      }
      const spaceBelow = window.innerHeight - r.bottom;
      const placeAbove = spaceBelow < popH + POPOVER_MARGIN && r.top > popH + POPOVER_MARGIN;
      const top = placeAbove ? Math.max(POPOVER_MARGIN, r.top - popH - 8) : r.bottom + 8;

      setCoords({ left, top });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const metricPhrase = t(metricPhraseKey);
  const interpretation = t(interp.key, interp.params);
  const valueMeans = t("stats.tooltip.valueMeansFmt", {
    value: valueDisplay,
    phrase: metricPhrase,
    interpretation,
  });

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("stats.tooltip.moreInfo")}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="flex items-center justify-center rounded-full p-0.5 -m-0.5 text-gray-600 hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="fixed z-50 p-3 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl text-[11px] text-gray-300 pointer-events-none"
          style={{ left: coords.left, top: coords.top, width: POPOVER_W }}
        >
          <div className="flex items-baseline gap-2 mb-2 pb-2 border-b border-[#2a2a4a]">
            <span className="text-base font-semibold text-gray-100 tabular-nums">
              {valueDisplay}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              {metricPhrase}
            </span>
          </div>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("stats.tooltip.howCalc")}
          </p>
          <p className="text-gray-400 leading-snug mb-2.5">{t(calculationKey)}</p>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("stats.tooltip.whatItMeans")}
          </p>
          <p className="text-gray-400 leading-snug">{valueMeans}</p>
        </div>
      )}
    </>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  accentClass?: string;
  calculationKey: string;
  interp: Interp;
  metricPhraseKey: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentClass = "text-accent",
  calculationKey,
  interp,
  metricPhraseKey,
}: StatCardProps) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider leading-none">
          {label}
        </span>
        <Icon className={`w-4 h-4 flex-shrink-0 ${accentClass}`} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <span
          className={`text-2xl font-semibold leading-none truncate ${accentClass}`}
          title={value}
        >
          {value}
        </span>
        <InfoPopover
          calculationKey={calculationKey}
          interp={interp}
          valueDisplay={value}
          metricPhraseKey={metricPhraseKey}
        />
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface WorkflowStatsProps {
  stats: WorkflowStats;
}

export function WorkflowStats({ stats }: WorkflowStatsProps) {
  const { t } = useTranslation("workflows");
  // t is referenced for translation prefix consistency.
  void (t as TFn);
  const topFlow = stats.topFlow;
  const topFlowLabel = topFlow ? `${topFlow.source} → ${topFlow.target}` : "-";

  const srColor = successRateColor(stats.successRate);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard
        label={t("stats.avgAgentDepth")}
        value={stats.avgDepth.toFixed(1)}
        icon={GitFork}
        accentClass="text-indigo-400"
        calculationKey="stats.tooltip.calc.depth"
        interp={interpAvgDepth(stats.avgDepth)}
        metricPhraseKey="stats.tooltip.phrase.depth"
      />
      <StatCard
        label={t("stats.avgSubagentsPerSession")}
        value={stats.avgSubagents.toFixed(1)}
        icon={Users}
        accentClass="text-blue-400"
        calculationKey="stats.tooltip.calc.subagents"
        interp={interpAvgSubagents(stats.avgSubagents)}
        metricPhraseKey="stats.tooltip.phrase.subagents"
      />
      <StatCard
        label={t("stats.agentSuccessRate")}
        value={`${stats.successRate.toFixed(1)}%`}
        icon={CheckCircle}
        accentClass={srColor}
        calculationKey="stats.tooltip.calc.success"
        interp={interpSuccessRate(stats.successRate)}
        metricPhraseKey="stats.tooltip.phrase.success"
      />
      <StatCard
        label={t("stats.mostCommonFlow")}
        value={topFlowLabel}
        icon={ArrowRightLeft}
        accentClass="text-violet-400"
        calculationKey="stats.tooltip.calc.topFlow"
        interp={interpTopFlow(topFlow?.source ?? null, topFlow?.target ?? null)}
        metricPhraseKey="stats.tooltip.phrase.topFlow"
      />
      <StatCard
        label={t("stats.avgCompactions")}
        value={stats.avgCompactions.toFixed(1)}
        icon={Layers}
        accentClass="text-cyan-400"
        calculationKey="stats.tooltip.calc.compactions"
        interp={interpAvgCompactions(stats.avgCompactions)}
        metricPhraseKey="stats.tooltip.phrase.compactions"
      />
      <StatCard
        label={t("stats.avgDuration")}
        value={formatDurationSec(stats.avgDurationSec)}
        icon={Clock}
        accentClass="text-amber-400"
        calculationKey="stats.tooltip.calc.duration"
        interp={interpAvgDuration(stats.avgDurationSec)}
        metricPhraseKey="stats.tooltip.phrase.duration"
      />
    </div>
  );
}
