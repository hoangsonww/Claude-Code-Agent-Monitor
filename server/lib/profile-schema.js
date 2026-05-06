/**
 * @file Single source of truth for the launcher's flag mapping. The flagTable
 * declares each ProfileConfig key, its CLI flag, its emit shape, and validation
 * rules. Both validateProfileConfig and buildArgsFromConfig consume it.
 */

const PERMISSION_MODES = ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"];
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
const OUTPUT_FORMATS = ["text", "json", "stream-json"];
const INPUT_FORMATS = ["text", "stream-json"];
const SETTING_SOURCES = ["user", "project", "local"];

const flagTable = {
  model: { flag: "--model", shape: "scalar" },
  fallbackModel: { flag: "--fallback-model", shape: "scalar" },
  effort: { flag: "--effort", shape: "scalar", enum: EFFORTS },
  betas: { flag: "--betas", shape: "comma" },
  permissionMode: { flag: "--permission-mode", shape: "scalar", enum: PERMISSION_MODES },
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
  settingSources: { flag: "--setting-sources", shape: "comma", enum: SETTING_SOURCES },
  agent: { flag: "--agent", shape: "scalar" },
  agents: { flag: "--agents", shape: "json" },
  outputFormat: { flag: "--output-format", shape: "scalar", enum: OUTPUT_FORMATS },
  inputFormat: { flag: "--input-format", shape: "scalar", enum: INPUT_FORMATS },
  includeHookEvents: { flag: "--include-hook-events", shape: "boolean" },
  includePartialMessages: { flag: "--include-partial-messages", shape: "boolean" },
  jsonSchema: { flag: "--json-schema", shape: "scalar" },
  maxTurns: { flag: "--max-turns", shape: "number", min: 1, max: 10000 },
  maxBudgetUsd: { flag: "--max-budget-usd", shape: "number", min: 0, max: 10000 },
  verbose: { flag: "--verbose", shape: "boolean" },
  debug: { flag: "--debug", shape: "scalar" },
  channels: { flag: "--channels", shape: "comma" },
  excludeDynamicSystemPromptSections: { flag: "--exclude-dynamic-system-prompt-sections", shape: "boolean" },
  bare: { flag: "--bare", shape: "boolean", dangerous: true },
  dangerouslySkipPermissions: { flag: "--dangerously-skip-permissions", shape: "boolean", dangerous: true },
  allowDangerouslySkipPermissions: { flag: "--allow-dangerously-skip-permissions", shape: "boolean", dangerous: true },
  dangerouslyLoadDevelopmentChannels: { flag: "--dangerously-load-development-channels", shape: "comma", dangerous: true },
};

const MUTEX = [["systemPrompt", "systemPromptFile"]];

function validateProfileConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) {
    return { ok: false, errors: ["config must be an object"] };
  }
  for (const key of Object.keys(cfg)) {
    if (key === "envVarNames") continue;
    const spec = flagTable[key];
    if (!spec) {
      errors.push(`unknown key: ${key}`);
      continue;
    }
    const v = cfg[key];
    switch (spec.shape) {
      case "scalar":
        if (typeof v !== "string") errors.push(`${key} must be a string`);
        else if (spec.enum && !spec.enum.includes(v)) errors.push(`${key} must be one of ${spec.enum.join(",")}`);
        break;
      case "boolean":
        if (typeof v !== "boolean") errors.push(`${key} must be a boolean`);
        break;
      case "number":
        if (typeof v !== "number" || Number.isNaN(v)) errors.push(`${key} must be a number`);
        else if (spec.min != null && v < spec.min) errors.push(`${key} must be >= ${spec.min}`);
        else if (spec.max != null && v > spec.max) errors.push(`${key} must be <= ${spec.max}`);
        break;
      case "comma":
      case "repeat":
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
          errors.push(`${key} must be string[]`);
        } else if (spec.enum && v.some((x) => !spec.enum.includes(x))) {
          errors.push(`${key} entries must be one of ${spec.enum.join(",")}`);
        }
        break;
      case "json":
        if (v == null || typeof v !== "object") errors.push(`${key} must be an object`);
        break;
    }
  }
  if (cfg.envVarNames !== undefined && !Array.isArray(cfg.envVarNames)) {
    errors.push("envVarNames must be string[]");
  }
  for (const [a, b] of MUTEX) {
    if (cfg[a] != null && cfg[b] != null) errors.push(`${a} and ${b} are mutually exclusive`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

function buildArgsFromConfig(cfg = {}, perLaunch = {}) {
  const argv = ["-p", String(perLaunch.prompt ?? "")];
  argv.push("--input-format", "stream-json");
  argv.push("--output-format", "stream-json");
  argv.push("--verbose");
  argv.push("--permission-mode", cfg.permissionMode || "acceptEdits");

  for (const [key, spec] of Object.entries(flagTable)) {
    if (key === "permissionMode" || key === "outputFormat" || key === "inputFormat" || key === "verbose") continue;
    if (!(key in cfg) || cfg[key] == null) continue;
    const v = cfg[key];
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
        if (Array.isArray(v)) for (const item of v) argv.push(spec.flag, item);
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

module.exports = {
  flagTable,
  validateProfileConfig,
  buildArgsFromConfig,
  PERMISSION_MODES, EFFORTS, OUTPUT_FORMATS, INPUT_FORMATS, SETTING_SOURCES,
};
