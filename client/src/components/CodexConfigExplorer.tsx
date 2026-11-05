/**
 * @file Codex configuration workspace with a parity navigation model, live
 * overview metrics, resilient copyable profile commands and artifact paths,
 * redacted previews, and backup-backed edit/delete actions for Codex's
 * user-maintained profiles, hooks, rules, skills, and instruction files. The
 * base config stays explicitly edit-only.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/CodexConfigExplorer.tsx
 * **Area:** client component
 * **Responsibility:**
 * Codex configuration workspace with a parity navigation model, live overview metrics, resilient
 * copyable profile commands and artifact paths, redacted previews, and backup-backed edit/delete
 * actions for Codex's user-maintained profiles, hooks, rules, skills, and instruction files. The
 * base config stays explicitly edit-only.
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
 * - `../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `CodexConfigExplorer` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CODEX_SUMMARY_TONES` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `CODEX_TONES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `CodexConfigExplorer` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `CodexDefaultStat` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `CodexRootCard` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `CodexSummaryStat` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `CodexTab` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `CodexTabs` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `CodexTone` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `copyText` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `CreateProfileModal` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `DeleteFileModal` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `DeleteTarget` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `EditorModal` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `EmptyState` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FileActions` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FileRow` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PreviewModal` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PreviewState` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ProfileLaunchCommand` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `ProfileSetting` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `Rows` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `StatusNotice` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SummaryTab` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `Tab` (type) — top-level declaration that helps orient code review and focused test selection.
 * - `TABS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `ccConfig` — visible copy resolves through this namespace; key and interpolation parity applies
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/CodexConfigExplorer.tsx`
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
 * **Path:** `client/src/components/CodexConfigExplorer.tsx`
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
 * - `../lib/api`
 * - `../lib/eventBus`
 *
 * ## Public surface
 * - `CodexConfigExplorer` — exported API; see TSDoc on the symbol for behavior.
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
 * **CodexConfigExplorer**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  BookOpen,
  Box,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  FolderTree,
  KeyRound,
  Pencil,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import type { CodexConfigEditableFile, CodexConfigFile, CodexConfigOverview } from "../lib/api";
import { eventBus } from "../lib/eventBus";

/**
 * Tabs of the Codex workspace: an overview, the redacted `config.toml`, and one tab per section of
 * {@link CodexConfigOverview}.
 */
type Tab =
  | "overview"
  | "settings"
  | "models"
  | "profiles"
  | "mcp"
  | "projects"
  | "skills"
  | "hooks"
  | "rules"
  | "plugins"
  | "instructions";

/** Tabs that have an overview summary tile with a count. */
type SummaryTab = Exclude<Tab, "overview" | "settings">;

/** Tab bar entries in display order, each with its icon. */
const TABS: Array<{ id: Tab; icon: typeof Box }> = [
  { id: "overview", icon: Box },
  { id: "settings", icon: FileText },
  { id: "models", icon: Code2 },
  { id: "profiles", icon: KeyRound },
  { id: "mcp", icon: Server },
  { id: "projects", icon: BookOpen },
  { id: "skills", icon: Wrench },
  { id: "hooks", icon: ShieldCheck },
  { id: "rules", icon: FileText },
  { id: "plugins", icon: PlugZap },
  { id: "instructions", icon: BookOpen },
];

/** File open in the read-only preview modal, and which actions it allows. */
interface PreviewState {
  /** Redacted file preview. */
  file: CodexConfigFile;
  /** Whether the file is on the server's edit allowlist, which shows the Edit button. */
  editable: boolean;
  /**
   * Whether the Delete button is offered for this file. `config.toml` itself is never deletable.
   */
  deletable: boolean;
}

/** File awaiting delete confirmation. */
interface DeleteTarget {
  /** Absolute path of the file to delete. */
  path: string;
  /** Name shown in the confirmation dialog. */
  label: string;
}

/**
 * Codex half of Agent Config. Loads the local Codex home through `api.codexConfig.overview()` and
 * reloads whenever the server broadcasts `codex_config_changed`. Shows defaults, models, profiles,
 * MCP servers, projects, skills, hooks, rules, plugins, and instruction files in tabs. Files open
 * in a redacted read-only preview. Allowlisted files can be edited in full (fetched unredacted only
 * for editing) or deleted, always with a server-side backup first, and new `--profile` overlays can
 * be created. Status and errors show as a dismissible notice.
 */
export function CodexConfigExplorer() {
  const { t } = useTranslation("ccConfig");
  const [data, setData] = useState<CodexConfigOverview | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewer, setViewer] = useState<PreviewState | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [editor, setEditor] = useState<CodexConfigEditableFile | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [openingEditor, setOpeningEditor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileCreatorOpen, setProfileCreatorOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileCreateError, setProfileCreateError] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** Reload the Codex overview, showing a loading state and replacing any previous error. */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.codexConfig.overview());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("codex.fileError", "Unable to read Codex configuration")
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(
    () =>
      eventBus.subscribe((message) => {
        if (message.type === "codex_config_changed") void refresh();
      }),
    [refresh]
  );

  /** Open a file in the redacted preview, remembering whether it may be edited or deleted. */
  const openFile = useCallback(async (file: string, editable = false, deletable = false) => {
    setViewer(null);
    setViewerError(null);
    try {
      setViewer({ file: await api.codexConfig.file(file), editable, deletable });
    } catch (err) {
      setViewerError(err instanceof Error ? err.message : "Unable to open file");
    }
  }, []);

  /**
   * Open the editor for an allowlisted file, fetching its full unredacted contents. While loading,
   * the file's Edit button shows a spinner.
   */
  const openEditor = useCallback(async (file: string) => {
    setEditor(null);
    setEditorError(null);
    setOpeningEditor(file);
    try {
      setEditor(await api.codexConfig.editFile(file));
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Unable to open file for editing");
    } finally {
      setOpeningEditor(null);
    }
  }, []);

  /**
   * Save the editor contents. On success, close the editor, show a notice, and reload the overview.
   */
  const saveEditor = useCallback(async () => {
    if (!editor || saving) return;
    setSaving(true);
    setEditorError(null);
    try {
      const result = await api.codexConfig.writeFile({ path: editor.path, content: editor.text });
      setEditor(null);
      setNotice(
        result.backupPath
          ? t("codex.savedBackup", "Saved. A timestamped backup was created before the update.")
          : t("codex.saved", "Saved.")
      );
      await refresh();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Unable to save file");
    } finally {
      setSaving(false);
    }
  }, [editor, refresh, saving, t]);

  /**
   * Create a `--profile` overlay after checking the name locally (letters, numbers, hyphens,
   * underscores), then show a notice and reload the overview.
   */
  const createProfile = useCallback(async () => {
    const name = profileName.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      setProfileCreateError(
        t(
          "codex.profileNameError",
          "Use only letters, numbers, hyphens, and underscores for the profile name."
        )
      );
      return;
    }
    setCreatingProfile(true);
    setProfileCreateError(null);
    try {
      const profile = await api.codexConfig.createProfile({ name });
      setProfileCreatorOpen(false);
      setProfileName("");
      setEditor(profile);
      setNotice(
        t(
          "codex.profileCreated",
          "{{name}} profile created. Configure its overrides before using it.",
          { name }
        )
      );
      await refresh();
    } catch (err) {
      setProfileCreateError(err instanceof Error ? err.message : "Unable to create profile");
    } finally {
      setCreatingProfile(false);
    }
  }, [profileName, refresh, t]);

  /** Ask for confirmation before deleting a file. */
  const requestDelete = useCallback((path: string, label: string) => {
    setDeleteError(null);
    setDeleteTarget({ path, label });
  }, []);

  /** Delete the confirmed file, then show a notice and reload the overview. */
  const deleteFile = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await api.codexConfig.deleteFile({ path: deleteTarget.path });
      setViewer((current) => (current?.file.path === deleteTarget.path ? null : current));
      setDeleteTarget(null);
      setNotice(
        result.deletedDirectory
          ? t(
              "codex.deletedDirectoryBackup",
              "Deleted the skill and created a timestamped backup of its directory."
            )
          : t("codex.deletedBackup", "Deleted. A timestamped backup was created first.")
      );
      await refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unable to delete file");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting, refresh, t]);

  const counts = data?.counts || {};
  /** Summary tiles for the overview, paired with their counts. */
  const overviewCards = useMemo<Array<[SummaryTab, number | undefined]>>(
    () => [
      ["models", counts.models],
      ["profiles", counts.profiles],
      ["mcp", counts.mcp],
      ["projects", counts.projects],
      ["skills", counts.skills],
      ["hooks", counts.hooks],
      ["rules", counts.rules],
      ["plugins", counts.plugins],
      ["instructions", counts.instructions],
    ],
    [counts]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-100">
            {t("codex.title", "Codex configuration")}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {t("codex.description", "Local settings, models, tools, and instructions.")}
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-surface-3 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? t("refreshing", "Refreshing…") : t("refresh", "Refresh")}
        </button>
      </div>

      {error && <StatusNotice kind="error" message={error} onDismiss={() => setError(null)} />}
      {notice && <StatusNotice kind="success" message={notice} onDismiss={() => setNotice(null)} />}

      <CodexTabs current={tab} onSelect={setTab} counts={counts} t={t} />
      <div className="rounded-xl border border-border bg-surface-1">
        <div className="p-4">
          {!data && loading ? (
            <p className="text-sm text-gray-500">{t("loading", "Loading…")}</p>
          ) : (
            data && (
              <CodexTab
                data={data}
                tab={tab}
                cards={overviewCards}
                onTab={setTab}
                onOpenFile={openFile}
                onEditFile={openEditor}
                onDeleteFile={requestDelete}
                openingEditor={openingEditor}
                onCreateProfile={() => {
                  setProfileName("");
                  setProfileCreateError(null);
                  setProfileCreatorOpen(true);
                }}
                t={t}
              />
            )
          )}
        </div>
      </div>

      {(viewer || viewerError) && (
        <PreviewModal
          state={viewer}
          error={viewerError}
          onClose={() => {
            setViewer(null);
            setViewerError(null);
          }}
          onEdit={
            viewer?.editable
              ? () => {
                  setViewer(null);
                  void openEditor(viewer.file.path);
                }
              : undefined
          }
          onDelete={
            viewer?.deletable
              ? () => {
                  setViewer(null);
                  requestDelete(viewer.file.path, viewer.file.path);
                }
              : undefined
          }
          t={t}
        />
      )}
      {(editor || editorError) && (
        <EditorModal
          state={editor}
          error={editorError}
          saving={saving}
          onChange={(text) => setEditor((current) => (current ? { ...current, text } : current))}
          onClose={() => {
            if (saving) return;
            setEditor(null);
            setEditorError(null);
          }}
          onSave={() => void saveEditor()}
          t={t}
        />
      )}
      {profileCreatorOpen && (
        <CreateProfileModal
          name={profileName}
          error={profileCreateError}
          creating={creatingProfile}
          onChange={(value) => {
            setProfileName(value);
            setProfileCreateError(null);
          }}
          onClose={() => {
            if (creatingProfile) return;
            setProfileCreatorOpen(false);
            setProfileCreateError(null);
          }}
          onCreate={() => void createProfile()}
          t={t}
        />
      )}
      {deleteTarget && (
        <DeleteFileModal
          target={deleteTarget}
          error={deleteError}
          deleting={deleting}
          onClose={() => {
            if (deleting) return;
            setDeleteTarget(null);
            setDeleteError(null);
          }}
          onDelete={() => void deleteFile()}
          t={t}
        />
      )}
    </section>
  );
}

/**
 * Horizontally scrollable tab bar with per-section count badges and scroll arrows that appear only
 * when tabs overflow in that direction.
 */
function CodexTabs({
  current,
  onSelect,
  counts,
  t,
}: {
  /** Selected tab. */
  current: Tab;
  /** Called with the tab the user picks. */
  onSelect: (tab: Tab) => void;
  /** Item count per section, shown as badges. */
  counts: Record<string, number>;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /** Show the scroll arrows only when tabs are hidden on that side. */
  const updateAffordances = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 1);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateAffordances();
    const element = scrollRef.current;
    if (!element) return;
    element.addEventListener("scroll", updateAffordances, { passive: true });
    const observer = new ResizeObserver(updateAffordances);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", updateAffordances);
      observer.disconnect();
    };
  }, [updateAffordances]);

  useEffect(() => {
    const element = scrollRef.current;
    const active = element?.querySelector<HTMLElement>('[data-tab-active="true"]');
    if (!element || !active) return;
    const bounds = element.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    if (activeBounds.left < bounds.left + 8) {
      element.scrollBy({ left: activeBounds.left - bounds.left - 16, behavior: "smooth" });
    } else if (activeBounds.right > bounds.right - 8) {
      element.scrollBy({ left: activeBounds.right - bounds.right + 16, behavior: "smooth" });
    }
  }, [current]);

  /** Scroll the tab bar by most of its visible width, at least 200px. */
  const move = (direction: 1 | -1) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(200, element.clientWidth * 0.6),
      behavior: "smooth",
    });
  };

  return (
    <div className="relative rounded-xl border border-border bg-surface-1">
      <div
        className={`pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12 rounded-l-xl bg-gradient-to-r from-surface-1 to-transparent transition-opacity ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
      />
      {canScrollLeft && (
        <button
          onClick={() => move(-1)}
          aria-label={t("codex.scrollLeft", "Scroll configuration tabs left")}
          className="absolute left-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-surface-2 text-gray-300 hover:bg-surface-3 hover:text-gray-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto scroll-smooth p-1 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {TABS.map(({ id, icon: Icon }) => {
          const active = current === id;
          const count = id === "overview" || id === "settings" ? null : counts[id];
          return (
            <button
              key={id}
              data-tab-active={active ? "true" : undefined}
              onClick={() => onSelect(id)}
              className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-accent/30 bg-accent/15 text-accent"
                  : "border-transparent text-gray-400 hover:bg-surface-3 hover:text-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t(`codex.tabs.${id}`, id)}</span>
              {count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? "bg-accent/20 text-accent" : "bg-surface-3 text-gray-400"
                  }`}
                >
                  {count || 0}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        className={`pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-12 rounded-r-xl bg-gradient-to-l from-surface-1 to-transparent transition-opacity ${canScrollRight ? "opacity-100" : "opacity-0"}`}
      />
      {canScrollRight && (
        <button
          onClick={() => move(1)}
          aria-label={t("codex.scrollRight", "Scroll configuration tabs right")}
          className="absolute right-1 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-border bg-surface-2 text-gray-300 hover:bg-surface-3 hover:text-gray-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Body of the selected Codex tab. The overview shows the Codex home, the default model, effort, and
 * personality, and clickable summary tiles; each section tab lists its items with the actions its
 * files allow (view, edit, delete) and, on the profiles tab, a button to create a profile.
 */
function CodexTab({
  data,
  tab,
  cards,
  onTab,
  onOpenFile,
  onEditFile,
  onDeleteFile,
  openingEditor,
  onCreateProfile,
  t,
}: {
  /** Codex overview data. */
  data: CodexConfigOverview;
  /** Tab to render. */
  tab: Tab;
  /** Overview summary tiles with their counts. */
  cards: Array<[SummaryTab, number | undefined]>;
  /** Switches tab, used by the overview tiles. */
  onTab: (tab: Tab) => void;
  /** Opens a file in the preview, with its allowed actions. */
  onOpenFile: (path: string, editable?: boolean, deletable?: boolean) => void;
  /** Opens a file in the editor. */
  onEditFile: (path: string) => void;
  /** Asks to delete a file, given its path and display label. */
  onDeleteFile: (path: string, label: string) => void;
  /** Path of the file whose editor is loading, or null. */
  openingEditor: string | null;
  /** Opens the create-profile dialog. */
  onCreateProfile: () => void;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  if (tab === "overview") {
    return (
      <div className="space-y-5">
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {t("codex.overviewTitle", "Configuration overview")}
          </h2>
          <div className="grid gap-2 xl:grid-cols-5">
            <CodexRootCard home={data.home} t={t} />
            <CodexDefaultStat
              icon={Code2}
              tone="violet"
              label={t("codex.defaultModel", "Model")}
              value={data.defaults.model}
            />
            <CodexDefaultStat
              icon={Wrench}
              tone="amber"
              label={t("codex.defaultEffort", "Reasoning")}
              value={data.defaults.reasoningEffort}
            />
            <CodexDefaultStat
              icon={KeyRound}
              tone="teal"
              label={t("codex.personality", "Personality")}
              value={data.defaults.personality}
            />
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {t("overview.summary", "Quick summary")}
          </h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
            {cards.map(([id, count]) => {
              const Icon = TABS.find((entry) => entry.id === id)?.icon || Box;
              return (
                <CodexSummaryStat
                  key={id}
                  icon={Icon}
                  tone={CODEX_SUMMARY_TONES[id]}
                  label={t(`codex.tabs.${id}`, id)}
                  value={count || 0}
                  onClick={() => onTab(id)}
                />
              );
            })}
          </div>
        </section>
      </div>
    );
  }
  if (tab === "settings") {
    return (
      <FileRow
        label="config.toml"
        path={data.config.path}
        preview={data.config.text.slice(0, 700)}
        editable
        onOpenFile={onOpenFile}
        onEditFile={onEditFile}
        onDeleteFile={onDeleteFile}
        openingEditor={openingEditor === data.config.path}
        t={t}
      />
    );
  }
  if (tab === "models") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-gray-100">
              {t("codex.modelsTitle", "Available models")}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {t(
                "codex.modelsDescription",
                "Your local Codex catalog plus models configured in the base config and profiles."
              )}
            </p>
          </div>
          {data.models.fetchedAt && (
            <span className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[10px] text-gray-400">
              {t("codex.modelCatalogUpdated", "Catalog updated {{time}}", {
                time: new Date(data.models.fetchedAt).toLocaleString(),
              })}
            </span>
          )}
        </div>
        {!data.models.items.length ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-gray-500">
            {t(
              "codex.modelCatalogUnavailable",
              "No readable local model catalog was found. Configure a model in Settings or a profile and it will appear here."
            )}
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {data.models.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-gray-100">{item.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
                      {item.description || item.id}
                    </p>
                  </div>
                  {!item.visible && (
                    <span className="flex-shrink-0 text-[10px] text-gray-500">
                      {t("codex.hidden", "Hidden")}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.sources.map((source) => (
                    <span
                      key={source}
                      className="rounded-md border border-border bg-surface-1 px-1.5 py-0.5 text-[10px] text-gray-400"
                    >
                      {source === "account"
                        ? t("codex.modelSourceAccount", "Signed-in catalog")
                        : source === "custom"
                          ? t("codex.modelSourceCustom", "Custom catalog")
                          : t("codex.modelSourceConfigured", "Configured")}
                    </span>
                  ))}
                  {item.baseDefault && (
                    <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-200">
                      {t("codex.modelDefault", "Base default")}
                    </span>
                  )}
                  {item.profiles.length > 0 && (
                    <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                      {t("codex.modelProfiles", "Profiles: {{names}}", {
                        names: item.profiles.join(", "),
                      })}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[11px] text-gray-400">
                  {item.defaultEffort
                    ? t("codex.modelDefaultEffort", "Default reasoning: {{effort}}", {
                        effort: item.defaultEffort,
                      })
                    : item.efforts.join(" · ") || "—"}
                  {item.contextWindow
                    ? ` · ${t("codex.modelContext", "{{tokens}}K context", {
                        tokens: (item.contextWindow / 1000).toLocaleString(),
                      })}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (tab === "profiles") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-gray-100">
              {t("codex.profilesTitle", "Profiles")}
            </p>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-gray-500">
              {t(
                "codex.profilesDescription",
                "Each profile overlays your base configuration when Codex starts with --profile."
              )}
            </p>
          </div>
          <button
            onClick={onCreateProfile}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("codex.addProfile", "Add profile")}
          </button>
        </div>
        {!data.profiles.length ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-gray-500">
            {t(
              "codex.profilesEmpty",
              "No profiles yet. Create one for a repeatable set of Codex overrides."
            )}
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {data.profiles.map((item) => (
              <div key={item.path} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-gray-100">
                      {item.name}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {item.size.toLocaleString()} bytes
                    </p>
                  </div>
                  <FileActions
                    path={item.path}
                    editable
                    deletable
                    openingEditor={openingEditor === item.path}
                    onView={() => onOpenFile(item.path, true, true)}
                    onEdit={() => onEditFile(item.path)}
                    onDelete={() => onDeleteFile(item.path, item.name)}
                    t={t}
                  />
                </div>
                <ProfileLaunchCommand name={item.name} t={t} />
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                  <ProfileSetting label={t("codex.profileModel", "Model")} value={item.model} />
                  <ProfileSetting
                    label={t("codex.profileReasoning", "Reasoning")}
                    value={item.reasoningEffort}
                  />
                  <ProfileSetting
                    label={t("codex.profileApproval", "Approvals")}
                    value={item.approvalPolicy}
                  />
                  <ProfileSetting
                    label={t("codex.profileSandbox", "Sandbox")}
                    value={item.sandboxMode}
                  />
                </div>
                {!item.model &&
                  !item.reasoningEffort &&
                  !item.approvalPolicy &&
                  !item.sandboxMode &&
                  !item.serviceTier &&
                  !item.modelCatalog && (
                    <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                      {t(
                        "codex.profileInherits",
                        "Inherits all base settings until you add overrides."
                      )}
                    </p>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (tab === "mcp") {
    if (!data.mcp.length) return <EmptyState t={t} />;
    return (
      <div className="grid gap-2 md:grid-cols-2">
        {data.mcp.map((item) => (
          <div key={item.name} className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-3">
              <b className="font-mono text-sm text-gray-100">{item.name}</b>
              <span className={item.enabled ? "text-xs text-emerald-400" : "text-xs text-gray-500"}>
                {item.enabled ? t("codex.enabled", "Enabled") : t("codex.disabled", "Disabled")}
              </span>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-gray-500">
              {item.url || item.command || "—"}
            </p>
            {item.envNames.length > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">
                {t("codex.envNames", "Environment names")}: {item.envNames.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (tab === "projects") {
    if (!data.projects.length) return <EmptyState t={t} />;
    return (
      <div className="space-y-2">
        {data.projects.map((item) => (
          <div key={item.path} className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
            <p className="text-sm font-medium text-gray-100">{item.name}</p>
            <p className="mt-1 break-all font-mono text-[11px] text-gray-500">{item.path}</p>
          </div>
        ))}
      </div>
    );
  }
  if (tab === "skills") {
    return (
      <Rows
        rows={data.skills.map((item) => ({
          label: item.name,
          path: item.file,
          preview: item.preview,
        }))}
        editable
        deletable
        onOpenFile={onOpenFile}
        onEditFile={onEditFile}
        onDeleteFile={onDeleteFile}
        openingEditor={openingEditor}
        t={t}
      />
    );
  }
  if (tab === "hooks") {
    return (
      <FileRow
        label="hooks.json"
        path={data.hooks.file}
        preview={data.hooks.items.map((item) => `${item.event} · ${item.groups}`).join("\n")}
        editable
        deletable={data.hooks.exists}
        onOpenFile={onOpenFile}
        onEditFile={onEditFile}
        onDeleteFile={onDeleteFile}
        openingEditor={openingEditor === data.hooks.file}
        t={t}
      />
    );
  }
  if (tab === "rules") {
    return (
      <Rows
        rows={data.rules.map((item) => ({
          label: item.name,
          path: item.file,
          preview: item.preview,
        }))}
        editable
        deletable
        onOpenFile={onOpenFile}
        onEditFile={onEditFile}
        onDeleteFile={onDeleteFile}
        openingEditor={openingEditor}
        t={t}
      />
    );
  }
  if (tab === "plugins") {
    if (!data.plugins.length) return <EmptyState t={t} />;
    return (
      <div className="grid gap-2 md:grid-cols-2">
        {data.plugins.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-100">{item.displayName}</p>
                <p className="mt-1 text-[11px] text-gray-500">{item.marketplaceLabel}</p>
              </div>
              <span
                className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                  item.enabled
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "border-gray-500/25 bg-gray-500/10 text-gray-400"
                }`}
              >
                {item.enabled ? t("codex.enabled", "Enabled") : t("codex.disabled", "Disabled")}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
              {item.description || t("codex.noDescription", "No description provided.")}
            </p>
            {item.version && (
              <p className="mt-3 font-mono text-[11px] text-gray-500">v{item.version}</p>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <Rows
      rows={data.instructions.map((item) => ({
        label: item.name,
        path: item.path,
        preview: item.preview,
      }))}
      editable
      deletable
      onOpenFile={onOpenFile}
      onEditFile={onEditFile}
      onDeleteFile={onDeleteFile}
      openingEditor={openingEditor}
      t={t}
    />
  );
}

/** Accent tones for the Codex overview tiles. */
type CodexTone =
  | "violet"
  | "sky"
  | "amber"
  | "teal"
  | "fuchsia"
  | "orange"
  | "rose"
  | "emerald"
  | "indigo";

/**
 * Tailwind classes for each {@link CodexTone}: icon background and color, left accent bar, and
 * hover border.
 */
const CODEX_TONES: Record<
  CodexTone,
  { iconBg: string; iconText: string; bar: string; hoverBorder: string }
> = {
  violet: {
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-300",
    bar: "bg-violet-500/40",
    hoverBorder: "hover:border-violet-500/35",
  },
  sky: {
    iconBg: "bg-sky-500/10",
    iconText: "text-sky-300",
    bar: "bg-sky-500/40",
    hoverBorder: "hover:border-sky-500/35",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-300",
    bar: "bg-amber-500/40",
    hoverBorder: "hover:border-amber-500/35",
  },
  teal: {
    iconBg: "bg-teal-500/10",
    iconText: "text-teal-300",
    bar: "bg-teal-500/40",
    hoverBorder: "hover:border-teal-500/35",
  },
  fuchsia: {
    iconBg: "bg-fuchsia-500/10",
    iconText: "text-fuchsia-300",
    bar: "bg-fuchsia-500/40",
    hoverBorder: "hover:border-fuchsia-500/35",
  },
  orange: {
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-300",
    bar: "bg-orange-500/40",
    hoverBorder: "hover:border-orange-500/35",
  },
  rose: {
    iconBg: "bg-rose-500/10",
    iconText: "text-rose-300",
    bar: "bg-rose-500/40",
    hoverBorder: "hover:border-rose-500/35",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-300",
    bar: "bg-emerald-500/40",
    hoverBorder: "hover:border-emerald-500/35",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-300",
    bar: "bg-indigo-500/40",
    hoverBorder: "hover:border-indigo-500/35",
  },
};

/** Tone of each section's summary tile, so a section keeps the same color everywhere it appears. */
const CODEX_SUMMARY_TONES: Record<SummaryTab, CodexTone> = {
  models: "violet",
  profiles: "amber",
  mcp: "indigo",
  projects: "sky",
  skills: "fuchsia",
  hooks: "orange",
  rules: "rose",
  plugins: "emerald",
  instructions: "teal",
};

/** Overview card showing the resolved Codex home directory. */
function CodexRootCard({ home, t }: { home: string; t: TFunction }) {
  const tone = CODEX_TONES.sky;
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface-2 xl:col-span-2">
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${tone.bar}`} aria-hidden />
      <div className="flex min-h-[84px] items-center gap-3 px-4 py-3 pl-5">
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${tone.iconBg}`}
        >
          <FolderTree className={`h-4 w-4 ${tone.iconText}`} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {t("codex.home", "Codex home")}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-gray-100" title={home}>
            {home}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Overview tile for one `config.toml` default (model, reasoning effort, or personality), showing a
 * dash when it is unset.
 */
function CodexDefaultStat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  /** Icon shown in the tile. */
  icon: typeof Box;
  /** Color tone. */
  tone: CodexTone;
  /** Setting name. */
  label: string;
  /** Configured value, or null when unset. */
  value: string | null;
}) {
  const palette = CODEX_TONES[tone];
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${palette.bar}`} aria-hidden />
      <div className="min-h-[84px] px-3 py-2.5 pl-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${palette.iconBg}`}
          >
            <Icon className={`h-3.5 w-3.5 ${palette.iconText}`} />
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </span>
        </div>
        <p
          className="mt-2 truncate font-mono text-sm font-semibold text-gray-100"
          title={value || "—"}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

/** Clickable overview tile with a section's item count; clicking opens that section's tab. */
function CodexSummaryStat({
  icon: Icon,
  tone,
  label,
  value,
  onClick,
}: {
  /** Icon shown in the tile. */
  icon: typeof Box;
  /** Color tone. */
  tone: CodexTone;
  /** Section name. */
  label: string;
  /** Number of items in the section. */
  value: number;
  /** Opens the section's tab. */
  onClick: () => void;
}) {
  const palette = CODEX_TONES[tone];
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-lg border border-border bg-surface-2 text-left transition-colors hover:bg-surface-3 ${palette.hoverBorder}`}
    >
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${palette.bar}`} aria-hidden />
      <div className="px-3 py-2.5 pl-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${palette.iconBg}`}
          >
            <Icon className={`h-3.5 w-3.5 ${palette.iconText}`} />
          </span>
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </span>
        </div>
        <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-100">{value}</p>
      </div>
    </button>
  );
}

/**
 * List of file-backed items (skills, rules, instructions) as {@link FileRow}s, or an empty state.
 */
function Rows({
  rows,
  editable = false,
  deletable = false,
  onOpenFile,
  onEditFile,
  onDeleteFile,
  openingEditor,
  t,
}: {
  /** Items to list, each with a label, path, and preview. */
  rows: Array<{ label: string; path: string; preview: string }>;
  /** Whether these files may be edited. */
  editable?: boolean;
  /** Whether these files may be deleted. */
  deletable?: boolean;
  /** Opens a file in the preview. */
  onOpenFile: (path: string, editable?: boolean, deletable?: boolean) => void;
  /** Opens a file in the editor. */
  onEditFile: (path: string) => void;
  /** Asks to delete a file. */
  onDeleteFile: (path: string, label: string) => void;
  /** Path of the file whose editor is loading, or null. */
  openingEditor: string | null;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  if (!rows.length) return <EmptyState t={t} />;
  return (
    <div className="space-y-2">
      {rows.map((item) => (
        <FileRow
          key={item.path}
          {...item}
          editable={editable}
          deletable={deletable}
          onOpenFile={onOpenFile}
          onEditFile={onEditFile}
          onDeleteFile={onDeleteFile}
          openingEditor={openingEditor === item.path}
          t={t}
        />
      ))}
    </div>
  );
}

/** One file-backed item: label, path, a short preview, and its file actions. */
function FileRow({
  label,
  path,
  preview,
  editable = false,
  deletable = false,
  onOpenFile,
  onEditFile,
  onDeleteFile,
  openingEditor,
  t,
}: {
  /** Display name. */
  label: string;
  /** Absolute file path. */
  path: string;
  /** Short excerpt of the file. */
  preview: string;
  /** Whether the file may be edited. */
  editable?: boolean;
  /** Whether the file may be deleted. */
  deletable?: boolean;
  /** Opens the file in the preview. */
  onOpenFile: (path: string, editable?: boolean, deletable?: boolean) => void;
  /** Opens the file in the editor. */
  onEditFile: (path: string) => void;
  /** Asks to delete the file. */
  onDeleteFile: (path: string, label: string) => void;
  /** Whether this file's editor is loading. */
  openingEditor: boolean;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => onOpenFile(path, editable, deletable)}
          className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <p className="truncate text-sm font-medium text-gray-100">{label}</p>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-500">
            {preview || path}
          </p>
        </button>
        <FileActions
          path={path}
          editable={editable}
          deletable={deletable}
          openingEditor={openingEditor}
          onView={() => onOpenFile(path, editable, deletable)}
          onEdit={() => onEditFile(path)}
          onDelete={() => onDeleteFile(path, label)}
          t={t}
        />
      </div>
    </div>
  );
}

/**
 * View, edit, and delete buttons for a file. Edit and delete only appear when allowed, and Edit
 * shows a spinner while that file is being opened.
 */
function FileActions({
  path,
  editable,
  deletable,
  openingEditor,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  /** File the actions apply to. */
  path: string;
  /** Show the Edit button. */
  editable: boolean;
  /** Show the Delete button. */
  deletable: boolean;
  /** Show a spinner on Edit while the editor loads. */
  openingEditor: boolean;
  /** Opens the preview. */
  onView: () => void;
  /** Opens the editor. */
  onEdit: () => void;
  /** Asks to delete the file. */
  onDelete: () => void;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  const [copied, setCopied] = useState(false);

  /** Copy the path and show a check mark for 1.5 seconds. */
  const copyPath = async () => {
    if (await copyText(path)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex w-32 flex-shrink-0 flex-col gap-1.5 sm:w-36">
      <button
        onClick={onView}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-surface-3 hover:text-gray-100"
      >
        <ExternalLink className="h-3 w-3" />
        {t("common.viewSource", "View source")}
      </button>
      <button
        type="button"
        onClick={() => void copyPath()}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-surface-3 hover:text-gray-100"
        title={path}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
        <span aria-live="polite">
          {copied ? t("common.copied", "Copied") : t("common.copyPath", "Copy path")}
        </span>
      </button>
      {editable && (
        <button
          onClick={onEdit}
          disabled={openingEditor}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-2 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-surface-3 hover:text-gray-100 disabled:opacity-60"
        >
          <Pencil className="h-3 w-3" />
          {openingEditor ? t("loading", "Loading…") : t("codex.editFile", "Edit")}
        </button>
      )}
      {deletable && (
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/15"
        >
          <Trash2 className="h-3 w-3" />
          {t("codex.deleteFile", "Delete")}
        </button>
      )}
    </div>
  );
}

/** Placeholder for a section with nothing configured. */
function EmptyState({ t }: { t: TFunction }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-gray-500">
      {t("codex.empty", "Nothing configured here yet.")}
    </p>
  );
}

/**
 * One label/value pair in a profile card, showing a dash when the profile leaves the setting unset.
 */
function ProfileSetting({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="truncate uppercase tracking-wide text-[9px] font-medium text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-gray-300" title={value || "—"}>
        {value || "—"}
      </p>
    </div>
  );
}

/** A ready-to-paste invocation for a profile. Keeping the command next to its
 * overlay makes the CLI behavior discoverable without asking the user to
 * select terminal text manually. */
function ProfileLaunchCommand({ name, t }: { name: string; t: TFunction }) {
  const command = `codex --profile ${name}`;
  const [copied, setCopied] = useState(false);

  /** Copy the command and show a check mark for 1.5 seconds. */
  const copyCommand = async () => {
    if (await copyText(command)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-surface-1 px-2 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-gray-300" title={command}>
        {command}
      </code>
      <button
        type="button"
        onClick={() => void copyCommand()}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded border border-border bg-surface-2 px-1.5 py-1 text-[10px] font-medium text-gray-300 transition-colors hover:bg-surface-3 hover:text-gray-100"
        title={t("snippet.copy", "Copy")}
        aria-label={t("snippet.copy", "Copy")}
      >
        {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
        <span aria-live="polite">
          {copied ? t("snippet.copied", "Copied") : t("snippet.copy", "Copy")}
        </span>
      </button>
    </div>
  );
}

/** Copy from secure contexts with the native Clipboard API, while keeping the
 * dashboard's local HTTP and remote-browser sessions usable through a safe,
 * short-lived textarea fallback.
 *
 * @param value - Text to copy.
 * @returns True when the copy succeeded.
 */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Some embedded or non-secure browser contexts reject Clipboard API access.
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/**
 * Dialog for creating a named `--profile` overlay. The name may use letters, numbers, hyphens, and
 * underscores and becomes `<name>.config.toml` in the Codex home.
 */
function CreateProfileModal({
  name,
  error,
  creating,
  onChange,
  onClose,
  onCreate,
  t,
}: {
  /** Profile name as typed. */
  name: string;
  /** Validation or server error to show, or null. */
  error: string | null;
  /** True while the create request is in flight. */
  creating: boolean;
  /** Called as the name is edited. */
  onChange: (value: string) => void;
  /** Closes the dialog. */
  onClose: () => void;
  /** Creates the profile. */
  onCreate: () => void;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!creating) onClose();
      }}
      role="presentation"
    >
      <form
        className="w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-profile-create-title"
      >
        <div className="border-b border-border px-4 py-3">
          <h2 id="codex-profile-create-title" className="text-sm font-semibold text-gray-100">
            {t("codex.createProfile", "Create profile")}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {t(
              "codex.profileLayering",
              "Profiles load after your base config and before project or command-line settings."
            )}
          </p>
        </div>
        <div className="space-y-2 px-4 py-4">
          <label htmlFor="codex-profile-name" className="text-xs font-medium text-gray-200">
            {t("codex.profileName", "Profile name")}
          </label>
          <input
            id="codex-profile-name"
            value={name}
            onChange={(event) => onChange(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="deep-review"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-gray-100 outline-none transition-colors placeholder:text-gray-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
          />
          <p className="text-[11px] leading-relaxed text-gray-500">
            {t(
              "codex.profileNameHint",
              "Letters, numbers, hyphens, and underscores only. This creates <name>.config.toml."
            )}
          </p>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-3 disabled:opacity-60"
          >
            {t("codex.cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {creating
              ? t("codex.creatingProfile", "Creating…")
              : t("codex.createProfile", "Create profile")}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Confirmation dialog for deleting a Codex file; notes that a timestamped backup is created first.
 */
function DeleteFileModal({
  target,
  error,
  deleting,
  onClose,
  onDelete,
  t,
}: {
  /** File awaiting deletion. */
  target: DeleteTarget;
  /** Delete error to show, or null. */
  error: string | null;
  /** True while the delete request is in flight; closing is blocked meanwhile. */
  deleting: boolean;
  /** Closes the dialog. */
  onClose: () => void;
  /** Deletes the file. */
  onDelete: () => void;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  useEffect(() => {
    /** Close on Escape unless a delete is in flight. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!deleting) onClose();
      }}
      role="presentation"
    >
      <section
        className="w-full max-w-lg overflow-hidden rounded-xl border border-red-500/40 bg-surface-1 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-delete-title"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-red-500/25 bg-red-500/10 text-red-300">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <h2 id="codex-delete-title" className="text-sm font-semibold text-gray-100">
              {t("codex.deleteTitle", "Delete this configuration item?")}
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {t("codex.deleteProtected", "config.toml is never available for deletion here.")}
            </p>
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-gray-400">
            {t(
              "codex.deleteDescription",
              "This removes the selected local artifact. A timestamped backup is created first, so you can recover it manually if needed."
            )}
          </p>
          <div className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] text-gray-300">
            <p className="truncate font-medium text-gray-100" title={target.label}>
              {target.label}
            </p>
            <p className="mt-1 break-all text-gray-500">{target.path}</p>
          </div>
          {error && <p className="text-xs leading-relaxed text-red-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-surface-3 disabled:opacity-60"
          >
            {t("codex.cancel", "Cancel")}
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 transition-colors hover:bg-red-500/25 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? t("codex.deleting", "Deleting…") : t("codex.deleteFile", "Delete")}
          </button>
        </div>
      </section>
    </div>
  );
}

/**
 * Read-only modal showing a redacted Codex file, with Edit and Delete when the file allows them.
 */
function PreviewModal({
  state,
  error,
  onClose,
  onEdit,
  onDelete,
  t,
}: {
  /** File to preview, or null while it loads. */
  state: PreviewState | null;
  /** Load error to show, or null. */
  error: string | null;
  /** Closes the preview. */
  onClose: () => void;
  /** Opens the editor; omitted when the file is not editable. */
  onEdit?: () => void;
  /** Asks to delete the file; omitted when the file is not deletable. */
  onDelete?: () => void;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-gray-200">
              {state?.file.path || t("codex.fileError", "Unable to open configuration file")}
            </p>
            {state && (
              <p className="mt-0.5 text-[11px] text-gray-500">
                {t("codex.redactedPreview", "Preview values are redacted where needed.")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/20"
              >
                <Pencil className="h-3 w-3" />
                {t("codex.editFile", "Edit")}
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/15"
              >
                <Trash2 className="h-3 w-3" />
                {t("codex.deleteFile", "Delete")}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label={t("common.close", "Close")}
              className="rounded p-1 text-gray-400 hover:bg-surface-2 hover:text-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {error ? (
          <p className="p-4 text-sm text-red-300">{error}</p>
        ) : (
          <pre className="overflow-auto p-4 text-xs leading-5 text-gray-300">
            {state?.file.text}
          </pre>
        )}
      </div>
    </div>
  );
}

/**
 * Editor modal for an allowlisted Codex file. Warns that Codex reads the file directly and the
 * dashboard cannot validate its syntax, and that a backup is taken before saving.
 */
function EditorModal({
  state,
  error,
  saving,
  onChange,
  onClose,
  onSave,
  t,
}: {
  /** File being edited, or null while it loads. */
  state: CodexConfigEditableFile | null;
  /** Save error to show, or null. */
  error: string | null;
  /** True while the save is in flight. */
  saving: boolean;
  /** Called as the text is edited. */
  onChange: (text: string) => void;
  /** Closes the editor without saving. */
  onClose: () => void;
  /** Saves the file. */
  onSave: () => void;
  /** Translation function for the `ccConfig` namespace, passed down from the explorer. */
  t: TFunction;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100">
              {t("codex.editTitle", "Edit configuration file")}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-gray-500">
              {state?.path || t("codex.fileError", "Unable to open configuration file")}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label={t("common.close", "Close")}
            className="rounded p-1 text-gray-400 hover:bg-surface-2 hover:text-gray-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <p>
              {t(
                "codex.syntaxWarning",
                "Codex reads this file directly. The dashboard cannot validate TOML, JSON, hook, rule, skill, or instruction syntax—review every edit carefully before saving. A timestamped backup is created first."
              )}
            </p>
          </div>
        </div>
        {error && (
          <p className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}
        {state && (
          <textarea
            value={state.text}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            className="min-h-[28rem] flex-1 resize-none bg-surface-0 p-4 font-mono text-xs leading-5 text-gray-200 outline-none placeholder:text-gray-600 focus:bg-surface-1"
          />
        )}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-3 disabled:opacity-60"
          >
            {t("codex.cancel", "Cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={!state || saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? t("codex.saving", "Saving…") : t("codex.save", "Save changes")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dismissible success or error banner shown above the Codex workspace. */
function StatusNotice({
  kind,
  message,
  onDismiss,
}: {
  /** Banner style. */
  kind: "error" | "success";
  /** Message to show. */
  message: string;
  /** Hides the banner. */
  onDismiss: () => void;
}) {
  const success = kind === "success";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${success ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-red-500/40 bg-red-500/10 text-red-200"}`}
    >
      {success ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="rounded p-0.5 opacity-70 hover:bg-black/10 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
