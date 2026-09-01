---
name: update-project-docs
description: MANDATORY for every coding agent (Claude Code, Codex, or any other) — keep this repository's documentation in sync after any change to behavior, configuration, interfaces, events, schema, or features. Use automatically (without being asked) at the end of ANY change-set that adds or alters an env var, event type, hook behavior, session/agent state transition, API route or response shape, DB schema, WebSocket message, MCP tool, CLI command, or user-facing feature — and whenever the user asks to "update the docs / README / wiki / architecture". Knows the full doc surface (README + VN/CN/KO, ARCHITECTURE, root index.html, wiki + i18n, server/client READMEs, docs/*) and which docs each kind of change touches.
---

# Update Project Docs

This repository keeps an unusually large, multi-surface, multi-language doc set. Docs drift silently because a change often belongs in 6–10 files across 4 languages plus two HTML pages. This skill encodes **which docs exist, which change-types touch which docs, and how to propagate consistently** (including the wiki i18n + cache-bump dance).

Authoritative inventory with exact section anchors lives in [`references/doc-map.md`](references/doc-map.md) — read it when deciding where a specific change lands. The repo rule [`.claude/rules/docs-markdown.md`](../../rules/docs-markdown.md) ("update all affected docs together") and [`.claude/rules/wiki-i18n.md`](../../rules/wiki-i18n.md) are binding.

## When to update (including without being asked)

Update docs **in the same change-set (PR/commit) as the code**, before claiming done — do not wait for the user to ask — whenever the change is observable from outside the module:

- **New/changed env var** → every env-var table + `.env.example`.
- **New event type** (e.g. an `events.event_type` value) → every event-type list/table.
- **New/changed hook behavior or session/agent state transition** → hook docs + every state-machine diagram.
- **New/changed API route or response shape** → API docs + route tables + OpenAPI.
- **DB schema change** (table/column/index) → database docs + ERD.
- **New WebSocket message type** → client/server WS docs.
- **New MCP tool** → MCP docs.
- **New CLI command / script / renamed file referenced in docs** → command lists + onboarding guides.
- **New user-facing feature / page / background service** → feature tables + landing + wiki + architecture.

**Do NOT** auto-update for: pure internal refactors with no observable/interface/config change, test-only changes, comment/typo fixes, or work the user explicitly scoped as "no docs". When unsure whether a change is observable, check the mapping below; if it touches any row, update.

## Change → docs mapping

| Change type | Docs to update |
|---|---|
| **Env var** | `README.md`, `README-VN.md`, `README-CN.md`, `README-KO.md` (env tables), `ARCHITECTURE.md` (inline), `server/README.md`, `wiki/index.html` (env table) + wiki i18n, `.env.example` |
| **Event type** | `README.md`+VN+CN (hook-event table), `ARCHITECTURE.md` (Event types line), `docs/PLUGINS.md`, `wiki/index.html` + i18n, `docs/DATABASE.md` (if it enumerates types) |
| **Hook behavior / state transition** | `docs/HOOKS.md`, state-machine **mermaid** diagrams in `README.md`+VN+CN + `server/README.md` + `docs/DATABASE.md` + `wiki/index.html`, `ARCHITECTURE.md` (hooks.js row) |
| **API route / response** | `docs/API.md`, `server/README.md` (routes), `ARCHITECTURE.md` (routes row), `server/openapi*.js` (code) |
| **DB schema** | `docs/DATABASE.md`, `ARCHITECTURE.md` (ERD/schema) |
| **WebSocket message** | `client/README.md` (Event Types), `server/README.md`, `wiki/index.html` |
| **MCP tool** | `mcp/README.md`, `docs/MCP.md` |
| **Feature / page / background service** | `README.md`+VN+CN (feature table + data-flow list), `ARCHITECTURE.md` (module table), `index.html` (landing blurb), `wiki/index.html` + i18n, `server/README.md` or `client/README.md` |
| **CLI command / script** | `README.md` commands, `CLAUDE.md` / `AGENTS.md`, `INSTALL.md` / `SETUP.md` |
| **New language** | `docs/I18N.md`, `client/src/i18n/locales/<xx>/*`, `client/src/i18n/index.ts`, `README-<XX>.md`, wiki i18n |

## Procedure

1. **Classify** the change against the table above. A change can hit multiple rows (a new feature with a new env var hits both).
2. **Write the canonical English version first** — usually `README.md` and/or `ARCHITECTURE.md`. Get the wording right there; it anchors everything else.
3. **Propagate to translations** `README-VN.md`, `README-CN.md`, and `README-KO.md`: mirror the SAME edits at the corresponding sections. Keep identifiers, env-var names, event names, and code in English; translate only prose. Render "Waiting" as **Đang chờ** (vi) / **等待中** (zh) / **대기 중** (ko). Match each file's existing terminology — read the neighboring lines first.
4. **Landing page** `index.html`: one concise marketing sentence in the most relevant existing feature card — light touch, no new sections.
5. **Wiki** `wiki/index.html`: add the detailed prose/table/diagram **at the length and in the position its neighbours already use** (see *Match the wiki's existing shape* below), then follow `.claude/rules/wiki-i18n.md` — add `zh` + `vi` + `ko` + `es` entries for every new English string to `wiki/i18n-content.js`, then **bump the cache**: increment `CACHE_NAME` in `wiki/sw.js` and the `i18n-content.js?v=` query string in `wiki/index.html`. Skipping the cache bump means returning visitors never see the update.
6. **Area READMEs / docs/**: update `server/README.md`, `client/README.md`, and the relevant `docs/*.md` per the mapping.
7. **Diagrams**: when a state transition changes, edit every mermaid `stateDiagram-v2` block that models it (they are duplicated across README/VN/CN/KO, server/README, docs/DATABASE, wiki). Keep transition labels consistent.

## Match the wiki's existing shape

The wiki is a designed page, not a changelog: several of its blocks live in
fixed-size boxes. A block written at 2–3x the length of its neighbours breaks
the layout, so **measure before you write, and copy the pattern you find**.

- **Feature carousel cards** (`#feature-carousel .feature-card`) share one
  fixed-height box. Each is a single `<p>` of roughly **400–550 characters
  (~60–80 words)** — one paragraph, no lists, no sub-headings, no exhaustive
  enumeration of every keybinding and edge case. Say what the feature is and
  the two or three things that make it distinctive; the depth belongs in the
  feature's own section further down the page.
- **Screenshot captions** (`.screenshot-caption`) run **~150–300 characters**:
  the emoji, the bolded screen name, an em dash, one dense sentence.
- **Card order is editorial, not chronological.** A new feature does NOT go
  first. Insert it where it belongs by importance among the existing cards —
  a newly shipped convenience feature belongs in the middle or later half of
  the carousel, not ahead of the dashboard, board, and session cards.
- Deep, unabridged prose (full keyboard maps, degradation behaviour, group-by-
  group breakdowns) belongs in a normal `<section>` with `h3` + `<ul>`, never
  crammed into a card or caption.
- Run `.claude/skills/update-project-docs/scripts/wiki-block-lengths.sh` and
  confirm your block sits inside the group's budget before finishing.
- Changing wiki **CSS**? Verify it in a browser that ran `script.js` (see
  `.claude/rules/wiki-i18n.md`) — the scroll-reveal pass adds classes at
  runtime, so a `:not([class])` selector that looks right in the file and in
  jsdom can apply to nothing on the live page.
- The same rule of thumb applies everywhere on the page: before adding a block
  of any kind, read the two blocks around it and match their length, tone,
  markup, and heading depth. Do not invent a new pattern for one entry.

## Verify (do not skip)

- **Coverage**: run `scripts/doc-coverage.sh <new-term> [...]` (e.g. the new env var / event type / identifier) and confirm every doc the mapping flags shows a HIT. The matrix is advisory — not every term belongs in every file — but a flagged doc reading `0` is a miss to fix.
- **Tables**: markdown tables stay pipe-balanced (header column count == every row).
- **Mermaid**: each edited block still parses (valid `source --> target: label`).
- **i18n**: every new wiki English string resolves to `zh`, `vi`, `ko`, and `es`; cache versions bumped (`CACHE_NAME` in `wiki/sw.js` plus the matching `?v=` query strings).
- **Wiki block sizing**: `.claude/skills/update-project-docs/scripts/wiki-block-lengths.sh` exits 0 — no carousel card or caption is an outlier, and any new card is placed by importance rather than dropped at the front.
- **Format/tests**: run `npm run format` (or `prettier --check` on touched files); for any code touched, run the verification from `CLAUDE.md` (`npm run test:server` / `test:client` / `mcp:typecheck`).
- State exactly which docs were updated and which were intentionally skipped (with reason), mirroring the repo's verification policy.

## Tips

- The fastest way to find where something already lives: `grep -n "<existing-neighbor-term>" <doc>` (e.g. grep an adjacent env var to find the env table). `references/doc-map.md` lists the stable anchors per file.
- Parallelize translations + HTML across subagents when the change is large, but write the canonical English edit yourself first so the translations have a faithful source.
- One language/area per subagent keeps edits reviewable and tables un-corrupted.
