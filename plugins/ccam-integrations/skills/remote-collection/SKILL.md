---
name: remote-collection
description: >
  Configure and troubleshoot CCAM Remote Data Sources that collect Claude Code
  and Codex history over SSH. Use when adding, editing, testing, syncing, or
  removing a remote machine, verifying provider paths, or deciding whether to
  retain or purge imported sessions.
---

# Remote Collection

1. List current sources with `ccam remote-sources`.
2. Validate the host through the user's existing SSH configuration. CCAM stores
   no passwords or private keys.
3. Add a source with `remote_home` and `remote_codex_home` only when they differ
   from the provider defaults.
4. Test before syncing: `ccam remote-sources test <id>`.
5. Sync one source or all sources with `ccam remote-sources sync [id]`.
6. Use `ccam remote-sources update <id> --file patch.json --yes` for edits.
7. Removal retains imported sessions by default. Purging them requires:

```bash
ccam remote-sources rm <id> --purge \
  --confirm PURGE_REMOTE_SOURCE_DATA
```

Always state whether imported data will be kept or deleted before removal.
