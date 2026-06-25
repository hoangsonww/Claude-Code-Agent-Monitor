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
  Budget,
  BudgetListResponse,
  BudgetPeriod,
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  updates: {
    status: () => request<UpdateStatusPayload>("/updates/status"),
    check: () =>
      request<UpdateStatusPayload>("/updates/check", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },

  stats: {
    get: () => request<Stats>(`/stats?tz_offset=${new Date().getTimezoneOffset()}`),
  },

  sessions: {
    facets: () => request<{ cwds: string[] }>("/sessions/facets"),
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
    get: (id: string) =>
      request<{
        session: Session;
        agents: Agent[];
        events: DashboardEvent[];
        workflows: WorkflowRun[];
      }>(`/sessions/${encodeURIComponent(id)}`),
    stats: (id: string) => request<SessionStats>(`/sessions/${encodeURIComponent(id)}/stats`),
    transcripts: (id: string) =>
      request<TranscriptListResult>(`/sessions/${encodeURIComponent(id)}/transcripts`),
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
    facets: () => request<{ event_types: string[]; tool_names: string[] }>("/events/facets"),
  },

  analytics: {
    get: () => request<Analytics>(`/analytics?tz_offset=${new Date().getTimezoneOffset()}`),
  },

  settings: {
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
    claudeHome: {
      get: () => request<{ claude_home: string }>("/settings/claude-home"),
      set: (path: string) =>
        request<{ ok: boolean; claude_home: string }>("/settings/claude-home", {
          method: "PUT",
          body: JSON.stringify({ path }),
        }),
    },
    clearData: () =>
      request<{ ok: boolean; cleared: Record<string, number> }>("/settings/clear-data", {
        method: "POST",
      }),
    reimport: () =>
      request<{ ok: boolean; imported: number; skipped: number; errors: number }>(
        "/settings/reimport",
        { method: "POST" }
      ),
    reinstallHooks: () =>
      request<{ ok: boolean; hooks: { installed: boolean; hooks: Record<string, boolean> } }>(
        "/settings/reinstall-hooks",
        { method: "POST" }
      ),
    resetPricing: () =>
      request<{ ok: boolean; pricing: ModelPricing[] }>("/settings/reset-pricing", {
        method: "POST",
      }),
    exportData: () => `${BASE}/settings/export`,
    cleanup: (params: { abandon_hours?: number; purge_days?: number }) =>
      request<{
        ok: boolean;
        abandoned: number;
        purged_sessions: number;
        purged_events: number;
        purged_agents: number;
      }>("/settings/cleanup", { method: "POST", body: JSON.stringify(params) }),
  },

  workflows: {
    get: (status?: string) =>
      request<WorkflowData>(`/workflows${status && status !== "all" ? `?status=${status}` : ""}`),
    session: (id: string) =>
      request<SessionDrillIn>(`/workflows/session/${encodeURIComponent(id)}`),
    // Workflow-tool runs (issue #167) - fleets ingested from on-disk journals.
    runs: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status && params.status !== "all") qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<WorkflowRunsResponse>(`/workflows/runs${q ? `?${q}` : ""}`);
    },
    run: (runId: string) =>
      request<WorkflowRunDetail>(`/workflows/runs/${encodeURIComponent(runId)}`),
  },

  pricing: {
    list: () => request<{ pricing: ModelPricing[] }>("/pricing"),
    upsert: (data: Omit<ModelPricing, "updated_at">) =>
      request<{ pricing: ModelPricing }>("/pricing", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (pattern: string) =>
      request<{ ok: boolean }>(`/pricing/${encodeURIComponent(pattern)}`, {
        method: "DELETE",
      }),
    totalCost: () =>
      request<CostResult>(`/pricing/cost?tz_offset=${new Date().getTimezoneOffset()}`),
    sessionCost: (sessionId: string) =>
      request<CostResult>(
        `/pricing/cost/${encodeURIComponent(sessionId)}?tz_offset=${new Date().getTimezoneOffset()}`
      ),
  },

  import: {
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
    rescan: () => request<ImportResult>("/import/rescan", { method: "POST" }),
    scanPath: (path: string) =>
      request<ImportResult>("/import/scan-path", {
        method: "POST",
        body: JSON.stringify({ path }),
      }),
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

  ccConfig: {
    overview: () => request<CcOverview>("/cc-config/overview"),
    skills: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/skills${scope ? `?scope=${scope}` : ""}`),
    agents: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/agents${scope ? `?scope=${scope}` : ""}`),
    commands: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/commands${scope ? `?scope=${scope}` : ""}`),
    outputStyles: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/output-styles${scope ? `?scope=${scope}` : ""}`),
    plugins: () => request<CcPluginsResponse>("/cc-config/plugins"),
    mcp: () => request<CcMcpResponse>("/cc-config/mcp"),
    hooks: () => request<{ items: CcHookSource[] }>("/cc-config/hooks"),
    settings: () => request<{ items: CcSettingsSource[] }>("/cc-config/settings"),
    memory: () => request<{ items: CcMemoryItem[] }>("/cc-config/memory"),
    file: (absPath: string) =>
      request<CcFileResponse>(`/cc-config/file?path=${encodeURIComponent(absPath)}`),
    write: (args: CcWriteArgs) =>
      request<CcMutationResult>("/cc-config/file", {
        method: "PUT",
        body: JSON.stringify(args),
      }),
    delete: (args: CcDeleteArgs) =>
      request<CcMutationResult>("/cc-config/file", {
        method: "DELETE",
        body: JSON.stringify(args),
      }),
    marketplaces: () => request<CcMarketplacesResponse>("/cc-config/marketplaces"),
    keybindings: () => request<CcKeybindings>("/cc-config/keybindings"),
    statusline: () => request<CcStatusline>("/cc-config/statusline"),
    hookScripts: () => request<CcHookScripts>("/cc-config/hook-scripts"),
    backups: (params?: { scope?: "user" | "project"; type?: CcArtifactType }) =>
      requestBackupsHelper(params),
  },

  run: {
    list: () => request<RunListResponse>("/run"),
    history: (limit = 50) =>
      request<{ items: DashboardRunHistoryItem[] }>(`/run/history?limit=${limit}`),
    binary: () => request<{ found: boolean; path: string | null }>("/run/binary"),
    cwds: () => request<{ items: CwdSuggestion[] }>("/run/cwds"),
    files: (cwd: string, q?: string) => {
      const qs = new URLSearchParams({ cwd });
      if (q) qs.set("q", q);
      return request<{ items: string[] }>(`/run/files?${qs.toString()}`);
    },
    start: (args: RunStartArgs) =>
      request<RunHandle>("/run", { method: "POST", body: JSON.stringify(args) }),
    get: (id: string, opts?: { envelopes?: boolean }) =>
      request<RunHandle>(`/run/${encodeURIComponent(id)}${opts?.envelopes ? "?envelopes=1" : ""}`),
    send: (id: string, text: string) =>
      request<{ messageId: string }>(`/run/${encodeURIComponent(id)}/message`, {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    kill: (id: string) =>
      request<{ ok: true }>(`/run/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  budgets: {
    list: () => request<BudgetListResponse>("/budgets"),
    create: (data: BudgetCreateArgs) =>
      request<{ budget: Budget }>("/budgets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: BudgetUpdateArgs) =>
      request<{ budget: Budget }>(`/budgets/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    remove: (id: number) => request<{ ok: boolean }>(`/budgets/${id}`, { method: "DELETE" }),
  },

  alerts: {
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
    ack: (id: number) => request<{ alert: AlertEvent }>(`/alerts/${id}/ack`, { method: "POST" }),
    ackAll: () =>
      request<{ ok: true; acknowledged: number }>("/alerts/ack-all", { method: "POST" }),
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

  webhooks: {
    list: () => request<{ targets: WebhookTarget[] }>("/webhooks"),
    providers: () => request<{ providers: WebhookProvider[] }>("/webhooks/providers"),
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
    remove: (id: string) =>
      request<{ ok: true }>(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    test: (id: string) =>
      request<WebhookTestResult>(`/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" }),
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

export interface BudgetCreateArgs {
  period: BudgetPeriod;
  limit_usd: number;
  label?: string | null;
  enabled?: boolean;
  alert_thresholds?: number[];
}

export type BudgetUpdateArgs = Partial<BudgetCreateArgs>;

function requestBackupsHelper(params?: { scope?: "user" | "project"; type?: CcArtifactType }) {
  const qs = new URLSearchParams();
  if (params?.scope) qs.set("scope", params.scope);
  if (params?.type) qs.set("type", params.type);
  const q = qs.toString();
  return request<{ items: CcBackup[] }>(`/cc-config/backups${q ? `?${q}` : ""}`);
}

export type CcArtifactType = "skills" | "agents" | "commands" | "output-styles" | "memory";

export interface CcWriteArgs {
  scope: "user" | "project";
  type: CcArtifactType;
  name?: string;
  content: string;
}

export interface CcDeleteArgs {
  scope: "user" | "project";
  type: CcArtifactType;
  name?: string;
}

export interface CcMutationResult {
  ok: true;
  file: string;
  target: string;
  backupPath: string | null;
  created?: boolean;
}

export interface CcBackup {
  scope: "user" | "project";
  type: CcArtifactType;
  name: string;
  backupPath: string;
  isDir: boolean;
  mtime: number;
  size: number | null;
}

export type CcScope = "user" | "project" | "all";

export interface CcMdItem {
  scope: "user" | "project";
  name: string;
  file?: string;
  path?: string;
  size: number;
  mtime: number;
  truncated: boolean;
  frontmatter: Record<string, string>;
  preview: string;
}

export interface CcPluginContributions {
  skills: number;
  agents: number;
  commands: number;
  outputStyles: number;
  hooks: number;
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

export interface CcPlugin {
  key: string;
  name: string;
  marketplace: string | null;
  scope: string;
  version: string | null;
  installPath: string | null;
  installedAt: string | null;
  lastUpdated: string | null;
  gitCommitSha: string | null;
  installPathExists: boolean;
  enabled: boolean | null;
  contributes: CcPluginContributions | null;
}

export interface CcPluginsResponse {
  manifestPath: string;
  manifestExists: boolean;
  plugins: CcPlugin[];
}

export interface CcMcpServer {
  name: string;
  source: string;
  kind: "stdio" | "http" | "unknown";
  command?: string;
  args?: string[];
  envNames?: string[];
  url?: string;
  headers?: string[];
}

export interface CcMcpResponse {
  user: CcMcpServer[];
  projectScoped: CcMcpServer[];
}

export interface CcHookEntry {
  matcher: string;
  type: string;
  command: string | null;
  timeout: number | null;
}

export interface CcHookSource {
  scope: "user" | "project" | "project-local";
  file: string;
  exists: boolean;
  hooks: Record<string, CcHookEntry[]>;
}

export interface CcSettingsSource {
  scope: "user" | "project" | "project-local";
  file: string;
  exists: boolean;
  data?: unknown;
  raw_size?: number;
}

export interface CcMemoryItem {
  scope: "user" | "project";
  file: string;
  size: number;
  mtime: number;
  truncated: boolean;
  preview: string;
}

export interface CcFileResponse {
  ok: true;
  file: string;
  text: string;
  size: number;
  mtime: number;
  truncated: boolean;
}

export interface CcOverview {
  roots: {
    claudeHome: string;
    projectClaudeDir: string;
    projectRoot: string;
    claudeJson: string;
  };
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
    hooks: Record<string, number>;
    memory: number;
    settingsFiles: number;
  };
}

export interface CcMarketplace {
  name: string;
  source: { source?: string; repo?: string; url?: string } | null;
  installLocation: string | null;
  lastUpdated: string | null;
  pluginCount: number | null;
  marketplaceName: string | null;
  marketplaceDescription: string | null;
  marketplaceOwner: { name?: string; url?: string } | null;
}

export interface CcMarketplacesResponse {
  knownPath: string;
  knownExists: boolean;
  items: CcMarketplace[];
}

export interface CcKeybindingGroup {
  context: string;
  bindings: { key: string; action: string }[];
}

export interface CcKeybindings {
  file: string;
  exists: boolean;
  schema?: string | null;
  docs?: string | null;
  groups: CcKeybindingGroup[];
}

export interface CcStatuslineScript {
  file: string;
  size: number;
  mtime: number;
  truncated: boolean;
  preview: string;
}

export interface CcStatusline {
  config: { type?: string; command?: string } | null;
  scripts: CcStatuslineScript[];
}

export interface CcHookScripts {
  dir: string;
  items: { name: string; file: string; size: number; mtime: number }[];
}

export type RunMode = "headless" | "conversation";
export type RunStatus = "spawning" | "running" | "completed" | "error" | "killed" | "abandoned";
export type PermissionMode = "acceptEdits" | "default" | "plan" | "bypassPermissions";
export type EffortLevel = "" | "low" | "medium" | "high" | "xhigh" | "max";

export interface RunStartArgs {
  prompt: string;
  mode: RunMode;
  cwd?: string;
  model?: string;
  permissionMode?: PermissionMode;
  resumeSessionId?: string;
  effort?: EffortLevel;
}

export interface RunHandle {
  id: string;
  pid: number | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  permissionMode: PermissionMode;
  effort: EffortLevel | null;
  prompt: string;
  argv: string[];
  resumeSessionId: string | null;
  status: RunStatus;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  signal: string | null;
  error: string | null;
  sessionId: string | null;
  envelopeCount: number;
  stdoutTail: string;
  stderrTail: string;
  envelopes?: unknown[]; // present when fetched with ?envelopes=1
}

export interface RunListResponse {
  items: RunHandle[];
  maxConcurrent: number;
  activeCount: number;
}

/**
 * A row from the persistent `dashboard_runs` sqlite table - every run ever
 * spawned via /api/run, including completed / errored / killed ones long
 * after the in-memory handle has been reaped.
 */
export interface DashboardRunHistoryItem {
  id: string;
  session_id: string | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  permission_mode: PermissionMode | null;
  effort: EffortLevel | null;
  resume_session_id: string | null;
  prompt_preview: string | null;
  status: RunStatus;
  exit_code: number | null;
  started_at: string;
  ended_at: string | null;
  isLive: boolean;
}

export interface CwdSuggestion {
  kind: "dashboard" | "home" | "recent";
  path: string;
  label: string;
}

export interface ModelChoice {
  id: string; // value sent to claude --model
  label: string; // user-facing
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

export interface ImportResult {
  ok: boolean;
  source: "default" | "path" | "upload";
  path?: string;
  imported: number;
  skipped: number;
  backfilled?: number;
  errors: number;
  sessions_seen?: number;
  files_scanned?: number;
  files_received?: number;
  entries_extracted?: number;
  entries_skipped?: number;
}
