import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function SystemPromptSection({ value, onChange }: Props) {
  const replaceMode = value.systemPromptFile ? "file" : "text";
  return (
    <Stack spacing={2}>
      <FormControl>
        <FormLabel>Replace prompt with</FormLabel>
        <RadioGroup
          row
          value={replaceMode}
          onChange={(e) => {
            if (e.target.value === "file") onChange({ systemPrompt: undefined });
            else onChange({ systemPromptFile: undefined });
          }}
        >
          <FormControlLabel value="text" control={<Radio />} label="Text" />
          <FormControlLabel value="file" control={<Radio />} label="File path" />
        </RadioGroup>
      </FormControl>
      {replaceMode === "text" ? (
        <TextField
          label="--system-prompt (text)"
          value={value.systemPrompt || ""}
          onChange={(e) => onChange({ systemPrompt: e.target.value || undefined })}
          multiline
          minRows={2}
          fullWidth
          helperText="Replaces the default prompt entirely. Leave blank to keep default."
        />
      ) : (
        <TextField
          label="--system-prompt-file (path)"
          value={value.systemPromptFile || ""}
          onChange={(e) => onChange({ systemPromptFile: e.target.value || undefined })}
          fullWidth
        />
      )}
      <TextField
        label="--append-system-prompt (text)"
        value={value.appendSystemPrompt || ""}
        onChange={(e) => onChange({ appendSystemPrompt: e.target.value || undefined })}
        multiline
        minRows={2}
        fullWidth
        helperText="Appended to the default. Combinable with replace flags."
      />
      <TextField
        label="--append-system-prompt-file (path)"
        value={value.appendSystemPromptFile || ""}
        onChange={(e) => onChange({ appendSystemPromptFile: e.target.value || undefined })}
        fullWidth
      />
    </Stack>
  );
}
