/**
 * @file Render + interaction tests for WorkflowRunsPanel (controlled mode):
 * empty state, collapsed header, expand → phase chips + per-agent table +
 * results (phase markers excluded), phase-filter toggling, per-result expand to
 * full content, and the running-run indicator.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WorkflowRunsPanel } from "../WorkflowRunsPanel";
import type { WorkflowRun } from "../../../lib/types";

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    run_id: "wf_x",
    session_id: "s1",
    task_id: null,
    name: "review-changes",
    status: "completed",
    default_model: "claude-opus-4-8",
    started_at: "2026-06-14T00:00:00.000Z",
    ended_at: "2026-06-14T00:00:05.000Z",
    duration_ms: 5000,
    agent_count: 3,
    total_tokens: 48000,
    total_tool_calls: 9,
    phases: [{ title: "Scout" }, { title: "Verify" }],
    progress: [
      { type: "workflow_phase", index: 1, title: "Scout" },
      {
        type: "workflow_agent",
        agentId: "a1",
        label: "scout:starship",
        phaseTitle: "Scout",
        state: "done",
        tokens: 20000,
        toolCalls: 5,
        durationMs: 1000,
        lastToolName: "Read",
        resultPreview: '{"claim":"SCOUTCLAIM about starship"}',
      },
      {
        type: "workflow_agent",
        agentId: "a2",
        label: "verify:starship",
        phaseTitle: "Verify",
        state: "done",
        tokens: 18000,
        toolCalls: 3,
        durationMs: 900,
        resultPreview: '{"verdict":"confirmed","note":"VERIFYNOTE"}',
      },
      {
        type: "workflow_agent",
        agentId: "a3",
        label: "scout:starlink",
        phaseTitle: "Scout",
        state: "running",
        tokens: 1000,
        toolCalls: 1,
      },
    ],
    script_path: null,
    journal_path: null,
    source: "journal",
    created_at: "2026-06-14T00:00:00.000Z",
    updated_at: "2026-06-14T00:00:05.000Z",
    ...overrides,
  };
}

const renderPanel = (runs: WorkflowRun[]) =>
  render(
    <MemoryRouter>
      <WorkflowRunsPanel runs={runs} hideSessionLink />
    </MemoryRouter>
  );

const runHeader = () => screen.getByRole("button", { name: /review-changes/ });
const buttonByText = (text: string) =>
  screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === text);

describe("WorkflowRunsPanel", () => {
  it("shows the empty state with no runs", () => {
    renderPanel([]);
    expect(screen.getByText(/No dynamic workflows yet/i)).toBeInTheDocument();
  });

  it("renders a collapsed run header; the agent table is hidden until expanded", () => {
    renderPanel([makeRun()]);
    expect(screen.getByText("review-changes")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-8")).toBeInTheDocument();
    // collapsed → inner agents not rendered yet
    expect(screen.queryByText("scout:starship")).not.toBeInTheDocument();
  });

  it("expands to phase chips + per-agent rows, excluding phase markers", () => {
    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    // 3 workflow_agent entries → present; the workflow_phase marker is NOT a row
    expect(screen.getAllByText("scout:starship").length).toBeGreaterThan(0);
    expect(screen.getAllByText("verify:starship").length).toBeGreaterThan(0);
    expect(screen.getByText("scout:starlink")).toBeInTheDocument();
    // phase filter chips exist as buttons
    expect(buttonByText("Scout")).toBeTruthy();
    expect(buttonByText("Verify")).toBeTruthy();
  });

  it("filters rows by phase when a phase chip is clicked, then clears", () => {
    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    fireEvent.click(buttonByText("Scout")!);
    // Verify-phase agent is filtered out everywhere; Scout agents remain
    expect(screen.queryByText("verify:starship")).not.toBeInTheDocument();
    expect(screen.getByText("scout:starlink")).toBeInTheDocument();
    // clicking the same chip again clears the filter → Verify agent returns
    fireEvent.click(buttonByText("Scout")!);
    expect(screen.getAllByText("verify:starship").length).toBeGreaterThan(0);
  });

  it("expands a result row to its full, un-truncated content", () => {
    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    // collapsed result shows the humanized excerpt, not the raw JSON keys
    expect(screen.queryByText(/confirmed/)).not.toBeInTheDocument();
    const resultBtn = screen
      .getAllByRole("button")
      .find((b) => /verify:starship/.test(b.textContent || "") && b.getAttribute("aria-expanded"));
    fireEvent.click(resultBtn!);
    // full content (pretty-printed JSON) now visible → the "verdict" key shows
    expect(screen.getByText(/confirmed/)).toBeInTheDocument();
  });

  it("marks a running workflow as running", () => {
    renderPanel([makeRun({ status: "running", name: "live-run" })]);
    const header = screen.getByRole("button", { name: /live-run/ });
    expect(within(header).getByText("Running")).toBeInTheDocument();
  });
});
