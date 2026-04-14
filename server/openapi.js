/**
 * @file Central OpenAPI 3.0 specification for the dashboard HTTP API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const pkg = require("../package.json");

function normalizeRepositoryUrl(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^git\+/, "").replace(/\.git$/, "");
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

  return {
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
            enum: ["idle", "connected", "working", "completed", "error"],
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
              enum: ["idle", "connected", "working", "completed", "error"],
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
          required: ["sessions", "limit", "offset"],
          properties: {
            sessions: { type: "array", items: { $ref: "#/components/schemas/Session" } },
            limit: { type: "integer" },
            offset: { type: "integer" },
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
              enum: ["idle", "connected", "working", "completed", "error"],
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
              enum: ["idle", "connected", "working", "completed", "error"],
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
          required: ["events", "limit", "offset"],
          properties: {
            events: {
              type: "array",
              items: { $ref: "#/components/schemas/DashboardEvent" },
            },
            limit: { type: "integer" },
            offset: { type: "integer" },
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
            "updated_at",
          ],
          properties: {
            model_pattern: { type: "string" },
            display_name: { type: "string" },
            input_per_mtok: { type: "number" },
            output_per_mtok: { type: "number" },
            cache_read_per_mtok: { type: "number" },
            cache_write_per_mtok: { type: "number" },
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
            cache_write_per_mtok: { type: "number" },
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
            input_tokens: { type: "integer" },
            output_tokens: { type: "integer" },
            cache_read_tokens: { type: "integer" },
            cache_write_tokens: { type: "integer" },
            cost: { type: "number" },
            matched_rule: { type: "string", nullable: true },
          },
        },
        CostResult: {
          type: "object",
          required: ["total_cost", "breakdown"],
          properties: {
            total_cost: { type: "number" },
            breakdown: { type: "array", items: { $ref: "#/components/schemas/CostBreakdownItem" } },
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
          operationId: "listSessions",
          parameters: [
            { $ref: "#/components/parameters/SessionStatusQuery" },
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
          summary: "List events",
          operationId: "listEvents",
          parameters: [
            { $ref: "#/components/parameters/SessionFilterQuery" },
            { $ref: "#/components/parameters/LimitQuery" },
            { $ref: "#/components/parameters/OffsetQuery" },
          ],
          responses: {
            200: {
              description: "Event list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/EventsListResponse" },
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
      "/api/openapi.json": {
        get: {
          tags: ["Documentation"],
          summary: "Get OpenAPI specification JSON",
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
    },
    ...(issuesUrl
      ? {
          "x-issues-url": issuesUrl,
        }
      : {}),
  };
}

module.exports = { createOpenApiSpec };
