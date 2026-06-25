# Backup & Restore

A **local-first** way to capture your dashboard's database into a single portable
file (a *backup bundle*) and merge it back into any install — to move state
between machines or recover from database loss — without running a hosted
service.

It lives in **Settings → Backup & Restore**, and is also available over the API
(`/api/backup/*`).

## How this differs from the other "backup" surfaces

| Surface | Layer | What it is |
| --- | --- | --- |
| **Backup bundle** (this doc) | Application | A versioned, portable JSON bundle with a manifest + an **idempotent restore** path (validate → dry-run → merge). Cross-machine, conflict-aware. |
| `GET /api/settings/export` | Application | A raw JSON dump of a few tables. No manifest/versioning and **no restore path** — meant for ad-hoc inspection. |
| `deployments/scripts/db-backup.sh` | Infrastructure | A file-level copy of the whole SQLite file (k8s PVC / S3). Restores by replacing the DB file wholesale, not merging. |

Use the **backup bundle** when you want to merge data into an existing install
or seed a fresh one; use `db-backup.sh` for full-disk disaster recovery of a
deployed instance.

## What's in a bundle

```jsonc
{
  "manifest": {
    "format": "agent-monitor-backup",
    "schema_version": 1,
    "app_version": "1.3.0",
    "created_at": "2026-06-18T00:00:00.000Z",
    "counts": { "sessions": 12, "agents": 40, "events": 980, "token_usage": 12, "model_pricing": 8, "dashboard_runs": 3 }
  },
  "data": {
    "sessions": [ /* … */ ], "agents": [ /* … */ ], "events": [ /* … */ ],
    "token_usage": [ /* … */ ], "model_pricing": [ /* … */ ], "dashboard_runs": [ /* … */ ]
  }
}
```

**Included tables:** `sessions`, `agents`, `events`, `token_usage`,
`model_pricing`, `dashboard_runs`.

**Not included:** environment/file configuration (these aren't database state and
may hold secrets), live transcript files on disk, and server runtime state.

> A bundle contains your full session data, including event payloads — treat the
> file with the same care as the database itself.

## Compatibility policy

The bundle carries an integer `schema_version`. Restore is **forward-compatible**:
a bundle from the **same or an older** schema version is accepted; a bundle from a
**newer** version than the server understands is rejected (so a newer export is
never half-read into an older install). Unknown extra tables in `data` are
ignored with a note. Rows are imported by **column intersection** with the live
schema, so a bundle from a slightly different version still restores the columns
the two have in common.

## Restore semantics

- **Idempotent.** Append-only tables (`sessions`, `agents`, `events`,
  `token_usage`, `dashboard_runs`) merge with `INSERT OR IGNORE` by primary key —
  re-applying the same bundle inserts **nothing** the second time and never
  duplicates.
- **Non-destructive.** A row whose primary key already exists locally is kept
  as-is; existing local data is never overwritten for append-only tables.
- **Conflict strategy for pricing.** `model_pricing` is the one mutable,
  config-like table. On a primary-key conflict you choose:
  - `keep_local` *(default)* — keep your current rates.
  - `use_incoming` — overwrite with the bundle's rates (only rows that actually
    differ are changed).
- **Atomic.** The whole merge runs in a single SQLite transaction — if anything
  fails, nothing is committed.
- **Preview first.** A **dry-run** reports exactly what *would* change per table
  (new vs. already-present, pricing conflicts) with zero mutation.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET`  | `/api/backup/export` | Download the backup bundle (JSON). |
| `POST` | `/api/backup/validate` | Validate a bundle (manifest, schema version, structure). No mutation. |
| `POST` | `/api/backup/dry-run?pricing_strategy=keep_local\|use_incoming` | Per-table preview of a restore. No mutation. |
| `POST` | `/api/backup/restore?pricing_strategy=keep_local\|use_incoming` | Apply the merge transactionally. |

The three `POST` routes take the bundle JSON as the request body (the route
accepts a larger body than the global API limit so full backups fit).

## Recover a fresh install from a bundle

1. On the old/source install: **Settings → Backup & Restore → Download backup**
   (or `curl -O http://localhost:4820/api/backup/export`).
2. Stand up a fresh install (`npm run setup`, `npm start`).
3. On the new install: **Settings → Backup & Restore → Restore from backup**,
   pick the file, review the dry-run preview, choose a pricing conflict strategy
   if prompted, and confirm.
4. Re-running the same bundle is safe — it won't duplicate anything.

```bash
# API equivalent of step 3 (preview, then apply):
curl -s -X POST http://localhost:4820/api/backup/dry-run \
  -H 'content-type: application/json' --data @agent-monitor-backup-2026-06-18.json
curl -s -X POST "http://localhost:4820/api/backup/restore?pricing_strategy=keep_local" \
  -H 'content-type: application/json' --data @agent-monitor-backup-2026-06-18.json
```

## Scope / roadmap

This is the first increment (backup + validated, idempotent restore). Local sync
targets (folder / network), scheduled backups, WebSocket streaming progress for
very large bundles, and MCP/CLI affordances are tracked as follow-ups.
