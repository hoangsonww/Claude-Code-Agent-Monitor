/**
 * @file push-tools.ts
 * @description MCP tools for the browser push-notification API, including
 * VAPID discovery, subscription management, and test notification delivery.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { z } from "zod";
import { registrarFor } from "../../core/tool-registry.js";
import { assertMutationsEnabled } from "../../policy/tool-guards.js";
import type { ToolContext } from "../../types/tool-context.js";

const PushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(8192),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(4096),
    auth: z.string().min(1).max(4096),
  }),
});

export function registerPushTools(context: ToolContext): void {
  const { api, config } = context;
  const register = registrarFor(context);

  register(
    "dashboard_get_push_public_key",
    "Get the dashboard VAPID public key used by browser push subscriptions.",
    {},
    async () => api.get("/api/push/vapid-public-key")
  );

  register(
    "dashboard_subscribe_push",
    "Register a browser PushSubscription object with the dashboard.",
    { subscription: PushSubscriptionSchema },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/push/subscribe", { body: args.subscription });
    }
  );

  register(
    "dashboard_unsubscribe_push",
    "Remove a browser push subscription by endpoint.",
    { endpoint: z.string().url().max(8192) },
    async (args) => {
      assertMutationsEnabled(config);
      return api.delete("/api/push/subscribe", { body: { endpoint: args.endpoint } });
    }
  );

  register(
    "dashboard_send_push_notification",
    "Send one browser push notification to registered subscriptions. This has an external side effect.",
    {
      title: z.string().min(1).max(256),
      body: z.string().min(1).max(4096),
    },
    async (args) => {
      assertMutationsEnabled(config);
      return api.post("/api/push/send", { body: args });
    }
  );
}
