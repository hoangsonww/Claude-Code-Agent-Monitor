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
  DashboardEvent,
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

import { activeSourcesParam } from "./dataScope";

// Root path all endpoint paths are appended to. Kept relative (no host) so the
// same client bundle works behind the Vite dev proxy and in same-origin prod.
const BASE = "/api";

/**
 * Append the current global data-scope (see {@link activeSourcesParam}) as a
 * `sources` query param, unless the caller already set one. Called by the
 * scoped list/aggregate endpoints (sessions, events, agents, stats, analytics)
 * so changing the scope narrows the whole app without every call site threading
 * it. `mode: "all"` yields no param, so unscoped installs hit clean URLs.
 */
function applyScope(qs: URLSearchParams): URLSearchParams {
  if (!qs.has("sources")) {
    const sources = activeSourcesParam();
    if (sources) qs.set("sources", sources);
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
    facets: () => request<{ cwds: string[]; sources: string[] }>("/sessions/facets"),
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
     * @param params.cwd      Restrict to one working directory (see `facets`).
     * @param params.sort_by  Column to sort by.
     * @param params.sort_desc Descending when true; sent even when explicitly false.
     * @param params.limit    Page size.
     * @param params.offset   Row offset into the result set.
     * @returns `{ sessions, total, limit, offset }` — the page plus the total
     *   row count and the effective paging window for building pager controls.
     */
    list: (params?: {
      status?: string;
      q?: string;
      cwd?: string;
      sort_by?: string;
      sort_desc?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      const qs = new URLSearchParams();
      // Only append params that were actually supplied so the URL stays minimal.
      if (params?.status) qs.set("status", params.status);
      if (params?.q) qs.set("q", params.q);
      if (params?.cwd) qs.set("cwd", params.cwd);
      if (params?.sort_by) qs.set("sort_by", params.sort_by);
      // `!== undefined` (not truthiness) so an explicit `sort_desc: false` is preserved.
      if (params?.sort_desc !== undefined) qs.set("sort_desc", String(params.sort_desc));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      applyScope(qs); // narrow to the active data scope (source machines)
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
    get: (id: string) =>
      request<{
        session: Session;
        agents: Agent[];
        events: DashboardEvent[];
        workflows: WorkflowRun[];
      }>(`/sessions/${encodeURIComponent(id)}`),
    /**
     * GET /api/sessions/:id/stats - per-session rollups for the detail page.
     *
     * Aggregate metrics scoped to a single session (token/tool/cost rollups and
     * similar), rendered in the session detail header/summary cards.
     *
     * @param id The session id.
     * @returns {@link SessionStats} for that one session.
     */
    stats: (id: string) => request<SessionStats>(`/sessions/${encodeURIComponent(id)}/stats`),
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
    transcripts: (id: string) =>
      request<TranscriptListResult>(`/sessions/${encodeURIComponent(id)}/transcripts`),
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
        agent_id?: string;
        run_id?: string;
        limit?: number;
        offset?: number;
        after?: number;
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
    list: (params?: { status?: string; session_id?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.session_id) qs.set("session_id", params.session_id);
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
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
      event_type?: string[];
      tool_name?: string[];
      agent_id?: string[];
      session_id?: string | string[];
      q?: string;
      from?: string;
      to?: string;
      limit?: number;
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
    facets: () => request<{ event_types: string[]; tool_names: string[] }>("/events/facets"),
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
     *   - `server`: process uptime, Node version, platform/arch, live WebSocket
     *     connection count, process memory, CPU load averages, and host memory/
     *     cpu counts.
     *   - `transcript_cache`: LRU cache occupancy, capacity, hit/miss counts,
     *     and the currently-cached keys.
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
        hooks: { installed: boolean; path: string; hooks: Record<string, boolean> };
        server: {
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
    /**
     * POST /api/settings/reset-pricing - restore the built-in default
     * {@link ModelPricing} rules, discarding any custom edits.
     *
     * Wipes user-customized pricing rules and reseeds the shipped defaults;
     * returns the resulting rule set so the Pricing UI can re-render.
     *
     * @returns `{ ok, pricing }` — the full default rule list now in effect.
     */
    resetPricing: () =>
      request<{ ok: boolean; pricing: ModelPricing[] }>("/settings/reset-pricing", {
        method: "POST",
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
     * @returns `{ ok, abandoned, purged_sessions, purged_events, purged_agents }`
     *   — how many records each part of the sweep affected.
     */
    cleanup: (params: { abandon_hours?: number; purge_days?: number }) =>
      request<{
        ok: boolean;
        abandoned: number;
        purged_sessions: number;
        purged_events: number;
        purged_agents: number;
      }>("/settings/cleanup", { method: "POST", body: JSON.stringify(params) }),
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
    get: (status?: string) =>
      request<WorkflowData>(`/workflows${status && status !== "all" ? `?status=${status}` : ""}`),
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
    session: (id: string) =>
      request<SessionDrillIn>(`/workflows/session/${encodeURIComponent(id)}`),
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
    run: (runId: string) =>
      request<WorkflowRunDetail>(`/workflows/runs/${encodeURIComponent(runId)}`),
  },

  // ─────────────────────────────── Pricing API ────────────────────────────────
  /** {@link ModelPricing} rule CRUD, plus computed cost totals. */
  pricing: {
    /**
     * GET /api/pricing - all configured pricing rules.
     * @returns `{ pricing }` — the full list of {@link ModelPricing} rules.
     */
    list: () => request<{ pricing: ModelPricing[] }>("/pricing"),
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
    totalCost: () =>
      request<CostResult>(`/pricing/cost?tz_offset=${new Date().getTimezoneOffset()}`),
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
    sessionCost: (sessionId: string) =>
      request<CostResult>(
        `/pricing/cost/${encodeURIComponent(sessionId)}?tz_offset=${new Date().getTimezoneOffset()}`
      ),
  },

  // ──────────────────────────────── Import API ────────────────────────────────
  /** Transcript import: on-disk scan/rescan, an explicit path scan, or a
   *  browser file upload - all three converge on the same {@link ImportResult}
   *  shape and stream progress via the `import.progress` WS message. */
  import: {
    /**
     * GET /api/import/guide - platform-specific instructions and constraints
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
    guide: () =>
      request<{
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
      }>("/import/guide"),
    /**
     * POST /api/import/rescan - re-scan the default projects directory.
     *
     * Kicks off an import over the server's default `~/.claude/projects` dir.
     * Progress is pushed live over the `import.progress` WebSocket message; the
     * returned {@link ImportResult} is the final tally (`source: "default"`).
     *
     * @returns {@link ImportResult} — the completed-scan summary.
     */
    rescan: () => request<ImportResult>("/import/rescan", { method: "POST" }),
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
    scanPath: (path: string) =>
      request<ImportResult>("/import/scan-path", {
        method: "POST",
        body: JSON.stringify({ path }),
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
    upload: async (files: File[]): Promise<ImportResult> => {
      const form = new FormData();
      // Append each file under the repeated "files" field, keeping its filename.
      for (const f of files) form.append("files", f, f.name);
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

  // ────────────────────────────────── Run API ─────────────────────────────────
  /** Spawn/manage headless or conversational `claude` CLI child processes
   *  launched from the dashboard's Run page, and stream their output. */
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
    binary: () => request<{ found: boolean; path: string | null }>("/run/binary"),
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
    send: (id: string, text: string) =>
      request<{ messageId: string }>(`/run/${encodeURIComponent(id)}/message`, {
        method: "POST",
        body: JSON.stringify({ text }),
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
        name: string;
        rule_type: AlertRule["rule_type"];
        config: AlertRule["config"];
        enabled?: boolean;
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
      name: string;
      type: WebhookType;
      url?: string;
      enabled?: boolean;
      secret?: string;
      headers?: Record<string, string>;
      config?: Record<string, string>;
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
        name?: string;
        url?: string;
        enabled?: boolean;
        secret?: string | null;
        headers?: Record<string, string>;
        config?: Record<string, string>;
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
  /** Remote (SSH) machines whose Claude Code history this dashboard pulls in.
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
  // "auto-memory" targets a per-project memory file and requires `project`.
  scope: "user" | "project" | "auto-memory";
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
  scope: "user" | "project" | "auto-memory";
  type: CcArtifactType;
  name?: string;
  project?: string;
}

/** Response shape of a successful `ccConfig.write`/`delete` call. */
export interface CcMutationResult {
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
  scope: "user" | "project" | "auto-memory";
  type: CcArtifactType;
  name: string;
  /** Absolute path to the backup copy (not the original file). */
  backupPath: string;
  /** Whether the backed-up artifact is a directory (vs. a single file). */
  isDir: boolean;
  /** Backup file's mtime, epoch milliseconds. */
  mtime: number;
  /** Backup size in bytes; null for directory backups. */
  size: number | null;
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
  scope: "user" | "project";
  /** Artifact name, derived from its filename/frontmatter. */
  name: string;
  /** Filename only, when the API returns it instead of a full path. */
  file?: string;
  /** Absolute path, when the API returns it instead of a bare filename. */
  path?: string;
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
  skills: number;
  agents: number;
  commands: number;
  outputStyles: number;
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
  name: string;
  /** Marketplace it was installed from; null for a manually-installed plugin. */
  marketplace: string | null;
  /** Install scope, e.g. "user" or "project". */
  scope: string;
  version: string | null;
  /** Absolute path where the plugin's files live. */
  installPath: string | null;
  installedAt: string | null;
  /** ISO timestamp of the last update check/pull for this plugin. */
  lastUpdated: string | null;
  /** Git commit SHA the plugin was installed/updated at, if it's a git checkout. */
  gitCommitSha: string | null;
  /** Whether `installPath` still exists on disk (false = broken/missing install). */
  installPathExists: boolean;
  /** Whether the plugin is active; null when enablement isn't tracked for it. */
  enabled: boolean | null;
  contributes: CcPluginContributions | null;
}

/** Response shape of GET /api/cc-config/plugins. */
export interface CcPluginsResponse {
  /** Path to the plugin install manifest file. */
  manifestPath: string;
  manifestExists: boolean;
  plugins: CcPlugin[];
}

/** One configured MCP server entry, from GET /api/cc-config/mcp. Fields are
 *  conditionally present depending on `kind` (stdio vs http). Note that only
 *  env-var/header *names* are surfaced, never their values, to avoid leaking
 *  secrets into the dashboard. */
export interface CcMcpServer {
  name: string;
  /** Which config file this entry came from (e.g. a `.mcp.json` path). */
  source: string;
  /** Transport: local subprocess ("stdio"), remote HTTP, or undetermined. */
  kind: "stdio" | "http" | "unknown";
  /** Launch command, for `kind === "stdio"`. */
  command?: string;
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
  scope: "user" | "project" | "project-local";
  file: string;
  exists: boolean;
  /** Parsed JSON contents; absent when `exists` is false. */
  data?: unknown;
  /** Raw file size in bytes, when known. */
  raw_size?: number;
}

/** One memory artifact - either a project's/user's editable CLAUDE.md, or a
 *  read-only auto-memory file - from GET /api/cc-config/memory. */
export interface CcMemoryItem {
  // "user"/"project" are the two CLAUDE.md files (editable). "auto-memory"
  // is a per-project file-based memory file under ~/.claude/projects/<slug>/
  // memory/ — read-only in the dashboard for now.
  scope: "user" | "project" | "auto-memory";
  file: string;
  size: number;
  mtime: number;
  truncated: boolean;
  preview: string;
  // Present only for scope === "auto-memory":
  project?: string; // the projects/<slug> dir name
  name?: string; // the markdown filename (e.g. MEMORY.md, feedback_x.md)
  isIndex?: boolean; // true for MEMORY.md / INDEX-*.md table-of-contents files
  frontmatter?: Record<string, string>; // parsed YAML frontmatter, if any
}

/** Response shape of GET /api/cc-config/file - full contents of one config
 *  artifact, for the read/edit view. */
export interface CcFileResponse {
  ok: true;
  file: string;
  /** File contents (possibly truncated - see `truncated`). */
  text: string;
  /** Full on-disk file size in bytes (may exceed `text.length` if truncated). */
  size: number;
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
  name: string;
  /** Where the marketplace is sourced from (git repo, URL, …); null if unknown. */
  source: { source?: string; repo?: string; url?: string } | null;
  /** Local checkout path for a git-based marketplace; null otherwise. */
  installLocation: string | null;
  lastUpdated: string | null;
  /** Number of plugins the marketplace publishes; null if not yet indexed. */
  pluginCount: number | null;
  /** Marketplace's own self-reported display name (may differ from `name`). */
  marketplaceName: string | null;
  marketplaceDescription: string | null;
  marketplaceOwner: { name?: string; url?: string } | null;
}

/** Response shape of GET /api/cc-config/marketplaces. */
export interface CcMarketplacesResponse {
  /** Path to the marketplace registry file the dashboard reads. */
  knownPath: string;
  knownExists: boolean;
  items: CcMarketplace[];
}

/** One logical group of keybindings sharing a UI context (e.g. "editor",
 *  "global"), as parsed from `keybindings.json`. */
export interface CcKeybindingGroup {
  context: string;
  bindings: { key: string; action: string }[];
}

/** Response shape of GET /api/cc-config/keybindings. */
export interface CcKeybindings {
  file: string;
  exists: boolean;
  /** JSON schema URL declared in the file, if any. */
  schema?: string | null;
  /** Doc/help URL declared in the file, if any. */
  docs?: string | null;
  groups: CcKeybindingGroup[];
}

/** One statusline script file, referenced by {@link CcStatusline.config}. */
export interface CcStatuslineScript {
  file: string;
  size: number;
  mtime: number;
  truncated: boolean;
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
  dir: string;
  items: { name: string; file: string; size: number; mtime: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Run types — request/response shapes for the Run page's `claude` process
// spawning/management. `RunMode`/`RunStatus`/`PermissionMode`/`EffortLevel`
// mirror the CLI's own vocabulary so the dashboard can drive the CLI faithfully.
// ─────────────────────────────────────────────────────────────────────────────

/** "headless" runs to completion unattended and streams only output;
 *  "conversation" keeps stdin open so the user can send follow-up messages. */
export type RunMode = "headless" | "conversation";
/** Lifecycle of a spawned `claude` process, mirrored in `RunHandle.status`
 *  and `RunStatusPayload.status`. "abandoned" is applied by server cleanup
 *  when a handle is reaped without a clean exit ever being observed. */
export type RunStatus = "spawning" | "running" | "completed" | "error" | "killed" | "abandoned";
/** Maps 1:1 to the `claude --permission-mode` CLI flag. */
export type PermissionMode = "acceptEdits" | "default" | "plan" | "bypassPermissions";
/** Maps 1:1 to the `claude --effort` CLI flag; "" omits the flag (model default). */
export type EffortLevel = "" | "low" | "medium" | "high" | "xhigh" | "max";

/** Body for POST /api/run - parameters for spawning a new `claude` process. */
export interface RunStartArgs {
  /** Initial prompt/task text passed to the CLI. */
  prompt: string;
  mode: RunMode;
  /** Working directory to launch in; server default applies if omitted. */
  cwd?: string;
  /** `--model` value; omitted inherits the CLI's own default (settings.json). */
  model?: string;
  permissionMode?: PermissionMode;
  /** Resume an existing Claude Code session id (`--resume`) instead of starting fresh. */
  resumeSessionId?: string;
  effort?: EffortLevel;
}

/** In-memory (or freshly-fetched) handle for one spawned `claude` process,
 *  from POST/GET /api/run - the live counterpart to {@link DashboardRunHistoryItem}.
 *  Where {@link DashboardRunHistoryItem} is the persisted DB row (snake_case,
 *  survives handle reaping), this is the richer live handle (camelCase, carries
 *  argv/tails/envelope counters) that only exists while the server tracks it. */
export interface RunHandle {
  id: string;
  /** OS process id; null before the process has actually spawned. */
  pid: number | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  permissionMode: PermissionMode;
  effort: EffortLevel | null;
  prompt: string;
  /** Full argv the server invoked the CLI with, for debugging. */
  argv: string[];
  resumeSessionId: string | null;
  status: RunStatus;
  /** Epoch-ms timestamp the process was spawned. */
  startedAt: number;
  /** Epoch-ms timestamp the process exited; null while still running. */
  endedAt: number | null;
  exitCode: number | null;
  /** POSIX signal that killed the process (e.g. "SIGTERM"); null otherwise. */
  signal: string | null;
  error: string | null;
  /** Claude Code session id the run created/resumed, once known. */
  sessionId: string | null;
  /** Count of stream-json envelopes emitted so far. */
  envelopeCount: number;
  /** Last chunk of captured stdout, for a quick inline preview. */
  stdoutTail: string;
  /** Last chunk of captured stderr, for a quick inline preview. */
  stderrTail: string;
  envelopes?: unknown[]; // present when fetched with ?envelopes=1
}

/** Response shape of GET /api/run. */
export interface RunListResponse {
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
  id: string;
  /** Claude Code session id the run created/resumed; null if never captured. */
  session_id: string | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  permission_mode: PermissionMode | null;
  effort: EffortLevel | null;
  resume_session_id: string | null;
  /** Truncated leading excerpt of the original prompt, for the history list. */
  prompt_preview: string | null;
  status: RunStatus;
  exit_code: number | null;
  started_at: string;
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
  path: string;
  label: string;
}

/** One entry in {@link RUN_MODEL_CHOICES} - a curated model the Run page's
 *  model picker offers. */
export interface ModelChoice {
  id: string; // value sent to claude --model
  label: string; // user-facing
  /** Short helper text shown under the option. */
  hint?: string;
}

// Effort level choices for `claude --effort`. Higher = more thinking tokens
// before the assistant turn. Empty inherits the model's default.
export interface EffortChoice {
  id: EffortLevel;
  label: string;
  hint?: string;
}

// Curated `--effort` options rendered by the Run page's effort picker, ordered
// from least to most reasoning budget. The empty-id entry omits the flag so the
// model's own default applies. This is UI-facing static data, not fetched.
export const RUN_EFFORT_CHOICES: EffortChoice[] = [
  { id: "", label: "Default (model decides)", hint: "No --effort flag" },
  { id: "low", label: "Low", hint: "Fast, minimal thinking" },
  { id: "medium", label: "Medium", hint: "Balanced" },
  { id: "high", label: "High", hint: "More reasoning, slower" },
  { id: "xhigh", label: "Extra-high", hint: "Deep reasoning" },
  { id: "max", label: "Max", hint: "All-out - slowest, most tokens" },
];

// Curated model list. "" means "inherit from settings.json" - no --model flag.
// Static UI data for the Run page's model picker; the first entry inherits the
// configured default and the rest map to concrete `--model` values.
export const RUN_MODEL_CHOICES: ModelChoice[] = [
  { id: "", label: "Inherit from settings", hint: "Use whatever your settings.json model is" },
  {
    id: "claude-opus-4-8[1m]",
    label: "Opus 4.8 (1M context)",
    hint: "Highest capability, 1M token window",
  },
  {
    id: "claude-opus-4-7[1m]",
    label: "Opus 4.7 (1M context)",
    hint: "Previous Opus, 1M token window",
  },
  { id: "sonnet", label: "Sonnet 4.6", hint: "Balanced capability and speed" },
  { id: "haiku", label: "Haiku 4.5", hint: "Fastest, lightest" },
];

/** Result of a transcript import run - returned by `api.import.rescan`,
 *  `scanPath`, and `upload`, and mirrored by the final `import.progress`
 *  WebSocket message (`phase: "complete"`). The core counters (`imported`/
 *  `skipped`/`errors`) are always present; the remaining fields are extra
 *  telemetry populated depending on which import flow produced the result. */
export interface ImportResult {
  ok: boolean;
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
// Remote Sources types — SSH machines whose Claude Code history is pulled in.
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
  /** Whether the background poller pulls this source. */
  enabled: boolean;
  /** Last known sync state. */
  status: "idle" | "syncing" | "ok" | "error";
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
  } | null;
  /** Live number of sessions currently attributed to this source. */
  session_count?: number;
  created_at: string;
  updated_at: string;
}

/** Request body for creating/updating a remote source. */
export interface RemoteSourceInput {
  label: string;
  host: string;
  ssh_port?: number | null;
  identity_file?: string | null;
  remote_home?: string | null;
  enabled?: boolean;
}

/** Result of a connectivity probe (POST /:id/test). */
export interface RemoteSourceTestResult {
  ok: boolean;
  message: string;
  remoteProjects?: string;
}

/** Result of an on-demand sync (POST /:id/sync). */
export interface RemoteSourceSyncResult {
  ok?: boolean;
  imported?: number;
  skipped?: number;
  backfilled?: number;
  errors?: number;
  sessions_seen?: number;
  sessions_tagged?: number;
  /** Present when the sync was skipped because one was already running. */
  skipped_reason?: string;
}

/** Result of POST /api/settings/import — restoring a full export bundle
 *  ({@link api.settings.importData}). Session-scoped tables report rows that
 *  were newly inserted; `sessions_skipped` counts sessions already present
 *  (skipped whole to stay idempotent). Config tables report new rows only. */
export interface ImportBackupResult {
  ok: boolean;
  /** The uploaded filename or server-side path the bundle was read from. */
  source: string;
  /** Bundle format marker, or null for a legacy (pre-versioning) export. */
  format: string | null;
  sessions_imported: number;
  sessions_skipped: number;
  agents: number;
  events: number;
  token_usage: number;
  workflows: number;
  dashboard_runs: number;
  alert_rules: number;
  model_pricing: number;
  /** Bundle entries that could not be restored (e.g. a session with no id). */
  errors: number;
}
