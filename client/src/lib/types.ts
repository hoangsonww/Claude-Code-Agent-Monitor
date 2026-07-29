/**
 * @file types.ts
 * @description Defines TypeScript types and interfaces for the agent dashboard application, including data structures for sessions, agents, events, statistics, analytics, model pricing, cost breakdowns, WebSocket messages, and workflow-related data. These types provide a clear contract for the shape of data used throughout the application and facilitate type safety when interacting with the backend API and managing state within the frontend components.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/lib/types.ts`
 * **Purpose:** Shared wire-format types for REST + WebSocket messages — keep in sync with `server/` serializers and OpenAPI.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Public surface
 * - `SessionStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `AgentStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `AgentType` — exported API; see TSDoc on the symbol for behavior.
 * - `AWAITING_STATUS` — exported API; see TSDoc on the symbol for behavior.
 * - `AwaitingReason` — exported API; see TSDoc on the symbol for behavior.
 * - `AWAITING_REASONS` — exported API; see TSDoc on the symbol for behavior.
 * - `EffectiveAgentStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `EffectiveSessionStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `Session` — exported API; see TSDoc on the symbol for behavior.
 * - `Agent` — exported API; see TSDoc on the symbol for behavior.
 * - `isSessionAwaitingInput` — exported API; see TSDoc on the symbol for behavior.
 * - `isAgentAwaitingInput` — exported API; see TSDoc on the symbol for behavior.
 * - `effectiveAgentStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `effectiveSessionStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `normalizeAwaitingReason` — exported API; see TSDoc on the symbol for behavior.
 * - `sessionAwaitingReason` — exported API; see TSDoc on the symbol for behavior.
 * - `agentAwaitingReason` — exported API; see TSDoc on the symbol for behavior.
 * - `DashboardEvent` — exported API; see TSDoc on the symbol for behavior.
 * - `Stats` — exported API; see TSDoc on the symbol for behavior.
 * - `Analytics` — exported API; see TSDoc on the symbol for behavior.
 * - `ModelPricing` — exported API; see TSDoc on the symbol for behavior.
 * - `CostBreakdown` — exported API; see TSDoc on the symbol for behavior.
 * - `CostFeatureCosts` — exported API; see TSDoc on the symbol for behavior.
 * - `UnpricedModel` — exported API; see TSDoc on the symbol for behavior.
 * - `CostResult` — exported API; see TSDoc on the symbol for behavior.
 * - `ImportProgressMessage` — exported API; see TSDoc on the symbol for behavior.
 * - `RemoteSourceStatusPayload` — exported API; see TSDoc on the symbol for behavior.
 * - `UpdateStatusPayload` — exported API; see TSDoc on the symbol for behavior.
 * - `RunStreamPayload` — exported API; see TSDoc on the symbol for behavior.
 * - `RunStatusPayload` — exported API; see TSDoc on the symbol for behavior.
 * - `RunInputAckPayload` — exported API; see TSDoc on the symbol for behavior.
 * - `CcConfigChangedPayload` — exported API; see TSDoc on the symbol for behavior.
 * - `AlertRuleType` — exported API; see TSDoc on the symbol for behavior.
 * - `AlertRuleConfig` — exported API; see TSDoc on the symbol for behavior.
 * - `AlertRule` — exported API; see TSDoc on the symbol for behavior.
 * - `AlertEvent` — exported API; see TSDoc on the symbol for behavior.
 * - `WebhookType` — exported API; see TSDoc on the symbol for behavior.
 * - `WebhookProviderField` — exported API; see TSDoc on the symbol for behavior.
 * - `WebhookProvider` — exported API; see TSDoc on the symbol for behavior.
 * - `WebhookDeliverySummary` — exported API; see TSDoc on the symbol for behavior.
 * - … plus 35 additional exports
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **SessionStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AgentStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AgentType**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AWAITING_STATUS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AwaitingReason**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AWAITING_REASONS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EffectiveAgentStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EffectiveSessionStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Session**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Agent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **isSessionAwaitingInput**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **isAgentAwaitingInput**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **effectiveAgentStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **effectiveSessionStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **normalizeAwaitingReason**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **sessionAwaitingReason**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **agentAwaitingReason**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **DashboardEvent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Stats**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Analytics**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ModelPricing**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CostBreakdown**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CostFeatureCosts**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **UnpricedModel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CostResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ImportProgressMessage**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RemoteSourceStatusPayload**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **UpdateStatusPayload**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunStreamPayload**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunStatusPayload**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunInputAckPayload**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcConfigChangedPayload**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AlertRuleType**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AlertRuleConfig**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AlertRule**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AlertEvent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookType**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookProviderField**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookProvider**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookDeliverySummary**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookTarget**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookDelivery**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WebhookTestResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WSMessage**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SessionStats**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowStats**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **OrchestrationEdge**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **OrchestrationData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ToolFlowTransition**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ToolFlowData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SubagentEffectivenessItem**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowPattern**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowPatternsData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ModelDelegationData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ErrorPropagationData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ConcurrencyLane**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ConcurrencyData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SessionComplexityItem**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CompactionImpactData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowData**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SessionDrillIn**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowPhase**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowProgressEntry**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowRun**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowRunsResponse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **WorkflowRunDetail**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **STATUS_CONFIG**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **AWAITING_REASON_CONFIG**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TranscriptContent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TranscriptSender**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TranscriptMessage**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TranscriptResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TranscriptInfo**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TranscriptListResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **SESSION_STATUS_CONFIG**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/**
 * ## Module overview
 *
 * This module is the single source of truth for the shapes exchanged between the
 * dashboard's Express/SQLite backend (`server/`) and its React + Vite frontend
 * (`client/`). Every interface here mirrors either:
 *
 *  - a **SQLite row** (e.g. {@link Session}, {@link Agent}, {@link DashboardEvent},
 *    {@link AlertRule}, {@link WorkflowRun}), possibly with a few extra computed
 *    columns that only appear on certain queries; or
 *  - a **REST response body** (e.g. {@link Stats}, {@link Analytics},
 *    {@link CostResult}, {@link WorkflowData}, {@link TranscriptResult}); or
 *  - a **WebSocket push payload** (e.g. {@link WSMessage} and its `data` union
 *    members such as {@link ImportProgressMessage}, {@link RunStreamPayload},
 *    {@link CcConfigChangedPayload}).
 *
 * ### Data-flow context
 *
 * The dashboard is local-first and event-driven. Claude Code emits lifecycle
 * hooks → the Express server ingests them → rows are written to SQLite → the
 * server broadcasts a {@link WSMessage} over the dashboard WebSocket → the React
 * UI updates in real time. The same rows are also queryable over REST for the
 * initial page load and for pagination. The types below therefore appear on both
 * the "fetch on mount" path and the "live update" path, and must stay backward
 * compatible so older UI tabs keep working while a session streams.
 *
 * ### Conventions used throughout
 *
 *  - **Timestamps** are ISO-8601 strings (e.g. `"2026-03-19T14:03:22.114Z"`)
 *    unless a field name or its doc comment says otherwise. A handful of
 *    lifecycle payloads (`Run*Payload.at`, `WorkflowProgressEntry.startedAt`)
 *    use epoch milliseconds instead — those are called out explicitly.
 *  - **`null` vs `undefined`.** A `T | null` field is a real column that is
 *    currently empty (the row exists but the value is unknown/not-yet-set). An
 *    optional `field?: T` is a value that is only present on some responses
 *    (e.g. a joined/computed column, or a field a newer server version added).
 *    Both meanings can coexist as `field?: T | null`.
 *  - **Costs** are always USD. Pricing rate fields are USD per million tokens
 *    ("MTok"); computed `cost`/`*_cost` fields are absolute USD amounts.
 *  - **Token counts** are raw integer token totals, bucketed into
 *    input / output / cache-read / cache-write categories. Cache reads are
 *    billed cheaper than fresh input; cache writes are billed as a premium.
 *  - **`metadata` / `data` / `details` string fields** hold opaque JSON that has
 *    NOT been parsed — call `JSON.parse` before reading them. They may be `null`.
 *  - **Status enums** are persisted lifecycle values (see {@link SessionStatus},
 *    {@link AgentStatus}); the `Effective*` variants overlay a transient
 *    "waiting on human input" state used only for rendering, never persisted.
 *
 * ### REST endpoint → type index
 *
 * A quick map from the backend routes to the response type they return, so a
 * reader can jump from an API call to the shape they'll get back:
 *
 *  - `GET  /api/sessions`, `/api/sessions/:id` .......... {@link Session}(`[]`)
 *  - `GET  /api/agents` ................................. {@link Agent}`[]`
 *  - `GET  /api/events`, `/api/sessions/:id` (events) ... {@link DashboardEvent}`[]`
 *  - `GET  /api/stats` .................................. {@link Stats}
 *  - `GET  /api/analytics` ............................. {@link Analytics}
 *  - `GET/PUT /api/pricing` ............................ {@link ModelPricing}`[]`
 *  - `GET  /api/pricing/cost[/:sessionId]` ............. {@link CostResult}
 *  - `GET  /api/updates/status` ........................ {@link UpdateStatusPayload}
 *  - `GET/POST/PATCH /api/alerts/rules` ................ {@link AlertRule}(`[]`)
 *  - `GET  /api/alerts` ................................ {@link AlertEvent}`[]`
 *  - `GET  /api/webhooks/providers` .................... {@link WebhookProvider}`[]`
 *  - `GET/POST/PATCH /api/webhooks` ................... {@link WebhookTarget}(`[]`)
 *  - `GET  /api/webhooks/:id/deliveries` .............. {@link WebhookDelivery}`[]`
 *  - `POST /api/webhooks/:id/test` .................... {@link WebhookTestResult}
 *  - `GET  /api/sessions/:id/stats` ................... {@link SessionStats}
 *  - `GET  /api/sessions/:id/transcript` ............. {@link TranscriptResult}
 *  - `GET  /api/sessions/:id/transcripts` ............ {@link TranscriptListResult}
 *  - `GET  /api/workflows` ........................... {@link WorkflowData}
 *  - `GET  /api/workflows/session/:id` ............... {@link SessionDrillIn}
 *  - `GET  /api/workflows/runs[/:runId]` ............. {@link WorkflowRunsResponse} /
 *    {@link WorkflowRunDetail}
 *
 * ### WebSocket `type` → payload index
 *
 * Every {@link WSMessage} carries a `type` discriminant and a matching `data`
 * payload (see {@link WSMessage} for the enumerated union):
 *
 *  - `session_created` / `session_updated` ............ {@link Session}
 *  - `agent_created` / `agent_updated` ................ {@link Agent}
 *  - `new_event` ..................................... {@link DashboardEvent}
 *  - `import.progress` ............................... {@link ImportProgressMessage}
 *  - `update_status` ................................ {@link UpdateStatusPayload}
 *  - `run_stream` / `run_status` / `run_input_ack` ... {@link RunStreamPayload} /
 *    {@link RunStatusPayload} / {@link RunInputAckPayload}
 *  - `cc_config_changed` ............................ {@link CcConfigChangedPayload}
 *  - `alert_triggered` / `alert_updated` ............ {@link AlertEvent}
 *  - `workflow_upserted` ............................ {@link WorkflowRun}
 *  - `plan_updated` ................................. {@link PlanUpdatedPayload}
 *  - `session_focus` ................................ {@link SessionFocus}
 *
 * ### Where these types are consumed
 *
 * The API-layer helpers in `client/src/lib/` (the fetch wrappers and the
 * `useWebSocket`/`eventBus` plumbing) return and dispatch these shapes; the
 * page components under `client/src/pages/` (Dashboard, SessionDetail,
 * Analytics, Workflows, Settings) then bind them straight to cards, tables, and
 * charts. Because a live tab can receive a `*_updated` push at any moment, the
 * UI is written to merge partial row updates over whatever it already has, which
 * is why so many computed/joined fields below are optional rather than required.
 *
 * Keeping these types accurate is a non-negotiable contract: the server response
 * shapes and WebSocket message types are expected to stay stable and backward
 * compatible (see the project's change guidelines for API/DB/WebSocket areas).
 */

// ───── Core lifecycle enums ─────
// Small string-literal unions that model the persisted state machines for
// sessions and agents. They are stored verbatim in SQLite `status`/`type`
// columns and echoed back on every API/WebSocket payload, so the exact string
// values here must match what the server writes.

/** Persisted lifecycle state of a `Session` row. "abandoned" is assigned by the
 *  server-side cleanup sweep for sessions that went stale without a clean end. */
export type SessionStatus = "active" | "completed" | "error" | "abandoned";
/** Persisted lifecycle state of an `Agent` row, driven by hook events
 *  (PreToolUse → "working", Stop/PostToolUse → "waiting", SubagentStop/error). */
export type AgentStatus = "working" | "waiting" | "completed" | "error";
/** Whether an `Agent` is the session's top-level Claude Code process ("main")
 *  or a delegated Task/Agent-tool invocation ("subagent"). */
export type AgentType = "main" | "subagent";

/**
 * UI-only status that overlays the persisted SessionStatus/AgentStatus when
 * `awaiting_input_since` is set on a session or agent. Renders as a yellow
 * "Waiting" badge so the dashboard can flag sessions blocked on a Claude Code
 * permission prompt without changing the underlying lifecycle enum.
 *
 * The literal value is intentionally `"waiting"` (the same string as
 * {@link AgentStatus}'s idle-but-alive state) so the presentation lookups in
 * {@link STATUS_CONFIG}/{@link SESSION_STATUS_CONFIG} need only one "waiting"
 * entry to cover both the persisted-idle and the overlaid-blocked cases.
 */
export const AWAITING_STATUS = "waiting" as const;

/**
 * WHY a session/agent is blocked on the human, mirroring the server's
 * `awaiting_reason` column (set/cleared in lock-step with
 * `awaiting_input_since` by `server/routes/hooks.js`):
 *
 * - `"notification"`  — a permission prompt or explicit input request; Claude
 *    cannot continue until the user responds. The most actionable state.
 * - `"stop"`          — Claude finished its turn; the session idles until the
 *    next prompt is submitted.
 * - `"session_start"` — the CLI just started/resumed and sits at an empty
 *    prompt; nothing has been asked yet.
 * - `"interrupted"`   — the turn was cut short (Esc, or the watchdog recovered
 *    a lost Stop hook); Claude is waiting for direction.
 * - `"subagent"`      — main's own turn ended, but a subagent fleet it spawned
 *    is still working; NOT blocked on the human.
 * - `"shell"`         — main is mid a synchronous Bash call; NOT blocked on
 *    the human.
 * - `"monitor"`       — main is mid a Monitor tool call; NOT blocked on the
 *    human.
 */
export type AwaitingReason =
  | "notification"
  | "stop"
  | "session_start"
  | "interrupted"
  | "subagent"
  | "shell"
  | "monitor";

/** All known {@link AwaitingReason} values, used to validate the raw string the
 *  server sends before the UI trusts it (see {@link normalizeAwaitingReason}). */
export const AWAITING_REASONS: readonly AwaitingReason[] = [
  "notification",
  "stop",
  "session_start",
  "interrupted",
  "subagent",
  "shell",
  "monitor",
] as const;
/** {@link AgentStatus} widened with the transient {@link AWAITING_STATUS} overlay;
 *  the type the UI actually renders a badge for (see {@link effectiveAgentStatus}). */
export type EffectiveAgentStatus = AgentStatus | typeof AWAITING_STATUS;
/** {@link SessionStatus} widened with the transient {@link AWAITING_STATUS} overlay;
 *  the type the UI actually renders a badge for (see {@link effectiveSessionStatus}). */
export type EffectiveSessionStatus = SessionStatus | typeof AWAITING_STATUS;

// ───── Session & Agent rows ─────
// The two primary entities. A `Session` is one `claude` CLI invocation; an
// `Agent` is one process within it (the main loop or a spawned subagent). Both
// are created lazily on their first hook event and mutated as hooks stream in.

/**
 * A Claude Code CLI invocation tracked by the dashboard - one row per top-level
 * `claude` process, created on its first hook event (or on import) and updated
 * as hooks stream in. Returned by GET /api/sessions, /api/sessions/:id, and
 * pushed live via the `session_created`/`session_updated` WebSocket messages.
 *
 * Fields split into three groups: always-present columns (`id`..`metadata`),
 * join-only computed columns (`agent_count`, `last_activity`, `cost`) that only
 * appear on responses whose query attaches them, and the transient
 * `awaiting_input_since` overlay used to render the "Waiting" badge.
 */
export interface Session {
  /** Session UUID, taken from the Claude Code hook payload's `session_id`.
   *  Primary key (`sessions.id`); also the foreign key that `Agent`/
   *  `DashboardEvent` rows join on. Example: `"9f2c1e7a-...-b3"`. */
  id: string;
  /** User-assigned or auto-derived display title; null until named (e.g. via
   *  `/rename`, `claude -n`, or the picker) - the UI falls back to the id.
   *  Maps to `sessions.name`. Example: `"Fix desktop freeze on large history"`. */
  name: string | null;
  /** Persisted lifecycle state; see {@link SessionStatus}. Drives filtering and,
   *  via {@link SESSION_STATUS_CONFIG}, the colored status badge. Maps to
   *  `sessions.status`. One of "active" | "completed" | "error" | "abandoned". */
  status: SessionStatus;
  /** Working directory the CLI was launched from, or null if never reported.
   *  Maps to `sessions.cwd`. Example: `"/Users/dev/project"`. */
  cwd: string | null;
  /** Model id reported by the session's SessionStart hook; null if unknown.
   *  Maps to `sessions.model`. Example: `"claude-opus-4-8"`. */
  model: string | null;
  /** ISO timestamp of the session's first hook event. Serves as the session's
   *  creation/start time and the left edge of its timeline. Maps to
   *  `sessions.started_at`. Example: `"2026-03-19T14:03:22.114Z"`. */
  started_at: string;
  /** ISO timestamp of SessionEnd, or null while the session is still active.
   *  Maps to `sessions.ended_at`. Duration = `ended_at - started_at`. */
  ended_at: string | null;
  /** Opaque JSON string of extra session metadata; parse before use. May be
   *  null. Maps to `sessions.metadata`. `JSON.parse` before reading any keys. */
  metadata: string | null;
  /** Count of `Agent` rows (main + subagents) belonging to this session.
   *  Only present on list/detail responses that join agent counts (a computed
   *  column, not a stored one). Undefined ≠ zero: it means "not joined here". */
  agent_count?: number;
  /** ISO timestamp of the most recent event in this session, for "last active"
   *  sorting; only present where the query computes it. Distinct from
   *  `started_at` (creation) and `ended_at` (clean finish). */
  last_activity?: string;
  /** Total USD cost for the session, computed from its token usage against the
   *  active pricing rules. Only present on responses that attach pricing.
   *  Absolute dollars (e.g. `0.42`), already summed across all buckets. */
  cost?: number;
  /** ISO timestamp set when Claude Code is blocked waiting for the user
   * (permission prompt or "waiting for your input" notice). Cleared on the
   * next non-Notification hook event. Null when the session is not waiting.
   * Feeds {@link isSessionAwaitingInput} and the yellow "Waiting" overlay. */
  awaiting_input_since?: string | null;
  /** WHY the session is waiting - one of {@link AwaitingReason}, set/cleared in
   * lock-step with `awaiting_input_since`. Kept as a plain string here because
   * the server may grow new values; normalize via {@link sessionAwaitingReason}
   * before rendering. Null/absent when the session is not waiting. */
  awaiting_reason?: string | null;
  /** Machine this session was collected from. `"local"` (the default) is this
   * dashboard's own machine; any other value is a remote source id (see the
   * Remote Data Sources feature / `remote_sources`). Maps to `sessions.source`. */
  source?: string;
}

/**
 * A single agent process within a session: either the main Claude Code CLI or
 * a subagent spawned via the Task/Agent tool. Returned nested under `Session`
 * responses and by GET /api/agents; pushed live via `agent_created`/`agent_updated`.
 *
 * Main agents typically carry the session's overall cost; subagents may carry
 * their own per-agent token buckets in `metadata` and expose an individual
 * `cost`. The `parent_agent_id` self-reference lets the Workflows views rebuild
 * the parent→child delegation tree.
 */
export interface Agent {
  /** Agent UUID. For main agents this is typically `${session_id}-main`; for
   *  Workflow-tool inner agents it follows `${sessionId}-jsonl-<agentId>`. Maps
   *  to `agents.id` (primary key). */
  id: string;
  /** Owning session's id (foreign key into `Session.id`). Maps to
   *  `agents.session_id`. */
  session_id: string;
  /** Display name - the subagent_type for subagents, or a generic main-agent
   *  label; used for the swim-lane / pill labels when subagent_type is unset.
   *  Maps to `agents.name`. */
  name: string;
  /** Whether this is the top-level agent or a delegated one; see {@link AgentType}.
   *  Maps to `agents.type`. "main" | "subagent". */
  type: AgentType;
  /** Task/Agent tool `subagent_type` (e.g. "frontend-reviewer"); null for main
   *  agents and for subagents that predate this field. Maps to
   *  `agents.subagent_type`. The pseudo-value "compaction" marks a
   *  context-compression pseudo-agent rather than a real delegation. */
  subagent_type: string | null;
  /** Persisted lifecycle state; see {@link AgentStatus}. Rendered via
   *  {@link STATUS_CONFIG} (with the {@link AWAITING_STATUS} overlay applied).
   *  Maps to `agents.status`. "working" | "waiting" | "completed" | "error". */
  status: AgentStatus;
  /** Free-text description of what the agent was asked to do (from the Task
   *  tool's `description`/`prompt` input); null when not captured. Maps to
   *  `agents.task`. Example: `"Review the diff for regressions"`. */
  task: string | null;
  /** Name of the tool currently mid-execution (set on PreToolUse, cleared on
   *  PostToolUse); null when the agent isn't inside a tool call. Maps to
   *  `agents.current_tool`. Powers the "currently running X" live hint. */
  current_tool: string | null;
  /** ISO timestamp the agent was created (its first hook event). Maps to
   *  `agents.started_at`; the left edge of the agent's swim lane. */
  started_at: string;
  /** ISO timestamp the agent finished (Stop/SubagentStop), or null if running.
   *  Maps to `agents.ended_at`. */
  ended_at: string | null;
  /** ISO timestamp of the most recent event attributed to this agent. Maps to
   *  `agents.updated_at`; bumped on every ingested event for this agent. */
  updated_at: string;
  /** Id of the agent that spawned this one via Task/Agent; null for main agents
   *  and for subagents whose parent wasn't recorded (e.g. legacy imports). Maps
   *  to `agents.parent_agent_id`; the self-reference that builds the agent tree. */
  parent_agent_id: string | null;
  /** Opaque JSON string (e.g. per-agent token buckets under `.tokens`, used by
   *  `cost` below); parse before use. May be null. Maps to `agents.metadata`.
   *  This is where a subagent's own input/output/cache token counts live. */
  metadata: string | null;
  /** Mirrors the parent session: ISO timestamp when set, null otherwise. Feeds
   *  {@link isAgentAwaitingInput} / {@link effectiveAgentStatus}; ignored once
   *  the agent has reached a terminal status. */
  awaiting_input_since?: string | null;
  /** Mirrors the parent session's `awaiting_reason` for main agents (subagents
   * stay NULL); see {@link AwaitingReason}. Normalize via
   * {@link agentAwaitingReason} before rendering. */
  awaiting_reason?: string | null;
  /**
   * The agent's OWN cost (USD), computed server-side from its per-agent token
   * buckets. Present for subagents that carry usage in their metadata; 0/absent
   * for main agents (whose cost is the session total) and compaction agents.
   */
  cost?: number;
}

// ───── "Awaiting input" overlay helpers ─────
// Pure predicates and mappers that derive the transient {@link AWAITING_STATUS}
// overlay from a row's `awaiting_input_since` flag. Kept here (next to the
// types) so both the server-shaped rows and the UI agree on when a session or
// agent counts as "blocked on the human" versus merely idle.

/**
 * True when a session is paused on a permission prompt or input request.
 * @param session The session to check, or a nullish value (returns false).
 * @returns Whether the session is currently active AND has a pending
 *   `awaiting_input_since` timestamp - i.e. blocked on the human, not just idle.
 */
export function isSessionAwaitingInput(session: Session | undefined | null): boolean {
  return !!session?.awaiting_input_since && session.status === "active";
}

/**
 * True when an agent is the one blocked on user input (typically a main agent).
 * @param agent The agent to check, or a nullish value (returns false).
 * @returns Whether `awaiting_input_since` is set and the agent hasn't already
 *   reached a terminal status (a stale flag on a finished agent is ignored).
 */
export function isAgentAwaitingInput(agent: Agent | undefined | null): boolean {
  if (!agent?.awaiting_input_since) return false;
  // Once the agent's lifecycle has ended, the waiting flag is stale; ignore it.
  return agent.status !== "completed" && agent.status !== "error";
}

// Marker the SDK writes into a transcript's metadata when it was driven
// headlessly rather than from an interactive terminal.
const INTERNAL_SESSION_ENTRYPOINT = "sdk-cli";

// Matches common OS temp-directory roots: macOS `/var/folders/.../T` (with or
// without the `/private` symlink-resolved prefix), Unix `/tmp` and
// `/var/tmp`, and Windows `...\Temp\`.
const TEMP_CWD_PATTERN =
  /^(\/private)?\/var\/folders\/[^/]+\/[^/]+\/T(\/|$)|^\/(var\/)?tmp(\/|$)|\\(AppData\\Local\\)?Temp(\\|$)/i;

/**
 * True for a session spawned by this dashboard's own internal focus
 * classifiers (server/lib/focus-audit.js, focus-inference.js) rather than a
 * real user session. Those run headless `claude` CLI calls from an OS temp
 * directory with hooks disabled to score/classify session transcripts in the
 * background - hooks being off only skips live hook events, not the on-disk
 * JSONL transcript, so the project-folder importer still picks them up as
 * ordinary sessions. Detection requires BOTH a temp-directory cwd and the
 * SDK's own "sdk-cli" entrypoint marker - either alone risks a false
 * positive (a user manually working from `/tmp`, or an unrelated legitimate
 * SDK automation), but together they're specific to this app's own spawns.
 * @param session The session to check, or a nullish value (returns false).
 */
export function isInternalSession(session: Session | undefined | null): boolean {
  if (!session?.cwd || !TEMP_CWD_PATTERN.test(session.cwd) || !session.metadata) return false;
  try {
    const meta = JSON.parse(session.metadata) as { entrypoint?: string };
    return meta?.entrypoint === INTERNAL_SESSION_ENTRYPOINT;
  } catch {
    return false;
  }
}

/** Overlays {@link AWAITING_STATUS} on top of `agent.status` when the agent is
 *  blocked on user input; otherwise passes the persisted status through unchanged. */
export function effectiveAgentStatus(agent: Agent): EffectiveAgentStatus {
  return isAgentAwaitingInput(agent) ? AWAITING_STATUS : agent.status;
}

/** Overlays {@link AWAITING_STATUS} on top of `session.status` when the session
 *  is blocked on user input; otherwise passes the persisted status through unchanged. */
export function effectiveSessionStatus(session: Session): EffectiveSessionStatus {
  return isSessionAwaitingInput(session) ? AWAITING_STATUS : session.status;
}

/**
 * Validates the raw `awaiting_reason` string the server sent against the known
 * {@link AwaitingReason} set. Unknown/future values degrade to null so the UI
 * falls back to the plain "Waiting" badge instead of rendering a key miss.
 */
export function normalizeAwaitingReason(value: string | null | undefined): AwaitingReason | null {
  return value && (AWAITING_REASONS as readonly string[]).includes(value)
    ? (value as AwaitingReason)
    : null;
}

/**
 * The session's {@link AwaitingReason}, but ONLY while the session actually
 * counts as waiting (per {@link isSessionAwaitingInput}) - a stale reason on a
 * finished/idle session is never surfaced.
 * @returns The normalized reason, or null when not waiting / reason unknown.
 */
export function sessionAwaitingReason(session: Session | undefined | null): AwaitingReason | null {
  if (!session || !isSessionAwaitingInput(session)) return null;
  return normalizeAwaitingReason(session.awaiting_reason);
}

/**
 * The agent's {@link AwaitingReason}, gated on {@link isAgentAwaitingInput} the
 * same way {@link sessionAwaitingReason} gates on the session predicate.
 * @returns The normalized reason, or null when not waiting / reason unknown.
 */
export function agentAwaitingReason(agent: Agent | undefined | null): AwaitingReason | null {
  if (!agent || !isAgentAwaitingInput(agent)) return null;
  return normalizeAwaitingReason(agent.awaiting_reason);
}

// ───── Events ─────
// The raw hook/lifecycle events that everything else is aggregated from. One
// `DashboardEvent` row per ingested Claude Code hook.

/**
 * A single raw hook/lifecycle event ingested from a Claude Code session -
 * the atomic unit rendered in the ActivityFeed / SessionDetail timelines.
 * Returned by GET /api/events and /api/sessions/:id; streamed live as the
 * `new_event` WebSocket message.
 *
 * All the analytics/workflow rollups elsewhere in this file are derived by the
 * server from these rows, so an event's `event_type`/`tool_name`/`created_at`
 * are the fundamental facts everything downstream counts and groups by.
 */
export interface DashboardEvent {
  /** Autoincrement primary key (also the WS/pagination cursor). Maps to
   *  `events.id`. Monotonic, so `id > cursor` pages forward reliably. */
  id: number;
  /** Owning session's id. Maps to `events.session_id` (FK into `Session.id`). */
  session_id: string;
  /** Id of the agent that produced the event; null for session-level events
   *  emitted before any agent row exists. Maps to `events.agent_id`. */
  agent_id: string | null;
  /** Hook name, e.g. "PreToolUse", "Stop", "SessionStart", "Compaction",
   *  "TurnDuration", "APIError" - see {@link statusFromEventType} for the
   *  mapping to a UI status badge. Maps to `events.event_type`. This is the
   *  single most-grouped-by column across the analytics/workflow rollups. */
  event_type: string;
  /** Tool invoked for PreToolUse/PostToolUse events (e.g. "Bash", "Edit",
   *  or an `mcp__server__tool` name); null for non-tool events. Maps to
   *  `events.tool_name`. Example: `"mcp__github__list_issues"`. */
  tool_name: string | null;
  /** Short server-generated description shown in list rows; null when the
   *  importer had nothing more useful than the raw payload. Maps to
   *  `events.summary`. Example: `"Edited src/lib/types.ts"`. */
  summary: string | null;
  /** Opaque JSON string of the full hook payload (tool_input/tool_response,
   *  cwd, etc.) - `JSON.parse` before reading; null if the payload was empty.
   *  Maps to `events.data`. Can be large; only parsed on demand in detail views. */
  data: string | null;
  /** ISO timestamp the event was recorded (ingest time, not hook-reported time).
   *  Maps to `events.created_at`. Drives all time-bucketed charts. */
  created_at: string;
}

// ───── Overview & analytics ─────
// Aggregated read models for the dashboard header cards and the Analytics page.
// {@link Stats} is the cheap, frequently-polled counter set; {@link Analytics}
// is the richer chart-backing superset served from a separate endpoint.

/** Response shape of GET /api/stats - the lightweight counters polled for the
 *  dashboard header/overview cards. See {@link Analytics} for the richer,
 *  chart-oriented superset served from /api/analytics. */
export interface Stats {
  /** Total number of `Session` rows, all statuses. The "Sessions" header card. */
  total_sessions: number;
  /** Sessions whose `status` is "active" (not yet ended or errored). Drives the
   *  green "live sessions" indicator. */
  active_sessions: number;
  /** Agents whose `status` is "working" or "waiting". The count of agents that
   *  are still alive (not completed/errored) right now. */
  active_agents: number;
  /** Total number of `Agent` rows across all sessions (main + subagents). */
  total_agents: number;
  /** Total number of ingested `DashboardEvent` rows, all time. */
  total_events: number;
  /** Events recorded since local midnight, per the client's `tz_offset` query
   *  param (minutes offset from UTC) so "today" matches the viewer's clock. */
  events_today: number;
  /** Number of currently-open dashboard WebSocket connections on this server.
   *  A rough "how many dashboard tabs are watching" gauge. */
  ws_connections: number;
  /** Agent count keyed by `AgentStatus` value (e.g. `{ working: 3, completed: 12 }`). */
  agents_by_status: Record<string, number>;
  /** Session count keyed by `SessionStatus` value (e.g. `{ active: 2, completed: 40 }`). */
  sessions_by_status: Record<string, number>;
}

/**
 * Response shape of GET /api/analytics - aggregated token/tool/session metrics
 * that back the Analytics page's charts. A superset of {@link Stats}: `overview`
 * mirrors the same overview counters so both endpoints share the same shape
 * for the common fields.
 *
 * The `daily_*` and `*_usage`/`*_types` arrays are already sorted and bucketed
 * by the server for direct binding to charts (most-used-first, or oldest-day
 * first for the time series).
 */
export interface Analytics {
  /** Lifetime token totals across every session, by bucket. */
  tokens: {
    /** Sum of fresh (non-cached) input tokens billed as standard input. */
    total_input: number;
    /** Sum of generated output/completion tokens. */
    total_output: number;
    /** Tokens served from prompt cache reads (billed at the cheaper cache rate). */
    total_cache_read: number;
    /** Tokens written to create/extend a prompt cache entry. */
    total_cache_write: number;
  };
  /** Tool invocation counts across all events, most-used first. Backs the
   *  "top tools" bar chart. Example item: `{ tool_name: "Bash", count: 312 }`. */
  tool_usage: Array<{ tool_name: string; count: number }>;
  /** Event counts bucketed by local calendar day, for the activity chart. Each
   *  `date` is a `YYYY-MM-DD` day in the viewer's timezone; oldest first. */
  daily_events: Array<{ date: string; count: number }>;
  /** New-session counts bucketed by local calendar day (same `YYYY-MM-DD`
   *  bucketing as `daily_events`). */
  daily_sessions: Array<{ date: string; count: number }>;
  /** Subagent counts grouped by `subagent_type`. Backs the "subagent mix" chart. */
  agent_types: Array<{ subagent_type: string; count: number }>;
  /** Event counts grouped by `event_type` (e.g. PreToolUse, Stop, APIError). */
  event_types: Array<{ event_type: string; count: number }>;
  /** Mean number of events per session, across all sessions. A rough
   *  "how busy is a typical session" gauge. */
  avg_events_per_session: number;
  /** Total count of agents with `type === "subagent"` across all sessions. */
  total_subagents: number;
  /** Same overview counters as {@link Stats}, minus `events_today`/`ws_connections`. */
  overview: {
    /** Total number of `Session` rows, all statuses. */
    total_sessions: number;
    /** Sessions whose `status` is "active". */
    active_sessions: number;
    /** Agents whose `status` is "working" or "waiting". */
    active_agents: number;
    /** Total number of `Agent` rows across all sessions. */
    total_agents: number;
    /** Total number of ingested `DashboardEvent` rows. */
    total_events: number;
  };
  /** Agent count keyed by `AgentStatus` value. */
  agents_by_status: Record<string, number>;
  /** Session count keyed by `SessionStatus` value. */
  sessions_by_status: Record<string, number>;
}

// ───── Pricing & cost model ─────
// The user-editable pricing rules and the server-computed cost breakdowns they
// produce. Rates are USD per million tokens ("MTok"); computed costs are
// absolute USD. Matching is longest-`model_pattern`-wins over a bucket's model.

/**
 * A user-defined cost rule row from GET/PUT /api/pricing. Token usage is
 * matched against the longest `model_pattern` whose `%`-wildcard regex matches
 * the bucket's model id (see server/routes/pricing.js `calculateCost`); all
 * rate fields are USD per million tokens ("MTok").
 *
 * The `intro_*` fields model a time-limited promotional rate: while today is on
 * or before `intro_until`, usage prices at the intro rates; afterwards it falls
 * back to the standard rates above. The `fast_*` fields are the premium rates
 * applied when a token bucket's `speed` is "fast".
 */
export interface ModelPricing {
  /** SQL LIKE-style pattern (`%` wildcard) matched against a token bucket's
   *  model id; longer/more-specific patterns win ties. Primary key. Examples:
   *  `"claude-opus-4%"` (specific) beats `"claude-%"` (catch-all). */
  model_pattern: string;
  /** Human-readable name shown in the Settings pricing table. Example:
   *  `"Claude Opus 4"`. Purely presentational; not used for matching. */
  display_name: string;
  /** Standard rate (USD/MTok) for fresh input tokens. Example: `15` means
   *  $15 per 1,000,000 input tokens. */
  input_per_mtok: number;
  /** Standard rate (USD/MTok) for output/completion tokens. Typically several
   *  times the input rate (e.g. `75`). */
  output_per_mtok: number;
  /** Rate for tokens served from prompt-cache reads (cheaper than input, often
   *  ~10% of the input rate). Applied to a bucket's `cache_read_tokens`. */
  cache_read_per_mtok: number;
  /** Rate for tokens written to a 5-minute prompt-cache entry (a premium over
   *  fresh input). Applied to the 5-minute portion of a bucket's cache writes. */
  cache_write_per_mtok: number;
  /** Rate for tokens written to a 1-hour (extended) prompt-cache entry - a
   *  higher premium than the 5-minute rate. Applied to
   *  `CostBreakdown.cache_write_1h_tokens`. */
  cache_write_1h_per_mtok: number;
  /** Premium input rate applied when a token bucket's `speed` is "fast"; see
   *  {@link CostBreakdown.speed}. */
  fast_input_per_mtok: number;
  /** Premium output rate applied when a token bucket's `speed` is "fast". */
  fast_output_per_mtok: number;
  // Time-limited introductory rates: usage on/before intro_until (YYYY-MM-DD)
  // prices at these rates, after it at the standard rates. null/0 = no intro.
  /** Intro input rate (USD/MTok) while the promo is active; null/0 = no promo. */
  intro_input_per_mtok?: number;
  /** Intro output rate (USD/MTok) while the promo is active; null/0 = no promo. */
  intro_output_per_mtok?: number;
  /** Intro cache-read rate (USD/MTok) while the promo is active. */
  intro_cache_read_per_mtok?: number;
  /** Intro 5-minute cache-write rate (USD/MTok) while the promo is active. */
  intro_cache_write_per_mtok?: number;
  /** Intro 1-hour cache-write rate (USD/MTok) while the promo is active. */
  intro_cache_write_1h_per_mtok?: number;
  /** Last day (YYYY-MM-DD, inclusive) the intro rates apply; null/absent = no
   *  active promo, so usage always prices at the standard rates above. */
  intro_until?: string | null;
  /** ISO timestamp this rule was last created/updated. */
  updated_at: string;
}

/**
 * One row of a {@link CostResult.breakdown} - token usage and cost aggregated
 * per (model, speed, inference_geo, service_tier) tuple. Emitted by
 * `calculateCost` in server/routes/pricing.js.
 *
 * The four grouping keys (`model`, `speed`, `inference_geo`, `service_tier`)
 * together identify the pricing dimension a chunk of usage was billed under;
 * the `*_tokens`/`*_requests` counters are the usage, and `cost` is the USD
 * result of pricing that usage against `matched_rule`.
 */
export interface CostBreakdown {
  /** Model id this usage bucket was recorded under. Example: `"claude-opus-4-8"`. */
  model: string;
  /** "standard" or "fast" (premium, lower-latency) inference tier. Selects
   *  between the standard rates and {@link ModelPricing}'s `fast_*` rates. */
  speed?: string;
  /** Data-residency region the request was billed under (e.g. "us"), which
   *  applies a pricing multiplier; absent/"global" for the default region. */
  inference_geo?: string;
  /** "standard" or "batch" (discounted, async) API tier. Batch usage prices at
   *  a reduced rate. */
  service_tier?: string;
  /** Fresh (non-cached) input tokens in this bucket. Priced at the input rate. */
  input_tokens: number;
  /** Output/completion tokens in this bucket. Priced at the output rate. */
  output_tokens: number;
  /** Tokens served from prompt-cache reads in this bucket. Priced at the cheaper
   *  cache-read rate. */
  cache_read_tokens: number;
  /** Total cache-write tokens (5-minute + 1-hour splits combined). The 5-minute
   *  portion is `cache_write_tokens - (cache_write_1h_tokens ?? 0)`. */
  cache_write_tokens: number;
  /** Portion of `cache_write_tokens` written to a 1-hour cache entry, priced at
   *  the higher `ModelPricing.cache_write_1h_per_mtok` rate. */
  cache_write_1h_tokens?: number;
  /** Count of server-side web_search tool invocations in this bucket. Feeds the
   *  per-1,000-searches surcharge in {@link CostFeatureCosts.web_search_cost}. */
  web_search_requests?: number;
  /** Count of server-side web_fetch tool invocations in this bucket (currently
   *  not surcharged). */
  web_fetch_requests?: number;
  /** Count of server-side code_execution tool invocations in this bucket; feeds
   *  the container-time estimate in {@link CostFeatureCosts}. */
  code_execution_requests?: number;
  /** USD cost for this bucket (token cost + web-search surcharge). Sum of all
   *  buckets' `cost` (plus feature costs) equals {@link CostResult.total_cost}. */
  cost: number;
  /** The `ModelPricing.model_pattern` that matched, or null if no rule matched
   *  (in which case `cost` is 0 and the usage also appears in `unpriced_models`). */
  matched_rule: string | null;
}

/** Non-token surcharges layered on top of the per-bucket token cost in a
 *  {@link CostResult}: web search, web fetch, and code-execution container time.
 *  All amounts are USD; these are summed into {@link CostResult.total_cost}. */
export interface CostFeatureCosts {
  /** USD surcharge for web_search tool calls, billed per 1,000 searches. */
  web_search_cost: number;
  /** USD surcharge for web_fetch tool calls (currently always 0 - reserved). */
  web_fetch_cost: number;
  /** USD cost for code-execution container time, after the free-hours allowance. */
  code_execution_cost: number;
  /** Estimated container-hours consumed by code execution (5-min minimum/call). */
  code_execution_hours_estimated: number;
  /** Organization's free code-execution hours applied before charging. */
  code_execution_free_hours: number;
}

/** A model with recorded token usage but no matching {@link ModelPricing} rule -
 *  its cost is $0 in the totals, surfaced here so the Settings UI can prompt
 *  the user to add a pricing rule instead of silently under-reporting cost. */
export interface UnpricedModel {
  /** The model id that had usage but matched no pricing rule. The value the
   *  Settings UI suggests creating a {@link ModelPricing} rule for. */
  model: string;
  /** Fresh input tokens recorded for this unpriced model (would-be-billed). */
  input_tokens: number;
  /** Output tokens recorded for this unpriced model (would-be-billed). */
  output_tokens: number;
  /** Cache-read tokens recorded for this unpriced model. */
  cache_read_tokens: number;
  /** Cache-write tokens recorded for this unpriced model. */
  cache_write_tokens: number;
}

/** Response shape of GET /api/pricing/cost and /api/pricing/cost/:sessionId.
 *  Bundles the grand total, the per-bucket breakdown, a daily time series, and
 *  (optionally) the feature surcharges and any usage that priced at $0. */
export interface CostResult {
  /** Grand total USD cost (token cost + all feature surcharges). The headline
   *  dollar figure shown on the cost card. */
  total_cost: number;
  /** Per (model, speed, geo, tier) token/cost rows; see {@link CostBreakdown}.
   *  The detailed table that sums to `total_cost`. */
  breakdown: CostBreakdown[];
  /** Total cost per local calendar day, oldest first. Each `date` is a
   *  `YYYY-MM-DD` bucket; backs the spend-over-time line chart. */
  daily_costs: Array<{ date: string; cost: number }>;
  /** Web-search/web-fetch/code-execution surcharges; absent when none applied. */
  feature_costs?: CostFeatureCosts;
  /** Present only when at least one model had usage but no pricing rule. */
  unpriced_models?: UnpricedModel[];
}

// ───── Import progress ─────

/** Payload of the `import.progress` WebSocket message, streamed while a
 *  transcript import (default scan, path scan, or file upload) is running.
 *  A determinate progress bar can be drawn from `processed`/`total`; terminal
 *  states are `phase: "complete" | "error"`. */
export interface ImportProgressMessage {
  /** Correlates progress events to one import run; absent on terminal states
   *  emitted without a tracked run. Lets the UI ignore stray messages from a
   *  different, concurrent import. */
  importId?: string;
  /** Import lifecycle stage; "extract_error" is a non-fatal per-file failure
   *  during "extract" that doesn't abort the overall run. Normal happy path is
   *  start → scan → extract → parse → complete. */
  phase: "start" | "scan" | "extract" | "parse" | "complete" | "error" | "extract_error";
  /** Which import flow triggered this run. "default" scans the standard Claude
   *  Code projects dir; "path" scans a user-supplied path; "upload" ingests an
   *  uploaded file. */
  source?: "default" | "path" | "upload";
  /** Items processed so far, for a determinate progress bar. Numerator of
   *  `processed / total`. */
  processed?: number;
  /** Total items expected, once known (may be absent during "scan"). Denominator
   *  of the progress bar. */
  total?: number;
  /** Short label for what's currently being processed (e.g. a file name). Shown
   *  as the progress bar's caption. */
  current?: string;
  /** Filesystem path being scanned/imported, when applicable (mainly the
   *  "path"/"upload" flows). */
  path?: string;
  /** Human-readable failure message; present on "error"/"extract_error". For
   *  "extract_error" it describes a single skipped file, not a fatal abort. */
  error?: string;
  /** Running tallies (e.g. imported/skipped/errors) keyed by counter name.
   *  Example: `{ imported: 12, skipped: 3, errors: 1 }`. */
  counters?: Record<string, number>;
}

// ───── Remote source status ─────

/** Payload for `remote_source.status` WebSocket messages: a remote (SSH) data
 *  source's sync state changed (started/finished/errored, or config/deleted).
 *  The UI uses it to refresh the source list and re-fetch scoped data that a
 *  completed sync may have added. */
export interface RemoteSourceStatusPayload {
  /** The remote source id (`src_…`). */
  id: string;
  /** New status; "deleted" is emitted when the source was removed. */
  status: "idle" | "syncing" | "ok" | "error" | "deleted";
  /** Error message when `status === "error"`. */
  error?: string | null;
  /** ISO timestamp of the last successful sync, present on "ok". */
  last_sync_at?: string;
}

// ───── Session deletion ─────

/** Payload for `session_deleted` WebSocket messages: a session was
 *  permanently removed (via `DELETE /api/sessions/:id`). Consumers should
 *  drop the session from any cached list and, if it's the one currently
 *  open, navigate away. */
export interface SessionDeletedPayload {
  /** Id of the session that was deleted. */
  id: string;
}

// ───── Self-update status ─────

/** Payload for `update_status` WebSocket messages and GET /api/updates/status.
 *  Describes whether the install directory is a git clone that is behind its
 *  canonical remote, and (when it is) exactly how to bring it up to date. Many
 *  fields are optional because a non-git install reports only the bare minimum. */
export interface UpdateStatusPayload {
  /** False when the install directory isn't a git clone at all - in that case
   *  every other field except `repo_root`/`manual_command`/`message` is absent,
   *  and the UI shows a "not a git checkout" note instead of an update button. */
  git_repo: boolean;
  /** True when `local_sha` is behind `remote_sha` on the canonical remote.
   *  Drives whether the "Update available" call-to-action is shown. */
  update_available: boolean;
  /** Absolute path to the detected git repository root. Example:
   *  `"/Users/dev/Claude-Code-Agent-Monitor"`. */
  repo_root?: string;
  /** Resolved ref compared against, e.g. "upstream/master" or "origin/main";
   *  null when no remote could be resolved (e.g. no remotes configured). */
  remote_ref?: string | null;
  /** Remote name we compared against - "upstream" if configured (fork
   * convention), else "origin", else whatever single remote is set up. */
  canonical_remote?: string | null;
  /** Local branch HEAD points at. null on detached HEAD. */
  current_branch?: string | null;
  /** What the local branch tracks (e.g. "origin/feature/foo"). null when
   * no upstream is configured for the current branch. */
  tracking_upstream?: string | null;
  /** True when the local branch's tracked upstream is exactly remote_ref
   * - i.e. a plain `git pull --ff-only` will do the right thing. */
  tracks_canonical?: boolean;
  /** Categorical hint for the UI. Discriminated so callers can branch on
   * shape (e.g. show "Restart after running" only when the command
   * actually rewrites the working tree). */
  situation?:
    | "tracking_canonical"
    | "fork_or_diverged_tracking"
    | "feature_branch"
    | "detached_head";
  /** Plain-language explanation when the user is *not* on the canonical
   * default branch, so the manual command makes sense in context. */
  situation_note?: string | null;
  /** Local HEAD commit SHA; null when it couldn't be resolved. Compared against
   *  `remote_sha` to decide `update_available`. Example: `"6f96383"` (short) or
   *  the full 40-char hash. */
  local_sha?: string | null;
  /** Remote-ref commit SHA; null when it couldn't be resolved. The tip of
   *  `remote_ref` we'd fast-forward to. */
  remote_sha?: string | null;
  /** Number of commits the local branch trails behind `remote_sha`. 0 means
   *  up to date; > 0 drives the "N commits behind" badge. */
  commits_behind?: number;
  /** Shell command the user can copy/run to update manually (`git pull`,
   *  `git fetch && git merge`, etc., chosen based on `situation`). */
  manual_command?: string | null;
  /** Human-readable status line shown in the Settings "Updates" panel. */
  message?: string | null;
  /** Set instead of a normal result when the remote fetch itself failed
   *  (e.g. offline) - the message text explains it in user-facing terms. */
  fetch_error?: string;
}

// ───── Interactive run streaming ─────
// Payloads for the "run a `claude` process from the dashboard" feature. A run is
// started via POST /api/run and identified by a `RunHandle` id; the server then
// streams stdout envelopes, status transitions, and stdin acks back over the WS.

/** Payload for the `run_stream` WebSocket message: one streamed JSON envelope
 *  from a headless/conversation `claude` process started via POST /api/run. */
export interface RunStreamPayload {
  /** Id of the `RunHandle` this envelope belongs to. Lets the UI route the chunk
   *  to the right run panel when several runs stream at once. */
  id: string;
  /** Raw stream-json envelope emitted by the Claude Code CLI (assistant text
   *  deltas, tool_use/tool_result blocks, etc.) - shape varies by event type.
   *  Typed as `unknown` because it's forwarded verbatim and narrowed at render. */
  envelope: unknown;
}
/** Payload for the `run_status` WebSocket message: a lifecycle transition for
 *  a run started via POST /api/run (mirrors `RunHandle.status`). */
export interface RunStatusPayload {
  /** Id of the `RunHandle` whose status changed. */
  id: string;
  /** New run lifecycle state; terminal states are "completed"/"error"/"killed".
   *  "spawning" → the child is being started; "running" → streaming output;
   *  "killed" → the run was cancelled by the user. */
  status: "spawning" | "running" | "completed" | "error" | "killed";
  /** Epoch-ms timestamp of this status transition (NOT an ISO string, unlike
   *  most timestamps in this file). */
  at: number;
  /** Process exit code; present once status reaches "completed"/"error". 0 means
   *  a clean exit. */
  exitCode?: number;
  /** Claude Code session id resumed/created by this run, once known. Lets the UI
   *  link a run to the {@link Session} it produced. */
  sessionId?: string | null;
  /** Failure message; present when status is "error". Surfaced in the run panel. */
  error?: string;
}
/** Payload for the `run_input_ack` WebSocket message: confirms a message sent
 *  via POST /api/run/:id/message was written to the child process's stdin. */
export interface RunInputAckPayload {
  /** Id of the `RunHandle` the input was delivered to. */
  id: string;
  /** Echoes the id returned by the `send` call this acks, so the UI can clear
   *  the matching "sending…" pending state. */
  messageId: string;
  /** Epoch-ms timestamp the input was delivered (not an ISO string). */
  at: number;
}

// ───── Claude Code config change notifications ─────

/** Payload for the `cc_config_changed` WebSocket message: broadcast whenever a
 *  Claude Code config artifact (skill, agent, command, settings, memory, …) is
 *  written or deleted, either through the dashboard's cc-config editor or by
 *  an on-disk filesystem watcher, so other open tabs can refresh their view. */
export interface CcConfigChangedPayload {
  /** Whether the dashboard itself made the write, or an fs watcher observed
   *  an external change (e.g. the user editing a file directly). */
  source: "dashboard" | "fs";
  /** Mutation kind; absent for some fs-watcher events that only report scope. */
  action?: "write" | "delete";
  /** "user" (~/.claude) or "project" (repo's .claude) config root affected.
   *  Lets a listening tab decide whether the change is relevant to its view. */
  scope?: "user" | "project";
  /** Artifact kind, e.g. "skills", "agents", "commands", "settings", "memory".
   *  Selects which cc-config panel should refresh. */
  type?: string;
  /** Artifact name (e.g. skill/agent name); null/absent for whole-file events
   *  (like a settings.json save that isn't scoped to one named artifact). */
  name?: string | null;
  /** Absolute file paths touched by this change, when known. Example:
   *  `["/Users/dev/.claude/skills/foo/SKILL.md"]`. */
  paths?: string[];
}

// ───── Alerting ─────
// User-defined rules that watch the ingest stream (or a periodic sweep) and fire
// {@link AlertEvent}s. {@link AlertRuleConfig} is a tagged bag of settings whose
// applicable fields depend on the parent rule's {@link AlertRuleType}.

/** Kind of condition an {@link AlertRule} evaluates. "event_pattern" and
 *  "token_threshold" are checked on every hook ingest; "inactivity" and
 *  "status_duration" are checked on a periodic server-side sweep. */
export type AlertRuleType = "event_pattern" | "inactivity" | "status_duration" | "token_threshold";

/**
 * Rule-type-specific settings for an {@link AlertRule}. Which fields apply
 * depends on `rule_type` (validated server-side by `validateRuleConfig` in
 * server/lib/alerts.js) - the others are simply absent/ignored:
 *  - event_pattern: `event_type`/`tool_name`/`summary_contains` (at least one
 *    required) plus `count`/`window_minutes` for "N times in M minutes".
 *  - inactivity: `minutes` of session silence before firing.
 *  - status_duration: `status` held continuously for `minutes`.
 *  - token_threshold: cumulative `total_tokens` for a session.
 */
export interface AlertRuleConfig {
  /** event_pattern: exact `DashboardEvent.event_type` to match. */
  event_type?: string;
  /** event_pattern: exact `DashboardEvent.tool_name` to match. */
  tool_name?: string;
  /** event_pattern: substring the event's `summary` must contain. */
  summary_contains?: string;
  /** event_pattern: number of matches required within `window_minutes`
   *  (default 1, meaning "fire on the first match"). */
  count?: number;
  /** event_pattern: sliding window (minutes) `count` is measured over;
   *  only meaningful when `count` > 1 (default 5). */
  window_minutes?: number;
  /** inactivity: minutes of silence before firing. status_duration: minutes
   *  `status` must be held continuously before firing. */
  minutes?: number;
  /** status_duration: the agent status to watch for. */
  status?: "working" | "waiting";
  /** token_threshold: cumulative token count that triggers the alert. */
  total_tokens?: number;
}

/** A user-defined alert rule from GET/POST/PATCH /api/alerts/rules. Couples a
 *  {@link AlertRuleType} with its {@link AlertRuleConfig}, an on/off switch, and
 *  a per-scope cooldown to avoid re-firing on every matching event. */
export interface AlertRule {
  /** Rule id (primary key). Example: `"rule_inactivity_30m"`. */
  id: string;
  /** User-assigned display name for the rule. Example: `"Idle > 30 min"`. */
  name: string;
  /** Which condition family this rule evaluates; see {@link AlertRuleType}.
   *  Determines which fields of `config` are meaningful. */
  rule_type: AlertRuleType;
  /** The parsed, type-specific settings for the rule; see {@link AlertRuleConfig}.
   *  Already deserialized (unlike the opaque JSON string columns elsewhere). */
  config: AlertRuleConfig;
  /** Whether the rule is evaluated at all; disabled rules never fire but are
   *  kept for later re-enabling. */
  enabled: boolean;
  /** Minimum seconds between two firings of this rule for the same
   *  session/agent scope, to avoid spamming on repeated matches. Example:
   *  `300` = at most one alert every 5 minutes per session. */
  cooldown_seconds: number;
  /** ISO timestamp the rule was created. */
  created_at: string;
  /** ISO timestamp the rule was last updated. */
  updated_at: string;
}

/** One firing of an {@link AlertRule}, from GET /api/alerts; pushed live via
 *  the `alert_triggered` (new) / `alert_updated` (acknowledged) WS messages.
 *  Denormalizes the rule's name/type at fire time so the row still renders even
 *  after the originating rule is renamed or deleted. */
export interface AlertEvent {
  /** Alert-event id (autoincrement primary key). */
  id: number;
  /** Rule that fired (foreign key into `AlertRule.id`). */
  rule_id: string;
  /** Denormalized copy of the rule's name at fire time, for display even if
   *  the rule is later renamed or deleted. */
  rule_name: string;
  /** Denormalized copy of the rule's type at fire time; see {@link AlertRuleType}. */
  rule_type: AlertRuleType;
  /** Session the alert pertains to; null for rules with no session scope. FK
   *  into `Session.id` when set. */
  session_id: string | null;
  /** Agent the alert pertains to; null when not agent-specific. FK into
   *  `Agent.id` when set. */
  agent_id: string | null;
  /** Human-readable description of what triggered the alert. Example:
   *  `"Session idle for 32 minutes"`. */
  message: string;
  /** Opaque JSON string with extra context (matched event, thresholds); may
   *  be null. Parse before use (`JSON.parse`). */
  details: string | null;
  /** ISO timestamp the alert fired. Sort key for the alerts list (newest first). */
  triggered_at: string;
  /** ISO timestamp the user acknowledged it; null while unacknowledged. The
   *  `alert_updated` WS message flips this from null to a timestamp. */
  acknowledged_at: string | null;
}

// ───── Projects ─────
// A user-named grouping of one or more session working directories (cwd).
// There is no project_id on Session - membership is derived server-side by
// joining Session.cwd against ProjectPath.cwd, so this is a label layer over
// existing session data rather than a new session relationship.

/** One folder mapped onto a {@link Project}. A cwd belongs to at most one
 *  project; a project may claim many folders. */
export interface ProjectPath {
  /** Mapping row id (primary key), used to remove this specific mapping. */
  id: number;
  /** Absolute working-directory path this project claims. Example:
   *  `"/Users/dev/my-repo"`. */
  cwd: string;
}

/** A named grouping of folders, from GET /api/projects. Session/active counts
 *  and last_activity are aggregated server-side across every mapped folder. */
export interface Project {
  /** Project id (primary key). */
  id: string;
  /** User-assigned display name. Example: `"Agent Monitor"`. */
  name: string;
  /** Folders (cwds) currently mapped to this project. */
  paths: ProjectPath[];
  /** Total sessions across every mapped folder. */
  session_count: number;
  /** Sessions currently `active` across every mapped folder. */
  active_count: number;
  /** ISO timestamp of the most recent session update across every mapped
   *  folder; null when the project has no sessions yet. */
  last_activity: string | null;
  /** ISO timestamp the project was created. */
  created_at: string;
  /** ISO timestamp the project was last renamed. */
  updated_at: string;
}

/** Sessions whose cwd isn't mapped to any {@link Project} yet, from GET
 *  /api/projects (`unassigned`). Lets the UI surface a "create a project from
 *  this folder" affordance instead of silently dropping unmapped sessions. */
export interface UnassignedProjectBucket {
  /** Distinct cwds with sessions that aren't part of any project. */
  cwds: string[];
  /** Total sessions across every unmapped folder. */
  session_count: number;
  /** Sessions currently `active` across every unmapped folder. */
  active_count: number;
  /** ISO timestamp of the most recent session update across every unmapped
   *  folder; null when there are none. */
  last_activity: string | null;
}

/** One interval where a single {@link FocusKind} was continuously current
 *  for a session, from GET /api/projects/:id/focus-report. `item_number` is
 *  the item that was current when the segment started — for a detour this
 *  is its "prior_item" (the same concept PlanModal buckets detours under),
 *  not necessarily the item current when the segment ends. Its `kind` is
 *  widened to {@link FocusSegmentKind}: a session with no declared focus AND
 *  no usable background-classifier verdict gets one whole-session `"none"`
 *  segment (see server/lib/focus-report.js's `noFocusSegment`) instead of
 *  being dropped from the report — `"none"` is a report-only sentinel, never
 *  a value {@link focusKind} returns for a session's *live* current focus. */
export interface FocusReportSegment {
  kind: FocusSegmentKind;
  item_number: number | null;
  /** The item's text snapshot (item kind) or the detour's title/description
   *  (detour/feature/bug kind) at declaration time. */
  label: string | null;
  /** ISO timestamp the segment opened. */
  start: string;
  /** ISO timestamp the segment closed (or "now"/session end if still open). */
  end: string;
  /** Raw wall-clock span of the segment, in milliseconds. */
  wall_ms: number;
  /** Wall-clock minus idle time discounted by the
   *  `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS` grace window. */
  active_ms: number;
  /** The portion of `wall_ms` excluded as idle (no hook activity for longer
   *  than the grace window). */
  idle_ms: number;
  /** True when this segment came from the background classifier (a session
   *  that never declared a focus, attributed after the fact from its
   *  activity) rather than from a real `ccam focus` declaration. */
  inferred: boolean;
  /** The classifier's one-sentence justification for this attribution
   *  (`focus_inferences.reason`), or null. Only ever set when `inferred` is
   *  true. */
  inferred_reason: string | null;
  /** The segment's span sliced into fixed 10-minute windows, each flagged
   *  `active` if at least one real hook event landed inside it — a plainer,
   *  non-grace-discounted fact than `active_ms`/`idle_ms` above, meant for
   *  coloring a calendar block's actually-quiet stretches differently from
   *  its actually-worked ones (FocusCalendarView). Optional in the type
   *  (always sent by the server) so older-shaped fixtures/data don't need to
   *  fabricate it; consumers treat a missing value as "no breakdown". See
   *  server/lib/focus-report.js's buildActivityChunks(). */
  chunks?: FocusReportChunk[];
}

/** One fixed-width slice of a {@link FocusReportSegment}'s span. */
export interface FocusReportChunk {
  start: string;
  end: string;
  active: boolean;
}

/** Wall/active/idle milliseconds, broken out per {@link FocusKind} plus a
 *  combined total — the shape reused for both a single item's rollup and
 *  the project-wide totals in a focus-time report. */
export interface FocusKindTotals {
  wall_ms: number;
  active_ms: number;
  idle_ms: number;
  by_kind: Record<FocusKind, { wall_ms: number; active_ms: number; idle_ms: number }>;
}

/** One session's segments in a focus-time report. Sessions that never
 *  declared any focus fall back to the background classifier's verdict
 *  (segments flagged `inferred`); those with neither still get one `"none"`-
 *  kind segment spanning the whole session (see {@link FocusReportSegment})
 *  rather than being omitted — a currently-running session that hasn't
 *  declared a focus yet and hasn't gone quiet long enough to be classified
 *  would otherwise be invisible on the calendar/list until one of those
 *  happens. */
export interface FocusReportSessionEntry {
  session_id: string;
  name: string | null;
  cwd: string | null;
  /** `null` while the session is still active/waiting. Lets a calendar/
   *  timeline view tell "genuinely still running" apart from "just happened
   *  to end near when the report was fetched" — both look identical from
   *  segment timestamps alone. */
  ended_at: string | null;
  segments: FocusReportSegment[];
}

/** One plan item's rollup in a focus-time report: its own declared-item time
 *  plus any detour time logged under it (bucketed by the detour's own
 *  `item_number`, i.e. its prior_item). */
export interface FocusReportItemEntry {
  cwd: string;
  item_number: number;
  /** The plan item's CURRENT text (not a historical snapshot), null if the
   *  item no longer exists in the plan. */
  text: string | null;
  totals: FocusKindTotals;
}

/** GET /api/projects/:id/focus-report — a project-scoped focus-time
 *  breakdown: reconstructed from the project's sessions' `Focus` event
 *  history, not a new capture mechanism. See server/lib/focus-report.js.
 *  Also reused, widened, by the new `GET /api/focus-report` aggregate
 *  endpoint (client/src/lib/api.ts `focusReport()`), whose response echoes
 *  back the resolved `project_id`/`session_id` filters (`null` when
 *  unfiltered/not applicable) rather than always carrying a project id. */
export interface FocusReport {
  project_id: string | null;
  /** Echoed back by the new aggregate `GET /api/focus-report` endpoint when
   *  scoped to a single session (`null` when unfiltered/not applicable).
   *  Optional because the old, single-project
   *  `GET /api/projects/:id/focus-report` route's body has no `session_id`
   *  key at all - this field is only ever populated by the new route. */
  session_id?: string | null;
  sessions: FocusReportSessionEntry[];
  items: FocusReportItemEntry[];
  totals: FocusKindTotals;
  /** The `DASHBOARD_FOCUS_IDLE_GRACE_SECONDS` value this report was computed
   *  with, so the UI can label what "active" means. */
  idle_grace_seconds: number;
  /** Calendar time during which at least one session was running — the
   *  union of every session's own span (first segment start to last segment
   *  end), NOT a sum. Sessions running concurrently collapse into shared
   *  wall-clock coverage instead of stacking, unlike `totals.active_ms`
   *  (effort — the plain per-session sum, which DOES inflate with
   *  concurrency). See server/lib/focus-report.js's `mergeIntervals`. */
  wall_clock_ms: number;
  /** `totals.active_ms / wall_clock_ms` — how many sessions' worth of effort
   *  landed in each hour of wall-clock time on average. `1` means no
   *  overlap; `null` when `wall_clock_ms` is `0` (nothing to divide by). */
  concurrency_ratio: number | null;
  /** Calendar time during which at least one session was actually ACTIVE —
   *  the union of every session's grace-credited active intervals (the same
   *  per-gap credit `active_ms` sums, kept positioned and merged). Unlike
   *  `wall_clock_ms`, an open-but-silent session (left running overnight)
   *  does NOT extend this. Optional: only reports from servers that compute
   *  it carry the field. See server/lib/focus-report.js. */
  active_wall_clock_ms?: number;
  /** `totals.active_ms / active_wall_clock_ms` — how parallel the work was
   *  while work was actually happening. Always >= 1 when non-null (every
   *  active millisecond lies inside the denominator's union); `null` when
   *  `active_wall_clock_ms` is `0`. Optional, same as
   *  {@link FocusReport.active_wall_clock_ms}. */
  active_concurrency_ratio?: number | null;
}

/** One project's share of a {@link FocusWindowSummary}: the window's
 *  stakeholder-readable bullets for that project's sessions alone. A scoped
 *  request yields exactly one group; the all-projects scope yields one per
 *  project with activity (plus an Unassigned group — `project_id`/`name`
 *  both `null` — for sessions in unmapped folders), ordered largest
 *  wall-clock share first. */
export interface FocusSummaryGroup {
  project_id: string | null;
  project_name: string | null;
  /** The group's merged wall-clock coverage in the window (sort key). */
  wall_clock_ms: number;
  /** Plain-language "what we actually did" bullets (2-8, scaling with the
   *  window's day span server-side). */
  bullets: string[];
  /** ISO timestamp of when this group's summary was synthesized. */
  generated_at: string;
  /** True when served from the server-side digest-gated cache rather than
   *  freshly generated for this request. */
  cached: boolean;
  /** The `claude -p` model that produced it (e.g. "haiku"), `null` unknown. */
  model: string | null;
}

/** `GET /api/focus-report/summary` — the stakeholder-readable LLM synthesis
 *  of a focus-report window (server/lib/focus-summary.js), grouped by
 *  project. The response wraps this as `{ summary: FocusWindowSummary |
 *  null }`; `null` (still a 200) means no group could be summarized — LLM
 *  path disabled/unavailable, empty window, or generation failure — and
 *  callers hide the block rather than showing an error. */
export interface FocusWindowSummary {
  /** Per-project summaries, largest wall-clock share first — never empty
   *  (an empty result is `summary: null` instead). */
  groups: FocusSummaryGroup[];
}

// ───── Plans & session focus ─────
// A monitored repo may keep a human-approved plan at `<cwd>/AGENT-PLAN.md`
// (numbered checkbox items). The server mirrors it read-only into per-cwd
// Plan records; sessions declare which item they are serving (plus detours)
// via `ccam focus …`, and a background auditor stamps a drift verdict. The
// file stays the source of truth — the dashboard never writes it.

/** One numbered checkbox item of a {@link Plan}, from the plans endpoints. */
export interface PlanItem {
  /** Owning working directory (plan key). */
  cwd: string;
  /** Permanent identity (from the file's `id:` line, or synthesized for
   *  pre-id files) — never changes for the life of the item, unlike
   *  item_number. */
  item_id: string;
  /** Flat display number, positional — recomputed from file order on every
   *  ingest. What focus declarations are typed against, but item_id is
   *  what's actually persisted underneath. Null for a sub-item (see
   *  parent_item_id) — it has no flat number, so ccam can't target it
   *  directly; use display_number for rendering instead. */
  item_number: number | null;
  /** The parent item's item_id when this is a sub-item (a dotted "N.M" item
   *  nested under top-level item N in the file). Null for a top-level item. */
  parent_item_id: string | null;
  /** Human-facing number: item_number as a string for a top-level item
   *  ("3"), or "<parent's number>.<sibling ordinal>" for a sub-item ("3.2").
   *  Always derived server-side, never persisted. */
  display_number: string;
  /** Item text (without the checkbox/number prefix). */
  text: string;
  /** Optional acceptance note split from `— acceptance: …`. */
  acceptance: string | null;
  /** Optional unbounded supporting context beyond the one-line summary,
   *  from an indented `detail:` block. */
  detail: string | null;
  /** 1 when the file's checkbox is `[x]` (human-owned completion). */
  checked: number;
  /** File order; numbering need not be contiguous. */
  position: number;
  /** ISO timestamp an agent declared this item done (`ccam focus done N`);
   *  survives file re-ingest. Null until claimed. */
  declared_done_at: string | null;
  /** Session id that made the declared-done claim. */
  declared_done_session: string | null;
  /** ISO timestamp of the last ingest that touched this row. */
  updated_at: string;
}

/** A per-cwd plan mirrored from AGENT-PLAN.md, from GET /api/plans. */
export interface Plan {
  /** Absolute working directory the plan belongs to (primary key). */
  cwd: string;
  /** First markdown heading of the file; null when the file has none. */
  title: string | null;
  /** Absolute path of the ingested AGENT-PLAN.md. */
  file_path: string;
  /** Number of parsed items. */
  item_count: number;
  /** ISO timestamp the file was found missing (row is kept); null while
   *  present. */
  missing_at: string | null;
  /** ISO timestamp of first ingest. */
  created_at: string;
  /** ISO timestamp of last ingest. */
  updated_at: string;
  /** Items, present on list/for-cwd/rollup responses. */
  items: PlanItem[];
}

/** Classifies a {@link DetourFrame} pushed via `ccam focus bug`/`feature`
 *  instead of a plain `ccam focus push`. Absent on ordinary detours. */
export type DetourKind = "bug" | "feature";

/** One in-flight detour on a session's focus stack. */
export interface DetourFrame {
  /** What pulled the session away (e.g. `"npm module conflict"`); doubles as
   *  the one-sentence summary for bug/feature detours. */
  description: string;
  /** ISO timestamp the detour was pushed. */
  pushed_at: string;
  /** The plan item that was current when the detour began; null if none -
   *  the plan UI buckets these under "Unknown". */
  prior_item: number | null;
  /** Set only for `ccam focus bug`/`feature` declarations; absent on plain
   *  detours (which render exactly as before, with no badge). */
  kind?: DetourKind;
  /** Short (~1-2 word) label shown on the badge, from `ccam focus bug/feature
   *  "<title>" ...`. Only present alongside `kind`. */
  title?: string;
  /** Longer freeform detail shown when the badge is expanded, from the
   *  optional `--detail "<text>"` flag. Falls back to `description` in the
   *  UI when absent. */
  detail?: string;
}

/** One focus timeline entry, rebuilt from the session's `Focus` events by
 *  GET /api/sessions/:id/focus. */
export interface FocusHistoryEntry {
  /** ISO timestamp of the declaration. */
  at: string;
  /** Entry class: item declarations vs detour push/pop. */
  kind: "item" | "detour_push" | "detour_pop";
  /** Raw verb (`set` | `push` | `pop` | `done`), when recorded. */
  verb: string | null;
  /** Target plan item for set/done entries. */
  item_number: number | null;
  /** Human line: detour description or item-text snapshot (immune to later
   *  plan renumbering). */
  text: string;
}

/** A session's declared focus in wire shape, from GET /api/focus (bulk),
 *  GET /api/sessions/:id/focus, and `session_focus` WebSocket pushes. */
export interface SessionFocus {
  /** Owning session id. */
  session_id: string;
  /** The session's cwd at declaration time (plan join key). */
  cwd: string | null;
  /** Declared plan item number; null when only detours (or nothing) are
   *  declared. */
  item_number: number | null;
  /** The declared item's current text, joined server-side; null when the
   *  item isn't in the ingested plan. */
  item_text: string | null;
  /** Optional free-text note from `ccam focus set N <note>`. */
  note: string | null;
  /** In-flight detours, oldest first (top of stack = last element). */
  detour_stack: DetourFrame[];
  /** ISO timestamp the current item was declared; null when none. */
  since: string | null;
  /** Drift verdict folded to a tri-state: true = possible drift, false = on
   *  track, null = not audited yet. Written only by the drift auditor. */
  drift: boolean | null;
  /** One-line auditor reasoning for the verdict. */
  drift_reason: string | null;
  /** ISO timestamp of the last focus state change. */
  updated_at: string;
}

/** One entry of a session's latest TodoWrite list, from
 *  GET /api/sessions/:id/todos (parse-on-read of the events table). */
export interface SessionTodo {
  /** Imperative task text. */
  content: string;
  /** TodoWrite status. */
  status: "pending" | "in_progress" | "completed";
  /** Present-continuous spinner form, when the tool supplied one. */
  activeForm?: string;
}

// ───── Webhooks ─────
// Outbound delivery of alerts to chat/incident/automation providers. The
// provider catalog ({@link WebhookProvider}/{@link WebhookProviderField}) drives
// the "Add webhook" form; {@link WebhookTarget} is a saved destination; the
// {@link WebhookDelivery}* types record and summarize send attempts. Secrets are
// always masked on the wire.

/** Supported outbound webhook provider ids, from GET /api/webhooks/providers.
 *  "generic" is a bare HTTP POST for anything not natively supported. */
export type WebhookType =
  | "slack"
  | "discord"
  | "teams"
  | "google_chat"
  | "mattermost"
  | "rocketchat"
  | "telegram"
  | "pagerduty"
  | "opsgenie"
  | "splunk_oncall"
  | "zapier"
  | "make"
  | "n8n"
  | "pipedream"
  | "generic";

/** One provider-specific config field the "Add webhook" form should render
 *  for a given {@link WebhookProvider} (e.g. Telegram's chat_id, PagerDuty's
 *  routing_key). Declared server-side in server/lib/webhook-providers.js. */
export interface WebhookProviderField {
  /** Key this value is stored/sent under in `WebhookTarget.config`. Example:
   *  `"chat_id"` for Telegram, `"routing_key"` for PagerDuty. */
  key: string;
  /** Form label shown next to the input. Example: `"Chat ID"`. */
  label: string;
  /** Whether the value should be masked in the UI and redacted by the API (used
   *  for tokens/keys). */
  secret: boolean;
  /** Whether the target can't be saved without this field (form validation). */
  required: boolean;
  /** Render as a free-text input or a fixed dropdown (`options`). */
  type: "string" | "enum";
  /** Choices for `type === "enum"`; null otherwise. */
  options: string[] | null;
  /** Pre-filled value for a new target; null when there's no sensible default. */
  default: string | null;
}

/** Redacted, serializable metadata for one webhook provider, from GET
 *  /api/webhooks/providers - drives the "Add webhook" form without exposing
 *  server-internal formatter/auth logic. */
export interface WebhookProvider {
  /** Stable provider id; see {@link WebhookType}. The key the form submits back. */
  type: WebhookType;
  /** Human-readable provider name shown in the picker. Example: `"Slack"`. */
  label: string;
  /** "chat" (Slack/Discord/Teams-style), "api" (PagerDuty/Opsgenie/Splunk),
   *  or "generic" (bare POST) - determines which extra options apply below. */
  family: "chat" | "api" | "generic";
  /** Whether the user must supply a URL (false when the URL is derived from
   *  `config`, like Telegram's bot token, or a fixed default is used). */
  url_required: boolean;
  /** Whether the provider ships a built-in default URL. */
  has_default_url: boolean;
  /** Whether the URL is computed from `config` rather than entered directly. */
  derives_url: boolean;
  /** Whether a plain http:// URL is accepted (some local/dev integrations). */
  allow_http: boolean;
  /** Placeholder/help text shown under the URL field; null if none. */
  url_hint: string | null;
  /** Whether this provider's requests can be HMAC-signed with a shared secret
   *  (generic family only). */
  supports_secret: boolean;
  /** Whether custom HTTP headers can be attached (generic family only). */
  supports_headers: boolean;
  /** The provider-specific config fields to render on the form; see
   *  {@link WebhookProviderField}. */
  fields: WebhookProviderField[];
}

/** Compact summary of a target's most recent delivery attempt, embedded in
 *  {@link WebhookTarget.last_delivery} for the targets list view. */
export interface WebhookDeliverySummary {
  /** Whether the most recent send succeeded (2xx) or failed. Drives the green/
   *  red delivery indicator on the targets list. */
  status: "success" | "failed";
  /** HTTP status code returned by the endpoint; null on a transport-level
   *  failure (DNS, timeout, connection refused) before any response arrived. */
  status_code: number | null;
  /** Number of send attempts made (including retries) for this delivery. > 1
   *  means the first attempt(s) failed and were retried. */
  attempts: number;
  /** Failure reason when `status` is "failed"; null on success. */
  error: string | null;
  /** ISO timestamp of this delivery attempt (its "when"). */
  created_at: string;
}

/** A configured outbound webhook destination, from GET/POST/PATCH /api/webhooks.
 *  Secrets are never returned by the API - `url_preview` masks the URL and
 *  `headers`/`config` mask any field flagged `secret` in the provider schema. */
export interface WebhookTarget {
  /** Target id (primary key). */
  id: string;
  /** User-assigned label for this target. Example: `"Team Slack #alerts"`. */
  name: string;
  /** Provider this target delivers to; see {@link WebhookType}. Governs which
   *  `config` fields are expected and how the payload is formatted. */
  type: WebhookType;
  /** Whether alerts matching `rule_ids` are actually delivered here. Disabled
   *  targets are kept but skipped during fan-out. */
  enabled: boolean;
  /** Masked: host + last 4 chars. The full URL is never returned by the API.
   *  Example: `"hooks.slack.com/…AbCd"`. */
  url_preview: string;
  /** Whether a signing secret is configured (its value is never returned). */
  has_secret: boolean;
  /** Generic targets only; values are masked ("••••"). */
  headers: Record<string, string> | null;
  /** Provider config (Telegram chat_id, PagerDuty routing_key, …); secret values masked. */
  config: Record<string, string> | null;
  /** Rule ids this target is scoped to; null = all rules. */
  rule_ids: string[] | null;
  /** ISO timestamp the target was created. */
  created_at: string;
  /** ISO timestamp the target was last updated. */
  updated_at: string;
  /** Outcome of the most recent delivery attempt; null if never delivered. */
  last_delivery: WebhookDeliverySummary | null;
}

/** One row of a target's delivery log, from GET /api/webhooks/:id/deliveries.
 *  A persisted, per-attempt record (unlike {@link WebhookTestResult}, which is
 *  the ephemeral result of a manual test send). */
export interface WebhookDelivery {
  /** Delivery-log row id (autoincrement primary key). */
  id: number;
  /** Owning target's id (foreign key into `WebhookTarget.id`). */
  target_id: string;
  /** Denormalized target name at delivery time, for display after renames/deletes. */
  target_name: string;
  /** Denormalized target provider at delivery time; see {@link WebhookType}. */
  target_type: WebhookType;
  /** The `AlertEvent.id` that triggered this delivery; null for manual test
   *  sends (which don't originate from a fired alert). */
  alert_id: number | null;
  /** Whether this delivery succeeded or failed. */
  status: "success" | "failed";
  /** HTTP status code returned; null on a transport-level failure. */
  status_code: number | null;
  /** Number of send attempts made (including retries) for this delivery. */
  attempts: number;
  /** Failure reason when `status` is "failed"; null on success. */
  error: string | null;
  /** ISO timestamp of this delivery (sort key for the delivery log). */
  created_at: string;
}

/** Result of POST /api/webhooks/:id/test - a synchronous one-shot delivery
 *  probe used by the "Send test" button, not persisted to the delivery log. */
export interface WebhookTestResult {
  /** Whether the endpoint accepted the test payload (2xx response). Renders the
   *  green check / red x next to the "Send test" button. */
  ok: boolean;
  /** HTTP status code returned; null on a transport-level failure (DNS, timeout,
   *  connection refused). */
  status: number | null;
  /** Number of send attempts made during the probe (including any retries). */
  attempts: number;
  /** Failure reason when `ok` is false; null on success. */
  error: string | null;
}

// ───── WebSocket envelope ─────

/** Payload for `plan_updated` WebSocket messages: a re-ingested AGENT-PLAN.md
 *  (whole-plan replacement — small by design, item caps keep it well under the
 *  socket's payload limit). */
export interface PlanUpdatedPayload {
  /** The updated plan row (without `items` — they ride alongside). */
  plan: Omit<Plan, "items">;
  /** The plan's full current item list. */
  items: PlanItem[];
}

/**
 * Envelope for every message the server pushes over the dashboard WebSocket
 * (see `server/websocket.js` `broadcast()`). Consumed by {@link eventBus} and
 * `useWebSocket`; `type` discriminates the shape of `data`.
 *
 * This is a hand-maintained discriminated union: each `type` string pairs with
 * exactly one member of the `data` union (see the `type` field's doc comment
 * for the full mapping). Because live UI tabs may outlive a server upgrade, the
 * set of `type` values must only ever grow - never rename or repurpose one.
 */
export interface WSMessage {
  /** Discriminant selecting which member of the `data` union applies:
   *  session_created/updated → Session; session_deleted → SessionDeletedPayload;
   *  agent_created/updated → Agent; new_event → DashboardEvent;
   *  import.progress → ImportProgressMessage; update_status → UpdateStatusPayload;
   *  run_stream/run_status/run_input_ack → their matching Run*Payload;
   *  cc_config_changed → CcConfigChangedPayload; alert_triggered/alert_updated
   *  → AlertEvent; workflow_upserted → WorkflowRun; plan_updated →
   *  PlanUpdatedPayload; session_focus → SessionFocus. */
  type:
    | "session_created"
    | "session_updated"
    | "session_deleted"
    | "agent_created"
    | "agent_updated"
    | "new_event"
    | "import.progress"
    | "update_status"
    | "run_stream"
    | "run_status"
    | "run_input_ack"
    | "cc_config_changed"
    | "alert_triggered"
    | "alert_updated"
    | "workflow_upserted"
    | "remote_source.status"
    | "plan_updated"
    | "session_focus";
  /** The message body, whose concrete shape is selected by `type` above. */
  data:
    | Session
    | SessionDeletedPayload
    | Agent
    | DashboardEvent
    | ImportProgressMessage
    | UpdateStatusPayload
    | RunStreamPayload
    | RunStatusPayload
    | RunInputAckPayload
    | CcConfigChangedPayload
    | AlertEvent
    | WorkflowRun
    | RemoteSourceStatusPayload
    | PlanUpdatedPayload
    | SessionFocus;
  /** ISO timestamp the server broadcast this message (not necessarily the
   *  same instant the underlying event occurred). */
  timestamp: string;
}

// ───── Session stats ─────

/** Response shape of GET /api/sessions/:id/stats - per-session rollups shown
 *  on the SessionDetail page's stats cards and charts. A single-session analog
 *  of {@link Analytics}, scoped to one session's events/agents/tokens. */
export interface SessionStats {
  /** Id of the session these rollups describe (FK into `Session.id`). */
  session_id: string;
  /** Total events recorded for this session (the sum of `events_by_type`). */
  total_events: number;
  /** Event counts grouped by `event_type`, scoped to this session. */
  events_by_type: Array<{ event_type: string; count: number }>;
  /** Tool invocation counts within this session, most-used first. */
  tools_used: Array<{ tool_name: string; count: number }>;
  /** Count of events representing an error (APIError, error-summary Stop) in
   *  this session. Drives the "N errors" badge on the detail page. */
  error_count: number;
  /** ISO timestamp of the session's earliest event; null if it has none. The
   *  left edge of the session's event timeline. */
  first_event_at: string | null;
  /** ISO timestamp of the session's latest event; null if it has none. The
   *  right edge of the session's event timeline. */
  last_event_at: string | null;
  /** Agent counts for this session, broken out by role/status. */
  agents: {
    /** Total agents in this session (main + subagents + compaction pseudo-agents). */
    total: number;
    /** Count with `type === "main"` (normally 1). */
    main: number;
    /** Count with `type === "subagent"` (excluding compaction pseudo-agents). */
    subagent: number;
    /** Count of compaction pseudo-agents (subagent_type === "compaction"). */
    compaction: number;
    /** Agent count keyed by `AgentStatus` value. */
    by_status: Record<string, number>;
  };
  /** Subagent counts grouped by `subagent_type`, for this session only (the
   *  single-session analog of {@link Analytics.agent_types}). */
  subagent_types: Array<{ subagent_type: string; count: number }>;
  /** Token totals across every agent in this session, summed by bucket. */
  tokens: {
    /** Fresh (non-cached) input tokens summed over this session's agents. */
    input_tokens: number;
    /** Output/completion tokens summed over this session's agents. */
    output_tokens: number;
    /** Prompt-cache-read tokens summed over this session's agents. */
    cache_read_tokens: number;
    /** Prompt-cache-write tokens summed over this session's agents. */
    cache_write_tokens: number;
  };
}

// ───── Workflow intelligence (events-derived) ─────
// The analytics panels on the Workflows page. Every type below is COMPUTED by
// the server from `DashboardEvent`/`Agent` rows (server/routes/workflows.js) -
// none of them is a stored table. They all honor the same optional
// session-status filter and are bundled together in {@link WorkflowData}.
// NOTE: distinct from the "Workflow-tool runs" section further down, which is
// ingested from on-disk journals, not derived from events.

/** Headline metrics card data for the Workflows page - aggregated across
 *  sessions matching the optional status filter. From `getWorkflowStats` in
 *  server/routes/workflows.js. */
export interface WorkflowStats {
  /** Sessions considered (after the optional status filter). Denominator for the
   *  per-session averages below. */
  totalSessions: number;
  /** Total agents (main + subagents) across those sessions. */
  totalAgents: number;
  /** Total agents with `type === "subagent"`. */
  totalSubagents: number;
  /** Mean subagents spawned per session (`totalSubagents / totalSessions`). */
  avgSubagents: number;
  /** Percent of finished (completed+error) agents that completed successfully.
   *  Range 0-100; excludes still-running agents from the denominator. */
  successRate: number;
  /** Mean maximum parent→child agent nesting depth per session (1 = flat,
   *  no delegation beyond the main agent). */
  avgDepth: number;
  /** Mean session duration in seconds, across ended sessions (running sessions
   *  are excluded so an open session doesn't skew the average). */
  avgDurationSec: number;
  /** Total compaction pseudo-agents across all sessions considered. */
  totalCompactions: number;
  /** Mean compactions per session. */
  avgCompactions: number;
  /** The single most common two-tool sequence across all sessions, or null
   *  if no session has at least two tool calls. Example:
   *  `{ source: "Read", target: "Edit", count: 88 }` = "Read then Edit, 88x". */
  topFlow: { source: string; target: string; count: number } | null;
}

/** One directed delegation edge in the orchestration graph: `source` subagent
 *  type (or "main") spawned `target` subagent type `weight` times. */
export interface OrchestrationEdge {
  /** Delegating role: a `subagent_type`, or "main" for the top-level agent. */
  source: string;
  /** Delegated-to `subagent_type`. */
  target: string;
  /** How many times `source` spawned `target` across all sessions considered. */
  weight: number;
}

/** Data for the Workflows page's orchestration graph - who delegates to whom.
 *  From `getOrchestrationData` in server/routes/workflows.js. */
export interface OrchestrationData {
  /** Number of sessions the graph was computed over (after the status filter). */
  sessionCount: number;
  /** Count of agents with `type === "main"` - the root nodes that delegate out. */
  mainCount: number;
  /** Per-subagent-type totals with completion/error breakdown, most-used first.
   *  `completed + errors` may be less than `count` when some are still running. */
  subagentTypes: Array<{ subagent_type: string; count: number; completed: number; errors: number }>;
  /** Directed delegation edges; see {@link OrchestrationEdge}. Rendered as the
   *  arrows of the orchestration graph. */
  edges: OrchestrationEdge[];
  /** Terminal-status counts across all agents ("completed"/"error" only);
   *  running/waiting agents are excluded. */
  outcomes: Array<{ status: string; count: number }>;
  /** Total compaction pseudo-agents and how many distinct sessions had one.
   *  `total` counts every compaction; `sessions` counts unique sessions with
   *  at least one, so `total / sessions` is the average compactions per
   *  compacting session. */
  compactions: { total: number; sessions: number };
}

/** One tool→tool adjacency edge: `target` ran immediately after `source`
 *  within the same session, `value` times. */
export interface ToolFlowTransition {
  /** The tool that ran first. */
  source: string;
  /** The tool that ran immediately after `source` in the same session. */
  target: string;
  /** How many times this exact adjacency occurred across sessions. */
  value: number;
}

/** Data for the Workflows page's tool-flow Sankey/graph. From
 *  `getToolFlowData` in server/routes/workflows.js (top 50 transitions,
 *  top 15 tools by count). */
export interface ToolFlowData {
  /** The adjacency edges (top 50); see {@link ToolFlowTransition}. The links of
   *  the tool-flow graph. */
  transitions: ToolFlowTransition[];
  /** Per-tool total invocation counts, used to size graph nodes (top 15 tools).
   *  Larger `count` → larger node in the Sankey/graph. */
  toolCounts: Array<{ tool_name: string; count: number }>;
}

/** Per-subagent-type effectiveness row for the Workflows page (top 12 by
 *  volume). From `getSubagentEffectiveness` in server/routes/workflows.js. */
export interface SubagentEffectivenessItem {
  /** The subagent type this row summarizes. */
  subagent_type: string;
  /** Total invocations of this subagent type (all statuses, denominator). */
  total: number;
  /** How many of those invocations reached "completed" (numerator of successRate). */
  completed: number;
  /** How many of those invocations reached "error". */
  errors: number;
  /** Distinct sessions this subagent type appeared in (breadth of use). */
  sessions: number;
  /** Percent of finished (completed+error) runs that completed successfully
   *  (0-100); still-running runs are excluded from the denominator. */
  successRate: number;
  /** Mean duration in seconds for finished runs; null if none have ended. */
  avgDuration: number | null;
  /** 7-slot invocation-count histogram over the last 8 weeks, Monday-first
   *  ([Mon, Tue, Wed, Thu, Fri, Sat, Sun]). Rendered as a small day-of-week
   *  sparkline; index 0 is Monday. */
  trend: number[];
}

/** One recurring subagent-type sequence detected across sessions (2-3 step
 *  windows and full sequences all included), sorted by frequency. */
export interface WorkflowPattern {
  /** Ordered `subagent_type` sequence, e.g. ["planner", "coder", "reviewer"].
   *  The recurring delegation "recipe" this row represents. */
  steps: string[];
  /** Number of sessions exhibiting this exact sequence/sub-sequence. Higher =
   *  a more established habit. */
  count: number;
  /** `count` as a percentage of all sessions considered (0-100). */
  percentage: number;
}

/** Data for the Workflows page's pattern-mining panel (top 10 patterns).
 *  From `getWorkflowPatterns` in server/routes/workflows.js. */
export interface WorkflowPatternsData {
  /** The mined recurring subagent-type sequences; see {@link WorkflowPattern}. */
  patterns: WorkflowPattern[];
  /** Sessions that spawned zero subagents (main agent worked solo). The
   *  complement of the sessions that show up in `patterns`. */
  soloSessionCount: number;
  /** `soloSessionCount` as a percentage of all sessions considered (0-100). */
  soloPercentage: number;
}

/** Model choice and token usage broken down by delegation role, for the
 *  Workflows page's model-delegation panel. From `getModelDelegation`. */
export interface ModelDelegationData {
  /** Models used by main agents, with agent/session counts, most-used first.
   *  `session_count` disambiguates "one busy session" from "many sessions". */
  mainModels: Array<{ model: string; agent_count: number; session_count: number }>;
  /** Models used by subagents (approximated via the owning session's model,
   *  since subagents don't always report their own model). */
  subagentModels: Array<{ model: string; agent_count: number }>;
  /** Token totals grouped by model, most total tokens first. Lets the panel show
   *  which model soaks up the most tokens, split by bucket. */
  tokensByModel: Array<{
    /** Model id these token totals are for. */
    model: string;
    /** Fresh (non-cached) input tokens for this model. */
    input_tokens: number;
    /** Output/completion tokens for this model. */
    output_tokens: number;
    /** Prompt-cache-read tokens for this model. */
    cache_read_tokens: number;
    /** Prompt-cache-write tokens for this model. */
    cache_write_tokens: number;
  }>;
}

/** Data for the Workflows page's error-propagation panel - where in the agent
 *  hierarchy errors occur. From `getErrorPropagation` in workflows.js. */
export interface ErrorPropagationData {
  /** Error counts by parent→child nesting depth (0 = main agent / session-level).
   *  Higher depth = errors happening deeper in the delegation tree. */
  byDepth: Array<{ depth: number; count: number }>;
  /** Top 5 error-prone subagent types by error count. Highlights which roles
   *  fail most often. */
  byType: Array<{ subagent_type: string; count: number }>;
  /** Top 10 recurring error-event summaries (Stop-with-error, APIError) by count.
   *  Surfaces the most common concrete failure messages. */
  eventErrors: Array<{ summary: string; count: number }>;
  /** Sessions with at least one error (agent error, session error, or error event). */
  sessionsWithErrors: number;
  /** Total sessions considered (denominator for `errorRate`). */
  totalSessions: number;
  /** `sessionsWithErrors` as a percentage of `totalSessions`. */
  errorRate: number;
}

/** One row of the Workflows page's concurrency chart: a role/subagent-type's
 *  average position within the session timeline. */
export interface ConcurrencyLane {
  /** "Main Agent" or a `subagent_type` string. The lane label. */
  name: string;
  /** Mean start position as a 0-1 fraction of total session duration (0 = at the
   *  very start, 1 = at the very end). */
  avgStart: number;
  /** Mean end position as a 0-1 fraction of total session duration; always
   *  `>= avgStart`. Together they define where the lane sits on the timeline. */
  avgEnd: number;
  /** Number of agent instances averaged into this lane (the sample size). */
  count: number;
}

/** Data for the Workflows page's concurrency chart. From `getConcurrencyData`
 *  in server/routes/workflows.js (computed only from sessions that have ended). */
export interface ConcurrencyData {
  /** One averaged lane per role/subagent-type; see {@link ConcurrencyLane}.
   *  Overlapping `avgStart`/`avgEnd` ranges reveal which roles tend to run
   *  concurrently versus sequentially. */
  aggregateLanes: ConcurrencyLane[];
}

/** One row of the Workflows page's session-complexity scatter/table (most
 *  recent 200 sessions). From `getSessionComplexity` in workflows.js. */
export interface SessionComplexityItem {
  /** Session id. */
  id: string;
  /** Session display name; null when unnamed. */
  name: string | null;
  /** Session status string (see {@link SessionStatus}; typed loosely as string
   *  here since it arrives from a computed query rather than the typed column). */
  status: string;
  /** Session duration in seconds (0 if still running, per `durationSec`). One of
   *  the scatter-plot axes on the complexity view. */
  duration: number;
  /** Total agents (main + subagents) belonging to this session. A complexity
   *  axis (more agents = more delegation). */
  agentCount: number;
  /** Subset of `agentCount` with `type === "subagent"` (excludes the main agent). */
  subagentCount: number;
  /** Sum of all token buckets (input+output+cache read+cache write). The token
   *  "size" of the session; another complexity axis. */
  totalTokens: number;
  /** Session model id; null when unknown. */
  model: string | null;
}

/** Data for the Workflows page's compaction-impact panel - how much context
 *  compression is happening and its token savings. From `getCompactionImpact`. */
export interface CompactionImpactData {
  /** Total compaction pseudo-agents across all sessions considered (matches
   *  {@link WorkflowStats.totalCompactions}). */
  totalCompactions: number;
  /** Sum of `baseline_*` token columns across all usage rows - the tokens that
   *  would have been re-billed had compaction not reset the running context.
   *  The headline "tokens saved by compaction" figure. */
  tokensRecovered: number;
  /** Top 50 sessions by compaction count, most-compacted first. Each row links
   *  a session to how many times its context was compacted. */
  perSession: Array<{ session_id: string; compactions: number }>;
  /** Distinct sessions that had at least one compaction. */
  sessionsWithCompactions: number;
  /** Total sessions considered (denominator for the impact ratio). */
  totalSessions: number;
}

/** Response shape of GET /api/workflows - the full bundle of events-derived
 *  workflow-intelligence panels shown on the Workflows page, all computed
 *  against the same optional session-status filter. */
export interface WorkflowData {
  /** Headline metric cards; see {@link WorkflowStats}. */
  stats: WorkflowStats;
  /** Delegation graph data; see {@link OrchestrationData}. */
  orchestration: OrchestrationData;
  /** Tool→tool adjacency graph data; see {@link ToolFlowData}. */
  toolFlow: ToolFlowData;
  /** Per-subagent-type effectiveness rows; see {@link SubagentEffectivenessItem}. */
  effectiveness: SubagentEffectivenessItem[];
  /** Recurring delegation-sequence patterns; see {@link WorkflowPatternsData}. */
  patterns: WorkflowPatternsData;
  /** Model-choice-by-role breakdown; see {@link ModelDelegationData}. */
  modelDelegation: ModelDelegationData;
  /** Error-location breakdown; see {@link ErrorPropagationData}. */
  errorPropagation: ErrorPropagationData;
  /** Timeline-position lanes; see {@link ConcurrencyData}. */
  concurrency: ConcurrencyData;
  /** Per-session complexity rows; see {@link SessionComplexityItem}. */
  complexity: SessionComplexityItem[];
  /** Compaction-savings panel; see {@link CompactionImpactData}. */
  compaction: CompactionImpactData;
  /** Directed subagent-type co-occurrence edges (source ran before target in
   *  the same session, weight >= 2), for the co-occurrence graph. Unlike
   *  {@link OrchestrationEdge} (direct parent→child delegation), these capture
   *  "tends to appear together in a session" ordering, not spawning. */
  cooccurrence: Array<{ source: string; target: string; weight: number }>;
}

/** Response shape of GET /api/workflows/session/:id - the single-session
 *  drill-in view (agent tree, tool timeline, swim lanes, raw events). */
export interface SessionDrillIn {
  /** The full session row this drill-in is for. */
  session: Session;
  /** Agents nested into a parent→child tree (roots = agents with no parent). */
  tree: Array<{
    /** Agent id. */
    id: string;
    /** Agent display name. */
    name: string;
    /** "main" or "subagent" (typed loosely as string here). */
    type: string;
    /** The agent's `subagent_type`; null for main agents. */
    subagent_type: string | null;
    /** Agent status string. */
    status: string;
    /** The agent's task description; null when not captured. */
    task: string | null;
    /** ISO timestamp the agent started. */
    started_at: string;
    /** ISO timestamp the agent finished; null if still running. */
    ended_at: string | null;
    /** Recursively nested child agents (empty array for leaves). */
    children: SessionDrillIn["tree"];
  }>;
  /** Every tool-invoking event in the session, chronological, flattened for
   *  the horizontal tool-usage timeline. */
  toolTimeline: Array<{
    /** Source `DashboardEvent.id`. */
    id: number;
    /** Tool that was invoked. */
    tool_name: string;
    /** Originating event type (e.g. "PreToolUse"/"PostToolUse"). */
    event_type: string;
    /** Agent that invoked the tool; null for session-level events. */
    agent_id: string | null;
    /** ISO timestamp of the event. */
    created_at: string;
    /** Short summary for the timeline row; null when none. */
    summary: string | null;
  }>;
  /** Flat per-agent metadata (no nesting) for rendering horizontal swim lanes
   *  against the session timeline; `parent_agent_id` lets the UI draw links. */
  swimLanes: Array<{
    /** Agent id. */
    id: string;
    /** Agent display name. */
    name: string;
    /** "main" or "subagent" (typed loosely as string here). */
    type: string;
    /** The agent's `subagent_type`; null for main agents. */
    subagent_type: string | null;
    /** Agent status string. */
    status: string;
    /** ISO timestamp the agent started (left edge of its lane). */
    started_at: string;
    /** ISO timestamp the agent finished; null if still running. */
    ended_at: string | null;
    /** Parent agent id, so the UI can draw delegation links; null for roots. */
    parent_agent_id: string | null;
  }>;
  /** Up to the first 500 raw events for this session, chronological. Powers the
   *  raw-events tab of the drill-in; capped so a huge session stays responsive. */
  events: DashboardEvent[];
}

// ───── Workflow-tool runs (issue #167) ─────────────────────────────────────
// Fleets of inner sub-agents spawned by the Claude Code "Workflow" tool,
// ingested from the on-disk run journal. Distinct from WorkflowData above
// (which is events-derived analytics).
/** One named phase marker from a run journal's `phases[]` array - free-form,
 *  since the Workflow tool script defines its own phase structure. */
export interface WorkflowPhase {
  /** Phase name, e.g. "Plan", "Implement", "Review". Matched against
   *  {@link WorkflowProgressEntry.phaseTitle} to group agents under a phase. */
  title?: string;
  /** Optional longer description of what the phase covers. Shown as the phase
   *  header's subtitle. */
  detail?: string;
  /** Additional script-defined fields pass through untyped. The index signature
   *  keeps the journal's forward-compatible extra keys accessible. */
  [key: string]: unknown;
}

/** One entry in a `WorkflowRun.progress` log - a mixed timeline of phase
 *  markers and inner-agent lifecycle updates, in journal order. */
export interface WorkflowProgressEntry {
  /** "workflow_agent" (a real inner agent) or "workflow_phase" (a phase marker).
   *  Discriminates whether this entry describes an agent or a phase boundary. */
  type?: string;
  /** For workflow_agent entries: matches the `agent-<agentId>.jsonl` transcript
   *  basename, and is linked into the `agents` table as
   *  `${sessionId}-jsonl-<agentId>`. The join key back to a real `Agent` row. */
  agentId?: string;
  /** Freeform inner-agent role/type as reported by the launch script. Example:
   *  `"reviewer"`. */
  agentType?: string | null;
  /** Model the inner agent ran with, if known; overrides
   *  {@link WorkflowRun.default_model} for this agent. */
  model?: string | null;
  /** Inner-agent lifecycle state, e.g. "running", "done", "error". Freeform,
   *  chosen by the launch script (not the closed {@link AgentStatus} enum). */
  state?: string | null;
  /** Short display label for the agent (falls back to prompt preview). */
  label?: string | null;
  /** Phase this entry belongs to, matching a `WorkflowPhase.title`; null for
   *  entries not associated with a specific phase. */
  phaseTitle?: string | null;
  /** When the agent/phase started - ISO string or epoch depending on the
   *  script that emitted it. */
  startedAt?: string | number | null;
  /** Tokens consumed by this inner agent, once known. Summed into
   *  {@link WorkflowRun.total_tokens}. */
  tokens?: number;
  /** Tool calls made by this inner agent, once known. Summed into
   *  {@link WorkflowRun.total_tool_calls}. */
  toolCalls?: number;
  /** Wall-clock runtime in milliseconds; null while still running. Epoch-relative
   *  duration, not an ISO string. */
  durationMs?: number | null;
  /** Most recent tool name the agent invoked, for a live "what's it doing" hint.
   *  Example: `"Edit"`. */
  lastToolName?: string | null;
  /** Truncated preview of the task/prompt handed to this inner agent, for the
   *  card subtitle. */
  promptPreview?: string | null;
  /** Truncated preview of the inner agent's final result, once done; shown when
   *  the agent card is expanded. */
  resultPreview?: string | null;
  /** Additional script-defined fields pass through untyped. */
  [key: string]: unknown;
}

/**
 * A fleet run of the Claude Code "Workflow" tool (or self-paced `/loop`) -
 * inner sub-agents that emit no hooks and are instead ingested from an
 * on-disk run journal (see server/lib/workflow-ingest.js). Distinct from the
 * events-derived {@link WorkflowData} above. Returned by GET /api/workflows/runs
 * and /api/workflows/runs/:runId; pushed live via `workflow_upserted`.
 *
 * A run starts life as `source: "live"` (only the launch script has been seen)
 * and is promoted to `source: "journal"` once the completed run journal exists
 * on disk. The `total_*`/`agent_count` fields are rolled up from `progress`.
 */
export interface WorkflowRun {
  /** Stable run id, matching the `wf_<runId>.json` journal / launch script name.
   *  Primary key for the run. Example: `"wf_20260319_140322"`. */
  run_id: string;
  /** Session that launched this run. FK into `Session.id`; inner agents are
   *  linked under this session as `${sessionId}-jsonl-<agentId>`. */
  session_id: string;
  /** Correlates to a TaskCreate/TaskList task, if the run was tied to one; null
   *  otherwise. Lets the UI cross-link a run with its originating to-do task. */
  task_id: string | null;
  /** Display name for the run, if the launch script provided one. Example:
   *  `"Refactor auth module"`. Null falls back to `run_id` in the UI. */
  name: string | null;
  /** Run lifecycle, e.g. "running", "completed", "error" (freeform; not a closed
   *  enum, since the launch script chooses its own status vocabulary). */
  status: string;
  /** Default model inner agents used unless overridden per-agent; null if unset.
   *  Example: `"claude-sonnet-4-5"`. */
  default_model: string | null;
  /** ISO timestamp the run started; null if not yet known (e.g. mid-launch).
   *  Left edge of the run's overall timeline. */
  started_at: string | null;
  /** ISO timestamp the run finished; null while still running. Set once the
   *  completed journal is observed. */
  ended_at: string | null;
  /** Total wall-clock runtime in milliseconds; null while still running.
   *  Note: epoch-relative duration in ms, not an ISO string. */
  duration_ms: number | null;
  /** Number of inner agents spawned by this run. Rolled up from `progress`
   *  (count of `workflow_agent` entries). */
  agent_count: number;
  /** Sum of tokens consumed across all inner agents. Rolled up from each
   *  `progress` entry's `tokens`. */
  total_tokens: number;
  /** Sum of tool calls made across all inner agents. Rolled up from each
   *  `progress` entry's `toolCalls`. */
  total_tool_calls: number;
  /** Phase markers for the run; see {@link WorkflowPhase}. */
  phases: WorkflowPhase[];
  /** Interleaved phase + inner-agent timeline; see {@link WorkflowProgressEntry}. */
  progress: WorkflowProgressEntry[];
  /** Path to the generated launch script under `workflows/scripts/`; null if
   *  unknown. Example: `"workflows/scripts/wf_20260319_140322.sh"`. */
  script_path: string | null;
  /** Path to the `wf_<runId>.json` journal file; null for a run not yet
   *  completed (i.e. while `source === "live"`). */
  journal_path: string | null;
  /** "journal" once a completed run journal exists; "live" while only the
   *  launch script (no journal yet) has been observed. Promotion from "live" to
   *  "journal" happens when the on-disk journal is ingested. */
  source: "journal" | "live";
  /** ISO timestamp this row was first ingested (first seen by the watcher). */
  created_at: string;
  /** ISO timestamp this row was last updated (re-ingested/upserted). Bumped on
   *  every `workflow_upserted` broadcast. */
  updated_at: string;
}

/** Response shape of GET /api/workflows/runs - a paginated, optionally
 *  status/session-filtered list of workflow-tool runs. */
export interface WorkflowRunsResponse {
  /** The page of runs for the current `limit`/`offset`. */
  runs: WorkflowRun[];
  /** Total matching runs (ignores `limit`/`offset`, respects the status filter). */
  total: number;
  /** Run count keyed by `status`, across all runs (ignores any filter). */
  counts: Record<string, number>;
  /** Page size that was applied. */
  limit: number;
  /** Zero-based offset of this page into the filtered result set. */
  offset: number;
}

/** Response shape of GET /api/workflows/runs/:runId - a single run plus its
 *  linked inner agents (as regular `Agent` rows) and their attributed events. */
export interface WorkflowRunDetail {
  /** The run itself; see {@link WorkflowRun}. */
  workflow: WorkflowRun;
  /** Inner agents linked to this run via the `${sessionId}-jsonl-<agentId>` id
   *  scheme. Regular {@link Agent} rows, so the same UI can render them. */
  agents: Agent[];
  /** Events attributed to this run's inner agents, chronological (up to 5000).
   *  Capped to keep the payload bounded for very long runs. */
  events: DashboardEvent[];
}

// ───── Status presentation lookup (agents) ─────

/**
 * UI presentation lookup for {@link EffectiveAgentStatus}: the i18n key, text
 * color, badge background, and status-dot Tailwind classes for each state.
 * `labelKey` is passed to `i18n.t()`; the rest are applied directly as classes.
 *
 * Keyed by every {@link EffectiveAgentStatus} value, so the record is exhaustive
 * for the agent status set. See {@link SESSION_STATUS_CONFIG} for the parallel
 * session-status lookup, which additionally covers "abandoned".
 */
export const STATUS_CONFIG: Record<
  EffectiveAgentStatus,
  { labelKey: string; color: string; bg: string; dot: string }
> = {
  // Green: the agent is actively running a tool / doing work.
  working: {
    labelKey: "common:status.working",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  // Yellow: idle-between-turns, or (via the AWAITING_STATUS overlay) blocked
  // on user input - attention may be required.
  waiting: {
    labelKey: "common:status.waiting",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  // Violet: the agent finished cleanly.
  completed: {
    labelKey: "common:status.completed",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-400",
  },
  // Red: the agent ended in an error state.
  error: {
    labelKey: "common:status.error",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

// ───── Awaiting-reason presentation lookup ─────

/**
 * UI presentation lookup for {@link AwaitingReason}: the short badge-suffix
 * label and the longer tooltip description, both as i18n keys passed to
 * `i18n.t()`. `urgent` marks the reasons that mean "Claude is BLOCKED and needs
 * you" (vs. merely idle between turns) so surfaces can emphasize them - e.g.
 * a permission prompt is actionable in a way an empty prompt is not.
 * `primary` marks reasons that mean "still actively working, just via a
 * child" (subagent/shell/monitor) - {@link StatusBadge} promotes these to the
 * badge's whole visible text (e.g. "SubAgents") instead of nesting them as a
 * suffix chip inside a generic "Waiting" badge, since "Waiting" would be
 * actively misleading for these.
 *
 * Keyed by every {@link AwaitingReason} value so the record is exhaustive;
 * unknown server values never reach this table ({@link normalizeAwaitingReason}
 * filters them to null first).
 */
export const AWAITING_REASON_CONFIG: Record<
  AwaitingReason,
  { labelKey: string; descKey: string; urgent: boolean; primary?: boolean }
> = {
  // Permission prompt / input request: Claude literally cannot continue.
  notification: {
    labelKey: "common:awaitingReason.notification.label",
    descKey: "common:awaitingReason.notification.desc",
    urgent: true,
  },
  // Turn finished cleanly; ball is in the user's court but nothing is blocked.
  stop: {
    labelKey: "common:awaitingReason.stop.label",
    descKey: "common:awaitingReason.stop.desc",
    urgent: false,
  },
  // Fresh/resumed CLI sitting at an empty prompt.
  session_start: {
    labelKey: "common:awaitingReason.session_start.label",
    descKey: "common:awaitingReason.session_start.desc",
    urgent: false,
  },
  // Esc / recovered-hook interruption: the last turn never finished normally.
  interrupted: {
    labelKey: "common:awaitingReason.interrupted.label",
    descKey: "common:awaitingReason.interrupted.desc",
    urgent: true,
  },
  // Main's turn ended, but a subagent fleet it spawned is still working.
  subagent: {
    labelKey: "common:awaitingReason.subagent.label",
    descKey: "common:awaitingReason.subagent.desc",
    urgent: false,
    primary: true,
  },
  // Main is mid a synchronous Bash call.
  shell: {
    labelKey: "common:awaitingReason.shell.label",
    descKey: "common:awaitingReason.shell.desc",
    urgent: false,
    primary: true,
  },
  // Main is mid a Monitor tool call.
  monitor: {
    labelKey: "common:awaitingReason.monitor.label",
    descKey: "common:awaitingReason.monitor.desc",
    urgent: false,
    primary: true,
  },
};

// ───── Focus-kind presentation lookup (session-card breadcrumb, plan lines) ─────

/**
 * Unified classification of a session's *current* focus, spanning both the
 * declared plan item and any active detour. Drives the single icon/color
 * vocabulary shared by SessionCard's breadcrumb and PlanModal's per-item
 * focus lines, so the same visual language ("known item" vs "on a detour"
 * vs "chasing a bug") reads the same everywhere.
 */
export type FocusKind = "item" | "detour" | "feature" | "bug";

/** {@link FocusKind} widened with the `"none"` sentinel a focus-time report
 *  segment (only) can carry — see {@link FocusReportSegment}. `focusKind()`
 *  below, which classifies a session's *live* current focus, never returns
 *  `"none"` (it returns `null` for "no focus declared" instead); this wider
 *  type exists purely so a report segment/its config lookups can share
 *  {@link FOCUS_KIND_CONFIG}/{@link FOCUS_KIND_SOLID} with the real kinds. */
export type FocusSegmentKind = FocusKind | "none";

/**
 * Classifies a {@link SessionFocus} into one {@link FocusKind}: the top of
 * the detour stack wins when a detour is open (its `kind`, or plain
 * `"detour"` when none was declared), otherwise falls back to `"item"` when
 * a plan item is declared. Null when the focus has neither (e.g. a bare
 * note) — callers should render nothing in that case.
 */
export function focusKind(focus: SessionFocus | null | undefined): FocusKind | null {
  if (!focus) return null;
  const top = focus.detour_stack[focus.detour_stack.length - 1];
  if (top) return top.kind ?? "detour";
  return focus.item_number != null ? "item" : null;
}

/**
 * UI presentation lookup for {@link FocusKind}: the i18n label key and the
 * badge's text/background color classes, mirroring {@link STATUS_CONFIG}'s
 * shape. Rendered by PlanModal's per-item focus lines and (color only) by
 * SessionCard's breadcrumb. Icons themselves stay out of this file (kept
 * JSX-free) — see `FOCUS_KIND_ICONS` in PlanModal.tsx.
 */
export const FOCUS_KIND_CONFIG: Record<
  FocusSegmentKind,
  { labelKey: string; color: string; bg: string }
> = {
  item: {
    labelKey: "plan:items.itemKindLabel",
    // Deliberately a saturated "terminal green" rather than the app's
    // usual muted accent — a known-item focus is the common case and
    // needs to read at a glance, not just on close inspection.
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  detour: {
    labelKey: "plan:items.detourLabel",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  feature: {
    labelKey: "plan:items.featureLabel",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  bug: {
    labelKey: "plan:items.bugLabel",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  // Report-only sentinel (see FocusSegmentKind) — a neutral gray, distinct
  // from every real kind's hue, for a session with no declared focus and no
  // usable inference yet.
  none: {
    labelKey: "plan:report.calendar.noFocus",
    color: "text-gray-400",
    bg: "bg-gray-500/10 border-gray-500/20",
  },
};

/** Solid fill classes per {@link FocusKind} — {@link FOCUS_KIND_CONFIG}'s
 *  own `bg` is a translucent badge wash (10% opacity), not meant for
 *  something that has to read at a glance (a segment bar, a calendar
 *  block, a legend dot), so this is a deliberately separate mapping onto
 *  the same hues. A literal per-kind lookup, not `color.replace("text-",
 *  "bg-")` — Tailwind's JIT scanner only generates CSS for class names it
 *  can find as literal substrings in source, so a computed class string
 *  would silently produce no styles at all. Shared by FocusReportModal
 *  (segment bars, legend) and FocusCalendarView (legend). */
export const FOCUS_KIND_SOLID: Record<FocusSegmentKind, string> = {
  item: "bg-green-500",
  detour: "bg-amber-500",
  feature: "bg-violet-500",
  bug: "bg-rose-500",
  none: "bg-gray-500",
};

// ───── Transcript / Conversation types ─────
// Shapes for the raw JSONL transcript viewer in SessionDetail: individual
// content blocks, whole messages, a paginated page of messages, and the picker
// that lists a session's available transcripts (main, each subagent, compaction).

/** One content block within a {@link TranscriptMessage}, mirroring the
 *  Anthropic Messages API content-block shapes as they appear in a Claude
 *  Code session's raw JSONL transcript. */
export interface TranscriptContent {
  /** Block kind; selects which of the optional fields below are populated.
   *  "thinking" is the model's extended-reasoning trace; "text" is normal prose;
   *  "tool_use"/"tool_result" are the two halves of a tool round-trip. */
  type: "text" | "tool_use" | "tool_result" | "thinking";
  /** Present for "text"/"thinking" blocks: the rendered prose (or reasoning). */
  text?: string;
  /** Present for "tool_use" blocks: the invoked tool's name. Example: `"Bash"`. */
  name?: string;
  /** Present for "tool_use"/"tool_result" blocks: correlates a result to its
   *  call (both halves share the same `id`). */
  id?: string;
  /** Present for "tool_use" blocks: the tool call's arguments, or a
   *  `{ _truncated }` placeholder when the original input was too large to keep. */
  input?: Record<string, unknown> | { _truncated: string };
  /** Present for "tool_result" blocks: the stringified tool output. */
  output?: string;
  /** Present for "tool_result" blocks: whether the tool call errored. */
  is_error?: boolean;
}

/** Who actually sent a transcript message. A JSONL `type:"user"` line can be the
 *  human, a tool result, a harness injection, or (in a subagent transcript) the
 *  task handed down by the orchestrator — `sender` disambiguates for display. */
export type TranscriptSender = "user" | "assistant" | "orchestrator" | "system" | "tool";

/**
 * One parsed line from a session's (or subagent's) raw transcript JSONL,
 * as returned by GET /api/sessions/:id/transcript. Rendered by the
 * conversation viewer in SessionDetail.
 *
 * The synthetic `type: "session_event"` line is not a real transcript entry -
 * the server injects it to mark in-band TUI actions (currently only `/rename`),
 * carrying its detail in `event_kind`/`title` rather than `content`.
 */
export interface TranscriptMessage {
  /** Raw JSONL line type. "session_event" is a synthetic marker (see
   *  `event_kind`/`title`) injected by the server, not a real transcript line. */
  type: "user" | "assistant" | "session_event";
  /** True sender, classified server-side. Falls back to `type` when absent.
   *  Distinguishes, e.g., a human "user" line from a tool-result "user" line;
   *  see {@link TranscriptSender}. */
  sender?: TranscriptSender;
  /** ISO timestamp from the transcript line; null if the line had none.
   *  Used to order and time-stamp messages in the conversation view. */
  timestamp: string | null;
  /** The message's content blocks; see {@link TranscriptContent}. A single
   *  message can mix text, thinking, tool_use, and tool_result blocks. */
  content: TranscriptContent[];
  /** Model that produced an assistant message; absent for user/session_event.
   *  Example: `"claude-opus-4-8"`. */
  model?: string;
  /** Token accounting reported alongside an assistant message; absent otherwise. */
  usage?: {
    /** Fresh (non-cached) input tokens for this message. */
    input_tokens: number;
    /** Output/completion tokens generated for this message. */
    output_tokens: number;
    /** Tokens served from prompt cache reads. */
    cache_read_input_tokens?: number;
    /** Tokens written to create/extend a prompt cache entry. */
    cache_creation_input_tokens?: number;
  };
  /** For type === "session_event": the TUI action this marker represents.
   *  "rename" is a /rename, `claude -n`, or picker Ctrl+R title change. */
  event_kind?: "rename";
  /** For type === "session_event": the new session title. */
  title?: string;
}

/** Response shape of GET /api/sessions/:id/transcript - one page of parsed
 *  transcript messages, paginated by JSONL line number rather than offset so
 *  the client can page forward/backward through a live-growing file. */
export interface TranscriptResult {
  /** The messages on this page; see {@link TranscriptMessage}. */
  messages: TranscriptMessage[];
  /** Valid messages seen so far; exact for a fully-read file, a lower bound
   *  when the scan stopped early once `limit` was satisfied. */
  total: number;
  /** Whether more messages exist beyond this page in the requested direction. */
  has_more: boolean;
  /** JSONL line number of the last message in this page (pass as `before`/
   *  `after` on the next request to continue paging). */
  last_line: number;
  /** JSONL line number of the first message in this page. */
  first_line: number;
}

/** One entry in a session's transcript picker (main agent, a subagent, or a
 *  compaction marker), from GET /api/sessions/:id/transcripts. */
export interface TranscriptInfo {
  /** Db agent id for subagents/compaction; a synthetic id (e.g. "main") for
   *  the top-level session transcript. */
  id: string;
  /** Display name for the picker entry. */
  name: string;
  /** Which kind of transcript this entry points at. */
  type: "main" | "subagent" | "compaction";
  /** The subagent type for subagent entries; null/absent otherwise (e.g. the
   *  main or compaction entries). */
  subagent_type?: string | null;
  /** Whether a JSONL transcript file was actually found on disk for this entry -
   *  false means the entry exists in the DB but its transcript isn't available
   *  (e.g. the raw file was pruned), so the UI disables that picker option. */
  has_transcript: boolean;
  /** Underlying `Agent.id`, when this entry corresponds to a real agent row;
   *  null/absent for the synthetic main-session entry. */
  db_agent_id?: string | null;
}

/** Response shape of GET /api/sessions/:id/transcripts - the list of transcripts
 *  available for a session, used to populate the transcript picker. */
export interface TranscriptListResult {
  /** All picker entries for the session; see {@link TranscriptInfo}. */
  transcripts: TranscriptInfo[];
}

// ───── Status presentation lookup (sessions) ─────

/** Same UI presentation lookup as {@link STATUS_CONFIG}, but keyed by
 *  {@link EffectiveSessionStatus} - adds an "abandoned" entry that
 *  `STATUS_CONFIG` has no equivalent for. */
export const SESSION_STATUS_CONFIG: Record<
  EffectiveSessionStatus,
  { labelKey: string; color: string; bg: string; dot: string }
> = {
  // Green: the session is live and running.
  active: {
    labelKey: "common:status.active",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  // Yellow: blocked on user input via the AWAITING_STATUS overlay.
  waiting: {
    labelKey: "common:status.waiting",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  // Violet: the session ended cleanly (SessionEnd).
  completed: {
    labelKey: "common:status.completed",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-400",
  },
  // Red: the session ended in an error state.
  error: {
    labelKey: "common:status.error",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
  // Slate: stale session swept as "abandoned" (never cleanly ended); has no
  // equivalent in STATUS_CONFIG since agents don't get abandoned.
  abandoned: {
    // Muted slate distinguishes "given up / faded out" from yellow Waiting
    // (attention required).
    labelKey: "common:status.abandoned",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
    dot: "bg-slate-400",
  },
};
