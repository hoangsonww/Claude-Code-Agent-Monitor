import { Stack } from "@mui/material";
import { ModelPicker } from "./ModelPicker";
import { ModePicker } from "./ModePicker";
import { ProfilePicker } from "./ProfilePicker";
import { UploadButtons } from "./UploadButtons";
import type { PermissionMode } from "../../lib/profile-types";

interface Props {
  model: string | null;
  onModelChange: (v: string | null) => void;
  mode: PermissionMode | null;
  onModeChange: (v: PermissionMode | null) => void;
  profileId: string | null;
  onProfileIdChange: (v: string | null) => void;
  onAddFile: (f: File) => void;
  busy: boolean;
}

export function ComposerToolbar(p: Props) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", flexWrap: "wrap", p: 1, borderTop: "1px solid", borderColor: "divider" }}
    >
      <ModelPicker value={p.model} onChange={p.onModelChange} disabled={p.busy} />
      <ModePicker value={p.mode} onChange={p.onModeChange} disabled={p.busy} />
      <ProfilePicker value={p.profileId} onChange={p.onProfileIdChange} disabled={p.busy} />
      <Stack direction="row" sx={{ ml: "auto" }}>
        <UploadButtons onAdd={p.onAddFile} disabled={p.busy} />
      </Stack>
    </Stack>
  );
}
