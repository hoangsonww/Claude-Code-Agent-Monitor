import { useCallback, useState } from "react";
import type { ProfileConfig, PermissionMode, Effort } from "../lib/profile-types";
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
  const [effort, setEffortState] = useState<Effort | null>(null);
  // UI-only fast-mode toggle. v1 is a stub — see ModelPickerPopover TODO.
  const [fastMode, setFastMode] = useState(false);
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
    if (effort) cfg.effort = effort;
    return cfg;
  }, [model, mode, effort]);

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

  // Effort changes follow the same respawn pattern as model/mode: when the
  // session is already attached to a live handle, we have to re-spawn the
  // agent with the new flag — there's no in-flight reconfigure path.
  const setEffort = useCallback(
    async (next: Effort | null) => {
      if (next === effort) return;
      setEffortState(next);
      if (liveHandleId) {
        await respawnWithFlags({ ...buildConfig(), effort: next || undefined }, text);
      }
    },
    [effort, liveHandleId, buildConfig, text, respawnWithFlags],
  );

  // `overrideText` lets callers (e.g. the /compact button) send a fixed
  // message without touching the user's draft in the textarea. When omitted,
  // the current `text` is sent as before.
  const send = useCallback(async (overrideText?: string) => {
    const baseText = overrideText !== undefined ? overrideText : text;
    const finalText = buildMessage(baseText.trim(), uploads.attachments);
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
        // Default to "resume" so callers (like ConversationView) that don't pass
        // the prop still continue the existing session. Only MobileChat — which
        // mints a fresh sessionId locally — opts out by passing mode="fresh".
        if ((props.mode ?? "resume") === "resume") body.resumeSessionId = props.sessionId;
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
      // Only clear the draft when we sent the user's typed text. Override
      // sends (e.g. /compact) leave the textarea untouched.
      if (overrideText === undefined) {
        setText("");
        uploads.clear();
      }
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
    effort, setEffort,
    fastMode, setFastMode,
    profileId, setProfileId,
    busy, respawning, error,
    liveHandleId,
    uploads,
    send, stop,
    addAttachmentForTest,
  };
}
