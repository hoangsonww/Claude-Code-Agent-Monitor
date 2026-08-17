/**
 * @file dashboard-api-client.test.ts
 * @description Contract tests for MCP dashboard HTTP requests, including
 * bearer-token propagation and DELETE request bodies used by config tools.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AppConfig } from "../src/config/app-config.js";
import { DashboardApiClient } from "../src/clients/dashboard-api-client.js";
import { Logger } from "../src/core/logger.js";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    serverName: "test",
    serverVersion: "1.0.0",
    dashboardBaseUrl: new URL("http://127.0.0.1:4820"),
    dashboardApiToken: undefined,
    requestTimeoutMs: 5_000,
    retryCount: 0,
    retryBackoffMs: 50,
    allowMutations: false,
    allowDestructive: false,
    logLevel: "error",
    transport: "stdio",
    httpPort: 8819,
    httpHost: "127.0.0.1",
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("DashboardApiClient", () => {
  it("sends the configured dashboard bearer token", async () => {
    globalThis.fetch = (async (_input, init) => {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer dashboard-secret");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const client = new DashboardApiClient(
      config({ dashboardApiToken: "dashboard-secret" }),
      new Logger("error")
    );
    assert.deepEqual(await client.get("/api/health"), { ok: true });
  });

  it("sends JSON bodies with DELETE requests", async () => {
    globalThis.fetch = (async (_input, init) => {
      assert.equal(init?.method, "DELETE");
      assert.deepEqual(JSON.parse(String(init?.body)), { path: "/tmp/config.toml" });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const client = new DashboardApiClient(config(), new Logger("error"));
    assert.deepEqual(
      await client.delete("/api/codex-config/file", {
        body: { path: "/tmp/config.toml" },
      }),
      { ok: true }
    );
  });

  it("rejects multipart uploads above the cumulative size cap before fetch", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ccam-mcp-upload-"));
    const first = path.join(directory, "first.jsonl");
    const second = path.join(directory, "second.jsonl");
    await writeFile(first, Buffer.alloc(50 * 1024 * 1024));
    await writeFile(second, Buffer.alloc(50 * 1024 * 1024 + 1));
    globalThis.fetch = (async () => {
      assert.fail("fetch must not run for oversized uploads");
    }) as typeof fetch;

    const client = new DashboardApiClient(config(), new Logger("error"));
    await assert.rejects(() => client.postFiles("/api/import/upload", [first, second]), {
      code: "TOO_LARGE",
    });
  });

  it("rejects oversized binary responses from Content-Length", async () => {
    globalThis.fetch = (async () =>
      new Response("x", {
        status: 200,
        headers: { "content-length": String(10 * 1024 * 1024 + 1) },
      })) as typeof fetch;

    const client = new DashboardApiClient(config(), new Logger("error"));
    await assert.rejects(() => client.getBinary("/api/sessions/id/transcript-image"), {
      code: "TOO_LARGE",
    });
  });

  it("rejects automatic redirects so bearer headers never cross routes", async () => {
    globalThis.fetch = (async (_input, init) => {
      assert.equal(init?.redirect, "error");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const client = new DashboardApiClient(
      config({ dashboardApiToken: "dashboard-secret" }),
      new Logger("error")
    );
    await client.get("/api/health");
  });
});
