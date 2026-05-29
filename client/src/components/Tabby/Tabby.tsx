/**
 * @file Tabby.tsx
 * @description Floating cat companion shell. Mounts once (next to UpdateNotifier
 *   in Layout) so it persists across routes and shares the single WebSocket.
 *   Owns the open/closed panel state, the ⌘B / Esc shortcuts, reduced-motion
 *   detection, and route navigation. Reactive personality + status/Ask come
 *   from useTabbyBrain; rendering is delegated to CatAvatar/SpeechBubble/Panel.
 *
 *   The "do the job" path reuses the existing Run page: unmatched Ask queries
 *   deep-link to /run?prompt=… — no new LLM backend.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CatAvatar } from "./CatAvatar";
import { SpeechBubble } from "./SpeechBubble";
import { TabbyPanel } from "./TabbyPanel";
import { useTabbyBrain } from "./useTabbyBrain";
import { useTabbyPosition } from "./useTabbyPosition";
import { matchIntent } from "./intents";
import { tabbyPrefs } from "./prefs";
import "./tabby.css";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export function Tabby() {
  const [enabled, setEnabled] = useState(() => tabbyPrefs.getEnabled());
  const [open, setOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const navigate = useNavigate();
  const brain = useTabbyBrain();
  const place = useTabbyPosition();

  // Keep enabled in sync with Settings / other tabs.
  useEffect(() => tabbyPrefs.subscribe(() => setEnabled(tabbyPrefs.getEnabled())), []);

  // ⌘B / Ctrl+B toggles the panel; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNavigate = useCallback(
    (route: string) => {
      navigate(route);
      setOpen(false);
    },
    [navigate]
  );

  const onAsk = useCallback(
    (query: string): string | null => {
      const result = matchIntent(query, brain.status);
      if (result.kind === "answer") return result.text;
      // Handoff: spawn a real claude via the existing Run page. `autostart=1`
      // tells Run to fire the prompt automatically once it's prefilled, so the
      // question is actually sent instead of just dropped into the composer.
      navigate(`/run?prompt=${encodeURIComponent(result.prompt)}&autostart=1`);
      setOpen(false);
      return null;
    },
    [brain, navigate]
  );

  if (!enabled) return null;

  return (
    <div
      className="tabby-root"
      data-dragging={place.dragging ? "1" : "0"}
      data-side={place.side}
      style={{
        left: place.left,
        top: place.top,
        // Avatar sits at the docked corner; bubble/panel stack toward screen
        // center — upward when docked low, downward when docked high.
        flexDirection: place.openUp ? "column" : "column-reverse",
        alignItems: place.side === "left" ? "flex-start" : "flex-end",
      }}
    >
      {!open && brain.bubble && (
        <SpeechBubble text={brain.bubble} onDismiss={brain.dismissBubble} />
      )}

      {open && (
        <TabbyPanel
          status={brain.status}
          muted={brain.muted}
          onToggleMute={brain.toggleMute}
          onClearAlerts={brain.clearAlerts}
          onNavigate={onNavigate}
          onAsk={onAsk}
          onClose={() => setOpen(false)}
        />
      )}

      <button
        className="tabby-avatar-btn relative"
        onPointerDown={place.onPointerDown}
        onClick={() => {
          // A drag just ended — swallow the synthetic click so the panel
          // doesn't toggle when the user only repositioned the avatar.
          if (place.consumeDrag()) return;
          setOpen((v) => !v);
        }}
        aria-label={open ? "Close Tabby" : "Open Tabby companion"}
        aria-expanded={open}
        title="Tabby — ⌘B · drag to move"
      >
        <CatAvatar mood={brain.mood} reducedMotion={reducedMotion} />
        {brain.status.errorCount > 0 && (
          <span className="tabby-error-dot" aria-hidden>
            {brain.status.errorCount > 9 ? "9+" : brain.status.errorCount}
          </span>
        )}
      </button>
    </div>
  );
}
