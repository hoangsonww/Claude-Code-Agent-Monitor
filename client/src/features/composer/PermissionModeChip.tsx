/**
 * @file PermissionModeChip.tsx
 * @description Far-left affordance in the composer status bar. Renders the
 * current permission mode in inline yellow text (matching Claude Desktop's
 * "Bypass permissions" chip) and opens a popover with the full mode set on
 * click. The yellow accent is reserved for `bypassPermissions` and `dontAsk`
 * (the riskier modes); other modes use the default text color.
 */
import { useRef, useState } from "react";
import { Button, Menu, MenuItem, Tooltip, Typography } from "@mui/material";
import { Sparkles } from "lucide-react";
import type { PermissionMode } from "../../lib/profile-types";

const MODE_LABELS: Record<PermissionMode, string> = {
  default: "Default permissions",
  acceptEdits: "Auto-accept edits",
  plan: "Plan mode",
  auto: "Auto",
  dontAsk: "Don't ask",
  bypassPermissions: "Bypass permissions",
};

const MODE_ORDER: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
];

const RISKY_MODES = new Set<PermissionMode>(["bypassPermissions", "dontAsk"]);

interface Props {
  value: PermissionMode | null;
  onChange: (mode: PermissionMode | null) => void;
  disabled?: boolean;
}

export function PermissionModeChip({ value, onChange, disabled }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLButtonElement | null>(null);
  const effective = value ?? "default";
  const label = MODE_LABELS[effective];
  const risky = RISKY_MODES.has(effective);

  return (
    <>
      <Tooltip title="Permission mode" placement="top">
        <span>
          <Button
            ref={ref}
            size="small"
            variant="text"
            disabled={disabled}
            onClick={() => setAnchorEl(ref.current)}
            aria-label={`Permission mode: ${label}`}
            startIcon={
              <Sparkles
                size={14}
                color={risky ? "#f59e0b" : undefined}
                aria-hidden
              />
            }
            sx={{
              textTransform: "none",
              fontSize: 12,
              minWidth: 0,
              px: 1,
              py: 0.25,
              color: risky ? "#fbbf24" /* yellow-400 */ : "text.secondary",
              "&:hover": { background: "action.hover" },
            }}
          >
            <Typography
              component="span"
              sx={{
                fontSize: 12,
                fontWeight: risky ? 600 : 500,
                color: "inherit",
              }}
            >
              {label}
            </Typography>
          </Button>
        </span>
      </Tooltip>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {MODE_ORDER.map((m) => (
          <MenuItem
            key={m}
            selected={m === effective}
            onClick={() => {
              // Map "default" back to null so we don't write a redundant
              // override on top of the profile's own default.
              onChange(m === "default" ? null : m);
              setAnchorEl(null);
            }}
            sx={{
              fontSize: 13,
              color: RISKY_MODES.has(m) ? "#fbbf24" : "text.primary",
            }}
          >
            {MODE_LABELS[m]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
