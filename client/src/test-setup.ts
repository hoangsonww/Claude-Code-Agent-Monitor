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
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/test-setup.ts
 * **Area:** client build or application entry
 * **Responsibility:**
 * Vitest global setup for the React client test suite. Pulls in jest-dom matchers, initializes the
 * real i18n bundle (same as production), forces English before each test, installs deterministic
 * local/session storage shims for Node runtimes without browser storage, and runs Testing Library
 * cleanup after every test to prevent DOM leakage between cases. Imported from `vitest.config.ts`
 * via `setupFiles` .
 *
 * ## Architectural boundary
 * - Owns a focused TypeScript responsibility within the repository and should remain loadable only
 *   by its intended consumers.
 * - Public exports are compatibility surfaces; internal declarations may change only while their
 *   observable behavior remains stable.
 * - Cross-package dependencies should point through established contracts rather than reaching into
 *   build output or private state.
 *
 * ## Local dependency edges
 * - `./i18n/index` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `@testing-library/jest-dom/vitest` — external package boundary; keep usage within the installed
 *   version and the repository's existing adapter patterns.
 * - `@testing-library/react` — external package boundary; keep usage within the installed version
 *   and the repository's existing adapter patterns.
 * - `i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `memoryStorage` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Keep types narrower than the untrusted values they validate and avoid assertions that merely
 *   silence the compiler.
 * - Preserve deterministic output, ordering, and error behavior for identical inputs.
 * - Do not create module-evaluation side effects unless startup ownership is the module's explicit
 *   purpose.
 * - Use explicit units for time, bytes, tokens, money, and percentages.
 * - Keep nullable and optional fields distinct where absence carries meaning.
 * - Avoid hidden mutation of arguments and imported singleton state.
 * - Keep asynchronous work cancellable or safely ignorable after its consumer is gone.
 * - Return actionable errors without leaking secrets or unrelated implementation details.
 * - Document compatibility fallbacks beside the branch that implements them.
 * - Add focused tests for new boundary and failure cases.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/test-setup.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `client/src/test-setup.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import "./i18n/index";
import i18n from "i18next";

/**
 * In-memory `Storage` implementation for tests. Node 26 exposes a process-level `localStorage`
 * getter that returns undefined without `--localstorage-file`, so the suite installs these stores
 * to behave the same on every supported Node version.
 *
 * @returns A fresh, empty store.
 */
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
