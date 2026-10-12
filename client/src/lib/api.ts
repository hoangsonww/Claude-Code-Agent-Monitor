/**
 * @file api.ts
 * @description Defines a set of functions for interacting with the backend API of the agent dashboard application. It includes methods for fetching statistics, managing sessions and agents, retrieving analytics data, handling settings, and managing model pricing. The module abstracts away the details of making HTTP requests and provides a clean interface for the rest of the application to use when communicating with the server.
 *
 * ## What this module is
 * `api.ts` is the single, centralized REST client for the React dashboard. Every page/hook that
 * needs data from the Express backend (`server/`) goes through the {@link api} object exported here
 * rather than calling `fetch` directly. Keeping all HTTP access in one place gives the app a single
 * choke point for authentication, base-path handling, JSON (de)serialization, and error
 * normalization, and it keeps the network surface visible and greppable in one file.
 *
 * ## Layering / where this sits
 * The end-to-end data flow of the product is:
 *
 *   Claude Code hooks -> Express API (`server/`) -> SQLite -> WebSocket broadcast -> React UI.
 *
 * This file covers exactly one hop of that flow: the request/response REST calls the browser makes
 * to the Express API. It is deliberately *not* responsible for real-time updates. Live pushes
 * (new events, status transitions, run output, import progress, etc.) arrive out-of-band over the
 * WebSocket connection and are handled by the `eventBus` / `useWebSocket` layer. A typical page
 * therefore does an initial REST `list`/`get` through this module to hydrate, then listens on the
 * socket for incremental changes. The two mechanisms are complementary; neither replaces the other.
 *
 * ## Conventions shared by (almost) every call
 * - **Base path.** All paths passed to {@link request} are relative to {@link BASE} ("/api"). The
 *   Vite dev server proxies "/api" to the Express port in development, and in production the same
 *   origin serves both the built client and the API, so a relative base works in both modes.
 * - **Auth.** When the operator has locked the server down with a `DASHBOARD_TOKEN`, the token is
 *   attached to every request as the `x-dashboard-token` header. In the default zero-config loopback
 *   setup there is no token and the header is omitted. See {@link dashboardToken}.
 * - **JSON in/out.** Requests default to `Content-Type: application/json`; bodies are hand-serialized
 *   with `JSON.stringify` at each call site (so the caller controls the exact shape) and responses
 *   are parsed with `res.json()` and returned as the method's generic `T`.
 * - **Errors.** Non-2xx responses are converted into a thrown `Error` by {@link request}; the message
 *   is the server's structured `error.message` when present, otherwise `HTTP <status>`. Callers get a
 *   rejected promise they can surface in a toast / error boundary; they never see the raw `Response`.
 * - **Pagination.** List endpoints accept `limit`/`offset` and echo them back alongside a `total`.
 *   Transcript reading is the exception: it paginates by JSONL line number (`after`/`before`) because
 *   the underlying file grows live and numeric offsets would drift (see {@link api.sessions.transcript}).
 * - **Timezone bucketing.** Endpoints that group data by day (`stats`, `analytics`, `pricing.cost`)
 *   send the browser's `getTimezoneOffset()` as `tz_offset` so "today" and per-day rollups line up
 *   with the *viewer's* local midnight instead of the server's clock/UTC.
 * - **Query-string building.** Optional filters are assembled with `URLSearchParams` and only appended
 *   when at least one value is present, so a filter-less call hits a clean, cache-friendly URL.
 *
 * ## Two deliberate escapes from {@link request}
 * A couple of operations cannot use the shared JSON wrapper and open-code their own `fetch`:
 *   1. {@link api.import.upload} sends `multipart/form-data` (a `FormData` body), which must *not*
 *      carry the JSON `Content-Type` header, so it calls `fetch` directly.
 *   2. {@link api.settings.exportData} returns a *URL string* rather than performing a fetch, because
 *      the DB export is consumed as an `<a href download>` navigation, not an XHR.
 *
 * ## Shape of the exports
 * The bulk of the module is the {@link api} object: a nested, resource-grouped map of endpoint
 * functions whose grouping mirrors the `server/routes/*.js` file layout (sessions, agents, events,
 * analytics, settings, workflows, pricing, import, cc-config, run, alerts, webhooks). The remainder
 * of the file is the set of exported TypeScript `interface`/`type` declarations describing the
 * request bodies and response payloads that are *specific to this client* (many response DTOs are
 * imported from `./types`; the ones declared here are the client-only ones, e.g. the CC-config
 * explorer shapes, the Run-page process handles, and the import-result shape).
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/lib/api.ts`
 * **Purpose:** Central typed HTTP client for every REST route; attaches auth token, data-scope `sources` query params, and normalizes error payloads.
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
 * ## Internal dependencies
 * - `./types`
 * - `./dataScope`
 *
 * ## Public surface
 * - `dashboardToken` — exported API; see TSDoc on the symbol for behavior.
 * - `api` — exported API; see TSDoc on the symbol for behavior.
 * - `CcArtifactType` — exported API; see TSDoc on the symbol for behavior.
 * - `CcWriteArgs` — exported API; see TSDoc on the symbol for behavior.
 * - `CcDeleteArgs` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMutationResult` — exported API; see TSDoc on the symbol for behavior.
 * - `CcBackup` — exported API; see TSDoc on the symbol for behavior.
 * - `CcScope` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMdItem` — exported API; see TSDoc on the symbol for behavior.
 * - `CcPluginContributions` — exported API; see TSDoc on the symbol for behavior.
 * - `CcPlugin` — exported API; see TSDoc on the symbol for behavior.
 * - `CcPluginsResponse` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMcpServer` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMcpResponse` — exported API; see TSDoc on the symbol for behavior.
 * - `CcHookEntry` — exported API; see TSDoc on the symbol for behavior.
 * - `CcHookSource` — exported API; see TSDoc on the symbol for behavior.
 * - `CcSettingsSource` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMemoryItem` — exported API; see TSDoc on the symbol for behavior.
 * - `CcFileResponse` — exported API; see TSDoc on the symbol for behavior.
 * - `CcOverview` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMarketplace` — exported API; see TSDoc on the symbol for behavior.
 * - `CcMarketplacesResponse` — exported API; see TSDoc on the symbol for behavior.
 * - `CcKeybindingGroup` — exported API; see TSDoc on the symbol for behavior.
 * - `CcKeybindings` — exported API; see TSDoc on the symbol for behavior.
 * - `CcStatuslineScript` — exported API; see TSDoc on the symbol for behavior.
 * - `CcStatusline` — exported API; see TSDoc on the symbol for behavior.
 * - `CcHookScripts` — exported API; see TSDoc on the symbol for behavior.
 * - `RunMode` — exported API; see TSDoc on the symbol for behavior.
 * - `RunStatus` — exported API; see TSDoc on the symbol for behavior.
 * - `PermissionMode` — exported API; see TSDoc on the symbol for behavior.
 * - `EffortLevel` — exported API; see TSDoc on the symbol for behavior.
 * - `RunStartArgs` — exported API; see TSDoc on the symbol for behavior.
 * - `RunHandle` — exported API; see TSDoc on the symbol for behavior.
 * - `RunListResponse` — exported API; see TSDoc on the symbol for behavior.
 * - `DashboardRunHistoryItem` — exported API; see TSDoc on the symbol for behavior.
 * - `CwdSuggestion` — exported API; see TSDoc on the symbol for behavior.
 * - `ModelChoice` — exported API; see TSDoc on the symbol for behavior.
 * - `EffortChoice` — exported API; see TSDoc on the symbol for behavior.
 * - `RUN_EFFORT_CHOICES` — exported API; see TSDoc on the symbol for behavior.
 * - `RUN_MODEL_CHOICES` — exported API; see TSDoc on the symbol for behavior.
 * - … plus 6 additional exports
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
 * **dashboardToken**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **api**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcArtifactType**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcWriteArgs**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcDeleteArgs**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMutationResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcBackup**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcScope**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMdItem**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcPluginContributions**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcPlugin**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcPluginsResponse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMcpServer**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMcpResponse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcHookEntry**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcHookSource**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcSettingsSource**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMemoryItem**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcFileResponse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcOverview**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMarketplace**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcMarketplacesResponse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcKeybindingGroup**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcKeybindings**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcStatuslineScript**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcStatusline**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CcHookScripts**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunMode**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunStatus**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **PermissionMode**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EffortLevel**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunStartArgs**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunHandle**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RunListResponse**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **DashboardRunHistoryItem**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **CwdSuggestion**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ModelChoice**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **EffortChoice**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RUN_EFFORT_CHOICES**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RUN_MODEL_CHOICES**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ImportResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RemoteSource**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RemoteSourceInput**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RemoteSourceTestResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **RemoteSourceSyncResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ImportBackupResult**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

// ─────────────────────────────────────────────────────────────────────────────
// Shared response/entity DTOs. These are the cross-cutting types produced by the
// server and reused across many endpoints (sessions, agents, events, analytics,
// pricing, webhooks, alerts, workflows, transcripts, update status). Types that
// are specific to a single client feature area are declared further down in this
// file instead of being imported here.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Agent,
  AlertEvent,
  AlertRule,
  Analytics,
  CostResult,
  CursorModelPricing,
  DashboardEvent,
  GptModelPricing,
  ModelPricing,
  Session,
  SessionDrillIn,
  SessionStats,
  Stats,
  TranscriptListResult,
  TranscriptResult,
  UpdateStatusPayload,
  WebhookDelivery,
  WebhookProvider,
  WebhookTarget,
  WebhookTestResult,
  WebhookType,
  WorkflowData,
  WorkflowRun,
  WorkflowRunsResponse,
  WorkflowRunDetail,
} from "./types";

import { activeProvidersParam, activeSourcesParam } from "./dataScope";

/**
 * Root path every endpoint path is appended to. Kept relative (no host) so the same client bundle
 * works behind the Vite dev proxy and in same-origin production, where the Express server serves
 * both the built UI and `/api`.
 */
const BASE = "/api";

/**
 * Append the current global data-scope (see {@link activeSourcesParam}) as a
 * `sources` query param, unless the caller already set one. Called by the
 * scoped list/aggregate endpoints (sessions, events, agents, stats, analytics)
 * so changing a machine or product scope narrows the whole app without every
 * call site threading it. An all-machine / both-product selection yields no
 * added filter, so unscoped installs hit clean URLs.
 *
 * @param qs - Query parameters being built.
 * @returns The same parameters with the scope applied.
 */
function applyScope(qs: URLSearchParams): URLSearchParams {
  if (!qs.has("sources")) {
    const sources = activeSourcesParam();
    if (sources) qs.set("sources", sources);
  }
  if (!qs.has("providers")) {
    const providers = activeProvidersParam();
    if (providers) qs.set("providers", providers);
  }
  return qs;
}

/**
 * Optional dashboard auth token (GHSA-gr74-4xfh-6jw9). Only needed when the
 * operator binds the server to a LAN and sets DASHBOARD_TOKEN; for the default
 * loopback bind there is no token and this returns null (zero-config). Read from
 * an injected global first, then localStorage so a LAN user can set it once.
 *
 * Resolution order (first hit wins):
 *   1. `globalThis.__DASHBOARD_TOKEN__` — a value the server can inject into the
 *      served HTML so an operator-provisioned token is available on first paint
 *      without any client-side setup.
 *   2. `localStorage["dashboard_token"]` — a token the user pasted into the UI
 *      once; it persists across reloads for that browser.
 *
 * The whole body is wrapped in try/catch because both `globalThis` access and
 * `localStorage` can throw (e.g. storage disabled/blocked in some privacy modes);
 * any failure degrades gracefully to "no token" rather than crashing the client.
 *
 * @returns The resolved token string, or `null` when none is configured/available.
 */
export function dashboardToken(): string | null {
  try {
    // Prefer a server-injected global (set into the page before the app boots).
    const injected = (globalThis as { __DASHBOARD_TOKEN__?: unknown }).__DASHBOARD_TOKEN__;
    if (typeof injected === "string" && injected) return injected;
    // Fall back to a token the user saved in this browser's localStorage.
    const stored = localStorage.getItem("dashboard_token");
    return stored && stored.length > 0 ? stored : null;
  } catch {
    // Storage/global access blocked → behave as an unauthenticated loopback client.
    return null;
  }
}

/**
 * Shared fetch wrapper used by every method on {@link api}. Prefixes `path`
 * with {@link BASE} ("/api"), attaches the dashboard auth token (if any) as
 * the `x-dashboard-token` header, and normalizes non-2xx responses into a
 * thrown `Error` whose message is the server's `error.message` (falling back
 * to `HTTP <status>` when the body isn't JSON or has no message).
 *
 * This is the workhorse behind the entire {@link api} surface. Centralizing it
 * here means individual endpoint methods stay one-liners and never repeat auth,
 * header-merging, or error-shaping logic. Two callers intentionally bypass it:
 * the multipart upload ({@link api.import.upload}) and the export-URL builder
 * ({@link api.settings.exportData}) — see the module overview for why.
 *
 * Header precedence (later spreads win): the JSON `Content-Type` default is set
 * first, then the auth token, then any caller-supplied `options.headers` — so a
 * caller can override `Content-Type` if it ever needs to, and per-call headers
 * are merged into (not replaced by) the defaults.
 *
 * @typeParam T   The expected parsed JSON shape of a successful response body.
 * @param path    Path segment appended to `/api` (should start with "/").
 * @param options Standard `fetch` options; `headers` are merged, not replaced.
 * @returns       The parsed JSON response body, typed as `T`.
 * @throws {Error} When the response status is not ok (non-2xx). The thrown
 *   message is `body.error.message` if the error body parsed as JSON and carried
 *   one, otherwise the literal `HTTP <status>`.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = dashboardToken();
  // Build the effective header set. Order matters: defaults first so that the
  // token and any caller headers can override, and caller headers land last.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { "x-dashboard-token": token } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    // Try to recover a structured error message from the JSON body; if the body
    // isn't JSON (or json() throws), fall back to an empty object so the `?.`
    // chain below cleanly degrades to the generic `HTTP <status>` message.
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Typed client for every REST endpoint the dashboard consumes, grouped by
 * resource (mirroring the `server/routes/*.js` file layout). Every method
 * returns a `Promise` resolving to the parsed JSON body via {@link request};
 * on a non-2xx response the promise rejects with an `Error`. Real-time updates
 * arrive separately over the WebSocket (see {@link eventBus}/`useWebSocket`) -
 * this object only covers request/response REST calls.
 *
 * How to read this object: each top-level key (`updates`, `stats`, `sessions`,
 * `agents`, `events`, `analytics`, `settings`, `workflows`, `pricing`, `import`,
 * `ccConfig`, `run`, `alerts`, `webhooks`) is one backend resource area. The
 * nested functions are the individual endpoints in that area. Because every
 * function ultimately calls {@link request}, they all share the same auth,
 * JSON-encoding, and error-throwing behavior documented on that helper — the
 * per-method docs below focus on the specific route, params, and response shape.
 */
export const api = {
  // ───────────────────────── Updates / self-update API ─────────────────────────
  /** Self-update status: whether this install is a git clone and, if so,
   *  whether the tracked upstream/origin remote is ahead. Backs the "update
   *  available" banner and the Settings "check for updates" affordance. Maps to
   *  `server/routes/updates.js`. */
  updates: {
    /**
     * GET /api/updates/status - cached/last-known result.
     *
     * Cheap read that returns whatever the server last computed (it does not
     * hit the network / run git itself), so the UI can render the update banner
     * immediately on load without waiting on a `git fetch`.
     *
     * @returns {@link UpdateStatusPayload} describing clone-vs-tarball, current
     *   vs upstream commit, and whether an update is available.
     */
    status: () => request<UpdateStatusPayload>("/updates/status"),
    /**
     * POST /api/updates/check - force a fresh `git fetch` + comparison.
     *
     * Triggers the server to actually contact the remote and recompute the
     * ahead/behind state, then returns the refreshed payload. Sends an empty
     * JSON body because it's a POST with no parameters. Invoked when the user
     * explicitly clicks "check for updates".
     *
     * @returns The freshly recomputed {@link UpdateStatusPayload}.
     */
    check: () =>
      request<UpdateStatusPayload>("/updates/check", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },

  // ──────────────────────────────── Stats API ────────────────────────────────
  /** Lightweight overview counters for the dashboard header. */
  stats: {
    /**
     * GET /api/stats. Sends the browser's UTC offset so `events_today` is
     * bucketed by the viewer's local midnight, not the server's.
     *
     * The `tz_offset` query param carries `Date#getTimezoneOffset()` (minutes
     * that local time is *behind* UTC) so the server can compute "today" in the
     * viewer's timezone. Polled/refreshed to keep the header counters current.
     *
     * @returns {@link Stats} — the small set of headline counters (totals,
     *   active counts, events-today, etc.) shown in the dashboard header.
     */
    get: () => {
      const qs = new URLSearchParams({ tz_offset: String(new Date().getTimezoneOffset()) });
      applyScope(qs);
      return request<Stats>(`/stats?${qs.toString()}`);
    },
  },

  // ─────────────────────────────── Sessions API ───────────────────────────────
  /** Session CRUD/read, plus their nested agents/events/transcripts. */
  sessions: {
    /**
     * GET /api/sessions/facets - distinct `cwd` values for the filter dropdown.
     *
     * Powers the "working directory" filter on the Sessions list: the server
     * returns the set of distinct project directories seen across sessions so
     * the UI can offer them as filter options.
     *
     * @returns An object with `cwds`: the distinct working-directory strings,
     *   and `sources`: the distinct machine origins present in the data (always
     *   includes at least `"local"`), for the data-scope selector.
     */
    facets: () => {
      const qs = applyScope(new URLSearchParams());
      return request<{ cwds: string[]; sources: string[]; providers: string[] }>(
        `/sessions/facets${qs.size ? `?${qs.toString()}` : ""}`
      );
    },
    /**
     * GET /api/sessions - paginated, filterable, sortable session list.
     *
     * Every parameter is optional and only serialized into the query string
     * when provided, so an argument-less call returns the default first page.
     * `q` is a free-text search; `status`/`cwd` narrow by lifecycle and project
     * directory; `sort_by`/`sort_desc` control ordering; `limit`/`offset` page.
     * Note the `sort_desc` guard uses `!== undefined` (so an explicit `false`
     * is still sent), whereas `limit`/`offset` use truthiness (so `0` is
     * treated as "unset" and omitted).
     *
     * @param params Optional filter/sort/pagination controls.
     * @param params.status   Lifecycle filter (e.g. "active"/"completed").
     * @param params.q        Free-text query matched server-side.
     * @param params.cwd      Restrict to one or more working directories (see `facets`).
     * @param params.sort_by  Column to sort by.
     * @param params.sort_desc Descending when true; sent even when explicitly false.
     * @param params.limit    Page size.
     * @param params.offset   Row offset into the result set.
     * @returns `{ sessions, total, limit, offset }` — the page plus the total
     *   row count and the effective paging window for building pager controls.
     */
    list: (params?: {
      /** Lifecycle status to filter by (for example `active` or `completed`). */
      status?: string;
      /** Free-text search matched server-side. */
      q?: string;
      /** Working directories to include. */
      cwd?: string[];
      /** Sort column: `time` (default), `duration`, or `price`. */
      sort_by?: string;
      /** Sort descending; sent even when explicitly false. */
      sort_desc?: boolean;
      /** Page size. */
      limit?: number;
      /** Rows to skip. */
      offset?: number;
      /** Restrict to one product's sessions. */
      provider?: "claude" | "codex";
      /**
       * Include transient rows: interactive Codex TUI processes discovered in memory before Codex
       * has written a session id. Only added to the first page of local results.
       */
      include_transient?: boolean;
      /** Attach the compact task-progress summary (`todo_summary`) to each row. */
      include_task_progress?: boolean;
    }) => {
      const qs = new URLSearchParams();
      // Only append params that were actually supplied so the URL stays minimal.
      if (params?.status) qs.set("status", params.status);
      if (params?.q) qs.set("q", params.q);
      if (params?.cwd) {
        for (const cwd of params.cwd) qs.append("cwd", cwd);
      }
      if (params?.sort_by) qs.set("sort_by", params.sort_by);
      // `!== undefined` (not truthiness) so an explicit `sort_desc: false` is preserved.
      if (params?.sort_desc !== undefined) qs.set("sort_desc", String(params.sort_desc));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      if (params?.include_transient) qs.set("include_transient", "1");
      if (params?.include_task_progress) qs.set("include_task_progress", "1");
      applyScope(qs); // narrow to the active machine and product scope
      // A provider-specific picker (for example Run Agent resume) must be
      // able to narrow a globally-both dashboard to its native session type.
      if (params?.provider) qs.set("provider", params.provider);
      const queryString = qs.toString();
      // Omit the "?" entirely when there are no params, for a clean/cacheable URL.
      return request<{ sessions: Session[]; total: number; limit: number; offset: number }>(
        `/sessions${queryString ? `?${queryString}` : ""}`
      );
    },
    /**
     * GET /api/sessions/:id - one session with its agents, events, and any
     * Workflow-tool runs launched from it.
     *
     * The single call that hydrates the Session detail page: it returns the
     * session record together with its child agents, its event feed, and any
     * Workflow-tool fleet runs associated with it, so the page can render in
     * one round-trip. The id is URL-encoded to stay safe for path use.
     *
     * @param id The session id.
     * @returns `{ session, agents, events, workflows }` for the detail view.
     */
    get: (id: string) => {
      const qs = applyScope(new URLSearchParams());
      return request<{
        session: Session;
        agents: Agent[];
        events: DashboardEvent[];
        workflows: WorkflowRun[];
      }>(`/sessions/${encodeURIComponent(id)}${qs.size ? `?${qs.toString()}` : ""}`);
    },
    /**
     * GET /api/sessions/:id/stats - per-session rollups for the detail page.
     *
     * Aggregate metrics scoped to a single session (token/tool/cost rollups and
     * similar), rendered in the session detail header/summary cards.
     *
     * @param id The session id.
     * @returns {@link SessionStats} for that one session.
     */
    stats: (id: string) => {
      const qs = applyScope(new URLSearchParams());
      return request<SessionStats>(
        `/sessions/${encodeURIComponent(id)}/stats${qs.size ? `?${qs.toString()}` : ""}`
      );
    },
    /**
     * GET /api/sessions/:id/transcripts - the picker list of available
     * transcripts (main agent, subagents, compaction markers) for this session.
     *
     * Returns the *catalog* of transcripts attached to a session so the UI can
     * offer a dropdown/picker (the main-agent transcript, each subagent's own
     * transcript, and any compaction boundary markers). The actual message
     * content for a chosen transcript is then fetched via
     * {@link api.sessions.transcript}.
     *
     * @param id The session id.
     * @returns {@link TranscriptListResult} — the selectable transcript entries.
     */
    transcripts: (id: string) => {
      const qs = applyScope(new URLSearchParams());
      return request<TranscriptListResult>(
        `/sessions/${encodeURIComponent(id)}/transcripts${qs.size ? `?${qs.toString()}` : ""}`
      );
    },
    /**
     * GET /api/sessions/:id/transcript - a page of parsed transcript messages.
     * Paginate with `after`/`before` (JSONL line numbers from the previous
     * page's `first_line`/`last_line`) rather than `offset` for a live file.
     * Pass `agent_id`/`run_id` to read a subagent's transcript instead of the
     * main session's.
     *
     * Why line-number cursors instead of `offset`: the transcript is a JSONL
     * file that is still being appended to while the user reads it. A numeric
     * `offset` would shift as new lines arrive, causing skips/duplicates; the
     * `after`/`before` line-number cursors are stable anchors into the file.
     * `limit`/`offset` are still accepted (and forwarded) for callers that want
     * simple windowing, but the `after`/`before` cursors are the live-safe path.
     * `after`/`before` use a `!= null` guard so line number `0` is still sent.
     *
     * @param id     The session id (owning session of the transcript).
     * @param params Optional selectors/pagination.
     * @param params.agent_id Read a specific subagent's transcript.
     * @param params.run_id   Read a specific Workflow-tool run's transcript.
     * @param params.limit    Max messages to return in this page.
     * @param params.offset   Legacy numeric offset (prefer after/before live).
     * @param params.after    Return messages after this JSONL line number.
     * @param params.before   Return messages before this JSONL line number.
     * @returns {@link TranscriptResult} — the page of messages plus the
     *   `first_line`/`last_line` cursors to feed the next/previous page.
     */
    transcript: (
      id: string,
      params?: {
        /** Read a subagent's transcript instead of the main one. */
        agent_id?: string;
        /** Read a Workflow-tool run's transcript. */
        run_id?: string;
        /** Maximum messages to return. */
        limit?: number;
        /** Legacy numeric offset; prefer the line cursors for live files. */
        offset?: number;
        /** Return messages after this JSONL line number. */
        after?: number;
        /** Return messages before this JSONL line number. */
        before?: number;
      }
    ) => {
      const qs = new URLSearchParams();
      if (params?.agent_id) qs.set("agent_id", params.agent_id);
      if (params?.run_id) qs.set("run_id", params.run_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      // `!= null` so a legitimate line number of 0 is forwarded (0 is falsy).
      if (params?.after != null) qs.set("after", String(params.after));
      if (params?.before != null) qs.set("before", String(params.before));
      applyScope(qs);
      const q = qs.toString();
      return request<TranscriptResult>(
        `/sessions/${encodeURIComponent(id)}/transcript${q ? `?${q}` : ""}`
      );
    },
  },

  // ──────────────────────────────── Agents API ────────────────────────────────
  agents: {
    /**
     * GET /api/agents - agent list, optionally filtered by status/session.
     *
     * Returns spawned agents across the fleet, optionally narrowed to a single
     * `session_id` and/or lifecycle `status`, with `limit`/`offset` paging.
     * Only supplied params are serialized. Backs the global Agents view and the
     * per-session agent lists.
     *
     * @param params Optional filters/paging.
     * @param params.status     Lifecycle filter for the agents.
     * @param params.session_id Restrict to agents of one session.
     * @param params.limit      Page size.
     * @param params.offset     Row offset.
     * @returns `{ agents }` — the matching agents (note: no `total` here).
     */
    list: (params?: {
      /** Agent status to filter by. */
      status?: string;
      /** Restrict to one session's agents. */
      session_id?: string;
      /** Page size; the server defaults to its 10,000-row cap. */
      limit?: number;
      /** Rows to skip. */
      offset?: number;
      /**
       * Include transient rows: interactive Codex TUI processes discovered in memory before Codex
       * has written a session id. Only added to the first page of local results. Only applies when
       * filtering by `waiting`.
       */
      include_transient?: boolean;
    }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      if (params?.include_transient) qs.set("include_transient", "1");
      applyScope(qs); // narrow to the active data scope (source machines)
      const q = qs.toString();
      return request<{ agents: Agent[] }>(`/agents${q ? `?${q}` : ""}`);
    },
  },

  // ──────────────────────────────── Events API ────────────────────────────────
  events: {
    /**
     * GET /api/events - the global cross-session event feed. Array-valued
     * filters (`event_type`/`tool_name`/`agent_id`) are OR'd server-side via
     * comma-joined query params.
     *
     * This is the firehose view across all sessions. The multi-valued filters
     * are flattened to a single comma-separated query param each (via the local
     * `csv` helper); the server treats the members of one param as an OR set.
     * `session_id` is special-cased: it accepts either a single string or an
     * array (arrays get the same comma-join treatment; a lone string is sent
     * as-is). `q` is free-text; `from`/`to` bound the time window. `limit`/
     * `offset` use `!= null` guards so `0` is still forwarded.
     *
     * @param params Optional filters/paging.
     * @param params.event_type Event-type names to include (OR'd).
     * @param params.tool_name  Tool names to include (OR'd).
     * @param params.agent_id   Agent ids to include (OR'd).
     * @param params.session_id One session id, or an array of them (OR'd).
     * @param params.q          Free-text search across events.
     * @param params.from       Start of the time window (server-parsed).
     * @param params.to         End of the time window (server-parsed).
     * @param params.limit      Page size (0 allowed/forwarded).
     * @param params.offset     Row offset (0 allowed/forwarded).
     * @returns `{ events, limit, offset, total }` — the page and paging metadata.
     */
    list: (params?: {
      /** Event types to include (OR'd). */
      event_type?: string[];
      /** Tool names to include (OR'd). */
      tool_name?: string[];
      /** Agent ids to include (OR'd). */
      agent_id?: string[];
      /** One session id, or several (OR'd). */
      session_id?: string | string[];
      /** Free-text search across event summaries. */
      q?: string;
      /** Start of the time window. */
      from?: string;
      /** End of the time window. */
      to?: string;
      /** Page size; 0 is forwarded. */
      limit?: number;
      /** Rows to skip; 0 is forwarded. */
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      // Collapse a string[] filter into a single comma-joined value, or undefined
      // when empty/absent so it is skipped entirely below.
      const csv = (v?: string[]) => (v && v.length > 0 ? v.join(",") : undefined);
      const et = csv(params?.event_type);
      const tn = csv(params?.tool_name);
      const ag = csv(params?.agent_id);
      // session_id may be a single id or an array; only arrays go through `csv`.
      const sid = Array.isArray(params?.session_id) ? csv(params?.session_id) : params?.session_id;
      if (et) qs.set("event_type", et);
      if (tn) qs.set("tool_name", tn);
      if (ag) qs.set("agent_id", ag);
      if (sid) qs.set("session_id", sid);
      if (params?.q) qs.set("q", params.q);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      // `!= null` so an explicit 0 page size / offset is still sent.
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      applyScope(qs); // narrow to the active data scope (source machines)
      const q = qs.toString();
      return request<{
        events: DashboardEvent[];
        limit: number;
        offset: number;
        total: number;
      }>(`/events${q ? `?${q}` : ""}`);
    },
    /**
     * GET /api/events/facets - distinct event/tool names for filter dropdowns.
     *
     * Supplies the option lists for the Events page's event-type and tool-name
     * multi-selects, so the filter UI only offers values that actually occur.
     *
     * @returns `{ event_types, tool_names }` — the distinct values for each filter.
     */
    facets: () => {
      const qs = applyScope(new URLSearchParams());
      return request<{ event_types: string[]; tool_names: string[] }>(
        `/events/facets${qs.size ? `?${qs.toString()}` : ""}`
      );
    },
  },

  // ─────────────────────────────── Analytics API ──────────────────────────────
  /** Chart-oriented usage analytics for the Analytics page. */
  analytics: {
    /**
     * GET /api/analytics. `tz_offset` shifts the daily buckets to local time,
     * same convention as {@link api.stats.get}.
     *
     * Returns the full analytics bundle (time-series and aggregate breakdowns)
     * that the Analytics page renders as charts. Because the data is grouped by
     * day, the viewer's timezone offset is sent so the daily buckets align to
     * the user's local midnight.
     *
     * @returns {@link Analytics} — the chart-ready analytics payload.
     */
    get: () => {
      const qs = new URLSearchParams({ tz_offset: String(new Date().getTimezoneOffset()) });
      applyScope(qs);
      return request<Analytics>(`/analytics?${qs.toString()}`);
    },
  },

  // ─────────────────────────────── Settings API ───────────────────────────────
  /** Server/DB introspection and destructive maintenance operations for the
   *  Settings page (info, hooks reinstall, data reset, pricing reset, cleanup). */
  settings: {
    /**
     * GET /api/settings/info - DB size/pragmas, hook install status, server
     * process stats, and transcript-cache stats, all in one call.
     *
     * A single diagnostics snapshot for the Settings page. The large inline
     * response type documents exactly what the server reports:
     *   - `db`: SQLite file path/size, per-table row `counts`, the effective
     *     `pragmas` (journal mode, synchronous level, auto-vacuum, encoding,
     *     foreign-key enforcement, busy timeout), and short-window write
     *     `load_stats` (5-/15-/60-minute rates).
     *   - `hooks`: whether the dashboard's Claude Code hooks are installed, the
     *     settings.json path, and a per-hook installed map.
     *   - `server`: dashboard release `version`, process uptime, Node version,
     *     platform/arch, live WebSocket connection count, process memory, CPU
     *     load averages, and host memory/cpu counts.
     *   - `transcript_cache`: LRU cache occupancy, capacity, hit/miss counts,
     *     and the currently-cached keys.
     *   - `snapshots`: durable transcript snapshot storage per provider dir
     *     (bytes, files, compressed share) and the active retention policy.
     *
     * @returns The combined diagnostics object described above.
     */
    info: () =>
      request<{
        db: {
          path: string;
          size: number;
          counts: Record<string, number>;
          pragmas: {
            journal_mode: string;
            synchronous: number;
            auto_vacuum: number;
            encoding: string;
            foreign_keys: number;
            busy_timeout: number;
          };
          load_stats: { m5: number; m15: number; h1: number };
        };
        hooks: {
          installed: boolean;
          path: string;
          hooks: Record<string, boolean>;
          providers?: Record<
            "claude" | "codex",
            {
              installed: boolean;
              has_dashboard_hooks?: boolean;
              has_existing_hooks?: boolean;
              path: string;
              hooks: Record<string, boolean>;
            }
          >;
        };
        server: {
          version: string;
          uptime: number;
          node_version: string;
          platform: string;
          ws_connections: number;
          memory: { rss: number; heapTotal: number; heapUsed: number; external: number };
          cpu_load: number[];
          arch: string;
          total_mem: number;
          free_mem: number;
          cpus: number;
        };
        transcript_cache: {
          size: number;
          maxSize: number;
          hits: number;
          misses: number;
          keys: string[];
        };
        snapshots?: SnapshotStorage;
      }>("/settings/info"),
    /** Get/set the `~/.claude` root the server reads config from. Lets an
     *  operator point the dashboard at a non-default Claude Code home (e.g. a
     *  different user profile) without restarting. */
    claudeHome: {
      /**
       * GET /api/settings/claude-home - the currently configured Claude home path.
       * @returns `{ claude_home }` — the absolute path the server reads config from.
       */
      get: () => request<{ claude_home: string }>("/settings/claude-home"),
      /**
       * PUT /api/settings/claude-home - repoint the server at a new Claude home.
       * @param path New absolute `~/.claude` root the server should read from.
       * @returns `{ ok, claude_home }` — success flag and the accepted path.
       */
      set: (path: string) =>
        request<{ ok: boolean; claude_home: string }>("/settings/claude-home", {
          method: "PUT",
          body: JSON.stringify({ path }),
        }),
    },
    /** Get/set the local Codex state root. Changing it re-arms the live rollout
     * watcher and immediately scans the selected `sessions/` tree. */
    codexHome: {
      /** @returns `{ codex_home }` — the resolved Codex state directory. */
      get: () => request<{ codex_home: string }>("/settings/codex-home"),
      /** @param path New absolute `~/.codex`-style directory. */
      set: (path: string) =>
        request<{ ok: boolean; codex_home: string }>("/settings/codex-home", {
          method: "PUT",
          body: JSON.stringify({ path }),
        }),
    },
    /**
     * POST /api/settings/clear-data - DESTRUCTIVE: wipes sessions/agents/
     * events/etc. from the dashboard DB. Returns per-table row counts deleted.
     *
     * Empties the dashboard's own SQLite tables (it does not touch the user's
     * on-disk Claude Code transcripts). Guarded behind an explicit confirmation
     * in the Settings UI. Sent as a bodyless POST.
     *
     * @returns `{ ok, cleared }` where `cleared` maps each table name to the
     *   number of rows deleted from it.
     */
    clearData: () =>
      request<{ ok: boolean; cleared: Record<string, number> }>("/settings/clear-data", {
        method: "POST",
      }),
    /**
     * POST /api/settings/reimport - re-scan `~/.claude/projects` and
     * backfill anything not already in the DB.
     *
     * Additive counterpart to `clearData`: re-reads the on-disk project
     * transcripts and inserts anything missing, leaving existing rows in place.
     *
     * @returns `{ ok, imported, skipped, errors }` — counts of newly imported
     *   rows, already-present rows skipped, and parse/import failures.
     */
    reimport: () =>
      request<{ ok: boolean; imported: number; skipped: number; errors: number }>(
        "/settings/reimport",
        { method: "POST" }
      ),
    /**
     * POST /api/settings/reinstall-hooks - re-write the dashboard's Claude
     * Code hook entries into `~/.claude/settings.json`.
     *
     * Repairs/re-applies the hook wiring that feeds this dashboard (used when a
     * user has edited settings.json or the install drifted). Returns the
     * post-install hook status so the UI can reflect the new state.
     *
     * @returns `{ ok, hooks }` where `hooks.installed` and `hooks.hooks`
     *   describe the resulting per-hook install state.
     */
    reinstallHooks: () =>
      request<{ ok: boolean; hooks: { installed: boolean; hooks: Record<string, boolean> } }>(
        "/settings/reinstall-hooks",
        { method: "POST" }
      ),
    /** Install the selected dashboard lifecycle hooks from the Settings chooser. */
    installHooks: (providers: Array<"claude" | "codex">) =>
      request<{
        ok: boolean;
        results: Record<
          string,
          { ok: boolean; replaced?: boolean; output?: string[]; status?: Record<string, unknown> }
        >;
        hooks: {
          installed: boolean;
          providers: Record<
            string,
            { installed: boolean; path: string; hooks: Record<string, boolean> }
          >;
        };
      }>("/settings/install-hooks", { method: "POST", body: JSON.stringify({ providers }) }),
    /**
     * POST /api/settings/reset-pricing - restore the built-in default
     * {@link ModelPricing} rules, discarding any custom edits.
     *
     * Wipes user-customized pricing rules and reseeds the shipped defaults;
     * returns the resulting rule set so the Pricing UI can re-render.
     *
     * @returns `{ ok, pricing }` — the full default rule list now in effect.
     */
    resetPricing: (provider?: "claude" | "cursor" | "codex") =>
      request<{
        ok: boolean;
        provider: "claude" | "cursor" | "codex" | "both";
        pricing: ModelPricing[];
        cursor_pricing: CursorModelPricing[];
        gpt_pricing: GptModelPricing[];
      }>("/settings/reset-pricing", {
        method: "POST",
        body: provider ? JSON.stringify({ provider }) : undefined,
      }),
    /**
     * Direct download URL for GET /api/settings/export (a full DB dump);
     * not fetched via {@link request} since it's used as an `<a href>`.
     *
     * Returns a *string*, not a promise: this is the one endpoint the client
     * navigates to (an anchor download) rather than XHR-fetching, so no auth
     * header can be attached here — the export route is expected to be reachable
     * with the same-origin session the page already has.
     *
     * @returns The absolute-on-origin URL (`/api/settings/export`) to link to.
     */
    exportData: () => `${BASE}/settings/export`,
    /**
     * POST /api/settings/import (multipart) - restore a bundle previously
     * produced by {@link exportData}. Idempotent and non-destructive: sessions
     * already present are skipped whole, so importing a backup (or another
     * machine's export) never duplicates or overwrites live data.
     *
     * Like {@link api.import.upload}, this bypasses {@link request} to send a
     * `multipart/form-data` body (field name "file") and let the browser set the
     * boundary. No auth token is attached (local/zero-config flow).
     *
     * @param file The `.json` export file the user selected.
     * @returns {@link ImportBackupResult} — per-table restore counts.
     * @throws {Error} On a non-2xx response, mirroring {@link request}.
     */
    importData: async (file: File): Promise<ImportBackupResult> => {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch(`${BASE}/settings/import`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      return res.json();
    },
    /**
     * POST /api/settings/cleanup - DESTRUCTIVE: marks sessions idle longer
     * than `abandon_hours` as "abandoned", and purges rows older than
     * `purge_days`. Returns counts of what was abandoned/purged.
     *
     * Maintenance sweep with two independent knobs, both optional: sessions that
     * have been idle beyond `abandon_hours` are transitioned to the "abandoned"
     * state, and any rows older than `purge_days` are hard-deleted. The params
     * object is always sent (it's required by the signature) so the server can
     * apply its own defaults for any omitted field.
     *
     * @param params Retention thresholds.
     * @param params.abandon_hours Idle-hours cutoff after which a session is abandoned.
     * @param params.purge_days    Age-in-days cutoff after which rows are purged.
     * @returns `{ ok, abandoned, purged_sessions, purged_events, purged_agents,
     *   purged_snapshot_files, purged_snapshot_bytes }` — how many records each
     *   part of the sweep affected, including the purged sessions' transcript
     *   snapshot files.
     */
    cleanup: (params: { abandon_hours?: number; purge_days?: number }) =>
      request<{
        ok: boolean;
        abandoned: number;
        purged_sessions: number;
        purged_events: number;
        purged_agents: number;
        purged_snapshot_files?: number;
        purged_snapshot_bytes?: number;
      }>("/settings/cleanup", { method: "POST", body: JSON.stringify(params) }),
    /** Durable transcript snapshots — the copies that keep the Conversation
     *  tab working after Claude Code, Codex, or Cursor delete their own
     *  transcripts (issue #358). */
    snapshots: {
      /**
       * GET /api/settings/snapshots - per-provider snapshot storage and policy.
       * @returns Fresh (uncached) {@link SnapshotStorage}.
       */
      get: () => request<SnapshotStorage>("/settings/snapshots"),
      /**
       * POST /api/settings/snapshots/compress - lossless: gzip every snapshot
       * whose original transcript is gone, verified before the plain copy is
       * removed. Safe to run any time.
       * @returns Counts plus the refreshed storage report.
       */
      compress: () =>
        request<{
          ok: boolean;
          compressed: number;
          bytes_before: number;
          bytes_after: number;
          failed: number;
          skipped_roots: string[];
          storage: SnapshotStorage;
        }>("/settings/snapshots/compress", { method: "POST" }),
      /**
       * POST /api/settings/snapshots/prune - remove snapshots of old finished
       * sessions. DRY RUN unless `dry_run: false` AND `confirm:
       * "PRUNE_SNAPSHOTS"` are both sent; pruned snapshots may be the only
       * remaining copy of a conversation.
       * @param params.max_age_days Prune finished sessions idle longer than this.
       * @param params.max_bytes    Then prune oldest-first until under this size.
       * @param params.orphans      Also prune snapshots with no session row.
       * @returns The plan (and, when applied, what was removed).
       */
      prune: (params: {
        /** Prune finished sessions idle longer than this many days. */
        max_age_days?: number;
        /**
         * Then prune oldest-first until the total is under this size: bytes, or a size string such
         * as `5GB`.
         */
        max_bytes?: number | string;
        /** Also prune snapshots that have no session row. */
        orphans?: boolean;
        /** Preview only; the server treats anything but an explicit `false` as a dry run. */
        dry_run?: boolean;
        /** Required, with `dry_run: false`, to actually delete. */
        confirm?: "PRUNE_SNAPSHOTS";
      }) =>
        request<SnapshotPruneResult>("/settings/snapshots/prune", {
          method: "POST",
          body: JSON.stringify(params),
        }),
    },
  },

  // ─────────────────────────────── Workflows API ──────────────────────────────
  /** Events-derived workflow intelligence (`get`/`session`) plus Workflow-tool
   *  fleet runs ingested from on-disk journals (`runs`/`run`). */
  workflows: {
    /**
     * GET /api/workflows - the full {@link WorkflowData} panel bundle,
     * optionally filtered to "active"/"completed" sessions.
     *
     * The `status` filter is only appended when it is set *and* not the sentinel
     * "all" (which means "no filter"), keeping the default URL param-free.
     *
     * @param status Optional lifecycle filter; "all" (or omitted) means no filter.
     * @returns {@link WorkflowData} — the aggregated workflow-intelligence panel.
     */
    get: (status?: string) => {
      const qs = new URLSearchParams();
      if (status && status !== "all") qs.set("status", status);
      applyScope(qs);
      return request<WorkflowData>(`/workflows${qs.size ? `?${qs.toString()}` : ""}`);
    },
    /**
     * GET /api/workflows/session/:id - single-session drill-in (agent tree,
     * tool timeline, swim lanes).
     *
     * Detailed per-session workflow reconstruction derived from that session's
     * events, powering the drill-in visualizations.
     *
     * @param id The session id to reconstruct.
     * @returns {@link SessionDrillIn} — the agent tree, tool timeline, and lanes.
     */
    session: (id: string) => {
      const qs = applyScope(new URLSearchParams());
      return request<SessionDrillIn>(
        `/workflows/session/${encodeURIComponent(id)}${qs.size ? `?${qs.toString()}` : ""}`
      );
    },
    // Workflow-tool runs (issue #167) - fleets ingested from on-disk journals.
    // These two endpoints cover fleets that emit no hooks: the server reads their
    // run journals off disk (see server/lib/workflow-ingest.js) instead of the
    // usual hook -> event pipeline, so they live under their own routes.
    /**
     * GET /api/workflows/runs - paginated Workflow-tool run list.
     *
     * Same "skip "all"" convention for `status` as {@link api.workflows.get};
     * `limit`/`offset` use `!= null` guards so `0` is forwarded.
     *
     * @param params Optional filters/paging.
     * @param params.status     Lifecycle filter; "all"/omitted means no filter.
     * @param params.session_id Restrict to runs of one session.
     * @param params.limit      Page size (0 allowed).
     * @param params.offset     Row offset (0 allowed).
     * @returns {@link WorkflowRunsResponse} — the page of runs plus paging info.
     */
    runs: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status && params.status !== "all") qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      applyScope(qs);
      const q = qs.toString();
      return request<WorkflowRunsResponse>(`/workflows/runs${q ? `?${q}` : ""}`);
    },
    /**
     * GET /api/workflows/runs/:runId - one run with its inner agents/events.
     *
     * The Workflow-tool analog of {@link api.sessions.get}: expands a single
     * ingested run into its nested agents and events for a detail view.
     *
     * @param runId The Workflow-tool run id.
     * @returns {@link WorkflowRunDetail} — the run plus its agents and events.
     */
    run: (runId: string) => {
      const qs = applyScope(new URLSearchParams());
      return request<WorkflowRunDetail>(
        `/workflows/runs/${encodeURIComponent(runId)}${qs.size ? `?${qs.toString()}` : ""}`
      );
    },
  },

  // ─────────────────────────────── Pricing API ────────────────────────────────
  /** {@link ModelPricing} rule CRUD, plus computed cost totals. */
  pricing: {
    /**
     * GET /api/pricing - all configured pricing rules.
     * @returns `{ pricing }` — the full list of {@link ModelPricing} rules.
     */
    list: () => request<{ pricing: ModelPricing[] }>("/pricing"),
    /** GET /api/pricing/cursor - Cursor-native and routed model price rules. */
    listCursor: () => request<{ pricing: CursorModelPricing[] }>("/pricing/cursor"),
    /** PUT /api/pricing/cursor - create or update a Cursor price rule. */
    upsertCursor: (data: Omit<CursorModelPricing, "updated_at">) =>
      request<{ pricing: CursorModelPricing }>("/pricing/cursor", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    /** DELETE /api/pricing/cursor/:pattern - remove a Cursor price rule. */
    deleteCursor: (pattern: string) =>
      request<{ ok: boolean }>(`/pricing/cursor/${encodeURIComponent(pattern)}`, {
        method: "DELETE",
      }),
    /** GET /api/pricing/gpt - OpenAI/Codex price rules, separate from Claude pricing. */
    listGpt: () => request<{ pricing: GptModelPricing[] }>("/pricing/gpt"),
    /** PUT /api/pricing/gpt - create or update an OpenAI/Codex price rule. */
    upsertGpt: (data: Omit<GptModelPricing, "updated_at">) =>
      request<{ pricing: GptModelPricing }>("/pricing/gpt", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    /** DELETE /api/pricing/gpt/:pattern - remove an OpenAI/Codex price rule. */
    deleteGpt: (pattern: string) =>
      request<{ ok: boolean }>(`/pricing/gpt/${encodeURIComponent(pattern)}`, { method: "DELETE" }),
    /**
     * PUT /api/pricing - create a new rule or overwrite the one matching
     * `data.model_pattern` (the primary key).
     *
     * Upsert semantics keyed on `model_pattern`: an existing rule with the same
     * pattern is replaced, otherwise a new one is created. The `updated_at`
     * field is server-managed, hence it is `Omit`ted from the argument type.
     *
     * @param data A {@link ModelPricing} rule minus its server-set `updated_at`.
     * @returns `{ pricing }` — the single upserted rule as persisted.
     */
    upsert: (data: Omit<ModelPricing, "updated_at">) =>
      request<{ pricing: ModelPricing }>("/pricing", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    /**
     * DELETE /api/pricing/:pattern - remove a rule; usage matching it then
     * falls through to a less-specific rule or `unpriced_models`.
     *
     * The pattern is URL-encoded because model patterns can contain characters
     * (slashes, brackets) that are unsafe in a path segment.
     *
     * @param pattern The `model_pattern` primary key of the rule to delete.
     * @returns `{ ok }` — success flag.
     */
    delete: (pattern: string) =>
      request<{ ok: boolean }>(`/pricing/${encodeURIComponent(pattern)}`, {
        method: "DELETE",
      }),
    /**
     * GET /api/pricing/cost - total cost across every session, priced with
     * each day's rate (respects time-limited intro pricing).
     *
     * Because pricing rules can carry date-bounded intro rates, the server
     * prices each day's usage with that day's effective rate; `tz_offset` keeps
     * the day boundaries aligned to the viewer's timezone.
     *
     * @returns {@link CostResult} — the aggregate cost breakdown across sessions.
     */
    totalCost: () => {
      // Scope the aggregate to the active data-scope, exactly like the sessions /
      // stats / analytics endpoints — otherwise switching the Data scope selector
      // left the Dashboard "total cost" showing the un-narrowed global total.
      const qs = new URLSearchParams({ tz_offset: String(new Date().getTimezoneOffset()) });
      applyScope(qs);
      return request<CostResult>(`/pricing/cost?${qs.toString()}`);
    },
    /**
     * GET /api/pricing/cost/:sessionId - cost for one session, priced as of
     * the session's start date.
     *
     * Single-session cost, priced using the rate in effect on that session's
     * start date. `tz_offset` again aligns date handling to the viewer.
     *
     * @param sessionId The session to price.
     * @returns {@link CostResult} — the cost breakdown for that one session.
     */
    sessionCost: (sessionId: string) => {
      const qs = new URLSearchParams({ tz_offset: String(new Date().getTimezoneOffset()) });
      applyScope(qs);
      return request<CostResult>(`/pricing/cost/${encodeURIComponent(sessionId)}?${qs.toString()}`);
    },
  },

  // ──────────────────────────────── Import API ────────────────────────────────
  /** Transcript import: on-disk scan/rescan, an explicit path scan, or a
   *  browser file upload - all three converge on the same {@link ImportResult}
   *  shape and stream progress via the `import.progress` WS message. */
  import: {
    /**
     * GET /api/import/guide - provider-specific instructions and constraints
     * (default projects dir, supported extensions, upload limits) shown on
     * first run / in the Import wizard.
     *
     * Returns everything the Import wizard needs to render its guidance without
     * hard-coding platform details in the client: the OS `platform`, the
     * default projects directory (raw + display form + existence + a quick
     * `{ projects, jsonl_files }` count), the recommended `archive_command`,
     * the accepted file extensions, upload size/count caps, and an ordered list
     * of wizard `steps`.
     *
     * @returns The import-guide payload described above.
     */
    guide: (provider: RunProvider = "claude") =>
      request<{
        provider: RunProvider;
        platform: string;
        default_projects_dir: string;
        default_projects_dir_display: string;
        default_projects_dir_exists: boolean;
        default_projects_dir_stats: { projects: number; jsonl_files: number };
        archive_command: string;
        supported_extensions: string[];
        max_upload_bytes: number;
        max_upload_files: number;
        steps: { id: string; title: string; body: string }[];
      }>(`/import/guide?provider=${encodeURIComponent(provider)}`),
    /**
     * POST /api/import/rescan - re-scan the default projects directory.
     *
     * Kicks off an import over the server's default `~/.claude/projects` dir.
     * Progress is pushed live over the `import.progress` WebSocket message; the
     * returned {@link ImportResult} is the final tally (`source: "default"`).
     *
     * @returns {@link ImportResult} — the completed-scan summary.
     */
    rescan: (provider: RunProvider = "claude") =>
      request<ImportResult>("/import/rescan", {
        method: "POST",
        body: JSON.stringify({ provider }),
      }),
    /**
     * POST /api/import/scan-path - scan an arbitrary directory for
     * Claude Code project transcripts.
     *
     * Like `rescan` but over a user-provided directory (`source: "path"`),
     * useful for importing an archive extracted somewhere non-default.
     *
     * @param path Absolute directory to scan for transcripts.
     * @returns {@link ImportResult} — the completed-scan summary for that path.
     */
    scanPath: (path: string, provider: RunProvider = "claude") =>
      request<ImportResult>("/import/scan-path", {
        method: "POST",
        body: JSON.stringify({ path, provider }),
      }),
    /**
     * POST /api/import/upload (multipart) - import a set of user-selected
     * transcript files. Bypasses {@link request} to use `FormData`.
     *
     * This is one of the two deliberate escapes from {@link request}: a
     * `multipart/form-data` body must be built with `FormData` and must let the
     * browser set its own `Content-Type` (with the multipart boundary), so this
     * hand-rolls `fetch` and reproduces `request`'s error-normalization inline.
     * Each selected `File` is appended under the field name "files" (preserving
     * its original filename). Result `source` is "upload".
     *
     * Note: no auth token is attached here (unlike {@link request}); the upload
     * route is used in the local/zero-config import flow.
     *
     * @param files The user-selected transcript files to upload.
     * @returns {@link ImportResult} — the completed-upload summary.
     * @throws {Error} On a non-2xx response, mirroring {@link request}: the
     *   server's `error.message` if present, else `HTTP <status>`.
     */
    upload: async (files: File[], provider: RunProvider = "claude"): Promise<ImportResult> => {
      const form = new FormData();
      // Append each file under the repeated "files" field, keeping its filename.
      for (const f of files) form.append("files", f, f.name);
      form.append("provider", provider);
      // Do NOT set Content-Type manually: the browser adds the multipart boundary.
      const res = await fetch(`${BASE}/import/upload`, { method: "POST", body: form });
      if (!res.ok) {
        // Same error-shaping contract as request(), duplicated because this call
        // intentionally does not route through the JSON wrapper.
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      return res.json();
    },
  },

  // ─────────────────────────────── CC-Config API ──────────────────────────────
  /** Read/write access to on-disk Claude Code configuration - skills, agents,
   *  commands, output styles, plugins, MCP servers, hooks, settings.json,
   *  CLAUDE.md/auto-memory, marketplaces, keybindings, and the statusline
   *  script - for the dashboard's "CC Config" explorer/editor pages. */
  ccConfig: {
    /**
     * GET /api/cc-config/overview - counts of every artifact kind, for the
     * explorer's landing page.
     * @returns {@link CcOverview} — filesystem roots plus per-kind counts.
     */
    overview: () => request<CcOverview>("/cc-config/overview"),
    /**
     * GET /api/cc-config/skills - user and/or project SKILL.md files.
     *
     * The optional `scope` is appended as `?scope=` only when provided; omitting
     * it lets the server apply its default scope. Same pattern for the sibling
     * list endpoints below (`agents`, `commands`, `outputStyles`).
     *
     * @param scope Optional {@link CcScope} ("user"|"project"|"all") filter.
     * @returns `{ items }` — the {@link CcMdItem} summaries for each skill.
     */
    skills: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/skills${scope ? `?scope=${scope}` : ""}`),
    /**
     * GET /api/cc-config/agents - user and/or project subagent definitions.
     * @param scope Optional {@link CcScope} filter.
     * @returns `{ items }` — {@link CcMdItem} summaries for each subagent.
     */
    agents: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/agents${scope ? `?scope=${scope}` : ""}`),
    /**
     * GET /api/cc-config/commands - user and/or project slash commands.
     * @param scope Optional {@link CcScope} filter.
     * @returns `{ items }` — {@link CcMdItem} summaries for each command.
     */
    commands: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/commands${scope ? `?scope=${scope}` : ""}`),
    /**
     * GET /api/cc-config/output-styles.
     * @param scope Optional {@link CcScope} filter.
     * @returns `{ items }` — {@link CcMdItem} summaries for each output style.
     */
    outputStyles: (scope?: CcScope) =>
      request<{ items: CcMdItem[] }>(`/cc-config/output-styles${scope ? `?scope=${scope}` : ""}`),
    /**
     * GET /api/cc-config/plugins - installed marketplace plugins and what
     * each one contributes (skills/agents/commands/hooks counts).
     * @returns {@link CcPluginsResponse} — the manifest path/status plus plugins.
     */
    plugins: () => request<CcPluginsResponse>("/cc-config/plugins"),
    /**
     * GET /api/cc-config/mcp - configured MCP servers, user and project-scoped.
     * @returns {@link CcMcpResponse} — servers split into `user`/`projectScoped`.
     */
    mcp: () => request<CcMcpResponse>("/cc-config/mcp"),
    /**
     * GET /api/cc-config/hooks - hook entries from every settings.json layer.
     * @returns `{ items }` — one {@link CcHookSource} per settings layer.
     */
    hooks: () => request<{ items: CcHookSource[] }>("/cc-config/hooks"),
    /**
     * GET /api/cc-config/settings - raw settings.json files by scope.
     * @returns `{ items }` — one {@link CcSettingsSource} per scope layer.
     */
    settings: () => request<{ items: CcSettingsSource[] }>("/cc-config/settings"),
    /**
     * GET /api/cc-config/memory - CLAUDE.md files plus per-project auto-memory.
     * @returns `{ items }` — {@link CcMemoryItem}s for CLAUDE.md + auto-memory.
     */
    memory: () => request<{ items: CcMemoryItem[] }>("/cc-config/memory"),
    /**
     * GET /api/cc-config/file - raw contents of one config file by absolute path.
     *
     * The absolute path is passed as a URL-encoded `path` query param (not a
     * path segment) so arbitrary filesystem paths survive intact.
     *
     * @param absPath Absolute path of the config file to read.
     * @returns {@link CcFileResponse} — file text (possibly truncated) + metadata.
     */
    file: (absPath: string) =>
      request<CcFileResponse>(`/cc-config/file?path=${encodeURIComponent(absPath)}`),
    /**
     * PUT /api/cc-config/file - create/overwrite a config artifact; the
     * server writes a backup of any previous content first.
     *
     * The write is always preceded server-side by a timestamped backup (see
     * {@link api.ccConfig.backups}), so edits are reversible.
     *
     * @param args {@link CcWriteArgs} — scope/type/name/content (+project for auto-memory).
     * @returns {@link CcMutationResult} — the written path, backup path, and
     *   whether a new file was `created`.
     */
    write: (args: CcWriteArgs) =>
      request<CcMutationResult>("/cc-config/file", {
        method: "PUT",
        body: JSON.stringify(args),
      }),
    /**
     * DELETE /api/cc-config/file - remove a config artifact (also backed up).
     *
     * Note the DELETE carries a JSON body ({@link CcDeleteArgs}) identifying the
     * artifact by scope/type/name rather than encoding it in the URL.
     *
     * @param args {@link CcDeleteArgs} — which artifact to delete.
     * @returns {@link CcMutationResult} — the deleted path and its backup path.
     */
    delete: (args: CcDeleteArgs) =>
      request<CcMutationResult>("/cc-config/file", {
        method: "DELETE",
        body: JSON.stringify(args),
      }),
    /**
     * GET /api/cc-config/marketplaces - registered plugin marketplaces.
     * @returns {@link CcMarketplacesResponse} — the registry path/status + items.
     */
    marketplaces: () => request<CcMarketplacesResponse>("/cc-config/marketplaces"),
    /**
     * GET /api/cc-config/keybindings - parsed `keybindings.json`.
     * @returns {@link CcKeybindings} — grouped key/action bindings + file metadata.
     */
    keybindings: () => request<CcKeybindings>("/cc-config/keybindings"),
    /**
     * PUT /api/cc-config/keybindings - overwrite the user's `keybindings.json`
     * from a structured list of groups. The server backs the file up first and
     * preserves any top-level metadata (`$schema`/`$docs`), replacing only the
     * `bindings` array.
     *
     * @param groups Full set of {@link CcKeybindingGroup}s to persist.
     * @returns {@link CcMutationResult} — the written path, backup path, and
     *   whether the file was newly `created`.
     */
    writeKeybindings: (groups: CcKeybindingGroup[]) =>
      request<CcMutationResult>("/cc-config/keybindings", {
        method: "PUT",
        body: JSON.stringify({ groups }),
      }),
    /**
     * GET /api/cc-config/statusline - active statusline config + scripts.
     * @returns {@link CcStatusline} — the active config plus discovered scripts.
     */
    statusline: () => request<CcStatusline>("/cc-config/statusline"),
    /**
     * GET /api/cc-config/hook-scripts - shell scripts referenced by hooks.
     * @returns {@link CcHookScripts} — the hooks dir and the scripts found in it.
     */
    hookScripts: () => request<CcHookScripts>("/cc-config/hook-scripts"),
    /**
     * GET /api/cc-config/backups - timestamped backups written by `write`/
     * `delete`, optionally filtered by scope/artifact type.
     *
     * Delegates query-string building to the module-level
     * {@link requestBackupsHelper} (extracted purely so its logic is
     * independently unit-referenceable).
     *
     * @param params Optional `{ scope, type }` filter.
     * @returns `{ items }` — the matching {@link CcBackup} entries.
     */
    backups: (params?: { scope?: "user" | "project"; type?: CcArtifactType }) =>
      requestBackupsHelper(params),
  },

  /** Local Codex configuration discovery. Normal inspection is redacted;
   * the separate editor read is limited to a small text-file allowlist so a
   * user can safely maintain their own configuration without clobbering
   * redacted secret values. */
  codexConfig: {
    overview: () => request<CodexConfigOverview>("/codex-config/overview"),
    file: (absPath: string) =>
      request<CodexConfigFile>(`/codex-config/file?path=${encodeURIComponent(absPath)}`),
    editFile: (absPath: string) =>
      request<CodexConfigEditableFile>(
        `/codex-config/edit-file?path=${encodeURIComponent(absPath)}`
      ),
    writeFile: (args: CodexConfigWriteArgs) =>
      request<CodexConfigWriteResult>("/codex-config/file", {
        method: "PUT",
        body: JSON.stringify(args),
      }),
    deleteFile: (args: CodexConfigDeleteArgs) =>
      request<CodexConfigDeleteResult>("/codex-config/file", {
        method: "DELETE",
        body: JSON.stringify(args),
      }),
    createProfile: (args: CodexConfigCreateProfileArgs) =>
      request<CodexConfigEditableFile>("/codex-config/profiles", {
        method: "POST",
        body: JSON.stringify(args),
      }),
  },

  // ────────────────────────────────── Run API ─────────────────────────────────
  /** Spawn/manage Claude Code processes and interactive Codex app-server
   * threads launched from the dashboard's Run Agent page. */
  run: {
    /**
     * GET /api/run - currently tracked runs (in-memory handles) plus
     * concurrency limits.
     * @returns {@link RunListResponse} — live handles + `maxConcurrent`/`activeCount`.
     */
    list: () => request<RunListResponse>("/run"),
    /**
     * GET /api/run/history - persisted run history from the `dashboard_runs`
     * table, including runs whose in-memory handle has since been reaped.
     *
     * `limit` defaults to 50 when the caller omits it and is always sent as a
     * query param (this endpoint has no other params).
     *
     * @param limit Max history rows to return (default 50).
     * @returns `{ items }` — {@link DashboardRunHistoryItem} rows, newest-first.
     */
    history: (limit = 50) =>
      request<{ items: DashboardRunHistoryItem[] }>(`/run/history?limit=${limit}`),
    /**
     * GET /api/run/binary - whether a `claude` executable was found on PATH.
     *
     * Lets the Run page disable/enable the "start" affordance and show where the
     * CLI resolved from (or that it's missing).
     *
     * @returns `{ found, path }` — whether a binary was located and its path.
     */
    binary: (provider: RunProvider = "claude") =>
      request<{ found: boolean; path: string | null; provider: RunProvider }>(
        `/run/binary?provider=${provider}`
      ),
    /** Account-aware model discovery. Codex comes directly from its local
     * app-server; Claude Code has no equivalent CLI endpoint, so its response
     * transparently reports observed local models plus supported aliases. */
    models: (provider: RunProvider) =>
      request<RunModelsResponse>(`/run/models?provider=${provider}`),
    /**
     * GET /api/run/cwds - suggested working directories for the cwd picker.
     * @returns `{ items }` — {@link CwdSuggestion} entries (dashboard/home/recent).
     */
    cwds: () => request<{ items: CwdSuggestion[] }>("/run/cwds"),
    /**
     * GET /api/run/files - path-completion suggestions under `cwd`, filtered
     * by an optional query fragment `q`.
     *
     * Backs the file/@-mention autocomplete when composing a run prompt: `cwd`
     * is always sent; `q` is appended only when non-empty to narrow matches.
     *
     * @param cwd The directory to complete paths within.
     * @param q   Optional partial fragment to filter suggestions by.
     * @returns `{ items }` — matching path strings under `cwd`.
     */
    files: (cwd: string, q?: string) => {
      const qs = new URLSearchParams({ cwd });
      if (q) qs.set("q", q);
      return request<{ items: string[] }>(`/run/files?${qs.toString()}`);
    },
    /**
     * POST /api/run - spawn a new `claude` child process.
     *
     * Sends {@link RunStartArgs} (prompt, mode, and optional cwd/model/
     * permission-mode/resume/effort). The server spawns the CLI and returns the
     * initial {@link RunHandle}; subsequent output is streamed over the
     * `run_stream` WebSocket message rather than this response.
     *
     * @param args The spawn parameters.
     * @returns {@link RunHandle} — the freshly created run's handle.
     */
    start: (args: RunStartArgs) =>
      request<RunHandle>("/run", { method: "POST", body: JSON.stringify(args) }),
    /**
     * GET /api/run/:id - one run's current handle; pass `envelopes: true` to
     * also include its buffered stream-json envelopes (for a page refresh
     * mid-run, since the WS `run_stream` history isn't otherwise replayed).
     *
     * The `envelopes` flag is translated to `?envelopes=1`. Use it when
     * re-hydrating the Run page after a reload: the WebSocket only pushes *new*
     * envelopes, so the buffered ones must be pulled once to backfill the view.
     *
     * @param id   The run id.
     * @param opts Optional `{ envelopes }` — include buffered stream-json envelopes.
     * @returns {@link RunHandle} — the run's handle (with `envelopes` when requested).
     */
    get: (id: string, opts?: { envelopes?: boolean }) =>
      request<RunHandle>(`/run/${encodeURIComponent(id)}${opts?.envelopes ? "?envelopes=1" : ""}`),
    /**
     * POST /api/run/:id/message - write `text` to the run's stdin (conversation
     * mode only); acked via the `run_input_ack` WS message.
     *
     * Only meaningful for a run started in "conversation" mode (stdin left
     * open). The HTTP response returns just the `messageId`; the actual
     * delivery/echo is confirmed asynchronously over the WebSocket.
     *
     * @param id   The run id to send input to.
     * @param text The user's follow-up message written to the CLI's stdin.
     * @returns `{ messageId }` — id correlating this input with its `run_input_ack`.
     */
    send: (id: string, text: string, provider: RunProvider = "claude") =>
      request<{ messageId: string }>(`/run/${encodeURIComponent(id)}/message`, {
        method: "POST",
        body: JSON.stringify({ text, provider }),
      }),
    /**
     * DELETE /api/run/:id - forcibly terminate a running process.
     *
     * @param id The run id to kill.
     * @returns `{ ok: true }` — acknowledgement that termination was requested.
     */
    kill: (id: string) =>
      request<{ ok: true }>(`/run/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },

  // ────────────────────────────────── Alerts API ──────────────────────────────
  /** Alert rule CRUD plus the fired-alert feed and acknowledgement. */
  alerts: {
    /**
     * GET /api/alerts - fired-alert feed, newest first.
     *
     * `unacked` is sent as the literal string "true" only when truthy (to show
     * just the outstanding alerts); `limit`/`offset` page the feed and are only
     * appended when set.
     *
     * @param params Optional filters/paging.
     * @param params.unacked When true, return only unacknowledged alerts.
     * @param params.limit   Page size.
     * @param params.offset  Row offset.
     * @returns `{ alerts, total, unacked, limit, offset }` — the page plus the
     *   total and outstanding-unacked counts for badge rendering.
     */
    list: (params?: { unacked?: boolean; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.unacked) qs.set("unacked", "true");
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{
        alerts: AlertEvent[];
        total: number;
        unacked: number;
        limit: number;
        offset: number;
      }>(`/alerts${q ? `?${q}` : ""}`);
    },
    /**
     * POST /api/alerts/:id/ack - acknowledge a single fired alert.
     *
     * Note the id is a numeric alert-event id interpolated directly into the
     * path (fired-alert ids are numeric, unlike the string ids used elsewhere).
     *
     * @param id Numeric id of the fired alert to acknowledge.
     * @returns `{ alert }` — the updated {@link AlertEvent} (now acknowledged).
     */
    ack: (id: number) => request<{ alert: AlertEvent }>(`/alerts/${id}/ack`, { method: "POST" }),
    /**
     * POST /api/alerts/ack-all - acknowledge every unacked alert at once.
     * @returns `{ ok: true, acknowledged }` — count of alerts just acknowledged.
     */
    ackAll: () =>
      request<{ ok: true; acknowledged: number }>("/alerts/ack-all", { method: "POST" }),
    /** CRUD for the alert rule definitions themselves (not the fired events).
     *  Rules describe *when* to fire; the endpoints above deal with alerts that
     *  have already fired. */
    rules: {
      /**
       * GET /api/alerts/rules - list every configured alert rule.
       * @returns `{ rules }` — the full set of {@link AlertRule} definitions.
       */
      list: () => request<{ rules: AlertRule[] }>("/alerts/rules"),
      /**
       * POST /api/alerts/rules - create a new alert rule.
       *
       * `rule_type` and `config` are typed against {@link AlertRule} so the body
       * matches the rule kind; `enabled` and `cooldown_seconds` are optional and
       * server-defaulted when omitted.
       *
       * @param rule The new rule definition (name, type, config, optional flags).
       * @returns `{ rule }` — the created {@link AlertRule} as persisted.
       */
      create: (rule: {
        /** Rule name, used in alert messages. */
        name: string;
        /** Kind of rule. */
        rule_type: AlertRule["rule_type"];
        /** Rule-type-specific settings. */
        config: AlertRule["config"];
        /** Whether the rule is active; defaults to enabled. */
        enabled?: boolean;
        /** Minimum seconds between alerts from this rule for the same target; defaults to 300. */
        cooldown_seconds?: number;
      }) =>
        request<{ rule: AlertRule }>("/alerts/rules", {
          method: "POST",
          body: JSON.stringify(rule),
        }),
      /**
       * PATCH /api/alerts/rules/:id - partially update an existing rule.
       *
       * Accepts any subset of the mutable fields (`name`/`config`/`enabled`/
       * `cooldown_seconds`); unspecified fields are left unchanged. Note
       * `rule_type` is intentionally not patchable (a rule's kind is fixed).
       *
       * @param id    The rule id to update.
       * @param patch Partial set of mutable fields to change.
       * @returns `{ rule }` — the updated {@link AlertRule}.
       */
      update: (
        id: string,
        patch: Partial<Pick<AlertRule, "name" | "config" | "enabled" | "cooldown_seconds">>
      ) =>
        request<{ rule: AlertRule }>(`/alerts/rules/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
      /**
       * DELETE /api/alerts/rules/:id - remove an alert rule.
       * @param id The rule id to delete.
       * @returns `{ ok: true }` — success flag.
       */
      remove: (id: string) =>
        request<{ ok: true }>(`/alerts/rules/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },
  },

  // ───────────────────────────────── Webhooks API ─────────────────────────────
  /** Outbound webhook target CRUD, provider metadata, test sends, and the
   *  per-target delivery log. */
  webhooks: {
    /**
     * GET /api/webhooks - configured targets (secrets/URLs redacted).
     *
     * Sensitive fields (secret, and often the full URL) are redacted server-side
     * before being returned to the UI list.
     *
     * @returns `{ targets }` — the configured {@link WebhookTarget}s (redacted).
     */
    list: () => request<{ targets: WebhookTarget[] }>("/webhooks"),
    /**
     * GET /api/webhooks/providers - supported provider types and their
     * form-field schemas, for the "Add webhook" dialog.
     *
     * Drives a dynamic form: each {@link WebhookProvider} advertises which
     * fields (url/secret/headers/config) it needs so the dialog can render the
     * right inputs per provider type.
     *
     * @returns `{ providers }` — the supported provider descriptors.
     */
    providers: () => request<{ providers: WebhookProvider[] }>("/webhooks/providers"),
    /**
     * POST /api/webhooks - create a new target.
     *
     * `type` selects the {@link WebhookType} provider; `url`/`secret`/`headers`/
     * `config` supply provider-specific delivery settings; `rule_ids` scopes the
     * target to fire only for those alert rules (all optional except name/type).
     *
     * @param target The new target definition.
     * @returns `{ target }` — the created {@link WebhookTarget} (redacted).
     */
    create: (target: {
      /** Display name. */
      name: string;
      /** Provider type; fixed after creation. */
      type: WebhookType;
      /** Destination URL. Hosted providers require HTTPS. */
      url?: string;
      /** Whether the target receives alerts; defaults to enabled. */
      enabled?: boolean;
      /** Signing secret for providers that support one. */
      secret?: string;
      /** Extra HTTP headers for providers that support them. */
      headers?: Record<string, string>;
      /** Provider-specific settings. */
      config?: Record<string, string>;
      /** Alert rules the target is limited to; omitted means every rule. */
      rule_ids?: string[];
    }) =>
      request<{ target: WebhookTarget }>("/webhooks", {
        method: "POST",
        body: JSON.stringify(target),
      }),
    /**
     * PATCH /api/webhooks/:id - partially update a target.
     *
     * All fields optional; only supplied ones change. `secret` accepts `null`
     * (distinct from omitted) to explicitly clear a stored secret. `type` is not
     * patchable here — a target's provider kind is fixed at creation.
     *
     * @param id    The target id to update.
     * @param patch Partial set of fields to change (`secret: null` clears it).
     * @returns `{ target }` — the updated {@link WebhookTarget} (redacted).
     */
    update: (
      id: string,
      patch: {
        /** New display name. */
        name?: string;
        /** New destination URL; omit to keep the stored one. */
        url?: string;
        /** Enable or disable the target. */
        enabled?: boolean;
        /** New signing secret, or `null` to clear the stored one; omit to keep it. */
        secret?: string | null;
        /** Replacement HTTP headers. */
        headers?: Record<string, string>;
        /** Replacement provider-specific settings. */
        config?: Record<string, string>;
        /** Replacement rule scope; an empty list means every rule. */
        rule_ids?: string[];
      }
    ) =>
      request<{ target: WebhookTarget }>(`/webhooks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    /**
     * DELETE /api/webhooks/:id - remove a target.
     * @param id The target id to delete.
     * @returns `{ ok: true }` — success flag.
     */
    remove: (id: string) =>
      request<{ ok: true }>(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" }),
    /**
     * POST /api/webhooks/:id/test - send a synchronous test payload; not
     * recorded in the delivery log.
     *
     * Fires an immediate test delivery so the user can validate credentials/URL
     * from the config dialog; the result is returned inline and deliberately
     * excluded from the persisted delivery history.
     *
     * @param id The target id to test.
     * @returns {@link WebhookTestResult} — the synchronous send outcome.
     */
    test: (id: string) =>
      request<WebhookTestResult>(`/webhooks/${encodeURIComponent(id)}/test`, { method: "POST" }),
    /**
     * GET /api/webhooks/:id/deliveries - paginated delivery history for one target.
     *
     * The persisted log of real (non-test) deliveries for one target, paged with
     * `limit`/`offset` (appended only when provided).
     *
     * @param id     The target id whose history to read.
     * @param params Optional `{ limit, offset }` paging.
     * @returns `{ deliveries, limit, offset }` — the page of {@link WebhookDelivery}s.
     */
    deliveries: (id: string, params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return request<{ deliveries: WebhookDelivery[]; limit: number; offset: number }>(
        `/webhooks/${encodeURIComponent(id)}/deliveries${q ? `?${q}` : ""}`
      );
    },
  },

  // ───────────────────────────── Remote Sources API ────────────────────────────
  /** Remote (SSH) machines whose Claude Code and Codex history this dashboard pulls in.
   *  Maps to `server/routes/remote-sources.js`; see also the global data-scope
   *  selector ({@link "./dataScope"}) which decides which sources are shown. */
  remoteSources: {
    /**
     * GET /api/remote-sources — list every configured source with live status.
     * @returns `{ sources }` — the {@link RemoteSource} rows (config + status).
     */
    list: () => request<{ sources: RemoteSource[] }>("/remote-sources"),
    /**
     * POST /api/remote-sources — add a source. No secrets are sent; auth defers
     * to the host's SSH stack (see the route/lib docs).
     * @param data {@link RemoteSourceInput} — label + ssh destination (+ options).
     * @returns `{ source }` — the created {@link RemoteSource}.
     */
    create: (data: RemoteSourceInput) =>
      request<{ source: RemoteSource }>("/remote-sources", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    /**
     * PATCH /api/remote-sources/:id — partial update (any subset of fields).
     * @param id   The source id.
     * @param data Partial {@link RemoteSourceInput}.
     * @returns `{ source }` — the updated {@link RemoteSource}.
     */
    update: (id: string, data: Partial<RemoteSourceInput>) =>
      request<{ source: RemoteSource }>(`/remote-sources/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    /**
     * DELETE /api/remote-sources/:id — remove a source. Pass `purge` to also
     * delete the sessions it imported (destructive); default detaches them to
     * `local`.
     * @param id    The source id.
     * @param purge When true, also delete this source's imported sessions.
     * @returns `{ ok, purged }` — success flag and count of purged sessions.
     */
    remove: (id: string, purge = false) =>
      request<{ ok: boolean; purged: number }>(
        `/remote-sources/${encodeURIComponent(id)}${purge ? "?purge=true" : ""}`,
        { method: "DELETE" }
      ),
    /**
     * POST /api/remote-sources/:id/test — probe SSH connectivity + remote dir.
     * @param id The source id.
     * @returns {@link RemoteSourceTestResult}.
     */
    test: (id: string) =>
      request<RemoteSourceTestResult>(`/remote-sources/${encodeURIComponent(id)}/test`, {
        method: "POST",
      }),
    /**
     * POST /api/remote-sources/:id/sync — pull the remote history now. Progress
     * also streams over the `import.progress` / `remote_source.status` WS
     * messages; this resolves with the final counters.
     * @param id The source id.
     * @returns {@link RemoteSourceSyncResult}.
     */
    sync: (id: string) =>
      request<RemoteSourceSyncResult>(`/remote-sources/${encodeURIComponent(id)}/sync`, {
        method: "POST",
      }),
    /**
     * POST /api/remote-sources/sync-all — sync every enabled source now
     * (sequential; per-source failures isolated).
     * @returns `{ ok, synced, results }` — one entry per enabled source.
     */
    syncAll: () =>
      request<{
        ok: boolean;
        synced: number;
        results: Array<{ id: string; ok: boolean; error?: string }>;
      }>("/remote-sources/sync-all", { method: "POST" }),
  },

  // ─────────────────────────────────── Query Explorer API ──────────────────────────────────
  /** Advanced Query Explorer — unified safe-query surface over sessions, agents, and events. */
  query: {
    /**
     * GET /api/query — execute a parameterised query over one entity type.
     * @param params.entity   One of "sessions" | "agents" | "events".
     * @param params.filters  Flat key→value filter map (status, event_type, tool_name, q, from, to, sort_by, sort_dir).
     * @param params.limit    Page size (max 500).
     * @param params.offset   Row offset.
     * @param params.scope    Optional `?sources=…&providers=…` scope string.
     */
    run: (params: {
      entity: string;
      filters?: Record<string, string>;
      limit?: number;
      offset?: number;
      scope?: string;
    }) => {
      const qs = new URLSearchParams({ entity: params.entity });
      if (params.limit != null) qs.set("limit", String(params.limit));
      if (params.offset != null) qs.set("offset", String(params.offset));
      Object.entries(params.filters ?? {}).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      if (params.scope) new URLSearchParams(params.scope).forEach((v, k) => qs.set(k, v));
      return request<{
        entity: string;
        rows: Record<string, unknown>[];
        columns: string[];
        total: number;
        limit: number;
        offset: number;
      }>(`/query?${qs.toString()}`);
    },

    /**
     * GET /api/query/facets — distinct filterable values for the chosen entity.
     * @param entity  One of "sessions" | "agents" | "events".
     */
    facets: (entity: string, scope?: string) => {
      const qs = new URLSearchParams({ entity });
      if (scope) new URLSearchParams(scope).forEach((v, k) => qs.set(k, v));
      return request<{
        entity: string;
        statuses?: string[];
        event_types?: string[];
        tool_names?: string[];
      }>(`/query/facets?${qs.toString()}`);
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Module-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Backs `api.ccConfig.backups` - a plain function (not inlined into the `api`
 *  object literal) purely so its query-building logic can be unit-referenced.
 *
 *  Builds an optional `?scope=&type=` query string (each part appended only when
 *  present) and calls {@link request} for GET /api/cc-config/backups.
 *
 *  @param params Optional `{ scope, type }` filter for the backup listing.
 *  @returns `{ items }` — the matching {@link CcBackup} entries. */
function requestBackupsHelper(params?: { scope?: "user" | "project"; type?: CcArtifactType }) {
  const qs = new URLSearchParams();
  if (params?.scope) qs.set("scope", params.scope);
  if (params?.type) qs.set("type", params.type);
  const q = qs.toString();
  return request<{ items: CcBackup[] }>(`/cc-config/backups${q ? `?${q}` : ""}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript snapshot types — /api/settings/snapshots* (issue #358).
// ─────────────────────────────────────────────────────────────────────────────

/** Storage of one snapshot directory (`transcripts`, `codex-transcripts`,
 *  `cursor-transcripts` under the dashboard data dir). */
export interface SnapshotRootSummary {
  /** Absolute path of this snapshot root under the dashboard data directory. */
  path: string;
  /**
   * Every snapshot file under the root, plain and gzip-compressed, including subagent transcripts.
   */
  files: number;
  /**
   * Total on-disk size of the root's files, in bytes (compressed files count at their compressed
   * size).
   */
  bytes: number;
  /**
   * How many of `files` are lossless `.jsonl.gz` copies written by background compression. Always 0
   * for the Codex root, which is never compressed because its ingest cursors read it in place.
   */
  compressed_files: number;
  /** Bytes held by the compressed files alone - a subset of `bytes`. */
  compressed_bytes: number;
  /** Distinct session ids that own at least one file in this root. */
  sessions: number;
}

/** Snapshot storage report plus the env-configured retention policy
 *  (`DASHBOARD_SNAPSHOT_COMPRESS`, `_MAX_AGE_DAYS`, `_MAX_BYTES`). */
export interface SnapshotStorage {
  /** Sum of `bytes` across all three roots - the figure a `max_bytes` cap is compared against. */
  total_bytes: number;
  /** Sum of `files` across all three roots. */
  total_files: number;
  /**
   * Per-provider breakdown, one entry for each snapshot directory: `transcripts` (Claude Code),
   * `codex-transcripts`, and `cursor-transcripts`.
   */
  roots: Record<"claude" | "codex" | "cursor", SnapshotRootSummary>;
  /**
   * Retention policy currently in force, read from the environment. `compress` reflects
   * `DASHBOARD_SNAPSHOT_COMPRESS`; `max_age_days` / `max_bytes` are null when the matching
   * `DASHBOARD_SNAPSHOT_MAX_AGE_DAYS` / `DASHBOARD_SNAPSHOT_MAX_BYTES` cap is unset, which is the
   * default (no automatic pruning).
   */
  policy: { compress: boolean; max_age_days: number | null; max_bytes: number | null };
}

/** One session whose snapshots a prune selects. */
export interface SnapshotPruneCandidate {
  /** Which snapshot root the files live in, i.e. the provider that produced the transcript. */
  kind: "claude" | "codex" | "cursor";
  /**
   * Owning session row id. Can differ from the snapshot file name when an imported session was
   * re-keyed, so always link to the session with this id.
   */
  session_id: string;
  /**
   * Why the session was selected. `max_age`: a finished session idle longer than the age cap.
   * `max_bytes`: an older finished session evicted (oldest first) to get under the size cap.
   * `orphan`: snapshots with no matching session row, only selected by an explicit prune with
   * `orphans: true`.
   */
  reason: "max_age" | "max_bytes" | "orphan";
  /**
   * Number of snapshot files (main transcript, compressed twin, and subagent files) that would be
   * or were removed for this session.
   */
  files: number;
  /** Bytes those files occupy on disk. */
  bytes: number;
  /**
   * ISO timestamp of the later of the session's last activity and its newest snapshot file; null
   * for orphans, which have no session row to read activity from.
   */
  last_activity: string | null;
}

/** Prune plan (dry run) or result (applied). */
export interface SnapshotPruneResult {
  /**
   * True when the request was accepted and the plan was computed (and applied, when not a dry run).
   */
  ok: boolean;
  /**
   * True for a preview: nothing was deleted and all `removed_*` counters are 0. The Settings panel
   * requests a dry run for its Preview step; an applied prune additionally requires `confirm:
   * "PRUNE_SNAPSHOTS"`.
   */
  dry_run: boolean;
  /**
   * Normalized criteria the plan was computed with. A cap of 0 or an omitted cap comes back as
   * null.
   */
  criteria: { max_age_days: number | null; max_bytes: number | null; orphans: boolean };
  /** Total snapshot bytes on disk before the prune. */
  total_bytes: number;
  /**
   * Number of sessions the plan selected. Covers every candidate even when `candidates` is
   * truncated.
   */
  candidate_sessions: number;
  /** Total files across all candidate sessions. */
  candidate_files: number;
  /** Total bytes across all candidate sessions - what an applied prune would free. */
  candidate_bytes: number;
  /** Snapshot bytes that would remain after removing every candidate. */
  remaining_bytes: number;
  /**
   * How far `remaining_bytes` would still exceed `max_bytes`, or 0. Non-zero when the cap cannot be
   * met without touching sessions that are still running or finished within the last 24 hours,
   * which the size cap never evicts.
   */
  over_cap_bytes: number;
  /** Selected sessions, oldest activity first. Capped at 500 rows, see `truncated`. */
  candidates: SnapshotPruneCandidate[];
  /**
   * True when more than 500 sessions were selected and `candidates` lists only the first 500.
   * Totals still cover all of them.
   */
  truncated: boolean;
  /** Files actually deleted. 0 for a dry run. */
  removed_files: number;
  /** Bytes actually freed. 0 for a dry run. */
  removed_bytes: number;
  /**
   * Files that could not be deleted (for example locked on Windows). They are retried by a later
   * maintenance pass rather than failing the prune.
   */
  failed_files: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CC-Config types — request/response shapes for the "CC Config" explorer/editor.
// These describe on-disk Claude Code configuration artifacts (skills, agents,
// commands, output styles, memory, plugins, MCP servers, hooks, settings,
// marketplaces, keybindings, statusline) as surfaced by the /api/cc-config/*
// routes. They live in this client because they are specific to the explorer UI.
// ─────────────────────────────────────────────────────────────────────────────

/** Kind of Claude Code config artifact manageable via `api.ccConfig.write`/
 *  `delete` - each maps to a distinct on-disk location under `.claude/`. */
export type CcArtifactType =
  | "skills"
  | "agents"
  | "commands"
  | "output-styles"
  | "memory"
  | "auto-memory";

/** Body for PUT /api/cc-config/file - create or overwrite one artifact. */
export interface CcWriteArgs {
  /**
   * Which config layer to write into. `user` targets `~/.claude`, `project` targets the current
   * project's `.claude/` directory, and `auto-memory` targets a per-project memory file under
   * `~/.claude/projects/<slug>/memory/` and requires `project`.
   */
  scope: "user" | "project" | "auto-memory";
  /**
   * Kind of artifact, which decides the on-disk location and file layout (for example a `SKILL.md`
   * inside a skill directory vs. a single agent markdown file).
   */
  type: CcArtifactType;
  /** Artifact name (e.g. skill/agent/command name); omitted for singleton
   *  artifacts like a scope's CLAUDE.md. */
  name?: string;
  /** Full file contents to write. */
  content: string;
  /** Target project slug; required when `scope === "auto-memory"`. */
  project?: string;
}

/** Body for DELETE /api/cc-config/file - remove one artifact. Mirrors the
 *  identifying fields of {@link CcWriteArgs} (minus `content`). */
export interface CcDeleteArgs {
  /** Config layer that holds the artifact. Same meaning as {@link CcWriteArgs.scope}. */
  scope: "user" | "project" | "auto-memory";
  /** Kind of artifact to delete. Same meaning as {@link CcWriteArgs.type}. */
  type: CcArtifactType;
  /** Artifact name to delete; omitted for singleton artifacts such as a scope's `CLAUDE.md`. */
  name?: string;
  /** Target project slug; required when `scope === "auto-memory"`. */
  project?: string;
}

/** Response shape of a successful `ccConfig.write`/`delete` call. */
export interface CcMutationResult {
  /**
   * Literal success marker; failures are returned as HTTP errors and surface through `request()` as
   * thrown errors instead.
   */
  ok: true;
  /** Absolute path of the file that was written/deleted. */
  file: string;
  /** Human-readable description of what was mutated, for a toast/log line. */
  target: string;
  /** Path to the pre-mutation backup the server wrote, or null if none was
   *  needed (e.g. deleting a file that didn't exist). */
  backupPath: string | null;
  /** True when `write` created a new file rather than overwriting one. */
  created?: boolean;
}

/** One timestamped backup of a config artifact, from GET /api/cc-config/backups -
 *  written automatically before every destructive `write`/`delete`. */
export interface CcBackup {
  /** Config layer the backed-up artifact came from. */
  scope: "user" | "project" | "auto-memory";
  /** Kind of artifact that was backed up. */
  type: CcArtifactType;
  /**
   * Name of the original artifact (not the backup file name), used to group backups of the same
   * artifact.
   */
  name: string;
  /** Absolute path to the backup copy (not the original file). */
  backupPath: string;
  /** Whether the backed-up artifact is a directory (vs. a single file). */
  isDir: boolean;
  /** Backup file's mtime, epoch milliseconds. */
  mtime: number;
  /** Backup size in bytes; null for directory backups. */
  size: number | null;
  /** Project slug the auto-memory file belongs to; present only when `scope === "auto-memory"`. */
  project?: string; // present for scope === "auto-memory"
}

/** Scope filter accepted by most `ccConfig` list endpoints; "all" merges
 *  user + project scope in one response. */
export type CcScope = "user" | "project" | "all";

/** One markdown-based config artifact (skill/agent/command/output-style),
 *  as summarized by the `ccConfig` list endpoints. The list endpoints return
 *  a lightweight summary (frontmatter + a preview) rather than full contents;
 *  the full text is fetched on demand via {@link api.ccConfig.file}. */
export interface CcMdItem {
  /**
   * Config layer the artifact was found in. Never `all`; merged listings tag each item with its
   * real scope.
   */
  scope: "user" | "project";
  /** Artifact name, derived from its filename/frontmatter. */
  name: string;
  /** Filename only, when the API returns it instead of a full path. */
  file?: string;
  /** Absolute path, when the API returns it instead of a bare filename. */
  path?: string;
  /** Full on-disk file size in bytes, even when `preview` is truncated. */
  size: number;
  /** File's mtime, epoch milliseconds. */
  mtime: number;
  /** Whether `preview` was cut short of the full file content. */
  truncated: boolean;
  /** Parsed YAML frontmatter key/value pairs (e.g. `description`, `model`). */
  frontmatter: Record<string, string>;
  /** Leading excerpt of the file body, for list-view hover/preview. */
  preview: string;
}

/** Counts of what a plugin contributes to Claude Code, plus its manifest
 *  metadata, embedded in {@link CcPlugin}. */
export interface CcPluginContributions {
  /** Number of skills the plugin ships. */
  skills: number;
  /** Number of subagent definitions the plugin ships. */
  agents: number;
  /** Number of slash commands the plugin ships. */
  commands: number;
  /** Number of output styles the plugin ships. */
  outputStyles: number;
  /** Number of hook bindings the plugin registers. */
  hooks: number;
  /** Parsed `plugin.json` fields; null if the plugin has no manifest. */
  pluginJson: {
    name?: string;
    description?: string;
    version?: string;
    author?: { name?: string; email?: string };
    homepage?: string;
    repository?: string;
    license?: string;
    keywords?: string[];
  } | null;
}

/** One installed marketplace plugin, from GET /api/cc-config/plugins - merges
 *  the install manifest with a live filesystem/git check. */
export interface CcPlugin {
  /** Unique key within the plugin manifest (usually `<marketplace>/<name>`). */
  key: string;
  /** Plugin name as declared by its manifest or marketplace entry. */
  name: string;
  /** Marketplace it was installed from; null for a manually-installed plugin. */
  marketplace: string | null;
  /** Install scope, e.g. "user" or "project". */
  scope: string;
  /** Installed version string from the install manifest, or null if unrecorded. */
  version: string | null;
  /** Absolute path where the plugin's files live. */
  installPath: string | null;
  /** ISO timestamp the plugin was installed, or null if unrecorded. */
  installedAt: string | null;
  /** ISO timestamp of the last update check/pull for this plugin. */
  lastUpdated: string | null;
  /** Git commit SHA the plugin was installed/updated at, if it's a git checkout. */
  gitCommitSha: string | null;
  /** Whether `installPath` still exists on disk (false = broken/missing install). */
  installPathExists: boolean;
  /** Whether the plugin is active; null when enablement isn't tracked for it. */
  enabled: boolean | null;
  /**
   * What the plugin contributes, counted from its install directory; null when the install path is
   * missing so nothing could be counted.
   */
  contributes: CcPluginContributions | null;
}

/** Response shape of GET /api/cc-config/plugins. */
export interface CcPluginsResponse {
  /** Path to the plugin install manifest file. */
  manifestPath: string;
  /**
   * Whether the install manifest exists. False on a machine that has never installed a plugin, in
   * which case `plugins` is empty.
   */
  manifestExists: boolean;
  /** Installed plugins, one per manifest entry. */
  plugins: CcPlugin[];
}

/** One configured MCP server entry, from GET /api/cc-config/mcp. Fields are
 *  conditionally present depending on `kind` (stdio vs http). Note that only
 *  env-var/header *names* are surfaced, never their values, to avoid leaking
 *  secrets into the dashboard. */
export interface CcMcpServer {
  /** Server name as it appears under `mcpServers` in the config file. */
  name: string;
  /** Which config file this entry came from (e.g. a `.mcp.json` path). */
  source: string;
  /** Transport: local subprocess ("stdio"), remote HTTP, or undetermined. */
  kind: "stdio" | "http" | "unknown";
  /** Launch command, for `kind === "stdio"`. */
  command?: string;
  /** Command-line arguments passed to `command`, for `kind === "stdio"`. */
  args?: string[];
  /** Names (not values) of env vars the server config references. */
  envNames?: string[];
  /** Endpoint URL, for `kind === "http"`. */
  url?: string;
  /** Header names (not values) sent with HTTP requests. */
  headers?: string[];
}

/** Response shape of GET /api/cc-config/mcp, split by config scope. */
export interface CcMcpResponse {
  /** Servers configured in the user-level config, available in every project. */
  user: CcMcpServer[];
  /** Servers configured in the current project's `.mcp.json`/settings. */
  projectScoped: CcMcpServer[];
}

/** One hook binding within a settings.json `hooks` block. */
export interface CcHookEntry {
  /** Tool-name matcher pattern (e.g. "Bash", "Edit|Write", or "*"). */
  matcher: string;
  /** Hook kind, e.g. "command". */
  type: string;
  /** Shell command executed for this hook; null for non-command hook types. */
  command: string | null;
  /** Timeout in seconds before the hook is killed; null = no explicit timeout. */
  timeout: number | null;
}

/** One settings.json layer's hook configuration, from GET /api/cc-config/hooks. */
export interface CcHookSource {
  /** "project-local" is the gitignored `settings.local.json` override layer. */
  scope: "user" | "project" | "project-local";
  /** Absolute path to the settings file this scope reads from. */
  file: string;
  /** Whether the file actually exists (false = scope has no overrides yet). */
  exists: boolean;
  /** Hook entries keyed by event name (e.g. "PreToolUse", "Stop"). */
  hooks: Record<string, CcHookEntry[]>;
}

/** One settings.json layer's raw contents, from GET /api/cc-config/settings. */
export interface CcSettingsSource {
  /**
   * Settings layer this entry describes. `project-local` is the gitignored `settings.local.json`
   * override layer.
   */
  scope: "user" | "project" | "project-local";
  /** Absolute path to the settings file for this layer. */
  file: string;
  /** Whether the file exists. A layer with no file contributes no settings. */
  exists: boolean;
  /** Parsed JSON contents; absent when `exists` is false. */
  data?: unknown;
  /** Raw file size in bytes, when known. */
  raw_size?: number;
}

/** One memory artifact - either a project's/user's editable CLAUDE.md, or a
 *  read-only auto-memory file - from GET /api/cc-config/memory. */
export interface CcMemoryItem {
  /**
   * Memory layer. `user` and `project` are the two editable `CLAUDE.md` files. `auto-memory` is a
   * per-project file-based memory file under `~/.claude/projects/<slug>/memory/`, read-only in the
   * dashboard for now.
   */
  scope: "user" | "project" | "auto-memory";
  /** Absolute path of the memory file. */
  file: string;
  /** Full on-disk file size in bytes. */
  size: number;
  /** File modification time, epoch milliseconds. */
  mtime: number;
  /** Whether `preview` was cut short of the full file content. */
  truncated: boolean;
  /**
   * Leading excerpt of the file, for the list view. Open the file through {@link api.ccConfig.file}
   * for its full text.
   */
  preview: string;
  // Present only for scope === "auto-memory":
  /** Project slug the auto-memory file belongs to; present only for `auto-memory` items. */
  project?: string; // the projects/<slug> dir name
  /** Markdown file name inside the memory directory; present only for `auto-memory` items. */
  name?: string; // the markdown filename (e.g. MEMORY.md, feedback_x.md)
  /**
   * Marks index files (`MEMORY.md`, `INDEX-*.md`) that list the other memories, so the UI can pin
   * them first.
   */
  isIndex?: boolean; // true for MEMORY.md / INDEX-*.md table-of-contents files
  /**
   * Parsed YAML frontmatter (for example `name`, `description`, `type`) when the memory file has
   * one.
   */
  frontmatter?: Record<string, string>; // parsed YAML frontmatter, if any
}

/** Response shape of GET /api/cc-config/file - full contents of one config
 *  artifact, for the read/edit view. */
export interface CcFileResponse {
  /** Literal success marker; read failures are returned as HTTP errors. */
  ok: true;
  /** Absolute path of the file that was read. */
  file: string;
  /** File contents (possibly truncated - see `truncated`). */
  text: string;
  /** Full on-disk file size in bytes (may exceed `text.length` if truncated). */
  size: number;
  /** File modification time, epoch milliseconds. */
  mtime: number;
  /** Whether `text` was cut short of the full file (very large files). */
  truncated: boolean;
}

/** Response shape of GET /api/cc-config/overview - counts of every config
 *  artifact kind, for the explorer's landing dashboard. */
export interface CcOverview {
  /** Key filesystem locations the explorer reads from. */
  roots: {
    claudeHome: string;
    projectClaudeDir: string;
    projectRoot: string;
    /** Path to the top-level `.claude.json` (marketplaces/global settings). */
    claudeJson: string;
  };
  /** Per-artifact-kind counts, split by scope where applicable. */
  counts: {
    skills: { user: number; project: number };
    agents: { user: number; project: number };
    commands: { user: number; project: number };
    outputStyles: { user: number; project: number };
    plugins: number;
    pluginsEnabled: number;
    pluginsDisabled: number;
    marketplaces: number;
    keybindings: number;
    mcpServers: { user: number; project: number };
    /** Hook-entry counts keyed by scope. */
    hooks: Record<string, number>;
    memory: number;
    settingsFiles: number;
  };
}

/** One registered plugin marketplace, from GET /api/cc-config/marketplaces. */
export interface CcMarketplace {
  /**
   * Marketplace key as registered in the known-marketplaces file; plugins reference it as
   * `<plugin>@<name>`.
   */
  name: string;
  /** Where the marketplace is sourced from (git repo, URL, …); null if unknown. */
  source: { source?: string; repo?: string; url?: string } | null;
  /** Local checkout path for a git-based marketplace; null otherwise. */
  installLocation: string | null;
  /** ISO timestamp of the marketplace's last refresh, or null if never refreshed. */
  lastUpdated: string | null;
  /** Number of plugins the marketplace publishes; null if not yet indexed. */
  pluginCount: number | null;
  /** Marketplace's own self-reported display name (may differ from `name`). */
  marketplaceName: string | null;
  /** Description from the marketplace's own manifest, or null. */
  marketplaceDescription: string | null;
  /** Owner metadata from the marketplace's own manifest, or null. */
  marketplaceOwner: { name?: string; url?: string } | null;
}

/** Response shape of GET /api/cc-config/marketplaces. */
export interface CcMarketplacesResponse {
  /** Path to the marketplace registry file the dashboard reads. */
  knownPath: string;
  /** Whether the known-marketplaces file exists. False when no marketplace has ever been added. */
  knownExists: boolean;
  /** Registered marketplaces. */
  items: CcMarketplace[];
}

/** One logical group of keybindings sharing a UI context (e.g. "editor",
 *  "global"), as parsed from `keybindings.json`. */
export interface CcKeybindingGroup {
  /** Context name the bindings apply in (for example `global` or `editor`). */
  context: string;
  /** Key chord to action pairs, in file order. */
  bindings: { key: string; action: string }[];
}

/** Response shape of GET /api/cc-config/keybindings. */
export interface CcKeybindings {
  /** Absolute path of `keybindings.json`. */
  file: string;
  /**
   * Whether the file exists. When false, `groups` is empty and Claude Code uses its built-in
   * bindings.
   */
  exists: boolean;
  /** JSON schema URL declared in the file, if any. */
  schema?: string | null;
  /** Doc/help URL declared in the file, if any. */
  docs?: string | null;
  /** Bindings grouped by context. */
  groups: CcKeybindingGroup[];
}

/** One statusline script file, referenced by {@link CcStatusline.config}. */
export interface CcStatuslineScript {
  /** Absolute path of the script file. */
  file: string;
  /** Full on-disk file size in bytes. */
  size: number;
  /** File modification time, epoch milliseconds. */
  mtime: number;
  /** Whether `preview` was cut short of the full file content. */
  truncated: boolean;
  /** Leading excerpt of the script, for an inline preview. */
  preview: string;
}

/** Response shape of GET /api/cc-config/statusline. */
export interface CcStatusline {
  /** Active statusline config from settings.json; null if unset. */
  config: { type?: string; command?: string } | null;
  /** Candidate/available statusline scripts discovered on disk. */
  scripts: CcStatuslineScript[];
}

/** Response shape of GET /api/cc-config/hook-scripts - shell scripts found in
 *  the hooks directory that a `CcHookEntry.command` might reference. */
export interface CcHookScripts {
  /** Absolute path of the hooks directory that was scanned. */
  dir: string;
  /** Script files found in the directory, with size in bytes and mtime in epoch milliseconds. */
  items: { name: string; file: string; size: number; mtime: number }[];
}

/** Safe preview of one local Codex configuration file. Sensitive TOML and JSON
 * values are redacted server-side before this reaches the browser. */
export interface CodexConfigFile {
  /** Absolute path of the file inside the Codex home. */
  path: string;
  /**
   * File contents with secret values redacted server-side. Display only; never write this text
   * back.
   */
  text: string;
  /** Full on-disk file size in bytes. */
  size: number;
  /** File modification time, epoch milliseconds. */
  mtime: number;
  /** Whether `text` was cut short because the file exceeded the preview limit. */
  truncated: boolean;
}

/** Full local-only content returned only for the narrowly editable Codex file
 * allowlist. This is separate from {@link CodexConfigFile} so a redacted
 * preview can never accidentally overwrite user secrets. */
export interface CodexConfigEditableFile {
  /** Absolute path of the editable file. */
  path: string;
  /**
   * Unredacted file contents, used as the editor's starting text. Empty when the file does not
   * exist yet.
   */
  text: string;
  /** Full on-disk file size in bytes; 0 when the file does not exist. */
  size: number;
  /** Whether the file exists. Saving a missing allowlisted file creates it. */
  exists: boolean;
  /** File modification time in epoch milliseconds, or null when the file does not exist. */
  mtime: number | null;
  /** Whether `text` was cut short because the file exceeded the read limit. */
  truncated: boolean;
}

/**
 * Body for saving one Codex configuration file. The server only accepts paths on its edit
 * allowlist: `config.toml`, `hooks.json`, the home and project `AGENTS.md`, `<name>.config.toml`
 * profiles, skill `SKILL.md` files, and rule files.
 */
export interface CodexConfigWriteArgs {
  /** Absolute path of the file to write; must be on the server's edit allowlist. */
  path: string;
  /** Complete new file contents. Replaces the file rather than patching it. */
  content: string;
}

/** Result of a successful Codex config write. */
export interface CodexConfigWriteResult {
  /** Literal success marker; rejected writes are returned as HTTP errors. */
  ok: true;
  /** Absolute path of the file that was written. */
  file: string;
  /** Path of the backup taken before overwriting, or null when the file was newly created. */
  backupPath: string | null;
  /** True when the write created a new file instead of overwriting one. */
  created: boolean;
}

/** Deletes a user-maintained Codex artifact; the base config.toml is never allowed. */
export interface CodexConfigDeleteArgs {
  /** Absolute path of the file to delete. `config.toml` itself is always refused. */
  path: string;
}

/** Result of a successful Codex config delete. */
export interface CodexConfigDeleteResult {
  /** Literal success marker; refused deletes are returned as HTTP errors. */
  ok: true;
  /** Absolute path of the file that was deleted. */
  file: string;
  /** Path of the backup taken before deleting. Deletes always back up first. */
  backupPath: string;
  /**
   * True when the artifact was a directory (for example a whole skill folder) rather than a single
   * file.
   */
  deletedDirectory: boolean;
}

/** Request used to create a named Codex `--profile` overlay file. */
export interface CodexConfigCreateProfileArgs {
  /** Letters, numbers, hyphens, and underscores; becomes `<name>.config.toml`. */
  name: string;
}

/**
 * Everything the Codex half of Agent Config shows, built server-side from the local Codex home.
 * Secret values in `config.toml` are redacted, and MCP servers expose environment variable names
 * but never their values.
 */
export interface CodexConfigOverview {
  /** Resolved Codex home (`DASHBOARD_CODEX_HOME`, else `CODEX_HOME`, else `~/.codex`). */
  home: string;
  /** Redacted preview of `config.toml`, plus whether it exists. */
  config: CodexConfigFile & { exists: boolean };
  /**
   * Top-level defaults read from `config.toml`: `model`, `model_reasoning_effort`, and
   * `personality`. Each is null when unset.
   */
  defaults: { model: string | null; reasoningEffort: string | null; personality: string | null };
  /**
   * Item count per section (`models`, `profiles`, `mcp`, `projects`, `skills`, `hooks`, `rules`,
   * `plugins`, `instructions`), used for the overview tiles.
   */
  counts: Record<string, number>;
  /**
   * Full model catalog merged from the account cache (`models_cache.json`), custom
   * `model_catalog_json` catalogs, and models named in `config.toml` or a profile. In each item,
   * `sources` records where the model was seen, `baseDefault` marks the base `config.toml` model,
   * and `profiles` / `providers` list the profiles and model providers that reference it. The list
   * is not capped like the generic previews.
   */
  models: {
    file: string;
    fetchedAt: string | null;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      defaultEffort: string | null;
      efforts: string[];
      contextWindow: number | null;
      visible: boolean;
      sources: Array<"account" | "custom" | "configured">;
      baseDefault: boolean;
      profiles: string[];
      providers: string[];
    }>;
  };
  /**
   * Named `--profile` overlays (`<name>.config.toml` files in the Codex home) with the main
   * settings each one overrides. Each field is null when the profile leaves it unset.
   */
  profiles: Array<{
    name: string;
    path: string;
    exists: boolean;
    size: number;
    mtime: number | null;
    model: string | null;
    reasoningEffort: string | null;
    approvalPolicy: string | null;
    sandboxMode: string | null;
    serviceTier: string | null;
    modelCatalog: string | null;
    provider: string | null;
  }>;
  /**
   * MCP servers declared in `config.toml`. Only environment variable names are exposed, never their
   * values.
   */
  mcp: Array<{
    name: string;
    command: string | null;
    url: string | null;
    enabled: boolean;
    envNames: string[];
  }>;
  /** Trusted project directories declared in `config.toml`. */
  projects: Array<{ path: string; name: string }>;
  /** Skills found under `<home>/skills`, each with a short preview of its `SKILL.md`. */
  skills: Array<{ name: string; file: string; preview: string; mtime: number }>;
  /**
   * Hook configuration from `hooks.json`: whether it exists and how many matcher groups each event
   * registers.
   */
  hooks: { file: string; exists: boolean; items: Array<{ event: string; groups: number }> };
  /** Rule files found under `<home>/rules`, each with a short preview. */
  rules: Array<{ name: string; file: string; preview: string; mtime: number | null }>;
  /**
   * Plugins known to Codex, merged from the plugin cache and `config.toml`, sorted by display name.
   * `displayName` falls back to a title-cased manifest name, and `enabled` reflects the
   * `config.toml` toggle.
   */
  plugins: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    marketplace: string;
    marketplaceLabel: string;
    version: string | null;
    enabled: boolean;
  }>;
  /** Instruction files (`AGENTS.md` at the Codex home and project level) with previews. */
  instructions: Array<{ path: string; name: string; preview: string; mtime: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run types — request/response shapes for the Run page's `claude` process
// spawning/management. `RunMode`/`RunStatus`/`PermissionMode`/`EffortLevel`
// mirror the CLI's own vocabulary so the dashboard can drive the CLI faithfully.
// ─────────────────────────────────────────────────────────────────────────────

/** "headless" runs to completion unattended and streams only output;
 *  "conversation" keeps stdin open so the user can send follow-up messages. */
export type RunProvider = "claude" | "codex";
/**
 * How a run talks to the CLI. `headless` runs to completion unattended and streams only output;
 * `conversation` keeps the process open so the user can send follow-up messages.
 */
export type RunMode = "headless" | "conversation";
/** Lifecycle of a spawned `claude` process, mirrored in `RunHandle.status`
 *  and `RunStatusPayload.status`. "abandoned" is applied by server cleanup
 *  when a handle is reaped without a clean exit ever being observed. */
export type RunStatus = "spawning" | "running" | "completed" | "error" | "killed" | "abandoned";
/** Maps 1:1 to the `claude --permission-mode` CLI flag. */
export type PermissionMode = "acceptEdits" | "default" | "plan" | "bypassPermissions";
/**
 * Codex `--ask-for-approval` policy: `untrusted` asks before running anything not known-safe,
 * `on-request` lets the model decide when to ask, and `never` never asks.
 */
export type CodexApprovalPolicy = "untrusted" | "on-request" | "never";
/**
 * Codex `--sandbox` mode: `read-only` cannot write files, `workspace-write` may write inside the
 * working directory, and `danger-full-access` disables sandboxing entirely.
 */
export type CodexSandbox = "read-only" | "workspace-write" | "danger-full-access";
/** Maps 1:1 to the `claude --effort` CLI flag; "" omits the flag (model default). */
export type EffortLevel = "" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

/** Body for POST /api/run - parameters for spawning a new `claude` process. */
export interface RunStartArgs {
  /** Initial prompt/task text passed to the CLI. */
  prompt: string;
  /**
   * Whether to run one-shot (`headless`) or keep the session open for follow-ups (`conversation`).
   */
  mode: RunMode;
  /** CLI to launch. Defaults to `claude` when omitted. */
  provider?: RunProvider;
  /** Working directory to launch in; server default applies if omitted. */
  cwd?: string;
  /** `--model` value; omitted inherits the CLI's own default (settings.json). */
  model?: string;
  /** Claude `--permission-mode`, or the Codex approval policy when `provider === "codex"`. */
  permissionMode?: PermissionMode | CodexApprovalPolicy;
  /** Codex sandbox mode; ignored for Claude runs. */
  sandbox?: CodexSandbox;
  /** Resume an existing Claude Code session id (`--resume`) instead of starting fresh. */
  resumeSessionId?: string;
  /** Reasoning effort; `""` or omitted leaves the model default. */
  effort?: EffortLevel;
}

/** In-memory (or freshly-fetched) handle for one spawned `claude` process,
 *  from POST/GET /api/run - the live counterpart to {@link DashboardRunHistoryItem}.
 *  Where {@link DashboardRunHistoryItem} is the persisted DB row (snake_case,
 *  survives handle reaping), this is the richer live handle (camelCase, carries
 *  argv/tails/envelope counters) that only exists while the server tracks it. */
export interface RunHandle {
  /** Server-assigned run id used by every `/api/run/:id` route and in run WebSocket messages. */
  id: string;
  /** CLI the run launched. */
  provider: RunProvider;
  /** OS process id; null before the process has actually spawned. */
  pid: number | null;
  /** Whether the run is one-shot or an open conversation. */
  mode: RunMode;
  /** Absolute working directory the process was started in. */
  cwd: string;
  /** Model passed to the CLI, or null when the CLI default applies. */
  model: string | null;
  /** Effective Claude permission mode or Codex approval policy. */
  permissionMode: PermissionMode | CodexApprovalPolicy;
  /** Effective Codex sandbox mode; null or absent for Claude runs. */
  sandbox?: CodexSandbox | null;
  /** Effective reasoning effort, or null when the model default applies. */
  effort: EffortLevel | null;
  /** Initial prompt the run was started with. */
  prompt: string;
  /** Full argv the server invoked the CLI with, for debugging. */
  argv: string[];
  /** Session id passed to `--resume`, or null for a fresh session. */
  resumeSessionId: string | null;
  /** Current lifecycle state of the process. */
  status: RunStatus;
  /** Epoch-ms timestamp the process was spawned. */
  startedAt: number;
  /** Epoch-ms timestamp the process exited; null while still running. */
  endedAt: number | null;
  /** Process exit code once it has exited; null while running or when killed by a signal. */
  exitCode: number | null;
  /** POSIX signal that killed the process (e.g. "SIGTERM"); null otherwise. */
  signal: string | null;
  /** Spawn or runtime error message, or null when none occurred. */
  error: string | null;
  /** Claude Code session id the run created/resumed, once known. */
  sessionId: string | null;
  /** Codex thread name, when the Codex app-server reports one. */
  threadName?: string | null;
  /** Id of the Codex turn currently in progress, or null between turns. */
  activeTurnId?: string | null;
  /** Count of stream-json envelopes emitted so far. */
  envelopeCount: number;
  /** Last chunk of captured stdout, for a quick inline preview. */
  stdoutTail: string;
  /** Last chunk of captured stderr, for a quick inline preview. */
  stderrTail: string;
  /**
   * Raw stream envelopes captured so far. Present only when fetched with `?envelopes=1`, which the
   * live view uses to replay history after a reconnect.
   */
  envelopes?: unknown[]; // present when fetched with ?envelopes=1
}

/** Response shape of GET /api/run. */
export interface RunListResponse {
  /**
   * Runs the server is currently tracking in memory, including recently finished ones that have not
   * been reaped yet.
   */
  items: RunHandle[];
  /** Server-configured cap on simultaneously running processes. */
  maxConcurrent: number;
  /** Count of runs currently in "spawning"/"running" state. */
  activeCount: number;
}

/**
 * A row from the persistent `dashboard_runs` sqlite table - every run ever
 * spawned via /api/run, including completed / errored / killed ones long
 * after the in-memory handle has been reaped.
 *
 * Field names are snake_case here (they mirror the DB columns) whereas the live
 * {@link RunHandle} uses camelCase; the `isLive` flag bridges the two by telling
 * the UI whether a matching live handle still exists for this row.
 */
export interface DashboardRunHistoryItem {
  /** Run id, the same id the live {@link RunHandle} used. */
  id: string;
  /** CLI the run launched. */
  provider: RunProvider;
  /** Claude Code session id the run created/resumed; null if never captured. */
  session_id: string | null;
  /** Whether the run was one-shot or an open conversation. */
  mode: RunMode;
  /** Absolute working directory the run was started in. */
  cwd: string;
  /** Model passed to the CLI, or null when the CLI default applied. */
  model: string | null;
  /** Claude permission mode or Codex approval policy, or null if unrecorded. */
  permission_mode: (PermissionMode | CodexApprovalPolicy) | null;
  /** Codex sandbox mode, or null for Claude runs. */
  sandbox: CodexSandbox | null;
  /** Reasoning effort, or null when the model default applied. */
  effort: EffortLevel | null;
  /** Session id the run resumed, or null for a fresh session. */
  resume_session_id: string | null;
  /** Truncated leading excerpt of the original prompt, for the history list. */
  prompt_preview: string | null;
  /**
   * Last recorded lifecycle state. A run whose process vanished without a clean exit is eventually
   * marked `abandoned`.
   */
  status: RunStatus;
  /** Process exit code, or null while running or when killed by a signal. */
  exit_code: number | null;
  /** ISO timestamp the run was started. */
  started_at: string;
  /** ISO timestamp the run ended, or null while it is still running. */
  ended_at: string | null;
  /** True when an in-memory {@link RunHandle} for this row still exists (so
   *  the UI can offer live actions like "send message"/"kill"); false once
   *  the handle has been reaped and only the DB row remains. */
  isLive: boolean;
}

/** One suggested working directory for the Run page's cwd picker. */
export interface CwdSuggestion {
  /** "dashboard" = this server's own cwd; "home" = user's home dir; "recent"
   *  = previously used for a run. */
  kind: "dashboard" | "home" | "recent";
  /** Absolute directory path that is filled in when the suggestion is picked. */
  path: string;
  /** Display label; defaults to the directory's base name. */
  label: string;
}

/** One entry in {@link RUN_MODEL_CHOICES} - a curated model the Run page's
 *  model picker offers. */
export interface ModelChoice {
  /** Model id sent to the CLI as `--model`. */
  id: string; // value sent to claude --model
  /** User-facing name shown in the model picker. */
  label: string; // user-facing
  /** Short helper text shown under the option. */
  hint?: string;
  /**
   * Effort levels this model accepts. For Codex runs the effort picker offers only these levels
   * (plus the default); Claude runs ignore it.
   */
  supportedEfforts?: Exclude<EffortLevel, "">[];
  /**
   * Effort the CLI uses when no `--effort` is passed, so the picker can label the default; null
   * when unknown.
   */
  defaultEffort?: Exclude<EffortLevel, ""> | null;
  /** Marks the model the CLI uses when no `--model` is passed. */
  isDefault?: boolean;
}

/** Response of the Run page's model list endpoint for one provider. */
export interface RunModelsResponse {
  /** Provider the list belongs to. */
  provider: RunProvider;
  /**
   * True when the list was discovered live (Codex, from its app-server); false for the curated
   * Claude CLI alias list.
   */
  dynamic: boolean;
  /** Where the list came from: `codex-app-server` or `claude-cli-curated-aliases`. */
  source: string;
  /** Models to offer, in display order. */
  items: ModelChoice[];
}

/**
 * One option in the Run page's effort picker for `claude --effort`. Higher levels spend more
 * thinking tokens before the assistant turn; the empty id omits the flag so the model default
 * applies.
 */
export interface EffortChoice {
  /** Value sent as `--effort`; `""` omits the flag. */
  id: EffortLevel;
  /** Label shown in the picker. */
  label: string;
  /** Short helper text describing the trade-off. */
  hint?: string;
}

/**
 * Curated `--effort` options rendered by the Run page's effort picker, ordered from least to most
 * reasoning budget. The empty-id entry omits the flag so the model's own default applies. This is
 * static UI data, not fetched from the server.
 */
export const RUN_EFFORT_CHOICES: EffortChoice[] = [
  { id: "", label: "Default (model decides)", hint: "No --effort flag" },
  { id: "low", label: "Low", hint: "Fast, minimal thinking" },
  { id: "medium", label: "Medium", hint: "Balanced" },
  { id: "high", label: "High", hint: "More reasoning, slower" },
  { id: "xhigh", label: "Extra-high", hint: "Deep reasoning" },
  { id: "max", label: "Max", hint: "All-out - slowest, most tokens" },
  { id: "ultra", label: "Ultra", hint: "Maximum reasoning and delegation" },
];

/** Result of a transcript import run - returned by `api.import.rescan`,
 *  `scanPath`, and `upload`, and mirrored by the final `import.progress`
 *  WebSocket message (`phase: "complete"`). The core counters (`imported`/
 *  `skipped`/`errors`) are always present; the remaining fields are extra
 *  telemetry populated depending on which import flow produced the result. */
export interface ImportResult {
  /**
   * True when the import ran to completion. Individual file failures are counted in `errors` and do
   * not make this false.
   */
  ok: boolean;
  /** Provider whose transcripts were processed. */
  provider: RunProvider;
  /** Which import flow produced this result. */
  source: "default" | "path" | "upload";
  /** Directory that was scanned; present for `source === "path"`. */
  path?: string;
  /** New session/event rows created. */
  imported: number;
  /** Entries already present in the DB, left untouched. */
  skipped: number;
  /** Existing rows updated with data that was missing (e.g. late token usage). */
  backfilled?: number;
  /** Count of files/entries that failed to parse or import. */
  errors: number;
  /** Distinct session ids encountered during the scan. */
  sessions_seen?: number;
  /** Project directories/JSONL files scanned (default/path import). */
  files_scanned?: number;
  /** Files actually received in the multipart request (upload import). */
  files_received?: number;
  /** Total transcript entries successfully parsed. */
  entries_extracted?: number;
  /** Entries skipped during parsing (e.g. malformed lines). */
  entries_skipped?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Remote Sources types — SSH machines whose Claude Code and Codex history is pulled in.
// ─────────────────────────────────────────────────────────────────────────────

/** A configured remote source with its live sync status (server response). */
export interface RemoteSource {
  /** Stable id (`src_…`), also the value written to `sessions.source`. */
  id: string;
  /** Human-friendly name shown in the UI and on session source badges. */
  label: string;
  /** SSH destination: `user@host` or a `~/.ssh/config` alias. */
  host: string;
  /** Optional non-default SSH port. */
  ssh_port: number | null;
  /** Optional path to a private key the host already controls. */
  identity_file: string | null;
  /** Optional remote CLAUDE_HOME (default `~/.claude`). */
  remote_home: string | null;
  /** Optional remote CODEX_HOME (default `~/.codex`). */
  remote_codex_home: string | null;
  /** Whether the background poller pulls this source. */
  enabled: boolean;
  /** Last known sync state. */
  status: "idle" | "syncing" | "ok" | "error";
  /** Last Claude-specific discovery/sync state, or null for legacy source rows. */
  claude_status: RemoteProviderStatus | null;
  /** Last Codex-specific discovery/sync state, or null for legacy source rows. */
  codex_status: RemoteProviderStatus | null;
  /** Last error message, when `status === "error"`. */
  last_error: string | null;
  /** ISO timestamp of the last successful sync, or null. */
  last_sync_at: string | null;
  /** Import counters from the last successful sync, or null. */
  last_sync_counts: {
    imported?: number;
    skipped?: number;
    backfilled?: number;
    errors?: number;
    sessions_seen?: number;
    sessions_tagged?: number;
    providers?: Partial<Record<RemoteProvider, RemoteProviderSyncDetails>>;
  } | null;
  /** Live number of sessions currently attributed to this source. */
  session_count?: number;
  /** ISO timestamp the source was added. */
  created_at: string;
  /** ISO timestamp the source was last edited. */
  updated_at: string;
}

/** Request body for creating/updating a remote source. */
export interface RemoteSourceInput {
  /** Display name for the source; required. */
  label: string;
  /** SSH destination: `user@host` or a `~/.ssh/config` alias; required. */
  host: string;
  /** Non-default SSH port; null or omitted uses 22 or the ssh_config value. */
  ssh_port?: number | null;
  /**
   * Path to a private key that already exists on the dashboard host; null or omitted uses the SSH
   * agent or ssh_config.
   */
  identity_file?: string | null;
  /** Remote Claude home override; null or omitted means `~/.claude`. */
  remote_home?: string | null;
  /** Remote Codex home override; null or omitted means `~/.codex`. */
  remote_codex_home?: string | null;
  /** Whether the background poller should sync this source. Defaults to enabled on create. */
  enabled?: boolean;
}

/** Providers whose history a remote source can mirror over SSH. Cursor is not mirrored remotely. */
export type RemoteProvider = "claude" | "codex";
/**
 * Per-provider sync state. `unavailable` means that provider's history directory does not exist on
 * the remote, which is expected when the machine only runs one CLI and is not treated as a failure.
 */
export type RemoteProviderStatus = "idle" | "syncing" | "ok" | "unavailable" | "error";

/** Outcome of syncing one provider during a remote sync. */
export interface RemoteProviderSyncDetails {
  /** Final state for this provider. */
  status: RemoteProviderStatus;
  /** Sessions or events newly imported from this provider. */
  imported?: number;
  /** Entries already present and left untouched. */
  skipped?: number;
  /** Existing rows filled in with data that was previously missing. */
  backfilled?: number;
  /** Files or entries that failed to import. */
  errors?: number;
  /** Distinct sessions found in the mirrored history. */
  sessions_seen?: number;
  /** Sessions attributed to this source, i.e. their `sessions.source` set to the source id. */
  sessions_tagged?: number;
  /** Error message when `status` is `error` or `unavailable`. */
  error?: string;
  /**
   * Non-fatal warning from Codex only: the remote `session_index.jsonl` title index could not be
   * copied. Rollouts still import; renamed sessions just keep their default titles.
   */
  title_index_warning?: string;
}

/** Result of a connectivity probe (POST /:id/test). */
export interface RemoteSourceTestResult {
  /** True when SSH connected and at least one provider's history directory was verified. */
  ok: boolean;
  /** Human-readable summary of the probe, shown verbatim in the UI. */
  message: string;
  /** Remote Claude projects path that was probed. */
  remoteProjects?: string;
  /** Remote Codex sessions path that was probed. */
  remoteCodexSessions?: string;
  /**
   * Per-provider probe outcome with the remote path checked. `unavailable` means the directory does
   * not exist on the remote.
   */
  providers?: Partial<
    Record<
      RemoteProvider,
      { status: Exclude<RemoteProviderStatus, "idle" | "syncing">; message: string; path: string }
    >
  >;
}

/** Result of an on-demand sync (POST /:id/sync). */
export interface RemoteSourceSyncResult {
  /** Whether the sync completed successfully. */
  ok?: boolean;
  /** Rows newly imported across all providers. */
  imported?: number;
  /** Entries already present and left untouched, across all providers. */
  skipped?: number;
  /** Existing rows filled in with previously missing data, across all providers. */
  backfilled?: number;
  /** Files or entries that failed to import, across all providers. */
  errors?: number;
  /** Distinct sessions found across all providers. */
  sessions_seen?: number;
  /** Sessions attributed to this source across all providers. */
  sessions_tagged?: number;
  /** Per-provider breakdown of the counters above. */
  providers?: Partial<Record<RemoteProvider, RemoteProviderSyncDetails>>;
  /** Present when the sync was skipped because one was already running. */
  skipped_reason?: string;
}

/** Result of POST /api/settings/import — restoring a full export bundle
 *  ({@link api.settings.importData}). Session-scoped tables report rows that
 *  were newly inserted; `sessions_skipped` counts sessions already present
 *  (skipped whole to stay idempotent). Config tables report new rows only. */
export interface ImportBackupResult {
  /**
   * True when the bundle was parsed and restored. Per-entry failures are counted in `errors`
   * instead.
   */
  ok: boolean;
  /** The uploaded filename or server-side path the bundle was read from. */
  source: string;
  /** Bundle format marker, or null for a legacy (pre-versioning) export. */
  format: string | null;
  /** Sessions inserted from the bundle. */
  sessions_imported: number;
  /**
   * Sessions already present and skipped whole, including all their child rows, which is what keeps
   * restore idempotent.
   */
  sessions_skipped: number;
  /** Agent rows inserted for newly imported sessions. */
  agents: number;
  /** Event rows inserted for newly imported sessions. */
  events: number;
  /** Token usage rows inserted for newly imported sessions. */
  token_usage: number;
  /** Workflow rows inserted for newly imported sessions. */
  workflows: number;
  /** Run history rows inserted. */
  dashboard_runs: number;
  /** Alert rules inserted that did not already exist. */
  alert_rules: number;
  /**
   * Claude pricing rules inserted that did not already exist. Existing rules are never overwritten.
   */
  model_pricing: number;
  /**
   * Cursor pricing rules inserted that did not already exist. Existing rules are never overwritten.
   */
  cursor_model_pricing: number;
  /** Bundle entries that could not be restored (e.g. a session with no id). */
  errors: number;
}
