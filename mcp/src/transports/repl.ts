/**
 * @file repl.ts
 * @description Implements a REPL (Read-Eval-Print Loop) transport for the MCP server, allowing users to interact with the dashboard API and invoke registered tools directly from the command line. The REPL provides an interactive prompt with command history and tab completion for tool names and commands. It supports built-in commands for listing tools, showing configuration, and performing health checks, as well as invoking any registered tool with JSON or key=value arguments. The REPL is designed for ease of use and quick experimentation during development or debugging sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/transports/repl.ts
 * **Area:** MCP transport
 * **Responsibility:**
 * Implements a REPL (Read-Eval-Print Loop) transport for the MCP server, allowing users to interact
 * with the dashboard API and invoke registered tools directly from the command line. The REPL
 * provides an interactive prompt with command history and tab completion for tool names and
 * commands. It supports built-in commands for listing tools, showing configuration, and performing
 * health checks, as well as invoking any registered tool with JSON or key=value arguments. The REPL
 * is designed for ease of use and quick experimentation during development or debugging sessions.
 *
 * ## Architectural boundary
 * - Owns protocol lifecycle and connection-specific state while keeping tool semantics in the
 *   shared registry.
 * - Transport code must not write non-protocol data to stdio stdout or retain resources after
 *   disconnect.
 * - Authentication, origin, session, timeout, and graceful-shutdown behavior are explicit security
 *   boundaries.
 *
 * ## Local dependency edges
 * - `../clients/dashboard-api-client.js` — repository-local contract consumed by this module;
 *   review its exports before changing assumptions here.
 * - `../config/app-config.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../core/logger.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../core/tool-registry.js` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../ui/banner.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../ui/colors.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../ui/formatter.js` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:readline` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `createReplToolCollector` (function) — exported contract; search downstream imports and tests
 *   before changing its name, shape, or timing.
 * - `ReplToolCollector` (interface) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `startRepl` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `toolDomain` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `createReplToolCollector` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `DOMAIN_COLORS` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `domainBadge` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `handleCommand` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `invokeToolByName` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `parseArgs` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `printConfig` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `printDomains` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `printHelp` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `printToolList` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `ReplToolCollector` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `startRepl` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `TOOL_DOMAIN_RULES` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `toolDomain` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ToolEntry` (interface) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep stdout reserved for JSON-RPC in stdio mode; diagnostic output belongs through the
 *   configured logger.
 * - Create and dispose per-client server/session resources exactly once across normal close and
 *   error paths.
 * - Bound request bodies, idle sessions, connection counts, and retained event streams.
 * - Validate authentication before allocating expensive state or exposing tool metadata.
 * - Preserve compatibility between streamable HTTP and supported legacy transport behavior where
 *   documented.
 * - Make shutdown idempotent so signals, host disappearance, and transport close cannot race
 *   teardown.
 * - Do not trust forwarded host/origin information unless the server configuration explicitly
 *   enables that topology.
 * - Keep health endpoints lightweight and independent of long-lived MCP session initialization.
 * - Surface protocol errors in the shape expected by the SDK without leaking internal stacks or
 *   secrets.
 * - Test disconnect, expiration, duplicate close, authentication failure, and concurrent-session
 *   isolation.
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
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/transports/repl.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/transports/repl.ts`
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
 * ## Internal dependencies
 * - `../config/app-config.js`
 * - `../clients/dashboard-api-client.js`
 * - `../core/logger.js`
 * - `../ui/banner.js`
 * - `../ui/formatter.js`
 * - `../core/tool-registry.js`
 *
 * ## Public surface
 * - `startRepl` — exported API; see TSDoc on the symbol for behavior.
 * - `ReplToolCollector` — exported API; see TSDoc on the symbol for behavior.
 * - `createReplToolCollector` — exported API; see TSDoc on the symbol for behavior.
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
 * **startRepl**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ReplToolCollector**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **createReplToolCollector**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import * as readline from "node:readline";
import type { AppConfig } from "../config/app-config.js";
import type { DashboardApiClient } from "../clients/dashboard-api-client.js";
import type { Logger } from "../core/logger.js";
import { printBanner, printServerInfo, printShutdown } from "../ui/banner.js";
import * as c from "../ui/colors.js";
import {
  formatToolResult,
  formatToolError,
  table,
  sectionHeader,
  divider,
  badge,
} from "../ui/formatter.js";
import type { ToolHandler } from "../core/tool-registry.js";

/** A `ToolEntry` (`name`/`description`/`handler`) tagged with a `domain` for
 * REPL display/completion only — the domain has no effect on invocation. */
interface ToolEntry {
  /** Tool name as registered with the MCP server. */
  name: string;
  /** Tool description, shortened to 50 characters in tool listings. */
  description: string;
  /** Function that runs the tool. */
  handler: ToolHandler;
  /** Public domain the tool is grouped under, from {@link toolDomain}. */
  domain: string;
}

/**
 * Name patterns that assign a tool to a public domain for the REPL listing. Checked in order, so
 * more specific patterns come first.
 */
const TOOL_DOMAIN_RULES: Array<[RegExp, string]> = [
  [/update_status|check_for_updates|agent_homes|set_(claude|codex)_home|install_hooks/, "settings"],
  [/workflow/, "workflows"],
  [/alert/, "alerts"],
  [/webhook/, "webhooks"],
  [/remote_source/, "remote"],
  [/import|restore_export|rescan_history|upload_history/, "imports"],
  [/_run|run_/, "runs"],
  [/claude_config|codex_config|keybindings|profile/, "config"],
  [/pricing|cost/, "pricing"],
  [/push/, "push"],
  [/session|transcript/, "sessions"],
  [/agent/, "agents"],
  [/event|hook/, "events"],
  [/cleanup|reinstall|clear_all/, "maintenance"],
  [
    /health|stats|analytics|system_info|export_data|snapshot|metrics|update|agent_homes/,
    "observability",
  ],
];

/**
 * Domain a tool is listed under in the REPL, from its name.
 *
 * @param name - Tool name.
 * @returns The first matching domain, or `other`.
 */
export function toolDomain(name: string): string {
  return TOOL_DOMAIN_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? "other";
}

/** Color used for each domain's heading in the REPL tool listing. */
const DOMAIN_COLORS: Record<string, (t: string) => string> = {
  observability: c.brightCyan,
  sessions: c.brightGreen,
  agents: c.brightMagenta,
  events: c.brightYellow,
  pricing: (t: string) => c.bold(c.yellow(t)),
  maintenance: c.brightRed,
  workflows: c.brightBlue,
  alerts: c.brightYellow,
  webhooks: c.brightMagenta,
  remote: c.brightCyan,
  imports: c.brightGreen,
  runs: c.brightBlue,
  config: c.brightWhite,
  push: c.brightYellow,
};

/**
 * Renders a `[domain]` badge in that domain's color, or muted if unknown.
 *
 * @param domain - Domain name.
 * @returns The colored badge.
 */
function domainBadge(domain: string): string {
  const colorFn = DOMAIN_COLORS[domain] ?? c.muted;
  return colorFn(`[${domain}]`);
}

/**
 * Starts the interactive REPL and owns the process lifecycle from here —
 * `index.ts` returns immediately, since `readline`'s `"close"` event is this
 * transport's shutdown path. Unlike stdio/http, it never constructs an
 * `McpServer`: `tools` (from `collectAllTools`) is a flat, directly-
 * invokable handler list, so typing a tool name calls its handler
 * in-process, subject to the same `AppConfig` policy flags.
 *
 * @param config - Resolved MCP configuration.
 * @param api - Dashboard API client the tools use.
 * @param logger - Logger for errors.
 * @param tools - Every registered tool with its domain.
 * @returns A promise that resolves once the REPL has started.
 */
export async function startRepl(
  config: AppConfig,
  api: DashboardApiClient,
  logger: Logger,
  tools: ToolEntry[]
): Promise<void> {
  printBanner();
  printServerInfo({
    transport: "repl (interactive)",
    version: config.serverVersion,
    dashboard: config.dashboardBaseUrl.toString(),
    mutations: config.allowMutations,
    destructive: config.allowDestructive,
    tools: tools.length,
  });

  process.stdout.write(
    `  ${c.muted("Type")} ${c.accent("help")} ${c.muted("for commands,")} ${c.accent("tools")} ${c.muted("to list available tools,")} ${c.accent("exit")} ${c.muted("to quit.")}\n\n`
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  ${c.bold(c.brightCyan("mcp"))}${c.dim(c.cyan("›"))} `,
    completer: (line: string) => {
      const allCompletions = [
        ...tools.map((t) => t.name),
        "help",
        "tools",
        "domains",
        "exit",
        "quit",
        "clear",
        "health",
        "stats",
        "status",
        "config",
      ];
      const hits = allCompletions.filter((cmd) => cmd.startsWith(line.trim()));
      return [hits.length ? hits : allCompletions, line];
    },
  });

  const toolMap = new Map<string, ToolEntry>();
  for (const t of tools) toolMap.set(t.name, t);

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    try {
      await handleCommand(input, config, api, tools, toolMap, logger);
    } catch (err) {
      process.stdout.write(
        `  ${c.error("Error:")} ${err instanceof Error ? err.message : String(err)}\n`
      );
    }

    rl.prompt();
  });

  rl.on("close", () => {
    printShutdown();
    process.exit(0);
  });
}

/**
 * Dispatches one entered line to a built-in command, or to
 * {@link invokeToolByName} if it matches a known tool name. Built-ins always
 * take precedence. `health`/`stats`/`status` are shortcuts invoking
 * `dashboard_health_check`/`dashboard_get_stats`/
 * `dashboard_get_operational_snapshot` with no arguments.
 *
 * @param input - The line the user entered.
 * @param config - Resolved configuration, for the `config` command.
 * @param _api - Dashboard API client (unused here).
 * @param tools - Every registered tool.
 * @param toolMap - Tools by name, for invocation.
 * @param logger - Logger for errors.
 */
async function handleCommand(
  input: string,
  config: AppConfig,
  _api: DashboardApiClient,
  tools: ToolEntry[],
  toolMap: Map<string, ToolEntry>,
  logger: Logger
): Promise<void> {
  const [command, ...rest] = input.split(/\s+/);
  const argsRaw = rest.join(" ").trim();

  switch (command.toLowerCase()) {
    case "help":
      printHelp();
      return;

    case "tools":
      printToolList(tools, argsRaw || undefined);
      return;

    case "domains":
      printDomains(tools);
      return;

    case "health":
      await invokeToolByName("dashboard_health_check", {}, toolMap, logger);
      return;

    case "stats":
      await invokeToolByName("dashboard_get_stats", {}, toolMap, logger);
      return;

    case "status":
      await invokeToolByName("dashboard_get_operational_snapshot", {}, toolMap, logger);
      return;

    case "config":
      printConfig(config);
      return;

    case "clear":
      process.stdout.write("\x1b[2J\x1b[0;0H");
      return;

    case "exit":
    case "quit":
    case "q":
      printShutdown();
      process.exit(0);

    default:
      if (toolMap.has(command)) {
        const args = parseArgs(argsRaw);
        await invokeToolByName(command, args, toolMap, logger);
      } else {
        process.stdout.write(
          `  ${c.warn("?")} Unknown command: ${c.bold(c.brightWhite(command))} ${c.muted("— type 'help' for available commands")}\n`
        );
      }
  }
}

/** Invokes a tool handler by name directly (no MCP protocol), printing an
 * "Invoking..." line then the formatted result/error. This is the REPL's
 * own error boundary — a thrown error is caught/logged here, not converted
 * to a `CallToolResult`. Args pass through unvalidated (no Zod check).
 *
 * @param name - Tool name.
 * @param args - Arguments for the tool.
 * @param toolMap - Tools by name.
 * @param logger - Logger for errors.
 */
async function invokeToolByName(
  name: string,
  args: Record<string, unknown>,
  toolMap: Map<string, ToolEntry>,
  logger: Logger
): Promise<void> {
  const tool = toolMap.get(name);
  if (!tool) {
    process.stdout.write(`  ${c.error("✘")} Tool not found: ${c.bold(name)}\n`);
    return;
  }

  const domain = tool.domain;
  process.stdout.write(
    `  ${c.dim(c.cyan("⟳"))} ${c.muted("Invoking")} ${c.bold(c.brightWhite(name))} ${domainBadge(domain)}${Object.keys(args).length > 0 ? " " + c.muted(JSON.stringify(args)) : ""}\n`
  );

  const start = performance.now();
  try {
    const result = await tool.handler(args);
    const elapsed = Math.round(performance.now() - start);
    process.stdout.write(formatToolResult(name, result, elapsed) + "\n\n");
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("REPL tool invocation failed", { tool: name, error: msg });
    process.stdout.write(formatToolError(name, msg, elapsed) + "\n\n");
  }
}

/** Parses REPL tool args as a JSON object literal, or (if that fails)
 * space-separated `key=value` pairs with `true`/`false`/numeric coercion.
 * Not schema-aware. Empty input returns `{}`.
 *
 * @param raw - Text typed after the tool name.
 * @returns The arguments object.
 */
function parseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    // Try key=value pairs
    const args: Record<string, unknown> = {};
    const pairs = raw.match(/(\w+)=("(?:\\"|[^"])*"|\S+)/g);
    if (pairs) {
      for (const pair of pairs) {
        const eqIndex = pair.indexOf("=");
        const key = pair.slice(0, eqIndex);
        let value: unknown = pair.slice(eqIndex + 1);
        if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (!isNaN(Number(value)) && value !== "") value = Number(value);
        args[key] = value;
      }
    }
    return args;
  }
}

/** Prints the built-in command reference and example tool invocations. */
function printHelp(): void {
  process.stdout.write(sectionHeader("Available Commands"));

  const commands = [
    ["help", "Show this help message"],
    ["tools [domain]", "List tools (optionally filtered by domain)"],
    ["domains", "List all tool domains"],
    ["health", "Quick dashboard health check"],
    ["stats", "Dashboard overview statistics"],
    ["status", "Full operational snapshot"],
    ["config", "Show current configuration"],
    ["clear", "Clear the screen"],
    ["exit", "Quit the REPL"],
    ["<tool_name> [json]", "Invoke a tool with optional JSON args"],
    ["<tool_name> k=v ...", "Invoke a tool with key=value args"],
  ];

  const maxCmd = Math.max(...commands.map(([cmd]) => cmd.length));
  for (const [cmd, desc] of commands) {
    process.stdout.write(`    ${c.accent(cmd.padEnd(maxCmd + 2))} ${c.muted(desc)}\n`);
  }
  process.stdout.write("\n");

  process.stdout.write(sectionHeader("Examples"));
  process.stdout.write(`    ${c.green('dashboard_list_sessions {"limit": 5}')}\n`);
  process.stdout.write(`    ${c.green("dashboard_get_session session_id=abc123")}\n`);
  process.stdout.write(`    ${c.green("dashboard_list_agents status=working limit=10")}\n\n`);
}

/** Prints a table of tools (name, domain, truncated description) for
 * `tools`/`tools <domain>` (case-insensitive domain match).
 *
 * @param tools - Every registered tool.
 * @param domainFilter - Only list tools in this domain.
 */
function printToolList(tools: ToolEntry[], domainFilter?: string): void {
  const filtered = domainFilter
    ? tools.filter((t) => t.domain === domainFilter.toLowerCase())
    : tools;

  if (filtered.length === 0) {
    process.stdout.write(
      `  ${c.warn("!")} No tools found${domainFilter ? ` for domain '${domainFilter}'` : ""}\n`
    );
    return;
  }

  const title = domainFilter ? `Tools — ${domainFilter}` : `All Tools (${filtered.length})`;

  process.stdout.write(sectionHeader(title));

  const rows = filtered.map((t) => ({
    name: t.name,
    domain: t.domain,
    description: t.description.length > 50 ? t.description.slice(0, 47) + "..." : t.description,
  }));

  process.stdout.write(
    table(
      [
        { key: "name", label: "Tool", width: 38, color: c.brightWhite },
        {
          key: "domain",
          label: "Domain",
          width: 14,
          color: (t) => {
            const fn = DOMAIN_COLORS[t] ?? c.muted;
            return fn(t);
          },
        },
        { key: "description", label: "Description", width: 52, color: c.muted },
      ],
      rows
    ) + "\n\n"
  );
}

/**
 * Prints tool counts per domain (sorted) for the `domains` command.
 *
 * @param tools - Every registered tool.
 */
function printDomains(tools: ToolEntry[]): void {
  const domainCounts = new Map<string, number>();
  for (const t of tools) {
    domainCounts.set(t.domain, (domainCounts.get(t.domain) ?? 0) + 1);
  }

  process.stdout.write(sectionHeader("Tool Domains"));
  for (const [domain, count] of [...domainCounts.entries()].sort()) {
    const colorFn = DOMAIN_COLORS[domain] ?? c.muted;
    process.stdout.write(
      `    ${colorFn("●")} ${c.bold(c.brightWhite(domain.padEnd(18)))} ${c.muted(`${count} tools`)}\n`
    );
  }
  process.stdout.write(
    `\n  ${c.muted("Use")} ${c.accent("tools <domain>")} ${c.muted("to filter by domain.")}\n\n`
  );
}

/** Prints the resolved {@link AppConfig} for `config`, including the live
 * Mutations/Destructive policy state (warning color when enabled).
 *
 * @param config - Resolved configuration.
 */
function printConfig(config: AppConfig): void {
  process.stdout.write(sectionHeader("Configuration"));
  const pairs: [string, string][] = [
    ["Server Name", c.brightWhite(config.serverName)],
    ["Version", c.brightCyan(config.serverVersion)],
    ["Dashboard URL", c.green(config.dashboardBaseUrl.toString())],
    ["Transport", c.accent(config.transport.toUpperCase())],
    ["Timeout", c.muted(`${config.requestTimeoutMs}ms`)],
    ["Retries", c.muted(String(config.retryCount))],
    ["Retry Backoff", c.muted(`${config.retryBackoffMs}ms`)],
    ["Mutations", config.allowMutations ? c.warn("ENABLED") : badge("disabled")],
    ["Destructive", config.allowDestructive ? c.error("ENABLED") : badge("disabled")],
    ["Log Level", c.muted(config.logLevel)],
  ];

  for (const [k, v] of pairs) {
    process.stdout.write(`    ${c.label(k.padEnd(18))} ${v}\n`);
  }
  process.stdout.write("\n");
}

// ── Exported helper to collect tools from registration ────────

/** Registrar-shaped helper for building a domain-tagged {@link ToolEntry}
 * list directly. Not currently wired into REPL startup — `index.ts` instead
 * combines `collectAllTools` with its own copy of `TOOL_DOMAINS`. */
export interface ReplToolCollector {
  /** Tools registered so far. */
  tools: ToolEntry[];
  /** Registers a tool, tagging it with its domain. */
  register: (name: string, description: string, handler: ToolHandler) => void;
}

/** Constructs an empty {@link ReplToolCollector}, tagging each registered
 * tool with the inferred public domain. */
export function createReplToolCollector(): ReplToolCollector {
  const tools: ToolEntry[] = [];
  return {
    tools,
    register(name: string, description: string, handler: ToolHandler) {
      const domain = toolDomain(name);
      tools.push({ name, description, handler, domain });
    },
  };
}
