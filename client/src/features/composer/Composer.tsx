import { useEffect, useRef, useState } from "react";
import { Box, Alert, Button } from "@mui/material";
import { useComposerState } from "../../hooks/useComposerState";
import { useSlashCommands } from "../../hooks/useSlashCommands";
import { useCwds } from "../../hooks/useCwds";
import { ComposerToolbar } from "./ComposerToolbar";
import { AttachmentBar } from "./AttachmentBar";
import { ComposerTextarea } from "./ComposerTextarea";
import { ComposerActions } from "./ComposerActions";
import { SlashMenu } from "./SlashMenu";
import type { ComposerProps, SlashCommand } from "../../lib/composer-types";
import type { ContextUsage } from "../../lib/context-window";

interface Props extends ComposerProps {
  /** Latest context-window snapshot (rendered as the toolbar capacity ring). */
  contextUsage?: ContextUsage | null;
  /**
   * Called whenever the user-typed (non-submitted) text or the in-flight
   * pending text changes. Lets ConversationView render an optimistic user
   * bubble while `state.busy === true`.
   */
  onPendingChange?: (text: string | null) => void;
}

export function Composer(props: Props) {
  const { contextUsage, onPendingChange, ...composerProps } = props;
  const state = useComposerState(composerProps);
  const slash = useSlashCommands(props.sessionCwd);
  const cwds = useCwds();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");

  // Optimistic user-message tracking. We snapshot the textarea contents at
  // the moment the user clicks Send and report it to ConversationView so a
  // dimmed "Sending…" bubble can render immediately. When `busy` flips back
  // to false the parent clears the pending bubble (the JSONL catch-up will
  // surface the real message within a few seconds).
  const pendingRef = useRef<string | null>(null);
  const wasBusyRef = useRef(false);

  useEffect(() => {
    if (state.busy && !wasBusyRef.current) {
      // Just transitioned to busy — nothing to do here; the send wrapper
      // captured the snapshot before calling state.send().
    } else if (!state.busy && wasBusyRef.current) {
      // Send resolved (or errored) — clear pending so the JSONL message can
      // take over without the bubble lingering on screen.
      pendingRef.current = null;
      onPendingChange?.(null);
    }
    wasBusyRef.current = state.busy;
  }, [state.busy, onPendingChange]);

  const onPickSlash = (cmd: SlashCommand) => {
    // Replace the trailing '/<partial>' with '/<cmd.name> '
    const next = state.text.replace(/(^|\s)\/[\w-]*$/, (m) => {
      const prefix = m.startsWith(" ") ? " " : "";
      return `${prefix}/${cmd.name} `;
    });
    state.setText(next);
    setSlashOpen(false);
  };

  const canSend = !state.busy && (!!state.text.trim() || state.uploads.attachments.length > 0);

  // Wraps state.send() so we can publish the optimistic-bubble snapshot
  // before the network round-trip. Cleared once busy flips false. Override
  // text (e.g. /compact) bypasses the textarea entirely so the user's draft
  // isn't destroyed; it's also passed straight through to send() because
  // setState is async — calling state.send() after setText would still read
  // the old textarea value from send's closure.
  const doSend = (overrideText?: string) => {
    const snapshot = (overrideText ?? state.text).trim();
    if (!snapshot && state.uploads.attachments.length === 0) return;
    pendingRef.current = snapshot || null;
    if (snapshot) onPendingChange?.(snapshot);
    void state.send(overrideText);
  };

  // "cwd not in allowlist" is the most common /spawn failure — recover with a
  // single click instead of asking the user to navigate to Settings.
  const isCwdAllowlistError =
    !!state.error && /cwd not in allowlist/i.test(state.error);
  const onAddCwdAndRetry = async () => {
    try {
      await cwds.add(props.sessionCwd);
      // Trigger send again now that the cwd is in the allowlist
      doSend();
    } catch {
      /* error surfaces via cwds hook; state.error stays as-is until next send */
    }
  };

  return (
    <Box sx={{
      borderTop: "1px solid",
      borderColor: "divider",
      background: "background.paper",
      // On mobile the BottomTabNav (position: fixed, height 56px + safe-area)
      // overlays the bottom of the viewport. Reserve clearance below the
      // composer so the Send/Stop row sits ABOVE the tab bar.
      mb: { xs: "calc(56px + env(safe-area-inset-bottom, 0px))", md: 0 },
    }}>
      {state.error && (
        <Alert
          severity={isCwdAllowlistError ? "warning" : "error"}
          sx={{ borderRadius: 0 }}
          action={
            isCwdAllowlistError ? (
              <Button color="inherit" size="small" onClick={onAddCwdAndRetry}>
                Add cwd & retry
              </Button>
            ) : null
          }
        >
          {isCwdAllowlistError
            ? `This session's cwd (${props.sessionCwd}) isn't in the allowlist.`
            : state.error}
        </Alert>
      )}
      <ComposerToolbar
        model={state.model}
        onModelChange={(v) => void state.setModel(v)}
        mode={state.mode}
        onModeChange={(v) => void state.setMode(v)}
        profileId={state.profileId}
        onProfileIdChange={state.setProfileId}
        onAddFile={(f) => void state.uploads.add(f)}
        busy={state.busy}
        contextUsage={contextUsage ?? null}
        onCompact={() => doSend("/compact")}
      />
      <AttachmentBar attachments={state.uploads.attachments} onRemove={(id) => void state.uploads.remove(id)} />
      <Box sx={{ position: "relative" }}>
        <SlashMenu
          open={slashOpen}
          catalog={slash.catalog}
          query={slashQuery}
          onPick={onPickSlash}
          onClose={() => setSlashOpen(false)}
        />
        <ComposerTextarea
          value={state.text}
          onChange={state.setText}
          onSubmit={() => doSend()}
          onAddFiles={(files) => files.forEach((f) => void state.uploads.add(f))}
          onSlashStateChange={(open, q) => {
            setSlashOpen(open);
            setSlashQuery(q);
          }}
          disabled={state.busy}
        />
      </Box>
      <ComposerActions
        canSend={canSend}
        busy={state.busy}
        respawning={state.respawning}
        liveHandleId={state.liveHandleId}
        onSend={() => doSend()}
        onStop={() => void state.stop()}
      />
    </Box>
  );
}

export default Composer;
