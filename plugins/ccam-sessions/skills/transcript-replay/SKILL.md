---
description: >
  Walk a Claude Code session transcript turn-by-turn from Agent Monitor data,
  summarizing each user, assistant, and tool message in order so a long conversation
  can be reviewed quickly. Anchors the recap to the session header (model, cost,
  turn_count). Use when reviewing what was actually said and done in a conversation.
---

# Transcript Replay

Replay a session transcript one turn at a time with a concise summary of each message.

## Input

The user provides: **$ARGUMENTS**

- A **session ID** to replay, or
- "latest" / "last" for the most recent session.
- Optionally a turn range (e.g. `1-10`) or `errors` to focus on tool failures.

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/sessions/:id/transcript` | ordered transcript messages: role (user / assistant / tool), content, tool_name and tool result where applicable, timestamps |
| `GET /api/sessions/:id` | session header: status, model, cwd, started_at, ended_at, cost, metadata (thinking_blocks, turn_count, total_turn_duration_ms) |

## Report Sections

### 1. Header
`GET /api/sessions/:id`. Print id, model, cwd basename, status, turn_count,
thinking_blocks, total_turn_duration_ms, and cost in one block.

### 2. Turn-by-turn walk
`GET /api/sessions/:id/transcript`. Iterate messages in order. For each turn emit
one compact entry:
- **user** — the request in one sentence (quote the literal ask only if short).
- **assistant** — the decision / action taken, plus which tools it invoked.
- **tool** — the tool name and a one-line result (success value or the error text);
  do not paste large tool payloads.

Group an assistant message with the tool calls it triggered so each "turn" reads as
intent → action → result.

### 3. Thread highlights
After the walk, pull out: the original goal, the key turning points, any tool
failures or retries, and how the session ended (resolved / errored / abandoned).

## Output

A numbered turn list (`Turn N — <role>: <one-line summary>`), grouped intent →
action → result, preceded by the header block and followed by the highlights.
Truncate any quoted content past ~200 chars with `…`. Currency as USD to 4 decimal
places. Summarize faithfully — never invent message content that is not in the
transcript. If the transcript endpoint returns empty, say the session has no stored
transcript (it may predate transcript capture or need a reimport) rather than
fabricating turns. If the dashboard is unreachable, tell the user to start it with
`npm start` from the repo root.
