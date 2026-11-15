/**
 * @file The "what-if" cost simulator panel on the Analytics page. Lets the user
 * pick a scope (date range, project, provider), stack repricing transformations
 * (remap a model, force speed/geo/tier, expire intro rates as of a date), and
 * see actual vs. simulated cost with a per-model waterfall of where the
 * difference comes from. Calls POST /api/pricing/simulate — nothing is changed
 * server-side; the real pricing rules and stored usage are untouched.
 *
 * Honesty: a model remap is a COST model, not a BEHAVIOR model. The panel always
 * shows the "assumes identical token usage" caveat rather than presenting the
 * delta as a prediction. Saved scenarios live in localStorage (a per-viewer
 * convenience) and never leave the browser.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/CostSimulator.tsx
 * **Area:** client component
 * **Responsibility:**
 * The "what-if" cost simulator panel on the Analytics page. Lets the user pick a scope (date range,
 * project, provider), stack repricing transformations (remap a model, force speed/geo/tier, expire
 * intro rates as of a date), and see actual vs. simulated cost with a per-model waterfall of where
 * the difference comes from. Calls POST /api/pricing/simulate — nothing is changed server-side; the
 * real pricing rules and stored usage are untouched. Honesty: a model remap is a COST model, not a
 * BEHAVIOR model. The panel always shows the "assumes identical token usage" caveat rather than
 * presenting the delta as a prediction. Saved scenarios live in localStorage (a per-viewer
 * convenience) and never leave the browser.
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
 * - `CostSimulator` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CostSimulator` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `freshTransform` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `GEO_VALUES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `readScenarios` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `Scenario` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SCENARIOS_KEY` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SPEED_VALUES` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TIER_VALUES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TRANSFORM_TYPES` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `TransformType` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `writeScenarios` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## React and framework hooks
 * - `useCallback` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `analytics` — visible copy resolves through this namespace; key and interpolation parity
 *   applies to every supported locale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/CostSimulator.tsx` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calculator, Trash2, AlertCircle, Save, FolderOpen } from "lucide-react";
import { api } from "../lib/api";
import { fmtCost, fmtCostFull, formatModelName } from "../lib/format";
import { Tip } from "./Tip";
import type { PricingTransform, SimulateResult } from "../lib/types";

type TransformType = PricingTransform["type"];

const TRANSFORM_TYPES: TransformType[] = [
  "remap_model",
  "set_speed",
  "set_geo",
  "set_tier",
  "expire_intro_rates",
];

const SPEED_VALUES = ["standard", "fast"] as const;
const GEO_VALUES = ["global", "us"] as const;
const TIER_VALUES = ["standard", "batch"] as const;

const SCENARIOS_KEY = "ccam.cost-simulator.scenarios";

interface Scenario {
  name: string;
  since: string;
  until: string;
  project: string;
  provider: string;
  transforms: PricingTransform[];
}

/** A fresh transform of the given type, with sensible defaults per type. */
function freshTransform(type: TransformType): PricingTransform {
  switch (type) {
    case "remap_model":
      return { type, from: "claude-opus-*", to: "claude-sonnet-5-5" };
    case "set_speed":
      return { type, value: "standard" };
    case "set_geo":
      return { type, value: "global" };
    case "set_tier":
      return { type, value: "standard" };
    case "expire_intro_rates":
      return { type, as_of: new Date().toISOString().slice(0, 10) };
  }
}

function readScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeScenarios(list: Scenario[]) {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(list));
  } catch {
    // best-effort; a private window or blocked storage simply loses saved scenarios
  }
}

export function CostSimulator() {
  const { t } = useTranslation("analytics");

  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [project, setProject] = useState("");
  const [provider, setProvider] = useState("");
  const [transforms, setTransforms] = useState<PricingTransform[]>([freshTransform("remap_model")]);

  const [result, setResult] = useState<SimulateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioName, setScenarioName] = useState("");

  useEffect(() => {
    setScenarios(readScenarios());
  }, []);

  const typeLabels: Record<TransformType, string> = useMemo(
    () => ({
      remap_model: t("sim.tRemap"),
      set_speed: t("sim.tSpeed"),
      set_geo: t("sim.tGeo"),
      set_tier: t("sim.tTier"),
      expire_intro_rates: t("sim.tExpire"),
    }),
    [t]
  );

  const updateTransform = (index: number, next: PricingTransform) =>
    setTransforms((prev) => prev.map((x, i) => (i === index ? next : x)));

  const removeTransform = (index: number) =>
    setTransforms((prev) => prev.filter((_, i) => i !== index));

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope: Record<string, unknown> = {};
      if (since) scope.since = since;
      if (until) scope.until = until;
      if (project.trim()) scope.project = project.trim();
      if (provider) scope.provider = provider;
      const res = await api.pricing.simulate({ scope, transforms });
      setResult(res);
    } catch {
      setError(t("sim.error"));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [since, until, project, provider, transforms, t]);

  const saveScenario = () => {
    const name = scenarioName.trim();
    if (!name) return;
    const next = [
      ...scenarios.filter((s) => s.name !== name),
      { name, since, until, project, provider, transforms },
    ];
    setScenarios(next);
    writeScenarios(next);
    setScenarioName("");
  };

  const loadScenario = (s: Scenario) => {
    setSince(s.since || "");
    setUntil(s.until || "");
    setProject(s.project || "");
    setProvider(s.provider || "");
    setTransforms(s.transforms?.length ? s.transforms : []);
    setResult(null);
  };

  const deleteScenario = (name: string) => {
    const next = scenarios.filter((s) => s.name !== name);
    setScenarios(next);
    writeScenarios(next);
  };

  const delta = result?.delta.total ?? 0;
  const deltaColor = delta > 0 ? "text-red-400" : delta < 0 ? "text-emerald-400" : "text-gray-400";
  const deltaSign = delta > 0 ? "+" : "";

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-medium text-gray-300">{t("sim.title")}</h3>
      </div>
      <p className="text-[11px] text-gray-600 mb-4">{t("sim.subtitle")}</p>

      {/* Scope */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("sim.since")}
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("sim.until")}
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("sim.project")}
          <input
            type="text"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            placeholder={t("sim.projectPlaceholder")}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-gray-500">
          {t("sim.provider")}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1.5 text-xs text-gray-200"
          >
            <option value="">{t("sim.providerAny")}</option>
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
            <option value="cursor">Cursor</option>
          </select>
        </label>
      </div>

      {/* Transformations */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            {t("sim.transforms")}
          </span>
          <div className="flex items-center gap-1">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value)
                  setTransforms((prev) => [
                    ...prev,
                    freshTransform(e.target.value as TransformType),
                  ]);
              }}
              className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1 text-[11px] text-gray-300"
            >
              <option value="">{t("sim.addTransform")}</option>
              {TRANSFORM_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {typeLabels[tt]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {transforms.length === 0 ? (
          <p className="text-xs text-gray-600 py-2">{t("sim.noTransforms")}</p>
        ) : (
          <div className="space-y-2">
            {transforms.map((tf, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 bg-[#12121f]/60 border border-[#2a2a4a] rounded px-2 py-2"
              >
                <span className="text-[11px] text-violet-300 font-medium min-w-[108px]">
                  {typeLabels[tf.type]}
                </span>
                {tf.type === "remap_model" && (
                  <>
                    <input
                      aria-label={t("sim.from")}
                      value={tf.from}
                      onChange={(e) => updateTransform(i, { ...tf, from: e.target.value })}
                      placeholder={t("sim.from")}
                      className="flex-1 min-w-[120px] bg-[#0d0d18] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-gray-200 font-mono"
                    />
                    <span className="text-gray-600">→</span>
                    <input
                      aria-label={t("sim.to")}
                      value={tf.to}
                      onChange={(e) => updateTransform(i, { ...tf, to: e.target.value })}
                      placeholder={t("sim.to")}
                      className="flex-1 min-w-[120px] bg-[#0d0d18] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-gray-200 font-mono"
                    />
                  </>
                )}
                {(tf.type === "set_speed" || tf.type === "set_geo" || tf.type === "set_tier") && (
                  <select
                    aria-label={t("sim.value")}
                    value={tf.value}
                    onChange={(e) =>
                      updateTransform(i, { ...tf, value: e.target.value } as PricingTransform)
                    }
                    className="bg-[#0d0d18] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-gray-200"
                  >
                    {(tf.type === "set_speed"
                      ? SPEED_VALUES
                      : tf.type === "set_geo"
                        ? GEO_VALUES
                        : TIER_VALUES
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                {tf.type === "expire_intro_rates" && (
                  <input
                    type="date"
                    aria-label={t("sim.asOf")}
                    value={tf.as_of}
                    onChange={(e) => updateTransform(i, { ...tf, as_of: e.target.value })}
                    className="bg-[#0d0d18] border border-[#2a2a4a] rounded px-2 py-1 text-xs text-gray-200"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeTransform(i)}
                  aria-label={t("sim.remove")}
                  className="ml-auto text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
        >
          <Calculator className="w-3.5 h-3.5" />
          {loading ? t("sim.running") : t("sim.run")}
        </button>
      </div>

      {/* Saved scenarios */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-1">
          <input
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder={t("sim.scenarioName")}
            className="bg-[#12121f] border border-[#2a2a4a] rounded px-2 py-1 text-[11px] text-gray-200 w-36"
          />
          <button
            type="button"
            onClick={saveScenario}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-violet-300 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {t("sim.saveScenario")}
          </button>
        </div>
        {scenarios.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {scenarios.map((s) => (
              <span
                key={s.name}
                className="inline-flex items-center gap-1 bg-[#12121f] border border-[#2a2a4a] rounded-full pl-2 pr-1 py-0.5 text-[11px] text-gray-300"
              >
                <button
                  type="button"
                  onClick={() => loadScenario(s)}
                  className="flex items-center gap-1 hover:text-violet-300 transition-colors"
                >
                  <FolderOpen className="w-3 h-3" />
                  {s.name}
                </button>
                <button
                  type="button"
                  onClick={() => deleteScenario(s.name)}
                  aria-label={t("sim.remove")}
                  className="text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!error && !result && <p className="text-sm text-gray-500">{t("sim.empty")}</p>}

      {!error && result && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#12121f] border border-[#2a2a4a] rounded p-3">
              <div className="text-[11px] text-gray-500 mb-1">{t("sim.actual")}</div>
              <div className="text-lg font-mono text-gray-200">
                <Tip raw={fmtCostFull(result.actual.total_cost)}>
                  {fmtCost(result.actual.total_cost)}
                </Tip>
              </div>
            </div>
            <div className="bg-[#12121f] border border-[#2a2a4a] rounded p-3">
              <div className="text-[11px] text-gray-500 mb-1">{t("sim.simulated")}</div>
              <div className="text-lg font-mono text-gray-200">
                <Tip raw={fmtCostFull(result.simulated.total_cost)}>
                  {fmtCost(result.simulated.total_cost)}
                </Tip>
              </div>
            </div>
            <div className="bg-[#12121f] border border-[#2a2a4a] rounded p-3">
              <div className="text-[11px] text-gray-500 mb-1">{t("sim.delta")}</div>
              <div className={`text-lg font-mono ${deltaColor}`}>
                {deltaSign}
                {fmtCost(delta)}
                {result.delta.total_pct !== null && (
                  <span className="text-xs ml-1">
                    ({deltaSign}
                    {result.delta.total_pct}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {result.delta.by_model.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                {t("sim.byModel")}
              </div>
              <div className="space-y-1.5">
                {result.delta.by_model.map((m) => {
                  const mc =
                    m.delta > 0
                      ? "text-red-400"
                      : m.delta < 0
                        ? "text-emerald-400"
                        : "text-gray-400";
                  const sign = m.delta > 0 ? "+" : "";
                  return (
                    <div key={m.model} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-mono truncate mr-2">
                        {formatModelName(m.model) ?? m.model}
                      </span>
                      <span className="flex items-center gap-3 font-mono">
                        <span className="text-gray-600">
                          <Tip raw={fmtCostFull(m.actual_cost)}>{fmtCost(m.actual_cost)}</Tip>
                          {" → "}
                          <Tip raw={fmtCostFull(m.simulated_cost)}>{fmtCost(m.simulated_cost)}</Tip>
                        </span>
                        <span className={`${mc} min-w-[64px] text-right`}>
                          {sign}
                          {fmtCost(m.delta)}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/20 rounded px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{t("sim.caveat")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
