/**
 * @file Verifies the sweep queries used in server/index.js have been migrated
 * from json_extract(events.data,...) to sessions.transcript_path. Tests by
 * checking the SQL strings that appear in the file rather than running the
 * full setInterval — the unit-level guarantee is what matters here.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

describe("server/index.js sweep queries", () => {
  it("does NOT contain json_extract on events.data for transcript_path", () => {
    const matches = SRC.match(/json_extract\([^)]*events?\.data[^)]*transcript_path/gi) || [];
    assert.equal(
      matches.length,
      0,
      `expected zero events.data json_extract for transcript_path; found:\n${matches.join("\n")}`
    );
  });

  it("queries sessions.transcript_path for the active sweep", () => {
    assert.match(
      SRC,
      /FROM sessions[^;]*WHERE[^;]*status\s*=\s*'active'[^;]*transcript_path/is,
      "expected a SELECT from sessions with status='active' and transcript_path"
    );
  });
});
