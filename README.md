# Agent Dashboard for Claude Code

### Real-time monitoring platform for Claude Code agent activity

A professional dashboard to track and visualize your Claude Code agent sessions, tool usage, and subagent orchestration in real-time. Built with Node.js, Express, React, and SQLite, it integrates directly with Claude Code via its native hook system for seamless session tracking and analytics.

![Claude Code](https://img.shields.io/badge/Claude_Code-1.0-orange?style=flat-square&logo=claude&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.21-000000?style=flat-square&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Javascript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.1-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-RFC_6455-010101?style=flat-square&logo=socketdotio&logoColor=white)
![better--sqlite3](https://img.shields.io/badge/better--sqlite3-11.7_(optional)-003B57?style=flat-square&logo=sqlite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-6.28-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide_Icons-0.474-F56565?style=flat-square&logo=lucide&logoColor=white)
![PostCSS](https://img.shields.io/badge/PostCSS-8.5-DD3A0A?style=flat-square&logo=postcss&logoColor=white)
![Autoprefixer](https://img.shields.io/badge/Autoprefixer-10.4-DD3735?style=flat-square)
![Python](https://img.shields.io/badge/Python-%3E%3D3.6-3776AB?style=flat-square&logo=python&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-20.10-2496ED?style=flat-square&logo=docker&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-1.0-646CFF?style=flat-square&logo=vitest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-automated_builds-2088FF?style=flat-square&logo=githubactions&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

---

## Table of Contents

- [Agent Dashboard for Claude Code](#agent-dashboard-for-claude-code)
    - [Real-time monitoring platform for Claude Code agent activity](#real-time-monitoring-platform-for-claude-code-agent-activity)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [User Interface](#user-interface)
  - [Features](#features)
  - [Quick Start](#quick-start)
    - [Prerequisites](#prerequisites)
    - [1. Install](#1-install)
    - [2. Configure Claude Code Hooks](#2-configure-claude-code-hooks)
    - [3. Start](#3-start)
    - [4. Open](#4-open)
    - [Optional: Seed Demo Data](#optional-seed-demo-data)
    - [Alternative: Docker / Podman](#alternative-docker--podman)
  - [How It Works](#how-it-works)
    - [Hook Lifecycle](#hook-lifecycle)
    - [Agent State Machine](#agent-state-machine)
    - [Session State Machine](#session-state-machine)
    - [Cost Calculation Flow](#cost-calculation-flow)
  - [Configuration](#configuration)
  - [npm Scripts](#npm-scripts)
  - [API Reference](#api-reference)
    - [Health](#health)
    - [Sessions](#sessions)
    - [Agents](#agents)
    - [Events](#events)
    - [Stats](#stats)
    - [Hooks](#hooks)
    - [Pricing](#pricing)
    - [Settings](#settings)
    - [WebSocket](#websocket)
  - [Hook Events](#hook-events)
  - [Browser Notifications](#browser-notifications)
    - [How It Works](#how-it-works-1)
    - [Architecture](#architecture)
  - [Data Storage](#data-storage)
    - [Entity Relationship Diagram](#entity-relationship-diagram)
  - [Statusline](#statusline)
  - [Server Architecture](#server-architecture)
  - [Client Routing](#client-routing)
  - [Hook Handler Flow](#hook-handler-flow)
  - [Deployment Modes](#deployment-modes)
  - [Project Structure](#project-structure)
  - [Troubleshooting](#troubleshooting)
  - [License](#license)

---

## Overview

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

### User Interface

Comes with a sleek dark theme, responsive design, and intuitive navigation to explore your agent activity:

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

The sidebar provides quick access to the Dashboard, Kanban Board, Sessions list, Activity Feed, Analytics, and Settings. Each page is designed to give you deep insights into your Claude Code agent activity with real-time updates and rich visualizations.

---

## Features

The dashboard offers a comprehensive set of features to monitor and analyze your Claude Code sessions and agents:

| Feature               | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| **Dashboard**         | Overview stats, active agent cards, recent activity feed                     |
| **Kanban Board**      | 5-column agent status board with paginated columns, per-status fetching (no artificial limits) |
| **Sessions**          | Searchable, filterable, paginated table of all Claude Code sessions          |
| **Session Detail**    | Per-session agent cards and full event timeline                              |
| **Activity Feed**     | Real-time streaming event log with pause/resume and pagination               |
| **Analytics**         | Token usage, tool frequency, activity heatmap, session trends, live/offline connection indicator |
| **Live Updates**      | WebSocket push -- no polling, instant UI updates                             |
| **Auto-Discovery**    | Sessions and agents are created automatically from hook events               |
| **History Import**    | Automatically imports legacy sessions from `~/.claude/` on server startup    |
| **Background Agents** | Correctly tracks backgrounded subagents without premature completion         |
| **Cost Tracking**     | Per-model cost estimation with configurable pricing rules and per-session breakdowns. Compaction-aware token accounting preserves totals across context compressions |
| **Notifications**     | Browser notifications for session starts, completions, errors, and subagent spawns. Configurable per-event toggles with permission management |
| **Settings**          | System info, hook status, model pricing management, notification preferences, data export, session cleanup |
| **Compaction Tracking** | Detects `/compact` events from JSONL transcripts, creates compaction agents and events. Backfills legacy compactions on startup. Periodic scanner catches compactions within 2 minutes even when no hooks fire |
| **Subsessions/Resumed Sessions** | Automatically reactivates sessions when new events arrive, correctly handles `/resume` and orphaned sessions. Periodic sweep (every 2 min) marks abandoned sessions that slip past event-based detection |
| **Responsive Design** | Mobile-friendly layouts with stacking grids, scrollable tables, and collapsible sidebar |
| **Seed Data**         | Built-in seed script for demos and development                               |
| **Statusline**        | Color-coded CLI statusline showing model, context usage, git branch, tokens  |

---

## Quick Start

### Prerequisites

- **Node.js** >= 18.0.0 (22+ recommended)
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

### Alternative: Docker / Podman

A `Dockerfile` and `docker-compose.yml` are included. Both Docker and Podman are supported.

**With Docker Compose:**

```bash
docker compose up -d --build
```

**With Podman Compose:**

```bash
CLAUDE_HOME="$HOME/.claude" podman compose up -d --build
```

**With plain Docker or Podman (no Compose):**

```bash
# Docker
docker build -t agent-monitor .
docker run -d --name agent-monitor \
  -p 4820:4820 \
  -v "$HOME/.claude:/root/.claude:ro" \
  -v agent-monitor-data:/app/data \
  agent-monitor

# Podman
podman build -t agent-monitor .
podman run -d --name agent-monitor \
  -p 4820:4820 \
  -v "$HOME/.claude:/root/.claude:ro" \
  -v agent-monitor-data:/app/data \
  agent-monitor
```

The dashboard is then available at `http://localhost:4820`.

**Volume mounts:**

| Mount | Purpose |
|---|---|
| `~/.claude:/root/.claude:ro` | Read legacy session history for import |
| `agent-monitor-data:/app/data` | Persist the SQLite database across restarts |

> [!IMPORTANT]
> **Note:** Claude Code hooks must still point to a running hook-handler process on the host. The container itself does not receive hooks — run `npm run install-hooks` on the host to configure hooks that POST to `http://localhost:4820`.

---

## How It Works

The dashboard integrates with Claude Code via its native hook system to provide real-time monitoring of agent activity. Here's an overview of the architecture and data flow:

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

    Note over CC,HH: Hooks fire on SessionStart,<br/>PreToolUse, PostToolUse,<br/>Stop, SubagentStop,<br/>SessionEnd, Notification.<br/>Compaction detected from JSONL
    Note over API,DB: Transactional writes<br/>with auto session/agent creation
    Note over WS,UI: ~0ms latency,<br/>no polling
```

### Hook Lifecycle

1. **Claude Code** fires a hook on session start, tool use, turn end, subagent completion, and session exit
2. **Hook Handler** (`scripts/hook-handler.js`) reads the JSON event from stdin and POSTs it to the API. Fails silently with a 5s timeout so it never blocks Claude Code
3. **Server** processes the event inside a SQLite transaction:
   - Auto-creates sessions and main agents on first contact
   - Detects `Agent` tool calls to track subagent creation
   - Sets agent to "working" on `PreToolUse`, keeps it working through `PostToolUse`
   - On `Stop` (Claude finishes responding), main agent goes to "idle" — even on non-tool turns where Claude responds without invoking any tools, ensuring timestamps and activity logs stay accurate. Background subagents continue running. Session stays `active` — the user can send more messages
   - Marks subagents completed individually via `SubagentStop`
   - On `SessionEnd` (CLI process exits), marks all agents and the session as `completed`
   - On `SessionStart`, any other active session with no activity for 5+ minutes is automatically marked "abandoned" with its agents completed. This handles `/resume` inside a session, Ctrl+C, and other scenarios where a session is orphaned without a clean `SessionEnd`
   - Reactivates completed/error/abandoned sessions when new work events arrive (session resumed)
   - Detects conversation compaction (`isCompactSummary` entries in the JSONL transcript) and creates `Compaction` agents + events. Token baselines are preserved across compactions so no usage is lost
   - A periodic server sweep (every 2 min) catches abandoned sessions and new compactions that slipped past event-based detection (e.g., `/compact` fires no hook, `/resume` within seconds of session creation)
4. **WebSocket** broadcasts the change to all connected clients
5. **UI** receives the update and re-renders the affected components

### Agent State Machine

```mermaid
stateDiagram-v2
    [*] --> connected: Agent created
    connected --> working: PreToolUse
    working --> working: PreToolUse (different tool)
    working --> idle: Stop (turn ended)
    idle --> working: PreToolUse (next turn)
    idle --> connected: SessionStart (resume)
    working --> completed: SessionEnd
    idle --> completed: SessionEnd
    connected --> completed: SessionEnd
    working --> error: Error occurred
    completed --> [*]
    error --> [*]
```

### Session State Machine

```mermaid
stateDiagram-v2
    [*] --> active: First hook event / SessionStart
    active --> active: Stop (turn ended, waiting for user)
    active --> error: Stop (error stop_reason)
    active --> completed: SessionEnd (CLI exited)
    active --> abandoned: No activity for 5+ min (SessionStart cleanup)
    completed --> active: Session resumed (new work event)
    error --> active: Session resumed (new work event)
    abandoned --> active: Session resumed (new work event)
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

> [!IMPORTANT]
> The cost calculation flow is based on token usage and model pricing rules. Ensure your pricing rules are up-to-date to reflect accurate costs. Update the model pricing table via the Settings page to maintain accurate cost tracking - the dashboard does not automatically fetch pricing updates from external sources. Once you set the pricing rules, the dashboard applies them retroactively to all sessions for consistent cost reporting.

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

| Hook Type      | Trigger                        | Dashboard Action                                                                             |
| -------------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| `SessionStart` | Claude Code session begins     | Creates session and main agent. Reactivates resumed sessions. Abandons orphaned sessions with no activity for 5+ minutes |
| `PreToolUse`   | Agent starts using a tool      | Sets agent to `working`, sets `current_tool`. If tool is `Agent`, creates subagent record    |
| `PostToolUse`  | Tool execution completed       | Clears `current_tool`. Agent stays `working` (no status change)                              |
| `Stop`         | Claude finishes responding     | Main agent to `idle` (even on non-tool turns). Background subagents keep running. Session stays `active` |
| `SubagentStop` | Background agent finished      | Matches and completes the subagent by description, type, or task                             |
| `Notification` | Agent notification             | Logs event. Compaction-related notifications are tagged as `Compaction` events. Triggers a browser notification if the user has notifications enabled |
| `SessionEnd`   | Claude Code CLI process exits  | Marks all agents and the session as `completed`                                              |
| `Compaction`   | `/compact` detected in JSONL   | Creates a compaction subagent (type `compaction`) and Compaction event. Detected via `isCompactSummary` entries in the transcript JSONL. Also detected by periodic scanner for active sessions |

---

## Browser Notifications

The dashboard supports native browser notifications for real-time alerts when you're not actively viewing the dashboard tab.

### How It Works

1. **Enable** notifications in the Settings page via the master toggle
2. **Grant** browser permission when prompted (required by the Web Notifications API)
3. **Configure** which events trigger notifications:

| Event                        | Default | Description                                                     |
| ---------------------------- | ------- | --------------------------------------------------------------- |
| New session starts           | On      | Fires when a new Claude Code session is created                 |
| Claude finished responding   | Off     | Fires on `Stop` events when Claude finishes a response turn     |
| Session closed               | Off     | Fires on `SessionEnd` when the CLI process exits                |
| Session errors               | On      | Fires when a session ends with an error                         |
| Subagent spawned             | Off     | Fires when a background subagent is created                     |

Additionally, any `Notification` hook event from Claude Code triggers a browser notification regardless of the per-event toggles (as long as the master toggle is enabled).

### Architecture

- **Preferences** are stored in `localStorage` under the key `agent-monitor-notifications`
- **`useNotifications` hook** subscribes to the WebSocket event bus at the app root level (`App.tsx`) and fires `new Notification()` calls based on the saved preferences
- **Permission management** is handled in the Settings page with visual indicators for granted/denied/prompt states
- **Test notification** button in Settings lets you verify the setup works
- No server-side component - notifications are entirely client-side, triggered by WebSocket messages

---

## Data Storage

- **Engine:** SQLite 3 via `better-sqlite3` (optional) or Node.js built-in `node:sqlite`
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
        TEXT name "Main Agent — {session name} or subagent description"
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
    ST["/settings"] --> SETTINGS["Settings<br/>pricing + notifications + hooks + export"]
    NF["/*"] --> NOTFOUND["NotFound<br/>404 catch-all"]

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
|       |-- analytics.js         # Token, tool, and trend analytics
|       |-- pricing.js           # Model pricing CRUD and cost calculation
|       +-- settings.js          # System info, data management, export, cleanup
|   +-- compat-sqlite.js         # node:sqlite compatibility wrapper (fallback for better-sqlite3)
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
|       |   |-- useWebSocket.ts     # Auto-reconnecting WebSocket hook
|       |   +-- useNotifications.ts # Browser notification triggers from WebSocket events
|       |-- components/
|       |   |-- Layout.tsx       # Shell with sidebar + outlet
|       |   |-- Sidebar.tsx      # Navigation + connection indicator
|       |   |-- AgentCard.tsx    # Agent info card with status
|       |   |-- StatCard.tsx     # Metric card
|       |   |-- StatusBadge.tsx  # Color-coded status pills
|       |   +-- EmptyState.tsx   # Placeholder for empty lists
|       +-- pages/
|           |-- Dashboard.tsx      # Overview page
|           |-- KanbanBoard.tsx    # Agent status columns
|           |-- Sessions.tsx       # Sessions table
|           |-- SessionDetail.tsx  # Single session deep dive
|           |-- ActivityFeed.tsx   # Real-time event stream
|           |-- Analytics.tsx      # Token usage, heatmap, trends
|           |-- Settings.tsx       # Model pricing, notifications, hooks, export, cleanup
|           +-- NotFound.tsx       # 404 catch-all page
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
| `better-sqlite3` fails to install | This is non-fatal — the server falls back to Node.js built-in `node:sqlite` automatically (Node 22+). On older Node versions, install Python 3 and C++ build tools, then run `npm rebuild better-sqlite3` |
| Hooks not firing                  | Run `npm run install-hooks` and restart Claude Code. Verify hooks exist in `~/.claude/settings.json`                                                             |
| Dashboard shows no data           | Ensure the server is running (`npm run dev`) before starting a Claude Code session. Check `http://localhost:4820/api/health`                                     |
| WebSocket disconnected            | The client auto-reconnects every 2 seconds. Check that port 4820 is not blocked by a firewall                                                                    |
| Stale data after restart          | The database persists across restarts. Run `npm run seed` for fresh demo data, or delete `data/dashboard.db` to reset                                            |

---

## License

MIT. See [LICENSE](LICENSE) for details.
