---
name: run-history
description: >
  Inspect CCAM dashboard-run history and relate live run handles to persisted
  Claude Code or Codex sessions. Use when finding a prior launched task,
  checking whether a run is still attached, reviewing start/end status, or
  deciding whether to resume, view, or relaunch work.
---

# Run History

1. Run `ccam run history --limit 100`.
2. Filter by provider, working directory, model, status, and session ID.
3. For a live handle, run `ccam run get <id> --envelopes`.
4. For the persisted agent session, use `ccam session <session-id>` and the
   session transcript tools.
5. Distinguish:
   - process still live
   - process completed with usable output
   - process failed
   - history row exists but the in-memory handle was reaped
6. Recommend resume only when the native session ID is present and the selected
   provider supports that session.

Return the exact run ID, provider, session ID, working directory, model,
timestamps, lifecycle state, and the next safe action.
