/**
 * @file The "Commits" tab on Session Detail: the git commits authored in the
 * session's working directory during its active window (issue #291). Data comes
 * from `GET /api/sessions/:id/commits`, computed fresh server-side from the
 * local repo — nothing is persisted. The panel degrades silently: when the
 * session's cwd is not a git repo (or git is unavailable) the server returns
 * `repo:false` and this component renders a short, honest "not a git repo" note
 * rather than an error. Correlation is best-effort by author date, so the panel
 * states that plainly instead of presenting attribution as certain.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/components/SessionCommits.tsx
 * **Area:** client component
 * **Responsibility:**
 * The "Commits" tab on Session Detail: the git commits authored in the session's working directory
 * during its active window (issue #291). Data comes from `GET /api/sessions/:id/commits` , computed
 * fresh server-side from the local repo — nothing is persisted. The panel degrades silently: when
 * the session's cwd is not a git repo (or git is unavailable) the server returns `repo:false` and
 * this component renders a short, honest "not a git repo" note rather than an error. Correlation is
 * best-effort by author date, so the panel states that plainly instead of presenting attribution as
 * certain.
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
 * - `../lib/types` — repository-local contract consumed by this module; review its exports before
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
 * - `SessionCommits` (function) — exported contract; search downstream imports and tests before
 *   changing its name, shape, or timing.
 *
 * ## Top-level implementation landmarks
 * - `CommitRow` (function) — top-level declaration that helps orient code review and focused test
 *   selection.
 * - `SessionCommits` (function) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `SessionCommitsProps` (interface) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## React and framework hooks
 * - `useEffect` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useState` — lifecycle/state dependency detected in this module; preserve dependency freshness
 *   and cleanup semantics.
 * - `useTranslation` — lifecycle/state dependency detected in this module; preserve dependency
 *   freshness and cleanup semantics.
 *
 * ## Translation namespaces
 * - `sessions` — visible copy resolves through this namespace; key and interpolation parity applies
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
 *   `node scripts/maintain-typescript-docs.ts --check client/src/components/SessionCommits.tsx` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GitCommit,
  GitBranch,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { timeAgo, formatDateTime, truncate } from "../lib/format";
import type { SessionCommits as SessionCommitsData, CommitStat } from "../lib/types";

interface SessionCommitsProps {
  /** The session whose cwd is correlated with git history. */
  sessionId: string;
}

/**
 * Renders the Commits tab. Fetches once on mount (and when the session id
 * changes). The server already caches the git result briefly, so this stays a
 * plain on-demand fetch with no polling.
 */
export function SessionCommits({ sessionId }: SessionCommitsProps) {
  const { t } = useTranslation("sessions");
  const [data, setData] = useState<SessionCommitsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.sessions
      .commits(sessionId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="card p-6 animate-pulse text-sm text-gray-500" aria-busy="true">
        {t("commits.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 flex items-start gap-2 text-sm text-amber-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{t("commits.error")}</span>
      </div>
    );
  }

  // Not a git repository (or git unavailable): a short, non-alarming note.
  if (!data || !data.repo) {
    return (
      <div className="card p-6 flex items-start gap-2 text-sm text-gray-500">
        <GitBranch className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{t("commits.notARepo")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-gray-500">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{t("commits.heuristicNote")}</span>
      </div>

      {data.commits.length === 0 ? (
        <div className="card p-6 flex items-center gap-2 text-sm text-gray-500">
          <GitCommit className="w-4 h-4 flex-shrink-0" />
          <span>{t("commits.noneInWindow")}</span>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {data.commits.map((commit) => (
              <CommitRow key={commit.hash} sessionId={sessionId} commit={commit} />
            ))}
          </ul>
          {data.truncated && (
            <p className="text-xs text-gray-500">{t("commits.truncated", { n: data.count })}</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One commit row with an expandable per-file diff stat. The stat is fetched
 * lazily the first time the row is expanded.
 */
function CommitRow({
  sessionId,
  commit,
}: {
  sessionId: string;
  commit: SessionCommitsData["commits"][number];
}) {
  const { t } = useTranslation("sessions");
  const [open, setOpen] = useState(false);
  const [stat, setStat] = useState<CommitStat | null>(null);
  const [statError, setStatError] = useState(false);
  const [statLoading, setStatLoading] = useState(false);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !stat && !statLoading) {
      setStatLoading(true);
      setStatError(false);
      api.sessions
        .commitStat(sessionId, commit.hash)
        .then(setStat)
        .catch(() => setStatError(true))
        .finally(() => setStatLoading(false));
    }
  }

  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          className="flex-shrink-0 mt-0.5 text-gray-500 hover:text-gray-300 transition-colors"
          aria-expanded={open}
          aria-label={open ? t("commits.collapse") : t("commits.expand")}
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <GitCommit className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 self-center" />
            <span className="text-sm text-gray-200 break-words" title={commit.subject}>
              {truncate(commit.subject, 120)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <code className="font-mono text-violet-300/80">{commit.shortHash}</code>
            <span>{commit.authorName}</span>
            {commit.authorDate && (
              <span title={formatDateTime(commit.authorDate)}>{timeAgo(commit.authorDate)}</span>
            )}
            <span>{t("commits.filesChanged", { n: commit.filesChanged })}</span>
            {commit.insertions > 0 && (
              <span className="text-emerald-400">+{commit.insertions}</span>
            )}
            {commit.deletions > 0 && <span className="text-red-400">-{commit.deletions}</span>}
            {commit.url && (
              <a
                href={commit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
              >
                {t("commits.viewRemote")}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {open && (
            <div className="mt-3 border-t border-border pt-3">
              {statLoading && <p className="text-xs text-gray-500">{t("commits.loadingDiff")}</p>}
              {statError && <p className="text-xs text-amber-400">{t("commits.diffError")}</p>}
              {stat && stat.files.length > 0 && (
                <ul className="space-y-1 font-mono text-xs">
                  {stat.files.map((f) => (
                    <li key={f.path} className="flex items-center gap-2">
                      <span className="truncate text-gray-400" title={f.path}>
                        {f.path}
                      </span>
                      {f.binary ? (
                        <span className="text-gray-500">{t("commits.binary")}</span>
                      ) : (
                        <span className="flex-shrink-0">
                          {f.insertions > 0 && (
                            <span className="text-emerald-400">+{f.insertions}</span>
                          )}{" "}
                          {f.deletions > 0 && <span className="text-red-400">-{f.deletions}</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {stat && stat.files.length === 0 && !statLoading && (
                <p className="text-xs text-gray-500">{t("commits.noFiles")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
