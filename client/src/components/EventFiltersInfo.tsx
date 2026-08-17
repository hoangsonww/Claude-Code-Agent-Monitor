/**
 * @file EventFiltersInfo.tsx
 * @description Collapsible help panel for the Event Timeline filter toolbar.
 * Explains agent status badges, Pre/Post hook lifecycle, how filters compose,
 * and what each dropdown accepts. Mounted above {@link EventFilters} on both
 * Activity Feed and Session Detail so users can self-serve without leaving the
 * page.
 *
 * Built with native `<details>` / `<summary>` for keyboard accessibility without
 * a custom popover primitive.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/EventFiltersInfo.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
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
 * - `./StatusBadge`
 *
 * ## Public surface
 * - `EventFiltersInfo` — exported API; see TSDoc on the symbol for behavior.
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
 * **EventFiltersInfo**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { AgentStatusBadge } from "./StatusBadge";

/**
 * Top-level accordion rendered once per timeline view.
 * @returns Expandable help card with nested sections.
 */
export function EventFiltersInfo() {
  const { t } = useTranslation("common");
  return (
    <details className="card bg-surface-2/40 border border-border rounded overflow-hidden">
      <summary className="cursor-pointer select-none px-3 py-2 flex items-center text-[11px] text-gray-400 hover:text-gray-200 hover:bg-surface-2/80">
        <Info className="w-3.5 h-3.5 mr-2" />
        <span className="font-semibold uppercase tracking-wide mr-1.5">
          {t("eventFilters.help.title")}
        </span>
        <span className="text-gray-500 font-normal">- {t("eventFilters.help.subtitle")}</span>
      </summary>

      <div className="divide-y divide-border">
        <Section title={t("eventFilters.help.statusesTitle")}>
          <p className="text-[11px] text-gray-500 mb-2">{t("eventFilters.help.statusesIntro")}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            <dt>
              <AgentStatusBadge status="working" />
            </dt>
            <dd className="self-center">{t("eventFilters.help.statusWorkingDesc")}</dd>
            <dt>
              <AgentStatusBadge status="waiting" />
            </dt>
            <dd className="self-center">{t("eventFilters.help.statusWaitingDesc")}</dd>
            <dt>
              <AgentStatusBadge status="completed" />
            </dt>
            <dd className="self-center">{t("eventFilters.help.statusCompletedDesc")}</dd>
            <dt>
              <AgentStatusBadge status="error" />
            </dt>
            <dd className="self-center">{t("eventFilters.help.statusErrorDesc")}</dd>
          </dl>
        </Section>

        <Section title={t("eventFilters.help.lifecycleTitle")}>
          <p className="text-[11px] text-gray-400 mb-2">{t("eventFilters.help.lifecycleDesc")}</p>
          <code className="block bg-black/40 border border-border rounded p-2 text-[11px] font-mono text-gray-300 whitespace-pre-wrap">
            {t("eventFilters.help.lifecycleFlow")}
          </code>
        </Section>

        <Section title={t("eventFilters.help.filtersTitle")}>
          <ul className="list-disc pl-5 space-y-1 text-[11px] text-gray-400">
            <li>{t("eventFilters.help.filterTip1")}</li>
            <li>{t("eventFilters.help.filterTip2")}</li>
            <li className="text-amber-300/90">{t("eventFilters.help.filterTipGrouping")}</li>
            <li>{t("eventFilters.help.filterTip3")}</li>
            <li>{t("eventFilters.help.filterTip4")}</li>
          </ul>
        </Section>

        <Section title={t("eventFilters.help.valuesTitle")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
            <Field label={t("eventFilters.status")} desc={t("eventFilters.help.valueStatusDesc")} />
            <Field
              label={t("eventFilters.eventType")}
              desc={t("eventFilters.help.valueEventTypeDesc")}
            />
            <Field
              label={t("eventFilters.toolName")}
              desc={t("eventFilters.help.valueToolNameDesc")}
            />
            <Field
              label={t("eventFilters.agentId")}
              desc={t("eventFilters.help.valueAgentIdDesc")}
            />
            <Field
              label={t("eventFilters.sessionId")}
              desc={t("eventFilters.help.valueSessionIdDesc")}
            />
            <Field
              label={t("eventFilters.searchPlaceholder")}
              desc={t("eventFilters.help.valueSearchDesc")}
            />
            <Field
              label={`${t("eventFilters.from")} / ${t("eventFilters.to")}`}
              desc={t("eventFilters.help.valueDateRangeDesc")}
            />
          </dl>
        </Section>
      </div>
    </details>
  );
}

/** Nested collapsible section inside the help panel. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group" open>
      <summary className="cursor-pointer select-none px-3 py-1.5 text-[11px] text-gray-300 hover:bg-surface-2/60 flex items-center gap-2">
        <span className="text-gray-500 transition-transform group-open:rotate-90">▶</span>
        <span className="font-semibold uppercase tracking-wide text-gray-400">{title}</span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
  );
}

/** Label + description row in the filter-values glossary. */
function Field({ label, desc }: { label: string; desc: string }) {
  return (
    <>
      <dt className="font-semibold text-gray-300 whitespace-nowrap">{label}</dt>
      <dd className="text-gray-400">{desc}</dd>
    </>
  );
}
