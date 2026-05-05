/**
 * @file useMediaQuery.ts
 * @description React hook that subscribes to a CSS media query and returns
 *   whether it currently matches. SSR-safe (returns `false` when `window` is
 *   unavailable). Used by {@link MobileShell} to switch between mobile and
 *   desktop chrome at runtime.
 */

import { useEffect, useState } from "react";

/**
 * Subscribes to a media query and returns its current match state.
 *
 * Re-renders when the match state changes. Cleans up the listener on unmount
 * or when the query string changes.
 *
 * @param query - A CSS media query, e.g. `"(max-width: 768px)"`.
 * @returns `true` if the media query currently matches, otherwise `false`.
 */
export function useMediaQuery(query: string): boolean {
  const get = () =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches;

  const [matches, setMatches] = useState<boolean>(get);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync state in case the query changed since initial render.
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, [query]);

  return matches;
}

/**
 * Shared mobile breakpoint used across the mobile shell. Matches viewports up
 * to 768px wide (typical phone + small tablet portrait).
 */
export const MOBILE_BREAKPOINT = "(max-width: 768px)";
