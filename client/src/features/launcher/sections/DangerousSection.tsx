import { Autocomplete, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function DangerousSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" sx={{ color: "#ff8a8a" }}>
        These flags weaken safety boundaries. Only enable them when you understand the risk.
      </Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.bare}
            onChange={(e) => onChange({ bare: e.target.checked || undefined })}
          />
        }
        label="--bare (skip auto-discovery of hooks/skills/plugins/MCP/memory)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.dangerouslySkipPermissions}
            onChange={(e) =>
              onChange({ dangerouslySkipPermissions: e.target.checked || undefined })
            }
          />
        }
        label="--dangerously-skip-perms"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.allowDangerouslySkipPermissions}
            onChange={(e) =>
              onChange({ allowDangerouslySkipPermissions: e.target.checked || undefined })
            }
          />
        }
        label="--allow-dangerously-skip-perms"
      />
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value.dangerouslyLoadDevelopmentChannels || []}
        onChange={(_e, v) =>
          onChange({ dangerouslyLoadDevelopmentChannels: v.length ? (v as string[]) : undefined })
        }
        renderInput={(p) => (
          <TextField {...p} label="--dangerously-load-development-channels" />
        )}
      />
    </Stack>
  );
}
