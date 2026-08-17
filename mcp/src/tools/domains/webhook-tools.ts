/**
 * @file webhook-tools.ts
 * @description MCP tools for provider discovery, redacted webhook target
 * management, test delivery, and delivery-log inspection.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

const WebhookTypeSchema = z.enum([
  "slack",
  "discord",
  "teams",
  "google_chat",
  "mattermost",
  "rocketchat",
  "telegram",
  "pagerduty",
  "opsgenie",
  "splunk_oncall",
  "zapier",
  "make",
  "n8n",
  "pipedream",
  "generic",
]);

const StringMapSchema = z.record(z.string());

export function registerWebhookTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_list_webhook_providers",
    "List supported webhook providers and their public configuration fields.",
    {},
    async () => api.get("/api/webhooks/providers")
  );
  register(
    "dashboard_list_webhooks",
    "List configured webhook targets with secrets redacted.",
    {},
    async () => api.get("/api/webhooks")
  );

  register(
    "dashboard_list_webhook_deliveries",
    "List recent delivery attempts for one webhook target.",
    {
      webhook_id: z.string().min(1).max(256),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
    },
    async (args) =>
      api.get(`/api/webhooks/${encodeURIComponent(args.webhook_id as string)}/deliveries`, {
        query: {
          limit: (args.limit as number | undefined) ?? 20,
          offset: (args.offset as number | undefined) ?? 0,
        },
      })
  );

  register(
    "dashboard_create_webhook",
    "Create a webhook target. Provider secrets are accepted only by the dashboard and never returned.",
    {
      name: z.string().min(1).max(256),
      type: WebhookTypeSchema,
      url: z.string().url().optional(),
      enabled: z.boolean().optional(),
      secret: z.string().max(8192).optional(),
      headers: StringMapSchema.optional(),
      rule_ids: z.array(z.string().min(1).max(256)).max(500).optional(),
      webhook_config: JsonObjectSchema.optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/webhooks", {
        body: {
          name: args.name,
          type: args.type,
          url: args.url,
          enabled: args.enabled,
          secret: args.secret,
          headers: args.headers,
          rule_ids: args.rule_ids,
          config: args.webhook_config,
        },
      });
    }
  );

  register(
    "dashboard_update_webhook",
    "Update one webhook target. Omitted secret-bearing fields remain unchanged.",
    {
      webhook_id: z.string().min(1).max(256),
      name: z.string().min(1).max(256).optional(),
      url: z.string().url().optional(),
      enabled: z.boolean().optional(),
      secret: z.string().max(8192).nullable().optional(),
      headers: StringMapSchema.nullable().optional(),
      rule_ids: z.array(z.string().min(1).max(256)).max(500).nullable().optional(),
      webhook_config: JsonObjectSchema.nullable().optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.patch(`/api/webhooks/${encodeURIComponent(args.webhook_id as string)}`, {
        body: {
          name: args.name,
          url: args.url,
          enabled: args.enabled,
          secret: args.secret,
          headers: args.headers,
          rule_ids: args.rule_ids,
          config: args.webhook_config,
        },
      });
    }
  );

  register(
    "dashboard_delete_webhook",
    "Delete one webhook target and its delivery history.",
    { webhook_id: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/webhooks/${encodeURIComponent(args.webhook_id as string)}`);
    }
  );

  register(
    "dashboard_test_webhook",
    "Send one synthetic alert to a configured webhook target. This has an external side effect.",
    { webhook_id: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post(`/api/webhooks/${encodeURIComponent(args.webhook_id as string)}/test`);
    }
  );
}
