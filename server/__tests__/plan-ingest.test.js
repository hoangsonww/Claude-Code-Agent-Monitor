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
  fallbackItemId,
  attachDisplayNumbers,
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

  it("parses id: and detail: lines, routing them off the summary text", () => {
    const { items } = parsePlanMarkdown(
      [
        "- [ ] 1. First item — acceptance: it works",
        "      id: a1b2c3d4",
        "      detail: Extra context line one.",
        "      Extra context line two.",
      ].join("\n")
    );
    assert.equal(items[0].id, "a1b2c3d4");
    assert.equal(items[0].acceptance, "it works");
    assert.equal(items[0].detail, "Extra context line one. Extra context line two.");
    assert.equal(items[0].text, "First item");
  });

  it("items with no id: line parse with id === null", () => {
    const { items } = parsePlanMarkdown("- [ ] 1. No id here");
    assert.equal(items[0].id, null);
    assert.equal(items[0].detail, null);
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

  it("parses dotted sub-items as children of the matching top-level number", () => {
    const { items } = parsePlanMarkdown(
      [
        "- [ ] 1. Pipeline Environment",
        "  - [ ] 1.1. Image Generation",
        "  - [x] 1.2. Rough Animation",
        "- [ ] 2. Screenplay",
      ].join("\n")
    );
    assert.equal(items.length, 4);
    assert.equal(items[0].number, 1);
    assert.equal(items[0].parentNumberRef, undefined);
    assert.equal(items[1].number, null);
    assert.equal(items[1].parentNumberRef, 1);
    assert.equal(items[1].text, "Image Generation");
    assert.equal(items[1].checked, false);
    assert.equal(items[2].parentNumberRef, 1);
    assert.equal(items[2].checked, true);
    assert.equal(items[3].number, 2);
    assert.equal(items[3].parentNumberRef, undefined);
  });

  it("drops a sub-item whose parent number was never seen", () => {
    const { items } = parsePlanMarkdown(
      ["- [ ] 1. Real item", "  - [ ] 9.1. Orphaned, parent 9 doesn't exist"].join("\n")
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].number, 1);
  });

  it("attaches id/acceptance/detail continuation lines to a sub-item, same as a top-level item", () => {
    const { items } = parsePlanMarkdown(
      [
        "- [ ] 1. Parent",
        "  - [ ] 1.1. Child — acceptance: it works",
        "        id: c1c1c1c1",
        "        detail: extra context",
      ].join("\n")
    );
    const child = items.find((i) => i.parentNumberRef === 1);
    assert.equal(child.acceptance, "it works");
    assert.equal(child.id, "c1c1c1c1");
    assert.equal(child.detail, "extra context");
  });
});

describe("attachDisplayNumbers", () => {
  it("derives N.M for sub-items from parent number + sibling order, leaves top-level items alone", () => {
    const items = [
      { item_id: "p1", item_number: 1, parent_item_id: null },
      { item_id: "c1", item_number: null, parent_item_id: "p1" },
      { item_id: "c2", item_number: null, parent_item_id: "p1" },
      { item_id: "p2", item_number: 2, parent_item_id: null },
    ];
    const withNumbers = attachDisplayNumbers(items);
    assert.deepEqual(
      withNumbers.map((i) => i.display_number),
      ["1", "1.1", "1.2", "2"]
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

describe("reorder identity (item_id survives a number change)", () => {
  let reorderDir;

  function writeReorderPlan(text) {
    fs.writeFileSync(path.join(reorderDir, PLAN_FILENAME), text);
  }

  before(() => {
    reorderDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-ingest-reorder-"));
  });

  after(() => {
    fs.rmSync(reorderDir, { recursive: true, force: true });
  });

  it("carries declared_done_at and a live focus pointer through a swap, by id not number", () => {
    writeReorderPlan(
      [
        "# Reorder demo",
        "- [ ] 1. Alpha",
        "      id: aaaaaaaa",
        "- [ ] 2. Beta",
        "      id: bbbbbbbb",
      ].join("\n")
    );
    ingestPlanForCwd(dbModule, reorderDir);

    // Alpha (currently number 1) has a completion claim and a session's live
    // focus pointer aimed at it.
    stmts.setPlanItemDeclaredDone.run("2026-02-02T00:00:00Z", "sess-reorder", reorderDir, 1);
    stmts.insertSession.run("sess-reorder", "Reorder Test", "active", reorderDir, null, null);
    stmts.upsertSessionFocus.run("sess-reorder", reorderDir, 1, null, "2026-02-02T00:00:00Z", "[]");

    // Swap: Alpha moves 1→2, Beta moves 2→1, in the same ingest.
    writeReorderPlan(
      [
        "# Reorder demo",
        "- [ ] 1. Beta",
        "      id: bbbbbbbb",
        "- [ ] 2. Alpha",
        "      id: aaaaaaaa",
      ].join("\n")
    );
    const res = ingestPlanForCwd(dbModule, reorderDir);
    assert.equal(res.changed, true);

    const alpha = res.items.find((i) => i.item_id === "aaaaaaaa");
    const beta = res.items.find((i) => i.item_id === "bbbbbbbb");
    assert.equal(alpha.item_number, 2);
    assert.equal(beta.item_number, 1);

    // The completion claim followed Alpha to its new number — not left
    // behind on whatever now sits at the old number 1 (Beta).
    assert.equal(alpha.declared_done_at, "2026-02-02T00:00:00Z");
    assert.equal(beta.declared_done_at, null);

    // The live session_focus pointer followed Alpha too.
    const focus = stmts.getSessionFocus.get("sess-reorder");
    assert.equal(focus.item_number, 2);
  });

  it("assigns a deterministic fallback id to pre-id files, stable across re-ingest", () => {
    writeReorderPlan("# No ids\n- [ ] 1. Legacy item\n");
    const res1 = ingestPlanForCwd(dbModule, reorderDir);
    const id1 = res1.items[0].item_id;
    assert.equal(id1, fallbackItemId(reorderDir, 1));

    // Change the text (so the content hash differs and a real re-ingest
    // runs) but keep the same cwd+number — the fallback id must not move,
    // or every ingest of a not-yet-migrated plan would look like a
    // delete+recreate.
    writeReorderPlan("# No ids\n- [ ] 1. Legacy item, reworded\n");
    const res2 = ingestPlanForCwd(dbModule, reorderDir);
    assert.equal(res2.changed, true);
    assert.equal(res2.items.length, 1);
    assert.equal(res2.items[0].item_id, id1);
    assert.equal(res2.items[0].text, "Legacy item, reworded");
  });
});

describe("sub-items end to end (ingest + re-ingest)", () => {
  let subDir;

  function writeSubPlan(text) {
    fs.writeFileSync(path.join(subDir, PLAN_FILENAME), text);
  }

  before(() => {
    subDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-ingest-subitems-"));
  });

  after(() => {
    fs.rmSync(subDir, { recursive: true, force: true });
  });

  it("stores sub-items with a null item_number and the parent's item_id, distinct rows in the UNIQUE(cwd, item_number) index", () => {
    writeSubPlan(
      [
        "# Stages",
        "- [ ] 1. Pipeline Environment",
        "      id: parent001",
        "  - [ ] 1.1. Image Generation",
        "        id: child0001",
        "  - [ ] 1.2. Voice Synthesis",
        "        id: child0002",
        "- [ ] 2. Screenplay",
        "      id: parent002",
      ].join("\n")
    );
    const res = ingestPlanForCwd(dbModule, subDir);
    assert.equal(res.changed, true);
    assert.equal(res.items.length, 4);

    const child1 = res.items.find((i) => i.item_id === "child0001");
    const child2 = res.items.find((i) => i.item_id === "child0002");
    const parent = res.items.find((i) => i.item_id === "parent001");

    assert.equal(child1.item_number, null);
    assert.equal(child1.parent_item_id, "parent001");
    assert.equal(child1.display_number, "1.1");
    assert.equal(child2.display_number, "1.2");
    assert.equal(parent.parent_item_id, null);
    assert.equal(parent.display_number, "1");
  });

  it("re-ingest preserves a checked sub-item's state and its parent linkage by id", () => {
    const before = stmts.listPlanItems.all(subDir);
    const child1 = before.find((i) => i.item_id === "child0001");
    assert.equal(child1.checked, 0);

    writeSubPlan(
      [
        "# Stages",
        "- [ ] 1. Pipeline Environment",
        "      id: parent001",
        "  - [x] 1.1. Image Generation",
        "        id: child0001",
        "  - [ ] 1.2. Voice Synthesis",
        "        id: child0002",
        "- [ ] 2. Screenplay",
        "      id: parent002",
      ].join("\n")
    );
    const res = ingestPlanForCwd(dbModule, subDir);
    assert.equal(res.changed, true);
    const child1After = res.items.find((i) => i.item_id === "child0001");
    assert.equal(child1After.checked, 1);
    assert.equal(child1After.parent_item_id, "parent001");
  });

  it("removing a parent and its sub-items from the file deletes all their rows on next ingest", () => {
    writeSubPlan(["# Stages", "- [ ] 2. Screenplay", "      id: parent002"].join("\n"));
    const res = ingestPlanForCwd(dbModule, subDir);
    assert.equal(res.changed, true);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].item_id, "parent002");
  });
});
