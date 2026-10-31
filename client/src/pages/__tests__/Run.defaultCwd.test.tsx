/**
 * @file Run.defaultCwd.test.tsx
 * @description The Run page must default its working directory to the user's
 * HOME directory (a neutral spawn location) rather than the dashboard's own
 * cwd, which would make ad-hoc runs inherit this repo's project context
 * (.claude/agents, skills, rules, CLAUDE.md, .mcp.json) — issue #202. Falls
 * back to the dashboard cwd only when no home suggestion is available.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/pages/__tests__/Run.defaultCwd.test.tsx`
 *
 * Scope
 * The Run page must default its working directory to the user's HOME directory (a neutral spawn
 * location) rather than the dashboard's own cwd, which would make ad-hoc runs inherit this repo's
 * project context (.claude/agents, skills, rules, CLAUDE.md, .mcp.json) — issue #202. Falls back to
 * the dashboard cwd only when no home suggestion is available.
 *
 * Subjects and collaborators
 * - `../Run` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - React Testing Library drives the rendered UI through accessible roles, labels, and user-visible
 *   text.
 * - `MemoryRouter` provides deterministic navigation without coupling the suite to browser history.
 * - Realtime inputs are simulated locally so connection timing and event ordering stay reproducible.
 * - Mock boundary: `../../lib/api`.
 * - Mock boundary: `../../lib/eventBus`.
 *
 * Suite groups
 * - `Run page — default working directory (issue #202)`
 *
 * Protected behavior
 * - pre-fills cwd with the HOME suggestion, not the dashboard cwd
 * - falls back to the dashboard cwd when no home suggestion exists
 * - leaves cwd empty when there are no suggestions at all
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import i18n from "i18next";

const HOME = { kind: "home", path: "/Users/tester", label: "Home" };
const DASHBOARD = {
  kind: "dashboard",
  path: "/Users/tester/projects/dashboard",
  label: "Dashboard server",
};
const RECENT = { kind: "recent", path: "/Users/tester/projects/other", label: "other" };

// Mutable per-test cwd suggestion payload, read by the api mock below.
let cwdItems: Array<{ kind: string; path: string; label: string }> = [];

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const r = (value: unknown) => vi.fn().mockResolvedValue(value);
  return {
    ...actual,
    api: {
      run: {
        list: r({ runs: [], items: [] }),
        history: r({ items: [] }),
        binary: r({ found: true, path: "/usr/bin/claude" }),
        models: r({
          provider: "claude",
          dynamic: false,
          source: "observed-and-aliases",
          items: [],
        }),
        cwds: vi.fn().mockImplementation(() => Promise.resolve({ items: cwdItems })),
        files: r({ items: [] }),
        start: r({ id: "run-1", status: "running" }),
        get: r({ id: "run-1", status: "running", messages: [], envelopes: [] }),
        send: r({ messageId: "m-1" }),
        kill: r({ ok: true }),
      },
      ccConfig: {
        commands: r({ items: [] }),
        plugins: r({ plugins: [] }),
        file: r({ content: "" }),
      },
      sessions: {
        list: r({ sessions: [], total: 0, limit: 50, offset: 0 }),
        transcript: r({ messages: [] }),
      },
    },
  };
});

vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    subscribe: () => () => {},
    publish: () => {},
    onConnection: () => () => {},
    connected: true,
    setConnected: () => {},
  },
}));

import { Run } from "../Run";

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver || (ObserverStub as unknown as typeof ResizeObserver);
for (const fn of ["scrollIntoView", "scrollBy", "scrollTo"] as const) {
  if (!(Element.prototype as unknown as Record<string, unknown>)[fn]) {
    (Element.prototype as unknown as Record<string, unknown>)[fn] = function () {};
  }
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function renderRun() {
  const utils = render(
    <MemoryRouter initialEntries={["/run"]}>
      <Run />
    </MemoryRouter>
  );
  await settle();
  const chooser = screen.getByRole("dialog");
  await act(async () => {
    within(chooser)
      .getByRole("button", { name: /Run Claude Code/ })
      .click();
  });
  await settle();
  return utils;
}

function cwdInput(): HTMLInputElement {
  const placeholder = i18n.t("run:fields.cwdPlaceholder");
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}

beforeEach(() => {
  i18n.changeLanguage("en");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Run page — default working directory (issue #202)", () => {
  it("pre-fills cwd with the HOME suggestion, not the dashboard cwd", async () => {
    cwdItems = [DASHBOARD, HOME, RECENT];
    await renderRun();
    expect(cwdInput().value).toBe(HOME.path);
  });

  it("falls back to the dashboard cwd when no home suggestion exists", async () => {
    cwdItems = [DASHBOARD, RECENT];
    await renderRun();
    expect(cwdInput().value).toBe(DASHBOARD.path);
  });

  it("leaves cwd empty when there are no suggestions at all", async () => {
    cwdItems = [];
    await renderRun();
    expect(cwdInput().value).toBe("");
  });
});
