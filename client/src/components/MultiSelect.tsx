/**
 * @file MultiSelect.tsx
 * @description Searchable custom multi-select popover for selecting several
 * options without relying on browser-native multi-select controls. It keeps
 * long labels readable through truncation plus full-value tooltips and uses
 * the dashboard's themed checkbox primitive for consistent interaction.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Checkbox } from "./Checkbox";

/** One selectable item in a {@link MultiSelect}. */
export interface MultiSelectOption {
  /** Stable value emitted through `onChange`. */
  value: string;
  /** Visible option label and value searched by the filter field. */
  label: string;
}

/** Props for the searchable multi-select popover. */
export interface MultiSelectProps {
  /** Accessible name for the trigger and popover. */
  label: string;
  /** All available options. */
  options: MultiSelectOption[];
  /** Controlled selected values. */
  value: string[];
  /** Called whenever one option is checked or unchecked. */
  onChange: (value: string[]) => void;
  /** Trigger text when there is no active selection. */
  allLabel: string;
  /** Summary shown on the trigger for two or more active selections. */
  selectedCountLabel: (count: number) => string;
  /** Placeholder inside the in-menu search field. */
  searchPlaceholder: string;
  /** Empty-state text when the search has no matches. */
  emptyLabel: string;
  /** Accessible label and visible text for clearing all selections. */
  clearLabel: string;
}

/**
 * An accessible, searchable multi-select that stays open as options are
 * toggled, allowing users to build a multi-value filter quickly.
 */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel,
  selectedCountLabel,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const dialogId = useId();

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedQuery));
  }, [options, query]);

  const selectedLabel = useMemo(() => {
    if (value.length === 0) return allLabel;
    if (value.length === 1)
      return options.find((option) => option.value === value[0])?.label ?? value[0];
    return selectedCountLabel(value.length);
  }, [allLabel, options, selectedCountLabel, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setOpenUp(below < 360 && rect.top > below);
    searchRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((selected) => selected !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selectedLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            close();
          }
        }}
        className={`flex h-[38px] w-full items-center gap-2 rounded-lg border px-3 text-left text-sm transition-colors focus:outline-none focus:border-accent/50 active:translate-y-px ${
          value.length > 0
            ? "border-accent/40 bg-accent/10 text-gray-100"
            : "border-border bg-surface-1 text-gray-300 hover:bg-surface-3"
        }`}
      >
        <span
          className="min-w-0 flex-1 truncate"
          title={value.length === 1 ? selectedLabel : undefined}
        >
          {selectedLabel}
        </span>
        {value.length > 1 && (
          <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent">
            {value.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={label}
          className={`absolute z-30 w-[min(32rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xl shadow-black/40 ${
            openUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    close();
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-surface-2 py-2 pl-8 pr-3 text-xs text-gray-100 placeholder:text-gray-500 outline-none transition-colors focus:border-accent/50"
              />
            </div>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-2 inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-surface-3 hover:text-gray-200 active:translate-y-px"
              >
                <X className="h-3 w-3" />
                {clearLabel}
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-5 text-center text-xs text-gray-500">{emptyLabel}</p>
            ) : (
              filteredOptions.map((option) => (
                <Checkbox
                  key={option.value}
                  checked={value.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="w-full rounded-md px-2 py-2 hover:bg-surface-3"
                  label={
                    <span className="block truncate" title={option.label}>
                      {option.label}
                    </span>
                  }
                  labelClassName="min-w-0 flex-1 truncate font-mono text-xs text-gray-300 group-hover:text-gray-100"
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
