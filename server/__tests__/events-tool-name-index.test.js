/**
 * @file Guards the partial index behind the analytics tool-usage panel. That
 * panel groups every event by `tool_name`; without an index on the column the
 * group-by is a full events-table scan, and because SQLite access here is
 * synchronous the whole server stalls while it runs — measured at 45.7s on a
 * 3.9M-row table. This pins the query to a covering-index scan so a regression
 * shows up as a failing plan rather than as a slow dashboard.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), `events-tool-index-${process.pid}-`));
process.env.DASHBOARD_DB_PATH = path.join(TMP, "dashboard.db");

const { db } = require("../db");

describe("events.tool_name index", () => {
  it("exists as a partial index over non-NULL tool names", () => {
    const row = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get("idx_events_tool_name");
    assert.ok(row, "idx_events_tool_name must exist");
    assert.match(
      row.sql,
      /WHERE\s+tool_name\s+IS\s+NOT\s+NULL/i,
      "the index must stay partial so it only covers tool events"
    );
  });

  it("makes the analytics tool-usage group-by a covering index scan", () => {
    const plan = db
      .prepare(
        `EXPLAIN QUERY PLAN
         SELECT tool_name, COUNT(*) as count
         FROM events
         WHERE tool_name IS NOT NULL
         GROUP BY tool_name
         ORDER BY count DESC
         LIMIT 20`
      )
      .all()
      .map((step) => step.detail)
      .join(" | ");
    assert.ok(
      plan.includes("COVERING INDEX idx_events_tool_name"),
      `tool-usage counts must use idx_events_tool_name, got: ${plan}`
    );
  });
});
