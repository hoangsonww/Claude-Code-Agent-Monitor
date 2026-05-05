/**
 * @file useOrchestrator.ts
 * @description Thin React hook that wraps the orchestrator REST surface (POST
 * /api/orchestrator/spawn and DELETE /api/orchestrator/agents/:id). Tracks
 * in-flight state and the last error so callers (e.g. MobileChat) can render
 * a busy indicator and surface failures without managing fetch lifecycle.
 */

import { useState, useCallback } from "react";

export interface OrchestratorPreset {
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  maxBudgetUsd?: number;
  model?: string;
  allowedTools?: string[];
  appendSystemPrompt?: string;
}

export interface SpawnResult {
  id: string;
  pid: number;
  status: string;
  startedAt: number;
}

interface SpawnArgs {
  prompt: string;
  preset?: OrchestratorPreset;
  channelId?: string;
  cwd?: string;
}

export function useOrchestrator() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback(async (args: SpawnArgs): Promise<SpawnResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orchestrator/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as SpawnResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const kill = useCallback(async (id: string) => {
    await fetch(`/api/orchestrator/agents/${id}`, { method: "DELETE" });
  }, []);

  return { spawn, kill, busy, error };
}
