---
name: run-agent
description: >
  Launch and supervise Claude Code or Codex through the CCAM Run API. Use when
  the user wants to start a monitored agent, select a model, approval policy,
  sandbox, or working directory, send a follow-up, inspect live output, resume
  a native session, or stop a dashboard-launched run.
---

# Run Agent

Use `ccam run` against the local dashboard.

## Workflow

1. Verify the provider binary:
   - `ccam run binary claude`
   - `ccam run binary codex`
2. Discover supported models with `ccam run models <provider>`.
3. Confirm the working directory with `ccam run cwds`.
4. Show the exact launch settings before starting. Include provider, prompt,
   working directory, model, approval mode, sandbox, and resume session ID.
5. Start only after user confirmation:

```bash
ccam run start --provider codex --cwd /path/to/repo \
  --prompt "Review the current changes" \
  --permission on-request --sandbox workspace-write --yes
```

6. Inspect with `ccam run list` or `ccam run get <id> --envelopes`.
7. Send follow-ups with `ccam run send <id> --text "..." --provider codex --yes`.
8. Stop with `ccam run stop <id> --yes`.

## Safety

- Never use `danger-full-access` unless the user explicitly requests it.
- Do not start, message, or stop a run without confirmation.
- Preserve the provider used to start the run when sending messages.
- Treat run history as evidence. Do not claim completion from process status
  alone when the final output or persisted session shows an error.
