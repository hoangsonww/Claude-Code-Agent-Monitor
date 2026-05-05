/**
 * @file useMemory.ts
 * @description Thin React hooks that wrap the read-only memory browse REST
 * surface (GET /api/memory/...). Each hook owns its own load/error state and
 * exposes a `reload()` callback so callers can re-fetch on demand. When the
 * orchestrator is disabled the API returns 404 — callers get a typed
 * "disabled" flag so they can render an "enable to use" prompt.
 */

import { useCallback, useEffect, useState } from "react";

// ── Shared types ────────────────────────────────────────────────────────────

export interface MemoryProject {
  id: string;
  decodedPath: string;
  fileCount: number;
  totalBytes: number;
  latestMtime: number;
}

export interface MemoryFileMeta {
  name: string;
  size: number;
  mtime: number;
}

export interface MemoryFile {
  project: string;
  name: string;
  content: string;
  size: number;
  mtime: number;
}

export interface ClaudeMdEntry {
  path: string;
  content?: string;
  size?: number;
  mtime?: number;
  error?: string;
}

export interface ClaudeMdBundle {
  user: ClaudeMdEntry | null;
  project: ClaudeMdEntry | null;
  projectLocal: ClaudeMdEntry | null;
}

interface FetchState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  disabled: boolean;
  reload: () => void;
}

async function getJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url);
  if (res.status === 404) {
    // Distinguish "feature gated" from "resource missing" by inspecting body.
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
          if (r.status === 404 && r.error === "memory routes disabled") {
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

export function useProjects() {
  return useFetched<{ projects: MemoryProject[]; projectsDir: string }>("/api/memory/projects");
}

export function useFiles(projectId: string | null) {
  const url = projectId
    ? `/api/memory/projects/${encodeURIComponent(projectId)}/files`
    : null;
  return useFetched<{ project: string; decodedPath: string; files: MemoryFileMeta[] }>(url);
}

export function useFile(projectId: string | null, fileName: string | null) {
  const url =
    projectId && fileName
      ? `/api/memory/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileName)}`
      : null;
  return useFetched<MemoryFile>(url);
}

export function useClaudeMd() {
  return useFetched<ClaudeMdBundle>("/api/memory/claude-md");
}
