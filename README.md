# Agent Dashboard

### Real-time monitoring platform for Claude Code agent activity

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-RFC_6455-010101?style=flat-square&logo=socketdotio&logoColor=white)
![Python](https://img.shields.io/badge/Python-%3E%3D3.6-3776AB?style=flat-square&logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

Track sessions, monitor agents in real-time, visualize tool usage, and observe subagent orchestration through a professional dark-themed web interface. Integrates directly with Claude Code via its native hook system.

```mermaid
graph LR
    A["Claude Code<br/>Session"] -->|hooks fire on<br/>tool use / stop| B["Hook Handler<br/>(Node.js script)"]
    B -->|HTTP POST| C["Dashboard Server<br/>(Express + SQLite)"]
    C -->|WebSocket<br/>broadcast| D["Dashboard UI<br/>(React + Tailwind)"]
    style A fill:#6366f1,stroke:#818cf8,color:#fff
    style B fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style C fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
    style D fill:#10b981,stroke:#34d399,color:#fff
```

<p align="center">
  <img src="images/dashboard.png" alt="Dashboard Overview" width="100%">
</p>

<p align="center">
  <img src="images/board.png" alt="Board Overview" width="100%">
</p>

<p align="center">
  <img src="images/sessions.png" alt="Sessions Overview" width="100%">
</p>

<p align="center">
  <img src="images/session.png" alt="Session Detail Overview" width="100%">
</p>

<p align="center">
  <img src="images/feed.png" alt="Activity Feed Overview" width="100%">
</p>

<p align="center">
  <img src="images/analytics.png" alt="Analytics Overview" width="100%">
</p>

<p align="center">
  <img src="images/settings.png" alt="Settings Overview" width="100%">
</p>

---

## Features

| Feature               | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **Dashboard**         | Overview stats, active agent cards, recent activity feed                     |
| **Kanban Board**      | 5-column agent status board with paginated columns (10 per page)             |
| **Sessions**          | Searchable, filterable, paginated table of all Claude Code sessions          |
| **Session Detail**    | Per-session agent cards and full event timeline                              |
| **Activity Feed**     | Real-time streaming event log with pause/resume and pagination               |
| **Analytics**         | Token usage, tool frequency, activity heatmap, session trends                |
| **Live Updates**      | WebSocket push -- no polling, instant UI updates                             |
| **Auto-Discovery**    | Sessions and agents are created automatically from hook events               |
| **History Import**    | Automatically imports legacy sessions from `~/.claude/` on server startup    |
| **Background Agents** | Correctly tracks backgrounded subagents without premature completion         |
| **Cost Tracking**     | Per-model cost estimation with configurable pricing rules and per-session breakdowns |
| **Settings**          | System info, hook status, model pricing management, data export, session cleanup |
| **Responsive Design** | Mobile-friendly layouts with stacking grids, scrollable tables, and collapsible sidebar |
| **Seed Data**         | Built-in seed script for demos and development                               |
| **Statusline**        | Color-coded CLI statusline showing model, context usage, git branch, tokens  |

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### 1. Install

```bash
git clone https://github.com/hoangsonww/Claude-Code-Agent-Monitor.git
cd Claude-Code-Agent-Monitor
npm run setup
```

### 2. Configure Claude Code Hooks

```bash
npm run install-hooks
```

This adds hook entries to `~/.claude/settings.json` that forward events to the dashboard. Existing hooks are preserved.

### 3. Start

```bash
# Development (hot reload on both server and client)
npm run dev

# Production (single process, built client)
npm run build && npm start
```

### 4. Open

| Mode        | URL                     |
| ----------- | ----------------------- |
| Development | `http://localhost:5173` |
| Production  | `http://localhost:4820` |

### Optional: Seed Demo Data

```bash
npm run seed
```

Creates 8 sample sessions, 23 agents, and 106 events so you can explore the UI immediately.

---

## How It Works

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant HH as Hook Handler
    participant API as Express Server
    participant DB as SQLite
    participant WS as WebSocket
    participant UI as React Client

    CC->>HH: stdin (JSON event)
    HH->>API: POST /api/hooks/event
    API->>DB: Insert/update records
    API->>WS: Broadcast update
    WS->>UI: Push message
    UI->>UI: Re-render component

    Note over CC,HH: Hooks fire on PreToolUse,<br/>PostToolUse, Stop,<br/>SubagentStop, Notification
    Note over API,DB: Transactional writes<br/>with auto session/agent creation
    Note over WS,UI: ~0ms latency,<br/>no polling
```

### Hook Lifecycle

1. **Claude Code** fires a hook when a tool is used, a session ends, or a subagent completes
2. **Hook Handler** (`scripts/hook-handler.js`) reads the JSON event from stdin and POSTs it to the API. Fails silently with a 5s timeout so it never blocks Claude Code
3. **Server** processes the event inside a SQLite transaction:
   - Auto-creates sessions and main agents on first contact
   - Detects `Agent` tool calls to track subagent creation
   - Sets agent to "working" on `PreToolUse`, keeps it working through `PostToolUse`
   - Preserves running background subagents on `Stop` (main agent goes "idle")
   - Marks subagents completed individually via `SubagentStop`
   - Auto-completes session when the last subagent finishes
4. **WebSocket** broadcasts the change to all connected clients
5. **UI** receives the update and re-renders the affected components

### Agent State Machine

```mermaid
stateDiagram-v2
    [*] --> connected: Agent created
    connected --> working: PreToolUse
    working --> working: PreToolUse (different tool)
    working --> idle: Stop (subagents still running)
    working --> completed: Stop (no subagents)
    idle --> idle: Tool events from subagents
    idle --> completed: Last SubagentStop
    working --> error: Error occurred
    completed --> [*]
    error --> [*]
```

### Session State Machine

```mermaid
stateDiagram-v2
    [*] --> active: First hook event received
    active --> active: Stop (subagents still running)
    active --> completed: Stop (no subagents) / last SubagentStop
    active --> error: Stop hook (error)
    active --> abandoned: No activity timeout
    completed --> [*]
    error --> [*]
    abandoned --> [*]
```

### Cost Calculation Flow

```mermaid
flowchart LR
    TU["token_usage rows<br/>(per session × model)"] --> GROUP["Group by model"]
    PR["model_pricing rules<br/>(pattern-based)"] --> SORT["Sort by specificity<br/>(longest pattern first)"]
    GROUP --> MATCH{"Match model<br/>to pricing rule"}
    SORT --> MATCH
    MATCH --> CALC["cost = Σ (tokens / 1M) × rate<br/>for input, output, cache_read, cache_write"]
    CALC --> RESULT["{ total_cost, breakdown[] }"]
    style TU fill:#003B57,stroke:#005f8a,color:#fff
    style PR fill:#6366f1,stroke:#818cf8,color:#fff
    style RESULT fill:#10b981,stroke:#34d399,color:#fff
```

---

## Configuration

| Environment Variable    | Default       | Description                                   |
| ----------------------- | ------------- | --------------------------------------------- |
| `DASHBOARD_PORT`        | `4820`        | Port for the Express server                   |
| `CLAUDE_DASHBOARD_PORT` | `4820`        | Port used by hook handler to reach the server |
| `NODE_ENV`              | `development` | Set to `production` to serve the built client |

---

## npm Scripts

| Command                 | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `npm run setup`         | Install server and client dependencies                     |
| `npm run dev`           | Start server (watch mode) + client (Vite HMR) concurrently |
| `npm run dev:server`    | Start only the Express server with `--watch`               |
| `npm run dev:client`    | Start only the Vite dev server                             |
| `npm run build`         | TypeScript check + Vite production build                   |
| `npm start`             | Start production server (serves built client)              |
| `npm run install-hooks` | Configure Claude Code hooks in `~/.claude/settings.json`   |
| `npm run seed`          | Populate database with sample data                         |
| `npm run import-history`| Import legacy sessions from `~/.claude/` (also runs on startup) |
| `npm run clear-data`    | Delete all sessions, agents, events, and token usage            |

---

## API Reference

All endpoints return JSON. Error responses follow the shape `{ error: { code, message } }`.

### Health

| Method | Path          | Description                           |
| ------ | ------------- | ------------------------------------- |
| `GET`  | `/api/health` | Returns `{ status: "ok", timestamp }` |

### Sessions

| Method  | Path                | Query Params                | Description                           |
| ------- | ------------------- | --------------------------- | ------------------------------------- |
| `GET`   | `/api/sessions`     | `status`, `limit`, `offset` | List sessions with agent counts       |
| `GET`   | `/api/sessions/:id` | --                          | Session detail with agents and events |
| `POST`  | `/api/sessions`     | --                          | Create session (idempotent on `id`)   |
| `PATCH` | `/api/sessions/:id` | --                          | Update session status/metadata        |

### Agents

| Method  | Path              | Query Params                              | Description                   |
| ------- | ----------------- | ----------------------------------------- | ----------------------------- |
| `GET`   | `/api/agents`     | `status`, `session_id`, `limit`, `offset` | List agents with filters      |
| `GET`   | `/api/agents/:id` | --                                        | Single agent detail           |
| `POST`  | `/api/agents`     | --                                        | Create agent                  |
| `PATCH` | `/api/agents/:id` | --                                        | Update agent status/task/tool |

### Events

| Method | Path          | Query Params                    | Description                |
| ------ | ------------- | ------------------------------- | -------------------------- |
| `GET`  | `/api/events` | `session_id`, `limit`, `offset` | List events (newest first) |

### Stats

| Method | Path         | Description                                            |
| ------ | ------------ | ------------------------------------------------------ |
| `GET`  | `/api/stats` | Aggregate counts, status distributions, WS connections |

### Hooks

| Method | Path               | Description                                  |
| ------ | ------------------ | -------------------------------------------- |
| `POST` | `/api/hooks/event` | Receive and process a Claude Code hook event |

**Hook event payload:**

```json
{
  "hook_type": "PreToolUse",
  "data": {
    "session_id": "abc-123",
    "tool_name": "Bash",
    "tool_input": { "command": "ls -la" }
  }
}
```

### Pricing

| Method   | Path                     | Description                              |
| -------- | ------------------------ | ---------------------------------------- |
| `GET`    | `/api/pricing`           | List all pricing rules                   |
| `PUT`    | `/api/pricing`           | Create or update a pricing rule          |
| `DELETE` | `/api/pricing/:pattern`  | Delete a pricing rule                    |
| `GET`    | `/api/pricing/cost`      | Total cost across all sessions           |
| `GET`    | `/api/pricing/cost/:id`  | Cost breakdown for a specific session    |

### Settings

| Method | Path                           | Description                                      |
| ------ | ------------------------------ | ------------------------------------------------ |
| `GET`  | `/api/settings/info`           | System info, DB stats, hook status               |
| `POST` | `/api/settings/clear-data`     | Delete all sessions, agents, events, token usage |
| `POST` | `/api/settings/reinstall-hooks`| Reinstall Claude Code hooks                      |
| `POST` | `/api/settings/reset-pricing`  | Reset pricing to defaults                        |
| `GET`  | `/api/settings/export`         | Export all data as JSON download                 |
| `POST` | `/api/settings/cleanup`        | Abandon stale sessions, purge old data           |

### WebSocket

Connect to `ws://localhost:4820/ws` to receive real-time push messages:

```json
{
  "type": "agent_updated",
  "data": { "id": "...", "status": "working", "current_tool": "Edit" },
  "timestamp": "2026-03-05T15:43:01.800Z"
}
```

**Message types:** `session_created`, `session_updated`, `agent_created`, `agent_updated`, `new_event`

```mermaid
stateDiagram-v2
    [*] --> Connecting: Component mounts
    Connecting --> Connected: onopen
    Connected --> Closed: onclose / onerror
    Closed --> Connecting: setTimeout(2000ms)
    Connected --> [*]: Component unmounts
    Closed --> [*]: Component unmounts
```

---

## Hook Events

The dashboard processes these Claude Code hook types:

| Hook Type      | Trigger                   | Dashboard Action                                                                             |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `PreToolUse`   | Agent starts using a tool | Sets agent to `working`, sets `current_tool`. If tool is `Agent`, creates subagent record    |
| `PostToolUse`  | Tool execution completed  | Clears `current_tool`. Agent stays `working` (no status change)                              |
| `Stop`         | Session/turn ended        | Main agent to `idle` if subagents running, else `completed`. Session stays active if subagents remain |
| `SubagentStop` | Background agent finished | Matches and completes the subagent. Auto-completes session when last subagent finishes       |
| `Notification` | Agent notification        | Logs event                                                                                   |

---

## Data Storage

- **Engine:** SQLite 3 via `better-sqlite3`
- **Location:** `data/dashboard.db`
- **Journal mode:** WAL (concurrent reads during writes)
- **Reset:** Delete `data/dashboard.db` to clear all data

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
        TEXT session_id FK
        TEXT name "Display name"
        TEXT type "main|subagent"
        TEXT status "idle|connected|working|completed|error"
        TEXT current_tool "Active tool or NULL"
    }

    events {
        INTEGER id PK "Auto-increment"
        TEXT session_id FK
        TEXT agent_id FK
        TEXT event_type "PreToolUse|PostToolUse|Stop|etc"
        TEXT tool_name "Tool that fired the event"
        TEXT created_at "ISO 8601"
    }

    token_usage {
        TEXT session_id PK "Composite PK with model"
        TEXT model PK "Model identifier"
        INTEGER input_tokens
        INTEGER output_tokens
        INTEGER cache_read_tokens
        INTEGER cache_write_tokens
    }

    model_pricing {
        TEXT model_pattern PK "SQL LIKE pattern"
        TEXT display_name "Human-readable name"
        REAL input_per_mtok "USD per M input tokens"
        REAL output_per_mtok "USD per M output tokens"
        REAL cache_read_per_mtok "USD per M cache reads"
        REAL cache_write_per_mtok "USD per M cache writes"
    }
```

---

## Statusline

A standalone CLI statusline utility for Claude Code that displays model name, user, working directory, git branch, context window usage bar, and token counts -- all color-coded with ANSI escape sequences.

```
Sonnet 4.6 | nguyens6 | ~/agent-dashboard/client | main | ████████░░ 79% | 3↑ 2↓ 156586c
```

| Segment     | Color                | Example             |
| ----------- | -------------------- | ------------------- |
| Model       | Cyan                 | `Sonnet 4.6`        |
| User        | Green                | `nguyens6`          |
| CWD         | Yellow               | `~/agent-dashboard` |
| Git branch  | Magenta              | `main`              |
| Context bar | Green / Yellow / Red | `████████░░ 79%`    |
| Tokens      | Dim                  | `3↑ 2↓ 156586c`     |

See [`statusline/README.md`](statusline/README.md) for installation instructions.

<p align="center">
  <img src="images/statusline.png" alt="Statusline Demo" width="600">
</p>

---

## Server Architecture

```mermaid
graph TD
    INDEX["server/index.js<br/>Express app + HTTP server"]
    DB["server/db.js<br/>SQLite + prepared statements"]
    WS["server/websocket.js<br/>WS server + broadcast"]
    HOOKS["routes/hooks.js<br/>Hook event processing"]
    SESSIONS["routes/sessions.js"]
    AGENTS["routes/agents.js"]
    EVENTS["routes/events.js"]
    STATS["routes/stats.js"]
    ANALYTICS["routes/analytics.js"]
    PRICING["routes/pricing.js<br/>Cost calculation"]
    SETTINGS["routes/settings.js<br/>System management"]

    INDEX --> DB & WS
    INDEX --> HOOKS & SESSIONS & AGENTS & EVENTS & STATS & ANALYTICS & PRICING & SETTINGS
    HOOKS --> DB & WS
    SESSIONS --> DB & WS
    AGENTS --> DB & WS
    EVENTS --> DB
    STATS --> DB
    ANALYTICS --> DB
    PRICING --> DB
    SETTINGS --> DB

    style INDEX fill:#6366f1,stroke:#818cf8,color:#fff
    style DB fill:#003B57,stroke:#005f8a,color:#fff
    style WS fill:#10b981,stroke:#34d399,color:#fff
```

---

## Client Routing

```mermaid
graph LR
    ROOT["/ (index)"] --> DASH["Dashboard<br/>stats + agents + events"]
    K["/kanban"] --> KANBAN["KanbanBoard<br/>5-column agent board"]
    S["/sessions"] --> SESS["Sessions<br/>filterable table"]
    D["/sessions/:id"] --> DETAIL["SessionDetail<br/>agents + timeline + cost"]
    A["/activity"] --> ACT["ActivityFeed<br/>streaming event log"]
    AN["/analytics"] --> ANALYTICS["Analytics<br/>tokens + heatmap + trends"]
    ST["/settings"] --> SETTINGS["Settings<br/>pricing + hooks + export"]

    ALL["All routes"] --> LAYOUT["Layout wrapper<br/>(Sidebar + Outlet)"]

    style ALL fill:#6366f1,stroke:#818cf8,color:#fff
    style LAYOUT fill:#1a1a28,stroke:#2a2a3d,color:#e4e4ed
```

---

## Hook Handler Flow

```mermaid
flowchart TD
    START["Claude Code fires hook"] --> STDIN["Read stdin to EOF"]
    STDIN --> PARSE{"Parse JSON?"}
    PARSE -->|Success| POST["POST to 127.0.0.1:4820<br/>/api/hooks/event"]
    PARSE -->|Failure| WRAP["Wrap raw input as JSON"]
    WRAP --> POST
    POST --> RESP{"Response?"}
    RESP -->|200 OK| EXIT0["exit(0)"]
    RESP -->|Error| EXIT0
    RESP -->|Timeout 3s| DESTROY["Destroy request"] --> EXIT0
    SAFETY["Safety net: setTimeout 5s"] --> EXIT0

    style EXIT0 fill:#10b981,stroke:#34d399,color:#fff
    style START fill:#6366f1,stroke:#818cf8,color:#fff
```

---

## Deployment Modes

```mermaid
graph LR
    subgraph dev["Development — 2 processes"]
        D_CMD["npm run dev"] --> D_SRV["Express :4820<br/>node --watch"]
        D_CMD --> D_VITE["Vite :5173<br/>HMR"]
        D_BROWSER["Browser"] --> D_VITE
        D_VITE -->|"proxy /api + /ws"| D_SRV
    end

    subgraph prod["Production — 1 process"]
        P_BUILD["npm run build"] --> P_DIST["client/dist/"]
        P_START["npm start"] --> P_SRV["Express :4820<br/>serves static + API"]
        P_BROWSER["Browser"] --> P_SRV
    end

    style D_VITE fill:#646CFF,stroke:#818cf8,color:#fff
    style D_SRV fill:#339933,stroke:#5cb85c,color:#fff
    style P_SRV fill:#339933,stroke:#5cb85c,color:#fff
    style P_DIST fill:#646CFF,stroke:#818cf8,color:#fff
```

---

## Project Structure

```
agent-dashboard/
|-- package.json                 # Root scripts + server dependencies
|-- server/
|   |-- index.js                 # Express app, HTTP server, static serving
|   |-- db.js                    # SQLite schema, migrations, prepared statements
|   |-- websocket.js             # WebSocket server with heartbeat
|   +-- routes/
|       |-- hooks.js             # Hook event processing (transactional)
|       |-- sessions.js          # Session CRUD
|       |-- agents.js            # Agent CRUD
|       |-- events.js            # Event listing
|       |-- stats.js             # Aggregate statistics
|       |-- analytics.js        # Token, tool, and trend analytics
|       |-- pricing.js            # Model pricing CRUD and cost calculation
|       +-- settings.js           # System info, data management, export, cleanup
|-- client/
|   |-- package.json             # Client dependencies
|   |-- index.html               # HTML entry point
|   |-- vite.config.ts           # Vite + proxy config
|   |-- tailwind.config.js       # Custom dark theme
|   |-- tsconfig.json            # Strict TypeScript
|   +-- src/
|       |-- main.tsx             # React entry
|       |-- App.tsx              # Router + WebSocket provider
|       |-- index.css            # Tailwind + custom utilities
|       |-- lib/
|       |   |-- types.ts         # Shared TypeScript interfaces
|       |   |-- api.ts           # Typed fetch client
|       |   |-- format.ts        # Date/time formatting utilities
|       |   +-- eventBus.ts      # Pub/sub for WebSocket distribution
|       |-- hooks/
|       |   +-- useWebSocket.ts  # Auto-reconnecting WebSocket hook
|       |-- components/
|       |   |-- Layout.tsx       # Shell with sidebar + outlet
|       |   |-- Sidebar.tsx      # Navigation + connection indicator
|       |   |-- AgentCard.tsx    # Agent info card with status
|       |   |-- StatCard.tsx     # Metric card
|       |   |-- StatusBadge.tsx  # Color-coded status pills
|       |   +-- EmptyState.tsx   # Placeholder for empty lists
|       +-- pages/
|           |-- Dashboard.tsx    # Overview page
|           |-- KanbanBoard.tsx  # Agent status columns
|           |-- Sessions.tsx     # Sessions table
|           |-- SessionDetail.tsx # Single session deep dive
|           |-- ActivityFeed.tsx # Real-time event stream
|           |-- Analytics.tsx   # Token usage, heatmap, trends
|           +-- Settings.tsx       # Model pricing, hooks, export, cleanup
|-- scripts/
|   |-- hook-handler.js          # Lightweight stdin-to-HTTP forwarder
|   |-- install-hooks.js         # Auto-configures ~/.claude/settings.json
|   |-- import-history.js        # Imports legacy sessions from ~/.claude/
|   +-- seed.js                  # Sample data generator
|-- statusline/
|   |-- README.md                # Statusline installation & usage guide
|   |-- statusline.py            # Python script that renders the statusline
|   +-- statusline-command.sh    # Shell wrapper for Claude Code's statusLine config
+-- data/
    +-- dashboard.db             # SQLite database (gitignored)
```

---

## Troubleshooting

| Problem                           | Solution                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `better-sqlite3` fails to install | Ensure you have Node.js >= 18. On Windows, you may need the [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) C++ workload |
| Hooks not firing                  | Run `npm run install-hooks` and restart Claude Code. Verify hooks exist in `~/.claude/settings.json`                                                             |
| Dashboard shows no data           | Ensure the server is running (`npm run dev`) before starting a Claude Code session. Check `http://localhost:4820/api/health`                                     |
| WebSocket disconnected            | The client auto-reconnects every 2 seconds. Check that port 4820 is not blocked by a firewall                                                                    |
| Stale data after restart          | The database persists across restarts. Run `npm run seed` for fresh demo data, or delete `data/dashboard.db` to reset                                            |

---

## License

MIT. See [LICENSE](LICENSE) for details.
