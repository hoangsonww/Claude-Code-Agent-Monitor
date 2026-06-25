---
description: Quick connectivity + health probe of the Agent Monitor dashboard.
---

Run a fast health probe against the Agent Monitor dashboard at
`http://localhost:4820`. Do two checks and print OK / FAIL for each.

1. **API + stats** — fetch core stats:
   ```bash
   curl -s -o /dev/null -w '%{http_code}' http://localhost:4820/api/stats
   curl -s http://localhost:4820/api/stats
   ```
   PASS if HTTP 200 and the body is valid JSON. From the body, surface
   `total_sessions`, `active_sessions`, `total_events`, and `events_today`.

2. **Self-update status** — confirm the update subsystem responds:
   ```bash
   curl -s -o /dev/null -w '%{http_code}' http://localhost:4820/api/updates/status
   curl -s http://localhost:4820/api/updates/status
   ```
   PASS if HTTP 200 and valid JSON. Surface whether an update is available and
   the current vs latest version if present.

Print a compact report, one line per check:

```
Agent Monitor Doctor
  API /api/stats ............ OK  (sessions=12 active=1 events=3480 today=57)
  /api/updates/status ....... OK  (up to date — v1.x.x)

Overall: OK (2/2)
```

Use ✅ OK / ❌ FAIL markers. If any curl fails to connect (non-200 or no
response), mark that check FAIL and end with: "Dashboard unreachable — start it
with `npm start` from the repo root." Keep it to the report only; no extra prose.
