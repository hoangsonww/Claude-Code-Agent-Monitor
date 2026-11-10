/**
 * @file OpenInEditor.tsx
 * @description Shared session-folder launcher for cards, list rows, and details.
 * Uses explicit editor links and disables remote or missing-path sessions.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useState } from "react";
import { Code2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  EDITORS,
  editorFolderUrl,
  editorUnavailableReason,
  useEditorPrefs,
  type EditorId,
} from "../lib/editors";
import type { Session } from "../lib/types";

export function OpenInEditor({
  session,
  compact = false,
}: {
  session: Pick<Session, "id" | "cwd" | "source">;
  compact?: boolean;
}) {
  const { t } = useTranslation("settings");
  const prefs = useEditorPrefs();
  const [selection, setSelection] = useState<{ sessionId: string; id: EditorId } | null>(null);
  const id =
    selection?.sessionId === session.id && prefs.enabled.includes(selection.id)
      ? selection.id
      : prefs.defaultId;
  const editor = EDITORS.find((entry) => entry.id === id);
  const reason = editorUnavailableReason(session);
  const url = id ? editorFolderUrl(id, session.cwd) : null;
  const label = editor ? t("editors.openWith", { editor: editor.name }) : t("editors.configure");
  const unavailable = reason ?? (id && !url ? "missingFolder" : null);

  return (
    <div
      className="inline-flex items-center gap-1 shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {unavailable ? (
        <button
          type="button"
          disabled
          className="btn-ghost opacity-40"
          aria-label={t("editors.open")}
          title={t(`editors.${unavailable}`)}
        >
          <Code2 className="w-3.5 h-3.5" />
          {!compact && t("editors.open")}
        </button>
      ) : url ? (
        <a href={url} className="btn-ghost" aria-label={label} title={`${label} · ${session.cwd}`}>
          <Code2 className="w-3.5 h-3.5" />
          {!compact && label}
        </a>
      ) : (
        <Link to="/settings#editors" className="btn-ghost" aria-label={label} title={label}>
          <Code2 className="w-3.5 h-3.5" />
          {!compact && label}
        </Link>
      )}
      {!unavailable && prefs.enabled.length > 1 && (
        <select
          className="bg-surface-2 text-xs text-gray-400 rounded max-w-28"
          aria-label={t("editors.choose")}
          value={id ?? ""}
          onChange={(event) =>
            setSelection({ sessionId: session.id, id: event.target.value as EditorId })
          }
        >
          {prefs.enabled.map((enabledId) => (
            <option key={enabledId} value={enabledId}>
              {EDITORS.find((entry) => entry.id === enabledId)?.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
