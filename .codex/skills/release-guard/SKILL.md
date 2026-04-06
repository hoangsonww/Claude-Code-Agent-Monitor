---
name: release-guard
description: Run release-readiness checks for this repository. Use when validating docs, scripts, verification coverage, and operational safety before merge or release.
---

# Release Guard Skill

## Workflow
- Check command consistency across docs and `package.json`.
- Verify architecture docs align with current code paths.
- Validate that safety controls are still documented and enforced.
- Report pass/fail with concrete file references.

## Focus areas
- Hook flow and failure behavior.
- Session/agent lifecycle semantics.
- MCP safety gates and host setup instructions.
- Troubleshooting accuracy.

## References
- `references/release-checklist.md`
