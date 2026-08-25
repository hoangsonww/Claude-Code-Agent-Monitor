/**
 * @file AlertsNotifications.tsx
 * @description Unified "Alerts" control center embedded in the Settings page
 * (replaces the standalone /alerts route). A segmented tab UI
 * combines three concerns that used to be split across a page and a panel:
 *   • Rules    - define what conditions trigger an alert, with a read-only
 *                preview that backtests a draft rule before it is saved
 *   • Channels - webhook targets that receive fired alerts (Slack/Discord/…)
 *   • Activity - the live fired-alert feed with acknowledge controls
 * Tab badges reflect live state (rule count, unacked alert count), and the feed
 * + counts refetch on alert_triggered / alert_updated WebSocket messages.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/AlertsNotifications.tsx`
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
 * - `../lib/api`
 * - `../lib/eventBus`
 * - `./EmptyState`
 * - `./Skeleton`
 * - `./WebhookSettings`
 * - `./ConfirmModal`
 * - `./Checkbox`
 * - `./FieldHelp`
 * - `../lib/format`
 * - `../lib/types`
 *
 * ## Public surface
 * - `AlertsNotifications` — exported API; see TSDoc on the symbol for behavior.
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
 * **AlertsNotifications**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  BellRing,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  FlaskConical,
  ListChecks,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";
import { WebhookSettings } from "./WebhookSettings";
import { ConfirmModal } from "./ConfirmModal";
import { Checkbox } from "./Checkbox";
import { FieldHelp } from "./FieldHelp";
import { timeAgo } from "../lib/format";
import type {
  AlertEvent,
  AlertRule,
  AlertRulePreview,
  AlertRuleType,
  WSMessage,
} from "../lib/types";

const PAGE_SIZE = 25;

// Example values surfaced in the field-help tooltips so users know what to type.
// These are the Claude Code hook event types and common built-in tool names.
const EVENT_TYPE_EXAMPLES = [
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "SubagentStop",
  "Notification",
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
];
const TOOL_NAME_EXAMPLES = [
  "Bash",
  "Read",
  "Edit",
  "Write",
  "Grep",
  "Glob",
  "Task",
  "WebFetch",
  "WebSearch",
  "TodoWrite",
];
const SUMMARY_EXAMPLES = ["error", "permission", "timeout", "rate limit", "denied"];

const RULE_TYPES: AlertRuleType[] = [
  "event_pattern",
  "inactivity",
  "status_duration",
  "token_threshold",
];

type TabKey = "rules" | "channels" | "activity";

interface RuleFormState {
  name: string;
  rule_type: AlertRuleType;
  event_type: string;
  tool_name: string;
  summary_contains: string;
  count: string;
  window_minutes: string;
  minutes: string;
  status: "working" | "waiting";
  total_tokens: string;
  cooldown_seconds: string;
}

const EMPTY_FORM: RuleFormState = {
  name: "",
  rule_type: "event_pattern",
  event_type: "",
  tool_name: "",
  summary_contains: "",
  count: "1",
  window_minutes: "5",
  minutes: "10",
  status: "working",
  total_tokens: "1000000",
  cooldown_seconds: "300",
};

function buildConfig(form: RuleFormState): AlertRule["config"] {
  switch (form.rule_type) {
    case "event_pattern": {
      const config: AlertRule["config"] = {};
      if (form.event_type.trim()) config.event_type = form.event_type.trim();
      if (form.tool_name.trim()) config.tool_name = form.tool_name.trim();
      if (form.summary_contains.trim()) config.summary_contains = form.summary_contains.trim();
      const count = parseInt(form.count, 10);
      config.count = Number.isFinite(count) && count > 0 ? count : 1;
      if (config.count > 1) {
        const window = parseFloat(form.window_minutes);
        config.window_minutes = Number.isFinite(window) && window > 0 ? window : 5;
      }
      return config;
    }
    case "inactivity":
      return { minutes: parseFloat(form.minutes) };
    case "status_duration":
      return { status: form.status, minutes: parseFloat(form.minutes) };
    case "token_threshold":
      return { total_tokens: parseInt(form.total_tokens, 10) };
  }
}

function describeRule(rule: AlertRule, t: (key: string, opts?: Record<string, unknown>) => string) {
  const c = rule.config;
  switch (rule.rule_type) {
    case "event_pattern": {
      const parts = [
        c.event_type && `event=${c.event_type}`,
        c.tool_name && `tool=${c.tool_name}`,
        c.summary_contains && `summary~"${c.summary_contains}"`,
      ].filter(Boolean);
      const base = parts.join(" · ");
      return (c.count ?? 1) > 1
        ? t("ruleDesc.eventPatternCount", {
            pattern: base,
            count: c.count,
            window: c.window_minutes,
          })
        : t("ruleDesc.eventPattern", { pattern: base });
    }
    case "inactivity":
      return t("ruleDesc.inactivity", { minutes: c.minutes });
    case "status_duration":
      return t("ruleDesc.statusDuration", { status: c.status, minutes: c.minutes });
    case "token_threshold":
      return t("ruleDesc.tokenThreshold", { tokens: (c.total_tokens ?? 0).toLocaleString() });
  }
}

export function AlertsNotifications() {
  const { t } = useTranslation("alerts");
  const { t: ts } = useTranslation("settings");

  const [tab, setTab] = useState<TabKey>("rules");

  // Rules
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRule, setConfirmRule] = useState<AlertRule | null>(null);
  // Draft-rule backtest. Kept alongside the form (not inside it) so editing any
  // field can invalidate a stale result rather than leaving numbers on screen
  // that no longer describe what the form now says.
  const [preview, setPreview] = useState<AlertRulePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewLookback, setPreviewLookback] = useState(24);
  // Monotonic id for the in-flight preview request. Editing the form clears the
  // result, but a response already on the wire would otherwise land afterwards
  // and repopulate the panel with numbers describing the *previous* draft. Only
  // the response whose id still matches is applied.
  const previewRequestId = useRef(0);

  // Feed
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [unacked, setUnacked] = useState(0);
  const [unackedOnly, setUnackedOnly] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await api.alerts.rules.list();
      setRules(res.rules);
    } catch (err) {
      console.error("Failed to load alert rules:", err);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await api.alerts.list({
        unacked: unackedOnly || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setAlerts(res.alerts);
      setTotal(res.total);
      setUnacked(res.unacked);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoadingAlerts(false);
    }
  }, [unackedOnly]);

  const loadMore = useCallback(async () => {
    try {
      const res = await api.alerts.list({
        unacked: unackedOnly || undefined,
        limit: PAGE_SIZE,
        offset: alerts.length,
      });
      setAlerts((prev) => [...prev, ...res.alerts]);
      setTotal(res.total);
      setUnacked(res.unacked);
    } catch (err) {
      console.error("Failed to load more alerts:", err);
    }
  }, [unackedOnly, alerts.length]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Live updates: any fired/acked alert refreshes the feed + counts regardless
  // of which tab is open, so the Activity badge stays accurate.
  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "alert_triggered" || msg.type === "alert_updated") {
        loadAlerts();
      }
    });
  }, [loadAlerts]);

  const set = (patch: Partial<RuleFormState>) => {
    // Invalidate any in-flight preview along with the displayed one.
    previewRequestId.current += 1;
    setPreview(null);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const onPreviewRule = async () => {
    if (previewing) return;
    const requestId = ++previewRequestId.current;
    setPreviewing(true);
    setFormError(null);
    try {
      const cooldown = parseInt(form.cooldown_seconds, 10);
      const res = await api.alerts.rules.preview({
        name: form.name.trim() || undefined,
        rule_type: form.rule_type,
        config: buildConfig(form),
        lookback_hours: previewLookback,
        cooldown_seconds: Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : 300,
      });
      if (previewRequestId.current !== requestId) return; // superseded — drop it
      setPreview(res.preview);
    } catch (err) {
      if (previewRequestId.current !== requestId) return;
      setPreview(null);
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      if (previewRequestId.current === requestId) setPreviewing(false);
    }
  };

  const onCreateRule = async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const cooldown = parseInt(form.cooldown_seconds, 10);
      await api.alerts.rules.create({
        name: form.name.trim(),
        rule_type: form.rule_type,
        config: buildConfig(form),
        cooldown_seconds: Number.isFinite(cooldown) && cooldown >= 0 ? cooldown : 300,
      });
      setForm(EMPTY_FORM);
      previewRequestId.current += 1;
      setPreview(null);
      setFormOpen(false);
      loadRules();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onToggleRule = async (rule: AlertRule) => {
    try {
      await api.alerts.rules.update(rule.id, { enabled: !rule.enabled });
      loadRules();
    } catch (err) {
      console.error("Failed to toggle alert rule:", err);
    }
  };

  const onDeleteRule = async (rule: AlertRule) => {
    try {
      await api.alerts.rules.remove(rule.id);
      setConfirmRule(null);
      loadRules();
      loadAlerts();
    } catch (err) {
      console.error("Failed to delete alert rule:", err);
    }
  };

  const onAck = async (id: number) => {
    try {
      await api.alerts.ack(id);
      loadAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const onAckAll = async () => {
    try {
      await api.alerts.ackAll();
      loadAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alerts:", err);
    }
  };

  // Mirror the server-side validation so obviously invalid rules never make it
  // to a request.
  const minutesVal = parseFloat(form.minutes);
  const tokensVal = parseInt(form.total_tokens, 10);
  const countVal = parseInt(form.count, 10);
  const windowVal = parseFloat(form.window_minutes);
  // The rule config alone — a preview does not need a name, only a valid shape.
  const configValid =
    (form.rule_type !== "event_pattern" ||
      (Boolean(form.event_type.trim() || form.tool_name.trim() || form.summary_contains.trim()) &&
        Number.isFinite(countVal) &&
        countVal > 0 &&
        (countVal <= 1 || (Number.isFinite(windowVal) && windowVal > 0)))) &&
    ((form.rule_type !== "inactivity" && form.rule_type !== "status_duration") ||
      (Number.isFinite(minutesVal) && minutesVal > 0)) &&
    (form.rule_type !== "token_threshold" || (Number.isFinite(tokensVal) && tokensVal > 0));
  const canSubmit = form.name.trim().length > 0 && configValid;

  const TABS: { key: TabKey; label: string; icon: typeof ListChecks; badge?: number }[] = [
    {
      key: "rules",
      label: ts("alertsHub.tabRules"),
      icon: ListChecks,
      badge: rules.length || undefined,
    },
    { key: "channels", label: ts("alertsHub.tabChannels"), icon: Webhook },
    {
      key: "activity",
      label: ts("alertsHub.tabActivity"),
      icon: BellRing,
      badge: unacked || undefined,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Segmented tab control */}
      <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface-2 p-1 gap-1">
        {TABS.map((tb) => {
          const active = tab === tb.key;
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`inline-flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors ${
                active
                  ? "bg-surface-4 text-gray-100 shadow-sm"
                  : "text-gray-500 hover:text-gray-300 hover:bg-surface-3"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tb.label}
              {tb.badge != null && (
                <span
                  className={`text-[10px] font-semibold rounded-full px-1.5 min-w-[18px] text-center ${
                    tb.key === "activity"
                      ? "text-amber-300 bg-amber-500/15"
                      : active
                        ? "text-accent bg-accent/15"
                        : "text-gray-400 bg-surface-2"
                  }`}
                >
                  {tb.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── RULES ── */}
      {tab === "rules" && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-200">{t("rules.title")}</h4>
              <p className="text-xs text-gray-500 mt-0.5">{ts("alertsHub.rulesHint")}</p>
            </div>
            <button
              onClick={() => {
                setFormOpen((open) => !open);
                setFormError(null);
                previewRequestId.current += 1;
                setPreview(null);
              }}
              className="btn-ghost border border-border inline-flex items-center gap-1.5 text-xs flex-shrink-0"
            >
              {formOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {formOpen ? t("rules.cancel") : t("rules.add")}
            </button>
          </div>

          {formOpen && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 mb-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    {t("rules.form.name")}
                    <FieldHelp description={t("rules.help.name")} />
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder={t("rules.form.namePlaceholder")}
                    className="input mt-1 w-full"
                  />
                </label>
                <label className="block text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    {t("rules.form.type")}
                    <FieldHelp title={t("rules.form.type")} description={t("rules.help.type")} />
                  </span>
                  <div className="relative mt-1">
                    <select
                      value={form.rule_type}
                      onChange={(e) => set({ rule_type: e.target.value as AlertRuleType })}
                      className="input w-full appearance-none pr-8"
                    >
                      {RULE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`ruleTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </label>
              </div>

              <p className="text-[11px] text-gray-500">{t(`ruleTypeHints.${form.rule_type}`)}</p>

              {form.rule_type === "event_pattern" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {t("rules.form.eventType")}
                      <FieldHelp
                        title={t("rules.form.eventType")}
                        description={t("rules.help.eventType")}
                        examples={EVENT_TYPE_EXAMPLES}
                      />
                    </span>
                    <input
                      type="text"
                      value={form.event_type}
                      onChange={(e) => set({ event_type: e.target.value })}
                      placeholder="PostToolUse"
                      className="input mt-1 w-full"
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {t("rules.form.toolName")}
                      <FieldHelp
                        title={t("rules.form.toolName")}
                        description={t("rules.help.toolName")}
                        examples={TOOL_NAME_EXAMPLES}
                      />
                    </span>
                    <input
                      type="text"
                      value={form.tool_name}
                      onChange={(e) => set({ tool_name: e.target.value })}
                      placeholder="Bash"
                      className="input mt-1 w-full"
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {t("rules.form.summaryContains")}
                      <FieldHelp
                        title={t("rules.form.summaryContains")}
                        description={t("rules.help.summaryContains")}
                        examples={SUMMARY_EXAMPLES}
                      />
                    </span>
                    <input
                      type="text"
                      value={form.summary_contains}
                      onChange={(e) => set({ summary_contains: e.target.value })}
                      placeholder="error"
                      className="input mt-1 w-full"
                    />
                  </label>
                  <label className="block text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {t("rules.form.count")}
                      <FieldHelp description={t("rules.help.count")} />
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.count}
                      onChange={(e) => set({ count: e.target.value })}
                      className="input mt-1 w-full"
                    />
                  </label>
                  {parseInt(form.count, 10) > 1 && (
                    <label className="block text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        {t("rules.form.windowMinutes")}
                        <FieldHelp description={t("rules.help.window")} />
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={form.window_minutes}
                        onChange={(e) => set({ window_minutes: e.target.value })}
                        className="input mt-1 w-full"
                      />
                    </label>
                  )}
                </div>
              )}

              {(form.rule_type === "inactivity" || form.rule_type === "status_duration") && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {form.rule_type === "status_duration" && (
                    <label className="block text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        {t("rules.form.agentStatus")}
                        <FieldHelp description={t("rules.help.status")} />
                      </span>
                      <div className="relative mt-1">
                        <select
                          value={form.status}
                          onChange={(e) => set({ status: e.target.value as "working" | "waiting" })}
                          className="input w-full appearance-none pr-8"
                        >
                          <option value="working">working</option>
                          <option value="waiting">waiting</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                      </div>
                    </label>
                  )}
                  <label className="block text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {t("rules.form.minutes")}
                      <FieldHelp
                        description={t(
                          form.rule_type === "inactivity"
                            ? "rules.help.minutesInactivity"
                            : "rules.help.minutesStatus"
                        )}
                      />
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.minutes}
                      onChange={(e) => set({ minutes: e.target.value })}
                      className="input mt-1 w-full"
                    />
                  </label>
                </div>
              )}

              {form.rule_type === "token_threshold" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      {t("rules.form.totalTokens")}
                      <FieldHelp description={t("rules.help.totalTokens")} />
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={form.total_tokens}
                      onChange={(e) => set({ total_tokens: e.target.value })}
                      className="input mt-1 w-full"
                    />
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="block text-xs text-gray-400">
                  <span className="mb-1.5 flex items-center gap-1">
                    {t("rules.form.cooldown")}
                    <FieldHelp description={t("rules.help.cooldown")} />
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={form.cooldown_seconds}
                    onChange={(e) => set({ cooldown_seconds: e.target.value })}
                    className="input w-40"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block text-xs text-gray-400">
                    <span className="mb-1.5 flex items-center gap-1">
                      {t("rules.preview.lookback")}
                      <FieldHelp description={t("rules.preview.help")} />
                    </span>
                    <select
                      value={previewLookback}
                      onChange={(e) => {
                        previewRequestId.current += 1;
                        setPreviewLookback(Number(e.target.value));
                        setPreview(null);
                      }}
                      className="input w-28"
                    >
                      {[1, 6, 24, 72, 168].map((hours) => (
                        <option key={hours} value={hours}>
                          {t("rules.preview.lookbackHours", { hours })}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={onPreviewRule}
                    disabled={!configValid || previewing}
                    className="btn-ghost border border-border inline-flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    {previewing ? t("rules.preview.running") : t("rules.preview.button")}
                  </button>
                  <button
                    onClick={onCreateRule}
                    disabled={!canSubmit || saving}
                    className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {saving ? t("rules.saving") : t("rules.create")}
                  </button>
                </div>
              </div>

              {preview && (
                <div className="rounded-lg border border-border bg-surface-3 p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-xs font-semibold text-gray-200">
                      {t("rules.preview.title")}
                    </span>
                    <span className="text-xs text-gray-400">
                      {t("rules.preview.wouldFire")}{" "}
                      <strong
                        className={preview.would_fire_count > 0 ? "text-accent" : "text-gray-300"}
                      >
                        {preview.would_fire_count}
                      </strong>
                    </span>
                    <span className="text-xs text-gray-500">
                      {t("rules.preview.matched")} {preview.matched_count}
                    </span>
                    {preview.suppressed_by_cooldown > 0 && (
                      <span className="text-xs text-gray-500">
                        {t("rules.preview.suppressed")} {preview.suppressed_by_cooldown}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-500">
                    {preview.evaluated === "history"
                      ? t("rules.preview.history", { hours: preview.lookback_hours })
                      : preview.candidate_window_hours != null
                        ? t("rules.preview.currentStateTokens", {
                            hours: preview.candidate_window_hours,
                          })
                        : t("rules.preview.currentState")}
                    {preview.truncated ? ` ${t("rules.preview.truncated")}` : ""}
                  </p>

                  {preview.samples.length === 0 ? (
                    <p className="text-xs text-gray-500">{t("rules.preview.none")}</p>
                  ) : (
                    <ul className="space-y-1 max-h-48 overflow-y-auto">
                      {preview.samples.map((sample, i) => (
                        <li
                          key={`${sample.session_id}-${sample.triggered_at ?? i}`}
                          className="text-[11px] text-gray-400 border-l-2 border-border pl-2"
                        >
                          <span className="text-gray-300">{sample.message}</span>
                          {sample.triggered_at && (
                            <span className="text-gray-600"> · {timeAgo(sample.triggered_at)}</span>
                          )}
                        </li>
                      ))}
                      {preview.would_fire_count > preview.samples.length && (
                        <li className="text-[11px] text-gray-600 pl-2">
                          {t("rules.preview.more", {
                            extra: preview.would_fire_count - preview.samples.length,
                          })}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {formError && <p className="text-xs text-red-400">{formError}</p>}
            </div>
          )}

          {loadingRules ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title={t("rules.empty")}
              description={ts("alertsHub.rulesEmptyHint")}
            />
          ) : (
            <ul className="space-y-2">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium truncate ${rule.enabled ? "text-gray-200" : "text-gray-500 line-through"}`}
                      >
                        {rule.name}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5 flex-shrink-0">
                        {t(`ruleTypes.${rule.rule_type}`)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {describeRule(rule, t)} ·{" "}
                      {t("rules.cooldown", { seconds: rule.cooldown_seconds })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => onToggleRule(rule)}
                      className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                        rule.enabled
                          ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          : "border-border text-gray-500 hover:text-gray-300 hover:bg-surface-3"
                      }`}
                      title={rule.enabled ? t("rules.disable") : t("rules.enable")}
                    >
                      {rule.enabled ? t("rules.enabled") : t("rules.disabled")}
                    </button>
                    <button
                      onClick={() => setConfirmRule(rule)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t("rules.delete")}
                      aria-label={t("rules.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── CHANNELS (webhooks) ── */}
      {tab === "channels" && <WebhookSettings />}

      {/* ── ACTIVITY (fired-alert feed) ── */}
      {tab === "activity" && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-semibold text-gray-200">
              {t("feed.title")}
              {unacked > 0 && (
                <span className="ml-2 text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
                  {t("feed.unackedCount", { count: unacked })}
                </span>
              )}
            </h4>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={unackedOnly}
                onChange={setUnackedOnly}
                label={t("feed.unackedOnly")}
              />
              <button
                onClick={() => loadAlerts()}
                className="btn-ghost border border-border inline-flex items-center gap-1.5 text-xs"
                title={t("refresh")}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {unacked > 0 && (
                <button
                  onClick={onAckAll}
                  className="btn-primary inline-flex items-center gap-1.5 text-xs"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {t("ackAll", { count: unacked })}
                </button>
              )}
            </div>
          </div>

          {loadingAlerts && alerts.length === 0 ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={unackedOnly ? BellOff : BellRing}
              title={t("feed.emptyTitle")}
              description={unackedOnly ? t("feed.emptyUnacked") : t("feed.emptyDescription")}
            />
          ) : (
            <>
              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                      alert.acknowledged_at
                        ? "border-border bg-surface-2 opacity-70"
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <BellRing
                          className={`w-3.5 h-3.5 flex-shrink-0 ${alert.acknowledged_at ? "text-gray-500" : "text-amber-400"}`}
                        />
                        <span className="text-sm text-gray-200 truncate">{alert.message}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                        {timeAgo(alert.triggered_at)} · {alert.rule_name}
                        {alert.session_id && (
                          <>
                            {" · "}
                            <Link
                              to={`/sessions/${encodeURIComponent(alert.session_id)}`}
                              className="text-accent hover:underline"
                            >
                              {t("feed.viewSession")}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    {!alert.acknowledged_at && (
                      <button
                        onClick={() => onAck(alert.id)}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border text-gray-300 hover:text-gray-100 hover:bg-surface-3 transition-colors flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t("feed.ack")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {alerts.length < total && (
                <div className="flex justify-center mt-4">
                  <button onClick={loadMore} className="btn-ghost border border-border text-sm">
                    {t("feed.loadMore", { shown: alerts.length, total })}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!confirmRule}
        title={t("rules.deleteTitle", "Delete alert rule?")}
        message={confirmRule ? t("rules.confirmDelete", { name: confirmRule.name }) : ""}
        confirmLabel={t("rules.delete")}
        cancelLabel={t("rules.cancel")}
        onCancel={() => setConfirmRule(null)}
        onConfirm={() => confirmRule && onDeleteRule(confirmRule)}
      />
    </div>
  );
}
