/**
 * @file StatusBadge.tsx
 * @description Defines reusable React components for displaying the status of agents and sessions in a visually distinct way using badges. The AgentStatusBadge component shows the current status of an agent with an optional pulsing effect for active states, while the SessionStatusBadge component indicates the status of a session. When a row is in the yellow "Waiting" overlay state, both badges can additionally render WHY it waits (the server's awaiting_reason: needs input / turn done / at prompt / interrupted) as a nested icon+label chip with a hover tooltip carrying the full explanation — or, in `compact` mode for tight card layouts, as the hover tooltip alone. Three "primary" reasons (subagent/shell/monitor — still actively working via a child, not blocked on the human) instead replace the whole badge word with their own label (e.g. "SubAgents") in every mode, since "Waiting" would be misleading for them. Both components utilize predefined configurations for consistent styling across the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/StatusBadge.tsx`
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
 * - `../lib/types`
 * - `./Tip`
 *
 * ## Public surface
 * - `REASON_ICONS` — exported API; see TSDoc on the symbol for behavior.
 * - `AgentStatusBadge` — exported API; see TSDoc on the symbol for behavior.
 * - `SessionStatusBadge` — exported API; see TSDoc on the symbol for behavior.
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
 * **REASON_ICONS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AgentStatusBadge**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SessionStatusBadge**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useTranslation } from "react-i18next";
import {
  BellRing,
  MessageSquareReply,
  Terminal,
  OctagonPause,
  Users,
  SquareTerminal,
  Activity,
} from "lucide-react";
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
  subagent: Users, // a spawned fleet is still working
  shell: SquareTerminal, // mid a synchronous Bash call
  monitor: Activity, // mid a Monitor tool call watching a background process
};

/**
 * The "why" chip nested inside a Waiting badge: a small rounded pill with the
 * reason's icon and short label. Urgent reasons (permission prompts,
 * interruptions) get a hotter amber fill than the calm idle-between-turns
 * ones so a scan of a list surfaces the rows that actually block on the human.
 */
function ReasonChip({ reason }: { reason: AwaitingReason }) {
  const { t } = useTranslation();
  const cfg = AWAITING_REASON_CONFIG[reason];
  const Icon = REASON_ICONS[reason];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 text-[10px] font-medium leading-4 ${
        cfg.urgent
          ? "bg-amber-500/15 border-amber-500/25 text-amber-300"
          : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400/90"
      }`}
    >
      <Icon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
      {t(cfg.labelKey)}
    </span>
  );
}

interface AgentStatusBadgeProps {
  status: EffectiveAgentStatus;
  pulse?: boolean;
  /** WHY the agent is waiting (from `agentAwaitingReason`); rendered as a
   *  nested icon+label chip with a tooltip. Ignored unless `status` is "waiting". */
  reason?: AwaitingReason | null;
  /** Tooltip-only mode for tight layouts (Kanban/Dashboard cards): keeps the
   *  hover explanation but suppresses the inline reason chip so the badge
   *  never squeezes the card title. */
  compact?: boolean;
}

export function AgentStatusBadge({ status, pulse, reason, compact }: AgentStatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  // "waiting" pulses by default so the user's eye is drawn to sessions that
  // need their attention, matching the pulsing for active/working states.
  const shouldPulse = pulse ?? (status === "working" || status === "waiting");
  // Only decorate the Waiting overlay - a reason on any other status is stale.
  const shownReason = status === "waiting" && reason ? reason : null;
  const reasonCfg = shownReason ? AWAITING_REASON_CONFIG[shownReason] : null;
  // 'subagent'/'shell'/'monitor' mean "still working via a child", not
  // "blocked on you" - showing a generic "Waiting" word for these would be
  // actively misleading, so the reason's own label becomes the whole badge
  // instead of a suffix chip nested inside "Waiting". Applies in compact mode
  // too, since that's exactly where the chip would otherwise never surface.
  const showReasonAsPrimary = reasonCfg?.primary === true;
  // These reasons are genuinely active work, not a wait - color them the same
  // green as "working" rather than the yellow used for a real Waiting badge.
  const colorConfig = showReasonAsPrimary ? STATUS_CONFIG.working : config;

  return (
    // Tip renders children unwrapped when raw is undefined (non-waiting rows).
    <Tip raw={reasonCfg ? t(reasonCfg.descKey) : undefined}>
      <span className={`badge ${colorConfig.bg} ${colorConfig.color}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full ${colorConfig.dot} ${
            shouldPulse ? "animate-pulse-dot" : ""
          }`}
        />
        {showReasonAsPrimary ? t(reasonCfg.labelKey) : t(config.labelKey)}
        {shownReason && !compact && !showReasonAsPrimary && <ReasonChip reason={shownReason} />}
      </span>
    </Tip>
  );
}

interface SessionStatusBadgeProps {
  status: EffectiveSessionStatus;
  pulse?: boolean;
  /** WHY the session is waiting (from `sessionAwaitingReason`); rendered as a
   *  nested icon+label chip with a tooltip. Ignored unless `status` is "waiting". */
  reason?: AwaitingReason | null;
  /** Tooltip-only mode for tight layouts (Kanban/Dashboard cards): keeps the
   *  hover explanation but suppresses the inline reason chip so the badge
   *  never squeezes the card title. */
  compact?: boolean;
}

export function SessionStatusBadge({ status, pulse, reason, compact }: SessionStatusBadgeProps) {
  const { t } = useTranslation();
  const config = SESSION_STATUS_CONFIG[status];
  const shouldPulse = pulse ?? status === "waiting";
  const shownReason = status === "waiting" && reason ? reason : null;
  const reasonCfg = shownReason ? AWAITING_REASON_CONFIG[shownReason] : null;
  const showReasonAsPrimary = reasonCfg?.primary === true;
  // These reasons are genuinely active work, not a wait - color them the same
  // green as "active" rather than the yellow used for a real Waiting badge.
  const colorConfig = showReasonAsPrimary ? SESSION_STATUS_CONFIG.active : config;
  return (
    <Tip raw={reasonCfg ? t(reasonCfg.descKey) : undefined}>
      <span className={`badge ${colorConfig.bg} ${colorConfig.color}`}>
        {shouldPulse && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${colorConfig.dot} animate-pulse-dot`}
            aria-hidden="true"
          />
        )}
        {showReasonAsPrimary ? t(reasonCfg.labelKey) : t(config.labelKey)}
        {shownReason && !compact && !showReasonAsPrimary && <ReasonChip reason={shownReason} />}
      </span>
    </Tip>
  );
}
