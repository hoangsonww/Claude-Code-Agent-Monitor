/**
 * @file StatTile.tsx
 * @description A single labeled stat cell (label, big value, optional sub-caption
 * and hover tooltip) — extracted out of `FocusReportBody.tsx` (where it lived as
 * an unexported local component) so a second consumer, the new `FocusPage.tsx`
 * report, can render its own stat-tile row without depending on
 * `FocusReportBody`'s calendar/list rendering. Behavior and markup are
 * unchanged from the original inline version; every existing caller inside
 * `FocusReportBody.tsx` now imports this instead of a local definition.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { ReactNode } from "react";

export interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  /** Native hover tooltip for a tile whose meaning isn't self-evident from
   *  its label alone (e.g. what a bare "1.08x" ratio is actually of). */
  title?: string;
  /** Optional second sub-caption line, rendered below `sub` with identical
   *  styling (used by `ConcurrencyStatTile`: `sub` is the primary ratio's
   *  denominator time, `sub2` the secondary ratio). Omitted, no extra
   *  markup renders — tiles without it are unaffected. */
  sub2?: string;
  /** Optional control rendered at the right end of the label row (e.g. the
   *  Concurrency tile's primary-ratio swap button). Omitted, the label row's
   *  markup is byte-identical to before this prop existed - no wrapper div
   *  appears around the label, so tiles without an action are unaffected. */
  action?: ReactNode;
}

export function StatTile({
  label,
  value,
  sub,
  valueClassName,
  title,
  action,
  sub2,
}: StatTileProps) {
  const labelSpan = <span className="text-[10.5px] text-gray-500 truncate">{label}</span>;
  return (
    <div className="bg-surface-1 px-3.5 py-3 flex flex-col gap-1 min-w-0" title={title}>
      {action ? (
        <div className="flex items-center justify-between gap-1 min-w-0">
          {labelSpan}
          {action}
        </div>
      ) : (
        labelSpan
      )}
      <span
        className={`font-mono text-lg font-semibold tabular-nums ${valueClassName ?? "text-gray-100"}`}
      >
        {value}
      </span>
      {sub && <span className="text-[10.5px] text-gray-600 truncate">{sub}</span>}
      {sub2 && <span className="text-[10.5px] text-gray-600 truncate">{sub2}</span>}
    </div>
  );
}
