import { useState } from "react";
import { Box, Button, List, ListItemButton, ListItemText, Stack, Typography, Divider } from "@mui/material";
import { useProfiles } from "../hooks/useProfiles";
import { ProfileEditor, ProfileEditorValue } from "../features/launcher/ProfileEditor";
import type { Profile } from "../lib/profile-types";

export function SettingsProfiles() {
  const { profiles, update, remove, duplicate, importJson } = useProfiles();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = profiles.find((p) => p.id === selectedId) || null;

  const onChangeEditor = async (next: ProfileEditorValue) => {
    if (!selected) return;
    await update(selected.id, {
      name: next.name,
      description: next.description,
      config: next.config,
      defaultCwd: next.defaultCwd,
    });
  };

  const exportFor = async (p: Profile) => {
    const res = await fetch(`/api/orchestrator/profiles/${p.id}/export`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const json = JSON.parse(await file.text());
      await importJson(json);
    };
    input.click();
  };

  return (
    <Box sx={{ display: "flex", gap: 2, p: 2, height: "100%" }}>
      <Box sx={{ width: 280, borderRight: "1px solid", borderColor: "divider", pr: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button size="small" onClick={onImport}>Import</Button>
          {selected && <Button size="small" onClick={() => exportFor(selected)}>Export</Button>}
        </Stack>
        <Divider />
        <List dense>
          {profiles.map((p) => (
            <ListItemButton key={p.id} selected={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
              <ListItemText primary={p.name} secondary={p.description} />
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {selected ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => duplicate(selected.id)}>Duplicate</Button>
              <Button size="small" color="error" onClick={() => remove(selected.id)}>Delete</Button>
            </Stack>
            <ProfileEditor
              value={{
                name: selected.name,
                description: selected.description,
                config: selected.config,
                defaultCwd: selected.defaultCwd,
              }}
              onChange={onChangeEditor}
            />
          </Stack>
        ) : (
          <Typography color="text.secondary">Select a profile to edit, or Import one.</Typography>
        )}
      </Box>
    </Box>
  );
}

export default SettingsProfiles;
