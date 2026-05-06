import { IconButton, Tooltip } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";

interface Props {
  onAdd: (file: File) => void;
  disabled?: boolean;
}

export function UploadButtons({ onAdd, disabled }: Props) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const f of files) onAdd(f);
    e.target.value = "";
  };
  return (
    <>
      <Tooltip title="Attach file">
        <IconButton
          size="small"
          aria-label="Attach file"
          disabled={disabled}
          onClick={() => document.getElementById("composer-file-input")?.click()}
        >
          <AttachFileIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Photo / take picture">
        <IconButton
          size="small"
          aria-label="Photo or take picture"
          disabled={disabled}
          onClick={() => document.getElementById("composer-photo-input")?.click()}
        >
          <PhotoCameraIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <input
        id="composer-file-input"
        type="file"
        multiple
        hidden
        onChange={handle}
      />
      <input
        id="composer-photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={handle}
      />
    </>
  );
}
