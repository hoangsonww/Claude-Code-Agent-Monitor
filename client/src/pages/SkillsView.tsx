/**
 * @file SkillsView.tsx
 * @description Read-only viewer for installed Claude Code skills, subagents,
 * plugins, and registered marketplaces. Tabbed UI; each tab is a card list.
 * Clicking a skill loads its full SKILL.md body into a side/expandable pane.
 * Mobile-friendly (stacks to a single column, accordion for the file viewer).
 *
 * Install/uninstall belongs to a later phase; this surface is strictly browse.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Plug,
  Puzzle,
  RefreshCw,
  Sparkles,
  Store,
} from "lucide-react";
import {
  useAgents,
  useMarketplaces,
  usePlugins,
  useSkillFile,
  useSkills,
  type AgentSummary,
  type SkillSummary,
} from "../hooks/useSkills";

type Tab = "skills" | "agents" | "plugins" | "marketplaces";
type ScopeFilter = "all" | "user" | "project" | "plugin";

function formatBytes(n: number): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(ms: number): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

// Disabled / error banners — same visual treatment as MemoryView.

function DisabledBanner() {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-3">
      <AlertCircle className="w-8 h-8 text-accent" />
      <h3 className="text-lg font-semibold text-gray-100">Skills routes disabled</h3>
      <p className="text-sm text-gray-400 max-w-md">
        Set <code className="text-accent">ORCHESTRATOR_ENABLED=1</code> in your{" "}
        <code className="text-accent">.env</code> and restart the server to enable read-only
        skills/plugins browsing.
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

// Main viewer.

export function SkillsView() {
  const [tab, setTab] = useState<Tab>("skills");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" />
            Skills &amp; Plugins
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Read-only browse of installed skills, subagents, plugins, and marketplaces.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Skills tabs">
          <TabButton active={tab === "skills"} onClick={() => setTab("skills")} icon={Sparkles}>
            Skills
          </TabButton>
          <TabButton active={tab === "agents"} onClick={() => setTab("agents")} icon={Bot}>
            Subagents
          </TabButton>
          <TabButton active={tab === "plugins"} onClick={() => setTab("plugins")} icon={Puzzle}>
            Plugins
          </TabButton>
          <TabButton
            active={tab === "marketplaces"}
            onClick={() => setTab("marketplaces")}
            icon={Store}
          >
            Marketplaces
          </TabButton>
        </div>
      </div>

      {tab === "skills" ? <SkillsPane /> : null}
      {tab === "agents" ? <AgentsPane /> : null}
      {tab === "plugins" ? <PluginsPane /> : null}
      {tab === "marketplaces" ? <MarketplacesPane /> : null}
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <button
      role="tab"
      aria-selected={props.active}
      className={
        props.active
          ? "btn-primary text-sm"
          : "btn-ghost text-sm border border-border hover:border-border-light"
      }
      onClick={props.onClick}
    >
      <Icon className="w-4 h-4" />
      {props.children}
    </button>
  );
}

// Skills tab.

function scopeKind(scope: string): ScopeFilter {
  if (scope === "user") return "user";
  if (scope === "project") return "project";
  if (scope.startsWith("plugin:")) return "plugin";
  return "all";
}

function SkillsPane() {
  const skills = useSkills();
  const [filter, setFilter] = useState<ScopeFilter>("all");
  const [selected, setSelected] = useState<{ scope: string; name: string } | null>(null);

  const list = useMemo(() => {
    const all = skills.data?.skills ?? [];
    if (filter === "all") return all;
    return all.filter((s) => scopeKind(s.scope) === filter);
  }, [skills.data, filter]);

  // Auto-select first item when list arrives so the right pane is not empty.
  useEffect(() => {
    if (selected) return;
    const first = list[0];
    if (first) setSelected({ scope: first.scope, name: first.id });
  }, [list, selected]);

  const file = useSkillFile(selected?.scope ?? null, selected?.name ?? null);

  if (skills.disabled) return <DisabledBanner />;
  if (skills.loading && !skills.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }
  if (skills.error) return <ErrorBanner error={skills.error} onRetry={skills.reload} />;

  const all = skills.data?.skills ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scope filter">
          {(
            [
              ["all", `All (${all.length})`],
              ["user", "User"],
              ["project", "Project"],
              ["plugin", "Plugin"],
            ] as [ScopeFilter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              className={
                filter === k
                  ? "btn-primary text-xs"
                  : "btn-ghost text-xs border border-border hover:border-border-light"
              }
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={skills.reload}
          aria-label="Reload skills"
          title="Reload"
        >
          <RefreshCw className="w-3 h-3" />
          Reload
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card p-6 text-center">
          <Sparkles className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No skills found in this scope.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
          {/* Left pane — list of skills */}
          <aside className="card p-2 max-h-[calc(100vh-14rem)] overflow-auto">
            <ul className="space-y-1">
              {list.map((s) => (
                <SkillRow
                  key={`${s.scope}:${s.id}`}
                  skill={s}
                  selected={selected?.scope === s.scope && selected?.name === s.id}
                  onSelect={() => setSelected({ scope: s.scope, name: s.id })}
                />
              ))}
            </ul>
          </aside>

          {/* Right pane — full SKILL.md content */}
          <section className="card p-4 min-h-[24rem]">
            <SkillFileViewer
              loading={file.loading}
              error={file.error}
              name={selected?.name ?? null}
              scope={selected?.scope ?? null}
              frontmatter={file.data?.frontmatter ?? null}
              body={file.data?.body ?? null}
              size={file.data?.size}
              mtime={file.data?.mtime}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function SkillRow(props: { skill: SkillSummary; selected: boolean; onSelect: () => void }) {
  const { skill, selected, onSelect } = props;
  return (
    <li>
      <button
        className={
          "w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-surface-2 " +
          (selected ? "bg-surface-2 text-gray-100" : "text-gray-300")
        }
        onClick={onSelect}
      >
        <div className="flex items-center gap-1.5">
          <FileText className="w-3 h-3 flex-shrink-0 text-accent/70" />
          <span className="truncate flex-1 font-medium" title={skill.name}>
            {skill.name}
          </span>
          <ScopePill scope={skill.scope} />
        </div>
        {skill.description ? (
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 ml-4.5">
            {skill.description}
          </p>
        ) : null}
      </button>
    </li>
  );
}

function ScopePill({ scope }: { scope: string }) {
  let label = scope;
  let cls = "bg-surface-2 text-gray-400";
  if (scope === "user") {
    label = "user";
    cls = "bg-blue-500/15 text-blue-300";
  } else if (scope === "project") {
    label = "project";
    cls = "bg-emerald-500/15 text-emerald-300";
  } else if (scope.startsWith("plugin:")) {
    label = scope.slice("plugin:".length);
    cls = "bg-purple-500/15 text-purple-300";
  }
  return (
    <span
      className={
        "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 " + cls
      }
      title={scope}
    >
      {label}
    </span>
  );
}

function SkillFileViewer(props: {
  loading: boolean;
  error: string | null;
  name: string | null;
  scope: string | null;
  frontmatter: Record<string, string> | null;
  body: string | null;
  size?: number;
  mtime?: number;
}) {
  if (!props.name) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <FileText className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-sm text-gray-500">Select a skill to view its SKILL.md.</p>
      </div>
    );
  }
  if (props.error) return <ErrorBanner error={props.error} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border">
        <h2 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          {props.name}
          {props.scope ? <ScopePill scope={props.scope} /> : null}
        </h2>
        <div className="text-xs text-gray-500 flex items-center gap-3">
          {typeof props.size === "number" ? <span>{formatBytes(props.size)}</span> : null}
          {props.mtime ? <span>{formatTime(props.mtime)}</span> : null}
        </div>
      </div>
      {props.loading && !props.body ? (
        <div className="h-64 bg-surface-2 animate-pulse rounded" />
      ) : (
        <>
          {props.frontmatter && Object.keys(props.frontmatter).length > 0 ? (
            <div className="bg-surface-2 rounded p-3 text-xs">
              <h3 className="uppercase tracking-wider text-gray-500 text-[10px] mb-2">
                Frontmatter
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
                {Object.entries(props.frontmatter).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-gray-500">{k}</dt>
                    <dd className="text-gray-300 break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[calc(100vh-22rem)] overflow-auto">
            {props.body ?? ""}
          </pre>
        </>
      )}
    </div>
  );
}

// Subagents tab.

function AgentsPane() {
  const agents = useAgents();
  if (agents.disabled) return <DisabledBanner />;
  if (agents.loading && !agents.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }
  if (agents.error) return <ErrorBanner error={agents.error} onRetry={agents.reload} />;
  const list = agents.data?.agents ?? [];
  if (list.length === 0) {
    return (
      <div className="card p-6 text-center">
        <Bot className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No subagents found.</p>
        <p className="text-xs text-gray-500 mt-1">
          Add markdown files under <code>~/.claude/agents/</code> or{" "}
          <code>.claude/agents/</code>.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {list.map((a) => (
        <AgentCard key={`${a.scope}:${a.id}`} agent={a} />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-medium text-gray-100 truncate" title={agent.name}>
            {agent.name}
          </span>
        </div>
        <ScopePill scope={agent.scope} />
      </div>
      {agent.description ? (
        <p className="text-xs text-gray-400 mb-3 line-clamp-3">{agent.description}</p>
      ) : null}
      <dl className="text-[11px] text-gray-500 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5">
        {agent.model ? (
          <>
            <dt>Model</dt>
            <dd className="text-gray-400">{agent.model}</dd>
          </>
        ) : null}
        {agent.tools ? (
          <>
            <dt>Tools</dt>
            <dd className="text-gray-400 break-words">{agent.tools}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-[10px] text-gray-600 mt-2 break-all" title={agent.path}>
        {agent.path}
      </p>
    </div>
  );
}

// Plugins tab.

function PluginsPane() {
  const plugins = usePlugins();
  if (plugins.disabled) return <DisabledBanner />;
  if (plugins.loading && !plugins.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }
  if (plugins.error) return <ErrorBanner error={plugins.error} onRetry={plugins.reload} />;

  const entries = Object.entries(plugins.data?.plugins ?? {});
  if (entries.length === 0) {
    return (
      <div className="card p-6 text-center">
        <Plug className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No installed plugins.</p>
        <p className="text-xs text-gray-500 mt-1 break-all">{plugins.data?.path}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 break-all">
        {entries.length} plugin(s) — registry at <code>{plugins.data?.path}</code>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.map(([id, value]) => (
          <PluginCard key={id} id={id} value={value} />
        ))}
      </div>
    </div>
  );
}

function PluginCard({ id, value }: { id: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  // Pull out a few standard fields if value is an array of installs.
  const first = Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) : undefined;
  const scope =
    first && typeof first.scope === "string" ? (first.scope as string) : null;
  const version =
    first && typeof first.version === "string" ? (first.version as string) : null;
  const installedAt =
    first && typeof first.installedAt === "string" ? (first.installedAt as string) : null;

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-surface-2"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <Plug className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-medium text-gray-100 truncate flex-1" title={id}>
            {id}
          </span>
          {scope ? <ScopePill scope={scope} /> : null}
        </div>
        <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 ml-6">
          {version ? <span>v{version}</span> : null}
          {installedAt ? <span title={installedAt}>installed {installedAt.slice(0, 10)}</span> : null}
        </div>
      </button>
      {open ? (
        <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words font-mono leading-relaxed bg-surface-2 max-h-80 overflow-auto px-4 py-3 border-t border-border">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

// Marketplaces tab.

function MarketplacesPane() {
  const mp = useMarketplaces();
  if (mp.disabled) return <DisabledBanner />;
  if (mp.loading && !mp.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }
  if (mp.error) return <ErrorBanner error={mp.error} onRetry={mp.reload} />;

  const entries = Object.entries(mp.data?.marketplaces ?? {});
  if (entries.length === 0) {
    return (
      <div className="card p-6 text-center">
        <Store className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No registered marketplaces.</p>
        <p className="text-xs text-gray-500 mt-1 break-all">{mp.data?.path}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 break-all">
        {entries.length} marketplace(s) — registry at <code>{mp.data?.path}</code>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.map(([id, value]) => (
          <MarketplaceCard key={id} id={id} value={value} />
        ))}
      </div>
    </div>
  );
}

function MarketplaceCard({ id, value }: { id: string; value: unknown }) {
  const [open, setOpen] = useState(false);
  const v = (value && typeof value === "object" ? (value as Record<string, unknown>) : {}) as {
    source?: { source?: string; repo?: string; url?: string };
    installLocation?: string;
    lastUpdated?: string;
    autoUpdate?: boolean;
  };
  const sourceLabel =
    v.source?.source === "github"
      ? `github:${v.source?.repo ?? "?"}`
      : v.source?.source === "git"
        ? `git:${v.source?.url ?? "?"}`
        : v.source?.source ?? "—";

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full text-left p-4 hover:bg-surface-2"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <Store className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-medium text-gray-100 truncate flex-1" title={id}>
            {id}
          </span>
          {v.autoUpdate ? (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
              auto
            </span>
          ) : null}
        </div>
        <div className="text-xs text-gray-500 mt-1.5 ml-6 break-all">{sourceLabel}</div>
        {v.lastUpdated ? (
          <div className="text-[10px] text-gray-600 mt-0.5 ml-6">
            updated {v.lastUpdated.slice(0, 10)}
          </div>
        ) : null}
      </button>
      {open ? (
        <pre className="text-[11px] text-gray-400 whitespace-pre-wrap break-words font-mono leading-relaxed bg-surface-2 max-h-80 overflow-auto px-4 py-3 border-t border-border">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export default SkillsView;
