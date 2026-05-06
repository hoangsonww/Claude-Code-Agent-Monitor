import { TextField, MenuItem } from "@mui/material";
import { useProfiles } from "../../hooks/useProfiles";

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}

export function ProfilePicker({ value, onChange, disabled }: Props) {
  const { profiles } = useProfiles();
  return (
    <TextField
      select
      size="small"
      label="Profile"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      sx={{ minWidth: 160 }}
    >
      <MenuItem value="">(none)</MenuItem>
      {profiles.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
    </TextField>
  );
}
