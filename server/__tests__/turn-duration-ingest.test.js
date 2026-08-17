/**
 * @file Regression tests for replay-safe Claude TurnDuration ingestion and
 * automatic repair of legacy duplicate rows and inflated session counters.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { after, before, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-turn-duration-"));
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");
process.env.CLAUDE_HOME = path.join(TMP, "claude");
process.env.DASHBOARD_DATA_DIR = path.join(TMP, "data");

const { createApp, startServer } = require("../index");
const { db, stmts } = require("../db");

let server;
let baseUrl;

function postHook(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL("/api/hooks/event", baseUrl);
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      }
    );
    request.on("error", reject);
    request.end(payload);
  });
}

before(async () => {
  server = await startServer(createApp(), 0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("TurnDuration hook ingestion", () => {
  it("keeps timestamp-less equal-duration turns distinct and repairs legacy inflation", async () => {
    const sessionId = "turn0000-0000-0000-0000-000000000001";
    const transcriptPath = path.join(TMP, `${sessionId}.jsonl`);
    fs.writeFileSync(
      transcriptPath,
      [
        { type: "system", subtype: "turn_duration", durationMs: 1500 },
        { type: "system", subtype: "turn_duration", durationMs: 1500 },
        {
          type: "system",
          subtype: "turn_duration",
          durationMs: 2500,
          timestamp: "2026-08-12T12:00:00.000Z",
        },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n"
    );
    const hook = {
      hook_type: "Stop",
      data: { session_id: sessionId, cwd: TMP, transcript_path: transcriptPath },
    };

    assert.equal(await postHook(hook), 200);
    let rows = db
      .prepare(
        "SELECT data, created_at FROM events WHERE session_id = ? AND event_type = 'TurnDuration' ORDER BY id"
      )
      .all(sessionId);
    assert.equal(rows.length, 3);
    assert.equal(new Set(rows.map((row) => JSON.parse(row.data).turnId)).size, 3);
    let metadata = JSON.parse(stmts.getSession.get(sessionId).metadata);
    assert.equal(metadata.turn_count, 3);
    assert.equal(metadata.total_turn_duration_ms, 5500);

    stmts.insertEvent.run(
      sessionId,
      `${sessionId}-main`,
      "TurnDuration",
      null,
      "legacy duplicate",
      JSON.stringify({ durationMs: 1500 })
    );
    metadata.turn_count = 999;
    metadata.total_turn_duration_ms = 999999;
    stmts.updateSession.run(null, null, null, JSON.stringify(metadata), sessionId);

    assert.equal(await postHook(hook), 200);
    rows = db
      .prepare(
        "SELECT data, created_at FROM events WHERE session_id = ? AND event_type = 'TurnDuration' ORDER BY id"
      )
      .all(sessionId);
    assert.equal(rows.length, 3, "the complete transcript replaces the inflated legacy set");
    assert.equal(new Set(rows.map((row) => JSON.parse(row.data).turnId)).size, 3);
    metadata = JSON.parse(stmts.getSession.get(sessionId).metadata);
    assert.equal(metadata.turn_count, 3);
    assert.equal(metadata.total_turn_duration_ms, 5500);

    assert.equal(await postHook(hook), 200);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM events WHERE session_id = ? AND event_type = 'TurnDuration'"
        )
        .get(sessionId).count,
      3,
      "an unchanged transcript remains replay-safe"
    );
  });
});
