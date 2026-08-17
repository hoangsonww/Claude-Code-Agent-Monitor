/**
 * @file quips.ts
 * @description Tabby's personality: pools of short phrases keyed by pulse/mood,
 *   plus a deterministic-by-injection picker. Pure data + a pure function so it
 *   can be unit-tested without randomness leaking in.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/* =============================================================================
 * MODULE_GUIDE — extended in-file reference (comments only; safe to read, never executed)
 * =============================================================================
 * **Path:** `/Users/davidnguyen/WebstormProjects/Claude-Code-Agent-Monitor/client/src/components/Tabby/quips.ts`
 * **Purpose:** Tabby is the optional on-screen cat assistant — quips, intents, and lightweight event reactions layered above the dashboard chrome.
 *
 * ## Design constraints
 * - Local-first: no telemetry leaves the machine unless the user configures webhooks.
 * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that
 *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).
 * - Destructive flows stay behind explicit confirmation modals and server-side gates.
 * - Internationalization: user-visible strings belong in i18n JSON, not literals here.
 *
 * ## Remote data & SSH
 * Remote Data Sources let operators aggregate multiple machines. SSH entries describe
 * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every
 * scoped GET via `?sources=`. Health checks and import history surface in Settings.
 *
 * ## Observability
 * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four
 * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and
 * Docker Compose profiles are documented in `monitoring/README.md`.
 *
 * ## Internal dependencies
 * - `./brain`
 *
 * ## Public surface
 * - `QuipKey` — exported API; see TSDoc on the symbol for behavior.
 * - `pickQuip` — exported API; see TSDoc on the symbol for behavior.
 * - `ALL_QUIP_KEYS` — exported API; see TSDoc on the symbol for behavior.
 *
 * ## Testing pointers
 * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.
 * - Server contract changes require `npm run test:server` and OpenAPI sync.
 * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.
 *
 * ## Related docs
 * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.
 * - `docs/API.md` — REST reference.
 * - `.claude/skills/file-headers/` — mandatory `@author` header policy.
 * ============================================================================= */
/* -----------------------------------------------------------------------------
 * EXPORT CATALOG — quick index of symbols defined below (documentation only).
 * -----------------------------------------------------------------------------
 * **QuipKey**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **pickQuip**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * **ALL_QUIP_KEYS**
 *   Part of this module's public contract. Downstream imports should treat
 *   the signature and return type as stable unless release notes say otherwise.
 *   When behavior changes, update the `@file` overview and relevant tests.
 *
 * ----------------------------------------------------------------------------- */

import type { Mood, TabbyPulse } from "./brain";

export type QuipKey = NonNullable<TabbyPulse> | Mood;

const QUIPS: Record<QuipKey, string[]> = {
  // Pulses (event-driven, transient bubbles)
  session_done: [
    "a session just wrapped up! 🐾",
    "a session finished - nice work! ✨",
    "that session's all done 😺",
    "clean finish on that one 💜",
  ],
  session_start: [
    "a new session started! 👀",
    "a fresh session just landed 🐾",
    "ooh, a new session to watch 😻",
    "something new is cooking 🍲",
  ],
  subagent_spawn: [
    "a subagent just spawned! 🐾",
    "a little helper joined in 🤝",
    "a subagent's on the job 🚀",
    "reinforcements - new subagent! 😺",
  ],
  waiting: [
    "a session needs your input 👀",
    "a session is waiting on you ⏳",
    "a session paused for your reply 💬",
    "your turn - a session's waiting 🐾",
  ],
  error: [
    "uh oh, a session hit an error 😿",
    "something broke - wanna peek? 🙀",
    "a hook tripped on something ⚠️",
    "hiss… an error popped up 💢",
  ],
  run_done: [
    "your run just finished! 🐾",
    "the run's all wrapped up ✨",
    "run complete - that's a wrap 😸",
    "all done with that run 💜",
  ],
  // Moods (steady-state flavor, used by the panel / idle bubbles)
  disconnected: [
    "lost the connection… 😴",
    "can't reach the server 📡",
    "no signal - taking a nap 💤",
  ],
  worried: ["that didn't look right 😟", "keeping an eye out 👀", "hmm, something's off 🫣"],
  stuck: [
    "a session's been quiet a while… 🤔",
    "is something stuck? ⏳",
    "still chewing on it… 😾",
  ],
  happy: ["great run! 😻", "love a tidy finish ✨", "purrfect 💜"],
  thinking: ["hmm, let me look… 🤔", "sniffing around… 🐾", "one sec, checking 🔍"],
  watching: ["on the prowl 👀", "watching your sessions 😼", "eyes peeled 🐾"],
  sleeping: ["zzz… 💤", "wake me if something happens 😴", "curled up, all calm 🐈"],
  idle: ["all quiet 😺", "ready when you are 🐾", "just vibing ✨"],
};

/**
 * Pick a quip for a key. `rand` is injectable for deterministic tests; defaults
 * to Math.random. Returns "" only for an unknown key (never throws).
 */
export function pickQuip(key: QuipKey, rand: () => number = Math.random): string {
  const pool = QUIPS[key];
  if (!pool || pool.length === 0) return "";
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rand() * pool.length)));
  return pool[i] ?? "";
}

export const ALL_QUIP_KEYS = Object.keys(QUIPS) as QuipKey[];
