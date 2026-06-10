/**
 * @file PrivacyControls.tsx
 * @description Settings section for ingest-time privacy controls. Lets the
 * user toggle the master policy and built-in detectors, manage custom
 * redaction rules (key/value regex match with mask / hash / drop_field /
 * drop_event_payload actions), and preview how a sample payload would be
 * transformed by the current (possibly unsaved) policy — nothing in the
 * preview is persisted. Live ingest applies the policy; import/reimport does
 * not, which the panel calls out explicitly.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Plus, Trash2, Eye, AlertTriangle, Check } from "lucide-react";
import { api } from "../lib/api";
import { Skeleton } from "./Skeleton";
import type {
  PrivacyAction,
  PrivacyMatchType,
  PrivacyPolicy,
  PrivacyPreviewResult,
  PrivacyRule,
} from "../lib/types";

const DETECTOR_KEYS = [
  "secret_keys",
  "bearer_tokens",
  "api_key_formats",
  "private_key_blocks",
  "email_addresses",
  "home_paths",
] as const;

const ACTIONS: PrivacyAction[] = ["mask", "hash", "drop_field", "drop_event_payload"];
const MATCH_TYPES: PrivacyMatchType[] = ["key", "value"];

const SAMPLE_PAYLOAD = JSON.stringify(
  {
    session_id: "sample-session",
    tool_name: "Bash",
    tool_input: {
      command: "curl -H 'Authorization: Bearer abc123def456ghi789' https://api.example.com",
      api_key: "sk-ant-api03-EXAMPLE-KEY-VALUE-1234567890",
    },
  },
  null,
  2
);

function MiniToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-surface-4"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export function PrivacyControls() {
  const { t } = useTranslation("settings");
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [newRule, setNewRule] = useState<PrivacyRule>({
    name: "",
    enabled: true,
    match_type: "value",
    pattern: "",
    action: "mask",
  });

  const [sampleText, setSampleText] = useState(SAMPLE_PAYLOAD);
  const [preview, setPreview] = useState<PrivacyPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    api.privacy
      .get()
      .then((res) => setPolicy(res.policy))
      .catch((err) => console.error("Failed to load privacy policy:", err))
      .finally(() => setLoading(false));
  }, []);

  const edit = useCallback((patch: Partial<PrivacyPolicy>) => {
    setPolicy((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
    setSavedFlash(false);
  }, []);

  const save = async () => {
    if (!policy || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await api.privacy.update(policy);
      setPolicy(res.policy);
      setDirty(false);
      setSavedFlash(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const addRule = () => {
    if (!policy || !newRule.name.trim() || !newRule.pattern.trim()) return;
    // Stamp a client-side id so unsaved rules have a stable React key even
    // when rules are deleted/reordered before saving (the server keeps any
    // provided id on save).
    const ruleWithId = {
      ...newRule,
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 11),
      name: newRule.name.trim(),
    };
    edit({ rules: [...policy.rules, ruleWithId] });
    setNewRule({ name: "", enabled: true, match_type: "value", pattern: "", action: "mask" });
  };

  const runPreview = async () => {
    if (!policy) return;
    setPreviewError(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(sampleText);
    } catch {
      setPreviewError(t("privacy.preview.invalidJson"));
      return;
    }
    try {
      const res = await api.privacy.preview({ data, policy });
      setPreview(res);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) {
    return (
      <div className="card p-5 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!policy) {
    return <div className="card p-5 text-sm text-gray-500">{t("privacy.loadFailed")}</div>;
  }

  return (
    <div className="card p-5 space-y-5">
      {/* Master toggle */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              policy.enabled
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-surface-2 border border-border"
            }`}
          >
            <Shield
              className={`w-5 h-5 ${policy.enabled ? "text-emerald-400" : "text-gray-500"}`}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-200">{t("privacy.enable")}</p>
            <p className="text-xs text-gray-500">{t("privacy.enableDesc")}</p>
          </div>
        </div>
        <MiniToggle
          checked={policy.enabled}
          onChange={(next) => edit({ enabled: next })}
          label={t("privacy.enable")}
        />
      </div>

      {/* Import warning */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-200/90">{t("privacy.importWarning")}</p>
      </div>

      {/* Built-in detectors */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          {t("privacy.detectors.title")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DETECTOR_KEYS.map((key) => (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">
                  {t(`privacy.detectors.${key}`)}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {t(`privacy.detectors.${key}Desc`)}
                </p>
              </div>
              <MiniToggle
                checked={policy.detectors[key]}
                onChange={(next) => edit({ detectors: { ...policy.detectors, [key]: next } })}
                label={t(`privacy.detectors.${key}`)}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
          <span>{t("privacy.defaultAction")}</span>
          <select
            value={policy.default_action}
            onChange={(e) => edit({ default_action: e.target.value as "mask" | "hash" })}
            className="input py-1 px-2 text-xs"
          >
            <option value="mask">{t("privacy.actions.mask")}</option>
            <option value="hash">{t("privacy.actions.hash")}</option>
          </select>
        </div>
      </div>

      {/* Custom rules */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          {t("privacy.rules.title")}
        </p>
        {policy.rules.length === 0 ? (
          <p className="text-xs text-gray-500 mb-2">{t("privacy.rules.empty")}</p>
        ) : (
          <ul className="space-y-1.5 mb-2">
            {policy.rules.map((rule, idx) => (
              <li
                key={rule.id || idx}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2"
              >
                <div className="min-w-0 text-xs">
                  <span
                    className={`font-medium ${rule.enabled ? "text-gray-200" : "text-gray-500 line-through"}`}
                  >
                    {rule.name}
                  </span>
                  <span className="text-gray-500 font-mono ml-2">
                    {rule.match_type}~/{rule.pattern}/ → {t(`privacy.actions.${rule.action}`)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <MiniToggle
                    checked={rule.enabled}
                    onChange={(next) =>
                      edit({
                        rules: policy.rules.map((r, i) =>
                          i === idx ? { ...r, enabled: next } : r
                        ),
                      })
                    }
                    label={rule.name}
                  />
                  <button
                    type="button"
                    onClick={() => edit({ rules: policy.rules.filter((_, i) => i !== idx) })}
                    className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title={t("privacy.rules.delete")}
                    aria-label={t("privacy.rules.delete")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
          <input
            type="text"
            value={newRule.name}
            onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))}
            placeholder={t("privacy.rules.namePlaceholder")}
            className="input text-xs"
            aria-label={t("privacy.rules.name")}
          />
          <select
            value={newRule.match_type}
            onChange={(e) =>
              setNewRule((r) => {
                const match_type = e.target.value as PrivacyMatchType;
                // drop_field is key-only — downgrade the action if needed
                const action =
                  match_type === "value" && r.action === "drop_field" ? "mask" : r.action;
                return { ...r, match_type, action };
              })
            }
            className="input text-xs"
            aria-label={t("privacy.rules.matchType")}
          >
            {MATCH_TYPES.map((m) => (
              <option key={m} value={m}>
                {t(`privacy.matchTypes.${m}`)}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newRule.pattern}
            onChange={(e) => setNewRule((r) => ({ ...r, pattern: e.target.value }))}
            placeholder={t("privacy.rules.patternPlaceholder")}
            className="input text-xs font-mono"
            aria-label={t("privacy.rules.pattern")}
          />
          <select
            value={newRule.action}
            onChange={(e) => setNewRule((r) => ({ ...r, action: e.target.value as PrivacyAction }))}
            className="input text-xs"
            aria-label={t("privacy.rules.action")}
          >
            {ACTIONS.filter((a) => !(newRule.match_type === "value" && a === "drop_field")).map(
              (a) => (
                <option key={a} value={a}>
                  {t(`privacy.actions.${a}`)}
                </option>
              )
            )}
          </select>
          <button
            type="button"
            onClick={addRule}
            disabled={!newRule.name.trim() || !newRule.pattern.trim()}
            className="btn-ghost border border-border text-xs justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("privacy.rules.add")}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          {t("privacy.preview.title")}
        </p>
        <textarea
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          rows={6}
          spellCheck={false}
          className="input w-full font-mono text-[11px] leading-snug resize-y"
          aria-label={t("privacy.preview.title")}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={runPreview}
            className="btn-ghost border border-border text-xs"
          >
            <Eye className="w-3.5 h-3.5" />
            {t("privacy.preview.run")}
          </button>
          {previewError && <span className="text-xs text-red-400">{previewError}</span>}
        </div>
        {preview && (
          <div className="mt-2 rounded-lg border border-border bg-surface-2 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
              {t("privacy.preview.after")}
              {preview.meta && (
                <span className="ml-2 normal-case font-normal text-gray-400">
                  {t("privacy.preview.metaSummary", {
                    applied: preview.meta.rules_applied,
                    masked: preview.meta.fields_masked,
                    hashed: preview.meta.fields_hashed,
                    dropped: preview.meta.fields_dropped,
                  })}
                </span>
              )}
            </p>
            <pre className="text-[11px] font-mono text-gray-300 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {JSON.stringify(preview.after, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <p className="text-[11px] text-gray-500">{t("privacy.saveNote")}</p>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          {savedFlash && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" />
              {t("privacy.saved")}
            </span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="btn-primary text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t("privacy.saving") : t("privacy.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
