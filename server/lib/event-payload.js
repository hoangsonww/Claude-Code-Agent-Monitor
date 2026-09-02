/**
 * @file Trims a hook payload before it is stored as `events.data`. Claude Code
 * hooks carry whole-file mirrors (`tool_response.originalFile` on Edit/Write,
 * `tool_response.file.content` / `.base64` on Read) and unbounded tool output.
 * The transcript on disk keeps all of it, and the dashboard needs only enough
 * for the event detail pane's diff / terminal previews, so storing it verbatim
 * just grows the database (observed: 1.5 GB of PostToolUse rows, single rows
 * over 700 KB). What is stored is a lossy preview: the "original file" pane is
 * not shown for stored events, summaries count preview lines, and text search
 * over `data` sees only what was kept. Nothing here throws: a payload the
 * trimmer cannot handle is stored as it came.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Longest string kept inside `tool_input` / `tool_response` (UTF-16 units). */
const DEFAULT_STRING_CAP = 2048;
/** Largest `tool_input` / `tool_response` kept as-is, in JSON bytes. */
const DEFAULT_FIELD_CAP = 16384;

// Whole-file mirrors, dropped only for the native tools that produce them so a
// third-party (MCP) tool with a same-named short field keeps it.
const DROP_RULES = [
  {
    tools: ["Edit", "MultiEdit", "NotebookEdit", "Write"],
    path: ["tool_response", "originalFile"],
  },
  { tools: ["Read"], path: ["tool_response", "file", "content"] },
  { tools: ["Read"], path: ["tool_response", "file", "base64"] },
];
const FIELDS = ["tool_input", "tool_response"];

function readCap(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function jsonBytes(value) {
  const text = JSON.stringify(value);
  return text === undefined ? 0 : Buffer.byteLength(text);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Own-property assignment that also survives a key literally named __proto__. */
function setKey(target, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}

/** Copy `value` with every string longer than `cap` cut down and suffixed. */
function capStrings(value, cap, stats) {
  if (typeof value === "string") {
    if (value.length <= cap) return value;
    // Never end on a high surrogate: that would split an astral character.
    const code = value.charCodeAt(cap - 1);
    const cut = cap > 0 && code >= 0xd800 && code <= 0xdbff ? cap - 1 : cap;
    stats.strings += 1;
    return `${value.slice(0, cut)}… [trimmed ${value.length - cut} more chars]`;
  }
  if (Array.isArray(value)) return value.map((item) => capStrings(item, cap, stats));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) setKey(out, key, capStrings(item, cap, stats));
    return out;
  }
  return value;
}

/** What survives when a whole field is over budget: its short scalars, in
 *  key order, until the budget is spent. */
function scalarsWithin(value, budget) {
  const kept = {};
  if (!isPlainObject(value)) return kept;
  let used = 2; // the braces
  for (const [key, item] of Object.entries(value)) {
    const scalar =
      item === null ||
      typeof item === "boolean" ||
      typeof item === "number" ||
      (typeof item === "string" && item.length <= 200);
    if (!scalar) continue;
    const cost = jsonBytes(key) + 1 + jsonBytes(item) + 1;
    if (used + cost > budget) break;
    used += cost;
    setKey(kept, key, item);
  }
  return kept;
}

/**
 * Return a copy of a hook payload that is safe to store, or the same object
 * when nothing needed trimming. Three passes, cheapest first:
 *   1. drop the whole-file mirrors in DROP_RULES (native tools only);
 *   2. cut every string in tool_input / tool_response to the string cap;
 *   3. if a field is still over the field cap, keep only as many of its short
 *      scalars as fit.
 * Every change is recorded under `data._trimmed` (merged with an existing
 * marker, so re-trimming a stored row keeps its history). Set
 * DASHBOARD_EVENT_STRING_CAP=0 to store payloads untouched.
 * @param {unknown} data The `data` object of a hook event.
 * @param {{stringCap?: number, fieldCap?: number}} [opts] Test overrides.
 * @returns {unknown} The payload to store.
 */
function trimHookPayload(data, opts = {}) {
  try {
    const stringCap = opts.stringCap ?? readCap("DASHBOARD_EVENT_STRING_CAP", DEFAULT_STRING_CAP);
    const fieldCap = opts.fieldCap ?? readCap("DASHBOARD_EVENT_FIELD_CAP", DEFAULT_FIELD_CAP);
    if (stringCap === 0 || !isPlainObject(data)) return data;

    const out = { ...data };
    const prior = isPlainObject(data._trimmed) ? data._trimmed : {};
    const trimmed = {
      dropped: { ...(isPlainObject(prior.dropped) ? prior.dropped : {}) },
      strings: typeof prior.strings === "number" ? prior.strings : 0,
      replaced: { ...(isPlainObject(prior.replaced) ? prior.replaced : {}) },
    };
    let changes = 0;

    for (const { tools, path } of DROP_RULES) {
      if (!tools.includes(data.tool_name)) continue;
      const [field, ...rest] = path;
      let parent = out[field];
      for (let i = 0; i < rest.length - 1; i++)
        parent = isPlainObject(parent) ? parent[rest[i]] : null;
      const leaf = rest[rest.length - 1];
      if (!isPlainObject(parent) || parent[leaf] === undefined) continue;
      // Copy the path before deleting so the caller's object stays intact.
      out[field] = { ...out[field] };
      let target = out[field];
      for (let i = 0; i < rest.length - 1; i++) {
        target[rest[i]] = { ...target[rest[i]] };
        target = target[rest[i]];
      }
      trimmed.dropped[path.join(".")] = jsonBytes(target[leaf]);
      delete target[leaf];
      changes += 1;
    }

    for (const field of FIELDS) {
      if (out[field] === undefined) continue;
      const before = trimmed.strings;
      out[field] = capStrings(out[field], stringCap, trimmed);
      changes += trimmed.strings - before;
      const bytes = jsonBytes(out[field]);
      if (fieldCap > 0 && bytes > fieldCap) {
        trimmed.replaced[field] = bytes;
        out[field] = scalarsWithin(out[field], fieldCap);
        changes += 1;
      }
    }

    if (changes === 0) return data;

    const marker = {};
    if (Object.keys(trimmed.dropped).length > 0) marker.dropped = trimmed.dropped;
    if (trimmed.strings > 0) marker.strings = trimmed.strings;
    if (Object.keys(trimmed.replaced).length > 0) marker.replaced = trimmed.replaced;
    out._trimmed = marker;
    return out;
  } catch {
    return data;
  }
}

module.exports = { trimHookPayload, DEFAULT_STRING_CAP, DEFAULT_FIELD_CAP };
