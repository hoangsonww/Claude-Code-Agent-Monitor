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
  FolderOpen,
  Github,
  Globe,
  Heart,
  History,
  Keyboard,
  Layers,
  LayoutDashboard,
  Link2,
  MonitorPlay,
  MoveUp,
  Palette,
  PanelLeftClose,
  Play,
  PlugZap,
  RefreshCw,
  Server,
  Settings as SettingsIcon,
  Slash,
  Sparkles,
  Store,
  UserRound,
  Volume2,
  VolumeX,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ProviderScope } from "./dataScope";

/** Result buckets, rendered in this order. */
export type CommandGroup =
  | "recent"
  | "pages"
  | "sessions"
  | "views"
  | "settings"
  | "config"
  | "actions";

/** Order the palette renders groups in. */
export const COMMAND_GROUP_ORDER: readonly CommandGroup[] = [
  "recent",
  "pages",
  "sessions",
  "views",
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
  /** Registry id whose key caps are shown on the row, when one exists. */
  shortcutId?: string;
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
  openHelp: () => void;
  toggleSidebar: () => void;
  sidebarCollapsed: boolean;
  refreshPage: () => void;
  scrollTop: () => void;
  scrollBottom: () => void;
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
}

/** The nine sidebar destinations, with the `g …` shortcut each one answers to. */
export const PAGE_COMMANDS: {
  to: string;
  icon: LucideIcon;
  navKey: string;
  shortcutId: string;
}[] = [
  { to: "/", icon: LayoutDashboard, navKey: "nav:dashboard", shortcutId: "goto.dashboard" },
  { to: "/kanban", icon: Columns3, navKey: "nav:agentBoard", shortcutId: "goto.kanban" },
  { to: "/sessions", icon: FolderOpen, navKey: "nav:sessions", shortcutId: "goto.sessions" },
  { to: "/activity", icon: Activity, navKey: "nav:activityFeed", shortcutId: "goto.activity" },
  { to: "/analytics", icon: BarChart3, navKey: "nav:analytics", shortcutId: "goto.analytics" },
  { to: "/workflows", icon: Workflow, navKey: "nav:workflows", shortcutId: "goto.workflows" },
  { to: "/cc-config", icon: Boxes, navKey: "nav:ccConfig", shortcutId: "goto.ccConfig" },
  { to: "/run", icon: Play, navKey: "nav:run", shortcutId: "goto.run" },
  { to: "/settings", icon: SettingsIcon, navKey: "nav:settings", shortcutId: "goto.settings" },
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
    shortcutId: page.shortcutId,
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
      shortcutId: "goto.run",
      run: go("/run"),
    },
    {
      id: "action:shortcuts",
      label: t("nav:palette.actionShortcuts"),
      keywords: ["keyboard", "keys", "help", "cheatsheet"],
      group: "actions",
      icon: Keyboard,
      shortcutId: "help.open",
      run: ctx.openHelp,
    },
    {
      id: "action:refresh",
      label: t("nav:palette.actionRefresh"),
      detail: t("nav:palette.currentPage"),
      group: "actions",
      icon: RefreshCw,
      shortcutId: "page.refresh",
      run: ctx.refreshPage,
    },
    {
      id: "action:sidebar",
      label: ctx.sidebarCollapsed
        ? t("nav:palette.actionExpandSidebar")
        : t("nav:palette.actionCollapseSidebar"),
      group: "actions",
      icon: PanelLeftClose,
      shortcutId: "sidebar.toggle",
      run: ctx.toggleSidebar,
    },
    {
      id: "action:scroll-top",
      label: t("nav:palette.actionScrollTop"),
      group: "actions",
      icon: MoveUp,
      shortcutId: "goto.top",
      run: ctx.scrollTop,
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
      shortcutId: "tabby.toggle",
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
      icon: ClipboardCopy,
      run: () => window.open("/api/docs", "_blank", "noopener,noreferrer"),
    },
  ];

  return [...pages, ...views, ...settings, ...config, ...actions];
}
