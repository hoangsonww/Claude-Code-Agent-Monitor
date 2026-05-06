import { useState } from "react";
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

export function Composer(props: ComposerProps) {
  const state = useComposerState(props);
  const slash = useSlashCommands(props.sessionCwd);
  const cwds = useCwds();
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");

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

  // "cwd not in allowlist" is the most common /spawn failure — recover with a
  // single click instead of asking the user to navigate to Settings.
  const isCwdAllowlistError =
    !!state.error && /cwd not in allowlist/i.test(state.error);
  const onAddCwdAndRetry = async () => {
    try {
      await cwds.add(props.sessionCwd);
      // Trigger send again now that the cwd is in the allowlist
      void state.send();
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
          onSubmit={() => void state.send()}
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
        onSend={() => void state.send()}
        onStop={() => void state.stop()}
      />
    </Box>
  );
}

export default Composer;
