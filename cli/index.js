/**
 * @file Program assembly and entry point for ccam, the Claude Code Agent
 * Monitor CLI. Builds the Commander.js command tree (see lib/framework.js for
 * the shared conventions), wires the global options every command inherits,
 * styles help output, and converts every failure into a clean exit code.
 *
 * Global options (valid anywhere on the command line):
 *   --json             machine-readable output; errors as JSON on stderr
 *   --format pretty    human views for commands whose default is raw JSON
 *   --server <url>     target a specific dashboard (env CCAM_URL)
 *   --token <token>    API bearer token (env DASHBOARD_API_TOKEN / CCAM_API_TOKEN)
 *   --no-color         plain text (also NO_COLOR=1); colors are off when piped
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const { Option, CommanderError } = require("commander");
const { c, useColor, termWidth } = require("./lib/ui");
const { state, pkgVersion, CliError, ServerDownError, reportError } = require("./lib/runtime");
const { CcamCommand } = require("./lib/framework");
const { serverDown } = require("./lib/offline");

const COMMAND_MODULES = [
  require("./commands/server"),
  require("./commands/monitor"),
  require("./commands/data"),
  require("./commands/insights"),
  require("./commands/alerts"),
  require("./commands/pricing"),
  require("./commands/sources"),
  require("./commands/admin"),
  require("./commands/meta"),
];

const HELP_FOOTER = `
${c.bold("Examples:")}
  ${c.cyan("ccam start")}                          ${c.dim("# bring the dashboard up in the background")}
  ${c.cyan("ccam overview --watch")}               ${c.dim("# live one-screen snapshot")}
  ${c.cyan("ccam sessions --status active")}       ${c.dim("# what is running right now")}
  ${c.cyan("ccam sessions transcript <id>")}       ${c.dim("# read a conversation")}
  ${c.cyan("ccam cost --daily")}                   ${c.dim("# spend per day")}
  ${c.cyan("ccam sessions --json | jq '.total'")}  ${c.dim("# script it")}

${c.bold("Server discovery:")} --server / CCAM_URL, then CLAUDE_DASHBOARD_PORT / DASHBOARD_PORT,
otherwise the live server is found via the local .agent-dashboard.json registry,
falling back to http://127.0.0.1:4820.

${c.bold("Output:")} colors auto-enable on a TTY and turn off when piped.
Disable with --no-color or NO_COLOR=1; force with FORCE_COLOR=1 / CCAM_COLOR=1.
${c.bold("Automation:")} add --json (or set CCAM_OUTPUT=json) for stable JSON on stdout and
{"error":{"code":"…","message":"…"}} on stderr; exit 0 = success, 1 = failure.
\`ccam commands --json\` describes every command, argument, and option.

${c.bold("Note:")} ccam talks to the local dashboard server — API-backed commands
require it to be running (${c.bold("ccam start")} brings one up in the background);
read-only commands fall back to the database file when it is down.
Prefer an interactive session? Run ${c.bold("ccam repl")} for a shell with completion,
history, and a live status prompt. Shell completion: ${c.bold("ccam completion --help")}.`;

/** Build the full ccam command tree. Exported for tests and the REPL. */
function buildProgram() {
  const program = new CcamCommand("ccam");
  // Settings that subcommands inherit must be applied BEFORE they are added.
  program
    .usage("<command> [options]")
    .description("Monitor sessions, agents, costs, alerts, and runs from your terminal.")
    .version(
      `ccam ${pkgVersion() || "(version unknown)"}`,
      "-v, --version",
      "print the ccam version"
    )
    .option("--json", "machine-readable JSON output (errors as JSON on stderr)")
    .addOption(
      new Option(
        "--format <format>",
        "output format; pretty = human view of raw-JSON commands"
      ).choices(["auto", "json", "pretty"])
    )
    .option("--server <url>", "dashboard base URL (overrides discovery; env CCAM_URL)")
    .option("--token <token>", "API bearer token (env DASHBOARD_API_TOKEN / CCAM_API_TOKEN)")
    .option("--no-color", "disable ANSI colors (also NO_COLOR=1)")
    .helpOption("-h, --help", "show help for a command")
    .helpCommand(false)
    .showSuggestionAfterError(false)
    .exitOverride()
    .configureOutput({
      getOutHasColors: () => useColor,
      getErrHasColors: () => useColor,
      outputError: (str, write) => write(str),
    })
    .configureHelp({
      showGlobalOptions: true,
      helpWidth: termWidth(),
      // "Global Options" are the root's options only — a group's list flags
      // (e.g. `alerts --unacked`) do not apply to its other subcommands.
      visibleGlobalOptions(cmd) {
        if (!cmd.parent) return [];
        let root = cmd;
        while (root.parent) root = root.parent;
        // --version only means something at the root; keep it out of every
        // subcommand's global list.
        return root.options.filter((o) => !o.hidden && o.long !== "--version");
      },
      sortSubcommands: false,
      // Show `session <id>` rather than Commander's `session [options] <id>`.
      subcommandTerm: (cmd) => {
        const args = cmd.registeredArguments.map((a) => {
          const n = `${a.name()}${a.variadic ? "..." : ""}`;
          return a.required ? `<${n}>` : `[${n}]`;
        });
        const alias = cmd.aliases()[0] ? `|${cmd.aliases()[0]}` : "";
        return [`${cmd.name()}${alias}`, ...args].join(" ");
      },
      styleTitle: (s) => c.bold(s),
      styleCommandText: (s) => c.cyan(s),
      styleSubcommandText: (s) => c.cyan(s),
      styleOptionText: (s) => c.yellow(s),
      styleArgumentText: (s) => c.magenta(s),
      styleDescriptionText: (s) => s,
    })
    .hook("preAction", (_root, actionCmd) => {
      const o = actionCmd.optsWithGlobals();
      if (o.json) state.output = "json";
      else if (o.format) state.output = o.format;
      if (o.server) state.url = o.server;
      if (o.token) state.token = o.token;
    });
  program.addHelpText(
    "before",
    `${c.cyan("▍")}${c.bold("ccam")} — Claude Code Agent Monitor CLI${pkgVersion() ? c.dim(` v${pkgVersion()}`) : ""}\n`
  );
  program.addHelpText("after", HELP_FOOTER);

  for (const mod of COMMAND_MODULES) mod.register(program);

  // Bare `ccam` prints help (exit 0); an unknown first word is an error.
  program.allowExcessArguments().action((_opts, cmd) => {
    if (cmd.args.length) cmd.unknownCommand();
    program.outputHelp();
  });
  return program;
}

/** Parse argv and run. Never calls process.exit — sets process.exitCode. */
async function main(argv = process.argv) {
  const program = buildProgram();
  const words = argv.slice(2);
  // Hidden Cobra-style completion protocol: handled before Commander parses
  // so global flags among the words (e.g. -v) are completed, not executed.
  if (words[0] === "__complete") {
    require("./commands/meta").completeAndPrint(program, words.slice(1));
    return;
  }
  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      // Already reported by CcamCommand.error / help / version output.
      process.exitCode = err.exitCode;
      return;
    }
    if (err instanceof ServerDownError) {
      serverDown();
      return;
    }
    reportError(
      err instanceof CliError
        ? err
        : new CliError(err?.message || String(err), { code: "INTERNAL" })
    );
  }
}

module.exports = { buildProgram, main };
