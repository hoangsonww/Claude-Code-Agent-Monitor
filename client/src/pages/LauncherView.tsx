import { useState } from "react";
import { Alert, Button, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import { ProfileEditor, ProfileEditorValue } from "../features/launcher/ProfileEditor";
import { CommandPreview } from "../features/launcher/CommandPreview";
import { useProfiles } from "../hooks/useProfiles";
import { useOrchestrator } from "../hooks/useOrchestrator";

export function LauncherView() {
  const { profiles, create } = useProfiles();
  const { spawn, busy, error } = useOrchestrator();
  const [editor, setEditor] = useState<ProfileEditorValue>({ name: "", config: {} });
  const [prompt, setPrompt] = useState("");
  const cwd = editor.defaultCwd;

  const canLaunch = !!cwd && !!prompt.trim() && !busy;
  const canSave = !!editor.name && !busy;

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2}>
          <TextField
            label="Initial prompt"
            multiline
            minRows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            fullWidth
          />
          <ProfileEditor value={editor} onChange={setEditor} />
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Paper sx={{ p: 2, position: "sticky", top: 16 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Command preview</Typography>
          <CommandPreview config={editor.config} perLaunch={{ prompt, cwd }} />
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              disabled={!canSave}
              onClick={async () => {
                await create({
                  name: editor.name,
                  description: editor.description,
                  config: editor.config,
                  defaultCwd: editor.defaultCwd,
                });
              }}
            >
              Save as profile
            </Button>
            <Button
              variant="contained"
              disabled={!canLaunch}
              onClick={async () => {
                if (!cwd) return;
                // T21 will extend spawn to honor editor.config as configOverride.
                // Today we launch with default flags; profile is editable + saveable.
                await spawn({ prompt, cwd });
              }}
            >
              Launch
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ display: "block", mt: 2, color: "text.secondary" }}>
            {profiles.length} saved profile{profiles.length === 1 ? "" : "s"} · {busy ? "busy" : "idle"}
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default LauncherView;
