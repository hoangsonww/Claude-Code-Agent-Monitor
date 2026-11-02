/**
 * @file primitives.tsx
 * @description Presentational building blocks used by the per-tool input and
 * response renderers. Each primitive is a pure component with a narrow,
 * typed contract so they can be composed freely (Terminal + TerminalOutput for
 * Bash; Terminal + UnifiedDiff for Edit; LineNumberedCode for Read/Write;
 * FileList/MatchList for Grep/Glob; KeyValueCard for MCP tools).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/event-views/primitives.tsx
 * **Area:** client component
 * **Responsibility:**
 * Presentational building blocks used by the per-tool input and response renderers. Each primitive
 * is a pure component with a narrow, typed contract so they can be composed freely (Terminal +
 * TerminalOutput for Bash; Terminal + UnifiedDiff for Edit; LineNumberedCode for Read/Write;
 * FileList/MatchList for Grep/Glob; KeyValueCard for MCP tools).
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `CopyButton` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `DiffHunk` (type) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `FileList` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `GrepMatch` (type) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `KeyValueCard` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `LineNumberedCode` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `MatchList` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `Terminal` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `TerminalOutput` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `UnifiedDiff` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CopyButton` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `DiffHunk` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `FileList` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `GrepMatch` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `HunkView` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `KeyValueCard` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `LineNumberedCode` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `MatchList` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `OutputBlock` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `safeStringify` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `Terminal` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TerminalOutput` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `UnifiedDiff` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ValueCell` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `common` — visible copy resolves through this namespace; key and interpolation parity applies
 *   to every supported locale.
 *
 * ## Area invariants
 * - Keep prop meaning and callback timing stable; parent components often rely on both even when
 *   types still compile.
 * - Render valid semantic controls with accessible names, focus behavior, disabled states, and
 *   keyboard operation.
 * - Keep visible strings in the appropriate i18n namespace rather than embedding English-only
 *   literals.
 * - Use shared design tokens and existing primitives so light/dark styling and compact layouts
 *   remain coherent.
 * - Avoid mutating arrays or objects received through props; derived display data should be
 *   computed immutably.
 * - Make empty and unavailable values explicit instead of rendering misleading zeroes or
 *   placeholder punctuation.
 * - Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction
 *   requires it.
 * - Do not duplicate server validation or destructive gates as if client-side checks were
 *   authoritative.
 * - Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated
 *   copy.
 * - Prefer stable keys derived from entity identity over array indexes for live, filtered, or
 *   reordered collections.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/event-views/primitives.tsx`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/event-views/primitives.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * - `CopyButton` — exported API; see TSDoc on the symbol for behavior.
 * - `Terminal` — exported API; see TSDoc on the symbol for behavior.
 * - `TerminalOutput` — exported API; see TSDoc on the symbol for behavior.
 * - `LineNumberedCode` — exported API; see TSDoc on the symbol for behavior.
 * - `DiffHunk` — exported API; see TSDoc on the symbol for behavior.
 * - `UnifiedDiff` — exported API; see TSDoc on the symbol for behavior.
 * - `KeyValueCard` — exported API; see TSDoc on the symbol for behavior.
 * - `FileList` — exported API; see TSDoc on the symbol for behavior.
 * - `GrepMatch` — exported API; see TSDoc on the symbol for behavior.
 * - `MatchList` — exported API; see TSDoc on the symbol for behavior.
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
 * **CopyButton**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **Terminal**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **TerminalOutput**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **LineNumberedCode**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **DiffHunk**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **UnifiedDiff**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **KeyValueCard**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **FileList**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **GrepMatch**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **MatchList**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";

// ───────────────────────── Copy button ─────────────────────────

/**
 * Icon button that copies text to the clipboard and shows a check for 1.5 seconds. Does nothing
 * when the clipboard is unavailable.
 */
export function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in insecure contexts - silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-surface-2 cursor-pointer"
      aria-label={t("eventDetail.copy")}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? t("eventDetail.copied") : t("eventDetail.copy")}
    </button>
  );
}

// ───────────────────────── Terminal (command) ─────────────────────────

/**
 * Terminal-styled block for a shell command, with an optional `# description` comment line and a
 * copy button.
 */
export function Terminal({ command, description }: { command: string; description?: string }) {
  return (
    <div className="relative bg-black/70 border border-border rounded font-mono text-[11px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-black/40">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide">terminal</span>
        <CopyButton text={command} />
      </div>
      <pre className="px-3 py-2 text-gray-200 whitespace-pre-wrap break-words">
        {description && <div className="text-gray-500 mb-1"># {description}</div>}
        <div>
          <span className="text-emerald-400 select-none">$ </span>
          {command}
        </div>
      </pre>
    </div>
  );
}

// ───────────────────────── Terminal output (stdout/stderr) ─────────────────────────

/**
 * Command output block for a Bash tool result: stdout and stderr in separate sections, plus an
 * interrupted marker and the exit code when known.
 */
export function TerminalOutput({
  stdout,
  stderr,
  interrupted,
  exitCode,
}: {
  /** Captured standard output. */
  stdout?: string;
  /** Captured standard error. */
  stderr?: string;
  /** Whether the command was interrupted. */
  interrupted?: boolean;
  /** Exit code, when known. */
  exitCode?: number;
}) {
  const hasStdout = typeof stdout === "string" && stdout.length > 0;
  const hasStderr = typeof stderr === "string" && stderr.length > 0;
  const flag =
    interrupted === true
      ? { label: "interrupted", color: "text-red-400 border-red-500/40 bg-red-500/10" }
      : typeof exitCode === "number" && exitCode !== 0
        ? {
            label: `exit ${exitCode}`,
            color: "text-red-400 border-red-500/40 bg-red-500/10",
          }
        : null;

  return (
    <div className="space-y-2">
      {hasStdout && <OutputBlock label="stdout" text={stdout!} variant="out" />}
      {hasStderr && <OutputBlock label="stderr" text={stderr!} variant="err" />}
      {flag && (
        <span
          className={`inline-block text-[10px] px-2 py-0.5 rounded border font-mono ${flag.color}`}
        >
          {flag.label}
        </span>
      )}
    </div>
  );
}

/** One labelled output section; stderr is tinted red. */
function OutputBlock({
  label,
  text,
  variant,
}: {
  /** Section label, such as stdout. */
  label: string;
  /** Output text. */
  text: string;
  /** `err` tints the block red. */
  variant: "out" | "err";
}) {
  const color = variant === "err" ? "text-red-300" : "text-gray-200";
  return (
    <div className="relative bg-black/70 border border-border rounded font-mono text-[11px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-black/40">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</span>
        <CopyButton text={text} />
      </div>
      <pre className={`px-3 py-2 whitespace-pre-wrap break-words max-h-96 overflow-auto ${color}`}>
        {text}
      </pre>
    </div>
  );
}

// ───────────────────────── Line-numbered code ─────────────────────────

/**
 * Read-only code block with a line-number gutter, scrolling past `maxHeight`.
 *
 * @param props.text - Code to show.
 * @param props.maxHeight - CSS max height; defaults to `24rem`.
 * @param props.startLine - Number of the first line, for excerpts; defaults to 1.
 * @param props.label - Optional caption, such as the file path.
 */
export function LineNumberedCode({
  text,
  maxHeight = "24rem",
  startLine = 1,
  label,
}: {
  /** Code to show. */
  text: string;
  /** CSS max height before the block scrolls; defaults to `24rem`. */
  maxHeight?: string;
  /** Number of the first line, for excerpts; defaults to 1. */
  startLine?: number;
  /** Optional caption, such as the file path. */
  label?: string;
}) {
  const lines = text.split(/\r?\n/);
  return (
    <div className="relative bg-black/70 border border-border rounded font-mono text-[11px] overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-black/40">
          <span className="text-gray-500 text-[10px] uppercase tracking-wide">{label}</span>
          <CopyButton text={text} />
        </div>
      )}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="px-2 text-right text-gray-600 select-none bg-black/40 border-r border-border align-top">
                  {i + startLine}
                </td>
                <td className="px-3 text-gray-200 whitespace-pre-wrap break-words">{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ───────────────────────── Unified diff ─────────────────────────

/**
 * One hunk of a unified diff, taken from the tool response's `structuredPatch` or computed from the
 * old and new strings.
 */
export type DiffHunk = {
  /** First line of the hunk in the old file. */
  oldStart: number;
  /** First line of the hunk in the new file. */
  newStart: number;
  /** Number of old-file lines the hunk covers. */
  oldLines: number;
  /** Number of new-file lines the hunk covers. */
  newLines: number;
  /** Hunk body lines, each prefixed with `+`, `-`, or a space. */
  lines: string[];
};

/**
 * Unified diff view for Edit and Write tool calls, one section per hunk; shows `no diff` when there
 * are no hunks.
 */
export function UnifiedDiff({ hunks }: { hunks: DiffHunk[] }) {
  if (hunks.length === 0) {
    return <p className="text-[11px] text-gray-500 italic">no diff</p>;
  }
  return (
    <div className="relative bg-black/70 border border-border rounded font-mono text-[11px] overflow-hidden">
      <div className="overflow-auto max-h-96">
        {hunks.map((hunk, i) => (
          <HunkView key={i} hunk={hunk} />
        ))}
      </div>
    </div>
  );
}

/**
 * One diff hunk: the `@@` header, then each line with old and new line numbers, green for additions
 * and red for removals.
 */
function HunkView({ hunk }: { hunk: DiffHunk }) {
  let oldLine = hunk.oldStart;
  let newLine = hunk.newStart;
  return (
    <div>
      <div className="px-3 py-1 text-[10px] text-cyan-300 bg-cyan-500/10 border-y border-cyan-500/20 font-mono">
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {hunk.lines.map((line, i) => {
            const kind = line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : "ctx";
            const body = line.slice(kind === "ctx" ? 0 : 1);
            const showOld = kind !== "add";
            const showNew = kind !== "remove";
            const rowBg =
              kind === "add"
                ? "bg-green-500/10 text-green-200"
                : kind === "remove"
                  ? "bg-red-500/10 text-red-200"
                  : "text-gray-300";
            const oldCell = showOld ? oldLine++ : "";
            const newCell = showNew ? newLine++ : "";
            const sign = kind === "add" ? "+" : kind === "remove" ? "-" : " ";
            return (
              <tr key={i} className={rowBg}>
                <td className="px-2 text-right text-gray-600 select-none border-r border-border/40 w-[36px]">
                  {oldCell}
                </td>
                <td className="px-2 text-right text-gray-600 select-none border-r border-border/40 w-[36px]">
                  {newCell}
                </td>
                <td className="px-1 text-center select-none w-[16px]">{sign}</td>
                <td className="px-2 whitespace-pre-wrap break-words">{body}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────── Key-value card ─────────────────────────

/**
 * Two-column key/value view of a tool's input. Keys listed in `priority` come first in that order,
 * and the rest follow in object order.
 */
export function KeyValueCard({
  data,
  priority = [],
}: {
  /** Object to show. */
  data: Record<string, unknown>;
  /** Keys to list first, in this order. */
  priority?: string[];
}) {
  const entries = Object.entries(data);
  const priorityEntries = priority
    .map((k) => [k, data[k]] as [string, unknown])
    .filter(([, v]) => v !== undefined);
  const restEntries = entries.filter(([k]) => !priority.includes(k));
  const ordered = [...priorityEntries, ...restEntries];

  if (ordered.length === 0) {
    return <p className="text-[11px] text-gray-500 italic">empty</p>;
  }

  return (
    <table className="w-full text-[11px] border border-border rounded overflow-hidden">
      <tbody>
        {ordered.map(([k, v], i) => (
          <tr key={k} className={i > 0 ? "border-t border-border" : ""}>
            <td className="text-gray-500 align-top py-1.5 px-2 font-mono bg-surface-3/60 w-[28%] break-all">
              {k}
            </td>
            <td className="text-gray-300 align-top py-1.5 px-2">
              <ValueCell value={v} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Render one value by type: a true/false chip for booleans, monospace for numbers, plain text for
 * strings, and pretty-printed JSON for objects and arrays. `null` and `undefined` show as an italic
 * `null`.
 */
function ValueCell({ value }: { value: unknown }) {
  if (value == null) return <span className="text-gray-500 italic">null</span>;
  if (typeof value === "boolean")
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-mono ${
          value
            ? "text-green-400 border-green-500/30 bg-green-500/10"
            : "text-gray-400 border-gray-500/30 bg-gray-500/10"
        }`}
      >
        {String(value)}
      </span>
    );
  if (typeof value === "number") return <span className="font-mono text-gray-300">{value}</span>;
  if (typeof value === "string") {
    if (value.length > 120 || value.includes("\n")) {
      return (
        <pre className="bg-surface-3 text-gray-300 text-[11px] font-mono p-2 rounded border border-border whitespace-pre-wrap break-words max-h-48 overflow-auto">
          {value}
        </pre>
      );
    }
    return <span className="font-mono text-gray-300 break-all">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-500 italic">[]</span>;
    return (
      <ol className="list-decimal pl-4 space-y-1">
        {value.map((item, i) => (
          <li key={i}>
            <ValueCell value={item} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <pre className="bg-surface-3 text-gray-300 text-[11px] font-mono p-2 rounded border border-border whitespace-pre-wrap break-words max-h-48 overflow-auto">
      {safeStringify(value)}
    </pre>
  );
}

/**
 * JSON-stringify a value with indentation, falling back to `String(value)` for values JSON cannot
 * serialize, such as circular structures.
 *
 * @param value - Any value.
 * @returns The text to display.
 */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ───────────────────────── File list / match list ─────────────────────────

/** Scrollable list of file paths, for example a Glob result; shows `no files` when empty. */
export function FileList({ paths }: { paths: string[] }) {
  if (paths.length === 0) return <p className="text-[11px] text-gray-500 italic">no files</p>;
  return (
    <ul className="divide-y divide-border border border-border rounded overflow-hidden text-[11px] max-h-80 overflow-y-auto">
      {paths.map((p, i) => (
        <li key={i} className="px-3 py-1 font-mono text-gray-300 break-all">
          {p}
        </li>
      ))}
    </ul>
  );
}

/**
 * One Grep match. Every field is optional because Grep's output mode decides which parts are
 * present.
 */
export type GrepMatch = {
  /** File the match is in. */
  file?: string;
  /** 1-based line number of the match. */
  line?: number;
  /** Matching line text. */
  text?: string;
};

/** Scrollable list of Grep matches in `file:line: text` form; shows `no matches` when empty. */
export function MatchList({ matches }: { matches: GrepMatch[] }) {
  if (matches.length === 0) return <p className="text-[11px] text-gray-500 italic">no matches</p>;
  return (
    <ul className="divide-y divide-border border border-border rounded overflow-hidden text-[11px] max-h-80 overflow-y-auto font-mono">
      {matches.map((m, i) => (
        <li key={i} className="px-3 py-1 text-gray-300 break-all">
          {m.file && <span className="text-cyan-300">{m.file}</span>}
          {m.line != null && <span className="text-gray-500">:{m.line}</span>}
          {m.text && <span className="text-gray-400">: {m.text}</span>}
        </li>
      ))}
    </ul>
  );
}
