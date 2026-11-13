/**
 * @file agy-transcript.js
 * @description Translates Google Antigravity CLI (agy) transcript JSONL steps
 * (USER_INPUT / PLANNER_RESPONSE / GENERIC) into the conversation DTOs shared by
 * the session transcript reader, and strips agy's prompt wrapper tags so imported
 * prompt labels read like what the user typed.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const TEXT_LIMIT = 10240;

function truncate(value, maxLen = TEXT_LIMIT) {
  if (!value || value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}[truncated]`;
}

/** Flatten agy's string / array / {text} content shapes to plain text. */
function agyContentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join(" ");
  }
  if (content && typeof content === "object" && typeof content.text === "string")
    return content.text;
  return "";
}

/**
 * agy wraps typed prompts in `<USER_REQUEST>…</USER_REQUEST>`; keep only the request.
 * The wrapper is only recognised at the very start, so a prompt that merely
 * mentions the tag (e.g. "Explain <USER_REQUEST> here") is kept intact.
 */
function cleanAgyUserText(content) {
  const text = agyContentText(content);
  const match = text.match(/^\s*<USER_REQUEST>([\s\S]*?)(?:<\/USER_REQUEST>|$)/i);
  return (match ? match[1] : text).trim();
}

/** agy stores each tool argument as a JSON-encoded string; decode where possible. */
function decodeAgyArgs(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  const out = {};
  for (const [key, value] of Object.entries(args)) {
    if (key === "toolSummary") continue;
    if (typeof value === "string") {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else {
      out[key] = value;
    }
  }
  const json = JSON.stringify(out);
  return json.length <= TEXT_LIMIT ? out : { _truncated: truncate(json) };
}

/** Return one renderable agy transcript message, or null for plumbing-only steps. */
function parseAgyMessage(entry, line) {
  const timestamp = typeof entry?.created_at === "string" ? entry.created_at : null;
  if (entry?.type === "USER_INPUT") {
    const text = cleanAgyUserText(entry.content);
    if (!text) return null;
    return {
      type: "user",
      sender: "user",
      timestamp,
      content: [{ type: "text", text: truncate(text) }],
      line,
    };
  }
  if (entry?.type === "PLANNER_RESPONSE") {
    const content = [];
    if (typeof entry.thinking === "string" && entry.thinking.trim()) {
      content.push({ type: "thinking", text: truncate(entry.thinking) });
    }
    const text = agyContentText(entry.content).trim();
    if (text) content.push({ type: "text", text: truncate(text) });
    if (Array.isArray(entry.tool_calls)) {
      for (const call of entry.tool_calls) {
        if (!call || typeof call.name !== "string") continue;
        content.push({
          type: "tool_use",
          name: call.name,
          id: null,
          input: decodeAgyArgs(call.args),
        });
      }
    }
    if (content.length === 0) return null;
    return { type: "assistant", sender: "assistant", timestamp, content, line };
  }
  if (entry?.type === "GENERIC") {
    const output = agyContentText(entry.content).trim();
    if (!output) return null;
    return {
      type: "user",
      sender: "tool",
      timestamp,
      content: [{ type: "tool_result", id: null, output: truncate(output), is_error: false }],
      line,
    };
  }
  return null;
}

module.exports = { parseAgyMessage, cleanAgyUserText, agyContentText };
