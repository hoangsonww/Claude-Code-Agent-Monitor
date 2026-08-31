/**
 * @file paletteCommands.test.ts
 * @description Guards the palette catalog's coverage claim: "every page, every
 * Settings section, every Agent Config tab".
 *
 * The catalog mirrors three lists that live elsewhere — the route table in
 * `App.tsx`, `SETTINGS_SECTIONS` in `Settings.tsx`, and `TABS` in `CcConfig.tsx`
 * — and nothing at runtime notices when a mirror drifts: an added Settings
 * section simply stays unreachable from the launcher, and a renamed anchor
 * becomes a link that scrolls nowhere. Both failures are silent, so they are
 * asserted here against the real sources.
 *
 * Sources are read through Vite's `?raw` import rather than `node:fs`: the client
 * tsconfig is DOM-only, so a Node builtin typechecks under Vitest but breaks
 * `tsc -b` in the production build.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it, vi } from "vitest";
import appSource from "../../App.tsx?raw";
import settingsSource from "../../pages/Settings.tsx?raw";
import ccConfigSource from "../../pages/CcConfig.tsx?raw";
import {
  CC_CONFIG_TAB_COMMANDS,
  COMMAND_GROUP_ORDER,
  PAGE_COMMANDS,
  SETTINGS_SECTION_COMMANDS,
  buildPaletteCommands,
  type PaletteContext,
} from "../paletteCommands";
import { SHORTCUT_BY_ID } from "../shortcuts";

/** First capture group of every match, dropping any that did not capture. */
function captures(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined);
}

/** A context whose every callback is a spy, so `run()` can be asserted. */
function makeContext(overrides: Partial<PaletteContext> = {}): PaletteContext {
  return {
    // Echo the key back so assertions can read which key produced a label.
    t: (key: string) => key,
    navigate: vi.fn(),
    pathname: "/",
    openHelp: vi.fn(),
    toggleSidebar: vi.fn(),
    sidebarCollapsed: false,
    refreshPage: vi.fn(),
    scrollTop: vi.fn(),
    scrollBottom: vi.fn(),
    copyLink: vi.fn(),
    language: "en",
    setLanguage: vi.fn(),
    soundEnabled: true,
    setSoundEnabled: vi.fn(),
    tabbyEnabled: true,
    setTabbyEnabled: vi.fn(),
    providerScope: "both",
    setProviderScope: vi.fn(),
    checkForUpdates: vi.fn(),
    clearRecents: vi.fn(),
    ...overrides,
  };
}

describe("palette catalog coverage", () => {
  it("offers every route the app registers", () => {
    // `<Route path="x" …>` plus the index route, normalized to a leading slash.
    const routed = captures(appSource, /<Route\s+path="([^"*]+)"/g)
      .filter((path) => !path.includes(":"))
      .map((path) => `/${path}`);
    const covered = PAGE_COMMANDS.map((page) => page.to);

    expect(covered).toContain("/");
    for (const route of routed) {
      expect(covered, `${route} is not reachable from the palette`).toContain(route);
    }
  });

  it("offers every Settings section, in the page's own order", () => {
    const sections = captures(settingsSource, /\{\s*id:\s*"([^"]+)",\s*labelKey:/g);
    expect(SETTINGS_SECTION_COMMANDS.map((entry) => entry.id)).toEqual(sections);
  });

  it("offers every Agent Config tab", () => {
    const tabs = captures(ccConfigSource, /\{\s*key:\s*"([^"]+)",\s*icon:/g);
    expect(CC_CONFIG_TAB_COMMANDS.map((entry) => entry.key).sort()).toEqual([...tabs].sort());
  });

  it("points every page command at a shortcut that exists", () => {
    for (const page of PAGE_COMMANDS) {
      expect(SHORTCUT_BY_ID.has(page.shortcutId), `${page.shortcutId} is not registered`).toBe(
        true
      );
    }
  });
});

describe("buildPaletteCommands", () => {
  it("gives every command a unique id and a known group", () => {
    const commands = buildPaletteCommands(makeContext());
    const ids = commands.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const command of commands) {
      expect(COMMAND_GROUP_ORDER).toContain(command.group);
    }
  });

  it("navigates rather than mutating for destinations", () => {
    const navigate = vi.fn();
    const commands = buildPaletteCommands(makeContext({ navigate }));
    commands.find((command) => command.id === "settings:alerts")!.run();
    expect(navigate).toHaveBeenCalledWith("/settings#alerts");

    commands.find((command) => command.id === "cc-config:hooks")!.run();
    expect(navigate).toHaveBeenCalledWith("/cc-config?tab=hooks");

    commands.find((command) => command.id === "view:sessions:active")!.run();
    expect(navigate).toHaveBeenCalledWith("/sessions?status=active");
  });

  it("maps the all-sessions filter to a bare route, not an empty parameter", () => {
    const navigate = vi.fn();
    buildPaletteCommands(makeContext({ navigate }))
      .find((command) => command.id === "view:sessions:all")!
      .run();
    expect(navigate).toHaveBeenCalledWith("/sessions");
  });

  it("flips a preference to its opposite rather than to a fixed value", () => {
    const setSoundEnabled = vi.fn();
    buildPaletteCommands(makeContext({ soundEnabled: true, setSoundEnabled }))
      .find((command) => command.id === "action:sound")!
      .run();
    expect(setSoundEnabled).toHaveBeenCalledWith(false);

    setSoundEnabled.mockClear();
    buildPaletteCommands(makeContext({ soundEnabled: false, setSoundEnabled }))
      .find((command) => command.id === "action:sound")!
      .run();
    expect(setSoundEnabled).toHaveBeenCalledWith(true);
  });

  it("labels the sidebar toggle by what it will do next", () => {
    const collapsedLabel = buildPaletteCommands(makeContext({ sidebarCollapsed: true })).find(
      (command) => command.id === "action:sidebar"
    )!.label;
    const expandedLabel = buildPaletteCommands(makeContext({ sidebarCollapsed: false })).find(
      (command) => command.id === "action:sidebar"
    )!.label;

    expect(collapsedLabel).toContain("actionExpandSidebar");
    expect(expandedLabel).toContain("actionCollapseSidebar");
  });

  it("marks the active language and provider scope", () => {
    const commands = buildPaletteCommands(makeContext({ language: "ko", providerScope: "codex" }));
    expect(commands.find((command) => command.id === "action:language:ko")?.state).toBeTruthy();
    expect(commands.find((command) => command.id === "action:language:en")?.state).toBeUndefined();
    expect(commands.find((command) => command.id === "action:provider:codex")?.state).toBeTruthy();
    expect(
      commands.find((command) => command.id === "action:provider:both")?.state
    ).toBeUndefined();
  });

  it("contains no destructive operation", () => {
    // Purging data is one typo away in a launcher; those flows stay behind their
    // confirmation modals and the palette only navigates to them.
    const ids = buildPaletteCommands(makeContext()).map((command) => command.id);
    for (const id of ids) {
      expect(id).not.toMatch(/delete|purge|wipe|reset-database/i);
    }
  });
});
