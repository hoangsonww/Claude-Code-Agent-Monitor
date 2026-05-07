/**
 * @file Routine detail page — one routine, two columns. Left column carries
 * description / status / folder / repeats / "always allowed" warning;
 * right column carries the instructions code box, the webhook URL chip,
 * and the run history.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Link as MuiLink,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Pencil, Trash2, Play, ShieldCheck, AlertTriangle, Copy } from "lucide-react";
import { api } from "../lib/api";
import type { Routine, RoutineDetailResponse, RoutineCreateInput, RoutineRun } from "../lib/routine-types";
import { formatNextRun, summarizeSchedule } from "../lib/routine-format";
import { RoutineEditor } from "../features/routines/RoutineEditor";
import { RoutineHistory } from "../features/routines/RoutineHistory";

export function RoutineDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RoutineDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [tokenRevealed, setTokenRevealed] = useState(false);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.routines.get(id);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = useCallback(
    async (input: RoutineCreateInput) => {
      if (!id) return;
      await api.routines.update(id, input);
      await refresh();
    },
    [id, refresh],
  );

  const handleDelete = useCallback(async () => {
    if (!id) return;
    if (!window.confirm("Delete this routine? Run history will be removed too.")) return;
    await api.routines.remove(id);
    navigate("/routines");
  }, [id, navigate]);

  const handleRunNow = useCallback(async () => {
    if (!id) return;
    setRunning(true);
    try {
      await api.routines.runNow(id);
      await refresh();
    } finally {
      setRunning(false);
    }
  }, [id, refresh]);

  const handleStatusToggle = useCallback(
    async (next: boolean) => {
      if (!id) return;
      await api.routines.setStatus(id, next ? "active" : "disabled");
      await refresh();
    },
    [id, refresh],
  );

  const copyText = async (text: string, kind: "url" | "token") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  if (loading && !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">Routine not found.</Alert>;

  const r: Routine = data.routine;
  const runs: RoutineRun[] = data.runs;
  const showAlwaysAllowed =
    r.permissionMode === "bypassPermissions" || r.permissionMode === "dontAsk";

  const fullWebhookUrl = `${window.location.origin}${data.webhookUrl}`;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Breadcrumbs>
          <MuiLink component={RouterLink} to="/routines" underline="hover">
            Routines
          </MuiLink>
          <Typography color="text.primary">{r.name}</Typography>
        </Breadcrumbs>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Tooltip title="Edit">
            <IconButton onClick={() => setEditorOpen(true)} aria-label="Edit">
              <Pencil size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton onClick={handleDelete} aria-label="Delete">
              <Trash2 size={18} />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Play size={16} />}
            onClick={handleRunNow}
            disabled={running}
          >
            Run now
          </Button>
        </Stack>
      </Stack>

      <Alert
        icon={<ShieldCheck size={18} />}
        severity="info"
        variant="outlined"
        sx={{ alignItems: "center", mb: 2 }}
      >
        Local routines only run while your computer is awake.
      </Alert>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1.4fr" }, gap: 3 }}>
        <Stack spacing={2}>
          <Section label="Description">
            <Typography variant="body2">{r.description}</Typography>
          </Section>

          <Section label="Status">
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Switch
                size="small"
                checked={r.status === "active"}
                onChange={(_, v) => handleStatusToggle(v)}
                slotProps={{ input: { "aria-label": "toggle status" } }}
              />
              <Chip
                label={r.status === "active" ? "Active" : "Disabled"}
                size="small"
                color={r.status === "active" ? "success" : "default"}
                variant="outlined"
              />
              {r.status === "active" && r.nextRunAt != null && (
                <Typography variant="caption" color="text.secondary">
                  Next run: {formatNextRun(r.nextRunAt)}
                </Typography>
              )}
            </Stack>
          </Section>

          <Section label="Folder">
            <Chip label={r.cwd} size="small" />
            {r.worktree && (
              <Chip
                label="worktree"
                size="small"
                variant="outlined"
                sx={{ ml: 1 }}
              />
            )}
          </Section>

          <Section label="Repeats">
            <Typography variant="body2">{summarizeSchedule(r.schedule)}</Typography>
          </Section>

          {showAlwaysAllowed && (
            <Section label="Always allowed">
              <Chip
                icon={<AlertTriangle size={14} />}
                label="Act without asking"
                color="warning"
                size="small"
              />
            </Section>
          )}
        </Stack>

        <Stack spacing={2}>
          <Section label="Instructions">
            <Box
              component="pre"
              sx={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                bgcolor: "background.default",
                p: 2,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                whiteSpace: "pre-wrap",
                overflowX: "auto",
                m: 0,
              }}
            >
              {r.instructions}
            </Box>
          </Section>

          <Section label="Webhook">
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Chip
                  label={data.webhookUrl.replace(/token=.*/, "token=••••")}
                  size="small"
                  sx={{ maxWidth: "100%" }}
                />
                <Tooltip title={copied === "url" ? "Copied" : "Copy URL"}>
                  <IconButton
                    size="small"
                    onClick={() => copyText(fullWebhookUrl, "url")}
                    aria-label="Copy webhook URL"
                  >
                    <Copy size={14} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {tokenRevealed ? (
                  <>
                    <Chip
                      label={data.webhookToken}
                      size="small"
                      sx={{ fontFamily: "ui-monospace, monospace" }}
                    />
                    <Tooltip title={copied === "token" ? "Copied" : "Copy token"}>
                      <IconButton
                        size="small"
                        onClick={() => copyText(data.webhookToken, "token")}
                        aria-label="Copy token"
                      >
                        <Copy size={14} />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      onClick={() => setTokenRevealed(false)}
                      sx={{ textTransform: "none" }}
                    >
                      Hide
                    </Button>
                  </>
                ) : (
                  <Button
                    size="small"
                    onClick={() => setTokenRevealed(true)}
                    sx={{ textTransform: "none" }}
                  >
                    Reveal token
                  </Button>
                )}
              </Stack>
            </Stack>
          </Section>

          <Section label="History">
            <RoutineHistory runs={runs} />
          </Section>
        </Stack>
      </Box>

      <RoutineEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initial={r}
        onSubmit={handleSave}
      />
    </Box>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontSize: 10,
          display: "block",
          mb: 0.75,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export default RoutineDetail;
