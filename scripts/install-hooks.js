#!/usr/bin/env node

/**
 * Installs dashboard hooks. The exported installer writes Claude Code entries;
 * the CLI chooser can also install the matching Codex hook set.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const { getSettingsPath } = require("../server/lib/claude-home");
const SETTINGS_PATH = getSettingsPath();
const HOOK_HANDLER = path.resolve(__dirname, "hook-handler.js").replace(/\\/g, "/");

function envFlag(name) {
  return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

/**
 * True when this process is running inside a container (Docker, Podman, or a
 * Kubernetes pod). Detected via the Docker/Podman marker files, the OCI/systemd
 * `container` env var, and a Linux cgroup heuristic. `CCAM_FORCE_CONTAINER=1`
 * forces a positive result and `CCAM_FORCE_HOST=1` forces a negative result
 * (used by tests / to override misfiring detection).
 *
 * Why this matters (GitHub #193): the hook command written into
 * `~/.claude/settings.json` embeds the absolute handler path resolved here.
 * Inside a container that path (e.g. `/app/scripts/hook-handler.js`) does not
 * exist on the host. When `~/.claude` is bind-mounted, installing from the
 * container poisons the host settings and every host hook fails with
 * `MODULE_NOT_FOUND`. Claude Code runs on the host, so hooks must be installed
 * on the host.
 *
 * @returns {boolean}
 */
function isInsideContainer() {
  if (envFlag("CCAM_FORCE_CONTAINER")) return true;
  if (envFlag("CCAM_FORCE_HOST")) return false;
  try {
    if (fs.existsSync("/.dockerenv")) return true; // Docker
    if (fs.existsSync("/run/.containerenv")) return true; // Podman
  } catch {
    /* fs probe failed — fall through to other signals */
  }
  // systemd-nspawn / Podman (and often Docker) export `container`.
  if (typeof process.env.container === "string" && process.env.container.length > 0) return true;
  // Linux cgroup heuristic — covers Docker, containerd, Kubernetes, Podman.
  try {
    const cgroup = fs.readFileSync("/proc/self/cgroup", "utf8");
    if (/\b(docker|containerd|kubepods|libpod|podman)\b/.test(cgroup)) return true;
  } catch {
    /* not Linux / no cgroup file — not a container by this signal */
  }
  return false;
}

/** Multi-line message explaining why a container install is refused. */
function containerRefusalMessage() {
  return [
    "✖ Refusing to install Claude Code hooks from inside a container.",
    "",
    `  The hook command would embed this handler path:`,
    `      ${HOOK_HANDLER}`,
    `  written into:`,
    `      ${SETTINGS_PATH}`,
    "",
    "  Claude Code runs on the HOST. When ~/.claude is bind-mounted, a",
    "  container-internal handler path does not exist on the host, so every host",
    "  hook fails with MODULE_NOT_FOUND (e.g. the SessionEnd hook). See issue #193.",
    "",
    "  → Install hooks ON THE HOST instead:",
    "        npm run install-hooks",
    "        # or: node /path/to/Claude-Code-Agent-Monitor/scripts/install-hooks.js",
    "",
    "  The host handler POSTs to http://localhost:4820, which the container already",
    "  publishes — so a host-installed hook reaches the containerized dashboard.",
    "",
    "  If you genuinely run Claude Code inside this same container, override with:",
    "        CCAM_ALLOW_CONTAINER_HOOKS=1 npm run install-hooks",
  ].join("\n");
}

// Hook types to install. Some support matchers, some don't.
const HOOKS_WITH_MATCHER = ["PreToolUse", "PostToolUse", "Stop", "SubagentStop", "Notification"];
// UserPromptSubmit fires the instant the user hits enter — the only reliable
// signal that the user has resumed for *text-only* turns (no PreToolUse will
// fire until Claude calls a tool, which never happens for plain-text replies).
// Without it the Waiting badge persists through the entire generation of a
// text response. SessionStart / SessionEnd / UserPromptSubmit don't take
// tool-name matchers, hence the separate list.
const HOOKS_WITHOUT_MATCHER = ["SessionStart", "SessionEnd", "UserPromptSubmit"];
const HOOK_TYPES = [...HOOKS_WITH_MATCHER, ...HOOKS_WITHOUT_MATCHER];

function makeHookEntry(hookType) {
  const entry = {
    hooks: [
      {
        type: "command",
        command: `node "${HOOK_HANDLER}" ${hookType}`,
      },
    ],
  };
  if (HOOKS_WITH_MATCHER.includes(hookType)) {
    entry.matcher = "*";
  }
  return entry;
}

function isOurEntry(entry) {
  // Matches old format (entry.command) and new format (entry.hooks[].command)
  if (entry.command && entry.command.includes("hook-handler.js")) return true;
  if (Array.isArray(entry.hooks)) {
    return entry.hooks.some((h) => h.command && h.command.includes("hook-handler.js"));
  }
  return false;
}

function getClaudeHookStatus() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return { installed: false, path: SETTINGS_PATH, hooks: {} };
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    const hooks = Object.fromEntries(
      HOOK_TYPES.map((type) => [type, (settings.hooks?.[type] || []).some(isOurEntry)])
    );
    const hookLists = Object.values(settings.hooks || {}).filter(Array.isArray);
    return {
      installed: Object.values(hooks).every(Boolean),
      has_dashboard_hooks: Object.values(hooks).some(Boolean),
      has_existing_hooks: hookLists.some((entries) => entries.length > 0),
      path: SETTINGS_PATH,
      hooks,
    };
  } catch (err) {
    return { installed: false, path: SETTINGS_PATH, hooks: {}, error: err.message };
  }
}

function installHooks(silent = false) {
  // Host-only guard (issue #193): never write a container-internal handler path
  // into a (potentially bind-mounted) host settings file. Honors an explicit
  // opt-out for the rare case of running Claude Code inside this same container.
  if (isInsideContainer() && !envFlag("CCAM_ALLOW_CONTAINER_HOOKS")) {
    if (!silent) console.error(containerRefusalMessage());
    return false;
  }

  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
      settings = JSON.parse(raw);
    } catch (err) {
      if (!silent) console.error(`Failed to parse ${SETTINGS_PATH}:`, err.message);
      return false;
    }
  }

  if (!settings.hooks) settings.hooks = {};

  let installed = 0;
  let updated = 0;

  for (const hookType of HOOK_TYPES) {
    if (!settings.hooks[hookType]) settings.hooks[hookType] = [];

    const existing = settings.hooks[hookType].findIndex(isOurEntry);
    const entry = makeHookEntry(hookType);

    if (existing >= 0) {
      settings.hooks[hookType][existing] = entry;
      updated++;
    } else {
      settings.hooks[hookType].push(entry);
      installed++;
    }
  }

  const dir = path.dirname(SETTINGS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");

  if (!silent) {
    console.log(`Hook handler: ${HOOK_HANDLER}`);
    console.log(`Settings file: ${SETTINGS_PATH}`);
    console.log(`Installed: ${installed} new, updated: ${updated} existing`);
    console.log("Claude Code hooks configured. Start a new Claude Code session to begin tracking.");
  }

  return true;
}

function selectedFromArgs(args) {
  if (args.includes("--both")) return ["claude", "codex"];
  if (args.includes("--codex")) return ["codex"];
  if (args.includes("--claude")) return ["claude"];
  return null;
}

function chooseHookProviders() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.reject(
      new Error(
        "An interactive terminal is required. Use --claude, --codex, or --both for automation."
      )
    );
  }
  const options = [
    { value: "claude", label: "Claude Code" },
    { value: "codex", label: "Codex" },
  ];
  let cursor = 0;
  const selected = new Set(["claude"]);
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  const draw = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write("Install dashboard hooks\n\n");
    process.stdout.write("Use ↑/↓ to move, Space to select one or more, Enter to continue.\n\n");
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      process.stdout.write(
        `${index === cursor ? "›" : " "} [${selected.has(option.value) ? "x" : " "}] ${option.label}\n`
      );
    }
  };
  draw();
  return new Promise((resolve, reject) => {
    const onKey = (_str, key) => {
      if (key?.name === "up") {
        cursor = (cursor + options.length - 1) % options.length;
        draw();
      } else if (key?.name === "down") {
        cursor = (cursor + 1) % options.length;
        draw();
      } else if (key?.name === "space") {
        const value = options[cursor].value;
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        draw();
      } else if (key?.name === "return") {
        if (selected.size > 0) finish(resolve, [...selected]);
      } else if (key?.name === "escape" || (key?.ctrl && key.name === "c")) {
        finish(reject, new Error("Hook installation cancelled."));
      }
    };
    const finish = (done, value) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      done(value);
    };
    process.stdin.on("keypress", onKey);
  });
}

function confirmOverwrite(selected) {
  const statuses = {
    claude: getClaudeHookStatus(),
    codex: require("./install-codex-hooks").getCodexHookStatus(),
  };
  const detected = selected.filter((provider) => statuses[provider].has_existing_hooks);
  if (detected.length === 0) return Promise.resolve(true);
  if (!process.stdin.isTTY || !process.stdout.isTTY) return Promise.resolve(true);
  const dashboardInstalled = detected.filter((provider) => statuses[provider].has_dashboard_hooks);
  process.stdout.write(
    `Warning: existing ${detected.map((provider) => (provider === "claude" ? "Claude Code" : "Codex")).join(" and ")} hook configuration detected.\n` +
      (dashboardInstalled.length
        ? "Proceeding replaces this dashboard's existing entries and preserves unrelated hooks.\n"
        : "Proceeding adds this dashboard's entries and preserves all existing hooks.\n") +
      "Press Enter to override, or Esc to cancel.\n"
  );
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  return new Promise((resolve) => {
    const onKey = (_str, key) => {
      if (key?.name !== "return" && key?.name !== "escape" && !(key?.ctrl && key.name === "c"))
        return;
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
      resolve(key?.name === "return");
    };
    process.stdin.on("keypress", onKey);
  });
}

async function runInteractiveInstall() {
  const selected = selectedFromArgs(process.argv.slice(2)) || (await chooseHookProviders());
  if (!(await confirmOverwrite(selected))) {
    console.log("Hook installation cancelled. No configuration was changed.");
    return false;
  }
  const results = [];
  if (selected.includes("claude")) results.push({ provider: "claude", ok: installHooks(false) });
  if (selected.includes("codex")) {
    const result = require("./install-codex-hooks").installCodexHooks({ silent: false });
    results.push({ provider: "codex", ok: result.ok });
  }
  return results.every((result) => result.ok);
}

if (require.main === module) {
  runInteractiveInstall()
    .then((ok) => {
      if (!ok) process.exitCode = 1;
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}

module.exports = { installHooks, getClaudeHookStatus, isInsideContainer, runInteractiveInstall };
