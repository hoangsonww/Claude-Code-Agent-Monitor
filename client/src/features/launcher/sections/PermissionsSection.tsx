import { MenuItem, Stack, TextField } from "@mui/material";
import type { PermissionMode, ProfileConfig } from "../../../lib/profile-types";

const MODES: { value: PermissionMode; label: string }[] = [
  { value: "default", label: "default" },
  { value: "acceptEdits", label: "acceptEdits" },
  { value: "plan", label: "plan" },
  { value: "auto", label: "auto" },
  { value: "dontAsk", label: "dontAsk" },
  { value: "bypassPermissions", label: "bypass (all checks off)" },
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
          <MenuItem key={m.value} value={m.value}>
            {m.label}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
