/**
 * @file FocusReportBody.tsx
 * @description The single implementation of "how a `FocusReport` renders" —
 * stat tiles, the List/Calendar toggle, and the list-style breakdown body —
 * extracted verbatim out of `FocusReportModal.tsx` (which owned all of this
 * inline until now) so a second consumer, the new cross-project
 * `FocusCalendarBoard` page, can reuse the exact same rendering instead of
 * copy-pasting it. This closes, prospectively, the same "one rendering
 * surface, two codepaths" defect shape this project fixed reactively earlier
 * today (`6e29722`) for the List/Calendar standing-template test.
 *
 * `FocusReportModal` and `FocusCalendarBoard` both consume `FocusReportBody`/
 * `FocusReportViewToggle` as-is — neither may copy-paste this JSX elsewhere.
 * See the "[standing template]"/"[board-mode extension of the standing
 * template]" tests in `FocusReportModal.test.tsx`, which pin that both
 * consumers render identical stat-tile numbers and idle-stripe geometry for
 * the same segment.
 *
 * Three additive, optional props exist for the board's cross-project use
 * case; two of them (`selectedDate`/`hideDateNav`) are still board-only:
 *  - `projectLabelForCwd` — threaded straight through to `FocusCalendarView`
 *    (calendar mode only). Originally board-only (to disambiguate concurrent
 *    same-named sessions from different projects), `FocusReportModal` now
 *    passes it too — a resolver that always returns its own already-known
 *    `projectName`, so a calendar block always shows which project a
 *    session belongs to, not just on the cross-project board.
 *  - `selectedDate` / `hideDateNav` — also threaded through to
 *    `FocusCalendarView` (calendar mode only), letting the board's own
 *    page-level day-nav (`TimePeriodPicker`) own the selected day instead of
 *    `FocusCalendarView`'s internal one, so there is exactly one day-nav
 *    control on the board page.
 *  - `concurrencyLabel` — DEC-6's aggregate-view relabel of the Concurrency
 *    stat tile (e.g. "Concurrent agent sessions" instead of the modal's
 *    per-project "Concurrency"), since the same `concurrency_ratio` number
 *    means cross-project overlap on the board rather than per-project
 *    multitasking. Omitted (the modal's case) keeps today's exact copy.
 *
 * The stat tiles scope themselves to `FocusCalendarView`'s hour-window zoom
 * (calendar mode, `hourWindow` state — see that file's header) via the
 * `onVisibleWindowChange` callback it fires whenever its own visible window
 * changes: `null` while unzoomed (or in list mode) keeps reading `report`'s
 * own totals unchanged, exactly as before this existed; a real window
 * recomputes them client-side from the report's already-fetched segment
 * chunks (`../lib/windowedTotals.ts`) so the tiles agree with what the
 * calendar is actually showing instead of always reflecting the full
 * fetched report (a whole day, or an even wider custom range) regardless of
 * zoom — previously the two could read wildly different numbers (e.g. a
 * multi-hour "Active time" total shown above a calendar zoomed to the last
 * 4 hours) with nothing on screen explaining why; `windowScopedNote` below
 * the grace note now says so explicitly whenever the tiles are windowed.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CalendarDays, List } from "lucide-react";
import { formatMs, parseDate } from "../lib/format";
import { FOCUS_KIND_CONFIG, FOCUS_KIND_SOLID } from "../lib/types";
import type { FocusKind, FocusKindTotals, FocusReport, FocusReportSegment } from "../lib/types";
import { idleStripesInRange } from "../lib/idleStripes";
import { computeWindowedTotals } from "../lib/windowedTotals";
import { FocusCalendarView } from "./FocusCalendarView";

export type ViewMode = "list" | "calendar";

export const ALL_KINDS: FocusKind[] = ["item", "detour", "feature", "bug"];

export interface FocusReportBodyProps {
  report: FocusReport;
  viewMode: ViewMode;
  /** Resolves a session's `cwd` to a project name/label, threaded straight
   *  through to `FocusCalendarView` when `viewMode === "calendar"` — see
   *  file header. Passed by both consumers today (the modal's own resolver
   *  always returns its single already-known project); optional so a bare
   *  `FocusCalendarView` consumer (or a test) without a resolver still
   *  renders, just without a project line on each block. */
  projectLabelForCwd?: (cwd: string | null) => string | undefined;
  /** Controlled day override, threaded through to `FocusCalendarView` when
   *  `viewMode === "calendar"` — see file header. Additive/optional. */
  selectedDate?: Date;
  /** Suppresses `FocusCalendarView`'s internal day-nav row when
   *  `viewMode === "calendar"` — see file header. Additive/optional,
   *  defaults to `false` (nav visible), matching today's exact modal
   *  rendering when omitted. */
  hideDateNav?: boolean;
  /** DEC-6's aggregate-view relabel of the Concurrency stat tile — see file
   *  header. Additive/optional; omitted (the modal's case) keeps the
   *  existing per-project "Concurrency" copy unchanged. */
  concurrencyLabel?: string;
}

/** The single implementation of a `FocusReport`'s rendered body: stat tiles
 *  plus either the list-style breakdown or `FocusCalendarView`'s swimlane
 *  day view, depending on `viewMode`. Both `FocusReportModal` and
 *  `FocusCalendarBoard` mount this directly. */
export function FocusReportBody({
  report,
  viewMode,
  projectLabelForCwd,
  selectedDate,
  hideDateNav,
  concurrencyLabel,
}: FocusReportBodyProps) {
  const { t } = useTranslation("plan");

  // Set by FocusCalendarView (calendar mode only) whenever its own
  // hour-window "zoom" is active, so the stat tiles below can be scoped to
  // match what the calendar is actually showing instead of always reflecting
  // the full fetched `report` regardless of zoom - see windowedTotals.ts.
  // `null` (the default, and calendar's own reset when unzoomed/unmounted)
  // falls back to `report`'s own totals, unchanged from before this existed.
  const [visibleWindow, setVisibleWindow] = useState<{ startMs: number; endMs: number } | null>(
    null
  );
  // Leaving calendar mode entirely (e.g. the List/Calendar toggle) must also
  // drop any stale zoom window - FocusCalendarView unmounting handles this
  // too (its own unmount effect), but that's an extra render tick behind a
  // synchronous viewMode change, so this covers the same instant instead.
  useEffect(() => {
    if (viewMode !== "calendar") setVisibleWindow(null);
  }, [viewMode]);

  if (report.sessions.length === 0) {
    return <p className="text-xs text-gray-500 italic py-6 text-center">{t("report.empty")}</p>;
  }

  const windowed = visibleWindow
    ? computeWindowedTotals(report, visibleWindow.startMs, visibleWindow.endMs)
    : null;
  const totals = windowed?.totals ?? report.totals;
  const wallClockMs = windowed?.wallClockMs ?? report.wall_clock_ms;
  const concurrencyRatio = windowed ? windowed.concurrencyRatio : report.concurrency_ratio;

  const onItemPct =
    totals.active_ms > 0 ? Math.round((totals.by_kind.item.active_ms / totals.active_ms) * 100) : 0;
  const graceLabel =
    report.idle_grace_seconds > 0
      ? formatMs(report.idle_grace_seconds * 1000)
      : t("report.graceDisabled");
  const concurrencyValue = concurrencyRatio != null ? `${concurrencyRatio.toFixed(2)}x` : "—";
  const windowHours = visibleWindow
    ? Math.round((visibleWindow.endMs - visibleWindow.startMs) / 3_600_000)
    : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <StatTile
          label={t("report.activeTime")}
          value={formatMs(totals.active_ms)}
          // wall_clock_ms (not totals.wall_ms) - the latter is a per-segment
          // sum that inflates with concurrency same as effort does, so it
          // can't answer "of how much calendar time" once sessions overlap.
          sub={t("report.ofWallClock", { total: formatMs(wallClockMs) })}
        />
        <StatTile
          label={concurrencyLabel ?? t("report.concurrency")}
          value={concurrencyValue}
          title={t("report.concurrencyTitle")}
        />
        <StatTile
          label={t("report.onItem")}
          value={`${onItemPct}%`}
          valueClassName="text-green-400"
        />
        <StatTile label={t("report.offPlan")} value={`${Math.max(0, 100 - onItemPct)}%`} />
        <StatTile label={t("report.idleExcluded")} value={formatMs(totals.idle_ms)} />
      </div>
      {report.idle_grace_seconds >= 0 && (
        <p className="text-[11px] text-gray-600 -mt-3">
          {t("report.graceNote", { grace: graceLabel })}
        </p>
      )}
      {windowHours != null && (
        <p className="text-[11px] text-gray-600 -mt-3">
          {t("report.windowScopedNote", { hours: windowHours })}
        </p>
      )}

      {viewMode === "calendar" ? (
        <FocusCalendarView
          report={report}
          projectLabelForCwd={projectLabelForCwd}
          selectedDate={selectedDate}
          hideDateNav={hideDateNav}
          onVisibleWindowChange={setVisibleWindow}
        />
      ) : (
        <ListView report={report} />
      )}
    </>
  );
}

/** The List/Calendar toggle button pair — extracted out of
 *  `FocusReportModal`'s header so both entry points render the identical
 *  control. Callers keep owning the guard condition for *whether* to render
 *  this at all (e.g. only once a report with sessions has loaded). */
export function FocusReportViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const { t } = useTranslation("plan");
  return (
    <div
      role="group"
      aria-label={t("report.viewList") + " / " + t("report.viewCalendar")}
      className="inline-flex items-center bg-surface-2 border border-border rounded-lg p-0.5 gap-0.5"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={viewMode === "list"}
        title={t("report.viewList")}
        className={`p-1.5 rounded-md transition-colors ${
          viewMode === "list"
            ? "bg-accent text-white"
            : "text-gray-400 hover:text-gray-200 hover:bg-surface-4"
        }`}
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange("calendar")}
        aria-pressed={viewMode === "calendar"}
        title={t("report.viewCalendar")}
        className={`p-1.5 rounded-md transition-colors ${
          viewMode === "calendar"
            ? "bg-accent text-white"
            : "text-gray-400 hover:text-gray-200 hover:bg-surface-4"
        }`}
      >
        <CalendarDays className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** The original list-style body: per-session breakdown, per-item rollup,
 *  project-wide split. Extracted so FocusReportBody can swap it for
 *  FocusCalendarView without duplicating the stat-tile/grace-note header
 *  that's shared between both view modes. */
function ListView({ report }: { report: FocusReport }) {
  const { t } = useTranslation("plan");

  return (
    <>
      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.sessionsHeading")}</h3>
        <div className="space-y-4">
          {report.sessions.map((session) => {
            const totalWallMs = session.segments.reduce((sum, seg) => sum + seg.wall_ms, 0);
            const totalActiveMs = session.segments.reduce((sum, seg) => sum + seg.active_ms, 0);
            const inferredSegment = session.segments.find((seg) => seg.inferred);
            const inferredTitle = inferredSegment?.inferred_reason
              ? `${t("report.inferredNote")}: ${inferredSegment.inferred_reason}`
              : t("report.inferredNote");
            return (
              <div key={session.session_id} className="space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="flex items-baseline gap-1.5 min-w-0">
                    <Link
                      to={`/sessions/${session.session_id}`}
                      draggable={false}
                      className="text-xs font-medium text-gray-200 hover:text-accent hover:underline truncate min-w-0"
                    >
                      {session.name?.trim() || session.session_id.slice(0, 8)}
                    </Link>
                    {inferredSegment && (
                      <span
                        title={inferredTitle}
                        className="text-[10px] px-1.5 py-px rounded border border-border text-gray-500 flex-shrink-0 cursor-default"
                      >
                        ≈ {t("report.inferred")}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 flex-shrink-0">
                    {totalActiveMs === totalWallMs ? (
                      formatMs(totalWallMs)
                    ) : (
                      <>
                        {t("report.wallClockLabel")} {formatMs(totalWallMs)}
                        {" · "}
                        {t("report.activeLabel")} {formatMs(totalActiveMs)}
                      </>
                    )}
                  </span>
                </div>
                {session.segments.length === 1 && session.segments[0] && (
                  <p className="text-[11px] text-gray-500 truncate">
                    {session.segments[0].kind === "item" && session.segments[0].item_number != null
                      ? t("focus.itemLabel", { number: session.segments[0].item_number })
                      : t(FOCUS_KIND_CONFIG[session.segments[0].kind].labelKey)}
                    {session.segments[0].label ? `: ${session.segments[0].label}` : ""}
                  </p>
                )}
                <SegmentedBar
                  segments={session.segments}
                  totalMs={totalWallMs}
                  height="h-5"
                  testId="segmented-bar-session"
                />
              </div>
            );
          })}
        </div>
      </section>

      {report.items.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.itemsHeading")}</h3>
          <div className="space-y-3">
            {report.items.map((item) => (
              <div key={`${item.cwd}-${item.item_number}`} className="space-y-1.5 min-w-0">
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="text-xs text-gray-300 truncate min-w-0">
                    <span className="font-mono text-gray-500 mr-1.5">
                      {t("focus.itemLabel", { number: item.item_number })}
                    </span>
                    {item.text ?? t("focus.unknownItem")}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 flex-shrink-0">
                    {formatMs(item.totals.active_ms)}
                  </span>
                </div>
                <SegmentedBar
                  segments={kindTotalsAsSegments(item.totals)}
                  totalMs={item.totals.active_ms}
                  height="h-3"
                  sizeField="active_ms"
                  testId="segmented-bar-item-rollup"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold text-gray-300 mb-3">{t("report.splitHeading")}</h3>
        <SegmentedBar
          segments={kindTotalsAsSegments(report.totals)}
          totalMs={report.totals.active_ms}
          height="h-6"
          sizeField="active_ms"
          testId="segmented-bar-project-split"
        />
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
          {ALL_KINDS.map((kind) => {
            const ms = report.totals.by_kind[kind].active_ms;
            if (ms <= 0) return null;
            const cfg = FOCUS_KIND_CONFIG[kind];
            return (
              <span key={kind} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${FOCUS_KIND_SOLID[kind]}`} />
                {t(cfg.labelKey)}
                <span className="font-mono text-gray-500">{formatMs(ms)}</span>
              </span>
            );
          })}
        </div>
      </section>
    </>
  );
}

function StatTile({
  label,
  value,
  sub,
  valueClassName,
  title,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
  /** Native hover tooltip for a tile whose meaning isn't self-evident from
   *  its label alone (e.g. what a bare "1.08x" ratio is actually of). */
  title?: string;
}) {
  return (
    <div className="bg-surface-1 px-3.5 py-3 flex flex-col gap-1 min-w-0" title={title}>
      <span className="text-[10.5px] text-gray-500 truncate">{label}</span>
      <span
        className={`font-mono text-lg font-semibold tabular-nums ${valueClassName ?? "text-gray-100"}`}
      >
        {value}
      </span>
      {sub && <span className="text-[10.5px] text-gray-600 truncate">{sub}</span>}
    </div>
  );
}

/** Reduces a per-kind totals object down to the pseudo-segment shape
 *  {@link SegmentedBar} renders, in the FocusKind's fixed display order.
 *  Kinds with zero active time are dropped so they don't render a 0-width
 *  sliver — these two aggregate bars are sized by `active_ms` (see
 *  `SegmentedBar`'s `sizeField` prop), not `wall_ms`, so the drop filter
 *  matches that basis. */
function kindTotalsAsSegments(
  totals: FocusKindTotals
): Pick<FocusReportSegment, "kind" | "wall_ms" | "active_ms" | "label">[] {
  return ALL_KINDS.map((kind) => ({
    kind,
    wall_ms: totals.by_kind[kind].wall_ms,
    active_ms: totals.by_kind[kind].active_ms,
    label: null,
  })).filter((s) => s.active_ms > 0);
}

/** A single horizontal bar divided into colored, width-proportional
 *  segments - shared by the per-session, per-item, and project-split
 *  views. Each segment's native `title` tooltip carries its kind, label
 *  (when one exists), duration, and — for an inferred segment — the
 *  classifier's own one-sentence justification (`inferred_reason`) when one
 *  was recorded, keeping hover detail without a custom-positioned popup.
 *
 *  `sizeField` (default `"wall_ms"`) picks which field sizes and labels each
 *  slice. The per-session bar keeps the default — its box represents the
 *  segment's real time span, so an idle-chunk overlay drawn inside it (via
 *  the shared `idleStripesInRange` helper, same treatment as
 *  FocusCalendarView's blocks) stays geometrically honest. The two
 *  aggregate bars (per-item rollup, project-wide split) pass
 *  `sizeField="active_ms"` instead: they have no single segment (and
 *  therefore no single `chunks` array) to attach a stripe overlay to, so
 *  they size by the already-idle-aware `active_ms` field directly rather
 *  than drawing an overlay on a wall_ms-sized box. */
function SegmentedBar({
  segments,
  totalMs,
  height,
  sizeField = "wall_ms",
  testId,
}: {
  segments: (Pick<FocusReportSegment, "kind" | "label" | "wall_ms" | "active_ms"> &
    Partial<
      Pick<FocusReportSegment, "inferred" | "inferred_reason" | "chunks" | "start" | "end">
    >)[];
  totalMs: number;
  height: string;
  sizeField?: "wall_ms" | "active_ms";
  testId?: string;
}) {
  const { t } = useTranslation("plan");
  if (totalMs <= 0 || segments.length === 0) {
    return <div className={`${height} rounded-md bg-surface-3`} data-testid={testId} />;
  }
  return (
    <div className={`flex ${height} rounded-md overflow-hidden bg-surface-3`} data-testid={testId}>
      {segments.map((seg, i) => {
        const sizeMs = seg[sizeField];
        const pct = (sizeMs / totalMs) * 100;
        if (pct <= 0) return null;
        const kindLabel = t(FOCUS_KIND_CONFIG[seg.kind].labelKey);
        const inferredSuffix = seg.inferred
          ? ` — ≈ ${t("report.inferred")}${seg.inferred_reason ? `: ${seg.inferred_reason}` : ""}`
          : "";
        const title = seg.label
          ? `${kindLabel}: ${seg.label} (${formatMs(sizeMs)})${inferredSuffix}`
          : `${kindLabel} (${formatMs(sizeMs)})${inferredSuffix}`;
        // Only the wall_ms-sized (per-session) bar ever draws an idle-stripe
        // overlay: it's the only one whose slice represents one real
        // segment's own time span (with its own `chunks`/`start`/`end`),
        // not an aggregated total across many segments' differently-shaped
        // grids.
        const idleStripes =
          sizeField === "wall_ms" && seg.start != null && seg.end != null
            ? idleStripesInRange(
                seg.chunks,
                parseDate(seg.start).getTime(),
                parseDate(seg.end).getTime()
              )
            : [];
        return (
          <div
            key={i}
            data-kind={seg.kind}
            className={`relative ${FOCUS_KIND_SOLID[seg.kind]} ${
              i > 0 ? "border-l-2 border-surface-1" : ""
            }`}
            style={{ width: `${pct}%` }}
            title={title}
          >
            {idleStripes.map((stripe, si) => (
              <div
                key={si}
                data-testid="idle-stripe"
                className="absolute inset-y-0 bg-stone-100/60"
                style={{ left: `${stripe.offsetPct}%`, width: `${stripe.spanPct}%` }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
