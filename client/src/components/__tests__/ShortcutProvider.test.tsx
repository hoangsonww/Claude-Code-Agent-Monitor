/**
 * @file ShortcutProvider.test.tsx
 * @description Tests the single global key dispatcher: chord and sequence
 * matching, the typing guard that keeps bare letters from firing mid-sentence,
 * handler precedence between the shell and the mounted page, and the
 * hold-to-reveal gesture — including every way it must cancel, since a hint
 * layer that flashes during ⌘C would be worse than no hint layer at all.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ShortcutProvider,
  useShortcutHandler,
  useShortcuts,
  type ShortcutHandler,
} from "../ShortcutProvider";
import { HINT_REVEAL_DELAY_MS, SEQUENCE_TIMEOUT_MS } from "../../lib/shortcuts";

/** Binds one handler and renders nothing. */
function Bind({ id, handler }: { id: string; handler: ShortcutHandler }) {
  useShortcutHandler(id, handler);
  return null;
}

/** Surfaces provider state so assertions can read it from the DOM. */
function Probe() {
  const { hintsVisible, pendingPrefix, helpOpen } = useShortcuts();
  return (
    <>
      <span data-testid="hints">{String(hintsVisible)}</span>
      <span data-testid="prefix">{pendingPrefix ?? "-"}</span>
      <span data-testid="help">{String(helpOpen)}</span>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("dispatch", () => {
  it("runs a modifier chord", () => {
    const run = vi.fn();
    render(
      <ShortcutProvider>
        <Bind id="palette.open" handler={run} />
      </ShortcutProvider>
    );
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs a two-key sequence and reports the pending prefix in between", () => {
    const run = vi.fn();
    render(
      <ShortcutProvider>
        <Probe />
        <Bind id="goto.analytics" handler={run} />
      </ShortcutProvider>
    );

    fireEvent.keyDown(window, { key: "g" });
    expect(screen.getByTestId("prefix")).toHaveTextContent("g");
    expect(run).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "n" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("prefix")).toHaveTextContent("-");
  });

  it("abandons a sequence that is not completed in time", () => {
    const run = vi.fn();
    render(
      <ShortcutProvider>
        <Probe />
        <Bind id="goto.analytics" handler={run} />
      </ShortcutProvider>
    );

    fireEvent.keyDown(window, { key: "g" });
    act(() => {
      vi.advanceTimersByTime(SEQUENCE_TIMEOUT_MS + 10);
    });
    expect(screen.getByTestId("prefix")).toHaveTextContent("-");

    fireEvent.keyDown(window, { key: "n" });
    expect(run).not.toHaveBeenCalled();
  });

  it("lets an unmatched second key fall through to its own shortcut", () => {
    const help = vi.fn();
    render(
      <ShortcutProvider>
        <Bind id="help.open" handler={help} />
      </ShortcutProvider>
    );

    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "?" });
    expect(help).toHaveBeenCalledTimes(1);
  });

  it("ignores bare-letter shortcuts while a text field has focus", () => {
    const refresh = vi.fn();
    render(
      <ShortcutProvider>
        <Bind id="page.refresh" handler={refresh} />
        <input data-testid="field" />
      </ShortcutProvider>
    );

    fireEvent.keyDown(screen.getByTestId("field"), { key: "r" });
    expect(refresh).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "r" });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("still runs modifier shortcuts while a text field has focus", () => {
    const palette = vi.fn();
    render(
      <ShortcutProvider>
        <Bind id="palette.open" handler={palette} />
        <input data-testid="field" />
      </ShortcutProvider>
    );

    fireEvent.keyDown(screen.getByTestId("field"), { key: "k", metaKey: true });
    expect(palette).toHaveBeenCalledTimes(1);
  });

  it("never mistakes a browser combo for a bare-letter shortcut", () => {
    const refresh = vi.fn();
    render(
      <ShortcutProvider>
        <Bind id="page.refresh" handler={refresh} />
      </ShortcutProvider>
    );
    // Ctrl/Cmd+R is the browser's reload and must reach it untouched.
    fireEvent.keyDown(window, { key: "r", ctrlKey: true });
    fireEvent.keyDown(window, { key: "r", metaKey: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("ignores keystrokes an IME is composing", () => {
    const refresh = vi.fn();
    render(
      <ShortcutProvider>
        <Bind id="page.refresh" handler={refresh} />
      </ShortcutProvider>
    );
    fireEvent.keyDown(window, { key: "r", isComposing: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("gives the most recently mounted handler precedence, and restores the previous one", () => {
    const shell = vi.fn();
    const page = vi.fn();
    const { rerender } = render(
      <ShortcutProvider>
        <Bind id="page.refresh" handler={shell} />
        <Bind id="page.refresh" handler={page} />
      </ShortcutProvider>
    );

    fireEvent.keyDown(window, { key: "r" });
    expect(page).toHaveBeenCalledTimes(1);
    expect(shell).not.toHaveBeenCalled();

    rerender(
      <ShortcutProvider>
        <Bind id="page.refresh" handler={shell} />
      </ShortcutProvider>
    );
    fireEvent.keyDown(window, { key: "r" });
    expect(shell).toHaveBeenCalledTimes(1);
  });

  it("falls through to the handler beneath when the top one declines", () => {
    const fallback = vi.fn();
    const declines = vi.fn(() => false);
    render(
      <ShortcutProvider>
        <Bind id="page.search" handler={fallback} />
        <Bind id="page.search" handler={declines} />
      </ShortcutProvider>
    );

    fireEvent.keyDown(window, { key: "/" });
    expect(declines).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("leaves an unbound key to the browser", () => {
    render(<ShortcutProvider>{null}</ShortcutProvider>);
    const event = new KeyboardEvent("keydown", { key: ".", cancelable: true, bubbles: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("opens the help overlay on `?` with no page handler", () => {
    render(
      <ShortcutProvider>
        <Probe />
      </ShortcutProvider>
    );
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByTestId("help")).toHaveTextContent("true");
  });
});

describe("hold to reveal", () => {
  function renderProbe() {
    return render(
      <ShortcutProvider>
        <Probe />
      </ShortcutProvider>
    );
  }

  it("reveals hints after the modifier is held alone", () => {
    renderProbe();
    fireEvent.keyDown(window, { key: "Meta" });
    expect(screen.getByTestId("hints")).toHaveTextContent("false");

    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS + 10);
    });
    expect(screen.getByTestId("hints")).toHaveTextContent("true");
  });

  it("accepts Control as the modifier off macOS", () => {
    renderProbe();
    fireEvent.keyDown(window, { key: "Control" });
    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS + 10);
    });
    expect(screen.getByTestId("hints")).toHaveTextContent("true");
  });

  it("cancels when another key joins the modifier", () => {
    renderProbe();
    fireEvent.keyDown(window, { key: "Meta" });
    fireEvent.keyDown(window, { key: "c", metaKey: true });
    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS + 10);
    });
    expect(screen.getByTestId("hints")).toHaveTextContent("false");
  });

  it("hides on release", () => {
    renderProbe();
    fireEvent.keyDown(window, { key: "Meta" });
    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS + 10);
    });
    fireEvent.keyUp(window, { key: "Meta" });
    expect(screen.getByTestId("hints")).toHaveTextContent("false");
  });

  it("hides when the window loses focus", () => {
    renderProbe();
    fireEvent.keyDown(window, { key: "Meta" });
    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS + 10);
    });
    // Switching apps with the modifier down would otherwise leave hints stuck on.
    fireEvent.blur(window);
    expect(screen.getByTestId("hints")).toHaveTextContent("false");
  });

  it("ignores auto-repeat so a held modifier does not restart the clock", () => {
    renderProbe();
    fireEvent.keyDown(window, { key: "Meta" });
    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS / 2);
    });
    fireEvent.keyDown(window, { key: "Meta", repeat: true });
    act(() => {
      vi.advanceTimersByTime(HINT_REVEAL_DELAY_MS / 2 + 10);
    });
    expect(screen.getByTestId("hints")).toHaveTextContent("true");
  });
});
