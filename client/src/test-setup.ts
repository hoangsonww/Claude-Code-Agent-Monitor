import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import "./i18n/index";
import i18n from "i18next";

// Force English locale for deterministic test assertions
// (LanguageDetector may pick up zh from the system environment)
beforeEach(() => {
  i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
});
