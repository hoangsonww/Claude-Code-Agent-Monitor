// client/src/pages/MobileChat.tsx
import { useEffect, useState } from "react";
import { useCwds } from "../hooks/useCwds";
import { SendComposer } from "../features/launcher/SendComposer";
import { eventBus } from "../lib/eventBus";
import type { WSMessage } from "../lib/types";

interface Turn {
  role: "user" | "assistant";
  text: string;
  ts: number;
}

export function MobileChat() {
  const { cwds } = useCwds();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const cwd = cwds[0]?.path;

  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      if (msg.type === "agent_stream" && msg.sessionId === sessionId) {
        const c = msg.chunk as { type?: string; text?: string };
        if (c?.type === "assistant" && c.text) {
          setTurns((t) => [...t, { role: "assistant", text: c.text!, ts: Date.now() }]);
        }
      }
    });
  }, [sessionId]);

  if (!cwd) {
    return (
      <div style={{ padding: 16, color: "#888" }}>
        Add a working directory in Settings → Agent Profiles → Cwd allowlist before chatting.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {turns.map((t, i) => (
          <div
            key={i}
            style={{
              margin: "6px 0",
              padding: "8px 12px",
              background: t.role === "user" ? "#1a3a52" : "#222",
              borderRadius: 12,
              maxWidth: "85%",
              marginLeft: t.role === "user" ? "auto" : 0,
            }}
          >
            {t.text}
          </div>
        ))}
      </div>
      <SendComposer sessionId={sessionId} sessionCwd={cwd} sessionLiveHandleId={null} />
    </div>
  );
}

export default MobileChat;
