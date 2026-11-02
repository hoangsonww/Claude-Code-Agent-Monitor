/**
 * @file vitest.config.ts
 * @description Vitest configuration for the client test suite — jsdom environment, React plugin, test globals, and the same build-time `__APP_VERSION__` injection as vite.config.ts so version-dependent components render identically under test.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/vitest.config.ts
 * **Area:** client build or application entry
 * **Responsibility:**
 * Vitest configuration for the client test suite — jsdom environment, React plugin, test globals,
 * and the same build-time `__APP_VERSION__` injection as vite.config.ts so version-dependent
 * components render identically under test.
 *
 * ## Architectural boundary
 * - Owns a focused TypeScript responsibility within the repository and should remain loadable only
 *   by its intended consumers.
 * - Public exports are compatibility surfaces; internal declarations may change only while their
 *   observable behavior remains stable.
 * - Cross-package dependencies should point through established contracts rather than reaching into
 *   build output or private state.
 *
 * ## Package dependency edges
 * - `@vitejs/plugin-react` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:fs` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:path` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest/config` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `default` (default export) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `APP_VERSION` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `resolveAppVersion` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
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
 *   `node scripts/maintain-typescript-docs.ts --check client/vitest.config.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Resolve the version injected as `__APP_VERSION__` in tests, mirroring `vite.config.ts` so
 * components that render it (such as the sidebar footer) behave the same as in the app. Same
 * fail-safe order: repo root, then client, then a placeholder.
 *
 * @returns The version string.
 */
function resolveAppVersion(): string {
  for (const rel of ["../package.json", "package.json"]) {
    try {
      const { version } = JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf8"));
      if (version) return version as string;
    } catch {
      // Not found or unreadable at this path — try the next candidate.
    }
  }
  return "0.0.0";
}
/** Version injected as `__APP_VERSION__` in tests. */
const APP_VERSION = resolveAppVersion();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    css: false,
  },
});
