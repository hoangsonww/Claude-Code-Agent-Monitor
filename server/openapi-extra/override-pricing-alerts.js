/**
 * @file Enriched OpenAPI OVERRIDE operations for the Pricing and Alerts routes.
 *
 * These eight paths are ALREADY documented in `server/openapi.js`. This module
 * re-declares the SAME operations (identical operationId / tags / request &
 * response `$ref` schema names / parameters) but layers on richer prose
 * descriptions plus realistic request/response/parameter examples so the
 * generated Swagger UI is self-explanatory. The wire contract is unchanged —
 * no new schemas, no new tags. The base `$ref`s under
 * `#/components/{schemas,parameters}` are reused verbatim.
 *
 * Shape: `{ tags: [], schemas: {}, paths: { ... } }`. The `tags` and `schemas`
 * collections are intentionally empty; everything here is a path-level override.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// ---------------------------------------------------------------------------
// Reusable realistic examples (kept here, NOT as components — examples live
// inline on the operations so the override carries no schema/component state).
// ---------------------------------------------------------------------------

/** A representative stored pricing rule (matches PricingRule schema fields). */
const PRICING_RULE_EXAMPLE = {
  model_pattern: "claude-opus-4%",
  display_name: "Claude Opus 4 (family)",
  input_per_mtok: 15,
  output_per_mtok: 75,
  cache_read_per_mtok: 1.5,
  cache_write_per_mtok: 18.75,
  cache_write_1h_per_mtok: 30,
  fast_input_per_mtok: 0,
  fast_output_per_mtok: 0,
  updated_at: "2026-06-25T18:42:11.000Z",
};

/** A second rule to make the list example look like a real catalog. */
const PRICING_RULE_EXAMPLE_2 = {
  model_pattern: "claude-haiku%",
  display_name: "Claude Haiku (family)",
  input_per_mtok: 0.8,
  output_per_mtok: 4,
  cache_read_per_mtok: 0.08,
  cache_write_per_mtok: 1,
  cache_write_1h_per_mtok: 1.6,
  fast_input_per_mtok: 0,
  fast_output_per_mtok: 0,
  updated_at: "2026-06-20T09:15:00.000Z",
};

/** A full CostResult-shaped example body returned by both cost endpoints. */
const COST_RESULT_EXAMPLE = {
  total_cost: 12.8431,
  breakdown: [
    {
      model: "claude-opus-4-8",
      speed: "standard",
      inference_geo: "global",
      service_tier: "standard",
      input_tokens: 184320,
      output_tokens: 51200,
      cache_read_tokens: 920000,
      cache_write_tokens: 64000,
      cache_write_1h_tokens: 12000,
      web_search_requests: 8,
      web_fetch_requests: 3,
      code_execution_requests: 2,
      cost: 8.4127,
      matched_rule: "claude-opus-4%",
    },
    {
      model: "claude-haiku-4-5",
      speed: "fast",
      inference_geo: "us",
      service_tier: "standard",
      input_tokens: 512000,
      output_tokens: 128000,
      cache_read_tokens: 64000,
      cache_write_tokens: 8000,
      cache_write_1h_tokens: 0,
      web_search_requests: 0,
      web_fetch_requests: 0,
      code_execution_requests: 0,
      cost: 1.5904,
      matched_rule: "claude-haiku%",
    },
  ],
  feature_costs: {
    web_search_cost: 0.08,
    web_fetch_cost: 0,
    code_execution_cost: 0,
    code_execution_hours_estimated: 0.1667,
    code_execution_free_hours: 50,
  },
  unpriced_models: [
    {
      model: "claude-experimental-preview",
      input_tokens: 4096,
      output_tokens: 2048,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    },
  ],
  daily_costs: [
    { date: "2026-06-23", cost: 3.1102 },
    { date: "2026-06-24", cost: 5.7421 },
    { date: "2026-06-25", cost: 3.9908 },
  ],
};

/** A single fired-alert event row. `details` is a JSON STRING, per the route. */
const ALERT_EVENT_EXAMPLE = {
  id: 42,
  rule_id: "7c1d8e2a-9b34-4f50-a1c2-6d8e0f3b5a91",
  rule_name: "Idle session watchdog",
  rule_type: "inactivity",
  message: "Session sess_8f2a has been inactive for 35 minutes",
  details: '{"session_id":"sess_8f2a","minutes":35,"threshold":30}',
  acknowledged: 0,
  created_at: "2026-06-25T17:05:44.000Z",
};

/** A serialized alert RULE (config parsed to an object, enabled coerced bool). */
const ALERT_RULE_EXAMPLE = {
  id: "7c1d8e2a-9b34-4f50-a1c2-6d8e0f3b5a91",
  name: "Idle session watchdog",
  rule_type: "inactivity",
  config: { minutes: 30 },
  enabled: true,
  cooldown_seconds: 300,
  created_at: "2026-06-10T12:00:00.000Z",
  updated_at: "2026-06-24T08:30:00.000Z",
};

/** A second rule of a different type for the list example. */
const ALERT_RULE_EXAMPLE_2 = {
  id: "1a2b3c4d-5e6f-7081-9201-aabbccddeeff",
  name: "Heavy token burn",
  rule_type: "token_threshold",
  config: { total_tokens: 5000000 },
  enabled: true,
  cooldown_seconds: 600,
  created_at: "2026-06-12T14:20:00.000Z",
  updated_at: "2026-06-12T14:20:00.000Z",
};

module.exports = {
  // No new tags — reuse the base "Pricing" and "Alerts" tags.
  tags: [],
  // No new schemas — every $ref below points at the base components.
  schemas: {},
  paths: {
    // -----------------------------------------------------------------------
    // PRICING
    // -----------------------------------------------------------------------
    "/api/pricing": {
      get: {
        tags: ["Pricing"],
        summary: "List pricing rules",
        operationId: "listPricingRules",
        description:
          "Returns every stored pricing rule, wrapped as `{ pricing: [ ... ] }`. " +
          "Each rule carries per-MTok (per-million-token) rates for input, output, " +
          "cache reads, and the two cache-write tiers (5-minute and 1-hour " +
          "ephemeral), plus optional fast-mode input/output rates (0 = not " +
          "configured). Rules are matched against model ids by treating the SQL " +
          "`%` wildcard in `model_pattern` as `.*`; when several rules match, the " +
          "longest (most specific) pattern wins. Rates here feed the cost " +
          "calculations under `/api/pricing/cost`.",
        responses: {
          200: {
            description: "Pricing rules",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PricingListResponse" },
                example: { pricing: [PRICING_RULE_EXAMPLE, PRICING_RULE_EXAMPLE_2] },
              },
            },
          },
        },
      },
      put: {
        tags: ["Pricing"],
        summary: "Create/update pricing rule",
        operationId: "upsertPricingRule",
        description:
          "Creates a pricing rule or updates the existing one with the same " +
          "`model_pattern` (upsert keyed on `model_pattern`). `model_pattern` and " +
          "`display_name` are required; every `*_per_mtok` rate is optional and " +
          "defaults to 0 when omitted. Use the SQL `%` wildcard in `model_pattern` " +
          "to match a model family (e.g. `claude-opus-4%`). Set " +
          "`fast_input_per_mtok` / `fast_output_per_mtok` only if the model bills " +
          "fast-mode usage at a premium; leave them 0 otherwise. " +
          "Note the asymmetry with the list endpoint: the response wraps a SINGLE " +
          "stored rule as `{ pricing: <rule> }` (not an array). A missing " +
          "`model_pattern` or `display_name` returns 400 `INVALID_INPUT`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PricingUpsertRequest" },
              example: {
                model_pattern: "claude-opus-4%",
                display_name: "Claude Opus 4 (family)",
                input_per_mtok: 15,
                output_per_mtok: 75,
                cache_read_per_mtok: 1.5,
                cache_write_per_mtok: 18.75,
                cache_write_1h_per_mtok: 30,
                fast_input_per_mtok: 0,
                fast_output_per_mtok: 0,
              },
            },
          },
        },
        responses: {
          200: {
            description: "Pricing rule stored",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PricingUpsertResponse" },
                example: { pricing: PRICING_RULE_EXAMPLE },
              },
            },
          },
          400: {
            description: "Invalid request body",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: {
                    code: "INVALID_INPUT",
                    message: "model_pattern and display_name are required",
                  },
                },
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
        description:
          "Deletes the pricing rule whose `model_pattern` exactly matches the " +
          "`pattern` path segment. The pattern is URL-ENCODED: the SQL `%` " +
          "wildcard must be sent as `%25` (so `claude-opus-4%` becomes " +
          "`claude-opus-4%25`). The server decodes it before lookup. Returns " +
          "`{ ok: true }` on success, or 404 `NOT_FOUND` if no rule matches.",
        parameters: [
          // Mirrors components.parameters.PatternPath (name/in/required/schema
          // identical), inlined so a realistic URL-encoded example can be
          // attached — a bare $ref cannot carry an `example`.
          {
            name: "pattern",
            in: "path",
            required: true,
            schema: { type: "string" },
            description:
              "Model pattern (URL-encoded). The SQL `%` wildcard must be escaped " +
              "as `%25` (e.g. `claude-opus-4%25` for the rule `claude-opus-4%`).",
            example: "claude-opus-4%25",
          },
        ],
        responses: {
          200: {
            description: "Rule deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeleteOkResponse" },
                example: { ok: true },
              },
            },
          },
          404: {
            description: "Pricing rule not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: { code: "NOT_FOUND", message: "Pricing rule not found" },
                },
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
        description:
          "Computes the aggregate token cost across EVERY session by matching " +
          "each (model, speed, inference_geo, service_tier) usage bucket against " +
          "the most specific pricing rule. Returns `total_cost`, a per-bucket " +
          "`breakdown`, `feature_costs` (web-search surcharge, code-execution " +
          "container time with the org free-hours allowance applied), " +
          "`unpriced_models` (usage with no matching rule, contributing $0 so the " +
          "total stays honest), and `daily_costs` bucketed by local calendar day. " +
          "Pass `tz_offset` (minutes; the JS `Date.getTimezoneOffset()` value, " +
          "e.g. 300 for US Eastern, -120 for CEST) so day boundaries align with " +
          "the viewer's timezone; omitted/invalid offsets fall back to UTC.",
        parameters: [
          {
            name: "tz_offset",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description:
              "Viewer timezone offset in minutes, as returned by " +
              "`Date.getTimezoneOffset()` (positive for zones behind UTC, e.g. " +
              "300 = US Eastern, -120 = CEST). Shifts the `daily_costs` day " +
              "boundaries; invalid or omitted values default to UTC.",
            example: 300,
          },
        ],
        responses: {
          200: {
            description: "Cost result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CostResult" },
                example: COST_RESULT_EXAMPLE,
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
        description:
          "Same cost computation as `/api/pricing/cost`, but scoped to a single " +
          "session's token usage. Returns the identical `CostResult` shape " +
          "(`total_cost`, `breakdown`, `feature_costs`, `unpriced_models`, " +
          "`daily_costs`); `daily_costs` holds at most one entry — the session's " +
          "start date in the viewer's local day, or an empty array if the session " +
          "id is unknown. Pass `tz_offset` (minutes, `Date.getTimezoneOffset()`) " +
          "to place that start date in the viewer's timezone; defaults to UTC.",
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Session ID to price.",
            example: "sess_8f2a3b1c",
          },
          {
            name: "tz_offset",
            in: "query",
            required: false,
            schema: { type: "integer" },
            description:
              "Viewer timezone offset in minutes (`Date.getTimezoneOffset()`; " +
              "300 = US Eastern, -120 = CEST). Places the session start date in " +
              "the viewer's local day; defaults to UTC when omitted or invalid.",
            example: 300,
          },
        ],
        responses: {
          200: {
            description: "Session cost result",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CostResult" },
                example: {
                  ...COST_RESULT_EXAMPLE,
                  total_cost: 8.4127,
                  daily_costs: [{ date: "2026-06-25", cost: 8.4127 }],
                },
              },
            },
          },
        },
      },
    },
    // -----------------------------------------------------------------------
    // ALERTS
    // -----------------------------------------------------------------------
    "/api/alerts": {
      get: {
        tags: ["Alerts"],
        summary: "List fired alerts, newest first",
        operationId: "listAlerts",
        description:
          "Returns the fired-alert feed, newest first, as " +
          "`{ alerts, total, unacked, limit, offset }`. Each alert event carries " +
          "the originating rule's id/name/type, a human-readable `message`, an " +
          "`acknowledged` flag (0/1), `created_at`, and `details` — which is a " +
          "JSON STRING (not an object) that callers must `JSON.parse`. " +
          "`limit` is clamped to 1–200 (default 50) and negative `offset` is " +
          "clamped to 0. Set `unacked=true` to return only unacknowledged alerts; " +
          "`total` then counts only unacked rows, while `unacked` always reports " +
          "the global unacknowledged count.",
        parameters: [
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            description:
              "Page size, clamped to the 1–200 range (default 50). Values " +
              "outside the range are clamped, not rejected.",
            example: 50,
          },
          {
            name: "offset",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 0 },
            description: "Pagination offset; negative values are clamped to 0.",
            example: 0,
          },
          {
            name: "unacked",
            in: "query",
            required: false,
            schema: { type: "boolean" },
            description:
              'When the literal string "true", return only unacknowledged ' +
              "alerts (and scope `total` to that subset).",
            example: "true",
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
                example: {
                  alerts: [
                    ALERT_EVENT_EXAMPLE,
                    {
                      id: 41,
                      rule_id: "1a2b3c4d-5e6f-7081-9201-aabbccddeeff",
                      rule_name: "Heavy token burn",
                      rule_type: "token_threshold",
                      message: "Session sess_3c1d crossed 5,000,000 total tokens",
                      details:
                        '{"session_id":"sess_3c1d","total_tokens":5120000,"threshold":5000000}',
                      acknowledged: 1,
                      created_at: "2026-06-25T16:40:02.000Z",
                    },
                  ],
                  total: 2,
                  unacked: 1,
                  limit: 50,
                  offset: 0,
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
        description:
          "Returns all alert rules as `{ rules: [ ... ] }`. Each rule's `config` " +
          "is returned as a PARSED object (the column is stored as JSON text), and " +
          "`enabled` is coerced to a boolean. The `config` shape depends on " +
          "`rule_type`: `event_pattern` uses event_type / tool_name / " +
          "summary_contains plus optional count + window_minutes; `inactivity` " +
          "uses `minutes`; `status_duration` uses `status` + `minutes`; " +
          "`token_threshold` uses `total_tokens`.",
        responses: {
          200: {
            description: "All alert rules with parsed config objects",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
                example: { rules: [ALERT_RULE_EXAMPLE, ALERT_RULE_EXAMPLE_2] },
              },
            },
          },
        },
      },
      post: {
        tags: ["Alerts"],
        summary: "Create an alert rule",
        operationId: "createAlertRule",
        description:
          "Creates an alert rule and returns it serialized as `{ rule: { ... } }` " +
          "with HTTP 201. `name`, `rule_type`, and `config` are required; the " +
          "`config` shape is validated per `rule_type`:\n" +
          "- `event_pattern`: `{ event_type?, tool_name?, summary_contains?, " +
          "count?, window_minutes? }` — fires when matching events accumulate.\n" +
          "- `inactivity`: `{ minutes }` — fires when a session goes idle.\n" +
          "- `status_duration`: `{ status, minutes }` — fires when a session " +
          "holds a status too long.\n" +
          "- `token_threshold`: `{ total_tokens }` — fires when usage crosses a " +
          "ceiling.\n" +
          "`enabled` defaults to true and `cooldown_seconds` defaults to 300 " +
          "(must be a non-negative integer). A bad name, unknown `rule_type`, " +
          "invalid `config`, or negative cooldown returns 400 `INVALID_INPUT`.",
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
              examples: {
                inactivity: {
                  summary: "Inactivity rule",
                  value: {
                    name: "Idle session watchdog",
                    rule_type: "inactivity",
                    config: { minutes: 30 },
                    enabled: true,
                    cooldown_seconds: 300,
                  },
                },
                event_pattern: {
                  summary: "Event-pattern rule (repeated tool errors)",
                  value: {
                    name: "Repeated Bash failures",
                    rule_type: "event_pattern",
                    config: {
                      event_type: "PostToolUse",
                      tool_name: "Bash",
                      summary_contains: "error",
                      count: 3,
                      window_minutes: 10,
                    },
                    enabled: true,
                    cooldown_seconds: 600,
                  },
                },
                status_duration: {
                  summary: "Status-duration rule",
                  value: {
                    name: "Stuck waiting too long",
                    rule_type: "status_duration",
                    config: { status: "waiting", minutes: 15 },
                    enabled: true,
                    cooldown_seconds: 300,
                  },
                },
                token_threshold: {
                  summary: "Token-threshold rule",
                  value: {
                    name: "Heavy token burn",
                    rule_type: "token_threshold",
                    config: { total_tokens: 5000000 },
                    enabled: true,
                    cooldown_seconds: 600,
                  },
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
                example: { rule: ALERT_RULE_EXAMPLE },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: { code: "INVALID_INPUT", message: "name is required" },
                },
              },
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
        description:
          "Partially updates an alert rule and returns it serialized as " +
          "`{ rule: { ... } }`. Only the fields present in the body change; " +
          "`rule_type` CANNOT be changed and any supplied `config` is validated " +
          "against the rule's STORED type. `name` (if present) must be a " +
          "non-empty string and `cooldown_seconds` (if present) must be a " +
          "non-negative integer. Returns 404 `NOT_FOUND` for an unknown id, or " +
          "400 `INVALID_INPUT` for a bad name, invalid config, or negative " +
          "cooldown.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Alert rule ID (UUID).",
            example: "7c1d8e2a-9b34-4f50-a1c2-6d8e0f3b5a91",
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
              examples: {
                disableRule: {
                  summary: "Disable a rule without touching its config",
                  value: { enabled: false },
                },
                retuneInactivity: {
                  summary: "Re-tune an inactivity rule's threshold + cooldown",
                  value: { config: { minutes: 45 }, cooldown_seconds: 900 },
                },
                rename: {
                  summary: "Rename a rule",
                  value: { name: "Idle session watchdog (prod)" },
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
                example: {
                  rule: { ...ALERT_RULE_EXAMPLE, enabled: false, cooldown_seconds: 900 },
                },
              },
            },
          },
          400: {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: {
                    code: "INVALID_INPUT",
                    message: "cooldown_seconds must be a non-negative integer",
                  },
                },
              },
            },
          },
          404: {
            description: "Rule not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: { code: "NOT_FOUND", message: "Alert rule not found" },
                },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Alerts"],
        summary: "Delete an alert rule and its fired-alert history",
        operationId: "deleteAlertRule",
        description:
          "Deletes the alert rule with the given id. Its fired-alert history " +
          "cascades away with it (the foreign key is ON DELETE CASCADE), so any " +
          "alerts previously raised by this rule are also removed from the feed. " +
          "Returns `{ ok: true }` on success or 404 `NOT_FOUND` for an unknown id.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Alert rule ID (UUID).",
            example: "7c1d8e2a-9b34-4f50-a1c2-6d8e0f3b5a91",
          },
        ],
        responses: {
          200: {
            description: "Deletion confirmation",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
                example: { ok: true },
              },
            },
          },
          404: {
            description: "Rule not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: { code: "NOT_FOUND", message: "Alert rule not found" },
                },
              },
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
        description:
          "Marks a single fired alert (by its integer event id) as acknowledged " +
          "and returns the updated row as `{ alert: { ... } }` (with " +
          "`acknowledged: 1`). Acknowledging also broadcasts an `alert_updated` " +
          "WebSocket message so connected dashboards refresh their unacked badge. " +
          "The id must be numeric; an unknown id returns 404 `NOT_FOUND`.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer" },
            description: "Alert event ID (numeric).",
            example: 42,
          },
        ],
        responses: {
          200: {
            description: "Acknowledged alert row",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
                example: { alert: { ...ALERT_EVENT_EXAMPLE, acknowledged: 1 } },
              },
            },
          },
          404: {
            description: "Alert not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
                example: {
                  error: { code: "NOT_FOUND", message: "Alert not found" },
                },
              },
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
        description:
          "Acknowledges every currently unacknowledged alert in one call and " +
          "returns `{ ok: true, acknowledged: <count> }` where `acknowledged` is " +
          "the number of rows actually updated. When at least one alert is " +
          "acknowledged, an `alert_updated` WebSocket message (`{ acked_all: " +
          "true }`) is broadcast so dashboards clear their unacked badge. Calling " +
          "this when nothing is unacked returns `acknowledged: 0`.",
        responses: {
          200: {
            description: "Count of acknowledged alerts",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
                example: { ok: true, acknowledged: 3 },
              },
            },
          },
        },
      },
    },
  },
};
