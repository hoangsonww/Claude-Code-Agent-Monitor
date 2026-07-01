/**
 * @file Settings.tsx
 * @description Provides a settings page for managing model pricing rules, notification preferences, and system information with real-time updates and actionable controls for data management and hook configuration.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState, useCallback, useRef, useSyncExternalStore, Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Database,
  Plug,
  HardDrive,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Server,
  Bell,
  BellOff,
  BellRing,
  FileDown,
  Eraser,
  Play,
  Zap,
  AlertCircle,
  GitBranch,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  Cpu,
  Globe,
  Wifi,
  Activity,
  Users,
  Layers,
  Coins,
  BarChart3,
  Settings as SettingsIcon,
  FolderOpen,
  Info,
  Cat,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { tabbyPrefs } from "../components/Tabby/prefs";
import { fmt, fmtCost, getCurrentLocale } from "../lib/format";
import { subscribeToPush, unsubscribeFromPush } from "../lib/push";
import { Tip } from "../components/Tip";
import { ImportHistory } from "../components/ImportHistory";
import { Skeleton } from "../components/Skeleton";
import { AlertsNotifications } from "../components/AlertsNotifications";
import type { ModelPricing, WSMessage } from "../lib/types";

// In-page navigation for the (dense) Settings screen. Each entry maps to a
// `<section id>` rendered below; the TOC scroll-spies the active one.
const SETTINGS_SECTIONS: {
  id: string;
  labelKey: string;
  fallback?: string;
  Icon: typeof DollarSign;
}[] = [
  { id: "pricing", labelKey: "pricing.title", Icon: DollarSign },
  { id: "hooks", labelKey: "hooks.title", Icon: Plug },
  { id: "claude-home", labelKey: "claudeHome.title", Icon: FolderOpen },
  { id: "import", labelKey: "import.title", fallback: "Import", Icon: History },
  { id: "tabby", labelKey: "tabby.title", fallback: "Tabby", Icon: Cat },
  { id: "notifications", labelKey: "notifications.title", Icon: Bell },
  { id: "alerts", labelKey: "alertsHub.title", Icon: BellRing },
  { id: "data", labelKey: "data.title", Icon: Database },
  { id: "about", labelKey: "about.title", Icon: Server },
];

// ─── Notification preferences ───

const NOTIF_KEY = "agent-monitor-notifications";

interface NotifPrefs {
  enabled: boolean;
  onNewSession: boolean;
  onSessionError: boolean;
  onSessionComplete: boolean;
  onSubagentSpawn: boolean;
}

const defaultNotif: NotifPrefs = {
  enabled: false,
  onNewSession: true,
  onSessionError: true,
  onSessionComplete: false,
  onSubagentSpawn: false,
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return { ...defaultNotif };
    return { ...defaultNotif, ...JSON.parse(raw) };
  } catch {
    return { ...defaultNotif };
  }
}

function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
}

// ─── Helpers ───

interface EditRow {
  model_pattern: string;
  display_name: string;
  input_per_mtok: string;
  output_per_mtok: string;
  cache_read_per_mtok: string;
  cache_write_per_mtok: string;
  cache_write_1h_per_mtok: string;
  fast_input_per_mtok: string;
  fast_output_per_mtok: string;
  // Time-limited introductory rates. intro_until empty ⇒ no promo (the intro_*
  // values are ignored). Generic: any model can carry a promo window.
  intro_until: string;
  intro_input_per_mtok: string;
  intro_output_per_mtok: string;
  intro_cache_read_per_mtok: string;
  intro_cache_write_per_mtok: string;
  intro_cache_write_1h_per_mtok: string;
}

const emptyRow: EditRow = {
  model_pattern: "",
  display_name: "",
  input_per_mtok: "0",
  output_per_mtok: "0",
  cache_read_per_mtok: "0",
  cache_write_per_mtok: "0",
  cache_write_1h_per_mtok: "0",
  fast_input_per_mtok: "0",
  fast_output_per_mtok: "0",
  intro_until: "",
  intro_input_per_mtok: "0",
  intro_output_per_mtok: "0",
  intro_cache_read_per_mtok: "0",
  intro_cache_write_per_mtok: "0",
  intro_cache_write_1h_per_mtok: "0",
};

interface SystemInfo {
  db: { path: string; size: number; counts: Record<string, number> };
  hooks: { installed: boolean; path: string; hooks: Record<string, boolean> };
  server: { uptime: number; node_version: string; platform: string; ws_connections: number };
}

function formatTimestamp(iso: string): string {
  const normalized =
    /[Zz]$/.test(iso) || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return d.toLocaleString(getCurrentLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function useCountUp(end: number | null, durationMs = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === null) {
      setCount(0);
      return;
    }

    let startTimestamp: number | null = null;
    let animationFrameId: number;
    const startValue = count;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setCount(startValue + (end - startValue) * easeProgress);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [end, durationMs]);

  return count;
}

// ─── Toggle component ───

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer group">
      <div className="min-w-0">
        <p className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
          checked ? "bg-blue-500" : "bg-surface-4"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

/**
 * Info popover for the Model Pricing section. Hover or focus the icon to see a
 * three-section explanation: how prices are applied, how pattern matching
 * works, and a reminder that prices must be edited manually when Anthropic
 * publishes new rates. All copy is i18n-driven (settings.pricing.tooltip.*).
 *
 * The popover is fixed-positioned and clamped to the viewport so it never
 * gets clipped by the sidebar or screen edges, mirroring the pattern used by
 * the Workflows stat tooltips.
 */
function PricingInfoTooltip() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  const positionPopover = useCallback(() => {
    const btn = buttonRef.current;
    const pop = popoverRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = pop?.offsetWidth ?? 320;
    const h = pop?.offsetHeight ?? 240;
    const margin = 8;

    let left = r.right - w; // right-align with the icon
    if (left < margin) left = margin;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - margin) {
      top = Math.max(margin, r.top - h - 8);
    }
    setPos({ left, top });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPopover();
    const onScroll = () => positionPopover();
    const onResize = () => positionPopover();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const raf = requestAnimationFrame(positionPopover);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, positionPopover]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("pricing.tooltip.title")}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="tooltip"
          className="fixed z-50 p-3 bg-[#12121f] border border-[#2a2a4a] rounded-lg shadow-2xl text-[11px] text-gray-300 pointer-events-none"
          style={{ left: pos.left, top: pos.top, width: 320 }}
        >
          <p className="text-xs font-semibold text-gray-100 mb-2">{t("pricing.tooltip.title")}</p>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("pricing.tooltip.howItWorks")}
          </p>
          <p className="text-gray-400 leading-snug mb-2.5">{t("pricing.tooltip.howItWorksBody")}</p>

          <p className="font-semibold text-gray-200 uppercase tracking-wider text-[9px] mb-1">
            {t("pricing.tooltip.patternsTitle")}
          </p>
          <p className="text-gray-400 leading-snug mb-2.5">{t("pricing.tooltip.patternsBody")}</p>

          <p className="font-semibold text-amber-300 uppercase tracking-wider text-[9px] mb-1">
            {t("pricing.tooltip.manualUpdates")}
          </p>
          <p className="text-gray-400 leading-snug mb-2.5">
            {t("pricing.tooltip.manualUpdatesBody")}
          </p>

          <p className="font-semibold text-amber-300 uppercase tracking-wider text-[9px] mb-1">
            {t("pricing.tooltip.apiPricing")}
          </p>
          <p className="text-gray-400 leading-snug">{t("pricing.tooltip.apiPricingBody")}</p>
        </div>
      )}
    </>
  );
}

// ─── Main component ───

export function Settings() {
  const { t } = useTranslation("settings");
  const [pricing, setPricing] = useState<ModelPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow>(emptyRow);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{
    key: string;
    message: string;
    isError: boolean;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const [tabbyEnabled, setTabbyEnabled] = useState(() => tabbyPrefs.getEnabled());
  const setTabby = useCallback((v: boolean) => {
    tabbyPrefs.setEnabled(v);
    setTabbyEnabled(v);
  }, []);
  const [abandonHours, setAbandonHours] = useState("24");
  const [purgeDays, setPurgeDays] = useState("90");
  const [claudeHome, setClaudeHomeState] = useState("");
  const [claudeHomeInput, setClaudeHomeInput] = useState("");
  const [claudeHomeSaving, setClaudeHomeSaving] = useState(false);
  const [claudeHomeError, setClaudeHomeError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("pricing");
  const tocRef = useRef<HTMLDivElement | null>(null);
  const [tocOverflow, setTocOverflow] = useState({ left: false, right: false });

  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);
  const animatedTotalCost = useCountUp(totalCost);

  // Scroll-spy: highlight the TOC entry for the section nearest the top.
  useEffect(() => {
    if (loading) return;
    const els = SETTINGS_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (e): e is HTMLElement => !!e
    );
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  // Show chevron affordances on the TOC when its chips overflow horizontally.
  const recomputeTocOverflow = useCallback(() => {
    const el = tocRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setTocOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    if (loading) return;
    recomputeTocOverflow();
    const el = tocRef.current;
    if (!el) return;
    const onScroll = () => recomputeTocOverflow();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(recomputeTocOverflow) : null;
    ro?.observe(el);
    window.addEventListener("resize", recomputeTocOverflow);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", recomputeTocOverflow);
    };
  }, [loading, recomputeTocOverflow]);

  const scrollTocBy = useCallback((delta: number) => {
    tocRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const load = useCallback(async () => {
    try {
      const [pricingRes, costRes, infoRes, claudeHomeRes] = await Promise.all([
        api.pricing.list(),
        api.pricing.totalCost(),
        api.settings.info(),
        api.settings.claudeHome.get(),
      ]);
      setPricing(pricingRes.pricing);
      setTotalCost(costRes.total_cost);
      setSysInfo(infoRes);
      setClaudeHomeState(claudeHomeRes.claude_home);
      setClaudeHomeInput(claudeHomeRes.claude_home);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refreshInfo = () =>
      api.settings
        .info()
        .then(setSysInfo)
        .catch(() => {});
    const interval = setInterval(refreshInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (
        msg.type === "session_created" ||
        msg.type === "session_updated" ||
        msg.type === "agent_created" ||
        msg.type === "agent_updated" ||
        msg.type === "new_event"
      ) {
        api.settings
          .info()
          .then(setSysInfo)
          .catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (!actionResult) return;
    const timeout = setTimeout(() => setActionResult(null), 5000);
    return () => clearTimeout(timeout);
  }, [actionResult]);

  const updateNotifPrefs = (patch: Partial<NotifPrefs>) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, ...patch };
      saveNotifPrefs(next);
      return next;
    });
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      updateNotifPrefs({ enabled: true });
      await subscribeToPush();
    }
  };

  const startEdit = (rule: ModelPricing) => {
    setAdding(false);
    setEditingPattern(rule.model_pattern);
    setEditRow({
      model_pattern: rule.model_pattern,
      display_name: rule.display_name,
      input_per_mtok: String(rule.input_per_mtok),
      output_per_mtok: String(rule.output_per_mtok),
      cache_read_per_mtok: String(rule.cache_read_per_mtok),
      cache_write_per_mtok: String(rule.cache_write_per_mtok),
      cache_write_1h_per_mtok: String(rule.cache_write_1h_per_mtok),
      fast_input_per_mtok: String(rule.fast_input_per_mtok),
      fast_output_per_mtok: String(rule.fast_output_per_mtok),
      intro_until: rule.intro_until ?? "",
      intro_input_per_mtok: String(rule.intro_input_per_mtok ?? 0),
      intro_output_per_mtok: String(rule.intro_output_per_mtok ?? 0),
      intro_cache_read_per_mtok: String(rule.intro_cache_read_per_mtok ?? 0),
      intro_cache_write_per_mtok: String(rule.intro_cache_write_per_mtok ?? 0),
      intro_cache_write_1h_per_mtok: String(rule.intro_cache_write_1h_per_mtok ?? 0),
    });
  };

  const startAdd = () => {
    setEditingPattern(null);
    setAdding(true);
    setEditRow({ ...emptyRow });
  };

  const cancelEdit = () => {
    setEditingPattern(null);
    setAdding(false);
    setError(null);
  };

  const saveEdit = async () => {
    if (!editRow.model_pattern.trim() || !editRow.display_name.trim()) {
      setError(t("pricing.validationRequired"));
      return;
    }
    const introUntil = editRow.intro_until.trim();
    if (introUntil && !/^\d{4}-\d{2}-\d{2}$/.test(introUntil)) {
      setError(t("pricing.introUntilInvalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.pricing.upsert({
        model_pattern: editRow.model_pattern.trim(),
        display_name: editRow.display_name.trim(),
        input_per_mtok: parseFloat(editRow.input_per_mtok) || 0,
        output_per_mtok: parseFloat(editRow.output_per_mtok) || 0,
        cache_read_per_mtok: parseFloat(editRow.cache_read_per_mtok) || 0,
        cache_write_per_mtok: parseFloat(editRow.cache_write_per_mtok) || 0,
        cache_write_1h_per_mtok: parseFloat(editRow.cache_write_1h_per_mtok) || 0,
        fast_input_per_mtok: parseFloat(editRow.fast_input_per_mtok) || 0,
        fast_output_per_mtok: parseFloat(editRow.fast_output_per_mtok) || 0,
        // Always send the intro block so the UI is authoritative for it: an
        // empty date clears the promo, a valid date persists the intro rates.
        intro_until: introUntil || null,
        intro_input_per_mtok: parseFloat(editRow.intro_input_per_mtok) || 0,
        intro_output_per_mtok: parseFloat(editRow.intro_output_per_mtok) || 0,
        intro_cache_read_per_mtok: parseFloat(editRow.intro_cache_read_per_mtok) || 0,
        intro_cache_write_per_mtok: parseFloat(editRow.intro_cache_write_per_mtok) || 0,
        intro_cache_write_1h_per_mtok: parseFloat(editRow.intro_cache_write_1h_per_mtok) || 0,
      });
      setEditingPattern(null);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (pattern: string) => {
    try {
      await api.pricing.delete(pattern);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("messages.failedDelete"));
    }
  };

  const runAction = async (key: string, fn: () => Promise<string>) => {
    setActionLoading(key);
    setActionResult(null);
    setConfirmAction(null);
    try {
      const message = await fn();
      setActionResult({ key, message, isError: false });
      await load();
    } catch (err) {
      setActionResult({
        key,
        message: t("messages.actionFailed", {
          message: err instanceof Error ? err.message : t("messages.unknownError"),
        }),
        isError: true,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearData = () =>
    runAction("clear", async () => {
      const res = await api.settings.clearData();
      const total = Object.values(res.cleared).reduce((s, n) => s + n, 0);
      return t("danger.clearedResult", { count: total });
    });

  const handleReinstallHooks = () =>
    runAction("hooks", async () => {
      const res = await api.settings.reinstallHooks();
      return res.ok ? t("hooks.success") : t("hooks.failed");
    });

  const handleResetPricing = () =>
    runAction("reset-pricing", async () => {
      const res = await api.settings.resetPricing();
      return t("pricing.resetResult", { count: res.pricing.length });
    });

  const handleCleanup = () =>
    runAction("cleanup", async () => {
      const params: { abandon_hours?: number; purge_days?: number } = {};
      const ah = parseFloat(abandonHours);
      const pd = parseFloat(purgeDays);
      if (ah > 0) params.abandon_hours = ah;
      if (pd > 0) params.purge_days = pd;
      const res = await api.settings.cleanup(params);
      const parts = [];
      if (res.abandoned > 0) parts.push(`${res.abandoned}${t("data.abandonedResult")}`);
      if (res.purged_sessions > 0)
        parts.push(
          `${res.purged_sessions}${t("data.purgedResult", { events: res.purged_events, agents: res.purged_agents })}`
        );
      return parts.length > 0 ? parts.join(". ") : t("data.nothingToClean");
    });

  const handleSaveClaudeHome = async () => {
    if (claudeHomeInput === claudeHome) return;
    setClaudeHomeSaving(true);
    setClaudeHomeError(null);
    try {
      const res = await api.settings.claudeHome.set(claudeHomeInput);
      setClaudeHomeState(res.claude_home);
      setClaudeHomeInput(res.claude_home);
    } catch (err) {
      setClaudeHomeError(err instanceof Error ? err.message : t("claudeHome.saveFailed"));
    } finally {
      setClaudeHomeSaving(false);
    }
  };

  const lastUpdated =
    pricing.length > 0
      ? pricing.reduce(
          (latest, p) => (p.updated_at > latest ? p.updated_at : latest),
          pricing[0]!.updated_at
        )
      : null;

  const isEditing = editingPattern !== null || adding;

  const renderEditCells = () => (
    <>
      <td className="px-4 py-3">
        <input
          type="text"
          value={editRow.model_pattern}
          onChange={(e) => setEditRow((r) => ({ ...r, model_pattern: e.target.value }))}
          placeholder={t("pricing.patternPlaceholder")}
          disabled={editingPattern !== null}
          className="input w-full text-sm font-mono disabled:opacity-50"
          autoFocus={adding}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={editRow.display_name}
          onChange={(e) => setEditRow((r) => ({ ...r, display_name: e.target.value }))}
          placeholder={t("pricing.namePlaceholder")}
          className="input w-full text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.input_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, input_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.output_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, output_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.cache_read_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, cache_read_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.cache_write_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, cache_write_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.cache_write_1h_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, cache_write_1h_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.fast_input_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, fast_input_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editRow.fast_output_per_mtok}
          onChange={(e) => setEditRow((r) => ({ ...r, fast_output_per_mtok: e.target.value }))}
          className="input w-full text-sm text-right font-mono"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={saveEdit}
            disabled={saving}
            className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            title={t("common:save")}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelEdit}
            className="p-1.5 rounded-md text-gray-400 hover:bg-surface-4 transition-colors"
            title={t("common:cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </>
  );

  // Second edit row: the time-limited introductory-rate block. Rendered under
  // the standard-rate cells whenever a row is being edited/added. Leaving the
  // date empty means "no promo" — the rate inputs are then ignored. This is the
  // ONLY place intro rates are entered, and it works for any model pattern (not
  // just Sonnet 5), so a future model with a launch promo needs no code change.
  const introField = (key: keyof EditRow, labelKey: string, opts: { date?: boolean } = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-violet-300/70">{t(labelKey)}</span>
      <input
        type={opts.date ? "text" : "number"}
        {...(opts.date ? { placeholder: "YYYY-MM-DD" } : { step: "0.01", min: "0" })}
        value={editRow[key]}
        onChange={(e) => setEditRow((r) => ({ ...r, [key]: e.target.value }))}
        className={`input text-sm font-mono ${opts.date ? "w-36" : "w-24 text-right"}`}
      />
    </label>
  );

  const renderIntroEditRow = () => (
    <tr className="bg-surface-3">
      <td colSpan={10} className="px-4 pb-3 pt-2">
        <div className="mt-2 rounded-md border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-semibold text-violet-300 uppercase tracking-wider">
              {t("pricing.introRatesTitle")}
            </span>
            <span className="text-[11px] text-gray-500">{t("pricing.introRatesHint")}</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {introField("intro_until", "pricing.introUntil", { date: true })}
            {introField("intro_input_per_mtok", "common:token.input")}
            {introField("intro_output_per_mtok", "common:token.output")}
            {introField("intro_cache_read_per_mtok", "common:token.cacheRead")}
            {introField("intro_cache_write_per_mtok", "pricing.cacheWrite5m")}
            {introField("intro_cache_write_1h_per_mtok", "pricing.cacheWrite1h")}
          </div>
        </div>
      </td>
    </tr>
  );

  const actionBanner = (keys: string[]) => {
    const match = actionResult && keys.includes(actionResult.key) ? actionResult : null;
    if (!match) return null;
    return (
      <div
        className={`px-3 py-2 rounded-lg text-xs ${
          match.isError
            ? "bg-red-500/10 border border-red-500/20 text-red-400"
            : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
        }`}
      >
        {match.message}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-8" aria-busy="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9" rounded="lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="card p-6 flex items-center gap-4">
          <Skeleton className="w-12 h-12" rounded="lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-7 w-32" />
          </div>
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <SettingsIcon className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
              {wsConnected ? (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
                  {t("common:live")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {t("common:offline")}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={api.settings.exportData()}
            download
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            {t("exportData")}
          </a>
          <button onClick={load} className="btn-ghost">
            <RefreshCw className="w-4 h-4" /> {t("common:refresh")}
          </button>
        </div>
      </div>

      {/* In-page section navigation - Settings is dense, so this TOC jumps to
          and scroll-spies each section. */}
      <nav className="sticky top-0 z-20 -mx-1 !mt-2 px-1 py-2 bg-surface-0/85 backdrop-blur border-b border-border/60 flex items-center gap-1.5">
        <span className="flex-shrink-0 pl-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {t("jumpTo", "Jump to")}
        </span>
        {tocOverflow.left && (
          <button
            type="button"
            onClick={() => scrollTocBy(-180)}
            aria-label="Scroll left"
            className="flex-shrink-0 flex items-center justify-center w-6 h-7 rounded-md border border-border text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}
        <div ref={tocRef} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
          {SETTINGS_SECTIONS.map(({ id, labelKey, fallback, Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap px-2.5 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                  active
                    ? "bg-accent/15 border-accent/30 text-accent"
                    : "border-border text-gray-400 hover:text-gray-200 hover:bg-surface-3"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(labelKey, fallback ?? "")}
              </button>
            );
          })}
        </div>
        {tocOverflow.right && (
          <button
            type="button"
            onClick={() => scrollTocBy(180)}
            aria-label="Scroll right"
            className="flex-shrink-0 flex items-center justify-center w-6 h-7 rounded-md border border-border text-gray-400 hover:text-gray-200 hover:bg-surface-3 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </nav>

      {/* Cost summary card */}
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t("common:cost.totalEstimatedCost")}</p>
              <p className="text-2xl font-semibold text-gray-100">
                <Tip
                  raw={
                    totalCost !== null
                      ? `$${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : undefined
                  }
                >
                  {totalCost !== null ? fmtCost(animatedTotalCost) : "$-.--"}
                </Tip>
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>{t("acrossSessions")}</p>
            <p>{t("basedOnUsage")}</p>
          </div>
        </div>
      </div>

      {/* ─── MODEL PRICING ─── */}
      <section id="pricing" className="scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              {t("pricing.title")}
              <PricingInfoTooltip />
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("pricing.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                confirmAction === "reset-pricing"
                  ? handleResetPricing()
                  : setConfirmAction("reset-pricing")
              }
              disabled={isEditing || actionLoading !== null}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 ${
                confirmAction === "reset-pricing"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-gray-400 hover:text-gray-300 hover:bg-surface-4"
              }`}
            >
              <RotateCcw className="w-3 h-3" />
              {confirmAction === "reset-pricing"
                ? t("pricing.resetConfirm")
                : t("pricing.resetDefaults")}
            </button>
            <button
              onClick={startAdd}
              disabled={isEditing}
              className="btn-primary text-xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> {t("pricing.addModel")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {actionBanner(["reset-pricing"])}

        <div className="card overflow-x-auto mt-4">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("pricing.pattern")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("common:cost.model")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("common:token.input")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("common:token.output")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("common:token.cacheRead")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("pricing.cacheWrite5m")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("pricing.cacheWrite1h")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("pricing.fastInput")}
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("pricing.fastOutput")}
                </th>
                <th className="w-24 px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("common:actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pricing.map((rule) =>
                editingPattern === rule.model_pattern ? (
                  <Fragment key={rule.model_pattern}>
                    <tr className="bg-surface-3">{renderEditCells()}</tr>
                    {renderIntroEditRow()}
                  </Fragment>
                ) : (
                  <tr
                    key={rule.model_pattern}
                    className="hover:bg-surface-4 transition-colors group"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-300">
                      {rule.model_pattern}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {rule.display_name}
                      {rule.intro_until && (
                        <div className="text-[11px] font-normal text-violet-400/80 mt-0.5">
                          {t("pricing.introNote", {
                            input: rule.intro_input_per_mtok,
                            output: rule.intro_output_per_mtok,
                            until: rule.intro_until,
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.input_per_mtok}
                      {rule.intro_until && (
                        <span className="block text-[11px] text-violet-400/80">
                          ${rule.intro_input_per_mtok}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.output_per_mtok}
                      {rule.intro_until && (
                        <span className="block text-[11px] text-violet-400/80">
                          ${rule.intro_output_per_mtok}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.cache_read_per_mtok}
                      {rule.intro_until && (
                        <span className="block text-[11px] text-violet-400/80">
                          ${rule.intro_cache_read_per_mtok}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.cache_write_per_mtok}
                      {rule.intro_until && (
                        <span className="block text-[11px] text-violet-400/80">
                          ${rule.intro_cache_write_per_mtok}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.cache_write_1h_per_mtok}
                      {rule.intro_until && (
                        <span className="block text-[11px] text-violet-400/80">
                          ${rule.intro_cache_write_1h_per_mtok}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      {rule.fast_input_per_mtok ? `$${rule.fast_input_per_mtok}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      {rule.fast_output_per_mtok ? `$${rule.fast_output_per_mtok}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 transition-opacity">
                        <button
                          onClick={() => startEdit(rule)}
                          disabled={isEditing}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-30"
                          title={t("common:edit")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.model_pattern)}
                          disabled={isEditing}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                          title={t("common:delete")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {adding && (
                <>
                  <tr className="bg-surface-3">{renderEditCells()}</tr>
                  {renderIntroEditRow()}
                </>
              )}
            </tbody>
          </table>
        </div>

        {lastUpdated && (
          <p className="text-xs text-gray-600 mt-3">
            {t("pricing.lastUpdated")}
            {formatTimestamp(lastUpdated)}
          </p>
        )}
      </section>

      {/* ─── HOOK CONFIGURATION ─── */}
      <section id="hooks" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Plug className="w-4 h-4 text-gray-500" />
          {t("hooks.title")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t("hooks.description")}</p>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {sysInfo?.hooks.installed ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> {t("hooks.allInstalled")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t("hooks.incomplete")}
                </span>
              )}
            </div>
            <button
              onClick={handleReinstallHooks}
              disabled={actionLoading !== null}
              className="btn-ghost text-xs disabled:opacity-50"
            >
              {actionLoading === "hooks" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5" />
              )}
              {t("hooks.reinstall")}
            </button>
          </div>

          {actionBanner(["hooks"])}

          {sysInfo && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {Object.entries(sysInfo.hooks.hooks).map(([hook, active]) => (
                  <div
                    key={hook}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-surface-2"
                  >
                    {active ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-gray-400 truncate">{hook}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 font-mono truncate">{sysInfo.hooks.path}</p>
            </>
          )}
        </div>
      </section>

      {/* ─── CLAUDE HOME ─── */}
      <section id="claude-home" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <FolderOpen className="w-4 h-4 text-gray-500" />
          {t("claudeHome.title")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t("claudeHome.description")}</p>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={claudeHomeInput}
              onChange={(e) => {
                setClaudeHomeInput(e.target.value);
                setClaudeHomeError(null);
              }}
              className="flex-1 bg-surface-4 border border-surface-3 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-violet-500/50"
              placeholder={t("claudeHome.placeholder")}
            />
            <button
              onClick={handleSaveClaudeHome}
              disabled={claudeHomeSaving || claudeHomeInput === claudeHome}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claudeHomeSaving ? t("claudeHome.saving") : t("claudeHome.save")}
            </button>
          </div>
          {claudeHomeError && <p className="text-xs text-red-400">{claudeHomeError}</p>}
          {claudeHome && (
            <p className="text-xs text-gray-500">
              {t("claudeHome.current")} <code className="text-gray-400">{claudeHome}</code>
            </p>
          )}
        </div>
      </section>

      {/* ─── IMPORT HISTORY ─── */}
      <section id="import" className="scroll-mt-24">
        <ImportHistory />
      </section>

      {/* ─── TABBY COMPANION ─── */}
      <section id="tabby" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <span className="text-base leading-none" aria-hidden>
            🐾
          </span>
          {t("tabby.title", "Tabby companion")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          {t("tabby.description", "A floating cat that reacts to your live sessions.")}
        </p>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                tabbyEnabled
                  ? "bg-blue-500/10 border border-blue-500/20"
                  : "bg-surface-2 border border-border"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                🐾
              </span>
            </div>
            <Toggle
              checked={tabbyEnabled}
              onChange={setTabby}
              label={t("tabby.enable", "Show Tabby")}
              description={t(
                "tabby.enableDesc",
                "Display the corner companion across the dashboard (⌘B to open)"
              )}
            />
          </div>
        </div>
      </section>

      {/* ─── NOTIFICATIONS ─── */}
      <section id="notifications" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-gray-500" />
          {t("notifications.title")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t("notifications.description")}</p>

        <div className="card p-5 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  notifPrefs.enabled
                    ? "bg-blue-500/10 border border-blue-500/20"
                    : "bg-surface-2 border border-border"
                }`}
              >
                {notifPrefs.enabled ? (
                  <BellRing className="w-5 h-5 text-blue-400" />
                ) : (
                  <BellOff className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <Toggle
                checked={notifPrefs.enabled}
                onChange={async (v) => {
                  if (v) {
                    if ("Notification" in window && Notification.permission !== "granted") {
                      requestNotifPermission();
                    } else {
                      updateNotifPrefs({ enabled: true });
                      await subscribeToPush();
                    }
                  } else {
                    updateNotifPrefs({ enabled: false });
                    await unsubscribeFromPush();
                  }
                }}
                label={t("notifications.enable")}
              />
            </div>
            {"Notification" in window && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  Notification.permission === "granted"
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : Notification.permission === "denied"
                      ? "text-red-400 bg-red-500/10 border border-red-500/20"
                      : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                }`}
              >
                {Notification.permission === "granted" ? (
                  <ShieldCheck className="w-3 h-3" />
                ) : Notification.permission === "denied" ? (
                  <ShieldX className="w-3 h-3" />
                ) : (
                  <ShieldAlert className="w-3 h-3" />
                )}
                {Notification.permission === "granted"
                  ? t("notifications.granted")
                  : Notification.permission === "denied"
                    ? t("notifications.blocked")
                    : t("notifications.required")}
              </span>
            )}
          </div>

          {notifPrefs.enabled && (
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                {t("notifications.notifyWhen")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <Play className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onNewSession}
                    onChange={(v) => updateNotifPrefs({ onNewSession: v })}
                    label={t("notifications.newSession")}
                  />
                </div>
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onSessionComplete}
                    onChange={(v) => updateNotifPrefs({ onSessionComplete: v })}
                    label={t("notifications.sessionComplete")}
                  />
                </div>
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onSessionError}
                    onChange={(v) => updateNotifPrefs({ onSessionError: v })}
                    label={t("notifications.sessionError")}
                  />
                </div>
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <GitBranch className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onSubagentSpawn}
                    onChange={(v) => updateNotifPrefs({ onSubagentSpawn: v })}
                    label={t("notifications.subagentSpawned")}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <button
                  onClick={async () => {
                    if (!("Notification" in window) || Notification.permission !== "granted")
                      return;
                    await fetch("/api/push/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: t("notifications.testTitle"),
                        body: t("notifications.testBody"),
                      }),
                    });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-surface-4 border border-border transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  {t("notifications.sendTest")}
                </button>
              </div>
            </div>
          )}

          {!notifPrefs.enabled && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BellOff className="w-3.5 h-3.5" />
              {t("notifications.disabledInfo")}
            </div>
          )}
        </div>
      </section>

      {/* ─── ALERTS ─── */}
      <section id="alerts" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <BellRing className="w-4 h-4 text-gray-500" />
          {t("alertsHub.title")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t("alertsHub.description")}</p>
        <AlertsNotifications />
      </section>

      {/* ─── DATA MANAGEMENT ─── */}
      <section id="data" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-gray-500" />
          {t("data.title")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t("data.description")}</p>

        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex-shrink-0">
                {t("data.dbOverview")}
              </p>
              {sysInfo && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-mono bg-surface-2 px-2.5 py-1 rounded-md min-w-0">
                  <HardDrive className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{sysInfo.db.path}</span>
                </div>
              )}
            </div>

            {sysInfo ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(() => {
                  const tableIcons: Record<string, React.ReactNode> = {
                    sessions: <Layers className="w-4 h-4 text-blue-400" />,
                    agents: <Users className="w-4 h-4 text-emerald-400" />,
                    events: <Activity className="w-4 h-4 text-violet-400" />,
                    token_usage: <Coins className="w-4 h-4 text-amber-400" />,
                    model_pricing: <BarChart3 className="w-4 h-4 text-cyan-400" />,
                  };
                  const tableLabels: Record<string, string> = {
                    sessions: t("tables.sessions"),
                    agents: t("tables.agents"),
                    events: t("tables.events"),
                    token_usage: t("tables.sessionsWithCost"),
                    model_pricing: t("tables.pricingRules"),
                  };
                  const tableColors: Record<string, string> = {
                    sessions: "border-blue-500/20",
                    agents: "border-emerald-500/20",
                    events: "border-violet-500/20",
                    token_usage: "border-amber-500/20",
                    model_pricing: "border-cyan-500/20",
                  };
                  return Object.entries(sysInfo.db.counts).map(([table, count]) => (
                    <div
                      key={table}
                      className={`bg-surface-2 rounded-lg px-3 py-3 border-l-2 ${tableColors[table] || "border-gray-500/20"}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        {tableIcons[table] || <Database className="w-4 h-4 text-gray-500" />}
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                          {tableLabels[table] || table.replace(/_/g, " ")}
                        </p>
                      </div>
                      <p className="text-xl font-semibold text-gray-200">
                        <Tip raw={count.toLocaleString()}>{fmt(count)}</Tip>
                      </p>
                    </div>
                  ));
                })()}
                <div className="bg-surface-2 rounded-lg px-3 py-3 border-l-2 border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <HardDrive className="w-4 h-4 text-indigo-400" />
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                      {t("data.dbSize")}
                    </p>
                  </div>
                  <p className="text-xl font-semibold text-gray-200">
                    {formatBytes(sysInfo.db.size)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">{t("data.loadingDb")}</p>
            )}
          </div>

          {/* Session Cleanup */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Eraser className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">{t("data.sessionCleanup")}</p>
                <p className="text-xs text-gray-500">{t("data.cleanupDesc")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <label className="text-xs text-gray-400 block mb-2">{t("data.abandonAfter")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={abandonHours}
                    onChange={(e) => setAbandonHours(e.target.value)}
                    className="input w-20 text-sm text-right font-mono"
                  />
                  <span className="text-xs text-gray-500">{t("common:hours")}</span>
                </div>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <label className="text-xs text-gray-400 block mb-2">{t("data.purgeAfter")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={purgeDays}
                    onChange={(e) => setPurgeDays(e.target.value)}
                    className="input w-20 text-sm text-right font-mono"
                  />
                  <span className="text-xs text-gray-500">{t("common:days")}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                confirmAction === "cleanup" ? handleCleanup() : setConfirmAction("cleanup")
              }
              disabled={actionLoading !== null}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
                confirmAction === "cleanup"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-gray-400 hover:text-gray-300 hover:bg-surface-4 border border-border"
              }`}
            >
              {actionLoading === "cleanup" ? (
                <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
              ) : (
                <Eraser className="w-3 h-3 inline mr-1" />
              )}
              {confirmAction === "cleanup" ? t("data.confirmCleanup") : t("data.runCleanup")}
            </button>

            {actionBanner(["cleanup"])}
          </div>

          {/* Danger zone */}
          <div className="card p-5 space-y-4 border-red-500/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">{t("danger.title")}</p>
                <p className="text-xs text-gray-500">{t("danger.description")}</p>
              </div>
            </div>

            {confirmAction === "clear" ? (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-3">
                <span className="text-xs text-amber-400">{t("danger.warning")}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearData}
                    disabled={actionLoading !== null}
                    className="text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "clear" ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin inline mr-1" />
                    ) : null}
                    {t("danger.yesClearAll")}
                  </button>
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="text-xs px-3 py-1.5 rounded-md text-gray-400 hover:bg-surface-4 transition-colors"
                  >
                    {t("common:cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("clear")}
                disabled={actionLoading !== null}
                className="text-xs px-3 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                {t("danger.clearAllData")}
              </button>
            )}

            {actionBanner(["clear"])}
          </div>
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section id="about" className="scroll-mt-24">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Server className="w-4 h-4 text-gray-500" />
          {t("about.title")}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{t("about.description")}</p>

        {sysInfo ? (
          <div className="card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                    {t("about.uptime")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-200">
                  {formatUptime(sysInfo.server.uptime)}
                </p>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                    {t("about.nodejs")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-200 font-mono">
                  {sysInfo.server.node_version}
                </p>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Globe className="w-4 h-4 text-violet-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                    {t("about.platform")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-200">{sysInfo.server.platform}</p>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wifi className="w-4 h-4 text-amber-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">
                    {t("about.wsClients")}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-200">
                  {sysInfo.server.ws_connections}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">{t("about.loadingInfo")}</p>
        )}
      </section>
    </div>
  );
}
