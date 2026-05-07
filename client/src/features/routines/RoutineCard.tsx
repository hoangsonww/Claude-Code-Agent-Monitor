/**
 * @file Single routine row on the list page. Renders the name on top, the
 * schedule summary + next-run hint on the bottom. Click anywhere on the card
 * navigates to the detail view.
 */
import { Box, Card, CardActionArea, CardContent, Chip, Typography } from "@mui/material";
import type { Routine } from "../../lib/routine-types";
import { formatNextRun, summarizeSchedule } from "../../lib/routine-format";

interface Props {
  routine: Routine;
  onClick: () => void;
}

export function RoutineCard({ routine, onClick }: Props) {
  const summary = summarizeSchedule(routine.schedule);
  const next = formatNextRun(routine.nextRunAt);
  const showNext = routine.status === "active" && routine.nextRunAt != null;
  return (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
              {routine.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {summary}
              {showNext ? ` · Next run ${next}` : ""}
            </Typography>
          </Box>
          {routine.status === "disabled" && (
            <Chip label="Disabled" size="small" color="default" />
          )}
          {routine.status === "active" && (
            <Chip label="Active" size="small" color="success" variant="outlined" />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default RoutineCard;
