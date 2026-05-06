/**
 * @file MobileChat.tsx
 * @description Mobile-first chat page that drives the local orchestrator.
 * The user composes a prompt at the bottom; submission spawns a Claude Code
 * subprocess via POST /api/orchestrator/spawn and the page subscribes to the
 * shared WebSocket eventBus to render `agent_stream` and `agent_status`
 * events scoped to the current sessionId.
 */

import { useState, useEffect, useRef } from "react";
import { useOrchestrator } from "../hooks/useOrchestrator";
import { eventBus } from "../lib/eventBus";
import type { WSMessage } from "../lib/types";

interface ChatTurn {
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
}

export function MobileChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const { spawn, busy, error } = useOrchestrator();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to WS messages for this session
  useEffect(() => {
    if (!sessionId) return;
    const unsub = eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "agent_stream" && msg.sessionId === sessionId) {
        const chunk = msg.chunk;
        if (chunk.type === "assistant" && chunk.text) {
          setTurns((t) => [...t, { role: "assistant", text: chunk.text!, ts: Date.now() }]);
        }
      } else if (msg.type === "agent_status" && msg.sessionId === sessionId) {
        setStatus(msg.status);
      }
    });
    return unsub;
  }, [sessionId]);

  // Auto-scroll to newest turn
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const handleSubmit = async () => {
    if (!input.trim() || busy) return;
    const userText = input.trim();
    setTurns((t) => [...t, { role: "user", text: userText, ts: Date.now() }]);
    setInput("");
    const result = await spawn({ prompt: userText, cwd: "" });
    if (result) {
      setSessionId(result.id);
      setStatus(result.status);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100vh",
      }}
    >
      <header style={{ padding: "12px 16px", borderBottom: "1px solid #2a2a2a" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Chat</h2>
        <div style={{ fontSize: 12, color: "#888" }}>
          {status === "idle" ? "Ready" : `Session: ${sessionId?.slice(0, 8)} · ${status}`}
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {turns.length === 0 && (
          <p style={{ color: "#666", textAlign: "center", marginTop: 60 }}>
            Send a message to start.
          </p>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              margin: "8px 0",
              padding: "10px 14px",
              background: t.role === "user" ? "#1a3a52" : "#222",
              borderRadius: 12,
              maxWidth: "85%",
              alignSelf: t.role === "user" ? "flex-end" : "flex-start",
              marginLeft: t.role === "user" ? "auto" : 0,
            }}
          >
            {t.text}
          </div>
        ))}
        {error && <div style={{ color: "#ff6b6b", padding: 12 }}>Error: {error}</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        style={{
          display: "flex",
          gap: 8,
          padding: 12,
          borderTop: "1px solid #2a2a2a",
          background: "#0f0f0f",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Claude..."
          disabled={busy}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #333",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: busy ? "#444" : "#3b82f6",
            color: "#fff",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

export default MobileChat;
