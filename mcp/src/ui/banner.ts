/**
 * @file banner.ts
 * @description Console startup UI for the MCP server's non-stdio transports (HTTP and REPL):
 * the ASCII-art wordmark, a boxed server-info panel (version, transport, dashboard URL, port,
 * tool count, mutation/destructive policy state), a "ready" line, and a shutdown message. The
 * stdio transport never calls any of these, since stdout there is the MCP JSON-RPC channel.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
 * reminder that the dashboard must already be running at the printed URL. */
export function printServerInfo(info: {
  transport: string;
  version: string;
  dashboard: string;
  port?: number;
  mutations: boolean;
  destructive: boolean;
  tools: number;
}): void {
  const divider = c.dim(c.cyan("─".repeat(62)));
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
 * used by the REPL transport. */
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
