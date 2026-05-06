// client/src/features/composer/AttachmentBar.tsx
import { Box, Chip } from "@mui/material";
import type { Attachment } from "../../lib/composer-types";

interface Props {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentBar({ attachments, onRemove }: Props) {
  if (!attachments.length) return null;
  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", px: 1, py: 0.5, borderTop: "1px solid", borderColor: "divider" }}>
      {attachments.map((a) => (
        <Chip
          key={a.id}
          size="small"
          label={`${a.name} · ${fmtSize(a.size)}`}
          onDelete={() => onRemove(a.id)}
          deleteIcon={<span aria-label={`remove ${a.name}`}>×</span>}
        />
      ))}
    </Box>
  );
}
