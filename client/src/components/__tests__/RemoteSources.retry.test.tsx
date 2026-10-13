/**
 * @file Verifies failed-sync diagnostics remain visible while a retry is active,
 * then clear after a successful attempt without requiring another manual test.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { RemoteSources } from "../RemoteSources";
import { eventBus } from "../../lib/eventBus";
const mocks = vi.hoisted(() => ({ list: vi.fn(), facets: vi.fn() }));
vi.mock("../../lib/api", () => ({
  api: { remoteSources: { list: mocks.list }, sessions: { facets: mocks.facets } },
}));
it("shows the last failure during checking and removes it after success", async () => {
  const source = {
    id: "src_retry",
    label: "Box",
    host: "test.invalid",
    enabled: true,
    status: "syncing",
    claude_status: "syncing",
    codex_status: "syncing",
    last_error: "SSH timeout",
    session_count: 20,
    last_sync_counts: { imported: 0, sessions_tagged: 20 },
  };
  mocks.list.mockResolvedValue({ sources: [source] });
  mocks.facets.mockResolvedValue({ sources: ["local", "src_retry"] });
  render(<RemoteSources />);
  expect(await screen.findByRole("status")).toHaveTextContent("Retrying. Last error: SSH timeout");
  mocks.list.mockResolvedValue({
    sources: [
      { ...source, status: "ok", claude_status: "ok", codex_status: "ok", last_error: null },
    ],
  });
  act(() =>
    eventBus.publish({
      type: "remote_source.status",
      data: { id: source.id, status: "ok" },
      timestamp: new Date().toISOString(),
    })
  );
  await waitFor(() => expect(screen.queryByText(/SSH timeout/)).not.toBeInTheDocument());
});
