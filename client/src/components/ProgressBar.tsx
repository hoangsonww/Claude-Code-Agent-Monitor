/**
 * @file ProgressBar.tsx
 * @description A slim, accessible task-progress bar for Kanban agent cards.
 * Given completed/total counts it renders a track+fill plus a compact
 * "done/total" label; the exact percent + source live in the hover tooltip.
 * Pure presentational — no data access — so it is unit-testable in isolation.
 * Renders nothing when there is no real denominator (total <= 0).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

interface ProgressBarProps {
  /** Completed units (todo items done, or finished workflow agents). */
  done: number;
  /** Total units. When <= 0 the component renders nothing. */
  total: number;
  /** Tooltip text (exact percent + source), supplied by the caller for i18n. */
  title?: string;
  /** Accessible label, supplied by the caller for i18n. */
  ariaLabel?: string;
}

export function ProgressBar({ done, total, title, ariaLabel }: ProgressBarProps) {
  if (!Number.isFinite(total) || total <= 0) return null;
  const safeDone = Math.max(0, Math.min(done, total));
  const pct = Math.round((safeDone / total) * 100);
  return (
    <div
      className="flex items-center gap-2"
      title={title}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={safeDone}
      aria-label={ariaLabel}
    >
      <div className="h-1.5 flex-1 min-w-0 rounded-full bg-surface-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-gray-500 flex-shrink-0 tabular-nums">
        {safeDone}/{total}
      </span>
    </div>
  );
}
