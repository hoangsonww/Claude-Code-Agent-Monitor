/**
 * @file test-setup.ts
 * @description Vitest global setup for the React client test suite. Pulls in
 * jest-dom matchers, initializes the real i18n bundle (same as production),
 * forces English before each test, installs deterministic local/session storage
 * shims for Node runtimes without browser storage, and runs Testing Library
 * cleanup after every test to prevent DOM leakage between cases.
 *
 * Imported from `vitest.config.ts` via `setupFiles`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import "./i18n/index";
import i18n from "i18next";

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    key(index) {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}

// Node 26 exposes a process-level localStorage getter that returns undefined
// without --localstorage-file. Define deterministic jsdom-backed stores so the
// suite behaves the same on supported Node LTS and newer developer runtimes.
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage(),
  });
}
if (!globalThis.sessionStorage) {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memoryStorage(),
  });
}

/** Pin locale to English — LanguageDetector may otherwise pick up zh/vi from the host OS. */
beforeEach(() => {
  i18n.changeLanguage("en");
});

/** Unmount rendered trees and reset the document between tests. */
afterEach(() => {
  cleanup();
});
