/**
 * @file CommandPalette.tsx
 * @description Global keyboard-driven launcher, opened with Cmd/Ctrl+K from
 * anywhere in the app. One query resolves the entire surface of the dashboard:
 *
 *   • Recent   - the last few commands run, so repeat work costs two keystrokes
 *   • Pages    - every route in the sidebar, matched on its translated label
 *   • Sessions - live server-side search over /api/sessions (name, id, cwd)
 *   • Views    - page sub-tabs and list filters, reachable directly by URL
 *   • Settings - every section of the Settings page, by its own anchor
 *   • Config   - every Agent Config tab
 *   • Actions  - preferences, scope, language, links, and page-level operations
 *
 * ## Scoping the query
 * A leading sigil narrows the search the way a developer already expects:
 * `>` actions and views, `@` pages, `#` sessions, `?` opens the shortcut sheet.
 * Without one, everything is searched at once — the sigils are an accelerator,
 * never a prerequisite.
 *
 * ## Ranking
 * {@link fuzzyMatch} scores every candidate and the matched characters are
 * underlined in the row. With a catalog this large a substring filter would make
 * most commands unreachable without typing their exact wording; subsequence
 * matching makes `sh` reach "Keyboard shortcuts" and `mcp` reach "MCP servers".
 *
 * ## Why server-side session search
 * The dashboard routinely holds thousands of sessions, so the palette does not
 * hold a client-side index. Typing issues a debounced `?q=` query — the same
 * filter the Sessions page uses — which keeps results correct for the active
 * data scope (machine + provider) without duplicating any filter logic here.
 *
 * ## Degradation
 * A failed or slow session query never blocks the palette: every other group is
 * computed locally and renders immediately, and the session group simply stays
 * empty. That mirrors the app-wide rule that realtime/network delays must not
 * make the UI unusable.
 *
 * ## Accessibility
 * The panel is a modal dialog with a combobox input driving an aria-activedescendant
 * listbox. Arrow keys move the active option (with scroll-into-view), Home/End and
 * PageUp/PageDown jump, Tab moves between groups, Enter runs, Escape closes, and
 * focus returns to the previously focused element on close.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/CommandPalette.tsx
 * **Area:** client component
 * **Responsibility:**
 * Global keyboard-driven launcher, opened with Cmd/Ctrl+K from anywhere in the app. One query
 * resolves the entire surface of the dashboard: • Recent - the last few commands run, so repeat
 * work costs two keystrokes • Pages - every route in the sidebar, matched on its translated label •
 * Sessions - live server-side search over /api/sessions (name, id, cwd) • Views - page sub-tabs and
 * list filters, reachable directly by URL • Settings - every section of the Settings page, by its
 * own anchor • Config - every Agent Config tab • Actions - preferences, scope, language, links, and
 * page-level operations ## Scoping the query A leading sigil narrows the search the way a developer
 * already expects: `>` actions and views, `@` pages, `#` sessions, `?` opens the shortcut sheet.
 * Without one, everything is searched at once — the sigils are an accelerator, never a
 * prerequisite. ## Ranking {@link fuzzyMatch} scores every candidate and the matched characters are
 * underlined in the row. With a catalog this large a substring filter would make most commands
 * unreachable without typing their exact wording; subsequence matching makes `sh` reach "Keyboard
 * shortcuts" and `mcp` reach "MCP servers". ## Why server-side session search The dashboard
 * routinely holds thousands of sessions, so the palette does not hold a client-side index. Typing
 * issues a debounced `?q=` query — the same filter the Sessions page uses — which keeps results
 * correct for the active data scope (machine + provider) without duplicating any filter logic here.
 * ## Degradation A failed or slow session query never blocks the palette: every other group is
 * computed locally and renders immediately, and the session group simply stays empty. That mirrors
 * the app-wide rule that realtime/network delays must not make the UI unusable. ## Accessibility
 * The panel is a modal dialog with a combobox input driving an aria-activedescendant listbox. Arrow
 * keys move the active option (with scroll-into-view), Home/End and PageUp/PageDown jump, Tab moves
 * between groups, Enter runs, Escape closes, and focus returns to the previously focused element on
 * close.
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
 * - `../lib/appEvents` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/dataScope` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/fuzzy` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/paletteCommands` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../lib/paletteDiscovery` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../lib/recentCommands` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/sound` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./PaletteActionProvider` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `./Tabby/prefs` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `COMMAND_PALETTE_EVENT` (re-export) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `CommandPalette` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `openCommandPalette` (re-export) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CommandPalette` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `NOTIF_KEY` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PAGE_JUMP` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PaletteItem` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `readNotificationsEnabled` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SEARCH_DEBOUNCE_MS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SESSION_RESULT_LIMIT` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `writeNotificationsEnabled` (function) — top-level declaration that helps orient code review
 *   and focused test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useId` — lifecycle/state dependency detected in this module; preserve dependency freshness and
 *   cleanup semantics.
 * - `useLocation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useNavigate` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `usePaletteActions` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/CommandPalette.tsx` .
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
 * **Path:** `client/src/components/CommandPalette.tsx`
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
 * - `../lib/types`
 * - `../lib/fuzzy`
 * - `../lib/paletteCommands`
 * - `../lib/recentCommands`
 * - `../lib/paletteDiscovery`
 * - `../lib/dataScope`
 * - `../lib/sound`
 * - `./Tabby/prefs`
 * - `./PaletteActionProvider`
 * - `../lib/appEvents`
 *
 * ## Public surface
 * - `CommandPalette` — exported API; see TSDoc on the symbol for behavior.
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
 * **CommandPalette**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { CornerDownLeft, FolderOpen, Search, type LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import type { Session } from "../lib/types";
import { fuzzyMatchFields, highlightSegments } from "../lib/fuzzy";
import {
  buildPaletteCommands,
  COMMAND_GROUP_ORDER,
  type CommandGroup,
  type PaletteCommand,
} from "../lib/paletteCommands";
import { clearRecentCommands, loadRecentCommands, rememberCommand } from "../lib/recentCommands";
import { markPaletteDiscovered } from "../lib/paletteDiscovery";
import {
  getScope,
  setProviderScope,
  setScope as setDataScope,
  type DataScope,
  type ProviderScope,
} from "../lib/dataScope";
import { getSoundPrefs, setSoundPrefs, subscribeToSoundPrefs } from "../lib/sound";
import { tabbyPrefs } from "./Tabby/prefs";
import { usePaletteActions } from "./PaletteActionProvider";
import { announceAction, COMMAND_PALETTE_EVENT, requestUpdateCheck } from "../lib/appEvents";

// Re-exported so existing callers (and tests) can keep importing the palette's
// trigger from the palette; the definitions live in `lib/appEvents` to keep the
// sidebar and the palette from importing each other.
export { COMMAND_PALETTE_EVENT, openCommandPalette } from "../lib/appEvents";

/** Debounce for the session query — long enough to skip intermediate keystrokes,
 *  short enough that results feel attached to what was typed. */
const SEARCH_DEBOUNCE_MS = 180;

/** Session results are a shortlist, not a browsable page — the Sessions view
 *  exists for that, and a long list defeats the point of a launcher. */
const SESSION_RESULT_LIMIT = 6;

/** How many rows PageUp/PageDown travel. */
const PAGE_JUMP = 6;

/** A command as listed in the palette, with its fuzzy-match result. */
interface PaletteItem extends PaletteCommand {
  /** Character positions in `label` that matched, for underlining. */
  indices: number[];
  /** Fuzzy-match score used to rank items within their group. */
  score: number;
}

/** `localStorage` key the Settings page uses for browser-notification prefs. */
const NOTIF_KEY = "agent-monitor-notifications";

/** Read the Settings page's notification toggle without importing the page. */
function readNotificationsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? Boolean(JSON.parse(raw)?.enabled) : false;
  } catch {
    return false;
  }
}

/**
 * Write it back in the same shape, preserving the per-event flags. Enabling also
 * has to ask the browser for permission — a stored `true` with permission denied
 * is a toggle that lies.
 *
 * @param enabled - New value of the browser-notification master switch.
 */
function writeNotificationsEnabled(enabled: boolean): void {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    const prefs = raw ? JSON.parse(raw) : {};
    localStorage.setItem(NOTIF_KEY, JSON.stringify({ ...prefs, enabled }));
  } catch {
    /* preference persistence is best-effort */
  }
  if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

/**
 * Global command palette. Mounted once by {@link Layout}; renders nothing until
 * opened with Cmd/Ctrl+K.
 */
export function CommandPalette() {
  const { t, i18n } = useTranslation([
    "nav",
    "settings",
    "ccConfig",
    "analytics",
    "sessions",
    "dashboard",
    "kanban",
  ]);
  const navigate = useNavigate();
  const location = useLocation();
  const { run, boundIds } = usePaletteActions();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // Results are stored with the term that produced them. Rendering is derived by
  // comparing that term to what is typed now, so a slow response can never leave
  // the previous query's sessions on screen — and therefore selectable — while a
  // newer query is pending. Clearing on every keystroke instead would work, but
  // this keeps the two facts (results, and what they answer) impossible to
  // desynchronize.
  const [sessionResults, setSessionResults] = useState<{ term: string; sessions: Session[] }>({
    term: "",
    sessions: [],
  });
  const [searching, setSearching] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  // Preference state is mirrored here so toggle rows can show live on/off pills
  // and flip on the first press rather than the second.
  const [soundEnabled, setSoundEnabledState] = useState(() => getSoundPrefs().enabled);
  const [tabbyEnabled, setTabbyEnabledState] = useState(() => tabbyPrefs.getEnabled());
  // `provider` is optional on the persisted scope; "both" is the documented
  // default, so normalize once here rather than at every read site.
  const [provider, setProvider] = useState<ProviderScope>(() => getScope().provider ?? "both");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabbyMuted, setTabbyMutedState] = useState(() => tabbyPrefs.getMuted());
  const [soundVolume, setSoundVolumeState] = useState(() => getSoundPrefs().volume);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [scope, setScopeState] = useState<DataScope>(() => getScope());
  // Facets power the "jump to a project" and "scope to a machine" groups. They
  // are fetched once per open rather than held live: the palette is the only
  // consumer, and a stale directory list is worse than a 40 ms wait.
  const [facets, setFacets] = useState<{
    projects: string[];
    sources: { id: string; label: string }[];
  }>({ projects: [], sources: [] });

  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Hovering must not steal the cursor while the user is arrowing through the
  // list: a keyboard move scrolls rows under a stationary pointer, which fires
  // mouseenter and would yank the selection back.
  const pointerActive = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // ── Open / close ──────────────────────────────────────────────────────────
  // The dashboard's only navigation chord. Claimed even while a field has focus
  // — that is the point of a global launcher — but never when Alt is also held,
  // so browser-native combos keep working.
  useEffect(() => {
    /** Cmd/Ctrl+K toggles the palette (Alt combinations are ignored). */
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  // Reset per-open so the palette never reopens showing a stale query, and
  // re-read the preferences it can toggle in case another surface changed them.
  useEffect(() => {
    if (!open) return;
    // Opening it once is proof the chord is known; the teaching hints retire here.
    markPaletteDiscovered();
    setQuery("");
    setActiveIndex(0);
    setSessionResults({ term: "", sessions: [] });
    setRecentIds(loadRecentCommands());
    setSoundEnabledState(getSoundPrefs().enabled);
    setTabbyEnabledState(tabbyPrefs.getEnabled());
    setProvider(getScope().provider ?? "both");
    setScopeState(getScope());
    setTabbyMutedState(tabbyPrefs.getMuted());
    setSoundVolumeState(getSoundPrefs().volume);
    setNotificationsEnabledState(readNotificationsEnabled());
    try {
      setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    } catch {
      setSidebarCollapsed(false);
    }
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [open]);

  useEffect(() => subscribeToSoundPrefs(() => setSoundEnabledState(getSoundPrefs().enabled)), []);

  /** Search text without surrounding whitespace. */
  const term = useMemo(() => query.trim(), [query]);

  // ── Debounced server-side session search ──────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (term.length < 2) {
      setSessionResults({ term: "", sessions: [] });
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      api.sessions
        .list({ q: term, limit: SESSION_RESULT_LIMIT, sort_by: "started_at", sort_desc: true })
        .then((res) => {
          if (!cancelled) setSessionResults({ term, sessions: res.sessions });
        })
        .catch(() => {
          // Search is an enhancement, not the palette's reason to exist — every
          // other group still works, so fail quiet rather than erroring.
          if (!cancelled) setSessionResults({ term, sessions: [] });
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
  }, [open, term]);

  // Facets for the project and machine groups. Failure is silent: those two
  // groups simply stay empty, exactly like the session group does.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Wrapped in an async IIFE so a *synchronous* throw degrades the same way a
    // rejection does. These two groups are a bonus; nothing about them is worth
    // taking the launcher down for.
    void (async () => {
      try {
        const [facetRes, sourceRes] = await Promise.all([
          api.sessions.facets(),
          api.remoteSources.list().catch(() => ({ sources: [] })),
        ]);
        if (cancelled) return;
        const labels = new Map(
          (sourceRes.sources as { id: string; label: string }[]).map((source) => [
            source.id,
            source.label,
          ])
        );
        setFacets({
          projects: facetRes.cwds,
          sources: facetRes.sources.map((id) => ({ id, label: labels.get(id) ?? id })),
        });
      } catch {
        if (!cancelled) setFacets({ projects: [], sources: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // ── Catalog ───────────────────────────────────────────────────────────────
  const commands = useMemo(() => {
    if (!open) return [];
    return buildPaletteCommands({
      t: (key, options) => t(key, options ?? {}) as string,
      navigate: (to) => {
        close();
        navigate(to);
      },
      pathname: location.pathname,
      copyLink: () => {
        close();
        navigator.clipboard
          ?.writeText(window.location.href)
          .then(() => announceAction(t("nav:palette.actionCopyLink")))
          .catch(() => {
            /* clipboard is permission-gated; a failed copy is not worth an error */
          });
      },
      language: i18n.resolvedLanguage || i18n.language || "en",
      setLanguage: (language) => {
        close();
        i18n.changeLanguage(language);
      },
      soundEnabled,
      setSoundEnabled: (enabled) => {
        setSoundPrefs({ enabled });
        setSoundEnabledState(enabled);
        announceAction(
          `${t("nav:palette.actionToggleSound")} · ${t(enabled ? "nav:palette.on" : "nav:palette.off")}`
        );
      },
      tabbyEnabled,
      setTabbyEnabled: (enabled) => {
        tabbyPrefs.setEnabled(enabled);
        setTabbyEnabledState(enabled);
        announceAction(
          `${t("nav:palette.actionToggleTabby")} · ${t(enabled ? "nav:palette.on" : "nav:palette.off")}`
        );
      },
      providerScope: provider,
      setProviderScope: (next) => {
        setProviderScope(next);
        setProvider(next);
        announceAction(t(`nav:palette.provider.${next}`));
      },
      checkForUpdates: () => {
        close();
        requestUpdateCheck();
      },
      clearRecents: () => {
        clearRecentCommands();
        setRecentIds([]);
        announceAction(t("nav:palette.actionClearRecents"));
      },
      boundIds,
      runAction: (id) => {
        close();
        run(id);
      },
      announce: announceAction,
      projects: facets.projects,
      sources: facets.sources,
      scope,
      setScope: (next) => {
        setDataScope(next);
        setScopeState(next);
      },
      notificationsEnabled,
      setNotificationsEnabled: (enabled) => {
        writeNotificationsEnabled(enabled);
        setNotificationsEnabledState(enabled);
        announceAction(
          `${t("settings:notifications.enable")} · ${t(enabled ? "nav:palette.on" : "nav:palette.off")}`
        );
      },
      soundVolume,
      setSoundVolume: (volume) => {
        setSoundPrefs({ volume });
        setSoundVolumeState(volume);
        announceAction(`${t("settings:sound.volume")} ${Math.round(volume * 100)}%`);
      },
      tabbyMuted,
      setTabbyMuted: (muted) => {
        tabbyPrefs.setMuted(muted);
        setTabbyMutedState(muted);
        announceAction(
          `${t("nav:palette.actionMuteTabby")} · ${t(muted ? "nav:palette.on" : "nav:palette.off")}`
        );
      },
      goBack: () => {
        close();
        navigate(-1);
      },
      goForward: () => {
        close();
        navigate(1);
      },
    });
  }, [
    open,
    t,
    i18n,
    navigate,
    close,
    location.pathname,
    run,
    sidebarCollapsed,
    soundEnabled,
    tabbyEnabled,
    provider,
    boundIds,
    facets,
    scope,
    notificationsEnabled,
    soundVolume,
    tabbyMuted,
  ]);

  /**
   * Items to list. With no query: recently used commands, the pages, and the current page's
   * actions. With a query: every command scored by fuzzy match, plus server-ranked session results
   * for exactly that query. Items are sorted by group first, so the list keeps a stable shape, then
   * by score.
   */
  const items = useMemo<PaletteItem[]>(() => {
    if (!open) return [];
    // Only show session results that answer what is typed right now.
    const sessions = sessionResults.term === term ? sessionResults.sessions : [];

    const sessionItems: PaletteCommand[] = sessions.map((session) => ({
      id: `session:${session.id}`,
      label: session.name || session.id,
      detail: [session.cwd, session.status].filter(Boolean).join(" · "),
      keywords: [session.id, session.cwd ?? ""],
      group: "sessions",
      icon: FolderOpen,
      run: () => {
        close();
        navigate(`/sessions/${session.id}`);
      },
    }));

    const pool = [...commands, ...sessionItems];

    // No query: show the MRU list plus the pages, which is what a launcher opened
    // by reflex is almost always for. Everything else is one keystroke away.
    if (!term) {
      const byId = new Map(pool.map((command) => [command.id, command]));
      const recent = recentIds
        .map((id) => byId.get(id))
        .filter((command): command is PaletteCommand => Boolean(command))
        .map((command) => ({ ...command, group: "recent" as const, indices: [], score: 0 }));
      const recentIdSet = new Set(recent.map((command) => command.id));
      // Pages, plus whatever the current page registered: those are the two
      // groups worth showing before a single keystroke. Everything else is one
      // letter away, and dumping the whole catalog into an empty launcher would
      // bury both.
      const rest = pool
        .filter((command) => !recentIdSet.has(command.id))
        .filter((command) => command.group === "pages" || command.group === "thisPage")
        .map((command) => ({ ...command, indices: [], score: 0 }));
      return [...recent, ...rest];
    }

    const scored: PaletteItem[] = [];
    for (const command of pool) {
      // Sessions are already ranked by the server against the same term; scoring
      // them again here would reorder a result set the server chose deliberately.
      if (command.group === "sessions") {
        scored.push({ ...command, indices: [], score: Number.POSITIVE_INFINITY });
        continue;
      }
      const match = fuzzyMatchFields(command.label, command.keywords ?? [], term);
      if (!match) continue;
      scored.push({ ...command, indices: match.indices, score: match.score });
    }

    // Sort by group first so the panel keeps a stable, learnable shape, then by
    // score inside each group.
    return scored.sort((a, b) => {
      const groupDelta =
        COMMAND_GROUP_ORDER.indexOf(a.group) - COMMAND_GROUP_ORDER.indexOf(b.group);
      if (groupDelta !== 0) return groupDelta;
      return b.score - a.score;
    });
  }, [open, commands, sessionResults, term, recentIds, close, navigate]);

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

  /**
   * Run a command and remember it in the recently used list. Session results are not remembered,
   * because their ids stop resolving once a session is pruned.
   */
  const runItem = useCallback((item: PaletteItem) => {
    // Sessions are transient rows; remembering one would fill the MRU list with
    // ids that stop resolving as soon as the session is pruned.
    if (item.group !== "sessions") setRecentIds(rememberCommand(item.id));
    item.run();
  }, []);

  /** Index of the first row of the group before/after the active row. */
  const groupStep = useCallback(
    (direction: 1 | -1): number => {
      if (items.length === 0) return 0;
      const current = items[activeIndex]?.group;
      if (direction === 1) {
        for (let i = activeIndex + 1; i < items.length; i += 1) {
          if (items[i]?.group !== current) return i;
        }
        return 0;
      }
      // Walk back to the start of the current group, then to the start of the
      // previous one — Shift+Tab from mid-group should land on a group header,
      // not one row up.
      let start = activeIndex;
      while (start > 0 && items[start - 1]?.group === current) start -= 1;
      if (start === 0) {
        // Wrapping past the first group lands on the *start* of the last one,
        // not its last row — Shift+Tab has to mean the same thing as Tab.
        const lastGroup = items[items.length - 1]?.group;
        let lastStart = items.length - 1;
        while (lastStart > 0 && items[lastStart - 1]?.group === lastGroup) lastStart -= 1;
        return lastStart;
      }
      const previousGroup = items[start - 1]?.group;
      let previousStart = start - 1;
      while (previousStart > 0 && items[previousStart - 1]?.group === previousGroup) {
        previousStart -= 1;
      }
      return previousStart;
    },
    [items, activeIndex]
  );

  /**
   * Keyboard handling: arrow keys move the selection (wrapping around), Page Up/Down and Home/End
   * jump, Tab and Shift+Tab move between groups, Enter runs the selected item, and Escape closes.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    /**
     * Select an item by index, wrapping around the ends, and switch to keyboard mode so the pointer
     * does not steal the selection.
     */
    const move = (next: number) => {
      e.preventDefault();
      pointerActive.current = false;
      if (items.length > 0) setActiveIndex(((next % items.length) + items.length) % items.length);
    };

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        close();
        return;
      case "ArrowDown":
        move(activeIndex + 1);
        return;
      case "ArrowUp":
        move(activeIndex - 1);
        return;
      case "PageDown":
        move(Math.min(activeIndex + PAGE_JUMP, items.length - 1));
        return;
      case "PageUp":
        move(Math.max(activeIndex - PAGE_JUMP, 0));
        return;
      case "Home":
        move(0);
        return;
      case "End":
        move(items.length - 1);
        return;
      case "Tab":
        // Only the input is focusable, so Tab is free to mean "next group" —
        // and trapping it here keeps the modal from leaking focus to the page.
        e.preventDefault();
        pointerActive.current = false;
        setActiveIndex(groupStep(e.shiftKey ? -1 : 1));
        inputRef.current?.focus();
        return;
      case "Enter": {
        e.preventDefault();
        const item = items[activeIndex];
        if (item) runItem(item);
        return;
      }
      default:
        return;
    }
  };

  if (!open) return null;

  const groupLabels: Record<CommandGroup, string> = {
    recent: t("nav:palette.groupRecent"),
    pages: t("nav:palette.groupPages"),
    sessions: t("nav:palette.groupSessions"),
    views: t("nav:palette.groupViews"),
    thisPage: t("nav:palette.groupThisPage"),
    projects: t("nav:palette.groupProjects"),
    settings: t("nav:palette.groupSettings"),
    config: t("nav:palette.groupConfig"),
    actions: t("nav:palette.groupActions"),
  };

  let lastGroup: CommandGroup | null = null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center p-4 pt-[12vh] animate-fade-in"
      onClick={close}
      role="presentation"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav:palette.title")}
        className="w-full max-w-2xl rounded-xl border border-border bg-surface-1 shadow-2xl shadow-black/50 overflow-hidden"
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
            placeholder={t("nav:palette.placeholder")}
            aria-label={t("nav:palette.placeholder")}
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
              {t("nav:palette.searching")}
            </span>
          )}
          <span className="text-[10px] text-gray-600 flex-shrink-0 tabular-nums">
            {t("nav:palette.resultCount", { count: items.length })}
          </span>
        </div>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={t("nav:palette.title")}
          onMouseMove={() => {
            pointerActive.current = true;
          }}
          className="max-h-[24rem] overflow-y-auto py-1"
        >
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-gray-500">{t("nav:palette.noResults")}</p>
              <p className="mt-1 text-[10px] text-gray-600">{t("nav:palette.noResultsHint")}</p>
            </div>
          ) : (
            items.map((item, index) => {
              const Icon: LucideIcon = item.icon;
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
                    onMouseEnter={() => {
                      if (pointerActive.current) setActiveIndex(index);
                    }}
                    onClick={() => runItem(item)}
                    className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer border-l-2 ${
                      active ? "bg-surface-3 border-accent" : "border-transparent"
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        active ? "text-accent" : "text-gray-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-gray-200 truncate flex-1 min-w-0">
                      {highlightSegments(item.label, item.indices).map((segment, segmentIndex) =>
                        segment.match ? (
                          <mark
                            key={segmentIndex}
                            className="bg-transparent text-accent font-semibold"
                          >
                            {segment.text}
                          </mark>
                        ) : (
                          <span key={segmentIndex}>{segment.text}</span>
                        )
                      )}
                    </span>
                    {item.state && (
                      <span className="flex-shrink-0 rounded border border-border px-1.5 py-px text-[10px] text-gray-500">
                        {item.state}
                      </span>
                    )}
                    {item.detail && (
                      <span className="text-[11px] text-gray-600 truncate max-w-[38%]">
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

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-gray-600">
          <span>{t("nav:palette.hintNavigate")}</span>
          <span>{t("nav:palette.hintSelect")}</span>
          <span>{t("nav:palette.hintClose")}</span>
        </div>
      </div>
    </div>
  );
}
