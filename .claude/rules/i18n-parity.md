---
paths:
  - "client/src/i18n/**"
  - "client/src/components/Sidebar.tsx"
  - "client/src/lib/format.ts"
  - "client/src/lib/paletteCommands.ts"
  - "README.md"
  - "README-CN.md"
  - "README-VN.md"
  - "README-KO.md"
  - "README-ES.md"
  - "docs/I18N.md"
---

# i18n Parity Rules (binding for every coding agent)

The dashboard is localized to **English (`en`), Simplified Chinese (`zh`),
Vietnamese (`vi`), Korean (`ko`), and Spanish (`es`)** across five independent
surfaces. English is the source of truth on all of them, and **a change is not
done until every supported language carries it in the same PR** — a fallback to
English is a safety net, never a completed translation.

The full workflow, the surface map, the new-language checklist, and the
glossary live in [`.claude/skills/i18n-parity/`](../skills/i18n-parity/SKILL.md).
Invoke that skill for anything beyond a single-key edit. It is mirrored to
`.agents/skills/i18n-parity/` and `.codex/skills/i18n-parity/` so Codex and
other agents get the same instructions; **edit the canonical `.claude/` copy and
re-run `bash .claude/skills/i18n-parity/scripts/sync-agent-mirrors.sh`** — the
audit fails on a stale mirror.

## Non-negotiables

- **Adding an i18n key** → add it to `client/src/i18n/locales/en/<ns>.json` **and
  every other locale's `<ns>.json`**, with the same key path, the same value
  type, and the same `{{interpolation}}` tokens. Enforced by
  `client/src/i18n/__tests__/i18n.test.ts`.
- **Adding a namespace** → create the JSON for every locale, then register the
  imports, the per-language `resources` entry, and the `ns` array in
  `client/src/i18n/index.ts`.
- **Editing `README.md`** → mirror the same edit at the corresponding section of
  `README-CN.md`, `README-VN.md`, `README-KO.md`, and `README-ES.md`. All four,
  every time. They are full mirrors, not summaries.
- **Editing user-visible text in `wiki/index.html`** → follow
  [`.claude/rules/wiki-i18n.md`](./wiki-i18n.md) and ship `zh` + `vi` + `ko` +
  `es` entries in the same change, then bump the wiki cache versions.
- **Adding a language** → work through
  [`.claude/skills/i18n-parity/references/new-language-checklist.md`](../skills/i18n-parity/references/new-language-checklist.md)
  end to end. A complete README mirror, every app key, and a complete wiki
  translation are all required; partial locales are not merged.
- **Never translate** code, commands, paths, URLs, env-var names, CLI flags,
  identifiers, HTTP verbs/status codes, brand names, hook event names
  (`PreToolUse`, `Stop`, …), tool names (`Bash`, `Agent`), or the product terms
  `Agent` / `Subagent`. Translate only the prose around them.
- The root landing page `index.html` is **English-only by design** — do not add
  an i18n layer to it.

## Verify

```bash
bash .claude/skills/i18n-parity/scripts/i18n-audit.sh   # must exit 0
npm run test:client
```

The audit reads `supportedLngs` from `client/src/i18n/index.ts`, so declaring a
locale there immediately turns every unfilled surface into a named failure.
