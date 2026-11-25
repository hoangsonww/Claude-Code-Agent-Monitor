/**
 * @file Tests post-deployment HTTP and WebSocket checks with the deployed prefix.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { spawnSync } = require("node:child_process");
const { WebSocketServer } = require("ws");

const root = path.resolve(__dirname, "../..");
const deployScript = path.join(root, "deployments/scripts/deploy.sh");

for (const configured of ["", " //dashboard// "]) {
  it(
    `checks the deployed HTTP and WebSocket routes for ${JSON.stringify(configured)}`,
    { skip: process.platform === "win32" },
    async () => {
      const prefix = configured.trim().replace(/^\/+|\/+$/g, "");
      const base = prefix ? `/${prefix}` : "";
      const requests = [];
      const server = http.createServer((req, res) => {
        requests.push(req.url);
        res.writeHead(req.url === `${base}/api/health` ? 200 : 404, {
          "content-type": "application/json",
        });
        res.end(req.url === `${base}/api/health` ? '{"status":"ok"}' : "{}");
      });
      const ws = new WebSocketServer({ server, path: `${base}/ws` });
      server.on("upgrade", (req) => requests.push(req.url));
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-deploy-test-"));
      const kubectl = path.join(tmp, "kubectl");
      fs.writeFileSync(
        kubectl,
        `#!/usr/bin/env bash
case "$1 $2" in
  'get deployment') case "$*" in *secrets*) : ;; *) printf 'agent-monitor' ;; esac ;;
  'get service') printf 'agent-monitor' ;;
  'get svc') case "$*" in *spec.type*) printf 'NodePort' ;; *) printf '%s' "$TEST_PORT" ;; esac ;;
  'exec deployment/agent-monitor') DASHBOARD_BASE_URL="$TEST_PREFIX" node -e "\${@: -1}" ;;
  *) exit 1 ;;
esac
`
      );
      fs.chmodSync(kubectl, 0o755);
      try {
        const result = await new Promise((resolve, reject) => {
          const proc = spawn(
            "bash",
            [
              "-c",
              'source "$DEPLOY_SCRIPT"; NAMESPACE=test; METHOD=helm; HEALTH_CHECK_RETRIES=1; run_health_check',
            ],
            {
              cwd: root,
              env: {
                ...process.env,
                PATH: `${tmp}:${process.env.PATH}`,
                DEPLOY_SCRIPT: deployScript,
                TEST_PORT: String(server.address().port),
                TEST_PREFIX: configured,
                DASHBOARD_BASE_URL: "/wrong",
                DASHBOARD_TOKEN: "",
                DASHBOARD_TOKEN_FILE: "",
              },
            }
          );
          let output = "";
          proc.stdout.on("data", (chunk) => (output += chunk));
          proc.stderr.on("data", (chunk) => (output += chunk));
          proc.on("error", reject);
          proc.on("close", (code) => resolve({ code, output }));
        });
        assert.equal(result.code, 0, result.output);
        assert.ok(requests.includes(`${base}/api/health`), JSON.stringify(requests));
        assert.ok(requests.includes(`${base}/ws`), JSON.stringify(requests));
        assert.ok(requests.every((request) => !request.includes("/api/health/")));
      } finally {
        for (const client of ws.clients) client.terminate();
        await new Promise((resolve) => ws.close(resolve));
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  );
}

it(
  "does not roll back if the deployed prefix cannot be read",
  { skip: process.platform === "win32" },
  () => {
    const result = spawnSync(
      "bash",
      [
        "-c",
        `
    source "$DEPLOY_SCRIPT"
    NAMESPACE=test
    METHOD=helm
    kubectl() {
      case "$1 $2" in
        "get deployment"|"get service") printf 'agent-monitor' ;;
        exec*) return 1 ;;
        *) return 1 ;;
      esac
    }
    trigger_auto_rollback() { echo ROLLBACK; exit 99; }
    run_health_check
  `,
      ],
      { cwd: root, env: { ...process.env, DEPLOY_SCRIPT: deployScript }, encoding: "utf8" }
    );
    assert.notEqual(result.status, 0);
    assert.notEqual(result.status, 99);
    assert.doesNotMatch(result.stdout, /ROLLBACK/);
    assert.match(result.stderr, /no rollback was attempted/);
  }
);
