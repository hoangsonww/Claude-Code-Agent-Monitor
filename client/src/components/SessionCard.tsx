/**
 * @file SessionCard.tsx
 * @description Compact session card for the Kanban board's "Sessions" view.
 * Mirrors AgentCard's information hierarchy (icon · title · meta line) but
 * surfaces session-relevant fields: model, agent count, cost, last activity,
 * and a meaningful provider-native title with its latest two human prompts
 * (or a stable short session ID). Durable cards navigate to details; the brief
 * pre-identity Codex process card stays non-navigable until a real ID exists.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/SessionCard.tsx`
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
 * - `SessionCard` — exported API; see TSDoc on the symbol for behavior.
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
 * **SessionCard**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { FolderOpen, Bot, Clock, Coins, Cpu } from "lucide-react";
import { SessionStatusBadge } from "./StatusBadge";
import {
  effectiveSessionStatus,
  isSessionAwaitingInput,
  sessionAwaitingReason,
} from "../lib/types";
import type { Session } from "../lib/types";
import { formatDuration, timeAgo, formatModelName } from "../lib/format";

interface SessionCardProps {
  session: Session;
  onClick?: () => void;
}

function isTransientProcessCard(metadata: string | null | undefined): boolean {
  if (!metadata) return false;
  try {
    return JSON.parse(metadata)?.pre_identity_process === true;
  } catch {
    return false;
  }
}

function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return "$0";
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

/** Two compact, distinct request rows give terse Claude and Codex follow-ups
 * surrounding context without allowing a session card to grow unbounded. */
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

export function SessionCard({ session, onClick }: SessionCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("kanban");
  const isActive = session.status === "active";
  const isWaiting = isSessionAwaitingInput(session);
  const status = effectiveSessionStatus(session);
  const rawTitle = session.name?.trim() || "";
  const isCodex = session.provider === "codex";
  const shortId = session.id.slice(0, 8);
  // A fresh Codex rollout has no title until its first prompt or native
  // `/rename`. Do not make the card look like an indistinguishable "Codex"
  // entry in that short window: the stable native session ID remains useful.
  const title =
    isCodex && (!rawTitle || rawTitle === "Codex session")
      ? `Codex · ${shortId}`
      : rawTitle || t("session.anonymous");
  const agentCount = session.agent_count ?? 0;
  const model = formatModelName(session.model);
  const lastActivity = session.last_activity || session.ended_at || session.started_at;
  // Titles and requests are intentionally separate. Claude and Codex keep
  // their own native title while the latest two durable human turns explain
  // what the session is doing.
  const promptPreviewLinesForCard = promptPreviewLines(session.prompt_preview);
  const isTransient = isTransientProcessCard(session.metadata);

  function handleClick() {
    if (onClick) onClick();
    else if (!isTransient) navigate(`/sessions/${session.id}`);
  }

  return (
    <div
      onClick={handleClick}
      className={`card-hover p-4 animate-fade-in overflow-hidden ${
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
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-accent/15 text-accent">
            <FolderOpen className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-gray-200 truncate">{title}</p>
            <p className="text-[11px] text-gray-500 font-mono truncate">
              {session.id.slice(0, 12)}
            </p>
          </div>
        </div>
        {/* compact: cards are narrow — inline reason chip would squeeze the
            title, so the reason stays hover-tooltip-only here. */}
        <SessionStatusBadge
          status={status}
          reason={sessionAwaitingReason(session)}
          provider={session.provider}
          compact
        />
      </div>

      {promptPreviewLinesForCard.length > 0 && (
        <div className="mb-2 space-y-1 border-l-2 border-accent/25 pl-2.5">
          {promptPreviewLinesForCard.map((prompt, index) => (
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

      {session.cwd && (
        <p className="text-xs text-gray-400 mb-3 truncate font-mono leading-relaxed">
          {session.cwd}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-500 min-w-0 overflow-hidden flex-wrap">
        <span className="flex items-center gap-1 flex-shrink-0">
          <Bot className="w-3 h-3" />
          {t("session.agentSummary", { count: agentCount })}
        </span>
        {model && (
          <span className="flex items-center gap-1 flex-shrink-0 truncate">
            <Cpu className="w-3 h-3" />
            <span className="truncate">{model}</span>
          </span>
        )}
        {typeof session.cost === "number" && session.cost > 0 && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Coins className="w-3 h-3" />
            {formatCost(session.cost)}
          </span>
        )}
        <span className="flex items-center gap-1 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {session.ended_at
            ? `${t("ran")}${formatDuration(session.started_at, session.ended_at)}`
            : `${t("running")}${formatDuration(session.started_at, new Date().toISOString())}`}
        </span>
        <span className="text-gray-600 flex-shrink-0 ml-auto">
          {timeAgo(session.ended_at || lastActivity)}
        </span>
      </div>
    </div>
  );
}
