/**
 * @file SegmentEventsModal.tsx
 * @description Big popup listing the raw hook events recorded during one
 * calendar-block segment's real (unclipped) time window — opened by clicking
 * the small "</>" icon on a FocusCalendarView block. Exists so a segment's
 * attributed duration can be checked against what actually happened instead
 * of taken on faith: fetches `GET /api/events?session_id=&from=&to=` for
 * exactly that window, then groups the result into 10-minute buckets
 * (`bucketEvents()`, client/src/lib/eventBuckets.ts — same grain as the
 * calendar block's own active/idle chunk stripes) so the row count stays
 * bounded by how long the segment ran rather than by how many raw events it
 * produced — a busy 10-hour segment is at most ~60 bucket rows, not
 * thousands of individual PreToolUse/PostToolUse pairs. Each bucket row
 * shows a per-`event_type` count so the shape of what happened in that
 * window is visible before drilling in; expanding a bucket reveals its
 * actual events, each further expandable into the full hook payload via the
 * same EventDetail viewer the Activity Feed page uses. An inferred segment
 * can legitimately have no events at all inside its own window —
 * attribution came from the background classifier looking at nearby
 * activity, not from anything strictly between start and end — so the empty
 * state calls that out explicitly rather than reading as "nothing happened."
 * The header states both the raw wall-clock span and the idle-grace-
 * discounted active ("agent") time, since a long idle-tailed segment's
 * wall-clock figure alone can badly overstate how much was actually worked.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Code2, X } from "lucide-react";
import { api } from "../lib/api";
import { EventDetail } from "./EventDetail";
import { AgentStatusBadge } from "./StatusBadge";
import { buildEventTitle, statusFromEventType } from "../lib/event-grouping";
import { formatMs, getCurrentLocale, parseDate } from "../lib/format";
import { bucketEvents } from "../lib/eventBuckets";
import type { EventBucket } from "../lib/eventBuckets";
import type { DashboardEvent } from "../lib/types";

// The server clamps to 500 per page (MAX_LIMIT in server/routes/events.js) -
// a segment's own window is normally far short of that, but the truncation
// notice below covers the rare pathological case instead of silently
// dropping events.
const FETCH_LIMIT = 500;

/** HH:MM:SS — a segment's supporting events can land seconds apart, so the
 *  row list needs finer resolution than the app's usual minute-precision
 *  {@link formatTime}. Local to this file rather than added to format.ts
 *  since nothing else needs second-level display yet. */
function formatTimeSec(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleTimeString(getCurrentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export interface SegmentEventsModalProps {
  sessionId: string;
  sessionName: string | null;
  kindLabel: string;
  kindColor: string;
  label: string | null;
  /** Real (unclipped) segment bounds — not the day-clipped block coordinates,
   *  so the fetched window always matches the segment's actual duration even
   *  when the calendar block itself was visually cut at midnight. */
  realStart: string;
  realEnd: string;
  wallMs: number;
  /** Idle-grace-discounted active time, in ms — shown alongside wallMs so a
   *  long idle-tailed segment's header doesn't state only the raw span. */
  activeMs: number;
  inferred: boolean;
  inferredReason: string | null;
  onClose: () => void;
}

/**
 * Centered popup listing every raw event recorded in one segment's time
 * window, each expandable into the full hook payload.
 * @param props See {@link SegmentEventsModalProps}.
 */
export function SegmentEventsModal({
  sessionId,
  sessionName,
  kindLabel,
  kindColor,
  label,
  realStart,
  realEnd,
  wallMs,
  activeMs,
  inferred,
  inferredReason,
  onClose,
}: SegmentEventsModalProps) {
  const { t } = useTranslation("plan");
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Two independent expand levels: which 10-minute buckets are open, and
  // which individual events (inside whichever buckets are open) are further
  // expanded into their full EventDetail payload.
  const [expandedBuckets, setExpandedBuckets] = useState<Set<number>>(() => new Set());
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(() => new Set());

  const buckets = useMemo(() => bucketEvents(events), [events]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api.events
      .list({ session_id: sessionId, from: realStart, to: realEnd, limit: FETCH_LIMIT })
      .then((res) => {
        if (cancelled) return;
        // The server returns newest-first (its usual paging order); a
        // segment's supporting evidence reads naturally in the order it
        // actually happened.
        setEvents([...res.events].reverse());
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, realStart, realEnd]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function toggleSet(setter: Dispatch<SetStateAction<Set<number>>>, key: number) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div
      // z-[60]: this can open from inside FocusReportModal (z-50) - it needs
      // to sit above its own parent dialog rather than behind it.
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="segment-events-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[88vh] card shadow-2xl animate-slide-up overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-accent flex-shrink-0" />
              <h2
                id="segment-events-title"
                className="text-sm font-semibold text-gray-100 truncate"
              >
                {t("report.calendar.eventsModal.title")}
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 truncate">
              {sessionName?.trim() || sessionId.slice(0, 8)}
              {" — "}
              <span className={kindColor}>{kindLabel}</span>
              {label ? `: ${label}` : ""}
            </p>
            <p className="text-[11px] text-gray-500 mt-1 font-mono">
              {formatTimeSec(realStart)}–{formatTimeSec(realEnd)}
              {" · "}
              {t("report.calendar.wallClockLabel")}: {formatMs(wallMs)}
              {" · "}
              {t("report.calendar.activeLabel")}: {formatMs(activeMs)}
              {inferred && (
                <span className="ml-2 text-gray-400 italic font-sans">
                  ≈ {t("report.inferredNote")}
                  {inferredReason ? ` (${inferredReason})` : ""}
                </span>
              )}
            </p>
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

        <div className="overflow-y-auto flex-1 min-h-0">
          {loading && (
            <p className="text-xs text-gray-500 italic py-10 text-center">
              {t("report.calendar.eventsModal.loading")}
            </p>
          )}
          {!loading && failed && (
            <p className="text-xs text-rose-400 py-10 text-center">
              {t("report.calendar.eventsModal.error")}
            </p>
          )}
          {!loading && !failed && events.length === 0 && (
            <div className="py-10 text-center space-y-1.5 px-6">
              <p className="text-xs text-gray-500 italic">
                {t("report.calendar.eventsModal.empty")}
              </p>
              {inferred && (
                <p className="text-[11px] text-gray-600 max-w-md mx-auto">
                  {t("report.calendar.eventsModal.emptyInferred")}
                </p>
              )}
            </div>
          )}
          {!loading && !failed && events.length > 0 && (
            <div className="divide-y divide-border">
              {total > events.length && (
                <p className="px-5 py-2 text-[11px] text-gray-500 italic border-b border-border/60">
                  {t("report.calendar.eventsModal.truncated", {
                    shown: events.length,
                    total,
                  })}
                </p>
              )}
              {buckets.map((bucket) => (
                <BucketRow
                  key={bucket.bucketStartMs}
                  bucket={bucket}
                  isOpen={expandedBuckets.has(bucket.bucketStartMs)}
                  onToggle={() => toggleSet(setExpandedBuckets, bucket.bucketStartMs)}
                  expandedEvents={expandedEvents}
                  onToggleEvent={(id) => toggleSet(setExpandedEvents, id)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One 10-minute bucket's row, expanding into its individual events (each of
 *  which can further expand into the full EventDetail payload). */
function BucketRow({
  bucket,
  isOpen,
  onToggle,
  expandedEvents,
  onToggleEvent,
  t,
}: {
  bucket: EventBucket;
  isOpen: boolean;
  onToggle: () => void;
  expandedEvents: Set<number>;
  onToggleEvent: (id: number) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={isOpen}
        className="flex items-center px-5 py-3 gap-3 hover:bg-surface-4 transition-colors cursor-pointer select-none"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 text-gray-500 transition-transform flex-shrink-0 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
        <span className="w-32 flex-shrink-0 text-right text-[11px] text-gray-500 font-mono">
          {formatTimeSec(new Date(bucket.bucketStartMs).toISOString())}–
          {formatTimeSec(new Date(bucket.bucketEndMs).toISOString())}
        </span>
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
          {bucket.countsByType.map((c) => (
            <span
              key={c.eventType}
              className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-400 font-mono"
            >
              {c.eventType} <span className="text-gray-200 font-semibold">×{c.count}</span>
            </span>
          ))}
        </div>
        <span className="text-[11px] text-gray-500 flex-shrink-0">
          {t("report.calendar.eventsModal.bucketCount", { count: bucket.total })}
        </span>
      </div>
      {isOpen && (
        <div className="pl-8 bg-black/10 divide-y divide-border/60">
          {bucket.events.map((event) => {
            const eventOpen = expandedEvents.has(event.id);
            return (
              <div key={event.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleEvent(event.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleEvent(event.id);
                    }
                  }}
                  aria-expanded={eventOpen}
                  className="flex items-center px-5 py-2.5 gap-3 hover:bg-surface-4 transition-colors cursor-pointer select-none"
                >
                  <ChevronRight
                    className={`w-3 h-3 text-gray-500 transition-transform flex-shrink-0 ${
                      eventOpen ? "rotate-90" : ""
                    }`}
                  />
                  <span className="w-20 flex-shrink-0 text-right text-[11px] text-gray-500 font-mono">
                    {formatTimeSec(event.created_at)}
                  </span>
                  <AgentStatusBadge status={statusFromEventType(event.event_type)} />
                  <p className="flex-1 min-w-0 text-sm text-gray-300 truncate">
                    {buildEventTitle(event)}
                  </p>
                  {event.tool_name && (
                    <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
                      {event.tool_name}
                    </span>
                  )}
                </div>
                {eventOpen && <EventDetail event={event} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
