/**
 * @file types.ts
 * @description Defines TypeScript types and interfaces for the agent dashboard application, including data structures for sessions, agents, events, statistics, analytics, model pricing, cost breakdowns, WebSocket messages, and workflow-related data. These types provide a clear contract for the shape of data used throughout the application and facilitate type safety when interacting with the backend API and managing state within the frontend components.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
 */
export const AWAITING_STATUS = "waiting" as const;
export type EffectiveAgentStatus = AgentStatus | typeof AWAITING_STATUS;
export type EffectiveSessionStatus = SessionStatus | typeof AWAITING_STATUS;

/**
 * A Claude Code CLI invocation tracked by the dashboard - one row per top-level
 * `claude` process, created on its first hook event (or on import) and updated
 * as hooks stream in. Returned by GET /api/sessions, /api/sessions/:id, and
 * pushed live via the `session_created`/`session_updated` WebSocket messages.
 */
export interface Session {
  /** Session UUID, taken from the Claude Code hook payload's `session_id`. */
  id: string;
  /** User-assigned or auto-derived display title; null until named (e.g. via
   *  `/rename`, `claude -n`, or the picker) - the UI falls back to the id. */
  name: string | null;
  status: SessionStatus;
  /** Working directory the CLI was launched from, or null if never reported. */
  cwd: string | null;
  /** Model id reported by the session's SessionStart hook; null if unknown. */
  model: string | null;
  /** ISO timestamp of the session's first hook event. */
  started_at: string;
  /** ISO timestamp of SessionEnd, or null while the session is still active. */
  ended_at: string | null;
  /** Opaque JSON string of extra session metadata; parse before use. May be null. */
  metadata: string | null;
  /** Count of `Agent` rows (main + subagents) belonging to this session.
   *  Only present on list/detail responses that join agent counts. */
  agent_count?: number;
  /** ISO timestamp of the most recent event in this session, for "last active"
   *  sorting; only present where the query computes it. */
  last_activity?: string;
  /** Total USD cost for the session, computed from its token usage against the
   *  active pricing rules. Only present on responses that attach pricing. */
  cost?: number;
  /** ISO timestamp set when Claude Code is blocked waiting for the user
   * (permission prompt or "waiting for your input" notice). Cleared on the
   * next non-Notification hook event. Null when the session is not waiting. */
  awaiting_input_since?: string | null;
}

/**
 * A single agent process within a session: either the main Claude Code CLI or
 * a subagent spawned via the Task/Agent tool. Returned nested under `Session`
 * responses and by GET /api/agents; pushed live via `agent_created`/`agent_updated`.
 */
export interface Agent {
  /** Agent UUID. For main agents this is typically `${session_id}-main`. */
  id: string;
  /** Owning session's id (foreign key into `Session.id`). */
  session_id: string;
  /** Display name - the subagent_type for subagents, or a generic main-agent
   *  label; used for the swim-lane / pill labels when subagent_type is unset. */
  name: string;
  type: AgentType;
  /** Task/Agent tool `subagent_type` (e.g. "frontend-reviewer"); null for main
   *  agents and for subagents that predate this field. */
  subagent_type: string | null;
  status: AgentStatus;
  /** Free-text description of what the agent was asked to do (from the Task
   *  tool's `description`/`prompt` input); null when not captured. */
  task: string | null;
  /** Name of the tool currently mid-execution (set on PreToolUse, cleared on
   *  PostToolUse); null when the agent isn't inside a tool call. */
  current_tool: string | null;
  /** ISO timestamp the agent was created (its first hook event). */
  started_at: string;
  /** ISO timestamp the agent finished (Stop/SubagentStop), or null if running. */
  ended_at: string | null;
  /** ISO timestamp of the most recent event attributed to this agent. */
  updated_at: string;
  /** Id of the agent that spawned this one via Task/Agent; null for main agents
   *  and for subagents whose parent wasn't recorded (e.g. legacy imports). */
  parent_agent_id: string | null;
  /** Opaque JSON string (e.g. per-agent token buckets under `.tokens`, used by
   *  `cost` below); parse before use. May be null. */
  metadata: string | null;
  /** Mirrors the parent session: ISO timestamp when set, null otherwise. */
  awaiting_input_since?: string | null;
  /**
   * The agent's OWN cost (USD), computed server-side from its per-agent token
   * buckets. Present for subagents that carry usage in their metadata; 0/absent
   * for main agents (whose cost is the session total) and compaction agents.
   */
  cost?: number;
}

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
 * A single raw hook/lifecycle event ingested from a Claude Code session -
 * the atomic unit rendered in the ActivityFeed / SessionDetail timelines.
 * Returned by GET /api/events and /api/sessions/:id; streamed live as the
 * `new_event` WebSocket message.
 */
export interface DashboardEvent {
  /** Autoincrement primary key (also the WS/pagination cursor). */
  id: number;
  /** Owning session's id. */
  session_id: string;
  /** Id of the agent that produced the event; null for session-level events
   *  emitted before any agent row exists. */
  agent_id: string | null;
  /** Hook name, e.g. "PreToolUse", "Stop", "SessionStart", "Compaction",
   *  "TurnDuration", "APIError" - see {@link statusFromEventType} for the
   *  mapping to a UI status badge. */
  event_type: string;
  /** Tool invoked for PreToolUse/PostToolUse events (e.g. "Bash", "Edit",
   *  or an `mcp__server__tool` name); null for non-tool events. */
  tool_name: string | null;
  /** Short server-generated description shown in list rows; null when the
   *  importer had nothing more useful than the raw payload. */
  summary: string | null;
  /** Opaque JSON string of the full hook payload (tool_input/tool_response,
   *  cwd, etc.) - `JSON.parse` before reading; null if the payload was empty. */
  data: string | null;
  /** ISO timestamp the event was recorded (ingest time, not hook-reported time). */
  created_at: string;
}

/** Response shape of GET /api/stats - the lightweight counters polled for the
 *  dashboard header/overview cards. See {@link Analytics} for the richer,
 *  chart-oriented superset served from /api/analytics. */
export interface Stats {
  total_sessions: number;
  /** Sessions whose `status` is "active" (not yet ended or errored). */
  active_sessions: number;
  /** Agents whose `status` is "working" or "waiting". */
  active_agents: number;
  total_agents: number;
  total_events: number;
  /** Events recorded since local midnight, per the client's `tz_offset` query param. */
  events_today: number;
  /** Number of currently-open dashboard WebSocket connections on this server. */
  ws_connections: number;
  /** Agent count keyed by `AgentStatus` value. */
  agents_by_status: Record<string, number>;
  /** Session count keyed by `SessionStatus` value. */
  sessions_by_status: Record<string, number>;
}

/**
 * Response shape of GET /api/analytics - aggregated token/tool/session metrics
 * that back the Analytics page's charts. A superset of {@link Stats}: `overview`
 * mirrors the same overview counters so both endpoints share the same shape
 * for the common fields.
 */
export interface Analytics {
  /** Lifetime token totals across every session, by bucket. */
  tokens: {
    total_input: number;
    total_output: number;
    /** Tokens served from prompt cache reads (billed at the cheaper cache rate). */
    total_cache_read: number;
    /** Tokens written to create/extend a prompt cache entry. */
    total_cache_write: number;
  };
  /** Tool invocation counts across all events, most-used first. */
  tool_usage: Array<{ tool_name: string; count: number }>;
  /** Event counts bucketed by local calendar day, for the activity chart. */
  daily_events: Array<{ date: string; count: number }>;
  /** New-session counts bucketed by local calendar day. */
  daily_sessions: Array<{ date: string; count: number }>;
  /** Subagent counts grouped by `subagent_type`. */
  agent_types: Array<{ subagent_type: string; count: number }>;
  /** Event counts grouped by `event_type`. */
  event_types: Array<{ event_type: string; count: number }>;
  /** Mean number of events per session, across all sessions. */
  avg_events_per_session: number;
  /** Total count of agents with `type === "subagent"` across all sessions. */
  total_subagents: number;
  /** Same overview counters as {@link Stats}, minus `events_today`/`ws_connections`. */
  overview: {
    total_sessions: number;
    active_sessions: number;
    active_agents: number;
    total_agents: number;
    total_events: number;
  };
  agents_by_status: Record<string, number>;
  sessions_by_status: Record<string, number>;
}

/**
 * A user-defined cost rule row from GET/PUT /api/pricing. Token usage is
 * matched against the longest `model_pattern` whose `%`-wildcard regex matches
 * the bucket's model id (see server/routes/pricing.js `calculateCost`); all
 * rate fields are USD per million tokens ("MTok").
 */
export interface ModelPricing {
  /** SQL LIKE-style pattern (`%` wildcard) matched against a token bucket's
   *  model id; longer/more-specific patterns win ties. Primary key. */
  model_pattern: string;
  /** Human-readable name shown in the Settings pricing table. */
  display_name: string;
  input_per_mtok: number;
  output_per_mtok: number;
  /** Rate for tokens served from prompt-cache reads (cheaper than input). */
  cache_read_per_mtok: number;
  /** Rate for tokens written to a 5-minute prompt-cache entry. */
  cache_write_per_mtok: number;
  /** Rate for tokens written to a 1-hour (extended) prompt-cache entry. */
  cache_write_1h_per_mtok: number;
  /** Premium input rate applied when a token bucket's `speed` is "fast". */
  fast_input_per_mtok: number;
  /** Premium output rate applied when a token bucket's `speed` is "fast". */
  fast_output_per_mtok: number;
  // Time-limited introductory rates: usage on/before intro_until (YYYY-MM-DD)
  // prices at these rates, after it at the standard rates. null/0 = no intro.
  intro_input_per_mtok?: number;
  intro_output_per_mtok?: number;
  intro_cache_read_per_mtok?: number;
  intro_cache_write_per_mtok?: number;
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
 */
export interface CostBreakdown {
  model: string;
  /** "standard" or "fast" (premium, lower-latency) inference tier. */
  speed?: string;
  /** Data-residency region the request was billed under (e.g. "us"), which
   *  applies a pricing multiplier; absent/"global" for the default region. */
  inference_geo?: string;
  /** "standard" or "batch" (discounted, async) API tier. */
  service_tier?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  /** Total cache-write tokens (5-minute + 1-hour splits combined). */
  cache_write_tokens: number;
  /** Portion of `cache_write_tokens` written to a 1-hour cache entry. */
  cache_write_1h_tokens?: number;
  /** Count of server-side web_search tool invocations in this bucket. */
  web_search_requests?: number;
  /** Count of server-side web_fetch tool invocations in this bucket. */
  web_fetch_requests?: number;
  /** Count of server-side code_execution tool invocations in this bucket. */
  code_execution_requests?: number;
  /** USD cost for this bucket (token cost + web-search surcharge). */
  cost: number;
  /** The `ModelPricing.model_pattern` that matched, or null if no rule matched
   *  (in which case `cost` is 0 and the usage also appears in `unpriced_models`). */
  matched_rule: string | null;
}

/** Non-token surcharges layered on top of the per-bucket token cost in a
 *  {@link CostResult}: web search, web fetch, and code-execution container time. */
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
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

/** Response shape of GET /api/pricing/cost and /api/pricing/cost/:sessionId. */
export interface CostResult {
  /** Grand total USD cost (token cost + all feature surcharges). */
  total_cost: number;
  breakdown: CostBreakdown[];
  /** Total cost per local calendar day, oldest first. */
  daily_costs: Array<{ date: string; cost: number }>;
  feature_costs?: CostFeatureCosts;
  /** Present only when at least one model had usage but no pricing rule. */
  unpriced_models?: UnpricedModel[];
}

/** Payload of the `import.progress` WebSocket message, streamed while a
 *  transcript import (default scan, path scan, or file upload) is running. */
export interface ImportProgressMessage {
  /** Correlates progress events to one import run; absent on terminal states
   *  emitted without a tracked run. */
  importId?: string;
  /** Import lifecycle stage; "extract_error" is a non-fatal per-file failure
   *  during "extract" that doesn't abort the overall run. */
  phase: "start" | "scan" | "extract" | "parse" | "complete" | "error" | "extract_error";
  /** Which import flow triggered this run. */
  source?: "default" | "path" | "upload";
  /** Items processed so far, for a determinate progress bar. */
  processed?: number;
  /** Total items expected, once known (may be absent during "scan"). */
  total?: number;
  /** Short label for what's currently being processed (e.g. a file name). */
  current?: string;
  /** Filesystem path being scanned/imported, when applicable. */
  path?: string;
  /** Human-readable failure message; present on "error"/"extract_error". */
  error?: string;
  /** Running tallies (e.g. imported/skipped/errors) keyed by counter name. */
  counters?: Record<string, number>;
}

/** Payload for `update_status` WebSocket messages and GET /api/updates/status */
export interface UpdateStatusPayload {
  /** False when the install directory isn't a git clone at all - in that case
   *  every other field except `repo_root`/`manual_command`/`message` is absent. */
  git_repo: boolean;
  /** True when `local_sha` is behind `remote_sha` on the canonical remote. */
  update_available: boolean;
  /** Absolute path to the detected git repository root. */
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
  /** Local HEAD commit SHA; null when it couldn't be resolved. */
  local_sha?: string | null;
  /** Remote-ref commit SHA; null when it couldn't be resolved. */
  remote_sha?: string | null;
  /** Number of commits the local branch trails behind `remote_sha`. */
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

/** Payload for the `run_stream` WebSocket message: one streamed JSON envelope
 *  from a headless/conversation `claude` process started via POST /api/run. */
export interface RunStreamPayload {
  /** Id of the `RunHandle` this envelope belongs to. */
  id: string;
  /** Raw stream-json envelope emitted by the Claude Code CLI (assistant text
   *  deltas, tool_use/tool_result blocks, etc.) - shape varies by event type. */
  envelope: unknown;
}
/** Payload for the `run_status` WebSocket message: a lifecycle transition for
 *  a run started via POST /api/run (mirrors `RunHandle.status`). */
export interface RunStatusPayload {
  id: string;
  status: "spawning" | "running" | "completed" | "error" | "killed";
  /** Epoch-ms timestamp of this status transition. */
  at: number;
  /** Process exit code; present once status reaches "completed"/"error". */
  exitCode?: number;
  /** Claude Code session id resumed/created by this run, once known. */
  sessionId?: string | null;
  /** Failure message; present when status is "error". */
  error?: string;
}
/** Payload for the `run_input_ack` WebSocket message: confirms a message sent
 *  via POST /api/run/:id/message was written to the child process's stdin. */
export interface RunInputAckPayload {
  id: string;
  /** Echoes the id returned by the `send` call this acks. */
  messageId: string;
  /** Epoch-ms timestamp the input was delivered. */
  at: number;
}

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
  /** "user" (~/.claude) or "project" (repo's .claude) config root affected. */
  scope?: "user" | "project";
  /** Artifact kind, e.g. "skills", "agents", "commands", "settings", "memory". */
  type?: string;
  /** Artifact name (e.g. skill/agent name); null/absent for whole-file events. */
  name?: string | null;
  /** Absolute file paths touched by this change, when known. */
  paths?: string[];
}

// ── Alerting ──

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

/** A user-defined alert rule from GET/POST/PATCH /api/alerts/rules. */
export interface AlertRule {
  id: string;
  name: string;
  rule_type: AlertRuleType;
  config: AlertRuleConfig;
  /** Whether the rule is evaluated at all; disabled rules never fire. */
  enabled: boolean;
  /** Minimum seconds between two firings of this rule for the same
   *  session/agent scope, to avoid spamming on repeated matches. */
  cooldown_seconds: number;
  created_at: string;
  updated_at: string;
}

/** One firing of an {@link AlertRule}, from GET /api/alerts; pushed live via
 *  the `alert_triggered` (new) / `alert_updated` (acknowledged) WS messages. */
export interface AlertEvent {
  id: number;
  /** Rule that fired (foreign key into `AlertRule.id`). */
  rule_id: string;
  /** Denormalized copy of the rule's name at fire time, for display even if
   *  the rule is later renamed or deleted. */
  rule_name: string;
  rule_type: AlertRuleType;
  /** Session the alert pertains to; null for rules with no session scope. */
  session_id: string | null;
  /** Agent the alert pertains to; null when not agent-specific. */
  agent_id: string | null;
  /** Human-readable description of what triggered the alert. */
  message: string;
  /** Opaque JSON string with extra context (matched event, thresholds); may
   *  be null. Parse before use. */
  details: string | null;
  /** ISO timestamp the alert fired. */
  triggered_at: string;
  /** ISO timestamp the user acknowledged it; null while unacknowledged. */
  acknowledged_at: string | null;
}

// ── Webhooks ──

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
  /** Key this value is stored/sent under in `WebhookTarget.config`. */
  key: string;
  /** Form label. */
  label: string;
  /** Whether the value should be masked in the UI and redacted by the API. */
  secret: boolean;
  /** Whether the target can't be saved without this field. */
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
  type: WebhookType;
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
  fields: WebhookProviderField[];
}

/** Compact summary of a target's most recent delivery attempt, embedded in
 *  {@link WebhookTarget.last_delivery} for the targets list view. */
export interface WebhookDeliverySummary {
  status: "success" | "failed";
  /** HTTP status code returned by the endpoint; null on a transport-level
   *  failure (DNS, timeout, connection refused) before any response arrived. */
  status_code: number | null;
  /** Number of send attempts made (including retries) for this delivery. */
  attempts: number;
  /** Failure reason when `status` is "failed"; null on success. */
  error: string | null;
  created_at: string;
}

/** A configured outbound webhook destination, from GET/POST/PATCH /api/webhooks.
 *  Secrets are never returned by the API - `url_preview` masks the URL and
 *  `headers`/`config` mask any field flagged `secret` in the provider schema. */
export interface WebhookTarget {
  id: string;
  /** User-assigned label for this target. */
  name: string;
  type: WebhookType;
  /** Whether alerts matching `rule_ids` are actually delivered here. */
  enabled: boolean;
  /** Masked: host + last 4 chars. The full URL is never returned by the API. */
  url_preview: string;
  /** Whether a signing secret is configured (its value is never returned). */
  has_secret: boolean;
  /** Generic targets only; values are masked ("••••"). */
  headers: Record<string, string> | null;
  /** Provider config (Telegram chat_id, PagerDuty routing_key, …); secret values masked. */
  config: Record<string, string> | null;
  /** Rule ids this target is scoped to; null = all rules. */
  rule_ids: string[] | null;
  created_at: string;
  updated_at: string;
  /** Outcome of the most recent delivery attempt; null if never delivered. */
  last_delivery: WebhookDeliverySummary | null;
}

/** One row of a target's delivery log, from GET /api/webhooks/:id/deliveries. */
export interface WebhookDelivery {
  id: number;
  /** Owning target's id (foreign key into `WebhookTarget.id`). */
  target_id: string;
  /** Denormalized target name at delivery time, for display after renames/deletes. */
  target_name: string;
  target_type: WebhookType;
  /** The `AlertEvent.id` that triggered this delivery; null for manual test sends. */
  alert_id: number | null;
  status: "success" | "failed";
  status_code: number | null;
  attempts: number;
  error: string | null;
  created_at: string;
}

/** Result of POST /api/webhooks/:id/test - a synchronous one-shot delivery
 *  probe used by the "Send test" button, not persisted to the delivery log. */
export interface WebhookTestResult {
  /** Whether the endpoint accepted the test payload (2xx response). */
  ok: boolean;
  /** HTTP status code returned; null on a transport-level failure. */
  status: number | null;
  attempts: number;
  error: string | null;
}

/**
 * Envelope for every message the server pushes over the dashboard WebSocket
 * (see `server/websocket.js` `broadcast()`). Consumed by {@link eventBus} and
 * `useWebSocket`; `type` discriminates the shape of `data`.
 */
export interface WSMessage {
  /** Discriminant selecting which member of the `data` union applies:
   *  session_created/updated → Session; agent_created/updated → Agent;
   *  new_event → DashboardEvent; import.progress → ImportProgressMessage;
   *  update_status → UpdateStatusPayload; run_stream/run_status/run_input_ack
   *  → their matching Run*Payload; cc_config_changed → CcConfigChangedPayload;
   *  alert_triggered/alert_updated → AlertEvent; workflow_upserted → WorkflowRun. */
  type:
    | "session_created"
    | "session_updated"
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
    | "workflow_upserted";
  data:
    | Session
    | Agent
    | DashboardEvent
    | ImportProgressMessage
    | UpdateStatusPayload
    | RunStreamPayload
    | RunStatusPayload
    | RunInputAckPayload
    | CcConfigChangedPayload
    | AlertEvent
    | WorkflowRun;
  /** ISO timestamp the server broadcast this message (not necessarily the
   *  same instant the underlying event occurred). */
  timestamp: string;
}

// ── Session stats ──

/** Response shape of GET /api/sessions/:id/stats - per-session rollups shown
 *  on the SessionDetail page's stats cards and charts. */
export interface SessionStats {
  session_id: string;
  total_events: number;
  /** Event counts grouped by `event_type`. */
  events_by_type: Array<{ event_type: string; count: number }>;
  /** Tool invocation counts within this session, most-used first. */
  tools_used: Array<{ tool_name: string; count: number }>;
  /** Count of events representing an error (APIError, error-summary Stop). */
  error_count: number;
  /** ISO timestamp of the session's earliest event; null if it has none. */
  first_event_at: string | null;
  /** ISO timestamp of the session's latest event; null if it has none. */
  last_event_at: string | null;
  /** Agent counts for this session, broken out by role/status. */
  agents: {
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
  /** Subagent counts grouped by `subagent_type`, for this session only. */
  subagent_types: Array<{ subagent_type: string; count: number }>;
  /** Token totals across every agent in this session. */
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  };
}

// ── Workflow types ──

/** Headline metrics card data for the Workflows page - aggregated across
 *  sessions matching the optional status filter. From `getWorkflowStats` in
 *  server/routes/workflows.js. */
export interface WorkflowStats {
  totalSessions: number;
  totalAgents: number;
  totalSubagents: number;
  /** Mean subagents spawned per session. */
  avgSubagents: number;
  /** Percent of finished (completed+error) agents that completed successfully. */
  successRate: number;
  /** Mean maximum parent→child agent nesting depth per session. */
  avgDepth: number;
  /** Mean session duration in seconds, across ended sessions. */
  avgDurationSec: number;
  totalCompactions: number;
  /** Mean compactions per session. */
  avgCompactions: number;
  /** The single most common two-tool sequence across all sessions, or null
   *  if no session has at least two tool calls. */
  topFlow: { source: string; target: string; count: number } | null;
}

/** One directed delegation edge in the orchestration graph: `source` subagent
 *  type (or "main") spawned `target` subagent type `weight` times. */
export interface OrchestrationEdge {
  source: string;
  target: string;
  weight: number;
}

/** Data for the Workflows page's orchestration graph - who delegates to whom.
 *  From `getOrchestrationData` in server/routes/workflows.js. */
export interface OrchestrationData {
  sessionCount: number;
  /** Count of agents with `type === "main"`. */
  mainCount: number;
  /** Per-subagent-type totals with completion/error breakdown, most-used first. */
  subagentTypes: Array<{ subagent_type: string; count: number; completed: number; errors: number }>;
  edges: OrchestrationEdge[];
  /** Terminal-status counts across all agents ("completed"/"error" only). */
  outcomes: Array<{ status: string; count: number }>;
  /** Total compaction pseudo-agents and how many distinct sessions had one. */
  compactions: { total: number; sessions: number };
}

/** One tool→tool adjacency edge: `target` ran immediately after `source`
 *  within the same session, `value` times. */
export interface ToolFlowTransition {
  source: string;
  target: string;
  value: number;
}

/** Data for the Workflows page's tool-flow Sankey/graph. From
 *  `getToolFlowData` in server/routes/workflows.js (top 50 transitions,
 *  top 15 tools by count). */
export interface ToolFlowData {
  transitions: ToolFlowTransition[];
  /** Per-tool total invocation counts, used to size graph nodes. */
  toolCounts: Array<{ tool_name: string; count: number }>;
}

/** Per-subagent-type effectiveness row for the Workflows page (top 12 by
 *  volume). From `getSubagentEffectiveness` in server/routes/workflows.js. */
export interface SubagentEffectivenessItem {
  subagent_type: string;
  total: number;
  completed: number;
  errors: number;
  /** Distinct sessions this subagent type appeared in. */
  sessions: number;
  /** Percent of finished (completed+error) runs that completed successfully. */
  successRate: number;
  /** Mean duration in seconds for finished runs; null if none have ended. */
  avgDuration: number | null;
  /** 7-slot invocation-count histogram over the last 8 weeks, Monday-first
   *  ([Mon, Tue, Wed, Thu, Fri, Sat, Sun]). */
  trend: number[];
}

/** One recurring subagent-type sequence detected across sessions (2-3 step
 *  windows and full sequences all included), sorted by frequency. */
export interface WorkflowPattern {
  /** Ordered `subagent_type` sequence, e.g. ["planner", "coder", "reviewer"]. */
  steps: string[];
  /** Number of sessions exhibiting this exact sequence/sub-sequence. */
  count: number;
  /** `count` as a percentage of all sessions considered. */
  percentage: number;
}

/** Data for the Workflows page's pattern-mining panel (top 10 patterns).
 *  From `getWorkflowPatterns` in server/routes/workflows.js. */
export interface WorkflowPatternsData {
  patterns: WorkflowPattern[];
  /** Sessions that spawned zero subagents (main agent worked solo). */
  soloSessionCount: number;
  /** `soloSessionCount` as a percentage of all sessions considered. */
  soloPercentage: number;
}

/** Model choice and token usage broken down by delegation role, for the
 *  Workflows page's model-delegation panel. From `getModelDelegation`. */
export interface ModelDelegationData {
  /** Models used by main agents, with agent/session counts, most-used first. */
  mainModels: Array<{ model: string; agent_count: number; session_count: number }>;
  /** Models used by subagents (approximated via the owning session's model). */
  subagentModels: Array<{ model: string; agent_count: number }>;
  /** Token totals grouped by model, most total tokens first. */
  tokensByModel: Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  }>;
}

/** Data for the Workflows page's error-propagation panel - where in the agent
 *  hierarchy errors occur. From `getErrorPropagation` in workflows.js. */
export interface ErrorPropagationData {
  /** Error counts by parent→child nesting depth (0 = main agent / session-level). */
  byDepth: Array<{ depth: number; count: number }>;
  /** Top 5 error-prone subagent types by error count. */
  byType: Array<{ subagent_type: string; count: number }>;
  /** Top 10 recurring error-event summaries (Stop-with-error, APIError) by count. */
  eventErrors: Array<{ summary: string; count: number }>;
  /** Sessions with at least one error (agent error, session error, or error event). */
  sessionsWithErrors: number;
  totalSessions: number;
  /** `sessionsWithErrors` as a percentage of `totalSessions`. */
  errorRate: number;
}

/** One row of the Workflows page's concurrency chart: a role/subagent-type's
 *  average position within the session timeline. */
export interface ConcurrencyLane {
  /** "Main Agent" or a `subagent_type` string. */
  name: string;
  /** Mean start position as a 0-1 fraction of total session duration. */
  avgStart: number;
  /** Mean end position as a 0-1 fraction of total session duration. */
  avgEnd: number;
  /** Number of agent instances averaged into this lane. */
  count: number;
}

/** Data for the Workflows page's concurrency chart. From `getConcurrencyData`
 *  in server/routes/workflows.js (computed only from sessions that have ended). */
export interface ConcurrencyData {
  aggregateLanes: ConcurrencyLane[];
}

/** One row of the Workflows page's session-complexity scatter/table (most
 *  recent 200 sessions). From `getSessionComplexity` in workflows.js. */
export interface SessionComplexityItem {
  id: string;
  name: string | null;
  status: string;
  /** Session duration in seconds (0 if still running, per `durationSec`). */
  duration: number;
  /** Total agents (main + subagents) belonging to this session. */
  agentCount: number;
  /** Subset of `agentCount` with `type === "subagent"`. */
  subagentCount: number;
  /** Sum of all token buckets (input+output+cache read+cache write). */
  totalTokens: number;
  model: string | null;
}

/** Data for the Workflows page's compaction-impact panel - how much context
 *  compression is happening and its token savings. From `getCompactionImpact`. */
export interface CompactionImpactData {
  totalCompactions: number;
  /** Sum of `baseline_*` token columns across all usage rows - the tokens that
   *  would have been re-billed had compaction not reset the running context. */
  tokensRecovered: number;
  /** Top 50 sessions by compaction count, most-compacted first. */
  perSession: Array<{ session_id: string; compactions: number }>;
  sessionsWithCompactions: number;
  totalSessions: number;
}

/** Response shape of GET /api/workflows - the full bundle of events-derived
 *  workflow-intelligence panels shown on the Workflows page, all computed
 *  against the same optional session-status filter. */
export interface WorkflowData {
  stats: WorkflowStats;
  orchestration: OrchestrationData;
  toolFlow: ToolFlowData;
  effectiveness: SubagentEffectivenessItem[];
  patterns: WorkflowPatternsData;
  modelDelegation: ModelDelegationData;
  errorPropagation: ErrorPropagationData;
  concurrency: ConcurrencyData;
  complexity: SessionComplexityItem[];
  compaction: CompactionImpactData;
  /** Directed subagent-type co-occurrence edges (source ran before target in
   *  the same session, weight >= 2), for the co-occurrence graph. */
  cooccurrence: Array<{ source: string; target: string; weight: number }>;
}

/** Response shape of GET /api/workflows/session/:id - the single-session
 *  drill-in view (agent tree, tool timeline, swim lanes, raw events). */
export interface SessionDrillIn {
  session: Session;
  /** Agents nested into a parent→child tree (roots = agents with no parent). */
  tree: Array<{
    id: string;
    name: string;
    type: string;
    subagent_type: string | null;
    status: string;
    task: string | null;
    started_at: string;
    ended_at: string | null;
    /** Recursively nested child agents (empty array for leaves). */
    children: SessionDrillIn["tree"];
  }>;
  /** Every tool-invoking event in the session, chronological, flattened for
   *  the horizontal tool-usage timeline. */
  toolTimeline: Array<{
    id: number;
    tool_name: string;
    event_type: string;
    agent_id: string | null;
    created_at: string;
    summary: string | null;
  }>;
  /** Flat per-agent metadata (no nesting) for rendering horizontal swim lanes
   *  against the session timeline; `parent_agent_id` lets the UI draw links. */
  swimLanes: Array<{
    id: string;
    name: string;
    type: string;
    subagent_type: string | null;
    status: string;
    started_at: string;
    ended_at: string | null;
    parent_agent_id: string | null;
  }>;
  /** Up to the first 500 raw events for this session, chronological. */
  events: DashboardEvent[];
}

// ── Workflow-tool runs (issue #167) ──────────────────────────────────────────
// Fleets of inner sub-agents spawned by the Claude Code "Workflow" tool,
// ingested from the on-disk run journal. Distinct from WorkflowData above
// (which is events-derived analytics).
/** One named phase marker from a run journal's `phases[]` array - free-form,
 *  since the Workflow tool script defines its own phase structure. */
export interface WorkflowPhase {
  /** Phase name, e.g. "Plan", "Implement", "Review". */
  title?: string;
  /** Optional longer description of what the phase covers. */
  detail?: string;
  /** Additional script-defined fields pass through untyped. */
  [key: string]: unknown;
}

/** One entry in a `WorkflowRun.progress` log - a mixed timeline of phase
 *  markers and inner-agent lifecycle updates, in journal order. */
export interface WorkflowProgressEntry {
  /** "workflow_agent" (a real inner agent) or "workflow_phase" (a phase marker). */
  type?: string;
  /** For workflow_agent entries: matches the `agent-<agentId>.jsonl` transcript
   *  basename, and is linked into the `agents` table as
   *  `${sessionId}-jsonl-<agentId>`. */
  agentId?: string;
  /** Freeform inner-agent role/type as reported by the launch script. */
  agentType?: string | null;
  /** Model the inner agent ran with, if known. */
  model?: string | null;
  /** Inner-agent lifecycle state, e.g. "running", "done", "error". */
  state?: string | null;
  /** Short display label for the agent (falls back to prompt preview). */
  label?: string | null;
  /** Phase this entry belongs to, matching a `WorkflowPhase.title`; null for
   *  entries not associated with a specific phase. */
  phaseTitle?: string | null;
  /** When the agent/phase started - ISO string or epoch depending on the
   *  script that emitted it. */
  startedAt?: string | number | null;
  /** Tokens consumed by this inner agent, once known. */
  tokens?: number;
  /** Tool calls made by this inner agent, once known. */
  toolCalls?: number;
  /** Wall-clock runtime in milliseconds; null while still running. */
  durationMs?: number | null;
  /** Most recent tool name the agent invoked, for a live "what's it doing" hint. */
  lastToolName?: string | null;
  /** Truncated preview of the task/prompt handed to this inner agent. */
  promptPreview?: string | null;
  /** Truncated preview of the inner agent's final result, once done. */
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
 */
export interface WorkflowRun {
  /** Stable run id, matching the `wf_<runId>.json` journal / launch script name. */
  run_id: string;
  /** Session that launched this run. */
  session_id: string;
  /** Correlates to a TaskCreate/TaskList task, if the run was tied to one; null otherwise. */
  task_id: string | null;
  /** Display name for the run, if the launch script provided one. */
  name: string | null;
  /** Run lifecycle, e.g. "running", "completed", "error" (freeform; not a closed enum). */
  status: string;
  /** Default model inner agents used unless overridden per-agent; null if unset. */
  default_model: string | null;
  /** ISO timestamp the run started; null if not yet known (e.g. mid-launch). */
  started_at: string | null;
  /** ISO timestamp the run finished; null while still running. */
  ended_at: string | null;
  /** Total wall-clock runtime in milliseconds; null while still running. */
  duration_ms: number | null;
  /** Number of inner agents spawned by this run. */
  agent_count: number;
  /** Sum of tokens consumed across all inner agents. */
  total_tokens: number;
  /** Sum of tool calls made across all inner agents. */
  total_tool_calls: number;
  phases: WorkflowPhase[];
  progress: WorkflowProgressEntry[];
  /** Path to the generated launch script under `workflows/scripts/`; null if unknown. */
  script_path: string | null;
  /** Path to the `wf_<runId>.json` journal file; null for a run not yet completed. */
  journal_path: string | null;
  /** "journal" once a completed run journal exists; "live" while only the
   *  launch script (no journal yet) has been observed. */
  source: "journal" | "live";
  /** ISO timestamp this row was first ingested. */
  created_at: string;
  /** ISO timestamp this row was last updated (re-ingested/upserted). */
  updated_at: string;
}

/** Response shape of GET /api/workflows/runs - a paginated, optionally
 *  status/session-filtered list of workflow-tool runs. */
export interface WorkflowRunsResponse {
  runs: WorkflowRun[];
  /** Total matching runs (ignores `limit`/`offset`, respects the status filter). */
  total: number;
  /** Run count keyed by `status`, across all runs (ignores any filter). */
  counts: Record<string, number>;
  limit: number;
  offset: number;
}

/** Response shape of GET /api/workflows/runs/:runId - a single run plus its
 *  linked inner agents (as regular `Agent` rows) and their attributed events. */
export interface WorkflowRunDetail {
  workflow: WorkflowRun;
  /** Inner agents linked to this run via the `${sessionId}-jsonl-<agentId>` id scheme. */
  agents: Agent[];
  /** Events attributed to this run's inner agents, chronological (up to 5000). */
  events: DashboardEvent[];
}

/**
 * UI presentation lookup for {@link EffectiveAgentStatus}: the i18n key, text
 * color, badge background, and status-dot Tailwind classes for each state.
 * `labelKey` is passed to `i18n.t()`; the rest are applied directly as classes.
 */
export const STATUS_CONFIG: Record<
  EffectiveAgentStatus,
  { labelKey: string; color: string; bg: string; dot: string }
> = {
  working: {
    labelKey: "common:status.working",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  waiting: {
    labelKey: "common:status.waiting",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  completed: {
    labelKey: "common:status.completed",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-400",
  },
  error: {
    labelKey: "common:status.error",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

// ── Transcript / Conversation types ──

/** One content block within a {@link TranscriptMessage}, mirroring the
 *  Anthropic Messages API content-block shapes as they appear in a Claude
 *  Code session's raw JSONL transcript. */
export interface TranscriptContent {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  /** Present for "text"/"thinking" blocks: the rendered prose. */
  text?: string;
  /** Present for "tool_use" blocks: the invoked tool's name. */
  name?: string;
  /** Present for "tool_use"/"tool_result" blocks: correlates a result to its call. */
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
 */
export interface TranscriptMessage {
  /** Raw JSONL line type. "session_event" is a synthetic marker (see
   *  `event_kind`/`title`) injected by the server, not a real transcript line. */
  type: "user" | "assistant" | "session_event";
  /** True sender, classified server-side. Falls back to `type` when absent. */
  sender?: TranscriptSender;
  /** ISO timestamp from the transcript line; null if the line had none. */
  timestamp: string | null;
  content: TranscriptContent[];
  /** Model that produced an assistant message; absent for user/session_event. */
  model?: string;
  /** Token accounting reported alongside an assistant message; absent otherwise. */
  usage?: {
    input_tokens: number;
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
  type: "main" | "subagent" | "compaction";
  subagent_type?: string | null;
  /** Whether a JSONL transcript file was actually found on disk for this entry -
   *  false means the entry exists in the DB but its transcript isn't available. */
  has_transcript: boolean;
  /** Underlying `Agent.id`, when this entry corresponds to a real agent row;
   *  null/absent for the synthetic main-session entry. */
  db_agent_id?: string | null;
}

/** Response shape of GET /api/sessions/:id/transcripts. */
export interface TranscriptListResult {
  transcripts: TranscriptInfo[];
}

/** Same UI presentation lookup as {@link STATUS_CONFIG}, but keyed by
 *  {@link EffectiveSessionStatus} - adds an "abandoned" entry that
 *  `STATUS_CONFIG` has no equivalent for. */
export const SESSION_STATUS_CONFIG: Record<
  EffectiveSessionStatus,
  { labelKey: string; color: string; bg: string; dot: string }
> = {
  active: {
    labelKey: "common:status.active",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  waiting: {
    labelKey: "common:status.waiting",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    dot: "bg-yellow-400",
  },
  completed: {
    labelKey: "common:status.completed",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    dot: "bg-violet-400",
  },
  error: {
    labelKey: "common:status.error",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
  abandoned: {
    // Muted slate distinguishes "given up / faded out" from yellow Waiting
    // (attention required).
    labelKey: "common:status.abandoned",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
    dot: "bg-slate-400",
  },
};
