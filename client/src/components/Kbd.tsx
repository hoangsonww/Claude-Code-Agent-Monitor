/**
 * @file Kbd.tsx
 * @description Key-cap primitives shared by every shortcut surface: the help
 * overlay, the palette rows, the sidebar, and the hold-to-reveal hint badges.
 * Keeping them here means a chord looks identical everywhere it appears, which
 * is what lets a user recognize the same binding across surfaces.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useTranslation } from "react-i18next";
import { shortcutTokens, type ShortcutDef } from "../lib/shortcuts";
import { useShortcutHintsVisible } from "./ShortcutProvider";

/** Connector tokens are rendered as plain words, not as key caps. */
const CONNECTOR_TOKENS = new Set(["then", "…", "or"]);

interface KbdProps {
  children: string;
  /** Denser variant for inline use inside a list row. */
  size?: "sm" | "md";
}

/** One key cap. */
export function Kbd({ children, size = "md" }: KbdProps) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded border border-border bg-surface-2 font-sans font-medium text-gray-400 ${
        size === "sm"
          ? "min-w-[1.25rem] px-1 py-px text-[10px]"
          : "min-w-[1.5rem] px-1.5 py-0.5 text-[11px]"
      }`}
    >
      {children}
    </kbd>
  );
}

interface ShortcutKeysProps {
  tokens: string[];
  size?: "sm" | "md";
  className?: string;
}

/** Render a token list from {@link shortcutTokens} as caps plus connectors. */
export function ShortcutKeys({ tokens, size = "md", className = "" }: ShortcutKeysProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {tokens.map((token, index) =>
        CONNECTOR_TOKENS.has(token) ? (
          <span key={`${token}-${index}`} className="text-[10px] text-gray-600">
            {token}
          </span>
        ) : (
          <Kbd key={`${token}-${index}`} size={size}>
            {token}
          </Kbd>
        )
      )}
    </span>
  );
}

interface ShortcutDefKeysProps {
  def: ShortcutDef;
  size?: "sm" | "md";
  className?: string;
}

/** Key caps for a registry definition, with the localized "then" connector. */
export function ShortcutDefKeys({ def, size = "md", className }: ShortcutDefKeysProps) {
  const { t } = useTranslation("shortcuts");
  return <ShortcutKeys tokens={shortcutTokens(def, t("then"))} size={size} className={className} />;
}

interface ShortcutHintProps {
  def: ShortcutDef;
  /**
   * Where to pin the badge relative to the positioned ancestor. Callers must
   * give that ancestor `relative`; the badge never changes layout so revealing
   * hints cannot reflow the page under the user's cursor.
   */
  placement?: "right" | "left";
  className?: string;
}

/**
 * A key-cap badge that appears only while the hold-to-reveal gesture is active.
 * Rendered as an overlay (absolutely positioned, `pointer-events-none`) so the
 * element it annotates stays clickable and its size never changes.
 */
export function ShortcutHint({ def, placement = "right", className = "" }: ShortcutHintProps) {
  const visible = useShortcutHintsVisible();
  if (!visible) return null;
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-20 animate-fade-in ${
        placement === "right" ? "right-1.5" : "left-1.5"
      } ${className}`}
    >
      <span className="inline-flex items-center gap-0.5 rounded bg-accent/15 px-1 py-0.5 ring-1 ring-accent/40 backdrop-blur-sm">
        <ShortcutDefKeys def={def} size="sm" />
      </span>
    </span>
  );
}
