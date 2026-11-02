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
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/paletteCommands.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Guards the palette catalog's coverage claim: "every page, every Settings section, every Agent
 * Config tab". The catalog mirrors three lists that live elsewhere — the route table in `App.tsx` ,
 * `SETTINGS_SECTIONS` in `Settings.tsx` , and `TABS` in `CcConfig.tsx` — and nothing at runtime
 * notices when a mirror drifts: an added Settings section simply stays unreachable from the
 * launcher, and a renamed anchor becomes a link that scrolls nowhere. Both failures are silent, so
 * they are asserted here against the real sources. Sources are read through Vite's `?raw` import
 * rather than `node:fs` : the client tsconfig is DOM-only, so a Node builtin typechecks under
 * Vitest but breaks `tsc -b` in the production build.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Local dependency edges
 * - `../../App.tsx?raw` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 * - `../../pages/CcConfig.tsx?raw` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../../pages/Settings.tsx?raw` — repository-local contract consumed by this module; review its
 *   exports before changing assumptions here.
 * - `../paletteCommands` — repository-local contract consumed by this module; review its exports
 *   before changing assumptions here.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `captures` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `makeContext` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Named test contracts
 * - `contains no destructive operation` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `flips a preference to its opposite rather than to a fixed value` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `gives every command a unique id and a known group` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `gives every declared page action a label key and an icon` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `maps the all-sessions filter to a bare route, not an empty parameter` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `marks the active language and provider scope` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `marks the machine that is already scoped` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `navigates rather than mutating for destinations` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `offers a page action only while that page has registered it` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `offers every Agent Config tab` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `offers every route the app registers` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `offers every Settings section, in the page's own order` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `palette catalog coverage` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `routes a page action to the registry rather than doing the work itself` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `scopes to a single machine and says so` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `steps the volume within range rather than past it` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `turns each known project directory into a filtered session jump` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the user-visible or contract-level behavior in each test title so failures explain the
 *   regression.
 * - Query rendered UI by role, accessible name, or meaningful text before reaching for
 *   implementation selectors.
 * - Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.
 * - Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.
 * - Keep fixtures minimal but structurally realistic, including provider and source fields used by
 *   production branches.
 * - Assert important negative behavior when duplicate events, stale responses, or absent data are
 *   the known risk.
 * - Avoid snapshots for volatile values unless serializers normalize them and review remains
 *   readable.
 * - Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual
 *   output.
 * - Do not assert internal hook state when the same contract can be observed through rendered
 *   output or callbacks.
 * - When fixing a regression, prove the test fails on the broken implementation before accepting
 *   the fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/paletteCommands.test.ts`
 *   .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/lib/__tests__/paletteCommands.test.ts`
 *
 * Scope
 * Guards the palette catalog's coverage claim: "every page, every Settings section, every Agent
 * Config tab". The catalog mirrors three lists that live elsewhere — the route table in `App.tsx`,
 * `SETTINGS_SECTIONS` in `Settings.tsx`, and `TABS` in `CcConfig.tsx` — and nothing at runtime
 * notices when a mirror drifts: an added Settings section simply stays unreachable from the
 * launcher, and a renamed anchor becomes a link that scrolls nowhere. Both failures are silent, so
 * they are asserted here against the real sources. Sources are read through Vite's `?raw` import
 * rather than `node:fs`: the client tsconfig is DOM-only, so a Node builtin typechecks under Vitest
 * but breaks `tsc -b` in the production build.
 *
 * Subjects and collaborators
 * - `../../App.tsx?raw` — local module imported by this suite.
 * - `../../pages/Settings.tsx?raw` — local module imported by this suite.
 * - `../../pages/CcConfig.tsx?raw` — local module imported by this suite.
 * - `../paletteCommands` — local module imported by this suite.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `palette catalog coverage`
 *
 * Protected behavior
 * - offers every route the app registers
 * - offers every Settings section, in the page's own order
 * - offers every Agent Config tab
 * - gives every command a unique id and a known group
 * - navigates rather than mutating for destinations
 * - maps the all-sessions filter to a bare route, not an empty parameter
 * - flips a preference to its opposite rather than to a fixed value
 * - marks the active language and provider scope
 * - offers a page action only while that page has registered it
 * - routes a page action to the registry rather than doing the work itself
 * - gives every declared page action a label key and an icon
 * - turns each known project directory into a filtered session jump
 * - scopes to a single machine and says so
 * - marks the machine that is already scoped
 * - steps the volume within range rather than past it
 * - contains no destructive operation
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, expect, it, vi } from "vitest";
import appSource from "../../App.tsx?raw";
import settingsSource from "../../pages/Settings.tsx?raw";
import ccConfigSource from "../../pages/CcConfig.tsx?raw";
import {
  CC_CONFIG_TAB_COMMANDS,
  COMMAND_GROUP_ORDER,
  PAGE_ACTION_COMMANDS,
  PAGE_COMMANDS,
  SETTINGS_SECTION_COMMANDS,
  buildPaletteCommands,
  type PaletteContext,
} from "../paletteCommands";

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
    boundIds: new Set<string>(),
    runAction: vi.fn(),
    announce: vi.fn(),
    projects: [],
    sources: [],
    scope: { mode: "all", selected: [] },
    setScope: vi.fn(),
    notificationsEnabled: false,
    setNotificationsEnabled: vi.fn(),
    soundVolume: 0.5,
    setSoundVolume: vi.fn(),
    tabbyMuted: false,
    setTabbyMuted: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
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

  it("gives every command a unique id and a known group", () => {
    // Ids are what the MRU list persists, so a duplicate would make "Recent"
    // resolve to whichever command happened to be built first.
    const commands = buildPaletteCommands(
      makeContext({
        boundIds: new Set(["page.refresh", "activity.togglePause"]),
        projects: ["/a", "/b"],
        sources: [{ id: "src_1", label: "one" }],
      })
    );
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

  it("marks the active language and provider scope", () => {
    const commands = buildPaletteCommands(makeContext({ language: "ko", providerScope: "codex" }));
    expect(commands.find((command) => command.id === "action:language:ko")?.state).toBeTruthy();
    expect(commands.find((command) => command.id === "action:language:en")?.state).toBeUndefined();
    expect(commands.find((command) => command.id === "action:provider:codex")?.state).toBeTruthy();
    expect(
      commands.find((command) => command.id === "action:provider:both")?.state
    ).toBeUndefined();
  });

  it("offers a page action only while that page has registered it", () => {
    // The original quick actions felt broken because they were listed
    // everywhere and worked nowhere. A page command must not appear unbound.
    const none = buildPaletteCommands(makeContext());
    expect(none.some((command) => command.group === "thisPage")).toBe(false);

    const bound = buildPaletteCommands(
      makeContext({ boundIds: new Set(["activity.togglePause"]) })
    );
    const offered = bound.filter((command) => command.group === "thisPage");
    expect(offered).toHaveLength(1);
    expect(offered[0]!.id).toBe("page-action:activity.togglePause");
  });

  it("routes a page action to the registry rather than doing the work itself", () => {
    const runAction = vi.fn();
    buildPaletteCommands(makeContext({ boundIds: new Set(["sessions.sortCost"]), runAction }))
      .find((command) => command.id === "page-action:sessions.sortCost")!
      .run();
    expect(runAction).toHaveBeenCalledWith("sessions.sortCost");
  });

  it("gives every declared page action a label key and an icon", () => {
    for (const action of PAGE_ACTION_COMMANDS) {
      expect(action.labelKey, `${action.id} has no labelKey`).toBeTruthy();
      expect(action.icon, `${action.id} has no icon`).toBeTruthy();
    }
  });

  it("turns each known project directory into a filtered session jump", () => {
    const navigate = vi.fn();
    const commands = buildPaletteCommands(
      makeContext({ navigate, projects: ["/Users/dev/api", "/Users/dev/web"] })
    );
    const projects = commands.filter((command) => command.group === "projects");
    expect(projects).toHaveLength(2);
    // Labelled by basename, searchable and detailed by full path.
    expect(projects[0]!.label).toBe("api");
    expect(projects[0]!.detail).toBe("/Users/dev/api");

    projects[0]!.run();
    expect(navigate).toHaveBeenCalledWith("/sessions?cwd=%2FUsers%2Fdev%2Fapi");
  });

  it("scopes to a single machine and says so", () => {
    const setScope = vi.fn();
    const announce = vi.fn();
    buildPaletteCommands(
      makeContext({ sources: [{ id: "src_1", label: "build-box" }], setScope, announce })
    )
      .find((command) => command.id === "action:source:src_1")!
      .run();

    expect(setScope).toHaveBeenCalledWith({ mode: "selected", selected: ["src_1"] });
    // Nothing moves on screen, so the command has to confirm itself.
    expect(announce).toHaveBeenCalled();
  });

  it("marks the machine that is already scoped", () => {
    const commands = buildPaletteCommands(
      makeContext({
        sources: [{ id: "src_1", label: "build-box" }],
        scope: { mode: "selected", selected: ["src_1"] },
      })
    );
    expect(commands.find((command) => command.id === "action:source:src_1")?.state).toBeTruthy();
  });

  it("steps the volume within range rather than past it", () => {
    const setSoundVolume = vi.fn();
    const at = (volume: number) => makeContext({ soundVolume: volume, setSoundVolume });

    buildPaletteCommands(at(0.95))
      .find((c) => c.id === "action:volume-up")!
      .run();
    expect(setSoundVolume).toHaveBeenLastCalledWith(1);

    buildPaletteCommands(at(0.05))
      .find((c) => c.id === "action:volume-down")!
      .run();
    expect(setSoundVolume).toHaveBeenLastCalledWith(0);
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
