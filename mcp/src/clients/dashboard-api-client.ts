/**
 * @file dashboard-api-client.ts
 * @description Client for making API requests to the MCP dashboard. This client provides methods for sending HTTP requests (GET, POST, PUT, PATCH, DELETE) to the dashboard's API endpoints, with built-in support for retries on transient errors, request timeouts, and error handling. The client constructs URLs based on a base URL from the configuration and allows for query parameters and request bodies. It also defines a custom ApiError class for consistent error representation across the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/mcp/src/clients/dashboard-api-client.ts`
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
 *
 * ## Public surface
 * - `ApiError` — exported API; see TSDoc on the symbol for behavior.
 * - `DashboardApiClient` — exported API; see TSDoc on the symbol for behavior.
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
 * **ApiError**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **DashboardApiClient**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { setTimeout as sleep } from "node:timers/promises";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config/app-config.js";
import { Logger } from "../core/logger.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_BINARY_RESPONSE_BYTES = 10 * 1024 * 1024;

interface RequestOptions {
  /** Query params; `undefined`/`null` values are omitted, not stringified. */
  query?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
  /** Request body, JSON-stringified as-is; omitted when `undefined`. */
  body?: unknown;
  /** Marks the request retry-eligible; set only by `get` below. */
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
 * **Retry semantics**: only GET marks itself `idempotent`, so only reads retry
 * automatically — `config.retryCount` extra attempts (default 2)
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

  /** DELETE — never retried, because a lost successful response must not
   * trigger a second destructive/config mutation. A JSON body is supported
   * because the Claude/Codex config deletion endpoints use one. */
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  /**
   * POST multipart files from the MCP host filesystem. Used only for the
   * dashboard's provider-aware history upload endpoint, with no retries so a
   * lost response can never duplicate a mutation.
   */
  async postFiles<T>(
    requestPath: string,
    filePaths: string[],
    fields: Record<string, string> = {}
  ): Promise<T> {
    const url = this.buildUrl(requestPath);
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    let totalBytes = 0;
    for (const filePath of filePaths) {
      const metadata = await stat(filePath);
      if (!metadata.isFile()) {
        throw new ApiError(`Upload path is not a file: ${filePath}`, { code: "INVALID_PATH" });
      }
      totalBytes += metadata.size;
      if (metadata.size > MAX_UPLOAD_FILE_BYTES || totalBytes > MAX_UPLOAD_TOTAL_BYTES) {
        throw new ApiError(`Upload exceeds the configured size limit: ${filePath}`, {
          code: "TOO_LARGE",
          details: {
            max_file_bytes: MAX_UPLOAD_FILE_BYTES,
            max_total_bytes: MAX_UPLOAD_TOTAL_BYTES,
          },
        });
      }
      const data = await readFile(filePath);
      form.append("files", new Blob([data]), path.basename(filePath));
    }
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.config.dashboardApiToken
          ? { Authorization: `Bearer ${this.config.dashboardApiToken}` }
          : undefined,
        body: form,
        redirect: "error",
        signal: abortController.signal,
      });
      const rawBody = await response.text();
      const body = rawBody ? this.tryParseJson(rawBody) : null;
      if (!response.ok) {
        throw this.toApiError("POST", url, response.status, body ?? rawBody);
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isAbortError(error)) {
        throw new ApiError(
          `Request timed out after ${this.config.requestTimeoutMs}ms: POST ${url.pathname}`,
          { code: "TIMEOUT" }
        );
      }
      throw new ApiError(`Request failed: POST ${url.pathname}`, {
        code: "REQUEST_FAILED",
        details: this.getErrorMessage(error),
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /** GET a binary response as a base64 payload with its content type. */
  async getBinary(
    requestPath: string,
    query: RequestOptions["query"] = {}
  ): Promise<{ content_type: string; base64: string; bytes: number }> {
    const url = this.buildUrl(requestPath, query);
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "*/*",
          ...(this.config.dashboardApiToken
            ? { Authorization: `Bearer ${this.config.dashboardApiToken}` }
            : {}),
        },
        redirect: "error",
        signal: abortController.signal,
      });
      if (!response.ok) {
        const rawBody = await response.text();
        throw this.toApiError("GET", url, response.status, this.tryParseJson(rawBody));
      }
      const declaredLength = Number.parseInt(response.headers.get("content-length") || "", 10);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BINARY_RESPONSE_BYTES) {
        throw new ApiError(`Binary response exceeds ${MAX_BINARY_RESPONSE_BYTES} bytes`, {
          code: "TOO_LARGE",
        });
      }
      const reader = response.body?.getReader();
      if (!reader)
        throw new ApiError("Binary response has no readable body", { code: "EMPTY_BODY" });
      const chunks: Buffer[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BINARY_RESPONSE_BYTES) {
          await reader.cancel();
          throw new ApiError(`Binary response exceeds ${MAX_BINARY_RESPONSE_BYTES} bytes`, {
            code: "TOO_LARGE",
          });
        }
        chunks.push(Buffer.from(value));
      }
      const bytes = Buffer.concat(chunks, total);
      return {
        content_type: response.headers.get("content-type") || "application/octet-stream",
        base64: bytes.toString("base64"),
        bytes: bytes.length,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isAbortError(error)) {
        throw new ApiError(
          `Request timed out after ${this.config.requestTimeoutMs}ms: GET ${url.pathname}`,
          { code: "TIMEOUT" }
        );
      }
      throw new ApiError(`Request failed: GET ${url.pathname}`, {
        code: "REQUEST_FAILED",
        details: this.getErrorMessage(error),
      });
    } finally {
      clearTimeout(timeout);
    }
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
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(key, String(item));
        } else if (value !== undefined && value !== null) {
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
            ...(this.config.dashboardApiToken
              ? { Authorization: `Bearer ${this.config.dashboardApiToken}` }
              : {}),
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          redirect: "error",
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
