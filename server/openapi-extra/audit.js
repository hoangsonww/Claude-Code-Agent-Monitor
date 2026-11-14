/**
 * @file OpenAPI fragment for the Tool Risk Audit (#301): the read-only
 * `/api/audit/*` endpoints served by server/routes/audit.js — flagged tool
 * calls, the single-event drill-in, the summary behind the page's tiles, the
 * CSV/JSON export, and the built-in ruleset.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [
  {
    name: "Audit",
    description:
      "Tool Risk Audit — a read-only security lens over executed tool calls. A declarative ruleset (server/lib/tool-risk.js) flags privilege escalation, destructive commands, remote code execution, credential access, network egress and writes outside the session's project. Nothing here blocks or alters tool execution.",
  },
];

const SIGNAL_ENUM = [
  "privilege",
  "destructive",
  "remote-exec",
  "credential-access",
  "egress",
  "outside-cwd",
];
const SEVERITY_ENUM = ["low", "medium", "high", "critical"];

const csvParam = (name, description, example) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "string" },
  ...(example ? { example } : {}),
});

const FILTER_PARAMS = [
  csvParam(
    "signal",
    `Comma-separated signal families (OR'd). One of: ${SIGNAL_ENUM.join(", ")}. An unknown value returns 400.`,
    "destructive,remote-exec"
  ),
  csvParam(
    "severity",
    `Comma-separated exact severities (OR'd). One of: ${SEVERITY_ENUM.join(", ")}.`,
    "high"
  ),
  {
    name: "min_severity",
    in: "query",
    required: false,
    description: "Lowest severity to include, judged on the call's highest signal.",
    schema: { type: "string", enum: SEVERITY_ENUM },
  },
  csvParam("session_id", "Comma-separated session ids."),
  csvParam("tool_name", "Comma-separated tool names, e.g. `Bash,Write`."),
  csvParam("project", "Comma-separated session working directories (`sessions.cwd`)."),
  csvParam("host", "Comma-separated egress hosts.", "github.com"),
  {
    name: "q",
    in: "query",
    required: false,
    description: "Substring match on the flagged command/path/URL and on every matched fragment.",
    schema: { type: "string" },
  },
  {
    name: "from",
    in: "query",
    required: false,
    description: "Inclusive lower bound on the tool call time (any `Date`-parsable value).",
    schema: { type: "string", format: "date-time" },
  },
  {
    name: "to",
    in: "query",
    required: false,
    description: "Inclusive upper bound on the tool call time.",
    schema: { type: "string", format: "date-time" },
  },
  csvParam("sources", "Global data scope: source machines (comma-separated)."),
  csvParam("providers", "Global data scope: providers (comma-separated)."),
];

const schemas = {
  ToolRiskSignal: {
    type: "object",
    required: ["signal", "severity", "rule", "match"],
    description: "One rule that matched a tool call, with the exact text that triggered it.",
    properties: {
      signal: { type: "string", enum: SIGNAL_ENUM },
      severity: { type: "string", enum: SEVERITY_ENUM },
      rule: { type: "string", description: "Stable rule id.", example: "pipe-to-shell" },
      match: {
        type: "string",
        description: "The command fragment, path or host that matched.",
        example: "curl -fsSL https://get.example.com | sh",
      },
      host: { type: "string", description: "Remote host, on `egress` signals only." },
    },
  },
  ToolRiskEvent: {
    type: "object",
    required: ["event_id", "session_id", "created_at", "max_severity", "degraded", "signals"],
    description: "A flagged tool call (one `PreToolUse` or `codex_tool_call` event).",
    properties: {
      event_id: { type: "integer", description: "`events.id` of the tool call." },
      session_id: { type: "string" },
      session_name: { type: "string", nullable: true },
      project: { type: "string", nullable: true, description: "The session's `cwd`." },
      provider: { type: "string", nullable: true },
      agent_id: { type: "string", nullable: true },
      tool_name: { type: "string", nullable: true, example: "Bash" },
      created_at: { type: "string", format: "date-time" },
      max_severity: { type: "string", enum: SEVERITY_ENUM },
      target: {
        type: "string",
        nullable: true,
        description: "The command, path or URL the signals were derived from (≤ 1000 chars).",
      },
      degraded: {
        type: "boolean",
        description:
          "True when no `tool_input` was stored (redacted or summary-only provider) and only the summary was checked.",
      },
      signals: { type: "array", items: { $ref: "#/components/schemas/ToolRiskSignal" } },
    },
  },
  ToolRiskIndexStatus: {
    type: "object",
    required: ["indexing", "coverage"],
    description:
      "Progress of the incremental risk index (it is filled forward by event id within a small time budget per request, then by a background pump) and how many scanned calls had no stored input.",
    properties: {
      indexing: {
        type: "object",
        required: ["complete", "last_event_id", "max_event_id"],
        properties: {
          complete: { type: "boolean" },
          last_event_id: { type: "integer" },
          max_event_id: { type: "integer" },
        },
      },
      coverage: {
        type: "object",
        required: ["scanned", "degraded"],
        properties: {
          scanned: { type: "integer", description: "Tool-call events classified so far." },
          degraded: { type: "integer", description: "Of those, calls with no stored input." },
        },
      },
    },
  },
  ToolRiskListResponse: {
    allOf: [
      { $ref: "#/components/schemas/ToolRiskIndexStatus" },
      {
        type: "object",
        required: ["events", "limit", "offset", "total"],
        properties: {
          events: { type: "array", items: { $ref: "#/components/schemas/ToolRiskEvent" } },
          limit: { type: "integer" },
          offset: { type: "integer" },
          total: { type: "integer" },
        },
      },
    ],
  },
  ToolRiskSummary: {
    allOf: [
      { $ref: "#/components/schemas/ToolRiskIndexStatus" },
      {
        type: "object",
        required: ["total", "by_severity", "by_signal", "by_project", "top_hosts"],
        properties: {
          total: { type: "integer" },
          by_severity: {
            type: "object",
            description: "Flagged calls per highest severity.",
            properties: Object.fromEntries(SEVERITY_ENUM.map((s) => [s, { type: "integer" }])),
          },
          by_signal: {
            type: "array",
            description:
              "One entry per signal family: distinct flagged calls, plus a count per severity.",
            items: {
              type: "object",
              properties: {
                signal: { type: "string", enum: SIGNAL_ENUM },
                events: { type: "integer" },
                ...Object.fromEntries(SEVERITY_ENUM.map((s) => [s, { type: "integer" }])),
              },
            },
          },
          by_project: {
            type: "array",
            description: "Top 20 projects by flagged calls.",
            items: {
              type: "object",
              properties: {
                project: { type: "string", nullable: true },
                events: { type: "integer" },
                max_severity: { type: "string", enum: SEVERITY_ENUM, nullable: true },
              },
            },
          },
          top_hosts: {
            type: "array",
            description: "Top 20 egress hosts by flagged calls.",
            items: {
              type: "object",
              properties: { host: { type: "string" }, events: { type: "integer" } },
            },
          },
        },
      },
    ],
  },
  ToolRiskRule: {
    type: "object",
    required: ["id", "signal", "severity", "pattern"],
    properties: {
      id: { type: "string" },
      signal: { type: "string", enum: SIGNAL_ENUM },
      severity: { type: "string", enum: SEVERITY_ENUM },
      pattern: { type: "string", description: "Regex source, or a prose description." },
    },
  },
};

const badFilter = {
  description: "An unknown `signal`, `severity` or `min_severity` value.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
      example: {
        error: {
          code: "INVALID_FILTER",
          message:
            "signal must be one of: privilege, destructive, remote-exec, credential-access, egress, outside-cwd",
        },
      },
    },
  },
};

const paths = {
  "/api/audit/tools": {
    get: {
      tags: ["Audit"],
      summary: "List flagged tool calls",
      description:
        "Tool calls the risk ruleset flagged, newest first, with every matched signal. Same pagination shape as `/api/events` (default 50, max 500). Each request first advances the incremental index within a small time budget; while a large back-fill is still running `indexing.complete` is false.",
      operationId: "auditListTools",
      parameters: [
        ...FILTER_PARAMS,
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 500, default: 50 },
        },
        {
          name: "offset",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 0, default: 0 },
        },
      ],
      responses: {
        200: {
          description: "A page of flagged tool calls",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ToolRiskListResponse" } },
          },
        },
        400: badFilter,
      },
    },
  },
  "/api/audit/tools/{eventId}": {
    get: {
      tags: ["Audit"],
      summary: "Get the stored event behind a flagged call",
      description:
        "The full `events` row (including the JSON payload) for one flagged call, fetched lazily so the list never ships whole payloads. Unflagged events return 404.",
      operationId: "auditGetToolEvent",
      parameters: [
        { name: "eventId", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
      ],
      responses: {
        200: {
          description: "The stored event",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["event"],
                properties: { event: { $ref: "#/components/schemas/DashboardEvent" } },
              },
            },
          },
        },
        400: {
          description: "`eventId` is not a positive integer",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
          },
        },
        404: {
          description: "No flagged call with that id",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
          },
        },
      },
    },
  },
  "/api/audit/summary": {
    get: {
      tags: ["Audit"],
      summary: "Summarise flagged tool calls",
      description:
        "Counts per severity, signal family, project and egress host for the same filters as `/api/audit/tools` — the numbers behind the Audit page's tiles and `ccam audit`.",
      operationId: "auditSummary",
      parameters: FILTER_PARAMS,
      responses: {
        200: {
          description: "Summary counts",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ToolRiskSummary" } },
          },
        },
        400: badFilter,
      },
    },
  },
  "/api/audit/export": {
    get: {
      tags: ["Audit"],
      summary: "Export flagged tool calls",
      description:
        'Up to 10,000 filtered rows as a download (`Content-Disposition: attachment; filename="tool-risk-audit-<date>.<ext>"`). CSV cells that start with `=`, `+`, `-`, `@`, tab or carriage return are prefixed with `\'` so a spreadsheet never evaluates a recorded command as a formula.',
      operationId: "auditExport",
      parameters: [
        ...FILTER_PARAMS,
        {
          name: "format",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["csv", "json"], default: "csv" },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 10000, default: 10000 },
        },
      ],
      responses: {
        200: {
          description: "The exported rows",
          content: {
            "text/csv": { schema: { type: "string" } },
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  generated_at: { type: "string", format: "date-time" },
                  ruleset_version: { type: "integer" },
                  events: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ToolRiskEvent" },
                  },
                },
              },
            },
          },
        },
        400: badFilter,
      },
    },
  },
  "/api/audit/rules": {
    get: {
      tags: ["Audit"],
      summary: "Describe the built-in ruleset",
      description:
        "Every rule the classifier applies, with its signal family and severity, so a reviewer can see why a call was flagged. `ruleset_version` changes whenever a rule changes; the index is then rebuilt.",
      operationId: "auditRules",
      responses: {
        200: {
          description: "The ruleset",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  ruleset_version: { type: "integer" },
                  signals: { type: "array", items: { type: "string", enum: SIGNAL_ENUM } },
                  severities: { type: "array", items: { type: "string", enum: SEVERITY_ENUM } },
                  rules: { type: "array", items: { $ref: "#/components/schemas/ToolRiskRule" } },
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
