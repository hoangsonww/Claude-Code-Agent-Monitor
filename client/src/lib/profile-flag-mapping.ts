import type { ProfileConfig, PerLaunch } from "./profile-types";

type Shape = "scalar" | "comma" | "repeat" | "boolean" | "json" | "number";
interface FlagSpec {
  flag: string;
  shape: Shape;
  dangerous?: boolean;
}

export const FLAG_TABLE: Record<string, FlagSpec> = {
  model: { flag: "--model", shape: "scalar" },
  fallbackModel: { flag: "--fallback-model", shape: "scalar" },
  effort: { flag: "--effort", shape: "scalar" },
  betas: { flag: "--betas", shape: "comma" },
  permissionMode: { flag: "--permission-mode", shape: "scalar" },
  tools: { flag: "--tools", shape: "comma" },
  allowedTools: { flag: "--allowedTools", shape: "comma" },
  disallowedTools: { flag: "--disallowedTools", shape: "comma" },
  systemPrompt: { flag: "--system-prompt", shape: "scalar" },
  systemPromptFile: { flag: "--system-prompt-file", shape: "scalar" },
  appendSystemPrompt: { flag: "--append-system-prompt", shape: "scalar" },
  appendSystemPromptFile: { flag: "--append-system-prompt-file", shape: "scalar" },
  addDir: { flag: "--add-dir", shape: "repeat" },
  mcpConfig: { flag: "--mcp-config", shape: "repeat" },
  strictMcpConfig: { flag: "--strict-mcp-config", shape: "boolean" },
  pluginDir: { flag: "--plugin-dir", shape: "repeat" },
  settings: { flag: "--settings", shape: "scalar" },
  settingSources: { flag: "--setting-sources", shape: "comma" },
  agent: { flag: "--agent", shape: "scalar" },
  agents: { flag: "--agents", shape: "json" },
  outputFormat: { flag: "--output-format", shape: "scalar" },
  inputFormat: { flag: "--input-format", shape: "scalar" },
  includeHookEvents: { flag: "--include-hook-events", shape: "boolean" },
  includePartialMessages: { flag: "--include-partial-messages", shape: "boolean" },
  jsonSchema: { flag: "--json-schema", shape: "scalar" },
  maxTurns: { flag: "--max-turns", shape: "number" },
  maxBudgetUsd: { flag: "--max-budget-usd", shape: "number" },
  verbose: { flag: "--verbose", shape: "boolean" },
  debug: { flag: "--debug", shape: "scalar" },
  channels: { flag: "--channels", shape: "comma" },
  excludeDynamicSystemPromptSections: { flag: "--exclude-dynamic-system-prompt-sections", shape: "boolean" },
  bare: { flag: "--bare", shape: "boolean", dangerous: true },
  dangerouslySkipPermissions: { flag: "--dangerously-skip-permissions", shape: "boolean", dangerous: true },
  allowDangerouslySkipPermissions: { flag: "--allow-dangerously-skip-permissions", shape: "boolean", dangerous: true },
  dangerouslyLoadDevelopmentChannels: { flag: "--dangerously-load-development-channels", shape: "comma", dangerous: true },
};

export function buildArgvPreview(
  cfg: ProfileConfig,
  perLaunch: PerLaunch,
  opts: { redactPrompt?: boolean } = {},
): string[] {
  const argv: string[] = ["claude"];
  argv.push("-p", opts.redactPrompt ? "<prompt>" : perLaunch.prompt);
  argv.push("--input-format", "stream-json");
  argv.push("--output-format", "stream-json");
  argv.push("--verbose");
  argv.push("--permission-mode", cfg.permissionMode || "acceptEdits");

  for (const [key, spec] of Object.entries(FLAG_TABLE)) {
    if (key === "permissionMode" || key === "outputFormat" || key === "inputFormat" || key === "verbose") continue;
    const v = (cfg as Record<string, unknown>)[key];
    if (v == null) continue;
    switch (spec.shape) {
      case "scalar":
      case "number":
        argv.push(spec.flag, String(v));
        break;
      case "boolean":
        if (v === true) argv.push(spec.flag);
        break;
      case "comma":
        if (Array.isArray(v) && v.length) argv.push(spec.flag, v.join(","));
        break;
      case "repeat":
        if (Array.isArray(v)) for (const item of v) argv.push(spec.flag, String(item));
        break;
      case "json":
        argv.push(spec.flag, JSON.stringify(v));
        break;
    }
  }
  if (perLaunch.continue) argv.push("--continue");
  if (perLaunch.resumeSessionId) argv.push("--resume", perLaunch.resumeSessionId);
  if (perLaunch.forkSession) argv.push("--fork-session");
  if (perLaunch.sessionId) argv.push("--session-id", perLaunch.sessionId);
  return argv;
}
