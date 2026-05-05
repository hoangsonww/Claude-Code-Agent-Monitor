/**
 * @file useContext.ts
 * @description Thin React hooks that wrap the read-only context-management
 * REST surface (GET /api/context/...). Each hook owns its own load/error/
 * loading state and exposes a `reload()` callback so callers can re-fetch on
 * demand. When ORCHESTRATOR_ENABLED is unset the API returns 404 — callers
 * get a typed `disabled` flag so they can render an "enable to use" prompt.
 *
 * Note: this module is named `useContext.ts` after the *feature* (Claude
 * Code's context management surface). It deliberately does NOT import
 * React's `useContext` — that would shadow the file's exports. We use
 * React.useContext qualified if/when we ever need it.
 */

import { useCallback, useEffect, useState } from "react";

// ── Shared types ────────────────────────────────────────────────────────────

export interface CompactionEvent {
  id: number;
  sessionId: string;
  eventType: "PreCompact" | "PostCompact" | "Compaction";
  timestamp: string;
  pairId: number | null;
  payload: Record<string, unknown> | null;
  summary: string | null;
  // Only present on the global feed (joined from sessions).
  sessionName?: string | null;
  sessionCwd?: string | null;
  sessionStatus?: string | null;
}

export interface CompactionsSummary {
  total: number;
  preCompactCount: number;
  postCompactCount: number;
  compactionCount: number;
  uniqueSessions: number;
  pairCount: number;
}

export interface CompactionsResponse {
  events: CompactionEvent[];
  summary: CompactionsSummary;
  limit: number;
}

export interface SessionCompactionsResponse {
  sessionId: string;
  events: CompactionEvent[];
  count: number;
}

export interface SessionBudgetTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export interface SessionBudgetResponse {
  sessionId: string;
  eventCounts: Record<string, number>;
  totalEvents: number;
  compactionEvents: number;
  tokens: SessionBudgetTokens | null;
  note: string;
}

interface FetchState<T> {
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
        } else {
          if (r.status === 404 && r.error === "context routes disabled") {
            setDisabled(true);
            setData(null);
          } else {
            setError(r.error);
          }
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

// ── Public hooks ────────────────────────────────────────────────────────────

export function useCompactions(limit = 100) {
  const url = `/api/context/compactions?limit=${encodeURIComponent(String(limit))}`;
  return useFetched<CompactionsResponse>(url);
}

export function useSessionCompactions(sessionId: string | null) {
  const url = sessionId
    ? `/api/context/compactions/${encodeURIComponent(sessionId)}`
    : null;
  return useFetched<SessionCompactionsResponse>(url);
}

export function useSessionBudget(sessionId: string | null) {
  const url = sessionId
    ? `/api/context/sessions/${encodeURIComponent(sessionId)}/budget`
    : null;
  return useFetched<SessionBudgetResponse>(url);
}
