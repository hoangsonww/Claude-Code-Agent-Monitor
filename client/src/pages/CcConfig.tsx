/**
 * @file CcConfig.tsx
 * @description Claude Code configuration explorer. Surfaces every plugin,
 * skill, subagent, slash command, MCP server, hook, settings file, memory
 * file, marketplace, keybinding, and statusline script Claude Code knows
 * about. Read access for all surfaces; create / edit / delete for the
 * low-risk text-file surfaces (skills, agents, commands, output styles,
 * CLAUDE.md memory, and per-project file-based memory files). Plugins, MCP,
 * hooks-in-settings, and settings.json files stay read-only - those have
 * concurrent-write races with the live CLI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
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
import type {
  CcArtifactType,
  CcBackup,
  CcFileResponse,
  CcHookScripts,
  CcHookSource,
  CcKeybindings,
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

function tabToArtifactType(
  tab: "skills" | "agents" | "commands" | "outputStyles" | "memory"
): CcArtifactType {
  return tab === "outputStyles" ? "output-styles" : tab;
}

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

interface TabDef {
  key: TabKey;
  icon: typeof Sparkles;
  i18nKey: string;
}

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

interface PageState {
  overview: CcOverview | null;
  skills: CcMdItem[] | null;
  agents: CcMdItem[] | null;
  commands: CcMdItem[] | null;
  outputStyles: CcMdItem[] | null;
  plugins: CcPluginsResponse | null;
  marketplaces: CcMarketplacesResponse | null;
  mcp: CcMcpResponse | null;
  hooks: CcHookSource[] | null;
  keybindings: CcKeybindings | null;
  settings: CcSettingsSource[] | null;
  memory: CcMemoryItem[] | null;
  statusline: CcStatusline | null;
  hookScripts: CcHookScripts | null;
}

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

type ConfirmDeleteState = {
  type: CcArtifactType;
  scope: "user" | "project" | "auto-memory";
  name?: string;
  path: string;
  project?: string; // set for type === "auto-memory"
} | null;

type Toast = { kind: "success" | "error"; message: string } | null;

export function CcConfig() {
  const { t } = useTranslation("ccConfig");
  const [tab, setTab] = useState<TabKey>("overview");
  const [scope, setScope] = useState<CcScope>("all");
  const [data, setData] = useState<PageState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
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

  const handleSave = useCallback(
    async (args: {
      type: CcArtifactType;
      targetScope: "user" | "project" | "auto-memory";
      name: string | undefined;
      content: string;
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
        loading={loading}
        lastUpdated={lastUpdated}
        scope={scope}
        onScopeChange={setScope}
        onRefresh={fetchAll}
        onOpenBackups={() => setBackupsOpen(true)}
        wsConnected={wsConnected}
      />

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="bg-transparent text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none flex-1"
            />
            {isMutable(tab) && tab !== "memory" && (
              <button
                onClick={() => openCreate(tabToArtifactType(tab))}
                className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-accent/30 bg-accent/10 hover:bg-accent/20 text-accent inline-flex items-center gap-1.5"
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
            onOpenFile={openViewer}
            onEdit={openEdit}
            onDelete={openDelete}
            onCreateMemory={(s) => openCreate("memory", s)}
            onEditAuto={openEditAuto}
            onDeleteAuto={openDeleteAuto}
            onCreateAuto={openCreateAuto}
          />
        </div>
      </div>

      {viewer && <FileViewer state={viewer} onClose={() => setViewer(null)} />}
      {editor && <EditorModal state={editor} onClose={() => setEditor(null)} onSave={handleSave} />}
      {confirmDelete && (
        <ConfirmDeleteModal
          state={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
      {toast && <ToastNotice toast={toast} onDismiss={() => setToast(null)} />}
      {backupsOpen && <BackupsModal onClose={() => setBackupsOpen(false)} />}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────

interface HeaderProps {
  loading: boolean;
  lastUpdated: Date | null;
  scope: CcScope;
  onScopeChange: (s: CcScope) => void;
  onRefresh: () => void;
  onOpenBackups: () => void;
  wsConnected: boolean;
}

function Header({
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
    ? lastUpdated.toLocaleTimeString(undefined, {
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
          </div>
          <p className="text-xs text-gray-500 max-w-2xl">{t("subtitle")}</p>
        </div>
      </div>
      <div className="flex flex-col items-stretch lg:items-end gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <ScopeToggle value={scope} onChange={onScopeChange} />
          <button
            onClick={onOpenBackups}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-3 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            {t("backups.openButton")}
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-surface-3 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? t("refreshing") : t("refresh")}
          </button>
        </div>
        {lastUpdated && (
          <span className="text-[11px] text-gray-500 self-end">
            {t("lastUpdated", { time: formatted })}
          </span>
        )}
      </div>
    </header>
  );
}

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

interface TabsProps {
  current: TabKey;
  onSelect: (k: TabKey) => void;
  counts?: CcOverview["counts"];
}

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

  const scrollByButton = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.6), behavior: "smooth" });
  };

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

interface TabPanelProps {
  tab: TabKey;
  data: PageState;
  search: string;
  onOpenFile: (path: string) => void;
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  onCreateMemory: (scope: "user" | "project") => void;
  onEditAuto: (item: CcMemoryItem) => void;
  onDeleteAuto: (item: CcMemoryItem) => void;
  onCreateAuto: (project: string) => void;
}

function TabPanel({
  tab,
  data,
  search,
  onOpenFile,
  onEdit,
  onDelete,
  onCreateMemory,
  onEditAuto,
  onDeleteAuto,
  onCreateAuto,
}: TabPanelProps) {
  switch (tab) {
    case "overview":
      return <OverviewPanel overview={data.overview} />;
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
      return <KeybindingsPanel data={data.keybindings} search={search} />;
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

// Tone palette - each tone is { iconBg, iconText, border, accentBar }.
// Used by both root rows and summary stat tiles for a consistent color story.
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
const TONES: Record<Tone, { iconBg: string; iconText: string; bar: string; ring: string }> = {
  sky: {
    iconBg: "bg-sky-500/10",
    iconText: "text-sky-300",
    bar: "bg-sky-500/40",
    ring: "ring-sky-500/20",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-300",
    bar: "bg-emerald-500/40",
    ring: "ring-emerald-500/20",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-300",
    bar: "bg-violet-500/40",
    ring: "ring-violet-500/20",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-300",
    bar: "bg-amber-500/40",
    ring: "ring-amber-500/20",
  },
  fuchsia: {
    iconBg: "bg-fuchsia-500/10",
    iconText: "text-fuchsia-300",
    bar: "bg-fuchsia-500/40",
    ring: "ring-fuchsia-500/20",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-300",
    bar: "bg-cyan-500/40",
    ring: "ring-cyan-500/20",
  },
  pink: {
    iconBg: "bg-pink-500/10",
    iconText: "text-pink-300",
    bar: "bg-pink-500/40",
    ring: "ring-pink-500/20",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-300",
    bar: "bg-indigo-500/40",
    ring: "ring-indigo-500/20",
  },
  orange: {
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-300",
    bar: "bg-orange-500/40",
    ring: "ring-orange-500/20",
  },
  teal: {
    iconBg: "bg-teal-500/10",
    iconText: "text-teal-300",
    bar: "bg-teal-500/40",
    ring: "ring-teal-500/20",
  },
  slate: {
    iconBg: "bg-slate-500/10",
    iconText: "text-slate-300",
    bar: "bg-slate-500/40",
    ring: "ring-slate-500/20",
  },
  rose: {
    iconBg: "bg-rose-500/10",
    iconText: "text-rose-300",
    bar: "bg-rose-500/40",
    ring: "ring-rose-500/20",
  },
};

function OverviewPanel({ overview }: { overview: CcOverview | null }) {
  const { t } = useTranslation("ccConfig");
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
            user={counts.skills.user}
            project={counts.skills.project}
          />
          <SummaryStat
            tone="sky"
            icon={UserRound}
            label={t("tabs.agents")}
            user={counts.agents.user}
            project={counts.agents.project}
          />
          <SummaryStat
            tone="cyan"
            icon={Slash}
            label={t("tabs.commands")}
            user={counts.commands.user}
            project={counts.commands.project}
          />
          <SummaryStat
            tone="pink"
            icon={Palette}
            label={t("tabs.outputStyles")}
            user={counts.outputStyles.user}
            project={counts.outputStyles.project}
          />
          <SummaryStat
            tone="indigo"
            icon={Server}
            label={t("tabs.mcp")}
            user={counts.mcpServers.user}
            project={counts.mcpServers.project}
          />
          <SummaryStat
            tone="emerald"
            icon={PlugZap}
            label={t("tabs.plugins")}
            value={counts.plugins}
          />
          <SummaryStat
            tone="amber"
            icon={Store}
            label={t("tabs.marketplaces")}
            value={counts.marketplaces}
          />
          <SummaryStat
            tone="orange"
            icon={Webhook}
            label={t("tabs.hooks")}
            value={Object.values(counts.hooks).reduce((a, b) => a + b, 0)}
          />
          <SummaryStat
            tone="rose"
            icon={Keyboard}
            label={t("tabs.keybindings")}
            value={counts.keybindings}
          />
          <SummaryStat
            tone="slate"
            icon={SettingsIcon}
            label={t("tabs.settings")}
            value={counts.settingsFiles}
          />
          <SummaryStat tone="teal" icon={BookOpen} label={t("tabs.memory")} value={counts.memory} />
        </div>
      </section>
    </div>
  );
}

interface SummaryStatProps {
  tone: Tone;
  icon: typeof Sparkles;
  label: string;
  // Either a single value, OR a user/project pair (which is summed for the headline number).
  value?: number;
  user?: number;
  project?: number;
}

function SummaryStat({ tone, icon: Icon, label, value, user, project }: SummaryStatProps) {
  const { t } = useTranslation("ccConfig");
  const T = TONES[tone];
  const total = value !== undefined ? value : (user ?? 0) + (project ?? 0);
  const showBreakdown = user !== undefined && project !== undefined;
  return (
    <div className={`relative rounded-lg border border-border bg-surface-2 overflow-hidden`}>
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${T.bar}`} aria-hidden />
      <div className="pl-3.5 pr-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={`w-6 h-6 rounded-md ${T.iconBg} flex items-center justify-center flex-shrink-0`}
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
    </div>
  );
}

function RootRow({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof FolderTree;
  tone: Tone;
  label: string;
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

interface MdItemListProps {
  items: CcMdItem[] | null;
  search: string;
  onOpen: (path: string) => void;
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  kind: "skills" | "agents" | "commands" | "outputStyles";
}

function MdItemList({ items, search, onOpen, onEdit, onDelete, kind }: MdItemListProps) {
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

interface MdItemCardProps {
  item: CcMdItem;
  onOpen: (p: string) => void;
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  kind: "skills" | "agents" | "commands" | "outputStyles";
}

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

function McpPanel({ data, search }: { data: CcMcpResponse | null; search: string }) {
  const { t } = useTranslation("ccConfig");
  if (!data) return <SkeletonRows n={3} />;
  const all = [...data.user, ...data.projectScoped];
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-600 min-w-20">{label}:</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────

function HooksPanel({
  sources,
  scripts,
  search,
  onOpen,
}: {
  sources: CcHookSource[] | null;
  scripts: CcHookScripts | null;
  search: string;
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

// The settings that the TUI's `/config` editor manages, in display order.
// Surfaced as a resolved at-a-glance summary so the user sees what `/config`
// set (model, verbose, theme, …) without hunting through the raw JSON files.
// Keys map 1:1 to settings.json keys per https://code.claude.com/docs/en/settings.
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

function SettingsPanel({
  sources,
  statusline,
  onOpen,
}: {
  sources: CcSettingsSource[] | null;
  statusline: CcStatusline | null;
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

function SettingsBlock({
  source,
  onOpen,
}: {
  source: CcSettingsSource;
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

interface MemoryPanelProps {
  items: CcMemoryItem[] | null;
  search: string;
  onOpen: (p: string) => void;
  onEdit: (
    type: CcArtifactType,
    item: { scope: "user" | "project"; name: string; filePath: string }
  ) => void;
  onDelete: (
    type: CcArtifactType,
    scope: "user" | "project",
    name: string | undefined,
    path: string
  ) => void;
  onCreate: (scope: "user" | "project") => void;
  onEditAuto: (item: CcMemoryItem) => void;
  onDeleteAuto: (item: CcMemoryItem) => void;
  onCreateAuto: (project: string) => void;
}

// Strip a leading markdown heading then take a short snippet — used when a
// per-fact memory file has no frontmatter description.
function memoryDescription(m: CcMemoryItem): string {
  return (
    m.frontmatter?.description ||
    m.preview
      .replace(/^#+\s.*\n/, "")
      .trim()
      .slice(0, 200)
  );
}

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

  const { primary, autoFiltered, groups, missingScopes } = useMemo(() => {
    const list = items ?? [];
    const primaryItems = list.filter(
      (m): m is CcMemoryItem & { scope: "user" | "project" } =>
        m.scope === "user" || m.scope === "project"
    );
    const autoItems = list.filter((m) => m.scope === "auto-memory");

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

interface MemoryProjectGroupProps {
  project: string;
  files: CcMemoryItem[];
  onOpen: (p: string) => void;
  onEditAuto: (item: CcMemoryItem) => void;
  onDeleteAuto: (item: CcMemoryItem) => void;
  onCreateAuto: (project: string) => void;
  defaultOpen: boolean;
}

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
                {factFiles.map((m) => (
                  <MemoryFactRow
                    key={m.file}
                    item={m}
                    onOpen={onOpen}
                    onEditAuto={onEditAuto}
                    onDeleteAuto={onDeleteAuto}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MemoryAutoItemProps {
  item: CcMemoryItem;
  onOpen: (p: string) => void;
  onEditAuto: (item: CcMemoryItem) => void;
  onDeleteAuto: (item: CcMemoryItem) => void;
}

// Compact View / Edit / Delete button cluster shared by index + fact rows.
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

function MemoryIndexCard({ item, onOpen, onEditAuto, onDeleteAuto }: MemoryAutoItemProps) {
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
        {item.preview}
        {item.truncated && <span className="text-gray-600 italic">{"\n…"}</span>}
      </pre>
    </div>
  );
}

function MemoryFactRow({ item, onOpen, onEditAuto, onDeleteAuto }: MemoryAutoItemProps) {
  const desc = memoryDescription(item);
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border bg-surface-1 px-3 py-2 hover:border-border/80 transition-colors">
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

function MarketplacesPanel({
  data,
  search,
}: {
  data: CcMarketplacesResponse | null;
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

function KeybindingsPanel({ data, search }: { data: CcKeybindings | null; search: string }) {
  const { t } = useTranslation("ccConfig");
  if (!data) return <SkeletonRows n={3} />;
  if (!data.exists) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 px-4 py-6 text-center text-sm text-gray-500">
        {t("keybindings.missing", { path: data.file })}
      </div>
    );
  }
  const q = search.toLowerCase();
  return (
    <div className="space-y-3">
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
      </div>
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

function Empty() {
  const { t } = useTranslation("ccConfig");
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-gray-500">
      {t("common.empty")}
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg border border-border bg-surface-2 animate-pulse" />
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── File viewer modal ─────────────────────────────────────────────────

function FileViewer({
  state,
  onClose,
}: {
  state: { path: string; data: CcFileResponse | null; error: string | null };
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

interface EditorModalProps {
  state: NonNullable<EditorState>;
  onClose: () => void;
  onSave: (args: {
    type: CcArtifactType;
    targetScope: "user" | "project" | "auto-memory";
    name: string | undefined;
    content: string;
    project?: string;
  }) => Promise<void>;
}

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

interface ConfirmDeleteModalProps {
  state: NonNullable<ConfirmDeleteState>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

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

interface ExplainerBannerProps {
  title: string;
  body: string;
  howTo: string;
  commands: { cmd: string; note: string }[];
}

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

// Best-effort: derive the active path the backup would restore to. We strip
// the trailing `.<ISO>.bak` segment from the basename and put the result back
// under the right active subdir. If the format doesn't match, fall back to
// "(unknown)" - the user can still copy the backup path itself.
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

// Quote for POSIX shells: wrap in single quotes, escape any embedded single quotes.
function shellEscape(s: string): string {
  if (/^[A-Za-z0-9_/.@:=+,-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
