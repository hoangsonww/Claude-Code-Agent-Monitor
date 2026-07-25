# status — devops skill status report

Goal: one read-only report answering "what state is everything the devops
skill manages in right now?" Never installs, fixes, or changes anything.

## Procedure

1. **Discover** — enumerate every audit script in this skill's `scripts/`
   directory (`scripts/*-check.sh`). `desktop-setup-check.sh` belongs to
   `desktop-setup`; `web-setup-check.sh` belongs to `web-setup`.
   `desktop-check.sh` is shared by `desktop-build` and `desktop-remove` —
   report those two together under one section. `web-check.sh` is shared
   by `web-build`, `web-up`, and `web-down` — report those three together
   under one section. Neither shared script's commands get repeated tables.

2. **Run** — execute each audit script (they are all read-only and exit 0):

   ```bash
   zsh <skill-base-dir>/scripts/desktop-setup-check.sh
   zsh <skill-base-dir>/scripts/desktop-check.sh
   zsh <skill-base-dir>/scripts/web-setup-check.sh
   zsh <skill-base-dir>/scripts/web-check.sh
   ```

3. **Report** — for each command show:
   - A one-line verdict: **ready** (all build-relevant rows `ok`),
     **partial** (some `ok`, some not), or **not set up** (core rows
     MISSING/WRONG).
   - The full audit table (or, if long, only the non-`ok` rows plus a count
     of healthy ones).
   - If unhealthy: the exact command to fix it (e.g. `/devops desktop-setup`,
     `/devops web-setup`, `/devops web-build`).

4. **Extras worth including when relevant** (cheap, read-only): whether the
   desktop app is currently running (`app-running` row) and whether its
   data/logs exist on disk (relevant if Sara later runs `desktop-remove`);
   whether the web dev server is currently running and on what port
   (`web-running` row).

## Report format

```
## /devops status

| Command | Verdict | Fix |
|---|---|---|
| desktop-setup | ✅ ready | — |
| desktop-build / desktop-remove | ✅ ready | — |
| web-setup | ✅ ready | — |
| web-build / web-up / web-down | ✅ ready | — |

<details per command: audit table or non-ok rows>
```

Keep it scannable — verdicts first, detail after.
