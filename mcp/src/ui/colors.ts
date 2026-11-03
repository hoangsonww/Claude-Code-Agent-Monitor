/**
 * @file colors.ts
 * @description Provides utility functions for applying ANSI color codes to text in the terminal. This module defines a set of functions for styling text with various colors and modifiers such as bold, italic, underline, and strikethrough. It also includes support for 256-color mode and a function to strip ANSI codes from text. The color functions are designed to be composable, allowing for easy combination of styles. The module checks for color support in the terminal environment and gracefully degrades if colors are not supported.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** mcp/src/ui/colors.ts
 * **Area:** MCP server
 * **Responsibility:**
 * Provides utility functions for applying ANSI color codes to text in the terminal. This module
 * defines a set of functions for styling text with various colors and modifiers such as bold,
 * italic, underline, and strikethrough. It also includes support for 256-color mode and a function
 * to strip ANSI codes from text. The color functions are designed to be composable, allowing for
 * easy combination of styles. The module checks for color support in the terminal environment and
 * gracefully degrades if colors are not supported.
 *
 * ## Architectural boundary
 * - Composes MCP configuration, API access, logging, registry, lifecycle, and transport-independent
 *   server behavior.
 * - Domain modules own individual tools; this layer owns consistent registration and process-level
 *   coordination.
 * - Host disappearance and signals must converge on bounded, idempotent cleanup.
 *
 * ## Public surface
 * - `accent` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bg256` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `bgBlue` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bgCyan` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bgGray` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bgGreen` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bgMagenta` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bgRed` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `bgWhite` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `bgYellow` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `black` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `blue` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `bold` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `brightBlue` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `brightCyan` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `brightGreen` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `brightMagenta` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `brightRed` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `brightWhite` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `brightYellow` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `cyan` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `dim` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `error` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `fg256` (function) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `gray` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `green` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `highlight` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `info` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `italic` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `label` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `magenta` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `muted` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `red` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `reset` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `strikethrough` (variable) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `stripAnsi` (function) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `success` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `underline` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 * - `warn` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `white` (variable) — exported contract; search downstream imports and tests before changing its
 *   name, shape, or timing.
 * - `yellow` (variable) — exported contract; search downstream imports and tests before changing
 *   its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `accent` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bg256` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgBlue` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgCyan` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgGray` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgGreen` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgMagenta` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgRed` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgWhite` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bgYellow` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `black` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `blue` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `bold` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `brightBlue` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `brightCyan` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `brightGreen` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `brightMagenta` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `brightRed` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `brightWhite` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `brightYellow` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `cyan` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `dim` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `error` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `fg256` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `gray` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `green` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `highlight` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `info` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `isColorSupported` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `italic` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `label` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `magenta` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `muted` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `red` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `reset` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `strikethrough` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `stripAnsi` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `success` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `underline` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `warn` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `white` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `wrap` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `yellow` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## Area invariants
 * - Keep server metadata and advertised capabilities synchronized with the actual registered
 *   implementation.
 * - Do not let one tool-registration failure leave a partially initialized server accepting
 *   requests.
 * - Preserve transport neutrality for tool behavior and result formatting.
 * - Route logs away from protocol stdout and redact secret-bearing fields.
 * - Make startup failures explicit and nonzero while allowing graceful close to finish in-flight
 *   cleanup.
 * - Keep orphan detection bounded and compare against the correct startup parent semantics.
 * - Avoid module-evaluation side effects that complicate tests or create resources before
 *   configuration validates.
 * - Keep tool collection deterministic so schemas and help output do not reorder between runs.
 * - Treat unhandled rejection and exception paths as process health failures without double-running
 *   shutdown.
 * - Test server construction independently from real network transports where the SDK permits it.
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
 * - Run `npm run mcp:typecheck` and resolve failures before widening the verification scope.
 * - Run `npm run mcp:build` and resolve failures before widening the verification scope.
 * - Run `npm run test:mcp` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check mcp/src/ui/colors.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/ui/colors.ts`
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
 * ## Public surface
 * - `bold` — exported API; see TSDoc on the symbol for behavior.
 * - `dim` — exported API; see TSDoc on the symbol for behavior.
 * - `italic` — exported API; see TSDoc on the symbol for behavior.
 * - `underline` — exported API; see TSDoc on the symbol for behavior.
 * - `strikethrough` — exported API; see TSDoc on the symbol for behavior.
 * - `black` — exported API; see TSDoc on the symbol for behavior.
 * - `red` — exported API; see TSDoc on the symbol for behavior.
 * - `green` — exported API; see TSDoc on the symbol for behavior.
 * - `yellow` — exported API; see TSDoc on the symbol for behavior.
 * - `blue` — exported API; see TSDoc on the symbol for behavior.
 * - `magenta` — exported API; see TSDoc on the symbol for behavior.
 * - `cyan` — exported API; see TSDoc on the symbol for behavior.
 * - `white` — exported API; see TSDoc on the symbol for behavior.
 * - `gray` — exported API; see TSDoc on the symbol for behavior.
 * - `brightRed` — exported API; see TSDoc on the symbol for behavior.
 * - `brightGreen` — exported API; see TSDoc on the symbol for behavior.
 * - `brightYellow` — exported API; see TSDoc on the symbol for behavior.
 * - `brightBlue` — exported API; see TSDoc on the symbol for behavior.
 * - `brightMagenta` — exported API; see TSDoc on the symbol for behavior.
 * - `brightCyan` — exported API; see TSDoc on the symbol for behavior.
 * - `brightWhite` — exported API; see TSDoc on the symbol for behavior.
 * - `bgRed` — exported API; see TSDoc on the symbol for behavior.
 * - `bgGreen` — exported API; see TSDoc on the symbol for behavior.
 * - `bgYellow` — exported API; see TSDoc on the symbol for behavior.
 * - `bgBlue` — exported API; see TSDoc on the symbol for behavior.
 * - `bgMagenta` — exported API; see TSDoc on the symbol for behavior.
 * - `bgCyan` — exported API; see TSDoc on the symbol for behavior.
 * - `bgWhite` — exported API; see TSDoc on the symbol for behavior.
 * - `bgGray` — exported API; see TSDoc on the symbol for behavior.
 * - `fg256` — exported API; see TSDoc on the symbol for behavior.
 * - `bg256` — exported API; see TSDoc on the symbol for behavior.
 * - `reset` — exported API; see TSDoc on the symbol for behavior.
 * - `stripAnsi` — exported API; see TSDoc on the symbol for behavior.
 * - `success` — exported API; see TSDoc on the symbol for behavior.
 * - `error` — exported API; see TSDoc on the symbol for behavior.
 * - `warn` — exported API; see TSDoc on the symbol for behavior.
 * - `info` — exported API; see TSDoc on the symbol for behavior.
 * - `muted` — exported API; see TSDoc on the symbol for behavior.
 * - `highlight` — exported API; see TSDoc on the symbol for behavior.
 * - `label` — exported API; see TSDoc on the symbol for behavior.
 * - … plus 1 additional exports
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
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **bold**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **dim**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **italic**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **underline**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **strikethrough**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **black**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **red**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **green**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **yellow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **blue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **magenta**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **cyan**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **white**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **gray**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightRed**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightGreen**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightYellow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightBlue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightMagenta**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightCyan**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **brightWhite**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgRed**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgGreen**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgYellow**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgBlue**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgMagenta**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgCyan**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgWhite**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bgGray**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **fg256**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **bg256**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **reset**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **stripAnsi**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **success**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **error**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **warn**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **info**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **muted**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **highlight**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **label**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **accent**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

/** Whether ANSI colors should be emitted: `NO_COLOR` always disables;
 * `FORCE_COLOR=0` disables, any other `FORCE_COLOR` enables regardless of
 * TTY; otherwise enabled only on an interactive stdout TTY. Computed once
 * at module load. */
const isColorSupported =
  process.env.FORCE_COLOR !== "0" &&
  process.env.NO_COLOR === undefined &&
  (process.env.FORCE_COLOR !== undefined || (process.stdout.isTTY ?? false));

/** Builds a styling function wrapping text in ANSI open/close codes, or an
 * identity function when colors are unsupported — every color/modifier
 * below is built with this, so disabling color no-ops all of them at once.
 *
 * @param open - SGR code that starts the style.
 * @param close - SGR code that ends it.
 * @returns A function wrapping text in the two codes.
 */
function wrap(open: string, close: string): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[${open}m${text}\x1b[${close}m`;
}

// Modifiers
/**
 * Render text in bold or increased intensity (SGR 1, reset with SGR 22). Returns the text unchanged
 * when colors are disabled.
 */
export const bold = wrap("1", "22");
/**
 * Render text in dim (faint) intensity (SGR 2, reset with SGR 22). Returns the text unchanged when
 * colors are disabled.
 */
export const dim = wrap("2", "22");
/**
 * Render text in italic (SGR 3, reset with SGR 23). Returns the text unchanged when colors are
 * disabled.
 */
export const italic = wrap("3", "23");
/**
 * Render text in underline (SGR 4, reset with SGR 24). Returns the text unchanged when colors are
 * disabled.
 */
export const underline = wrap("4", "24");
/**
 * Render text in strikethrough (SGR 9, reset with SGR 29). Returns the text unchanged when colors
 * are disabled.
 */
export const strikethrough = wrap("9", "29");

// Foreground colors
/**
 * Render text in black (SGR 30, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const black = wrap("30", "39");
/**
 * Render text in red (SGR 31, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const red = wrap("31", "39");
/**
 * Render text in green (SGR 32, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const green = wrap("32", "39");
/**
 * Render text in yellow (SGR 33, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const yellow = wrap("33", "39");
/**
 * Render text in blue (SGR 34, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const blue = wrap("34", "39");
/**
 * Render text in magenta (SGR 35, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const magenta = wrap("35", "39");
/**
 * Render text in cyan (SGR 36, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const cyan = wrap("36", "39");
/**
 * Render text in white (SGR 37, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const white = wrap("37", "39");
/**
 * Render text in gray (SGR 90, reset to the default foreground with SGR 39). Returns the text
 * unchanged when colors are disabled.
 */
export const gray = wrap("90", "39");

// Bright foreground colors
/**
 * Render text in bright red (high-intensity SGR 91, reset to the default foreground with SGR 39).
 * Returns the text unchanged when colors are disabled.
 */
export const brightRed = wrap("91", "39");
/**
 * Render text in bright green (high-intensity SGR 92, reset to the default foreground with SGR 39).
 * Returns the text unchanged when colors are disabled.
 */
export const brightGreen = wrap("92", "39");
/**
 * Render text in bright yellow (high-intensity SGR 93, reset to the default foreground with SGR
 * 39). Returns the text unchanged when colors are disabled.
 */
export const brightYellow = wrap("93", "39");
/**
 * Render text in bright blue (high-intensity SGR 94, reset to the default foreground with SGR 39).
 * Returns the text unchanged when colors are disabled.
 */
export const brightBlue = wrap("94", "39");
/**
 * Render text in bright magenta (high-intensity SGR 95, reset to the default foreground with SGR
 * 39). Returns the text unchanged when colors are disabled.
 */
export const brightMagenta = wrap("95", "39");
/**
 * Render text in bright cyan (high-intensity SGR 96, reset to the default foreground with SGR 39).
 * Returns the text unchanged when colors are disabled.
 */
export const brightCyan = wrap("96", "39");
/**
 * Render text in bright white (high-intensity SGR 97, reset to the default foreground with SGR 39).
 * Returns the text unchanged when colors are disabled.
 */
export const brightWhite = wrap("97", "39");

// Background colors
/**
 * Render text on a red background (SGR 41, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgRed = wrap("41", "49");
/**
 * Render text on a green background (SGR 42, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgGreen = wrap("42", "49");
/**
 * Render text on a yellow background (SGR 43, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgYellow = wrap("43", "49");
/**
 * Render text on a blue background (SGR 44, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgBlue = wrap("44", "49");
/**
 * Render text on a magenta background (SGR 45, reset to the default background with SGR 49).
 * Returns the text unchanged when colors are disabled.
 */
export const bgMagenta = wrap("45", "49");
/**
 * Render text on a cyan background (SGR 46, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgCyan = wrap("46", "49");
/**
 * Render text on a white background (SGR 47, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgWhite = wrap("47", "49");
/**
 * Render text on a gray background (SGR 100, reset to the default background with SGR 49). Returns
 * the text unchanged when colors are disabled.
 */
export const bgGray = wrap("100", "49");

// 256-color support

/** Foreground-color function for an xterm 256-color index; not currently
 * used by any composable style below.
 *
 * @param code - xterm 256-color index, 0 to 255.
 * @returns A function coloring text with that foreground.
 */
export function fg256(code: number): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[38;5;${code}m${text}\x1b[39m`;
}

/**
 * Background-color function for an xterm 256-color index.
 *
 * @param code - xterm 256-color index, 0 to 255.
 * @returns A function coloring text with that background.
 */
export function bg256(code: number): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[48;5;${code}m${text}\x1b[49m`;
}

// Utility
/** Raw ANSI "reset all styles" sequence, or `""` when colors are disabled. */
export const reset = isColorSupported ? "\x1b[0m" : "";

/** Strips ANSI SGR sequences from `text`. Used throughout `ui/formatter.ts`
 * to measure/pad colored strings by visible length, not byte length.
 *
 * @param text - Possibly colored text.
 * @returns The text without SGR codes.
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// Composable styles
/** Semantic style aliases used throughout `ui/banner.ts`, `ui/formatter.ts`,
 * and `transports/repl.ts` so call sites express intent, not a specific color.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const success = (t: string) => bold(green(t));
/**
 * Style for error messages: bold red.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const error = (t: string) => bold(red(t));
/**
 * Style for warnings: bold yellow.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const warn = (t: string) => bold(yellow(t));
/**
 * Style for informational notices: bold cyan.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const info = (t: string) => bold(cyan(t));
/**
 * Style for secondary text such as hints, timestamps, and separators: dim gray.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const muted = (t: string) => dim(gray(t));
/**
 * Style for emphasized values the user should notice: bold bright magenta.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const highlight = (t: string) => bold(brightMagenta(t));
/**
 * Style for field labels in key/value output: bold bright white.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const label = (t: string) => bold(brightWhite(t));
/**
 * Style for accents such as headings and prompts: bold bright cyan.
 *
 * @param t - Text to style.
 * @returns The styled text, or `t` unchanged when colors are disabled.
 */
export const accent = (t: string) => bold(brightCyan(t));
