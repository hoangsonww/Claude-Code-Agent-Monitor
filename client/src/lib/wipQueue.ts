/**
 * @file Pure sort/column-fill logic for the WIP (work-in-progress) queue
 * page (`client/src/pages/WIP.tsx`). No DOM, no React - safe to unit test in
 * isolation and the cheapest place to pin the tertiary-sort and
 * column-fill decisions as executable spec (technical-plan.md §4 step 5).
 *
 * `sortWipQueue` is this feature's `DERIVED-DUAL-VIEW` guardrail in code
 * form: it imports and reuses `isSessionAwaitingInput`/
 * `normalizeAwaitingReason`/`AWAITING_REASON_CONFIG` exactly as Kanban does
 * (`KanbanBoard.tsx`'s `isPrimaryAwaitingReason`/`isSessionEffectivelyWaiting`)
 * rather than re-deriving a second "is this session waiting" predicate - see
 * `client/src/lib/__tests__/sessionSurfaceParity.test.ts` for the standing
 * cross-consumer proof.
 *
 * Sort order (`sortWipQueue`):
 *  1. Primary: "effectively waiting" (awaiting AND not a primary/still-working
 *     reason) sorts above everything else.
 *  2. Secondary: owning project's `priority` ascending (lower = higher
 *     priority; an unmapped cwd falls back to `0`, not `Infinity` - it does
 *     not sink to the bottom).
 *  3. Tertiary: `last_activity` descending, falling back to `started_at` -
 *     corrected per build-task-list.md Task 1/test-plan.md Implementation
 *     step 2 (technical-plan.md originally, incorrectly, cited a nonexistent
 *     `Session.updated_at` field; the real recency field is `last_activity`).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { AWAITING_REASON_CONFIG, isSessionAwaitingInput, normalizeAwaitingReason } from "./types";
import type { Project, Session } from "./types";
import { projectForSession } from "./projectLookup";

/**
 * WIP queue membership: `status === "active"` sessions only. Single place
 * membership is defined so the page's initial fetch filter and its
 * live-merge filter (on `session_created`/`session_updated`) can't drift
 * from each other. The awaiting-input flag never affects membership - only
 * sort order (see {@link sortWipQueue}).
 * @param session The session to test.
 * @returns Whether the session belongs in the WIP queue.
 */
export function isWipMember(session: Session): boolean {
  return session.status === "active";
}

/**
 * True when a session is genuinely blocked on the human, per Kanban's own
 * bucketing (`KanbanBoard.tsx`'s `isSessionEffectivelyWaiting`): waiting AND
 * not carved out by a "primary" reason (`subagent`/`shell`/`monitor` - still
 * actively working via a child, not blocked on the human). Reused as-is by
 * {@link sortWipQueue}'s primary sort key - not re-derived for WIP.
 */
function isEffectivelyWaiting(session: Session): boolean {
  if (!isSessionAwaitingInput(session)) return false;
  const reason = normalizeAwaitingReason(session.awaiting_reason);
  const isPrimaryReason = !!reason && AWAITING_REASON_CONFIG[reason].primary === true;
  return !isPrimaryReason;
}

/** The owning project's priority, or `0` when the session's cwd is unmapped
 *  (deliberately NOT `Infinity` - an unmapped-cwd session must not sink to
 *  the very bottom regardless of how low-priority the worst mapped project
 *  is). */
function priorityOf(session: Session, projectIndex: Map<string, Project>): number {
  return projectForSession(session, projectIndex)?.priority ?? 0;
}

/** Most-recent-activity-first recency key: `last_activity`, falling back to
 *  `started_at` when absent (never `undefined` - `started_at` is always
 *  present on a real `Session`). */
function recencyOf(session: Session): string {
  return session.last_activity || session.started_at;
}

/**
 * Sorts sessions for the WIP queue: awaiting-first, then by project
 * priority (ascending - lower wins), then by recency (descending). Does not
 * filter by membership - callers should pass `sessions.filter(isWipMember)`
 * (or an already-membership-filtered array) if non-active sessions must
 * never appear.
 * @param sessions     The sessions to order (typically pre-filtered by
 *   {@link isWipMember}).
 * @param projectIndex The cwd->project index from
 *   `projectLookup.buildCwdProjectIndex`.
 * @returns A new, sorted array (does not mutate the input).
 */
export function sortWipQueue(sessions: Session[], projectIndex: Map<string, Project>): Session[] {
  return [...sessions].sort((a, b) => {
    const waitingA = isEffectivelyWaiting(a);
    const waitingB = isEffectivelyWaiting(b);
    if (waitingA !== waitingB) return waitingA ? -1 : 1;

    const priorityA = priorityOf(a, projectIndex);
    const priorityB = priorityOf(b, projectIndex);
    if (priorityA !== priorityB) return priorityA - priorityB;

    const recencyA = recencyOf(a);
    const recencyB = recencyOf(b);
    if (recencyA !== recencyB) return recencyA > recencyB ? -1 : 1;

    return 0;
  });
}

/**
 * Splits an already-sorted array into contiguous top-to-bottom chunks:
 * column 1 gets the first `Math.ceil(n / columnCount)` items in sorted
 * order, column 2 the next chunk, and so on - never a round-robin deal.
 * Pure, no DOM.
 * @param sortedItems Items in final display order.
 * @param columnCount How many columns to fill (1, 2, or 3).
 * @returns An array of `columnCount` arrays (some may be empty when there
 *   are fewer items than columns).
 */
export function assignToColumns<T>(sortedItems: T[], columnCount: 1 | 2 | 3): T[][] {
  const n = sortedItems.length;
  const chunkSize = n === 0 ? 0 : Math.ceil(n / columnCount);
  const columns: T[][] = [];
  for (let i = 0; i < columnCount; i++) {
    columns.push(sortedItems.slice(i * chunkSize, (i + 1) * chunkSize));
  }
  return columns;
}
