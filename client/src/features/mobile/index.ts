/**
 * @file index.ts
 * @description Barrel exports for the mobile feature. Consumers should import
 *   from `client/src/features/mobile` rather than from individual files.
 */

export { MobileShell } from "./MobileShell";
export { BottomTabNav } from "./BottomTabNav";
export { useMediaQuery, MOBILE_BREAKPOINT } from "./useMediaQuery";
