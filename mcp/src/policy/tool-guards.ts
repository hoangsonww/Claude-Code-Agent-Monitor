/**
 * @file tool-guards.ts
 * @description Guard functions to check if mutating and destructive tools are enabled based on the application configuration. These functions throw errors with informative messages if the required permissions are not granted, guiding developers to enable the necessary environment variables to use these tools. The assertMutationsEnabled function checks for general mutation permissions, while the assertDestructiveEnabled function checks for both mutation and destructive permissions, as well as validating a confirmation token to prevent accidental use of destructive tools.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import type { AppConfig } from "../config/app-config.js";

export function assertMutationsEnabled(config: AppConfig): void {
  if (!config.allowMutations) {
    throw new Error(
      "Mutating tools are disabled. Set MCP_DASHBOARD_ALLOW_MUTATIONS=true to enable them."
    );
  }
}

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
