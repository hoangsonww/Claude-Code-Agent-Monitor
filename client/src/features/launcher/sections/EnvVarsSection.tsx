import { Autocomplete, Stack, TextField, Typography } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function EnvVarsSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">
        Env var NAMES only. Values resolve from{" "}
        <code>~/.claude/launcher/secrets.env</code> (preferred) or your shell env. Names without a
        resolvable value are silently dropped at spawn time.
      </Typography>
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={value.envVarNames || []}
        onChange={(_e, v) => onChange({ envVarNames: v.length ? (v as string[]) : undefined })}
        renderInput={(p) => (
          <TextField {...p} label="Env var names" placeholder="GITHUB_TOKEN" />
        )}
      />
    </Stack>
  );
}
