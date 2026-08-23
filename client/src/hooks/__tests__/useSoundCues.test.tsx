/**
 * @file useSoundCues.test.tsx
 * @description Tests the event-bus → audio-cue mapping performed by
 * `useSoundCues`: which WebSocket message types produce which cue, the
 * delegated interaction tick (including its disabled-control guard), and that
 * unmounting tears every subscription down. The `lib/sound` module is mocked so
 * the assertions are about routing, not synthesis.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { eventBus } from "../../lib/eventBus";
import { useSoundCues } from "../useSoundCues";
import { playCue, unlockSound } from "../../lib/sound";
import type { WSMessage } from "../../lib/types";

vi.mock("../../lib/sound", () => ({
  playCue: vi.fn(),
  unlockSound: vi.fn(),
  installSoundUnlock: vi.fn(() => () => {}),
}));

const mockedPlayCue = vi.mocked(playCue);
const mockedUnlockSound = vi.mocked(unlockSound);

/** Minimal WS envelope; the hook only reads `type` and a couple of data fields. */
function message(type: string, data: unknown): WSMessage {
  return { type, data } as unknown as WSMessage;
}

beforeEach(() => {
  mockedPlayCue.mockClear();
  mockedUnlockSound.mockClear();
});

describe("useSoundCues", () => {
  it("maps session and event messages to their cues", () => {
    renderHook(() => useSoundCues());

    eventBus.publish(message("session_created", { id: "a" }));
    expect(mockedPlayCue).toHaveBeenLastCalledWith("sessionStart");

    eventBus.publish(message("session_updated", { id: "a", status: "error" }));
    expect(mockedPlayCue).toHaveBeenLastCalledWith("sessionError");

    eventBus.publish(message("agent_created", { id: "b", type: "subagent" }));
    expect(mockedPlayCue).toHaveBeenLastCalledWith("subagentSpawn");

    eventBus.publish(message("new_event", { event_type: "Stop" }));
    expect(mockedPlayCue).toHaveBeenLastCalledWith("sessionComplete");

    eventBus.publish(message("new_event", { event_type: "SessionEnd" }));
    expect(mockedPlayCue).toHaveBeenLastCalledWith("sessionComplete");

    eventBus.publish(message("new_event", { event_type: "Notification" }));
    expect(mockedPlayCue).toHaveBeenLastCalledWith("notification");
  });

  it("ignores messages that are not cue-worthy", () => {
    renderHook(() => useSoundCues());
    eventBus.publish(message("session_updated", { id: "a", status: "active" }));
    eventBus.publish(message("agent_created", { id: "b", type: "main" }));
    eventBus.publish(message("new_event", { event_type: "PreToolUse" }));
    expect(mockedPlayCue).not.toHaveBeenCalled();
  });

  it("plays connection cues on socket transitions", () => {
    renderHook(() => useSoundCues());
    eventBus.setConnected(true);
    expect(mockedPlayCue).toHaveBeenLastCalledWith("connected");
    eventBus.setConnected(false);
    expect(mockedPlayCue).toHaveBeenLastCalledWith("disconnected");
  });

  it("ticks on interactive controls but not on plain content", () => {
    renderHook(() => useSoundCues());

    const button = document.createElement("button");
    document.body.appendChild(button);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(mockedPlayCue).toHaveBeenCalledWith("click");

    mockedPlayCue.mockClear();
    const paragraph = document.createElement("p");
    document.body.appendChild(paragraph);
    paragraph.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(mockedPlayCue).not.toHaveBeenCalled();

    button.remove();
    paragraph.remove();
  });

  it("unlocks audio before the first tick, since the handler captures", () => {
    // Regression: the tick listener runs on the capture phase, ahead of
    // installSoundUnlock's bubble-phase listener, so without an explicit
    // unlock here the very first interaction tick was always dropped.
    renderHook(() => useSoundCues());
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));

    expect(mockedUnlockSound).toHaveBeenCalled();
    expect(mockedPlayCue).toHaveBeenCalledWith("click");
    const [unlockOrder] = mockedUnlockSound.mock.invocationCallOrder;
    const [playOrder] = mockedPlayCue.mock.invocationCallOrder;
    expect(unlockOrder).toBeLessThan(playOrder as number);
    button.remove();
  });

  it("plays the error cue on the transition into error, not on every update", () => {
    renderHook(() => useSoundCues());

    eventBus.publish(message("session_updated", { id: "s1", status: "active" }));
    expect(mockedPlayCue).not.toHaveBeenCalled();

    eventBus.publish(message("session_updated", { id: "s1", status: "error" }));
    expect(mockedPlayCue).toHaveBeenCalledExactlyOnceWith("sessionError");

    // A session sitting in the error state keeps emitting updates - stay quiet.
    eventBus.publish(message("session_updated", { id: "s1", status: "error" }));
    eventBus.publish(message("session_updated", { id: "s1", status: "error" }));
    expect(mockedPlayCue).toHaveBeenCalledTimes(1);

    // Recovering and failing again is a fresh transition, so it sounds again.
    eventBus.publish(message("session_updated", { id: "s1", status: "active" }));
    eventBus.publish(message("session_updated", { id: "s1", status: "error" }));
    expect(mockedPlayCue).toHaveBeenCalledTimes(2);
  });

  it("stays silent for disabled controls", () => {
    renderHook(() => useSoundCues());
    const button = document.createElement("button");
    button.setAttribute("disabled", "");
    document.body.appendChild(button);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(mockedPlayCue).not.toHaveBeenCalled();
    button.remove();
  });

  it("unsubscribes everything on unmount", () => {
    const { unmount } = renderHook(() => useSoundCues());
    unmount();

    eventBus.publish(message("session_created", { id: "a" }));
    eventBus.setConnected(true);
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    button.remove();

    expect(mockedPlayCue).not.toHaveBeenCalled();
  });
});
