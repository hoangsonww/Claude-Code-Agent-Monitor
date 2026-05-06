import { useCallback, useEffect, useState } from "react";
import type { SlashCatalog } from "../lib/composer-types";

const EMPTY: SlashCatalog = { builtin: [], skills: [], plugins: [], project: [] };

export function useSlashCommands(cwd: string | null | undefined) {
  const [catalog, setCatalog] = useState<SlashCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cwd) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orchestrator/slash-commands?cwd=${encodeURIComponent(cwd)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as SlashCatalog;
        if (!cancelled) setCatalog(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  const filter = useCallback(
    (query: string): SlashCatalog => {
      const c = catalog || EMPTY;
      if (!query) return c;
      const q = query.toLowerCase();
      const match = (cmd: { name: string; description: string }) =>
        cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q);
      return {
        builtin: c.builtin.filter(match),
        skills: c.skills.filter(match),
        plugins: c.plugins.filter(match),
        project: c.project.filter(match),
      };
    },
    [catalog],
  );

  return { catalog, error, filter };
}
