/**
 * @file banner.ts
 * @description Console startup UI for the MCP server's non-stdio transports (HTTP and REPL):
 * the ASCII-art wordmark, a boxed server-info panel (version, transport, dashboard URL, port,
 * tool count, mutation/destructive policy state), a "ready" line, and a shutdown message. The
 * stdio transport never calls any of these, since stdout there is the MCP JSON-RPC channel.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/ui/banner.ts
 * **Area:** MCP server
 * **Responsibility:**
 * Console startup UI for the MCP server's non-stdio transports (HTTP and REPL): the ASCII-art
 * wordmark, a boxed server-info panel (version, transport, dashboard URL, port, tool count,
 * mutation/destructive policy state), a "ready" line, and a shutdown message. The stdio transport
 * never calls any of these, since stdout there is the MCP JSON-RPC channel.
 *
 * ## Architectural boundary
 * - Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent
 *   server behavior.
 * - Domain modules own individual tools; this layer owns consistent registration and process-level
 *   coordination.
 * - Host disappearance and signals must converge on bounded, idempotent cleanup.
 *
 * ## Local dependency edges
 * - `./colors.js` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Public surface
 * - `printBanner` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `printReady` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `printServerInfo` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `printShutdown` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `BANNER` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `printBanner` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `printReady` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `printServerInfo` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `printShutdown` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Keep server metadata and advertised capabilities synchronized with the actual registered
 *   implementation.
 * - Do not let one tool-registration failure leave a partially initialized server accepting
 *   requests.
 * - Preserve transport neutrality for tool behavior and result formatting.
 * - Route logs away from protocol stdout and redact secret-bearing fields.
 * - Make startup failures explicit and nonzero while allowing graceful close to finish in-flight
 *   cleanup.
 * - Keep orphan detection bounded and compare against the correct startup parent semantics.
 * - Avoid module-evaluation side effects that complicate tests or create resources before
 *   configuration validates.
 * - Keep tool collection deterministic so schemas and help output do not reorder between runs.
 * - Treat unhandled rejection and exception paths as process health failures without double-running
 *   shutdown.
 * - Test server construction independently from real network transports where the SDK permits it.
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
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/ui/banner.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/ui/banner.ts`
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
 * - `printBanner` — exported API; see TSDoc on the symbol for behavior.
 * - `printServerInfo` — exported API; see TSDoc on the symbol for behavior.
 * - `printReady` — exported API; see TSDoc on the symbol for behavior.
 * - `printShutdown` — exported API; see TSDoc on the symbol for behavior.
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
 * **printBanner**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **printServerInfo**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **printReady**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **printShutdown**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import * as c from "./colors.js";

/** ASCII-art wordmark rendered by {@link printBanner} with a color gradient. */
const BANNER = `
$$\\      $$\\  $$$$$$\\  $$$$$$$\\        $$$$$$$$\\                  $$\\           
$$$\\    $$$ |$$  __$$\\ $$  __$$\\       \\__$$  __|                 $$ |          
$$$$\\  $$$$ |$$ /  \\__|$$ |  $$ |         $$ | $$$$$$\\   $$$$$$\\  $$ | $$$$$$$\\ 
$$\\$$\\$$ $$ |$$ |      $$$$$$$  |         $$ |$$  __$$\\ $$  __$$\\ $$ |$$  _____|
$$ \\$$$  $$ |$$ |      $$  ____/          $$ |$$ /  $$ |$$ /  $$ |$$ |\\$$$$$$\\  
$$ |\\$  /$$ |$$ |  $$\\ $$ |               $$ |$$ |  $$ |$$ |  $$ |$$ | \\____$$\\ 
$$ | \\_/ $$ |\\$$$$$$  |$$ |               $$ |\\$$$$$$  |\\$$$$$$  |$$ |$$$$$$$  |
\\__|     \\__| \\______/ \\__|               \\__| \\______/  \\______/ \\__|\\_______/ `;

/** Prints {@link BANNER} one line per gradient color (cyan to magenta).
 * Called at HTTP/REPL startup only. */
export function printBanner(): void {
  const gradient = [c.brightCyan, c.cyan, c.brightBlue, c.blue, c.brightMagenta, c.magenta];
  const lines = BANNER.split("\n").filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const colorFn = gradient[Math.min(i, gradient.length - 1)];
    process.stdout.write(colorFn(lines[i]) + "\n");
  }
  process.stdout.write("\n");
}

/** Prints a boxed config summary beneath the banner, shared by HTTP (`port`
 * set) and REPL (`port` omitted). Mutations/Destructive rows mirror the
 * `policy/tool-guards.ts` flags, warning-colored when enabled. Ends with a
 * reminder that the dashboard must already be running at the printed URL.
 *
 * @param info - Values to show in the panel.
 */
export function printServerInfo(info: {
  /** Transport description, for example `http (sse + streamable)`. */
  transport: string;
  /** MCP server version. */
  version: string;
  /** Dashboard base URL the tools call. */
  dashboard: string;
  /** Listening port, for the HTTP transport. */
  port?: number;
  /** Whether tools that change dashboard data are enabled (`allowMutations`). */
  mutations: boolean;
  /** Whether destructive tools are enabled (`MCP_DASHBOARD_ALLOW_DESTRUCTIVE`, off by default). */
  destructive: boolean;
  /** Number of registered tools. */
  tools: number;
}): void {
  const divider = c.dim(c.cyan("─".repeat(62)));
  /** Format one label/value line of the startup panel. */
  const line = (label: string, value: string) =>
    `  ${c.dim(c.cyan("│"))} ${c.label(label.padEnd(18))} ${value}`;

  process.stdout.write(divider + "\n");
  process.stdout.write(
    `  ${c.dim(c.cyan("│"))} ${c.bold(c.brightWhite("Agent Dashboard MCP Server"))}\n`
  );
  process.stdout.write(divider + "\n");
  process.stdout.write(line("Version", c.brightCyan(info.version)) + "\n");
  process.stdout.write(line("Transport", c.accent(info.transport.toUpperCase())) + "\n");
  process.stdout.write(line("Dashboard API", c.green(info.dashboard)) + "\n");
  if (info.port !== undefined) {
    process.stdout.write(line("HTTP Port", c.brightYellow(String(info.port))) + "\n");
  }
  process.stdout.write(line("Tools Registered", c.brightWhite(String(info.tools))) + "\n");
  process.stdout.write(
    line("Mutations", info.mutations ? c.warn("ENABLED") : c.success("disabled")) + "\n"
  );
  process.stdout.write(
    line("Destructive", info.destructive ? c.error("ENABLED") : c.success("disabled")) + "\n"
  );
  process.stdout.write(divider + "\n");
  process.stdout.write(
    `  ${c.dim(c.cyan("│"))} ${c.warn("⚠")}  ${c.dim("Dashboard must be running at the URL above.")}\n`
  );
  process.stdout.write(
    `  ${c.dim(c.cyan("│"))} ${c.dim("   Start it first:")} ${c.brightWhite("npm run dev")} ${c.dim("or")} ${c.brightWhite("npm start")}\n`
  );
  process.stdout.write(divider + "\n\n");
}

/** Prints "Server ready" once the HTTP server has bound to its port; not
 * used by the REPL transport.
 *
 * @param transport - Transport description shown after the message.
 */
export function printReady(transport: string): void {
  const icon = "✔";
  process.stdout.write(
    `  ${c.success(icon)} ${c.bold(c.brightWhite("Server ready"))} ${c.muted(`(${transport})`)}\n\n`
  );
}

/** Prints "Shutting down...". Called from HTTP/REPL shutdown paths and
 * `index.ts`'s SIGINT/SIGTERM handler; never from stdio. */
export function printShutdown(): void {
  process.stdout.write(`\n  ${c.warn("⏻")} ${c.bold(c.brightWhite("Shutting down..."))}\n`);
}
