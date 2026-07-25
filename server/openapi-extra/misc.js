/**
 * @file Supplementary OpenAPI 3.0 fragments for endpoints that were previously
 * undocumented in the base spec (server/openapi.js). Covers:
 *   - GET    /api/sessions/facets              (Sessions)
 *   - GET    /api/settings/claude-home         (Settings)
 *   - PUT    /api/settings/claude-home         (Settings)
 *   - GET    /api/workflows/runs               (Workflows)
 *   - GET    /api/workflows/runs/{runId}       (Workflows)
 *   - GET    /api/remote-sources               (Remote Sources)
 *   - POST   /api/remote-sources               (Remote Sources)
 *   - PATCH  /api/remote-sources/{id}          (Remote Sources)
 *   - DELETE /api/remote-sources/{id}          (Remote Sources)
 *   - POST   /api/remote-sources/{id}/test     (Remote Sources)
 *   - POST   /api/remote-sources/{id}/sync     (Remote Sources)
 *   - GET    /api/projects                     (Projects)
 *   - POST   /api/projects                     (Projects)
 *   - PATCH  /api/projects/{id}                (Projects)
 *   - DELETE /api/projects/{id}                (Projects)
 *   - POST   /api/projects/{id}/paths          (Projects)
 *   - DELETE /api/projects/{id}/paths/{pathId} (Projects)
 *
 * Exports `{ tags, schemas, paths }` and is combined into the base spec by
 * server/openapi-extra.js. Schema names are prefixed (Sessions / Settings /
 * Workflow / RemoteSource / Project) so they never collide with the base
 * `components.schemas`. The Sessions/Settings/Workflows tags — plus the
 * `Remote Sources` tag now declared in the base literal — are all present in
 * the base spec, so `tags` here only needs to add `Projects` (not yet
 * declared in the base literal). Error bodies reference the base-defined
 * `ErrorResponse` (shape `{ error: { code, message } }`); the run-detail
 * agents and events arrays reference the base `Agent` / `DashboardEvent`
 * schemas. The `SessionsFacetsResponse` schema additionally exposes a
 * `sources` array (the distinct `sessions.source` values).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [
  {
    name: "Projects",
    description:
      "User-named groupings of one or more session working directories (cwds). A thin label layer over existing session/cwd data — sessions carry no project_id column, so membership is derived by joining sessions.cwd against the folder mappings.",
  },
];

const schemas = {
  SessionsFacetsResponse: {
    type: "object",
    description:
      "Facet values for the Sessions page filter UI: the distinct working directories (cwd) and the distinct data-source ids seen across all sessions.",
    required: ["cwds", "sources"],
    properties: {
      cwds: {
        type: "array",
        description:
          "Distinct, non-empty session working directories (the `cwd` column), sorted ascending. Powers the cwd filter dropdown.",
        items: { type: "string" },
        example: [
          "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
          "/Users/son/code/another-project",
        ],
      },
      sources: {
        type: "array",
        description:
          "Distinct data-source ids seen across all sessions (the `sessions.source` column). Always includes the built-in `local` history; each configured remote SSH machine contributes its `remote_sources.id`. Powers the source filter dropdown and the `sources` query param on the list/analytics endpoints.",
        items: { type: "string" },
        example: ["local", "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11"],
      },
    },
  },

  RemoteSource: {
    type: "object",
    description:
      "A configured remote SSH machine the dashboard pulls Claude Code history from. NO secrets are stored on this record — SSH authentication defers entirely to the host's SSH stack (ssh-agent, `~/.ssh/config`, and key files). `host` is an SSH destination (`user@host`) or a `~/.ssh/config` alias.",
    required: [
      "id",
      "label",
      "host",
      "ssh_port",
      "identity_file",
      "remote_home",
      "enabled",
      "status",
      "last_error",
      "last_sync_at",
      "last_sync_counts",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: {
        type: "string",
        description: "Primary key — the remote-source id (also used as `sessions.source`).",
        example: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
      },
      label: {
        type: "string",
        description: "Human-readable name shown in the UI.",
        example: "Work laptop",
      },
      host: {
        type: "string",
        description:
          "SSH destination (`user@host`) or a `~/.ssh/config` alias resolved by the host SSH stack.",
        example: "son@studio.local",
      },
      ssh_port: {
        type: "integer",
        nullable: true,
        description: "Optional SSH port; null defers to the SSH default / `~/.ssh/config`.",
        example: 22,
      },
      identity_file: {
        type: "string",
        nullable: true,
        description: "Optional path to a private-key file passed to ssh (`-i`); null to omit.",
        example: "~/.ssh/id_ed25519",
      },
      remote_home: {
        type: "string",
        nullable: true,
        description:
          "Optional remote Claude home to read transcripts from; null defaults to the remote `~/.claude`.",
        example: "~/.claude",
      },
      enabled: {
        type: "boolean",
        description: "Whether this source is eligible for scheduled/manual syncs.",
        example: true,
      },
      status: {
        type: "string",
        enum: ["idle", "syncing", "ok", "error"],
        description: "Last known sync status of the source.",
        example: "ok",
      },
      last_error: {
        type: "string",
        nullable: true,
        description: "Error message from the last failed sync/test, or null.",
        example: null,
      },
      last_sync_at: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "ISO-8601 timestamp of the last successful sync, or null.",
        example: "2026-07-22T18:41:55.117Z",
      },
      last_sync_counts: {
        type: "object",
        nullable: true,
        additionalProperties: true,
        description:
          "Counters from the last sync (imported / skipped / backfilled / errors / sessions_seen / sessions_tagged), or null if never synced.",
        example: {
          imported: 9,
          skipped: 41,
          backfilled: 0,
          errors: 0,
          sessions_seen: 50,
          sessions_tagged: 50,
        },
      },
      created_at: {
        type: "string",
        format: "date-time",
        description: "ISO-8601 creation timestamp.",
        example: "2026-07-20T09:15:00.000Z",
      },
      updated_at: {
        type: "string",
        format: "date-time",
        description: "ISO-8601 timestamp of the last edit.",
        example: "2026-07-22T18:41:55.117Z",
      },
    },
  },

  RemoteSourceCreateRequest: {
    type: "object",
    description:
      "Request body to register a remote SSH source. `label` and `host` are required; the rest are optional. No credentials are ever accepted or stored — auth defers to the host SSH stack.",
    required: ["label", "host"],
    properties: {
      label: { type: "string", description: "Human-readable name.", example: "Work laptop" },
      host: {
        type: "string",
        description: "SSH destination (`user@host`) or a `~/.ssh/config` alias.",
        example: "son@studio.local",
      },
      ssh_port: {
        type: "integer",
        description: "Optional SSH port.",
        example: 22,
      },
      identity_file: {
        type: "string",
        description: "Optional private-key path passed to ssh (`-i`).",
        example: "~/.ssh/id_ed25519",
      },
      remote_home: {
        type: "string",
        description: "Optional remote Claude home; defaults to the remote `~/.claude`.",
        example: "~/.claude",
      },
      enabled: {
        type: "boolean",
        description: "Whether the source is enabled for syncing (default true).",
        example: true,
      },
    },
  },

  RemoteSourceUpdateRequest: {
    type: "object",
    description:
      "Partial update for a remote source. Only the keys present in the body are changed; omitted keys are left as-is. Same field set as create; both `label` and `host` are optional here.",
    properties: {
      label: { type: "string", example: "Studio Mac" },
      host: { type: "string", example: "son@studio.local" },
      ssh_port: { type: "integer", nullable: true, example: 2222 },
      identity_file: { type: "string", nullable: true, example: "~/.ssh/id_ed25519" },
      remote_home: { type: "string", nullable: true, example: "~/.claude" },
      enabled: { type: "boolean", example: false },
    },
  },

  RemoteSourceResponse: {
    type: "object",
    required: ["source"],
    properties: { source: { $ref: "#/components/schemas/RemoteSource" } },
  },

  RemoteSourceListResponse: {
    type: "object",
    required: ["sources"],
    properties: {
      sources: {
        type: "array",
        items: { $ref: "#/components/schemas/RemoteSource" },
      },
    },
  },

  RemoteSourceTestResponse: {
    type: "object",
    description: "Result of an SSH connectivity probe.",
    required: ["ok", "message"],
    properties: {
      ok: { type: "boolean", example: true },
      message: {
        type: "string",
        description: "Human-readable probe result.",
        example: "Connected; found 24 project directories under ~/.claude/projects.",
      },
      remoteProjects: {
        type: "array",
        description:
          "Optional list of remote project directories discovered during the probe (present on success).",
        items: { type: "string" },
        example: ["-Users-son-code-foo", "-Users-son-code-bar"],
      },
    },
  },

  RemoteSourceSyncResponse: {
    type: "object",
    description: "Counters from a pull-now sync against the remote source.",
    required: [
      "ok",
      "imported",
      "skipped",
      "backfilled",
      "errors",
      "sessions_seen",
      "sessions_tagged",
    ],
    properties: {
      ok: { type: "boolean", example: true },
      imported: { type: "integer", example: 9 },
      skipped: { type: "integer", example: 41 },
      backfilled: { type: "integer", example: 0 },
      errors: { type: "integer", example: 0 },
      sessions_seen: { type: "integer", example: 50 },
      sessions_tagged: {
        type: "integer",
        description: "Number of imported sessions stamped with this source's id.",
        example: 50,
      },
    },
  },

  SettingsClaudeHomeResponse: {
    type: "object",
    description:
      "The Claude Code home directory the dashboard reads transcripts and settings from. Defaults to `~/.claude` unless overridden via the CLAUDE_HOME environment variable.",
    required: ["claude_home"],
    properties: {
      claude_home: {
        type: "string",
        description:
          "Absolute path to the active Claude Code home directory (CLAUDE_HOME, or `<homedir>/.claude` when unset).",
        example: "/Users/son/.claude",
      },
    },
  },

  SettingsClaudeHomeUpdateRequest: {
    type: "object",
    description:
      "Request body for changing the Claude Code home directory. A leading `~` is expanded to the user's home directory; the resolved path must be absolute and point to an existing directory.",
    required: ["path"],
    properties: {
      path: {
        type: "string",
        description:
          "New Claude Code home directory. A leading `~/` is expanded to the OS home directory before validation. Must resolve to an absolute path that exists and is a directory.",
        example: "~/.codefuse/engine/cc",
      },
    },
  },

  SettingsClaudeHomeUpdateResponse: {
    type: "object",
    description:
      "Confirmation that CLAUDE_HOME was updated. The new value is applied to process.env immediately and persisted to the project `.env` file.",
    required: ["ok", "claude_home"],
    properties: {
      ok: { type: "boolean", enum: [true] },
      claude_home: {
        type: "string",
        description: "The resolved absolute path now in effect (after `~` expansion).",
        example: "/Users/son/.codefuse/engine/cc",
      },
    },
  },

  WorkflowToolRun: {
    type: "object",
    description:
      "A Claude Code Workflow-tool run (issue #167): a fleet of sub-agents spawned by the 'Workflow' tool (or self-paced /loop). These emit no hooks; the source of truth is the on-disk run journal, ingested into the `workflows` table (see server/lib/workflow-ingest.js). Keyed by `run_id` and parented to the launching session. The JSON-blob columns `phases` and `progress` are parsed into arrays before serialization.",
    required: [
      "run_id",
      "session_id",
      "status",
      "agent_count",
      "total_tokens",
      "total_tool_calls",
      "phases",
      "progress",
      "source",
      "created_at",
      "updated_at",
    ],
    properties: {
      run_id: {
        type: "string",
        description: "Primary key — the workflow run id.",
        example: "wf_a1b2c3d4",
      },
      session_id: {
        type: "string",
        description: "The session that launched this run (FK into sessions.id).",
        example: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
      },
      task_id: {
        type: "string",
        nullable: true,
        description: "Optional task/issue identifier associated with the run.",
        example: "ISSUE-167",
      },
      name: {
        type: "string",
        nullable: true,
        description: "Human-readable run name from the journal, if present.",
        example: "Refactor pricing engine",
      },
      status: {
        type: "string",
        description:
          "Open status string (e.g. running | completed | error | failed). Intentionally not constrained to an enum so new harness states never trip a stale constraint.",
        example: "completed",
      },
      default_model: {
        type: "string",
        nullable: true,
        description: "Default model the run delegated work to, when recorded.",
        example: "claude-opus-4-8",
      },
      started_at: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "When the run started, if known.",
        example: "2026-06-25T18:04:11.122Z",
      },
      ended_at: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "When the run finished, if known.",
        example: "2026-06-25T18:09:47.530Z",
      },
      duration_ms: {
        type: "integer",
        nullable: true,
        description: "Total run duration in milliseconds, if known.",
        example: 336408,
      },
      agent_count: {
        type: "integer",
        minimum: 0,
        description: "Number of inner agents in this run.",
        example: 6,
      },
      total_tokens: {
        type: "integer",
        minimum: 0,
        description: "Aggregate token usage across the run's inner agents.",
        example: 1284750,
      },
      total_tool_calls: {
        type: "integer",
        minimum: 0,
        description: "Aggregate tool-call count across the run's inner agents.",
        example: 412,
      },
      phases: {
        type: "array",
        description:
          "Parsed `phases[]` array from the run journal (verbatim journal payload, opaque to this API). Empty array when absent or unparseable.",
        items: { type: "object", additionalProperties: true },
        example: [
          { name: "plan", status: "completed" },
          { name: "implement", status: "completed" },
        ],
      },
      progress: {
        type: "array",
        description:
          "Parsed `workflowProgress[]` array from the run journal (verbatim journal payload, opaque to this API). Empty array when absent or unparseable.",
        items: { type: "object", additionalProperties: true },
        example: [{ step: 1, label: "scaffold", done: true }],
      },
      script_path: {
        type: "string",
        nullable: true,
        description: "Path to the run's driving script, if recorded.",
        example: "/Users/son/.claude/projects/-Users-son-code/wf_a1b2c3d4.sh",
      },
      journal_path: {
        type: "string",
        nullable: true,
        description: "Path to the on-disk run journal this row was ingested from.",
        example: "/Users/son/.claude/projects/-Users-son-code/5f3c0e2a/workflows/wf_a1b2c3d4.json",
      },
      source: {
        type: "string",
        description: "Ingestion source for the row (defaults to 'journal').",
        example: "journal",
      },
      created_at: {
        type: "string",
        format: "date-time",
        description: "Row creation timestamp.",
        example: "2026-06-25T18:09:48.001Z",
      },
      updated_at: {
        type: "string",
        format: "date-time",
        description: "Row last-update timestamp.",
        example: "2026-06-25T18:09:48.001Z",
      },
    },
  },

  WorkflowRunsListResponse: {
    type: "object",
    description:
      "Paginated list of Workflow-tool runs with status counts. `total` reflects the active filter (status when supplied, otherwise the full table); `counts` is always the whole-table breakdown by status.",
    required: ["runs", "total", "counts", "limit", "offset"],
    properties: {
      runs: {
        type: "array",
        items: { $ref: "#/components/schemas/WorkflowToolRun" },
      },
      total: {
        type: "integer",
        minimum: 0,
        description:
          "Total runs matching the current filter (independent of limit/offset). Equals the status-filtered count when `status` is supplied, otherwise the full-table count. Note: not narrowed by `session_id`.",
        example: 42,
      },
      counts: {
        type: "object",
        description: "Whole-table run counts grouped by status (not affected by filters).",
        additionalProperties: { type: "integer", minimum: 0 },
        example: { completed: 30, error: 5, running: 7 },
      },
      limit: { type: "integer", description: "Effective page size used.", example: 50 },
      offset: { type: "integer", description: "Effective pagination offset used.", example: 0 },
    },
  },

  WorkflowRunDetailResponse: {
    type: "object",
    description:
      "A single Workflow-tool run with its linked inner agents and the events attributed to those agents (chronological, capped at 5000).",
    required: ["workflow", "agents", "events"],
    properties: {
      workflow: { $ref: "#/components/schemas/WorkflowToolRun" },
      agents: {
        type: "array",
        description: "Inner agents linked to this run via agents.workflow_run_id.",
        items: { $ref: "#/components/schemas/Agent" },
      },
      events: {
        type: "array",
        description:
          "Events attributed to this run's inner agents, ordered by created_at then id. Capped at 5000 rows.",
        items: { $ref: "#/components/schemas/DashboardEvent" },
      },
    },
  },

  ProjectPath: {
    type: "object",
    description:
      "A single folder mapping: one session working directory (cwd) attached to a project. A cwd belongs to at most one project.",
    required: ["id", "cwd"],
    properties: {
      id: {
        type: "integer",
        description: "Primary key of the folder mapping row (project_paths.id).",
        example: 3,
      },
      cwd: {
        type: "string",
        description: "The mapped session working directory.",
        example: "/Users/son/code/agent-monitor",
      },
    },
  },

  Project: {
    type: "object",
    description:
      "A user-named grouping of one or more session working directories (cwds). Sessions carry no project_id column — membership is derived by joining sessions.cwd against the folder mappings in `paths`, so a session created (or imported) before its folder was ever assigned to a project retroactively belongs to that project the moment the mapping is added. `session_count` / `active_count` / `last_activity` are aggregated across all mapped cwds.",
    required: [
      "id",
      "name",
      "paths",
      "session_count",
      "active_count",
      "last_activity",
      "created_at",
      "updated_at",
    ],
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Primary key — the project id.",
        example: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
      },
      name: {
        type: "string",
        description: "Human-readable project name.",
        example: "Agent Monitor",
      },
      paths: {
        type: "array",
        description: "Folders mapped to this project.",
        items: { $ref: "#/components/schemas/ProjectPath" },
      },
      session_count: {
        type: "integer",
        minimum: 0,
        description: "Total sessions across every mapped cwd.",
        example: 12,
      },
      active_count: {
        type: "integer",
        minimum: 0,
        description: "Sessions with status 'active' across every mapped cwd.",
        example: 1,
      },
      last_activity: {
        type: "string",
        format: "date-time",
        nullable: true,
        description:
          "Latest `sessions.updated_at` across every mapped cwd, or null when no mapped cwd has any sessions.",
        example: "2026-07-23T14:02:11.500Z",
      },
      created_at: {
        type: "string",
        format: "date-time",
        description: "ISO-8601 creation timestamp.",
        example: "2026-07-20T09:15:00.000Z",
      },
      updated_at: {
        type: "string",
        format: "date-time",
        description: "ISO-8601 timestamp of the last rename.",
        example: "2026-07-22T18:41:55.117Z",
      },
    },
  },

  ProjectsUnassignedBucket: {
    type: "object",
    description:
      "Aggregate for session working directories that have sessions but are not yet mapped to any project.",
    required: ["cwds", "session_count", "active_count", "last_activity"],
    properties: {
      cwds: {
        type: "array",
        description: "Session working directories not mapped to any project.",
        items: { type: "string" },
        example: ["/Users/son/code/scratch-repo"],
      },
      session_count: {
        type: "integer",
        minimum: 0,
        description: "Total sessions across every unassigned cwd.",
        example: 4,
      },
      active_count: {
        type: "integer",
        minimum: 0,
        description: "Sessions with status 'active' across every unassigned cwd.",
        example: 0,
      },
      last_activity: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "Latest `sessions.updated_at` across every unassigned cwd, or null when none.",
        example: "2026-07-21T11:30:02.221Z",
      },
    },
  },

  ProjectsListResponse: {
    type: "object",
    required: ["projects", "unassigned"],
    properties: {
      projects: {
        type: "array",
        items: { $ref: "#/components/schemas/Project" },
      },
      unassigned: { $ref: "#/components/schemas/ProjectsUnassignedBucket" },
    },
  },

  ProjectResponse: {
    type: "object",
    required: ["project"],
    properties: { project: { $ref: "#/components/schemas/Project" } },
  },

  ProjectCreateRequest: {
    type: "object",
    description:
      "Request body to create a project. `name` is required and non-blank. `cwds` is optional — when given, each must be a non-empty string and must not already be mapped to any project (each is checked before the project is created).",
    required: ["name"],
    properties: {
      name: {
        type: "string",
        description: "Human-readable project name.",
        example: "Agent Monitor",
      },
      cwds: {
        type: "array",
        description: "Optional folders to attach immediately. Duplicates are de-duplicated.",
        items: { type: "string" },
        example: ["/Users/son/code/agent-monitor"],
      },
    },
  },

  ProjectRenameRequest: {
    type: "object",
    description: "Request body to rename a project. `name` is required and non-blank.",
    required: ["name"],
    properties: {
      name: { type: "string", description: "New project name.", example: "Agent Monitor (v2)" },
    },
  },

  ProjectPathCreateRequest: {
    type: "object",
    description:
      "Request body to map an additional folder onto a project. `cwd` is required and non-blank, and must not already be mapped to any project (including this one).",
    required: ["cwd"],
    properties: {
      cwd: {
        type: "string",
        description: "Session working directory to map.",
        example: "/Users/son/code/agent-monitor-docs",
      },
    },
  },
};

const paths = {
  "/api/sessions/facets": {
    get: {
      tags: ["Sessions"],
      summary: "List session facet values",
      description:
        "Returns the distinct facet values for the Sessions page filters: the non-empty working directories (the `cwd` column, sorted ascending) in `cwds`, and the distinct data-source ids (the `sessions.source` column) in `sources`. `sources` always includes the built-in `local` history plus any configured remote SSH machines. Always returns a 200 with (possibly empty) arrays.",
      operationId: "listSessionFacets",
      responses: {
        200: {
          description: "Distinct session working directories and data-source ids",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionsFacetsResponse" },
              example: {
                cwds: [
                  "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
                  "/Users/son/code/another-project",
                ],
                sources: ["local", "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11"],
              },
            },
          },
        },
      },
    },
  },

  "/api/remote-sources": {
    get: {
      tags: ["Remote Sources"],
      summary: "List remote data sources",
      description:
        "Returns every configured remote SSH source the dashboard pulls Claude Code history from. NO secrets are ever returned — these records store none (SSH auth defers to the host SSH stack). Each entry carries its last sync `status`, `last_error`, `last_sync_at`, and `last_sync_counts`. Read-only; always 200.",
      operationId: "listRemoteSources",
      responses: {
        200: {
          description: "All configured remote sources",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RemoteSourceListResponse" },
              example: {
                sources: [
                  {
                    id: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
                    label: "Work laptop",
                    host: "son@studio.local",
                    ssh_port: 22,
                    identity_file: "~/.ssh/id_ed25519",
                    remote_home: "~/.claude",
                    enabled: true,
                    status: "ok",
                    last_error: null,
                    last_sync_at: "2026-07-22T18:41:55.117Z",
                    last_sync_counts: {
                      imported: 9,
                      skipped: 41,
                      backfilled: 0,
                      errors: 0,
                      sessions_seen: 50,
                      sessions_tagged: 50,
                    },
                    created_at: "2026-07-20T09:15:00.000Z",
                    updated_at: "2026-07-22T18:41:55.117Z",
                  },
                ],
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Remote Sources"],
      summary: "Register a remote data source",
      description:
        "Registers a remote SSH source. `label` and `host` are required; `host` is an SSH destination (`user@host`) or a `~/.ssh/config` alias. Optional `ssh_port`, `identity_file`, `remote_home`, and `enabled` fine-tune the connection. No credentials are accepted or stored — auth defers to the host SSH stack. Returns the created source (201). Validation failures return 400 `{ error: { code, message } }` with one of the codes INVALID_LABEL, INVALID_HOST, INVALID_PORT, INVALID_IDENTITY_FILE, INVALID_REMOTE_HOME.",
      operationId: "createRemoteSource",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RemoteSourceCreateRequest" },
            examples: {
              minimal: {
                summary: "Minimal — label + SSH config alias",
                value: { label: "Work laptop", host: "studio" },
              },
              full: {
                summary: "Full — explicit port, key, and remote home",
                value: {
                  label: "Work laptop",
                  host: "son@studio.local",
                  ssh_port: 22,
                  identity_file: "~/.ssh/id_ed25519",
                  remote_home: "~/.claude",
                  enabled: true,
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Remote source created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RemoteSourceResponse" },
              example: {
                source: {
                  id: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
                  label: "Work laptop",
                  host: "son@studio.local",
                  ssh_port: 22,
                  identity_file: "~/.ssh/id_ed25519",
                  remote_home: "~/.claude",
                  enabled: true,
                  status: "idle",
                  last_error: null,
                  last_sync_at: null,
                  last_sync_counts: null,
                  created_at: "2026-07-22T18:41:55.117Z",
                  updated_at: "2026-07-22T18:41:55.117Z",
                },
              },
            },
          },
        },
        400: {
          description:
            "Validation error (codes: INVALID_LABEL, INVALID_HOST, INVALID_PORT, INVALID_IDENTITY_FILE, INVALID_REMOTE_HOME).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                label: {
                  summary: "Missing/blank label",
                  value: { error: { code: "INVALID_LABEL", message: "`label` is required" } },
                },
                host: {
                  summary: "Missing/invalid host",
                  value: { error: { code: "INVALID_HOST", message: "`host` is required" } },
                },
                port: {
                  summary: "Port out of range",
                  value: {
                    error: { code: "INVALID_PORT", message: "`ssh_port` must be 1–65535" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/remote-sources/{id}": {
    patch: {
      tags: ["Remote Sources"],
      summary: "Update a remote data source (partial)",
      description:
        "Partially updates a remote source. Only the keys present in the body are changed; omitted keys are left as-is. The same validation as create applies to any field that is present. Returns the updated source, or 404 when the id is unknown.",
      operationId: "updateRemoteSource",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Remote source id.",
          example: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RemoteSourceUpdateRequest" },
            examples: {
              disable: {
                summary: "Disable a source without touching anything else",
                value: { enabled: false },
              },
              rename: {
                summary: "Rename and change port",
                value: { label: "Studio Mac", ssh_port: 2222 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Updated remote source",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RemoteSourceResponse" },
              example: {
                source: {
                  id: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
                  label: "Studio Mac",
                  host: "son@studio.local",
                  ssh_port: 2222,
                  identity_file: "~/.ssh/id_ed25519",
                  remote_home: "~/.claude",
                  enabled: false,
                  status: "ok",
                  last_error: null,
                  last_sync_at: "2026-07-22T18:41:55.117Z",
                  last_sync_counts: {
                    imported: 9,
                    skipped: 41,
                    backfilled: 0,
                    errors: 0,
                    sessions_seen: 50,
                    sessions_tagged: 50,
                  },
                  created_at: "2026-07-20T09:15:00.000Z",
                  updated_at: "2026-07-22T19:02:10.400Z",
                },
              },
            },
          },
        },
        400: {
          description:
            "Validation error (codes: INVALID_LABEL, INVALID_HOST, INVALID_PORT, INVALID_IDENTITY_FILE, INVALID_REMOTE_HOME).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "INVALID_PORT", message: "`ssh_port` must be 1–65535" },
              },
            },
          },
        },
        404: {
          description: "Remote source not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "NOT_FOUND", message: "Remote source not found" },
              },
            },
          },
        },
      },
    },
    delete: {
      tags: ["Remote Sources"],
      summary: "Delete a remote data source",
      description:
        "Deletes a remote source. By default its imported sessions are DETACHED — reassigned to the built-in `local` source — so history is preserved. Pass `?purge=true` to instead permanently DELETE that source's imported sessions along with the source. The response reports whether a purge occurred.",
      operationId: "deleteRemoteSource",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Remote source id.",
          example: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
        },
        {
          name: "purge",
          in: "query",
          required: false,
          schema: { type: "boolean", default: false },
          description:
            "When true, also delete this source's imported sessions. When false/omitted, those sessions are reattached to `local`.",
          example: true,
        },
      ],
      responses: {
        200: {
          description: "Deleted (with the purge outcome)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ok", "purged"],
                properties: {
                  ok: { type: "boolean", example: true },
                  purged: {
                    type: "boolean",
                    description:
                      "True when the source's imported sessions were deleted (purge=true); false when they were detached to `local`.",
                    example: false,
                  },
                },
              },
              examples: {
                detached: {
                  summary: "Default — sessions detached to local",
                  value: { ok: true, purged: false },
                },
                purged: {
                  summary: "purge=true — sessions deleted",
                  value: { ok: true, purged: true },
                },
              },
            },
          },
        },
        404: {
          description: "Remote source not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "NOT_FOUND", message: "Remote source not found" },
              },
            },
          },
        },
      },
    },
  },

  "/api/remote-sources/{id}/test": {
    post: {
      tags: ["Remote Sources"],
      summary: "Probe SSH connectivity to a remote source",
      description:
        "Runs an SSH connectivity probe against the source and reports the outcome synchronously. The `ok` flag carries the probe result and `message` is a human-readable summary; on success `remoteProjects` may list the remote project directories discovered under the remote Claude home. This does not import anything — use POST /{id}/sync to pull.",
      operationId: "testRemoteSource",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Remote source id.",
          example: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
        },
      ],
      responses: {
        200: {
          description: "Probe result (ok flag carries the connectivity outcome)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RemoteSourceTestResponse" },
              examples: {
                success: {
                  summary: "Reachable",
                  value: {
                    ok: true,
                    message: "Connected; found 24 project directories under ~/.claude/projects.",
                    remoteProjects: ["-Users-son-code-foo", "-Users-son-code-bar"],
                  },
                },
                failure: {
                  summary: "Unreachable / auth failed",
                  value: {
                    ok: false,
                    message: "ssh: connect to host studio.local port 22: Connection refused",
                  },
                },
              },
            },
          },
        },
        404: {
          description: "Remote source not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "NOT_FOUND", message: "Remote source not found" },
              },
            },
          },
        },
      },
    },
  },

  "/api/remote-sources/{id}/sync": {
    post: {
      tags: ["Remote Sources"],
      summary: "Pull Claude Code history from a remote source now",
      description:
        "Triggers an immediate pull of Claude Code history from the remote source over SSH, importing new transcripts through the same idempotent, baseline-preserving pipeline used for local imports and tagging imported sessions with this source's id. The response reports the per-run counters. Sync progress/completion is also broadcast over the WebSocket as `remote_source.status` frames.",
      operationId: "syncRemoteSource",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Remote source id.",
          example: "4d1f0e2a-7b9c-4c33-8a21-9e0f7b6d4c11",
        },
      ],
      responses: {
        200: {
          description: "Sync result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RemoteSourceSyncResponse" },
              example: {
                ok: true,
                imported: 9,
                skipped: 41,
                backfilled: 0,
                errors: 0,
                sessions_seen: 50,
                sessions_tagged: 50,
              },
            },
          },
        },
        404: {
          description: "Remote source not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "NOT_FOUND", message: "Remote source not found" },
              },
            },
          },
        },
        500: {
          description: "Sync failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "SYNC_FAILED", message: "ssh exited with code 255" },
              },
            },
          },
        },
      },
    },
  },

  "/api/remote-sources/sync-all": {
    post: {
      tags: ["Remote Sources"],
      summary: "Sync all enabled remote sources now",
      description:
        "Pulls Claude Code history from every enabled remote source over SSH, sequentially (one connection at a time). Per-source failures are isolated — one unreachable source never aborts the others — and each outcome is returned in `results`. Progress/completion is also broadcast over the WebSocket as `remote_source.status` frames. Always returns 200.",
      operationId: "syncAllRemoteSources",
      responses: {
        200: {
          description: "Per-source sync outcomes",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  synced: {
                    type: "integer",
                    description: "Number of enabled sources that were attempted.",
                  },
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        ok: { type: "boolean" },
                        error: { type: "string" },
                      },
                    },
                  },
                },
              },
              example: { ok: true, synced: 2, results: [{ id: "src_a", ok: true }] },
            },
          },
        },
      },
    },
  },

  "/api/settings/claude-home": {
    get: {
      tags: ["Settings"],
      summary: "Get the active Claude Code home directory",
      description:
        "Returns the Claude Code home directory the dashboard uses to locate transcripts and settings. Resolves to the CLAUDE_HOME environment variable when set, otherwise `<homedir>/.claude`. Always returns 200.",
      operationId: "getClaudeHome",
      responses: {
        200: {
          description: "Current Claude Code home directory",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SettingsClaudeHomeResponse" },
              example: { claude_home: "/Users/son/.claude" },
            },
          },
        },
      },
    },
    put: {
      tags: ["Settings"],
      summary: "Update the Claude Code home directory",
      description:
        "Changes the Claude Code home directory used for transcript/settings discovery. A leading `~/` in `path` is expanded to the OS home directory; the resolved value must be an absolute path that exists and is a directory. On success the new value is applied to process.env immediately (so subsequent reads use it) and persisted to the project `.env` file. Returns 400 INVALID_PATH when `path` is missing/not a string, or when the resolved path is not absolute, does not exist, or is not a directory.",
      operationId: "updateClaudeHome",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SettingsClaudeHomeUpdateRequest" },
            example: { path: "~/.codefuse/engine/cc" },
          },
        },
      },
      responses: {
        200: {
          description: "Claude Code home updated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SettingsClaudeHomeUpdateResponse" },
              example: { ok: true, claude_home: "/Users/son/.codefuse/engine/cc" },
            },
          },
        },
        400: {
          description:
            "Invalid path — `path` missing or not a string, or the resolved path is not absolute / does not exist / is not a directory (code INVALID_PATH).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "INVALID_PATH",
                  message: "Directory does not exist: /Users/son/.codefuse/engine/cc",
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/workflows/runs": {
    get: {
      tags: ["Workflows"],
      summary: "List Workflow-tool runs",
      description:
        "Returns a paginated list of Workflow-tool runs (fleets of sub-agents spawned by the Claude Code 'Workflow' tool / self-paced /loop), newest first. Filter by `status` (the literal `all` is treated as no filter) or by `session_id`; `session_id` takes precedence over `status` when both are supplied. `counts` is always the whole-table breakdown by status. JSON-blob columns (`phases`, `progress`) are parsed into arrays in each run.",
      operationId: "listWorkflowRuns",
      parameters: [
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 1000, default: 50 },
          description: "Page size, clamped to 1–1000 (default 50).",
        },
        {
          name: "offset",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 0, default: 0 },
          description: "Pagination offset (clamped to >= 0).",
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string" },
          description:
            "Filter by run status (open string, e.g. running | completed | error | failed). The literal value `all` is treated as no filter.",
        },
        {
          name: "session_id",
          in: "query",
          required: false,
          schema: { type: "string" },
          description:
            "Filter to runs launched by this session. Takes precedence over `status` when both are provided.",
        },
      ],
      responses: {
        200: {
          description: "Paginated list of workflow runs with status counts",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkflowRunsListResponse" },
              example: {
                runs: [
                  {
                    run_id: "wf_a1b2c3d4",
                    session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
                    task_id: "ISSUE-167",
                    name: "Refactor pricing engine",
                    status: "completed",
                    default_model: "claude-opus-4-8",
                    started_at: "2026-06-25T18:04:11.122Z",
                    ended_at: "2026-06-25T18:09:47.530Z",
                    duration_ms: 336408,
                    agent_count: 6,
                    total_tokens: 1284750,
                    total_tool_calls: 412,
                    phases: [{ name: "plan", status: "completed" }],
                    progress: [{ step: 1, label: "scaffold", done: true }],
                    script_path: null,
                    journal_path:
                      "/Users/son/.claude/projects/-Users-son-code/5f3c0e2a/workflows/wf_a1b2c3d4.json",
                    source: "journal",
                    created_at: "2026-06-25T18:09:48.001Z",
                    updated_at: "2026-06-25T18:09:48.001Z",
                  },
                ],
                total: 42,
                counts: { completed: 30, error: 5, running: 7 },
                limit: 50,
                offset: 0,
              },
            },
          },
        },
        500: {
          description: "Failed to list workflow runs (code WORKFLOW_LIST_FAILED).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "WORKFLOW_LIST_FAILED", message: "no such table: workflows" },
              },
            },
          },
        },
      },
    },
  },

  "/api/workflows/runs/{runId}": {
    get: {
      tags: ["Workflows"],
      summary: "Get a Workflow-tool run with its agents and events",
      description:
        "Returns one Workflow-tool run (by `run_id`) together with its linked inner agents and the events attributed to those agents (chronological, capped at 5000 rows). The run's JSON-blob columns (`phases`, `progress`) are parsed into arrays. Returns 404 WORKFLOW_NOT_FOUND when no run matches the id.",
      operationId: "getWorkflowRun",
      parameters: [
        {
          name: "runId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "The workflow run id (workflows.run_id).",
        },
      ],
      responses: {
        200: {
          description: "Workflow run with inner agents and their events",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkflowRunDetailResponse" },
              example: {
                workflow: {
                  run_id: "wf_a1b2c3d4",
                  session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
                  task_id: "ISSUE-167",
                  name: "Refactor pricing engine",
                  status: "completed",
                  default_model: "claude-opus-4-8",
                  started_at: "2026-06-25T18:04:11.122Z",
                  ended_at: "2026-06-25T18:09:47.530Z",
                  duration_ms: 336408,
                  agent_count: 6,
                  total_tokens: 1284750,
                  total_tool_calls: 412,
                  phases: [{ name: "plan", status: "completed" }],
                  progress: [{ step: 1, label: "scaffold", done: true }],
                  script_path: null,
                  journal_path:
                    "/Users/son/.claude/projects/-Users-son-code/5f3c0e2a/workflows/wf_a1b2c3d4.json",
                  source: "journal",
                  created_at: "2026-06-25T18:09:48.001Z",
                  updated_at: "2026-06-25T18:09:48.001Z",
                },
                agents: [
                  {
                    id: "agent-7f1c",
                    session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
                    name: "implementer",
                    type: "subagent",
                    subagent_type: "general-purpose",
                    status: "completed",
                    task: "Implement pricing changes",
                    current_tool: null,
                    started_at: "2026-06-25T18:04:30.000Z",
                    ended_at: "2026-06-25T18:08:12.000Z",
                    parent_agent_id: null,
                    metadata: null,
                    updated_at: "2026-06-25T18:08:12.000Z",
                    awaiting_input_since: null,
                    awaiting_reason: null,
                  },
                ],
                events: [
                  {
                    id: 90211,
                    session_id: "5f3c0e2a-1b9d-4c77-8a21-9e0f7b6d4c11",
                    agent_id: "agent-7f1c",
                    event_type: "PostToolUse",
                    tool_name: "Edit",
                    summary: "Edited server/routes/pricing.js",
                    data: null,
                    created_at: "2026-06-25T18:05:02.144Z",
                  },
                ],
              },
            },
          },
        },
        404: {
          description: "No workflow run matches the id (code WORKFLOW_NOT_FOUND).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "WORKFLOW_NOT_FOUND", message: "Workflow run not found" },
              },
            },
          },
        },
        500: {
          description: "Failed to load workflow run detail (code WORKFLOW_DETAIL_FAILED).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "WORKFLOW_DETAIL_FAILED", message: "database is locked" },
              },
            },
          },
        },
      },
    },
  },

  "/api/projects": {
    get: {
      tags: ["Projects"],
      summary: "List projects with folder mappings and session stats",
      description:
        "Returns every project with its mapped folders (`paths`) and aggregated session stats (`session_count`, `active_count`, `last_activity` across every mapped cwd), plus an `unassigned` bucket listing cwds that have sessions but aren't mapped to any project yet. Read-only; always 200.",
      operationId: "listProjects",
      responses: {
        200: {
          description: "All projects plus the unassigned-cwds bucket",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProjectsListResponse" },
              example: {
                projects: [
                  {
                    id: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
                    name: "Agent Monitor",
                    paths: [{ id: 3, cwd: "/Users/son/code/agent-monitor" }],
                    session_count: 12,
                    active_count: 1,
                    last_activity: "2026-07-23T14:02:11.500Z",
                    created_at: "2026-07-20T09:15:00.000Z",
                    updated_at: "2026-07-22T18:41:55.117Z",
                  },
                ],
                unassigned: {
                  cwds: ["/Users/son/code/scratch-repo"],
                  session_count: 4,
                  active_count: 0,
                  last_activity: "2026-07-21T11:30:02.221Z",
                },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Projects"],
      summary: "Create a project",
      description:
        "Creates a project, optionally attaching folders it already covers via `cwds`. Each given cwd must be unmapped — a folder belongs to at most one project — and is checked before the project is created (so a single already-mapped cwd rejects the whole request without creating anything). Returns the created project with its `paths` (201).",
      operationId: "createProject",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ProjectCreateRequest" },
            examples: {
              nameOnly: {
                summary: "Name only — no folders attached yet",
                value: { name: "Agent Monitor" },
              },
              withFolders: {
                summary: "Name plus folders to attach immediately",
                value: { name: "Agent Monitor", cwds: ["/Users/son/code/agent-monitor"] },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Project created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProjectResponse" },
              example: {
                project: {
                  id: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
                  name: "Agent Monitor",
                  paths: [{ id: 3, cwd: "/Users/son/code/agent-monitor" }],
                  session_count: 0,
                  active_count: 0,
                  last_activity: null,
                  created_at: "2026-07-24T10:00:00.000Z",
                  updated_at: "2026-07-24T10:00:00.000Z",
                },
              },
            },
          },
        },
        400: {
          description:
            "Invalid input (code INVALID_INPUT) — `name` missing/blank, or `cwds` present but not an array of non-empty strings.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                name: {
                  summary: "Missing/blank name",
                  value: { error: { code: "INVALID_INPUT", message: "name is required" } },
                },
                cwds: {
                  summary: "cwds not an array of non-empty strings",
                  value: {
                    error: {
                      code: "INVALID_INPUT",
                      message: "cwds must be an array of non-empty strings",
                    },
                  },
                },
              },
            },
          },
        },
        409: {
          description:
            "One of the given `cwds` already belongs to another project (code ALREADY_MAPPED).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "ALREADY_MAPPED",
                  message: '"/Users/son/code/agent-monitor" already belongs to another project',
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/projects/{id}": {
    patch: {
      tags: ["Projects"],
      summary: "Rename a project",
      description: "Renames a project. Its folder mappings and session stats are unaffected.",
      operationId: "renameProject",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Project id.",
          example: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ProjectRenameRequest" },
            example: { name: "Agent Monitor (v2)" },
          },
        },
      },
      responses: {
        200: {
          description: "Updated project",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProjectResponse" },
              example: {
                project: {
                  id: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
                  name: "Agent Monitor (v2)",
                  paths: [{ id: 3, cwd: "/Users/son/code/agent-monitor" }],
                  session_count: 12,
                  active_count: 1,
                  last_activity: "2026-07-23T14:02:11.500Z",
                  created_at: "2026-07-20T09:15:00.000Z",
                  updated_at: "2026-07-24T10:05:00.000Z",
                },
              },
            },
          },
        },
        400: {
          description: "Missing/blank name (code INVALID_INPUT).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "INVALID_INPUT", message: "name is required" } },
            },
          },
        },
        404: {
          description: "Project not found (code NOT_FOUND).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Project not found" } },
            },
          },
        },
      },
    },
    delete: {
      tags: ["Projects"],
      summary: "Delete a project",
      description:
        "Deletes a project. Its folder mappings cascade-delete (ON DELETE CASCADE); the underlying sessions are untouched and simply fall back into the unassigned bucket.",
      operationId: "deleteProject",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Project id.",
          example: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
        },
      ],
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ok"],
                properties: { ok: { type: "boolean", example: true } },
              },
              example: { ok: true },
            },
          },
        },
        404: {
          description: "Project not found (code NOT_FOUND).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Project not found" } },
            },
          },
        },
      },
    },
  },

  "/api/projects/{id}/paths": {
    post: {
      tags: ["Projects"],
      summary: "Map an additional folder onto a project",
      description:
        "Maps one more session working directory onto an existing project. Returns the updated project with its full `paths` list (201). A cwd already mapped anywhere is rejected — the ALREADY_MAPPED message differs depending on whether it's already mapped to THIS project or to another one.",
      operationId: "addProjectPath",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Project id.",
          example: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ProjectPathCreateRequest" },
            example: { cwd: "/Users/son/code/agent-monitor-docs" },
          },
        },
      },
      responses: {
        201: {
          description: "Folder mapped; updated project returned",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProjectResponse" },
              example: {
                project: {
                  id: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
                  name: "Agent Monitor",
                  paths: [
                    { id: 3, cwd: "/Users/son/code/agent-monitor" },
                    { id: 4, cwd: "/Users/son/code/agent-monitor-docs" },
                  ],
                  session_count: 13,
                  active_count: 1,
                  last_activity: "2026-07-23T14:02:11.500Z",
                  created_at: "2026-07-20T09:15:00.000Z",
                  updated_at: "2026-07-20T09:15:00.000Z",
                },
              },
            },
          },
        },
        400: {
          description: "Missing/blank cwd (code INVALID_INPUT).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "INVALID_INPUT", message: "cwd is required" } },
            },
          },
        },
        404: {
          description: "Project not found (code NOT_FOUND).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Project not found" } },
            },
          },
        },
        409: {
          description:
            "The cwd is already mapped (code ALREADY_MAPPED) — message differs depending on whether it's already part of THIS project or another one.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                sameProject: {
                  summary: "Already mapped to this project",
                  value: {
                    error: {
                      code: "ALREADY_MAPPED",
                      message:
                        '"/Users/son/code/agent-monitor-docs" is already part of this project',
                    },
                  },
                },
                otherProject: {
                  summary: "Already mapped to a different project",
                  value: {
                    error: {
                      code: "ALREADY_MAPPED",
                      message:
                        '"/Users/son/code/agent-monitor-docs" already belongs to another project',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  "/api/projects/{id}/paths/{pathId}": {
    delete: {
      tags: ["Projects"],
      summary: "Unmap a folder from a project",
      description:
        "Removes one folder mapping from a project. The folder itself, and its sessions, are untouched — it just becomes unassigned again. Returns the updated project with its remaining `paths`.",
      operationId: "removeProjectPath",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Project id.",
          example: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
        },
        {
          name: "pathId",
          in: "path",
          required: true,
          schema: { type: "integer" },
          description: "Folder mapping id (project_paths.id) to remove.",
          example: 4,
        },
      ],
      responses: {
        200: {
          description: "Folder unmapped; updated project returned",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProjectResponse" },
              example: {
                project: {
                  id: "7c9f2e1a-3b6d-4a88-9c11-2f5e8a1d9b03",
                  name: "Agent Monitor",
                  paths: [{ id: 3, cwd: "/Users/son/code/agent-monitor" }],
                  session_count: 12,
                  active_count: 1,
                  last_activity: "2026-07-23T14:02:11.500Z",
                  created_at: "2026-07-20T09:15:00.000Z",
                  updated_at: "2026-07-20T09:15:00.000Z",
                },
              },
            },
          },
        },
        400: {
          description: "`pathId` is not an integer (code INVALID_INPUT).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "INVALID_INPUT", message: "pathId must be an integer" } },
            },
          },
        },
        404: {
          description:
            "Project id unknown, or `pathId` unknown/not mapped to this project (code NOT_FOUND).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                project: {
                  summary: "Unknown project id",
                  value: { error: { code: "NOT_FOUND", message: "Project not found" } },
                },
                mapping: {
                  summary: "Unknown or mismatched pathId",
                  value: { error: { code: "NOT_FOUND", message: "Folder mapping not found" } },
                },
              },
            },
          },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
