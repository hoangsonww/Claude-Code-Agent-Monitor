# Agent Dashboard - System Design and Technical Reference

Architectural overview and technical reference for the Agent Dashboard system, covering design goals, high-level architecture, data flow, server and client components, database design, WebSocket protocol, hook integration, MCP extension layer, Claude Code plugins & skills, state management, security considerations, performance characteristics, deployment modes, and technology choices.

![Claude Code](https://img.shields.io/badge/Claude_Code-orange?style=flat-square&logo=claude&logoColor=white)
![Claude Code Plugins](https://img.shields.io/badge/Claude_Code-Plugins_&_Skills-orange?style=flat-square&logo=anthropic&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Javascript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-RFC_6455-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Model Context Protocol](https://img.shields.io/badge/Model_Context_Protocol-1.0-0f766e?style=flat-square&logo=modelcontextprotocol&logoColor=white)
![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-000000?style=flat-square&logo=openapiinitiative&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-3.0-85EA2D?style=flat-square&logo=swagger&logoColor=white)
![i18next](https://img.shields.io/badge/i18next-22.4-7A42FF?style=flat-square&logo=i18next&logoColor=white)
![i18next Language Detector](https://img.shields.io/badge/i18next_Language_Detector-6.1-7A42FF?style=flat-square&logo=i18next&logoColor=white)
![Mermaid](https://img.shields.io/badge/Mermaid-10.2-ff3333?style=flat-square&logo=mermaid&logoColor=white)
![better--sqlite3](https://img.shields.io/badge/better--sqlite3-11.7-003B57?style=flat-square&logo=sqlite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-6.28-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide_Icons-0.474-F56565?style=flat-square&logo=lucide&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-7-F9A03C?style=flat-square&logo=d3dotjs&logoColor=white)
![PostCSS](https://img.shields.io/badge/PostCSS-8.5-DD3A0A?style=flat-square&logo=postcss&logoColor=white)
![Autoprefixer](https://img.shields.io/badge/Autoprefixer-10.4-DD3735?style=flat-square&logo=autoprefixer&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-8.44-4B32C3?style=flat-square&logo=eslint&logoColor=white)
![Python](https://img.shields.io/badge/Python-%3E%3D3.6-3776AB?style=flat-square&logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-20.10-2496ED?style=flat-square&logo=docker&logoColor=white)
![Podman](https://img.shields.io/badge/Podman-4.0-CC342D?style=flat-square&logo=podman&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-1.0-646CFF?style=flat-square&logo=vitest&logoColor=white)
![React Testing Library](https://img.shields.io/badge/React_Testing_Library-13.0-FF5733?style=flat-square&logo=testinglibrary&logoColor=white)
![SSE](https://img.shields.io/badge/SSE-Server_Sent_Events-FF6600?style=flat-square&logo=googlechrome&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-%3E%3D1.5-844FBA?style=flat-square&logo=terraform&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-%3E%3D1.24-326CE5?style=flat-square&logo=kubernetes&logoColor=white)
![Helm](https://img.shields.io/badge/Helm-3-0F1689?style=flat-square&logo=helm&logoColor=white)
![Kustomize](https://img.shields.io/badge/Kustomize-5.0-326CE5?style=flat-square&logo=kubernetes&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-2.x-E6522C?style=flat-square&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-10.x-F46800?style=flat-square&logo=grafana&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-Ingress-009639?style=flat-square&logo=nginx&logoColor=white)
![Coralogix](https://img.shields.io/badge/Coralogix-Observability-1a1a2e?style=flat-square&logo=datadog&logoColor=white)
![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Collector-4f46e5?style=flat-square&logo=opentelemetry&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-ECS%20%7C%20RDS-232F3E?style=flat-square&logo=task&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-GKE%20%7C%20SQL-4285F4?style=flat-square&logo=googlecloud&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-AKS%20%7C%20SQL-0078D4?style=flat-square&logo=cloudflare&logoColor=white)
![Oracle Cloud](https://img.shields.io/badge/Oracle_Cloud-OKE%20%7C%20DB-F80000?style=flat-square&logo=cloudways&logoColor=white)
![GitLab CI](https://img.shields.io/badge/GitLab_CI-pipelines-FC6D26?style=flat-square&logo=gitlab&logoColor=white)
![Make](https://img.shields.io/badge/Make-4.3-000000?style=flat-square&logo=make&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-pipelines-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![VS Code](https://img.shields.io/badge/VS_Code-Extension-007ACC?style=flat-square&logo=vscodium&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## Table of Contents

- [System Overview](#system-overview)
- [High-Level Architecture](#high-level-architecture)
- [Data Flow](#data-flow)
- [Server Architecture](#server-architecture)
- [Client Architecture](#client-architecture)
- [Internationalization Architecture](#internationalization-architecture)
- [Database Design](#database-design)
- [WebSocket Protocol](#websocket-protocol)
- [Hook Integration](#hook-integration)
- [Import Pipeline](#import-pipeline)
- [Agent Extension Layer](#agent-extension-layer)
- [Plugin Marketplace](#plugin-marketplace)
- [MCP Integration](#mcp-integration)
- [State Management](#state-management)
- [Browser Notification System](#browser-notification-system)
- [VS Code Extension Architecture](#vs-code-extension-architecture)
- [Security Considerations](#security-considerations)
- [Performance Characteristics](#performance-characteristics)
- [Deployment Modes](#deployment-modes)
- [Statusline Utility](#statusline-utility)
- [Technology Choices](#technology-choices)
- [Build & Run Targets](#build--run-targets)

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
- Extensible -- plugin marketplace with 5 plugins (18 skills, 4 agents, 3 CLI tools)

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Claude Code Process"
        CC[Claude Code CLI]
        H0[SessionStart Hook]
        H1[PreToolUse Hook]
        H2[PostToolUse Hook]
        H3[Stop Hook]
        H4[SubagentStop Hook]
        H5[Notification Hook]
        H6[SessionEnd Hook]
        CC --> H0 & H1 & H2 & H3 & H4 & H5 & H6
    end

    subgraph "Plugin Layer"
        direction TB
        PM["Plugin Marketplace<br/>(5 plugins, 18 skills)"]
        PA["ccam-analytics"]
        PP["ccam-productivity"]
        PD["ccam-devtools"]
        PI["ccam-insights"]
        PC["ccam-dashboard"]
        PM --> PA & PP & PD & PI & PC
    end

    subgraph "Hook Layer"
        HH["hook-handler.js<br/>(stdin → HTTP)"]
        H0 & H1 & H2 & H3 & H4 & H5 & H6 -->|stdin JSON| HH
    end

    subgraph "Server Process (port 4820)"
        direction TB
        EX[Express Server]
        HR[Hook Router]
        SR[Session Router]
        AR[Agent Router]
        ER[Event Router]
        STR[Stats Router]
        ANR[Analytics Router]
        WFR[Workflows Router]
        PR[Pricing Router]
        DB[(SQLite<br/>WAL mode)]
        WSS[WebSocket Server]

        EX --> HR & SR & AR & ER & STR & ANR & WFR & PR
        HR -->|transaction| DB
        SR & AR & ER & STR & ANR & WFR & PR --> DB
        HR -->|broadcast| WSS
        SR & AR -->|broadcast| WSS
    end

    subgraph "Client (Browser)"
        direction TB
        VITE[Vite Dev Server<br/>or Static Files]
        APP[React App]
        WS_CLIENT[WebSocket Client]
        EB[Event Bus]
        PAGES[Pages:<br/>Dashboard / Kanban /<br/>Sessions / Activity /<br/>Analytics / Workflows]

        VITE --> APP
        APP --> WS_CLIENT
        WS_CLIENT --> EB
        EB --> PAGES
        PAGES -->|fetch| EX
    end

    HH -->|"POST /api/hooks/event"| HR
    WSS -->|push messages| WS_CLIENT
    PA & PP & PD & PI & PC -->|"curl API"| EX

    style CC fill:#6366f1,stroke:#818cf8,color:#fff
    style DB fill:#003B57,stroke:#005f8a,color:#fff
    style WSS fill:#10b981,stroke:#34d399,color:#fff
    style EB fill:#f59e0b,stroke:#fbbf24,color:#000
    style PM fill:#8b5cf6,stroke:#a78bfa,color:#fff
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
    Note over TX: SessionStart → create/reactivate session,<br/>abandon stale sessions (5+ min idle)<br/>PreToolUse → set agent working<br/>PostToolUse → clear current_tool<br/>Stop → main agent idle (non-tool turns too)<br/>SubagentStop → mark subagent done<br/>SessionEnd → mark all completed<br/>Every event → detect compaction from JSONL,<br/>create Compaction agent + event if new

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
    DB[server/db.js<br/>SQLite + prepared statements<br/>better-sqlite3 → node:sqlite fallback]
    WS[server/websocket.js<br/>WS server + broadcast]
    HOOKS[routes/hooks.js<br/>Hook event processing]
    TC[lib/transcript-cache.js<br/>JSONL cache + incremental reads]
    SESSIONS[routes/sessions.js<br/>Session CRUD]
    AGENTS[routes/agents.js<br/>Agent CRUD]
    EVENTS[routes/events.js<br/>Event listing]
    STATS[routes/stats.js<br/>Aggregate queries]
    PRICING[routes/pricing.js<br/>Cost calculation + pricing CRUD]
    SETTINGS[routes/settings.js<br/>System info + data management]
    WORKFLOWS[routes/workflows.js<br/>Workflow visualizations]

    INDEX --> DB
    INDEX --> WS
    INDEX --> HOOKS & SESSIONS & AGENTS & EVENTS & STATS & PRICING & SETTINGS & WORKFLOWS

    HOOKS --> DB & WS & TC
    SETTINGS --> DB & TC
    INDEX --> TC
    SESSIONS --> DB & WS
    AGENTS --> DB & WS
    EVENTS --> DB
    STATS --> DB & WS
    PRICING --> DB
    WORKFLOWS --> DB

    style INDEX fill:#6366f1,stroke:#818cf8,color:#fff
    style DB fill:#003B57,stroke:#005f8a,color:#fff
    style WS fill:#10b981,stroke:#34d399,color:#fff
```

### Server Components

| Module                    | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `server/index.js`         | Express app setup, middleware, route mounting, static file serving in production, HTTP server creation. Runs a periodic maintenance sweep every 2 min (abandons stale sessions with transcript cache eviction, scans active sessions for new compaction entries via shared transcript cache). Triggers legacy session import (with active-session detection for recently-modified JSONL files) and compaction backfill on startup                                                                                                                                                                                                                    |
| `server/openapi.js`       | OpenAPI 3.0.3 document generator for the backend API (metadata, schemas, endpoint paths) used by both raw spec endpoint (`/api/openapi.json`) and Swagger UI (`/api/docs`)                                                                                                                                                                                                                                                                                                                                                      |
| `server/db.js`            | SQLite connection with WAL mode, schema migration (CREATE TABLE IF NOT EXISTS + ALTER TABLE for column additions), all prepared statements as a reusable `stmts` object. Tries `better-sqlite3` first, falls back to `node:sqlite` via `compat-sqlite.js`. Migrations use literal defaults for ALTER TABLE since SQLite does not support expressions like `strftime()` in column defaults added via ALTER TABLE                                                                                                                      |
| `server/compat-sqlite.js` | Compatibility wrapper that gives Node.js built-in `node:sqlite` (`DatabaseSync`) the same API as `better-sqlite3` — pragma, transaction, prepare. Used as automatic fallback when the native module is unavailable (Node 22+)                                                                                                                                                                                                                                                                                                        |
| `server/websocket.js`     | WebSocket server on `/ws` path, 30s heartbeat with ping/pong dead connection detection, typed broadcast function                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `routes/hooks.js`         | Core event processing inside a SQLite transaction. Auto-creates sessions/agents. Handles 7 hook types (SessionStart through SessionEnd) plus synthetic `Compaction` events. Manages agent state machine, session reactivation on resume (including Stop/SubagentStop reactivation for imported completed/abandoned sessions), orphaned session cleanup (5+ min idle). Uses a shared `TranscriptCache` instance (`server/lib/transcript-cache.js`) for extraction of tokens, API errors, turn durations, thinking blocks, and usage extras — stat-based caching with incremental byte-offset reads avoids re-reading entire JSONL files on every event. Detects compaction via `isCompactSummary` in JSONL transcripts and creates compaction agents + events (deduplicated by uuid). Token baselines (`baseline_*` columns) preserve pre-compaction totals so no usage is lost. Cache entries are evicted on SessionEnd |
| `routes/sessions.js`      | Standard CRUD with pagination. GET includes agent count via LEFT JOIN. POST is idempotent on session ID                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `routes/agents.js`        | CRUD with status/session_id filtering. PATCH broadcasts `agent_updated`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `routes/events.js`        | Read-only event listing with session_id filter and pagination                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `routes/stats.js`         | Single aggregate query returning total/active counts + status distributions                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `routes/analytics.js`     | Extended analytics — token totals, tool usage counts, daily event/session trends, agent type distribution. The client-side analytics heatmap grid is aligned to a Sunday start for correct day-of-week positioning                                                                                                                                                                                                                                                                                                                   |
| `routes/pricing.js`       | Model pricing CRUD (list/upsert/delete), per-session and global cost calculation with pattern-based model matching                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `routes/settings.js`      | System info (DB size, hook status, server uptime, transcript cache stats), data export as JSON, session cleanup (abandon stale, purge old), clear all data, reset pricing, reinstall hooks                                                                                                                                                                                                                                                                                                                                           |
| `routes/workflows.js`     | Aggregate workflow visualization data (agent orchestration graphs, tool transition flows, collaboration networks, workflow pattern detection, model delegation, error propagation, concurrency timelines, session complexity metrics, compaction impact). Accepts `?status=active\|completed` query parameter to filter all data by session status. Per-session drill-in endpoint with agent tree, tool timeline, and event details |
| `lib/transcript-cache.js` | Stat-based JSONL transcript cache with incremental byte-offset reads. Shared between `hooks.js` (token extraction on every event) and the periodic compaction scanner (`index.js`). Extracts tokens, compaction entries, API errors (`isApiErrorMessage` + raw error responses), turn durations (`system` subtype `turn_duration`), thinking block counts, and usage extras (service_tier, speed, inference_geo). Uses `(path, mtime, size)` cache key — unchanged files return cached results instantly, grown files only parse new bytes, shrunk files (compaction) trigger full re-read. LRU eviction caps at 200 entries. Entries evicted on SessionEnd and abandoned session cleanup |
| `scripts/import-history.js` | Batch history importer used by (a) server startup auto-import, (b) the `/api/import/*` routes, and (c) the `import-history` CLI. Exposes `importAllSessions(dbModule)` for the default `~/.claude/projects` tree and the generalized `importFromDirectory(dbModule, rootDir, {onProgress})` which walks any directory recursively, classifies each `.jsonl` as session vs subagent (with `findSessionSubagents` probing both `<proj>/<sid>/subagents/*` and `<proj>/subagents/<sid>/*` layouts), and funnels everything through the shared `parseSessionFile` + `importSession` pipeline. Token totals, per-model cost, compactions, subagents, tool events, API errors, and turn durations are identical to live ingestion, and re-imports are idempotent (session-id dedup + `baseline_*` token preservation). Creates `APIError`, `TurnDuration`, and `ToolError` event types during import |
| `server/routes/import.js`   | Express router for the Import History feature. Three endpoints funnel into the same pipeline: `POST /api/import/rescan` (default projects dir), `POST /api/import/scan-path` (arbitrary absolute dir with `~` expansion), `POST /api/import/upload` (multer multipart accepting `.jsonl`, `.meta.json`, `.zip`, `.tar`, `.tar.gz`, `.tgz`, `.gz`). `GET /api/import/guide` returns OS-aware instructions + archive command + default-dir stats. Each request uses a per-request temp dir (`req._ccamUploadDir` for multer staging, a separate `workDir` for extraction) that is reclaimed in `finally`. Progress is broadcast as `import.progress` websocket messages throttled at ~150 ms. Limits configurable via `CCAM_IMPORT_MAX_BYTES` / `CCAM_IMPORT_MAX_FILES` |
| `server/lib/archive.js`     | Safe archive extraction: `.zip` via `adm-zip`, `.tar`/`.tar.gz`/`.tgz` via `tar`, plain `.gz` via `zlib` in streaming mode. Every entry is validated through `safeJoin` which rejects absolute paths and `..` traversal before any bytes are written. Enforces a hard extraction cap (`MAX_EXTRACT_BYTES`, default 4 GB, tunable via `CCAM_IMPORT_MAX_EXTRACT_BYTES`) with `ExtractionLimitError` surfaced as HTTP 413 from the upload route — defense against zip/tar/gzip bombs. Also provides `detectKind` for filename-based dispatch and `mkTempDir`/`rmTempDir` helpers |

### API Documentation

Both JSDoc and Swagger/OpenAPI 3.0.3 are used for API documentation. JSDoc comments in route handlers provide inline documentation and type hints, while the OpenAPI spec is generated centrally for interactive API exploration via Swagger UI.

| Layer | Source | Purpose |
|-------|--------|---------|
| Inline code docs | JSDoc blocks in `server/index.js`, `server/db.js`, `server/routes/*.js`, and `server/lib/*.js` | Explain route behavior, lifecycle logic, and internal contracts close to implementation |
| Machine-readable API contract | `server/openapi.js` (`createOpenApiSpec()`) | Defines OpenAPI 3.0.3 `info`, schemas, parameters, and all documented `/api/*` paths |
| Human/interactive docs | `GET /api/openapi.json` and `GET /api/docs` | Exposes raw OpenAPI JSON and Swagger UI for exploration and integration testing |

The OpenAPI metadata is grounded in real project data (`package.json` version/license/repository/bugs), and route coverage is enforced in `server/__tests__/api.test.js` by asserting expected paths exist in the spec.

<p align="center">
  <img src="images/swagger.png" alt="Swagger UI" width="100%">
</p>

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
    ROUTER -->|/api/analytics| ANALYTICS[analytics.js]
    ROUTER -->|/api/pricing| PRICING[pricing.js]
    ROUTER -->|/api/settings| SETTINGS[settings.js]
    ROUTER -->|/api/workflows| WORKFLOWS[workflows.js]
    ROUTER -->|/api/openapi.json| OPENAPI[OpenAPI JSON]
    ROUTER -->|/api/docs| SWAGGER[Swagger UI]
    ROUTER -->|/api/health| HEALTH[Health Check]
    ROUTER -->|"* (prod)"| STATIC[Static Files<br/>client/dist]

    HOOKS --> DB[(SQLite)]
    SESSIONS --> DB
    AGENTS --> DB
    EVENTS --> DB
    STATS --> DB
    ANALYTICS --> DB
    PRICING --> DB
    SETTINGS --> DB
    WORKFLOWS --> DB

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

    ANALYTICS_P["Analytics.tsx"]
    WORKFLOWS_P["Workflows.tsx"]
    NOTFOUND["NotFound.tsx"]

    APP --> LAYOUT
    LAYOUT --> SIDEBAR
    LAYOUT --> DASH & KANBAN & SESS & DETAIL & ACTIVITY & ANALYTICS_P & WORKFLOWS_P & SETTINGS_P & NOTFOUND

    DASH --> SC1["StatCard x6<br/>(sessions/agents/subagents/<br/>events today/total events/cost)<br/>3-column grid"]
    DASH --> AC1["AgentCard[]<br/>with collapsible subagent hierarchy"]
    DASH --> EV1["Event rows"]

    KANBAN --> COL["Column x5<br/>(idle/connected/<br/>working/completed/error)"]
    COL --> AC2["AgentCard[]"]

    SESS --> TABLE["Session Table<br/>with filters"]
    DETAIL --> AC3["AgentCard hierarchy<br/>parent → children tree"]
    DETAIL --> TL["Event Timeline"]
    ACTIVITY --> FEED["Streaming Event List<br/>(click row → expand payload;<br/>Session btn → session detail)"]
    WORKFLOWS_P --> WFC["12 D3.js components<br/>(workflows/ directory)"]

    style APP fill:#6366f1,stroke:#818cf8,color:#fff
    style LAYOUT fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
```

### Client Module Graph

```mermaid
graph TD
    MAIN["main.tsx<br/>React entry"]
    APP["App.tsx<br/>Router + WS + Notifications"]
    EB["eventBus.ts<br/>Pub/sub + connection state"]
    WS["useWebSocket.ts<br/>Auto-reconnect hook"]
    NOTIF["useNotifications.ts<br/>Browser notification triggers"]
    API["api.ts<br/>Typed fetch client"]
    TYPES["types.ts<br/>Interfaces + configs"]
    FMT["format.ts<br/>Date/time utilities"]

    MAIN --> APP
    APP --> WS
    APP --> EB
    APP --> NOTIF
    NOTIF --> EB
    WS --> TYPES
    EB --> TYPES

    subgraph Pages
        D[Dashboard]
        K[KanbanBoard]
        S[Sessions]
        SD[SessionDetail]
        AF[ActivityFeed]
        AN[Analytics]
        WF[Workflows]
        SET[Settings]
        NF[NotFound]
    end

    APP --> D & K & S & SD & AF & AN & WF
    D & K & S & SD & AF & AN & WF --> API
    D & K & S & SD & AF & AN & WF --> EB
    D & K & S & SD & AF & AN & WF --> FMT
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
    AN_R["/analytics"] --> AN[Analytics]
    WF_R["/workflows"] --> WF[Workflows]
    SET_R["/settings"] --> SET[Settings]
    NF_R["/*"] --> NF[NotFound]

    ALL["All routes"] --> LAYOUT["Layout wrapper<br/>(Sidebar + Outlet)"]
```

| Route           | Page          | Data Sources                                           |
| --------------- | ------------- | ------------------------------------------------------ |
| `/`             | Dashboard     | `GET /api/stats`, `GET /api/agents`, `GET /api/events`, `GET /api/agents?session_id={sid}` (subagent hierarchy) |
| `/kanban`       | KanbanBoard   | `GET /api/agents?status={each}` per-status (no limit)  |
| `/sessions`     | Sessions      | `GET /api/sessions`                                    |
| `/sessions/:id` | SessionDetail | `GET /api/sessions/:id` (includes agents + events)     |
| `/activity`     | ActivityFeed  | `GET /api/events?limit=100` — click row to expand inline payload; "Session →" button navigates to `/sessions/:id` |
| `/analytics`    | Analytics     | `GET /api/analytics`                                   |
| `/workflows`    | Workflows     | `GET /api/workflows?status=active\|completed`, `GET /api/workflows/session/:id` + WebSocket auto-refresh (3s debounce) |
| `/settings`     | Settings      | `GET /api/settings/info`, `GET /api/pricing`, `GET /api/pricing/cost` + `localStorage` for notification prefs |
| `/*`            | NotFound      | None (static 404 page)                                 |

### Activity Feed Interaction Model

The Activity Feed (`/activity`) separates two previously conflated interactions into distinct affordances:

```mermaid
flowchart LR
    ROW["Event row\n(div role=button)"] -->|click / Enter / Space| EXPAND["Toggle inline\nEventDetail panel"]
    ROW --> BTN["Session → button\n(right edge, Link)"]
    BTN -->|click - stopPropagation| NAV["/sessions/:id"]
    EXPAND --> DETAIL["EventDetail.tsx\nparsed payload fields\n+ terminal JSON blocks"]

    style ROW fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style BTN fill:#6366f1,stroke:#818cf8,color:#fff
    style DETAIL fill:#10b981,stroke:#34d399,color:#fff
    style NAV fill:#f59e0b,stroke:#fbbf24,color:#000
```

- **Row click** (anywhere except the Session button) toggles the `EventDetail` dropdown for the selected event. Chevron rotates 90° as a visual indicator.
- **Session → button** uses `e.stopPropagation()` to navigate to session details without triggering the expand toggle.
- Expanded state is tracked in a `Set<number>` (`expandedEvents`) allowing multiple rows to be open simultaneously.
- Keyboard accessible: `Enter` and `Space` on the row trigger expand; the Session button is a standard `<a>` element navigable by Tab.

### Workflows Page Architecture

The Workflows page (`/workflows`) is the most visualization-heavy page, composed of 12 child components in `client/src/components/workflows/`. Most D3.js rendering is done client-side using data from two API endpoints. The aggregate endpoint accepts an optional `?status=active|completed` query parameter to filter all workflow data by session status.

```mermaid
graph TD
    WF["Workflows.tsx<br/>Page orchestrator"]:::root
    API_AGG["GET /api/workflows?status=...<br/>Aggregate data (filterable)"]
    API_DI["GET /api/workflows/session/:id<br/>Session drill-in"]
    WS_D["WebSocket auto-refresh<br/>(3s debounce)"]

    WF --> API_AGG
    WF --> API_DI
    WS_D --> WF

    WF --> S1["WorkflowStats<br/>Summary cards"]
    WF --> S2["OrchestrationDAG<br/>Horizontal DAG —<br/>Sessions → Main → Subagents → Outcomes"]
    WF --> S3["ToolExecutionFlow<br/>d3-sankey tool transitions"]
    WF --> S4["AgentCollaborationNetwork<br/>Force-directed pipeline graph"]
    WF --> S5["SubagentEffectiveness<br/>SVG success rings +<br/>day-of-week sparklines"]
    WF --> S6["WorkflowPatterns<br/>Auto-detected sequences"]
    WF --> S7["ModelDelegationFlow<br/>Model → agent routing"]
    WF --> S8["ErrorPropagationMap<br/>React horizontal bars +<br/>API/session error support"]
    WF --> S9["ConcurrencyTimeline<br/>Swim-lane parallel execution"]
    WF --> S10["SessionComplexityScatter<br/>D3 bubble chart"]
    WF --> S11["CompactionImpact<br/>Token compression analysis"]
    WF --> S12["SessionDrillIn<br/>Searchable session explorer<br/>(3 tabs: tree / timeline / events)"]

    classDef root fill:#6366f1,stroke:#818cf8,color:#fff
```

| Component | Visualization | D3 Feature |
| --- | --- | --- |
| `OrchestrationDAG` | Horizontal DAG of aggregate spawning patterns | Custom DAG layout, capped at top 7 subagent types with overflow node |
| `ToolExecutionFlow` | Tool-to-tool transition Sankey diagram | `d3-sankey` |
| `AgentCollaborationNetwork` | Agent pipeline graph with directed edges | `d3-force` with arrowheads and frequency labels |
| `SubagentEffectiveness` | Scorecard grid with success rate rings | SVG arc rendering, day-of-week sparklines (Mon-Sun) with labels and tooltips (max 3 per row) |
| `WorkflowPatterns` | Common orchestration sequences | Pattern detection from event data |
| `ModelDelegationFlow` | Model routing through agent hierarchies | Hierarchical layout |
| `ErrorPropagationMap` | Error clustering by hierarchy depth with API/session event errors | Pure React horizontal bars (replaced D3 bar chart), `eventErrors` support for API and session-level errors |
| `ConcurrencyTimeline` | Swim-lane parallel agent execution | Time-scaled horizontal bars |
| `SessionComplexityScatter` | Duration vs agents vs tokens | D3 bubble/scatter chart |
| `CompactionImpact` | Token compression events and recovery | Before/after comparison |
| `SessionDrillIn` | Per-session agent tree, tool timeline, events | Searchable dropdown with pagination, 3 tabs |

**Cross-filtering:** Clicking nodes in the OrchestrationDAG filters data in other sections. **JSON export:** All workflow data can be exported as JSON from the page header.

---

## Internationalization Architecture

The client localization stack is powered by `i18next` + `react-i18next` (`client/src/i18n/index.ts`) and currently supports three languages: English (`en`), Chinese (`zh`), and Vietnamese (`vi`). Language detection prefers `localStorage` (`i18nextLng`) and falls back to the browser locale (`navigator`) with `en` as final fallback.

```mermaid
flowchart LR
    A["Browser load"] --> B["LanguageDetector<br/>localStorage -> navigator"]
    B --> C["Resolved language<br/>en | zh | vi (fallback en)"]
    C --> D["Namespace resources<br/>common/nav/dashboard/sessions/..."]
    D --> E["React pages/components<br/>useTranslation(ns)"]
    E --> F["format.ts locale mapping<br/>en-US | zh-CN | vi-VN"]
    F --> G["Localized labels,<br/>dates, and number formatting"]
```

See [docs/I18N.md](docs/I18N.md) for resource strategy, key naming conventions, localization tests, troubleshooting, and rollout checklists.

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
        TEXT name "Main Agent — {session name} or subagent description"
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
        INTEGER input_tokens "Current JSONL total"
        INTEGER output_tokens "Current JSONL total"
        INTEGER cache_read_tokens "Current JSONL total"
        INTEGER cache_write_tokens "Current JSONL total"
        INTEGER baseline_input "Accumulated pre-compaction tokens"
        INTEGER baseline_output "Accumulated pre-compaction tokens"
        INTEGER baseline_cache_read "Accumulated pre-compaction tokens"
        INTEGER baseline_cache_write "Accumulated pre-compaction tokens"
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

    push_subscriptions {
        TEXT endpoint PK "Subscription URL"
        TEXT p256dh "Public key"
        TEXT auth "Auth secret"
        TEXT created_at "ISO 8601"
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

Notable prepared statements include `findStaleSessions` (used by `SessionStart` to identify active sessions with no activity for a configurable number of minutes), `touchSession` (bumps `updated_at` on every event), and `reactivateSession` / `reactivateAgent` (used when a previously completed/abandoned session receives new work or stop events — Stop/SubagentStop reactivate completed/abandoned sessions to handle sessions imported before the server started).

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
        SUB6["Workflows subscriber<br/>(3s debounce)"]
    end

    A & B & C --> BC
    BC --> WS
    WS --> EB
    EB --> SUB1 & SUB2 & SUB3 & SUB4 & SUB5 & SUB6

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
    PARSE -->|Failure| WRAP["Wrap raw input as<br/>#123;raw: ...#125;"]
    WRAP --> POST
    POST --> RESP{Response?}
    RESP -->|200| EXIT0[exit = 0]
    RESP -->|Error| EXIT0_ERR[exit = 0]
    RESP -->|Timeout 3s| DESTROY[Destroy request]
    DESTROY --> EXIT0_TO[exit = 0]

    SAFETY[Safety net: setTimeout 5s] --> EXIT0_SAFETY[exit = 0]

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
    CHECK --> LOOP["For each hook type:<br/>SessionStart, PreToolUse, PostToolUse,<br/>Stop, SubagentStop, Notification, SessionEnd"]

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

## Import Pipeline

The dashboard ships with a first-class **history importer** that backfills
sessions, agents, events, tokens, and costs from Claude Code JSONL
transcripts. Live hook ingestion and manual import share the exact same
parser (`parseSessionFile` + `importSession` in `scripts/import-history.js`),
which is the architectural contract that guarantees imported token and cost
values are identical to those captured in real time.

<p align="center">
  <img src="images/import.png" alt="Import History UI" width="100%">
</p>

### Design goals

- **Accuracy by construction** — any code path that creates a session goes
  through a single `importSession` entry point. There is no "import math"
  distinct from "live math."
- **Idempotence** — re-importing the same source must never double-count.
  Session IDs are the dedup key; compaction `baseline_*` columns preserve
  pre-compaction token totals so re-ingesting a compacted transcript never
  shrinks historical cost.
- **Source flexibility** — users bring history from the default location,
  any folder, or a drag-dropped archive. A single generalized walker feeds
  the parser regardless of the source.
- **Safety** — archive extraction enforces path containment and an extraction
  size cap (zip/tar/gzip-bomb defense), and every request has its own
  staging directory reclaimed on both success and error paths.

### Component overview

```mermaid
flowchart TD
    subgraph Clients
      UI["Browser: Settings →<br/>Import History panel"]
      CLI["CLI: npm run import-history"]
      STARTUP["Server startup<br/>(auto-import)"]
    end

    UI -->|POST /api/import/guide<br/>POST /api/import/rescan<br/>POST /api/import/scan-path<br/>POST /api/import/upload| RT["server/routes/import.js"]
    CLI --> IMP["scripts/import-history.js<br/>importAllSessions()"]
    STARTUP --> IMP

    RT -->|archives| AR["server/lib/archive.js<br/>extractZip / extractTar /<br/>extractGzSingle"]
    RT -->|directory walk| FD["importFromDirectory()"]
    AR -.->|temp workDir| FD
    IMP --> FD

    FD -->|per-session| PS["parseSessionFile()"]
    FD -->|per-subagent| PSA["parseSubagentFile()"]
    PS --> IS["importSession()"]
    PSA --> IS

    IS -->|prepared stmts<br/>single transaction| DB[("SQLite:<br/>sessions / agents / events /<br/>token_usage")]
    IS -.->|progress throttled<br/>~150ms| WS["server/websocket.js<br/>broadcast('import.progress')"]
    WS -.-> UI

    style UI fill:#a855f7,stroke:#c084fc,color:#fff
    style RT fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style AR fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style FD fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style IMP fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style IS fill:#f59e0b,stroke:#fbbf24,color:#000
    style DB fill:#10b981,stroke:#34d399,color:#fff
```

### Upload request sequence

The upload path is the most complex of the three — it must accept multipart
data, extract archives safely, stage them on disk, then invoke the shared
importer. The sequence below captures the complete request/response path
including the failure modes explicitly guarded against.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Settings UI
    participant API as /api/import/upload
    participant M as multer (disk)
    participant AR as archive.js
    participant IMP as importFromDirectory
    participant DB as SQLite
    participant WS as WebSocket /ws

    UI->>API: POST multipart files[]
    API->>M: route through uploadMiddleware
    M->>M: mkTempDir('ccam-upload-*')<br/>stored on req._ccamUploadDir
    M->>M: fileFilter: reject unsupported<br/>(tracked in req._ccamRejected)
    alt All files rejected
      API-->>UI: 400 NO_FILES<br/>+ rejected_files[]
    else Files accepted
      API->>AR: mkTempDir('ccam-import-work-*')
      loop per uploaded file
        API->>AR: extractInto(srcPath, workDir, name)
        AR->>AR: safeJoin: reject absolute / ..
        AR->>AR: enforce MAX_EXTRACT_BYTES
        alt Extraction cap exceeded
          AR-->>API: throw ExtractionLimitError
          API-->>UI: 413 EXTRACTION_LIMIT_EXCEEDED
          API-->>WS: import.progress{phase:error}
          Note over API: break and cleanup
        else OK
          AR-->>API: {extracted, skipped}
        end
        API->>WS: import.progress{phase:extract}
      end
      API->>IMP: importFromDirectory(dbModule, workDir)
      IMP->>IMP: collectJsonlFiles (recursive)
      IMP->>IMP: parseSessionFile per JSONL
      IMP->>IMP: findSessionSubagents (2 layouts)
      IMP->>DB: importSession in one transaction
      IMP-->>WS: import.progress{phase:parse,complete}
      API-->>UI: 200 {imported, backfilled,<br/>skipped, errors, rejected_files}
    end
    API->>AR: rmTempDir(workDir)
    API->>M: rmTempDir(req._ccamUploadDir)
```

### Idempotence and cost accuracy

```mermaid
flowchart LR
    A[Parse session JSONL] --> B{Session ID<br/>already in DB?}
    B -->|no| C[Insert session,<br/>main agent, events,<br/>token_usage]
    B -->|yes| D{Any new fields,<br/>tools, compactions,<br/>turn durations?}
    D -->|no| E[skipped = true]
    D -->|yes| F[Backfill: insert<br/>missing events +<br/>enrich metadata]
    F --> G[backfilled = true]

    C --> H[replaceTokenUsage]
    F --> H
    H --> I{New input_tokens<br/>< existing?}
    I -->|yes<br/>compaction occurred| J[Move existing into<br/>baseline_* columns<br/>add new on top]
    I -->|no| K[Overwrite with new totals]

    style J fill:#10b981,stroke:#34d399,color:#fff
    style E fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style G fill:#f59e0b,stroke:#fbbf24,color:#000
```

The `baseline_*` columns are why cost is **monotonic** with respect to
re-imports: the cost endpoint sums `input_tokens + baseline_input` (and
the matching `output`, `cache_read`, `cache_write` pairs) from the
`token_usage` table, so compacted sessions retain their pre-compaction
usage for billing purposes.

### Supported source layouts

| Layout                                          | Example                                      | Handling                                                                |
| ----------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| Default Claude Code                             | `<proj>/<sid>.jsonl`                         | Session transcript                                                      |
| Default subagent                                | `<proj>/<sid>/subagents/agent-*.jsonl`       | Paired with parent on discovery                                         |
| Alternative subagent                            | `<proj>/subagents/<sid>/agent-*.jsonl`       | Paired with parent on discovery                                         |
| Orphan subagent (no parent JSONL in source)     | `<proj>/subagents/<sid>/agent-*.jsonl`       | `importFromDirectory` probes both candidates; attaches if `sid` exists  |
| Flat JSONL drop                                 | `<root>/<sid>.jsonl`                         | Recognized as a loose session                                           |
| Archives (`.zip`, `.tar`, `.tar.gz`, `.tgz`)    | any of the above nested inside               | Extracted into a per-request temp dir, then walked by the same importer |
| Single-file gzip                                | `any.jsonl.gz`                               | Gunzipped in streaming mode with size cap                               |

### Safety model

| Threat                                      | Mitigation                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Path traversal via archive entries          | `archive.safeJoin` resolves under the extraction root; any `..` or absolute path returns `null`      |
| Zip / tar / gzip bombs                      | `MAX_EXTRACT_BYTES` (default 4 GB) enforced by running byte counter; aborts with `ExtractionLimitError` |
| Per-file upload size abuse                  | multer `limits.fileSize = MAX_UPLOAD_BYTES` (default 1 GB)                                           |
| Too many files per request                  | multer `limits.files = MAX_UPLOAD_FILES` (default 2000)                                              |
| Unsupported file types                      | `fileFilter` drops them early and reports them in `rejected_files[]`                                 |
| Concurrent upload temp-dir collisions       | Per-request temp dir on `req._ccamUploadDir`; created in multer `destination`, cleaned in `finally`  |
| Arbitrary absolute path on `scan-path`      | Validated: must be absolute (after `~` expansion), exist, and be a directory                         |
| Relative / traversal paths on `scan-path`   | Rejected with `INVALID_INPUT`                                                                        |

### Environment variables

| Variable                          | Default     | Purpose                                                           |
| --------------------------------- | ----------- | ----------------------------------------------------------------- |
| `CCAM_IMPORT_MAX_BYTES`           | 1 GB        | Maximum size per uploaded file                                    |
| `CCAM_IMPORT_MAX_FILES`           | 2000        | Maximum files per upload request                                  |
| `CCAM_IMPORT_MAX_EXTRACT_BYTES`   | 4 GB        | Ceiling on total uncompressed bytes from any single archive       |

### WebSocket progress events

Every import emits `import.progress` messages on `/ws`. Messages are
throttled to at most one every ~150 ms to avoid flooding the channel on
multi-thousand-session imports; the terminal `complete` and `error` frames
are never throttled.

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
`complete`, with `error` / `extract_error` replacing `complete` on failure.

---

## Agent Extension Layer

The repository includes a triple extension strategy:

- Claude Code-native extensions (`CLAUDE.md`, `.claude/rules`, `.claude/skills`)
- Codex-native extensions (`AGENTS.md`, `.codex/rules`, `.codex/agents`, `.codex/skills`)
- Plugin marketplace (`plugins/`, `.claude-plugin/marketplace.json`) — 5 plugins with 18 skills, 4 agents, 3 CLI tools
- Codex-native extensions (`AGENTS.md`, `.codex/rules`, `.codex/agents`, `.codex/skills`)

```mermaid
graph TD
    USER["Developer"] --> CLAUDE["Claude Code"]
    USER --> CODEX["Codex"]

    CLAUDE --> C_MEM["CLAUDE.md"]
    CLAUDE --> C_RULES[".claude/rules/*"]
    CLAUDE --> C_SKILLS[".claude/skills/*"]
    CLAUDE --> C_PLUGINS["plugins/<br/>5 plugins, 18 skills"]

    CODEX --> X_MEM["AGENTS.md"]
    CODEX --> X_RULES[".codex/rules/*.rules"]
    CODEX --> X_AGENTS[".codex/agents/*.toml"]
    CODEX --> X_SKILLS[".codex/skills/*"]

    style C_PLUGINS fill:#8b5cf6,stroke:#a78bfa,color:#fff
```

### Claude Code extension scope

- `CLAUDE.md` defines always-on project working agreements.
- `.claude/rules/` adds path-scoped guidance by file area.
- `.claude/skills/` provides reusable workflows:
  - onboarding
  - feature shipping
  - MCP operations
  - live issue debugging
- `.claude/agents/` provides specialized review workers:
  - backend reviewer
  - frontend reviewer
  - MCP reviewer
- `plugins/` provides distributable plugin marketplace (see [Plugin Marketplace](#plugin-marketplace)):
  - ccam-analytics (session reports, cost analysis, usage trends, productivity scoring)
  - ccam-productivity (standups, weekly reports, sprint summaries, workflow optimization)
  - ccam-devtools (session debugging, hook diagnostics, data export, health checks)
  - ccam-insights (pattern detection, anomaly alerting, optimization, session comparison)
  - ccam-dashboard (status checks, quick stats, MCP integration)

### Codex extension scope

- `AGENTS.md` provides project-wide default behavior.
- `.codex/rules/default.rules` controls external execution decisions.
- `.codex/agents/` provides custom subagent templates.
- `.codex/skills/` provides reusable task workflows.

---

## Plugin Marketplace

The repository includes an official Claude Code plugin marketplace with five production-ready plugins. These extend Claude Code itself (not just the dashboard) with skills, agents, hooks, CLI tools, and MCP integration — all deeply grounded in the actual dashboard data model.

### Marketplace Architecture

```mermaid
graph TD
    subgraph Marketplace[".claude-plugin/marketplace.json"]
        M["Marketplace Manifest"]
    end

    subgraph Plugins["plugins/"]
        A["ccam-analytics<br/>4 skills, 1 agent, 1 CLI"]
        P["ccam-productivity<br/>4 skills, 1 agent"]
        D["ccam-devtools<br/>4 skills, 1 agent, 2 CLIs"]
        I["ccam-insights<br/>4 skills, 1 agent"]
        C["ccam-dashboard<br/>2 skills, MCP config"]
    end

    subgraph API["Dashboard API (port 4820)"]
        STATS["/api/stats"]
        ANALYTICS["/api/analytics"]
        PRICING["/api/pricing/cost"]
        WORKFLOWS["/api/workflows/session/:id"]
        SESSIONS["/api/sessions"]
    end

    M --> A & P & D & I & C
    A & P & I --> ANALYTICS & PRICING & WORKFLOWS
    D --> STATS & SESSIONS
    C --> STATS & ANALYTICS

    style M fill:#6366f1,stroke:#818cf8,color:#fff
    style A fill:#10b981,stroke:#34d399,color:#fff
    style P fill:#f59e0b,stroke:#fbbf24,color:#000
    style D fill:#ef4444,stroke:#f87171,color:#fff
    style I fill:#8b5cf6,stroke:#a78bfa,color:#fff
    style C fill:#06b6d4,stroke:#22d3ee,color:#000
```

### Plugin Structure

Each plugin follows the official Claude Code plugin specification:

```
plugins/ccam-{name}/
├── .claude-plugin/
│   └── plugin.json              # Manifest: name, version, description, author
├── skills/
│   └── {skill-name}/
│       └── SKILL.md             # Skill definition with $ARGUMENTS placeholder
├── agents/
│   └── {agent-name}.md          # Agent: model, tools, instructions
├── hooks/
│   └── hooks.json               # Event hooks (fail-safe, non-blocking)
├── bin/
│   └── {cli-tool}               # Executable scripts (added to PATH)
├── .mcp.json                    # MCP server configuration (optional)
└── settings.json                # Plugin settings (optional)
```

Skills are namespaced: `/ccam-analytics:session-report`, `/ccam-productivity:daily-standup`, etc.

### Plugin Catalog

| Plugin | Skills | Agent | CLI Tools | Hooks |
|--------|--------|-------|-----------|-------|
| **ccam-analytics** | `session-report`, `cost-breakdown`, `usage-trends`, `productivity-score` | `analytics-advisor` | `ccam-stats` | Stop, SubagentStop |
| **ccam-productivity** | `daily-standup`, `weekly-report`, `sprint-summary`, `workflow-optimizer` | `productivity-coach` | — | SessionStart, SessionEnd |
| **ccam-devtools** | `session-debug`, `hook-diagnostics`, `data-export`, `health-check` | `issue-triager` | `ccam-doctor`, `ccam-export` | — |
| **ccam-insights** | `pattern-detect`, `anomaly-alert`, `optimization-suggest`, `session-compare` | `insights-advisor` | — | — |
| **ccam-dashboard** | `dashboard-status`, `quick-stats` | — | — | — |

**Totals**: 18 skills, 4 agents, 3 CLI tools, 2 hook configurations, 1 MCP config.

### Data Model Grounding

Every skill and agent references the actual dashboard API response shapes:

| Data Source | Key Fields Used by Plugins |
|-------------|---------------------------|
| Token tracking | `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` + 4 `baseline_*` columns (preserve pre-compaction data) |
| Cost engine | `(tokens / 1M) × rate_per_mtok` for each type; longest `model_pattern` match wins; pre-seeded Opus/Sonnet/Haiku rates |
| Session metadata | `thinking_blocks`, `turn_count`, `total_turn_duration_ms`, `usage_extras` (`{ service_tiers[], speeds[], inference_geos[] }`) |
| Event types | `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd`, `Notification`, `Compaction`, `APIError`, `TurnDuration` |
| Workflow intelligence | 11 datasets per session: `stats`, `orchestration` (DAG), `toolFlow` (transitions), `effectiveness`, `patterns`, `modelDelegation`, `errorPropagation` (by depth), `concurrency` (lanes), `complexity` (score), `compaction` (impact), `cooccurrence` (agent pairs) |
| Agent hierarchy | Recursive CTE with `parent_agent_id`, `subagent_type`, depth tracking |

### Key Derived Metrics

Plugins compute these from raw API data:

- **Cache efficiency**: `cache_read / (cache_read + input)` — trending up = improving prompt reuse
- **Compaction pressure**: `sum(baseline_*) / sum(effective_tokens)` — high = frequent context overflow
- **Tool success rate**: `PostToolUse count / PreToolUse count` — should be ~1.0; gap = tool failures
- **Turn velocity**: `turn_count / (total_turn_duration_ms / 1000)` — turns per second
- **Cost per completed session**: `total_cost / completed_sessions`

### Installation

```bash
# Marketplace install
claude plugin marketplace add hoangsonww/Claude-Code-Agent-Monitor
claude plugin install ccam-analytics@hoangsonww-claude-code-agent-monitor

# Local development testing
claude --plugin-dir plugins/ccam-analytics
```

Full documentation: [`docs/plugins.md`](docs/PLUGINS.md)

---

## MCP Integration

The repository includes an enterprise-grade local MCP server in `mcp/` that exposes dashboard functionality as tools for MCP hosts such as Claude Code and Claude Desktop. It supports three transport modes: stdio (for MCP host child-process integration), HTTP+SSE (for remote/networked clients), and an interactive REPL (for operator debugging).

### MCP Transport Selection

```mermaid
flowchart TD
    START["MCP Server Start"] --> ARG{"CLI arg or env?"}
    ARG -->|"--transport=stdio\nor default"| STDIO["stdio transport\nJSON-RPC over stdin/stdout"]
    ARG -->|"--transport=http\nor --http"| HTTP["HTTP + SSE transport\nExpress on :8819"]
    ARG -->|"--transport=repl\nor --repl"| REPL["Interactive REPL\nreadline with tab completion"]

    STDIO --> HOST["MCP Host\n(Claude Code / Desktop)"]
    HTTP --> ENDPOINTS["Endpoints:\n/mcp (Streamable HTTP)\n/sse (Legacy SSE)\n/messages (Legacy POST)\n/health (status)"]
    REPL --> CLI["Operator Terminal\ncolored output, JSON highlighting\ntool invocation, domain browsing"]

    style STDIO fill:#6366f1,stroke:#818cf8,color:#fff
    style HTTP fill:#f59e0b,stroke:#fbbf24,color:#000
    style REPL fill:#a855f7,stroke:#c084fc,color:#fff
```

### MCP Runtime Topology

```mermaid
graph LR
    HOST["MCP Host<br/>(Claude Code / Claude Desktop)"]
    HTTP_CLIENT["Remote MCP Client"]
    OPERATOR["Operator CLI"]

    MCP_STDIO["MCP Server<br/>stdio"]
    MCP_HTTP["MCP Server<br/>HTTP+SSE :8819"]
    MCP_REPL["MCP Server<br/>REPL"]

    API["Dashboard API<br/>http://127.0.0.1:4820/api/*"]
    DB["SQLite"]

    HOST -->|"stdin/stdout"| MCP_STDIO
    HTTP_CLIENT -->|"POST /mcp · GET /sse"| MCP_HTTP
    OPERATOR -->|"interactive CLI"| MCP_REPL

    MCP_STDIO -->|"validated HTTP"| API
    MCP_HTTP -->|"validated HTTP"| API
    MCP_REPL -->|"validated HTTP"| API
    API --> DB

    style HOST fill:#6366f1,stroke:#818cf8,color:#fff
    style HTTP_CLIENT fill:#f59e0b,stroke:#fbbf24,color:#000
    style OPERATOR fill:#a855f7,stroke:#c084fc,color:#fff
    style MCP_STDIO fill:#0f766e,stroke:#14b8a6,color:#fff
    style MCP_HTTP fill:#0f766e,stroke:#14b8a6,color:#fff
    style MCP_REPL fill:#0f766e,stroke:#14b8a6,color:#fff
    style API fill:#339933,stroke:#5cb85c,color:#fff
    style DB fill:#003B57,stroke:#005f8a,color:#fff
```

### MCP Module Architecture

```mermaid
graph TD
    ENTRY["src/index.ts<br/>(transport router)"]
    SERVER["src/server.ts"]
    CONFIG["config/app-config.ts"]
    CLIENT["clients/dashboard-api-client.ts"]
    CORE["core/*<br/>logger, tool-registry, tool-result"]
    POLICY["policy/tool-guards.ts"]
    TOOLS["tools/index.ts"]
    DOMAINS["tools/domains/*<br/>observability, sessions, agents,<br/>events, pricing, maintenance"]

    T_HTTP["transports/http-server.ts<br/>Express SSE + Streamable HTTP"]
    T_REPL["transports/repl.ts<br/>readline + tab completion"]
    T_COLL["transports/tool-collector.ts<br/>handler collection for REPL"]
    UI["ui/*<br/>banner, colors, formatter"]

    ENTRY --> CONFIG
    ENTRY --> SERVER
    ENTRY --> T_HTTP
    ENTRY --> T_REPL
    ENTRY --> T_COLL
    SERVER --> TOOLS
    TOOLS --> DOMAINS
    DOMAINS --> CLIENT
    DOMAINS --> POLICY
    DOMAINS --> CORE
    T_HTTP --> UI
    T_REPL --> UI
```

### MCP Safety Model

- API target is restricted to loopback hosts only (`127.0.0.1`, `localhost`, `::1`)
- Tool inputs are schema-validated with zod before execution
- Mutating tools require `MCP_DASHBOARD_ALLOW_MUTATIONS=true`
- Destructive tools additionally require `MCP_DASHBOARD_ALLOW_DESTRUCTIVE=true` and explicit confirmation token
- Logging is written to `stderr` only so stdio protocol traffic is never corrupted

### MCP Tool Domains

- Observability: health/stats/analytics/system/export/snapshot
- Sessions: list/get/create/update
- Agents: list/get/create/update
- Events: list + hook event ingestion
- Pricing: rule CRUD + total/per-session cost
- Maintenance: cleanup/reimport/reinstall-hooks/clear-data (guarded)

---

## State Management

### Client-Side Architecture

The client uses a deliberately simple state management approach:

```mermaid
graph TD
    subgraph "Data Sources"
        REST["REST API<br/>(initial load + refresh)"]
        WSM["WebSocket Messages<br/>(real-time updates)"]
        LS["localStorage<br/>(notification prefs)"]
    end

    subgraph "Distribution"
        EB["eventBus<br/>(Set-based pub/sub)"]
    end

    subgraph "App-Level Hooks"
        NOTIF_H["useNotifications<br/>reads prefs, fires<br/>browser notifications"]
    end

    subgraph "Page State"
        US1["useState<br/>Dashboard"]
        US2["useState<br/>KanbanBoard"]
        US3["useState<br/>Sessions"]
        US4["useState<br/>SessionDetail"]
        US5["useState<br/>ActivityFeed"]
        US6["useState<br/>Analytics"]
        US8["useState<br/>Workflows"]
        US7["useState<br/>Settings"]
    end

    REST --> US1 & US2 & US3 & US4 & US5 & US6 & US8 & US7
    WSM --> EB
    EB --> US1 & US2 & US3 & US4 & US5 & US6 & US8 & US7
    EB --> NOTIF_H
    LS --> NOTIF_H
    LS --> US7
```

**Why no Redux / Zustand / Context:**

- Each page owns its data and lifecycle
- No cross-page state sharing needed (notification prefs use `localStorage` as the shared store)
- WebSocket events trigger reload or append, not complex state merging
- Simpler mental model, fewer abstraction layers, easier to debug

### Event Bus

The `eventBus` is a Set-based pub/sub with `subscribe()` returning an unsubscribe function. It also tracks WebSocket connection state, exposing `connected` (boolean getter), `setConnected(value)`, and `onConnection(handler)` so any component can subscribe to connection status changes.

```typescript
// Subscribe to messages in useEffect, unsubscribe on cleanup
useEffect(() => {
  return eventBus.subscribe((msg) => {
    if (msg.type === "agent_updated") load();
  });
}, [load]);

// Read connection state reactively (e.g. with useSyncExternalStore)
const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);
```

This pattern ensures:

- No memory leaks (cleanup on unmount)
- No stale closures (subscribe with latest callback ref)
- Only active pages receive messages
- Connection state is available to any component without prop drilling

---

## Browser Notification System

The dashboard implements a robust notification system using the Web Push API (VAPID) and Service Workers, allowing for reliable delivery even when the browser is backgrounded or closed.

### Notification Architecture

```mermaid
graph TD
    subgraph "Server Side"
        API_P["Push API<br/>(/api/push/*)"]
        WP["web-push lib<br/>(VAPID)"]
        DB_P["push_subscriptions<br/>table"]
        KEYS["vapid-keys.json<br/>(persisted)"]
    end

    subgraph "Client Side"
        SW["Service Worker<br/>(sw.js)"]
        PUSH["useNotifications hook<br/>(subscribes via SW)"]
        PREFS["localStorage<br/>(event preferences)"]
        BROWSER["Browser Push Service<br/>(FCM/Mozilla/Safari)"]
    end

    API_P --> WP
    WP -->|signed push| BROWSER
    BROWSER --> SW
    SW -->|showNotification| USER["Developer"]
    PUSH -->|subscribe| SW
    PUSH -->|POST /subscribe| API_P
    API_P --> DB_P
    WP -->|read keys| KEYS

    style SW fill:#f59e0b,stroke:#fbbf24,color:#000
    style BROWSER fill:#10b981,stroke:#34d399,color:#fff
```

### Key Components

| Component | Responsibility |
| --- | --- |
| **VAPID Pipeline** | Uses the `web-push` library on the server. VAPID keys are auto-generated on first run and persisted to `data/vapid-keys.json` to ensure subscription continuity. |
| **Service Worker** | Located at `client/public/sw.js`. It runs independently of the dashboard tab, listening for `push` events from the browser's push service. It handles `notificationclick` to focus/open the dashboard. |
| **macOS Audio Support** | Notifications are explicitly sent with `silent: false` and `sound: "default"`. This overrides macOS behavior that would otherwise suppress audio for web notifications. |
| **Subscription Management** | The dashboard registers the service worker and requests a `PushSubscription`. This subscription (endpoint and keys) is stored in the `push_subscriptions` table, indexed by endpoint. |
| **Event Routing** | When a WebSocket event (e.g., `session_created`) is broadcast, the server also triggers `sendPushToAll()`, which iterates through active subscriptions and sends signed VAPID payloads. |

### Notification Flow

```mermaid
flowchart TD
    EVENT["Server Event<br/>(e.g. SessionStart)"] --> PREFS{"User Prefs<br/>Enabled?"}
    PREFS -->|No| SKIP[Skip]
    PREFS -->|Yes| SUBS["Fetch all subscriptions<br/>from DB"]
    SUBS --> LOOP["For each subscription:"]
    LOOP --> SEND["webpush.sendNotification()"]
    SEND --> BROWSER["Browser Push Service"]
    BROWSER --> SW["Service Worker"]
    SW --> SHOW["showNotification(title, body)<br/>silent: false"]

    style SHOW fill:#10b981,stroke:#34d399,color:#fff
```

### Preference Storage

Notification preferences remain in `localStorage` (`agent-monitor-notifications`) for UI-side filtering, while the actual push delivery is managed by the server-side subscription store.

| Preference | UI Key | Logic |
| --- | --- | --- |
| Master Toggle | `enabled` | Controls whether the subscription is active |
| New Session | `onNewSession` | Filtered during push fan-out |
| Session Error | `onSessionError` | Filtered during push fan-out |
| Session Complete | `onSessionComplete` | Filtered during push fan-out |
| Subagent Spawn | `onSubagentSpawn` | Filtered during push fan-out |

---

## VS Code Extension Architecture

The **Claude Code Agent Monitor** VS Code extension provides an integrated monitoring experience directly within the editor. It communicates with the local dashboard server via standard HTTP APIs and renders the dashboard UI in a webview.

<p align="center">
  <img src="vscode-extension/vscode.png" alt="VS Code Extension Screenshot" width="100%">
</p>

### Extension Components

| Component | Responsibility |
| --- | --- |
| **Extension Host** (`extension.js`) | Manages the extension lifecycle, registers commands, creates the status bar item, and coordinates the webview panel. |
| **Sidebar Provider** (`sidebar.js`) | Implements the `TreeDataProvider` for the Activity Bar. It performs background polling of the dashboard APIs (`/api/stats`, `/api/analytics`, `/api/sessions`) every 5 seconds. |
| **Status Bar Item** | Provides a persistent "Pulse" indicator in the VS Code status bar, showing active session and agent counts. |
| **Webview Panel** | A native VS Code tab that renders the dashboard React application. It supports deep linking to specific sessions or sub-pages. |

### Data Flow

```mermaid
graph TD
    subgraph "VS Code Process"
        SB[Status Bar]
        SIDE[Sidebar TreeView]
        WV[Webview Panel]
    end

    subgraph "Extension Host"
        EH[extension.js]
        SP[sidebar.js]
    end

    subgraph "Dashboard Server (localhost)"
        API["/api/stats<br/>/api/analytics<br/>/api/sessions"]
        DS[Express Server]
    end

    SIDE -->|Poll 5s| SP
    SP -->|HTTP GET| API
    EH -->|HTTP GET| API
    SB -->|Pulse| EH
    WV -->|Iframe src| DS
```

### Key Implementation Details

1. **Auto-Detection**: The extension checks both port `5173` (Vite dev server) and `4820` (Production server) on `localhost`. It prioritizes the production port for API data but can render the UI from either.
2. **Real-time Status**: The `SidebarProvider` uses a background loop with `onDidChangeTreeData` to automatically toggle between **Online** and **Offline** states as the local server starts or stops.
3. **Deep Linking**: Commands like `claude-code-agent-monitor.openDashboard` accept arguments (e.g., a session ID or page path like `analytics`) to route the webview to specific views within the React SPA.
4. **Theme Awareness**: The Activity Bar icon (`icon.svg` or `apple-touch-icon.png`) and sidebar icons use VS Code's `ThemeIcon` and `ThemeColor` to ensure they adapt to Light, Dark, and High Contrast themes.

For the extension source code, refer to the [vscode-extension/](./vscode-extension/) directory.

> [!TIP]
> Extension on VS Code Marketplace: [Claude Code Agent Monitor](https://marketplace.visualstudio.com/items?itemName=hoangsonw.claude-code-agent-monitor)

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
| **Dependency surface** | Minimal: 5 runtime server deps, 6 runtime client deps (includes `d3` and `d3-sankey` for Workflows visualizations)                                          |

---

## Performance Characteristics

| Metric                         | Value                        | Notes                                                            |
| ------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| **Server startup**             | < 200ms                      | SQLite opens instantly; schema migration is idempotent           |
| **Hook latency**               | < 5ms (cache hit), < 50ms (miss) | TranscriptCache: stat-check only on cache hit; incremental byte-offset read on file growth; full read only on first contact or compaction |
| **Client bundle**              | 200 KB JS, 17 KB CSS         | Gzipped: ~63 KB JS, ~4 KB CSS                                    |
| **WebSocket latency**          | < 5ms                        | Local loopback, JSON serialization only                          |
| **SQLite write throughput**    | ~50,000 inserts/sec          | WAL mode on SSD; far exceeds hook event rate                     |
| **Max events before slowdown** | ~1M rows                     | SQLite handles this easily; pagination prevents full-table scans |
| **Memory usage**               | ~30 MB server, ~15 MB client | SQLite in-process, no ORM overhead. TranscriptCache adds ~1 KB per active session (LRU-capped at 200 entries) |

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
    BUILD["npm run build<br/>(vite build in client/)"] --> DIST["client/dist/<br/>Static files"]
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

### MCP Sidecar (Optional)

The MCP server runs as a sidecar alongside the dashboard, connecting to the same API. It supports three transport modes:

```mermaid
graph LR
    subgraph "MCP Transports"
        M_STDIO["stdio\nnpm run mcp:start"]
        M_HTTP["HTTP+SSE\nnpm run mcp:start:http\n:8819"]
        M_REPL["REPL\nnpm run mcp:start:repl"]
    end

    HOST["MCP Host"] -->|"stdin/stdout"| M_STDIO
    RC["Remote Client"] -->|"POST /mcp · GET /sse"| M_HTTP
    OP["Operator"] -->|"interactive CLI"| M_REPL

    M_STDIO --> API["Dashboard API<br/>:4820"]
    M_HTTP --> API
    M_REPL --> API

    style M_STDIO fill:#0f766e,stroke:#14b8a6,color:#fff
    style M_HTTP fill:#0f766e,stroke:#14b8a6,color:#fff
    style M_REPL fill:#0f766e,stroke:#14b8a6,color:#fff
```

| Command | Purpose |
| --- | --- |
| `npm run mcp:install` | Install MCP package dependencies |
| `npm run mcp:build` | Compile MCP server to `mcp/build/` |
| `npm run mcp:start` | Start MCP server (stdio, for MCP hosts) |
| `npm run mcp:start:http` | Start MCP HTTP+SSE server on port 8819 |
| `npm run mcp:start:repl` | Start interactive MCP REPL |
| `npm run mcp:dev` | Run MCP server in dev mode (stdio, `tsx`) |
| `npm run mcp:dev:http` | Run MCP HTTP server in dev mode (`tsx`) |
| `npm run mcp:dev:repl` | Run MCP REPL in dev mode (`tsx`) |
| `npm run mcp:typecheck` | Type-check MCP source |
| `npm run mcp:docker:build` | Build MCP container image with Docker |
| `npm run mcp:podman:build` | Build MCP container image with Podman |

### Container (Docker / Podman)

A multi-stage `Dockerfile` builds the client and server into a single production image. Both Docker and Podman are fully supported — the image is OCI-compliant.

```mermaid
graph LR
    subgraph "Multi-Stage Build"
        S1["Stage 1: server-deps\nnode:22-alpine\nnpm ci --omit=dev"]
        S2["Stage 2: client-build\nnode:22-alpine\nnpm ci + vite build"]
        S3["Stage 3: runtime\nnode:22-alpine\nCopies node_modules + client/dist"]
        S1 --> S3
        S2 --> S3
    end

    subgraph "Container Runtime"
        VOL1["~/.claude (ro)\nlegacy session import"]
        VOL2["agent-monitor-data\nSQLite persistence"]
        S3 -->|"EXPOSE 4820"| SRV["node server/index.js\nport 4820"]
        VOL1 --> SRV
        VOL2 --> SRV
    end

    style S3 fill:#339933,stroke:#5cb85c,color:#fff
    style SRV fill:#6366f1,stroke:#818cf8,color:#fff
```

**Usage:**

```bash
# Docker Compose
docker compose up -d --build

# Podman Compose
CLAUDE_HOME="$HOME/.claude" podman compose up -d --build

# Plain Docker / Podman (equivalent)
docker build -t agent-monitor .
docker run -d -p 4820:4820 \
  -v "$HOME/.claude:/root/.claude:ro" \
  -v agent-monitor-data:/app/data \
  agent-monitor
```

> [!NOTE]
> **Hook note:** Claude Code hooks run on the host, not inside the container. The containerized server still receives hook events via HTTP on `localhost:4820` — run `npm run install-hooks` on the host after the container is up.

### Cloud Deployment

For production cloud deployments, the `deployments/` directory provides enterprise-grade infrastructure supporting four cloud providers and multiple deployment strategies.

```mermaid
graph TB
  subgraph "Deployment Pipeline"
    direction LR
    CI["CI Pipeline<br/>Build · Test · Scan"] --> DEPLOY["Deployment<br/>Helm · Kustomize · Terraform"]
    DEPLOY --> VERIFY["Verification<br/>Health Check · Smoke Tests"]
    VERIFY -->|Fail| ROLLBACK["Rollback<br/>Instant Revert"]
  end

  subgraph "Infrastructure"
    direction TB
    subgraph "Compute"
      BLUE["Blue Slot<br/>Current Version"]
      GREEN["Green Slot<br/>New Version"]
    end
    LB["Load Balancer<br/>TLS 1.3 · WebSocket<br/>Weighted Routing"]
    PV["Persistent Storage<br/>Encrypted NFS"]
    MON["Monitoring<br/>Prometheus · Grafana<br/>13 Alert Rules"]
    OTEL["OTel Collector<br/>Coralogix"]
  end

  LB -->|"Active"| BLUE
  LB -.->|"Standby"| GREEN
  BLUE & GREEN --> PV
  MON -->|"Scrape"| BLUE & GREEN
  BLUE & GREEN -->|"logs + metrics + traces"| OTEL

  style BLUE fill:#2563eb,color:#fff
  style GREEN fill:#16a34a,color:#fff
  style LB fill:#7c3aed,color:#fff
  style CI fill:#2088ff,color:#fff
  style OTEL fill:#4f46e5,color:#fff
```

| Capability | Details |
| --- | --- |
| **Cloud Providers** | AWS (ECS Fargate + ALB), GCP (Cloud Run + GCLB), Azure (ACI + App Gateway), OCI (OKE + LBaaS) |
| **Deployment Methods** | Helm chart, Kustomize overlays, Terraform modules |
| **Release Strategies** | Rolling update, blue-green (instant switchover), canary (automated analysis) |
| **Environments** | Dev, staging, production with per-environment configuration |
| **CI/CD** | GitHub Actions and GitLab CI pipelines with Trivy security scanning |
| **Observability** | Prometheus scraping, 13 alert rules, Grafana dashboard (16 panels), Alertmanager routing, Coralogix full-stack observability (logs, metrics, traces, SLO tracking) via OpenTelemetry Collector |
| **Operations** | Scripts for deploy, rollback, blue-green switch, database backup/restore, teardown |
| **Security** | Restricted PSS, network policies, TLS enforcement, OIDC auth, no long-lived credentials |

> [!NOTE]
> 📘 **Full guide:** See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step deployment instructions, and [deployments/README.md](deployments/README.md) for the infrastructure technical reference.

---

## Statusline Utility

The `statusline/` directory contains a standalone CLI statusline for Claude Code, separate from the web dashboard. It renders a color-coded bar at the bottom of the Claude Code terminal showing model, user, working directory, git branch, context window usage, per-direction token counts, and session cost in USD.

### Data Flow

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant SH as statusline-command.sh
    participant PY as statusline.py
    participant GIT as git CLI

    CC->>SH: stdin (JSON payload)
    SH->>PY: Pipes stdin through
    PY->>PY: Parse JSON (model, cwd, context_window, cost)
    PY->>GIT: git symbolic-ref --short HEAD
    GIT-->>PY: Branch name
    PY->>PY: Build ANSI-colored segments (incl. tokens by direction, cost)
    PY-->>CC: stdout (formatted statusline)
```

### Segments

| Segment      | Source                                | Color Logic                                                                          |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------------ |
| Model        | `data.model.display_name`             | Always cyan                                                                          |
| User         | `$USERNAME` / `$USER` env var         | Always green                                                                         |
| Working Dir  | `data.workspace.current_dir`          | Always yellow, `~` prefix for home                                                   |
| Git Branch   | `git symbolic-ref --short HEAD`       | Always magenta, hidden outside git repos                                             |
| Context Bar  | `data.context_window.used_percentage` | Green < 50%, Yellow 50–79%, Red >= 80%                                               |
| Token Counts | `data.context_window.current_usage`   | Green `↑` input, cyan `↓` output, dim `c` cache reads                                |
| Session Cost | `data.cost.total_cost_usd`            | Green < $5, Yellow $5–$20, Red >= $20 (shown on API and subscription plans)          |

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
| **SQLite** (via `better-sqlite3` or built-in `node:sqlite`) | Zero-config, embedded, no server process. WAL mode gives concurrent reads. Synchronous API is simpler than async alternatives for this use case. Falls back to Node.js built-in `node:sqlite` when `better-sqlite3` cannot be compiled |
| **Express**                     | Battle-tested, minimal, well-understood. Overkill would be Fastify for this scale; underkill would be raw `http` module                         |
| **ws**                          | Fastest, most lightweight WebSocket library for Node. No Socket.IO overhead needed since we only push JSON messages                             |
| **React 18**                    | Stable, widely known, strong TypeScript support. No need for Server Components or RSC given this is a client-rendered SPA                       |
| **Vite**                        | Fast builds, native ESM, excellent dev experience. Proxy config handles the dev server split cleanly                                            |
| **Tailwind CSS**                | Utility-first approach keeps styles colocated with markup. No CSS module boilerplate. Custom theme config for the dark UI                       |
| **React Router 6**              | Standard routing for React SPAs. Layout routes with `<Outlet>` give clean shell composition                                                     |
| **Lucide React**                | Tree-shakeable icon library. Only imports what's used (~20 icons)                                                                               |
| **TypeScript Strict**           | Catches null/undefined bugs at compile time. `noUncheckedIndexedAccess` prevents array bounds issues                                            |

---

## Build & Run Targets

A root `Makefile` mirrors every npm script for developers who prefer `make`. Run `make help` for the full list.

```
make setup          Install all dependencies (root + client + MCP)
make dev            Start server + client in watch mode
make build          Build the React client for production
make start          Start the production server
make test           Run all tests (server + client)
make format         Format all files with Prettier
make mcp-build      Compile MCP TypeScript → JavaScript
make mcp-typecheck  Type-check MCP source without emitting
make docker-up      Start via docker-compose
make docker-down    Stop docker-compose stack
```

See `Makefile` for the complete set of 30 targets covering setup, dev, testing, formatting, MCP, data management, Codex extensions, and Docker/Podman workflows.
