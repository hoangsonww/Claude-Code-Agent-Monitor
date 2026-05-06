import { MenuItem, Stack, TextField } from "@mui/material";
import type { PermissionMode, ProfileConfig } from "../../../lib/profile-types";

const MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
];

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function PermissionsSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Permission mode"
        value={value.permissionMode || ""}
        onChange={(e) =>
          onChange({ permissionMode: (e.target.value || undefined) as PermissionMode | undefined })
        }
        fullWidth
        helperText="Default = acceptEdits if blank"
      >
        <MenuItem value="">(acceptEdits — default)</MenuItem>
        {MODES.map((m) => (
          <MenuItem key={m} value={m}>
            {m}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
