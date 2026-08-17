/**
 * @file webhookGuides.ts
 * @description Official-docs URLs per webhook provider, shown alongside the
 * step-by-step setup guide in the webhook form. The steps themselves are
 * localized in the i18n `settings` namespace (`webhookGuides.<type>.steps`);
 * URLs aren't translated so they live here.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/webhookGuides.ts`
 * **Purpose:** React hook: isolates side effects and subscription wiring so presentational components stay declarative.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../lib/types`
 *
 * ## Public surface
 * - `WEBHOOK_DOCS` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **WEBHOOK_DOCS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { WebhookType } from "../lib/types";

export const WEBHOOK_DOCS: Partial<Record<WebhookType, string>> = {
  slack: "https://api.slack.com/messaging/webhooks",
  discord: "https://support.discord.com/hc/en-us/articles/228383668",
  teams: "https://learn.microsoft.com/en-us/microsoftteams/platform/workflow",
  google_chat: "https://developers.google.com/workspace/chat/quickstart/webhooks",
  mattermost: "https://developers.mattermost.com/integrate/webhooks/incoming/",
  rocketchat: "https://docs.rocket.chat/docs/integrations",
  telegram: "https://core.telegram.org/bots#how-do-i-create-a-bot",
  pagerduty: "https://support.pagerduty.com/docs/services-and-integrations",
  opsgenie: "https://support.atlassian.com/opsgenie/docs/create-a-default-api-integration/",
  splunk_oncall: "https://help.victorops.com/knowledge-base/rest-endpoint-integration-guide/",
  zapier: "https://zapier.com/apps/webhook/integrations",
  make: "https://www.make.com/en/help/tools/webhooks",
  n8n: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
  pipedream: "https://pipedream.com/docs/workflows/triggers/",
};
