/**
 * @file Full owner-aware task-progress panel for Session Detail, combining a
 * segmented donut, completion bar, owner breakdown, and task rows paginated
 * ten at a time.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { Check, Circle, Info, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionTodoItem, SessionTodoSnapshot, SessionTodoStatus } from "../lib/types";
import { timeAgo } from "../lib/format";
import { TODO_STATUS_META, taskProgressSegments, taskSourceLabel } from "./todoProgress";
import { PaginatedLegend } from "./PaginatedLegend";

const STATUS_ICONS = {
  completed: Check,
  in_progress: LoaderCircle,
  pending: Circle,
  cancelled: X,
  unknown: Info,
} satisfies Record<SessionTodoStatus, typeof Circle>;

export function TodoProgressPanel({ snapshot }: { snapshot: SessionTodoSnapshot }) {
  const { t } = useTranslation("sessions");
  if (snapshot.total <= 0) return null;
  const segments = taskProgressSegments(snapshot);
  const circumference = 2 * Math.PI * 46;
  let offset = circumference / 4;

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border bg-surface-1">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-200">{t("taskProgress.title")}</h3>
        <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
          {taskSourceLabel(snapshot.sourceTool, t("taskProgress.title"))}
        </span>
        {snapshot.includesSubagents && (
          <span className="rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
            {t("taskProgress.includesSubagents")}
          </span>
        )}
        {snapshot.confidence === "partial" && (
          <span className="text-[10px] text-amber-400/80">{t("taskProgress.partialSource")}</span>
        )}
        {snapshot.updatedAt && (
          <span className="ml-auto text-[10px] text-gray-500">{timeAgo(snapshot.updatedAt)}</span>
        )}
      </div>

      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[132px_minmax(0,1fr)_minmax(220px,0.7fr)]">
        <div className="flex items-center justify-center">
          <div className="relative h-28 w-28">
            <svg width={112} height={112} viewBox="0 0 112 112" aria-hidden="true">
              <circle cx={56} cy={56} r={46} fill="none" stroke="#303044" strokeWidth={12} />
              {segments.map((segment) => {
                const dash = (segment.value / snapshot.total) * circumference;
                const currentOffset = offset;
                offset -= dash;
                return (
                  <circle
                    key={segment.status}
                    cx={56}
                    cy={56}
                    r={46}
                    fill="none"
                    stroke={TODO_STATUS_META[segment.status].color}
                    strokeWidth={12}
                    strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
                    strokeDashoffset={currentOffset}
                    transform="rotate(-90 56 56)"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-gray-100">
                {snapshot.percentComplete == null ? "—" : `${snapshot.percentComplete}%`}
              </span>
              <span className="text-[10px] text-gray-500">{t("taskProgress.complete")}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-100">
            {t("taskProgress.completeCountShort", {
              completed: snapshot.completed,
              total: snapshot.total,
            })}
          </p>
          {snapshot.activeText && (
            <p className="mt-1 line-clamp-2 text-sm text-blue-300">
              {t("taskProgress.current", { task: snapshot.activeText })}
            </p>
          )}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-4">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width]"
              style={{ width: `${snapshot.percentComplete ?? 0}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>{t("taskProgress.doneCount", { count: snapshot.completed })}</span>
            <span>
              {t("taskProgress.remainingCount", { count: snapshot.total - snapshot.completed })}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {segments.map((segment) => {
              const meta = TODO_STATUS_META[segment.status];
              return (
                <span
                  key={segment.status}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] ${meta.bgClass} ${meta.borderClass} ${meta.textClass}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {segment.value} {t(meta.labelKey)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 border-l border-border pl-5 max-lg:border-l-0 max-lg:border-t max-lg:pl-0 max-lg:pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {t("taskProgress.owners")}
          </p>
          <div className="mt-2 space-y-2">
            {snapshot.ownerBreakdown.map((owner) => {
              const percent =
                owner.total > 0 ? Math.round((owner.completed / owner.total) * 100) : 0;
              return (
                <div key={owner.agentId}>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-gray-300">
                      {owner.agentType === "main" ? t("taskProgress.mainAgent") : owner.agentType}
                    </span>
                    <span className="font-mono text-gray-500">
                      {owner.completed}/{owner.total}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-4">
                    <div
                      className="h-full rounded-full bg-violet-400/80"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {snapshot.explanation && (
            <p className="mt-4 line-clamp-3 text-[11px] leading-relaxed text-gray-500">
              {snapshot.explanation}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border">
        <PaginatedLegend
          items={snapshot.items}
          pageSize={10}
          getKey={(item) => `${item.agentId}-${item.id}`}
          renderItem={(item) => <TaskRow item={item} />}
          controlsClassName="px-5 pb-3"
        />
      </div>
    </section>
  );
}

function TaskRow({ item }: { item: SessionTodoItem }) {
  const { t } = useTranslation("sessions");
  const Icon = STATUS_ICONS[item.status];
  const meta = TODO_STATUS_META[item.status];
  return (
    <div className="grid min-h-11 grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 px-5 py-2.5">
      <Icon
        className={`h-3.5 w-3.5 ${meta.textClass} ${
          item.status === "in_progress" ? "animate-spin" : ""
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p
          className={`text-xs leading-5 ${
            item.status === "completed" || item.status === "cancelled"
              ? "text-gray-500"
              : "text-gray-200"
          }`}
        >
          {item.text}
        </p>
        {item.description && (
          <p className="truncate text-[10px] text-gray-600">{item.description}</p>
        )}
      </div>
      <div className="flex max-w-44 items-center gap-1.5">
        {item.agentType !== "main" && (
          <span className="truncate rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300">
            {item.agentType}
          </span>
        )}
        <span className={`whitespace-nowrap text-[9px] ${meta.textClass}`}>{t(meta.labelKey)}</span>
      </div>
    </div>
  );
}
