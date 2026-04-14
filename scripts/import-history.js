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

const CLAUDE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

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

  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
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
        if (tokensByModel[msgModel] === undefined) {
          tokensByModel[msgModel] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[msgModel].input += usage.input_tokens || 0;
        tokensByModel[msgModel].output += usage.output_tokens || 0;
        tokensByModel[msgModel].cacheRead += usage.cache_read_input_tokens || 0;
        tokensByModel[msgModel].cacheWrite += usage.cache_creation_input_tokens || 0;
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
  const sessionName = slug
    ? `${projectName} (${slug})`
    : `${projectName} - ${sessionId.slice(0, 8)}`;

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
    cwd,
    model,
    version,
    slug,
    gitBranch,
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

  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const ts = entry.timestamp;
    if (ts) {
      const isoTs = typeof ts === "number" ? new Date(ts).toISOString() : ts;
      if (!firstTimestamp || isoTs < firstTimestamp) firstTimestamp = isoTs;
      if (!lastTimestamp || isoTs > lastTimestamp) lastTimestamp = isoTs;
    }

    if (entry.type === "user") {
      userMessageCount++;
      if (!task) {
        const msgContent = entry.message?.content;
        if (typeof msgContent === "string") {
          task = msgContent.slice(0, 500);
        } else if (Array.isArray(msgContent)) {
          const textBlock = msgContent.find((b) => b && b.type === "text");
          if (textBlock) task = (textBlock.text || "").slice(0, 500);
        }
      }
    }

    if (entry.type === "assistant") {
      assistantMessageCount++;
      const msg = entry.message || {};
      const msgModel = msg.model || null;
      if (!model && msgModel && msgModel !== "<synthetic>") model = msgModel;
      if (msgModel && msgModel !== "<synthetic>" && msg.usage) {
        if (!tokensByModel[msgModel]) {
          tokensByModel[msgModel] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[msgModel].input += msg.usage.input_tokens || 0;
        tokensByModel[msgModel].output += msg.usage.output_tokens || 0;
        tokensByModel[msgModel].cacheRead += msg.usage.cache_read_input_tokens || 0;
        tokensByModel[msgModel].cacheWrite += msg.usage.cache_creation_input_tokens || 0;
      }
      const content = msg.content || [];
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) toolNames.add(block.name);
          if (block.type === "thinking") thinkingBlockCount++;
        }
      }
    }

    // Try to get agentType from progress entries (hook data)
    if (entry.type === "progress" && entry.data?.hookEvent) {
      // Some subagent files don't have meta.json; this is fallback
    }
  }

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

    const summary = `Context compacted — conversation history compressed (#${i + 1})`;
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
 * Import a parsed subagent from its own JSONL file into the agents table.
 * Deduplicated by deterministic ID. Returns 1 if created, 0 if already exists.
 */
function importSubagentFromJsonl(dbModule, sessionId, mainAgentId, subData) {
  if (!subData) return 0;
  const { db, stmts } = dbModule;

  const subId = `${sessionId}-jsonl-${subData.agentId}`;
  if (stmts.getAgent.get(subId)) return 0;

  const subName = subData.agentType ? subData.agentType : `Subagent ${subData.agentId.slice(0, 8)}`;

  stmts.insertAgent.run(
    subId,
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
    })
  );
  db.prepare("UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?").run(
    subData.startedAt,
    subData.endedAt,
    subData.endedAt,
    subId
  );

  // Import subagent-specific token usage (additive to session totals)
  for (const [tokenModel, tokens] of Object.entries(subData.tokensByModel)) {
    if (tokens.input > 0 || tokens.output > 0 || tokens.cacheRead > 0 || tokens.cacheWrite > 0) {
      // Use a subagent-specific key to avoid overwriting parent session tokens
      const subKey = `${sessionId}:sub:${subData.agentId}`;
      // We can't use replaceTokenUsage with a modified key since it uses session_id as PK.
      // Instead, just record tool events — token usage is already captured in parent session totals.
    }
  }

  // Create tool events for the subagent
  const insertEvent = db.prepare(
    "INSERT INTO events (session_id, agent_id, event_type, tool_name, summary, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  // Add a spawn event
  insertEvent.run(
    sessionId,
    mainAgentId,
    "PreToolUse",
    "Agent",
    `Subagent spawned: ${subName} (from JSONL)`,
    JSON.stringify({ imported: true, subagent_type: subData.agentType, source: "subagent_jsonl" }),
    subData.startedAt
  );

  return 1;
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

    // Backfill Stop events if none exist
    const stopCount = db
      .prepare(
        "SELECT COUNT(*) as c FROM events WHERE session_id = ? AND data LIKE '%imported%' AND event_type = 'Stop'"
      )
      .get(session.sessionId);
    if (stopCount.c === 0) {
      if (session.messageTimestamps && session.messageTimestamps.length > 0) {
        for (const ts of session.messageTimestamps) {
          insertEvent.run(
            session.sessionId,
            mainAgentId,
            "Stop",
            null,
            `${session.name} — response`,
            importedData,
            ts
          );
        }
      } else {
        insertEvent.run(
          session.sessionId,
          mainAgentId,
          "Stop",
          null,
          `Session: ${session.name} (${session.userMessages} user / ${session.assistantMessages} assistant msgs)`,
          importedData,
          session.startedAt
        );
      }
      backfilled = true;
    }

    // Backfill tool use events if none exist
    const toolCount = db
      .prepare(
        "SELECT COUNT(*) as c FROM events WHERE session_id = ? AND data LIKE '%imported%' AND tool_name IS NOT NULL"
      )
      .get(session.sessionId);
    if (toolCount.c === 0 && session.toolUses && session.toolUses.length > 0) {
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
      backfilled = true;
    }

    // Backfill compaction agents/events for existing sessions
    const compactCount = importCompactions(
      dbModule,
      session.sessionId,
      mainAgentId,
      session.compactions
    );
    if (compactCount > 0) backfilled = true;

    // Backfill subagent records from Agent tool_use blocks
    const subagentCount = importSubagents(
      dbModule,
      session.sessionId,
      mainAgentId,
      session.toolUses
    );
    if (subagentCount > 0) backfilled = true;

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
    }

    // Backfill turn durations if missing
    const turnCount = db
      .prepare(
        "SELECT COUNT(*) as c FROM events WHERE session_id = ? AND event_type = 'TurnDuration'"
      )
      .get(session.sessionId);
    if (turnCount.c === 0 && session.turnDurations && session.turnDurations.length > 0) {
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
      backfilled = true;
    }

    // Backfill tool result errors if missing
    const toolErrCount = db
      .prepare("SELECT COUNT(*) as c FROM events WHERE session_id = ? AND event_type = 'ToolError'")
      .get(session.sessionId);
    if (toolErrCount.c === 0 && session.toolResultErrors && session.toolResultErrors.length > 0) {
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
      backfilled = true;
    }

    // Enrich session metadata with new fields
    if (!meta.entrypoint && (session.entrypoint || session.turnDurations?.length > 0)) {
      meta.entrypoint = session.entrypoint || null;
      meta.permission_mode = session.permissionMode || null;
      meta.thinking_blocks = session.thinkingBlockCount || 0;
      meta.usage_extras = session.usageExtras || null;
      meta.turn_count = session.turnDurations ? session.turnDurations.length : 0;
      meta.total_turn_duration_ms = session.turnDurations
        ? session.turnDurations.reduce((s, t) => s + t.durationMs, 0)
        : 0;
      stmts.updateSession.run(null, null, null, JSON.stringify(meta), session.sessionId);
      backfilled = true;
    }

    return backfilled ? { skipped: false, backfilled: true } : { skipped: true };
  }

  // If the JSONL file was modified recently (within 10 minutes), the session is likely
  // still active — import it as active/idle so it appears on the dashboard immediately.
  const RECENT_THRESHOLD_MS = 10 * 60 * 1000;
  const isRecentlyActive =
    session.fileModifiedAt && Date.now() - session.fileModifiedAt < RECENT_THRESHOLD_MS;
  const sessionStatus = isRecentlyActive ? "active" : "completed";
  const agentStatus = isRecentlyActive ? "idle" : "completed";

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

  const mainAgentId = `${session.sessionId}-main`;
  const agentLabel = `Main Agent — ${session.name}`;
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
        `${session.name} — response`,
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

  // Create subagent records from Agent tool_use blocks
  importSubagents(dbModule, session.sessionId, mainAgentId, session.toolUses);

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
  }

  for (const [tokenModel, tokens] of Object.entries(session.tokensByModel)) {
    if (tokens.input > 0 || tokens.output > 0 || tokens.cacheRead > 0 || tokens.cacheWrite > 0) {
      stmts.replaceTokenUsage.run(
        session.sessionId,
        tokenModel,
        tokens.input,
        tokens.output,
        tokens.cacheRead,
        tokens.cacheWrite
      );
    }
  }

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
        const session = await parseSessionFile(path.join(projPath, file));
        if (!session) {
          skipped++;
          continue;
        }

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

        batch.push(session);
      } catch {
        errors++;
      }
    }

    if (batch.length > 0) importBatch(batch);
  }

  return { imported, skipped, errors };
}

// CLI entrypoint
if (require.main === module) {
  const dryRun = process.argv.includes("--dry-run");
  const projectIdx = process.argv.indexOf("--project");
  const projectFilter = projectIdx !== -1 ? process.argv[projectIdx + 1] : null;

  (async () => {
    console.log("Claude Code Session Importer");
    console.log("============================");
    if (dryRun) console.log("DRY RUN - no data will be written\n");
    if (projectFilter) console.log(`Filtering to project: ${projectFilter}\n`);

    if (!fs.existsSync(PROJECTS_DIR)) {
      console.error(`Projects directory not found: ${PROJECTS_DIR}`);
      process.exit(1);
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
              `  ${session.sessionId.slice(0, 12)}... | ${session.name.slice(0, 40).padEnd(40)} | msgs: ${session.userMessages}/${session.assistantMessages} | teams: ${session.teams.length} | models: ${Object.keys(session.tokensByModel).join(",")} | tokens: ${totalTok}`
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

module.exports = {
  importAllSessions,
  backfillCompactions,
  importCompactions,
  importSubagents,
  importApiErrors,
  importSubagentFromJsonl,
  parseSubagentFile,
  findCompactionsInFile,
};
