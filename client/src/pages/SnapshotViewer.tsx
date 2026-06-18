/**
 * @file SnapshotViewer.tsx
 * @description Public, read-only viewer for a shared session snapshot at
 * `/snapshot/:token`. Rendered OUTSIDE the app Layout (no sidebar, no nav, no
 * live websocket) so it's a clean shareable page. Fetches
 * GET /api/snapshots/:token and renders the captured session summary, agents,
 * and events with a prominent read-only banner, a "captured Nh ago" watermark,
 * and a note of which fields the author redacted. Revoked / expired / missing
 * snapshots (the shared request helper throws on 410/404) render a friendly
 * "no longer available" state.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Bot, Clock, Cpu, EyeOff, FolderOpen, Lock, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";
import { SessionStatusBadge, AgentStatusBadge } from "../components/StatusBadge";
import { effectiveSessionStatus, effectiveAgentStatus } from "../lib/types";
import { Skeleton } from "../components/Skeleton";
import {
  formatDateShort,
  formatDateTime,
  formatDateTimeFull,
  formatModelName,
} from "../lib/format";
import type { PublicSnapshot, SnapshotPayload, RedactionKey } from "../lib/types";

/** Human "captured Nh ago" from a server-supplied age in seconds. */
function formatAge(
  ageSeconds: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const sec = Math.max(0, Math.floor(ageSeconds));
  if (sec < 60) return t("common:time.justNow");
  const min = Math.floor(sec / 60);
  if (min < 60) return t("common:time.mAgo", { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("common:time.hAgo", { count: hr });
  const days = Math.floor(hr / 24);
  return t("common:time.dAgo", { count: days });
}

export function SnapshotViewer() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation("snapshots");
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [payload, setPayload] = useState<SnapshotPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!token) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setUnavailable(false);
    api.snapshots
      .get(token)
      .then((res) => {
        if (cancelled) return;
        setSnapshot(res.snapshot);
        setPayload(res.payload);
      })
      .catch(() => {
        // 410 (revoked/expired) and 404 (missing) both surface here via the
        // shared request helper. Show a single friendly "unavailable" state.
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0">
        <div className="max-w-4xl mx-auto px-5 py-10 space-y-6" aria-busy="true">
          <Skeleton className="h-12 w-full" rounded="lg" />
          <Skeleton className="h-7 w-72" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" rounded="lg" />
            ))}
          </div>
          <Skeleton className="h-40 w-full" rounded="lg" />
        </div>
      </div>
    );
  }

  if (unavailable || !snapshot || !payload) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <div className="card max-w-lg w-full p-8 md:p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">
            {t("viewer.unavailableTitle")}
          </h2>
          <p className="text-sm text-gray-400">{t("viewer.unavailableDesc")}</p>
        </div>
      </div>
    );
  }

  const { session, agents, events } = payload;
  const redactions = snapshot.redactions;

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Read-only banner — prominent, sticky at the top of the page. */}
      <div className="sticky top-0 z-20 border-b border-accent/30 bg-accent/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-100">{t("viewer.readOnly")}</p>
            <p className="text-[11px] text-gray-400 truncate">{t("viewer.readOnlyDesc")}</p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent bg-accent/15 border border-accent/25 px-2.5 py-1 rounded-full flex-shrink-0"
            title={t("viewer.capturedAt", { datetime: formatDateTimeFull(snapshot.captured_at) })}
          >
            <Clock className="w-3 h-3" />
            {t("viewer.captured", { age: formatAge(snapshot.age_seconds, t) })}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-8 animate-fade-in">
        {/* Session summary */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-xl font-semibold text-gray-100 truncate">
              {snapshot.title || session.name || `Session ${session.id.slice(0, 8)}`}
            </h1>
            <SessionStatusBadge status={effectiveSessionStatus(session)} pulse={false} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-surface-2 px-2 py-1 rounded">
              {session.id.slice(0, 16)}
            </span>
            {session.model && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-surface-2 px-2 py-1 rounded">
                <Cpu className="w-3 h-3 text-gray-500" />
                {formatModelName(session.model)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-surface-2 px-2 py-1 rounded">
              <Clock className="w-3 h-3 text-gray-500" />
              {formatDateTime(session.started_at)}
            </span>
          </div>
          {session.cwd && !redactions.includes("file_paths") && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
              <FolderOpen className="w-3 h-3 flex-shrink-0" />
              <span className="font-mono truncate">{session.cwd}</span>
            </div>
          )}
        </div>

        {/* Redaction note */}
        {redactions.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <EyeOff className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-amber-200 font-medium">{t("viewer.redactedNote")}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {redactions.map((key: RedactionKey) => (
                  <span
                    key={key}
                    className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5"
                  >
                    {t(`redactions.${key}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Agents */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-violet-400" />
            {t("viewer.agents")}
            <span className="text-gray-600 font-mono">· {agents.length}</span>
          </h2>
          {agents.length === 0 ? (
            <p className="text-sm text-gray-500">{t("viewer.noAgents")}</p>
          ) : (
            <div className="card divide-y divide-border overflow-hidden">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 px-4 py-3 min-w-0">
                  <AgentStatusBadge status={effectiveAgentStatus(agent)} pulse={false} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 truncate">
                      {agent.name || agent.subagent_type || agent.id.slice(0, 8)}
                    </p>
                    {agent.task && !redactions.includes("agent_tasks") && (
                      <p className="text-[11px] text-gray-500 truncate" title={agent.task}>
                        {agent.task}
                      </p>
                    )}
                  </div>
                  {agent.subagent_type && (
                    <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
                      {agent.subagent_type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Events */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-accent" />
            {t("viewer.events")}
            <span className="text-gray-600 font-mono">· {events.length}</span>
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">{t("viewer.noEvents")}</p>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 px-5 py-3 min-w-0">
                    <div className="w-16 flex-shrink-0 text-right font-mono leading-tight">
                      <div className="text-[11px] text-gray-500">
                        {formatDateShort(event.created_at)}
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-400 font-mono flex-shrink-0">
                      {event.event_type}
                    </span>
                    <span className="text-sm text-gray-300 flex-1 truncate">
                      {redactions.includes("event_summaries")
                        ? ""
                        : (event.summary ?? event.tool_name ?? "")}
                    </span>
                    {event.tool_name && (
                      <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
                        {event.tool_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
