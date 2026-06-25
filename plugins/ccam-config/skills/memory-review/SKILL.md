---
description: >
  Review the file-based memory store via the Agent Monitor Config Explorer API:
  the user and project CLAUDE.md plus per-project auto-memory files under
  ~/.claude/projects/<slug>/memory/*.md. Groups by project, shows the index
  (MEMORY.md) vs per-fact files, and flags stale or oversized facts. Reads
  /api/cc-config/memory and /api/cc-config/file?path=. Use when curating agent
  memory.
---

# Memory Review

Curate the user's file-based agent memory: the long-form CLAUDE.md files plus
the per-project auto-memory store — read through the Agent Monitor dashboard at
`http://localhost:4820`.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty — review the whole memory store across every project (default).
- a project slug (e.g. `-Users-david-WebstormProjects-foo`) — restrict the
  review to that one project's auto-memory dir.
- "claude-md" — review only the user/project CLAUDE.md files.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/cc-config/memory` | `{ items:[…] }`. CLAUDE.md entries: `{ scope:"user"\|"project", file, size, mtime, preview }`. Auto-memory entries: `{ scope:"auto-memory", project, name, isIndex, file, size, mtime, frontmatter, preview }` |
| `GET /api/cc-config/file?path=<abs>` | full body of one file: `{ ok, file, size, mtime, truncated, text }` — use to read a fact in full before recommending an edit |

## Report Sections

### 1. CLAUDE.md overview
List the user and project CLAUDE.md entries with `scope`, `size` (KB), and
last-modified (`mtime`). Note any that are `truncated` (over 256 KB) — these
are oversized and worth splitting into auto-memory facts.

### 2. Per-project auto-memory, grouped
Group `scope: "auto-memory"` items by `project`. For each project show the
**index** (`isIndex: true`, typically `MEMORY.md`) first, then the per-fact
files. For each fact show `name`, `frontmatter.description` if present, `size`,
and `mtime`.

### 3. Index vs per-fact consistency
Within each project, compare the index (`MEMORY.md`) against the per-fact files
present. Flag facts that exist on disk but are not referenced by the index, and
index entries that point at files which no longer appear in `/memory`.

### 4. Stale & oversized facts
Flag facts whose `mtime` is old relative to the rest of the store (stale —
candidates to confirm or retire) and facts whose `size` is large (oversized —
candidates to split into smaller, single-fact files). When the user wants to
act on one, fetch its full body with `GET /api/cc-config/file?path=<file>`
before recommending changes.

## Editing memory (mutations)

Auto-memory files are editable through the Config Explorer. To create/overwrite
a fact:

```bash
curl -s -X PUT http://localhost:4820/api/cc-config/file \
  -H 'Content-Type: application/json' \
  -d '{"scope":"auto-memory","type":"auto-memory","project":"<slug>","name":"<fact>.md","content":"..."}'
```

To delete a fact:

```bash
curl -s -X DELETE http://localhost:4820/api/cc-config/file \
  -H 'Content-Type: application/json' \
  -d '{"scope":"auto-memory","type":"auto-memory","project":"<slug>","name":"<fact>.md"}'
```

A timestamped backup is written automatically before any edit or delete.
The user/project CLAUDE.md uses `type:"memory"` with a `scope` and no `name`.
**Never edit or delete a memory file without explicit per-action confirmation
from the user** — default to read-only review.

## Output

- Section 1 as a short table (`Scope | File | Size | Modified | Truncated`).
- Section 2 grouped by project, index first, then facts.
- Sizes in KB; timestamps as relative age; use ▲ for oversized / stale flags.
- Cite only fields the API returned — never invent facts, names, or sizes.
- If the dashboard is unreachable at `http://localhost:4820`, say so and tell
  the user to start it with `npm start` from the repo root.
