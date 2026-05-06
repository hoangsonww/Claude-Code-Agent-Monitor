import { TextField, MenuItem } from "@mui/material";

const PRESETS = [
  "(default)",
  "sonnet",
  "opus",
  "haiku",
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "claude-haiku-4-5",
];

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}

export function ModelPicker({ value, onChange, disabled }: Props) {
  return (
    <TextField
      select
      size="small"
      label="Model"
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      sx={{ minWidth: 140 }}
    >
      {PRESETS.map((m) => (
        <MenuItem key={m} value={m === "(default)" ? "" : m}>
          {m}
        </MenuItem>
      ))}
    </TextField>
  );
}
