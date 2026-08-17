/**
 * @file Small JSON-RPC client for Codex's local `app-server --stdio` bridge.
 * It intentionally owns no dashboard policy: callers start threads, turns,
 * and model discovery through the same protocol Codex's native app uses.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { EventEmitter } = require("node:events");
const spawn = require("cross-spawn");

const DEFAULT_TIMEOUT_MS = 12_000;

function makeError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * A deliberately small JSONL JSON-RPC client. Codex app-server may emit
 * asynchronous notifications between responses, so matching by request id is
 * essential rather than assuming a response ordering.
 */
class CodexAppServer extends EventEmitter {
  constructor({ cwd, env } = {}) {
    super();
    this.child = spawn("codex", ["app-server", "--stdio"], {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderr = "";
    this.closed = false;

    this.child.stdout.on("data", (chunk) => this.consume(chunk.toString("utf8")));
    this.child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString("utf8")).slice(-8192);
    });
    this.child.on("error", (err) => this.failAll(err));
    this.child.on("exit", (code, signal) => {
      this.closed = true;
      const message = `Codex app-server exited${code == null ? "" : ` (${code})`}${
        signal ? ` via ${signal}` : ""
      }`;
      this.failAll(makeError("ECODEXEXIT", message));
      this.emit("exit", { code, signal, stderr: this.stderr });
    });
  }

  consume(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.stderr = (this.stderr + `[invalid app-server JSON] ${line}\n`).slice(-8192);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(message, "id")) {
        const pending = this.pending.get(message.id);
        if (!pending) {
          this.emit("response", message);
          continue;
        }
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) {
          const error = makeError(
            message.error.code || "ECODEXRPC",
            message.error.message || "Codex app-server request failed"
          );
          error.data = message.error.data;
          pending.reject(error);
        } else {
          pending.resolve(message.result);
        }
      } else if (message.method) {
        this.emit("notification", message);
      } else {
        this.emit("message", message);
      }
    }
  }

  request(method, params = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (this.closed || !this.child.stdin?.writable) {
      return Promise.reject(makeError("ECODEXCLOSED", "Codex app-server is not running"));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(makeError("ECODEXTIMEOUT", `Codex app-server timed out waiting for ${method}`));
      }, timeoutMs);
      timeout.unref?.();
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
      } catch (err) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  async initialize() {
    return this.request("initialize", {
      clientInfo: { name: "claude-code-agent-monitor", version: "1.0.0" },
      capabilities: { experimentalApi: true },
    });
  }

  failAll(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.failAll(makeError("ECODEXCLOSED", "Codex app-server was closed"));
    try {
      this.child.stdin?.end();
    } catch {
      /* best effort */
    }
    try {
      this.child.kill("SIGTERM");
    } catch {
      /* best effort */
    }
  }
}

function startCodexAppServer(options) {
  return new CodexAppServer(options);
}

module.exports = { CodexAppServer, startCodexAppServer, makeError };
