/**
 * @file TranscriptViewMenu.tsx
 * @description Header-row affordance on the Conversation tab. Opens a
 * popover with a four-option transcript-view picker (Normal / Thinking /
 * Verbose / Summary) plus three font-size controls. Both selections are
 * persisted to localStorage by the parent component.
 */
import { useRef, useState } from "react";
import { Box, Divider, MenuItem, Popover, Tooltip, Typography } from "@mui/material";
import { Layout } from "lucide-react";
import {
  TRANSCRIPT_FONT_SIZES,
  TRANSCRIPT_VIEW_MODES,
  type TranscriptFontSize,
  type TranscriptViewMode,
} from "../../lib/transcriptViewMode";

interface Props {
  viewMode: TranscriptViewMode;
  onViewModeChange: (mode: TranscriptViewMode) => void;
  fontSize: TranscriptFontSize;
  onFontSizeChange: (size: TranscriptFontSize) => void;
}

export function TranscriptViewMenu({
  viewMode,
  onViewModeChange,
  fontSize,
  onFontSizeChange,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <Tooltip title="Transcript view">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setAnchorEl(buttonRef.current)}
          aria-label="Transcript view"
          className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-200 bg-surface-2 border border-surface-3 hover:border-violet-500/30 rounded-md px-2 py-1 transition-colors"
        >
          <Layout className="w-3 h-3" />
          View
        </button>
      </Tooltip>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        <Box sx={{ py: 1 }}>
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
              Transcript view
            </Typography>
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
              ⇧⌃O
            </Box>
          </Box>
          {TRANSCRIPT_VIEW_MODES.map((m) => (
            <MenuItem
              key={m.value}
              selected={m.value === viewMode}
              onClick={() => {
                onViewModeChange(m.value);
                setAnchorEl(null);
              }}
              sx={{ fontSize: 13, alignItems: "flex-start", py: 0.75 }}
            >
              <Box>
                <Typography variant="body2" component="span">
                  {m.label}
                </Typography>
                <Typography
                  variant="caption"
                  component="div"
                  sx={{ color: "text.secondary", fontSize: 11 }}
                >
                  {m.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
          <Divider sx={{ my: 0.5 }} />
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontSize: 10,
              px: 2,
              py: 0.5,
            }}
          >
            Font size
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-around", px: 1, pb: 1 }}>
            {TRANSCRIPT_FONT_SIZES.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-label={`Font size ${f.value}`}
                aria-pressed={f.value === fontSize}
                onClick={() => onFontSizeChange(f.value)}
                className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                  f.value === fontSize
                    ? "border-violet-500/50 bg-violet-500/10 text-gray-100"
                    : "border-surface-3 text-gray-400 hover:border-violet-500/30 hover:text-gray-200"
                }`}
                style={{ fontSize: f.cssSize }}
              >
                {f.label}
              </button>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
