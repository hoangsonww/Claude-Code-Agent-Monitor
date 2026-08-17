/**
 * @file PaginatedLegend.tsx
 * @description Reusable chart legend container that keeps short legends
 * unchanged and pages longer label sets into a bounded, accessible control.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useMemo, useState, type Key, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface PaginatedLegendProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => Key;
  renderItem: (item: T, index: number) => ReactNode;
  pageSize?: number;
  className?: string;
  listClassName?: string;
  controlsClassName?: string;
}

/**
 * Render every item directly when it fits. Larger legends expose only one
 * bounded page at a time and keep all remaining labels reachable.
 */
export function PaginatedLegend<T>({
  items,
  getKey,
  renderItem,
  pageSize = 6,
  className = "",
  listClassName = "",
  controlsClassName = "",
}: PaginatedLegendProps<T>) {
  const { t } = useTranslation("common");
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize));
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const pageItems = useMemo(() => {
    const start = currentPage * safePageSize;
    return items.slice(start, start + safePageSize);
  }, [currentPage, items, safePageSize]);

  const start = items.length === 0 ? 0 : currentPage * safePageSize + 1;
  const end = Math.min((currentPage + 1) * safePageSize, items.length);

  return (
    <div className={className}>
      <div className={listClassName}>
        {pageItems.map((item, index) => {
          const absoluteIndex = currentPage * safePageSize + index;
          return <div key={getKey(item, absoluteIndex)}>{renderItem(item, absoluteIndex)}</div>;
        })}
      </div>

      {pageCount > 1 && (
        <div
          className={`mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-2 ${controlsClassName}`}
        >
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={currentPage === 0}
            aria-label={t("pagination.previous")}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="text-[10px] tabular-nums text-gray-600" aria-live="polite">
            {t("pagination.showing", { from: start, to: end, total: items.length })}
          </span>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-35"
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            disabled={currentPage === pageCount - 1}
            aria-label={t("pagination.next")}
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
