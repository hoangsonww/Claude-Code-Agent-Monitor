/**
 * @file Shared visual metadata and formatting helpers for compact and detailed
 * session task-progress surfaces.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { SessionTodoSnapshot, SessionTodoStatus, SessionTodoSummary } from "../lib/types";

export const TODO_STATUS_META: Record<
  SessionTodoStatus,
  {
    color: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    labelKey: string;
  }
> = {
  completed: {
    color: "#34d399",
    textClass: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
    labelKey: "taskProgress.status.completed",
  },
  in_progress: {
    color: "#60a5fa",
    textClass: "text-blue-300",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/20",
    labelKey: "taskProgress.status.inProgress",
  },
  pending: {
    color: "#a78bfa",
    textClass: "text-violet-300",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/20",
    labelKey: "taskProgress.status.pending",
  },
  cancelled: {
    color: "#6b7280",
    textClass: "text-gray-400",
    bgClass: "bg-gray-500/10",
    borderClass: "border-gray-500/20",
    labelKey: "taskProgress.status.cancelled",
  },
  unknown: {
    color: "#f59e0b",
    textClass: "text-amber-300",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
    labelKey: "taskProgress.status.unknown",
  },
};

export function taskProgressSegments(progress: SessionTodoSummary | SessionTodoSnapshot) {
  return [
    { status: "completed" as const, value: progress.completed },
    { status: "in_progress" as const, value: progress.inProgress },
    { status: "pending" as const, value: progress.pending },
    { status: "cancelled" as const, value: progress.cancelled },
    { status: "unknown" as const, value: progress.unknown },
  ].filter((segment) => segment.value > 0);
}

export function taskSourceLabel(sourceTool: string | null | undefined, fallbackLabel: string) {
  if (!sourceTool) return fallbackLabel;
  if (sourceTool === "update_plan") return "Codex update_plan";
  if (sourceTool === "TodoWrite") return "Claude TodoWrite";
  if (sourceTool.startsWith("Task")) return `Claude ${sourceTool}`;
  return sourceTool;
}

export function taskProgressAriaLabel(
  progress: SessionTodoSummary | SessionTodoSnapshot,
  completeWord = "complete"
) {
  return `${progress.completed} of ${progress.total} ${completeWord}`;
}
