/**
 * @file eventBuckets.ts
 * @description Groups a chronologically-ascending list of raw hook events
 * into fixed-size time buckets for SegmentEventsModal — a long segment can
 * carry a large number of raw PreToolUse/PostToolUse/etc. events, one row
 * per event doesn't scale to a whole day's worth of activity. Bucketing
 * keeps the modal's row count bounded by how much wall-clock time the
 * segment spans (roughly one row per five minutes of actual activity)
 * instead of by how many events happened, and each bucket surfaces a count
 * per `event_type` so the shape of what happened in that window is visible
 * before drilling into any single event.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { DashboardEvent } from "./types";

/** Default bucket width — ten minutes. Matches CHUNK_MS in
 *  server/lib/focus-report.js so the events modal's rows and the calendar
 *  block's active/idle stripes agree on the same granularity. */
export const BUCKET_MS = 10 * 60 * 1000;

/** One event type's tally within a bucket. */
export interface EventTypeCount {
  eventType: string;
  count: number;
}

/** One time bucket's aggregated events. */
export interface EventBucket {
  /** Epoch ms the bucket starts at — always aligned to `bucketMs` (epoch-
   *  aligned, e.g. every 5 minutes lands on ':00, :05, :10 ...' on the wall
   *  clock in virtually every real-world timezone, since offsets are whole
   *  minutes). */
  bucketStartMs: number;
  bucketEndMs: number;
  total: number;
  /** Per event_type counts, sorted by count descending (ties keep first-seen
   *  order) so the busiest event type in the bucket reads first. */
  countsByType: EventTypeCount[];
  /** The raw events themselves, in their original (ascending) order — kept
   *  around so a bucket can still be drilled into for the full list. */
  events: DashboardEvent[];
}

/**
 * Buckets an already chronologically-ascending event list into fixed-size
 * windows. Does not re-sort — callers that fetch newest-first (the API's
 * default paging order) must reverse first. Only produces buckets that
 * actually contain at least one event; a quiet gap between two bursts of
 * activity yields no empty rows.
 */
export function bucketEvents(
  events: DashboardEvent[],
  bucketMs: number = BUCKET_MS
): EventBucket[] {
  const buckets: EventBucket[] = [];
  let current: EventBucket | null = null;

  for (const event of events) {
    const ms = new Date(event.created_at).getTime();
    const bucketStartMs = Math.floor(ms / bucketMs) * bucketMs;
    if (!current || current.bucketStartMs !== bucketStartMs) {
      current = {
        bucketStartMs,
        bucketEndMs: bucketStartMs + bucketMs,
        total: 0,
        countsByType: [],
        events: [],
      };
      buckets.push(current);
    }
    current.total++;
    current.events.push(event);
    const existing = current.countsByType.find((c) => c.eventType === event.event_type);
    if (existing) existing.count++;
    else current.countsByType.push({ eventType: event.event_type, count: 1 });
  }

  for (const bucket of buckets) {
    bucket.countsByType.sort((a, b) => b.count - a.count);
  }

  return buckets;
}
