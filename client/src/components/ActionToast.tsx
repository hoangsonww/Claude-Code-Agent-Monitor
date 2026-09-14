/**
 * @file ActionToast.tsx
 * @description Brief confirmation for commands that change something without
 * moving the user.
 *
 * A palette command that toggles sound, copies a link, or clears the recent
 * list closes the palette and then visibly does nothing — which reads as a
 * broken command even when it worked. Navigation confirms itself by changing
 * the page; everything else needs to say so, and this is that.
 *
 * Deliberately minimal: one message at a time (a launcher fires one command at
 * a time), no queue, no dismiss button. It is `role="status"` with
 * `aria-live="polite"`, so the same confirmation reaches screen readers without
 * interrupting whatever they were reading.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ACTION_TOAST_EVENT } from "../lib/appEvents";

/** Long enough to read a short phrase, short enough not to linger. */
const TOAST_MS = 2200;

/** Renders the most recent action confirmation. Mounted once by `Layout`. */
export function ActionToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail !== "string" || !detail) return;
      setMessage(detail);
      // Restart the clock on a second action rather than letting the first
      // one's timer cut the new message short.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), TOAST_MS);
    };
    window.addEventListener(ACTION_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(ACTION_TOAST_EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 animate-fade-in"
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1/95 px-3.5 py-2 shadow-xl shadow-black/40 backdrop-blur">
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" aria-hidden="true" />
        <span className="text-xs text-gray-200">{message}</span>
      </div>
    </div>
  );
}
