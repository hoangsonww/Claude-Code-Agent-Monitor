#!/usr/bin/env node

/**
 * Import legacy Claude Code sessions from ~/.claude/ into the Agent Dashboard.
 * Reads per-project JSONL session files to populate sessions, agents, and
 * token usage that existed before the dashboard was installed.
 *
 * Can be run standalone: node scripts/import-history.js [--dry-run] [--project <name>]
 * Also exported for auto-import on server startup.
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

    if (!cwd && entry.cwd) cwd = entry.cwd;
    if (!slug && entry.slug) slug = entry.slug;
    if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch;
    if (!version && entry.version) version = entry.version;

    const ts = entry.timestamp;
    if (ts) {
      const isoTs = typeof ts === "number" ? new Date(ts).toISOString() : ts;
      if (!firstTimestamp || isoTs < firstTimestamp) firstTimestamp = isoTs;
      if (!lastTimestamp || isoTs > lastTimestamp) lastTimestamp = isoTs;
    }

    if (entry.teamName) teams.add(entry.teamName);

    if (entry.type === "user") userMessageCount++;
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
      // Extract tool_use names from assistant message content
      const content = msg.content || [];
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "tool_use" && block.name) {
            toolUses.push({ name: block.name, timestamp: isoTs || firstTimestamp });
          }
        }
      }
    }
  }

  if (!firstTimestamp) return null;

  const projectName = cwd ? path.basename(cwd) : slug || `Session ${sessionId.slice(0, 8)}`;
  const sessionName = slug
    ? `${projectName} (${slug})`
    : `${projectName} - ${sessionId.slice(0, 8)}`;

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

    return backfilled ? { skipped: false, backfilled: true } : { skipped: true };
  }

  const metadata = JSON.stringify({
    version: session.version,
    slug: session.slug,
    git_branch: session.gitBranch,
    user_messages: session.userMessages,
    assistant_messages: session.assistantMessages,
    imported: true,
  });

  stmts.insertSession.run(
    session.sessionId,
    session.name,
    "completed",
    session.cwd,
    session.model,
    metadata
  );

  db.prepare("UPDATE sessions SET started_at = ?, ended_at = ? WHERE id = ?").run(
    session.startedAt,
    session.endedAt,
    session.sessionId
  );

  const mainAgentId = `${session.sessionId}-main`;
  stmts.insertAgent.run(
    mainAgentId,
    session.sessionId,
    "Main Agent",
    "main",
    null,
    "completed",
    null,
    null,
    null
  );
  db.prepare("UPDATE agents SET started_at = ?, ended_at = ? WHERE id = ?").run(
    session.startedAt,
    session.endedAt,
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
        if (session) batch.push(session);
        else skipped++;
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
  findCompactionsInFile,
};
