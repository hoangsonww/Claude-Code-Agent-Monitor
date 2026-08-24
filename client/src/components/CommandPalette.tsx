/**
 * @file CommandPalette.tsx
 * @description Global keyboard-driven launcher, opened with Cmd/Ctrl+K from
 * anywhere in the app. Combines three result groups behind one query:
 *   • Pages    - every route in the sidebar, matched on its translated label
 *   • Sessions - live server-side search over /api/sessions (name, id, cwd)
 *   • Actions  - a few high-value jumps that are otherwise several clicks deep
 *
 * ## Why server-side session search
 * The dashboard routinely holds thousands of sessions, so the palette does not
 * hold a client-side index. Typing issues a debounced `?q=` query — the same
 * filter the Sessions page uses — which keeps results correct for the active
 * data scope (machine + provider) without duplicating any filter logic here.
 *
 * ## Degradation
 * A failed or slow session query never blocks the palette: page and action
 * results are computed locally and render immediately, and the session group
 * simply stays empty. That mirrors the app-wide rule that realtime/network
 * delays must not make the UI unusable.
 *
 * ## Accessibility
 * The panel is a modal dialog with a combobox input driving an aria-activedescendant
 * listbox. Arrow keys move the active option (with scroll-into-view), Enter runs
 * it, Escape closes, Tab is trapped inside the dialog, and focus returns to the
 * previously focused element on close.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  BarChart3,
  Boxes,
  Columns3,
  CornerDownLeft,
  FolderOpen,
  LayoutDashboard,
  Play,
  Search,
  Settings as SettingsIcon,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

/** DOM event other chrome (e.g. the sidebar's search button) dispatches to open
 *  the palette. A window event keeps the trigger decoupled from the component —
 *  no context provider, no lifted state, and it works from anywhere in the tree. */
export const COMMAND_PALETTE_EVENT = "ccam:command-palette";

/** Open the palette from outside the component. */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

/** Debounce for the session query — long enough to skip intermediate keystrokes,
 *  short enough that results feel attached to what was typed. */
const SEARCH_DEBOUNCE_MS = 180;

/** Session results are a shortlist, not a browsable page — the Sessions view
 *  exists for that, and a long list defeats the point of a launcher. */
const SESSION_RESULT_LIMIT = 6;

interface PaletteItem {
  id: string;
  label: string;
  /** Secondary line: a route hint, or a session's project + status. */
  detail?: string;
  icon: LucideIcon;
  group: "pages" | "sessions" | "actions";
  run: () => void;
}

const NAV_ITEMS: { to: string; icon: LucideIcon; key: string }[] = [
  { to: "/", icon: LayoutDashboard, key: "dashboard" },
  { to: "/kanban", icon: Columns3, key: "agentBoard" },
  { to: "/sessions", icon: FolderOpen, key: "sessions" },
  { to: "/activity", icon: Activity, key: "activityFeed" },
  { to: "/analytics", icon: BarChart3, key: "analytics" },
  { to: "/workflows", icon: Workflow, key: "workflows" },
  { to: "/cc-config", icon: Boxes, key: "ccConfig" },
  { to: "/run", icon: Play, key: "run" },
  { to: "/settings", icon: SettingsIcon, key: "settings" },
];

/** Case- and diacritic-insensitive substring match. Deliberately not fuzzy:
 *  for a fixed set of nine page names, subsequence matching mostly produces
 *  surprising hits ("as" matching "Analytics") rather than useful ones. */
function matches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return normalize(haystack).includes(normalize(needle));
}

/**
 * Global command palette. Mounted once by {@link Layout}; renders nothing until
 * opened with Cmd/Ctrl+K.
 */
export function CommandPalette() {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searching, setSearching] = useState(false);

  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // ── Global hotkey ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // Claim the shortcut even while a field has focus — that is the point of
        // a global launcher — but never fight a browser-native combo modifier.
        if (e.altKey) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  // Reset per-open so the palette never reopens showing a stale query.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    setSessions([]);
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [open]);

  // ── Debounced server-side session search ──────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setSessions([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      api.sessions
        .list({ q: term, limit: SESSION_RESULT_LIMIT, sort_by: "started_at", sort_desc: true })
        .then((res) => {
          if (!cancelled) setSessions(res.sessions);
        })
        .catch(() => {
          // Search is an enhancement, not the palette's reason to exist — page
          // and action results still work, so fail quiet rather than erroring.
          if (!cancelled) setSessions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setSearching(false);
    };
  }, [open, query]);

  const items = useMemo<PaletteItem[]>(() => {
    const term = query.trim();
    const go = (to: string) => () => {
      close();
      navigate(to);
    };

    const pages: PaletteItem[] = NAV_ITEMS.filter((item) => matches(t(item.key), term)).map(
      (item) => ({
        id: `page:${item.to}`,
        label: t(item.key),
        detail: item.to,
        icon: item.icon,
        group: "pages",
        run: go(item.to),
      })
    );

    const sessionItems: PaletteItem[] = sessions.map((session) => ({
      id: `session:${session.id}`,
      label: session.name || session.id,
      detail: [session.cwd, session.status].filter(Boolean).join(" · "),
      icon: FolderOpen,
      group: "sessions",
      run: go(`/sessions/${session.id}`),
    }));

    // Actions are jumps that are otherwise several clicks deep. Each is matched
    // on its own translated label, so they surface by intent ("new", "alerts")
    // rather than only by the page they happen to live on.
    const actions: PaletteItem[] = [
      {
        id: "action:run",
        label: t("palette.actionNewRun"),
        detail: t("run"),
        icon: Play,
        group: "actions" as const,
        run: go("/run"),
      },
      {
        id: "action:alerts",
        label: t("palette.actionAlerts"),
        detail: t("settings"),
        icon: SettingsIcon,
        group: "actions" as const,
        run: go("/settings#alerts"),
      },
      {
        id: "action:activeSessions",
        label: t("palette.actionActiveSessions"),
        detail: t("sessions"),
        icon: Activity,
        group: "actions" as const,
        run: go("/sessions?status=active"),
      },
    ].filter((action) => matches(action.label, term));

    return [...pages, ...sessionItems, ...actions];
  }, [query, sessions, navigate, close, t]);

  // Clamp the cursor whenever the result set shrinks under it.
  useEffect(() => {
    setActiveIndex((prev) => (prev >= items.length ? Math.max(items.length - 1, 0) : prev));
  }, [items.length]);

  // Keep the active option visible when moving through a scrolled list.
  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    // Feature-detected: scrollIntoView is absent in jsdom and in some embedded
    // webviews, and keeping the option visible is a nicety, not a requirement.
    if (typeof active?.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length > 0) setActiveIndex((prev) => (prev + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length > 0) setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      items[activeIndex]?.run();
      return;
    }
    if (e.key === "Tab" && panelRef.current) {
      // Only the input and the option rows are focusable, so trapping Tab keeps
      // the modal from leaking focus to the page behind it.
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  const groupLabels: Record<PaletteItem["group"], string> = {
    pages: t("palette.groupPages"),
    sessions: t("palette.groupSessions"),
    actions: t("palette.groupActions"),
  };

  let lastGroup: PaletteItem["group"] | null = null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-[12vh]"
      onClick={close}
      role="presentation"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        className="w-full max-w-xl rounded-xl border border-border bg-surface-1 shadow-xl shadow-black/40 overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.placeholder")}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={items[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 outline-none min-w-0"
          />
          {searching && (
            <span className="text-[10px] text-gray-600 flex-shrink-0">
              {t("palette.searching")}
            </span>
          )}
        </div>

        <div ref={listRef} id={listboxId} role="listbox" className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">{t("palette.noResults")}</p>
          ) : (
            items.map((item, index) => {
              const Icon = item.icon;
              const active = index === activeIndex;
              const showHeader = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {showHeader && (
                    <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                      {groupLabels[item.group]}
                    </div>
                  )}
                  <div
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={active}
                    data-active={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={item.run}
                    className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer ${
                      active ? "bg-surface-3" : ""
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm text-gray-200 truncate flex-1 min-w-0">
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="text-[11px] text-gray-600 truncate max-w-[45%]">
                        {item.detail}
                      </span>
                    )}
                    {active && (
                      <CornerDownLeft
                        className="w-3 h-3 text-gray-600 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[10px] text-gray-600">
          <span>{t("palette.hintNavigate")}</span>
          <span>{t("palette.hintSelect")}</span>
          <span>{t("palette.hintClose")}</span>
        </div>
      </div>
    </div>
  );
}
