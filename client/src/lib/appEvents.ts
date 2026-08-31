/**
 * @file appEvents.ts
 * @description Window events used to trigger app-wide chrome from anywhere in the
 * tree, plus the typed helpers that dispatch them.
 *
 * These live in `lib/` rather than beside the components that handle them for one
 * reason: the trigger and the handler are usually in different components, and
 * importing one component from the other creates a cycle (the sidebar opens the
 * palette; the palette asks the sidebar to check for updates). A shared module
 * breaks that without giving either component knowledge of the other.
 *
 * A window event is also the right coupling here regardless: no context provider,
 * no lifted state, and any component — or a test — can trigger the behavior.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/** Opens the command palette. Handled by `CommandPalette`. */
export const COMMAND_PALETTE_EVENT = "ccam:command-palette";

/** Asks the sidebar to run an update check. Handled by `Sidebar`. */
export const UPDATE_CHECK_EVENT = "ccam:check-updates";

/** Open the command palette from outside the component. */
export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

/**
 * Ask the sidebar to re-check for a release. The check itself stays in the
 * sidebar, which owns the spinner, the failure state, and the modal that reports
 * the result.
 */
export function requestUpdateCheck(): void {
  window.dispatchEvent(new CustomEvent(UPDATE_CHECK_EVENT));
}
