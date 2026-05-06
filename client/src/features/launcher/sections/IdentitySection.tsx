import { Stack, TextField } from "@mui/material";
import type { ProfileEditorValue } from "../ProfileEditor";

interface Props {
  value: ProfileEditorValue;
  onChange: (patch: Partial<ProfileEditorValue>) => void;
}

export function IdentitySection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Name"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        fullWidth
        required
      />
      <TextField
        label="Description"
        value={value.description || ""}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
        fullWidth
      />
    </Stack>
  );
}
