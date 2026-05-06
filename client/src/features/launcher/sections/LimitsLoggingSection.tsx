import { Checkbox, FormControlLabel, Stack, TextField } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function LimitsLoggingSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField
        label="--max-turns"
        type="number"
        value={value.maxTurns ?? ""}
        onChange={(e) =>
          onChange({ maxTurns: e.target.value === "" ? undefined : Number(e.target.value) })
        }
        fullWidth
      />
      <TextField
        label="--max-budget-usd"
        type="number"
        slotProps={{ htmlInput: { step: "0.01" } }}
        value={value.maxBudgetUsd ?? ""}
        onChange={(e) =>
          onChange({ maxBudgetUsd: e.target.value === "" ? undefined : Number(e.target.value) })
        }
        fullWidth
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value.verbose}
            onChange={(e) => onChange({ verbose: e.target.checked || undefined })}
          />
        }
        label="--verbose (forced on by launcher)"
      />
      <TextField
        label="--debug (categories, e.g., api,hooks)"
        value={value.debug || ""}
        onChange={(e) => onChange({ debug: e.target.value || undefined })}
        fullWidth
      />
    </Stack>
  );
}
