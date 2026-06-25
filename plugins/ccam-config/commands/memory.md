---
description: List the file-based memory store grouped by project (auto-memory) plus the CLAUDE.md files.
argument-hint: "[project-filter]"
---

List the user's file-based memory store from the Agent Monitor Config Explorer
at `http://localhost:4820`. If **$ARGUMENTS** is given, treat it as a
project-slug filter and show only matching auto-memory groups.

```bash
curl -s http://localhost:4820/api/cc-config/memory
```

The response is `{ items: [...] }`. Two kinds of entry:
- **CLAUDE.md** — `{ scope:"user"|"project", file, size, mtime, preview }`.
- **Auto-memory facts** — `{ scope:"auto-memory", project, name, isIndex, file,
  size, mtime, frontmatter, preview }`.

Print in two parts:

1. **CLAUDE.md** — one line per entry: `scope`, `size` (KB), last-modified.
   Flag any with `truncated: true` as oversized.

2. **Auto-memory, grouped by `project`** — for each project (filtered by
   `$ARGUMENTS` if provided), list the index file (`isIndex: true`, usually
   `MEMORY.md`) first, then each per-fact file with `name`,
   `frontmatter.description` (or start of `preview`), `size` (KB), and `mtime`.

```
Memory store
  CLAUDE.md
    user ..... 8.2 KB   modified 3d ago
    project .. 1.1 KB   modified 1h ago

  Project: -Users-david-WebstormProjects-foo   (4 files)
    MEMORY.md (index) ......... 0.6 KB
    feature_x_decision.md ..... 0.3 KB  — "why we chose X over Y"
    api_quirk.md .............. 0.2 KB  — "endpoint Z returns 200 on error"
```

Cite only fields the API returned — never invent facts, names, or sizes. Note
that auto-memory files are editable via `PUT`/`DELETE /api/cc-config/file`
(a backup is taken automatically) but this command is read-only. If the
dashboard is unreachable, say so and tell the user to start it with `npm start`
from the repo root.
