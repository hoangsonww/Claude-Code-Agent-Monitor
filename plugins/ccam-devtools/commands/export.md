---
description: Export Agent Monitor data (sessions/events/analytics/costs/all) as json/csv/md.
argument-hint: "[sessions|events|analytics|costs|all] [json|csv|md]"
---

Export Agent Monitor data using the dashboard export endpoint. Arguments:
**$ARGUMENTS** — the first token is the data `type`, the second is the `format`.

- `type` ∈ `sessions | events | analytics | costs | all` (default `all`)
- `format` ∈ `json | csv | md` (default `json`)

Set `TYPE` and `FORMAT` from the args (apply the defaults if missing), then run:

```bash
TYPE="${1:-all}"; FORMAT="${2:-json}"
curl -s "http://localhost:4820/api/settings/export?type=${TYPE}&format=${FORMAT}" \
  -o "ccam-export-${TYPE}.${FORMAT}"
```

Then:
1. Confirm the file was written and report its absolute path and byte size.
2. Preview the result: for `csv`/`md` print the first ~15 lines; for `json`
   print a pretty-printed head (e.g. `head -c 1500` or the first array element
   plus the record count).
3. Print a one-line summary: `Exported <type> as <format> → <path> (<N> records / <bytes>)`.

If the curl returns a non-200 or an error body, do not claim success — print the
error and remind the user to start the dashboard with `npm start` from the repo
root. Do not delete or overwrite any existing data; this command only reads via
the export endpoint and writes a new export file.
