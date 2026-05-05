/**
 * @file MemoryView.tsx
 * @description Read-only browser for Claude Code's auto-memory directory
 * (~/.claude/projects/<encoded>/memory/*.md) plus user-scoped and project-root
 * CLAUDE.md files. Two-pane on desktop (project/file tree on the left, content
 * on the right); single-column accordion on mobile. Markdown is rendered as
 * monospace text — a real markdown renderer is not yet a project dependency,
 * and adding one is out of scope for this read-only phase.
 *
 * Editing memory is intentionally deferred to a later phase; this surface is
 * strictly for browsing.
 */

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Brain,
  ScrollText,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  useProjects,
  useFiles,
  useFile,
  useClaudeMd,
  type ClaudeMdEntry,
} from "../hooks/useMemory";

type Tab = "memory" | "claude-md";

function formatBytes(n: number): string {
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

// ── Disabled / error banners ────────────────────────────────────────────────

function DisabledBanner() {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-3">
      <AlertCircle className="w-8 h-8 text-accent" />
      <h3 className="text-lg font-semibold text-gray-100">Memory routes disabled</h3>
      <p className="text-sm text-gray-400 max-w-md">
        Set <code className="text-accent">ORCHESTRATOR_ENABLED=1</code> in your{" "}
        <code className="text-accent">.env</code> and restart the server to enable read-only memory
        browsing.
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

// ── Main viewer ─────────────────────────────────────────────────────────────

export function MemoryView() {
  const [tab, setTab] = useState<Tab>("memory");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
            <Brain className="w-6 h-6 text-accent" />
            Memory
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Read-only browse of Claude Code's auto-memory and CLAUDE.md files.
          </p>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Memory tabs">
          <button
            role="tab"
            aria-selected={tab === "memory"}
            className={
              tab === "memory"
                ? "btn-primary text-sm"
                : "btn-ghost text-sm border border-border hover:border-border-light"
            }
            onClick={() => setTab("memory")}
          >
            <Brain className="w-4 h-4" />
            Auto-memory
          </button>
          <button
            role="tab"
            aria-selected={tab === "claude-md"}
            className={
              tab === "claude-md"
                ? "btn-primary text-sm"
                : "btn-ghost text-sm border border-border hover:border-border-light"
            }
            onClick={() => setTab("claude-md")}
          >
            <ScrollText className="w-4 h-4" />
            CLAUDE.md
          </button>
        </div>
      </div>

      {tab === "memory" ? <AutoMemoryPane /> : <ClaudeMdPane />}
    </div>
  );
}

// ── Auto-memory two-pane ────────────────────────────────────────────────────

function AutoMemoryPane() {
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const files = useFiles(selectedProject);
  const file = useFile(selectedProject, selectedFile);

  // Auto-pick the first project on initial load for desktop convenience.
  useEffect(() => {
    if (selectedProject) return;
    const first = projects.data?.projects?.[0];
    if (!first) return;
    setSelectedProject(first.id);
    setExpandedProjects((s) => new Set(s).add(first.id));
  }, [projects.data, selectedProject]);

  // When the file list arrives, pre-select the first file.
  useEffect(() => {
    if (selectedFile) return;
    const first = files.data?.files?.[0];
    if (!first) return;
    setSelectedFile(first.name);
  }, [files.data, selectedFile]);

  if (projects.disabled) return <DisabledBanner />;

  if (projects.loading && !projects.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }

  if (projects.error) {
    return <ErrorBanner error={projects.error} onRetry={projects.reload} />;
  }

  const projectList = projects.data?.projects ?? [];

  if (projectList.length === 0) {
    return (
      <div className="card p-6 text-center">
        <FolderOpen className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No projects with auto-memory found.</p>
        <p className="text-xs text-gray-500 mt-1">
          Memory lives at <code>{projects.data?.projectsDir}</code>.
        </p>
      </div>
    );
  }

  function toggleProject(id: string) {
    setExpandedProjects((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (selectedProject !== id) {
      setSelectedProject(id);
      setSelectedFile(null);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-4">
      {/* Left pane — project/file tree */}
      <aside className="card p-3 max-h-[calc(100vh-12rem)] overflow-auto">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs uppercase tracking-wider text-gray-500">
            Projects ({projectList.length})
          </span>
          <button
            className="text-gray-500 hover:text-gray-300"
            onClick={projects.reload}
            aria-label="Reload projects"
            title="Reload"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <ul className="space-y-1">
          {projectList.map((p) => {
            const isExpanded = expandedProjects.has(p.id);
            const isSelected = selectedProject === p.id;
            return (
              <li key={p.id}>
                <button
                  className={
                    "w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center gap-1.5 hover:bg-surface-2 " +
                    (isSelected ? "bg-surface-2 text-gray-100" : "text-gray-300")
                  }
                  onClick={() => toggleProject(p.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  )}
                  <FolderOpen className="w-3 h-3 flex-shrink-0 text-accent/70" />
                  <span className="truncate flex-1" title={p.decodedPath}>
                    {p.decodedPath.split("/").filter(Boolean).slice(-2).join("/") || p.id}
                  </span>
                  <span className="text-[10px] text-gray-500 flex-shrink-0">{p.fileCount}</span>
                </button>
                {isExpanded && isSelected ? (
                  <FileList
                    loading={files.loading}
                    error={files.error}
                    files={files.data?.files ?? []}
                    selected={selectedFile}
                    onSelect={(f) => setSelectedFile(f)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Right pane — file content */}
      <section className="card p-4 min-h-[24rem]">
        <FileViewer
          loading={file.loading}
          error={file.error}
          name={selectedFile}
          content={file.data?.content ?? null}
          size={file.data?.size}
          mtime={file.data?.mtime}
        />
      </section>
    </div>
  );
}

function FileList(props: {
  loading: boolean;
  error: string | null;
  files: { name: string; size: number; mtime: number }[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  if (props.loading && props.files.length === 0) {
    return <div className="ml-5 h-6 bg-surface-2 animate-pulse rounded my-1" />;
  }
  if (props.error) {
    return <p className="ml-5 text-xs text-red-400 my-1">{props.error}</p>;
  }
  if (props.files.length === 0) {
    return <p className="ml-5 text-xs text-gray-500 my-1">No memory files.</p>;
  }
  return (
    <ul className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2">
      {props.files.map((f) => (
        <li key={f.name}>
          <button
            className={
              "w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 hover:bg-surface-2 " +
              (props.selected === f.name ? "bg-accent/15 text-accent" : "text-gray-400")
            }
            onClick={() => props.onSelect(f.name)}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="truncate flex-1" title={f.name}>
              {f.name}
            </span>
            <span className="text-[10px] text-gray-500 flex-shrink-0">{formatBytes(f.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function FileViewer(props: {
  loading: boolean;
  error: string | null;
  name: string | null;
  content: string | null;
  size?: number;
  mtime?: number;
}) {
  if (!props.name) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <FileText className="w-10 h-10 text-gray-600 mb-3" />
        <p className="text-sm text-gray-500">Select a memory file to view its contents.</p>
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
        </h2>
        <div className="text-xs text-gray-500 flex items-center gap-3">
          {typeof props.size === "number" ? <span>{formatBytes(props.size)}</span> : null}
          {props.mtime ? <span>{formatTime(props.mtime)}</span> : null}
        </div>
      </div>
      {props.loading && !props.content ? (
        <div className="h-64 bg-surface-2 animate-pulse rounded" />
      ) : (
        <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[calc(100vh-18rem)] overflow-auto">
          {props.content ?? ""}
        </pre>
      )}
    </div>
  );
}

// ── CLAUDE.md pane ──────────────────────────────────────────────────────────

function ClaudeMdPane() {
  const claudeMd = useClaudeMd();

  if (claudeMd.disabled) return <DisabledBanner />;
  if (claudeMd.loading && !claudeMd.data) {
    return <div className="card h-64 animate-pulse bg-surface-2" />;
  }
  if (claudeMd.error) {
    return <ErrorBanner error={claudeMd.error} onRetry={claudeMd.reload} />;
  }

  const sections: { label: string; entry: ClaudeMdEntry | null }[] = [
    { label: "User CLAUDE.md (~/.claude/CLAUDE.md)", entry: claudeMd.data?.user ?? null },
    { label: "Project CLAUDE.md", entry: claudeMd.data?.project ?? null },
    { label: "Project CLAUDE.local.md", entry: claudeMd.data?.projectLocal ?? null },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <ClaudeMdSection key={s.label} label={s.label} entry={s.entry} />
      ))}
    </div>
  );
}

function ClaudeMdSection({ label, entry }: { label: string; entry: ClaudeMdEntry | null }) {
  const [open, setOpen] = useState(true);
  const present = !!entry?.content;
  const headerExtras = useMemo(() => {
    if (!entry) return "Not found";
    if (entry.error) return entry.error;
    if (typeof entry.size === "number") return formatBytes(entry.size);
    return "";
  }, [entry]);

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <ScrollText className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="text-sm font-medium text-gray-100 truncate">{label}</span>
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0 ml-3">{headerExtras}</span>
      </button>
      {open ? (
        <div className="px-4 pb-4 border-t border-border pt-3">
          {entry?.path ? (
            <p className="text-[10px] text-gray-500 mb-2 break-all">{entry.path}</p>
          ) : null}
          {present ? (
            <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[60vh] overflow-auto">
              {entry!.content}
            </pre>
          ) : (
            <p className="text-xs text-gray-500">
              {entry?.error ? entry.error : "No file at this path."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default MemoryView;
