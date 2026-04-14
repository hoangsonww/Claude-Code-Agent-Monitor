/**
 * @file format.ts
 * @description Provides utility functions for formatting dates, times, durations, and numbers in the agent dashboard application. It includes functions to parse ISO timestamp strings while normalizing UTC, format time and date-time strings for display, calculate and format durations between timestamps, and format large numbers with appropriate suffixes (K/M/B) for better readability. These utilities help ensure consistent and user-friendly presentation of temporal and numerical data throughout the application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/**
 * Parse a timestamp string into a Date, normalizing UTC.
 * SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' (no timezone).
 * JS treats that as local time, causing offset bugs. This ensures
 * timestamps without a timezone indicator are treated as UTC.
 */
function parseDate(iso: string): Date {
  // Already has timezone info (Z or +/- offset) — parse directly
  if (/[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso);
  }
  // No timezone — treat as UTC by appending Z
  // Handle both 'YYYY-MM-DD HH:MM:SS' and 'YYYY-MM-DDTHH:MM:SS' formats
  return new Date(iso.replace(" ", "T") + "Z");
}

export function formatTime(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(start: string, end: string): string {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return formatMs(ms);
}

export function formatMs(ms: number): string {
  if (ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - parseDate(iso).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "\u2026";
}

/** Format large numbers with B/M/K suffixes. */
export function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format dollar amounts with K/M suffixes. */
export function fmtCost(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/** Format dollar amounts with commas (for tooltips / full display). */
export function fmtCostFull(n: number, decimals = 2): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
