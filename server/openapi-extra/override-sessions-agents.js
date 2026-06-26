/**
 * @file Enriched OVERRIDE fragments for the already-documented Sessions and
 * Agents endpoints. These paths exist in the base spec (server/openapi.js); the
 * loader (server/openapi-extra.js) merges `paths` with override-on-key
 * semantics, so the operations below REPLACE the terser base versions while
 * preserving their contract: same `operationId`, same `tags`, and the same
 * request/response `$ref` schema names. The only additions are richer
 * `description`s and realistic `example`s on every parameter, response media
 * type, and request body — purely documentation, no contract change.
 *
 * No new schemas are defined here (`schemas` is empty by design); everything
 * reuses the base `components.schemas` and `components.parameters`. Error
 * responses keep referencing the base `ErrorResponse` ({ error: { code,
 * message } }). The Sessions/Agents tags are already declared in the base
 * literal, so `tags` is intentionally empty.
 *
 * Covers:
 *   - GET   /api/sessions                       (listSessions)
 *   - POST  /api/sessions                       (createSession)
 *   - GET   /api/sessions/{id}                  (getSession)
 *   - PATCH /api/sessions/{id}                  (updateSession)
 *   - GET   /api/sessions/{id}/stats            (getSessionStats)
 *   - GET   /api/sessions/{id}/transcripts      (listSessionTranscripts)
 *   - GET   /api/sessions/{id}/transcript       (getSessionTranscript)
 *   - GET   /api/agents                         (listAgents)
 *   - POST  /api/agents                         (createAgent)
 *   - GET   /api/agents/{id}                     (getAgent)
 *   - PATCH /api/agents/{id}                     (updateAgent)
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [];

const schemas = {};

// --- Reusable realistic example fixtures ----------------------------------
// Keep these consistent with the route handlers in server/routes/sessions.js
// and server/routes/agents.js. Timestamps are ISO-8601 UTC with millisecond
// precision; metadata is a raw JSON-encoded string (the DB column is TEXT).

const exampleSession = {
  id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
  name: "Refactor pricing route + add cost endpoint",
  status: "active",
  cwd: "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
  model: "claude-opus-4-20250514",
  started_at: "2026-06-25T14:02:11.004Z",
  ended_at: null,
  metadata: '{"source":"hook","git_branch":"feat/spend-budgets"}',
  updated_at: "2026-06-25T14:31:50.119Z",
  agent_count: 4,
  last_activity: "2026-06-25T14:31:50.119Z",
  cost: 0.8421,
  awaiting_input_since: null,
};

const exampleCompletedSession = {
  id: "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9",
  name: "Fix flaky transcript pagination test",
  status: "completed",
  cwd: "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
  model: "claude-sonnet-4-20250514",
  started_at: "2026-06-24T09:12:00.000Z",
  ended_at: "2026-06-24T09:48:32.501Z",
  metadata: null,
  updated_at: "2026-06-24T09:48:32.501Z",
  agent_count: 1,
  last_activity: "2026-06-24T09:48:32.501Z",
  cost: 0.1532,
  awaiting_input_since: null,
};

const exampleMainAgent = {
  id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d-main",
  session_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
  name: "Main Agent",
  type: "main",
  subagent_type: null,
  status: "working",
  task: null,
  current_tool: "Edit",
  started_at: "2026-06-25T14:02:11.004Z",
  ended_at: null,
  parent_agent_id: null,
  metadata: '{"model":"claude-opus-4-20250514"}',
  updated_at: "2026-06-25T14:31:50.119Z",
  awaiting_input_since: null,
};

const exampleSubagent = {
  id: "ad18a79192af10ed1",
  session_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
  name: "Explore pricing module",
  type: "subagent",
  subagent_type: "Explore",
  status: "completed",
  task: "Map every caller of calculateCost() across server/routes",
  current_tool: null,
  started_at: "2026-06-25T14:10:22.310Z",
  ended_at: "2026-06-25T14:14:09.882Z",
  parent_agent_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d-main",
  metadata: null,
  updated_at: "2026-06-25T14:14:09.882Z",
  awaiting_input_since: null,
};

const exampleEvent = {
  id: 48213,
  session_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
  agent_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d-main",
  event_type: "PostToolUse",
  tool_name: "Edit",
  summary: "Edited server/routes/pricing.js",
  data: '{"tool_input":{"file_path":"server/routes/pricing.js"},"tool_response":{"success":true}}',
  created_at: "2026-06-25T14:31:50.119Z",
};

const paths = {
  "/api/sessions": {
    get: {
      tags: ["Sessions"],
      summary: "List sessions",
      description:
        "Returns a paginated list of sessions, newest activity first, each enriched with a SQL `agent_count` (LEFT JOIN onto agents), a `last_activity` alias of `updated_at`, and a `cost` computed from the session's token usage against the current pricing rules. The `status` and `q` filters compose (AND) with each other and with pagination; `q` is a case-insensitive LIKE across `id`, `name`, and `cwd`. `total` reflects all rows matching the filters independent of `limit`/`offset` so paginators stay accurate, while `cost` is only calculated for the rows on the returned page (when `sort_by=price` it is computed across all matching rows so the price sort is correct). The endpoint is read-only with no side effects; `metadata` on each session is returned as a raw JSON-encoded string, not a parsed object.",
      operationId: "listSessions",
      parameters: [
        { $ref: "#/components/parameters/SessionStatusQuery", example: "active" },
        {
          name: "q",
          in: "query",
          schema: { type: "string" },
          description:
            "Case-insensitive search across `id` / `name` / `cwd`. Composes with the status filter when both are present.",
          example: "pricing",
        },
        { $ref: "#/components/parameters/LimitQuery", example: 50 },
        { $ref: "#/components/parameters/OffsetQuery", example: 0 },
      ],
      responses: {
        200: {
          description: "Session list",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionsListResponse" },
              example: {
                sessions: [exampleSession, exampleCompletedSession],
                limit: 50,
                offset: 0,
                total: 137,
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Sessions"],
      summary: "Create session (idempotent)",
      description:
        'Creates a session keyed by `id`. The operation is idempotent: if a session with that `id` already exists it is returned untouched with `created: false` and HTTP 200; only a brand-new row yields `created: true` and HTTP 201. New sessions are inserted with `status: "active"` and any omitted optional fields stored as null. The `metadata` field is accepted as a JSON object in the request but persisted (and returned on the session) as a JSON-encoded string. A successful create broadcasts a `session_created` websocket frame. A missing `id` returns 400 with code `INVALID_INPUT`.',
      operationId: "createSession",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SessionCreateRequest" },
            example: {
              id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
              name: "Refactor pricing route + add cost endpoint",
              cwd: "/Users/son/WebstormProjects/Claude-Code-Agent-Monitor",
              model: "claude-opus-4-20250514",
              metadata: { source: "hook", git_branch: "feat/spend-budgets" },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Session created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionCreateResponse" },
              example: {
                session: {
                  ...exampleSession,
                  agent_count: 0,
                  cost: 0,
                  last_activity: "2026-06-25T14:02:11.004Z",
                  updated_at: "2026-06-25T14:02:11.004Z",
                },
                created: true,
              },
            },
          },
        },
        200: {
          description: "Session already exists",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionCreateResponse" },
              example: {
                session: exampleSession,
                created: false,
              },
            },
          },
        },
        400: {
          description: "Invalid request body",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "INVALID_INPUT", message: "id is required" } },
            },
          },
        },
      },
    },
  },
  "/api/sessions/{id}": {
    get: {
      tags: ["Sessions"],
      summary: "Get session details",
      description:
        "Returns a single session together with all of its agents (chronological) and persisted events. Read-only, no side effects. The session's `metadata` and each event's `data` are returned as raw JSON-encoded strings, not parsed objects. Returns 404 with code `NOT_FOUND` when no session matches the path `id`.",
      operationId: "getSession",
      parameters: [
        {
          $ref: "#/components/parameters/SessionIdPath",
          example: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
        },
      ],
      responses: {
        200: {
          description: "Session with associated agents/events",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionDetailResponse" },
              example: {
                session: exampleSession,
                agents: [exampleMainAgent, exampleSubagent],
                events: [exampleEvent],
              },
            },
          },
        },
        404: {
          description: "Session not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Session not found" } },
            },
          },
        },
      },
    },
    patch: {
      tags: ["Sessions"],
      summary: "Update session",
      description:
        "Partially updates a session by `id`. Only `name`, `status`, `ended_at`, and `metadata` are accepted; any field omitted from the body is passed as null and the underlying UPDATE uses COALESCE, so a null leaves the existing column value unchanged (partial-update semantics) — you cannot clear a field to null through this endpoint. `metadata` is supplied as a JSON object but stored and returned as a JSON-encoded string. A successful update re-reads the row and broadcasts a `session_updated` websocket frame. Returns 404 with code `NOT_FOUND` when the session does not exist.",
      operationId: "updateSession",
      parameters: [
        {
          $ref: "#/components/parameters/SessionIdPath",
          example: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SessionUpdateRequest" },
            example: {
              status: "completed",
              ended_at: "2026-06-25T15:07:44.220Z",
              metadata: { source: "hook", git_branch: "feat/spend-budgets", outcome: "merged" },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Session updated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionUpdateResponse" },
              example: {
                session: {
                  ...exampleSession,
                  status: "completed",
                  ended_at: "2026-06-25T15:07:44.220Z",
                  metadata:
                    '{"source":"hook","git_branch":"feat/spend-budgets","outcome":"merged"}',
                  updated_at: "2026-06-25T15:07:44.220Z",
                  last_activity: "2026-06-25T15:07:44.220Z",
                },
              },
            },
          },
        },
        404: {
          description: "Session not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Session not found" } },
            },
          },
        },
      },
    },
  },
  "/api/sessions/{id}/stats": {
    get: {
      tags: ["Sessions"],
      summary: "Get aggregated session stats",
      description:
        "Returns aggregated counts for the SessionOverview panel: total events, events-by-type, the top 15 tools by usage, an error count (events whose `event_type`/`summary` match /error/i or /failed/i), the event time range, agent type/status counts, the subagent-type breakdown (excluding the special `compaction` type, which is surfaced under `agents.compaction`), and token totals. All aggregation runs in SQL, so it stays cheap even for sessions with tens of thousands of events; the endpoint is read-only with no side effects. The frontend debounces calls on `new_event` / `agent_*` / `session_updated` websocket frames so the counters track a running session. Returns 404 with code `NOT_FOUND` when the session does not exist.",
      operationId: "getSessionStats",
      parameters: [
        {
          $ref: "#/components/parameters/SessionIdPath",
          example: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
        },
      ],
      responses: {
        200: {
          description: "Aggregated session stats",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SessionStatsResponse" },
              example: {
                session_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
                total_events: 1284,
                events_by_type: [
                  { event_type: "PostToolUse", count: 612 },
                  { event_type: "PreToolUse", count: 612 },
                  { event_type: "Notification", count: 41 },
                  { event_type: "Stop", count: 19 },
                ],
                tools_used: [
                  { tool_name: "Bash", count: 188 },
                  { tool_name: "Edit", count: 143 },
                  { tool_name: "Read", count: 121 },
                  { tool_name: "Grep", count: 77 },
                ],
                error_count: 6,
                first_event_at: "2026-06-25T14:02:11.052Z",
                last_event_at: "2026-06-25T14:31:50.119Z",
                agents: {
                  total: 4,
                  main: 1,
                  subagent: 3,
                  compaction: 1,
                  by_status: { working: 1, completed: 2, error: 1 },
                },
                subagent_types: [
                  { subagent_type: "Explore", count: 2 },
                  { subagent_type: "general-purpose", count: 1 },
                ],
                tokens: {
                  input_tokens: 18422,
                  output_tokens: 9134,
                  cache_read_tokens: 1204880,
                  cache_write_tokens: 88210,
                },
              },
            },
          },
        },
        404: {
          description: "Session not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Session not found" } },
            },
          },
        },
      },
    },
  },
  "/api/sessions/{id}/transcripts": {
    get: {
      tags: ["Sessions"],
      summary: "List available transcripts for a session",
      description:
        "Lists every JSONL transcript file associated with a session — the main agent's transcript plus any subagent and compaction transcripts — by scanning the on-disk Claude project directory (live files, falling back to import-time snapshots). Read-only, no side effects. Each entry carries a best-effort `db_agent_id` resolved by matching transcripts to tracked agents (exact id first, then positional-by-time within each type group); it may be null when a transcript has no matching agent row. Used by the Conversation tab to populate the transcript switcher. Returns 404 with code `NOT_FOUND` when the session does not exist.",
      operationId: "listSessionTranscripts",
      parameters: [
        {
          $ref: "#/components/parameters/SessionIdPath",
          example: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
        },
      ],
      responses: {
        200: {
          description: "List of transcripts available for the session",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TranscriptListResponse" },
              example: {
                transcripts: [
                  {
                    id: "main",
                    name: "Main Agent",
                    type: "main",
                    has_transcript: true,
                    db_agent_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d-main",
                  },
                  {
                    id: "ad18a79192af10ed1",
                    name: "Explore pricing module",
                    type: "subagent",
                    subagent_type: "Explore",
                    has_transcript: true,
                    db_agent_id: "ad18a79192af10ed1",
                  },
                  {
                    id: "acompact-7c1e2f90",
                    name: "Context Compaction",
                    type: "compaction",
                    subagent_type: null,
                    has_transcript: true,
                    db_agent_id: null,
                  },
                ],
              },
            },
          },
        },
        404: {
          description: "Session not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Session not found" } },
            },
          },
        },
      },
    },
  },
  "/api/sessions/{id}/transcript": {
    get: {
      tags: ["Sessions"],
      summary: "Stream messages from a specific transcript",
      description:
        "Returns parsed, renderable messages from a JSONL transcript with cursor-based pagination, reading the live file under ~/.claude/projects and falling back to the durable import-time snapshot. Pass `agent_id` to select a specific subagent or compaction transcript (default is the session's main transcript). Pagination cursors are mutually exclusive: `after` returns messages strictly newer than a JSONL line number (incremental live updates on `new_event`), `before` returns messages strictly older than a line (load-on-scroll-up), and `offset` is legacy start-offset paging. `last_line`/`first_line` are the JSONL line numbers of the newest/oldest returned message — feed them back as `after`/`before`. When the session, transcript file, or path cannot be found the endpoint degrades gracefully to an empty result (`messages: []`, `total: 0`, `has_more: false`) rather than erroring. Read-only, no side effects.",
      operationId: "getSessionTranscript",
      parameters: [
        {
          $ref: "#/components/parameters/SessionIdPath",
          example: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
        },
        {
          name: "agent_id",
          in: "query",
          schema: { type: "string" },
          description:
            "Transcript identifier — 'main' for the session's main transcript, or a subagent / compaction id from /transcripts.",
          example: "main",
        },
        {
          name: "limit",
          in: "query",
          schema: { type: "integer", default: 50, minimum: 1, maximum: 500 },
          description: "Maximum number of messages to return.",
          example: 50,
        },
        {
          name: "offset",
          in: "query",
          schema: { type: "integer", minimum: 0 },
          description:
            "Offset from the start of the transcript (mutually exclusive with after/before).",
          example: 0,
        },
        {
          name: "after",
          in: "query",
          schema: { type: "integer", minimum: 0 },
          description:
            "Only return messages whose JSONL line number is strictly greater than this value. Used for incremental live updates.",
          example: 842,
        },
        {
          name: "before",
          in: "query",
          schema: { type: "integer", minimum: 0 },
          description:
            "Only return messages whose JSONL line number is strictly less than this value. Used to load older messages on scroll-up.",
          example: 200,
        },
      ],
      responses: {
        200: {
          description: "Parsed messages with cursor metadata",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TranscriptResponse" },
              example: {
                messages: [
                  {
                    type: "user",
                    timestamp: "2026-06-25T14:02:11.004Z",
                    content: [
                      { type: "text", text: "Refactor the pricing route and add a cost endpoint." },
                    ],
                  },
                  {
                    type: "assistant",
                    timestamp: "2026-06-25T14:02:18.771Z",
                    model: "claude-opus-4-20250514",
                    content: [
                      { type: "thinking", text: "I'll start by reading server/routes/pricing.js." },
                      {
                        type: "tool_use",
                        name: "Read",
                        id: "toolu_01A7c2Df9",
                        input: { file_path: "server/routes/pricing.js" },
                      },
                    ],
                    usage: { input_tokens: 412, output_tokens: 96 },
                  },
                  {
                    type: "user",
                    timestamp: "2026-06-25T14:02:19.330Z",
                    content: [
                      {
                        type: "tool_result",
                        id: "toolu_01A7c2Df9",
                        output: 'const { Router } = require("express");\n...',
                        is_error: false,
                      },
                    ],
                  },
                ],
                total: 1284,
                has_more: true,
                last_line: 5310,
                first_line: 5301,
              },
            },
          },
        },
        404: {
          description: "Session or transcript not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Session not found" } },
            },
          },
        },
      },
    },
  },
  "/api/agents": {
    get: {
      tags: ["Agents"],
      summary: "List agents",
      description:
        "Returns agents, most recent first. Filters are applied with precedence rather than composition: when `session_id` is supplied it wins and returns every agent for that session (ignoring `status` and pagination); otherwise a `status` filter returns paginated agents in that lifecycle state; otherwise all agents are returned paginated. `limit` defaults to 10000 when not a positive integer. Read-only, no side effects. Each agent's `metadata` is returned as a raw JSON-encoded string, not a parsed object.",
      operationId: "listAgents",
      parameters: [
        { $ref: "#/components/parameters/AgentStatusQuery", example: "working" },
        {
          $ref: "#/components/parameters/SessionFilterQuery",
          example: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
        },
        { $ref: "#/components/parameters/LimitQuery", example: 50 },
        { $ref: "#/components/parameters/OffsetQuery", example: 0 },
      ],
      responses: {
        200: {
          description: "Agent list",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentsListResponse" },
              example: {
                agents: [exampleMainAgent, exampleSubagent],
                limit: 50,
                offset: 0,
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Agents"],
      summary: "Create agent (idempotent)",
      description:
        'Creates an agent keyed by `id`. The operation is idempotent: if an agent with that `id` already exists it is returned untouched with `created: false` and HTTP 200; only a brand-new row yields `created: true` and HTTP 201. Omitted optional fields default server-side — `type` to `"main"`, `status` to `"waiting"` — and other unspecified columns are stored as null. `metadata` is accepted as a JSON object but persisted (and returned) as a JSON-encoded string. A successful create broadcasts an `agent_created` websocket frame. Missing `id`, `session_id`, or `name` returns 400 with code `INVALID_INPUT`.',
      operationId: "createAgent",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AgentCreateRequest" },
            example: {
              id: "ad18a79192af10ed1",
              session_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d",
              name: "Explore pricing module",
              type: "subagent",
              subagent_type: "Explore",
              status: "working",
              task: "Map every caller of calculateCost() across server/routes",
              parent_agent_id: "b7f3a2c1-4e5d-4a8b-9c2f-1d6e8a0b3c4d-main",
              metadata: { spawned_by: "Task" },
            },
          },
        },
      },
      responses: {
        201: {
          description: "Agent created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentCreateResponse" },
              example: {
                agent: {
                  ...exampleSubagent,
                  status: "working",
                  ended_at: null,
                  metadata: '{"spawned_by":"Task"}',
                  updated_at: "2026-06-25T14:10:22.310Z",
                },
                created: true,
              },
            },
          },
        },
        200: {
          description: "Agent already exists",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentCreateResponse" },
              example: {
                agent: exampleSubagent,
                created: false,
              },
            },
          },
        },
        400: {
          description: "Invalid request body",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: { code: "INVALID_INPUT", message: "id, session_id, and name are required" },
              },
            },
          },
        },
      },
    },
  },
  "/api/agents/{id}": {
    get: {
      tags: ["Agents"],
      summary: "Get agent",
      description:
        "Returns a single agent by `id`. Read-only, no side effects. The agent's `metadata` is returned as a raw JSON-encoded string, not a parsed object. Returns 404 with code `NOT_FOUND` when no agent matches the path `id`.",
      operationId: "getAgent",
      parameters: [{ $ref: "#/components/parameters/AgentIdPath", example: "ad18a79192af10ed1" }],
      responses: {
        200: {
          description: "Agent details",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentDetailResponse" },
              example: { agent: exampleSubagent },
            },
          },
        },
        404: {
          description: "Agent not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Agent not found" } },
            },
          },
        },
      },
    },
    patch: {
      tags: ["Agents"],
      summary: "Update agent",
      description:
        "Partially updates an agent by `id`. Accepts `name`, `status`, `task`, `current_tool`, `ended_at`, and `metadata`. The UPDATE uses COALESCE, so any field omitted (passed as null) leaves the existing column value unchanged — with one deliberate exception: `current_tool` is written through verbatim when present in the body, so it can be explicitly cleared to null (e.g. when a tool call finishes). `metadata` is supplied as a JSON object but stored and returned as a JSON-encoded string. A successful update re-reads the row and broadcasts an `agent_updated` websocket frame. Returns 404 with code `NOT_FOUND` when the agent does not exist.",
      operationId: "updateAgent",
      parameters: [{ $ref: "#/components/parameters/AgentIdPath", example: "ad18a79192af10ed1" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AgentUpdateRequest" },
            example: {
              status: "completed",
              current_tool: null,
              ended_at: "2026-06-25T14:14:09.882Z",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Agent updated",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AgentUpdateResponse" },
              example: {
                agent: {
                  ...exampleSubagent,
                  status: "completed",
                  current_tool: null,
                  ended_at: "2026-06-25T14:14:09.882Z",
                  updated_at: "2026-06-25T14:14:09.882Z",
                },
              },
            },
          },
        },
        404: {
          description: "Agent not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "NOT_FOUND", message: "Agent not found" } },
            },
          },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
