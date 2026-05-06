import type { ProfileConfig, PerLaunch } from "../../lib/profile-types";
import { FLAG_TABLE, buildArgvPreview } from "../../lib/profile-flag-mapping";

interface Props {
  config: ProfileConfig;
  perLaunch: PerLaunch;
  redactPrompt?: boolean;
}

export function CommandPreview({ config, perLaunch, redactPrompt }: Props) {
  const argv = buildArgvPreview(config, perLaunch, { redactPrompt });
  const dangerSet = new Set(
    Object.entries(FLAG_TABLE)
      .filter(([, s]) => s.dangerous)
      .map(([, s]) => s.flag),
  );
  const dangerFlags = argv.filter((a) => dangerSet.has(a));
  const display = argv
    .map((a) => (a.includes(" ") || a.includes('"') ? JSON.stringify(a) : a))
    .join(" ");
  return (
    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
      <pre
        data-testid="command-preview"
        style={{
          background: "#0d0d0d",
          padding: 12,
          borderRadius: 6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "#e6e6e6",
          margin: 0,
        }}
      >
        {display}
      </pre>
      {dangerFlags.length > 0 && (
        <div data-testid="danger-flags" style={{ marginTop: 8, color: "#ff7575" }}>
          ⚠ Dangerous flags active: {dangerFlags.join(", ")}
        </div>
      )}
    </div>
  );
}
