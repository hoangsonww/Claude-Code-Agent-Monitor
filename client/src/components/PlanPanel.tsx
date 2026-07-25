/**
 * @file PlanPanel.tsx
 * @description Read-only checklist view of a repo's AGENT-PLAN.md: a
 * collapsible header with the house progress-bar idiom ("3/9 complete"),
 * then one row per plan item — checkbox state mirrors the file (human-owned,
 * never editable here), checked items strike through, and sessions currently
 * serving an item chip onto its row (amber-tinted when the drift auditor
 * flags them). Used by the Projects page (per project section and per
 * unassigned cwd) and by the SessionDetail plan tab (single-session variant).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, ClipboardList } from "lucide-react";
import { Checkbox } from "./Checkbox";
import type { Plan, PlanItem, Session, SessionFocus } from "../lib/types";

/** Props for {@link PlanPanel}. */
export interface PlanPanelProps {
  /** The plan to render (items included). */
  plan: Omit<Plan, "items">;
  /** The plan's items, file order. */
  items: PlanItem[];
  /** Sessions eligible to chip onto items (the owning project's/bucket's). */
  sessions: Session[];
  /** Live focus map from the focusStore (session_id → focus). */
  focusBySession: ReadonlyMap<string, SessionFocus>;
  /** Start expanded (SessionDetail); Projects defaults to collapsed. */
  defaultExpanded?: boolean;
  /**
   * Bump this (e.g. a counter) to force the panel open from an ancestor —
   * used by the project header's "view plan" icon. Ignored on first render
   * so it never fights `defaultExpanded`.
   */
  expandSignal?: number;
}

/**
 * Collapsible AGENT-PLAN.md checklist with per-item session chips.
 * @param props See {@link PlanPanelProps}.
 */
export function PlanPanel({
  plan,
  items,
  sessions,
  focusBySession,
  defaultExpanded,
  expandSignal,
}: PlanPanelProps) {
  const { t } = useTranslation("plan");
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const lastSignal = useRef(expandSignal);

  useEffect(() => {
    if (expandSignal !== undefined && expandSignal !== lastSignal.current) {
      lastSignal.current = expandSignal;
      setExpanded(true);
    }
  }, [expandSignal]);

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Sessions serving each item: join the focus map against the provided
  // session list (cards elsewhere already show per-session breadcrumbs; the
  // chips here answer "who is on item N" from the plan's side).
  const sessionsByItem = new Map<number, Array<{ session: Session; focus: SessionFocus }>>();
  for (const session of sessions) {
    const focus = focusBySession.get(session.id);
    if (!focus || focus.item_number == null || session.status !== "active") continue;
    const list = sessionsByItem.get(focus.item_number) ?? [];
    list.push({ session, focus });
    sessionsByItem.set(focus.item_number, list);
  }

  return (
    <div className="rounded-lg border border-border bg-surface-1/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <ClipboardList className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <span className="text-xs font-medium text-gray-300 truncate">
          {plan.title || t("title")}
        </span>
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

      {expanded && (
        <ul className="px-3 pb-3 space-y-1.5">
          {items.map((item) => {
            const serving = sessionsByItem.get(item.item_number) ?? [];
            const declaredDoneOnly = !item.checked && item.declared_done_at;
            return (
              <li key={item.item_number} className="flex items-start gap-2 min-w-0">
                {/* Read-only mirror of the file's checkbox — the plan file is
                    human-owned, so toggling here is deliberately a no-op. */}
                <Checkbox
                  checked={!!item.checked}
                  onChange={() => {}}
                  className="cursor-default mt-0.5"
                />
                <span
                  className={`text-xs min-w-0 flex-1 ${
                    item.checked ? "line-through text-gray-500" : "text-gray-300"
                  }`}
                  title={item.acceptance ?? undefined}
                >
                  <span className="font-mono text-gray-600 mr-1">{item.item_number}.</span>
                  {item.text}
                  {declaredDoneOnly && (
                    <span className="ml-1.5 text-[10px] text-yellow-400/90">
                      ◐ {t("items.declaredDone")}
                    </span>
                  )}
                </span>
                {serving.length > 0 && (
                  <span className="flex flex-wrap gap-1 flex-shrink-0 max-w-[45%] justify-end">
                    {serving.map(({ session, focus }) => (
                      <Link
                        key={session.id}
                        to={`/sessions/${session.id}`}
                        onClick={(e) => e.stopPropagation()}
                        draggable={false}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] truncate max-w-[10rem] ${
                          focus.drift === true
                            ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                            : "bg-surface-2 border-border text-gray-400 hover:text-gray-200"
                        }`}
                        title={session.name ?? session.id}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            focus.drift === true ? "bg-yellow-400" : "bg-emerald-400"
                          }`}
                        />
                        <span className="truncate">
                          {session.name?.trim() || session.id.slice(0, 8)}
                        </span>
                      </Link>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
