import { Autocomplete, Stack, TextField } from "@mui/material";
import type { ProfileConfig, SettingSource } from "../../../lib/profile-types";

const SOURCES: SettingSource[] = ["user", "project", "local"];

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function SettingsSourcesSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField
        label="--settings (path or JSON string)"
        value={value.settings || ""}
        onChange={(e) => onChange({ settings: e.target.value || undefined })}
        fullWidth
      />
      <Autocomplete
        multiple
        options={SOURCES}
        value={value.settingSources || []}
        onChange={(_e, v) => onChange({ settingSources: v.length ? (v as SettingSource[]) : undefined })}
        renderInput={(p) => <TextField {...p} label="--setting-sources" />}
      />
    </Stack>
  );
}
