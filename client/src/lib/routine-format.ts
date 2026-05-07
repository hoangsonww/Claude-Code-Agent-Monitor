/**
 * @file Friendly formatters for routine summaries and "next run" relative
 * times. Pure functions so they're trivial to unit-test.
 */
import type { RoutineSchedule } from "./routine-types";

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "tomorrow at ~9:00 AM" / "in 3h" / "Friday at ~10:00 AM" / "now" / "—" */
export function formatNextRun(ts: number | null, now: number = Date.now()): string {
  if (ts == null) return "—";
  const diffMs = ts - now;
  if (diffMs <= 0) return "now";
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "in <1m";
  if (diffMin < 60) return `in ${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 6) return `in ${diffHr}h`;
  const target = new Date(ts);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const targetDay = new Date(ts);
  targetDay.setHours(0, 0, 0, 0);
  const dayDelta = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);
  const time = formatHM(target.getHours(), target.getMinutes());
  if (dayDelta === 0) return `today at ~${time}`;
  if (dayDelta === 1) return `tomorrow at ~${time}`;
  if (dayDelta < 7) return `${DOW_NAMES[target.getDay()]} at ~${time}`;
  return target.toLocaleString();
}

/** "Daily at ~9:00 AM" / "Hourly at :00" / "Manual only" */
export function summarizeSchedule(schedule: RoutineSchedule): string {
  switch (schedule.type) {
    case "manual":
      return "Manual only";
    case "hourly":
      return `Hourly at :${pad(schedule.minute)}`;
    case "daily":
      return `Daily at ~${formatHM(schedule.hour, schedule.minute)}`;
    case "weekdays":
      return `Weekdays at ~${formatHM(schedule.hour, schedule.minute)}`;
    case "weekly":
      return `Weekly on ${DOW_NAMES[schedule.dow]} at ~${formatHM(schedule.hour, schedule.minute)}`;
  }
}

function formatHM(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)} ${ampm}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
