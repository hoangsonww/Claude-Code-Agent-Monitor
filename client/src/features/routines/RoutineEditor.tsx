/**
 * @file RoutineEditor — modal used by both "New routine" and "Edit routine".
 * Holds the editable subset of a routine in local state and posts a fresh
 * RoutineCreateInput up via onSubmit. The parent owns the open/close cycle
 * and the actual API call.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ShieldCheck } from "lucide-react";
import type {
  Routine,
  RoutineCreateInput,
  RoutineSchedule,
} from "../../lib/routine-types";
import type { PermissionMode } from "../../lib/profile-types";
import { ScheduleFields } from "./ScheduleFields";
import { useCwds } from "../../hooks/useCwds";
import { MODEL_OPTIONS, DEFAULT_MODEL_ID } from "../composer/ModelPickerPopover";

const PERMISSION_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
];

const PERMISSION_LABELS: Record<PermissionMode, string> = {
  default: "Default",
  acceptEdits: "Auto-accept edits",
  plan: "Plan mode",
  auto: "Auto",
  dontAsk: "Don't ask",
  bypassPermissions: "Bypass permissions",
};

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Routine;
  onSubmit: (input: RoutineCreateInput) => Promise<void>;
}

interface Draft {
  name: string;
  description: string;
  instructions: string;
  cwd: string;
  worktree: boolean;
  permissionMode: PermissionMode;
  model: string;
  schedule: RoutineSchedule;
}

function emptyDraft(): Draft {
  return {
    name: "",
    description: "",
    instructions: "",
    cwd: "",
    worktree: false,
    permissionMode: "default",
    model: DEFAULT_MODEL_ID,
    schedule: { type: "daily", hour: 9, minute: 0 },
  };
}

function fromRoutine(r: Routine): Draft {
  return {
    name: r.name,
    description: r.description,
    instructions: r.instructions,
    cwd: r.cwd,
    worktree: r.worktree,
    permissionMode: r.permissionMode,
    model: r.model || DEFAULT_MODEL_ID,
    schedule: r.schedule,
  };
}

export function RoutineEditor({ open, onClose, initial, onSubmit }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { cwds } = useCwds();

  // Reset the draft each time the modal opens, with the initial values when
  // editing an existing routine.
  useEffect(() => {
    if (!open) return;
    setDraft(initial ? fromRoutine(initial) : emptyDraft());
    setError(null);
  }, [open, initial]);

  const canSubmit = useMemo(() => {
    return (
      !!draft.name.trim() &&
      !!draft.description.trim() &&
      !!draft.instructions.trim() &&
      !!draft.cwd.trim() &&
      !submitting
    );
  }, [draft, submitting]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: draft.name.trim(),
        description: draft.description.trim(),
        instructions: draft.instructions,
        cwd: draft.cwd,
        worktree: draft.worktree,
        permissionMode: draft.permissionMode,
        model: draft.model || null,
        schedule: draft.schedule,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{initial ? "Edit routine" : "New local routine"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert
            icon={<ShieldCheck size={18} />}
            severity="info"
            variant="outlined"
            sx={{ alignItems: "center" }}
          >
            Local routines only run while your computer is awake.
          </Alert>

          <TextField
            label="Name"
            placeholder="daily-code-review"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 80, "aria-label": "Name" } }}
            fullWidth
            required
          />
          <TextField
            label="Description"
            placeholder="Review yesterday's commits and flag anything concerning"
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 280, "aria-label": "Description" } }}
            fullWidth
            required
          />
          <TextField
            label="Instructions"
            value={draft.instructions}
            onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
            slotProps={{ htmlInput: { maxLength: 8000, "aria-label": "Instructions" } }}
            multiline
            minRows={5}
            fullWidth
            required
          />

          <Box
            sx={{
              display: "flex",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
              borderTop: 1,
              borderColor: "divider",
              pt: 2,
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Ask permissions
              </Typography>
              <Select
                size="small"
                value={draft.permissionMode}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, permissionMode: e.target.value as PermissionMode }))
                }
                aria-label="permission mode"
              >
                {PERMISSION_MODES.map((m) => (
                  <MenuItem key={m} value={m}>
                    {PERMISSION_LABELS[m]}
                  </MenuItem>
                ))}
              </Select>
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Model
              </Typography>
              <Select
                size="small"
                value={draft.model}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value as string }))}
                aria-label="model"
                sx={{ minWidth: 180 }}
              >
                {MODEL_OPTIONS.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </Stack>

            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary">
                Folder
              </Typography>
              <Select
                size="small"
                value={draft.cwd}
                onChange={(e) => setDraft((d) => ({ ...d, cwd: e.target.value as string }))}
                displayEmpty
                aria-label="folder"
              >
                <MenuItem value="" disabled>
                  Select folder
                </MenuItem>
                {cwds.map((c) => (
                  <MenuItem key={c.path} value={c.path}>
                    {c.path}
                  </MenuItem>
                ))}
              </Select>
            </Stack>

            <FormControlLabel
              control={
                <Checkbox
                  checked={draft.worktree}
                  onChange={(_, v) => setDraft((d) => ({ ...d, worktree: v }))}
                  slotProps={{ input: { "aria-label": "worktree" } }}
                />
              }
              label="Worktree"
            />
          </Box>

          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Schedule
            </Typography>
            <ScheduleFields
              value={draft.schedule}
              onChange={(schedule) => setDraft((d) => ({ ...d, schedule }))}
            />
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!canSubmit}>
          {initial ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RoutineEditor;
