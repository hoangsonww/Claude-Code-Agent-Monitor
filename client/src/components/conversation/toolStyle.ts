/**
 * @file toolStyle.ts
 * @description Per-tool visual styling - icon component, accent colour, and tinted
 * surface classes. Keeps the conversation viewer's tool blocks visually distinct so
 * users can scan a long transcript quickly.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/conversation/toolStyle.ts
 * **Area:** client conversation component
 * **Responsibility:**
 * Per-tool visual styling - icon component, accent colour, and tinted surface classes. Keeps the
 * conversation viewer's tool blocks visually distinct so users can scan a long transcript quickly.
 *
 * ## Architectural boundary
 * - Renders durable transcript messages and tool activity without changing the provider-neutral
 *   conversation model.
 * - Parsing and normalization belong in shared transcript helpers; this layer owns readable
 *   presentation and interaction.
 * - Large histories must remain incremental so a single expanded conversation does not block the
 *   dashboard.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `styleForTool` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `ToolStyle` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `styleForTool` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `STYLES` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ToolStyle` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `VIOLET` (variable) — top-level declaration that helps orient code review and focused test
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/conversation/toolStyle.ts`
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/conversation/toolStyle.ts`
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
 * - `ToolStyle` — exported API; see TSDoc on the symbol for behavior.
 * - `styleForTool` — exported API; see TSDoc on the symbol for behavior.
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
 * **ToolStyle**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **styleForTool**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import {
  Wrench,
  Terminal,
  FileText,
  FilePlus2,
  FilePen,
  Search,
  Globe,
  Bot,
  ListTodo,
  Clock,
  Sparkles,
  FolderTree,
  type LucideIcon,
} from "lucide-react";

/** Icon and color classes for one tool, used consistently in tool chips, bars, and borders. */
export interface ToolStyle {
  /** Icon component for the tool. */
  Icon: LucideIcon;
  /** Tailwind text colour for the icon and tool name. */
  text: string;
  /** Tailwind tinted background for the icon chip (15% opacity - sits behind
   *  the icon glyph; staying low-saturation keeps the icon legible). */
  chip: string;
  /** Tailwind background for solid fills like progress bars (60% opacity -
   *  high enough to read at a glance against the dark surface, distinct
   *  from the chip used for the icon backdrop). */
  bar: string;
  /** Tailwind border colour for the tool block when not in error state. */
  border: string;
}

/** Fallback style for unknown and MCP tools. */
const VIOLET: ToolStyle = {
  Icon: Wrench,
  text: "text-violet-300",
  chip: "bg-violet-500/15 text-violet-300",
  bar: "bg-violet-500/60",
  border: "border-violet-500/20",
};

/** Styles keyed by normalized tool name (lowercase, letters and digits only). */
const STYLES: Record<string, ToolStyle> = {
  bash: {
    Icon: Terminal,
    text: "text-emerald-300",
    chip: "bg-emerald-500/15 text-emerald-300",
    bar: "bg-emerald-500/60",
    border: "border-emerald-500/20",
  },
  read: {
    Icon: FileText,
    text: "text-sky-300",
    chip: "bg-sky-500/15 text-sky-300",
    bar: "bg-sky-500/60",
    border: "border-sky-500/20",
  },
  write: {
    Icon: FilePlus2,
    text: "text-violet-300",
    chip: "bg-violet-500/15 text-violet-300",
    bar: "bg-violet-500/60",
    border: "border-violet-500/20",
  },
  edit: {
    Icon: FilePen,
    text: "text-amber-300",
    chip: "bg-amber-500/15 text-amber-300",
    bar: "bg-amber-500/60",
    border: "border-amber-500/20",
  },
  multiedit: {
    Icon: FilePen,
    text: "text-amber-300",
    chip: "bg-amber-500/15 text-amber-300",
    bar: "bg-amber-500/60",
    border: "border-amber-500/20",
  },
  grep: {
    Icon: Search,
    text: "text-cyan-300",
    chip: "bg-cyan-500/15 text-cyan-300",
    bar: "bg-cyan-500/60",
    border: "border-cyan-500/20",
  },
  glob: {
    Icon: FolderTree,
    text: "text-cyan-300",
    chip: "bg-cyan-500/15 text-cyan-300",
    bar: "bg-cyan-500/60",
    border: "border-cyan-500/20",
  },
  webfetch: {
    Icon: Globe,
    text: "text-blue-300",
    chip: "bg-blue-500/15 text-blue-300",
    bar: "bg-blue-500/60",
    border: "border-blue-500/20",
  },
  websearch: {
    Icon: Globe,
    text: "text-blue-300",
    chip: "bg-blue-500/15 text-blue-300",
    bar: "bg-blue-500/60",
    border: "border-blue-500/20",
  },
  task: {
    Icon: Bot,
    text: "text-pink-300",
    chip: "bg-pink-500/15 text-pink-300",
    bar: "bg-pink-500/60",
    border: "border-pink-500/20",
  },
  agent: {
    Icon: Bot,
    text: "text-pink-300",
    chip: "bg-pink-500/15 text-pink-300",
    bar: "bg-pink-500/60",
    border: "border-pink-500/20",
  },
  todowrite: {
    Icon: ListTodo,
    text: "text-rose-300",
    chip: "bg-rose-500/15 text-rose-300",
    bar: "bg-rose-500/60",
    border: "border-rose-500/20",
  },
  schedulewakeup: {
    Icon: Clock,
    text: "text-orange-300",
    chip: "bg-orange-500/15 text-orange-300",
    bar: "bg-orange-500/60",
    border: "border-orange-500/20",
  },
  skill: {
    Icon: Sparkles,
    text: "text-fuchsia-300",
    chip: "bg-fuchsia-500/15 text-fuchsia-300",
    bar: "bg-fuchsia-500/60",
    border: "border-fuchsia-500/20",
  },
};

/**
 * Style for a tool name, normalized so `Bash`, `bash`, and `BASH` match the same entry.
 *
 * @param toolName - Tool name, possibly empty.
 * @returns The tool's style, or the violet fallback.
 */
export function styleForTool(toolName: string | undefined | null): ToolStyle {
  if (!toolName) return VIOLET;
  const key = toolName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return STYLES[key] ?? VIOLET;
}
