/**
 * @file useDocumentTitle.ts
 * @description Sets `document.title` for the current route/page and restores the
 * previous title on unmount so browser tabs stay distinguishable.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect } from "react";

const APP_SUFFIX = "Claude Code Agent Monitor";

/**
 * Update the browser tab title while this component is mounted.
 * @param title Page-specific title segment (without the app suffix), or null to skip.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ${APP_SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
