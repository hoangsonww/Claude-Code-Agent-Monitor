/**
 * @file editors.ts
 * @description Browser-local editor preferences and safe folder links for a fixed
 * catalog of installed editors. Never runs commands or opens remote session paths.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Session } from "./types";

export const EDITORS = [
  { id: "vscode", name: "VS Code", scheme: "vscode" },
  { id: "vscode-insiders", name: "VS Code Insiders", scheme: "vscode-insiders" },
  { id: "cursor", name: "Cursor", scheme: "cursor" },
  { id: "windsurf", name: "Windsurf", scheme: "windsurf" },
  { id: "vscodium", name: "VSCodium", scheme: "vscodium" },
] as const;
export type EditorId = (typeof EDITORS)[number]["id"];
export interface EditorPrefs {
  enabled: EditorId[];
  defaultId: EditorId | null;
}

const STORAGE_KEY = "ccam-editors";
const CHANGE_EVENT = "ccam-editors-changed";

function isEditorId(value: unknown): value is EditorId {
  return EDITORS.some((editor) => editor.id === value);
}

/** Treat persisted preferences as untrusted; arbitrary URI schemes are never accepted. */
export function parseEditorPrefs(raw: string | null): EditorPrefs {
  try {
    const value = JSON.parse(raw || "null");
    const enabled: EditorId[] = Array.isArray(value?.enabled)
      ? [...new Set<EditorId>(value.enabled.filter(isEditorId))]
      : [];
    return {
      enabled,
      defaultId: enabled.includes(value?.defaultId) ? value.defaultId : (enabled[0] ?? null),
    };
  } catch {
    return { enabled: [], defaultId: null };
  }
}

function snapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

export function useEditorPrefs(): EditorPrefs {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => parseEditorPrefs(raw), [raw]);
}

/** Return false rather than claiming preferences were saved when storage is unavailable. */
export function saveEditorPrefs(prefs: EditorPrefs): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parseEditorPrefs(JSON.stringify(prefs))));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function editorUnavailableReason(
  session: Pick<Session, "cwd" | "source">,
  hostname = window.location.hostname
): "remote" | "missingFolder" | null {
  // A session's "local" source means local to the server, not necessarily the browser.
  if (
    (session.source && session.source !== "local") ||
    !["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)
  )
    return "remote";
  return folderPath(session.cwd) === null ? "missingFolder" : null;
}

function folderPath(cwd: string | null): string | null {
  if (!cwd || /[\u0000-\u001f\u007f]/.test(cwd)) return null;
  const path = /^[a-z]:[\\/]/i.test(cwd) ? `/${cwd.replace(/\\/g, "/")}` : cwd;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  return path;
}

/** Encode path segments, not a full URL, so paths cannot inject queries or fragments. */
export function editorFolderUrl(id: EditorId, cwd: string | null): string | null {
  const editor = EDITORS.find((entry) => entry.id === id);
  const path = folderPath(cwd);
  if (!editor || path === null) return null;
  try {
    const encoded = path
      .split("/")
      .map((part, index) =>
        index === 1 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)
      )
      .join("/");
    return `${editor.scheme}://file${encoded.endsWith("/") ? encoded : `${encoded}/`}`;
  } catch {
    return null;
  }
}
