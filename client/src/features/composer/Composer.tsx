import { useState } from "react";
import { Box, Alert } from "@mui/material";
import { useComposerState } from "../../hooks/useComposerState";
import { useSlashCommands } from "../../hooks/useSlashCommands";
import { ComposerToolbar } from "./ComposerToolbar";
import { AttachmentBar } from "./AttachmentBar";
import { ComposerTextarea } from "./ComposerTextarea";
import { ComposerActions } from "./ComposerActions";
import { SlashMenu } from "./SlashMenu";
import type { ComposerProps, SlashCommand } from "../../lib/composer-types";

export function Composer(props: ComposerProps) {
  const state = useComposerState(props);
  const slash = useSlashCommands(props.sessionCwd);
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

  return (
    <Box sx={{ borderTop: "1px solid", borderColor: "divider", background: "background.paper" }}>
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
      {state.error && <Alert severity="error" sx={{ m: 1 }}>{state.error}</Alert>}
    </Box>
  );
}

export default Composer;
