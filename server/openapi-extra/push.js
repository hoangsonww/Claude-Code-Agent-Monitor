/**
 * @file Supplementary OpenAPI 3.0 fragments for the Web Push routes mounted at
 * `/api/push` (see server/routes/push.js + server/lib/push.js). Exports
 * `{ tags, schemas, paths }` for merging into the base spec by
 * `createOpenApiSpec()` via server/openapi-extra.js. Schemas are prefixed
 * `Push` to avoid collisions with the base component schemas. Error responses
 * reuse the base `MessageErrorResponse` schema (`{ error: { message } }`),
 * which is the short shape these routes actually emit.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const tags = [
  {
    name: "Push",
    description:
      "Web Push notification subscriptions and broadcast (VAPID); also fires native Electron notifications when hosted in the desktop app",
  },
];

const schemas = {
  PushVapidKeyResponse: {
    type: "object",
    required: ["publicKey"],
    description:
      "The server's VAPID public key. The browser passes this base64url-encoded key to `PushManager.subscribe({ applicationServerKey })` so the push service will accept deliveries signed by this server's private key.",
    properties: {
      publicKey: {
        type: "string",
        description:
          "Base64url-encoded VAPID (P-256 ECDSA) public application server key. Generated once and persisted alongside the SQLite DB so the web app and native apps share one key pair.",
        example:
          "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8",
      },
    },
  },

  PushSubscriptionKeys: {
    type: "object",
    required: ["p256dh", "auth"],
    description:
      "Client encryption keys produced by the browser's PushManager subscription. Both are required to encrypt Web Push payloads for the endpoint.",
    properties: {
      p256dh: {
        type: "string",
        description:
          "Base64url-encoded P-256 ECDH public key from the browser subscription (`subscription.getKey('p256dh')`). Stored verbatim in the `push_subscriptions` table.",
        example:
          "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
      },
      auth: {
        type: "string",
        description:
          "Base64url-encoded auth secret from the browser subscription (`subscription.getKey('auth')`). Stored verbatim in the `push_subscriptions` table.",
        example: "tBHItJI5svbpez7KI4CCXg",
      },
    },
  },

  PushSubscribeRequest: {
    type: "object",
    required: ["endpoint", "keys"],
    description:
      "A browser PushSubscription serialized for storage. Persisted via `INSERT OR REPLACE` keyed on `endpoint`, so re-subscribing the same endpoint is idempotent (it overwrites the stored keys rather than duplicating the row).",
    properties: {
      endpoint: {
        type: "string",
        format: "uri",
        description:
          "The push service delivery URL from `subscription.endpoint`. Acts as the primary key in `push_subscriptions`; sending later POSTs encrypted payloads here. Subscriptions that return HTTP 410 (Gone) during `/send` are pruned automatically.",
        example: "https://fcm.googleapis.com/fcm/send/dGhpcy1pcy1hLWZha2UtZW5kcG9pbnQ",
      },
      keys: { $ref: "#/components/schemas/PushSubscriptionKeys" },
    },
  },

  PushSubscribeResponse: {
    type: "object",
    required: ["ok"],
    description: "Confirmation that the subscription was stored (or overwritten).",
    properties: {
      ok: {
        type: "boolean",
        enum: [true],
        description: "Always `true` on success.",
        example: true,
      },
    },
  },

  PushUnsubscribeRequest: {
    type: "object",
    required: ["endpoint"],
    description:
      "Identifies the subscription to delete by its push-service endpoint. NOTE: the endpoint is supplied in the request BODY (DELETE with a JSON body), not as a query parameter.",
    properties: {
      endpoint: {
        type: "string",
        format: "uri",
        description:
          "The `endpoint` of the subscription to remove from `push_subscriptions`. Deletion is idempotent — removing an endpoint that is not stored still returns `{ ok: true }`.",
        example: "https://fcm.googleapis.com/fcm/send/dGhpcy1pcy1hLWZha2UtZW5kcG9pbnQ",
      },
    },
  },

  PushOkResponse: {
    type: "object",
    required: ["ok"],
    description: "Generic success acknowledgement returned by subscribe/unsubscribe.",
    properties: {
      ok: {
        type: "boolean",
        enum: [true],
        description: "Always `true` on success.",
        example: true,
      },
    },
  },

  PushSendRequest: {
    type: "object",
    required: ["title", "body"],
    description:
      "Notification content to broadcast. Both fields are mandatory; a missing title or body yields a 400. The same title/body is delivered to every reachable surface (native Electron notification + all stored Web Push subscriptions).",
    properties: {
      title: {
        type: "string",
        description: "Notification title line.",
        example: "Session completed",
      },
      body: {
        type: "string",
        description: "Notification body text.",
        example: "Your Claude Code session finished with 3 subagents.",
      },
    },
  },

  PushSendResponse: {
    type: "object",
    required: ["ok", "native", "pushed", "failed"],
    description:
      "Reports which delivery surfaces actually fired. This lets the client distinguish a real delivery from a silent no-op (no subscribers AND no Electron host), which would otherwise look like success.",
    properties: {
      ok: {
        type: "boolean",
        enum: [true],
        description: "Always `true` when dispatch ran without throwing.",
        example: true,
      },
      native: {
        type: "boolean",
        description:
          "`true` when a native OS notification was shown via Electron's main-process Notification API (i.e. the server is hosted inside the desktop app and notifications are supported). `false` under a plain `npm start` host.",
        example: false,
      },
      pushed: {
        type: "integer",
        minimum: 0,
        description:
          "Count of stored Web Push subscriptions that accepted the encrypted payload (fulfilled `web-push` sends).",
        example: 2,
      },
      failed: {
        type: "integer",
        minimum: 0,
        description:
          "Count of Web Push sends that were rejected. Subscriptions rejected with HTTP 410 (Gone) are deleted from `push_subscriptions` as part of this request.",
        example: 1,
      },
    },
  },
};

const paths = {
  "/api/push/vapid-public-key": {
    get: {
      tags: ["Push"],
      summary: "Get the VAPID public key",
      description:
        "Returns the server's VAPID public application server key so a browser can register a Web Push subscription via `PushManager.subscribe({ applicationServerKey })`. The key pair is generated once and persisted in the shared data directory alongside the SQLite DB, so the web app and native apps reuse a single key pair across restarts. No authentication — this is a local-first dashboard. Safe to call repeatedly; always returns the same key.",
      operationId: "pushVapidPublicKey",
      responses: {
        200: {
          description: "The VAPID public key",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PushVapidKeyResponse" },
              example: {
                publicKey:
                  "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8",
              },
            },
          },
        },
      },
    },
  },

  "/api/push/subscribe": {
    post: {
      tags: ["Push"],
      summary: "Register a Web Push subscription",
      description:
        "Stores a browser PushSubscription so future `/api/push/send` broadcasts reach this endpoint. Persisted with `INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)`, keyed on `endpoint` — so the operation is idempotent: re-subscribing the same endpoint overwrites its keys instead of creating a duplicate. No authentication (local-first). Requires `endpoint`, `keys.p256dh`, and `keys.auth`; any missing field returns 400.",
      operationId: "pushSubscribe",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PushSubscribeRequest" },
            example: {
              endpoint: "https://fcm.googleapis.com/fcm/send/dGhpcy1pcy1hLWZha2UtZW5kcG9pbnQ",
              keys: {
                p256dh:
                  "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
                auth: "tBHItJI5svbpez7KI4CCXg",
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Subscription stored (created or overwritten)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PushSubscribeResponse" },
              example: { ok: true },
            },
          },
        },
        400: {
          description:
            "Missing required fields (one of `endpoint`, `keys.p256dh`, `keys.auth` was absent)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "Missing required fields" } },
            },
          },
        },
      },
    },
    delete: {
      tags: ["Push"],
      summary: "Remove a Web Push subscription",
      description:
        "Deletes a stored subscription so it stops receiving broadcasts. The endpoint identifier is supplied in the request BODY (a DELETE with a JSON body), NOT as a query parameter. Idempotent — deleting an endpoint that is not stored still returns `{ ok: true }`. No authentication (local-first). A missing `endpoint` returns 400.",
      operationId: "pushUnsubscribe",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PushUnsubscribeRequest" },
            example: {
              endpoint: "https://fcm.googleapis.com/fcm/send/dGhpcy1pcy1hLWZha2UtZW5kcG9pbnQ",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Subscription removed (or no-op if it was not stored)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PushOkResponse" },
              example: { ok: true },
            },
          },
        },
        400: {
          description: "Missing endpoint in the request body",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "Missing endpoint" } },
            },
          },
        },
      },
    },
  },

  "/api/push/send": {
    post: {
      tags: ["Push"],
      summary: "Broadcast a notification to all surfaces",
      description:
        "Dispatches a notification to every reachable surface at once: it fires a native OS notification via Electron's main-process Notification API when the server is hosted inside the desktop app, AND sends an encrypted Web Push delivery to every stored subscription. Both legs run unconditionally so whichever surface the user is on receives the alert — under `npm start` the native leg is a no-op, and under the desktop app the Web Push leg is typically a no-op (Electron has no FCM credentials, so `push_subscriptions` is empty). Subscriptions rejected with HTTP 410 (Gone) are pruned from `push_subscriptions` during the request. The response reports `{ native, pushed, failed }` so the caller can tell a real delivery from a silent no-op. No authentication (local-first). A missing `title` or `body` returns 400; an unexpected dispatch error returns 500.",
      operationId: "pushSend",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/PushSendRequest" },
            example: {
              title: "Session completed",
              body: "Your Claude Code session finished with 3 subagents.",
            },
          },
        },
      },
      responses: {
        200: {
          description:
            "Dispatch ran; the body reports which surfaces fired and how many Web Push deliveries succeeded/failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PushSendResponse" },
              example: { ok: true, native: false, pushed: 2, failed: 1 },
            },
          },
        },
        400: {
          description: "Missing title or body",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "Missing title or body" } },
            },
          },
        },
        500: {
          description: "Dispatch error while broadcasting the notification",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MessageErrorResponse" },
              example: { error: { message: "Push service unavailable" } },
            },
          },
        },
      },
    },
  },
};

module.exports = { tags, schemas, paths };
