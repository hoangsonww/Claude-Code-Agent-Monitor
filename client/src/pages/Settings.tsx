import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { api } from "../lib/api";
import type { ModelPricing } from "../lib/types";

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
}

const emptyRow: EditRow = {
  model_pattern: "",
  display_name: "",
  input_per_mtok: "0",
  output_per_mtok: "0",
  cache_read_per_mtok: "0",
  cache_write_per_mtok: "0",
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
  return d.toLocaleString(undefined, {
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

// ─── Main component ───

export function Settings() {
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
  const [actionResult, setActionResult] = useState<{ key: string; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const [abandonHours, setAbandonHours] = useState("24");
  const [purgeDays, setPurgeDays] = useState("90");

  const load = useCallback(async () => {
    try {
      const [pricingRes, costRes, infoRes] = await Promise.all([
        api.pricing.list(),
        api.pricing.totalCost(),
        api.settings.info(),
      ]);
      setPricing(pricingRes.pricing);
      setTotalCost(costRes.total_cost);
      setSysInfo(infoRes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!actionResult) return;
    const t = setTimeout(() => setActionResult(null), 5000);
    return () => clearTimeout(t);
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
      setError("Pattern and display name are required");
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
      });
      setEditingPattern(null);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (pattern: string) => {
    try {
      await api.pricing.delete(pattern);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const runAction = async (key: string, fn: () => Promise<string>) => {
    setActionLoading(key);
    setActionResult(null);
    setConfirmAction(null);
    try {
      const message = await fn();
      setActionResult({ key, message });
      await load();
    } catch (err) {
      setActionResult({
        key,
        message: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearData = () =>
    runAction("clear", async () => {
      const res = await api.settings.clearData();
      const total = Object.values(res.cleared).reduce((s, n) => s + n, 0);
      return `Cleared ${total} rows`;
    });

  const handleReinstallHooks = () =>
    runAction("hooks", async () => {
      const res = await api.settings.reinstallHooks();
      return res.ok ? "Hooks installed successfully" : "Hook installation failed";
    });

  const handleResetPricing = () =>
    runAction("reset-pricing", async () => {
      const res = await api.settings.resetPricing();
      return `Reset to ${res.pricing.length} default rules`;
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
      if (res.abandoned > 0) parts.push(`${res.abandoned} sessions abandoned`);
      if (res.purged_sessions > 0)
        parts.push(
          `${res.purged_sessions} sessions purged (${res.purged_events} events, ${res.purged_agents} agents)`
        );
      return parts.length > 0 ? parts.join(". ") : "Nothing to clean up";
    });

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
          placeholder="claude-opus-4%"
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
          placeholder="Claude Opus 4"
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
        <div className="flex items-center gap-1">
          <button
            onClick={saveEdit}
            disabled={saving}
            className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelEdit}
            className="p-1.5 rounded-md text-gray-400 hover:bg-surface-4 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </>
  );

  const actionBanner = (keys: string[]) => {
    const match = actionResult && keys.includes(actionResult.key) ? actionResult : null;
    if (!match) return null;
    const isError = match.message.startsWith("Error");
    return (
      <div
        className={`px-3 py-2 rounded-lg text-xs ${
          isError
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
      <div className="flex items-center justify-center h-64 text-gray-500">Loading settings...</div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100 mb-1">Settings</h2>
          <p className="text-sm text-gray-500">Manage pricing, notifications, data, and hooks</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={api.settings.exportData()}
            download
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Export Data
          </a>
          <button onClick={load} className="btn-ghost">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Cost summary card */}
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Estimated Cost</p>
              <p className="text-2xl font-semibold text-gray-100">
                ${totalCost !== null ? totalCost.toFixed(2) : "-.--"}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>Across all tracked sessions</p>
            <p>Based on per-model token usage</p>
          </div>
        </div>
      </div>

      {/* ─── MODEL PRICING ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              Model Pricing
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Rates per million tokens (USD). Use <code className="text-gray-400">%</code> as
              wildcard in patterns.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                confirmAction === "reset-pricing"
                  ? handleResetPricing()
                  : setConfirmAction("reset-pricing")
              }
              disabled={isEditing || actionLoading !== null}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
                confirmAction === "reset-pricing"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-gray-400 hover:text-gray-300 hover:bg-surface-4"
              }`}
            >
              <RotateCcw className="w-3 h-3 inline mr-1" />
              {confirmAction === "reset-pricing" ? "Confirm Reset" : "Reset Defaults"}
            </button>
            <button
              onClick={startAdd}
              disabled={isEditing}
              className="btn-primary text-xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" /> Add Model
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
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Pattern
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Display Name
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Input
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Output
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Cache Read
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  Cache Write
                </th>
                <th className="w-24 px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pricing.map((rule) =>
                editingPattern === rule.model_pattern ? (
                  <tr key={rule.model_pattern} className="bg-surface-3">
                    {renderEditCells()}
                  </tr>
                ) : (
                  <tr
                    key={rule.model_pattern}
                    className="hover:bg-surface-4 transition-colors group"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-gray-300">
                      {rule.model_pattern}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{rule.display_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.input_per_mtok}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.output_per_mtok}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.cache_read_per_mtok}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 text-right font-mono">
                      ${rule.cache_write_per_mtok}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(rule)}
                          disabled={isEditing}
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-30"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.model_pattern)}
                          disabled={isEditing}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
              {adding && <tr className="bg-surface-3">{renderEditCells()}</tr>}
            </tbody>
          </table>
        </div>

        {lastUpdated && (
          <p className="text-xs text-gray-600 mt-3">Last updated: {formatTimestamp(lastUpdated)}</p>
        )}
      </section>

      {/* ─── HOOK CONFIGURATION ─── */}
      <section>
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Plug className="w-4 h-4 text-gray-500" />
          Hook Configuration
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Claude Code hooks forward events to the dashboard in real time.
        </p>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {sysInfo?.hooks.installed ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> All hooks installed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" /> Hooks incomplete
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
              Reinstall Hooks
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

      {/* ─── NOTIFICATIONS ─── */}
      <section>
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-gray-500" />
          Notifications
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Browser notifications for important events. Requires permission.
        </p>

        <div className="card p-5 space-y-5">
          {/* Master toggle + permission status */}
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
                onChange={(v) => {
                  if (v && "Notification" in window && Notification.permission !== "granted") {
                    requestNotifPermission();
                  } else {
                    updateNotifPrefs({ enabled: v });
                  }
                }}
                label="Enable Browser Notifications"
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
                  ? "Permission granted"
                  : Notification.permission === "denied"
                    ? "Permission blocked"
                    : "Permission required"}
              </span>
            )}
          </div>

          {/* Event toggles */}
          {notifPrefs.enabled && (
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Notify me when...
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <Play className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onNewSession}
                    onChange={(v) => updateNotifPrefs({ onNewSession: v })}
                    label="New session starts"
                  />
                </div>
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onSessionComplete}
                    onChange={(v) => updateNotifPrefs({ onSessionComplete: v })}
                    label="Session completes"
                  />
                </div>
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onSessionError}
                    onChange={(v) => updateNotifPrefs({ onSessionError: v })}
                    label="Session errors"
                  />
                </div>
                <div className="flex items-center gap-3 bg-surface-2 rounded-lg px-3.5 py-3">
                  <GitBranch className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <Toggle
                    checked={notifPrefs.onSubagentSpawn}
                    onChange={(v) => updateNotifPrefs({ onSubagentSpawn: v })}
                    label="Subagent spawned"
                  />
                </div>
              </div>

              {/* Test notification */}
              <div className="pt-3 border-t border-border">
                <button
                  onClick={() => {
                    if ("Notification" in window && Notification.permission === "granted") {
                      new Notification("Agent Monitor", {
                        body: "Notifications are working!",
                        icon: "/favicon.ico",
                      });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-surface-4 border border-border transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Send Test Notification
                </button>
              </div>
            </div>
          )}

          {!notifPrefs.enabled && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BellOff className="w-3.5 h-3.5" />
              Notifications are disabled — enable to get alerts for session events
            </div>
          )}
        </div>
      </section>

      {/* ─── DATA MANAGEMENT ─── */}
      <section>
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-gray-500" />
          Data Management
        </h3>
        <p className="text-xs text-gray-500 mb-4">Database info, import/export, and cleanup.</p>

        {sysInfo && (
          <div className="space-y-4">
            {/* DB stats grid */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Database Overview
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-mono bg-surface-2 px-2.5 py-1 rounded-md">
                  <HardDrive className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[300px]">{sysInfo.db.path}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(() => {
                  const tableIcons: Record<string, React.ReactNode> = {
                    sessions: <Layers className="w-4 h-4 text-blue-400" />,
                    agents: <Users className="w-4 h-4 text-emerald-400" />,
                    events: <Activity className="w-4 h-4 text-violet-400" />,
                    token_usage: <Coins className="w-4 h-4 text-amber-400" />,
                    model_pricing: <BarChart3 className="w-4 h-4 text-cyan-400" />,
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
                          {table.replace(/_/g, " ")}
                        </p>
                      </div>
                      <p className="text-xl font-semibold text-gray-200">
                        {count.toLocaleString()}
                      </p>
                    </div>
                  ));
                })()}
                <div className="bg-surface-2 rounded-lg px-3 py-3 border-l-2 border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <HardDrive className="w-4 h-4 text-indigo-400" />
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider">DB Size</p>
                  </div>
                  <p className="text-xl font-semibold text-gray-200">
                    {formatBytes(sysInfo.db.size)}
                  </p>
                </div>
              </div>
            </div>

            {/* Session Cleanup */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Eraser className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-300">Session Cleanup</p>
                  <p className="text-xs text-gray-500">Abandon stale sessions and purge old data</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-lg px-4 py-3">
                  <label className="text-xs text-gray-400 block mb-2">
                    Abandon stale active sessions older than
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={abandonHours}
                      onChange={(e) => setAbandonHours(e.target.value)}
                      className="input w-20 text-sm text-right font-mono"
                    />
                    <span className="text-xs text-gray-500">hours</span>
                  </div>
                </div>
                <div className="bg-surface-2 rounded-lg px-4 py-3">
                  <label className="text-xs text-gray-400 block mb-2">
                    Purge completed/errored sessions older than
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={purgeDays}
                      onChange={(e) => setPurgeDays(e.target.value)}
                      className="input w-20 text-sm text-right font-mono"
                    />
                    <span className="text-xs text-gray-500">days</span>
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
                {confirmAction === "cleanup" ? "Confirm Cleanup" : "Run Cleanup"}
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
                  <p className="text-sm font-medium text-red-400">Danger Zone</p>
                  <p className="text-xs text-gray-500">
                    Irreversible actions that delete data permanently
                  </p>
                </div>
              </div>

              {confirmAction === "clear" ? (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-3">
                  <span className="text-xs text-amber-400">
                    This will delete all sessions, agents, events, and token data. Are you sure?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearData}
                      disabled={actionLoading !== null}
                      className="text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === "clear" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin inline mr-1" />
                      ) : null}
                      Yes, Clear All
                    </button>
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="text-xs px-3 py-1.5 rounded-md text-gray-400 hover:bg-surface-4 transition-colors"
                    >
                      Cancel
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
                  Clear All Data
                </button>
              )}

              {actionBanner(["clear"])}
            </div>
          </div>
        )}
      </section>

      {/* ─── ABOUT ─── */}
      {sysInfo && (
        <section>
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-gray-500" />
            About
          </h3>
          <p className="text-xs text-gray-500 mb-4">Server runtime information.</p>

          <div className="card p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Uptime</p>
                </div>
                <p className="text-sm font-semibold text-gray-200">
                  {formatUptime(sysInfo.server.uptime)}
                </p>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Node.js</p>
                </div>
                <p className="text-sm font-semibold text-gray-200 font-mono">
                  {sysInfo.server.node_version}
                </p>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Globe className="w-4 h-4 text-violet-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Platform</p>
                </div>
                <p className="text-sm font-semibold text-gray-200">{sysInfo.server.platform}</p>
              </div>
              <div className="bg-surface-2 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Wifi className="w-4 h-4 text-amber-400" />
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">WS Clients</p>
                </div>
                <p className="text-sm font-semibold text-gray-200">
                  {sysInfo.server.ws_connections}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
