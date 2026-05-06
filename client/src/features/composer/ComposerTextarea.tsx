import { useEffect, useRef, useState } from "react";
import { Box, TextField } from "@mui/material";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onAddFiles: (files: File[]) => void;
  onSlashStateChange: (open: boolean, query: string) => void;
  disabled?: boolean;
}

export function ComposerTextarea({ value, onChange, onSubmit, onAddFiles, onSlashStateChange, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    // Detect slash-trigger: substring after the most recent '/' that starts at start-of-token
    const m = value.match(/(^|\s)\/([\w-]*)$/);
    if (m) onSlashStateChange(true, m[2] ?? "");
    else onSlashStateChange(false, "");
  }, [value, onSlashStateChange]);

  return (
    <Box
      sx={{
        position: "relative",
        outline: dragging ? "2px dashed" : "none",
        outlineColor: "primary.main",
        outlineOffset: -2,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) onAddFiles(files);
      }}
      onPaste={(e) => {
        const files = Array.from(e.clipboardData.files || []);
        if (files.length) {
          e.preventDefault();
          onAddFiles(files);
        }
      }}
    >
      <TextField
        inputRef={ref}
        multiline
        minRows={2}
        maxRows={8}
        fullWidth
        size="small"
        placeholder="Ask Claude…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        disabled={disabled}
      />
    </Box>
  );
}
