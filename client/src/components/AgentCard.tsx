/**
 * @file AgentCard.tsx
 * @description Defines the AgentCard component that displays a summary of an
 * agent's name, status, task, current tool, timestamps, and latest-two-human-turn
 * context. Provider-owned main cards show the session's own title (clamped to
 * three lines) with the tool name leading the subtitle, so Claude Code, Cursor,
 * and Codex cards read the same. Cards reuse session task-progress donuts
 * beside status when available, and can render status as a dot where the
 * layout already names it (Kanban columns). Durable cards navigate to session
 * details while the brief pre-identity Codex process card stays non-navigable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/AgentCard.tsx
 * **Area:** client component
 * **Responsibility:**
 * Defines the AgentCard component that displays a summary of an agent's name, status, task, current
 * tool, timestamps, and latest-two-human-turn context. Provider-owned main cards show the session's
 * own title (clamped to three lines) with the tool name leading the subtitle, so Claude Code,
 * Cursor, and Codex cards read the same. Cards reuse session task-progress donuts beside status
 * when available, and can render status as a dot where the layout already names it (Kanban
 * columns). Durable cards navigate to session details while the brief pre-identity Codex process
 * card stays non-navigable.
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
 * - `../lib/format` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./StatusBadge` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./TodoProgressIndicator` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `AgentCard` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `AgentCard` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `AgentCardProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `isTransientProcessCard` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `promptPreviewLines` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useNavigate` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `kanban` — visible copy resolves through this namespace; key and interpolation parity applies
 *   to every supported locale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/AgentCard.tsx` .
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
import { useNavigate } from "react-router";
import { AgentStatusBadge } from "./StatusBadge";
import { TodoProgressIndicator } from "./TodoProgressIndicator";
import { effectiveAgentStatus, isAgentAwaitingInput, agentAwaitingReason } from "../lib/types";
import type { Agent, Session } from "../lib/types";
import { formatDuration, timeAgo, formatModelName, pathBasename, fmtCost } from "../lib/format";

/** Keep a compact card's history legible: at most two distinct human turns,
 * one visual row each. This intentionally preserves a title-matching first
 * request when a terse follow-up depends on it for context.
 *
 * @param value - Stored prompt context, possibly empty.
 * @returns Up to two display lines.
 */
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

/** Props for {@link AgentCard}. */
interface AgentCardProps {
  /** Agent to show. */
  agent: Agent;
  /** Optional session data for richer main-agent rendering (model, cwd,
   *  cost). Subagent display ignores this. When omitted, the card falls
   *  back to the original minimal layout. */
  session?: Session;
  /** Subtitle override, shown in place of the subagent type. */
  label?: string;
  /** Click handler; defaults to opening the agent's session. */
  onClick?: () => void;
  /** `dot` shrinks the status badge to its colored dot (tooltip + screen-reader
   *  label kept) for surfaces where the layout already shows the status, such
   *  as a Kanban column. Defaults to the full badge. */
  statusDisplay?: "badge" | "dot";
}

/**
 * Whether a card is a transient placeholder for a Codex TUI process that has not written a session
 * id yet. Such cards are not clickable, since there is no session page to open.
 *
 * @param metadata - The row's JSON metadata.
 * @returns True when `pre_identity_process` is set.
 */
function isTransientProcessCard(metadata: string | null | undefined): boolean {
  if (!metadata) return false;
  try {
    return JSON.parse(metadata)?.pre_identity_process === true;
  } catch {
    return false;
  }
}

/**
 * Kanban card for an agent: name, status badge, and what it is working on. Main-agent cards use the
 * session for model, working directory, and cost; subagent cards show their type. Clicking opens
 * the session, except for transient Codex placeholders, which have no page yet.
 */
export function AgentCard({
  agent,
  session,
  label,
  onClick,
  statusDisplay = "badge",
}: AgentCardProps) {
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
  // Real (user-given) session name - auto-generated Claude/Codex fallbacks
  // carry no extra info next to the ID, so they are suppressed.
  const sessionName = session?.name?.trim() || "";
  const realSessionName = /^(Session [0-9a-f]{8}|Codex session)$/i.test(sessionName)
    ? ""
    : sessionName;
  const isCodexMain = isMain && session?.provider === "codex" && agent.name.trim() === "Codex";
  const isCursorMain = isMain && session?.provider === "cursor";
  const isClaudeMain =
    isMain &&
    session?.provider !== "cursor" &&
    session?.provider !== "codex" &&
    /^Main Agent(?:\s*-|$)/i.test(agent.name.trim());
  // Provider-owned main cards title themselves with the session's own title;
  // the tool name moves to the start of the subtitle instead of eating the
  // title row. Custom (non-placeholder) agent names and subagents keep their
  // agent name.
  const providerLabel = isCodexMain
    ? "Codex"
    : isCursorMain
      ? "Cursor"
      : isClaudeMain
        ? "Claude Code"
        : null;
  const displayName = providerLabel ? realSessionName || t("session.anonymous") : agent.name;
  // Session titles and requests are intentionally independent: Claude,
  // Cursor, and Codex persist two recent real human turns on the session, while a
  // main-agent task remains the truthful fallback for pre-preview history.
  // Subagents keep their own assigned task instead of inheriting the parent.
  const taskPreview = isMain
    ? session?.prompt_preview?.trim() || agent.task?.trim() || null
    : agent.task?.trim() || null;
  const taskPreviewLines = promptPreviewLines(taskPreview);
  const isTransient = isTransientProcessCard(agent.metadata);
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
        providerLabel,
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
    } else if (!isTransient) {
      navigate(`/sessions/${agent.session_id}`);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`card-hover p-4 overflow-hidden ${
        isTransient ? "cursor-default" : "cursor-pointer"
      } ${
        isWaiting
          ? "border-l-2 border-l-yellow-500/60"
          : isActive
            ? "border-l-2 border-l-emerald-500/50"
            : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0 overflow-hidden">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
              isMain ? "bg-accent/15 text-accent" : "bg-violet-500/15 text-violet-400"
            }`}
          >
            {isMain ? <Bot className="w-3.5 h-3.5" /> : <GitBranch className="w-3.5 h-3.5" />}
          </div>
          <div className="min-w-0 overflow-hidden">
            {/* Wraps to at most three lines (long unbroken tokens such as
                paths break anywhere) so a long title never blows up the
                card; the full title stays available on hover. */}
            <p
              className="text-sm font-medium leading-snug text-gray-200 line-clamp-3 [overflow-wrap:anywhere]"
              title={displayName}
            >
              {displayName}
            </p>
            {/* Single line; the full subtitle (tool · project · counts) stays
                available on hover when the column is too narrow for it. */}
            {subtitle && (
              <p className="text-[11px] text-gray-500 truncate" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {/* compact: cards are narrow — inline reason chip would squeeze the
            title, so the reason stays hover-tooltip-only here. */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {session?.todo_summary && (
            <TodoProgressIndicator progress={session.todo_summary} stopClickPropagation />
          )}
          <AgentStatusBadge
            status={status}
            reason={agentAwaitingReason(agent)}
            provider={session?.provider}
            compact
            variant={statusDisplay}
          />
        </div>
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
        {/* Main cards already carry the session title as their own title, so
            the footer keeps only the short ID; a subagent card's title is the
            subagent, so its session name stays here as context. */}
        <span className="ml-auto flex items-center gap-1 min-w-0 opacity-50">
          {realSessionName && !providerLabel && (
            <span className="truncate max-w-[10rem]" title={realSessionName}>
              {realSessionName} ·
            </span>
          )}
          <span className="font-mono flex-shrink-0">{agent.session_id.slice(0, 8)}</span>
        </span>
      </div>
    </div>
  );
}
