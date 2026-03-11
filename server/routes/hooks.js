const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const { stmts, db } = require("../db");
const { broadcast } = require("../websocket");

const router = Router();

/**
 * Parse a Claude Code transcript JSONL file and extract cumulative token usage per model.
 * Returns null if the file can't be read or has no usage data.
 */
function extractTokensFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    const content = fs.readFileSync(transcriptPath, "utf8");
    const tokensByModel = {};
    for (const line of content.split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        // Transcript JSONL nests model/usage inside entry.message
        const msg = entry.message || entry;
        const model = msg.model;
        if (!model || model === "<synthetic>" || !msg.usage) continue;
        if (!tokensByModel[model]) {
          tokensByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[model].input += msg.usage.input_tokens || 0;
        tokensByModel[model].output += msg.usage.output_tokens || 0;
        tokensByModel[model].cacheRead += msg.usage.cache_read_input_tokens || 0;
        tokensByModel[model].cacheWrite += msg.usage.cache_creation_input_tokens || 0;
      } catch {
        continue;
      }
    }
    return Object.keys(tokensByModel).length > 0 ? tokensByModel : null;
  } catch {
    return null;
  }
}

function ensureSession(sessionId, data) {
  let session = stmts.getSession.get(sessionId);
  if (!session) {
    stmts.insertSession.run(
      sessionId,
      data.session_name || `Session ${sessionId.slice(0, 8)}`,
      "active",
      data.cwd || null,
      data.model || null,
      null
    );
    session = stmts.getSession.get(sessionId);
    broadcast("session_created", session);

    // Create main agent for new session
    const mainAgentId = `${sessionId}-main`;
    stmts.insertAgent.run(
      mainAgentId,
      sessionId,
      "Main Agent",
      "main",
      null,
      "connected",
      null,
      null,
      null
    );
    broadcast("agent_created", stmts.getAgent.get(mainAgentId));
  }
  return session;
}

function getMainAgent(sessionId) {
  return stmts.getAgent.get(`${sessionId}-main`);
}

const processEvent = db.transaction((hookType, data) => {
  const sessionId = data.session_id;
  if (!sessionId) return null;

  ensureSession(sessionId, data);
  const mainAgent = getMainAgent(sessionId);
  const mainAgentId = mainAgent?.id ?? null;

  let eventType = hookType;
  let toolName = data.tool_name || null;
  let summary = null;
  let agentId = mainAgentId;

  switch (hookType) {
    case "PreToolUse": {
      summary = `Using tool: ${toolName}`;

      // If the tool is Agent, a subagent is being created
      if (toolName === "Agent") {
        const input = data.tool_input || {};
        const subId = uuidv4();
        // Use description, then type, then first line of prompt, then fallback
        const rawName =
          input.description ||
          input.subagent_type ||
          (input.prompt ? input.prompt.split("\n")[0].slice(0, 60) : null) ||
          "Subagent";
        const subName = rawName.length > 60 ? rawName.slice(0, 57) + "..." : rawName;
        stmts.insertAgent.run(
          subId,
          sessionId,
          subName,
          "subagent",
          input.subagent_type || null,
          "working",
          input.prompt ? input.prompt.slice(0, 500) : null,
          mainAgentId,
          input.metadata ? JSON.stringify(input.metadata) : null
        );
        broadcast("agent_created", stmts.getAgent.get(subId));
        agentId = subId;
        summary = `Subagent spawned: ${subName}`;
      }

      // Update main agent status — but only if it's actively running.
      // Skip if idle (waiting for subagents) or already completed.
      if (mainAgent && (mainAgent.status === "working" || mainAgent.status === "connected")) {
        stmts.updateAgent.run(null, "working", null, toolName, null, null, mainAgentId);
        broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
      }
      break;
    }

    case "PostToolUse": {
      summary = `Tool completed: ${toolName}`;

      // NOTE: PostToolUse for "Agent" tool fires immediately when a subagent is
      // backgrounded — it does NOT mean the subagent finished its work.
      // Subagent completion is handled by SubagentStop, not here.

      // Only clear current_tool on the main agent if it's actively working.
      // Skip if idle (waiting for subagents) or already completed.
      if (mainAgent && mainAgent.status === "working") {
        stmts.updateAgent.run(null, null, null, null, null, null, mainAgentId);
        broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
      }
      break;
    }

    case "Stop": {
      summary = `Session ended: ${data.stop_reason || "completed"}`;
      const endStatus = data.stop_reason === "error" ? "error" : "completed";

      // Complete all agents in this session — including subagents.
      // When Stop fires the main process is done; any subagents that haven't
      // sent SubagentStop are orphaned and should not stay "working".
      const agents = stmts.listAgentsBySession.all(sessionId);
      const now = new Date().toISOString();
      for (const agent of agents) {
        if (agent.status === "working" || agent.status === "connected" || agent.status === "idle") {
          stmts.updateAgent.run(null, "completed", null, null, now, null, agent.id);
          broadcast("agent_updated", stmts.getAgent.get(agent.id));
        }
      }

      stmts.updateSession.run(null, endStatus, now, null, sessionId);
      broadcast("session_updated", stmts.getSession.get(sessionId));
      break;
    }

    case "SubagentStop": {
      summary = `Subagent completed`;
      const subagents = stmts.listAgentsBySession.all(sessionId);
      let matchingSub = null;

      // Try to identify which subagent stopped using available data
      const subDesc = data.description || data.subagent_type || null;
      if (subDesc) {
        const namePrefix = subDesc.length > 57 ? subDesc.slice(0, 57) : subDesc;
        matchingSub = subagents.find(
          (a) => a.type === "subagent" && a.status === "working" && a.name.startsWith(namePrefix)
        );
      }

      if (!matchingSub) {
        const prompt = data.prompt ? data.prompt.slice(0, 500) : null;
        if (prompt) {
          matchingSub = subagents.find(
            (a) => a.type === "subagent" && a.status === "working" && a.task === prompt
          );
        }
      }

      // Fallback: oldest working subagent
      if (!matchingSub) {
        matchingSub = subagents.find((a) => a.type === "subagent" && a.status === "working");
      }

      if (matchingSub) {
        stmts.updateAgent.run(
          null,
          "completed",
          null,
          null,
          new Date().toISOString(),
          null,
          matchingSub.id
        );
        broadcast("agent_updated", stmts.getAgent.get(matchingSub.id));
        agentId = matchingSub.id;
        summary = `Subagent completed: ${matchingSub.name}`;

        // If all subagents done and main isn't working, complete the session
        const remainingWorking = subagents.filter(
          (a) => a.type === "subagent" && a.status === "working" && a.id !== matchingSub.id
        );
        if (remainingWorking.length === 0) {
          const session = stmts.getSession.get(sessionId);
          if (session && session.status === "active") {
            const currentMain = getMainAgent(sessionId);
            if (!currentMain || currentMain.status !== "working") {
              const completedAt = new Date().toISOString();
              // Complete the main agent too if it's idle/connected
              if (
                currentMain &&
                (currentMain.status === "idle" || currentMain.status === "connected")
              ) {
                stmts.updateAgent.run(
                  null,
                  "completed",
                  null,
                  null,
                  completedAt,
                  null,
                  currentMain.id
                );
                broadcast("agent_updated", stmts.getAgent.get(currentMain.id));
              }
              stmts.updateSession.run(null, "completed", completedAt, null, sessionId);
              broadcast("session_updated", stmts.getSession.get(sessionId));
            }
          }
        }
      }
      break;
    }

    case "Notification": {
      summary = data.message || "Notification received";
      break;
    }

    default: {
      summary = `Event: ${hookType}`;
    }
  }

  // Extract token usage from transcript on every event that provides transcript_path.
  // Claude Code hooks don't include usage/model in stdin — the transcript JSONL is
  // the only reliable source. Using replaceTokenUsage (overwrite, not accumulate)
  // since we compute totals from the full transcript each time.
  if (data.transcript_path) {
    const tokensByModel = extractTokensFromTranscript(data.transcript_path);
    if (tokensByModel) {
      for (const [model, tokens] of Object.entries(tokensByModel)) {
        stmts.replaceTokenUsage.run(
          sessionId,
          model,
          tokens.input,
          tokens.output,
          tokens.cacheRead,
          tokens.cacheWrite
        );
      }
    }
  }

  stmts.insertEvent.run(
    sessionId,
    agentId,
    eventType,
    toolName,
    summary,
    JSON.stringify(data)
    // created_at uses default
  );

  const event = {
    session_id: sessionId,
    agent_id: agentId,
    event_type: eventType,
    tool_name: toolName,
    summary,
    created_at: new Date().toISOString(),
  };
  broadcast("new_event", event);
  return event;
});

router.post("/event", (req, res) => {
  const { hook_type, data } = req.body;
  if (!hook_type || !data) {
    return res.status(400).json({
      error: { code: "INVALID_INPUT", message: "hook_type and data are required" },
    });
  }

  const result = processEvent(hook_type, data);
  if (!result) {
    return res.status(400).json({
      error: { code: "MISSING_SESSION", message: "session_id is required in data" },
    });
  }

  res.json({ ok: true, event: result });
});

module.exports = router;
