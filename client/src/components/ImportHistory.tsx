/**
 * @file Provider-aware Import History panel for Claude Code and Codex sessions.
 * It presents source-specific guidance and safely imports default folders,
 * external directories, or uploads through the matching live ingest pipeline.
 *
 * Robustness notes:
 *   • Every mode funnels through the same server-side parser used for live
 *     ingestion, so token counts and per-model cost are computed identically.
 *   • Re-imports are idempotent: sessions are deduplicated by session ID and
 *     compaction baselines prevent token double-counting.
 *   • Archive extraction is guarded against path traversal on the server.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/ImportHistory.tsx`
 * **Purpose:** Dashboard module consumed by the React client, MCP tools, or desktop shell depending on deployment mode.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `../lib/api`
 * - `../lib/eventBus`
 * - `../lib/types`
 *
 * ## Public surface
 * - `ImportHistory` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **ImportHistory**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderOpen,
  RefreshCw,
  UploadCloud,
  FileArchive,
  FolderInput,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDrive,
  ListChecks,
  Info,
  Copy,
  Check,
  XCircle,
  History,
  Terminal,
  DatabaseBackup,
  RotateCcw,
  Bot,
  Sparkles,
} from "lucide-react";
import { api, type ImportResult, type ImportBackupResult, type RunProvider } from "../lib/api";
import { eventBus } from "../lib/eventBus";
import type { WSMessage, ImportProgressMessage } from "../lib/types";

type Mode = "rescan" | "path" | "upload" | "backup";

type GuideResponse = Awaited<ReturnType<typeof api.import.guide>>;
type Progress = ImportProgressMessage;

function fallbackGuide(provider: RunProvider): GuideResponse {
  const isCodex = provider === "codex";
  return {
    provider,
    platform: "unknown",
    default_projects_dir: isCodex ? "~/.codex/sessions" : "~/.claude/projects",
    default_projects_dir_display: isCodex ? "~/.codex/sessions" : "~/.claude/projects",
    default_projects_dir_exists: false,
    default_projects_dir_stats: { projects: 0, jsonl_files: 0 },
    archive_command: isCodex
      ? "tar -czf codex-history.tar.gz -C ~/.codex sessions"
      : "tar -czf claude-history.tar.gz -C ~/.claude projects",
    supported_extensions: [".jsonl", ".meta.json", ".zip", ".tar", ".tar.gz", ".tgz", ".gz"],
    max_upload_bytes: 1024 * 1024 * 1024,
    max_upload_files: 2000,
    steps: [],
  };
}

export function ImportHistory() {
  const { t } = useTranslation("settings");
  const [provider, setProvider] = useState<RunProvider>("claude");
  const [mode, setMode] = useState<Mode>("rescan");
  const [guide, setGuide] = useState<GuideResponse | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // "Restore backup" mode: import a full dashboard export (.json) produced by
  // the Export data button — the round-trip for consolidating machines.
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupResult, setBackupResult] = useState<ImportBackupResult | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const providerText = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      provider === "codex" ? t(`import.codex.${key}`, options) : t(`import.${key}`, options),
    [provider, t]
  );
  const providerLabel =
    provider === "codex" ? t("import.providerCodex") : t("import.providerClaude");

  // Reload the guide whenever its provider changes. If the API is unavailable,
  // provider-aware defaults keep the import UI actionable instead of leaving a
  // stale Claude path visible while the Codex tab is selected.
  useEffect(() => {
    let cancelled = false;
    setGuide(null);
    api.import
      .guide(provider)
      .then((response) => {
        if (!cancelled) setGuide(response);
      })
      .catch(() => {
        if (!cancelled) setGuide(fallbackGuide(provider));
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  // Stream import progress from the websocket so long-running imports stay
  // responsive. We only render the latest snapshot.
  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type !== "import.progress") return;
      const next = msg.data as Progress;
      // A second dashboard window may import the other provider at the same
      // time. Keep this panel focused on the selected source instead of
      // replacing its caption with unrelated work.
      if (next.provider && next.provider !== provider) return;
      setProgress(next);
    });
  }, [provider]);

  const reset = useCallback(() => {
    setErrorMsg(null);
    setResult(null);
    setBackupResult(null);
    setProgress(null);
  }, []);

  const handleRescan = async () => {
    reset();
    setRunning(true);
    try {
      const res = await api.import.rescan(provider);
      setResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const handleScanPath = async () => {
    reset();
    const trimmed = folderPath.trim();
    if (!trimmed) {
      setErrorMsg(t("import.errors.pathRequired"));
      return;
    }
    setRunning(true);
    try {
      const res = await api.import.scanPath(trimmed, provider);
      setResult(res);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const handleUpload = async () => {
    reset();
    if (files.length === 0) {
      setErrorMsg(t("import.errors.noFiles"));
      return;
    }
    setRunning(true);
    try {
      const res = await api.import.upload(files, provider);
      setResult(res);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const handleRestore = async () => {
    reset();
    if (!backupFile) {
      setErrorMsg(t("import.errors.noFiles"));
      return;
    }
    setRunning(true);
    try {
      const res = await api.settings.importData(backupFile);
      setBackupResult(res);
      setBackupFile(null);
      if (backupInputRef.current) backupInputRef.current.value = "";
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const onSelectFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => {
      const lower = f.name.toLowerCase();
      return (
        lower.endsWith(".jsonl") ||
        lower.endsWith(".meta.json") ||
        lower.endsWith(".zip") ||
        lower.endsWith(".tar") ||
        lower.endsWith(".tar.gz") ||
        lower.endsWith(".tgz") ||
        lower.endsWith(".gz")
      );
    });
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const next = [...prev];
      for (const f of arr) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) next.push(f);
      }
      return next;
    });
  };

  const copyArchiveCmd = async () => {
    if (!guide) return;
    try {
      await navigator.clipboard.writeText(guide.archive_command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const progressText = (() => {
    if (!progress) return null;
    if (progress.phase === "scan") return t("import.progress.scan");
    if (progress.phase === "extract") {
      return t("import.progress.extract", {
        processed: progress.processed ?? 0,
        total: progress.total ?? 0,
      });
    }
    if (progress.phase === "parse") {
      return t("import.progress.parse", {
        processed: progress.processed ?? 0,
        total: progress.total ?? 0,
      });
    }
    if (progress.phase === "complete") return t("import.progress.complete");
    if (progress.phase === "error") return t("import.progress.error");
    return null;
  })();

  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const chooseProvider = (next: RunProvider) => {
    if (next === provider || running) return;
    setProvider(next);
    setFolderPath("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    reset();
  };

  return (
    <section>
      <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
        <History className="w-4 h-4 text-gray-500" />
        {t("import.title")}
      </h3>
      <p className="text-xs text-gray-500 mb-4">{providerText("description")}</p>

      <div className="card p-5 space-y-5">
        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {t("import.providerLabel")}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{t("import.providerHint")}</p>
          </div>
          <div
            role="tablist"
            aria-label={t("import.providerLabel")}
            className="inline-flex w-full rounded-lg border border-border bg-surface-2 p-1 sm:w-auto"
          >
            <ProviderTab
              active={provider === "claude"}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              label={t("import.providerClaude")}
              onClick={() => chooseProvider("claude")}
            />
            <ProviderTab
              active={provider === "codex"}
              icon={<Bot className="h-3.5 w-3.5" />}
              label={t("import.providerCodex")}
              badge={t("display.beta")}
              onClick={() => chooseProvider("codex")}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-gray-400">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-blue-400" />
          <span>{providerText("scopeNote", { provider: providerLabel })}</span>
        </div>

        {/* Step-by-step instructions */}
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setInstructionsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
              <ListChecks className="w-3.5 h-3.5 text-blue-400" />
              {t("import.instructions")}
            </span>
            <span className="text-[11px] text-gray-500">{instructionsOpen ? "▾" : "▸"}</span>
          </button>
          {instructionsOpen && (
            <div className="px-4 py-4 space-y-4 text-sm text-gray-300 bg-surface-1">
              {/* Default location card */}
              {guide && (
                <div className="flex flex-wrap items-center gap-2 text-xs bg-surface-2 border border-border rounded-md px-3 py-2">
                  <HardDrive className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  <span className="text-gray-400">{providerText("defaultLocation")}:</span>
                  <code className="font-mono text-gray-200 truncate">
                    {guide.default_projects_dir_display}
                  </code>
                  {guide.default_projects_dir_exists ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      {providerText("locationFound")}
                      <span className="text-gray-500 ml-1">
                        · {guide.default_projects_dir_stats.projects}{" "}
                        {providerText("projectsLabel")},{" "}
                        {guide.default_projects_dir_stats.jsonl_files} {providerText("jsonlLabel")}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {providerText("locationMissing")}
                    </span>
                  )}
                </div>
              )}

              {/* Steps */}
              <div className="space-y-3">
                <Step title={providerText("stepLocate")} body={providerText("stepLocateBody")} />
                <Step title={providerText("stepArchive")} body={providerText("stepArchiveBody")}>
                  {guide && (
                    <div className="mt-2 flex items-center gap-2 bg-surface-2 border border-border rounded-md px-3 py-2">
                      <Terminal className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <code className="flex-1 text-xs font-mono text-gray-200 truncate">
                        {guide.archive_command}
                      </code>
                      <button
                        onClick={copyArchiveCmd}
                        className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 flex-shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3" /> {t("import.copied")}
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> {t("import.copy")}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </Step>
                <Step title={providerText("stepChoose")} body={providerText("stepChooseBody")} />
                <Step title={providerText("stepVerify")} body={providerText("stepVerifyBody")} />
              </div>

              <div className="text-[11px] text-gray-500 flex items-start gap-2 pt-2 border-t border-border">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{providerText("accuracyNote")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <ModeButton
            active={mode === "rescan"}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            title={providerText("modeRescan")}
            desc={providerText("modeRescanDesc")}
            onClick={() => setMode("rescan")}
          />
          <ModeButton
            active={mode === "path"}
            icon={<FolderInput className="w-3.5 h-3.5" />}
            title={providerText("modeFolder")}
            desc={providerText("modeFolderDesc")}
            onClick={() => setMode("path")}
          />
          <ModeButton
            active={mode === "upload"}
            icon={<UploadCloud className="w-3.5 h-3.5" />}
            title={providerText("modeUpload")}
            desc={providerText("modeUploadDesc")}
            onClick={() => setMode("upload")}
          />
          <ModeButton
            active={mode === "backup"}
            icon={<DatabaseBackup className="w-3.5 h-3.5" />}
            title={t("import.modeBackup")}
            desc={t("import.modeBackupDesc")}
            onClick={() => setMode("backup")}
          />
        </div>

        {/* Mode panel */}
        <div className="bg-surface-2 border border-border rounded-lg p-4">
          {mode === "rescan" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <FolderOpen className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <code className="font-mono text-xs text-gray-300 truncate">
                  {guide?.default_projects_dir_display ||
                    fallbackGuide(provider).default_projects_dir_display}
                </code>
              </div>
              <button
                onClick={handleRescan}
                disabled={running}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {running ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {providerText("runRescan")}
              </button>
            </div>
          )}

          {mode === "path" && (
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  placeholder={providerText("folderPlaceholder")}
                  className="input w-full text-sm font-mono"
                  spellCheck={false}
                />
                <p className="text-[11px] text-gray-500 mt-1.5">{providerText("folderHelper")}</p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleScanPath}
                  disabled={running}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  {running ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderInput className="w-3.5 h-3.5" />
                  )}
                  {providerText("runScan")}
                </button>
              </div>
            </div>
          )}

          {mode === "upload" && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onSelectFiles(e.dataTransfer.files);
                }}
                className={`border-2 border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition-colors ${
                  dragging
                    ? "border-blue-400 bg-blue-500/5"
                    : "border-border hover:border-gray-500 bg-surface-1"
                }`}
              >
                <UploadCloud className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-300">{providerText("dropzoneHint")}</p>
                <p className="text-[11px] text-gray-500 mt-1">{providerText("dropzoneSub")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".jsonl,.json,.zip,.tar,.tgz,.gz,application/gzip,application/zip,application/x-tar,application/octet-stream"
                  onChange={(e) => onSelectFiles(e.target.files)}
                  className="hidden"
                />
              </div>
              {files.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-surface-3 rounded-md px-3 py-2">
                  <span className="text-gray-400">
                    <FileArchive className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                    {t("import.filesSelected", { count: files.length })}
                    <span className="text-gray-600 ml-2">({formatBytes(totalSize)})</span>
                  </span>
                  <button
                    onClick={() => {
                      setFiles([]);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-gray-500 hover:text-gray-300 text-[11px]"
                  >
                    {t("import.clearSelection")}
                  </button>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={running || files.length === 0}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  {running ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  {providerText("runUpload")}
                </button>
              </div>
            </div>
          )}

          {mode === "backup" && (
            <div className="space-y-3">
              <p className="text-[11px] leading-relaxed text-gray-500">
                {t("import.backupProviderNote")}
              </p>
              <div
                onClick={() => backupInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setBackupFile(f);
                }}
                className={`border-2 border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition-colors ${
                  dragging
                    ? "border-blue-400 bg-blue-500/5"
                    : "border-border hover:border-gray-500 bg-surface-1"
                }`}
              >
                <DatabaseBackup className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-300">{t("import.backupHint")}</p>
                <p className="text-[11px] text-gray-500 mt-1">{t("import.backupSub")}</p>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => setBackupFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
              {backupFile && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-surface-3 rounded-md px-3 py-2">
                  <span className="text-gray-400 min-w-0">
                    <FileArchive className="w-3.5 h-3.5 inline mr-1.5 text-gray-500" />
                    <span className="font-mono truncate">{backupFile.name}</span>
                    <span className="text-gray-600 ml-2">({formatBytes(backupFile.size)})</span>
                  </span>
                  <button
                    onClick={() => {
                      setBackupFile(null);
                      if (backupInputRef.current) backupInputRef.current.value = "";
                    }}
                    className="text-gray-500 hover:text-gray-300 text-[11px]"
                  >
                    {t("import.clearSelection")}
                  </button>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleRestore}
                  disabled={running || !backupFile}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  {running ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  {t("import.runRestore")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* In-flight progress */}
        {running && progressText && (
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-surface-2 border border-border rounded-md px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 flex-shrink-0" />
            <span className="truncate">{progressText}</span>
            {progress?.current && (
              <code className="font-mono text-[11px] text-gray-600 truncate">
                · {progress.current.split("/").slice(-2).join("/")}
              </code>
            )}
          </div>
        )}

        {/* Errors */}
        {errorMsg && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
            <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result summary */}
        {result && !running && (
          <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t("import.result.title")}
              <span className="normal-case font-normal text-emerald-300/80">· {providerLabel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <ResultStat
                label={t("import.result.imported", { count: result.imported })}
                value={result.imported}
                color="text-emerald-300"
              />
              <ResultStat
                label={t("import.result.backfilled", { count: result.backfilled ?? 0 })}
                value={result.backfilled ?? 0}
                color="text-blue-300"
              />
              <ResultStat
                label={t("import.result.skipped", { count: result.skipped })}
                value={result.skipped}
                color="text-gray-400"
              />
              <ResultStat
                label={t("import.result.errors", { count: result.errors })}
                value={result.errors}
                color={result.errors > 0 ? "text-red-300" : "text-gray-500"}
              />
            </div>
            {typeof result.files_scanned === "number" && (
              <p className="text-[11px] text-gray-500">
                {t("import.result.filesScanned", { count: result.files_scanned })}
                {result.path ? ` · ${result.path}` : ""}
              </p>
            )}
          </div>
        )}

        {/* Restore-from-backup result summary */}
        {backupResult && !running && (
          <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t("import.backupResult.title")}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <ResultStat
                label={t("import.backupResult.sessionsImported", {
                  count: backupResult.sessions_imported,
                })}
                value={backupResult.sessions_imported}
                color="text-emerald-300"
              />
              <ResultStat
                label={t("import.backupResult.sessionsSkipped", {
                  count: backupResult.sessions_skipped,
                })}
                value={backupResult.sessions_skipped}
                color="text-gray-400"
              />
              <ResultStat
                label={t("import.backupResult.events", { count: backupResult.events })}
                value={backupResult.events}
                color="text-violet-300"
              />
              <ResultStat
                label={t("import.backupResult.pricing", { count: backupResult.model_pricing })}
                value={backupResult.model_pricing}
                color="text-cyan-300"
              />
            </div>
            <p className="text-[11px] text-gray-500">
              {t("import.backupResult.detail", {
                agents: backupResult.agents,
                workflows: backupResult.workflows,
                runs: backupResult.dashboard_runs,
                rules: backupResult.alert_rules,
              })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Step({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-200">{title}</p>
      <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{body}</p>
      {children}
    </div>
  );
}

function ModeButton({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-colors ${
        active
          ? "border-blue-500/40 bg-blue-500/10"
          : "border-border bg-surface-2 hover:bg-surface-3"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${
          active ? "text-blue-300" : "text-gray-300"
        }`}
      >
        {icon}
        {title}
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">{desc}</p>
    </button>
  );
}

function ProviderTab({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none ${
        active
          ? "bg-blue-500/15 text-blue-200 shadow-sm ring-1 ring-blue-400/30"
          : "text-gray-500 hover:bg-surface-3 hover:text-gray-300"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span className="rounded bg-amber-400/10 px-1 py-0.5 text-[8px] font-bold tracking-wider text-amber-300">
          {badge}
        </span>
      )}
    </button>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-2 rounded-md px-2.5 py-2">
      <p className={`text-sm font-semibold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
