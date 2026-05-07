/**
 * @file ComposerToolbar.tsx
 * @description Bottom-of-composer status bar that mirrors Claude Desktop's
 * affordances: a permission-mode chip on the far left, a plus menu (uploads
 * + slash commands), the context-usage ring, the voice-input button, and on
 * the far right the model/effort chip. The model and mode pickers that used
 * to live in this toolbar as full TextFields have moved into the chips +
 * popovers.
 */
import { Stack } from "@mui/material";
import { ContextRingButton } from "./ContextRingButton";
import { PermissionModeChip } from "./PermissionModeChip";
import { PlusMenu } from "./PlusMenu";
import { MicButton } from "./MicButton";
import { ModelChip } from "./ModelChip";
import type { Effort, PermissionMode } from "../../lib/profile-types";
import type { ContextUsage } from "../../lib/context-window";

interface Props {
  model: string | null;
  onModelChange: (v: string | null) => void;
  mode: PermissionMode | null;
  onModeChange: (v: PermissionMode | null) => void;
  effort: Effort | null;
  onEffortChange: (e: Effort) => void;
  fastMode: boolean;
  onFastModeChange: (v: boolean) => void;
  onAddFile: (f: File) => void;
  onOpenSlashCommands: () => void;
  onMicTranscript: (text: string) => void;
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
      spacing={0.5}
      sx={{
        alignItems: "center",
        flexWrap: "wrap",
        px: 1,
        py: 0.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <PermissionModeChip
        value={p.mode}
        onChange={p.onModeChange}
        disabled={p.busy}
      />
      <PlusMenu
        onAddFile={p.onAddFile}
        onOpenSlashCommands={p.onOpenSlashCommands}
        disabled={p.busy}
      />
      {p.onCompact && (
        <ContextRingButton
          usage={p.contextUsage ?? null}
          disabled={p.busy}
          onCompact={p.onCompact}
        />
      )}
      <MicButton onTranscript={p.onMicTranscript} disabled={p.busy} />
      <Stack direction="row" sx={{ ml: "auto", alignItems: "center" }}>
        <ModelChip
          model={p.model}
          onModelChange={(id) => p.onModelChange(id)}
          effort={p.effort}
          onEffortChange={p.onEffortChange}
          fastMode={p.fastMode}
          onFastModeChange={p.onFastModeChange}
          disabled={p.busy}
        />
      </Stack>
    </Stack>
  );
}
