/**
 * @file http-server.ts
 * @description Implements the HTTP server transport for the MCP server, supporting both the newer Streamable HTTP protocol and the legacy SSE-based protocol. The server handles incoming requests, manages active sessions, and routes messages to the appropriate transport handlers. It also includes a health check endpoint and integrates with the MCP server instance to facilitate communication with connected clients. The module provides a shutdown function to gracefully close all active transports and the HTTP server itself.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
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

interface TransportEntry {
  transport: Transport;
  type: "streamable" | "sse";
}

export async function startHttpServer(
  config: AppConfig,
  buildServerFn: () => McpServer,
  logger: Logger,
  toolCount: number
): Promise<{ app: Express; shutdown: () => Promise<void> }> {
  const app = createMcpExpressApp({ host: config.httpHost });
  const transports = new Map<string, TransportEntry>();

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
        });

        transport.onclose = () => {
          const sid = (transport as unknown as { sessionId?: string }).sessionId;
          if (sid) transports.delete(sid);
          logger.debug("Streamable HTTP session closed", { sessionId: sid });
        };

        const server = buildServerFn();
        await server.connect(transport);

        const sid = (transport as unknown as { sessionId?: string }).sessionId ?? randomUUID();
        transports.set(sid, { transport, type: "streamable" });

        await transport.handleRequest(req, res, req.body);
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
    transports.set(transport.sessionId, { transport, type: "sse" });

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

  return { app, shutdown };
}
