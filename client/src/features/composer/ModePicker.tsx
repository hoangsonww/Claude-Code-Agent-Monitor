import { TextField, MenuItem } from "@mui/material";
import type { PermissionMode } from "../../lib/profile-types";

const MODES: PermissionMode[] = ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"];

interface Props {
  value: PermissionMode | null;
  onChange: (v: PermissionMode | null) => void;
  disabled?: boolean;
}

export function ModePicker({ value, onChange, disabled }: Props) {
  return (
    <TextField
      select
      size="small"
      label="Mode"
      value={value || ""}
      onChange={(e) => onChange((e.target.value || null) as PermissionMode | null)}
      disabled={disabled}
      sx={{ minWidth: 140 }}
    >
      <MenuItem value="">(profile default)</MenuItem>
      {MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
    </TextField>
  );
}
