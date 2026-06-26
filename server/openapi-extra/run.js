/**
 * @file OpenAPI 3.0 path + schema fragments for the dashboard's Run feature
 * (`server/routes/run.js`, mounted at `/api/run`). Spawns and supervises real
 * `claude` Code subprocesses (headless one-shot or multi-turn conversation),
 * streams structured envelopes over the dashboard WebSocket, and exposes a
 * small CRUD-ish surface for run management + history.
 *
 * Merged into the base spec by `server/openapi-extra.js` -> `createOpenApiSpec()`.
 * Exports exactly `{ tags, schemas, paths }`. Every schema name is prefixed
 * `Run`. The shared error envelope `ErrorResponse` (`{ error: { code, message } }`)
 * is defined in the base spec and only referenced here — never redefined.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [
  {
    name: "Run",
    description:
      "Spawn and supervise Claude Code runs from the dashboard (headless or interactive conversation), stream output over WebSocket, and manage run history",
  },
];

/**
 * Reusable response fragment for the loopback same-origin guard. Applied to
 * EVERY route in `server/routes/run.js` (the router-level `sameOriginGuard`
 * middleware): browser requests whose `Origin`/`Referer` host is not one of
 * localhost / 127.0.0.1 / ::1 / 0.0.0.0 are rejected before any handler runs.
 * Server/CLI requests (curl) usually carry no `Origin` and pass through.
 */
const ebadOrigin403 = {
  description:
    "Cross-origin rejected (EBADORIGIN). Enforced by the router-level loopback same-origin guard on every /api/run route: a browser request carrying an Origin/Referer whose host is not localhost / 127.0.0.1 / ::1 / 0.0.0.0 is refused. Requests without an Origin header (e.g. curl) are allowed.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
      example: {
        error: { code: "EBADORIGIN", message: "cross-origin requests are not allowed" },
      },
    },
  },
};

const schemas = {
  RunHandle: {
    type: "object",
    description:
      "Live, in-memory view of a spawned `claude` subprocess. Returned by GET /api/run (in `items`), POST /api/run (201), and GET /api/run/{id}. Backed by the spawner's handle map, which reaps each handle 5 minutes after the process exits — after that the run is only visible via GET /api/run/history.",
    required: [
      "id",
      "pid",
      "mode",
      "cwd",
      "model",
      "permissionMode",
      "effort",
      "prompt",
      "argv",
      "resumeSessionId",
      "status",
      "startedAt",
      "endedAt",
      "exitCode",
      "signal",
      "error",
      "sessionId",
      "envelopeCount",
      "stdoutTail",
      "stderrTail",
    ],
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Server-generated run id (UUID v4). Distinct from the Claude session id.",
        example: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
      },
      pid: {
        type: "integer",
        nullable: true,
        description: "OS process id of the spawned `claude` child, or null if the spawn failed.",
        example: 48213,
      },
      mode: {
        type: "string",
        enum: ["headless", "conversation"],
        description:
          "`headless`: single-shot — prompt is passed via argv `-p`, stdin is closed, the process exits after one turn. `conversation`: multi-turn — stdin stays open (`--input-format stream-json`) and follow-up turns are delivered via POST /api/run/{id}/message.",
        example: "conversation",
      },
      cwd: {
        type: "string",
        description:
          "Absolute working directory the child was spawned in (sanitised at request time — must be an existing absolute directory).",
        example: "/Users/dev/projects/my-app",
      },
      model: {
        type: "string",
        nullable: true,
        description: "Model alias/id passed via `--model`, or null to inherit the user's default.",
        example: "claude-opus-4-8",
      },
      permissionMode: {
        type: "string",
        enum: ["acceptEdits", "default", "plan", "bypassPermissions"],
        description:
          "Permission mode passed via `--permission-mode`. Defaults to `acceptEdits` when omitted or invalid.",
        example: "acceptEdits",
      },
      effort: {
        type: "string",
        enum: ["low", "medium", "high", "xhigh", "max"],
        nullable: true,
        description:
          "Thinking-effort level passed via `--effort` (higher = more reasoning tokens before the assistant turn). Null inherits the model default.",
        example: "high",
      },
      prompt: {
        type: "string",
        description:
          "The initial user prompt. May be empty only when resuming a conversation (the child idles on the resumed transcript until a follow-up arrives).",
        example: "Refactor the auth module and add tests.",
      },
      argv: {
        type: "array",
        items: { type: "string" },
        description:
          "Exact argv vector passed to the `claude` binary (always includes `--output-format stream-json --verbose --include-partial-messages` plus the resolved flags).",
        example: [
          "--output-format",
          "stream-json",
          "--verbose",
          "--include-partial-messages",
          "--permission-mode",
          "acceptEdits",
          "--input-format",
          "stream-json",
          "--model",
          "claude-opus-4-8",
        ],
      },
      resumeSessionId: {
        type: "string",
        nullable: true,
        description:
          "Claude session id this run resumed (`--resume`), or null for a fresh run. Conversation mode only.",
        example: null,
      },
      status: {
        type: "string",
        enum: ["spawning", "running", "completed", "error", "killed"],
        description:
          "Lifecycle status. `spawning` -> `running` on the first parsed output envelope; terminal states are `completed` (exit 0), `error` (non-zero exit or spawn error), or `killed` (terminated via DELETE). Each transition is broadcast as a `run_status` WebSocket message.",
        example: "running",
      },
      startedAt: {
        type: "integer",
        format: "int64",
        description: "Spawn time in epoch milliseconds.",
        example: 1718000000000,
      },
      endedAt: {
        type: "integer",
        format: "int64",
        nullable: true,
        description: "Exit time in epoch milliseconds, or null while still live.",
        example: null,
      },
      exitCode: {
        type: "integer",
        nullable: true,
        description:
          "Process exit code once the child exits; null while running or if killed by signal.",
        example: null,
      },
      signal: {
        type: "string",
        nullable: true,
        description:
          "Terminating signal name (e.g. `SIGTERM`/`SIGKILL`) if the child was killed by a signal; null otherwise.",
        example: null,
      },
      error: {
        type: "string",
        nullable: true,
        description:
          "Spawn/runtime error message if the child failed to start or errored; null otherwise.",
        example: null,
      },
      sessionId: {
        type: "string",
        nullable: true,
        description:
          "Claude session id, captured from the `system/init` stream envelope (optimistically pre-seeded with resumeSessionId). Used to deep-link to /api/sessions/{id}. Null until the init envelope arrives.",
        example: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      },
      envelopeCount: {
        type: "integer",
        minimum: 0,
        description:
          "Total stream-json envelopes parsed for this run so far (monotonic; not capped by the in-memory replay buffer).",
        example: 12,
      },
      stdoutTail: {
        type: "string",
        description:
          "Trailing slice of the child's raw stdout (capped at ~4 KiB) for quick diagnostics.",
        example: '{"type":"result","subtype":"success",...}\n',
      },
      stderrTail: {
        type: "string",
        description:
          "Trailing slice of the child's raw stderr (capped at ~4 KiB); also captures parse errors.",
        example: "",
      },
    },
  },

  RunHandleWithEnvelopes: {
    allOf: [
      { $ref: "#/components/schemas/RunHandle" },
      {
        type: "object",
        description:
          "RunHandle plus the in-memory envelope replay buffer, returned by GET /api/run/{id}?envelopes=1.",
        required: ["envelopes"],
        properties: {
          envelopes: {
            type: "array",
            description:
              "The most recent stream-json envelopes (capped at 500 per handle) passed through verbatim from the `claude` child — system/init, assistant text + tool_use, user tool_result, result/success, partial stream_event deltas, etc. Lets a late-attaching client replay what it missed. Full transcript is always available via /api/sessions/{id}.",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
    ],
  },

  RunListResponse: {
    type: "object",
    description: "All currently-tracked run handles (newest first) plus concurrency telemetry.",
    required: ["items", "maxConcurrent", "activeCount"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/RunHandle" },
        description:
          "Live + recently-exited handles, sorted by startedAt descending. Handles are reaped 5 minutes after exit.",
      },
      maxConcurrent: {
        type: "integer",
        description:
          "Concurrency cap (env `RUN_MAX_CONCURRENT`, default effectively uncapped at 10000). Spawns over this throw ECONCURRENCY (HTTP 429).",
        example: 10000,
      },
      activeCount: {
        type: "integer",
        minimum: 0,
        description: "Number of handles currently in `spawning` or `running` status.",
        example: 2,
      },
    },
  },

  RunHistoryItem: {
    type: "object",
    description:
      "A persisted run record from the `dashboard_runs` sqlite table. Survives the 5-minute in-memory reap so past runs remain visible and resumable. Fields are snake_case (DB column names) and timestamps are ISO-8601 strings, distinct from the camelCase epoch-ms fields on RunHandle.",
    required: [
      "id",
      "session_id",
      "mode",
      "cwd",
      "model",
      "permission_mode",
      "effort",
      "resume_session_id",
      "prompt_preview",
      "status",
      "exit_code",
      "started_at",
      "ended_at",
      "isLive",
    ],
    properties: {
      id: {
        type: "string",
        format: "uuid",
        description: "Run id (matches RunHandle.id).",
        example: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
      },
      session_id: {
        type: "string",
        nullable: true,
        description: "Claude session id once known (from system/init), else null.",
        example: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      },
      mode: {
        type: "string",
        enum: ["headless", "conversation"],
        description: "Run mode at spawn time.",
        example: "conversation",
      },
      cwd: {
        type: "string",
        description: "Absolute working directory the run was spawned in.",
        example: "/Users/dev/projects/my-app",
      },
      model: {
        type: "string",
        nullable: true,
        description: "Model used, or null for the default.",
        example: "claude-opus-4-8",
      },
      permission_mode: {
        type: "string",
        nullable: true,
        enum: ["acceptEdits", "default", "plan", "bypassPermissions"],
        description: "Permission mode recorded at spawn time.",
        example: "acceptEdits",
      },
      effort: {
        type: "string",
        nullable: true,
        enum: ["low", "medium", "high", "xhigh", "max"],
        description: "Effort level recorded at spawn time, or null.",
        example: "high",
      },
      resume_session_id: {
        type: "string",
        nullable: true,
        description: "Session id this run resumed, or null.",
        example: null,
      },
      prompt_preview: {
        type: "string",
        nullable: true,
        description:
          "First 500 characters of the initial prompt (truncated preview for the history list), or null.",
        example: "Refactor the auth module and add tests.",
      },
      status: {
        type: "string",
        enum: ["spawning", "running", "completed", "error", "killed", "abandoned"],
        description:
          "Persisted status. `abandoned` is set on server boot for rows left `running`/`spawning` by a previous process (their in-memory handles were wiped by the restart) so the UI does not show them as live.",
        example: "completed",
      },
      exit_code: {
        type: "integer",
        nullable: true,
        description: "Recorded process exit code, or null.",
        example: 0,
      },
      started_at: {
        type: "string",
        format: "date-time",
        description: "Spawn time (ISO-8601).",
        example: "2026-06-25T17:00:00.000Z",
      },
      ended_at: {
        type: "string",
        format: "date-time",
        nullable: true,
        description: "Exit time (ISO-8601), or null if still running / never recorded.",
        example: "2026-06-25T17:01:42.500Z",
      },
      isLive: {
        type: "boolean",
        description:
          "Computed at request time: true when a live in-memory handle for this id is currently `running` or `spawning`. Lets the UI mark which history rows are re-attachable.",
        example: false,
      },
    },
  },

  RunHistoryResponse: {
    type: "object",
    description:
      "Persisted run history, most recent first. Empty `items` when the persistence DB is unavailable.",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/RunHistoryItem" },
      },
    },
  },

  RunCwdSuggestion: {
    type: "object",
    description:
      "A suggested working directory for spawning a run. Only directories that still exist on disk are returned.",
    required: ["kind", "path", "label"],
    properties: {
      kind: {
        type: "string",
        enum: ["dashboard", "home", "recent"],
        description:
          "`dashboard`: the dashboard server's own cwd (always first). `home`: $HOME. `recent`: distinct cwds Claude Code has been used in, sourced from the sessions table.",
        example: "recent",
      },
      path: {
        type: "string",
        description: "Absolute, resolved directory path.",
        example: "/Users/dev/projects/my-app",
      },
      label: {
        type: "string",
        description: "Human-friendly label (defaults to the directory basename).",
        example: "my-app",
      },
    },
  },

  RunCwdsResponse: {
    type: "object",
    description: "Working-directory suggestions for the Run launcher.",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/components/schemas/RunCwdSuggestion" },
      },
    },
  },

  RunFilesResponse: {
    type: "object",
    description:
      "File-path autocomplete results for the prompt editor's `@` references — up to 40 paths relative to the given cwd, shortest first.",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: { type: "string" },
        description:
          "Paths relative to the resolved cwd. Dotfiles (except .env/.gitignore) and heavy build dirs (node_modules, .git, dist, build, etc.) are skipped.",
        example: ["package.json", "src/index.ts", "server/routes/run.js"],
      },
    },
  },

  RunBinaryResponse: {
    type: "object",
    description:
      "Whether the `claude` binary is resolvable on PATH (probed via which/where; the binary is not invoked). Lets the UI warn before the user clicks Run.",
    required: ["found", "path"],
    properties: {
      found: {
        type: "boolean",
        description: "True when `claude` resolves on PATH.",
        example: true,
      },
      path: {
        type: "string",
        nullable: true,
        description: "Absolute path to the resolved `claude` binary, or null when not found.",
        example: "/usr/local/bin/claude",
      },
    },
  },

  RunSpawnRequest: {
    type: "object",
    description:
      "Request body for spawning a run. SIDE EFFECT: a successful call spawns a real `claude` process in `cwd`, begins streaming `run_stream`/`run_status` WebSocket messages, and persists a row to `dashboard_runs`.",
    required: ["prompt"],
    properties: {
      prompt: {
        type: "string",
        description:
          "Initial user prompt. Required and non-empty UNLESS mode is `conversation` AND resumeSessionId is set (a resumed conversation may start empty and idle on stdin).",
        example: "Refactor the auth module and add tests.",
      },
      mode: {
        type: "string",
        enum: ["headless", "conversation"],
        default: "conversation",
        description:
          "`headless` for a single-shot run; `conversation` for a multi-turn run that accepts follow-ups via POST /api/run/{id}/message. Any value other than `headless` is treated as `conversation`.",
        example: "conversation",
      },
      cwd: {
        type: "string",
        description:
          "Absolute working directory for the child. Must exist as a directory at request time. Omitted/empty defaults to the dashboard server's cwd. Non-absolute or missing paths are rejected with EBADCWD.",
        example: "/Users/dev/projects/my-app",
      },
      model: {
        type: "string",
        description:
          "Optional model alias/id passed via `--model`. Omit to inherit the user's default.",
        example: "claude-opus-4-8",
      },
      resumeSessionId: {
        type: "string",
        description:
          "Optional Claude session id to resume via `--resume`. Must match /^[A-Za-z0-9-]{8,}$/ and requires conversation mode, else EBADSESSION / EBADMODE.",
        example: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      },
      effort: {
        type: "string",
        enum: ["low", "medium", "high", "xhigh", "max"],
        description:
          "Optional thinking-effort level passed via `--effort`. An invalid value is rejected with EBADEFFORT.",
        example: "high",
      },
      permissionMode: {
        type: "string",
        enum: ["acceptEdits", "default", "plan", "bypassPermissions"],
        default: "acceptEdits",
        description:
          "Permission mode passed via `--permission-mode`. Unknown values silently fall back to `acceptEdits`.",
        example: "acceptEdits",
      },
    },
  },

  RunSpawnConcurrencyResponse: {
    type: "object",
    description:
      "HTTP 429 body when the concurrency cap is reached (ECONCURRENCY). In addition to the standard `error` envelope, this response carries a top-level `running` array listing the runs currently occupying the cap.",
    required: ["error", "running"],
    properties: {
      error: { $ref: "#/components/schemas/ErrorObject" },
      running: {
        type: "array",
        description:
          "The live runs (status running/spawning) that are holding the concurrency slots.",
        items: {
          type: "object",
          required: ["id", "pid", "startedAt", "mode"],
          properties: {
            id: { type: "string", format: "uuid", example: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c" },
            pid: { type: "integer", nullable: true, example: 48213 },
            startedAt: { type: "integer", format: "int64", example: 1718000000000 },
            mode: { type: "string", enum: ["headless", "conversation"], example: "conversation" },
          },
        },
      },
    },
  },

  RunMessageRequest: {
    type: "object",
    description:
      "Request body for sending a follow-up turn into a running conversation. SIDE EFFECT: writes a stream-json user envelope to the child's stdin and broadcasts a `run_input_ack` WebSocket message.",
    required: ["text"],
    properties: {
      text: {
        type: "string",
        description: "The follow-up user message. Required and non-empty (else EBADINPUT).",
        example: "Also update the README to document the new flags.",
      },
    },
  },

  RunMessageResponse: {
    type: "object",
    description: "Acknowledgement that the follow-up turn was written to the child's stdin.",
    required: ["messageId"],
    properties: {
      messageId: {
        type: "string",
        format: "uuid",
        description:
          "Server-generated id for this input turn; echoed in the `run_input_ack` WebSocket message.",
        example: "9c0d1e2f-3a4b-5c6d-7e8f-9a0b1c2d3e4f",
      },
    },
  },

  RunKillResponse: {
    type: "object",
    description: "Acknowledgement that a kill was issued (or that the run had already terminated).",
    required: ["ok"],
    properties: {
      ok: { type: "boolean", enum: [true], example: true },
    },
  },
};

const paths = {
  "/api/run": {
    get: {
      tags: ["Run"],
      summary: "List live + recently-exited runs",
      description:
        "Returns every run handle currently held in memory (newest first) plus concurrency telemetry (`maxConcurrent`, `activeCount`). Handles are reaped 5 minutes after the process exits, so terminal runs disappear from here but remain in GET /api/run/history. Read-only — no process is spawned. The loopback same-origin guard applies.",
      operationId: "runList",
      responses: {
        200: {
          description: "Tracked runs and concurrency telemetry",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunListResponse" },
              example: {
                items: [
                  {
                    id: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
                    pid: 48213,
                    mode: "conversation",
                    cwd: "/Users/dev/projects/my-app",
                    model: "claude-opus-4-8",
                    permissionMode: "acceptEdits",
                    effort: "high",
                    prompt: "Refactor the auth module and add tests.",
                    argv: [
                      "--output-format",
                      "stream-json",
                      "--verbose",
                      "--include-partial-messages",
                      "--permission-mode",
                      "acceptEdits",
                      "--input-format",
                      "stream-json",
                    ],
                    resumeSessionId: null,
                    status: "running",
                    startedAt: 1718000000000,
                    endedAt: null,
                    exitCode: null,
                    signal: null,
                    error: null,
                    sessionId: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
                    envelopeCount: 12,
                    stdoutTail: '{"type":"assistant",...}\n',
                    stderrTail: "",
                  },
                ],
                maxConcurrent: 10000,
                activeCount: 1,
              },
            },
          },
        },
        403: ebadOrigin403,
      },
    },
    post: {
      tags: ["Run"],
      summary: "Spawn a new run",
      description:
        "Spawns a real `claude` Code subprocess in the sanitised `cwd`. In `headless` mode the prompt is passed via argv and stdin is closed (one turn, then exit); in `conversation` mode stdin stays open for follow-ups via POST /api/run/{id}/message, and an existing session may be resumed with `resumeSessionId`. The child is always run with `--output-format stream-json --verbose --include-partial-messages`; parsed envelopes are broadcast as `run_stream` WebSocket messages and lifecycle transitions as `run_status`. A row is persisted to `dashboard_runs`, and the in-memory handle is reaped 5 minutes after exit. Concurrency is capped (ECONCURRENCY -> 429). The loopback same-origin guard applies. Returns the freshly-created RunHandle.",
      operationId: "runSpawn",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RunSpawnRequest" },
            example: {
              prompt: "Refactor the auth module and add tests.",
              mode: "conversation",
              cwd: "/Users/dev/projects/my-app",
              model: "claude-opus-4-8",
              effort: "high",
              permissionMode: "acceptEdits",
            },
          },
        },
      },
      responses: {
        201: {
          description: "Run spawned; returns the new run handle (status `spawning`).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunHandle" },
              example: {
                id: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
                pid: 48213,
                mode: "conversation",
                cwd: "/Users/dev/projects/my-app",
                model: "claude-opus-4-8",
                permissionMode: "acceptEdits",
                effort: "high",
                prompt: "Refactor the auth module and add tests.",
                argv: [
                  "--output-format",
                  "stream-json",
                  "--verbose",
                  "--include-partial-messages",
                  "--permission-mode",
                  "acceptEdits",
                  "--input-format",
                  "stream-json",
                  "--model",
                  "claude-opus-4-8",
                  "--effort",
                  "high",
                ],
                resumeSessionId: null,
                status: "spawning",
                startedAt: 1718000000000,
                endedAt: null,
                exitCode: null,
                signal: null,
                error: null,
                sessionId: null,
                envelopeCount: 0,
                stdoutTail: "",
                stderrTail: "",
              },
            },
          },
        },
        400: {
          description:
            "Invalid spawn request — EBADPROMPT (prompt required), EBADCWD (cwd not an existing absolute directory), EBADMODE (bad mode, or resumeSessionId outside conversation mode), EBADEFFORT (effort not low/medium/high/xhigh/max), or EBADSESSION (resumeSessionId not a valid session id).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                badPrompt: {
                  value: { error: { code: "EBADPROMPT", message: "prompt is required" } },
                },
                badCwd: {
                  value: { error: { code: "EBADCWD", message: "cwd must be an absolute path" } },
                },
                badMode: {
                  value: {
                    error: {
                      code: "EBADMODE",
                      message: 'mode must be "headless" or "conversation"',
                    },
                  },
                },
                badEffort: {
                  value: {
                    error: {
                      code: "EBADEFFORT",
                      message: "effort must be one of: low, medium, high, xhigh, max",
                    },
                  },
                },
                badSession: {
                  value: {
                    error: {
                      code: "EBADSESSION",
                      message: "resumeSessionId is not a valid session id",
                    },
                  },
                },
              },
            },
          },
        },
        403: ebadOrigin403,
        429: {
          description:
            "Concurrency cap reached (ECONCURRENCY). The body additionally carries a top-level `running` array listing the runs currently holding the cap.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunSpawnConcurrencyResponse" },
              example: {
                error: { code: "ECONCURRENCY", message: "concurrency limit 10000 reached" },
                running: [
                  {
                    id: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
                    pid: 48213,
                    startedAt: 1718000000000,
                    mode: "conversation",
                  },
                ],
              },
            },
          },
        },
        500: {
          description: "Unexpected spawn failure (EINTERNAL).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "EINTERNAL", message: "spawn claude ENOENT" } },
            },
          },
        },
      },
    },
  },

  "/api/run/history": {
    get: {
      tags: ["Run"],
      summary: "List persisted run history",
      description:
        "Returns the persistent history of runs spawned via the dashboard, sourced from the `dashboard_runs` sqlite table (newest first). Unlike GET /api/run, this survives the 5-minute in-memory reap so past runs stay visible and resumable for days. Each item is cross-referenced against live handles to set `isLive`. Returns `{ items: [] }` if the persistence DB is unavailable. Read-only — no process is spawned. The loopback same-origin guard applies.",
      operationId: "runHistory",
      parameters: [
        {
          name: "limit",
          in: "query",
          required: false,
          schema: { type: "integer", minimum: 1, maximum: 500, default: 50 },
          description: "Maximum number of history rows to return (default 50, clamped to 1–500).",
          example: 50,
        },
      ],
      responses: {
        200: {
          description: "Run history, most recent first",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunHistoryResponse" },
              example: {
                items: [
                  {
                    id: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
                    session_id: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
                    mode: "conversation",
                    cwd: "/Users/dev/projects/my-app",
                    model: "claude-opus-4-8",
                    permission_mode: "acceptEdits",
                    effort: "high",
                    resume_session_id: null,
                    prompt_preview: "Refactor the auth module and add tests.",
                    status: "completed",
                    exit_code: 0,
                    started_at: "2026-06-25T17:00:00.000Z",
                    ended_at: "2026-06-25T17:01:42.500Z",
                    isLive: false,
                  },
                ],
              },
            },
          },
        },
        403: ebadOrigin403,
      },
    },
  },

  "/api/run/cwds": {
    get: {
      tags: ["Run"],
      summary: "Suggest working directories",
      description:
        "Suggests plausible working directories for the Run launcher: the dashboard server's cwd (always first), $HOME, and distinct recent cwds Claude Code has been used in (from the sessions table). Only directories that still exist on disk are returned; the DB lookup is best-effort. Read-only — no process is spawned. The loopback same-origin guard applies.",
      operationId: "runCwds",
      parameters: [
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Optional case-insensitive substring filter (also applied client-side).",
          example: "my-app",
        },
      ],
      responses: {
        200: {
          description: "Working-directory suggestions",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunCwdsResponse" },
              example: {
                items: [
                  {
                    kind: "dashboard",
                    path: "/Users/dev/Claude-Code-Agent-Monitor",
                    label: "Dashboard server",
                  },
                  { kind: "home", path: "/Users/dev", label: "Home" },
                  { kind: "recent", path: "/Users/dev/projects/my-app", label: "my-app" },
                ],
              },
            },
          },
        },
        403: ebadOrigin403,
      },
    },
  },

  "/api/run/files": {
    get: {
      tags: ["Run"],
      summary: "Autocomplete files within a cwd",
      description:
        "Walks the given `cwd` and returns up to 40 file paths (relative to that cwd, shortest first) for the prompt editor's `@` references. The cwd is validated via the same sanitiser as spawning (must be an existing absolute directory). Dotfiles (except .env/.gitignore) and heavy build dirs (node_modules, .git, dist, build, out, .next, coverage, target, .venv, __pycache__, etc.) are skipped; the walk is bounded (≤5000 entries visited). Read-only — no process is spawned. The loopback same-origin guard applies.",
      operationId: "runFiles",
      parameters: [
        {
          name: "cwd",
          in: "query",
          required: false,
          schema: { type: "string" },
          description:
            "Absolute directory to walk. Must exist; defaults to the dashboard server's cwd when omitted. Invalid values yield 400 EBADCWD.",
          example: "/Users/dev/projects/my-app",
        },
        {
          name: "q",
          in: "query",
          required: false,
          schema: { type: "string" },
          description: "Optional case-insensitive substring filter applied to the relative path.",
          example: "route",
        },
      ],
      responses: {
        200: {
          description: "Matching file paths relative to cwd",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunFilesResponse" },
              example: { items: ["package.json", "src/index.ts", "server/routes/run.js"] },
            },
          },
        },
        400: {
          description: "Invalid cwd (EBADCWD): not a string, not absolute, or does not exist.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "EBADCWD", message: "cwd does not exist: /no/such/dir" } },
            },
          },
        },
        403: ebadOrigin403,
      },
    },
  },

  "/api/run/binary": {
    get: {
      tags: ["Run"],
      summary: "Check whether the `claude` binary is on PATH",
      description:
        "Probes PATH (via which/where) for the `claude` binary so the UI can warn before the user clicks Run. The binary is NOT invoked — only resolved. Read-only — no process is spawned beyond the lookup. The loopback same-origin guard applies.",
      operationId: "runBinary",
      responses: {
        200: {
          description: "Binary resolution result",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunBinaryResponse" },
              example: { found: true, path: "/usr/local/bin/claude" },
            },
          },
        },
        403: ebadOrigin403,
      },
    },
  },

  "/api/run/{id}/message": {
    post: {
      tags: ["Run"],
      summary: "Send a follow-up turn to a conversation run",
      description:
        "Writes a stream-json user envelope to a running conversation's stdin and broadcasts a `run_input_ack` WebSocket message. Only valid for `conversation`-mode runs that are still `running`/`spawning` with writable stdin. SIDE EFFECT: the child resumes processing the new turn and emits further `run_stream`/`run_status` messages. The loopback same-origin guard applies.",
      operationId: "runSendMessage",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Run id (RunHandle.id).",
          example: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
        },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RunMessageRequest" },
            example: { text: "Also update the README to document the new flags." },
          },
        },
      },
      responses: {
        200: {
          description: "Turn written to stdin",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunMessageResponse" },
              example: { messageId: "9c0d1e2f-3a4b-5c6d-7e8f-9a0b1c2d3e4f" },
            },
          },
        },
        400: {
          description:
            "Cannot deliver input — EBADINPUT (text required), EWRONGMODE (run is not conversation mode), ENOTRUNNING (run is not running/spawning), or ESTDINCLOSED (child stdin not writable).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              examples: {
                badInput: { value: { error: { code: "EBADINPUT", message: "text is required" } } },
                wrongMode: {
                  value: {
                    error: {
                      code: "EWRONGMODE",
                      message: "only conversation mode accepts follow-up input",
                    },
                  },
                },
                notRunning: {
                  value: { error: { code: "ENOTRUNNING", message: "run is completed" } },
                },
                stdinClosed: {
                  value: { error: { code: "ESTDINCLOSED", message: "stdin is not writable" } },
                },
              },
            },
          },
        },
        403: ebadOrigin403,
        404: {
          description: "No run with this id (ENOTFOUND) — it never existed or was reaped.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "ENOTFOUND", message: "run not found" } },
            },
          },
        },
      },
    },
  },

  "/api/run/{id}": {
    get: {
      tags: ["Run"],
      summary: "Get a single run",
      description:
        "Returns the in-memory handle for one run. Pass `?envelopes=1` to additionally include the bounded (≤500) stream-json envelope replay buffer so a client can re-attach to an in-flight run and see what it missed. Available only while the handle is live or within the 5-minute post-exit reap window — afterwards use GET /api/run/history. Read-only — no process is spawned. The loopback same-origin guard applies.",
      operationId: "runGet",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Run id (RunHandle.id).",
          example: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
        },
        {
          name: "envelopes",
          in: "query",
          required: false,
          schema: { type: "string", enum: ["1"] },
          description: "Set to `1` to include the `envelopes` replay buffer in the response.",
          example: "1",
        },
      ],
      responses: {
        200: {
          description: "The run handle (with `envelopes` appended when `?envelopes=1`).",
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/RunHandle" },
                  { $ref: "#/components/schemas/RunHandleWithEnvelopes" },
                ],
              },
              example: {
                id: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
                pid: 48213,
                mode: "conversation",
                cwd: "/Users/dev/projects/my-app",
                model: "claude-opus-4-8",
                permissionMode: "acceptEdits",
                effort: "high",
                prompt: "Refactor the auth module and add tests.",
                argv: ["--output-format", "stream-json", "--verbose", "--include-partial-messages"],
                resumeSessionId: null,
                status: "running",
                startedAt: 1718000000000,
                endedAt: null,
                exitCode: null,
                signal: null,
                error: null,
                sessionId: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
                envelopeCount: 12,
                stdoutTail: '{"type":"assistant",...}\n',
                stderrTail: "",
                envelopes: [
                  {
                    type: "system",
                    subtype: "init",
                    session_id: "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
                  },
                  {
                    type: "assistant",
                    message: {
                      role: "assistant",
                      content: [{ type: "text", text: "Working on it..." }],
                    },
                  },
                ],
              },
            },
          },
        },
        403: ebadOrigin403,
        404: {
          description: "No run with this id (ENOTFOUND) — it never existed or was reaped.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "ENOTFOUND", message: "run not found" } },
            },
          },
        },
      },
    },
    delete: {
      tags: ["Run"],
      summary: "Kill a run",
      description:
        "Terminates a live run: sends SIGTERM (escalating to SIGKILL after ~5s if needed), sets the handle status to `killed`, broadcasts a `run_status` WebSocket message, persists the status to `dashboard_runs`, and schedules the handle for the 5-minute reap. Idempotent — returns `{ ok: true }` even if the run had already terminated. The loopback same-origin guard applies.",
      operationId: "runKill",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Run id (RunHandle.id).",
          example: "3f2c9a1e-7b4d-4e21-9b6a-1d2e3f4a5b6c",
        },
      ],
      responses: {
        200: {
          description: "Kill issued (or run already terminated).",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RunKillResponse" },
              example: { ok: true },
            },
          },
        },
        403: ebadOrigin403,
        404: {
          description: "No run with this id (ENOTFOUND) — it never existed or was reaped.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
              example: { error: { code: "ENOTFOUND", message: "run not found" } },
            },
          },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
