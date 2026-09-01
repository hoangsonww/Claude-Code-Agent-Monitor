/**
 * @file usePageShortcuts.ts
 * @description Keeps a page's tab or filter selection in the URL.
 *
 * This is what lets the command palette address a page's interior — a Settings
 * section, an Analytics tab, the active-session filter — and what makes those
 * links shareable. Without it the palette could only ever reach a page, never a
 * view inside it.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback } from "react";
import { useSearchParams } from "react-router";

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
