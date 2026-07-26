/**
 * @file Supplementary OpenAPI 3.0 fragments for the AGENT-PLAN.md plan routes
 * (`/api/plans`), the bulk focus hydrate (`/api/focus`), and the session
 * focus/todos endpoints (`/api/sessions/{id}/focus`, `/api/sessions/{id}/todos`).
 * Exports `{ tags, schemas, paths }` for merging into the base spec by
 * `createOpenApiSpec()` via server/openapi-extra.js. Schemas are prefixed
 * `Plan`/`Focus` to avoid collisions with base component schemas.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [
  {
    name: "Plans",
    description:
      "Per-repo AGENT-PLAN.md plans (mirrored read-only, keyed by cwd) and per-session focus declarations (which plan item a session is serving, plus its detour stack and drift verdict)",
  },
];

const errorRef = { $ref: "#/components/schemas/ErrorResponse" };

const schemas = {
  PlanRecord: {
    type: "object",
    description:
      "One repo's ingested AGENT-PLAN.md. The file on disk is the human-owned source of truth; the dashboard only mirrors it. `missing_at` is stamped (and the row kept) when the file disappears.",
    properties: {
      cwd: { type: "string", description: "Absolute working directory the plan belongs to" },
      title: { type: "string", nullable: true, description: "First markdown heading of the file" },
      file_path: { type: "string", description: "Absolute path of the ingested AGENT-PLAN.md" },
      content_hash: {
        type: "string",
        nullable: true,
        description: "sha1 of the last-ingested raw file",
      },
      item_count: { type: "integer" },
      missing_at: {
        type: "string",
        nullable: true,
        description: "ISO timestamp when the file was found missing (null while present)",
      },
      created_at: { type: "string" },
      updated_at: { type: "string" },
    },
  },
  PlanItem: {
    type: "object",
    description:
      "One checkbox item. `checked` mirrors the file's checkbox (human-owned); `declared_done_*` is the agent's completion claim via `ccam focus done N` and survives re-ingest — including across a reorder, since item_id (not item_number) is the real identity.",
    properties: {
      cwd: { type: "string" },
      item_id: {
        type: "string",
        description:
          "The item's permanent identity (from the file's `id:` line, or synthesized for pre-id files) — never changes for the life of the item, unlike item_number",
      },
      item_number: {
        type: "integer",
        nullable: true,
        description:
          "Flat display number, positional — recomputed from file order on every ingest. What `ccam focus set/done` are typed against, but not what's persisted underneath (see item_id). Null for a sub-item (see parent_item_id) — it has no flat number of its own, so ccam can't target it directly; use display_number to show it instead.",
      },
      parent_item_id: {
        type: "string",
        nullable: true,
        description:
          "The parent item's item_id when this is a sub-item (a dotted 'N.M' item nested under top-level item N in the file). Null for a top-level item.",
      },
      display_number: {
        type: "string",
        description:
          'Human-facing number: the flat item_number as a string for a top-level item ("3"), or "<parent\'s number>.<sibling ordinal>" for a sub-item ("3.2"). Always derived, never persisted.',
      },
      text: { type: "string" },
      acceptance: { type: "string", nullable: true },
      detail: {
        type: "string",
        nullable: true,
        description:
          "Optional unbounded supporting context beyond the one-line summary (≤4000 chars)",
      },
      checked: { type: "integer", description: "1 when the file's checkbox is [x]" },
      position: { type: "integer", description: "File order (numbering need not be contiguous)" },
      declared_done_at: { type: "string", nullable: true },
      declared_done_session: { type: "string", nullable: true },
      updated_at: { type: "string" },
    },
  },
  PlanWithItems: {
    type: "object",
    properties: {
      plan: { $ref: "#/components/schemas/PlanRecord" },
      items: { type: "array", items: { $ref: "#/components/schemas/PlanItem" } },
    },
  },
  FocusDetourFrame: {
    type: "object",
    description: "One in-flight detour on a session's focus stack",
    properties: {
      description: { type: "string" },
      pushed_at: { type: "string" },
      prior_item: { type: "integer", nullable: true },
    },
  },
  SessionFocus: {
    type: "object",
    description:
      "A session's declared focus in wire shape: plan-item pointer, detour stack, and the drift auditor's verdict folded to a tri-state boolean (true = drift, false = on track, null = not audited).",
    properties: {
      session_id: { type: "string" },
      cwd: { type: "string", nullable: true },
      item_number: { type: "integer", nullable: true },
      item_text: { type: "string", nullable: true },
      note: { type: "string", nullable: true },
      detour_stack: { type: "array", items: { $ref: "#/components/schemas/FocusDetourFrame" } },
      since: {
        type: "string",
        nullable: true,
        description: "When the current item was declared (set_at)",
      },
      drift: { type: "boolean", nullable: true },
      drift_reason: { type: "string", nullable: true },
      updated_at: { type: "string" },
    },
  },
  FocusHistoryEntry: {
    type: "object",
    description: "One focus timeline entry, rebuilt from the session's `Focus` event rows",
    properties: {
      at: { type: "string" },
      kind: { type: "string", enum: ["item", "detour_push", "detour_pop"] },
      verb: { type: "string", nullable: true },
      item_number: { type: "integer", nullable: true },
      text: { type: "string" },
    },
  },
  FocusWriteRequest: {
    type: "object",
    required: ["verb"],
    description:
      "The explicit (non-hook) focus write. Idempotent: a declaration whose end state equals the current state returns `deduped: true` without writing a Focus event.",
    properties: {
      verb: { type: "string", enum: ["set", "push", "pop", "done"] },
      item_number: { type: "integer", description: "Required for set/done" },
      note: { type: "string", description: "Optional note for set (≤300 chars)" },
      description: { type: "string", description: "Required for push (≤300 chars)" },
    },
  },
  SessionTodo: {
    type: "object",
    description: "One entry of the session's latest TodoWrite list (parse-on-read from events)",
    properties: {
      content: { type: "string" },
      status: { type: "string", enum: ["pending", "in_progress", "completed"] },
      activeForm: { type: "string" },
    },
  },
};

const paths = {
  "/api/plans": {
    get: {
      tags: ["Plans"],
      operationId: "listPlans",
      summary: "List every ingested AGENT-PLAN.md with its items",
      responses: {
        200: {
          description: "All known plans",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  plans: {
                    type: "array",
                    items: {
                      allOf: [
                        { $ref: "#/components/schemas/PlanRecord" },
                        {
                          type: "object",
                          properties: {
                            items: {
                              type: "array",
                              items: { $ref: "#/components/schemas/PlanItem" },
                            },
                          },
                        },
                      ],
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
  "/api/plans/for-cwd": {
    get: {
      tags: ["Plans"],
      operationId: "getPlanForCwd",
      summary: "The plan for one working directory",
      parameters: [
        {
          name: "cwd",
          in: "query",
          required: true,
          schema: { type: "string" },
          description: "Absolute working directory (query-param form because cwds contain slashes)",
        },
      ],
      responses: {
        200: {
          description: "The plan and its items",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/PlanWithItems" } },
          },
        },
        400: { description: "cwd missing", content: { "application/json": { schema: errorRef } } },
        404: {
          description: "No plan for that cwd",
          content: { "application/json": { schema: errorRef } },
        },
      },
    },
  },
  "/api/plans/project/{projectId}": {
    get: {
      tags: ["Plans"],
      operationId: "getProjectPlans",
      summary: "Plan rollup for a project (one entry per mapped cwd that has a plan)",
      parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Plans grouped under the project",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  project_id: { type: "string" },
                  plans: {
                    type: "array",
                    items: {
                      allOf: [
                        { type: "object", properties: { cwd: { type: "string" } } },
                        { $ref: "#/components/schemas/PlanWithItems" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        404: {
          description: "Project not found",
          content: { "application/json": { schema: errorRef } },
        },
      },
    },
  },
  "/api/plans/refresh": {
    post: {
      tags: ["Plans"],
      operationId: "refreshPlan",
      summary: "Force an AGENT-PLAN.md ingest for one cwd now",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["cwd"],
              properties: { cwd: { type: "string" } },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Ingest result (changed=false when the file hash matched)",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { type: "object", properties: { changed: { type: "boolean" } } },
                  { $ref: "#/components/schemas/PlanWithItems" },
                ],
              },
            },
          },
        },
        400: { description: "cwd missing", content: { "application/json": { schema: errorRef } } },
        404: {
          description: "No AGENT-PLAN.md on disk and no stored plan",
          content: { "application/json": { schema: errorRef } },
        },
      },
    },
  },
  "/api/focus": {
    get: {
      tags: ["Plans"],
      operationId: "listActiveFocus",
      summary: "Bulk focus hydrate: every active session's declared focus",
      responses: {
        200: {
          description: "Focus wire shapes for all active sessions",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  focus: { type: "array", items: { $ref: "#/components/schemas/SessionFocus" } },
                },
              },
            },
          },
        },
      },
    },
  },
  "/api/sessions/{id}/focus": {
    get: {
      tags: ["Plans"],
      operationId: "getSessionFocus",
      summary: "One session's focus state, plan context, and focus history",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Focus state (focus is null when never declared)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  focus: {
                    nullable: true,
                    allOf: [{ $ref: "#/components/schemas/SessionFocus" }],
                  },
                  item: { nullable: true, allOf: [{ $ref: "#/components/schemas/PlanItem" }] },
                  plan_title: { type: "string", nullable: true },
                  history: {
                    type: "array",
                    items: { $ref: "#/components/schemas/FocusHistoryEntry" },
                  },
                },
              },
            },
          },
        },
        404: {
          description: "Session not found",
          content: { "application/json": { schema: errorRef } },
        },
      },
    },
    post: {
      tags: ["Plans"],
      operationId: "declareSessionFocus",
      summary: "Declare focus for a session (explicit non-hook write path; strict + idempotent)",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/FocusWriteRequest" } },
        },
      },
      responses: {
        200: {
          description:
            "Updated focus state (`deduped: true` when the declaration was already current)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  focus: { $ref: "#/components/schemas/SessionFocus" },
                  deduped: { type: "boolean" },
                },
              },
            },
          },
        },
        400: {
          description: "Invalid verb/arguments",
          content: { "application/json": { schema: errorRef } },
        },
        404: {
          description: "Session not found",
          content: { "application/json": { schema: errorRef } },
        },
        409: {
          description:
            "UNKNOWN_ITEM (item not in the cwd's plan) or EMPTY_STACK (pop with no detour)",
          content: { "application/json": { schema: errorRef } },
        },
      },
    },
  },
  "/api/sessions/{id}/todos": {
    get: {
      tags: ["Plans"],
      operationId: "getSessionTodos",
      summary: "The session's latest TodoWrite list (parse-on-read)",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: {
        200: {
          description: "Latest todos, or null when the session never called TodoWrite",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  todos: {
                    type: "array",
                    nullable: true,
                    items: { $ref: "#/components/schemas/SessionTodo" },
                  },
                  updated_at: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        404: {
          description: "Session not found",
          content: { "application/json": { schema: errorRef } },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
