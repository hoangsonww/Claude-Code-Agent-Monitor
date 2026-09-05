#!/usr/bin/env bash
# sync-agent-mirrors.sh — regenerate the Codex/OpenAI copies of the i18n-parity
# skill from the canonical Claude Code copy, so every coding agent in this repo
# reads the same instructions.
#
# Canonical: .claude/skills/i18n-parity/   (also holds the audit scripts)
# Mirrors:   .agents/skills/i18n-parity/, .codex/skills/i18n-parity/
#
# The mirrors sit under a different parent, so markdown links that escape the
# skill directory are rewritten to repo-root-relative backticked paths, a
# "this is a mirror" banner is inserted after the frontmatter, and an
# agents/openai.yaml interface file is written.
#
# Usage (from anywhere):
#   bash .claude/skills/i18n-parity/scripts/sync-agent-mirrors.sh          # write
#   bash .claude/skills/i18n-parity/scripts/sync-agent-mirrors.sh --check  # verify only
#
# --check exits 1 and names each stale file instead of writing. Requires node.
# @author Son Nguyen <hoangson091104@gmail.com>

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT" || exit 1

MODE="${1:-write}"
case "$MODE" in
  write | --check) ;;
  *)
    printf 'usage: %s [--check]\n' "$(basename "${BASH_SOURCE[0]}")" >&2
    printf "unsupported mode: %s\n" "$MODE" >&2
    exit 2
    ;;
esac

MODE="$MODE" node -e '
const fs = require("fs");
const path = require("path");

const SRC = ".claude/skills/i18n-parity";
const MIRRORS = [".agents/skills/i18n-parity", ".codex/skills/i18n-parity"];
const DOCS = ["SKILL.md", "references/new-language-checklist.md", "references/translation-style.md"];

const LINK_FIXES = [
  ["[`client/src/i18n/index.ts`](../../../client/src/i18n/index.ts)", "`client/src/i18n/index.ts`"],
  ["[`.claude/rules/wiki-i18n.md`](../../rules/wiki-i18n.md)", "`.claude/rules/wiki-i18n.md`"],
  ["[`.claude/rules/wiki-i18n.md`](../../../rules/wiki-i18n.md)", "`.claude/rules/wiki-i18n.md`"],
  // Replacements must drop straight into the surrounding sentence: the source
  // reads "Run the [`update-project-docs`](…) skill", so the replacement carries
  // neither a leading article nor a trailing noun.
  ["[`update-project-docs`](../update-project-docs/SKILL.md)", "`update-project-docs` (`.claude/skills/update-project-docs/SKILL.md`)"],
  ["[`update-project-docs`](../../update-project-docs/SKILL.md)", "`update-project-docs` (`.claude/skills/update-project-docs/SKILL.md`)"],
];

const BANNER =
  "> **Mirror.** The canonical copy of this skill — and the `i18n-audit.sh`\n" +
  "> script it tells you to run — live at `.claude/skills/i18n-parity/`.\n" +
  "> Keep the two in sync; edit the canonical copy first.\n\n";

const OPENAI_YAML =
  "interface:\n" +
  "  display_name: \"i18n Parity\"\n" +
  "  short_description: \"Keep every localization surface in parity across all supported languages.\"\n" +
  "  default_prompt: \"Use $i18n-parity to propagate a content change to every supported language, or to add a new language across the dashboard keys, the wiki, the mirrored READMEs, the switchers, and locale-aware formatting.\"\n" +
  "policy:\n" +
  // Read/advise workflow skill. The repo reserves `false` for write-capable
  // plugins (see WRITE_CAPABLE in scripts/validate-agent-extensions.js), and
  // the SKILL.md description tells agents to apply this one automatically.
  // NOTE: no apostrophes in this node block; it is bash single-quoted.
  "  allow_implicit_invocation: true\n";

const transform = (text, isSkill) => {
  for (const [from, to] of LINK_FIXES) text = text.split(from).join(to);
  if (!isSkill) return text;
  const parts = text.split("---\n");
  if (parts.length < 3) throw new Error("SKILL.md frontmatter not found");
  const rest = parts.slice(2).join("---\n").replace(/^\n+/, "");
  return "---\n" + parts[1] + "---\n\n" + BANNER + rest;
};

const check = process.env.MODE === "--check";
let stale = 0;

for (const dest of MIRRORS) {
  const wanted = new Map();
  for (const rel of DOCS) {
    wanted.set(rel, transform(fs.readFileSync(path.join(SRC, rel), "utf8"), rel === "SKILL.md"));
  }
  wanted.set("agents/openai.yaml", OPENAI_YAML);

  for (const [rel, content] of wanted) {
    const target = path.join(dest, rel);
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (current === content) continue;
    if (check) {
      console.log(`STALE ${target}` + (current === null ? " (missing)" : ""));
      stale++;
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
      console.log(`wrote ${target}`);
    }
  }

  // Files the mirror carries that the canonical copy no longer produces.
  const walk = (dir) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
        )
      : [];
  for (const file of walk(dest)) {
    const rel = path.relative(dest, file).split(path.sep).join("/");
    if (wanted.has(rel)) continue;
    if (check) {
      console.log(`ORPHAN ${file} — not produced by the canonical skill`);
      stale++;
    } else {
      fs.rmSync(file);
      console.log(`removed ${file}`);
    }
  }
}

if (check && stale > 0) {
  console.log("");
  console.log(`${stale} agent-mirror file(s) out of sync.`);
  console.log("Fix: bash .claude/skills/i18n-parity/scripts/sync-agent-mirrors.sh");
  process.exit(1);
}
if (check) console.log("agent mirrors in sync (.agents, .codex)");
'
