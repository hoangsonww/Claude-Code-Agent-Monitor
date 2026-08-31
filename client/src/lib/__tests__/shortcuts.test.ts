/**
 * @file shortcuts.test.ts
 * @description Guards the shortcut registry's two safety properties.
 *
 * The first is the one this feature can most easily get wrong: a chord that the
 * browser or the OS already owns. Stealing `⌘R` or `⌘W` is worse than shipping
 * no shortcut at all, and the failure is invisible in review — the code looks
 * fine and only misbehaves in a real browser. So every bindable chord is checked
 * against {@link BROWSER_RESERVED}, and the only way past it is an entry in
 * {@link INTENTIONAL_OVERRIDES}, which forces the trade to be written down.
 *
 * The second is internal consistency: unique ids, no two shortcuts answering to
 * the same keys, and sequences that stay distinguishable from the single-chord
 * shortcuts sharing their first key.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, expect, it } from "vitest";
import {
  BINDABLE_SHORTCUTS,
  BROWSER_RESERVED,
  DOCUMENTED_SHORTCUTS,
  INTENTIONAL_OVERRIDES,
  SHORTCUTS,
  chordTokens,
  isEditableTarget,
  matchesChord,
  normalizeChord,
  sequenceLabel,
  shortcutTokens,
} from "../shortcuts";

/** Build a KeyboardEvent-shaped object the matcher accepts. */
function press(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

describe("shortcut registry", () => {
  it("never claims a chord the browser reserves", () => {
    const collisions = BINDABLE_SHORTCUTS.flatMap((def) =>
      def.sequence
        .map(normalizeChord)
        .filter((chord) => BROWSER_RESERVED.has(chord))
        .filter((chord) => !(chord in INTENTIONAL_OVERRIDES))
        .map((chord) => `${def.id} → ${chord}`)
    );
    expect(collisions).toEqual([]);
  });

  it("documents every reserved chord it does claim", () => {
    const claimed = new Set(
      BINDABLE_SHORTCUTS.flatMap((def) => def.sequence.map(normalizeChord)).filter((chord) =>
        BROWSER_RESERVED.has(chord)
      )
    );
    for (const chord of claimed) {
      expect(INTENTIONAL_OVERRIDES[chord], `${chord} needs a documented rationale`).toBeTruthy();
    }
    // And the reverse: an override for a chord nothing claims is stale.
    for (const chord of Object.keys(INTENTIONAL_OVERRIDES)) {
      expect(claimed.has(chord), `${chord} override is unused`).toBe(true);
    }
  });

  it("uses unique ids", () => {
    const ids = SHORTCUTS.map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never binds the same key sequence twice", () => {
    const seen = new Map<string, string>();
    for (const def of BINDABLE_SHORTCUTS) {
      const key = def.sequence.map(normalizeChord).join(" ");
      expect(seen.has(key), `${def.id} duplicates ${seen.get(key)} on ${key}`).toBe(false);
      seen.set(key, def.id);
    }
  });

  it("keeps a sequence prefix from also being a single-chord shortcut", () => {
    // `g` starts the navigation sequences, so nothing may bind bare `g` on its
    // own — the dispatcher would never reach the second key.
    const prefixes = new Set(
      BINDABLE_SHORTCUTS.filter((def) => def.sequence.length > 1).map((def) =>
        normalizeChord(def.sequence[0]!)
      )
    );
    const singles = BINDABLE_SHORTCUTS.filter((def) => def.sequence.length === 1).map((def) =>
      normalizeChord(def.sequence[0]!)
    );
    for (const single of singles) {
      expect(prefixes.has(single), `${single} is both a shortcut and a sequence prefix`).toBe(
        false
      );
    }
  });

  it("gives every documented shortcut a label key", () => {
    for (const def of DOCUMENTED_SHORTCUTS) {
      expect(def.labelKey, `${def.id} has no labelKey`).toBeTruthy();
    }
  });

  it("only allows modifier chords to fire while typing", () => {
    for (const def of BINDABLE_SHORTCUTS) {
      if (!def.allowInInput) continue;
      expect(def.sequence[0]?.primary, `${def.id} fires in inputs without a modifier`).toBe(true);
    }
  });
});

describe("matchesChord", () => {
  it("accepts either primary modifier, so one chord works on every platform", () => {
    const chord = { primary: true, key: "k" };
    expect(matchesChord(press("k", { metaKey: true }), chord)).toBe(true);
    expect(matchesChord(press("k", { ctrlKey: true }), chord)).toBe(true);
    expect(matchesChord(press("k"), chord)).toBe(false);
  });

  it("refuses a bare-letter chord when a modifier is held", () => {
    // Ctrl+R is the browser's reload; it must never be read as the `r` refresh.
    const chord = { shift: false, key: "r" };
    expect(matchesChord(press("r"), chord)).toBe(true);
    expect(matchesChord(press("r", { ctrlKey: true }), chord)).toBe(false);
    expect(matchesChord(press("r", { metaKey: true }), chord)).toBe(false);
  });

  it("never matches when Alt is held unless the chord asks for it", () => {
    expect(
      matchesChord(press("k", { metaKey: true, altKey: true }), { primary: true, key: "k" })
    ).toBe(false);
  });

  it("distinguishes a shifted letter from its unshifted form", () => {
    expect(matchesChord(press("G", { shiftKey: true }), { key: "G", shift: true })).toBe(true);
    expect(matchesChord(press("G", { shiftKey: true }), { key: "g", shift: false })).toBe(false);
    expect(matchesChord(press("g"), { key: "g", shift: false })).toBe(true);
  });

  it("ignores shift for punctuation, whose glyph already encodes it", () => {
    expect(matchesChord(press("?", { shiftKey: true }), { key: "?" })).toBe(true);
    expect(matchesChord(press("?"), { key: "?" })).toBe(true);
  });
});

describe("isEditableTarget", () => {
  it("treats text entry as typing", () => {
    for (const tag of ["textarea", "select"]) {
      expect(isEditableTarget(document.createElement(tag))).toBe(true);
    }
    const text = document.createElement("input");
    expect(isEditableTarget(text)).toBe(true);
  });

  it("does not treat non-text inputs as typing", () => {
    for (const type of ["checkbox", "radio", "button", "range"]) {
      const input = document.createElement("input");
      input.type = type;
      expect(isEditableTarget(input), type).toBe(false);
    }
  });

  it("detects contenteditable regions", () => {
    const div = document.createElement("div");
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isEditableTarget(div)).toBe(true);
  });

  it("is false for anything else, including null", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
  });
});

describe("labels", () => {
  it("renders a chord as separate key caps", () => {
    expect(chordTokens({ primary: true, key: "k" })).toEqual([expect.any(String), "K"]);
  });

  it("joins a sequence with a connector", () => {
    const def = SHORTCUTS.find((s) => s.id === "goto.dashboard")!;
    expect(shortcutTokens(def, "then")).toEqual(["G", "then", "D"]);
    expect(sequenceLabel(def.sequence)).toBe("G D");
  });

  it("prefers displayTokens when the raw sequence is a poor summary", () => {
    const def = SHORTCUTS.find((s) => s.id === "palette.move")!;
    expect(shortcutTokens(def)).toEqual(["↑", "↓"]);
  });
});
