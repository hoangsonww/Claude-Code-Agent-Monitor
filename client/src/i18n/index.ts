/**
 * @file index.ts
 * @description Initializes the i18n internationalization framework for the agent dashboard application, setting up language resources for English, Chinese, Vietnamese, and Korean locales. It configures language detection, fallback options, and namespaces for organized translation keys. This module allows the application to support multiple languages and provides a seamless experience for users across different regions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

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
    },
    supportedLngs: ["en", "zh", "vi", "ko"],
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

export default i18n;
