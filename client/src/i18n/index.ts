/**
 * @file index.ts
 * @description i18next bootstrap for the dashboard client. Registers bundled JSON
 * locale files for English (`en`), Chinese (`zh`), Vietnamese (`vi`), and
 * Korean (`ko`), wires browser language detection, and exports the configured
 * singleton consumed by `react-i18next`.
 *
 * ## Namespaces
 * Translations are split by feature area (`dashboard`, `sessions`, `settings`,
 * etc.) so pages import only the keys they need via `useTranslation("ns")`.
 * `common` is the default namespace for shared labels and buttons.
 *
 * ## Detection order
 * 1. `localStorage` key `i18nextLng` (user override from Settings)
 * 2. `navigator.language` fallback
 *
 * Unknown regional variants (e.g. `en-US`) map to supported base languages via
 * `nonExplicitSupportedLngs`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/i18n/index.ts`
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
 * - `./locales/en/common.json`
 * - `./locales/zh/common.json`
 * - `./locales/vi/common.json`
 * - `./locales/en/nav.json`
 * - `./locales/zh/nav.json`
 * - `./locales/vi/nav.json`
 * - `./locales/en/dashboard.json`
 * - `./locales/zh/dashboard.json`
 * - `./locales/vi/dashboard.json`
 * - `./locales/en/sessions.json`
 * - `./locales/zh/sessions.json`
 * - `./locales/vi/sessions.json`
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

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import common_en from "./locales/en/common.json";
import common_zh from "./locales/zh/common.json";
import common_vi from "./locales/vi/common.json";
import nav_en from "./locales/en/nav.json";
import nav_zh from "./locales/zh/nav.json";
import nav_vi from "./locales/vi/nav.json";
import dashboard_en from "./locales/en/dashboard.json";
import dashboard_zh from "./locales/zh/dashboard.json";
import dashboard_vi from "./locales/vi/dashboard.json";
import sessions_en from "./locales/en/sessions.json";
import sessions_zh from "./locales/zh/sessions.json";
import sessions_vi from "./locales/vi/sessions.json";
import activity_en from "./locales/en/activity.json";
import activity_zh from "./locales/zh/activity.json";
import activity_vi from "./locales/vi/activity.json";
import analytics_en from "./locales/en/analytics.json";
import analytics_zh from "./locales/zh/analytics.json";
import analytics_vi from "./locales/vi/analytics.json";
import workflows_en from "./locales/en/workflows.json";
import workflows_zh from "./locales/zh/workflows.json";
import workflows_vi from "./locales/vi/workflows.json";
import settings_en from "./locales/en/settings.json";
import settings_zh from "./locales/zh/settings.json";
import settings_vi from "./locales/vi/settings.json";
import kanban_en from "./locales/en/kanban.json";
import kanban_zh from "./locales/zh/kanban.json";
import kanban_vi from "./locales/vi/kanban.json";
import errors_en from "./locales/en/errors.json";
import errors_zh from "./locales/zh/errors.json";
import errors_vi from "./locales/vi/errors.json";
import updates_en from "./locales/en/updates.json";
import updates_zh from "./locales/zh/updates.json";
import updates_vi from "./locales/vi/updates.json";
import ccConfig_en from "./locales/en/ccConfig.json";
import ccConfig_zh from "./locales/zh/ccConfig.json";
import ccConfig_vi from "./locales/vi/ccConfig.json";
import run_en from "./locales/en/run.json";
import run_zh from "./locales/zh/run.json";
import run_vi from "./locales/vi/run.json";
import alerts_en from "./locales/en/alerts.json";
import alerts_zh from "./locales/zh/alerts.json";
import alerts_vi from "./locales/vi/alerts.json";
import splash_en from "./locales/en/splash.json";
import splash_zh from "./locales/zh/splash.json";
import splash_vi from "./locales/vi/splash.json";

import common_ko from "./locales/ko/common.json";
import nav_ko from "./locales/ko/nav.json";
import dashboard_ko from "./locales/ko/dashboard.json";
import sessions_ko from "./locales/ko/sessions.json";
import activity_ko from "./locales/ko/activity.json";
import analytics_ko from "./locales/ko/analytics.json";
import workflows_ko from "./locales/ko/workflows.json";
import settings_ko from "./locales/ko/settings.json";
import kanban_ko from "./locales/ko/kanban.json";
import errors_ko from "./locales/ko/errors.json";
import updates_ko from "./locales/ko/updates.json";
import ccConfig_ko from "./locales/ko/ccConfig.json";
import run_ko from "./locales/ko/run.json";
import alerts_ko from "./locales/ko/alerts.json";
import splash_ko from "./locales/ko/splash.json";

import common_es from "./locales/es/common.json";
import nav_es from "./locales/es/nav.json";
import dashboard_es from "./locales/es/dashboard.json";
import sessions_es from "./locales/es/sessions.json";
import activity_es from "./locales/es/activity.json";
import analytics_es from "./locales/es/analytics.json";
import workflows_es from "./locales/es/workflows.json";
import settings_es from "./locales/es/settings.json";
import kanban_es from "./locales/es/kanban.json";
import errors_es from "./locales/es/errors.json";
import updates_es from "./locales/es/updates.json";
import ccConfig_es from "./locales/es/ccConfig.json";
import run_es from "./locales/es/run.json";
import alerts_es from "./locales/es/alerts.json";
import splash_es from "./locales/es/splash.json";

import common_de from "./locales/de/common.json";
import nav_de from "./locales/de/nav.json";
import dashboard_de from "./locales/de/dashboard.json";
import sessions_de from "./locales/de/sessions.json";
import activity_de from "./locales/de/activity.json";
import analytics_de from "./locales/de/analytics.json";
import workflows_de from "./locales/de/workflows.json";
import settings_de from "./locales/de/settings.json";
import kanban_de from "./locales/de/kanban.json";
import errors_de from "./locales/de/errors.json";
import updates_de from "./locales/de/updates.json";
import ccConfig_de from "./locales/de/ccConfig.json";
import run_de from "./locales/de/run.json";
import alerts_de from "./locales/de/alerts.json";
import splash_de from "./locales/de/splash.json";

import common_fr from "./locales/fr/common.json";
import nav_fr from "./locales/fr/nav.json";
import dashboard_fr from "./locales/fr/dashboard.json";
import sessions_fr from "./locales/fr/sessions.json";
import activity_fr from "./locales/fr/activity.json";
import analytics_fr from "./locales/fr/analytics.json";
import workflows_fr from "./locales/fr/workflows.json";
import settings_fr from "./locales/fr/settings.json";
import kanban_fr from "./locales/fr/kanban.json";
import errors_fr from "./locales/fr/errors.json";
import updates_fr from "./locales/fr/updates.json";
import ccConfig_fr from "./locales/fr/ccConfig.json";
import run_fr from "./locales/fr/run.json";
import alerts_fr from "./locales/fr/alerts.json";
import splash_fr from "./locales/fr/splash.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: common_en,
        nav: nav_en,
        dashboard: dashboard_en,
        sessions: sessions_en,
        activity: activity_en,
        analytics: analytics_en,
        workflows: workflows_en,
        settings: settings_en,
        kanban: kanban_en,
        errors: errors_en,
        updates: updates_en,
        ccConfig: ccConfig_en,
        run: run_en,
        alerts: alerts_en,
        splash: splash_en,
      },
      zh: {
        common: common_zh,
        nav: nav_zh,
        dashboard: dashboard_zh,
        sessions: sessions_zh,
        activity: activity_zh,
        analytics: analytics_zh,
        workflows: workflows_zh,
        settings: settings_zh,
        kanban: kanban_zh,
        errors: errors_zh,
        updates: updates_zh,
        ccConfig: ccConfig_zh,
        run: run_zh,
        alerts: alerts_zh,
        splash: splash_zh,
      },
      vi: {
        common: common_vi,
        nav: nav_vi,
        dashboard: dashboard_vi,
        sessions: sessions_vi,
        activity: activity_vi,
        analytics: analytics_vi,
        workflows: workflows_vi,
        settings: settings_vi,
        kanban: kanban_vi,
        errors: errors_vi,
        updates: updates_vi,
        ccConfig: ccConfig_vi,
        run: run_vi,
        alerts: alerts_vi,
        splash: splash_vi,
      },
      ko: {
        common: common_ko,
        nav: nav_ko,
        dashboard: dashboard_ko,
        sessions: sessions_ko,
        activity: activity_ko,
        analytics: analytics_ko,
        workflows: workflows_ko,
        settings: settings_ko,
        kanban: kanban_ko,
        errors: errors_ko,
        updates: updates_ko,
        ccConfig: ccConfig_ko,
        run: run_ko,
        alerts: alerts_ko,
        splash: splash_ko,
      },
      es: {
        common: common_es,
        nav: nav_es,
        dashboard: dashboard_es,
        sessions: sessions_es,
        activity: activity_es,
        analytics: analytics_es,
        workflows: workflows_es,
        settings: settings_es,
        kanban: kanban_es,
        errors: errors_es,
        updates: updates_es,
        ccConfig: ccConfig_es,
        run: run_es,
        alerts: alerts_es,
        splash: splash_es,
      },
      de: {
        common: common_de,
        nav: nav_de,
        dashboard: dashboard_de,
        sessions: sessions_de,
        activity: activity_de,
        analytics: analytics_de,
        workflows: workflows_de,
        settings: settings_de,
        kanban: kanban_de,
        errors: errors_de,
        updates: updates_de,
        ccConfig: ccConfig_de,
        run: run_de,
        alerts: alerts_de,
        splash: splash_de,
      },
      fr: {
        common: common_fr,
        nav: nav_fr,
        dashboard: dashboard_fr,
        sessions: sessions_fr,
        activity: activity_fr,
        analytics: analytics_fr,
        workflows: workflows_fr,
        settings: settings_fr,
        kanban: kanban_fr,
        errors: errors_fr,
        updates: updates_fr,
        ccConfig: ccConfig_fr,
        run: run_fr,
        alerts: alerts_fr,
        splash: splash_fr,
      },
    },
    supportedLngs: ["en", "zh", "vi", "ko", "es", "de", "fr"],
    nonExplicitSupportedLngs: true,
    fallbackLng: "en",
    ns: [
      "common",
      "nav",
      "dashboard",
      "sessions",
      "activity",
      "analytics",
      "workflows",
      "settings",
      "kanban",
      "errors",
      "updates",
      "ccConfig",
      "run",
      "alerts",
      "splash",
    ],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

/** Configured i18next instance — import side effects run {@link init}. */
export default i18n;
