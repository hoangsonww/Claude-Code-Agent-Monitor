import { Autocomplete, Stack, TextField } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

function ChipField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string[] | undefined;
  onChange: (v: string[] | undefined) => void;
  helper?: string;
}) {
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value || []}
      onChange={(_e, v) => onChange(v.length ? (v as string[]) : undefined)}
      renderInput={(params) => <TextField {...params} label={label} helperText={helper} />}
    />
  );
}

export function ToolsSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <ChipField
        label="tools (allowlist)"
        value={value.tools}
        onChange={(v) => onChange({ tools: v })}
        helper="Restrict which built-in capabilities Claude can use"
      />
      <ChipField
        label="allowedTools (no-prompt)"
        value={value.allowedTools}
        onChange={(v) => onChange({ allowedTools: v })}
        helper='Auto-approve specific calls, e.g. "Bash(git log *)", "Read"'
      />
      <ChipField
        label="disallowedTools"
        value={value.disallowedTools}
        onChange={(v) => onChange({ disallowedTools: v })}
        helper="Prevent specific capabilities from being used"
      />
    </Stack>
  );
}
