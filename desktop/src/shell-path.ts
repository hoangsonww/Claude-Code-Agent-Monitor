/**
 * @file Recover the user's real shell `PATH`.
 *
 * A macOS app launched from Finder/Dock (or the Login Items auto-start) is
 * spawned by `launchd`, which gives it a minimal `PATH` — roughly
 * `/usr/bin:/bin:/usr/sbin:/sbin`. It does **not** source the user's shell
 * profile (`.zshrc` / `.zprofile` / `.bash_profile`).
 *
 * The dashboard's "Run Claude" feature spawns the `claude` CLI, which is
 * almost always installed somewhere only the shell `PATH` knows about —
 * `/opt/homebrew/bin`, `~/.local/bin`, `~/.claude/local`, a Node
 * version-manager's bin dir, etc. Under the minimal `launchd` `PATH`,
 * `which claude` fails and the dashboard reports *"the `claude` CLI isn't on
 * your PATH"* — even though the exact same server works when started from a
 * terminal, because a terminal hands down the full shell `PATH`.
 *
 * We run the user's login shell once at startup, capture its `PATH`, and merge
 * it into `process.env.PATH`. The embedded server runs in this same process,
 * so it (and every `claude` it spawns) inherits the corrected `PATH`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** desktop/src/shell-path.ts
 * **Area:** desktop shell
 * **Responsibility:**
 * Recover the user's real shell `PATH` . A macOS app launched from Finder/Dock (or the Login Items
 * auto-start) is spawned by `launchd` , which gives it a minimal `PATH` — roughly
 * `/usr/bin:/bin:/usr/sbin:/sbin` . It does **not** source the user's shell profile (`.zshrc` /
 * `.zprofile` / `.bash_profile` ). The dashboard's "Run Claude" feature spawns the `claude` CLI,
 * which is almost always installed somewhere only the shell `PATH` knows about —
 * `/opt/homebrew/bin` , `~/.local/bin` , `~/.claude/local` , a Node version-manager's bin dir, etc.
 * Under the minimal `launchd` `PATH` , `which claude` fails and the dashboard reports *"the
 * `claude` CLI isn't on your PATH"* — even though the exact same server works when started from a
 * terminal, because a terminal hands down the full shell `PATH` . We run the user's login shell
 * once at startup, capture its `PATH` , and merge it into `process.env.PATH` . The embedded server
 * runs in this same process, so it (and every `claude` it spawns) inherits the corrected `PATH` .
 *
 * ## Architectural boundary
 * - Owns Electron main-process lifecycle, local server hosting, native integration, and the narrow
 *   preload boundary.
 * - Renderer code remains web-compatible; privileged filesystem, process, tray, menu, and window
 *   operations stay here.
 * - Startup and shutdown coordinate one dashboard server instance without corrupting discovery or
 *   user data.
 *
 * ## Local dependency edges
 * - `./logger` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `node:child_process` — external package boundary; keep usage within the installed version and
 *   the repository's existing adapter patterns.
 * - `node:os` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `node:path` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `ensureUserPath` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `DELIM` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `ensureUserPath` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `loginShellPath` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 *
 * ## Area invariants
 * - Keep context isolation enabled and expose only the minimum typed preload surface required by
 *   the renderer.
 * - Do not enable arbitrary Node integration or pass unchecked renderer input into
 *   filesystem/process operations.
 * - Make window, tray, server, and app shutdown idempotent across quit, close, signal, and update
 *   paths.
 * - Resolve packaged and development resource paths explicitly for macOS, Windows, and Linux
 *   layouts.
 * - Use atomic writes for discovery and state files that another process may read during startup.
 * - Remove stale discovery metadata only when it belongs to the process being stopped.
 * - Keep single-instance and deep-link handling bounded to the intended application origin.
 * - Preserve platform-specific menu and login-item semantics without assuming one operating system.
 * - Avoid blocking the main process with synchronous work on hot lifecycle paths.
 * - Test pure path/lifecycle decisions and run the desktop-specific suite for process integration
 *   changes.
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
 * - Run `npm run desktop:test` and resolve failures before widening the verification scope.
 * - Run `npm run desktop:build` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check desktop/src/shell-path.ts` .
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
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/desktop/src/shell-path.ts`
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
 * ## Internal dependencies
 * - `./logger`
 *
 * ## Public surface
 * - `ensureUserPath` — exported API; see TSDoc on the symbol for behavior.
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
 * **ensureUserPath**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { spawnSync } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

import { log } from "./logger";

/**
 * Sentinel that fences the PATH off from shell startup noise (banners, MOTD, and so on). An
 * interactive login shell may print arbitrary text before running the `-c` command (for example a
 * `.zshrc` that calls `neofetch`), so scanning for this sentinel pair, rather than trusting the
 * last line of output, keeps extraction robust whatever the profile prints.
 */
const DELIM = "__CCAM_SHELL_PATH__";

/**
 * Run the user's login+interactive shell and capture its `PATH`. Returns null
 * on any failure (timeout, missing shell, unparseable output).
 */
function loginShellPath(): string | null {
  if (process.platform === "win32") return null;
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    // -i interactive (sources .zshrc/.bashrc), -l login (sources .zprofile),
    // -c command. printf avoids the trailing newline `echo` would add.
    const res = spawnSync(shell, ["-ilc", `printf '%s' "${DELIM}$PATH${DELIM}"`], {
      encoding: "utf8",
      timeout: 5000,
    });
    const out = `${res.stdout || ""}`;
    const start = out.indexOf(DELIM);
    const end = out.indexOf(DELIM, start + DELIM.length);
    if (start === -1 || end === -1) return null;
    const captured = out.slice(start + DELIM.length, end).trim();
    return captured || null;
  } catch (err) {
    log.warn("could not capture login-shell PATH", err);
    return null;
  }
}

/**
 * Merge the login-shell `PATH` — plus the common directories CLIs install
 * into — onto `process.env.PATH`. Idempotent: deduplicates entries, so it is
 * safe even if called more than once. No-op on Windows.
 */
export function ensureUserPath(): void {
  if (process.platform === "win32") return;

  const ordered: string[] = [];
  const seen = new Set<string>();
  /**
   * Append each segment of a PATH-style value that has not been seen yet, keeping first-seen order.
   */
  const add = (value?: string | null): void => {
    if (!value) return;
    for (const seg of value.split(path.delimiter)) {
      if (seg && !seen.has(seg)) {
        seen.add(seg);
        ordered.push(seg);
      }
    }
  };

  // 1. The user's real shell PATH — the authoritative source.
  add(loginShellPath());

  // 2. Common install locations, as a fallback if the shell capture missed
  //    them (or failed entirely).
  const home = os.homedir();
  add(
    [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      path.join(home, ".local", "bin"),
      path.join(home, ".claude", "local"),
      path.join(home, ".bun", "bin"),
      path.join(home, ".deno", "bin"),
      path.join(home, ".npm-global", "bin"),
    ].join(path.delimiter)
  );

  // 3. Whatever launchd already gave us, last.
  add(process.env.PATH);

  process.env.PATH = ordered.join(path.delimiter);
  log.info("user PATH resolved for spawned CLIs", { entries: ordered.length });
}
