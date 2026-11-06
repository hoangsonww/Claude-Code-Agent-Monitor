/**
 * @file Translates Cursor's Claude-compatible JSONL entries into the
 * conversation DTOs shared by transcript rendering and completeness checks.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const TEXT_LIMIT = 10240;

function truncate(value, maxLen = TEXT_LIMIT) {
  if (!value || value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}[truncated]`;
}

function truncateObject(value, maxLen = TEXT_LIMIT) {
  if (!value) return value;
  const json = JSON.stringify(value);
  return json.length <= maxLen ? value : { _truncated: truncate(json, maxLen) };
}

/** Return one renderable Cursor transcript message, or null for plumbing-only entries. */
function parseCursorMessage(entry, line, isSubagentFile) {
  if (entry?.role !== "user" && entry?.role !== "assistant") return null;
  const rawContent = entry?.message?.content;
  if (!Array.isArray(rawContent)) return null;
  const content = [];
  let embeddedTimestamp = null;
  for (const block of rawContent) {
    if (block?.type === "text" && typeof block.text === "string" && block.text.trim()) {
      let text = block.text;
      const timestampMatch = text.match(/<timestamp>([\s\S]*?)<\/timestamp>/i);
      if (timestampMatch) {
        const normalized = timestampMatch[1].replace(
          /\(UTC([+-]\d{1,2})\)/i,
          (_match, offset) =>
            `GMT${Number(offset) >= 0 ? "+" : "-"}${String(Math.abs(Number(offset))).padStart(2, "0")}00`
        );
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) embeddedTimestamp = parsed.toISOString();
        text = text.replace(timestampMatch[0], "").trim();
      }
      const userQuery = text.match(/<user_query>([\s\S]*?)<\/user_query>/i);
      if (userQuery) text = userQuery[1].trim();
      if (text) content.push({ type: "text", text: truncate(text) });
    } else if (entry.role === "assistant" && block?.type === "tool_use") {
      content.push({
        type: "tool_use",
        name: block.name || "unknown",
        id: block.id || null,
        input: truncateObject(block.input || {}),
      });
    }
  }
  if (content.length === 0) return null;
  return {
    type: entry.role,
    sender: entry.role === "assistant" ? "assistant" : isSubagentFile ? "orchestrator" : "user",
    timestamp: entry.timestamp || embeddedTimestamp,
    content,
    line,
  };
}

module.exports = { parseCursorMessage };
