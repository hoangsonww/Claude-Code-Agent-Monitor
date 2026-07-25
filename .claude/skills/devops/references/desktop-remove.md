# desktop-remove — remove the installed desktop app

**DESTRUCTIVE.** Quits `Claude Code Monitor.app` if it's running, then
deletes it from `/Applications`.

## Phase 1 — Audit (always first, read-only)

Run the shared audit script and show Sara the table:

```bash
zsh <skill-base-dir>/scripts/desktop-check.sh
```

If `app-installed` is `absent`, report "nothing installed to remove" and
stop.

If invoked in status-only mode (bare `/devops`), stop after showing the table.

## Phase 2 — Plan

| Removed | Re-acquire cost | Data outside the app bundle |
|---|---|---|
| `/Applications/Claude Code Monitor.app` | Fast — `/devops desktop-build` rebuilds and reinstalls in about a minute, no re-download needed | `~/Library/Application Support/Claude Code Monitor/` (SQLite DB, VAPID keys) and `~/Library/Logs/Claude Code Monitor/` (log files) — **not** touched by removing the app bundle |

Removing the app bundle itself is cheaply reversible (`desktop-build`
brings it right back). The data directories are a separate, much less
reversible decision — that's why they get their own gate below instead of
being bundled into "yes, remove."

This is the one command in this skill that isn't a no-op-safe re-run: it
quits a running app and deletes files outside anything this skill built.

🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧

> 🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧
>
> **Human decision needed:** Quit and delete
> `/Applications/Claude Code Monitor.app`? (yes / no)

If `app-data` and/or `app-logs` showed `present` in the audit, ask a
**second, separate** gate — do not fold this into the "yes" above:

🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧

> 🟧🟧🟧 HUMAN GATE REQUIRED 🟧🟧🟧
>
> **Human decision needed:** Also delete the app's data and logs at
> `~/Library/Application Support/Claude Code Monitor/` and
> `~/Library/Logs/Claude Code Monitor/`? This is your session history and
> database — not recoverable once deleted.
>
> **A)** Keep the data (default) — a future `/devops desktop-build` picks
> right back up where you left off
> **B)** Purge the data too

## Phase 3 — Execute (only after confirmation)

### 3.1 Quit + remove the app (always, once the first gate is confirmed)

```bash
osascript -e 'quit app "Claude Code Monitor"' 2>/dev/null || true
sleep 1
rm -rf "/Applications/Claude Code Monitor.app"
```

### 3.2 Purge data (only if the second gate was answered **B**)

```bash
rm -rf "$HOME/Library/Application Support/Claude Code Monitor"
rm -rf "$HOME/Library/Logs/Claude Code Monitor"
```

If the second gate was answered **A** (or there was nothing to ask because
the audit showed no data present), skip this step entirely — leave those
directories untouched.

## Phase 4 — Verify

Re-run the shared audit:

- `app-installed` now reads `absent`.
- `app-running` now reads "not running".
- `app-data` / `app-logs` match what was actually confirmed — still
  `present` if kept, `absent` if purged. Report the real on-disk state,
  don't assume the confirmed choice took effect.

## Notes

- A plain `desktop-remove` (data question answered **A**, or no data
  existed) followed by `/devops desktop-build` restores the exact same
  session history and database — removing the app bundle alone never
  resets that data.
- If Sara asks to reinstall right after removing, the answer is
  `/devops desktop-build` (alias `up`) — same command as any other rebuild.
