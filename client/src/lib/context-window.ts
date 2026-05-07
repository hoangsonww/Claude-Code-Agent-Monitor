/**
 * @file Context-window helpers for the composer's capacity ring button.
 *
 * Two consumers:
 *   1. ConversationView captures `result` agent_stream chunks and derives the
 *      currentContext snapshot via {@link contextFromResultChunk}.
 *   2. Composer's ContextRingButton renders a circular progress ring whose
 *      fill ratio comes from `usedTokens / contextWindow` and whose color
 *      bucket comes from {@link colorBucketForRatio}.
 *
 * Why this lives in `lib/`: ConversationView and the toolbar button both need
 * the same defaults table, and inlining it in either place would make the
 * other guess at the same magic numbers.
 */
import type { CostResult } from "./types";

/**
 * Default context window per known model id (tokens). When a `result` chunk
 * has not been observed yet (fresh page load, pre-first-turn), we fall back
 * to this table keyed on the model picker's selection.
 *
 * Values mirror Anthropic's published windows for the families currently
 * shipped via the dashboard's model picker. Conservative fallback is 200k.
 */
const MODEL_DEFAULTS: Record<string, number> = {
  "claude-opus-4-7": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  "claude-haiku-4-5": 200_000,
};

const DEFAULT_CONTEXT_WINDOW = 200_000;

export function defaultContextWindowFor(modelId: string | null | undefined): number {
  if (!modelId) return DEFAULT_CONTEXT_WINDOW;
  // Substring match: pickers sometimes carry a "[1m]" / region suffix.
  for (const [prefix, window] of Object.entries(MODEL_DEFAULTS)) {
    if (modelId.startsWith(prefix)) return window;
  }
  return DEFAULT_CONTEXT_WINDOW;
}

/** A snapshot of "tokens currently feeding the next turn". */
export interface ContextUsage {
  usedTokens: number;
  contextWindow: number;
  /** Optional: which model produced the snapshot (for tooltip clarity). */
  model?: string;
}

/**
 * Shape of the `result` stream-json chunk we care about. Defined permissively
 * so a missing field reduces to "no usage info" rather than a type error.
 */
export interface ResultChunkLike {
  type?: string;
  modelUsage?: Record<
    string,
    {
      cacheReadInputTokens?: number;
      cacheCreationInputTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
      contextWindow?: number;
      maxOutputTokens?: number;
    } | undefined
  >;
}

/**
 * Reduce a `result` chunk into a {@link ContextUsage}. Picks the model whose
 * usage report has the largest cache-read footprint — that's the one that
 * actually consumed context this turn (subagent calls show up here too, but
 * with much smaller numbers). Returns null when the chunk has no usable
 * `modelUsage`.
 */
export function contextFromResultChunk(chunk: ResultChunkLike): ContextUsage | null {
  if (chunk?.type !== "result" || !chunk.modelUsage) return null;
  const entries = Object.entries(chunk.modelUsage).filter(([, v]) => v && typeof v === "object");
  if (!entries.length) return null;

  let best: { model: string; used: number; window: number } | null = null;
  for (const [model, usage] of entries) {
    if (!usage) continue;
    const used =
      (usage.cacheReadInputTokens || 0) +
      (usage.cacheCreationInputTokens || 0) +
      (usage.inputTokens || 0) +
      (usage.outputTokens || 0);
    const window = usage.contextWindow || defaultContextWindowFor(model);
    if (!best || used > best.used) best = { model, used, window };
  }
  if (!best) return null;
  return { usedTokens: best.used, contextWindow: best.window, model: best.model };
}

/**
 * Fallback when no `result` chunk has been seen: aggregate the cost endpoint's
 * per-model breakdown into a single number. This is approximate (it sums the
 * whole session, not just "currently active context"), but it gives the ring
 * a usable starting state on a stale tab open.
 */
export function contextFromCost(
  cost: CostResult | null | undefined,
  modelHint: string | null | undefined,
): ContextUsage | null {
  if (!cost?.breakdown?.length) return null;
  const sum = cost.breakdown.reduce(
    (acc, b) => acc + (b.input_tokens || 0) + (b.output_tokens || 0) + (b.cache_read_tokens || 0),
    0,
  );
  if (sum <= 0) return null;
  return {
    usedTokens: sum,
    contextWindow: defaultContextWindowFor(modelHint),
    model: modelHint || undefined,
  };
}

export type ContextColorBucket = "ok" | "warn" | "danger";

/** Three-bucket color scale: green <70%, amber 70-90%, red >90%. */
export function colorBucketForRatio(ratio: number): ContextColorBucket {
  if (!Number.isFinite(ratio) || ratio < 0) return "ok";
  if (ratio < 0.7) return "ok";
  if (ratio < 0.9) return "warn";
  return "danger";
}

/** Format a token count for the tooltip: 57k / 1M / 1.2M etc. */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 100) / 10}k`.replace(/\.0k$/, "k");
  return `${Math.round(n / 100_000) / 10}M`.replace(/\.0M$/, "M");
}

/** "57k / 1M tokens · 6%" formatting for the tooltip body. */
export function formatContextTooltip(usage: ContextUsage): string {
  const ratio = usage.contextWindow > 0 ? usage.usedTokens / usage.contextWindow : 0;
  const pct = Math.round(ratio * 100);
  return `${formatTokens(usage.usedTokens)} / ${formatTokens(usage.contextWindow)} tokens · ${pct}%`;
}
