export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type PermissionMode = "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";
export type SettingSource = "user" | "project" | "local";
export type OutputFormat = "text" | "json" | "stream-json";
export type InputFormat = "text" | "stream-json";

export interface AgentDef {
  description: string;
  prompt: string;
  tools?: string[];
}

export interface ProfileConfig {
  model?: string;
  fallbackModel?: string;
  effort?: Effort;
  betas?: string[];
  permissionMode?: PermissionMode;
  tools?: string[];
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  systemPromptFile?: string;
  appendSystemPrompt?: string;
  appendSystemPromptFile?: string;
  addDir?: string[];
  mcpConfig?: string[];
  strictMcpConfig?: boolean;
  pluginDir?: string[];
  settings?: string;
  settingSources?: SettingSource[];
  agent?: string;
  agents?: Record<string, AgentDef>;
  outputFormat?: OutputFormat;
  inputFormat?: InputFormat;
  includeHookEvents?: boolean;
  includePartialMessages?: boolean;
  jsonSchema?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  verbose?: boolean;
  debug?: string;
  channels?: string[];
  excludeDynamicSystemPromptSections?: boolean;
  envVarNames?: string[];
  bare?: boolean;
  dangerouslySkipPermissions?: boolean;
  allowDangerouslySkipPermissions?: boolean;
  dangerouslyLoadDevelopmentChannels?: string[];
}

export interface PerLaunch {
  prompt: string;
  cwd?: string;
  resumeSessionId?: string;
  forkSession?: boolean;
  continue?: boolean;
  sessionId?: string;
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  config: ProfileConfig;
  defaultCwd?: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
}
