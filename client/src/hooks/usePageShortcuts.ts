/**
 * @file usePageShortcuts.ts
 * @description Page-level shortcut helpers. Every page binds the same small set
 * of actions — reload this page's data, focus its search field, move between its
 * tabs — so the bindings live here once instead of being re-derived (and
 * re-diverged) on each page.
 *
 * Handlers registered by a page shadow the shell's defaults for as long as the
 * page is mounted, which is what makes `r` mean "reload analytics" on
 * `/analytics` and "reload sessions" on `/sessions` without either page knowing
 * the other exists.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, type RefObject } from "react";
import { useSearchParams } from "react-router";
import { useShortcutHandler, useShortcuts } from "../components/ShortcutProvider";

/** Bind `r` to this page's data reload. */
export function useRefreshShortcut(reload: (() => void) | undefined): void {
  useShortcutHandler("page.refresh", reload ?? null, Boolean(reload));
}

/**
 * Bind `/` to focusing this page's search field.
 *
 * Selects any existing text so the key acts as "start a new search" rather than
 * appending to the last one, and returns `false` when the field is not mounted
 * so the shell's fallback (open the palette) still runs.
 */
export function useSearchShortcut(ref: RefObject<HTMLInputElement | null>): void {
  useShortcutHandler("page.search", () => {
    const input = ref.current;
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  });
}

/**
 * Bind `[` / `]` and `1`…`9` to this page's tab strip.
 *
 * @param tabs      Tab keys in the order they are rendered.
 * @param active    The current tab.
 * @param setActive Selects a tab.
 */
export function useTabShortcuts<T extends string>(
  tabs: readonly T[],
  active: T,
  setActive: (tab: T) => void
): void {
  const { register } = useShortcuts();

  useEffect(() => {
    const step = (delta: number) => () => {
      if (tabs.length === 0) return false;
      const index = tabs.indexOf(active);
      // Wrap, so `]` from the last tab lands on the first rather than dead-ending.
      const next = tabs[((index < 0 ? 0 : index) + delta + tabs.length) % tabs.length];
      if (next === undefined) return false;
      setActive(next);
      return true;
    };

    const offs = [register("tab.prev", step(-1)), register("tab.next", step(1))];
    // Only bind digits that address a real tab: an unbound digit falls through
    // to the browser instead of being silently swallowed.
    tabs.slice(0, 9).forEach((tab, index) => {
      offs.push(register(`tab.${index + 1}`, () => setActive(tab)));
    });
    return () => offs.forEach((off) => off());
  }, [register, tabs, active, setActive]);
}

/**
 * Keep a tab selection in the URL so the palette (and any bookmark, or a link a
 * user pastes to a colleague) can address a page's sub-view directly.
 *
 * The URL is the source of truth when it carries a valid value; otherwise the
 * optional `storageKey` restores the last choice, and finally `fallback` applies.
 * Selections replace the history entry rather than pushing one — flipping
 * between two tabs should not make Back mean "the tab I was just on".
 *
 * @param valid      Every accepted value; anything else in the URL is ignored.
 * @param fallback   Used when neither the URL nor storage has a valid value.
 * @param options.param      Query parameter name (default `tab`).
 * @param options.storageKey `localStorage` key to mirror the choice into.
 */
export function useUrlTab<T extends string>(
  valid: readonly T[],
  fallback: T,
  options: { param?: string; storageKey?: string } = {}
): [T, (tab: T) => void] {
  const { param = "tab", storageKey } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const fromUrl = searchParams.get(param);
  const stored = (() => {
    if (!storageKey) return null;
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  })();

  const isValid = (value: string | null): value is T =>
    value !== null && (valid as readonly string[]).includes(value);

  const active: T = isValid(fromUrl) ? fromUrl : isValid(stored) ? stored : fallback;

  const setActive = useCallback(
    (tab: T) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, tab);
        } catch {
          /* preference persistence is best-effort */
        }
      }
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          // An empty value is a page's "no filter" pseudo-option; writing
          // `?status=` for it would leave a meaningless parameter in every
          // link the user copies.
          if (tab === "") next.delete(param);
          else next.set(param, tab);
          return next;
        },
        { replace: true }
      );
    },
    [param, storageKey, setSearchParams]
  );

  return [active, setActive];
}
