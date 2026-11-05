/**
 * @file Compact task-progress donut for Sessions table rows with an accessible,
 * viewport-clamped detail tooltip rendered through a body portal.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/TodoProgressIndicator.tsx
 * **Area:** client component
 * **Responsibility:**
 * Compact task-progress donut for Sessions table rows with an accessible, viewport-clamped detail
 * tooltip rendered through a body portal.
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
 * - `./todoProgress` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-dom` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `ProgressDonut` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `TodoProgressIndicator` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ProgressDonut` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `STATUS_ICONS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `StatusSummary` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TaskPreviewRow` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TodoProgressIndicator` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `TodoProgressIndicatorProps` (interface) — top-level declaration that helps orient code review
 *   and focused test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useId` — lifecycle/state dependency detected in this module; preserve dependency freshness and
 *   cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/TodoProgressIndicator.tsx`
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
 * **Path:** `client/src/components/TodoProgressIndicator.tsx`
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
 *
 * ## Public surface
 * - `TodoProgressIndicator` — exported API; see TSDoc on the symbol for behavior.
 * - `ProgressDonut` — exported API; see TSDoc on the symbol for behavior.
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
 * **TodoProgressIndicator**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ProgressDonut**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Circle, CircleDashed, Info, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionTodoItem, SessionTodoStatus, SessionTodoSummary } from "../lib/types";
import { timeAgo } from "../lib/format";
import { TODO_STATUS_META, taskProgressSegments, taskSourceLabel } from "./todoProgress";

/** Icon for each task status. */
const STATUS_ICONS = {
  completed: Check,
  in_progress: LoaderCircle,
  pending: Circle,
  cancelled: X,
  unknown: Info,
} satisfies Record<SessionTodoStatus, typeof Circle>;

/** Props for {@link TodoProgressIndicator}. */
interface TodoProgressIndicatorProps {
  /** Task progress summary to show. */
  progress: SessionTodoSummary;
  /** Stop clicks from reaching the parent, for use inside clickable rows and cards. */
  stopClickPropagation?: boolean;
}

/**
 * Compact task-progress indicator for session rows and cards: a progress donut with the completed
 * count. Hovering or focusing it opens a tooltip with the status breakdown, the current task, and a
 * preview of upcoming tasks.
 */
export function TodoProgressIndicator({
  progress,
  stopClickPropagation = false,
}: TodoProgressIndicatorProps) {
  const { t } = useTranslation("sessions");
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  /**
   * Place the tooltip centered under the indicator, at most 340px wide and kept inside the
   * viewport.
   */
  const positionTooltip = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const width = Math.min(340, Math.max(0, window.innerWidth - margin * 2));
    const left = Math.max(
      margin,
      Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin)
    );
    const preferredTop = rect.bottom + 8;
    const top =
      preferredTop + 360 > window.innerHeight ? Math.max(margin, rect.top - 368) : preferredTop;
    setPosition({ left, top });
  }, []);

  /** Position and open the tooltip. */
  const show = useCallback(() => {
    positionTooltip();
    setOpen(true);
  }, [positionTooltip]);

  if (progress.total <= 0) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="relative inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        aria-label={t("taskProgress.aria", {
          completed: progress.completed,
          total: progress.total,
        })}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={stopClickPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <ProgressDonut progress={progress} size={20} strokeWidth={3} />
        {progress.inProgress > 0 && (
          <span
            className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full border border-surface-1 bg-blue-400"
            aria-hidden="true"
          />
        )}
      </button>
      {open &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="fixed z-[99999] w-[340px] max-w-[calc(100vw-24px)] rounded-lg border border-[#2a2a4a] bg-[#12121f] p-3 text-left shadow-2xl"
            style={{ left: position.left, top: position.top }}
          >
            <div className="flex items-start gap-3">
              <ProgressDonut progress={progress} size={42} strokeWidth={6} showPercent />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-100">{t("taskProgress.title")}</p>
                <p className="mt-0.5 text-[11px] text-gray-300">
                  {t("taskProgress.completeCount", {
                    completed: progress.completed,
                    total: progress.total,
                    percent: progress.percentComplete ?? 0,
                  })}
                </p>
                {progress.activeText && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-blue-300">
                    {t("taskProgress.current", { task: progress.activeText })}
                  </p>
                )}
              </div>
            </div>

            <StatusSummary progress={progress} />

            {progress.previewItems.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-[#2a2a4a] pt-2.5">
                {progress.previewItems.map((item) => (
                  <TaskPreviewRow key={`${item.agentId}-${item.id}`} item={item} />
                ))}
                {progress.overflowCount > 0 && (
                  <p className="pl-5 text-[10px] text-gray-500">
                    {t("taskProgress.more", { count: progress.overflowCount })}
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[#2a2a4a] pt-2 text-[10px] text-gray-500">
              <span>{taskSourceLabel(progress.sourceTool, t("taskProgress.title"))}</span>
              {progress.updatedAt && <span>{timeAgo(progress.updatedAt)}</span>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/**
 * Ring chart of task completion: a track circle with a progress arc on top, and an optional
 * percentage in the middle.
 */
export function ProgressDonut({
  progress,
  size,
  strokeWidth,
  showPercent = false,
}: {
  /** Progress to draw: a summary or snapshot. */
  progress:
    | SessionTodoSummary
    | { completed: number; total: number; percentComplete: number | null };
  /** Diameter in pixels. */
  size: number;
  /** Ring thickness in pixels. */
  strokeWidth: number;
  /** Show the completion percentage inside the ring. */
  showPercent?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const completed = progress.total > 0 ? progress.completed / progress.total : 0;
  const dash = completed * circumference;
  return (
    <span
      className="relative inline-flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#303044"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showPercent && (
        <span className="absolute text-[9px] font-semibold text-gray-200">
          {progress.percentComplete == null ? "—" : `${progress.percentComplete}%`}
        </span>
      )}
    </span>
  );
}

/** Grid of status counts in the tooltip. */
function StatusSummary({ progress }: { progress: SessionTodoSummary }) {
  const { t } = useTranslation("sessions");
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {taskProgressSegments(progress).map((segment) => {
        const meta = TODO_STATUS_META[segment.status];
        return (
          <div
            key={segment.status}
            className={`rounded border px-1.5 py-1 ${meta.bgClass} ${meta.borderClass}`}
          >
            <p className={`text-[10px] font-semibold ${meta.textClass}`}>{segment.value}</p>
            <p className="truncate text-[9px] text-gray-500">{t(meta.labelKey)}</p>
          </div>
        );
      })}
    </div>
  );
}

/** One task in the tooltip preview, with its status icon (spinning while in progress) and text. */
function TaskPreviewRow({ item }: { item: SessionTodoItem }) {
  const Icon = STATUS_ICONS[item.status] || CircleDashed;
  const meta = TODO_STATUS_META[item.status];
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon
        className={`mt-0.5 h-3 w-3 flex-shrink-0 ${meta.textClass} ${
          item.status === "in_progress" ? "animate-spin" : ""
        }`}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 line-clamp-2 text-[10px] leading-4 text-gray-300">{item.text}</p>
      {item.agentType !== "main" && (
        <span className="max-w-20 truncate rounded bg-violet-500/10 px-1 py-0.5 text-[9px] text-violet-300">
          {item.agentType}
        </span>
      )}
    </div>
  );
}
