/**
 * @file KeyboardShortcutsOverlay.tsx
 * @description The `?` cheat sheet: every shortcut in the registry, grouped by
 * category, filterable, and marked with whether it is actually live on the page
 * behind it. Rendered from {@link DOCUMENTED_SHORTCUTS} rather than a hand-kept
 * list, so a binding cannot exist without appearing here.
 *
 * Shortcuts with no handler on the current page are dimmed rather than hidden:
 * the point of a cheat sheet is to teach the whole scheme, and silently dropping
 * rows makes the layout jump between pages, which reads as a bug.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, Search, X } from "lucide-react";
import {
  DOCUMENTED_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  shortcutTokens,
  type ShortcutCategory,
  type ShortcutDef,
} from "../lib/shortcuts";
import { ShortcutDefKeys } from "./Kbd";
import { useShortcuts, useSuppressShortcutHints } from "./ShortcutProvider";

/** Ids the provider itself always services, whatever the current page binds. */
const ALWAYS_AVAILABLE = new Set(["palette.open", "help.open", "hints.hold"]);

/**
 * Is this shortcut usable right now?
 *
 * The `palette` category is always usable, because those keys only ever apply
 * inside the palette, where they always work — dimming them would say the
 * opposite. Everything else needs a handler; a row that stands in for other ids
 * (`1`…`9`) reads their state via {@link ShortcutDef.liveWith}.
 */
function isLive(def: ShortcutDef, boundIds: ReadonlySet<string>): boolean {
  if (def.category === "palette") return true;
  if (ALWAYS_AVAILABLE.has(def.id)) return true;
  return boundIds.has(def.liveWith ?? def.id);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Modal cheat sheet. Renders nothing until opened. */
export function KeyboardShortcutsOverlay() {
  const { t } = useTranslation("shortcuts");
  const { helpOpen, closeHelp, boundIds } = useShortcuts();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // The cheat sheet already lists everything the hint layer would show.
  useSuppressShortcutHints(helpOpen);

  useEffect(() => {
    if (!helpOpen) return;
    setQuery("");
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [helpOpen]);

  const grouped = useMemo(() => {
    const term = normalize(query.trim());
    const rows: Record<ShortcutCategory, { def: ShortcutDef; label: string }[]> = {
      global: [],
      navigation: [],
      page: [],
      palette: [],
    };
    for (const def of DOCUMENTED_SHORTCUTS) {
      const label = t(def.labelKey);
      const haystack = normalize(`${label} ${shortcutTokens(def, t("then")).join(" ")}`);
      if (term && !haystack.includes(term)) continue;
      rows[def.category].push({ def, label });
    }
    return rows;
  }, [query, t]);

  const total = SHORTCUT_CATEGORIES.reduce((sum, key) => sum + grouped[key].length, 0);

  if (!helpOpen) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeHelp();
      return;
    }
    if (e.key === "Tab" && panelRef.current) {
      // Two focusable controls only (search + close); keep focus inside.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>("input, button");
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[8vh] animate-fade-in"
      onClick={closeHelp}
      role="presentation"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Keyboard className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-100">{t("title")}</h2>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-600" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("filterPlaceholder")}
                aria-label={t("filterPlaceholder")}
                autoComplete="off"
                spellCheck={false}
                className="w-40 min-w-0 bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-600"
              />
            </div>
            <button
              type="button"
              onClick={closeHelp}
              aria-label={t("close")}
              title={t("close")}
              className="rounded-lg border border-border bg-surface-2 p-1.5 text-gray-500 transition-colors hover:bg-surface-3 hover:text-gray-200"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {total === 0 ? (
            <p className="py-10 text-center text-xs text-gray-500">{t("noMatches")}</p>
          ) : (
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {SHORTCUT_CATEGORIES.filter((key) => grouped[key].length > 0).map((key) => (
                <section key={key} aria-label={t(`categories.${key}`)}>
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                    {t(`categories.${key}`)}
                  </h3>
                  <ul className="space-y-0.5">
                    {grouped[key].map(({ def, label }) => {
                      const live = isLive(def, boundIds);
                      return (
                        <li
                          key={def.id}
                          className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                            live ? "" : "opacity-45"
                          }`}
                          title={live ? undefined : t("unavailableHere")}
                        >
                          <span className="min-w-0 flex-1 truncate text-xs text-gray-300">
                            {label}
                          </span>
                          <ShortcutDefKeys def={def} size="sm" className="flex-shrink-0" />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <p className="border-t border-border px-4 py-2 text-[10px] text-gray-600">
          {t("footerHint")}
        </p>
      </div>
    </div>
  );
}
