/**
 * @file vite-env.d.ts
 * @description Ambient type declarations for the Vite client build. Pulls in
 * Vite's client types (`import.meta.env`, static asset modules) and declares
 * compile-time globals injected by `define` in `vite.config.ts`.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/// <reference types="vite/client" />

/**
 * Repository version string baked in at build time from the root `package.json`.
 * Surfaced in Settings and the update notifier without a runtime fetch.
 */
declare const __APP_VERSION__: string;
