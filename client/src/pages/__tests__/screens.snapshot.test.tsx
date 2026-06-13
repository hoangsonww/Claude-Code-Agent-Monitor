/**
 * @file screens.snapshot.test.tsx
 * @description Render snapshot tests for every routed screen. Each page is
 * rendered inside a MemoryRouter with the API layer mocked to a deterministic
 * loaded-empty state (empty collections + zeroed scalars) so snapshots capture
 * real structure / layout / i18n without noisy chart DOM or live data. The
 * system clock and timezone are pinned so any relative/absolute timestamps are
 * stable across machines and CI.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// Pin timezone before anything reads it, so date formatting is machine-stable
// (referenced via globalThis so the browser-targeted tsconfig doesn't need node types).
const nodeProcess = (
  globalThis as unknown as { process?: { env: Record<string, string | undefined> } }
).process;
if (nodeProcess) nodeProcess.env.TZ = "UTC";

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import type { ReactNode } from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import i18n from "i18next";

// ── Mock the API layer with deterministic, crash-safe empty fixtures ──────────
// Keep the module's other named exports (RUN_EFFORT_CHOICES, etc.) real and
// override only `api`.
vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const r = (value: unknown) => vi.fn().mockResolvedValue(value);
  const items = { items: [] };
  const cost = {
    total_cost: 0,
    breakdown: [],
    daily_costs: [],
    feature_costs: {},
    unpriced_models: [],
  };
  const emptyWorkflow = {
    stats: {
      totalSessions: 0,
      totalAgents: 0,
      totalSubagents: 0,
      avgSubagents: 0,
      successRate: 0,
      avgDepth: 0,
      avgDurationSec: 0,
      totalCompactions: 0,
      avgCompactions: 0,
      topFlow: null,
    },
    orchestration: {
      sessionCount: 0,
      mainCount: 0,
      subagentTypes: [],
      edges: [],
      outcomes: [],
      compactions: { total: 0, sessions: 0 },
    },
    toolFlow: { transitions: [], toolCounts: [] },
    effectiveness: [],
    patterns: { patterns: [], soloSessionCount: 0, soloPercentage: 0 },
    modelDelegation: { mainModels: [], subagentModels: [], tokensByModel: [] },
    errorPropagation: {
      byDepth: [],
      byType: [],
      eventErrors: [],
      sessionsWithErrors: 0,
      totalSessions: 0,
      errorRate: 0,
    },
    concurrency: { aggregateLanes: [] },
    complexity: [],
    compaction: {
      totalCompactions: 0,
      tokensRecovered: 0,
      perSession: [],
      sessionsWithCompactions: 0,
      totalSessions: 0,
    },
    cooccurrence: [],
  };
  const analytics = {
    tokens: { total_input: 0, total_output: 0, total_cache_read: 0, total_cache_write: 0 },
    tool_usage: [],
    daily_events: [],
    daily_sessions: [],
    agent_types: [],
    event_types: [],
    avg_events_per_session: 0,
    total_subagents: 0,
    overview: {
      total_sessions: 0,
      active_sessions: 0,
      active_agents: 0,
      total_agents: 0,
      total_events: 0,
    },
    agents_by_status: {},
    sessions_by_status: {},
  };
  const settingsInfo = {
    db: {
      path: "/tmp/test.db",
      size: 0,
      counts: {},
      pragmas: {
        journal_mode: "wal",
        synchronous: 1,
        auto_vacuum: 0,
        encoding: "UTF-8",
        foreign_keys: 1,
        busy_timeout: 5000,
      },
      load_stats: { m5: 0, m15: 0, h1: 0 },
    },
    hooks: { installed: true, path: "/tmp/settings.json", hooks: {} },
    server: {
      uptime: 0,
      node_version: "v22.0.0",
      platform: "linux",
      ws_connections: 0,
      memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
      cpu_load: [0, 0, 0],
      arch: "x64",
      total_mem: 0,
      free_mem: 0,
      cpus: 1,
    },
    transcript_cache: { size: 0, maxSize: 100, hits: 0, misses: 0, keys: [] },
  };
  const session = {
    id: "sess-1",
    name: "Test Session",
    status: "active",
    cwd: "/test",
    model: "claude-opus-4-6",
    started_at: "2026-06-10T12:00:00.000Z",
    ended_at: null,
    metadata: null,
  };
  const stats = {
    total_sessions: 0,
    active_sessions: 0,
    active_agents: 0,
    total_agents: 0,
    total_events: 0,
    events_today: 0,
    ws_connections: 0,
    agents_by_status: {},
    sessions_by_status: {},
  };

  return {
    ...actual,
    api: {
      stats: { get: r(stats), facets: r({ cwds: [] }) },
      sessions: {
        list: r({ sessions: [], total: 0, limit: 50, offset: 0 }),
        facets: r({ cwds: [] }),
        get: r({ session, agents: [], events: [] }),
        stats: r({
          session_id: "sess-1",
          total_events: 0,
          events_by_type: [],
          tools_used: [],
          error_count: 0,
          first_event_at: null,
          last_event_at: null,
          agents: { total: 0, main: 0, subagent: 0, compaction: 0, by_status: {} },
          subagent_types: [],
          tokens: {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
          },
        }),
        transcripts: r({ transcripts: [] }),
        transcript: r({ messages: [], session_id: "sess-1" }),
      },
      agents: { list: r({ agents: [] }) },
      events: {
        list: r({ events: [], total: 0, limit: 50, offset: 0 }),
        facets: r({ event_types: [], tool_names: [] }),
      },
      analytics: { get: r(analytics) },
      workflows: { get: r(emptyWorkflow), session: r({}) },
      pricing: {
        list: r({ pricing: [] }),
        upsert: r({ pricing: {} }),
        delete: r({ ok: true }),
        totalCost: r(cost),
        sessionCost: r(cost),
      },
      settings: {
        info: r(settingsInfo),
        claudeHome: {
          get: r({ claude_home: "/home/test/.claude" }),
          set: r({ ok: true, claude_home: "/home/test/.claude" }),
        },
        clearData: r({ ok: true, cleared: {} }),
        reimport: r({ ok: true, imported: 0, skipped: 0, errors: 0 }),
        reinstallHooks: r({ ok: true, hooks: { installed: true, hooks: {} } }),
        resetPricing: r({ ok: true, pricing: [] }),
        exportData: () => "/api/settings/export",
        cleanup: r({
          ok: true,
          abandoned: 0,
          purged_sessions: 0,
          purged_events: 0,
          purged_agents: 0,
        }),
      },
      import: {
        guide: r({
          platform: "linux",
          default_projects_dir: "/home/test/.claude/projects",
          default_projects_dir_display: "~/.claude/projects",
          default_projects_dir_exists: true,
          default_projects_dir_stats: { projects: 0, jsonl_files: 0 },
          archive_command: "tar",
          supported_extensions: [".jsonl"],
          max_upload_bytes: 1000000,
          max_upload_files: 10,
          steps: [],
        }),
        rescan: r({}),
        scanPath: r({}),
      },
      ccConfig: {
        overview: r({
          roots: {
            claudeHome: "/home/test/.claude",
            projectClaudeDir: "/test/.claude",
            projectRoot: "/test",
            claudeJson: "/home/test/.claude.json",
          },
          counts: {
            skills: { user: 0, project: 0 },
            agents: { user: 0, project: 0 },
            commands: { user: 0, project: 0 },
            outputStyles: { user: 0, project: 0 },
            plugins: 0,
            pluginsEnabled: 0,
            pluginsDisabled: 0,
            marketplaces: 0,
            keybindings: 0,
            mcpServers: { user: 0, project: 0 },
            hooks: {},
            memory: 0,
            settingsFiles: 0,
          },
        }),
        skills: r(items),
        agents: r(items),
        commands: r(items),
        outputStyles: r(items),
        plugins: r({ manifestPath: "", manifestExists: false, plugins: [] }),
        mcp: r({ servers: [], items: [] }),
        hooks: r(items),
        settings: r(items),
        memory: r(items),
        file: r({
          scope: "user",
          name: "x",
          path: "/x",
          size: 0,
          mtime: 0,
          truncated: false,
          frontmatter: {},
          preview: "",
          content: "",
        }),
        write: r({ ok: true }),
        delete: r({ ok: true }),
        marketplaces: r({ marketplaces: [], items: [] }),
        keybindings: r({ items: [], bindings: [] }),
        statusline: r({ configured: false }),
        hookScripts: r({ items: [], scripts: [] }),
        backups: r({ items: [] }),
      },
      run: {
        list: r({ runs: [], items: [] }),
        history: r({ items: [] }),
        binary: r({ found: true, path: "/usr/bin/claude" }),
        cwds: r({ items: [] }),
        files: r({ items: [] }),
        start: r({ id: "run-1", status: "running" }),
        get: r({ id: "run-1", status: "running", messages: [], envelopes: [] }),
        send: r({ messageId: "m-1" }),
        kill: r({ ok: true }),
      },
      alerts: {
        list: r({ alerts: [], total: 0, unacked: 0, limit: 50, offset: 0 }),
        ack: r({ alert: {} }),
        ackAll: r({ ok: true, acknowledged: 0 }),
        rules: {
          list: r({ rules: [] }),
          create: r({ rule: {} }),
          update: r({ rule: {} }),
          remove: r({ ok: true }),
        },
      },
      webhooks: {
        list: r({ targets: [] }),
        providers: r({ providers: [] }),
        create: r({ target: {} }),
        update: r({ target: {} }),
        remove: r({ ok: true }),
        test: r({ ok: true, status: 200, attempts: 1, error: null }),
        deliveries: r({ deliveries: [], limit: 20, offset: 0 }),
      },
      updates: { check: r({ behind: 0, ahead: 0, current: "", upstream: "" }), status: r({}) },
    },
  };
});

// eventBus: no-op pub/sub so pages mount without a live socket. onConnection +
// connected back the useSyncExternalStore(eventBus.onConnection, …) reads.
vi.mock("../../lib/eventBus", () => ({
  eventBus: {
    subscribe: () => () => {},
    publish: () => {},
    onConnection: () => () => {},
    connected: true,
    setConnected: () => {},
  },
}));

// push notifications: avoid real service-worker / Notification calls.
vi.mock("../../lib/push", () => ({
  subscribeToPush: vi.fn().mockResolvedValue(undefined),
  unsubscribeFromPush: vi.fn().mockResolvedValue(undefined),
}));

// Page components (imported after the mocks above; vi.mock is hoisted).
import { Dashboard } from "../Dashboard";
import { KanbanBoard } from "../KanbanBoard";
import { Sessions } from "../Sessions";
import { SessionDetail } from "../SessionDetail";
import { ActivityFeed } from "../ActivityFeed";
import { Analytics } from "../Analytics";
import { Workflows } from "../Workflows";
import { CcConfig } from "../CcConfig";
import { Run } from "../Run";
import { Settings } from "../Settings";
import { NotFound } from "../NotFound";

// jsdom lacks these browser APIs that chart / responsive components rely on.
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
globalThis.IntersectionObserver =
  globalThis.IntersectionObserver || (ObserverStub as unknown as typeof IntersectionObserver);
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }) as unknown as MediaQueryList;
}
for (const fn of ["scrollIntoView", "scrollBy", "scrollTo"] as const) {
  if (!(Element.prototype as unknown as Record<string, unknown>)[fn]) {
    (Element.prototype as unknown as Record<string, unknown>)[fn] = function () {};
  }
}

// Flush pending promises (mocked API resolves) + effects so the loaded state
// is rendered before snapshotting.
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
}

async function snapshot(ui: ReactNode, route = "/") {
  const { container } = render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
  await settle();
  expect(container).toMatchSnapshot();
}

beforeAll(() => {
  // Fake only Date so relative/absolute times are deterministic; leave timers
  // real so setTimeout-based flushing in settle() still works.
  vi.useFakeTimers({ now: new Date("2026-06-10T13:00:00.000Z"), toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  i18n.changeLanguage("en");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("screen snapshots", () => {
  it("Dashboard", async () => {
    await snapshot(<Dashboard />, "/");
  });
  it("Kanban board", async () => {
    await snapshot(<KanbanBoard />, "/kanban");
  });
  it("Sessions", async () => {
    await snapshot(<Sessions />, "/sessions");
  });
  it("Session detail", async () => {
    await snapshot(
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetail />} />
      </Routes>,
      "/sessions/sess-1"
    );
  });
  it("Activity feed", async () => {
    await snapshot(<ActivityFeed />, "/activity");
  });
  it("Analytics", async () => {
    await snapshot(<Analytics />, "/analytics");
  });
  it("Workflows", async () => {
    await snapshot(<Workflows />, "/workflows");
  });
  it("Claude Config", async () => {
    await snapshot(<CcConfig />, "/cc-config");
  });
  it("Run", async () => {
    await snapshot(<Run />, "/run");
  });
  it("Settings", async () => {
    await snapshot(<Settings />, "/settings");
  });
  it("Not found", async () => {
    await snapshot(<NotFound />, "/nope");
  });
});
