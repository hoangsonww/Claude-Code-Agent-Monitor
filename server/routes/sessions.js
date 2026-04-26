/**
 * @file Express router for session endpoints, allowing creation, retrieval, and updating of sessions with optional pagination and filtering by status. It also computes costs for sessions based on token usage and pricing rules, and broadcasts session changes to connected WebSocket clients for real-time updates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { stmts, db } = require("../db");
const { broadcast } = require("../websocket");
const { calculateCost } = require("./pricing");
const {
  getClaudeHome,
  getProjectsDir,
  getTranscriptPath,
  getSubagentTranscriptPath,
  findTranscriptPath,
  findSubagentTranscriptPath,
} = require("../lib/claude-home");

const router = Router();

/**
 * Read only the first non-empty line from a JSONL file using streaming.
 * Avoids loading the entire file into memory.
 */
async function readFirstLine(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    rl.close();
    rl.removeAllListeners();
    return line;
  }
  return null;
}

router.get("/", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
  const offset = parseInt(req.query.offset) || 0;
  const status = req.query.status;

  const rows = status
    ? stmts.listSessionsByStatus.all(status, limit, offset)
    : stmts.listSessions.all(limit, offset);

  // Bulk-compute costs for all returned sessions in a single pass
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const allTokens = db
      .prepare(
        `SELECT session_id, model,
          input_tokens + baseline_input as input_tokens,
          output_tokens + baseline_output as output_tokens,
          cache_read_tokens + baseline_cache_read as cache_read_tokens,
          cache_write_tokens + baseline_cache_write as cache_write_tokens
        FROM token_usage WHERE session_id IN (${placeholders})`
      )
      .all(...ids);

    const rules = stmts.listPricing.all();
    const tokensBySession = {};
    for (const t of allTokens) {
      if (!tokensBySession[t.session_id]) tokensBySession[t.session_id] = [];
      tokensBySession[t.session_id].push(t);
    }

    for (const row of rows) {
      const sessionTokens = tokensBySession[row.id];
      if (sessionTokens) {
        row.cost = calculateCost(sessionTokens, rules).total_cost;
      } else {
        row.cost = 0;
      }
    }
  }

  res.json({ sessions: rows, limit, offset });
});

router.get("/:id", (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }
  const agents = stmts.listAgentsBySession.all(req.params.id);
  const events = stmts.listEventsBySession.all(req.params.id);
  res.json({ session, agents, events });
});

router.post("/", (req, res) => {
  const { id, name, cwd, model, metadata } = req.body;
  if (!id) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "id is required" } });
  }

  const existing = stmts.getSession.get(id);
  if (existing) {
    return res.json({ session: existing, created: false });
  }

  stmts.insertSession.run(
    id,
    name || null,
    "active",
    cwd || null,
    model || null,
    metadata ? JSON.stringify(metadata) : null
  );
  const session = stmts.getSession.get(id);
  broadcast("session_created", session);
  res.status(201).json({ session, created: true });
});

router.patch("/:id", (req, res) => {
  const { name, status, ended_at, metadata } = req.body;
  const existing = stmts.getSession.get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  stmts.updateSession.run(
    name || null,
    status || null,
    ended_at || null,
    metadata ? JSON.stringify(metadata) : null,
    req.params.id
  );

  const session = stmts.getSession.get(req.params.id);
  broadcast("session_updated", session);
  res.json({ session });
});

// GET /:id/transcripts — List available transcript files for a session (main + sub-agents)
router.get("/:id/transcripts", async (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  const result = [];

  // Query database agent list for db_agent_id association
  const dbAgents = stmts.listAgentsBySession.all(req.params.id) || [];

  // Main session transcript
  const mainPath = getTranscriptPath(req.params.id, session.cwd) || findTranscriptPath(req.params.id);
  if (mainPath && fs.existsSync(mainPath)) {
    // Main agent database ID format: <sessionId>-main
    const mainDbAgent = dbAgents.find((a) => a.type === "main");
    result.push({
      id: "main",
      name: "Main Agent",
      type: "main",
      has_transcript: true,
      db_agent_id: mainDbAgent ? mainDbAgent.id : null,
    });
  }

  // Sub-agent transcript files
  const encoded = session.cwd ? session.cwd.replace(/[^a-zA-Z0-9]/g, "-") : null;
  const subagentDirs = [];

  // Direct path
  if (encoded) {
    const directDir = path.join(getProjectsDir(), encoded, req.params.id, "subagents");
    if (fs.existsSync(directDir)) subagentDirs.push(directDir);
  }

  // Fallback: scan all project directories when direct path doesn't exist
  if (subagentDirs.length === 0) {
    const projectsDir = path.join(getClaudeHome(), "projects");
    if (fs.existsSync(projectsDir)) {
      try {
        for (const d of fs.readdirSync(projectsDir, { withFileTypes: true })) {
          if (!d.isDirectory()) continue;
          const candidate = path.join(projectsDir, d.name, req.params.id, "subagents");
          if (fs.existsSync(candidate)) subagentDirs.push(candidate);
        }
      } catch { /* ignore */ }
    }
  }

  for (const dir of subagentDirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;
        // File name format: agent-<shortId>.jsonl
        const shortId = file.replace(/^agent-/, "").replace(/\.jsonl$/, "");
        // Try reading meta.json for agent type info
        let meta = null;
        const metaPath = path.join(dir, file.replace(".jsonl", ".meta.json"));
        if (fs.existsSync(metaPath)) {
          try { meta = JSON.parse(fs.readFileSync(metaPath, "utf8")); } catch { /* ignore */ }
        }

        const isCompact = shortId.startsWith("acompact-");
        const transcriptName = isCompact
          ? "Context Compaction"
          : (meta?.description || meta?.agentType || shortId);
        const transcriptSubagentType = meta?.agentType || null;

        // Read first-line timestamp from JSONL for time-based matching
        let transcriptTimestamp = null;
        try {
          const jsonlPath = path.join(dir, file);
          const firstLine = await readFirstLine(jsonlPath);
          if (firstLine) {
            const entry = JSON.parse(firstLine);
            transcriptTimestamp = entry.timestamp || null;
          }
        } catch { /* ignore */ }

        result.push({
          id: shortId,
          name: transcriptName,
          type: isCompact ? "compaction" : "subagent",
          subagent_type: transcriptSubagentType,
          has_transcript: true,
          db_agent_id: null, // matched later after all transcripts are collected
          _timestamp: transcriptTimestamp,
        });
      }
    } catch { /* ignore */ }
  }

  // Match database agents to transcripts using best-effort strategies
  // Strategy: sort both sides by time within each type, then match by index order.
  // This works because agents and transcripts are created in chronological order.

  // Step 1: Sort all non-main transcripts by timestamp
  for (const t of result) {
    if (t.type === "main") continue;
    // Store parseable timestamp for sorting
    t._sortTime = t._timestamp ? new Date(t._timestamp).getTime() : Infinity;
  }

  // Step 2: Sort DB agents by started_at within each subagent_type
  const agentsByType = {};
  for (const a of dbAgents) {
    const key = a.subagent_type || a.type;
    if (!agentsByType[key]) agentsByType[key] = [];
    agentsByType[key].push(a);
  }
  for (const key of Object.keys(agentsByType)) {
    agentsByType[key].sort((a, b) =>
      (a.started_at || "").localeCompare(b.started_at || "")
    );
  }

  // Step 3: Sort transcripts by type+time, then match by index within each type group
  // Group transcripts by their effective type key
  const transcriptsByType = {};
  for (const t of result) {
    if (t.type === "main") continue;
    // Compaction transcripts have subagent_type=null, use type as key
    const key = t.subagent_type || t.type;
    if (!transcriptsByType[key]) transcriptsByType[key] = [];
    transcriptsByType[key].push(t);
  }
  // Sort each group by timestamp
  for (const key of Object.keys(transcriptsByType)) {
    transcriptsByType[key].sort((a, b) => (a._sortTime || Infinity) - (b._sortTime || Infinity));
  }

  // Step 4: Match by index within each type group
  // First try db_agent_id exact match, then fall back to positional match
  for (const key of Object.keys(transcriptsByType)) {
    const tGroup = transcriptsByType[key];
    const aGroup = agentsByType[key] || [];
    const usedAgentIds = new Set();

    for (let i = 0; i < tGroup.length; i++) {
      const t = tGroup[i];

      // Try exact db_agent_id match first (for non-compact sub-agents with meta.json data)
      if (t.db_agent_id) {
        usedAgentIds.add(t.db_agent_id);
        continue;
      }

      // Positional match: i-th transcript → i-th agent in the same type group
      if (i < aGroup.length && !usedAgentIds.has(aGroup[i].id)) {
        t.db_agent_id = aGroup[i].id;
        usedAgentIds.add(aGroup[i].id);
      }
      // If no agent at this position, db_agent_id stays null — client will show "info missing"
    }
  }

  // Clean up internal fields before sending response
  for (const t of result) {
    delete t._timestamp;
    delete t._sortTime;
  }

  // Sort transcripts: main first, then by time ascending (consistent with agents list order)
  result.sort((a, b) => {
    if (a.type === "main") return -1;
    if (b.type === "main") return 1;
    const aAgent = dbAgents.find((ag) => ag.id === a.db_agent_id);
    const bAgent = dbAgents.find((ag) => ag.id === b.db_agent_id);
    const aTime = aAgent?.started_at ? new Date(aAgent.started_at).getTime() : 0;
    const bTime = bAgent?.started_at ? new Date(bAgent.started_at).getTime() : 0;
    if (aTime && bTime) return aTime - bTime;
    if (aTime) return -1;
    if (bTime) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  res.json({ transcripts: result });
});

// GET /:id/transcript — Read session JSONL transcript, return structured message list
// Query params:
//   agent_id: file-level short ID ("main" or "ad18a79192af10ed1", "acompact-xxx")
//   limit: max messages to return (default 50, max 200)
//   after: JSONL line number, only return messages after this line (incremental mode)
//   before: JSONL line number, only return messages before this line (history mode)
//   offset: legacy pagination offset (compatible, mutually exclusive with after/before)
router.get("/:id/transcript", async (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found" } });
  }

  const agentId = req.query.agent_id || null;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const afterLine = req.query.after ? parseInt(req.query.after) : null;
  const beforeLine = req.query.before ? parseInt(req.query.before) : null;
  const offset = parseInt(req.query.offset) || 0;

  // Determine the JSONL file path to read
  let jsonlPath;
  if (agentId && agentId !== "main") {
    jsonlPath =
      getSubagentTranscriptPath(req.params.id, session.cwd, agentId) ||
      findSubagentTranscriptPath(req.params.id, agentId);
  } else {
    jsonlPath =
      getTranscriptPath(req.params.id, session.cwd) || findTranscriptPath(req.params.id);
  }

  if (!jsonlPath || !fs.existsSync(jsonlPath)) {
    return res.json({ messages: [], total: 0, has_more: false, last_line: 0, first_line: 0 });
  }

  try {
    // Stream-parse JSONL with early termination for efficiency.
    // Instead of loading all messages into memory, we use pagination-aware
    // strategies to stop reading as soon as we have enough data.
    const messages = [];
    let lineNum = 0;
    let total = 0; // total valid messages seen (exact for early-terminated streams, indicates >= actual)
    let hasMore = false;

    const rl = readline.createInterface({
      input: fs.createReadStream(jsonlPath, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    // Helper: parse a JSONL line into a message object, or null if not a displayable message
    function parseMessage(entry, num) {
      const msg = entry.type === "assistant" ? entry.message || {} : {};
      const content = [];

      if (entry.type === "user") {
        const msgContent = entry.message?.content;
        if (typeof msgContent === "string") {
          content.push({ type: "text", text: truncate(msgContent, 10240) });
        } else if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.type === "text" && block.text) {
              content.push({ type: "text", text: truncate(block.text, 10240) });
            } else if (block.type === "tool_result") {
              content.push({
                type: "tool_result",
                id: block.tool_use_id || null,
                output: truncate(
                  typeof block.content === "string"
                    ? block.content
                    : JSON.stringify(block.content || ""),
                  10240
                ),
                is_error: !!block.is_error,
              });
            }
          }
        } else if (msgContent === undefined || msgContent === null) {
          return null;
        }
      } else {
        const msgContent = msg.content || [];
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.type === "text" && block.text) {
              content.push({ type: "text", text: truncate(block.text, 10240) });
            } else if (block.type === "thinking" && block.thinking) {
              content.push({ type: "thinking", text: truncate(block.thinking, 10240) });
            } else if (block.type === "tool_use") {
              content.push({
                type: "tool_use",
                name: block.name || "unknown",
                id: block.id || null,
                input: truncateObj(block.input, 10240),
              });
            }
          }
        }
      }

      if (content.length === 0) return null;

      const message = {
        type: entry.type,
        timestamp: entry.timestamp
          ? typeof entry.timestamp === "number"
            ? new Date(entry.timestamp).toISOString()
            : entry.timestamp
          : null,
        content,
        line: num,
      };

      if (entry.type === "assistant") {
        if (msg.model) message.model = msg.model;
        if (msg.usage) {
          message.usage = {
            input_tokens: msg.usage.input_tokens || 0,
            output_tokens: msg.usage.output_tokens || 0,
          };
        }
      }

      return message;
    }

    if (afterLine !== null) {
      // Incremental mode: skip lines until after afterLine, collect up to limit, then stop
      let foundStart = false;
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type !== "user" && entry.type !== "assistant") continue;

        if (!foundStart) {
          if (lineNum <= afterLine) continue;
          foundStart = true;
        }

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;
        messages.push(message);
        if (messages.length >= limit) {
          // Check if there's at least one more valid message
          hasMore = true;
          rl.close();
          rl.removeAllListeners();
          break;
        }
      }
      // If we exhausted the stream without hitting limit, hasMore stays false
    } else if (beforeLine !== null) {
      // History mode: collect messages with line < beforeLine using a sliding window
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type !== "user" && entry.type !== "assistant") continue;
        if (lineNum >= beforeLine) {
          // We've reached the boundary — stop reading
          hasMore = true; // there are more messages at or after beforeLine
          rl.close();
          rl.removeAllListeners();
          break;
        }

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;
        messages.push(message);
        // Sliding window: only keep the last `limit` messages
        if (messages.length > limit) {
          messages.shift();
        }
      }
      // total is the count of messages before beforeLine; if we shifted, there are more
      if (total > limit) hasMore = true;
    } else if (offset > 0) {
      // Legacy offset pagination: skip `offset` valid messages, then collect `limit`
      let skipped = 0;
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type !== "user" && entry.type !== "assistant") continue;

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;

        if (skipped < offset) {
          skipped++;
          continue;
        }
        messages.push(message);
        if (messages.length >= limit) {
          hasMore = true; // assume more exist
          rl.close();
          rl.removeAllListeners();
          break;
        }
      }
    } else {
      // Default: return the latest N messages (chat-flow mode) using a sliding window
      for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.type !== "user" && entry.type !== "assistant") continue;

        const message = parseMessage(entry, lineNum);
        if (!message) continue;
        total++;
        messages.push(message);
        // Sliding window: only keep the last `limit` messages in memory
        if (messages.length > limit) {
          messages.shift();
        }
      }
      // If we shifted any messages out, there are more
      hasMore = total > limit;
    }

    const lastLine = messages.length > 0 ? messages[messages.length - 1].line : 0;
    const firstLine = messages.length > 0 ? messages[0].line : 0;

    // Remove internal line field from messages
    for (const m of messages) {
      delete m.line;
    }

    res.json({
      messages,
      total,
      has_more: hasMore,
      last_line: lastLine,
      first_line: firstLine,
    });
  } catch (err) {
    res.json({ messages: [], total: 0, has_more: false, last_line: 0, first_line: 0 });
  }
});

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "[truncated]";
}

function truncateObj(obj, maxLen) {
  if (!obj) return obj;
  const json = JSON.stringify(obj);
  if (json.length <= maxLen) return obj;
  return { _truncated: truncate(json, maxLen) };
}

module.exports = router;
