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
