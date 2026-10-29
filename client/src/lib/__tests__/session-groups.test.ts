/**
 * @file Verifies project and user-group summaries for the collapsed Sessions view.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import type { Session, SessionGroup } from "../types";
import { bucketSessions } from "../session-groups";

const session = (id: string, extra: Partial<Session>): Session => ({
  id,
  name: id,
  status: "active",
  cwd: "/work/a",
  model: null,
  started_at: "2026-10-01T00:00:00Z",
  ended_at: null,
  metadata: null,
  ...extra,
});

describe("bucketSessions", () => {
  const groups = [
    { id: "goal-a", name: "Release", created_at: "", updated_at: "" },
  ] as SessionGroup[];
  const rows = [
    session("one", { group_id: "goal-a", cost: 1.5, last_activity: "2026-10-03T00:00:00Z" }),
    session("two", {
      group_id: "goal-a",
      cwd: "/work/b",
      cost: 2,
      awaiting_input_since: "2026-10-02T00:00:00Z",
      last_activity: "2026-10-02T00:00:00Z",
    }),
    session("three", { group_id: null, cost: 0.25, last_activity: "2026-10-04T00:00:00Z" }),
  ];

  it("summarizes groups independently of project and orders by last activity", () => {
    const buckets = bucketSessions(rows, "group", groups, "Ungrouped", "No project");
    expect(buckets.map((bucket) => bucket.label)).toEqual(["Ungrouped", "Release"]);
    expect(buckets[1]!).toMatchObject({
      cost: 3.5,
      waiting: 1,
      lastActive: "2026-10-03T00:00:00Z",
    });
    expect(buckets[1]!.sessions.map((row) => row.id)).toEqual(["one", "two"]);
  });

  it("groups by working directory regardless of user-group membership", () => {
    const buckets = bucketSessions(rows, "project", groups, "Ungrouped", "No project");
    expect(buckets.map((bucket) => bucket.label)).toEqual(["/work/a", "/work/b"]);
    expect(buckets[0]!.sessions.map((row) => row.id)).toEqual(["one", "three"]);
  });
});
