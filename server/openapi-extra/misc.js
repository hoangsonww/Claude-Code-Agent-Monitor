/**
 * @file Supplementary OpenAPI 3.0 fragments for endpoints that were previously
 * undocumented in the base spec (server/openapi.js). Covers:
 *   - GET  /api/sessions/facets            (Sessions)
 *   - GET  /api/settings/claude-home       (Settings)
 *   - PUT  /api/settings/claude-home       (Settings)
 *   - GET  /api/workflows/runs             (Workflows)
 *   - GET  /api/workflows/runs/{runId}     (Workflows)
 *
 * Exports `{ tags, schemas, paths }` and is combined into the base spec by
 * server/openapi-extra.js. Schema names are prefixed (Sessions / Settings /
 * Workflow) so they never collide with the base `components.schemas`. The
 * Sessions/Settings/Workflows tags are already declared in the base literal, so
 * `tags` here is intentionally empty. Error bodies reference the base-defined
 * `ErrorResponse` (shape `{ error: { code, message } }`); the run-detail agents
 * and events arrays reference the base `Agent` / `DashboardEvent` schemas.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [];

const schemas = {
  SessionsFacetsResponse: {
    type: "object",
    description:
      "Facet values for the Sessions page filter UI. Currently exposes the distinct working directories (cwd) seen across all sessions.",
    required: ["cwds"],
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
};

const paths = {
  "/api/sessions/facets": {
    get: {
      tags: ["Sessions"],
      summary: "List session facet values",
      description:
        "Returns the distinct, non-empty working directories (the `cwd` column) across all sessions, sorted ascending. Used to populate the cwd filter dropdown on the Sessions page. Always returns a 200 with a (possibly empty) array.",
      operationId: "listSessionFacets",
      responses: {
        200: {
          description: "Distinct session working directories",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionsFacetsResponse" },
              example: {
                cwds: [
                  "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
                  "/Users/son/code/another-project",
                ],
              },
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
};

module.exports = { tags, schemas, paths };
