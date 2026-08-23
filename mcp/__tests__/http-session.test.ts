/**
 * @file http-session.test.ts
 * @description End-to-end regression tests for Streamable HTTP session tracking. These start a real listener because the defect they guard against was in the wiring rather than in any pure helper: the session id handed to the client in the `mcp-session-id` response header must be the key the server tracks the transport under, so every follow-up request routes back to the same session instead of falling through to "Bad Request: No valid session or initialization". Also covers session release on DELETE, rejection of unknown session ids, and the legacy SSE endpoint continuing to hand out its own session.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, it } from "node:test";
import { loadConfig } from "../src/config/app-config.js";
import { Logger } from "../src/core/logger.js";
import { DashboardApiClient } from "../src/clients/dashboard-api-client.js";
import { buildServer } from "../src/server.js";
import { startHttpServer } from "../src/transports/http-server.js";

/** Reserve a free port by binding to 0 and releasing it immediately. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "http-session-test", version: "1.0.0" },
  },
};

/** Pull the first SSE `data:` payload out of a response body. */
function firstSsePayload(body: string): Record<string, unknown> {
  const line = body.split("\n").find((l) => l.startsWith("data: "));
  assert.ok(line, `no SSE data frame in response: ${body}`);
  return JSON.parse(line.slice(6));
}

describe("Streamable HTTP session tracking", () => {
  let port: number;
  let base: string;
  let shutdown: () => Promise<void>;
  let reapIdleSessions: (now?: number) => Promise<number>;
  let writeSpy: typeof process.stdout.write;

  before(async () => {
    port = await freePort();
    base = `http://127.0.0.1:${port}`;
    const config = loadConfig({
      MCP_HTTP_PORT: String(port),
      MCP_HTTP_HOST: "127.0.0.1",
      MCP_LOG_LEVEL: "error",
    } as NodeJS.ProcessEnv);
    const logger = new Logger(config.logLevel);
    const api = new DashboardApiClient(config, logger);

    // startHttpServer prints a banner/endpoint table; keep the test output clean.
    writeSpy = process.stdout.write.bind(process.stdout);
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      ({ shutdown, reapIdleSessions } = await startHttpServer(
        config,
        () => buildServer(config, api, logger),
        logger,
        0
      ));
    } finally {
      process.stdout.write = writeSpy;
    }
  });

  after(async () => {
    await shutdown?.();
  });

  it("tracks the session under the id it returns to the client", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    assert.equal(res.status, 200);
    const sessionId = res.headers.get("mcp-session-id");
    assert.ok(sessionId, "initialize must return an mcp-session-id header");
    await res.text();

    // The regression: this used to 400, because the transport was filed under
    // a second randomUUID() rather than the id the client was just handed.
    const initialized = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    assert.equal(initialized.status, 202);

    const listed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    assert.equal(listed.status, 200);
    const payload = firstSsePayload(await listed.text()) as {
      result?: { tools?: unknown[] };
    };
    assert.ok((payload.result?.tools?.length ?? 0) > 0, "tools/list must resolve on the session");

    await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
    });
  });

  it("counts exactly one active session per handshake and releases it on DELETE", async () => {
    const activeSessions = async () =>
      (await (await fetch(`${base}/health`)).json()).activeSessions as number;

    const before = await activeSessions();

    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    const sessionId = res.headers.get("mcp-session-id")!;
    await res.text();

    assert.equal(await activeSessions(), before + 1, "handshake must track exactly one session");

    const deleted = await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
    });
    assert.ok(deleted.ok, `DELETE should succeed, got ${deleted.status}`);
    assert.equal(await activeSessions(), before, "DELETE must release the session");
  });

  it("rejects an unknown session id", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": "not-a-real-session" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list" }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { message?: string } };
    assert.match(String(body.error?.message), /No valid session/);
  });

  it("reaps a session abandoned without DELETE", async () => {
    const activeSessions = async () =>
      (await (await fetch(`${base}/health`)).json()).activeSessions as number;

    const before = await activeSessions();
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    const sessionId = res.headers.get("mcp-session-id")!;
    await res.text();
    assert.equal(await activeSessions(), before + 1);

    // A client that simply vanishes never sends DELETE, so only the idle
    // sweep can reclaim it. Force it with a clock far past the timeout.
    const reaped = await reapIdleSessions(Date.now() + 2 * 60 * 60 * 1000);
    assert.ok(reaped >= 1, `expected at least one reaped session, got ${reaped}`);
    assert.equal(await activeSessions(), 0, "idle sweep must release the session");

    // The reaped session must no longer route.
    const afterReap = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" }),
    });
    assert.equal(afterReap.status, 400);
  });

  it("leaves an active session alone", async () => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(INITIALIZE),
    });
    const sessionId = res.headers.get("mcp-session-id")!;
    await res.text();

    // Swept at "now": the session was just used, so it must survive.
    assert.equal(await reapIdleSessions(Date.now()), 0);

    const listed = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
      body: JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/list" }),
    });
    assert.equal(listed.status, 200);
    await listed.text();

    await fetch(`${base}/mcp`, {
      method: "DELETE",
      headers: { ...JSON_HEADERS, "mcp-session-id": sessionId },
    });
  });

  it("still serves the legacy SSE endpoint its own session", async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/sse`, { signal: controller.signal });
    assert.equal(res.status, 200);
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const chunk = Buffer.from(value!).toString("utf8");
    assert.match(chunk, /\/messages\?sessionId=/);
    controller.abort();
    await reader.cancel().catch(() => {});
  });
});
