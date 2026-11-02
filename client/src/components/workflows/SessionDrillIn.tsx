/**
 * @file SessionDrillIn.tsx
 * @description Defines the SessionDrillIn component, which provides a detailed view of a specific session in the agent dashboard application. It allows users to drill into the agent tree, tool timeline, and event sequence for a selected session. The component manages its own state for loading, error handling, and active tab selection, and it fetches the necessary data from the backend API when a session is selected. It also includes a session selector for searching and selecting different sessions to view.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/workflows/SessionDrillIn.tsx
 * **Area:** client workflow visualization
 * **Responsibility:**
 * Defines the SessionDrillIn component, which provides a detailed view of a specific session in the
 * agent dashboard application. It allows users to drill into the agent tree, tool timeline, and
 * event sequence for a selected session. The component manages its own state for loading, error
 * handling, and active tab selection, and it fetches the necessary data from the backend API when a
 * session is selected. It also includes a session selector for searching and selecting different
 * sessions to view.
 *
 * ## Architectural boundary
 * - Transforms workflow analytics into an explanatory visualization without redefining the server's
 *   aggregate semantics.
 * - Layout geometry, interaction state, and rendering adapters stay local; canonical workflow types
 *   stay in shared contracts.
 * - Every graphical encoding needs a readable textual label or surrounding explanation for
 *   accessibility and debugging.
 *
 * ## Local dependency edges
 * - `../../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../../lib/format` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `SessionDrillIn` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SessionDrillInProps` (interface) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `AgentNode` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `AgentTree` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `AgentTreeProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ErrorState` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ErrorStateProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `EVENT_TYPE_COLOR` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `EventSequence` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `EventSequenceProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `eventTypeColor` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `LoadingState` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `NoSessionState` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `NoSessionStateProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `PAGE_SIZE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `safeTimestamp` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionDrillIn` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionDrillInProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SessionHeader` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionHeaderProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SessionSelector` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionSelectorProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `statusColor` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Tab` (type) — top-level declaration that helps orient code review and focused test selection.
 * - `TabBar` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TabBarProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ToolEvent` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ToolTimeline` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ToolTimelineProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `TreeNode` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TreeNodeProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `workflows` — visible copy resolves through this namespace; key and interpolation parity
 *   applies to every supported locale.
 *
 * ## Area invariants
 * - Use stable entity identifiers for nodes, links, colors, selections, legends, and React keys.
 * - Treat missing timestamps, models, token values, parents, and terminal states as expected
 *   partial-data cases.
 * - Keep scales and domains deterministic so identical data does not jump between renders.
 * - Bound SVG/canvas dimensions and event listeners; resize observers and D3 selections require
 *   cleanup.
 * - Do not silently discard filtered records when a visual limit is applied; explain truncation in
 *   the UI.
 * - Keep tooltip and legend values aligned with the exact encoding shown in the chart.
 * - Preserve keyboard and screen-reader paths to information that is otherwise available only by
 *   pointer hover.
 * - Avoid mutating API-owned arrays while sorting, grouping, or assigning visualization
 *   coordinates.
 * - Keep provider and model labels canonical through shared formatting helpers.
 * - Snapshot tests should assert stable structure, while focused unit tests own geometry and
 *   derivation edge cases.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/workflows/SessionDrillIn.tsx`
 *   .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/workflows/SessionDrillIn.tsx`
 * **Purpose:** Workflow analytics visualization built on D3; consumes aggregated session/run metrics from the workflows API.
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
 * - `../../lib/api`
 * - `../../lib/format`
 * - `../../lib/types`
 *
 * ## Public surface
 * - `SessionDrillInProps` — exported API; see TSDoc on the symbol for behavior.
 * - `SessionDrillIn` — exported API; see TSDoc on the symbol for behavior.
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
 * **SessionDrillInProps**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SessionDrillIn**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, GitFork, Wrench, List, Search, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { formatDateTime, formatMs, formatModelName } from "../../lib/format";
import type {
  SessionDrillIn as SessionDrillInData,
  DashboardEvent,
  Session,
} from "../../lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Drill-in panel tab: the agent tree, the tool timeline, or the raw event sequence. */
type Tab = "tree" | "timeline" | "events";

/** One node of the session's agent tree, possibly with nested children. */
type AgentNode = SessionDrillInData["tree"][number];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Tailwind text, background, and border classes for an agent status chip: violet for completed,
 * emerald for working or active, yellow for waiting, red for error, and gray otherwise.
 *
 * @param status - Agent or session status.
 * @returns Class names.
 */
function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "text-violet-400 bg-violet-500/10 border-violet-500/20";
    case "working":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "error":
      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "active":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
    case "waiting":
      return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    default:
      return "text-gray-400 bg-gray-500/10 border-gray-500/20";
  }
}

/**
 * Format a database timestamp for display. SQLite timestamps without a zone marker are UTC and are
 * normalized before formatting.
 *
 * @param raw - Timestamp from the API.
 * @returns The formatted date and time, or `raw` unchanged if formatting throws.
 */
function safeTimestamp(raw: string): string {
  try {
    const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : raw.replace(" ", "T") + "Z";
    return formatDateTime(normalized);
  } catch {
    return raw;
  }
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

/** Props for {@link TabBar}. */
interface TabBarProps {
  /** Selected tab. */
  active: Tab;
  /** Called when a tab is clicked. */
  onChange: (t: Tab) => void;
}

/** Tab strip for switching between the agent tree, tool timeline, and event sequence. */
function TabBar({ active, onChange }: TabBarProps) {
  const { t } = useTranslation("workflows");
  const tabs = [
    {
      id: "tree" as Tab,
      label: t("drillIn.tabs.agentTree"),
      icon: <GitFork className="w-3.5 h-3.5" />,
    },
    {
      id: "timeline" as Tab,
      label: t("drillIn.tabs.toolTimeline"),
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
    {
      id: "events" as Tab,
      label: t("drillIn.tabs.eventSequence"),
      icon: <List className="w-3.5 h-3.5" />,
    },
  ];
  return (
    <div className="flex gap-1 p-1 bg-surface-3 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
            active === tab.id
              ? "bg-surface-5 text-gray-100 shadow-sm"
              : "text-gray-500 hover:text-gray-300",
          ].join(" ")}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Agent Tree ────────────────────────────────────────────────────────────────

/** Props for {@link TreeNode}. */
interface TreeNodeProps {
  /** Agent to render. */
  node: AgentNode;
  /** Nesting depth; each level indents 20px. */
  depth: number;
}

/**
 * One agent row in the tree (name, subagent type, status chip, and duration or `running`) followed
 * by its children, rendered recursively one level deeper.
 */
function TreeNode({ node, depth }: TreeNodeProps) {
  const { t } = useTranslation(["workflows", "common"]);
  const indentPx = depth * 20;
  const isMain = node.type === "main";
  const dur = node.ended_at
    ? formatMs(
        Math.max(
          0,
          new Date(node.ended_at + "Z").getTime() - new Date(node.started_at + "Z").getTime()
        )
      )
    : t("common:running");
  const sc = statusColor(node.status);
  const statusLabel = t(`common:status.${node.status}`, { defaultValue: node.status });

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-white/5 rounded transition-colors"
        style={{ paddingLeft: `${indentPx + 8}px`, paddingRight: "8px" }}
      >
        {/* Depth connector line */}
        {depth > 0 && <span className="w-px h-4 bg-border flex-shrink-0 -ml-3 mr-1" aria-hidden />}

        {/* Status badge */}
        <span
          className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${sc}`}
        >
          {statusLabel}
        </span>

        {/* Name */}
        <span
          className={`text-sm font-medium truncate ${isMain ? "text-indigo-300" : "text-gray-200"}`}
        >
          {node.name}
        </span>

        {/* Subagent type */}
        {node.subagent_type && (
          <span className="text-xs text-gray-500 truncate flex-shrink-0">
            [{node.subagent_type}]
          </span>
        )}

        {/* Duration */}
        <span className="ml-auto flex-shrink-0 text-xs text-gray-600 tabular-nums">{dur}</span>
      </div>

      {node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Props for {@link AgentTree}. */
interface AgentTreeProps {
  /** Root agents of the session, each with nested subagents. */
  tree: SessionDrillInData["tree"];
}

/** Scrollable agent tree for the session, or an empty message when it has no agents. */
function AgentTree({ tree }: AgentTreeProps) {
  const { t } = useTranslation("workflows");
  if (tree.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">{t("drillIn.noAgentTree")}</p>;
  }

  return (
    <div className="overflow-auto max-h-[420px] pr-1">
      {tree.map((node) => (
        <TreeNode key={node.id} node={node} depth={0} />
      ))}
    </div>
  );
}

// ── Tool Timeline ─────────────────────────────────────────────────────────────

/** One tool call in the session's tool timeline. */
type ToolEvent = SessionDrillInData["toolTimeline"][number];

/** Props for {@link ToolTimeline}. */
interface ToolTimelineProps {
  /** Tool calls in time order. */
  events: ToolEvent[];
}

/**
 * Scrollable list of the session's tool calls, each with the tool name (or event type), its
 * summary, and timestamp; or an empty message.
 */
function ToolTimeline({ events }: ToolTimelineProps) {
  const { t } = useTranslation("workflows");
  if (events.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">{t("drillIn.noToolEvents")}</p>;
  }

  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <div className="flex flex-col gap-1 min-w-0">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
          >
            {/* Tool pill */}
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 whitespace-nowrap">
              {ev.tool_name ?? ev.event_type}
            </span>

            {/* Summary */}
            {ev.summary && (
              <span className="text-xs text-gray-400 truncate flex-1 min-w-0">{ev.summary}</span>
            )}

            {/* Timestamp */}
            <span className="flex-shrink-0 text-[10px] text-gray-600 tabular-nums ml-auto">
              {safeTimestamp(ev.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event Sequence ────────────────────────────────────────────────────────────

/** Props for {@link EventSequence}. */
interface EventSequenceProps {
  /** Session events to list. */
  events: DashboardEvent[];
}

/** Text color for each event type in the event sequence. */
const EVENT_TYPE_COLOR: Record<string, string> = {
  tool_use: "text-blue-400",
  tool_result: "text-emerald-400",
  agent_start: "text-indigo-400",
  agent_stop: "text-violet-400",
  compaction: "text-amber-400",
  error: "text-red-400",
};

/**
 * Text color for an event type, gray for types without a specific color.
 *
 * @param type - Event type.
 * @returns Tailwind text class.
 */
function eventTypeColor(type: string): string {
  return EVENT_TYPE_COLOR[type] ?? "text-gray-400";
}

/**
 * The session's raw event stream, limited to the first 100 events, with color-coded types and
 * summaries.
 */
function EventSequence({ events }: EventSequenceProps) {
  const { t } = useTranslation("workflows");
  if (events.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-8">{t("drillIn.noEvents")}</p>;
  }

  const recent = events.slice(0, 100);

  return (
    <div className="overflow-auto max-h-[420px]">
      <div className="flex flex-col gap-0.5">
        {recent.map((ev) => (
          <div
            key={ev.id}
            className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
          >
            {/* Event type badge */}
            <span
              className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide mt-0.5 w-[90px] truncate ${eventTypeColor(ev.event_type)}`}
              title={ev.event_type}
            >
              {ev.event_type}
            </span>

            {/* Summary */}
            <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">
              {ev.summary ?? ev.tool_name ?? "-"}
            </span>

            {/* Timestamp */}
            <span className="flex-shrink-0 text-[10px] text-gray-600 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {safeTimestamp(ev.created_at)}
            </span>
          </div>
        ))}
        {events.length > 100 && (
          <p className="text-xs text-gray-600 text-center py-2">
            {t("drillIn.showingOf", { total: events.length })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Loading / Error states ────────────────────────────────────────────────────

/** Pulsing placeholder lines shown while drill-in data loads. */
function LoadingState() {
  return (
    <div className="flex flex-col gap-3 py-8 px-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-4 bg-surface-4 rounded" style={{ width: `${80 - i * 10}%` }} />
      ))}
    </div>
  );
}

/** Props for {@link ErrorState}. */
interface ErrorStateProps {
  /** Error message from the failed request. */
  message: string;
}

/** Error panel shown when the drill-in request fails. */
function ErrorState({ message }: ErrorStateProps) {
  const { t } = useTranslation("workflows");
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
        <X className="w-4 h-4 text-red-400" />
      </div>
      <p className="text-sm font-medium text-red-400">{t("drillIn.failedLoad")}</p>
      <p className="text-xs text-gray-600 mt-1 max-w-xs">{message}</p>
    </div>
  );
}

// ── Empty / no-selection state ────────────────────────────────────────────────

/** Props for {@link NoSessionState}. */
interface NoSessionStateProps {
  /** Called with the id of the session the user picks. */
  onSelectSession: (id: string) => void;
}

/**
 * Placeholder shown before a session is chosen: previews the three tabs and embeds the {@link
 * SessionSelector}.
 */
function NoSessionState({ onSelectSession }: NoSessionStateProps) {
  const { t } = useTranslation("workflows");
  const tabs = [
    {
      id: "tree" as Tab,
      label: t("drillIn.tabs.agentTree"),
      icon: <GitFork className="w-3.5 h-3.5" />,
    },
    {
      id: "timeline" as Tab,
      label: t("drillIn.tabs.toolTimeline"),
      icon: <Wrench className="w-3.5 h-3.5" />,
    },
    {
      id: "events" as Tab,
      label: t("drillIn.tabs.eventSequence"),
      icon: <List className="w-3.5 h-3.5" />,
    },
  ];
  return (
    <div className="flex flex-col py-6 px-4 border-2 border-dashed border-border rounded-xl">
      <SessionSelector onSelectSession={onSelectSession} />

      <div className="flex flex-col items-center text-center mt-2">
        <div className="w-10 h-10 rounded-xl bg-surface-4 flex items-center justify-center mb-4">
          <GitFork className="w-5 h-5 text-gray-600" />
        </div>
        <p className="text-sm font-medium text-gray-400 mb-1">{t("drillIn.noSessionSelected")}</p>
        <p className="text-xs text-gray-600 max-w-xs">{t("drillIn.noSessionDesc")}</p>

        {/* Preview tab pills */}
        <div className="flex gap-2 mt-5">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 bg-surface-3 border border-border"
            >
              {tab.icon}
              {tab.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Session header ────────────────────────────────────────────────────────────

/** Props for {@link SessionHeader}. */
interface SessionHeaderProps {
  /** Drill-in data for the open session. */
  drillIn: SessionDrillInData;
  /** Closes the drill-in. */
  onClose: () => void;
  /** Selected tab. */
  activeTab: Tab;
  /** Called when a tab is clicked. */
  onTabChange: (t: Tab) => void;
}

/** Drill-in header: session name (or id), model and status, a close button, and the tab bar. */
function SessionHeader({ drillIn, onClose, activeTab, onTabChange }: SessionHeaderProps) {
  const { t } = useTranslation("workflows");
  const { session } = drillIn;

  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">
            {session.name ?? session.id}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {formatModelName(session.model) ?? t("drillIn.unknownModel")} &middot;{" "}
            {t(`common:status.${session.status}`, { defaultValue: session.status })}
            {session.started_at && ` \u00b7 ${safeTimestamp(session.started_at)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
          aria-label={t("drillIn.closePanel")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <TabBar active={activeTab} onChange={onTabChange} />
    </div>
  );
}

// ── Session Selector ──────────────────────────────────────────────────────────

/** Sessions fetched per page in the selector dropdown. */
const PAGE_SIZE = 20;

/** Props for {@link SessionSelector}. */
interface SessionSelectorProps {
  /** Called with the id of the chosen session. */
  onSelectSession: (id: string) => void;
}

/**
 * Searchable session dropdown for picking a session to drill into. Without a search it pages
 * through sessions {@link PAGE_SIZE} at a time; the first keystroke lazily loads up to 5,000
 * sessions once so the search can match any session by name or id. Closes on an outside click.
 */
function SessionSelector({ onSelectSession }: SessionSelectorProps) {
  const { t } = useTranslation("workflows");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Fetch one page of sessions for the dropdown, replacing or appending to the list, and note
   * whether more pages exist.
   */
  const fetchPage = useCallback((pageOffset: number, replace: boolean) => {
    setLoading(true);
    api.sessions
      .list({ limit: PAGE_SIZE, offset: pageOffset })
      .then(({ sessions: page }) => {
        setSessions((prev) => (replace ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
        setOffset(pageOffset + page.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load ALL sessions for search (once, lazily)
  const loadAllSessions = useCallback(() => {
    if (allLoaded) return;
    setAllLoaded(true);
    // Fetch large batch for search
    api.sessions
      .list({ limit: 5000, offset: 0 })
      .then(({ sessions: all }) => setAllSessions(all))
      .catch(() => {});
  }, [allLoaded]);

  // Load first page when dropdown opens
  useEffect(() => {
    if (open && sessions.length === 0) {
      fetchPage(0, true);
    }
  }, [open, sessions.length, fetchPage]);

  // When user starts typing, load all sessions for search
  useEffect(() => {
    if (search.trim().length > 0) {
      loadAllSessions();
    }
  }, [search, loadAllSessions]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // When searching, filter across ALL sessions; otherwise show paginated
  const filtered = search.trim()
    ? (allSessions.length > 0 ? allSessions : sessions).filter((s) => {
        const q = search.toLowerCase();
        return (s.name ?? "").toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      })
    : sessions;

  function handleSelect(id: string) {
    setOpen(false);
    setSearch("");
    onSelectSession(id);
  }

  function handleLoadMore() {
    fetchPage(offset, false);
  }

  return (
    <div ref={containerRef} className="relative mb-4">
      {/* Trigger row */}
      <div
        className={[
          "flex items-center gap-2 px-3 py-2 rounded-lg border bg-surface-3 transition-colors cursor-text",
          open ? "border-indigo-500/40 ring-1 ring-indigo-500/20" : "border-border",
        ].join(" ")}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          placeholder={t("drillIn.searchPlaceholder")}
          className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none min-w-0"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
        />
        <ChevronDown
          className={[
            "w-3.5 h-3.5 text-gray-600 flex-shrink-0 transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {loading && sessions.length === 0 ? (
              <div className="flex flex-col gap-2 p-3 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-3 bg-surface-4 rounded"
                    style={{ width: `${75 - i * 8}%` }}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-6 px-3">
                {search.trim() ? t("drillIn.noMatch") : t("drillIn.notFound")}
              </p>
            ) : (
              <div className="flex flex-col">
                {filtered.map((s) => {
                  const sc = statusColor(s.status);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelect(s.id)}
                      className="flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-border/50 last:border-0"
                    >
                      <span
                        className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${sc}`}
                      >
                        {s.status}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-gray-200 truncate">
                          {s.name ?? s.id}
                        </span>
                        {s.name && (
                          <span className="block text-[10px] text-gray-600 font-mono truncate">
                            {s.id}
                          </span>
                        )}
                      </span>
                      {s.model && (
                        <span className="flex-shrink-0 text-[10px] text-gray-500 truncate max-w-[80px]">
                          {formatModelName(s.model)}
                        </span>
                      )}
                      {s.started_at && (
                        <span className="flex-shrink-0 text-[10px] text-gray-600 tabular-nums">
                          {safeTimestamp(s.started_at)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Load more - only show when not filtering client-side */}
            {!search.trim() && hasMore && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full px-3 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors border-t border-border/50 disabled:opacity-50"
              >
                {loading ? t("drillIn.loading") : t("drillIn.loadMore")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

/** Props for {@link SessionDrillIn}. */
export interface SessionDrillInProps {
  /** Session to show, or null to show the session picker. */
  sessionId: string | null;
  /** Closes the drill-in. */
  onClose: () => void;
  /** Called when a session is picked from the empty state. */
  onSelectSession: (id: string) => void;
}

/**
 * Per-session drill-in on the Workflows page. Loads `/api/workflows/session/:id` whenever
 * `sessionId` changes (ignoring responses that arrive after a newer request) and shows the
 * session's agent tree, tool timeline, and event sequence in tabs. Opens on the agent tree each
 * time a session loads.
 */
export function SessionDrillIn({ sessionId, onClose, onSelectSession }: SessionDrillInProps) {
  const { t } = useTranslation(["workflows", "common"]);
  const [activeTab, setActiveTab] = useState<Tab>("tree");
  const [drillIn, setDrillIn] = useState<SessionDrillInData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setDrillIn(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDrillIn(null);

    api.workflows
      .session(sessionId)
      .then((data) => {
        if (!cancelled) {
          setDrillIn(data);
          setActiveTab("tree");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : t("common:unexpectedError");
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  // No session selected
  if (!sessionId) {
    return <NoSessionState onSelectSession={onSelectSession} />;
  }

  if (loading) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <SessionSelector onSelectSession={onSelectSession} />
        <LoadingState />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <SessionSelector onSelectSession={onSelectSession} />
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-600 font-mono truncate">{sessionId}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors"
            aria-label={t("drillIn.close")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <ErrorState message={error} />
      </div>
    );
  }

  if (!drillIn) return null;

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 animate-fade-in">
      <SessionSelector onSelectSession={onSelectSession} />
      <SessionHeader
        drillIn={drillIn}
        onClose={onClose}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab content */}
      {activeTab === "tree" && <AgentTree tree={drillIn.tree} />}
      {activeTab === "timeline" && <ToolTimeline events={drillIn.toolTimeline} />}
      {activeTab === "events" && <EventSequence events={drillIn.events} />}
    </div>
  );
}
