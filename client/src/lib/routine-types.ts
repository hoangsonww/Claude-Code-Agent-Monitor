/**
 * @file Routine + RoutineRun + RoutineSchedule TypeScript types shared between
 * the API client, page components, and editor. Schedules are a discriminated
 * union so the editor can switch fields without leaking optional fields into
 * the wire shape.
 */
import type { PermissionMode } from "./profile-types";

export type RoutineScheduleType = "manual" | "hourly" | "daily" | "weekdays" | "weekly";

export interface ManualSchedule {
  type: "manual";
}
export interface HourlySchedule {
  type: "hourly";
  /** 0-59 minute mark within the hour. */
  minute: number;
}
export interface DailySchedule {
  type: "daily";
  hour: number; // 0-23
  minute: number; // 0-59
}
export interface WeekdaysSchedule {
  type: "weekdays";
  hour: number;
  minute: number;
}
export interface WeeklySchedule {
  type: "weekly";
  hour: number;
  minute: number;
  /** 0=Sun, 1=Mon, ... 6=Sat */
  dow: number;
}

export type RoutineSchedule =
  | ManualSchedule
  | HourlySchedule
  | DailySchedule
  | WeekdaysSchedule
  | WeeklySchedule;

export type RoutineStatus = "active" | "disabled";

export interface Routine {
  id: string;
  name: string;
  description: string;
  instructions: string;
  cwd: string;
  worktree: boolean;
  permissionMode: PermissionMode;
  model: string | null;
  schedule: RoutineSchedule;
  status: RoutineStatus;
  /** Only present on the detail endpoint. */
  webhookToken?: string;
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
}

export type RoutineRunStatus = "spawning" | "running" | "completed" | "error" | "killed";
export type RoutineRunTrigger = "schedule" | "manual" | "api" | "webhook";

export interface RoutineRun {
  id: string;
  routine_id: string;
  agent_handle_id: string | null;
  trigger: RoutineRunTrigger;
  status: RoutineRunStatus;
  started_at: number;
  ended_at: number | null;
  exit_code: number | null;
  output_summary: string | null;
}

export interface RoutineCreateInput {
  name: string;
  description: string;
  instructions: string;
  cwd: string;
  worktree?: boolean;
  permissionMode?: PermissionMode;
  model?: string | null;
  schedule: RoutineSchedule;
}

export type RoutineUpdateInput = Partial<RoutineCreateInput> & {
  status?: RoutineStatus;
};

export interface RoutineDetailResponse {
  routine: Routine;
  runs: RoutineRun[];
  webhookUrl: string;
  webhookToken: string;
}
