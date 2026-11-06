/**
 * @file CostCoverage.tsx
 * @description Shows the active machine/product scope and missing rate coverage
 * next to API-equivalent cost estimates, without implying subscription billing.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/CostCoverage.tsx
 * **Area:** client component
 * **Responsibility:**
 * Shows the active machine/product scope and missing rate coverage next to API-equivalent cost
 * estimates, without implying subscription billing.
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
 * - `../lib/dataScope` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./Tip` — repository-local contract consumed by this module; review its exports before changing
 *   assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-router` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `CostCoverage` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `CostEstimateInfo` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `useCostCoverageText` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CostCoverage` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `CostEstimateInfo` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `PricingReviewLinks` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `useCostCoverageText` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useCostCoverageText` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `dashboard` — visible copy resolves through this namespace; key and interpolation parity
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/CostCoverage.tsx` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import type { DataScope } from "../lib/dataScope";
import type { UnpricedModel } from "../lib/types";
import { Tip } from "./Tip";

export function CostCoverage({ scope, unpriced }: { scope: DataScope; unpriced: UnpricedModel[] }) {
  const { pricingTargets, scopeKey, provider, models } = useCostCoverageText(scope, unpriced);
  const { t } = useTranslation("dashboard");
  return (
    <div className="text-xs text-gray-400 mb-4 space-y-1">
      <p>{t("costEstimate")}</p>
      <p>
        <Link className="text-accent hover:underline" to="/settings#remote-sources">
          {t("costScope", {
            sources: t(`settings:remoteSources.${scopeKey}`),
            providers: t(`settings:display.${provider}`),
          })}
        </Link>
      </p>
      {unpriced.length > 0 && (
        <p role="status" className="text-amber-400">
          {t("costIncomplete", { models })} <PricingReviewLinks targets={pricingTargets} />
        </p>
      )}
    </div>
  );
}

/** Compact info trigger for the explanatory copy attached to cost-card labels. */
export function CostEstimateInfo({
  scope,
  unpriced,
}: {
  scope: DataScope;
  unpriced: UnpricedModel[];
}) {
  const { t } = useTranslation("dashboard");
  const { text, scopeText, incompleteText, pricingTargets } = useCostCoverageText(scope, unpriced);
  return (
    <Tip
      raw={text}
      content={
        <div className="space-y-1.5">
          <p className="font-semibold text-gray-100">{t("costEstimate")}</p>
          <p className="text-gray-400">{scopeText}</p>
          {incompleteText && (
            <p className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-amber-200">
              {incompleteText} <PricingReviewLinks targets={pricingTargets} tooltip />
            </p>
          )}
        </div>
      }
      interactive={Boolean(incompleteText)}
      maxWidth={360}
      ariaLabel={t("costInfoLabel")}
      variant="info"
      triggerClassName="flex-shrink-0 rounded-full leading-none text-gray-500 transition-colors hover:text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
    >
      <Info aria-hidden="true" className="h-3.5 w-3.5" />
    </Tip>
  );
}

/** Localized multiline body shared by Dashboard and Analytics cost tooltips. */
export function useCostCoverageText(scope: DataScope, unpriced: UnpricedModel[]) {
  const { t } = useTranslation("dashboard");
  const scopeKey =
    scope.mode === "local"
      ? "scopeLocal"
      : scope.mode === "selected"
        ? "scopeSelected"
        : "scopeAll";
  const models = [...new Set(unpriced.map((row) => row.model))].join(", ");
  const provider = scope.provider || "claude";
  const fallbackProviders = provider === "both" ? ["claude"] : [provider];
  const pricingProviders = [
    ...new Set(
      unpriced.map((row) => row.provider).filter(Boolean) as Array<"claude" | "cursor" | "codex">
    ),
  ];
  const pricingTargets = (pricingProviders.length ? pricingProviders : fallbackProviders).map(
    (pricingProvider) => ({
      provider: pricingProvider,
      anchor:
        pricingProvider === "codex"
          ? "gpt-pricing"
          : pricingProvider === "cursor"
            ? "cursor-pricing"
            : "claude-pricing",
    })
  );
  const scopeText = t("costScope", {
    sources: t(`settings:remoteSources.${scopeKey}`),
    providers: t(`settings:display.${provider}`),
  });
  const incompleteText = unpriced.length ? t("costIncomplete", { models }) : "";
  const incomplete = incompleteText ? `${incompleteText} ${t("reviewRates")}` : "";
  return {
    text: [t("costEstimate"), scopeText, incomplete].filter(Boolean).join("\n"),
    scopeText,
    incompleteText,
    pricingTargets,
    scopeKey,
    provider,
    models,
  };
}

function PricingReviewLinks({
  targets,
  tooltip = false,
}: {
  targets: Array<{ provider: string; anchor: string }>;
  tooltip?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const linkClass = tooltip
    ? "font-medium text-amber-100 underline decoration-amber-300/60 underline-offset-2 hover:text-white"
    : "underline";
  if (targets.length <= 1) {
    return (
      <Link className={linkClass} to={`/settings#${targets[0]?.anchor || "claude-pricing"}`}>
        {t("reviewRates")}
      </Link>
    );
  }
  return (
    <>
      {t("reviewRates")}:{" "}
      {targets.map((target, index) => (
        <span key={target.provider}>
          {index > 0 && " · "}
          <Link className={linkClass} to={`/settings#${target.anchor}`}>
            {t(`settings:display.${target.provider}`)}
          </Link>
        </span>
      ))}
    </>
  );
}
