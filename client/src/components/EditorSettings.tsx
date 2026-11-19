/**
 * @file EditorSettings.tsx
 * @description Configures the installed editor catalog and default folder launcher
 * in Settings. Preferences are saved per browser, not on the CCAM server.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useState } from "react";
import { Code2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EDITORS,
  saveEditorPrefs,
  useEditorPrefs,
  type EditorId,
  type EditorPrefs,
} from "../lib/editors";

export function EditorSettings() {
  const { t } = useTranslation("settings");
  const prefs = useEditorPrefs();
  const [selected, setSelected] = useState<EditorId>("vscode");
  const [error, setError] = useState(false);
  const available = EDITORS.filter((editor) => !prefs.enabled.includes(editor.id));
  const nextId = available.find((editor) => editor.id === selected)?.id ?? available[0]?.id;

  function save(next: EditorPrefs) {
    setError(!saveEditorPrefs(next));
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <Code2 className="h-4 w-4 text-gray-500" />
          {t("editors.title")}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">{t("editors.description")}</p>
      </div>
      <div className="card p-4 space-y-4">
        {prefs.enabled.length === 0 && (
          <p className="text-xs text-gray-500">{t("editors.empty")}</p>
        )}
        {prefs.enabled.length > 0 && (
          <div role="radiogroup" aria-label={t("editors.default")} className="space-y-2">
            {prefs.enabled.map((id) => (
              <div key={id} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="radio"
                    name="default-editor"
                    value={id}
                    checked={prefs.defaultId === id}
                    onChange={() => save({ ...prefs, defaultId: id })}
                  />
                  {EDITORS.find((editor) => editor.id === id)?.name}
                  {prefs.defaultId === id && (
                    <span aria-hidden="true" className="text-xs text-gray-500">
                      {t("editors.default")}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  aria-label={t("editors.remove", {
                    editor: EDITORS.find((editor) => editor.id === id)?.name,
                  })}
                  onClick={() =>
                    save({ ...prefs, enabled: prefs.enabled.filter((entry) => entry !== id) })
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {nextId && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t("editors.choose")}
              className="input text-sm"
              value={nextId}
              onChange={(event) => setSelected(event.target.value as EditorId)}
            >
              {available.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                save({ enabled: [...prefs.enabled, nextId], defaultId: prefs.defaultId ?? nextId })
              }
            >
              <Plus className="w-3.5 h-3.5" />
              {t("editors.add")}
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500 leading-relaxed">{t("editors.hint")}</p>
        {error && (
          <p role="alert" className="text-xs text-red-400">
            {t("editors.saveFailed")}
          </p>
        )}
      </div>
    </div>
  );
}
