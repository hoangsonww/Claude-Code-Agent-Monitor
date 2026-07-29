/**
 * @file Collapsible right-hand priority sidecar for the WIP queue page.
 * Lists projects in current priority order (lower `priority` value = higher
 * priority = higher on the list) and lets Sara drag-reorder them, committing
 * the new order via `PUT /api/projects/reorder` (`api.projects.reorder`).
 * DnD reuses the exact native HTML5 drag-and-drop shape already hand-rolled
 * in `KanbanBoard.tsx`'s `handleColumnDragStart`/`DragOver`/`DragEnd` (no new
 * dependency) - the only difference from that precedent is the persistence
 * target (a server round trip instead of `projectOrder.ts`'s localStorage
 * write). Collapsed by default; scoped to queue-represented projects by
 * default with a "show all projects" toggle (both PM auto-decided defaults
 * per technical-plan.md).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useMemo, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, GripVertical, ListOrdered } from "lucide-react";
import type { Project } from "../lib/types";

interface WipPrioritySidecarProps {
  /** Every known project (any priority, any queue membership). */
  projects: Project[];
  /** Ids of projects currently represented by at least one queued session -
   *  the default (non-"show all") list scope. */
  queueProjectIds: Set<string>;
  /** Called with the full new top-to-bottom id order once a drag commits
   *  (mirrors `api.projects.reorder`'s own `order: string[]` shape). */
  onReorder: (order: string[]) => void;
}

/**
 * The right-hand priority sidecar: collapsed by default, showing
 * queue-represented projects only until "show all projects" is toggled on.
 * Rows are native-HTML5-draggable; dropping one commits the resulting order.
 */
export function WipPrioritySidecar({
  projects,
  queueProjectIds,
  onReorder,
}: WipPrioritySidecarProps) {
  const { t } = useTranslation("wip");
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [liveOrderIds, setLiveOrderIds] = useState<string[] | null>(null);

  // Ascending by priority (lower = higher priority = higher on the list) -
  // ties broken by name so the order is stable/deterministic for equal ranks.
  const priorityOrderedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const diff = (a.priority ?? 0) - (b.priority ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }),
    [projects]
  );

  const scopedProjects = useMemo(
    () =>
      showAll
        ? priorityOrderedProjects
        : priorityOrderedProjects.filter((p) => queueProjectIds.has(p.id)),
    [priorityOrderedProjects, showAll, queueProjectIds]
  );

  // The in-progress drag preview reorders `scopedProjects` live; committed
  // (or absent) otherwise, so the list just reflects current priority order.
  const displayedProjects = useMemo(() => {
    if (!liveOrderIds) return scopedProjects;
    const byId = new Map(scopedProjects.map((p) => [p.id, p]));
    return liveOrderIds.map((id) => byId.get(id)).filter((p): p is Project => Boolean(p));
  }, [scopedProjects, liveOrderIds]);

  function handleDragStart(id: string) {
    setDraggedId(id);
    setLiveOrderIds(scopedProjects.map((p) => p.id));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault(); // required for onDrop to ever fire
    if (!draggedId || draggedId === targetId) return;
    setLiveOrderIds((prev) => {
      const current = prev ?? scopedProjects.map((p) => p.id);
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  }

  function handleDragEnd() {
    if (liveOrderIds) onReorder(liveOrderIds);
    setDraggedId(null);
    setLiveOrderIds(null);
  }

  return (
    <div
      className={`flex-shrink-0 border-l border-border bg-surface-2 transition-all duration-200 ${
        open ? "w-64" : "w-10"
      }`}
    >
      <button
        type="button"
        data-testid="wip-sidecar-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("sidecar.collapse") : t("sidecar.expand")}
        className="w-full flex items-center justify-center gap-1.5 py-3 text-gray-400 hover:text-gray-200"
      >
        {open ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {!open && <ListOrdered className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("sidecar.title")}
            </h2>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-accent"
            />
            {t("sidecar.showAll")}
          </label>

          {displayedProjects.length === 0 ? (
            <p className="text-xs text-gray-500">{t("sidecar.empty")}</p>
          ) : (
            <div className="space-y-1.5">
              {displayedProjects.map((project) => (
                <div
                  key={project.id}
                  data-testid="wip-sidecar-project"
                  draggable
                  onDragStart={() => handleDragStart(project.id)}
                  onDragOver={(e) => handleDragOver(e, project.id)}
                  onDrop={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-3 text-xs text-gray-200 cursor-grab truncate ${
                    draggedId === project.id ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="truncate">{project.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
