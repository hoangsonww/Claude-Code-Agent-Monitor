/**
 * @file wiki-i18n.test.ts
 * @description Node-side live-DOM coverage tests for the static wiki's body, labels, metadata, attributes, markup, and cache versions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const LANGUAGES = ["zh", "vi", "ko", "es"] as const;
const WIKI_DIR = path.resolve(process.cwd(), "../wiki");
const INDEX_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "index.html"), "utf8");
const SCRIPT_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "script.js"), "utf8");
const CONTENT_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "i18n-content.js"), "utf8");
const SERVICE_WORKER_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "sw.js"), "utf8");
const STYLE_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "style.css"), "utf8");

type TranslationMap = Record<string, string>;
type LocaleMaps = Record<(typeof LANGUAGES)[number], TranslationMap>;
type TranslationMatrix = Record<string, Record<(typeof LANGUAGES)[number], string>>;

const normalize = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

const evaluateObject = <T>(startMarker: string, endMarker: string): T => {
  const start = SCRIPT_SOURCE.indexOf(startMarker);
  const end = SCRIPT_SOURCE.indexOf(endMarker, start + startMarker.length);
  expect(start, `${startMarker} exists`).toBeGreaterThanOrEqual(0);
  expect(end, `${endMarker} exists`).toBeGreaterThan(start);
  const literal = SCRIPT_SOURCE.slice(start + startMarker.length, end).replace(/;\s*$/, "");
  return vm.runInNewContext(`(${literal})`) as T;
};

const contentSandbox = {
  window: {} as { __WIKI_CONTENT_I18N?: LocaleMaps & { plain: LocaleMaps } },
};
vm.runInNewContext(CONTENT_SOURCE, contentSandbox);
const CONTENT = contentSandbox.window.__WIKI_CONTENT_I18N!;
const PLAIN = evaluateObject<LocaleMaps>("  const T = ", "\n\n  const PLAIN");
const ATTRIBUTE_TRANSLATIONS = evaluateObject<TranslationMatrix>(
  "  const ATTRIBUTE_TRANSLATIONS = ",
  "\n  const ATTR"
);
const ATTR = Object.fromEntries(
  LANGUAGES.map((language) => [
    language,
    Object.fromEntries(
      Object.entries(ATTRIBUTE_TRANSLATIONS).map(([english, translations]) => [
        english,
        translations[language],
      ])
    ),
  ])
) as LocaleMaps;
const META = evaluateObject<Record<string, Record<string, string>>>(
  "  const META = ",
  "\n  const trH"
);

const dom = new JSDOM(INDEX_SOURCE);
const document = dom.window.document;
const HTML_SELECTOR = [
  ".main-content p:not(.hero-desc)",
  ".main-content li",
  ".main-content td",
  ".main-content th",
  ".main-content .screenshot-caption",
  ".main-content .callout-body > strong",
  ".main-content .route-desc",
  ".wiki-footer .footer-note",
  ".wiki-footer .footer-col-title",
  ".wiki-footer .footer-col-links a",
].join(", ");
const PLAIN_SELECTOR =
  ".logo-sub, .section-label, .nav-section, .nav-empty, .stat-label, .t-label, " +
  ".main-content h2, .main-content h3, .main-content h4, .main-content th, .hero-desc";

const stripTechnicalMarkup = (value: string): string =>
  value
    .replace(/<code>[\s\S]*?<\/code>/g, " TECH ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const containsProse = (value: string, minimumWords: number): boolean => {
  const text = stripTechnicalMarkup(value);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (/^[\w-]+(?:,\s*[\w-]+)+$/.test(text)) return false;
  return (
    wordCount >= minimumWords &&
    /\b(the|a|an|and|or|to|from|with|for|is|are|this|that|when|while|every|only|into|through|under|over|without|uses?|keeps?|shows?|runs?|adds?|opens?|reads?|writes?|includes?|supports?|protects?|configure|select|click|start|stop|what|how|why)\b/i.test(
      text
    )
  );
};

const tagMultiset = (value: string): string[] =>
  [...value.matchAll(/<\/?([a-z][\w-]*)\b[^>]*>/gi)]
    .flatMap((match) => (match[1] ? [match[1].toLowerCase()] : []))
    .sort();

describe("wiki i18n resources", () => {
  it("localizes live prose and scannable labels in every supported wiki locale", () => {
    const bodyKeys = [
      ...new Set(
        [...document.querySelectorAll(HTML_SELECTOR)]
          .map((element) => normalize(element.innerHTML))
          .filter((key) => containsProse(key, 5))
      ),
    ];
    const labelKeys = [
      ...new Set(
        [...document.querySelectorAll(PLAIN_SELECTOR)]
          .filter((element) => !element.children.length)
          .map((element) => normalize(element.textContent))
          .filter((key) => containsProse(key, 2))
      ),
    ];

    for (const language of LANGUAGES) {
      const labelTranslations = { ...CONTENT.plain[language], ...PLAIN[language] };
      const missingBody = bodyKeys.filter((key) => !CONTENT[language][key]);
      const missingLabels = labelKeys.filter((key) => !labelTranslations[key]);
      expect({ missingBody, missingLabels }, `${language} wiki coverage`).toEqual({
        missingBody: [],
        missingLabels: [],
      });
    }
  });

  it("localizes wiki metadata and every live image or assistive attribute", () => {
    const attributeValues = new Set<string>();
    for (const element of document.querySelectorAll(
      "[alt], [aria-label], [placeholder], [title]"
    )) {
      for (const name of ["alt", "aria-label", "placeholder", "title"]) {
        if (element.hasAttribute(name)) attributeValues.add(element.getAttribute(name)!);
      }
    }

    for (const language of LANGUAGES) {
      expect(META[language], `${language} metadata`).toBeTruthy();
      for (const key of attributeValues) {
        expect(ATTR[language][key], `${language} wiki attribute: ${key}`).toBeTruthy();
      }
    }
  });

  it("preserves the complete inline-tag set in every wiki body translation", () => {
    for (const language of LANGUAGES) {
      for (const [english, translation] of Object.entries(CONTENT[language])) {
        expect(tagMultiset(translation), `${language} wiki markup: ${english}`).toEqual(
          tagMultiset(english)
        );
      }
    }
  });

  it("keeps fixed-size wiki blocks inside their group's length budget", () => {
    /* Carousel cards share one fixed-height box and captions sit under a fixed
     * image column, so a block written at several times its neighbours' length
     * breaks the layout rather than just reading long. Same budgets the
     * .claude/skills/update-project-docs/scripts/wiki-block-lengths.sh helper
     * reports, enforced here so `npm run verify` catches an outlier. */
    /* Count code points, not UTF-16 units: every caption opens with a non-BMP
     * emoji, which would otherwise read one character longer here than in the
     * helper script and drift the two budgets apart. */
    const length = (element: Element | null): number => [...normalize(element?.textContent)].length;

    const groups: { label: string; sizes: number[]; names: string[]; tolerance: number }[] = [
      {
        label: "feature carousel card",
        sizes: [],
        names: [],
        tolerance: 1.5,
      },
      {
        label: "screenshot caption",
        sizes: [],
        names: [],
        tolerance: 2,
      },
    ];

    for (const card of document.querySelectorAll("#feature-carousel .feature-card")) {
      const heading = card.querySelector("h3");
      groups[0].names.push(heading?.id || normalize(heading?.textContent));
      groups[0].sizes.push(length(card.querySelector("p")));
    }
    for (const caption of document.querySelectorAll(".screenshot-caption")) {
      groups[1].names.push(normalize(caption.textContent).slice(0, 40));
      groups[1].sizes.push(length(caption));
    }

    for (const { label, sizes, names, tolerance } of groups) {
      expect(sizes.length, `${label}s found`).toBeGreaterThan(0);
      /* Same arithmetic as the helper script: statistics median (mean of the two
       * middles on an even group), truncated, then a truncated budget — so the
       * two never disagree about whether a block passes. */
      const ordered = [...sizes].sort((a, b) => a - b);
      const middle = Math.floor(ordered.length / 2);
      const median = Math.trunc(
        ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
      );
      const budget = Math.trunc(median * tolerance);
      const overlong = names
        .map((name, index) => ({ name, size: sizes[index] }))
        .filter((block) => block.size > budget)
        .map((block) => `${block.name} (${block.size} > ${budget})`);
      expect(overlong, `${label}s over budget (median ${median})`).toEqual([]);
    }
  });

  it("never scopes content styling on a class-free selector", () => {
    /* script.js's scroll-reveal pass adds `reveal-on-scroll` to every
     * below-the-fold direct child of a <section> at runtime, so a rule written
     * as `.main-content ul:not([class])` matches the static file, passes review,
     * and then silently stops applying in the browser. Block-level content
     * rules must not depend on an element having no class. (Inline rules like
     * `a:not([class])` are safe — the reveal pass only classes a section's own
     * children.) */
    const REVEALABLE = "p|ul|ol|div|table|pre|blockquote|h2|h3|h4";
    const classFree = new RegExp(`(?:^|[\\s>+~])(?:${REVEALABLE}):not\\(\\[class\\]\\)`);
    const offenders = STYLE_SOURCE.split("}")
      .map((block) =>
        block
          .slice(block.lastIndexOf("*/") + 1)
          .split("{")[0]
          .trim()
      )
      .filter((selector) => classFree.test(selector));
    expect(offenders, "class-free selectors in wiki/style.css").toEqual([]);
  });

  it("indents wiki prose lists despite the runtime reveal class", () => {
    const PROSE_LISTS = ".main-content section > ul, .main-content section > ol";
    const dom = new JSDOM(INDEX_SOURCE);
    const lists = [...dom.window.document.querySelectorAll(PROSE_LISTS)];
    expect(lists.length, "prose lists exist").toBeGreaterThan(0);
    for (const list of lists) {
      /* The reveal pass classes exactly this set, so the indent rules have to
       * keep matching afterwards. */
      list.classList.add("reveal-on-scroll");
      expect(
        list.matches(PROSE_LISTS),
        `${list.closest("section")?.id} list still matches the indent rule`
      ).toBe(true);
    }
    expect(STYLE_SOURCE).toMatch(
      /\.main-content section > ul,\s*\n\.main-content section > ol \{[^}]*padding-left: 24px;/
    );

    /* Bespoke lists nested inside a component keep their own layout — the
     * prose rules must not reach them. */
    const nested = [...dom.window.document.querySelectorAll(".main-content ul, .main-content ol")]
      .filter((list) => !list.matches(PROSE_LISTS))
      .map((list) => list.closest("section")?.id);
    expect(nested, "component lists excluded from the prose rules").toContain("vscode-ext");
  });

  it("keeps wiki asset versions synchronized with the service-worker precache", () => {
    /* The service worker is cache-first and matches on the full URL, query
     * string included, so a precache entry without the `?v=` the page requests
     * is never served — first load and offline would miss that asset. */
    for (const asset of ["style.css", "script.js", "i18n-content.js"]) {
      const indexVersion = INDEX_SOURCE.match(
        new RegExp(`${asset.replace(".", "\\.")}\\?v=(\\d+)`)
      )?.[1];
      const workerVersion = SERVICE_WORKER_SOURCE.match(
        new RegExp(`${asset.replace(".", "\\.")}\\?v=(\\d+)`)
      )?.[1];
      expect(indexVersion, `${asset} index version`).toBeTruthy();
      expect(workerVersion, `${asset} service-worker version`).toBe(indexVersion);
    }
  });
});
