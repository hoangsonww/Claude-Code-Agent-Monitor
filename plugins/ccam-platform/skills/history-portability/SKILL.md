---
name: history-portability
description: >
  Import Claude Code or Codex history and move complete CCAM datasets between
  machines. Use when rescanning provider history, importing a copied directory,
  uploading JSONL or archives, exporting a backup, restoring it idempotently,
  or verifying that tokens, workflows, runs, rules, and pricing survived.
---

# History Portability

## Provider History

1. Read provider-specific paths and limits:
   `ccam import guide --provider claude|codex`.
2. Rescan the configured provider home:
   `ccam import rescan --provider <provider>`.
3. Scan an existing directory:
   `ccam import path /absolute/path --provider <provider>`.
4. For file or archive upload, use the app or MCP
   `dashboard_upload_history_files`.

## Full Dashboard Backup

```bash
ccam export ccam-export.json
ccam import-data ccam-export.json
```

Restore is idempotent and non-destructive. Existing sessions are skipped as a
whole. New sessions bring agents, events, token usage, and workflows. Independent
run, rule, and pricing rows are inserted only when absent.

Verify session counts, representative transcripts, token totals, cost, workflow
runs, alert rules, and both Claude and GPT pricing after restore.
