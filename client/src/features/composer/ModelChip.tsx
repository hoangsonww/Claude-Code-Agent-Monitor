/**
 * @file ModelChip.tsx
 * @description Compact, clickable chip in the composer status bar that
 * displays the active model + effort and opens the {@link ModelPickerPopover}
 * on click. Mirrors the Claude Desktop bottom-right "Opus 4.7 1M · Extra
 * high" affordance.
 */
import { useState, useRef } from "react";
import { Box, Button, Tooltip } from "@mui/material";
import type { Effort } from "../../lib/profile-types";
import {
  ModelPickerPopover,
  modelChipLabel,
} from "./ModelPickerPopover";

interface Props {
  model: string | null;
  onModelChange: (id: string) => void;
  effort: Effort | null;
  onEffortChange: (effort: Effort) => void;
  fastMode: boolean;
  onFastModeChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ModelChip({
  model,
  onModelChange,
  effort,
  onEffortChange,
  fastMode,
  onFastModeChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const label = modelChipLabel(model, effort);

  return (
    <>
      <Tooltip title="Choose model and effort" placement="top">
        <span>
          <Button
            ref={anchorRef}
            size="small"
            variant="text"
            disabled={disabled}
            onClick={() => setOpen(true)}
            aria-label="Model and effort"
            sx={{
              textTransform: "none",
              fontSize: 12,
              color: "text.primary",
              minWidth: 0,
              px: 1,
              py: 0.25,
              "&:hover": { background: "action.hover" },
            }}
          >
            <Box
              component="span"
              sx={{
                fontFamily: "inherit",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 220,
              }}
            >
              {label}
            </Box>
          </Button>
        </span>
      </Tooltip>
      <ModelPickerPopover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => setOpen(false)}
        selectedModel={model}
        onModelChange={onModelChange}
        selectedEffort={effort}
        onEffortChange={onEffortChange}
        fastMode={fastMode}
        onFastModeChange={onFastModeChange}
        disabled={disabled}
      />
    </>
  );
}
