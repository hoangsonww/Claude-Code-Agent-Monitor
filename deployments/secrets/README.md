# Runtime secrets

This directory is mounted read-only at `/run/ccam-secrets` by the Compose stack.
Secret files are intentionally ignored by Git.

- `dashboard-token`: long random token for dashboard REST and WebSocket access.
- `hook-token`: separate long random token for remote Claude Code and Codex hook ingestion.
- `mcp-token`: bearer token for the optional MCP HTTP and SSE transport.
- `grafana-admin-password`: Grafana administrator password for the full stack.

Create both before exposing CCAM outside host loopback:

```bash
umask 077
openssl rand -hex 32 > deployments/secrets/dashboard-token
openssl rand -hex 32 > deployments/secrets/hook-token
openssl rand -hex 32 > deployments/secrets/mcp-token
openssl rand -base64 32 > deployments/secrets/grafana-admin-password
```

Keep the default blocked Nginx hook policy for local host hooks. To accept remote
hooks over HTTPS, set:

```bash
CCAM_NGINX_HOOK_POLICY=./deployments/nginx/snippets/hooks-proxy.conf
```

Remote hook clients then set `CCAM_DASHBOARD_URL=https://your-host` and supply
the same hook token through `CCAM_HOOK_TOKEN` or `CCAM_HOOK_TOKEN_FILE`.

MCP remains blocked at Nginx by default. To expose it behind TLS, set
`CCAM_NGINX_MCP_POLICY=./deployments/nginx/snippets/mcp-proxy.conf` and configure
clients with the `mcp-token` value as a bearer token.
