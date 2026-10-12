/**
 * @file CcConfig.tsx
 * @description Agent configuration explorer. Switches between the complete
 * Claude Code configuration workspace and a backup-backed editable Codex explorer.
 * The Claude workspace surfaces every plugin,
 * skill, subagent, slash command, MCP server, hook, settings file, memory
 * file, marketplace, keybinding, and statusline script Claude Code knows
 * about. Read access for all surfaces; create / edit / delete for the
 * low-risk text-file surfaces (skills, agents, commands, output styles,
 * CLAUDE.md memory, and per-project file-based memory files). Plugins, MCP,
 * hooks-in-settings, and settings.json files stay read-only - those have
 * concurrent-write races with the live CLI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/pages/CcConfig.tsx`
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
 * - `../lib/eventBus`
 * - `../lib/api`
 *
 * ## Public surface
 * - `CcConfig` — exported API; see TSDoc on the symbol for behavior.
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
 * **CcConfig**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentLocale } from "../lib/format";
import { eventBus } from "../lib/eventBus";
import {
  Boxes,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  FolderTree,
  Wrench,
  Slash,
  Palette,
  PlugZap,
  Server,
  Webhook,
  Settings as SettingsIcon,
  BookOpen,
  FileText,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  X,
  Info,
  Pencil,
  Trash2,
  Plus,
  Save,
  ShieldAlert,
  Lock,
  History,
  Terminal,
  Store,
  Keyboard,
  CircleDot,
  CircleSlash,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { api } from "../lib/api";
import { CodexConfigExplorer } from "../components/CodexConfigExplorer";
import { useUrlTab } from "../hooks/usePageShortcuts";
import { usePaletteAction } from "../components/PaletteActionProvider";
import { PaletteHint } from "../components/PaletteHint";
import type {
  CcArtifactType,
  CcBackup,
  CcFileResponse,
  CcHookScripts,
  CcHookSource,
  CcKeybindings,
  CcKeybindingGroup,
  CcMarketplacesResponse,
  CcMcpResponse,
  CcMcpServer,
  CcMdItem,
  CcMemoryItem,
  CcMutationResult,
  CcOverview,
  CcPlugin,
  CcPluginsResponse,
  CcScope,
  CcSettingsSource,
  CcStatusline,
} from "../lib/api";

/**
 * Type guard for the tabs whose artifacts can be created, edited, and deleted from the dashboard.
 * Every other tab is read-only (plugins, marketplaces, MCP, hooks, and settings are changed with
 * the CLI), except keybindings, which has its own inline editor.
 *
 * @param tab - Tab to check.
 * @returns True for skills, agents, commands, output styles, and memory.
 */
function isMutable(
  tab: TabKey
): tab is "skills" | "agents" | "commands" | "outputStyles" | "memory" {
  return (
    tab === "skills" ||
    tab === "agents" ||
    tab === "commands" ||
    tab === "outputStyles" ||
    tab === "memory"
  );
}

/**
 * Map a mutable tab to the artifact type the `/api/cc-config/file` routes expect. Only output
 * styles differ (`outputStyles` tab, `output-styles` type).
 *
 * @param tab - A tab accepted by {@link isMutable}.
 * @returns The matching {@link CcArtifactType}.
 */
function tabToArtifactType(
  tab: "skills" | "agents" | "commands" | "outputStyles" | "memory"
): CcArtifactType {
  return tab === "outputStyles" ? "output-styles" : tab;
}

/**
 * Tabs of the Claude Code half of Agent Config. The current tab is mirrored into the URL so the
 * command palette can deep-link to any of them.
 */
type TabKey =
  | "overview"
  | "skills"
  | "agents"
  | "commands"
  | "outputStyles"
  | "plugins"
  | "marketplaces"
  | "mcp"
  | "hooks"
  | "keybindings"
  | "settings"
  | "memory";

/** One entry in the tab bar. */
interface TabDef {
  /** Tab identifier, also used as the URL value. */
  key: TabKey;
  /** Lucide icon shown before the label. */
  icon: typeof Sparkles;
  /** Translation key (in the `ccConfig` namespace) for the tab label. */
  i18nKey: string;
}

/** Tab keys in render order — also the order `1`…`9` and `[`/`]` address them. */
const TAB_KEYS = [
  "overview",
  "skills",
  "agents",
  "commands",
  "memory",
  "plugins",
  "marketplaces",
  "mcp",
  "hooks",
  "keybindings",
  "settings",
  "outputStyles",
] as const;

/** Tab bar entries in display order. */
const TABS: TabDef[] = [
  { key: "overview", icon: Boxes, i18nKey: "tabs.overview" },
  { key: "skills", icon: Sparkles, i18nKey: "tabs.skills" },
  { key: "agents", icon: UserRound, i18nKey: "tabs.agents" },
  { key: "commands", icon: Slash, i18nKey: "tabs.commands" },
  { key: "memory", icon: BookOpen, i18nKey: "tabs.memory" },
  { key: "plugins", icon: PlugZap, i18nKey: "tabs.plugins" },
  { key: "marketplaces", icon: Store, i18nKey: "tabs.marketplaces" },
  { key: "mcp", icon: Server, i18nKey: "tabs.mcp" },
  { key: "hooks", icon: Webhook, i18nKey: "tabs.hooks" },
  { key: "keybindings", icon: Keyboard, i18nKey: "tabs.keybindings" },
  { key: "settings", icon: SettingsIcon, i18nKey: "tabs.settings" },
  { key: "outputStyles", icon: Palette, i18nKey: "tabs.outputStyles" },
];

/**
 * Everything the explorer has fetched, one slot per data source. A null slot means not loaded yet
 * and renders a skeleton; all slots are refetched together.
 */
interface PageState {
  /** Locations and per-kind counts for the Overview tab and the tab badges. */
  overview: CcOverview | null;
  /** Skills in the selected scope. */
  skills: CcMdItem[] | null;
  /** Subagent definitions in the selected scope. */
  agents: CcMdItem[] | null;
  /** Slash commands in the selected scope. */
  commands: CcMdItem[] | null;
  /** Output styles in the selected scope. */
  outputStyles: CcMdItem[] | null;
  /** Installed plugins and the install manifest they were read from. */
  plugins: CcPluginsResponse | null;
  /** Registered plugin marketplaces. */
  marketplaces: CcMarketplacesResponse | null;
  /** Configured MCP servers, user-level and project-scoped. */
  mcp: CcMcpResponse | null;
  /** Hook bindings for each settings layer. */
  hooks: CcHookSource[] | null;
  /** Parsed `keybindings.json`. */
  keybindings: CcKeybindings | null;
  /** Raw contents of each settings layer. */
  settings: CcSettingsSource[] | null;
  /** `CLAUDE.md` files and auto-memory files. */
  memory: CcMemoryItem[] | null;
  /** Statusline configuration and scripts. */
  statusline: CcStatusline | null;
  /** Scripts in the hooks directory. */
  hookScripts: CcHookScripts | null;
}

/** Initial {@link PageState}: nothing loaded. */
const EMPTY_STATE: PageState = {
  overview: null,
  skills: null,
  agents: null,
  commands: null,
  outputStyles: null,
  plugins: null,
  marketplaces: null,
  mcp: null,
  hooks: null,
  keybindings: null,
  settings: null,
  memory: null,
  statusline: null,
  hookScripts: null,
};

/**
 * State of the create/edit modal, or null when closed. `create` starts from a template in a chosen
 * default scope; `edit` loads the existing file. `project` is set for auto-memory files, which live
 * under a specific project's memory directory.
 */
type EditorState =
  | {
      mode: "create";
      type: CcArtifactType;
      defaultScope: "user" | "project";
      template: string;
      project?: string; // set for type === "auto-memory"
    }
  | {
      mode: "edit";
      type: CcArtifactType;
      scope: "user" | "project" | "auto-memory";
      name: string;
      filePath: string;
      project?: string; // set for type === "auto-memory"
    }
  | null;

/**
 * Artifact awaiting delete confirmation, or null when no confirmation is open. `project` is set for
 * auto-memory files.
 */
type ConfirmDeleteState = {
  type: CcArtifactType;
  scope: "user" | "project" | "auto-memory";
  name?: string;
  path: string;
  project?: string; // set for type === "auto-memory"
} | null;

/**
 * Transient success or error message shown in the bottom-right corner; auto-dismissed after 5
 * seconds.
 */
type Toast = { kind: "success" | "error"; message: string } | null;

/**
 * Agent Config page. Switches between the Claude Code explorer below and the Codex workspace
 * (`CodexConfigExplorer`).
 *
 * The Claude Code explorer fetches every config surface in parallel for the selected scope (all,
 * user, or project): skills, agents, commands, output styles, plugins, marketplaces, MCP servers,
 * hooks, keybindings, settings, memory, statusline, and hook scripts. It refetches automatically,
 * debounced by 250 ms, whenever the server broadcasts `cc_config_changed`, which covers both
 * dashboard edits and external file edits. Skills, agents, commands, output styles, `CLAUDE.md`,
 * and auto-memory files can be created, edited, and deleted here; every write or delete is backed
 * up server-side first, and the backups are browsable from the header.
 */
export function CcConfig() {
  const { t } = useTranslation("ccConfig");
  const [provider, setProvider] = useState<"claude" | "codex">("claude");
  // URL-backed so the palette can open any Agent Config tab directly.
  const [tab, setTab] = useUrlTab(TAB_KEYS, "overview");
  const [scope, setScope] = useState<CcScope>("all");
  const [data, setData] = useState<PageState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [viewer, setViewer] = useState<{
    path: string;
    data: CcFileResponse | null;
    error: string | null;
  } | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [backupsOpen, setBackupsOpen] = useState(false);

  // Auto-dismiss toasts after 5s
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  /**
   * Fetch every config surface in parallel for the selected scope and replace the page state,
   * recording when it finished.
   */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        overview,
        skills,
        agents,
        commands,
        outputStyles,
        plugins,
        marketplaces,
        mcp,
        hooks,
        keybindings,
        settings,
        memory,
        statusline,
        hookScripts,
      ] = await Promise.all([
        api.ccConfig.overview(),
        api.ccConfig.skills(scope),
        api.ccConfig.agents(scope),
        api.ccConfig.commands(scope),
        api.ccConfig.outputStyles(scope),
        api.ccConfig.plugins(),
        api.ccConfig.marketplaces(),
        api.ccConfig.mcp(),
        api.ccConfig.hooks(),
        api.ccConfig.keybindings(),
        api.ccConfig.settings(),
        api.ccConfig.memory(),
        api.ccConfig.statusline(),
        api.ccConfig.hookScripts(),
      ]);
      setData({
        overview,
        skills: skills.items,
        agents: agents.items,
        commands: commands.items,
        outputStyles: outputStyles.items,
        plugins,
        marketplaces,
        mcp,
        hooks: hooks.items,
        keybindings,
        settings: settings.items,
        memory: memory.items,
        statusline,
        hookScripts,
      });
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Live updates - refetch whenever the server broadcasts that a config
  // surface has changed (either via dashboard mutations or external file
  // edits picked up by the cc-watcher). Debounced because a single user
  // action can write multiple files (e.g. a skill backup + the skill itself
  // + the file-history snapshot all land within tens of ms).
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (msg.type !== "cc_config_changed") return;
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        void fetchAll();
      }, 250);
    });
  }, [fetchAll]);
  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

  usePaletteAction("page.refresh", () => {
    void fetchAll();
  });

  /** Open a file in the read-only viewer, loading its contents. */
  const openViewer = useCallback(async (path: string) => {
    setViewer({ path, data: null, error: null });
    try {
      const file = await api.ccConfig.file(path);
      setViewer({ path, data: file, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      setViewer({ path, data: null, error: msg });
    }
  }, []);

  /**
   * Open the editor to create an artifact, starting from the localized template for its type. The
   * default scope follows the scope filter (project when filtering by project, otherwise user)
   * unless one is given.
   */
  const openCreate = useCallback(
    (type: CcArtifactType, overrideScope?: "user" | "project") => {
      const tplKey = `edit.templates.${type}`;
      const template = t(tplKey);
      const defaultScope: "user" | "project" =
        overrideScope ?? (scope === "project" ? "project" : "user");
      setEditor({ mode: "create", type, defaultScope, template });
    },
    [scope, t]
  );

  /** Open the editor for an existing artifact. */
  const openEdit = useCallback(
    (type: CcArtifactType, item: { scope: "user" | "project"; name: string; filePath: string }) => {
      setEditor({
        mode: "edit",
        type,
        scope: item.scope,
        name: item.name,
        filePath: item.filePath,
      });
    },
    []
  );

  /** Ask for confirmation before deleting an artifact. */
  const openDelete = useCallback(
    (
      type: CcArtifactType,
      scopeArg: "user" | "project",
      name: string | undefined,
      path: string
    ) => {
      setConfirmDelete({ type, scope: scopeArg, name, path });
    },
    []
  );

  // ── Auto-memory (per-project file-based memory) create / edit / delete ──
  const openCreateAuto = useCallback(
    (project: string) => {
      setEditor({
        mode: "create",
        type: "auto-memory",
        defaultScope: "user", // unused for auto-memory; scope is fixed
        template: t("edit.templates.auto-memory"),
        project,
      });
    },
    [t]
  );

  /** Open the editor for an auto-memory file. Ignored for items without a project or file name. */
  const openEditAuto = useCallback((item: CcMemoryItem) => {
    if (!item.project || !item.name) return;
    setEditor({
      mode: "edit",
      type: "auto-memory",
      scope: "auto-memory",
      name: item.name,
      filePath: item.file,
      project: item.project,
    });
  }, []);

  /**
   * Ask for confirmation before deleting an auto-memory file. Ignored for items without a project
   * or file name.
   */
  const openDeleteAuto = useCallback((item: CcMemoryItem) => {
    if (!item.project || !item.name) return;
    setConfirmDelete({
      type: "auto-memory",
      scope: "auto-memory",
      name: item.name,
      path: item.file,
      project: item.project,
    });
  }, []);

  /**
   * Write an artifact from the editor, then close the editor, show a toast naming the backup when
   * one was taken, and refetch.
   */
  const handleSave = useCallback(
    async (args: {
      /** Kind of artifact. */
      type: CcArtifactType;
      /** Layer to write into. */
      targetScope: "user" | "project" | "auto-memory";
      /** Artifact name; undefined for singleton files such as `CLAUDE.md`. */
      name: string | undefined;
      /** Full file contents. */
      content: string;
      /** Project slug, for auto-memory files. */
      project?: string;
    }) => {
      const result: CcMutationResult = await api.ccConfig.write({
        scope: args.targetScope,
        type: args.type,
        name: args.name,
        content: args.content,
        project: args.project,
      });
      setEditor(null);
      setToast({
        kind: "success",
        message: result.created
          ? t("edit.saveSuccessNew")
          : t("edit.saveSuccess", { path: result.backupPath || "-" }),
      });
      void fetchAll();
    },
    [fetchAll, t]
  );

  /**
   * Delete the confirmed artifact, close the dialog, show a toast with the backup path, and
   * refetch.
   */
  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      const result = await api.ccConfig.delete({
        scope: confirmDelete.scope,
        type: confirmDelete.type,
        name: confirmDelete.name,
        project: confirmDelete.project,
      });
      setConfirmDelete(null);
      setToast({
        kind: "success",
        message: t("edit.deleteSuccess", { path: result.backupPath || "-" }),
      });
      void fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown error";
      setConfirmDelete(null);
      setToast({ kind: "error", message: t("edit.deleteError", { message: msg }) });
    }
  }, [confirmDelete, fetchAll, t]);

  return (
    <div className="space-y-5">
      <Header
        provider={provider}
        onProviderChange={setProvider}
        loading={loading}
        lastUpdated={lastUpdated}
        scope={scope}
        onScopeChange={setScope}
        onRefresh={fetchAll}
        onOpenBackups={() => setBackupsOpen(true)}
        wsConnected={wsConnected}
      />

      {provider === "codex" ? (
        <CodexConfigExplorer />
      ) : (
        <>
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t("loadError", { message: error })}</span>
            </div>
          )}

          <Tabs current={tab} onSelect={setTab} counts={data.overview?.counts} />

          <div className="rounded-xl border border-border bg-surface-1">
            {tab !== "overview" && (
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <Search className="w-4 h-4 text-gray-500" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("common.search")}
                  className="h-7 bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none flex-1"
                />
                <PaletteHint />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    title={t("common.clearSearch")}
                    aria-label={t("common.clearSearch")}
                    className="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {isMutable(tab) && tab !== "memory" && (
                  <button
                    onClick={() => openCreate(tabToArtifactType(tab))}
                    className="h-7 text-[11px] font-medium px-2.5 rounded-md border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" />
                    {t("edit.newButton")}
                  </button>
                )}
              </div>
            )}
            <div className="p-4">
              <TabPanel
                tab={tab}
                data={data}
                search={search}
                onTabChange={setTab}
                onOpenFile={openViewer}
                onEdit={openEdit}
                onDelete={openDelete}
                onCreateMemory={(s) => openCreate("memory", s)}
                onEditAuto={openEditAuto}
                onDeleteAuto={openDeleteAuto}
                onCreateAuto={openCreateAuto}
                onKeybindingsSaved={fetchAll}
                onToast={setToast}
              />
            </div>
          </div>

          {viewer && <FileViewer state={viewer} onClose={() => setViewer(null)} />}
          {editor && (
            <EditorModal state={editor} onClose={() => setEditor(null)} onSave={handleSave} />
          )}
          {confirmDelete && (
            <ConfirmDeleteModal
              state={confirmDelete}
              onCancel={() => setConfirmDelete(null)}
              onConfirm={handleDelete}
            />
          )}
          {toast && <ToastNotice toast={toast} onDismiss={() => setToast(null)} />}
          {backupsOpen && <BackupsModal onClose={() => setBackupsOpen(false)} />}
        </>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────

/** Props for the Agent Config {@link Header}. */
interface HeaderProps {
  /** Which explorer is shown. */
  provider: "claude" | "codex";
  /** Switches between the Claude Code and Codex explorers. */
  onProviderChange: (provider: "claude" | "codex") => void;
  /** True while a fetch is in flight; spins the refresh icon. */
  loading: boolean;
  /** When the last successful fetch finished, shown as a time. */
  lastUpdated: Date | null;
  /** Selected scope filter. */
  scope: CcScope;
  /** Called when the scope filter changes. */
  onScopeChange: (s: CcScope) => void;
  /** Refetches everything. */
  onRefresh: () => void;
  /** Opens the backups modal. */
  onOpenBackups: () => void;
  /**
   * Live WebSocket state, which tells the user whether external file edits will show up
   * automatically.
   */
  wsConnected: boolean;
}

/**
 * Agent Config header: title, the Claude Code / Codex toggle, the scope filter, last-updated time
 * with a live indicator, and the refresh and backups buttons.
 */
function Header({
  provider,
  onProviderChange,
  loading,
  lastUpdated,
  scope,
  onScopeChange,
  onRefresh,
  onOpenBackups,
  wsConnected,
}: HeaderProps) {
  const { t } = useTranslation("ccConfig");
  const { t: tCommon } = useTranslation("common");
  const formatted = lastUpdated
    ? lastUpdated.toLocaleTimeString(getCurrentLocale(), {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "-";
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Boxes className="w-4.5 h-4.5 text-accent" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            {wsConnected ? (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                {tCommon("live")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {tCommon("offline")}
              </span>
            )}
            <ProviderToggle value={provider} onChange={onProviderChange} />
          </div>
          <p className="text-xs text-gray-500 max-w-2xl">{t(`provider.${provider}.subtitle`)}</p>
        </div>
      </div>
      <div className="flex flex-col items-stretch lg:items-end gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {provider === "claude" && <ScopeToggle value={scope} onChange={onScopeChange} />}
          {provider === "claude" && (
            <button
              onClick={onOpenBackups}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-3 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              {t("backups.openButton")}
            </button>
          )}
          {provider === "claude" && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-3 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? t("refreshing") : t("refresh")}
            </button>
          )}
        </div>
        {provider === "claude" && lastUpdated && (
          <span className="text-[11px] text-gray-500 self-end">
            {t("lastUpdated", { time: formatted })}
          </span>
        )}
      </div>
    </header>
  );
}

/** Pill toggle between the Claude Code and Codex explorers; Codex carries a BETA tag. */
function ProviderToggle({
  value,
  onChange,
}: {
  /** Selected explorer. */
  value: "claude" | "codex";
  /** Called with the chosen explorer. */
  onChange: (value: "claude" | "codex") => void;
}) {
  const { t } = useTranslation("ccConfig");
  return (
    <div
      className="inline-flex rounded-full border border-border bg-surface-2 p-0.5"
      aria-label={t("provider.aria", "Configuration provider")}
    >
      {(["claude", "codex"] as const).map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-full px-2 py-px text-[10px] font-medium transition-colors ${value === option ? "bg-accent/20 text-accent" : "text-gray-400 hover:text-gray-200"}`}
        >
          {t(`provider.${option}.label`)}
          {option === "codex" && (
            <span className="ml-1 text-[9px] text-amber-400">{t("provider.beta", "BETA")}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Segmented control for the scope filter: all, user (`~/.claude`), or project (`./.claude`). */
function ScopeToggle({ value, onChange }: { value: CcScope; onChange: (s: CcScope) => void }) {
  const { t } = useTranslation("ccConfig");
  const opts: { v: CcScope; label: string }[] = [
    { v: "all", label: t("scope.all") },
    { v: "user", label: t("scope.user") },
    { v: "project", label: t("scope.project") },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
            value === o.v
              ? "bg-accent/20 text-accent border border-accent/30"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────

/** Props for {@link Tabs}. */
interface TabsProps {
  /** Active tab. */
  current: TabKey;
  /** Called when a tab is clicked. */
  onSelect: (k: TabKey) => void;
  /** Per-kind counts shown as badges; omitted until the overview has loaded. */
  counts?: CcOverview["counts"];
}

/**
 * Horizontally scrollable tab bar with count badges. Shows left and right scroll arrows only when
 * there is hidden overflow in that direction, recomputed on scroll and on resize.
 */
function Tabs({ current, onSelect, counts }: TabsProps) {
  const { t } = useTranslation("ccConfig");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Update scroll affordances when content size or scroll position changes.
  const updateAffordances = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateAffordances();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateAffordances, { passive: true });
    const ro = new ResizeObserver(updateAffordances);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateAffordances);
      ro.disconnect();
    };
  }, [updateAffordances]);

  // Scroll the active tab into view when it changes (e.g. user picks a tab
  // that's offscreen, or window resize hides the active one).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-tab-active="true"]');
    if (!active) return;
    const elRect = el.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (activeRect.left < elRect.left + 8) {
      el.scrollBy({ left: activeRect.left - elRect.left - 16, behavior: "smooth" });
    } else if (activeRect.right > elRect.right - 8) {
      el.scrollBy({ left: activeRect.right - elRect.right + 16, behavior: "smooth" });
    }
  }, [current]);

  /**
   * Scroll the tab bar by most of its visible width, at least 200px.
   *
   * @param dir - Direction: 1 for right, -1 for left.
   */
  const scrollByButton = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.6), behavior: "smooth" });
  };

  /**
   * Badge count for a tab: user plus project counts where the overview splits them, or null when
   * there is no count.
   *
   * @param key - Tab to count.
   * @returns The count, or null.
   */
  const countFor = (key: TabKey): number | null => {
    if (!counts) return null;
    switch (key) {
      case "skills":
        return counts.skills.user + counts.skills.project;
      case "agents":
        return counts.agents.user + counts.agents.project;
      case "commands":
        return counts.commands.user + counts.commands.project;
      case "outputStyles":
        return counts.outputStyles.user + counts.outputStyles.project;
      case "plugins":
        return counts.plugins;
      case "marketplaces":
        return counts.marketplaces;
      case "keybindings":
        return counts.keybindings;
      case "mcp":
        return counts.mcpServers.user + counts.mcpServers.project;
      case "hooks":
        return Object.values(counts.hooks).reduce((a, b) => a + b, 0);
      case "settings":
        return counts.settingsFiles;
      case "memory":
        return counts.memory;
      default:
        return null;
    }
  };
  return (
    <div className="relative rounded-xl border border-border bg-surface-1">
      {/* Left edge gradient + chevron */}
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-0 w-12 rounded-l-xl bg-gradient-to-r from-surface-1 to-transparent transition-opacity z-10 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      {canScrollLeft && (
        <button
          onClick={() => scrollByButton(-1)}
          aria-label="scroll tabs left"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 rounded-md w-7 h-7 flex items-center justify-center bg-surface-2 border border-border text-gray-300 hover:text-gray-100 hover:bg-surface-3"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-1 p-1 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {TABS.map(({ key, icon: Icon, i18nKey }) => {
          const c = countFor(key);
          const active = current === key;
          return (
            <button
              key={key}
              data-tab-active={active ? "true" : undefined}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap ${
                active
                  ? "bg-accent/15 text-accent border border-accent/30"
                  : "text-gray-400 hover:text-gray-200 hover:bg-surface-3 border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t(i18nKey)}</span>
              {c !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    active ? "bg-accent/20 text-accent" : "bg-surface-3 text-gray-400"
                  }`}
                >
                  {c}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right edge gradient + chevron */}
      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 w-12 rounded-r-xl bg-gradient-to-l from-surface-1 to-transparent transition-opacity z-10 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />
      {canScrollRight && (
        <button
          onClick={() => scrollByButton(1)}
          aria-label="scroll tabs right"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 rounded-md w-7 h-7 flex items-center justify-center bg-surface-2 border border-border text-gray-300 hover:text-gray-100 hover:bg-surface-3"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Tab panel switch ──────────────────────────────────────────────────

/** Props for {@link TabPanel}: the fetched data plus every callback a tab may need. */
interface TabPanelProps {
  /** Tab to render. */
  tab: TabKey;
  /** All fetched data. */
  data: PageState;
  /** Search text; each list filters by it. */
  search: string;
  /** Switches tab, used by the Overview tiles. */
  onTabChange: (tab: TabKey) => void;
  /** Opens a file in the read-only viewer. */
  onOpenFile: (path: string) => void;
  /** Opens the editor for an existing artifact. */
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  /** Asks for confirmation to delete an artifact. */
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  /** Opens the editor to create the missing user or project `CLAUDE.md`. */
  onCreateMemory: (scope: "user" | "project") => void;
  /** Opens the editor for an auto-memory file. */
  onEditAuto: (item: CcMemoryItem) => void;
  /** Asks for confirmation to delete an auto-memory file. */
  onDeleteAuto: (item: CcMemoryItem) => void;
  /** Opens the editor to create a new auto-memory file in a project. */
  onCreateAuto: (project: string) => void;
  /** Called after keybindings are saved, to refetch. */
  onKeybindingsSaved: () => void;
  /** Shows a toast. */
  onToast: (toast: NonNullable<Toast>) => void;
}

/**
 * Render the panel for the active tab, passing it the slice of {@link PageState} and callbacks it
 * needs.
 */
function TabPanel({
  tab,
  data,
  search,
  onTabChange,
  onOpenFile,
  onEdit,
  onDelete,
  onCreateMemory,
  onEditAuto,
  onDeleteAuto,
  onCreateAuto,
  onKeybindingsSaved,
  onToast,
}: TabPanelProps) {
  switch (tab) {
    case "overview":
      return <OverviewPanel overview={data.overview} onTabChange={onTabChange} />;
    case "skills":
      return (
        <MdItemList
          items={data.skills}
          search={search}
          onOpen={onOpenFile}
          onEdit={onEdit}
          onDelete={onDelete}
          kind="skills"
        />
      );
    case "agents":
      return (
        <MdItemList
          items={data.agents}
          search={search}
          onOpen={onOpenFile}
          onEdit={onEdit}
          onDelete={onDelete}
          kind="agents"
        />
      );
    case "commands":
      return (
        <MdItemList
          items={data.commands}
          search={search}
          onOpen={onOpenFile}
          onEdit={onEdit}
          onDelete={onDelete}
          kind="commands"
        />
      );
    case "outputStyles":
      return (
        <MdItemList
          items={data.outputStyles}
          search={search}
          onOpen={onOpenFile}
          onEdit={onEdit}
          onDelete={onDelete}
          kind="outputStyles"
        />
      );
    case "plugins":
      return <PluginsPanel data={data.plugins} search={search} />;
    case "marketplaces":
      return <MarketplacesPanel data={data.marketplaces} search={search} />;
    case "mcp":
      return <McpPanel data={data.mcp} search={search} />;
    case "hooks":
      return (
        <HooksPanel
          sources={data.hooks}
          scripts={data.hookScripts}
          search={search}
          onOpen={onOpenFile}
        />
      );
    case "keybindings":
      return (
        <KeybindingsPanel
          data={data.keybindings}
          search={search}
          onSaved={onKeybindingsSaved}
          onToast={onToast}
        />
      );
    case "settings":
      return (
        <SettingsPanel sources={data.settings} statusline={data.statusline} onOpen={onOpenFile} />
      );
    case "memory":
      return (
        <MemoryPanel
          items={data.memory}
          search={search}
          onOpen={onOpenFile}
          onEdit={onEdit}
          onDelete={onDelete}
          onCreate={onCreateMemory}
          onEditAuto={onEditAuto}
          onDeleteAuto={onDeleteAuto}
          onCreateAuto={onCreateAuto}
        />
      );
    default:
      return null;
  }
}

// ── Overview ──────────────────────────────────────────────────────────

/**
 * Color tones for the Overview's root rows and summary tiles. Each tone maps to icon, accent bar,
 * focus ring, and hover border classes in {@link TONES}, so related tiles share a consistent color.
 */
type Tone =
  | "sky"
  | "emerald"
  | "violet"
  | "amber"
  | "fuchsia"
  | "cyan"
  | "pink"
  | "indigo"
  | "orange"
  | "teal"
  | "slate"
  | "rose";
/**
 * Tailwind classes for each {@link Tone}: icon background and color, left accent bar, focus ring,
 * and hover border.
 */
const TONES: Record<
  Tone,
  { iconBg: string; iconText: string; bar: string; ring: string; hoverBorder: string }
> = {
  sky: {
    iconBg: "bg-sky-500/10",
    iconText: "text-sky-300",
    bar: "bg-sky-500/40",
    ring: "ring-sky-500/20",
    hoverBorder: "hover:border-sky-500/35",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-300",
    bar: "bg-emerald-500/40",
    ring: "ring-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/35",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-300",
    bar: "bg-violet-500/40",
    ring: "ring-violet-500/20",
    hoverBorder: "hover:border-violet-500/35",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-300",
    bar: "bg-amber-500/40",
    ring: "ring-amber-500/20",
    hoverBorder: "hover:border-amber-500/35",
  },
  fuchsia: {
    iconBg: "bg-fuchsia-500/10",
    iconText: "text-fuchsia-300",
    bar: "bg-fuchsia-500/40",
    ring: "ring-fuchsia-500/20",
    hoverBorder: "hover:border-fuchsia-500/35",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-300",
    bar: "bg-cyan-500/40",
    ring: "ring-cyan-500/20",
    hoverBorder: "hover:border-cyan-500/35",
  },
  pink: {
    iconBg: "bg-pink-500/10",
    iconText: "text-pink-300",
    bar: "bg-pink-500/40",
    ring: "ring-pink-500/20",
    hoverBorder: "hover:border-pink-500/35",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-300",
    bar: "bg-indigo-500/40",
    ring: "ring-indigo-500/20",
    hoverBorder: "hover:border-indigo-500/35",
  },
  orange: {
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-300",
    bar: "bg-orange-500/40",
    ring: "ring-orange-500/20",
    hoverBorder: "hover:border-orange-500/35",
  },
  teal: {
    iconBg: "bg-teal-500/10",
    iconText: "text-teal-300",
    bar: "bg-teal-500/40",
    ring: "ring-teal-500/20",
    hoverBorder: "hover:border-teal-500/35",
  },
  slate: {
    iconBg: "bg-slate-500/10",
    iconText: "text-slate-300",
    bar: "bg-slate-500/40",
    ring: "ring-slate-500/20",
    hoverBorder: "hover:border-slate-500/35",
  },
  rose: {
    iconBg: "bg-rose-500/10",
    iconText: "text-rose-300",
    bar: "bg-rose-500/40",
    ring: "ring-rose-500/20",
    hoverBorder: "hover:border-rose-500/35",
  },
};

/**
 * Overview tab: the key filesystem roots the explorer reads (Claude home, project `.claude`
 * directory, project root, and `.claude.json`), then a grid of clickable summary tiles with
 * per-scope counts that jump to the matching tab.
 */
function OverviewPanel({
  overview,
  onTabChange,
}: {
  /** Overview data, or null while loading. */
  overview: CcOverview | null;
  /** Switches tab when a summary tile is clicked. */
  onTabChange: (tab: TabKey) => void;
}) {
  const { t } = useTranslation("ccConfig");
  /** Stable tab-switch callback for the summary tiles. */
  const gotoTab = useCallback((nextTab: TabKey) => onTabChange(nextTab), [onTabChange]);
  if (!overview) return <SkeletonRows n={4} />;
  const { roots, counts } = overview;
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          {t("overview.rootsTitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <RootRow
            icon={FolderTree}
            tone="sky"
            label={t("overview.claudeHome")}
            value={roots.claudeHome}
          />
          <RootRow
            icon={FolderTree}
            tone="emerald"
            label={t("overview.projectClaudeDir")}
            value={roots.projectClaudeDir}
          />
          <RootRow
            icon={FolderTree}
            tone="violet"
            label={t("overview.projectRoot")}
            value={roots.projectRoot}
          />
          <RootRow
            icon={FileText}
            tone="amber"
            label={t("overview.claudeJson")}
            value={roots.claudeJson}
          />
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          {t("overview.summary")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          <SummaryStat
            tone="fuchsia"
            icon={Sparkles}
            label={t("tabs.skills")}
            onClick={() => gotoTab("skills")}
            user={counts.skills.user}
            project={counts.skills.project}
          />
          <SummaryStat
            tone="sky"
            icon={UserRound}
            label={t("tabs.agents")}
            onClick={() => gotoTab("agents")}
            user={counts.agents.user}
            project={counts.agents.project}
          />
          <SummaryStat
            tone="cyan"
            icon={Slash}
            label={t("tabs.commands")}
            onClick={() => gotoTab("commands")}
            user={counts.commands.user}
            project={counts.commands.project}
          />
          <SummaryStat
            tone="pink"
            icon={Palette}
            label={t("tabs.outputStyles")}
            onClick={() => gotoTab("outputStyles")}
            user={counts.outputStyles.user}
            project={counts.outputStyles.project}
          />
          <SummaryStat
            tone="indigo"
            icon={Server}
            label={t("tabs.mcp")}
            onClick={() => gotoTab("mcp")}
            user={counts.mcpServers.user}
            project={counts.mcpServers.project}
          />
          <SummaryStat
            tone="emerald"
            icon={PlugZap}
            label={t("tabs.plugins")}
            onClick={() => gotoTab("plugins")}
            value={counts.plugins}
          />
          <SummaryStat
            tone="amber"
            icon={Store}
            label={t("tabs.marketplaces")}
            onClick={() => gotoTab("marketplaces")}
            value={counts.marketplaces}
          />
          <SummaryStat
            tone="orange"
            icon={Webhook}
            label={t("tabs.hooks")}
            onClick={() => gotoTab("hooks")}
            value={Object.values(counts.hooks).reduce((a, b) => a + b, 0)}
          />
          <SummaryStat
            tone="rose"
            icon={Keyboard}
            label={t("tabs.keybindings")}
            onClick={() => gotoTab("keybindings")}
            value={counts.keybindings}
          />
          <SummaryStat
            tone="slate"
            icon={SettingsIcon}
            label={t("tabs.settings")}
            onClick={() => gotoTab("settings")}
            value={counts.settingsFiles}
          />
          <SummaryStat
            tone="teal"
            icon={BookOpen}
            label={t("tabs.memory")}
            onClick={() => gotoTab("memory")}
            value={counts.memory}
          />
        </div>
      </section>
    </div>
  );
}

/** Props for {@link SummaryStat}. */
interface SummaryStatProps {
  /** Color tone of the tile. */
  tone: Tone;
  /** Icon shown in the tile. */
  icon: typeof Sparkles;
  /** Tile label. */
  label: string;
  /** Click handler. Without one the tile is not interactive. */
  onClick?: () => void;
  /**
   * Single headline value. Pass either this or a `user` / `project` pair, which is summed for the
   * headline and shown as a breakdown underneath.
   */
  value?: number;
  /** User-scope count; pair with `project`. */
  user?: number;
  /** Project-scope count; pair with `user`. */
  project?: number;
}

/**
 * Overview summary tile: icon, label, and a headline count, with a user/project breakdown when both
 * counts are given. Clickable when `onClick` is set.
 */
function SummaryStat({ tone, icon: Icon, label, onClick, value, user, project }: SummaryStatProps) {
  const { t } = useTranslation("ccConfig");
  const T = TONES[tone];
  const total = value !== undefined ? value : (user ?? 0) + (project ?? 0);
  const showBreakdown = user !== undefined && project !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left rounded-lg border border-border bg-surface-2 overflow-hidden transition-all ${
        onClick
          ? `cursor-pointer ${T.hoverBorder} hover:bg-surface-3 focus:outline-none focus-visible:ring-2 ${T.ring}`
          : "cursor-default"
      }`}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${T.bar}`} aria-hidden />
      <div className="pl-3.5 pr-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-md ${T.iconBg} flex items-center justify-center flex-shrink-0 transition-transform ${
              onClick ? "group-hover:scale-105" : ""
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${T.iconText}`} />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
            {label}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-xl font-semibold text-gray-100 tabular-nums">{total}</span>
          {showBreakdown && (
            <span className="text-[10px] text-gray-500 truncate">
              {user} {t("overview.user")} · {project} {t("overview.project")}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** One labelled filesystem path on the Overview tab, with a color-coded accent bar and icon. */
function RootRow({
  icon: Icon,
  tone,
  label,
  value,
}: {
  /** Icon shown in the row. */
  icon: typeof FolderTree;
  /** Color tone. */
  tone: Tone;
  /** Row label. */
  label: string;
  /** Filesystem path. */
  value: string;
}) {
  const T = TONES[tone];
  return (
    <div className="relative flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2 min-w-0 overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${T.bar}`} aria-hidden />
      <span
        className={`w-7 h-7 rounded-md ${T.iconBg} flex items-center justify-center flex-shrink-0 ml-1.5`}
      >
        <Icon className={`w-3.5 h-3.5 ${T.iconText}`} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </div>
        <div className="font-mono text-[11px] text-gray-200 truncate">{value}</div>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

// ── MD-item generic list (skills/agents/commands/output-styles) ───────

/** Props for {@link MdItemList}. */
interface MdItemListProps {
  /** Items to list, or null while loading. */
  items: CcMdItem[] | null;
  /** Search text matched against the name and frontmatter `name` / `description`. */
  search: string;
  /** Opens an item's file in the read-only viewer. */
  onOpen: (path: string) => void;
  /** Opens the editor for an item. */
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  /** Asks for confirmation to delete an item. */
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  /** Which tab the list belongs to, which decides the artifact type for edits and deletes. */
  kind: "skills" | "agents" | "commands" | "outputStyles";
}

/**
 * Searchable list of markdown artifacts (skills, agents, commands, or output styles), one {@link
 * MdItemCard} per item. Shows a skeleton while loading and an empty state when nothing matches.
 */
function MdItemList({ items, search, onOpen, onEdit, onDelete, kind }: MdItemListProps) {
  /**
   * Items whose name or frontmatter `name` / `description` contains the search text; null while
   * loading.
   */
  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.toLowerCase();
    return items.filter((it) => {
      if (!q) return true;
      const blob = [it.name, it.frontmatter.description, it.frontmatter.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, search]);

  if (!filtered) return <SkeletonRows n={6} />;
  if (filtered.length === 0) return <Empty />;

  return (
    <div className="space-y-2">
      {filtered.map((it) => (
        <MdItemCard
          key={`${it.scope}:${it.name}`}
          item={it}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
          kind={kind}
        />
      ))}
    </div>
  );
}

/** Props for {@link MdItemCard}. */
interface MdItemCardProps {
  /** The artifact to show. */
  item: CcMdItem;
  /** Opens the file in the read-only viewer. */
  onOpen: (p: string) => void;
  /** Opens the editor for this artifact. */
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  /** Asks for confirmation to delete this artifact. */
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  /** Which tab the card belongs to. */
  kind: "skills" | "agents" | "commands" | "outputStyles";
}

/**
 * Card for one markdown artifact: name, scope badge, `model` from frontmatter when set, and the
 * frontmatter description (or the start of the body when there is none), with view, edit, and
 * delete actions. Skills are directories, so their file path is the `SKILL.md` inside.
 */
function MdItemCard({ item, onOpen, onEdit, onDelete, kind }: MdItemCardProps) {
  const { t } = useTranslation("ccConfig");
  const artifactType: CcArtifactType = kind === "outputStyles" ? "output-styles" : kind;

  const filePath = item.file || `${item.path}/SKILL.md`;
  const description =
    item.frontmatter.description ||
    item.preview
      .replace(/^#+\s.*\n/, "")
      .trim()
      .slice(0, 200);
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-100 truncate">{item.name}</span>
            <ScopeBadge scope={item.scope} />
            {item.frontmatter.model && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                {item.frontmatter.model}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
          {kind === "agents" && item.frontmatter.tools && (
            <div className="mt-2 text-[11px] text-gray-500">
              <span className="text-gray-500">{t("agents.tools")}:</span>{" "}
              <span className="font-mono text-gray-400">{item.frontmatter.tools}</span>
            </div>
          )}
          <div className="mt-2 font-mono text-[10px] text-gray-600 truncate">{filePath}</div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => onOpen(filePath)}
            className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1.5"
          >
            <ExternalLink className="w-3 h-3" />
            {t("common.viewSource")}
          </button>
          <button
            onClick={() => onEdit(artifactType, { scope: item.scope, name: item.name, filePath })}
            className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3 h-3" />
            {t("edit.editButton")}
          </button>
          <button
            onClick={() => onDelete(artifactType, item.scope, item.name, filePath)}
            className="text-[11px] font-medium px-2 py-1 rounded-md border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-300 inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            {t("edit.deleteButton")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plugins ───────────────────────────────────────────────────────────

/**
 * Plugins tab: an explainer on installing plugins with the CLI, the install manifest path (flagged
 * when missing), and a card per installed plugin filtered by key.
 */
function PluginsPanel({ data, search }: { data: CcPluginsResponse | null; search: string }) {
  const { t } = useTranslation("ccConfig");
  if (!data) return <SkeletonRows n={4} />;
  const filtered = data.plugins.filter(
    (p) => !search || p.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <ExplainerBanner
        title={t("explain.plugins.title")}
        body={t("explain.plugins.body")}
        howTo={t("explain.plugins.install")}
        commands={[{ cmd: t("explain.plugins.installCmd"), note: "" }]}
      />
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 flex items-center gap-2 text-[11px] text-gray-500">
        <FileText className="w-3.5 h-3.5" />
        <span className="font-mono truncate">{data.manifestPath}</span>
        {!data.manifestExists && (
          <span className="ml-auto text-amber-400">
            {t("plugins.manifestMissing", { path: "" })}
          </span>
        )}
      </div>
      {filtered.length === 0 ? (
        <Empty />
      ) : (
        filtered.map((p) => <PluginCard key={p.key} plugin={p} />)
      )}
    </div>
  );
}

/**
 * Card for one installed plugin: name, version, marketplace, and enabled state; a missing install
 * path is flagged; badges count the skills, agents, commands, output styles, and hooks it
 * contributes; manifest metadata (description, author, homepage, license) when the plugin has a
 * `plugin.json`.
 */
function PluginCard({ plugin: p }: { plugin: CcPlugin }) {
  const { t } = useTranslation("ccConfig");
  const meta = p.contributes?.pluginJson;
  const description = meta?.description;
  const contribCounts: { key: string; count: number; label: string }[] = [];
  if (p.contributes) {
    if (p.contributes.skills > 0)
      contribCounts.push({
        key: "skills",
        count: p.contributes.skills,
        label: t("plugins.skills", { count: p.contributes.skills }),
      });
    if (p.contributes.agents > 0)
      contribCounts.push({
        key: "agents",
        count: p.contributes.agents,
        label: t("plugins.agents", { count: p.contributes.agents }),
      });
    if (p.contributes.commands > 0)
      contribCounts.push({
        key: "commands",
        count: p.contributes.commands,
        label: t("plugins.commands", { count: p.contributes.commands }),
      });
    if (p.contributes.outputStyles > 0)
      contribCounts.push({
        key: "outputStyles",
        count: p.contributes.outputStyles,
        label: t("plugins.outputStyles", { count: p.contributes.outputStyles }),
      });
    if (p.contributes.hooks > 0)
      contribCounts.push({
        key: "hooks",
        count: p.contributes.hooks,
        label: t("plugins.hooks", { count: p.contributes.hooks }),
      });
  }
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-gray-100">{p.name}</span>
            {p.marketplace && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border">
                {p.marketplace}
              </span>
            )}
            {p.version && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                v{p.version}
              </span>
            )}
            <ScopeBadge scope={p.scope} />
            {p.enabled === true && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                <CircleDot className="w-3 h-3" />
                {t("plugins.enabled")}
              </span>
            )}
            {p.enabled === false && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/30 inline-flex items-center gap-1">
                <CircleSlash className="w-3 h-3" />
                {t("plugins.disabled")}
              </span>
            )}
            {!p.installPathExists && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {t("plugins.missing")}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{description}</p>
          )}
          {contribCounts.length > 0 && (
            <div className="mt-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                {t("plugins.contributes")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {contribCounts.map((c) => (
                  <span
                    key={c.key}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-3 text-gray-300 border border-border"
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500">
            {meta?.author?.name && (
              <div>
                <span className="text-gray-600">{t("plugins.author")}:</span> {meta.author.name}
              </div>
            )}
            {meta?.license && (
              <div>
                <span className="text-gray-600">{t("plugins.license")}:</span> {meta.license}
              </div>
            )}
            {p.installedAt && (
              <div>
                <span className="text-gray-600">{t("plugins.installedAt")}:</span>{" "}
                {new Date(p.installedAt).toLocaleString()}
              </div>
            )}
            {p.lastUpdated && (
              <div>
                <span className="text-gray-600">{t("plugins.lastUpdated")}:</span>{" "}
                {new Date(p.lastUpdated).toLocaleString()}
              </div>
            )}
            {p.gitCommitSha && (
              <div className="col-span-2">
                <span className="text-gray-600">SHA:</span>{" "}
                <span className="font-mono">{p.gitCommitSha.slice(0, 12)}</span>
              </div>
            )}
            {meta?.homepage && (
              <div className="col-span-2 truncate">
                <span className="text-gray-600">{t("plugins.homepage")}:</span>{" "}
                <a
                  href={meta.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {meta.homepage}
                </a>
              </div>
            )}
          </div>
          {p.installPath && (
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-[10px] text-gray-600 truncate flex-1">
                {p.installPath}
              </span>
              <CopyButton value={p.installPath} />
            </div>
          )}
          <div className="mt-3">
            <CommandSnippet
              command={`claude plugin uninstall ${p.key}`}
              label={t("explain.plugins.uninstall")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MCP servers ───────────────────────────────────────────────────────

/**
 * MCP tab: an explainer with the `claude mcp` commands, then user-level and project-scoped servers
 * in separate sections, filtered by name.
 */
function McpPanel({ data, search }: { data: CcMcpResponse | null; search: string }) {
  const { t } = useTranslation("ccConfig");
  if (!data) return <SkeletonRows n={3} />;
  const all = [...data.user, ...data.projectScoped];
  /**
   * Servers whose name contains the search text.
   *
   * @param arr - Servers to filter.
   * @returns The matching servers.
   */
  const filter = (arr: CcMcpServer[]) =>
    arr.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <ExplainerBanner
        title={t("explain.mcp.title")}
        body={t("explain.mcp.body")}
        howTo={t("explain.mcp.add")}
        commands={[
          { cmd: t("explain.mcp.listCmd"), note: t("explain.mcp.list") },
          { cmd: t("explain.mcp.addCmd"), note: t("explain.mcp.add") },
        ]}
      />
      {all.length === 0 && (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-sm text-gray-500">
          {t("mcp.noServers")}
        </div>
      )}
      {data.user.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {t("mcp.userScope")}
          </h3>
          <div className="space-y-2">
            {filter(data.user).map((s) => (
              <McpCard key={`u:${s.name}:${s.source}`} server={s} />
            ))}
          </div>
        </div>
      )}
      {data.projectScoped.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {t("mcp.projectScope")}
          </h3>
          <div className="space-y-2">
            {filter(data.projectScoped).map((s) => (
              <McpCard key={`p:${s.name}:${s.source}`} server={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Card for one MCP server: name, transport, and the config file it came from, plus the command and
 * args for stdio servers or the URL for HTTP servers. Environment variables and headers are listed
 * by name only, never by value.
 */
function McpCard({ server }: { server: CcMcpServer }) {
  const { t } = useTranslation("ccConfig");
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-sm text-gray-100">{server.name}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border">
          {server.kind}
        </span>
        <span className="text-[10px] text-gray-500 ml-auto truncate max-w-xs">{server.source}</span>
      </div>
      <div className="mt-2 space-y-1 text-[11px]">
        {server.kind === "stdio" && (
          <>
            <Field label={t("mcp.command")}>
              <span className="font-mono text-gray-300">{server.command}</span>
            </Field>
            {server.args && server.args.length > 0 && (
              <Field label={t("mcp.args")}>
                <span className="font-mono text-gray-400">{server.args.join(" ")}</span>
              </Field>
            )}
            {server.envNames && server.envNames.length > 0 && (
              <Field label={t("mcp.env")}>
                <span className="font-mono text-gray-400">{server.envNames.join(", ")}</span>
              </Field>
            )}
          </>
        )}
        {server.kind === "http" && (
          <>
            <Field label={t("mcp.url")}>
              <span className="font-mono text-gray-300">{server.url}</span>
            </Field>
            {server.headers && server.headers.length > 0 && (
              <Field label={t("mcp.headers")}>
                <span className="font-mono text-gray-400">{server.headers.join(", ")}</span>
              </Field>
            )}
          </>
        )}
      </div>
      <div className="mt-3">
        <CommandSnippet
          command={`claude mcp remove ${server.name}`}
          label={t("explain.mcp.remove")}
        />
      </div>
    </div>
  );
}

/** Label/value row used in the MCP and hook cards. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-600 min-w-20">{label}:</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────

/**
 * Hooks tab: an explainer, then each settings layer's hooks grouped by event with matcher, command,
 * and timeout, followed by the scripts found in the hooks directory, each openable in the viewer.
 */
function HooksPanel({
  sources,
  scripts,
  search,
  onOpen,
}: {
  /** Hook configuration per settings layer, or null while loading. */
  sources: CcHookSource[] | null;
  /** Scripts in the hooks directory, or null when not loaded. */
  scripts: CcHookScripts | null;
  /** Search text matched against hook event names. */
  search: string;
  /** Opens a file in the viewer. */
  onOpen: (p: string) => void;
}) {
  const { t } = useTranslation("ccConfig");
  if (!sources) return <SkeletonRows n={3} />;
  return (
    <div className="space-y-4">
      <ExplainerBanner
        title={t("explain.hooks.title")}
        body={t("explain.hooks.body")}
        howTo={t("explain.hooks.howTo")}
        commands={[
          { cmd: t("explain.hooks.cmd1"), note: t("explain.hooks.cmd1Note") },
          { cmd: t("explain.hooks.cmd2"), note: t("explain.hooks.cmd2Note") },
          { cmd: t("explain.hooks.cmd3"), note: t("explain.hooks.cmd3Note") },
        ]}
      />
      {sources.map((src) => {
        const events = Object.entries(src.hooks);
        const filteredEvents = search
          ? events.filter(([event]) => event.toLowerCase().includes(search.toLowerCase()))
          : events;
        return (
          <div key={src.scope} className="rounded-lg border border-border bg-surface-2">
            <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
              <ScopeBadge scope={src.scope} />
              <span className="font-mono text-[11px] text-gray-500 truncate flex-1">
                {src.file}
              </span>
              {src.exists ? (
                <button
                  onClick={() => onOpen(src.file)}
                  className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t("common.viewSource")}
                </button>
              ) : (
                <span className="text-[11px] text-gray-600">{t("hooks.fileMissing")}</span>
              )}
            </div>
            <div className="p-3">
              {filteredEvents.length === 0 ? (
                <div className="text-xs text-gray-500 px-1 py-2">{t("hooks.noHooks")}</div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map(([event, entries]) => (
                    <div key={event}>
                      <div className="text-[11px] font-semibold text-gray-300 mb-1.5 inline-flex items-center gap-2">
                        <Wrench className="w-3 h-3 text-gray-500" />
                        {event}
                        <span className="text-[10px] text-gray-600">({entries.length})</span>
                      </div>
                      <div className="space-y-1.5 pl-5">
                        {entries.map((h, idx) => (
                          <div
                            key={`${event}-${idx}`}
                            className="rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-[11px]"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-gray-500">
                                {t("hooks.matcher")}={h.matcher}
                              </span>
                              <span className="text-[10px] text-gray-600">·</span>
                              <span className="font-mono text-[10px] text-gray-500">{h.type}</span>
                              {h.timeout != null && (
                                <span className="text-[10px] text-gray-600">{h.timeout}ms</span>
                              )}
                            </div>
                            {h.command && (
                              <div className="mt-1 font-mono text-[11px] text-gray-300 break-all">
                                {h.command}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {scripts && scripts.items.length > 0 && (
        <div className="rounded-lg border border-border bg-surface-2">
          <div className="border-b border-border px-4 py-2.5">
            <div className="text-sm font-medium text-gray-100">{t("hookScripts.title")}</div>
            <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
              {t("hookScripts.subtitle")}
            </p>
            <div className="mt-1 font-mono text-[10px] text-gray-600">{scripts.dir}</div>
          </div>
          <div className="p-3 space-y-1.5">
            {scripts.items.map((s) => (
              <button
                key={s.file}
                onClick={() => onOpen(s.file)}
                className="w-full text-left rounded-md border border-border bg-surface-1 hover:bg-surface-3 px-3 py-1.5 inline-flex items-center gap-2"
              >
                <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <span className="font-mono text-[11px] text-gray-200 flex-1 truncate">
                  {s.name}
                </span>
                <span className="text-[10px] text-gray-500">{formatBytes(s.size)}</span>
                <span className="text-[10px] text-gray-600 hidden md:inline">
                  {new Date(s.mtime).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────

/**
 * The settings that the TUI's `/config` editor manages, in display order. Surfaced as a resolved
 * at-a-glance summary so the user sees what `/config` set (model, verbose, theme, and so on)
 * without hunting through the raw JSON files. Keys map 1:1 to settings.json keys per
 * https://code.claude.com/docs/en/settings.
 */
const CONFIG_OPTION_GROUPS: { title: string; keys: { key: string; label: string }[] }[] = [
  {
    title: "Model & reasoning",
    keys: [
      { key: "model", label: "Model" },
      { key: "effortLevel", label: "Effort level" },
      { key: "alwaysThinkingEnabled", label: "Always thinking" },
    ],
  },
  {
    title: "Output & display",
    keys: [
      { key: "outputStyle", label: "Output style" },
      { key: "verbose", label: "Verbose output" },
      { key: "theme", label: "Theme" },
      { key: "language", label: "Language" },
      { key: "spinnerTipsEnabled", label: "Spinner tips" },
      { key: "autoScrollEnabled", label: "Auto-scroll" },
    ],
  },
  {
    title: "Session & input",
    keys: [
      { key: "autoCompactEnabled", label: "Auto-compact" },
      { key: "fileCheckpointingEnabled", label: "File checkpointing" },
      { key: "editorMode", label: "Editor mode" },
      { key: "preferredNotifChannel", label: "Notifications" },
      { key: "awaySummaryEnabled", label: "Away summary" },
    ],
  },
];

/**
 * Resolve each /config option across the settings sources (project-local >
 * project > user precedence - later sources in the array win) and render a
 * compact summary. Unset options show as "default" so the view reflects the
 * effective configuration, not just whatever happens to be written to a file.
 */
function CurrentConfigPanel({ sources }: { sources: CcSettingsSource[] }) {
  // Build effective map: { key → { value, scope } }. Sources arrive ordered
  // user → project → project-local, so a later hit overrides an earlier one.
  const effective = new Map<string, { value: unknown; scope: CcSettingsSource["scope"] }>();
  for (const src of sources) {
    if (!src.exists || !src.data || typeof src.data !== "object") continue;
    const data = src.data as Record<string, unknown>;
    for (const group of CONFIG_OPTION_GROUPS) {
      for (const { key } of group.keys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          effective.set(key, { value: data[key], scope: src.scope });
        }
      }
    }
  }
  const setCount = effective.size;

  return (
    <div className="rounded-lg border border-border bg-surface-2">
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
        <SettingsIcon className="w-3.5 h-3.5 text-violet-300/80" />
        <span className="text-sm font-medium text-gray-100">Current configuration</span>
        <span className="text-[11px] text-gray-500 ml-auto">
          {setCount} option{setCount !== 1 ? "s" : ""} set · the rest use defaults
        </span>
      </div>
      <div className="p-3 space-y-3">
        {CONFIG_OPTION_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              {group.title}
            </div>
            <div className="rounded-md border border-border bg-surface-1 divide-y divide-border">
              {group.keys.map(({ key, label }) => {
                const hit = effective.get(key);
                return (
                  <div
                    key={key}
                    className="px-3 py-1.5 grid grid-cols-[150px_1fr_auto] gap-3 items-center"
                  >
                    <div className="text-[11px] text-gray-300 truncate">{label}</div>
                    <div className="min-w-0">
                      {hit ? (
                        <SettingsValue value={hit.value} />
                      ) : (
                        <span className="text-[10px] text-gray-600 italic">default</span>
                      )}
                    </div>
                    {hit ? (
                      <ScopeBadge scope={hit.scope} />
                    ) : (
                      <span className="text-[10px] text-gray-700">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Settings tab: an explainer, the resolved `/config` summary, the statusline block when configured,
 * and one block per settings layer (user, project, and project-local).
 */
function SettingsPanel({
  sources,
  statusline,
  onOpen,
}: {
  /** Settings layers, or null while loading. */
  sources: CcSettingsSource[] | null;
  /** Statusline configuration, or null when not loaded. */
  statusline: CcStatusline | null;
  /** Opens a file in the viewer. */
  onOpen: (p: string) => void;
}) {
  const { t } = useTranslation("ccConfig");
  if (!sources) return <SkeletonRows n={3} />;
  return (
    <div className="space-y-3">
      <ExplainerBanner
        title={t("explain.settings.title")}
        body={t("explain.settings.body")}
        howTo={t("explain.settings.howTo")}
        commands={[
          { cmd: t("explain.settings.cmd1"), note: t("explain.settings.cmd1Note") },
          { cmd: t("explain.settings.cmd2"), note: t("explain.settings.cmd2Note") },
          { cmd: t("explain.settings.cmd3"), note: t("explain.settings.cmd3Note") },
        ]}
      />
      <CurrentConfigPanel sources={sources} />
      <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/90 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        {t("common.redactedNotice")}
      </div>
      {statusline && (statusline.config || statusline.scripts.length > 0) && (
        <StatuslineBlock data={statusline} onOpen={onOpen} />
      )}
      {sources.map((src) => (
        <SettingsBlock key={src.scope} source={src} onOpen={onOpen} />
      ))}
    </div>
  );
}

/**
 * Statusline section of the Settings tab: the configured statusline type and command, and the
 * statusline scripts found on disk with previews.
 */
function StatuslineBlock({ data, onOpen }: { data: CcStatusline; onOpen: (p: string) => void }) {
  const { t } = useTranslation("ccConfig");
  return (
    <div className="rounded-lg border border-border bg-surface-2">
      <div className="border-b border-border px-4 py-2.5">
        <div className="text-sm font-medium text-gray-100">{t("statusline.title")}</div>
      </div>
      <div className="p-3 space-y-3">
        {data.config ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              {t("statusline.configured")}
            </div>
            <div className="rounded-md border border-border bg-surface-1 px-3 py-2 text-[11px] font-mono text-gray-200">
              <span className="text-gray-500">type:</span> {data.config.type ?? "-"}
              {data.config.command && (
                <>
                  <br />
                  <span className="text-gray-500">command:</span> {data.config.command}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500">{t("statusline.noStatusline")}</div>
        )}
        {data.scripts.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              {t("statusline.scripts")}
            </div>
            <div className="space-y-1.5">
              {data.scripts.map((s) => (
                <button
                  key={s.file}
                  onClick={() => onOpen(s.file)}
                  className="w-full text-left rounded-md border border-border bg-surface-1 hover:bg-surface-3 px-3 py-1.5 inline-flex items-center gap-2"
                >
                  <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <span className="font-mono text-[11px] text-gray-200 flex-1 truncate">
                    {s.file}
                  </span>
                  <span className="text-[10px] text-gray-500">{formatBytes(s.size)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One settings layer: scope badge and file path, then its keys as a readable list, with a toggle to
 * show the raw JSON and a button to open the file. A missing file is shown as such.
 */
function SettingsBlock({
  source,
  onOpen,
}: {
  /** Settings layer to show. */
  source: CcSettingsSource;
  /** Opens the settings file in the viewer. */
  onOpen: (p: string) => void;
}) {
  const { t } = useTranslation("ccConfig");
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-surface-2">
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <ScopeBadge scope={source.scope} />
        <span className="font-mono text-[11px] text-gray-500 truncate flex-1 min-w-0">
          {source.file}
        </span>
        {source.exists ? (
          <>
            <button
              onClick={() => setShowRaw((v) => !v)}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100"
            >
              {showRaw ? "Structured" : "Raw JSON"}
            </button>
            <button
              onClick={() => onOpen(source.file)}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              {t("common.viewSource")}
            </button>
          </>
        ) : (
          <span className="text-[11px] text-gray-600">{t("settings.fileMissing")}</span>
        )}
      </div>
      {source.exists &&
        (showRaw ? (
          <pre className="p-3 text-[11px] font-mono text-gray-300 overflow-auto max-h-96">
            {JSON.stringify(source.data, null, 2)}
          </pre>
        ) : (
          <SettingsKeyValueList data={source.data as Record<string, unknown> | null | undefined} />
        ))}
    </div>
  );
}

/** Render a parsed settings object as a two-column key/value list. */
function SettingsKeyValueList({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data || typeof data !== "object") {
    return <div className="p-3 text-xs text-gray-500">-</div>;
  }
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <div className="p-3 text-xs text-gray-500">{}</div>;
  }
  return (
    <div className="divide-y divide-border">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="px-3 py-2 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-1 md:gap-3 items-start"
        >
          <div className="font-mono text-[11px] text-gray-400 truncate">{k}</div>
          <div className="min-w-0">
            <SettingsValue value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Render one settings value by type: a true/false chip for booleans, monospace text for numbers and
 * strings, and formatted JSON for objects and arrays. `null` and `undefined` show as an italic
 * `null`.
 */
function SettingsValue({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-[11px] text-gray-600 italic">null</span>;
  if (typeof value === "boolean") {
    return (
      <span
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
          value
            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            : "bg-gray-500/10 text-gray-400 border-gray-500/30"
        }`}
      >
        {value ? "true" : "false"}
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="font-mono text-[11px] text-gray-200">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="font-mono text-[11px] text-gray-200 break-all">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[11px] text-gray-600">[]</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, i) => (
          <span
            key={i}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-300 border border-border break-all"
          >
            {typeof item === "object" ? JSON.stringify(item) : String(item)}
          </span>
        ))}
      </div>
    );
  }
  // object
  const obj = value as Record<string, unknown>;
  return (
    <div className="space-y-0.5">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="font-mono text-[11px]">
          <span className="text-gray-500">{k}:</span>{" "}
          <span className="text-gray-200 break-all">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Memory ────────────────────────────────────────────────────────────

/** Props for {@link MemoryPanel}. */
interface MemoryPanelProps {
  /** Memory items, or null while loading. */
  items: CcMemoryItem[] | null;
  /** Search text matched against names, previews, and project slugs. */
  search: string;
  /** Opens a file in the read-only viewer. */
  onOpen: (p: string) => void;
  /** Opens the editor for a `CLAUDE.md`. */
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  /** Asks for confirmation to delete a `CLAUDE.md`. */
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  /** Creates the missing user or project `CLAUDE.md`. */
  onCreate: (scope: "user" | "project") => void;
  /** Opens the editor for an auto-memory file. */
  onEditAuto: (item: CcMemoryItem) => void;
  /** Asks for confirmation to delete an auto-memory file. */
  onDeleteAuto: (item: CcMemoryItem) => void;
  /** Creates a new auto-memory file in a project. */
  onCreateAuto: (project: string) => void;
}

/**
 * Short description for a memory file: its frontmatter `description`, or, when it has none, the
 * start of the body with a leading markdown heading stripped, cut to 200 characters.
 *
 * @param m - Memory item.
 * @returns The description text.
 */
function memoryDescription(m: CcMemoryItem): string {
  return (
    m.frontmatter?.description ||
    m.preview
      .replace(/^#+\s.*\n/, "")
      .trim()
      .slice(0, 200)
  );
}

/**
 * Reduce a markdown link target as written inside `MEMORY.md` (for example
 * `./feedback_x.md#section` or `feedback_x.md`) to the bare file name, so it can be matched against
 * a fact file's `name`. Drops anchors and directories and tolerates URL encoding.
 *
 * @param target - Link target from the index.
 * @returns The bare file name.
 */
function normalizeMemoryTarget(target: string): string {
  let v = target.trim();
  const hash = v.indexOf("#");
  if (hash >= 0) v = v.slice(0, hash);
  try {
    v = decodeURIComponent(v);
  } catch {
    /* leave as-is when not valid percent-encoding */
  }
  const slash = v.lastIndexOf("/");
  if (slash >= 0) v = v.slice(slash + 1);
  return v.trim();
}

/**
 * Render a `MEMORY.md` preview with its `[label](target.md)` markdown links turned into clickable
 * buttons. Everything else is emitted verbatim so the surrounding `<pre>` keeps the original index
 * layout. Clicking a link asks the parent to jump to (scroll to and highlight) the matching fact
 * file.
 *
 * @param preview - Index file text.
 * @param onJump - Called with the raw link target.
 * @param jumpTitle - Tooltip for the link buttons.
 * @returns One node per line.
 */
function renderMemoryIndex(
  preview: string,
  onJump: (target: string) => void,
  jumpTitle: string
): React.ReactNode {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const lines = preview.split("\n");
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    linkRe.lastIndex = 0;
    while ((m = linkRe.exec(line)) !== null) {
      const full = m[0];
      const label = m[1] ?? "";
      const capturedTarget = m[2] ?? "";
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(
        <button
          key={`${li}-${m.index}`}
          type="button"
          onClick={() => onJump(capturedTarget)}
          title={`${jumpTitle}: ${normalizeMemoryTarget(capturedTarget)}`}
          className="text-teal-300 hover:text-teal-200 underline decoration-dotted underline-offset-2 hover:decoration-solid focus:outline-none focus:ring-1 focus:ring-teal-400/60 rounded-sm"
        >
          {label}
        </button>
      );
      last = m.index + full.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <span key={li}>
        {parts.length ? parts : line}
        {li < lines.length - 1 ? "\n" : null}
      </span>
    );
  });
}

/**
 * Memory tab. The top section lists the user and project `CLAUDE.md` files, with create prompts for
 * any that are missing (hidden while searching). Below, auto-memory files are grouped by project,
 * each group collapsible and expanded automatically while a search is active.
 */
function MemoryPanel({
  items,
  search,
  onOpen,
  onEdit,
  onDelete,
  onCreate,
  onEditAuto,
  onDeleteAuto,
  onCreateAuto,
}: MemoryPanelProps) {
  const { t } = useTranslation("ccConfig");

  const q = search.trim().toLowerCase();

  /**
   * Split memory items into the two `CLAUDE.md` files and the auto-memory files, filter both by the
   * search text, group auto-memory files by project, and note which `CLAUDE.md` scopes are missing.
   */
  const { primary, autoFiltered, groups, missingScopes } = useMemo(() => {
    const list = items ?? [];
    const primaryItems = list.filter(
      (m): m is CcMemoryItem & { scope: "user" | "project" } =>
        m.scope === "user" || m.scope === "project"
    );
    const autoItems = list.filter((m) => m.scope === "auto-memory");

    /**
     * Whether an auto-memory file matches the search text (name, project, frontmatter, or preview).
     *
     * @param m - Auto-memory file.
     * @returns True when it matches or there is no search text.
     */
    const matchesAuto = (m: CcMemoryItem) => {
      if (!q) return true;
      const blob = [m.name, m.project, m.frontmatter?.description, m.frontmatter?.name, m.preview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    };

    // Search applies to the whole tab — match the CLAUDE.md cards on their
    // scope label, path, and body too so the filter is consistent.
    const primaryFilteredItems = primaryItems.filter((m) => {
      if (!q) return true;
      return [m.scope, m.file, m.preview].join(" ").toLowerCase().includes(q);
    });

    const filtered = autoItems.filter(matchesAuto);

    // Group surviving auto-memory files by their project dir.
    const byProject = new Map<string, CcMemoryItem[]>();
    for (const m of filtered) {
      const key = m.project || "(unknown)";
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key)!.push(m);
    }
    const grouped = [...byProject.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const present = new Set(primaryItems.map((m) => m.scope));
    const missing = (["user", "project"] as const).filter((s) => !present.has(s));

    return {
      primary: primaryFilteredItems,
      autoFiltered: filtered,
      groups: grouped,
      missingScopes: missing,
    };
  }, [items, q]);

  if (!items) return <SkeletonRows n={2} />;

  const totalAuto = items.filter((m) => m.scope === "auto-memory").length;
  // The "create missing CLAUDE.md" prompts only make sense when not filtering.
  const showMissing = !q;

  return (
    <div className="space-y-3">
      {/* Primary CLAUDE.md memory (user + project) — editable */}
      {primary.map((m) => (
        <div key={m.scope} className="rounded-lg border border-border bg-surface-2">
          <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
            <ScopeBadge scope={m.scope} />
            <span className="font-mono text-[11px] text-gray-500 truncate flex-1 min-w-0">
              {m.file}
            </span>
            <span className="text-[10px] text-gray-600">{formatBytes(m.size)}</span>
            <button
              onClick={() => onOpen(m.file)}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              {t("common.viewSource")}
            </button>
            <button
              onClick={() => onEdit("memory", { scope: m.scope, name: "", filePath: m.file })}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1.5"
            >
              <Pencil className="w-3 h-3" />
              {t("edit.editButton")}
            </button>
            <button
              onClick={() => onDelete("memory", m.scope, undefined, m.file)}
              className="text-[11px] font-medium px-2 py-1 rounded-md border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-300 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              {t("edit.deleteButton")}
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-gray-300 whitespace-pre-wrap break-words max-h-72 overflow-auto">
            {m.preview}
            {m.truncated && (
              <span className="text-gray-600 italic">
                {"\n\n"}
                {t("common.truncated")}
              </span>
            )}
          </pre>
        </div>
      ))}

      {showMissing &&
        missingScopes.map((s) => (
          <div
            key={`missing-${s}`}
            className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <ScopeBadge scope={s} />
              <span className="text-xs text-gray-500">{t("memory.missing")}</span>
            </div>
            <button
              onClick={() => onCreate(s)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent inline-flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              {t("edit.newButton")}
            </button>
          </div>
        ))}

      {/* Per-project file-based memory (~/.claude/projects/<slug>/memory/) */}
      {totalAuto > 0 && (
        <section className="pt-1">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-teal-300" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {t("memory.autoTitle")}
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-surface-3 text-gray-400">
              {q ? `${autoFiltered.length}/${totalAuto}` : totalAuto}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mb-2.5 leading-relaxed">
            {t("memory.autoSubtitle")}
          </p>

          {groups.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-sm text-gray-500">
              {t("memory.noMatches")}
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map(([project, files]) => (
                <MemoryProjectGroup
                  key={project}
                  project={project}
                  files={files}
                  onOpen={onOpen}
                  onEditAuto={onEditAuto}
                  onDeleteAuto={onDeleteAuto}
                  onCreateAuto={onCreateAuto}
                  defaultOpen={!!q || groups.length === 1}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Props for {@link MemoryProjectGroup}. */
interface MemoryProjectGroupProps {
  /** Project slug the group belongs to. */
  project: string;
  /** Auto-memory files in the project. */
  files: CcMemoryItem[];
  /** Opens a file in the read-only viewer. */
  onOpen: (p: string) => void;
  /** Opens the editor for a file. */
  onEditAuto: (item: CcMemoryItem) => void;
  /** Asks for confirmation to delete a file. */
  onDeleteAuto: (item: CcMemoryItem) => void;
  /** Creates a new memory file in this project. */
  onCreateAuto: (project: string) => void;
  /**
   * Initial open state; it is re-applied when it changes, so a search expands groups and clearing
   * it collapses them again.
   */
  defaultOpen: boolean;
}

/**
 * Collapsible group of one project's auto-memory files. Index files (`MEMORY.md`, `INDEX-*.md`)
 * render first with their links clickable; clicking one scrolls to and briefly highlights the
 * matching fact file below.
 */
function MemoryProjectGroup({
  project,
  files,
  onOpen,
  onEditAuto,
  onDeleteAuto,
  onCreateAuto,
  defaultOpen,
}: MemoryProjectGroupProps) {
  const { t } = useTranslation("ccConfig");
  const [open, setOpen] = useState(defaultOpen);
  // Re-sync when the search-driven default flips (expand on search, collapse
  // when cleared). User toggles within a stable search state are preserved.
  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  const indexFiles = files.filter((f) => f.isIndex);
  const factFiles = files.filter((f) => !f.isIndex);

  // Wiring for "click an index entry → jump to its fact file". Fact rows
  // register their DOM node keyed by filename; the index links look them up.
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    []
  );

  /** Key used to find a fact file's row when an index link is clicked. */
  const rowKey = useCallback((m: CcMemoryItem) => m.name || normalizeMemoryTarget(m.file), []);

  /** Scroll to the fact file an index link points at and highlight it for 2.2 seconds. */
  const handleJump = useCallback(
    (target: string) => {
      const name = normalizeMemoryTarget(target);
      const el = rowRefs.current.get(name);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlighted(name);
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setHighlighted(null), 2200);
        return;
      }
      // Target isn't currently in view (e.g. filtered out by search) — open the
      // underlying file directly if we can resolve it within this project.
      const match = files.find((f) => (f.name || normalizeMemoryTarget(f.file)) === name);
      if (match) onOpen(match.file);
    },
    [files, onOpen]
  );

  return (
    <div className="rounded-lg border border-border bg-surface-2 overflow-hidden">
      <div className="flex items-center gap-1 pr-2 hover:bg-surface-3 transition-colors">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2.5 text-left flex-1 min-w-0"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
          <FolderTree className="w-3.5 h-3.5 text-teal-300 flex-shrink-0" />
          <span className="font-mono text-xs text-gray-200 truncate flex-1 min-w-0">{project}</span>
          <span className="text-[10px] text-gray-500 flex-shrink-0">
            {t("memory.fileCount", { count: files.length })}
          </span>
        </button>
        <button
          onClick={() => onCreateAuto(project)}
          title={t("memory.newFile")}
          className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent inline-flex items-center gap-1 flex-shrink-0"
        >
          <Plus className="w-2.5 h-2.5" />
          {t("memory.newFile")}
        </button>
      </div>

      {open && (
        <div className="border-t border-border p-2.5 space-y-2.5">
          {indexFiles.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 px-1">
                {t("memory.indexFiles")}
              </div>
              <div className="space-y-1.5">
                {indexFiles.map((m) => (
                  <MemoryIndexCard
                    key={m.file}
                    item={m}
                    onOpen={onOpen}
                    onEditAuto={onEditAuto}
                    onDeleteAuto={onDeleteAuto}
                    onJump={handleJump}
                  />
                ))}
              </div>
            </div>
          )}
          {factFiles.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 px-1">
                {t("memory.factFiles", { count: factFiles.length })}
              </div>
              <div className="space-y-1">
                {factFiles.map((m) => {
                  const key = rowKey(m);
                  return (
                    <MemoryFactRow
                      key={m.file}
                      item={m}
                      onOpen={onOpen}
                      onEditAuto={onEditAuto}
                      onDeleteAuto={onDeleteAuto}
                      highlighted={highlighted === key}
                      rowRef={(el) => {
                        if (el) rowRefs.current.set(key, el);
                        else rowRefs.current.delete(key);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Props shared by the auto-memory rows and their action buttons. */
interface MemoryAutoItemProps {
  /** Auto-memory file the row shows. */
  item: CcMemoryItem;
  /** Opens the file in the read-only viewer. */
  onOpen: (p: string) => void;
  /** Opens the editor for the file. */
  onEditAuto: (item: CcMemoryItem) => void;
  /** Asks for confirmation to delete the file. */
  onDeleteAuto: (item: CcMemoryItem) => void;
}

/** Compact view, edit, and delete button cluster shared by the index cards and fact rows. */
function MemoryAutoActions({ item, onOpen, onEditAuto, onDeleteAuto }: MemoryAutoItemProps) {
  const { t } = useTranslation("ccConfig");
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={() => onOpen(item.file)}
        title={t("common.viewSource")}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1"
      >
        <ExternalLink className="w-2.5 h-2.5" />
      </button>
      <button
        onClick={() => onEditAuto(item)}
        title={t("edit.editButton")}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-border bg-surface-1 hover:bg-surface-3 text-gray-300 hover:text-gray-100 inline-flex items-center gap-1"
      >
        <Pencil className="w-2.5 h-2.5" />
      </button>
      <button
        onClick={() => onDeleteAuto(item)}
        title={t("edit.deleteButton")}
        className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 text-red-300 inline-flex items-center gap-1"
      >
        <Trash2 className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

/**
 * Card for a memory index file, rendering its preview with clickable links via {@link
 * renderMemoryIndex}.
 */
function MemoryIndexCard({
  item,
  onOpen,
  onEditAuto,
  onDeleteAuto,
  onJump,
}: MemoryAutoItemProps & { onJump: (target: string) => void }) {
  const { t } = useTranslation("ccConfig");
  return (
    <div className="rounded-md border border-teal-500/20 bg-teal-500/5">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-teal-500/15">
        <BookOpen className="w-3 h-3 text-teal-300 flex-shrink-0" />
        <span className="font-mono text-[11px] text-gray-200 truncate flex-1 min-w-0">
          {item.name}
        </span>
        <span className="text-[10px] text-gray-600">{formatBytes(item.size)}</span>
        <MemoryAutoActions
          item={item}
          onOpen={onOpen}
          onEditAuto={onEditAuto}
          onDeleteAuto={onDeleteAuto}
        />
      </div>
      <pre className="px-3 py-2 text-[10.5px] font-mono text-gray-400 whitespace-pre-wrap break-words max-h-40 overflow-auto">
        {renderMemoryIndex(item.preview, onJump, t("memory.jumpTo"))}
        {item.truncated && <span className="text-gray-600 italic">{"\n…"}</span>}
      </pre>
    </div>
  );
}

/**
 * Row for one memory fact file: name, description from {@link memoryDescription}, and size, with
 * actions. Highlighted briefly after a jump from an index link; `rowRef` registers the row so the
 * jump can find it.
 */
function MemoryFactRow({
  item,
  onOpen,
  onEditAuto,
  onDeleteAuto,
  highlighted,
  rowRef,
}: MemoryAutoItemProps & {
  highlighted?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
}) {
  const desc = memoryDescription(item);
  return (
    <div
      ref={rowRef}
      className={`flex items-start gap-2.5 rounded-md border px-3 py-2 transition-colors ${
        highlighted
          ? "border-teal-400/70 bg-teal-500/10 ring-1 ring-teal-400/50"
          : "border-border bg-surface-1 hover:border-border/80"
      }`}
    >
      <FileText className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <span className="font-mono text-[11px] text-gray-200 truncate block">{item.name}</span>
        {desc && (
          <p className="mt-0.5 text-[11px] text-gray-500 leading-snug line-clamp-2">{desc}</p>
        )}
      </div>
      <span className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">
        {formatBytes(item.size)}
      </span>
      <div className="mt-0.5">
        <MemoryAutoActions
          item={item}
          onOpen={onOpen}
          onEditAuto={onEditAuto}
          onDeleteAuto={onDeleteAuto}
        />
      </div>
    </div>
  );
}

// ── Marketplaces ──────────────────────────────────────────────────────

/**
 * Marketplaces tab: an explainer with the add command, the registry file path, and a card per
 * registered marketplace (source, install location, last update, plugin count, and owner), filtered
 * by name.
 */
function MarketplacesPanel({
  data,
  search,
}: {
  /** Registered marketplaces, or null while loading. */
  data: CcMarketplacesResponse | null;
  /** Search text matched against names. */
  search: string;
}) {
  const { t } = useTranslation("ccConfig");
  if (!data) return <SkeletonRows n={3} />;
  const filtered = data.items.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.marketplaceName || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-3">
      <ExplainerBanner
        title={t("explain.plugins.title")}
        body={t("explain.plugins.body")}
        howTo={t("marketplaces.manifest")}
        commands={[{ cmd: t("marketplaces.addCmd"), note: "" }]}
      />
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 flex items-center gap-2 text-[11px] text-gray-500">
        <FileText className="w-3.5 h-3.5" />
        <span className="font-mono truncate">{data.knownPath}</span>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-sm text-gray-500">
          {t("marketplaces.noMarketplaces")}
        </div>
      ) : (
        filtered.map((m) => (
          <div key={m.name} className="rounded-lg border border-border bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Store className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-mono text-sm text-gray-100">{m.name}</span>
              {m.marketplaceName && m.marketplaceName !== m.name && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border">
                  {m.marketplaceName}
                </span>
              )}
              {m.pluginCount != null && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                  {t("marketplaces.pluginCount")}: {m.pluginCount}
                </span>
              )}
            </div>
            {m.marketplaceDescription && (
              <p className="mt-1.5 text-xs text-gray-400 leading-relaxed line-clamp-2">
                {m.marketplaceDescription}
              </p>
            )}
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500">
              {m.source && (
                <div className="col-span-2 truncate">
                  <span className="text-gray-600">{t("marketplaces.source")}:</span>{" "}
                  <span className="font-mono">
                    {m.source.source === "github" && m.source.repo
                      ? `github.com/${m.source.repo}`
                      : m.source.url || m.source.repo || JSON.stringify(m.source)}
                  </span>
                </div>
              )}
              {m.marketplaceOwner?.name && (
                <div>
                  <span className="text-gray-600">{t("marketplaces.owner")}:</span>{" "}
                  {m.marketplaceOwner.name}
                </div>
              )}
              {m.lastUpdated && (
                <div>
                  <span className="text-gray-600">{t("marketplaces.lastUpdated")}:</span>{" "}
                  {new Date(m.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
            {m.installLocation && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-600 truncate flex-1">
                  {m.installLocation}
                </span>
                <CopyButton value={m.installLocation} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Keybindings ───────────────────────────────────────────────────────

/**
 * Keybindings tab: read-only view of the bindings grouped by context, with an inline editor. Edits
 * work on a deep copy, are validated locally the same way the server validates them, and are saved
 * through `api.ccConfig.writeKeybindings`, which backs up the file first.
 */
function KeybindingsPanel({
  data,
  search,
  onSaved,
  onToast,
}: {
  /** Parsed keybindings, or null while loading. */
  data: CcKeybindings | null;
  /** Search text matched against contexts, keys, and actions. */
  search: string;
  /** Called after a successful save, to refetch. */
  onSaved: () => void;
  /** Shows a toast. */
  onToast: (toast: NonNullable<Toast>) => void;
}) {
  const { t } = useTranslation("ccConfig");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CcKeybindingGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Enter edit mode with a deep copy of the bindings, so edits never touch the fetched data. */
  const startEdit = useCallback(() => {
    const groups = data?.groups ?? [];
    // Deep clone so edits never mutate the fetched data.
    setDraft(
      groups.map((g) => ({ context: g.context, bindings: g.bindings.map((b) => ({ ...b })) }))
    );
    setErr(null);
    setEditing(true);
  }, [data]);

  /** Leave edit mode and discard the draft. */
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setDraft([]);
    setErr(null);
  }, []);

  /**
   * Rename a context in the draft.
   *
   * @param gi - Index of the context.
   * @param value - New context name.
   */
  const updateContext = (gi: number, value: string) =>
    setDraft((d) => d.map((g, i) => (i === gi ? { ...g, context: value } : g)));
  /**
   * Remove a context and its bindings from the draft.
   *
   * @param gi - Index of the context.
   */
  const removeContext = (gi: number) => setDraft((d) => d.filter((_, i) => i !== gi));
  /** Add an empty context with one empty binding. */
  const addContext = () =>
    setDraft((d) => [...d, { context: "", bindings: [{ key: "", action: "" }] }]);
  /**
   * Change a binding's key or action in the draft.
   *
   * @param gi - Index of the context.
   * @param bi - Index of the binding.
   * @param field - Field to change.
   * @param value - New value.
   */
  const updateBinding = (gi: number, bi: number, field: "key" | "action", value: string) =>
    setDraft((d) =>
      d.map((g, i) =>
        i === gi
          ? { ...g, bindings: g.bindings.map((b, j) => (j === bi ? { ...b, [field]: value } : b)) }
          : g
      )
    );
  /**
   * Remove one binding from the draft.
   *
   * @param gi - Index of the context.
   * @param bi - Index of the binding.
   */
  const removeBinding = (gi: number, bi: number) =>
    setDraft((d) =>
      d.map((g, i) => (i === gi ? { ...g, bindings: g.bindings.filter((_, j) => j !== bi) } : g))
    );
  /**
   * Add an empty binding to a context.
   *
   * @param gi - Index of the context.
   */
  const addBinding = (gi: number) =>
    setDraft((d) =>
      d.map((g, i) => (i === gi ? { ...g, bindings: [...g.bindings, { key: "", action: "" }] } : g))
    );

  /**
   * Validate and save the draft. Mirrors the server's checks for instant feedback: every context
   * needs a name, contexts must be unique, and each binding needs a key and action with no
   * duplicate keys within a context.
   */
  const handleSave = useCallback(async () => {
    const groups: CcKeybindingGroup[] = draft.map((g) => ({
      context: g.context.trim(),
      bindings: g.bindings.map((b) => ({ key: b.key.trim(), action: b.action.trim() })),
    }));
    // Mirror the server-side validation so users get instant, local feedback.
    const seen = new Set<string>();
    for (const g of groups) {
      if (!g.context) return setErr(t("keybindings.errContext"));
      if (seen.has(g.context))
        return setErr(t("keybindings.errDupContext", { context: g.context }));
      seen.add(g.context);
      const keys = new Set<string>();
      for (const b of g.bindings) {
        if (!b.key || !b.action) return setErr(t("keybindings.errEmpty", { context: g.context }));
        if (keys.has(b.key))
          return setErr(t("keybindings.errDupKey", { key: b.key, context: g.context }));
        keys.add(b.key);
      }
    }
    setSaving(true);
    setErr(null);
    try {
      const result = await api.ccConfig.writeKeybindings(groups);
      onToast({
        kind: "success",
        message: result.created
          ? t("edit.saveSuccessNew")
          : t("edit.saveSuccess", { path: result.backupPath || "-" }),
      });
      setEditing(false);
      setDraft([]);
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown error";
      setErr(msg);
      onToast({ kind: "error", message: t("edit.writeError", { message: msg }) });
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved, onToast, t]);

  if (!data) return <SkeletonRows n={3} />;

  const headerBar = (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
      <FileText className="w-3.5 h-3.5" />
      <span className="font-mono truncate flex-1 min-w-0">{data.file}</span>
      {data.docs && (
        <a
          href={data.docs}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          {t("keybindings.docsLink")}
        </a>
      )}
      {editing ? (
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="h-7 text-[11px] font-medium px-2.5 rounded-md border border-border bg-surface-3 hover:bg-surface-1 text-gray-300 disabled:opacity-50"
          >
            {t("edit.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-[11px] font-medium px-2.5 rounded-md border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            {saving ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="h-7 text-[11px] font-medium px-2.5 rounded-md border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent inline-flex items-center gap-1.5"
        >
          <Pencil className="w-3 h-3" />
          {t("edit.editButton")}
        </button>
      )}
    </div>
  );

  // ── Edit mode ────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-3">
        {headerBar}
        {err && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{err}</span>
          </div>
        )}
        {draft.map((g, gi) => (
          <div key={gi} className="rounded-lg border border-border bg-surface-2">
            <div className="border-b border-border px-3 py-2 flex items-center gap-2">
              <span className="text-[11px] text-gray-500 flex-shrink-0">
                {t("keybindings.context")}
              </span>
              <input
                value={g.context}
                onChange={(e) => updateContext(gi, e.target.value)}
                placeholder={t("keybindings.contextPlaceholder")}
                className="h-7 flex-1 min-w-0 bg-surface-1 border border-border rounded px-2 text-[11px] font-mono text-gray-100 focus:outline-none focus:ring-1 focus:ring-accent/40"
              />
              <button
                type="button"
                onClick={() => removeContext(gi)}
                title={t("keybindings.removeContext")}
                aria-label={t("keybindings.removeContext")}
                className="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-border">
              {g.bindings.map((b, bi) => (
                <div key={bi} className="px-3 py-1.5 flex items-center gap-2">
                  <input
                    value={b.key}
                    onChange={(e) => updateBinding(gi, bi, "key", e.target.value)}
                    placeholder={t("keybindings.key")}
                    className="h-7 w-40 flex-shrink-0 bg-surface-1 border border-border rounded px-2 text-[11px] font-mono text-gray-100 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <span className="text-gray-600 flex-shrink-0">→</span>
                  <input
                    value={b.action}
                    onChange={(e) => updateBinding(gi, bi, "action", e.target.value)}
                    placeholder={t("keybindings.action")}
                    className="h-7 flex-1 min-w-0 bg-surface-1 border border-border rounded px-2 text-[11px] font-mono text-gray-100 focus:outline-none focus:ring-1 focus:ring-accent/40"
                  />
                  <button
                    type="button"
                    onClick={() => removeBinding(gi, bi)}
                    title={t("keybindings.removeBinding")}
                    aria-label={t("keybindings.removeBinding")}
                    className="h-7 w-7 flex-shrink-0 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => addBinding(gi)}
                  className="h-7 text-[11px] font-medium px-2.5 rounded-md border border-border bg-surface-3 hover:bg-surface-1 text-gray-300 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3 h-3" />
                  {t("keybindings.addBinding")}
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addContext}
          className="h-8 w-full text-[11px] font-medium rounded-md border border-dashed border-border bg-surface-2 hover:bg-surface-3 text-gray-400 inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3 h-3" />
          {t("keybindings.addContext")}
        </button>
      </div>
    );
  }

  // ── Read-only mode ───────────────────────────────────────────────────
  if (!data.exists) {
    return (
      <div className="space-y-3">
        {headerBar}
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-sm text-gray-500">
          {t("keybindings.missing", { path: data.file })}
        </div>
      </div>
    );
  }
  const q = search.toLowerCase();
  return (
    <div className="space-y-3">
      {headerBar}
      {data.groups.map((g) => {
        const filtered = g.bindings.filter(
          (b) =>
            !q ||
            b.key.toLowerCase().includes(q) ||
            b.action.toLowerCase().includes(q) ||
            g.context.toLowerCase().includes(q)
        );
        if (filtered.length === 0) return null;
        return (
          <div key={g.context} className="rounded-lg border border-border bg-surface-2">
            <div className="border-b border-border px-4 py-2 text-xs font-medium text-gray-300">
              {t("keybindings.context")}: <span className="text-gray-100">{g.context}</span>
              <span className="ml-2 text-[10px] text-gray-600">({filtered.length})</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((b) => (
                <div key={b.key} className="px-4 py-1.5 flex items-center gap-3">
                  <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-3 border border-border text-gray-200 min-w-20 text-center">
                    {b.key}
                  </kbd>
                  <span className="font-mono text-[11px] text-gray-400">{b.action}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────

/**
 * Color-coded scope badge: sky for user, emerald for project, violet for project-local, and neutral
 * for anything else (shown as-is).
 */
function ScopeBadge({ scope }: { scope: string }) {
  const { t } = useTranslation("ccConfig");
  const color =
    scope === "user"
      ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
      : scope === "project"
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        : scope === "project-local"
          ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
          : "bg-surface-3 text-gray-400 border-border";
  const label =
    scope === "project-local"
      ? t("scope.projectLocal")
      : scope === "user"
        ? t("scope.user")
        : scope === "project"
          ? t("scope.project")
          : scope;
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${color}`}>{label}</span>
  );
}

/**
 * Icon button that copies a value (usually a path) to the clipboard and shows a check for 1.5
 * seconds. Does nothing when the clipboard is unavailable.
 */
function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation("ccConfig");
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="text-[10px] font-medium px-1.5 py-1 rounded border border-border bg-surface-1 hover:bg-surface-3 text-gray-400 hover:text-gray-200 inline-flex items-center gap-1 flex-shrink-0"
      title={t("common.copyPath")}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/** Empty state shown when a list has no matching items. */
function Empty() {
  const { t } = useTranslation("ccConfig");
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-gray-500">
      {t("common.empty")}
    </div>
  );
}

/**
 * Pulsing placeholder rows shown while a tab's data loads.
 *
 * @param props.n - Number of rows.
 */
function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg border border-border bg-surface-2 animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Human-readable file size in B, KB, or MB with one decimal.
 *
 * @param bytes - Size in bytes.
 * @returns The formatted size.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── File viewer modal ─────────────────────────────────────────────────

/**
 * Read-only modal showing one file's contents, with its path, size, a truncation notice, and a
 * copy-path button. Closes on Escape or a backdrop click.
 */
function FileViewer({
  state,
  onClose,
}: {
  /** File path plus its loaded contents or load error. */
  state: { path: string; data: CcFileResponse | null; error: string | null };
  /** Closes the viewer. */
  onClose: () => void;
}) {
  const { t } = useTranslation("ccConfig");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[85vh] rounded-xl border border-border bg-surface-1 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="font-mono text-[12px] text-gray-300 truncate flex-1">{state.path}</span>
          <CopyButton value={state.path} />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-md hover:bg-surface-3"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-auto p-4">
          {state.error ? (
            <div className="text-sm text-red-300 inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {state.error}
            </div>
          ) : !state.data ? (
            <div className="text-sm text-gray-500">…</div>
          ) : (
            <pre className="text-[11px] font-mono text-gray-200 whitespace-pre-wrap break-words">
              {state.data.text}
              {state.data.truncated && (
                <span className="text-gray-500 italic">
                  {"\n\n"}
                  {t("common.truncated")}
                </span>
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Editor modal (create + edit) ──────────────────────────────────────

/** Props for {@link EditorModal}. */
interface EditorModalProps {
  /** What to create or edit. */
  state: NonNullable<EditorState>;
  /** Closes the modal without saving. */
  onClose: () => void;
  /**
   * Persists the content. Receives the artifact type, the target scope, the name (for creates), the
   * content, and the project for auto-memory files.
   */
  onSave: (args: {
    type: CcArtifactType;
    targetScope: "user" | "project" | "auto-memory";
    name: string | undefined;
    content: string;
    project?: string;
  }) => Promise<void>;
}

/**
 * Modal editor for creating or editing an artifact. Edit mode loads the current file first; create
 * mode starts from a template and asks for a name and a target scope (auto-memory files get a `.md`
 * extension when the user omits one). Save errors are shown inline, and Escape closes it.
 */
function EditorModal({ state, onClose, onSave }: EditorModalProps) {
  const { t } = useTranslation("ccConfig");
  const isCreate = state.mode === "create";
  const isAutoMemory = state.type === "auto-memory";
  const [content, setContent] = useState<string>(isCreate ? state.template : "");
  const [name, setName] = useState<string>("");
  const [targetScope, setTargetScope] = useState<"user" | "project">(
    isCreate ? state.defaultScope : state.scope === "auto-memory" ? "user" : state.scope
  );
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For edit mode, fetch the actual file content
  useEffect(() => {
    if (state.mode === "edit") {
      setLoading(true);
      api.ccConfig
        .file(state.filePath)
        .then((r) => {
          setContent(r.text);
          setLoading(false);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "unknown";
          setError(msg);
          setLoading(false);
        });
    }
  }, [state]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Save the editor contents. Creating a non-memory artifact requires a name; errors are shown
   * inline.
   */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (state.type !== "memory" && state.mode === "create" && !name) {
        setError(t("edit.nameLabel"));
        setSaving(false);
        return;
      }
      // For auto-memory creates, append a .md extension when the user omits it.
      const createName = isAutoMemory && !/\.md$/i.test(name) ? `${name}.md` : name;
      const effectiveName =
        state.mode === "edit" ? state.name : state.type === "memory" ? undefined : createName;
      await onSave({
        type: state.type,
        targetScope: isAutoMemory ? "auto-memory" : targetScope,
        name: effectiveName,
        content,
        project: state.project,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      setError(t("edit.writeError", { message: msg }));
    } finally {
      setSaving(false);
    }
  }, [state, targetScope, name, content, isAutoMemory, onSave, t]);

  const titleText = isCreate
    ? isAutoMemory
      ? t("memory.newFileTitle", { project: state.project ?? "" })
      : t("edit.newTitle", { type: state.type })
    : t("edit.editTitle", { name: state.mode === "edit" ? state.name : "" });

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-xl border border-border bg-surface-1 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Pencil className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-100 flex-1 truncate">{titleText}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-md hover:bg-surface-3"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto p-4 space-y-3">
          {isCreate && state.type !== "memory" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  {t("edit.nameLabel")}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isAutoMemory ? t("memory.namePlaceholder") : t("edit.namePlaceholder")
                  }
                  pattern={isAutoMemory ? undefined : "[A-Za-z0-9][A-Za-z0-9._-]{0,63}"}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-1.5 text-sm font-mono text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  {isAutoMemory ? t("memory.nameHelp") : t("edit.nameHelp")}
                </p>
              </div>
              {isAutoMemory ? (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    {t("memory.projectLabel")}
                  </label>
                  <div className="rounded-md border border-border bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-gray-300 truncate">
                    {state.project}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">{t("memory.projectHelp")}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    {t("edit.scopePicker")}
                  </label>
                  <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
                    {(["user", "project"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setTargetScope(s)}
                        className={`px-3 py-1 text-[11px] font-medium rounded ${
                          targetScope === s
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        {t(`scope.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              {t("edit.contentLabel")}
            </label>
            {loading ? (
              <div className="h-72 rounded-md border border-border bg-surface-2 animate-pulse" />
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="w-full h-72 bg-surface-2 border border-border rounded-md px-3 py-2 text-[11px] font-mono text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 resize-y"
              />
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 inline-flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-border bg-surface-2 hover:bg-surface-3 text-gray-300"
          >
            {t("edit.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? t("edit.saving") : t("edit.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm-delete modal ──────────────────────────────────────────────

/** Props for {@link ConfirmDeleteModal}. */
interface ConfirmDeleteModalProps {
  /** Artifact to delete. */
  state: NonNullable<ConfirmDeleteState>;
  /** Closes the dialog without deleting. */
  onCancel: () => void;
  /** Performs the delete; the dialog stays busy until it settles. */
  onConfirm: () => Promise<void>;
}

/**
 * Confirmation dialog for deleting an artifact. Names the file and notes that a backup is taken
 * first. Escape cancels, and the confirm button stays disabled while the delete is in flight.
 */
function ConfirmDeleteModal({ state, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  const { t } = useTranslation("ccConfig");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  /** Run the delete, keeping the dialog busy until it settles. */
  const handleConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [onConfirm]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-red-500/40 bg-surface-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-2.5 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-300" />
          <span className="text-sm font-medium text-gray-100 flex-1">
            {t("edit.confirmDelete")}
          </span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">{t("edit.confirmDeleteBody")}</p>
          <div className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[11px] text-gray-300 break-all">
            {t("edit.confirmDeletePath", { path: state.path })}
          </div>
        </div>
        <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-border bg-surface-2 hover:bg-surface-3 text-gray-300 disabled:opacity-60"
          >
            {t("edit.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-red-500/50 bg-red-500/15 hover:bg-red-500/25 text-red-200 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {busy ? t("edit.deleting") : t("edit.confirmDeleteAction")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast (5s auto-dismiss) ───────────────────────────────────────────

/** Bottom-right toast for a success or error message, with a dismiss button. */
function ToastNotice({ toast, onDismiss }: { toast: NonNullable<Toast>; onDismiss: () => void }) {
  const isErr = toast.kind === "error";
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md">
      <div
        className={`rounded-lg border px-3 py-2 shadow-lg flex items-start gap-2 ${
          isErr
            ? "border-red-500/50 bg-red-500/15 text-red-100"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
        }`}
      >
        {isErr ? (
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        ) : (
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
        )}
        <span className="text-xs leading-relaxed flex-1 break-all">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="text-current/70 hover:text-current p-0.5"
          aria-label="dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Read-only explainer banner ─────────────────────────────────────────

/** Props for {@link ExplainerBanner}. */
interface ExplainerBannerProps {
  /** Banner heading. */
  title: string;
  /** Explanation of why the section is read-only here and where it is managed. */
  body: string;
  /** Heading above the command list. */
  howTo: string;
  /** CLI commands to manage the section, each with an optional note. */
  commands: { cmd: string; note: string }[];
}

/**
 * Amber banner on read-only tabs explaining that the section is managed by the Claude Code CLI,
 * with copyable commands for doing it.
 */
function ExplainerBanner({ title, body, howTo, commands }: ExplainerBannerProps) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] px-4 py-3">
      <div className="flex items-start gap-2">
        <Lock className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-sm font-medium text-amber-100">{title}</div>
          <p className="text-xs text-gray-400 leading-relaxed">{body}</p>
          {commands.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                {howTo}
              </div>
              <div className="space-y-1.5">
                {commands.map((c, i) => (
                  <CommandSnippet key={i} command={c.cmd} label={c.note} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline copyable command ────────────────────────────────────────────

/** One copyable shell command with an optional note. Copy feedback lasts 1.5 seconds. */
function CommandSnippet({ command, label }: { command: string; label?: string }) {
  const { t } = useTranslation("ccConfig");
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 flex items-center gap-2">
      <Terminal className="w-3 h-3 text-gray-500 flex-shrink-0" />
      <code className="font-mono text-[11px] text-gray-200 truncate flex-1">{command}</code>
      {label && (
        <span className="text-[10px] text-gray-500 hidden md:inline truncate">{label}</span>
      )}
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="text-[10px] font-medium px-1.5 py-1 rounded border border-border bg-surface-1 hover:bg-surface-3 text-gray-400 hover:text-gray-200 inline-flex items-center gap-1 flex-shrink-0"
        title={t("snippet.copy")}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        <span>{copied ? t("snippet.copied") : t("snippet.copy")}</span>
      </button>
    </div>
  );
}

// ── Backups modal ──────────────────────────────────────────────────────

/**
 * Modal listing every backup the explorer has written before a write or delete. Each row shows a
 * copyable restore command; nothing is restored automatically. Closes on Escape.
 */
function BackupsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("ccConfig");
  const [items, setItems] = useState<CcBackup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.ccConfig
      .backups()
      .then((r) => setItems(r.items))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "unknown"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] rounded-xl border border-border bg-surface-1 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <History className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-100 flex-1">{t("backups.title")}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-md hover:bg-surface-3"
            aria-label={t("common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[11px] text-gray-500 leading-relaxed">{t("backups.subtitle")}</p>
        </div>
        <div className="overflow-auto p-4 space-y-2">
          {error && (
            <div className="text-sm text-red-300 inline-flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {items === null && !error && <SkeletonRows n={4} />}
          {items !== null && items.length === 0 && (
            <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-gray-500">
              {t("backups.empty")}
            </div>
          )}
          {items?.map((b) => (
            <BackupRow key={b.backupPath} backup={b} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One backup: scope, type, name, time, size, the backup path, and a copyable `mv` command that
 * restores it. Restore is deliberately left to the user so the dashboard never silently overwrites
 * the current version.
 */
function BackupRow({ backup }: { backup: CcBackup }) {
  const { t } = useTranslation("ccConfig");
  // Heuristic restore: rename the backup back to the active path. We don't
  // shell out from the dashboard for this (too risky to silently overwrite
  // a current active version) - show the user a copyable mv command instead.
  const restoreCmd = `mv ${shellEscape(backup.backupPath)} ${shellEscape(deriveActivePath(backup))}`;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <ScopeBadge scope={backup.scope} />
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border">
          {backup.type}
        </span>
        <span className="font-mono text-xs text-gray-100 truncate flex-1 min-w-0">
          {backup.name}
        </span>
        <span className="text-[10px] text-gray-500">{new Date(backup.mtime).toLocaleString()}</span>
        {backup.size != null && (
          <span className="text-[10px] text-gray-600">{formatBytes(backup.size)}</span>
        )}
      </div>
      <div className="mt-1.5 font-mono text-[10px] text-gray-600 truncate">{backup.backupPath}</div>
      <div className="mt-2">
        <div className="text-[10px] text-gray-500 mb-1">{t("backups.restoreHint")}</div>
        <CommandSnippet command={restoreCmd} />
      </div>
    </div>
  );
}

/**
 * Best-effort guess at the path a backup would restore to, for the restore command. Strips the
 * trailing `.<timestamp>.bak` from the backup's name and maps the backup directory back to its
 * active location: `<root>/cc-config-backups/<type>/` maps to `<root>/<type>/`, and the `memory`
 * and `auto-memory` backup directories map to their parent directory. Returns the placeholder
 * `<active path>` when the layout is not recognized; the user can still copy the backup path
 * itself.
 *
 * @param b - Backup entry.
 * @returns The active path, or `<active path>`.
 */
function deriveActivePath(b: CcBackup): string {
  // Strip ".<ISO>.bak" suffix from the basename.
  const m = b.name.match(/^(.+?)\.[^.]+\.bak$/);
  const baseName = m ? m[1] : b.name;
  const backupDir = b.backupPath.replace(/\/[^/]+$/, ""); // dirname
  // Backups live at <root>/cc-config-backups/<type>/<name>.<ts>.bak
  // Active lives at <root>/<type>/<baseName> (or .../skills/<baseName>/SKILL.md handled at use-time)
  const rootMatch = backupDir.match(/^(.*)\/cc-config-backups\/([^/]+)$/);
  if (rootMatch) {
    const root = rootMatch[1];
    const type = rootMatch[2];
    return `${root}/${type}/${baseName}`;
  }
  // memory backups live at <projectRoot>/.cc-config-backups/memory/<name>.<ts>.bak
  const memMatch = backupDir.match(/^(.*)\/\.cc-config-backups\/memory$/);
  if (memMatch) return `${memMatch[1]}/${baseName}`;
  // auto-memory backups live at <memoryDir>/.cc-config-backups/auto-memory/<name>.<ts>.bak
  const autoMatch = backupDir.match(/^(.*)\/\.cc-config-backups\/auto-memory$/);
  if (autoMatch) return `${autoMatch[1]}/${baseName}`;
  return "<active path>";
}

/**
 * Quote a string for POSIX shells: returned as-is when it only contains safe path characters,
 * otherwise wrapped in single quotes with embedded single quotes escaped.
 *
 * @param s - String to quote.
 * @returns A shell-safe word.
 */
function shellEscape(s: string): string {
  if (/^[A-Za-z0-9_/.@:=+,-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
