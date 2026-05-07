import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Box, IconButton, TextField, Tooltip } from "@mui/material";
import { ArrowUp, Square } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onAddFiles: (files: File[]) => void;
  onSlashStateChange: (open: boolean, query: string) => void;
  disabled?: boolean;
  /** Render the inline submit/stop affordance at the right edge. */
  showInlineSubmit?: boolean;
  /** True while a turn is in flight; swap submit icon for a Stop button. */
  busy?: boolean;
  /** True when there's content to send (text or attachments). */
  canSend?: boolean;
  /** Called when the user clicks the inline Stop button. */
  onStop?: () => void;
}

export interface ComposerTextareaHandle {
  focus: () => void;
}

export const ComposerTextarea = forwardRef<ComposerTextareaHandle, Props>(
  function ComposerTextarea(
    {
      value,
      onChange,
      onSubmit,
      onAddFiles,
      onSlashStateChange,
      disabled,
      showInlineSubmit,
      busy,
      canSend,
      onStop,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [dragging, setDragging] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

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
          inputRef={inputRef}
          multiline
          minRows={2}
          maxRows={8}
          fullWidth
          size="small"
          placeholder="Type / for commands"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={disabled}
          slotProps={{
            input: {
              sx: showInlineSubmit
                ? {
                    // Reserve room for the inline submit affordance so long
                    // wrap-points don't slide under the icon.
                    pr: 5,
                  }
                : undefined,
            },
          }}
        />
        {showInlineSubmit && (
          <Box
            sx={{
              position: "absolute",
              right: 6,
              bottom: 6,
              zIndex: 1,
            }}
          >
            {busy ? (
              <Tooltip title="Stop" placement="top">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Stop"
                    color="warning"
                    onClick={onStop}
                  >
                    <Square size={14} fill="currentColor" />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title="Send (Cmd+Enter)" placement="top">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Send"
                    color="primary"
                    disabled={!canSend}
                    onClick={onSubmit}
                  >
                    <ArrowUp size={16} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
    );
  },
);
