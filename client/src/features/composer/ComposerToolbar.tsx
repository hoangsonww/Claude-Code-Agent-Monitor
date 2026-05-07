import { Stack } from "@mui/material";
import { ModelPicker } from "./ModelPicker";
import { ModePicker } from "./ModePicker";
import { ProfilePicker } from "./ProfilePicker";
import { UploadButtons } from "./UploadButtons";
import { ContextRingButton } from "./ContextRingButton";
import type { PermissionMode } from "../../lib/profile-types";
import type { ContextUsage } from "../../lib/context-window";

interface Props {
  model: string | null;
  onModelChange: (v: string | null) => void;
  mode: PermissionMode | null;
  onModeChange: (v: PermissionMode | null) => void;
  profileId: string | null;
  onProfileIdChange: (v: string | null) => void;
  onAddFile: (f: File) => void;
  busy: boolean;
  /** Latest context-window usage snapshot (null hides the ring). */
  contextUsage?: ContextUsage | null;
  /** Triggers `/compact` via the composer's existing send path. */
  onCompact?: () => void;
}

export function ComposerToolbar(p: Props) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", flexWrap: "wrap", p: 1, borderTop: "1px solid", borderColor: "divider" }}
    >
      <ModelPicker value={p.model} onChange={p.onModelChange} disabled={p.busy} />
      <ModePicker value={p.mode} onChange={p.onModeChange} disabled={p.busy} />
      <ProfilePicker value={p.profileId} onChange={p.onProfileIdChange} disabled={p.busy} />
      <Stack direction="row" sx={{ ml: "auto", alignItems: "center" }}>
        <UploadButtons onAdd={p.onAddFile} disabled={p.busy} />
        {p.onCompact && (
          <ContextRingButton
            usage={p.contextUsage ?? null}
            disabled={p.busy}
            onCompact={p.onCompact}
          />
        )}
      </Stack>
    </Stack>
  );
}
