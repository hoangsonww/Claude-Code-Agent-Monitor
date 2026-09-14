# Translation Style and Glossary

Terminology drift — the same concept rendered three ways on three pages — is the
most common review comment on localization PRs. This file is the tie-breaker.

## Never translate

| Category | Examples |
|---|---|
| Code and commands | anything inside `<code>` / backticks, `npm run dev`, `ccam sessions` |
| Paths and URLs | `client/src/i18n/index.ts`, `~/.claude/settings.json`, any link target |
| Env vars and CLI flags | `DASHBOARD_TOKEN_REPAIR`, `--list`, `PORT` |
| HTTP | `GET`, `POST`, `404`, `WebSocket`, `SSE` |
| Identifiers | function, class, table, column, and namespace names |
| Claude Code vocabulary | hook events (`PreToolUse`, `PostToolUse`, `Stop`, `SessionStart`, `Notification`), tool names (`Bash`, `Agent`, `Read`, `Edit`) — the **tool** `Agent` is an identifier and is never translated in any locale |
| Brand and product names | Claude Code, Codex, MCP, SQLite, Express, React, Vite, Prometheus, Grafana, Tabby |
| Numbers with units | `~50,000 inserts/sec`, `200 KB / 63 KB gzip`, `< 5ms` |

**Two different things are spelled `Agent`.** The Claude Code **tool** named
`Agent` (alongside `Bash`, `Read`, `Edit`) is an identifier and stays literal in
**every** locale, everywhere it appears — hook-event tables, tool lists, event
names. The **UI noun** for an agent (`common:agent` / `common:subagent`) is
product vocabulary with a per-locale contract, and only that noun has the
Spanish exception below. Never carry the exception into the tool name.

**As product vocabulary, `Agent` and `Subagent` are not ordinary English
words** — but the repo does not treat them identically in every locale, and
`client/src/i18n/__tests__/i18n.test.ts` pins the actual contract:

| Locale | `common:agent` | `common:subagent` |
|---|---|---|
| `zh` / `vi` / `ko` | `Agent` (literal) | `Subagent` (literal) |
| `es` | `agente` | `subagente` |

Spanish localizing the pair is deliberate and asserted, not drift — Spanish has
no comfortable way to carry the bare English noun through inflected prose. So
keep `Agent` literal in `zh`, `vi`, and `ko` (`运行 Agent`, `Chạy Agent`,
`Agent 실행`) and follow the Spanish convention in `es` (`Ejecutar agente`).
**If you add a locale, decide this explicitly and add its row to the test** —
do not leave it to whichever phrasing the first translated string happens to use.

A wiki block whose content is *entirely* code, identifiers, or product names
needs no `wiki/i18n-content.js` entry — it correctly falls back to English.

## Core glossary

Established renderings. Match these; do not introduce a synonym.

| English | `zh` | `vi` | `ko` | `es` |
|---|---|---|---|---|
| Dashboard | 仪表盘 | Tổng quan | 대시보드 | Panel |
| Kanban Board | Kanban 看板 | Bảng Kanban | 칸반 보드 | Tablero Kanban |
| Sessions | 会话 | Phiên | 세션 | Sesiones |
| Activity Feed | 活动流 | Luồng hoạt động | 활동 피드 | Feed de Actividad |
| Analytics | 分析 | Phân tích | 분석 | Analíticas |
| Workflows | 工作流 | Quy trình | 워크플로 | Flujos |
| Alerts | 警报 | Cảnh báo | 알림 | Alertas |
| Agent Config | Agent 配置 | Cấu hình Agent | Agent 설정 | Configuración del agente |
| Run Agent | 运行 Agent | Chạy Agent | Agent 실행 | Ejecutar agente |
| Settings | 设置 | Cài đặt | 설정 | Configuración |
| Live | 在线 | Trực tiếp | 실시간 | En vivo |
| Disconnected | 已断开 | Mất kết nối | 연결 끊김 | Desconectado |

### Session status vocabulary

These five values appear in filters, badges, charts, the Kanban columns, and
every state-machine diagram in the docs. Keep them identical everywhere.

| English | `zh` | `vi` | `ko` | `es` |
|---|---|---|---|---|
| Active | 活跃 | Đang hoạt động | 활성 | Activas |
| Waiting | 等待中 | Đang chờ | 대기 중 | En espera |
| Completed | 已完成 | Hoàn tất | 완료됨 | Completadas |
| Error | 错误 | Lỗi | 오류 | Error |
| Abandoned | 已废弃 | Bị bỏ dở | 중단됨 | Abandonadas |

When adding a new locale, extend both tables in this file with its column before
you start translating — deciding the vocabulary once up front is what keeps 15
namespaces and a 7,000-line wiki bundle coherent.

## Mechanics

- **Interpolation tokens are literal.** `{{count}}`, `{{name}}`, `%{value}` must
  survive verbatim; only their surrounding words are translated. Reordering
  around a token is fine and often necessary.
- **Plurals use the i18next v4 JSON suffixes `_one` / `_other`** (the client is
  on i18next 26). A handful of legacy `_plural` keys survive in `kanban.json`
  and `sessions.json`; v4 no longer resolves them — do not copy that pattern
  into new keys. Because the parity test requires an **identical key set in
  every locale**, `zh`, `vi`, and `ko` must still carry both `_one` and
  `_other` even though they have no plural inflection: give both the same
  string. `es` gets genuinely different forms, as English does.
- **Inline markup is preserved exactly.** A `wiki/i18n-content.js` value must
  contain the same set of `<code>`, `<strong>`, `<a>`, and `<span>` tags as its
  English key, with the same attributes. Dropping a tag silently breaks the
  page's styling and links in that locale only.
- **Length matters in the UI.** Sidebar labels, buttons, table headers, and
  Kanban column titles live in fixed-width space. After translating, check a
  narrow viewport; prefer the shorter natural phrasing over a literal one.
- **Wiki blocks have length budgets** (feature cards ~450–550 chars, screenshot
  captions ~150–300). A translation that doubles the English length breaks the
  carousel layout. See `.claude/rules/wiki-i18n.md`.
- **Tone matches the English**: direct, technical, second person, no marketing
  filler. Documentation register, not advertising.

## README mirrors

- Mirror **structure first**: same headings in the same order, same tables with
  the same rows and column counts, same code blocks, same mermaid diagrams.
- In mermaid, translate **labels only** — node IDs, arrows, and directives stay
  as written, or the diagram stops parsing.
- Keep badges, links, and anchors pointing at the same targets as `README.md`.
- Numbers quoted in prose (plugin counts, skill counts, namespace counts) must
  match the English exactly; they are asserted in
  `server/__tests__/plugins-marketplace.test.js`.
