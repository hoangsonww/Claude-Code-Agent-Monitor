/**
 * @file PlusMenu.tsx
 * @description The "+" affordance in the composer status bar. Combines the
 * file/photo upload entry points (previously surfaced as separate icons in
 * UploadButtons) with a "Slash commands" entry that opens the existing slash
 * menu. Mirrors Claude Desktop's bottom-of-composer plus menu without the
 * Desktop-specific Connectors / Plugins / Add folder items.
 */
import { useRef, useState } from "react";
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Tooltip } from "@mui/material";
import { Plus, Image as ImageIcon, FileUp, Slash } from "lucide-react";

interface Props {
  onAddFile: (file: File) => void;
  onOpenSlashCommands: () => void;
  disabled?: boolean;
}

export function PlusMenu({ onAddFile, onOpenSlashCommands, disabled }: Props) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) onAddFile(f);
    e.target.value = "";
  };

  const close = () => setAnchorEl(null);

  return (
    <>
      <Tooltip title="Add" placement="top">
        <span>
          <IconButton
            ref={buttonRef}
            size="small"
            aria-label="Add files, photos, or slash commands"
            disabled={disabled}
            onClick={() => setAnchorEl(buttonRef.current)}
          >
            <Plus size={18} />
          </IconButton>
        </span>
      </Tooltip>
      <Menu
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <MenuItem
          onClick={() => {
            close();
            fileInputRef.current?.click();
          }}
        >
          <ListItemIcon>
            <FileUp size={16} aria-hidden />
          </ListItemIcon>
          <ListItemText primary="Add files or photos" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            photoInputRef.current?.click();
          }}
        >
          <ListItemIcon>
            <ImageIcon size={16} aria-hidden />
          </ListItemIcon>
          <ListItemText primary="Take a photo" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            close();
            onOpenSlashCommands();
          }}
        >
          <ListItemIcon>
            <Slash size={16} aria-hidden />
          </ListItemIcon>
          <ListItemText primary="Slash commands" />
        </MenuItem>
      </Menu>
      {/* Hidden inputs share the same ids the UploadButtons originally used so
          existing tests / external callers (e.g. drag-drop fallback paths)
          continue to find them. */}
      <input
        id="composer-file-input"
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFiles}
      />
      <input
        id="composer-photo-input"
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={handleFiles}
      />
    </>
  );
}
