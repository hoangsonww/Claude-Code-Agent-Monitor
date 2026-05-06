import { useCallback, useState } from "react";
import type { Attachment } from "../lib/composer-types";

export function useUploads(cwd: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (file: File) => {
      if (!cwd) {
        setError("cwd required");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.set("cwd", cwd);
        fd.set("file", file, file.name);
        const res = await fetch("/api/orchestrator/uploads", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `${res.status}`);
        }
        const att = (await res.json()) as Attachment;
        setAttachments((prev) => [...prev, att]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [cwd],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/orchestrator/uploads/${id}?cwd=${encodeURIComponent(cwd)}`, { method: "DELETE" });
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [cwd],
  );

  const clear = useCallback(() => setAttachments([]), []);

  return {
    attachments, busy, error, add, remove, clear,
    // Test seam: bypass the multipart route. Public surface should be `add`.
    __setAttachmentsForTest: setAttachments,
  };
}
