/**
 * @file dashboard-api-client.ts
 * @description Client for making API requests to the MCP dashboard. This client provides methods for sending HTTP requests (GET, POST, PUT, PATCH, DELETE) to the dashboard's API endpoints, with built-in support for retries on transient errors, request timeouts, and error handling. The client constructs URLs based on a base URL from the configuration and allows for query parameters and request bodies. It also defines a custom ApiError class for consistent error representation across the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { setTimeout as sleep } from "node:timers/promises";
import type { AppConfig } from "../config/app-config.js";
import { Logger } from "../core/logger.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  idempotent?: boolean;
}

interface ApiErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class DashboardApiClient {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  async get<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("GET", path, { ...options, idempotent: true });
  }

  async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  async put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PUT", path, options);
  }

  async patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PATCH", path, options);
  }

  async delete<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): URL {
    const url = new URL(path, this.config.dashboardBaseUrl);
    if (!url.pathname.startsWith("/api/")) {
      throw new ApiError(`Invalid path "${path}". MCP client can only call /api/* endpoints.`, {
        code: "INVALID_PATH",
      });
    }

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url;
  }

  private async request<T>(method: HttpMethod, path: string, options: RequestOptions): Promise<T> {
    const maxAttempts = options.idempotent ? this.config.retryCount + 1 : 1;
    const url = this.buildUrl(path, options.query);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: abortController.signal,
        });

        const rawBody = await response.text();
        const body = rawBody ? this.tryParseJson(rawBody) : null;

        if (!response.ok) {
          throw this.toApiError(method, url, response.status, body ?? rawBody);
        }

        return body as T;
      } catch (error) {
        if (this.shouldRetry(error, attempt, maxAttempts)) {
          const backoffMs = this.config.retryBackoffMs * Math.pow(2, attempt - 1);
          this.logger.warn("Transient API error, retrying", {
            method,
            path: url.toString(),
            attempt,
            maxAttempts,
            backoffMs,
            error: this.getErrorMessage(error),
          });
          await sleep(backoffMs);
          continue;
        }

        if (error instanceof ApiError) {
          throw error;
        }

        if (isAbortError(error)) {
          throw new ApiError(
            `Request timed out after ${this.config.requestTimeoutMs}ms: ${method} ${url.pathname}`,
            { code: "TIMEOUT" }
          );
        }

        throw new ApiError(`Request failed: ${method} ${url.pathname}`, {
          code: "REQUEST_FAILED",
          details: this.getErrorMessage(error),
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ApiError("Unreachable request state", { code: "UNREACHABLE_STATE" });
  }

  private shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) return false;
    if (isAbortError(error)) return true;
    if (error instanceof ApiError && error.status !== undefined) {
      return isRetryableStatus(error.status);
    }
    return true;
  }

  private toApiError(method: HttpMethod, url: URL, status: number, body: unknown): ApiError {
    const fallbackMessage = `${method} ${url.pathname} failed with HTTP ${status}`;

    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error
    ) {
      const maybeCode =
        "code" in body.error && typeof body.error.code === "string" ? body.error.code : undefined;
      const maybeMessage =
        typeof body.error.message === "string" ? body.error.message : fallbackMessage;
      return new ApiError(maybeMessage, { status, code: maybeCode, details: body });
    }

    return new ApiError(fallbackMessage, { status, code: `HTTP_${status}`, details: body });
  }

  private tryParseJson(input: string): unknown {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
  }
}
