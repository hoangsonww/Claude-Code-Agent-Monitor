/**
 * @file types.ts
 * @description Defines TypeScript types and interfaces for the agent dashboard application, including data structures for sessions, agents, events, statistics, analytics, model pricing, cost breakdowns, WebSocket messages, and workflow-related data. These types provide a clear contract for the shape of data used throughout the application and facilitate type safety when interacting with the backend API and managing state within the frontend components.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

export type SessionStatus = "active" | "completed" | "error" | "abandoned";
export type AgentStatus = "working" | "waiting" | "completed" | "error";
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

export interface Session {
  id: string;
  name: string | null;
  status: SessionStatus;
  cwd: string | null;
  model: string | null;
  started_at: string;
  ended_at: string | null;
  metadata: string | null;
  agent_count?: number;
  last_activity?: string;
  cost?: number;
  /** ISO timestamp set when Claude Code is blocked waiting for the user
   * (permission prompt or "waiting for your input" notice). Cleared on the
   * next non-Notification hook event. Null when the session is not waiting. */
  awaiting_input_since?: string | null;
}

export interface Agent {
  id: string;
  session_id: string;
  name: string;
  type: AgentType;
  subagent_type: string | null;
  status: AgentStatus;
  task: string | null;
  current_tool: string | null;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  parent_agent_id: string | null;
  metadata: string | null;
  /** Mirrors the parent session: ISO timestamp when set, null otherwise. */
  awaiting_input_since?: string | null;
}

/** True when a session is paused on a permission prompt or input request. */
export function isSessionAwaitingInput(session: Session | undefined | null): boolean {
  return !!session?.awaiting_input_since && session.status === "active";
}

/** True when an agent is the one blocked on user input (typically a main agent). */
export function isAgentAwaitingInput(agent: Agent | undefined | null): boolean {
  if (!agent?.awaiting_input_since) return false;
  // Once the agent's lifecycle has ended, the waiting flag is stale; ignore it.
  return agent.status !== "completed" && agent.status !== "error";
}

export function effectiveAgentStatus(agent: Agent): EffectiveAgentStatus {
  return isAgentAwaitingInput(agent) ? AWAITING_STATUS : agent.status;
}

export function effectiveSessionStatus(session: Session): EffectiveSessionStatus {
  return isSessionAwaitingInput(session) ? AWAITING_STATUS : session.status;
}

export interface DashboardEvent {
  id: number;
  session_id: string;
  agent_id: string | null;
  event_type: string;
  tool_name: string | null;
  summary: string | null;
  data: string | null;
  created_at: string;
}

export interface Stats {
  total_sessions: number;
  active_sessions: number;
  active_agents: number;
  total_agents: number;
  total_events: number;
  events_today: number;
  ws_connections: number;
  agents_by_status: Record<string, number>;
  sessions_by_status: Record<string, number>;
}

export interface Analytics {
  tokens: {
    total_input: number;
    total_output: number;
    total_cache_read: number;
    total_cache_write: number;
  };
  tool_usage: Array<{ tool_name: string; count: number }>;
  daily_events: Array<{ date: string; count: number }>;
  daily_sessions: Array<{ date: string; count: number }>;
  agent_types: Array<{ subagent_type: string; count: number }>;
  event_types: Array<{ event_type: string; count: number }>;
  avg_events_per_session: number;
  total_subagents: number;
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

export interface ModelPricing {
  model_pattern: string;
  display_name: string;
  input_per_mtok: number;
  output_per_mtok: number;
  cache_read_per_mtok: number;
  cache_write_per_mtok: number;
  cache_write_1h_per_mtok: number;
  fast_input_per_mtok: number;
  fast_output_per_mtok: number;
  updated_at: string;
}

export interface CostBreakdown {
  model: string;
  speed?: string;
  inference_geo?: string;
  service_tier?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_write_1h_tokens?: number;
  web_search_requests?: number;
  web_fetch_requests?: number;
  code_execution_requests?: number;
  cost: number;
  matched_rule: string | null;
}

export interface CostFeatureCosts {
  web_search_cost: number;
  web_fetch_cost: number;
  code_execution_cost: number;
  code_execution_hours_estimated: number;
  code_execution_free_hours: number;
}

export interface UnpricedModel {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export interface CostResult {
  total_cost: number;
  breakdown: CostBreakdown[];
  daily_costs: Array<{ date: string; cost: number }>;
  feature_costs?: CostFeatureCosts;
  unpriced_models?: UnpricedModel[];
}

export interface ImportProgressMessage {
  importId?: string;
  phase: "start" | "scan" | "extract" | "parse" | "complete" | "error" | "extract_error";
  source?: "default" | "path" | "upload";
  processed?: number;
  total?: number;
  current?: string;
  path?: string;
  error?: string;
  counters?: Record<string, number>;
}

/** Payload for `update_status` WebSocket messages and GET /api/updates/status */
export interface UpdateStatusPayload {
  git_repo: boolean;
  update_available: boolean;
  repo_root?: string;
  remote_ref?: string | null;
  /** Remote name we compared against — "upstream" if configured (fork
   * convention), else "origin", else whatever single remote is set up. */
  canonical_remote?: string | null;
  /** Local branch HEAD points at. null on detached HEAD. */
  current_branch?: string | null;
  /** What the local branch tracks (e.g. "origin/feature/foo"). null when
   * no upstream is configured for the current branch. */
  tracking_upstream?: string | null;
  /** True when the local branch's tracked upstream is exactly remote_ref
   * — i.e. a plain `git pull --ff-only` will do the right thing. */
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
  local_sha?: string | null;
  remote_sha?: string | null;
  commits_behind?: number;
  manual_command?: string | null;
  message?: string | null;
  fetch_error?: string;
}

export interface RunStreamPayload {
  id: string;
  envelope: unknown;
}
export interface RunStatusPayload {
  id: string;
  status: "spawning" | "running" | "completed" | "error" | "killed";
  at: number;
  exitCode?: number;
  sessionId?: string | null;
  error?: string;
}
export interface RunInputAckPayload {
  id: string;
  messageId: string;
  at: number;
}

export interface CcConfigChangedPayload {
  source: "dashboard" | "fs";
  action?: "write" | "delete";
  scope?: "user" | "project";
  type?: string;
  name?: string | null;
  paths?: string[];
}

export interface WSMessage {
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
    | "cc_config_changed";
  data:
    | Session
    | Agent
    | DashboardEvent
    | ImportProgressMessage
    | UpdateStatusPayload
    | RunStreamPayload
    | RunStatusPayload
    | RunInputAckPayload
    | CcConfigChangedPayload;
  timestamp: string;
}

// ── Session stats ──

export interface SessionStats {
  session_id: string;
  total_events: number;
  events_by_type: Array<{ event_type: string; count: number }>;
  tools_used: Array<{ tool_name: string; count: number }>;
  error_count: number;
  first_event_at: string | null;
  last_event_at: string | null;
  agents: {
    total: number;
    main: number;
    subagent: number;
    compaction: number;
    by_status: Record<string, number>;
  };
  subagent_types: Array<{ subagent_type: string; count: number }>;
  tokens: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  };
}

// ── Workflow types ──

export interface WorkflowStats {
  totalSessions: number;
  totalAgents: number;
  totalSubagents: number;
  avgSubagents: number;
  successRate: number;
  avgDepth: number;
  avgDurationSec: number;
  totalCompactions: number;
  avgCompactions: number;
  topFlow: { source: string; target: string; count: number } | null;
}

export interface OrchestrationEdge {
  source: string;
  target: string;
  weight: number;
}

export interface OrchestrationData {
  sessionCount: number;
  mainCount: number;
  subagentTypes: Array<{ subagent_type: string; count: number; completed: number; errors: number }>;
  edges: OrchestrationEdge[];
  outcomes: Array<{ status: string; count: number }>;
  compactions: { total: number; sessions: number };
}

export interface ToolFlowTransition {
  source: string;
  target: string;
  value: number;
}

export interface ToolFlowData {
  transitions: ToolFlowTransition[];
  toolCounts: Array<{ tool_name: string; count: number }>;
}

export interface SubagentEffectivenessItem {
  subagent_type: string;
  total: number;
  completed: number;
  errors: number;
  sessions: number;
  successRate: number;
  avgDuration: number | null;
  trend: number[];
}

export interface WorkflowPattern {
  steps: string[];
  count: number;
  percentage: number;
}

export interface WorkflowPatternsData {
  patterns: WorkflowPattern[];
  soloSessionCount: number;
  soloPercentage: number;
}

export interface ModelDelegationData {
  mainModels: Array<{ model: string; agent_count: number; session_count: number }>;
  subagentModels: Array<{ model: string; agent_count: number }>;
  tokensByModel: Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  }>;
}

export interface ErrorPropagationData {
  byDepth: Array<{ depth: number; count: number }>;
  byType: Array<{ subagent_type: string; count: number }>;
  eventErrors: Array<{ summary: string; count: number }>;
  sessionsWithErrors: number;
  totalSessions: number;
  errorRate: number;
}

export interface ConcurrencyLane {
  name: string;
  avgStart: number;
  avgEnd: number;
  count: number;
}

export interface ConcurrencyData {
  aggregateLanes: ConcurrencyLane[];
}

export interface SessionComplexityItem {
  id: string;
  name: string | null;
  status: string;
  duration: number;
  agentCount: number;
  subagentCount: number;
  totalTokens: number;
  model: string | null;
}

export interface CompactionImpactData {
  totalCompactions: number;
  tokensRecovered: number;
  perSession: Array<{ session_id: string; compactions: number }>;
  sessionsWithCompactions: number;
  totalSessions: number;
}

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
  cooccurrence: Array<{ source: string; target: string; weight: number }>;
}

export interface SessionDrillIn {
  session: Session;
  tree: Array<{
    id: string;
    name: string;
    type: string;
    subagent_type: string | null;
    status: string;
    task: string | null;
    started_at: string;
    ended_at: string | null;
    children: SessionDrillIn["tree"];
  }>;
  toolTimeline: Array<{
    id: number;
    tool_name: string;
    event_type: string;
    agent_id: string | null;
    created_at: string;
    summary: string | null;
  }>;
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
  events: DashboardEvent[];
}

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

export interface TranscriptContent {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown> | { _truncated: string };
  output?: string;
  is_error?: boolean;
}

export interface TranscriptMessage {
  type: "user" | "assistant";
  timestamp: string | null;
  content: TranscriptContent[];
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

export interface TranscriptResult {
  messages: TranscriptMessage[];
  total: number;
  has_more: boolean;
  last_line: number;
  first_line: number;
}

export interface TranscriptInfo {
  id: string;
  name: string;
  type: "main" | "subagent" | "compaction";
  subagent_type?: string | null;
  has_transcript: boolean;
  db_agent_id?: string | null;
}

export interface TranscriptListResult {
  transcripts: TranscriptInfo[];
}

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
