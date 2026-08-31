/**
 * @file paletteCommands.ts
 * @description The command-palette catalog: every destination and every action
 * the launcher can reach, built as plain data from one context object.
 *
 * ## Why the catalog lives outside the component
 * The palette's job is to be exhaustive — every page, every Settings section,
 * every Agent Config tab, every list filter, every preference toggle. Keeping
 * that inventory in the component would bury ~150 lines of rendering under ~250
 * lines of data, and would make it impossible to assert the inventory in a test
 * without mounting React. Here it is a pure function: give it a context, get the
 * full command list, and `paletteCommands.test.ts` can check coverage directly
 * against the app's route table.
 *
 * ## Labels come from the pages' own namespaces
 * A Settings section is titled by `settings:*` and an Agent Config tab by
 * `ccConfig:tabs.*`. The catalog reuses those keys rather than restating them
 * under `nav:palette.*`, so a page renaming a section renames it in the palette
 * too, in all five locales, with no second edit.
 *
 * ## What is deliberately absent
 * Destructive operations. Purging the database or deleting a session is one
 * keystroke away from a typo in a launcher, and those flows exist behind
 * confirmation modals on purpose — the palette navigates to them instead of
 * performing them.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  Boxes,
  Cat,
  ClipboardCopy,
  Clock,
  Cloud,
  Columns3,
  Database,
  DollarSign,
  Eraser,
  FilterX,
  FolderOpen,
  FolderTree,
  Github,
  Globe,
  Heart,
  History,
  Keyboard,
  Layers,
  LayoutDashboard,
  Link2,
  MonitorPlay,
  MoveDown,
  MoveUp,
  Pause,
  Palette,
  PanelLeftClose,
  Play,
  PlugZap,
  RefreshCw,
  Server,
  Settings as SettingsIcon,
  Slash,
  Sparkles,
  Timer,
  Store,
  UserRound,
  Volume2,
  Volume1,
  VolumeX,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { DataScope, ProviderScope } from "./dataScope";

/** Result buckets, rendered in this order. */
export type CommandGroup =
  | "recent"
  | "pages"
  | "sessions"
  | "views"
  | "thisPage"
  | "projects"
  | "settings"
  | "config"
  | "actions";

/** Order the palette renders groups in. */
export const COMMAND_GROUP_ORDER: readonly CommandGroup[] = [
  "recent",
  "pages",
  "sessions",
  // Actions the current page registered rank above the generic catalog: when a
  // command exists for what is on screen, it is almost always the one meant.
  "thisPage",
  "views",
  "projects",
  "settings",
  "config",
  "actions",
];

export interface PaletteCommand {
  /** Stable across renders and locales — it is what the MRU list persists. */
  id: string;
  label: string;
  /** Secondary line: the route, the owning page, or a state summary. */
  detail?: string;
  /** Extra text matched against but never shown (route paths, synonyms). */
  keywords?: string[];
  group: CommandGroup;
  icon: LucideIcon;
  /** Live on/off state, rendered as a pill for toggle commands. */
  state?: string;
  run: () => void;
}

/** Everything the catalog needs from the app to build a runnable command list. */
export interface PaletteContext {
  /** Translate with an explicit `ns:key` (the palette uses several namespaces). */
  t: (key: string, options?: Record<string, unknown>) => string;
  navigate: (to: string) => void;
  /** Current pathname, so page-scoped commands can be filtered in. */
  pathname: string;
  copyLink: () => void;
  language: string;
  setLanguage: (language: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  tabbyEnabled: boolean;
  setTabbyEnabled: (enabled: boolean) => void;
  providerScope: ProviderScope;
  setProviderScope: (scope: ProviderScope) => void;
  checkForUpdates: () => void;
  clearRecents: () => void;
  /**
   * Ids the current page has registered with the shortcut registry. Page
   * commands are offered **only** when their handler exists, so the palette can
   * never list an action that would do nothing — the failure mode that made the
   * original three quick actions feel broken.
   */
  boundIds: ReadonlySet<string>;
  /** Fire a registered page action. */
  runAction: (id: string) => void;
  /** Confirm an action that changed something without moving the user. */
  announce: (message: string) => void;
  /** Distinct project directories seen across sessions, for direct jumps. */
  projects: string[];
  /** Known data sources (machines), for scoping without visiting Settings. */
  sources: { id: string; label: string }[];
  scope: DataScope;
  setScope: (scope: DataScope) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  soundVolume: number;
  setSoundVolume: (volume: number) => void;
  tabbyMuted: boolean;
  setTabbyMuted: (muted: boolean) => void;
  goBack: () => void;
  goForward: () => void;
}

/**
 * Commands a page registers for itself. Each is listed only while its handler is
 * mounted, which is what keeps the palette honest: an entry that appears is an
 * entry that works, on the page you are looking at.
 *
 * These ids are intentionally absent from `lib/shortcuts.ts` — they are palette
 * commands, not chords, so they neither consume a key nor appear in the `?`
 * sheet.
 */
export const PAGE_ACTION_COMMANDS: {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  /** Extra searchable text. */
  keywords?: string[];
}[] = [
  {
    id: "activity.togglePause",
    labelKey: "nav:palette.actionToggleStream",
    icon: Pause,
    keywords: ["pause", "resume", "live", "stream"],
  },
  {
    id: "activity.clearFilters",
    labelKey: "common:eventFilters.clearAll",
    icon: FilterX,
    keywords: ["reset", "filters"],
  },
  {
    id: "sessions.sortTime",
    labelKey: "sessions:sortTimeNewest",
    icon: Clock,
    keywords: ["sort", "recent"],
  },
  {
    id: "sessions.sortDuration",
    labelKey: "sessions:sortDurationLongest",
    icon: Timer,
    keywords: ["sort", "longest"],
  },
  {
    id: "sessions.sortCost",
    labelKey: "sessions:sortPriceHighest",
    icon: DollarSign,
    keywords: ["sort", "expensive", "price"],
  },
  {
    id: "sessions.toggleSortDirection",
    labelKey: "nav:palette.actionToggleSortDirection",
    icon: ArrowUpDown,
    keywords: ["ascending", "descending", "reverse"],
  },
  {
    id: "sessions.clearFilters",
    labelKey: "nav:palette.actionClearSessionFilters",
    icon: FilterX,
    keywords: ["reset", "all", "filters"],
  },
  {
    id: "session.copyId",
    labelKey: "nav:palette.actionCopySessionId",
    icon: ClipboardCopy,
    keywords: ["uuid", "identifier"],
  },
  {
    id: "session.copyPath",
    labelKey: "nav:palette.actionCopySessionPath",
    icon: FolderOpen,
    keywords: ["cwd", "directory", "project"],
  },
  {
    id: "page.refresh",
    labelKey: "nav:palette.actionRefresh",
    icon: RefreshCw,
    keywords: ["reload", "refresh", "update"],
  },
  {
    id: "layout.toggleSidebar",
    labelKey: "nav:palette.actionCollapseSidebar",
    icon: PanelLeftClose,
    keywords: ["sidebar", "collapse", "expand"],
  },
  {
    id: "layout.scrollTop",
    labelKey: "nav:palette.actionScrollTop",
    icon: MoveUp,
    keywords: ["top", "up", "beginning"],
  },
  {
    id: "layout.scrollBottom",
    labelKey: "nav:palette.actionScrollBottom",
    icon: MoveDown,
    keywords: ["bottom", "down", "end"],
  },
  {
    id: "session.openInRun",
    labelKey: "nav:palette.actionResumeSession",
    icon: Play,
    keywords: ["resume", "continue", "run"],
  },
];

/** The nine sidebar destinations. */
export const PAGE_COMMANDS: {
  to: string;
  icon: LucideIcon;
  navKey: string;
}[] = [
  { to: "/", icon: LayoutDashboard, navKey: "nav:dashboard" },
  { to: "/kanban", icon: Columns3, navKey: "nav:agentBoard" },
  { to: "/sessions", icon: FolderOpen, navKey: "nav:sessions" },
  { to: "/activity", icon: Activity, navKey: "nav:activityFeed" },
  { to: "/analytics", icon: BarChart3, navKey: "nav:analytics" },
  { to: "/workflows", icon: Workflow, navKey: "nav:workflows" },
  { to: "/cc-config", icon: Boxes, navKey: "nav:ccConfig" },
  { to: "/run", icon: Play, navKey: "nav:run" },
  { to: "/settings", icon: SettingsIcon, navKey: "nav:settings" },
];

/**
 * Settings sections, keyed by the anchor id the page renders. Mirrors
 * `SETTINGS_SECTIONS` in `pages/Settings.tsx`; `paletteCommands.test.ts` asserts
 * the two stay in step, because a drifted id produces a link that scrolls
 * nowhere and nothing else would notice.
 */
export const SETTINGS_SECTION_COMMANDS: { id: string; labelKey: string; icon: LucideIcon }[] = [
  { id: "data-display", labelKey: "settings:display.title", icon: Layers },
  { id: "claude-pricing", labelKey: "settings:pricing.navClaude", icon: DollarSign },
  { id: "gpt-pricing", labelKey: "settings:pricing.navGpt", icon: DollarSign },
  { id: "hooks", labelKey: "settings:hooks.title", icon: PlugZap },
  { id: "session-homes", labelKey: "settings:homes.title", icon: FolderOpen },
  { id: "import", labelKey: "settings:import.title", icon: History },
  { id: "remote-sources", labelKey: "settings:remoteSources.title", icon: Cloud },
  { id: "tabby", labelKey: "settings:tabby.title", icon: Cat },
  { id: "sound", labelKey: "settings:sound.title", icon: Volume2 },
  { id: "notifications", labelKey: "settings:notifications.title", icon: Bell },
  { id: "alerts", labelKey: "settings:alertsHub.title", icon: BellRing },
  { id: "data", labelKey: "settings:data.title", icon: Database },
  { id: "about", labelKey: "settings:about.title", icon: Server },
];

/** Agent Config tabs. Mirrors `TABS` in `pages/CcConfig.tsx` (asserted in tests). */
export const CC_CONFIG_TAB_COMMANDS: { key: string; icon: LucideIcon }[] = [
  { key: "overview", icon: Boxes },
  { key: "skills", icon: Sparkles },
  { key: "agents", icon: UserRound },
  { key: "commands", icon: Slash },
  { key: "memory", icon: BookOpen },
  { key: "plugins", icon: PlugZap },
  { key: "marketplaces", icon: Store },
  { key: "mcp", icon: Server },
  { key: "hooks", icon: Webhook },
  { key: "keybindings", icon: Keyboard },
  { key: "settings", icon: SettingsIcon },
  { key: "outputStyles", icon: Palette },
];

/** Sub-views reachable by query string, grouped under "Views". */
const VIEW_COMMANDS: {
  id: string;
  to: string;
  labelKey: string;
  ownerKey: string;
  icon: LucideIcon;
}[] = [
  {
    id: "view:dashboard:monitor",
    to: "/?tab=monitor",
    labelKey: "dashboard:tabs.monitor",
    ownerKey: "nav:dashboard",
    icon: MonitorPlay,
  },
  {
    id: "view:dashboard:health",
    to: "/?tab=health",
    labelKey: "dashboard:tabs.health",
    ownerKey: "nav:dashboard",
    icon: Heart,
  },
  {
    id: "view:kanban:agents",
    to: "/kanban?view=agents",
    labelKey: "kanban:viewToggle.agents",
    ownerKey: "nav:agentBoard",
    icon: UserRound,
  },
  {
    id: "view:kanban:sessions",
    to: "/kanban?view=sessions",
    labelKey: "kanban:viewToggle.sessions",
    ownerKey: "nav:agentBoard",
    icon: FolderOpen,
  },
  {
    id: "view:analytics:cost",
    to: "/analytics?tab=cost",
    labelKey: "analytics:tabs.costAnalytics",
    ownerKey: "nav:analytics",
    icon: DollarSign,
  },
  {
    id: "view:analytics:tokens",
    to: "/analytics?tab=tokens",
    labelKey: "analytics:tabs.tokenAnalytics",
    ownerKey: "nav:analytics",
    icon: BarChart3,
  },
  {
    id: "view:analytics:productivity",
    to: "/analytics?tab=productivity",
    labelKey: "analytics:tabs.productivityAnalytics",
    ownerKey: "nav:analytics",
    icon: Clock,
  },
  {
    id: "view:analytics:workflow",
    to: "/analytics?tab=workflow",
    labelKey: "analytics:tabs.workflowIntelligence",
    ownerKey: "nav:analytics",
    icon: Workflow,
  },
];

/** Session list filters, reachable as `/sessions?status=…`. */
const SESSION_FILTER_COMMANDS: { status: string; labelKey: string }[] = [
  { status: "", labelKey: "sessions:filterAll" },
  { status: "active", labelKey: "sessions:filterActive" },
  { status: "waiting", labelKey: "sessions:filterWaiting" },
  { status: "completed", labelKey: "sessions:filterCompleted" },
  { status: "error", labelKey: "sessions:filterError" },
  { status: "abandoned", labelKey: "sessions:filterAbandoned" },
];

const LANGUAGES = ["en", "zh", "vi", "ko", "es"] as const;

const PROVIDER_SCOPES: ProviderScope[] = ["both", "claude", "codex"];

/**
 * Build every non-session command. Session results are appended by the palette
 * itself because they are fetched, not enumerated.
 */
export function buildPaletteCommands(ctx: PaletteContext): PaletteCommand[] {
  const { t, navigate } = ctx;
  const go = (to: string) => () => navigate(to);
  const onOff = (enabled: boolean) => t(enabled ? "nav:palette.on" : "nav:palette.off");

  const pages: PaletteCommand[] = PAGE_COMMANDS.map((page) => ({
    id: `page:${page.to}`,
    label: t(page.navKey),
    detail: page.to,
    keywords: [page.to],
    group: "pages",
    icon: page.icon,
    run: go(page.to),
  }));

  const views: PaletteCommand[] = [
    ...VIEW_COMMANDS.map((view) => ({
      id: view.id,
      label: t(view.labelKey),
      detail: t(view.ownerKey),
      keywords: [view.to],
      group: "views" as const,
      icon: view.icon,
      run: go(view.to),
    })),
    ...SESSION_FILTER_COMMANDS.map((filter) => ({
      id: `view:sessions:${filter.status || "all"}`,
      label: t("nav:palette.sessionsFiltered", { filter: t(filter.labelKey) }),
      detail: t("nav:sessions"),
      keywords: ["/sessions", filter.status],
      group: "views" as const,
      icon: FolderOpen,
      run: go(filter.status ? `/sessions?status=${filter.status}` : "/sessions"),
    })),
  ];

  const settings: PaletteCommand[] = SETTINGS_SECTION_COMMANDS.map((section) => ({
    id: `settings:${section.id}`,
    label: t(section.labelKey),
    detail: t("nav:settings"),
    keywords: [`/settings#${section.id}`, section.id],
    group: "settings",
    icon: section.icon,
    run: go(`/settings#${section.id}`),
  }));

  const config: PaletteCommand[] = CC_CONFIG_TAB_COMMANDS.map((tab) => ({
    id: `cc-config:${tab.key}`,
    label: t(`ccConfig:tabs.${tab.key}`),
    detail: t("nav:ccConfig"),
    keywords: [`/cc-config?tab=${tab.key}`, tab.key],
    group: "config",
    icon: tab.icon,
    run: go(`/cc-config?tab=${tab.key}`),
  }));

  const actions: PaletteCommand[] = [
    {
      id: "action:run",
      label: t("nav:palette.actionNewRun"),
      detail: t("nav:run"),
      keywords: ["new", "start", "prompt"],
      group: "actions",
      icon: Play,
      run: go("/run"),
    },
    {
      id: "action:copy-link",
      label: t("nav:palette.actionCopyLink"),
      detail: ctx.pathname,
      keywords: ["url", "share", "clipboard"],
      group: "actions",
      icon: Link2,
      run: ctx.copyLink,
    },
    {
      id: "action:sound",
      label: t("nav:palette.actionToggleSound"),
      state: onOff(ctx.soundEnabled),
      keywords: ["audio", "mute", "cue"],
      group: "actions",
      icon: ctx.soundEnabled ? Volume2 : VolumeX,
      run: () => ctx.setSoundEnabled(!ctx.soundEnabled),
    },
    {
      id: "action:tabby",
      label: t("nav:palette.actionToggleTabby"),
      state: onOff(ctx.tabbyEnabled),
      keywords: ["assistant", "cat", "helper"],
      group: "actions",
      icon: Cat,
      run: () => ctx.setTabbyEnabled(!ctx.tabbyEnabled),
    },
    ...PROVIDER_SCOPES.map((scope) => ({
      id: `action:provider:${scope}`,
      label: t("nav:palette.actionProviderScope", { provider: t(`nav:palette.provider.${scope}`) }),
      state: ctx.providerScope === scope ? t("nav:palette.active") : undefined,
      keywords: ["scope", "filter", "claude", "codex", scope],
      group: "actions" as const,
      icon: Layers,
      run: () => ctx.setProviderScope(scope),
    })),
    ...LANGUAGES.map((language) => ({
      id: `action:language:${language}`,
      label: t("nav:switchLanguage", { language: t(`nav:languageNames.${language}`) }),
      state: ctx.language === language ? t("nav:palette.active") : undefined,
      keywords: ["language", "locale", "i18n", language],
      group: "actions" as const,
      icon: Globe,
      run: () => ctx.setLanguage(language),
    })),
    {
      id: "action:back",
      label: t("nav:palette.actionBack"),
      keywords: ["history", "previous", "return"],
      group: "actions",
      icon: ArrowLeft,
      run: ctx.goBack,
    },
    {
      id: "action:forward",
      label: t("nav:palette.actionForward"),
      keywords: ["history", "next"],
      group: "actions",
      icon: ArrowRight,
      run: ctx.goForward,
    },
    {
      id: "action:notifications",
      label: t("settings:notifications.enable"),
      state: onOff(ctx.notificationsEnabled),
      keywords: ["browser", "alert", "desktop", "notify"],
      group: "actions",
      icon: Bell,
      run: () => ctx.setNotificationsEnabled(!ctx.notificationsEnabled),
    },
    {
      id: "action:volume-up",
      label: t("nav:palette.actionVolumeUp"),
      // Rendered as a percentage so the row states where it is starting from —
      // a blind "louder" gives no way to know when to stop.
      state: `${Math.round(ctx.soundVolume * 100)}%`,
      keywords: ["sound", "louder", "audio"],
      group: "actions",
      icon: Volume2,
      run: () => ctx.setSoundVolume(Math.min(1, ctx.soundVolume + 0.1)),
    },
    {
      id: "action:volume-down",
      label: t("nav:palette.actionVolumeDown"),
      state: `${Math.round(ctx.soundVolume * 100)}%`,
      keywords: ["sound", "quieter", "audio"],
      group: "actions",
      icon: Volume1,
      run: () => ctx.setSoundVolume(Math.max(0, ctx.soundVolume - 0.1)),
    },
    {
      id: "action:tabby-mute",
      label: t("nav:palette.actionMuteTabby"),
      state: onOff(ctx.tabbyMuted),
      keywords: ["tabby", "quiet", "silence"],
      group: "actions",
      icon: VolumeX,
      run: () => ctx.setTabbyMuted(!ctx.tabbyMuted),
    },
    {
      id: "action:check-updates",
      label: t("nav:checkForUpdates"),
      keywords: ["version", "upgrade", "release"],
      group: "actions",
      icon: RefreshCw,
      run: ctx.checkForUpdates,
    },
    {
      id: "action:clear-recents",
      label: t("nav:palette.actionClearRecents"),
      keywords: ["history", "reset"],
      group: "actions",
      icon: Eraser,
      run: ctx.clearRecents,
    },
    {
      id: "action:github",
      label: t("nav:github"),
      detail: "github.com",
      group: "actions",
      icon: Github,
      run: () =>
        window.open(
          "https://github.com/hoangsonww/Claude-Code-Agent-Monitor",
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      id: "action:website",
      label: t("nav:website"),
      detail: "sonnguyenhoang.com",
      group: "actions",
      icon: Globe,
      run: () => window.open("https://sonnguyenhoang.com", "_blank", "noopener,noreferrer"),
    },
    {
      id: "action:api-docs",
      label: t("nav:palette.actionApiDocs"),
      detail: "/api/docs",
      keywords: ["swagger", "openapi", "reference"],
      group: "actions",
      icon: BookOpen,
      run: () => window.open("/api/docs", "_blank", "noopener,noreferrer"),
    },
    {
      id: "action:issues",
      label: t("nav:palette.actionReportIssue"),
      detail: "github.com",
      keywords: ["bug", "issue", "feedback", "support"],
      group: "actions",
      icon: Github,
      run: () =>
        window.open(
          "https://github.com/hoangsonww/Claude-Code-Agent-Monitor/issues/new",
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      id: "action:releases",
      label: t("nav:palette.actionReleases"),
      detail: "github.com",
      keywords: ["changelog", "version", "notes"],
      group: "actions",
      icon: History,
      run: () =>
        window.open(
          "https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases",
          "_blank",
          "noopener,noreferrer"
        ),
    },
  ];

  // Only offer what the current page actually registered — an entry that
  // appears is an entry that works, here.
  const pageActions: PaletteCommand[] = PAGE_ACTION_COMMANDS.filter((action) =>
    ctx.boundIds.has(action.id)
  ).map((action) => ({
    id: `page-action:${action.id}`,
    label: t(action.labelKey),
    detail: t("nav:palette.currentPage"),
    keywords: action.keywords,
    group: "thisPage",
    icon: action.icon,
    run: () => ctx.runAction(action.id),
  }));

  // Project directories come from the same facets the Sessions filter uses, so
  // "everything I did in this repo" is one query rather than a page visit plus
  // a multi-select.
  const projects: PaletteCommand[] = ctx.projects.map((cwd) => ({
    id: `project:${cwd}`,
    label: cwd.split("/").filter(Boolean).pop() || cwd,
    detail: cwd,
    keywords: [cwd, "project", "directory", "cwd"],
    group: "projects",
    icon: FolderTree,
    run: go(`/sessions?cwd=${encodeURIComponent(cwd)}`),
  }));

  const sourceActions: PaletteCommand[] = ctx.sources.map((source) => ({
    id: `action:source:${source.id}`,
    label: t("nav:palette.actionScopeToSource", { source: source.label }),
    state:
      ctx.scope.mode === "selected" && ctx.scope.selected.includes(source.id)
        ? t("nav:palette.active")
        : undefined,
    keywords: ["scope", "machine", "source", source.id, source.label],
    group: "actions",
    icon: Cloud,
    run: () => {
      ctx.setScope({ ...ctx.scope, mode: "selected", selected: [source.id] });
      ctx.announce(t("nav:palette.actionScopeToSource", { source: source.label }));
    },
  }));

  return [
    ...pages,
    ...pageActions,
    ...views,
    ...projects,
    ...settings,
    ...config,
    ...actions,
    ...sourceActions,
  ];
}
