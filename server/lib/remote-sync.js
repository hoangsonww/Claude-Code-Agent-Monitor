/**
 * @file remote-sync.js
 * @description Pull Claude Code and Codex session history from remote machines
 * over SSH so one dashboard can monitor usage collected elsewhere (e.g. a dev
 * box or cloud VM the user drives over SSH while running CCAM on their laptop).
 *
 * Design (see repo issue "Live remote/multi-machine data collection"):
 *   1. Authentication ALWAYS defers to the host's own SSH stack — ~/.ssh/config,
 *      ssh-agent, keys, known_hosts. This module stores and handles NO secrets;
 *      a source's `host` is just an ssh destination (user@host or a config alias)
 *      and `identity_file` is at most a path to a key the user already controls.
 *   2. `scp -r` mirrors remote Claude `<home>/projects` and Codex
 *      `<home>/sessions` trees into isolated provider staging dirs. Codex also
 *      receives its lightweight native title index without copying credentials
 *      or unrelated config. Only OpenSSH is required on the remote — no rsync.
 *   3. The SAME provider importer the dashboard uses locally parses the mirror,
 *      so remote sessions, agents, tokens, costs, lifecycle state, and native
 *      Codex rename titles line up with local history. Imported rows are then
 *      tagged with the source id.
 *
 * Security posture: every external command runs via child_process with an
 * ARGUMENT ARRAY and no shell (`shell` is never set), so user-controlled values
 * are never interpolated into a shell line. On top of that, host / path / port /
 * identity-file inputs are validated against strict allowlists BEFORE they reach
 * any command (see validateSourceInput). StrictHostKeyChecking is left at the
 * SSH default — an unknown host key fails the sync rather than being trusted
 * blindly, so the user must have connected once manually (host in known_hosts).
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execFileSync } = require("child_process");

const { getDataDir } = require("./claude-home");
const { importFromDirectory, collectJsonlFiles } = require("../../scripts/import-history");
const { findCodexTranscripts } = require("./codex-ingest");
const { importCodexFromDirectory, getCodexTranscriptSessionId } = require("./codex-import");

const REMOTE_PROVIDERS = ["claude", "codex"];

// Per-source sync timeout. A first sync of a large history can take a while;
// keep it generous but bounded so a hung SSH never wedges the poller.
const SYNC_TIMEOUT_MS = parseInt(process.env.DASHBOARD_REMOTE_SYNC_TIMEOUT_MS || "600000", 10);
// Connection-test timeout — short; this is a liveness probe, not a transfer.
const TEST_TIMEOUT_MS = parseInt(process.env.DASHBOARD_REMOTE_TEST_TIMEOUT_MS || "15000", 10);
// A remote session is treated as still-active while its mirrored transcript was
// modified within this window. scp preserves remote mtimes — the same
// "recently touched ⇒ probably running" signal as local import
// (scripts/import-history.js RECENT_THRESHOLD_MS). Once the mirror stops
// advancing (the remote session ended), the session flips to completed on the
// next sync. Configurable for slow links / long-idle turns.
const REMOTE_ACTIVE_WINDOW_MS = parseInt(
  process.env.DASHBOARD_REMOTE_ACTIVE_WINDOW_MS || "600000",
  10
);

// In-flight source ids, so a manual "Sync now" and the background poller can't
// run two syncs against the same source (and the same staging dir) at once.
const inFlight = new Set();

// ── Validation ──────────────────────────────────────────────────────────────

// SSH destination: [user@]host or a ~/.ssh/config alias. Allowlist only chars
// that legitimately appear in those; critically, forbid a leading '-' so the
// value can never be mistaken for an ssh option (OpenSSH has no `--` end-of-
// options terminator), and forbid whitespace / shell metacharacters / ':'
// (which would break scp's host:path parsing), whitespace, and metachars.
const HOST_RE = /^[A-Za-z0-9][A-Za-z0-9._@-]*$/;
// Remote path (the remote CLAUDE_HOME). POSIX absolute, ~-rooted, Windows
// `C:/...`, WSL `wsl:~/.claude` / `wsl:/home/user/.claude`, or a UNC path
// such as `//wsl.localhost/Ubuntu/home/user/.claude` (forward slashes only).
const REMOTE_PATH_RE =
  /^(wsl:(~[A-Za-z0-9._/~-]*|\/[A-Za-z0-9._/~-]*)|~[A-Za-z0-9._/~-]*|\/[A-Za-z0-9._/~-]*|[A-Za-z]:\/[A-Za-z0-9._/~-]*|\/\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._/~-]*)*)$/;
// Whitespace + control chars (space, tab, newline, DEL, all C0 controls).
// eslint-disable-next-line no-control-regex -- intentional control-char reject
const CONTROL_OR_SPACE_RE = /[\x00-\x20\x7f]/;

class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Validate + normalize raw source config from the API into the shape the DB and
 * command builders expect. Throws ValidationError (with a stable `code`) on any
 * malformed field so the route can return a structured 400.
 *
 * @param {object} input raw body
 * @param {boolean} [partial] when true (PATCH), only validate provided fields
 * @returns {{label?:string,host?:string,sshPort?:number|null,identityFile?:string|null,remoteHome?:string|null,remoteCodexHome?:string|null,enabled?:number}}
 */
function validateSourceInput(input, partial = false) {
  const out = {};
  // `null` is an intentional clear for nullable settings in a PATCH (for
  // example, reverting a custom remote Codex home to ~/.codex). Distinguish it
  // from an absent property, which must preserve the stored value.
  const has = (k) => Object.hasOwn(input, k) && input[k] !== undefined;

  if (!partial || has("label")) {
    const label = typeof input.label === "string" ? input.label.trim() : "";
    if (!label) throw new ValidationError("INVALID_LABEL", "`label` is required");
    if (label.length > 100)
      throw new ValidationError("INVALID_LABEL", "`label` must be 100 characters or fewer");
    out.label = label;
  }

  if (!partial || has("host")) {
    const host = typeof input.host === "string" ? input.host.trim() : "";
    if (!host) throw new ValidationError("INVALID_HOST", "`host` is required");
    if (host.length > 255 || !HOST_RE.test(host)) {
      throw new ValidationError(
        "INVALID_HOST",
        "`host` must be an ssh destination (user@host or a ~/.ssh/config alias); no spaces or shell characters, cannot start with '-'"
      );
    }
    out.host = host;
  }

  if (has("ssh_port")) {
    if (input.ssh_port === null) {
      out.sshPort = null;
    } else {
      const port = Number(input.ssh_port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ValidationError("INVALID_PORT", "`ssh_port` must be an integer 1-65535");
      }
      out.sshPort = port;
    }
  } else if (!partial) {
    out.sshPort = null;
  }

  if (has("identity_file")) {
    if (input.identity_file === null) {
      out.identityFile = null;
    } else {
      const raw = String(input.identity_file).trim();
      if (!raw) {
        out.identityFile = null;
      } else {
        // Expand ~ and normalize slashes for the local OS (Windows accepts C:/ or C:\).
        let expanded = raw.startsWith("~") ? path.join(os.homedir(), raw.slice(1)) : raw;
        if (process.platform === "win32") expanded = expanded.replace(/\//g, "\\");
        if (CONTROL_OR_SPACE_RE.test(expanded)) {
          throw new ValidationError(
            "INVALID_IDENTITY_FILE",
            "`identity_file` must be a path with no spaces or control characters"
          );
        }
        if (!path.isAbsolute(expanded)) {
          throw new ValidationError(
            "INVALID_IDENTITY_FILE",
            "`identity_file` must be an absolute path"
          );
        }
        out.identityFile = expanded;
      }
    }
  } else if (!partial) {
    out.identityFile = null;
  }

  const validateRemoteHome = (field, outputKey, defaultExample) => {
    if (!has(field)) {
      if (!partial) out[outputKey] = null;
      return;
    }
    if (input[field] === null) {
      out[outputKey] = null;
      return;
    }
    const rh = String(input[field]).trim();
    if (rh.includes("..") || !REMOTE_PATH_RE.test(rh)) {
      throw new ValidationError(
        "INVALID_REMOTE_HOME",
        `\`${field}\` must be a POSIX path (\`${defaultExample}\` or \`/opt/agent-home\`), a Windows path (\`C:/Users/you/.agent-home\`), a WSL path (\`wsl:${defaultExample}\`), or a UNC path; no spaces or \`..\``
      );
    }
    out[outputKey] = rh;
  };

  validateRemoteHome("remote_home", "remoteHome", "~/.claude");
  validateRemoteHome("remote_codex_home", "remoteCodexHome", "~/.codex");

  if (has("enabled")) {
    out.enabled = input.enabled ? 1 : 0;
  }

  return out;
}

// ── Command building ──────────────────────────────────────────────────────────

/** Strip ANSI color / style escapes from command stderr (common on Windows shells). */
function stripAnsi(text) {
  return String(text || "").replace(/\u001b\[[0-9;]*m/g, "");
}

/**
 * Best-effort `SSH_AUTH_SOCK` for GUI/desktop launches that omit it. Never
 * guesses Secretive — that comes only from the user's `ssh -G` / `~/.ssh/config`.
 */
function discoverSshAuthSock() {
  if (process.env.SSH_AUTH_SOCK && fs.existsSync(process.env.SSH_AUTH_SOCK)) {
    return process.env.SSH_AUTH_SOCK;
  }
  if (process.platform === "darwin") {
    try {
      const sock = execFileSync("launchctl", ["getenv", "SSH_AUTH_SOCK"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (sock && fs.existsSync(sock)) return sock;
    } catch {
      /* no launchd agent — file-based keys or IdentityAgent from ssh -G */
    }
  }
  // Windows OpenSSH agent service (optional — file keys still work without it).
  if (process.platform === "win32") {
    return "\\\\.\\pipe\\openssh-ssh-agent";
  }
  return null;
}

/**
 * Environment passed to every `ssh`/`scp` child. GUI/desktop launches often omit
 * `HOME` and `SSH_AUTH_SOCK`; file-based keys need `HOME`, ssh-agent users need
 * the socket, and Secretive/1Password users get `IdentityAgent` from `ssh -G`.
 */
function buildSshChildEnv() {
  const env = { ...process.env };
  const home = os.homedir();
  if (!env.HOME) env.HOME = home;
  if (!env.USERPROFILE) env.USERPROFILE = home;
  if (process.platform === "win32") {
    if (!env.SYSTEMROOT && process.env.SystemRoot) env.SYSTEMROOT = process.env.SystemRoot;
    if (!env.USER && process.env.USERNAME) env.USER = process.env.USERNAME;
  }
  if (!env.SSH_AUTH_SOCK) {
    const sock = discoverSshAuthSock();
    if (sock) env.SSH_AUTH_SOCK = sock;
  }
  return env;
}

/** Expand `~` in paths from `ssh -G` (IdentityAgent, etc.). */
function expandSshConfigPath(p) {
  const raw = String(p || "")
    .trim()
    .replace(/^"|"$/g, "");
  if (!raw || raw === "none" || raw === "SSH_AUTH_SOCK") return raw;
  if (raw.startsWith("~/")) return path.join(os.homedir(), raw.slice(2));
  if (raw === "~") return os.homedir();
  return raw;
}

/** Explicit user config so ssh/scp match the interactive shell even when env is sparse. */
function sshConfigFileArgs() {
  const cfg = path.join(os.homedir(), ".ssh", "config");
  return fs.existsSync(cfg) ? ["-F", cfg] : [];
}

function parseSshGOutput(stdout) {
  const out = {};
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const idx = line.indexOf(" ");
    if (idx === -1) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

/** Cache `ssh -G` identity-agent resolution per host. */
const sshExtraOptionsCache = new Map();

/**
 * Build `-o IdentityAgent=…` only when `ssh -G` names a concrete socket path
 * (Secretive, 1Password, custom agent). `SSH_AUTH_SOCK` / `none` → rely on env
 * or file-based keys — never force Secretive when the user's config does not.
 */
function identityAgentArgsFromConfig(identityagent) {
  const agent = expandSshConfigPath(identityagent);
  if (agent && agent !== "none" && agent !== "SSH_AUTH_SOCK") {
    return ["-o", `IdentityAgent=${agent}`];
  }
  return [];
}

/**
 * Match the interactive `ssh` stack: read effective config via `ssh -G` and
 * forward `IdentityAgent` only when config names a concrete agent socket.
 */
async function resolveExtraSshOptions(source) {
  const cacheKey = `${source.host}\0${source.ssh_port ?? ""}\0${source.identity_file ?? ""}`;
  if (sshExtraOptionsCache.has(cacheKey)) return sshExtraOptionsCache.get(cacheKey);

  const probeArgs = [
    "-G",
    ...sshConfigFileArgs(),
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
  ];
  if (source.ssh_port) probeArgs.push("-p", String(source.ssh_port));
  if (source.identity_file) {
    probeArgs.push("-i", source.identity_file, "-o", "IdentitiesOnly=yes");
  }
  probeArgs.push(source.host);

  let extra = [];
  try {
    const { code, stdout } = await runCommand(resolveSshBinary("ssh"), probeArgs, {
      timeoutMs: 10000,
      env: buildSshChildEnv(),
    });
    if (code === 0) {
      extra = identityAgentArgsFromConfig(parseSshGOutput(stdout).identityagent);
    }
  } catch {
    /* no extra options — OpenSSH will use file keys or SSH_AUTH_SOCK from env */
  }

  sshExtraOptionsCache.set(cacheKey, extra);
  return extra;
}

/**
 * Resolve OpenSSH client binaries (`ssh`, `scp`). Prefer PATH so we use the same
 * build as the user's shell (Git for Windows vs System32). On Windows, fall back
 * to the built-in OpenSSH install when PATH has no match.
 */
function resolveSshBinary(tool) {
  const exe = process.platform === "win32" ? `${tool}.exe` : tool;
  const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    const full = path.join(dir, exe);
    try {
      if (fs.existsSync(full)) return full;
    } catch {
      /* try next PATH entry */
    }
  }
  const winDir = process.env.WINDIR || process.env.SystemRoot;
  if (process.platform === "win32" && winDir) {
    const system32 = path.join(winDir, "System32", "OpenSSH", exe);
    if (fs.existsSync(system32)) return system32;
  }
  return exe;
}

/**
 * SSH options shared by the connection test and the scp transport. BatchMode
 * fails fast instead of hanging on a password prompt; ConnectTimeout bounds a
 * dead host. Host-key policy is left at the SSH default on purpose (see file
 * header). Returned as a flat arg array — never a shell string.
 */
async function sshOptionArgs(source) {
  const args = [...sshConfigFileArgs(), "-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
  if (source.ssh_port) args.push("-p", String(source.ssh_port));
  if (source.identity_file) args.push("-i", source.identity_file, "-o", "IdentitiesOnly=yes");
  args.push(...(await resolveExtraSshOptions(source)));
  return args;
}

/** `scp` shares most SSH options but uses `-P` (capital) for the port. */
async function scpOptionArgs(source) {
  const args = [...sshConfigFileArgs(), "-o", "BatchMode=yes", "-o", "ConnectTimeout=10"];
  if (source.ssh_port) args.push("-P", String(source.ssh_port));
  if (source.identity_file) args.push("-i", source.identity_file, "-o", "IdentitiesOnly=yes");
  args.push(...(await resolveExtraSshOptions(source)));
  return args;
}

function assertProvider(provider) {
  if (!REMOTE_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported remote provider: ${provider}`);
  }
}

function providerName(provider) {
  return provider === "codex" ? "Codex" : "Claude Code";
}

function providerHomeField(provider) {
  return provider === "codex" ? "remote_codex_home" : "remote_home";
}

function providerDefaultHome(provider) {
  return provider === "codex" ? "~/.codex" : "~/.claude";
}

function providerHistorySegment(provider) {
  return provider === "codex" ? "sessions" : "projects";
}

/** Effective provider home from a source row (`~/.claude` / `~/.codex`). */
function normalizedRemoteHome(source, provider = "claude") {
  assertProvider(provider);
  const home = source[providerHomeField(provider)];
  return home && home.trim() ? home.trim() : providerDefaultHome(provider);
}

/** `<agent_home>/<history-dir>` inside a WSL distro (no `wsl:` prefix). */
function wslHistoryPathFromHome(wslHome, provider = "claude") {
  assertProvider(provider);
  return `${wslHome.replace(/\/+$/, "")}/${providerHistorySegment(provider)}`;
}

/** Backwards-compatible Claude helper retained for existing integrations/tests. */
function wslProjectsPathFromHome(wslHome) {
  return wslHistoryPathFromHome(wslHome, "claude");
}

/** True when `remote_home` targets Claude Code inside WSL on a Windows SSH host. */
function isWslRemoteHome(home) {
  return typeof home === "string" && home.startsWith("wsl:");
}

/** True when the user may rely on automatic WSL fallback (blank or default home). */
function allowsWslAutoFallback(source, provider = "claude") {
  const home = normalizedRemoteHome(source, provider);
  return home === providerDefaultHome(provider) && !isWslRemoteHome(home);
}

/** Remote provider transcript directory to mirror. */
function remoteHistoryPath(source, provider = "claude") {
  const home = normalizedRemoteHome(source, provider);
  if (isWslRemoteHome(home)) {
    return `wsl:${wslHistoryPathFromHome(home.slice(4), provider)}`;
  }
  const history = `${home.replace(/\/+$/, "")}/${providerHistorySegment(provider)}`;
  // scp host:path uses forward slashes even for Windows remotes.
  return history.replace(/\\/g, "/");
}

/** Remote Claude projects directory to mirror (default ~/.claude/projects). */
function remoteProjectsPath(source) {
  return remoteHistoryPath(source, "claude");
}

/** Remote Codex rollout directory to mirror (default ~/.codex/sessions). */
function remoteCodexSessionsPath(source) {
  return remoteHistoryPath(source, "codex");
}

/** `host:path/.` spec for recursive scp (validated path — no shell interpolation). */
function scpRemoteSpec(source, provider = "claude") {
  return `${source.host}:${remoteHistoryPath(source, provider)}/.`;
}

/**
 * Remote shell probes for testConnection. Order: POSIX `sh` (Linux/macOS +
 * Git-Bash-on-Windows), PowerShell (Windows OpenSSH + ~ home), WSL when the
 * default home is used, then cmd.exe for explicit `C:/` or UNC homes. Paths are
 * validation-sanitized before embedding.
 */
function connectionProbeCommands(source, provider = "claude") {
  const home = normalizedRemoteHome(source, provider);
  const probes = [];

  if (isWslRemoteHome(home)) {
    const history = wslHistoryPathFromHome(home.slice(4), provider);
    probes.push(`wsl.exe -e sh -c 'test -d ${history} && echo CCAM_OK || echo CCAM_NO_DIR'`);
    return probes;
  }

  const remoteHistory = remoteHistoryPath(source, provider);

  if (/^\/\//.test(home)) {
    const winPath = remoteHistory.replace(/\//g, "\\");
    probes.push(`cmd /c "if exist ${winPath} (echo CCAM_OK) else (echo CCAM_NO_DIR)"`);
    probes.push(
      `powershell.exe -NoProfile -Command "if (Test-Path -LiteralPath '${remoteHistory}') { 'CCAM_OK' } else { 'CCAM_NO_DIR' }"`
    );
    return probes;
  }

  if (/^[A-Za-z]:\//.test(home)) {
    const winPath = remoteHistory.replace(/\//g, "\\");
    probes.push(`cmd /c "if exist ${winPath} (echo CCAM_OK) else (echo CCAM_NO_DIR)"`);
    return probes;
  }

  const shProbe = `sh -c 'test -d ${remoteHistory} && echo CCAM_OK || echo CCAM_NO_DIR'`;
  probes.push(shProbe);

  if (home.startsWith("~")) {
    const tail = home.replace(/^~/, "").replace(/\/+$/, "").replace(/\//g, "\\");
    const history = providerHistorySegment(provider);
    const rel = tail
      ? `${tail}\\${history}`
      : `.${provider === "codex" ? "codex" : "claude"}\\${history}`;
    probes.push(
      `powershell.exe -NoProfile -Command "if (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '${rel}')) { 'CCAM_OK' } else { 'CCAM_NO_DIR' }"`
    );
    // Agent CLIs on Windows often keep their state inside WSL while SSH lands
    // in Windows. Probe the provider's matching history directory there too.
    probes.push(`wsl.exe -e sh -c 'test -d ${remoteHistory} && echo CCAM_OK || echo CCAM_NO_DIR'`);
  }
  return probes;
}

/** `ssh` remote command that streams a provider history tar from WSL. */
function wslTarRemoteCmd(wslHome, provider = "claude") {
  const history = wslHistoryPathFromHome(wslHome, provider);
  if (provider === "claude") return `wsl.exe -e sh -c 'tar -cC ${history} .'`;
  // Codex's title index lives next to `sessions`, not inside it. The conditional
  // keeps it when available without failing a valid history-only installation.
  const home = wslHome.replace(/\/+$/, "");
  return `wsl.exe -e sh -c 'cd ${home} && (test -f session_index.jsonl && tar -c sessions session_index.jsonl || tar -c sessions)'`;
}

/** Whether a provider's history dir exists inside the given WSL home. */
async function wslPathExists(source, wslHome, timeoutMs, provider = "claude") {
  const history = wslHistoryPathFromHome(wslHome, provider);
  const { code, stdout } = await runSsh(
    source,
    `wsl.exe -e sh -c 'test -d ${history} && echo CCAM_OK || echo CCAM_NO_DIR'`,
    timeoutMs
  );
  return code === 0 && stripAnsi(stdout).includes("CCAM_OK");
}

function shouldTryWslFallback(source, err, provider = "claude") {
  if (!allowsWslAutoFallback(source, provider)) return false;
  const msg = String((err && err.message) || err || "").toLowerCase();
  return (
    msg.includes("no such file") ||
    msg.includes("not found") ||
    msg.includes("missing") ||
    msg.includes("does not exist")
  );
}

/** Sandboxed local staging dir for one source/provider mirror. */
function stagingDir(sourceId, provider = "claude") {
  assertProvider(provider);
  return path.join(
    getDataDir(),
    "remote-sources",
    sourceId,
    provider === "codex" ? "codex" : "projects"
  );
}

/**
 * Run a command with an argument array and no shell. Resolves with
 * {code, stdout, stderr}; rejects on spawn error or timeout. Never interpolates
 * arguments into a shell line.
 */
function runCommand(cmd, args, { timeoutMs, env } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { shell: false, env: env || process.env });
    } catch (err) {
      reject(err);
      return;
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, timeoutMs)
        : null;
    // Cap captured output so a chatty remote can't balloon memory.
    child.stdout.on("data", (d) => {
      if (stdout.length < 65536) stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (stderr.length < 65536) stderr += d.toString();
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      if (err && err.code === "ENOENT") {
        const tool = path.basename(cmd);
        reject(
          new Error(
            `${tool} not found — install the OpenSSH client (macOS/Linux: openssh-client; Windows: Optional Features → OpenSSH Client)`
          )
        );
        return;
      }
      reject(err);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${path.basename(cmd)} timed out after ${timeoutMs}ms`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

function formatTransferError(tool, { code, stderr }) {
  const detail = stripAnsi((stderr || "").trim() || `exit ${code}`).slice(0, 400);
  return new Error(`${tool} failed (exit ${code}): ${detail}`);
}

async function runSsh(source, remoteCmd, timeoutMs) {
  const args = [...(await sshOptionArgs(source)), source.host, remoteCmd];
  return runCommand(resolveSshBinary("ssh"), args, {
    timeoutMs,
    env: buildSshChildEnv(),
  });
}

async function runScpCopy(source, remoteSpec, dest, timeoutMs, { legacy = false, recursive } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const args = recursive ? ["-r"] : [];
  if (legacy) args.push("-O");
  args.push(...(await scpOptionArgs(source)), remoteSpec, dest);
  return runCommand(resolveSshBinary("scp"), args, {
    timeoutMs,
    env: buildSshChildEnv(),
  });
}

function isLegacyScpProtocolError(stderr) {
  const s = stripAnsi(stderr || "").toLowerCase();
  return (
    s.includes("sftp") ||
    s.includes("subsystem") ||
    s.includes("protocol error") ||
    s.includes("remote side closed")
  );
}

async function copyViaScp(source, remoteSpec, dest, timeoutMs, options = {}) {
  let scpResult = await runScpCopy(source, remoteSpec, dest, timeoutMs, options);
  if (scpResult.code !== 0 && isLegacyScpProtocolError(scpResult.stderr)) {
    scpResult = await runScpCopy(source, remoteSpec, dest, timeoutMs, {
      ...options,
      legacy: true,
    });
  }
  return scpResult;
}

function isMissingRemotePathResult(result) {
  const detail = stripAnsi((result?.stderr || "").trim()).toLowerCase();
  return detail.includes("no such file") || detail.includes("not found");
}

function missingHistoryError(source, provider) {
  const historyPath = remoteHistoryPath(source, provider);
  const homeField = provider === "codex" ? "remote_codex_home" : "remote_home";
  return new Error(
    `Remote ${providerName(provider)} history directory missing (${historyPath}). Install ${providerName(provider)} on the remote or set ${homeField}.`
  );
}

/**
 * Mirror one provider's history into `dest` via scp. Codex receives its
 * `sessions` tree plus the optional sibling `session_index.jsonl`, which holds
 * native `/rename` titles and contains no credentials.
 */
async function mirrorViaScp(source, dest, timeoutMs, provider = "claude") {
  assertProvider(provider);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  if (provider === "codex") {
    const sessionsDest = path.join(dest, "sessions");
    fs.mkdirSync(sessionsDest, { recursive: true });
    const sessions = await copyViaScp(
      source,
      scpRemoteSpec(source, "codex"),
      sessionsDest,
      timeoutMs,
      { recursive: true }
    );
    if (sessions.code !== 0) {
      if (isMissingRemotePathResult(sessions)) throw missingHistoryError(source, "codex");
      throw formatTransferError("scp", sessions);
    }

    // A remote may not have renamed any session yet, so a missing index is not
    // an import failure. Any other error stays non-blocking because rollouts are
    // authoritative, but the omitted title index is reported in the result.
    const home = normalizedRemoteHome(source, "codex").replace(/\/+$/, "");
    const titleIndex = await copyViaScp(
      source,
      `${source.host}:${home}/session_index.jsonl`,
      path.join(dest, "session_index.jsonl"),
      timeoutMs,
      { recursive: false }
    );
    return {
      titleIndexWarning:
        titleIndex.code === 0
          ? null
          : stripAnsi((titleIndex.stderr || "").trim()).slice(0, 400) ||
            "Codex title index was unavailable",
    };
  }

  const scpResult = await copyViaScp(source, scpRemoteSpec(source, "claude"), dest, timeoutMs, {
    recursive: true,
  });
  if (scpResult.code !== 0) {
    if (isMissingRemotePathResult(scpResult)) throw missingHistoryError(source, "claude");
    throw formatTransferError("scp", scpResult);
  }
  return { titleIndexWarning: null };
}

/**
 * Pull a WSL-hosted provider tree over SSH by streaming `tar` from `wsl.exe`.
 * Used when a provider runs inside WSL but SSH lands in Windows.
 */
function mirrorViaWslTar(source, wslHome, dest, timeoutMs, provider = "claude") {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  return new Promise((resolve, reject) => {
    let sshChild;
    let tarChild;
    let timedOut = false;
    let stderr = "";
    const remoteCmd = wslTarRemoteCmd(wslHome, provider);

    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            try {
              sshChild?.kill("SIGKILL");
            } catch {
              /* ignore */
            }
            try {
              tarChild?.kill("SIGKILL");
            } catch {
              /* ignore */
            }
          }, timeoutMs)
        : null;

    const fail = (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    };

    try {
      tarChild = spawn("tar", ["-xf", "-", "-C", dest], {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      fail(
        new Error(
          `tar not found — required to pull ${providerName(provider)} history from WSL over SSH (install tar or use a UNC remote home path)`
        )
      );
      return;
    }

    sshOptionArgs(source)
      .then((opts) => {
        const args = [...opts, source.host, remoteCmd];
        try {
          sshChild = spawn(resolveSshBinary("ssh"), args, {
            shell: false,
            env: buildSshChildEnv(),
            stdio: ["ignore", "pipe", "pipe"],
          });
        } catch (err) {
          try {
            tarChild.kill();
          } catch {
            /* ignore */
          }
          fail(err);
          return;
        }

        const onStderr = (d) => {
          if (stderr.length < 65536) stderr += d.toString();
        };
        sshChild.stderr.on("data", onStderr);
        tarChild.stderr.on("data", onStderr);
        sshChild.stdout.pipe(tarChild.stdin);

        let sshCode;
        let tarCode;
        let pending = 2;
        const done = () => {
          if (--pending > 0) return;
          if (timer) clearTimeout(timer);
          if (timedOut) {
            fail(new Error(`WSL transfer timed out after ${timeoutMs}ms`));
            return;
          }
          if (sshCode !== 0) {
            const detail = stripAnsi(stderr.trim()).toLowerCase();
            if (detail.includes("wsl") && detail.includes("not recognized")) {
              fail(
                new Error(
                  `WSL is not available on the remote Windows host — install WSL, SSH directly into the Linux distro, or set ${provider === "codex" ? "remote_codex_home" : "remote_home"} to a UNC path such as //wsl.localhost/Ubuntu/home/you/${provider === "codex" ? ".codex" : ".claude"}`
                )
              );
              return;
            }
            fail(formatTransferError("ssh", { code: sshCode, stderr }));
            return;
          }
          if (tarCode !== 0) {
            fail(
              new Error(
                `tar extract failed (exit ${tarCode}): ${stripAnsi(stderr).trim().slice(0, 400)}`
              )
            );
            return;
          }
          resolve({ titleIndexWarning: null });
        };

        sshChild.on("close", (code) => {
          sshCode = code;
          done();
        });
        tarChild.on("close", (code) => {
          tarCode = code;
          done();
        });
        sshChild.on("error", fail);
        tarChild.on("error", fail);
      })
      .catch(fail);
  });
}

/**
 * Mirror one remote provider tree into `dest`. Uses scp for native paths; when
 * its remote home is `wsl:…` or the default home is missing on Windows but
 * present in WSL, streams a tar archive from `wsl.exe` instead.
 */
async function mirrorRemoteTree(source, dest, timeoutMs, provider = "claude") {
  const home = normalizedRemoteHome(source, provider);
  if (isWslRemoteHome(home)) {
    return mirrorViaWslTar(source, home.slice(4), dest, timeoutMs, provider);
  }

  try {
    return await mirrorViaScp(source, dest, timeoutMs, provider);
  } catch (err) {
    if (
      shouldTryWslFallback(source, err, provider) &&
      (await wslPathExists(source, providerDefaultHome(provider), TEST_TIMEOUT_MS, provider))
    ) {
      return mirrorViaWslTar(source, providerDefaultHome(provider), dest, timeoutMs, provider);
    }
    throw err;
  }
}

// ── Public operations ─────────────────────────────────────────────────────────

/**
 * User-facing copy after a successful provider-history probe.
 * Distinguishes explicit `wsl:` homes from auto-detected WSL fallback.
 */
function connectionSuccessMessage(source, remoteCmd, provider = "claude") {
  const home = normalizedRemoteHome(source, provider);
  const name = providerName(provider);
  if (isWslRemoteHome(home)) {
    return `Connected. ${name} history found in WSL (${home}).`;
  }
  if (remoteCmd.includes("wsl.exe")) {
    return `Connected. ${name} history found in WSL (auto-detected). Set ${provider === "codex" ? "remote Codex home" : "remote Claude home"} to wsl:${providerDefaultHome(provider)} to sync WSL instead of Windows.`;
  }
  return `Connected. Remote ${name} history found.`;
}

/**
 * Best-effort "last activity" for a mirrored transcript. Prefer the newest
 * event timestamp inside the JSONL over filesystem mtime so a touched-but-stale
 * seed file (or scp preserving an old tree) does not look still-running.
 */
function lastTranscriptActivityMs(filePath) {
  let mtimeMs = null;
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }

  let contentMs = null;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.trim().split(/\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(lines[i]);
        const raw = row.timestamp || row.ts;
        if (!raw) continue;
        const ms = new Date(raw).getTime();
        if (!Number.isNaN(ms)) {
          contentMs = ms;
          break;
        }
      } catch {
        /* skip malformed tail line */
      }
    }
  } catch {
    /* unreadable — fall back to mtime */
  }

  if (contentMs != null) return contentMs;
  return mtimeMs;
}

/**
 * Probe one provider's remote history after SSH authentication succeeds.
 */
async function testProviderConnection(source, provider) {
  const remoteHistory = remoteHistoryPath(source, provider);
  const probes = connectionProbeCommands(source, provider);
  let lastMessage = "";
  let unavailableMessage = "";

  for (const remoteCmd of probes) {
    const { code, stdout, stderr } = await runSsh(source, remoteCmd, TEST_TIMEOUT_MS);
    const out = stripAnsi(stdout);
    if (out.includes("CCAM_OK")) {
      return {
        status: "ok",
        message: connectionSuccessMessage(source, remoteCmd, provider),
        path: remoteHistory,
      };
    }
    if (out.includes("CCAM_NO_DIR")) {
      // A default home can be checked through several remote shells: POSIX,
      // PowerShell, and WSL. A missing path in the first shell is not decisive
      // (for example, Windows SSH often reaches a WSL-hosted CLI), so let each
      // compatible probe run before declaring this provider unavailable.
      unavailableMessage = `${remoteHistory} does not exist on the remote.`;
      continue;
    }
    lastMessage = stripAnsi(stderr.trim() || `ssh exited with code ${code}`).slice(0, 500);
  }

  return {
    status: unavailableMessage ? "unavailable" : "error",
    message:
      unavailableMessage ||
      lastMessage ||
      `Remote ${providerName(provider)} history could not be verified.`,
    path: remoteHistory,
  };
}

/**
 * Probe a source: authenticate once, then check both provider homes. A machine
 * can legitimately use only one CLI, so one available provider is a successful
 * source test while the structured provider results make the other absence clear.
 */
async function testConnection(source) {
  const remoteProjects = remoteProjectsPath(source);
  const remoteCodexSessions = remoteCodexSessionsPath(source);

  try {
    const auth = await runSsh(source, "echo CCAM_AUTH", TEST_TIMEOUT_MS);
    const authOut = stripAnsi(auth.stdout);
    if (auth.code !== 0 || !authOut.includes("CCAM_AUTH")) {
      const msg = stripAnsi(auth.stderr.trim() || `ssh exited with code ${auth.code}`).slice(
        0,
        500
      );
      return {
        ok: false,
        message: msg || "SSH authentication failed.",
        remoteProjects,
        remoteCodexSessions,
        providers: Object.fromEntries(
          REMOTE_PROVIDERS.map((provider) => [
            provider,
            {
              status: "error",
              message: msg || "SSH authentication failed.",
              path: remoteHistoryPath(source, provider),
            },
          ])
        ),
      };
    }

    const providers = {};
    for (const provider of REMOTE_PROVIDERS) {
      providers[provider] = await testProviderConnection(source, provider);
    }
    const available = REMOTE_PROVIDERS.filter((provider) => providers[provider].status === "ok");
    return {
      ok: available.length > 0,
      message:
        available.length > 0
          ? `Connected. ${available.map(providerName).join(" and ")} history available.`
          : "SSH connected, but neither Claude Code nor Codex history could be found.",
      remoteProjects,
      remoteCodexSessions,
      providers,
    };
  } catch (err) {
    const message = stripAnsi(err.message).slice(0, 500);
    return {
      ok: false,
      message,
      remoteProjects,
      remoteCodexSessions,
      providers: Object.fromEntries(
        REMOTE_PROVIDERS.map((provider) => [
          provider,
          { status: "error", message, path: remoteHistoryPath(source, provider) },
        ])
      ),
    };
  }
}

/**
 * Session ids present in a mirrored provider staging tree. Claude Code session
 * files live at `<projects>/<encoded-cwd>/<sessionId>.jsonl`; Codex rollouts
 * encode the native thread UUID and use the same resolver as its importer.
 */
function stagedSessionIds(dir, provider = "claude") {
  assertProvider(provider);
  const ids = new Set();
  if (provider === "codex") {
    for (const file of findCodexTranscripts(dir)) {
      const id = getCodexTranscriptSessionId(file);
      if (id) ids.add(id);
    }
    return [...ids];
  }
  for (const f of collectJsonlFiles(dir)) {
    const base = path.basename(f, ".jsonl");
    if (base.startsWith("agent-")) continue;
    if (path.basename(path.dirname(f)) === "subagents") continue;
    ids.add(base);
  }
  return [...ids];
}

/**
 * Reconcile the live status of a source's sessions from its mirrored transcripts.
 *
 * Remote sessions get NO live hooks and are excluded from every local liveness /
 * staleness heuristic (the process probe, the watchdog transcript scan, the
 * startup + periodic stale sweeps — all gated on `source = 'local'`). The scp
 * mirror is therefore the single source of truth for whether a remote session is
 * still running: a transcript file touched within REMOTE_ACTIVE_WINDOW_MS means
 * the remote CLI is still writing to it (⇒ active); once it stops advancing the
 * session has ended (⇒ completed). The shared importer only sets status when it
 * FIRST inserts a session, so this pass is what keeps an already-imported remote
 * session's status correct on every subsequent sync (and self-heals any session
 * a pre-fix build wrongly completed).
 *
 * @param {object} dbModule require("../db")
 * @param {object} source remote_sources row (needs `id`)
 * @param {string} dest staging dir mirrored for this source
 * @param {Function} [broadcast] websocket broadcaster
 */
function reconcileRemoteSessionStatus(dbModule, source, dest, broadcast, provider = "claude") {
  const { stmts } = dbModule;
  const now = Date.now();

  // Newest transcript activity per top-level session id (content timestamp preferred
  // over mirror mtime — see lastTranscriptActivityMs).
  const mtimeById = new Map();
  const files = provider === "codex" ? findCodexTranscripts(dest) : collectJsonlFiles(dest);
  for (const f of files) {
    const base = provider === "codex" ? getCodexTranscriptSessionId(f) : path.basename(f, ".jsonl");
    if (!base) continue;
    if (provider === "claude" && base.startsWith("agent-")) continue;
    if (provider === "claude" && path.basename(path.dirname(f)) === "subagents") continue;
    const activityMs = lastTranscriptActivityMs(f);
    if (activityMs == null) continue;
    if (!mtimeById.has(base) || activityMs > mtimeById.get(base)) mtimeById.set(base, activityMs);
  }

  for (const [id, mtimeMs] of mtimeById) {
    const sess = stmts.getSession.get(id);
    // Only touch sessions this source actually owns — never reinterpret a local
    // (or other-source) row that happens to share an id.
    if (!sess || sess.source !== source.id || sess.provider !== provider) continue;
    const active = now - mtimeMs < REMOTE_ACTIVE_WINDOW_MS;

    if (active && sess.status !== "active") {
      // Heal a session the mirror shows is still running. Mirror the importer's
      // fresh-import shape: session active, main agent back to waiting (we can't
      // know from a mirror whether it's mid-turn; waiting matches import).
      stmts.reactivateSession.run(id);
      const main = dbModule.db
        .prepare("SELECT * FROM agents WHERE session_id = ? AND type = 'main' LIMIT 1")
        .get(id);
      if (main && main.status !== "working" && main.status !== "waiting") {
        stmts.updateAgent.run(null, "waiting", null, null, null, null, main.id);
      }
      if (broadcast) {
        broadcast("session_updated", stmts.getSession.get(id));
        const refreshed = main ? stmts.getAgent.get(main.id) : null;
        if (refreshed) broadcast("agent_updated", refreshed);
      }
    } else if (!active && sess.status === "active") {
      // Mirror stopped advancing ⇒ the remote session ended. Land it in the same
      // terminal state a real SessionEnd produces (agents completed, ended_at
      // stamped). Leave error/completed/abandoned rows untouched.
      const ts = new Date().toISOString();
      stmts.updateSession.run(null, "completed", ts, null, id);
      const agents = stmts.listAgentsBySession.all(id);
      for (const a of agents) {
        if (a.status !== "completed" && a.status !== "error") {
          stmts.updateAgent.run(null, "completed", null, null, ts, null, a.id);
        }
      }
      if (broadcast) {
        broadcast("session_updated", stmts.getSession.get(id));
        for (const a of agents) {
          const refreshed = stmts.getAgent.get(a.id);
          if (refreshed) broadcast("agent_updated", refreshed);
        }
      }
    }
  }
}

/**
 * Sync one source: mirror its remote history, import it, tag the imported
 * sessions with the source id, and record status. Returns import counters.
 * Guarded against concurrent runs of the same source.
 *
 * @param {object} dbModule require("../db")
 * @param {object} source remote_sources row
 * @param {{onProgress?:Function, broadcast?:Function}} [opts]
 */
function isUnavailableHistoryError(err) {
  return /history directory missing|does not exist on the remote/i.test(
    String(err?.message || err || "")
  );
}

function summarizeProviderCounters(counters, ids, mirror) {
  return {
    imported: counters.imported || 0,
    skipped: counters.skipped || 0,
    backfilled: counters.backfilled || 0,
    errors: counters.errors || 0,
    sessions_seen: counters.sessionsSeen || 0,
    sessions_tagged: ids.length,
    ...(mirror?.titleIndexWarning ? { title_index_warning: mirror.titleIndexWarning } : {}),
  };
}

async function ingestStagedProvider(dbModule, source, provider, dest, opts = {}) {
  const { stmts } = dbModule;
  const preExisting = new Set();
  try {
    for (const id of stagedSessionIds(dest, provider)) {
      if (stmts.getSession.get(id)) preExisting.add(id);
    }
  } catch {
    /* staging dir may not exist yet */
  }

  const onProgress =
    typeof opts.onProgress === "function"
      ? (progress) => opts.onProgress({ ...progress, provider, source: "remote" })
      : undefined;
  const counters =
    provider === "codex"
      ? await importCodexFromDirectory(dest, { onProgress, retainLivePath: false })
      : await importFromDirectory(dbModule, dest, { onProgress });

  const ids = stagedSessionIds(dest, provider);
  const tag = dbModule.db.transaction((sessionIds) => {
    for (const id of sessionIds) stmts.setSessionSource.run(source.id, id);
  });
  tag(ids);

  try {
    reconcileRemoteSessionStatus(dbModule, source, dest, opts.broadcast, provider);
  } catch {
    /* Status reconciliation must never turn a valid transcript import into a failure. */
  }

  return {
    provider,
    status: "ok",
    counters: summarizeProviderCounters(counters, ids, opts.mirror),
    ids,
    preExisting,
  };
}

/** Mirror a provider's remote tree, then ingest the resulting isolated stage. */
async function importMirroredProvider(dbModule, source, provider, opts = {}) {
  const dest = stagingDir(source.id, provider);
  const mirror = await mirrorRemoteTree(source, dest, SYNC_TIMEOUT_MS, provider);
  return ingestStagedProvider(dbModule, source, provider, dest, { ...opts, mirror });
}

function sumProviderResults(results) {
  const totals = {
    imported: 0,
    skipped: 0,
    backfilled: 0,
    errors: 0,
    sessions_seen: 0,
    sessions_tagged: 0,
    providers: {},
  };
  for (const provider of REMOTE_PROVIDERS) {
    const result = results[provider];
    if (!result) continue;
    if (result.status === "ok") {
      Object.assign(totals.providers, {
        [provider]: { status: "ok", ...result.counters },
      });
      for (const key of [
        "imported",
        "skipped",
        "backfilled",
        "errors",
        "sessions_seen",
        "sessions_tagged",
      ]) {
        totals[key] += result.counters[key] || 0;
      }
    } else {
      Object.assign(totals.providers, {
        [provider]: { status: result.status, error: result.error },
      });
    }
  }
  return totals;
}

/**
 * Sync both provider histories for one source. A source can have only Claude
 * Code or only Codex installed; successful discovery of either is therefore a
 * healthy sync, while each provider's durable status keeps lifecycle fallback
 * correct for data from the unavailable half.
 */
async function syncSource(dbModule, source, opts = {}) {
  const { stmts } = dbModule;
  const { onProgress, broadcast } = opts;
  if (inFlight.has(source.id)) return { skipped: true, reason: "already-syncing" };
  inFlight.add(source.id);

  const emitStatus = (status, error, providerStates = null, extra = {}) => {
    try {
      if (providerStates) {
        stmts.setRemoteSourceProviderStatus.run(
          status,
          error || null,
          providerStates.claude || null,
          providerStates.codex || null,
          source.id
        );
      } else {
        stmts.setRemoteSourceStatus.run(status, error || null, source.id);
      }
    } catch {
      /* Remote state reporting must never block a future sync retry. */
    }
    if (broadcast) {
      broadcast("remote_source.status", {
        id: source.id,
        status,
        error: error || null,
        ...(providerStates ? { providers: providerStates } : {}),
        ...extra,
      });
    }
  };

  const results = {};
  const providerStates = { claude: "syncing", codex: "syncing" };
  try {
    emitStatus("syncing", null, providerStates);

    for (const provider of REMOTE_PROVIDERS) {
      try {
        results[provider] = await importMirroredProvider(dbModule, source, provider, {
          onProgress,
          broadcast,
        });
        providerStates[provider] = "ok";
      } catch (err) {
        const error = (err?.message || String(err)).slice(0, 500);
        const status = isUnavailableHistoryError(err) ? "unavailable" : "error";
        results[provider] = { provider, status, error, ids: [], preExisting: new Set() };
        providerStates[provider] = status;
      }
    }

    const successful = REMOTE_PROVIDERS.filter((provider) => results[provider]?.status === "ok");
    const result = sumProviderResults(results);
    if (successful.length === 0) {
      const detail = REMOTE_PROVIDERS.map(
        (provider) => `${providerName(provider)}: ${results[provider]?.error || "unavailable"}`
      ).join(" | ");
      throw new Error(detail);
    }

    const now = new Date().toISOString();
    try {
      stmts.setRemoteSourceSyncResult.run(
        "ok",
        null,
        now,
        JSON.stringify(result),
        providerStates.claude,
        providerStates.codex,
        source.id
      );
    } catch {
      /* A valid import stays valid even if status persistence is temporarily unavailable. */
    }

    emitStatus("ok", null, providerStates, { last_sync_at: now });
    if (broadcast) {
      const changed = new Map();
      for (const provider of successful) {
        for (const id of results[provider].ids) {
          changed.set(id, results[provider].preExisting.has(id));
        }
      }
      for (const [id, existed] of changed) {
        const row = stmts.getSession.get(id);
        if (!row) continue;
        broadcast(existed ? "session_updated" : "session_created", row);
        try {
          const mainAgent = dbModule.db
            .prepare("SELECT * FROM agents WHERE session_id = ? AND type = 'main' LIMIT 1")
            .get(id);
          if (mainAgent) broadcast(existed ? "agent_updated" : "agent_created", mainAgent);
        } catch {
          /* Best-effort UI fast path; `remote_data.updated` still causes a refetch. */
        }
      }
      broadcast("import.progress", {
        importId: `remote-${source.id}`,
        phase: "complete",
        source: "remote",
        counters: result,
      });
      broadcast("remote_data.updated", {
        sourceId: source.id,
        source: source.id,
        label: source.label,
        counters: result,
        providers: providerStates,
        last_sync_at: now,
      });
    }
    return result;
  } catch (err) {
    const message = (err?.message || String(err)).slice(0, 500);
    for (const provider of REMOTE_PROVIDERS) {
      if (providerStates[provider] === "syncing") providerStates[provider] = "error";
    }
    emitStatus("error", message, providerStates);
    throw err;
  } finally {
    inFlight.delete(source.id);
  }
}

/**
 * Sync every enabled source sequentially (one SSH connection at a time — avoids
 * a connection storm on the local box and on any shared bastion). Per-source
 * failures are isolated: one bad source never aborts the rest. Returns a
 * per-source summary array.
 */
async function syncAllEnabled(dbModule, opts = {}) {
  const sources = dbModule.stmts.listEnabledRemoteSources.all();
  const results = [];
  for (const source of sources) {
    try {
      const r = await syncSource(dbModule, source, opts);
      results.push({ id: source.id, ok: true, ...r });
    } catch (err) {
      results.push({ id: source.id, ok: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  validateSourceInput,
  ValidationError,
  testConnection,
  syncSource,
  syncAllEnabled,
  importMirroredProvider,
  ingestStagedProvider,
  normalizedRemoteHome,
  remoteHistoryPath,
  remoteCodexSessionsPath,
  wslProjectsPathFromHome,
  wslHistoryPathFromHome,
  isWslRemoteHome,
  allowsWslAutoFallback,
  wslTarRemoteCmd,
  wslPathExists,
  mirrorViaWslTar,
  mirrorViaScp,
  mirrorRemoteTree,
  stagingDir,
  remoteProjectsPath,
  stagedSessionIds,
  reconcileRemoteSessionStatus,
  // exported for tests
  sshOptionArgs,
  scpOptionArgs,
  connectionProbeCommands,
  connectionSuccessMessage,
  testProviderConnection,
  lastTranscriptActivityMs,
  stripAnsi,
  resolveSshBinary,
  buildSshChildEnv,
  expandSshConfigPath,
  identityAgentArgsFromConfig,
  sshConfigFileArgs,
  scpRemoteSpec,
  providerDefaultHome,
  providerHistorySegment,
  parseSshGOutput,
  isLegacyScpProtocolError,
  HOST_RE,
  REMOTE_PATH_RE,
};
