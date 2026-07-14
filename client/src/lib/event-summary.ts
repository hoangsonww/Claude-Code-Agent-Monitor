/**
 * @file event-summary.ts
 * @description Produces a short, human-readable summary of a DashboardEvent
 * for the top of the expanded EventDetail panel. Purely data-driven - parses
 * `tool_input` / `tool_response` and extracts the most useful facts. Returns
 * null for events where a summary would add nothing (e.g. unknown tools with
 * empty payloads).
 *
 * ## Output
 * The single public entry point, {@link buildEventSummary}, returns an
 * {@link EventSummary} — an `{ icon, headline, bullets }` triple. The icon is an
 * emoji chosen per event/tool kind, the headline is a one-line description, and
 * the bullets are optional supporting facts (diff stats, line counts, error
 * flags). It returns null only when there is genuinely nothing to show.
 *
 * ## How it differs from event-grouping.ts
 * `event-grouping.ts` produces the *collapsed* one-line title for a timeline
 * row. This file produces the *expanded* detail summary and therefore also
 * parses `tool_response` (not just `tool_input`) to report on outcomes — how
 * many lines a command printed, how many hunks an edit touched, how many matches
 * a search found, and so on.
 *
 * ## Event shape
 * Each helper reads a {@link DashboardEvent}. Relevant fields: `event_type`
 * (lifecycle name), `tool_name` (present only on tool events), and `data` — a
 * JSON *string* whose parsed form usually holds `tool_input` (arguments) and
 * `tool_response` (result). All parsing is defensive: malformed JSON, missing
 * fields, and unexpected types degrade to a smaller summary or null rather than
 * throwing.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { DashboardEvent } from "./types";

/** Rendered result of {@link buildEventSummary}: an emoji icon, a one-line
 *  headline, and zero or more supporting detail lines shown underneath it. */
export type EventSummary = {
  /** Single emoji representing the event kind (tool-specific or lifecycle). */
  icon: string;
  /** Primary one-line description, e.g. "Edited SessionDetail.tsx". */
  headline: string;
  /** Secondary detail lines (diff stats, line counts, error flags, …); may be empty. */
  bullets: string[];
};

// ════════════════════════════════════════════════════════════════════════════
// Small value / formatting helpers
// ════════════════════════════════════════════════════════════════════════════

/** Coerces an unknown value to a string, returning "" for non-strings.
 * @param v Any value pulled out of a parsed payload.
 * @returns The value when it's a string, otherwise "".
 */
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Narrows an unknown value to a plain object (not null, not an array).
 * @param v Any value (typically from `JSON.parse`).
 * @returns The value typed as a record, or null when it isn't a plain object.
 */
function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Compact two-segment path label (parent dir + filename), mirroring the helper
 *  of the same name in event-grouping.ts. Falls back to the sole segment.
 * @param path An absolute or relative path (POSIX or Windows separators).
 * @returns The last two segments joined with "/", or the single segment.
 * @example shortPath("/repo/src/lib/x.ts") // "lib/x.ts"
 */
function shortPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? path;
  return parts.slice(-2).join("/");
}

/** Truncates `text` to `max` chars, appending an ellipsis when it was clipped.
 * @param text The string to clamp.
 * @param max Maximum length before truncation (exclusive of the "...").
 * @returns The original string, or its first `max` chars followed by "...".
 */
function trunc(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

/** Parses `event.data` (JSON) into a plain object, or null on empty/invalid data.
 * @param event The event whose JSON `data` string should be decoded.
 * @returns The parsed payload object, or null when data is absent, invalid JSON,
 *   or not a plain object.
 */
function parseData(event: DashboardEvent): Record<string, unknown> | null {
  if (!event.data) return null;
  try {
    const v = JSON.parse(event.data);
    // Reuse `obj` so arrays / primitives (never valid payloads here) yield null.
    return obj(v);
  } catch {
    // Malformed JSON — no summary data available.
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Tool-response analyzers
// ════════════════════════════════════════════════════════════════════════════

/** Counts hunks and +/- lines in an Edit tool response's `structuredPatch`.
 *
 *  Claude Code's Edit/NotebookEdit responses include a `structuredPatch`: an
 *  array of hunks, each with a `lines: string[]` where every entry is prefixed
 *  by " ", "+", or "-" (unified-diff style). This tallies additions / removals
 *  so the summary can show "3 hunks · +12 −4".
 * @param structuredPatch The `tool_response.structuredPatch` value (untyped).
 * @returns `{ hunks, added, removed }`; all zero when the input isn't an array.
 * @example
 * countHunks([{ lines: ["+new", "-old", " ctx"] }]) // { hunks:1, added:1, removed:1 }
 */
function countHunks(structuredPatch: unknown): { hunks: number; added: number; removed: number } {
  // Non-array (missing / failed patch) → nothing to count.
  if (!Array.isArray(structuredPatch)) return { hunks: 0, added: 0, removed: 0 };
  let added = 0;
  let removed = 0;
  for (const raw of structuredPatch) {
    const r = obj(raw);
    // Skip malformed hunks that lack a `lines` array.
    if (!r || !Array.isArray(r.lines)) continue;
    for (const line of r.lines) {
      if (typeof line !== "string") continue;
      // Leading "+" = added line, leading "-" = removed line; " " = context.
      if (line.startsWith("+")) added++;
      else if (line.startsWith("-")) removed++;
    }
  }
  // Hunk count is simply the number of patch entries.
  return { hunks: structuredPatch.length, added, removed };
}

/** Finds the nearest function/class/const definition line surrounding an
 *  Edit hunk, so the summary can show "Inside: function foo(...)".
 *
 *  Scans the patch's lines for the first one matching a definition-like shape.
 *  The pattern intentionally requires a leading space (`^\s+`) so it matches
 *  *context* lines (unchanged surroundings) rather than the "+"/"-" changed
 *  lines — the enclosing definition is usually context, not the edit itself. It
 *  recognizes JS/TS `function` / `const|let|var` / `name = (`, Python `def`, and
 *  `class` across languages.
 * @param structuredPatch The `tool_response.structuredPatch` value (untyped).
 * @returns The trimmed definition line, or null when none is found.
 */
function firstEnclosingContext(structuredPatch: unknown): string | null {
  // Look for a context line that looks like a function/class/const definition.
  if (!Array.isArray(structuredPatch)) return null;
  const defPattern =
    /^\s+(?:function\s+\w+|def\s+\w+|class\s+\w+|(?:const|let|var)\s+\w+|\w+\s*=\s*\()/;
  for (const raw of structuredPatch) {
    const r = obj(raw);
    if (!r || !Array.isArray(r.lines)) continue;
    for (const line of r.lines) {
      // First matching line wins; trim the diff indentation for display.
      if (typeof line === "string" && defPattern.test(line)) {
        return line.trim();
      }
    }
  }
  return null;
}

/** Counts lines in `text` (empty string counts as 0, not 1).
 *
 *  Splits on LF or CRLF. The empty-string guard matters: `"".split(/\n/)`
 *  returns `[""]` (length 1), which would wrongly report an empty output as
 *  "1 line".
 * @param text The text whose lines to count.
 * @returns The number of newline-separated lines, or 0 for empty input.
 */
function lineCount(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

/** Formats a millisecond duration as "Nms" / "N.Ns" / "Nm Ns", for TurnDuration events.
 *
 *  Three tiers keep the label readable at any scale: raw milliseconds under a
 *  second, one-decimal seconds under a minute, and "Xm Ys" beyond that.
 * @param ms A non-negative duration in milliseconds.
 * @returns A compact human-readable duration string.
 * @example formatDuration(450)    // "450ms"
 * @example formatDuration(1500)   // "1.5s"
 * @example formatDuration(95000)  // "1m 35s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/**
 * Builds the icon/headline/bullets summary shown at the top of the expanded
 * EventDetail panel. Dispatches first on `event_type` for lifecycle events
 * (Stop, TurnDuration, Compaction, Notification, SessionStart/End, APIError),
 * then on `tool_name` for tool events - parsing `data`'s `tool_input`/
 * `tool_response` to surface tool-specific facts (diff stats for Edit, line
 * counts for Read/Write, match counts for Grep/Glob, etc.).
 * @param event The raw event to summarize.
 * @returns An {@link EventSummary}, or null when there's no tool name and no
 *   recognized event type to build anything useful from.
 */
export function buildEventSummary(event: DashboardEvent): EventSummary | null {
  const data = parseData(event);

  // ── Non-tool events first ──────────────────────────────────────────
  // Lifecycle events have no tool payload; each maps to a fixed icon / headline
  // plus any incidental detail carried in `data`.

  // Stop / SubagentStop: a turn (or subagent turn) ended. Optionally note the
  // stop-hook flag and the first line of the last assistant message.
  if (event.event_type === "Stop" || event.event_type === "SubagentStop") {
    const stopHookActive = data?.stop_hook_active === true;
    const msg = str(data?.last_assistant_message);
    const bullets: string[] = [];
    if (stopHookActive) bullets.push("stop hook active");
    // Only the first line keeps the bullet compact for multi-line messages.
    if (msg) bullets.push(`Last message: ${trunc(msg.split(/\r?\n/)[0] ?? "", 80)}`);
    return {
      icon: "🛑",
      headline: event.event_type === "SubagentStop" ? "Subagent turn ended" : "Turn ended",
      bullets,
    };
  }

  // TurnDuration: synthetic event carrying how long the turn took, in ms.
  if (event.event_type === "TurnDuration") {
    const durationMs = typeof data?.durationMs === "number" ? data.durationMs : null;
    return {
      icon: "⏱️",
      headline: durationMs != null ? `Turn took ${formatDuration(durationMs)}` : "Turn finished",
      bullets: [],
    };
  }

  // Compaction: the transcript was summarized to reclaim context window.
  if (event.event_type === "Compaction") {
    return {
      icon: "🗜️",
      headline: "Transcript compacted",
      bullets: ["Token usage reset for the following turn"],
    };
  }

  // Notification: a user-facing message from the agent; show text + optional type.
  if (event.event_type === "Notification") {
    const msg = str(data?.message);
    const type = str(data?.notification_type);
    return {
      icon: "🔔",
      headline: msg ? `Notification: ${trunc(msg, 80)}` : "Notification",
      bullets: type ? [`Type: ${type}`] : [],
    };
  }

  // SessionStart / SessionEnd: bracket a session; surface its source and model
  // when the payload includes them. The `.filter(Boolean)` drops empty bullets.
  if (event.event_type === "SessionStart" || event.event_type === "SessionEnd") {
    const source = str(data?.source);
    const model = str(data?.model);
    return {
      icon: event.event_type === "SessionStart" ? "🎬" : "🏁",
      headline: event.event_type === "SessionStart" ? "Session started" : "Session ended",
      bullets: [source && `Source: ${source}`, model && `Model: ${model}`].filter(
        Boolean
      ) as string[],
    };
  }

  // APIError: a provider / API failure was recorded for this event.
  if (event.event_type === "APIError") {
    return {
      icon: "⚠️",
      headline: "API error recorded",
      bullets: [],
    };
  }

  // ── Tool events ────────────────────────────────────────────────────
  // Past the lifecycle branches, only tool events remain. Without a tool_name
  // there's nothing to summarize.
  const tool = event.tool_name;
  if (!tool) return null;
  // Both may be null: `tool_input` is the arguments, `tool_response` the result.
  const input = obj(data?.tool_input);
  const response = obj(data?.tool_response);

  // MCP tools - generic summary. Any "mcp__" tool is summarized structurally,
  // pulling the most relevant field out of the call args and the response.
  if (tool.startsWith("mcp__")) {
    const headline = humanizeMcp(tool);
    const bullets: string[] = [];
    if (input) {
      // Surface the most identifying call argument, if any.
      const top = firstStringField(input, ["title", "query", "q", "url", "name", "id"]);
      if (top) bullets.push(`Called with: ${trunc(top, 80)}`);
    }
    if (response) {
      // Prefer a recognizable response field; otherwise report its field count.
      const resTop = firstStringField(response, ["title", "name", "state", "status", "url"]);
      if (resTop) bullets.push(`Response: ${trunc(resTop, 80)}`);
      else bullets.push(`Returned ${Object.keys(response).length} fields`);
    }
    return { icon: "🧩", headline, bullets };
  }

  // ── Native tools ───────────────────────────────────────────────────
  // Each case builds an icon + headline + outcome bullets from that tool's
  // specific input / response shape.
  switch (tool) {
    case "Bash":
    case "PowerShell": {
      // Report the command plus stdout/stderr line counts and interruption.
      const cmd = str(input?.command);
      const desc = str(input?.description);
      const stdout = str(response?.stdout);
      const stderr = str(response?.stderr);
      const interrupted = response?.interrupted === true;
      const bullets: string[] = [];
      if (desc) bullets.push(`"${desc}"`);
      if (stdout) bullets.push(`${lineCount(stdout)} lines stdout`);
      if (stderr) bullets.push(`${lineCount(stderr)} lines stderr`);
      // Distinguish "empty stderr" (we have a response) from "unknown" (no
      // response yet) — only claim "no stderr" once some output / response exists.
      else if (stdout || response) bullets.push("no stderr");
      if (interrupted) bullets.push("⚠ interrupted");
      return {
        icon: "💻",
        // Headline leads with the binary, then the full (clamped) command.
        headline: cmd ? `Ran ${trunc(firstWord(cmd), 40)}: ${trunc(cmd, 80)}` : `${tool} call`,
        bullets,
      };
    }

    case "Edit":
    case "NotebookEdit": {
      // Summarize the diff: enclosing definition, hunk / line counts, and whether
      // it was a global replace_all.
      const path = str(input?.file_path);
      const { hunks, added, removed } = countHunks(response?.structuredPatch);
      const ctx = firstEnclosingContext(response?.structuredPatch);
      const replaceAll = input?.replace_all === true;
      const bullets: string[] = [];
      if (ctx) bullets.push(`Inside: ${trunc(ctx, 80)}`);
      // Pluralize "hunk" and show the "+added −removed" tally.
      if (hunks > 0) bullets.push(`${hunks} hunk${hunks === 1 ? "" : "s"} · +${added} −${removed}`);
      if (replaceAll) bullets.push("replace_all mode");
      return {
        icon: "✏️",
        headline: path ? `Edited ${shortPath(path)}` : `${tool} call`,
        bullets,
      };
    }

    case "Write": {
      // Report the size of the written content in lines and bytes.
      const path = str(input?.file_path);
      const content = str(input?.content);
      const bullets: string[] = [];
      if (content) bullets.push(`${lineCount(content)} lines · ${content.length} bytes`);
      return {
        icon: "📝",
        headline: path ? `Wrote ${shortPath(path)}` : `Write call`,
        bullets,
      };
    }

    case "Read": {
      // Note whether a partial range (offset/limit) or the full file was read,
      // plus how many lines came back.
      const path = str(input?.file_path);
      const offset = input?.offset;
      const limit = input?.limit;
      const bullets: string[] = [];
      if (offset != null || limit != null) {
        // A range read — describe whichever bounds were provided.
        const parts: string[] = [];
        if (offset != null) parts.push(`offset ${offset}`);
        if (limit != null) parts.push(`limit ${limit}`);
        bullets.push(`Range: ${parts.join(", ")}`);
      } else {
        bullets.push("Full file");
      }
      // Read responses come back as a raw string of file contents.
      if (typeof response === "string") {
        bullets.push(`${lineCount(response)} lines returned`);
      }
      return {
        icon: "📖",
        headline: path ? `Read ${shortPath(path)}` : "Read call",
        bullets,
      };
    }

    case "Grep": {
      // Headline the search pattern (+ scope); bullet the match count.
      const pattern = str(input?.pattern);
      const path = str(input?.path);
      const bullets: string[] = [];
      const matchCount = countGrepMatches(response);
      // Pluralize "match" / "matches" based on the count.
      if (matchCount != null) bullets.push(`${matchCount} match${matchCount === 1 ? "" : "es"}`);
      return {
        icon: "🔍",
        headline: pattern
          ? `Searched "${trunc(pattern, 50)}"${path ? ` in ${shortPath(path)}` : ""}`
          : "Grep call",
        bullets,
      };
    }

    case "Glob": {
      // Headline the glob pattern; bullet how many files matched.
      const pattern = str(input?.pattern);
      const bullets: string[] = [];
      const fileCount = countFiles(response);
      if (fileCount != null) bullets.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
      return {
        icon: "🗂️",
        headline: pattern ? `Listed files matching "${pattern}"` : "Glob call",
        bullets,
      };
    }

    case "WebFetch": {
      // Headline the fetched host; bullet the extraction prompt and response size.
      const url = str(input?.url);
      const prompt = str(input?.prompt);
      const bullets: string[] = [];
      if (prompt) bullets.push(`Prompt: ${trunc(prompt, 80)}`);
      if (typeof response === "string") bullets.push(`${lineCount(response)} lines returned`);
      let host = "";
      try {
        host = new URL(url).host;
      } catch {
        // Malformed / relative URL — show the raw string instead of the host.
        host = url;
      }
      return {
        icon: "🌐",
        headline: url ? `Fetched ${host}` : "WebFetch call",
        bullets,
      };
    }

    case "Task":
    case "Agent": {
      // Detail the spawned subagent's kind, task, and output size.
      const subtype = str(input?.subagent_type);
      const desc = str(input?.description);
      const bullets: string[] = [];
      if (subtype) bullets.push(`Subagent: ${subtype}`);
      if (desc) bullets.push(`Description: ${trunc(desc, 80)}`);
      if (typeof response === "string") bullets.push(`${lineCount(response)} lines output`);
      return { icon: "🤖", headline: `Spawned subagent`, bullets };
    }

    case "TaskCreate": {
      // A task was created — headline its description.
      const d = str(input?.description);
      return {
        icon: "✅",
        headline: d ? `Created task: ${trunc(d, 80)}` : "TaskCreate",
        bullets: [],
      };
    }
    case "TaskUpdate": {
      // A task was updated — prefer its description, falling back to its id.
      const d = str(input?.description) || str(input?.id);
      return {
        icon: "🔄",
        headline: d ? `Updated task: ${trunc(d, 80)}` : "TaskUpdate",
        bullets: [],
      };
    }

    case "AskUserQuestion": {
      // Headline the first question's text from the `questions` array.
      const qs = Array.isArray(input?.questions) ? input?.questions : null;
      const first = qs && qs.length > 0 ? obj(qs[0]) : null;
      const q = first ? str(first.question) : "";
      return {
        icon: "❓",
        headline: q ? `Asked: "${trunc(q, 80)}"` : "Asked user",
        bullets: [],
      };
    }

    case "ScheduleWakeup": {
      // Headline the delay; bullet the reason when supplied.
      const delay = input?.delaySeconds;
      const reason = str(input?.reason);
      return {
        icon: "😴",
        headline: typeof delay === "number" ? `Scheduled wakeup in ${delay}s` : "Scheduled wakeup",
        bullets: reason ? [`Reason: ${trunc(reason, 80)}`] : [],
      };
    }

    default: {
      // Unknown native tool - minimal summary. With neither input nor response
      // there is nothing worth showing, so return null (no summary card).
      if (!input && !response) return null;
      return {
        icon: "🔧",
        headline: `${tool} call`,
        // At least report how many input fields were passed.
        bullets: input ? [`${Object.keys(input).length} input fields`] : [],
      };
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// MCP name + field extraction helpers
// ════════════════════════════════════════════════════════════════════════════

/** Turns an `mcp__server__tool_name` tool name into "Server · tool name" for
 *  the MCP-tool summary headline (duplicates the dedupe/casing logic in
 *  event-grouping.ts's `humanizeMcpServer`, kept local to avoid a cross-import).
 * @param toolName A namespaced MCP tool name, e.g. "mcp__github__list_issues".
 * @returns "Server · tool name" (e.g. "Github · list issues"), or the raw name
 *   when it doesn't have the expected 3+ `__`-separated segments.
 * @example humanizeMcp("mcp__claude_ai_Slack__send_message") // "Slack · send message"
 */
function humanizeMcp(toolName: string): string {
  const parts = toolName.split("__").filter(Boolean);
  // Not a well-formed MCP name — return it untouched.
  if (parts.length < 3) return toolName;
  const rawServer = parts[1] ?? "";
  // Everything past the server is the (possibly multi-word) action.
  const rest = parts.slice(2).join(" ");
  // Reuse the same server-humanization logic as elsewhere: split, dedupe, last token.
  const tokens = rawServer.split(/[_-]+/).filter(Boolean);
  const dedup: string[] = [];
  for (const t of tokens) if (dedup[dedup.length - 1] !== t) dedup.push(t);
  const last = dedup[dedup.length - 1] ?? rawServer;
  // Capitalize only when the token is all-lowercase (preserves "GitLab" etc.).
  const server = last.toLowerCase() === last ? last.charAt(0).toUpperCase() + last.slice(1) : last;
  // Normalize the action to lowercase spaced words.
  const toolPart = rest.replace(/_+/g, " ").trim().toLowerCase();
  return `${server} · ${toolPart}`;
}

/** Extracts the first whitespace-delimited token of a shell command (the binary).
 * @param command The full command string.
 * @returns The first non-whitespace run, or the original string if none.
 * @example firstWord("  npm run build") // "npm"
 */
function firstWord(command: string): string {
  const m = command.trim().match(/^(\S+)/);
  return m ? (m[1] ?? command) : command;
}

/** Returns the first non-empty string value found in `obj` among `priority`
 *  keys, in order - used to surface the most relevant MCP call/response field.
 * @param obj The object to inspect (a parsed input or response).
 * @param priority Keys to try, most-preferred first.
 * @returns The first matching non-empty string, or null when none match.
 */
function firstStringField(obj: Record<string, unknown>, priority: string[]): string | null {
  for (const k of priority) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

/** Best-effort match count from a Grep tool response, checking a few
 *  known response shapes (array, `.matches`, `.files`, `.count`, `.numFiles`).
 *
 *  Grep results have varied over time and by output mode, so each known shape is
 *  probed in turn and the first that fits wins.
 * @param response The `tool_response` value (untyped).
 * @returns The match / file count, or null when no known shape applies.
 */
function countGrepMatches(response: unknown): number | null {
  if (!response) return null;
  // Plain array of matches.
  if (Array.isArray(response)) return response.length;
  const r = obj(response);
  if (!r) return null;
  // Object wrappers seen across Grep output modes.
  if (Array.isArray(r.matches)) return r.matches.length;
  if (Array.isArray(r.files)) return r.files.length;
  if (typeof r.count === "number") return r.count;
  if (typeof r.numFiles === "number") return r.numFiles;
  return null;
}

/** Best-effort file count from a Glob tool response (array, `.files`, or `.paths`).
 * @param response The `tool_response` value (untyped).
 * @returns The number of matched files, or null when no known shape applies.
 */
function countFiles(response: unknown): number | null {
  if (Array.isArray(response)) return response.length;
  const r = obj(response);
  if (!r) return null;
  if (Array.isArray(r.files)) return r.files.length;
  if (Array.isArray(r.paths)) return r.paths.length;
  return null;
}
