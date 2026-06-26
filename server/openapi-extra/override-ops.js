/**
 * @file ENRICHED OVERRIDE OpenAPI fragments for endpoints that are ALREADY
 * documented in the base spec (server/openapi.js). This fragment does not add
 * any new paths — instead, each entry here re-declares an already-existing path
 * with the *identical* contract (same operationId, tags, parameters,
 * requestBody schemas, and response `$ref`/media-type schemas) but layers on
 * richer `description` text and realistic `example` values for parameters,
 * request bodies, and responses. Because `server/openapi-extra.js` merges
 * fragment `paths` with `Object.assign` (last-writer-wins) and the merge in
 * `createOpenApiSpec()` spreads extras over the base, these override entries
 * supersede the terser base definitions for the same path key.
 *
 * Covered paths (Webhooks / Settings / Import / Updates / Workflows):
 *   POST/GET   /api/webhooks
 *   GET        /api/webhooks/providers
 *   PATCH/DEL  /api/webhooks/{id}
 *   POST       /api/webhooks/{id}/test
 *   GET        /api/webhooks/{id}/deliveries
 *   GET        /api/settings/info
 *   POST       /api/settings/clear-data          ⚠ DESTRUCTIVE
 *   POST       /api/settings/reimport
 *   POST       /api/settings/reinstall-hooks
 *   POST       /api/settings/reset-pricing       ⚠ DESTRUCTIVE
 *   GET        /api/settings/export
 *   POST       /api/settings/cleanup             ⚠ DESTRUCTIVE (with purge_days)
 *   GET        /api/import/guide
 *   POST       /api/import/rescan
 *   POST       /api/import/scan-path
 *   POST       /api/import/upload                (multipart/form-data)
 *   GET        /api/updates/status
 *   POST       /api/updates/check
 *   GET        /api/workflows
 *   GET        /api/workflows/session/{id}
 *
 * STRICTLY ADDITIVE: `tags` and `schemas` are intentionally empty — this module
 * introduces no new tags and no new component schemas. Every schema reference
 * reuses a base `$ref` (e.g. ErrorResponse, MessageErrorResponse, WorkflowAggregateResponse,
 * SettingsInfoResponse, CleanupRequest/CleanupResponse, ImportGuideResponse,
 * ImportResultResponse, ExportResponse, …) or an inline schema that matches the
 * base byte-for-byte. The Webhooks/Settings/Import/Updates/Workflows tags are
 * already declared in the base literal. Error bodies preserve the base's split:
 * Webhooks / Settings / Import / Updates use `ErrorResponse` ({ error: { code,
 * message } }) where the base had it (and keep the base's content-less 4xx
 * descriptions where it had none); Workflows use the SHORT `MessageErrorResponse`
 * ({ error: { message } }).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [];

const schemas = {};

// ── Reusable realistic examples ──────────────────────────────────────────────

const WEBHOOK_TARGET_EXAMPLE = {
  id: "9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
  name: "Eng on-call (Slack)",
  type: "slack",
  enabled: true,
  url_preview: "https://hooks.slack.com/…BXqZ",
  has_secret: false,
  headers: null,
  config: null,
  rule_ids: ["rule_inactivity_30m"],
  created_at: "2026-06-25T14:03:11.482Z",
  updated_at: "2026-06-25T14:03:11.482Z",
  last_delivery: {
    status: "success",
    status_code: 200,
    attempts: 1,
    error: null,
    created_at: "2026-06-25T18:41:55.117Z",
  },
};

const GENERIC_WEBHOOK_TARGET_EXAMPLE = {
  id: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  name: "Internal alert sink",
  type: "generic",
  enabled: true,
  url_preview: "https://alerts.internal.example.com/…hook",
  has_secret: true,
  headers: { "X-Api-Key": "••••", Authorization: "••••" },
  config: null,
  rule_ids: null,
  created_at: "2026-06-20T09:15:00.000Z",
  updated_at: "2026-06-24T22:48:30.901Z",
  last_delivery: {
    status: "failed",
    status_code: 503,
    attempts: 3,
    error: "Service Unavailable",
    created_at: "2026-06-24T22:48:30.901Z",
  },
};

const SETTINGS_INFO_EXAMPLE = {
  db: {
    path: "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor/server/data/agent-monitor.db",
    size: 48922624,
    counts: {
      sessions: 412,
      agents: 1893,
      events: 58117,
      model_pricing: 11,
      token_usage: 401,
    },
    pragmas: {
      journal_mode: "wal",
      synchronous: 1,
      auto_vacuum: 0,
      encoding: "UTF-8",
      foreign_keys: 1,
      busy_timeout: 5000,
    },
    load_stats: { m5: 23, m15: 88, h1: 511 },
  },
  hooks: {
    installed: true,
    path: "/Users/son/.claude/settings.json",
    hooks: {
      PreToolUse: true,
      PostToolUse: true,
      Stop: true,
      SubagentStop: true,
      Notification: true,
      SessionStart: true,
      SessionEnd: true,
    },
  },
  server: {
    uptime: 14523.91,
    node_version: "v22.14.0",
    platform: "darwin",
    ws_connections: 2,
    memory: {
      rss: 142802944,
      heapTotal: 71303168,
      heapUsed: 58392104,
      external: 3211884,
      arrayBuffers: 1048576,
    },
    cpu_load: [2.13, 2.45, 2.31],
    arch: "arm64",
    total_mem: 17179869184,
    free_mem: 2147483648,
    cpus: 10,
  },
  transcript_cache: {
    entries: 37,
    paths: [
      "/Users/son/.claude/projects/-Users-son-code-foo/abc123.jsonl",
      "/Users/son/.claude/projects/-Users-son-code-bar/def456.jsonl",
    ],
  },
};

const CLEAR_DATA_EXAMPLE = {
  ok: true,
  cleared: { sessions: 412, agents: 1893, events: 58117, model_pricing: 11, token_usage: 401 },
};

const REIMPORT_EXAMPLE = { ok: true, imported: 38, skipped: 374, errors: 0 };

const REINSTALL_HOOKS_EXAMPLE = {
  ok: true,
  hooks: {
    installed: true,
    path: "/Users/son/.claude/settings.json",
    hooks: {
      PreToolUse: true,
      PostToolUse: true,
      Stop: true,
      SubagentStop: true,
      Notification: true,
      SessionStart: true,
      SessionEnd: true,
    },
  },
};

const RESET_PRICING_EXAMPLE = {
  ok: true,
  pricing: [
    {
      model_pattern: "claude-opus-4*",
      display_name: "Claude Opus 4",
      input_per_mtok: 15,
      output_per_mtok: 75,
      cache_read_per_mtok: 1.5,
      cache_write_per_mtok: 18.75,
      cache_write_1h_per_mtok: 30,
      fast_input_per_mtok: 0,
      fast_output_per_mtok: 0,
      updated_at: "2026-06-26T00:00:00.000Z",
    },
    {
      model_pattern: "claude-sonnet-4*",
      display_name: "Claude Sonnet 4",
      input_per_mtok: 3,
      output_per_mtok: 15,
      cache_read_per_mtok: 0.3,
      cache_write_per_mtok: 3.75,
      cache_write_1h_per_mtok: 6,
      fast_input_per_mtok: 0,
      fast_output_per_mtok: 0,
      updated_at: "2026-06-26T00:00:00.000Z",
    },
  ],
};

const EXPORT_EXAMPLE = {
  exported_at: "2026-06-26T01:12:44.913Z",
  sessions: [
    {
      id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      name: "Refactor auth flow",
      status: "completed",
      cwd: "/Users/son/code/foo",
      model: "claude-opus-4-8",
      started_at: "2026-06-25T13:00:00.000Z",
      ended_at: "2026-06-25T13:42:18.220Z",
      metadata: null,
      updated_at: "2026-06-25T13:42:18.220Z",
    },
  ],
  agents: [
    {
      id: "agent_main_5f3c0e2a",
      session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      name: "Main agent",
      type: "main",
      subagent_type: null,
      status: "completed",
      task: null,
      current_tool: null,
      started_at: "2026-06-25T13:00:00.000Z",
      ended_at: "2026-06-25T13:42:18.220Z",
      parent_agent_id: null,
      metadata: null,
      updated_at: "2026-06-25T13:42:18.220Z",
    },
  ],
  events: [
    {
      id: 91021,
      session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      agent_id: "agent_main_5f3c0e2a",
      event_type: "PreToolUse",
      tool_name: "Edit",
      summary: "Edit server/auth.js",
      data: null,
      created_at: "2026-06-25T13:05:42.001Z",
    },
  ],
  token_usage: [
    {
      session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      model: "claude-opus-4-8",
      input_tokens: 18422,
      output_tokens: 9120,
      cache_read_tokens: 220184,
      cache_write_tokens: 41002,
    },
  ],
  model_pricing: RESET_PRICING_EXAMPLE.pricing,
};

const CLEANUP_EXAMPLE = {
  ok: true,
  abandoned: 3,
  purged_sessions: 57,
  purged_events: 14820,
  purged_agents: 241,
};

const IMPORT_GUIDE_EXAMPLE = {
  platform: "darwin",
  default_projects_dir: "/Users/son/.claude/projects",
  default_projects_dir_display: "~/.claude/projects",
  default_projects_dir_exists: true,
  default_projects_dir_stats: { projects: 24, jsonl_files: 312 },
  archive_command: "tar -czf claude-history.tar.gz -C ~/.claude projects",
  supported_extensions: [".jsonl", ".meta.json", ".zip", ".tar", ".tar.gz", ".tgz", ".gz"],
  max_upload_bytes: 1073741824,
  max_upload_files: 2000,
  steps: [
    {
      id: "locate",
      title: "Locate your Claude Code history",
      body: "Claude Code stores every session as a JSONL transcript under ~/.claude/projects. Each subdirectory is named after the working directory where the session started (with slashes replaced by dashes).",
    },
    {
      id: "archive",
      title: "Bundle it for transfer (optional)",
      body: "If you're importing from another machine, archive the whole projects folder first:\n\n    tar -czf claude-history.tar.gz -C ~/.claude projects\n\nMove claude-history.tar.gz to this machine however you like (AirDrop, scp, USB, cloud storage).",
    },
    {
      id: "choose",
      title: "Pick an import mode",
      body: "Rescan default: re-read ~/.claude/projects on this machine and import anything new. From folder: point the dashboard at any directory you've extracted history into. Upload: drag-drop JSONL files or an archive directly into the browser.",
    },
    {
      id: "verify",
      title: "Verify tokens and cost",
      body: "Imports are idempotent: re-running is always safe. Token counts are deduplicated per session ID, with compaction baselines preserved so cost never double-counts. After import, open Analytics → Cost to confirm the breakdown.",
    },
  ],
};

const IMPORT_RESCAN_EXAMPLE = {
  ok: true,
  source: "default",
  imported: 14,
  skipped: 298,
  backfilled: 2,
  errors: 0,
  sessions_seen: 312,
  files_scanned: 312,
};

const IMPORT_SCAN_PATH_EXAMPLE = {
  ok: true,
  source: "path",
  path: "/Users/son/Downloads/claude-history/projects",
  imported: 9,
  skipped: 41,
  backfilled: 0,
  errors: 0,
  sessions_seen: 50,
  files_scanned: 50,
};

const IMPORT_UPLOAD_EXAMPLE = {
  ok: true,
  source: "upload",
  files_received: 3,
  rejected_files: ["notes.txt"],
  entries_extracted: 128,
  entries_skipped: 2,
  imported: 12,
  skipped: 116,
  backfilled: 0,
  errors: 0,
  sessions_seen: 128,
  files_scanned: 128,
};

const UPDATE_STATUS_AVAILABLE_EXAMPLE = {
  git_repo: true,
  repo_root: "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
  update_available: true,
  commits_behind: 4,
  remote_ref: "origin/master",
  local_sha: "de5d0891a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7",
  remote_sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  manual_command: "npm run self-update",
  checked_at: "2026-06-26T01:20:09.553Z",
};

const UPDATE_STATUS_UP_TO_DATE_EXAMPLE = {
  git_repo: true,
  repo_root: "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
  update_available: false,
  commits_behind: 0,
  remote_ref: "origin/master",
  local_sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  remote_sha: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
  manual_command: "npm run self-update",
  checked_at: "2026-06-26T01:25:41.002Z",
};

const UPDATE_STATUS_NON_REPO_EXAMPLE = {
  git_repo: false,
  update_available: false,
  message: "Not a git checkout — update detection is unavailable for this install.",
};

const WORKFLOW_AGGREGATE_EXAMPLE = {
  stats: {
    totalSessions: 412,
    totalAgents: 1893,
    totalSubagents: 1481,
    avgSubagents: 3.6,
    successRate: 94.2,
    avgDepth: 1.4,
    avgDurationSec: 1187,
    totalCompactions: 96,
    avgCompactions: 0.2,
    topFlow: { source: "Read", target: "Edit", count: 3120 },
  },
  orchestration: {
    sessionCount: 412,
    mainCount: 412,
    subagentTypes: [
      { subagent_type: "general-purpose", count: 612, completed: 590, errors: 8 },
      { subagent_type: "Explore", count: 388, completed: 380, errors: 2 },
    ],
    edges: [{ source: "main", target: "general-purpose", weight: 612 }],
    outcomes: [
      { status: "completed", count: 1402 },
      { status: "error", count: 79 },
    ],
    compactions: { total: 96, sessions: 71 },
  },
  toolFlow: {
    transitions: [{ source: "Read", target: "Edit", value: 3120 }],
    toolCounts: [
      { tool_name: "Read", count: 9821 },
      { tool_name: "Edit", count: 5402 },
      { tool_name: "Bash", count: 4810 },
    ],
  },
  effectiveness: [
    {
      subagent_type: "general-purpose",
      total: 612,
      completed: 590,
      errors: 8,
      sessions: 281,
      successRate: 98.7,
      avgDuration: 142,
      trend: [88, 91, 102, 97, 110, 24, 12],
    },
  ],
  patterns: {
    patterns: [{ steps: ["Explore", "general-purpose"], count: 142, percentage: 34.5 }],
    soloSessionCount: 120,
    soloPercentage: 29.1,
  },
  modelDelegation: {
    mainModels: [{ model: "claude-opus-4-8", agent_count: 290, session_count: 290 }],
    subagentModels: [{ model: "claude-opus-4-8", agent_count: 980 }],
    tokensByModel: [
      {
        model: "claude-opus-4-8",
        input_tokens: 4820112,
        output_tokens: 1920334,
        cache_read_tokens: 88201442,
        cache_write_tokens: 12044210,
      },
    ],
  },
  errorPropagation: {
    byDepth: [
      { depth: 0, count: 41 },
      { depth: 1, count: 38 },
    ],
    byType: [{ subagent_type: "general-purpose", count: 8 }],
    eventErrors: [{ summary: "Error in Bash: command not found", count: 5 }],
    sessionsWithErrors: 33,
    totalSessions: 412,
    errorRate: 8,
  },
  concurrency: {
    aggregateLanes: [
      { name: "Main Agent", avgStart: 0, avgEnd: 1, count: 412 },
      { name: "Explore", avgStart: 0.12, avgEnd: 0.31, count: 388 },
    ],
  },
  complexity: [
    {
      id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      name: "Refactor auth flow",
      status: "completed",
      duration: 2538,
      agentCount: 6,
      subagentCount: 5,
      totalTokens: 940212,
      model: "claude-opus-4-8",
    },
  ],
  compaction: {
    totalCompactions: 96,
    tokensRecovered: 18402991,
    perSession: [{ session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11", compactions: 3 }],
    sessionsWithCompactions: 71,
    totalSessions: 412,
  },
  cooccurrence: [{ source: "Explore", target: "general-purpose", weight: 142 }],
};

const WORKFLOW_SESSION_EXAMPLE = {
  session: {
    id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
    name: "Refactor auth flow",
    status: "completed",
    cwd: "/Users/son/code/foo",
    model: "claude-opus-4-8",
    started_at: "2026-06-25T13:00:00.000Z",
    ended_at: "2026-06-25T13:42:18.220Z",
    metadata: null,
    updated_at: "2026-06-25T13:42:18.220Z",
  },
  tree: [
    {
      id: "agent_main_5f3c0e2a",
      name: "Main agent",
      type: "main",
      subagent_type: null,
      status: "completed",
      task: null,
      started_at: "2026-06-25T13:00:00.000Z",
      ended_at: "2026-06-25T13:42:18.220Z",
      children: [
        {
          id: "agent_sub_a1",
          name: "Explore the auth module",
          type: "subagent",
          subagent_type: "Explore",
          status: "completed",
          task: "Map auth call sites",
          started_at: "2026-06-25T13:02:10.000Z",
          ended_at: "2026-06-25T13:06:55.000Z",
          children: [],
        },
      ],
    },
  ],
  toolTimeline: [
    {
      id: 91021,
      tool_name: "Read",
      event_type: "PreToolUse",
      agent_id: "agent_main_5f3c0e2a",
      created_at: "2026-06-25T13:01:02.500Z",
      summary: "Read server/auth.js",
    },
  ],
  swimLanes: [
    {
      id: "agent_main_5f3c0e2a",
      name: "Main agent",
      type: "main",
      subagent_type: null,
      status: "completed",
      started_at: "2026-06-25T13:00:00.000Z",
      ended_at: "2026-06-25T13:42:18.220Z",
      parent_agent_id: null,
    },
  ],
  events: [
    {
      id: 91021,
      session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      agent_id: "agent_main_5f3c0e2a",
      event_type: "PreToolUse",
      tool_name: "Read",
      summary: "Read server/auth.js",
      data: null,
      created_at: "2026-06-25T13:01:02.500Z",
    },
  ],
};

const WEBHOOK_ID_PARAM = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  example: "9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
};

// ── Paths (enriched overrides — contract preserved) ──────────────────────────

const paths = {
  "/api/webhooks/providers": {
    get: {
      tags: ["Webhooks"],
      summary: "List supported providers + their config fields (for the UI)",
      description:
        "Returns the redacted provider catalog the webhook-target editor renders. For each of the 14 supported providers (Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream) plus the `generic` family, it lists: a human label, the provider family, whether the URL must be https / is user-supplied, and the per-provider config field definitions (key, label, type, required, options, and whether the field is secret). No secret values are ever included — this is purely the *shape* of the form, not stored credentials.",
      operationId: "listWebhookProviders",
      responses: {
        200: {
          description: "Provider catalog: label, family, url requirements, fields",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              example: {
                providers: {
                  slack: {
                    label: "Slack",
                    family: "chat",
                    https: true,
                    urlRequired: true,
                    fields: [],
                  },
                  telegram: {
                    label: "Telegram",
                    family: "chat",
                    https: true,
                    urlRequired: false,
                    fields: [
                      {
                        key: "bot_token",
                        label: "Bot token",
                        type: "string",
                        required: true,
                        secret: true,
                      },
                      {
                        key: "chat_id",
                        label: "Chat ID",
                        type: "string",
                        required: true,
                        secret: false,
                      },
                    ],
                  },
                  pagerduty: {
                    label: "PagerDuty",
                    family: "incident",
                    https: true,
                    urlRequired: false,
                    fields: [
                      {
                        key: "routing_key",
                        label: "Routing key",
                        type: "string",
                        required: true,
                        secret: true,
                      },
                      {
                        key: "severity",
                        label: "Severity",
                        type: "enum",
                        required: false,
                        options: ["critical", "error", "warning", "info"],
                        secret: false,
                      },
                    ],
                  },
                  generic: {
                    label: "Generic webhook",
                    family: "generic",
                    https: false,
                    urlRequired: true,
                    fields: [],
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/webhooks": {
    get: {
      tags: ["Webhooks"],
      summary: "List webhook targets (URLs masked, secrets redacted)",
      description:
        "Lists every configured webhook target. Responses are always redacted: the full URL is never returned — only `url_preview` (protocol + host + a `…` + the last 4 chars), `has_secret` is a boolean (never the secret itself), and any secret-flagged provider config fields (routing keys, API keys, bot tokens) and custom header values are masked to `••••`. Each target also carries its most recent delivery outcome in `last_delivery` (or null if it has never fired).",
      operationId: "listWebhooks",
      responses: {
        200: {
          description: "All configured webhook targets",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              example: { targets: [WEBHOOK_TARGET_EXAMPLE, GENERIC_WEBHOOK_TARGET_EXAMPLE] },
            },
          },
        },
      },
    },
    post: {
      tags: ["Webhooks"],
      summary: "Create a webhook target",
      description:
        "Creates a webhook target that fires when alerts match. `name` and `type` are required. `url` is required for most providers but is derived or defaulted for a few (Telegram and Opsgenie derive it from config; PagerDuty defaults it) — consult GET /api/webhooks/providers for which fields each provider needs. `config` carries provider-specific params (e.g. `{ chat_id }` for Telegram, `{ routing_key, severity }` for PagerDuty, `{ api_key, region }` for Opsgenie). `secret` (HMAC-SHA256 signing) and custom `headers` apply only to the generic family and are silently ignored for other providers. `rule_ids` optionally scopes the target to specific alert rules; omit it to fire for all rules. The response is the created target, REDACTED the same way as the list endpoint (URL masked, secrets shown only as `has_secret`/`••••`).",
      operationId: "createWebhook",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "type"],
              properties: {
                name: { type: "string" },
                type: {
                  type: "string",
                  enum: [
                    "slack",
                    "discord",
                    "teams",
                    "google_chat",
                    "mattermost",
                    "rocketchat",
                    "telegram",
                    "pagerduty",
                    "opsgenie",
                    "splunk_oncall",
                    "zapier",
                    "make",
                    "n8n",
                    "pipedream",
                    "generic",
                  ],
                },
                url: {
                  type: "string",
                  format: "uri",
                  description:
                    "Required for most providers; omit for those that derive their URL (Telegram, Opsgenie) or default it (PagerDuty). See GET /api/webhooks/providers.",
                },
                enabled: { type: "boolean", default: true },
                config: {
                  type: "object",
                  additionalProperties: true,
                  description:
                    "Provider-specific params, e.g. { chat_id } (Telegram), { routing_key, severity } (PagerDuty), { api_key, region } (Opsgenie).",
                },
                secret: {
                  type: "string",
                  description: "Generic family only: HMAC-SHA256 signing secret",
                },
                headers: {
                  type: "object",
                  additionalProperties: { type: "string" },
                  description: "Generic family only: extra request headers",
                },
                rule_ids: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional: scope to specific alert rules (omit for all)",
                },
              },
            },
            examples: {
              slack: {
                summary: "Slack incoming webhook scoped to one rule",
                value: {
                  name: "Eng on-call (Slack)",
                  type: "slack",
                  url: "https://hooks.slack.com/services/T0000/B0000/XXXXXXXXXXXXXXXXXXXXBXqZ",
                  enabled: true,
                  rule_ids: ["rule_inactivity_30m"],
                },
              },
              pagerduty: {
                summary: "PagerDuty (URL defaulted, routing key in config)",
                value: {
                  name: "Sev1 pager",
                  type: "pagerduty",
                  config: { routing_key: "R0ABCDEF0123456789ABCDEF01", severity: "critical" },
                },
              },
              generic: {
                summary: "Generic webhook with HMAC secret and custom headers",
                value: {
                  name: "Internal alert sink",
                  type: "generic",
                  url: "https://alerts.internal.example.com/cc-monitor/hook",
                  secret: "whsec_4f8c2a9e1b6d7f0a3c5e8b1d2f4a6c8e",
                  headers: { "X-Api-Key": "k_live_abc123", Authorization: "Bearer t0ken" },
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Created target (redacted)",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              example: { target: WEBHOOK_TARGET_EXAMPLE },
            },
          },
        },
        400: { description: "Validation error" },
      },
    },
  },

  "/api/webhooks/{id}": {
    patch: {
      tags: ["Webhooks"],
      summary: "Update a webhook target (partial; type is immutable)",
      description:
        "Partially updates a webhook target. Only the keys present in the body are changed; omitted keys are left as-is. The provider `type` is immutable. `config` is MERGED over the existing config and re-validated, so a single field (e.g. `severity`, `region`) can change without re-sending the secret fields. For the generic family, `secret` may be omitted (keep current) or sent as `null` (clear it); `headers` and `rule_ids` replace their stored value when present. The response is the updated target, REDACTED (URL masked, secrets shown only as `has_secret`/`••••`).",
      operationId: "updateWebhook",
      parameters: [WEBHOOK_ID_PARAM],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                url: { type: "string", format: "uri", description: "Omit to keep current" },
                enabled: { type: "boolean" },
                config: {
                  type: "object",
                  additionalProperties: true,
                  description: "Provider params; merged over existing (secrets kept if omitted)",
                },
                secret: {
                  type: ["string", "null"],
                  description: "Generic family only: omit to keep, null to clear",
                },
                headers: { type: "object", additionalProperties: { type: "string" } },
                rule_ids: { type: "array", items: { type: "string" } },
              },
            },
            examples: {
              disable: {
                summary: "Disable a target without touching anything else",
                value: { enabled: false },
              },
              renameAndRescope: {
                summary: "Rename and re-scope to different rules",
                value: {
                  name: "Eng on-call (Slack) — muted weekends",
                  rule_ids: ["rule_token_threshold_5m"],
                },
              },
              mergeConfig: {
                summary: "Change one PagerDuty config field (routing key kept)",
                value: { config: { severity: "warning" } },
              },
              clearSecret: {
                summary: "Generic family: clear the signing secret",
                value: { secret: null },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Updated target (redacted)",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              example: {
                target: { ...WEBHOOK_TARGET_EXAMPLE, name: "Eng on-call (Slack) — muted weekends" },
              },
            },
          },
        },
        400: { description: "Validation error" },
        404: { description: "Target not found" },
      },
    },
    delete: {
      tags: ["Webhooks"],
      summary: "Delete a webhook target and its delivery log",
      description:
        "Permanently deletes a webhook target. Its delivery-log history cascades away with it. Returns `{ ok: true }` on success. This only removes the delivery channel — alert *rules* and the fired-alert feed are untouched.",
      operationId: "deleteWebhook",
      parameters: [WEBHOOK_ID_PARAM],
      responses: {
        200: { description: "Deleted" },
        404: { description: "Target not found" },
      },
    },
  },

  "/api/webhooks/{id}/test": {
    post: {
      tags: ["Webhooks"],
      summary: "Send a synthetic test alert to a target",
      description:
        "Sends a synthetic test alert to the target and reports the delivery outcome synchronously. The HTTP status is always 200 when the target exists — the *request itself* succeeded — and the `ok` flag carries the downstream delivery result. `status` is the HTTP status code returned by the provider (or null if the request never completed), `attempts` is how many tries were made (the delivery layer retries transient failures), and `error` is a human-readable failure reason or null on success.",
      operationId: "testWebhook",
      parameters: [WEBHOOK_ID_PARAM],
      responses: {
        200: {
          description: "Delivery result (ok flag carries the downstream outcome)",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              examples: {
                success: {
                  summary: "Provider accepted the test payload",
                  value: { ok: true, status: 200, attempts: 1, error: null },
                },
                failure: {
                  summary: "Provider rejected or was unreachable after retries",
                  value: { ok: false, status: 503, attempts: 3, error: "Service Unavailable" },
                },
              },
            },
          },
        },
        404: { description: "Target not found" },
      },
    },
  },

  "/api/webhooks/{id}/deliveries": {
    get: {
      tags: ["Webhooks"],
      summary: "Recent delivery log for a target",
      description:
        "Returns the recent delivery log for a target, newest first. Each row records the alert that fired, the resulting HTTP status, the number of attempts, any error text, and a timestamp. `limit` is clamped to 1–200 (default 20) and `offset` to ≥0 (default 0). This is an audit trail of past sends — it does not trigger a new delivery (use POST /{id}/test for that).",
      operationId: "listWebhookDeliveries",
      parameters: [
        WEBHOOK_ID_PARAM,
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 20 },
          description: "Max rows to return (clamped to 1–200).",
          example: 20,
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", default: 0 },
          description: "Pagination offset (clamped to ≥0).",
          example: 0,
        },
      ],
      responses: {
        200: {
          description: "Delivery rows, newest first",
          content: {
            "application/json": {
              schema: { type: "object", additionalProperties: true },
              example: {
                deliveries: [
                  {
                    id: 5012,
                    target_id: "9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
                    alert_event_id: 8841,
                    status: "success",
                    status_code: 200,
                    attempts: 1,
                    error: null,
                    created_at: "2026-06-25T18:41:55.117Z",
                  },
                  {
                    id: 5008,
                    target_id: "9b1c2d3e-4f5a-6b7c-8d9e-0f1a2b3c4d5e",
                    alert_event_id: 8839,
                    status: "failed",
                    status_code: 429,
                    attempts: 3,
                    error: "Too Many Requests",
                    created_at: "2026-06-25T18:30:02.004Z",
                  },
                ],
                limit: 20,
                offset: 0,
              },
            },
          },
        },
        404: { description: "Target not found" },
      },
    },
  },

  "/api/settings/info": {
    get: {
      tags: ["Settings"],
      summary: "Get system/database/hook diagnostics",
      description:
        "Returns a diagnostics snapshot used by the Settings page: `db` (database file path, on-disk size in bytes, per-table row counts, SQLite pragmas, and recent event load over the last 5/15/60 minutes), `hooks` (whether the Claude Code hook-handler is installed in `settings.json`, the settings path, and a per-hook-type installed map), `server` (process uptime, Node version, platform, live WebSocket connection count, memory/CPU/host stats), and `transcript_cache` (number of cached transcript entries and the cached paths). Read-only and cheap to poll.",
      operationId: "getSettingsInfo",
      responses: {
        200: {
          description: "Settings and diagnostics",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SettingsInfoResponse" },
              example: SETTINGS_INFO_EXAMPLE,
            },
          },
        },
      },
    },
  },

  "/api/settings/clear-data": {
    post: {
      tags: ["Settings"],
      summary: "Delete all dashboard data",
      description:
        "⚠ DESTRUCTIVE — IRREVERSIBLE. Deletes ALL sessions, agents, events, token_usage rows, the fired-alert feed (alert_events), and the webhook delivery log. There is no confirmation step and no undo — export first via GET /api/settings/export if you need a backup. User CONFIGURATION survives: alert *rules*, webhook *targets*, and model_pricing are preserved (they're settings, not captured data). The response echoes the row counts that existed BEFORE the wipe so the UI can report what was removed.",
      operationId: "clearData",
      responses: {
        200: {
          description: "Data cleared",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ClearDataResponse" },
              example: CLEAR_DATA_EXAMPLE,
            },
          },
        },
      },
    },
  },

  "/api/settings/reimport": {
    post: {
      tags: ["Settings"],
      summary: "Re-import legacy sessions from ~/.claude",
      description:
        "Re-runs the legacy history importer against the default `~/.claude` projects directory, funneling every transcript through the same parser + importSession pipeline the live server uses. This is IDEMPOTENT and ADDITIVE — already-imported sessions are deduplicated (counted under `skipped`), token counts and compaction baselines are preserved so cost never double-counts, and nothing existing is deleted. The response reports how many sessions were `imported` vs `skipped`, plus an `errors` count for transcripts that failed to parse.",
      operationId: "reimportLegacySessions",
      responses: {
        200: {
          description: "Import completed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReimportResponse" },
              example: REIMPORT_EXAMPLE,
            },
          },
        },
        500: {
          description: "Import failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "IMPORT_FAILED",
                  message:
                    "ENOENT: no such file or directory, scandir '/Users/son/.claude/projects'",
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/settings/reinstall-hooks": {
    post: {
      tags: ["Settings"],
      summary: "Reinstall Claude Code hooks",
      description:
        "Re-runs the hook installer to (re)wire the dashboard's hook-handler into Claude Code's `settings.json` for all seven hook types (PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionStart, SessionEnd). Safe to re-run — it overwrites/repairs the dashboard's own hook entries without touching unrelated user hooks. The response returns the post-install hook status so the UI can confirm every hook type is now `installed: true`.",
      operationId: "reinstallHooks",
      responses: {
        200: {
          description: "Hooks reinstall result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReinstallHooksResponse" },
              example: REINSTALL_HOOKS_EXAMPLE,
            },
          },
        },
        500: {
          description: "Hook installation failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "HOOK_INSTALL_FAILED",
                  message: "EACCES: permission denied, open '/Users/son/.claude/settings.json'",
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/settings/reset-pricing": {
    post: {
      tags: ["Settings"],
      summary: "Reset pricing table to defaults",
      description:
        "⚠ DESTRUCTIVE to pricing customizations. Deletes EVERY row in the model_pricing table and re-seeds it from the dashboard's built-in DEFAULT_PRICING list. Any custom rates or custom model patterns you added are permanently lost — there is no undo. Captured session/token data is untouched (only the pricing rules used to *compute* cost change). The response returns the full freshly-seeded pricing table.",
      operationId: "resetPricing",
      responses: {
        200: {
          description: "Pricing defaults restored",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPricingResponse" },
              example: RESET_PRICING_EXAMPLE,
            },
          },
        },
      },
    },
  },

  "/api/settings/export": {
    get: {
      tags: ["Settings"],
      summary: "Export all dashboard data as JSON",
      description:
        "Exports the entire dataset as a single JSON document — all sessions, agents, events, token_usage rows, and model_pricing — stamped with `exported_at`. Served with a `Content-Disposition: attachment` header (filename `agent-monitor-export-YYYY-MM-DD.json`) so browsers download it. Use this to back up before a destructive operation (clear-data / cleanup with purge_days) or to migrate data to another machine. Read-only; nothing is modified.",
      operationId: "exportData",
      responses: {
        200: {
          description: "Export payload (served as attachment)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ExportResponse" },
              example: EXPORT_EXAMPLE,
            },
          },
        },
      },
    },
  },

  "/api/settings/cleanup": {
    post: {
      tags: ["Settings"],
      summary: "Abandon stale sessions and optionally purge old history",
      description:
        "Two-phase maintenance. Phase 1 (`abandon_hours`, non-destructive): marks any still-`active` session with no events newer than that many hours as `abandoned`, and completes its lingering agents — a tidy-up of crashed/orphaned sessions. Phase 2 (`purge_days`) is ⚠ DESTRUCTIVE and IRREVERSIBLE: it permanently DELETES completed/error/abandoned sessions (and their events, agents, and token_usage) whose `started_at` is older than that many days. Active sessions are NEVER purged. Both fields are optional and independent — send only `abandon_hours` for a safe tidy-up, or include `purge_days` to also reclaim disk. Export first if the purged history matters. The response reports counts for each phase.",
      operationId: "cleanupData",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CleanupRequest" },
            examples: {
              tidyOnly: {
                summary: "Safe: abandon stale sessions only (no deletion)",
                value: { abandon_hours: 12 },
              },
              abandonAndPurge: {
                summary:
                  "Abandon stale sessions, then purge history older than 90 days (destructive)",
                value: { abandon_hours: 12, purge_days: 90 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Cleanup result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CleanupResponse" },
              example: CLEANUP_EXAMPLE,
            },
          },
        },
      },
    },
  },

  "/api/import/guide": {
    get: {
      tags: ["Import"],
      summary: "Import guide with OS-aware defaults and step-by-step instructions",
      description:
        "Returns the OS-aware import guide the Import page renders verbatim: the detected `platform`, the default `~/.claude/projects` directory (raw + display form), whether it exists and how many projects/JSONL files it holds, an OS-specific `archive_command` for bundling history off another machine, the supported file extensions, the upload size/count limits, and four ordered `steps` (locate → archive → choose mode → verify). Read-only; performs no import.",
      operationId: "importGuide",
      responses: {
        200: {
          description: "Guide payload",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportGuideResponse" },
              example: IMPORT_GUIDE_EXAMPLE,
            },
          },
        },
      },
    },
  },

  "/api/import/rescan": {
    post: {
      tags: ["Import"],
      summary: "Rescan the default ~/.claude/projects directory",
      description:
        'Re-scans the default `~/.claude/projects` directory and imports anything new through the live ingestion pipeline. IDEMPOTENT and ADDITIVE — re-running is always safe, already-imported sessions are deduplicated (`skipped`), and token/compaction baselines are preserved so cost never double-counts. Progress is broadcast over the WebSocket as `import.progress` frames while it runs. The response reports `imported` / `skipped` / `backfilled` / `errors` plus `sessions_seen` and `files_scanned`, with `source: "default"`.',
      operationId: "importRescan",
      responses: {
        200: {
          description: "Import result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportResultResponse" },
              example: IMPORT_RESCAN_EXAMPLE,
            },
          },
        },
        500: {
          description: "Import failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "IMPORT_FAILED", message: "Failed to read projects directory" },
              },
            },
          },
        },
      },
    },
  },

  "/api/import/scan-path": {
    post: {
      tags: ["Import"],
      summary: "Import transcripts from an arbitrary absolute directory",
      description:
        'Imports transcripts from an arbitrary directory you point the dashboard at (e.g. history extracted from another machine). The `path` must resolve to an existing directory: a leading `~` is expanded to the home directory, the result must be absolute, and subdirectories are walked recursively for `.jsonl` files. Same idempotent, baseline-preserving pipeline as the default rescan; progress is broadcast as `import.progress`. The response echoes the resolved `path` and the per-run counters with `source: "path"`.',
      operationId: "importScanPath",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["path"],
              properties: {
                path: {
                  type: "string",
                  description:
                    "Absolute directory path. Tilde (~) is expanded. Walks subdirectories recursively.",
                },
              },
            },
            examples: {
              absolute: {
                summary: "Absolute directory",
                value: { path: "/Users/son/Downloads/claude-history/projects" },
              },
              tilde: {
                summary: "Tilde expanded to home directory",
                value: { path: "~/Downloads/claude-history/projects" },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Import result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportResultResponse" },
              example: IMPORT_SCAN_PATH_EXAMPLE,
            },
          },
        },
        400: {
          description: "Path validation failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                missing: {
                  summary: "path omitted",
                  value: { error: { code: "INVALID_INPUT", message: "`path` is required" } },
                },
                notAbsolute: {
                  summary: "path is not absolute",
                  value: {
                    error: { code: "INVALID_INPUT", message: "`path` must be an absolute path" },
                  },
                },
                notFound: {
                  summary: "path does not exist",
                  value: {
                    error: { code: "PATH_NOT_FOUND", message: "Path does not exist: /tmp/nope" },
                  },
                },
                notDir: {
                  summary: "path is a file, not a directory",
                  value: {
                    error: {
                      code: "NOT_A_DIRECTORY",
                      message: "Path is not a directory: /tmp/foo.jsonl",
                    },
                  },
                },
              },
            },
          },
        },
        500: {
          description: "Import failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "IMPORT_FAILED", message: "Unexpected end of JSON input" },
              },
            },
          },
        },
      },
    },
  },

  "/api/import/upload": {
    post: {
      tags: ["Import"],
      summary: "Upload JSONL files or archives (.zip, .tar, .tar.gz, .tgz, .gz)",
      description:
        'Imports history uploaded directly from the browser as `multipart/form-data` under the `files` field. Accepts raw `.jsonl` / `.meta.json` transcripts and/or archives (`.zip`, `.tar`, `.tar.gz`, `.tgz`, `.gz`), which are extracted into a temp dir and walked for JSONL content. Unsupported extensions are silently rejected and reported in `rejected_files`. Extraction is bounded to defend against zip bombs — exceeding the limit returns 413. Same idempotent import pipeline; progress is broadcast as `import.progress`. On success the response carries `source: "upload"` plus `files_received`, `rejected_files`, `entries_extracted`, `entries_skipped`, and the standard import counters. (Requires the optional `multer` dependency; a missing install yields a 500.)',
      operationId: "importUpload",
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              properties: {
                files: {
                  type: "array",
                  items: { type: "string", format: "binary" },
                  description:
                    "Files to import. Supports .jsonl, .meta.json, .zip, .tar, .tar.gz, .tgz, .gz.",
                },
              },
            },
            example: { files: ["claude-history.tar.gz", "session-extra.jsonl"] },
          },
        },
      },
      responses: {
        200: {
          description: "Import result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ImportResultResponse" },
              example: IMPORT_UPLOAD_EXAMPLE,
            },
          },
        },
        400: {
          description: "No files or no JSONL content",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                noFiles: {
                  summary: "No supported files in the upload",
                  value: {
                    error: {
                      code: "NO_FILES",
                      message:
                        "No supported files in upload. 1 file(s) rejected (unsupported extension).",
                    },
                  },
                },
                noJsonl: {
                  summary: "Archive extracted but contained no .jsonl",
                  value: {
                    error: {
                      code: "NO_JSONL",
                      message:
                        "No .jsonl files were found in the uploaded content. Supported inputs: .jsonl, .meta.json, .zip, .tar, .tar.gz, .tgz, .gz.",
                    },
                  },
                },
              },
            },
          },
        },
        413: {
          description: "Extraction limit exceeded (possible zip bomb)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "EXTRACTION_LIMIT_EXCEEDED",
                  message: "Archive exceeded the extraction size limit (possible zip bomb).",
                },
              },
            },
          },
        },
        500: {
          description: "Upload or import failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                noMulter: {
                  summary: "Optional multer dependency not installed",
                  value: {
                    error: {
                      code: "UPLOADER_UNAVAILABLE",
                      message:
                        "File upload requires `multer`. Run `npm install` to pick up new deps.",
                    },
                  },
                },
                importFailed: {
                  summary: "Import pipeline error",
                  value: {
                    error: { code: "IMPORT_FAILED", message: "Unexpected end of JSON input" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/updates/status": {
    get: {
      tags: ["Updates"],
      summary: "Check whether the dashboard git checkout is behind origin",
      description:
        "Reports whether the dashboard's own git checkout is behind its upstream remote, so a user can pull and restart manually (the dashboard never self-restarts). The response is a variant object: when it IS a git checkout it includes `git_repo: true`, `repo_root`, `update_available`, `commits_behind`, `remote_ref`, `local_sha`, `remote_sha`, and a copy-pasteable `manual_command`; when it is NOT a git checkout (e.g. an npm/tarball install) it returns `git_repo: false` with a `message` and no diff fields. Read-only — this only inspects git, it does not fetch destructively or modify the working tree.",
      operationId: "getUpdatesStatus",
      responses: {
        200: {
          description: "Update check result",
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
                description:
                  "Includes git_repo, update_available, commits_behind, remote_ref, local_sha, remote_sha, manual_command, and optional error/message fields.",
              },
              examples: {
                updateAvailable: {
                  summary: "Behind origin — update available",
                  value: UPDATE_STATUS_AVAILABLE_EXAMPLE,
                },
                upToDate: {
                  summary: "Up to date with origin",
                  value: UPDATE_STATUS_UP_TO_DATE_EXAMPLE,
                },
                notARepo: {
                  summary: "Not a git checkout — detection unavailable",
                  value: UPDATE_STATUS_NON_REPO_EXAMPLE,
                },
              },
            },
          },
        },
        500: {
          description: "Update status query failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "UPDATE_STATUS_FAILED", message: "git: command not found" },
              },
            },
          },
        },
      },
    },
  },

  "/api/updates/check": {
    post: {
      tags: ["Updates"],
      summary: "Run an update check immediately and broadcast the result",
      description:
        "Runs the same upstream check as GET /api/updates/status immediately and, in addition to returning the result, broadcasts it to every connected client as an `update_status` WebSocket message — so all open dashboard tabs refresh their update banner at once. The response shape is identical to GET /api/updates/status (the same git_repo / update_available / commits_behind / manual_command variant object). Read-only with respect to the working tree.",
      operationId: "triggerUpdatesCheck",
      responses: {
        200: {
          description: "Fresh update status payload (also broadcast over WebSocket)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: true,
                description:
                  "Same shape as GET /api/updates/status. Also sent as an update_status WebSocket message to all connected clients.",
              },
              examples: {
                updateAvailable: {
                  summary: "Behind origin — update available",
                  value: UPDATE_STATUS_AVAILABLE_EXAMPLE,
                },
                upToDate: {
                  summary: "Up to date with origin",
                  value: UPDATE_STATUS_UP_TO_DATE_EXAMPLE,
                },
              },
            },
          },
        },
        500: {
          description: "Update check failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "UPDATE_CHECK_FAILED",
                  message: "git fetch failed: network unreachable",
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/workflows": {
    get: {
      tags: ["Workflows"],
      summary: "Get workflow intelligence aggregates",
      description:
        "Returns the full workflow-intelligence aggregate powering the Workflows analytics page — 11 sections in one payload: `stats` (headline counters: sessions, agents, subagents, success rate, avg depth/duration, compactions, top tool flow), `orchestration` (subagent-type breakdown + delegation edges + outcomes), `toolFlow` (tool-to-tool transitions + tool counts), `effectiveness` (per-subagent-type success rate, avg duration, weekly trend), `patterns` (frequent subagent sequences + solo-session share), `modelDelegation` (model usage for main/sub agents + tokens by model), `errorPropagation` (errors by depth/type + error rate), `concurrency` (averaged agent swim-lane start/end), `complexity` (per-session agent/token/duration rows), `compaction` (compaction counts + tokens recovered), and `cooccurrence` (directed subagent-after-subagent pairs). The optional `status` query filter scopes every section to sessions of one status. Errors use the SHORT `{ error: { message } }` shape.",
      operationId: "getWorkflowIntelligence",
      parameters: [{ $ref: "#/components/parameters/WorkflowStatusQuery" }],
      responses: {
        200: {
          description: "Workflow aggregate data",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkflowAggregateResponse" },
              example: WORKFLOW_AGGREGATE_EXAMPLE,
            },
          },
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "no such table: agents" } },
            },
          },
        },
      },
    },
  },

  "/api/workflows/session/{id}": {
    get: {
      tags: ["Workflows"],
      summary: "Get workflow drill-in for one session",
      description:
        "Returns the workflow drill-in for a single session, used by the session-level Workflow view: `session` (the session row), `tree` (the recursive parent→child agent tree rooted at the main agent), `toolTimeline` (chronological tool events with tool_name/event_type/agent_id/summary), `swimLanes` (a flat per-agent start/end lane list for the Gantt-style view), and `events` (the chronological event stream, capped at the first 500 rows). Returns 404 with the SHORT `{ error: { message } }` shape when the session id is unknown.",
      operationId: "getWorkflowSession",
      parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
      responses: {
        200: {
          description: "Workflow session detail",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkflowSessionResponse" },
              example: WORKFLOW_SESSION_EXAMPLE,
            },
          },
        },
        404: {
          description: "Session not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "Session not found" } },
            },
          },
        },
        500: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "no such table: agents" } },
            },
          },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
