#!/usr/bin/env node
// Forwards a Codex lifecycle hook to each live dashboard without waiting for a
// response, so monitoring never delays the Codex CLI.
// @author Son Nguyen <hoangson091104@gmail.com>

const { sendHook } = require("./hook-transport");

const hookType = process.argv[2] || "unknown";

function resolvePorts() {
  try {
    return require("../server/lib/server-info").resolveHookIngestPorts();
  } catch {
    const port = Number.parseInt(process.env.CLAUDE_DASHBOARD_PORT || "", 10);
    return [Number.isInteger(port) && port > 0 ? port : 4820];
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    data = { raw: input };
  }
  sendHook(resolvePorts, "/api/hooks/codex", { hook_type: hookType, data }).finally(() =>
    setImmediate(() => process.exit(0))
  );
});
setTimeout(() => process.exit(0), 2500);
