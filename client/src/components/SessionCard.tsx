/**
 * @file SessionCard.tsx
 * @description Compact session card for the Kanban board's "Sessions" view.
 * Mirrors AgentCard's information hierarchy (icon · title · meta line) but
 * surfaces session-relevant fields: model, agent count, cost, last activity.
 * Clicking the card navigates to the session detail page.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Bot, Clock, Coins, Cpu } from "lucide-react";
import { SessionStatusBadge } from "./StatusBadge";
import { effectiveSessionStatus, isSessionAwaitingInput } from "../lib/types";
import type { Session } from "../lib/types";
import { formatDuration, timeAgo, shortModel } from "../lib/format";

interface SessionCardProps {
  session: Session;
  onClick?: () => void;
}

function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return "$0";
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("kanban");
  const isActive = session.status === "active";
  const isWaiting = isSessionAwaitingInput(session);
  const status = effectiveSessionStatus(session);
  const title = session.name?.trim() || t("session.anonymous");
  const agentCount = session.agent_count ?? 0;
  const model = shortModel(session.model);
  const lastActivity = session.last_activity || session.ended_at || session.started_at;

  function handleClick() {
    if (onClick) onClick();
    else navigate(`/sessions/${session.id}`);
  }

  return (
    <div
      onClick={handleClick}
      className={`card-hover p-4 cursor-pointer animate-fade-in overflow-hidden ${
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
        <SessionStatusBadge status={status} />
      </div>

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
