---
description: >
  Compare this period's reliability against the prior period using Agent Monitor
  data — error rate (APIError/total) and tool-failure rate (PreToolUse→PostToolUse
  gap) — flag any regression where reliability got worse, and optionally wire a
  persistent alert rule so the dashboard catches the next regression
  automatically. Use when checking whether reliability degraded.
---

# Regression Alert

Detect whether Claude Code reliability is getting worse period-over-period, and
optionally arm an alert so it never has to be checked by hand again. Scope is
reliability/failures only — for cache/cost/compaction drift, use ccam-insights'
`regression-watch` instead.

## Input

The user provides: **$ARGUMENTS**

This may be:
- empty or "all" — check error rate and tool-failure rate (default)
- "errors" — APIError-rate regression only
- "tools" — tool-failure-rate regression only
- a window like "7 vs 7" or "30 vs 30" — recent vs baseline window sizes (default: last 7 days vs the prior 7)
- "arm" — after reporting, also create an alert rule via `POST /api/alerts/rules` (only on explicit request)

## Data Sources

| Endpoint | Returns |
|----------|---------|
| `GET /api/analytics` | `daily_events` (365d), `daily_sessions` (365d), `event_types` — split into recent vs baseline windows to compute per-window failure rates |
| `GET /api/events?session_id=X` | Per-session stream — localize a regression to the sessions driving it |
| `GET /api/alerts/rules` | Existing alert rules — check whether a matching reliability rule already exists before arming a new one |
| `POST /api/alerts/rules` | Create a new alert rule (only when the user says "arm") |

## Report Sections

### 1. Windowing
Split history into a **recent window** (newer) and a **baseline window** (the equal-length period just before it). Default: recent = last 7 days, baseline = the prior 7. Use `daily_events`/`daily_sessions` to bucket counts by day.

### 2. Error-Rate Regression
- Per window: `error rate = APIError count / total events`.
- Compare recent vs baseline. Flag if recent is higher. Report absolute change (pp) and relative change (%), plus the recent sessions contributing the most `APIError` events.

### 3. Tool-Failure-Rate Regression
- Per window: `tool-failure rate = (PreToolUse − PostToolUse) / PreToolUse`.
- Compare recent vs baseline. Flag a rising rate as a reliability regression. Name the tools whose gap grew most.

### 4. Verdict
Roll up which rates regressed, rank by relative worsening, and name the most likely driver.

### 5. Optional — Arm an Alert
**Only if the user passed "arm".** First `GET /api/alerts/rules` to avoid duplicates. Then `POST /api/alerts/rules` with a rule that fires when the regressed metric crosses a threshold near the recent value (e.g., error rate > recent rate). Echo the created rule back; do not create webhooks or fire alerts.

## Output

- A Markdown table: metric | baseline | recent | Δ (pp) | Δ (%) | direction (▲ worse / ▼ better) | verdict.
- Tag each metric 🔴 (clear regression), 🟡 (within noise), or 🟢 (improved).
- Rates as percentages to 2 decimals; any currency in USD to 4 decimals.
- List the specific session IDs that contributed most to any regression.
- End with the single highest-priority regression and a concrete next step (and, if armed, the new rule's id/threshold).
- Read-only **except** the explicit "arm" path, which is the only write. Never mutate alert rules otherwise. If `curl` cannot reach `http://localhost:4820`, tell the user to start the dashboard with `npm start` from the repo root.
