/**
 * @file SessionCard.tsx
 * @description Compact session card for the Kanban board's "Sessions" view.
 * Mirrors AgentCard's information hierarchy (icon · title · meta line) but
 * surfaces session-relevant fields: model, agent count, cost, last activity.
 * Clicking the card navigates to the session detail page. While a session is
 * Waiting, hovering the card lazily fetches the last thing Claude actually
 * said and shows it in a floating popup (portaled to `document.body`,
 * positioned off the card's own bounding rect) rendered through the same
 * markdown/code-block renderer used in the Conversation tab — the badge
 * alone tells you the session is blocked on you, not what it's blocked ON,
 * which is what you need to decide whether to act now. The popup never
 * resizes the card itself or reflows its neighbors.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/SessionCard.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `./StatusBadge`
 * - `../lib/types`
 * - `../lib/format`
 *
 * ## Public surface
 * - `SessionCard` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **SessionCard**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Bot, Clock, Coins, Cpu, Crosshair, MessageSquare } from "lucide-react";
import { SessionStatusBadge } from "./StatusBadge";
import { MarkdownContent } from "./conversation/MarkdownContent";
import { api } from "../lib/api";
import {
  effectiveSessionStatus,
  isSessionAwaitingInput,
  sessionAwaitingReason,
} from "../lib/types";
import type { Session, TranscriptMessage } from "../lib/types";
import {
  formatDuration,
  timeAgo,
  formatModelName,
  isExpensiveModel,
  pathTail,
} from "../lib/format";
import { useSessionFocus } from "../lib/focusStore";

/** Joins a transcript message's "text" content blocks (ignores thinking/tool_use/
 *  tool_result blocks — those aren't what Claude "said"). Empty string when the
 *  message carries no text block (e.g. a bare tool call). */
function messageText(message: TranscriptMessage): string {
  return message.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n\n")
    .trim();
}

interface SessionCardProps {
  session: Session;
  onClick?: () => void;
}

function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return "$0";
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(4)}`;
}

const PREVIEW_POPUP_MIN_WIDTH = 420;
// A hard ceiling, not a target - stays readable even on an ultrawide
// monitor. computePreviewPopupStyle further shrinks whatever width is
// requested to fit the actual viewport, so it never overflows the screen.
const PREVIEW_POPUP_MAX_WIDTH = 900;

/**
 * Widens the popup for content that would otherwise need a lot of vertical
 * scrolling at the base width - more width means fewer line-wraps, which
 * means less scrolling to read the same message. A rough heuristic (overall
 * length, and the single longest line for code blocks / dense text) rather
 * than an actual layout measurement, so there's no flash-of-relayout while
 * opening. Callers still clamp the result to the viewport.
 */
function estimatePreviewWidth(text: string): number {
  if (!text) return PREVIEW_POPUP_MIN_WIDTH;
  const longestLine = text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
  const byLength =
    text.length > 1400
      ? PREVIEW_POPUP_MAX_WIDTH
      : text.length > 700
        ? 700
        : PREVIEW_POPUP_MIN_WIDTH;
  const byLongestLine =
    longestLine > 110 ? PREVIEW_POPUP_MAX_WIDTH : longestLine > 70 ? 700 : PREVIEW_POPUP_MIN_WIDTH;
  return Math.max(byLength, byLongestLine);
}

/** Popup anchored off the hovered card's rect - flips to the card's left
 *  when it wouldn't fit on the right, and clamps both axes AND its own
 *  width/height to the current viewport (re-read on every open, so this is
 *  correct across resizes and orientation changes, not just at mount).
 *  Height is capped (not measured) so this needs no two-phase render: a
 *  short message just leaves empty space below within the box - width,
 *  though, is widened up front via `estimatePreviewWidth` so a long message
 *  needs less of that vertical scroll in the first place. */
function computePreviewPopupStyle(rect: DOMRect, targetWidth: number): React.CSSProperties {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const pad = 12;
  const width = Math.min(targetWidth, vw - pad * 2);
  const maxHeight = Math.min(vh - pad * 2, 560);

  let left = rect.right + pad;
  if (left + width > vw - pad) left = rect.left - width - pad;
  left = Math.min(Math.max(left, pad), Math.max(pad, vw - width - pad));

  let top = rect.top;
  if (top + maxHeight > vh - pad) top = Math.max(pad, vh - maxHeight - pad);

  return { position: "fixed", left, top, width, maxHeight, zIndex: 9999 };
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(["kanban", "plan"]);
  const isActive = session.status === "active";
  const isWaiting = isSessionAwaitingInput(session);
  const status = effectiveSessionStatus(session);
  const title = session.name?.trim() || t("session.anonymous");
  const agentCount = session.agent_count ?? 0;
  const model = formatModelName(session.model);
  const modelIsExpensive = isExpensiveModel(session.model);
  const lastActivity = session.last_activity || session.ended_at || session.started_at;

  // Declared focus breadcrumb (AGENT-PLAN.md item + detour chain). Read from
  // the shared focusStore — one bulk hydrate + WS merges, never a per-card
  // fetch. Elapsed time belongs to the deepest current segment: the top
  // detour when one is open, else the item itself. Timestamps (not a local
  // counter) drive the figure, so a delayed WS can never fake liveness.
  const focus = useSessionFocus(session.id);
  const focusTopDetour =
    focus && focus.detour_stack.length > 0
      ? focus.detour_stack[focus.detour_stack.length - 1]
      : undefined;
  const focusElapsedAnchor = focusTopDetour?.pushed_at ?? focus?.since ?? null;
  const focusTooltip = focus
    ? [
        focus.item_number != null
          ? `${t("plan:focus.itemLabel", { number: focus.item_number })}: ${focus.item_text ?? ""}`
          : null,
        ...focus.detour_stack.map((d) => `▸ ${d.description}`),
        focus.since ? t("plan:focus.since", { time: focus.since }) : null,
      ]
        .filter(Boolean)
        .join("\n")
    : undefined;

  // Last-said-by-Claude preview, fetched on demand the first time a Waiting
  // card is hovered - not fetched up front for every card (that's one
  // transcript read per session; only pay for it when actually looked at).
  // Rendered as a popup anchored off `cardRef`'s rect rather than expanding
  // the card itself - it never resizes the card or reflows its neighbors.
  const cardRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewFetchedRef = useRef(false);
  // Closing on a short delay (rather than instantly on mouseleave) gives the
  // pointer time to cross the gap from the card to the portaled popup - both
  // the card and the popup clear this timer on their own mouseenter, and
  // only actually close when the pointer has left BOTH for the full delay.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const fetchPreview = useCallback(() => {
    if (previewFetchedRef.current) return;
    previewFetchedRef.current = true;
    setPreviewLoading(true);
    api.sessions
      .transcript(session.id, { limit: 10 })
      .then((res) => {
        const lastAssistant = [...res.messages].reverse().find((m) => m.sender === "assistant");
        setPreviewText(lastAssistant ? messageText(lastAssistant) || null : null);
      })
      .catch(() => setPreviewText(null))
      .finally(() => setPreviewLoading(false));
  }, [session.id]);

  function handleClick() {
    if (onClick) onClick();
    else navigate(`/sessions/${session.id}`);
  }

  function handleMouseEnter() {
    clearCloseTimer();
    if (cardRef.current) setAnchorRect(cardRef.current.getBoundingClientRect());
    setShowPreview(true);
    if (isWaiting) fetchPreview();
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setShowPreview(false), 150);
  }

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={scheduleClose}
      className={`card-hover p-4 cursor-pointer animate-fade-in overflow-hidden ${
        isWaiting
          ? "border-l-2 border-l-yellow-500/60"
          : isActive
            ? "border-l-2 border-l-emerald-500/50"
            : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-accent/15 text-accent">
            <FolderOpen className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-gray-200 truncate">{title}</p>
            <p className="text-[11px] text-gray-500 font-mono truncate">
              {session.id.slice(0, 12)}
            </p>
          </div>
        </div>
        {/* compact: cards are narrow — inline reason chip would squeeze the
            title, so the reason stays hover-tooltip-only here. */}
        <SessionStatusBadge status={status} reason={sessionAwaitingReason(session)} compact />
      </div>

      {session.cwd && (
        <p
          className="text-xs text-gray-400 mb-3 truncate font-mono leading-relaxed"
          title={session.cwd}
        >
          {pathTail(session.cwd)}
        </p>
      )}

      {focus && focus.item_number != null && isActive && (
        <p
          className="flex items-center gap-1 text-[11px] mb-3 min-w-0 overflow-hidden whitespace-nowrap"
          title={focusTooltip}
        >
          <Crosshair className="w-3 h-3 text-gray-500 flex-shrink-0" />
          <span className="text-gray-400 truncate">
            {t("plan:focus.itemLabel", { number: focus.item_number })}
            {": "}
            {focus.item_text ?? t("plan:focus.unknownItem")}
          </span>
          {focus.detour_stack.map((d, i) => (
            <span
              key={`${d.pushed_at}-${i}`}
              className="min-w-0 truncate text-amber-400/90 flex-shrink"
            >
              <span aria-hidden="true" className="text-gray-600 mx-0.5">
                {"▸"}
              </span>
              {d.description}
            </span>
          ))}
          {focusElapsedAnchor && (
            <span className="text-gray-600 flex-shrink-0">
              ({formatDuration(focusElapsedAnchor, new Date().toISOString())})
            </span>
          )}
          {focus.drift === true && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              {t("plan:focus.drift")}
            </span>
          )}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-gray-500 min-w-0 overflow-hidden flex-wrap">
        <span className="flex items-center gap-1 flex-shrink-0">
          <Bot className="w-3 h-3" />
          {t("session.agentSummary", { count: agentCount })}
        </span>
        {model && (
          <span
            className={`flex items-center gap-1 flex-shrink-0 truncate ${
              modelIsExpensive ? "text-red-500 font-semibold" : ""
            }`}
            title={modelIsExpensive ? t("session.expensiveModel") : undefined}
          >
            <Cpu className="w-3 h-3" />
            <span className="truncate">{model}</span>
          </span>
        )}
        {typeof session.cost === "number" && session.cost > 0 && (
          <span className="flex items-center gap-1 flex-shrink-0">
            <Coins className="w-3 h-3" />
            {formatCost(session.cost)}
          </span>
        )}
        <span className="flex items-center gap-1 flex-shrink-0">
          <Clock className="w-3 h-3" />
          {session.ended_at
            ? `${t("ran")}${formatDuration(session.started_at, session.ended_at)}`
            : `${t("running")}${formatDuration(session.started_at, new Date().toISOString())}`}
        </span>
        <span className="text-gray-600 flex-shrink-0 ml-auto">
          {timeAgo(session.ended_at || lastActivity)}
        </span>
      </div>

      {isWaiting &&
        showPreview &&
        anchorRect &&
        createPortal(
          <div
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
            style={computePreviewPopupStyle(
              anchorRect,
              previewText ? estimatePreviewWidth(previewText) : PREVIEW_POPUP_MIN_WIDTH
            )}
            className="flex flex-col rounded-lg border border-border bg-surface-2 shadow-2xl overflow-hidden animate-fade-in"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/60 text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex-shrink-0">
              <MessageSquare className="w-3 h-3" />
              {t("session.lastMessage")}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
              {previewLoading ? (
                <p className="text-xs text-gray-500 italic">{t("session.lastMessageLoading")}</p>
              ) : previewText ? (
                <MarkdownContent text={previewText} dense />
              ) : (
                <p className="text-xs text-gray-500 italic">{t("session.lastMessageEmpty")}</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
