/**
 * @file session-groups.ts
 * @description Builds collapsed Sessions-page summaries from loaded sessions,
 * keeping grouping independent of source directory and lifecycle status.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { effectiveSessionStatus } from "./types";
import type { Session, SessionGroup } from "./types";

export type SessionGrouping = "none" | "project" | "group";

export interface SessionBucket {
  key: string;
  label: string;
  sessions: Session[];
  lastActive: string;
  cost: number;
  waiting: number;
}

/** Summarize loaded rows; callers show a truncation notice when the API cap is reached. */
export function bucketSessions(
  sessions: Session[],
  grouping: Exclude<SessionGrouping, "none">,
  groups: SessionGroup[],
  ungroupedLabel: string,
  noProjectLabel: string
): SessionBucket[] {
  const names = new Map(groups.map((group) => [group.id, group.name]));
  const buckets = new Map<string, SessionBucket>();
  for (const session of sessions) {
    const key =
      grouping === "group" ? session.group_id || "ungrouped" : session.cwd || "no-project";
    const label =
      grouping === "group"
        ? session.group_id
          ? names.get(session.group_id) || ungroupedLabel
          : ungroupedLabel
        : session.cwd || noProjectLabel;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label, sessions: [], lastActive: "", cost: 0, waiting: 0 };
      buckets.set(key, bucket);
    }
    bucket.sessions.push(session);
    const active = session.last_activity || session.started_at;
    if (active > bucket.lastActive) bucket.lastActive = active;
    bucket.cost += session.cost || 0;
    if (effectiveSessionStatus(session) === "waiting") bucket.waiting += 1;
  }
  return [...buckets.values()].sort((a, b) => b.lastActive.localeCompare(a.lastActive));
}
