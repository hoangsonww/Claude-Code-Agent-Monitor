/**
 * @file useSkills.ts
 * @description Thin React hooks that wrap the read-only skills/plugins/agents
 * REST surface (GET /api/skills/...). Each hook owns its own load/error state
 * and exposes a `reload()` callback so callers can re-fetch on demand. When
 * the orchestrator is disabled the API returns 404 with a sentinel error
 * string — callers get a typed "disabled" flag so they can render an
 * "enable to use" prompt.
 *
 * Mirrors the shape of useMemory.ts intentionally.
 */

import { useCallback, useEffect, useState } from "react";

// Shared types.

export interface SkillSummary {
  scope: string; // "user" | "project" | "plugin:<name>"
  id: string;
  name: string;
  description: string;
  allowedTools: string;
  license: string;
  path: string;
  size: number;
  mtime: number;
}

export interface SkillFile {
  scope: string;
  name: string;
  frontmatter: Record<string, string>;
  body: string;
  raw: string;
  size: number;
  mtime: number;
  path: string;
}

export interface AgentSummary {
  scope: "user" | "project";
  id: string;
  name: string;
  description: string;
  tools: string;
  model: string;
  color: string;
  path: string;
  size: number;
  mtime: number;
}

// installed_plugins.json values can be array (current Claude Code shape) or
// scalar (older). We type as `unknown` and let the UI render JSON.
export type PluginEntry = unknown;
export type MarketplaceEntry = unknown;

export interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  disabled: boolean;
  reload: () => void;
}

async function getJson<T>(
  url: string,
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
        } else if (r.status === 404 && r.error === "skills routes disabled") {
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

export function useSkills() {
  return useFetched<{ skills: SkillSummary[]; count: number }>("/api/skills");
}

export function useSkillFile(scope: string | null, name: string | null) {
  const url =
    scope && name
      ? `/api/skills/${encodeURIComponent(scope)}/${encodeURIComponent(name)}/file`
      : null;
  return useFetched<SkillFile>(url);
}

export function useAgents() {
  return useFetched<{ agents: AgentSummary[]; count: number }>("/api/skills/agents");
}

export function usePlugins() {
  return useFetched<{
    plugins: Record<string, PluginEntry>;
    count: number;
    version?: number;
    path: string;
  }>("/api/skills/plugins");
}

export function useMarketplaces() {
  return useFetched<{
    marketplaces: Record<string, MarketplaceEntry>;
    count: number;
    path: string;
  }>("/api/skills/marketplaces");
}
