/**
 * @file Express router for handling incoming hook events from Claude CLI. It processes various hook types (PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, SessionEnd, Notification), updates session and agent states accordingly in the database, extracts token usage from transcripts, detects compaction events, and broadcasts updates to connected clients via WebSocket.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { Router } = require("express");
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const { stmts, db } = dbModule;
const { broadcast } = require("../websocket");
const TranscriptCache = require("../lib/transcript-cache");
const { scanAndImportSubagents } = require("../../scripts/import-history");
const { evaluateEvent } = require("../lib/alerts");
const { ingestWorkflowsForSession } = require("../lib/workflow-ingest");
// Required as a module object (not destructured) so tests can swap
// `liveness.probeLiveCwds` and the watchdog picks the stub up at call time.
const liveness = require("../lib/session-liveness");

const router = Router();

// Shared cache instance — reused by periodic compaction scanner via router.transcriptCache
const transcriptCache = new TranscriptCache();

// Stale-session threshold for the SessionStart cleanup pass. Mirrors the
// periodic sweep in server/index.js so both code paths agree on what counts
// as "abandoned". Configurable via DASHBOARD_STALE_MINUTES; default 180 (3h).
const STALE_MINUTES = (() => {
  const raw = parseInt(process.env.DASHBOARD_STALE_MINUTES, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 180;
})();

// Detect Notification messages that indicate Claude Code is blocked waiting
// for the user (permission prompt or "waiting for your input" notice). Idle
// notifications such as "Claude has finished responding" intentionally do
// NOT match — those don't actually block the session.
const WAITING_INPUT_PATTERN =
  /\bpermission\b|waiting (?:for )?(?:your )?(?:input|response|reply|approval)|needs?\s+your\s+(?:input|approval|response|attention)|approval\s+(?:needed|required)|awaiting\s+(?:your\s+)?(?:input|approval|response)/i;

function isWaitingForUserMessage(msg) {
  if (!msg || typeof msg !== "string") return false;
  return WAITING_INPUT_PATTERN.test(msg);
}

function clearAwaitingInput(sessionId, mainAgentId, broadcastUpdates) {
  // Clear waiting flag on the main agent and any other agents on this session
  // (subagents don't normally enter waiting state, but keep them in sync just
  // in case a future notification path stamps one).
  const cleared = stmts.clearSessionAgentsAwaitingInput.run(sessionId);
  const sessCleared = stmts.clearSessionAwaitingInput.run(sessionId);
  if (broadcastUpdates && cleared.changes > 0 && mainAgentId) {
    const refreshedMain = stmts.getAgent.get(mainAgentId);
    if (refreshedMain) broadcast("agent_updated", refreshedMain);
  }
  if (broadcastUpdates && sessCleared.changes > 0) {
    const refreshedSess = stmts.getSession.get(sessionId);
    if (refreshedSess) broadcast("session_updated", refreshedSess);
  }
}

// Land a session that was cancelled with no hook (Esc) in the same
// waiting + awaiting-input state a normal Stop produces, and log a timeline
// event. Used by both watchdog recovery paths: the transcript-marker path
// (interrupt after some output) and the idle-timeout path (interrupt before
// any output, which leaves no marker at all). Caller is responsible for the
// gating (agent must be "working" and not already awaiting).
function recoverInterruptedSession(sessionId, fullSess, mainAgentId, reasonSuffix) {
  const ts = new Date().toISOString();
  if (mainAgentId) {
    stmts.updateAgent.run(null, "waiting", null, null, null, null, mainAgentId);
  }
  stmts.setSessionAwaitingInput.run(ts, sessionId);
  if (mainAgentId) stmts.setAgentAwaitingInput.run(ts, mainAgentId);

  const label = fullSess?.name || `Session ${sessionId.slice(0, 8)}`;
  const summary = reasonSuffix ? `${label} - ${reasonSuffix}` : `${label} - interrupted by user`;
  stmts.insertEvent.run(sessionId, mainAgentId, "Interrupted", null, summary, null);

  broadcast("session_updated", stmts.getSession.get(sessionId));
  if (mainAgentId) broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
  broadcast("new_event", {
    session_id: sessionId,
    agent_id: mainAgentId,
    event_type: "Interrupted",
    tool_name: null,
    summary,
    created_at: ts,
  });
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
    if (!session) {
      console.error(`[HOOKS] Failed to create session ${sessionId} — insert returned no row`);
      return null;
    }
    broadcast("session_created", session);

    // Create main agent for new session
    const mainAgentId = `${sessionId}-main`;
    const sessionLabel = session.name || `Session ${sessionId.slice(0, 8)}`;
    stmts.insertAgent.run(
      mainAgentId,
      sessionId,
      `Main Agent - ${sessionLabel}`,
      "main",
      null,
      "working",
      null,
      null,
      null
    );
    const mainAgent = stmts.getAgent.get(mainAgentId);
    if (mainAgent) broadcast("agent_created", mainAgent);
  }

  // First-seen transcript_path → write to session row so the periodic sweep
  // doesn't have to scan events for it. Idempotent via the SQL guard
  // (NULL/'' check), so subsequent hooks for the same session are no-ops.
  // Type guard: hook payloads are unvalidated JSON — a non-string value would
  // make better-sqlite3 throw inside the surrounding processEvent transaction.
  if (typeof data.transcript_path === "string" && data.transcript_path) {
    stmts.setSessionTranscriptPath.run(data.transcript_path, sessionId);
  }
  return session;
}

function getMainAgent(sessionId) {
  return stmts.getAgent.get(`${sessionId}-main`);
}

/**
 * True when `name` is an auto-generated / placeholder label rather than a
 * meaningful title the user picked. Covers:
 *   - empty / null
 *   - the hook fallback "Session <id8>"
 *   - the import-history fallbacks derived from cwd ("<folder>", "<folder> -
 *     <id8>", "<folder> (<slug>)")
 * Such names are safe to overwrite with a transcript-derived ai-title; a real
 * user-chosen name is not.
 */
function isAutoSessionName(name, sessionId, cwd) {
  if (!name || !name.trim()) return true;
  if (name === `Session ${sessionId.slice(0, 8)}`) return true;
  if (cwd) {
    const base = require("path").basename(cwd);
    if (base && (name === base || name.startsWith(`${base} - `) || name.startsWith(`${base} (`))) {
      return true;
    }
  }
  return false;
}

/**
 * Short display label derived from the transcript's first user prompt.
 * Mirrors the 60-char subagent-name truncation used in PreToolUse so
 * descriptor-named rows read consistently across the board.
 */
function firstUserLabel(result) {
  const raw = result && typeof result.firstUserMessage === "string" ? result.firstUserMessage : "";
  const text = raw.trim();
  if (!text) return null;
  return text.length > 60 ? text.slice(0, 57) + "..." : text;
}

/**
 * True when the main agent's name is still an auto-generated label:
 * "Main Agent" (seed/API fallback) or "Main Agent - <auto session label>"
 * (hook / import creation paths). A suffix that is a real title — or the
 * user's own rename — makes the name non-auto and it is never overwritten.
 */
function isAutoMainAgentName(name, sessionId, cwd) {
  if (!name || !name.trim()) return true;
  if (name === "Main Agent") return true;
  const prefix = "Main Agent - ";
  if (name.startsWith(prefix)) return isAutoSessionName(name.slice(prefix.length), sessionId, cwd);
  return false;
}

/**
 * Keep sessions.name in sync with the transcript's human-readable title.
 * Source of truth lives in the JSONL as `custom-title` (explicit /rename,
 * `claude -n`, picker Ctrl+R) and `ai-title` (auto / plan-accept) lines, which
 * the TranscriptCache surfaces on every extract. Precedence: an explicit
 * custom title always wins; an ai-title only fills in when the current name is
 * still an auto/placeholder label (so a name the user set in the dashboard or
 * via /rename is never clobbered by the auto-generated title). A name that
 * equals the first-user-prompt descriptor (applied by
 * applyFirstUserDescriptor when no title existed yet) counts as replaceable
 * too — the descriptor sits BELOW both title kinds, so a later ai-title must
 * still be able to take over. Broadcasts session_updated only on a real
 * change so the UI updates in real time.
 */
function syncSessionName(session, result) {
  if (!session || !result) return;
  const custom = result.customTitle && result.customTitle.trim();
  const ai = result.aiTitle && result.aiTitle.trim();
  const desired = custom || ai || null;
  if (!desired) return;
  const replaceable =
    isAutoSessionName(session.name, session.id, session.cwd) ||
    session.name === firstUserLabel(result);
  if (!custom && !replaceable) return;
  const upd = stmts.updateSessionName.run(desired, session.id, desired);
  if (upd.changes > 0) {
    const refreshed = stmts.getSession.get(session.id);
    if (refreshed) broadcast("session_updated", refreshed);
  }
}

/**
 * Fallback descriptor from the session's first user prompt (issue #201).
 * Fills sessions.name and the main agent's name/task ONLY while those fields
 * still hold their auto-generated placeholders, so a custom-title, ai-title,
 * or user-set name is never clobbered. Must run strictly AFTER
 * syncSessionName within the same pass: title sync gets first claim on the
 * name, and this helper re-reads the rows so it sees the result. Idempotent —
 * once applied (or once real names exist), every subsequent call is a no-op
 * with no broadcast.
 */
function applyFirstUserDescriptor(sessionId, result) {
  const label = firstUserLabel(result);
  if (!label) return;

  const session = stmts.getSession.get(sessionId);
  if (session && isAutoSessionName(session.name, session.id, session.cwd)) {
    const upd = stmts.updateSessionName.run(label, session.id, label);
    if (upd.changes > 0) {
      const refreshed = stmts.getSession.get(session.id);
      if (refreshed) broadcast("session_updated", refreshed);
    }
  }

  const mainAgent = getMainAgent(sessionId);
  if (!mainAgent) return;
  const desiredName = `Main Agent - ${label}`;
  const fillName =
    isAutoMainAgentName(mainAgent.name, sessionId, session?.cwd) && mainAgent.name !== desiredName;
  const fillTask = !mainAgent.task || !String(mainAgent.task).trim();
  if (!fillName && !fillTask) return;
  // updateAgent writes current_tool VERBATIM (no COALESCE) — pass the
  // existing value through, or this out-of-band update would wipe an
  // in-flight tool mid-turn.
  stmts.updateAgent.run(
    fillName ? desiredName : null,
    null,
    fillTask ? result.firstUserMessage : null,
    mainAgent.current_tool,
    null,
    null,
    mainAgent.id
  );
  const refreshedAgent = stmts.getAgent.get(mainAgent.id);
  if (refreshedAgent) broadcast("agent_updated", refreshedAgent);
}

const processEvent = db.transaction((hookType, data) => {
  const sessionId = data.session_id;
  if (!sessionId) return null;

  const session = ensureSession(sessionId, data);
  let mainAgent = getMainAgent(sessionId);
  const mainAgentId = mainAgent?.id ?? null;

  // Reactivate non-active sessions when we receive hook events proving the session is alive.
  // - UserPromptSubmit and PreToolUse always reactivate (user actively retried, even from error).
  // - Other work events (PostToolUse, Notification, SessionStart) reactivate non-error sessions.
  // - Stop/SubagentStop reactivate only if session is completed/abandoned — this handles
  //   sessions imported as "completed" before the server started, where the first hook event
  //   might be a Stop. For error sessions, Stop should NOT reactivate.
  // - SessionEnd never reactivates.
  const isUserAction = hookType === "UserPromptSubmit" || hookType === "PreToolUse";
  const isNonTerminalEvent = hookType !== "SessionEnd";
  const isStopLike = hookType === "Stop" || hookType === "SubagentStop";
  const isImportedOrAbandoned = session.status === "completed" || session.status === "abandoned";
  const needsReactivation =
    session.status !== "active" &&
    isNonTerminalEvent &&
    (isUserAction ||
      (!isStopLike && session.status !== "error") ||
      (isStopLike && isImportedOrAbandoned));
  if (needsReactivation) {
    stmts.reactivateSession.run(sessionId);
    broadcast("session_updated", stmts.getSession.get(sessionId));

    if (mainAgent && mainAgent.status !== "working") {
      stmts.reactivateAgent.run(mainAgentId);
      mainAgent = stmts.getAgent.get(mainAgentId);
      broadcast("agent_updated", mainAgent);
    }
  }

  let eventType = hookType;
  let toolName = data.tool_name || null;
  let summary = null;
  let agentId = mainAgentId;

  // NOTE: clearing of awaiting_input_since is handled per-case below rather
  // than blanket-clearing on every non-Notification event. The blanket rule
  // caused spontaneous waiting → active flips when *any* hook arrived after
  // a Stop — most commonly SubagentStop for backgrounded subagents, but
  // also occasionally a late PostToolUse from a background tool. A subagent
  // or background tool finishing tells us nothing about whether the human
  // has actually responded, so those events must NOT clear the flag.

  switch (hookType) {
    case "PreToolUse": {
      summary = `Using tool: ${toolName}`;

      // PreToolUse means Claude is actively running a tool, ergo the user
      // has resumed (Stop only fires at end of turn — Claude can't start a
      // new tool call without fresh user input). Clear waiting now.
      clearAwaitingInput(sessionId, mainAgentId, true);

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

        // Infer which agent is spawning this subagent.
        // Hook events don't carry an explicit agent ID, so we use a heuristic:
        //   - If the main agent is actively working, it's the one spawning (common case).
        //   - If the main agent is waiting (for user or subagent results),
        //     the spawn must come from an already-running subagent — pick the deepest
        //     working subagent (most recently nested active agent).
        //   - Fallback to main if nothing else matches.
        let parentId = mainAgentId;
        if (mainAgent && mainAgent.status !== "working") {
          const deepest = stmts.findDeepestWorkingAgent.get(sessionId, sessionId);
          if (deepest) {
            parentId = deepest.id;
          }
        }

        stmts.insertAgent.run(
          subId,
          sessionId,
          subName,
          "subagent",
          input.subagent_type || null,
          "working",
          input.prompt ? input.prompt.slice(0, 500) : null,
          parentId,
          input.metadata ? JSON.stringify(input.metadata) : null
        );
        broadcast("agent_created", stmts.getAgent.get(subId));
        agentId = subId;
        summary = `Subagent spawned: ${subName}`;
      }

      // Update main agent status to "working" — but only when main is the likely
      // actor. When main is waiting and working subagents exist, PreToolUse events
      // come from subagents, not main. Incorrectly promoting main to "working"
      // would break parent inference for nested agent spawning.
      //
      // Heuristic: main is waiting + working subagents exist → subagent is the actor.
      //            main is working/waiting with no subagents → main is the actor.
      const deepestWorking =
        mainAgent && mainAgent.status === "waiting"
          ? stmts.findDeepestWorkingAgent.get(sessionId, sessionId)
          : null;
      const subagentIsActor = !!deepestWorking;
      if (subagentIsActor && toolName !== "Agent") {
        agentId = deepestWorking.id;
      }
      if (
        mainAgent &&
        !subagentIsActor &&
        (mainAgent.status === "working" || mainAgent.status === "waiting")
      ) {
        stmts.updateAgent.run(null, "working", null, toolName, null, null, mainAgentId);
        broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
      }
      break;
    }

    case "PostToolUse": {
      summary = `Tool completed: ${toolName}`;

      // Clear waiting too. The non-obvious case this covers: a permission
      // Notification fires *between* PreToolUse and PostToolUse (when Claude
      // Code prompts the user mid-tool). The Notification stamps waiting,
      // the user approves, the tool completes, PostToolUse arrives. Without
      // a clear here, we'd be stuck in waiting until the next PreToolUse.
      clearAwaitingInput(sessionId, mainAgentId, true);

      // NOTE: PostToolUse for "Agent" tool fires immediately when a subagent is
      // backgrounded — it does NOT mean the subagent finished its work.
      // Subagent completion is handled by SubagentStop, not here.

      // Attribute to the working subagent when main is waiting (same heuristic as PreToolUse).
      if (mainAgent && mainAgent.status === "waiting" && toolName !== "Agent") {
        const deepest = stmts.findDeepestWorkingAgent.get(sessionId, sessionId);
        if (deepest) {
          agentId = deepest.id;
        }
      }

      // Only clear current_tool on the main agent if it's actively working.
      // Skip if waiting (waiting for subagents) or already completed.
      if (mainAgent && mainAgent.status === "working") {
        stmts.updateAgent.run(null, null, null, null, null, null, mainAgentId);
        broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
      }
      break;
    }

    case "Stop": {
      const session = stmts.getSession.get(sessionId);
      const sessionLabel = session?.name || `Session ${sessionId.slice(0, 8)}`;
      summary =
        data.stop_reason === "error"
          ? `Error in ${sessionLabel}`
          : `${sessionLabel} - ready for input`;

      // Stop means Claude finished its turn, NOT that the session is closed.
      // Session stays active — user can still send more messages.
      // Background subagents may still be running — do NOT complete them
      // here. They complete via SubagentStop, or all at once on SessionEnd.
      //
      // CRITICAL: do all DB writes BEFORE any broadcast, then broadcast the
      // final state once. An earlier version broadcast agent_updated twice
      // which made the agent flicker out of every Kanban column for a
      // tick — visible to users as "agent skipped waiting and went to
      // completed".
      const now = new Date().toISOString();
      const agentMutable =
        !!mainAgent && mainAgent.status !== "completed" && mainAgent.status !== "error";

      if (data.stop_reason === "error") {
        if (agentMutable) {
          stmts.updateAgent.run(null, "error", null, null, null, null, mainAgentId);
        }
        stmts.updateSession.run(null, "error", now, null, sessionId);
        // Error stop is terminal-ish — drop any waiting flag so the row
        // lands cleanly in the Error column.
        clearAwaitingInput(sessionId, mainAgentId, false);
      } else {
        if (agentMutable) {
          stmts.updateAgent.run(null, "waiting", null, null, null, null, mainAgentId);
        }
        // Stamp the waiting flag in the same DB pass as the status update so
        // the post-write read returns a consistent (waiting, awaiting=set)
        // row.
        stmts.setSessionAwaitingInput.run(now, sessionId);
        if (mainAgentId) stmts.setAgentAwaitingInput.run(now, mainAgentId);
      }

      // Now broadcast — single agent_updated reflecting the final state.
      broadcast("session_updated", stmts.getSession.get(sessionId));
      if (mainAgentId) {
        broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
      }
      break;
    }

    case "SubagentStop": {
      summary = `Subagent completed`;
      const subagents = stmts.listAgentsBySession.all(sessionId);
      let matchingSub = null;

      // Try to identify which subagent stopped using available data.
      // SubagentStop provides: agent_type (e.g. "Explore", "test-engineer"),
      // agent_id (Claude's internal ID), description, last_assistant_message.
      const subDesc = data.description || data.agent_type || data.subagent_type || null;
      if (subDesc) {
        const namePrefix = subDesc.length > 57 ? subDesc.slice(0, 57) : subDesc;
        matchingSub = subagents.find(
          (a) => a.type === "subagent" && a.status === "working" && a.name.startsWith(namePrefix)
        );
      }

      // Try matching by agent_type against stored subagent_type
      if (!matchingSub && data.agent_type) {
        matchingSub = subagents.find(
          (a) =>
            a.type === "subagent" && a.status === "working" && a.subagent_type === data.agent_type
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

        // Session stays active — SubagentStop just means one subagent finished,
        // the session is not over until the user explicitly closes it.
      }
      break;
    }

    case "SessionStart": {
      summary = data.source === "resume" ? "Session resumed" : "Session started";

      // Reactivation is already handled above for non-active sessions.
      // Promote main agent from waiting → working if needed.
      if (mainAgent && mainAgent.status === "waiting") {
        stmts.updateAgent.run(null, "working", null, null, null, null, mainAgentId);
      }

      // A just-started or just-resumed session is sitting at a prompt
      // waiting for the user's first message — Claude Code hasn't done
      // anything yet. Stamp awaiting_input_since so it lands in Waiting
      // from the moment the dashboard sees it. UserPromptSubmit (when the
      // user hits enter) or PreToolUse (when Claude actually runs a tool)
      // will clear the flag.
      const sessionStartTs = new Date().toISOString();
      stmts.setSessionAwaitingInput.run(sessionStartTs, sessionId);
      if (mainAgentId) stmts.setAgentAwaitingInput.run(sessionStartTs, mainAgentId);

      // Single broadcast pair with the final state — agents and sessions
      // are now connected/active with the waiting flag set, so WS clients
      // see the Waiting badge as soon as the SessionStart event lands.
      broadcast("session_updated", stmts.getSession.get(sessionId));
      if (mainAgentId) broadcast("agent_updated", stmts.getAgent.get(mainAgentId));

      // Clean up orphaned sessions: when a user runs /resume inside a session,
      // the parent session never receives Stop or SessionEnd. Mark any active
      // session that hasn't seen events for STALE_MINUTES as abandoned.
      const staleSessions = stmts.findStaleSessions.all(sessionId, STALE_MINUTES);
      const now = new Date().toISOString();
      for (const stale of staleSessions) {
        const staleAgents = stmts.listAgentsBySession.all(stale.id);
        for (const agent of staleAgents) {
          if (agent.status !== "completed" && agent.status !== "error") {
            stmts.updateAgent.run(null, "completed", null, null, now, null, agent.id);
            broadcast("agent_updated", stmts.getAgent.get(agent.id));
          }
        }
        stmts.updateSession.run(null, "abandoned", now, null, stale.id);
        broadcast("session_updated", stmts.getSession.get(stale.id));
      }
      break;
    }

    case "SessionEnd": {
      const endSession = stmts.getSession.get(sessionId);
      const endLabel = endSession?.name || `Session ${sessionId.slice(0, 8)}`;
      summary = `Session closed: ${endLabel}`;

      // Session is terminating — drop any waiting flag so the row lands in
      // its final column without a leftover yellow overlay.
      clearAwaitingInput(sessionId, mainAgentId, false);

      // SessionEnd is the definitive signal that the CLI process exited.
      // Keep `error` ONLY if the error is still unrecovered at the transcript
      // tail. A transient API error that the CLI retried past (successful turns
      // after it) has recovered, so exiting after a long healthy run must land
      // as `completed`, not a stale `error` frozen from days earlier.
      const endResult = data.transcript_path ? transcriptCache.extract(data.transcript_path) : null;
      const finalSessionStatus =
        endSession?.status === "error" && isErrorAtTail(endResult) ? "error" : "completed";
      const allAgents = stmts.listAgentsBySession.all(sessionId);
      const now = new Date().toISOString();
      for (const agent of allAgents) {
        if (agent.status !== "completed" && agent.status !== "error") {
          const agentFinal = finalSessionStatus === "error" ? "error" : "completed";
          stmts.updateAgent.run(null, agentFinal, null, null, now, null, agent.id);
          broadcast("agent_updated", stmts.getAgent.get(agent.id));
        }
      }
      stmts.updateSession.run(null, finalSessionStatus, now, null, sessionId);
      broadcast("session_updated", stmts.getSession.get(sessionId));

      break;
    }

    case "UserPromptSubmit": {
      // User just hit enter on a new prompt. This is the unambiguous
      // "session resumed" signal — fires before Claude does anything,
      // unlike PreToolUse which only fires for tool-using turns. Clear
      // the Waiting flag and promote the main agent to Working so the
      // dashboard reflects "Claude is now thinking on this" through the
      // entire response, including text-only replies that emit no
      // PreToolUse before Stop.
      summary = "User prompt submitted";
      clearAwaitingInput(sessionId, mainAgentId, true);
      if (mainAgent && mainAgent.status !== "completed" && mainAgent.status !== "error") {
        stmts.updateAgent.run(null, "working", null, null, null, null, mainAgentId);
        broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
      }
      break;
    }

    case "Notification": {
      const msg = data.message || "Notification received";
      // Tag compaction-related notifications so they show as Compaction events
      if (/compact|compress|context.*(reduc|truncat|summar)/i.test(msg)) {
        eventType = "Compaction";
        summary = msg;
      } else if (isWaitingForUserMessage(msg)) {
        // Claude Code is blocked waiting for the user (permission prompt or
        // explicit "waiting for input" notice). Stamp session + main agent
        // so the dashboard can surface a yellow "Waiting" badge until the
        // user responds — at which point the next PreToolUse/Stop clears it.
        const ts = new Date().toISOString();
        stmts.setSessionAwaitingInput.run(ts, sessionId);
        broadcast("session_updated", stmts.getSession.get(sessionId));
        if (mainAgentId) {
          stmts.updateAgent.run(null, "waiting", null, null, null, null, mainAgentId);
          stmts.setAgentAwaitingInput.run(ts, mainAgentId);
          broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
        }
        summary = msg;
      } else {
        summary = msg;
      }
      break;
    }

    default: {
      summary = `Event: ${hookType}`;
    }
  }

  // Extract token usage from transcript on every event that provides transcript_path.
  // Claude Code hooks don't include usage/model in stdin — the transcript JSONL is
  // the only reliable source. Uses replaceTokenUsage with compaction-aware logic:
  // when the JSONL total drops (compaction rewrote it), the old value rolls into
  // a baseline column so effective_total = current_jsonl + baseline. This ensures
  // tokens from before compaction are never lost.
  //
  // Also detects compaction events (isCompactSummary in JSONL) and creates a
  // Compaction agent + event so the dashboard shows when context was compressed.
  if (data.transcript_path) {
    const result = transcriptCache.extract(data.transcript_path);
    if (result) {
      const { tokensByModel, compaction, latestModel } = result;

      // Keep session.model in sync with the user's *current* model — the
      // transcript's most recent assistant entry is the source of truth, since
      // the /model command rewrites future entries but leaves session.model
      // (set at session creation) alone. The prepared statement is a no-op
      // when the value is unchanged, so we only broadcast on real flips.
      if (latestModel) {
        const upd = stmts.updateSessionModel.run(latestModel, sessionId, latestModel);
        if (upd.changes > 0) {
          const refreshed = stmts.getSession.get(sessionId);
          if (refreshed) broadcast("session_updated", refreshed);
        }
      }

      // Keep the displayed session name in sync with the transcript title
      // (set via /rename, `claude -n`, or the auto ai-title). Re-read the row
      // so we see any name set earlier in this same transaction.
      syncSessionName(stmts.getSession.get(sessionId), result);

      // Then let the first user prompt fill whatever placeholders remain
      // (session name, main agent name/task). Runs on every transcript-bearing
      // event — live on UserPromptSubmit, and as backfill for sessions that
      // never get a title (including imported ones) on any later event.
      applyFirstUserDescriptor(sessionId, result);

      // Register compaction agents and events.
      // Each isCompactSummary entry in the JSONL = one compaction that occurred.
      // Deduplicate by uuid so we only create once per compaction.
      if (compaction) {
        for (const entry of compaction.entries) {
          const compactId = `${sessionId}-compact-${entry.uuid}`;
          if (stmts.getAgent.get(compactId)) continue;

          const ts = entry.timestamp || new Date().toISOString();
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
          // Compaction is an instantaneous transition. Stamp started_at and
          // ended_at to the same transcript timestamp so duration is exactly 0.
          // Without this, insertAgent's default started_at = NOW (ingestion
          // wall clock) is paired with ended_at = ts (transcript time in the
          // past), producing impossible negative durations (issue #156).
          db.prepare(
            "UPDATE agents SET started_at = ?, ended_at = ?, updated_at = ? WHERE id = ?"
          ).run(ts, ts, ts, compactId);
          broadcast("agent_created", stmts.getAgent.get(compactId));

          const compactSummary = `Context compacted - conversation history compressed (#${compaction.entries.indexOf(entry) + 1})`;
          stmts.insertEvent.run(
            sessionId,
            compactId,
            "Compaction",
            null,
            compactSummary,
            JSON.stringify({
              uuid: entry.uuid,
              timestamp: ts,
              compaction_number: compaction.entries.indexOf(entry) + 1,
              total_compactions: compaction.count,
            })
          );
          broadcast("new_event", {
            session_id: sessionId,
            agent_id: compactId,
            event_type: "Compaction",
            tool_name: null,
            summary: compactSummary,
            created_at: ts,
          });
        }
      }

      if (tokensByModel) {
        // Each bucket carries its pricing dimensions (model/speed/geo/tier) plus
        // the 1h cache-write split and server-tool request counts.
        for (const tokens of Object.values(tokensByModel)) {
          stmts.replaceTokenUsage.run(
            sessionId,
            tokens.model,
            tokens.speed,
            tokens.geo,
            tokens.tier,
            tokens.input,
            tokens.output,
            tokens.cacheRead,
            tokens.cacheWrite,
            tokens.cacheWrite1h,
            tokens.webSearch,
            tokens.webFetch,
            tokens.codeExec
          );
        }
      }

      // Register API errors from transcript (quota limits, rate limits, overloaded, etc.)
      if (result.errors) {
        let newErrorRecorded = false;
        for (const apiErr of result.errors) {
          // Deduplicate: check if we already recorded this error (same type+message+timestamp)
          const errKey = `${apiErr.type}:${apiErr.timestamp || ""}`;
          const existing = db
            .prepare(
              `SELECT 1 FROM events WHERE session_id = ? AND event_type = 'APIError'
               AND summary = ? LIMIT 1`
            )
            .get(sessionId, `${apiErr.type}: ${apiErr.message}`);
          if (existing) continue;

          stmts.insertEvent.run(
            sessionId,
            mainAgentId,
            "APIError",
            null,
            `${apiErr.type}: ${apiErr.message}`,
            JSON.stringify(apiErr)
          );
          broadcast("new_event", {
            session_id: sessionId,
            agent_id: mainAgentId,
            event_type: "APIError",
            tool_name: null,
            summary: `${apiErr.type}: ${apiErr.message}`,
            created_at: apiErr.timestamp || new Date().toISOString(),
          });
          newErrorRecorded = true;
        }

        // Flip to error only when we recorded a NEW error this call AND that
        // error is still unrecovered at the transcript tail (isErrorAtTail).
        // The APIError events are always kept for history, but a transient error
        // the CLI already retried past (successful turns after it — e.g.
        // "Connection closed mid-response" mid-run) must NOT trip the whole
        // session to `error`; only a genuinely-current failure should. This is
        // the primary guard against false Error flapping; the self-heal below is
        // the safety net for sessions flipped by older builds. The
        // newErrorRecorded gate also stops re-reads from yanking a recovered
        // session back into error.
        if (newErrorRecorded && isErrorAtTail(result)) {
          const curSession = stmts.getSession.get(sessionId);
          if (curSession && curSession.status === "active") {
            stmts.updateSession.run(null, "error", null, null, sessionId);
            broadcast("session_updated", stmts.getSession.get(sessionId));
          }
          if (mainAgent && mainAgent.status !== "completed" && mainAgent.status !== "error") {
            stmts.updateAgent.run(null, "error", null, null, null, null, mainAgentId);
            clearAwaitingInput(sessionId, mainAgentId, false);
            broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
          }
        }
      }

      // Self-heal a stale error on ANY hook event. If the session is marked
      // `error` but the transcript has progressed past the last API error
      // (successful turns after it — isErrorAtTail false), the error was
      // transient and the session recovered. Normal recovery only fires on
      // UserPromptSubmit/PreToolUse; an actively-running session that only emits
      // Stop / SubagentStop / PostToolUse / Notification would otherwise stay
      // `error` forever even as its transcript (and cost) keeps growing. This
      // complements the watchdog, which only re-examines STALE sessions and so
      // never reaches a busy one. isErrorAtTail is transcript-driven, so a
      // genuinely current error (tail) is left in place.
      {
        const curSession = stmts.getSession.get(sessionId);
        if (curSession && curSession.status === "error" && !isErrorAtTail(result)) {
          stmts.reactivateSession.run(sessionId);
          broadcast("session_updated", stmts.getSession.get(sessionId));
          const curMain = mainAgentId ? stmts.getAgent.get(mainAgentId) : null;
          if (curMain && curMain.status === "error") {
            stmts.reactivateAgent.run(mainAgentId);
            broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
          }
        }
      }

      // Register turn duration events from transcript
      if (result.turnDurations) {
        for (const td of result.turnDurations) {
          const tdTs = td.timestamp || new Date().toISOString();
          // Deduplicate by checking if we already have this turn duration event
          const existing = db
            .prepare(
              "SELECT 1 FROM events WHERE session_id = ? AND event_type = 'TurnDuration' AND created_at = ? LIMIT 1"
            )
            .get(sessionId, tdTs);
          if (existing) continue;

          const tdSummary = `Turn completed in ${(td.durationMs / 1000).toFixed(1)}s`;
          stmts.insertEvent.run(
            sessionId,
            mainAgentId,
            "TurnDuration",
            null,
            tdSummary,
            JSON.stringify({ durationMs: td.durationMs })
          );
          broadcast("new_event", {
            session_id: sessionId,
            agent_id: mainAgentId,
            event_type: "TurnDuration",
            tool_name: null,
            summary: tdSummary,
            created_at: tdTs,
          });
        }
      }

      // Update session metadata with enriched data (thinking blocks, usage extras)
      if (result.usageExtras || result.thinkingBlockCount > 0) {
        const session = stmts.getSession.get(sessionId);
        if (session) {
          const meta = session.metadata ? JSON.parse(session.metadata) : {};
          if (result.usageExtras) {
            meta.usage_extras = result.usageExtras;
          }
          if (result.thinkingBlockCount > 0) {
            meta.thinking_blocks = (meta.thinking_blocks || 0) + result.thinkingBlockCount;
          }
          if (result.turnDurations) {
            meta.turn_count = (meta.turn_count || 0) + result.turnDurations.length;
            const totalMs = result.turnDurations.reduce((s, t) => s + t.durationMs, 0);
            meta.total_turn_duration_ms = (meta.total_turn_duration_ms || 0) + totalMs;
          }
          stmts.updateSession.run(null, null, null, JSON.stringify(meta), sessionId);
        }
      }
    }
  }

  // Evict transcript from cache on SessionEnd — session is done, no more reads expected.
  // Must happen after token extraction above to avoid re-populating the cache.
  if (hookType === "SessionEnd" && data.transcript_path) {
    transcriptCache.invalidate(data.transcript_path);
  }

  // Bump session updated_at on every event
  stmts.touchSession.run(sessionId);

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

  // Evaluate event-driven alert rules after the ingest transaction committed
  // and the response is on its way — alerting must never slow down or fail
  // hook ingestion (evaluateEvent itself is also internally fail-safe).
  try {
    evaluateEvent(result);
  } catch {
    /* non-fatal */
  }

  // After SubagentStop, scan the session's subagent JSONL files and ingest any
  // tool calls that aren't yet in the events table. Subagent tool_use blocks
  // never fire hooks on the parent session — this scan is the only path that
  // attributes them to the subagent's agent_id.
  if (hook_type === "SubagentStop" && data.session_id && data.transcript_path) {
    // Models the MAIN transcript wrote. The subagent scan must SKIP these
    // buckets — the main-transcript writer above owns them, and writing one
    // from two sources of different magnitude would trip replaceTokenUsage's
    // compaction baseline-shift and inflate the total. We pass ALL of them
    // (covers a mid-session /model switch, not just the latest). extract() is
    // stat-cached, so this re-read is a cache hit. The scan falls back to the
    // stored session.model if this list is empty.
    let parentTokenModels = [];
    try {
      const mainResult = transcriptCache.extract(data.transcript_path);
      if (mainResult && mainResult.tokensByModel) {
        parentTokenModels = Object.values(mainResult.tokensByModel)
          .map((b) => b.model)
          .filter(Boolean);
      }
      if (mainResult && mainResult.latestModel) parentTokenModels.push(mainResult.latestModel);
    } catch {
      /* fall back to stored session.model inside the scan */
    }
    scanAndImportSubagents(dbModule, data.session_id, data.transcript_path, {
      parentModels: parentTokenModels,
    })
      .then(({ created, reparented }) => {
        if (created > 0 || reparented > 0) {
          // Nudge SessionDetail to refetch — the page already debounces
          // bursts of new_event into a single paginated reload. A pure
          // re-parent (created === 0) still changes the tree shape, so it
          // must trigger a refetch too.
          broadcast("new_event", {
            session_id: data.session_id,
            agent_id: null,
            event_type: "SubagentJsonlImported",
            tool_name: null,
            summary:
              created > 0 && reparented > 0
                ? `Imported ${created} subagent record(s) and re-parented ${reparented} nested subagent(s)`
                : created > 0
                  ? `Imported ${created} subagent record(s) from JSONL`
                  : `Re-parented ${reparented} nested subagent(s)`,
            created_at: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        // non-fatal — partial JSONL during a live run is expected
      });
  }

  // Ingest Workflow-tool run journals from disk. Inner agent() calls emit NO
  // hooks, so the journal (written at workflow completion) is the only source.
  // Run on the lifecycle hooks that bracket a workflow finishing, off the
  // response path and fail-safe — a partial/absent journal is expected.
  if (
    ["Stop", "SubagentStop", "SessionEnd"].includes(hook_type) &&
    data.session_id &&
    data.transcript_path
  ) {
    ingestWorkflowsForSession(dbModule, {
      id: data.session_id,
      transcript_path: data.transcript_path,
    })
      .then((changed) => {
        if (!changed || changed.length === 0) return;
        for (const wf of changed) broadcast("workflow_upserted", wf);
        // Workflow ingest folds inner-agent tokens into the session cost — nudge
        // the session views to refetch.
        const sess = stmts.getSession.get(data.session_id);
        if (sess) broadcast("session_updated", sess);
      })
      .catch(() => {
        // non-fatal — partial workflow artifacts during a live run are expected
      });
  }
});

// ── Watchdog: detect API errors in active sessions ─────────────────────────
// Claude CLI doesn't fire a hook after API errors (401, rate limit, etc.) —
// the session just sits there with the error in the transcript but no Stop
// or Notification event. This watchdog re-reads transcripts for active
// sessions every 15s to detect errors that hooks missed.
const WATCHDOG_INTERVAL_MS = 15_000;
const STALE_THRESHOLD_MS = 10_000; // only check sessions idle for >10s

// Idle-working timeout for the no-marker interrupt case (Esc pressed before the
// model emits anything → Claude Code writes no interrupt entry and fires no
// hook). When the main agent has been "working" with no tool in flight and
// NEITHER a hook event NOR the transcript has advanced for this long, we treat
// the turn as dead and move the session to waiting-for-input. A genuinely busy
// turn keeps one of those moving (PreToolUse/PostToolUse hooks, or streamed
// output growing the transcript) so it is exempt; a rare false positive
// self-heals on the next real hook. Configurable via DASHBOARD_WORKING_IDLE_SECONDS.
const WORKING_IDLE_MS = (() => {
  const raw = parseInt(process.env.DASHBOARD_WORKING_IDLE_SECONDS, 10);
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : 120_000; // default 2 min
})();

// Idle gate for the liveness reap below. A session is only completed by the
// process probe when BOTH its last hook write (updated_at) and its transcript
// mtime are at least this old, so a session mid-spawn, mid-turn, or freshly
// imported never flickers out on a transient probe miss (e.g. `claude
// --resume` run from a different directory than the recorded session cwd — a
// mismatch that self-heals via hook reactivation on the next prompt).
// Configurable via DASHBOARD_LIVENESS_IDLE_SECONDS; default 60 s.
const LIVENESS_IDLE_MS = (() => {
  const raw = parseInt(process.env.DASHBOARD_LIVENESS_IDLE_SECONDS, 10);
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : 60_000;
})();

// True when the transcript's latest API error is unrecovered — i.e. it sits at
// the tail with no successful turn after it. Claude auto-retries transient API
// errors (e.g. "Connection closed mid-response") and keeps going, so an error
// followed by real turn activity has RECOVERED and must not pin the session in
// `error` forever. Mirrors computePendingInterrupt's ordering logic using the
// timestamps the transcript cache already exposes (errors[].timestamp vs
// lastTurnTs), so it needs no transcript re-parse.
function isErrorAtTail(result) {
  if (!result || !Array.isArray(result.errors) || result.errors.length === 0) return false;
  let lastErrorTs = null;
  for (const e of result.errors) {
    if (e && e.timestamp && (!lastErrorTs || e.timestamp > lastErrorTs)) lastErrorTs = e.timestamp;
  }
  if (!lastErrorTs) return false; // errors without timestamps — can't prove it's current
  if (!result.lastTurnTs) return true; // an error but no turn activity ⇒ unrecovered
  return lastErrorTs >= result.lastTurnTs; // error is the latest activity ⇒ unrecovered
}

function watchdogCheck() {
  try {
    const os = require("os");
    const path = require("path");
    const fs = require("fs");
    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
    // Find active sessions whose last event is older than threshold
    const staleSessions = db
      .prepare(
        `SELECT s.id, s.status, s.cwd,
                (SELECT MAX(e.created_at) FROM events e WHERE e.session_id = s.id) as last_event,
                (SELECT e.data FROM events e WHERE e.session_id = s.id
                 AND e.event_type IN ('SessionStart','UserPromptSubmit','PreToolUse','Stop','Notification')
                 ORDER BY e.created_at DESC LIMIT 1) as last_data
         FROM sessions s
         WHERE s.status IN ('active', 'error') AND s.updated_at < ?`
      )
      .all(cutoff);

    for (const sess of staleSessions) {
      // Try to get transcript_path from event data first
      let tPath = null;
      if (sess.last_data) {
        try {
          tPath = JSON.parse(sess.last_data).transcript_path;
        } catch {}
      }
      // Fall back: derive from Claude's standard path layout
      // Claude slugifies cwd by replacing / with - and keeping the leading -
      if (!tPath && sess.cwd) {
        const slug = sess.cwd.replace(/[\/\.]/g, "-");
        const candidate = path.join(os.homedir(), ".claude", "projects", slug, `${sess.id}.jsonl`);
        if (fs.existsSync(candidate)) tPath = candidate;
      }
      if (!tPath) continue;

      // Use cache directly (stat-based detection handles staleness automatically).
      // Don't invalidate — it defeats caching and forces full re-reads every 15s.
      const result = transcriptCache.extract(tPath);
      if (!result) continue;

      // Pick up a /rename or fresh ai-title even when no hook fired for it —
      // a session left idle right after /rename has no further events, so the
      // watchdog is the path that surfaces the new name within ~15s. The
      // first-user-prompt descriptor backfills remaining placeholders here for
      // the same reason (idle sessions get no further hook events).
      const fullSess = stmts.getSession.get(sess.id);
      if (fullSess) {
        syncSessionName(fullSess, result);
        applyFirstUserDescriptor(sess.id, result);
      }

      const mainAgent = db
        .prepare("SELECT * FROM agents WHERE session_id = ? AND type = 'main' LIMIT 1")
        .get(sess.id);
      const mainAgentId = mainAgent?.id ?? null;

      // Self-heal a stale error. The session was flipped to `error` by a
      // transient API error, but the transcript has since progressed past it
      // (successful turns after the last error) — so it recovered and must not
      // show `error` forever. Recovery normally only happens on a live
      // UserPromptSubmit/PreToolUse hook; a session monitored purely via the
      // transcript sweep (imported, or whose recovering hooks never landed) had
      // no path back. This is why the watchdog now scans `error` sessions too.
      if (sess.status === "error" && !isErrorAtTail(result)) {
        stmts.reactivateSession.run(sess.id);
        broadcast("session_updated", stmts.getSession.get(sess.id));
        if (mainAgent && mainAgent.status === "error") {
          stmts.reactivateAgent.run(mainAgentId);
          broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
        }
        continue; // handled this tick; error is cleared
      }

      // User-interrupt (Esc) recovery. No hook fires when a turn is cancelled,
      // so UserPromptSubmit's "working" promotion is never undone and the main
      // agent is stuck working forever. `pendingInterrupt` is derived purely
      // from transcript ordering (latest interrupt vs latest real turn
      // activity, both on Claude Code's clock): true when the transcript tail
      // is an unrecovered interrupt. We deliberately do NOT compare the
      // interrupt time to the session's last hook event — those use different
      // clocks, and for an Esc pressed BEFORE any output the UserPromptSubmit
      // event is stamped AFTER the interrupt, which is exactly the case that
      // left sessions stuck "working" forever. If the user resumes, a new
      // prompt lands in the transcript and pendingInterrupt flips back to false
      // (and the fresh hook keeps the session non-stale meanwhile). Land the
      // session in the same waiting + awaiting-input state a normal Stop would.
      if (
        result.pendingInterrupt &&
        mainAgent &&
        mainAgent.status === "working" &&
        !mainAgent.awaiting_input_since
      ) {
        recoverInterruptedSession(sess.id, fullSess, mainAgentId, "interrupted by user");
        // Handled this tick. A genuine error (rare alongside an interrupt) is
        // still caught on a later tick once the agent is no longer "working".
        continue;
      }

      if (!result.errors || result.errors.length === 0) {
        // No transcript errors. Fall back to the no-marker interrupt check:
        // the "submit a prompt, then Esc before any output" case writes neither
        // a hook nor a transcript marker, so the only evidence is silence. If
        // the main agent is "working" with no tool in flight and neither a hook
        // event nor the transcript has advanced for WORKING_IDLE_MS, treat the
        // turn as dead and move the session to waiting-for-input. The mtime
        // guard means a streaming/long-output turn (transcript still growing)
        // is exempt; the current_tool guard exempts a long-running tool call.
        if (
          mainAgent &&
          mainAgent.status === "working" &&
          !mainAgent.current_tool &&
          !mainAgent.awaiting_input_since
        ) {
          let mtimeMs = 0;
          try {
            mtimeMs = fs.statSync(tPath).mtimeMs;
          } catch {
            /* transcript vanished — fall through with mtimeMs = 0 */
          }
          const hookMs = Date.parse(sess.last_event) || 0;
          const idleMs = Date.now() - Math.max(mtimeMs, hookMs);
          if (idleMs > WORKING_IDLE_MS) {
            recoverInterruptedSession(sess.id, fullSess, mainAgentId, "interrupted by user");
          }
        }
        continue;
      }

      // Check if we already recorded these errors
      const existingErrorCount = db
        .prepare(
          "SELECT COUNT(*) as cnt FROM events WHERE session_id = ? AND event_type = 'APIError'"
        )
        .get(sess.id).cnt;

      if (existingErrorCount < result.errors.length) {
        // Batch-fetch existing error summaries to avoid per-error SELECT
        const existingSummaries = new Set(
          db
            .prepare(`SELECT summary FROM events WHERE session_id = ? AND event_type = 'APIError'`)
            .all(sess.id)
            .map((r) => r.summary)
        );

        for (const apiErr of result.errors) {
          const summary = `${apiErr.type}: ${apiErr.message}`;
          if (existingSummaries.has(summary)) continue;

          stmts.insertEvent.run(
            sess.id,
            mainAgentId,
            "APIError",
            null,
            summary,
            JSON.stringify(apiErr)
          );
          broadcast("new_event", {
            session_id: sess.id,
            agent_id: mainAgentId,
            event_type: "APIError",
            tool_name: null,
            summary,
            created_at: apiErr.timestamp || new Date().toISOString(),
          });
        }

        // Flip to error only when a NEW error was detected this tick AND it is
        // still unrecovered at the transcript tail. The events above are kept
        // for history regardless, but a transient error the CLI already retried
        // past (successful turns after it) must not trip the session to `error`.
        // (The newErrorRecorded gate also stops re-reads from yanking a
        // recovered session back into error.)
        if (isErrorAtTail(result)) {
          stmts.updateSession.run(null, "error", null, null, sess.id);
          broadcast("session_updated", stmts.getSession.get(sess.id));
          if (mainAgent && mainAgent.status !== "completed" && mainAgent.status !== "error") {
            stmts.updateAgent.run(null, "error", null, null, null, null, mainAgentId);
            if (mainAgentId) {
              stmts.clearAgentAwaitingInput.run(mainAgentId);
              broadcast("agent_updated", stmts.getAgent.get(mainAgentId));
            }
          }
        }
      }
    }

    // ── Liveness reap: complete sessions whose claude process is gone ──────
    // SessionEnd is the ONLY signal that a session closed, and the hook that
    // carries it is fire-and-forget — if the dashboard was down when the user
    // quit (Ctrl+C, terminal closed), the event is lost forever and the
    // session sits in Waiting until the 3 h stale sweep. The probe supplies
    // the missing ground truth: when NO running `claude` CLI process has the
    // session's cwd as its working directory, the session cannot be alive —
    // land it in the same `completed` state a real SessionEnd produces.
    //
    // Guards, in order:
    //   - probe must be trustworthy (`available` — false on Windows, in
    //     containers, when ps/lsof fail, or when DASHBOARD_LIVENESS_PROBE=0
    //     is set for remote-hook setups where local processes prove nothing);
    //   - session must have a cwd to match on;
    //   - BOTH the last hook write and the transcript mtime must be older
    //     than LIVENESS_IDLE_MS, so mid-turn / just-imported / just-resumed
    //     sessions never flicker out on a transient mismatch. A false
    //     completion self-heals anyway: the next hook event reactivates the
    //     session via the existing needsReactivation path.
    livenessReap();
  } catch (err) {
    // Watchdog is best-effort — log but never crash the server
    console.warn("[WATCHDOG] Error during check:", err?.message || err);
  }
}

function livenessReap() {
  const fs = require("fs");
  const path = require("path");

  const activeSessions = db
    .prepare(
      `SELECT id, name, cwd, transcript_path, updated_at FROM sessions
       WHERE status = 'active' AND cwd IS NOT NULL AND cwd <> ''`
    )
    .all();
  if (activeSessions.length === 0) return; // nothing to check — skip the ps/lsof cost

  const probe = liveness.probeLiveCwds();
  if (!probe.available) return;
  const now = Date.now();
  for (const sess of activeSessions) {
    let resolvedCwd;
    try {
      resolvedCwd = path.resolve(sess.cwd);
    } catch {
      continue;
    }
    if (probe.cwds.has(resolvedCwd)) continue;

    // Idle gate: the transcript mtime is the ground truth for "when did this
    // session last do anything" — Claude Code appends to it on every turn,
    // and it stops moving the instant the process dies. updated_at is only a
    // fallback for sessions with no transcript on disk: import/backfill
    // passes bump updated_at at BOOT, so gating on it left a freshly
    // imported dead session sitting in Waiting for a full extra
    // LIVENESS_IDLE_MS after startup (the exact window the user first looks
    // at the UI). Live sessions don't need updated_at here: an alive claude
    // is protected by the probe itself, and a cwd-mismatched one that's
    // actually mid-turn keeps its transcript mtime fresh.
    let lastActivityMs = 0;
    if (sess.transcript_path) {
      try {
        lastActivityMs = fs.statSync(sess.transcript_path).mtimeMs;
      } catch {
        /* transcript gone — fall back to updated_at below */
      }
    }
    if (!lastActivityMs) lastActivityMs = Date.parse(sess.updated_at) || 0;
    if (now - lastActivityMs < LIVENESS_IDLE_MS) continue;

    // Mirror the SessionEnd case: all DB writes first, then broadcasts.
    const ts = new Date().toISOString();
    clearAwaitingInput(sess.id, null, false);
    const agents = stmts.listAgentsBySession.all(sess.id);
    for (const agent of agents) {
      if (agent.status !== "completed" && agent.status !== "error") {
        stmts.updateAgent.run(null, "completed", null, null, ts, null, agent.id);
      }
    }
    stmts.updateSession.run(null, "completed", ts, null, sess.id);

    const label = sess.name || `Session ${sess.id.slice(0, 8)}`;
    const summary = `Session closed: ${label} (no running claude process)`;
    const mainAgentId = `${sess.id}-main`;
    stmts.insertEvent.run(
      sess.id,
      stmts.getAgent.get(mainAgentId) ? mainAgentId : null,
      "SessionEnd",
      null,
      summary,
      JSON.stringify({ session_id: sess.id, source: "liveness-probe" })
    );

    broadcast("session_updated", stmts.getSession.get(sess.id));
    for (const agent of agents) {
      if (agent.status !== "completed" && agent.status !== "error") {
        broadcast("agent_updated", stmts.getAgent.get(agent.id));
      }
    }
    broadcast("new_event", {
      session_id: sess.id,
      agent_id: stmts.getAgent.get(mainAgentId) ? mainAgentId : null,
      event_type: "SessionEnd",
      tool_name: null,
      summary,
      created_at: ts,
    });
    console.log(`[WATCHDOG] Liveness reap: completed dead session ${sess.id} (${label})`);
  }
}

const watchdogTimer = setInterval(watchdogCheck, WATCHDOG_INTERVAL_MS);
// Don't keep the process alive just for the watchdog
if (watchdogTimer.unref) watchdogTimer.unref();

router.transcriptCache = transcriptCache;
router.watchdogCheck = watchdogCheck;
router.livenessReap = livenessReap;
module.exports = router;
