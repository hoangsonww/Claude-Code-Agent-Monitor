/**
 * @file FocusActivityCard.tsx
 * @description Renders `groupFocusActivity()`'s per-key rollup as a simple,
 * stakeholder-readable list: one row per plan item / detour-bug-feature /
 * unclassified bucket, each showing a kind chip (icon + color reused from
 * `FOCUS_KIND_CONFIG`/`FOCUS_KIND_ICONS`, the same vocabulary as PlanModal's
 * focus lines and SessionCard's breadcrumb), the label, a wall/active time
 * figure, an `inferred` tag when the entry came from the background
 * classifier rather than a live declaration, and — when the dominant
 * contributing segment was inferred — its one-sentence `inferred_reason`.
 * The body of `FocusPage.tsx`'s report, mocked up and validated against real
 * project data before this was built (see that page's own file header).
 *
 * Collapses past `COLLAPSE_AFTER` entries with a "show more"/"show fewer"
 * toggle so a project with a long tail of small detours doesn't dominate the
 * card. `showProjectLabel` is true only in cross-project ("all projects")
 * scope — a single-project view never prefixes entries with a project name.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMs } from "../lib/format";
import { FOCUS_KIND_CONFIG } from "../lib/types";
import type { FocusActivityEntry } from "../lib/focusActivity";
import { FOCUS_KIND_ICONS } from "./PlanModal";

const COLLAPSE_AFTER = 5;

export interface FocusActivityCardProps {
  entries: FocusActivityEntry[];
  /** Show each entry's resolved project label — meaningful only when the
   *  report spans more than one project ("all projects" scope). */
  showProjectLabel: boolean;
}

/** The activity list itself: one row per {@link FocusActivityEntry}, plus the
 *  show-more/fewer collapse past {@link COLLAPSE_AFTER}. */
export function FocusActivityCard({ entries, showProjectLabel }: FocusActivityCardProps) {
  const { t } = useTranslation("plan");
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.empty")}</p>;
  }

  const visible = expanded ? entries : entries.slice(0, COLLAPSE_AFTER);
  const hiddenCount = entries.length - visible.length;

  return (
    <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
      {visible.map((entry) => (
        <FocusActivityRow key={entry.key} entry={entry} showProjectLabel={showProjectLabel} />
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full text-left px-4 py-2.5 text-[11px] font-medium text-accent hover:underline"
        >
          {t("common:showMore", { count: hiddenCount })}
        </button>
      )}
      {expanded && entries.length > COLLAPSE_AFTER && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full text-left px-4 py-2.5 text-[11px] font-medium text-accent hover:underline"
        >
          {t("report.activityBoard.showFewer")}
        </button>
      )}
    </div>
  );
}

function FocusActivityRow({
  entry,
  showProjectLabel,
}: {
  entry: FocusActivityEntry;
  showProjectLabel: boolean;
}) {
  const { t } = useTranslation("plan");
  const cfg = FOCUS_KIND_CONFIG[entry.kind];
  const Icon = FOCUS_KIND_ICONS[entry.kind];
  const itemPrefix =
    entry.kind === "item" && entry.itemNumber != null
      ? t("focus.itemLabel", { number: entry.itemNumber })
      : null;
  // Item segments fall back to "(item not in plan)" if the text snapshot is
  // missing (mirrors FocusReportBody's ListView); detour/bug/feature always
  // carry a label from the declaration/classifier; "none" has none at all.
  const bodyLabel = entry.kind === "item" ? (entry.label ?? t("focus.unknownItem")) : entry.label;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`inline-flex items-center gap-1 flex-shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${cfg.bg} ${cfg.color}`}
      >
        <Icon className="w-3 h-3" aria-hidden="true" />
        {t(cfg.labelKey)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-200 min-w-0">
            {showProjectLabel && entry.projectLabel && (
              <span
                data-testid="focus-activity-project-label"
                className="text-gray-500 font-normal"
              >
                {entry.projectLabel} —{" "}
              </span>
            )}
            {itemPrefix && <span className="font-mono text-gray-500 mr-1.5">{itemPrefix}</span>}
            {bodyLabel}
            {entry.inferred && (
              <span className="ml-1.5 text-[10px] text-gray-500 border-b border-dotted border-gray-600">
                {t("report.inferred")}
              </span>
            )}
          </span>
          <span className="text-[11px] font-mono text-gray-500 flex-shrink-0 whitespace-nowrap">
            {entry.activeMs === entry.wallMs ? (
              formatMs(entry.wallMs)
            ) : (
              <>
                {t("report.wallClockLabel")} {formatMs(entry.wallMs)}
                {" · "}
                {t("report.activeLabel")} {formatMs(entry.activeMs)}
              </>
            )}
          </span>
        </div>
        {entry.reason && (
          <p className="text-[11px] text-gray-500 mt-1 max-w-[62ch]">{entry.reason}</p>
        )}
        {entry.contributions > 1 && (
          <p className="text-[10px] text-gray-600 mt-0.5">
            {t("report.activityBoard.moreContributions", { count: entry.contributions - 1 })}
          </p>
        )}
      </div>
    </div>
  );
}
