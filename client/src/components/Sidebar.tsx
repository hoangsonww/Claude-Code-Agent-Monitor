/**
 * @file Sidebar.tsx
 * @description Defines the Sidebar component that provides navigation links to different sections of the application, displays the connection status, and includes a toggle button for collapsing or expanding the sidebar. The component uses React Router's NavLink for navigation and Lucide icons for visual representation. The collapsed state of the sidebar is stored in localStorage to persist user preferences across sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Columns3,
  FolderOpen,
  Activity,
  BarChart3,
  Workflow,
  Boxes,
  Play,
  Settings,
  Wifi,
  WifiOff,
  Github,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
  RefreshCw,
  X,
  Plug,
  Clock,
  Gauge,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import type { UpdateStatusPayload, WSMessage } from "../lib/types";

function isUpdatePayload(x: unknown): x is UpdateStatusPayload {
  return typeof x === "object" && x !== null && "git_repo" in x && "update_available" in x;
}

const NAV_KEYS = [
  { to: "/", icon: LayoutDashboard, key: "nav:dashboard" },
  { to: "/kanban", icon: Columns3, key: "nav:agentBoard" },
  { to: "/sessions", icon: FolderOpen, key: "nav:sessions" },
  { to: "/activity", icon: Activity, key: "nav:activityFeed" },
  { to: "/analytics", icon: BarChart3, key: "nav:analytics" },
  { to: "/workflows", icon: Workflow, key: "nav:workflows" },
  { to: "/cc-config", icon: Boxes, key: "nav:ccConfig" },
  { to: "/run", icon: Play, key: "nav:run" },
  { to: "/settings", icon: Settings, key: "nav:settings" },
] as const;

const STORAGE_KEY = "sidebar-collapsed";
const STATS_STORAGE_KEY = "sidebar-connection-stats";
const RECENT_EVENTS_CAP = 8;
const SUPPORTED_LANGUAGES = ["en", "zh", "vi", "ko"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

interface PersistedStats {
  eventCount: number;
  peakPerSec: number;
  lastEvent: { type: string; at: number } | null;
  typeCount: [string, number][];
  recentEvents: { type: string; at: number }[];
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function loadStats(): PersistedStats {
  const empty: PersistedStats = {
    eventCount: 0,
    peakPerSec: 0,
    lastEvent: null,
    typeCount: [],
    recentEvents: [],
  };
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<PersistedStats>;
    return {
      eventCount: typeof parsed.eventCount === "number" ? parsed.eventCount : 0,
      peakPerSec: typeof parsed.peakPerSec === "number" ? parsed.peakPerSec : 0,
      lastEvent:
        parsed.lastEvent &&
        typeof parsed.lastEvent.type === "string" &&
        typeof parsed.lastEvent.at === "number"
          ? parsed.lastEvent
          : null,
      typeCount: Array.isArray(parsed.typeCount)
        ? parsed.typeCount.filter(
            (e): e is [string, number] =>
              Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "number"
          )
        : [],
      recentEvents: Array.isArray(parsed.recentEvents)
        ? parsed.recentEvents
            .filter(
              (e): e is { type: string; at: number } =>
                !!e && typeof e.type === "string" && typeof e.at === "number"
            )
            .slice(0, RECENT_EVENTS_CAP)
        : [],
    };
  } catch {
    return empty;
  }
}

function normalizeLanguage(language: string): SupportedLanguage {
  const base = language.toLowerCase().split("-")[0];
  if (base === "zh" || base === "vi" || base === "en" || base === "ko") {
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
  // Track whether nav items are clipped by overflow so we can render
  // chevron affordances pointing toward the hidden items. Recomputed on
  // scroll, resize, and any structural change (e.g. collapse toggle).
  const navRef = useRef<HTMLElement | null>(null);
  const [navOverflow, setNavOverflow] = useState({ up: false, down: false });
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusPayload | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [connectedSince, setConnectedSince] = useState<number | null>(
    wsConnected ? Date.now() : null
  );
  // Buffers live in refs so the sidebar isn't re-rendered on every WS event -
  // the modal samples them on its own tick while it's open. Cumulative buffers
  // (count, type breakdown, recent list) are hydrated from localStorage so they
  // survive page reloads; the rolling 60s sparkline buffer is intentionally
  // ephemeral since it's only meaningful relative to "now".
  const eventCountRef = useRef(0);
  const peakPerSecRef = useRef(0);
  const lastEventRef = useRef<{ type: string; at: number } | null>(null);
  const eventTimestampsRef = useRef<number[]>([]);
  const typeCountRef = useRef<Map<string, number>>(new Map());
  const recentEventsRef = useRef<Array<{ type: string; at: number }>>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recomputeNavOverflow = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const up = el.scrollTop > 1;
    const down = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setNavOverflow((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
  }, []);

  useEffect(() => {
    recomputeNavOverflow();
    const el = navRef.current;
    if (!el) return;
    const onScroll = () => recomputeNavOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(recomputeNavOverflow) : null;
    ro?.observe(el);
    window.addEventListener("resize", recomputeNavOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", recomputeNavOverflow);
    };
  }, [recomputeNavOverflow, collapsed]);

  const scrollNavBy = useCallback((delta: number) => {
    navRef.current?.scrollBy({ top: delta, behavior: "smooth" });
  }, []);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const stats = loadStats();
    eventCountRef.current = stats.eventCount;
    peakPerSecRef.current = stats.peakPerSec;
    lastEventRef.current = stats.lastEvent;
    typeCountRef.current = new Map(stats.typeCount);
    recentEventsRef.current = stats.recentEvents;
  }, []);

  const persistStats = useCallback(() => {
    try {
      const payload: PersistedStats = {
        eventCount: eventCountRef.current,
        peakPerSec: peakPerSecRef.current,
        lastEvent: lastEventRef.current,
        typeCount: Array.from(typeCountRef.current.entries()),
        recentEvents: recentEventsRef.current,
      };
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, []);

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) return;
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistStats();
    }, 2000);
  }, [persistStats]);

  // Flush pending writes when the page is being hidden / unloaded so the very
  // latest events aren't lost to the throttle window.
  useEffect(() => {
    const flush = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistStats();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [persistStats]);

  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "update_status") {
        if (isUpdatePayload(msg.data)) {
          setUpdateStatus(msg.data);
          setCheckError(Boolean(msg.data.fetch_error));
        }
        return;
      }
      const now = Date.now();
      eventCountRef.current += 1;
      lastEventRef.current = { type: msg.type, at: now };
      eventTimestampsRef.current.push(now);
      // Keep only the last 60 seconds worth of timestamps for the sparkline.
      const cutoff = now - 60_000;
      const stamps = eventTimestampsRef.current;
      while (stamps.length > 0 && (stamps[0] as number) < cutoff) {
        stamps.shift();
      }
      typeCountRef.current.set(msg.type, (typeCountRef.current.get(msg.type) ?? 0) + 1);
      recentEventsRef.current.unshift({ type: msg.type, at: now });
      if (recentEventsRef.current.length > RECENT_EVENTS_CAP) {
        recentEventsRef.current.length = RECENT_EVENTS_CAP;
      }
      // All-time peak events/sec: count events landing in the trailing 1s
      // window ending right now. Walk from the tail (newest) backwards and
      // stop as soon as we cross the threshold - O(k) where k is the size of
      // the burst, so this stays cheap even under sustained traffic.
      const oneSecAgo = now - 1000;
      let inLastSec = 0;
      for (let i = stamps.length - 1; i >= 0; i--) {
        if ((stamps[i] as number) >= oneSecAgo) inLastSec += 1;
        else break;
      }
      if (inLastSec > peakPerSecRef.current) {
        peakPerSecRef.current = inLastSec;
      }
      schedulePersist();
    });
  }, [schedulePersist]);

  // Track when the live connection most recently came up so the modal can
  // show an honest "connected since" timestamp instead of stale state.
  useEffect(() => {
    if (wsConnected) {
      setConnectedSince((prev) => prev ?? Date.now());
    } else {
      setConnectedSince(null);
    }
  }, [wsConnected]);

  const onCheckUpdates = async () => {
    if (checking) return;
    setChecking(true);
    setCheckError(false);
    // Explicit user intent - clear any prior dismissal so the modal can
    // re-open if this check still reports an update.
    try {
      localStorage.removeItem("agent-monitor-update-dismissed-sha");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("dashboard:reset-update-dismissal"));
    try {
      const fresh = await api.updates.check();
      setUpdateStatus(fresh);
      setCheckError(Boolean(fresh.fetch_error));
    } catch {
      setCheckError(true);
    } finally {
      setChecking(false);
    }
  };

  const updateAvailable = Boolean(updateStatus?.update_available);
  const checkTitle = checking
    ? t("nav:checkingForUpdates")
    : checkError
      ? t("nav:checkFailed")
      : updateAvailable
        ? t("nav:updateAvailable")
        : updateStatus
          ? t("nav:upToDate")
          : t("nav:checkForUpdates");
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
      className={`fixed left-0 top-0 bottom-0 bg-surface-1 border-r border-border flex flex-col z-30 overflow-hidden transition-[width] duration-200 ${
        collapsed ? "w-[4.25rem]" : "w-60"
      }`}
    >
      {/* Brand */}
      <div className="px-3 py-4 border-b border-border flex-shrink-0">
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

      {/* Nav - only this section scrolls when its items overflow; the rest of
          the sidebar (brand, language, collapse toggle, footer) stays pinned.
          Chevron buttons appear at the edges when content is clipped, so the
          user knows there's more to reach without inspecting the scrollbar. */}
      <div className="flex-1 min-h-0 relative flex">
        <nav ref={navRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1">
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
        {!collapsed && navOverflow.up && (
          <button
            type="button"
            onClick={() => scrollNavBy(-160)}
            aria-label={t("nav:scrollUp")}
            title={t("nav:scrollUp")}
            className="absolute top-1.5 right-[7px] z-10 inline-flex items-center justify-center w-6 h-6 rounded-md border border-border bg-surface-2/90 text-gray-300 hover:text-gray-50 hover:bg-surface-3 shadow-md backdrop-blur-sm transition-colors animate-fade-in"
          >
            <ChevronUp className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
        {!collapsed && navOverflow.down && (
          <button
            type="button"
            onClick={() => scrollNavBy(160)}
            aria-label={t("nav:scrollDown")}
            title={t("nav:scrollDown")}
            className="absolute bottom-1.5 right-[7px] z-10 inline-flex items-center justify-center w-6 h-6 rounded-md border border-border bg-surface-2/90 text-gray-300 hover:text-gray-50 hover:bg-surface-3 shadow-md backdrop-blur-sm transition-colors animate-fade-in"
          >
            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* Language controls */}
      <div className="px-2 pb-2 flex-shrink-0">
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
            <div className="mt-2 grid grid-cols-4 gap-1">
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
      <div className="px-2 py-2 flex-shrink-0">
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
        className={`px-3 pt-3 pb-4 border-t border-border space-y-2.5 flex-shrink-0 ${collapsed ? "px-2" : ""}`}
      >
        <button
          type="button"
          onClick={() => setStatusModalOpen(true)}
          aria-label={t("nav:connectionDetails")}
          title={t("nav:connectionDetails")}
          className={`rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors text-left cursor-pointer ${
            collapsed
              ? "w-8 h-8 mx-auto flex items-center justify-center p-0"
              : "block w-full px-2.5 py-2"
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
        </button>
        {collapsed ? (
          <button
            type="button"
            onClick={onCheckUpdates}
            disabled={checking}
            title={checkTitle}
            aria-label={checkTitle}
            className={`relative w-8 h-8 mx-auto flex items-center justify-center rounded-lg border bg-surface-2 transition-colors disabled:opacity-60 ${
              updateAvailable
                ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                : checkError
                  ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                  : "border-border text-gray-400 hover:text-gray-200 hover:bg-surface-3"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} aria-hidden />
            {updateAvailable && !checking && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onCheckUpdates}
            disabled={checking}
            title={checkTitle}
            className={`w-full rounded-lg border bg-surface-2 px-2.5 py-2 text-xs transition-colors disabled:opacity-60 flex items-center justify-between gap-2 ${
              updateAvailable
                ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                : checkError
                  ? "border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                  : "border-border text-gray-300 hover:text-gray-100 hover:bg-surface-3"
            }`}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <RefreshCw
                className={`w-3.5 h-3.5 flex-shrink-0 ${checking ? "animate-spin" : ""}`}
                aria-hidden
              />
              <span className="font-medium truncate">{checkTitle}</span>
            </span>
            {updateAvailable && !checking && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            )}
          </button>
        )}
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

      <ConnectionStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        wsConnected={wsConnected}
        connectedSince={connectedSince}
        eventCountRef={eventCountRef}
        peakPerSecRef={peakPerSecRef}
        lastEventRef={lastEventRef}
        eventTimestampsRef={eventTimestampsRef}
        typeCountRef={typeCountRef}
        recentEventsRef={recentEventsRef}
        onResetStats={() => {
          eventCountRef.current = 0;
          peakPerSecRef.current = 0;
          lastEventRef.current = null;
          eventTimestampsRef.current = [];
          typeCountRef.current = new Map();
          recentEventsRef.current = [];
          if (persistTimerRef.current) {
            clearTimeout(persistTimerRef.current);
            persistTimerRef.current = null;
          }
          try {
            localStorage.removeItem(STATS_STORAGE_KEY);
          } catch {
            /* ignore */
          }
        }}
      />
    </aside>
  );
}

interface ConnectionStatusModalProps {
  open: boolean;
  onClose: () => void;
  wsConnected: boolean;
  connectedSince: number | null;
  eventCountRef: React.MutableRefObject<number>;
  peakPerSecRef: React.MutableRefObject<number>;
  lastEventRef: React.MutableRefObject<{ type: string; at: number } | null>;
  eventTimestampsRef: React.MutableRefObject<number[]>;
  typeCountRef: React.MutableRefObject<Map<string, number>>;
  recentEventsRef: React.MutableRefObject<Array<{ type: string; at: number }>>;
  onResetStats: () => void;
}

function ConnectionStatusModal({
  open,
  onClose,
  wsConnected,
  connectedSince,
  eventCountRef,
  peakPerSecRef,
  lastEventRef,
  eventTimestampsRef,
  typeCountRef,
  recentEventsRef,
  onResetStats,
}: ConnectionStatusModalProps) {
  const { t } = useTranslation();
  const [, forceTick] = useState(0);

  // Re-render once a second so the sparkline / relative timestamps / counts
  // stay honest while the modal is open. Cleared on close so we don't burn
  // cycles in the background.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  const wsUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }, []);

  if (!open || typeof document === "undefined") return null;

  const eventCount = eventCountRef.current;
  const lastEvent = lastEventRef.current;
  const recentEvents = recentEventsRef.current;
  const buckets = bucketEventsPerSecond(eventTimestampsRef.current, 60);
  const eventsLastMinute = buckets.reduce((sum, n) => sum + n, 0);
  // All-time peak - kept persistently across the session and across reloads,
  // so a one-off burst doesn't disappear once it rolls off the 60s window.
  const peakPerSec = peakPerSecRef.current;
  const avgPerSec = eventsLastMinute / 60;

  const totalCounted = Array.from(typeCountRef.current.values()).reduce((sum, n) => sum + n, 0);
  const topTypes = Array.from(typeCountRef.current.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topMax = topTypes.length > 0 ? (topTypes[0] as [string, number])[1] : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-status-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-md card shadow-2xl animate-slide-up overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                wsConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-surface-3 border-border text-gray-400"
              }`}
            >
              {wsConnected ? (
                <Wifi className="w-4 h-4" aria-hidden />
              ) : (
                <WifiOff className="w-4 h-4" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <h2
                id="connection-status-title"
                className="text-base font-semibold text-gray-50 truncate tracking-tight leading-tight"
              >
                {t("nav:connectionDetails")}
              </h2>
              <p
                className={`text-[11px] font-medium inline-flex items-center gap-1.5 leading-tight ${
                  wsConnected ? "text-emerald-400" : "text-gray-500"
                }`}
              >
                {wsConnected && (
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                )}
                {wsConnected ? t("nav:live") : t("nav:disconnected")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("nav:close")}
            className="p-1.5 -m-1 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-surface-4 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <KpiTile
              label={t("nav:eventsTotal")}
              value={eventCount.toLocaleString()}
              unit={t("nav:unitEvents")}
            />
            <KpiTile
              label={t("nav:eventsLastMin")}
              value={eventsLastMinute.toLocaleString()}
              unit={t("nav:unitEvents")}
            />
            <KpiTile
              label={t("nav:peakRate")}
              value={peakPerSec.toLocaleString()}
              unit={t("nav:unitPerSec")}
            />
          </div>

          {/* Throughput sparkline */}
          <Section title={t("nav:throughput60s")} icon={Gauge}>
            <Sparkline
              buckets={buckets}
              connected={wsConnected}
              avgLabel={`${avgPerSec.toFixed(2)}/s ${t("nav:avg")}`}
            />
          </Section>

          {/* Connection facts */}
          <Section title={t("nav:connection")} icon={Plug}>
            <div className="space-y-2">
              <DetailRow label={t("nav:wsEndpoint")} value={wsUrl} mono />
              <DetailRow
                label={t("nav:connectionUptime")}
                value={connectedSince ? formatRelative(connectedSince, t) : t("nav:notConnected")}
              />
              <DetailRow
                label={t("nav:lastEvent")}
                value={
                  lastEvent
                    ? `${lastEvent.type} · ${formatRelative(lastEvent.at, t)}`
                    : t("nav:noEventsYet")
                }
                mono={Boolean(lastEvent)}
              />
            </div>
          </Section>

          {/* Top event types */}
          <Section title={t("nav:topEventTypes")} icon={BarChart3}>
            {topTypes.length === 0 ? (
              <p className="text-xs text-gray-500 italic">{t("nav:noEventsYet")}</p>
            ) : (
              <div className="space-y-1.5">
                {topTypes.map(([type, count]) => (
                  <TypeBar key={type} type={type} count={count} max={topMax} total={totalCounted} />
                ))}
              </div>
            )}
          </Section>

          {/* Recent activity */}
          <Section title={t("nav:recentActivity")} icon={Clock}>
            {recentEvents.length === 0 ? (
              <p className="text-xs text-gray-500 italic">{t("nav:noEventsYet")}</p>
            ) : (
              <ul className="space-y-1">
                {recentEvents.map((evt, i) => (
                  <li
                    key={`${evt.at}-${i}`}
                    className="flex items-center justify-between gap-3 text-[11px] font-mono px-2 py-1 rounded bg-surface-2/50"
                  >
                    <span className="text-gray-200 truncate">{evt.type}</span>
                    <span className="text-gray-500 flex-shrink-0">{formatRelative(evt.at, t)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-surface-2/40">
          <span className="text-[10px] text-gray-500">{t("nav:statsPersisted")}</span>
          <button
            type="button"
            onClick={onResetStats}
            className="text-[11px] font-medium text-gray-400 hover:text-gray-100 hover:bg-surface-3 px-2 py-1 rounded transition-colors"
          >
            {t("nav:resetStats")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/60">
        <span className="w-5 h-5 rounded-md bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3 h-3 text-accent" aria-hidden />
        </span>
        <h3 className="text-[13px] font-semibold text-gray-100 tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function KpiTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-2.5 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 truncate">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1 truncate">
        <span className="text-base font-semibold text-gray-100 font-mono">{value}</span>
        <span className="text-[10px] font-medium text-gray-500 truncate">{unit}</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-gray-500 font-medium uppercase tracking-wider text-[10px] pt-0.5">
        {label}
      </span>
      <span className={`text-gray-200 text-right break-all min-w-0 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function TypeBar({
  type,
  count,
  max,
  total,
}: {
  type: string;
  count: number;
  max: number;
  total: number;
}) {
  const widthPct = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  const sharePct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="text-[11px]">
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="font-mono text-gray-200 truncate">{type}</span>
        <span className="text-gray-500 flex-shrink-0 font-mono">
          {count} · {sharePct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full bg-accent/70 rounded-full transition-[width] duration-300"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function Sparkline({
  buckets,
  connected,
  avgLabel,
}: {
  buckets: number[];
  connected: boolean;
  avgLabel: string;
}) {
  const W = 320;
  const H = 56;
  const max = Math.max(1, ...buckets);
  const stepX = W / Math.max(1, buckets.length - 1);
  const points = buckets.map((v, i) => {
    const x = i * stepX;
    const y = H - (v / max) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = points.length > 0 ? `M ${points.join(" L ")}` : "";
  const areaPath = points.length > 0 ? `M 0,${H} L ${points.join(" L ")} L ${W},${H} Z` : "";
  const stroke = connected ? "#34d399" : "#6b7280";

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-14" aria-hidden>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#spark-fill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500 font-mono">
        <span>−60s</span>
        <span>{avgLabel}</span>
        <span>{"now"}</span>
      </div>
    </div>
  );
}

function bucketEventsPerSecond(timestamps: number[], windowSec: number): number[] {
  const now = Date.now();
  const buckets = new Array<number>(windowSec).fill(0);
  for (const ts of timestamps) {
    const ageSec = Math.floor((now - ts) / 1000);
    if (ageSec < 0 || ageSec >= windowSec) continue;
    // Index 0 = 60s ago, last index = now.
    const idx = windowSec - 1 - ageSec;
    buckets[idx] = (buckets[idx] ?? 0) + 1;
  }
  return buckets;
}

function formatRelative(
  timestamp: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const diffSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSec < 5) return t("nav:justNow");
  if (diffSec < 60) return t("nav:secondsAgo", { count: diffSec });
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("nav:minutesAgo", { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t("nav:hoursAgo", { count: diffHr });
  const diffDay = Math.floor(diffHr / 24);
  return t("nav:daysAgo", { count: diffDay });
}

export { STORAGE_KEY as SIDEBAR_STORAGE_KEY, loadCollapsed };
