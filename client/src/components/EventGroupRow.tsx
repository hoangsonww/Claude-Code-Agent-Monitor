/**
 * @file EventGroupRow.tsx
 * @description Compact row that represents one EventGroup (one tool_use_id, or
 * a single standalone event). Shows a status progression of the underlying
 * events — e.g. 🟢 → 🔵 for a Pre/Post pair — plus tool name, summary, and
 * the wall-clock duration between first and last event. Clicking the chevron
 * expands the group inline to reveal each underlying event row.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ExternalLink } from "lucide-react";
import { AgentStatusBadge } from "./StatusBadge";
import { EventDetail } from "./EventDetail";
import { formatTime, timeAgo } from "../lib/format";
import {
  agentOriginLabel,
  buildEventTitle,
  buildGroupTitle,
  buildOriginLabel,
  formatGroupDuration,
  projectFromEvent,
  statusFromEventType,
} from "../lib/event-grouping";
import type { AgentInfo, EventGroup } from "../lib/event-grouping";

type EventGroupRowProps = {
  group: EventGroup;
  /** Called when the row's click area (time/summary) is activated. Allows
   *  callers to navigate to the session or do nothing. */
  onRowActivate?: () => void;
  /** Optional map of session_id → session name, used to render a session pill
   *  next to the row. Pass empty / omit to hide the pill. */
  sessionNameById?: Map<string, string>;
  /** Optional map of agent_id → AgentInfo, used to render a subagent pill
   *  showing the subagent_type (e.g. "frontend-reviewer") rather than the raw
   *  ID. Omit to fall back to a truncated ID label. */
  agentInfoById?: Map<string, AgentInfo>;
};

export function EventGroupRow({
  group,
  onRowActivate,
  sessionNameById,
  agentInfoById,
}: EventGroupRowProps) {
  const { t } = useTranslation("common");
  const { t: ta } = useTranslation("activity");
  const [expanded, setExpanded] = useState(false);
  const [expandedInner, setExpandedInner] = useState<Set<number>>(() => new Set());

  const statusSequence = dedupeConsecutive(
    group.events.map((e) => statusFromEventType(e.event_type))
  );
  const duration = formatGroupDuration(group.durationMs);
  // Every group is expandable — single-event groups show the EventDetail
  // directly; multi-event groups show a nested list where each event can be
  // expanded individually.
  const canExpand = group.events.length >= 1;
  const isSingleEvent = group.events.length === 1;

  function toggleInner(id: number) {
    setExpandedInner((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Multi-event groups (actual Pre/Post pairs, tool-call chains) get a subtle
  // teal left-border and tinted background so they're visually distinct from
  // standalone single-event rows at a glance.
  const isMultiGroup = !isSingleEvent;
  const rowBg = isMultiGroup
    ? "bg-teal-500/[0.04] hover:bg-teal-500/[0.08] border-l-2 border-teal-400/40"
    : "hover:bg-surface-4 border-l-2 border-transparent";

  return (
    <div>
      <div className={`flex items-center px-5 py-3 gap-4 transition-colors min-w-0 ${rowBg}`}>
        <button
          type="button"
          onClick={() => canExpand && setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse group" : "Expand group"}
          disabled={!canExpand}
          className={`p-1 rounded flex-shrink-0 -mr-3 ${
            canExpand ? "text-gray-500 hover:text-gray-200 cursor-pointer" : "text-transparent"
          }`}
        >
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>

        <div
          className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer"
          onClick={() => (onRowActivate ? onRowActivate() : canExpand && setExpanded((v) => !v))}
        >
          <div className="w-16 text-[11px] text-gray-500 font-mono flex-shrink-0 text-right">
            {formatTime(group.firstAt)}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {statusSequence.map((status, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-600 text-[10px]">→</span>}
                <AgentStatusBadge status={status} />
              </div>
            ))}
          </div>

          {(() => {
            const first = group.events[0];
            const sid = first?.session_id;
            const sname = sid ? sessionNameById?.get(sid) : undefined;
            const agentId = first?.agent_id ?? null;
            const project = first ? projectFromEvent(first) : null;
            const origin = buildOriginLabel(
              project,
              sname ?? null,
              agentOriginLabel(agentId, agentInfoById)
            );
            return (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 truncate">
                  {origin && (
                    <span className="text-gray-500 mr-1" title={`${sid ?? ""} · ${agentId ?? ""}`}>
                      {origin} ·
                    </span>
                  )}
                  {buildGroupTitle(group)}
                </p>
              </div>
            );
          })()}

          {group.tool_name && (
            <span className="text-[11px] px-2 py-0.5 bg-surface-2 rounded text-gray-500 font-mono flex-shrink-0">
              {group.tool_name}
            </span>
          )}

          {duration && (
            <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">{duration}</span>
          )}

          <span className="text-[11px] text-gray-600 flex-shrink-0 w-16 text-right">
            {timeAgo(group.firstAt)}
          </span>
        </div>

        {group.events[0]?.session_id && (
          <Link
            to={`/sessions/${group.events[0].session_id}`}
            onClick={(e) => e.stopPropagation()}
            title={ta("viewSession")}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-accent hover:bg-accent/10 border border-border hover:border-accent/30 transition-colors flex-shrink-0 font-medium"
          >
            {ta("viewSession")}
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {expanded && isSingleEvent && group.events[0] && (
        <EventDetail
          event={group.events[0]}
          agentInfoById={agentInfoById}
          sessionNameById={sessionNameById}
        />
      )}

      {expanded && !isSingleEvent && (
        <div className="bg-surface-2/40 border-t border-border divide-y divide-border">
          <div className="px-5 py-1.5 text-[10px] text-gray-600 uppercase tracking-wide">
            {t("eventFilters.groupEventCount", { count: group.events.length })}
          </div>
          {group.events.map((event) => {
            const innerOpen = event.id != null && expandedInner.has(event.id);
            return (
              <div key={event.id}>
                <button
                  type="button"
                  onClick={() => event.id != null && toggleInner(event.id)}
                  aria-expanded={innerOpen}
                  aria-label={innerOpen ? t("eventDetail.collapse") : t("eventDetail.expand")}
                  className="w-full text-left px-5 py-2 flex items-center gap-4 min-w-0 hover:bg-surface-3/60 transition-colors cursor-pointer"
                >
                  <span
                    className={`text-gray-500 text-[10px] w-3 flex-shrink-0 transition-transform ${innerOpen ? "rotate-90" : ""}`}
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <div className="w-16 text-[11px] text-gray-600 font-mono flex-shrink-0 text-right">
                    {formatTime(event.created_at)}
                  </div>
                  <AgentStatusBadge status={statusFromEventType(event.event_type)} />
                  <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">
                    {event.event_type}
                  </span>
                  <span className="text-[11px] text-gray-400 flex-1 truncate">
                    {buildEventTitle(event)}
                  </span>
                </button>
                {innerOpen && (
                  <EventDetail
                    event={event}
                    agentInfoById={agentInfoById}
                    sessionNameById={sessionNameById}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function dedupeConsecutive<T>(arr: T[]): T[] {
  const out: T[] = [];
  for (const item of arr) {
    if (out.length === 0 || out[out.length - 1] !== item) out.push(item);
  }
  return out;
}
