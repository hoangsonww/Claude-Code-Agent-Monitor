/**
 * @file WorkflowRunsPanel.tsx
 * @description Surfaces Workflow-tool runs (issue #167) — fleets of inner
 * sub-agents spawned by the Claude Code "Workflow" tool, ingested from on-disk
 * run journals. Works in two modes: controlled (pass `runs`, e.g. from
 * SessionDetail) or self-fetching (pass a `statusFilter`, e.g. the Workflows
 * page) with live `workflow_upserted` updates. Each run expands to its phases
 * and a per-agent breakdown sourced from the journal's progress[].
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Workflow, ChevronRight, ChevronDown, Layers, ExternalLink } from "lucide-react";
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

  if (!controlled && loading) {
    return <p className="text-sm text-gray-500">{t("runs.loading")}</p>;
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
        // progress[] mixes phase markers and agents; only `workflow_agent`
        // entries are real agents.
        const agentRows = (run.progress || []).filter((p) => p.type === "workflow_agent");
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
              <Workflow className="w-4 h-4 text-violet-400 flex-shrink-0" />
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
              <div className="px-3 pb-3 pt-1 border-t border-gray-800/60 space-y-3">
                {run.phases.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Layers className="w-3.5 h-3.5 text-gray-500" />
                    {run.phases.map((p, i) => (
                      <span
                        key={i}
                        className="badge text-[10px] bg-gray-700/40 text-gray-300 border border-gray-700"
                      >
                        {p.title || `#${i + 1}`}
                      </span>
                    ))}
                  </div>
                )}

                {agentRows.length > 0 ? (
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
                        {agentRows.map((a: WorkflowProgressEntry, i) => (
                          <tr key={a.agentId || i} className="border-b border-gray-800/40">
                            <td className="py-1 pr-3 text-gray-300">
                              {a.label || a.agentType || a.agentId}
                              {a.lastToolName && (
                                <span className="text-gray-600 font-mono ml-1">
                                  · {a.lastToolName}
                                </span>
                              )}
                            </td>
                            <td className="py-1 pr-3 text-gray-400">{a.phaseTitle || "—"}</td>
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

                {agentRows.some((a) => a.promptPreview || a.resultPreview) && (
                  <div className="space-y-1">
                    {agentRows
                      .filter((a) => a.resultPreview)
                      .slice(0, 3)
                      .map((a, i) => (
                        <p key={i} className="text-[11px] text-gray-500">
                          <span className="text-gray-400">{a.label || a.agentType}:</span>{" "}
                          {truncate(String(a.resultPreview), 160)}
                        </p>
                      ))}
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
