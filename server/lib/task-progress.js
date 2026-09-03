/**
 * @file Derives owner-attributed task progress from Claude and Codex JSONL
 * transcripts plus persisted task and session lifecycle events. Top-level
 * work boundaries expire older tracker state, turn-end markers discard
 * unfinished state, and bounded incremental transcript caching keeps session
 * APIs safe.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const { updatePlanArgumentIndexes } = require("./codex-plan-call");

// One entry per transcript file, main and subagent alike. A single session
// can have several hundred subagent files, and a list request touches up to
// 100 sessions, so a small cap evicts everything between requests and every
// parse runs cold. An entry holds only the task observations and pending
// task calls inside its 32 MiB window (measured: 285 real files in under
// 1 MB), so 4000 entries are cheap for real transcripts.
const MAX_CACHE_ENTRIES = 4000;
const MAX_ITEMS = 200;
const MAX_TEXT = 500;
const MAX_LINE_BYTES = 16 * 1024 * 1024;
const MAX_SCAN_BYTES = 32 * 1024 * 1024;
const READ_CHUNK_BYTES = 1024 * 1024;
// How long a parse of a since-grown transcript may be served from cache. The
// size+mtime cache key can never hit while a file is being appended to, so
// without this floor a burst of list requests (e.g. the dashboard reloading on
// every hook-driven WebSocket event) can parse each closely spaced append.
// Task summaries tolerate a couple seconds of staleness.
// Tunable via DASHBOARD_TASK_SUMMARY_TTL_MS; 0 disables the floor (every
// append is parsed immediately). Read lazily so tests
// and operators can adjust it without a restartable module-load dependency.
const FRESH_PARSE_TTL_MS = 2_000;
function freshParseTtlMs() {
  const raw = process.env.DASHBOARD_TASK_SUMMARY_TTL_MS;
  // Trim first: Number(" ") is 0, which would silently DISABLE stale reuse
  // for a whitespace-only value instead of applying the documented default.
  const trimmed = typeof raw === "string" ? raw.trim() : raw;
  if (trimmed === undefined || trimmed === "") return FRESH_PARSE_TTL_MS;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : FRESH_PARSE_TTL_MS;
}
const cache = new Map();
const RESET_ALL_EVENT_TYPES = new Set(["UserPromptSubmit"]);
const FINALIZE_ALL_EVENT_TYPES = new Set(["Stop", "SessionEnd", "Interrupted"]);

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

function normalizeStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["completed", "complete", "done", "success", "succeeded"].includes(status)) {
    return "completed";
  }
  if (["in_progress", "active", "working", "started", "running"].includes(status)) {
    return "in_progress";
  }
  if (["pending", "todo", "queued", "not_started", "open"].includes(status)) {
    return "pending";
  }
  if (["cancelled", "canceled", "deleted", "removed", "skipped"].includes(status)) {
    return "cancelled";
  }
  return "unknown";
}

function objectValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseDataLiteral(source, startIndex) {
  let index = startIndex;

  function skipWhitespace() {
    while (index < source.length && /\s/.test(source[index])) index++;
  }

  function parseString() {
    const quote = source[index++];
    let value = "";
    while (index < source.length) {
      const character = source[index++];
      if (character === quote) return value;
      if (character !== "\\") {
        value += character;
        continue;
      }
      if (index >= source.length) throw new Error("unterminated escape");
      const escaped = source[index++];
      const escapes = {
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
        v: "\v",
        0: "\0",
      };
      if (escaped === "u") {
        const hex = source.slice(index, index + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("invalid unicode escape");
        value += String.fromCharCode(parseInt(hex, 16));
        index += 4;
      } else {
        value += escapes[escaped] ?? escaped;
      }
    }
    throw new Error("unterminated string");
  }

  function parseIdentifier() {
    const match = source.slice(index).match(/^[A-Za-z_$][\w$]*/);
    if (!match) throw new Error("expected identifier");
    index += match[0].length;
    return match[0];
  }

  function parseValue() {
    skipWhitespace();
    const character = source[index];
    if (character === '"' || character === "'") return parseString();
    if (character === "{") return parseObject();
    if (character === "[") return parseArray();
    const numberMatch = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      index += numberMatch[0].length;
      return Number(numberMatch[0]);
    }
    const identifier = parseIdentifier();
    if (identifier === "true") return true;
    if (identifier === "false") return false;
    if (identifier === "null") return null;
    throw new Error("unsupported literal");
  }

  function parseObject() {
    const object = Object.create(null);
    index++;
    skipWhitespace();
    while (source[index] !== "}") {
      const key =
        source[index] === '"' || source[index] === "'" ? parseString() : parseIdentifier();
      skipWhitespace();
      if (source[index++] !== ":") throw new Error("expected colon");
      object[key] = parseValue();
      skipWhitespace();
      if (source[index] === ",") {
        index++;
        skipWhitespace();
        if (source[index] === "}") break;
        continue;
      }
      if (source[index] !== "}") throw new Error("expected object separator");
    }
    if (source[index++] !== "}") throw new Error("unterminated object");
    return object;
  }

  function parseArray() {
    const array = [];
    index++;
    skipWhitespace();
    while (source[index] !== "]") {
      array.push(parseValue());
      skipWhitespace();
      if (source[index] === ",") {
        index++;
        skipWhitespace();
        if (source[index] === "]") break;
        continue;
      }
      if (source[index] !== "]") throw new Error("expected array separator");
    }
    if (source[index++] !== "]") throw new Error("unterminated array");
    return array;
  }

  const value = parseValue();
  return { value, endIndex: index };
}

function wrappedUpdatePlan(value) {
  if (typeof value !== "string") return null;
  for (const argumentIndex of updatePlanArgumentIndexes(value)) {
    try {
      const parsed = parseDataLiteral(value, argumentIndex).value;
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.plan)) return parsed;
    } catch {
      /* keep searching for another well-formed call */
    }
  }
  return null;
}

function itemText(item) {
  if (!item || typeof item !== "object") return null;
  return cleanText(
    item.content ??
      item.text ??
      item.title ??
      item.subject ??
      item.step ??
      item.description ??
      item.activeForm ??
      item.active_form
  );
}

function itemId(item, fallback) {
  const value =
    item?.id ?? item?.taskId ?? item?.task_id ?? item?.taskID ?? item?.call_id ?? fallback;
  return cleanText(String(value || fallback || ""));
}

function normalizeItems(items, observation) {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, MAX_ITEMS)
    .map((item, index) => {
      if (typeof item === "string") {
        const text = cleanText(item);
        if (!text) return null;
        return {
          id: `${observation.ownerId}:${observation.tool}:${index}`,
          text,
          status: "unknown",
          sourceStatus: null,
          order: index,
          agentId: observation.ownerId,
          agentType: observation.ownerType,
          description: null,
        };
      }
      if (!item || typeof item !== "object") return null;
      const text = itemText(item);
      if (!text) return null;
      const rawStatus = item.status ?? item.state;
      return {
        id:
          itemId(item, `${observation.ownerId}:${observation.tool}:${index}`) ||
          `${observation.ownerId}:${observation.tool}:${index}`,
        text,
        status: normalizeStatus(rawStatus),
        sourceStatus: rawStatus == null ? null : String(rawStatus),
        order: index,
        agentId: observation.ownerId,
        agentType: observation.ownerType,
        description: cleanText(item.description),
      };
    })
    .filter(Boolean);
}

function listFromObject(value) {
  if (Array.isArray(value)) return value;
  const object = objectValue(value);
  if (!object) return null;
  for (const key of ["plan", "todos", "tasks", "items"]) {
    if (Array.isArray(object[key])) return object[key];
  }
  if (object.task && typeof object.task === "object") return [object.task];
  return null;
}

function taskFromObject(value) {
  const object = objectValue(value);
  if (!object) return null;
  if (object.task && typeof object.task === "object") return object.task;
  return object;
}

function parseToolInput(value) {
  return objectValue(value) || {};
}

function makeObservation({
  kind,
  tool,
  timestamp,
  line,
  ownerId,
  ownerType,
  items,
  task,
  explanation,
  confidence = "full",
}) {
  return {
    kind,
    tool,
    timestamp: timestamp || null,
    line: line || null,
    ownerId: ownerId || "main",
    ownerType: ownerType || (ownerId === "main" ? "main" : "subagent"),
    items: items || null,
    task: task || null,
    explanation: cleanText(explanation),
    confidence,
  };
}

function claudeTurnBoundary(entry, context) {
  if (entry?.isMeta === true || entry?.isCompactSummary === true) return null;
  let text = null;
  if (entry?.type === "attachment") {
    const attachment = entry.attachment;
    if (attachment?.type !== "queued_command") return null;
    text = typeof attachment.prompt === "string" ? attachment.prompt : null;
    const kind =
      attachment.origin && typeof attachment.origin.kind === "string"
        ? attachment.origin.kind
        : null;
    if (kind !== null && kind !== "human") return null;
  } else if (entry?.type === "user") {
    const content = entry?.message?.content;
    text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.find((block) => block?.type === "text")?.text
          : null;
  } else {
    return null;
  }
  const lead = String(text || "").trimStart();
  if (!lead) return null;
  if (lead.startsWith("<task-notification") || lead.startsWith("[SYSTEM NOTIFICATION")) {
    return null;
  }
  return makeObservation({
    ...context,
    kind: context.ownerType === "main" ? "reset_all" : "reset_owner",
    tool: null,
  });
}

function toolObservation(name, inputValue, outputValue, context) {
  const tool = String(name || "");
  const wrappedPlan = tool === "exec" ? wrappedUpdatePlan(inputValue) : null;
  if (wrappedPlan) {
    return makeObservation({
      ...context,
      kind: "replace",
      tool: "update_plan",
      items: wrappedPlan.plan,
      explanation: wrappedPlan.explanation,
    });
  }
  const input = parseToolInput(inputValue);
  const output = objectValue(outputValue);
  if (tool === "TodoWrite") {
    const items = listFromObject(input);
    if (!items) return null;
    return makeObservation({ ...context, kind: "replace", tool, items });
  }
  if (tool === "update_plan" || tool === "tools.update_plan") {
    const items = listFromObject(input);
    if (!items) return null;
    return makeObservation({
      ...context,
      kind: "replace",
      tool: "update_plan",
      items,
      explanation: input.explanation,
    });
  }
  if (tool === "TaskList") {
    const items = listFromObject(outputValue) || listFromObject(input);
    if (!items) return null;
    return makeObservation({ ...context, kind: "replace", tool, items });
  }
  if (tool === "TaskCreate") {
    const task = { ...input, ...(taskFromObject(output) || {}) };
    if (!itemText(task)) return null;
    return makeObservation({ ...context, kind: "upsert", tool, task, confidence: "partial" });
  }
  if (tool === "TaskUpdate") {
    const task = { ...input, ...(taskFromObject(output) || {}) };
    if (!itemId(task, null)) return null;
    return makeObservation({ ...context, kind: "upsert", tool, task, confidence: "partial" });
  }
  if (tool === "TaskGet") {
    const task = taskFromObject(output) || taskFromObject(input);
    if (!task || !itemId(task, null)) return null;
    return makeObservation({ ...context, kind: "upsert", tool, task, confidence: "partial" });
  }
  return null;
}

const TASK_OBSERVATION_PROBE_OUTPUT = {
  task: { id: "task-progress-probe", subject: "Task progress probe" },
  tasks: [{ id: "task-progress-probe", subject: "Task progress probe" }],
};

function canProduceTaskObservation(name, inputValue) {
  // Ask the parser itself so pending-call eligibility cannot drift from the
  // tools and wrapped calls that can actually yield task observations.
  return Boolean(
    toolObservation(name, inputValue, TASK_OBSERVATION_PROBE_OUTPUT, {
      ownerId: "main",
      ownerType: "main",
    })
  );
}

function observationsFromEntry(entry, line, owner) {
  const observations = [];
  const timestamp = entry?.timestamp || null;
  const context = {
    timestamp,
    line,
    ownerId: owner.id,
    ownerType: owner.type,
  };

  if (entry?.type === "response_item") {
    const payload = entry.payload || {};
    if (payload.type === "function_call" || payload.type === "custom_tool_call") {
      const observation = toolObservation(
        payload.name,
        payload.arguments ?? payload.input,
        null,
        context
      );
      if (observation) observations.push(observation);
    }
    return observations;
  }

  if (entry?.type === "event_msg" && entry?.payload?.type === "task_started") {
    observations.push(makeObservation({ ...context, kind: "reset_all", tool: null }));
    return observations;
  }
  if (
    entry?.type === "event_msg" &&
    ["task_complete", "turn_aborted"].includes(entry?.payload?.type)
  ) {
    observations.push(makeObservation({ ...context, kind: "finalize_all", tool: null }));
    return observations;
  }
  if (entry?.type === "system" && ["stop_hook_summary", "turn_duration"].includes(entry?.subtype)) {
    observations.push(
      makeObservation({
        ...context,
        kind: context.ownerType === "main" ? "finalize_all" : "finalize_owner",
        tool: null,
      })
    );
    return observations;
  }

  const turnBoundary = claudeTurnBoundary(entry, context);
  if (turnBoundary) observations.push(turnBoundary);

  const content = entry?.message?.content;
  if (!Array.isArray(content)) return observations;
  const outputs = new Map();
  for (const block of content) {
    if (block?.type !== "tool_result") continue;
    outputs.set(
      block.tool_use_id || block.id,
      block.content ?? block.output ?? entry.toolUseResult
    );
  }
  for (const block of content) {
    if (block?.type !== "tool_use") continue;
    const observation = toolObservation(block.name, block.input, outputs.get(block.id), context);
    if (observation) observations.push(observation);
  }

  if (
    entry?.type === "user" &&
    entry.toolUseResult !== undefined &&
    content.some((block) => block?.type === "tool_result")
  ) {
    for (const block of content) {
      if (block?.type !== "tool_result") continue;
      observations.push(
        makeObservation({
          ...context,
          kind: "result",
          tool: null,
          task: {
            callId: block.tool_use_id || block.id,
            output: entry.toolUseResult ?? block.content,
          },
        })
      );
    }
  }
  return observations;
}

function parseFileLines(
  filePath,
  onLine,
  { maxBytes = MAX_SCAN_BYTES, tail = false, start = 0, lineNumber = 0, end } = {}
) {
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
  let pending = Buffer.alloc(0);
  const fileSize = Math.min(fs.fstatSync(descriptor).size, end ?? Number.MAX_SAFE_INTEGER);
  const boundedBytes = Math.max(0, Math.min(fileSize, maxBytes));
  let position = tail ? fileSize - boundedBytes : Math.max(0, Math.min(start, fileSize));
  const endPosition = tail ? fileSize : Math.min(fileSize, position + boundedBytes);
  let skipPartialLine = false;
  if (tail && position > 0) {
    const previousByte = Buffer.allocUnsafe(1);
    skipPartialLine =
      fs.readSync(descriptor, previousByte, 0, previousByte.length, position - 1) === 1 &&
      previousByte[0] !== 0x0a;
  }
  // A tail scan may begin inside an incomplete line. Until its newline is
  // found, zero is the only earlier byte position known to be a boundary.
  let completeOffset = skipPartialLine ? 0 : position;
  let lineByte = position;
  let discardLongLine = false;
  try {
    while (position < endPosition) {
      const bytesToRead = Math.min(buffer.length, endPosition - position);
      const bytesRead = fs.readSync(descriptor, buffer, 0, bytesToRead, position);
      if (bytesRead <= 0) break;
      position += bytesRead;
      let chunk = buffer.subarray(0, bytesRead);
      if (pending.length) chunk = Buffer.concat([pending, chunk]);
      const chunkPosition = position - chunk.length;
      let start = 0;
      for (let index = 0; index < chunk.length; index++) {
        if (chunk[index] !== 0x0a) continue;
        const currentLineByte = lineByte;
        completeOffset = chunkPosition + index + 1;
        lineByte = completeOffset;
        if (skipPartialLine) {
          skipPartialLine = false;
          discardLongLine = false;
          start = index + 1;
          continue;
        }
        lineNumber++;
        if (discardLongLine || index - start > MAX_LINE_BYTES) {
          discardLongLine = false;
          onLine("", lineNumber, currentLineByte);
          start = index + 1;
          continue;
        }
        const keepGoing = onLine(
          chunk.toString("utf8", start, index).replace(/\r$/, ""),
          lineNumber,
          currentLineByte
        );
        start = index + 1;
        if (keepGoing === false) return completeOffset;
      }
      pending = chunk.subarray(start);
      if (pending.length > MAX_LINE_BYTES) {
        pending = Buffer.alloc(0);
        discardLongLine = true;
      } else {
        pending = Buffer.from(pending);
      }
    }
    // A trailing fragment is either a record still being written or a file
    // whose last record has no newline (imports, copies). Parse it as
    // provisional: the caller sees it now, but the returned offset stays at
    // the last complete line so the next call re-reads it.
    if (pending.length && !skipPartialLine && !discardLongLine) {
      onLine(pending.toString("utf8").replace(/\r$/, ""), lineNumber + 1, lineByte, true);
    }
    return completeOffset;
  } finally {
    fs.closeSync(descriptor);
  }
}

function cacheSet(key, value) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

function parseTranscript(filePath, owner) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return [];
  }
  const key = `${filePath}:${owner.id}:${owner.type}`;
  const cached = cache.get(key);
  // `dev`+`ino` identify the actual inode, so a DIFFERENT file rotated in at
  // the same path can never be served from the previous file's parse — neither
  // through the TTL window nor through a size+mtime collision. The serve-stale
  // branch additionally refuses a shrunken file: transcripts are append-only,
  // so a smaller size means truncation or replacement and the cached
  // observations no longer describe it.
  const sameFile =
    cached && (cached.dev === undefined || (cached.dev === stat.dev && cached.ino === stat.ino));
  if (
    cached &&
    sameFile &&
    ((cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) ||
      (stat.size >= cached.size && Date.now() - cached.parsedAt < freshParseTtlMs()))
  ) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.observations;
  }
  // Compare against the cached size, not the cached line-boundary offset: a
  // same-inode rewrite that lands between the two would otherwise reuse
  // observations from content that no longer exists.
  const canIncrement =
    cached && sameFile && stat.size >= cached.size && stat.size - cached.offset <= MAX_SCAN_BYTES;
  const windowStart = Math.max(0, stat.size - MAX_SCAN_BYTES);
  // Invariant: retained incremental state is exactly the state a fresh parse
  // of the current byte window could produce. Calls or observations before
  // the window cannot affect lines that remain inside it.
  // State at or past the cached offset came from a provisional trailing
  // fragment; it is re-read below, so drop it here to avoid double counting.
  const retained = (item) =>
    item._byte >= windowStart && (!canIncrement || item._byte < cached.offset);
  const observations = canIncrement ? cached.observations.filter(retained) : [];
  const pendingCalls = canIncrement
    ? new Map([...cached.pendingCalls].filter(([, call]) => retained(call)))
    : new Map();
  const start = canIncrement ? cached.offset : 0;
  // sourceLine is relative to the scanned range. Incremental parses continue
  // cached line positions, while a cold tail parse restarts them at one.
  let lineNumber = canIncrement ? cached.lineNumber : 0;
  let offset;
  try {
    offset = parseFileLines(
      filePath,
      (line, currentLineNumber, lineByteOffset, partial = false) => {
        if (!partial) lineNumber = currentLineNumber;
        if (!line || lineByteOffset < windowStart) return;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          return;
        }
        const direct = observationsFromEntry(entry, currentLineNumber, owner);
        for (const observation of direct) {
          if (observation.kind === "result") {
            const call = pendingCalls.get(observation.task.callId);
            if (!call) continue;
            const enriched = toolObservation(call.tool, call.input, observation.task.output, {
              timestamp: observation.timestamp || call.timestamp,
              line: observation.line,
              ownerId: owner.id,
              ownerType: owner.type,
            });
            if (enriched) observations.push({ ...enriched, _byte: call._byte });
            pendingCalls.delete(observation.task.callId);
            continue;
          }
          observations.push({ ...observation, _byte: lineByteOffset });
        }

        const blocks = entry?.message?.content;
        if (!Array.isArray(blocks)) return;
        for (const block of blocks) {
          if (
            block?.type === "tool_use" &&
            block.id &&
            canProduceTaskObservation(block.name, block.input)
          ) {
            pendingCalls.set(block.id, {
              tool: block.name,
              input: block.input,
              timestamp: entry.timestamp || null,
              _byte: lineByteOffset,
            });
          }
        }
      },
      canIncrement
        ? { start, lineNumber, maxBytes: stat.size - start, end: stat.size }
        : { tail: true, end: stat.size }
    );
  } catch {
    return [];
  }
  const retainedObservations = observations.filter(
    (observation) => observation._byte >= windowStart
  );
  for (const [callId, call] of pendingCalls) {
    if (call._byte < windowStart) pendingCalls.delete(callId);
  }
  cacheSet(key, {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    dev: stat.dev,
    ino: stat.ino,
    parsedAt: Date.now(),
    offset,
    lineNumber,
    pendingCalls,
    observations: retainedObservations,
  });
  return retainedObservations;
}

function observationFromEvent(event, agentsById) {
  if (!event) return null;
  const data = objectValue(event.data) || {};
  const agent = agentsById.get(event.agent_id);
  const context = {
    tool: null,
    timestamp: event.created_at,
    ownerId: event.agent_id || "main",
    ownerType:
      agent?.type === "main"
        ? "main"
        : agent?.subagent_type || data.agent_type || data.teammate_name || "subagent",
  };
  if (RESET_ALL_EVENT_TYPES.has(event.event_type)) {
    return makeObservation({ ...context, kind: "reset_all" });
  }
  if (FINALIZE_ALL_EVENT_TYPES.has(event.event_type)) {
    return makeObservation({ ...context, kind: "finalize_all" });
  }
  if (event.event_type === "SubagentStop") {
    return makeObservation({ ...context, kind: "finalize_owner" });
  }
  if (!["TaskCreated", "TaskCompleted"].includes(event.event_type)) return null;
  const rawStatus = event.event_type === "TaskCompleted" ? "completed" : data.status || "pending";
  const task = {
    id: data.task_id,
    subject: data.task_subject || event.summary,
    description: data.task_description,
    status: rawStatus,
  };
  if (!itemText(task) || !itemId(task, null)) return null;
  return makeObservation({
    kind: "upsert",
    tool: event.event_type,
    timestamp: event.created_at,
    ownerId: event.agent_id || "main",
    ownerType: context.ownerType,
    task,
    confidence: "partial",
  });
}

// A JSONL transcript is append-only, so its first timestamp never changes —
// cache it per path. Without this, every list request re-opens (with a 1 MiB
// read buffer) every discovered subagent file just to re-read line one. A hit
// still pays one statSync: a file whose size SHRANK was truncated or replaced
// at the same path, so the cached first line no longer applies and the entry
// is dropped. Growth keeps the hit — appends cannot change line one.
const timestampCache = new Map();
const MAX_TIMESTAMP_CACHE_ENTRIES = 2_000;

function transcriptTimestamp(filePath) {
  let stat = null;
  try {
    stat = fs.statSync(filePath);
  } catch {
    timestampCache.delete(filePath);
    return null;
  }
  const size = stat.size;
  const cached = timestampCache.get(filePath);
  if (cached) {
    // Growth alone is not proof of identity: a replacement file at the same
    // path can be the same size or larger, and its first line may differ. Pin
    // the entry to the inode (dev+ino) as well, so only a genuine append to
    // the SAME file keeps the cached first-line timestamp.
    const sameFile = cached.dev === stat.dev && cached.ino === stat.ino;
    if (sameFile && size >= cached.size) return cached.timestamp;
    timestampCache.delete(filePath);
  }
  let timestamp = null;
  try {
    parseFileLines(filePath, (line) => {
      if (!line) return;
      try {
        timestamp = JSON.parse(line).timestamp || null;
      } catch {
        /* ignore */
      }
      if (timestamp) return false;
    });
  } catch {
    return null;
  }
  // Only a found timestamp is immutable; a file with none yet may gain one.
  if (timestamp) {
    timestampCache.set(filePath, { timestamp, size, dev: stat.dev, ino: stat.ino });
    while (timestampCache.size > MAX_TIMESTAMP_CACHE_ENTRIES) {
      timestampCache.delete(timestampCache.keys().next().value);
    }
  }
  return timestamp;
}

function readMeta(filePath) {
  const metaPath = filePath.replace(/\.jsonl$/, ".meta.json");
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch {
    return {};
  }
}

function discoverSubagentFiles(mainTranscriptPath, sessionId) {
  if (!mainTranscriptPath) return [];
  const directory = path.dirname(mainTranscriptPath);
  const candidates = [
    path.join(directory, sessionId, "subagents"),
    path.join(directory, "subagents", sessionId),
  ];
  const files = [];
  for (const candidate of candidates) {
    try {
      for (const entry of fs.readdirSync(candidate, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        if (entry.name.startsWith("agent-acompact-")) continue;
        files.push(path.join(candidate, entry.name));
      }
    } catch {
      /* ignore */
    }
  }
  return files;
}

function mapSubagentOwners(files, agents) {
  const availableAgents = (agents || [])
    .filter((agent) => agent.type === "subagent")
    .sort((left, right) =>
      String(left.started_at || "").localeCompare(String(right.started_at || ""))
    );
  const used = new Set();
  return files
    .map((filePath) => {
      const shortId = path
        .basename(filePath)
        .replace(/^agent-/, "")
        .replace(/\.jsonl$/, "");
      const meta = readMeta(filePath);
      let agent = availableAgents.find(
        (candidate) =>
          !used.has(candidate.id) &&
          (candidate.id === shortId ||
            candidate.id.endsWith(shortId) ||
            candidate.id.includes(`jsonl-${shortId}`))
      );
      if (!agent && meta.agentType) {
        agent = availableAgents.find(
          (candidate) => !used.has(candidate.id) && candidate.subagent_type === meta.agentType
        );
      }
      if (!agent) agent = availableAgents.find((candidate) => !used.has(candidate.id));
      if (agent) used.add(agent.id);
      return {
        filePath,
        timestamp: transcriptTimestamp(filePath),
        owner: {
          id: agent?.id || shortId,
          type: agent?.subagent_type || meta.agentType || meta.description || "subagent",
        },
      };
    })
    .sort((left, right) =>
      String(left.timestamp || "").localeCompare(String(right.timestamp || ""))
    );
}

function observationTime(observation, index) {
  const parsed = Date.parse(observation.timestamp || "");
  return Number.isFinite(parsed) ? parsed : index;
}

function ownerStateIsFinished(state) {
  return (
    state.items.size > 0 &&
    [...state.items.values()].every((item) => ["completed", "cancelled"].includes(item.status))
  );
}

function applyObservation(ownerStates, observation) {
  const ownerKey = observation.ownerId || "main";
  if (observation.kind === "reset_all") {
    ownerStates.clear();
    return;
  }
  if (observation.kind === "reset_owner") {
    ownerStates.delete(ownerKey);
    return;
  }
  if (observation.kind === "finalize_all") {
    for (const [key, state] of ownerStates) {
      if (!ownerStateIsFinished(state)) ownerStates.delete(key);
    }
    return;
  }
  if (observation.kind === "finalize_owner") {
    const state = ownerStates.get(ownerKey);
    if (state && !ownerStateIsFinished(state)) ownerStates.delete(ownerKey);
    return;
  }
  let state = ownerStates.get(ownerKey);
  if (!state) {
    state = {
      ownerId: ownerKey,
      ownerType: observation.ownerType || "main",
      items: new Map(),
      order: [],
      sourceTool: observation.tool,
      sourceLine: observation.line,
      updatedAt: observation.timestamp,
      explanation: observation.explanation,
      confidence: observation.confidence,
    };
    ownerStates.set(ownerKey, state);
  }
  state.ownerType = observation.ownerType || state.ownerType;
  state.sourceTool = observation.tool || state.sourceTool;
  state.sourceLine = observation.line || state.sourceLine;
  state.updatedAt = observation.timestamp || state.updatedAt;
  state.explanation = observation.explanation || state.explanation;

  if (observation.kind === "replace") {
    state.confidence = observation.confidence;
    state.items.clear();
    state.order = [];
    for (const item of normalizeItems(observation.items, observation)) {
      if (state.items.has(item.id)) continue;
      state.order.push(item.id);
      state.items.set(item.id, item);
    }
    return;
  }
  if (observation.confidence === "partial" && state.confidence !== "full") {
    state.confidence = "partial";
  }
  if (observation.kind !== "upsert" || !observation.task) return;
  const task = observation.task;
  const id = itemId(task, null);
  if (!id) return;
  const existing = state.items.get(id);
  const text = itemText(task) || existing?.text;
  if (!text) return;
  const rawStatus = task.status ?? task.state;
  const status = rawStatus == null ? existing?.status || "pending" : normalizeStatus(rawStatus);
  const item = {
    id,
    text,
    status,
    sourceStatus: rawStatus == null ? existing?.sourceStatus || null : String(rawStatus),
    order: existing?.order ?? state.order.length,
    agentId: ownerKey,
    agentType: state.ownerType,
    description: cleanText(task.description) || existing?.description || null,
  };
  if (!existing) state.order.push(id);
  if (
    status === "cancelled" &&
    ["deleted", "removed"].includes(String(rawStatus || "").toLowerCase())
  ) {
    state.items.delete(id);
    state.order = state.order.filter((taskId) => taskId !== id);
  } else {
    state.items.set(id, item);
  }
}

function countItems(items) {
  const counts = {
    total: items.length,
    completed: 0,
    inProgress: 0,
    pending: 0,
    cancelled: 0,
    unknown: 0,
  };
  for (const item of items) {
    if (item.status === "completed") counts.completed++;
    else if (item.status === "in_progress") counts.inProgress++;
    else if (item.status === "pending") counts.pending++;
    else if (item.status === "cancelled") counts.cancelled++;
    else counts.unknown++;
  }
  return {
    ...counts,
    percentComplete: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : null,
  };
}

function buildSnapshot(provider, observations) {
  if (!observations.length) return null;
  const ownerStates = new Map();
  observations
    .map((observation, index) => ({ observation, index }))
    .sort(
      (left, right) =>
        observationTime(left.observation, left.index) -
        observationTime(right.observation, right.index)
    )
    .forEach(({ observation }) => applyObservation(ownerStates, observation));

  const items = [];
  const ownerBreakdown = [];
  for (const state of ownerStates.values()) {
    const ownerItems = state.order.map((id) => state.items.get(id)).filter(Boolean);
    if (!ownerItems.length) continue;
    const counts = countItems(ownerItems);
    if (ownerBreakdown.length < MAX_ITEMS) {
      ownerBreakdown.push({
        agentId: state.ownerId,
        agentType: state.ownerType,
        completed: counts.completed,
        total: counts.total,
      });
    }
    if (items.length < MAX_ITEMS) items.push(...ownerItems.slice(0, MAX_ITEMS - items.length));
  }
  if (!items.length) return null;
  const counts = countItems(items);
  const stateTime = (state) => {
    const parsed = Date.parse(state.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER;
  };
  const latest = [...ownerStates.values()]
    .filter((state) => state.items.size > 0)
    .sort((left, right) => stateTime(right) - stateTime(left))[0];
  return {
    provider: provider === "codex" ? "codex" : "claude",
    source: observations.some(
      (observation) => observation.line == null && ["replace", "upsert"].includes(observation.kind)
    )
      ? "mixed"
      : "transcript",
    sourceTool: latest?.sourceTool || null,
    sourceLine: latest?.sourceLine || null,
    updatedAt: latest?.updatedAt || null,
    explanation: latest?.explanation || null,
    confidence: [...ownerStates.values()].some((state) => state.confidence === "partial")
      ? "partial"
      : "full",
    items,
    ...counts,
    activeText: items.find((item) => item.status === "in_progress")?.text || null,
    includesSubagents: ownerBreakdown.some((owner) => owner.agentType !== "main"),
    ownerBreakdown,
  };
}

function summarizeSnapshot(snapshot) {
  if (!snapshot) return null;
  const previewItems = [...snapshot.items]
    .sort((left, right) => {
      const rank = { in_progress: 0, pending: 1, unknown: 2, completed: 3, cancelled: 4 };
      return rank[left.status] - rank[right.status] || left.order - right.order;
    })
    .slice(0, 5);
  return {
    total: snapshot.total,
    completed: snapshot.completed,
    inProgress: snapshot.inProgress,
    pending: snapshot.pending,
    cancelled: snapshot.cancelled,
    unknown: snapshot.unknown,
    percentComplete: snapshot.percentComplete,
    activeText: snapshot.activeText,
    sourceTool: snapshot.sourceTool,
    updatedAt: snapshot.updatedAt,
    previewItems,
    overflowCount: Math.max(0, snapshot.items.length - previewItems.length),
    ownerBreakdown: snapshot.ownerBreakdown,
  };
}

function extractSessionTaskProgress({
  session,
  agents = [],
  events = [],
  mainTranscriptPath = null,
}) {
  try {
    const mainAgent = agents.find((agent) => agent.type === "main");
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const observations = [];
    if (mainTranscriptPath) {
      observations.push(
        ...parseTranscript(mainTranscriptPath, {
          id: mainAgent?.id || "main",
          type: "main",
        })
      );
      if (session.provider !== "codex") {
        for (const source of mapSubagentOwners(
          discoverSubagentFiles(mainTranscriptPath, session.id),
          agents
        )) {
          observations.push(...parseTranscript(source.filePath, source.owner));
        }
      }
    }
    for (const event of events) {
      const observation = observationFromEvent(event, agentsById);
      if (observation) observations.push(observation);
    }
    const snapshot = buildSnapshot(session.provider, observations);
    return { snapshot, summary: summarizeSnapshot(snapshot) };
  } catch {
    return { snapshot: null, summary: null };
  }
}

function clearTaskProgressCache() {
  cache.clear();
  timestampCache.clear();
}

module.exports = {
  normalizeStatus,
  extractSessionTaskProgress,
  summarizeSnapshot,
  clearTaskProgressCache,
};
