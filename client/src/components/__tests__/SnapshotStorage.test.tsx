/**
 * @file SnapshotStorage.test.tsx
 * @description Tests for the transcript snapshot Settings card (issue #358):
 * per-provider storage rendering, the lossless compress action, and the prune
 * safety flow — Prune stays disabled until a dry-run preview exists for the
 * exact criteria shown, editing any criterion invalidates that preview, and
 * applying takes a second confirming click and sends the server's confirm
 * token.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SnapshotPruneResult, SnapshotStorage as Storage } from "../../lib/api";

const prune = vi.fn();
const compress = vi.fn();

vi.mock("../../lib/api", () => ({
  api: {
    settings: {
      snapshots: {
        prune: (...args: unknown[]) => prune(...args),
        compress: () => compress(),
      },
    },
  },
}));

import { SnapshotStorage, formatStorageBytes } from "../SnapshotStorage";

const storage: Storage = {
  total_bytes: 3 * 1024 ** 3,
  total_files: 12,
  roots: {
    claude: {
      path: "/d/transcripts",
      files: 10,
      bytes: 2 * 1024 ** 3,
      compressed_files: 4,
      compressed_bytes: 1024,
      sessions: 5,
    },
    codex: {
      path: "/d/codex-transcripts",
      files: 2,
      bytes: 1024 ** 3,
      compressed_files: 0,
      compressed_bytes: 0,
      sessions: 2,
    },
    cursor: {
      path: "/d/cursor-transcripts",
      files: 0,
      bytes: 0,
      compressed_files: 0,
      compressed_bytes: 0,
      sessions: 0,
    },
  },
  policy: { compress: true, max_age_days: null, max_bytes: null },
};

function plan(overrides: Partial<SnapshotPruneResult> = {}): SnapshotPruneResult {
  return {
    ok: true,
    dry_run: true,
    criteria: { max_age_days: 30, max_bytes: null, orphans: false },
    total_bytes: storage.total_bytes,
    candidate_sessions: 2,
    candidate_files: 3,
    candidate_bytes: 1024 ** 2,
    remaining_bytes: storage.total_bytes - 1024 ** 2,
    over_cap_bytes: 0,
    candidates: [],
    truncated: false,
    removed_files: 0,
    removed_bytes: 0,
    failed_files: 0,
    ...overrides,
  };
}

function spinbutton(index: number): HTMLElement {
  const input = screen.getAllByRole("spinbutton")[index];
  if (!input) throw new Error(`spinbutton ${index} not rendered`);
  return input;
}

function pruneButton() {
  return screen.getByRole("button", { name: /^prune$|confirm prune/i });
}

describe("SnapshotStorage", () => {
  beforeEach(() => {
    prune.mockReset();
    compress.mockReset();
  });

  it("formats sizes up to terabytes", () => {
    expect(formatStorageBytes(512)).toBe("512 B");
    expect(formatStorageBytes(1536)).toBe("1.5 KB");
    expect(formatStorageBytes(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(formatStorageBytes(3 * 1024 ** 3)).toBe("3.00 GB");
    expect(formatStorageBytes(2 * 1024 ** 4)).toBe("2.00 TB");
  });

  it("renders total and per-provider storage with the active policy", () => {
    render(<SnapshotStorage storage={storage} onChanged={() => {}} />);
    expect(screen.getByText("3.00 GB")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("2.00 GB")).toBeInTheDocument();
    expect(screen.getByText(/4 of 10 files compressed/)).toBeInTheDocument();
    expect(
      screen.getByText(/Compression: on · Age cap: none · Size cap: none/)
    ).toBeInTheDocument();
  });

  it("requires a matching preview before pruning, then a confirming click", async () => {
    const onChanged = vi.fn();
    prune.mockResolvedValueOnce(plan());
    render(<SnapshotStorage storage={storage} onChanged={onChanged} />);

    const days = spinbutton(0);
    fireEvent.change(days, { target: { value: "30" } });
    expect(pruneButton()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() =>
      expect(screen.getByText(/2 sessions .* would be removed/)).toBeInTheDocument()
    );
    expect(prune).toHaveBeenLastCalledWith({ max_age_days: 30, dry_run: true });
    expect(pruneButton()).toBeEnabled();

    // Editing the criteria invalidates the preview.
    fireEvent.change(days, { target: { value: "60" } });
    expect(pruneButton()).toBeDisabled();
    fireEvent.change(days, { target: { value: "30" } });
    expect(pruneButton()).toBeEnabled();

    // First click arms, second click applies with the confirm token.
    fireEvent.click(pruneButton());
    expect(prune).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /confirm prune/i })).toBeInTheDocument();
    prune.mockResolvedValueOnce(plan({ dry_run: false, removed_bytes: 1024 ** 2 }));
    fireEvent.click(pruneButton());
    await waitFor(() =>
      expect(prune).toHaveBeenLastCalledWith({
        max_age_days: 30,
        dry_run: false,
        confirm: "PRUNE_SNAPSHOTS",
      })
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(screen.getByText(/Pruned the snapshots of 2 sessions \(1\.0 MB\)/)).toBeInTheDocument();
  });

  it("keeps Prune disabled when the preview matches nothing", async () => {
    prune.mockResolvedValueOnce(
      plan({ candidate_sessions: 0, candidate_files: 0, candidate_bytes: 0 })
    );
    render(<SnapshotStorage storage={storage} onChanged={() => {}} />);
    fireEvent.change(spinbutton(0), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeInTheDocument());
    expect(pruneButton()).toBeDisabled();
  });

  it("sends a GB size cap as bytes", async () => {
    prune.mockResolvedValueOnce(plan());
    render(<SnapshotStorage storage={storage} onChanged={() => {}} />);
    fireEvent.change(spinbutton(1), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() =>
      expect(prune).toHaveBeenLastCalledWith({ max_bytes: 2 * 1024 ** 3, dry_run: true })
    );
  });

  it("reports failed compressions and skipped providers instead of 'nothing to compress'", async () => {
    compress.mockResolvedValueOnce({
      ok: true,
      compressed: 0,
      bytes_before: 0,
      bytes_after: 0,
      failed: 2,
      skipped_roots: ["cursor"],
      storage,
    });
    render(<SnapshotStorage storage={storage} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /compress now/i }));
    await waitFor(() =>
      expect(screen.getByText(/2 snapshots could not be compressed/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Skipped Cursor/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing to compress/)).not.toBeInTheDocument();
  });

  it("compresses on demand and reports the saving", async () => {
    const onChanged = vi.fn();
    compress.mockResolvedValueOnce({
      ok: true,
      compressed: 3,
      bytes_before: 3 * 1024 ** 2,
      bytes_after: 1024 ** 2,
      failed: 0,
      skipped_roots: [],
      storage,
    });
    render(<SnapshotStorage storage={storage} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: /compress now/i }));
    await waitFor(() =>
      expect(screen.getByText("Compressed 3 snapshots (3.0 MB → 1.0 MB)")).toBeInTheDocument()
    );
    expect(onChanged).toHaveBeenCalled();
  });
});
