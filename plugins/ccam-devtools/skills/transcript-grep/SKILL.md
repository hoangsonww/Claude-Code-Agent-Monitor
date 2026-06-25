---
description: >
  Search a Claude Code session transcript for a string or regex pattern and show
  every matching message with surrounding context. Reads
  /api/sessions/:id/transcript and resolves sessions via /api/sessions?limit=
  from the Agent Monitor dashboard. Use when hunting for a specific message,
  prompt, tool call, or error inside a session's conversation.
---

# Transcript Grep

Find where a pattern appears in a session transcript and show the matches in context.

## Input

The user provides: **$ARGUMENTS**

Interpreted as a session reference plus a search pattern, e.g.
`<session-id> "rate limit"` or `latest TypeError`. Parsing rules:
- The session reference is the first token if it looks like an id, or the words
  `latest`/`last` (most recently updated session).
- The remainder is the search pattern (string or regex, quoted if it contains spaces).
- If no session is given, default to the most recent session.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions?limit=N` | session list to resolve `latest`/`last` and to confirm the id exists |
| `GET /api/sessions/:id/transcript` | the ordered transcript messages (role, content, tool calls/results, timestamps) for the session |

## Report Sections

### 1. Resolve the session
If `latest`/`last` (or no id), call `GET /api/sessions?limit=1`. Otherwise verify
the id with `GET /api/sessions?limit=1000` (or `GET /api/sessions/:id`). Report
the resolved id, status, and model before searching.

### 2. Fetch and search
Call `GET /api/sessions/:id/transcript`. Walk the messages in order and match the
pattern against message text, tool_name, and tool input/output content.
Case-insensitive by default; treat the pattern as a regex if it contains regex
metacharacters, otherwise as a literal substring.

### 3. Matches with context
For each match show:

```
[#N  HH:MM:SS  role(:tool_name)]
  … preceding line of context …
> matching line with the **pattern** emphasized
  … following line of context …
```

Number matches sequentially. Include ±1–2 messages (or lines) of context so the
match is interpretable. If a tool call matches, show the tool_name and a trimmed
view of its arguments/result.

### 4. Summary
Report: total matches, how many distinct messages matched, the roles involved
(user / assistant / tool), and the timestamp span of the matches. If there are
zero matches, say so plainly and suggest a looser pattern.

## Output

- Lead with the match count and session header, then the contextual snippets.
- Keep snippets trimmed — truncate long tool payloads with `…` rather than dumping them.
- Cite only transcript content returned by the API — never fabricate messages.
- If the dashboard is unreachable, tell the user to start it with `npm start` from the repo root.
