/**
 * @file logger.ts
 * @description Logger class for the MCP application, responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The logger respects a minimum log level configuration and includes timestamps in ISO format. Each log entry is a single line of JSON containing the timestamp, log level, message, and optional metadata. This structured logging approach allows for easy parsing and analysis of logs. The Logger class provides methods for each log level and a private method to handle the actual writing of log entries to stderr.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { LogLevel } from "../config/app-config.js";

/** Numeric severity ranking; higher is more severe. */
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Structured JSON logger for the MCP process. Every entry is one
 * newline-terminated JSON object written to **stderr**, never stdout — for
 * the stdio transport, stdout is the MCP JSON-RPC channel, so logging there
 * would corrupt the protocol stream. One instance is shared process-wide via
 * {@link ToolContext} and {@link DashboardApiClient}.
 */
export class Logger {
  /** @param minLevel Minimum severity written; lower calls are dropped.
   * Sourced from `AppConfig.logLevel` (`MCP_LOG_LEVEL`, default `"info"`). */
  constructor(private readonly minLevel: LogLevel) {}

  /** Per-call tracing, e.g. tool invocation start/completion; silent unless
   * `MCP_LOG_LEVEL=debug`. */
  debug(message: string, meta?: Record<string, unknown>) {
    this.write("debug", message, meta);
  }

  /** Default-visible lifecycle events (server started, new session opened). */
  info(message: string, meta?: Record<string, unknown>) {
    this.write("info", message, meta);
  }

  /** Recoverable/transient issues, e.g. a retried dashboard API request. */
  warn(message: string, meta?: Record<string, unknown>) {
    this.write("warn", message, meta);
  }

  /** Aborted operations, e.g. a thrown tool handler or unhandled rejection. */
  error(message: string, meta?: Record<string, unknown>) {
    this.write("error", message, meta);
  }

  /** Writes one entry if `level` meets {@link minLevel}; `meta` is included
   * only when non-empty. */
  private write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) {
      return;
    }

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    });
    process.stderr.write(`${line}\n`);
  }
}
