/**
 * @file Unit tests for mergeFreshestById, the helper that collapses rows a
 * status-scoped fan-out returned twice because the row changed status while the
 * requests were in flight.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/lib/__tests__/merge-by-id.test.ts`
 *
 * Scope
 * Behavioral regression suite for `merge-by-id.test.ts`.
 *
 * Subjects and collaborators
 * - `../merge-by-id` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `mergeFreshestById`
 *
 * Protected behavior
 * - keeps one entry per id and prefers the freshest updated_at
 * - preserves first-appearance order of distinct ids
 * - falls back to last_activity, then started_at, when updated_at is absent
 * - keeps the earlier copy when neither carries a usable timestamp
 * - ignores empty groups and malformed rows
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect } from "vitest";
import { mergeFreshestById } from "../merge-by-id";

describe("mergeFreshestById", () => {
  it("keeps one entry per id and prefers the freshest updated_at", () => {
    const stale = { id: "codex:a", status: "waiting", updated_at: "2026-09-20T03:04:58.100Z" };
    const fresh = { id: "codex:a", status: "working", updated_at: "2026-09-20T03:05:03.691Z" };

    expect(mergeFreshestById([fresh], [stale])).toEqual([fresh]);
    // Order of the responses must not change which copy wins.
    expect(mergeFreshestById([stale], [fresh])).toEqual([fresh]);
  });

  it("preserves first-appearance order of distinct ids", () => {
    const rows = mergeFreshestById(
      [{ id: "a", updated_at: "2026-09-20T03:00:00.000Z" }],
      [
        { id: "b", updated_at: "2026-09-20T03:00:00.000Z" },
        { id: "a", updated_at: "2026-09-20T02:00:00.000Z" },
      ]
    );
    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("falls back to last_activity, then started_at, when updated_at is absent", () => {
    const older = { id: "s1", last_activity: "2026-09-20T03:00:00.000Z" };
    const newer = { id: "s1", last_activity: "2026-09-20T04:00:00.000Z" };
    expect(mergeFreshestById([older], [newer])).toEqual([newer]);

    const earliest = { id: "s2", started_at: "2026-09-19T00:00:00.000Z" };
    const latest = { id: "s2", started_at: "2026-09-20T00:00:00.000Z" };
    expect(mergeFreshestById([earliest], [latest])).toEqual([latest]);
  });

  it("keeps the earlier copy when neither carries a usable timestamp", () => {
    const first = { id: "x", status: "working" };
    const second = { id: "x", status: "waiting", updated_at: "not-a-date" };
    expect(mergeFreshestById([first], [second])).toEqual([first]);
  });

  it("ignores empty groups and malformed rows", () => {
    const valid = { id: "ok", updated_at: "2026-09-20T03:00:00.000Z" };
    const rows = mergeFreshestById(
      [],
      [valid],
      [null as unknown as typeof valid, { id: 7 } as unknown as typeof valid]
    );
    expect(rows).toEqual([valid]);
  });
});
