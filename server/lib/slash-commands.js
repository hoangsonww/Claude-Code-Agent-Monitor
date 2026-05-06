/**
 * @file Slash-command catalog builder. Returns `{ builtin, skills, plugins, project }`
 * where each entry is `{ name, description, source }`. Built-ins are a static
 * list of well-known Claude Code commands. `skills` and `plugins` are passed in
 * by the caller (the route reuses the existing skills route's data). `project`
 * is discovered by scanning `<cwd>/.claude/commands/*.md` and parsing optional
 * `description:` from YAML frontmatter.
 */
const fs = require("node:fs");
const path = require("node:path");

const BUILTIN = [
  { name: "help", description: "Show all available commands" },
  { name: "clear", description: "Clear the conversation" },
  { name: "agents", description: "List configured subagents" },
  { name: "compact", description: "Compact the conversation history" },
  { name: "cost", description: "Show session cost so far" },
  { name: "resume", description: "Resume a previous session" },
  { name: "login", description: "Sign in to your Anthropic account" },
  { name: "logout", description: "Log out from your Anthropic account" },
  { name: "model", description: "Switch the active model" },
  { name: "rename", description: "Rename the current session" },
  { name: "review", description: "Review a pull request" },
  { name: "status", description: "Show session status" },
];

function readFrontmatterDescription(text) {
  if (!text.startsWith("---")) return "";
  const end = text.indexOf("\n---", 3);
  if (end < 0) return "";
  const block = text.slice(3, end);
  const m = block.match(/(?:^|\n)\s*description\s*:\s*(.+?)(?:\n|$)/);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function discoverProjectCommands(cwd) {
  const dir = path.join(cwd, ".claude", "commands");
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.endsWith(".md")) continue;
    const name = ent.replace(/\.md$/, "");
    let text = "";
    try {
      text = fs.readFileSync(path.join(dir, ent), "utf8");
    } catch {
      continue;
    }
    out.push({
      name,
      description: readFrontmatterDescription(text),
      source: "project",
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function buildCatalog({ cwd, skillsCatalog }) {
  const skills = (skillsCatalog?.skills || []).map((s) => ({
    name: s.name,
    description: s.description || "",
    source: "skill",
  }));
  const plugins = (skillsCatalog?.plugins || []).map((p) => ({
    name: p.name,
    description: p.description || "",
    source: "plugin",
  }));
  return {
    builtin: BUILTIN.map((b) => ({ ...b, source: "builtin" })),
    skills,
    plugins,
    project: discoverProjectCommands(cwd),
  };
}

module.exports = { buildCatalog, BUILTIN };
