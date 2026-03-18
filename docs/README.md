# Documentation Index

Comprehensive documentation for the Agent Dashboard project.

---

## Quick Links

- [Architecture Overview](../ARCHITECTURE.md) - System design and technical reference
- [Setup Guide](../SETUP.md) - Installation and configuration
- [Installation](../INSTALL.md) - Detailed installation instructions

---

## Documentation Sections

### 📘 Core Documentation

```mermaid
graph TB
    Start[Start Here] --> Setup[SETUP.md<br/>Installation & Config]
    Start --> Architecture[ARCHITECTURE.md<br/>System Design]
    
    Setup --> Client[Client README<br/>React UI docs]
    Setup --> Server[Server README<br/>Backend docs]
    
    Architecture --> API[API.md<br/>REST & WebSocket]
    Architecture --> Database[DATABASE.md<br/>Schema reference]
    Architecture --> Hooks[HOOKS.md<br/>Hook system integration]
    Architecture --> MCP[MCP.md<br/>MCP server integration]
    
    Setup --> Deploy[DEPLOYMENT.md<br/>Production deployment]
    
    style Start fill:#3B82F6
    style Setup fill:#10B981
    style Architecture fill:#F59E0B
```

---

### 📋 Documentation Catalog

| Document | Description | Audience |
|----------|-------------|----------|
| [client/README.md](../client/README.md) | React frontend architecture, components, state management | Frontend developers |
| [server/README.md](../server/README.md) | Express backend, database, WebSocket, API | Backend developers |
| [API.md](./API.md) | REST API endpoints, WebSocket protocol | Integration developers |
| [DATABASE.md](./DATABASE.md) | SQLite schema, queries, performance | Database administrators |
| [HOOKS.md](./HOOKS.md) | Claude Code hook system integration | Hook developers |
| [MCP.md](./MCP.md) | MCP server setup and tool reference | MCP integrators |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment strategies | DevOps engineers |

---

## Getting Started

### For New Users

```mermaid
graph LR
    A[New to Project] --> B[Read SETUP.md]
    B --> C[Install Dependencies]
    C --> D[Run npm run dev]
    D --> E[Open localhost:5173]
    
    style A fill:#3B82F6
    style E fill:#10B981
```

**Quick Start:**

1. Read [SETUP.md](../SETUP.md)
2. Run `npm run setup`
3. Run `npm run dev`
4. Open browser to `http://localhost:5173`

---

### For Frontend Developers

```mermaid
graph TB
    FE[Frontend Developer] --> ClientDocs[client/README.md]
    ClientDocs --> Components[Component Architecture]
    ClientDocs --> State[State Management]
    ClientDocs --> WebSocket[WebSocket Integration]
    
    style FE fill:#61DAFB
```

**Key Documents:**

- [client/README.md](../client/README.md) - Complete frontend guide
- [API.md](./API.md#websocket-api) - WebSocket protocol
- Component source: `client/src/components/`

---

### For Backend Developers

```mermaid
graph TB
    BE[Backend Developer] --> ServerDocs[server/README.md]
    ServerDocs --> Routes[API Routes]
    ServerDocs --> DB[Database Design]
    ServerDocs --> WS[WebSocket Server]
    
    style BE fill:#339933
```

**Key Documents:**

- [server/README.md](../server/README.md) - Complete backend guide
- [DATABASE.md](./DATABASE.md) - Schema and queries
- [HOOKS.md](./HOOKS.md) - Hook processing
- API source: `server/routes/`

---

### For DevOps Engineers

```mermaid
graph TB
    DevOps[DevOps Engineer] --> Deploy[DEPLOYMENT.md]
    Deploy --> Docker[Docker Setup]
    Deploy --> PM2[PM2 Process Manager]
    Deploy --> Cloud[Cloud Deployment]
    Deploy --> Monitoring[Monitoring & Logging]
    
    style DevOps fill:#F59E0B
```

**Key Documents:**

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [DATABASE.md](./DATABASE.md#backup-strategies) - Backup strategies
- [server/README.md](../server/README.md#performance) - Performance tuning

---

### For Integration Developers

```mermaid
graph TB
    Integration[Integration Developer] --> API[API.md]
    API --> REST[REST Endpoints]
    API --> WebSocket[WebSocket Events]
    
    Integration --> MCP[MCP.md]
    MCP --> Tools[MCP Tools]
    MCP --> Config[Client Configuration]
    
    style Integration fill:#8B5CF6
```

**Key Documents:**

- [API.md](./API.md) - Complete API reference
- [MCP.md](./MCP.md) - MCP server integration
- [HOOKS.md](./HOOKS.md) - Custom hook integration

---

## Architecture Overview

### System Components

```mermaid
graph TB
    subgraph "Frontend"
        React[React + TypeScript<br/>Vite + Tailwind]
    end
    
    subgraph "Backend"
        Express[Express Server<br/>Node.js 18+]
        DB[(SQLite Database)]
        WS[WebSocket Server]
    end
    
    subgraph "Integration"
        Hooks[Claude Code Hooks]
        MCP[MCP Server]
    end
    
    subgraph "Clients"
        Browser[Web Browser]
        Claude[Claude Desktop]
        Custom[Custom Clients]
    end
    
    Browser --> React
    React -->|HTTP/WS| Express
    Express --> DB
    Express --> WS
    
    Hooks -->|HTTP POST| Express
    
    Claude -->|stdio| MCP
    MCP -->|HTTP| Express
    Custom -->|HTTP| Express
    
    style React fill:#61DAFB
    style Express fill:#000000,color:#fff
    style DB fill:#003B57,color:#fff
    style MCP fill:#0f766e
```

**Technology Stack:**

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript 5.7, Vite 6, Tailwind CSS |
| **Backend** | Node.js 18+, Express 4.21, WebSocket |
| **Database** | SQLite 3 (better-sqlite3 or node:sqlite) |
| **Integration** | Claude Code Hooks, MCP Server |

---

## Feature Documentation

### Real-Time Updates

```mermaid
sequenceDiagram
    participant Hook as Claude Code Hook
    participant Server as Dashboard Server
    participant DB as SQLite
    participant WS as WebSocket
    participant Client as Browser
    
    Hook->>Server: POST /hooks/post-tool-use
    Server->>DB: Update data
    DB-->>Server: Success
    Server->>WS: Broadcast event
    WS->>Client: { type: 'tool.executed', data }
    Client->>Client: Update UI
    
    Note over Client: No polling required!
```

**Documentation:**
- [WebSocket Protocol](./API.md#websocket-api)
- [Client Integration](../client/README.md#websocket-integration)
- [Server Broadcasting](../server/README.md#websocket-protocol)

---

### Pricing System

```mermaid
graph TB
    Model[Model Name] --> Match[Pattern Matching]
    Match --> Custom{Custom<br/>Rule?}
    
    Custom -->|Yes| UseCustom[Use Custom Pricing]
    Custom -->|No| UseDefault[Use Default Pricing]
    
    UseCustom --> Calculate[Calculate Cost]
    UseDefault --> Calculate
    
    Calculate --> Result[input_cost + output_cost]
    
    style Calculate fill:#10B981
```

**Documentation:**
- [Pricing API](./API.md#pricing)
- [Database Schema](./DATABASE.md#pricing_rules)
- [Server Implementation](../server/README.md#pricing-calculation)

---

### Hook System

```mermaid
graph LR
    Claude[Claude Code] -->|stdin| Hook[Hook Script]
    Hook -->|exec| Handler[hook-handler.js]
    Handler -->|HTTP POST| Server[Dashboard Server]
    Server --> DB[(Database)]
    Server --> WS[WebSocket]
    
    style Hook fill:#F59E0B
    style Handler fill:#10B981
```

**Documentation:**
- [Hook System Guide](./HOOKS.md)
- [Hook Processing](../server/README.md#hook-processing)
- [Installation](../SETUP.md#install-hooks)

---

## API Documentation

### REST API Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List sessions |
| `/api/sessions/:id` | GET | Get session |
| `/api/sessions/:id/agents` | GET | List session agents |
| `/api/agents/:id` | GET | Get agent |
| `/api/agents/:id/tools` | GET | List agent tools |
| `/api/pricing` | GET | List pricing rules |
| `/api/pricing` | POST | Create pricing rule |
| `/api/pricing/:pattern` | DELETE | Delete pricing rule |

**Full Reference:** [API.md](./API.md#rest-api)

---

### WebSocket Events

| Event Type | Triggered By |
|------------|--------------|
| `session.created` | SessionStart hook |
| `session.updated` | Any session update |
| `agent.created` | New agent started |
| `agent.updated` | Agent status/cost change |
| `tool.executed` | Tool execution completed |
| `notification.received` | System notification |

**Full Reference:** [API.md](./API.md#websocket-api)

---

## Database Schema

### Entity Relationships

```mermaid
erDiagram
    sessions ||--o{ agents : "has many"
    agents ||--o{ tool_executions : "has many"
    sessions ||--o{ notifications : "has many"
    
    sessions {
        text session_id PK
        text model
        text status
        real total_cost
        datetime updated_at
    }
    
    agents {
        text agent_id PK
        text session_id FK
        text agent_type
        text status
        text current_tool
        int input_tokens
        int output_tokens
        real cost
    }
```

**Full Reference:** [DATABASE.md](./DATABASE.md)

---

## Deployment Options

```mermaid
graph TB
    subgraph "Development"
        Dev[npm run dev<br/>Hot reload]
    end
    
    subgraph "Production"
        Docker[Docker Compose<br/>Containerized]
        PM2[PM2<br/>Process manager]
        Systemd[Systemd Service<br/>Linux systems]
        Cloud[Cloud Platform<br/>AWS, Azure, GCP]
    end
    
    Dev -.->|Build| Docker
    Dev -.->|Build| PM2
    Dev -.->|Build| Systemd
    Dev -.->|Build| Cloud
    
    style Dev fill:#3B82F6
    style Docker fill:#2496ED
    style PM2 fill:#10B981
    style Systemd fill:#F59E0B
    style Cloud fill:#8B5CF6
```

**Full Reference:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Performance Metrics

### Benchmarks

| Metric | Target | Actual |
|--------|--------|--------|
| Hook processing | < 100ms | ~70ms |
| API response time | < 50ms | ~30ms |
| WebSocket latency | < 10ms | ~5ms |
| Database query | < 10ms | ~5ms |
| Session list (50) | < 20ms | ~10ms |

**Optimization Details:**
- [Server Performance](../server/README.md#performance)
- [Database Tuning](./DATABASE.md#performance-optimization)
- [Client Performance](../client/README.md#performance)

---

## Contributing

### Development Workflow

```mermaid
graph LR
    Fork[Fork Repository] --> Clone[Clone Locally]
    Clone --> Branch[Create Feature Branch]
    Branch --> Code[Write Code]
    Code --> Test[Run Tests]
    Test --> Commit[Commit Changes]
    Commit --> Push[Push to Fork]
    Push --> PR[Create Pull Request]
    
    style Fork fill:#3B82F6
    style PR fill:#10B981
```

**Before submitting:**

1. Run tests: `npm test`
2. Check formatting: `npm run format:check`
3. Build: `npm run build`
4. Update docs if needed

---

## Support & Resources

### Getting Help

- **Issues:** [GitHub Issues](https://github.com/your-org/agent-dashboard/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/agent-dashboard/discussions)
- **Documentation:** This folder

### Additional Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude/docs)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- [SQLite Documentation](https://sqlite.org/docs.html)
- [React Documentation](https://react.dev/)
- [Express Documentation](https://expressjs.com/)

---

## License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) for details.

---

## Summary

This documentation covers:

- ✅ **Complete architecture** - Frontend, backend, database, integrations
- ✅ **API reference** - REST endpoints, WebSocket events
- ✅ **Deployment guides** - Docker, PM2, systemd, cloud
- ✅ **Performance tuning** - Database, server, client optimizations
- ✅ **Integration guides** - Hooks, MCP, custom clients
- ✅ **Development guides** - Setup, testing, contributing

**Start with:** [SETUP.md](../SETUP.md) for installation, then explore specific areas based on your role.
