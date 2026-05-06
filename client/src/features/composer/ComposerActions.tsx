import { Button, Stack, Box, CircularProgress } from "@mui/material";

interface Props {
  canSend: boolean;
  busy: boolean;
  respawning: boolean;
  liveHandleId: string | null;
  onSend: () => void;
  onStop: () => void;
}

export function ComposerActions({ canSend, busy, respawning, liveHandleId, onSend, onStop }: Props) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", p: 1, borderTop: "1px solid", borderColor: "divider" }}>
      <Box sx={{ flex: 1, fontSize: 12, color: "text.secondary" }}>
        {respawning ? <span><CircularProgress size={10} sx={{ mr: 1 }} />respawning…</span> : "Cmd+Enter to send"}
      </Box>
      {liveHandleId && (
        <Button variant="outlined" color="warning" size="small" onClick={onStop} disabled={busy}>Stop</Button>
      )}
      <Button variant="contained" size="small" disabled={!canSend} onClick={onSend}>Send</Button>
    </Stack>
  );
}
