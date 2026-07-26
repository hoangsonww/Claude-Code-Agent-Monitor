/**
 * @file eventBuckets.test.ts
 * @description Unit tests for bucketEvents() — grouping a chronologically
 * ascending event list into fixed-size (default 10-minute) windows for
 * SegmentEventsModal. Covers same-bucket grouping, a new bucket on crossing
 * the boundary, skipping empty gaps between bursts, per-event_type counts
 * sorted by frequency, and the empty-input case.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { bucketEvents } from "../eventBuckets";
import type { DashboardEvent } from "../types";

function ev(overrides: Partial<DashboardEvent> & { created_at: string }): DashboardEvent {
  return {
    id: 0,
    session_id: "sess-1",
    agent_id: null,
    event_type: "PreToolUse",
    tool_name: null,
    summary: null,
    data: null,
    ...overrides,
  } as DashboardEvent;
}

describe("bucketEvents", () => {
  it("returns no buckets for an empty input", () => {
    expect(bucketEvents([])).toEqual([]);
  });

  it("groups events within the same 10-minute window into one bucket", () => {
    const events = [
      ev({ id: 1, created_at: "2026-03-05T10:00:00.000Z", event_type: "PreToolUse" }),
      ev({ id: 2, created_at: "2026-03-05T10:05:30.000Z", event_type: "PostToolUse" }),
      ev({ id: 3, created_at: "2026-03-05T10:09:59.000Z", event_type: "PostToolUse" }),
    ];
    const buckets = bucketEvents(events);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.total).toBe(3);
    expect(buckets[0]!.events.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(buckets[0]!.bucketStartMs).toBe(new Date("2026-03-05T10:00:00.000Z").getTime());
    expect(buckets[0]!.bucketEndMs - buckets[0]!.bucketStartMs).toBe(10 * 60 * 1000);
  });

  it("starts a new bucket once a timestamp crosses the 10-minute boundary", () => {
    const events = [
      ev({ id: 1, created_at: "2026-03-05T10:09:59.000Z" }),
      ev({ id: 2, created_at: "2026-03-05T10:10:00.000Z" }),
    ];
    const buckets = bucketEvents(events);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.events.map((e) => e.id)).toEqual([1]);
    expect(buckets[1]!.events.map((e) => e.id)).toEqual([2]);
  });

  it("produces no row for a quiet gap between two bursts", () => {
    const events = [
      ev({ id: 1, created_at: "2026-03-05T10:00:00.000Z" }),
      // Nothing happens between 10:10 and 10:30 - no bucket for that gap.
      ev({ id: 2, created_at: "2026-03-05T10:30:00.000Z" }),
    ];
    const buckets = bucketEvents(events);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.bucketStartMs).toBe(new Date("2026-03-05T10:00:00.000Z").getTime());
    expect(buckets[1]!.bucketStartMs).toBe(new Date("2026-03-05T10:30:00.000Z").getTime());
  });

  it("counts events per event_type within a bucket, busiest type first", () => {
    const events = [
      ev({ id: 1, created_at: "2026-03-05T10:00:00.000Z", event_type: "PreToolUse" }),
      ev({ id: 2, created_at: "2026-03-05T10:01:00.000Z", event_type: "PostToolUse" }),
      ev({ id: 3, created_at: "2026-03-05T10:02:00.000Z", event_type: "PostToolUse" }),
      ev({ id: 4, created_at: "2026-03-05T10:03:00.000Z", event_type: "Stop" }),
    ];
    const buckets = bucketEvents(events);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]!.countsByType).toEqual([
      { eventType: "PostToolUse", count: 2 },
      { eventType: "PreToolUse", count: 1 },
      { eventType: "Stop", count: 1 },
    ]);
  });

  it("supports a custom bucket size", () => {
    const events = [
      ev({ id: 1, created_at: "2026-03-05T10:00:00.000Z" }),
      ev({ id: 2, created_at: "2026-03-05T10:00:30.000Z" }),
      ev({ id: 3, created_at: "2026-03-05T10:01:00.000Z" }),
    ];
    const buckets = bucketEvents(events, 60 * 1000);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]!.events.map((e) => e.id)).toEqual([1, 2]);
    expect(buckets[1]!.events.map((e) => e.id)).toEqual([3]);
  });
});
