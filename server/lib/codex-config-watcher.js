/**
 * @file Best-effort watcher for low-churn Codex configuration surfaces. It
 * emits a debounced websocket signal so the editable explorer reflects CLI
 * and dashboard changes without polling or watching high-churn rollout files.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("node:fs");
const path = require("node:path");
const { getCodexHome, onCodexHomeChanged } = require("./codex-home");

let watchers = [];
let timer = null;
let unsubscribeHome = null;

function startCodexConfigWatcher({ broadcast }) {
  const emit = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try {
        broadcast("codex_config_changed", { source: "fs" });
      } catch {
        /* websocket setup is optional in tests */
      }
    }, 350);
    timer.unref?.();
  };
  const watch = () => {
    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch {
        /* best effort */
      }
    }
    watchers = [];
    const home = getCodexHome();
    if (!fs.existsSync(home)) return;
    const attach = (target, options, shouldEmit) => {
      try {
        const watcher = fs.watch(target, options, (_event, filename) => {
          if (shouldEmit(String(filename || ""))) emit();
        });
        watcher.on("error", () => {});
        watchers.push(watcher);
      } catch {
        /* recursive watching is platform-dependent; root watching remains useful */
      }
    };
    attach(home, {}, (name) => {
      return (
        name === "config.toml" ||
        name === "models_cache.json" ||
        name === "hooks.json" ||
        name.endsWith(".config.toml")
      );
    });
    for (const directory of ["skills", "rules", "plugins"]) {
      const target = path.join(home, directory);
      if (!fs.existsSync(target)) continue;
      attach(target, { recursive: true }, () => true);
    }
  };
  watch();
  unsubscribeHome?.();
  unsubscribeHome = onCodexHomeChanged(() => {
    watch();
    emit();
  });
}

function stopCodexConfigWatcher() {
  if (timer) clearTimeout(timer);
  timer = null;
  for (const watcher of watchers) {
    try {
      watcher.close();
    } catch {
      /* best effort */
    }
  }
  watchers = [];
  unsubscribeHome?.();
  unsubscribeHome = null;
}

module.exports = { startCodexConfigWatcher, stopCodexConfigWatcher };
