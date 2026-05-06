/**
 * @file Composer V2 shared types. Imported by hooks (useComposerState,
 * useUploads, useSlashCommands) and every leaf component under
 * client/src/features/composer/.
 */
import type { ProfileConfig, PermissionMode } from "./profile-types";

export type AttachmentKind = "text" | "image" | "binary";

export interface Attachment {
  /** Server-issued uuid; matches the on-disk directory under .launcher-uploads/. */
  id: string;
  /** Sanitized filename. */
  name: string;
  /** Bytes. */
  size: number;
  kind: AttachmentKind;
  /** cwd-relative path the spawned `claude` will Read. */
  path: string;
}

export type SlashSource = "builtin" | "skill" | "plugin" | "project";

export interface SlashCommand {
  name: string;
  description: string;
  source: SlashSource;
}

export interface SlashCatalog {
  builtin: SlashCommand[];
  skills: SlashCommand[];
  plugins: SlashCommand[];
  project: SlashCommand[];
}

export interface ComposerProps {
  sessionId: string;
  sessionLiveHandleId?: string | null;
  sessionCwd: string;
  defaultProfileId?: string | null;
  /**
   * "resume" → spawn with --resume <sessionId> (the dashboard's primary path:
   *            every imported / orchestrator-launched session row).
   * "fresh"  → spawn without --resume (callers like MobileChat that mint a
   *            sessionId locally before any session row exists).
   */
  mode?: "resume" | "fresh";
  /** Called when respawn or initial spawn produces a new live handle id. */
  onLiveHandleChange?: (newHandleId: string | null) => void;
}

export interface ComposerStateOverrides {
  model?: string;
  mode?: PermissionMode;
  config?: ProfileConfig;
}
