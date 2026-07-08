/**
 * @file i18n.test.ts
 * @description Unit tests for i18n translation resources to ensure correct translations and locale handling in the agent dashboard application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import i18n from "i18next";

describe("i18n resources", () => {
  it("should provide Vietnamese translations for navigation keys", async () => {
    await i18n.changeLanguage("vi");

    expect(i18n.t("nav:dashboard")).toBe("Tổng quan");
    expect(i18n.t("nav:agentBoard")).toBe("Bảng Kanban");
    expect(i18n.t("nav:languageShort.vi")).toBe("VI");
  });

  it("should keep Agent terminology untranslated in zh, vi, and ko locales", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("vi");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("ko");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");
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
});
