/**
 * @file Preload script.
 *
 * The dashboard runs as standard web content loaded from
 * `http://127.0.0.1:<port>`. It does not need privileged APIs to function;
 * keeping this preload empty is intentional and keeps the attack surface
 * minimal. Renderer-side desktop helpers (e.g. native notification routing)
 * can be added here later via `contextBridge.exposeInMainWorld` if the
 * dashboard ever wants to call them.
 */

export {};
