/**
 * @file Collapses the server's cost breakdown to one row per model for the
 * Analytics "Cost by Model" card. The server buckets usage by
 * (model, speed, inference_geo, service_tier) so each bucket is priced under its own
 * rates, and workflow-fleet usage is stored under a bookkeeping `workflow` tier. Those
 * buckets share a model id, so charted per bucket they render as duplicate model names.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { CostBreakdown } from "./types";

export interface ModelCost {
  model: string;
  cost: number;
}

/**
 * Sum bucket costs per model id, drop models that cost nothing, and sort the most
 * expensive first. The summed total is unchanged — only the grouping differs.
 */
export function mergeCostByModel(breakdown: readonly CostBreakdown[]): ModelCost[] {
  const byModel = new Map<string, number>();
  for (const b of breakdown) {
    byModel.set(b.model, (byModel.get(b.model) ?? 0) + b.cost);
  }
  return [...byModel.entries()]
    .map(([model, cost]) => ({ model, cost }))
    .filter((m) => m.cost > 0)
    .sort((a, b) => b.cost - a.cost);
}
