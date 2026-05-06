import { useCallback, useState } from "react";
import type { ProfileConfig, PermissionMode } from "../lib/profile-types";
import type { Attachment, ComposerProps } from "../lib/composer-types";
import { useUploads } from "./useUploads";

interface SpawnResponse { id: string; pid: number; status: string; startedAt: number }

function buildMessage(text: string, attachments: Attachment[]): string {
  if (!attachments.length) return text;
  const list = attachments.map((a) => `- ${a.path}`).join("\n");
  return `${text}\n\nAttached files:\n${list}`;
}

export function useComposerState(props: ComposerProps) {
  const [text, setText] = useState("");
  const [model, setModelState] = useState<string | null>(props.defaultModel || null);
  const [mode, setModeState] = useState<PermissionMode | null>(props.defaultMode || null);
  const [profileId, setProfileId] = useState<string | null>(props.defaultProfileId || null);
  const [busy, setBusy] = useState(false);
  const [respawning, setRespawning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveHandleId, setLiveHandleId] = useState<string | null>(props.sessionLiveHandleId || null);

  const uploads = useUploads(props.sessionCwd);

  const buildConfig = useCallback((): ProfileConfig => {
    const cfg: ProfileConfig = {};
    if (model) cfg.model = model;
    if (mode) cfg.permissionMode = mode;
    return cfg;
  }, [model, mode]);

  const respawnWithFlags = useCallback(
    async (newConfig: ProfileConfig, queuedText: string) => {
      if (!liveHandleId) return null;
      setRespawning(true);
      setError(null);
      try {
        const res = await fetch(`/api/orchestrator/agents/${liveHandleId}/respawn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: newConfig, prompt: queuedText }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
        const next = (await res.json()) as SpawnResponse;
        setLiveHandleId(next.id);
        props.onLiveHandleChange?.(next.id);
        return next.id;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setRespawning(false);
      }
    },
    [liveHandleId, props],
  );

  const setModel = useCallback(
    async (next: string | null) => {
      if (next === model) return;
      setModelState(next);
      if (liveHandleId) {
        await respawnWithFlags({ ...buildConfig(), model: next || undefined }, text);
      }
    },
    [model, liveHandleId, buildConfig, text, respawnWithFlags],
  );

  const setMode = useCallback(
    async (next: PermissionMode | null) => {
      if (next === mode) return;
      setModeState(next);
      if (liveHandleId) {
        await respawnWithFlags({ ...buildConfig(), permissionMode: next || undefined }, text);
      }
    },
    [mode, liveHandleId, buildConfig, text, respawnWithFlags],
  );

  const send = useCallback(async () => {
    const finalText = buildMessage(text.trim(), uploads.attachments);
    if (!finalText) return;
    setBusy(true);
    setError(null);
    try {
      if (liveHandleId) {
        const res = await fetch(`/api/orchestrator/agents/${liveHandleId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: finalText }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
      } else {
        const body: Record<string, unknown> = {
          prompt: finalText,
          cwd: props.sessionCwd,
        };
        if (profileId) body.profileId = profileId;
        const cfg = buildConfig();
        if (Object.keys(cfg).length) body.configOverride = cfg;
        if (props.mode === "resume") body.resumeSessionId = props.sessionId;
        const res = await fetch("/api/orchestrator/spawn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${res.status}`);
        const next = (await res.json()) as SpawnResponse;
        setLiveHandleId(next.id);
        props.onLiveHandleChange?.(next.id);
      }
      setText("");
      uploads.clear();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [text, uploads, liveHandleId, profileId, buildConfig, props]);

  const stop = useCallback(async () => {
    if (!liveHandleId) return;
    await fetch(`/api/orchestrator/agents/${liveHandleId}`, { method: "DELETE" });
    setLiveHandleId(null);
    props.onLiveHandleChange?.(null);
  }, [liveHandleId, props]);

  // Test seam: lets unit tests inject attachments without going through the multipart route.
  const addAttachmentForTest = useCallback((a: Attachment) => {
    uploads.__setAttachmentsForTest((prev) => [...prev, a]);
  }, [uploads]);

  return {
    text, setText,
    model, setModel,
    mode, setMode,
    profileId, setProfileId,
    busy, respawning, error,
    liveHandleId,
    uploads,
    send, stop,
    addAttachmentForTest,
  };
}
