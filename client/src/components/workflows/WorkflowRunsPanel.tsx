/**
 * @file WorkflowRunsPanel.tsx
 * @description Surfaces dynamic Workflow-tool runs (issue #167) — fleets of
 * inner sub-agents spawned by the Claude Code "Workflow" tool, ingested from
 * on-disk run journals. Works in two modes: controlled (pass `runs`, e.g. from
 * SessionDetail) or self-fetching (pass a `statusFilter`, e.g. the Workflows
 * page) with live `workflow_upserted` updates. Each run expands to colored,
 * clickable phase filters, a per-agent metrics table, and an expandable list of
 * per-agent results (full prompt + result, no truncation).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Workflow, ChevronRight, ChevronDown, Layers, ExternalLink, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { eventBus } from "../../lib/eventBus";
import type { WorkflowRun, WorkflowProgressEntry, WSMessage } from "../../lib/types";
import { fmt, formatMs, timeAgo, truncate } from "../../lib/format";

type StatusFilter = "all" | "active" | "completed";

interface Props {
  /** Controlled mode: render exactly these runs (no fetch, no live updates). */
  runs?: WorkflowRun[];
  /** Self-fetch mode: page-level status filter (active → running). */
  statusFilter?: StatusFilter;
  /** Self-fetch mode: scope to one session. */
  sessionId?: string;
  /** Hide the parent-session link (e.g. when already on that session). */
  hideSessionLink?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  working: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  queued: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

function statusClass(status: string): string {
  return STATUS_STYLES[status] || "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

// Distinct per-phase chip colors, cycled by phase index so every phase
// (e.g. Scout / Verify / Synthesize, or Explain / Interview / Gotcha) reads
// as its own color in both the filter row and the result label chips.
const PHASE_PALETTE = [
  "bg-violet-500/15 text-violet-300 border-violet-500/40",
  "bg-sky-500/15 text-sky-300 border-sky-500/40",
  "bg-amber-500/15 text-amber-300 border-amber-500/40",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  "bg-rose-500/15 text-rose-300 border-rose-500/40",
  "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
];

function phaseColor(phaseTitles: string[], title: string | null | undefined): string {
  if (!title) return "bg-gray-500/15 text-gray-300 border-gray-500/40";
  const i = phaseTitles.indexOf(title);
  const idx = i >= 0 ? i : Math.abs(hashStr(title)) % PHASE_PALETTE.length;
  return PHASE_PALETTE[idx % PHASE_PALETTE.length] as string;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * Surface a human-readable excerpt from an agent's result preview, which is
 * often a (frequently truncated) JSON blob. Prefer a known content field, then
 * the first substantial quoted string, then a de-JSON'd snippet — so the panel
 * shows a sentence instead of raw `{"angle":"…","findings":[{"claim":"…`.
 */
export function friendlyPreview(raw: unknown): string {
  if (!raw) return "";
  const s = String(raw).trim();
  const keyed = s.match(
    /"(?:claim|pitch|note|text|summary|result|answer|brief|description|title|content)"\s*:\s*"([^"\\]{8,})/i
  );
  if (keyed && keyed[1]) return keyed[1].trim();
  const firstLong = s.match(/"([^"\\]{24,})"/);
  if (firstLong && firstLong[1]) return firstLong[1].trim();
  if (/^[[{]/.test(s)) {
    return s
      .replace(/[{}[\]"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return s;
}

/** Full, un-truncated content for the expanded view — pretty-printed if JSON. */
export function fullPreview(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw);
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export function WorkflowRunsPanel({
  runs: controlledRuns,
  statusFilter,
  sessionId,
  hideSessionLink,
}: Props) {
  const { t } = useTranslation("workflows");
  const controlled = controlledRuns != null;

  const [fetchedRuns, setFetchedRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(!controlled);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [phaseFilter, setPhaseFilter] = useState<Record<string, string | null>>({});
  const [openResults, setOpenResults] = useState<Set<string>>(() => new Set());

  const fetchRuns = useCallback(async () => {
    if (controlled) return;
    try {
      const status =
        statusFilter === "active"
          ? "running"
          : statusFilter === "completed"
            ? "completed"
            : undefined;
      const res = await api.workflows.runs({ status, session_id: sessionId, limit: 200 });
      setFetchedRuns(res.runs);
    } catch {
      /* leave previous runs in place */
    } finally {
      setLoading(false);
    }
  }, [controlled, statusFilter, sessionId]);

  useEffect(() => {
    if (controlled) return;
    fetchRuns();
  }, [controlled, fetchRuns]);

  // Live updates: debounce a refetch when a workflow row changes.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (controlled) return;
    const handler = (msg: WSMessage) => {
      if (msg.type !== "workflow_upserted") return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fetchRuns, 1500);
    };
    const unsub = eventBus.subscribe(handler);
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [controlled, fetchRuns]);

  const runs = controlled ? controlledRuns : fetchedRuns;

  const toggle = (runId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  const setPhase = (runId: string, phase: string) =>
    setPhaseFilter((prev) => ({ ...prev, [runId]: prev[runId] === phase ? null : phase }));
  const toggleResult = (key: string) =>
    setOpenResults((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!controlled && loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        <span className="animate-pulse">{t("runs.loading")}</span>
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Workflow className="w-4 h-4 text-gray-600" />
        {t("runs.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const isOpen = expanded.has(run.run_id);
        const running = run.status === "running" || run.status === "working";
        // progress[] mixes phase markers and agents; only `workflow_agent`
        // entries are real agents.
        const agentRows = (run.progress || []).filter((p) => p.type === "workflow_agent");
        const phaseTitles = (run.phases || []).map((p) => p.title || "").filter(Boolean);
        const sel = phaseFilter[run.run_id] || null;
        const shown = sel ? agentRows.filter((a) => a.phaseTitle === sel) : agentRows;
        const resultRows = shown.filter((a) => a.resultPreview);
        return (
          <div
            key={run.run_id}
            className="rounded-lg border border-gray-800 bg-card/40 overflow-hidden"
          >
            <button
              onClick={() => toggle(run.run_id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-800/30 transition-colors"
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
              )}
              {running ? (
                <Loader2 className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />
              ) : (
                <Workflow className="w-4 h-4 text-violet-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-200 truncate">
                    {run.name || run.run_id}
                  </span>
                  <span className={`badge text-[10px] border ${statusClass(run.status)}`}>
                    {t(`runs.status.${run.status}`, run.status)}
                  </span>
                  {run.default_model && (
                    <span className="text-[10px] font-mono text-gray-500">{run.default_model}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500 flex-wrap">
                  <span>{t("runs.agents", { count: run.agent_count })}</span>
                  <span>{t("runs.tools", { count: run.total_tool_calls })}</span>
                  <span>
                    {fmt(run.total_tokens)} {t("runs.tokens")}
                  </span>
                  {run.duration_ms != null && <span>{formatMs(run.duration_ms)}</span>}
                  {run.started_at && <span>{timeAgo(run.started_at)}</span>}
                </div>
              </div>
              {!hideSessionLink && (
                <Link
                  to={`/sessions/${encodeURIComponent(run.session_id)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-500 hover:text-violet-400 transition-colors flex-shrink-0"
                  title={t("runs.openSession")}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-3 border-t border-gray-800/60 space-y-3">
                {/* Clickable, colored phase filters */}
                {phaseTitles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Layers className="w-3.5 h-3.5 text-gray-500" />
                    {phaseTitles.map((title, i) => {
                      const active = sel === title;
                      return (
                        <button
                          key={i}
                          onClick={() => setPhase(run.run_id, title)}
                          className={`badge text-[10px] border transition ${phaseColor(phaseTitles, title)} ${
                            active
                              ? "ring-1 ring-white/50"
                              : sel
                                ? "opacity-40 hover:opacity-100"
                                : "hover:ring-1 hover:ring-white/20"
                          }`}
                          title={t("runs.filterPhase")}
                        >
                          {title}
                        </button>
                      );
                    })}
                    {sel && (
                      <button
                        onClick={() => setPhase(run.run_id, sel)}
                        className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                      >
                        {t("runs.clearFilter")}
                      </button>
                    )}
                  </div>
                )}

                {shown.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-gray-500 text-left border-b border-gray-800">
                          <th className="py-1 pr-3 font-medium">{t("runs.col.agent")}</th>
                          <th className="py-1 pr-3 font-medium">{t("runs.col.phase")}</th>
                          <th className="py-1 pr-3 font-medium">{t("runs.col.state")}</th>
                          <th className="py-1 pr-3 font-medium text-right">
                            {t("runs.col.tokens")}
                          </th>
                          <th className="py-1 pr-3 font-medium text-right">
                            {t("runs.col.tools")}
                          </th>
                          <th className="py-1 pr-3 font-medium text-right">
                            {t("runs.col.duration")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((a: WorkflowProgressEntry, i) => (
                          <tr key={a.agentId || i} className="border-b border-gray-800/40">
                            <td className="py-1 pr-3 text-gray-300">
                              {a.label || a.agentType || a.agentId}
                              {a.lastToolName && (
                                <span className="text-gray-600 font-mono ml-1">
                                  · {a.lastToolName}
                                </span>
                              )}
                            </td>
                            <td className="py-1 pr-3">
                              <span
                                className={`badge text-[10px] border ${phaseColor(phaseTitles, a.phaseTitle)}`}
                              >
                                {a.phaseTitle || "—"}
                              </span>
                            </td>
                            <td className="py-1 pr-3">
                              <span
                                className={`badge text-[10px] border ${statusClass(String(a.state || ""))}`}
                              >
                                {t(`runs.status.${a.state}`, String(a.state || "—"))}
                              </span>
                            </td>
                            <td className="py-1 pr-3 text-right text-gray-400">
                              {fmt(a.tokens || 0)}
                            </td>
                            <td className="py-1 pr-3 text-right text-gray-400">
                              {a.toolCalls || 0}
                            </td>
                            <td className="py-1 pr-3 text-right text-gray-400">
                              {a.durationMs != null ? formatMs(a.durationMs) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-600">{t("runs.noAgents")}</p>
                )}

                {/* Clickable, colored, expandable results — full content on click */}
                {resultRows.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-gray-600">
                      {t("runs.resultsLabel")}
                      <span className="ml-1 text-gray-700">· {resultRows.length}</span>
                    </div>
                    {resultRows.map((a, i) => {
                      const key = `${run.run_id}::${a.agentId || i}`;
                      const open = openResults.has(key);
                      return (
                        <div
                          key={key}
                          className="rounded border border-gray-800/70 bg-gray-900/30 overflow-hidden"
                        >
                          <button
                            onClick={() => toggleResult(key)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-800/40 transition-colors"
                            aria-expanded={open}
                          >
                            {open ? (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            )}
                            <span
                              className={`badge text-[10px] border flex-shrink-0 ${phaseColor(phaseTitles, a.phaseTitle)}`}
                            >
                              {a.label || a.agentType || a.agentId}
                            </span>
                            {!open && (
                              <span className="text-[11px] text-gray-500 leading-snug min-w-0">
                                {truncate(friendlyPreview(a.resultPreview), 160)}
                              </span>
                            )}
                          </button>
                          {open && (
                            <div className="px-2.5 pb-2.5 pt-0.5 space-y-2">
                              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                                {a.model && <span className="font-mono">{a.model}</span>}
                                <span
                                  className={`badge border ${statusClass(String(a.state || ""))}`}
                                >
                                  {t(`runs.status.${a.state}`, String(a.state || "—"))}
                                </span>
                                <span>
                                  {fmt(a.tokens || 0)} {t("runs.tokens")}
                                </span>
                                <span>{t("runs.tools", { count: a.toolCalls || 0 })}</span>
                                {a.durationMs != null && <span>{formatMs(a.durationMs)}</span>}
                              </div>
                              {a.promptPreview && (
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">
                                    {t("runs.promptLabel")}
                                  </div>
                                  <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words bg-black/30 rounded p-2 max-h-48 overflow-auto">
                                    {String(a.promptPreview)}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-0.5">
                                  {t("runs.resultLabel")}
                                </div>
                                <pre className="text-[11px] text-gray-300 whitespace-pre-wrap break-words bg-black/30 rounded p-2 max-h-96 overflow-auto">
                                  {fullPreview(a.resultPreview)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
