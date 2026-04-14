/**
 * @file repl.ts
 * @description Implements a REPL (Read-Eval-Print Loop) transport for the MCP server, allowing users to interact with the dashboard API and invoke registered tools directly from the command line. The REPL provides an interactive prompt with command history and tab completion for tool names and commands. It supports built-in commands for listing tools, showing configuration, and performing health checks, as well as invoking any registered tool with JSON or key=value arguments. The REPL is designed for ease of use and quick experimentation during development or debugging sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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

interface ToolEntry {
  name: string;
  description: string;
  handler: ToolHandler;
  domain: string;
}

const TOOL_DOMAINS: Record<string, string> = {
  dashboard_health_check: "observability",
  dashboard_get_stats: "observability",
  dashboard_get_analytics: "observability",
  dashboard_get_system_info: "observability",
  dashboard_export_data: "observability",
  dashboard_get_operational_snapshot: "observability",
  dashboard_list_sessions: "sessions",
  dashboard_get_session: "sessions",
  dashboard_create_session: "sessions",
  dashboard_update_session: "sessions",
  dashboard_list_agents: "agents",
  dashboard_get_agent: "agents",
  dashboard_create_agent: "agents",
  dashboard_update_agent: "agents",
  dashboard_list_events: "events",
  dashboard_ingest_hook_event: "events",
  dashboard_get_pricing_rules: "pricing",
  dashboard_get_total_cost: "pricing",
  dashboard_get_session_cost: "pricing",
  dashboard_upsert_pricing_rule: "pricing",
  dashboard_delete_pricing_rule: "pricing",
  dashboard_reset_pricing_defaults: "pricing",
  dashboard_cleanup_data: "maintenance",
  dashboard_reimport_history: "maintenance",
  dashboard_reinstall_hooks: "maintenance",
  dashboard_clear_all_data: "maintenance",
};

const DOMAIN_COLORS: Record<string, (t: string) => string> = {
  observability: c.brightCyan,
  sessions: c.brightGreen,
  agents: c.brightMagenta,
  events: c.brightYellow,
  pricing: (t: string) => c.bold(c.yellow(t)),
  maintenance: c.brightRed,
};

function domainBadge(domain: string): string {
  const colorFn = DOMAIN_COLORS[domain] ?? c.muted;
  return colorFn(`[${domain}]`);
}

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

export interface ReplToolCollector {
  tools: ToolEntry[];
  register: (name: string, description: string, handler: ToolHandler) => void;
}

export function createReplToolCollector(): ReplToolCollector {
  const tools: ToolEntry[] = [];
  return {
    tools,
    register(name: string, description: string, handler: ToolHandler) {
      const domain = TOOL_DOMAINS[name] ?? "unknown";
      tools.push({ name, description, handler, domain });
    },
  };
}
