/**
 * @file Tests for the lazy full-transcript fetch in WorkflowRunsPanel: expanding
 * a result row fetches the agent's complete prompt/result (the run journal only
 * carries truncated "…" previews), with a graceful fallback to the journal
 * teaser when the fetch fails. Also unit-tests extractPromptResult.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/components/workflows/__tests__/WorkflowRunsPanel.transcript.test.tsx`
 *
 * Scope
 * Behavioral regression suite for `WorkflowRunsPanel.transcript.test.tsx`.
 *
 * Subjects and collaborators
 * - `../WorkflowRunsPanel` — local module imported by this suite.
 * - `../../../lib/types` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 * - Network boundaries are replaced with deterministic responses; no test depends on an external
 *   service.
 * - Mock boundary: `../../../lib/api`.
 *
 * Suite groups
 * - `extractPromptResult`
 * - `WorkflowRunsPanel lazy transcript fetch`
 *
 * Protected behavior
 * - takes the first user text as prompt and the last assistant text as result
 * - returns empty strings for missing turns (e.g. schema-mode tool-only final)
 * - fetches the full transcript on expand and renders it instead of the teaser
 * - falls back to the journal preview when the fetch fails
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
 * - Query the UI by role or accessible name first; test IDs are reserved for structure with no semantic
 *   selector.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { transcriptMock } = vi.hoisted(() => ({ transcriptMock: vi.fn() }));
vi.mock("../../../lib/api", () => ({
  api: { sessions: { transcript: transcriptMock } },
}));

import { WorkflowRunsPanel, extractPromptResult } from "../WorkflowRunsPanel";
import type { WorkflowRun } from "../../../lib/types";
import type { TranscriptMessage } from "../../../lib/types";

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
    agent_count: 1,
    total_tokens: 20000,
    total_tool_calls: 5,
    phases: [{ title: "Verify" }],
    progress: [
      { type: "workflow_phase", index: 1, title: "Verify" },
      {
        type: "workflow_agent",
        agentId: "a1",
        label: "verify:starship",
        phaseTitle: "Verify",
        state: "done",
        tokens: 18000,
        toolCalls: 3,
        durationMs: 900,
        promptPreview: "Verify the claim…",
        resultPreview: '{"verdict":"confirmed","note":"VERIFYNOTE"}',
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
const resultButton = () =>
  screen
    .getAllByRole("button")
    .find((b) => /verify:starship/.test(b.textContent || "") && b.getAttribute("aria-expanded"))!;

beforeEach(() => {
  transcriptMock.mockReset();
});

const msg = (type: "user" | "assistant", text: string): TranscriptMessage =>
  ({ type, content: [{ type: "text", text }] }) as TranscriptMessage;

describe("extractPromptResult", () => {
  it("takes the first user text as prompt and the last assistant text as result", () => {
    const out = extractPromptResult([
      msg("user", "do the task"),
      msg("assistant", "thinking…"),
      msg("assistant", "FINAL ANSWER"),
    ]);
    expect(out).toEqual({ prompt: "do the task", result: "FINAL ANSWER" });
  });

  it("returns empty strings for missing turns (e.g. schema-mode tool-only final)", () => {
    expect(extractPromptResult([])).toEqual({ prompt: "", result: "" });
    expect(extractPromptResult([msg("user", "only a prompt")])).toEqual({
      prompt: "only a prompt",
      result: "",
    });
  });
});

describe("WorkflowRunsPanel lazy transcript fetch", () => {
  it("fetches the full transcript on expand and renders it instead of the teaser", async () => {
    const LONG_RESULT =
      "CONFIRMED across every primary source. " +
      "The full reasoning runs well past the truncated journal preview. ".repeat(6).trim();
    transcriptMock.mockResolvedValue({
      messages: [msg("user", "Verify the starship claim in full."), msg("assistant", LONG_RESULT)],
    });

    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    fireEvent.click(resultButton());

    // Called with the run_id so the route can resolve the nested transcript.
    expect(transcriptMock).toHaveBeenCalledWith("s1", {
      agent_id: "a1",
      run_id: "wf_x",
      limit: 200,
    });

    // Full fetched text appears (async) in a <pre>, and the prompt is the
    // fetched one - not the short journal teaser.
    const resultPre = await screen.findByText(
      (_, el) => el?.tagName === "PRE" && (el.textContent || "").includes("runs well past"),
      { selector: "pre" }
    );
    expect(resultPre).toBeInTheDocument();
    expect(screen.getByText("Verify the starship claim in full.")).toBeInTheDocument();
  });

  it("falls back to the journal preview when the fetch fails", async () => {
    transcriptMock.mockRejectedValue(new Error("network"));

    renderPanel([makeRun()]);
    fireEvent.click(runHeader());
    fireEvent.click(resultButton());

    // The pretty-printed journal preview (with the "confirmed" key) is shown.
    expect(await screen.findByText(/confirmed/)).toBeInTheDocument();
  });
});
