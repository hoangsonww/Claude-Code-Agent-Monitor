# MCP Tool Domain Map

- `observability-tools.ts`: health, scoped stats/analytics, export, snapshots, Prometheus.
- `session-tools.ts`: scoped session list/get/create/update.
- `session-detail-tools.ts`: facets, stats, transcripts, transcript images, event facets.
- `agent-tools.ts`: scoped agent list/get/create/update.
- `event-tools.ts`: complete event filtering and hook ingestion.
- `pricing-tools.ts`: Claude and GPT/Codex pricing CRUD plus scoped cost.
- `workflow-tools.ts`: aggregate/session workflow data and Workflow-tool runs.
- `alert-tools.ts`: fired alerts, acknowledgments, and alert-rule CRUD.
- `webhook-tools.ts`: provider discovery, target CRUD, tests, and delivery history.
- `import-tools.ts`: provider guides, rescan, path scan, multipart upload, export restore.
- `config-tools.ts`: Claude and Codex discovery plus backup-backed allowlisted edits.
- `run-tools.ts`: Run Agent discovery, launch, follow-up, inspection, and stop.
- `remote-tools.ts`: remote source CRUD, probe, sync, and confirmed purge.
- `settings-tools.ts`: updates, Claude/Codex homes, and hook installation.
- `push-tools.ts`: push key, subscription lifecycle, and external notification send.
- `maintenance-tools.ts`: cleanup, reimport, reinstall hooks, destructive clear.
