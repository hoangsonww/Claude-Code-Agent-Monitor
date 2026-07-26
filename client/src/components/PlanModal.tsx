/**
 * @file PlanModal.tsx
 * @description Full-size popup view of one or more AGENT-PLAN.md checklists —
 * opened by clicking a {@link PlanPanel} strip or a project header's "view
 * plan" icon. Exists because the inline strip's own real estate (a Projects
 * card, a narrow Kanban column, or even the Session Detail Plan tab) is too
 * tight to read a longer plan comfortably; the popup gives the checklist a
 * full, scrollable panel instead. Read-only, same as PlanPanel — the file
 * stays the source of truth for checkbox state. Also renders one focus line
 * per active session next to whichever item it's declared under (or an
 * "Unknown" bucket when no item was current): a shared icon vocabulary
 * (known item / plain detour / feature / bug, from `ccam focus set|push|
 * bug|feature`) makes each session's actual current state legible at a
 * glance, with click-to-expand detail for bug/feature declarations.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ClipboardList, X, Bug, Sparkles, Crosshair, Route } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Checkbox } from "./Checkbox";
import { timeAgo } from "../lib/format";
import { FOCUS_KIND_CONFIG, focusKind } from "../lib/types";
import type { DetourFrame, FocusKind, Plan, PlanItem, Session, SessionFocus } from "../lib/types";

/** Per-kind icon for {@link FocusLine}, kept out of lib/types.ts so the
 *  presentation lookup there stays JSX-free (mirrors StatusBadge's
 *  REASON_ICONS convention). Exported so SessionCard's breadcrumb uses the
 *  exact same icon vocabulary instead of a second, drifting copy. */
export const FOCUS_KIND_ICONS: Record<FocusKind, LucideIcon> = {
  item: Crosshair,
  detour: Route,
  feature: Sparkles,
  bug: Bug,
};

/** One session's current focus, resolved to a single {@link FocusKind} and
 *  bucketed under whichever plan item (or "unknown") it belongs to. `frame`
 *  is the top-of-stack detour when the kind isn't `"item"`. */
interface FocusEntry {
  session: Session;
  focus: SessionFocus;
  kind: FocusKind;
  frame?: DetourFrame;
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

/** Stable key for a focus entry across its line and expand panel. Item-kind
 *  entries have no frame, so they key off the session alone (one per item). */
function focusEntryKey(entry: FocusEntry): string {
  return entry.frame ? `${entry.session.id}:${entry.frame.pushed_at}` : `${entry.session.id}:item`;
}

/** One line per session currently focused on an item (or bucketed under the
 *  Unknown row): an icon for the {@link FocusKind} (known item / plain
 *  detour / feature / bug), the session name, and — for detours — a brief
 *  description of what's actually happening. Clicking a line with further
 *  detail (bug/feature `detail`) toggles its expand panel. */
function FocusLines({
  entries,
  expandedKeys,
  onToggle,
}: {
  entries: FocusEntry[];
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 items-start">
      {entries.map((entry) => {
        const { session, focus, kind, frame } = entry;
        const key = focusEntryKey(entry);
        const cfg = FOCUS_KIND_CONFIG[kind];
        const Icon = FOCUS_KIND_ICONS[kind];
        const description = frame ? frame.title || frame.description : null;
        const canExpand = !!frame?.detail;
        const isDrifting = kind === "item" && focus.drift === true;
        return (
          <button
            key={key}
            type="button"
            onClick={() => canExpand && onToggle(key)}
            aria-expanded={canExpand ? expandedKeys.has(key) : undefined}
            title={frame?.description ?? focus.item_text ?? undefined}
            className={`inline-flex items-center gap-1.5 min-w-0 max-w-full rounded-md border px-1.5 py-0.5 text-[11px] ${
              isDrifting
                ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                : `${cfg.bg} ${cfg.color}`
            } ${canExpand ? "cursor-pointer" : "cursor-default"}`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <Link
              to={`/sessions/${session.id}`}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
              className="truncate font-medium hover:underline flex-shrink-0 max-w-[8rem]"
            >
              {session.name?.trim() || session.id.slice(0, 8)}
            </Link>
            {description && (
              <>
                <span aria-hidden="true" className="text-gray-600">
                  —
                </span>
                <span className="truncate text-gray-400">{description}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Expanded detail panel(s) for whichever of `entries` are in `expandedKeys`. */
function FocusLineDetails({
  entries,
  expandedKeys,
}: {
  entries: FocusEntry[];
  expandedKeys: Set<string>;
}) {
  const { t } = useTranslation("plan");
  const expanded = entries.filter((entry) => expandedKeys.has(focusEntryKey(entry)));
  if (expanded.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {expanded.map((entry) => (
        <div
          key={focusEntryKey(entry)}
          className="text-xs text-gray-400 bg-surface-2/60 border border-border rounded-md px-2 py-1.5"
        >
          <p className="leading-snug">{entry.frame?.detail || entry.frame?.description}</p>
          <p className="text-[10px] text-gray-600 mt-1">
            {t("items.declaredBy", {
              session: entry.session.name?.trim() || entry.session.id.slice(0, 8),
            })}
            {entry.frame && (
              <>
                {" · "}
                {timeAgo(entry.frame.pushed_at)}
              </>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

interface PlanItemRowProps {
  item: PlanItem;
  entries: FocusEntry[];
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
  /** Sub-item completion count, shown next to a parent's number as a light
   *  rollup cue. The parent's own checkbox stays file-driven (checked mirrors
   *  the file literally, per PlanModal's read-only contract) even once every
   *  sub-item is checked — the /project-plan skill treats "all sub-items
   *  checked" as sufficient evidence to gate the parent's own checkbox, but
   *  that's a human-approved file edit, not something this view infers on
   *  its own. */
  rollup?: { done: number; total: number };
  /** Sub-item styling: smaller text, no acceptance/detail heading weight. */
  small?: boolean;
}

/** One checklist row — a top-level item or a sub-item, sharing the same
 *  checkbox/number/text/acceptance/detail/focus-lines layout so the two
 *  never visually drift apart. */
function PlanItemRow({ item, entries, expandedKeys, onToggle, rollup, small }: PlanItemRowProps) {
  const { t } = useTranslation("plan");
  const declaredDoneOnly = !item.checked && item.declared_done_at;
  return (
    <div className="flex items-start gap-3 min-w-0">
      {/* Read-only mirror of the file's checkbox — the plan file is
          human-owned, so toggling here is deliberately a no-op. */}
      <Checkbox
        checked={!!item.checked}
        onChange={() => {}}
        className={`cursor-default ${small ? "mt-0.5 scale-90" : "mt-0.5"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span
            className={`leading-relaxed ${small ? "text-xs" : "text-sm"} ${
              item.checked ? "text-gray-400" : "text-gray-100"
            }`}
          >
            <span className="font-mono text-gray-500 mr-1.5">{item.display_number}.</span>
            {item.text}
            {declaredDoneOnly && (
              <span className="ml-1.5 text-xs text-yellow-400/90">◐ {t("items.declaredDone")}</span>
            )}
            {rollup && (
              <span className="ml-1.5 text-[11px] text-gray-500 font-mono">
                ({rollup.done}/{rollup.total})
              </span>
            )}
          </span>
        </div>
        {item.acceptance && (
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            <span className="text-gray-600 font-medium">{t("items.acceptancePrefix")}</span>{" "}
            {item.acceptance}
          </p>
        )}
        {item.detail && (
          <p className="text-xs text-gray-500 mt-1 leading-snug whitespace-pre-line">
            <span className="text-gray-600 font-medium">{t("items.detailPrefix")}</span>{" "}
            {item.detail}
          </p>
        )}
        {entries.length > 0 && (
          <div className="mt-1.5">
            <FocusLines entries={entries} expandedKeys={expandedKeys} onToggle={onToggle} />
          </div>
        )}
        <FocusLineDetails entries={entries} expandedKeys={expandedKeys} />
      </div>
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

  // Progress counts top-level items only — sub-items are a decomposition
  // detail at a different altitude (see project-plan skill's altitude
  // rules) and would otherwise dilute the stakeholder-facing "N/M done"
  // number the plan's own 5-12 item count is supposed to mean.
  const topLevelItems = items.filter((i) => !i.parent_item_id);
  const done = topLevelItems.filter((i) => i.checked).length;
  const total = topLevelItems.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const childrenByParent = new Map<string, PlanItem[]>();
  for (const item of items) {
    if (!item.parent_item_id) continue;
    const list = childrenByParent.get(item.parent_item_id) ?? [];
    list.push(item);
    childrenByParent.set(item.parent_item_id, list);
  }

  // One focus entry per active session, bucketed under the plan item it
  // belongs to (or "unknown" when no item was current): a session on a
  // plain item buckets under its own item_number; a session mid-detour
  // (plain, feature, or bug — any kind) buckets under the item that was
  // current when the detour started (frame.prior_item), which is the
  // renumbering-safe snapshot the item-only case can't provide on its own.
  // Each session contributes exactly one line reflecting its true current
  // state, never both a "serving" chip and a separate detour badge at once.
  // Sub-items never appear here — they have no item_number, so a session
  // can't declare focus on one directly.
  const entriesByItem = new Map<number, FocusEntry[]>();
  const unknownEntries: FocusEntry[] = [];
  for (const session of sessions) {
    const focus = focusBySession.get(session.id);
    if (!focus || session.status !== "active") continue;
    const kind = focusKind(focus);
    if (!kind) continue;
    const frame = kind === "item" ? undefined : focus.detour_stack[focus.detour_stack.length - 1];
    const entry: FocusEntry = { session, focus, kind, frame };
    const bucket = kind === "item" ? focus.item_number : (frame?.prior_item ?? null);
    if (bucket != null) {
      const list = entriesByItem.get(bucket) ?? [];
      list.push(entry);
      entriesByItem.set(bucket, list);
    } else {
      unknownEntries.push(entry);
    }
  }

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
        {topLevelItems.map((item) => {
          const children = childrenByParent.get(item.item_id) ?? [];
          const rollup =
            children.length > 0
              ? { done: children.filter((c) => c.checked).length, total: children.length }
              : undefined;
          return (
            <li key={item.item_id} className="min-w-0">
              <PlanItemRow
                item={item}
                entries={
                  item.item_number != null ? (entriesByItem.get(item.item_number) ?? []) : []
                }
                expandedKeys={expandedKeys}
                onToggle={toggleExpanded}
                rollup={rollup}
              />
              {children.length > 0 && (
                <ul className="mt-2.5 ml-7 space-y-2.5 border-l border-border/60 pl-4">
                  {children.map((child) => (
                    <li key={child.item_id} className="min-w-0">
                      <PlanItemRow
                        item={child}
                        entries={[]}
                        expandedKeys={expandedKeys}
                        onToggle={toggleExpanded}
                        small
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {unknownEntries.length > 0 && (
          <li className="flex items-start gap-3 min-w-0">
            <span className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <span className="text-sm italic text-gray-500">{t("items.unknownBucket")}</span>
              <div className="mt-1.5">
                <FocusLines
                  entries={unknownEntries}
                  expandedKeys={expandedKeys}
                  onToggle={toggleExpanded}
                />
              </div>
              <FocusLineDetails entries={unknownEntries} expandedKeys={expandedKeys} />
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
