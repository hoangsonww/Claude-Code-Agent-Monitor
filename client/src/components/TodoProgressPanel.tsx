/**
 * @file Full owner-aware task-progress panel for Session Detail, combining a
 * segmented donut, completion bar, owner breakdown, and task rows paginated
 * ten at a time.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/TodoProgressPanel.tsx
 * **Area:** client component
 * **Responsibility:**
 * Full owner-aware task-progress panel for Session Detail, combining a segmented donut, completion
 * bar, owner breakdown, and task rows paginated ten at a time.
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
 * - `./PaginatedLegend` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./todoProgress` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `TodoProgressPanel` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `STATUS_ICONS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TaskRow` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TodoProgressPanel` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `sessions` — visible copy resolves through this namespace; key and interpolation parity applies
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/TodoProgressPanel.tsx`
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
 * **Path:** `client/src/components/TodoProgressPanel.tsx`
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
 * - `../lib/format`
 * - `./todoProgress`
 * - `./PaginatedLegend`
 *
 * ## Public surface
 * - `TodoProgressPanel` — exported API; see TSDoc on the symbol for behavior.
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
 * **TodoProgressPanel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { Check, Circle, Info, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionTodoItem, SessionTodoSnapshot, SessionTodoStatus } from "../lib/types";
import { timeAgo } from "../lib/format";
import { TODO_STATUS_META, taskProgressSegments, taskSourceLabel } from "./todoProgress";
import { PaginatedLegend } from "./PaginatedLegend";

/** Icon for each task status. */
const STATUS_ICONS = {
  completed: Check,
  in_progress: LoaderCircle,
  pending: Circle,
  cancelled: X,
  unknown: Info,
} satisfies Record<SessionTodoStatus, typeof Circle>;

/**
 * Task progress panel on Session Detail: a donut segmented by status with the completion figures,
 * the current task, done and remaining counts, per-agent progress when subagents own tasks, a note
 * when the state was reconstructed from partial updates, and the full task list. Renders nothing
 * when there are no tasks.
 */
export function TodoProgressPanel({ snapshot }: { snapshot: SessionTodoSnapshot }) {
  const { t } = useTranslation("sessions");
  if (snapshot.total <= 0) return null;
  const segments = taskProgressSegments(snapshot);
  const circumference = 2 * Math.PI * 46;
  let offset = circumference / 4;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border bg-surface-1">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-200">{t("taskProgress.title")}</h3>
        <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
          {taskSourceLabel(snapshot.sourceTool, t("taskProgress.title"))}
        </span>
        {snapshot.includesSubagents && (
          <span className="rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
            {t("taskProgress.includesSubagents")}
          </span>
        )}
        {snapshot.confidence === "partial" && (
          <span className="text-[10px] text-amber-400/80">{t("taskProgress.partialSource")}</span>
        )}
        {snapshot.updatedAt && (
          <span className="ml-auto text-[10px] text-gray-500">{timeAgo(snapshot.updatedAt)}</span>
        )}
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[132px_minmax(0,1fr)_minmax(220px,0.7fr)]">
        <div className="flex items-center justify-center">
          <div className="relative h-28 w-28">
            <svg width={112} height={112} viewBox="0 0 112 112" aria-hidden="true">
              <circle cx={56} cy={56} r={46} fill="none" stroke="#303044" strokeWidth={12} />
              {segments.map((segment) => {
                const dash = (segment.value / snapshot.total) * circumference;
                const currentOffset = offset;
                offset -= dash;
                return (
                  <circle
                    key={segment.status}
                    cx={56}
                    cy={56}
                    r={46}
                    fill="none"
                    stroke={TODO_STATUS_META[segment.status].color}
                    strokeWidth={12}
                    strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
                    strokeDashoffset={currentOffset}
                    transform="rotate(-90 56 56)"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-gray-100">
                {snapshot.percentComplete == null ? "—" : `${snapshot.percentComplete}%`}
              </span>
              <span className="text-[10px] text-gray-500">{t("taskProgress.complete")}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-100">
            {t("taskProgress.completeCountShort", {
              completed: snapshot.completed,
              total: snapshot.total,
            })}
          </p>
          {snapshot.activeText && (
            <p className="mt-1 line-clamp-2 text-sm text-blue-300">
              {t("taskProgress.current", { task: snapshot.activeText })}
            </p>
          )}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-4">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width]"
              style={{ width: `${snapshot.percentComplete ?? 0}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>{t("taskProgress.doneCount", { count: snapshot.completed })}</span>
            <span>
              {t("taskProgress.remainingCount", { count: snapshot.total - snapshot.completed })}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {segments.map((segment) => {
              const meta = TODO_STATUS_META[segment.status];
              return (
                <span
                  key={segment.status}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${meta.bgClass} ${meta.borderClass} ${meta.textClass}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {segment.value} {t(meta.labelKey)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 border-l border-border pl-5 max-lg:border-l-0 max-lg:border-t max-lg:pl-0 max-lg:pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {t("taskProgress.owners")}
          </p>
          <div className="mt-2 space-y-2">
            {snapshot.ownerBreakdown.map((owner) => {
              const percent =
                owner.total > 0 ? Math.round((owner.completed / owner.total) * 100) : 0;
              return (
                <div key={owner.agentId}>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-gray-300">
                      {owner.agentType === "main" ? t("taskProgress.mainAgent") : owner.agentType}
                    </span>
                    <span className="font-mono text-gray-500">
                      {owner.completed}/{owner.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-4">
                    <div
                      className="h-full rounded-full bg-violet-400/80"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {snapshot.explanation && (
            <p className="mt-4 line-clamp-3 text-[11px] leading-relaxed text-gray-500">
              {snapshot.explanation}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border">
        <PaginatedLegend
          items={snapshot.items}
          pageSize={10}
          getKey={(item) => `${item.agentId}-${item.id}`}
          renderItem={(item) => <TaskRow item={item} />}
          controlsClassName="px-5 pb-3"
        />
      </div>
    </section>
  );
}

/** One task row: status icon, text with optional description, and its owning agent. */
function TaskRow({ item }: { item: SessionTodoItem }) {
  const { t } = useTranslation("sessions");
  const Icon = STATUS_ICONS[item.status];
  const meta = TODO_STATUS_META[item.status];
  return (
    <div className="grid min-h-11 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 px-5 py-2.5">
      <Icon
        className={`h-3.5 w-3.5 ${meta.textClass} ${
          item.status === "in_progress" ? "animate-spin" : ""
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p
          className={`text-xs leading-5 ${
            item.status === "completed" || item.status === "cancelled"
              ? "text-gray-500"
              : "text-gray-200"
          }`}
        >
          {item.text}
        </p>
        {item.description && (
          <p className="truncate text-[10px] text-gray-600">{item.description}</p>
        )}
      </div>
      <div className="flex max-w-44 items-center gap-1.5">
        {item.agentType !== "main" && (
          <span className="truncate rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300">
            {item.agentType}
          </span>
        )}
        <span className={`whitespace-nowrap text-[9px] ${meta.textClass}`}>{t(meta.labelKey)}</span>
      </div>
    </div>
  );
}
