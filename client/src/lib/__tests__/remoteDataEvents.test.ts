/**
 * @file Tests for remote-data WebSocket refresh helpers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/lib/__tests__/remoteDataEvents.test.ts`
 *
 * Scope
 * Behavioral regression suite for `remoteDataEvents.test.ts`.
 *
 * Subjects and collaborators
 * - `../remoteDataEvents` — local module imported by this suite.
 * - `../types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 *
 * Suite groups
 * - `isRemoteDataRefreshMessage`
 *
 * Protected behavior
 * - returns true for remote_data.updated
 * - returns true when remote_source.status is ok
 * - returns false when remote_source.status is syncing
 * - returns true for remote import.progress complete
 * - returns false for local import.progress complete
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

import { describe, expect, it } from "vitest";
import { isRemoteDataRefreshMessage } from "../remoteDataEvents";
import type { ImportProgressMessage, WSMessage } from "../types";

function msg(type: WSMessage["type"], data: WSMessage["data"]): WSMessage {
  return { type, data, timestamp: "2026-01-01T00:00:00.000Z" };
}

describe("isRemoteDataRefreshMessage", () => {
  it("returns true for remote_data.updated", () => {
    expect(
      isRemoteDataRefreshMessage(
        msg("remote_data.updated", {
          sourceId: "src_1",
          source: "src_1",
        })
      )
    ).toBe(true);
  });

  it("returns true when remote_source.status is ok", () => {
    expect(
      isRemoteDataRefreshMessage(msg("remote_source.status", { id: "src_1", status: "ok" }))
    ).toBe(true);
  });

  it("returns false when remote_source.status is syncing", () => {
    expect(
      isRemoteDataRefreshMessage(msg("remote_source.status", { id: "src_1", status: "syncing" }))
    ).toBe(false);
  });

  it("returns true for remote import.progress complete", () => {
    expect(
      isRemoteDataRefreshMessage(
        msg("import.progress", {
          phase: "complete",
          source: "remote",
          importId: "remote-src_1",
        } as ImportProgressMessage)
      )
    ).toBe(true);
  });

  it("returns false for local import.progress complete", () => {
    expect(
      isRemoteDataRefreshMessage(
        msg("import.progress", {
          phase: "complete",
          source: "default",
          importId: "x",
        } as ImportProgressMessage)
      )
    ).toBe(false);
  });
});
