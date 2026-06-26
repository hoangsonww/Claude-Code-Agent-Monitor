/**
 * @file Enriched OpenAPI OVERRIDE operations for the core read/ingest endpoints
 * that already exist in `server/openapi.js`:
 *
 *   GET  /api/events
 *   GET  /api/events/facets
 *   GET  /api/stats
 *   GET  /api/analytics
 *   POST /api/hooks/event
 *
 * These operations are intentionally CONTRACT-IDENTICAL to the base spec. Every
 * `operationId`, `tags` value, parameter name/`in`/schema, request-body `$ref`,
 * and response `$ref` is copied verbatim from `server/openapi.js`. The ONLY
 * additions here are richer prose `description`s, realistic per-parameter
 * `example`s, and realistic media-type `example`s on request/response bodies —
 * none of which change the wire contract.
 *
 * This module exports the override-merge surface expected by the spec builder:
 *   - `tags`:    [] (no new tags — reuse the base Events/Stats/Analytics/Hooks tags)
 *   - `schemas`: {} (no new schemas — reuse base `$ref`s only)
 *   - `paths`:   the enriched override operations keyed by path
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

// No new tags. The base operations already belong to the Events / Stats /
// Analytics / Hooks tags; overriding those tag arrays here would risk drift.
const tags = [];

// No new schemas. Every response and request body below reuses an existing
// `#/components/schemas/...` `$ref` defined in `server/openapi.js`.
const schemas = {};

const paths = {
  "/api/events": {
    get: {
      tags: ["Events"],
      summary: "List events with multi-dimensional filtering",
      operationId: "listEvents",
      description:
        "Returns a paginated, reverse-chronological slice of the `events` table " +
        "(ordered by `created_at DESC, id DESC`) together with the total row count " +
        "matching the active filters, so the UI can drive a paginator without a " +
        "second request.\n\n" +
        "All four entity filters — `event_type`, `tool_name`, `agent_id`, and " +
        "`session_id` — accept a **comma-separated list (CSV)** of values and match " +
        "with `IN (...)` semantics: passing `event_type=Stop,PreToolUse` returns rows " +
        "whose `event_type` is either `Stop` OR `PreToolUse`. Values are trimmed and " +
        "blank entries are dropped. Filters are combined with one another using AND.\n\n" +
        "`q` performs a case-insensitive substring (`LIKE %q%`) search across the " +
        "`summary`, `tool_name`, and the JSON-encoded `data` columns. `from`/`to` are " +
        "inclusive ISO-8601 datetime bounds on `created_at`; unparseable values are " +
        "ignored rather than rejected. `limit` is clamped to 1–500 (default 50) and " +
        "`offset` is clamped to >= 0 (default 0).\n\n" +
        "Note: each returned event's `data` field is a **JSON-encoded string**, not a " +
        "nested object — callers must `JSON.parse` it to inspect the payload.",
      parameters: [
        {
          in: "query",
          name: "event_type",
          description:
            "Comma-separated (CSV) list of `event_type` values; matched with IN semantics " +
            "(OR within the list). Common values: PreToolUse, PostToolUse, Stop, " +
            "SubagentStop, Notification, SessionStart, SessionEnd.",
          schema: { type: "string" },
          example: "Stop,PreToolUse",
        },
        {
          in: "query",
          name: "tool_name",
          description:
            "Comma-separated (CSV) list of `tool_name` values; matched with IN semantics " +
            "(OR within the list). Common values: Bash, Edit, Read, Write, Grep, Glob, Task.",
          schema: { type: "string" },
          example: "Bash,Edit",
        },
        {
          in: "query",
          name: "agent_id",
          description:
            "Comma-separated (CSV) list of `agent_id` values; matched with IN semantics. " +
            "The main agent of a session uses the id `<session_id>-main`.",
          schema: { type: "string" },
          example: "8f3c2a10-1b2c-4d5e-9f80-112233445566-main",
        },
        {
          in: "query",
          name: "session_id",
          description:
            "Comma-separated (CSV) list of `session_id` values; matched with IN semantics " +
            "(OR within the list).",
          schema: { type: "string" },
          example: "8f3c2a10-1b2c-4d5e-9f80-112233445566,2a7d9e44-3c1f-4a6b-bc20-aabbccddeeff",
        },
        {
          in: "query",
          name: "q",
          description:
            "Case-insensitive substring search (`LIKE %q%`) applied across the `summary`, " +
            "`tool_name`, and JSON-encoded `data` columns.",
          schema: { type: "string" },
          example: "curl",
        },
        {
          in: "query",
          name: "from",
          description:
            "ISO-8601 datetime lower bound (inclusive) on `created_at`. Unparseable values " +
            "are ignored.",
          schema: { type: "string", format: "date-time" },
          example: "2026-06-25T00:00:00.000Z",
        },
        {
          in: "query",
          name: "to",
          description:
            "ISO-8601 datetime upper bound (inclusive) on `created_at`. Unparseable values " +
            "are ignored.",
          schema: { type: "string", format: "date-time" },
          example: "2026-06-26T00:00:00.000Z",
        },
        {
          in: "query",
          name: "limit",
          description: "Max rows to return; clamped to 1–500 (default 50).",
          schema: { type: "integer", minimum: 1, maximum: 500, default: 50 },
          example: 50,
        },
        { $ref: "#/components/parameters/OffsetQuery" },
      ],
      responses: {
        200: {
          description: "Event list with total count for pagination",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventsListResponse" },
              example: {
                events: [
                  {
                    id: 48213,
                    session_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566",
                    agent_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566-main",
                    event_type: "PreToolUse",
                    tool_name: "Bash",
                    summary: "Bash: curl -s https://api.example.com/health",
                    data: '{"session_id":"8f3c2a10-1b2c-4d5e-9f80-112233445566","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"curl -s https://api.example.com/health","description":"Check upstream health"},"cwd":"/Users/dev/project"}',
                    created_at: "2026-06-25T18:42:07.512Z",
                  },
                  {
                    id: 48212,
                    session_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566",
                    agent_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566-main",
                    event_type: "Stop",
                    tool_name: null,
                    summary: "Session finished responding",
                    data: '{"session_id":"8f3c2a10-1b2c-4d5e-9f80-112233445566","hook_event_name":"Stop"}',
                    created_at: "2026-06-25T18:41:55.004Z",
                  },
                ],
                limit: 50,
                offset: 0,
                total: 1342,
              },
            },
          },
        },
      },
    },
  },
  "/api/events/facets": {
    get: {
      tags: ["Events"],
      summary: "Distinct event_type and tool_name values available in the DB",
      operationId: "listEventFacets",
      description:
        "Returns the distinct, non-null `event_type` and `tool_name` values currently " +
        "present in the `events` table, each sorted alphabetically. The UI uses this to " +
        "populate the filter dropdowns on the Events screen without hardcoding the set of " +
        "tools or hook types — so the lists automatically reflect whatever has actually " +
        "been ingested. Both arrays are independent and may be empty when the table holds " +
        "no matching rows.",
      responses: {
        200: {
          description: "Facet values for populating filter dropdowns",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EventsFacetsResponse" },
              example: {
                event_types: [
                  "Notification",
                  "PostToolUse",
                  "PreToolUse",
                  "SessionEnd",
                  "SessionStart",
                  "Stop",
                  "SubagentStop",
                ],
                tool_names: ["Bash", "Edit", "Glob", "Grep", "Read", "Task", "Write"],
              },
            },
          },
        },
      },
    },
  },
  "/api/stats": {
    get: {
      tags: ["Stats"],
      summary: "Get aggregate dashboard stats",
      operationId: "getStats",
      description:
        "Returns the headline counters shown across the top of the dashboard: total and " +
        "active session/agent counts, total event count, today's event count, and the " +
        "current number of live WebSocket connections.\n\n" +
        "The overview counters are spread at the top level of the response object. Two " +
        "additional maps, `agents_by_status` and `sessions_by_status`, break the counts " +
        "down by lifecycle status (e.g. agents: working/waiting/completed/error; sessions: " +
        "active/completed/error/abandoned). **Statuses with a zero count are omitted from " +
        "these maps**, so callers must not assume every status key is present.\n\n" +
        "`events_today` is computed in the caller's local day. Pass `tz_offset` as the " +
        "minutes value from JavaScript's `Date.prototype.getTimezoneOffset()` (for example " +
        "`420` for US Pacific Daylight Time, `300` for US Eastern Daylight Time, `0` for " +
        "UTC). When omitted or non-numeric, the server falls back to UTC (offset 0).",
      parameters: [
        {
          in: "query",
          name: "tz_offset",
          description:
            "Caller timezone offset in MINUTES, as returned by JS " +
            "`Date.prototype.getTimezoneOffset()` (e.g. 420 for PDT, 300 for EDT, 0 for " +
            "UTC). Used to bucket `events_today` into the caller's local day. Defaults to " +
            "0 (UTC) when omitted or non-numeric.",
          schema: { type: "integer" },
          example: 420,
        },
      ],
      responses: {
        200: {
          description: "Statistics overview",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StatsResponse" },
              example: {
                total_sessions: 184,
                active_sessions: 3,
                active_agents: 5,
                total_agents: 372,
                total_events: 28451,
                events_today: 612,
                ws_connections: 2,
                agents_by_status: {
                  working: 4,
                  waiting: 1,
                  completed: 360,
                  error: 7,
                },
                sessions_by_status: {
                  active: 3,
                  completed: 175,
                  error: 6,
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/analytics": {
    get: {
      tags: ["Analytics"],
      summary: "Get analytics aggregates",
      operationId: "getAnalytics",
      description:
        "Returns the full analytics rollup powering the Analytics screen: aggregate token " +
        "usage (`tokens`), total estimated spend across all sessions (`total_cost`, in USD, " +
        "computed from the configured pricing rules), per-tool invocation counts " +
        "(`tool_usage`), per-day event and session time series (`daily_events`, " +
        "`daily_sessions`), the distribution of subagent types (`agent_types`), per-type " +
        "event counts (`event_types`), the mean number of events per session " +
        "(`avg_events_per_session`), the total subagent count (`total_subagents`), and a " +
        "nested `overview` object mirroring the headline session/agent/event counters.\n\n" +
        "As with `/api/stats`, the top-level `agents_by_status` and `sessions_by_status` " +
        "maps **omit statuses whose count is zero**. The `agent_types[].subagent_type` field " +
        "may be `null` for the main agent / untyped subagents.\n\n" +
        "The daily time series are bucketed by the caller's local day. Pass `tz_offset` as " +
        "the minutes value from JS `Date.prototype.getTimezoneOffset()` (e.g. `420` for " +
        "PDT). When omitted or non-numeric, the server buckets in UTC.",
      parameters: [
        {
          in: "query",
          name: "tz_offset",
          description:
            "Caller timezone offset in MINUTES, as returned by JS " +
            "`Date.prototype.getTimezoneOffset()` (e.g. 420 for PDT, 300 for EDT, 0 for " +
            "UTC). Used to bucket the `daily_events` / `daily_sessions` time series into " +
            "the caller's local day. Defaults to UTC when omitted or non-numeric.",
          schema: { type: "integer" },
          example: 420,
        },
      ],
      responses: {
        200: {
          description: "Analytics response",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AnalyticsResponse" },
              example: {
                tokens: {
                  total_input: 4821002,
                  total_output: 1933517,
                  total_cache_read: 19288440,
                  total_cache_write: 2044120,
                },
                total_cost: 42.7183,
                tool_usage: [
                  { tool_name: "Bash", count: 5821 },
                  { tool_name: "Read", count: 4310 },
                  { tool_name: "Edit", count: 2980 },
                  { tool_name: "Grep", count: 1744 },
                ],
                daily_events: [
                  { date: "2026-06-23", count: 488 },
                  { date: "2026-06-24", count: 921 },
                  { date: "2026-06-25", count: 612 },
                ],
                daily_sessions: [
                  { date: "2026-06-23", count: 4 },
                  { date: "2026-06-24", count: 9 },
                  { date: "2026-06-25", count: 6 },
                ],
                agent_types: [
                  { subagent_type: null, count: 184 },
                  { subagent_type: "general-purpose", count: 96 },
                  { subagent_type: "Explore", count: 71 },
                  { subagent_type: "code-reviewer", count: 21 },
                ],
                event_types: [
                  { event_type: "PreToolUse", count: 14210 },
                  { event_type: "PostToolUse", count: 13988 },
                  { event_type: "Stop", count: 168 },
                  { event_type: "SubagentStop", count: 85 },
                ],
                avg_events_per_session: 154.6,
                total_subagents: 188,
                overview: {
                  total_sessions: 184,
                  active_sessions: 3,
                  active_agents: 5,
                  total_agents: 372,
                  total_events: 28451,
                },
                agents_by_status: {
                  working: 4,
                  waiting: 1,
                  completed: 360,
                  error: 7,
                },
                sessions_by_status: {
                  active: 3,
                  completed: 175,
                  error: 6,
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/hooks/event": {
    post: {
      tags: ["Hooks"],
      summary: "Ingest Claude Code hook event",
      operationId: "ingestHookEvent",
      description:
        "Primary ingestion endpoint for Claude Code lifecycle hooks. The hook handler posts " +
        "an envelope of the form `{ hook_type, data }`, where `hook_type` is the Claude " +
        "Code hook name (PreToolUse, PostToolUse, Stop, SubagentStop, Notification, " +
        "SessionStart, SessionEnd) and `data` carries the raw hook payload — at minimum a " +
        "`session_id`. The server upserts the session and its main agent on first sight, " +
        "applies the appropriate lifecycle state transition, extracts token usage and " +
        "compaction signals from the transcript when present, persists an `events` row " +
        "(storing `data` as a JSON-encoded string), and broadcasts a `new_event` message " +
        "over the WebSocket.\n\n" +
        "On success the response is `{ ok: true, event: { ... } }`, where `event` echoes " +
        "the normalized row that was just inserted (`session_id`, `agent_id`, `event_type`, " +
        "`tool_name`, `summary`, `created_at`). Ingestion is designed to be fail-safe and " +
        "non-blocking for the hook caller.\n\n" +
        "Validation failures return HTTP 400 with an `ErrorResponse` body " +
        "(`{ error: { code, message } }`): `INVALID_INPUT` when `hook_type` or `data` is " +
        "missing, and `MISSING_SESSION` when `data.session_id` is absent.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/HookEventRequest" },
            example: {
              hook_type: "PreToolUse",
              data: {
                session_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566",
                hook_event_name: "PreToolUse",
                tool_name: "Bash",
                tool_input: {
                  command: "curl -s https://api.example.com/health",
                  description: "Check upstream health",
                },
                cwd: "/Users/dev/project",
                transcript_path:
                  "/Users/dev/.claude/projects/-Users-dev-project/8f3c2a10-1b2c-4d5e-9f80-112233445566.jsonl",
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Event processed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/HookEventResponse" },
              example: {
                ok: true,
                event: {
                  session_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566",
                  agent_id: "8f3c2a10-1b2c-4d5e-9f80-112233445566-main",
                  event_type: "PreToolUse",
                  tool_name: "Bash",
                  summary: "Bash: curl -s https://api.example.com/health",
                  created_at: "2026-06-25T18:42:07.512Z",
                },
              },
            },
          },
        },
        400: {
          description: "Invalid hook payload",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: {
                error: {
                  code: "MISSING_SESSION",
                  message: "session_id is required in data",
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
