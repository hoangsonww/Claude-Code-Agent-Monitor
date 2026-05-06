import { useCallback, useEffect, useState } from "react";

interface CwdEntry {
  path: string;
  source: string;
  added_at: number;
  last_used_at?: number | null;
}

const BASE = "/api/orchestrator/cwds";

export function useCwds() {
  const [cwds, setCwds] = useState<CwdEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(BASE);
      if (res.ok) setCwds(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const add = useCallback(
    async (path: string) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, source: "manual" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (path: string) => {
      await fetch(BASE, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      await refresh();
    },
    [refresh],
  );

  return { cwds, error, refresh, add, remove };
}
