---
description: Check Agent Monitor reachability and print UP/DOWN with latency
---

Check whether the dashboard API is reachable and report latency.

Run:

```bash
curl -s -o /dev/null -m 5 -w '%{http_code} %{time_total}s' http://localhost:4820/api/stats
```

`%{http_code}` is the HTTP status and `%{time_total}` is the total round-trip
time in seconds.

Print one line:

- If the request succeeds with a 2xx status:
  ```
  ✅ UP | http://localhost:4820/api/stats | 200 | 0.042s
  ```
  (use the real status code and the real latency, converting seconds to ms if
  clearer, e.g. `42ms`).

- If `curl` exits non-zero (connection refused/timeout) or the status is not 2xx:
  ```
  ❌ DOWN | http://localhost:4820/api/stats unreachable — start it with `npm start` (or `npm run dev`) from the repo root
  ```

Output only the single line — no preamble. Do not modify any data.
