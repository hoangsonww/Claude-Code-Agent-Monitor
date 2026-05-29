/**
 * @file prefs.ts
 * @description Tiny localStorage-backed preference store for Tabby (enabled +
 *   muted). Broadcasts changes via a window CustomEvent so the Settings toggle
 *   and the live widget stay in sync within the same tab without a reload.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const ENABLED_KEY = "agent-dashboard-tabby-enabled";
const MUTED_KEY = "agent-dashboard-tabby-muted";
const POS_KEY = "agent-dashboard-tabby-pos";
const EVENT = "tabby:prefs";

/**
 * Persisted resting position, AssistiveTouch-style: the widget always docks to
 * the left or right edge, remembering its vertical offset. `y` is stored as a
 * fraction of the viewport height (0–1) so it survives window resizes.
 */
export interface TabbyPos {
  side: "left" | "right";
  y: number;
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures (private mode, quota) — prefs are best-effort.
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // SSR / non-DOM contexts: nothing to notify.
  }
}

function readPos(): TabbyPos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<TabbyPos>;
    if ((p.side === "left" || p.side === "right") && typeof p.y === "number") {
      return { side: p.side, y: Math.min(1, Math.max(0, p.y)) };
    }
    return null;
  } catch {
    return null;
  }
}

function writePos(pos: TabbyPos): void {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    // Ignore storage failures — position is best-effort.
  }
  // Note: intentionally does NOT dispatch the prefs event — position changes
  // are local to the widget and shouldn't churn the Settings toggle listeners.
}

export const tabbyPrefs = {
  getEnabled: () => readBool(ENABLED_KEY, true),
  setEnabled: (v: boolean) => writeBool(ENABLED_KEY, v),
  getMuted: () => readBool(MUTED_KEY, false),
  setMuted: (v: boolean) => writeBool(MUTED_KEY, v),
  getPos: readPos,
  setPos: writePos,
  /** Subscribe to any pref change; returns an unsubscribe fn. */
  subscribe(handler: () => void): () => void {
    const listener = () => handler();
    window.addEventListener(EVENT, listener);
    // Also react to changes from other tabs.
    window.addEventListener("storage", listener);
    return () => {
      window.removeEventListener(EVENT, listener);
      window.removeEventListener("storage", listener);
    };
  },
};
