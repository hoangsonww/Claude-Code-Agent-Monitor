/**
 * @file Compact task-progress donut for Sessions table rows with an accessible,
 * viewport-clamped detail tooltip rendered through a body portal.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Circle, CircleDashed, Info, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SessionTodoItem, SessionTodoStatus, SessionTodoSummary } from "../lib/types";
import { timeAgo } from "../lib/format";
import { TODO_STATUS_META, taskProgressSegments, taskSourceLabel } from "./todoProgress";

const STATUS_ICONS = {
  completed: Check,
  in_progress: LoaderCircle,
  pending: Circle,
  cancelled: X,
  unknown: Info,
} satisfies Record<SessionTodoStatus, typeof Circle>;

interface TodoProgressIndicatorProps {
  progress: SessionTodoSummary;
  stopClickPropagation?: boolean;
}

export function TodoProgressIndicator({
  progress,
  stopClickPropagation = false,
}: TodoProgressIndicatorProps) {
  const { t } = useTranslation("sessions");
  const tooltipId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const positionTooltip = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 12;
    const width = Math.min(340, Math.max(0, window.innerWidth - margin * 2));
    const left = Math.max(
      margin,
      Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - margin)
    );
    const preferredTop = rect.bottom + 8;
    const top =
      preferredTop + 360 > window.innerHeight ? Math.max(margin, rect.top - 368) : preferredTop;
    setPosition({ left, top });
  }, []);

  const show = useCallback(() => {
    positionTooltip();
    setOpen(true);
  }, [positionTooltip]);

  if (progress.total <= 0) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="relative inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        aria-label={t("taskProgress.aria", {
          completed: progress.completed,
          total: progress.total,
        })}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={stopClickPropagation ? (event) => event.stopPropagation() : undefined}
      >
        <ProgressDonut progress={progress} size={20} strokeWidth={3} />
        {progress.inProgress > 0 && (
          <span
            className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full border border-surface-1 bg-blue-400"
            aria-hidden="true"
          />
        )}
      </button>
      {open &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="fixed z-[99999] w-[340px] max-w-[calc(100vw-24px)] rounded-lg border border-[#2a2a4a] bg-[#12121f] p-3 text-left shadow-2xl"
            style={{ left: position.left, top: position.top }}
          >
            <div className="flex items-start gap-3">
              <ProgressDonut progress={progress} size={42} strokeWidth={6} showPercent />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-100">{t("taskProgress.title")}</p>
                <p className="mt-0.5 text-[11px] text-gray-300">
                  {t("taskProgress.completeCount", {
                    completed: progress.completed,
                    total: progress.total,
                    percent: progress.percentComplete ?? 0,
                  })}
                </p>
                {progress.activeText && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-blue-300">
                    {t("taskProgress.current", { task: progress.activeText })}
                  </p>
                )}
              </div>
            </div>

            <StatusSummary progress={progress} />

            {progress.previewItems.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-[#2a2a4a] pt-2.5">
                {progress.previewItems.map((item) => (
                  <TaskPreviewRow key={`${item.agentId}-${item.id}`} item={item} />
                ))}
                {progress.overflowCount > 0 && (
                  <p className="pl-5 text-[10px] text-gray-500">
                    {t("taskProgress.more", { count: progress.overflowCount })}
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[#2a2a4a] pt-2 text-[10px] text-gray-500">
              <span>{taskSourceLabel(progress.sourceTool, t("taskProgress.title"))}</span>
              {progress.updatedAt && <span>{timeAgo(progress.updatedAt)}</span>}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function ProgressDonut({
  progress,
  size,
  strokeWidth,
  showPercent = false,
}: {
  progress:
    | SessionTodoSummary
    | { completed: number; total: number; percentComplete: number | null };
  size: number;
  strokeWidth: number;
  showPercent?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const completed = progress.total > 0 ? progress.completed / progress.total : 0;
  const dash = completed * circumference;
  return (
    <span
      className="relative inline-flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#303044"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#34d399"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${Math.max(0, circumference - dash)}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showPercent && (
        <span className="absolute text-[9px] font-semibold text-gray-200">
          {progress.percentComplete == null ? "—" : `${progress.percentComplete}%`}
        </span>
      )}
    </span>
  );
}

function StatusSummary({ progress }: { progress: SessionTodoSummary }) {
  const { t } = useTranslation("sessions");
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {taskProgressSegments(progress).map((segment) => {
        const meta = TODO_STATUS_META[segment.status];
        return (
          <div
            key={segment.status}
            className={`rounded border px-1.5 py-1 ${meta.bgClass} ${meta.borderClass}`}
          >
            <p className={`text-[10px] font-semibold ${meta.textClass}`}>{segment.value}</p>
            <p className="truncate text-[9px] text-gray-500">{t(meta.labelKey)}</p>
          </div>
        );
      })}
    </div>
  );
}

function TaskPreviewRow({ item }: { item: SessionTodoItem }) {
  const Icon = STATUS_ICONS[item.status] || CircleDashed;
  const meta = TODO_STATUS_META[item.status];
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Icon
        className={`mt-0.5 h-3 w-3 flex-shrink-0 ${meta.textClass} ${
          item.status === "in_progress" ? "animate-spin" : ""
        }`}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 line-clamp-2 text-[10px] leading-4 text-gray-300">{item.text}</p>
      {item.agentType !== "main" && (
        <span className="max-w-20 truncate rounded bg-violet-500/10 px-1 py-0.5 text-[9px] text-violet-300">
          {item.agentType}
        </span>
      )}
    </div>
  );
}
