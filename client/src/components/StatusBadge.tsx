/**
 * @file StatusBadge.tsx
 * @description Defines reusable React components for displaying the status of agents and sessions in a visually distinct way using badges. The AgentStatusBadge component shows the current status of an agent with an optional pulsing effect for active states, while the SessionStatusBadge component indicates the status of a session. Both components utilize predefined configurations for consistent styling across the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { STATUS_CONFIG, SESSION_STATUS_CONFIG } from "../lib/types";
import type { AgentStatus, SessionStatus } from "../lib/types";

interface AgentStatusBadgeProps {
  status: AgentStatus;
  pulse?: boolean;
}

export function AgentStatusBadge({ status, pulse }: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const shouldPulse = pulse ?? (status === "working" || status === "connected");

  return (
    <span className={`badge ${config.bg} ${config.color}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${
          shouldPulse ? "animate-pulse-dot" : ""
        }`}
      />
      {config.label}
    </span>
  );
}

interface SessionStatusBadgeProps {
  status: SessionStatus;
}

export function SessionStatusBadge({ status }: SessionStatusBadgeProps) {
  const config = SESSION_STATUS_CONFIG[status];
  return <span className={`badge ${config.bg} ${config.color}`}>{config.label}</span>;
}
