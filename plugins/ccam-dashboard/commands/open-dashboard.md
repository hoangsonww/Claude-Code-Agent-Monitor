---
description: Print the Agent Monitor dashboard URL and how to start/open it
---

Print how to open the Claude Code Agent Monitor dashboard. Do not start anything
or modify data — just print the URL and the relevant commands.

The dashboard URL is:

```
http://localhost:4820
```

Print these in a short block:

- **URL:** `http://localhost:4820`
- **Start (production):** `npm run setup` then `npm start` from the repo root
- **Start (dev, live reload):** `npm run dev` from the repo root

Detect the platform:

```bash
uname -s
```

If the result is `Darwin` (macOS), also suggest opening it directly:

```bash
open http://localhost:4820
```

On Linux suggest `xdg-open http://localhost:4820`; otherwise just tell the user
to open `http://localhost:4820` in a browser.

Keep the output to a few lines — no preamble.
