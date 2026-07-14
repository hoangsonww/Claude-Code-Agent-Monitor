/**
 * @file event-grouping.ts
 * @description Client-side helpers for rendering a flat stream of
 * `DashboardEvent` rows: a per-event status tag (`statusFromEventType`), a
 * smart human-readable title (`buildEventTitle`), and agent/origin labels for
 * the muted "{project} › {session} › {agent}" prefix. (The historical
 * tool-call grouping view was removed; the timeline now renders flat only.)
 *
 * ## Event shape
 * Every helper here operates on a {@link DashboardEvent}. The fields that
 * matter for titling and attribution are:
 * - `event_type`  — the hook lifecycle name ("PreToolUse", "PostToolUse",
 *   "Stop", "SubagentStop", "Compaction", "Notification", "SessionStart",
 *   "SessionEnd", "TurnDuration", "APIError", …). Drives
 *   {@link statusFromEventType}.
 * - `tool_name`   — set only on tool events (e.g. "Bash", "Edit", "Read", or an
 *   MCP name like "mcp__github__create_issue"). Absent for lifecycle events, in
 *   which case {@link buildEventTitle} falls back to `summary`.
 * - `summary`     — an optional server-provided one-liner used as a fallback.
 * - `data`        — a JSON *string* holding the raw hook payload. When parsed it
 *   typically exposes `tool_input` (the arguments passed to the tool) and `cwd`
 *   (the working directory, used to derive the project label).
 * - `agent_id`    — identifies which agent (main or subagent) emitted the event;
 *   drives the {@link shortAgentLabel} / {@link agentOriginLabel} labels.
 *
 * ## Design philosophy
 * Titles are produced *algorithmically* — there is deliberately no per-tool or
 * per-MCP-server lookup table to maintain. New tools and MCP servers therefore
 * render sensibly on day one: MCP names are decoded from their namespaced
 * `mcp__<server>__<tool>` structure, and unknown native tools fall back to the
 * first short string found in their payload. Every parser is defensive — bad
 * JSON, missing fields, and unexpected types degrade to a plain label instead of
 * throwing, because this code runs on live hook data of varying vintage.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { DashboardEvent } from "./types";

// ════════════════════════════════════════════════════════════════════════════
// Status mapping
// ════════════════════════════════════════════════════════════════════════════

/** Best-effort status tag per event_type - drives the status badge shown on
 *  each row in the ActivityFeed / SessionDetail event streams.
 * @param type A `DashboardEvent.event_type` value (e.g. "PreToolUse", "Stop").
 * @returns The badge status; unrecognized types default to "waiting" rather
 *   than throwing, since new hook event types should degrade gracefully. */
export function statusFromEventType(type: string): "working" | "waiting" | "completed" | "error" {
  switch (type) {
    // A tool is about to run: the agent is actively doing work.
    case "PreToolUse":
      return "working";
    // The tool finished, or the turn stopped: the agent is idle / awaiting the
    // next step. "waiting" (not "completed") because more activity usually
    // follows a PostToolUse within the same turn.
    case "PostToolUse":
    case "Stop":
      return "waiting";
    // Terminal-ish milestones: a subagent handed control back, or the transcript
    // was compacted. Both read as a finished unit of work.
    case "SubagentStop":
    case "Compaction":
      return "completed";
    // Explicit failure signals surface as the red "error" badge.
    case "error":
    case "APIError":
      return "error";
    // Unknown / newer event types shouldn't blow up the badge — treat them as a
    // neutral "waiting" so future hook additions render gracefully.
    default:
      return "waiting";
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Dynamic humanizers (no per-tool static tables)
//
// These small string helpers turn machine-shaped identifiers — MCP server slugs,
// snake_case tool names, shell commands, file paths, URLs — into short
// human-readable fragments. None of them carry a hard-coded catalogue of known
// tools; they rely purely on the *structure* of the input, so a brand-new MCP
// server or CLI renders acceptably without a code change.
// ════════════════════════════════════════════════════════════════════════════

/** Purely algorithmic: split on _/-, dedupe consecutive tokens, take last,
 *  capitalize-first if all lowercase. Handles any MCP server slug.
 *
 *  The goal is a compact, recognizable server name. The *last* meaningful token
 *  is usually the brand (e.g. "claude_ai_Slack" → "Slack"), and consecutive
 *  duplicate tokens (from slugs like "github_github") are collapsed so they
 *  don't read twice. Capitalization is only forced when the token is entirely
 *  lowercase, preserving already-cased brands like "GitLab" or "PagerDuty".
 * @param raw The raw server slug (the `<server>` piece of an MCP tool name).
 * @returns A short, display-ready server label.
 * @example humanizeMcpServer("claude_ai_Slack") // "Slack"
 * @example humanizeMcpServer("github")           // "Github"
 * @example humanizeMcpServer("atlassian")        // "Atlassian"
 */
function humanizeMcpServer(raw: string): string {
  // Split on underscores/hyphens into candidate tokens, dropping empties.
  const tokens = raw.split(/[_-]+/).filter(Boolean);
  // Collapse *consecutive* duplicate tokens ("github_github" → ["github"]).
  const dedup: string[] = [];
  for (const t of tokens) {
    if (dedup[dedup.length - 1] !== t) dedup.push(t);
  }
  // The trailing token is the most brand-identifying part; fall back to the
  // untouched input if the slug somehow had no usable tokens.
  const last = dedup[dedup.length - 1] ?? raw;
  // Only capitalize purely-lowercase tokens so existing mixed-case brands
  // (GitLab, PagerDuty) are left untouched.
  return last.toLowerCase() === last ? last.charAt(0).toUpperCase() + last.slice(1) : last;
}

/** snake_case → lowercase words with spaces (e.g. "get_merge_request" → "get merge request").
 *
 *  Runs of underscores collapse to a single space, surrounding whitespace is
 *  trimmed, and the result is lowercased so tool actions read as a short verb
 *  phrase in the title (e.g. "Github · create pull request").
 * @param raw The `<tool>` portion of an MCP tool name (may contain several
 *   `_`-joined words).
 * @returns The spaced, lowercased action phrase.
 */
function humanizeMcpTool(raw: string): string {
  return raw.replace(/_+/g, " ").trim().toLowerCase();
}

/** Splits an `mcp__<server>__<tool...>` tool name into its humanized server
 *  and tool parts. Returns null for anything that isn't a well-formed MCP
 *  tool name (no `mcp__` prefix, or fewer than 3 `__`-separated segments).
 *
 *  MCP tool names follow the convention `mcp__<server>__<tool>` where `<tool>`
 *  may itself contain `__` if the underlying action name had underscores. The
 *  first segment ("mcp") is the marker, the second is the server slug, and
 *  everything after is re-joined as the action before being humanized.
 * @param tool A raw `tool_name`, e.g. "mcp__github__create_pull_request".
 * @returns `{ server, tool }` with both pieces humanized, or null when `tool` is
 *   not a namespaced MCP name.
 * @example
 * parseMcpToolName("mcp__github__create_pull_request")
 * //   → { server: "Github", tool: "create pull request" }
 * parseMcpToolName("Bash") // → null (native tool, no mcp__ prefix)
 */
function parseMcpToolName(tool: string): { server: string; tool: string } | null {
  if (!tool.startsWith("mcp__")) return null;
  // `filter(Boolean)` drops the empty strings produced by the doubled
  // underscores, leaving ["mcp", <server>, ...<toolWords>].
  const parts = tool.split("__").filter(Boolean);
  if (parts.length < 3) return null;
  const rawServer = parts[1];
  const rest = parts.slice(2);
  // Guard against malformed names like "mcp____foo" that survive the length
  // check but leave no server or no tool segment.
  if (!rawServer || rest.length === 0) return null;
  return {
    server: humanizeMcpServer(rawServer),
    // Re-join with "_" so humanizeMcpTool can re-split uniformly, restoring the
    // original multi-word action (parts were split on "__", not "_").
    tool: humanizeMcpTool(rest.join("_")),
  };
}

/** First short string found in tool_input using a generic priority list, then
 *  falling back to any other short string. Applies to both MCP and native
 *  tools - no tool-specific knowledge baked in.
 *
 *  Order matters: fields are tried top-to-bottom and the first non-empty string
 *  wins, so the list is sorted from *most* human-meaningful ("description",
 *  "title") down to more incidental identifiers ("id", "command"). This lets a
 *  single lookup produce a good headline across wildly different tool payloads
 *  without knowing which tool produced them. */
const CONTEXT_FIELDS = [
  "description", // human-authored summary — best possible headline
  "title", // e.g. an issue / PR title
  "name", // a resource or entity name
  "query", // search-style tools
  "q", // short alias some tools use for a query
  "pattern", // grep / glob style matchers
  "url", // web-oriented tools
  "file_path", // file-oriented tools (absolute or relative)
  "path", // directory / file path variant
  "id", // last-resort identifier
  "command", // shell command text
];

/** Implements the {@link CONTEXT_FIELDS} lookup described above: returns the
 *  first matching field's string value, or (failing that) the first short
 *  (<120 char) string value found anywhere in `input`. Null if none qualify.
 * @param input A parsed `tool_input` object (arbitrary tool arguments).
 * @returns The chosen headline string, or null when nothing suitable is found.
 * @example buildContextHeadline({ query: "auth bug", limit: 20 }) // "auth bug"
 */
function buildContextHeadline(input: Record<string, unknown>): string | null {
  // Preferred pass: honor the priority order in CONTEXT_FIELDS. Any non-empty
  // string wins here regardless of length — a named field is intentional.
  for (const field of CONTEXT_FIELDS) {
    const v = input[field];
    if (typeof v === "string" && v.length > 0) return v;
  }
  // Fallback pass: no known field matched, so scan every value and accept the
  // first *short* string. The <120 guard avoids surfacing a giant blob (e.g. a
  // file's contents) as the headline.
  for (const v of Object.values(input)) {
    if (typeof v === "string" && v.length > 0 && v.length < 120) return v;
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// Shell command parsing
// ════════════════════════════════════════════════════════════════════════════

/** Parses a Bash/PowerShell command string into "<binary> <subcommand>" when
 *  the binary is something with common subcommands (git, npm, docker, etc.).
 *  For curl/wget we surface the host. Falls back to the bare binary name.
 *
 *  The set below is the allow-list of binaries whose *first argument* is a
 *  meaningful subcommand worth showing ("git commit", "npm install", "docker
 *  build"). For anything not in the set, showing a lone argument would be noise,
 *  so {@link parseShellHeadline} keeps just the binary name. */
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

/** Extracts a compact headline from a raw shell command string.
 * @param command The full command line (e.g. "git commit -m 'wip' && npm test").
 * @returns "<binary> <subcommand>" for known multi-command binaries, "<curl|wget>
 *   <host>" for downloads, the bare binary otherwise, or null for an empty
 *   command.
 * @example parseShellHeadline("git commit -m x")       // "git commit"
 * @example parseShellHeadline("docker compose up -d")  // "docker compose up"
 * @example parseShellHeadline("curl https://api.x/y")  // "curl api.x"
 * @example parseShellHeadline("./run.sh --fast")       // "run.sh"
 */
function parseShellHeadline(command: string): string | null {
  const cmd = command.trim();
  if (!cmd) return null;

  // Special case: "docker compose <sub>" (two-word binary)
  const compose = cmd.match(/^docker\s+compose\s+([A-Za-z0-9_-]+)/);
  if (compose) return `docker compose ${compose[1]}`;

  // Capture group 1 = the binary (path chars allowed so "./x", "/usr/bin/git"
  // and "C:\\tool.exe" all match); optional group 2 = the first bare argument.
  const match = cmd.match(/^([A-Za-z0-9_.\-/\\]+)(?:\s+([A-Za-z0-9_-]+))?/);
  if (!match) return null;
  const binPath = match[1] ?? "";
  // Reduce any path to just the executable name so "/usr/local/bin/git" → "git".
  const bin = binPath.split(/[/\\]/).pop() || binPath;
  const sub = match[2];

  // Only show the subcommand for binaries where it's genuinely informative.
  if (SUBCOMMAND_BINARIES.has(bin) && sub) return `${bin} ${sub}`;

  // Downloads: the destination host is far more useful than a "-fsSL" flag, so
  // pull the first http(s) URL out of the command and show its host.
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

  // Everything else: just the binary name (a lone arg would usually be noise).
  return bin;
}

// ════════════════════════════════════════════════════════════════════════════
// Path and URL helpers
// ════════════════════════════════════════════════════════════════════════════

/** Last path segment (POSIX or Windows separators). Returns `path` unchanged
 *  if it has no separators.
 * @param path An absolute or relative path using "/" and/or "\" separators.
 * @returns The final segment (file or directory name).
 * @example basename("/a/b/c.ts") // "c.ts"
 * @example basename("solo")      // "solo"
 */
function basename(path: string): string {
  // Split on either separator and drop empties so trailing slashes don't yield
  // an empty final element.
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] ?? path) : path;
}

/** Compact path label - last 2 segments (e.g. "tasks/base.py" for a long
 *  absolute path ending in tasks/base.py), so the user sees the immediate
 *  parent directory in addition to the filename. Falls back to basename for
 *  single-segment paths.
 *
 *  Two segments strike a balance: the filename alone can be ambiguous (many
 *  "index.ts"), while the full absolute path is too long for a one-line title.
 * @param path An absolute or relative path.
 * @returns The last two segments joined with "/", or the sole segment.
 * @example shortPath("/repo/client/src/lib/types.ts") // "lib/types.ts"
 * @example shortPath("README.md")                     // "README.md"
 */
function shortPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  // 0 or 1 segments: nothing to shorten — return what we have.
  if (parts.length <= 1) return parts[0] ?? path;
  // Always normalize the joiner to "/" even for Windows-style inputs.
  return parts.slice(-2).join("/");
}

/** Extracts the host from a URL string (e.g. WebFetch's target), falling back
 *  to the raw string if it doesn't parse as a URL.
 * @param url A URL string; may be malformed.
 * @returns The host (e.g. "api.github.com"), or the original string on parse
 *   failure so the caller still shows *something*.
 * @example hostFromUrl("https://api.github.com/repos") // "api.github.com"
 * @example hostFromUrl("not a url")                    // "not a url"
 */
function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // `new URL` throws on relative / garbage input — degrade to the raw string.
    return url;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Event title builder
// ════════════════════════════════════════════════════════════════════════════

/** Parses `event.data` and pulls out its `tool_input` object, if any. Returns
 *  null when there's no data, it isn't valid JSON, or `tool_input` isn't a
 *  plain object (e.g. absent, or an array).
 *
 *  `event.data` is stored as a JSON string, so it must be parsed at read time.
 *  A representative payload looks like:
 *  `{"tool_input":{"file_path":"/a/b.ts"},"cwd":"/a"}`.
 * @param event The event whose payload should be inspected.
 * @returns The `tool_input` record, or null when it's missing / invalid.
 */
function extractToolInput(event: DashboardEvent): Record<string, unknown> | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    // Only read `tool_input` when the payload itself is a truthy object.
    const maybeInput = parsed && typeof parsed === "object" ? parsed.tool_input : null;
    // Require a *plain* object — arrays and primitives aren't valid inputs and
    // would break the field lookups downstream.
    if (maybeInput && typeof maybeInput === "object" && !Array.isArray(maybeInput)) {
      return maybeInput as Record<string, unknown>;
    }
  } catch {
    /* ignore — malformed JSON simply yields no input */
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
  // Lifecycle (non-tool) events have no tool_name — use the server summary, or
  // the raw event_type as a last resort. Never returns empty.
  if (!event.tool_name) return event.summary || event.event_type;

  const input = extractToolInput(event);
  // Local coercion helper: read a field as a string, or "" if it's absent or a
  // non-string. Keeps the per-tool branches below terse.
  const s = (v: unknown): string => (typeof v === "string" ? v : "");
  // Local truncator: clamp long values (commands, descriptions) so a single
  // title never blows out the row. Default cap is 80 chars.
  const trunc = (text: string, max = 80): string =>
    text.length > max ? text.slice(0, max) + "..." : text;

  // ── MCP tools - fully dynamic dispatch ─────────────────────────────
  // Any "mcp__server__tool" name is decoded structurally (no per-server table).
  // When the payload yields a context headline we append it: "Github · create
  // pull request · Fix flaky test".
  const mcp = parseMcpToolName(event.tool_name);
  if (mcp) {
    const ctx = input ? buildContextHeadline(input) : null;
    return ctx ? `${mcp.server} · ${mcp.tool} · ${trunc(ctx)}` : `${mcp.server} · ${mcp.tool}`;
  }

  // No parseable input (missing / invalid data): fall back to the tool name plus
  // any server summary. The native per-tool logic below all needs `input`.
  if (!input) return `${event.tool_name}${event.summary ? `: ${event.summary}` : ""}`;

  // ── Native tools - per-tool smart titles ───────────────────────────
  // Each case surfaces the single most useful fact from that tool's arguments.
  // A `break` (rather than return) falls through to the generic tail at the
  // bottom, used when the expected field was absent.
  switch (event.tool_name) {
    case "Bash":
    case "PowerShell": {
      // Prefer "<tool> · <bin sub> - <description>"; degrade gracefully as
      // fields drop out (headline only, description only, then raw command).
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
      // Show the compact two-segment path so the file is identifiable.
      const path = s(input.file_path);
      if (path) return `Read · ${shortPath(path)}`;
      break;
    }
    case "Write": {
      // Same treatment as Read — the destination path is the key fact.
      const path = s(input.file_path);
      if (path) return `Write · ${shortPath(path)}`;
      break;
    }
    case "Edit":
    case "NotebookEdit": {
      const path = s(input.file_path);
      if (path) {
        // Flag global replacements so a sweeping edit is visually distinct.
        const suffix = input.replace_all === true ? " (all)" : "";
        return `${event.tool_name} · ${shortPath(path)}${suffix}`;
      }
      break;
    }
    case "Grep": {
      // Lead with the search pattern; append the scope directory when present.
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
      // The glob pattern *is* the action; show it verbatim (already short).
      const pattern = s(input.pattern);
      if (pattern) return `Glob · "${pattern}"`;
      break;
    }
    case "WebFetch": {
      // Only the host is meaningful at a glance; the full URL is often huge.
      const url = s(input.url);
      if (url) return `WebFetch · ${hostFromUrl(url)}`;
      break;
    }
    case "Agent":
    case "Task": {
      // Subagent spawns: identify the agent kind and/or its task description,
      // e.g. "Task · frontend-reviewer - audit the new modal".
      const desc = s(input.description);
      const subtype = s(input.subagent_type);
      if (desc && subtype) return `${event.tool_name} · ${subtype} - ${trunc(desc, 60)}`;
      if (desc) return `${event.tool_name} · ${trunc(desc, 60)}`;
      if (subtype) return `${event.tool_name} · ${subtype}`;
      break;
    }
    // Task-management tools all share the same shape: prefer a human
    // description, else the task id.
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
      // Show the delay in seconds and, when given, the reason for the wakeup.
      const delay = input.delaySeconds;
      const reason = s(input.reason);
      if (typeof delay === "number") {
        return `ScheduleWakeup · ${delay}s${reason ? ` - ${trunc(reason, 50)}` : ""}`;
      }
      break;
    }
    case "AskUserQuestion": {
      // `questions` is an array of objects; surface the first question's text.
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
      // Monitor watches a shell command; show the (truncated) command text.
      const cmd = s(input.command);
      if (cmd) return `Monitor · ${trunc(cmd)}`;
      break;
    }
    case "ToolSearch": {
      // The search query is the action being performed.
      const q = s(input.query);
      if (q) return `ToolSearch · ${trunc(q, 60)}`;
      break;
    }
    default: {
      // Unknown native tool: reuse the generic CONTEXT_FIELDS headline so even
      // never-before-seen tools get a meaningful title instead of "Using tool".
      const ctx = buildContextHeadline(input);
      if (ctx) return `${event.tool_name} · ${trunc(ctx)}`;
    }
  }

  // Tail fallback: reached when a matched case `break`s because its expected
  // field was missing. Show the tool name plus any server summary.
  return `${event.tool_name}${event.summary ? ` · ${event.summary}` : ""}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Agent attribution labels
//
// These helpers turn an `agent_id` (and optional AgentInfo) into the short
// labels shown next to events. A session has one "main" agent plus zero or more
// nested subagents; the goal is to identify *which* agent acted without adding
// noise for the common main-agent case.
// ════════════════════════════════════════════════════════════════════════════

/** Returns a short agent label for display next to an event, or null when the
 *  event belongs to the session's main agent (no disambiguation needed).
 * @param agentId The event's `agent_id`, or null.
 * @returns The last-8 of the id for subagents, the whole id when short, or null
 *   for the main agent / a missing id.
 */
export function shortAgentLabel(agentId: string | null): string | null {
  if (!agentId) return null;
  // Main-agent ids end in "-main"; those need no pill (they're the default).
  if (agentId.endsWith("-main")) return null;
  // Last 8 chars of the UUID is enough to distinguish subagents on the same row.
  return agentId.length > 8 ? agentId.slice(-8) : agentId;
}

/** Minimal subset of an Agent record, enough to render a subagent pill and
 *  walk the parent chain (so events from a nested subagent can render the
 *  full "main › coder › explorer" attribution). */
export type AgentInfo = {
  /** "main" for the session's root agent, "subagent" for any spawned agent. */
  type: "main" | "subagent";
  /** The subagent's kind (e.g. "frontend-reviewer"); null for main agents. */
  subagent_type: string | null;
  /** A human name / label for the agent; used when `subagent_type` is empty. */
  name: string;
  /** Parent agent's id, enabling the chain walk in {@link agentOriginLabel}. */
  parent_agent_id?: string | null;
};

/** Single-segment label for an agent - the pill text. Returns null when the
 *  agent is the session's main agent (pill is noise in that case).
 *
 *  Preference order: the descriptive `subagent_type` (most meaningful), then the
 *  agent's `name`, then null when neither is populated.
 * @param info The agent record to label.
 * @returns One label segment, or null for main / unlabeled agents.
 */
function singleAgentSegment(info: AgentInfo): string | null {
  if (info.type === "main") return null;
  if (info.subagent_type && info.subagent_type.length > 0) return info.subagent_type;
  if (info.name && info.name.length > 0) return info.name;
  return null;
}

/** Resolves the pill label for an event's agent. Returns null when the event
 *  comes from the session's main agent (the pill is noise in that case) or
 *  when no info is available. Prefers subagent_type (e.g. "frontend-reviewer"),
 *  then the agent's name, and finally the last-8 short ID fallback.
 * @param agentId The event's `agent_id`; null yields null.
 * @param info Optional {@link AgentInfo} for that agent, when known.
 * @returns The pill text, or null when nothing worth showing exists.
 */
export function agentPillLabel(agentId: string | null, info: AgentInfo | undefined): string | null {
  if (!agentId) return null;
  if (info) {
    const seg = singleAgentSegment(info);
    // A concrete subagent label wins outright.
    if (seg !== null) return seg;
    // Known main agent with no segment → deliberately no pill.
    if (info.type === "main") return null;
  }
  // No usable info: fall back to the id-derived short label.
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
  // Overload detection: a Map enables the parent-chain walk; a bare AgentInfo
  // (or undefined) keeps the legacy single-segment path.
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
    // Without info, infer "main" from the id suffix, else use the short id.
    if (agentId.endsWith("-main")) return "main";
    return shortAgentLabel(agentId);
  }

  // Map provided - walk parent chain so nested subagents read "main › coder".
  const segments: string[] = [];
  // `seen` guards against a corrupt parent cycle causing an infinite loop.
  const seen = new Set<string>();
  let cursor: string | null = agentId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const node = map.get(cursor);
    // Missing node: the chain is broken — stop and use whatever we gathered.
    if (!node) break;
    if (node.type === "main") {
      // Reached the root; prepend "main" and stop climbing.
      segments.unshift("main");
      break;
    }
    // `unshift` builds the chain root-first so it reads top-down.
    const seg = singleAgentSegment(node);
    if (seg) segments.unshift(seg);
    cursor = node.parent_agent_id ?? null;
  }

  // Walk produced nothing usable (e.g. id absent from the map): fall back the
  // same way the map-less branch does.
  if (segments.length === 0) {
    if (agentId.endsWith("-main")) return "main";
    return shortAgentLabel(agentId);
  }
  return segments.join(" › ");
}

// ════════════════════════════════════════════════════════════════════════════
// Origin prefix and project derivation
// ════════════════════════════════════════════════════════════════════════════

/** Builds the muted origin prefix shown before a row's action title, e.g.
 *  "datapilot › DataPilot › frontend-reviewer". Returns null when nothing
 *  identifying is available. Any of the three segments may be null - pages
 *  already scoped to a single session pass null for sessionName, etc. When a
 *  segment equals the previous one (e.g. project name == session name), it
 *  is dropped to avoid visual duplication.
 * @param projectName Leading segment (usually the working-directory name).
 * @param sessionName Middle segment; dropped when identical to projectName.
 * @param agentLabel Trailing segment (from {@link agentOriginLabel}).
 * @returns The " › "-joined prefix, or null when every segment was empty.
 */
export function buildOriginLabel(
  projectName: string | null | undefined,
  sessionName: string | null | undefined,
  agentLabel: string | null
): string | null {
  const parts: string[] = [];
  if (projectName) parts.push(projectName);
  // Skip the session name when it just repeats the project name.
  if (sessionName && sessionName !== projectName) parts.push(sessionName);
  if (agentLabel) parts.push(agentLabel);
  return parts.length > 0 ? parts.join(" › ") : null;
}

/** Last path segment of a working directory - the project/dir name shown as the
 *  leading origin segment. Null for an empty or missing cwd. Use this to derive
 *  a fallback project for events whose own payload carries no `cwd` (e.g.
 *  TurnDuration), by passing the owning session's cwd.
 * @param cwd An absolute working-directory path, or null/undefined.
 * @returns The final path segment, or null when there's no usable cwd.
 * @example projectFromCwd("/Users/me/dev/datapilot") // "datapilot"
 */
export function projectFromCwd(cwd: string | null | undefined): string | null {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  return basename(cwd);
}

/** Reads `cwd` out of an event's payload and returns the last path segment
 *  (the project/directory name). Null when the payload doesn't include cwd
 *  (e.g. TurnDuration events, or events from a very old client) - callers can
 *  fall back to `projectFromCwd(session.cwd)` in that case.
 * @param event The event whose JSON `data` payload may carry a `cwd`.
 * @returns The derived project name, or null when no `cwd` is present / valid.
 */
export function projectFromEvent(event: DashboardEvent): string | null {
  if (!event.data) return null;
  try {
    const parsed = JSON.parse(event.data);
    // Only a plain-object payload can carry a top-level `cwd` string.
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const cwd = (parsed as Record<string, unknown>).cwd;
      if (typeof cwd === "string" && cwd.length > 0) return projectFromCwd(cwd);
    }
  } catch {
    /* ignore — no parseable cwd means the caller uses its session fallback */
  }
  return null;
}
