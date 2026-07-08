/**
 * @file api.ts
 * @description Defines a set of functions for interacting with the backend API of the agent dashboard application. It includes methods for fetching statistics, managing sessions and agents, retrieving analytics data, handling settings, and managing model pricing. The module abstracts away the details of making HTTP requests and provides a clean interface for the rest of the application to use when communicating with the server.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type {
  Agent,
  AlertEvent,
  AlertRule,
  Analytics,
  CostResult,
  DashboardEvent,
  ModelPricing,
  Session,
  SessionDrillIn,
  SessionStats,
  Stats,
  TranscriptListResult,
  TranscriptResult,
  UpdateStatusPayload,
  WebhookDelivery,
  WebhookProvider,
  WebhookTarget,
  WebhookTestResult,
  WebhookType,
  WorkflowData,
  WorkflowRun,
  WorkflowRunsResponse,
  WorkflowRunDetail,
} from "./types";

const BASE = "/api";

/**
 * Optional dashboard auth token (GHSA-gr74-4xfh-6jw9). Only needed when the
 * operator binds the server to a LAN and sets DASHBOARD_TOKEN; for the default
 * loopback bind there is no token and this returns null (zero-config). Read from
 * an injected global first, then localStorage so a LAN user can set it once.
 */
export function dashboardToken(): string | null {
  try {
    const injected = (globalThis as { __DASHBOARD_TOKEN__?: unknown }).__DASHBOARD_TOKEN__;
    if (typeof injected === "string" && injected) return injected;
    const stored = localStorage.getItem("dashboard_token");
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Shared fetch wrapper used by every method on {@link api}. Prefixes `path`
 * with {@link BASE} ("/api"), attaches the dashboard auth token (if any) as
 * the `x-dashboard-token` header, and normalizes non-2xx responses into a
 * thrown `Error` whose message is the server's `error.message` (falling back
 * to `HTTP <status>` when the body isn't JSON or has no message).
 * @param path Path segment appended to `/api` (should start with "/").
 * @param options Standard `fetch` options; `headers` are merged, not replaced.
 * @returns The parsed JSON response body, typed as `T`.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = dashboardToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { "x-dashboard-token": token } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Typed client for every REST endpoint the dashboard consumes, grouped by
 * resource (mirroring the `server/routes/*.js` file layout). Every method
 * returns a `Promise` resolving to the parsed JSON body via {@link request};
 * on a non-2xx response the promise rejects with an `Error`. Real-time updates
 * arrive separately over the WebSocket (see {@link eventBus}/`useWebSocket`) -
 * this object only covers request/response REST calls.
 */
export const api = {
  /** Self-update status: whether this install is a git clone and, if so,
   *  whether the tracked upstream/origin remote is ahead. */
  updates: {
    /** GET /api/updates/status - cached/last-known result. */
    status: () => request<UpdateStatusPayload>("/updates/status"),
    /** POST /api/updates/check - force a fresh `git fetch` + comparison. */
    check: () =>
      request<UpdateStatusPayload>("/updates/check", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },

  /** Lightweight overview counters for the dashboard header. */
  stats: {
    /** GET /api/stats. Sends the browser's UTC offset so `events_today` is
     *  bucketed by the viewer's local midnight, not the server's. */
    get: () => request<Stats>(`/stats?tz_offset=${new Date().getTimezoneOffset()}`),
  },

  /** Session CRUD/read, plus their nested agents/events/transcripts. */
  sessions: {
    /** GET /api/sessions/facets - distinct `cwd` values for the filter dropdown. */
    facets: () => request<{ cwds: string[] }>("/sessions/facets"),
    /** GET /api/sessions - paginated, filterable, sortable session list. */
    list: (params?: {
      status?: string;
      q?: string;
      cwd?: string;
      sort_by?: string;
      sort_desc?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.q) qs.set("q", params.q);
      if (params?.cwd) qs.set("cwd", params.cwd);
      if (params?.sort_by) qs.set("sort_by", params.sort_by);
      if (params?.sort_desc !== undefined) qs.set("sort_desc", String(params.sort_desc));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const queryString = qs.toString();
      return request<{ sessions: Session[]; total: number; limit: number; offset: number }>(
        `/sessions${queryString ? `?${queryString}` : ""}`
      );
    },
    /** GET /api/sessions/:id - one session with its agents, events, and any
     *  Workflow-tool runs launched from it. */
    get: (id: string) =>
      request<{
        session: Session;
        agents: Agent[];
        events: DashboardEvent[];
        workflows: WorkflowRun[];
      }>(`/sessions/${encodeURIComponent(id)}`),
    /** GET /api/sessions/:id/stats - per-session rollups for the detail page. */
    stats: (id: string) => request<SessionStats>(`/sessions/${encodeURIComponent(id)}/stats`),
    /** GET /api/sessions/:id/transcripts - the picker list of available
     *  transcripts (main agent, subagents, compaction markers) for this session. */
    transcripts: (id: string) =>
      request<TranscriptListResult>(`/sessions/${encodeURIComponent(id)}/transcripts`),
    /** GET /api/sessions/:id/transcript - a page of parsed transcript messages.
     *  Paginate with `after`/`before` (JSONL line numbers from the previous
     *  page's `first_line`/`last_line`) rather than `offset` for a live file.
     *  Pass `agent_id`/`run_id` to read a subagent's transcript instead of the
     *  main session's. */
    transcript: (
      id: string,
      params?: {
        agent_id?: string;
        run_id?: string;
        limit?: number;
        offset?: number;
        after?: number;
        before?: number;
      }
    ) => {
      const qs = new URLSearchParams();
      if (params?.agent_id) qs.set("agent_id", params.agent_id);
      if (params?.run_id) qs.set("run_id", params.run_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      if (params?.after != null) qs.set("after", String(params.after));
      if (params?.before != null) qs.set("before", String(params.before));
      const q = qs.toString();
      return request<TranscriptResult>(
        `/sessions/${encodeURIComponent(id)}/transcript${q ? `?${q}` : ""}`
      );
    },
  },

  agents: {
    /** GET /api/agents - agent list, optionally filtered by status/session. */
    list: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{ agents: Agent[] }>(`/agents${q ? `?${q}` : ""}`);
    },
  },

  events: {
    /** GET /api/events - the global cross-session event feed. Array-valued
     *  filters (`event_type`/`tool_name`/`agent_id`) are OR'd server-side via
     *  comma-joined query params. */
    list: (params?: {
      event_type?: string[];
      tool_name?: string[];
      agent_id?: string[];
      session_id?: string | string[];
      q?: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      const csv = (v?: string[]) => (v && v.length > 0 ? v.join(",") : undefined);
      const et = csv(params?.event_type);
      const tn = csv(params?.tool_name);
      const ag = csv(params?.agent_id);
      const sid = Array.isArray(params?.session_id) ? csv(params?.session_id) : params?.session_id;
      if (et) qs.set("event_type", et);
      if (tn) qs.set("tool_name", tn);
      if (ag) qs.set("agent_id", ag);
      if (sid) qs.set("session_id", sid);
      if (params?.q) qs.set("q", params.q);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{
        events: DashboardEvent[];
        limit: number;
        offset: number;
        total: number;
      }>(`/events${q ? `?${q}` : ""}`);
    },
    /** GET /api/events/facets - distinct event/tool names for filter dropdowns. */
    facets: () => request<{ event_types: string[]; tool_names: string[] }>("/events/facets"),
  },

  /** Chart-oriented usage analytics for the Analytics page. */
  analytics: {
    /** GET /api/analytics. `tz_offset` shifts the daily buckets to local time,
     *  same convention as {@link api.stats.get}. */
    get: () => request<Analytics>(`/analytics?tz_offset=${new Date().getTimezoneOffset()}`),
  },

  /** Server/DB introspection and destructive maintenance operations for the
   *  Settings page (info, hooks reinstall, data reset, pricing reset, cleanup). */
  settings: {
    /** GET /api/settings/info - DB size/pragmas, hook install status, server
     *  process stats, and transcript-cache stats, all in one call. */
    info: () =>
      request<{
        db: {
          path: string;
          size: number;
          counts: Record<string, number>;
          pragmas: {
            journal_mode: string;
            synchronous: number;
            auto_vacuum: number;
            encoding: string;
            foreign_keys: number;
            busy_timeout: number;
          };
          load_stats: { m5: number; m15: number; h1: number };
        };
        hooks: { installed: boolean; path: string; hooks: Record<string, boolean> };
        server: {
          uptime: number;
          node_version: string;
          platform: string;
          ws_connections: number;
          memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
          cpu_load: number[];
          arch: string;
          total_mem: number;
          free_mem: number;
          cpus: number;
        };
        transcript_cache: {
          size: number;
          maxSize: number;
          hits: number;
          misses: number;
          keys: string[];
        };
      }>("/settings/info"),
    /** Get/set the `~/.claude` root the server reads config from. */
    claudeHome: {
      get: () => request<{ claude_home: string }>("/settings/claude-home"),
      set: (path: string) =>
        request<{ ok: boolean; claude_home: string }>("/settings/claude-home", {
          method: "PUT",
          body: JSON.stringify({ path }),
        }),
    },
    /** POST /api/settings/clear-data - DESTRUCTIVE: wipes sessions/agents/
     *  events/etc. from the dashboard DB. Returns per-table row counts deleted. */
    clearData: () =>
      request<{ ok: boolean; cleared: Record<string, number> }>("/settings/clear-data", {
        method: "POST",
      }),
    /** POST /api/settings/reimport - re-scan `~/.claude/projects` and
     *  backfill anything not already in the DB. */
    reimport: () =>
      request<{ ok: boolean; imported: number; skipped: number; errors: number }>(
        "/settings/reimport",
        { method: "POST" }
      ),
    /** POST /api/settings/reinstall-hooks - re-write the dashboard's Claude
     *  Code hook entries into `~/.claude/settings.json`. */
    reinstallHooks: () =>
      request<{ ok: boolean; hooks: { installed: boolean; hooks: Record<string, boolean> } }>(
        "/settings/reinstall-hooks",
        { method: "POST" }
      ),
    /** POST /api/settings/reset-pricing - restore the built-in default
     *  {@link ModelPricing} rules, discarding any custom edits. */
    resetPricing: () =>
      request<{ ok: boolean; pricing: ModelPricing[] }>("/settings/reset-pricing", {
        method: "POST",
      }),
    /** Direct download URL for GET /api/settings/export (a full DB dump);
     *  not fetched via {@link request} since it's used as an `<a href>`. */
    exportData: () => `${BASE}/settings/export`,
    /** POST /api/settings/cleanup - DESTRUCTIVE: marks sessions idle longer
     *  than `abandon_hours` as "abandoned", and purges rows older than
     *  `purge_days`. Returns counts of what was abandoned/purged. */
    cleanup: (params: { abandon_hours?: number; purge_days?: number }) =>
      request<{
        ok: boolean;
        abandoned: number;
        purged_sessions: number;
        purged_events: number;
        purged_agents: number;
      }>("/settings/cleanup", { method: "POST", body: JSON.stringify(params) }),
  },

  /** Events-derived workflow intelligence (`get`/`session`) plus Workflow-tool
   *  fleet runs ingested from on-disk journals (`runs`/`run`). */
  workflows: {
    /** GET /api/workflows - the full {@link WorkflowData} panel bundle,
     *  optionally filtered to "active"/"completed" sessions. */
    get: (status?: string) =>
      request<WorkflowData>(`/workflows${status && status !== "all" ? `?status=${status}` : ""}`),
    /** GET /api/workflows/session/:id - single-session drill-in (agent tree,
     *  tool timeline, swim lanes). */
    session: (id: string) =>
      request<SessionDrillIn>(`/workflows/session/${encodeURIComponent(id)}`),
    // Workflow-tool runs (issue #167) - fleets ingested from on-disk journals.
    /** GET /api/workflows/runs - paginated Workflow-tool run list. */
    runs: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status && params.status !== "all") qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<WorkflowRunsResponse>(`/workflows/runs${q ? `?${q}` : ""}`);
    },
    /** GET /api/workflows/runs/:runId - one run with its inner agents/events. */
    run: (runId: string) =>
      request<WorkflowRunDetail>(`/workflows/runs/${encodeURIComponent(runId)}`),
  },

  /** {@link ModelPricing} rule CRUD, plus computed cost totals. */
  pricing: {
    /** GET /api/pricing - all configured pricing rules. */
    list: () => request<{ pricing: ModelPricing[] }>("/pricing"),
    /** PUT /api/pricing - create a new rule or overwrite the one matching
     *  `data.model_pattern` (the primary key). */
    upsert: (data: Omit<ModelPricing, "updated_at">) =>
      request<{ pricing: ModelPricing }>("/pricing", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    /** DELETE /api/pricing/:pattern - remove a rule; usage matching it then
     *  falls through to a less-specific rule or `unpriced_models`. */
    delete: (pattern: string) =>
      request<{ ok: boolean }>(`/pricing/${encodeURIComponent(pattern)}`, {
        method: "DELETE",
      }),
    /** GET /api/pricing/cost - total cost across every session, priced with
     *  each day's rate (respects time-limited intro pricing). */
    totalCost: () =>
      request<CostResult>(`/pricing/cost?tz_offset=${new Date().getTimezoneOffset()}`),
    /** GET /api/pricing/cost/:sessionId - cost for one session, priced as of
     *  the session's start date. */
    sessionCost: (sessionId: string) =>
      request<CostResult>(
        `/pricing/cost/${encodeURIComponent(sessionId)}?tz_offset=${new Date().getTimezoneOffset()}`
      ),
  },

  /** Transcript import: on-disk scan/rescan, an explicit path scan, or a
   *  browser file upload - all three converge on the same {@link ImportResult}
   *  shape and stream progress via the `import.progress` WS message. */
  import: {
    /** GET /api/import/guide - platform-specific instructions and constraints
     *  (default projects dir, supported extensions, upload limits) shown on
     *  first run / in the Import wizard. */
    guide: () =>
      request<{
        platform: string;
        default_projects_dir: string;
        default_projects_dir_display: string;
        default_projects_dir_exists: boolean;
        default_projects_dir_stats: { projects: number; jsonl_files: number };
        archive_command: string;
        supported_extensions: string[];
        max_upload_bytes: number;
        max_upload_files: number;
        steps: { id: string; title: string; body: string }[];
      }>("/import/guide"),
    /** POST /api/import/rescan - re-scan the default projects directory. */
    rescan: () => request<ImportResult>("/import/rescan", { method: "POST" }),
    /** POST /api/import/scan-path - scan an arbitrary directory for
     *  Claude Code project transcripts. */
    scanPath: (path: string) =>
      request<ImportResult>("/import/scan-path", {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
    /** POST /api/import/upload (multipart) - import a set of user-selected
     *  transcript files. Bypasses {@link request} to use `FormData`. */
    upload: async (files: File[]): Promise<ImportResult> => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      const res = await fetch(`${BASE}/import/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      return res.json();
    },
  },

  /** Read/write access to on-disk Claude Code configuration - skills, agents,
   *  commands, output styles, plugins, MCP servers, hooks, settings.json,
   *  CLAUDE.md/auto-memory, marketplaces, keybindings, and the statusline
   *  script - for the dashboard's "CC Config" explorer/editor pages. */
  ccConfig: {
    /** GET /api/cc-config/overview - counts of every artifact kind, for the
     *  explorer's landing page. */
    overview: () => request<CcOverview>("/cc-config/overview"),
    /** GET /api/cc-config/skills - user and/or project SKILL.md files. */
    skills: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/skills${scope ? `?scope=${scope}` : ""}`),
    /** GET /api/cc-config/agents - user and/or project subagent definitions. */
    agents: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/agents${scope ? `?scope=${scope}` : ""}`),
    /** GET /api/cc-config/commands - user and/or project slash commands. */
    commands: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/commands${scope ? `?scope=${scope}` : ""}`),
    /** GET /api/cc-config/output-styles. */
    outputStyles: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/output-styles${scope ? `?scope=${scope}` : ""}`),
    /** GET /api/cc-config/plugins - installed marketplace plugins and what
     *  each one contributes (skills/agents/commands/hooks counts). */
    plugins: () => request<CcPluginsResponse>("/cc-config/plugins"),
    /** GET /api/cc-config/mcp - configured MCP servers, user and project-scoped. */
    mcp: () => request<CcMcpResponse>("/cc-config/mcp"),
    /** GET /api/cc-config/hooks - hook entries from every settings.json layer. */
    hooks: () => request<{ items: CcHookSource[] }>("/cc-config/hooks"),
    /** GET /api/cc-config/settings - raw settings.json files by scope. */
    settings: () => request<{ items: CcSettingsSource[] }>("/cc-config/settings"),
    /** GET /api/cc-config/memory - CLAUDE.md files plus per-project auto-memory. */
    memory: () => request<{ items: CcMemoryItem[] }>("/cc-config/memory"),
    /** GET /api/cc-config/file - raw contents of one config file by absolute path. */
    file: (absPath: string) =>
      request<CcFileResponse>(`/cc-config/file?path=${encodeURIComponent(absPath)}`),
    /** PUT /api/cc-config/file - create/overwrite a config artifact; the
     *  server writes a backup of any previous content first. */
    write: (args: CcWriteArgs) =>
      request<CcMutationResult>("/cc-config/file", {
        method: "PUT",
        body: JSON.stringify(args),
      }),
    /** DELETE /api/cc-config/file - remove a config artifact (also backed up). */
    delete: (args: CcDeleteArgs) =>
      request<CcMutationResult>("/cc-config/file", {
        method: "DELETE",
        body: JSON.stringify(args),
      }),
    /** GET /api/cc-config/marketplaces - registered plugin marketplaces. */
    marketplaces: () => request<CcMarketplacesResponse>("/cc-config/marketplaces"),
    /** GET /api/cc-config/keybindings - parsed `keybindings.json`. */
    keybindings: () => request<CcKeybindings>("/cc-config/keybindings"),
    /** GET /api/cc-config/statusline - active statusline config + scripts. */
    statusline: () => request<CcStatusline>("/cc-config/statusline"),
    /** GET /api/cc-config/hook-scripts - shell scripts referenced by hooks. */
    hookScripts: () => request<CcHookScripts>("/cc-config/hook-scripts"),
    /** GET /api/cc-config/backups - timestamped backups written by `write`/
     *  `delete`, optionally filtered by scope/artifact type. */
    backups: (params?: { scope?: "user" | "project"; type?: CcArtifactType }) =>
      requestBackupsHelper(params),
  },

  /** Spawn/manage headless or conversational `claude` CLI child processes
   *  launched from the dashboard's Run page, and stream their output. */
  run: {
    /** GET /api/run - currently tracked runs (in-memory handles) plus
     *  concurrency limits. */
    list: () => request<RunListResponse>("/run"),
    /** GET /api/run/history - persisted run history from the `dashboard_runs`
     *  table, including runs whose in-memory handle has since been reaped. */
    history: (limit = 50) =>
      request<{ items: DashboardRunHistoryItem[] }>(`/run/history?limit=${limit}`),
    /** GET /api/run/binary - whether a `claude` executable was found on PATH. */
    binary: () => request<{ found: boolean; path: string | null }>("/run/binary"),
    /** GET /api/run/cwds - suggested working directories for the cwd picker. */
    cwds: () => request<{ items: CwdSuggestion[] }>("/run/cwds"),
    /** GET /api/run/files - path-completion suggestions under `cwd`, filtered
     *  by an optional query fragment `q`. */
    files: (cwd: string, q?: string) => {
      const qs = new URLSearchParams({ cwd });
      if (q) qs.set("q", q);
      return request<{ items: string[] }>(`/run/files?${qs.toString()}`);
    },
    /** POST /api/run - spawn a new `claude` child process. */
    start: (args: RunStartArgs) =>
      request<RunHandle>("/run", { method: "POST", body: JSON.stringify(args) }),
    /** GET /api/run/:id - one run's current handle; pass `envelopes: true` to
     *  also include its buffered stream-json envelopes (for a page refresh
     *  mid-run, since the WS `run_stream` history isn't otherwise replayed). */
    get: (id: string, opts?: { envelopes?: boolean }) =>
      request<RunHandle>(`/run/${encodeURIComponent(id)}${opts?.envelopes ? "?envelopes=1" : ""}`),
    /** POST /api/run/:id/message - write `text` to the run's stdin (conversation
     *  mode only); acked via the `run_input_ack` WS message. */
    send: (id: string, text: string) =>
      request<{ messageId: string }>(`/run/${encodeURIComponent(id)}/message`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    /** DELETE /api/run/:id - forcibly terminate a running process. */
    kill: (id: string) =>
      request<{ ok: true }>(`/run/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  /** Alert rule CRUD plus the fired-alert feed and acknowledgement. */
  alerts: {
    /** GET /api/alerts - fired-alert feed, newest first. */
    list: (params?: { unacked?: boolean; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.unacked) qs.set("unacked", "true");
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{
        alerts: AlertEvent[];
        total: number;
        unacked: number;
        limit: number;
        offset: number;
      }>(`/alerts${q ? `?${q}` : ""}`);
    },
    /** POST /api/alerts/:id/ack - acknowledge a single fired alert. */
    ack: (id: number) => request<{ alert: AlertEvent }>(`/alerts/${id}/ack`, { method: "POST" }),
    /** POST /api/alerts/ack-all - acknowledge every unacked alert at once. */
    ackAll: () =>
      request<{ ok: true; acknowledged: number }>("/alerts/ack-all", { method: "POST" }),
    /** CRUD for the alert rule definitions themselves (not the fired events). */
    rules: {
      list: () => request<{ rules: AlertRule[] }>("/alerts/rules"),
      create: (rule: {
        name: string;
        rule_type: AlertRule["rule_type"];
        config: AlertRule["config"];
        enabled?: boolean;
        cooldown_seconds?: number;
      }) =>
        request<{ rule: AlertRule }>("/alerts/rules", {
          method: "POST",
          body: JSON.stringify(rule),
        }),
      update: (
        id: string,
        patch: Partial<Pick<AlertRule, "name" | "config" | "enabled" | "cooldown_seconds">>
      ) =>
        request<{ rule: AlertRule }>(`/alerts/rules/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      remove: (id: string) =>
        request<{ ok: true }>(`/alerts/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },
  },

  /** Outbound webhook target CRUD, provider metadata, test sends, and the
   *  per-target delivery log. */
  webhooks: {
    /** GET /api/webhooks - configured targets (secrets/URLs redacted). */
    list: () => request<{ targets: WebhookTarget[] }>("/webhooks"),
    /** GET /api/webhooks/providers - supported provider types and their
     *  form-field schemas, for the "Add webhook" dialog. */
    providers: () => request<{ providers: WebhookProvider[] }>("/webhooks/providers"),
    /** POST /api/webhooks - create a new target. */
    create: (target: {
      name: string;
      type: WebhookType;
      url?: string;
      enabled?: boolean;
      secret?: string;
      headers?: Record<string, string>;
      config?: Record<string, string>;
      rule_ids?: string[];
    }) =>
      request<{ target: WebhookTarget }>("/webhooks", {
        method: "POST",
        body: JSON.stringify(target),
      }),
    update: (
      id: string,
      patch: {
        name?: string;
        url?: string;
        enabled?: boolean;
        secret?: string | null;
        headers?: Record<string, string>;
        config?: Record<string, string>;
        rule_ids?: string[];
      }
    ) =>
      request<{ target: WebhookTarget }>(`/webhooks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    /** DELETE /api/webhooks/:id - remove a target. */
    remove: (id: string) =>
      request<{ ok: true }>(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    /** POST /api/webhooks/:id/test - send a synchronous test payload; not
     *  recorded in the delivery log. */
    test: (id: string) =>
      request<WebhookTestResult>(`/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" }),
    /** GET /api/webhooks/:id/deliveries - paginated delivery history for one target. */
    deliveries: (id: string, params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{ deliveries: WebhookDelivery[]; limit: number; offset: number }>(
        `/webhooks/${encodeURIComponent(id)}/deliveries${q ? `?${q}` : ""}`
      );
    },
  },
};

/** Backs `api.ccConfig.backups` - a plain function (not inlined into the `api`
 *  object literal) purely so its query-building logic can be unit-referenced. */
function requestBackupsHelper(params?: { scope?: "user" | "project"; type?: CcArtifactType }) {
  const qs = new URLSearchParams();
  if (params?.scope) qs.set("scope", params.scope);
  if (params?.type) qs.set("type", params.type);
  const q = qs.toString();
  return request<{ items: CcBackup[] }>(`/cc-config/backups${q ? `?${q}` : ""}`);
}

/** Kind of Claude Code config artifact manageable via `api.ccConfig.write`/
 *  `delete` - each maps to a distinct on-disk location under `.claude/`. */
export type CcArtifactType =
  | "skills"
  | "agents"
  | "commands"
  | "output-styles"
  | "memory"
  | "auto-memory";

/** Body for PUT /api/cc-config/file - create or overwrite one artifact. */
export interface CcWriteArgs {
  // "auto-memory" targets a per-project memory file and requires `project`.
  scope: "user" | "project" | "auto-memory";
  type: CcArtifactType;
  /** Artifact name (e.g. skill/agent/command name); omitted for singleton
   *  artifacts like a scope's CLAUDE.md. */
  name?: string;
  /** Full file contents to write. */
  content: string;
  /** Target project slug; required when `scope === "auto-memory"`. */
  project?: string;
}

/** Body for DELETE /api/cc-config/file - remove one artifact. */
export interface CcDeleteArgs {
  scope: "user" | "project" | "auto-memory";
  type: CcArtifactType;
  name?: string;
  project?: string;
}

/** Response shape of a successful `ccConfig.write`/`delete` call. */
export interface CcMutationResult {
  ok: true;
  /** Absolute path of the file that was written/deleted. */
  file: string;
  /** Human-readable description of what was mutated, for a toast/log line. */
  target: string;
  /** Path to the pre-mutation backup the server wrote, or null if none was
   *  needed (e.g. deleting a file that didn't exist). */
  backupPath: string | null;
  /** True when `write` created a new file rather than overwriting one. */
  created?: boolean;
}

/** One timestamped backup of a config artifact, from GET /api/cc-config/backups -
 *  written automatically before every destructive `write`/`delete`. */
export interface CcBackup {
  scope: "user" | "project" | "auto-memory";
  type: CcArtifactType;
  name: string;
  /** Absolute path to the backup copy (not the original file). */
  backupPath: string;
  /** Whether the backed-up artifact is a directory (vs. a single file). */
  isDir: boolean;
  /** Backup file's mtime, epoch milliseconds. */
  mtime: number;
  /** Backup size in bytes; null for directory backups. */
  size: number | null;
  project?: string; // present for scope === "auto-memory"
}

/** Scope filter accepted by most `ccConfig` list endpoints; "all" merges
 *  user + project scope in one response. */
export type CcScope = "user" | "project" | "all";

/** One markdown-based config artifact (skill/agent/command/output-style),
 *  as summarized by the `ccConfig` list endpoints. */
export interface CcMdItem {
  scope: "user" | "project";
  /** Artifact name, derived from its filename/frontmatter. */
  name: string;
  /** Filename only, when the API returns it instead of a full path. */
  file?: string;
  /** Absolute path, when the API returns it instead of a bare filename. */
  path?: string;
  size: number;
  /** File's mtime, epoch milliseconds. */
  mtime: number;
  /** Whether `preview` was cut short of the full file content. */
  truncated: boolean;
  /** Parsed YAML frontmatter key/value pairs (e.g. `description`, `model`). */
  frontmatter: Record<string, string>;
  /** Leading excerpt of the file body, for list-view hover/preview. */
  preview: string;
}

/** Counts of what a plugin contributes to Claude Code, plus its manifest
 *  metadata, embedded in {@link CcPlugin}. */
export interface CcPluginContributions {
  skills: number;
  agents: number;
  commands: number;
  outputStyles: number;
  hooks: number;
  /** Parsed `plugin.json` fields; null if the plugin has no manifest. */
  pluginJson: {
    name?: string;
    description?: string;
    version?: string;
    author?: { name?: string; email?: string };
    homepage?: string;
    repository?: string;
    license?: string;
    keywords?: string[];
  } | null;
}

/** One installed marketplace plugin, from GET /api/cc-config/plugins - merges
 *  the install manifest with a live filesystem/git check. */
export interface CcPlugin {
  /** Unique key within the plugin manifest (usually `<marketplace>/<name>`). */
  key: string;
  name: string;
  /** Marketplace it was installed from; null for a manually-installed plugin. */
  marketplace: string | null;
  /** Install scope, e.g. "user" or "project". */
  scope: string;
  version: string | null;
  /** Absolute path where the plugin's files live. */
  installPath: string | null;
  installedAt: string | null;
  /** ISO timestamp of the last update check/pull for this plugin. */
  lastUpdated: string | null;
  /** Git commit SHA the plugin was installed/updated at, if it's a git checkout. */
  gitCommitSha: string | null;
  /** Whether `installPath` still exists on disk (false = broken/missing install). */
  installPathExists: boolean;
  /** Whether the plugin is active; null when enablement isn't tracked for it. */
  enabled: boolean | null;
  contributes: CcPluginContributions | null;
}

/** Response shape of GET /api/cc-config/plugins. */
export interface CcPluginsResponse {
  /** Path to the plugin install manifest file. */
  manifestPath: string;
  manifestExists: boolean;
  plugins: CcPlugin[];
}

/** One configured MCP server entry, from GET /api/cc-config/mcp. */
export interface CcMcpServer {
  name: string;
  /** Which config file this entry came from (e.g. a `.mcp.json` path). */
  source: string;
  /** Transport: local subprocess ("stdio"), remote HTTP, or undetermined. */
  kind: "stdio" | "http" | "unknown";
  /** Launch command, for `kind === "stdio"`. */
  command?: string;
  args?: string[];
  /** Names (not values) of env vars the server config references. */
  envNames?: string[];
  /** Endpoint URL, for `kind === "http"`. */
  url?: string;
  /** Header names (not values) sent with HTTP requests. */
  headers?: string[];
}

/** Response shape of GET /api/cc-config/mcp, split by config scope. */
export interface CcMcpResponse {
  user: CcMcpServer[];
  /** Servers configured in the current project's `.mcp.json`/settings. */
  projectScoped: CcMcpServer[];
}

/** One hook binding within a settings.json `hooks` block. */
export interface CcHookEntry {
  /** Tool-name matcher pattern (e.g. "Bash", "Edit|Write", or "*"). */
  matcher: string;
  /** Hook kind, e.g. "command". */
  type: string;
  /** Shell command executed for this hook; null for non-command hook types. */
  command: string | null;
  /** Timeout in seconds before the hook is killed; null = no explicit timeout. */
  timeout: number | null;
}

/** One settings.json layer's hook configuration, from GET /api/cc-config/hooks. */
export interface CcHookSource {
  /** "project-local" is the gitignored `settings.local.json` override layer. */
  scope: "user" | "project" | "project-local";
  /** Absolute path to the settings file this scope reads from. */
  file: string;
  /** Whether the file actually exists (false = scope has no overrides yet). */
  exists: boolean;
  /** Hook entries keyed by event name (e.g. "PreToolUse", "Stop"). */
  hooks: Record<string, CcHookEntry[]>;
}

/** One settings.json layer's raw contents, from GET /api/cc-config/settings. */
export interface CcSettingsSource {
  scope: "user" | "project" | "project-local";
  file: string;
  exists: boolean;
  /** Parsed JSON contents; absent when `exists` is false. */
  data?: unknown;
  /** Raw file size in bytes, when known. */
  raw_size?: number;
}

/** One memory artifact - either a project's/user's editable CLAUDE.md, or a
 *  read-only auto-memory file - from GET /api/cc-config/memory. */
export interface CcMemoryItem {
  // "user"/"project" are the two CLAUDE.md files (editable). "auto-memory"
  // is a per-project file-based memory file under ~/.claude/projects/<slug>/
  // memory/ — read-only in the dashboard for now.
  scope: "user" | "project" | "auto-memory";
  file: string;
  size: number;
  mtime: number;
  truncated: boolean;
  preview: string;
  // Present only for scope === "auto-memory":
  project?: string; // the projects/<slug> dir name
  name?: string; // the markdown filename (e.g. MEMORY.md, feedback_x.md)
  isIndex?: boolean; // true for MEMORY.md / INDEX-*.md table-of-contents files
  frontmatter?: Record<string, string>; // parsed YAML frontmatter, if any
}

/** Response shape of GET /api/cc-config/file - full contents of one config
 *  artifact, for the read/edit view. */
export interface CcFileResponse {
  ok: true;
  file: string;
  /** File contents (possibly truncated - see `truncated`). */
  text: string;
  /** Full on-disk file size in bytes (may exceed `text.length` if truncated). */
  size: number;
  mtime: number;
  /** Whether `text` was cut short of the full file (very large files). */
  truncated: boolean;
}

/** Response shape of GET /api/cc-config/overview - counts of every config
 *  artifact kind, for the explorer's landing dashboard. */
export interface CcOverview {
  /** Key filesystem locations the explorer reads from. */
  roots: {
    claudeHome: string;
    projectClaudeDir: string;
    projectRoot: string;
    /** Path to the top-level `.claude.json` (marketplaces/global settings). */
    claudeJson: string;
  };
  /** Per-artifact-kind counts, split by scope where applicable. */
  counts: {
    skills: { user: number; project: number };
    agents: { user: number; project: number };
    commands: { user: number; project: number };
    outputStyles: { user: number; project: number };
    plugins: number;
    pluginsEnabled: number;
    pluginsDisabled: number;
    marketplaces: number;
    keybindings: number;
    mcpServers: { user: number; project: number };
    /** Hook-entry counts keyed by scope. */
    hooks: Record<string, number>;
    memory: number;
    settingsFiles: number;
  };
}

/** One registered plugin marketplace, from GET /api/cc-config/marketplaces. */
export interface CcMarketplace {
  name: string;
  /** Where the marketplace is sourced from (git repo, URL, …); null if unknown. */
  source: { source?: string; repo?: string; url?: string } | null;
  /** Local checkout path for a git-based marketplace; null otherwise. */
  installLocation: string | null;
  lastUpdated: string | null;
  /** Number of plugins the marketplace publishes; null if not yet indexed. */
  pluginCount: number | null;
  /** Marketplace's own self-reported display name (may differ from `name`). */
  marketplaceName: string | null;
  marketplaceDescription: string | null;
  marketplaceOwner: { name?: string; url?: string } | null;
}

/** Response shape of GET /api/cc-config/marketplaces. */
export interface CcMarketplacesResponse {
  /** Path to the marketplace registry file the dashboard reads. */
  knownPath: string;
  knownExists: boolean;
  items: CcMarketplace[];
}

/** One logical group of keybindings sharing a UI context (e.g. "editor",
 *  "global"), as parsed from `keybindings.json`. */
export interface CcKeybindingGroup {
  context: string;
  bindings: { key: string; action: string }[];
}

/** Response shape of GET /api/cc-config/keybindings. */
export interface CcKeybindings {
  file: string;
  exists: boolean;
  /** JSON schema URL declared in the file, if any. */
  schema?: string | null;
  /** Doc/help URL declared in the file, if any. */
  docs?: string | null;
  groups: CcKeybindingGroup[];
}

/** One statusline script file, referenced by {@link CcStatusline.config}. */
export interface CcStatuslineScript {
  file: string;
  size: number;
  mtime: number;
  truncated: boolean;
  preview: string;
}

/** Response shape of GET /api/cc-config/statusline. */
export interface CcStatusline {
  /** Active statusline config from settings.json; null if unset. */
  config: { type?: string; command?: string } | null;
  /** Candidate/available statusline scripts discovered on disk. */
  scripts: CcStatuslineScript[];
}

/** Response shape of GET /api/cc-config/hook-scripts - shell scripts found in
 *  the hooks directory that a `CcHookEntry.command` might reference. */
export interface CcHookScripts {
  dir: string;
  items: { name: string; file: string; size: number; mtime: number }[];
}

/** "headless" runs to completion unattended and streams only output;
 *  "conversation" keeps stdin open so the user can send follow-up messages. */
export type RunMode = "headless" | "conversation";
/** Lifecycle of a spawned `claude` process, mirrored in `RunHandle.status`
 *  and `RunStatusPayload.status`. "abandoned" is applied by server cleanup
 *  when a handle is reaped without a clean exit ever being observed. */
export type RunStatus = "spawning" | "running" | "completed" | "error" | "killed" | "abandoned";
/** Maps 1:1 to the `claude --permission-mode` CLI flag. */
export type PermissionMode = "acceptEdits" | "default" | "plan" | "bypassPermissions";
/** Maps 1:1 to the `claude --effort` CLI flag; "" omits the flag (model default). */
export type EffortLevel = "" | "low" | "medium" | "high" | "xhigh" | "max";

/** Body for POST /api/run - parameters for spawning a new `claude` process. */
export interface RunStartArgs {
  /** Initial prompt/task text passed to the CLI. */
  prompt: string;
  mode: RunMode;
  /** Working directory to launch in; server default applies if omitted. */
  cwd?: string;
  /** `--model` value; omitted inherits the CLI's own default (settings.json). */
  model?: string;
  permissionMode?: PermissionMode;
  /** Resume an existing Claude Code session id (`--resume`) instead of starting fresh. */
  resumeSessionId?: string;
  effort?: EffortLevel;
}

/** In-memory (or freshly-fetched) handle for one spawned `claude` process,
 *  from POST/GET /api/run - the live counterpart to {@link DashboardRunHistoryItem}. */
export interface RunHandle {
  id: string;
  /** OS process id; null before the process has actually spawned. */
  pid: number | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  permissionMode: PermissionMode;
  effort: EffortLevel | null;
  prompt: string;
  /** Full argv the server invoked the CLI with, for debugging. */
  argv: string[];
  resumeSessionId: string | null;
  status: RunStatus;
  /** Epoch-ms timestamp the process was spawned. */
  startedAt: number;
  /** Epoch-ms timestamp the process exited; null while still running. */
  endedAt: number | null;
  exitCode: number | null;
  /** POSIX signal that killed the process (e.g. "SIGTERM"); null otherwise. */
  signal: string | null;
  error: string | null;
  /** Claude Code session id the run created/resumed, once known. */
  sessionId: string | null;
  /** Count of stream-json envelopes emitted so far. */
  envelopeCount: number;
  /** Last chunk of captured stdout, for a quick inline preview. */
  stdoutTail: string;
  /** Last chunk of captured stderr, for a quick inline preview. */
  stderrTail: string;
  envelopes?: unknown[]; // present when fetched with ?envelopes=1
}

/** Response shape of GET /api/run. */
export interface RunListResponse {
  items: RunHandle[];
  /** Server-configured cap on simultaneously running processes. */
  maxConcurrent: number;
  /** Count of runs currently in "spawning"/"running" state. */
  activeCount: number;
}

/**
 * A row from the persistent `dashboard_runs` sqlite table - every run ever
 * spawned via /api/run, including completed / errored / killed ones long
 * after the in-memory handle has been reaped.
 */
export interface DashboardRunHistoryItem {
  id: string;
  /** Claude Code session id the run created/resumed; null if never captured. */
  session_id: string | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  permission_mode: PermissionMode | null;
  effort: EffortLevel | null;
  resume_session_id: string | null;
  /** Truncated leading excerpt of the original prompt, for the history list. */
  prompt_preview: string | null;
  status: RunStatus;
  exit_code: number | null;
  started_at: string;
  ended_at: string | null;
  /** True when an in-memory {@link RunHandle} for this row still exists (so
   *  the UI can offer live actions like "send message"/"kill"); false once
   *  the handle has been reaped and only the DB row remains. */
  isLive: boolean;
}

/** One suggested working directory for the Run page's cwd picker. */
export interface CwdSuggestion {
  /** "dashboard" = this server's own cwd; "home" = user's home dir; "recent"
   *  = previously used for a run. */
  kind: "dashboard" | "home" | "recent";
  path: string;
  label: string;
}

/** One entry in {@link RUN_MODEL_CHOICES} - a curated model the Run page's
 *  model picker offers. */
export interface ModelChoice {
  id: string; // value sent to claude --model
  label: string; // user-facing
  /** Short helper text shown under the option. */
  hint?: string;
}

// Effort level choices for `claude --effort`. Higher = more thinking tokens
// before the assistant turn. Empty inherits the model's default.
export interface EffortChoice {
  id: EffortLevel;
  label: string;
  hint?: string;
}

export const RUN_EFFORT_CHOICES: EffortChoice[] = [
  { id: "", label: "Default (model decides)", hint: "No --effort flag" },
  { id: "low", label: "Low", hint: "Fast, minimal thinking" },
  { id: "medium", label: "Medium", hint: "Balanced" },
  { id: "high", label: "High", hint: "More reasoning, slower" },
  { id: "xhigh", label: "Extra-high", hint: "Deep reasoning" },
  { id: "max", label: "Max", hint: "All-out - slowest, most tokens" },
];

// Curated model list. "" means "inherit from settings.json" - no --model flag.
export const RUN_MODEL_CHOICES: ModelChoice[] = [
  { id: "", label: "Inherit from settings", hint: "Use whatever your settings.json model is" },
  {
    id: "claude-opus-4-8[1m]",
    label: "Opus 4.8 (1M context)",
    hint: "Highest capability, 1M token window",
  },
  {
    id: "claude-opus-4-7[1m]",
    label: "Opus 4.7 (1M context)",
    hint: "Previous Opus, 1M token window",
  },
  { id: "sonnet", label: "Sonnet 4.6", hint: "Balanced capability and speed" },
  { id: "haiku", label: "Haiku 4.5", hint: "Fastest, lightest" },
];

/** Result of a transcript import run - returned by `api.import.rescan`,
 *  `scanPath`, and `upload`, and mirrored by the final `import.progress`
 *  WebSocket message (`phase: "complete"`). */
export interface ImportResult {
  ok: boolean;
  /** Which import flow produced this result. */
  source: "default" | "path" | "upload";
  /** Directory that was scanned; present for `source === "path"`. */
  path?: string;
  /** New session/event rows created. */
  imported: number;
  /** Entries already present in the DB, left untouched. */
  skipped: number;
  /** Existing rows updated with data that was missing (e.g. late token usage). */
  backfilled?: number;
  /** Count of files/entries that failed to parse or import. */
  errors: number;
  /** Distinct session ids encountered during the scan. */
  sessions_seen?: number;
  /** Project directories/JSONL files scanned (default/path import). */
  files_scanned?: number;
  /** Files actually received in the multipart request (upload import). */
  files_received?: number;
  /** Total transcript entries successfully parsed. */
  entries_extracted?: number;
  /** Entries skipped during parsing (e.g. malformed lines). */
  entries_skipped?: number;
}
