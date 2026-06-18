/**
 * @file Snapshots.tsx
 * @description Management list for shareable read-only session snapshots. Shows
 * a table of every snapshot (title, source session link, created time, status
 * badge, view count) with per-row Copy link / Revoke / Delete actions. Revoke
 * and Delete are guarded by a ConfirmModal. Empty state guides the user to
 * create a snapshot from a session detail page.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Check, Copy, ExternalLink, Eye, RefreshCw, Trash2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState } from "../components/EmptyState";
import { TableRowSkeleton } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { formatDateTime } from "../lib/format";
import type { SnapshotMeta, SnapshotStatus } from "../lib/types";

const STATUS_STYLES: Record<SnapshotStatus, string> = {
  active: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  expired: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  revoked: "text-red-400 bg-red-500/10 border-red-500/20",
};

function snapshotUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/snapshot/${token}`;
}

type PendingAction = { type: "revoke" | "delete"; token: string } | null;

export function Snapshots() {
  const { t } = useTranslation("snapshots");
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.snapshots.list();
      setSnapshots(items);
    } catch (err) {
      console.error("Failed to load snapshots:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(snapshotUrl(token));
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((cur) => (cur === token ? null : cur)), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }, []);

  const confirmAction = useCallback(async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.type === "revoke") {
        const updated = await api.snapshots.revoke(pending.token);
        setSnapshots((prev) => prev.map((s) => (s.token === updated.token ? updated : s)));
      } else {
        await api.snapshots.remove(pending.token);
        setSnapshots((prev) => prev.filter((s) => s.token !== pending.token));
      }
      setPending(null);
    } catch (err) {
      console.error("Snapshot action failed:", err);
    } finally {
      setBusy(false);
    }
  }, [pending]);

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <Camera className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
            <p className="text-xs text-gray-500">{t("subtitle")}</p>
          </div>
        </div>
        <button onClick={load} className="btn-ghost flex-shrink-0">
          <RefreshCw className="w-4 h-4" /> {t("refresh")}
        </button>
      </div>

      {!loading && snapshots.length === 0 ? (
        <EmptyState icon={Camera} title={t("empty")} description={t("emptyDesc")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("table.title")}
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("table.session")}
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("table.created")}
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {t("table.status")}
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("table.views")}
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">
                  {t("table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && snapshots.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRowSkeleton
                      key={`sk-${i}`}
                      columns={6}
                      widths={["w-40", "w-32", "w-28", "w-16", "w-10", "w-40"]}
                    />
                  ))
                : null}
              {snapshots.map((snap) => (
                <tr key={snap.token} className="hover:bg-surface-4 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-gray-200 truncate max-w-[260px]">
                      {snap.title || t("untitled")}
                    </p>
                    <p className="text-[11px] text-gray-600 font-mono">{snap.token.slice(0, 12)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      to={`/sessions/${snap.session_id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-gray-400 hover:text-accent transition-colors"
                      title={snap.session_id}
                    >
                      {snap.session_id.slice(0, 12)}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400">
                    {formatDateTime(snap.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[snap.status]}`}
                    >
                      {t(`status.${snap.status}`)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-400 text-right font-mono">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Eye className="w-3 h-3 text-gray-600" />
                      {snap.view_count}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyLink(snap.token)}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-accent hover:bg-accent/10 border border-border transition-colors"
                        title={t("copyLink")}
                      >
                        {copiedToken === snap.token ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedToken === snap.token ? t("copied") : t("copyLink")}
                      </button>
                      {snap.status === "active" && (
                        <button
                          type="button"
                          onClick={() => setPending({ type: "revoke", token: snap.token })}
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-amber-300 hover:bg-amber-500/10 border border-border transition-colors"
                          title={t("revoke")}
                        >
                          <XCircle className="w-3 h-3" />
                          {t("revoke")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPending({ type: "delete", token: snap.token })}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-surface-2 text-gray-400 hover:text-red-300 hover:bg-red-500/10 border border-border transition-colors"
                        title={t("delete")}
                      >
                        <Trash2 className="w-3 h-3" />
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={pending !== null}
        title={pending?.type === "revoke" ? t("confirmRevoke.title") : t("confirmDelete.title")}
        message={
          pending?.type === "revoke" ? t("confirmRevoke.message") : t("confirmDelete.message")
        }
        confirmLabel={
          pending?.type === "revoke" ? t("confirmRevoke.confirm") : t("confirmDelete.confirm")
        }
        cancelLabel={t("modal.cancel")}
        destructive
        busy={busy}
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
