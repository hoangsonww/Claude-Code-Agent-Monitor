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

const LANGUAGES = ["zh", "vi", "ko", "es", "it"] as const;
const WIKI_DIR = path.resolve(process.cwd(), "../wiki");
const INDEX_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "index.html"), "utf8");
const SCRIPT_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "script.js"), "utf8");
const CONTENT_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "i18n-content.js"), "utf8");
const SERVICE_WORKER_SOURCE = fs.readFileSync(path.join(WIKI_DIR, "sw.js"), "utf8");

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

  it("keeps wiki asset versions synchronized with the service-worker precache", () => {
    for (const asset of ["script.js", "i18n-content.js"]) {
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
