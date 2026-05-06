import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { useCwds } from "../../../hooks/useCwds";

interface Props {
  value: string | undefined;
  onChange: (path: string | undefined) => void;
}

export function CwdSection({ value, onChange }: Props) {
  const { cwds, add, error } = useCwds();
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState("");

  const handleAdd = async () => {
    try {
      await add(path);
      onChange(path);
      setAdding(false);
      setPath("");
    } catch {
      // error surface lives on the hook
    }
  };

  return (
    <Stack spacing={2}>
      <TextField
        select
        label="Select directory"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        fullWidth
      >
        <MenuItem value="">(none)</MenuItem>
        {cwds.map((c) => (
          <MenuItem key={c.path} value={c.path}>
            {c.path}
          </MenuItem>
        ))}
      </TextField>
      <Button onClick={() => setAdding(true)} size="small" sx={{ alignSelf: "flex-start" }}>
        Add new path…
      </Button>
      <Dialog open={adding} onClose={() => setAdding(false)}>
        <DialogTitle>Add allowed working directory</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/absolute/path"
            fullWidth
            helperText={error || "Path must exist and be a directory"}
            sx={{ mt: 1, minWidth: 360 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
