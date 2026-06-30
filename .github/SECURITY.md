# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in this project, please report it responsibly:

1. **Email**: Send a detailed report to the maintainers via a private channel (open a [GitHub Security Advisory](https://github.com/hoangsonww/Claude-Code-Agent-Monitor/security/advisories/new) on this repository).
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You should receive an acknowledgment within **48 hours**. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Scope

The following are in scope:

- Injection vulnerabilities (SQL injection, XSS, command injection)
- Sensitive data exposure (credentials, tokens, PII leaks in SQLite database)
- Path traversal or file access issues (e.g. via hook handler or transcript paths)
- Dependency vulnerabilities with a known exploit

The following are **out of scope**:

- Denial of service via rate limiting (we acknowledge this and plan to address it)
- Self-hosted deployment misconfigurations

## Network exposure & hardening

The dashboard reads Claude transcripts, exports all stored data, can read local
directories, writes to `~/.claude`, and can spawn `claude`. Treat the server as
a privileged local tool:

- **Loopback by default.** The server binds `127.0.0.1` — it is **not**
  network-reachable out of the box (GHSA-gr74-4xfh-6jw9, fixed). The console
  logs the real bind address.
- **Binding to a network is opt-in and risky.** Set `DASHBOARD_HOST=0.0.0.0`
  (or a specific interface) only if you understand the exposure, and set
  **`DASHBOARD_TOKEN`** when you do — every `/api/*` request and the WebSocket
  then require it (`Authorization: Bearer <token>`, `x-dashboard-token`, or
  `?token=`). Reaching the dashboard by hostname/IP also requires listing that
  name in `DASHBOARD_ALLOWED_HOSTS` (a Host-header allowlist that blocks
  DNS-rebinding drive-bys).
- **CORS** is restricted to loopback origins; cross-origin pages cannot read
  responses.

See `.env.example` for the variables.

## Disclosure Policy

- We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).
- We aim to release a fix within **14 days** of confirming a vulnerability.
- Credit will be given to reporters in the release notes unless they prefer to remain anonymous.
