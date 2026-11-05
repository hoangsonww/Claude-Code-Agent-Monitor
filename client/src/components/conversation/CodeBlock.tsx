/**
 * @file CodeBlock.tsx
 * @description Reusable, syntax-highlighted code block with a chrome bar (language pill,
 * optional filename, copy-to-clipboard, line count) and optional gutter line numbers.
 * Used by MarkdownContent for fenced code blocks and by ToolCallBlock for tool I/O.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/CodeBlock.tsx
 * **Area:** client conversation component
 * **Responsibility:**
 * Reusable, syntax-highlighted code block with a chrome bar (language pill, optional filename,
 * copy-to-clipboard, line count) and optional gutter line numbers. Used by MarkdownContent for
 * fenced code blocks and by ToolCallBlock for tool I/O.
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
 * - `../../lib/highlight` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `CodeBlock` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CodeBlock` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `CodeBlockProps` (interface) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `LANG_DISPLAY` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `langDisplay` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `splitTokensByLine` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useMemo` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/CodeBlock.tsx`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/conversation/CodeBlock.tsx`
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
 * - `../../lib/highlight`
 *
 * ## Public surface
 * - `CodeBlock` — exported API; see TSDoc on the symbol for behavior.
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
 * **CodeBlock**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { Check, Copy, FileCode } from "lucide-react";
import { canonicalLang, highlight, tokenClass, type Token } from "../../lib/highlight";

/** Props for {@link CodeBlock}. */
interface CodeBlockProps {
  /** Source code to show. */
  code: string;
  /** Language tag from the fence, used for highlighting and the language label. */
  lang?: string;
  /** Optional filename to display in the chrome bar. */
  filename?: string;
  /** Render compact (no chrome bar). */
  compact?: boolean;
  /** Override for the right-side label (e.g. "Output", "Error"). */
  label?: string;
  /** Tone - "default" matches the surface, "danger" tints red, "success" tints emerald. */
  tone?: "default" | "danger" | "success";
  /** Cap the rendered height; pass null to disable. Default 24rem. */
  maxHeight?: string | null;
  /** Show a left gutter with line numbers. Default true for >= 4 lines. */
  showLineNumbers?: boolean;
}

/** Display names for language tags in the header. */
const LANG_DISPLAY: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  python: "Python",
  json: "JSON",
  bash: "Shell",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  yaml: "YAML",
  diff: "Diff",
  plain: "Text",
};

/**
 * Display name for a language tag, after resolving aliases.
 *
 * @param lang - Language tag.
 * @returns The display name, the raw tag when unknown, or `Text` when empty.
 */
function langDisplay(lang: string): string {
  const canon = canonicalLang(lang);
  return LANG_DISPLAY[canon] ?? (lang || "Text");
}

/**
 * Split tokens that span multiple lines so we can render one line at a time
 * (necessary for the gutter line-number column to align).
 *
 * @param tokens - Highlighted tokens for the whole block.
 * @returns Tokens grouped per line, splitting tokens that span newlines.
 */
function splitTokensByLine(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const t of tokens) {
    const parts = t.text.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      const piece = parts[i]!;
      if (piece.length > 0) {
        lines[lines.length - 1]!.push({ type: t.type, text: piece });
      }
    }
  }
  return lines;
}

/**
 * Syntax-highlighted code block with a header showing the language or file name and line count, a
 * copy button, and line numbers (on by default from four lines). `compact` drops the header.
 */
export function CodeBlock({
  code,
  lang = "",
  filename,
  compact = false,
  label,
  tone = "default",
  maxHeight = "24rem",
  showLineNumbers,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  /** Highlighted tokens for the code. */
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  /** Tokens grouped by line, for line numbers. */
  const lineTokens = useMemo(() => splitTokensByLine(tokens), [tokens]);
  const totalLines = lineTokens.length;
  const gutter = showLineNumbers ?? totalLines >= 4;

  /**
   * Copy the code and show a check mark for 1.5 seconds; does nothing when the clipboard is
   * unavailable.
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable in some contexts - fail silently.
    }
  };

  const palette =
    tone === "danger"
      ? {
          wrapper: "border-red-500/30 bg-red-500/5",
          chrome: "bg-red-500/10 border-b border-red-500/20",
          label: "text-red-300",
        }
      : tone === "success"
        ? {
            wrapper: "border-emerald-500/30 bg-emerald-500/5",
            chrome: "bg-emerald-500/10 border-b border-emerald-500/20",
            label: "text-emerald-300",
          }
        : {
            wrapper: "border-surface-3 bg-surface-4/50",
            chrome: "bg-surface-3/70 border-b border-surface-3",
            label: "text-gray-400",
          };

  const preStyle: React.CSSProperties = {};
  if (maxHeight) preStyle.maxHeight = maxHeight;

  return (
    <div
      className={`group/code rounded-md border overflow-hidden shadow-[0_1px_0_rgba(255,255,255,0.02)_inset,0_2px_8px_-4px_rgba(0,0,0,0.4)] ${palette.wrapper}`}
    >
      {!compact && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] ${palette.chrome}`}>
          {/* Language pill */}
          <span
            className={`inline-flex items-center gap-1 font-mono uppercase tracking-wider ${palette.label}`}
          >
            {filename ? <FileCode className="w-3 h-3 opacity-70" /> : null}
            {filename ?? label ?? langDisplay(lang)}
          </span>

          {/* Filename + lang together when both are set */}
          {filename && !label && (
            <span className="text-gray-600 font-mono lowercase">{langDisplay(lang)}</span>
          )}
          {filename && label && (
            <span className={`font-mono uppercase tracking-wider ${palette.label}`}>· {label}</span>
          )}

          {/* Right side: line count + copy */}
          <div className="ml-auto flex items-center gap-3">
            {totalLines > 1 && (
              <span className="text-gray-600 font-mono">
                {totalLines} {totalLines === 1 ? "line" : "lines"}
              </span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1 transition-colors ${
                copied ? "text-emerald-300" : "text-gray-500 hover:text-gray-200"
              }`}
              aria-label="Copy code"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto" style={preStyle}>
        <pre className="font-mono text-[12.5px] leading-[1.6]">
          <code>
            {gutter ? (
              <table className="border-collapse" style={{ width: "max-content", minWidth: "100%" }}>
                <tbody>
                  {lineTokens.map((line, i) => (
                    <tr key={i} className="align-top">
                      <td
                        className="select-none text-right pl-3 pr-3 text-gray-600 font-mono text-[11px] leading-[1.6] sticky left-0 bg-inherit"
                        style={{ width: "1%", whiteSpace: "nowrap" }}
                      >
                        {i + 1}
                      </td>
                      <td className="pl-0 pr-3 whitespace-pre">
                        {line.length === 0 ? (
                          <span>&nbsp;</span>
                        ) : (
                          line.map((t, j) => (
                            <span key={j} className={tokenClass(t.type)}>
                              {t.text}
                            </span>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-3 py-2 whitespace-pre">
                {tokens.map((t, i) => (
                  <span key={i} className={tokenClass(t.type)}>
                    {t.text}
                  </span>
                ))}
              </div>
            )}
          </code>
        </pre>
      </div>
    </div>
  );
}
