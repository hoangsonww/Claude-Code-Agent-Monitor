/**
 * @file PaletteActionProvider.tsx
 * @description Registry of the actions a mounted page offers to the command
 * palette.
 *
 * This is not a keyboard layer. The dashboard binds exactly one chord — ⌘/Ctrl+K
 * to open the palette (plus Tabby's pre-existing ⌘/Ctrl+B) — and everything else
 * is reached by opening the palette and typing. What this provider does is let a
 * page say "while I am on screen, these commands exist", so the palette can list
 * page-specific work like *Pause the live stream* or *Copy this session's id*.
 *
 * ## Why it exists at all
 * The palette originally listed a fixed set of quick actions on every page and
 * wired them on none: "Show active sessions" navigated to /sessions and applied
 * no filter. A launcher that offers commands it cannot run teaches you to stop
 * trusting it. Registration inverts that — the palette reads {@link boundIds},
 * so an action whose page is not mounted is not offered at all, and it is
 * impossible to ship a row that does nothing.
 *
 * ## Precedence
 * `register` pushes onto a per-id stack, so the most recently mounted handler
 * wins and unmounting restores the one beneath it. That is what lets every page
 * register `page.refresh` under its own reload without any of them knowing about
 * the others.
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

/** A registered action. Returning `false` declines, so the stack falls through. */
export type PaletteActionHandler = () => void | boolean;

interface PaletteActionContextValue {
  /** Ids with at least one live handler, so the palette lists only real work. */
  boundIds: ReadonlySet<string>;
  /** Register a handler for `id` for the lifetime of the caller's mount. */
  register: (id: string, handler: PaletteActionHandler) => () => void;
  /** Run the topmost handler for `id`; walks down the stack if one declines. */
  run: (id: string) => boolean;
}

const noopUnregister = () => {};

const PaletteActionContext = createContext<PaletteActionContextValue>({
  boundIds: new Set(),
  register: () => noopUnregister,
  run: () => false,
});

/** Access the action registry. Safe outside the provider (inert defaults). */
export function usePaletteActions(): PaletteActionContextValue {
  return useContext(PaletteActionContext);
}

/**
 * Offer `id` as a palette command while the calling component is mounted.
 *
 * The handler is stored in a ref and re-read on every run, so callers may pass an
 * inline closure without re-registering each render — re-registering on identity
 * change would tear the stack down and rebuild it constantly, silently changing
 * precedence.
 *
 * @param id      Must match an entry in `PAGE_ACTION_COMMANDS`, which supplies
 *                the label and icon the palette renders.
 * @param handler What running the command does. Return `false` to decline (for
 *                example when the datum it would copy has not loaded yet).
 */
export function usePaletteAction(
  id: string,
  handler: PaletteActionHandler | null | undefined,
  enabled = true
): void {
  const { register } = usePaletteActions();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled || !handler) return;
    return register(id, () => handlerRef.current?.());
    // `handler` is intentionally excluded: identity changes must not re-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, enabled, register, !!handler]);
}

/** Mounts the registry. Place it above the palette and every routed page. */
export function PaletteActionProvider({ children }: { children: ReactNode }) {
  const [boundIds, setBoundIds] = useState<ReadonlySet<string>>(() => new Set());
  const handlersRef = useRef<Map<string, PaletteActionHandler[]>>(new Map());

  const syncBoundIds = useCallback(() => {
    setBoundIds(new Set(handlersRef.current.keys()));
  }, []);

  const register = useCallback(
    (id: string, handler: PaletteActionHandler) => {
      const stack = handlersRef.current.get(id) ?? [];
      stack.push(handler);
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

  const run = useCallback((id: string): boolean => {
    const stack = handlersRef.current.get(id);
    if (!stack || stack.length === 0) return false;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i]?.() !== false) return true;
    }
    return false;
  }, []);

  const value = useMemo<PaletteActionContextValue>(
    () => ({ boundIds, register, run }),
    [boundIds, register, run]
  );

  return <PaletteActionContext.Provider value={value}>{children}</PaletteActionContext.Provider>;
}
