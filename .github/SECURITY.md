# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in this project, please report it responsibly:

1. **Email**: Send a detailed report to the maintainers via a private channel (open a [GitHub Security Advisory](../../security/advisories/new) on this repository).
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

## Disclosure Policy

- We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure).
- We aim to release a fix within **14 days** of confirming a vulnerability.
- Credit will be given to reporters in the release notes unless they prefer to remain anonymous.
