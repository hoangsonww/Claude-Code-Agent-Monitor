---
description: >
  Inventory hooks across the user, project, and project-local settings plus the
  ~/.claude/hooks scripts directory — read through the Agent Monitor Config
  Explorer API — and flag hooks that POST to the network or run arbitrary
  commands. Reads /api/cc-config/hooks and /api/cc-config/hook-scripts. Use
  when auditing hook safety.
---

# Hook Inventory

Catalogue every Claude Code hook the user has configured and assess its safety —
read through the Agent Monitor dashboard at `http://localhost:4820`.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty — inventory all hooks across every scope (default).
- an event name (`PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`,
  `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Notification`,
  `PreCompact`) — restrict to that event.
- "scripts" — focus on the `~/.claude/hooks` handler scripts dir.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/cc-config/hooks` | `{ items:[{ scope:"user"\|"project"\|"project-local", file, exists, hooks:{ <Event>:[{ matcher, type, command, timeout }] } }] }` |
| `GET /api/cc-config/hook-scripts` | `{ dir, items:[{ name, file, size, mtime }] }` — the handler scripts under `~/.claude/hooks/` |

## Report Sections

### 1. Configured hooks by scope
From `/hooks`, flatten each source into `(scope, file, Event, matcher, type,
command, timeout)`. Group by `scope` (user, project, project-local). Show the
event, matcher, hook `type`, and the raw `command`. Note which `file` each came
from so the user can edit the right one.

### 2. Hook scripts on disk
From `/hook-scripts`, list each file in `~/.claude/hooks/` with `name`, `size`
(KB), and `mtime`. Cross-reference: flag scripts referenced by a hook `command`
but missing from disk, and scripts on disk that no configured hook calls
(orphaned).

### 3. Safety flags
For every `type: "command"` entry escalate:
- **Network egress (P0)** — the command contains `curl`, `wget`, `http`,
  `https`, `nc`, or pipes output off-box. Print the destination if visible.
- **Arbitrary execution (P1)** — pipes to `sh`/`bash`, evaluates downloaded
  content, or runs an unpinned interpreter on attacker-influenceable input.
- **No timeout (P2)** — a `command` hook with `timeout: null`; it can hang a
  session indefinitely.
- **Broad matcher (P3)** — `matcher: "*"` or empty on a destructive command.

## Output

- Section 1 as a table (`Scope | Event | Matcher | Type | Command | Timeout`).
- Section 3 as a findings table (`Hook | Risk | Severity | Detail`) with a
  one-line verdict first (SAFE / REVIEW NEEDED / RISKY HOOKS).
- Print raw commands verbatim — do not paraphrase a command you are flagging.
- Cite only fields the API returned — never fabricate hooks or commands.
- Note: hooks live inside settings.json and are read-only via the Config
  Explorer; edit them in the `file` named by the source, then reinstall with
  the dashboard's hook setup if needed.
- If the dashboard is unreachable at `http://localhost:4820`, say so and tell
  the user to start it with `npm start` from the repo root.
