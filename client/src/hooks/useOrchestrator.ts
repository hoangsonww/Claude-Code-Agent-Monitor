/**
 * @file useOrchestrator.ts
 * @description Thin React hook that wraps the orchestrator REST surface:
 *   - POST /api/orchestrator/spawn          → spawn a new Claude Code subprocess
 *   - POST /api/orchestrator/agents/:id/message → send a follow-up turn
 *   - DELETE /api/orchestrator/agents/:id   → terminate a running agent
 *
 * Tracks in-flight state and the last error so callers can render a busy
 * indicator and surface failures without managing fetch lifecycle.
 */

import { useCallback, useState } from "react";
import type { ProfileConfig } from "../lib/profile-types";

export interface SpawnArgs {
  prompt: string;
  cwd: string;
  profileId?: string;
  config?: ProfileConfig;
  resumeSessionId?: string;
  forkSession?: boolean;
}

export interface SpawnResult {
  id: string;
  pid: number;
  status: string;
  startedAt: number;
}

export function useOrchestrator() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback(async (args: SpawnArgs): Promise<SpawnResult | null> => {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        prompt: args.prompt,
        cwd: args.cwd,
      };
      if (args.profileId) body.profileId = args.profileId;
      if (args.config) body.configOverride = args.config;
      if (args.resumeSessionId) body.resumeSessionId = args.resumeSessionId;
      if (args.forkSession) body.forkSession = args.forkSession;
      const res = await fetch("/api/orchestrator/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
      return (await res.json()) as SpawnResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (id: string, text: string): Promise<{ messageId: string } | null> => {
      try {
        const res = await fetch(`/api/orchestrator/agents/${id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return (await res.json()) as { messageId: string };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [],
  );

  const kill = useCallback(async (id: string) => {
    await fetch(`/api/orchestrator/agents/${id}`, { method: "DELETE" });
  }, []);

  return { spawn, sendMessage, kill, busy, error };
}
