/**
 * @file AgentCard.tsx
 * @description Defines the AgentCard component that displays a summary of an
 * agent's name, status, task, current tool, timestamps, and native Codex
 * title plus a latest-two-human-turn context. The card is clickable and
 * navigates to session details while visually distinguishing active agents.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/AgentCard.tsx`
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
 * - `./StatusBadge`
 * - `../lib/types`
 * - `../lib/format`
 *
 * ## Public surface
 * - `AgentCard` — exported API; see TSDoc on the symbol for behavior.
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
 * **AgentCard**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useTranslation } from "react-i18next";
import { Bot, GitBranch, Clock, Wrench, Cpu, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AgentStatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { effectiveAgentStatus, isAgentAwaitingInput, agentAwaitingReason } from "../lib/types";
import type { Agent, Session } from "../lib/types";
import { formatDuration, timeAgo, formatModelName, pathBasename, fmtCost } from "../lib/format";

/**
 * Display name for a main agent, swapping its auto-generated placeholder for the
 * real session title when one exists. Main agents are created as
 * `<prefix> - <placeholder>`, where the placeholder is either `Session <id8>`
 * (live hooks) or `<cwd-folder> - <id8>` (import / background sync). Replacing
 * everything after the first ` - ` covers BOTH formats — the older
 * `replace(/Session [0-9a-f]{8}/)` only matched the hook form, so imported
 * sessions kept showing `<folder> - <id8>` even after their title was known.
 */
function mainAgentDisplayName(agentName: string, realSessionName: string): string {
  if (!realSessionName) return agentName;
  const sep = agentName.indexOf(" - ");
  return sep >= 0 ? `${agentName.slice(0, sep)} - ${realSessionName}` : agentName;
}

/** Keep a compact card's history legible: at most two distinct human turns,
 * one visual row each. This intentionally preserves a title-matching first
 * request when a terse follow-up depends on it for context. */
function promptPreviewLines(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toLocaleLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-2);
}

interface AgentCardProps {
  agent: Agent;
  /** Optional session data for richer main-agent rendering (model, cwd,
   *  cost). Subagent display ignores this. When omitted, the card falls
   *  back to the original minimal layout. */
  session?: Session;
  label?: string;
  onClick?: () => void;
}

export function AgentCard({ agent, session, label, onClick }: AgentCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("kanban");
  const isWaiting = agent.status === "waiting" || isAgentAwaitingInput(agent);
  const status = effectiveAgentStatus(agent);
  const isActive = agent.status === "working";
  const isMain = agent.type === "main";

  // Session-level metadata applies to every card in the session - main and
  // subagents alike. Subtitle differs by type: main uses model+cwd (its
  // auto-generated name carries no info), subagents stick with their
  // subagent_type label (more useful than repeating the session model).
  const model = formatModelName(session?.model);
  const cwdBase = pathBasename(session?.cwd);
  // Cost shown on the card is scoped to what the card represents: a main agent's
  // card stands in for the whole session, so it shows the session total; a
  // subagent's card shows that subagent's OWN cost (server-computed from its
  // token buckets). Showing the session total on a subagent card is misleading —
  // it reads as if that one subagent cost the whole session's spend. A subagent
  // with no recorded usage shows no cost (the cost > 0 guard below hides it),
  // which is truthful rather than misleading.
  const cost = isMain
    ? typeof session?.cost === "number"
      ? session.cost
      : 0
    : typeof agent.cost === "number"
      ? agent.cost
      : 0;
  // Progress bar shows only when the agent is actively working AND has a real
  // denominator (TodoWrite items or workflow fleet). No denominator → no bar
  // (we never fake a percent from time/tool-counts).
  const progressTotal = typeof agent.todo_total === "number" ? agent.todo_total : 0;
  const progressDone = typeof agent.todo_done === "number" ? agent.todo_done : 0;
  const showProgress = isActive && progressTotal > 0;
  const progressPct =
    progressTotal > 0
      ? Math.round((Math.min(progressDone, progressTotal) / progressTotal) * 100)
      : 0;
  // Real (user-given) session name - auto-generated Claude/Codex fallbacks
  // carry no extra info next to the ID, so they are suppressed.
  const sessionName = session?.name?.trim() || "";
  const realSessionName = /^(Session [0-9a-f]{8}|Codex session)$/i.test(sessionName)
    ? ""
    : sessionName;
  const isCodexMain = isMain && session?.provider === "codex" && agent.name.trim() === "Codex";
  const displayName = isCodexMain
    ? `Codex · ${realSessionName || agent.session_id.slice(0, 8)}`
    : isMain
      ? mainAgentDisplayName(agent.name, realSessionName)
      : agent.name;
  // Session titles and requests are intentionally independent: Claude and
  // Codex both persist two recent real human turns on the session, while a
  // main-agent task remains the truthful fallback for pre-preview history.
  // Subagents keep their own assigned task instead of inheriting the parent.
  const taskPreview = isMain
    ? session?.prompt_preview?.trim() || agent.task?.trim() || null
    : agent.task?.trim() || null;
  const taskPreviewLines = promptPreviewLines(taskPreview);
  // A subagent's own model lives in its metadata (resolved from its transcript,
  // not the parent session's — see issue #185). Use it everywhere this card
  // shows a model so a Haiku QA agent under an Opus orchestrator reads as
  // Haiku, not Opus. Falls back to the session model only for the main agent.
  let subagentModel: string | null = null;
  if (!isMain && agent.metadata) {
    try {
      const parsed = JSON.parse(agent.metadata) as { model?: string };
      subagentModel = parsed?.model ? formatModelName(parsed.model) : null;
    } catch {
      subagentModel = null;
    }
  }
  // The model badge (footer) must reflect THIS card's agent: the session model
  // for main, the subagent's own model for subagents.
  const displayModel = isMain ? model : subagentModel;
  // Model now lives in the footer badge, so the subtitle carries project
  // context instead: main shows cwd + how many agents the session spawned +
  // how many turns it has run; subagents show their type + the project they ran
  // in. (No model here — that would duplicate the footer badge, which is what
  // main cards used to do.)
  const agentCount = typeof session?.agent_count === "number" ? session.agent_count : 0;
  // agent_count includes the main agent itself. Show how many SUBAGENTS the
  // session spawned instead, so this reconciles with the "Active Subagents"
  // dashboard stat (which excludes main agents) — otherwise a card reading
  // "29 agents" looks like it should equal a 29-subagent stat when the session
  // actually has 28 subagents + 1 main.
  const subagentCount = Math.max(0, agentCount - 1);
  let sessionTurns = 0;
  if (isMain && session?.metadata) {
    try {
      const m = JSON.parse(session.metadata) as { turn_count?: number };
      if (typeof m?.turn_count === "number") sessionTurns = m.turn_count;
    } catch {
      sessionTurns = 0;
    }
  }
  const subtitle = isMain
    ? [
        cwdBase,
        subagentCount > 0 ? t("kanban:session.subagentSummary", { count: subagentCount }) : null,
        sessionTurns > 0 ? t("kanban:session.turnSummary", { count: sessionTurns }) : null,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : [label || agent.subagent_type, cwdBase].filter(Boolean).join(" · ") || null;

  function handleClick() {
    if (onClick) {
      onClick();
    } else {
      navigate(`/sessions/${agent.session_id}`);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`card-hover p-4 cursor-pointer overflow-hidden ${
        isWaiting
          ? "border-l-2 border-l-yellow-500/60"
          : isActive
            ? "border-l-2 border-l-emerald-500/50"
            : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
              isMain ? "bg-accent/15 text-accent" : "bg-violet-500/15 text-violet-400"
            }`}
          >
            {isMain ? <Bot className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-gray-200 truncate">
              {/* Auto-generated main-agent titles (e.g. "Main Agent - Session
                  229d93fd" or "Main Agent - work - e3f8e613") swap the
                  placeholder for the real session name when one exists. Codex
                  main agents use their native renamed title (or short ID) so
                  a board never shows a bare, indistinguishable "Codex". */}
              {displayName}
            </p>
            {subtitle && <p className="text-[11px] text-gray-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {/* compact: cards are narrow — inline reason chip would squeeze the
            title, so the reason stays hover-tooltip-only here. */}
        <AgentStatusBadge
          status={status}
          reason={agentAwaitingReason(agent)}
          provider={session?.provider}
          compact
        />
      </div>

      {taskPreviewLines.length > 0 && (
        <div className="mb-3 space-y-1 border-l-2 border-accent/25 pl-2.5">
          {taskPreviewLines.map((prompt, index) => (
            <p
              key={`${index}-${prompt}`}
              className="text-xs text-gray-400 leading-relaxed line-clamp-1"
              title={prompt}
            >
              {prompt}
            </p>
          ))}
        </div>
      )}

      {showProgress && (
        <div className="mb-3">
          <ProgressBar
            done={progressDone}
            total={progressTotal}
            title={t("progress.tooltip", {
              pct: progressPct,
              done: progressDone,
              total: progressTotal,
              context: agent.progress_source === "workflow" ? "workflow" : "todo",
            })}
            ariaLabel={t("progress.aria", { pct: progressPct })}
          />
        </div>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-500 min-w-0 overflow-hidden flex-wrap">
        {agent.current_tool && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Wrench className="w-3 h-3" />
            {agent.current_tool}
          </span>
        )}
        {/* Model badge - shown on every card when no tool is currently
            running (avoids clutter on actively-running agents that already
            display the running tool name). Uses the agent's OWN model:
            session model for main, the subagent's resolved model otherwise. */}
        {displayModel && !agent.current_tool && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Cpu className="w-3 h-3" />
            {displayModel}
          </span>
        )}
        {cost > 0 && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Coins className="w-3 h-3" />
            {fmtCost(cost)}
          </span>
        )}
        {agent.ended_at ? (
          <>
            <span className="flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {t("ran")}
              {formatDuration(agent.started_at, agent.ended_at)}
            </span>
            <span className="text-gray-600 flex-shrink-0">{timeAgo(agent.ended_at)}</span>
          </>
        ) : (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" />
            {timeAgo(agent.last_activity || agent.updated_at || agent.started_at)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 min-w-0 opacity-50">
          {realSessionName && !isCodexMain && (
            <span className="truncate max-w-[10rem]">{realSessionName} ·</span>
          )}
          <span className="font-mono flex-shrink-0">{agent.session_id.slice(0, 8)}</span>
        </span>
      </div>
    </div>
  );
}
