import { useCallback, useEffect, useState } from "react";
import type { Profile, ProfileConfig } from "../lib/profile-types";

const BASE = "/api/orchestrator/profiles";

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(BASE);
      if (!res.ok) throw new Error(`${res.status}`);
      setProfiles(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (payload: { name: string; description?: string; config: ProfileConfig; defaultCwd?: string }) => {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
      const created = (await res.json()) as Profile;
      await refresh();
      return created;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<{ name: string; description: string; config: ProfileConfig; defaultCwd: string }>) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await refresh();
      return (await res.json()) as Profile;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`${BASE}/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  const duplicate = useCallback(
    async (id: string) => {
      const res = await fetch(`${BASE}/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      await refresh();
      return (await res.json()) as Profile;
    },
    [refresh],
  );

  const importJson = useCallback(
    async (payload: unknown) => {
      const res = await fetch(`${BASE}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await refresh();
      return (await res.json()) as Profile;
    },
    [refresh],
  );

  return { profiles, loading, error, refresh, create, update, remove, duplicate, importJson };
}
