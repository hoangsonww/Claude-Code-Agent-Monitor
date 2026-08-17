/**
 * @file QueryExplorer.tsx
 * @description Advanced Query Explorer page. Lets power users filter sessions,
 * agents, or events across all tracked dimensions without raw SQL access. Results
 * render in a paginated table and can be exported as CSV or JSON.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
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
import { useDataScope } from "../lib/dataScope";
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
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  if (scopeParam) new URLSearchParams(scopeParam).forEach((v, k) => params.set(k, v));
  return `/api/query/export?${params.toString()}`;
}

function CellValue({ col, value }: { col: string; value: unknown }) {
  if (value == null || value === "") return <span className="text-gray-600">—</span>;
  if (DATETIME_COLS.has(col) && typeof value === "string") {
    return <span title={value}>{formatDateTime(value)}</span>;
  }
  const s = String(value);
  if (s.length > 60) return <span title={s} className="truncate max-w-[200px] block">{s.slice(0, 60)}…</span>;
  return <span>{s}</span>;
}

export function QueryExplorer() {
  const { t } = useTranslation("nav");
  const { scopeParam } = useDataScope();

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

  const activeFilters = { ...filters, q, sort_by: sortBy, sort_dir: sortDir };

  const runQuery = useCallback(async (off = 0) => {
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
      setResult(data as QueryResult);
      setOffset(off);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
    } finally {
      setLoading(false);
    }
  }, [entity, activeFilters, scopeParam]); // eslint-disable-line

  const loadFacets = useCallback(async () => {
    try {
      const data = await api.query.facets(entity, scopeParam ?? "");
      setFacets(data as Facets);
    } catch {
      // facets are best-effort
    }
  }, [entity, scopeParam]);

  useEffect(() => {
    loadFacets();
    setFilters({});
    setQ("");
    setSortBy("");
    setSortDir("desc");
    setResult(null);
    setOffset(0);
  }, [entity, scopeParam]); // eslint-disable-line

  const handleExport = (format: "csv" | "json") => {
    const url = buildExportUrl(entity, activeFilters, scopeParam ?? "", format);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const setFilter = (key: string, val: string) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  const clearFilters = () => { setFilters({}); setQ(""); setSortBy(""); setSortDir("desc"); };

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
            <FileText size={13} />CSV
          </button>
          <button className={btnGhost} onClick={() => handleExport("json")} disabled={!result}>
            <FileJson size={13} />JSON
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex flex-col gap-4">
        {/* Entity tabs */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("queryEntity")}</label>
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
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className={`${inputCls} pl-6`}
                placeholder={t("querySearchPlaceholder")}
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => { if (ev.key === "Enter") runQuery(0); }}
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
              onChange={(ev) => setFilter("from", ev.target.value ? new Date(ev.target.value).toISOString() : "")}
            />
          </div>

          {/* To */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">{t("queryTo")}</label>
            <input
              type="datetime-local"
              className={inputCls}
              value={isoToLocalInput(filters.to)}
              onChange={(ev) => setFilter("to", ev.target.value ? new Date(ev.target.value).toISOString() : "")}
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
                {facets.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
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
                {facets.event_types.map((s) => <option key={s} value={s}>{s}</option>)}
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
                {facets.tool_names.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <EmptyState
          icon={Search}
          title={t("queryEmptyTitle")}
          description={t("queryEmptyDesc")}
        />
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
                <span className="px-2 text-xs">{currentPage} / {totalPages}</span>
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
                      className={`px-3 py-2 text-xs font-medium text-gray-400 cursor-pointer select-none whitespace-nowrap hover:text-gray-200 ${sortBy === col ? "text-[#58a6ff]" : ""}`}
                      onClick={() => {
                        if (sortBy === col) {
                          setSortDir((d) => d === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy(col);
                          setSortDir("desc");
                        }
                        setTimeout(() => runQuery(0), 0);
                      }}
                    >
                      {col}{sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
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
                      <tr key={i} className="border-b border-[#21262d] hover:bg-[#1c2128] transition-colors">
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
