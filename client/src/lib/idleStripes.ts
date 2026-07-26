/**
 * @file idleStripes.ts
 * @description Shared idle-chunk geometry helper. Given a segment's activity
 * `chunks` (server/lib/focus-report.js's 10-minute-grain active/idle grid)
 * and the absolute-ms range a caller is rendering that segment's box across,
 * returns only the idle chunks' visible rects as percent-of-range fractions
 * (`{offsetPct, spanPct}`) — clipped to the range, dropped if fully outside
 * it, and orientation-agnostic (the caller's own range can be a calendar
 * day, a segment's own start/end, or any other epoch; the fractions only
 * depend on relative position within that range).
 *
 * Extracted from `FocusCalendarView.tsx`'s original `idleStripesForBlock`
 * (round 4) so a second consumer — `FocusReportModal.tsx`'s List-view
 * `SegmentedBar` (round 5, this pass) — reuses the exact same stripe math
 * instead of re-implementing it a second time. Both consumers render one
 * `data-testid="idle-stripe"` element per returned stripe.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { parseDate } from "./format";
import type { FocusReportChunk } from "./types";

/** One idle chunk's visible position within a rendered range, as a
 *  percentage of that range's own span (not the chunk's own duration). */
export interface FractionalStripe {
  offsetPct: number;
  spanPct: number;
}

/** Clips `chunks` to `[rangeStartMs, rangeEndMs)` and returns only the idle
 *  ones' visible rects, in percent-of-range coordinates. Returns `[]` for
 *  undefined/empty chunks or a zero-length/inverted range. */
export function idleStripesInRange(
  chunks: FocusReportChunk[] | undefined,
  rangeStartMs: number,
  rangeEndMs: number
): FractionalStripe[] {
  const rangeSpan = rangeEndMs - rangeStartMs;
  if (rangeSpan <= 0 || !chunks || chunks.length === 0) return [];
  const stripes: FractionalStripe[] = [];
  for (const chunk of chunks) {
    if (chunk.active) continue;
    const chunkStartMs = parseDate(chunk.start).getTime();
    const chunkEndMs = parseDate(chunk.end).getTime();
    if (chunkEndMs <= rangeStartMs || chunkStartMs >= rangeEndMs) continue; // outside this range
    const visibleStart = Math.max(chunkStartMs, rangeStartMs);
    const visibleEnd = Math.min(chunkEndMs, rangeEndMs);
    if (visibleEnd <= visibleStart) continue;
    stripes.push({
      offsetPct: ((visibleStart - rangeStartMs) / rangeSpan) * 100,
      spanPct: ((visibleEnd - visibleStart) / rangeSpan) * 100,
    });
  }
  return stripes;
}
