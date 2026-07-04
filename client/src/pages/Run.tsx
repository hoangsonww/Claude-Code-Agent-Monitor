/**
 * @file Run.tsx
 * @description Lets the user spawn a Claude Code subprocess from inside the
 * dashboard. Two modes:
 *   - Conversation: multi-turn, follow-up input box appears once running.
 *     Optionally resumes an existing session via `claude --resume <id>`.
 *   - One-shot (headless): single prompt, single response, stdin closes.
 *
 * Output is rendered as a chat-style stream: user turns, assistant text
 * (markdown), tool uses + their results (collapsible), and a footer banner
 * with cost / duration / session deep-link once the run completes.
 *
 * Includes an Active Runs switcher in the header so the user can attach to
 * any in-flight run (e.g. when they leave one running and start another).
 *
 * Wire-up:
 *   - POST /api/run starts; the response is the initial handle.
 *   - WebSocket "run_stream" pushes parsed stream-json envelopes from the
 *     spawned `claude`. WebSocket "run_status" pushes status transitions.
 *   - POST /api/run/:id/message sends follow-up turns.
 *   - DELETE /api/run/:id stops with SIGTERM.
 *   - GET /api/run/:id?envelopes=1 fetches in-memory history when attaching.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Play,
  Square,
  Send,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Terminal,
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDollarSign,
  Hash,
  ShieldAlert,
  Info,
  ExternalLink,
  Plus,
  X,
  Minus,
  FolderOpen,
  Home,
  History as HistoryIcon,
  ListOrdered,
  Search,
  RotateCcw,
  Lock,
  AtSign,
  Lightbulb,
  Slash as SlashIcon,
  FileCode,
  Activity,
  Eye,
} from "lucide-react";
import { api, RUN_MODEL_CHOICES, RUN_EFFORT_CHOICES } from "../lib/api";
import type {
  CwdSuggestion,
  DashboardRunHistoryItem,
  EffortLevel,
  PermissionMode,
  RunHandle,
  RunListResponse,
  RunMode,
  RunStatus,
} from "../lib/api";
import type { Session, TranscriptMessage, TranscriptContent } from "../lib/types";
import { eventBus } from "../lib/eventBus";
import type {
  RunInputAckPayload,
  RunStatusPayload,
  RunStreamPayload,
  WSMessage,
} from "../lib/types";
import { MarkdownContent } from "../components/conversation/MarkdownContent";
import { Select } from "../components/Select";

// ── Stream-json envelope shapes (the bits we render) ──────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking?: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean };

interface AssistantMessage {
  type: "assistant";
  message?: {
    content?: ContentBlock[] | string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}
interface UserMessage {
  type: "user";
  message?: { content?: ContentBlock[] | string };
}
interface SystemInit {
  type: "system";
  subtype: "init";
  session_id?: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  permissionMode?: string;
}
interface ResultEnvelope {
  type: "result";
  subtype?: string;
  is_error?: boolean;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  usage?: { input_tokens?: number; output_tokens?: number };
}
type Envelope =
  | AssistantMessage
  | UserMessage
  | SystemInit
  | ResultEnvelope
  | { type: string; [k: string]: unknown };

// Convert past-session transcript messages into envelope shapes so the chat
// view can render the prior conversation alongside live output from the
// resumed run. The shapes are close but not identical (`thinking.text` vs
// `thinking.thinking`, tool_result `id`/`output` vs `tool_use_id`/`content`),
// so each block is mapped individually.
function transcriptToEnvelopes(messages: TranscriptMessage[]): Envelope[] {
  const mapBlock = (b: TranscriptContent): ContentBlock | null => {
    if (b.type === "text") return { type: "text", text: b.text || "" };
    if (b.type === "thinking") return { type: "thinking", thinking: b.text || "" };
    if (b.type === "tool_use") {
      return { type: "tool_use", id: b.id || "", name: b.name || "", input: b.input };
    }
    if (b.type === "tool_result") {
      return {
        type: "tool_result",
        tool_use_id: b.id || "",
        content: b.output || "",
        is_error: !!b.is_error,
      };
    }
    return null;
  };
  const out: Envelope[] = [];
  // Prepend a synthetic system/init envelope carrying the model so the
  // context-window heuristic in computeTokens can size the meter correctly
  // (e.g., [1m] tag → 1M cap) even when no live `system` envelope has
  // arrived yet because the run was loaded from history.
  const firstModel = messages.find((m) => m.type === "assistant" && m.model)?.model;
  if (firstModel) {
    out.push({ type: "system", subtype: "init", model: firstModel } as Envelope);
  }
  for (const m of messages) {
    const content = m.content.map(mapBlock).filter((x): x is ContentBlock => x !== null);
    if (content.length === 0) continue;
    if (m.type === "assistant") {
      out.push({ type: "assistant", message: { content, usage: m.usage } });
    } else {
      out.push({ type: "user", message: { content } });
    }
  }
  return out;
}

// ── Streaming envelope merge ───────────────────────────────────────────
//
// `claude --output-format stream-json --include-partial-messages` emits two
// kinds of assistant output:
//
//   1. `stream_event` envelopes carrying Anthropic Messages API streaming
//      events (`message_start`, `content_block_start`, `content_block_delta`,
//      `content_block_stop`, `message_delta`, `message_stop`).
//   2. Eventually, a single complete `assistant` envelope summarising the turn.
//
// To make the chat actually stream character-by-character we accumulate the
// `stream_event` deltas into a synthetic assistant envelope. When the real
// `assistant` envelope arrives, we replace the synthetic one with it (their
// content is identical at that point, but the final envelope has authoritative
// usage / metadata).

interface StreamEventEnvelope {
  type: "stream_event";
  event?: {
    type: string;
    index?: number;
    delta?: {
      type: string;
      text?: string;
      thinking?: string;
      partial_json?: string;
    };
    content_block?: {
      type: string;
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      input?: unknown;
    };
    message?: { id?: string };
  };
}

type StreamingAssistantBlock = ContentBlock & {
  _partialJson?: string;
};

interface StreamingAssistantMessage {
  type: "assistant";
  _streamId?: string;
  message: {
    id?: string;
    content: StreamingAssistantBlock[];
    _streaming?: boolean;
  };
}

function findLastStreamingAssistant(prev: Envelope[]): number {
  for (let i = prev.length - 1; i >= 0; i--) {
    const env = prev[i] as { type?: string; message?: { _streaming?: boolean } };
    if (env?.type === "assistant" && env.message?._streaming) return i;
  }
  return -1;
}

function findAssistantByMessageId(prev: Envelope[], id: string | undefined): number {
  if (!id) return findLastStreamingAssistant(prev);
  for (let i = prev.length - 1; i >= 0; i--) {
    const env = prev[i] as { type?: string; message?: { id?: string } };
    if (env?.type === "assistant" && env.message?.id === id) return i;
  }
  return findLastStreamingAssistant(prev);
}

function mutateAssistantAt(
  prev: Envelope[],
  idx: number,
  fn: (m: StreamingAssistantMessage["message"]) => StreamingAssistantMessage["message"]
): Envelope[] {
  if (idx < 0) return prev;
  const env = prev[idx] as StreamingAssistantMessage;
  const next = [...prev];
  next[idx] = {
    ...env,
    message: fn(env.message || ({ content: [] } as StreamingAssistantMessage["message"])),
  };
  return next;
}

function mergeEnvelope(prev: Envelope[], envelope: Envelope): Envelope[] {
  if (!envelope || typeof envelope !== "object") return prev;
  const env = envelope as { type?: string };

  if (env.type === "stream_event") {
    const sse = envelope as StreamEventEnvelope;
    const evt = sse.event;
    if (!evt) return prev;

    if (evt.type === "message_start") {
      const placeholder: StreamingAssistantMessage = {
        type: "assistant",
        message: {
          id: evt.message?.id,
          content: [],
          _streaming: true,
        },
      };
      // Keep the message_start envelope itself in the array - its
      // `event.message.usage` is the only place we get the initial input /
      // cache token counts during live streaming. Without it, the meter is
      // stuck at zero until the post-reload replay re-injects the same
      // envelopes from the server.
      return [...prev, envelope, placeholder as unknown as Envelope];
    }

    if (evt.type === "content_block_start") {
      const idx = findAssistantByMessageId(prev, evt.message?.id);
      if (idx < 0) return prev;
      const blockIdx = evt.index ?? 0;
      return mutateAssistantAt(prev, idx, (msg) => {
        const blocks = [...(msg.content || [])];
        blocks[blockIdx] = { ...(evt.content_block as ContentBlock) };
        return { ...msg, content: blocks };
      });
    }

    if (evt.type === "content_block_delta") {
      const idx = findAssistantByMessageId(prev, evt.message?.id);
      if (idx < 0) return prev;
      const blockIdx = evt.index ?? 0;
      return mutateAssistantAt(prev, idx, (msg) => {
        const blocks = [...(msg.content || [])];
        const block = (blocks[blockIdx] || {}) as StreamingAssistantBlock;
        const next = { ...block } as StreamingAssistantBlock;
        const delta = evt.delta;
        if (delta?.type === "text_delta") {
          (next as { text?: string }).text =
            ((next as { text?: string }).text || "") + (delta.text || "");
          if (!next.type) (next as { type: string }).type = "text";
        } else if (delta?.type === "thinking_delta") {
          (next as { thinking?: string }).thinking =
            ((next as { thinking?: string }).thinking || "") + (delta.thinking || "");
          if (!next.type) (next as { type: string }).type = "thinking";
        } else if (delta?.type === "input_json_delta") {
          // tool_use input streams as JSON-string fragments; accumulate, parse
          // best-effort whenever the buffer is valid JSON.
          next._partialJson = (next._partialJson || "") + (delta.partial_json || "");
          try {
            (next as { input?: unknown }).input = JSON.parse(next._partialJson);
          } catch {
            /* still incomplete JSON - leave previous parsed value */
          }
        }
        blocks[blockIdx] = next;
        return { ...msg, content: blocks };
      });
    }

    if (evt.type === "message_stop") {
      const idx = findAssistantByMessageId(prev, evt.message?.id);
      if (idx < 0) return prev;
      return mutateAssistantAt(prev, idx, (msg) => ({ ...msg, _streaming: false }));
    }

    if (evt.type === "message_delta") {
      // message_delta carries the canonical per-message usage update (the
      // running output_tokens for this turn). Keep the envelope so
      // computeTokens can read it; otherwise the meter sits at the
      // message_start placeholder value (output_tokens=4 etc) for the
      // entire response.
      return [...prev, envelope];
    }

    // content_block_start/stop and other stream_event subtypes are mutations
    // on the placeholder we already track - no usage info, no need to keep
    // the envelope itself.
    return prev;
  }

  if (env.type === "assistant") {
    // Claude emits the canonical `assistant` envelope BEFORE `message_stop`,
    // so the message is still streaming at this point. Two regressions came
    // out of replacing the placeholder wholesale here:
    //   1. The `_streaming` flag was dropped, making the typewriter snap to
    //      full text the moment this envelope arrived.
    //   2. The final envelope sometimes ships only the `text` content block
    //      (the `thinking` block we accumulated from `thinking_delta`s
    //      disappears), so the thinking section vanished as soon as the
    //      stream finished.
    // Fix: when the placeholder was streaming, keep our delta-accumulated
    // content (it's the authoritative record of every block) and only pull
    // metadata from the incoming envelope. `message_stop` clears `_streaming`
    // and the typewriter then reveals any unrevealed tail instantly.
    const finalMsg = envelope as { message?: { id?: string; _streaming?: boolean } };
    const idx = findAssistantByMessageId(prev, finalMsg.message?.id);
    if (idx >= 0) {
      const prevEnv = prev[idx] as StreamingAssistantMessage;
      const next = [...prev];
      if (prevEnv.message?._streaming) {
        const incoming = envelope as { message?: Record<string, unknown> };
        const incomingMsg = (incoming.message || {}) as Record<string, unknown>;
        const accumulatedContent = prevEnv.message?.content || [];
        const incomingContent = (incomingMsg as { content?: ContentBlock[] }).content;
        // If the canonical envelope happens to carry MORE blocks (e.g. it
        // includes a tool_use we hadn't seen as a stream_event yet), prefer
        // it. Otherwise keep our accumulated blocks so we don't lose a
        // thinking section the canonical envelope omitted.
        const content =
          Array.isArray(incomingContent) && incomingContent.length > accumulatedContent.length
            ? incomingContent
            : accumulatedContent;
        next[idx] = {
          ...envelope,
          message: { ...incomingMsg, content, _streaming: true },
        } as Envelope;
      } else {
        next[idx] = envelope;
      }
      return next;
    }
    return [...prev, envelope];
  }

  return [...prev, envelope];
}

/**
 * Smooth out claude's bursty stream by dripping text/thinking deltas a few
 * characters per frame. Without this, short responses (where claude emits
 * the entire reply in one or two `text_delta` chunks) appear all-at-once.
 * The hook returns a derived envelope list with each actively-streaming
 * text/thinking block clamped to a displayed length that grows toward the
 * server's target via requestAnimationFrame.
 */
function useTypewriterEnvelopes(envelopes: Envelope[]): Envelope[] {
  const lengthsRef = useRef<Map<string, number>>(new Map());
  const envRef = useRef<Envelope[]>(envelopes);
  envRef.current = envelopes;
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const tickFnRef = useRef<(() => void) | null>(null);

  if (!tickFnRef.current) {
    tickFnRef.current = function tickFn() {
      const envs = envRef.current;
      const lengths = lengthsRef.current;
      let needsAnother = false;
      let mutated = false;
      for (let ei = 0; ei < envs.length; ei++) {
        const env = envs[ei];
        if (!env || (env as { type?: string }).type !== "assistant") continue;
        const e = env as StreamingAssistantMessage;
        const streaming = !!e.message?._streaming;
        const blocks = e.message?.content || [];
        for (let bi = 0; bi < blocks.length; bi++) {
          const b = blocks[bi];
          if (!b) continue;
          let key: string;
          let target: string;
          if (b.type === "text") {
            key = `${ei}:${bi}:t`;
            target = (b as { text?: string }).text || "";
          } else if (b.type === "thinking") {
            key = `${ei}:${bi}:th`;
            target = (b as { thinking?: string }).thinking || "";
          } else {
            continue;
          }
          const cur = lengths.get(key) ?? 0;
          if (cur >= target.length) continue;
          if (streaming) {
            // Catch up to target in roughly 0.4s; bigger gaps drip faster.
            const remaining = target.length - cur;
            const step = Math.max(2, Math.ceil(remaining / 24));
            lengths.set(key, Math.min(target.length, cur + step));
            needsAnother = true;
            mutated = true;
          } else {
            // Block is no longer streaming → reveal the rest instantly.
            lengths.set(key, target.length);
            mutated = true;
          }
        }
      }
      if (mutated) setTick((t) => (t + 1) & 0xffff);
      rafRef.current = needsAnother
        ? requestAnimationFrame(tickFnRef.current as FrameRequestCallback)
        : null;
    };
  }

  // Single long-lived RAF loop. Reads envelopes via ref so new server data
  // is picked up without tearing down and rescheduling the loop on every
  // websocket message - a previous version restarted on each envelope
  // change which dropped frames between bursts and hid the streaming.
  useEffect(() => {
    rafRef.current = requestAnimationFrame(tickFnRef.current as FrameRequestCallback);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  // Wake the loop when new envelopes arrive if it's parked (no pending work).
  useEffect(() => {
    if (rafRef.current == null && envelopes.length > 0) {
      rafRef.current = requestAnimationFrame(tickFnRef.current as FrameRequestCallback);
    }
  }, [envelopes]);

  // Reset lengths when envelopes shrink (e.g., the user starts a new run).
  useEffect(() => {
    if (envelopes.length === 0 && lengthsRef.current.size > 0) {
      lengthsRef.current.clear();
    }
  }, [envelopes.length]);

  return useMemo(() => {
    const lengths = lengthsRef.current;
    return envelopes.map((env, ei) => {
      if (!env || (env as { type?: string }).type !== "assistant") return env;
      const e = env as StreamingAssistantMessage;
      const blocks = e.message?.content || [];
      let changed = false;
      const nextBlocks = blocks.map((b, bi) => {
        if (b.type === "text") {
          const full = (b as { text?: string }).text || "";
          const len = lengths.get(`${ei}:${bi}:t`) ?? full.length;
          if (len < full.length) {
            changed = true;
            return { ...b, text: full.slice(0, len) };
          }
        } else if (b.type === "thinking") {
          const full = (b as { thinking?: string }).thinking || "";
          const len = lengths.get(`${ei}:${bi}:th`) ?? full.length;
          if (len < full.length) {
            changed = true;
            return { ...b, thinking: full.slice(0, len) };
          }
        }
        return b;
      });
      if (!changed) return env;
      return {
        ...e,
        message: { ...e.message, content: nextBlocks },
      } as unknown as Envelope;
    });
    // tick is intentionally a dep so this memo re-runs on each RAF step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopes, tick]);
}

// ── Page ──────────────────────────────────────────────────────────────

export function Run() {
  const { t } = useTranslation("run");
  const [searchParams, setSearchParams] = useSearchParams();
  const wsConnected = useSyncExternalStore(eventBus.onConnection, () => eventBus.connected);
  const [mode, setMode] = useState<RunMode>("conversation");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("acceptEdits");
  const [effort, setEffort] = useState<EffortLevel>("");
  const [cwd, setCwd] = useState("");
  const [resumeSession, setResumeSession] = useState<Session | null>(null);
  const [handle, setHandle] = useState<RunHandle | null>(null);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const displayEnvelopes = useTypewriterEnvelopes(envelopes);
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState<"start" | "send" | "stop" | "attach" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeRuns, setActiveRuns] = useState<RunListResponse | null>(null);
  const [runHistory, setRunHistory] = useState<DashboardRunHistoryItem[]>([]);
  const [binaryStatus, setBinaryStatus] = useState<{ found: boolean; path: string | null } | null>(
    null
  );
  const [cwdSuggestions, setCwdSuggestions] = useState<CwdSuggestion[]>([]);
  const [slashCommands, setSlashCommands] = useState<SlashCommand[]>(BUILTIN_SLASH_COMMANDS);

  // Pre-flight: probe binary + active runs + cwd suggestions on mount
  useEffect(() => {
    api.run
      .binary()
      .then(setBinaryStatus)
      .catch(() => setBinaryStatus({ found: false, path: null }));
    api.run
      .list()
      .then(setActiveRuns)
      .catch(() => undefined);
    api.run
      .history(50)
      .then((r) => setRunHistory(r.items))
      .catch(() => undefined);
    api.run
      .cwds()
      .then((r) => {
        setCwdSuggestions(r.items);
        // Pre-fill cwd with the user's home directory — a neutral default.
        // Spawning in the dashboard's own cwd would make ad-hoc runs inherit
        // this repo's project context (.claude/agents, skills, rules,
        // CLAUDE.md, .mcp.json), which is almost never what an ad-hoc run
        // wants and can bloat the initial request (issue #202). Fall back to
        // the dashboard cwd when no home suggestion exists. The user can
        // change it; we just don't want an invisible default.
        const home = r.items.find((s) => s.kind === "home");
        const dashboard = r.items.find((s) => s.kind === "dashboard");
        const preferred = home || dashboard;
        if (preferred) {
          setCwd((current) => current || preferred.path);
        }
      })
      .catch(() => undefined);
    // Discover user / project / plugin slash commands. The CLI's built-ins
    // are appended client-side.
    Promise.all([api.ccConfig.commands(), api.ccConfig.plugins()])
      .then(([cmdsResp, pluginsResp]) => {
        const userProject = cmdsResp.items.map<SlashCommand>((c) => ({
          name: c.name,
          description: (c.frontmatter?.description as string | undefined) || c.preview.slice(0, 80),
          source: c.scope === "project" ? "project" : "user",
          filePath: c.file,
        }));
        const pluginCmds: SlashCommand[] = [];
        for (const p of pluginsResp.plugins || []) {
          const cmds = p.contributes?.commands ?? 0;
          if (!cmds || !p.installPath) continue;
          // Plugin commands are listed by name only via the plugin's
          // contributions count; we don't enumerate them per-file here. The
          // user can still type the command and the autocomplete from
          // user/project covers most cases. For richer enumeration we'd
          // need a dedicated /plugins/:key/commands endpoint.
        }
        setSlashCommands([...userProject, ...pluginCmds, ...BUILTIN_SLASH_COMMANDS]);
      })
      .catch(() => undefined);
  }, []);

  const refreshList = useCallback(() => {
    api.run
      .list()
      .then(setActiveRuns)
      .catch(() => undefined);
    api.run
      .history(50)
      .then((r) => setRunHistory(r.items))
      .catch(() => undefined);
  }, []);

  // Background poll so the run list and history reflect external changes
  // (server-boot reconciliation, sibling tabs, direct DB edits) even when
  // no WS event fires. Lighter than typical WS gaps; aggressive enough that
  // status flips appear within seconds without needing a manual refresh.
  useEffect(() => {
    const tick = setInterval(() => {
      refreshList();
    }, 5000);
    return () => clearInterval(tick);
  }, [refreshList]);

  // Refresh whenever the tab regains focus / visibility - typical when the
  // user comes back from running `claude` in a terminal and wants to see the
  // current state of every run without waiting for the next poll.
  useEffect(() => {
    const onFocus = () => refreshList();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshList();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshList]);

  // Resume a run from the persistent history list. The history item carries
  // the claude session_id; we hydrate it into a Session object via the
  // existing /api/sessions/:id endpoint so the resume picker shows real
  // metadata, then drop the user back into the config card.
  // Resume a past dashboard run. Spawns a fresh `claude --resume <id>` with
  // an empty initial prompt - claude idles on the resumed conversation
  // until the user types a follow-up. The user lands directly in the chat
  // view (the new live handle is attached) instead of being forced back to
  // the config card.
  const onResumeFromHistory = useCallback(
    async (item: DashboardRunHistoryItem) => {
      if (!item.session_id) return;
      if (busy) return;
      setBusy("start");
      setError(null);
      try {
        // Load the past transcript in parallel with spawning so the user
        // doesn't stare at an empty screen - the resumed run starts cold and
        // claude --resume doesn't replay anything over stdout.
        const [fetched, transcript] = await Promise.all([
          api.run.start({
            prompt: "",
            mode: "conversation",
            cwd: item.cwd || undefined,
            model: item.model || undefined,
            permissionMode: item.permission_mode || undefined,
            effort: item.effort || undefined,
            resumeSessionId: item.session_id,
          }),
          api.sessions
            .transcript(item.session_id, { limit: 200 })
            .catch(() => ({ messages: [] as TranscriptMessage[] })),
        ]);
        setHandle(fetched);
        setEnvelopes(transcriptToEnvelopes(transcript.messages));
        setFollowUp("");
        setResumeSession(null);
        refreshList();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        setError(t("errors.startFailed", { message: msg }));
      } finally {
        setBusy(null);
      }
    },
    [busy, refreshList, t]
  );

  // View a past run inline (no spawn). Headless runs are single-shot, so
  // there's no resume - but the transcript is still worth seeing without
  // navigating away. Seeds the chat view with the past messages and a
  // synthetic completed handle so the UI renders as read-only (no Stop
  // button, no follow-up input - both are gated on isLive).
  const onViewFromHistory = useCallback(
    async (item: DashboardRunHistoryItem) => {
      if (!item.session_id) return;
      if (busy) return;
      setError(null);
      try {
        const transcript = await api.sessions.transcript(item.session_id, { limit: 200 });
        const synthetic: RunHandle = {
          id: item.id,
          pid: null,
          mode: item.mode,
          cwd: item.cwd,
          model: item.model,
          permissionMode: item.permission_mode || "acceptEdits",
          effort: item.effort,
          prompt: item.prompt_preview || "",
          argv: [],
          resumeSessionId: item.resume_session_id,
          status: item.status,
          startedAt: new Date(item.started_at).getTime(),
          endedAt: item.ended_at ? new Date(item.ended_at).getTime() : null,
          exitCode: item.exit_code,
          signal: null,
          error: null,
          sessionId: item.session_id,
          envelopeCount: transcript.messages.length,
          stdoutTail: "",
          stderrTail: "",
        };
        setHandle(synthetic);
        setEnvelopes(transcriptToEnvelopes(transcript.messages));
        setMode(item.mode);
        setFollowUp("");
        setResumeSession(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        setError(t("errors.attachFailed", { message: msg }));
      }
    },
    [busy, t]
  );

  // WebSocket subscription - only act on messages for the current handle.
  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "run_stream") {
        const p = msg.data as RunStreamPayload;
        if (handle && p.id === handle.id) {
          // React 18 auto-batches async setStates, which collapses bursts of
          // stream_event deltas (and the final `assistant` envelope that
          // follows them) into a single render - visually erasing the
          // streaming effect. flushSync forces a commit per envelope so the
          // user sees text_delta / thinking_delta chunks paint as they
          // arrive instead of all at once.
          flushSync(() => {
            setEnvelopes((prev) => mergeEnvelope(prev, p.envelope as Envelope));
          });
        }
      } else if (msg.type === "run_status") {
        const p = msg.data as RunStatusPayload;
        if (handle && p.id === handle.id) {
          setHandle((h) =>
            h
              ? {
                  ...h,
                  status: p.status,
                  endedAt: p.at,
                  exitCode: p.exitCode ?? h.exitCode,
                  sessionId: p.sessionId ?? h.sessionId,
                  error: p.error ?? h.error,
                }
              : h
          );
        }
        refreshList();
      } else if (msg.type === "run_input_ack") {
        const p = msg.data as RunInputAckPayload;
        if (handle && p.id === handle.id) {
          // Optimistically add the user envelope so the chat shows it
          // immediately (the spawned `claude` won't echo our user input
          // back on stdout in stream-json; we own that side).
          setEnvelopes((prev) => [
            ...prev,
            { type: "user", message: { content: followUpRef.current || "" } } as UserMessage,
          ]);
        }
      }
    });
  }, [handle, refreshList]);

  // Keep latest follow-up in a ref so the WS handler can read it without
  // closure staleness during ack injection.
  const followUpRef = useRef("");
  useEffect(() => {
    followUpRef.current = followUp;
  }, [followUp]);

  const start = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy("start");
    setError(null);
    setEnvelopes([]);
    try {
      // Resume always uses conversation mode (server enforces this too).
      const effectiveMode: RunMode = resumeSession ? "conversation" : mode;
      const effectiveCwd = resumeSession?.cwd || cwd || undefined;
      // Expand /user-or-project slash commands client-side so the model
      // receives the rendered template, matching what the CLI does.
      const expandedPrompt = await maybeExpandSlashCommand(prompt, slashCommands);
      const result = await api.run.start({
        prompt: expandedPrompt,
        mode: effectiveMode,
        cwd: effectiveCwd,
        model: model || undefined,
        permissionMode,
        resumeSessionId: resumeSession?.id,
        effort: effort || undefined,
      });
      setHandle(result);
      // Optimistic user-turn injection so the chat shows your prompt right away.
      setEnvelopes([{ type: "user", message: { content: prompt } } as UserMessage]);
      refreshList();
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "unknown";
      setError(t("errors.startFailed", { message: m }));
    } finally {
      setBusy(null);
    }
  }, [prompt, mode, cwd, model, permissionMode, busy, refreshList, t, resumeSession]);

  const attachToRun = useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy("attach");
      setError(null);
      try {
        const fetched = await api.run.get(id, { envelopes: true });
        const spawnerEnvs = ((fetched.envelopes as Envelope[]) || []).slice();
        let envelopesToUse = spawnerEnvs;

        // The spawner's in-memory envelope log only contains envelopes that
        // came over stdout for this specific spawn. For a resumed run, that
        // means prior history is missing - claude --resume reads the prior
        // transcript as context but doesn't replay it on stdout. Without
        // this, re-attaching to a resumed run after navigating away loses
        // everything from before the resume. The session's JSONL transcript
        // on disk has the full story (prior + current), so we use it
        // whenever it has more user/assistant messages than the spawner has
        // seen; otherwise we keep the spawner's log (which is authoritative
        // for in-progress streaming since stream_event deltas don't land in
        // the transcript file until the turn finishes).
        if (fetched.sessionId) {
          try {
            const transcript = await api.sessions.transcript(fetched.sessionId, { limit: 200 });
            const transcriptEnvs = transcriptToEnvelopes(transcript.messages);
            const spawnerCanonicalCount = spawnerEnvs.filter((e) => {
              const t = (e as { type?: string }).type;
              return t === "user" || t === "assistant";
            }).length;
            if (transcriptEnvs.length > spawnerCanonicalCount) {
              envelopesToUse = transcriptEnvs;
            }
          } catch {
            /* transcript fetch failed - keep the spawner's log */
          }
        }

        setHandle(fetched);
        setEnvelopes(envelopesToUse);
        setFollowUp("");
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : "unknown";
        setError(t("errors.attachFailed", { message: m }));
      } finally {
        setBusy(null);
      }
    },
    [busy, t]
  );

  // Honor `?session=<id>` deep-links from /sessions and /sessions/:id -
  // map the session id to a live run handle and attach to it instead of
  // dropping the user on the new-run config card. Strip the param once
  // consumed so a refresh of the Run page doesn't keep re-attaching.
  const attachAttemptedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const sid = searchParams.get("session");
    if (!sid) return;
    if (handle && handle.sessionId === sid) {
      // Already attached to this session - just clean the URL.
      const next = new URLSearchParams(searchParams);
      next.delete("session");
      setSearchParams(next, { replace: true });
      return;
    }
    if (attachAttemptedRef.current.has(sid)) return;
    attachAttemptedRef.current.add(sid);
    api.run
      .list()
      .then((list) => {
        const target = list.items.find(
          (h) => h.sessionId === sid && (h.status === "running" || h.status === "spawning")
        );
        if (target) {
          void attachToRun(target.id);
        } else {
          setError(
            t(
              "errors.sessionRunNotFound",
              "No active dashboard run is driving this session right now."
            )
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("session");
        setSearchParams(next, { replace: true });
      });
  }, [searchParams, setSearchParams, handle, attachToRun, t]);

  // Prefill the prompt box from `?prompt=<text>` (e.g. Tabby's Ask handoff).
  // Apply once, then strip the param so a later refresh doesn't overwrite edits
  // the user has since made to the prompt. When `?autostart=1` is also present
  // (Tabby's "ask" path), arm a pending flag so the run fires automatically
  // once preflight is ready - see the autostart effect below.
  const promptPrefilledRef = useRef(false);
  const pendingAutostartRef = useRef(false);
  useEffect(() => {
    if (promptPrefilledRef.current) return;
    const p = searchParams.get("prompt");
    if (!p) return;
    promptPrefilledRef.current = true;
    if (searchParams.get("autostart") === "1") pendingAutostartRef.current = true;
    setPrompt(p);
    const next = new URLSearchParams(searchParams);
    next.delete("prompt");
    next.delete("autostart");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Autostart a deep-linked prompt once preflight has settled. We wait for the
  // binary probe (can't spawn without `claude`), the prefilled prompt, and the
  // defaulted cwd so the spawn matches exactly what the manual Start button
  // would do. Fires at most once; if `claude` isn't found or a run is already
  // in flight, it disarms and leaves the prompt prefilled for a manual Start.
  useEffect(() => {
    if (!pendingAutostartRef.current) return;
    if (binaryStatus === null) return; // probe still pending
    if (!binaryStatus.found) {
      pendingAutostartRef.current = false;
      return;
    }
    if (busy || handle) {
      pendingAutostartRef.current = false;
      return;
    }
    if (!prompt.trim() || !cwd) return; // wait for prefill + cwd default
    pendingAutostartRef.current = false;
    void start();
  }, [binaryStatus, prompt, cwd, busy, handle, start]);

  const send = useCallback(async () => {
    if (!handle || !followUp.trim() || busy) return;
    setBusy("send");
    setError(null);
    try {
      const expanded = await maybeExpandSlashCommand(followUp, slashCommands);
      await api.run.send(handle.id, expanded);
      // The user envelope is appended optimistically when the WS ack arrives
      // (so deduping is consistent with stream order). Clear the input now.
      setFollowUp("");
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "unknown";
      setError(t("errors.sendFailed", { message: m }));
    } finally {
      setBusy(null);
    }
  }, [handle, followUp, busy, t, slashCommands]);

  const stop = useCallback(async () => {
    if (!handle || busy) return;
    setBusy("stop");
    setError(null);
    try {
      await api.run.kill(handle.id);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "unknown";
      setError(t("errors.killFailed", { message: m }));
    } finally {
      setBusy(null);
    }
  }, [handle, busy, t]);

  const newRun = useCallback(() => {
    setHandle(null);
    setEnvelopes([]);
    setFollowUp("");
    setPrompt("");
    setResumeSession(null);
    setError(null);
  }, []);

  const status = handle?.status ?? "idle";
  const isLive = status === "spawning" || status === "running";
  const hasFinished = status === "completed" || status === "error" || status === "killed";

  // Only lock the page to the viewport when we're showing a live run session.
  // The config-card screen needs normal page flow so the form is fully
  // reachable on short windows. The run-session screen, however, owns the
  // chat panel and we want long chats to scroll inside the panel - never the
  // page - so we constrain only that case.
  const viewportLocked = !!handle;
  return (
    <div
      className={
        viewportLocked
          ? "h-[calc(100vh-2.5rem)] lg:h-[calc(100vh-3rem)] flex flex-col gap-5"
          : "space-y-5"
      }
    >
      <Header
        activeRuns={activeRuns}
        currentHandleId={handle?.id || null}
        onAttach={attachToRun}
        wsConnected={wsConnected}
        runHistory={runHistory}
        onResumeFromHistory={onResumeFromHistory}
        onViewFromHistory={onViewFromHistory}
        onRefresh={refreshList}
      />

      {binaryStatus && !binaryStatus.found && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t("binary.missing")}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 break-all">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-200/70 hover:text-red-100 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!handle && <LimitationsBanner />}

      {!handle ? (
        // Config card uses normal page flow - page scrolls if needed.
        <ConfigCard
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            // Headless can't resume - clearing keeps the UI honest if the
            // user had a session pinned and then switched mode.
            if (m === "headless") setResumeSession(null);
          }}
          prompt={prompt}
          onPromptChange={setPrompt}
          cwd={cwd}
          onCwdChange={setCwd}
          cwdSuggestions={cwdSuggestions}
          model={model}
          onModelChange={setModel}
          permissionMode={permissionMode}
          onPermissionModeChange={setPermissionMode}
          effort={effort}
          onEffortChange={setEffort}
          binaryFound={binaryStatus?.found ?? true}
          busy={busy === "start"}
          onStart={start}
          activeRuns={activeRuns}
          resumeSession={resumeSession}
          onResumeSessionChange={setResumeSession}
          slashCommands={slashCommands}
          runHistory={runHistory}
          onResumeFromHistory={onResumeFromHistory}
        />
      ) : (
        // Run session is wrapped in a flex container so its inner chat panel
        // can take all remaining viewport height; long chats scroll inside.
        <div className="flex-1 min-h-0 flex flex-col">
          <RunSession
            handle={handle}
            envelopes={displayEnvelopes}
            mode={handle.mode}
            isLive={isLive}
            hasFinished={hasFinished}
            followUp={followUp}
            onFollowUpChange={setFollowUp}
            busy={busy}
            onSend={send}
            onStop={stop}
            onNewRun={newRun}
            slashCommands={slashCommands}
          />
        </div>
      )}
    </div>
  );
}

// ── Limitations banner (above the config card) ────────────────────────

const LIMITATIONS_MINIMIZED_KEY = "run-limitations-minimized-v1";

function LimitationsBanner() {
  const { t } = useTranslation("run");
  const [minimized, setMinimized] = useState(() => {
    try {
      return localStorage.getItem(LIMITATIONS_MINIMIZED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [expanded, setExpanded] = useState(false);
  const persistMinimized = (v: boolean) => {
    try {
      localStorage.setItem(LIMITATIONS_MINIMIZED_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    setMinimized(v);
  };
  const minimize = () => persistMinimized(true);
  const restore = () => {
    persistMinimized(false);
    setExpanded(false);
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={restore}
        className="group w-full flex items-center gap-2 rounded-lg border border-border/70 bg-surface-2/60 hover:bg-surface-2 hover:border-amber-500/30 px-3 py-1.5 text-left transition-colors"
        aria-label={t("limitations.restore", "Show in-browser run notes")}
        title={t("limitations.restore", "Show in-browser run notes")}
      >
        <span className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/30 inline-flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-3 h-3 text-amber-300" />
        </span>
        <span className="text-[11.5px] text-gray-400 truncate">
          <span className="text-gray-200 font-medium">{t("limitations.title")}</span>
          <span className="text-gray-600 mx-1.5">·</span>
          <span>
            {t(
              "limitations.peek",
              "Most TUI features carry over. A handful of interactive ones don't."
            )}
          </span>
        </span>
        <ChevronDown className="w-3 h-3 text-gray-500 group-hover:text-gray-300 ml-auto flex-shrink-0 transition-colors" />
      </button>
    );
  }
  return (
    <div className="relative rounded-xl border border-border/70 bg-gradient-to-br from-amber-500/[0.04] via-surface-2 to-surface-1 px-5 py-4 shadow-sm shadow-black/10">
      <button
        onClick={minimize}
        className="absolute top-3 right-3 w-6 h-6 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 inline-flex items-center justify-center transition-colors"
        aria-label={t("limitations.minimize", "Minimize")}
        title={t("limitations.minimize", "Minimize")}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-gray-100 leading-tight">
            {t("limitations.title")}
          </div>
          <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-gray-500">
            <span className="font-mono px-1.5 py-0.5 rounded border border-border bg-surface-2/60 text-gray-400">
              stream-json
            </span>
            <span className="text-gray-600">·</span>
            <span>{t("limitations.subtitle", "same binary, different surface")}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3.5 pl-12 pr-1">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-emerald-300 mb-1.5 inline-flex items-center gap-1.5 uppercase tracking-wide">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t("limitations.supported")}
          </div>
          <ul className="text-[11.5px] text-gray-300 leading-[1.55] space-y-1 marker:text-emerald-500/40 list-disc pl-4">
            <li>Live streaming output - text, thinking, tool calls, tool results</li>
            <li>Multi-turn conversations &amp; resuming any past session</li>
            <li>User / project / plugin slash commands (template expansion)</li>
            <li>
              <code className="text-[10.5px] text-gray-200">@</code>-references to files in the
              working directory
            </li>
            <li>Live token / context-window meter</li>
            <li>
              Active-runs switcher; full transcripts in{" "}
              <code className="text-[10.5px] text-gray-200">/sessions</code>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] px-3.5 py-2.5">
          <div className="text-[11px] font-semibold text-rose-300 mb-1.5 inline-flex items-center gap-1.5 uppercase tracking-wide">
            <XCircle className="w-3.5 h-3.5" />
            {t("limitations.limited")}
          </div>
          <ul className="text-[11.5px] text-gray-300 leading-[1.55] space-y-1 marker:text-rose-500/40 list-disc pl-4">
            <li>
              Built-in slash commands (<code className="text-[10.5px] text-gray-200">/help</code>,{" "}
              <code className="text-[10.5px] text-gray-200">/model</code>,{" "}
              <code className="text-[10.5px] text-gray-200">/clear</code>,{" "}
              <code className="text-[10.5px] text-gray-200">/compact</code>) - they mutate CLI-only
              state
            </li>
            <li>Mid-session permission prompts - pick the mode at spawn time</li>
            <li>Compaction prompts mid-conversation</li>
            <li>Mid-session model or effort changes (set them at spawn time)</li>
          </ul>
        </div>
      </div>

      <div className="mt-3 pl-12 pr-1 flex items-center gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-border bg-surface-2 hover:bg-surface-3 text-gray-300 inline-flex items-center gap-1.5 transition-colors"
          aria-expanded={expanded}
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? t("limitations.collapse") : t("limitations.why", "Why")}
        </button>
        {!expanded && (
          <span className="text-[10.5px] text-gray-600 truncate">
            {t(
              "limitations.peek",
              "Most TUI features carry over. A handful of interactive ones don't."
            )}
          </span>
        )}
      </div>
      {expanded && (
        <div className="mt-3 pl-12 pr-1 space-y-2 border-t border-border/40 pt-3">
          <p className="text-[11.5px] text-gray-400 leading-relaxed">{t("limitations.intro")}</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">{t("limitations.tldr")}</p>
        </div>
      )}
    </div>
  );
}

// ── Token / context-window meter ──────────────────────────────────────

interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number | null;
  contextWindow: number | null;
}

const DEFAULT_CONTEXT_WINDOW = 200_000;

/**
 * Roll up token usage from the in-memory envelope log. Pulls the latest
 * `usage` block from `stream_event/message_delta` events (live numbers
 * during streaming) and the canonical `result.usage` envelope when the run
 * finishes. The 1M-context Opus variants emit `contextWindow` in
 * `result.modelUsage`; we surface that to size the meter correctly.
 */
function computeTokens(envelopes: Envelope[]): TokenStats {
  // Per-turn rolling counters (overwritten as each new turn's message_start
  // arrives). The latest message_start's input + cache numbers reflect the
  // current turn's prompt size, which is the right thing to show in the
  // "Context" gauge.
  let inputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  // Output is summed across all completed turns plus the running current
  // turn - claude reports output_tokens as a per-turn (per-message) number,
  // not cumulative. Without summing, the meter resets every time a new
  // `message_start` arrives.
  let completedOutputTokens = 0;
  let currentTurnOutput = 0;
  let costUsd: number | null = null;
  let contextWindow: number | null = null;
  let sawMessageStart = false;
  // While we don't have an authoritative output count from message_delta /
  // result, estimate from the char count in the streaming assistant block
  // so the meter ticks live as text appears (claude doesn't emit usage on
  // every text_delta).
  let outputAuthoritativeForCurrent = false;
  let streamingChars = 0;

  const commitTurn = () => {
    completedOutputTokens += currentTurnOutput;
    currentTurnOutput = 0;
    outputAuthoritativeForCurrent = false;
    streamingChars = 0;
  };

  for (const env of envelopes) {
    const e = env as { type?: string };
    if (e.type === "stream_event") {
      const ev = (
        env as {
          event?: {
            type?: string;
            usage?: Record<string, number>;
            message?: { usage?: Record<string, number> };
          };
        }
      ).event;
      if (!ev) continue;
      if (ev.type === "message_start") {
        // Roll the previous turn's running output into the cumulative total
        // before resetting for this new turn.
        if (sawMessageStart) commitTurn();
        sawMessageStart = true;
        const u = ev.message?.usage;
        if (u) {
          inputTokens = u.input_tokens ?? 0;
          cacheReadTokens = u.cache_read_input_tokens ?? 0;
          cacheCreationTokens = u.cache_creation_input_tokens ?? 0;
          currentTurnOutput = u.output_tokens ?? 0;
        }
      } else if (ev.type === "message_delta") {
        const u = ev.usage;
        if (u && typeof u.output_tokens === "number") {
          // Authoritative running output for the current turn.
          currentTurnOutput = u.output_tokens;
          outputAuthoritativeForCurrent = true;
        }
      }
    } else if (e.type === "result") {
      const r = env as ResultEnvelope & {
        modelUsage?: Record<
          string,
          {
            contextWindow?: number;
            inputTokens?: number;
            outputTokens?: number;
            cacheReadInputTokens?: number;
            cacheCreationInputTokens?: number;
          }
        >;
      };
      // Result is end-of-run: commit any in-flight current turn first.
      if (currentTurnOutput > 0) {
        completedOutputTokens += currentTurnOutput;
        currentTurnOutput = 0;
        outputAuthoritativeForCurrent = false;
      }
      if (typeof r.total_cost_usd === "number") costUsd = r.total_cost_usd;
      if (r.modelUsage && typeof r.modelUsage === "object") {
        for (const m of Object.values(r.modelUsage)) {
          if (!m || typeof m !== "object") continue;
          if (typeof m.contextWindow === "number") contextWindow = m.contextWindow;
          // Prefer modelUsage's per-model totals when available - these are
          // the canonical per-run numbers.
          if (typeof m.inputTokens === "number") inputTokens = m.inputTokens;
          if (typeof m.cacheReadInputTokens === "number") cacheReadTokens = m.cacheReadInputTokens;
          if (typeof m.cacheCreationInputTokens === "number")
            cacheCreationTokens = m.cacheCreationInputTokens;
          if (typeof m.outputTokens === "number") {
            // modelUsage.outputTokens is the run total for this model - use
            // it as the canonical cumulative output, replacing our running
            // sum.
            completedOutputTokens = m.outputTokens;
          }
        }
      }
    } else if (e.type === "system" && (env as SystemInit).model) {
      // Heuristic: 1M Opus has [1m] in the model id
      const model = (env as SystemInit).model || "";
      if (/\[1m\]/i.test(model)) contextWindow = 1_000_000;
    } else if (e.type === "assistant") {
      const msg = (
        env as {
          message?: {
            _streaming?: boolean;
            content?: ContentBlock[];
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
              cache_read_input_tokens?: number;
              cache_creation_input_tokens?: number;
            };
          };
        }
      ).message;
      if (msg?._streaming) {
        streamingChars = 0;
        const blocks = msg.content || [];
        for (const b of blocks) {
          if (b.type === "text") {
            streamingChars += ((b as { text?: string }).text || "").length;
          } else if (b.type === "thinking") {
            streamingChars += ((b as { thinking?: string }).thinking || "").length;
          }
        }
      } else if (msg?.usage) {
        // Transcript-derived seed envelopes carry usage but have no
        // `message.id` (transcriptToEnvelopes doesn't set one). Live-stream
        // canonical envelopes always have an id assigned by message_start,
        // and their tokens are already counted via stream_event / commitTurn
        // - folding them here would double-count. Use id-presence as the
        // discriminator: no id → transcript-seeded → fold; id → live → skip.
        const hasId = !!(msg as { id?: string }).id;
        if (!hasId) {
          const u = msg.usage;
          if (typeof u.input_tokens === "number") inputTokens = u.input_tokens;
          if (typeof u.cache_read_input_tokens === "number") {
            cacheReadTokens = u.cache_read_input_tokens;
          }
          if (typeof u.cache_creation_input_tokens === "number") {
            cacheCreationTokens = u.cache_creation_input_tokens;
          }
          if (typeof u.output_tokens === "number") {
            completedOutputTokens += u.output_tokens;
          }
        }
      }
    }
  }

  // While we don't have an authoritative output count for the current turn,
  // surface the char-based estimate so the meter ticks live during streaming.
  if (!outputAuthoritativeForCurrent && streamingChars > 0) {
    const estimate = Math.ceil(streamingChars / 4);
    if (estimate > currentTurnOutput) currentTurnOutput = estimate;
  }

  return {
    inputTokens,
    outputTokens: completedOutputTokens + currentTurnOutput,
    cacheReadTokens,
    cacheCreationTokens,
    costUsd,
    contextWindow,
  };
}

function formatNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 100_000) return (n / 1000).toFixed(1) + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

function TokenMeter({ stats }: { stats: TokenStats }) {
  const { t } = useTranslation("run");
  const total = stats.inputTokens + stats.cacheReadTokens + stats.cacheCreationTokens;
  const cap = stats.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  const pct = Math.min(100, Math.round((total / cap) * 100));
  const tone = pct >= 95 ? "red" : pct >= 80 ? "amber" : "indigo";
  const barColor =
    tone === "red"
      ? "bg-red-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-gradient-to-r from-cyan-500 to-indigo-500";
  return (
    <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
      <span className="inline-flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-gray-500" />
        <span className="text-gray-500">{t("tokens.label")}</span>
        <span className="font-mono text-gray-200">
          {formatNum(total)} / {formatNum(cap)}
        </span>
        <span
          className={`font-mono ${tone === "red" ? "text-red-300" : tone === "amber" ? "text-amber-300" : "text-gray-500"}`}
        >
          ({pct}%)
        </span>
      </span>
      <div className="flex-1 min-w-24 h-1.5 bg-surface-3 rounded-full overflow-hidden max-w-xs">
        <div
          className={`h-full ${barColor} transition-all duration-300 rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="inline-flex items-center gap-3">
        <span>
          <span className="text-gray-500">{t("tokens.input")}:</span>{" "}
          <span className="font-mono text-gray-300">{formatNum(stats.inputTokens)}</span>
        </span>
        <span>
          <span className="text-gray-500">{t("tokens.output")}:</span>{" "}
          <span className="font-mono text-gray-300">{formatNum(stats.outputTokens)}</span>
        </span>
        {stats.cacheReadTokens > 0 && (
          <span>
            <span className="text-gray-500">{t("tokens.cacheRead")}:</span>{" "}
            <span className="font-mono text-emerald-300">{formatNum(stats.cacheReadTokens)}</span>
          </span>
        )}
        {stats.costUsd != null && (
          <span>
            <span className="text-gray-500">{t("tokens.cost")}:</span>{" "}
            <span className="font-mono text-gray-200">${stats.costUsd.toFixed(4)}</span>
          </span>
        )}
      </span>
    </div>
  );
}

// ── Slash commands (built-in list + user/project/plugin from API) ─────

interface SlashCommand {
  name: string;
  description?: string;
  source: "builtin" | "user" | "project" | "plugin";
  filePath?: string;
}

// Built-in commands the CLI handles itself. We surface them in autocomplete
// with a "CLI only" tag so users know they won't actually execute when
// sent over stream-json stdin.
const BUILTIN_SLASH_COMMANDS: SlashCommand[] = [
  { name: "help", description: "List available commands", source: "builtin" },
  { name: "clear", description: "Clear the conversation", source: "builtin" },
  { name: "config", description: "Open the interactive config menu", source: "builtin" },
  { name: "model", description: "Change model mid-session", source: "builtin" },
  { name: "compact", description: "Compact the conversation context", source: "builtin" },
  { name: "memory", description: "Edit CLAUDE.md", source: "builtin" },
  { name: "hooks", description: "Manage hooks", source: "builtin" },
  { name: "cost", description: "Show session cost", source: "builtin" },
  { name: "agents", description: "List subagents", source: "builtin" },
  { name: "review", description: "Review current changes", source: "builtin" },
  { name: "release-notes", description: "Show CC release notes", source: "builtin" },
  { name: "permissions", description: "Edit permission rules", source: "builtin" },
  { name: "status", description: "Show session status", source: "builtin" },
  { name: "init", description: "Initialise CLAUDE.md from codebase", source: "builtin" },
  { name: "login", description: "Sign in to Claude", source: "builtin" },
  { name: "logout", description: "Sign out", source: "builtin" },
  { name: "exit", description: "Exit the session", source: "builtin" },
  { name: "mcp", description: "Manage MCP servers", source: "builtin" },
  { name: "plugin", description: "Manage plugins", source: "builtin" },
  { name: "output-style", description: "Change output style", source: "builtin" },
];

function commandSourceLabel(s: SlashCommand["source"]): string {
  return s === "builtin"
    ? "CLI only"
    : s === "user"
      ? "user"
      : s === "project"
        ? "project"
        : "plugin";
}

function commandSourceTone(s: SlashCommand["source"]): string {
  return s === "builtin"
    ? "bg-gray-500/10 text-gray-400 border-gray-500/30"
    : s === "user"
      ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
      : s === "project"
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        : "bg-violet-500/10 text-violet-300 border-violet-500/30";
}

/**
 * Expand a user/project/plugin slash command client-side. Reads the command
 * markdown body via /api/cc-config/file, strips frontmatter, and substitutes
 * `$ARGUMENTS` with whatever the user typed after the command name. If the
 * command isn't user-defined (built-in or unknown), returns the original
 * text unchanged so it still gets sent (the model will see it as text).
 */
async function maybeExpandSlashCommand(text: string, commands: SlashCommand[]): Promise<string> {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("/")) return text;
  const m = trimmed.match(/^\/([\w:-]+)(?:\s+([\s\S]*))?$/);
  if (!m) return text;
  const [, name, args = ""] = m;
  const cmd = commands.find((c) => c.name === name);
  if (!cmd || cmd.source === "builtin" || !cmd.filePath) return text;
  try {
    const body = await api.ccConfig.file(cmd.filePath);
    let content = body.text;
    // Strip frontmatter if present
    if (content.startsWith("---")) {
      const end = content.indexOf("\n---", 3);
      if (end >= 0) content = content.slice(end + 4).replace(/^\s*\n/, "");
    }
    return content.replace(/\$ARGUMENTS/g, args);
  } catch {
    return text;
  }
}

// ── Autocomplete dropdown for slash + @-files ─────────────────────────

interface AutocompleteState {
  kind: "slash" | "file";
  query: string;
  // The position in the textarea where the trigger character starts (so we
  // can replace from there to the cursor on selection).
  triggerStart: number;
  cursor: number;
}

/**
 * Tiered slash-command match scoring. Higher = more relevant. Returns 0 for
 * "doesn't match, hide it." Tiers in descending priority:
 *   1. Exact name match
 *   2. Name starts with query
 *   3. Word boundary (after `-` / `_` / `.`) starts with query
 *   4. Name contains query (earlier index ranks higher)
 *   5. Subsequence match across the name
 *   6. Description contains query - only when query is at least 3 chars,
 *      so a single keystroke can't drag in tangential descriptions.
 */
function scoreSlashMatch(name: string, description: string | undefined, q: string): number {
  if (!q) return 1;
  const n = name.toLowerCase();
  if (n === q) return 1000;
  if (n.startsWith(q)) return 800 - Math.min(n.length, 100);
  const parts = n.split(/[-_.\s]/);
  if (parts.some((p) => p.startsWith(q))) {
    return 600 - Math.min(n.length, 100);
  }
  const idx = n.indexOf(q);
  if (idx >= 0) return 400 - Math.min(idx, 100);
  if (subsequenceMatch(n, q)) return 200;
  if (q.length >= 3) {
    const d = (description || "").toLowerCase();
    if (d.includes(q)) return 100;
  }
  return 0;
}

function subsequenceMatch(s: string, q: string): boolean {
  let i = 0;
  for (let k = 0; k < s.length && i < q.length; k++) {
    if (s[k] === q[i]) i++;
  }
  return i === q.length;
}

function detectAutocomplete(value: string, cursor: number): AutocompleteState | null {
  // Look back from the cursor to find the active "token". A token starts at
  // the beginning of the line / after whitespace and continues until cursor.
  let start = cursor;
  while (start > 0) {
    const ch = value[start - 1];
    if (!ch || /\s/.test(ch)) break;
    start--;
  }
  const tok = value.slice(start, cursor);
  if (tok.startsWith("/") && tok.length >= 1) {
    // Only trigger for slash if it's at line start OR right after whitespace.
    // The detection above already enforces that.
    return { kind: "slash", query: tok.slice(1), triggerStart: start, cursor };
  }
  if (tok.startsWith("@") && tok.length >= 1) {
    return { kind: "file", query: tok.slice(1), triggerStart: start, cursor };
  }
  return null;
}

interface PromptEditorProps {
  value: string;
  onChange: (s: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  slashCommands: SlashCommand[];
  fileCwd: string;
  autoFocus?: boolean;
}

function PromptEditor({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 4,
  slashCommands,
  fileCwd,
  autoFocus,
}: PromptEditorProps) {
  const { t } = useTranslation("run");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [state, setState] = useState<AutocompleteState | null>(null);
  const [active, setActive] = useState(0);
  const [fileSuggestions, setFileSuggestions] = useState<string[]>([]);
  const fileFetchRef = useRef<{ q: string; t: number } | null>(null);

  // Slash filter - tiered scoring so prefix matches outrank arbitrary
  // substring hits, name matches outrank description matches, and shorter
  // names break ties when scores are equal.
  const slashItems = useMemo(() => {
    if (!state || state.kind !== "slash") return [] as SlashCommand[];
    const q = state.query.toLowerCase();
    const sourceOrder = { project: 0, user: 1, plugin: 2, builtin: 3 } as const;
    if (!q) {
      return [...slashCommands].sort(
        (a, b) => sourceOrder[a.source] - sourceOrder[b.source] || a.name.localeCompare(b.name)
      );
    }
    type Scored = { cmd: SlashCommand; score: number };
    const scored: Scored[] = [];
    for (const cmd of slashCommands) {
      const score = scoreSlashMatch(cmd.name, cmd.description, q);
      if (score > 0) scored.push({ cmd, score });
    }
    return scored
      .sort(
        (a, b) =>
          b.score - a.score ||
          sourceOrder[a.cmd.source] - sourceOrder[b.cmd.source] ||
          a.cmd.name.length - b.cmd.name.length ||
          a.cmd.name.localeCompare(b.cmd.name)
      )
      .map((s) => s.cmd);
  }, [state, slashCommands]);

  // File fetch (debounced)
  useEffect(() => {
    if (!state || state.kind !== "file") return;
    const ts = Date.now();
    fileFetchRef.current = { q: state.query, t: ts };
    const tid = setTimeout(() => {
      if (fileFetchRef.current?.t !== ts) return;
      api.run
        .files(fileCwd, state.query)
        .then((r) => setFileSuggestions(r.items))
        .catch(() => setFileSuggestions([]));
    }, 120);
    return () => clearTimeout(tid);
  }, [state, fileCwd]);

  const items = state?.kind === "file" ? fileSuggestions : slashItems;

  useEffect(() => {
    if (active >= items.length) setActive(Math.max(0, items.length - 1));
  }, [items.length, active]);

  const insertChoice = (choice: SlashCommand | string) => {
    if (!state || !taRef.current) return;
    const ta = taRef.current;
    const before = value.slice(0, state.triggerStart);
    const after = value.slice(state.cursor);
    let inserted: string;
    if (state.kind === "slash") {
      const c = choice as SlashCommand;
      inserted = `/${c.name}`;
    } else {
      inserted = `@${choice as string}`;
    }
    const next = before + inserted + (after.startsWith(" ") || after === "" ? "" : " ") + after;
    onChange(next);
    setState(null);
    setActive(0);
    // Re-position cursor after the inserted token + a trailing space
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (state && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(items.length - 1, a + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        return;
      }
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const choice = items[active];
        if (choice) insertChoice(choice);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const choice = items[active];
        if (choice) insertChoice(choice);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setState(null);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const onTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const ta = e.target;
    const next = detectAutocomplete(ta.value, ta.selectionStart || 0);
    setState(next);
    if (!next) setActive(0);
  };

  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const next = detectAutocomplete(ta.value, ta.selectionStart || 0);
    setState(next);
  };

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        autoFocus={autoFocus}
        value={value}
        onChange={onTextareaInput}
        onKeyDown={onKeyDown}
        onSelect={onSelect}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 resize-y font-sans leading-relaxed"
      />
      {state && (
        <div className="absolute z-30 left-0 right-0 bottom-full mb-1 rounded-md border border-border bg-surface-1 shadow-lg shadow-black/40 max-h-72 overflow-auto py-1">
          <div className="px-3 py-1.5 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
            {state.kind === "slash" ? (
              <>
                <SlashIcon className="w-3 h-3" />
                {t("autocomplete.slashHint")}
              </>
            ) : (
              <>
                <AtSign className="w-3 h-3" />
                {t("autocomplete.fileHint")}
              </>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-gray-500">{t("autocomplete.noMatches")}</div>
          ) : state.kind === "slash" ? (
            (items as SlashCommand[]).map((c, idx) => (
              <button
                key={`${c.source}:${c.name}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertChoice(c)}
                onMouseEnter={() => setActive(idx)}
                className={`w-full text-left px-3 py-1.5 transition-colors ${
                  idx === active ? "bg-accent/15" : "hover:bg-surface-3"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-gray-100">/{c.name}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${commandSourceTone(c.source)}`}
                  >
                    {commandSourceLabel(c.source)}
                  </span>
                </div>
                {c.description && (
                  <div className="text-[10.5px] text-gray-500 truncate mt-0.5">{c.description}</div>
                )}
              </button>
            ))
          ) : (
            (items as string[]).map((p, idx) => (
              <button
                key={p}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertChoice(p)}
                onMouseEnter={() => setActive(idx)}
                className={`w-full text-left px-3 py-1.5 transition-colors flex items-center gap-2 ${
                  idx === active ? "bg-accent/15" : "hover:bg-surface-3"
                }`}
              >
                <FileCode className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <span className="font-mono text-[11px] text-gray-200 truncate">{p}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────

function Header({
  activeRuns,
  currentHandleId,
  onAttach,
  wsConnected,
  runHistory,
  onResumeFromHistory,
  onViewFromHistory,
  onRefresh,
}: {
  activeRuns: RunListResponse | null;
  currentHandleId: string | null;
  onAttach: (id: string) => void;
  wsConnected: boolean;
  runHistory: DashboardRunHistoryItem[];
  onResumeFromHistory: (item: DashboardRunHistoryItem) => void;
  onViewFromHistory: (item: DashboardRunHistoryItem) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation("run");
  const { t: tCommon } = useTranslation("common");
  return (
    <header className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
        <Play className="w-4.5 h-4.5 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-gray-100">{t("title")}</h1>
          {wsConnected ? (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              {tCommon("live")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              {tCommon("offline")}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 max-w-3xl">{t("subtitle")}</p>
      </div>
      <ActiveRunsSwitcher
        activeRuns={activeRuns}
        currentHandleId={currentHandleId}
        onAttach={onAttach}
        runHistory={runHistory}
        onResumeFromHistory={onResumeFromHistory}
        onViewFromHistory={onViewFromHistory}
        onRefresh={onRefresh}
      />
    </header>
  );
}

type RunStatusFilter =
  | "all"
  | "running"
  | "spawning"
  | "completed"
  | "error"
  | "killed"
  | "abandoned";
type RunModeFilter = "all" | "conversation" | "headless";

interface UnifiedRunRow {
  id: string;
  sessionId: string | null;
  mode: RunMode;
  cwd: string;
  model: string | null;
  status: RunStatus;
  promptPreview: string;
  startedAt: number;
  endedAt: number | null;
  isLive: boolean;
}

function ActiveRunsSwitcher({
  activeRuns,
  currentHandleId,
  onAttach,
  runHistory,
  onResumeFromHistory,
  onViewFromHistory,
  onRefresh,
}: {
  activeRuns: RunListResponse | null;
  currentHandleId: string | null;
  onAttach: (id: string) => void;
  runHistory: DashboardRunHistoryItem[];
  onResumeFromHistory: (item: DashboardRunHistoryItem) => void;
  onViewFromHistory: (item: DashboardRunHistoryItem) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation("run");
  const [open, setOpen] = useState(false);

  // Lock body scroll while the modal is open and let Esc close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Merge live in-memory handles + persistent history into one row list.
  // Live entries dedupe past-history entries with the same id.
  const rows: UnifiedRunRow[] = useMemo(() => {
    const out: UnifiedRunRow[] = [];
    const seen = new Set<string>();
    if (activeRuns) {
      for (const r of activeRuns.items) {
        seen.add(r.id);
        out.push({
          id: r.id,
          sessionId: r.sessionId,
          mode: r.mode,
          cwd: r.cwd,
          model: r.model,
          status: r.status,
          promptPreview: r.prompt || "",
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          isLive: r.status === "running" || r.status === "spawning",
        });
      }
    }
    for (const h of runHistory) {
      if (seen.has(h.id)) continue;
      seen.add(h.id);
      const startedTs = new Date(h.started_at).getTime() || 0;
      const endedTs = h.ended_at ? new Date(h.ended_at).getTime() : null;
      out.push({
        id: h.id,
        sessionId: h.session_id,
        mode: h.mode,
        cwd: h.cwd,
        model: h.model,
        status: h.status,
        promptPreview: h.prompt_preview || "",
        startedAt: startedTs,
        endedAt: endedTs,
        isLive: h.isLive,
      });
    }
    out.sort((a, b) => b.startedAt - a.startedAt);
    return out;
  }, [activeRuns, runHistory]);

  const liveCount = activeRuns?.activeCount ?? 0;
  const totalCount = rows.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={totalCount === 0}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          liveCount > 0
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
            : "border-border bg-surface-2 text-gray-300 hover:bg-surface-3"
        }`}
      >
        <ListOrdered className="w-3.5 h-3.5" />
        {liveCount > 0 ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("runs.viewActive_other", { count: liveCount })}
          </>
        ) : (
          <>
            {t("runs.switcher")}
            {totalCount > 0 && <span className="text-gray-500 font-mono">{totalCount}</span>}
          </>
        )}
      </button>
      {open && (
        <RunsModal
          rows={rows}
          currentHandleId={currentHandleId}
          onAttach={(id) => {
            setOpen(false);
            onAttach(id);
          }}
          onResume={(item) => {
            setOpen(false);
            onResumeFromHistory(item);
          }}
          onView={(item) => {
            setOpen(false);
            onViewFromHistory(item);
          }}
          runHistory={runHistory}
          onClose={() => setOpen(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

function RunsModal({
  rows,
  currentHandleId,
  onAttach,
  onResume,
  onView,
  runHistory,
  onClose,
  onRefresh,
}: {
  rows: UnifiedRunRow[];
  currentHandleId: string | null;
  onAttach: (id: string) => void;
  onResume: (item: DashboardRunHistoryItem) => void;
  onView: (item: DashboardRunHistoryItem) => void;
  runHistory: DashboardRunHistoryItem[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation("run");
  const [statusFilter, setStatusFilter] = useState<RunStatusFilter>("all");
  const [modeFilter, setModeFilter] = useState<RunModeFilter>("all");
  const [search, setSearch] = useState("");

  // Snappy refresh while the modal is the foreground UI: pull immediately
  // on open + every 2 s after that. Combined with the page-level 5 s poll
  // and the WS run_status broadcasts, this guarantees that any state
  // change - lifecycle event, sibling tab, manual DB tweak, boot
  // reconciliation - surfaces here within a couple of seconds.
  useEffect(() => {
    onRefresh();
    const tick = setInterval(onRefresh, 2000);
    return () => clearInterval(tick);
  }, [onRefresh]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { all: rows.length };
    const byMode: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byMode[r.mode] = (byMode[r.mode] || 0) + 1;
    }
    return { byStatus, byMode };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (modeFilter !== "all" && r.mode !== modeFilter) return false;
      if (!q) return true;
      const hay =
        r.promptPreview + "\n" + r.cwd + "\n" + (r.sessionId || "") + "\n" + (r.model || "");
      return hay.toLowerCase().includes(q);
    });
  }, [rows, statusFilter, modeFilter, search]);

  const historyById = useMemo(() => {
    const m = new Map<string, DashboardRunHistoryItem>();
    for (const h of runHistory) m.set(h.id, h);
    return m;
  }, [runHistory]);

  const STATUSES: RunStatusFilter[] = [
    "all",
    "running",
    "completed",
    "error",
    "killed",
    "abandoned",
  ];
  const MODES: RunModeFilter[] = ["all", "conversation", "headless"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 py-10 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl rounded-xl border border-border bg-surface-1 shadow-2xl shadow-black/60 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-accent/15 inline-flex items-center justify-center">
            <ListOrdered className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-100">
              {t("runs.modalTitle", "Dashboard runs")}
            </h2>
            <p className="text-[11px] text-gray-500">
              {t(
                "runs.modalSubtitle",
                "Every run started from this dashboard, regardless of status"
              )}
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="w-7 h-7 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 inline-flex items-center justify-center"
            aria-label={t("runs.refresh", "Refresh")}
            title={t("runs.refresh", "Refresh")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link
            to="/sessions"
            onClick={onClose}
            className="text-[11px] text-accent hover:text-accent/80 inline-flex items-center gap-1 mr-1"
          >
            {t("runs.allSessionsLink")}
          </Link>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md text-gray-500 hover:text-gray-200 hover:bg-surface-3 inline-flex items-center justify-center"
            aria-label={t("limitations.dismiss")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 border-b border-border flex flex-col gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-md px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("runs.searchPlaceholder", "Search prompt, cwd, model, or session id…")}
              className="flex-1 bg-transparent text-[12px] text-gray-100 placeholder:text-gray-600 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-500 hover:text-gray-200 text-[10px]"
                aria-label="Clear"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <FilterChipGroup
              label={t("runs.filterStatus", "Status")}
              value={statusFilter}
              options={STATUSES.map((s) => ({
                value: s,
                label: s === "all" ? t("runs.allLabel", "All") : t(`status.${s}`),
                count: counts.byStatus[s] || 0,
              }))}
              onChange={(v) => setStatusFilter(v as RunStatusFilter)}
            />
            <FilterChipGroup
              label={t("runs.filterMode", "Mode")}
              value={modeFilter}
              options={MODES.map((m) => ({
                value: m,
                label: m === "all" ? t("runs.allLabel", "All") : t(`mode.${m}`),
                count: counts.byMode[m] || 0,
              }))}
              onChange={(v) => setModeFilter(v as RunModeFilter)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-[12px] text-gray-500">
              {rows.length === 0
                ? t(
                    "runs.modalEmpty",
                    "No dashboard runs yet. Start one below to populate this list."
                  )
                : t("runs.modalEmptyFiltered", "No runs match these filters.")}
            </div>
          ) : (
            filtered.map((r) => {
              const isCurrent = r.id === currentHandleId;
              return (
                <UnifiedRunRowView
                  key={r.id}
                  row={r}
                  isCurrent={isCurrent}
                  onAttach={() => onAttach(r.id)}
                  onResume={() => {
                    const h = historyById.get(r.id);
                    if (h) onResume(h);
                  }}
                  onView={() => {
                    const h = historyById.get(r.id);
                    if (h) onView(h);
                  }}
                />
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-border bg-surface-2/40 flex items-center gap-2 flex-shrink-0">
          <Info className="w-3 h-3 text-gray-500 flex-shrink-0" />
          <span className="text-[10.5px] text-gray-500 leading-relaxed flex-1">
            {t("runs.scopeNote")}
          </span>
          <span className="text-[10.5px] text-gray-500 font-mono">
            {filtered.length} / {rows.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count: number }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mr-1">
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt.value;
        const dim = opt.count === 0 && opt.value !== "all";
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            disabled={dim}
            className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full border transition-colors disabled:opacity-40 ${
              active
                ? "bg-accent/15 border-accent/50 text-accent"
                : "bg-surface-2 border-border text-gray-300 hover:bg-surface-3 hover:border-border-strong"
            }`}
          >
            {opt.label}
            <span className="ml-1 text-gray-500 font-mono">{opt.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function UnifiedRunRowView({
  row,
  isCurrent,
  onAttach,
  onResume,
  onView,
}: {
  row: UnifiedRunRow;
  isCurrent: boolean;
  onAttach: () => void;
  onResume: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation("run");
  const startedDate = new Date(row.startedAt);
  const startedLabel = isNaN(startedDate.getTime())
    ? "-"
    : startedDate.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  const canResume = row.mode === "conversation" && !!row.sessionId && !row.isLive;
  // Headless runs are single-shot, so resume doesn't apply - but the captured
  // transcript is still worth viewing. Link to the Session detail page.
  const canView = row.mode === "headless" && !!row.sessionId && !row.isLive;
  return (
    <div
      className={`px-5 py-3 transition-colors ${
        isCurrent ? "bg-accent/[0.06]" : "hover:bg-surface-2/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <StatusPill status={row.status} />
        <ModeBadge mode={row.mode} />
        {row.isLive && (
          <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t("runs.liveBadge", "live")}
          </span>
        )}
        {isCurrent && (
          <span className="text-[10px] font-semibold text-accent bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded-full">
            {t("runs.currentBadge", "current")}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {row.isLive && !isCurrent && (
            <button
              onClick={onAttach}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 px-2 py-0.5 text-[10.5px] font-medium transition-colors"
            >
              <Play className="w-3 h-3" />
              {t("runs.attachLabel", "Attach")}
            </button>
          )}
          {canResume && (
            <button
              onClick={onResume}
              className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent px-2 py-0.5 text-[10.5px] font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t("resume.resumeOption", "Resume")}
            </button>
          )}
          {canView && (
            <button
              onClick={onView}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 hover:bg-surface-3 text-gray-300 hover:text-gray-100 px-2 py-0.5 text-[10.5px] font-medium transition-colors"
            >
              <Eye className="w-3 h-3" />
              {t("runs.viewLabel", "View")}
            </button>
          )}
        </span>
      </div>
      {row.promptPreview && (
        <div className="text-[12px] text-gray-300 line-clamp-2 leading-snug">
          {row.promptPreview}
        </div>
      )}
      <div className="font-mono text-[10px] text-gray-500 truncate mt-1">{row.cwd}</div>
      <div className="text-[10px] text-gray-600 mt-0.5 flex items-center gap-2 flex-wrap">
        <span>{startedLabel}</span>
        {row.model && <span className="font-mono text-gray-500">· {row.model}</span>}
        {row.sessionId && (
          <Link
            to={`/sessions/${encodeURIComponent(row.sessionId)}`}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
            title={t("actions.viewSession")}
          >
            <ExternalLink className="w-2.5 h-2.5" />
            <span className="font-mono">{row.sessionId.slice(0, 8)}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Config card (pre-run) ────────────────────────────────────────────

interface ConfigCardProps {
  mode: RunMode;
  onModeChange: (m: RunMode) => void;
  prompt: string;
  onPromptChange: (s: string) => void;
  cwd: string;
  onCwdChange: (s: string) => void;
  cwdSuggestions: CwdSuggestion[];
  model: string;
  onModelChange: (s: string) => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (m: PermissionMode) => void;
  effort: EffortLevel;
  onEffortChange: (e: EffortLevel) => void;
  binaryFound: boolean;
  busy: boolean;
  onStart: () => void;
  activeRuns: RunListResponse | null;
  resumeSession: Session | null;
  onResumeSessionChange: (s: Session | null) => void;
  slashCommands: SlashCommand[];
  runHistory: DashboardRunHistoryItem[];
  onResumeFromHistory: (item: DashboardRunHistoryItem) => void;
}

function ConfigCard(props: ConfigCardProps) {
  const { t } = useTranslation("run");
  const atCap =
    props.activeRuns != null && props.activeRuns.activeCount >= props.activeRuns.maxConcurrent;
  const isResume = !!props.resumeSession;
  const [resumePicked, setResumePicked] = useState(isResume);
  // Keep "resume picked" in sync with the parent. Two cases:
  //  1. Parent set a resume session (e.g. user clicked Resume in the runs
  //     modal) - flip the radio so the picker is shown and the selection
  //     is visible.
  //  2. Parent cleared the session and mode flipped to headless - clear
  //     the radio so the form is honest.
  useEffect(() => {
    if (isResume && !resumePicked) setResumePicked(true);
    else if (!isResume && resumePicked && props.mode === "headless") setResumePicked(false);
  }, [isResume, resumePicked, props.mode]);

  return (
    <div className="rounded-xl border border-border bg-surface-1">
      {/* Step 1: Mode (always visible - the primary decision) */}
      <div className="border-b border-border px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          {t("mode.label")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ModeOption
            active={props.mode === "conversation"}
            label={t("mode.conversation")}
            hint={t("mode.conversationHint")}
            onClick={() => props.onModeChange("conversation")}
          />
          <ModeOption
            active={props.mode === "headless"}
            label={t("mode.headless")}
            hint={t("mode.headlessHint")}
            onClick={() => {
              props.onModeChange("headless");
              setResumePicked(false);
            }}
          />
        </div>
        {props.mode === "headless" && (
          <p className="mt-2 text-[11px] text-gray-500 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
            {t("hint.headlessExplain")}
          </p>
        )}
      </div>

      {/* Step 2 (only for multi-turn): Source - new vs resume */}
      {props.mode === "conversation" && (
        <div className="border-b border-border px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {t("resume.label")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ModeOption
              active={!resumePicked}
              label={t("resume.freshOption")}
              hint={t("resume.freshHint")}
              onClick={() => {
                setResumePicked(false);
                props.onResumeSessionChange(null);
              }}
            />
            <ModeOption
              active={resumePicked}
              label={t("resume.resumeOption")}
              hint={t("resume.resumeHint")}
              onClick={() => setResumePicked(true)}
            />
          </div>
          {resumePicked && (
            <SessionPicker
              selected={props.resumeSession}
              onSelect={(s) => {
                props.onResumeSessionChange(s);
                if (!s) {
                  // Clearing the picker leaves "Resume" selected so the
                  // user can pick a different one without re-toggling.
                }
              }}
            />
          )}
        </div>
      )}

      {/* Prompt */}
      <div className="px-4 py-3 border-b border-border">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
          {t("fields.prompt")}
        </label>
        <PromptEditor
          value={props.prompt}
          onChange={props.onPromptChange}
          onSubmit={props.onStart}
          placeholder={t("fields.promptPlaceholder")}
          rows={5}
          slashCommands={props.slashCommands}
          fileCwd={props.resumeSession?.cwd || props.cwd}
        />
        <div className="mt-1 text-[10px] text-gray-600">
          {t("hint.shortcut")} · / for slash commands · @ for file references
        </div>
      </div>

      {/* Advanced fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 py-3">
        <Field label={t("fields.cwd")}>
          {isResume && props.resumeSession ? (
            <div className="bg-surface-2 border border-border rounded-md px-3 py-1.5 text-[11px] font-mono text-gray-300 flex items-center gap-2">
              <Lock className="w-3 h-3 text-gray-500 flex-shrink-0" />
              <span className="truncate">{props.resumeSession.cwd}</span>
            </div>
          ) : (
            <CwdAutocomplete
              value={props.cwd}
              onChange={props.onCwdChange}
              suggestions={props.cwdSuggestions}
            />
          )}
          <p className="mt-1 text-[10px] text-gray-500">
            {isResume ? t("resume.originalCwd") : t("fields.cwdHint")}
          </p>
        </Field>
        <Field label={t("fields.model")}>
          <ModelPicker value={props.model} onChange={props.onModelChange} />
        </Field>
        <Field label={t("fields.permissionMode")}>
          <Select<PermissionMode>
            value={props.permissionMode}
            onChange={props.onPermissionModeChange}
            options={[
              { value: "acceptEdits", label: t("fields.permissionAcceptEdits") },
              { value: "default", label: t("fields.permissionDefault") },
              { value: "plan", label: t("fields.permissionPlan") },
              { value: "bypassPermissions", label: t("fields.permissionBypass") },
            ]}
          />
        </Field>
        <Field label={t("fields.effort")}>
          <Select<EffortLevel>
            value={props.effort}
            onChange={props.onEffortChange}
            options={RUN_EFFORT_CHOICES.map((c) => ({
              value: c.id,
              label: c.label,
              hint: c.hint,
            }))}
          />
          <p className="mt-1 text-[10px] text-gray-500">{t("fields.effortHint")}</p>
        </Field>
      </div>

      {props.permissionMode === "bypassPermissions" && (
        <div className="mx-4 mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200 flex items-start gap-2">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{t("hint.permissionWarning")}</span>
        </div>
      )}

      {/* Footer: contextual run-state hint + run button */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-[11px] min-w-0">
          {atCap ? (
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              {t("concurrency.atCap", { max: props.activeRuns?.maxConcurrent ?? 0 })}
            </span>
          ) : props.activeRuns && props.activeRuns.activeCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t("concurrency.active", { count: props.activeRuns.activeCount })}
            </span>
          ) : null}
        </div>
        <button
          onClick={props.onStart}
          disabled={
            !props.binaryFound ||
            !props.prompt.trim() ||
            props.busy ||
            atCap ||
            (resumePicked && !props.resumeSession) ||
            // Resume locks cwd to the original session, so allow it then;
            // otherwise require a non-empty cwd so we never spawn at an
            // invisible default.
            (!props.resumeSession && !props.cwd.trim())
          }
          className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {props.busy ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {props.busy ? t("actions.starting") : t("actions.start")}
        </button>
      </div>
    </div>
  );
}

function ModeOption({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
        active ? "border-accent/40 bg-accent/10" : "border-border bg-surface-2 hover:bg-surface-3"
      }`}
    >
      <div className={`text-sm font-medium ${active ? "text-accent" : "text-gray-200"}`}>
        {label}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

// ── CWD autocomplete ──────────────────────────────────────────────────

function CwdAutocomplete({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (s: string) => void;
  suggestions: CwdSuggestion[];
}) {
  const { t } = useTranslation("run");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim();
    const out = suggestions.filter(
      (s) => !q || s.path.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)
    );
    return out;
  }, [value, suggestions]);

  // Group suggestions by kind preserving fixed order — home first, matching
  // the neutral default the page pre-fills (issue #202).
  const groups = useMemo(() => {
    const order: CwdSuggestion["kind"][] = ["home", "dashboard", "recent"];
    return order
      .map((kind) => ({ kind, items: filtered.filter((s) => s.kind === kind) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  // Flat index for keyboard navigation
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Keep `active` clamped within bounds
  useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);

  const choose = (s: CwdSuggestion) => {
    onChange(s.path);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      if (open && flat[active]) {
        e.preventDefault();
        choose(flat[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <FolderOpen className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("fields.cwdPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-surface-2 border border-border rounded-md pl-7 pr-3 py-1.5 text-[11px] font-mono text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
        />
      </div>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-md border border-border bg-surface-1 shadow-lg shadow-black/40 max-h-72 overflow-auto py-1">
          {groups.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-gray-500">{t("fields.cwdNoMatches")}</div>
          ) : (
            groups.map((g) => (
              <div key={g.kind}>
                <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  {g.kind === "dashboard" ? (
                    <FolderOpen className="w-3 h-3" />
                  ) : g.kind === "home" ? (
                    <Home className="w-3 h-3" />
                  ) : (
                    <HistoryIcon className="w-3 h-3" />
                  )}
                  {t(`fields.cwdGroups.${g.kind}`)}
                </div>
                {g.items.map((s) => {
                  const idx = flat.indexOf(s);
                  const isActive = idx === active;
                  return (
                    <button
                      key={s.path}
                      type="button"
                      onMouseDown={(e) => e.preventDefault() /* keep input focused */}
                      onClick={() => choose(s)}
                      onMouseEnter={() => setActive(idx)}
                      className={`w-full text-left px-3 py-1.5 transition-colors ${
                        isActive ? "bg-accent/15" : "hover:bg-surface-3"
                      }`}
                    >
                      <div className="text-[11px] text-gray-200 truncate">{s.label}</div>
                      <div className="font-mono text-[10px] text-gray-500 truncate">{s.path}</div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Model picker ──────────────────────────────────────────────────────

// ── Session picker (for resume) ───────────────────────────────────────

function SessionPicker({
  selected,
  onSelect,
}: {
  selected: Session | null;
  onSelect: (s: Session | null) => void;
}) {
  const { t } = useTranslation("run");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Lazily load sessions when the picker is opened.
  useEffect(() => {
    if (!open || sessions !== null) return;
    api.sessions
      .list({ sort_by: "started_at", sort_desc: true, limit: 100 })
      .then((r) => setSessions(r.sessions))
      .catch(() => setSessions([]));
  }, [open, sessions]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const q = query.toLowerCase().trim();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.cwd || "").toLowerCase().includes(q) ||
        (s.status || "").toLowerCase().includes(q)
    );
  }, [sessions, query]);

  if (selected) {
    return (
      <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 flex items-start gap-2">
        <RotateCcw className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/30">
              {t("resume.selectedBadge")}
            </span>
            <span className="font-mono text-[11px] text-gray-200 truncate">{selected.id}</span>
          </div>
          <div className="font-mono text-[10px] text-gray-500 truncate mt-0.5">{selected.cwd}</div>
        </div>
        <button
          onClick={() => onSelect(null)}
          className="text-[10px] font-medium px-2 py-0.5 rounded border border-border bg-surface-2 hover:bg-surface-3 text-gray-300 inline-flex items-center gap-1 flex-shrink-0"
        >
          <X className="w-3 h-3" />
          {t("resume.clear")}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-md border border-dashed border-border bg-surface-2 hover:bg-surface-3 px-3 py-2 text-[11px] text-gray-400 inline-flex items-center gap-2"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {t("resume.pickSession")}
        <ChevronDown className="w-3 h-3 opacity-70 ml-auto" />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-md border border-border bg-surface-1 shadow-lg shadow-black/40 overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("resume.search")}
              className="bg-transparent text-[11px] text-gray-100 placeholder:text-gray-500 focus:outline-none w-full"
            />
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {sessions === null ? (
              <div className="px-3 py-2 text-[11px] text-gray-500">…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-500">{t("resume.noSessions")}</div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelect(s);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-surface-3 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        s.status === "active"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : s.status === "completed"
                            ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
                            : s.status === "error"
                              ? "bg-red-500/10 text-red-300 border-red-500/30"
                              : "bg-surface-3 text-gray-400 border-border"
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.name?.trim() && (
                      <span className="text-[11px] text-gray-200 truncate">{s.name.trim()}</span>
                    )}
                    <span className="font-mono text-[11px] text-gray-400 truncate flex-shrink-0">
                      {s.id.slice(0, 12)}…
                    </span>
                    <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">
                      {new Date(s.started_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-gray-500 truncate">{s.cwd}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// The custom Select dropdown now lives in ../components/Select (shared with the
// webhook settings form). Imported at the top of this file.

// Sentinel option value for "Custom model…". Empty string is already taken by
// the "inherit from settings" choice, so use a non-empty marker.
const MODEL_CUSTOM = "__custom__";

function ModelPicker({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const { t } = useTranslation("run");
  // "Custom" is selected when the value isn't one of our curated IDs.
  const knownIds = useMemo(() => RUN_MODEL_CHOICES.map((c) => c.id), []);
  const isCustom = value !== "" && !knownIds.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  // Reuse the shared Select so the Model dropdown renders identically to the
  // Permission Mode and Effort dropdowns (Tailwind + lucide popover) instead of
  // a browser-native <select>.
  const options = useMemo(
    () => [
      ...RUN_MODEL_CHOICES.map((c) => ({
        value: c.id === "" ? "" : c.id,
        label: c.id === "" ? t("fields.modelInheritLabel") : c.label,
        hint: c.hint,
      })),
      { value: MODEL_CUSTOM, label: t("fields.modelCustom") },
    ],
    [t]
  );

  const onSelect = (v: string) => {
    if (v === MODEL_CUSTOM) {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    onChange(v);
  };

  const selectValue = showCustom || isCustom ? MODEL_CUSTOM : value;

  return (
    <div className="space-y-1.5">
      <Select<string> value={selectValue} onChange={onSelect} options={options} />
      {(showCustom || isCustom) && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("fields.modelCustomPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-surface-2 border border-border rounded-md px-3 py-1.5 text-[11px] font-mono text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
        />
      )}
    </div>
  );
}

// ── Live run session ─────────────────────────────────────────────────

interface RunSessionProps {
  handle: RunHandle;
  envelopes: Envelope[];
  mode: RunMode;
  isLive: boolean;
  hasFinished: boolean;
  followUp: string;
  onFollowUpChange: (s: string) => void;
  busy: "start" | "send" | "stop" | "attach" | null;
  onSend: () => void;
  onStop: () => void;
  onNewRun: () => void;
  slashCommands: SlashCommand[];
}

function RunSession(props: RunSessionProps) {
  const { t } = useTranslation("run");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinnedToBottom, setPinnedToBottom] = useState(true);

  // Track whether the user has scrolled away - if so, don't yank them back.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
      setPinnedToBottom(distance < 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll on new envelopes if the user is pinned to bottom.
  useEffect(() => {
    if (!pinnedToBottom) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.envelopes.length, pinnedToBottom]);

  const result = useMemo(
    () => props.envelopes.find((e) => e.type === "result") as ResultEnvelope | undefined,
    [props.envelopes]
  );
  const init = useMemo(
    () => props.envelopes.find((e) => e.type === "system") as SystemInit | undefined,
    [props.envelopes]
  );
  const tokenStats = useMemo(() => computeTokens(props.envelopes), [props.envelopes]);

  return (
    // flex-1 + min-h-0 lets us fill the viewport-locked parent, while the
    // inner stream area's overflow-auto keeps long chats scrollable inside
    // the panel - never the page.
    <div className="rounded-xl border border-border bg-surface-1 flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <StatusPill status={props.handle.status} />
        <ModeBadge mode={props.mode} />
        {init?.model && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border">
            {init.model}
          </span>
        )}
        {props.handle.sessionId && (
          <span className="text-[10px] font-mono text-gray-500 truncate max-w-xs">
            {props.handle.sessionId.slice(0, 8)}…
          </span>
        )}
        <div className="flex-1" />
        {props.isLive && (
          <button
            onClick={props.onStop}
            disabled={props.busy === "stop"}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-200 px-2.5 py-1 text-[11px] font-medium disabled:opacity-60 transition-colors"
          >
            <Square className="w-3 h-3" />
            {props.busy === "stop" ? t("actions.stopping") : t("actions.stop")}
          </button>
        )}
        {props.handle.sessionId && (
          <Link
            to={`/sessions/${encodeURIComponent(props.handle.sessionId)}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 hover:bg-surface-3 text-gray-300 hover:text-gray-100 px-2.5 py-1 text-[11px] font-medium transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            {t("actions.viewSession")}
          </Link>
        )}
        {/* Always available - lets the user leave a running run in the
            background and start another one. The original is still in the
            Active Runs dropdown for re-attach. */}
        <button
          onClick={props.onNewRun}
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent px-2.5 py-1 text-[11px] font-medium transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t("actions.newRun")}
        </button>
      </div>

      {/* Stream area */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 min-h-0">
        {props.envelopes.length === 0 && <EmptyStream isLive={props.isLive} />}
        {props.envelopes.map((env, i) => (
          <EnvelopeRow key={i} envelope={env} />
        ))}
      </div>

      {/* Live token / context-window meter */}
      <TokenMeter stats={tokenStats} />

      {/* Footer banner once finished */}
      {props.hasFinished && result && <ResultFooter result={result} />}

      {/* Follow-up input - only for conversation mode while live */}
      {props.mode === "conversation" && props.isLive && (
        <div className="border-t border-border px-4 py-3">
          <PromptEditor
            value={props.followUp}
            onChange={props.onFollowUpChange}
            onSubmit={props.onSend}
            placeholder={t("fields.promptPlaceholder")}
            rows={2}
            slashCommands={props.slashCommands}
            fileCwd={props.handle.cwd}
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="text-[10px] text-gray-600">{t("hint.shortcut")} · / · @</div>
            <button
              onClick={props.onSend}
              disabled={!props.followUp.trim() || props.busy === "send"}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/15 hover:bg-accent/25 text-accent px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-3 h-3" />
              {props.busy === "send" ? t("actions.sending") : t("actions.send")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyStream({ isLive }: { isLive: boolean }) {
  const { t } = useTranslation("run");
  if (isLive) {
    return (
      <div className="text-center py-12 text-gray-500 flex flex-col items-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-xs">{t("status.spawning")}</span>
      </div>
    );
  }
  return (
    <div className="text-center py-12 flex flex-col items-center gap-2">
      <Sparkles className="w-6 h-6 text-gray-600" />
      <div className="text-sm font-medium text-gray-400">{t("empty.title")}</div>
      <div className="text-xs text-gray-500 max-w-md">{t("empty.body")}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation("run");
  const idle = { color: "bg-surface-3 text-gray-400 border-border", icon: Clock as typeof Play };
  const config: Record<string, { color: string; icon: typeof Play }> = {
    spawning: { color: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: RefreshCw },
    running: { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: Sparkles },
    completed: {
      color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    },
    error: { color: "bg-red-500/15 text-red-300 border-red-500/30", icon: XCircle },
    killed: { color: "bg-gray-500/15 text-gray-400 border-gray-500/30", icon: Square },
    abandoned: {
      color: "bg-orange-500/10 text-orange-300 border-orange-500/30",
      icon: Square,
    },
    idle,
  };
  const c = config[status] ?? idle;
  const Icon = c.icon;
  const animate = status === "spawning" || status === "running";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border ${c.color}`}
    >
      <Icon
        className={`w-3 h-3 ${animate ? (status === "spawning" ? "animate-spin" : "animate-pulse") : ""}`}
      />
      {t(`status.${status}`)}
    </span>
  );
}

function ModeBadge({ mode }: { mode: RunMode }) {
  const { t } = useTranslation("run");
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border inline-flex items-center gap-1">
      {mode === "conversation" ? (
        <Terminal className="w-3 h-3" />
      ) : (
        <Sparkles className="w-3 h-3" />
      )}
      {t(`mode.${mode}`)}
    </span>
  );
}

// ── Envelope rendering ───────────────────────────────────────────────

function EnvelopeRow({ envelope }: { envelope: Envelope }) {
  if (!envelope || typeof envelope !== "object") return null;
  switch (envelope.type) {
    case "user":
      return <UserTurn env={envelope as UserMessage} />;
    case "assistant":
      return <AssistantTurn env={envelope as AssistantMessage} />;
    case "system":
      return null; // init metadata is shown in the toolbar
    case "result":
      return null; // shown in the footer
    case "stream_event":
      return null; // kept in state for token accounting only - never rendered
    default:
      // Unknown envelope: render compact JSON for transparency
      return <UnknownTurn env={envelope} />;
  }
}

function extractText(content: ContentBlock[] | string | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .filter((b): b is ContentBlock & { type: "text" } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function UserTurn({ env }: { env: UserMessage }) {
  const { t } = useTranslation("run");
  const content = env.message?.content;

  // Tool results live inside user.message.content as { type: "tool_result", ... }.
  const toolResults = Array.isArray(content)
    ? (content.filter((b) => b.type === "tool_result") as Extract<
        ContentBlock,
        { type: "tool_result" }
      >[])
    : [];
  const text = extractText(content);

  if (toolResults.length > 0 && !text) {
    return (
      <div className="space-y-2">
        {toolResults.map((tr, i) => (
          <ToolResultBlock key={i} result={tr} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar tone="indigo" letter={t("events.you").charAt(0)} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-indigo-300 mb-1">{t("events.you")}</div>
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2 text-sm text-gray-200 whitespace-pre-wrap break-words">
          {text || "-"}
        </div>
      </div>
    </div>
  );
}

function AssistantTurn({ env }: { env: AssistantMessage }) {
  const { t } = useTranslation("run");
  const content = env.message?.content;
  const blocks = Array.isArray(content)
    ? content
    : content
      ? [{ type: "text", text: content } as ContentBlock]
      : [];
  const text = blocks
    .filter((b): b is ContentBlock & { type: "text" } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const toolUses = blocks.filter(
    (b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use"
  );
  const thinking = blocks.filter(
    (b): b is ContentBlock & { type: "thinking" } => b.type === "thinking"
  );

  return (
    <div className="flex gap-3">
      <Avatar tone="accent" letter="C" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-[11px] font-semibold text-accent mb-1">{t("events.claude")}</div>
        {thinking.map((th, i) => (
          <ThinkingBlock key={`th-${i}`} text={th.thinking || ""} />
        ))}
        {text && (
          <div className="text-sm text-gray-200 leading-relaxed prose-claude">
            <MarkdownContent text={text} />
          </div>
        )}
        {toolUses.map((tu) => (
          <ToolUseBlock key={tu.id} toolUse={tu} />
        ))}
      </div>
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const { t } = useTranslation("run");
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="rounded-md border border-violet-500/20 bg-violet-500/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-500/10 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Sparkles className="w-3 h-3" />
        {t("events.thinking")}
      </button>
      {open && (
        <pre className="px-3 py-2 text-[11px] font-mono text-violet-200/80 whitespace-pre-wrap break-words border-t border-violet-500/20">
          {text}
        </pre>
      )}
    </div>
  );
}

function ToolUseBlock({ toolUse }: { toolUse: Extract<ContentBlock, { type: "tool_use" }> }) {
  const { t } = useTranslation("run");
  const [open, setOpen] = useState(false);
  const summary = describeToolInput(toolUse.input);
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium hover:bg-amber-500/10 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-amber-300 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-amber-300 flex-shrink-0" />
        )}
        <Wrench className="w-3 h-3 text-amber-300 flex-shrink-0" />
        <span className="font-mono text-amber-200">{toolUse.name}</span>
        {summary && <span className="text-gray-500 truncate">· {summary}</span>}
        <span className="text-[10px] text-gray-600 ml-auto">{t("events.tool")}</span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[11px] font-mono text-gray-300 whitespace-pre-wrap break-words border-t border-amber-500/30 max-h-72 overflow-auto">
          {JSON.stringify(toolUse.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultBlock({ result }: { result: Extract<ContentBlock, { type: "tool_result" }> }) {
  const { t } = useTranslation("run");
  const [open, setOpen] = useState(false);
  const text =
    typeof result.content === "string"
      ? result.content
      : Array.isArray(result.content)
        ? result.content
            .map((c) => {
              if (c == null) return "";
              if (typeof c === "string") return c;
              const obj = c as { text?: string };
              return obj.text || JSON.stringify(c);
            })
            .join("\n")
        : JSON.stringify(result.content);
  const lines = text.split("\n").length;
  const tone = result.is_error
    ? "border-red-500/30 bg-red-500/5 text-red-200"
    : "border-emerald-500/20 bg-emerald-500/5 text-emerald-200";
  return (
    <div className={`rounded-md border ${tone}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium hover:bg-white/5 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
        {result.is_error ? (
          <XCircle className="w-3 h-3 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
        )}
        <span>{t("events.toolResult")}</span>
        <span className="text-[10px] opacity-70">
          ({lines} {lines === 1 ? "line" : "lines"})
        </span>
      </button>
      {open && (
        <pre className="px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words border-t border-current/20 max-h-72 overflow-auto opacity-90">
          {text}
        </pre>
      )}
    </div>
  );
}

function UnknownTurn({ env }: { env: Envelope }) {
  return (
    <details className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
      <summary className="text-[10px] font-mono text-gray-500 cursor-pointer">
        {(env.type as string) || "?"}
      </summary>
      <pre className="mt-2 text-[10px] font-mono text-gray-400 whitespace-pre-wrap break-words max-h-48 overflow-auto">
        {JSON.stringify(env, null, 2)}
      </pre>
    </details>
  );
}

function Avatar({ tone, letter }: { tone: "accent" | "indigo"; letter: string }) {
  const cls =
    tone === "accent"
      ? "bg-accent/15 text-accent border-accent/30"
      : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
  return (
    <div
      className={`w-7 h-7 rounded-md border flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${cls}`}
    >
      {letter}
    </div>
  );
}

function describeToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  // Common Claude Code tool inputs: file_path, path, command, pattern…
  for (const k of ["file_path", "path", "command", "pattern", "url", "name"]) {
    const v = obj[k];
    if (typeof v === "string" && v) return v.length > 80 ? v.slice(0, 80) + "…" : v;
  }
  return "";
}

function ResultFooter({ result }: { result: ResultEnvelope }) {
  const { t } = useTranslation("run");
  const isError = result.is_error;
  return (
    <div
      className={`border-t px-4 py-2.5 flex items-center gap-4 flex-wrap text-[11px] ${
        isError
          ? "border-red-500/30 bg-red-500/5 text-red-200"
          : "border-emerald-500/20 bg-emerald-500/5 text-emerald-200"
      }`}
    >
      {isError ? (
        <span className="font-medium inline-flex items-center gap-1.5">
          <XCircle className="w-3.5 h-3.5" />
          {t("status.error")}
        </span>
      ) : (
        <span className="font-medium inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t("status.completed")}
        </span>
      )}
      {typeof result.duration_ms === "number" && (
        <Stat
          icon={Clock}
          label={t("footer.duration")}
          value={`${(result.duration_ms / 1000).toFixed(1)}s`}
        />
      )}
      {typeof result.total_cost_usd === "number" && (
        <Stat
          icon={CircleDollarSign}
          label={t("footer.cost")}
          value={`$${result.total_cost_usd.toFixed(4)}`}
        />
      )}
      {typeof result.num_turns === "number" && (
        <Stat icon={Hash} label={t("footer.turns")} value={String(result.num_turns)} />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="w-3 h-3 opacity-70" />
      <span className="opacity-80">{label}:</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}
