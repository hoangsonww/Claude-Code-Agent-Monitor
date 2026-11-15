/**
 * @file Spending-budget UI, in two exports that share one namespace:
 *  - `BudgetsSettings` — CRUD card on the Settings page (create/edit/delete,
 *    enable toggle), over GET/POST/PATCH/DELETE /api/budgets.
 *  - `BudgetBurndown` — a compact burn-down strip on Analytics that renders
 *    GET /api/budgets/status: spent vs. limit, a warn tick, a dashed projection
 *    marker, and the projected exhaustion date.
 *
 * No cost math here — the server measures real spend against each budget and
 * returns the forecast. The strip renders nothing (a quiet hint) until at least
 * one budget exists, so Analytics is unchanged for users who never set one.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/Budgets.tsx
 * **Area:** client component
 * **Responsibility:**
 * Spending-budget UI, in two exports that share one namespace: - `BudgetsSettings` — CRUD card on
 * the Settings page (create/edit/delete, enable toggle), over GET/POST/PATCH/DELETE /api/budgets. -
 * `BudgetBurndown` — a compact burn-down strip on Analytics that renders GET /api/budgets/status:
 * spent vs. limit, a warn tick, a dashed projection marker, and the projected exhaustion date. No
 * cost math here — the server measures real spend against each budget and returns the forecast. The
 * strip renders nothing (a quiet hint) until at least one budget exists, so Analytics is unchanged
 * for users who never set one.
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
 * - `../lib/format` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./Tip` — repository-local contract consumed by this module; review its exports before changing
 *   assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `BudgetBurndown` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `BudgetsSettings` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `BudgetBurndown` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `BudgetsSettings` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `emptyForm` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `PERIODS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SCOPES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `STATUS_COLOR` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `STATUS_TEXT` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `settings` — visible copy resolves through this namespace; key and interpolation parity applies
 *   to every supported locale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/Budgets.tsx` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { fmtCost, fmtCostFull } from "../lib/format";
import { Tip } from "./Tip";
import type {
  BudgetInput,
  BudgetPeriod,
  BudgetScopeType,
  BudgetStatus,
  CostBudget,
} from "../lib/types";

const SCOPES: BudgetScopeType[] = ["global", "project", "provider"];
const PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly"];

const STATUS_COLOR: Record<BudgetStatus["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  projected_over: "bg-violet-500",
  over: "bg-red-500",
};
const STATUS_TEXT: Record<BudgetStatus["status"], string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  projected_over: "text-violet-400",
  over: "text-red-400",
};

function emptyForm(): BudgetInput {
  return {
    name: "",
    scope_type: "global",
    scope_value: "",
    period: "monthly",
    limit_usd: 50,
    warn_at_percent: 80,
  };
}

/** CRUD card for the Settings page. */
export function BudgetsSettings() {
  const { t } = useTranslation("settings");
  const [budgets, setBudgets] = useState<CostBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetInput>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.budgets.list();
      setBudgets(data.budgets);
      setError(null);
    } catch {
      setError(t("budgets.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (b: CostBudget) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      scope_type: b.scope_type,
      scope_value: b.scope_value ?? "",
      period: b.period,
      limit_usd: b.limit_usd,
      warn_at_percent: b.warn_at_percent,
      enabled: b.enabled,
    });
  };

  const save = async () => {
    if (!form.name.trim() || !(Number(form.limit_usd) > 0)) return;
    setSaving(true);
    try {
      const body: BudgetInput = {
        ...form,
        limit_usd: Number(form.limit_usd),
        warn_at_percent: Number(form.warn_at_percent) || 80,
        scope_value: form.scope_type === "global" ? null : (form.scope_value || "").trim(),
      };
      if (editingId) await api.budgets.update(editingId, body);
      else await api.budgets.create(body);
      resetForm();
      await load();
    } catch {
      setError(t("budgets.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (b: CostBudget) => {
    try {
      await api.budgets.update(b.id, { enabled: !b.enabled });
      await load();
    } catch {
      setError(t("budgets.saveError"));
    }
  };

  const remove = async (b: CostBudget) => {
    if (!window.confirm(t("budgets.confirmDelete"))) return;
    try {
      await api.budgets.remove(b.id);
      if (editingId === b.id) resetForm();
      await load();
    } catch {
      setError(t("budgets.saveError"));
    }
  };

  const scopeLabel = (b: CostBudget) =>
    b.scope_type === "global"
      ? t("budgets.scope_global")
      : `${t(`budgets.scope_${b.scope_type}`)}: ${b.scope_value}`;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-300">{t("budgets.title")}</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">{t("budgets.description")}</p>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 mb-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Existing budgets */}
      {loading ? (
        <p className="text-sm text-gray-500 mb-4">…</p>
      ) : budgets.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">{t("budgets.none")}</p>
      ) : (
        <div className="space-y-2 mb-5">
          {budgets.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center gap-2 bg-[#12121f]/60 border border-[#2a2a4a] rounded px-3 py-2"
            >
              <span className="text-sm text-gray-200 font-medium">{b.name}</span>
              <span className="text-[11px] text-gray-500 font-mono truncate">{scopeLabel(b)}</span>
              <span className="text-[11px] text-gray-400">
                {fmtCost(b.limit_usd)}/{t(`budgets.period_${b.period}`)}
              </span>
              <span className="text-[11px] text-gray-600">⚠ {b.warn_at_percent}%</span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(b)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    b.enabled
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-gray-600 text-gray-500"
                  }`}
                >
                  {b.enabled ? t("budgets.on") : t("budgets.off")}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  aria-label={t("budgets.edit")}
                  className="text-gray-500 hover:text-violet-300"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(b)}
                  aria-label={t("budgets.remove")}
                  className="text-gray-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit form */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-border">
        <label className="flex flex-col gap-1 text-[11px] text-gray-500 col-span-2 md:col-span-1">
          {t("budgets.name")}
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("budgets.scope")}
          <select
            value={form.scope_type}
            onChange={(e) => setForm({ ...form, scope_type: e.target.value as BudgetScopeType })}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          >
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {t(`budgets.scope_${s}`)}
              </option>
            ))}
          </select>
        </label>
        {form.scope_type !== "global" && (
          <label className="flex flex-col gap-1 text-[11px] text-gray-500">
            {form.scope_type === "project"
              ? t("budgets.scopeValueProject")
              : t("budgets.scopeValueProvider")}
            <input
              value={form.scope_value ?? ""}
              onChange={(e) => setForm({ ...form, scope_value: e.target.value })}
              className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200 font-mono"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("budgets.period")}
          <select
            value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value as BudgetPeriod })}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`budgets.period_${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("budgets.limit")}
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.limit_usd}
            onChange={(e) => setForm({ ...form, limit_usd: Number(e.target.value) })}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("budgets.warnAt")}
          <input
            type="number"
            min={1}
            max={100}
            value={form.warn_at_percent}
            onChange={(e) => setForm({ ...form, warn_at_percent: Number(e.target.value) })}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          />
        </label>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {editingId ? t("budgets.save") : t("budgets.create")}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1.5"
          >
            {t("budgets.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Compact burn-down strip for the Analytics cost tab. */
export function BudgetBurndown() {
  const { t } = useTranslation("settings");
  const [statuses, setStatuses] = useState<BudgetStatus[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.budgets
      .status()
      .then((d) => {
        if (alive) setStatuses(d.budgets);
      })
      .catch(() => {
        if (alive) setStatuses([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (statuses === null) return null; // loading — stay invisible
  if (statuses.length === 0) return null; // no budgets — don't clutter Analytics

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-medium text-gray-300">{t("budgets.burndownTitle")}</h3>
      </div>
      <div className="space-y-4">
        {statuses.map((b) => {
          const pct = Math.min(100, Math.max(0, b.percent_used ?? 0));
          const projPct =
            b.projected_end_usd !== null && b.limit_usd > 0
              ? Math.min(100, (b.projected_end_usd / b.limit_usd) * 100)
              : null;
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300 font-medium truncate mr-2">{b.name}</span>
                <span className={`font-mono ${STATUS_TEXT[b.status]}`}>
                  <Tip raw={`${fmtCostFull(b.spent_usd)} / ${fmtCostFull(b.limit_usd)}`}>
                    {fmtCost(b.spent_usd)} / {fmtCost(b.limit_usd)}
                  </Tip>
                  {b.percent_used !== null && (
                    <span className="text-gray-500 ml-1">({b.percent_used}%)</span>
                  )}
                </span>
              </div>
              {/* Bar: spent fill + warn tick + projection marker */}
              <div className="relative h-2 bg-[#12121f] border border-[#2a2a4a] rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${STATUS_COLOR[b.status]}`}
                  style={{ width: `${pct}%` }}
                />
                {/* warn threshold tick */}
                <div
                  className="absolute inset-y-0 w-px bg-amber-300/70"
                  style={{ left: `${Math.min(100, b.warn_at_percent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-600 mt-1">
                <span>
                  {projPct !== null
                    ? t("budgets.projected", { amount: fmtCost(b.projected_end_usd ?? 0) })
                    : t(`budgets.period_${b.period}`)}
                </span>
                {b.projected_exhaustion_at && (
                  <span className={STATUS_TEXT[b.status]}>
                    {t("budgets.runsOut", { date: b.projected_exhaustion_at.slice(0, 10) })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
