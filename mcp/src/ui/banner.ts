/**
 * @file StatCard.tsx
 * @description A reusable React component that displays a statistic with a label, value, icon, and optional trend information. It is designed to be used in dashboards or analytics pages to present key metrics in a visually appealing way. The component also supports showing raw values as tooltips on hover for more detailed information.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import * as c from "./colors.js";

const BANNER = `
$$\\      $$\\  $$$$$$\\  $$$$$$$\\        $$$$$$$$\\                  $$\\           
$$$\\    $$$ |$$  __$$\\ $$  __$$\\       \\__$$  __|                 $$ |          
$$$$\\  $$$$ |$$ /  \\__|$$ |  $$ |         $$ | $$$$$$\\   $$$$$$\\  $$ | $$$$$$$\\ 
$$\\$$\\$$ $$ |$$ |      $$$$$$$  |         $$ |$$  __$$\\ $$  __$$\\ $$ |$$  _____|
$$ \\$$$  $$ |$$ |      $$  ____/          $$ |$$ /  $$ |$$ /  $$ |$$ |\\$$$$$$\\  
$$ |\\$  /$$ |$$ |  $$\\ $$ |               $$ |$$ |  $$ |$$ |  $$ |$$ | \\____$$\\ 
$$ | \\_/ $$ |\\$$$$$$  |$$ |               $$ |\\$$$$$$  |\\$$$$$$  |$$ |$$$$$$$  |
\\__|     \\__| \\______/ \\__|               \\__| \\______/  \\______/ \\__|\\_______/ `;

export function printBanner(): void {
  const gradient = [c.brightCyan, c.cyan, c.brightBlue, c.blue, c.brightMagenta, c.magenta];
  const lines = BANNER.split("\n").filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const colorFn = gradient[Math.min(i, gradient.length - 1)];
    process.stdout.write(colorFn(lines[i]) + "\n");
  }
  process.stdout.write("\n");
}

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

export function printReady(transport: string): void {
  const icon = "✔";
  process.stdout.write(
    `  ${c.success(icon)} ${c.bold(c.brightWhite("Server ready"))} ${c.muted(`(${transport})`)}\n\n`
  );
}

export function printShutdown(): void {
  process.stdout.write(`\n  ${c.warn("⏻")} ${c.bold(c.brightWhite("Shutting down…"))}\n`);
}
