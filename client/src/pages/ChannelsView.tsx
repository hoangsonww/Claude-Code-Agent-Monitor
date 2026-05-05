/**
 * @file ChannelsView.tsx
 * @description Read-only browser for Claude Code's `/channels` configuration
 * — slack/telegram/discord/imessage/webhook destinations configured in
 * `~/.claude.json` (project-scoped) or `~/.claude/settings.json` (user-scoped).
 * Card layout that adapts to mobile (single column). Shows a summary header,
 * one card per channel, and a "raw" expandable JSON view for debugging.
 *
 * Editing/configuration is intentionally deferred to a later phase.
 */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Hash,
  RefreshCw,
  Send,
  Slack,
  Smartphone,
  Globe,
  MessageSquare,
} from "lucide-react";
import {
  useChannels,
  useChannelsRaw,
  type ChannelRecord,
} from "../hooks/useChannels";

// ── Helpers ─────────────────────────────────────────────────────────────────

function channelType(c: ChannelRecord): string {
  return (c.type || c.kind || "unknown") as string;
}

function channelDisplayName(c: ChannelRecord, idx: number): string {
  if (c.name && typeof c.name === "string") return c.name;
  if (typeof c.id === "string") return c.id;
  return `${channelType(c)} #${idx + 1}`;
}

// Fields that are likely to contain secrets — show only a "configured" badge,
// never the value. We're conservative here and rely on substring matching so
// new channel types don't accidentally leak credentials.
const SECRET_FIELD_RE = /token|secret|webhook|password|key|signing/i;

// Fields that are managed by us (the dashboard surface) and should NOT show in
// the per-channel metadata list.
const MANAGED_FIELDS = new Set(["name", "type", "kind", "scope", "id"]);

function TypeIcon({ type }: { type: string }) {
  const className = "w-4 h-4 flex-shrink-0";
  switch (type.toLowerCase()) {
    case "slack":
      return <Slack className={`${className} text-pink-400`} />;
    case "telegram":
      return <Send className={`${className} text-sky-400`} />;
    case "discord":
      return <MessageSquare className={`${className} text-indigo-400`} />;
    case "imessage":
      return <Smartphone className={`${className} text-emerald-400`} />;
    case "webhook":
      return <Globe className={`${className} text-amber-400`} />;
    default:
      return <Hash className={`${className} text-gray-400`} />;
  }
}

// ── Banners (mirror MemoryView for visual consistency) ──────────────────────

function DisabledBanner() {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-3">
      <AlertCircle className="w-8 h-8 text-accent" />
      <h3 className="text-lg font-semibold text-gray-100">Channels routes disabled</h3>
      <p className="text-sm text-gray-400 max-w-md">
        Set <code className="text-accent">ORCHESTRATOR_ENABLED=1</code> in your{" "}
        <code className="text-accent">.env</code> and restart the server to enable read-only
        channels browsing.
      </p>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="card p-4 flex items-center gap-3 border border-red-500/40">
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-400 flex-1">{error}</span>
      {onRetry ? (
        <button className="btn-ghost text-xs" onClick={onRetry}>
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function ChannelsView() {
  const channels = useChannels();
  const raw = useChannelsRaw();
  const [showRaw, setShowRaw] = useState(false);

  if (channels.disabled) return <DisabledBanner />;

  if (channels.loading && !channels.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }

  if (channels.error) {
    return <ErrorBanner error={channels.error} onRetry={channels.reload} />;
  }

  const data = channels.data;
  const list = data?.channels ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
            <Hash className="w-6 h-6 text-accent" />
            Channels
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Read-only view of Claude Code's <code>/channels</code> configuration. Editing comes
            later.
          </p>
        </div>
        <button
          className="btn-ghost text-sm border border-border hover:border-border-light"
          onClick={() => {
            channels.reload();
            raw.reload();
          }}
          aria-label="Reload channels"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {summary ? <SummaryStrip summary={summary} /> : null}

      {data?.errors?.length ? (
        <div className="card p-3 border border-amber-500/40">
          <p className="text-xs text-amber-300 font-medium mb-1">Config parse warnings</p>
          <ul className="text-xs text-amber-200/80 space-y-0.5">
            {data.errors.map((e, i) => (
              <li key={i}>
                <code>{e.source}</code>: {e.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyChannels sources={data?.sources} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((c, idx) => (
            <ChannelCard key={`${c.scope}-${idx}-${channelDisplayName(c, idx)}`} channel={c} idx={idx} />
          ))}
        </div>
      )}

      <RawSection
        showRaw={showRaw}
        onToggle={() => setShowRaw((v) => !v)}
        loading={raw.loading}
        error={raw.error}
        data={raw.data}
      />
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function SummaryStrip({
  summary,
}: {
  summary: NonNullable<ReturnType<typeof useChannels>["data"]>["summary"];
}) {
  const types = Object.entries(summary.byType);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
      <Stat label="Total" value={summary.total} />
      <Stat label="User scope" value={summary.byScope.user} />
      <Stat label="Project scope" value={summary.byScope.project} />
      <Stat
        label="Types"
        value={
          types.length === 0
            ? "—"
            : types.map(([t, n]) => `${t}:${n}`).join(", ")
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm text-gray-100 font-medium truncate" title={String(value)}>
        {value}
      </div>
    </div>
  );
}

function EmptyChannels({
  sources,
}: {
  sources?: { settingsJson: string; claudeJson: string; cwd: string };
}) {
  return (
    <div className="card p-6 text-center">
      <Hash className="w-8 h-8 text-gray-500 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-gray-200 mb-1">No channels configured</h3>
      <p className="text-sm text-gray-400 max-w-md mx-auto">
        Channels are how external systems (Slack, Telegram, Discord, iMessage, generic webhooks)
        push messages into a Claude Code session. None are configured yet for this user or
        project.
      </p>
      {sources ? (
        <div className="mt-4 text-[11px] text-gray-500 space-y-0.5">
          <p>
            User scope: <code>{sources.settingsJson}</code>
          </p>
          <p>
            Project scope: <code>{sources.claudeJson}</code> →{" "}
            <code>projects[{sources.cwd}].channels</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ChannelCard({ channel, idx }: { channel: ChannelRecord; idx: number }) {
  const type = channelType(channel);
  const name = channelDisplayName(channel, idx);
  const meta = useMemo(() => {
    const entries: { key: string; value: unknown; secret: boolean }[] = [];
    for (const [k, v] of Object.entries(channel)) {
      if (MANAGED_FIELDS.has(k)) continue;
      const secret = SECRET_FIELD_RE.test(k);
      entries.push({ key: k, value: v, secret });
    }
    return entries;
  }, [channel]);

  return (
    <article className="card p-4 flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <TypeIcon type={type} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate" title={name}>
            {name}
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{type}</p>
        </div>
        <ScopeBadge scope={channel.scope} />
      </header>

      {meta.length > 0 ? (
        <dl className="text-xs space-y-1.5 border-t border-border pt-3">
          {meta.map((m) => (
            <div key={m.key} className="flex items-baseline gap-2 min-w-0">
              <dt className="text-gray-500 flex-shrink-0">{m.key}</dt>
              <dd className="text-gray-300 truncate flex-1 text-right" title={String(m.value)}>
                {m.secret ? (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    configured
                  </span>
                ) : (
                  <span className="font-mono">{formatValue(m.value)}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[11px] text-gray-500 border-t border-border pt-3">No metadata.</p>
      )}
    </article>
  );
}

function ScopeBadge({ scope }: { scope: "user" | "project" }) {
  const className =
    scope === "project"
      ? "bg-accent/15 text-accent border-accent/30"
      : "bg-surface-2 text-gray-300 border-border";
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${className}`}
    >
      {scope}
    </span>
  );
}

function formatValue(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return v.length > 60 ? v.slice(0, 57) + "…" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function RawSection({
  showRaw,
  onToggle,
  loading,
  error,
  data,
}: {
  showRaw: boolean;
  onToggle: () => void;
  loading: boolean;
  error: string | null;
  data: ReturnType<typeof useChannelsRaw>["data"];
}) {
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 text-left"
        onClick={onToggle}
        aria-expanded={showRaw}
      >
        <span className="flex items-center gap-2">
          {showRaw ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-sm font-medium text-gray-100">Raw config</span>
        </span>
        <span className="text-[11px] text-gray-500">
          {data?.sources?.settingsJson ?? ""}
        </span>
      </button>
      {showRaw ? (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          {loading && !data ? (
            <div className="h-24 bg-surface-2 animate-pulse rounded" />
          ) : error ? (
            <ErrorBanner error={error} />
          ) : data ? (
            <>
              <RawBlock
                title="settings.json → channels"
                path={data.sources.settingsJson}
                value={data.settingsChannels}
              />
              <RawBlock
                title={`.claude.json → projects[${data.cwd}].channels`}
                path={data.sources.claudeJson}
                value={data.projectChannels}
              />
              {data.errors.length > 0 ? (
                <div className="text-[11px] text-amber-300">
                  {data.errors.map((e, i) => (
                    <div key={i}>
                      <code>{e.source}</code>: {e.error}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RawBlock({
  title,
  path,
  value,
}: {
  title: string;
  path: string;
  value: unknown;
}) {
  const empty = value === null || value === undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-gray-200">{title}</p>
        <p className="text-[10px] text-gray-500 truncate" title={path}>
          {path}
        </p>
      </div>
      {empty ? (
        <p className="text-[11px] text-gray-500 italic">Not present.</p>
      ) : (
        <pre className="text-[11px] text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed bg-surface-2 rounded p-2 max-h-64 overflow-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default ChannelsView;
