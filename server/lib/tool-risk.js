/**
 * @file Tool Risk Audit classifier. A pure, declarative ruleset that turns one
 * stored tool event (tool name + hook payload) into zero or more risk signals:
 * privilege escalation, destructive commands, remote code execution,
 * credential access, network egress, and file writes outside the session's
 * working directory. Every signal carries a severity and the exact substring
 * that triggered it so the UI can show *why* a row was flagged. Read-only:
 * nothing here blocks or alters tool execution.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const path = require("path");

/** Bump whenever a rule changes so the derived audit index is rebuilt. */
const RULESET_VERSION = 1;

const SIGNALS = Object.freeze([
  "privilege",
  "destructive",
  "remote-exec",
  "credential-access",
  "egress",
  "outside-cwd",
]);

const SEVERITIES = Object.freeze(["low", "medium", "high", "critical"]);
const SEVERITY_RANK = Object.freeze({ low: 1, medium: 2, high: 3, critical: 4 });

/** Tools whose input is a shell command line. */
const COMMAND_TOOLS = new Set([
  "bash",
  "powershell",
  "shell",
  "local_shell",
  "exec_command",
  "run_command",
  "run_terminal_cmd",
]);
/** Tools that write or modify a file at `file_path` / `notebook_path`. */
const WRITE_TOOLS = new Set([
  "write",
  "edit",
  "multiedit",
  "notebookedit",
  "write_to_file",
  "replace_file_content",
  "multi_replace_file_content",
]);
/** Tools that read a file. */
const READ_TOOLS = new Set(["read", "view_file", "notebookread"]);
/** Tools that reach the network by URL or query. */
const FETCH_TOOLS = new Set(["webfetch", "websearch", "read_url_content", "web_search"]);

/**
 * Command-line rules. `pattern` is matched case-insensitively against the full
 * command; the matched text becomes the signal's `match`.
 */
const COMMAND_RULES = Object.freeze([
  // privilege
  { id: "sudo", signal: "privilege", severity: "high", pattern: /\bsudo\b(?:\s+-\S+)*\s+\S+/ },
  { id: "doas", signal: "privilege", severity: "high", pattern: /\bdoas\s+\S+/ },
  {
    id: "chmod-777",
    signal: "privilege",
    severity: "medium",
    pattern: /\bchmod\s+(?:-\S+\s+)*0?777\b/,
  },
  {
    id: "chown-root",
    signal: "privilege",
    severity: "high",
    pattern: /\bchown\s+(?:-\S+\s+)*root\b/,
  },
  {
    id: "runas",
    signal: "privilege",
    severity: "high",
    pattern: /\bstart-process\b[^\n|;]*-verb\s+runas\b/,
  },
  // destructive
  {
    id: "rm-rf",
    signal: "destructive",
    severity: "high",
    pattern:
      /\brm\s+(?:-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|(?:-r|-R|--recursive)\s+(?:-f|--force)|(?:-f|--force)\s+(?:-r|-R|--recursive))\b/,
  },
  {
    id: "remove-item-recurse",
    signal: "destructive",
    severity: "high",
    pattern: /\bremove-item\b[^\n|;]*-recurse\b[^\n|;]*/,
  },
  {
    id: "git-reset-hard",
    signal: "destructive",
    severity: "medium",
    pattern: /\bgit\s+reset\s+(?:\S+\s+)*--hard\b/,
  },
  {
    id: "git-push-force",
    signal: "destructive",
    severity: "high",
    pattern: /\bgit\s+push\b[^\n|;&]*\s(?:--force(?!-with-lease)\b|-f\b)/,
  },
  { id: "git-clean", signal: "destructive", severity: "medium", pattern: /\bgit\s+clean\s+-\S*f/ },
  {
    id: "sql-drop",
    signal: "destructive",
    severity: "high",
    pattern: /\bdrop\s+(?:table|database|schema)\b/,
  },
  { id: "sql-truncate", signal: "destructive", severity: "high", pattern: /\btruncate\s+table\b/ },
  { id: "truncate-file", signal: "destructive", severity: "medium", pattern: /\btruncate\s+-s\b/ },
  {
    id: "disk-wipe",
    signal: "destructive",
    severity: "critical",
    pattern: /\b(?:mkfs(?:\.\w+)?\s+\S+|dd\s+[^\n|;]*of=\/dev\/\S+)/,
  },
  // remote-exec
  {
    id: "pipe-to-shell",
    signal: "remote-exec",
    severity: "critical",
    pattern:
      /\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n;]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|ksh|dash|python3?|node|perl|ruby|iex|invoke-expression)\b/,
  },
  {
    id: "process-substitution",
    signal: "remote-exec",
    severity: "critical",
    pattern: /\b(?:bash|sh|zsh)\s+<\(\s*(?:curl|wget)\b[^)]*\)/,
  },
  {
    id: "iex-download",
    signal: "remote-exec",
    severity: "critical",
    pattern:
      /\b(?:iex|invoke-expression)\b\s*\(?\s*(?:\(\s*)?(?:iwr|irm|invoke-webrequest|invoke-restmethod|new-object\s+net\.webclient)\b/,
  },
]);

/**
 * `npx <pkg>` without an exact version runs whatever the registry serves today.
 * Handled in code (not a single regex) so `npx pkg@1.2.3` and local bins pass.
 */
const NPX_RE = /\b(?:npx|pnpm\s+dlx|bunx|yarn\s+dlx)\s+((?:-{1,2}[\w-]+(?:=\S+)?\s+)*)([^\s|;&]+)/g;

/** Path fragments that hold credentials or secrets. */
const CREDENTIAL_RULES = Object.freeze([
  { id: "ssh-dir", severity: "high", pattern: /(?:^|[\\/])\.ssh(?:[\\/]|$)/ },
  { id: "aws-dir", severity: "high", pattern: /(?:^|[\\/])\.aws(?:[\\/]|$)/ },
  { id: "private-key", severity: "high", pattern: /\bid_(?:rsa|dsa|ecdsa|ed25519)\b(?!\.pub\b)/ },
  { id: "pem", severity: "high", pattern: /[\w-]+\.(?:pem|key|p12|pfx)\b/ },
  { id: "credentials-file", severity: "high", pattern: /[\w.-]*credentials[\w.-]*/ },
  { id: "netrc", severity: "high", pattern: /(?:^|[\\/\s])\.netrc\b/ },
  {
    id: "dotenv",
    severity: "medium",
    pattern: /(?:^|[\\/\s"'=])\.env(?:\.[\w-]+)?(?=$|[\s"'\\/;|&)])/,
  },
]);

/** Network-capable command-line tools (egress, low severity). */
const NETWORK_COMMAND_RE =
  /\b(?:curl|wget|nc|ncat|netcat|ssh|scp|sftp|rsync|ftp|telnet|iwr|irm|invoke-webrequest|invoke-restmethod)\b/;
const URL_RE = /\bhttps?:\/\/[^\s"'<>|;)]+/gi;
const SCP_HOST_RE =
  /\b(?:ssh|scp|sftp|rsync)\b[^\n|;]*?\s(?:[\w.-]+@)?([a-z0-9][\w.-]*\.[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3}):/i;

/** Write targets that are sensitive even when inside nothing in particular. */
const SENSITIVE_WRITE_RE =
  /(?:[\\/]\.claude[\\/]settings(?:\.local)?\.json$|^\/etc\/|^\/usr\/|^\/bin\/|^\/sbin\/|^\/System\/|^[a-z]:[\\/]windows[\\/]|^[a-z]:[\\/]program files)/i;

/** Hosts that are local and therefore not egress. */
const LOCAL_HOST_RE = /^(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?)$/i;

function normalizeToolName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function asText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(" ");
  return "";
}

/** Pull the shell command, file path(s), and URL/query out of a tool input. */
function extractTargets(toolName, input) {
  const tool = normalizeToolName(toolName);
  const inp = input && typeof input === "object" ? input : {};
  const out = { command: "", paths: [], url: "", query: "" };
  if (COMMAND_TOOLS.has(tool)) {
    out.command = asText(inp.command ?? inp.cmd ?? inp.CommandLine ?? inp.commandLine);
  }
  for (const key of ["file_path", "notebook_path", "path", "TargetFile", "AbsolutePath"]) {
    if (typeof inp[key] === "string" && inp[key].trim()) out.paths.push(inp[key].trim());
  }
  if (FETCH_TOOLS.has(tool)) {
    out.url = asText(inp.url ?? inp.Url ?? "");
    out.query = asText(inp.query ?? inp.Query ?? "");
  }
  return out;
}

function hostOf(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function isWindowsPath(p) {
  return /^[a-z]:[\\/]/i.test(p) || p.startsWith("\\\\");
}

/** Expand `~` against the home directory implied by cwd, when one is visible. */
function expandHome(p, cwd) {
  if (!p.startsWith("~")) return p;
  const m = /^(\/(?:home|Users)\/[^/]+|\/root|[a-z]:[\\/]Users[\\/][^\\/]+)/i.exec(cwd || "");
  return m ? m[1] + p.slice(1) : p;
}

/**
 * True when `target` resolves outside `cwd`. Returns null when either side is
 * unknown or the two use different path flavours, so nothing is guessed.
 */
function isOutsideCwd(target, cwd) {
  if (!target || !cwd) return null;
  const win = isWindowsPath(cwd);
  const expanded = expandHome(target, cwd);
  if (expanded.startsWith("~")) return null; // home not derivable from cwd
  // A POSIX absolute target under a Windows cwd (or vice versa) cannot be compared.
  if (win ? expanded.startsWith("/") : isWindowsPath(expanded)) return null;
  const lib = win ? path.win32 : path.posix;
  const base = lib.resolve(cwd);
  const resolved = lib.resolve(base, expanded);
  const rel = lib.relative(
    win ? base.toLowerCase() : base,
    win ? resolved.toLowerCase() : resolved
  );
  return rel === ".." || rel.startsWith(`..${lib.sep}`) || lib.isAbsolute(rel);
}

function pushSignal(out, seen, signal) {
  const key = `${signal.signal}|${signal.rule}|${signal.match}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(signal);
}

function classifyCommand(command, out, seen) {
  if (!command) return;
  const lower = command.toLowerCase();
  for (const rule of COMMAND_RULES) {
    const m = rule.pattern.exec(lower);
    if (m) {
      pushSignal(out, seen, {
        signal: rule.signal,
        severity: rule.severity,
        rule: rule.id,
        match: command.substr(m.index, m[0].length).trim(),
      });
    }
  }
  NPX_RE.lastIndex = 0;
  let m;
  while ((m = NPX_RE.exec(command)) !== null) {
    const pkg = m[2];
    if (pkg.startsWith(".") || pkg.startsWith("/") || pkg.startsWith("-")) continue;
    const at = pkg.lastIndexOf("@");
    const version = at > 0 ? pkg.slice(at + 1) : "";
    if (/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) continue;
    pushSignal(out, seen, {
      signal: "remote-exec",
      severity: "medium",
      rule: "npx-unpinned",
      match: m[0].trim(),
    });
  }
  for (const rule of CREDENTIAL_RULES) {
    const cm = rule.pattern.exec(command);
    if (cm) {
      pushSignal(out, seen, {
        signal: "credential-access",
        severity: rule.severity,
        rule: rule.id,
        match: cm[0].trim(),
      });
    }
  }
  if (NETWORK_COMMAND_RE.test(lower)) {
    const hosts = new Set();
    for (const url of command.match(URL_RE) || []) {
      const host = hostOf(url);
      if (host && !LOCAL_HOST_RE.test(host)) hosts.add(host);
    }
    const scp = SCP_HOST_RE.exec(command);
    if (scp && !LOCAL_HOST_RE.test(scp[1])) hosts.add(scp[1].toLowerCase());
    for (const host of hosts) {
      pushSignal(out, seen, {
        signal: "egress",
        severity: "low",
        rule: "network-command",
        match: host,
        host,
      });
    }
  }
}

function classifyPath(filePath, tool, cwd, out, seen) {
  for (const rule of CREDENTIAL_RULES) {
    const m = rule.pattern.exec(filePath);
    if (m) {
      pushSignal(out, seen, {
        signal: "credential-access",
        severity: rule.severity,
        rule: rule.id,
        match: m[0].replace(/^[\\/\s"'=]/, ""),
      });
    }
  }
  if (!WRITE_TOOLS.has(tool)) return;
  const sensitive = SENSITIVE_WRITE_RE.test(expandHome(filePath, cwd));
  const outside = isOutsideCwd(filePath, cwd);
  if (outside || sensitive) {
    pushSignal(out, seen, {
      signal: "outside-cwd",
      severity: sensitive ? "high" : "medium",
      rule: sensitive ? "sensitive-path-write" : "write-outside-cwd",
      match: filePath,
    });
  }
}

/**
 * Classify one tool event.
 * @param {{tool_name?: string, summary?: string, data?: object|string|null}} event
 * @returns {{signals: Array<{signal:string,severity:string,rule:string,match:string,host?:string}>,
 *   target: string, degraded: boolean}}
 *   `target` is the command/path/URL the signals were derived from; `degraded`
 *   is true when no tool input was stored and only name/summary were checked.
 */
function classifyToolEvent(event) {
  const tool = normalizeToolName(event?.tool_name);
  let data = event?.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  const input = data && typeof data === "object" ? data.tool_input : null;
  const cwd = data && typeof data.cwd === "string" ? data.cwd : event?.cwd || "";
  const out = [];
  const seen = new Set();

  if (!input || typeof input !== "object") {
    // Payload missing or redacted: fall back to what the summary still says.
    const summary = typeof event?.summary === "string" ? event.summary : "";
    if (COMMAND_TOOLS.has(tool)) classifyCommand(summary, out, seen);
    return { signals: out, target: summary, degraded: true };
  }

  const targets = extractTargets(tool, input);
  classifyCommand(targets.command, out, seen);
  for (const p of targets.paths) classifyPath(p, tool, cwd, out, seen);
  if (targets.url) {
    const host = hostOf(targets.url);
    if (host && !LOCAL_HOST_RE.test(host)) {
      pushSignal(out, seen, {
        signal: "egress",
        severity: "low",
        rule: "web-fetch",
        match: host,
        host,
      });
    }
  } else if (targets.query) {
    pushSignal(out, seen, {
      signal: "egress",
      severity: "low",
      rule: "web-search",
      match: targets.query.slice(0, 200),
      host: "web-search",
    });
  }
  const target = targets.command || targets.paths[0] || targets.url || targets.query || "";
  return { signals: out, target, degraded: false };
}

/** Highest severity among signals, or null. */
function maxSeverity(signals) {
  let best = null;
  for (const s of signals) {
    if (!best || SEVERITY_RANK[s.severity] > SEVERITY_RANK[best]) best = s.severity;
  }
  return best;
}

module.exports = {
  RULESET_VERSION,
  SIGNALS,
  SEVERITIES,
  SEVERITY_RANK,
  COMMAND_RULES,
  CREDENTIAL_RULES,
  classifyToolEvent,
  isOutsideCwd,
  maxSeverity,
};
