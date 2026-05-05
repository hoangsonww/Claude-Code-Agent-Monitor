/**
 * @file ContextView.tsx
 * @description Read-only viewer for Claude Code context-management activity.
 * Shows a recent timeline of compaction events across every session, plus a
 * per-session drill-down picker that surfaces a session's compaction history
 * (paired Pre/PostCompact entries) and a rough event-count budget.
 *
 * v1 is intentionally a thin surface over the existing events table — actual
 * pre-compact transcript snapshots are not yet captured. When no compaction
 * events exist we render an explanatory empty state pointing to the hooks
 * page where Pre/PostCompact must be configured.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Database,
  GitCommit,
  Layers,
  Link as LinkIcon,
  RefreshCw,
  Scissors,
} from "lucide-react";
import {
  useCompactions,
  useSessionCompactions,
  useSessionBudget,
  type CompactionEvent,
  type SessionBudgetResponse,
} from "../hooks/useContext";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatDelta(a: string, b: string): string {
  try {
    const dt = Math.abs(new Date(a).getTime() - new Date(b).getTime());
    if (dt < 1000) return `${dt}ms`;
    if (dt < 60_000) return `${(dt / 1000).toFixed(1)}s`;
    if (dt < 3_600_000) return `${(dt / 60_000).toFixed(1)}m`;
    return `${(dt / 3_600_000).toFixed(1)}h`;
  } catch {
    return "—";
  }
}

function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function truncId(id: string): string {
  return id.length > 12 ? id.slice(0, 8) + "…" : id;
}

// ── Banners (mirror MemoryView/ChannelsView for visual consistency) ─────────

function DisabledBanner() {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-3">
      <AlertCircle className="w-8 h-8 text-accent" />
      <h3 className="text-lg font-semibold text-gray-100">Context routes disabled</h3>
      <p className="text-sm text-gray-400 max-w-md">
        Set <code className="text-accent">ORCHESTRATOR_ENABLED=1</code> in your{" "}
        <code className="text-accent">.env</code> and restart the server to enable read-only
        context-management browsing.
      </p>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card p-4 flex items-center gap-3 border border-red-500/40">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-400 flex-1">{error}</span>
      {onRetry ? (
        <button className="btn-ghost text-xs" onClick={onRetry}>
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function ContextView() {
  const compactions = useCompactions(200);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Auto-select the most recent session that has compactions on first load
  // so the per-session pane shows something useful immediately.
  useEffect(() => {
    if (selectedSession) return;
    const first = compactions.data?.events?.[0];
    if (first) setSelectedSession(first.sessionId);
  }, [compactions.data, selectedSession]);

  if (compactions.disabled) return <DisabledBanner />;

  if (compactions.loading && !compactions.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }

  if (compactions.error) {
    return <ErrorBanner error={compactions.error} onRetry={compactions.reload} />;
  }

  const events = compactions.data?.events ?? [];
  const summary = compactions.data?.summary;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
            <Scissors className="w-6 h-6 text-accent" />
            Context
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Compaction events across recent sessions. Read-only — pre-compact transcript snapshots
            are not yet captured.
          </p>
        </div>
        <button
          className="btn-ghost text-sm border border-border hover:border-border-light"
          onClick={() => compactions.reload()}
          aria-label="Reload compactions"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </header>

      {summary ? <SummaryStrip summary={summary} /> : null}

      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4">
          <Timeline
            events={events}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
          />
          <SessionPane
            sessionId={selectedSession}
            sessions={uniqueSessions(events)}
            onSelect={setSelectedSession}
          />
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function SummaryStrip({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useCompactions>["data"]>["summary"];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
      <Stat label="Total events" value={summary.total} />
      <Stat label="Sessions" value={summary.uniqueSessions} />
      <Stat label="Pre / Post pairs" value={summary.pairCount} />
      <Stat label="Pre / Post total" value={summary.preCompactCount + summary.postCompactCount} />
      <Stat label="Auto compactions" value={summary.compactionCount} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm text-gray-100 font-medium truncate" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-6 text-center">
      <Scissors className="w-8 h-8 text-gray-500 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-gray-200 mb-1">No compactions yet</h3>
      <p className="text-sm text-gray-400 max-w-md mx-auto">
        Compaction events appear here once Claude Code emits{" "}
        <code className="text-accent">PreCompact</code> and{" "}
        <code className="text-accent">PostCompact</code> hooks (or auto-detected{" "}
        <code className="text-accent">Compaction</code> markers in JSONL).
      </p>
      <p className="text-xs text-gray-500 mt-3">
        Make sure those hooks are wired up — see the{" "}
        <Link to="/settings" className="text-accent hover:underline">
          Settings page
        </Link>{" "}
        for the hook installer status.
      </p>
    </div>
  );
}

function uniqueSessions(events: CompactionEvent[]): {
  id: string;
  name: string | null;
  count: number;
}[] {
  const map = new Map<string, { id: string; name: string | null; count: number }>();
  for (const e of events) {
    const cur = map.get(e.sessionId);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(e.sessionId, { id: e.sessionId, name: e.sessionName ?? null, count: 1 });
    }
  }
  return [...map.values()];
}

function EventTypeChip({ type }: { type: CompactionEvent["eventType"] }) {
  const map: Record<CompactionEvent["eventType"], { label: string; cls: string }> = {
    PreCompact: {
      label: "Pre",
      cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    },
    PostCompact: {
      label: "Post",
      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    },
    Compaction: {
      label: "Auto",
      cls: "bg-accent/15 text-accent border-accent/30",
    },
  };
  const { label, cls } = map[type];
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${cls}`}
      title={type}
    >
      {label}
    </span>
  );
}

function Timeline({
  events,
  selectedSession,
  onSelectSession,
}: {
  events: CompactionEvent[];
  selectedSession: string | null;
  onSelectSession: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function togglePayload(id: number) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="card p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs uppercase tracking-wider text-gray-500">
          Timeline ({events.length})
        </span>
        <span className="text-[10px] text-gray-500">newest first</span>
      </div>
      <ol className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id}>
            <article
              className={
                "px-3 py-2 rounded-md border text-xs transition-colors " +
                (e.sessionId === selectedSession
                  ? "bg-surface-2 border-accent/40"
                  : "bg-surface-1 border-border hover:border-border-light")
              }
            >
              <div className="flex items-center gap-2 flex-wrap">
                <EventTypeChip type={e.eventType} />
                <button
                  className="text-gray-100 font-medium truncate hover:text-accent"
                  onClick={() => onSelectSession(e.sessionId)}
                  title={e.sessionId}
                >
                  {e.sessionName || truncId(e.sessionId)}
                </button>
                {e.pairId !== null ? (
                  <span
                    className="text-[10px] text-gray-500 flex items-center gap-1"
                    title={`paired (#${e.pairId})`}
                  >
                    <LinkIcon className="w-3 h-3" />#{e.pairId}
                  </span>
                ) : null}
                <span className="text-gray-500 ml-auto flex-shrink-0">{formatTime(e.timestamp)}</span>
              </div>
              {e.summary ? (
                <p className="text-gray-400 mt-1 truncate" title={e.summary}>
                  {e.summary}
                </p>
              ) : null}
              {e.payload && Object.keys(e.payload).length > 0 ? (
                <details
                  className="mt-1.5"
                  open={expanded.has(e.id)}
                  onToggle={(ev) => {
                    if ((ev.target as HTMLDetailsElement).open) togglePayload(e.id);
                    else togglePayload(e.id);
                  }}
                >
                  <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-300 select-none">
                    payload
                  </summary>
                  <pre className="mt-1 bg-surface-2 rounded p-2 text-[10px] text-gray-300 whitespace-pre-wrap break-words max-h-48 overflow-auto">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </details>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SessionPane({
  sessionId,
  sessions,
  onSelect,
}: {
  sessionId: string | null;
  sessions: { id: string; name: string | null; count: number }[];
  onSelect: (id: string) => void;
}) {
  const sessionEvents = useSessionCompactions(sessionId);
  const budget = useSessionBudget(sessionId);

  return (
    <aside className="card p-3 space-y-3 max-h-[calc(100vh-12rem)] overflow-auto">
      <div>
        <label
          htmlFor="ctx-session-picker"
          className="text-[10px] uppercase tracking-wider text-gray-500"
        >
          Session
        </label>
        <select
          id="ctx-session-picker"
          className="w-full mt-1 bg-surface-2 border border-border rounded px-2 py-1.5 text-xs text-gray-100"
          value={sessionId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
        >
          {sessions.length === 0 ? (
            <option value="">No sessions</option>
          ) : (
            sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.name || truncId(s.id)) + ` — ${s.count}`}
              </option>
            ))
          )}
        </select>
        {sessionId ? (
          <Link
            to={`/sessions/${encodeURIComponent(sessionId)}`}
            className="text-[10px] text-accent hover:underline inline-flex items-center gap-1 mt-1"
          >
            Open session detail
          </Link>
        ) : null}
      </div>

      {!sessionId ? (
        <p className="text-xs text-gray-500">Pick a session to view its compaction history.</p>
      ) : (
        <>
          <BudgetCard budget={budget.data} loading={budget.loading} error={budget.error} />
          <SessionHistory
            loading={sessionEvents.loading}
            error={sessionEvents.error}
            events={sessionEvents.data?.events ?? []}
          />
        </>
      )}
    </aside>
  );
}

function BudgetCard({
  budget,
  loading,
  error,
}: {
  budget: SessionBudgetResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && !budget) {
    return <div className="h-20 bg-surface-2 animate-pulse rounded" />;
  }
  if (error) return <ErrorBanner error={error} />;
  if (!budget) return null;

  // Show top event types so the operator can sniff out where the budget is
  // going. Keep the list short — the full counts live in the API response.
  const sortedTypes = Object.entries(budget.eventCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-2 border border-border rounded p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
        <Database className="w-3.5 h-3.5 text-accent" />
        Budget approximation
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <BudgetStat label="Total events" value={formatNum(budget.totalEvents)} />
        <BudgetStat label="Compactions" value={formatNum(budget.compactionEvents)} />
        {budget.tokens ? (
          <>
            <BudgetStat label="Input tokens" value={formatNum(budget.tokens.input_tokens)} />
            <BudgetStat label="Output tokens" value={formatNum(budget.tokens.output_tokens)} />
            <BudgetStat label="Cache reads" value={formatNum(budget.tokens.cache_read_tokens)} />
            <BudgetStat label="Cache writes" value={formatNum(budget.tokens.cache_write_tokens)} />
          </>
        ) : null}
      </div>
      {sortedTypes.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-300 select-none">
            Top event types
          </summary>
          <ul className="mt-1 space-y-0.5">
            {sortedTypes.map(([type, count]) => (
              <li key={type} className="flex justify-between text-[11px]">
                <span className="text-gray-400 truncate">{type}</span>
                <span className="text-gray-300 font-mono">{count}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="text-[10px] text-gray-500 leading-snug">{budget.note}</p>
    </div>
  );
}

function BudgetStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 truncate">{label}</span>
      <span className="text-gray-200 font-mono">{value}</span>
    </div>
  );
}

function SessionHistory({
  loading,
  error,
  events,
}: {
  loading: boolean;
  error: string | null;
  events: CompactionEvent[];
}) {
  // Group adjacent events by pair so we can render each Pre/Post couple as a
  // single condensed row showing the duration of compaction.
  const groups = useMemo(() => {
    const out: { kind: "pair" | "single"; events: CompactionEvent[] }[] = [];
    const byPair = new Map<number, CompactionEvent[]>();
    for (const e of events) {
      if (e.pairId !== null) {
        const list = byPair.get(e.pairId) ?? [];
        list.push(e);
        byPair.set(e.pairId, list);
      } else {
        out.push({ kind: "single", events: [e] });
      }
    }
    for (const [, list] of byPair) {
      out.push({ kind: "pair", events: list });
    }
    out.sort((a, b) => {
      const ta = a.events[0] ? new Date(a.events[0].timestamp).getTime() : 0;
      const tb = b.events[0] ? new Date(b.events[0].timestamp).getTime() : 0;
      return ta - tb;
    });
    return out;
  }, [events]);

  if (loading && events.length === 0) {
    return <div className="h-20 bg-surface-2 animate-pulse rounded" />;
  }
  if (error) return <ErrorBanner error={error} />;
  if (events.length === 0) {
    return <p className="text-xs text-gray-500">No compactions for this session.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
        <Layers className="w-3.5 h-3.5 text-accent" />
        History ({events.length})
      </div>
      <ol className="space-y-1.5">
        {groups.map((g, idx) => (
          <li
            key={idx}
            className="border border-border rounded px-2.5 py-1.5 text-[11px] bg-surface-1"
          >
            {g.kind === "pair" ? (
              <PairRow events={g.events} />
            ) : g.events[0] ? (
              <SingleRow event={g.events[0]} />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PairRow({ events }: { events: CompactionEvent[] }) {
  const pre = events.find((e) => e.eventType === "PreCompact");
  const post = events.find((e) => e.eventType === "PostCompact");
  const first = events[0];
  const last = events[events.length - 1];
  const startTs = pre?.timestamp ?? first?.timestamp ?? "";
  const endTs = post?.timestamp ?? last?.timestamp ?? startTs;
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <EventTypeChip type="PreCompact" />
        <GitCommit className="w-3 h-3 text-gray-500" />
        <EventTypeChip type="PostCompact" />
        <span className="text-gray-500 ml-auto">{formatTime(startTs)}</span>
      </div>
      <p className="text-gray-400 mt-1 flex items-center gap-1.5">
        <span>compacted in</span>
        <span className="font-mono text-gray-200">{formatDelta(startTs, endTs)}</span>
      </p>
      {post?.summary ? (
        <p className="text-gray-500 mt-0.5 truncate" title={post.summary}>
          {post.summary}
        </p>
      ) : null}
    </div>
  );
}

function SingleRow({ event }: { event: CompactionEvent }) {
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <EventTypeChip type={event.eventType} />
        <span className="text-gray-500 ml-auto">{formatTime(event.timestamp)}</span>
      </div>
      {event.summary ? (
        <p className="text-gray-400 mt-1 truncate" title={event.summary}>
          {event.summary}
        </p>
      ) : null}
    </div>
  );
}

export default ContextView;
