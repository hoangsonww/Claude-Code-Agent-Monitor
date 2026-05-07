/**
 * @file ContextRingButton — composer toolbar control that visualizes the
 * current context-window usage and triggers `/compact` on click.
 *
 * Rendered next to the Attach / Photo buttons. The fill ratio comes from the
 * latest `result` agent_stream chunk (captured in ConversationView), or as a
 * fallback from the cost endpoint. Color buckets per
 * {@link colorBucketForRatio}.
 */
import { Box, IconButton, Tooltip, CircularProgress } from "@mui/material";
import {
  type ContextUsage,
  colorBucketForRatio,
  formatContextTooltip,
} from "../../lib/context-window";

interface Props {
  usage: ContextUsage | null;
  disabled?: boolean;
  /** Send `/compact` through the composer's existing send path. */
  onCompact: () => void;
}

const SIZE = 28;
const THICKNESS = 3;

const COLOR_BY_BUCKET: Record<"ok" | "warn" | "danger", string> = {
  ok: "#22c55e",   // emerald-500
  warn: "#f59e0b", // amber-500
  danger: "#ef4444", // red-500
};

export function ContextRingButton({ usage, disabled, onCompact }: Props) {
  const ratio =
    usage && usage.contextWindow > 0
      ? Math.max(0, Math.min(1, usage.usedTokens / usage.contextWindow))
      : 0;
  const bucket = colorBucketForRatio(ratio);
  const ringColor = COLOR_BY_BUCKET[bucket];
  const tooltipText = usage
    ? `${formatContextTooltip(usage)} — click to /compact`
    : "Context usage unknown — click to /compact";

  return (
    <Tooltip title={tooltipText} placement="top">
      {/* span wrapper keeps Tooltip working when the button is disabled */}
      <span>
        <IconButton
          size="small"
          aria-label="Context usage — compact"
          disabled={disabled}
          onClick={onCompact}
          sx={{ width: SIZE + 8, height: SIZE + 8 }}
        >
          <Box sx={{ position: "relative", width: SIZE, height: SIZE, display: "inline-flex" }}>
            {/* Track (full ring, dim) */}
            <CircularProgress
              variant="determinate"
              value={100}
              size={SIZE}
              thickness={THICKNESS}
              sx={{
                color: "action.disabledBackground",
                position: "absolute",
                left: 0,
                top: 0,
              }}
            />
            {/* Fill */}
            <CircularProgress
              variant="determinate"
              value={ratio * 100}
              size={SIZE}
              thickness={THICKNESS}
              sx={{
                color: ringColor,
                position: "absolute",
                left: 0,
                top: 0,
                "& .MuiCircularProgress-circle": { strokeLinecap: "round" },
              }}
            />
            {/* Center percent label */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 600,
                color: "text.secondary",
                lineHeight: 1,
              }}
            >
              {usage ? `${Math.round(ratio * 100)}%` : "—"}
            </Box>
          </Box>
        </IconButton>
      </span>
    </Tooltip>
  );
}
