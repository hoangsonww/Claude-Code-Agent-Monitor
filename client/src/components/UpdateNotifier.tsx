/**
 * @file UpdateNotifier.tsx
 * @description Modal surfaced when the dashboard's git checkout is behind its
 * remote tracking branch. Shows how many commits behind, the exact terminal
 * command to update, and copy-to-clipboard — the dashboard never pulls or
 * restarts itself.
 *
 * ## State sources
 * - Initial fetch via `api.updates.status()` on mount.
 * - Live refresh from WebSocket `update_status` events on {@link eventBus}.
 *
 * ## Dismissal persistence
 * Dismissals are keyed by `remote_sha` in `localStorage` so a new upstream
 * commit re-opens the prompt. Settings can reset dismissal via the
 * `dashboard:reset-update-dismissal` window event.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/UpdateNotifier.tsx`
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
 * - `../lib/api`
 * - `../lib/eventBus`
 * - `../lib/types`
 *
 * ## Public surface
 * - `UpdateNotifier` — exported API; see TSDoc on the symbol for behavior.
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
 * **UpdateNotifier**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, X, Copy, Check, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import type { UpdateStatusPayload, WSMessage } from "../lib/types";

/** `localStorage` key storing the dismissed upstream SHA. */
const DISMISS_KEY = "agent-monitor-update-dismissed-sha";

/** Narrow unknown WebSocket payloads to {@link UpdateStatusPayload}. */
function isUpdatePayload(x: unknown): x is UpdateStatusPayload {
  return typeof x === "object" && x !== null && "git_repo" in x && "update_available" in x;
}

/** Read the last dismissed upstream SHA from `localStorage`, or null. */
function loadDismissedSha(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/**
 * Git update availability modal — mounted once in {@link Layout}.
 * @returns `null` when no update is available or the current SHA was dismissed.
 */
export function UpdateNotifier() {
  const { t } = useTranslation("updates");
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [dismissedSha, setDismissedSha] = useState<string | null>(loadDismissedSha);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const syncFromPayload = useCallback((s: UpdateStatusPayload) => {
    setStatus(s);
    if (!s.fetch_error) setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.updates
      .status()
      .then((s) => {
        if (cancelled) return;
        syncFromPayload(s);
        eventBus.publish({
          type: "update_status",
          data: s,
          timestamp: new Date().toISOString(),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [syncFromPayload]);

  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type !== "update_status") return;
      if (isUpdatePayload(msg.data)) syncFromPayload(msg.data);
    });
  }, [syncFromPayload]);

  useEffect(() => {
    const handler = () => setDismissedSha(null);
    window.addEventListener("dashboard:reset-update-dismissal", handler);
    return () => window.removeEventListener("dashboard:reset-update-dismissal", handler);
  }, []);

  const show = Boolean(
    status?.update_available && status.remote_sha && dismissedSha !== status.remote_sha
  );

  const dismiss = useCallback(() => {
    if (!status?.remote_sha) return;
    try {
      localStorage.setItem(DISMISS_KEY, status.remote_sha);
    } catch {
      /* ignore */
    }
    setDismissedSha(status.remote_sha);
  }, [status?.remote_sha]);

  // Escape to dismiss - standard modal affordance.
  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [show, dismiss]);

  const copyCmd = async () => {
    if (!status?.manual_command) return;
    try {
      await navigator.clipboard.writeText(status.manual_command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const checkNow = async () => {
    if (checking) return;
    setError(null);
    setChecking(true);
    try {
      const fresh = await api.updates.check();
      syncFromPayload(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("checkError"));
    } finally {
      setChecking(false);
    }
  };

  if (!show || !status) return null;

  const refLabel = status.remote_ref || "origin";
  const behind = status.commits_behind ?? 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-notifier-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="w-full max-w-lg card shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-accent" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2
                id="update-notifier-title"
                className="text-sm font-semibold text-gray-100 truncate"
              >
                {t("title")}
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate">
                {t("commitsBehind", { count: behind, ref: refLabel })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("dismiss")}
            className="p-1.5 -m-1 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-surface-4 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-300 leading-relaxed">{t("lead")}</p>

          {status.fetch_error ? (
            <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              {t("fetchError")}
            </div>
          ) : null}

          {!status.git_repo ? (
            <div className="text-xs text-gray-400 bg-surface-2 border border-border rounded-lg px-3 py-2">
              {t("notGit")}
            </div>
          ) : null}

          {status.situation_note ? (
            <div className="text-xs text-amber-200/90 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
              {status.situation_note}
            </div>
          ) : null}

          {status.manual_command ? (
            <pre
              className="bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-[11px] font-mono text-gray-200 whitespace-pre-wrap break-all leading-relaxed"
              aria-label={t("commandLabel")}
            >
              {status.manual_command}
            </pre>
          ) : null}

          {/* The restart hint only applies when the printed command actually
           * rewrites the working tree. Feature-branch / detached-HEAD commands
           * are fetch-only - restarting the dashboard would change nothing. */}
          {status.situation === "tracking_canonical" ||
          status.situation === "fork_or_diverged_tracking" ? (
            <p className="text-[11px] text-gray-500 leading-relaxed">{t("restartNote")}</p>
          ) : null}

          {error ? (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-2/40">
          <button
            type="button"
            onClick={checkNow}
            disabled={checking}
            className="btn-ghost disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} aria-hidden />
            {checking ? t("checking") : t("checkNow")}
          </button>
          <button type="button" onClick={dismiss} className="btn-ghost">
            {t("dismiss")}
          </button>
          {status.manual_command ? (
            <button
              type="button"
              onClick={copyCmd}
              disabled={copied}
              className="btn-primary disabled:opacity-70"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t("copied") : t("copy")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
