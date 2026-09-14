/**
 * @file paletteDiscovery.ts
 * @description Tracks whether this browser has ever opened the command palette,
 * so the hints that teach `Cmd/Ctrl+K` can delete themselves once they have done
 * their job.
 *
 * The palette is keyboard-only by design — a launcher button beside the sidebar
 * duplicates navigation the sidebar already shows — which leaves it invisible to
 * anyone who has not been told it exists. The answer is not permanent chrome for
 * a fact you learn in one second. It is a hint that appears where the need is
 * felt (the splash on first run, and beside the narrow search field a user is
 * already typing into) and never renders again after the first successful open.
 *
 * State lives in `localStorage`, not `sessionStorage`: discovery is a property of
 * the person, not of the tab. Every access is wrapped — storage throws in private
 * mode and in embedded webviews — and a failure degrades to "not yet discovered",
 * because showing a hint twice is a nuisance while never showing it is the bug
 * this module exists to fix.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ccam-palette-discovered";

/** In-memory mirror so a hint hides the instant the palette opens. */
let discovered = read();
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Has this browser ever opened the palette? */
export function hasDiscoveredPalette(): boolean {
  return discovered;
}

/**
 * Record that the palette has been opened. Idempotent, and safe to call on every
 * open — subscribers are only notified on the transition, so the hints do not
 * re-render for the rest of the session.
 */
export function markPaletteDiscovered(): void {
  if (discovered) return;
  discovered = true;
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // The in-memory flag still hides the hints for this session; the worst case
    // is that they return on the next visit, which is the safe direction.
  }
  listeners.forEach((listener) => listener());
}

/** Subscribe to the one transition this store can make. */
export function subscribeToPaletteDiscovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * True while the `Cmd/Ctrl+K` hints should still be shown.
 *
 * @returns `false` once the palette has been opened, permanently.
 */
export function useShowPaletteHint(): boolean {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToPaletteDiscovery(listener),
    []
  );
  return !useSyncExternalStore(subscribe, hasDiscoveredPalette, () => true);
}

/** Reset discovery. Test-only; nothing in the app un-teaches a shortcut. */
export function resetPaletteDiscovery(): void {
  discovered = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clean up if it was never written */
  }
  listeners.forEach((listener) => listener());
}
