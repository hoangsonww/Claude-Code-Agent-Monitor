/**
 * @file Settings.sections.test.ts
 * @description Guards the coupling between the Settings page's in-page table of
 * contents and the sections it links to. `SETTINGS_SECTIONS` drives both the
 * TOC buttons and the `IntersectionObserver` scroll-spy, and each entry is
 * matched to the page body only by a bare `id` string. Adding a section but
 * forgetting its TOC entry hides it from navigation; adding a TOC entry but
 * forgetting the section produces a dead scroll target and a scroll-spy that
 * silently observes nothing. Neither shows up in a render snapshot, so this
 * asserts the two lists agree, in order.
 *
 * Reads the page source through Vite's `?raw` import rather than `node:fs`: the
 * client tsconfig is DOM-only, so a Node builtin here typechecks locally under
 * Vitest but breaks `tsc -b` in the production build.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
// Vite's `?raw` suffix hands back the file's text. Preferred over node:fs here
// so the test typechecks under the client's DOM-only tsconfig, which carries no
// Node types.
import source from "../Settings.tsx?raw";

/** First capture group of every match, dropping any that did not capture. The
 *  client tsconfig sets `noUncheckedIndexedAccess`, so this narrows once here
 *  instead of asserting at each call site. */
function captures(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined);
}

/** Ids listed in the `SETTINGS_SECTIONS` table-of-contents array. */
function tocIds(): string[] {
  const start = source.indexOf("const SETTINGS_SECTIONS");
  expect(start, "SETTINGS_SECTIONS must exist").toBeGreaterThan(-1);
  const end = source.indexOf("\n];", start);
  expect(end, "SETTINGS_SECTIONS must be a closed array").toBeGreaterThan(start);

  const block = source.slice(start, end);
  return captures(block, /\bid:\s*"([^"]+)"/g);
}

/** Ids of the `<section id="...">` elements rendered in the page body. */
function renderedSectionIds(): string[] {
  return captures(source, /<section\s+id="([^"]+)"/g);
}

describe("Settings in-page navigation", () => {
  it("links every table-of-contents entry to a section that exists", () => {
    const rendered = new Set(renderedSectionIds());
    const missing = tocIds().filter((id) => !rendered.has(id));

    expect(missing, "TOC entries with no matching <section id>").toEqual([]);
  });

  it("lists every rendered section in the table of contents", () => {
    const toc = new Set(tocIds());
    const unlisted = renderedSectionIds().filter((id) => !toc.has(id));

    expect(unlisted, "sections missing a SETTINGS_SECTIONS entry").toEqual([]);
  });

  it("keeps the two lists in the same order, so the TOC matches the page", () => {
    // The scroll-spy highlights whichever observed section is nearest the top,
    // so a TOC ordered differently from the body reads as jumping around.
    expect(tocIds()).toEqual(renderedSectionIds());
  });

  it("gives every section the scroll-margin the sticky TOC needs", () => {
    // Without `scroll-mt-*`, jumping to a section parks it under the sticky
    // header and the heading is invisible.
    const withoutScrollMargin = [
      ...source.matchAll(/<section\s+id="([^"]+)"\s+className="([^"]*)"/g),
    ]
      .filter((match) => !/\bscroll-mt-/.test(match[2] ?? ""))
      .map((match) => match[1]);

    expect(withoutScrollMargin, "sections missing scroll-mt-*").toEqual([]);
  });
});
