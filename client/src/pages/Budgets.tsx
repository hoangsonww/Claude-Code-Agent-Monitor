/**
 * @file Budgets.tsx
 * @description Spend budgets page. Lets the user define USD spending limits per
 * rolling period (daily / weekly / monthly), see live current-period spend with
 * a progress bar, and manage alert thresholds. Updates in real time when the
 * server broadcasts a budget alert and refreshes spend on a light poll.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  Wallet,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Power,
} from "lucide-react";
import { api } from "../lib/api";
import type { BudgetCreateArgs } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { fmtCostFull } from "../lib/format";
import { EmptyState } from "../components/EmptyState";
import { StatValueSkeleton } from "../components/Skeleton";
import type {
  Budget,
  BudgetPeriod,
  BudgetStatus,
  BudgetsUpdatedPayload,
  WSMessage,
} from "../lib/types";

const PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly"];
const THRESHOLD_PRESETS = [50, 75, 80, 90, 100];

interface FormState {
  period: BudgetPeriod;
  limit_usd: string;
  label: string;
  thresholds: number[];
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  period: "monthly",
  limit_usd: "",
  label: "",
  thresholds: [80, 100],
  enabled: true,
};

function statusClasses(status: BudgetStatus): { bar: string; badge: string; text: string } {
  switch (status) {
    case "exceeded":
      return {
        bar: "bg-rose-500",
        badge: "text-rose-300 bg-rose-500/10 border-rose-500/30",
        text: "text-rose-400",
      };
    case "warning":
      return {
        bar: "bg-amber-500",
        badge: "text-amber-300 bg-amber-500/10 border-amber-500/30",
        text: "text-amber-400",
      };
    default:
      return {
        bar: "bg-emerald-500",
        badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
        text: "text-emerald-400",
      };
  }
}

export function Budgets() {
  const { t } = useTranslation("budgets");
  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);

  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.budgets.list();
      setBudgets(res.budgets);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live: server pushes a fresh list whenever an alert fires. Also poll lightly
  // so spend keeps ticking even between threshold crossings.
  useEffect(() => {
    const unsub = eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "budgets_updated") {
        setBudgets((msg.data as BudgetsUpdatedPayload).budgets);
      } else if (msg.type === "budget_alert") {
        load();
      }
    });
    const poll = window.setInterval(load, 20000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (b: Budget) => {
    setEditingId(b.id);
    setForm({
      period: b.period,
      limit_usd: String(b.limit_usd),
      label: b.label ?? "",
      thresholds: b.alert_thresholds,
      enabled: b.enabled,
    });
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const toggleThreshold = (value: number) => {
    setForm((f) => {
      const has = f.thresholds.includes(value);
      const next = has ? f.thresholds.filter((v) => v !== value) : [...f.thresholds, value];
      return { ...f, thresholds: next.sort((a, b) => a - b) };
    });
  };

  const submitForm = async () => {
    const limit = Number(form.limit_usd);
    if (!Number.isFinite(limit) || limit <= 0) {
      setFormError(t("errors.invalidLimit"));
      return;
    }
    const payload: BudgetCreateArgs = {
      period: form.period,
      limit_usd: limit,
      label: form.label.trim() || null,
      enabled: form.enabled,
      alert_thresholds: form.thresholds.length > 0 ? form.thresholds : [100],
    };
    setBusyId(editingId ?? "new");
    setFormError(null);
    try {
      if (editingId != null) {
        await api.budgets.update(editingId, payload);
      } else {
        await api.budgets.create(payload);
      }
      closeForm();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const toggleEnabled = async (b: Budget) => {
    setBusyId(b.id);
    try {
      await api.budgets.update(b.id, { enabled: !b.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (b: Budget) => {
    if (!window.confirm(t("confirmDelete"))) return;
    setBusyId(b.id);
    try {
      await api.budgets.remove(b.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const totals = useMemo(() => {
    if (!budgets) return null;
    const active = budgets.filter((b) => b.enabled);
    return {
      count: budgets.length,
      spent: active.reduce((s, b) => s + b.spent, 0),
      limit: active.reduce((s, b) => s + b.limit_usd, 0),
      over: budgets.filter((b) => b.enabled && b.status === "exceeded").length,
    };
  }, [budgets]);

  const periodLabel = (p: BudgetPeriod) => t(`period.${p}`);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
              {wsConnected ? (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                  {t("common:live")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={load} className="btn-ghost" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t("common:refresh")}
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" />
            {t("newBudget")}
          </button>
        </div>
      </div>

      {error ? (
        <div className="card p-4 border-rose-500/30 bg-rose-500/5 text-sm text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Summary */}
      {totals && totals.count > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="text-xs text-gray-500 mb-1">{t("summary.budgets")}</div>
            <div className="text-xl font-semibold text-gray-100">{totals.count}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500 mb-1">{t("summary.activeSpend")}</div>
            <div className="text-xl font-semibold text-gray-100 font-mono">
              {fmtCostFull(totals.spent)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500 mb-1">{t("summary.activeLimit")}</div>
            <div className="text-xl font-semibold text-gray-100 font-mono">
              {fmtCostFull(totals.limit)}
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-500 mb-1">{t("summary.overBudget")}</div>
            <div
              className={`text-xl font-semibold font-mono ${
                totals.over > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {totals.over}
            </div>
          </div>
        </div>
      ) : null}

      {/* Create / edit form */}
      {showForm ? (
        <div className="card p-5 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">
              {editingId != null ? t("form.editTitle") : t("form.createTitle")}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-400">{t("form.period")}</span>
              <select
                className="input"
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value as BudgetPeriod }))}
              >
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-gray-400">{t("form.limit")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="input font-mono"
                placeholder="100.00"
                value={form.limit_usd}
                onChange={(e) => setForm((f) => ({ ...f, limit_usd: e.target.value }))}
              />
            </label>

            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs text-gray-400">{t("form.label")}</span>
              <input
                type="text"
                className="input"
                placeholder={t("form.labelPlaceholder")}
                maxLength={120}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-gray-400">{t("form.thresholds")}</span>
            <div className="flex flex-wrap gap-2">
              {THRESHOLD_PRESETS.map((v) => {
                const active = form.thresholds.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleThreshold(v)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      active
                        ? "bg-accent/20 border-accent/40 text-accent"
                        : "bg-surface-2 border-border text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {v}%
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="accent-accent"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            {t("form.enabled")}
          </label>

          {formError ? <div className="text-xs text-rose-400">{formError}</div> : null}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={submitForm}
              className="btn-primary"
              disabled={busyId === (editingId ?? "new")}
            >
              {editingId != null ? t("common:save") : t("form.create")}
            </button>
            <button onClick={closeForm} className="btn-ghost">
              {t("common:cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Budget list */}
      {budgets === null ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="card p-5">
              <StatValueSkeleton />
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" />
              {t("newBudget")}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {budgets.map((b) => {
            const sc = statusClasses(b.status);
            const width = Math.min(b.pct, 100);
            const dimmed = !b.enabled;
            return (
              <div key={b.id} className={`card p-5 space-y-4 ${dimmed ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-100 truncate">
                        {b.label || periodLabel(b.period)}
                      </h3>
                      <span className={`badge ${sc.badge}`}>
                        {b.status === "exceeded" ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : b.status === "warning" ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {t(`status.${b.status}`)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {b.label ? `${periodLabel(b.period)} · ` : ""}
                      {t("periodKey", { key: b.period_key })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleEnabled(b)}
                      className="btn-ghost px-2 py-1"
                      disabled={busyId === b.id}
                      title={b.enabled ? t("actions.disable") : t("actions.enable")}
                    >
                      <Power className={`w-4 h-4 ${b.enabled ? "text-emerald-400" : ""}`} />
                    </button>
                    <button
                      onClick={() => openEdit(b)}
                      className="btn-ghost px-2 py-1"
                      disabled={busyId === b.id}
                      title={t("common:edit")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(b)}
                      className="btn-ghost px-2 py-1 hover:text-rose-400"
                      disabled={busyId === b.id}
                      title={t("common:delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Spend vs limit */}
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-lg font-semibold text-gray-100 font-mono">
                      {fmtCostFull(b.spent)}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      / {fmtCostFull(b.limit_usd)}
                    </span>
                  </div>
                  <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${sc.bar}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-xs font-medium ${sc.text}`}>{Math.round(b.pct)}%</span>
                    <span className="text-xs text-gray-500">
                      {b.remaining >= 0
                        ? t("remaining", { amount: fmtCostFull(b.remaining) })
                        : t("over", { amount: fmtCostFull(Math.abs(b.remaining)) })}
                    </span>
                  </div>
                </div>

                {/* Thresholds */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                  <span className="text-[11px] text-gray-500 mr-1 pt-1">{t("alertsAt")}</span>
                  {b.alert_thresholds.map((th) => {
                    const fired = b.fired_thresholds.includes(th);
                    return (
                      <span
                        key={th}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          fired
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                            : "bg-surface-2 border-border text-gray-400"
                        }`}
                        title={fired ? t("thresholdFired") : t("thresholdArmed")}
                      >
                        {th}%
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
