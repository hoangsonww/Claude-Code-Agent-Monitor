/**
 * @file StatusBadge.tsx
 * @description Defines reusable React components for displaying the status of agents and sessions in a visually distinct way using badges. The AgentStatusBadge component shows the current status of an agent with an optional pulsing effect for active states, while the SessionStatusBadge component indicates the status of a session. When a row is in the yellow "Waiting" overlay state, both badges can additionally render WHY it waits (the server's awaiting_reason: needs input / turn done / at prompt / interrupted) as a nested icon+label chip with a hover tooltip carrying the full explanation — or, in `compact` mode for tight card layouts, as the hover tooltip alone. Both components utilize predefined configurations for consistent styling across the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/StatusBadge.tsx
 * **Area:** client component
 * **Responsibility:**
 * Defines reusable React components for displaying the status of agents and sessions in a visually
 * distinct way using badges. The AgentStatusBadge component shows the current status of an agent
 * with an optional pulsing effect for active states, while the SessionStatusBadge component
 * indicates the status of a session. When a row is in the yellow "Waiting" overlay state, both
 * badges can additionally render WHY it waits (the server's awaiting_reason: needs input / turn
 * done / at prompt / interrupted) as a nested icon+label chip with a hover tooltip carrying the
 * full explanation — or, in `compact` mode for tight card layouts, as the hover tooltip alone. Both
 * components utilize predefined configurations for consistent styling across the application.
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
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./Tip` — repository-local contract consumed by this module; review its exports before changing
 *   assumptions here.
 *
 * ## Package dependency edges
 * - `i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `AgentStatusBadge` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `REASON_ICONS` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SessionStatusBadge` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `AgentStatusBadge` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `AgentStatusBadgeProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `REASON_ICONS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ReasonChip` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `reasonDescription` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SessionStatusBadge` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SessionStatusBadgeProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `StatusDot` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/StatusBadge.tsx` .
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
import type { TFunction } from "i18next";
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
  stop: MessageSquareReply, // agent replied; your reply is the next move
  session_start: Terminal, // fresh CLI sitting at an empty prompt
  interrupted: OctagonPause, // turn cut short (Esc / recovered hook)
};

/**
 * The "why" chip nested inside a Waiting badge: a small rounded pill with the
 * reason's icon and short label, with a provider-aware explanation. Urgent reasons (permission prompts,
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

/**
 * Provider-aware explanation of a waiting reason (tooltip text).
 *
 * @param t - Translation function.
 * @param reason - Why the agent or session is waiting.
 * @param provider - Product, for provider-specific wording.
 * @returns The tooltip description.
 */
function reasonDescription(
  t: TFunction,
  reason: AwaitingReason,
  provider: "claude" | "cursor" | "codex" | undefined
): string {
  return t(AWAITING_REASON_CONFIG[reason].descKey, {
    provider: provider === "codex" ? "Codex" : provider === "cursor" ? "Cursor" : "Claude",
  });
}

/**
 * Dot-only status for layouts where the surrounding context already names the
 * status (a Kanban column): the colored dot keeps the pulse, the tooltip
 * carries the status label (plus the waiting reason, when there is one), and
 * screen readers still hear the label.
 */
function StatusDot({
  label,
  dotClass,
  pulse,
  tooltip,
}: {
  /** Status label, read by screen readers; the dot itself shows no text. */
  label: string;
  /** Classes for the colored dot. */
  dotClass: string;
  /** Whether the dot pulses. */
  pulse: boolean;
  /** Tooltip explaining the status. */
  tooltip: string;
}) {
  return (
    <Tip raw={tooltip}>
      <span className="inline-flex h-5 w-5 items-center justify-center" data-status-dot="">
        <span
          className={`h-2.5 w-2.5 rounded-full ${dotClass} ${pulse ? "animate-pulse-dot" : ""}`}
          aria-hidden="true"
        />
        <span className="sr-only">{label}</span>
      </span>
    </Tip>
  );
}

/** Props for {@link AgentStatusBadge}. */
interface AgentStatusBadgeProps {
  /** Status to show, after transient states are folded in. */
  status: EffectiveAgentStatus;
  /** Whether the status dot pulses, for live statuses. */
  pulse?: boolean;
  /** WHY the agent is waiting (from `agentAwaitingReason`); rendered as a
   *  nested icon+label chip with a tooltip. Ignored unless `status` is "waiting". */
  reason?: AwaitingReason | null;
  /** Tooltip-only mode for tight layouts (Kanban/Dashboard cards): keeps the
   *  hover explanation but suppresses the inline reason chip so the badge
   *  never squeezes the card title. */
  compact?: boolean;
  /** Product that owns the waiting row; drives provider wording in the tooltip. */
  provider?: "claude" | "cursor" | "codex";
  /** `dot` renders only the colored status dot (see {@link StatusDot}); for
   *  surfaces whose layout already conveys the status, e.g. a Kanban column. */
  variant?: "badge" | "dot";
}

/**
 * Status badge for an agent: a colored badge or dot with the status label, a provider-aware
 * tooltip, and, for waiting agents, a nested chip explaining what the agent is waiting for.
 */
export function AgentStatusBadge({
  status,
  pulse,
  reason,
  compact,
  provider,
  variant = "badge",
}: AgentStatusBadgeProps) {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status];
  // "waiting" pulses by default so the user's eye is drawn to sessions that
  // need their attention, matching the pulsing for active/working states.
  const shouldPulse = pulse ?? (status === "working" || status === "waiting");
  // Only decorate the Waiting overlay - a reason on any other status is stale.
  const shownReason = status === "waiting" && reason ? reason : null;
  const reasonText = shownReason ? reasonDescription(t, shownReason, provider) : undefined;

  if (variant === "dot") {
    const label = t(config.labelKey);
    return (
      <StatusDot
        label={label}
        dotClass={config.dot}
        pulse={shouldPulse}
        tooltip={reasonText ? `${label} — ${reasonText}` : label}
      />
    );
  }

  return (
    // Tip renders children unwrapped when raw is undefined (non-waiting rows).
    <Tip raw={reasonText}>
      <span className={`badge ${config.bg} ${config.color}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full ${config.dot} ${
            shouldPulse ? "animate-pulse-dot" : ""
          }`}
        />
        {t(config.labelKey)}
        {shownReason && !compact && <ReasonChip reason={shownReason} />}
      </span>
    </Tip>
  );
}

/** Props for {@link SessionStatusBadge}. */
interface SessionStatusBadgeProps {
  /** Status to show, after transient states are folded in. */
  status: EffectiveSessionStatus;
  /** Whether the status dot pulses, for live statuses. */
  pulse?: boolean;
  /** WHY the session is waiting (from `sessionAwaitingReason`); rendered as a
   *  nested icon+label chip with a tooltip. Ignored unless `status` is "waiting". */
  reason?: AwaitingReason | null;
  /** Tooltip-only mode for tight layouts (Kanban/Dashboard cards): keeps the
   *  hover explanation but suppresses the inline reason chip so the badge
   *  never squeezes the card title. */
  compact?: boolean;
  /** Product that owns the waiting row; drives provider wording in the tooltip. */
  provider?: "claude" | "cursor" | "codex";
  /** `dot` renders only the colored status dot (see {@link StatusDot}); for
   *  surfaces whose layout already conveys the status, e.g. a Kanban column. */
  variant?: "badge" | "dot";
}

/**
 * Status badge for a session: a colored badge or dot with the status label, a provider-aware
 * tooltip, and, for waiting sessions, a nested chip explaining what the session is waiting for.
 */
export function SessionStatusBadge({
  status,
  pulse,
  reason,
  compact,
  provider,
  variant = "badge",
}: SessionStatusBadgeProps) {
  const { t } = useTranslation();
  const config = SESSION_STATUS_CONFIG[status];
  const shouldPulse = pulse ?? status === "waiting";
  const shownReason = status === "waiting" && reason ? reason : null;
  const reasonText = shownReason ? reasonDescription(t, shownReason, provider) : undefined;

  if (variant === "dot") {
    const label = t(config.labelKey);
    return (
      <StatusDot
        label={label}
        dotClass={config.dot}
        pulse={shouldPulse}
        tooltip={reasonText ? `${label} — ${reasonText}` : label}
      />
    );
  }

  return (
    <Tip raw={reasonText}>
      <span className={`badge ${config.bg} ${config.color}`}>
        {shouldPulse && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse-dot`}
            aria-hidden="true"
          />
        )}
        {t(config.labelKey)}
        {shownReason && !compact && <ReasonChip reason={shownReason} />}
      </span>
    </Tip>
  );
}
