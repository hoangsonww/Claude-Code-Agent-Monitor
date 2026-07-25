/**
 * @file PlanPanel.tsx
 * @description Clickable summary strip for a repo's AGENT-PLAN.md: the house
 * progress-bar idiom ("3/9 complete") plus a missing-file badge. Clicking it
 * opens {@link PlanModal}, which renders the actual checklist at full size —
 * this component itself never expands inline, since a Projects card, a
 * narrow Kanban column, and even the Session Detail Plan tab all have too
 * little room to read a longer plan comfortably. Used by the Projects page
 * (per project section and per unassigned cwd), the Kanban board's
 * Projects-view columns, and the SessionDetail plan tab.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";
import type { Plan, PlanItem } from "../lib/types";

/** Props for {@link PlanPanel}. */
export interface PlanPanelProps {
  /** The plan to summarize. */
  plan: Omit<Plan, "items">;
  /** The plan's items — only their checked count is used here. */
  items: PlanItem[];
  /** Fired on click — the caller opens a {@link PlanModal} with this plan. */
  onOpen: () => void;
}

/**
 * Collapsed AGENT-PLAN.md summary strip; click opens the full checklist in a
 * {@link PlanModal} popup.
 * @param props See {@link PlanPanelProps}.
 */
export function PlanPanel({ plan, items, onOpen }: PlanPanelProps) {
  const { t } = useTranslation("plan");

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg border border-border bg-surface-1/60 hover:bg-surface-2/60 transition-colors"
    >
      <ClipboardList className="w-3.5 h-3.5 text-accent flex-shrink-0" />
      <span className="text-xs font-medium text-gray-300 truncate">{plan.title || t("title")}</span>
      {plan.missing_at && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex-shrink-0"
          title={t("planMissing")}
        >
          !
        </span>
      )}
      <span className="ml-auto flex items-center gap-2 flex-shrink-0 min-w-0">
        <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap">
          {t("progress", { done, total })}
        </span>
        <span className="h-1.5 w-24 rounded-full bg-surface-3 overflow-hidden inline-block">
          <span
            className="h-full bg-accent/70 rounded-full transition-[width] duration-300 block"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    </button>
  );
}
