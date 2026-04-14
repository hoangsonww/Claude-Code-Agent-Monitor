/**
 * @file logger.ts
 * @description Logger class for the MCP application, responsible for logging messages in JSON format to stderr with different log levels (debug, info, warn, error). The logger respects a minimum log level configuration and includes timestamps in ISO format. Each log entry is a single line of JSON containing the timestamp, log level, message, and optional metadata. This structured logging approach allows for easy parsing and analysis of logs. The Logger class provides methods for each log level and a private method to handle the actual writing of log entries to stderr.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { LogLevel } from "../config/app-config.js";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly minLevel: LogLevel) {}

  debug(message: string, meta?: Record<string, unknown>) {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.write("error", message, meta);
  }

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
