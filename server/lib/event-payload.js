/**
 * @file Trims a hook payload before it is stored as `events.data`. Claude Code
 * hooks carry whole-file mirrors (`tool_response.originalFile` on Edit/Write,
 * `tool_response.file.content` / `.base64` on Read) and unbounded tool output.
 * The dashboard only ever renders a preview of these, and the transcript on
 * disk keeps the full text, so storing them verbatim just grows the database
 * (observed: 1.5 GB of PostToolUse rows, single rows over 700 KB). Nothing here
 * throws: a payload the trimmer cannot handle is stored as it came.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Longest string kept inside `tool_input` / `tool_response`, in characters. */
const DEFAULT_STRING_CAP = 2048;
/** Largest `tool_input` / `tool_response` kept as-is, in JSON bytes. */
const DEFAULT_FIELD_CAP = 16384;

// Whole-file mirrors the hook carries but the dashboard never needs in full.
const DROP_PATHS = [
  ["tool_response", "originalFile"],
  ["tool_response", "file", "content"],
  ["tool_response", "file", "base64"],
];
const FIELDS = ["tool_input", "tool_response"];

function readCap(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
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

/** Copy `value` with every string longer than `cap` cut down and suffixed. */
function capStrings(value, cap, stats) {
  if (typeof value === "string") {
    if (value.length <= cap) return value;
    stats.strings += 1;
    return `${value.slice(0, cap)}… [trimmed ${value.length - cap} more chars]`;
  }
  if (Array.isArray(value)) return value.map((item) => capStrings(item, cap, stats));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = capStrings(item, cap, stats);
    return out;
  }
  return value;
}

/** What survives when a whole field is over budget: its short scalars. */
function scalarsOf(value) {
  const kept = {};
  if (!isPlainObject(value)) return kept;
  for (const [key, item] of Object.entries(value)) {
    if (item === null || typeof item === "boolean" || typeof item === "number") kept[key] = item;
    else if (typeof item === "string" && item.length <= 200) kept[key] = item;
  }
  return kept;
}

/**
 * Return a copy of a hook payload that is safe to store, or the same object
 * when nothing needed trimming. Three passes, cheapest first:
 *   1. drop the whole-file mirrors in DROP_PATHS;
 *   2. cut every string in tool_input / tool_response to the string cap;
 *   3. if a field is still over the field cap, keep only its short scalars.
 * Every change is recorded under `data._trimmed` so the UI can say what is
 * missing. Set DASHBOARD_EVENT_STRING_CAP=0 to store payloads untouched.
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
    const trimmed = { dropped: {}, strings: 0, replaced: {} };

    for (const [field, ...rest] of DROP_PATHS) {
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
      trimmed.dropped[[field, ...rest].join(".")] = jsonBytes(target[leaf]);
      delete target[leaf];
    }

    for (const field of FIELDS) {
      if (out[field] === undefined) continue;
      out[field] = capStrings(out[field], stringCap, trimmed);
      const bytes = jsonBytes(out[field]);
      if (fieldCap > 0 && bytes > fieldCap) {
        trimmed.replaced[field] = bytes;
        out[field] = scalarsOf(out[field]);
      }
    }

    const changed =
      Object.keys(trimmed.dropped).length > 0 ||
      trimmed.strings > 0 ||
      Object.keys(trimmed.replaced).length > 0;
    if (!changed) return data;

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
