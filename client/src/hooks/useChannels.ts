/**
 * @file useChannels.ts
 * @description Thin React hooks that wrap the read-only channels viewer REST
 * surface (GET /api/channels and /api/channels/raw). Mirrors the shape of
 * useMemory.ts so consumers get the same `disabled` flag when the orchestrator
 * gate is off.
 */

import { useCallback, useEffect, useState } from "react";

// ── Shared types ────────────────────────────────────────────────────────────

/**
 * A normalized channel record. Server merges `~/.claude.json` (project-scoped)
 * and `~/.claude/settings.json` (user-scoped) into a single list. Fields are
 * passed through verbatim from the underlying config — different channel
 * types have different payloads (slack uses `webhook`, telegram uses
 * `chatId`/`token`, etc.) so we keep an open record shape.
 */
export interface ChannelRecord {
  name?: string;
  type?: string;
  kind?: string;
  scope: "user" | "project";
  // Anything else the underlying config carries.
  [key: string]: unknown;
}

export interface ChannelsSummary {
  total: number;
  byScope: { user: number; project: number };
  byType: Record<string, number>;
}

export interface ChannelsResponse {
  channels: ChannelRecord[];
  summary: ChannelsSummary;
  sources: {
    settingsJson: string;
    claudeJson: string;
    cwd: string;
  };
  errors: { source: string; error: string }[];
}

export interface ChannelsRawResponse {
  settingsChannels: unknown;
  projectChannels: unknown;
  cwd: string;
  sources: {
    settingsJson: string;
    claudeJson: string;
  };
  errors: { source: string; error: string }[];
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

function useFetched<T>(url: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDisabled(false);
    getJson<T>(url)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setData(r.data);
        } else if (r.status === 404 && r.error === "channels routes disabled") {
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

// ── Public hooks ────────────────────────────────────────────────────────────

export function useChannels() {
  return useFetched<ChannelsResponse>("/api/channels");
}

export function useChannelsRaw() {
  return useFetched<ChannelsRawResponse>("/api/channels/raw");
}
