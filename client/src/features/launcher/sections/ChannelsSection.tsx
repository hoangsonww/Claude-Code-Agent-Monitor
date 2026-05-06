import { Autocomplete, Checkbox, FormControlLabel, Stack, TextField } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function ChannelsSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value.channels || []}
        onChange={(_e, v) => onChange({ channels: v.length ? (v as string[]) : undefined })}
        renderInput={(p) => (
          <TextField
            {...p}
            label="--channels"
            placeholder="plugin:my-notifier@my-marketplace"
          />
        )}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.excludeDynamicSystemPromptSections}
            onChange={(e) =>
              onChange({ excludeDynamicSystemPromptSections: e.target.checked || undefined })
            }
          />
        }
        label="--exclude-dynamic-system-prompt-sections"
      />
    </Stack>
  );
}
