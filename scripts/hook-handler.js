#!/usr/bin/env node

/**
 * Claude Code hook handler.
 * Receives hook event JSON on stdin and forwards it to live Agent Dashboard
 * servers registered for the same resolved Claude home. Designed to fail
 * silently so it never blocks Claude Code, and to fan out across matching
 * dashboards that use **different** SQLite data directories. Servers sharing
 * one database receive hooks through a single ingest port so events are never
 * duplicated.
 *
 * Delivery is fire-and-forget: we exit as soon as the request body is on the
 * wire, WITHOUT waiting for the dashboard's HTTP response. The hook only needs
 * to *deliver* the event — on loopback the local server reads the buffered
 * request and processes it even after this short-lived process exits. Waiting
 * for the response is what made Claude Code sit at "running hooks" for seconds
 * whenever a dashboard was busy, slow, or wedged.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { sendHook } = require("./hook-transport");

const hookType = process.argv[2] || "unknown";

/**
 * Resolve eligible dashboard ports via the discovery file. If the discovery
 * module cannot load, only an explicit `CLAUDE_DASHBOARD_PORT` remains safe;
 * an unverified conventional port could belong to another Claude home.
 */
function resolvePorts() {
  try {
    return require("../server/lib/server-info").resolveHookIngestPorts();
  } catch {
    const envPort = parseInt(process.env.CLAUDE_DASHBOARD_PORT || "", 10);
    return Number.isInteger(envPort) && envPort > 0 ? [envPort] : [];
  }
}

const ports = resolvePorts();

let input = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let parsedData;
  try {
    parsedData = JSON.parse(input);
  } catch {
    parsedData = { raw: input };
  }

  const payload = {
    hook_type: hookType,
    data: parsedData,
  };

  // Give the kernel one tick to hand the buffered request bytes to the local
  // server before our sockets close, then exit. The hook returns in ms.
  sendHook(() => ports, "/api/hooks/event", payload).finally(() =>
    setImmediate(() => process.exit(0))
  );
});

// Safety net — guarantees the hook never blocks Claude Code even if a send
// somehow never settles. Shorter than the old 5s wait because we no longer
// block on the dashboard's response, only on the request flush.
setTimeout(() => process.exit(0), 2500);
