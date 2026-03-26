# Superpowers Workspace

This directory contains project-specific configuration and artifacts for the Superpowers workflow.

It acts as the working memory layer for agent-driven development, enabling structured planning, execution, and iteration across sessions.

---

## Purpose

Superpowers transforms coding agents into structured, process-driven collaborators. Instead of jumping straight into code, the agent:

1. Clarifies intent
2. Produces a design
3. Breaks work into executable steps
4. Executes via subagents
5. Verifies and iterates

This directory stores the outputs of that workflow so progress is persistent, inspectable, and reproducible.

---

## Directory Structure

Typical contents may include:

```
.superpowers/
├── brainstorm/        # Design explorations and refined specs
├── plans/             # Task breakdowns and execution plans
├── reviews/           # Code review outputs and feedback
├── runs/              # Execution logs or agent traces
└── README.md          # This file
```

> Exact structure may evolve depending on which skills are triggered.

---

## Workflow Overview

Superpowers operates through automatic skill activation:

### 1. Brainstorming

* Refines vague ideas into concrete specs
* Explores alternatives
* Produces structured, reviewable design docs

### 2. Planning

* Converts approved designs into granular tasks
* Each task is:

  * Small (2–5 min)
  * Explicit (exact file paths + code)
  * Verifiable

### 3. Execution

* Tasks are executed by subagents
* Includes:

  * Spec compliance checks
  * Code quality review
* Can run sequentially or in parallel

### 4. Verification

* Enforces test-first development (TDD)
* Ensures correctness before completion
* Prevents silent regressions

### 5. Completion

* Validates final state
* Offers merge / PR / discard options
* Cleans up working branches

---

## Key Principles

* **Test-first development** (RED → GREEN → REFACTOR)
* **Small, deterministic tasks**
* **Explicit over implicit**
* **Process over intuition**
* **Verification over assumption**

---

## How to Use

You don’t interact with this directory directly most of the time.

Instead:

* Start a task in your coding agent (Claude, Cursor, etc.)
* Let Superpowers skills activate automatically
* Review outputs when prompted (designs, plans, reviews)

Artifacts will be written here as the workflow progresses.

---

## When to Look Here

Check this directory when you want to:

* Review the current plan
* Inspect prior design decisions
* Debug agent behavior
* Resume interrupted work
* Audit what was executed

---

## Notes

* Files here are **source-of-truth for agent state**
* Safe to commit (recommended for team workflows)
* Avoid manual edits unless you understand the workflow implications

---

## Related

* Project root `CLAUDE.md` → global agent context
* `.claude/` → rules, skills, and subagents
* Superpowers upstream docs → 
