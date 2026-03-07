# Architecture

### Agent Dashboard - System Design and Technical Reference

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7_Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-ws_8.18-010101?style=flat-square&logo=socketdotio&logoColor=white)
![better--sqlite3](https://img.shields.io/badge/better--sqlite3-11.7-003B57?style=flat-square&logo=sqlite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-6.28-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide_Icons-0.474-F56565?style=flat-square)
![PostCSS](https://img.shields.io/badge/PostCSS-8.5-DD3A0A?style=flat-square&logo=postcss&logoColor=white)
![Autoprefixer](https://img.shields.io/badge/Autoprefixer-10.4-DD3735?style=flat-square)
![Python](https://img.shields.io/badge/Python-%3E%3D3.6-3776AB?style=flat-square&logo=python&logoColor=white)

---

## Table of Contents

- [System Overview](#system-overview)
- [High-Level Architecture](#high-level-architecture)
- [Data Flow](#data-flow)
- [Server Architecture](#server-architecture)
- [Client Architecture](#client-architecture)
- [Database Design](#database-design)
- [WebSocket Protocol](#websocket-protocol)
- [Hook Integration](#hook-integration)
- [State Management](#state-management)
- [Security Considerations](#security-considerations)
- [Performance Characteristics](#performance-characteristics)
- [Deployment Modes](#deployment-modes)
- [Statusline Utility](#statusline-utility)

---

## System Overview

Agent Dashboard is a local-first monitoring platform for Claude Code sessions. It captures agent lifecycle events via Claude Code's native hook system, persists them in SQLite, and presents them through a React dashboard with real-time WebSocket updates.

```mermaid
C4Context
    title System Context Diagram

    Person(user, "Developer", "Uses Claude Code CLI")
    System(claude, "Claude Code", "AI coding assistant with hook system")
    System(dashboard, "Agent Dashboard", "Monitoring platform")
    SystemDb(sqlite, "SQLite", "Persistent storage")

    Rel(user, claude, "Interacts with")
    Rel(claude, dashboard, "Sends hook events via stdin + HTTP")
    Rel(user, dashboard, "Views in browser")
    Rel(dashboard, sqlite, "Reads/writes")
```

**Design goals:**

- Zero-config operation -- auto-discovers sessions from hook events
- Never block Claude Code -- hooks fail silently with timeouts
- Instant feedback -- WebSocket push, no polling
- Portable -- SQLite, no external services, runs on any OS with Node.js 18+

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Claude Code Process"
        CC[Claude Code CLI]
        H1[PreToolUse Hook]
        H2[PostToolUse Hook]
        H3[Stop Hook]
        H4[SubagentStop Hook]
        H5[Notification Hook]
        CC --> H1 & H2 & H3 & H4 & H5
    end

    subgraph "Hook Layer"
        HH["hook-handler.js<br/>(stdin → HTTP)"]
        H1 & H2 & H3 & H4 & H5 -->|stdin JSON| HH
    end

    subgraph "Server Process (port 4820)"
        direction TB
        EX[Express Server]
        HR[Hook Router]
        SR[Session Router]
        AR[Agent Router]
        ER[Event Router]
        STR[Stats Router]
        DB[(SQLite<br/>WAL mode)]
        WSS[WebSocket Server]

        EX --> HR & SR & AR & ER & STR
        HR -->|transaction| DB
        SR & AR & ER & STR --> DB
        HR -->|broadcast| WSS
        SR & AR -->|broadcast| WSS
    end

    subgraph "Client (Browser)"
        direction TB
        VITE[Vite Dev Server<br/>or Static Files]
        APP[React App]
        WS_CLIENT[WebSocket Client]
        EB[Event Bus]
        PAGES[Pages:<br/>Dashboard / Kanban /<br/>Sessions / Activity]

        VITE --> APP
        APP --> WS_CLIENT
        WS_CLIENT --> EB
        EB --> PAGES
        PAGES -->|fetch| EX
    end

    HH -->|"POST /api/hooks/event"| HR
    WSS -->|push messages| WS_CLIENT

    style CC fill:#6366f1,stroke:#818cf8,color:#fff
    style DB fill:#003B57,stroke:#005f8a,color:#fff
    style WSS fill:#10b981,stroke:#34d399,color:#fff
    style EB fill:#f59e0b,stroke:#fbbf24,color:#000
```

---

## Data Flow

### Event Ingestion Pipeline

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant HH as hook-handler.js
    participant API as POST /api/hooks/event
    participant TX as SQLite Transaction
    participant WS as WebSocket.broadcast()
    participant UI as React Client

    CC->>HH: stdin: {"session_id":"abc","tool_name":"Bash",...}
    Note over HH: Reads stdin, parses JSON,<br/>wraps with hook_type

    HH->>API: POST {"hook_type":"PreToolUse","data":{...}}
    Note over API: Validates hook_type + data

    API->>TX: BEGIN TRANSACTION
    TX->>TX: ensureSession(session_id)
    Note over TX: Creates session + main agent<br/>if first contact

    TX->>TX: Process by hook_type
    Note over TX: PreToolUse → set agent working<br/>PostToolUse → set agent connected<br/>Stop → mark all completed<br/>SubagentStop → mark subagent done

    TX->>TX: insertEvent(...)
    TX->>TX: COMMIT

    API->>WS: broadcast("agent_updated", agent)
    API->>WS: broadcast("new_event", event)

    WS->>UI: {"type":"agent_updated","data":{...}}
    UI->>UI: eventBus.publish(msg)
    UI->>UI: Page re-renders with new data
```

### Client Data Loading Pattern

```mermaid
sequenceDiagram
    participant Page as React Page
    participant API as api.ts
    participant Server as Express
    participant EB as eventBus
    participant WS as WebSocket

    Note over Page: Component mounts
    Page->>API: load() via useEffect
    API->>Server: GET /api/sessions (or agents, events, stats)
    Server-->>API: JSON response
    API-->>Page: setState(data)

    Note over Page: Subscribes to live updates
    Page->>EB: eventBus.subscribe(handler)

    loop Real-time updates
        WS->>EB: eventBus.publish(msg)
        EB->>Page: handler(msg)
        Page->>Page: Reload or optimistic update
    end

    Note over Page: Component unmounts
    Page->>EB: unsubscribe()
```

---

## Server Architecture

### Module Dependency Graph

```mermaid
graph TD
    INDEX[server/index.js<br/>Express app + HTTP server]
    DB[server/db.js<br/>SQLite + prepared statements]
    WS[server/websocket.js<br/>WS server + broadcast]
    HOOKS[routes/hooks.js<br/>Hook event processing]
    SESSIONS[routes/sessions.js<br/>Session CRUD]
    AGENTS[routes/agents.js<br/>Agent CRUD]
    EVENTS[routes/events.js<br/>Event listing]
    STATS[routes/stats.js<br/>Aggregate queries]
    PRICING[routes/pricing.js<br/>Cost calculation + pricing CRUD]
    SETTINGS[routes/settings.js<br/>System info + data management]

    INDEX --> DB
    INDEX --> WS
    INDEX --> HOOKS & SESSIONS & AGENTS & EVENTS & STATS & PRICING & SETTINGS

    HOOKS --> DB & WS
    SESSIONS --> DB & WS
    AGENTS --> DB & WS
    EVENTS --> DB
    STATS --> DB & WS
    PRICING --> DB
    SETTINGS --> DB

    style INDEX fill:#6366f1,stroke:#818cf8,color:#fff
    style DB fill:#003B57,stroke:#005f8a,color:#fff
    style WS fill:#10b981,stroke:#34d399,color:#fff
```

### Server Components

| Module                | Responsibility                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `server/index.js`     | Express app setup, middleware (CORS, JSON parsing), route mounting, static file serving in production, HTTP server creation                      |
| `server/db.js`        | SQLite connection with WAL mode, schema migration (CREATE TABLE IF NOT EXISTS), all prepared statements as a reusable `stmts` object             |
| `server/websocket.js` | WebSocket server on `/ws` path, 30s heartbeat with ping/pong dead connection detection, typed broadcast function                                 |
| `routes/hooks.js`     | Core event processing inside a SQLite transaction. Auto-creates sessions/agents. Switch-case dispatch by hook type. Broadcasts all state changes |
| `routes/sessions.js`  | Standard CRUD with pagination. GET includes agent count via LEFT JOIN. POST is idempotent on session ID                                          |
| `routes/agents.js`    | CRUD with status/session_id filtering. PATCH broadcasts `agent_updated`                                                                          |
| `routes/events.js`    | Read-only event listing with session_id filter and pagination                                                                                    |
| `routes/stats.js`     | Single aggregate query returning total/active counts + status distributions                                                                      |
| `routes/analytics.js` | Extended analytics — token totals, tool usage counts, daily event/session trends, agent type distribution |
| `routes/pricing.js`  | Model pricing CRUD (list/upsert/delete), per-session and global cost calculation with pattern-based model matching |
| `routes/settings.js` | System info (DB size, hook status, server uptime), data export as JSON, session cleanup (abandon stale, purge old), clear all data, reset pricing, reinstall hooks |

### Request Processing

```mermaid
flowchart LR
    REQ[Incoming<br/>Request] --> CORS[CORS<br/>Middleware]
    CORS --> JSON[JSON Body<br/>Parser<br/>1MB limit]
    JSON --> ROUTER{Route<br/>Match}
    ROUTER -->|/api/hooks| HOOKS[hooks.js]
    ROUTER -->|/api/sessions| SESSIONS[sessions.js]
    ROUTER -->|/api/agents| AGENTS[agents.js]
    ROUTER -->|/api/events| EVENTS[events.js]
    ROUTER -->|/api/stats| STATS[stats.js]
    ROUTER -->|/api/pricing| PRICING[pricing.js]
    ROUTER -->|/api/settings| SETTINGS[settings.js]
    ROUTER -->|/api/health| HEALTH[Health Check]
    ROUTER -->|"* (prod)"| STATIC[Static Files<br/>client/dist]

    HOOKS --> DB[(SQLite)]
    SESSIONS --> DB
    AGENTS --> DB
    EVENTS --> DB
    STATS --> DB
    PRICING --> DB
    SETTINGS --> DB

    HOOKS --> WS[WebSocket<br/>Broadcast]
    SESSIONS --> WS
    AGENTS --> WS
```

---

## Client Architecture

### Component Tree

```mermaid
graph TD
    APP["App.tsx<br/>Router + WebSocket"]
    LAYOUT["Layout.tsx<br/>Sidebar + Outlet"]
    SIDEBAR["Sidebar.tsx<br/>Nav + Connection Status"]
    DASH["Dashboard.tsx"]
    KANBAN["KanbanBoard.tsx"]
    SESS["Sessions.tsx"]
    DETAIL["SessionDetail.tsx"]
    ACTIVITY["ActivityFeed.tsx"]
    SETTINGS_P["Settings.tsx"]

    APP --> LAYOUT
    LAYOUT --> SIDEBAR
    LAYOUT --> DASH & KANBAN & SESS & DETAIL & ACTIVITY & SETTINGS_P

    DASH --> SC1["StatCard x4"]
    DASH --> AC1["AgentCard[]"]
    DASH --> EV1["Event rows"]

    KANBAN --> COL["Column x5<br/>(idle/connected/<br/>working/completed/error)"]
    COL --> AC2["AgentCard[]"]

    SESS --> TABLE["Session Table<br/>with filters"]
    DETAIL --> AC3["AgentCard grid"]
    DETAIL --> TL["Event Timeline"]
    ACTIVITY --> FEED["Streaming<br/>Event List"]

    style APP fill:#6366f1,stroke:#818cf8,color:#fff
    style LAYOUT fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
```

### Client Module Graph

```mermaid
graph TD
    MAIN["main.tsx<br/>React entry"]
    APP["App.tsx<br/>Router + WS"]
    EB["eventBus.ts<br/>Pub/sub"]
    WS["useWebSocket.ts<br/>Auto-reconnect hook"]
    API["api.ts<br/>Typed fetch client"]
    TYPES["types.ts<br/>Interfaces + configs"]
    FMT["format.ts<br/>Date/time utilities"]

    MAIN --> APP
    APP --> WS
    APP --> EB
    WS --> TYPES
    EB --> TYPES

    subgraph Pages
        D[Dashboard]
        K[KanbanBoard]
        S[Sessions]
        SD[SessionDetail]
        AF[ActivityFeed]
        SET[Settings]
    end

    APP --> D & K & S & SD & AF
    D & K & S & SD & AF --> API
    D & K & S & SD & AF --> EB
    D & K & S & SD & AF --> FMT
    SET --> API
    SET --> EB
    SET --> FMT
    API --> TYPES

    subgraph Components
        L[Layout]
        SB[Sidebar]
        AGC[AgentCard]
        STC[StatCard]
        STB[StatusBadge]
        ES[EmptyState]
    end

    D --> STC & AGC & STB
    K --> AGC
    S --> STB & ES
    SD --> AGC & STB
    AF --> STB & ES
    APP --> L
    L --> SB

    style TYPES fill:#3178C6,stroke:#5a9fd4,color:#fff
    style EB fill:#f59e0b,stroke:#fbbf24,color:#000
    style API fill:#10b981,stroke:#34d399,color:#fff
```

### Routing

```mermaid
graph LR
    ROOT["/ (index)"] --> DASH[Dashboard]
    KANBAN_R["/kanban"] --> KANBAN[KanbanBoard]
    SESS_R["/sessions"] --> SESS[Sessions]
    DETAIL_R["/sessions/:id"] --> DETAIL[SessionDetail]
    ACT_R["/activity"] --> ACT[ActivityFeed]

    ALL["All routes"] --> LAYOUT["Layout wrapper<br/>(Sidebar + Outlet)"]
```

| Route           | Page          | Data Sources                                           |
| --------------- | ------------- | ------------------------------------------------------ |
| `/`             | Dashboard     | `GET /api/stats`, `GET /api/agents`, `GET /api/events` |
| `/kanban`       | KanbanBoard   | `GET /api/agents?limit=200`                            |
| `/sessions`     | Sessions      | `GET /api/sessions`                                    |
| `/sessions/:id` | SessionDetail | `GET /api/sessions/:id` (includes agents + events)     |
| `/activity`     | ActivityFeed  | `GET /api/events?limit=100`                            |
| `/settings`     | Settings      | `GET /api/settings/info`, `GET /api/pricing`, `GET /api/pricing/cost` |

---

## Database Design

### Entity Relationship Diagram

```mermaid
erDiagram
    sessions ||--o{ agents : has
    sessions ||--o{ events : has
    sessions ||--o{ token_usage : tracks
    agents ||--o{ events : generates
    agents ||--o{ agents : spawns

    sessions {
        TEXT id PK "UUID"
        TEXT name "Human-readable label"
        TEXT status "active|completed|error|abandoned"
        TEXT cwd "Working directory"
        TEXT model "Claude model ID"
        TEXT started_at "ISO 8601"
        TEXT ended_at "ISO 8601 or NULL"
        TEXT metadata "JSON blob"
    }

    agents {
        TEXT id PK "UUID or session_id-main"
        TEXT session_id FK "References sessions.id"
        TEXT name "Agent display name"
        TEXT type "main|subagent"
        TEXT subagent_type "Explore|general-purpose|etc"
        TEXT status "idle|connected|working|completed|error"
        TEXT task "Current task description"
        TEXT current_tool "Active tool name or NULL"
        TEXT started_at "ISO 8601"
        TEXT ended_at "ISO 8601 or NULL"
        TEXT parent_agent_id FK "References agents.id"
        TEXT metadata "JSON blob"
    }

    events {
        INTEGER id PK "Auto-increment"
        TEXT session_id FK "References sessions.id"
        TEXT agent_id FK "References agents.id"
        TEXT event_type "PreToolUse|PostToolUse|Stop|etc"
        TEXT tool_name "Tool that triggered the event"
        TEXT summary "Human-readable summary"
        TEXT data "Full event JSON"
        TEXT created_at "ISO 8601"
    }

    token_usage {
        TEXT session_id PK "FK to sessions + part of composite PK"
        TEXT model PK "Model identifier + part of composite PK"
        INTEGER input_tokens
        INTEGER output_tokens
        INTEGER cache_read_tokens
        INTEGER cache_write_tokens
    }

    model_pricing {
        TEXT model_pattern PK "SQL LIKE pattern e.g. claude-opus-4-6%"
        TEXT display_name "Human-readable name"
        REAL input_per_mtok "Cost per million input tokens"
        REAL output_per_mtok "Cost per million output tokens"
        REAL cache_read_per_mtok "Cost per million cache read tokens"
        REAL cache_write_per_mtok "Cost per million cache write tokens"
        TEXT updated_at "ISO 8601"
    }
```

### Indexes

| Index                  | Table    | Column(s)         | Purpose                        |
| ---------------------- | -------- | ----------------- | ------------------------------ |
| `idx_agents_session`   | agents   | `session_id`      | Fast agent lookup by session   |
| `idx_agents_status`    | agents   | `status`          | Kanban board column queries    |
| `idx_events_session`   | events   | `session_id`      | Session detail event list      |
| `idx_events_type`      | events   | `event_type`      | Filter events by type          |
| `idx_events_created`   | events   | `created_at DESC` | Activity feed ordering         |
| `idx_sessions_status`  | sessions | `status`          | Status filter on sessions page |
| `idx_sessions_started` | sessions | `started_at DESC` | Default sort order             |

### SQLite Configuration

| Pragma         | Value  | Rationale                                                                  |
| -------------- | ------ | -------------------------------------------------------------------------- |
| `journal_mode` | `WAL`  | Concurrent reads during writes, better performance for read-heavy workload |
| `foreign_keys` | `ON`   | Referential integrity enforcement                                          |
| `busy_timeout` | `5000` | Wait up to 5s for write lock instead of failing immediately                |

### Prepared Statements

All queries use prepared statements (`db.prepare()`) for:

- **Security** -- parameterized queries prevent SQL injection
- **Performance** -- compiled once, executed many times
- **Reliability** -- syntax errors caught at startup, not runtime

---

## WebSocket Protocol

### Connection

- **Path:** `/ws`
- **Protocol:** Standard WebSocket (RFC 6455)
- **Heartbeat:** Server sends `ping` every 30 seconds; clients that don't `pong` are terminated

### Message Format

All messages are JSON with this envelope:

```typescript
{
  type: "session_created" | "session_updated" | "agent_created" | "agent_updated" | "new_event";
  data: Session | Agent | DashboardEvent;
  timestamp: string; // ISO 8601
}
```

### Message Flow

```mermaid
graph TD
    subgraph "Server Events"
        A[Hook event processed]
        B[Session created/updated via API]
        C[Agent created/updated via API]
    end

    subgraph "Broadcast"
        BC["broadcast(type, data)<br/>Serializes to JSON,<br/>sends to all OPEN clients"]
    end

    subgraph "Client Handling"
        WS["useWebSocket hook<br/>Auto-reconnect on close"]
        EB["eventBus.publish(msg)"]
        SUB1["Dashboard subscriber"]
        SUB2["Kanban subscriber"]
        SUB3["Sessions subscriber"]
        SUB4["SessionDetail subscriber"]
        SUB5["ActivityFeed subscriber"]
    end

    A & B & C --> BC
    BC --> WS
    WS --> EB
    EB --> SUB1 & SUB2 & SUB3 & SUB4 & SUB5

    style BC fill:#10b981,stroke:#34d399,color:#fff
    style EB fill:#f59e0b,stroke:#fbbf24,color:#000
```

### Client Reconnection

The `useWebSocket` hook implements automatic reconnection:

```mermaid
stateDiagram-v2
    [*] --> Connecting: Component mounts
    Connecting --> Connected: onopen
    Connected --> Closed: onclose
    Connected --> Closed: onerror → close
    Closed --> Connecting: setTimeout(2000ms)
    Connected --> [*]: Component unmounts
    Closed --> [*]: Component unmounts
```

---

## Hook Integration

### Hook Handler Design

`scripts/hook-handler.js` is designed to be a minimal, fail-safe forwarder:

```mermaid
flowchart TD
    START[Claude Code fires hook] --> STDIN[Read stdin to EOF]
    STDIN --> PARSE{Parse JSON?}
    PARSE -->|Success| POST["POST to 127.0.0.1:4820<br/>/api/hooks/event"]
    PARSE -->|Failure| WRAP[Wrap raw input as<br/>{"raw": "..."}]
    WRAP --> POST
    POST --> RESP{Response?}
    RESP -->|200| EXIT0[exit(0)]
    RESP -->|Error| EXIT0_ERR[exit(0)]
    RESP -->|Timeout 3s| DESTROY[Destroy request]
    DESTROY --> EXIT0_TO[exit(0)]

    SAFETY[Safety net: setTimeout 5s] --> EXIT0_SAFETY[exit(0)]

    style EXIT0 fill:#10b981,stroke:#34d399,color:#fff
    style EXIT0_ERR fill:#10b981,stroke:#34d399,color:#fff
    style EXIT0_TO fill:#10b981,stroke:#34d399,color:#fff
    style EXIT0_SAFETY fill:#10b981,stroke:#34d399,color:#fff
```

**Key design decisions:**

- Always exits 0 -- never blocks Claude Code regardless of server state
- 3-second HTTP timeout + 5-second process safety net
- Uses Node.js `http` module directly -- no dependencies
- Reads `CLAUDE_DASHBOARD_PORT` env var for port override

### Hook Installation

`scripts/install-hooks.js` modifies `~/.claude/settings.json`:

```mermaid
flowchart TD
    START[Run install-hooks.js] --> READ{~/.claude/settings.json<br/>exists?}
    READ -->|Yes| PARSE[Parse JSON]
    READ -->|No| EMPTY[Start with empty object]
    PARSE --> CHECK
    EMPTY --> CHECK

    CHECK[Ensure hooks section exists]
    CHECK --> LOOP["For each hook type:<br/>PreToolUse, PostToolUse,<br/>Stop, SubagentStop, Notification"]

    LOOP --> EXISTS{Our hook<br/>already installed?}
    EXISTS -->|Yes| UPDATE[Update command path]
    EXISTS -->|No| APPEND[Append to array]
    UPDATE --> NEXT
    APPEND --> NEXT

    NEXT{More hook types?}
    NEXT -->|Yes| LOOP
    NEXT -->|No| WRITE[Write settings.json]
    WRITE --> DONE[Print summary]
```

**Preserves existing hooks** -- only adds or updates entries containing `hook-handler.js`.

---

## State Management

### Client-Side Architecture

The client uses a deliberately simple state management approach:

```mermaid
graph TD
    subgraph "Data Sources"
        REST["REST API<br/>(initial load + refresh)"]
        WSM["WebSocket Messages<br/>(real-time updates)"]
    end

    subgraph "Distribution"
        EB["eventBus<br/>(Set-based pub/sub)"]
    end

    subgraph "Page State"
        US1["useState<br/>Dashboard"]
        US2["useState<br/>KanbanBoard"]
        US3["useState<br/>Sessions"]
        US4["useState<br/>SessionDetail"]
        US5["useState<br/>ActivityFeed"]
        US7["useState<br/>Settings"]
    end

    REST --> US1 & US2 & US3 & US4 & US5 & US7
    WSM --> EB
    EB --> US1 & US2 & US3 & US4 & US5 & US7
```

**Why no Redux / Zustand / Context:**

- Each page owns its data and lifecycle
- No cross-page state sharing needed
- WebSocket events trigger reload or append, not complex state merging
- Simpler mental model, fewer abstraction layers, easier to debug

### Event Bus

The `eventBus` is a Set-based pub/sub with `subscribe()` returning an unsubscribe function:

```typescript
// Subscribe in useEffect, unsubscribe on cleanup
useEffect(() => {
  return eventBus.subscribe((msg) => {
    if (msg.type === "agent_updated") load();
  });
}, [load]);
```

This pattern ensures:

- No memory leaks (cleanup on unmount)
- No stale closures (subscribe with latest callback ref)
- Only active pages receive messages

---

## Security Considerations

| Area                   | Approach                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQL injection**      | All queries use prepared statements with parameterized values                                                                                              |
| **Request size**       | Express JSON body parser limited to 1MB                                                                                                                    |
| **Input validation**   | Required fields checked before database operations; CHECK constraints on status enums                                                                      |
| **Hook safety**        | Hook handler always exits 0; 5s max lifetime; uses `127.0.0.1` not external hosts                                                                          |
| **CORS**               | Enabled for development; in production, same-origin (Express serves the client)                                                                            |
| **No auth**            | Intentional -- this is a local development tool. Server binds to `0.0.0.0` only for LAN access; restrict with `DASHBOARD_PORT` or firewall rules if needed |
| **No secrets**         | No API keys, tokens, or credentials stored or transmitted                                                                                                  |
| **Dependency surface** | Minimal: 5 runtime server deps, 4 runtime client deps                                                                                                      |

---

## Performance Characteristics

| Metric                         | Value                        | Notes                                                            |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| **Server startup**             | < 200ms                      | SQLite opens instantly; schema migration is idempotent           |
| **Hook latency**               | < 50ms                       | Transaction + broadcast, no async I/O beyond SQLite              |
| **Client bundle**              | 200 KB JS, 17 KB CSS         | Gzipped: ~63 KB JS, ~4 KB CSS                                    |
| **WebSocket latency**          | < 5ms                        | Local loopback, JSON serialization only                          |
| **SQLite write throughput**    | ~50,000 inserts/sec          | WAL mode on SSD; far exceeds hook event rate                     |
| **Max events before slowdown** | ~1M rows                     | SQLite handles this easily; pagination prevents full-table scans |
| **Memory usage**               | ~30 MB server, ~15 MB client | SQLite in-process, no ORM overhead                               |

### SQLite WAL Mode Benefits

```mermaid
graph LR
    subgraph "Without WAL"
        W1[Writer] -->|blocks| R1[Reader]
    end

    subgraph "With WAL"
        W2[Writer] --- R2[Reader]
        Note["Concurrent reads<br/>during writes"]
    end

    style Note fill:#10b981,stroke:#34d399,color:#fff
```

---

## Deployment Modes

### Development

```mermaid
graph LR
    subgraph "Terminal"
        DEV["npm run dev<br/>(concurrently)"]
    end

    DEV --> SERVER["node --watch server/index.js<br/>Port 4820<br/>Auto-restart on changes"]
    DEV --> VITE["vite dev server<br/>Port 5173<br/>HMR, proxies /api + /ws to 4820"]
    BROWSER["Browser"] --> VITE
    VITE -->|proxy| SERVER

    style VITE fill:#646CFF,stroke:#818cf8,color:#fff
    style SERVER fill:#339933,stroke:#5cb85c,color:#fff
```

### Production

```mermaid
graph LR
    BUILD["npm run build<br/>(tsc + vite build)"] --> DIST["client/dist/<br/>Static files"]
    START["npm start"] --> SERVER["node server/index.js<br/>Port 4820"]
    SERVER -->|serves| DIST
    BROWSER["Browser"] --> SERVER

    style SERVER fill:#339933,stroke:#5cb85c,color:#fff
    style DIST fill:#646CFF,stroke:#818cf8,color:#fff
```

| Aspect            | Development                          | Production                      |
| ----------------- | ------------------------------------ | ------------------------------- |
| **Processes**     | 2 (Express + Vite)                   | 1 (Express)                     |
| **Client**        | Vite HMR on :5173                    | Static files from `client/dist` |
| **API proxy**     | Vite proxies `/api` + `/ws` to :4820 | Same origin, no proxy needed    |
| **File watching** | `node --watch` + Vite HMR            | None                            |
| **Source maps**   | Inline                               | External files                  |

---

## Statusline Utility

The `statusline/` directory contains a standalone CLI statusline for Claude Code, separate from the web dashboard. It renders a color-coded bar at the bottom of the Claude Code terminal.

### Data Flow

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant SH as statusline-command.sh
    participant PY as statusline.py
    participant GIT as git CLI

    CC->>SH: stdin (JSON payload)
    SH->>PY: Pipes stdin through
    PY->>PY: Parse JSON (model, cwd, context_window)
    PY->>GIT: git symbolic-ref --short HEAD
    GIT-->>PY: Branch name
    PY->>PY: Build ANSI-colored segments
    PY-->>CC: stdout (formatted statusline)
```

### Segments

| Segment      | Source                                | Color Logic                                        |
| ------------ | ------------------------------------- | -------------------------------------------------- |
| Model        | `data.model.display_name`             | Always cyan                                        |
| User         | `$USERNAME` / `$USER` env var         | Always green                                       |
| Working Dir  | `data.workspace.current_dir`          | Always yellow, `~` prefix for home                 |
| Git Branch   | `git symbolic-ref --short HEAD`       | Always magenta, hidden outside git repos           |
| Context Bar  | `data.context_window.used_percentage` | Green < 50%, Yellow 50–79%, Red >= 80%             |
| Token Counts | `data.context_window.current_usage`   | Always dim; `↑` input, `↓` output, `c` cache reads |

### Integration

The statusline is configured in `~/.claude/settings.json` via the `statusLine` key:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash \"/path/to/.claude/statusline-command.sh\""
  }
}
```

Claude Code invokes this command on each update, piping a JSON payload to stdin. The script reads the JSON, extracts fields, runs `git` for branch info, and prints ANSI-formatted output to stdout.

**Design decisions:**

- **Python 3.6+** -- available on virtually all systems, handles ANSI and JSON natively
- **No dependencies** -- uses only stdlib (`sys`, `json`, `os`, `subprocess`)
- **Shell wrapper** -- `statusline-command.sh` sets `PYTHONUTF8=1` for Windows Unicode support and resolves the absolute path to the Python script
- **Fail-safe** -- exits silently on empty input or JSON parse errors, never blocks Claude Code

---

## Technology Choices

| Technology                      | Why This Over Alternatives                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **SQLite** (via better-sqlite3) | Zero-config, embedded, no server process. WAL mode gives concurrent reads. Synchronous API is simpler than async alternatives for this use case |
| **Express**                     | Battle-tested, minimal, well-understood. Overkill would be Fastify for this scale; underkill would be raw `http` module                         |
| **ws**                          | Fastest, most lightweight WebSocket library for Node. No Socket.IO overhead needed since we only push JSON messages                             |
| **React 18**                    | Stable, widely known, strong TypeScript support. No need for Server Components or RSC given this is a client-rendered SPA                       |
| **Vite**                        | Fast builds, native ESM, excellent dev experience. Proxy config handles the dev server split cleanly                                            |
| **Tailwind CSS**                | Utility-first approach keeps styles colocated with markup. No CSS module boilerplate. Custom theme config for the dark UI                       |
| **React Router 6**              | Standard routing for React SPAs. Layout routes with `<Outlet>` give clean shell composition                                                     |
| **Lucide React**                | Tree-shakeable icon library. Only imports what's used (~20 icons)                                                                               |
| **TypeScript Strict**           | Catches null/undefined bugs at compile time. `noUncheckedIndexedAccess` prevents array bounds issues                                            |
