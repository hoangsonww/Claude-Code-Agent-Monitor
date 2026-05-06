// client/src/features/composer/SlashMenu.tsx
import { Paper, List, ListItemButton, ListItemText, Typography, Divider, Box } from "@mui/material";
import type { SlashCatalog, SlashCommand } from "../../lib/composer-types";

interface Props {
  open: boolean;
  catalog: SlashCatalog | null;
  query: string;
  onPick: (cmd: SlashCommand) => void;
  onClose: () => void;
}

const SECTIONS: { key: keyof SlashCatalog; label: string }[] = [
  { key: "builtin", label: "Built-in" },
  { key: "skills", label: "Skills" },
  { key: "plugins", label: "Plugins" },
  { key: "project", label: "Project" },
];

function applyFilter(catalog: SlashCatalog | null, query: string): SlashCatalog {
  const empty: SlashCatalog = { builtin: [], skills: [], plugins: [], project: [] };
  if (!catalog) return empty;
  if (!query) return catalog;
  const q = query.toLowerCase();
  const match = (cmd: SlashCommand) =>
    cmd.name.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q);
  return {
    builtin: catalog.builtin.filter(match),
    skills: catalog.skills.filter(match),
    plugins: catalog.plugins.filter(match),
    project: catalog.project.filter(match),
  };
}

export function SlashMenu({ open, catalog, query, onPick }: Props) {
  if (!open) return null;
  const filtered = applyFilter(catalog, query);
  const totalHits = SECTIONS.reduce((n, s) => n + filtered[s.key].length, 0);
  if (!totalHits) return null;
  return (
    <Paper
      elevation={4}
      sx={{ position: "absolute", bottom: "100%", left: 0, right: 0, maxHeight: 320, overflowY: "auto", zIndex: 10 }}
    >
      {SECTIONS.map((s) => {
        const items = filtered[s.key];
        if (!items.length) return null;
        return (
          <Box key={s.key}>
            <Typography variant="caption" sx={{ px: 1.5, py: 0.5, display: "block", color: "text.secondary" }}>
              {s.label}
            </Typography>
            <List dense disablePadding>
              {items.map((cmd) => (
                <ListItemButton
                  key={`${s.key}:${cmd.name}`}
                  onClick={() => onPick(cmd)}
                  aria-label={cmd.description ? `/${cmd.name} — ${cmd.description}` : `/${cmd.name}`}
                >
                  <ListItemText
                    primary={`/${cmd.name}`}
                    slotProps={{ primary: { style: { fontFamily: "ui-monospace, monospace", fontSize: "0.875rem" } } }}
                  />
                </ListItemButton>
              ))}
            </List>
            <Divider />
          </Box>
        );
      })}
    </Paper>
  );
}
