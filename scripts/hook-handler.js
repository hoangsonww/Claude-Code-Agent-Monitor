#!/usr/bin/env node

/**
 * Claude Code hook handler.
 * Receives hook event JSON on stdin and forwards it to the Agent Dashboard API.
 * Designed to fail silently so it never blocks Claude Code.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const http = require("http");

const hookType = process.argv[2] || "unknown";
const port = parseInt(process.env.CLAUDE_DASHBOARD_PORT || "4820", 10);

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

  const payload = JSON.stringify({
    hook_type: hookType,
    data: parsedData,
  });

  const req = http.request(
    {
      hostname: "127.0.0.1",
      port,
      path: "/api/hooks/event",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 3000,
    },
    (res) => {
      res.resume();
      process.exit(0);
    }
  );

  req.on("error", () => process.exit(0));
  req.on("timeout", () => {
    req.destroy();
    process.exit(0);
  });

  req.write(payload);
  req.end();
});

// Safety net timeout
setTimeout(() => process.exit(0), 5000);
