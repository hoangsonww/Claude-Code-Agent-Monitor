import { useState } from "react";
import { Box, Button, MenuItem, Stack, TextField } from "@mui/material";
import { useOrchestrator } from "../../hooks/useOrchestrator";
import { useProfiles } from "../../hooks/useProfiles";

interface Props {
  sessionId: string;
  sessionLiveHandleId?: string | null;
  sessionCwd: string;
  defaultProfileId?: string | null;
}

export function SendComposer({ sessionId, sessionLiveHandleId, sessionCwd, defaultProfileId }: Props) {
  const [text, setText] = useState("");
  const [profileId, setProfileId] = useState<string>(defaultProfileId || "");
  const { spawn, sendMessage, kill, busy, error } = useOrchestrator();
  const { profiles } = useProfiles();

  const onSend = async () => {
    if (!text.trim()) return;
    if (sessionLiveHandleId) {
      await sendMessage(sessionLiveHandleId, text);
    } else {
      await spawn({
        prompt: text,
        cwd: sessionCwd,
        profileId: profileId || undefined,
        resumeSessionId: sessionId,
      });
    }
    setText("");
  };

  return (
    <Box sx={{ p: 1, borderTop: "1px solid", borderColor: "divider", background: "background.paper" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <TextField
          select
          size="small"
          label="Profile"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">(none)</MenuItem>
          {profiles.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={6}
          placeholder="Message Claude…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <Button variant="contained" disabled={!text.trim() || busy} onClick={onSend}>Send</Button>
        {sessionLiveHandleId && (
          <Button variant="outlined" color="warning" onClick={() => kill(sessionLiveHandleId)}>Stop</Button>
        )}
      </Stack>
      {error && <Box sx={{ color: "error.main", mt: 0.5, fontSize: 12 }}>{error}</Box>}
    </Box>
  );
}

export default SendComposer;
