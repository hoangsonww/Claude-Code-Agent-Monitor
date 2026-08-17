/**
 * @file run-tools.ts
 * @description MCP tools for inspecting and controlling dashboard-launched
 * Claude Code and Codex processes, including model and file discovery.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

const ProviderSchema = z.enum(["claude", "codex"]);

export function registerRunTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_list_runs",
    "List live dashboard-launched Claude Code and Codex runs.",
    {},
    async () => api.get("/api/run")
  );
  register(
    "dashboard_list_run_history",
    "List persisted dashboard-run history.",
    { limit: z.number().int().min(1).max(500).optional() },
    async (args) =>
      api.get("/api/run/history", { query: { limit: (args.limit as number | undefined) ?? 50 } })
  );
  register(
    "dashboard_list_run_directories",
    "List valid working-directory suggestions for agent runs.",
    {},
    async () => api.get("/api/run/cwds")
  );
  register(
    "dashboard_list_run_files",
    "List prompt-reference file suggestions inside an allowed working directory.",
    {
      cwd: z.string().min(1).max(4096),
      query: z.string().max(512).optional(),
    },
    async (args) =>
      api.get("/api/run/files", {
        query: { cwd: args.cwd as string, q: args.query as string | undefined },
      })
  );
  register(
    "dashboard_get_run_binary",
    "Check whether the selected Claude Code or Codex binary is available on the dashboard host.",
    { provider: ProviderSchema.optional() },
    async (args) =>
      api.get("/api/run/binary", {
        query: { provider: (args.provider as string | undefined) ?? "claude" },
      })
  );
  register(
    "dashboard_list_run_models",
    "List selectable models for a dashboard-launched Claude Code or Codex run.",
    { provider: ProviderSchema },
    async (args) => api.get("/api/run/models", { query: { provider: args.provider as string } })
  );
  register(
    "dashboard_get_run",
    "Get one live run handle and optionally include its in-memory event envelopes.",
    {
      run_id: z.string().min(1).max(256),
      include_envelopes: z.boolean().optional(),
    },
    async (args) =>
      api.get(`/api/run/${encodeURIComponent(args.run_id as string)}`, {
        query: { envelopes: args.include_envelopes ? 1 : undefined },
      })
  );

  register(
    "dashboard_start_run",
    "Start a Claude Code or Codex agent process through the dashboard Run API.",
    {
      provider: ProviderSchema.optional(),
      prompt: z.string().max(200_000).optional(),
      mode: z.enum(["conversation", "headless"]).optional(),
      cwd: z.string().min(1).max(4096),
      model: z.string().max(256).optional(),
      permission_mode: z.string().max(64).optional(),
      resume_session_id: z.string().max(256).optional(),
      effort: z.string().max(64).optional(),
      sandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/run", {
        body: {
          provider: args.provider,
          prompt: args.prompt,
          mode: args.mode,
          cwd: args.cwd,
          model: args.model,
          permissionMode: args.permission_mode,
          resumeSessionId: args.resume_session_id,
          effort: args.effort,
          sandbox: args.sandbox,
        },
      });
    }
  );

  register(
    "dashboard_send_run_message",
    "Send a follow-up message to one live dashboard run.",
    {
      run_id: z.string().min(1).max(256),
      text: z.string().min(1).max(200_000),
      provider: ProviderSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      const handle =
        args.provider === undefined
          ? ((await api.get(`/api/run/${encodeURIComponent(args.run_id as string)}`)) as {
              provider?: string;
            })
          : null;
      return api.post(`/api/run/${encodeURIComponent(args.run_id as string)}/message`, {
        body: {
          text: args.text,
          provider: args.provider ?? handle?.provider ?? "claude",
        },
      });
    }
  );

  register(
    "dashboard_stop_run",
    "Stop one live dashboard-launched agent process.",
    { run_id: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/run/${encodeURIComponent(args.run_id as string)}`);
    }
  );
}
