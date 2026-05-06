import { Autocomplete, Checkbox, FormControlLabel, Stack, TextField } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function McpPluginsSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value.mcpConfig || []}
        onChange={(_e, v) => onChange({ mcpConfig: v.length ? (v as string[]) : undefined })}
        renderInput={(p) => (
          <TextField
            {...p}
            label="--mcp-config (paths)"
            helperText="JSON files / strings (space-separated on CLI; one per chip here)"
          />
        )}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.strictMcpConfig}
            onChange={(e) => onChange({ strictMcpConfig: e.target.checked || undefined })}
          />
        }
        label="--strict-mcp-config"
      />
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value.pluginDir || []}
        onChange={(_e, v) => onChange({ pluginDir: v.length ? (v as string[]) : undefined })}
        renderInput={(p) => <TextField {...p} label="--plugin-dir (paths or .zip)" />}
      />
    </Stack>
  );
}
