/**
 * @file useOrchestratorEnabled.ts
 * @description One-shot probe of `/api/orchestrator/` so nav surfaces can hide
 *   feature-flagged entries (e.g. Routines, Launcher-only flows) when the
 *   orchestrator is disabled. The endpoint returns 404 when the flag is off,
 *   so a simple ok-check is enough.
 *
 *   Identical fetch shape used by Sidebar and BottomTabNav — extracting it
 *   into a hook keeps the two nav surfaces in sync without duplicating the
 *   probe logic.
 */

import { useEffect, useState } from "react";

export function useOrchestratorEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/orchestrator/")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (cancelled) return;
        if (
          body &&
          typeof body === "object" &&
          "enabled" in body &&
          (body as { enabled: unknown }).enabled === true
        ) {
          setEnabled(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
