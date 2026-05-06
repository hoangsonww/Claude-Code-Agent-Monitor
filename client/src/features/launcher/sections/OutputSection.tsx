import { Checkbox, FormControlLabel, Stack, TextField } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function OutputSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField
        label="--output-format"
        value="stream-json (locked)"
        disabled
        fullWidth
        helperText="The launcher pipes child output as stream-json to drive the conversation panel."
      />
      <TextField
        label="--input-format"
        value="stream-json (locked)"
        disabled
        fullWidth
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.includeHookEvents}
            onChange={(e) => onChange({ includeHookEvents: e.target.checked || undefined })}
          />
        }
        label="--include-hook-events"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.includePartialMessages}
            onChange={(e) => onChange({ includePartialMessages: e.target.checked || undefined })}
          />
        }
        label="--include-partial-messages"
      />
      <TextField
        label="--json-schema (JSON string)"
        value={value.jsonSchema || ""}
        onChange={(e) => onChange({ jsonSchema: e.target.value || undefined })}
        multiline
        minRows={2}
        fullWidth
      />
    </Stack>
  );
}
