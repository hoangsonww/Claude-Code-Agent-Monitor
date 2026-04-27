/**
 * @file Sidebar provider for Claude Code Agent Monitor VSCode extension
 * Renders a rich, real-time WebviewView showing backend status, live agent
 * health, usage analytics, recent sessions, and quick navigation.
 *
 * Replaces the previous flat TreeDataProvider with a styled WebviewView that
 * pushes JSON snapshots from background polling and receives action messages
 * (open dashboard, open session, refresh, browser, clear history) back from
 * the webview UI.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const vscode = require("vscode");
const http = require("http");

const POLL_INTERVAL_MS = 5000;
const SPARK_HISTORY = 20;

class DashboardWebviewProvider {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.view = null;
    this.status = "Offline";
    this.data = {};
    this.history = {
      sessions: [],
      agents: [],
      tokens: [],
      cost: [],
    };
    this._pollHandle = null;
    this._fetching = null;
  }

  log(msg) {
    if (this.output) {
      try {
        this.output.appendLine("[" + new Date().toISOString() + "] " + msg);
      } catch (_) {}
    }
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [],
    };
    view.webview.html = this.getHtml();

    view.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    view.onDidChangeVisibility(() => {
      if (this.view && this.view.visible) this.refresh();
    });
    view.onDidDispose(() => {
      this.view = null;
      if (this._pollHandle) clearInterval(this._pollHandle);
      this._pollHandle = null;
    });

    this.refresh();
    if (!this._pollHandle) {
      this._pollHandle = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
    }
  }

  refresh() {
    return this.fetchAll()
      .then(() => {
        try {
          this.pushSnapshot();
        } catch (e) {
          this.log("pushSnapshot threw: " + e.message);
        }
      })
      .catch((e) => this.log("refresh threw: " + e.message));
  }

  handleMessage(msg) {
    if (!msg || !msg.command) return;
    switch (msg.command) {
      case "openDashboard":
        vscode.commands.executeCommand("claude-code-agent-monitor.openDashboard", msg.target || "");
        break;
      case "openInBrowser":
        vscode.commands.executeCommand("claude-code-agent-monitor.openInBrowser");
        break;
      case "refresh":
        vscode.commands.executeCommand("claude-code-agent-monitor.refreshStatus");
        break;
      case "clearHistory":
        vscode.commands.executeCommand("claude-code-agent-monitor.clearHistory");
        break;
      case "ready":
        this.log("webview READY");
        this.refresh();
        break;
      case "log":
        this.log("[webview] " + msg.text);
        break;
      case "error":
        this.log("[webview ERROR] " + msg.text);
        break;
    }
  }

  pushSnapshot() {
    if (!this.view) {
      this.log("pushSnapshot skipped: view is null");
      return;
    }
    const d = this.data || {};
    const t = (d.analytics && d.analytics.tokens) || {};
    const totalTokens =
      (t.total_input || 0) +
      (t.total_output || 0) +
      (t.total_cache_read || 0) +
      (t.total_cache_write || 0);

    const snapshot = {
      status: this.status,
      port: d.port || null,
      stats: {
        ws: (d.stats && d.stats.ws_connections) || 0,
        sessions: (d.stats && d.stats.total_sessions) || 0,
        events: (d.stats && d.stats.total_events) || 0,
        agents_total:
          (d.stats &&
            d.stats.agents_by_status &&
            Object.values(d.stats.agents_by_status).reduce((a, b) => a + b, 0)) ||
          0,
        agents_by_status: (d.stats && d.stats.agents_by_status) || {},
      },
      analytics: {
        tokens: {
          input: t.total_input || 0,
          output: t.total_output || 0,
          cache_read: t.total_cache_read || 0,
          cache_write: t.total_cache_write || 0,
          total: totalTokens,
        },
        cost: (d.analytics && d.analytics.total_cost) || 0,
        subagents: (d.analytics && d.analytics.total_subagents) || 0,
      },
      sessions: (Array.isArray(d.sessions) ? d.sessions : []).slice(0, 12).map((s) => ({
        id: s.id,
        name: s.name || s.id.substring(0, 8),
        status: s.status || "unknown",
        model: s.model || "unknown",
        started_at: s.started_at,
      })),
      history: this.history,
      ts: Date.now(),
    };

    this.view.webview.postMessage({ type: "snapshot", payload: snapshot });
  }

  pushHistory(snapshot) {
    const cap = (arr, v) => {
      arr.push(v);
      if (arr.length > SPARK_HISTORY) arr.shift();
    };
    cap(this.history.sessions, snapshot.stats.sessions);
    cap(this.history.agents, snapshot.stats.agents_total);
    cap(this.history.tokens, snapshot.analytics.tokens.total);
    cap(this.history.cost, snapshot.analytics.cost);
  }

  async fetchAll() {
    if (this._fetching) return this._fetching;
    this._fetching = (async () => {
      const ports = [4820, 5173];
      let foundActive = false;

      for (const p of ports) {
        const up = await this.ping(p);
        this.log("ping " + p + " => " + up);
        if (up) {
          this.status = "Online";
          this.data.port = p;
          foundActive = true;
          try {
            this.data.stats = await this.f(4820, "/api/stats");
            this.data.analytics = await this.f(4820, "/api/analytics");
            const sess = await this.f(4820, "/api/sessions?limit=12");
            this.data.sessions = Array.isArray(sess)
              ? sess
              : (sess && (sess.sessions || sess.rows || sess.data)) || [];
            if (!Array.isArray(this.data.sessions)) this.data.sessions = [];
            this.log("fetched stats+analytics+sessions ok");
          } catch (e) {
            this.log("fetch error: " + (e && e.message ? e.message : e));
          }
          break;
        }
      }

      if (!foundActive) {
        this.status = "Offline";
        this.data = {};
      }
      this.log("fetchAll done, status=" + this.status);
    })();
    try {
      await this._fetching;
    } finally {
      this._fetching = null;
    }

    // Update sparkline history off the freshest snapshot
    const t = (this.data.analytics && this.data.analytics.tokens) || {};
    const totalTokens =
      (t.total_input || 0) +
      (t.total_output || 0) +
      (t.total_cache_read || 0) +
      (t.total_cache_write || 0);
    this.pushHistory({
      stats: {
        sessions: (this.data.stats && this.data.stats.total_sessions) || 0,
        agents_total:
          (this.data.stats &&
            this.data.stats.agents_by_status &&
            Object.values(this.data.stats.agents_by_status).reduce((a, b) => a + b, 0)) ||
          0,
      },
      analytics: {
        tokens: { total: totalTokens },
        cost: (this.data.analytics && this.data.analytics.total_cost) || 0,
      },
    });
  }

  ping(p) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        try {
          req.destroy();
        } catch (_) {}
        resolve(v);
      };
      const req = http.get(
        { hostname: "127.0.0.1", port: p, path: p === 4820 ? "/api/health" : "/", timeout: 800 },
        (res) => {
          res.resume();
          finish(true);
        }
      );
      req.on("error", () => finish(false));
      req.on("timeout", () => finish(false));
    });
  }

  f(p, path) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn, v) => {
        if (done) return;
        done = true;
        try {
          req.destroy();
        } catch (_) {}
        fn(v);
      };
      const req = http.get({ hostname: "127.0.0.1", port: p, path, timeout: 1500 }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            finish(resolve, JSON.parse(d));
          } catch (e) {
            finish(reject, e);
          }
        });
      });
      req.on("error", (e) => finish(reject, e));
      req.on("timeout", () => finish(reject, new Error("timeout")));
    });
  }

  getHtml() {
    const nonce = makeNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
<style>
  :root {
    --bg: var(--vscode-sideBar-background, #1e1e2e);
    --fg: var(--vscode-foreground, #e6e6e6);
    --muted: var(--vscode-descriptionForeground, #9aa0a6);
    --border: var(--vscode-panel-border, rgba(255,255,255,0.08));
    --hover: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    --accent: var(--vscode-charts-blue, #6366f1);
    --accent-2: var(--vscode-charts-purple, #a855f7);
    --green: var(--vscode-charts-green, #10b981);
    --red: var(--vscode-charts-red, #ef4444);
    --yellow: var(--vscode-charts-yellow, #f59e0b);
    --orange: var(--vscode-charts-orange, #f97316);
    --card: color-mix(in srgb, var(--bg) 70%, white 5%);
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg); color: var(--fg);
    font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
    font-size: 12px;
    overflow-x: hidden;
  }
  body {
    padding: 10px 10px 18px;
    animation: fade .35s ease both;
  }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

  /* ===== Header ===== */
  .hero {
    display: flex; align-items: center; gap: 10px;
    padding: 12px;
    border-radius: 12px;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--accent) 18%, transparent),
      color-mix(in srgb, var(--accent-2) 12%, transparent));
    border: 1px solid var(--border);
    margin-bottom: 12px;
    position: relative; overflow: hidden;
  }
  .hero::after {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 90% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 60%);
    pointer-events: none;
  }
  .logo {
    width: 30px; height: 30px; border-radius: 9px;
    background: color-mix(in srgb, var(--accent) 30%, var(--bg));
    display: grid; place-items: center; flex-shrink: 0;
    box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .logo svg { width: 18px; height: 18px; }
  .hero-title { font-weight: 600; font-size: 13px; letter-spacing: .2px; }
  .hero-sub { color: var(--muted); font-size: 10.5px; margin-top: 1px; }
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600;
    background: color-mix(in srgb, var(--green) 18%, transparent);
    color: var(--green); border: 1px solid color-mix(in srgb, var(--green) 35%, transparent);
    margin-left: auto; position: relative; z-index: 1;
  }
  .pill.off {
    background: color-mix(in srgb, var(--red) 18%, transparent);
    color: var(--red); border-color: color-mix(in srgb, var(--red) 35%, transparent);
  }
  .pill .dot {
    width: 7px; height: 7px; border-radius: 50%; background: currentColor;
    box-shadow: 0 0 0 0 currentColor;
    animation: pulse 1.6s ease-out infinite;
  }
  .pill.off .dot { animation: none; }
  @keyframes pulse {
    0%   { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 60%, transparent); }
    70%  { box-shadow: 0 0 0 6px color-mix(in srgb, currentColor 0%, transparent); }
    100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 0%, transparent); }
  }

  /* ===== Section ===== */
  .section { margin-top: 14px; }
  .section-h {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--muted); margin: 0 2px 6px;
  }
  .section-h .chip {
    font-size: 9.5px; letter-spacing: .04em; text-transform: none;
    padding: 2px 7px; border-radius: 999px; background: var(--hover);
    color: var(--fg);
  }

  /* ===== Stats grid ===== */
  .stats {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  }
  .stat {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 10px 8px;
    overflow: hidden; min-width: 0;
    display: flex; flex-direction: column; gap: 2px;
    transition: transform .15s ease, border-color .15s ease;
  }
  .stat:hover { transform: translateY(-1px); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
  .stat .label {
    color: var(--muted); font-size: 10.5px;
    display: flex; align-items: center; gap: 6px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .stat .label svg { width: 11px; height: 11px; opacity: .85; flex-shrink: 0; }
  .stat .val {
    font-size: 17px; font-weight: 600; margin-top: 2px; letter-spacing: -.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  .stat .sub {
    color: var(--muted); font-size: 10px; margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .stat .spark-wrap {
    margin-top: 6px; height: 18px; width: 100%;
    display: flex; align-items: flex-end;
  }
  .stat svg.spark { display: block; width: 100%; height: 18px; opacity: .9; }

  /* ===== Agent health bar ===== */
  .health {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px;
  }
  .bar {
    display: flex; height: 8px; border-radius: 999px; overflow: hidden;
    background: var(--hover);
  }
  .bar > span { transition: width .4s cubic-bezier(.2,.7,.2,1); }
  .legend {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 8px;
    font-size: 10.5px; color: var(--muted);
  }
  .legend .row { display: flex; align-items: center; gap: 6px; }
  .legend .swatch { width: 8px; height: 8px; border-radius: 2px; }
  .legend .num { color: var(--fg); font-variant-numeric: tabular-nums; margin-left: auto; font-weight: 600; }

  /* ===== Sessions ===== */
  .session {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 8px; border-radius: 8px; cursor: pointer;
    border: 1px solid transparent; transition: background .12s ease, border-color .12s ease;
  }
  .session:hover { background: var(--hover); border-color: var(--border); }
  .session .avatar {
    width: 22px; height: 22px; border-radius: 6px;
    display: grid; place-items: center; flex-shrink: 0;
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    color: var(--accent);
  }
  .session .avatar svg { width: 12px; height: 12px; }
  .session.completed .avatar { background: color-mix(in srgb, var(--green) 22%, transparent); color: var(--green); }
  .session.error .avatar { background: color-mix(in srgb, var(--red) 22%, transparent); color: var(--red); }
  .session.active .avatar, .session.working .avatar { background: color-mix(in srgb, var(--yellow) 22%, transparent); color: var(--yellow); }
  .session .meta { min-width: 0; flex: 1; }
  .session .name { font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .session .sub { color: var(--muted); font-size: 10px; display: flex; gap: 6px; align-items: center; }
  .session .badge {
    background: var(--hover); padding: 1px 6px; border-radius: 999px; font-size: 9.5px;
  }

  /* ===== Buttons / nav ===== */
  .nav { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .nav button, .actions button {
    all: unset; cursor: pointer;
    display: flex; align-items: center; gap: 7px; padding: 8px 10px;
    border-radius: 8px; background: var(--card); border: 1px solid var(--border);
    font-size: 11.5px; transition: transform .12s ease, background .12s ease, border-color .12s ease;
  }
  .nav button:hover, .actions button:hover {
    background: var(--hover);
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
    transform: translateY(-1px);
  }
  .nav button svg, .actions button svg { width: 13px; height: 13px; opacity: .9; }
  .actions { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .actions button.danger:hover {
    border-color: color-mix(in srgb, var(--red) 50%, var(--border));
    color: var(--red);
  }

  /* ===== Empty / offline ===== */
  .empty {
    text-align: center; color: var(--muted); padding: 16px 8px;
    border: 1px dashed var(--border); border-radius: 10px;
    font-size: 11px;
  }
  .empty .big { font-size: 13px; color: var(--fg); margin-bottom: 4px; font-weight: 600; }
  .empty code {
    display: inline-block; margin-top: 6px; padding: 3px 7px; border-radius: 6px;
    background: var(--hover); font-family: var(--vscode-editor-font-family, Consolas, monospace);
    font-size: 10.5px;
  }

  /* ===== Skeleton ===== */
  .skel {
    background: linear-gradient(90deg, var(--hover) 0%, color-mix(in srgb, var(--hover) 60%, transparent) 50%, var(--hover) 100%);
    background-size: 200% 100%; animation: shimmer 1.4s linear infinite;
    border-radius: 6px;
  }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
</style>
</head>
<body>

<div class="hero">
  <div class="logo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/>
    </svg>
  </div>
  <div>
    <div class="hero-title">Claude Code Monitor</div>
    <div class="hero-sub" id="hero-sub">Connecting…</div>
  </div>
  <div class="pill off" id="pill"><span class="dot"></span><span id="pill-text">Offline</span></div>
</div>

<div id="content">
  <div class="empty">
    <div class="big">Loading…</div>
    Polling backend for live data.
  </div>
</div>

<script nonce="${nonce}">
(function(){
try {
  const vscode = acquireVsCodeApi();
  window.addEventListener('error', (ev) => {
    try { vscode.postMessage({ command: 'error', text: (ev && ev.message) + ' @ ' + (ev && ev.filename) + ':' + (ev && ev.lineno) }); } catch(_){}
    try { document.getElementById('hero-sub').textContent = 'JS ERROR: ' + (ev && ev.message); } catch(_){}
  });
  // Synchronous proof-of-life so we can see the script ran:
  try { document.getElementById('hero-sub').textContent = 'script ready · awaiting data'; } catch(_){}
  vscode.postMessage({ command: 'log', text: 'script booted' });

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => {
    n = Number(n) || 0;
    if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'k';
    return String(n);
  };
  const ago = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return Math.max(1, Math.floor(s)) + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const sparkline = (values, color) => {
    const v = (values || []).map(Number).filter(x => !isNaN(x));
    if (v.length < 2) return '<div class="spark-wrap"></div>';
    const w = 100, h = 18, pad = 1.5;
    const min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    const range = (max - min) || 1;
    const step = (w - pad*2) / (v.length - 1);
    const pts = v.map((x, i) => [pad + i*step, h - pad - ((x - min) / range) * (h - pad*2)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = d + ' L ' + (w-pad).toFixed(1) + ' ' + (h-pad) + ' L ' + pad + ' ' + (h-pad) + ' Z';
    return '<div class="spark-wrap"><svg class="spark" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><path d="'+area+'" fill="'+color+'" opacity="0.18"/><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>';
  };

  const ICONS = {
    sessions:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/></svg>',
    agents:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    tokens:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/><path d="M8 12h8M12 8v8"/></svg>',
    cost:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    play:      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    check:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>',
    error:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    pulse:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9-6-18-3 9H2"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    chart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-3 4 4 5-7"/></svg>',
    kanban:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/></svg>',
    list:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    settings:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    refresh:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    globe:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z"/></svg>',
    trash:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  };

  const STATUS_ORDER = [
    ['working',   'var(--yellow)'],
    ['connected', 'var(--accent-2)'],
    ['idle',      'var(--green)'],
    ['completed', 'var(--accent)'],
    ['error',     'var(--red)'],
  ];

  const renderOffline = () => {
    $('content').innerHTML = \`
      <div class="empty">
        <div class="big">Backend offline</div>
        Start the dashboard to begin monitoring.
        <div><code>npm run dev</code></div>
        <div style="margin-top:10px;">
          <button class="" onclick="postCmd('refresh')" style="all:unset; cursor:pointer; padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card);">Retry</button>
        </div>
      </div>
    \`;
  };

  const renderOnline = (s) => {
    const ah = s.stats.agents_by_status || {};
    const totalA = STATUS_ORDER.reduce((sum, [k]) => sum + (ah[k] || 0), 0) || 1;
    const segs = STATUS_ORDER
      .map(([k, c]) => '<span style="background:'+c+';width:'+(((ah[k]||0)/totalA)*100)+'%"></span>')
      .join('');
    const legend = STATUS_ORDER
      .map(([k, c]) => '<div class="row"><span class="swatch" style="background:'+c+'"></span>'+k+'<span class="num">'+(ah[k]||0)+'</span></div>')
      .join('');

    const sessions = (s.sessions || []).length
      ? s.sessions.map(x => {
          const cls = (x.status === 'completed' || x.status === 'active' || x.status === 'error' || x.status === 'working') ? x.status : '';
          const icon = x.status === 'completed' ? ICONS.check : x.status === 'error' ? ICONS.error : ICONS.play;
          return \`
            <div class="session \${cls}" data-id="\${esc(x.id)}" title="\${esc(x.id)} · \${esc(x.model)}">
              <div class="avatar">\${icon}</div>
              <div class="meta">
                <div class="name">\${esc(x.name)}</div>
                <div class="sub"><span>\${esc(ago(x.started_at))}</span><span class="badge">\${esc(x.model)}</span></div>
              </div>
            </div>\`;
        }).join('')
      : '<div class="empty">No recent sessions yet.</div>';

    $('content').innerHTML = \`
      <div class="section">
        <div class="section-h">Live Stats <span class="chip">auto · 5s</span></div>
        <div class="stats">
          <div class="stat">
            <div class="label">\${ICONS.sessions} Sessions</div>
            <div class="val">\${fmt(s.stats.sessions)}</div>
            <div class="sub">\${fmt(s.stats.events)} events</div>
            \${sparkline(s.history.sessions, 'var(--accent)')}
          </div>
          <div class="stat">
            <div class="label">\${ICONS.agents} Agents</div>
            <div class="val">\${fmt(s.stats.agents_total)}</div>
            <div class="sub">\${s.stats.ws} WS live</div>
            \${sparkline(s.history.agents, 'var(--accent-2)')}
          </div>
          <div class="stat">
            <div class="label">\${ICONS.tokens} Tokens</div>
            <div class="val">\${fmt(s.analytics.tokens.total)}</div>
            <div class="sub">in \${fmt(s.analytics.tokens.input)} · out \${fmt(s.analytics.tokens.output)}</div>
            \${sparkline(s.history.tokens, 'var(--green)')}
          </div>
          <div class="stat">
            <div class="label">\${ICONS.cost} Cost</div>
            <div class="val">$\${(s.analytics.cost || 0).toFixed(2)}</div>
            <div class="sub">\${s.analytics.subagents} subagents</div>
            \${sparkline(s.history.cost, 'var(--orange)')}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-h">Agent Health <span class="chip">\${totalA} total</span></div>
        <div class="health">
          <div class="bar">\${segs}</div>
          <div class="legend">\${legend}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-h">Recent Sessions <span class="chip">\${(s.sessions||[]).length}</span></div>
        <div id="sessions">\${sessions}</div>
      </div>

      <div class="section">
        <div class="section-h">Quick Navigation</div>
        <div class="nav">
          <button data-nav="">\${ICONS.dashboard} Dashboard</button>
          <button data-nav="analytics">\${ICONS.chart} Analytics</button>
          <button data-nav="kanban">\${ICONS.kanban} Agent Board</button>
          <button data-nav="sessions">\${ICONS.list} Sessions</button>
          <button data-nav="settings" style="grid-column: span 2;">\${ICONS.settings} System Settings</button>
        </div>
      </div>

      <div class="section">
        <div class="section-h">Actions</div>
        <div class="actions">
          <button data-act="refresh">\${ICONS.refresh} Refresh</button>
          <button data-act="openInBrowser">\${ICONS.globe} Browser</button>
          <button data-act="clearHistory" class="danger">\${ICONS.trash} Clear</button>
        </div>
      </div>
    \`;

    document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      vscode.postMessage({ command: 'openDashboard', target: b.getAttribute('data-nav') });
    }));
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      vscode.postMessage({ command: b.getAttribute('data-act') });
    }));
    document.querySelectorAll('.session').forEach(el => el.addEventListener('click', () => {
      vscode.postMessage({ command: 'openDashboard', target: el.getAttribute('data-id') });
    }));
  };

  const postCmd = (c, target) => vscode.postMessage({ command: c, target });
  window.postCmd = postCmd;

  const apply = (s) => {
    const isOn = s.status === 'Online';
    const pill = $('pill');
    pill.classList.toggle('off', !isOn);
    $('pill-text').textContent = isOn ? 'Online' : 'Offline';
    $('hero-sub').textContent = isOn
      ? ('localhost:' + (s.port || '4820') + ' · live')
      : 'No backend detected on 4820 / 5173';
    if (isOn) renderOnline(s); else renderOffline();
  };

  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m && m.type === 'snapshot') apply(m.payload);
  });

  vscode.postMessage({ command: 'ready' });
} catch (e) {
  try { document.getElementById('hero-sub').textContent = 'BOOT ERROR: ' + (e && e.message); } catch(_){}
}
})();
</script>
</body>
</html>`;
  }
}

function makeNonce() {
  let s = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = { DashboardWebviewProvider };
