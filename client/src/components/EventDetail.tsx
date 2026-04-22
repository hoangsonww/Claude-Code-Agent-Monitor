/**
 * @file EventDetail.tsx
 * @description Inline detail view rendered below an event row when expanded.
 * Renders every top-level JSON key from the hook payload as a single row of
 * `key: value`. Scalar values render inline; objects, arrays, and multiline
 * strings render inside a terminal-styled code block (dark bg, monospace) with
 * pretty-printed JSON or the raw text. Event-level fields (ID, session, agent)
 * lead the list so the user gets consistent structure across every event type.
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import type { DashboardEvent } from "../lib/types";

type EventDetailProps = {
  event: DashboardEvent;
};

// Keys from the payload that are already rendered from event-level fields —
// skip them to avoid showing the same value twice. Includes `id` and
// `event_id` defensively in case a future hook payload surfaces them.
const DUPLICATE_KEYS = new Set(["id", "event_id", "session_id", "agent_id"]);

type Row = { key: string; label: string; value: unknown };

export function EventDetail({ event }: EventDetailProps) {
  const { t } = useTranslation("common");

  const parsed = useMemo<Record<string, unknown> | null>(() => {
    if (!event.data) return null;
    try {
      const v = JSON.parse(event.data);
      return v && typeof v === "object" && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [event.data]);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [
      { key: "event_id", label: t("eventDetail.eventId"), value: event.id },
      { key: "session_id", label: t("eventDetail.sessionId"), value: event.session_id },
    ];
    if (event.agent_id) {
      result.push({ key: "agent_id", label: t("eventDetail.agentId"), value: event.agent_id });
    }

    const payloadEntries: Array<[string, unknown]> = parsed
      ? Object.entries(parsed).filter(([k]) => !DUPLICATE_KEYS.has(k))
      : [];
    for (const [k, v] of payloadEntries) {
      result.push({ key: k, label: k, value: v });
    }

    // If JSON parse failed, show the raw data as a single row using the
    // localized raw-payload label rather than a hardcoded "data" string.
    if (!parsed && event.data) {
      result.push({ key: "data", label: t("eventDetail.rawPayload"), value: event.data });
    }

    return result;
  }, [event.id, event.session_id, event.agent_id, event.data, parsed, t]);

  return (
    <div className="bg-surface-2/60 border-t border-border px-5 py-4 animate-slide-up space-y-2">
      {rows.map((row) => (
        <FieldRow key={row.key} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

// ───────────────────────── Field row ─────────────────────────

function FieldRow({ label, value }: { label: string; value: unknown }) {
  if (isInlineScalar(value)) {
    return (
      <div className="grid grid-cols-[160px_1fr] gap-x-4 items-start text-[11px]">
        <div className="text-gray-500 font-mono pt-0.5">{label}</div>
        <div className="text-gray-300 font-mono break-all">
          <ScalarValue value={value} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[160px_1fr] gap-x-4 items-start text-[11px]">
      <div className="text-gray-500 font-mono pt-2">{label}</div>
      <CodeView value={value} />
    </div>
  );
}

function isInlineScalar(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") return !value.includes("\n") && value.length <= 120;
  return false;
}

function ScalarValue({ value }: { value: unknown }) {
  if (value == null) return <span className="text-gray-500 italic">null</span>;
  if (typeof value === "boolean") {
    const color = value
      ? "text-green-400 border-green-500/30 bg-green-500/10"
      : "text-gray-400 border-gray-500/30 bg-gray-500/10";
    return (
      <span className={`inline-block px-2 py-0.5 rounded border ${color}`}>{String(value)}</span>
    );
  }
  return <>{String(value)}</>;
}

// ───────────────────────── Terminal-styled JSON code view ─────────────────────────

function CodeView({ value }: { value: unknown }) {
  const text = typeof value === "string" ? value : safeStringify(value);

  return (
    <div className="relative bg-black/70 border border-border rounded font-mono text-[11px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-black/40">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide">
          {typeof value === "string" ? "text" : Array.isArray(value) ? "array" : "json"}
        </span>
        <CopyButton text={text} />
      </div>
      <pre className="px-3 py-2 text-gray-200 whitespace-pre-wrap break-words max-h-96 overflow-auto">
        {text}
      </pre>
    </div>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// ───────────────────────── Copy button ─────────────────────────

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in insecure contexts — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-surface-2 cursor-pointer"
      aria-label={t("eventDetail.copy")}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? t("eventDetail.copied") : t("eventDetail.copy")}
    </button>
  );
}
