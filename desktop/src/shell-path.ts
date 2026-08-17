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

// Markers fence the PATH off from any shell-startup noise (banners, MOTD, …).
// An interactive login shell may print arbitrary text before running our
// `-c` command (e.g. a `.zshrc` `neofetch` call); scanning for this sentinel
// pair — rather than trusting the last line of stdout — makes extraction
// robust to whatever the user's shell profile prints.
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
