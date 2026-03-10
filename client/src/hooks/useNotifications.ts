import { useEffect } from "react";
import { eventBus } from "../lib/eventBus";
import type { WSMessage, Session, Agent, DashboardEvent } from "../lib/types";

const NOTIF_KEY = "agent-monitor-notifications";

interface NotifPrefs {
  enabled: boolean;
  onNewSession: boolean;
  onSessionError: boolean;
  onSessionComplete: boolean;
  onSubagentSpawn: boolean;
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw)
      return {
        enabled: false,
        onNewSession: true,
        onSessionError: true,
        onSessionComplete: false,
        onSubagentSpawn: false,
      };
    return {
      enabled: false,
      onNewSession: true,
      onSessionError: true,
      onSessionComplete: false,
      onSubagentSpawn: false,
      ...JSON.parse(raw),
    };
  } catch {
    return {
      enabled: false,
      onNewSession: true,
      onSessionError: true,
      onSessionComplete: false,
      onSubagentSpawn: false,
    };
  }
}

function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // Safari/mobile may not support Notification constructor
  }
}

/**
 * Subscribe to the event bus and fire browser notifications based on user preferences.
 * Call once at the app root level.
 */
export function useNotifications() {
  useEffect(() => {
    return eventBus.subscribe((msg: WSMessage) => {
      const prefs = loadPrefs();
      if (!prefs.enabled) return;

      switch (msg.type) {
        case "session_created": {
          if (!prefs.onNewSession) return;
          const s = msg.data as Session;
          notify("New Session", s.name || `Session ${s.id.slice(0, 8)}`);
          break;
        }
        case "session_updated": {
          const s = msg.data as Session;
          if (s.status === "completed" && prefs.onSessionComplete) {
            notify("Session Completed", s.name || `Session ${s.id.slice(0, 8)}`);
          } else if (s.status === "error" && prefs.onSessionError) {
            notify("Session Error", s.name || `Session ${s.id.slice(0, 8)}`);
          }
          break;
        }
        case "agent_created": {
          if (!prefs.onSubagentSpawn) return;
          const a = msg.data as Agent;
          if (a.type === "subagent") {
            notify("Subagent Spawned", a.name);
          }
          break;
        }
        case "new_event": {
          const ev = msg.data as DashboardEvent;
          if (ev.event_type === "Notification") {
            notify("Claude Code", ev.summary || "Notification");
          }
          break;
        }
      }
    });
  }, []);
}
