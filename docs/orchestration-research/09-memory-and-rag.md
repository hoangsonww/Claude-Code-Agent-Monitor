# 09 — Memory and (the absence of) RAG in Claude Code

How Claude Code's memory system actually works in v2.1.128, and
whether there is any implicit RAG (Retrieval-Augmented Generation)
implementation. Spoiler: no vector embeddings, no semantic search,
no codebase pre-indexing — but there *are* retrieval-flavored
mechanisms that use filesystem semantics rather than vector
semantics.

## The headline answer

**Claude Code memory is not RAG in the classical sense.** What's
present:

- Plain-markdown files (CLAUDE.md, MEMORY.md, topic files)
- Hierarchical loading by directory walk
- Conditional loading by glob patterns and file paths
- An index file (`MEMORY.md`) pointing to on-demand topic files
- Name-and-description-match dispatch for skills

What's not present:

- Vector embeddings
- Semantic search across memory or codebase
- A vector database (no Chroma, no Pinecone, no LanceDB built in)
- Cosine similarity or any kind of similarity scoring
- Codebase pre-indexing
- Re-ranking / RAG retrieval pipeline

The architectural bet: **long context windows + smart
filesystem-based loading patterns are sufficient.** No need for
embeddings if the agent can read the right files at the right time
through conditional loading and named indexes.

## Two memory systems, side by side

Per the official docs at `code.claude.com/docs/en/memory`:

|  | CLAUDE.md files | Auto memory |
|---|---|---|
| **Who writes** | You | Claude itself |
| **Format** | Plain markdown | Plain markdown + YAML frontmatter (typed) |
| **Loaded** | Full file at session start; subdir files on demand | First 200 lines / 25 KB of `MEMORY.md` at start; topic files on demand |
| **Scope** | Hierarchical: managed-policy → user → project → local | Per-git-repo, single directory |
| **Resolution** | Walks up the directory tree; concatenates all matches | One directory, indexed by `MEMORY.md` |
| **Imports** | `@path/to/file` syntax (recursive, max 5 hops) | None — flat directory of topic files |
| **Compaction survival** | Project-root CLAUDE.md re-injects after `/compact`; nested files reload on next read | Re-loaded from disk same as session start |

## On-disk layout (canonical)

```text
~/.claude/
├── CLAUDE.md                       # user-scoped (optional)
├── settings.json                   # hooks, permissions, plugins
├── projects/
│   └── -<encoded-project-path>/
│       ├── memory/                 # auto memory for THIS repo
│       │   ├── MEMORY.md           # index (eagerly loaded, capped)
│       │   ├── debugging.md        # topic files (loaded on demand)
│       │   └── *.md                # one file per accumulated topic
│       └── <session-uuid>.jsonl    # full session transcripts
└── plugins/                        # plugin-installed CLAUDE.md / skills

<project-root>/
├── CLAUDE.md                       # team-shared, version-controlled
├── CLAUDE.local.md                 # your personal, gitignored
└── .claude/
    ├── CLAUDE.md                   # alternate location for project CLAUDE.md
    ├── rules/                      # path-scoped rule files
    │   ├── backend-node.md         # may have YAML `paths:` frontmatter
    │   └── frontend-react.md
    └── settings.local.json         # per-project permissions
```

The encoded project path in `~/.claude/projects/` replaces `/` with
`-` (so `/Users/me/repo` becomes `-Users-me-repo`). Each git repo
shares one auto memory directory across all worktrees.

## Loading order and precedence

When you run `claude` in a project:

1. **Managed policy CLAUDE.md** at OS-specific system path (cannot
   be overridden)
2. **User CLAUDE.md** at `~/.claude/CLAUDE.md`
3. **Walk up** from cwd to filesystem root, loading every
   `CLAUDE.md` and `CLAUDE.local.md` found
4. Within each directory, `CLAUDE.md` is read before
   `CLAUDE.local.md`
5. Across the directory tree, root-most files appear in context
   *first*; cwd-closest files appear *last* (so cwd-local
   instructions can override broader ones)
6. **`.claude/rules/*.md`** files are loaded if they have no `paths`
   frontmatter, or load conditionally on first matching file read
7. **`MEMORY.md`** first 200 lines / 25 KB
8. **All `@path` imports** inside loaded CLAUDE.md files expand
   recursively (5 hop max)

`<!-- HTML comments -->` in CLAUDE.md are stripped before injection,
useful for human-only notes that shouldn't spend tokens.

## The retrieval-flavored mechanisms

These look RAG-ish but use filesystem semantics rather than vector
semantics.

### 1. MEMORY.md as an index → topic files

`MEMORY.md` is a hand-curated index. Only the first 200 lines / 25 KB
load eagerly. Topic files like `debugging.md`, `api-conventions.md`
are loaded **on demand** when Claude reads them via standard file
tools.

**Functionally identical to a knowledge-base index** — Claude
"retrieves" the right topic file by name match through the index
when relevant. No embeddings, but the access pattern is
retrieval-shaped.

Example MEMORY.md format Claude maintains:

```markdown
# Project memory index

- [debugging.md](debugging.md) — context-window OOM handling
- [api-conventions.md](api-conventions.md) — endpoint naming rules
- [build-commands.md](build-commands.md) — `npm run setup` requires Node 18
```

### 2. Path-scoped rules with glob frontmatter

In `.claude/rules/api.md`:

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/handlers/**/*.ts"
---

# API rules

- All endpoints must validate input
- Use the standard error response format
```

Loads only when Claude reads a file matching one of the globs.
**Conditional retrieval by file path**, not content similarity.

Patterns supported via standard glob syntax:

| Pattern | Matches |
|---|---|
| `**/*.ts` | All TypeScript files in any directory |
| `src/**/*` | Everything under `src/` |
| `*.md` | Markdown files in project root only |
| `src/components/*.tsx` | React components in a specific directory |
| `src/**/*.{ts,tsx}` | Brace expansion for multiple extensions |

### 3. Nested CLAUDE.md auto-discovery

A `frontend/CLAUDE.md` won't load until Claude reads a file in
`frontend/`. This is **lazy loading by directory traversal** — when
the Read tool fires on a file in a subdirectory, the runtime checks
for a CLAUDE.md alongside it and injects it if present.

Effect: in a monorepo, you can have per-team CLAUDE.md files that
only "wake up" when Claude is actually working in that team's code.
Cleaner than putting everything in the root.

### 4. `@path` imports

CLAUDE.md can import other files:

```markdown
See @README.md for project overview and @package.json for npm
commands.

- git workflow: @docs/git-instructions.md
```

Imports expand at session start (eager) but recursively (max depth
5). Useful for keeping CLAUDE.md focused on rules while pulling in
reference material from canonical docs.

The first time Claude encounters external imports in a project, it
shows an approval dialog. Decline once and imports stay disabled
until you re-approve.

### 5. Skill dispatch by name + description match

When you type `/foo` or describe a task that matches a skill's
description text, the runtime loads that skill's full content. This
is **name/description-match dispatch**, not embedding similarity.

Effective for hundreds of skills; would degrade at thousands.
Anthropic's bet here is that careful description-writing beats
similarity scoring for the scale users actually have.

## What's deliberately *not* there

| Thing | Status | Why (inferred) |
|---|---|---|
| Vector embeddings of CLAUDE.md / MEMORY.md | Not implemented | Long context + indexed loading is enough |
| Codebase pre-indexing | Not implemented | Read-on-demand via Read tool, supplemented by `Glob` and `Grep` |
| Semantic search across memory | Not implemented | File-name access pattern preferred |
| Built-in vector DB | Not present | Available via plugin MCPs (Pinecone, etc.) |
| Cross-project knowledge sharing | Per-machine only | `autoMemoryDirectory` redirects but no cloud sync |
| Re-ranking / similarity scoring | Not implemented | No retrieval pipeline exists to rank |

The Pinecone MCP plugin (available via the plugin marketplace) is
the *only* embedding-based retrieval option, and it's user-driven
per project, not automatic.

## Auto memory internals (from binary inspection)

Strings extracted from the Claude Code binary reveal more about how
auto memory operates than the docs do.

### Analytics events

| Event | Fires when |
|---|---|
| `tengu_agent_memory_loaded` | Subagent memory is loaded |
| `tengu_auto_memory_toggled` | Auto memory turned on/off |
| `tengu_memory_survey_event` | Claude evaluates whether something is worth remembering |
| `tengu_memory_threshold_crossed` | `MEMORY.md` hits the 200-line / 25 KB cap |
| `tengu_memory_toggled` | Generic memory toggle |
| `tengu_memory_write_survey_event` | Pre-write decision survey |

The two "survey" events suggest **structured reasoning before
writes**, not blanket capture. Claude doesn't write a memory every
session; it evaluates whether the information would be useful in a
future conversation.

### Embedded deduplication logic

The binary contains internal instructions for memory hygiene:

> Duplicate or near-duplicate — another memory already covers the
> same fact. Delete the redundant copies. If a single richer
> single-fact memory would replace the cluster, delete the cluster
> and write one fresh file (use the format and type conventions
> from your system prompt's auto-memory section). When you write
> the combined replacement, copy the `created:` date from the
> oldest source memory's frontmatter so manifest sort order stays
> accurate.

This is active maintenance — Claude consolidates redundant memories,
preserves canonical creation dates for sort stability, and prefers
fewer richer files over many sparse ones.

### Memory file types

When Claude writes a new memory file, it tags it with one of these
types in YAML frontmatter:

| Type | Content |
|---|---|
| `user` | Information about the user's role, preferences, knowledge |
| `feedback` | Guidance about how to approach work (corrections + confirmations) |
| `project` | Ongoing initiatives, deadlines, ownership not in code/git |
| `reference` | Pointers to external systems (Linear projects, Slack channels) |

(The system prompt for sessions in this project actually documents
all four types verbatim — that's the canonical reference.)

## Memory + compaction interaction

Per the docs:

> Project-root CLAUDE.md survives compaction: after `/compact`,
> Claude re-reads it from disk and re-injects it into the session.
> Nested CLAUDE.md files in subdirectories are not re-injected
> automatically; they reload the next time Claude reads a file in
> that subdirectory.

This is the gotcha that motivates the `PreCompact` / `PostCompact`
hooks added in
[07-claude-code-hidden-features.md](07-claude-code-hidden-features.md):
your dashboard can snapshot full transcript state right before
compaction destroys the old context, giving you replay/audit
capability that the memory system itself doesn't provide.

What survives compaction:

- Project-root `CLAUDE.md` (re-read after compaction)
- `MEMORY.md` index (re-loaded same as session start)
- Auto memory topic files (re-readable from disk)
- Skills (re-resolvable)

What does NOT survive compaction:

- Conversation-only instructions never written to a file
- Nested CLAUDE.md files until next file read in that subdir
- In-memory state from the conversation prior to compaction
  (unless captured by your `PreCompact` hook)

## Practical implications

### For users

1. **Run `/memory` periodically** to audit what Claude has saved.
   Auto memory accumulates without you noticing. Edit or delete
   anything that's wrong or outdated.
1. **Keep `CLAUDE.md` under 200 lines.** Longer files reduce
   adherence; structure with headings and bullets.
1. **Use `.claude/rules/` with `paths:` frontmatter** for
   instructions that only apply to specific files. Path-scoping
   means the instruction loads only when relevant, saving context
   for everything else.
1. **`/init`** generates a starting CLAUDE.md by analyzing your
   codebase. Set `CLAUDE_CODE_NEW_INIT=1` for the interactive
   multi-phase flow.
1. **Block-level `<!-- HTML comments -->`** in CLAUDE.md are
   stripped before injection — use them for maintainer notes that
   shouldn't spend tokens.

### For dashboard / observability builders

1. **`~/.claude/projects/<encoded-path>/memory/`** is the canonical
   query target for "what does Claude know about this project?".
   Plain markdown, per-repo, easy to surface.
1. **`tengu_memory_*` events fire to telemetry only**, not to
   user-installed hooks. To track when memory writes happen, watch
   the `PostToolUse` hook for the Write tool with paths matching
   `*/memory/*.md`.
1. **For codebase RAG, bolt on the Pinecone MCP**. It's
   user-driven per project; install via `claude mcp add pinecone`
   or via the plugin marketplace.
1. **Subagents have their own auto memory**
   (per `code.claude.com/docs/en/sub-agents#enable-persistent-memory`).
   The `tengu_agent_memory_loaded` event fires for each subagent
   memory load. If your dashboard wants to surface subagent
   knowledge separately, watch for these events.

### For orchestrator builders

1. **`--bare`** disables auto memory entirely. Use for CI / sandboxed
   / reproducible runs where consistent context is required.
2. **`autoMemoryDirectory`** in user settings redirects auto memory
   to a custom path. Useful for shared dev environments where memory
   should be ephemeral or stored on a different disk.
3. **`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`** environment variable
   disables auto memory without changing settings. Per-invocation
   control.
4. **`CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`** with
   `--add-dir` loads memory files from external directories. Useful
   for sharing CLAUDE.md across worktrees or related repos.

## Bolting on real RAG (if you need it)

If you genuinely need vector retrieval over your codebase or notes,
two clean paths:

### Option A: Pinecone MCP plugin

```bash
claude mcp add pinecone
# OAuth flow; stores credentials in ~/.claude/
```

Once enabled, the agent gets `mcp__pinecone__*` tools for upsert,
search, and rerank. You'd embed your codebase yourself (one-time
batch via the SDK) and the agent searches it during sessions.

Pros: Anthropic-blessed integration, hosted DB, no infra.
Cons: external service, costs scale with corpus size, requires
embedding pipeline.

### Option B: Custom MCP server with local vector DB

Write a small MCP server (similar to the
[cowork-bridge-mcp](../../../cowork-bridge-mcp/) we built) that
wraps a local LanceDB / sqlite-vss / Qdrant. The agent gets the
same `mcp__<name>__*` tool surface; your data stays local.

Pros: full control, no external dependency, free.
Cons: you maintain the embedding pipeline and the vector store.

Either way, you're explicitly opting *into* RAG; it's not implicit.

## Methodology

This doc was generated by:

1. `WebFetch https://code.claude.com/docs/en/memory` — authoritative
   doc page (full transcription embedded above)
2. `strings $CLAUDE_BIN | grep -E "^tengu_.*memory"` — analytics
   events
3. `strings $CLAUDE_BIN | grep -ciE "embedding|vector|chroma|...etc"`
   — verifying RAG-related strings (most are false positives;
   confirmed no built-in vector DB)
4. Inspection of `~/.claude/projects/*/memory/` and the system
   prompt for this session (which canonically documents the four
   memory types)
5. Cross-checking against the version-by-version changelog at
   `~/.claude/cache/changelog.md` for memory-related changes

The same methodology will work for the next major version. Watch
`tengu_memory_*` events for new ones — that's where new memory
features surface in telemetry first.

## Cross-references

- [02-claude-orchestration-options.md](02-claude-orchestration-options.md)
  — auth and session primitives; auto memory is per-session per repo
- [04-architecture-patterns.md](04-architecture-patterns.md)
  — the "Memory-augmented" pattern (#23 in file 06) maps onto
  CLAUDE.md + MEMORY.md natively
- [06-agentic-pattern-archetypes.md](06-agentic-pattern-archetypes.md)
  — Memory-augmented agents pattern; this doc is the implementation
  of that pattern in Claude Code
- [07-claude-code-hidden-features.md](07-claude-code-hidden-features.md)
  — `PreCompact`/`PostCompact` hooks for capturing pre-compact state
  that the memory system itself doesn't preserve
