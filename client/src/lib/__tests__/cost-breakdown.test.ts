/**
 * @file Unit tests for mergeCostByModel, which folds the server's per-bucket cost
 * breakdown (model × speed × geo × tier) into one entry per model for the chart.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { mergeCostByModel } from "../cost-breakdown";
import type { CostBreakdown } from "../types";

function bucket(model: string, cost: number, extra: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    model,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cost,
    ...extra,
  } as CostBreakdown;
}

describe("mergeCostByModel", () => {
  it("sums buckets that differ only by service_tier into one model entry", () => {
    const merged = mergeCostByModel([
      bucket("claude-opus-5-5", 491.55, { service_tier: "standard" }),
      bucket("claude-opus-5-5", 225.34, { service_tier: "workflow" }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.model).toBe("claude-opus-5-5");
    expect(merged[0]?.cost).toBeCloseTo(716.89, 4);
  });

  it("also merges speed and geo variants and preserves the grand total", () => {
    const rows = [
      bucket("claude-sonnet-5-5", 10, { speed: "fast" }),
      bucket("claude-sonnet-5-5", 20, { inference_geo: "us" }),
      bucket("claude-opus-5-5", 5),
    ];
    const merged = mergeCostByModel(rows);
    expect(merged).toHaveLength(2);
    expect(merged.reduce((s, m) => s + m.cost, 0)).toBeCloseTo(35, 6);
  });

  it("sorts most expensive first and drops zero-cost models", () => {
    const merged = mergeCostByModel([
      bucket("a", 1),
      bucket("b", 0),
      bucket("c", 3),
      bucket("a", 1),
    ]);
    expect(merged.map((m) => m.model)).toEqual(["c", "a"]);
  });

  it("returns an empty list for an empty breakdown", () => {
    expect(mergeCostByModel([])).toEqual([]);
  });
});
