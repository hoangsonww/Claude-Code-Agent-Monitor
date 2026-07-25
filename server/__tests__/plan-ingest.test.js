/**
 * Tests for server/lib/plan-ingest.js — the AGENT-PLAN.md parser and the
 * cwd-keyed ingest path. Covers grammar tolerance (bullet/separator variants,
 * continuation lines, acceptance notes), re-ingest identity semantics
 * (declared_done_* survives, removed numbers are deleted), the missing-file /
 * oversize / zero-item fail-safes, and the content-hash short-circuit.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TEST_DB = path.join(
  os.tmpdir(),
  `dashboard-plan-ingest-test-${Date.now()}-${process.pid}.db`
);
process.env.DASHBOARD_DB_PATH = TEST_DB;

const dbModule = require("../db");
const { db, stmts } = dbModule;
const {
  parsePlanMarkdown,
  ingestPlanForCwd,
  planFileMtime,
  PLAN_FILENAME,
} = require("../lib/plan-ingest");

let workDir;

function writePlan(text) {
  fs.writeFileSync(path.join(workDir, PLAN_FILENAME), text);
}

before(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-ingest-cwd-"));
});

after(() => {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  try {
    fs.rmSync(TEST_DB, { force: true });
    fs.rmSync(`${TEST_DB}-wal`, { force: true });
    fs.rmSync(`${TEST_DB}-shm`, { force: true });
  } catch {
    /* best effort */
  }
});

describe("parsePlanMarkdown", () => {
  it("parses title, checkbox variants, and separators", () => {
    const { title, items } = parsePlanMarkdown(
      [
        "# Auth migration",
        "",
        "- [ ] 1. Migrate auth",
        "* [x] 2) Set up schema",
        "- [X] 3: Ship it",
      ].join("\n")
    );
    assert.equal(title, "Auth migration");
    assert.equal(items.length, 3);
    assert.deepEqual(
      items.map((i) => [i.number, i.checked]),
      [
        [1, false],
        [2, true],
        [3, true],
      ]
    );
    assert.equal(items[1].text, "Set up schema");
  });

  it("splits acceptance notes from item text", () => {
    const { items } = parsePlanMarkdown("- [ ] 4. Migrate auth — acceptance: login works via SSO");
    assert.equal(items[0].text, "Migrate auth");
    assert.equal(items[0].acceptance, "login works via SSO");
  });

  it("appends indented continuation lines, routing acceptance: lines separately", () => {
    const { items } = parsePlanMarkdown(
      [
        "- [ ] 1. First part",
        "  second part",
        "  acceptance: it works",
        "",
        "top-level prose",
      ].join("\n")
    );
    assert.equal(items[0].text, "First part second part");
    assert.equal(items[0].acceptance, "it works");
  });

  it("skips unnumbered checkboxes, keeps first duplicate, ignores prose", () => {
    const { items } = parsePlanMarkdown(
      ["- [ ] no number here", "- [ ] 5. real", "- [x] 5. duplicate", "just words"].join("\n")
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].number, 5);
    assert.equal(items[0].checked, false);
  });

  it("preserves file order in position for non-contiguous numbering", () => {
    const { items } = parsePlanMarkdown(
      ["- [ ] 9. last", "- [ ] 2. middle", "- [ ] 30. big"].join("\n")
    );
    assert.deepEqual(
      items.map((i) => [i.number, i.position]),
      [
        [9, 0],
        [2, 1],
        [30, 2],
      ]
    );
  });
});

describe("ingestPlanForCwd", () => {
  it("returns null for a cwd with no file and no row", () => {
    assert.equal(ingestPlanForCwd(dbModule, path.join(os.tmpdir(), "nonexistent-cwd-xyz")), null);
  });

  it("ingests a new plan file", () => {
    writePlan("# Demo\n- [ ] 1. One — acceptance: a\n- [x] 2. Two\n");
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, true);
    assert.equal(res.plan.title, "Demo");
    assert.equal(res.plan.item_count, 2);
    assert.equal(res.plan.missing_at, null);
    assert.equal(res.items.length, 2);
    assert.equal(res.items[1].checked, 1);
  });

  it("short-circuits on unchanged content hash", () => {
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, false);
  });

  it("preserves declared_done_* across re-ingest and deletes removed numbers", () => {
    stmts.setPlanItemDeclaredDone.run("2026-01-01T00:00:00Z", "sess-1", workDir, 1);
    writePlan("# Demo\n- [ ] 1. One renamed\n- [ ] 3. Three\n");
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, true);
    const numbers = res.items.map((i) => i.item_number);
    assert.deepEqual(numbers.sort(), [1, 3]);
    const item1 = res.items.find((i) => i.item_number === 1);
    assert.equal(item1.text, "One renamed");
    assert.equal(item1.declared_done_at, "2026-01-01T00:00:00Z");
    assert.equal(item1.declared_done_session, "sess-1");
  });

  it("keeps last good state when the file parses to zero items", () => {
    writePlan("nothing but prose\n");
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, false);
    assert.equal(res.items.length, 2);
  });

  it("stamps missing_at when the file disappears, keeping the row", () => {
    fs.rmSync(path.join(workDir, PLAN_FILENAME));
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, true);
    assert.ok(res.plan.missing_at);
    assert.equal(res.items.length, 2);
    // Second pass with the file still missing: no further change.
    const res2 = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res2.changed, false);
  });

  it("clears missing_at when the file returns", () => {
    writePlan("# Demo\n- [ ] 1. Back\n");
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, true);
    assert.equal(res.plan.missing_at, null);
  });

  it("skips oversized files, keeping last good state", () => {
    writePlan(`# Big\n- [ ] 1. pad\n${"x".repeat(300 * 1024)}`);
    const res = ingestPlanForCwd(dbModule, workDir);
    assert.equal(res.changed, false);
  });

  it("planFileMtime returns 0 for missing files and a number for present ones", () => {
    assert.equal(planFileMtime(path.join(os.tmpdir(), "nonexistent-cwd-xyz")), 0);
    writePlan("# T\n- [ ] 1. a\n");
    assert.ok(planFileMtime(workDir) > 0);
  });
});
