/**
 * @file Run.defaultCwd.test.tsx
 * @description The Run page must default its working directory to the user's
 * HOME directory (a neutral spawn location) rather than the dashboard's own
 * cwd, which would make ad-hoc runs inherit this repo's project context
 * (.claude/agents, skills, rules, CLAUDE.md, .mcp.json) — issue #202. Falls
 * back to the dashboard cwd only when no home suggestion is available.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
