/**
 * Session focus declarations ("ccam focus …").
 *
 * A session declares which AGENT-PLAN.md item it is serving — and any detours
 * it gets pulled into — by running `ccam focus set|push|pop|done|status` in
 * its Bash tool. The durable WRITE channel is the hook stream: the PostToolUse
 * hook event for that very command already carries the session_id, so
 * routes/hooks.js extracts the command from `data.tool_input.command` with
 * extractFocusCommand() and applies it here. (An explicit strict API path —
 * POST /api/sessions/:id/focus — shares applyFocusCommand with `strict:true`.)
 *
 * Semantics:
 *   set N [note]           → point the session at plan item N (stamps set_at
 *                             on change)
 *   push <desc>            → push a detour onto the stack (depth-capped)
 *   bug <title> <summary> [--detail <text>]     → push a detour tagged as a
 *   feature <title> <summary> [--detail <text>] → bug/feature fix so the plan
 *                             UI can badge it on the current item (or an
 *                             "Unknown" bucket when no item is set)
 *   pop                    → resolve the top detour (bug/feature or plain)
 *   done N                 → record the agent's completion claim on item N;
 *                             clears the pointer when N is the current item
 *   status                 → read-only, never applied from the hook stream
 *
 * Every state change writes a `Focus` row to events (with an item-text
 * snapshot, so timelines survive later plan renumbering) and broadcasts
 * `new_event` + `session_focus`. Declarations never touch drift_* columns —
 * only the drift auditor writes those, so an agent cannot silence its own
 * drift badge by re-declaring.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const MAX_NOTE_LEN = 300;
const MAX_DETOUR_LEN = 300;
const MAX_TITLE_LEN = 40;
const MAX_DETAIL_LEN = 2000;
const MAX_STACK_DEPTH = 10;

// Recognizes `ccam focus <verb>` in command position: start of string, after
// a shell operator/subshell, or after then/do/exec/env — with optional
// env-assignment prefixes (FOO=1) and path prefixes (./bin/ccam.js, npx has no
// slash so plain `npx ccam` also matches via the second token being `ccam`…
// npx is covered by allowing one optional `npx ` runner prefix). Only matches
// up through the verb — the args tail is extracted separately by
// extractArgsRaw() below, which is quote-aware (a regex character-class
// exclusion can't tell "a `)`/`>`/`&` ending the command" from "a `)`/`>`/`&`
// the user quoted inside their title/note/description").
const FOCUS_RE =
  /(?:^|[;&|(]|\b(?:then|do|exec|env)\s)\s*(?:[A-Za-z_]\w*=\S*\s+)*(?:npx\s+)?(?:\S*[/\\])?ccam(?:\.js)?\s+focus\s+(set|push|pop|done|status|bug|feature)\b/;

// Shell metacharacters that end the args tail when they appear OUTSIDE any
// quoting: command separators (;&|), subshell close ()), comment (#), and
// redirects (<>). Kept in one place so extractArgsRaw and the doc comment
// above stay in sync.
const ARGS_END_CHARS = new Set([";", "&", "|", ")", "#", "<", ">"]);

/**
 * Quote-aware walk of the text following `ccam focus <verb>`: stops at the
 * first unquoted shell metacharacter (or newline) or end of string, but never
 * inside an open "…"/'…' quote — so a title/note/description can contain a
 * literal `)`, `>`, `&`, etc. without truncating the capture (previously a
 * `)` in a bug/feature title, or a trailing `2>&1` redirect on a `set` note,
 * would corrupt or truncate the parsed value).
 */
function extractArgsRaw(tail) {
  let i = 0;
  let quote = null;
  while (i < tail.length) {
    const ch = tail[i];
    if (quote) {
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "\n") break;
    if (ch === "<" || ch === ">") {
      // A bare file-descriptor number directly preceding an unquoted
      // redirect (2>&1, 1>&2, >file) isn't part of the declaration's own
      // args - trim it along with the redirect itself rather than leaving
      // it dangling on the end of the captured value.
      let end = i;
      while (end > 0 && /[0-9]/.test(tail[end - 1])) end--;
      return tail.slice(0, end);
    }
    if (ARGS_END_CHARS.has(ch)) break;
    i++;
  }
  return tail.slice(0, i);
}

/**
 * Extract a focus declaration from a Bash command string.
 * Returns { verb, argsRaw } or null when the command contains none.
 */
function extractFocusCommand(command) {
  if (typeof command !== "string" || !command.includes("ccam")) return null;
  const m = command.match(FOCUS_RE);
  if (!m) return null;
  const tailStart = m.index + m[0].length;
  return { verb: m[1], argsRaw: extractArgsRaw(command.slice(tailStart)).trim() };
}

/** Strip one layer of matching quotes from a token/remainder. */
function unquote(s) {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

// Pulls one whitespace-delimited token off the front of a string, honoring a
// single layer of "..."/'...' quoting so a title/summary can contain spaces.
const LEADING_TOKEN_RE = /^\s*(?:"([^"]*)"|'([^']*)'|(\S+))/;
function nextToken(s) {
  const m = s.match(LEADING_TOKEN_RE);
  if (!m) return null;
  if (m[1] === undefined && m[2] === undefined && (m[3][0] === '"' || m[3][0] === "'")) {
    // Fell through to the bare-token branch on a token that itself starts
    // with a quote character — this only happens when the quoted-string
    // alternatives failed to find a matching close-quote, almost always
    // because FOCUS_RE's tail capture truncated mid-quote (e.g. a `)` inside
    // the title/summary text stops the capture early). Treat as unparseable
    // instead of silently accepting a stray-quote fragment as the value.
    return null;
  }
  const value = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
  return { value, rest: s.slice(m[0].length) };
}

/**
 * Parse a verb's raw argument string into a structured declaration.
 * Returns { verb, itemNumber?, note?, description?, kind?, title?, detail? }
 * or { error }.
 */
function parseFocusArgs(verb, argsRaw) {
  const raw = (argsRaw || "").trim();
  switch (verb) {
    case "set":
    case "done": {
      const m = raw.match(/^(\d{1,3})\b\s*(.*)$/);
      if (!m) return { error: "bad_args" };
      const parsed = { verb, itemNumber: parseInt(m[1], 10) };
      if (verb === "set" && m[2]) parsed.note = unquote(m[2]).slice(0, MAX_NOTE_LEN);
      return parsed;
    }
    case "push": {
      const description = unquote(raw);
      if (!description) return { error: "bad_args" };
      return { verb, description: description.slice(0, MAX_DETOUR_LEN) };
    }
    case "bug":
    case "feature": {
      const titleTok = nextToken(raw);
      if (!titleTok || !titleTok.value.trim()) return { error: "bad_args" };
      const summaryTok = nextToken(titleTok.rest);
      if (!summaryTok || !summaryTok.value.trim()) return { error: "bad_args" };
      let detail = null;
      const detailMatch = summaryTok.rest.match(/--detail\s+(?:"([^"]*)"|'([^']*)'|(\S+))/);
      if (detailMatch) {
        detail = (detailMatch[1] ?? detailMatch[2] ?? detailMatch[3] ?? "").trim() || null;
      }
      return {
        verb,
        kind: verb,
        title: titleTok.value.trim().slice(0, MAX_TITLE_LEN),
        description: summaryTok.value.trim().slice(0, MAX_DETOUR_LEN),
        detail: detail ? detail.slice(0, MAX_DETAIL_LEN) : null,
      };
    }
    case "pop":
    case "status":
      return { verb };
    default:
      return { error: "bad_args" };
  }
}

/** Parse a session_focus row's detour_stack column, tolerating junk. */
function parseStack(row) {
  try {
    const stack = JSON.parse(row?.detour_stack || "[]");
    return Array.isArray(stack) ? stack : [];
  } catch {
    return [];
  }
}

/**
 * Wire shape shared by every focus response and `session_focus` broadcast.
 * Joins item text from plan_items and folds drift_status to a tri-state
 * boolean the client renders directly.
 */
function focusWireShape(dbModule, row) {
  if (!row) return null;
  const { stmts } = dbModule;
  let itemText = null;
  if (row.cwd && row.item_number != null) {
    const item = stmts.getPlanItem.get(row.cwd, row.item_number);
    if (item) itemText = item.text;
  }
  return {
    session_id: row.session_id,
    cwd: row.cwd,
    item_number: row.item_number,
    item_text: itemText,
    note: row.note,
    detour_stack: parseStack(row),
    since: row.set_at,
    drift: row.drift_status === "drift" ? true : row.drift_status === "ok" ? false : null,
    drift_reason: row.drift_reason,
    updated_at: row.updated_at,
  };
}

/**
 * Apply a parsed focus declaration for a session.
 *
 * opts.strict=false (hook path): permissive — unknown items are recorded with
 * an `unknown_item` flag (the plan may simply not be ingested yet), pop on an
 * empty stack becomes a flagged no-op. Hooks cannot return errors to anyone.
 *
 * opts.strict=true (API path): violations return { error, code } and write
 * nothing. Additionally the API path is IDEMPOTENT: a declaration whose end
 * state equals the current state returns { deduped:true } without writing a
 * Focus event — this is what makes CLI-write + hook-parse double delivery
 * harmless.
 *
 * Returns { focus, event?, deduped?, planChanged? } or { error, code }.
 * Caller must hold no expectations about drift_*: never touched here.
 */
function applyFocusCommand(dbModule, broadcast, session, parsed, opts = {}) {
  const { stmts } = dbModule;
  const strict = !!opts.strict;
  const sessionId = session.id;
  const cwd = session.cwd || null;
  const existing = stmts.getSessionFocus.get(sessionId) || null;
  const stack = parseStack(existing);
  const now = new Date().toISOString();

  const eventData = { verb: parsed.verb, source: opts.source || "hook" };
  let summary = null;
  let planChanged = false;

  switch (parsed.verb) {
    case "set": {
      const item = cwd ? stmts.getPlanItem.get(cwd, parsed.itemNumber) : null;
      const planExists = cwd ? !!stmts.getPlanByCwd.get(cwd) : false;
      if (!item && strict && planExists) {
        return { error: `plan item ${parsed.itemNumber} not found`, code: "UNKNOWN_ITEM" };
      }
      if (
        strict &&
        existing &&
        existing.item_number === parsed.itemNumber &&
        (existing.note || null) === (parsed.note || null)
      ) {
        return { focus: focusWireShape(dbModule, existing), deduped: true };
      }
      const setAt =
        existing && existing.item_number === parsed.itemNumber ? existing.set_at || now : now;
      stmts.upsertSessionFocus.run(
        sessionId,
        cwd,
        parsed.itemNumber,
        parsed.note || null,
        setAt,
        JSON.stringify(stack)
      );
      eventData.item_number = parsed.itemNumber;
      eventData.note = parsed.note || null;
      eventData.item_text_snapshot = item ? item.text : null;
      if (!item) eventData.unknown_item = true;
      summary = item
        ? `Focus set: item ${parsed.itemNumber} — ${item.text}`
        : `Focus set: item ${parsed.itemNumber}`;
      break;
    }

    case "push":
    case "bug":
    case "feature": {
      const kindLabel =
        parsed.kind === "bug" ? "Bug" : parsed.kind === "feature" ? "Feature" : null;
      const frameLabel = kindLabel ? `${kindLabel}: ${parsed.title}` : parsed.description;
      if (stack.length >= MAX_STACK_DEPTH) {
        if (strict) return { error: "detour stack full", code: "STACK_FULL" };
        summary = `Focus detour ignored (stack full): ${frameLabel}`;
        eventData.ignored = "stack_full";
        eventData.description = parsed.description;
        if (parsed.kind) {
          eventData.kind = parsed.kind;
          eventData.title = parsed.title;
        }
        if (parsed.detail) eventData.detail = parsed.detail;
        insertFocusEvent(dbModule, broadcast, session, summary, eventData);
        return { focus: focusWireShape(dbModule, existing) };
      }
      stack.push({
        description: parsed.description,
        pushed_at: now,
        prior_item: existing ? existing.item_number : null,
        ...(parsed.kind ? { kind: parsed.kind, title: parsed.title } : {}),
        ...(parsed.detail ? { detail: parsed.detail } : {}),
      });
      stmts.upsertSessionFocus.run(
        sessionId,
        existing ? existing.cwd : cwd,
        existing ? existing.item_number : null,
        existing ? existing.note : null,
        existing ? existing.set_at : null,
        JSON.stringify(stack)
      );
      eventData.description = parsed.description;
      eventData.stack_depth = stack.length;
      if (parsed.kind) {
        eventData.kind = parsed.kind;
        eventData.title = parsed.title;
      }
      if (parsed.detail) eventData.detail = parsed.detail;
      summary = kindLabel ? frameLabel : `Focus detour: ${parsed.description}`;
      break;
    }

    case "pop": {
      if (stack.length === 0) {
        if (strict) return { error: "detour stack is empty", code: "EMPTY_STACK" };
        summary = "Focus pop ignored (no detour in progress)";
        eventData.ignored = "empty_stack";
        insertFocusEvent(dbModule, broadcast, session, summary, eventData);
        return { focus: focusWireShape(dbModule, existing) };
      }
      const popped = stack.pop();
      stmts.upsertSessionFocus.run(
        sessionId,
        existing.cwd,
        existing.item_number,
        existing.note,
        existing.set_at,
        JSON.stringify(stack)
      );
      eventData.description = popped.description;
      eventData.stack_depth = stack.length;
      summary = `Focus detour resolved: ${popped.description}`;
      break;
    }

    case "done": {
      const targetCwd = (existing && existing.cwd) || cwd;
      const item = targetCwd ? stmts.getPlanItem.get(targetCwd, parsed.itemNumber) : null;
      const planExists = targetCwd ? !!stmts.getPlanByCwd.get(targetCwd) : false;
      if (!item && strict && planExists) {
        return { error: `plan item ${parsed.itemNumber} not found`, code: "UNKNOWN_ITEM" };
      }
      if (strict && item && item.declared_done_at && existing?.item_number !== parsed.itemNumber) {
        return { focus: focusWireShape(dbModule, existing), deduped: true };
      }
      if (item) {
        stmts.setPlanItemDeclaredDone.run(now, sessionId, targetCwd, parsed.itemNumber);
        planChanged = true;
      }
      if (existing && existing.item_number === parsed.itemNumber) {
        stmts.upsertSessionFocus.run(
          sessionId,
          existing.cwd,
          null,
          null,
          null,
          JSON.stringify(stack)
        );
      }
      eventData.item_number = parsed.itemNumber;
      eventData.item_text_snapshot = item ? item.text : null;
      if (!item) eventData.unknown_item = true;
      summary = item
        ? `Focus done: item ${parsed.itemNumber} — ${item.text}`
        : `Focus done: item ${parsed.itemNumber}`;
      break;
    }

    default:
      // "status" and anything unrecognized: read-only, no event, no write.
      return { focus: focusWireShape(dbModule, existing) };
  }

  insertFocusEvent(dbModule, broadcast, session, summary, eventData);

  const updated = stmts.getSessionFocus.get(sessionId);
  const wire = focusWireShape(dbModule, updated);
  try {
    broadcast("session_focus", wire);
    if (planChanged) {
      const planCwd = (existing && existing.cwd) || cwd;
      if (planCwd) {
        const plan = stmts.getPlanByCwd.get(planCwd);
        if (plan) {
          broadcast("plan_updated", { plan, items: stmts.listPlanItems.all(planCwd) });
        }
      }
    }
  } catch {
    /* broadcast is fire-and-forget */
  }
  return { focus: wire, planChanged };
}

function insertFocusEvent(dbModule, broadcast, session, summary, data) {
  const { stmts } = dbModule;
  const agentId = `${session.id}-main`;
  const agentRow = stmts.getAgent.get(agentId);
  stmts.insertEvent.run(
    session.id,
    agentRow ? agentId : null,
    "Focus",
    null,
    summary,
    JSON.stringify(data)
  );
  try {
    broadcast("new_event", {
      session_id: session.id,
      agent_id: agentRow ? agentId : null,
      event_type: "Focus",
      tool_name: null,
      summary,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* fire-and-forget */
  }
}

module.exports = {
  extractFocusCommand,
  parseFocusArgs,
  applyFocusCommand,
  focusWireShape,
  MAX_STACK_DEPTH,
  MAX_TITLE_LEN,
  MAX_DETAIL_LEN,
};
