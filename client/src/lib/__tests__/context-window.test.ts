import { describe, it, expect } from "vitest";
import {
  contextFromResultChunk,
  contextFromCost,
  defaultContextWindowFor,
  colorBucketForRatio,
  formatContextTooltip,
  formatTokens,
} from "../context-window";
import type { CostResult } from "../types";

describe("context-window utils", () => {
  describe("defaultContextWindowFor", () => {
    it("recognizes known opus / sonnet families as 1M", () => {
      expect(defaultContextWindowFor("claude-opus-4-7")).toBe(1_000_000);
      expect(defaultContextWindowFor("claude-sonnet-4-6")).toBe(1_000_000);
      expect(defaultContextWindowFor("claude-opus-4-7[1m]")).toBe(1_000_000);
    });

    it("recognizes haiku 4.5 as 200k", () => {
      expect(defaultContextWindowFor("claude-haiku-4-5")).toBe(200_000);
    });

    it("falls back to 200k for unknown / null model", () => {
      expect(defaultContextWindowFor(null)).toBe(200_000);
      expect(defaultContextWindowFor("some-future-model")).toBe(200_000);
    });
  });

  describe("contextFromResultChunk", () => {
    it("returns null for non-result chunks", () => {
      expect(contextFromResultChunk({ type: "assistant" })).toBeNull();
      expect(contextFromResultChunk({})).toBeNull();
    });

    it("returns null when modelUsage is missing or empty", () => {
      expect(contextFromResultChunk({ type: "result" })).toBeNull();
      expect(contextFromResultChunk({ type: "result", modelUsage: {} })).toBeNull();
    });

    it("sums cacheRead + cacheCreation + input + output for the heaviest model", () => {
      const usage = contextFromResultChunk({
        type: "result",
        modelUsage: {
          "claude-opus-4-7": {
            cacheReadInputTokens: 50_000,
            cacheCreationInputTokens: 5_000,
            inputTokens: 1_000,
            outputTokens: 500,
            contextWindow: 1_000_000,
          },
          "claude-haiku-4-5": {
            cacheReadInputTokens: 100,
            inputTokens: 10,
            outputTokens: 5,
            contextWindow: 200_000,
          },
        },
      });
      expect(usage).not.toBeNull();
      expect(usage?.usedTokens).toBe(56_500);
      expect(usage?.contextWindow).toBe(1_000_000);
      expect(usage?.model).toBe("claude-opus-4-7");
    });

    it("falls back to default window when chunk omits contextWindow", () => {
      const usage = contextFromResultChunk({
        type: "result",
        modelUsage: {
          "claude-opus-4-7": { cacheReadInputTokens: 100 },
        },
      });
      expect(usage?.contextWindow).toBe(1_000_000);
    });
  });

  describe("contextFromCost", () => {
    it("returns null on empty / missing cost data", () => {
      expect(contextFromCost(null, "claude-opus-4-7")).toBeNull();
      expect(contextFromCost(undefined, null)).toBeNull();
      expect(
        contextFromCost({ total_cost: 0, breakdown: [], daily_costs: [] }, "claude-opus-4-7"),
      ).toBeNull();
    });

    it("sums input + output + cache_read across all breakdown rows", () => {
      const cost: CostResult = {
        total_cost: 0,
        breakdown: [
          {
            model: "claude-opus-4-7",
            input_tokens: 1_000,
            output_tokens: 500,
            cache_read_tokens: 10_000,
            cache_write_tokens: 0,
            cost: 0,
            matched_rule: null,
          },
          {
            model: "claude-haiku-4-5",
            input_tokens: 100,
            output_tokens: 50,
            cache_read_tokens: 200,
            cache_write_tokens: 0,
            cost: 0,
            matched_rule: null,
          },
        ],
        daily_costs: [],
      };
      const usage = contextFromCost(cost, "claude-opus-4-7");
      expect(usage?.usedTokens).toBe(11_850);
      expect(usage?.contextWindow).toBe(1_000_000);
    });
  });

  describe("colorBucketForRatio", () => {
    it("maps the three thresholds", () => {
      expect(colorBucketForRatio(0)).toBe("ok");
      expect(colorBucketForRatio(0.5)).toBe("ok");
      expect(colorBucketForRatio(0.7)).toBe("warn");
      expect(colorBucketForRatio(0.85)).toBe("warn");
      expect(colorBucketForRatio(0.9)).toBe("danger");
      expect(colorBucketForRatio(1.5)).toBe("danger");
    });

    it("handles non-finite / negative ratios as ok", () => {
      expect(colorBucketForRatio(NaN)).toBe("ok");
      expect(colorBucketForRatio(-1)).toBe("ok");
    });
  });

  describe("formatTokens", () => {
    it("uses k / M suffixes", () => {
      expect(formatTokens(0)).toBe("0");
      expect(formatTokens(500)).toBe("500");
      expect(formatTokens(57_000)).toBe("57k");
      expect(formatTokens(1_000_000)).toBe("1M");
      expect(formatTokens(1_200_000)).toBe("1.2M");
    });
  });

  describe("formatContextTooltip", () => {
    it("renders a compact tooltip string", () => {
      expect(
        formatContextTooltip({ usedTokens: 60_000, contextWindow: 1_000_000 }),
      ).toBe("60k / 1M tokens · 6%");
    });
  });
});
