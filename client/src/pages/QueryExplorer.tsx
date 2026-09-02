/**
 * @file QueryExplorer.tsx
 * @description Advanced Query Explorer page. Lets power users filter sessions,
 * agents, or events across all tracked dimensions without raw SQL access. Results
 * render in a paginated table and can be exported as CSV or JSON.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileJson,
  FileText,
  Filter,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { activeProvidersParam, activeSourcesParam, useDataScope } from "../lib/dataScope";
import { EmptyState } from "../components/EmptyState";
import { TableRowSkeleton } from "../components/Skeleton";
import { formatDateTime } from "../lib/format";

type Entity = "sessions" | "agents" | "events";
type SortDir = "asc" | "desc";

function isoToLocalInput(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface QueryResult {
  entity: Entity;
  rows: Record<string, unknown>[];
  columns: string[];
  total: number;
  limit: number;
  offset: number;
}

interface Facets {
  statuses?: string[];
  event_types?: string[];
  tool_names?: string[];
}

const PAGE_SIZE = 50;

const DATETIME_COLS = new Set(["started_at", "ended_at", "created_at", "updated_at"]);

function buildExportUrl(
  entity: Entity,
  filters: Record<string, string>,
  scopeParam: string,
  format: string
) {
  const params = new URLSearchParams({ entity, format });
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  if (scopeParam) new URLSearchParams(scopeParam).forEach((v, k) => params.set(k, v));
  return `/api/query/export?${params.toString()}`;
}

function CellValue({ col, value }: { col: string; value: unknown }) {
  if (value == null || value === "") return <span className="text-gray-600">—</span>;
  if (DATETIME_COLS.has(col) && typeof value === "string") {
    return <span title={value}>{formatDateTime(value)}</span>;
  }
  const s = String(value);
  if (s.length > 60)
    return (
      <span title={s} className="truncate max-w-[200px] block">
        {s.slice(0, 60)}…
      </span>
    );
  return <span>{s}</span>;
}

export function QueryExplorer() {
  const { t } = useTranslation("nav");
  const [scope] = useDataScope();
  // `api.query.run` does not auto-inject the global scope (unlike sessions/stats
  // endpoints), so build the `sources`/`providers` query fragment here. Rebuilt
  // only when the global scope actually changes.
  const scopeParam = useMemo(() => {
    const qs = new URLSearchParams();
    const sources = activeSourcesParam();
    const providers = activeProvidersParam();
    if (sources) qs.set("sources", sources);
    if (providers) qs.set("providers", providers);
    return qs.toString();
  }, [scope]);

  const [entity, setEntity] = useState<Entity>("events");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [facets, setFacets] = useState<Facets>({});
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [q, setQ] = useState("");

  const activeFilters = useMemo(
    () => ({ ...filters, q, sort_by: sortBy, sort_dir: sortDir }),
    [filters, q, sortBy, sortDir]
  );

  // Monotonic request id so an out-of-order/late response can never overwrite
  // state produced by a request started after it.
  const requestIdRef = useRef(0);

  const runQuery = useCallback(
    async (off = 0) => {
      const reqId = ++requestIdRef.current;
      setLoading(true);
      setError(null);
      try {
        const data = await api.query.run({
          entity,
          filters: activeFilters,
          limit: PAGE_SIZE,
          offset: off,
          scope: scopeParam ?? "",
        });
        if (reqId !== requestIdRef.current) return; // superseded by a newer request
        setResult(data as QueryResult);
        setOffset(off);
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : "Query failed");
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    },
    [entity, activeFilters, scopeParam]
  );

  // Always-current ref to runQuery, so callers that must fire it from inside
  // a setState updater or a setTimeout (after sortBy/sortDir just changed)
  // invoke the version closed over the latest activeFilters, not a stale one.
  const runQueryRef = useRef(runQuery);
  useEffect(() => {
    runQueryRef.current = runQuery;
  }, [runQuery]);

  const facetRequestIdRef = useRef(0);
  const loadFacets = useCallback(async () => {
    const reqId = ++facetRequestIdRef.current;
    try {
      const data = await api.query.facets(entity, scopeParam ?? "");
      if (reqId !== facetRequestIdRef.current) return;
      setFacets(data as Facets);
    } catch {
      // facets are best-effort
    }
  }, [entity, scopeParam]);

  const handleSort = useCallback((col: string) => {
    setSortBy((prevBy) => {
      const isSame = prevBy === col;
      setSortDir((prevDir) => (isSame ? (prevDir === "asc" ? "desc" : "asc") : "desc"));
      return col;
    });
    setTimeout(() => runQueryRef.current(0), 0);
  }, []);

  useEffect(() => {
    loadFacets();
    setFilters({});
    setQ("");
    setSortBy("");
    setSortDir("desc");
    setResult(null);
    setOffset(0);
  }, [entity, scopeParam]);

  const handleExport = (format: "csv" | "json") => {
    const url = buildExportUrl(entity, activeFilters, scopeParam ?? "", format);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  };

  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const setFilter = (key: string, val: string) => setFilters((prev) => ({ ...prev, [key]: val }));

  const clearFilters = () => {
    setFilters({});
    setQ("");
    setSortBy("");
    setSortDir("desc");
  };

  const hasActiveFilters = q || Object.values(filters).some(Boolean);

  const inputCls =
    "bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-[#58a6ff] w-full";

  const btnBase = "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors";
  const btnGhost = `${btnBase} border-[#30363d] text-gray-400 hover:text-gray-200 hover:border-[#58a6ff] disabled:opacity-40 disabled:cursor-not-allowed`;
  const btnPrimary = `${btnBase} border-[#238636] bg-[#238636] text-white hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="flex flex-col gap-5 p-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">{t("queryExplorer")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t("queryExplorerSub")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={() => runQuery(offset)} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {t("queryRun")}
          </button>
          <button className={btnGhost} onClick={() => handleExport("csv")} disabled={!result}>
            <FileText size={13} />
            CSV
          </button>
          <button className={btnGhost} onClick={() => handleExport("json")} disabled={!result}>
            <FileJson size={13} />
            JSON
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex flex-col gap-4">
        {/* Entity tabs */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {t("queryEntity")}
          </label>
          <div className="flex gap-1">
            {(["sessions", "agents", "events"] as Entity[]).map((e) => (
              <button
                key={e}
                onClick={() => setEntity(e)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  entity === e
                    ? "border-[#58a6ff] bg-[#1c2d45] text-[#58a6ff]"
                    : "border-[#30363d] text-gray-400 hover:text-gray-200"
                }`}
              >
                {t(`queryEntity_${e}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Text search */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{t("querySearch")}</label>
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                className={`${inputCls} pl-6`}
                placeholder={t("querySearchPlaceholder")}
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") runQuery(0);
                }}
              />
            </div>
          </div>

          {/* From */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{t("queryFrom")}</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={isoToLocalInput(filters.from)}
              onChange={(ev) =>
                setFilter("from", ev.target.value ? new Date(ev.target.value).toISOString() : "")
              }
            />
          </div>

          {/* To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{t("queryTo")}</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={isoToLocalInput(filters.to)}
              onChange={(ev) =>
                setFilter("to", ev.target.value ? new Date(ev.target.value).toISOString() : "")
              }
            />
          </div>

          {/* Status (sessions/agents) */}
          {entity !== "events" && facets.statuses && facets.statuses.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("queryStatus")}</label>
              <select
                className={inputCls}
                value={filters.status ?? ""}
                onChange={(ev) => setFilter("status", ev.target.value)}
              >
                <option value="">{t("queryAll")}</option>
                {facets.statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Event type */}
          {entity === "events" && facets.event_types && facets.event_types.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("queryEventType")}</label>
              <select
                className={inputCls}
                value={filters.event_type ?? ""}
                onChange={(ev) => setFilter("event_type", ev.target.value)}
              >
                <option value="">{t("queryAll")}</option>
                {facets.event_types.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tool name */}
          {entity === "events" && facets.tool_names && facets.tool_names.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t("queryToolName")}</label>
              <select
                className={inputCls}
                value={filters.tool_name ?? ""}
                onChange={(ev) => setFilter("tool_name", ev.target.value)}
              >
                <option value="">{t("queryAll")}</option>
                {facets.tool_names.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className={btnPrimary} onClick={() => runQuery(0)} disabled={loading}>
            <Filter size={13} />
            {t("queryApply")}
          </button>
          {hasActiveFilters && (
            <button className={btnGhost} onClick={clearFilters}>
              <X size={13} />
              {t("queryClear")}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#1f0000] border border-[#6e0000] rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Empty state (before first query) */}
      {!result && !loading && !error && (
        <EmptyState icon={Search} title={t("queryEmptyTitle")} description={t("queryEmptyDesc")} />
      )}

      {/* Results */}
      {(loading || result) && (
        <div className="flex flex-col gap-3">
          {result && (
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>{t("queryResultCount", { count: result.total })}</span>
              <div className="flex items-center gap-1">
                <button
                  className="p-1 rounded border border-[#30363d] hover:border-[#58a6ff] disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={offset === 0 || loading}
                  onClick={() => runQuery(offset - PAGE_SIZE)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="p-1 rounded border border-[#30363d] hover:border-[#58a6ff] disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={offset + PAGE_SIZE >= (result?.total ?? 0) || loading}
                  onClick={() => runQuery(offset + PAGE_SIZE)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-[#30363d] rounded-lg">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[#30363d] bg-[#161b22]">
                  {(result?.columns ?? []).map((col) => (
                    <th
                      key={col}
                      scope="col"
                      aria-sort={
                        sortBy === col ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                      }
                      className="px-3 py-2 text-xs font-medium text-gray-400 whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={`flex items-center gap-1 select-none hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff] rounded ${sortBy === col ? "text-[#58a6ff]" : ""}`}
                      >
                        {col}
                        {sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRowSkeleton key={i} columns={result?.columns.length ?? 5} />
                    ))
                  : result?.rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#21262d] hover:bg-[#1c2128] transition-colors"
                      >
                        {result.columns.map((col) => (
                          <td key={col} className="px-3 py-2 text-gray-300 whitespace-nowrap">
                            <CellValue col={col} value={row[col]} />
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {result && result.rows.length === 0 && !loading && (
            <EmptyState
              icon={Download}
              title={t("queryNoResults")}
              description={t("queryNoResultsDesc")}
            />
          )}
        </div>
      )}
    </div>
  );
}
