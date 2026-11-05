/**
 * @file SnapshotStorage.tsx
 * @description Settings card for the durable transcript snapshots (issue
 * #358) — the copies under the dashboard data dir that keep the Conversation
 * tab working after Claude Code, Codex, and Cursor delete their own
 * transcripts. Shows per-provider size, the env-configured retention policy,
 * a lossless "compress now" action, and a prune flow that must be previewed
 * (server dry run) before it can be applied, because a pruned snapshot may be
 * the only remaining copy of a conversation.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/SnapshotStorage.tsx
 * **Area:** client component
 * **Responsibility:**
 * Settings card for the durable transcript snapshots (issue #358) — the copies under the dashboard
 * data dir that keep the Conversation tab working after Claude Code, Codex, and Cursor delete their
 * own transcripts. Shows per-provider size, the env-configured retention policy, a lossless
 * "compress now" action, and a prune flow that must be previewed (server dry run) before it can be
 * applied, because a pruned snapshot may be the only remaining copy of a conversation.
 *
 * ## Architectural boundary
 * - This component should express one reusable UI responsibility through typed props and observable
 *   callbacks.
 * - Network orchestration belongs in pages, hooks, or the typed API client unless this component
 *   explicitly owns the workflow.
 * - Visual state must remain a projection of props and local interaction state rather than a second
 *   server truth.
 *
 * ## Local dependency edges
 * - `../lib/api` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `../lib/format` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 * - `./Checkbox` — repository-local contract consumed by this module; review its exports before
 *   changing assumptions here.
 *
 * ## Package dependency edges
 * - `lucide-react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `react-i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Public surface
 * - `formatStorageBytes` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 * - `SnapshotStorage` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `Criteria` (type) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `formatStorageBytes` (function) — top-level declaration that helps orient code review and
 *   focused test selection.
 * - `GIB` (variable) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SnapshotStorage` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `toRequest` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 *
 * ## React and framework hooks
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `settings` — visible copy resolves through this namespace; key and interpolation parity applies
 *   to every supported locale.
 *
 * ## Area invariants
 * - Keep prop meaning and callback timing stable; parent components often rely on both even when
 *   types still compile.
 * - Render valid semantic controls with accessible names, focus behavior, disabled states, and
 *   keyboard operation.
 * - Keep visible strings in the appropriate i18n namespace rather than embedding English-only
 *   literals.
 * - Use shared design tokens and existing primitives so light/dark styling and compact layouts
 *   remain coherent.
 * - Avoid mutating arrays or objects received through props; derived display data should be
 *   computed immutably.
 * - Make empty and unavailable values explicit instead of rendering misleading zeroes or
 *   placeholder punctuation.
 * - Keep event handlers narrow and prevent accidental bubbling only when the enclosing interaction
 *   requires it.
 * - Do not duplicate server validation or destructive gates as if client-side checks were
 *   authoritative.
 * - Preserve responsive behavior at narrow widths and avoid fixed dimensions that clip translated
 *   copy.
 * - Prefer stable keys derived from entity identity over array indexes for live, filtered, or
 *   reordered collections.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/SnapshotStorage.tsx` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Eye, PackageOpen, RefreshCw, Trash2 } from "lucide-react";
import { api, type SnapshotPruneResult, type SnapshotStorage as Storage } from "../lib/api";
import { Checkbox } from "./Checkbox";
import { fmt } from "../lib/format";

/** Bytes in one gibibyte; the size cap is entered in GB and converted with this. */
const GIB = 1024 ** 3;

/**
 * Human-readable size from bytes up to terabytes, with two decimals from GB up.
 *
 * @param bytes - Size in bytes.
 * @returns The formatted size.
 */
export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < GIB) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / GIB).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

/**
 * Prune form state. Numbers are kept as typed strings; empty or non-positive values mean no limit.
 */
type Criteria = { maxAgeDays: string; maxGb: string; orphans: boolean };

/**
 * Turn the prune form into request criteria, omitting limits that are empty or not positive and
 * converting GB to bytes.
 *
 * @param criteria - Form state.
 * @returns Criteria for the prune request.
 */
function toRequest(criteria: Criteria) {
  const days = parseFloat(criteria.maxAgeDays);
  const gb = parseFloat(criteria.maxGb);
  return {
    ...(days > 0 ? { max_age_days: days } : {}),
    ...(gb > 0 ? { max_bytes: Math.floor(gb * GIB) } : {}),
    ...(criteria.orphans ? { orphans: true } : {}),
  };
}

/**
 * Transcript snapshot storage section in Settings. Shows storage per provider and the retention
 * policy from the environment. Offers a manual compression pass and a two-step prune: Preview runs
 * a dry run and lists what would be removed, then Prune asks for a second click and sends the
 * confirmation token. Any change to the criteria clears the confirmation, so the user cannot apply
 * a plan they have not previewed.
 */
export function SnapshotStorage({
  storage,
  onChanged,
}: {
  /**
   * Storage report from `/api/settings/info`; undefined on servers that predate snapshot storage.
   */
  storage: Storage | undefined;
  /** Called after compressing or pruning so the parent can refresh the report. */
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation("settings");
  const [criteria, setCriteria] = useState<Criteria>({
    maxAgeDays: "",
    maxGb: "",
    orphans: false,
  });
  // The preview is tied to the exact criteria it was computed for; editing any
  // field invalidates it so "Prune" always applies what the user just saw.
  const [preview, setPreview] = useState<{ key: string; plan: SnapshotPruneResult } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"compress" | "preview" | "prune" | null>(null);
  const [banner, setBanner] = useState<{ message: string; isError: boolean } | null>(null);

  const request = toRequest(criteria);
  const requestKey = JSON.stringify(request);
  const hasCriteria = Object.keys(request).length > 0;
  const previewMatches = preview?.key === requestKey;

  /**
   * Change the prune criteria, which also cancels any pending confirmation and clears the result
   * banner.
   */
  const update = (patch: Partial<Criteria>) => {
    setCriteria((prev) => ({ ...prev, ...patch }));
    setConfirming(false);
    setBanner(null);
  };

  type Outcome = string | { message: string; isError: boolean } | null;
  /** Run one action with a busy state, showing its outcome or error in the banner. */
  const run = async (kind: "compress" | "preview" | "prune", fn: () => Promise<Outcome>) => {
    setBusy(kind);
    setBanner(null);
    try {
      const outcome = await fn();
      if (typeof outcome === "string") setBanner({ message: outcome, isError: false });
      else if (outcome) setBanner(outcome);
    } catch (err) {
      setBanner({
        message: t("messages.actionFailed", {
          message: err instanceof Error ? err.message : t("messages.unknownError"),
        }),
        isError: true,
      });
    } finally {
      setBusy(null);
    }
  };

  /**
   * Compress eligible snapshots now and report how many were compressed and how much space was
   * saved, plus any that were skipped or failed.
   */
  const handleCompress = () =>
    run("compress", async () => {
      const res = await api.settings.snapshots.compress();
      await onChanged();
      const parts: string[] = [];
      if (res.compressed > 0) {
        parts.push(
          t("snapshots.compressResult", {
            count: res.compressed,
            before: formatStorageBytes(res.bytes_before),
            after: formatStorageBytes(res.bytes_after),
          })
        );
      }
      if (res.failed > 0) parts.push(t("snapshots.compressFailed", { count: res.failed }));
      if (res.skipped_roots.length > 0) {
        const names: Record<string, string> = { claude: "Claude Code", cursor: "Cursor" };
        parts.push(
          t("snapshots.compressSkipped", {
            providers: res.skipped_roots.map((root) => names[root] ?? root).join(", "),
          })
        );
      }
      if (parts.length === 0) return t("snapshots.compressNone");
      // Problems with nothing compressed read as an error; partial success doesn't.
      return { message: parts.join(" "), isError: res.compressed === 0 };
    });

  /** Dry-run the prune with the current criteria and show the plan. */
  const handlePreview = () =>
    run("preview", async () => {
      const plan = await api.settings.snapshots.prune({ ...request, dry_run: true });
      setPreview({ key: requestKey, plan });
      setConfirming(false);
      return null;
    });

  /**
   * Apply the prune. The first click only asks for confirmation; the second sends the prune with
   * its confirmation token and refreshes the storage report.
   */
  const handlePrune = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    return run("prune", async () => {
      const res = await api.settings.snapshots.prune({
        ...request,
        dry_run: false,
        confirm: "PRUNE_SNAPSHOTS",
      });
      setPreview(null);
      setConfirming(false);
      await onChanged();
      return t("snapshots.pruneResult", {
        count: res.candidate_sessions,
        size: formatStorageBytes(res.removed_bytes),
      });
    });
  };

  const policy = storage?.policy;
  const providers: Array<{ key: "claude" | "codex" | "cursor"; label: string }> = [
    { key: "claude", label: "Claude Code" },
    { key: "codex", label: "Codex" },
    { key: "cursor", label: "Cursor" },
  ];

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Archive className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-300">{t("snapshots.title")}</p>
          <p className="text-xs text-gray-500">{t("snapshots.description")}</p>
        </div>
      </div>

      {storage ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-2 rounded-lg px-3 py-3 border-l-2 border-sky-500/20">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">
              {t("snapshots.total")}
            </p>
            <p className="text-xl font-semibold text-gray-200">
              {formatStorageBytes(storage.total_bytes)}
            </p>
            <p className="text-[11px] text-gray-500">
              {t("snapshots.files", {
                count: storage.total_files,
                formatted: fmt(storage.total_files),
              })}
            </p>
          </div>
          {providers.map(({ key, label }) => {
            const root = storage.roots[key];
            return (
              <div
                key={key}
                className="bg-surface-2 rounded-lg px-3 py-3 border-l-2 border-gray-500/20"
                title={root?.path}
              >
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
                <p className="text-xl font-semibold text-gray-200">
                  {formatStorageBytes(root?.bytes ?? 0)}
                </p>
                <p className="text-[11px] text-gray-500">
                  {t("snapshots.compressedShare", {
                    compressed: fmt(root?.compressed_files ?? 0),
                    total: fmt(root?.files ?? 0),
                  })}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-500">{t("snapshots.loading")}</p>
      )}

      {policy && (
        <p className="text-xs text-gray-500">
          {t("snapshots.policy", {
            compression: policy.compress ? t("snapshots.on") : t("snapshots.off"),
            age: policy.max_age_days
              ? t("snapshots.days", { count: policy.max_age_days })
              : t("snapshots.unlimited"),
            size: policy.max_bytes
              ? formatStorageBytes(policy.max_bytes)
              : t("snapshots.unlimited"),
          })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleCompress}
          disabled={busy !== null}
          className="text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 text-gray-400 hover:text-gray-300 hover:bg-surface-4 border border-border"
        >
          {busy === "compress" ? (
            <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
          ) : (
            <PackageOpen className="w-3 h-3 inline mr-1" />
          )}
          {t("snapshots.compressNow")}
        </button>
        <span className="text-[11px] text-gray-500">{t("snapshots.compressHint")}</span>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-300">{t("snapshots.pruneTitle")}</p>
          <p className="text-[11px] text-gray-500">{t("snapshots.pruneDesc")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-surface-2 rounded-lg px-4 py-3">
            <label className="text-xs text-gray-400 block mb-2">{t("snapshots.olderThan")}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={criteria.maxAgeDays}
                placeholder="—"
                onChange={(e) => update({ maxAgeDays: e.target.value })}
                className="input w-20 text-sm text-right font-mono"
              />
              <span className="text-xs text-gray-500">{t("common:days")}</span>
            </div>
          </div>
          <div className="bg-surface-2 rounded-lg px-4 py-3">
            <label className="text-xs text-gray-400 block mb-2">{t("snapshots.keepUnder")}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={criteria.maxGb}
                placeholder="—"
                onChange={(e) => update({ maxGb: e.target.value })}
                className="input w-20 text-sm text-right font-mono"
              />
              <span className="text-xs text-gray-500">GB</span>
            </div>
          </div>
          <div className="bg-surface-2 rounded-lg px-4 py-3 flex items-center">
            <Checkbox
              checked={criteria.orphans}
              onChange={(v) => update({ orphans: v })}
              label={t("snapshots.includeOrphans")}
              labelClassName="text-xs text-gray-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePreview}
            disabled={busy !== null || !hasCriteria}
            className="text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 text-gray-400 hover:text-gray-300 hover:bg-surface-4 border border-border"
          >
            {busy === "preview" ? (
              <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
            ) : (
              <Eye className="w-3 h-3 inline mr-1" />
            )}
            {t("snapshots.preview")}
          </button>
          <button
            onClick={handlePrune}
            disabled={
              busy !== null || !previewMatches || (preview?.plan.candidate_sessions ?? 0) === 0
            }
            title={previewMatches ? undefined : t("snapshots.previewFirst")}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 ${
              confirming
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "text-gray-400 hover:text-gray-300 hover:bg-surface-4 border border-border"
            }`}
          >
            {busy === "prune" ? (
              <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
            ) : (
              <Trash2 className="w-3 h-3 inline mr-1" />
            )}
            {confirming ? t("snapshots.confirmPrune") : t("snapshots.prune")}
          </button>
        </div>

        {previewMatches && preview && (
          <div className="bg-surface-2 rounded-lg px-4 py-3 space-y-1">
            <p className="text-xs text-gray-300">
              {preview.plan.candidate_sessions === 0
                ? t("snapshots.previewNone")
                : t("snapshots.previewResult", {
                    count: preview.plan.candidate_sessions,
                    files: fmt(preview.plan.candidate_files),
                    size: formatStorageBytes(preview.plan.candidate_bytes),
                    remaining: formatStorageBytes(preview.plan.remaining_bytes),
                  })}
            </p>
            {preview.plan.over_cap_bytes > 0 && (
              <p className="text-[11px] text-amber-400">
                {t("snapshots.overCap", { size: formatStorageBytes(preview.plan.over_cap_bytes) })}
              </p>
            )}
            {confirming && (
              <p className="text-[11px] text-red-400">{t("snapshots.pruneWarning")}</p>
            )}
          </div>
        )}

        {banner && (
          <div
            className={`px-3 py-2 rounded-lg text-xs ${
              banner.isError
                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            }`}
          >
            {banner.message}
          </div>
        )}
      </div>
    </div>
  );
}
