/**
 * @file i18n.test.ts
 * @description Unit tests for i18n translation resources to ensure correct translations and locale handling in the agent dashboard application.
 * Includes a registry-derived, per-locale completeness check for the
 * `report.calendar.{wallClockLabel,activeLabel}` -> `report.{wallClockLabel,
 * activeLabel}` key relocation (focus-report-fidelity build): one `LOCALES`
 * array drives every per-locale assertion so a skipped locale in a future
 * key-move can't ship green by accident.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import i18n from "i18next";

const LOCALES = ["en", "ko", "vi", "zh"] as const;

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

  describe("report.{wallClockLabel,activeLabel} key relocation (registry-derived, all locales)", () => {
    for (const locale of LOCALES) {
      it(`resolves the new top-level keys for locale "${locale}"`, async () => {
        await i18n.changeLanguage(locale);
        const wallClock = i18n.t("plan:report.wallClockLabel");
        const active = i18n.t("plan:report.activeLabel");
        // i18next's default missing-key behavior returns the literal
        // dotted key path back (ns prefix stripped) - a real translation
        // never equals its own key path, so this also catches an
        // accidentally-empty string.
        expect(wallClock).not.toBe("report.wallClockLabel");
        expect(active).not.toBe("report.activeLabel");
        expect(typeof wallClock).toBe("string");
        expect(wallClock.length).toBeGreaterThan(0);
        expect(typeof active).toBe("string");
        expect(active.length).toBeGreaterThan(0);
      });

      it(`no longer resolves the old report.calendar.* path for locale "${locale}"`, async () => {
        await i18n.changeLanguage(locale);
        // Post-relocation, the old path must be gone entirely - i18next's
        // missing-key fallback returns the literal dotted key string,
        // catching a copy-instead-of-move that leaves the old path stale.
        expect(i18n.t("plan:report.calendar.wallClockLabel")).toBe(
          "report.calendar.wallClockLabel"
        );
        expect(i18n.t("plan:report.calendar.activeLabel")).toBe("report.calendar.activeLabel");
      });
    }

    it("keeps wallClockLabel byte-identical to its pre-relocation value (key move, not a translation change) and reflects activeLabel's later Total agent time rename", async () => {
      await i18n.changeLanguage("en");
      expect(i18n.t("plan:report.wallClockLabel")).toBe("Wall clock");
      expect(i18n.t("plan:report.activeLabel")).toBe("Total agent time");
    });
  });

  describe("nav:focusCalendar completeness (registry-derived, all locales) — focus-calendar-board build", () => {
    for (const locale of LOCALES) {
      it(`resolves a non-empty, non-key-echoing string for locale "${locale}"`, async () => {
        await i18n.changeLanguage(locale);
        const label = i18n.t("nav:focusCalendar");
        // i18next's default missing-key behavior returns the literal dotted
        // key path (ns prefix stripped) - a real translation never equals
        // its own key path, which also catches an accidentally-empty string.
        expect(label).not.toBe("focusCalendar");
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      });
    }

    it('pins the English value to exactly "Calendar" (DEC-5) - not the longer "Focus Calendar" page-heading string, which is a separate key', async () => {
      await i18n.changeLanguage("en");
      expect(i18n.t("nav:focusCalendar")).toBe("Calendar");
    });
  });

  describe("report.board.concurrentSessions completeness (registry-derived, all locales) — DEC-6 aggregate-view relabel", () => {
    for (const locale of LOCALES) {
      it(`resolves a non-empty, non-key-echoing string for locale "${locale}", distinct from the modal's per-project concurrency label`, async () => {
        await i18n.changeLanguage(locale);
        const boardLabel = i18n.t("plan:report.board.concurrentSessions");
        const modalLabel = i18n.t("plan:report.concurrency");
        expect(boardLabel).not.toBe("report.board.concurrentSessions");
        expect(typeof boardLabel).toBe("string");
        expect(boardLabel.length).toBeGreaterThan(0);
        // DEC-6: the aggregate/board view gets its OWN relabeled copy - it
        // must never silently fall back to (or duplicate) the existing
        // single-project modal's "Concurrency" label.
        expect(boardLabel).not.toBe(modalLabel);
      });
    }

    it('pins the English value to exactly "Concurrent agent sessions" per technical-plan.md\'s F12 table', async () => {
      await i18n.changeLanguage("en");
      expect(i18n.t("plan:report.board.concurrentSessions")).toBe("Concurrent agent sessions");
    });
  });
});
