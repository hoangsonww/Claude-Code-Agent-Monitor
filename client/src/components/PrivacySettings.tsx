/**
 * @file PrivacySettings.tsx
 * @description Settings panel for ingest-time privacy redaction. Lets operators
 * enable/disable built-in detectors (secret keys, secret values, emails, home
 * path hashing) and preview how a sample payload would be transformed before
 * it is persisted — without writing anything to the database.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, RefreshCw, Shield, ShieldOff } from "lucide-react";
import { api } from "../lib/api";
import { Checkbox } from "./Checkbox";
import type { PrivacySettings as PrivacySettingsType } from "../lib/types";

const SAMPLE_PAYLOAD = {
  tool_name: "Bash",
  tool_input: {
    command:
      "export ANTHROPIC_API_KEY=sk-ant-api03-EXAMPLESECRETVALUE0001 && curl https://api.example.com",
    cwd: "/Users/demo/projects/app",
  },
  authorization: "Bearer FAKESECRET_m1n2o3p4q5r6s7t8u9v0",
  contact_email: "alice@example.com",
  nested: {
    github_token: "FAKESECRET_c4d5e6f7g8h9i0j1k2l3",
    note: "safe metadata stays visible",
  },
};

export function PrivacySettings() {
  const { t } = useTranslation("settings");
  const [settings, setSettings] = useState<PrivacySettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewBefore, setPreviewBefore] = useState("");
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{
    rules_applied: number;
    fields_redacted: number;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!api.settings.privacy?.get) {
        throw new Error(t("privacy.loadFailed"));
      }
      const res = await api.settings.privacy.get();
      setSettings(res.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    setPreviewBefore(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
  }, [load]);

  async function update(partial: Partial<PrivacySettingsType>) {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.settings.privacy.set(partial);
      setSettings(res.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    setPreviewing(true);
    setError(null);
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(previewBefore);
      } catch {
        setError(t("privacy.previewInvalidJson"));
        setPreviewing(false);
        return;
      }
      const res = await api.settings.privacy.preview(payload, settings ?? undefined);
      setPreviewAfter(JSON.stringify(res.after, null, 2));
      setPreviewMeta({
        rules_applied: res.meta.rules_applied,
        fields_redacted: res.meta.fields_redacted,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }

  if (loading && !settings) {
    return (
      <div className="card p-5 text-xs text-gray-500 flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        {t("common:loading", "Loading…")}
      </div>
    );
  }

  if (!settings) {
    return <div className="card p-5 text-xs text-rose-400">{error || t("privacy.loadFailed")}</div>;
  }

  const toggles: {
    key: keyof PrivacySettingsType;
    label: string;
    desc: string;
  }[] = [
    {
      key: "enabled",
      label: t("privacy.enabled"),
      desc: t("privacy.enabledDesc"),
    },
    {
      key: "redact_secret_keys",
      label: t("privacy.secretKeys"),
      desc: t("privacy.secretKeysDesc"),
    },
    {
      key: "redact_secret_values",
      label: t("privacy.secretValues"),
      desc: t("privacy.secretValuesDesc"),
    },
    {
      key: "redact_emails",
      label: t("privacy.emails"),
      desc: t("privacy.emailsDesc"),
    },
    {
      key: "hash_home_paths",
      label: t("privacy.homePaths"),
      desc: t("privacy.homePathsDesc"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                settings.enabled
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-surface-3 border-border"
              }`}
            >
              {settings.enabled ? (
                <Shield className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldOff className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-200 font-medium">
                {settings.enabled ? t("privacy.statusOn") : t("privacy.statusOff")}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t("privacy.note")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-ghost text-xs"
            disabled={loading || saving}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("common:refresh")}
          </button>
        </div>

        <div className="space-y-3">
          {toggles.map(({ key, label, desc }) => {
            const locked = saving || (key !== "enabled" && !settings.enabled);
            return (
              <div
                key={key}
                className={`flex items-start gap-3 py-2 border-t border-border/60 first:border-t-0 first:pt-0 ${
                  locked ? "opacity-50" : ""
                }`}
              >
                <div className="min-w-[11rem] flex-shrink-0">
                  <Checkbox
                    checked={Boolean(settings[key])}
                    onChange={(checked) => {
                      if (locked) return;
                      void update({ [key]: checked });
                    }}
                    label={label}
                  />
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed flex-1 pt-0.5">{desc}</p>
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {saving && <p className="text-[11px] text-gray-500">{t("privacy.saving")}</p>}
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
              {t("privacy.previewTitle")}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">{t("privacy.previewDesc")}</p>
          </div>
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={previewing}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            {previewing ? t("privacy.previewRunning") : t("privacy.previewRun")}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] text-gray-500 font-medium">
              {t("privacy.previewBefore")}
            </span>
            <textarea
              value={previewBefore}
              onChange={(e) => setPreviewBefore(e.target.value)}
              spellCheck={false}
              rows={12}
              className="w-full font-mono text-[11px] bg-surface-2 border border-border rounded-md px-3 py-2 text-gray-300 focus:outline-none focus:border-accent/50 resize-y"
            />
          </label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-500 font-medium">
                {t("privacy.previewAfter")}
              </span>
              {previewMeta && (
                <span className="text-[10px] text-gray-600 font-mono">
                  {t("privacy.previewMeta", {
                    rules: previewMeta.rules_applied,
                    fields: previewMeta.fields_redacted,
                  })}
                </span>
              )}
            </div>
            <pre className="w-full min-h-[16rem] font-mono text-[11px] bg-surface-2 border border-border rounded-md px-3 py-2 text-gray-300 overflow-auto whitespace-pre-wrap">
              {previewAfter ?? t("privacy.previewEmpty")}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
