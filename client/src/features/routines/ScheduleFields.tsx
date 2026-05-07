/**
 * @file ScheduleFields renders the Manual / Hourly / Daily / Weekdays / Weekly
 * tab strip plus the conditional time/day inputs. The selected schedule is
 * a discriminated union — switching tabs yields a fresh shape with sensible
 * defaults so the parent doesn't have to babysit lingering optional fields.
 */
import { Box, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import type { RoutineSchedule, RoutineScheduleType } from "../../lib/routine-types";

const TABS: { value: RoutineScheduleType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
];

const DOW: { value: number; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

interface Props {
  value: RoutineSchedule;
  onChange: (next: RoutineSchedule) => void;
}

export function ScheduleFields({ value, onChange }: Props) {
  const handleTab = (_: unknown, type: RoutineScheduleType) => {
    onChange(defaultForType(type));
  };

  return (
    <Stack spacing={2}>
      <Tabs
        value={value.type}
        onChange={handleTab}
        variant="scrollable"
        scrollButtons={false}
        sx={{ minHeight: 36 }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            sx={{ minHeight: 36, textTransform: "none", fontSize: 13 }}
          />
        ))}
      </Tabs>

      {value.type === "manual" && (
        <Typography variant="body2" color="text.secondary">
          This routine only runs when triggered manually, by API, or webhook.
        </Typography>
      )}

      {value.type === "hourly" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2">At minute</Typography>
          <TextField
            type="number"
            value={value.minute}
            onChange={(e) =>
              onChange({ type: "hourly", minute: clamp(parseInt(e.target.value || "0", 10), 0, 59) })
            }
            slotProps={{ htmlInput: { min: 0, max: 59, "aria-label": "minute" } }}
            size="small"
            sx={{ width: 90 }}
          />
        </Box>
      )}

      {value.type === "daily" && (
        <TimeRow
          hour={value.hour}
          minute={value.minute}
          onChange={(hour, minute) => onChange({ type: "daily", hour, minute })}
        />
      )}

      {value.type === "weekdays" && (
        <TimeRow
          hour={value.hour}
          minute={value.minute}
          onChange={(hour, minute) => onChange({ type: "weekdays", hour, minute })}
        />
      )}

      {value.type === "weekly" && (
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <TimeRow
            hour={value.hour}
            minute={value.minute}
            onChange={(hour, minute) =>
              onChange({ type: "weekly", hour, minute, dow: value.dow })
            }
          />
          <Select
            size="small"
            value={value.dow}
            onChange={(e) =>
              onChange({
                type: "weekly",
                hour: value.hour,
                minute: value.minute,
                dow: Number(e.target.value),
              })
            }
            aria-label="day of week"
          >
            {DOW.map((d) => (
              <MenuItem key={d.value} value={d.value}>
                {d.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary">
        Scheduled tasks use a randomized delay of several minutes for server performance.
      </Typography>
    </Stack>
  );
}

function TimeRow({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const value = `${pad(hour)}:${pad(minute)}`;
  return (
    <TextField
      type="time"
      label="Time"
      value={value}
      onChange={(e) => {
        const parts = e.target.value.split(":").map((s) => parseInt(s, 10));
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        onChange(clamp(h, 0, 23), clamp(m, 0, 59));
      }}
      size="small"
      slotProps={{ inputLabel: { shrink: true } }}
      sx={{ width: 140 }}
    />
  );
}

function defaultForType(type: RoutineScheduleType): RoutineSchedule {
  switch (type) {
    case "manual":
      return { type: "manual" };
    case "hourly":
      return { type: "hourly", minute: 0 };
    case "daily":
      return { type: "daily", hour: 9, minute: 0 };
    case "weekdays":
      return { type: "weekdays", hour: 9, minute: 0 };
    case "weekly":
      return { type: "weekly", hour: 9, minute: 0, dow: 1 };
  }
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
