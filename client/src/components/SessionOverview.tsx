/**
 * @file SessionOverview.tsx
 * @description Real-time stats panel rendered at the top of the Agents tab on the
 * Session detail page. Shows tile counters (events, tool calls, subagents, errors,
 * compactions, duration), top-tool usage bars, subagent-type breakdown, and a token
 * flow strip. Live-refreshes on `new_event` (debounced) so counters track the running
 * session without spamming the backend.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/SessionOverview.tsx
 * **Area:** client component
 * **Responsibility:**
 * Real-time stats panel rendered at the top of the Agents tab on the Session detail page. Shows
 * tile counters (events, tool calls, subagents, errors, compactions, duration), top-tool usage
 * bars, subagent-type breakdown, and a token flow strip. Live-refreshes on `new_event` (debounced)
 * so counters track the running session without spamming the backend.
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Local dependency edges
 * - `../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/format` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/remoteDataEvents` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./conversation/toolStyle` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `SessionOverview` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `REFRESH_DEBOUNCE_MS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SessionOverview` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionOverviewProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `StatTile` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TokenFlowBar` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ToolUsageRow` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 *
 * ## Area invariants
 * - Keep prop meaning and callback timing stable; parent components often rely on both even when
 *   types still compile.
 * - Render valid semantic controls with accessible names, focus behavior, disabled states, and
 *   keyboard operation.
 * - Keep visible strings in the appropriate i18n namespace rather than embedding English-only
 *   literals.
 * - Use shared design tokens and existing primitives so light/dark styling and compact layouts
 *   remain coherent.
 * - Avoid mutating arrays or objects received through props; derived display data should be
 *   computed immutably.
 * - Make empty and unavailable values explicit instead of rendering misleading zeroes or
 *   placeholder punctuation.
 * - Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction
 *   requires it.
 * - Do not duplicate server validation or destructive gates as if client-side checks were
 *   authoritative.
 * - Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated
 *   copy.
 * - Prefer stable keys derived from entity identity over array indexes for live, filtered, or
 *   reordered collections.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/SessionOverview.tsx` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/SessionOverview.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * - `../lib/api`
 * - `../lib/eventBus`
 * - `../lib/format`
 * - `./conversation/toolStyle`
 * - `../lib/types`
 *
 * ## Public surface
 * - `SessionOverview` — exported API; see TSDoc on the symbol for behavior.
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
 * **SessionOverview**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Wrench,
  GitBranch,
  AlertTriangle,
  Layers,
  Clock,
  Coins,
  Bot,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { isRemoteDataRefreshMessage } from "../lib/remoteDataEvents";
import { fmt, formatDuration } from "../lib/format";
import { styleForTool } from "./conversation/toolStyle";
import type { Agent, Session, SessionStats } from "../lib/types";

/** Props for {@link SessionOverview}. */
interface SessionOverviewProps {
  /** Session to summarize. */
  session: Session;
  /** Agents of the session, for the agent counts. */
  agents: Agent[];
}

/** Debounce window for stats refresh - coalesces bursts of hook events into one fetch. */
const REFRESH_DEBOUNCE_MS = 600;

/** Compact tile used in the top stat row. */
function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  /** Tile label. */
  label: string;
  /** Value to show. */
  value: React.ReactNode;
  /** Optional helper line under the value. */
  hint?: string;
  /** Icon element. */
  icon: React.ReactNode;
  /** Accent color of the tile; defaults to neutral. */
  tone?: "default" | "violet" | "emerald" | "amber" | "rose" | "cyan" | "blue";
}) {
  const palette = {
    default: "border-surface-3 bg-surface-2 text-gray-200",
    violet: "border-violet-500/20 bg-violet-500/5 text-violet-200",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-200",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-200",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-200",
    cyan: "border-cyan-500/20 bg-cyan-500/5 text-cyan-200",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-200",
  }[tone];

  const iconTone = {
    default: "text-gray-500",
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    cyan: "text-cyan-400",
    blue: "text-blue-400",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${palette}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500">
        <span className={iconTone}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-gray-100 leading-tight">
        {value}
      </div>
      {hint && <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

/**
 * One tool in the tool-usage list: tool icon and name, a bar scaled against the most used tool (at
 * least 2% wide), and the count.
 */
function ToolUsageRow({ toolName, count, max }: { toolName: string; count: number; max: number }) {
  const style = styleForTool(toolName);
  const Icon = style.Icon;
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;

  return (
    <div className="flex items-center gap-3 group/tool">
      <div className={`flex items-center gap-2 w-32 flex-shrink-0 ${style.text}`}>
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded ${style.chip} flex-shrink-0`}
        >
          <Icon className="w-3 h-3" />
        </span>
        <span className="font-mono text-xs truncate" title={toolName}>
          {toolName}
        </span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-surface-3/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${style.bar} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-gray-400 w-14 text-right flex-shrink-0">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

/**
 * Overview card at the top of Session Detail: duration (ticking every 30 seconds while the session
 * is active), agent and tool-call counts, token totals with a breakdown bar, and the most used
 * tools. Stats come from `/api/sessions/:id/stats` and refresh on matching WebSocket messages,
 * debounced.
 */
export function SessionOverview({ session, agents }: SessionOverviewProps) {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);

  // Tick clock every 30s so a still-active session's "duration" tile stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (session.status !== "active") return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [session.status]);

  /**
   * Fetch session stats, skipping the call when one is already in flight. Failures leave the
   * previous figures in place.
   */
  const fetchStats = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const result = await api.sessions.stats(session.id);
      setStats(result);
    } catch {
      // Non-fatal - overview just won't update this round.
    } finally {
      fetchingRef.current = false;
    }
  };

  // Initial load + reload when the session id changes.
  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Live refresh on websocket events (debounced).
  useEffect(() => {
    const unsubscribe = eventBus.subscribe((msg) => {
      if (isRemoteDataRefreshMessage(msg)) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          fetchStats();
        }, REFRESH_DEBOUNCE_MS);
        return;
      }
      const isRelevant =
        msg.type === "new_event" ||
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "session_updated";
      if (!isRelevant) return;
      const data = msg.data as { session_id?: string; id?: string };
      // Match either by session_id (events) or by id (session_updated)
      const matchesSession = data.session_id === session.id || data.id === session.id;
      if (!matchesSession) return;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        fetchStats();
      }, REFRESH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Tool calls = sum of all tool counts (PreToolUse+PostToolUse events have a tool_name).
  // We approximate "tool calls" as half of that (each call produces a Pre + Post event).
  const toolCallCount = useMemo(() => {
    if (!stats) return 0;
    const total = stats.tools_used.reduce((s, t) => s + t.count, 0);
    return Math.round(total / 2);
  }, [stats]);

  /** Count of the most used tool, which fills the tool bars. */
  const maxToolCount = useMemo(() => {
    if (!stats) return 0;
    return stats.tools_used.reduce((m, t) => Math.max(m, t.count), 0);
  }, [stats]);

  // Active agent (if any)
  const activeAgent = useMemo(() => agents.find((a) => a.status === "working") ?? null, [agents]);

  // Duration: ended_at - started_at, or now - started_at if active
  const durationLabel = useMemo(() => {
    if (!session.started_at) return "-";
    const end = session.ended_at ?? new Date(now).toISOString();
    return formatDuration(session.started_at, end);
  }, [session.started_at, session.ended_at, now]);

  // Avg event rate (events / minute)
  const eventRate = useMemo(() => {
    if (!stats || !session.started_at) return null;
    const start = new Date(session.started_at).getTime();
    const end = session.ended_at
      ? new Date(session.ended_at).getTime()
      : stats.last_event_at
        ? new Date(stats.last_event_at).getTime()
        : now;
    const minutes = Math.max(1, (end - start) / 60_000);
    return stats.total_events / minutes;
  }, [stats, session.started_at, session.ended_at, now]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[68px] rounded-lg border border-surface-3 bg-surface-2/40" />
        ))}
      </div>
    );
  }

  const tokens = stats.tokens;
  const totalTokens =
    tokens.input_tokens +
    tokens.output_tokens +
    tokens.cache_read_tokens +
    tokens.cache_write_tokens;

  return (
    <div className="space-y-5 mb-6">
      {/* Active-agent banner - only shows when session is running */}
      {activeAgent && (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <Bot className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
          <span className="text-xs text-emerald-200 font-medium flex-shrink-0">
            {activeAgent.name || "Agent"}
          </span>
          {activeAgent.current_tool && (
            <span className="text-[11px] text-gray-400 font-mono inline-flex items-center gap-1">
              <span className="text-gray-600">running</span>
              <span className="text-emerald-300">{activeAgent.current_tool}</span>
            </span>
          )}
          {activeAgent.task && (
            <span className="text-[11px] text-gray-400 truncate min-w-0" title={activeAgent.task}>
              · {activeAgent.task}
            </span>
          )}
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatTile
          label="Events"
          value={stats.total_events.toLocaleString()}
          hint={
            eventRate !== null && eventRate > 0
              ? `${eventRate < 1 ? eventRate.toFixed(2) : Math.round(eventRate)}/min`
              : undefined
          }
          icon={<Activity className="w-3 h-3" />}
        />
        <StatTile
          label="Tool calls"
          value={toolCallCount.toLocaleString()}
          hint={stats.tools_used.length > 0 ? `${stats.tools_used.length} unique` : undefined}
          icon={<Wrench className="w-3 h-3" />}
          tone="violet"
        />
        <StatTile
          label="Subagents"
          value={stats.agents.subagent.toLocaleString()}
          hint={stats.agents.main > 0 ? `+${stats.agents.main} main` : undefined}
          icon={<GitBranch className="w-3 h-3" />}
          tone="cyan"
        />
        <StatTile
          label="Compactions"
          value={stats.agents.compaction.toLocaleString()}
          icon={<Layers className="w-3 h-3" />}
          tone="blue"
        />
        <StatTile
          label="Errors"
          value={stats.error_count.toLocaleString()}
          icon={<AlertTriangle className="w-3 h-3" />}
          tone={stats.error_count > 0 ? "rose" : "default"}
        />
        <StatTile
          label="Duration"
          value={durationLabel}
          hint={session.status === "active" ? "running" : "completed"}
          icon={<Clock className="w-3 h-3" />}
          tone={session.status === "active" ? "emerald" : "default"}
        />
      </div>

      {/* Two-column layout: tools + subagent breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tool usage */}
        <div className="lg:col-span-2 rounded-lg border border-surface-3 bg-surface-2/60 p-3.5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-violet-400" />
              Top tools
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">
              {stats.tools_used.length} total
            </span>
          </div>
          {stats.tools_used.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500">No tool calls yet.</div>
          ) : (
            <div className="space-y-1.5">
              {stats.tools_used.slice(0, 8).map((t) => (
                <ToolUsageRow
                  key={t.tool_name}
                  toolName={t.tool_name}
                  count={t.count}
                  max={maxToolCount}
                />
              ))}
            </div>
          )}
        </div>

        {/* Subagent breakdown.
         *
         * The /api/sessions/:id/stats endpoint deliberately strips compaction
         * agents from `subagent_types` so the workflow analytics don't lump
         * them in. But on this overview a session with only compactions still
         * has *something* to show - surfacing zero subagents while the agents
         * tab below clearly lists "Context Compaction" cards is confusing.
         *
         * We synthesize a compaction row from `stats.agents.compaction` and
         * render it alongside any real subagent types, distinguished by an
         * amber bar (matching the compaction iconography elsewhere in the
         * app) instead of cyan. */}
        <div className="rounded-lg border border-surface-3 bg-surface-2/60 p-3.5">
          {(() => {
            type SubRow = { key: string; label: string; count: number; isCompaction: boolean };
            const rows: SubRow[] = stats.subagent_types.map((s) => ({
              key: s.subagent_type,
              label: s.subagent_type,
              count: s.count,
              isCompaction: false,
            }));
            if (stats.agents.compaction > 0) {
              rows.push({
                key: "__compaction__",
                label: "Context Compaction",
                count: stats.agents.compaction,
                isCompaction: true,
              });
            }
            const totalRuns = rows.reduce((s, r) => s + r.count, 0);
            const max = rows.reduce((m, r) => Math.max(m, r.count), 0);

            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                    Subagents
                  </h3>
                  <span className="text-[10px] text-gray-500 font-mono">{totalRuns} runs</span>
                </div>
                {rows.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500">
                    No subagents in this session.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rows.slice(0, 8).map((r) => {
                      const pct = max > 0 ? Math.max(4, Math.round((r.count / max) * 100)) : 0;
                      const barClass = r.isCompaction ? "bg-amber-500/60" : "bg-cyan-500/60";
                      return (
                        <div key={r.key} className="flex items-center gap-2">
                          <span
                            className={`font-mono text-xs truncate flex-1 min-w-0 ${
                              r.isCompaction ? "text-amber-300" : "text-gray-300"
                            }`}
                            title={r.label}
                          >
                            {r.label}
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-surface-3/60 overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${barClass}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-gray-400 w-8 text-right flex-shrink-0">
                            {r.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Token flow strip */}
      {totalTokens > 0 && (
        <div className="rounded-lg border border-surface-3 bg-surface-2/60 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              Token flow
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">{fmt(totalTokens)} total</span>
          </div>
          <TokenFlowBar tokens={tokens} total={totalTokens} />
        </div>
      )}

      {/* Event-type breakdown - secondary, only top 6 */}
      {stats.events_by_type.length > 0 && (
        <div className="rounded-lg border border-surface-3 bg-surface-2/60 p-3.5">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-gray-400" />
            Event mix
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {stats.events_by_type.slice(0, 12).map((e) => (
              <span
                key={e.event_type}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono bg-surface-3/60 border border-surface-3 rounded-md px-2 py-0.5"
              >
                <span className="text-gray-400">{e.event_type}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-200">{e.count.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Stacked bar splitting the session's tokens into cache read, cache write, input, and output, with
 * a legend.
 */
function TokenFlowBar({ tokens, total }: { tokens: SessionStats["tokens"]; total: number }) {
  const segments = [
    {
      key: "cache_read",
      label: "Cache read",
      value: tokens.cache_read_tokens,
      cls: "bg-sky-500",
      text: "text-sky-300",
    },
    {
      key: "cache_write",
      label: "Cache write",
      value: tokens.cache_write_tokens,
      cls: "bg-violet-500",
      text: "text-violet-300",
    },
    {
      key: "input",
      label: "Input",
      value: tokens.input_tokens,
      cls: "bg-emerald-500",
      text: "text-emerald-300",
    },
    {
      key: "output",
      label: "Output",
      value: tokens.output_tokens,
      cls: "bg-orange-500",
      text: "text-orange-300",
    },
  ];

  return (
    <>
      <div className="flex w-full h-2 rounded-full overflow-hidden bg-surface-3/60 mb-3">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={s.key}
              className={`${s.cls} opacity-80 hover:opacity-100 transition-opacity`}
              style={{ width: `${pct}%` }}
              title={`${s.label}: ${s.value.toLocaleString()} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {segments.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className={`block w-2 h-2 rounded-full ${s.cls}`} />
              <span className="text-gray-500 text-[11px]">{s.label}</span>
              <span className={`font-mono ml-auto ${s.text}`}>
                {fmt(s.value)}
                {pct > 0 && (
                  <span className="text-gray-600 text-[10px] ml-1">
                    {pct >= 1 ? Math.round(pct) : pct.toFixed(1)}%
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
