/**
 * @file PlanModal.tsx
 * @description Full-size popup view of one or more AGENT-PLAN.md checklists —
 * opened by clicking a {@link PlanPanel} strip or a project header's "view
 * plan" icon. Exists because the inline strip's own real estate (a Projects
 * card, a narrow Kanban column, or even the Session Detail Plan tab) is too
 * tight to read a longer plan comfortably; the popup gives the checklist a
 * full, scrollable panel instead. Read-only, same as PlanPanel — the file
 * stays the source of truth for checkbox state. Also renders bug/feature
 * badges (from `ccam focus bug|feature`) next to whichever item a session
 * declared them under, or an "Unknown" bucket when no item was current.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ClipboardList, X, Bug, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Checkbox } from "./Checkbox";
import { timeAgo } from "../lib/format";
import { DETOUR_KIND_CONFIG } from "../lib/types";
import type { DetourFrame, DetourKind, Plan, PlanItem, Session, SessionFocus } from "../lib/types";

/** Per-kind icon for {@link DetourBadge}, kept out of lib/types.ts so the
 *  presentation lookup there stays JSX-free (mirrors StatusBadge's
 *  REASON_ICONS convention). */
const DETOUR_KIND_ICONS: Record<DetourKind, LucideIcon> = {
  bug: Bug,
  feature: Sparkles,
};

/** One detour frame paired with the session that declared it, bucketed
 *  under whichever plan item (or "unknown") it belongs to. */
interface DetourEntry {
  session: Session;
  frame: DetourFrame;
}

/** One plan + its items, the same decomposed shape {@link PlanPanel} takes. */
export interface PlanModalEntry {
  plan: Omit<Plan, "items">;
  items: PlanItem[];
}

/** Props for {@link PlanModal}. */
export interface PlanModalProps {
  /** One or more plans to show — a project can span several mapped cwds,
   *  each with its own AGENT-PLAN.md. */
  plans: PlanModalEntry[];
  /** Sessions eligible to chip onto items (scoped to the same project/bucket
   *  the plan(s) came from, so a chip never bleeds in from an unrelated
   *  project's session that happens to share an item number). */
  sessions: Session[];
  /** Live focus map from the focusStore (session_id → focus). */
  focusBySession: ReadonlyMap<string, SessionFocus>;
  onClose: () => void;
}

/**
 * Centered popup listing full AGENT-PLAN.md checklist(s) at reading size.
 * @param props See {@link PlanModalProps}.
 */
export function PlanModal({ plans, sessions, focusBySession, onClose }: PlanModalProps) {
  const { t } = useTranslation("plan");

  // Escape to close - standard modal affordance, same pattern as
  // ConfirmModal/UpdateNotifier.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const headerTitle =
    plans.length === 1 && plans[0]
      ? plans[0].plan.title || t("title")
      : t("titleCount", { count: plans.length });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] card shadow-2xl animate-slide-up overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-4 h-4 text-accent flex-shrink-0" />
            <h2 id="plan-modal-title" className="text-sm font-semibold text-gray-100 truncate">
              {headerTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t("common:close")}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 overflow-y-auto">
          {plans.map(({ plan, items }, i) => (
            <PlanSection
              key={plan.cwd}
              plan={plan}
              items={items}
              sessions={sessions}
              focusBySession={focusBySession}
              divider={i > 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stable key for a detour frame across the badge and its expand panel. */
function detourKey(session: Session, frame: DetourFrame): string {
  return `${session.id}:${frame.pushed_at}`;
}

/** Bug/feature icon+title pills for one item's (or the Unknown bucket's)
 *  in-flight detours. Clicking a pill toggles its expand panel. */
function DetourBadges({
  entries,
  expandedKeys,
  onToggle,
}: {
  entries: DetourEntry[];
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <>
      {entries.map(({ session, frame }) => {
        if (!frame.kind) return null;
        const key = detourKey(session, frame);
        const cfg = DETOUR_KIND_CONFIG[frame.kind];
        const Icon = DETOUR_KIND_ICONS[frame.kind];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-expanded={expandedKeys.has(key)}
            title={frame.description}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] truncate max-w-[10rem] ${cfg.bg} ${cfg.color}`}
          >
            <Icon className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{frame.title}</span>
          </button>
        );
      })}
    </>
  );
}

/** Expanded detail panel(s) for whichever of `entries` are in `expandedKeys`. */
function DetourDetails({
  entries,
  expandedKeys,
}: {
  entries: DetourEntry[];
  expandedKeys: Set<string>;
}) {
  const { t } = useTranslation("plan");
  const expanded = entries.filter(({ session, frame }) =>
    expandedKeys.has(detourKey(session, frame))
  );
  if (expanded.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {expanded.map(({ session, frame }) => (
        <div
          key={detourKey(session, frame)}
          className="text-xs text-gray-400 bg-surface-2/60 border border-border rounded-md px-2 py-1.5"
        >
          <p className="leading-snug">{frame.detail || frame.description}</p>
          <p className="text-[10px] text-gray-600 mt-1">
            {t("items.declaredBy", { session: session.name?.trim() || session.id.slice(0, 8) })}
            {" · "}
            {timeAgo(frame.pushed_at)}
          </p>
        </div>
      ))}
    </div>
  );
}

interface PlanSectionProps {
  plan: Omit<Plan, "items">;
  items: PlanItem[];
  sessions: Session[];
  focusBySession: ReadonlyMap<string, SessionFocus>;
  divider: boolean;
}

function PlanSection({ plan, items, sessions, focusBySession, divider }: PlanSectionProps) {
  const { t } = useTranslation("plan");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Sessions serving each item, and bug/feature detours bucketed by the item
  // they were declared under (or "unknown" when no item was current): both
  // joins walk the same focus map against the provided session list (cards
  // elsewhere already show per-session breadcrumbs; the chips here answer
  // "who/what is on item N" from the plan's side).
  const sessionsByItem = new Map<number, Array<{ session: Session; focus: SessionFocus }>>();
  const detoursByBucket = new Map<number | "unknown", DetourEntry[]>();
  for (const session of sessions) {
    const focus = focusBySession.get(session.id);
    if (!focus || session.status !== "active") continue;
    if (focus.item_number != null) {
      const list = sessionsByItem.get(focus.item_number) ?? [];
      list.push({ session, focus });
      sessionsByItem.set(focus.item_number, list);
    }
    for (const frame of focus.detour_stack) {
      if (!frame.kind) continue;
      const bucket = frame.prior_item ?? "unknown";
      const list = detoursByBucket.get(bucket) ?? [];
      list.push({ session, frame });
      detoursByBucket.set(bucket, list);
    }
  }
  const unknownDetours = detoursByBucket.get("unknown") ?? [];

  return (
    <div className={divider ? "pt-6 border-t border-border" : undefined}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-200 truncate">
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
      </div>

      <ul className="space-y-4">
        {items.map((item) => {
          const serving = sessionsByItem.get(item.item_number) ?? [];
          const detours = detoursByBucket.get(item.item_number) ?? [];
          const declaredDoneOnly = !item.checked && item.declared_done_at;
          return (
            <li key={item.item_number} className="flex items-start gap-3 min-w-0">
              {/* Read-only mirror of the file's checkbox — the plan file is
                  human-owned, so toggling here is deliberately a no-op. */}
              <Checkbox
                checked={!!item.checked}
                onChange={() => {}}
                className="cursor-default mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span
                    className={`text-sm leading-relaxed ${
                      item.checked ? "text-gray-400" : "text-gray-100"
                    }`}
                  >
                    <span className="font-mono text-gray-500 mr-1.5">{item.item_number}.</span>
                    {item.text}
                    {declaredDoneOnly && (
                      <span className="ml-1.5 text-xs text-yellow-400/90">
                        ◐ {t("items.declaredDone")}
                      </span>
                    )}
                  </span>
                  {(detours.length > 0 || serving.length > 0) && (
                    <span className="flex flex-wrap gap-1 flex-shrink-0">
                      <DetourBadges
                        entries={detours}
                        expandedKeys={expandedKeys}
                        onToggle={toggleExpanded}
                      />
                      {serving.map(({ session, focus }) => (
                        <Link
                          key={session.id}
                          to={`/sessions/${session.id}`}
                          draggable={false}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] truncate max-w-[12rem] ${
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
                </div>
                {item.acceptance && (
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    <span className="text-gray-600 font-medium">{t("items.acceptancePrefix")}</span>{" "}
                    {item.acceptance}
                  </p>
                )}
                <DetourDetails entries={detours} expandedKeys={expandedKeys} />
              </div>
            </li>
          );
        })}
        {unknownDetours.length > 0 && (
          <li className="flex items-start gap-3 min-w-0">
            <span className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <span className="text-sm italic text-gray-500">{t("items.unknownBucket")}</span>
                <span className="flex flex-wrap gap-1 flex-shrink-0">
                  <DetourBadges
                    entries={unknownDetours}
                    expandedKeys={expandedKeys}
                    onToggle={toggleExpanded}
                  />
                </span>
              </div>
              <DetourDetails entries={unknownDetours} expandedKeys={expandedKeys} />
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
