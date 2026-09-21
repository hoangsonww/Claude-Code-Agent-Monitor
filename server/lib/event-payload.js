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

/** Longest string kept inside `tool_input` / `tool_response` (UTF-16 units),
 *  before the short suffix that says how much was cut. */
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
  // Stop / SubagentStop carry the session's whole background-task list (tens
  // of KB per turn); nothing in the dashboard reads it. `tools: null` = any hook.
  { tools: null, path: ["background_tasks"] },
];
/** Fields that also get the whole-field byte cap. */
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

// Only a count the trimmer itself could have written (payloads are capped at
// 1 MB upstream, so a real count has well under nine digits); anything longer
// is ordinary authored text.
const TRIM_SUFFIX = /… \[trimmed (\d{1,9}) more chars\]$/;

/** Copy `value` with every string longer than `cap` cut down and suffixed.
 *  A string that already carries the suffix was cut by an earlier pass: if its
 *  body fits the cap it is left alone (so trimming is idempotent and a re-run
 *  of the sweep is a no-op); if not — a lower cap than last time — it is cut
 *  again and the suffix carries the total that has been cut so far. Known
 *  limit: a user-authored string that happens to end with the exact suffix
 *  (with a count of at most nine digits) is read the same way, so it may keep
 *  the suffix's length on top of the cap and its number is folded into the
 *  count — at most ~35 characters over the cap, never unbounded. */
function capStrings(value, cap, stats) {
  if (typeof value === "string") {
    const prior = TRIM_SUFFIX.exec(value);
    const body = prior ? value.slice(0, prior.index) : value;
    if (body.length <= cap) return value;
    // Never end on a high surrogate: that would split an astral character.
    const code = body.charCodeAt(cap - 1);
    const cut = cap > 0 && code >= 0xd800 && code <= 0xdbff ? cap - 1 : cap;
    const carried = prior ? Number(prior[1]) : 0;
    stats.strings += 1;
    return `${body.slice(0, cut)}… [trimmed ${body.length - cut + carried} more chars]`;
  }
  if (Array.isArray(value)) return value.map((item) => capStrings(item, cap, stats));
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, item] of Object.entries(value)) setKey(out, key, capStrings(item, cap, stats));
    return out;
  }
  return value;
}

const DROP_PATHS = new Set(DROP_RULES.map(({ path }) => path.join(".")));

function finiteCounts(value, allowed) {
  const out = {};
  if (!isPlainObject(value)) return out;
  for (const [key, count] of Object.entries(value)) {
    if (allowed.has(key) && Number.isFinite(count) && count >= 0) out[key] = count;
  }
  return out;
}

/** The usable part of an existing `_trimmed` marker, and whether reading it
 *  that way changed anything (so an invalid marker gets rewritten). */
function priorMarker(prior) {
  const source = isPlainObject(prior) ? prior : {};
  const marker = {
    dropped: finiteCounts(source.dropped, DROP_PATHS),
    strings: Number.isFinite(source.strings) && source.strings > 0 ? source.strings : 0,
    replaced: finiteCounts(source.replaced, new Set(FIELDS)),
  };
  const kept = {};
  if (Object.keys(marker.dropped).length > 0) kept.dropped = marker.dropped;
  if (marker.strings > 0) kept.strings = marker.strings;
  if (Object.keys(marker.replaced).length > 0) kept.replaced = marker.replaced;
  // A supplied marker that keeps nothing (including a literal `{}`) is a
  // change too: the output drops it rather than storing an empty label.
  marker.changed =
    prior !== undefined &&
    (Object.keys(kept).length === 0 || JSON.stringify(kept) !== JSON.stringify(prior));
  return marker;
}

/** What survives when a whole field is over budget: its short scalars, in
 *  key order, until the budget is spent. */
function scalarsWithin(value, budget) {
  const kept = {};
  if (!isPlainObject(value)) return kept;
  let used = 2; // the braces
  let count = 0;
  for (const [key, item] of Object.entries(value)) {
    const scalar =
      item === null ||
      typeof item === "boolean" ||
      typeof item === "number" ||
      (typeof item === "string" && item.length <= 200);
    if (!scalar) continue;
    // `"key":value`, plus the comma that separates it from the previous one.
    const cost = jsonBytes(key) + 1 + jsonBytes(item) + (count > 0 ? 1 : 0);
    if (used + cost > budget) break;
    count += 1;
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
 *      scalars as fit (DASHBOARD_EVENT_FIELD_CAP=0 skips this pass).
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
    const rawFieldCap = opts.fieldCap ?? readCap("DASHBOARD_EVENT_FIELD_CAP", DEFAULT_FIELD_CAP);
    // `{}` is two bytes, the smallest thing the field pass can leave behind.
    const fieldCap = rawFieldCap > 0 ? Math.max(2, rawFieldCap) : 0;
    if (stringCap === 0 || !isPlainObject(data)) return data;

    const out = { ...data };
    // A prior marker (a re-swept row) is carried forward, but only its known
    // shape: finite counts under the drop paths and tool fields this module
    // writes. Anything else in `_trimmed` is caller-supplied and is not
    // exempt from trimming just because of its name.
    const trimmed = priorMarker(data._trimmed);
    let changes = trimmed.changed ? 1 : 0;

    for (const { tools, path } of DROP_RULES) {
      if (tools && !tools.includes(data.tool_name)) continue;
      let parent = data;
      for (let i = 0; i < path.length - 1; i++)
        parent = isPlainObject(parent) ? parent[path[i]] : null;
      const leaf = path[path.length - 1];
      if (!isPlainObject(parent) || parent[leaf] === undefined) continue;
      // Copy the path before deleting so the caller's object stays intact
      // (`out` is already a shallow copy of the top level).
      let target = out;
      for (let i = 0; i < path.length - 1; i++) {
        target[path[i]] = { ...target[path[i]] };
        target = target[path[i]];
      }
      trimmed.dropped[path.join(".")] = jsonBytes(target[leaf]);
      delete target[leaf];
      changes += 1;
    }

    // Every string in the payload gets the cap: tool arguments and results,
    // but also `prompt`, `last_assistant_message` and anything a future hook
    // adds. Only the two tool fields get the whole-field byte cap.
    for (const key of Object.keys(out)) {
      if (key === "_trimmed") continue;
      const before = trimmed.strings;
      out[key] = capStrings(out[key], stringCap, trimmed);
      changes += trimmed.strings - before;
      if (!FIELDS.includes(key)) continue;
      const bytes = jsonBytes(out[key]);
      if (fieldCap > 0 && bytes > fieldCap) {
        trimmed.replaced[key] = bytes;
        out[key] = scalarsWithin(out[key], fieldCap);
        changes += 1;
      }
    }

    if (changes === 0) return data;

    const marker = {};
    if (Object.keys(trimmed.dropped).length > 0) marker.dropped = trimmed.dropped;
    if (trimmed.strings > 0) marker.strings = trimmed.strings;
    if (Object.keys(trimmed.replaced).length > 0) marker.replaced = trimmed.replaced;
    if (Object.keys(marker).length > 0) out._trimmed = marker;
    else delete out._trimmed;
    return out;
  } catch {
    return data;
  }
}

module.exports = { trimHookPayload, DEFAULT_STRING_CAP, DEFAULT_FIELD_CAP };
