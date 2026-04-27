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

  it("should keep Agent terminology untranslated in zh and vi locales", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("vi");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");
  });

  it("should support non-explicit Vietnamese locale tags", async () => {
    await i18n.changeLanguage("vi-VN");

    expect(i18n.resolvedLanguage?.startsWith("vi")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("Tổng quan");
  });
});
