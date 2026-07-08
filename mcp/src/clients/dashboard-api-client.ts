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
  /** Query params; `undefined`/`null` values are omitted, not stringified. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body, JSON-stringified as-is; omitted when `undefined`. */
  body?: unknown;
  /** Marks the request retry-eligible; set only by `get`/`delete` below. */
  idempotent?: boolean;
}

interface ApiErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
}

/**
 * Error type for every failed dashboard API call — non-2xx responses,
 * timeouts, and network failures all normalize to this shape.
 * {@link errorResult} surfaces `code`/`status`/`details` to the MCP client
 * instead of collapsing to a generic internal error.
 */
export class ApiError extends Error {
  status?: number;
  /** Forwarded from the dashboard's error envelope, a synthesized
   * `HTTP_<status>`, or this client's own code (`INVALID_PATH`, `TIMEOUT`,
   * `REQUEST_FAILED`, `UNREACHABLE_STATE`). */
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

/** True for a DOM/Node `AbortError` from {@link DashboardApiClient.request}'s
 * per-attempt timeout controller. */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

/** Statuses treated as transient/retryable: 408, 429, or any 5xx. */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Thin HTTP client every MCP tool handler uses to reach the dashboard's
 * local Express API — the sole network boundary of the server. Requests
 * resolve against `config.dashboardBaseUrl` and are restricted to `/api/*`
 * (see {@link buildUrl}).
 *
 * **Retry semantics**: only GET/DELETE mark themselves `idempotent`, so only
 * they retry automatically — `config.retryCount` extra attempts (default 2)
 * on a timeout or HTTP 408/429/5xx, each retry waiting
 * `config.retryBackoffMs * 2^(attempt-1)` (default 250ms, 500ms, ...,
 * exponential, no jitter). POST/PUT/PATCH are never retried, even for the
 * same transient statuses — a duplicated write is worse than one surfaced
 * failure.
 */
export class DashboardApiClient {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {}

  /** GET — idempotent, eligible for automatic retry. */
  async get<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("GET", path, { ...options, idempotent: true });
  }

  /** POST — never retried; used for creates and mutation-gated actions. */
  async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, options);
  }

  /** PUT — full upsert semantics (e.g. pricing rules); never retried. */
  async put<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PUT", path, options);
  }

  /** PATCH — partial update; never retried. */
  async patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("PATCH", path, options);
  }

  /** DELETE — idempotent, eligible for automatic retry. */
  async delete<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  /**
   * Resolves `path` against the dashboard base URL and applies query
   * params, enforcing that only `/api/*` paths can ever be requested — a
   * hard client-side allowlist independent of the dashboard's own routing.
   * @throws {ApiError} code `INVALID_PATH` if the resolved pathname doesn't
   *   start with `/api/`.
   */
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

  /**
   * Core request implementation shared by all five methods. Each attempt
   * gets its own {@link AbortController} armed with `config.requestTimeoutMs`
   * and best-effort JSON-parses the response (see {@link tryParseJson}).
   * `maxAttempts` is `config.retryCount + 1` when `options.idempotent`,
   * else `1`. On error, {@link shouldRetry} decides whether to back off and
   * loop or fall through to normalization: a non-ok response becomes an
   * {@link ApiError} via {@link toApiError}; an abort becomes `TIMEOUT`; any
   * other throw becomes `REQUEST_FAILED`.
   * @throws {ApiError} on any non-2xx response, timeout, or network failure
   *   surviving the retry loop.
   */
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

  /** Never retries on the last attempt; always retries an abort/timeout;
   * for an {@link ApiError} with a status, retries only if
   * {@link isRetryableStatus}; any other exception type is treated as
   * transient too. */
  private shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
    if (attempt >= maxAttempts) return false;
    if (isAbortError(error)) return true;
    if (error instanceof ApiError && error.status !== undefined) {
      return isRetryableStatus(error.status);
    }
    return true;
  }

  /** Builds an {@link ApiError} from a non-ok response, preferring the
   * dashboard's `{ error: { code, message } }` envelope when present,
   * falling back to a generic `HTTP_<status>`. */
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

  /** Parses `input` as JSON, returning the raw string unchanged if invalid. */
  private tryParseJson(input: string): unknown {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }

  /** Normalizes any thrown value to a loggable string message. */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
  }
}
