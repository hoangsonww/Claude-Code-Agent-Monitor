/**
 * @file Sidebar.tsx
 * @description Defines the Sidebar component that provides navigation links to different sections of the application, displays the connection status, and includes a toggle button for collapsing or expanding the sidebar. The component uses React Router's NavLink for navigation and Lucide icons for visual representation. The collapsed state of the sidebar is stored in localStorage to persist user preferences across sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Columns3,
  FolderOpen,
  Activity,
  BarChart3,
  Workflow,
  Settings,
  Wifi,
  WifiOff,
  Github,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
} from "lucide-react";

const NAV_KEYS = [
  { to: "/", icon: LayoutDashboard, key: "nav:dashboard" },
  { to: "/kanban", icon: Columns3, key: "nav:agentBoard" },
  { to: "/sessions", icon: FolderOpen, key: "nav:sessions" },
  { to: "/activity", icon: Activity, key: "nav:activityFeed" },
  { to: "/analytics", icon: BarChart3, key: "nav:analytics" },
  { to: "/workflows", icon: Workflow, key: "nav:workflows" },
  { to: "/settings", icon: Settings, key: "nav:settings" },
] as const;

const STORAGE_KEY = "sidebar-collapsed";
const SUPPORTED_LANGUAGES = ["en", "zh", "vi"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function normalizeLanguage(language: string): SupportedLanguage {
  const base = language.toLowerCase().split("-")[0];
  if (base === "zh" || base === "vi" || base === "en") {
    return base;
  }
  return "en";
}

interface SidebarProps {
  wsConnected: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ wsConnected, collapsed, onToggle }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const websiteLabel = "sonnguyenhoang.com";
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const currentIndex = SUPPORTED_LANGUAGES.indexOf(currentLanguage);
  const nextLanguage = SUPPORTED_LANGUAGES[(currentIndex + 1) % SUPPORTED_LANGUAGES.length];
  const switchLanguageTitle = t("nav:switchLanguage", {
    language: t(`nav:languageNames.${nextLanguage}`),
  });

  const toggleLang = () => {
    i18n.changeLanguage(nextLanguage);
  };

  const changeLanguage = (language: SupportedLanguage) => {
    if (language !== currentLanguage) {
      i18n.changeLanguage(language);
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 bg-surface-1 border-r border-border flex flex-col z-30 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${
        collapsed ? "w-[4.25rem]" : "w-60"
      }`}
    >
      {/* Brand */}
      <div className="px-3 py-4 border-b border-border">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3 px-2"}`}>
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-accent" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-gray-100 truncate">{t("nav:brand")}</h1>
              <p className="text-[11px] text-gray-500">{t("nav:brandSub")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {NAV_KEYS.map(({ to, icon: Icon, key }) => {
          const label = t(key);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-gray-400 hover:text-gray-200 hover:bg-surface-3 border border-transparent"
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Language controls */}
      <div className="px-2 pb-2">
        {collapsed ? (
          <button
            onClick={toggleLang}
            className="w-full h-9 rounded-lg border border-border bg-surface-2 text-gray-300 hover:bg-surface-3 hover:text-gray-100 transition-colors flex flex-col items-center justify-center gap-0.5"
            title={switchLanguageTitle}
            aria-label={switchLanguageTitle}
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold leading-none">
              {t(`nav:languageShort.${currentLanguage}`)}
            </span>
          </button>
        ) : (
          <div className="rounded-lg border border-border bg-surface-2 p-2">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {t("nav:language")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1">
              {SUPPORTED_LANGUAGES.map((language) => {
                const active = language === currentLanguage;
                return (
                  <button
                    key={language}
                    onClick={() => changeLanguage(language)}
                    aria-pressed={active}
                    aria-label={t(`nav:languageNames.${language}`)}
                    title={t(`nav:languageNames.${language}`)}
                    className={`rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "bg-surface-1 text-gray-400 border border-border hover:bg-surface-3 hover:text-gray-200"
                    }`}
                  >
                    {t(`nav:languageShort.${language}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="px-2 py-2">
        <button
          onClick={onToggle}
          className={`w-full h-10 rounded-lg border border-border bg-surface-2 transition-colors ${
            collapsed
              ? "flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-surface-3"
              : "flex items-center gap-2.5 px-3 text-gray-300 hover:text-gray-100 hover:bg-surface-3"
          }`}
          title={collapsed ? t("nav:expand") : t("nav:collapse")}
          aria-label={collapsed ? t("nav:expand") : t("nav:collapse")}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4 flex-shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4 flex-shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">
                {t("nav:collapseShort")}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div
        className={`px-3 pt-3 pb-4 border-t border-border space-y-2.5 ${collapsed ? "px-2" : ""}`}
      >
        <div
          className={`rounded-lg border border-border bg-surface-2 ${
            collapsed ? "w-8 h-8 mx-auto flex items-center justify-center" : "px-2.5 py-2"
          }`}
        >
          <div
            className={`flex items-center text-xs ${collapsed ? "justify-center" : "justify-between gap-2"}`}
          >
            <span
              className={`inline-flex items-center gap-2 ${
                wsConnected ? "text-emerald-400" : "text-gray-500"
              }`}
            >
              {wsConnected ? (
                <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              {!collapsed && (
                <span className="font-medium">
                  {wsConnected ? t("nav:live") : t("nav:disconnected")}
                </span>
              )}
            </span>
            {!collapsed && <span className="text-[11px] font-medium text-gray-600">v1.0.0</span>}
          </div>
        </div>
        {!collapsed && (
          <div className="space-y-1.5">
            <a
              href="https://github.com/hoangsonww"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-xs text-gray-300 hover:text-gray-200 hover:bg-surface-3 hover:border-border transition-colors"
              title={t("nav:github")}
            >
              <span className="w-6 h-6 rounded-md bg-surface-3 flex items-center justify-center">
                <Github className="w-3.5 h-3.5 flex-shrink-0" />
              </span>
              <span className="font-medium">{t("nav:github")}</span>
            </a>
            <a
              href="https://sonnguyenhoang.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-xs text-gray-300 hover:text-gray-200 hover:bg-surface-3 hover:border-border transition-colors"
              title={websiteLabel}
            >
              <span className="w-6 h-6 rounded-md bg-surface-3 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              </span>
              <span className="font-medium text-gray-300 truncate">{websiteLabel}</span>
            </a>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-2 pt-0.5">
            <a
              href="https://github.com/hoangsonww"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-md border border-transparent flex items-center justify-center text-gray-400 hover:text-gray-300 hover:bg-surface-3 hover:border-border transition-colors"
              title={t("nav:github")}
              aria-label={t("nav:github")}
            >
              <Github className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://sonnguyenhoang.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-md border border-transparent flex items-center justify-center text-gray-400 hover:text-gray-300 hover:bg-surface-3 hover:border-border transition-colors"
              title={websiteLabel}
              aria-label={websiteLabel}
            >
              <Globe className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}

export { STORAGE_KEY as SIDEBAR_STORAGE_KEY, loadCollapsed };
