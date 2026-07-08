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
