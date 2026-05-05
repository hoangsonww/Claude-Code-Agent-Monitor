/**
 * @file PushSubscribeButton.tsx
 * @description Self-contained UI control for managing the dashboard PWA's push
 * notification subscription. Handles every supported state in
 * `usePushSubscription` (loading / unsupported / denied / supported /
 * subscribed) plus an inline error row.
 *
 * Uses the existing Tailwind tokens (`btn-primary`, `btn-ghost`, `card`) so it
 * blends with the rest of the dashboard without bringing new dependencies.
 */
import { Bell, BellOff, BellRing, ShieldX } from "lucide-react";
import { usePushSubscription } from "../../hooks/usePushSubscription";

interface PushSubscribeButtonProps {
  /** Optional className applied to the wrapper. */
  className?: string;
  /** When true, render as a single inline button without the surrounding card. */
  compact?: boolean;
}

export function PushSubscribeButton({ className = "", compact = false }: PushSubscribeButtonProps) {
  const { status, error, subscribe, unsubscribe } = usePushSubscription();

  const wrapperClass = compact ? className : `card p-4 ${className}`.trim();

  if (status === "loading") {
    return (
      <div className={wrapperClass}>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Bell className="w-4 h-4" aria-hidden />
          Checking notification support…
        </div>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className={wrapperClass}>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <BellOff className="w-4 h-4" aria-hidden />
          Notifications not supported on this device.
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className={wrapperClass}>
        <div className="flex items-center gap-2 text-xs text-amber-300">
          <ShieldX className="w-4 h-4" aria-hidden />
          Notifications blocked. Update your browser site settings to allow them.
        </div>
        {error && <p className="mt-2 text-xs text-red-400 break-all">{error}</p>}
      </div>
    );
  }

  if (status === "subscribed") {
    return (
      <div className={wrapperClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <BellRing className="w-4 h-4" aria-hidden />
            Push notifications enabled on this device.
          </div>
          <button
            type="button"
            onClick={() => {
              void unsubscribe();
            }}
            className="btn-ghost"
            aria-label="Disable push notifications on this device"
          >
            <BellOff className="w-4 h-4" aria-hidden />
            Disable
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400 break-all">{error}</p>}
      </div>
    );
  }

  // status === "supported"
  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Bell className="w-4 h-4 text-gray-500" aria-hidden />
          Get a push notification when Claude Code is waiting for you.
        </div>
        <button
          type="button"
          onClick={() => {
            void subscribe();
          }}
          className="btn-primary"
          aria-label="Enable push notifications on this device"
        >
          <BellRing className="w-4 h-4" aria-hidden />
          Enable notifications
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400 break-all">{error}</p>}
    </div>
  );
}

export default PushSubscribeButton;
