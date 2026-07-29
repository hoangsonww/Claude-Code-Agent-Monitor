/**
 * @file Card fork for the WIP queue page. Wraps the real, unmodified
 * `SessionCard` (imported as-is from `./SessionCard.tsx` - that component
 * receives zero edits in this change, per the "fork, don't edit" mandate),
 * layering a visually-prominent project-name header above it, resolved via
 * the shared `projectLookup.projectForSession` join (the "reuse, don't
 * re-derive" mandate - no second cwd->project resolution is computed here).
 *
 * The concrete prominence treatment below is a first-pass design guess (no
 * mockup exists for this feature) - flagged in the PR for Sara's
 * before/after-screenshot sign-off, not blocking the rest of the build.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useTranslation } from "react-i18next";
import { FolderGit2 } from "lucide-react";
import { SessionCard } from "./SessionCard";
import { projectForSession } from "../lib/projectLookup";
import type { Project, Session } from "../lib/types";

interface WipSessionCardProps {
  session: Session;
  projectIndex: Map<string, Project>;
  onClick?: () => void;
}

/**
 * `SessionCard`, prefixed with a distinct, assertable project-name header
 * (`data-testid="wip-session-card-project"`) so the WIP queue reads
 * "which project is this?" before anything else on the card - the whole
 * point of this fork per Sara's "project name more prominent" request.
 * Renders an explicit "no project" state (never a blank/omitted header)
 * when the session's cwd doesn't resolve to any project.
 */
export function WipSessionCard({ session, projectIndex, onClick }: WipSessionCardProps) {
  const { t } = useTranslation("wip");
  const project = projectForSession(session, projectIndex);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        data-testid="wip-session-card-project"
        className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-accent truncate"
      >
        <FolderGit2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{project ? project.name : t("card.noProject")}</span>
      </div>
      <SessionCard session={session} onClick={onClick} />
    </div>
  );
}
