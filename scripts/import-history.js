#!/usr/bin/env node

/**
 * Import legacy Claude Code sessions from ~/.claude/ into the Agent Dashboard.
 * Reads per-project JSONL session files to populate sessions, agents, and
 * token usage that existed before the dashboard was installed.
 *
 * Can be run standalone: node scripts/import-history.js [--dry-run] [--project <name>]
 * Also exported for auto-import on server startup.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {
  bucketKey,
  emptyBucket,
  extractUsageFields,
  normalizeSpeed,
  normalizeGeo,
  normalizeTier,
  accumulateBucket,
} = require("../server/lib/token-usage");

const {
  getClaudeHome,
  getProjectsDir,
  getTranscriptSnapshotDir,
} = require("../server/lib/claude-home");
const CLAUDE_DIR = getClaudeHome();
const PROJECTS_DIR = getProjectsDir();

/**
 * Snapshot an imported session's JSONL transcript (and its subagent
 * transcripts) into the dashboard's own data dir so the Conversation tab can
 * still render it after Claude Code rotates / deletes the original file in
 * ~/.claude/projects.
 *
 * The dashboard never stores conversation text in the database — the
 * Conversation tab reads the JSONL on demand. On startup we import metadata
 * from ~/.claude/projects, but Claude Code prunes old session files over time
 * (often leaving only a `.jsonl.wakatime` sidecar). When that happens the
 * session row survives but its transcript is gone → an empty Conversation tab.
 * Keeping a durable copy under <dataDir>/transcripts/ fixes that; the read
 * route prefers the live file and falls back to this snapshot.
 *
 * Re-snapshots when the source has grown (a live session that gained turns
 * since the last import). Best-effort and non-fatal.
 */
function snapshotTranscript(sourceJsonlPath, sessionId) {
  try {
    const srcMain = path.resolve(sourceJsonlPath);
    const snapDir = getTranscriptSnapshotDir();
    const destMain = path.join(snapDir, `${sessionId}.jsonl`);
    if (path.resolve(destMain) !== srcMain) {
      copyIfNewer(srcMain, destMain);
    }

    // Subagent transcripts live under `<sessionId>/subagents/agent-*.jsonl`.
    for (const subPath of findSessionSubagents(sourceJsonlPath)) {
      const destSub = path.join(snapDir, sessionId, "subagents", path.basename(subPath));
      if (path.resolve(destSub) === path.resolve(subPath)) continue;
      copyIfNewer(subPath, destSub);
    }

    // Workflow-tool inner-agent transcripts live nested at
    // `<sessionId>/subagents/workflows/<runId>/agent-*.jsonl`. Preserve the
    // `workflows/<runId>/` subpath so the read route resolves the snapshot the
    // same way it resolves the live nested file (see getSnapshotSubagentTranscriptPath).
    for (const sub of findSessionWorkflowSubagents(sourceJsonlPath)) {
      const destSub = path.join(snapDir, sessionId, "subagents", sub.rel);
      if (path.resolve(destSub) === path.resolve(sub.abs)) continue;
      copyIfNewer(sub.abs, destSub);
    }
  } catch {
    /* non-fatal: metadata import already succeeded */
  }
}

/**
 * Copy `src` to `dest` only when `dest` is missing or smaller than `src`
 * (i.e. the source grew). Creates parent dirs as needed.
 */
function copyIfNewer(src, dest) {
  let srcSize;
  try {
    srcSize = fs.statSync(src).size;
  } catch {
    return; // source vanished mid-import — nothing to copy
  }
  let destSize = -1;
  try {
    destSize = fs.statSync(dest).size;
  } catch {
    /* dest missing */
  }
  if (destSize >= srcSize) return; // snapshot already at least as complete
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * Parse a single JSONL session file to extract session metadata.
 */
async function parseSessionFile(filePath) {
  const sessionId = path.basename(filePath, ".jsonl");

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let cwd = null;
  let model = null;
  let version = null;
  let slug = null;
  let gitBranch = null;
  let firstTimestamp = null;
  let lastTimestamp = null;
  const teams = new Set();
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  const tokensByModel = {};
  const messageTimestamps = [];
  const toolUses = [];
  const compactions = [];
  const apiErrors = [];
  const turnDurations = [];
  let entrypoint = null;
  let permissionMode = null;
  let thinkingBlockCount = 0;
  const toolResultErrors = [];
  const usageExtras = { service_tiers: new Set(), speeds: new Set(), inference_geos: new Set() };
  // Human-readable session title: custom-title (explicit /rename, claude -n)
  // takes precedence over ai-title (auto-generated). Both are append-only
  // metadata lines, so the last value seen wins.
  let customTitle = null;
  let aiTitle = null;

  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.type === "custom-title" && typeof entry.customTitle === "string") {
      if (entry.customTitle.trim()) customTitle = entry.customTitle.trim();
      continue;
    }
    if (entry.type === "ai-title" && typeof entry.aiTitle === "string") {
      if (entry.aiTitle.trim()) aiTitle = entry.aiTitle.trim();
      continue;
    }

    if (entry.isCompactSummary) {
      compactions.push({ uuid: entry.uuid || null, timestamp: entry.timestamp || null });
    }

    // Turn duration tracking
    if (entry.type === "system" && entry.subtype === "turn_duration" && entry.durationMs) {
      const turnTs = entry.timestamp
        ? typeof entry.timestamp === "number"
          ? new Date(entry.timestamp).toISOString()
          : entry.timestamp
        : null;
      turnDurations.push({ durationMs: entry.durationMs, timestamp: turnTs });
    }

    // Detect API errors: isApiErrorMessage entries (quota limits, rate limits, invalid_request)
    if (entry.isApiErrorMessage) {
      const errContent = Array.isArray(entry.message?.content) ? entry.message.content : [];
      const errText = errContent[0]?.text ? errContent[0].text.slice(0, 500) : "Unknown error";
      apiErrors.push({
        type: entry.error || "unknown_error",
        message: errText,
        timestamp: entry.timestamp
          ? typeof entry.timestamp === "number"
            ? new Date(entry.timestamp).toISOString()
            : entry.timestamp
          : null,
      });
    }
    // Also detect raw API error responses (type: "error" at message level)
    const rawMsg = entry.message || entry;
    if (rawMsg.type === "error" && rawMsg.error) {
      apiErrors.push({
        type: rawMsg.error.type || "unknown_error",
        message: rawMsg.error.message || "Unknown API error",
        timestamp: entry.timestamp
          ? typeof entry.timestamp === "number"
            ? new Date(entry.timestamp).toISOString()
            : entry.timestamp
          : null,
      });
    }

    if (!cwd && entry.cwd) cwd = entry.cwd;
    if (!slug && entry.slug) slug = entry.slug;
    if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch;
    if (!version && entry.version) version = entry.version;
    if (!entrypoint && entry.entrypoint) entrypoint = entry.entrypoint;
    if (!permissionMode && entry.permissionMode) permissionMode = entry.permissionMode;

    const ts = entry.timestamp;
    if (ts) {
      const isoTs = typeof ts === "number" ? new Date(ts).toISOString() : ts;
      if (!firstTimestamp || isoTs < firstTimestamp) firstTimestamp = isoTs;
      if (!lastTimestamp || isoTs > lastTimestamp) lastTimestamp = isoTs;
    }

    if (entry.teamName) teams.add(entry.teamName);

    if (entry.type === "user") {
      userMessageCount++;
      if (
        entry.toolUseResult &&
        typeof entry.toolUseResult === "object" &&
        entry.toolUseResult.is_error
      ) {
        const content =
          typeof entry.toolUseResult.content === "string"
            ? entry.toolUseResult.content.slice(0, 500)
            : JSON.stringify(entry.toolUseResult.content || "").slice(0, 500);
        const errTs = entry.timestamp
          ? typeof entry.timestamp === "number"
            ? new Date(entry.timestamp).toISOString()
            : entry.timestamp
          : null;
        toolResultErrors.push({ content, timestamp: errTs });
      }
    }
    if (entry.type === "assistant") {
      assistantMessageCount++;
      const isoTs = ts ? (typeof ts === "number" ? new Date(ts).toISOString() : ts) : null;
      if (isoTs) messageTimestamps.push(isoTs);
      const msg = entry.message || {};
      const msgModel = msg.model || null;
      if (!model && msgModel && msgModel !== "<synthetic>") model = msgModel;
      if (msgModel && msgModel !== "<synthetic>" && msg.usage) {
        const usage = msg.usage;
        const key = bucketKey(
          msgModel,
          normalizeSpeed(usage),
          normalizeGeo(usage),
          normalizeTier(usage)
        );
        if (tokensByModel[key] === undefined) {
          tokensByModel[key] = emptyBucket(
            msgModel,
            normalizeSpeed(usage),
            normalizeGeo(usage),
            normalizeTier(usage)
          );
        }
        accumulateBucket(tokensByModel[key], extractUsageFields(usage));
      }
      if (msg.usage) {
        if (msg.usage.service_tier) usageExtras.service_tiers.add(msg.usage.service_tier);
        if (msg.usage.speed) usageExtras.speeds.add(msg.usage.speed);
        if (msg.usage.inference_geo && msg.usage.inference_geo !== "not_available")
          usageExtras.inference_geos.add(msg.usage.inference_geo);
      }
      // Extract tool_use names from assistant message content
      const content = msg.content || [];
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            toolUses.push({
              name: block.name,
              timestamp: isoTs || firstTimestamp,
              input: block.input || null,
            });
          }
          if (block.type === "thinking") thinkingBlockCount++;
        }
      }
    }
  }

  if (!firstTimestamp) return null;

  const projectName = cwd ? path.basename(cwd) : slug || `Session ${sessionId.slice(0, 8)}`;
  // Prefer the real session title (custom > ai) when the transcript carries
  // one; otherwise fall back to a cwd/slug-derived label. The hook ingestor
  // applies the same precedence live, so imported and active names agree.
  const fallbackName = slug
    ? `${projectName} (${slug})`
    : `${projectName} - ${sessionId.slice(0, 8)}`;
  const sessionName = customTitle || aiTitle || fallbackName;

  // Check if the JSONL file was recently modified — indicates a possibly-active session
  let fileModifiedAt = null;
  try {
    const stat = fs.statSync(filePath);
    fileModifiedAt = stat.mtimeMs;
  } catch {
    // non-fatal
  }

  return {
    sessionId,
    name: sessionName,
    customTitle,
    aiTitle,
    cwd,
    model,
    version,
    slug,
    gitBranch,
    // The transcript's own path, so importSession can persist it on the session
    // row. Without this, imported sessions have transcript_path = NULL and the
    // abandon sweep, compaction scanner, and per-agent cost backfill can't find
    // their transcript. (Live/hook sessions get it from the hook payload.)
    transcriptPath: filePath,
    startedAt: firstTimestamp,
    endedAt: lastTimestamp,
    teams: [...teams],
    userMessages: userMessageCount,
    assistantMessages: assistantMessageCount,
    tokensByModel,
    messageTimestamps,
    toolUses,
    compactions,
    apiErrors,
    fileModifiedAt,
    turnDurations,
    entrypoint,
    permissionMode,
    thinkingBlockCount,
    toolResultErrors,
    usageExtras: {
      service_tiers: [...usageExtras.service_tiers],
      speeds: [...usageExtras.speeds],
      inference_geos: [...usageExtras.inference_geos],
    },
  };
}

/**
 * Parse a single subagent JSONL file for agent metadata, tokens, tools, timing.
 */
async function parseSubagentFile(filePath) {
  const agentId = path.basename(filePath, ".jsonl").replace(/^agent-/, "");

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let task = null;
  let model = null;
  let agentType = null;
  let firstTimestamp = null;
  let lastTimestamp = null;
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  const tokensByModel = {};
  const toolNames = new Set();
  let thinkingBlockCount = 0;
  // Subagent tool calls aren't broadcast via hooks — they live only in this JSONL.
  // Walk the file pairing assistant tool_use blocks with the next matching tool_result
  // so the importer can emit Pre/PostToolUse events under the subagent's own agent_id.
  const toolCalls = []; // {id, name, input, timestamp}
  const toolResults = new Map(); // tool_use_id → {content, is_error, timestamp}
  // agentIds of subagents THIS agent spawned via the Task tool. Claude Code
  // records the spawned child's id on the Task tool_result entry as
  // `toolUseResult.agentId`, which matches the child's `agent-<id>.jsonl` file.
  // Inverting these across a session reconstructs the real spawn hierarchy so
  // nested subagents nest under their spawner instead of flattening to main.
  const spawnedChildren = new Set();

  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    if (entry.toolUseResult && entry.toolUseResult.agentId) {
      spawnedChildren.add(entry.toolUseResult.agentId);
    }

    const ts = entry.timestamp;
    let isoTs = null;
    if (ts) {
      isoTs = typeof ts === "number" ? new Date(ts).toISOString() : ts;
      if (!firstTimestamp || isoTs < firstTimestamp) firstTimestamp = isoTs;
      if (!lastTimestamp || isoTs > lastTimestamp) lastTimestamp = isoTs;
    }

    if (entry.type === "user") {
      userMessageCount++;
      const msgContent = entry.message?.content;
      if (!task) {
        if (typeof msgContent === "string") {
          task = msgContent.slice(0, 500);
        } else if (Array.isArray(msgContent)) {
          const textBlock = msgContent.find((b) => b && b.type === "text");
          if (textBlock) task = (textBlock.text || "").slice(0, 500);
        }
      }
      if (Array.isArray(msgContent)) {
        for (const block of msgContent) {
          if (block && block.type === "tool_result" && block.tool_use_id) {
            toolResults.set(block.tool_use_id, {
              content: block.content,
              is_error: !!block.is_error,
              timestamp: isoTs,
            });
          }
        }
      }
    }

    if (entry.type === "assistant") {
      assistantMessageCount++;
      const msg = entry.message || {};
      const msgModel = msg.model || null;
      if (!model && msgModel && msgModel !== "<synthetic>") model = msgModel;
      if (msgModel && msgModel !== "<synthetic>" && msg.usage) {
        const usage = msg.usage;
        const key = bucketKey(
          msgModel,
          normalizeSpeed(usage),
          normalizeGeo(usage),
          normalizeTier(usage)
        );
        if (!tokensByModel[key]) {
          tokensByModel[key] = emptyBucket(
            msgModel,
            normalizeSpeed(usage),
            normalizeGeo(usage),
            normalizeTier(usage)
          );
        }
        accumulateBucket(tokensByModel[key], extractUsageFields(usage));
      }
      const content = msg.content || [];
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            toolNames.add(block.name);
            if (block.id) {
              toolCalls.push({
                id: block.id,
                name: block.name,
                input: block.input || null,
                timestamp: isoTs,
              });
            }
          }
          if (block.type === "thinking") thinkingBlockCount++;
        }
      }
    }

    // Try to get agentType from progress entries (hook data)
    if (entry.type === "progress" && entry.data?.hookEvent) {
      // Some subagent files don't have meta.json; this is fallback
    }
  }

  // Pair each tool_use with its tool_result (if any) into ordered tool events.
  const toolEvents = toolCalls.map((call) => {
    const result = toolResults.get(call.id) || null;
    return {
      tool_use_id: call.id,
      tool_name: call.name,
      tool_input: call.input,
      pre_timestamp: call.timestamp,
      tool_response: result ? result.content : null,
      is_error: result ? result.is_error : false,
      post_timestamp: result ? result.timestamp : null,
    };
  });

  if (!firstTimestamp) return null;

  // Try to read companion meta.json for agentType
  const metaPath = filePath.replace(/\.jsonl$/, ".meta.json");
  try {
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (meta.agentType) agentType = meta.agentType;
    }
  } catch {
    /* non-fatal */
  }

  return {
    agentId,
    agentType,
    task,
    model,
    startedAt: firstTimestamp,
    endedAt: lastTimestamp,
    userMessages: userMessageCount,
    assistantMessages: assistantMessageCount,
    tokensByModel,
    toolNames: [...toolNames],
    thinkingBlockCount,
    toolEvents,
    spawnedChildren: [...spawnedChildren],
  };
}

/**
 * Create compaction agents and events for a session.
 * Deduplicated by uuid — safe to call repeatedly.
 * Returns the number of compactions created.
 */
function importCompactions(dbModule, sessionId, mainAgentId, compactions) {
  if (!compactions || compactions.length === 0) return 0;
  const { db, stmts } = dbModule;
  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  let created = 0;
  for (let i = 0; i < compactions.length; i++) {
    const c = compactions[i];
    if (!c.uuid) continue;
    const compactId = `${sessionId}-compact-${c.uuid}`;
    if (stmts.getAgent.get(compactId)) continue;

    const ts = c.timestamp || new Date().toISOString();
    stmts.insertAgent.run(
      compactId,
      sessionId,
      "Context Compaction",
      "subagent",
      "compaction",
      "completed",
      "Automatic conversation context compression",
      mainAgentId,
      null
    );
    db.prepare("UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?").run(
      ts,
      ts,
      ts,
      compactId
    );

    const summary = `Context compacted - conversation history compressed (#${i + 1})`;
    insertEvent.run(
      sessionId,
      compactId,
      "Compaction",
      null,
      summary,
      JSON.stringify({
        uuid: c.uuid,
        timestamp: ts,
        compaction_number: i + 1,
        total_compactions: compactions.length,
        imported: true,
      }),
      ts
    );
    created++;
  }
  return created;
}

/**
 * Create subagent records from Agent tool_use blocks found during import.
 * Deduplicated by a deterministic ID derived from session + tool_use index.
 * Returns the number of subagents created.
 */
function importSubagents(dbModule, sessionId, mainAgentId, toolUses) {
  if (!toolUses || toolUses.length === 0) return 0;
  const { stmts } = dbModule;
  const insertEvent = dbModule.db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  let created = 0;
  let agentIndex = 0;

  for (const tu of toolUses) {
    if (tu.name !== "Agent" || !tu.input) continue;
    const input = tu.input;
    agentIndex++;

    const subId = `${sessionId}-subagent-${agentIndex}`;
    if (stmts.getAgent.get(subId)) continue;

    const rawName =
      input.description ||
      input.subagent_type ||
      (input.prompt ? input.prompt.split("\n")[0].slice(0, 60) : null) ||
      "Subagent";
    const subName = rawName.length > 60 ? rawName.slice(0, 57) + "..." : rawName;
    const ts = tu.timestamp || new Date().toISOString();

    stmts.insertAgent.run(
      subId,
      sessionId,
      subName,
      "subagent",
      input.subagent_type || null,
      "completed",
      input.prompt ? input.prompt.slice(0, 500) : null,
      mainAgentId,
      null
    );
    dbModule.db
      .prepare("UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?")
      .run(ts, ts, ts, subId);

    insertEvent.run(
      sessionId,
      subId,
      "PreToolUse",
      "Agent",
      `Subagent spawned: ${subName} (imported)`,
      JSON.stringify({ imported: true, subagent_type: input.subagent_type || null }),
      ts
    );
    created++;
  }
  return created;
}

/**
 * Create APIError events for errors found in JSONL transcripts (quota limits, etc.).
 * Deduplicated by summary+timestamp. Safe to call repeatedly.
 */
function importApiErrors(dbModule, sessionId, mainAgentId, apiErrors) {
  if (!apiErrors || apiErrors.length === 0) return 0;
  const { db } = dbModule;
  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  let created = 0;
  for (const err of apiErrors) {
    const summary = `${err.type}: ${err.message}`;
    const ts = err.timestamp || new Date().toISOString();
    const existing = db
      .prepare(
        "SELECT 1 FROM events WHERE session_id = ? AND event_type = 'APIError' AND summary = ? LIMIT 1"
      )
      .get(sessionId, summary);
    if (existing) continue;

    insertEvent.run(sessionId, mainAgentId, "APIError", null, summary, JSON.stringify(err), ts);
    created++;
  }
  return created;
}

/**
 * Truncate a JSON-serializable value so individual events stay reasonably sized.
 * Subagent tool_response payloads (file contents, command stdout) can run into
 * hundreds of KB — store a capped version with a `_truncated` marker.
 */
const SUBAGENT_EVENT_VALUE_CAP = 50_000; // chars in serialized form
function truncateForEvent(value) {
  if (value == null) return value;
  let serialized;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return null;
  }
  if (serialized.length <= SUBAGENT_EVENT_VALUE_CAP) return value;
  if (typeof value === "string") {
    return value.slice(0, SUBAGENT_EVENT_VALUE_CAP) + "\n…[truncated]";
  }
  return {
    _truncated: true,
    _original_length: serialized.length,
    preview: serialized.slice(0, SUBAGENT_EVENT_VALUE_CAP),
  };
}

/**
 * Find an existing live subagent (created via PreToolUse "Agent" hook) that
 * matches a JSONL transcript. Used to merge JSONL-extracted tool events into
 * the live subagent row instead of creating a duplicate row.
 *
 * Match heuristic: same session, same agentType, started within START_TOLERANCE_MS
 * of the JSONL's first timestamp, not already a JSONL-keyed row.
 */
const SUBAGENT_LIVE_MATCH_TOLERANCE_MS = 30_000;
function findLiveSubagentForJsonl(dbModule, sessionId, subData) {
  if (!subData.agentType || !subData.startedAt) return null;
  return dbModule.db
    .prepare(
      `SELECT id FROM agents
       WHERE session_id = ?
         AND type = 'subagent'
         AND subagent_type = ?
         AND id NOT LIKE ?
         AND ABS(CAST(strftime('%s', started_at) AS INTEGER) -
                 CAST(strftime('%s', ?) AS INTEGER)) <= ?
       ORDER BY ABS(CAST(strftime('%s', started_at) AS INTEGER) -
                    CAST(strftime('%s', ?) AS INTEGER)) ASC
       LIMIT 1`
    )
    .get(
      sessionId,
      subData.agentType,
      `${sessionId}-jsonl-%`,
      subData.startedAt,
      SUBAGENT_LIVE_MATCH_TOLERANCE_MS / 1000,
      subData.startedAt
    );
}

/**
 * Combine the parent session's tokensByModel with every parsed subagent's
 * tokensByModel. Subagents run in their own JSONL files with their own
 * `msg.usage` records, so their token consumption must be added to the parent
 * session's totals — otherwise cost calculations under-count any session that
 * spawned subagents (which is most non-trivial sessions).
 *
 * Returns a fresh object; inputs are not mutated.
 */
function combineSessionTokens(session) {
  const combined = {};
  const merge = (src) => {
    if (!src) return;
    for (const [key, tok] of Object.entries(src)) {
      if (!combined[key]) {
        combined[key] = emptyBucket(tok.model, tok.speed, tok.geo, tok.tier);
      }
      accumulateBucket(combined[key], tok);
    }
  };
  merge(session.tokensByModel);
  if (Array.isArray(session.parsedSubagents)) {
    for (const sub of session.parsedSubagents) merge(sub.tokensByModel);
  }
  return combined;
}

/**
 * Write a session's per-model token totals via replaceTokenUsage. Safe to call
 * repeatedly: the underlying SQL preserves the highest-seen value via the
 * baseline_* columns, so a re-run never reduces totals.
 */
function writeSessionTokens(dbModule, sessionId, tokensByModel) {
  const { stmts } = dbModule;
  let written = 0;
  for (const tokens of Object.values(tokensByModel || {})) {
    if (
      (tokens.input || 0) > 0 ||
      (tokens.output || 0) > 0 ||
      (tokens.cacheRead || 0) > 0 ||
      (tokens.cacheWrite || 0) > 0 ||
      (tokens.webSearch || 0) > 0 ||
      (tokens.webFetch || 0) > 0 ||
      (tokens.codeExec || 0) > 0
    ) {
      stmts.replaceTokenUsage.run(
        sessionId,
        tokens.model,
        tokens.speed,
        tokens.geo,
        tokens.tier,
        tokens.input || 0,
        tokens.output || 0,
        tokens.cacheRead || 0,
        tokens.cacheWrite || 0,
        tokens.cacheWrite1h || 0,
        tokens.webSearch || 0,
        tokens.webFetch || 0,
        tokens.codeExec || 0
      );
      written++;
    }
  }
  return written;
}

/**
 * Flatten a subagent's per-model token buckets (from parseSubagentFile) into the
 * row shape calculateCost() consumes, so a subagent's OWN cost can be recomputed
 * at read time with current pricing (never a stored, stale figure). Buckets with
 * no tokens at all are dropped to keep the stored metadata lean. This is what
 * lets the UI show a subagent's real cost instead of the whole session's total.
 */
function subagentTokenRows(tokensByModel) {
  const rows = [];
  for (const b of Object.values(tokensByModel || {})) {
    if (!b || !b.model) continue;
    const row = {
      model: b.model,
      speed: b.speed,
      inference_geo: b.geo,
      service_tier: b.tier,
      input_tokens: b.input || 0,
      output_tokens: b.output || 0,
      cache_read_tokens: b.cacheRead || 0,
      cache_write_tokens: b.cacheWrite || 0,
      cache_write_1h_tokens: b.cacheWrite1h || 0,
      web_search_requests: b.webSearch || 0,
      web_fetch_requests: b.webFetch || 0,
      code_execution_requests: b.codeExec || 0,
    };
    const hasUsage =
      row.input_tokens ||
      row.output_tokens ||
      row.cache_read_tokens ||
      row.cache_write_tokens ||
      row.web_search_requests ||
      row.code_execution_requests;
    if (hasUsage) rows.push(row);
  }
  return rows;
}

/**
 * Import a parsed subagent from its own JSONL file into the agents + events tables.
 * Idempotent: re-running on an already-imported subagent backfills any tool events
 * that are missing without duplicating the agent row.
 *
 * If a live subagent (created via PreToolUse "Agent" hook) matches this JSONL,
 * tool events are emitted under the live subagent's id and no JSONL-keyed row
 * is created. Otherwise, a JSONL-keyed row is created (for backfill of historical
 * sessions that never went through hooks).
 *
 * Returns the count of newly created records (agent + events).
 */
function importSubagentFromJsonl(dbModule, sessionId, mainAgentId, subData) {
  if (!subData) return 0;
  const { db, stmts } = dbModule;

  const jsonlSubId = `${sessionId}-jsonl-${subData.agentId}`;
  const liveSub = findLiveSubagentForJsonl(dbModule, sessionId, subData);
  const targetAgentId = liveSub ? liveSub.id : jsonlSubId;
  const existingJsonl = stmts.getAgent.get(jsonlSubId);

  const subName = subData.agentType ? subData.agentType : `Subagent ${subData.agentId.slice(0, 8)}`;
  // This subagent's OWN token usage, so the UI can price it independently of the
  // session total (which would otherwise be shown on every card, misleadingly).
  const tokenRows = subagentTokenRows(subData.tokensByModel);
  let created = 0;

  // Only create a JSONL-keyed row when there's no live subagent to merge into.
  // Live subagents (created via the PreToolUse "Agent" hook) are detected by
  // findLiveSubagentForJsonl above; in that case tool events are emitted under
  // the live row's id and no parallel JSONL-keyed row is needed.
  if (!liveSub && !existingJsonl) {
    stmts.insertAgent.run(
      jsonlSubId,
      sessionId,
      subName,
      "subagent",
      subData.agentType || null,
      "completed",
      subData.task,
      mainAgentId,
      JSON.stringify({
        imported: true,
        source: "jsonl",
        model: subData.model,
        tools: subData.toolNames,
        user_messages: subData.userMessages,
        assistant_messages: subData.assistantMessages,
        thinking_blocks: subData.thinkingBlockCount,
        tokens: tokenRows,
      })
    );
    db.prepare("UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?").run(
      subData.startedAt,
      subData.endedAt,
      subData.endedAt,
      jsonlSubId
    );
    created++;
  }

  // Stamp the subagent's REAL model (from its own transcript) onto its agent
  // row. Live subagent rows — created by the PreToolUse "Agent" hook — carry no
  // model, so without this they get read as the parent/orchestrator model
  // (issue #185). The JSONL-keyed row already records model at creation; this
  // backfills the live row (and is a no-op once model is set).
  // Backfill the target row's metadata: stamp the subagent's real model (issue
  // #185) and refresh its own token buckets so its cost stays priced at current
  // rates. Both are idempotent — model is only filled when missing; tokens are
  // rewritten only when the transcript actually has usage (append-only JSONL, so
  // the sum only grows) and when they differ from what's stored.
  {
    const row = stmts.getAgent.get(targetAgentId);
    if (row) {
      let meta = {};
      try {
        meta = row.metadata ? JSON.parse(row.metadata) : {};
      } catch {
        meta = {};
      }
      let changed = false;
      if (subData.model && !meta.model) {
        meta.model = subData.model;
        changed = true;
      }
      // Enrich a merged live/hook row with the metadata parsed from its
      // transcript. Live rows (created by the PreToolUse "Agent" hook) carry
      // none of this, so without backfilling here those exact subagents render
      // with empty tool/message/thinking metadata. Only fill fields still
      // missing so a richer existing value is never clobbered.
      if (subData.toolNames && subData.toolNames.length > 0 && !meta.tools) {
        meta.tools = subData.toolNames;
        changed = true;
      }
      if (meta.user_messages == null && subData.userMessages != null) {
        meta.user_messages = subData.userMessages;
        changed = true;
      }
      if (meta.assistant_messages == null && subData.assistantMessages != null) {
        meta.assistant_messages = subData.assistantMessages;
        changed = true;
      }
      if (meta.thinking_blocks == null && subData.thinkingBlockCount != null) {
        meta.thinking_blocks = subData.thinkingBlockCount;
        changed = true;
      }
      // Stamp per-agent token buckets so the row can be priced independently.
      // Rewrite when the parsed usage differs; also stamp once (even []) on rows
      // that predate this key so the backfill pass below doesn't re-scan a
      // genuinely-zero-usage subagent on every startup.
      const hasTokensKey = Object.prototype.hasOwnProperty.call(meta, "tokens");
      const tokensChanged =
        tokenRows.length > 0 && JSON.stringify(meta.tokens || []) !== JSON.stringify(tokenRows);
      if (tokensChanged || !hasTokensKey) {
        meta.tokens = tokenRows;
        changed = true;
      }
      if (changed) {
        db.prepare("UPDATE agents SET metadata = ? WHERE id = ?").run(
          JSON.stringify(meta),
          targetAgentId
        );
      }
    }
  }

  // Subagent token totals are written under the subagent's OWN model — live by
  // scanAndImportSubagents() (per-subagent buckets, excluding the parent model)
  // and authoritatively by combineSessionTokens()/writeSessionTokens() at the
  // importSession level (subagents have their own JSONL with separate usage).

  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  // Spawn marker under the parent (main) agent — only emit once per subagent,
  // and only when we own the subagent row (i.e. no live row already exists).
  if (!liveSub) {
    const spawnExists = db
      .prepare(
        "SELECT 1 FROM events WHERE session_id = ? AND agent_id = ? AND event_type = 'PreToolUse' AND tool_name = 'Agent' AND data LIKE ? LIMIT 1"
      )
      .get(sessionId, mainAgentId, `%"subagent_id":${JSON.stringify(targetAgentId)}%`);
    if (!spawnExists) {
      insertEvent.run(
        sessionId,
        mainAgentId,
        "PreToolUse",
        "Agent",
        `Subagent spawned: ${subName} (from JSONL)`,
        JSON.stringify({
          imported: true,
          subagent_type: subData.agentType,
          subagent_id: targetAgentId,
          source: "subagent_jsonl",
        }),
        subData.startedAt
      );
      created++;
    }
  }

  // Per-tool-call events under the subagent's own agent_id so the UI can attribute
  // them to the subagent. Idempotent by (agent_id, event_type, tool_use_id).
  if (Array.isArray(subData.toolEvents) && subData.toolEvents.length > 0) {
    const eventExists = db.prepare(
      "SELECT 1 FROM events WHERE agent_id = ? AND event_type = ? AND data LIKE ? LIMIT 1"
    );
    for (const tev of subData.toolEvents) {
      if (!tev.tool_use_id) continue;
      const useIdMarker = `%"tool_use_id":${JSON.stringify(tev.tool_use_id)}%`;
      const ts = tev.pre_timestamp || subData.startedAt;
      const truncatedInput = truncateForEvent(tev.tool_input);

      if (!eventExists.get(targetAgentId, "PreToolUse", useIdMarker)) {
        insertEvent.run(
          sessionId,
          targetAgentId,
          "PreToolUse",
          tev.tool_name,
          `Using tool: ${tev.tool_name}`,
          JSON.stringify({
            imported: true,
            source: "subagent_jsonl",
            tool_use_id: tev.tool_use_id,
            tool_name: tev.tool_name,
            tool_input: truncatedInput,
          }),
          ts
        );
        created++;
      }

      if (tev.post_timestamp && !eventExists.get(targetAgentId, "PostToolUse", useIdMarker)) {
        insertEvent.run(
          sessionId,
          targetAgentId,
          "PostToolUse",
          tev.tool_name,
          `Tool completed: ${tev.tool_name}`,
          JSON.stringify({
            imported: true,
            source: "subagent_jsonl",
            tool_use_id: tev.tool_use_id,
            tool_name: tev.tool_name,
            tool_input: truncatedInput,
            tool_response: truncateForEvent(tev.tool_response),
            is_error: tev.is_error,
          }),
          tev.post_timestamp
        );
        created++;
      }
    }
  }

  return created;
}

/**
 * Resolve the DB agent id for a parsed subagent: the live row (created by the
 * PreToolUse "Agent" hook) if one matches, else the JSONL-keyed id. Mirrors the
 * targetAgentId logic in importSubagentFromJsonl so parent/child linkage points
 * at the same rows the importer wrote.
 */
function resolveSubagentDbId(dbModule, sessionId, subData) {
  const live = findLiveSubagentForJsonl(dbModule, sessionId, subData);
  return live ? live.id : `${sessionId}-jsonl-${subData.agentId}`;
}

/**
 * Reconstruct the real parent→child hierarchy for a session's subagents.
 *
 * Subagent rows are inserted flat under the main agent because a single hook
 * event or JSONL file carries no spawner identity. But each subagent's OWN
 * transcript records every child it spawned via the Task tool
 * (`toolUseResult.agentId`, captured as `spawnedChildren` by parseSubagentFile).
 * Inverting that map gives child→parent; any subagent no other subagent claims
 * stays under main. We then repoint parent_agent_id so nested agents nest under
 * their true spawner instead of collapsing to a single level.
 *
 * Idempotent and additive: only rewrites parent_agent_id on existing rows,
 * never inserts or deletes. Returns the number of rows repointed.
 */
function reconcileSubagentParents(dbModule, sessionId, mainAgentId, parsedSubagents) {
  if (!Array.isArray(parsedSubagents) || parsedSubagents.length < 2) return 0;
  const { stmts } = dbModule;

  const byAgentId = new Map();
  for (const s of parsedSubagents) if (s && s.agentId) byAgentId.set(s.agentId, s);

  // child transcript id → parent transcript id, but only for parents we actually
  // parsed (a claimed child whose spawner file is missing falls back to main).
  const parentOf = new Map();
  for (const s of parsedSubagents) {
    if (!s || !Array.isArray(s.spawnedChildren)) continue;
    for (const childId of s.spawnedChildren) {
      if (childId && childId !== s.agentId && byAgentId.has(childId)) {
        parentOf.set(childId, s.agentId);
      }
    }
  }
  if (parentOf.size === 0) return 0;

  let updated = 0;
  for (const s of parsedSubagents) {
    const parentTid = parentOf.get(s.agentId);
    if (!parentTid) continue; // direct child of main — already correct at insert
    const parentData = byAgentId.get(parentTid);
    if (!parentData) continue;

    const childDbId = resolveSubagentDbId(dbModule, sessionId, s);
    const parentDbId = resolveSubagentDbId(dbModule, sessionId, parentData);
    if (!childDbId || !parentDbId || childDbId === parentDbId) continue;

    const childRow = stmts.getAgent.get(childDbId);
    const parentRow = stmts.getAgent.get(parentDbId);
    if (!childRow || !parentRow) continue;
    if (childRow.parent_agent_id === parentDbId) continue; // already linked

    // Cycle guard. A real Task-spawn DAG is acyclic, but guard defensively:
    // if the proposed parent is already a descendant of the child (walking up
    // the parent chain from the parent reaches the child), linking them would
    // create a loop that the recursive tree builders (client + findDeepest CTE)
    // would spin on. Skip such a link rather than corrupt the hierarchy.
    let cursor = parentDbId;
    const seen = new Set([childDbId]);
    let createsCycle = false;
    while (cursor) {
      if (seen.has(cursor)) {
        createsCycle = true;
        break;
      }
      seen.add(cursor);
      cursor = stmts.getAgent.get(cursor)?.parent_agent_id || null;
    }
    if (createsCycle) continue;

    stmts.setAgentParent.run(parentDbId, childDbId);
    updated++;
  }
  return updated;
}

/**
 * Import a parsed session into the database.
 */
function importSession(dbModule, session) {
  const { db, stmts } = dbModule;
  const existing = stmts.getSession.get(session.sessionId);
  if (existing) {
    const meta = existing.metadata ? JSON.parse(existing.metadata) : {};
    if (!meta.imported) return { skipped: true };

    const mainAgentId = `${session.sessionId}-main`;
    const insertEvent = db.prepare(
      "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const importedData = JSON.stringify({ imported: true });
    let backfilled = false;

    // Per-event-type "high water mark" — the newest timestamp already present
    // in the DB for each event_type belonging to this session. JSONL is
    // append-only and parsed in file order, so any JSONL entry whose timestamp
    // is strictly greater than this cutoff is unambiguously new and safe to
    // insert. This replaces the old "if zero of type X then dump all" check
    // that prevented growing sessions from ever picking up new events after
    // the very first import — the root cause of "today shows 0 activity" when
    // a session has been continuously appended to across multiple days.
    const cutoffRows = db
      .prepare(
        "SELECT event_type, MAX(created_at) AS m FROM events WHERE session_id = ? GROUP BY event_type"
      )
      .all(session.sessionId);
    const cutoff = Object.create(null);
    for (const r of cutoffRows) cutoff[r.event_type] = r.m;
    const isNewer = (type, ts) => {
      if (!ts) return false;
      const c = cutoff[type];
      return !c || ts > c;
    };

    // Stop events — one per assistant message timestamp newer than cutoff.
    if (session.messageTimestamps && session.messageTimestamps.length > 0) {
      let added = 0;
      for (const ts of session.messageTimestamps) {
        if (!isNewer("Stop", ts)) continue;
        insertEvent.run(
          session.sessionId,
          mainAgentId,
          "Stop",
          null,
          `${session.name} - response`,
          importedData,
          ts
        );
        added++;
      }
      if (added > 0) backfilled = true;
    } else if (!cutoff.Stop) {
      // No timestamps in JSONL and nothing previously imported — emit a single
      // sentinel Stop at session start so the dashboard still shows the session.
      insertEvent.run(
        session.sessionId,
        mainAgentId,
        "Stop",
        null,
        `Session: ${session.name} (${session.userMessages} user / ${session.assistantMessages} assistant msgs)`,
        importedData,
        session.startedAt
      );
      backfilled = true;
    }

    // Tool-use events — one PostToolUse per tool_use block newer than cutoff.
    if (session.toolUses && session.toolUses.length > 0) {
      let added = 0;
      for (const tu of session.toolUses) {
        if (!isNewer("PostToolUse", tu.timestamp)) continue;
        insertEvent.run(
          session.sessionId,
          mainAgentId,
          "PostToolUse",
          tu.name,
          `${tu.name} (imported)`,
          importedData,
          tu.timestamp
        );
        added++;
      }
      if (added > 0) backfilled = true;
    }

    // Backfill compaction agents/events for existing sessions
    const compactCount = importCompactions(
      dbModule,
      session.sessionId,
      mainAgentId,
      session.compactions
    );
    if (compactCount > 0) backfilled = true;

    // Persist the transcript path so the abandon sweep, compaction scanner, and
    // per-agent cost backfill can locate this session's transcript. The stmt
    // only writes when the column is still empty, so it's a one-time no-op after.
    if (session.transcriptPath) {
      stmts.setSessionTranscriptPath.run(session.transcriptPath, session.sessionId);
    }

    // Subagent records. When the session has subagent TRANSCRIPTS
    // (parsedSubagents), those `-jsonl-` rows are authoritative and richer
    // (real model, tokens, tools) — so we must NOT also create `-subagent-N`
    // rows from the main transcript's Agent blocks: the two are deduped only by
    // a fragile type+timing match, and when it misses (the Agent-block timestamp
    // and the subagent transcript's first timestamp differ by more than the
    // tolerance) every subagent ends up DUPLICATED. Fall back to importSubagents
    // only when there are no transcripts to reconstruct from.
    const hasParsedSubs = session.parsedSubagents && session.parsedSubagents.length > 0;
    if (!hasParsedSubs) {
      const subagentCount = importSubagents(
        dbModule,
        session.sessionId,
        mainAgentId,
        session.toolUses
      );
      if (subagentCount > 0) backfilled = true;
    }

    // Backfill API errors
    const apiErrCount = importApiErrors(
      dbModule,
      session.sessionId,
      mainAgentId,
      session.apiErrors
    );
    if (apiErrCount > 0) backfilled = true;

    // Backfill subagent JSONL imports
    if (session.parsedSubagents && session.parsedSubagents.length > 0) {
      for (const subData of session.parsedSubagents) {
        if (importSubagentFromJsonl(dbModule, session.sessionId, mainAgentId, subData) > 0)
          backfilled = true;
      }
      // Repoint nested subagents under their true spawner (inserts land flat).
      if (
        reconcileSubagentParents(
          dbModule,
          session.sessionId,
          mainAgentId,
          session.parsedSubagents
        ) > 0
      )
        backfilled = true;
    }

    // Turn-duration events — one per JSONL entry newer than cutoff.
    if (session.turnDurations && session.turnDurations.length > 0) {
      let added = 0;
      for (const td of session.turnDurations) {
        const ts = td.timestamp || session.startedAt;
        if (!isNewer("TurnDuration", ts)) continue;
        insertEvent.run(
          session.sessionId,
          mainAgentId,
          "TurnDuration",
          null,
          `Turn completed in ${(td.durationMs / 1000).toFixed(1)}s`,
          JSON.stringify({ durationMs: td.durationMs, imported: true }),
          ts
        );
        added++;
      }
      if (added > 0) backfilled = true;
    }

    // Tool-result-error events — one per JSONL entry newer than cutoff.
    if (session.toolResultErrors && session.toolResultErrors.length > 0) {
      let added = 0;
      for (const tre of session.toolResultErrors) {
        const ts = tre.timestamp || session.startedAt;
        if (!isNewer("ToolError", ts)) continue;
        insertEvent.run(
          session.sessionId,
          mainAgentId,
          "ToolError",
          null,
          `Tool execution failed: ${tre.content.slice(0, 100)}`,
          JSON.stringify({ ...tre, imported: true }),
          ts
        );
        added++;
      }
      if (added > 0) backfilled = true;
    }

    // Refresh sessions.ended_at and the message-count metadata so the dashboard
    // shows the latest window when a long-running session is re-imported. We
    // only move ended_at forward — never backward — and only when the JSONL's
    // latest activity is genuinely past whatever the DB currently records.
    const metaChanged =
      meta.user_messages !== session.userMessages ||
      meta.assistant_messages !== session.assistantMessages ||
      (!meta.entrypoint && (session.entrypoint || session.turnDurations?.length > 0)) ||
      // Also refresh when turn count or thinking blocks grew even if the message
      // counts happen to be unchanged, so usage_extras / turn_count / thinking
      // aren't left stale on a re-imported, still-growing session.
      (session.turnDurations && (meta.turn_count || 0) !== session.turnDurations.length) ||
      (session.thinkingBlockCount || 0) > (meta.thinking_blocks || 0);
    if (metaChanged) {
      meta.user_messages = session.userMessages;
      meta.assistant_messages = session.assistantMessages;
      meta.entrypoint = meta.entrypoint || session.entrypoint || null;
      meta.permission_mode = meta.permission_mode || session.permissionMode || null;
      meta.thinking_blocks = Math.max(meta.thinking_blocks || 0, session.thinkingBlockCount || 0);
      meta.usage_extras = session.usageExtras || meta.usage_extras || null;
      meta.turn_count = session.turnDurations ? session.turnDurations.length : meta.turn_count || 0;
      meta.total_turn_duration_ms = session.turnDurations
        ? session.turnDurations.reduce((s, t) => s + t.durationMs, 0)
        : meta.total_turn_duration_ms || 0;
      stmts.updateSession.run(null, null, null, JSON.stringify(meta), session.sessionId);
      backfilled = true;
    }

    // Backfill the session name from the transcript title when the stored name
    // is still an auto/placeholder label. Earlier imports named sessions after
    // their cwd folder; the real title (custom > ai) is more useful. Only
    // overwrite auto labels so a name the user picked is preserved.
    const transcriptTitle = session.customTitle || session.aiTitle || null;
    if (transcriptTitle) {
      const base = session.cwd ? path.basename(session.cwd) : null;
      const stored = existing.name || "";
      const isAuto =
        !stored.trim() ||
        stored === `Session ${session.sessionId.slice(0, 8)}` ||
        (base &&
          (stored === base || stored.startsWith(`${base} - `) || stored.startsWith(`${base} (`)));
      if (isAuto && stored !== transcriptTitle) {
        stmts.updateSession.run(transcriptTitle, null, null, null, session.sessionId);
        backfilled = true;
      }
    }
    if (
      session.endedAt &&
      (!existing.ended_at || session.endedAt > existing.ended_at) &&
      existing.status !== "active"
    ) {
      db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(
        session.endedAt,
        session.sessionId
      );
      backfilled = true;
    }

    // Reconcile token usage. The earlier importer dropped subagent tokens
    // entirely, so any session with subagent JSONLs has under-counted totals.
    // replaceTokenUsage's baseline-shift logic guarantees this can never
    // reduce a session's totals — at worst it's a no-op.
    if (
      session.parsedSubagents &&
      session.parsedSubagents.some(
        (s) =>
          s.tokensByModel &&
          Object.values(s.tokensByModel).some(
            (t) => (t.input || 0) + (t.output || 0) + (t.cacheRead || 0) + (t.cacheWrite || 0) > 0
          )
      )
    ) {
      const written = writeSessionTokens(
        dbModule,
        session.sessionId,
        combineSessionTokens(session)
      );
      if (written > 0) backfilled = true;
    }

    return backfilled ? { skipped: false, backfilled: true } : { skipped: true };
  }

  // If the JSONL file was modified recently (within 10 minutes), the session is likely
  // still active — import it as active/waiting so it appears on the dashboard immediately.
  const RECENT_THRESHOLD_MS = 10 * 60 * 1000;
  const isRecentlyActive =
    session.fileModifiedAt && Date.now() - session.fileModifiedAt < RECENT_THRESHOLD_MS;
  const sessionStatus = isRecentlyActive ? "active" : "completed";
  const agentStatus = isRecentlyActive ? "waiting" : "completed";

  const metadata = JSON.stringify({
    version: session.version,
    slug: session.slug,
    git_branch: session.gitBranch,
    user_messages: session.userMessages,
    assistant_messages: session.assistantMessages,
    imported: true,
    entrypoint: session.entrypoint || null,
    permission_mode: session.permissionMode || null,
    thinking_blocks: session.thinkingBlockCount || 0,
    usage_extras: session.usageExtras || null,
    turn_count: session.turnDurations ? session.turnDurations.length : 0,
    total_turn_duration_ms: session.turnDurations
      ? session.turnDurations.reduce((s, t) => s + t.durationMs, 0)
      : 0,
  });

  stmts.insertSession.run(
    session.sessionId,
    session.name,
    sessionStatus,
    session.cwd,
    session.model,
    metadata
  );

  db.prepare("UPDATE sessions SET started_at = ?, ended_at = ? WHERE id = ?").run(
    session.startedAt,
    isRecentlyActive ? null : session.endedAt,
    session.sessionId
  );

  // Persist the transcript path so the abandon sweep, compaction scanner, and
  // per-agent cost backfill can locate this session's transcript later.
  if (session.transcriptPath) {
    stmts.setSessionTranscriptPath.run(session.transcriptPath, session.sessionId);
  }

  const mainAgentId = `${session.sessionId}-main`;
  const agentLabel = `Main Agent - ${session.name}`;
  stmts.insertAgent.run(
    mainAgentId,
    session.sessionId,
    agentLabel,
    "main",
    null,
    agentStatus,
    null,
    null,
    null
  );
  db.prepare("UPDATE agents SET started_at = ?, ended_at = ? WHERE id = ?").run(
    session.startedAt,
    isRecentlyActive ? null : session.endedAt,
    mainAgentId
  );

  for (const teamName of session.teams) {
    const subId = `${session.sessionId}-team-${teamName}`;
    stmts.insertAgent.run(
      subId,
      session.sessionId,
      teamName,
      "subagent",
      "team",
      "completed",
      null,
      mainAgentId,
      null
    );
    db.prepare("UPDATE agents SET started_at = ?, ended_at = ? WHERE id = ?").run(
      session.startedAt,
      session.endedAt,
      subId
    );
  }

  // Create synthetic events at actual message timestamps so the activity heatmap
  // reflects when work actually happened, not just session start/end.
  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const importedData = JSON.stringify({ imported: true });

  if (session.messageTimestamps && session.messageTimestamps.length > 0) {
    // One event per assistant message at its actual timestamp
    for (const ts of session.messageTimestamps) {
      insertEvent.run(
        session.sessionId,
        mainAgentId,
        "Stop",
        null,
        `${session.name} - response`,
        importedData,
        ts
      );
    }
  } else {
    // Fallback: no message timestamps available, use session start/end
    insertEvent.run(
      session.sessionId,
      mainAgentId,
      "Stop",
      null,
      `Session: ${session.name} (${session.userMessages} user / ${session.assistantMessages} assistant msgs)`,
      importedData,
      session.startedAt
    );
    if (session.endedAt && session.endedAt !== session.startedAt) {
      insertEvent.run(
        session.sessionId,
        mainAgentId,
        "Stop",
        null,
        `Session ended: ${session.name}`,
        importedData,
        session.endedAt
      );
    }
  }

  // Create tool use events from extracted tool_use blocks
  if (session.toolUses && session.toolUses.length > 0) {
    for (const tu of session.toolUses) {
      insertEvent.run(
        session.sessionId,
        mainAgentId,
        "PostToolUse",
        tu.name,
        `${tu.name} (imported)`,
        importedData,
        tu.timestamp
      );
    }
  }

  // Create compaction agents/events
  importCompactions(dbModule, session.sessionId, mainAgentId, session.compactions);

  // Create subagent records from Agent tool_use blocks ONLY when there are no
  // subagent transcripts to reconstruct from. When transcripts exist, the
  // `-jsonl-` rows below are authoritative; running both sources duplicates
  // every subagent (they're deduped only by a fragile type+timing match). See
  // the same guard on the backfill path above.
  if (!(session.parsedSubagents && session.parsedSubagents.length > 0)) {
    importSubagents(dbModule, session.sessionId, mainAgentId, session.toolUses);
  }

  // Import API errors
  importApiErrors(dbModule, session.sessionId, mainAgentId, session.apiErrors);

  // Import turn duration events
  if (session.turnDurations && session.turnDurations.length > 0) {
    for (const td of session.turnDurations) {
      insertEvent.run(
        session.sessionId,
        mainAgentId,
        "TurnDuration",
        null,
        `Turn completed in ${(td.durationMs / 1000).toFixed(1)}s`,
        JSON.stringify({ durationMs: td.durationMs, imported: true }),
        td.timestamp || session.startedAt
      );
    }
  }

  // Import tool result errors
  if (session.toolResultErrors && session.toolResultErrors.length > 0) {
    for (const tre of session.toolResultErrors) {
      insertEvent.run(
        session.sessionId,
        mainAgentId,
        "ToolError",
        null,
        `Tool execution failed: ${tre.content.slice(0, 100)}`,
        JSON.stringify({ ...tre, imported: true }),
        tre.timestamp || session.startedAt
      );
    }
  }

  // Import subagent JSONL files
  if (session.parsedSubagents && session.parsedSubagents.length > 0) {
    for (const subData of session.parsedSubagents) {
      importSubagentFromJsonl(dbModule, session.sessionId, mainAgentId, subData);
    }
    // Repoint nested subagents under their true spawner (inserts land flat).
    reconcileSubagentParents(dbModule, session.sessionId, mainAgentId, session.parsedSubagents);
  }

  writeSessionTokens(dbModule, session.sessionId, combineSessionTokens(session));

  return { skipped: false };
}

/**
 * Backfill compaction agents/events for ALL sessions in the database.
 * Scans every JSONL file, finds isCompactSummary entries, and creates
 * agents + events that are missing. Safe to run repeatedly (deduplicated).
 */
async function backfillCompactions(dbModule) {
  if (!fs.existsSync(PROJECTS_DIR)) return { backfilled: 0 };
  const { stmts } = dbModule;

  const projectDirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let backfilled = 0;

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir);
    const files = fs.readdirSync(projPath).filter((f) => f.endsWith(".jsonl"));

    for (const file of files) {
      const sessionId = path.basename(file, ".jsonl");
      const session = stmts.getSession.get(sessionId);
      if (!session) continue;

      const filePath = path.join(projPath, file);
      const rl = readline.createInterface({
        input: fs.createReadStream(filePath, { encoding: "utf8" }),
        crlfDelay: Infinity,
      });

      const compactions = [];
      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.isCompactSummary) {
            compactions.push({ uuid: entry.uuid || null, timestamp: entry.timestamp || null });
          }
        } catch {
          continue;
        }
      }

      if (compactions.length === 0) continue;
      const mainAgentId = `${sessionId}-main`;
      backfilled += importCompactions(dbModule, sessionId, mainAgentId, compactions);
    }
  }

  return { backfilled };
}

/**
 * Parse a single session JSONL into the shape `importSession` expects, attaching
 * any sibling `subagents/` transcripts. Returns the parsed session (with its
 * source path stashed on `_sourceJsonlPath`) or `null` when the file holds no
 * usable session. Shared by `importAllSessions` (batch) and `syncDefaultProjects`
 * (incremental) so both discover sessions and subagents identically.
 */
async function parseSessionForImport(projPath, sourcePath) {
  const session = await parseSessionFile(sourcePath);
  if (!session) return null;

  // Parse subagent JSONL files if session has subagents/ directory
  const subDir = path.join(projPath, session.sessionId, "subagents");
  if (fs.existsSync(subDir)) {
    const subFiles = fs.readdirSync(subDir).filter((f) => f.endsWith(".jsonl"));
    session.parsedSubagents = [];
    for (const sf of subFiles) {
      try {
        const subData = await parseSubagentFile(path.join(subDir, sf));
        if (subData) session.parsedSubagents.push(subData);
      } catch {
        /* non-fatal */
      }
    }
  }

  session._sourceJsonlPath = sourcePath;
  return session;
}

/**
 * Auto-import all legacy sessions. Called from server startup.
 * Returns { imported, skipped, errors } counts.
 * Designed to be fast on repeat runs (skips existing sessions).
 */
async function importAllSessions(dbModule) {
  if (!fs.existsSync(PROJECTS_DIR)) return { imported: 0, skipped: 0, errors: 0 };

  const projectDirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const importBatch = dbModule.db.transaction((sessions) => {
    for (const session of sessions) {
      const result = importSession(dbModule, session);
      if (result.skipped) skipped++;
      else imported++;
    }
  });

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir);
    const files = fs.readdirSync(projPath).filter((f) => f.endsWith(".jsonl"));
    if (files.length === 0) continue;

    const batch = [];
    for (const file of files) {
      try {
        const sourcePath = path.join(projPath, file);
        const session = await parseSessionForImport(projPath, sourcePath);
        if (!session) {
          skipped++;
          continue;
        }
        batch.push(session);
      } catch {
        errors++;
      }
    }

    if (batch.length > 0) {
      importBatch(batch);
      // Snapshot transcripts into the dashboard's data dir so they outlive
      // Claude Code's cleanupPeriodDays pruning (default 30 days).
      for (const session of batch) {
        snapshotTranscript(session._sourceJsonlPath, session.sessionId);
      }
    }
  }

  return { imported, skipped, errors };
}

/**
 * Incremental, change-driven sync of the default `~/.claude/projects` directory.
 *
 * Unlike `importAllSessions` (a one-time, parse-every-file backfill), this is
 * meant to run repeatedly from a background poll: it stats each session JSONL
 * one level deep and only parses + imports files whose mtime is new or has
 * advanced since the last sweep, tracked in the caller-owned `mtimeCache`
 * (filePath → mtime ms). This is what lets projects added *after* the one-time
 * backfill — e.g. a folder whose sessions never flow through hooks — surface
 * automatically without a manual rescan.
 *
 * Returns `{ changed }`, where `changed` is `[{ sessionId, isNew }]` for every
 * session touched this sweep (`isNew` = the session did not yet exist in the
 * DB). The caller broadcasts the appropriate WebSocket event per entry. Failures
 * are non-fatal and per-file: one unreadable file never aborts the sweep.
 */
async function syncDefaultProjects(dbModule, options = {}) {
  const mtimeCache = options.mtimeCache instanceof Map ? options.mtimeCache : new Map();
  const changed = [];
  if (!fs.existsSync(PROJECTS_DIR)) return { changed };

  let projectDirs;
  try {
    projectDirs = fs
      .readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return { changed };
  }

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir);
    let files;
    try {
      files = fs.readdirSync(projPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const sourcePath = path.join(projPath, file);
      let mtime;
      try {
        mtime = fs.statSync(sourcePath).mtimeMs;
      } catch {
        continue;
      }
      if (mtimeCache.get(sourcePath) === mtime) continue; // unchanged since last sweep

      try {
        const sessionId = path.basename(file, ".jsonl");
        const existingRow = dbModule.stmts.getSession.get(sessionId);
        // Cold-cache fast path (e.g. the immediate sweep on every restart, when
        // `mtimeCache` is empty): if the session already exists and the file has
        // NOT advanced past what we've already ingested, skip the full transcript
        // parse entirely — just record the mtime. `updated_at` is bumped to >=
        // the file mtime whenever we import the file or a hook ingests from it,
        // so `mtime <= updated_at` means there is nothing new to read. A grown
        // no-hook session (mtime > updated_at) still falls through and re-parses,
        // which is the whole point of the sweep. This keeps restart cost O(new /
        // changed files) instead of re-parsing every transcript on disk.
        if (existingRow) {
          const seenMs = Date.parse(existingRow.updated_at);
          if (Number.isFinite(seenMs) && mtime <= seenMs) {
            mtimeCache.set(sourcePath, mtime);
            continue;
          }
        }
        const existed = !!existingRow;
        const session = await parseSessionForImport(projPath, sourcePath);
        // Record the mtime even when the file yields no session, so we don't
        // re-parse an unusable file every tick.
        mtimeCache.set(sourcePath, mtime);
        if (!session) continue;

        const result = importSession(dbModule, session);
        snapshotTranscript(session._sourceJsonlPath, session.sessionId);
        // A brand-new session is always a real change. An existing one only
        // counts when importSession actually wrote new events (not skipped).
        if (!existed || !result.skipped) {
          changed.push({ sessionId: session.sessionId, isNew: !existed });
        }
        // Cooperative yield after a heavy re-parse (this file fell through the
        // fast path, so its full transcript + subagents were just parsed and
        // imported synchronously). A cold sweep can re-parse many multi-MB
        // transcripts back-to-back; without yielding, that monopolizes the
        // event loop and starves the HTTP API + WebSocket handshake. The
        // fast-path skip above `continue`s before reaching here, so unchanged
        // files never pay this cost.
        await new Promise((resolve) => setImmediate(resolve));
      } catch {
        /* non-fatal — leave mtime recorded so we don't spin on a bad file */
      }
    }
  }

  return { changed };
}

/**
 * Re-walk every JSONL file under ~/.claude/projects/ for sessions that already
 * exist in the DB, sum parent + subagent tokens, and refresh token_usage via
 * replaceTokenUsage. Safe to run repeatedly: never reduces totals because of
 * replaceTokenUsage's baseline-shift behavior.
 *
 * Returns { reconciled, sessionsTouched, modelsWritten, missingFiles }.
 */
async function reconcileTokens(dbModule, options = {}) {
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const counters = { reconciled: 0, sessionsTouched: 0, modelsWritten: 0, missingFiles: 0 };
  if (!fs.existsSync(PROJECTS_DIR)) return counters;

  const projectDirs = fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // Build a map of session_id -> JSONL path so we only parse files for sessions
  // already present in the DB.
  const sessionPaths = new Map();
  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir);
    let files;
    try {
      files = fs.readdirSync(projPath).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const f of files) {
      const sid = path.basename(f, ".jsonl");
      sessionPaths.set(sid, path.join(projPath, f));
    }
  }

  const known = dbModule.db
    .prepare("SELECT id FROM sessions WHERE metadata LIKE '%\"imported\":true%'")
    .all();

  const total = known.length;
  let processed = 0;

  const tx = dbModule.db.transaction((batch) => {
    for (const { sessionId, tokens } of batch) {
      const written = writeSessionTokens(dbModule, sessionId, tokens);
      if (written > 0) {
        counters.sessionsTouched++;
        counters.modelsWritten += written;
      }
      counters.reconciled++;
    }
  });

  let batch = [];
  const FLUSH = 50;

  for (const { id: sessionId } of known) {
    processed++;
    const jsonlPath = sessionPaths.get(sessionId);
    if (!jsonlPath) {
      counters.missingFiles++;
      if (processed % 25 === 0) onProgress({ processed, total, counters });
      continue;
    }

    try {
      const session = await parseSessionFile(jsonlPath);
      if (!session) {
        if (processed % 25 === 0) onProgress({ processed, total, counters });
        continue;
      }

      // Attach subagents discovered next to this session.
      const subPaths = findSessionSubagents(jsonlPath);
      if (subPaths.length > 0) {
        session.parsedSubagents = [];
        for (const sp of subPaths) {
          try {
            const subData = await parseSubagentFile(sp);
            if (subData) session.parsedSubagents.push(subData);
          } catch {
            /* non-fatal */
          }
        }
      }

      const tokens = combineSessionTokens(session);
      if (Object.keys(tokens).length > 0) {
        batch.push({ sessionId, tokens });
        if (batch.length >= FLUSH) {
          tx(batch);
          batch = [];
        }
      } else {
        counters.reconciled++;
      }
    } catch {
      /* non-fatal — keep going */
    }

    if (processed % 25 === 0) onProgress({ processed, total, counters });
  }
  if (batch.length > 0) tx(batch);

  onProgress({ processed, total, counters });
  return counters;
}

// CLI entrypoint
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const reconcile = process.argv.includes("--reconcile-tokens");
  const projectIdx = process.argv.indexOf("--project");
  const projectFilter = projectIdx !== -1 ? process.argv[projectIdx + 1] : null;

  (async () => {
    console.log("Claude Code Session Importer");
    console.log("============================");
    if (dryRun) console.log("DRY RUN - no data will be written\n");
    if (reconcile)
      console.log("RECONCILE — refreshing token totals for already-imported sessions\n");
    if (projectFilter) console.log(`Filtering to project: ${projectFilter}\n`);

    if (!fs.existsSync(PROJECTS_DIR)) {
      console.error(`Projects directory not found: ${PROJECTS_DIR}`);
      process.exit(1);
    }

    if (reconcile) {
      const dbModule = require("../server/db");
      const before = dbModule.db
        .prepare(
          `SELECT
             COALESCE(SUM(input_tokens + baseline_input), 0) AS i,
             COALESCE(SUM(output_tokens + baseline_output), 0) AS o,
             COALESCE(SUM(cache_read_tokens + baseline_cache_read), 0) AS cr,
             COALESCE(SUM(cache_write_tokens + baseline_cache_write), 0) AS cw
           FROM token_usage`
        )
        .get();
      const result = await reconcileTokens(dbModule, {
        onProgress: ({ processed, total, counters }) => {
          process.stdout.write(
            `  reconciling ${processed}/${total} (touched: ${counters.sessionsTouched}, models: ${counters.modelsWritten})\r`
          );
        },
      });
      const after = dbModule.db
        .prepare(
          `SELECT
             COALESCE(SUM(input_tokens + baseline_input), 0) AS i,
             COALESCE(SUM(output_tokens + baseline_output), 0) AS o,
             COALESCE(SUM(cache_read_tokens + baseline_cache_read), 0) AS cr,
             COALESCE(SUM(cache_write_tokens + baseline_cache_write), 0) AS cw
           FROM token_usage`
        )
        .get();
      console.log(`\nReconciled ${result.reconciled} sessions.`);
      console.log(`Sessions whose tokens changed: ${result.sessionsTouched}`);
      console.log(`Token rows written: ${result.modelsWritten}`);
      if (result.missingFiles > 0) {
        console.log(`Sessions with no JSONL on disk (skipped): ${result.missingFiles}`);
      }
      const fmt = (n) => Number(n).toLocaleString();
      console.log("");
      console.log("Token totals (before → after):");
      console.log(
        `  input:       ${fmt(before.i)}  →  ${fmt(after.i)}  (Δ ${fmt(after.i - before.i)})`
      );
      console.log(
        `  output:      ${fmt(before.o)}  →  ${fmt(after.o)}  (Δ ${fmt(after.o - before.o)})`
      );
      console.log(
        `  cache_read:  ${fmt(before.cr)}  →  ${fmt(after.cr)}  (Δ ${fmt(after.cr - before.cr)})`
      );
      console.log(
        `  cache_write: ${fmt(before.cw)}  →  ${fmt(after.cw)}  (Δ ${fmt(after.cw - before.cw)})`
      );
      console.log("\nDone.");
      return;
    }

    if (dryRun) {
      const projectDirs = fs
        .readdirSync(PROJECTS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      let total = 0;
      for (const projDir of projectDirs) {
        if (projectFilter && !projDir.includes(projectFilter)) continue;
        const projPath = path.join(PROJECTS_DIR, projDir);
        const files = fs.readdirSync(projPath).filter((f) => f.endsWith(".jsonl"));
        if (files.length === 0) continue;

        const label = projDir.replace(/^C--/, "").replace(/-/g, "/");
        console.log(`\nProject: ${label} (${files.length} sessions)`);

        for (const file of files) {
          total++;
          try {
            const session = await parseSessionFile(path.join(projPath, file));
            if (!session) {
              console.log(`  SKIP ${file} (empty)`);
              continue;
            }
            const totalTok = Object.values(session.tokensByModel).reduce(
              (s, t) => s + t.input + t.output,
              0
            );
            console.log(
              `  ${session.sessionId.slice(0, 12)}... | ${session.name.slice(0, 40).padEnd(40)} | msgs: ${session.userMessages}/${session.assistantMessages} | teams: ${session.teams.length} | models: ${[...new Set(Object.values(session.tokensByModel).map((t) => t.model))].join(",")} | tokens: ${totalTok}`
            );
          } catch (err) {
            console.error(`  ERROR ${file}: ${err.message}`);
          }
        }
      }
      console.log(`\nTotal: ${total} session files`);
    } else {
      const dbModule = require("../server/db");
      const result = await importAllSessions(dbModule);
      console.log(`Imported: ${result.imported}`);
      console.log(`Skipped: ${result.skipped}`);
      if (result.errors > 0) console.log(`Errors: ${result.errors}`);
    }
    console.log("Done.");
  })().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}

/**
 * Scan a single JSONL file for isCompactSummary entries.
 * Synchronous and lightweight — reads the file once.
 */
function findCompactionsInFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const compactions = [];
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.isCompactSummary) {
        compactions.push({ uuid: entry.uuid || null, timestamp: entry.timestamp || null });
      }
    } catch {
      continue;
    }
  }
  return compactions;
}

/**
 * Recursively walk a directory and collect all `.jsonl` file paths.
 * Symlinks are followed lazily; failures are silent (non-fatal).
 */
function collectJsonlFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  const seen = new Set();
  while (stack.length) {
    const dir = stack.pop();
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        stack.push(full);
      } else if (ent.isFile() && ent.name.endsWith(".jsonl")) {
        out.push(full);
      } else if (ent.isSymbolicLink()) {
        try {
          const st = fs.statSync(full);
          if (st.isDirectory()) stack.push(full);
          else if (st.isFile() && full.endsWith(".jsonl")) out.push(full);
        } catch {
          /* dangling symlink */
        }
      }
    }
  }
  return out;
}

/**
 * Classify a JSONL file as "session" or "subagent" based on its parent directory.
 * Subagents live under a `subagents/` folder (either directly or as a sibling of
 * a session-id folder). Anything else is treated as a top-level session.
 */
function classifyJsonl(filePath) {
  // Any transcript living under a `subagents/` directory at ANY depth is a
  // subagent, not a top-level session — this includes the flat
  // `<sid>/subagents/agent-*.jsonl` layout AND the dynamic-workflow tree
  // `<sid>/subagents/workflows/<runId>/agent-*.jsonl`. Walking the whole
  // ancestor chain (rather than just parent/grandparent) stops workflow
  // inner-agent files from being misimported as bogus top-level sessions when a
  // user points the directory importer at a tree that contains workflow runs.
  const segments = path.dirname(filePath).split(path.sep);
  if (segments.includes("subagents")) return "subagent";
  return "session";
}

/**
 * Given a session JSONL path, return any subagent JSONLs that belong to it.
 * Handles two common layouts:
 *   1) <projectDir>/<sessionId>/subagents/*.jsonl   (Claude Code default)
 *   2) <projectDir>/subagents/<sessionId>/*.jsonl   (alternative)
 * Returns absolute paths.
 */
function findSessionSubagents(sessionJsonlPath) {
  const dir = path.dirname(sessionJsonlPath);
  const sessionId = path.basename(sessionJsonlPath, ".jsonl");
  const candidates = [
    path.join(dir, sessionId, "subagents"),
    path.join(dir, "subagents", sessionId),
  ];
  const result = [];
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c)) continue;
      const files = fs.readdirSync(c).filter((f) => f.endsWith(".jsonl"));
      for (const f of files) result.push(path.join(c, f));
    } catch {
      /* non-fatal */
    }
  }
  return result;
}

/**
 * Given a session JSONL path, return any Workflow-tool inner-agent transcripts,
 * which Claude Code writes NESTED at
 *   <sessionId>/subagents/workflows/<runId>/agent-*.jsonl
 * (one level deeper than the flat sub-agent transcripts findSessionSubagents
 * returns). Kept separate so the regular sub-agent import path is unchanged —
 * these are summarized by the Workflow-run ingest, not imported as sub-agents —
 * while the snapshot writer can still preserve them for the Conversation tab.
 *
 * Each entry is { abs, rel } where `rel` is the path relative to the session's
 * `subagents` root (e.g. "workflows/<runId>/agent-<id>.jsonl"), so the snapshot
 * can mirror the live nested layout exactly.
 */
function findSessionWorkflowSubagents(sessionJsonlPath) {
  const dir = path.dirname(sessionJsonlPath);
  const sessionId = path.basename(sessionJsonlPath, ".jsonl");
  const subagentRoots = [
    path.join(dir, sessionId, "subagents"),
    path.join(dir, "subagents", sessionId),
  ];
  const result = [];
  for (const root of subagentRoots) {
    const workflowsDir = path.join(root, "workflows");
    try {
      if (!fs.existsSync(workflowsDir)) continue;
      for (const d of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const runDir = path.join(workflowsDir, d.name);
        for (const f of fs.readdirSync(runDir).filter((x) => x.endsWith(".jsonl"))) {
          result.push({
            abs: path.join(runDir, f),
            rel: path.join("workflows", d.name, f),
          });
        }
      }
    } catch {
      /* non-fatal */
    }
  }
  return result;
}

/**
 * Generalized importer that accepts any root directory.
 *
 * Walks `rootDir` recursively, classifies every `.jsonl` as session or
 * subagent, and runs the same `importSession` pipeline used by auto-import
 * on server startup — so token sums, cost calculations, compactions,
 * subagents, tool events, API errors, and turn durations match the live
 * ingest path exactly.
 *
 * @param {object} dbModule - { db, stmts } from ../server/db
 * @param {string} rootDir - any directory containing Claude Code JSONL files
 * @param {object} [options]
 * @param {(progress: {phase: string, processed: number, total: number, current?: string, counters?: object}) => void} [options.onProgress]
 * @returns {Promise<{imported: number, skipped: number, backfilled: number, errors: number, sessionsSeen: number, filesScanned: number}>}
 */
async function importFromDirectory(dbModule, rootDir, options = {}) {
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const counters = {
    imported: 0,
    skipped: 0,
    backfilled: 0,
    errors: 0,
    sessionsSeen: 0,
    filesScanned: 0,
  };

  if (!fs.existsSync(rootDir)) return counters;
  const st = fs.statSync(rootDir);
  if (!st.isDirectory()) return counters;

  onProgress({ phase: "scan", processed: 0, total: 0, counters });
  const jsonlFiles = collectJsonlFiles(rootDir);
  counters.filesScanned = jsonlFiles.length;
  onProgress({ phase: "parse", processed: 0, total: jsonlFiles.length, counters });

  const sessionFiles = [];
  const standaloneSubagentFiles = [];
  for (const f of jsonlFiles) {
    if (classifyJsonl(f) === "subagent") standaloneSubagentFiles.push(f);
    else sessionFiles.push(f);
  }

  const parsedSessions = [];
  for (let i = 0; i < sessionFiles.length; i++) {
    const f = sessionFiles[i];
    try {
      const session = await parseSessionFile(f);
      if (!session) {
        counters.skipped++;
        onProgress({
          phase: "parse",
          processed: i + 1,
          total: sessionFiles.length,
          current: f,
          counters,
        });
        continue;
      }

      // Attach subagents discovered next to this session JSONL.
      const subPaths = findSessionSubagents(f);
      if (subPaths.length > 0) {
        session.parsedSubagents = [];
        for (const sp of subPaths) {
          try {
            const subData = await parseSubagentFile(sp);
            if (subData) session.parsedSubagents.push(subData);
          } catch {
            /* non-fatal */
          }
        }
      }

      // Remember where this session's JSONL came from so we can snapshot it
      // into the dashboard's data dir after the metadata import — the
      // Conversation tab reads transcripts from disk, not the DB.
      session._sourceJsonlPath = f;
      parsedSessions.push(session);
      counters.sessionsSeen++;
    } catch {
      counters.errors++;
    }
    if ((i + 1) % 5 === 0 || i === sessionFiles.length - 1) {
      onProgress({
        phase: "parse",
        processed: i + 1,
        total: sessionFiles.length,
        current: f,
        counters,
      });
    }
  }

  if (parsedSessions.length > 0) {
    const importBatch = dbModule.db.transaction((sessions) => {
      for (const session of sessions) {
        try {
          const result = importSession(dbModule, session);
          if (result.skipped && !result.backfilled) counters.skipped++;
          else if (result.backfilled) counters.backfilled++;
          else counters.imported++;
        } catch {
          counters.errors++;
        }
      }
    });
    importBatch(parsedSessions);

    // Snapshot each session's transcript into the dashboard's data dir so the
    // Conversation tab survives Claude Code's cleanupPeriodDays pruning. Done
    // outside the DB transaction since it's filesystem I/O.
    for (const session of parsedSessions) {
      if (session._sourceJsonlPath) {
        snapshotTranscript(session._sourceJsonlPath, session.sessionId);
      }
    }
  }

  // Orphan subagent JSONLs (parent session not present in DB or not among the
  // session files we just imported) — try to attach them to whichever session
  // already exists in the DB, if any. Claude Code uses two layouts in the
  // wild: <projectDir>/<sessionId>/subagents/*.jsonl (parent == subagents'
  // parent) and <projectDir>/subagents/<sessionId>/*.jsonl (parent == child
  // of subagents). We probe both candidates and trust whichever one is a
  // known session in the DB.
  if (standaloneSubagentFiles.length > 0) {
    for (const sf of standaloneSubagentFiles) {
      try {
        const subData = await parseSubagentFile(sf);
        if (!subData) continue;
        const parts = sf.split(path.sep);
        const idx = parts.lastIndexOf("subagents");
        if (idx < 0) continue;
        const candidates = [];
        if (idx - 1 >= 0) candidates.push(parts[idx - 1]);
        if (idx + 1 < parts.length) candidates.push(parts[idx + 1]);
        let sessionId = null;
        for (const c of candidates) {
          if (!c) continue;
          if (dbModule.stmts.getSession.get(c)) {
            sessionId = c;
            break;
          }
        }
        if (!sessionId) continue;
        const mainAgentId = `${sessionId}-main`;
        if (importSubagentFromJsonl(dbModule, sessionId, mainAgentId, subData) > 0) {
          counters.backfilled++;
        }
      } catch {
        counters.errors++;
      }
    }
  }

  onProgress({
    phase: "complete",
    processed: sessionFiles.length,
    total: sessionFiles.length,
    counters,
  });
  return counters;
}

/**
 * Scan a single session's `subagents/` directory and import any subagent
 * JSONL files into the events table. Used for live ingestion (e.g. on
 * SubagentStop hook) so each subagent's tool calls show up under its own
 * agent_id without waiting for the periodic scanner.
 *
 * Returns `{ imported, created }` — `imported` counts files seen, `created`
 * counts new agent + event rows.
 */
async function scanAndImportSubagents(dbModule, sessionId, transcriptPath, opts = {}) {
  if (!sessionId || !transcriptPath) return { imported: 0, created: 0 };
  const subDir = path.join(path.dirname(transcriptPath), sessionId, "subagents");
  try {
    await fs.promises.access(subDir);
  } catch {
    return { imported: 0, created: 0 };
  }

  const subFiles = (await fs.promises.readdir(subDir)).filter((f) => f.endsWith(".jsonl"));
  if (subFiles.length === 0) return { imported: 0, created: 0 };

  const { db } = dbModule;
  const mainAgentId = `${sessionId}-main`;
  let created = 0;
  const parsedSubagents = [];
  for (const sf of subFiles) {
    try {
      const subData = await parseSubagentFile(path.join(subDir, sf));
      if (!subData) continue;
      parsedSubagents.push(subData);
      created += importSubagentFromJsonl(dbModule, sessionId, mainAgentId, subData);
    } catch {
      // non-fatal — partial JSONL files are common during a live run
    }
  }

  // Repoint nested subagents under their true spawner. Rows are inserted flat
  // under main (a single subagent JSONL carries no spawner id); the spawner's
  // transcript names each child it spawned, so we can rebuild the real tree.
  let reparented = 0;
  try {
    reparented = reconcileSubagentParents(dbModule, sessionId, mainAgentId, parsedSubagents);
  } catch {
    // non-fatal — hierarchy correction is best-effort during a live run
  }

  // Attribute each subagent's token usage to ITS OWN model (issue #185).
  // A Haiku QA agent under an Opus orchestrator must keep its own (cheaper)
  // token bucket instead of being priced at the orchestrator's rate.
  //
  // We deliberately SKIP any bucket whose model the MAIN transcript also wrote.
  // Those buckets are owned by the main-transcript writer in
  // server/routes/hooks.js; writing one from two sources with different
  // magnitudes would trip replaceTokenUsage's compaction baseline-shift
  // (excluded < stored ⇒ baseline += stored) and inflate the total. The caller
  // passes opts.parentModels (every model the main transcript used — covers a
  // mid-session /model switch, not just the latest); we also fold in the stored
  // session.model as a fallback. Same-model subagents are reconciled by the
  // authoritative importSession/reconcileTokens path instead. Subagent JSONLs
  // are append-only, so the combined per-model sum only grows between
  // SubagentStop sweeps — never a spurious drop.
  if (parsedSubagents.length > 0) {
    try {
      const parentModels = new Set();
      const sessionRow = db.prepare("SELECT model FROM sessions WHERE id = ?").get(sessionId);
      if (sessionRow && sessionRow.model) parentModels.add(sessionRow.model);
      if (Array.isArray(opts.parentModels)) {
        for (const m of opts.parentModels) if (m) parentModels.add(m);
      }
      const combined = combineSessionTokens({ tokensByModel: null, parsedSubagents });
      const subOnly = {};
      for (const [key, tok] of Object.entries(combined)) {
        // Exclude by MODEL only, even though token_usage keys on the full
        // (model, speed, geo, tier) tuple. This is intentionally coarser: a
        // same-model/different-tier sub (e.g. parent Opus standard, sub Opus
        // batch) lands on a distinct key the main writer never touches, so it
        // would be safe to write — but skipping it only causes a benign live
        // under-count that the authoritative reconcile path later repairs.
        // Erring toward under-count (never inflation) is the correct direction.
        if (tok.model && !parentModels.has(tok.model)) subOnly[key] = tok;
      }
      writeSessionTokens(dbModule, sessionId, subOnly);
    } catch {
      // non-fatal — token attribution is best-effort during a live run
    }
  }

  return { imported: subFiles.length, created, reparented };
}

/**
 * Backfill metadata.tokens onto existing subagent rows that predate per-agent
 * cost tracking. New imports and live SubagentStop scans stamp each subagent's
 * own token buckets inline, but a historical session whose transcript never
 * changes again is mtime-skipped by syncDefaultProjects — so its subagents would
 * never gain a per-agent cost and their cards would show none. This re-parses
 * the subagent transcripts for any session that still has a non-compaction
 * subagent missing the tokens key and stamps them.
 *
 * METADATA ONLY — it routes through importSubagentFromJsonl, which stamps the
 * agent row's metadata (and idempotently backfills any missing spawn/tool
 * events) but never writes session token_usage. So session cost totals are
 * completely untouched; only the per-agent breakdown is filled in.
 *
 * Idempotent and self-limiting: once a row has a tokens key it drops out of the
 * driving query, so steady-state startups do near-zero work.
 */
async function backfillSubagentTokenMetadata(dbModule) {
  const { db } = dbModule;
  let sessions;
  try {
    // Every session still holding a non-compaction subagent without a tokens
    // key. Note: NOT filtered on transcript_path — most imported sessions have
    // it NULL, yet their transcript is still on disk at the derivable
    // <projectsDir>/<slug>/<sid>.jsonl path, so we resolve it below.
    sessions = db
      .prepare(
        `SELECT DISTINCT s.id AS session_id, s.transcript_path AS tp,
                s.metadata AS meta
         FROM agents a JOIN sessions s ON s.id = a.session_id
         WHERE a.type = 'subagent'
           AND (a.subagent_type IS NULL OR a.subagent_type != 'compaction')
           AND (a.metadata IS NULL OR a.metadata NOT LIKE '%"tokens":%')`
      )
      .all();
  } catch {
    return { sessions: 0, stamped: 0 };
  }
  let stamped = 0;
  let scanned = 0;
  for (const s of sessions) {
    // Resolve the session transcript path: prefer the stored column when the
    // file still exists, else derive it from the projects dir + slug (imported
    // sessions leave transcript_path NULL). findSessionSubagents then covers
    // BOTH on-disk layouts (<dir>/<sid>/subagents and <dir>/subagents/<sid>).
    let transcriptPath = s.tp && fs.existsSync(s.tp) ? s.tp : null;
    if (!transcriptPath) {
      let slug = null;
      try {
        slug = s.meta ? JSON.parse(s.meta).slug : null;
      } catch {
        slug = null;
      }
      if (slug) {
        const candidate = path.join(PROJECTS_DIR, slug, `${s.session_id}.jsonl`);
        // The file itself may be gone, but findSessionSubagents only needs the
        // path to derive the sibling subagents dir — so accept the candidate as
        // long as its directory exists.
        if (fs.existsSync(path.dirname(candidate))) transcriptPath = candidate;
      }
    }
    if (!transcriptPath) continue; // can't locate the transcript tree — skip
    let subFiles;
    try {
      subFiles = findSessionSubagents(transcriptPath);
    } catch {
      continue;
    }
    if (!subFiles || subFiles.length === 0) continue;
    scanned++;
    const mainAgentId = `${s.session_id}-main`;
    for (const file of subFiles) {
      try {
        const subData = await parseSubagentFile(file);
        if (!subData) continue;
        importSubagentFromJsonl(dbModule, s.session_id, mainAgentId, subData);
        stamped++;
      } catch {
        /* non-fatal — partial or unrelated files are common */
      }
    }
  }
  return { sessions: scanned, stamped };
}

module.exports = {
  importAllSessions,
  syncDefaultProjects,
  importFromDirectory,
  backfillCompactions,
  importCompactions,
  importSubagents,
  importApiErrors,
  importSubagentFromJsonl,
  backfillSubagentTokenMetadata,
  reconcileSubagentParents,
  parseSessionFile,
  parseSubagentFile,
  findCompactionsInFile,
  collectJsonlFiles,
  classifyJsonl,
  findSessionSubagents,
  findSessionWorkflowSubagents,
  snapshotTranscript,
  importSession,
  scanAndImportSubagents,
  combineSessionTokens,
  writeSessionTokens,
  reconcileTokens,
};
