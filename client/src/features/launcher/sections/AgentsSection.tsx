import { useState } from "react";
import { Stack, TextField } from "@mui/material";
import type { ProfileConfig } from "../../../lib/profile-types";

interface Props {
  value: ProfileConfig;
  onChange: (patch: Partial<ProfileConfig>) => void;
}

export function AgentsSection({ value, onChange }: Props) {
  const [agentsText, setAgentsText] = useState(
    value.agents ? JSON.stringify(value.agents, null, 2) : "",
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const handleBlur = () => {
    if (!agentsText.trim()) {
      setParseError(null);
      onChange({ agents: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(agentsText) as unknown;
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null)
        throw new Error("must be a JSON object");
      setParseError(null);
      onChange({ agents: parsed as ProfileConfig["agents"] });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Stack spacing={2}>
      <TextField
        label="--agent (single agent name)"
        value={value.agent || ""}
        onChange={(e) => onChange({ agent: e.target.value || undefined })}
        fullWidth
      />
      <TextField
        label="--agents (JSON object)"
        value={agentsText}
        onChange={(e) => setAgentsText(e.target.value)}
        onBlur={handleBlur}
        multiline
        minRows={4}
        fullWidth
        helperText={
          parseError
            ? `Parse error: ${parseError}`
            : '{"reviewer":{"description":"Reviews code","prompt":"You are…"}}'
        }
        error={!!parseError}
      />
    </Stack>
  );
}
