/**
 * @file i18n.test.ts
 * @description Unit tests for i18n translation resources to ensure correct translations and locale handling in the agent dashboard application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import i18n from "i18next";

const flattenResource = (
  value: unknown,
  prefix = "",
  result: Record<string, unknown> = {}
): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenResource(child, prefix ? `${prefix}.${key}` : key, result);
    }
  } else {
    result[prefix] = value;
  }

  return result;
};

const interpolationTokens = (value: unknown): string[] => {
  if (typeof value !== "string") return [];

  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}|%\{\s*([^}\s]+)\s*\}/g)]
    .flatMap((match) => {
      const token = match[1] ?? match[2];
      return token ? [token] : [];
    })
    .sort();
};

describe("i18n resources", () => {
  it("keeps every locale's keys, value types, and interpolation tokens aligned with English", () => {
    const namespaces = Object.keys(i18n.getDataByLanguage("en") ?? {});

    for (const namespace of namespaces) {
      const english = flattenResource(i18n.getResourceBundle("en", namespace));

      for (const language of ["zh", "vi", "ko", "es"]) {
        const locale = flattenResource(i18n.getResourceBundle(language, namespace));

        expect(Object.keys(locale).sort(), `${language}/${namespace} keys`).toEqual(
          Object.keys(english).sort()
        );

        for (const key of Object.keys(english)) {
          expect(typeof locale[key], `${language}/${namespace}:${key} type`).toBe(
            typeof english[key]
          );
          expect(
            interpolationTokens(locale[key]),
            `${language}/${namespace}:${key} interpolation tokens`
          ).toEqual(interpolationTokens(english[key]));
        }
      }
    }
  });

  it("should provide Vietnamese translations for navigation keys", async () => {
    await i18n.changeLanguage("vi");

    expect(i18n.t("nav:dashboard")).toBe("Tổng quan");
    expect(i18n.t("nav:agentBoard")).toBe("Bảng Kanban");
    expect(i18n.t("nav:languageShort.vi")).toBe("VI");
  });

  it("should keep Agent terminology untranslated in zh, vi, ko, and es locales", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("vi");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("ko");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("es");
    expect(i18n.t("common:agent")).toBe("agente");
    expect(i18n.t("common:subagent")).toBe("subagente");
  });

  it("should provide Spanish translations for navigation keys", async () => {
    await i18n.changeLanguage("es");

    expect(i18n.t("nav:dashboard")).toBe("Panel");
    expect(i18n.t("nav:agentBoard")).toBe("Tablero Kanban");
    expect(i18n.t("nav:languageShort.es")).toBe("ES");
  });

  it("should provide Spanish translations across every feature namespace", async () => {
    await i18n.changeLanguage("es");

    expect(i18n.t("common:awaitingReason.session_start.label")).toBe("Esperando una instrucción");
    expect(i18n.t("analytics:total30d")).toBe("Total (30 días)");
    expect(i18n.t("ccConfig:tabs.skills")).toBe("Habilidades");
    expect(i18n.t("run:fields.prompt")).toBe("Instrucción");
    expect(i18n.t("settings:hooks.title")).toBe("Configuración de ganchos");
    expect(i18n.t("workflows:runs.promptLabel")).toBe("Instrucción");
  });

  it("should support non-explicit Spanish locale tags", async () => {
    await i18n.changeLanguage("es-ES");

    expect(i18n.resolvedLanguage?.startsWith("es")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("Panel");
  });

  it("should support non-explicit Vietnamese locale tags", async () => {
    await i18n.changeLanguage("vi-VN");

    expect(i18n.resolvedLanguage?.startsWith("vi")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("Tổng quan");
  });

  it("should provide Korean translations for navigation keys", async () => {
    await i18n.changeLanguage("ko");

    expect(i18n.t("nav:dashboard")).toBe("대시보드");
    expect(i18n.t("nav:agentBoard")).toBe("칸반 보드");
    expect(i18n.t("nav:languageShort.ko")).toBe("한국어");
  });

  it("should support non-explicit Korean locale tags", async () => {
    await i18n.changeLanguage("ko-KR");

    expect(i18n.resolvedLanguage?.startsWith("ko")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("대시보드");
  });

  it("pluralizes the subagent count labels in English", async () => {
    await i18n.changeLanguage("en");
    // The collapsed agent-tree badge (Dashboard) and SessionDetail both render
    // this key with a count. It MUST use i18next plural forms (_one/_other) so
    // "2 subagent" never shows — the flat common:subagent word is not a plural
    // key and rendering it with a count is the bug this guards against.
    expect(i18n.t("common:subagent_label", { count: 1 })).toBe("1 subagent");
    expect(i18n.t("common:subagent_label", { count: 2 })).toBe("2 subagents");
    // The main-agent card subtitle carries its own kanban plural key.
    expect(i18n.t("kanban:session.subagentSummary", { count: 1 })).toBe("1 subagent");
    expect(i18n.t("kanban:session.subagentSummary", { count: 3 })).toBe("3 subagents");
  });

  it("pluralizes task-progress counts in English and Spanish", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("sessions:taskProgress.more", { count: 1 })).toBe(
      "+1 more task in Session Detail"
    );
    expect(i18n.t("sessions:taskProgress.more", { count: 2 })).toBe(
      "+2 more tasks in Session Detail"
    );
    expect(i18n.t("sessions:taskProgress.hiddenTasks", { count: 1 })).toBe(
      "1 additional task is not shown."
    );
    expect(i18n.t("sessions:taskProgress.hiddenTasks", { count: 2 })).toBe(
      "2 additional tasks are not shown."
    );

    await i18n.changeLanguage("es");
    expect(i18n.t("sessions:taskProgress.doneCount", { count: 1 })).toBe("1 completada");
    expect(i18n.t("sessions:taskProgress.doneCount", { count: 2 })).toBe("2 completadas");
    expect(i18n.t("sessions:taskProgress.remainingCount", { count: 1 })).toBe("1 pendiente");
    expect(i18n.t("sessions:taskProgress.remainingCount", { count: 2 })).toBe("2 pendientes");
  });

  it("ships every first-run hook setup control in each supported locale", () => {
    const keys = [
      "provider.both.label",
      "provider.both.description",
      "hookGate.kicker",
      "hookGate.title",
      "hookGate.description",
      "hookGate.selectedProviders",
      "hookGate.realTime",
      "hookGate.checking",
      "hookGate.installed",
      "hookGate.existing",
      "hookGate.ready",
      "hookGate.overrideWarning",
      "hookGate.output",
      "hookGate.failure",
      "hookGate.checkFailed",
      "hookGate.preserveNote",
      "hookGate.alreadyInstalled",
      "hookGate.install",
      "hookGate.installing",
      "hookGate.continue",
    ];

    for (const language of ["en", "zh", "vi", "ko", "es"]) {
      for (const key of keys) {
        expect(i18n.getResource(language, "splash", key)).toBeTruthy();
      }
    }
  });

  it("ships the global provider and session-home settings in every supported locale", () => {
    const keys = [
      "display.title",
      "display.claude",
      "display.codex",
      "display.both",
      "display.claudeDescription",
      "display.codexDescription",
      "display.bothDescription",
      "homes.title",
      "codexHome.title",
      "pricing.navClaude",
      "pricing.navGpt",
      "pricing.gpt.title",
      "pricing.gpt.tooltip.title",
      "pricing.gpt.tooltip.howItWorksBody",
      "pricing.gpt.tooltip.apiPricingBody",
    ];

    for (const language of ["en", "zh", "vi", "ko", "es"]) {
      for (const key of keys) {
        expect(i18n.getResource(language, "settings", key)).toBeTruthy();
      }
    }
  });
});
