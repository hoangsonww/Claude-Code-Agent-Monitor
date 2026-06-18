/**
 * @file Reports.tsx
 * @description Scheduled Analytics Reports management screen. Lists report
 * definitions (name, template, human-readable schedule, next run, enabled
 * toggle, last-run status), with per-row Run now / Edit / Delete actions and an
 * expandable per-definition run history. A modal handles create + edit. Runs
 * expose "View HTML" (opens the print-friendly artifact in a new tab) and
 * "Download JSON" (triggers a file download) when those formats are available.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  FileBarChart,
  Plus,
  Pencil,
  Trash2,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Download,
  X,
  History,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { Checkbox } from "../components/Checkbox";
import { formatDateTime } from "../lib/format";
import type { ReportDefinition, ReportFrequency, ReportRun, ReportTemplate } from "../lib/types";

const FORMAT_OPTIONS = ["html", "json"] as const;
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

interface FormState {
  name: string;
  template: string;
  frequency: ReportFrequency;
  day_of_week: number;
  hour: number;
  formats: string[];
  window_days: number;
  enabled: boolean;
}

function defaultForm(templates: ReportTemplate[]): FormState {
  const first = templates[0];
  return {
    name: "",
    template: first?.key ?? "",
    frequency: "weekly",
    day_of_week: 1,
    hour: 9,
    formats: ["html"],
    window_days: first?.default_window_days ?? 7,
    enabled: true,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function Reports() {
  const { t } = useTranslation("reports");

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [frequencies, setFrequencies] = useState<ReportFrequency[]>(["daily", "weekly", "monthly"]);
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal (create + edit) state.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReportDefinition | null>(null);
  const [form, setForm] = useState<FormState>(() => defaultForm([]));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation.
  const [confirmDelete, setConfirmDelete] = useState<ReportDefinition | null>(null);

  // Per-row "Run now" in-flight tracking + expanded history.
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [runsById, setRunsById] = useState<Record<string, ReportRun[]>>({});
  const [runsLoading, setRunsLoading] = useState<Set<string>>(() => new Set());
  const [runsError, setRunsError] = useState<Record<string, string>>({});

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

  const templateLabel = useCallback(
    (key: string) => templates.find((tpl) => tpl.key === key)?.label ?? key,
    [templates]
  );

  const load = useCallback(async () => {
    try {
      const [tplRes, defs] = await Promise.all([api.reports.templates(), api.reports.list()]);
      setTemplates(tplRes.templates);
      if (tplRes.frequencies.length > 0) setFrequencies(tplRes.frequencies);
      setDefinitions(defs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRuns = useCallback(async (id: string) => {
    setRunsLoading((prev) => new Set(prev).add(id));
    setRunsError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const runs = await api.reports.runs(id);
      setRunsById((prev) => ({ ...prev, [id]: runs }));
    } catch (err) {
      setRunsError((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "error",
      }));
    } finally {
      setRunsLoading((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const toggleHistory = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          if (!runsById[id]) loadRuns(id);
        }
        return next;
      });
    },
    [runsById, loadRuns]
  );

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm(templates));
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (def: ReportDefinition) => {
    setEditing(def);
    setForm({
      name: def.name,
      template: def.template,
      frequency: def.frequency,
      day_of_week: def.day_of_week ?? 1,
      hour: def.hour,
      formats: def.formats.length > 0 ? [...def.formats] : ["html"],
      window_days: def.window_days,
      enabled: def.enabled,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const setF = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  // When the chosen template changes, default the window to the template's
  // suggested window (only while creating — editing keeps the saved value
  // unless the user explicitly switches templates).
  const onTemplateChange = (key: string) => {
    const tpl = templates.find((x) => x.key === key);
    setF({ template: key, window_days: tpl?.default_window_days ?? form.window_days });
  };

  const toggleFormat = (fmt: string) => {
    setForm((prev) => ({
      ...prev,
      formats: prev.formats.includes(fmt)
        ? prev.formats.filter((x) => x !== fmt)
        : [...prev.formats, fmt],
    }));
  };

  const submit = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      setFormError(t("form.validationName"));
      return;
    }
    if (!form.template) {
      setFormError(t("form.validationTemplate"));
      return;
    }
    if (form.formats.length === 0) {
      setFormError(t("form.validationFormats"));
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      template: form.template,
      frequency: form.frequency,
      day_of_week: form.frequency === "weekly" ? form.day_of_week : null,
      hour: form.hour,
      tz_offset: new Date().getTimezoneOffset(),
      formats: form.formats,
      window_days: form.window_days,
      enabled: form.enabled,
    };
    try {
      if (editing) {
        await api.reports.update(editing.id, body);
      } else {
        await api.reports.create(body);
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onToggleEnabled = async (def: ReportDefinition) => {
    // Optimistic flip so the toggle feels instant; reconcile from the response.
    setDefinitions((prev) =>
      prev.map((d) => (d.id === def.id ? { ...d, enabled: !d.enabled } : d))
    );
    try {
      const updated = await api.reports.update(def.id, { enabled: !def.enabled });
      setDefinitions((prev) => prev.map((d) => (d.id === def.id ? updated : d)));
    } catch {
      // Revert on failure.
      setDefinitions((prev) =>
        prev.map((d) => (d.id === def.id ? { ...d, enabled: def.enabled } : d))
      );
    }
  };

  const onRunNow = async (def: ReportDefinition) => {
    if (runningId) return;
    setRunningId(def.id);
    try {
      await api.reports.run(def.id);
      // Refresh the definition list (last_run_at / last_status / next_run_at
      // may have moved) and this definition's run history.
      await load();
      // Ensure the row's history is visible + refreshed.
      setExpanded((prev) => new Set(prev).add(def.id));
      await loadRuns(def.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningId(null);
    }
  };

  const onDelete = async (def: ReportDefinition) => {
    try {
      await api.reports.remove(def.id);
      setConfirmDelete(null);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(def.id);
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const describeSchedule = (def: ReportDefinition): string => {
    const time = `${pad2(def.hour)}:00`;
    if (def.frequency === "daily") return t("frequency.dailyAt", { time });
    if (def.frequency === "weekly") {
      const day = t(`days.${def.day_of_week ?? 1}`);
      return t("frequency.weeklyAt", { day, time });
    }
    return t("frequency.monthlyAt", { time });
  };

  const downloadJson = (run: ReportRun) => {
    const url = api.reports.artifactUrl(run.id, "json");
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${run.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <FileBarChart className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
              {wsConnected ? (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                  {t("common:live")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t("common:offline")}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={load} className="btn-ghost">
            <RefreshCw className="w-4 h-4" /> {t("refresh")}
          </button>
          <button onClick={openCreate} className="btn-primary text-sm" disabled={loading}>
            <Plus className="w-3.5 h-3.5" /> {t("newReport")}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Definitions list */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : definitions.length === 0 ? (
        <EmptyState
          icon={FileBarChart}
          title={t("definitions.empty")}
          description={t("definitions.emptyDesc")}
          action={
            <button onClick={openCreate} className="btn-primary text-sm">
              <Plus className="w-3.5 h-3.5" /> {t("definitions.createFirst")}
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {definitions.map((def) => {
            const isOpen = expanded.has(def.id);
            return (
              <div key={def.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-100 truncate">
                        {def.name}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 flex-shrink-0">
                        {templateLabel(def.template)}
                      </span>
                      <StatusBadge status={def.last_status} t={t} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {describeSchedule(def)}
                      </span>
                      <span>
                        {t("definitions.nextRun")}:{" "}
                        <span className="text-gray-400 font-mono">
                          {def.next_run_at
                            ? formatDateTime(def.next_run_at)
                            : t("definitions.never")}
                        </span>
                      </span>
                      <span className="text-gray-600">
                        {t("definitions.window", { count: def.window_days })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {def.formats.map((fmt) => (
                          <span
                            key={fmt}
                            className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-2 text-gray-400 border border-border"
                          >
                            {fmt}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onToggleEnabled(def)}
                      className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                        def.enabled
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "border-border text-gray-500 hover:text-gray-300 hover:bg-surface-3"
                      }`}
                      title={def.enabled ? t("definitions.enabled") : t("definitions.disabled")}
                    >
                      {def.enabled ? t("definitions.enabled") : t("definitions.disabled")}
                    </button>
                    <button
                      onClick={() => onRunNow(def)}
                      disabled={runningId !== null}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border text-gray-300 hover:text-gray-100 hover:bg-surface-3 transition-colors disabled:opacity-50"
                      title={t("definitions.runNow")}
                    >
                      {runningId === def.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      {runningId === def.id ? t("definitions.running") : t("definitions.runNow")}
                    </button>
                    <button
                      onClick={() => openEdit(def)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title={t("definitions.edit")}
                      aria-label={t("definitions.edit")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(def)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t("definitions.delete")}
                      aria-label={t("definitions.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleHistory(def.id)}
                      aria-expanded={isOpen}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <History className="w-3.5 h-3.5" />
                      {isOpen ? t("definitions.hideHistory") : t("definitions.viewHistory")}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border bg-surface-2/40 p-4">
                    <RunHistory
                      defId={def.id}
                      loading={runsLoading.has(def.id)}
                      error={runsError[def.id]}
                      runs={runsById[def.id]}
                      onDownloadJson={downloadJson}
                      t={t}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-lg rounded-xl border border-border bg-surface-1 shadow-xl shadow-black/40 max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-gray-100">
                {editing ? t("form.editTitle") : t("form.createTitle")}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-300 p-1 -mt-1 -mr-1"
                aria-label={t("form.cancel")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="block text-xs text-gray-400">
                {t("form.name")}
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setF({ name: e.target.value })}
                  placeholder={t("form.namePlaceholder")}
                  className="input mt-1 w-full"
                  autoFocus
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs text-gray-400">
                  {t("form.template")}
                  <div className="relative mt-1">
                    <select
                      value={form.template}
                      onChange={(e) => onTemplateChange(e.target.value)}
                      className="input w-full appearance-none pr-8"
                    >
                      {templates.map((tpl) => (
                        <option key={tpl.key} value={tpl.key}>
                          {tpl.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </label>

                <label className="block text-xs text-gray-400">
                  {t("form.frequency")}
                  <div className="relative mt-1">
                    <select
                      value={form.frequency}
                      onChange={(e) => setF({ frequency: e.target.value as ReportFrequency })}
                      className="input w-full appearance-none pr-8"
                    >
                      {frequencies.map((freq) => (
                        <option key={freq} value={freq}>
                          {t(`frequency.${freq}`)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </label>
              </div>

              {/* Template description hint */}
              {templates.find((x) => x.key === form.template)?.description && (
                <p className="text-[11px] text-gray-500 -mt-1">
                  {templates.find((x) => x.key === form.template)?.description}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.frequency === "weekly" && (
                  <label className="block text-xs text-gray-400">
                    {t("form.dayOfWeek")}
                    <div className="relative mt-1">
                      <select
                        value={form.day_of_week}
                        onChange={(e) => setF({ day_of_week: parseInt(e.target.value, 10) })}
                        className="input w-full appearance-none pr-8"
                      >
                        {DAYS.map((d) => (
                          <option key={d} value={d}>
                            {t(`days.${d}`)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                  </label>
                )}

                <label className="block text-xs text-gray-400">
                  {t("form.hour")}
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={form.hour}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setF({ hour: Number.isFinite(v) ? Math.min(23, Math.max(0, v)) : 0 });
                    }}
                    className="input mt-1 w-full font-mono"
                  />
                </label>

                <label className="block text-xs text-gray-400">
                  {t("form.windowDays")}
                  <input
                    type="number"
                    min={1}
                    value={form.window_days}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setF({ window_days: Number.isFinite(v) && v > 0 ? v : 1 });
                    }}
                    className="input mt-1 w-full font-mono"
                  />
                </label>
              </div>

              <div className="text-xs text-gray-400">
                <span className="block mb-2">{t("form.formats")}</span>
                <div className="flex items-center gap-4">
                  {FORMAT_OPTIONS.map((fmt) => (
                    <Checkbox
                      key={fmt}
                      checked={form.formats.includes(fmt)}
                      onChange={() => toggleFormat(fmt)}
                      label={fmt.toUpperCase()}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <Checkbox
                  checked={form.enabled}
                  onChange={(v) => setF({ enabled: v })}
                  label={t("form.enabled")}
                />
                <p className="text-[11px] text-gray-500 mt-1 ml-6">{t("form.enabledDesc")}</p>
              </div>

              {formError && <p className="text-xs text-red-400">{formError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                onClick={closeModal}
                disabled={saving}
                className="btn-ghost border border-border text-xs disabled:opacity-50"
              >
                {t("form.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                {saving ? t("form.saving") : editing ? t("form.save") : t("form.create")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title={t("delete.title")}
        message={confirmDelete ? t("delete.message", { name: confirmDelete.name }) : ""}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && onDelete(confirmDelete)}
      />
    </div>
  );
}

// ── Status badge for a definition's last run / a single run ──

function StatusBadge({
  status,
  t,
}: {
  status: "success" | "error" | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
        <CheckCircle className="w-3 h-3" />
        {t("status.success")}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
        <XCircle className="w-3 h-3" />
        {t("status.error")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-surface-2 border border-border rounded-full px-2 py-0.5">
      {t("status.pending")}
    </span>
  );
}

// ── Per-definition run history ──

function RunHistory({
  defId,
  loading,
  error,
  runs,
  onDownloadJson,
  t,
}: {
  defId: string;
  loading: boolean;
  error?: string;
  runs?: ReportRun[];
  onDownloadJson: (run: ReportRun) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
        {t("history.loadFailed")}: {error}
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <EmptyState icon={History} title={t("history.empty")} description={t("history.emptyDesc")} />
    );
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
        {t("history.title")}
      </p>
      <ul className="space-y-2">
        {runs.map((run) => {
          const hasHtml = run.formats_available.includes("html");
          const hasJson = run.formats_available.includes("json");
          return (
            <li
              key={`${defId}-${run.id}`}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface-1 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={run.status} t={t} />
                  <span className="text-[11px] text-gray-500 font-mono">
                    {t("history.started")}: {formatDateTime(run.started_at)}
                  </span>
                  {run.window_start && run.window_end && (
                    <span className="text-[11px] text-gray-600 font-mono">
                      {t("history.window")}: {formatDateTime(run.window_start)} →{" "}
                      {formatDateTime(run.window_end)}
                    </span>
                  )}
                </div>
                {run.status === "error" && run.error && (
                  <p className="text-[11px] text-red-400 mt-1 break-words">
                    {t("history.errorLabel")}: {run.error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {hasHtml && (
                  <a
                    href={api.reports.artifactUrl(run.id, "html")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-accent hover:bg-accent/10 border border-border hover:border-accent/30 transition-colors font-medium"
                  >
                    {t("history.viewHtml")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {hasJson && (
                  <button
                    onClick={() => onDownloadJson(run)}
                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-gray-100 hover:bg-surface-3 border border-border transition-colors font-medium"
                  >
                    {t("history.downloadJson")}
                    <Download className="w-3 h-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
