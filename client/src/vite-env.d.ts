/**
 * @file vite-env.d.ts
 * @description Ambient type declarations for the client build — Vite client types plus the build-time-injected `__APP_VERSION__` global (the repo-root project version; see vite.config.ts).
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/// <reference types="vite/client" />

/** Repo-root project version, injected by Vite `define` at build time. */
declare const __APP_VERSION__: string;
