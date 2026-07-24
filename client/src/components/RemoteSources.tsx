/**
 * @file RemoteSources.tsx
 * @description Settings UI for the Remote Data Sources feature: manage the SSH
 * machines this dashboard pulls Claude Code history from, and choose the global
 * "data scope" (which machines' data the whole app shows).
 *
 * Backs `server/routes/remote-sources.js` via {@link api.remoteSources} and the
 * global scope store ({@link useDataScope}). No secrets are entered or stored
 * here — authentication defers to the host's SSH stack (~/.ssh/config, agent,
 * keys, known_hosts); a source is just a label + ssh destination (+ optional
 * port / identity file / remote home). Live status/sync updates arrive over the
 * `remote_source.status` WebSocket message.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Cloud,
  Plus,
  Server,
  RefreshCw,
  Wifi,
  Trash2,
  Pencil,
  Check,
  X,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { api } from "../lib/api";
import type { RemoteSource, RemoteSourceInput } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import { useDataScope } from "../lib/dataScope";
import type { ScopeMode } from "../lib/dataScope";

const EMPTY_FORM: RemoteSourceInput = {
  label: "",
  host: "",
  ssh_port: null,
  identity_file: "",
  remote_home: "",
  enabled: true,
};

/** Compact status pill for a source's last-known sync state. */
function StatusPill({ status }: { status: RemoteSource["status"] }) {
  const map: Record<RemoteSource["status"], { cls: string; label: string; pulse?: boolean }> = {
    idle: { cls: "text-gray-400 bg-gray-500/10 border-gray-500/20", label: "Idle" },
    syncing: {
      cls: "text-amber-300 bg-amber-500/10 border-amber-500/25",
      label: "Syncing",
      pulse: true,
    },
    ok: { cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", label: "OK" },
    error: { cls: "text-red-300 bg-red-500/10 border-red-500/25", label: "Error" },
  };
  const s = map[status] || map.idle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.cls}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-current ${s.pulse ? "animate-pulse-dot" : ""}`}
      />
      {s.label}
    </span>
  );
}

export function RemoteSources() {
  const { t } = useTranslation("settings");
  const [sources, setSources] = useState<RemoteSource[]>([]);
  const [facetSources, setFacetSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useDataScope();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RemoteSourceInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>(
    {}
  );
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; purge: boolean } | null>(null);

  const load = useCallback(() => {
    Promise.all([api.remoteSources.list(), api.sessions.facets()])
      .then(([srcRes, facetRes]) => {
        setSources(srcRes.sources);
        setFacetSources(facetRes.sources || []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on any remote-source status change (sync started/finished/errored).
  useEffect(() => {
    return eventBus.subscribe((msg) => {
      if (msg.type === "remote_source.status") load();
    });
  }, [load]);

  // ── Scope selector ──────────────────────────────────────────────────────────

  // Union of origins that have data (facets) + all configured source ids, so a
  // freshly-added source is selectable before its first sync lands any rows.
  const configuredIds = sources.map((s) => s.id);
  const scopeOptionIds = ["local", ...new Set([...configuredIds, ...facetSources])].filter(
    (id, i, arr) => id === "local" || (arr.indexOf(id) === i && id !== "local")
  );
  const labelFor = (id: string) =>
    id === "local"
      ? t("remoteSources.thisMachine", "This machine")
      : sources.find((s) => s.id === id)?.label || id;

  function setMode(mode: ScopeMode) {
    if (mode === "selected") {
      const selected = scope.selected.length > 0 ? scope.selected : scopeOptionIds;
      setScope({ mode, selected });
    } else {
      setScope({ mode, selected: scope.selected });
    }
  }
  function toggleSelected(id: string) {
    const set = new Set(scope.selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setScope({ mode: "selected", selected: [...set] });
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  }
  function openEdit(s: RemoteSource) {
    setForm({
      label: s.label,
      host: s.host,
      ssh_port: s.ssh_port,
      identity_file: s.identity_file || "",
      remote_home: s.remote_home || "",
      enabled: s.enabled,
    });
    setEditingId(s.id);
    setFormError(null);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function submitForm() {
    setSaving(true);
    setFormError(null);
    // Normalize optional empties to null so the server stores nothing rather
    // than empty strings (its validators treat absent as "use default").
    const payload: RemoteSourceInput = {
      label: form.label.trim(),
      host: form.host.trim(),
      ssh_port: form.ssh_port ? Number(form.ssh_port) : null,
      identity_file: form.identity_file?.trim() ? form.identity_file.trim() : null,
      remote_home: form.remote_home?.trim() ? form.remote_home.trim() : null,
      enabled: form.enabled,
    };
    try {
      if (editingId) await api.remoteSources.update(editingId, payload);
      else await api.remoteSources.create(payload);
      closeForm();
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Per-source actions ────────────────────────────────────────────────────────

  async function toggleEnabled(s: RemoteSource) {
    setBusyId(s.id);
    try {
      await api.remoteSources.update(s.id, { enabled: !s.enabled });
      load();
    } catch {
      /* surfaced via reload */
    } finally {
      setBusyId(null);
    }
  }

  async function testSource(s: RemoteSource) {
    setBusyId(s.id);
    setTestResults((r) => ({ ...r, [s.id]: { ok: false, message: "" } }));
    try {
      const res = await api.remoteSources.test(s.id);
      setTestResults((r) => ({ ...r, [s.id]: { ok: res.ok, message: res.message } }));
    } catch (err) {
      setTestResults((r) => ({
        ...r,
        [s.id]: { ok: false, message: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function syncNow(s: RemoteSource) {
    setBusyId(s.id);
    try {
      await api.remoteSources.sync(s.id);
      load();
    } catch (err) {
      setTestResults((r) => ({
        ...r,
        [s.id]: { ok: false, message: err instanceof Error ? err.message : String(err) },
      }));
    } finally {
      setBusyId(null);
    }
  }

  async function syncAll() {
    setSyncingAll(true);
    try {
      await api.remoteSources.syncAll();
      load();
    } catch {
      /* per-source errors surface via each source's status on reload */
    } finally {
      setSyncingAll(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    const { id, purge } = confirmDelete;
    setBusyId(id);
    try {
      await api.remoteSources.remove(id, purge);
      setConfirmDelete(null);
      load();
    } catch {
      /* surfaced via reload */
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
        <Cloud className="w-4 h-4 text-gray-500" />
        {t("remoteSources.title", "Remote Data Sources")}
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        {t(
          "remoteSources.description",
          "Collect Claude Code usage from other machines over SSH — e.g. a dev box or cloud VM you drive over SSH while running this dashboard locally. Authentication uses your own SSH setup (~/.ssh/config, keys, agent); no passwords are stored here."
        )}
      </p>

      {/* Data scope selector */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Wifi className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-gray-200">
            {t("remoteSources.scopeTitle", "Data scope")}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {t(
            "remoteSources.scopeDesc",
            "Choose which machines' data the whole dashboard shows. Changes apply immediately."
          )}
        </p>
        <div className="flex flex-col gap-2">
          {(
            [
              ["all", t("remoteSources.scopeAll", "All sources (local + remote)")],
              ["local", t("remoteSources.scopeLocal", "This machine only")],
              ["selected", t("remoteSources.scopeSelected", "Selected sources…")],
            ] as [ScopeMode, string][]
          ).map(([mode, label]) => (
            <label key={mode} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="data-scope"
                checked={scope.mode === mode}
                onChange={() => setMode(mode)}
                className="accent-accent"
              />
              <span className="text-sm text-gray-300">{label}</span>
            </label>
          ))}
          {scope.mode === "selected" && (
            <div className="mt-1 ml-6 flex flex-wrap gap-2">
              {scopeOptionIds.map((id) => {
                const on = scope.selected.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSelected(id)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      on
                        ? "bg-accent/15 border-accent/40 text-accent"
                        : "bg-surface-2 border-border text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {on ? <Check className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                    {labelFor(id)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sources list header + add button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {t("remoteSources.listTitle", "Configured sources")}
        </span>
        <div className="flex items-center gap-2">
          {sources.some((s) => s.enabled) && (
            <button
              onClick={syncAll}
              disabled={syncingAll}
              className="btn-ghost text-xs disabled:opacity-40"
              title={t("remoteSources.syncAll", "Sync all enabled sources")}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? "animate-spin" : ""}`} />
              {t("remoteSources.syncAll", "Sync all")}
            </button>
          )}
          <button onClick={openAdd} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> {t("remoteSources.add", "Add source")}
          </button>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card p-5 mb-4 space-y-3 border-accent/30">
          <div className="text-sm font-medium text-gray-200">
            {editingId
              ? t("remoteSources.editTitle", "Edit source")
              : t("remoteSources.addTitle", "Add a remote source")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("remoteSources.fieldLabel", "Label")} *
              </label>
              <input
                className="input w-full"
                placeholder="Dev box"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("remoteSources.fieldHost", "SSH host")} *
              </label>
              <input
                className="input w-full font-mono"
                placeholder="user@host or config-alias"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("remoteSources.fieldPort", "Port (optional)")}
              </label>
              <input
                className="input w-full font-mono"
                type="number"
                placeholder="22"
                value={form.ssh_port ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    ssh_port: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("remoteSources.fieldIdentity", "Identity file (optional)")}
              </label>
              <input
                className="input w-full font-mono"
                placeholder="~/.ssh/id_ed25519"
                value={form.identity_file ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, identity_file: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">
                {t("remoteSources.fieldRemoteHome", "Remote Claude home (optional)")}
              </label>
              <input
                className="input w-full font-mono"
                placeholder="~/.claude"
                value={form.remote_home ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, remote_home: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent"
              checked={!!form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            <span className="text-sm text-gray-300">
              {t("remoteSources.fieldEnabled", "Sync automatically in the background")}
            </span>
          </label>
          {formError && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={submitForm}
              disabled={saving || !form.label.trim() || !form.host.trim()}
              className="btn-primary text-xs disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {t("common:save", "Save")}
            </button>
            <button onClick={closeForm} className="btn-ghost text-xs">
              <X className="w-3.5 h-3.5" /> {t("common:cancel", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Sources list */}
      {loading ? (
        <div className="text-xs text-gray-500">{t("common:loading", "Loading…")}</div>
      ) : sources.length === 0 ? (
        <div className="card p-6 text-center">
          <Server className="w-6 h-6 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {t("remoteSources.empty", "No remote sources yet.")}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {t(
              "remoteSources.emptyHint",
              "Add a machine you reach over SSH to pull its Claude Code usage in."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((s) => {
            const test = testResults[s.id];
            const busy = busyId === s.id;
            return (
              <div key={s.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Server className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-sm font-medium text-gray-200">{s.label}</span>
                      <StatusPill status={s.status} />
                      {!s.enabled && (
                        <span className="text-[10px] text-gray-500 bg-surface-2 border border-border px-1.5 py-0.5 rounded-full">
                          {t("remoteSources.paused", "Auto-sync off")}
                        </span>
                      )}
                      {s.session_count != null && s.session_count > 0 && (
                        <span className="text-[10px] text-gray-400 bg-surface-2 border border-border px-1.5 py-0.5 rounded-full">
                          {t("remoteSources.sessionCount", "{{n}} sessions", {
                            n: s.session_count,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono mt-1 truncate">
                      {s.host}
                      {s.ssh_port ? `:${s.ssh_port}` : ""}
                      {s.remote_home ? ` · ${s.remote_home}` : ""}
                    </div>
                    <div className="text-[11px] text-gray-600 mt-1">
                      {s.last_sync_at
                        ? t("remoteSources.lastSync", "Last sync: {{when}}", {
                            when: new Date(s.last_sync_at).toLocaleString(),
                          })
                        : t("remoteSources.neverSynced", "Never synced")}
                      {s.last_sync_counts?.imported != null &&
                        ` · ${t("remoteSources.imported", "{{n}} imported", {
                          n: s.last_sync_counts.imported,
                        })}`}
                    </div>
                    {s.status === "error" && s.last_error && (
                      <div className="text-[11px] text-red-300 mt-1 break-words">
                        {s.last_error}
                      </div>
                    )}
                    {test && test.message && (
                      <div
                        className={`flex items-start gap-1.5 text-[11px] mt-2 ${
                          test.ok ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {test.ok ? (
                          <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        )}
                        <span className="break-words">{test.message}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => testSource(s)}
                      disabled={busy}
                      className="btn-ghost text-xs disabled:opacity-40"
                      title={t("remoteSources.test", "Test connection")}
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5" />
                      )}
                      {t("remoteSources.test", "Test")}
                    </button>
                    <button
                      onClick={() => syncNow(s)}
                      disabled={busy}
                      className="btn-ghost text-xs disabled:opacity-40"
                      title={t("remoteSources.syncNow", "Sync now")}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
                      {t("remoteSources.syncNow", "Sync")}
                    </button>
                    <button
                      onClick={() => toggleEnabled(s)}
                      disabled={busy}
                      className="btn-ghost text-xs disabled:opacity-40"
                    >
                      {s.enabled
                        ? t("remoteSources.disable", "Disable")
                        : t("remoteSources.enable", "Enable")}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      className="btn-ghost text-xs"
                      title={t("common:edit", "Edit")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: s.id, purge: false })}
                      className="btn-ghost text-xs text-red-300 hover:text-red-200"
                      title={t("common:delete", "Delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline delete confirmation */}
                {confirmDelete?.id === s.id && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-gray-300 mb-2">
                      {t("remoteSources.confirmDelete", "Remove this source?")}
                    </p>
                    <label className="flex items-center gap-2 mb-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-red-500"
                        checked={confirmDelete.purge}
                        onChange={(e) =>
                          setConfirmDelete((c) => c && { ...c, purge: e.target.checked })
                        }
                      />
                      <span className="text-xs text-gray-400">
                        {t(
                          "remoteSources.purgeData",
                          "Also delete the sessions imported from this source (cannot be undone)"
                        )}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={doDelete}
                        disabled={busy}
                        className="btn-primary text-xs bg-red-600 hover:bg-red-500 disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {confirmDelete.purge
                          ? t("remoteSources.deleteAndPurge", "Remove + delete data")
                          : t("remoteSources.removeKeep", "Remove (keep data)")}
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="btn-ghost text-xs">
                        {t("common:cancel", "Cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
