/**
 * @file QueryExplorer.tsx
 * @description Schema-driven ad-hoc query builder. Fetches the entity/field/
 * operator schema from GET /api/query/schema on mount, then lets the user
 * compose filters (field + operator + value), an AND/OR match toggle, an
 * optional single sort, and a row limit, and run them against POST
 * /api/query/run. Results render in a table with total/timing/truncation/warning
 * banners. Supports CSV/JSON export of the current result set and saving /
 * loading / deleting named queries via /api/query/saved.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  Play,
  Plus,
  Trash2,
  Save,
  Download,
  FileJson,
  AlertTriangle,
  Clock,
  Bookmark,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { Select } from "../components/Select";
import type { SelectOption } from "../components/Select";
import type {
  QueryBody,
  QueryFilter,
  QueryMatch,
  QueryOperator,
  QueryRunResult,
  QuerySchema,
  QuerySchemaEntity,
  QuerySortDir,
  SavedQuery,
} from "../lib/types";

// Operators that take no value input — selecting one hides the value field.
const NO_VALUE_OPS: ReadonlySet<QueryOperator> = new Set(["is_null", "is_not_null"]);
// Operator that accepts a comma-separated list (split into an array on submit).
const IN_OP: QueryOperator = "in";

/** A filter row in the builder. We keep the raw text the user typed for `in`
 * (comma-separated) and only split it into an array when building the request
 * body, so the input stays editable. */
interface FilterRow {
  field: string;
  op: QueryOperator;
  value: string;
}

/** First field of an entity, used as the default for new filter rows / sort. */
function firstField(entity: QuerySchemaEntity | undefined): string {
  if (!entity) return "";
  const keys = Object.keys(entity.fields);
  return keys[0] ?? "";
}

/** Valid operators for a field, falling back to the schema's global list. */
function opsForField(
  entity: QuerySchemaEntity | undefined,
  field: string,
  schema: QuerySchema | null
): QueryOperator[] {
  const fieldOps = entity?.fields[field]?.ops;
  const list = fieldOps && fieldOps.length > 0 ? fieldOps : (schema?.operators ?? []);
  return list as QueryOperator[];
}

/** Build a default filter row for the given entity (first field, first valid op). */
function defaultFilterRow(
  entity: QuerySchemaEntity | undefined,
  schema: QuerySchema | null
): FilterRow {
  const field = firstField(entity);
  const ops = opsForField(entity, field, schema);
  return { field, op: (ops[0] ?? "eq") as QueryOperator, value: "" };
}

export function QueryExplorer() {
  const { t } = useTranslation("query");

  const [schema, setSchema] = useState<QuerySchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [entity, setEntity] = useState<string>("");
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [match, setMatch] = useState<QueryMatch>("and");
  const [limit, setLimit] = useState<number>(100);
  // Empty sortField means "no sort".
  const [sortField, setSortField] = useState<string>("");
  const [sortDir, setSortDir] = useState<QuerySortDir>("asc");

  const [result, setResult] = useState<QueryRunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveInputRef = useRef<HTMLInputElement | null>(null);

  const currentEntity = schema?.entities[entity];

  // ── Mount: load schema + saved queries ──
  useEffect(() => {
    let cancelled = false;
    setSchemaLoading(true);
    api.query
      .schema()
      .then((s) => {
        if (cancelled) return;
        setSchema(s);
        const entityNames = Object.keys(s.entities);
        const firstEntity = entityNames[0] ?? "";
        setEntity(firstEntity);
        const ent = s.entities[firstEntity];
        setFilters([defaultFilterRow(ent, s)]);
        setLimit(s.limits.defaultLimit);
        setSortField("");
        setSchemaError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSchemaError(err instanceof Error ? err.message : t("errorSchema"));
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // t is stable enough; intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSaved = useCallback(() => {
    api.query.saved
      .list()
      .then((rows) => {
        setSaved(Array.isArray(rows) ? rows : []);
        setSavedError(null);
      })
      .catch((err: unknown) => {
        setSavedError(err instanceof Error ? err.message : t("errorSaved"));
      });
  }, [t]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    if (saveOpen) saveInputRef.current?.focus();
  }, [saveOpen]);

  // ── Entity switch: reset filters / sort to valid defaults ──
  const onEntityChange = useCallback(
    (next: string) => {
      if (!schema) return;
      setEntity(next);
      const ent = schema.entities[next];
      setFilters([defaultFilterRow(ent, schema)]);
      setSortField("");
      setSortDir("asc");
      setResult(null);
      setHasRun(false);
      setRunError(null);
    },
    [schema]
  );

  // ── Filter row mutations ──
  const addFilter = useCallback(() => {
    setFilters((prev) => [...prev, defaultFilterRow(currentEntity, schema)]);
  }, [currentEntity, schema]);

  const removeFilter = useCallback((index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateFilterField = useCallback(
    (index: number, field: string) => {
      setFilters((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          // Switching field may invalidate the current operator — clamp it to
          // the new field's valid set.
          const ops = opsForField(currentEntity, field, schema);
          const op = ops.includes(row.op) ? row.op : ((ops[0] ?? "eq") as QueryOperator);
          return { ...row, field, op };
        })
      );
    },
    [currentEntity, schema]
  );

  const updateFilterOp = useCallback((index: number, op: QueryOperator) => {
    setFilters((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, op, value: NO_VALUE_OPS.has(op) ? "" : row.value } : row
      )
    );
  }, []);

  const updateFilterValue = useCallback((index: number, value: string) => {
    setFilters((prev) => prev.map((row, i) => (i === index ? { ...row, value } : row)));
  }, []);

  // ── Build request body from current builder state ──
  const buildBody = useCallback(
    (offset = 0): QueryBody => {
      const builtFilters: QueryFilter[] = filters.map((row) => {
        if (NO_VALUE_OPS.has(row.op)) {
          return { field: row.field, op: row.op };
        }
        if (row.op === IN_OP) {
          const values = row.value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
          return { field: row.field, op: row.op, value: values };
        }
        return { field: row.field, op: row.op, value: row.value };
      });
      return {
        entity,
        filters: builtFilters,
        match,
        sort: sortField ? [{ field: sortField, dir: sortDir }] : [],
        limit,
        offset,
      };
    },
    [entity, filters, match, sortField, sortDir, limit]
  );

  // ── Run ──
  const runQuery = useCallback(async () => {
    if (!entity) return;
    setRunning(true);
    setRunError(null);
    setHasRun(true);
    try {
      const res = await api.query.run(buildBody(0));
      setResult(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : t("errorRun"));
    } finally {
      setRunning(false);
    }
  }, [entity, buildBody, t]);

  // ── Exports ──
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const exportCsv = useCallback(async () => {
    if (!entity) return;
    setRunError(null);
    try {
      const res = await api.query.run(buildBody(0), "csv");
      const blob = await res.blob();
      triggerDownload(blob, `${entity}-query.csv`);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : t("errorRun"));
    }
  }, [entity, buildBody, triggerDownload, t]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.rows, null, 2)], {
      type: "application/json",
    });
    triggerDownload(blob, `${entity || "query"}-rows.json`);
  }, [result, entity, triggerDownload]);

  // ── Save / load / delete ──
  const submitSave = useCallback(async () => {
    const name = saveName.trim();
    if (!name || !entity) return;
    setSaving(true);
    setSavedError(null);
    try {
      await api.query.saved.create({ name, query: buildBody(0) });
      setSaveName("");
      setSaveOpen(false);
      loadSaved();
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : t("errorSave"));
    } finally {
      setSaving(false);
    }
  }, [saveName, entity, buildBody, loadSaved, t]);

  const loadSavedQuery = useCallback(
    (item: SavedQuery) => {
      if (!schema) return;
      const q = item.query;
      const targetEntity = schema.entities[q.entity] ? q.entity : entity;
      const ent = schema.entities[targetEntity];
      setEntity(targetEntity);
      // Re-hydrate filter rows; coerce array `in` values back to comma text.
      const rows: FilterRow[] = (q.filters ?? []).map((f) => ({
        field: f.field,
        op: f.op,
        value: Array.isArray(f.value) ? f.value.join(", ") : (f.value ?? ""),
      }));
      setFilters(rows.length > 0 ? rows : [defaultFilterRow(ent, schema)]);
      setMatch(q.match === "or" ? "or" : "and");
      setLimit(typeof q.limit === "number" ? q.limit : schema.limits.defaultLimit);
      const sort0 = q.sort?.[0];
      setSortField(sort0?.field ?? "");
      setSortDir(sort0?.dir === "desc" ? "desc" : "asc");
      setResult(null);
      setHasRun(false);
      setRunError(null);
    },
    [schema, entity]
  );

  const deleteSavedQuery = useCallback(
    async (id: SavedQuery["id"]) => {
      setSavedError(null);
      try {
        await api.query.saved.remove(id);
        loadSaved();
      } catch (err) {
        setSavedError(err instanceof Error ? err.message : t("errorDelete"));
      }
    },
    [loadSaved, t]
  );

  // ── Derived option lists for the Select dropdowns ──
  const entityOptions: SelectOption<string>[] = useMemo(
    () =>
      schema
        ? Object.keys(schema.entities).map((name) => ({
            value: name,
            label: t(`entities.${name}`, { defaultValue: name }),
          }))
        : [],
    [schema, t]
  );

  const fieldOptions: SelectOption<string>[] = useMemo(
    () =>
      currentEntity
        ? Object.keys(currentEntity.fields).map((name) => ({
            value: name,
            label: name,
            hint: currentEntity.fields[name]?.type,
          }))
        : [],
    [currentEntity]
  );

  const sortFieldOptions: SelectOption<string>[] = useMemo(
    () => [{ value: "", label: t("sortNone") }, ...fieldOptions],
    [fieldOptions, t]
  );

  const limitMax = schema?.limits.maxLimit ?? 1000;

  // ── Render ──
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <Database className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={runQuery}
            disabled={running || schemaLoading || !entity}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {running ? t("running") : t("run")}
          </button>
        </div>
      </div>

      {schemaError ? (
        <div className="card p-4 mb-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {schemaError}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4">
        {/* Builder + results column */}
        <div className="min-w-0 space-y-4">
          {/* Builder card */}
          <div className="card p-4 space-y-4">
            {schemaLoading ? (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                {/* Entity + match + limit row */}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[12rem]">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      {t("entity")}
                    </label>
                    <Select value={entity} onChange={onEntityChange} options={entityOptions} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      {t("match")}
                    </label>
                    <div
                      role="group"
                      aria-label={t("match")}
                      className="inline-flex rounded-md border border-border overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setMatch("and")}
                        aria-pressed={match === "and"}
                        className={`text-[11px] px-3 py-1.5 cursor-pointer ${
                          match === "and"
                            ? "bg-accent/20 text-accent"
                            : "bg-surface-2 text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        {t("matchAnd")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatch("or")}
                        aria-pressed={match === "or"}
                        className={`text-[11px] px-3 py-1.5 border-l border-border cursor-pointer ${
                          match === "or"
                            ? "bg-accent/20 text-accent"
                            : "bg-surface-2 text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        {t("matchOr")}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="query-limit"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5"
                    >
                      {t("limit")}
                    </label>
                    <input
                      id="query-limit"
                      type="number"
                      min={1}
                      max={limitMax}
                      value={limit}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isNaN(n)) return;
                        setLimit(Math.max(1, Math.min(limitMax, Math.floor(n))));
                      }}
                      className="input w-28 py-1.5 text-[13px]"
                    />
                  </div>

                  <div className="min-w-[10rem]">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                      {t("sort")}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Select
                          value={sortField}
                          onChange={setSortField}
                          options={sortFieldOptions}
                        />
                      </div>
                      {sortField ? (
                        <div className="w-24 flex-shrink-0">
                          <Select
                            value={sortDir}
                            onChange={(v) => setSortDir(v as QuerySortDir)}
                            options={[
                              { value: "asc", label: t("asc") },
                              { value: "desc", label: t("desc") },
                            ]}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      {t("filters")}
                    </span>
                    <button
                      type="button"
                      onClick={addFilter}
                      className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-accent hover:bg-accent/10 border border-border hover:border-accent/30 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      {t("addFilter")}
                    </button>
                  </div>

                  {filters.length === 0 ? (
                    <p className="text-xs text-gray-500 italic px-1 py-2">{t("noFilters")}</p>
                  ) : (
                    <div className="space-y-2">
                      {filters.map((row, i) => {
                        const ops = opsForField(currentEntity, row.field, schema);
                        const opOptions: SelectOption<string>[] = ops.map((op) => ({
                          value: op,
                          label: t(`ops.${op}`, { defaultValue: op }),
                        }));
                        const needsValue = !NO_VALUE_OPS.has(row.op);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <Select
                                value={row.field}
                                onChange={(v) => updateFilterField(i, v)}
                                options={fieldOptions}
                              />
                            </div>
                            <div className="w-32 flex-shrink-0">
                              <Select
                                value={row.op}
                                onChange={(v) => updateFilterOp(i, v as QueryOperator)}
                                options={opOptions}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              {needsValue ? (
                                <input
                                  type="text"
                                  value={row.value}
                                  onChange={(e) => updateFilterValue(i, e.target.value)}
                                  placeholder={
                                    row.op === IN_OP
                                      ? t("valuePlaceholderIn")
                                      : t("valuePlaceholder")
                                  }
                                  className="input w-full py-1.5 text-[13px]"
                                />
                              ) : (
                                <span className="block text-[11px] text-gray-600 italic px-3 py-1.5">
                                  {t("noValueNeeded")}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFilter(i)}
                              aria-label={t("removeFilter")}
                              title={t("removeFilter")}
                              className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Action row: save + exports */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                  {saveOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={saveInputRef}
                        type="text"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitSave();
                          if (e.key === "Escape") {
                            setSaveOpen(false);
                            setSaveName("");
                          }
                        }}
                        placeholder={t("saveNamePlaceholder")}
                        className="input py-1.5 text-[13px] w-52"
                      />
                      <button
                        type="button"
                        onClick={submitSave}
                        disabled={!saveName.trim() || saving}
                        className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        {t("confirmSave")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveOpen(false);
                          setSaveName("");
                        }}
                        className="btn-ghost"
                      >
                        <X className="w-4 h-4" />
                        {t("cancel")}
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setSaveOpen(true)} className="btn-ghost">
                      <Save className="w-4 h-4" />
                      {t("save")}
                    </button>
                  )}

                  <div className="flex-1" />

                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={!entity}
                    className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="w-4 h-4" />
                    {t("exportCsv")}
                  </button>
                  <button
                    type="button"
                    onClick={exportJson}
                    disabled={!result || result.rows.length === 0}
                    className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileJson className="w-4 h-4" />
                    {t("exportJson")}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Run error */}
          {runError ? (
            <div className="card p-4 border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {runError}
              </p>
            </div>
          ) : null}

          {/* Results */}
          {running ? (
            <div className="card overflow-hidden">
              <div className="divide-y divide-border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`sk-${i}`}
                    className="flex items-center px-4 py-3 gap-4"
                    aria-busy="true"
                  >
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ) : result ? (
            <ResultsPanel result={result} />
          ) : hasRun ? (
            <EmptyState icon={Database} title={t("noResults")} description={t("noResultsDesc")} />
          ) : (
            <EmptyState icon={Play} title={t("readyTitle")} description={t("readyDesc")} />
          )}
        </div>

        {/* Saved queries sidebar */}
        <aside className="min-w-0">
          <div className="card p-4">
            <div className="flex items-center gap-2 pb-2 mb-3 border-b border-border/60">
              <span className="w-5 h-5 rounded-md bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
                <Bookmark className="w-3 h-3 text-accent" aria-hidden />
              </span>
              <h3 className="text-[13px] font-semibold text-gray-100 tracking-tight">
                {t("savedQueries")}
              </h3>
            </div>

            {savedError ? (
              <p className="text-xs text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {savedError}
              </p>
            ) : null}

            {saved.length === 0 ? (
              <p className="text-xs text-gray-500 italic">{t("noSaved")}</p>
            ) : (
              <ul className="space-y-1.5">
                {saved.map((item) => (
                  <li
                    key={String(item.id)}
                    className="group flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-2 hover:bg-surface-3 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => loadSavedQuery(item)}
                      title={t("loadQuery")}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <span className="block text-[13px] font-medium text-gray-200 truncate">
                        {item.name}
                      </span>
                      <span className="block text-[10px] text-gray-500 font-mono truncate">
                        {t(`entities.${item.entity}`, { defaultValue: item.entity })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSavedQuery(item.id)}
                      aria-label={t("deleteQuery")}
                      title={t("deleteQuery")}
                      className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Results table + meta banners. Split out to keep the main component lean. */
function ResultsPanel({ result }: { result: QueryRunResult }) {
  const { t } = useTranslation("query");

  return (
    <div className="space-y-3">
      {/* Meta line */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-gray-500">
        <span className="font-medium text-gray-400">
          {t("rowsTotal", { count: result.total, shown: result.rows.length })}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono">
          <Clock className="w-3 h-3" />
          {t("tookMs", { ms: result.tookMs })}
        </span>
      </div>

      {/* Truncated banner */}
      {result.truncated ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {t("truncated", { limit: result.limit })}
        </div>
      ) : null}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 space-y-1">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-300 flex items-center gap-2 first:mt-0">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {w}
            </p>
          ))}
        </div>
      ) : null}

      {/* Table */}
      {result.rows.length === 0 ? (
        <EmptyState icon={Database} title={t("noResults")} description={t("noResultsDesc")} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-360px)] min-h-[200px] overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-surface-2">
                <tr className="border-b border-border">
                  {result.columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 font-semibold text-gray-300 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {result.rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-surface-4 transition-colors">
                    {result.columns.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-2 text-gray-300 font-mono whitespace-nowrap max-w-[28rem] truncate"
                        title={formatCell(row[col])}
                      >
                        {formatCell(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Render a cell value as a string. Objects/arrays are JSON-stringified; null /
 * undefined render as an em-dash so empty cells are visually distinct. */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
