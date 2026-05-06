import { MenuItem, Stack, TextField } from "@mui/material";
import type { Effort, ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: Pick<ProfileConfig, "model" | "fallbackModel" | "effort" | "betas">;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function ModelRuntimeSection({ value, onChange }: Props) {
  return (
    <Stack spacing={2}>
      <TextField
        label="Model"
        value={value.model || ""}
        onChange={(e) => onChange({ model: e.target.value || undefined })}
        fullWidth
      />
      <TextField
        label="Fallback model"
        value={value.fallbackModel || ""}
        onChange={(e) => onChange({ fallbackModel: e.target.value || undefined })}
        fullWidth
      />
      <TextField
        select
        label="Effort"
        value={value.effort || ""}
        onChange={(e) => onChange({ effort: (e.target.value || undefined) as Effort | undefined })}
        fullWidth
      >
        <MenuItem value="">(default)</MenuItem>
        {EFFORTS.map((e) => (
          <MenuItem key={e} value={e}>
            {e}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Betas (comma-separated)"
        value={(value.betas || []).join(",")}
        onChange={(e) =>
          onChange({
            betas: e.target.value
              ? e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : undefined,
          })
        }
        fullWidth
        helperText="API beta headers — leave blank if unsure"
      />
    </Stack>
  );
}
