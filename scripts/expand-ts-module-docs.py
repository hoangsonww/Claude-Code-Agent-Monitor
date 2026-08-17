#!/usr/bin/env python3
"""
expand-ts-module-docs.py — append rich TSDoc blocks to TypeScript modules (comments only).

Used to deepen in-file documentation for client, MCP, and desktop packages without
changing runtime behavior. Idempotent: skips files that already contain MODULE_GUIDE.

@author Son Nguyen <hoangson091104@gmail.com>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

AUTHOR = "@author Son Nguyen <hoangson091104@gmail.com>"
MARKER = "MODULE_GUIDE"

EXPORT_RE = re.compile(
    r"^export\s+(?:async\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)",
    re.MULTILINE,
)
IMPORT_RE = re.compile(
    r"""^import\s+(?:type\s+)?(?:\{[^}]+\}|\w+)\s+from\s+['"]([^'"]+)['"]""",
    re.MULTILINE,
)


def topic_blurb(path: Path) -> str:
    rel = path.as_posix()
    name = path.stem
    hints: list[str] = []

    if "RemoteSources" in name or "remote" in rel.lower():
        hints.append(
            "Supports federated dashboards: register SSH-backed or file-synced remote "
            "machines, health-check tunnels, and scope the entire UI to local vs all vs "
            "selected sources."
        )
    if "prometheus" in rel.lower() or "metrics" in rel.lower():
        hints.append(
            "Relates to the `/api/metrics` Prometheus exposition endpoint and the optional "
            "native/Docker Grafana stack under `monitoring/`."
        )
    if "ssh" in rel.lower():
        hints.append(
            "Covers SSH key management, jump-host tunnels, and secure remote ingestion "
            "paths used by Remote Data Sources."
        )
    if path.parts[0:2] == ("client", "src") and path.parts[2:3] == ("pages",):
        hints.append(
            "Route-level screen mounted by `App.tsx`; fetches scoped REST data, subscribes "
            "to WebSocket deltas via `eventBus`, and renders inside `Layout`."
        )
    if path.parts[0:2] == ("mcp", "src"):
        hints.append(
            "Part of the local MCP server (`npm run mcp:start`) that exposes dashboard "
            "operations as MCP tools for Claude Code and other hosts."
        )
    if path.parts[0:2] == ("desktop", "src"):
        hints.append(
            "Electron main/preload process code for the packaged desktop app — embeds the "
            "Express server, manages tray/window lifecycle, and writes discovery metadata."
        )
    if "workflow" in rel.lower():
        hints.append(
            "Workflow analytics visualization built on D3; consumes aggregated session/run "
            "metrics from the workflows API."
        )
    if "conversation" in rel.lower():
        hints.append(
            "Renders Claude transcript rows (user, assistant, tool calls) inside Session "
            "Detail with markdown, syntax highlighting, and TUI-style segments."
        )
    if "Tabby" in rel:
        hints.append(
            "Tabby is the optional on-screen cat assistant — quips, intents, and lightweight "
            "event reactions layered above the dashboard chrome."
        )
    if "hook" in rel.lower() or name.startswith("use"):
        hints.append(
            "React hook: isolates side effects and subscription wiring so presentational "
            "components stay declarative."
        )
    if rel.endswith("lib/api.ts"):
        hints.append(
            "Central typed HTTP client for every REST route; attaches auth token, data-scope "
            "`sources` query params, and normalizes error payloads."
        )
    if rel.endswith("lib/types.ts"):
        hints.append(
            "Shared wire-format types for REST + WebSocket messages — keep in sync with "
            "`server/` serializers and OpenAPI."
        )
    if rel.endswith("eventBus.ts"):
        hints.append(
            "In-memory pub/sub bus bridging `useWebSocket` to any page without prop drilling."
        )
    if not hints:
        hints.append(
            "Dashboard module consumed by the React client, MCP tools, or desktop shell "
            "depending on deployment mode."
        )
    return " ".join(hints)


def list_exports(source: str) -> list[str]:
    return EXPORT_RE.findall(source)


def list_imports(source: str) -> list[str]:
    seen: list[str] = []
    for m in IMPORT_RE.finditer(source):
        mod = m.group(1)
        if mod.startswith(".") and mod not in seen:
            seen.append(mod)
    return seen[:12]


def build_guide(path: Path, source: str) -> str:
    exports = list_exports(source)
    imports = list_imports(source)
    rel = path.as_posix()
    blurb = topic_blurb(path)

    lines = [
        "",
        "/* =============================================================================",
        f" * {MARKER} — extended in-file reference (comments only; safe to read, never executed)",
        " * =============================================================================",
        f" * **Path:** `{rel}`",
        f" * **Purpose:** {blurb}",
        " *",
        " * ## Design constraints",
        " * - Local-first: no telemetry leaves the machine unless the user configures webhooks.",
        " * - Fail-safe hooks path on the server must never block Claude Code; UI mirrors that",
        " *   philosophy by degrading gracefully (empty states, stale badges, reconnect loops).",
        " * - Destructive flows stay behind explicit confirmation modals and server-side gates.",
        " * - Internationalization: user-visible strings belong in i18n JSON, not literals here.",
        " *",
        " * ## Remote data & SSH",
        " * Remote Data Sources let operators aggregate multiple machines. SSH entries describe",
        " * how to reach a peer dashboard; the global data scope (`dataScope.ts`) narrows every",
        " * scoped GET via `?sources=`. Health checks and import history surface in Settings.",
        " *",
        " * ## Observability",
        " * Prometheus scrapes `GET /api/metrics` (see `monitoring/`). Grafana ships four",
        " * provisioned boards (overview, sessions, tools, alerts). Native npm scripts and",
        " * Docker Compose profiles are documented in `monitoring/README.md`.",
        " *",
    ]

    if imports:
        lines.append(" * ## Internal dependencies")
        for imp in imports:
            lines.append(f" * - `{imp}`")
        lines.append(" *")

    if exports:
        lines.append(" * ## Public surface")
        for name in exports[:40]:
            lines.append(f" * - `{name}` — exported API; see TSDoc on the symbol for behavior.")
        if len(exports) > 40:
            lines.append(f" * - … plus {len(exports) - 40} additional exports")
        lines.append(" *")

    lines.extend(
        [
            " * ## Testing pointers",
            " * - Prefer colocated `__tests__` with Vitest + Testing Library for UI.",
            " * - Server contract changes require `npm run test:server` and OpenAPI sync.",
            " * - MCP edits: `npm run mcp:typecheck` and `npm run mcp:build`.",
            " *",
            " * ## Related docs",
            " * - `ARCHITECTURE.md` — hooks → API → SQLite → WebSocket → UI pipeline.",
            " * - `docs/API.md` — REST reference.",
            " * - `.claude/skills/file-headers/` — mandatory `@author` header policy.",
            " * ============================================================================= */",
        ]
    )

    block = "\n".join(lines)

    if exports:
        catalog = [
            "",
            "/* -----------------------------------------------------------------------------",
            " * EXPORT CATALOG — quick index of symbols defined below (documentation only).",
            " * -----------------------------------------------------------------------------",
        ]
        for name in exports:
            catalog.extend(
                [
                    f" * **{name}**",
                    " *   Part of this module's public contract. Downstream imports should treat",
                    " *   the signature and return type as stable unless release notes say otherwise.",
                    " *   When behavior changes, update the `@file` overview and relevant tests.",
                    " *",
                ]
            )
        catalog.append(" * ----------------------------------------------------------------------------- */")
        block += "\n".join(catalog) + "\n"

    return block


def insert_guide(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    if MARKER in source:
        return False
    if AUTHOR not in source:
        print(f"SKIP (no author header): {path}")
        return False

    m = re.search(r"/\*\*[\s\S]*?\*/", source)
    if not m:
        print(f"SKIP (no file header block): {path}")
        return False

    guide = build_guide(path, source)
    updated = source[: m.end()] + guide + source[m.end() :]
    path.write_text(updated, encoding="utf-8")
    return True


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Usage: expand-ts-module-docs.py <glob-root> [...]", file=sys.stderr)
        return 1

    root = Path(__file__).resolve().parents[1]
    changed = 0
    for arg in argv[1:]:
        for path in sorted(root.glob(arg)):
            if not path.is_file():
                continue
            if path.suffix not in {".ts", ".tsx"}:
                continue
            if "__snapshots__" in path.parts or "__tests__" in path.parts:
                continue
            if insert_guide(path):
                print(f"expanded: {path.relative_to(root)}")
                changed += 1
    print(f"Done — {changed} file(s) updated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
