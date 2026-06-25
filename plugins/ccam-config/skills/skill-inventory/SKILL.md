---
description: >
  Inventory the installed skills and which plugins contribute them, then flag
  overlap with the user's own skills — read through the Agent Monitor Config
  Explorer API. Reads /api/cc-config/skills and /api/cc-config/plugins. Use
  when managing skills: deduping, deciding what to keep, or tracing a skill
  back to the plugin that ships it.
---

# Skill Inventory

Map every skill available to the user — both their own (user/project scope) and
the ones contributed by installed plugins — read through the Agent Monitor
dashboard at `http://localhost:4820`.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty — inventory all skills (default).
- a skill name fragment — focus on skills whose `name` matches.
- a plugin name — show only the skills that plugin contributes.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/cc-config/skills` | `{ items:[{ scope:"user"\|"project", name, path, file, size, mtime, frontmatter, preview }] }` — the user's own skill directories |
| `GET /api/cc-config/plugins` | `{ manifestPath, manifestExists, plugins:[{ key, name, marketplace, scope, version, enabled, installPath, contributes:{ skills, agents, commands, outputStyles, hooks } }] }` |

## Report Sections

### 1. User & project skills
From `/skills`, list each skill with `scope`, `name`, `size` (KB), and
`frontmatter.description` (or the start of `preview`). Separate user-scope from
project-scope skills.

### 2. Plugin-contributed skills
From `/plugins`, list each plugin with `enabled` state and its
`contributes.skills` count. Note that `/skills` reports only the user's own
skill dirs — plugin skills are counted via `contributes`, so reconcile: total
available skills ≈ user skills + Σ enabled-plugin `contributes.skills`.

### 3. Overlap & duplication
Flag where a plugin name or a plugin's contributed-skill domain overlaps with a
user-authored skill of the same `name` or purpose (compare against
`frontmatter.description` from `/skills`). Recommend keeping one source of truth
— prefer the plugin version if it is maintained upstream, or the user version
if it is customized.

### 4. Disabled / orphaned plugins
Flag plugins with `enabled: false` (their skills are inert) and any whose
`installPathExists` is false (manifest references a missing install) — these are
dead weight to clean up via the Claude Code plugin manager.

## Output

- Section 1 as a table (`Scope | Name | Size | Description`).
- Section 2 as a table (`Plugin | Enabled | Skills | Agents | Commands`).
- A reconciliation line: user skills + plugin skills = total available.
- Cite only fields the API returned — never fabricate skills or counts.
- Note: plugins are read-only via the Config Explorer; manage them with the
  Claude Code plugin commands, not this dashboard.
- If the dashboard is unreachable at `http://localhost:4820`, say so and tell
  the user to start it with `npm start` from the repo root.
