/**
 * @file event-grouping.ts
 * @description Client-side helpers for rendering a flat stream of
 * `DashboardEvent` rows: a per-event status tag (`statusFromEventType`), a
 * smart human-readable title (`buildEventTitle`), and agent/origin labels for
 * the muted "{project} › {session} › {agent}" prefix. (The historical
 * tool-call grouping view was removed; the timeline now renders flat only.)
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { DashboardEvent } from "./types";

/** Best-effort status tag per event_type - drives the status badge shown on
 *  each row in the ActivityFeed / SessionDetail event streams.
 * @param type A `DashboardEvent.event_type` value (e.g. "PreToolUse", "Stop").
 * @returns The badge status; unrecognized types default to "waiting" rather
 *   than throwing, since new hook event types should degrade gracefully. */
export function statusFromEventType(type: string): "working" | "waiting" | "completed" | "error" {
  switch (type) {
    case "PreToolUse":
      return "working";
    case "PostToolUse":
    case "Stop":
      return "waiting";
    case "SubagentStop":
    case "Compaction":
      return "completed";
    case "error":
    case "APIError":
      return "error";
    default:
      return "waiting";
  }
}

// ───────── Dynamic humanizers (no per-tool static tables) ─────────

/** Purely algorithmic: split on _/-, dedupe consecutive tokens, take last,
 *  capitalize-first if all lowercase. Handles any MCP server slug. */
function humanizeMcpServer(raw: string): string {
  const tokens = raw.split(/[_-]+/).filter(Boolean);
  const dedup: string[] = [];
  for (const t of tokens) {
    if (dedup[dedup.length - 1] !== t) dedup.push(t);
  }
  const last = dedup[dedup.length - 1] ?? raw;
  return last.toLowerCase() === last ? last.charAt(0).toUpperCase() + last.slice(1) : last;
}

/** snake_case → lowercase words with spaces (e.g. "get_merge_request" → "get merge request"). */
function humanizeMcpTool(raw: string): string {
  return raw.replace(/_+/g, " ").trim().toLowerCase();
}

/** Splits an `mcp__<server>__<tool...>` tool name into its humanized server
 *  and tool parts. Returns null for anything that isn't a well-formed MCP
 *  tool name (no `mcp__` prefix, or fewer than 3 `__`-separated segments). */
function parseMcpToolName(tool: string): { server: string; tool: string } | null {
  if (!tool.startsWith("mcp__")) return null;
  const parts = tool.split("__").filter(Boolean);
  if (parts.length < 3) return null;
  const rawServer = parts[1];
  const rest = parts.slice(2);
  if (!rawServer || rest.length === 0) return null;
  return {
    server: humanizeMcpServer(rawServer),
    tool: humanizeMcpTool(rest.join("_")),
  };
}

/** First short string found in tool_input using a generic priority list, then
 *  falling back to any other short string. Applies to both MCP and native
 *  tools - no tool-specific knowledge baked in. */
const CONTEXT_FIELDS = [
  "description",
  "title",
  "name",
  "query",
  "q",
  "pattern",
  "url",
  "file_path",
  "path",
  "id",
  "command",
];

/** Implements the {@link CONTEXT_FIELDS} lookup described above: returns the
 *  first matching field's string value, or (failing that) the first short
 *  (<120 char) string value found anywhere in `input`. Null if none qualify. */
function buildContextHeadline(input: Record<string, unknown>): string | null {
  for (const field of CONTEXT_FIELDS) {
    const v = input[field];
    if (typeof v === "string" && v.length > 0) return v;
  }
  for (const v of Object.values(input)) {
    if (typeof v === "string" && v.length > 0 && v.length < 120) return v;
  }
  return null;
}

/** Parses a Bash/PowerShell command string into "<binary> <subcommand>" when
 *  the binary is something with common subcommands (git, npm, docker, etc.).
 *  For curl/wget we surface the host. Falls back to the bare binary name. */
const SUBCOMMAND_BINARIES = new Set([
  "git",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "docker",
  "docker-compose",
  "just",
  "make",
  "cargo",
  "python",
  "pip",
  "poetry",
  "uv",
  "node",
  "npx",
  "kubectl",
  "terraform",
  "helm",
  "aws",
  "gcloud",
  "az",
]);

function parseShellHeadline(command: string): string | null {
  const cmd = command.trim();
  if (!cmd) return null;

  // Special case: "docker compose <sub>" (two-word binary)
  const compose = cmd.match(/^docker\s+compose\s+([A-Za-z0-9_-]+)/);
  if (compose) return `docker compose ${compose[1]}`;

  const match = cmd.match(/^([A-Za-z0-9_.\-/\\]+)(?:\s+([A-Za-z0-9_-]+))?/);
  if (!match) return null;
  const binPath = match[1] ?? "";
  const bin = binPath.split(/[/\\]/).pop() || binPath;
  const sub = match[2];

  if (SUBCOMMAND_BINARIES.has(bin) && sub) return `${bin} ${sub}`;

  if (bin === "curl" || bin === "wget") {
    const urlMatch = cmd.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      try {
        return `${bin} ${new URL(urlMatch[0]).host}`;
      } catch {
        /* ignore */
      }
    }
    return bin;
  }

  return bin;
}

/** Last path segment (POSIX or Windows separators). Returns `path` unchanged
 *  if it has no separators. */
function basename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? path) : path;
}

/** Compact path label - last 2 segments (e.g. "tasks/base.py" for a long
 *  absolute path ending in tasks/base.py), so the user sees the immediate
 *  parent directory in addition to the filename. Falls back to basename for
 *  single-segment paths. */
function shortPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? path;
  return parts.slice(-2).join("/");
}

/** Extracts the host from a URL string (e.g. WebFetch's target), falling back
 *  to the raw string if it doesn't parse as a URL. */
function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Parses `event.data` and pulls out its `tool_input` object, if any. Returns
 *  null when there's no data, it isn't valid JSON, or `tool_input` isn't a
 *  plain object (e.g. absent, or an array). */
function extractToolInput(event: DashboardEvent): Record<string, unknown> | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    const maybeInput = parsed && typeof parsed === "object" ? parsed.tool_input : null;
    if (maybeInput && typeof maybeInput === "object" && !Array.isArray(maybeInput)) {
      return maybeInput as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Returns a short, descriptive title for an event. Parses `tool_input` and
 *  dispatches per-tool to surface what actually happened (e.g. "Bash · git
 *  commit", "GitLab · get merge request · !174", "Edit SessionDetail.tsx"),
 *  instead of the generic "Using tool: X" summary. MCP tools are rendered
 *  dynamically from their namespaced name - no per-server static mapping.
 * @param event The event to title. Non-tool events fall back to `summary`
 *   (or `event_type` if there's no summary either).
 * @returns A one-line title, never empty. */
export function buildEventTitle(event: DashboardEvent): string {
  if (!event.tool_name) return event.summary || event.event_type;

  const input = extractToolInput(event);
  const s = (v: unknown): string => (typeof v === "string" ? v : "");
  const trunc = (text: string, max = 80): string =>
    text.length > max ? text.slice(0, max) + "..." : text;

  // ── MCP tools - fully dynamic dispatch ─────────────────────────────
  const mcp = parseMcpToolName(event.tool_name);
  if (mcp) {
    const ctx = input ? buildContextHeadline(input) : null;
    return ctx ? `${mcp.server} · ${mcp.tool} · ${trunc(ctx)}` : `${mcp.server} · ${mcp.tool}`;
  }

  if (!input) return `${event.tool_name}${event.summary ? `: ${event.summary}` : ""}`;

  // ── Native tools - per-tool smart titles ───────────────────────────
  switch (event.tool_name) {
    case "Bash":
    case "PowerShell": {
      const desc = s(input.description);
      const cmd = s(input.command);
      const headline = parseShellHeadline(cmd);
      if (headline && desc) return `${event.tool_name} · ${headline} - ${trunc(desc, 60)}`;
      if (headline) return `${event.tool_name} · ${headline}`;
      if (desc) return `${event.tool_name}: ${desc}`;
      if (cmd) return `${event.tool_name}: ${trunc(cmd)}`;
      break;
    }
    case "Read": {
      const path = s(input.file_path);
      if (path) return `Read · ${shortPath(path)}`;
      break;
    }
    case "Write": {
      const path = s(input.file_path);
      if (path) return `Write · ${shortPath(path)}`;
      break;
    }
    case "Edit":
    case "NotebookEdit": {
      const path = s(input.file_path);
      if (path) {
        const suffix = input.replace_all === true ? " (all)" : "";
        return `${event.tool_name} · ${shortPath(path)}${suffix}`;
      }
      break;
    }
    case "Grep": {
      const pattern = s(input.pattern);
      const path = s(input.path);
      if (pattern) {
        return path
          ? `Grep · "${trunc(pattern, 40)}" in ${basename(path)}`
          : `Grep · "${trunc(pattern, 40)}"`;
      }
      break;
    }
    case "Glob": {
      const pattern = s(input.pattern);
      if (pattern) return `Glob · "${pattern}"`;
      break;
    }
    case "WebFetch": {
      const url = s(input.url);
      if (url) return `WebFetch · ${hostFromUrl(url)}`;
      break;
    }
    case "Agent":
    case "Task": {
      const desc = s(input.description);
      const subtype = s(input.subagent_type);
      if (desc && subtype) return `${event.tool_name} · ${subtype} - ${trunc(desc, 60)}`;
      if (desc) return `${event.tool_name} · ${trunc(desc, 60)}`;
      if (subtype) return `${event.tool_name} · ${subtype}`;
      break;
    }
    case "TaskCreate":
    case "TaskUpdate":
    case "TaskGet":
    case "TaskStop":
    case "TaskOutput":
    case "TaskList": {
      const desc = s(input.description);
      const id = s(input.id);
      if (desc) return `${event.tool_name} · ${trunc(desc, 60)}`;
      if (id) return `${event.tool_name} · ${id}`;
      break;
    }
    case "ScheduleWakeup": {
      const delay = input.delaySeconds;
      const reason = s(input.reason);
      if (typeof delay === "number") {
        return `ScheduleWakeup · ${delay}s${reason ? ` - ${trunc(reason, 50)}` : ""}`;
      }
      break;
    }
    case "AskUserQuestion": {
      const qs = input.questions;
      if (Array.isArray(qs) && qs.length > 0) {
        const first = qs[0];
        if (first && typeof first === "object") {
          const q = s((first as Record<string, unknown>).question);
          if (q) return `AskUserQuestion · "${trunc(q, 60)}"`;
        }
      }
      break;
    }
    case "Monitor": {
      const cmd = s(input.command);
      if (cmd) return `Monitor · ${trunc(cmd)}`;
      break;
    }
    case "ToolSearch": {
      const q = s(input.query);
      if (q) return `ToolSearch · ${trunc(q, 60)}`;
      break;
    }
    default: {
      // Generic fallback - first short string from the payload.
      const ctx = buildContextHeadline(input);
      if (ctx) return `${event.tool_name} · ${trunc(ctx)}`;
    }
  }

  return `${event.tool_name}${event.summary ? ` · ${event.summary}` : ""}`;
}

/** Returns a short agent label for display next to an event, or null when the
 *  event belongs to the session's main agent (no disambiguation needed). */
export function shortAgentLabel(agentId: string | null): string | null {
  if (!agentId) return null;
  if (agentId.endsWith("-main")) return null;
  // Last 8 chars of the UUID is enough to distinguish subagents on the same row.
  return agentId.length > 8 ? agentId.slice(-8) : agentId;
}

/** Minimal subset of an Agent record, enough to render a subagent pill and
 *  walk the parent chain (so events from a nested subagent can render the
 *  full "main › coder › explorer" attribution). */
export type AgentInfo = {
  type: "main" | "subagent";
  subagent_type: string | null;
  name: string;
  parent_agent_id?: string | null;
};

/** Single-segment label for an agent - the pill text. Returns null when the
 *  agent is the session's main agent (pill is noise in that case). */
function singleAgentSegment(info: AgentInfo): string | null {
  if (info.type === "main") return null;
  if (info.subagent_type && info.subagent_type.length > 0) return info.subagent_type;
  if (info.name && info.name.length > 0) return info.name;
  return null;
}

/** Resolves the pill label for an event's agent. Returns null when the event
 *  comes from the session's main agent (the pill is noise in that case) or
 *  when no info is available. Prefers subagent_type (e.g. "frontend-reviewer"),
 *  then the agent's name, and finally the last-8 short ID fallback. */
export function agentPillLabel(agentId: string | null, info: AgentInfo | undefined): string | null {
  if (!agentId) return null;
  if (info) {
    const seg = singleAgentSegment(info);
    if (seg !== null) return seg;
    if (info.type === "main") return null;
  }
  return shortAgentLabel(agentId);
}

/** Resolves a label that always identifies an event's agent origin - unlike
 *  agentPillLabel, this returns "main" for main agents instead of null. Used
 *  by the inline origin prefix ("{session} › {agent} · {action}").
 *
 *  When an `agentInfoById` map is provided AND the event's agent has a
 *  parent_agent_id, the chain is walked from the root subagent down to the
 *  current agent and joined with " › " - so an event triggered by a deeply
 *  nested subagent reads "main › coder › explorer" instead of just "explorer".
 *  Cycles and missing parents fall back gracefully to the single-segment label.
 * @param agentId The event's `agent_id`; null yields null (no origin to show).
 * @param infoOrMap Either one agent's {@link AgentInfo} (legacy single-segment
 *   behavior) or a `Map<agentId, AgentInfo>` covering the session (enables the
 *   parent-chain walk).
 * @returns "main", a single subagent segment, a "main › a › b" chain, or the
 *   {@link shortAgentLabel} fallback when no info is available.
 * @example
 * agentOriginLabel("sub-42", agentInfoById) // "main › coder › explorer"
 */
export function agentOriginLabel(
  agentId: string | null,
  infoOrMap: AgentInfo | Map<string, AgentInfo> | undefined
): string | null {
  if (!agentId) return null;
  const map = infoOrMap instanceof Map ? infoOrMap : null;
  const info = map ? map.get(agentId) : (infoOrMap as AgentInfo | undefined);

  // No map - preserve the legacy single-segment behavior for callers that
  // haven't switched to the chain-aware overload yet.
  if (!map) {
    if (info) {
      if (info.type === "main") return "main";
      const seg = singleAgentSegment(info);
      if (seg) return seg;
    }
    if (agentId.endsWith("-main")) return "main";
    return shortAgentLabel(agentId);
  }

  // Map provided - walk parent chain so nested subagents read "main › coder".
  const segments: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = agentId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = map.get(cursor);
    if (!node) break;
    if (node.type === "main") {
      segments.unshift("main");
      break;
    }
    const seg = singleAgentSegment(node);
    if (seg) segments.unshift(seg);
    cursor = node.parent_agent_id ?? null;
  }

  if (segments.length === 0) {
    if (agentId.endsWith("-main")) return "main";
    return shortAgentLabel(agentId);
  }
  return segments.join(" › ");
}

/** Builds the muted origin prefix shown before a row's action title, e.g.
 *  "datapilot › DataPilot › frontend-reviewer". Returns null when nothing
 *  identifying is available. Any of the three segments may be null - pages
 *  already scoped to a single session pass null for sessionName, etc. When a
 *  segment equals the previous one (e.g. project name == session name), it
 *  is dropped to avoid visual duplication. */
export function buildOriginLabel(
  projectName: string | null | undefined,
  sessionName: string | null | undefined,
  agentLabel: string | null
): string | null {
  const parts: string[] = [];
  if (projectName) parts.push(projectName);
  if (sessionName && sessionName !== projectName) parts.push(sessionName);
  if (agentLabel) parts.push(agentLabel);
  return parts.length > 0 ? parts.join(" › ") : null;
}

/** Last path segment of a working directory - the project/dir name shown as the
 *  leading origin segment. Null for an empty or missing cwd. Use this to derive
 *  a fallback project for events whose own payload carries no `cwd` (e.g.
 *  TurnDuration), by passing the owning session's cwd. */
export function projectFromCwd(cwd: string | null | undefined): string | null {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  return basename(cwd);
}

/** Reads `cwd` out of an event's payload and returns the last path segment
 *  (the project/directory name). Null when the payload doesn't include cwd
 *  (e.g. TurnDuration events, or events from a very old client) - callers can
 *  fall back to `projectFromCwd(session.cwd)` in that case. */
export function projectFromEvent(event: DashboardEvent): string | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const cwd = (parsed as Record<string, unknown>).cwd;
      if (typeof cwd === "string" && cwd.length > 0) return projectFromCwd(cwd);
    }
  } catch {
    /* ignore */
  }
  return null;
}
