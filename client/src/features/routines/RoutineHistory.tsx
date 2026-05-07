/**
 * @file Run history list for a single routine. Shows up to 25 most-recent
 * runs with timestamp, status chip, trigger, and a link to the spawned
 * session/agent (when available).
 */
import { Box, Chip, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { RoutineRun, RoutineRunStatus } from "../../lib/routine-types";

const STATUS_COLOR: Record<RoutineRunStatus, "default" | "info" | "success" | "error" | "warning"> = {
  spawning: "info",
  running: "info",
  completed: "success",
  error: "error",
  killed: "warning",
};

interface Props {
  runs: RoutineRun[];
}

export function RoutineHistory({ runs }: Props) {
  if (runs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No runs yet.
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {runs.map((r) => (
        <Box
          key={r.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderBottom: 1,
            borderColor: "divider",
            py: 1,
          }}
        >
          <Chip
            label={r.status}
            size="small"
            color={STATUS_COLOR[r.status] || "default"}
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 160 }}>
            {new Date(r.started_at).toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            via {r.trigger}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {r.agent_handle_id && (
            <MuiLink
              component={RouterLink}
              to={`/sessions?agent=${encodeURIComponent(r.agent_handle_id)}`}
              underline="hover"
              variant="caption"
            >
              View agent
            </MuiLink>
          )}
        </Box>
      ))}
    </Stack>
  );
}

export default RoutineHistory;
