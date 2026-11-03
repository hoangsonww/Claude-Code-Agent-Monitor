/**
 * @file sound.test.ts
 * @description Unit tests for the synthesized audio-cue engine: preference
 * defaults and persistence, the autoplay-policy gate that keeps cues silent
 * until the first user gesture, per-cue and burst rate limiting, and the
 * `force` escape hatch used by the Settings preview controls. jsdom has no Web
 * Audio implementation, so a minimal `AudioContext` stub stands in and lets the
 * tests assert on the oscillators the engine schedules.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/lib/__tests__/sound.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for the synthesized audio-cue engine: preference defaults and persistence, the
 * autoplay-policy gate that keeps cues silent until the first user gesture, per-cue and burst rate
 * limiting, and the `force` escape hatch used by the Settings preview controls. jsdom has no Web
 * Audio implementation, so a minimal `AudioContext` stub stands in and lets the tests assert on the
 * oscillators the engine schedules.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Package dependency edges
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `FakeAudioContext` (class) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `FakeParam` (class) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `freshModule` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `startedOscillators` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useFakeTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 * - `useRealTimers` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Named test contracts
 * - `caps a burst of distinct cues` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `defaults to enabled so cues work out of the box` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `falls back to defaults on corrupt storage` — executable behavior named by this suite; preserve
 *   the observable contract or update the test with rationale.
 * - `force bypasses the per-cue flag, the throttle, and the gesture gate` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `installSoundUnlock` — executable behavior named by this suite; preserve the observable
 *   contract or update the test with rationale.
 * - `keeps the interaction tick out of the shared burst budget` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `merges a partial saved object over the defaults` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `no-ops without breaking when Web Audio is unavailable` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `notifies subscribers on change and stops after unsubscribe` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `persists updates and clamps the volume into 0-1` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `playCue` — executable behavior named by this suite; preserve the observable contract or update
 *   the test with rationale.
 * - `respects the master switch and a zero volume` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `respects the per-cue preference flag` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `schedules every partial of a cue once unlocked` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `sound preferences` — executable behavior named by this suite; preserve the observable contract
 *   or update the test with rationale.
 * - `stays silent until a user gesture unlocks audio` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `throttles repeats of the same cue` — executable behavior named by this suite; preserve the
 *   observable contract or update the test with rationale.
 * - `unlocks on the first gesture and cleans up its listeners` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/lib/__tests__/sound.test.ts` .
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
 * Path: `client/src/lib/__tests__/sound.test.ts`
 *
 * Scope
 * Unit tests for the synthesized audio-cue engine: preference defaults and persistence, the
 * autoplay-policy gate that keeps cues silent until the first user gesture, per-cue and burst rate
 * limiting, and the `force` escape hatch used by the Settings preview controls. jsdom has no Web
 * Audio implementation, so a minimal `AudioContext` stub stands in and lets the tests assert on the
 * oscillators the engine schedules.
 *
 * Subjects and collaborators
 * - The suite exercises behavior exposed directly by its package or test environment.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 * - Fake timers control debounce, timeout, or interval boundaries; restore real timers during teardown.
 * - Browser storage is test-local state and must be reset so persisted preferences cannot leak between
 *   cases.
 *
 * Suite groups
 * - `sound preferences`
 * - `playCue`
 * - `installSoundUnlock`
 *
 * Protected behavior
 * - defaults to enabled so cues work out of the box
 * - merges a partial saved object over the defaults
 * - falls back to defaults on corrupt storage
 * - persists updates and clamps the volume into 0-1
 * - notifies subscribers on change and stops after unsubscribe
 * - stays silent until a user gesture unlocks audio
 * - schedules every partial of a cue once unlocked
 * - respects the master switch and a zero volume
 * - respects the per-cue preference flag
 * - throttles repeats of the same cue
 * - caps a burst of distinct cues
 * - keeps the interaction tick out of the shared burst budget
 * - force bypasses the per-cue flag, the throttle, and the gesture gate
 * - no-ops without breaking when Web Audio is unavailable
 * - unlocks on the first gesture and cleans up its listeners
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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/** Records every oscillator the engine creates so tests can count cue partials. */
let startedOscillators: number;

class FakeParam {
  value = 0;
  setValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
}

class FakeAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  createGain() {
    return { gain: new FakeParam(), connect: () => {}, disconnect: () => {} };
  }
  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: new FakeParam(),
      connect: () => {},
      disconnect: () => {},
    };
  }
  createOscillator() {
    return {
      type: "sine" as OscillatorType,
      frequency: new FakeParam(),
      connect: () => {},
      disconnect: () => {},
      start: () => {
        startedOscillators += 1;
      },
      stop: () => {},
      onended: null,
    };
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

/** Re-imports the module so each test starts from a clean module-level state. */
async function freshModule(seed?: unknown) {
  vi.resetModules();
  localStorage.clear();
  if (seed !== undefined) localStorage.setItem("agent-monitor-sound", JSON.stringify(seed));
  startedOscillators = 0;
  return import("../sound");
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("AudioContext", FakeAudioContext);
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sound preferences", () => {
  it("defaults to enabled so cues work out of the box", async () => {
    const { getSoundPrefs, DEFAULT_SOUND_PREFS } = await freshModule();
    expect(getSoundPrefs().enabled).toBe(true);
    expect(getSoundPrefs()).toEqual(DEFAULT_SOUND_PREFS);
  });

  it("merges a partial saved object over the defaults", async () => {
    const { getSoundPrefs } = await freshModule({ volume: 0.2 });
    const prefs = getSoundPrefs();
    expect(prefs.volume).toBe(0.2);
    expect(prefs.enabled).toBe(true);
    expect(prefs.onSessionComplete).toBe(true);
  });

  it("falls back to defaults on corrupt storage", async () => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem("agent-monitor-sound", "{not json");
    const { getSoundPrefs } = await import("../sound");
    expect(getSoundPrefs().enabled).toBe(true);
  });

  it("persists updates and clamps the volume into 0-1", async () => {
    const { setSoundPrefs } = await freshModule();
    const next = setSoundPrefs({ enabled: false, volume: 5 });
    expect(next.enabled).toBe(false);
    expect(next.volume).toBe(1);
    expect(JSON.parse(localStorage.getItem("agent-monitor-sound") as string).enabled).toBe(false);
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const { setSoundPrefs, subscribeToSoundPrefs } = await freshModule();
    const seen = vi.fn();
    const unsubscribe = subscribeToSoundPrefs(seen);
    setSoundPrefs({ volume: 0.3 });
    expect(seen).toHaveBeenCalledTimes(1);
    unsubscribe();
    setSoundPrefs({ volume: 0.4 });
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe("playCue", () => {
  it("stays silent until a user gesture unlocks audio", async () => {
    const { playCue } = await freshModule();
    expect(playCue("sessionStart")).toBe(false);
    expect(startedOscillators).toBe(0);
  });

  it("schedules every partial of a cue once unlocked", async () => {
    const { playCue, unlockSound } = await freshModule();
    unlockSound();
    expect(playCue("sessionStart")).toBe(true);
    // The sessionStart cue is a two-note rising fifth.
    expect(startedOscillators).toBe(2);
  });

  it("respects the master switch and a zero volume", async () => {
    const { playCue, unlockSound, setSoundPrefs } = await freshModule();
    unlockSound();
    setSoundPrefs({ enabled: false });
    expect(playCue("sessionStart")).toBe(false);
    setSoundPrefs({ enabled: true, volume: 0 });
    expect(playCue("sessionStart")).toBe(false);
  });

  it("respects the per-cue preference flag", async () => {
    const { playCue, unlockSound, setSoundPrefs } = await freshModule();
    unlockSound();
    setSoundPrefs({ onSubagentSpawn: false });
    expect(playCue("subagentSpawn")).toBe(false);
    setSoundPrefs({ onSubagentSpawn: true });
    expect(playCue("subagentSpawn")).toBe(true);
  });

  it("throttles repeats of the same cue", async () => {
    const { playCue, unlockSound } = await freshModule();
    unlockSound();
    expect(playCue("sessionStart")).toBe(true);
    expect(playCue("sessionStart")).toBe(false);
  });

  it("caps a burst of distinct cues", async () => {
    const { playCue, unlockSound } = await freshModule({
      onConnection: true,
      onSubagentSpawn: true,
    });
    unlockSound();
    const results = [
      playCue("sessionStart"),
      playCue("sessionComplete"),
      playCue("sessionError"),
      playCue("subagentSpawn"),
      playCue("notification"),
      playCue("connected"),
    ];
    expect(results.filter(Boolean)).toHaveLength(4);
  });

  it("keeps the interaction tick out of the shared burst budget", async () => {
    // Regression: `click` used to consume the 4-per-1.2s budget, so a few fast
    // presses could silence a session cue arriving right after them.
    const { playCue, unlockSound } = await freshModule();
    unlockSound();
    for (let i = 0; i < 6; i += 1) {
      // Each tick is allowed by its own 45 ms cooldown once time has moved on.
      vi.setSystemTime(new Date(Date.now() + 60));
      expect(playCue("click")).toBe(true);
    }
    expect(playCue("sessionComplete")).toBe(true);
  });

  it("force bypasses the per-cue flag, the throttle, and the gesture gate", async () => {
    const { playCue } = await freshModule({ onSubagentSpawn: false });
    expect(playCue("subagentSpawn", { force: true })).toBe(true);
    expect(playCue("subagentSpawn", { force: true })).toBe(true);
  });

  it("no-ops without breaking when Web Audio is unavailable", async () => {
    const mod = await freshModule();
    mod.resetSoundEngine();
    vi.unstubAllGlobals();
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
    expect(() => mod.playCue("sessionStart", { force: true })).not.toThrow();
    expect(mod.playCue("sessionStart", { force: true })).toBe(false);
  });
});

describe("installSoundUnlock", () => {
  it("unlocks on the first gesture and cleans up its listeners", async () => {
    const { installSoundUnlock, playCue } = await freshModule();
    const cleanup = installSoundUnlock();
    expect(playCue("sessionStart")).toBe(false);
    window.dispatchEvent(new Event("pointerdown"));
    expect(playCue("sessionStart")).toBe(true);
    expect(() => cleanup()).not.toThrow();
  });
});
