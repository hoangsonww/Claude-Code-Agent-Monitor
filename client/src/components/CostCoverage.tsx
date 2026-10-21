/**
 * @file CostCoverage.tsx
 * @description Shows the active machine/product scope and missing rate coverage
 * next to API-equivalent cost estimates, without implying subscription billing.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { DataScope } from "../lib/dataScope";
import type { UnpricedModel } from "../lib/types";

export function CostCoverage({ scope, unpriced }: { scope: DataScope; unpriced: UnpricedModel[] }) {
  const { t } = useTranslation("dashboard");
  const scopeKey =
    scope.mode === "local"
      ? "scopeLocal"
      : scope.mode === "selected"
        ? "scopeSelected"
        : "scopeAll";
  const models = [...new Set(unpriced.map((row) => row.model))].join(", ");
  // An unset product scope reads Claude data, so label and rate links follow it.
  const provider = scope.provider || "claude";
  const pricingAnchor = provider === "codex" ? "gpt-pricing" : "claude-pricing";
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
          {t("costIncomplete", { models })}{" "}
          <Link className="underline" to={`/settings#${pricingAnchor}`}>
            {t("reviewRates")}
          </Link>
        </p>
      )}
    </div>
  );
}
