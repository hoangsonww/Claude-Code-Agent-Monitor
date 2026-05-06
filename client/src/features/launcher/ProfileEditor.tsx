import { useCallback } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { ProfileConfig } from "../../lib/profile-types";
import { IdentitySection } from "./sections/IdentitySection";
import { CwdSection } from "./sections/CwdSection";
import { ModelRuntimeSection } from "./sections/ModelRuntimeSection";
import { PermissionsSection } from "./sections/PermissionsSection";
import { ToolsSection } from "./sections/ToolsSection";
import { SystemPromptSection } from "./sections/SystemPromptSection";
import { McpPluginsSection } from "./sections/McpPluginsSection";
import { SettingsSourcesSection } from "./sections/SettingsSourcesSection";
import { AgentsSection } from "./sections/AgentsSection";
import { OutputSection } from "./sections/OutputSection";
import { LimitsLoggingSection } from "./sections/LimitsLoggingSection";
import { EnvVarsSection } from "./sections/EnvVarsSection";
import { ChannelsSection } from "./sections/ChannelsSection";
import { DangerousSection } from "./sections/DangerousSection";

export interface ProfileEditorValue {
  name: string;
  description?: string;
  config: ProfileConfig;
  defaultCwd?: string;
}

interface Props {
  value: ProfileEditorValue;
  onChange: (next: ProfileEditorValue) => void;
}

const SECTIONS: {
  id: string;
  label: string;
  defaultOpen?: boolean;
  dangerous?: boolean;
}[] = [
  { id: "identity", label: "Identity", defaultOpen: true },
  { id: "cwd", label: "Working directory", defaultOpen: true },
  { id: "model", label: "Model & runtime", defaultOpen: true },
  { id: "perm", label: "Permissions" },
  { id: "tools", label: "Tools" },
  { id: "sysp", label: "System prompt" },
  { id: "mcp", label: "MCP & plugins" },
  { id: "settings", label: "Settings sources" },
  { id: "agents", label: "Agents" },
  { id: "output", label: "Output" },
  { id: "limits", label: "Limits & logging" },
  { id: "env", label: "Env vars (names only)" },
  { id: "channels", label: "Channels" },
  { id: "dangerous", label: "Advanced — dangerous", dangerous: true },
];

export function ProfileEditor({ value, onChange }: Props) {
  const patchConfig = useCallback(
    (patch: Partial<ProfileConfig>) =>
      onChange({ ...value, config: { ...value.config, ...patch } }),
    [value, onChange],
  );

  const patchTop = useCallback(
    (patch: Partial<ProfileEditorValue>) => onChange({ ...value, ...patch }),
    [value, onChange],
  );

  const renderBody = (id: string) => {
    switch (id) {
      case "identity":
        return <IdentitySection value={value} onChange={patchTop} />;
      case "cwd":
        return (
          <CwdSection
            value={value.defaultCwd}
            onChange={(p) => patchTop({ defaultCwd: p })}
          />
        );
      case "model":
        return <ModelRuntimeSection value={value.config} onChange={patchConfig} />;
      case "perm":
        return <PermissionsSection value={value.config} onChange={patchConfig} />;
      case "tools":
        return <ToolsSection value={value.config} onChange={patchConfig} />;
      case "sysp":
        return <SystemPromptSection value={value.config} onChange={patchConfig} />;
      case "mcp":
        return <McpPluginsSection value={value.config} onChange={patchConfig} />;
      case "settings":
        return <SettingsSourcesSection value={value.config} onChange={patchConfig} />;
      case "agents":
        return <AgentsSection value={value.config} onChange={patchConfig} />;
      case "output":
        return <OutputSection value={value.config} onChange={patchConfig} />;
      case "limits":
        return <LimitsLoggingSection value={value.config} onChange={patchConfig} />;
      case "env":
        return <EnvVarsSection value={value.config} onChange={patchConfig} />;
      case "channels":
        return <ChannelsSection value={value.config} onChange={patchConfig} />;
      case "dangerous":
        return <DangerousSection value={value.config} onChange={patchConfig} />;
      default:
        return null;
    }
  };

  return (
    <Stack spacing={1}>
      {SECTIONS.map((s) => (
        <Accordion
          key={s.id}
          defaultExpanded={!!s.defaultOpen}
          sx={
            s.dangerous
              ? { border: "1px solid #d33", background: "#2a1010" }
              : undefined
          }
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography
              sx={{
                color: s.dangerous ? "#ff8a8a" : undefined,
                fontWeight: s.dangerous ? 600 : 500,
              }}
            >
              {s.dangerous ? "⚠ " : ""}
              {s.label}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>{renderBody(s.id)}</Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}
