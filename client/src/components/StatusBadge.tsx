/**
 * @file StatusBadge.tsx
 * @description Defines reusable React components for displaying the status of agents and sessions in a visually distinct way using badges. The AgentStatusBadge component shows the current status of an agent with an optional pulsing effect for active states, while the SessionStatusBadge component indicates the status of a session. When a row is in the yellow "Waiting" overlay state, both badges can additionally render WHY it waits (the server's awaiting_reason: needs input / turn done / at prompt / interrupted) as an icon + short label suffix with a hover tooltip carrying the full explanation. Both components utilize predefined configurations for consistent styling across the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useTranslation } from "react-i18next";
import { BellRing, MessageSquareReply, Terminal, OctagonPause } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { STATUS_CONFIG, SESSION_STATUS_CONFIG, AWAITING_REASON_CONFIG } from "../lib/types";
import type { EffectiveAgentStatus, EffectiveSessionStatus, AwaitingReason } from "../lib/types";
import { Tip } from "./Tip";

/** Per-reason icon, kept here (not in types.ts) so the presentation lookup in
 *  lib/ stays JSX-free. Matches the semantics documented on {@link AwaitingReason}.
 *  Exported so richer surfaces (e.g. SessionDetail's waiting banner) reuse the
 *  same icon per reason as the badges. */
export const REASON_ICONS: Record<AwaitingReason, LucideIcon> = {
  notification: BellRing, // blocked on a permission/input prompt - ring the bell
  stop: MessageSquareReply, // Claude replied; your reply is the next move
  session_start: Terminal, // fresh CLI sitting at an empty prompt
  interrupted: OctagonPause, // turn cut short (Esc / recovered hook)
};

/**
 * The "why" suffix appended inside a Waiting badge: a thin divider, the
 * reason's icon, and its short label. Urgent reasons (permission prompts,
 * interruptions) render in a hotter amber than the calm idle-between-turns
 * ones so a scan of a card column surfaces the rows that actually block on
 * the human.
 */
function ReasonSuffix({ reason }: { reason: AwaitingReason }) {
  const { t } = useTranslation();
  const cfg = AWAITING_REASON_CONFIG[reason];
  const Icon = REASON_ICONS[reason];
  return (
    <>
      <span className="w-px h-3 bg-yellow-500/30 flex-shrink-0" aria-hidden="true" />
      <span
        className={`inline-flex items-center gap-1 ${
          cfg.urgent ? "text-amber-300" : "text-yellow-400/80"
        }`}
      >
        <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {t(cfg.labelKey)}
      </span>
    </>
  );
}

interface AgentStatusBadgeProps {
  status: EffectiveAgentStatus;
  pulse?: boolean;
  /** WHY the agent is waiting (from `agentAwaitingReason`); rendered as an
   *  icon+label suffix with a tooltip. Ignored unless `status` is "waiting". */
  reason?: AwaitingReason | null;
}

export function AgentStatusBadge({ status, pulse, reason }: AgentStatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  // "waiting" pulses by default so the user's eye is drawn to sessions that
  // need their attention, matching the pulsing for active/working states.
  const shouldPulse = pulse ?? (status === "working" || status === "waiting");
  // Only decorate the Waiting overlay - a reason on any other status is stale.
  const shownReason = status === "waiting" && reason ? reason : null;

  return (
    // Tip renders children unwrapped when raw is undefined (non-waiting rows).
    <Tip raw={shownReason ? t(AWAITING_REASON_CONFIG[shownReason].descKey) : undefined}>
      <span className={`badge ${config.bg} ${config.color}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dot} ${
            shouldPulse ? "animate-pulse-dot" : ""
          }`}
        />
        {t(config.labelKey)}
        {shownReason && <ReasonSuffix reason={shownReason} />}
      </span>
    </Tip>
  );
}

interface SessionStatusBadgeProps {
  status: EffectiveSessionStatus;
  pulse?: boolean;
  /** WHY the session is waiting (from `sessionAwaitingReason`); rendered as an
   *  icon+label suffix with a tooltip. Ignored unless `status` is "waiting". */
  reason?: AwaitingReason | null;
}

export function SessionStatusBadge({ status, pulse, reason }: SessionStatusBadgeProps) {
  const { t } = useTranslation();
  const config = SESSION_STATUS_CONFIG[status];
  const shouldPulse = pulse ?? status === "waiting";
  const shownReason = status === "waiting" && reason ? reason : null;
  return (
    <Tip raw={shownReason ? t(AWAITING_REASON_CONFIG[shownReason].descKey) : undefined}>
      <span className={`badge ${config.bg} ${config.color}`}>
        {shouldPulse && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse-dot`}
            aria-hidden="true"
          />
        )}
        {t(config.labelKey)}
        {shownReason && <ReasonSuffix reason={shownReason} />}
      </span>
    </Tip>
  );
}
