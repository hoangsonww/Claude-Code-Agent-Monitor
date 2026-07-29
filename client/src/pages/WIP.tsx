/**
 * @file WIP.tsx
 * @description The WIP (work-in-progress) queue page: a single, live,
 * priority-ordered queue of `status === "active"` session cards. Sessions
 * currently awaiting Sara's input always sort above every session that
 * isn't; ties (and ordering among non-awaiting sessions) are broken by each
 * session's owning project's `priority`, set via drag reorder in the
 * collapsible right-hand `WipPrioritySidecar`. Cards are `WipSessionCard` -
 * the existing `SessionCard`, wrapped (not edited) to make the project name
 * visually prominent. Layout is a responsive 1/2/3-column contiguous-chunk
 * fill, driven by the queue container's own measured width (`ResizeObserver`
 * on the container, not `window`/viewport breakpoints) - the sidecar can
 * shrink the queue independent of window size, so viewport breakpoints alone
 * would misbehave here. Everything - queue membership, sort order, and
 * priority changes made in any tab - is WebSocket-live via `eventBus`; no
 * polling, no manual refresh.
 *
 * This is the fourth independent consumer of the
 * `Session`/`isSessionAwaitingInput`/cwd->project surface (after Kanban,
 * Focus List, Focus Calendar): membership/sort/column logic all live in
 * `../lib/wipQueue.ts` (which reuses `isSessionAwaitingInput` etc. exactly
 * as Kanban does) and project resolution goes through the same
 * `../lib/projectLookup.ts` join Kanban's Projects view uses - see
 * `client/src/lib/__tests__/sessionSurfaceParity.test.ts` for the standing
 * cross-consumer proof this never silently drifts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ListChecks } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { EmptyState } from "../components/EmptyState";
import { CardSkeleton } from "../components/Skeleton";
import { WipSessionCard } from "../components/WipSessionCard";
import { WipPrioritySidecar } from "../components/WipPrioritySidecar";
import { buildCwdProjectIndex, projectForSession } from "../lib/projectLookup";
import { isWipMember, sortWipQueue, assignToColumns } from "../lib/wipQueue";
import type {
  Project,
  ProjectPriorityUpdatedPayload,
  Session,
  SessionDeletedPayload,
  WSMessage,
} from "../lib/types";

/** Tailwind's own `md`/`lg` pixel breakpoints, reused as the concrete
 *  1/2/3-column thresholds (technical-plan.md's recommended approach) -
 *  driven by the queue container's measured width, never `window`. */
function columnCountForWidth(width: number): 1 | 2 | 3 {
  if (width >= 1024) return 3;
  if (width >= 768) return 2;
  return 1;
}

/** Applies one incoming `session_created`/`session_updated` push to the
 *  current session list: removes the session if it's no longer a WIP member
 *  (status flipped off "active"), upserts it otherwise. Single merge path so
 *  the initial-fetch filter and the live-merge filter can't drift from each
 *  other (mirrors `isWipMember`'s own "single definition" role). */
function mergeSessionUpdate(sessions: Session[], updated: Session): Session[] {
  const exists = sessions.some((s) => s.id === updated.id);
  if (!isWipMember(updated)) {
    return exists ? sessions.filter((s) => s.id !== updated.id) : sessions;
  }
  return exists ? sessions.map((s) => (s.id === updated.id ? updated : s)) : [...sessions, updated];
}

/** Applies a `project_updated` push's `{ id, priority }` pairs onto the
 *  current project list, leaving every other project (and every other
 *  field) untouched. */
function mergeProjectPriorities(
  projects: Project[],
  updates: Array<{ id: string; priority: number }>
): Project[] {
  const byId = new Map(updates.map((u) => [u.id, u.priority]));
  return projects.map((p) => (byId.has(p.id) ? { ...p, priority: byId.get(p.id) as number } : p));
}

export function WIP() {
  const { t } = useTranslation("wip");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnCount, setColumnCount] = useState<1 | 2 | 3>(1);

  // A state-backed callback ref (not a plain `useRef` + mount-only effect) -
  // the queue container only exists in the DOM once loading finishes AND the
  // queue is non-empty, so a `[]`-deps effect reading a plain ref would have
  // observed nothing (the ref would still be null the one time it ran).
  // Re-running the observer setup whenever the container itself mounts (or
  // unmounts, e.g. transitioning to/from the empty state) keeps this correct.
  const [queueContainerEl, setQueueContainerEl] = useState<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [sessionsRes, projectsRes] = await Promise.all([
        api.sessions.list({ status: "active", limit: 500 }),
        api.projects.list(),
      ]);
      setSessions(sessionsRes.sessions);
      setProjects(projectsRes.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Container-width-driven column count - NOT a `window` resize listener, so
  // the sidecar opening/closing (which changes the container's width without
  // touching the viewport) drives column count correctly on its own.
  useEffect(() => {
    const el = queueContainerEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect?.width ?? el.clientWidth;
      setColumnCount(columnCountForWidth(width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [queueContainerEl]);

  // Live updates: both independent session-removal signals are wired as two
  // separate branches below (a `session_updated` status flip off "active",
  // and a standalone `session_deleted`) - the two are structurally distinct
  // WS events with no shared guarantee one implies the other, so both must
  // be handled explicitly rather than relying on one to cover the other.
  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "session_created" || msg.type === "session_updated") {
        const updated = msg.data as Session;
        setSessions((prev) => mergeSessionUpdate(prev, updated));
      } else if (msg.type === "session_deleted") {
        const { id } = msg.data as SessionDeletedPayload;
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else if (msg.type === "project_updated") {
        const { projects: updates } = msg.data as ProjectPriorityUpdatedPayload;
        setProjects((prev) => mergeProjectPriorities(prev, updates));
      }
    });
  }, []);

  const projectIndex = useMemo(() => buildCwdProjectIndex(projects), [projects]);

  const queueMembers = useMemo(() => sessions.filter(isWipMember), [sessions]);

  const sortedQueue = useMemo(
    () => sortWipQueue(queueMembers, projectIndex),
    [queueMembers, projectIndex]
  );

  const columns = useMemo(
    () => assignToColumns(sortedQueue, columnCount),
    [sortedQueue, columnCount]
  );

  // Ids of every project currently represented by at least one queued
  // session - the sidecar's default (non-"show all") scope.
  const queueProjectIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of queueMembers) {
      const project = projectForSession(session, projectIndex);
      if (project) ids.add(project.id);
    }
    return ids;
  }, [queueMembers, projectIndex]);

  const handleReorder = useCallback(async (order: string[]) => {
    // Optimistic local update - the server's own dense-rank response
    // (below) then reconciles it to the persisted, authoritative values.
    setProjects((prev) =>
      mergeProjectPriorities(
        prev,
        order.map((id, index) => ({ id, priority: index }))
      )
    );
    try {
      const res = await api.projects.reorder(order);
      setProjects((prev) => mergeProjectPriorities(prev, res.projects));
    } catch {
      // Reload's own next `project_updated` broadcast (from another tab)
      // or a manual refresh will reconcile a failed write - no local
      // rollback attempted here since the queue's own priority tiebreak
      // failing silently open (stale local order) is safer than clobbering
      // whatever else changed concurrently.
    }
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in flex gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={`sk-${i}`} />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = sortedQueue.length === 0;

  return (
    <div className="animate-fade-in flex h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <ListChecks className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-100 truncate">{t("page.title")}</h1>
            <p className="text-xs text-gray-500 truncate">{t("page.subtitle")}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={ListChecks}
              title={t("page.emptyTitle")}
              description={t("page.emptyDescription")}
            />
          </div>
        ) : (
          <div
            ref={setQueueContainerEl}
            data-testid="wip-queue-container"
            className="flex-1 flex gap-4"
          >
            {columns.map((column, i) => (
              <div
                key={`col-${i}`}
                data-testid="wip-queue-column"
                className="flex-1 min-w-0 flex flex-col gap-3"
              >
                {column.map((session) => (
                  <WipSessionCard key={session.id} session={session} projectIndex={projectIndex} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <WipPrioritySidecar
        projects={projects}
        queueProjectIds={queueProjectIds}
        onReorder={handleReorder}
      />
    </div>
  );
}
