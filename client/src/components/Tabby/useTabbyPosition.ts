/**
 * @file useTabbyPosition.ts
 * @description AssistiveTouch-style draggable docking for the Tabby widget. The
 *   avatar can be dragged anywhere; on release it snaps to the nearest left or
 *   right edge and remembers its vertical offset (persisted as a viewport
 *   fraction so it survives resizes). Distinguishes a drag from a tap via a
 *   small movement threshold so dragging never accidentally opens the panel.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { tabbyPrefs, type TabbyPos } from "./prefs";
import type { PointerEvent as ReactPointerEvent } from "react";

// Avatar footprint + edge gap, in px. SIZE matches CatAvatar's default size.
const SIZE = 60;
const MARGIN = 16;
const DRAG_THRESHOLD = 6;

const vw = () => (typeof window !== "undefined" ? window.innerWidth : 1024);
const vh = () => (typeof window !== "undefined" ? window.innerHeight : 768);

function defaultPos(): TabbyPos {
  return { side: "right", y: 1 }; // bottom-right, matching the old fixed corner
}

/** Resting top-left screen coords for a docked position. */
function restingScreen(pos: TabbyPos) {
  const avail = Math.max(0, vh() - SIZE - 2 * MARGIN);
  const left = pos.side === "left" ? MARGIN : vw() - SIZE - MARGIN;
  const top = MARGIN + pos.y * avail;
  return { left, top };
}

export interface TabbyPlacement {
  left: number;
  top: number;
  side: "left" | "right";
  /** True when the avatar sits in the lower half — panel should open upward. */
  openUp: boolean;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  /** Returns true (once) if a drag just ended, so the click handler can skip. */
  consumeDrag: () => boolean;
}

export function useTabbyPosition(): TabbyPlacement {
  const [pos, setPos] = useState<TabbyPos>(() => tabbyPrefs.getPos() ?? defaultPos());
  const [drag, setDrag] = useState<{ left: number; top: number } | null>(null);
  const [, setTick] = useState(0); // bump to re-derive resting coords on resize

  const draggedRef = useRef(false);
  const startRef = useRef<{ px: number; py: number; left: number; top: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    const onResize = () => setTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resting = restingScreen(pos);
  const screen = drag ?? resting;

  const onPointerMove = useCallback((e: PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;
    const left = Math.min(vw() - SIZE - MARGIN, Math.max(MARGIN, start.left + dx));
    const top = Math.min(vh() - SIZE - MARGIN, Math.max(MARGIN, start.top + dy));
    setDrag({ left, top });
  }, []);

  const onPointerUp = useCallback(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    if (movedRef.current) {
      draggedRef.current = true;
      setDrag((cur) => {
        const c = cur ?? resting;
        const side: "left" | "right" = c.left + SIZE / 2 < vw() / 2 ? "left" : "right";
        const avail = Math.max(1, vh() - SIZE - 2 * MARGIN);
        const y = Math.min(1, Math.max(0, (c.top - MARGIN) / avail));
        const next: TabbyPos = { side, y };
        tabbyPrefs.setPos(next);
        setPos(next);
        return null; // leave drag mode; resting coords take over
      });
    }
    startRef.current = null;
    movedRef.current = false;
  }, [onPointerMove, resting]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      // Only the primary button / touch starts a drag.
      if (e.button !== undefined && e.button !== 0) return;
      startRef.current = { px: e.clientX, py: e.clientY, left: screen.left, top: screen.top };
      movedRef.current = false;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp, screen.left, screen.top]
  );

  // Clean up any stray window listeners if we unmount mid-drag.
  useEffect(
    () => () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp]
  );

  const consumeDrag = useCallback(() => {
    const was = draggedRef.current;
    draggedRef.current = false;
    return was;
  }, []);

  return {
    left: screen.left,
    top: screen.top,
    side: pos.side,
    openUp: screen.top + SIZE / 2 > vh() / 2,
    dragging: drag !== null,
    onPointerDown,
    consumeDrag,
  };
}
