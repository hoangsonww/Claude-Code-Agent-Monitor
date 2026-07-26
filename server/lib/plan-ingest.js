/**
 * AGENT-PLAN.md ingestion.
 *
 * A monitored repo may keep a human-approved project plan at
 * `<cwd>/AGENT-PLAN.md` — a short list of checkbox items:
 *
 *   # Auth migration
 *   - [ ] 1. Migrate auth — acceptance: login works via SSO
 *         id: a1b2c3d4
 *   - [x] 2) Set up schema
 *         id: e5f6a7b8
 *     - [ ] 2.1. Sub-item nested under item 2 (dotted number, own checkbox)
 *           id: c3d4e5f6
 *
 * A sub-item (dotted "N.M" number) is a child of the top-level item numbered
 * N, stored via parent_item_id (the parent's item_id) with item_number left
 * NULL — it has no flat, ccam-typeable number of its own; SQLite's UNIQUE
 * index allows any number of NULLs, so this needs no schema carve-out beyond
 * the nullable column. "N.M" is display-only (see attachDisplayNumbers()),
 * recomputed from the parent's number + sibling file order every ingest,
 * same as top-level numbers already are.
 *
 * The dashboard mirrors that file into the `plans` / `plan_items` tables
 * (keyed by cwd; projects aggregate via the project_paths join, exactly like
 * sessions). The file is the source of truth — the dashboard never writes it.
 *
 * Identity is the item's `id:` line (see fallbackItemId() below for files
 * predating that convention), NOT its display number — the number is
 * positional, recomputed from file order on every ingest, so reordering
 * items is a normal edit rather than something that looks like a
 * delete+recreate to the DB. When a known id's number changes across an
 * ingest, migrateFocusNumbersOnReorder() re-points any session_focus row
 * still aimed at the old number, so a live focus pointer survives a reorder
 * too (not just the plan_items row itself).
 *
 * The parser is deliberately tolerant: any line that isn't a checkbox item is
 * ignored, indented continuation lines append to the previous item (or its
 * acceptance/detail, when prefixed accordingly), and a file that parses to
 * ZERO items keeps the last good DB state (it is far more likely a human
 * mid-edit than an intentional plan wipe). All entry points are fail-safe:
 * malformed/missing/oversized files are skipped or flagged, never thrown —
 * this module runs from the hook path and a background poll and must never
 * break either.
 *
 * Contract mirrors workflow-ingest: functions take the db module as a
 * parameter and return what changed; the CALLER owns broadcasting.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/** File name looked for in every monitored cwd. */
const PLAN_FILENAME = "AGENT-PLAN.md";

// Safety caps: an AGENT-PLAN.md is a hand-written checklist, not a data file.
// Oversized input is skipped outright (stat before read); item/field caps keep
// plan_updated broadcasts far below the websocket's 64 KB maxPayload.
const MAX_FILE_BYTES = 256 * 1024;
const MAX_ITEMS = 100;
const MAX_TITLE_LEN = 200;
const MAX_TEXT_LEN = 500;
const MAX_ACCEPTANCE_LEN = 1000;
const MAX_DETAIL_LEN = 4000;

// `- [ ] 4. text` / `* [x] 2) text` / `- [X] 3: text` — bullet, checkbox,
// 1-3 digit number with optional `.` `)` `:` separator, then the item text.
const ITEM_RE = /^\s*[-*]\s*\[([ xX])\]\s*(\d{1,3})\s*[.):]?\s+(.+)$/;
// `  - [ ] 1.2. text` — a sub-item nested under top-level item 1, checked as
// its own checkbox. Distinguished from ITEM_RE by the required `N.M` dotted
// number (ITEM_RE's number group is plain digits, so it never matches a
// dotted line — this regex is checked first purely for clarity, not to win a
// race). The parent number (capture 2) is resolved against already-seen
// top-level items; the sub-number (capture 3) is NOT trusted as the stored
// identity — like top-level numbers, it's display text re-derived from file
// order (sibling position under the same parent) on every ingest.
const SUBITEM_RE = /^\s*[-*]\s*\[([ xX])\]\s*(\d{1,3})\.(\d{1,2})\s*[.):]?\s+(.+)$/;
// Splits "text — acceptance: ..." (em-dash, double hyphen, single hyphen, or
// nothing before the keyword). First occurrence only.
const ACCEPTANCE_RE = /\s*(?:—|--|-)?\s*acceptance\s*:\s*/i;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/;
// Indented continuation line starting with a recognized field prefix.
const ID_LINE_RE = /^id\s*:\s*([a-zA-Z0-9_-]+)/i;
const ACCEPTANCE_LINE_RE = /^acceptance\s*:/i;
const DETAIL_LINE_RE = /^detail\s*:\s*(.*)$/i;

/**
 * Deterministic item id for a file that predates the `id:` convention —
 * stable across re-ingests of the same unmodified file (same cwd+number in,
 * same id out), so upsertPlanItem finds and updates the existing row instead
 * of creating a new one. MUST match the migration in db.js that backfills
 * item_id onto pre-existing plan_items rows, or the first ingest after that
 * migration would immediately "lose" every legacy item's declared_done_at by
 * treating it as brand new.
 */
function fallbackItemId(cwd, number) {
  return crypto.createHash("sha1").update(`${cwd}:${number}`).digest("hex").slice(0, 8);
}

// Shared "safely out of the way" base for the two-phase number-vacate trick
// used both on plan_items (UNIQUE(cwd, item_number)) and on session_focus —
// negative and far below any real 1-3 digit item number, so a temporary
// placeholder can never collide with a real row untouched by the current
// ingest.
const NUMBER_OFFSET_BASE = -1_000_000;

/**
 * Parse AGENT-PLAN.md text into { title, items }. Pure — no I/O, no DB.
 * Items: { number, id, text, acceptance, detail, checked, position } in file
 * order. `id` is null when the item has no `id:` line yet (caller assigns
 * fallbackItemId()). Duplicate numbers: first occurrence wins. Unnumbered
 * checkboxes and all other prose are ignored.
 */
function parsePlanMarkdown(text) {
  const lines = String(text).split(/\r?\n/);
  let title = null;
  const items = [];
  const seen = new Set();
  let current = null; // last accepted item, target for continuation lines
  let inDetail = false; // true while consuming further-indented lines after a detail: line

  for (const line of lines) {
    if (title === null) {
      const h = line.match(HEADING_RE);
      if (h) {
        title = h[1].slice(0, MAX_TITLE_LEN);
        continue;
      }
    }

    const sm = line.match(SUBITEM_RE);
    if (sm) {
      const parentNumber = parseInt(sm[2], 10);
      // Parent must be an already-seen TOP-LEVEL item (a sub-item can't
      // itself have children) — sub-items authored before their parent, or
      // under a parent number that doesn't exist, are dropped rather than
      // guessed at (same fail-safe stance as a duplicate top-level number).
      const parent = [...items]
        .reverse()
        .find((it) => it.number === parentNumber && !it.parentNumberRef);
      if (!parent || items.length >= MAX_ITEMS) {
        current = null;
        inDetail = false;
        continue;
      }
      current = {
        number: null,
        parentNumberRef: parentNumber,
        id: null,
        text: sm[4].trim(),
        acceptance: null,
        detail: null,
        checked: sm[1].toLowerCase() === "x",
        position: items.length,
      };
      inDetail = false;
      items.push(current);
      continue;
    }

    const m = line.match(ITEM_RE);
    if (m) {
      const number = parseInt(m[2], 10);
      if (seen.has(number) || items.length >= MAX_ITEMS) {
        current = null; // continuations of a rejected item are dropped too
        inDetail = false;
        continue;
      }
      seen.add(number);
      current = {
        number,
        id: null,
        text: m[3].trim(),
        acceptance: null,
        detail: null,
        checked: m[1].toLowerCase() === "x",
        position: items.length,
      };
      inDetail = false;
      items.push(current);
      continue;
    }

    // Indented non-item lines continue the previous item — as its id,
    // acceptance note, detail block, or plain summary text, by prefix.
    if (current && /^\s+\S/.test(line)) {
      const cont = line.trim();

      const idMatch = cont.match(ID_LINE_RE);
      if (idMatch) {
        if (current.id === null) current.id = idMatch[1].slice(0, 64);
        inDetail = false;
        continue;
      }

      const detailMatch = cont.match(DETAIL_LINE_RE);
      if (detailMatch) {
        current.detail = detailMatch[1];
        inDetail = true;
        continue;
      }

      if (ACCEPTANCE_LINE_RE.test(cont)) {
        const extra = cont.replace(/^acceptance\s*:\s*/i, "");
        current.acceptance = current.acceptance ? `${current.acceptance} ${extra}` : extra;
        inDetail = false;
        continue;
      }

      if (inDetail) {
        current.detail = current.detail ? `${current.detail} ${cont}` : cont;
        continue;
      }

      current.text = `${current.text} ${cont}`;
      continue;
    }

    current = null; // blank line or top-level prose ends the continuation run
    inDetail = false;
  }

  for (const item of items) {
    const split = item.text.split(ACCEPTANCE_RE);
    if (split.length > 1) {
      item.text = split[0].trim();
      const tail = split.slice(1).join(" ").trim();
      item.acceptance = item.acceptance ? `${tail} ${item.acceptance}` : tail;
    }
    item.text = item.text.slice(0, MAX_TEXT_LEN);
    if (item.acceptance) item.acceptance = item.acceptance.slice(0, MAX_ACCEPTANCE_LEN);
    if (item.detail) item.detail = item.detail.trim().slice(0, MAX_DETAIL_LEN);
  }

  return { title, items };
}

/**
 * Ingest the plan file for one cwd into the DB.
 *
 * Returns `{ changed, plan, items }` — `changed:false` means the file's hash
 * matched what's stored (or the file stayed missing). Returns `null` when
 * there is no file AND no existing row (nothing to do, nothing to report).
 * Never throws.
 */
function ingestPlanForCwd(dbModule, cwd) {
  try {
    if (!cwd || typeof cwd !== "string") return null;
    const { db, stmts } = dbModule;
    const filePath = path.join(cwd, PLAN_FILENAME);

    let stat = null;
    try {
      stat = fs.statSync(filePath);
    } catch {
      /* missing file handled below */
    }

    if (!stat || !stat.isFile()) {
      const existing = stmts.getPlanByCwd.get(cwd);
      if (!existing) return null;
      if (existing.missing_at)
        return { changed: false, plan: existing, items: currentItems(stmts, cwd) };
      stmts.markPlanMissing.run(new Date().toISOString(), cwd);
      return { changed: true, plan: stmts.getPlanByCwd.get(cwd), items: currentItems(stmts, cwd) };
    }

    if (stat.size > MAX_FILE_BYTES) return existingAsUnchanged(stmts, cwd);

    const raw = fs.readFileSync(filePath, "utf8");
    const hash = crypto.createHash("sha1").update(raw).digest("hex");
    const existing = stmts.getPlanByCwd.get(cwd);
    if (existing && existing.content_hash === hash && !existing.missing_at) {
      return { changed: false, plan: existing, items: currentItems(stmts, cwd) };
    }

    const parsed = parsePlanMarkdown(raw);
    // Zero items = almost certainly a human mid-edit (or a stray file). Keep
    // the last good state rather than wiping items focus history points at.
    if (parsed.items.length === 0) return existingAsUnchanged(stmts, cwd);

    // Files predating the id: convention parse with item.id === null — assign
    // the same deterministic fallback every re-ingest of this exact
    // cwd+number would produce, so upsertPlanItem below still finds/updates
    // the existing row instead of treating it as new. Sub-items have no
    // number (null), so `number` alone can't disambiguate them the way it
    // does for top-level items — fall back to file position instead (stable
    // across a re-ingest of the same unmodified file, same caveat pre-id
    // top-level items already have: it drifts if the file is edited).
    for (const item of parsed.items) {
      if (!item.id) item.id = fallbackItemId(cwd, item.number ?? `sub:${item.position}`);
    }

    // Resolve each sub-item's parentNumberRef (a top-level item NUMBER, only
    // meaningful during parsing) to that parent's real item_id — the stable
    // handle actually stored on the row. A parent that itself lost its id
    // above (shouldn't happen — parents always have a number) or a
    // since-removed parent leaves parentItemId null, demoting the item to a
    // parentless (but still real) row rather than dropping it.
    for (const item of parsed.items) {
      if (item.parentNumberRef == null) continue;
      const parent = parsed.items.find(
        (p) => p.number === item.parentNumberRef && p.parentNumberRef == null
      );
      item.parentItemId = parent ? parent.id : null;
    }

    // Snapshot which id currently owns which number, BEFORE this ingest's
    // upserts change anything — this is what lets the post-upsert diff below
    // tell "item moved from 3 to 5" apart from "item 3 was deleted, a new
    // item was born at 5".
    const before = stmts.listPlanItemIdsAndNumbers.all(cwd);
    const beforeNumberById = new Map(before.map((r) => [r.item_id, r.item_number]));

    db.transaction(() => {
      stmts.upsertPlan.run(cwd, parsed.title, filePath, hash, parsed.items.length);

      // Vacate every EXISTING row's number to a collision-safe negative
      // placeholder BEFORE the real upserts run — unconditionally, not just
      // for rows detected as "moved". Two ways a same-ingest collision can
      // happen otherwise: a swap (A: 1→2, B: 2→1 — B's upsert claims 1 while
      // A's row, upserted later in file order, is still sitting on it), or a
      // delete+new-at-the-same-number (item at 1 is being removed, a
      // different item — new id, not a move — is claiming 1 this ingest).
      // Vacating the whole existing set first makes both impossible.
      for (const row of before) {
        // Sub-items (item_number NULL) were never in a numbered slot to
        // vacate — nothing to remap, and NUMBER_OFFSET_BASE - null is NaN.
        if (row.item_number == null) continue;
        stmts.remapPlanItemNumberById.run(NUMBER_OFFSET_BASE - row.item_number, cwd, row.item_id);
      }

      for (const item of parsed.items) {
        stmts.upsertPlanItem.run(
          cwd,
          item.id,
          item.number,
          item.parentItemId ?? null,
          item.text,
          item.acceptance,
          item.detail,
          item.checked ? 1 : 0,
          item.position
        );
      }
      stmts.deletePlanItemsNotIn.run(cwd, JSON.stringify(parsed.items.map((i) => i.id)));
      migrateFocusNumbersOnReorder(stmts, cwd, beforeNumberById, parsed.items);
    })();

    return { changed: true, plan: stmts.getPlanByCwd.get(cwd), items: currentItems(stmts, cwd) };
  } catch {
    return null;
  }
}

/**
 * Re-point session_focus.item_number for any item whose number changed in
 * this ingest, so a session that declared focus before a reorder still
 * resolves to the SAME item afterward instead of silently pointing at
 * whatever now sits at its old number (or a number that no longer exists).
 *
 * Applied as two passes — every affected number first moved to a
 * collision-safe negative offset, then every offset moved to its true new
 * number — so a swap (item A: 3→5, item B: 5→3 in the same ingest) resolves
 * correctly. A naive single-pass "UPDATE ... WHERE item_number = oldNumber"
 * loop would corrupt exactly this case: processing A first would move rows
 * at 3 to 5, indistinguishably merging with B's still-untouched rows already
 * at 5, and B's own pass would then misroute both.
 */
function migrateFocusNumbersOnReorder(stmts, cwd, beforeNumberById, parsedItems) {
  const moved = [];
  for (const item of parsedItems) {
    const oldNumber = beforeNumberById.get(item.id);
    if (oldNumber != null && oldNumber !== item.number) {
      moved.push({ oldNumber, newNumber: item.number });
    }
  }
  if (moved.length === 0) return;

  for (const { oldNumber } of moved) {
    stmts.remapSessionFocusNumber.run(NUMBER_OFFSET_BASE - oldNumber, cwd, oldNumber);
  }
  for (const { oldNumber, newNumber } of moved) {
    stmts.remapSessionFocusNumber.run(newNumber, cwd, NUMBER_OFFSET_BASE - oldNumber);
  }
}

function existingAsUnchanged(stmts, cwd) {
  const existing = stmts.getPlanByCwd.get(cwd);
  if (!existing) return null;
  return { changed: false, plan: existing, items: currentItems(stmts, cwd) };
}

function currentItems(stmts, cwd) {
  return attachDisplayNumbers(stmts.listPlanItems.all(cwd));
}

/**
 * Adds a `display_number` string to each item — "3" for a top-level item,
 * "3.2" for its second sub-item — for UI/gate-prompt rendering. Purely
 * derived, never stored: a sub-item's second number is its ordinal among
 * siblings sharing the same parent_item_id, in `position` (file) order, same
 * "recomputed from file order every ingest" stance top-level numbers already
 * take. Rows are expected in `position` order (as listPlanItems returns);
 * order is not re-sorted here.
 */
function attachDisplayNumbers(items) {
  const siblingIndex = new Map(); // parent_item_id -> next 1-based ordinal
  return items.map((item) => {
    if (!item.parent_item_id) {
      return {
        ...item,
        display_number: item.item_number == null ? null : String(item.item_number),
      };
    }
    const ordinal = (siblingIndex.get(item.parent_item_id) ?? 0) + 1;
    siblingIndex.set(item.parent_item_id, ordinal);
    const parent = items.find((p) => p.item_id === item.parent_item_id);
    const parentNumber = parent && parent.item_number != null ? parent.item_number : "?";
    return { ...item, display_number: `${parentNumber}.${ordinal}` };
  });
}

/**
 * Cheap mtime fingerprint for the poll: mtimeMs of `<cwd>/AGENT-PLAN.md`, or
 * 0 when the file is absent/unreadable. Never throws.
 */
function planFileMtime(cwd) {
  try {
    return fs.statSync(path.join(cwd, PLAN_FILENAME)).mtimeMs;
  } catch {
    return 0;
  }
}

module.exports = {
  PLAN_FILENAME,
  parsePlanMarkdown,
  ingestPlanForCwd,
  planFileMtime,
  fallbackItemId,
  attachDisplayNumbers,
};
