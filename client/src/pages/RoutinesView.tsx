/**
 * @file Routines list page. Top-bar with title + "New routine" button, the
 * "All / Calendar" tab strip (Calendar is a v1 stub — see TODO), and the
 * "Include completed" toggle that hides disabled routines by default.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Routine, RoutineCreateInput } from "../lib/routine-types";
import { RoutineCard } from "../features/routines/RoutineCard";
import { RoutineEditor } from "../features/routines/RoutineEditor";

export function RoutinesView() {
  const navigate = useNavigate();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [tab, setTab] = useState<"all" | "calendar">("all");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.routines.list({ includeDisabled: includeCompleted });
      setRoutines(res.routines);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [includeCompleted]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (input: RoutineCreateInput) => {
      await api.routines.create(input);
      await refresh();
    },
    [refresh],
  );

  return (
    <Box sx={{ maxWidth: 980, mx: "auto" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Routines
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create templated routines that can be kicked off on schedule, by API, or webhook.
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setEditorOpen(true)}>
          New routine
        </Button>
      </Stack>

      <Alert
        icon={<ShieldCheck size={18} />}
        severity="info"
        variant="outlined"
        sx={{ alignItems: "center", my: 2 }}
      >
        Local routines only run while your computer is awake.
      </Alert>

      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          mb: 2,
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as "all" | "calendar")}
          sx={{ minHeight: 36 }}
        >
          <Tab value="all" label="All" sx={{ minHeight: 36, textTransform: "none" }} />
          <Tab
            value="calendar"
            label="Calendar"
            sx={{ minHeight: 36, textTransform: "none" }}
          />
        </Tabs>
        <FormControlLabel
          sx={{ mr: 1 }}
          control={
            <Switch
              size="small"
              checked={includeCompleted}
              onChange={(_, v) => setIncludeCompleted(v)}
            />
          }
          label={<Typography variant="caption">Include completed</Typography>}
        />
      </Stack>

      {tab === "calendar" && (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            Calendar view coming soon.
          </Typography>
        </Box>
      )}

      {tab === "all" && (
        <Box>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : routines.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No routines yet. Click "New routine" to create one.
              </Typography>
            </Box>
          ) : (
            routines.map((r) => (
              <RoutineCard
                key={r.id}
                routine={r}
                onClick={() => navigate(`/routines/${r.id}`)}
              />
            ))
          )}
        </Box>
      )}

      <RoutineEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleCreate}
      />
    </Box>
  );
}

export default RoutinesView;
