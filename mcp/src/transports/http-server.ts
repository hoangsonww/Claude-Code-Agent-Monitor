/**
 * @file http-server.ts
 * @description Implements the HTTP server transport for the MCP server, supporting both the newer Streamable HTTP protocol and the legacy SSE-based protocol. The server handles incoming requests, manages active sessions, and routes messages to the appropriate transport handlers. It also includes a health check endpoint and integrates with the MCP server instance to facilitate communication with connected clients. The module provides a shutdown function to gracefully close all active transports and the HTTP server itself.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/transports/http-server.ts`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../config/app-config.js`
 * - `../core/logger.js`
 * - `../ui/banner.js`
 *
 * ## Public surface
 * - `startHttpServer` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **startHttpServer**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { AppConfig } from "../config/app-config.js";
import type { Logger } from "../core/logger.js";
import { printBanner, printServerInfo, printReady, printShutdown } from "../ui/banner.js";
import * as c from "../ui/colors.js";

/** One tracked client connection: the underlying MCP SDK transport plus
 * which protocol it speaks, so a request for a known session id can be
 * rejected if it mismatches the protocol that session was initialized with. */
interface TransportEntry {
  transport: Transport;
  type: "streamable" | "sse";
  /** `Date.now()` of the last request routed to this session, used by the
   * idle reaper. Refreshed by the `/mcp` and `/messages` handlers. */
  lastActivityMs: number;
}

function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Tears down an untracked transport/server pair without letting a teardown
 * error escape into the request path — the client's response is already sent
 * by the time this runs, so the only useful action is to log.
 */
async function closeQuietly(
  transport: Transport,
  server: McpServer,
  logger: Logger
): Promise<void> {
  try {
    await transport.close?.();
    await server.close();
  } catch (err) {
    logger.error("Error closing an uninitialized Streamable HTTP session", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Pure helper exported for security regression tests. */
export function isHttpRequestAuthorized(
  headers: Record<string, string | string[] | undefined>,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken) return true;
  const authorization = headers.authorization;
  const bearer =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : undefined;
  const rawHeader = headers["x-mcp-token"];
  const tokenHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  return tokensMatch(bearer || tokenHeader, expectedToken);
}

/**
 * Starts the HTTP transport, exposing the current Streamable HTTP protocol
 * (2025-11-25) and the legacy HTTP+SSE protocol (2024-11-05) side by side on
 * one Express app. Unlike stdio (one `McpServer` for the whole process),
 * **every new client session gets its own freshly-built `McpServer`** via
 * `buildServerFn`, isolated from other sessions but sharing the same
 * {@link AppConfig}/`DashboardApiClient`.
 *
 * Endpoints:
 * - `GET /health` — liveness/uptime/session-count probe for this MCP
 *   process, distinct from `dashboard_health_check` (which checks the
 *   dashboard itself).
 * - `ALL /mcp` — Streamable HTTP: a POST `initialize` with no
 *   `mcp-session-id` starts a new session; later requests must carry that
 *   header and route to the matching transport, rejected with a JSON-RPC
 *   `-32000` error on a protocol mismatch.
 * - `GET /sse` — legacy SSE: a long-lived stream, one `SSEServerTransport` +
 *   `McpServer` pair per connection.
 * - `POST /messages?sessionId=...` — legacy SSE's client-to-server companion
 *   endpoint (SSE itself is server-to-client only).
 *
 * On successful bind, prints the banner/info panel/endpoint table to
 * stdout — this transport owns stdout, unlike stdio's protocol stream.
 * Sessions are reclaimed two ways: a client's explicit `DELETE /mcp`, and a
 * periodic sweep of sessions idle longer than `config.httpSessionTimeoutMs`
 * (clients may vanish without terminating, and each abandoned session pins an
 * `McpServer`). Set `MCP_HTTP_SESSION_TIMEOUT_MS=0` to disable the sweep.
 *
 * @returns The Express `app`, a `shutdown` closing every tracked transport
 *   before the HTTP server itself, and `reapIdleSessions` — the sweep run on
 *   demand, accepting an explicit `now` so tests and operators can force it.
 */
export async function startHttpServer(
  config: AppConfig,
  buildServerFn: () => McpServer,
  logger: Logger,
  toolCount: number
): Promise<{
  app: Express;
  shutdown: () => Promise<void>;
  reapIdleSessions: (now?: number) => Promise<number>;
}> {
  const app = createMcpExpressApp({ host: config.httpHost });
  const transports = new Map<string, TransportEntry>();

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health" || isHttpRequestAuthorized(req.headers, config.httpAuthToken)) {
      next();
      return;
    }
    res.status(401).json({
      error: "unauthorized",
      message: "missing or invalid MCP HTTP token",
    });
  });

  // ── Health endpoint ───────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      server: config.serverName,
      version: config.serverVersion,
      transport: "http",
      uptime: process.uptime(),
      activeSessions: transports.size,
    });
  });

  // ── Streamable HTTP (protocol version 2025-11-25) ─────────────
  app.all("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      if (sessionId && transports.has(sessionId)) {
        const entry = transports.get(sessionId)!;
        entry.lastActivityMs = Date.now();
        if (entry.type !== "streamable") {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Session uses a different transport protocol" },
            id: null,
          });
          return;
        }
        await (entry.transport as StreamableHTTPServerTransport).handleRequest(req, res, req.body);
        return;
      }

      if (req.method === "POST" && isInitializeRequest(req.body)) {
        logger.info("New Streamable HTTP session");
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          // The SDK assigns `transport.sessionId` *while* handling the
          // initialize request, so reading the field before or right after
          // constructing the transport yields undefined. Register from this
          // callback instead — filing the session under any other id (e.g. a
          // second randomUUID()) means the id handed to the client in the
          // `mcp-session-id` response header is not in `transports`, and every
          // follow-up request falls through to the 400 below.
          onsessioninitialized: (sid: string) => {
            transports.set(sid, { transport, type: "streamable", lastActivityMs: Date.now() });
            logger.debug("Streamable HTTP session initialized", { sessionId: sid });
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
          logger.debug("Streamable HTTP session closed", { sessionId: sid });
        };

        const server = buildServerFn();
        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);

        // A handshake the SDK rejected never fires `onsessioninitialized`, so
        // nothing tracks this pair and no client can ever reach it. Close it
        // here rather than leaking an McpServer for the process lifetime.
        if (!transport.sessionId) {
          await closeQuietly(transport, server, logger);
        }
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session or initialization" },
        id: null,
      });
    } catch (err) {
      logger.error("Streamable HTTP error", {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // ── Legacy SSE transport (protocol version 2024-11-05) ────────
  app.get("/sse", async (_req: Request, res: Response) => {
    logger.info("New SSE session");
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, {
      transport,
      type: "sse",
      lastActivityMs: Date.now(),
    });

    res.on("close", () => {
      transports.delete(transport.sessionId);
      logger.debug("SSE session closed", { sessionId: transport.sessionId });
    });

    const server = buildServerFn();
    await server.connect(transport);
  });

  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "No transport found for session" },
        id: null,
      });
      return;
    }

    const entry = transports.get(sessionId)!;
    entry.lastActivityMs = Date.now();
    if (entry.type !== "sse") {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session uses a different transport protocol" },
        id: null,
      });
      return;
    }

    await (entry.transport as SSEServerTransport).handlePostMessage(req, res, req.body);
  });

  // ── Idle session reaper ───────────────────────────────────────
  // MCP clients are not required to send `DELETE /mcp` before going away, and
  // the SDK client's `close()` does not (that is `terminateSession()`), so a
  // dropped or crashed client leaves its session — and the `McpServer` behind
  // it — tracked for the life of the process. Sweep sessions that have gone
  // quiet for longer than the configured timeout.
  const idleTimeoutMs = config.httpSessionTimeoutMs;
  const sweepIntervalMs = Math.max(
    30_000,
    Math.min(60_000, Math.floor(idleTimeoutMs / 2) || 60_000)
  );

  async function reapIdleSessions(now: number = Date.now()): Promise<number> {
    if (idleTimeoutMs <= 0) return 0;
    const expired = [...transports.entries()].filter(
      ([, entry]) => now - entry.lastActivityMs >= idleTimeoutMs
    );
    for (const [sid, entry] of expired) {
      logger.info("Closing idle MCP session", {
        sessionId: sid,
        type: entry.type,
        idleMs: now - entry.lastActivityMs,
      });
      // `close()` fires the transport's `onclose`, which removes the entry;
      // delete defensively so a transport that never calls back cannot pin
      // the session in the map forever.
      try {
        await entry.transport.close?.();
      } catch (err) {
        logger.error("Error closing idle session", {
          sessionId: sid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      transports.delete(sid);
    }
    return expired.length;
  }

  const reaper =
    idleTimeoutMs > 0
      ? setInterval(() => {
          void reapIdleSessions();
        }, sweepIntervalMs)
      : undefined;
  // Never hold the event loop open just to run the sweep.
  reaper?.unref();

  // ── Start listening ───────────────────────────────────────────
  printBanner();
  printServerInfo({
    transport: "http (sse + streamable)",
    version: config.serverVersion,
    dashboard: config.dashboardBaseUrl.toString(),
    port: config.httpPort,
    mutations: config.allowMutations,
    destructive: config.allowDestructive,
    tools: toolCount,
  });

  const httpServer = await new Promise<ReturnType<Express["listen"]>>((resolve, reject) => {
    const srv = app.listen(config.httpPort, config.httpHost, () => resolve(srv));
    srv.on("error", reject);
  });

  const endpoints = [
    ["Streamable HTTP", `http://${config.httpHost}:${config.httpPort}/mcp`, "POST/GET/DELETE"],
    ["Legacy SSE", `http://${config.httpHost}:${config.httpPort}/sse`, "GET"],
    ["Legacy Messages", `http://${config.httpHost}:${config.httpPort}/messages`, "POST"],
    ["Health", `http://${config.httpHost}:${config.httpPort}/health`, "GET"],
  ];

  process.stdout.write(`  ${c.bold(c.brightCyan("◆"))} ${c.bold(c.brightWhite("Endpoints"))}\n`);
  for (const [name, url, methods] of endpoints) {
    process.stdout.write(
      `    ${c.dim(c.cyan("→"))} ${c.label(name.padEnd(20))} ${c.green(url)} ${c.muted(`[${methods}]`)}\n`
    );
  }
  process.stdout.write("\n");

  printReady("http");

  // ── Shutdown ──────────────────────────────────────────────────
  const shutdown = async () => {
    printShutdown();
    if (reaper) clearInterval(reaper);
    const closePromises: Promise<void>[] = [];
    for (const [sid, entry] of transports) {
      logger.debug("Closing transport", { sessionId: sid });
      closePromises.push(
        entry.transport.close?.().catch((err: unknown) => {
          logger.error("Error closing transport", {
            sessionId: sid,
            error: err instanceof Error ? err.message : String(err),
          });
        }) ?? Promise.resolve()
      );
    }
    await Promise.allSettled(closePromises);
    transports.clear();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    logger.info("HTTP server stopped");
  };

  return { app, shutdown, reapIdleSessions };
}
