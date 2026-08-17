/**
 * @file alert-tools.ts
 * @description MCP tools for fired-alert inspection, acknowledgment, and
 * alert-rule lifecycle management through the dashboard alerting API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import { JsonObjectSchema } from "../schemas.js";
import type { ToolContext } from "../../types/tool-context.js";

const AlertRuleTypeSchema = z.enum([
  "token_threshold",
  "event_pattern",
  "inactivity",
  "status_duration",
]);

export function registerAlertTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_list_alerts",
    "List fired alerts, optionally restricted to unacknowledged events.",
    {
      unacked: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).max(100_000).optional(),
    },
    async (args) =>
      api.get("/api/alerts", {
        query: {
          unacked: args.unacked as boolean | undefined,
          limit: (args.limit as number | undefined) ?? 50,
          offset: (args.offset as number | undefined) ?? 0,
        },
      })
  );

  register("dashboard_list_alert_rules", "List configured alert rules.", {}, async () =>
    api.get("/api/alerts/rules")
  );

  register(
    "dashboard_acknowledge_alert",
    "Acknowledge one fired alert event.",
    { alert_id: z.number().int().positive() },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post(`/api/alerts/${args.alert_id as number}/ack`);
    }
  );

  register(
    "dashboard_acknowledge_all_alerts",
    "Acknowledge every currently unacknowledged alert event.",
    {},
    async () => {
      assertMutationsEnabled(config);
      return api.post("/api/alerts/ack-all");
    }
  );

  register(
    "dashboard_create_alert_rule",
    "Create an alert rule for token thresholds, event patterns, inactivity, or status duration.",
    {
      name: z.string().min(1).max(256),
      rule_type: AlertRuleTypeSchema,
      rule_config: JsonObjectSchema,
      enabled: z.boolean().optional(),
      cooldown_seconds: z.number().int().min(0).max(31_536_000).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/alerts/rules", {
        body: {
          name: args.name,
          rule_type: args.rule_type,
          config: args.rule_config,
          enabled: args.enabled,
          cooldown_seconds: args.cooldown_seconds,
        },
      });
    }
  );

  register(
    "dashboard_update_alert_rule",
    "Update one alert rule. Its rule type is immutable.",
    {
      rule_id: z.string().min(1).max(256),
      name: z.string().min(1).max(256).optional(),
      rule_config: JsonObjectSchema.optional(),
      enabled: z.boolean().optional(),
      cooldown_seconds: z.number().int().min(0).max(31_536_000).optional(),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.patch(`/api/alerts/rules/${encodeURIComponent(args.rule_id as string)}`, {
        body: {
          name: args.name,
          config: args.rule_config,
          enabled: args.enabled,
          cooldown_seconds: args.cooldown_seconds,
        },
      });
    }
  );

  register(
    "dashboard_delete_alert_rule",
    "Delete one alert rule and its fired-alert history.",
    { rule_id: z.string().min(1).max(256) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete(`/api/alerts/rules/${encodeURIComponent(args.rule_id as string)}`);
    }
  );
}
