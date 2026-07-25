/**
 * @file Projects.tsx
 * @description Projects view: group session working directories (cwds) into
 * named projects and see each project's sessions laid out as a horizontal
 * row, instead of the flat Sessions/Agent Board lists. A project can claim
 * multiple folders (one-to-many); a folder belongs to at most one project.
 * Supports creating a project (optionally from an existing folder), inline
 * rename, deleting a project, and adding/removing folder mappings. Sessions
 * whose cwd isn't mapped to any project yet render in a separate "Unassigned"
 * row so nothing silently disappears from view. A search box filters
 * SESSIONS by their folder (cwd) — not project names — and any project (or
 * the Unassigned bucket) left with zero matching sessions is hidden entirely
 * rather than rendered as an empty shell. Project cards are drag-reorderable
 * (native HTML5 drag-and-drop on the whole card); the display order persists
 * in localStorage per-browser, purely a personal arrangement — it has no
 * server-side representation and doesn't affect any other view. Unassigned
 * always stays pinned last and isn't part of the reorderable set.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type DragEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  FolderKanban,
  Folder,
  FolderPlus,
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  RefreshCw,
  Bot,
  Search,
  GripVertical,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { SessionCard } from "../components/SessionCard";
import { EmptyState } from "../components/EmptyState";
import { CardSkeleton } from "../components/Skeleton";
import { timeAgo } from "../lib/format";
import { loadProjectOrder, persistProjectOrder, applyProjectOrder } from "../lib/projectOrder";
import type { Project, Session, UnassignedProjectBucket, WSMessage } from "../lib/types";

const EMPTY_UNASSIGNED: UnassignedProjectBucket = {
  cwds: [],
  session_count: 0,
  active_count: 0,
  last_activity: null,
};

// Rows can hold many sessions on a busy machine - cap the rendered cards so a
// single sprawling project can't make the whole page unusably tall/slow.
const MAX_CARDS_PER_ROW = 20;

export function Projects() {
  const { t } = useTranslation("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedProjectBucket>(EMPTY_UNASSIGNED);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCwd, setNewCwd] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [addingFolderFor, setAddingFolderFor] = useState<string | null>(null);
  const [newFolderCwd, setNewFolderCwd] = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null);

  // Filters sessions by folder (cwd) only — never by project name. A project
  // (or the Unassigned bucket) left with zero matching sessions is dropped
  // from the rows below entirely, rather than rendered as an empty card.
  const [search, setSearch] = useState("");

  // Manual drag order (project ids), persisted on drop. `liveOrderIds` holds
  // the in-progress shuffle while a drag is active so the cards visibly swap
  // as you drag over them; it's committed to `orderIds` (+ localStorage) on
  // drop and discarded otherwise.
  const [orderIds, setOrderIds] = useState<string[]>(loadProjectOrder);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [liveOrderIds, setLiveOrderIds] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [projectsRes, sessionsRes] = await Promise.all([
        api.projects.list(),
        api.sessions.list({ limit: 10000 }),
      ]);
      setProjects(projectsRes.projects);
      setUnassigned(projectsRes.unassigned);
      setSessions(sessionsRes.sessions);
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

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "session_created" || msg.type === "session_updated") {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(load, 300);
      }
    });
  }, [load]);

  const sessionsByCwd = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!s.cwd) continue;
      if (!map.has(s.cwd)) map.set(s.cwd, []);
      map.get(s.cwd)?.push(s);
    }
    return map;
  }, [sessions]);

  const sessionsFor = useCallback(
    (cwds: string[]) => cwds.flatMap((cwd) => sessionsByCwd.get(cwd) || []),
    [sessionsByCwd]
  );

  const searchQuery = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (session: Session) => !searchQuery || (session.cwd ?? "").toLowerCase().includes(searchQuery),
    [searchQuery]
  );

  // Projects in display order: `liveOrderIds` (mid-drag) if set, else the
  // persisted `orderIds`, else the server's alphabetical order. Any id not
  // present in whichever order list is source-of-truth right now (new
  // projects, or before any manual reorder) is appended in its existing
  // relative order rather than dropped.
  const orderedProjects = useMemo(
    () => applyProjectOrder(projects, liveOrderIds ?? orderIds),
    [projects, orderIds, liveOrderIds]
  );

  function handleProjectDragStart(id: string) {
    setDraggedId(id);
    setLiveOrderIds(orderedProjects.map((p) => p.id));
  }

  function handleProjectDragOver(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault(); // required for onDrop to ever fire
    if (!draggedId || draggedId === targetId) return;
    setLiveOrderIds((prev) => {
      const current = prev ?? orderedProjects.map((p) => p.id);
      const from = current.indexOf(draggedId);
      const to = current.indexOf(targetId);
      if (from === -1 || to === -1 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
  }

  function handleProjectDragEnd() {
    if (liveOrderIds) {
      setOrderIds(liveOrderIds);
      persistProjectOrder(liveOrderIds);
    }
    setDraggedId(null);
    setLiveOrderIds(null);
  }

  // One row per project: its filtered (by folder search) sessions, capped for
  // display, plus an overflow count — computed once here instead of calling
  // sessionsFor() twice per project as the render used to. A project with a
  // search active and zero matching sessions is dropped from the array
  // entirely (not just rendered empty).
  const projectRows = orderedProjects
    .map((project) => {
      const filtered = sessionsFor(project.paths.map((p) => p.cwd)).filter(matchesSearch);
      return {
        project,
        sessions: filtered.slice(0, MAX_CARDS_PER_ROW),
        overflowCount: Math.max(0, filtered.length - MAX_CARDS_PER_ROW),
        matchCount: filtered.length,
      };
    })
    .filter((row) => !searchQuery || row.matchCount > 0);

  // Same idea for the Unassigned bucket, one row per folder - a folder with
  // zero matching sessions drops out; the whole bucket disappears below when
  // this ends up empty.
  const unassignedRows = unassigned.cwds
    .map((cwd) => ({
      cwd,
      sessions: (sessionsByCwd.get(cwd) || []).filter(matchesSearch).slice(0, MAX_CARDS_PER_ROW),
    }))
    .filter((row) => row.sessions.length > 0);

  const noSearchResults = searchQuery && projectRows.length === 0 && unassignedRows.length === 0;

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await api.projects.create({
        name: newName.trim(),
        cwds: newCwd.trim() ? [newCwd.trim()] : undefined,
      });
      setNewName("");
      setNewCwd("");
      setCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.createFailed"));
    }
  }

  function startCreateFromFolder(cwd: string) {
    setCreating(true);
    setNewName("");
    setNewCwd(cwd);
  }

  async function handleRename(id: string) {
    if (!editingName.trim()) return;
    try {
      await api.projects.rename(id, editingName.trim());
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.renameFailed"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.projects.remove(id);
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.deleteFailed"));
    }
  }

  async function handleAddFolder(id: string) {
    if (!newFolderCwd.trim()) return;
    try {
      await api.projects.addPath(id, newFolderCwd.trim());
      setAddingFolderFor(null);
      setNewFolderCwd("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.addFolderFailed"));
    }
  }

  async function handleRemoveFolder(projectId: string, pathId: number) {
    try {
      await api.projects.removePath(projectId, pathId);
      setConfirmRemovePath(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.removeFolderFailed"));
    }
  }

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);
  const isEmpty = !loading && projects.length === 0 && unassigned.cwds.length === 0;

  const Header = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <FolderKanban className="w-4.5 h-4.5 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-100 truncate">{t("title")}</h1>
            {wsConnected ? (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                {t("common:live")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {t("common:offline")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{t("subtitle")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
        </button>
        <button
          onClick={() => {
            setCreating(true);
            setNewName("");
            setNewCwd("");
          }}
          className="btn-primary flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> {t("newProject")}
        </button>
      </div>
    </div>
  );

  // Shared suggestion list for both the create form and each project's "add
  // folder" input - lets the user pick a known unassigned folder or type an
  // arbitrary path (e.g. to pre-register a repo before any session exists there).
  const unassignedDatalist = (
    <datalist id="unassigned-cwds">
      {unassigned.cwds.map((cwd) => (
        <option key={cwd} value={cwd} />
      ))}
    </datalist>
  );

  const SearchBox = (
    <div className="relative mb-6 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="input w-full pl-10 pr-9"
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          aria-label={t("clearSearch")}
          title={t("clearSearch")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  if (isEmpty) {
    return (
      <div className="animate-fade-in flex flex-col min-h-[60vh]">
        {Header}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={FolderKanban}
            title={t("noProjects")}
            description={t("noProjectsDesc")}
            action={
              <button onClick={() => setCreating(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> {t("newProject")}
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {Header}
      {unassignedDatalist}
      {SearchBox}

      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {creating && (
        <div className="card p-4 mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={t("namePlaceholder")}
              className="input flex-1 min-w-[180px]"
            />
            <input
              type="text"
              list="unassigned-cwds"
              value={newCwd}
              onChange={(e) => setNewCwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder={t("folderPlaceholder")}
              className="input flex-1 min-w-[220px] font-mono text-xs"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="btn-primary disabled:opacity-40"
            >
              <Check className="w-4 h-4" /> {t("create")}
            </button>
            <button onClick={() => setCreating(false)} className="btn-ghost">
              <X className="w-4 h-4" /> {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {noSearchResults && (
        <p className="text-sm text-gray-500 italic text-center py-8">
          {t("noSearchResults", { query: search.trim() })}
        </p>
      )}

      <div className="space-y-6">
        {loading && projects.length === 0
          ? Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={`sk-${i}`} />)
          : projectRows.map(({ project, sessions, overflowCount }) => (
              <ProjectSection
                key={project.id}
                project={project}
                sessions={sessions}
                overflowCount={overflowCount}
                t={t}
                editing={editingId === project.id}
                editingName={editingName}
                onStartEdit={() => {
                  setEditingId(project.id);
                  setEditingName(project.name);
                }}
                onEditingNameChange={setEditingName}
                onSaveEdit={() => handleRename(project.id)}
                onCancelEdit={() => setEditingId(null)}
                confirmingDelete={confirmDeleteId === project.id}
                onDeleteClick={() =>
                  confirmDeleteId === project.id
                    ? handleDelete(project.id)
                    : setConfirmDeleteId(project.id)
                }
                onCancelDelete={() => setConfirmDeleteId(null)}
                addingFolder={addingFolderFor === project.id}
                newFolderCwd={newFolderCwd}
                onStartAddFolder={() => {
                  setAddingFolderFor(project.id);
                  setNewFolderCwd("");
                }}
                onNewFolderCwdChange={setNewFolderCwd}
                onConfirmAddFolder={() => handleAddFolder(project.id)}
                onCancelAddFolder={() => setAddingFolderFor(null)}
                confirmRemovePathId={
                  confirmRemovePath?.startsWith(`${project.id}:`)
                    ? Number(confirmRemovePath.split(":")[1])
                    : null
                }
                onRemoveFolderClick={(pathId) =>
                  confirmRemovePath === `${project.id}:${pathId}`
                    ? handleRemoveFolder(project.id, pathId)
                    : setConfirmRemovePath(`${project.id}:${pathId}`)
                }
                onCancelRemoveFolder={() => setConfirmRemovePath(null)}
                dragging={draggedId === project.id}
                onDragStart={() => handleProjectDragStart(project.id)}
                onDragOverCard={(e) => handleProjectDragOver(e, project.id)}
                onDragEnd={handleProjectDragEnd}
              />
            ))}

        {unassignedRows.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-200 truncate">{t("unassigned")}</h2>
                <p className="text-xs text-gray-500 truncate">{t("unassignedDesc")}</p>
              </div>
              <span className="text-[11px] text-gray-500 flex-shrink-0">
                {t("sessionCount", { count: unassigned.session_count })}
              </span>
            </div>
            <div className="space-y-4">
              {unassignedRows.map(({ cwd, sessions: cwdSessions }) => (
                <div key={cwd}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 font-mono truncate">
                      <Folder className="w-3.5 h-3.5 flex-shrink-0" />
                      {cwd}
                    </span>
                    <button
                      onClick={() => startCreateFromFolder(cwd)}
                      className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 flex-shrink-0"
                    >
                      <FolderPlus className="w-3 h-3" /> {t("createFromFolder")}
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {cwdSessions.map((session) => (
                      <div key={session.id} className="w-72 flex-shrink-0">
                        <SessionCard session={session} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProjectSectionProps {
  project: Project;
  sessions: Session[];
  overflowCount: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
  editing: boolean;
  editingName: string;
  onStartEdit: () => void;
  onEditingNameChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  confirmingDelete: boolean;
  onDeleteClick: () => void;
  onCancelDelete: () => void;
  addingFolder: boolean;
  newFolderCwd: string;
  onStartAddFolder: () => void;
  onNewFolderCwdChange: (v: string) => void;
  onConfirmAddFolder: () => void;
  onCancelAddFolder: () => void;
  confirmRemovePathId: number | null;
  onRemoveFolderClick: (pathId: number) => void;
  onCancelRemoveFolder: () => void;
  /** True while this card is the one being dragged (dims it as feedback). */
  dragging: boolean;
  onDragStart: () => void;
  /** Fired while another dragged card is over this one — the parent live-
   *  reorders on this, so drop itself only needs to preventDefault. */
  onDragOverCard: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

function ProjectSection({
  project,
  sessions,
  overflowCount,
  t,
  editing,
  editingName,
  onStartEdit,
  onEditingNameChange,
  onSaveEdit,
  onCancelEdit,
  confirmingDelete,
  onDeleteClick,
  onCancelDelete,
  addingFolder,
  newFolderCwd,
  onStartAddFolder,
  onNewFolderCwdChange,
  onConfirmAddFolder,
  onCancelAddFolder,
  confirmRemovePathId,
  onRemoveFolderClick,
  onCancelRemoveFolder,
  dragging,
  onDragStart,
  onDragOverCard,
  onDragEnd,
}: ProjectSectionProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOverCard}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={`card p-4 cursor-grab active:cursor-grabbing transition-opacity ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2" draggable={false}>
              <input
                type="text"
                autoFocus
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit();
                  if (e.key === "Escape") onCancelEdit();
                }}
                className="input flex-1 min-w-[160px] max-w-xs"
              />
              <button
                onClick={onSaveEdit}
                className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={onCancelEdit}
                className="p-1.5 rounded-md text-gray-400 hover:bg-surface-3"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical
                className="w-3.5 h-3.5 text-gray-600 flex-shrink-0"
                aria-hidden="true"
              />
              <h2 className="text-sm font-semibold text-gray-100 truncate">{project.name}</h2>
              <button
                onClick={onStartEdit}
                title={t("rename")}
                draggable={false}
                className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* draggable={false}: folder chips (with their own remove buttons)
              and the add-folder control shouldn't double as a drag handle. */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2" draggable={false}>
            {project.paths.length === 0 && (
              <span className="text-[11px] text-gray-500 italic">{t("noFolders")}</span>
            )}
            {project.paths.map((p) => (
              <span
                key={p.id}
                className="group flex items-center gap-1 text-[11px] font-mono text-gray-400 bg-surface-2 border border-border rounded-full pl-2 pr-1 py-0.5"
              >
                <Folder className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[16rem]">{p.cwd}</span>
                <button
                  onClick={() => onRemoveFolderClick(p.id)}
                  onBlur={onCancelRemoveFolder}
                  title={t("removeFolder")}
                  className={`ml-0.5 p-0.5 rounded-full flex-shrink-0 ${
                    confirmRemovePathId === p.id
                      ? "bg-red-500/20 text-red-400"
                      : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {addingFolder ? (
              <span className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  list="unassigned-cwds"
                  value={newFolderCwd}
                  onChange={(e) => onNewFolderCwdChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onConfirmAddFolder();
                    if (e.key === "Escape") onCancelAddFolder();
                  }}
                  placeholder={t("folderPlaceholder")}
                  className="input text-xs py-1 px-2 font-mono w-56"
                />
                <button
                  onClick={onConfirmAddFolder}
                  className="p-1 rounded-md text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onCancelAddFolder}
                  className="p-1 rounded-md text-gray-400 hover:bg-surface-3"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ) : (
              <button
                onClick={onStartAddFolder}
                className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 rounded-full border border-dashed border-accent/30 px-2 py-0.5"
              >
                <Plus className="w-3 h-3" /> {t("addFolder")}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs text-gray-300">
              <Bot className="w-3.5 h-3.5 text-gray-500" />
              {t("sessionCount", { count: project.session_count })}
            </div>
            {project.last_activity && (
              <p className="text-[11px] text-gray-500">{timeAgo(project.last_activity)}</p>
            )}
          </div>
          <button
            onClick={onDeleteClick}
            onBlur={onCancelDelete}
            draggable={false}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
              confirmingDelete
                ? "bg-red-500/20 text-red-400"
                : "text-gray-500 hover:text-red-400 hover:bg-red-500/10"
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" /> {confirmingDelete ? t("confirmDelete") : t("delete")}
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="text-xs text-gray-500 italic py-2">{t("noSessions")}</p>
      ) : (
        // draggable={false}: opts this subtree out of the card's own drag
        // region (per the HTML5 DnD spec) so clicking through to a session
        // card navigates normally instead of the whole project card
        // hijacking the gesture into a reorder-drag.
        <div className="flex gap-3 overflow-x-auto pb-2" draggable={false}>
          {sessions.map((session) => (
            <div key={session.id} className="w-72 flex-shrink-0">
              <SessionCard session={session} />
            </div>
          ))}
          {overflowCount > 0 && (
            <div className="w-40 flex-shrink-0 flex items-center justify-center text-xs text-gray-500 italic">
              {t("moreSessions", { count: overflowCount })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
