/**
 * @file ShortcutProvider.tsx
 * @description Owns every global key binding in the dashboard: it listens once,
 * resolves the press against {@link SHORTCUTS}, and dispatches to whichever
 * handler is currently registered for that id. It also drives the two surfaces
 * that make the shortcut layer discoverable — the hold-⌘/Ctrl hint reveal and
 * the `?` help overlay.
 *
 * ## Why one listener
 * Every component adding its own `window.addEventListener("keydown")` meant no
 * component could know what the others had claimed, no surface could enumerate
 * the bindings, and page shortcuts kept firing after the page unmounted. A single
 * dispatcher fixes all three: registration is scoped to a mount, the registry is
 * introspectable, and precedence is explicit (the most recently mounted handler
 * for an id wins, and unmounting restores the one beneath it).
 *
 * ## Handler precedence
 * `register()` pushes onto a per-id stack. The provider itself pushes the app-wide
 * defaults (navigation, sidebar, palette, help); a page that mounts later shadows
 * them for the ids it cares about — that is how `r` means "reload analytics" on
 * `/analytics` and "reload sessions" on `/sessions` without either page knowing
 * about the other.
 *
 * ## Hold-to-reveal
 * Holding the primary modifier alone for {@link HINT_REVEAL_DELAY_MS} reveals the
 * hint layer. Any other key press, releasing the modifier, losing window focus,
 * or hiding the tab cancels it, so `⌘C` never flashes the overlay on its way
 * through. The gesture is a reveal, not a modifier: the hints it shows are the
 * real chords, most of which need no modifier at all.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BINDABLE_SHORTCUTS,
  HINT_REVEAL_DELAY_MS,
  SEQUENCE_TIMEOUT_MS,
  isEditableTarget,
  matchesChord,
} from "../lib/shortcuts";

/** A bound action. Returning `false` declines the press, letting it fall through. */
export type ShortcutHandler = () => void | boolean;

interface ShortcutContextValue {
  /** True while the hold-to-reveal gesture is showing hint badges. */
  hintsVisible: boolean;
  /** Ids that currently have a handler, so hints only advertise live bindings. */
  boundIds: ReadonlySet<string>;
  /** The prefix key of a sequence awaiting its second press (`"g"`), else null. */
  pendingPrefix: string | null;
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  /**
   * Register a handler for `id` for the lifetime of the caller's mount.
   * `base` puts it at the bottom of the stack, so anything registered later
   * shadows it — that is how the provider's own defaults stay overridable.
   */
  register: (id: string, handler: ShortcutHandler, options?: { base?: boolean }) => () => void;
  /** Fire a shortcut programmatically (used by the palette). */
  run: (id: string) => boolean;
  /**
   * Hold the hint layer back while a modal owns the screen. Reference-counted,
   * so two overlapping modals cannot leave it stuck off.
   */
  suppressHints: (suppressed: boolean) => void;
}

const noopUnregister = () => {};

const ShortcutContext = createContext<ShortcutContextValue>({
  hintsVisible: false,
  boundIds: new Set(),
  pendingPrefix: null,
  helpOpen: false,
  openHelp: () => {},
  closeHelp: () => {},
  register: () => noopUnregister,
  run: () => false,
  suppressHints: () => {},
});

/** Access the shortcut registry. Safe outside the provider (inert defaults). */
export function useShortcuts(): ShortcutContextValue {
  return useContext(ShortcutContext);
}

/**
 * Bind `handler` to `id` while the calling component is mounted.
 *
 * The handler is stored in a ref and re-read on every press, so callers may pass
 * an inline closure without re-registering on each render — registering in an
 * effect keyed on the handler identity would tear the stack down and rebuild it
 * constantly, silently changing precedence.
 */
export function useShortcutHandler(
  id: string,
  handler: ShortcutHandler | null | undefined,
  enabled = true
): void {
  const { register } = useShortcuts();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !handler) return;
    return register(id, () => handlerRef.current?.());
    // `handler` is intentionally excluded: identity changes must not re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, register, !!handler]);
}

/** True while the hold-to-reveal gesture is active. */
export function useShortcutHintsVisible(): boolean {
  return useShortcuts().hintsVisible;
}

/**
 * Suppress the hint layer while `active` — for modals that already cover the
 * chrome the hints annotate. Without this, holding ⌘ over an open palette paints
 * badges on controls the user cannot see or reach.
 */
export function useSuppressShortcutHints(active: boolean): void {
  const { suppressHints } = useShortcuts();
  useEffect(() => {
    if (!active) return;
    suppressHints(true);
    return () => suppressHints(false);
  }, [active, suppressHints]);
}

interface ShortcutProviderProps {
  children: ReactNode;
}

/**
 * Mounts the single global key listener. Place it inside the router so the
 * default navigation handlers registered by {@link Layout} can call `navigate`.
 */
export function ShortcutProvider({ children }: ShortcutProviderProps) {
  const [hintsVisible, setHintsVisible] = useState(false);
  const [hintSuppressors, setHintSuppressors] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);
  const [boundIds, setBoundIds] = useState<ReadonlySet<string>>(() => new Set());

  const handlersRef = useRef<Map<string, ShortcutHandler[]>>(new Map());
  const sequenceRef = useRef<{ chordKey: string; at: number } | null>(null);
  const sequenceTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdingRef = useRef(false);

  const syncBoundIds = useCallback(() => {
    setBoundIds(new Set(handlersRef.current.keys()));
  }, []);

  const register = useCallback(
    (id: string, handler: ShortcutHandler, options?: { base?: boolean }) => {
      const stack = handlersRef.current.get(id) ?? [];
      if (options?.base) stack.unshift(handler);
      else stack.push(handler);
      handlersRef.current.set(id, stack);
      syncBoundIds();
      return () => {
        const current = handlersRef.current.get(id);
        if (!current) return;
        const index = current.lastIndexOf(handler);
        if (index >= 0) current.splice(index, 1);
        if (current.length === 0) handlersRef.current.delete(id);
        syncBoundIds();
      };
    },
    [syncBoundIds]
  );

  /** Run the topmost handler for `id`; walk down the stack if it declines. */
  const run = useCallback((id: string): boolean => {
    const stack = handlersRef.current.get(id);
    if (!stack || stack.length === 0) return false;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i]?.() !== false) return true;
    }
    return false;
  }, []);

  const suppressHints = useCallback((suppressed: boolean) => {
    setHintSuppressors((count) => Math.max(0, count + (suppressed ? 1 : -1)));
  }, []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const clearSequence = useCallback(() => {
    sequenceRef.current = null;
    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
    setPendingPrefix(null);
  }, []);

  const cancelHold = useCallback(() => {
    holdingRef.current = false;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHintsVisible(false);
  }, []);

  // ── Hold-to-reveal ────────────────────────────────────────────────────────
  useEffect(() => {
    const isPrimaryModifier = (key: string) => key === "Meta" || key === "Control";

    const onKeyDown = (e: KeyboardEvent) => {
      if (isPrimaryModifier(e.key)) {
        // `keydown` repeats while a modifier is held on some platforms; only the
        // first press should start the clock, or the timer never elapses.
        if (holdingRef.current || e.repeat) return;
        holdingRef.current = true;
        holdTimerRef.current = window.setTimeout(() => {
          // Still held, still alone — reveal.
          if (holdingRef.current) setHintsVisible(true);
        }, HINT_REVEAL_DELAY_MS);
        return;
      }
      // Any real key while holding means the user is running a combo, not asking
      // for hints. Cancel immediately so ⌘C never flashes the layer.
      cancelHold();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isPrimaryModifier(e.key)) cancelHold();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", cancelHold);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", cancelHold);
      cancelHold();
    };
  }, [cancelHold]);

  // ── Dispatch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Composition (IME) turns every keystroke into candidate-selection input.
      // `keyCode === 229` is the cross-browser tell that survives `isComposing`
      // being unset in older WebKit.
      if (e.isComposing || e.keyCode === 229) return;
      if (e.defaultPrevented) return;

      const typing = isEditableTarget(e.target);
      const pending = sequenceRef.current;

      // Second key of a sequence.
      if (pending && !typing) {
        const chordKey = pending.chordKey;
        const candidates = BINDABLE_SHORTCUTS.filter(
          (def) => def.sequence.length === 2 && def.sequence[0]?.key.toLowerCase() === chordKey
        );
        clearSequence();
        for (const def of candidates) {
          const second = def.sequence[1];
          if (second && matchesChord(e, second)) {
            if (run(def.id)) {
              e.preventDefault();
              return;
            }
          }
        }
        // An unmatched second key falls through to normal handling below, so
        // `g` then `?` still opens help rather than being swallowed.
      }

      for (const def of BINDABLE_SHORTCUTS) {
        const first = def.sequence[0];
        if (!first) continue;
        if (typing && !def.allowInInput) continue;
        if (!matchesChord(e, first)) continue;

        if (def.sequence.length > 1) {
          // Start a sequence only if something is listening for a completion.
          e.preventDefault();
          sequenceRef.current = { chordKey: first.key.toLowerCase(), at: Date.now() };
          setPendingPrefix(first.key.toLowerCase());
          sequenceTimerRef.current = window.setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
          return;
        }

        if (run(def.id)) {
          e.preventDefault();
          return;
        }
        // No handler bound: let the browser have the key rather than eating it.
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSequence, run]);

  // Built-in: `?` toggles the overlay. Registered as a base handler so a surface
  // that legitimately needs `?` (a future text-heavy view) can shadow it, while
  // every page that does not gets the cheat sheet for free.
  useEffect(
    () => register("help.open", () => setHelpOpen((prev) => !prev), { base: true }),
    [register]
  );

  useEffect(
    () => () => {
      if (sequenceTimerRef.current !== null) window.clearTimeout(sequenceTimerRef.current);
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    },
    []
  );

  const value = useMemo<ShortcutContextValue>(
    () => ({
      hintsVisible: hintsVisible && hintSuppressors === 0,
      boundIds,
      pendingPrefix,
      helpOpen,
      openHelp,
      closeHelp,
      register,
      run,
      suppressHints,
    }),
    [
      hintsVisible,
      hintSuppressors,
      boundIds,
      pendingPrefix,
      helpOpen,
      openHelp,
      closeHelp,
      register,
      run,
      suppressHints,
    ]
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
}
