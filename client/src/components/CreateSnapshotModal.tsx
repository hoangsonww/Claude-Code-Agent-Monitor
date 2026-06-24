/**
 * @file CreateSnapshotModal.tsx
 * @description Modal for capturing a session as a shareable read-only snapshot.
 * Lets the author set a title, choose redactions (fetched lazily from
 * /api/snapshots/options when the modal opens), and pick a link expiry. On
 * submit it POSTs to /api/snapshots and surfaces the resulting shareable link
 * with a copy button. Mirrors the app's existing modal patterns (Escape /
 * click-outside cancel, surface-1 card, btn-primary actions).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Check, Copy, ExternalLink, X } from "lucide-react";
import { api } from "../lib/api";
import type { RedactionKey, RedactionOption } from "../lib/types";

type ExpiryChoice = "never" | "1h" | "24h" | "7d";

const EXPIRY_HOURS: Record<ExpiryChoice, number | undefined> = {
  never: undefined,
  "1h": 1,
  "24h": 24,
  "7d": 24 * 7,
};

const EXPIRY_ORDER: ExpiryChoice[] = ["never", "1h", "24h", "7d"];

function snapshotUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/snapshot/${token}`;
}

interface CreateSnapshotModalProps {
  open: boolean;
  sessionId: string;
  onClose: () => void;
  /** Called after a snapshot is successfully created so callers can refresh lists. */
  onCreated?: () => void;
}

export function CreateSnapshotModal({
  open,
  sessionId,
  onClose,
  onCreated,
}: CreateSnapshotModalProps) {
  const { t } = useTranslation("snapshots");
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<RedactionOption[]>([]);
  const [selected, setSelected] = useState<Set<RedactionKey>>(() => new Set());
  const [expiry, setExpiry] = useState<ExpiryChoice>("never");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset transient state and lazily fetch redaction options each time the
  // modal opens. Fetching here (not on mount) keeps the parent page's render
  // path free of /api/snapshots calls.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setSelected(new Set());
    setExpiry("never");
    setSubmitting(false);
    setError(null);
    setCreatedToken(null);
    setCopied(false);

    let cancelled = false;
    // Defensive: test mocks may not include the snapshots namespace.
    if (api.snapshots && typeof api.snapshots.options === "function") {
      api.snapshots
        .options()
        .then((opts) => {
          if (!cancelled) setOptions(opts);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleRedaction = (key: RedactionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const redactions = Array.from(selected);
      const snapshot = await api.snapshots.create({
        session_id: sessionId,
        title: title.trim() || undefined,
        redactions: redactions.length > 0 ? redactions : undefined,
        expires_in_hours: EXPIRY_HOURS[expiry],
      });
      setCreatedToken(snapshot.token);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modal.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(snapshotUrl(createdToken));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const reset = () => {
    setCreatedToken(null);
    setCopied(false);
    setTitle("");
    setSelected(new Set());
    setExpiry("never");
    setError(null);
  };

  const link = createdToken ? snapshotUrl(createdToken) : "";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("modal.title")}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-surface-1 shadow-xl shadow-black/40 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
            <Camera className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-100">{t("modal.title")}</h3>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              {createdToken ? t("modal.successDesc") : t("modal.subtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1 -mt-1 -mr-1"
            aria-label={t("modal.cancel")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {createdToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <Check className="w-4 h-4" />
                <span className="font-medium">{t("modal.successTitle")}</span>
              </div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {t("modal.shareLink")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input w-full font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-ghost border border-border flex-shrink-0"
                  title={t("copyLink")}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? t("copied") : t("copyLink")}
                </button>
              </div>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                {t("viewer.readOnly")}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <>
              {/* Title */}
              <div className="space-y-1.5">
                <label
                  htmlFor="snapshot-title"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                >
                  {t("modal.titleLabel")}
                </label>
                <input
                  id="snapshot-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("modal.titlePlaceholder")}
                  className="input w-full"
                />
              </div>

              {/* Redactions */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {t("modal.redactions")}
                </label>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {t("modal.redactionsHint")}
                </p>
                {options.length === 0 ? (
                  <p className="text-xs text-gray-500 italic pt-1">
                    {t("modal.noRedactionOptions")}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {options.map((opt) => {
                      const checked = selected.has(opt.key);
                      return (
                        <label
                          key={opt.key}
                          className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                            checked
                              ? "border-accent/40 bg-accent/10 text-gray-100"
                              : "border-border bg-surface-2 text-gray-300 hover:bg-surface-3"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRedaction(opt.key)}
                            className="accent-accent w-3.5 h-3.5 flex-shrink-0"
                          />
                          <span className="text-xs font-medium truncate">
                            {t(`redactions.${opt.key}`, opt.label)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Expiry */}
              <div className="space-y-1.5">
                <label
                  htmlFor="snapshot-expiry"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                >
                  {t("modal.expiry")}
                </label>
                <select
                  id="snapshot-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value as ExpiryChoice)}
                  className="input w-full appearance-none cursor-pointer"
                >
                  {EXPIRY_ORDER.map((key) => (
                    <option key={key} value={key}>
                      {t(`modal.expiryOptions.${key}`)}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          {createdToken ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="btn-ghost border border-border text-xs"
              >
                {t("modal.createAnother")}
              </button>
              <button type="button" onClick={onClose} className="btn-primary text-xs">
                {t("modal.done")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost border border-border text-xs"
              >
                {t("modal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {submitting ? t("modal.submitting") : t("modal.submit")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
