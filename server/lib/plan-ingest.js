/**
 * AGENT-PLAN.md ingestion.
 *
 * A monitored repo may keep a human-approved project plan at
 * `<cwd>/AGENT-PLAN.md` — a short list of numbered checkbox items:
 *
 *   # Auth migration
 *   - [ ] 1. Migrate auth — acceptance: login works via SSO
 *   - [x] 2) Set up schema
 *
 * The dashboard mirrors that file into the `plans` / `plan_items` tables
 * (keyed by cwd; projects aggregate via the project_paths join, exactly like
 * sessions). The file is the source of truth — the dashboard never writes it.
 *
 * The parser is deliberately tolerant: any line that isn't a numbered checkbox
 * item is ignored, indented continuation lines append to the previous item,
 * and a file that parses to ZERO items keeps the last good DB state (it is far
 * more likely a human mid-edit than an intentional plan wipe). All entry
 * points are fail-safe: malformed/missing/oversized files are skipped or
 * flagged, never thrown — this module runs from the hook path and a background
 * poll and must never break either.
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

// `- [ ] 4. text` / `* [x] 2) text` / `- [X] 3: text` — bullet, checkbox,
// 1-3 digit number with optional `.` `)` `:` separator, then the item text.
const ITEM_RE = /^\s*[-*]\s*\[([ xX])\]\s*(\d{1,3})\s*[.):]?\s+(.+)$/;
// Splits "text — acceptance: ..." (em-dash, double hyphen, single hyphen, or
// nothing before the keyword). First occurrence only.
const ACCEPTANCE_RE = /\s*(?:—|--|-)?\s*acceptance\s*:\s*/i;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/;

/**
 * Parse AGENT-PLAN.md text into { title, items }. Pure — no I/O, no DB.
 * Items: { number, text, acceptance, checked, position } in file order.
 * Duplicate numbers: first occurrence wins. Unnumbered checkboxes and all
 * other prose are ignored.
 */
function parsePlanMarkdown(text) {
  const lines = String(text).split(/\r?\n/);
  let title = null;
  const items = [];
  const seen = new Set();
  let current = null; // last accepted item, target for continuation lines

  for (const line of lines) {
    if (title === null) {
      const h = line.match(HEADING_RE);
      if (h) {
        title = h[1].slice(0, MAX_TITLE_LEN);
        continue;
      }
    }

    const m = line.match(ITEM_RE);
    if (m) {
      const number = parseInt(m[2], 10);
      if (seen.has(number) || items.length >= MAX_ITEMS) {
        current = null; // continuations of a rejected item are dropped too
        continue;
      }
      seen.add(number);
      current = {
        number,
        text: m[3].trim(),
        acceptance: null,
        checked: m[1].toLowerCase() === "x",
        position: items.length,
      };
      items.push(current);
      continue;
    }

    // Indented non-item lines continue the previous item's text (or its
    // acceptance note when the line starts with "acceptance:").
    if (current && /^\s+\S/.test(line)) {
      const cont = line.trim();
      if (/^acceptance\s*:/i.test(cont)) {
        const extra = cont.replace(/^acceptance\s*:\s*/i, "");
        current.acceptance = current.acceptance ? `${current.acceptance} ${extra}` : extra;
      } else {
        current.text = `${current.text} ${cont}`;
      }
      continue;
    }

    current = null; // blank line or top-level prose ends the continuation run
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

    db.transaction(() => {
      stmts.upsertPlan.run(cwd, parsed.title, filePath, hash, parsed.items.length);
      for (const item of parsed.items) {
        stmts.upsertPlanItem.run(
          cwd,
          item.number,
          item.text,
          item.acceptance,
          item.checked ? 1 : 0,
          item.position
        );
      }
      stmts.deletePlanItemsNotIn.run(cwd, JSON.stringify(parsed.items.map((i) => i.number)));
    })();

    return { changed: true, plan: stmts.getPlanByCwd.get(cwd), items: currentItems(stmts, cwd) };
  } catch {
    return null;
  }
}

function existingAsUnchanged(stmts, cwd) {
  const existing = stmts.getPlanByCwd.get(cwd);
  if (!existing) return null;
  return { changed: false, plan: existing, items: currentItems(stmts, cwd) };
}

function currentItems(stmts, cwd) {
  return stmts.listPlanItems.all(cwd);
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

module.exports = { PLAN_FILENAME, parsePlanMarkdown, ingestPlanForCwd, planFileMtime };
