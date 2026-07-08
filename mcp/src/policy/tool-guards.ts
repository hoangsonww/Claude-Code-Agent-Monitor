/**
 * @file tool-guards.ts
 * @description Guard functions to check if mutating and destructive tools are enabled based on the application configuration. These functions throw errors with informative messages if the required permissions are not granted, guiding developers to enable the necessary environment variables to use these tools. The assertMutationsEnabled function checks for general mutation permissions, while the assertDestructiveEnabled function checks for both mutation and destructive permissions, as well as validating a confirmation token to prevent accidental use of destructive tools.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { AppConfig } from "../config/app-config.js";

/**
 * Two policy tiers gate every write-capable tool, checked only here:
 * 1. **Mutations** (`config.allowMutations`, `MCP_DASHBOARD_ALLOW_MUTATIONS`)
 *    — required by any create/update/reset/cleanup tool. Off by default, so
 *    the server is read-only unless explicitly opted in.
 * 2. **Destructive** (`config.allowDestructive`, `MCP_DASHBOARD_ALLOW_DESTRUCTIVE`)
 *    — a strictly higher tier on top of mutations, required only by
 *    `dashboard_clear_all_data`.
 * Every write-tool handler calls one of these two functions first, before
 * any API call, so a disabled tier fails fast with no side effects.
 */

/**
 * Throws if mutating tools are disabled. Called first by every tool that
 * creates/updates/deletes/resets/cleans up dashboard state; read-only tools
 * (list/get/health/stats/analytics/export) never call this.
 * @throws {Error} naming `MCP_DASHBOARD_ALLOW_MUTATIONS=true` if
 *   `config.allowMutations` is `false`.
 */
export function assertMutationsEnabled(config: AppConfig): void {
  if (!config.allowMutations) {
    throw new Error(
      "Mutating tools are disabled. Set MCP_DASHBOARD_ALLOW_MUTATIONS=true to enable them."
    );
  }
}

/**
 * Guards the single most dangerous tool in the server —
 * `dashboard_clear_all_data`, which deletes every session/agent/event/
 * token-usage row. A three-part gate checked in order: mutations, then the
 * destructive flag, then the confirmation token, so the common
 * misconfiguration (mutations off) always surfaces the more general error
 * first.
 * @param confirmationToken Must exactly equal `"CLEAR_ALL_DATA"` — a
 *   deliberate, unguessable-by-accident confirmation, not a secret.
 * @throws {Error} if mutations are disabled, `config.allowDestructive` is
 *   `false`, or the token doesn't match exactly.
 */
export function assertDestructiveEnabled(config: AppConfig, confirmationToken: string): void {
  assertMutationsEnabled(config);
  if (!config.allowDestructive) {
    throw new Error(
      "Destructive tools are disabled. Set MCP_DASHBOARD_ALLOW_DESTRUCTIVE=true to enable them."
    );
  }
  if (confirmationToken !== "CLEAR_ALL_DATA") {
    throw new Error('Invalid confirmation_token. Expected exact value: "CLEAR_ALL_DATA".');
  }
}
