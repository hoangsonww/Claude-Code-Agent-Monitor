# Server Application

Enterprise-grade Node.js backend for Claude Code agent monitoring with real-time WebSocket updates.

![Claude Code](https://img.shields.io/badge/Claude_Code-orange?style=flat-square&logo=claude&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![Javascript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-RFC_6455-010101?style=flat-square&logo=socketdotio&logoColor=white)
![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-000000?style=flat-square&logo=openapiinitiative&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-3.0-85EA2D?style=flat-square&logo=swagger&logoColor=white)
![better--sqlite3](https://img.shields.io/badge/better--sqlite3-11.7-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Autoprefixer](https://img.shields.io/badge/Autoprefixer-10.4-DD3735?style=flat-square&logo=autoprefixer&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-8.44-4B32C3?style=flat-square&logo=eslint&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-20.10-2496ED?style=flat-square&logo=docker&logoColor=white)
![Podman](https://img.shields.io/badge/Podman-4.0-CC342D?style=flat-square&logo=podman&logoColor=white)
![SSE](https://img.shields.io/badge/SSE-Server_Sent_Events-FF6600?style=flat-square&logo=googlechrome&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Design](#database-design)
- [API Reference](#api-reference)
- [WebSocket Protocol](#websocket-protocol)
- [Hook Processing](#hook-processing)
- [Pricing System](#pricing-system)
- [Data Flow](#data-flow)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Testing](#testing)
- [Deployment](#deployment)
- [Configuration](#configuration)

---

## Overview

The server is a lightweight Express application that:

1. **Receives hook events** from Claude Code via HTTP POST (stdin → hook-handler.js → server)
2. **Persists data** in SQLite database with schema migrations
3. **Broadcasts updates** to connected web clients via WebSocket
4. **Serves REST API** for sessions, agents, events, stats, analytics, pricing, workflows, settings, and docs
5. **Manages pricing rules** for cost calculation and attribution

```mermaid
graph TB
    subgraph "Claude Code Process"
        CC[Claude Code CLI]
        Hooks[Hook System]
        HH[hook-handler.js]
    end
    
    subgraph "Server Process :4820"
        Express[Express Server]
        HookRouter[Hook Router]
        APIRouter[API Router]
        WSServer[WebSocket Server]
        DB[(SQLite DB)]
    end
    
    subgraph "Clients"
        Browser[Web Browser]
        MCP[MCP Clients]
    end
    
    CC --> Hooks
    Hooks -->|stdin JSON| HH
    HH -->|HTTP POST| HookRouter
    HookRouter --> DB
    HookRouter --> WSServer
    
    Browser -->|HTTP GET| APIRouter
    APIRouter --> DB
    
    WSServer -->|Real-time events| Browser
    MCP -->|HTTP| APIRouter
    
    style Express fill:#000000,color:#fff
    style DB fill:#003B57,color:#fff
    style WSServer fill:#F59E0B
```

---

## Architecture

### Server Structure

```mermaid
graph TB
    subgraph "Entry Point"
        Index[index.js Server bootstrap]
    end
    
    subgraph "Core Modules"
        DB[db.js SQLite + prepared stmts]
        WS[websocket.js WebSocket manager]
        Compat[compat-sqlite.js Fallback for Node 22.5+]
    end
    
    subgraph "Routes"
        Hooks[routes/hooks.js POST /api/hooks/event]
        Sessions[routes/sessions.js /api/sessions]
        Agents[routes/agents.js /api/agents]
        Events[routes/events.js GET /api/events]
        Stats[routes/stats.js GET /api/stats]
        Analytics[routes/analytics.js GET /api/analytics]
        Pricing[routes/pricing.js /api/pricing*]
        Settings[routes/settings.js /api/settings*]
        Workflows[routes/workflows.js /api/workflows*]
        OpenAPI[openapi.js + Swagger /api/openapi.json /api/docs]
    end
    
    subgraph "Tests"
        TestFiles[__tests__/api.test.js Integration tests]
    end
    
    Index --> DB
    Index --> WS
    Index --> Hooks
    Index --> Sessions
    Index --> Agents
    Index --> Events
    Index --> Stats
    Index --> Analytics
    Index --> Pricing
    Index --> Settings
    Index --> Workflows
    Index --> OpenAPI
    
    Hooks --> DB
    Sessions --> DB
    Agents --> DB
    Pricing --> DB
    
    Hooks --> WS
    
    DB -.->|Node 22.5+| Compat
    
    style Index fill:#339933
    style DB fill:#003B57,color:#fff
    style WS fill:#F59E0B
```

### Directory Structure

```
server/
├── index.js               # Express app + server bootstrap
├── db.js                  # SQLite connection + prepared statements
├── websocket.js           # WebSocket server + broadcast
├── compat-sqlite.js       # Fallback for node:sqlite (Node 22.5+)
│
├── routes/
│   ├── hooks.js           # Hook ingestion endpoints
│   ├── sessions.js        # Session CRUD API
│   ├── agents.js          # Agent CRUD API
│   ├── events.js          # Event list API
│   ├── stats.js           # Dashboard stats API
│   ├── analytics.js       # Analytics aggregate API
│   ├── pricing.js         # Pricing rules + cost API
│   ├── settings.js        # Ops/settings API
│   └── workflows.js       # Workflow intelligence API
│
├── openapi.js             # OpenAPI 3.0 spec generator
│
└── __tests__/
    └── api.test.js        # Integration tests
```

---

## Database Design

### Schema Overview

```mermaid
erDiagram
    sessions ||--o{ agents : "has many"
    agents ||--o{ tool_executions : "has many"
    sessions ||--o{ notifications : "has many"
    
    sessions {
        integer id PK
        text session_id UK
        text model
        text status
        real total_cost
        text created_at
        text updated_at
    }
    
    agents {
        integer id PK
        text agent_id UK
        text session_id FK
        text agent_type
        text status
        text current_tool
        integer input_tokens
        integer output_tokens
        real cost
        text created_at
        text updated_at
    }
    
    tool_executions {
        integer id PK
        text agent_id FK
        text tool_name
        integer duration_ms
        boolean success
        text error_message
        text created_at
    }
    
    notifications {
        integer id PK
        text session_id FK
        text notification_type
        text message
        text created_at
    }
    
    pricing_rules {
        integer id PK
        text pattern UK
        real input_cost_per_1m
        real output_cost_per_1m
        text created_at
    }
```

### Table Definitions

#### `sessions`

Tracks Claude Code sessions (one per CLI invocation or agent task).

```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    model TEXT,
    status TEXT DEFAULT 'active',
    total_cost REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at DESC);
```

#### `agents`

Tracks individual agents (main agent, explore, task, code-review, etc.).

```sql
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    agent_type TEXT,
    status TEXT DEFAULT 'running',
    current_tool TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_session_id ON agents(session_id);
CREATE INDEX idx_agents_status ON agents(status);
```

#### `tool_executions`

Records each tool call (bash, view, edit, grep, etc.).

```sql
CREATE TABLE tool_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    duration_ms INTEGER,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

CREATE INDEX idx_tools_agent_id ON tool_executions(agent_id);
CREATE INDEX idx_tools_created_at ON tool_executions(created_at DESC);
```

#### `notifications`

Stores system notifications (backgroundTaskComplete, etc.).

```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

CREATE INDEX idx_notifications_session_id ON notifications(session_id);
```

#### `pricing_rules`

Custom pricing rules for model pattern matching.

```sql
CREATE TABLE pricing_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT UNIQUE NOT NULL,
    input_cost_per_1m REAL NOT NULL,
    output_cost_per_1m REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Database Module (db.js)

```mermaid
graph TB
    subgraph "db.js Exports"
        DB[db object SQLite connection]
        Stmts[stmts object Prepared statements]
        Init[initDatabase Schema and migrations]
    end
    
    subgraph "Prepared Statements"
        Sessions[Session queries findSession createSession etc]
        Agents[Agent queries findAgent updateAgent etc]
        Tools[Tool queries createToolExecution etc]
        Pricing[Pricing queries createPricingRule etc]
    end
    
    Init --> DB
    DB --> Stmts
    Stmts --> Sessions
    Stmts --> Agents
    Stmts --> Tools
    Stmts --> Pricing
    
    style DB fill:#003B57,color:#fff
    style Init fill:#10B981
```

**Key Functions:**

```javascript
// Initialize database (create tables, indexes, defaults)
initDatabase();

// Prepared statements (prevents SQL injection, optimizes performance)
stmts.findSession.get(session_id);
stmts.createSession.run(session_id, model);
stmts.updateSession.run(status, total_cost, session_id);
stmts.touchSession.run(session_id); // Update updated_at

stmts.findAgent.get(agent_id);
stmts.createAgent.run(agent_id, session_id, agent_type);
stmts.updateAgent.run(status, input_tokens, output_tokens, cost, current_tool, agent_id);

stmts.createToolExecution.run(agent_id, tool_name, duration_ms, success, error_message);
stmts.createNotification.run(session_id, notification_type, message);
stmts.createPricingRule.run(pattern, input_cost_per_1m, output_cost_per_1m);
```

---

## API Reference

All endpoints return JSON unless noted. Error responses use:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable explanation"
  }
}
```

### OpenAPI / Swagger

| Method | Path                | Description                         |
| ------ | ------------------- | ----------------------------------- |
| `GET`  | `/api/openapi.json` | Raw OpenAPI 3.0.3 spec              |
| `GET`  | `/api/docs`         | Interactive Swagger UI documentation |

The OpenAPI spec is generated from `server/openapi.js` and is the source of truth for request/response contracts.

### Core Endpoints

| Method  | Path                | Description                                      |
| ------- | ------------------- | ------------------------------------------------ |
| `GET`   | `/api/health`       | Server health check                              |
| `GET`   | `/api/sessions`     | List sessions (`status`, `limit`, `offset`)     |
| `GET`   | `/api/sessions/:id` | Session detail (includes `agents` + `events`)   |
| `POST`  | `/api/sessions`     | Create session (idempotent by `id`)             |
| `PATCH` | `/api/sessions/:id` | Update session                                   |
| `GET`   | `/api/agents`       | List agents (`status`, `session_id`, pagination)|
| `GET`   | `/api/agents/:id`   | Agent detail                                     |
| `POST`  | `/api/agents`       | Create agent (idempotent by `id`)               |
| `PATCH` | `/api/agents/:id`   | Update agent                                     |
| `GET`   | `/api/events`       | List events (`session_id`, `limit`, `offset`)   |
| `GET`   | `/api/stats`        | Dashboard aggregate counters                     |
| `GET`   | `/api/analytics`    | Analytics aggregates for charts/trends           |

### Hook Ingestion

| Method | Path               | Description                                    |
| ------ | ------------------ | ---------------------------------------------- |
| `POST` | `/api/hooks/event` | Ingest one Claude Code hook event envelope     |

Request body shape:

```json
{
  "hook_type": "PreToolUse",
  "data": {
    "session_id": "abc-123",
    "tool_name": "Bash"
  }
}
```

### Pricing

| Method   | Path                      | Description                            |
| -------- | ------------------------- | -------------------------------------- |
| `GET`    | `/api/pricing`            | List pricing rules                     |
| `PUT`    | `/api/pricing`            | Create/update a pricing rule           |
| `DELETE` | `/api/pricing/:pattern`   | Delete pricing rule                    |
| `GET`    | `/api/pricing/cost`       | Total cost across all sessions         |
| `GET`    | `/api/pricing/cost/:id`   | Cost breakdown for one session         |

### Workflows

| Method | Path                          | Description                                                         |
| ------ | ----------------------------- | ------------------------------------------------------------------- |
| `GET`  | `/api/workflows`              | Aggregate workflow intelligence (`?status=active\|completed\|...`) |
| `GET`  | `/api/workflows/session/:id`  | Per-session drill-in (tree, timeline, swim lanes, events)          |

### Settings / Ops

| Method | Path                           | Description                                      |
| ------ | ------------------------------ | ------------------------------------------------ |
| `GET`  | `/api/settings/info`           | System info, DB stats, hooks status, cache stats. Also powers the Dashboard Health tab (server uptime, memory, CPU, DB record counts, WAL/journal mode, transcript cache hit/miss rates) |
| `POST` | `/api/settings/clear-data`     | Delete all sessions/agents/events/token usage    |
| `POST` | `/api/settings/reimport`       | Re-import legacy sessions from `~/.claude/`      |
| `POST` | `/api/settings/reinstall-hooks`| Reinstall Claude Code hooks                      |
| `POST` | `/api/settings/reset-pricing`  | Reset pricing table to defaults                  |
| `GET`  | `/api/settings/export`         | Export all data as JSON attachment               |
| `POST` | `/api/settings/cleanup`        | Abandon stale sessions and purge old data        |

### Claude Config Explorer (`/api/cc-config`)

Reads — and carefully gated mutations for low-risk text-file artifacts — for every Claude Code configuration surface. Mutations always create timestamped backups under `<root>/cc-config-backups/<type>/` before writing.

| Method   | Path                                  | Description |
| -------- | ------------------------------------- | ----------- |
| `GET`    | `/api/cc-config/overview`             | Roots + counts for every surface (used by the Overview tab) |
| `GET`    | `/api/cc-config/skills`               | Skills with parsed frontmatter, `?scope=user\|project\|all` |
| `GET`    | `/api/cc-config/agents`               | Subagents under `<scope>/.claude/agents/*.md` |
| `GET`    | `/api/cc-config/commands`             | Slash commands under `<scope>/.claude/commands/*.md` |
| `GET`    | `/api/cc-config/output-styles`        | Output styles under `<scope>/.claude/output-styles/*.md` |
| `GET`    | `/api/cc-config/plugins`              | Installed plugins joined with `enabledPlugins` + per-plugin `contributes` count + `plugin.json` metadata |
| `GET`    | `/api/cc-config/marketplaces`         | `known_marketplaces.json` enriched with each marketplace's own `marketplace.json` |
| `GET`    | `/api/cc-config/mcp`                  | MCP servers from `~/.claude.json` and `settings.json` |
| `GET`    | `/api/cc-config/hooks`                | Hooks aggregated across user / project / project-local `settings.json` |
| `GET`    | `/api/cc-config/hook-scripts`         | Files in `~/.claude/hooks/` (helper scripts referenced by hook commands) |
| `GET`    | `/api/cc-config/keybindings`          | `~/.claude/keybindings.json` parsed into context-grouped key/action pairs |
| `GET`    | `/api/cc-config/statusline`           | `settings.json.statusLine` config + script content if present |
| `GET`    | `/api/cc-config/settings`             | User / project / project-local settings JSON, secret keys redacted |
| `GET`    | `/api/cc-config/memory`               | `CLAUDE.md` files at user + project scope |
| `GET`    | `/api/cc-config/file?path=…`          | Body of a single file (path-contained to allowed roots) |
| `GET`    | `/api/cc-config/backups[?scope=&type=]` | Listing of all timestamped backups |
| `PUT`    | `/api/cc-config/file`                 | Create or overwrite a text-file artifact (skills/agents/commands/output-styles/memory). Body: `{ scope, type, name?, content }`. Auto-backs-up if file exists. Atomic temp + rename. 256 KB cap |
| `DELETE` | `/api/cc-config/file`                 | Backup-then-delete a text-file artifact. Skill dirs are backed up whole before recursive removal |

### Run Claude (`/api/run`)

HTTP surface for spawning and supervising `claude` subprocesses from the dashboard. Every route enforces a same-origin / loopback-Origin guard against browser CSRF.

| Method   | Path                          | Description |
| -------- | ----------------------------- | ----------- |
| `GET`    | `/api/run`                    | List handles + `maxConcurrent` + `activeCount` |
| `GET`    | `/api/run/binary`             | Probe whether `claude` is on `PATH` |
| `GET`    | `/api/run/cwds`               | Suggested cwds (dashboard, home, recent from sessions) |
| `GET`    | `/api/run/files?cwd=…&q=…`    | Fuzzy file search inside `cwd` for the Run page's `@`-file autocomplete. Skips `node_modules`, `.git`, `dist`, `build`, `.next`, `.cache`, `coverage`, `vendor`, etc. Cwd is required and must exist; results are capped and ranked by basename match |
| `POST`   | `/api/run`                    | Spawn. Body: `{ prompt, mode, cwd?, model?, permissionMode?, resumeSessionId?, effort? }`. `effort` (`low`/`medium`/`high`) maps to `--effort`. When `resumeSessionId` is set in conversation mode, `prompt` may be empty — the spawner skips the initial stdin write and `claude --resume` idles until the client POSTs a follow-up to `/api/run/:id/message`. Spawner always passes `--output-format stream-json --verbose --include-partial-messages` for character-by-character streaming. Concurrency is effectively uncapped by default (ceiling 10000, override with `RUN_MAX_CONCURRENT`) — the terminal TUI has no cap and neither does the dashboard; the ceiling is sanity-only to prevent fork-bomb footguns |
| `POST`   | `/api/run/:id/message`        | Send follow-up turn (conversation mode only). Body: `{ text }` |
| `GET`    | `/api/run/:id`                | Handle state. `?envelopes=1` includes the in-memory envelope log for re-attach |
| `DELETE` | `/api/run/:id`                | Stop (SIGTERM → SIGKILL after 5 s) |

WebSocket message types added: `run_stream` (parsed stream-json envelope, including `stream_event` deltas from `--include-partial-messages`), `run_status` (status transitions), `run_input_ack` (stdin write confirmed), and `cc_config_changed` (broadcast by `lib/cc-watcher.js` on `fs.watch` events under `~/.claude/` and by `routes/cc-config.js` after every successful PUT/DELETE — debounced at 500 ms, payload `{ source: "dashboard"|"fs", action?, scope?, type?, name?, paths? }`).

### Import History

Bring existing Claude Code sessions into the dashboard. All four entry
points share the same JSONL parser (`parseSessionFile` +
`importSession`) used by live ingestion, so imported tokens and cost
calculations match real-time captured sessions exactly. Re-imports are
idempotent (dedupe by session ID; compaction `baseline_*` columns
prevent token double-counting).

| Method | Path                      | Description                                                              |
| ------ | ------------------------- | ------------------------------------------------------------------------ |
| `GET`  | `/api/import/guide`       | OS-aware paths, archive command, supported extensions, step instructions |
| `POST` | `/api/import/rescan`      | Rescan the default `~/.claude/projects` directory                        |
| `POST` | `/api/import/scan-path`   | Scan any absolute directory path (body: `{ path }`); walks recursively   |
| `POST` | `/api/import/upload`      | Multipart upload of `.jsonl`, `.meta.json`, `.zip`, `.tar(.gz)`, `.gz`   |

**Source files**

| File                           | Role                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `server/routes/import.js`      | Express router, request validation, temp-dir lifecycle, progress broadcasts                            |
| `server/lib/archive.js`        | Safe archive extractors (`.zip` / `.tar(.gz)` / `.gz`) with path-traversal and size-cap enforcement    |
| `scripts/import-history.js`    | Generalized directory walker (`importFromDirectory`) + shared `parseSessionFile` / `importSession`. Re-import is fully incremental: per-event-type high-water mark (`MAX(created_at) GROUP BY event_type` per session) drives `ts > cutoff[type]` dedup for Stop / PostToolUse / TurnDuration / ToolError, and `sessions.ended_at` is rolled forward when the JSONL has progressed past the stored value |
| `server/lib/transcript-cache.js` | Chunked 4 MiB sync byte-stream reader for JSONL transcripts — never materializes the whole file as a JS string, so files larger than V8's max string length (~512 MiB on 64-bit Node 20) parse without aborting Node with `FATAL ERROR: v8::ToLocalChecked Empty MaybeLocal` |

**Request flow (upload)**

```mermaid
sequenceDiagram
    participant UI
    participant R as /api/import/upload
    participant M as multer
    participant A as archive.js
    participant I as importFromDirectory
    participant DB as SQLite
    participant WS as ws /import.progress

    UI->>R: POST multipart files[]
    R->>M: uploadMiddleware
    M->>M: mkTempDir (per-request)<br/>fileFilter rejects unsupported
    R->>A: extractInto(file, workDir)
    A->>A: safeJoin (path-traversal guard)
    A->>A: enforce MAX_EXTRACT_BYTES
    alt bomb / traversal / oversize
      A-->>R: ExtractionLimitError
      R-->>UI: 413 EXTRACTION_LIMIT_EXCEEDED
      R->>WS: import.progress{phase:error}
    else ok
      A-->>R: {extracted, skipped}
    end
    R->>I: importFromDirectory(workDir)
    I->>I: collectJsonlFiles (recursive)
    I->>DB: importSession in one tx
    I->>WS: import.progress{phase:parse, complete}
    R-->>UI: 200 {imported, backfilled, skipped,<br/>errors, rejected_files}
    R->>A: rmTempDir(workDir + req._ccamUploadDir)
```

**Supported source layouts.** Both canonical Claude Code JSONL layouts
are recognised automatically — `<proj>/<sid>/subagents/agent-*.jsonl`
(default) and `<proj>/subagents/<sid>/agent-*.jsonl` (alternative) —
and orphan subagent files (parent JSONL missing from the upload) are
attached to an existing DB session whenever the inferred session ID
matches one probed from either layout candidate.

**Environment variables**

| Variable                          | Default     | Purpose                                                           |
| --------------------------------- | ----------- | ----------------------------------------------------------------- |
| `CCAM_IMPORT_MAX_BYTES`           | `1073741824` | Maximum size per uploaded file                                   |
| `CCAM_IMPORT_MAX_FILES`           | `2000`      | Maximum files per upload request                                 |
| `CCAM_IMPORT_MAX_EXTRACT_BYTES`   | `4294967296` | Total uncompressed bytes allowed per archive (zip-bomb guard)   |

**WebSocket event schema.** Progress is broadcast on `/ws` with type
`import.progress`. Messages are throttled at ~150 ms; the terminal
`complete` and `error` frames are always delivered.

```json
{
  "type": "import.progress",
  "timestamp": "2026-04-18T15:48:34.123Z",
  "data": {
    "importId": "upload-1729264114000",
    "phase": "parse",
    "source": "upload",
    "processed": 184,
    "total": 512,
    "current": "/tmp/ccam-import-work-xyz/project/<uuid>.jsonl",
    "counters": { "imported": 120, "backfilled": 40, "skipped": 20, "errors": 4 }
  }
}
```

Phases: `start` → `scan` → `extract` (upload only) → `parse` →
`complete`, with `error` / `extract_error` replacing `complete` on
failure.

**Response envelopes**

```jsonc
// 200 — import completed
{
  "ok": true,
  "source": "upload",            // "default" | "path" | "upload"
  "path": "/abs/path",           // only for source=path
  "imported": 120,
  "backfilled": 40,
  "skipped": 20,
  "errors": 4,
  "sessions_seen": 180,
  "files_scanned": 512,
  "files_received": 8,           // upload only
  "rejected_files": [],          // upload only; unsupported extensions
  "entries_extracted": 180,      // upload only
  "entries_skipped": 0           // upload only
}

// 400 — validation failure
{ "error": { "code": "PATH_NOT_FOUND", "message": "..." } }

// 413 — extraction cap exceeded (zip-bomb defense)
{
  "error": { "code": "EXTRACTION_LIMIT_EXCEEDED", "message": "..." },
  "offending_file": "suspicious.tar.gz"
}
```

---

## WebSocket Protocol

### Connection Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant DB
    
    Client->>Server: WebSocket handshake
    Server-->>Client: Connection established
    
    loop Every 30s
        Server->>Client: ping
        Client->>Server: pong
    end
    
    Note over Server,DB: Hook event arrives
    Server->>DB: Update data
    Server->>Client: broadcast({ type, data })
    
    Client->>Server: Close connection
    Server-->>Client: Connection closed
```

### Message Types

Server broadcasts JSON messages to all connected clients:

```typescript
// Session created
{
  "type": "session.created",
  "data": { ...session object }
}

// Session updated (status change, cost update)
{
  "type": "session.updated",
  "data": { ...session object }
}

// Agent created
{
  "type": "agent.created",
  "data": { ...agent object }
}

// Agent updated (status, tokens, cost)
{
  "type": "agent.updated",
  "data": { ...agent object }
}

// Tool executed
{
  "type": "tool.executed",
  "data": { ...tool execution object }
}

// Notification received
{
  "type": "notification.received",
  "data": { ...notification object }
}
```

### Broadcasting Logic

```javascript
// websocket.js
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Usage in routes/hooks.js
broadcast({ type: 'session.created', data: session });
```

---

## Hook Processing

### Hook Event Flow

```mermaid
sequenceDiagram
    participant Claude as Claude Code
    participant Hook as hook-handler.js
    participant Server as Server :4820
    participant DB as SQLite
    participant WS as WebSocket
    participant Client as Browser
    
    Claude->>Hook: stdin JSON payload
    Hook->>Server: POST /api/hooks/event
    Server->>DB: INSERT/UPDATE session, agent, event, token_usage
    Server->>WS: broadcast(session_created/agent_updated/new_event)
    WS->>Client: { type: "...", data: {...}, timestamp: "..." }
    Server-->>Hook: 200 OK
    Hook-->>Claude: exit 0 (non-blocking)
```

### Hook Endpoints

All hook traffic is sent to one endpoint:

| Method | Endpoint | Notes |
|--------|----------|-------|
| `POST` | `/api/hooks/event` | Body includes `hook_type` and `data`; server routes behavior by hook type |

Supported `hook_type` values include `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `Notification`, `SessionStart`, and `SessionEnd`.

### Hook Processing Logic

```javascript
// routes/hooks.js
router.post("/event", (req, res) => {
  const { hook_type, data } = req.body;
  if (!hook_type || !data) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "hook_type and data are required" },
    });
  }

  const event = processEvent(hook_type, data); // updates sessions, agents, events, tokens
  if (!event) {
    return res.status(400).json({
      error: { code: "MISSING_SESSION", message: "session_id is required in data" },
    });
  }

  res.json({ ok: true, event });
});
```

### Pricing Calculation

```mermaid
graph TB
    Hook[Hook Event] --> Tokens{Has Token<br/>Counts?}
    Tokens -->|Yes| Match[Match Model Pattern]
    Tokens -->|No| Skip[Skip Cost Calc]
    
    Match --> Custom{Custom Rule<br/>Exists?}
    Custom -->|Yes| UseCustom[Use Custom Pricing]
    Custom -->|No| UseDefault[Use Default Pricing]
    
    UseCustom --> Calc[Calculate Cost]
    UseDefault --> Calc
    
    Calc --> Update[Update Agent Cost]
    Update --> Rollup[Rollup to Session Cost]
    Rollup --> Broadcast[Broadcast Update]
    
    style Calc fill:#10B981
    style Broadcast fill:#F59E0B
```

**Cost Formula:**

```javascript
function calculateCost(model, inputTokens, outputTokens) {
  // Find matching pricing rule (custom or default)
  const rule = findPricingRule(model);
  
  // Cost = (input tokens / 1M * input price) + (output tokens / 1M * output price)
  const inputCost = (inputTokens / 1_000_000) * rule.input_cost_per_1m;
  const outputCost = (outputTokens / 1_000_000) * rule.output_cost_per_1m;
  
  return inputCost + outputCost;
}
```

### Default Pricing Rules

Loaded on first run from `db.js`:

```javascript
// [pattern, display_name, input, output, cache_read, cache_write_5m, cache_write_1h]
// (rates per million tokens; 5m write ≈ 1.25× input, 1h write ≈ 2× input)
const DEFAULT_PRICING = [
  ["claude-fable-5%", "Claude Fable 5", 10, 50, 1, 12.5, 20],
  ["claude-mythos-5%", "Claude Mythos 5", 10, 50, 1, 12.5, 20],
  ["claude-opus-4-8%", "Claude Opus 4.8", 5, 25, 0.5, 6.25, 10],
  ["claude-sonnet-4-6%", "Claude Sonnet 4.6", 3, 15, 0.3, 3.75, 6],
  ["claude-haiku-4-5%", "Claude Haiku 4.5", 1, 5, 0.1, 1.25, 2],
  // ... one explicit row per model (see server/db.js for the full list)
];
```

---

## Data Flow

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> waiting: SessionStart (status=active + flag)
    waiting --> active: UserPromptSubmit / PreToolUse / PostToolUse
    active --> waiting: Stop (non-error, flag re-stamped)
    active --> waiting: Permission Notification (agent → waiting)
    active --> error: Stop (stop_reason=error)
    active --> error: API error detected (watchdog)
    waiting --> error: API error detected (watchdog)
    error --> active: UserPromptSubmit / PreToolUse (recovery)
    waiting --> completed: SessionEnd (CLI exited)
    active --> completed: SessionEnd (CLI exited)
    error --> error: SessionEnd (preserves error)
    waiting --> abandoned: Stale > DASHBOARD_STALE_MINUTES
    active --> abandoned: Stale > DASHBOARD_STALE_MINUTES
    completed --> active: Session resumed (new work event)
    error --> active: Session resumed (new work event)
    abandoned --> active: Session resumed (new work event)
    completed --> [*]
    error --> [*]
    abandoned --> [*]
```

### Agent Lifecycle

```mermaid
stateDiagram-v2
    [*] --> waiting: ensureSession (first hook)
    waiting --> working: PreToolUse / UserPromptSubmit
    working --> working: PostToolUse (tool completed)
    working --> waiting: Stop (non-error)
    working --> waiting: Notification (input prompt)
    waiting --> error: Stop with error
    working --> error: Stop with error
    waiting --> error: API error detected (watchdog)
    working --> error: API error detected (watchdog)
    error --> working: UserPromptSubmit / PreToolUse (recovery)
    working --> completed: SessionEnd
    waiting --> completed: SessionEnd

    note right of waiting
        Agent is between turns or
        awaiting user input
    end note
```

### Hook to Database Flow

```mermaid
graph TB
    subgraph "Hook Event"
        JSON[JSON Payload]
    end
    
    subgraph "Request Validation"
        Parse[Parse JSON]
        Validate[Validate Fields]
    end
    
    subgraph "Database Updates"
        Session[Upsert Session]
        Agent[Upsert Agent]
        Tool[Insert Tool Execution]
        Notif[Insert Notification]
        Cost[Update Costs]
    end
    
    subgraph "Broadcasting"
        Build[Build WS Message]
        Send[Send to Clients]
    end
    
    JSON --> Parse
    Parse --> Validate
    Validate --> Session
    Validate --> Agent
    Validate --> Tool
    Validate --> Notif
    Validate --> Cost
    
    Session --> Build
    Agent --> Build
    Tool --> Build
    Notif --> Build
    Cost --> Build
    
    Build --> Send
    
    style Parse fill:#3B82F6
    style Session fill:#10B981
    style Build fill:#F59E0B
```

---

## Error Handling

### HTTP Error Codes

```mermaid
graph TB
    Request[Incoming Request] --> Validation{Valid?}
    
    Validation -->|No| R400[400 Bad Request]
    Validation -->|Yes| Process[Process Request]
    
    Process --> DBOperation{DB Success?}
    DBOperation -->|No| R500[500 Internal Server Error]
    DBOperation -->|Yes| Response{Found?}
    
    Response -->|No| R404[404 Not Found]
    Response -->|Yes| R200[200 OK]
    
    style R400 fill:#EF4444
    style R404 fill:#F59E0B
    style R500 fill:#DC2626
    style R200 fill:#10B981
```

### Error Response Format

```json
{
  "error": "Session not found",
  "code": "NOT_FOUND",
  "details": {
    "session_id": "sess_invalid"
  }
}
```

### Graceful Degradation

```javascript
// Hook endpoint never throws unhandled errors to Claude Code
router.post("/api/hooks/event", (req, res) => {
  try {
    // Process hook
    processHookEvent(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Hook processing error:", err);
    // Still return 200 to avoid blocking Claude Code
    res.json({ ok: false, error: err.message });
  }
});
```

### Error Detection Watchdog

The server runs a background error detection timer every 15 seconds that proactively catches API errors even when Claude Code fails to fire hooks:

1. **Stale session scan** — finds active sessions with no recent hook events (>10 seconds since last event)
2. **Transcript re-read** — re-reads JSONL transcript files for those sessions looking for API errors (401 auth failures, rate limits, quota exhaustion)
3. **Path derivation** — for imported sessions that don't have `transcript_path` in event data, derives the transcript path from the session's `cwd`
4. **Error marking** — marks sessions and agents as `error` when API errors are found in transcripts

This catches cases where the Claude CLI doesn't fire a hook after an API error (e.g., 401 auth failures where the CLI just shows the error message and waits for user input).

### API Error → Error State Flow

API errors detected in JSONL transcripts (`isApiErrorMessage` entries: quota limits, rate limits, `invalid_request`) now **immediately mark the session and agent as `error`**. Previously, these errors were recorded as `APIError` events but did not change session/agent status.

Error state transitions:
- `Stop` with `stop_reason=error` → agent `error`, session `error`
- API error in transcript (hook-based or watchdog) → session `error`, agent `error`
- `Notification` indicating input prompt → agent `waiting` (status change, not just flag)
- `SessionEnd` on error session → **preserves** `error` status (previously always set to `completed`)

### Error Recovery

Only two events can recover a session from `error` back to `active`:
- **`UserPromptSubmit`** — user hits enter on a new prompt (active retry)
- **`PreToolUse`** — agent begins using a tool (session resumed with work)

This ensures error states are only cleared by deliberate user action, not by background activity.

---

## Performance

### Query Optimization

```mermaid
graph TB
    subgraph "Optimization Strategies"
        Prepared[Prepared Statements<br/>Prevent SQL injection<br/>Cache query plans]
        Indexes[Database Indexes<br/>session_id, agent_id, timestamps]
        Limits[Query Limits<br/>Default: 50 sessions]
        Transactions[Transactions<br/>Batch hook updates]
    end
    
    subgraph "Results"
        Fast[Fast Queries<br/>&lt; 5ms average]
        Scalable[Scalable<br/>1000s of sessions]
        Efficient[Efficient<br/>Low CPU usage]
    end
    
    Prepared --> Fast
    Indexes --> Fast
    Limits --> Scalable
    Transactions --> Efficient
    
    style Fast fill:#10B981
    style Scalable fill:#10B981
    style Efficient fill:#10B981
```

### Benchmarks

| Operation | Average Time | Notes |
|-----------|--------------|-------|
| Hook ingestion | 2-5 ms | Includes DB write + broadcast |
| Session list query | 3-8 ms | 50 sessions with agent counts |
| Session detail query | 1-2 ms | Single session lookup |
| Agent tools query | 5-15 ms | 100 tool executions |
| WebSocket broadcast | < 1 ms | Per client |

### Memory Usage

```mermaid
graph LR
    subgraph "Memory Footprint"
        Base[Base: ~50MB<br/>Node.js + Express]
        DB[DB: ~10MB<br/>SQLite connection]
        WS[WS: ~1MB/client<br/>WebSocket buffers]
        Total[Total: ~60-100MB<br/>10 concurrent clients]
    end
    
    Base --> Total
    DB --> Total
    WS --> Total
    
    style Total fill:#3B82F6
```

### Scaling Considerations

```mermaid
graph TB
    subgraph "Current Architecture"
        Single[Single Process<br/>SQLite + WebSocket]
    end
    
    subgraph "Scaling Options"
        Multi[Multi-Process<br/>Cluster mode]
        Redis[Redis Pub/Sub<br/>Shared WS state]
        Postgres[PostgreSQL<br/>Concurrent writes]
    end
    
    Single -.->|If load increases| Multi
    Multi --> Redis
    Multi --> Postgres
    
    style Single fill:#3B82F6
    style Multi fill:#F59E0B
```

**Current limits:**
- SQLite: 1000s of sessions, 10,000s of tool executions
- WebSocket: 100+ concurrent clients
- CPU: Low (<5% idle, <20% during hook bursts)

For >1000 concurrent clients or >100k sessions, consider:
- Cluster mode with Redis pub/sub for WebSocket broadcasting
- PostgreSQL for better concurrent write performance
- Read replicas for API queries

---

## Testing

### Test Structure

```mermaid
graph TB
    subgraph "Test Suite"
        Integration[Integration Tests<br/>__tests__/api.test.js]
    end
    
    subgraph "Test Coverage"
        Sessions[Session API<br/>CRUD operations]
        Agents[Agent API<br/>CRUD operations]
        Hooks[Hook Endpoints<br/>Event processing]
        Pricing[Pricing API<br/>Rule management]
    end
    
    Integration --> Sessions
    Integration --> Agents
    Integration --> Hooks
    Integration --> Pricing
    
    style Integration fill:#8B5CF6
```

### Running Tests

```bash
# Run all server tests
npm run test:server

# Run with verbose output
node --test --test-reporter=spec server/__tests__/*.test.js
```

### Example Test

```javascript
// __tests__/api.test.js
import { test } from 'node:test';
import assert from 'node:assert';

test("POST /api/hooks/event ingests hook payload", async () => {
  const response = await fetch("http://localhost:4820/api/hooks/event", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hook_type: "SessionStart",
      data: {
        session_id: "test_session",
        model: "claude-sonnet-4",
        session_name: "Example Session",
      },
    })
  });
  
  const data = await response.json();
  assert.strictEqual(data.ok, true);
  
  // Verify session created
  const session = await fetch('http://localhost:4820/api/sessions/test_session');
  const sessionData = await session.json();
  assert.strictEqual(sessionData.session.model, 'claude-sonnet-4');
});
```

---

## Deployment

### Production Checklist

```mermaid
graph TB
    subgraph "Pre-Deployment"
        Build[Build Client<br/>npm run build]
        Test[Run Tests<br/>npm test]
        Env[Set Environment<br/>NODE_ENV=production]
    end
    
    subgraph "Deployment"
        Start[Start Server<br/>npm start]
        Monitor[Monitor Logs<br/>Health checks]
    end
    
    subgraph "Post-Deployment"
        Verify[Verify API<br/>curl localhost:4820/api/sessions]
        WebSocket[Test WebSocket<br/>Browser connection]
    end
    
    Build --> Test
    Test --> Env
    Env --> Start
    Start --> Monitor
    Monitor --> Verify
    Verify --> WebSocket
    
    style Build fill:#3B82F6
    style Start fill:#10B981
    style Verify fill:#F59E0B
```

### Environment Variables

```bash
# Server configuration
PORT=4820                          # Server port
NODE_ENV=production                # Environment mode

# Database
DASHBOARD_DB_PATH=./data/dashboard.db  # SQLite database path

# Logging
LOG_LEVEL=info                     # Log level (debug, info, warn, error)
```

### Running in Production

```bash
# Start server (production mode)
NODE_ENV=production node server/index.js

# With PM2 (process manager)
pm2 start server/index.js --name agent-dashboard

# With systemd
sudo systemctl start agent-dashboard
```

### Docker Deployment

```dockerfile
# Dockerfile (root of project)
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm ci --production && cd client && npm ci --production

# Build client
COPY client ./client
RUN cd client && npm run build

# Copy server
COPY server ./server
COPY data ./data

EXPOSE 4820

CMD ["node", "server/index.js"]
```

```bash
# Build and run
docker build -t agent-dashboard .
docker run -p 4820:4820 -v $(pwd)/data:/app/data agent-dashboard
```

---

## Configuration

### Server Configuration (index.js)

```javascript
const PORT = process.env.PORT || 4820;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const DB_PATH = process.env.DASHBOARD_DB_PATH || './data/dashboard.db';

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));
```

### Database Configuration (db.js)

```javascript
// SQLite connection options
const db = new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  fileMustExist: false
});

// Performance pragmas
db.pragma('journal_mode = WAL');  // Write-Ahead Logging
db.pragma('synchronous = NORMAL'); // Faster writes
db.pragma('cache_size = -64000');  // 64MB cache
db.pragma('temp_store = MEMORY');  // Temp tables in memory
```

### WebSocket Configuration (websocket.js)

```javascript
const wss = new WebSocketServer({
  server: httpServer,
  path: '/ws',
  clientTracking: true,
  maxPayload: 1024 * 1024 // 1MB max message size
});

// Heartbeat interval
const HEARTBEAT_INTERVAL = 30000; // 30s
```

---

## Summary

The server is production-ready with:

- 🚀 **High Performance** - Sub-5ms hook processing, prepared statements, WAL mode
- 📊 **Comprehensive API** - RESTful endpoints for all data access
- ⚡ **Real-time Updates** - WebSocket broadcasting with heartbeat
- 🗄️ **Robust Storage** - SQLite with indexes, migrations, transactions
- 💰 **Flexible Pricing** - Custom pricing rules with pattern matching
- 🧪 **Well Tested** - Integration tests with Node.js test runner
- 🔒 **Secure** - Prepared statements, input validation, CORS configured
- 📈 **Scalable** - Handles 1000s of sessions, 100+ concurrent clients

For client documentation, see [client/README.md](../client/README.md).
