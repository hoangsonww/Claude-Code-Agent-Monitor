/**
 * @file sound.ts
 * @description Dependency-free audio-cue engine for the dashboard. Every cue is
 * synthesized at play time with the Web Audio API (oscillators + gain
 * envelopes) so the app ships no audio assets and pulls in no third-party
 * library. Owns the user's sound preferences (persisted to `localStorage`,
 * enabled by default), a shared `AudioContext` that is unlocked on the first
 * user gesture to satisfy browser autoplay policies, and the rate limiting that
 * keeps bursty WebSocket traffic from turning into a stream of beeps.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** `localStorage` key holding the serialized {@link SoundPrefs}. */
const SOUND_KEY = "agent-monitor-sound";
/** `window` event dispatched whenever preferences change, so the Settings page
 *  and the {@link useSoundCues} hook stay in sync without prop drilling. */
const PREFS_EVENT = "sound:prefs";

/** Names of every cue the dashboard can play. */
export type CueName =
  | "sessionStart"
  | "sessionComplete"
  | "sessionError"
  | "subagentSpawn"
  | "notification"
  | "connected"
  | "disconnected"
  | "click";

/**
 * User's audio-cue preferences. The master `enabled` switch gates everything;
 * the per-cue flags below only matter while it is on.
 */
export interface SoundPrefs {
  /** Master switch. Defaults to `true` - audio cues are on out of the box. */
  enabled: boolean;
  /** Output level, 0-1, applied to the master gain node. */
  volume: number;
  /** Chime when a new session appears. */
  onSessionStart: boolean;
  /** Chime when a session finishes responding or closes. */
  onSessionComplete: boolean;
  /** Chime when a session enters the error state. */
  onSessionError: boolean;
  /** Chime when a subagent spawns. */
  onSubagentSpawn: boolean;
  /** Chime on `Notification` events emitted by Claude Code. */
  onNotification: boolean;
  /** Chime when the dashboard WebSocket connects or drops. */
  onConnection: boolean;
  /** Very quiet tick on button / link / tab activation. */
  onInteraction: boolean;
}

/** Shipping defaults: sound on, at a deliberately conservative volume. */
export const DEFAULT_SOUND_PREFS: SoundPrefs = {
  enabled: true,
  volume: 0.5,
  onSessionStart: true,
  onSessionComplete: true,
  onSessionError: true,
  onSubagentSpawn: false,
  onNotification: true,
  onConnection: false,
  onInteraction: true,
};

/** The per-cue boolean flags in {@link SoundPrefs}, excluding the master switch
 *  and the numeric volume - so a cue can never be gated on a non-boolean. */
type CueFlag = Exclude<keyof SoundPrefs, "enabled" | "volume">;

/** Maps a cue to the preference flag that gates it (master switch aside). */
const CUE_PREF: Record<CueName, CueFlag> = {
  sessionStart: "onSessionStart",
  sessionComplete: "onSessionComplete",
  sessionError: "onSessionError",
  subagentSpawn: "onSubagentSpawn",
  notification: "onNotification",
  connected: "onConnection",
  disconnected: "onConnection",
  click: "onInteraction",
};

// ─── Preference storage ───

let cached: SoundPrefs | null = null;

/**
 * Reads preferences from `localStorage`, merging over {@link DEFAULT_SOUND_PREFS}
 * so partial or older saved objects still yield a complete, valid result.
 * The result is memoized; {@link setSoundPrefs} invalidates the cache.
 */
export function getSoundPrefs(): SoundPrefs {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SoundPrefs>) : {};
    cached = { ...DEFAULT_SOUND_PREFS, ...parsed };
  } catch {
    cached = { ...DEFAULT_SOUND_PREFS };
  }
  cached.volume = clamp(cached.volume, 0, 1);
  return cached;
}

/**
 * Merges `patch` into the stored preferences, persists the result, and notifies
 * subscribers. Storage failures (private mode, quota) are swallowed - prefs are
 * best-effort and the in-memory cache still reflects the change for this tab.
 * @param patch Partial preferences to apply over the current values.
 * @returns The full, updated preference object.
 */
export function setSoundPrefs(patch: Partial<SoundPrefs>): SoundPrefs {
  const next: SoundPrefs = { ...getSoundPrefs(), ...patch };
  next.volume = clamp(next.volume, 0, 1);
  cached = next;
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures - preferences remain applied for this session.
  }
  if (master) master.gain.value = next.volume;
  try {
    window.dispatchEvent(new CustomEvent(PREFS_EVENT));
  } catch {
    // Non-DOM context: nothing to notify.
  }
  return next;
}

/**
 * Subscribes to preference changes made anywhere in this tab.
 * @param handler Invoked (with no arguments) after every {@link setSoundPrefs}.
 * @returns An unsubscribe function.
 */
export function subscribeToSoundPrefs(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(PREFS_EVENT, listener);
  return () => window.removeEventListener(PREFS_EVENT, listener);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

// ─── Cue definitions ───

/** One synthesized partial within a cue. */
interface Note {
  /** Frequency in Hz. */
  freq: number;
  /** Offset from the start of the cue, in seconds. */
  at: number;
  /** Total duration including the decay tail, in seconds. */
  dur: number;
  /** Peak gain before the master volume is applied. Kept low on purpose. */
  gain: number;
  /** Oscillator shape; sine reads as "soft", triangle adds a little body. */
  type?: OscillatorType;
}

// Frequencies are equal-temperament pitches. Cues stay inside a C-major
// pentatonic-ish set so overlapping tails never sound dissonant, and every
// envelope decays exponentially to avoid the click of a hard cutoff.
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const E6 = 1318.51;
const G4 = 392.0;
const Bb4 = 466.16;

/** The synthesis recipe for every cue, as a list of scheduled partials. */
const CUES: Record<CueName, Note[]> = {
  // Rising fifth - "something just started".
  sessionStart: [
    { freq: C5, at: 0, dur: 0.14, gain: 0.075 },
    { freq: G5, at: 0.07, dur: 0.18, gain: 0.065 },
  ],
  // Resolving major arpeggio - "that finished cleanly".
  sessionComplete: [
    { freq: E5, at: 0, dur: 0.14, gain: 0.06 },
    { freq: G5, at: 0.065, dur: 0.16, gain: 0.06 },
    { freq: C6, at: 0.13, dur: 0.32, gain: 0.07 },
  ],
  // Falling minor third on a triangle wave - noticeable but not alarming.
  sessionError: [
    { freq: Bb4, at: 0, dur: 0.18, gain: 0.07, type: "triangle" },
    { freq: G4, at: 0.1, dur: 0.34, gain: 0.075, type: "triangle" },
  ],
  // Single short pluck - background activity, easy to ignore.
  subagentSpawn: [{ freq: A5, at: 0, dur: 0.12, gain: 0.045, type: "triangle" }],
  // Detuned pair rings like a small bell; the beat between them is the shimmer.
  notification: [
    { freq: E6, at: 0, dur: 0.5, gain: 0.05 },
    { freq: E6 * 1.004, at: 0, dur: 0.6, gain: 0.035 },
    { freq: C6, at: 0.0, dur: 0.3, gain: 0.03 },
  ],
  // Two-note lift / drop for the live-connection badge.
  connected: [
    { freq: C5, at: 0, dur: 0.1, gain: 0.045 },
    { freq: E5, at: 0.055, dur: 0.16, gain: 0.045 },
  ],
  disconnected: [
    { freq: E5, at: 0, dur: 0.1, gain: 0.045 },
    { freq: C5, at: 0.055, dur: 0.2, gain: 0.05, type: "triangle" },
  ],
  // Barely-there tick for pointer interactions.
  click: [{ freq: D5 * 2, at: 0, dur: 0.035, gain: 0.022 }],
};

/** Minimum gap between two plays of the same cue, in milliseconds. */
const COOLDOWN_MS: Partial<Record<CueName, number>> = {
  click: 45,
  subagentSpawn: 400,
};
/** Default per-cue cooldown when the map above has no entry. */
const DEFAULT_COOLDOWN_MS = 350;
/** Cues exempt from the shared burst budget. The budget exists to absorb bursty
 *  WebSocket traffic; user-driven ticks are not that traffic, and letting a few
 *  fast clicks fill the window would silence a session cue arriving right after. */
const BUDGET_EXEMPT: ReadonlySet<CueName> = new Set<CueName>(["click"]);

// ─── Audio graph ───

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Set once a user gesture has been observed; before that, browsers refuse to
 *  start an `AudioContext` and every cue is a silent no-op. */
let unlocked = false;

/** Lazily builds the shared context and the master gain -> lowpass -> output
 *  chain. The lowpass rounds off harsh upper harmonics so cues sit behind the
 *  user's work rather than cutting through it. Returns null when Web Audio is
 *  unavailable (older browsers, jsdom without a stub). */
function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = getSoundPrefs().volume;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 5200;
    gain.connect(filter);
    filter.connect(ctx.destination);
    master = gain;
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
}

/**
 * Marks audio as user-activated and resumes a suspended context. Browsers only
 * allow playback after a gesture, so {@link installSoundUnlock} calls this from
 * the first pointer/key/touch event.
 */
export function unlockSound(): void {
  unlocked = true;
  const audio = ensureContext();
  if (audio && audio.state === "suspended") audio.resume().catch(() => {});
}

/**
 * Registers one-shot listeners that call {@link unlockSound} on the first user
 * gesture in the page.
 * @returns A cleanup function that removes any listeners still attached.
 */
export function installSoundUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
  const handler = () => {
    unlockSound();
    events.forEach((e) => window.removeEventListener(e, handler));
  };
  events.forEach((e) => window.addEventListener(e, handler, { once: true, passive: true }));
  return () => events.forEach((e) => window.removeEventListener(e, handler));
}

// ─── Rate limiting ───

const lastPlayed = new Map<CueName, number>();
/** Timestamps of recent plays, used for the global burst budget. */
let recent: number[] = [];
/** At most this many cues may start within {@link BURST_WINDOW_MS}. */
const BURST_LIMIT = 4;
const BURST_WINDOW_MS = 1200;

/** Returns true when `cue` is allowed to play right now, recording the play if
 *  so. Guards against both a single event type repeating (per-cue cooldown) and
 *  an import or reconnect replaying hundreds of messages (burst budget). */
function allow(cue: CueName, now: number): boolean {
  const cooldown = COOLDOWN_MS[cue] ?? DEFAULT_COOLDOWN_MS;
  const last = lastPlayed.get(cue);
  if (last !== undefined && now - last < cooldown) return false;

  // Exempt cues keep their own cooldown but never consume the shared budget.
  if (BUDGET_EXEMPT.has(cue)) {
    lastPlayed.set(cue, now);
    return true;
  }

  recent = recent.filter((t) => now - t < BURST_WINDOW_MS);
  if (recent.length >= BURST_LIMIT) return false;

  lastPlayed.set(cue, now);
  recent.push(now);
  return true;
}

/** Clears rate-limiter state. Exported for tests only. */
export function resetSoundThrottle(): void {
  lastPlayed.clear();
  recent = [];
}

// ─── Playback ───

/**
 * Plays a cue, subject to the user's preferences and the rate limiter. Safe to
 * call from anywhere and at any frequency: it silently no-ops when sound is
 * disabled, when the cue's own toggle is off, before the first user gesture,
 * when Web Audio is unavailable, or when the cue is being throttled.
 * @param cue Which cue to play.
 * @param options.force Bypass the per-cue preference flag and the rate limiter.
 *   Used by the Settings preview buttons, which are themselves a user gesture.
 * @returns `true` if audio was actually scheduled.
 */
export function playCue(cue: CueName, options?: { force?: boolean }): boolean {
  const force = options?.force ?? false;
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.volume <= 0) return false;
  if (!force && !prefs[CUE_PREF[cue]]) return false;
  if (force) unlockSound();
  if (!unlocked) return false;
  if (!force && !allow(cue, Date.now())) return false;

  const audio = ensureContext();
  if (!audio || !master) return false;
  if (audio.state === "suspended") audio.resume().catch(() => {});

  const start = audio.currentTime + 0.005;
  for (const note of CUES[cue]) {
    try {
      const osc = audio.createOscillator();
      const env = audio.createGain();
      osc.type = note.type ?? "sine";
      osc.frequency.value = note.freq;

      // 6 ms attack avoids the pop of starting at full gain; the exponential
      // ramp to a near-zero floor gives a natural decay tail.
      const t0 = start + note.at;
      const peak = t0 + 0.006;
      const end = t0 + note.dur;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(note.gain, peak);
      env.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(env);
      env.connect(master);
      osc.start(t0);
      osc.stop(end + 0.02);
      osc.onended = () => {
        try {
          osc.disconnect();
          env.disconnect();
        } catch {
          // Node already torn down with the context.
        }
      };
    } catch {
      // A failed partial should never break the rest of the cue.
    }
  }
  return true;
}

/** Test seam: drops the cached context so a suite can start from scratch. */
export function resetSoundEngine(): void {
  try {
    ctx?.close();
  } catch {
    // Closing an already-closed context is harmless.
  }
  ctx = null;
  master = null;
  unlocked = false;
  cached = null;
  resetSoundThrottle();
}
