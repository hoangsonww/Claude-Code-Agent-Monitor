/**
 * @file tuiSegments.ts
 * @description Parses Claude TUI tag markup that appears in user messages -
 * caveats, command invocations, captured stdout/stderr, system reminders -
 * into a flat segment list the renderer can lay out inline. Also strips bare
 * ANSI/SGR escape sequences (e.g. "[1m...[22m") that survive the JSONL pipe
 * so messages render as plain text instead of leaking codes.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/tuiSegments.ts
 * **Area:** client conversation component
 * **Responsibility:**
 * Parses Claude TUI tag markup that appears in user messages - caveats, command invocations,
 * captured stdout/stderr, system reminders - into a flat segment list the renderer can lay out
 * inline. Also strips bare ANSI/SGR escape sequences (e.g. "[1m...[22m") that survive the JSONL
 * pipe so messages render as plain text instead of leaking codes.
 *
 * ## Architectural boundary
 * - Renders durable transcript messages and tool activity without changing the provider-neutral
 *   conversation model.
 * - Parsing and normalization belong in shared transcript helpers; this layer owns readable
 *   presentation and interaction.
 * - Large histories must remain incremental so a single expanded conversation does not block the
 *   dashboard.
 *
 * ## Public surface
 * - `hasTuiTags` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `parseTuiSegments` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `stripAnsi` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `TuiSegment` (type) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `ANSI_RE` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `COMMAND_TAGS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `findCommandBlocks` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `findSimpleTagMatches` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `hasTuiTags` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `KNOWN_TAG_RE` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MatchSpan` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `parseTuiSegments` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SIMPLE_TAGS` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `stripAnsi` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TuiSegment` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Preserve message identity and sender attribution across Claude, Codex, Cursor, imported, and
 *   snapshot-backed sessions.
 * - Treat tool input, tool output, markdown, code, images, and malformed payloads as distinct
 *   rendering cases.
 * - Never execute transcript content; sanitize links and render code as inert text with controlled
 *   highlighting.
 * - Keep pagination append/prepend behavior stable and preserve scroll position when older messages
 *   arrive.
 * - Do not truncate content without an explicit affordance that lets the operator inspect the full
 *   value.
 * - Use virtualization or bounded rendering patterns where the existing component establishes them.
 * - Keep copy/select behavior predictable for terminal-style segments and syntax-highlighted
 *   blocks.
 * - Represent missing snapshot data honestly instead of implying the underlying provider still
 *   retains a transcript.
 * - Maintain accessible labels for sender, timestamp, tool state, expansion controls, and
 *   attachments.
 * - Test malformed and provider-specific rows because transcript fixtures evolve independently of
 *   UI releases.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/tuiSegments.ts`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/conversation/tuiSegments.ts`
 * **Purpose:** Renders Claude transcript rows (user, assistant, tool calls) inside Session Detail with markdown, syntax highlighting, and TUI-style segments.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Public surface
 * - `TuiSegment` — exported API; see TSDoc on the symbol for behavior.
 * - `stripAnsi` — exported API; see TSDoc on the symbol for behavior.
 * - `parseTuiSegments` — exported API; see TSDoc on the symbol for behavior.
 * - `hasTuiTags` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **TuiSegment**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **stripAnsi**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **parseTuiSegments**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **hasTuiTags**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

export type TuiSegment =
  | { kind: "caveat"; text: string }
  | { kind: "stdout"; text: string }
  | { kind: "stderr"; text: string }
  | { kind: "system-reminder"; text: string }
  | { kind: "persisted-output"; text: string }
  | { kind: "command"; display: string }
  | { kind: "text"; text: string };

/**
 * Simple wrapper tags the Claude Code TUI injects into user messages, mapped to the segment kind
 * each renders as.
 */
const SIMPLE_TAGS: Record<string, TuiSegment["kind"]> = {
  "local-command-caveat": "caveat",
  "local-command-stdout": "stdout",
  "local-command-stderr": "stderr",
  "system-reminder": "system-reminder",
  "persisted-output": "persisted-output",
};

/**
 * Tags that together describe a slash-command invocation; adjacent ones are grouped into one
 * command pill.
 */
const COMMAND_TAGS = ["command-name", "command-message", "command-args"] as const;

/**
 * Quick check for whether a message contains any known TUI tag, so plain messages skip the full
 * parse.
 */
const KNOWN_TAG_RE = new RegExp(
  `<(?:${[...Object.keys(SIMPLE_TAGS), ...COMMAND_TAGS].join("|")})\\b`
);

/**
 * Matches SGR color codes: both real ESC-prefixed codes and the bare `[Nm` form left when the ESC
 * byte is dropped during JSON encoding. It only matches when followed by `m`, the SGR terminator,
 * so ordinary bracketed text is left alone.
 */
const ANSI_RE = /\[[\d;]*m|\[\d+(?:;\d+)*m/g;

/**
 * Remove ANSI color codes from text.
 *
 * @param text - Text that may contain SGR codes.
 * @returns The text without them.
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** One matched tag in the input and the segment it becomes. */
interface MatchSpan {
  /** Offset where the match starts. */
  start: number;
  /** Offset just past the match. */
  end: number;
  /** Segment the matched text renders as. */
  segment: TuiSegment;
}

/**
 * Find every simple tag (caveat, stdout, stderr, system reminder, persisted output) in the input.
 *
 * @param input - Message text.
 * @returns Matches with their offsets, in tag order rather than position order.
 */
function findSimpleTagMatches(input: string): MatchSpan[] {
  const matches: MatchSpan[] = [];
  for (const [tag, kind] of Object.entries(SIMPLE_TAGS)) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        segment: { kind, text: m[1] ?? "" } as TuiSegment,
      });
    }
  }
  return matches;
}

/**
 * Find slash-command blocks: one to three adjacent `<command-name>`, `<command-message>`, and
 * `<command-args>` tags, grouped so a single pill renders whatever order they arrive in.
 *
 * @param input - Message text.
 * @returns One match per command block.
 */
function findCommandBlocks(input: string): MatchSpan[] {
  // A command block is one or more <command-name|message|args> tags possibly
  // separated by whitespace. Group them so a single pill renders even when
  // the tags arrive in name -> message -> args order.
  const re = /(?:<command-(?:name|message|args)>[^<]*<\/command-(?:name|message|args)>\s*){1,3}/g;
  const out: MatchSpan[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const block = m[0];
    const name = /<command-name>([^<]*)<\/command-name>/.exec(block)?.[1] ?? "";
    const args = /<command-args>([^<]*)<\/command-args>/.exec(block)?.[1] ?? "";
    if (!name) continue;
    const trimmedArgs = args.trim();
    out.push({
      start: m.index,
      end: m.index + block.length,
      segment: {
        kind: "command",
        display: trimmedArgs ? `${name} ${trimmedArgs}` : name,
      },
    });
  }
  return out;
}

/**
 * Walks a message text and splits out recognized TUI/command segments while
 * preserving the surrounding prose as `text` segments. Returns a single
 * `text` segment for inputs that contain no recognized markup.
 *
 * @param input - Message text.
 * @returns Segments in order.
 */
export function parseTuiSegments(input: string): TuiSegment[] {
  if (!KNOWN_TAG_RE.test(input)) {
    return [{ kind: "text", text: input }];
  }

  const matches = [...findSimpleTagMatches(input), ...findCommandBlocks(input)].sort(
    (a, b) => a.start - b.start
  );

  const segments: TuiSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    if (m.start > cursor) {
      const between = input.slice(cursor, m.start);
      if (between.trim()) {
        segments.push({ kind: "text", text: between });
      }
    }
    segments.push(m.segment);
    cursor = m.end;
  }
  if (cursor < input.length) {
    const tail = input.slice(cursor);
    if (tail.trim()) segments.push({ kind: "text", text: tail });
  }

  return segments.length > 0 ? segments : [{ kind: "text", text: input }];
}

/**
 * True if any recognized TUI tag would alter the rendering of this text.
 *
 * @param input - Message text.
 * @returns True when the text contains a known tag.
 */
export function hasTuiTags(input: string): boolean {
  return KNOWN_TAG_RE.test(input);
}
