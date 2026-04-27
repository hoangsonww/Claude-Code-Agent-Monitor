/**
 * @file Main extension file for Claude Code Agent Monitor VSCode extension
 * Sets up the extension, registers commands, and manages the status bar item.
 * Implements a dynamic dashboard view that checks for active servers on ports 5173 and 4820.
 * Provides real-time status updates in the sidebar and status bar with background polling.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const vscode = require("vscode");
const http = require("http");
const { DashboardWebviewProvider } = require("./sidebar");

let statusBarItem;
let outputChannel;

function activate(context) {
  outputChannel = vscode.window.createOutputChannel("Claude Code Monitor");
  outputChannel.appendLine("[activate] " + new Date().toISOString());
  context.subscriptions.push(outputChannel);

  const statusProvider = new DashboardWebviewProvider(context, outputChannel);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("claude-code-monitor-view", statusProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "claude-code-agent-monitor.openDashboard";
  context.subscriptions.push(statusBarItem);

  updateStatusBar();
  const statusInterval = setInterval(() => {
    updateStatusBar();
  }, 5000); // Auto-refresh every 5 seconds

  let openDashboard = vscode.commands.registerCommand(
    "claude-code-agent-monitor.openDashboard",
    async (target) => {
      const panel = vscode.window.createWebviewPanel(
        "agentMonitor",
        "Claude Code Agent Monitor",
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      const updateWebview = async () => {
        const ports = [5173, 4820];
        let activePort = null;
        for (const port of ports) {
          if (await checkPort(port)) {
            activePort = port;
            break;
          }
        }

        if (activePort) {
          let suffix = "";
          if (target) {
            suffix = target.includes("-") ? `/sessions/${target}` : `/${target}`;
          }
          panel.webview.html = getDashboardHtml(activePort, suffix);
        } else {
          panel.webview.html = getErrorHtml();
        }
      };

      panel.webview.onDidReceiveMessage((m) => {
        if (m.command === "retry") updateWebview();
      });
      await updateWebview();
    }
  );

  let openInBrowser = vscode.commands.registerCommand(
    "claude-code-agent-monitor.openInBrowser",
    async () => {
      const isDevUp = await checkPort(5173);
      const url = isDevUp ? "http://localhost:5173" : "http://localhost:4820";
      vscode.env.openExternal(vscode.Uri.parse(url));
    }
  );

  let refreshStatus = vscode.commands.registerCommand(
    "claude-code-agent-monitor.refreshStatus",
    () => {
      statusProvider.refresh();
      updateStatusBar();
      vscode.window.showInformationMessage("Claude Code Monitor refreshed.");
    }
  );

  let clearHistory = vscode.commands.registerCommand(
    "claude-code-agent-monitor.clearHistory",
    async () => {
      if (
        (await vscode.window.showWarningMessage("Clear all history?", { modal: true }, "Yes")) ===
        "Yes"
      ) {
        try {
          const res = await request("DELETE", 4820, "/api/sessions");
          if (res.statusCode === 200) {
            statusProvider.refresh();
            updateStatusBar();
            vscode.window.showInformationMessage("History cleared.");
          }
        } catch (e) {
          vscode.window.showErrorMessage("Failed to clear history.");
        }
      }
    }
  );

  context.subscriptions.push(openDashboard, openInBrowser, refreshStatus, clearHistory);
  context.subscriptions.push({ dispose: () => clearInterval(statusInterval) });
}

async function updateStatusBar() {
  try {
    const stats = await fetchJson(4820, "/api/stats");
    if (stats) {
      statusBarItem.text = `$(pulse) Claude: ${stats.sessions || 0}s | ${stats.agents || 0}a`;
      statusBarItem.show();
    } else statusBarItem.hide();
  } catch (e) {
    statusBarItem.hide();
  }
}

function checkPort(port) {
  return new Promise((r) => {
    const req = http.get({ hostname: "localhost", port, path: "/", timeout: 500 }, (res) => {
      r(true);
      res.resume();
    });
    req.on("error", () => r(false));
  });
}

function fetchJson(port, path) {
  return new Promise((res, rej) => {
    const req = http.get({ hostname: "localhost", port, path, timeout: 800 }, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        try {
          res(JSON.parse(d));
        } catch (e) {
          rej(e);
        }
      });
    });
    req.on("error", rej);
  });
}

function request(method, port, path) {
  return new Promise((res, rej) => {
    const req = http.request({ hostname: "localhost", port, path, method }, res);
    req.on("error", rej);
    req.end();
  });
}

function getDashboardHtml(port, suffix) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <style>body,html{margin:0;padding:0;height:100%;width:100%;overflow:hidden;background:#0f111a;}
    iframe{border:none;height:calc(100% - 30px);width:100%;}
    .t{height:30px;background:#1a1a2e;display:flex;align-items:center;padding:0 10px;font-size:11px;color:#888;border-bottom:1px solid #2e2e48;font-family:sans-serif;}
    .d{width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:8px;box-shadow:0 0 5px #10b981;}
    .u{margin-left:auto;opacity:0.5;}</style></head>
    <body><div class="t"><div class="d"></div>Live Dashboard: ${suffix || "/"} <div class="u">localhost:${port}</div></div>
    <iframe src="http://localhost:${port}${suffix}"></iframe></body></html>`;
}

function getErrorHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0b0c14;
            --card: #141624;
            --accent: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.15);
            --text: #ffffff;
            --text-muted: #94a3b8;
            --border: rgba(255, 255, 255, 0.08);
            --code-bg: #000000;
        }
        * { box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            margin: 0; padding: 20px;
            background-color: var(--bg);
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%),
                radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.1) 0px, transparent 50%);
            color: var(--text);
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh;
            overflow-x: hidden;
        }
        .container {
            max-width: 800px; width: 100%;
            animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .hero { text-align: center; margin-bottom: 48px; }
        .logo-wrap {
            width: 80px; height: 80px; background: var(--card); border: 1px solid var(--border);
            border-radius: 24px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 0 40px var(--accent-glow); position: relative;
        }
        .logo-wrap::after {
            content: ''; position: absolute; inset: -1px; border-radius: 24px;
            padding: 1px; background: linear-gradient(45deg, var(--accent), transparent);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor; mask-composite: exclude;
        }
        h1 { font-size: 36px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px 0; }
        .subtitle { color: var(--text-muted); font-size: 18px; font-weight: 300; }

        .main-card {
            background: rgba(20, 22, 36, 0.7);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            border-radius: 32px;
            padding: 40px;
            display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px;
        }
        @media (max-width: 768px) { .main-card { grid-template-columns: 1fr; padding: 24px; } }

        .setup-guide h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin: 0 0 24px 0; }
        .timeline { position: relative; padding-left: 32px; }
        .timeline::before { content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px; width: 1px; background: var(--border); }
        .t-step { position: relative; margin-bottom: 32px; }
        .t-step::before { 
            content: ''; position: absolute; left: -32px; top: 6px; width: 16px; height: 16px; 
            background: var(--bg); border: 2px solid var(--accent); border-radius: 50%; z-index: 1;
        }
        .t-label { font-size: 15px; font-weight: 500; margin-bottom: 8px; color: #fff; }
        .t-code {
            background: var(--code-bg); padding: 12px 16px; border-radius: 12px;
            font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; color: #a5b4fc;
            border: 1px solid rgba(255,255,255,0.05); white-space: pre-wrap;
        }

        .side-panel { display: flex; flex-direction: column; justify-content: center; gap: 24px; }
        .info-box { background: rgba(255,255,255,0.03); border-radius: 20px; padding: 24px; border: 1px solid var(--border); }
        .info-box h3 { font-size: 15px; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px; }
        .info-box p { font-size: 13px; color: var(--text-muted); margin: 0; line-height: 1.5; }

        .btn {
            width: 100%; padding: 16px; border-radius: 14px; font-size: 15px; font-weight: 600;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); text-decoration: none;
        }
        .btn-primary { background: var(--accent); color: #fff; border: none; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.25); }
        .btn-primary:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(99, 102, 241, 0.35); }
        .btn-secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid var(--border); }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); transform: translateY(-2px); }

        .footer { text-align: center; margin-top: 48px; display: flex; justify-content: center; gap: 32px; }
        .footer a { color: var(--text-muted); text-decoration: none; font-size: 14px; transition: color 0.2s; }
        .footer a:hover { color: var(--accent); }
    </style>
</head>
<body>
    <div class="container">
        <div class="hero">
            <div class="logo-wrap">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent)">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                </svg>
            </div>
            <h1>Dashboard Offline</h1>
            <div class="subtitle">Unable to connect to the Claude Code Monitor server</div>
        </div>

        <div class="main-card">
            <div class="setup-guide">
                <h2>Quick Setup Guide</h2>
                <div class="timeline">
                    <div class="t-step">
                        <div class="t-label">Initialize Repository</div>
                        <div class="t-code">git clone https://github.com/hoangsonww/Claude-Code-Agent-Monitor.git
cd Claude-Code-Agent-Monitor
npm run setup</div>
                    </div>
                    <div class="t-step" style="margin-bottom: 0;">
                        <div class="t-label">Launch Dashboard</div>
                        <div class="t-code">npm run dev</div>
                    </div>
                </div>
            </div>

            <div class="side-panel">
                <div class="info-box">
                    <h3>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4"/>
                            <path d="M12 8h.01"/>
                        </svg>
                        Troubleshooting
                    </h3>
                    <p>Ensure no other services are occupying ports 5173 or 4820. If the problem persists, check the documentation.</p>
                </div>
                
                <button class="btn btn-primary" onclick="acquireVsCodeApi().postMessage({command:'retry'})">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    Retry Connection
                </button>
                
                <a href="https://hoangsonww.github.io/Claude-Code-Agent-Monitor/" class="btn btn-secondary">
                    View Documentation
                </a>
            </div>
        </div>

        <div class="footer">
            <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor">GitHub</a>
            <a href="https://hoangsonww.github.io/Claude-Code-Agent-Monitor/">Wiki</a>
            <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/issues">Support</a>
        </div>
    </div>
</body>
</html>`;
}

function deactivate() {
  if (statusBarItem) statusBarItem.dispose();
}
module.exports = { activate, deactivate };
