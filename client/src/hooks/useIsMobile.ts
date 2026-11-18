/**
 * @file useIsMobile.ts
 * @description True while the viewport is phone-sized (below 768px). Used by the layout (sidebar
 * drawer) and by pages that switch dense tables to card lists on phones. Without matchMedia (tests,
 * old browsers) it reports false, so the desktop layout is the default.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";

/** Phone-width breakpoint. */
export const MOBILE_QUERY = "(max-width: 767px)";

/** Whether the viewport currently matches {@link MOBILE_QUERY}. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE_QUERY);
    if (!mq) return;
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return mobile;
}
