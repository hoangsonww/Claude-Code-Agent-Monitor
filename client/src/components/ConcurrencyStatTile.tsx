/**
 * @file ConcurrencyStatTile.tsx
 * @description The Concurrency stat tile shared by `FocusReportBody` (the
 * per-project modal and the cross-project Calendar board) and `FocusPage` —
 * extracted so the primary/secondary ratio swap below lives in exactly one
 * place instead of three call sites. Renders BOTH concurrency figures at
 * once: one as the tile's big value — with its own denominator total right
 * beneath it ("of X active time" / "of X open-session time", the total the
 * big ratio is actually a ratio OF) — and the other ratio as a second
 * sub-line ("Nx while active" / "Nx across open sessions"), with a small
 * swap button on the label row that inverts which is which. The tooltip
 * always describes whichever ratio is currently primary.
 *
 * The chosen primary ("open" — today's default and the pre-existing
 * behavior — or "active") persists in `localStorage` under
 * `agent-monitor-concurrency-primary` (same per-browser convention as the
 * sidebar collapse and update-dismissal keys), so the preference survives a
 * refresh. Storage reads/writes are try/catch-guarded: with storage
 * unavailable (private mode) the tile still works, it just forgets the
 * choice on reload.
 *
 * A `null`/absent ratio renders as "—" when primary and simply omits the
 * sub-line when secondary (e.g. a report from a server that predates
 * `active_concurrency_ratio`); the swap button stays either way, so the
 * preference can still be set for reports that do carry both.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeftRight } from "lucide-react";
import { formatMs } from "../lib/format";
import { StatTile } from "./StatTile";

/** `localStorage` key for the persisted primary-ratio choice. Exported for
 *  tests (cleanup between cases). */
export const CONCURRENCY_PRIMARY_KEY = "agent-monitor-concurrency-primary";

type ConcurrencyPrimary = "open" | "active";

function loadPrimary(): ConcurrencyPrimary {
  try {
    return localStorage.getItem(CONCURRENCY_PRIMARY_KEY) === "active" ? "active" : "open";
  } catch {
    return "open";
  }
}

export interface ConcurrencyStatTileProps {
  /** Effort ÷ open-session wall-clock (`concurrency_ratio`), `null` when
   *  there's nothing to divide by. */
  concurrencyRatio: number | null;
  /** Effort ÷ active wall-clock (`active_concurrency_ratio`), `null` when
   *  absent (older server) or zero active time. */
  activeConcurrencyRatio: number | null;
  /** Open-session wall-clock total (`wall_clock_ms`) — shown as "of X
   *  open-session time" while the open ratio is primary. `null`/omitted
   *  hides that line. */
  wallClockMs?: number | null;
  /** Active wall-clock total (`active_wall_clock_ms`) — shown as "of X
   *  active time" while the active ratio is primary. `null`/omitted (older
   *  server) hides that line. */
  activeWallClockMs?: number | null;
  /** Label override — the Calendar board's DEC-6 "Concurrent agent sessions"
   *  relabel. Omitted, the standard "Concurrency" label renders. The label
   *  never changes with the swap; the value/sub/tooltip carry the semantics. */
  label?: string;
}

/** The Concurrency stat tile with its persistent primary-ratio swap — see
 *  file header. */
export function ConcurrencyStatTile({
  concurrencyRatio,
  activeConcurrencyRatio,
  wallClockMs,
  activeWallClockMs,
  label,
}: ConcurrencyStatTileProps) {
  const { t } = useTranslation("plan");
  const [primary, setPrimary] = useState<ConcurrencyPrimary>(loadPrimary);

  const toggle = () => {
    setPrimary((prev) => {
      const next: ConcurrencyPrimary = prev === "open" ? "active" : "open";
      try {
        localStorage.setItem(CONCURRENCY_PRIMARY_KEY, next);
      } catch {
        /* storage unavailable - the choice just won't survive a reload */
      }
      return next;
    });
  };

  const activeIsPrimary = primary === "active";
  const primaryRatio = activeIsPrimary ? activeConcurrencyRatio : concurrencyRatio;
  const secondaryRatio = activeIsPrimary ? concurrencyRatio : activeConcurrencyRatio;
  const secondarySubKey = activeIsPrimary
    ? "report.openConcurrencySub"
    : "report.activeConcurrencySub";
  // The primary ratio's own denominator, as a "of X ... time" line right
  // under the value - the total the big number is actually a ratio OF.
  const primaryDenominatorMs = activeIsPrimary ? activeWallClockMs : wallClockMs;
  const primaryTimeKey = activeIsPrimary ? "report.ofActiveTime" : "report.ofOpenSessionsTime";

  return (
    <StatTile
      label={label ?? t("report.concurrency")}
      value={primaryRatio != null ? `${primaryRatio.toFixed(2)}x` : "—"}
      sub={
        primaryDenominatorMs != null
          ? t(primaryTimeKey, { total: formatMs(primaryDenominatorMs) })
          : undefined
      }
      sub2={
        secondaryRatio != null
          ? t(secondarySubKey, { ratio: secondaryRatio.toFixed(2) })
          : undefined
      }
      title={activeIsPrimary ? t("report.activeConcurrencyTitle") : t("report.concurrencyTitle")}
      action={
        <button
          type="button"
          onClick={toggle}
          aria-label={t("report.concurrencyToggle")}
          title={t("report.concurrencyToggle")}
          className="shrink-0 text-gray-600 hover:text-gray-300 transition-colors"
        >
          {/* Sized via the prop, not `w-3 h-3` utility classes - tests (and
              potentially styles) select the report's bars structurally by
              `.h-3`/`.h-6`, and a class-sized icon here would collide. */}
          <ArrowLeftRight size={12} />
        </button>
      }
    />
  );
}
