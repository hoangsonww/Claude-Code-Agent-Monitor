/**
 * @file ConfirmModal.tsx
 * @description Centered confirmation dialog for destructive or irreversible
 * actions (delete webhook, remove alert rule, etc.). Replaces `window.confirm`
 * with themed UI that matches the dashboard and supports a loading (`busy`)
 * state on the confirm button.
 *
 * ## Dismissal
 * Clicking the backdrop, pressing Escape, or clicking the X cancels. The confirm
 * button can be styled non-destructive for neutral confirmations.
 *
 * ## Accessibility
 * Focus moves to Cancel on open (safer default), Tab cycles within the dialog,
 * Escape cancels, and focus restores to the previously focused element on close.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

/** Props for {@link ConfirmModal}. */
export interface ConfirmModalProps {
  /** When false, nothing is rendered. */
  open: boolean;
  /** Dialog heading. */
  title: string;
  /** Optional supporting message below the title. */
  message?: string;
  /** Primary action label (e.g. "Delete"). */
  confirmLabel: string;
  /** Secondary cancel label. */
  cancelLabel: string;
  /** When true (default), confirm button uses red destructive styling. */
  destructive?: boolean;
  /** Disables confirm while an async delete is in flight. */
  busy?: boolean;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called on cancel, backdrop click, Escape, or X. */
  onCancel: () => void;
}

/**
 * Modal confirmation overlay.
 * @param props See {@link ConfirmModalProps}.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Prefer Cancel so Enter/activation doesn't immediately destroy data.
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-xl border border-border bg-surface-1 shadow-xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
      >
        <div className="flex items-start gap-3 p-5">
          {destructive && (
            <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-sm font-semibold text-gray-100">
              {title}
            </h3>
            {message && (
              <p id={messageId} className="text-xs text-gray-400 mt-1 leading-relaxed">
                {message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-300 p-1 -mt-1 -mr-1"
            aria-label={cancelLabel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="btn-ghost border border-border text-xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
              destructive
                ? "text-red-200 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25"
                : "btn-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
