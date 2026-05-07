/**
 * @file ModelPickerPopover.tsx
 * @description The Claude Desktop-style model picker. Click the ModelChip in
 * the composer status bar to open this popover, which offers three sections:
 * Models (the selectable model id), Effort (low/medium/high/xhigh/max), and
 * Fast mode (UI-only stub for v1 — see TODO).
 */
import { Box, Divider, MenuItem, Popover, Switch, Typography } from "@mui/material";
import type { Effort } from "../../lib/profile-types";

export interface ModelOption {
  /** Internal id passed to the orchestrator (e.g. "claude-opus-4-7[1m]"). */
  id: string;
  /** Friendly label shown in the popover and chip ("Opus 4.7 1M"). */
  label: string;
  /** Optional secondary line shown in muted text. */
  hint?: string;
  /** Render with reduced emphasis (e.g. legacy/older). */
  legacy?: boolean;
}

export const MODEL_OPTIONS: ReadonlyArray<ModelOption> = [
  { id: "claude-opus-4-7", label: "Opus 4.7" },
  { id: "claude-opus-4-7[1m]", label: "Opus 4.7 1M", hint: "1M context" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5" },
  { id: "claude-opus-4-6", label: "Opus 4.6", hint: "Legacy", legacy: true },
];

export const EFFORT_OPTIONS: ReadonlyArray<{ value: Effort; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
];

export const DEFAULT_MODEL_ID = "claude-opus-4-7[1m]";
export const DEFAULT_EFFORT: Effort = "high";

/** Look up the friendly label for a model id, falling back to the id itself. */
export function modelChipLabel(modelId: string | null, effort: Effort | null): string {
  const model = MODEL_OPTIONS.find((m) => m.id === modelId);
  const modelPart = model ? model.label : modelId || "Default model";
  if (!effort) return modelPart;
  const eff = EFFORT_OPTIONS.find((e) => e.value === effort);
  if (!eff) return modelPart;
  return `${modelPart} · ${eff.label}`;
}

interface Props {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  selectedModel: string | null;
  onModelChange: (id: string) => void;
  selectedEffort: Effort | null;
  onEffortChange: (effort: Effort) => void;
  fastMode: boolean;
  onFastModeChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function ModelPickerPopover({
  open,
  anchorEl,
  onClose,
  selectedModel,
  onModelChange,
  selectedEffort,
  onEffortChange,
  fastMode,
  onFastModeChange,
  disabled,
}: Props) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "bottom", horizontal: "right" }}
      slotProps={{ paper: { sx: { minWidth: 260 } } }}
    >
      <Box sx={{ py: 1 }}>
        <SectionHeader label="Models" kbd="⇧⌘I" />
        {MODEL_OPTIONS.map((m) => (
          <MenuItem
            key={m.id}
            selected={m.id === selectedModel}
            disabled={disabled}
            onClick={() => {
              onModelChange(m.id);
              onClose();
            }}
            sx={{
              opacity: m.legacy ? 0.65 : 1,
              fontSize: 13,
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <Typography variant="body2" component="span">
                {m.label}
              </Typography>
              {m.hint && (
                <Typography
                  variant="caption"
                  component="span"
                  sx={{ color: "text.secondary", fontSize: 11 }}
                >
                  {m.hint}
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />
        <SectionHeader label="Effort" kbd="⇧⌘E" />
        {EFFORT_OPTIONS.map((e) => (
          <MenuItem
            key={e.value}
            selected={e.value === selectedEffort}
            disabled={disabled}
            onClick={() => {
              onEffortChange(e.value);
              onClose();
            }}
            sx={{ fontSize: 13 }}
          >
            {e.label}
          </MenuItem>
        ))}

        <Divider sx={{ my: 0.5 }} />
        <SectionHeader label="Fast mode" />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
          }}
        >
          <Typography variant="body2">Enable fast mode</Typography>
          {/* TODO: wire fast mode to a real backend flag once the SDK exposes
              one. v1 is UI-only state held in the composer. */}
          <Switch
            size="small"
            checked={fastMode}
            onChange={(_e, v) => onFastModeChange(v)}
            disabled={disabled}
            slotProps={{ input: { "aria-label": "Enable fast mode" } }}
          />
        </Box>
      </Box>
    </Popover>
  );
}

function SectionHeader({ label, kbd }: { label: string; kbd?: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 2,
        py: 0.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontSize: 10,
        }}
      >
        {label}
      </Typography>
      {kbd && (
        <Box
          component="kbd"
          sx={{
            fontFamily: "ui-monospace, monospace",
            fontSize: 10,
            color: "text.disabled",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0.5,
            px: 0.5,
            py: 0.1,
          }}
        >
          {kbd}
        </Box>
      )}
    </Box>
  );
}
