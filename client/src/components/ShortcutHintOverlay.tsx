/**
 * @file ShortcutHintOverlay.tsx
 * @description The floating legend shown while the hold-⌘/Ctrl gesture is
 * active. Inline {@link ShortcutHint} badges cover the chrome that is on screen
 * (sidebar rows, the search trigger); this panel covers everything that has no
 * visible control to pin a badge to — the `g …` jumps and whatever page-scoped
 * actions the current route registered.
 *
 * It lists only ids that actually have a handler right now, because the whole
 * value of a reveal gesture is that what it shows is true here, on this page. The
 * exhaustive list lives one keypress away behind `?`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard } from "lucide-react";
import {
  DOCUMENTED_SHORTCUTS,
  primaryModifierLabel,
  SHORTCUT_BY_ID,
  type ShortcutDef,
} from "../lib/shortcuts";
import { ShortcutDefKeys } from "./Kbd";
import { useShortcuts } from "./ShortcutProvider";

/** Rendered even without a page handler — the provider always services these. */
const ALWAYS_AVAILABLE = ["palette.open", "help.open"];

export function ShortcutHintOverlay() {
  const { t } = useTranslation("shortcuts");
  const { hintsVisible, boundIds } = useShortcuts();

  const columns = useMemo(() => {
    const live = (def: ShortcutDef) =>
      ALWAYS_AVAILABLE.includes(def.id) || boundIds.has(def.liveWith ?? def.id);
    const navigation = DOCUMENTED_SHORTCUTS.filter((d) => d.category === "navigation" && live(d));
    const page = DOCUMENTED_SHORTCUTS.filter(
      (d) => (d.category === "page" || d.category === "global") && live(d)
    );
    return { navigation, page };
  }, [boundIds]);

  if (!hintsVisible) return null;

  const helpDef = SHORTCUT_BY_ID.get("help.open");

  return (
    <div
      // Presentational and transient: it must never take focus or intercept a
      // click, and screen-reader users get the same content from the `?` dialog.
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[65] flex justify-center px-4 animate-fade-in"
    >
      <div className="max-w-3xl overflow-hidden rounded-xl border border-border bg-surface-1/95 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
          <Keyboard className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
          <span className="text-[11px] font-semibold text-gray-200">{t("hintPanelTitle")}</span>
          <span className="ml-auto text-[10px] text-gray-500">
            {t("hintPanelRelease", { key: primaryModifierLabel() })}
          </span>
        </div>
        <div className="grid gap-x-6 gap-y-3 px-3.5 py-3 sm:grid-cols-2">
          {(["navigation", "page"] as const).map((key) =>
            columns[key].length === 0 ? null : (
              <section key={key}>
                <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-gray-600">
                  {t(`categories.${key === "navigation" ? "navigation" : "page"}`)}
                </h3>
                <ul className="space-y-0.5">
                  {columns[key].map((def) => (
                    <li key={def.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-gray-400">
                        {t(def.labelKey)}
                      </span>
                      <ShortcutDefKeys def={def} size="sm" className="flex-shrink-0" />
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}
        </div>
        {helpDef && (
          <p className="flex items-center gap-1.5 border-t border-border px-3.5 py-1.5 text-[10px] text-gray-600">
            <ShortcutDefKeys def={helpDef} size="sm" />
            <span>{t("hintPanelAll")}</span>
          </p>
        )}
      </div>
    </div>
  );
}
