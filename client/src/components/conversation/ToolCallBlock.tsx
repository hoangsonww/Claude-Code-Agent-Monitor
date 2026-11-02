/**
 * @file ToolCallBlock.tsx
 * @description Collapsible block rendered inside an assistant message for each
 * tool_use / tool_result pair. Shows tool icon + name in the header, with the
 * paired result inline when present. Per-tool styling comes from toolStyle.ts;
 * the tool's input/output payload is delegated to <CodeBlock /> for syntax
 * highlighting.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/ToolCallBlock.tsx
 * **Area:** client conversation component
 * **Responsibility:**
 * Collapsible block rendered inside an assistant message for each tool_use / tool_result pair.
 * Shows tool icon + name in the header, with the paired result inline when present. Per-tool
 * styling comes from toolStyle.ts; the tool's input/output payload is delegated to <CodeBlock />
 * for syntax highlighting.
 *
 * ## Architectural boundary
 * - Renders durable transcript messages and tool activity without changing the provider-neutral
 *   conversation model.
 * - Parsing and normalization belong in shared transcript helpers; this layer owns readable
 *   presentation and interaction.
 * - Large histories must remain incremental so a single expanded conversation does not block the
 *   dashboard.
 *
 * ## Local dependency edges
 * - `../../lib/types` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `./CodeBlock` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./toolStyle` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `ToolCallBlock` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `buildSummary` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `langFromPath` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `renderInput` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `renderResult` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ToolCallBlock` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ToolCallBlockProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/ToolCallBlock.tsx`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/conversation/ToolCallBlock.tsx`
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
 * ## Internal dependencies
 * - `../../lib/types`
 * - `./CodeBlock`
 * - `./toolStyle`
 *
 * ## Public surface
 * - `ToolCallBlock` — exported API; see TSDoc on the symbol for behavior.
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
 * **ToolCallBlock**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useState } from "react";
import { ChevronRight, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import type { TranscriptContent } from "../../lib/types";
import { CodeBlock } from "./CodeBlock";
import { styleForTool } from "./toolStyle";

/** Props for {@link ToolCallBlock}. */
interface ToolCallBlockProps {
  /** The tool call from the transcript. */
  toolUse: TranscriptContent;
  /** The matching tool result, or null while it has not arrived. */
  toolResult?: TranscriptContent | null;
}

/**
 * Detect a likely language from a file path's extension.
 *
 * @param path - File path.
 * @returns A highlighter language name, or `plain` when the extension is unknown.
 */
function langFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts",
    tsx: "ts",
    js: "js",
    jsx: "js",
    mjs: "js",
    cjs: "js",
    py: "python",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    sql: "sql",
    md: "plain",
    txt: "plain",
    diff: "diff",
    patch: "diff",
  };
  return map[ext] ?? "plain";
}

/**
 * Build a one-line summary of the tool call to show in the collapsed header.
 *
 * @param toolUse - The tool call.
 * @returns A short summary such as the file path or command, or null when the input is missing or
 *   truncated.
 */
function buildSummary(toolUse: TranscriptContent): string | null {
  const input = toolUse.input;
  if (!input || typeof input !== "object" || "_truncated" in input) return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.file_path === "string") return obj.file_path;
  if (typeof obj.path === "string") return obj.path;
  if (typeof obj.command === "string") return obj.command.slice(0, 200);
  if (typeof obj.code === "string") return obj.code.replace(/\s+/g, " ").slice(0, 200);
  if (typeof obj.pattern === "string") return obj.pattern;
  if (typeof obj.query === "string") return obj.query;
  if (typeof obj.url === "string") return obj.url;
  if (typeof obj.description === "string") return obj.description;
  return null;
}

/**
 * Render the input pane with tool-aware formatting.
 *
 * @param toolUse - The tool call.
 * @returns The input pane, or null when there is no input.
 */
function renderInput(toolUse: TranscriptContent) {
  const input = toolUse.input;
  if (!input) return null;

  // Truncated payload from the backend
  if (typeof input === "object" && "_truncated" in input) {
    return (
      <CodeBlock
        code={String((input as { _truncated: string })._truncated)}
        lang="plain"
        label="Input (truncated)"
      />
    );
  }

  const obj = input as Record<string, unknown>;
  const tool = (toolUse.name ?? "").toLowerCase();

  // Codex's primary tool is `exec`; unlike Claude's Bash tool it carries a
  // JavaScript orchestration snippet under `code`. Render it as code instead
  // of a JSON blob so the transcript shows what actually ran.
  if (tool === "exec" && typeof obj.code === "string") {
    return <CodeBlock code={obj.code} lang="javascript" label="Codex tool call" />;
  }

  // Bash: show the command with shell highlighting
  if (tool === "bash" && typeof obj.command === "string") {
    return (
      <div className="space-y-2">
        <CodeBlock code={obj.command} lang="bash" label="Command" />
        {typeof obj.description === "string" && (
          <p className="text-xs text-gray-500 italic px-1">{obj.description}</p>
        )}
      </div>
    );
  }

  // Write: render new content as code with the file path as the chrome label
  if (tool === "write" && typeof obj.file_path === "string" && typeof obj.content === "string") {
    return (
      <CodeBlock
        code={obj.content}
        lang={langFromPath(obj.file_path)}
        filename={obj.file_path}
        label="New file"
      />
    );
  }

  // Edit: side-by-side old/new
  if (tool === "edit" && typeof obj.file_path === "string") {
    const lang = langFromPath(obj.file_path);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <FileText className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-mono">{obj.file_path}</span>
          {obj.replace_all === true && (
            <span className="text-[10px] uppercase tracking-wider text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
              replace all
            </span>
          )}
        </div>
        {typeof obj.old_string === "string" && (
          <CodeBlock code={obj.old_string} lang={lang} label="Removed" tone="danger" />
        )}
        {typeof obj.new_string === "string" && (
          <CodeBlock code={obj.new_string} lang={lang} label="Added" tone="success" />
        )}
      </div>
    );
  }

  // Read: just show the path with offset/limit
  if (tool === "read" && typeof obj.file_path === "string") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-300 bg-surface-4/40 border border-surface-3 rounded-md px-3 py-2">
        <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
        <span className="font-mono break-all">{obj.file_path}</span>
        {(typeof obj.offset === "number" || typeof obj.limit === "number") && (
          <span className="text-gray-500 font-mono ml-auto flex-shrink-0">
            {typeof obj.offset === "number" ? `:${obj.offset}` : ""}
            {typeof obj.limit === "number" ? `+${obj.limit}` : ""}
          </span>
        )}
      </div>
    );
  }

  // Grep: pattern + path
  if (tool === "grep" && typeof obj.pattern === "string") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 font-mono uppercase tracking-wider text-[10px]">
            Pattern
          </span>
          <code className="font-mono text-cyan-300 bg-surface-4 border border-surface-3 rounded px-1.5 py-0.5">
            {obj.pattern}
          </code>
        </div>
        {typeof obj.path === "string" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-mono uppercase tracking-wider text-[10px]">
              Path
            </span>
            <code className="font-mono text-gray-300">{obj.path}</code>
          </div>
        )}
        {typeof obj.glob === "string" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-mono uppercase tracking-wider text-[10px]">
              Glob
            </span>
            <code className="font-mono text-gray-300">{obj.glob}</code>
          </div>
        )}
      </div>
    );
  }

  // Default: pretty JSON
  return <CodeBlock code={JSON.stringify(obj, null, 2)} lang="json" label="Input" />;
}

/**
 * Render the result pane: detect diff/json/text.
 *
 * @param toolResult - The tool result.
 * @param toolName - Tool that produced it, which picks the view.
 */
function renderResult(toolResult: TranscriptContent, toolName: string) {
  const text = toolResult.output ?? "";
  if (text.length === 0) return <div className="text-xs text-gray-500 italic px-1">(empty)</div>;

  const isError = !!toolResult.is_error;
  const tool = toolName.toLowerCase();
  const label = isError ? "Error" : "Output";

  // Heuristics for language
  let lang = "plain";
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      lang = "json";
    } catch {
      // fall through
    }
  } else if (/^(\+\+\+|---|@@) /m.test(text) || /^diff --git /m.test(text)) {
    lang = "diff";
  } else if (tool === "bash") {
    lang = "bash";
  }

  return <CodeBlock code={text} lang={lang} label={label} tone={isError ? "danger" : "default"} />;
}

/**
 * Collapsible card for one tool call in a transcript: tool icon and name, a one-line summary, and
 * the result status. Expanding shows the full input and result. Errors use a red style.
 */
export function ToolCallBlock({ toolUse, toolResult }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const isError = toolResult?.is_error;
  const hasResult = toolResult != null;
  const summary = buildSummary(toolUse);
  const style = styleForTool(toolUse.name);
  const Icon = style.Icon;

  const wrapperBorder = isError ? "border-red-500/30" : style.border;
  const wrapperBg = isError ? "bg-red-500/5" : "bg-surface-2/60";

  return (
    <div
      className={`rounded-lg border ${wrapperBorder} ${wrapperBg} overflow-hidden transition-colors`}
    >
      {/* Collapsed/expanded toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-3/40 transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform duration-150 ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <span
          className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded ${style.chip}`}
        >
          <Icon className="w-3 h-3" />
        </span>
        <span className={`font-mono font-medium text-[13px] flex-shrink-0 ${style.text}`}>
          {toolUse.name}
        </span>
        {summary && (
          <span className="text-gray-500 text-xs font-mono truncate min-w-0" title={summary}>
            {summary}
          </span>
        )}
        <span className="ml-auto flex-shrink-0">
          {isError ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-300 bg-red-500/15 border border-red-500/20 rounded px-1.5 py-0.5">
              <AlertCircle className="w-3 h-3" />
              error
            </span>
          ) : hasResult ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
              <CheckCircle2 className="w-3 h-3" />
              ok
            </span>
          ) : (
            <span className="text-gray-600 text-[10px] uppercase tracking-wider font-mono">
              pending
            </span>
          )}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-surface-3 bg-surface-1/40 px-3 py-3 space-y-2.5 animate-fade-in">
          {renderInput(toolUse)}
          {hasResult && renderResult(toolResult, toolUse.name ?? "")}
        </div>
      )}
    </div>
  );
}
