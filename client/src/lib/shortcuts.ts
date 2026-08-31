/**
 * @file shortcuts.ts
 * @description Single source of truth for every keyboard shortcut the dashboard
 * claims: the chord model, platform-aware labels, the event matcher, and the
 * registry that both the help overlay and the hold-to-reveal hint layer render
 * from. Nothing else in the client may hard-code a chord — a shortcut that is
 * not in {@link SHORTCUTS} cannot be documented, cannot be hinted, and cannot be
 * checked against the browser-reserved list below.
 *
 * ## Why a registry instead of scattered listeners
 * Before this module every shortcut lived inside the component that used it, so
 * there was no way to answer "what is bound right now?" — which is exactly the
 * question the `?` overlay and the hold-⌘ hint layer have to answer. Centralizing
 * the definitions makes the answer a data lookup, and makes collisions a test.
 *
 * ## Browser-collision policy
 * The dashboard runs in a tab it does not own. Stealing a chord the browser or
 * the OS already uses is worse than having no shortcut at all, so:
 *
 * 1. Every modifier chord we claim must be absent from {@link BROWSER_RESERVED}.
 *    `shortcuts.collisions.test.ts` asserts this for the whole registry, so a
 *    future addition cannot regress it silently.
 * 2. Chords with no modifier are safe by construction (browsers bind almost
 *    nothing to a bare letter) but only while the user is not typing, so they
 *    are gated by {@link isEditableTarget}.
 * 3. Multi-key sequences (`g` then `d`) are the preferred form for navigation:
 *    they need no modifier at all, so there is nothing to collide with.
 *
 * The single deliberate exception is `Mod+K`. Firefox binds it to "focus the
 * search bar", but it is the de-facto command-palette chord across every app a
 * developer already has open (VS Code, GitHub, Slack, Linear, Notion), and a
 * launcher on a different key is a launcher nobody finds. It is listed in
 * {@link INTENTIONAL_OVERRIDES} so the collision test documents the trade rather
 * than hiding it.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Where a shortcut appears in the help overlay, in render order. */
export type ShortcutCategory = "global" | "navigation" | "page" | "palette";

/** One key press, optionally with modifiers. */
export interface Chord {
  /**
   * The platform's primary modifier: Cmd on macOS, Ctrl everywhere else. Both
   * are accepted at match time regardless of platform — a Mac user on an
   * external PC keyboard should not have to relearn the chord.
   */
  primary?: boolean;
  /**
   * Shift requirement. `undefined` means "don't care", which is what punctuation
   * keys need: `?` already arrives as `"?"` and demanding `shiftKey` on top of
   * that breaks layouts where it is unshifted.
   */
  shift?: boolean;
  alt?: boolean;
  /** Lowercased `KeyboardEvent.key` for single characters, verbatim otherwise. */
  key: string;
}

export interface ShortcutDef {
  /** Stable id; also the key pages register handlers under. */
  id: string;
  /**
   * The chords to press, in order. One entry is a normal shortcut; two entries
   * form a sequence (`g` then `d`) that must complete inside
   * {@link SEQUENCE_TIMEOUT_MS}.
   */
  sequence: Chord[];
  category: ShortcutCategory;
  /** i18n key under the `shortcuts` namespace. */
  labelKey: string;
  /**
   * Fire even while a text field has focus. Only for chords that carry the
   * primary modifier — a bare letter that fires mid-sentence is a bug.
   */
  allowInInput?: boolean;
  /**
   * Handled by the component that owns the surface (the palette's own arrow
   * keys, a modal's Escape) rather than by the global dispatcher. Listed so the
   * help overlay stays complete, never bound globally.
   */
  documentationOnly?: boolean;
  /** Route this shortcut is only meaningful on; used to scope the hint layer. */
  routes?: string[];
  /** Bound, but folded into another row in the help overlay (e.g. `1`…`9`). */
  hidden?: boolean;
  /** Override the rendered key caps when the real sequence is a poor summary. */
  displayTokens?: string[];
  /**
   * This row stands in for another id's bindings (`1`…`9` is one row backed by
   * nine). Surfaces that dim unavailable shortcuts read the referenced id's
   * state instead of this one's, which has no handler of its own.
   */
  liveWith?: string;
}

/**
 * Chords the browser, the OS, or an extension is likely to own. Normalized as
 * `mod+…` because the reservation applies to Cmd on macOS and Ctrl elsewhere.
 * Not exhaustive — no such list can be — but it covers every combination a
 * mainstream browser ships by default, which is the bar for "don't take it".
 */
export const BROWSER_RESERVED: ReadonlySet<string> = new Set([
  // Tab and window lifecycle
  "mod+t",
  "mod+n",
  "mod+w",
  "mod+q",
  "mod+shift+t",
  "mod+shift+n",
  "mod+shift+w",
  "mod+tab",
  // Address bar, search, and page chrome
  "mod+l",
  "mod+e",
  "mod+d",
  "mod+shift+d",
  "mod+f",
  "mod+g",
  "mod+shift+g",
  "mod+h",
  "mod+shift+h",
  "mod+j",
  "mod+shift+j",
  // Firefox: focus the search bar (mod+k) and toggle the bookmarks sidebar
  // (mod+b). Both are claimed anyway — see INTENTIONAL_OVERRIDES.
  "mod+k",
  "mod+b",
  "mod+shift+o",
  "mod+shift+b",
  // Content actions
  "mod+p",
  "mod+s",
  "mod+o",
  "mod+r",
  "mod+shift+r",
  "mod+u",
  "mod+shift+u",
  "mod+shift+p",
  "mod+shift+delete",
  // Zoom
  "mod+0",
  "mod+=",
  "mod++",
  "mod+-",
  // Tab switching
  "mod+1",
  "mod+2",
  "mod+3",
  "mod+4",
  "mod+5",
  "mod+6",
  "mod+7",
  "mod+8",
  "mod+9",
  // History / navigation
  "mod+[",
  "mod+]",
  "mod+arrowleft",
  "mod+arrowright",
  "alt+arrowleft",
  "alt+arrowright",
  // Devtools and reader chrome
  "mod+shift+i",
  "mod+shift+c",
  "mod+shift+m",
  "mod+shift+k",
  "mod+shift+e",
  // Clipboard and editing — never take these, even outside inputs
  "mod+c",
  "mod+v",
  "mod+x",
  "mod+z",
  "mod+shift+z",
  "mod+y",
  "mod+a",
  // Function keys the browser owns outright
  "f1",
  "f3",
  "f5",
  "f6",
  "f11",
  "f12",
]);

/**
 * Reserved chords we take anyway, each with the reason. The collision test reads
 * this map, so adding an entry is a deliberate, reviewable act rather than a
 * silent exception.
 */
export const INTENTIONAL_OVERRIDES: Readonly<Record<string, string>> = {
  "mod+k":
    "Universal command-palette chord (VS Code, GitHub, Slack, Linear, Notion). " +
    "Firefox binds it to the search bar; a launcher on any other key is a launcher nobody finds.",
  "mod+b":
    "Tabby's panel toggle, shipped before this registry existed. Firefox binds it to the " +
    "bookmarks sidebar; changing it now would break the muscle memory of existing users, " +
    "so it is preserved and documented rather than silently re-bound.",
};

/** How long a started sequence (`g` …) waits for its second key. */
export const SEQUENCE_TIMEOUT_MS = 1200;

/** How long the primary modifier must be held, alone, before hints appear. */
export const HINT_REVEAL_DELAY_MS = 450;

const mod = (key: string, extra: Partial<Chord> = {}): Chord => ({ primary: true, key, ...extra });

/**
 * A chord with no modifier. Alphanumeric keys pin `shift: false` so `G` and `g`
 * stay distinguishable — without it, Shift+G would also start the `g …` sequence
 * and "go to bottom" could never be reached. Punctuation keeps `shift`
 * undefined: `?` already arrives shifted on US layouts and unshifted on others.
 */
const plain = (key: string, extra: Partial<Chord> = {}): Chord => ({
  ...(/^[a-z0-9]$/i.test(key) ? { shift: false } : {}),
  key,
  ...extra,
});

/**
 * Every shortcut the dashboard binds or documents.
 *
 * Navigation deliberately uses `g`-prefixed sequences rather than modifier
 * chords: two bare letters collide with nothing, scale to as many destinations
 * as the app grows, and are the convention users already know from Gmail,
 * GitHub, Linear, and Vim.
 */
export const SHORTCUTS: readonly ShortcutDef[] = [
  // ── Global ────────────────────────────────────────────────────────────────
  {
    id: "palette.open",
    sequence: [mod("k")],
    category: "global",
    labelKey: "global.palette",
    allowInInput: true,
  },
  {
    id: "help.open",
    sequence: [plain("?")],
    category: "global",
    labelKey: "global.help",
  },
  {
    id: "tabby.toggle",
    sequence: [mod("b")],
    category: "global",
    labelKey: "global.tabby",
    allowInInput: true,
  },
  {
    id: "sidebar.toggle",
    sequence: [plain(".")],
    category: "global",
    labelKey: "global.sidebar",
  },
  {
    id: "page.search",
    sequence: [plain("/")],
    category: "global",
    labelKey: "global.search",
  },
  {
    id: "page.refresh",
    sequence: [plain("r")],
    category: "global",
    labelKey: "global.refresh",
  },
  {
    id: "hints.hold",
    sequence: [{ primary: true, key: "hold" }],
    category: "global",
    labelKey: "global.hints",
    documentationOnly: true,
  },

  // ── Navigation (g …) ──────────────────────────────────────────────────────
  {
    id: "goto.dashboard",
    sequence: [plain("g"), plain("d")],
    category: "navigation",
    labelKey: "goto.dashboard",
  },
  {
    id: "goto.kanban",
    sequence: [plain("g"), plain("k")],
    category: "navigation",
    labelKey: "goto.kanban",
  },
  {
    id: "goto.sessions",
    sequence: [plain("g"), plain("s")],
    category: "navigation",
    labelKey: "goto.sessions",
  },
  {
    id: "goto.activity",
    sequence: [plain("g"), plain("a")],
    category: "navigation",
    labelKey: "goto.activity",
  },
  {
    id: "goto.analytics",
    sequence: [plain("g"), plain("n")],
    category: "navigation",
    labelKey: "goto.analytics",
  },
  {
    id: "goto.workflows",
    sequence: [plain("g"), plain("w")],
    category: "navigation",
    labelKey: "goto.workflows",
  },
  {
    id: "goto.ccConfig",
    sequence: [plain("g"), plain("c")],
    category: "navigation",
    labelKey: "goto.ccConfig",
  },
  {
    id: "goto.run",
    sequence: [plain("g"), plain("r")],
    category: "navigation",
    labelKey: "goto.run",
  },
  {
    id: "goto.settings",
    sequence: [plain("g"), plain(",")],
    category: "navigation",
    labelKey: "goto.settings",
  },
  {
    id: "goto.top",
    sequence: [plain("g"), plain("g")],
    category: "navigation",
    labelKey: "goto.top",
  },
  {
    id: "goto.bottom",
    sequence: [plain("G", { shift: true })],
    category: "navigation",
    labelKey: "goto.bottom",
  },

  // ── Page-scoped ───────────────────────────────────────────────────────────
  { id: "tab.prev", sequence: [plain("[")], category: "page", labelKey: "page.tabPrev" },
  { id: "tab.next", sequence: [plain("]")], category: "page", labelKey: "page.tabNext" },
  // One binding per digit, but a single documented row: nine near-identical
  // lines in the help overlay would be noise, not documentation.
  ...Array.from({ length: 9 }, (_, i) => ({
    id: `tab.${i + 1}`,
    sequence: [plain(String(i + 1))],
    category: "page" as const,
    labelKey: "page.tabNumber",
    hidden: true,
  })),
  {
    id: "tab.numbers",
    sequence: [plain("1")],
    category: "page",
    labelKey: "page.tabNumber",
    documentationOnly: true,
    displayTokens: ["1", "…", "9"],
    liveWith: "tab.1",
  },
  {
    id: "run.submit",
    sequence: [mod("enter")],
    category: "page",
    labelKey: "page.runSubmit",
    allowInInput: true,
    documentationOnly: true,
    routes: ["/run"],
  },

  // ── Inside the palette ────────────────────────────────────────────────────
  // Handled by the palette's own key handler while it has focus; listed here so
  // the cheat sheet is complete. `displayTokens` collapses each pair of opposite
  // keys into one row.
  {
    id: "palette.move",
    sequence: [plain("arrowdown")],
    category: "palette",
    labelKey: "palette.move",
    documentationOnly: true,
    displayTokens: ["↑", "↓"],
  },
  {
    id: "palette.jump",
    sequence: [plain("pagedown")],
    category: "palette",
    labelKey: "palette.jump",
    documentationOnly: true,
    displayTokens: ["PgUp", "PgDn"],
  },
  {
    id: "palette.edges",
    sequence: [plain("home")],
    category: "palette",
    labelKey: "palette.edges",
    documentationOnly: true,
    displayTokens: ["Home", "End"],
  },
  {
    id: "palette.run",
    sequence: [plain("enter")],
    category: "palette",
    labelKey: "palette.run",
    documentationOnly: true,
  },
  {
    id: "palette.group",
    sequence: [plain("tab")],
    category: "palette",
    labelKey: "palette.group",
    documentationOnly: true,
  },
  {
    id: "palette.close",
    sequence: [plain("escape")],
    category: "palette",
    labelKey: "palette.close",
    documentationOnly: true,
  },
];

/** Fast id → definition lookup. */
export const SHORTCUT_BY_ID: ReadonlyMap<string, ShortcutDef> = new Map(
  SHORTCUTS.map((s) => [s.id, s])
);

/** Definitions the global dispatcher actually binds. */
export const BINDABLE_SHORTCUTS: readonly ShortcutDef[] = SHORTCUTS.filter(
  (s) => !s.documentationOnly
);

/** Definitions the help overlay and hint layer render. */
export const DOCUMENTED_SHORTCUTS: readonly ShortcutDef[] = SHORTCUTS.filter((s) => !s.hidden);

/** Categories in the order the help overlay lays them out. */
export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = [
  "global",
  "navigation",
  "page",
  "palette",
];

// ── Platform ────────────────────────────────────────────────────────────────

/**
 * True on Apple platforms. Read from `userAgentData` first (`navigator.platform`
 * is deprecated and lies under some privacy modes), and falsy anywhere the
 * platform cannot be determined — rendering the Ctrl form on a Mac is a smaller
 * error than rendering ⌘ on Windows.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Display glyph for the primary modifier on this platform. */
export function primaryModifierLabel(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

const KEY_GLYPHS: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "↵",
  escape: "Esc",
  backspace: "⌫",
  tab: "⇥",
  pagedown: "PgDn",
  pageup: "PgUp",
  home: "Home",
  end: "End",
  hold: "hold",
  " ": "Space",
};

/**
 * Render one chord as the tokens a `<kbd>` row should show, e.g. `["⌘", "K"]`.
 * Tokens are returned separately so the caller can style each key cap.
 */
export function chordTokens(chord: Chord): string[] {
  const tokens: string[] = [];
  if (chord.primary) tokens.push(primaryModifierLabel());
  if (chord.alt) tokens.push(isMacPlatform() ? "⌥" : "Alt");
  // A shift requirement on a punctuation key is already baked into the glyph
  // (`?` is shift+/), so only surface it for keys where it is a real extra press.
  if (chord.shift && /^[a-z0-9]$/i.test(chord.key)) {
    tokens.push(isMacPlatform() ? "⇧" : "Shift");
  }
  const glyph = KEY_GLYPHS[chord.key.toLowerCase()];
  tokens.push(glyph ?? (chord.key.length === 1 ? chord.key.toUpperCase() : chord.key));
  return tokens;
}

/** Flatten a whole sequence to display tokens, e.g. `["G", "then", "D"]`. */
export function sequenceTokens(sequence: readonly Chord[], thenLabel = "then"): string[] {
  return sequence.flatMap((chord, index) =>
    index === 0 ? chordTokens(chord) : [thenLabel, ...chordTokens(chord)]
  );
}

/** Key caps to render for a definition, honoring {@link ShortcutDef.displayTokens}. */
export function shortcutTokens(def: ShortcutDef, thenLabel = "then"): string[] {
  return def.displayTokens ?? sequenceTokens(def.sequence, thenLabel);
}

/** Compact single-string form, used in tooltips and `aria-keyshortcuts`. */
export function sequenceLabel(sequence: readonly Chord[]): string {
  return sequence.map((chord) => chordTokens(chord).join("")).join(" ");
}

/**
 * Canonical `mod+shift+key` string used to test a chord against
 * {@link BROWSER_RESERVED}. Platform-independent by design: a chord is reserved
 * if it is reserved on *any* platform we run on.
 */
export function normalizeChord(chord: Chord): string {
  const parts: string[] = [];
  if (chord.primary) parts.push("mod");
  if (chord.alt) parts.push("alt");
  if (chord.shift) parts.push("shift");
  parts.push(chord.key.toLowerCase());
  return parts.join("+");
}

// ── Matching ────────────────────────────────────────────────────────────────

/**
 * True when the event target is somewhere the user is composing text. Bare-letter
 * shortcuts must never fire here — typing "grep" in a filter box should not
 * navigate to the Dashboard.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // Checkboxes, radios, buttons and ranges are not text entry — a shortcut
    // fired while a checkbox has focus is expected behavior, not a mis-fire.
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(type);
  }
  return false;
}

/** Normalize `KeyboardEvent.key` into the form {@link Chord.key} stores. */
export function eventKey(e: Pick<KeyboardEvent, "key">): string {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
}

/**
 * Does this event press exactly this chord?
 *
 * A chord without `primary` requires that no primary modifier is held, so
 * `Ctrl+R` (browser reload) can never be mistaken for the bare `r` refresh
 * shortcut. Alt is likewise required to be absent unless asked for — Alt is the
 * modifier browsers layer their own combos onto, so we never fight it.
 */
export function matchesChord(e: KeyboardEvent, chord: Chord): boolean {
  if (eventKey(e) !== chord.key.toLowerCase()) return false;
  const primaryHeld = e.metaKey || e.ctrlKey;
  if (!!chord.primary !== primaryHeld) return false;
  if (!!chord.alt !== e.altKey) return false;
  if (chord.shift !== undefined && chord.shift !== e.shiftKey) return false;
  return true;
}

/** Is this key press the start of `def`'s sequence? */
export function matchesFirstChord(e: KeyboardEvent, def: ShortcutDef): boolean {
  const first = def.sequence[0];
  return first !== undefined && matchesChord(e, first);
}
