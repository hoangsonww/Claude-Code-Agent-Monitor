/**
 * @file Tests for remote-data WebSocket refresh helpers.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
