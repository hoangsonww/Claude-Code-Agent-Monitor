/**
 * @file useHooksMgmt.ts
 * @description Thin React hooks that wrap the read-only hooks-management REST
 * surface (GET /api/hooks-mgmt/...). Each hook owns its own load/error state
 * and exposes a `reload()` callback so callers can re-fetch on demand. When
 * the orchestrator is disabled the API returns 404 with a sentinel error
 * string — callers get a typed "disabled" flag so they can render an
 * "enable to use" prompt.
 *
 * Mirrors the shape of useSkills.ts intentionally.
 */

import { useCallback, useEffect, useState } from "react";

// Shared types.

export interface HookCommand {
  type?: string;
  command?: string;
  // Some Claude Code releases include `timeout`, `run_in_background`, etc.
  // We don't enumerate them — the UI renders unknown fields generically.
  [key: string]: unknown;
}

export interface HookEntry {
  matcher?: string;
  hooks?: HookCommand[];
  [key: string]: unknown;
}

export interface HookEventDoc {
  description: string;
  since: string;
}

export interface HookEventConfig {
  doc: HookEventDoc;
  user: HookEntry[];
  project: HookEntry[];
  local: HookEntry[];
  hasAny: boolean;
}

export interface HooksConfigSummary {
  totalEventTypesWithHooks: number;
  totalCommands: number;
  bySource: {
    user: boolean;
    project: boolean;
    local: boolean;
  };
  paths: {
    user: string;
    project: string;
    local: string;
  };
}

export interface HooksConfigResponse {
  events: Record<string, HookEventConfig>;
  summary: HooksConfigSummary;
  errors: {
    user: string | null;
    project: string | null;
    local: string | null;
  };
}

export interface ScopeHooksResponse {
  scope: "user" | "project" | "local";
  hooks: Record<string, HookEntry[]> | null;
  exists: boolean;
  error?: string | null;
  path: string;
}

export interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  disabled: boolean;
  reload: () => void;
}

async function getJson<T>(
  url: string
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url);
  if (res.status === 404) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, status: 404, error: body.error || "not found" };
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    return { ok: false, status: res.status, error: body.error || `HTTP ${res.status}` };
  }
  return { ok: true, data: (await res.json()) as T };
}

function useFetched<T>(url: string | null): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) {
      setData(null);
      setError(null);
      setLoading(false);
      setDisabled(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDisabled(false);
    getJson<T>(url)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setData(r.data);
        } else if (r.status === 404 && r.error === "hooks-mgmt routes disabled") {
          setDisabled(true);
          setData(null);
        } else {
          setError(r.error);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, disabled, reload };
}

// Public hooks.

export function useHooksConfig() {
  return useFetched<HooksConfigResponse>("/api/hooks-mgmt/");
}

export function useScopeHooks(scope: "user" | "project" | "local" | null) {
  const url = scope ? `/api/hooks-mgmt/scope/${encodeURIComponent(scope)}` : null;
  return useFetched<ScopeHooksResponse>(url);
}

export function useHookEventDocs() {
  return useFetched<{ events: Record<string, HookEventDoc> }>("/api/hooks-mgmt/events");
}
