/**
 * @file Audit.tsx
 * @description Tool Risk Audit page (`/audit`, issue #301): a read-only security lens over the tool
 * calls agents already ran. Severity tiles and signal chips summarise what the server-side ruleset
 * flagged (privilege escalation, destructive commands, remote code execution, credential access,
 * network egress, writes outside the project); a filterable, paginated table shows each flagged
 * call with the exact matched text, expands into the full stored event, and exports to CSV/JSON.
 * While the server back-fills its risk index the page shows progress and polls until complete.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/pages/Audit.tsx
 * **Area:** client page
 * **Responsibility:**
 * Tool Risk Audit page (`/audit`, issue #301): a read-only security lens over the tool calls agents
 * already ran. Severity tiles and signal chips summarise what the server-side ruleset flagged
 * (privilege escalation, destructive commands, remote code execution, credential access, network
 * egress, writes outside the project); a filterable, paginated table shows each flagged call with
 * the exact matched text, expands into the full stored event, and exports to CSV/JSON. While the
 * server back-fills its risk index the page shows progress and polls until complete.
 *
 * ## Architectural boundary
 * - Route-level orchestration belongs here: load scoped data, subscribe to live updates, and
 *   compose reusable components.
 * - Server authority remains on the API side; the page may explain or confirm actions but must not
 *   invent authorization rules.
 * - The global data-source scope must flow through shared API helpers so local, all-source, and
 *   selected-source views agree.
 *
 * ## Local dependency edges
 * - `../components/EmptyState` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../components/EventDetail` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../components/PaletteActionProvider` — repository-local contract consumed by this module;
 *   review its exports before changing assumptions here.
 * - `../components/Skeleton` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/dataScope` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/event-grouping` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/eventBus` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/format` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
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
 * - `Audit` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `highlightMatch` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SEVERITY_ORDER` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SIGNAL_ORDER` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `Audit` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `AuditRowDetail` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `highlightMatch` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `INDEX_POLL_MS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `LIVE_DEBOUNCE_MS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PAGE_SIZE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `RangeId` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `RANGES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SEARCH_DEBOUNCE_MS` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `SEVERITY_ORDER` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SEVERITY_STYLE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SeverityBadge` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SIGNAL_ORDER` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useDataScope` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `usePaletteAction` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRef` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `audit` — visible copy resolves through this namespace; key and interpolation parity applies to
 *   every supported locale.
 *
 * ## Area invariants
 * - Represent loading, empty, partial, error, and refreshed states deliberately; a blank panel is
 *   not an error strategy.
 * - Cancel or ignore stale asynchronous work when parameters, source scope, or component lifetime
 *   changes.
 * - Merge WebSocket deltas without duplicating entities already returned by the REST snapshot.
 * - Keep query parameters and route state shareable when the surrounding router already exposes
 *   that state in URLs.
 * - Use translation keys for visible copy and preserve interpolation tokens across every supported
 *   locale.
 * - Keep expensive derivations memoized only when profiling or dependency stability justifies the
 *   extra contract.
 * - Preserve keyboard focus and useful headings when switching tabs, filters, drawers, or modal
 *   states.
 * - Do not make destructive requests without the confirmation and server-side gate required by the
 *   underlying API.
 * - Use canonical formatting helpers for timestamps, durations, token counts, costs, and provider
 *   labels.
 * - Keep page-level polling and event subscriptions bounded; cleanup must run on unmount and scope
 *   changes.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/pages/Audit.tsx` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  Info,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { useDataScope } from "../lib/dataScope";
import { usePaletteAction } from "../components/PaletteActionProvider";
import { EmptyState } from "../components/EmptyState";
import { EventDetail } from "../components/EventDetail";
import { Skeleton } from "../components/Skeleton";
import { formatDateShort, formatTime, timeAgo } from "../lib/format";
import { projectFromCwd } from "../lib/event-grouping";
import type {
  DashboardEvent,
  ToolRiskEvent,
  ToolRiskFilters,
  ToolRiskIndexStatus,
  ToolRiskSeverity,
  ToolRiskSignalName,
  ToolRiskSummary,
} from "../lib/types";

/** Rows per page. */
const PAGE_SIZE = 50;
/** Poll interval while the server is still back-filling its risk index. */
const INDEX_POLL_MS = 2000;
/** Debounce for refreshes triggered by live tool events and for the search box. */
const LIVE_DEBOUNCE_MS = 1500;
const SEARCH_DEBOUNCE_MS = 300;

/** Severities, highest first (tile order). */
export const SEVERITY_ORDER: ToolRiskSeverity[] = ["critical", "high", "medium", "low"];
/** Signal families in the order the issue lists them. */
export const SIGNAL_ORDER: ToolRiskSignalName[] = [
  "privilege",
  "destructive",
  "remote-exec",
  "credential-access",
  "egress",
  "outside-cwd",
];

/** Tailwind classes per severity (badge + tile accent). */
const SEVERITY_STYLE: Record<ToolRiskSeverity, { badge: string; text: string }> = {
  critical: { badge: "bg-red-500/15 text-red-300 border-red-500/30", text: "text-red-300" },
  high: { badge: "bg-orange-500/15 text-orange-300 border-orange-500/30", text: "text-orange-300" },
  medium: {
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    text: "text-yellow-300",
  },
  low: { badge: "bg-sky-500/10 text-sky-300 border-sky-500/25", text: "text-sky-300" },
};

/** Time-range presets and their window length in hours (null = all time). */
const RANGES = [
  { id: "24h", hours: 24 },
  { id: "7d", hours: 24 * 7 },
  { id: "30d", hours: 24 * 30 },
  { id: "all", hours: null },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

/**
 * Split `text` around the first case-insensitive occurrence of any `needles`, so the matched
 * fragment can be highlighted. Returns the plain text when nothing matches.
 */
export function highlightMatch(text: string, needles: string[]): ReactNode {
  const lower = text.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const needle of needles) {
    if (!needle) continue;
    const index = lower.indexOf(needle.toLowerCase());
    if (index >= 0 && (!best || index < best.index)) best = { index, length: needle.length };
  }
  if (!best) return text;
  return (
    <>
      {text.slice(0, best.index)}
      <mark className="bg-red-500/20 text-red-200 rounded px-0.5">
        {text.slice(best.index, best.index + best.length)}
      </mark>
      {text.slice(best.index + best.length)}
    </>
  );
}

/** Severity pill. */
function SeverityBadge({ severity }: { severity: ToolRiskSeverity }) {
  const { t } = useTranslation("audit");
  return (
    <span
      className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${SEVERITY_STYLE[severity].badge}`}
    >
      {t(`severity.${severity}`)}
    </span>
  );
}

/** Expanded row: why it was flagged, then the full stored event (fetched lazily). */
function AuditRowDetail({ row }: { row: ToolRiskEvent }) {
  const { t } = useTranslation("audit");
  const [event, setEvent] = useState<DashboardEvent | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    api.audit
      .event(row.event_id)
      .then(({ event: full }) => {
        if (cancelled) return;
        setEvent(full);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [row.event_id]);

  return (
    <div className="bg-surface-2/60 border-t border-border">
      <div className="px-5 py-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{t("why")}</p>
        <ul className="space-y-1.5">
          {row.signals.map((s, i) => (
            <li key={`${s.rule}-${i}`} className="flex flex-wrap items-center gap-2 text-xs">
              <SeverityBadge severity={s.severity} />
              <span className="text-gray-300">{t(`signals.${s.signal}`)}</span>
              <span className="text-gray-500">
                {t("rule")}: <code className="font-mono text-gray-400">{s.rule}</code>
              </span>
              <span className="text-gray-500">
                {t("matched")}: <code className="font-mono text-red-200 break-all">{s.match}</code>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {state === "loading" && (
        <p className="px-5 pb-3 text-xs text-gray-500">{t("loadingEvent")}</p>
      )}
      {state === "missing" && (
        <p className="px-5 pb-3 text-xs text-gray-500">{t("eventUnavailable")}</p>
      )}
      {state === "ready" && event && <EventDetail event={event} />}
    </div>
  );
}

/**
 * Tool Risk Audit page. Reads `/api/audit/summary` for the tiles and `/api/audit/tools` for the
 * table; both honour the global data scope and the page's own filters.
 */
export function Audit() {
  const { t } = useTranslation("audit");
  const [range, setRange] = useState<RangeId>("7d");
  const [severity, setSeverity] = useState<ToolRiskSeverity | null>(null);
  const [signals, setSignals] = useState<ToolRiskSignalName[]>([]);
  const [host, setHost] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ToolRiskEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ToolRiskSummary | null>(null);
  const [status, setStatus] = useState<ToolRiskIndexStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [scope] = useDataScope();
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search box into the query filter.
  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  /** Filters shared by the tiles (which ignore severity/signal so they stay a full overview). */
  const baseFilters = useMemo<ToolRiskFilters>(() => {
    const hours = RANGES.find((r) => r.id === range)?.hours ?? null;
    return {
      from: hours ? new Date(Date.now() - hours * 3600 * 1000).toISOString() : undefined,
      q: q || undefined,
      host: host ? [host] : undefined,
    };
  }, [range, q, host]);

  const listFilters = useMemo<ToolRiskFilters>(
    () => ({
      ...baseFilters,
      severity: severity ? [severity] : undefined,
      signal: signals.length > 0 ? signals : undefined,
    }),
    [baseFilters, severity, signals]
  );

  // A filter change returns to the first page and collapses open rows.
  useEffect(() => {
    setPage(0);
    setExpanded(new Set());
  }, [listFilters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        api.audit.list({ ...listFilters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        api.audit.summary(baseFilters),
      ]);
      setRows(list.events);
      setTotal(list.total);
      setSummary(sum);
      setStatus({ indexing: sum.indexing, coverage: sum.coverage });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // `scope` re-runs the load when the global data scope changes (api injects it).
  }, [listFilters, baseFilters, page, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll while the server is still back-filling the index.
  const indexing = status ? !status.indexing.complete : false;
  useEffect(() => {
    if (!indexing) return;
    const id = setTimeout(() => void load(), INDEX_POLL_MS);
    return () => clearTimeout(id);
  }, [indexing, load]);

  // New tool calls may add flagged rows: refresh, debounced.
  useEffect(() => {
    const unsubscribe = eventBus.subscribe((msg) => {
      if (msg.type !== "new_event") return;
      const event = msg.data as DashboardEvent;
      if (event?.event_type !== "PreToolUse" && event?.event_type !== "codex_tool_call") return;
      if (liveTimer.current) clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(() => {
        liveTimer.current = null;
        void load();
      }, LIVE_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
  }, [load]);

  usePaletteAction("page.refresh", () => {
    void load();
  });

  const hasFilters = severity !== null || signals.length > 0 || host !== null || q !== "";
  const clearFilters = () => {
    setSeverity(null);
    setSignals([]);
    setHost(null);
    setSearchInput("");
    setQ("");
  };

  const toggleSignal = (signal: ToolRiskSignalName) =>
    setSignals((prev) =>
      prev.includes(signal) ? prev.filter((s) => s !== signal) : [...prev, signal]
    );

  const toggleRow = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doExport = async (format: "csv" | "json") => {
    try {
      const { blob, filename } = await api.audit.export(format, listFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(t("exportFailed", { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const percent =
    status && status.indexing.max_event_id > 0
      ? Math.floor((status.indexing.last_event_id / status.indexing.max_event_id) * 100)
      : 0;
  const signalCounts = new Map(summary?.by_signal.map((s) => [s.signal, s.events]) ?? []);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <ShieldAlert className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => void doExport("csv")} className="btn-ghost">
            <Download className="w-4 h-4" /> {t("exportCsv")}
          </button>
          <button onClick={() => void doExport("json")} className="btn-ghost">
            <Download className="w-4 h-4" /> {t("exportJson")}
          </button>
          <button
            onClick={() => void load()}
            className="btn-ghost"
            aria-label={t("common:refresh")}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          {t("readOnly")}
        </p>
        {indexing && (
          <p className="text-xs text-accent" role="status">
            {t("indexing", { percent })}
          </p>
        )}
        {status && status.coverage.degraded > 0 && (
          <p className="text-xs text-yellow-400/90">
            {t("coverage", {
              degraded: status.coverage.degraded,
              scanned: status.coverage.scanned,
            })}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {t("loadFailed", { message: error })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {SEVERITY_ORDER.map((sev) => {
          const active = severity === sev;
          return (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverity(active ? null : sev)}
              aria-pressed={active}
              className={`card px-4 py-3 text-left transition-colors cursor-pointer ${active ? "ring-1 ring-accent" : "hover:bg-surface-4"}`}
            >
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                {t(`severity.${sev}`)}
              </p>
              <p className={`text-2xl font-semibold ${SEVERITY_STYLE[sev].text}`}>
                {summary ? summary.by_severity[sev] : "–"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {SIGNAL_ORDER.map((signal) => {
          const active = signals.includes(signal);
          return (
            <button
              key={signal}
              type="button"
              onClick={() => toggleSignal(signal)}
              aria-pressed={active}
              title={t(`signalHelp.${signal}`)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${active ? "bg-accent/15 border-accent/40 text-accent" : "bg-surface-2 border-border text-gray-400 hover:text-gray-200"}`}
            >
              {t(`signals.${signal}`)}
              <span className="ml-1.5 text-gray-500">{signalCounts.get(signal) ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="input w-full pl-8"
          />
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeId)}
          aria-label={t("range.label")}
          className="input"
        >
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {t(`range.${r.id}`)}
            </option>
          ))}
        </select>
        {host && (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-accent/15 text-accent border border-accent/30">
            <Globe className="w-3 h-3" /> {host}
            <button
              type="button"
              onClick={() => setHost(null)}
              aria-label={t("clearFilters")}
              className="cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="btn-ghost text-xs">
            {t("clearFilters")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div className="min-w-0">
          {!loading && rows.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={hasFilters ? t("emptyFiltered") : t("empty")}
              description={hasFilters ? "" : t("emptyDesc")}
            />
          ) : (
            <div className="card overflow-hidden">
              <div className="px-5 py-2.5 border-b border-border text-xs text-gray-500">
                {t("flagged", { count: total })}
              </div>
              <div className="divide-y divide-border">
                {loading && rows.length === 0
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={`sk-${i}`}
                        className="flex items-center px-5 py-3.5 gap-4"
                        aria-busy="true"
                      >
                        <Skeleton className="h-3 w-14" />
                        <Skeleton className="h-5 w-16" rounded="full" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                    ))
                  : null}
                {rows.map((row) => {
                  const open = expanded.has(row.event_id);
                  const project = projectFromCwd(row.project);
                  const session =
                    row.session_name?.trim() || `Session ${row.session_id.slice(0, 8)}`;
                  return (
                    <div key={row.event_id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={() => toggleRow(row.event_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleRow(row.event_id);
                          }
                        }}
                        className="flex items-center px-5 py-3 gap-3 hover:bg-surface-4 transition-colors cursor-pointer select-none"
                      >
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`}
                        />
                        <div className="w-14 flex-shrink-0 text-right font-mono leading-tight">
                          <div className="text-[11px] text-gray-500">
                            {formatTime(row.created_at)}
                          </div>
                          <div className="text-[9px] text-gray-600">
                            {formatDateShort(row.created_at)}
                          </div>
                        </div>
                        <SeverityBadge severity={row.max_severity} />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm text-gray-300 font-mono truncate"
                            title={row.target ?? ""}
                          >
                            {highlightMatch(
                              row.target ?? "",
                              row.signals.map((s) => s.match)
                            )}
                          </p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {[project, session].filter(Boolean).join(" · ")}
                            {" · "}
                            {[...new Set(row.signals.map((s) => t(`signals.${s.signal}`)))].join(
                              ", "
                            )}
                            {row.degraded && (
                              <span className="ml-1 text-yellow-400/80">({t("summaryOnly")})</span>
                            )}
                          </p>
                        </div>
                        {row.tool_name && (
                          <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
                            {row.tool_name}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-600 flex-shrink-0 w-16 text-right">
                          {timeAgo(row.created_at)}
                        </span>
                        <Link
                          to={`/sessions/${row.session_id}`}
                          onClick={(e) => e.stopPropagation()}
                          title={t("viewSession")}
                          aria-label={t("viewSession")}
                          className="flex items-center text-gray-500 hover:text-accent flex-shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      {open && <AuditRowDetail row={row} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-gray-500">
                {t("common:pagination.showing", {
                  from: page * PAGE_SIZE + 1,
                  to: Math.min((page + 1) * PAGE_SIZE, total),
                  total,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t("common:pagination.previous")}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t("common:pagination.next")}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="card px-4 py-3 h-fit">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{t("topHosts")}</p>
          {summary && summary.top_hosts.length > 0 ? (
            <ul className="space-y-1">
              {summary.top_hosts.map((h) => (
                <li key={h.host}>
                  <button
                    type="button"
                    onClick={() => setHost(host === h.host ? null : h.host)}
                    aria-pressed={host === h.host}
                    className={`w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded cursor-pointer ${host === h.host ? "bg-accent/15 text-accent" : "text-gray-400 hover:bg-surface-4"}`}
                  >
                    <span className="font-mono truncate">{h.host}</span>
                    <span className="text-gray-500">{h.events}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-600">{t("noHosts")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
