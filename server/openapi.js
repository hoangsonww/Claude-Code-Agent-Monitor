/**
 * @file Central OpenAPI 3.0 specification for the dashboard HTTP API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const pkg = require("../package.json");
const extraSpec = require("./openapi-extra");

function normalizeRepositoryUrl(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^git\+/, "").replace(/\.git$/, "");
}

/**
 * Merge supplementary tags/schemas/paths (from server/openapi-extra) into the
 * base spec. Extra `paths` and `schemas` override base entries with the same
 * key; `tags` are appended only when a tag with that `name` isn't already
 * present. Mutates and returns `spec`.
 */
function mergeExtraSpec(spec, extra) {
  if (!extra) return spec;
  if (Array.isArray(extra.tags) && extra.tags.length > 0) {
    const have = new Set((spec.tags || []).map((t) => t && t.name));
    for (const tag of extra.tags) {
      if (tag && !have.has(tag.name)) spec.tags.push(tag);
    }
  }
  if (extra.schemas) {
    spec.components.schemas = { ...spec.components.schemas, ...extra.schemas };
  }
  if (extra.paths) {
    spec.paths = { ...spec.paths, ...extra.paths };
  }
  return spec;
}

function createOpenApiSpec() {
  const repositoryUrl = normalizeRepositoryUrl(pkg.repository?.url);
  const issuesUrl =
    typeof pkg.bugs?.url === "string" && pkg.bugs.url.length > 0
      ? pkg.bugs.url
      : repositoryUrl
        ? `${repositoryUrl}/issues`
        : null;
  const defaultPort = Number.parseInt(process.env.DASHBOARD_PORT || "4820", 10) || 4820;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Agent Dashboard for Claude Code API",
      version: pkg.version || "1.0.0",
      description:
        "HTTP API for real-time Claude Code session monitoring, agent lifecycle tracking, analytics, pricing, hooks ingestion, and workflow intelligence.",
      contact: {
        name: "Son Nguyen",
        email: "hoangson091104@gmail.com",
        ...(repositoryUrl ? { url: repositoryUrl } : {}),
      },
      license: {
        name: pkg.license || "MIT",
        ...(repositoryUrl ? { url: `${repositoryUrl}/blob/main/LICENSE` } : {}),
      },
    },
    externalDocs: repositoryUrl
      ? {
          description: "Project documentation",
          url: `${repositoryUrl}#readme`,
        }
      : undefined,
    servers: [
      {
        url: `http://localhost:${defaultPort}`,
        description: "Local dashboard server (default)",
      },
      {
        url: "http://127.0.0.1:4820",
        description: "Local loopback endpoint used by hook-handler",
      },
    ],
    tags: [
      { name: "Health", description: "Service liveness checks" },
      { name: "Sessions", description: "Claude Code session lifecycle" },
      { name: "Agents", description: "Main/subagent records and status" },
      { name: "Events", description: "Event stream persistence" },
      { name: "Stats", description: "High-level dashboard counters" },
      { name: "Analytics", description: "Aggregated analytics views" },
      { name: "Hooks", description: "Claude hook ingestion endpoint" },
      { name: "Pricing", description: "Model pricing and token cost calculations" },
      { name: "Workflows", description: "Workflow intelligence and session drill-in" },
      { name: "Settings", description: "Operational maintenance endpoints" },
      {
        name: "Updates",
        description:
          "Detect upstream git changes so users can pull and restart manually (local dashboard installs)",
      },
      {
        name: "Alerts",
        description: "Rules-based alerting: rule CRUD, fired-alert feed, acknowledgement",
      },
      {
        name: "Webhooks",
        description:
          "Universal webhook delivery for fired alerts: target CRUD (Slack/Discord/Teams/generic), test probe, and delivery log. Secrets are never returned.",
      },
      { name: "Documentation", description: "OpenAPI/Swagger endpoints" },
    ],
    components: {
      parameters: {
        SessionIdPath: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Session ID",
        },
        AgentIdPath: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Agent ID",
        },
        PatternPath: {
          name: "pattern",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "Model pattern (URL-encoded)",
        },
        LimitQuery: {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 0 },
          description: "Page size",
        },
        OffsetQuery: {
          name: "offset",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 0 },
          description: "Pagination offset",
        },
        SessionStatusQuery: {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["active", "completed", "error", "abandoned"],
          },
          description: "Filter by session status",
        },
        AgentStatusQuery: {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["working", "waiting", "completed", "error"],
          },
          description: "Filter by agent status",
        },
        SessionFilterQuery: {
          name: "session_id",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Filter by session ID",
        },
        WorkflowStatusQuery: {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["all", "active", "completed", "error", "abandoned"],
          },
          description: "Filter workflow aggregates by session status",
        },
      },
      schemas: {
        ErrorObject: {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { $ref: "#/components/schemas/ErrorObject" },
          },
        },
        MessageErrorObject: {
          type: "object",
          required: ["message"],
          properties: { message: { type: "string" } },
        },
        MessageErrorResponse: {
          type: "object",
          required: ["error"],
          properties: { error: { $ref: "#/components/schemas/MessageErrorObject" } },
        },
        CountMap: {
          type: "object",
          additionalProperties: { type: "integer" },
        },
        Session: {
          type: "object",
          required: ["id", "status", "started_at", "updated_at"],
          properties: {
            id: { type: "string" },
            name: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["active", "completed", "error", "abandoned"],
            },
            cwd: { type: "string", nullable: true },
            model: { type: "string", nullable: true },
            started_at: { type: "string", format: "date-time" },
            ended_at: { type: "string", format: "date-time", nullable: true },
            metadata: {
              type: "string",
              nullable: true,
              description: "JSON-encoded session metadata",
            },
            updated_at: { type: "string", format: "date-time" },
            agent_count: { type: "integer", nullable: true },
            last_activity: { type: "string", format: "date-time", nullable: true },
            cost: { type: "number", nullable: true },
            awaiting_input_since: {
              type: "string",
              format: "date-time",
              nullable: true,
              description:
                "ISO timestamp set when Claude Code is blocked waiting for the user (permission prompt or input request). Null when not waiting; cleared on the next non-Notification hook event.",
            },
          },
        },
        Agent: {
          type: "object",
          required: ["id", "session_id", "name", "type", "status", "started_at", "updated_at"],
          properties: {
            id: { type: "string" },
            session_id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["main", "subagent"] },
            subagent_type: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["working", "waiting", "completed", "error"],
            },
            task: { type: "string", nullable: true },
            current_tool: { type: "string", nullable: true },
            started_at: { type: "string", format: "date-time" },
            ended_at: { type: "string", format: "date-time", nullable: true },
            parent_agent_id: { type: "string", nullable: true },
            metadata: {
              type: "string",
              nullable: true,
              description: "JSON-encoded agent metadata",
            },
            updated_at: { type: "string", format: "date-time" },
            awaiting_input_since: {
              type: "string",
              format: "date-time",
              nullable: true,
              description:
                "ISO timestamp set when this agent is blocked waiting for user input. Cleared on the next non-Notification hook event for the session.",
            },
          },
        },
        DashboardEvent: {
          type: "object",
          required: ["session_id", "event_type", "created_at"],
          properties: {
            id: { type: "integer", nullable: true },
            session_id: { type: "string" },
            agent_id: { type: "string", nullable: true },
            event_type: { type: "string" },
            tool_name: { type: "string", nullable: true },
            summary: { type: "string", nullable: true },
            data: {
              type: "string",
              nullable: true,
              description: "JSON-encoded event payload",
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
        HealthResponse: {
          type: "object",
          required: ["status", "timestamp"],
          properties: {
            status: { type: "string", enum: ["ok"] },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        SessionsListResponse: {
          type: "object",
          required: ["sessions", "limit", "offset", "total"],
          properties: {
            sessions: { type: "array", items: { $ref: "#/components/schemas/Session" } },
            limit: { type: "integer" },
            offset: { type: "integer" },
            total: {
              type: "integer",
              description:
                "Total sessions matching the filters (independent of limit/offset). Used by paginators.",
            },
          },
        },
        SessionCreateRequest: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            cwd: { type: "string" },
            model: { type: "string" },
            metadata: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        SessionCreateResponse: {
          type: "object",
          required: ["session", "created"],
          properties: {
            session: { $ref: "#/components/schemas/Session" },
            created: { type: "boolean" },
          },
        },
        SessionDetailResponse: {
          type: "object",
          required: ["session", "agents", "events"],
          properties: {
            session: { $ref: "#/components/schemas/Session" },
            agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
            events: { type: "array", items: { $ref: "#/components/schemas/DashboardEvent" } },
          },
        },
        TranscriptInfo: {
          type: "object",
          required: ["id", "name", "type", "has_transcript"],
          properties: {
            id: {
              type: "string",
              description:
                "'main' for the session's main transcript, otherwise a subagent or compaction id.",
            },
            name: { type: "string" },
            type: { type: "string", enum: ["main", "subagent", "compaction"] },
            subagent_type: { type: "string", nullable: true },
            has_transcript: { type: "boolean" },
            db_agent_id: {
              type: "string",
              nullable: true,
              description:
                "Foreign key into agents.id when this transcript belongs to a tracked subagent.",
            },
          },
        },
        TranscriptListResponse: {
          type: "object",
          required: ["transcripts"],
          properties: {
            transcripts: {
              type: "array",
              items: { $ref: "#/components/schemas/TranscriptInfo" },
            },
          },
        },
        TranscriptContent: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: ["text", "tool_use", "tool_result", "thinking"],
            },
            text: { type: "string" },
            name: { type: "string", description: "Tool name when type === tool_use." },
            id: {
              type: "string",
              description: "Tool-use id used to pair tool_use with tool_result.",
            },
            input: {
              description: "Tool input payload (object) or { _truncated: string } when oversized.",
              oneOf: [{ type: "object", additionalProperties: true }, { type: "string" }],
            },
            output: { type: "string", description: "Tool output text when type === tool_result." },
            is_error: { type: "boolean" },
          },
        },
        TranscriptMessage: {
          type: "object",
          required: ["type", "content"],
          properties: {
            type: { type: "string", enum: ["user", "assistant"] },
            timestamp: { type: "string", format: "date-time", nullable: true },
            content: {
              type: "array",
              items: { $ref: "#/components/schemas/TranscriptContent" },
            },
            model: { type: "string" },
            usage: {
              type: "object",
              properties: {
                input_tokens: { type: "integer", minimum: 0 },
                output_tokens: { type: "integer", minimum: 0 },
              },
            },
          },
        },
        TranscriptResponse: {
          type: "object",
          required: ["messages", "total", "has_more", "last_line", "first_line"],
          properties: {
            messages: {
              type: "array",
              items: { $ref: "#/components/schemas/TranscriptMessage" },
            },
            total: {
              type: "integer",
              minimum: 0,
              description: "Total messages available in the transcript.",
            },
            has_more: {
              type: "boolean",
              description: "True when older messages remain (use `before` to load them).",
            },
            last_line: {
              type: "integer",
              minimum: 0,
              description:
                "JSONL line number of the newest returned message — pass back as `after` for incremental fetches.",
            },
            first_line: {
              type: "integer",
              minimum: 0,
              description:
                "JSONL line number of the oldest returned message — pass back as `before` to page backwards.",
            },
          },
        },
        SessionStatsResponse: {
          type: "object",
          description:
            "Aggregated counts powering the SessionOverview panel on the Session Detail page. All aggregation runs in SQL.",
          required: [
            "session_id",
            "total_events",
            "events_by_type",
            "tools_used",
            "error_count",
            "first_event_at",
            "last_event_at",
            "agents",
            "subagent_types",
            "tokens",
          ],
          properties: {
            session_id: { type: "string" },
            total_events: { type: "integer", minimum: 0 },
            events_by_type: {
              type: "array",
              items: {
                type: "object",
                required: ["event_type", "count"],
                properties: {
                  event_type: { type: "string" },
                  count: { type: "integer", minimum: 0 },
                },
              },
            },
            tools_used: {
              type: "array",
              description: "Top 15 tools used in this session, sorted by count descending.",
              items: {
                type: "object",
                required: ["tool_name", "count"],
                properties: {
                  tool_name: { type: "string" },
                  count: { type: "integer", minimum: 0 },
                },
              },
            },
            error_count: {
              type: "integer",
              minimum: 0,
              description:
                "Events whose event_type or summary matches /error/i or /failed/i (case-insensitive).",
            },
            first_event_at: { type: "string", format: "date-time", nullable: true },
            last_event_at: { type: "string", format: "date-time", nullable: true },
            agents: {
              type: "object",
              required: ["total", "main", "subagent", "compaction", "by_status"],
              properties: {
                total: { type: "integer", minimum: 0 },
                main: { type: "integer", minimum: 0 },
                subagent: { type: "integer", minimum: 0 },
                compaction: { type: "integer", minimum: 0 },
                by_status: {
                  type: "object",
                  additionalProperties: { type: "integer", minimum: 0 },
                },
              },
            },
            subagent_types: {
              type: "array",
              description:
                "Subagent types in this session with counts. Excludes the special 'compaction' type which is surfaced via agents.compaction.",
              items: {
                type: "object",
                required: ["subagent_type", "count"],
                properties: {
                  subagent_type: { type: "string" },
                  count: { type: "integer", minimum: 0 },
                },
              },
            },
            tokens: {
              type: "object",
              required: [
                "input_tokens",
                "output_tokens",
                "cache_read_tokens",
                "cache_write_tokens",
              ],
              properties: {
                input_tokens: { type: "integer", minimum: 0 },
                output_tokens: { type: "integer", minimum: 0 },
                cache_read_tokens: { type: "integer", minimum: 0 },
                cache_write_tokens: { type: "integer", minimum: 0 },
              },
            },
          },
        },
        SessionUpdateRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["active", "completed", "error", "abandoned"] },
            ended_at: { type: "string", format: "date-time" },
            metadata: { type: "object", additionalProperties: true },
          },
        },
        SessionUpdateResponse: {
          type: "object",
          required: ["session"],
          properties: { session: { $ref: "#/components/schemas/Session" } },
        },
        AgentsListResponse: {
          type: "object",
          required: ["agents", "limit", "offset"],
          properties: {
            agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
            limit: { type: "integer" },
            offset: { type: "integer" },
          },
        },
        AgentCreateRequest: {
          type: "object",
          required: ["id", "session_id", "name"],
          properties: {
            id: { type: "string" },
            session_id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["main", "subagent"] },
            subagent_type: { type: "string" },
            status: {
              type: "string",
              enum: ["working", "waiting", "completed", "error"],
            },
            task: { type: "string" },
            parent_agent_id: { type: "string" },
            metadata: { type: "object", additionalProperties: true },
          },
        },
        AgentCreateResponse: {
          type: "object",
          required: ["agent", "created"],
          properties: {
            agent: { $ref: "#/components/schemas/Agent" },
            created: { type: "boolean" },
          },
        },
        AgentDetailResponse: {
          type: "object",
          required: ["agent"],
          properties: { agent: { $ref: "#/components/schemas/Agent" } },
        },
        AgentUpdateRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: {
              type: "string",
              enum: ["working", "waiting", "completed", "error"],
            },
            task: { type: "string" },
            current_tool: { type: "string", nullable: true },
            ended_at: { type: "string", format: "date-time" },
            metadata: { type: "object", additionalProperties: true },
          },
        },
        AgentUpdateResponse: {
          type: "object",
          required: ["agent"],
          properties: { agent: { $ref: "#/components/schemas/Agent" } },
        },
        EventsListResponse: {
          type: "object",
          required: ["events", "limit", "offset", "total"],
          properties: {
            events: {
              type: "array",
              items: { $ref: "#/components/schemas/DashboardEvent" },
            },
            limit: { type: "integer" },
            offset: { type: "integer" },
            total: {
              type: "integer",
              description: "Total rows matching the current filter (for UI pagination)",
            },
          },
        },
        EventsFacetsResponse: {
          type: "object",
          required: ["event_types", "tool_names"],
          properties: {
            event_types: { type: "array", items: { type: "string" } },
            tool_names: { type: "array", items: { type: "string" } },
          },
        },
        StatsResponse: {
          type: "object",
          required: [
            "total_sessions",
            "active_sessions",
            "active_agents",
            "total_agents",
            "total_events",
            "events_today",
            "ws_connections",
            "agents_by_status",
            "sessions_by_status",
          ],
          properties: {
            total_sessions: { type: "integer" },
            active_sessions: { type: "integer" },
            active_agents: { type: "integer" },
            total_agents: { type: "integer" },
            total_events: { type: "integer" },
            events_today: { type: "integer" },
            ws_connections: { type: "integer" },
            agents_by_status: { $ref: "#/components/schemas/CountMap" },
            sessions_by_status: { $ref: "#/components/schemas/CountMap" },
          },
        },
        AnalyticsResponse: {
          type: "object",
          required: [
            "tokens",
            "tool_usage",
            "daily_events",
            "daily_sessions",
            "agent_types",
            "event_types",
            "avg_events_per_session",
            "total_subagents",
            "overview",
            "agents_by_status",
            "sessions_by_status",
          ],
          properties: {
            tokens: {
              type: "object",
              required: ["total_input", "total_output", "total_cache_read", "total_cache_write"],
              properties: {
                total_input: { type: "integer" },
                total_output: { type: "integer" },
                total_cache_read: { type: "integer" },
                total_cache_write: { type: "integer" },
              },
            },
            tool_usage: {
              type: "array",
              items: {
                type: "object",
                required: ["tool_name", "count"],
                properties: { tool_name: { type: "string" }, count: { type: "integer" } },
              },
            },
            daily_events: {
              type: "array",
              items: {
                type: "object",
                required: ["date", "count"],
                properties: { date: { type: "string" }, count: { type: "integer" } },
              },
            },
            daily_sessions: {
              type: "array",
              items: {
                type: "object",
                required: ["date", "count"],
                properties: { date: { type: "string" }, count: { type: "integer" } },
              },
            },
            agent_types: {
              type: "array",
              items: {
                type: "object",
                required: ["subagent_type", "count"],
                properties: {
                  subagent_type: { type: "string", nullable: true },
                  count: { type: "integer" },
                },
              },
            },
            event_types: {
              type: "array",
              items: {
                type: "object",
                required: ["event_type", "count"],
                properties: { event_type: { type: "string" }, count: { type: "integer" } },
              },
            },
            avg_events_per_session: { type: "number" },
            total_subagents: { type: "integer" },
            overview: {
              type: "object",
              required: [
                "total_sessions",
                "active_sessions",
                "active_agents",
                "total_agents",
                "total_events",
              ],
              properties: {
                total_sessions: { type: "integer" },
                active_sessions: { type: "integer" },
                active_agents: { type: "integer" },
                total_agents: { type: "integer" },
                total_events: { type: "integer" },
              },
            },
            agents_by_status: { $ref: "#/components/schemas/CountMap" },
            sessions_by_status: { $ref: "#/components/schemas/CountMap" },
          },
        },
        HookEventRequest: {
          type: "object",
          required: ["hook_type", "data"],
          properties: {
            hook_type: {
              type: "string",
              description:
                "Hook type from Claude Code (common values: PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionStart, SessionEnd)",
            },
            data: {
              type: "object",
              required: ["session_id"],
              properties: {
                session_id: { type: "string" },
                tool_name: { type: "string" },
                transcript_path: { type: "string" },
              },
              additionalProperties: true,
            },
          },
        },
        HookEventResponse: {
          type: "object",
          required: ["ok", "event"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            event: { $ref: "#/components/schemas/DashboardEvent" },
          },
        },
        PricingRule: {
          type: "object",
          required: [
            "model_pattern",
            "display_name",
            "input_per_mtok",
            "output_per_mtok",
            "cache_read_per_mtok",
            "cache_write_per_mtok",
            "cache_write_1h_per_mtok",
            "updated_at",
          ],
          properties: {
            model_pattern: { type: "string" },
            display_name: { type: "string" },
            input_per_mtok: { type: "number" },
            output_per_mtok: { type: "number" },
            cache_read_per_mtok: { type: "number" },
            cache_write_per_mtok: { type: "number", description: "5m ephemeral cache-write rate" },
            cache_write_1h_per_mtok: {
              type: "number",
              description: "1h ephemeral cache-write rate",
            },
            fast_input_per_mtok: { type: "number", description: "Fast-mode input rate (0 = none)" },
            fast_output_per_mtok: {
              type: "number",
              description: "Fast-mode output rate (0 = none)",
            },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        PricingUpsertRequest: {
          type: "object",
          required: ["model_pattern", "display_name"],
          properties: {
            model_pattern: { type: "string" },
            display_name: { type: "string" },
            input_per_mtok: { type: "number" },
            output_per_mtok: { type: "number" },
            cache_read_per_mtok: { type: "number" },
            cache_write_per_mtok: { type: "number", description: "5m ephemeral cache-write rate" },
            cache_write_1h_per_mtok: {
              type: "number",
              description: "1h ephemeral cache-write rate",
            },
            fast_input_per_mtok: { type: "number", description: "Fast-mode input rate (0 = none)" },
            fast_output_per_mtok: {
              type: "number",
              description: "Fast-mode output rate (0 = none)",
            },
          },
        },
        PricingListResponse: {
          type: "object",
          required: ["pricing"],
          properties: {
            pricing: { type: "array", items: { $ref: "#/components/schemas/PricingRule" } },
          },
        },
        PricingUpsertResponse: {
          type: "object",
          required: ["pricing"],
          properties: { pricing: { $ref: "#/components/schemas/PricingRule" } },
        },
        CostBreakdownItem: {
          type: "object",
          required: [
            "model",
            "input_tokens",
            "output_tokens",
            "cache_read_tokens",
            "cache_write_tokens",
            "cost",
            "matched_rule",
          ],
          properties: {
            model: { type: "string" },
            speed: { type: "string" },
            inference_geo: { type: "string" },
            service_tier: { type: "string" },
            input_tokens: { type: "integer" },
            output_tokens: { type: "integer" },
            cache_read_tokens: { type: "integer" },
            cache_write_tokens: { type: "integer" },
            cache_write_1h_tokens: { type: "integer" },
            web_search_requests: { type: "integer" },
            web_fetch_requests: { type: "integer" },
            code_execution_requests: { type: "integer" },
            cost: { type: "number" },
            matched_rule: { type: "string", nullable: true },
          },
        },
        DailyCostItem: {
          type: "object",
          required: ["date", "cost"],
          properties: {
            date: { type: "string", format: "date" },
            cost: { type: "number" },
          },
        },
        CostResult: {
          type: "object",
          required: ["total_cost", "breakdown", "daily_costs"],
          properties: {
            total_cost: { type: "number" },
            breakdown: { type: "array", items: { $ref: "#/components/schemas/CostBreakdownItem" } },
            daily_costs: { type: "array", items: { $ref: "#/components/schemas/DailyCostItem" } },
            feature_costs: {
              type: "object",
              description: "Server-tool surcharges separate from token cost",
              properties: {
                web_search_cost: { type: "number" },
                web_fetch_cost: { type: "number" },
                code_execution_cost: { type: "number" },
                code_execution_hours_estimated: { type: "number" },
                code_execution_free_hours: { type: "number" },
              },
            },
            unpriced_models: {
              type: "array",
              description: "Models with usage but no matching pricing rule (cost not counted)",
              items: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  input_tokens: { type: "integer" },
                  output_tokens: { type: "integer" },
                  cache_read_tokens: { type: "integer" },
                  cache_write_tokens: { type: "integer" },
                },
              },
            },
          },
        },
        DeleteOkResponse: {
          type: "object",
          required: ["ok"],
          properties: { ok: { type: "boolean", enum: [true] } },
        },
        WorkflowAggregateResponse: {
          type: "object",
          required: [
            "stats",
            "orchestration",
            "toolFlow",
            "effectiveness",
            "patterns",
            "modelDelegation",
            "errorPropagation",
            "concurrency",
            "complexity",
            "compaction",
            "cooccurrence",
          ],
          properties: {
            stats: {
              type: "object",
              required: [
                "totalSessions",
                "totalAgents",
                "totalSubagents",
                "avgSubagents",
                "successRate",
                "avgDepth",
                "avgDurationSec",
                "totalCompactions",
                "avgCompactions",
              ],
              properties: {
                totalSessions: { type: "integer" },
                totalAgents: { type: "integer" },
                totalSubagents: { type: "integer" },
                avgSubagents: { type: "number" },
                successRate: { type: "number" },
                avgDepth: { type: "number" },
                avgDurationSec: { type: "integer" },
                totalCompactions: { type: "integer" },
                avgCompactions: { type: "number" },
                topFlow: {
                  type: "object",
                  nullable: true,
                  properties: {
                    source: { type: "string" },
                    target: { type: "string" },
                    count: { type: "integer" },
                  },
                },
              },
            },
            orchestration: { type: "object", additionalProperties: true },
            toolFlow: { type: "object", additionalProperties: true },
            effectiveness: { type: "array", items: { type: "object", additionalProperties: true } },
            patterns: { type: "object", additionalProperties: true },
            modelDelegation: { type: "object", additionalProperties: true },
            errorPropagation: { type: "object", additionalProperties: true },
            concurrency: { type: "object", additionalProperties: true },
            complexity: { type: "array", items: { type: "object", additionalProperties: true } },
            compaction: { type: "object", additionalProperties: true },
            cooccurrence: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        },
        AgentTreeNode: {
          type: "object",
          required: ["id", "name", "type", "status", "children"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ["main", "subagent"] },
            subagent_type: { type: "string", nullable: true },
            status: { type: "string" },
            task: { type: "string", nullable: true },
            started_at: { type: "string", format: "date-time" },
            ended_at: { type: "string", format: "date-time", nullable: true },
            children: {
              type: "array",
              items: { $ref: "#/components/schemas/AgentTreeNode" },
            },
          },
        },
        WorkflowSessionResponse: {
          type: "object",
          required: ["session", "tree", "toolTimeline", "swimLanes", "events"],
          properties: {
            session: { $ref: "#/components/schemas/Session" },
            tree: {
              type: "array",
              items: { $ref: "#/components/schemas/AgentTreeNode" },
            },
            toolTimeline: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  tool_name: { type: "string" },
                  event_type: { type: "string" },
                  agent_id: { type: "string", nullable: true },
                  created_at: { type: "string", format: "date-time" },
                  summary: { type: "string", nullable: true },
                },
              },
            },
            swimLanes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string" },
                  subagent_type: { type: "string", nullable: true },
                  status: { type: "string" },
                  started_at: { type: "string", format: "date-time" },
                  ended_at: { type: "string", format: "date-time", nullable: true },
                  parent_agent_id: { type: "string", nullable: true },
                },
              },
            },
            events: {
              type: "array",
              items: { $ref: "#/components/schemas/DashboardEvent" },
            },
          },
        },
        SettingsInfoResponse: {
          type: "object",
          required: ["db", "hooks", "server", "transcript_cache"],
          properties: {
            db: {
              type: "object",
              required: ["path", "size", "counts"],
              properties: {
                path: { type: "string" },
                size: { type: "integer" },
                counts: {
                  type: "object",
                  additionalProperties: { type: "integer" },
                },
              },
            },
            hooks: {
              type: "object",
              required: ["installed", "path", "hooks"],
              properties: {
                installed: { type: "boolean" },
                path: { type: "string" },
                hooks: {
                  type: "object",
                  additionalProperties: { type: "boolean" },
                },
              },
            },
            server: {
              type: "object",
              required: ["uptime", "node_version", "platform", "ws_connections"],
              properties: {
                uptime: { type: "number" },
                node_version: { type: "string" },
                platform: { type: "string" },
                ws_connections: { type: "integer" },
              },
            },
            transcript_cache: {
              type: "object",
              required: ["entries", "paths"],
              properties: {
                entries: { type: "integer" },
                paths: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        ClearDataResponse: {
          type: "object",
          required: ["ok", "cleared"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            cleared: {
              type: "object",
              additionalProperties: { type: "integer" },
            },
          },
        },
        ReimportResponse: {
          type: "object",
          required: ["ok", "imported", "skipped", "errors"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            imported: { type: "integer" },
            skipped: { type: "integer" },
            errors: { type: "integer" },
          },
        },
        ImportGuideResponse: {
          type: "object",
          properties: {
            platform: { type: "string" },
            default_projects_dir: { type: "string" },
            default_projects_dir_display: { type: "string" },
            default_projects_dir_exists: { type: "boolean" },
            default_projects_dir_stats: {
              type: "object",
              properties: {
                projects: { type: "integer" },
                jsonl_files: { type: "integer" },
              },
            },
            archive_command: { type: "string" },
            supported_extensions: { type: "array", items: { type: "string" } },
            max_upload_bytes: { type: "integer" },
            max_upload_files: { type: "integer" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
        ImportResultResponse: {
          type: "object",
          required: ["ok", "source", "imported", "skipped", "errors"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            source: { type: "string", enum: ["default", "path", "upload"] },
            path: { type: "string", nullable: true },
            imported: { type: "integer" },
            backfilled: { type: "integer" },
            skipped: { type: "integer" },
            errors: { type: "integer" },
            sessions_seen: { type: "integer" },
            files_scanned: { type: "integer" },
            files_received: { type: "integer" },
            rejected_files: { type: "array", items: { type: "string" } },
            entries_extracted: { type: "integer" },
            entries_skipped: { type: "integer" },
          },
        },
        ReinstallHooksResponse: {
          type: "object",
          required: ["ok", "hooks"],
          properties: {
            ok: { type: "boolean" },
            hooks: {
              type: "object",
              required: ["installed", "path", "hooks"],
              properties: {
                installed: { type: "boolean" },
                path: { type: "string" },
                hooks: {
                  type: "object",
                  additionalProperties: { type: "boolean" },
                },
              },
            },
          },
        },
        ResetPricingResponse: {
          type: "object",
          required: ["ok", "pricing"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            pricing: { type: "array", items: { $ref: "#/components/schemas/PricingRule" } },
          },
        },
        ExportResponse: {
          type: "object",
          required: ["exported_at", "sessions", "agents", "events", "token_usage", "model_pricing"],
          properties: {
            exported_at: { type: "string", format: "date-time" },
            sessions: { type: "array", items: { $ref: "#/components/schemas/Session" } },
            agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
            events: { type: "array", items: { $ref: "#/components/schemas/DashboardEvent" } },
            token_usage: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
            model_pricing: { type: "array", items: { $ref: "#/components/schemas/PricingRule" } },
          },
        },
        CleanupRequest: {
          type: "object",
          properties: {
            abandon_hours: {
              type: "number",
              minimum: 0,
              description: "Mark active sessions abandoned if stale for this many hours",
            },
            purge_days: {
              type: "number",
              minimum: 0,
              description:
                "Delete old completed/error/abandoned sessions older than this many days",
            },
          },
        },
        CleanupResponse: {
          type: "object",
          required: ["ok", "abandoned", "purged_sessions", "purged_events", "purged_agents"],
          properties: {
            ok: { type: "boolean", enum: [true] },
            abandoned: { type: "integer" },
            purged_sessions: { type: "integer" },
            purged_events: { type: "integer" },
            purged_agents: { type: "integer" },
          },
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          operationId: "getHealth",
          responses: {
            200: {
              description: "Service is healthy",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
      "/api/sessions": {
        get: {
          tags: ["Sessions"],
          summary: "List sessions",
          description:
            "Returns a paginated list of sessions with agent counts and per-session cost. Status filter, search, and pagination compose. Cost computation runs over the returned page only — independent of total session count.",
          operationId: "listSessions",
          parameters: [
            { $ref: "#/components/parameters/SessionStatusQuery" },
            {
              name: "q",
              in: "query",
              schema: { type: "string" },
              description:
                "Case-insensitive search across `id` / `name` / `cwd`. Composes with the status filter when both are present.",
            },
            { $ref: "#/components/parameters/LimitQuery" },
            { $ref: "#/components/parameters/OffsetQuery" },
          ],
          responses: {
            200: {
              description: "Session list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionsListResponse" },
                },
              },
            },
          },
        },
        post: {
          tags: ["Sessions"],
          summary: "Create session (idempotent)",
          operationId: "createSession",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionCreateRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Session created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionCreateResponse" },
                },
              },
            },
            200: {
              description: "Session already exists",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionCreateResponse" },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
          operationId: "getSession",
          parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
          responses: {
            200: {
              description: "Session with associated agents/events",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionDetailResponse" },
                },
              },
            },
            404: {
              description: "Session not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        patch: {
          tags: ["Sessions"],
          summary: "Update session",
          operationId: "updateSession",
          parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SessionUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Session updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionUpdateResponse" },
                },
              },
            },
            404: {
              description: "Session not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
            "Returns aggregated counts for the SessionOverview panel: events, events-by-type, top tool usage, error count, agent type/status counts, subagent type breakdown, and token totals. All aggregation runs in SQL — cheap to call even for sessions with tens of thousands of events. Frontend debounces calls to this endpoint on `new_event` / `agent_*` / `session_updated` websocket frames so counters track the running session.",
          operationId: "getSessionStats",
          parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
          responses: {
            200: {
              description: "Aggregated session stats",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SessionStatsResponse" },
                },
              },
            },
            404: {
              description: "Session not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
            "Lists every JSONL transcript file associated with a session — the main agent's transcript plus any subagent and compaction transcripts. Used by the Conversation tab on the Session Detail page to populate the transcript switcher.",
          operationId: "listSessionTranscripts",
          parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
          responses: {
            200: {
              description: "List of transcripts available for the session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TranscriptListResponse" },
                },
              },
            },
            404: {
              description: "Session not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
            "Returns parsed messages from a JSONL transcript with cursor-based pagination. Pass `agent_id` to select a specific subagent or compaction transcript. The frontend uses `after` for incremental live updates on `new_event` and `before` to load older messages on scroll-up.",
          operationId: "getSessionTranscript",
          parameters: [
            { $ref: "#/components/parameters/SessionIdPath" },
            {
              name: "agent_id",
              in: "query",
              schema: { type: "string" },
              description:
                "Transcript identifier — 'main' for the session's main transcript, or a subagent / compaction id from /transcripts.",
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 50, minimum: 1, maximum: 500 },
              description: "Maximum number of messages to return.",
            },
            {
              name: "offset",
              in: "query",
              schema: { type: "integer", minimum: 0 },
              description:
                "Offset from the start of the transcript (mutually exclusive with after/before).",
            },
            {
              name: "after",
              in: "query",
              schema: { type: "integer", minimum: 0 },
              description:
                "Only return messages whose JSONL line number is strictly greater than this value. Used for incremental live updates.",
            },
            {
              name: "before",
              in: "query",
              schema: { type: "integer", minimum: 0 },
              description:
                "Only return messages whose JSONL line number is strictly less than this value. Used to load older messages on scroll-up.",
            },
          ],
          responses: {
            200: {
              description: "Parsed messages with cursor metadata",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TranscriptResponse" },
                },
              },
            },
            404: {
              description: "Session or transcript not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
          operationId: "listAgents",
          parameters: [
            { $ref: "#/components/parameters/AgentStatusQuery" },
            { $ref: "#/components/parameters/SessionFilterQuery" },
            { $ref: "#/components/parameters/LimitQuery" },
            { $ref: "#/components/parameters/OffsetQuery" },
          ],
          responses: {
            200: {
              description: "Agent list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentsListResponse" },
                },
              },
            },
          },
        },
        post: {
          tags: ["Agents"],
          summary: "Create agent (idempotent)",
          operationId: "createAgent",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentCreateRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Agent created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentCreateResponse" },
                },
              },
            },
            200: {
              description: "Agent already exists",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentCreateResponse" },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
          operationId: "getAgent",
          parameters: [{ $ref: "#/components/parameters/AgentIdPath" }],
          responses: {
            200: {
              description: "Agent details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentDetailResponse" },
                },
              },
            },
            404: {
              description: "Agent not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
        patch: {
          tags: ["Agents"],
          summary: "Update agent",
          operationId: "updateAgent",
          parameters: [{ $ref: "#/components/parameters/AgentIdPath" }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentUpdateRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Agent updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AgentUpdateResponse" },
                },
              },
            },
            404: {
              description: "Agent not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/events": {
        get: {
          tags: ["Events"],
          summary: "List events with multi-dimensional filtering",
          operationId: "listEvents",
          parameters: [
            {
              in: "query",
              name: "event_type",
              description: "Comma-separated event_type values (e.g. Stop,PreToolUse)",
              schema: { type: "string" },
            },
            {
              in: "query",
              name: "tool_name",
              description: "Comma-separated tool_name values (e.g. Bash,Edit)",
              schema: { type: "string" },
            },
            {
              in: "query",
              name: "agent_id",
              description: "Comma-separated agent_id values",
              schema: { type: "string" },
            },
            {
              in: "query",
              name: "session_id",
              description: "Comma-separated session_id values",
              schema: { type: "string" },
            },
            {
              in: "query",
              name: "q",
              description: "Text search across summary, tool_name, and data",
              schema: { type: "string" },
            },
            {
              in: "query",
              name: "from",
              description: "ISO datetime lower bound (inclusive) on created_at",
              schema: { type: "string", format: "date-time" },
            },
            {
              in: "query",
              name: "to",
              description: "ISO datetime upper bound (inclusive) on created_at",
              schema: { type: "string", format: "date-time" },
            },
            {
              in: "query",
              name: "limit",
              description: "Max rows to return (1-500, default 50)",
              schema: { type: "integer", minimum: 1, maximum: 500, default: 50 },
            },
            { $ref: "#/components/parameters/OffsetQuery" },
          ],
          responses: {
            200: {
              description: "Event list with total count for pagination",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EventsListResponse" },
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
          responses: {
            200: {
              description: "Facet values for populating filter dropdowns",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EventsFacetsResponse" },
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
          responses: {
            200: {
              description: "Statistics overview",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/StatsResponse" },
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
          responses: {
            200: {
              description: "Analytics response",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AnalyticsResponse" },
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
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HookEventRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Event processed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HookEventResponse" },
                },
              },
            },
            400: {
              description: "Invalid hook payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/pricing": {
        get: {
          tags: ["Pricing"],
          summary: "List pricing rules",
          operationId: "listPricingRules",
          responses: {
            200: {
              description: "Pricing rules",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PricingListResponse" },
                },
              },
            },
          },
        },
        put: {
          tags: ["Pricing"],
          summary: "Create/update pricing rule",
          operationId: "upsertPricingRule",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PricingUpsertRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Pricing rule stored",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PricingUpsertResponse" },
                },
              },
            },
            400: {
              description: "Invalid request body",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/pricing/{pattern}": {
        delete: {
          tags: ["Pricing"],
          summary: "Delete pricing rule",
          operationId: "deletePricingRule",
          parameters: [{ $ref: "#/components/parameters/PatternPath" }],
          responses: {
            200: {
              description: "Rule deleted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/DeleteOkResponse" },
                },
              },
            },
            404: {
              description: "Pricing rule not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/pricing/cost": {
        get: {
          tags: ["Pricing"],
          summary: "Get total token cost across all sessions",
          operationId: "getTotalCost",
          responses: {
            200: {
              description: "Cost result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CostResult" },
                },
              },
            },
          },
        },
      },
      "/api/pricing/cost/{sessionId}": {
        get: {
          tags: ["Pricing"],
          summary: "Get token cost for one session",
          operationId: "getSessionCost",
          parameters: [
            {
              name: "sessionId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Session cost result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CostResult" },
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
          operationId: "getWorkflowIntelligence",
          parameters: [{ $ref: "#/components/parameters/WorkflowStatusQuery" }],
          responses: {
            200: {
              description: "Workflow aggregate data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WorkflowAggregateResponse" },
                },
              },
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MessageErrorResponse" },
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
          operationId: "getWorkflowSession",
          parameters: [{ $ref: "#/components/parameters/SessionIdPath" }],
          responses: {
            200: {
              description: "Workflow session detail",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WorkflowSessionResponse" },
                },
              },
            },
            404: {
              description: "Session not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MessageErrorResponse" },
                },
              },
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MessageErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/api/settings/info": {
        get: {
          tags: ["Settings"],
          summary: "Get system/database/hook diagnostics",
          operationId: "getSettingsInfo",
          responses: {
            200: {
              description: "Settings and diagnostics",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SettingsInfoResponse" },
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
          operationId: "clearData",
          responses: {
            200: {
              description: "Data cleared",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ClearDataResponse" },
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
          operationId: "reimportLegacySessions",
          responses: {
            200: {
              description: "Import completed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReimportResponse" },
                },
              },
            },
            500: {
              description: "Import failed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
          operationId: "reinstallHooks",
          responses: {
            200: {
              description: "Hooks reinstall result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ReinstallHooksResponse" },
                },
              },
            },
            500: {
              description: "Hook installation failed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
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
          operationId: "resetPricing",
          responses: {
            200: {
              description: "Pricing defaults restored",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ResetPricingResponse" },
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
          operationId: "exportData",
          responses: {
            200: {
              description: "Export payload (served as attachment)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ExportResponse" },
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
          operationId: "cleanupData",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CleanupRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Cleanup result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CleanupResponse" },
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
          operationId: "importGuide",
          responses: {
            200: {
              description: "Guide payload",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportGuideResponse" },
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
          operationId: "importRescan",
          responses: {
            200: {
              description: "Import result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportResultResponse" },
                },
              },
            },
            500: {
              description: "Import failed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/import/scan-path": {
        post: {
          tags: ["Import"],
          summary: "Import transcripts from an arbitrary absolute directory",
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
              },
            },
          },
          responses: {
            200: {
              description: "Import result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportResultResponse" },
                },
              },
            },
            400: {
              description: "Path validation failed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            500: {
              description: "Import failed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/import/upload": {
        post: {
          tags: ["Import"],
          summary: "Upload JSONL files or archives (.zip, .tar, .tar.gz, .tgz, .gz)",
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
              },
            },
          },
          responses: {
            200: {
              description: "Import result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportResultResponse" },
                },
              },
            },
            400: {
              description: "No files or no JSONL content",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            413: {
              description: "Extraction limit exceeded (possible zip bomb)",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            500: {
              description: "Upload or import failed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/updates/status": {
        get: {
          tags: ["Updates"],
          summary: "Check whether the dashboard git checkout is behind origin",
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
                },
              },
            },
            500: {
              description: "Update status query failed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/updates/check": {
        post: {
          tags: ["Updates"],
          summary: "Run an update check immediately and broadcast the result",
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
                },
              },
            },
            500: {
              description: "Update check failed",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/alerts": {
        get: {
          tags: ["Alerts"],
          summary: "List fired alerts, newest first",
          operationId: "listAlerts",
          parameters: [
            { $ref: "#/components/parameters/LimitQuery" },
            { $ref: "#/components/parameters/OffsetQuery" },
            {
              name: "unacked",
              in: "query",
              required: false,
              schema: { type: "boolean" },
              description: "When true, return only unacknowledged alerts",
            },
          ],
          responses: {
            200: {
              description: "Paginated alert feed with total and unacked counts",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true,
                    description: "Includes alerts[], total, unacked, limit, offset.",
                  },
                },
              },
            },
          },
        },
      },
      "/api/alerts/rules": {
        get: {
          tags: ["Alerts"],
          summary: "List alert rules",
          operationId: "listAlertRules",
          responses: {
            200: {
              description: "All alert rules with parsed config objects",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
        post: {
          tags: ["Alerts"],
          summary: "Create an alert rule",
          operationId: "createAlertRule",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "rule_type", "config"],
                  properties: {
                    name: { type: "string" },
                    rule_type: {
                      type: "string",
                      enum: ["event_pattern", "inactivity", "status_duration", "token_threshold"],
                    },
                    config: {
                      type: "object",
                      additionalProperties: true,
                      description:
                        "Type-specific config. event_pattern: event_type/tool_name/summary_contains + optional count/window_minutes. inactivity: minutes. status_duration: status + minutes. token_threshold: total_tokens.",
                    },
                    enabled: { type: "boolean", default: true },
                    cooldown_seconds: { type: "integer", default: 300 },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Created rule",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            400: {
              description: "Validation error",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/alerts/rules/{id}": {
        patch: {
          tags: ["Alerts"],
          summary: "Update an alert rule (partial; rule_type is immutable)",
          operationId: "updateAlertRule",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Alert rule ID",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    config: { type: "object", additionalProperties: true },
                    enabled: { type: "boolean" },
                    cooldown_seconds: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Updated rule",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            400: {
              description: "Validation error",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            404: {
              description: "Rule not found",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
        delete: {
          tags: ["Alerts"],
          summary: "Delete an alert rule and its fired-alert history",
          operationId: "deleteAlertRule",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Alert rule ID",
            },
          ],
          responses: {
            200: {
              description: "Deletion confirmation",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            404: {
              description: "Rule not found",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/alerts/{id}/ack": {
        post: {
          tags: ["Alerts"],
          summary: "Acknowledge one fired alert",
          operationId: "ackAlert",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "integer" },
              description: "Alert event ID",
            },
          ],
          responses: {
            200: {
              description: "Acknowledged alert row",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            404: {
              description: "Alert not found",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/alerts/ack-all": {
        post: {
          tags: ["Alerts"],
          summary: "Acknowledge all unacked alerts",
          operationId: "ackAllAlerts",
          responses: {
            200: {
              description: "Count of acknowledged alerts",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/webhooks/providers": {
        get: {
          tags: ["Webhooks"],
          summary: "List supported providers + their config fields (for the UI)",
          operationId: "listWebhookProviders",
          responses: {
            200: {
              description: "Provider catalog: label, family, url requirements, fields",
              content: {
                "application/json": { schema: { type: "object", additionalProperties: true } },
              },
            },
          },
        },
      },
      "/api/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhook targets (URLs masked, secrets redacted)",
          operationId: "listWebhooks",
          responses: {
            200: {
              description: "All configured webhook targets",
              content: {
                "application/json": { schema: { type: "object", additionalProperties: true } },
              },
            },
          },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Create a webhook target",
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
              },
            },
          },
          responses: {
            201: {
              description: "Created target (redacted)",
              content: {
                "application/json": { schema: { type: "object", additionalProperties: true } },
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
          operationId: "updateWebhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
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
                      description:
                        "Provider params; merged over existing (secrets kept if omitted)",
                    },
                    secret: {
                      type: ["string", "null"],
                      description: "Generic family only: omit to keep, null to clear",
                    },
                    headers: { type: "object", additionalProperties: { type: "string" } },
                    rule_ids: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Updated target (redacted)",
              content: {
                "application/json": { schema: { type: "object", additionalProperties: true } },
              },
            },
            400: { description: "Validation error" },
            404: { description: "Target not found" },
          },
        },
        delete: {
          tags: ["Webhooks"],
          summary: "Delete a webhook target and its delivery log",
          operationId: "deleteWebhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
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
          operationId: "testWebhook",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            200: {
              description: "Delivery result (ok flag carries the downstream outcome)",
              content: {
                "application/json": { schema: { type: "object", additionalProperties: true } },
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
          operationId: "listWebhookDeliveries",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            200: {
              description: "Delivery rows, newest first",
              content: {
                "application/json": { schema: { type: "object", additionalProperties: true } },
              },
            },
            404: { description: "Target not found" },
          },
        },
      },
      "/api/openapi.json": {
        get: {
          tags: ["Documentation"],
          summary: "Get OpenAPI specification JSON",
          description:
            "Returns this OpenAPI 3.0 document as JSON. Both API explorers consume it: Swagger UI (`/api/docs`) for interactive try-it-out requests, and ReDoc (`/api/redoc`) for a read-optimized reference.",
          operationId: "getOpenApiJson",
          responses: {
            200: {
              description: "OpenAPI document",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/docs": {
        get: {
          tags: ["Documentation"],
          summary: "Swagger UI explorer",
          description:
            "Interactive Swagger UI rendering of this specification, with try-it-out request execution against the live local server.",
          operationId: "getSwaggerUi",
          responses: {
            200: {
              description: "Swagger UI HTML page",
              content: { "text/html": { schema: { type: "string" } } },
            },
          },
        },
      },
      "/api/redoc": {
        get: {
          tags: ["Documentation"],
          summary: "ReDoc API reference",
          description:
            "Read-optimized, three-panel ReDoc rendering of this specification. The ReDoc bundle is served locally from `/api/redoc/redoc.standalone.js` (bundled with the server, never fetched from a CDN), so the reference works fully offline.",
          operationId: "getRedoc",
          responses: {
            200: {
              description: "ReDoc HTML page",
              content: { "text/html": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
    ...(issuesUrl
      ? {
          "x-issues-url": issuesUrl,
        }
      : {}),
  };

  return mergeExtraSpec(spec, extraSpec);
}

module.exports = { createOpenApiSpec };
