/**
 * @file Helpers for WebSocket messages that signal remote SSH sources finished
 * syncing and scoped stats (sessions, costs, analytics) should refetch.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { ImportProgressMessage, RemoteSourceStatusPayload, WSMessage } from "./types";

/**
 * True when a WebSocket message means remote-imported data may have changed and
 * pages should refetch API data (not merely show a sync spinner).
 */
export function isRemoteDataRefreshMessage(msg: WSMessage): boolean {
  if (msg.type === "remote_data.updated") return true;
  if (msg.type === "remote_source.status") {
    return (msg.data as RemoteSourceStatusPayload).status === "ok";
  }
  if (msg.type === "import.progress") {
    const d = msg.data as ImportProgressMessage;
    return d.phase === "complete" && d.source === "remote";
  }
  return false;
}
