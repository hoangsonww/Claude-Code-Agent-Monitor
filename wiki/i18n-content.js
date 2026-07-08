/* AUTO-GENERATED wiki body-content translations (zh / vi). Do not hand-edit.
 * Keys are whitespace-normalized English innerHTML; values keep inline tags.
 * 'plain' fills heading/label gaps in script.js's T (existing T wins). */
window.__WIKI_CONTENT_I18N = {
  zh: {
    '<span class="caption-icon">📡</span> Live dashboard — real-time agent cards, stats, and activity feed':
      '<span class="caption-icon">📡</span> 实时仪表盘 — 实时的 agent 卡片、统计数据和活动流',
    "Claude Code Agent Monitor integrates with Claude Code through its native hook system. When Claude Code performs any action — tool use, session start, subagent orchestration, session end — it fires a hook that calls a small Node.js script bundled with this project. That script forwards the event over HTTP to the dashboard server, which stores it in SQLite and broadcasts it to the browser over WebSocket.":
      "Claude Code Agent Monitor 通过 Claude Code 的原生 hook 系统与之集成。当 Claude Code 执行任何操作时——工具使用、会话开始、subagent 编排、会话结束——它都会触发一个 hook，调用本项目附带的一个小型 Node.js 脚本。该脚本通过 HTTP 将事件转发给仪表盘服务器，服务器将其存入 SQLite 并通过 WebSocket 广播到浏览器。",
    "End-to-end data pipeline from Claude Code to the browser":
      "从 Claude Code 到浏览器的端到端数据管道",
    "Local-first by design": "本地优先的设计理念",
    "The server binds <code>127.0.0.1</code> (loopback) by default, so it is not network-reachable and everything runs on your machine. No data leaves your system. No API keys. No external services. Exposing it more widely is opt-in via <code>DASHBOARD_HOST</code> and should be paired with <code>DASHBOARD_TOKEN</code>.":
      "服务器默认绑定 <code>127.0.0.1</code>（回环地址），因此它不可通过网络访问，一切都在你的机器上运行。没有数据离开你的系统。无需 API 密钥。无需外部服务。如需更大范围地暴露，则需通过 <code>DASHBOARD_HOST</code> 主动开启，并应搭配 <code>DASHBOARD_TOKEN</code> 一起使用。",
    "Every feature is driven by real hook events — nothing is hardcoded or simulated in production mode.":
      "每项功能都由真实的 hook 事件驱动——在生产模式下没有任何内容是硬编码或模拟的。",
    "Two tabs: <strong>Monitor</strong> shows overview stats, active agent cards with collapsible subagent hierarchy, and a recent activity feed whose item count fills available viewport height. <strong>Health</strong> renders a composite system health score ring, storage engine donut chart, cache/error/success gauges, tool invocation bars, subagent effectiveness ratios, model token distribution, and compaction stats. Both tabs auto-refresh every 5 seconds via WebSocket push so the view is always current without manual reload.":
      "两个标签页：<strong>Monitor</strong> 显示概览统计、带可折叠 subagent 层级的活动 agent 卡片，以及一个其条目数量会填满可用视口高度的最近活动流。<strong>Health</strong> 渲染一个综合系统健康评分环、存储引擎环形图、缓存/错误/成功仪表盘、工具调用条形图、subagent 有效性比率、模型 token 分布以及压缩统计。两个标签页都通过 WebSocket 推送每 5 秒自动刷新一次，因此无需手动重新加载视图始终保持最新。",
    "Toggle between <strong>Agents</strong> (Working / Waiting / Completed / Error) and <strong>Sessions</strong> (Active / Waiting / Completed / Error / Abandoned) swim lanes. A yellow <strong>Waiting</strong> column flags items sitting on the user — fresh prompt, between turns, or permission gate. Hover any column header for lifecycle tooltips explaining each state transition. Cards surface model name, cumulative cost, and the current tool being called. Counts update in real time via WebSocket so the board is always in sync with the live event store.":
      "在 <strong>Agents</strong>（Working / Waiting / Completed / Error）和 <strong>Sessions</strong>（Active / Waiting / Completed / Error / Abandoned）泳道之间切换。黄色的 <strong>Waiting</strong> 列标记出等待用户的条目——刚收到的提示、回合之间，或权限关卡。将鼠标悬停在任意列标题上可查看解释每次状态转换的生命周期提示。卡片会展示模型名称、累计成本以及当前正在调用的工具。计数通过 WebSocket 实时更新，因此看板始终与实时事件存储保持同步。",
    "<strong>Server-paginated</strong> table of every recorded session — each page fetches only its slice so cost computation stays bounded no matter how many sessions exist. Case-insensitive search across <code>id</code>, <code>name</code>, and <code>cwd</code> runs server-side with a 300 ms debounce; the status filter composes with search for precise narrowing. Each row shows the session's real name (synced live from the transcript — a <code>/rename</code> or <code>claude -n</code> title, else the auto title, else the first user prompt, with a short-ID fallback), status badge, agent count, duration, model, and estimated cost. Click any row to drill into the full session detail view with conversation transcript and agent hierarchy.":
      "<strong>服务端分页</strong>的表格，列出每一个已记录的会话——每一页只获取它对应的那一段数据，因此无论存在多少会话，成本计算都保持有界。针对 <code>id</code>、<code>name</code> 和 <code>cwd</code> 的不区分大小写搜索在服务端运行，并带有 300 ms 防抖；状态过滤器可与搜索组合以实现精确缩小范围。每一行显示会话的真实名称（从 transcript 实时同步——<code>/rename</code> 或 <code>claude -n</code> 标题，否则使用自动标题，再否则使用首条用户 prompt，并回退到短 ID）、状态徽章、agent 数量、时长、模型和预估成本。点击任意行即可深入查看完整的会话详情视图，包含对话记录和 agent 层级。",
    "Per-session deep dive with a collapsible agent hierarchy tree and a full chronological event timeline showing every tool call name and summary. An overview panel at the top surfaces tile counters for events, tool calls, subagents, compactions, errors, and duration. Top-tool usage bars and a subagent type breakdown give quick distribution reads. The conversation viewer renders markdown with syntax highlighting, per-tool styled blocks, slash-command pills with their captured TUI output, and inline session-rename markers. Export the entire session as JSON or share the permalink for async review.":
      "针对单个会话的深入剖析，配有可折叠的 agent 层级树和一条完整的按时间排序的事件时间线，显示每一次工具调用的名称和摘要。顶部的概览面板展示事件、工具调用、subagent、压缩、错误和时长的磁贴计数器。顶部工具使用条形图和 subagent 类型细分让你快速读取分布情况。对话查看器渲染带语法高亮的 markdown、按工具分类的样式化代码块、带其捕获的 TUI 输出的斜杠命令气泡，以及内联的会话重命名标记。可将整个会话导出为 JSON，或分享永久链接以供异步审阅。",
    "A rules-based alerting engine evaluates the live event stream server-side: <strong>event pattern</strong> (match event type / tool / summary text, optionally N matches within a time window), <strong>inactivity</strong>, <strong>stuck agent</strong>, and <strong>token threshold</strong> — each with per-(rule, session, agent) cooldown dedup. Fired alerts surface in a live feed and fan out to <strong>14 first-class webhook providers</strong> — Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream — plus any generic JSON endpoint (with optional HMAC-SHA256 signing and custom headers). Delivery is detached and fail-safe with a request timeout, bounded retry/backoff, secret redaction, a one-click test probe, and a per-target delivery log. Rules and channels are managed together in <strong>Settings → Alerts</strong>.":
      "一个基于规则的告警引擎在服务端评估实时事件流：<strong>事件模式</strong>（匹配事件类型 / 工具 / 摘要文本，可选地在某个时间窗口内匹配 N 次）、<strong>不活动</strong>、<strong>卡住的 agent</strong> 以及 <strong>token 阈值</strong>——每一种都按（规则、会话、agent）维度进行冷却去重。触发的告警会出现在实时动态流中，并扇出到 <strong>14 个一流的 webhook 提供方</strong>——Slack、Discord、Teams、Google Chat、Mattermost、Rocket.Chat、Telegram、PagerDuty、Opsgenie、Splunk On-Call、Zapier、Make、n8n、Pipedream——外加任意通用 JSON 端点（可选 HMAC-SHA256 签名和自定义 header）。投递是分离且故障安全的，带有请求超时、有界的重试/退避、密钥脱敏、一键测试探针，以及按目标维度的投递日志。规则和通道在 <strong>Settings → Alerts</strong> 中统一管理。",
    "A native desktop app — a macOS <code>.app</code> (shipped as a <code>.dmg</code>) and a Windows <code>.exe</code> (NSIS installer plus a no-install portable build) — built with Electron 35. It <strong>embeds the Express server in-process</strong> — <code>require()</code>-ing <code>server/index.js</code> directly, with no child process and no IPC — and renders the built React client in a <code>BrowserWindow</code>. Adds a menu-bar / notification-area (tray) icon, a native application menu, auto-start at login (macOS Login Items via <code>SMAppService</code>; Windows per-user <code>HKCU\\…\\Run</code>), and a single-instance lock. Closing the window hides it while the server keeps running, and the app auto-installs Claude Code hooks on first boot so an install-only user gets events flowing without a checkout.":
      "一个原生桌面应用——一个 macOS <code>.app</code>（以 <code>.dmg</code> 形式发布）和一个 Windows <code>.exe</code>（NSIS 安装程序外加一个免安装的便携版本）——使用 Electron 35 构建。它 <strong>将 Express 服务器嵌入到同一进程中</strong>——直接 <code>require()</code> 引入 <code>server/index.js</code>，没有子进程也没有 IPC——并在 <code>BrowserWindow</code> 中渲染已构建的 React 客户端。它还添加了菜单栏 / 通知区域（托盘）图标、原生应用程序菜单、登录时自动启动（macOS 通过 <code>SMAppService</code> 使用登录项；Windows 使用按用户的 <code>HKCU\\…\\Run</code>），以及单实例锁。关闭窗口会将其隐藏而服务器继续运行，并且应用会在首次启动时自动安装 Claude Code hook，因此仅安装应用的用户无需检出代码即可让事件开始流入。",
    "Real-time streaming event log showing tool calls, agent state changes, errors, and compaction events as they arrive. Pause/resume with automatic buffering, paginated history for scrollback, and auto-scrolling to the latest entry. Click any row to expand its full hook payload inline. A dedicated <strong>Session →</strong> button navigates directly to session detail without collapsing the expanded state. Every entry is color-coded by event type and grouped by session for quick scanning of concurrent work.":
      "实时流式事件日志，在工具调用、agent 状态变化、错误和压缩事件到达时即刻显示它们。支持带自动缓冲的暂停/恢复、用于回溯的分页历史，以及自动滚动到最新条目。点击任意行即可就地展开其完整的 hook 负载。一个专用的 <strong>Session →</strong> 按钮可直接跳转到会话详情，而不会折叠已展开的状态。每个条目都按事件类型进行颜色编码，并按会话分组，以便快速浏览并发进行的工作。",
    "Token usage breakdown by model with stacked bar charts, tool frequency rankings, agent type distribution donuts, and session outcome pie charts. A 52-week activity heatmap aligned by day-of-week shows density with hover tooltips. 30-day sparkline trends track cost and session volume at a glance. The cost summary panel totals input, output, and cache spend across all models. A live/offline indicator and auto-refresh via WebSocket keep everything current. All charts are responsive and adapt to mobile viewports.":
      "以堆叠条形图按模型细分 token 使用量，工具使用频率排名、agent 类型分布环形图，以及会话结果饼图。一个按星期对齐的 52 周活动热力图通过悬停提示显示密度。30 天迷你折线趋势让你一目了然地跟踪成本和会话量。成本汇总面板汇总所有模型的输入、输出和缓存开销。实时/离线指示器以及通过 WebSocket 的自动刷新让一切保持最新。所有图表都是响应式的，可适配移动端视口。",
    "Every UI update is pushed over a persistent WebSocket with sub-5 ms dispatch latency — zero polling anywhere. If the connection drops, automatic 2-second reconnect kicks in while a ping/pong heartbeat detects stale connections early. A sidebar indicator turns green/red so you always know whether you're live. The WebSocket carries typed JSON envelopes for new events, session updates, agent transitions, compaction results, and import progress — all parsed into the same eventBus the REST layer uses.":
      "每次 UI 更新都通过持久化的 WebSocket 推送，分发延迟低于 5 ms——任何地方都不需要轮询。若连接断开，会自动在 2 秒内重连，同时通过 ping/pong 心跳尽早检测失效连接。侧栏指示灯会变为绿色/红色，让你随时知道是否处于实时连接状态。WebSocket 承载带类型的 JSON 信封，用于新事件、会话更新、智能体转换、压缩结果以及导入进度——全部解析进 REST 层所使用的同一个 eventBus。",
    "Standalone CLI statusline for Claude Code that prints model name, user, working directory, git branch, and a color-coded context-window bar (green → yellow → red). Token counts show input (green ↑), output (cyan ↓), and cache (dim) separately. Session cost in USD shifts color by configurable thresholds. ANSI-colored output updates on every turn. Python-based with a thin shell wrapper — drop it into your prompt or tmux status line. Works with any terminal emulator that supports 256-color ANSI.":
      "为 Claude Code 提供的独立 CLI 状态栏，会打印模型名称、用户、工作目录、git branch，以及一条彩色编码的上下文窗口条（green → yellow → red）。Token 计数分别显示输入（green ↑）、输出（cyan ↓）和缓存（dim）。以 USD 计的会话成本会按可配置的阈值改变颜色。ANSI 着色输出会在每个回合更新。基于 Python，并带有一个轻量的 shell 包装器——将其放入你的提示符或 tmux 状态栏即可。可与任何支持 256 色 ANSI 的终端模拟器配合使用。",
    "Import existing Claude Code sessions from three sources — rescan the default <code>~/.claude/projects</code> folder, scan any absolute path on disk, or drag-drop <code>.jsonl</code>, <code>.zip</code>, <code>.tar.gz</code>, and <code>.gz</code> archives through <b>Settings → Import History</b>. All paths funnel into the same ingestion pipeline the server uses for live hooks, so imported tokens and per-model cost match real-time capture exactly. Re-imports are idempotent via session-ID dedup, and archive extraction is guarded against path traversal and zip-bomb expansion.":
      "可从三种来源导入已有的 Claude Code 会话——重新扫描默认的 <code>~/.claude/projects</code> 文件夹、扫描磁盘上的任意绝对路径，或通过 <b>Settings → Import History</b> 拖放 <code>.jsonl</code>、<code>.zip</code>、<code>.tar.gz</code> 和 <code>.gz</code> 归档文件。所有路径都汇入服务器用于实时 hook 的同一条摄取管道，因此导入的 token 和按模型计的成本与实时捕获完全一致。通过会话 ID 去重，重复导入是幂等的；归档解压则会防范路径遍历与 zip 炸弹膨胀。",
    "The startup auto-import of <code>~/.claude/projects</code> is one-time and marker-gated, so a project folder created after first launch — whose sessions never flow through hooks (for example with host-only hooks disabled) — would stay invisible until a manual rescan. A background sync closes that gap with three triggers sharing one mtime cache and a single coalesced sweep: an immediate sweep at startup, a debounced <code>fs.watch</code> (recursive on macOS and Windows; root plus immediate child folders on Linux to avoid the userland recursive-watcher hazard) that fires the moment a new session file or project folder appears, and a periodic safety-net poll tunable via <code>DASHBOARD_SESSION_SYNC_MS</code> (default <code>30000</code> ms; <code>0</code> disables the poll while leaving the watcher running). Each sweep re-parses only files whose mtime advanced and broadcasts <code>session_created</code> / <code>session_updated</code> (plus the main agent) so the UI refreshes live, while an already-imported unchanged session is skipped without re-parsing.":
      "对 <code>~/.claude/projects</code> 的启动时自动导入是一次性的，并由标记控制，因此首次启动之后创建的项目文件夹——其会话从不经由 hook 流入（例如禁用了仅主机的 hook）——在手动重新扫描之前都不会显示。一个后台同步通过三个共享同一个 mtime 缓存和单次合并扫描的触发器弥补这一缺口：启动时的一次立即扫描、一个去抖动的 <code>fs.watch</code>（在 macOS 和 Windows 上递归；在 Linux 上监听根目录加各个直接子文件夹，以规避用户态递归监听器的隐患），它会在出现新的会话文件或项目文件夹的那一刻触发，以及一个可通过 <code>DASHBOARD_SESSION_SYNC_MS</code> 调节的周期性安全网轮询（默认 <code>30000</code> ms；<code>0</code> 会禁用轮询但保留监听器）。每次扫描仅重新解析 mtime 已推进的文件，并广播 <code>session_created</code> / <code>session_updated</code>（外加主 agent），从而让 UI 实时刷新；而对于已导入且未变更的会话则会被跳过，不再重新解析。",
    "Incremental JSONL reader shared across the hook handler, compaction scanner, conversation viewer, and import pipeline. Byte-offset tracking skips already-parsed content; cache hits short-circuit disk I/O so even sessions with tens of thousands of turns stay fast. It also extracts the live session title (<code>custom-title</code> / <code>ai-title</code>) so renames surface in real time, plus the first user prompt as a fallback descriptor for placeholder-named sessions and agents.":
      "增量式 JSONL 读取器，在 hook 处理器、压缩扫描器、对话查看器和导入管道之间共享。字节偏移跟踪会跳过已解析的内容；缓存命中会短路磁盘 I/O，因此即便是有数万个回合的会话也能保持快速。它还会提取实时的会话标题（<code>custom-title</code> / <code>ai-title</code>），使重命名能实时呈现，并提取首条用户 prompt，作为占位命名的会话与 agent 的后备描述符。",
    "LRU eviction of cold session buffers plus a tail-cap on per-entry growable arrays (turn durations, API errors, compaction entries). A session that runs for days cannot grow a single cache entry without bound, and each entry stores its parsed result only once — no shadow copy.":
      "对冷会话缓冲区进行 LRU 淘汰，并对每个条目的可增长数组（回合时长、API 错误、压缩条目）设置尾部上限。运行数天的会话也无法让任何单个缓存条目无限增长，而且每个条目只存储一次其解析结果——没有影子副本。",
    "The periodic compaction sweep reads each active session's transcript path directly from <code>sessions.transcript_path</code> (a partial index covers exactly those rows), so the work is O(active sessions) instead of a <code>json_extract</code> scan over the whole events table.":
      "周期性的压缩扫描直接从 <code>sessions.transcript_path</code> 读取每个活跃会话的 transcript 路径（一个部分索引恰好覆盖这些行），因此其工作量为 O(活跃会话数)，而不是对整个事件表进行 <code>json_extract</code> 扫描。",
    "Collapsible parent–child agent tree rendered on both Dashboard and Session Detail. Agents with subagents display expand/collapse chevrons; leaf agents show a dot indicator. The tree auto-expands when any child transitions to active and correctly tracks backgrounded subagents without premature completion. Depth is unlimited — deeply nested chains render as indented rows with connecting lines. Each node shows model, current tool, status badge, and cumulative token cost for tracing spend down the spawn chain.":
      "可折叠的父子智能体树，同时在 Dashboard 和 Session Detail 上渲染。带有子智能体的智能体会显示展开/折叠的箭头；叶子智能体显示一个圆点指示符。当任意子节点转为活跃时，树会自动展开，并能正确跟踪后台运行的子智能体而不会过早标记完成。深度不受限制——深层嵌套的链会渲染为带连接线的缩进行。每个节点都会显示模型、当前工具、状态徽章以及累计 token 成本，便于沿生成链追踪开销。",
    "Per-model cost estimation with configurable pricing rules — set input, output, and cache-read rates per model variant through the Settings UI. View total and per-session breakdowns on Sessions, Session Detail, and Analytics. Compaction- aware token accounting preserves baselines across context compressions so no usage is silently dropped. Cost chips appear on Kanban cards, session rows, and the sidebar summary. Subagent cards show each subagent's own cost, computed from that subagent's transcript token usage priced at current rates, so a subagent card no longer misleadingly reads as if it cost the whole session; main-agent cards still show the session total. Pricing changes retroactively recalculate all stored sessions, and imports apply the same rate table.":
      "按模型估算成本，配以可配置的定价规则——通过 Settings UI 为每个模型变体设置输入、输出和缓存读取的费率。可在 Sessions、Session Detail 和 Analytics 上查看总计及按会话的明细。具备压缩感知的 token 计量会在上下文压缩过程中保留基线，因此不会有任何用量被悄悄丢弃。成本标签会出现在看板卡片、会话行和侧栏汇总中。subagent 卡片会显示该 subagent 自身的成本，它按当前费率对该 subagent transcript 的 token 用量计算得出，因此 subagent 卡片不会再误导性地显示得好像它花掉了整个会话的费用；主 agent 卡片仍显示会话总计。定价变更会追溯重算所有已存储的会话，导入也会套用同一张费率表。",
    "Model pricing editor with per-token rate configuration for every Claude variant. Hook installation status with one-click reinstall and per-hook health checks. Full JSON data export covering sessions, agents, events, tokens, and pricing rules. Session cleanup controls to abandon stale sessions or purge old data by age. Browser notification preferences with per-event toggles. A system information panel shows database row counts, file sizes, server uptime, and WebSocket connection status at a glance.":
      "模型定价编辑器，可为每个 Claude 变体配置按 token 计的费率。Hook 安装状态，支持一键重装以及对每个 hook 的健康检查。完整的 JSON 数据导出，涵盖会话、智能体、事件、token 和定价规则。会话清理控件，可放弃陈旧会话或按时长清除旧数据。浏览器通知偏好，支持按事件切换。系统信息面板可一目了然地显示数据库行数、文件大小、服务器运行时间以及 WebSocket 连接状态。",
    "Local MCP sidecar with three transport modes — stdio for Claude Code native integration, HTTP+SSE for remote clients, and an interactive REPL for ad-hoc terminal queries. Exposes 25 typed tools across 6 domains: sessions, agents, events, analytics, settings, and system health. Every mutation is gated behind a tiered policy so nothing dangerous fires without opt-in. Retry-aware API access handles transient failures. Runs as a standalone Node process with no Docker or cloud dependency.":
      "本地 MCP 边车，提供三种传输模式——用于 Claude Code 原生集成的 stdio、用于远程客户端的 HTTP+SSE，以及用于临时终端查询的交互式 REPL。在 6 个领域中暴露 25 个带类型的工具：会话、智能体、事件、分析、设置和系统健康。每个写操作都受分级策略把关，因此任何危险操作都不会在未经选择启用的情况下触发。具备重试感知的 API 访问可处理瞬时故障。作为独立的 Node 进程运行，不依赖 Docker 或云。",
    "Instruction, skills, rules, and custom-agent layers for both Claude Code and Codex. Path-scoped rules target backend, frontend, MCP, and docs directories with context-appropriate guidelines. Reusable skills cover onboarding, feature shipping, live-issue debugging, release-readiness, and MCP operations. Specialized subagents for backend, frontend, and MCP code review run in parallel with focused tooling. Everything lives in <code>.claude/</code> and is version-controlled alongside the codebase.":
      "为 Claude Code 和 Codex 同时提供指令、技能、规则以及自定义智能体层。按路径作用域的规则会针对 backend、frontend、MCP 和 docs 目录，配以贴合上下文的准则。可复用的技能涵盖入门引导、功能发布、实时问题调试、发布就绪检查以及 MCP 运维。用于 backend、frontend 和 MCP 代码评审的专用子智能体会借助聚焦的工具并行运行。所有内容都位于 <code>.claude/</code> 中，并与代码库一起进行版本管理。",
    "D3.js-powered visualizations: an agent orchestration DAG showing spawn patterns across sessions, a tool-execution Sankey diagram mapping tool-to- tool transitions, and a directed pipeline graph with frequency labels. Every chart title carries an info icon that opens a popover explaining what it shows and how to read it. Hovering nodes, edges, and bars surfaces tooltips with share-of-source percentages, success-rate buckets, and timing patterns. All labels are translated to English, Vietnamese, and Chinese.":
      "由 D3.js 驱动的可视化：一个展示跨会话生成模式的智能体编排 DAG、一个映射工具到工具转换的工具执行 Sankey 图，以及一个带频率标签的有向管道图。每个图表标题都带有一个信息图标，点击可打开弹出框，说明它展示了什么以及如何解读。悬停在节点、边和条形上会浮现工具提示，显示来源占比、成功率分桶和时序模式。所有标签都已翻译为英语、越南语和中文。",
    "Subagent effectiveness scorecards with success-rate rings and day-of-week sparklines. Auto-detected workflow patterns expand on click into a detail panel with the full step chain, stats grid, and a narrative with loop detection. Model delegation flow, error propagation bars with API error cards, concurrency swim-lanes, and complexity bubble charts round out the view. Six headline stat cards each include an info popover explaining the metric and its current value. Status filter applies globally.":
      "子智能体有效性记分卡，配有成功率环形图和按星期几的迷你折线图。自动检测出的工作流模式可点击展开为详情面板，包含完整的步骤链、统计网格以及带循环检测的叙述。模型委派流、带 API 错误卡片的错误传播条、并发泳道以及复杂度气泡图共同充实了该视图。六张头条统计卡片各自带有一个信息弹出框，说明该指标及其当前值。状态筛选器全局生效。",
    "Searchable session selector with pagination to explore any session's agent tree, tool-call timeline, and event sequence. The detail page opens with a live-updating overview — tile counters for events, tool calls, subagents, compactions, errors, and duration. Top-tool usage bars and subagent breakdown give quick reads. The conversation viewer renders markdown with syntax highlighting. Cross-filter from DAG nodes, run compaction analysis, or export as JSON — all with real-time WebSocket auto-refresh.":
      "可搜索的会话选择器，带分页，用于探索任意会话的智能体树、工具调用时间线和事件序列。详情页打开时会呈现一个实时更新的概览——针对事件、工具调用、子智能体、压缩、错误和时长的磁贴计数器。顶级工具使用条和子智能体细分可供快速浏览。对话查看器会渲染带语法高亮的 markdown。可从 DAG 节点进行交叉筛选、运行压缩分析或导出为 JSON——所有这些都带有实时的 WebSocket 自动刷新。",
    "Persistent browser notifications via Web Push (VAPID) for real-time alerts even when the tab is not focused or the browser is backgrounded. Includes macOS audio support so notifications are audible alongside system sounds. Per-event toggles let you choose which events fire — session starts, completions, errors, compactions, or agent spawns. Server-side subscription management ensures one push per event per browser. Works on Chrome, Edge, Firefox, and Safari 17+ with graceful degradation elsewhere.":
      "通过 Web Push（VAPID）提供持久化的浏览器通知，即便标签页未聚焦或浏览器处于后台也能实时提醒。包含 macOS 音频支持，因此通知会与系统声音一并发出。按事件的开关让你选择哪些事件触发——会话开始、完成、错误、压缩或智能体生成。服务端的订阅管理确保每个事件在每个浏览器上只推送一次。可在 Chrome、Edge、Firefox 和 Safari 17+ 上运行，在其他环境下则会优雅降级。",
    "Ready-to-use Dockerfile and docker-compose.yml for one-command deployment. Supports both Docker and Podman with persistent volume mounts for the SQLite database and hook data. Configurable port mapping via environment variables and a health-check endpoint the container runtime can poll. Multi-stage build keeps the image lean — only production deps and the compiled bundle ship. Run <code>docker compose up -d --build</code> and the dashboard is live with zero additional setup or configuration required.":
      "开箱即用的 Dockerfile 和 docker-compose.yml，支持一条命令部署。同时支持 Docker 和 Podman，为 SQLite 数据库和 hook 数据提供持久化的卷挂载。可通过环境变量配置端口映射，并提供一个容器运行时可轮询的健康检查端点。多阶段构建让镜像保持精简——只发布生产依赖和编译后的产物。运行 <code>docker compose up -d --build</code>，仪表盘即可上线，无需任何额外的安装或配置。",
    "Official Claude Code plugin marketplace shipping 10 plugins with 53 skills, 14 agents, 30 slash commands, 3 CLI tools, 3 hook configs, and 1 MCP server. Deep analytics with compaction-aware baselines, productivity automation, developer diagnostics, AI-powered workflow intelligence, and dashboard MCP integration. Five newer plugins go further: <code>ccam-cost-guard</code> (budget guardrails, spend forecasts, and cost-threshold alerts), <code>ccam-sessions</code> (session forensics — search, timeline, and transcript replay), <code>ccam-workflows</code> (multi-agent orchestration and fleet intelligence), <code>ccam-quality</code> (reliability and SLO checks), and <code>ccam-config</code> (Claude Code config and memory governance). Install with <code>claude plugin install</code> — no restart needed. Each listing shows author, license, homepage, and per-skill contribution breakdown. The Config Explorer's Plugins tab surfaces installed plugins with live status.":
      "官方 Claude Code 插件市场，发布 10 个插件，包含 53 个技能、14 个智能体、30 个斜杠命令、3 个 CLI 工具、3 个 hook 配置以及 1 个 MCP 服务器。具备压缩感知基线的深度分析、效率自动化、开发者诊断、AI 驱动的工作流智能以及仪表盘 MCP 集成。五个较新的插件更进一步：<code>ccam-cost-guard</code>（预算护栏、支出预测与成本阈值告警）、<code>ccam-sessions</code>（会话取证——搜索、时间线与 transcript 回放）、<code>ccam-workflows</code>（多智能体编排与机群智能）、<code>ccam-quality</code>（可靠性与 SLO 检查）以及 <code>ccam-config</code>（Claude Code 配置与记忆治理）。使用 <code>claude plugin install</code> 安装——无需重启。每个条目都会显示作者、许可证、主页以及按技能的贡献细分。Config Explorer 的 Plugins 标签页会展示已安装的插件及其实时状态。",
    "Spawn <code>claude</code> subprocesses straight from the dashboard with a chat-style streaming UI — multi-turn <b>Conversation</b> or single-shot <b>Headless</b> mode. One-click <b>Resume</b> on any past conversation spawns <code>claude --resume</code> seeded with the prior transcript. Re- attach reconciles in-memory logs with the on-disk JSONL so navigating away never loses history. Slash-command autocomplete, file references, live token/context-window meter, and a thinking-effort dial bring TUI parity to the browser. Same-origin guard blocks drive-by spawns.":
      "直接从仪表盘以聊天式流式 UI 生成 <code>claude</code> 子进程——可选多轮的 <b>Conversation</b> 或单次的 <b>Headless</b> 模式。对任意过往对话一键 <b>Resume</b>，会以先前的 transcript 作为种子生成 <code>claude --resume</code>。重新接入会将内存中的日志与磁盘上的 JSONL 进行协调，因此离开页面也绝不会丢失历史。斜杠命令自动补全、文件引用、实时的 token/上下文窗口计量表以及思考强度旋钮，让浏览器具备与 TUI 同等的体验。同源保护可阻止顺带发起的恶意生成。",
    "A 12-tab inspector at <code>/cc-config</code> for everything Claude Code knows about: skills, subagents, slash commands, output styles, plugins, marketplaces, MCP servers, hooks, settings, memory, keybindings, and statusline scripts. The Settings tab leads with a Current configuration summary of the options <code>/config</code> controls — model, verbose, theme, output style, auto-compact, notifications — resolved across scopes. The Memory tab surfaces both the user and project <code>CLAUDE.md</code> files and the per-project file-based memory store — every auto-memory <code>*.md</code> under <code>~/.claude/projects/&lt;slug&gt;/memory/</code> (a <code>MEMORY.md</code> index plus one file per remembered fact, often 100+), grouped by project, searchable, and editable. Create, edit, and delete the low-risk text-file surfaces with mandatory timestamped backups before every write. Plugins, MCP, hooks, and live settings stay read-only with explainer banners and copy-able CLI commands. Per-plugin contribution breakdowns show author and license.":
      "位于 <code>/cc-config</code> 的 12 个标签页的检查器，涵盖 Claude Code 所知的一切：技能、子智能体、斜杠命令、输出样式、插件、市场、MCP 服务器、hook、设置、记忆、键位绑定和状态栏脚本。设置标签页以一个当前配置摘要为首，跨作用域解析 <code>/config</code> 控制的选项——model、verbose、主题、输出样式、自动压缩、通知。记忆标签页同时呈现用户与项目的 <code>CLAUDE.md</code> 文件，以及按项目划分的基于文件的记忆存储——位于 <code>~/.claude/projects/&lt;slug&gt;/memory/</code> 下的每一个自动记忆 <code>*.md</code> 文件（一个 <code>MEMORY.md</code> 索引外加每条记忆事实一个文件，通常 100 多个），按项目分组、可搜索且可编辑。可创建、编辑和删除低风险的文本文件区域，每次写入前都会强制进行带时间戳的备份。插件、MCP、hook 和实时设置保持只读，并配有说明横幅和可复制的 CLI 命令。按插件的贡献细分会显示作者和许可证。",
    "Mobile-first layouts with stacking grids, horizontally scrollable tables, and a collapsible sidebar that auto-hides below 1400 px. All pages adapt from phone to ultrawide with consistent navigation and readable typography. Kanban columns stack vertically on narrow screens, analytics charts reflow to single-column, and the activity feed stays fully swipeable. Touch targets meet 44 px minimum. Dark theme renders consistently across iOS Safari, Chrome, and Firefox with no flash of unstyled content.":
      "移动优先的布局，采用堆叠网格、可横向滚动的表格，以及在低于 1400 px 时自动隐藏的可折叠侧栏。所有页面都能从手机到超宽屏自适应，并保持一致的导航和可读的排版。在窄屏上看板列会纵向堆叠，分析图表会重排为单列，而活动信息流则保持完全可滑动。触摸目标满足最小 44 px。深色主题在 iOS Safari、Chrome 和 Firefox 上渲染一致，且不会出现无样式内容的闪烁。",
    "Visualize parallel agent execution with a Gantt-style timeline showing overlapping subagent lifetimes, tool-call concurrency windows, and wait gaps. Color-coded bars distinguish working, waiting, and errored states so bottlenecks are immediately visible. Hover any bar for exact timestamps and duration. Zoom and pan across long-running sessions with hundreds of agents. The timeline shares the Workflows status filter so you can isolate active, completed, or errored sessions without leaving the view.":
      "用甘特图风格的时间线可视化并行的智能体执行过程，展示相互重叠的子智能体生命周期、工具调用的并发窗口以及等待间隙。彩色编码的条形区分工作中、等待中和出错状态，使瓶颈一目了然。悬停任意条形可查看精确的时间戳和时长。可在拥有数百个智能体的长时间运行会话中缩放和平移。该时间线共用 Workflows 的状态筛选器，因此你无需离开该视图即可隔离活跃、已完成或出错的会话。",
    "Professional VS Code extension with a real-time Activity Bar sidebar showing active sessions, agent counts, and recent events without leaving your editor. A status bar pulse monitor surfaces connection health and the latest event type at a glance. Deep navigation links open any session or analytics view directly in your browser. An embedded webview renders the full dashboard inside a VS Code tab with WebSocket push, theme sync, and responsive layout. Install from the marketplace or build from source.":
      "专业的 VS Code 扩展，配有实时的 Activity Bar 侧栏，无需离开编辑器即可显示活跃会话、智能体数量和近期事件。状态栏的脉冲监视器可一目了然地展示连接健康状况和最新的事件类型。深度导航链接可直接在浏览器中打开任意会话或分析视图。内嵌的 webview 会在 VS Code 标签页中渲染完整的仪表盘，支持 WebSocket 推送、主题同步和响应式布局。可从市场安装或从源码构建。",
    "Trace how errors cascade across agents and tool calls with a directed graph showing failure origins, retry paths, and recovery points. Each node displays the agent or tool that errored, the error message, and whether a retry succeeded or propagated upstream. Pinpoint root causes in deeply nested subagent chains. Horizontal bar charts rank the most error-prone tools and models. API error cards group failures by HTTP status and endpoint. Filter by session, time range, or error severity to narrow the view.":
      "用一张有向图追踪错误如何在智能体和工具调用之间级联，展示故障源头、重试路径和恢复点。每个节点都会显示出错的智能体或工具、错误消息，以及重试是成功还是向上游传播。可在深层嵌套的子智能体链中精确定位根因。横向条形图会对最易出错的工具和模型进行排名。API 错误卡片会按 HTTP 状态和端点对故障进行分组。可按会话、时间范围或错误严重程度筛选以缩小视图。",
    'Three independent PWAs — dashboard, landing page, and wiki — each with its own Web App Manifest and Service Worker. Install to your home screen or dock for a standalone, chrome-less experience. SVG icons with <code>sizes="any"</code> and iOS standalone meta tags included.':
      '三个独立的 PWA——仪表盘、着陆页和 wiki——各自拥有自己的 Web App Manifest 和 Service Worker。可安装到你的主屏幕或程序坞，获得独立、无浏览器边框的体验。包含带 <code>sizes="any"</code> 的 SVG 图标以及 iOS standalone 元标签。',
    "The dashboard SW serves Vite's hashed <code>/assets/*</code> bundles cache-first (URLs are immutable per build) and treats everything else as network-first with cache fallback. Explicit <code>Cache-Control</code> headers on the production Express static middleware reinforce the policy, so a rebuild replaces the in-browser code without a hard refresh.":
      "仪表盘的 SW 以缓存优先的方式提供 Vite 带哈希的 <code>/assets/*</code> 产物（这些 URL 在每次构建中都是不可变的），并将其他所有内容视为网络优先并以缓存作为回退。生产环境 Express 静态中间件上显式的 <code>Cache-Control</code> 头进一步强化了该策略，因此重新构建无需强制刷新即可替换浏览器中的代码。",
    "A <code>controllerchange</code> listener in <code>client/src/main.tsx</code> reloads the page exactly once when a new SW takes over an already-controlled page. First installs do not reload, so the very first visit is never interrupted.":
      "<code>client/src/main.tsx</code> 中的一个 <code>controllerchange</code> 监听器会在新的 SW 接管一个已受控页面时，恰好重新加载页面一次。首次安装不会重新加载，因此首次访问绝不会被打断。",
    '<span class="caption-icon">📡</span> <span><strong>Dashboard · Monitor</strong> — live overview of active sessions and agents. Stats tiles, collapsible subagent hierarchy cards, and a recent activity feed. Auto-refreshes every 5 s via WebSocket</span>':
      '<span class="caption-icon">📡</span> <span><strong>Dashboard · Monitor</strong> — 活动会话与 agent 的实时概览。统计卡片、可折叠的子 agent 层级卡片，以及最近活动信息流。通过 WebSocket 每 5 s 自动刷新</span>',
    '<span class="caption-icon">🩺</span> <span><strong>Dashboard · Health</strong> — composite health score ring, storage engine donut, cache/error/success gauges, tool invocation bars, subagent effectiveness, and model token distribution</span>':
      '<span class="caption-icon">🩺</span> <span><strong>Dashboard · Health</strong> — 综合健康评分环、存储引擎环形图、缓存/错误/成功仪表盘、工具调用柱状图、子 agent 有效性，以及模型 token 分布</span>',
    '<span class="caption-icon">📋</span> <span><strong>Kanban Board (agents)</strong> — agents swim-laned by status: Working, Waiting, Completed, Error. Cards show model, cost, and current tool call. Yellow column flags agents waiting on user input</span>':
      '<span class="caption-icon">📋</span> <span><strong>Kanban Board（agent）</strong> — agent 按状态分泳道排列：Working、Waiting、Completed、Error。卡片显示模型、成本和当前工具调用。黄色列标记正在等待用户输入的 agent</span>',
    '<span class="caption-icon">🗂️</span> <span><strong>Kanban Board (sessions)</strong> — sessions swim-laned across 5 columns: Active, Waiting, Completed, Error, Abandoned. Each card shows agent count, duration, model, and cumulative cost</span>':
      '<span class="caption-icon">🗂️</span> <span><strong>Kanban Board（session）</strong> — session 横跨 5 列分泳道排列：Active、Waiting、Completed、Error、Abandoned。每张卡片显示 agent 数量、持续时间、模型和累计成本</span>',
    '<span class="caption-icon">📂</span> <span><strong>Sessions</strong> — searchable, filterable, server-paginated table. Each row shows status badge, agent count, duration, model, and cost. Click any row to drill into session detail</span>':
      '<span class="caption-icon">📂</span> <span><strong>Sessions</strong> — 可搜索、可筛选、服务端分页的表格。每行显示状态徽章、agent 数量、持续时间、模型和成本。点击任意一行可深入查看会话详情</span>',
    '<span class="caption-icon">🤖</span> <span><strong>Session Detail · Agents</strong> — overview tiles (events, tool calls, subagents, errors, duration), top-tool usage bars, subagent type breakdown, and a collapsible parent–child agent hierarchy tree</span>':
      '<span class="caption-icon">🤖</span> <span><strong>Session Detail · Agents</strong> — 概览卡片（事件、工具调用、子 agent、错误、持续时间）、最常用工具使用柱状图、子 agent 类型细分，以及可折叠的父子 agent 层级树</span>',
    '<span class="caption-icon">💬</span> <span><strong>Session Detail · Conversation</strong> — full transcript viewer with markdown rendering, syntax-highlighted code blocks, per-tool sections, and collapsible thinking blocks</span>':
      '<span class="caption-icon">💬</span> <span><strong>Session Detail · Conversation</strong> — 完整的会话记录查看器，支持 markdown 渲染、语法高亮的代码块、按工具分区，以及可折叠的思考块</span>',
    '<span class="caption-icon">🔬</span> <span><strong>Session Detail · Timeline</strong> — chronological event timeline with multi-dimension filters, color-coded entries by type, expandable hook payloads, and direct links to the owning session and agent</span>':
      '<span class="caption-icon">🔬</span> <span><strong>Session Detail · Timeline</strong> — 按时间顺序排列的事件时间线，支持多维度筛选、按类型颜色编码的条目、可展开的 hook 负载，以及指向所属会话和 agent 的直接链接</span>',
    '<span class="caption-icon">📰</span> <span><strong>Activity Feed</strong> — real-time streaming event log with pause/resume buffering, multi-dimension filters, expandable hook payloads, color-coded entries, and per-row session navigation buttons</span>':
      '<span class="caption-icon">📰</span> <span><strong>Activity Feed</strong> — 实时流式事件日志，支持暂停/恢复缓冲、多维度筛选、可展开的 hook 负载、颜色编码的条目，以及每行的会话导航按钮</span>',
    '<span class="caption-icon">📊</span> <span><strong>Analytics</strong> — token usage by model, tool frequency bars, 52-week activity heatmap, 30-day sparkline trends, session outcome donuts, and cost summary with WebSocket auto-refresh</span>':
      '<span class="caption-icon">📊</span> <span><strong>Analytics</strong> — 按模型统计的 token 用量、工具使用频率柱状图、52 周活动热力图、30 天迷你折线趋势图、会话结果环形图，以及通过 WebSocket 自动刷新的成本汇总</span>',
    '<span class="caption-icon">🔀</span> <span><strong>Workflows</strong> — D3.js agent orchestration DAG, tool-execution Sankey diagram, directed pipeline graph, effectiveness scorecards, concurrency swim-lanes, and complexity bubble charts</span>':
      '<span class="caption-icon">🔀</span> <span><strong>Workflows</strong> — D3.js agent 编排 DAG、工具执行桑基图、有向流水线图、有效性评分卡、并发泳道，以及复杂度气泡图</span>',
    '<span class="caption-icon">🧰</span> <span><strong>Claude Config Explorer</strong> — 12-tab inspector for skills, subagents, slash commands, plugins, MCP servers, hooks, settings, memory, keybindings, and statusline. Safe edits with backups</span>':
      '<span class="caption-icon">🧰</span> <span><strong>Claude Config Explorer</strong> — 12 个标签页的检查器，涵盖 skill、子 agent、斜杠命令、plugin、MCP 服务器、hook、设置、记忆、键位绑定和状态栏。安全编辑并带备份</span>',
    '<span class="caption-icon">▶️</span> <span><strong>Run Claude</strong> — spawn or resume Claude subprocesses from the browser. Pick Conversation or Headless mode, set cwd, model, permission level, and thinking effort. Same-origin guard included</span>':
      '<span class="caption-icon">▶️</span> <span><strong>Run Claude</strong> — 在浏览器中启动或恢复 Claude 子进程。选择 Conversation 或 Headless 模式，设置 cwd、模型、权限级别和思考强度。内置同源防护</span>',
    '<span class="caption-icon">💬</span> <span><strong>Run Claude · live stream</strong> — character-by-character streaming output. Tool uses, tool results, and thinking blocks are collapsible. Active runs switcher juggles multiple sessions</span>':
      '<span class="caption-icon">💬</span> <span><strong>Run Claude · live stream</strong> — 逐字符的流式输出。工具调用、工具结果和思考块均可折叠。活动运行切换器可同时管理多个会话</span>',
    '<span class="caption-icon">⚙️</span> <span><strong>Settings</strong> — model pricing editor with per-token rates, hook installation status, JSON data export, session cleanup controls, browser notification toggles, and system info panel with DB stats</span>':
      '<span class="caption-icon">⚙️</span> <span><strong>Settings</strong> — 模型定价编辑器（含每 token 费率）、hook 安装状态、JSON 数据导出、会话清理控制、浏览器通知开关，以及含数据库统计的系统信息面板</span>',
    "This chart tracks how interest in Claude Code Agent Monitor has grown over time. The curve keeps climbing as more developers discover the project, share it, and use it in real workflows. Each new star is a small vote of confidence from the community.":
      "此图表追踪人们对 Claude Code Agent Monitor 的关注度如何随时间增长。随着越来越多的开发者发现该项目、分享它并在真实工作流中使用它，曲线持续攀升。每一颗新的 star 都是社区投出的一份小小的信任票。",
    '<span class="caption-icon">⭐</span> <span> Enjoying the project? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer" >Give it a star on GitHub</a > and help more builders discover it. </span>':
      '<span class="caption-icon">⭐</span> <span> 喜欢这个项目吗？ <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer" >在 GitHub 上给它点个 star</a >，帮助更多开发者发现它。 </span>',
    "Hook Type": "Hook 类型",
    Trigger: "触发条件",
    "Dashboard Action": "仪表盘动作",
    "Claude Code session begins": "Claude Code 会话开始",
    "Creates session and main agent. Stamps <code>awaiting_input_since</code> so the row lands in <strong>Waiting</strong> from the start (the CLI is at a prompt). Reactivates resumed sessions. Abandons orphaned sessions with no activity for <code>DASHBOARD_STALE_MINUTES</code> (default 180).":
      "创建会话和主 agent。打上 <code>awaiting_input_since</code> 时间戳，使该行从一开始就落入 <strong>Waiting</strong>（CLI 处于提示符状态）。重新激活已恢复的会话。将在 <code>DASHBOARD_STALE_MINUTES</code>（默认 180）期间无活动的孤立会话标记为放弃。",
    "User hits enter on a prompt": "用户在提示符处按下回车",
    'Clears the waiting flag and promotes the main agent to <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >. The only reliable signal that text-only assistant turns have started — they emit no <code>PreToolUse</code> before <code>Stop</code>.':
      '清除等待标志，并将主 agent 提升为 <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >。这是纯文本助手轮次已开始的唯一可靠信号——它们在 <code>Stop</code> 之前不会发出 <code>PreToolUse</code>。',
    "Agent begins using a tool": "Agent 开始使用某个工具",
    'Clears the waiting flag, sets agent → <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >, <code>current_tool</code> set. If tool is <code>Agent</code>, subagent record created.':
      '清除等待标志，将 agent 置为 → <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >，并设置 <code>current_tool</code>。如果工具是 <code>Agent</code>，则创建子 agent 记录。',
    "Tool execution completes": "工具执行完成",
    'Clears the waiting flag (covers permission-prompt approvals mid-tool). <code>current_tool</code> cleared. Agent stays <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >.':
      '清除等待标志（涵盖工具执行中途的权限提示批准）。清除 <code>current_tool</code>。agent 保持 <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >。',
    "Claude finishes a turn": "Claude 完成一个轮次",
    'Non-error: main agent → <code>waiting</code> — UI shows <span class="status-chip chip-waiting" ><span class="chip-dot"></span>Waiting</span > until the next user input. <code>stop_reason=error</code>: marks the agent and session <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >. Background subagents keep running.':
      '非错误情况：主 agent → <code>waiting</code> — UI 显示 <span class="status-chip chip-waiting" ><span class="chip-dot"></span>Waiting</span >，直到下一次用户输入。<code>stop_reason=error</code>：将该 agent 和会话标记为 <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >。后台子 agent 继续运行。',
    "Background agent finished": "后台 agent 已完成",
    "Matched subagent → <span class=\"status-chip chip-completed\" ><span class=\"chip-dot\"></span>Completed</span >. Deliberately does <strong>not</strong> clear the waiting flag — a backgrounded subagent finishing tells us nothing about the human. Also kicks off a fire-and-forget JSONL scan (<code>scanAndImportSubagents</code>) that walks the session's <code>subagents/agent-*.jsonl</code> files, pairs <code>tool_use</code> ↔ <code>tool_result</code> blocks by <code>tool_use_id</code>, and emits per-tool <code>PreToolUse</code> + <code>PostToolUse</code> events under each subagent's own <code>agent_id</code> — surfaces tool calls that subagents make internally and which never fire any hooks. The same scan also rebuilds the nested-subagent hierarchy — it repoints each subagent's <code>parent_agent_id</code> to the true spawner recovered from the transcript's Task tool result (<code>toolUseResult.agentId</code>), so subagents that spawn their own subagents nest correctly instead of flattening under main.":
      '匹配到的子 agent → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >。刻意 <strong>不</strong> 清除等待标志——后台子 agent 的完成并不能说明人类用户的任何情况。同时启动一次发后即忘的 JSONL 扫描（<code>scanAndImportSubagents</code>），它会遍历会话的 <code>subagents/agent-*.jsonl</code> 文件，按 <code>tool_use_id</code> 将 <code>tool_use</code> ↔ <code>tool_result</code> 块配对，并在每个子 agent 自身的 <code>agent_id</code> 下为每个工具发出 <code>PreToolUse</code> + <code>PostToolUse</code> 事件——从而呈现子 agent 内部进行的、从不触发任何 hook 的工具调用。同一次扫描还会重建嵌套子 agent 的层级——它把每个子 agent 的 <code>parent_agent_id</code> 重新指向从 transcript 的 Task 工具结果(<code>toolUseResult.agentId</code>)中恢复出的真正 spawn 方,因此自己再 spawn 子 agent 的子 agent 会正确嵌套,而不会平铺到 main 之下。',
    "Agent sends notification": "Agent 发送通知",
    'Event logged to activity feed. Permission/input-prompt patterns (e.g. "needs your permission", "waiting for your input") set the agent to <code>waiting</code> and stamp <code>awaiting_input_since</code>. Compaction-related notifications tagged as <code>Compaction</code> events. Triggers a browser notification if enabled.':
      '事件记录到活动信息流。权限/输入提示模式（例如 "needs your permission"、"waiting for your input"）将 agent 置为 <code>waiting</code> 并打上 <code>awaiting_input_since</code> 时间戳。与压缩相关的通知会被标记为 <code>Compaction</code> 事件。如果已启用，则触发浏览器通知。',
    "<code>/compact</code> detected in JSONL": "在 JSONL 中检测到 <code>/compact</code>",
    'Creates a compaction subagent → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Detected via <code>isCompactSummary</code> entries in the transcript. Token baselines preserve pre-compaction totals. Periodic scanner (cadence ~¼ of <code>DASHBOARD_STALE_MINUTES</code>) catches compactions when no hooks fire.':
      '创建一个压缩子 agent → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >。通过会话记录中的 <code>isCompactSummary</code> 条目检测。Token 基线会保留压缩前的总量。当没有 hook 触发时，周期性扫描器（节奏约为 <code>DASHBOARD_STALE_MINUTES</code> 的 ¼）会捕获压缩事件。',
    "API error detected in transcript": "在会话记录中检测到 API 错误",
    "Extracted from JSONL during history import, real-time transcript scanning, or the error detection watchdog. Captures quota limits, rate limits, auth failures, and other API errors. <strong>Immediately marks sessions and agents as error</strong> — previously recorded as events without changing status.":
      "在历史导入、实时会话记录扫描或错误检测看门狗过程中从 JSONL 中提取。捕获配额上限、速率限制、认证失败及其他 API 错误。<strong>立即将会话和 agent 标记为错误</strong>——此前仅记录为事件而不改变状态。",
    "Turn cancelled by the user (<code>Esc</code>)": "用户取消了该轮次（<code>Esc</code>）",
    "Synthesized by the watchdog because pressing <code>Esc</code> fires no hook. Recovered either from the transcript <code>[Request interrupted by user]</code> marker (flagged as <code>pendingInterrupt</code>) or, when <code>Esc</code> preceded any output and left no marker, from the idle-working timeout (<code>DASHBOARD_WORKING_IDLE_SECONDS</code>, default 120). Moves the session to <strong>Waiting</strong> — the same state a normal <code>Stop</code> produces.":
      "由看门狗合成，因为按下 <code>Esc</code> 不会触发任何 hook。要么从会话记录中的 <code>[Request interrupted by user]</code> 标记恢复（标记为 <code>pendingInterrupt</code>），要么在 <code>Esc</code> 发生于任何输出之前且未留下标记时，从空闲工作超时恢复（<code>DASHBOARD_WORKING_IDLE_SECONDS</code>，默认 120）。将会话置为 <strong>Waiting</strong>——与正常 <code>Stop</code> 产生的状态相同。",
    "Per-turn timing recorded": "记录每个轮次的计时",
    "Extracted from JSONL turn boundaries. Records the duration of each assistant turn for latency analysis.":
      "从 JSONL 的轮次边界中提取。记录每个助手轮次的持续时间，用于延迟分析。",
    "Claude Code CLI process exits": "Claude Code CLI 进程退出",
    'Drops the waiting flag. If the session is already in <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >, the error state is preserved; otherwise marks all agents and the session as <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Evicts the session\'s transcript from the shared cache.':
      '清除等待标志。如果会话已处于 <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >，则保留错误状态；否则将所有 agent 和该会话标记为 <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >。将该会话的会话记录从共享缓存中逐出。',
    "Clone the repository to your machine": "将仓库克隆到你的机器上",
    "Run <code>npm run setup</code> to install all dependencies":
      "运行 <code>npm run setup</code> 以安装所有依赖",
    "Run <code>npm run dev</code> — server + client launch automatically":
      "运行 <code>npm run dev</code> — 服务端 + 客户端将自动启动",
    "Start a new Claude Code session — events appear in real-time":
      "启动一个新的 Claude Code 会话——事件会实时出现",
    "A multi-stage <code>Dockerfile</code> and <code>docker-compose.yml</code> are included. You can run the monitor with either Docker or Podman and keep the SQLite database in a named volume.":
      "已包含一个多阶段的 <code>Dockerfile</code> 和 <code>docker-compose.yml</code>。你可以使用 Docker 或 Podman 运行该监控器，并将 SQLite 数据库保存在命名卷中。",
    "Hooks auto-install in local mode": "本地模式下自动安装 Hooks",
    "When you run the server directly on the host with <code>npm run dev</code> or <code>npm start</code>, it automatically writes Claude Code hook entries to <code>~/.claude/settings.json</code>. If you run the dashboard in Docker or Podman, install hooks from the host with <code>npm run install-hooks</code> after the container is up, then restart Claude Code. The installer refuses to run inside a container (issue #193) so it never writes a container-internal handler path into a bind-mounted host <code>~/.claude</code>; override with <code>CCAM_ALLOW_CONTAINER_HOOKS=1</code> only if Claude Code itself runs in the container.":
      "当你使用 <code>npm run dev</code> 或 <code>npm start</code> 直接在主机上运行服务器时，它会自动将 Claude Code hook 条目写入 <code>~/.claude/settings.json</code>。如果你在 Docker 或 Podman 中运行仪表盘，请在容器启动后从主机使用 <code>npm run install-hooks</code> 安装 hooks，然后重启 Claude Code。安装程序会拒绝在容器内运行（issue #193），因此绝不会将容器内部的处理器路径写入被绑定挂载的主机 <code>~/.claude</code>；仅当 Claude Code 本身在容器中运行时，才使用 <code>CCAM_ALLOW_CONTAINER_HOOKS=1</code> 覆盖。",
    "This repository also ships a local MCP server under <code>mcp/</code> and extension scaffolding for both Claude Code and Codex. These are optional for the dashboard UI, but recommended for complete local-agent workflows. The MCP server supports stdio (for host integration), HTTP+SSE (for remote clients), and an interactive REPL (for operator debugging).":
      "本仓库还在 <code>mcp/</code> 下附带了一个本地 MCP 服务器，以及面向 Claude Code 和 Codex 的扩展脚手架。对仪表盘界面而言这些是可选的，但建议用于完整的本地 agent 工作流。该 MCP 服务器支持 stdio（用于主机集成）、HTTP+SSE（用于远程客户端）和交互式 REPL（用于运维调试）。",
    "After starting a Claude Code session, you should see:":
      "启动一个 Claude Code 会话后，你应该会看到：",
    Page: "页面",
    Expected: "预期结果",
    Sessions: "会话",
    'Your session listed with status <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> (a fresh CLI is sitting at the prompt) — flips to <span class="status-chip chip-active"><span class="chip-dot"></span>Active</span> the moment Claude starts a turn':
      '你的会话以状态 <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> 列出（一个全新的 CLI 正停留在提示符处）——一旦 Claude 开始一个回合，状态便会切换为 <span class="status-chip chip-active"><span class="chip-dot"></span>Active</span>',
    "Kanban Board": "看板",
    "A <em>Main Agent</em> card in the <strong>Waiting</strong> column until you type your first message; flips to <em>Working</em> on <code>UserPromptSubmit</code> / <code>PreToolUse</code> and back to <em>Waiting</em> after each <code>Stop</code>":
      "在你输入第一条消息之前，<strong>Waiting</strong> 列中会有一张 <em>Main Agent</em> 卡片；在 <code>UserPromptSubmit</code> / <code>PreToolUse</code> 时切换为 <em>Working</em>，并在每次 <code>Stop</code> 后切回 <em>Waiting</em>",
    "Activity Feed": "活动信息流",
    'Events streaming in; click any row to expand payload, use "Session →" to drill into session details':
      "事件持续流入；点击任意行可展开负载，使用 “Session →” 可深入查看会话详情",
    Dashboard: "仪表盘",
    "Stats updating in real-time": "统计数据实时更新",
    "Start server before Claude Code": "在 Claude Code 之前先启动服务器",
    "Hooks only fire to a running server. If Claude Code was already running when you started the dashboard, restart the Claude Code session.":
      "Hooks 只会向正在运行的服务器触发。如果你启动仪表盘时 Claude Code 已经在运行，请重启该 Claude Code 会话。",
    Variable: "变量",
    Default: "默认值",
    Description: "说明",
    "Port the Express server listens on": "Express 服务器监听的端口",
    "Port used by the hook handler to reach the server (for custom port setups)":
      "hook 处理器用来访问服务器的端口（用于自定义端口配置）",
    "Base URL used by the local MCP server when calling dashboard APIs":
      "本地 MCP 服务器调用仪表盘 API 时使用的基础 URL",
    "MCP transport mode: <code>stdio</code>, <code>http</code>, <code>repl</code>":
      "MCP 传输模式：<code>stdio</code>、<code>http</code>、<code>repl</code>",
    "Port for the MCP HTTP+SSE server (only when <code>MCP_TRANSPORT=http</code>)":
      "MCP HTTP+SSE 服务器的端口（仅当 <code>MCP_TRANSPORT=http</code> 时）",
    "Bind address for the MCP HTTP server": "MCP HTTP 服务器的绑定地址",
    "Path to the SQLite database file": "SQLite 数据库文件的路径",
    "Set to <code>0</code> to disable the dead-session liveness reap — the watchdog completes active sessions with no running <code>claude</code> process; auto-disabled on Windows and in containers":
      "设为 <code>0</code> 可禁用死亡会话的存活性回收——看门狗会把没有正在运行的 <code>claude</code> 进程的活动会话标记为完成；在 Windows 和容器内自动禁用",
    "Idle gate for watchdog-tick liveness reaps — the transcript must not have been written for at least this long (last hook write is the fallback clock); startup passes skip the gate":
      "看门狗节拍存活性回收的空闲门槛——transcript 必须至少有这么长时间未被写入（无 transcript 时以最后一次 hook 写入为后备时钟）；启动时的回收会跳过该门槛",
    "Idle-working timeout the watchdog uses to recover an <code>Esc</code> cancel that left no transcript marker":
      "看门狗用于恢复未在会话记录中留下标记的 <code>Esc</code> 取消的空闲工作超时",
    "Poll interval for the background sync of <code>~/.claude/projects</code>; <code>0</code> disables the poll but keeps the filesystem watcher":
      "对 <code>~/.claude/projects</code> 进行后台同步的轮询间隔；<code>0</code> 会禁用轮询但保留文件系统监听器",
    "Set to <code>production</code> to serve built client from <code>client/dist/</code>":
      "设为 <code>production</code> 可从 <code>client/dist/</code> 提供已构建的客户端",
    "The server writes the following to <code>~/.claude/settings.json</code> on every startup:":
      "服务器在每次启动时会向 <code>~/.claude/settings.json</code> 写入以下内容：",
    "Existing hooks are preserved. The installer only adds or updates entries containing <code>hook-handler.js</code>.":
      "现有的 hooks 会被保留。安装程序只会添加或更新包含 <code>hook-handler.js</code> 的条目。",
    Script: "脚本",
    Command: "命令",
    "Install all dependencies (server + client)": "安装所有依赖项（服务器 + 客户端）",
    "Start server + client in development mode with hot reload":
      "以带热重载的开发模式启动服务器 + 客户端",
    "Start only the Express server with <code>--watch</code>":
      "仅启动带 <code>--watch</code> 的 Express 服务器",
    "Start only the Vite dev server": "仅启动 Vite 开发服务器",
    "TypeScript check + Vite production build to <code>client/dist/</code>":
      "TypeScript 检查 + Vite 生产构建到 <code>client/dist/</code>",
    "Start Express in production mode serving built client":
      "以生产模式启动 Express 并提供已构建的客户端",
    "Manually write Claude Code hooks to <code>~/.claude/settings.json</code>":
      "手动将 Claude Code hooks 写入 <code>~/.claude/settings.json</code>",
    "Insert demo sessions, agents, and events (8 sessions / 23 agents / 106 events)":
      "插入演示用的会话、agent 和事件（8 个会话 / 23 个 agent / 106 个事件）",
    "Import historical Claude Code sessions from <code>~/.claude</code> with deep JSONL extraction (API errors, turn durations, thinking blocks, subagent data)":
      "从 <code>~/.claude</code> 导入历史 Claude Code 会话，并进行深度 JSONL 提取（API 错误、回合时长、思考块、subagent 数据）",
    "Delete all data from the database (keeps schema)": "删除数据库中的所有数据（保留表结构）",
    "Run all server and client tests": "运行所有服务器和客户端测试",
    "Server integration tests only (Node built-in test runner)":
      "仅运行服务器集成测试（Node 内置测试运行器）",
    "Client unit tests only (Vitest + Testing Library)":
      "仅运行客户端单元测试（Vitest + Testing Library）",
    "Install dependencies for the local MCP package under <code>mcp/</code>":
      "为 <code>mcp/</code> 下的本地 MCP 包安装依赖项",
    "Type-check MCP source without emitting build output":
      "对 MCP 源码进行类型检查，但不产出构建输出",
    "Compile MCP server into <code>mcp/build/</code>":
      "将 MCP 服务器编译到 <code>mcp/build/</code>",
    "Start MCP server (stdio transport — for MCP hosts)":
      "启动 MCP 服务器（stdio 传输——用于 MCP 主机）",
    "Start MCP HTTP+SSE server on port 8819 (Streamable HTTP + legacy SSE)":
      "在端口 8819 上启动 MCP HTTP+SSE 服务器（Streamable HTTP + 传统 SSE）",
    "Start interactive MCP REPL with tab completion and colored output":
      "启动交互式 MCP REPL，支持 Tab 补全和彩色输出",
    "Run MCP server in dev mode with <code>tsx</code> (stdio)":
      "使用 <code>tsx</code> 以开发模式运行 MCP 服务器（stdio）",
    "Run MCP HTTP server in dev mode with <code>tsx</code>":
      "使用 <code>tsx</code> 以开发模式运行 MCP HTTP 服务器",
    "Run MCP REPL in dev mode with <code>tsx</code>":
      "使用 <code>tsx</code> 以开发模式运行 MCP REPL",
    "Build MCP container image with Docker (<code>agent-dashboard-mcp:local</code>)":
      "使用 Docker 构建 MCP 容器镜像（<code>agent-dashboard-mcp:local</code>）",
    "Build MCP container image with Podman (<code>localhost/agent-dashboard-mcp:local</code>)":
      "使用 Podman 构建 MCP 容器镜像（<code>localhost/agent-dashboard-mcp:local</code>）",
    "Run MCP server unit tests": "运行 MCP 服务器单元测试",
    "Install Electron + electron-builder under <code>desktop/</code>; rebuilds <code>better-sqlite3</code> for Electron's ABI. Preflights the native <code>better-sqlite3</code> build; prints actionable setup help (incl. a no-toolchain alternative) on failure":
      "在 <code>desktop/</code> 下安装 Electron + electron-builder；为 Electron 的 ABI 重新构建 <code>better-sqlite3</code>。会预检原生 <code>better-sqlite3</code> 的构建；失败时打印可操作的设置帮助（包括一个无需工具链的替代方案）",
    "Prebuild guard + <code>tsc</code> compile of the Electron main process into <code>desktop/out/</code>":
      "预构建检查 + 使用 <code>tsc</code> 将 Electron 主进程编译到 <code>desktop/out/</code>",
    "Build, then launch the desktop app against <code>desktop/out/main.js</code>":
      "先构建，然后基于 <code>desktop/out/main.js</code> 启动桌面应用",
    "Desktop smoke test — spawn Electron and probe <code>/api/health</code>":
      "桌面冒烟测试——启动 Electron 并探测 <code>/api/health</code>",
    "Build a <strong>universal</strong> (x64 + arm64) DMG. Correct for release — intentionally slow":
      "构建一个 <strong>通用</strong>（x64 + arm64）DMG。适用于发布——刻意做得较慢",
    "Build an Apple-Silicon-only DMG — fast (~1 min), recommended for a single machine":
      "构建仅适用于 Apple Silicon 的 DMG——速度快（约 1 分钟），推荐用于单台机器",
    "Build an Intel-only DMG — fast (macOS host)":
      "构建仅适用于 Intel 的 DMG——速度快（macOS 主机）",
    "Build the Windows NSIS installer <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> (Windows host)":
      "构建 Windows NSIS 安装程序 <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>（Windows 主机）",
    "Build the no-install portable <code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code> (Windows host)":
      "构建免安装的便携版 <code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>（Windows 主机）",
    "Regenerate <code>desktop/assets/icon.ico</code> from <code>icon.png</code> (PowerShell + .NET; Windows host)":
      "从 <code>icon.png</code> 重新生成 <code>desktop/assets/icon.ico</code>（PowerShell + .NET；Windows 主机）",
    "Format all files with Prettier": "使用 Prettier 格式化所有文件",
    "Check formatting without writing": "检查格式但不写入",
    "Core dashboard telemetry is composed of three processes (Claude hook source, dashboard server, browser UI). When the local MCP sidecar is enabled, it integrates with the same dashboard API via stdio, HTTP+SSE, or interactive REPL transport.":
      "核心仪表盘遥测由三个进程组成（Claude 钩子源、仪表盘服务器、浏览器 UI）。当启用本地 MCP 辅助进程时，它会通过 stdio、HTTP+SSE 或交互式 REPL 传输方式集成到同一个仪表盘 API。",
    "Full system architecture — Claude Code process → Hook Layer → Server → Browser":
      "完整系统架构 — Claude Code 进程 → 钩子层 → 服务器 → 浏览器",
    "Agent status transitions driven by hook events. <code>waiting</code> is a real persisted status — agents start as <code>waiting</code> and return to it after each turn. Error recovery requires active user retry (<code>UserPromptSubmit</code> or <code>PreToolUse</code>). A background watchdog detects API errors in transcripts every 15 s. The same watchdog also recovers <code>Esc</code>-cancelled turns — via either the transcript <code>[Request interrupted by user]</code> marker or the idle-working timeout when <code>Esc</code> preceded any output — and moves the session to Waiting.":
      "由钩子事件驱动的 agent 状态转换。<code>waiting</code> 是一个真实的持久化状态 — agent 以 <code>waiting</code> 状态开始，并在每一轮之后返回该状态。错误恢复需要用户主动重试（<code>UserPromptSubmit</code> 或 <code>PreToolUse</code>）。后台看门狗每隔 15 s 在记录中检测 API 错误。同一个看门狗还会恢复被 <code>Esc</code> 取消的轮次——通过会话记录中的 <code>[Request interrupted by user]</code> 标记，或在 <code>Esc</code> 发生于任何输出之前时通过空闲工作超时——并将会话置为 Waiting。",
    "Session status lifecycle. <code>waiting</code> is a UI overlay — persisted as <code>active</code> with <code>awaiting_input_since</code> set. <code>SessionEnd</code> preserves error state. Error recovery requires <code>UserPromptSubmit</code> or <code>PreToolUse</code>. The watchdog also recovers <code>Esc</code>-cancelled turns (marker or idle-timeout path) and moves the session to Waiting.":
      "会话状态生命周期。<code>waiting</code> 是一个 UI 叠加层 — 实际持久化为 <code>active</code> 并设置了 <code>awaiting_input_since</code>。<code>SessionEnd</code> 会保留错误状态。错误恢复需要 <code>UserPromptSubmit</code> 或 <code>PreToolUse</code>。看门狗还会恢复被 <code>Esc</code> 取消的轮次（标记路径或空闲超时路径）并将会话置为 Waiting。",
    "Complete event ingestion from hook fire to browser re-render":
      "从钩子触发到浏览器重新渲染的完整事件摄取流程",
    "Initial load + WebSocket subscription lifecycle": "初始加载 + WebSocket 订阅生命周期",
    "Server module dependency graph": "服务器模块依赖关系图",
    Module: "模块",
    Responsibility: "职责",
    "Express app setup, middleware (CORS, JSON 1MB limit), route mounting, static serving in production, HTTP server, auto-hook installation on startup":
      "Express 应用设置、中间件（CORS、JSON 1MB 限制）、路由挂载、生产环境中的静态资源服务、HTTP 服务器、启动时自动安装钩子",
    "SQLite connection, WAL/FK pragmas, schema migrations (<code >CREATE TABLE IF NOT EXISTS</code >), all prepared statements as a reusable <code>stmts</code> object. Tries <code>better-sqlite3</code> first, falls back to built-in <code>node:sqlite</code> via <code>compat-sqlite.js</code>":
      "SQLite 连接、WAL/FK pragma、schema 迁移（<code >CREATE TABLE IF NOT EXISTS</code >）、所有预编译语句作为可复用的 <code>stmts</code> 对象。优先尝试 <code>better-sqlite3</code>，并通过 <code>compat-sqlite.js</code> 回退到内置的 <code>node:sqlite</code>",
    "Compatibility wrapper giving Node.js built-in <code>node:sqlite</code> (<code>DatabaseSync</code>) the same API as <code>better-sqlite3</code> — pragma, transaction, prepare. Used as automatic fallback on Node 22+":
      "兼容性封装层，让 Node.js 内置的 <code>node:sqlite</code>（<code>DatabaseSync</code>）拥有与 <code>better-sqlite3</code> 相同的 API — pragma、transaction、prepare。在 Node 22+ 上用作自动回退方案",
    "WebSocket server on <code>/ws</code> path, 30s ping/pong heartbeat, typed <code>broadcast(type, data)</code> function":
      "位于 <code>/ws</code> 路径的 WebSocket 服务器、30s ping/pong 心跳、带类型的 <code>broadcast(type, data)</code> 函数",
    "Core event processing inside SQLite transactions. Auto-creates sessions/agents. Switch-case dispatch by hook type. Extracts token usage from Stop events.":
      "在 SQLite 事务内进行核心事件处理。自动创建会话/agent。按钩子类型进行 switch-case 分派。从 Stop 事件中提取 token 使用量。",
    "CRUD with pagination. GET includes agent count via LEFT JOIN. POST is idempotent on session ID.":
      "带分页的 CRUD。GET 通过 LEFT JOIN 包含 agent 数量。POST 对会话 ID 是幂等的。",
    "CRUD with status/session_id filtering. PATCH broadcasts <code>agent_updated</code>.":
      "带 status/session_id 过滤的 CRUD。PATCH 会广播 <code>agent_updated</code>。",
    "Read-only event listing with session_id filter and pagination.":
      "只读的事件列表，支持 session_id 过滤和分页。",
    "Single aggregate query — total/active counts, status distributions, WS connection count.":
      "单条聚合查询 — 总数/活跃数、状态分布、WS 连接数。",
    "Extended analytics — token totals, tool usage counts, daily event/session trends, agent type distribution, event type breakdown, average events per session.":
      "扩展分析 — token 总量、工具使用次数、每日事件/会话趋势、agent 类型分布、事件类型细分、每个会话的平均事件数。",
    "Model pricing CRUD (list, upsert, delete). Per-session and global cost calculation with pattern-based model matching and specificity sorting.":
      "模型定价 CRUD（list、upsert、delete）。基于模式的模型匹配和特异性排序，进行单会话和全局成本计算。",
    "System info (DB size, row counts, hook status, server uptime). Data export as JSON. Session cleanup (abandon stale active sessions, purge old completed sessions). Clear all data. Reset pricing to defaults. Reinstall hooks.":
      "系统信息（数据库大小、行数、钩子状态、服务器运行时间）。以 JSON 形式导出数据。会话清理（弃置陈旧的活跃会话、清除旧的已完成会话）。清除所有数据。将定价重置为默认值。重新安装钩子。",
    "Aggregate workflow visualization data (agent orchestration, tool transitions, collaboration networks, workflow patterns, model delegation, error propagation, concurrency, session complexity, compaction impact). Accepts <code>?status=active|completed</code> filter. Per-session drill-in with agent tree, tool timeline, and events.":
      "聚合工作流可视化数据（agent 编排、工具转换、协作网络、工作流模式、模型委派、错误传播、并发、会话复杂度、压缩影响）。接受 <code>?status=active|completed</code> 过滤器。支持按会话深入查看，包含 agent 树、工具时间线和事件。",
    "React component tree": "React 组件树",
    Purpose: "用途",
    "<code>lib/api.ts</code>": "<code>lib/api.ts</code>",
    "Typed fetch wrapper — one method per REST endpoint. All return typed promises.":
      "类型化的 fetch 封装——每个 REST 端点对应一个方法。全部返回类型化的 promise。",
    "<code>lib/types.ts</code>": "<code>lib/types.ts</code>",
    "TypeScript interfaces: <code>Session</code>, <code>Agent</code>, <code>DashboardEvent</code>, <code>Stats</code>, <code>Analytics</code>, <code>WSMessage</code>, plus all workflow-related types (<code>WorkflowData</code>, <code>SessionDrillIn</code>, etc). Status config maps.":
      "TypeScript 接口：<code>Session</code>、<code>Agent</code>、<code>DashboardEvent</code>、<code>Stats</code>、<code>Analytics</code>、<code>WSMessage</code>，以及所有与工作流相关的类型（<code>WorkflowData</code>、<code>SessionDrillIn</code> 等）。还有状态配置映射。",
    "<code>lib/eventBus.ts</code>": "<code>lib/eventBus.ts</code>",
    "Set-based pub/sub. <code>subscribe(fn)</code> returns an unsubscribe function for clean useEffect teardown.":
      "基于 Set 的发布/订阅。<code>subscribe(fn)</code> 返回一个取消订阅函数，便于 useEffect 干净地清理。",
    "<code>lib/format.ts</code>": "<code>lib/format.ts</code>",
    "Date/time formatting helpers — relative time, duration, ISO display.":
      "日期/时间格式化辅助函数——相对时间、时长、ISO 显示。",
    "<code>hooks/useWebSocket.ts</code>": "<code>hooks/useWebSocket.ts</code>",
    "Auto-reconnecting WebSocket React hook. 2-second reconnect interval. Publishes messages to eventBus.":
      "自动重连的 WebSocket React hook。2 秒重连间隔。将消息发布到 eventBus。",
    "The dashboard is a Progressive Web App with its own <code>manifest.json</code> and Service Worker (<code>client/public/sw.js</code>). The landing page and wiki are also independent PWAs with separate manifests and service workers.":
      "该仪表盘是一个渐进式 Web 应用，拥有自己的 <code>manifest.json</code> 和 Service Worker（<code>client/public/sw.js</code>）。落地页和 wiki 也是独立的 PWA，各自拥有独立的 manifest 和 service worker。",
    Surface: "界面",
    Manifest: "Manifest",
    "Service Worker": "Service Worker",
    Strategy: "策略",
    "<code>client/public/manifest.json</code>": "<code>client/public/manifest.json</code>",
    "<code>client/public/sw.js</code>": "<code>client/public/sw.js</code>",
    "Precaches app shell. Cache-first for static assets (JS/CSS bundles). Network-first for navigation with offline fallback. Skips <code>/api/*</code>, <code>/ws</code>, and Vite HMR. Preserves push notification handlers.":
      "预缓存应用外壳。静态资源（JS/CSS 包）采用缓存优先策略。导航采用网络优先策略并提供离线回退。跳过 <code>/api/*</code>、<code>/ws</code> 和 Vite HMR。保留推送通知处理程序。",
    "Landing page": "落地页",
    "<code>manifest.json</code> (root)": "<code>manifest.json</code>（根目录）",
    "<code>sw.js</code> (root)": "<code>sw.js</code>（根目录）",
    "Precaches HTML shell, favicon, OG image. Lazy-caches screenshot PNGs on first view. Network-first HTML, cache-first assets.":
      "预缓存 HTML 外壳、favicon、OG 图片。首次查看时惰性缓存截图 PNG。HTML 采用网络优先，资源采用缓存优先。",
    Wiki: "Wiki",
    "<code>wiki/manifest.json</code>": "<code>wiki/manifest.json</code>",
    "<code>wiki/sw.js</code>": "<code>wiki/sw.js</code>",
    "Precaches <code>index.html</code>, <code>style.css</code>, <code>script.js</code>. Fully offline after one visit.":
      "预缓存 <code>index.html</code>、<code>style.css</code>、<code>script.js</code>。访问一次后即可完全离线使用。",
    'All three SWs call <code>skipWaiting()</code> on install and delete stale caches on activate (keyed by version strings like <code>dashboard-v1</code>). Manifests use SVG icons (<code>favicon.svg</code>) with <code>sizes="any"</code>. iOS standalone mode is enabled via <code>apple-mobile-web-app-capable</code> meta tags.':
      '三个 SW 都在安装时调用 <code>skipWaiting()</code>，并在激活时删除过期缓存（以诸如 <code>dashboard-v1</code> 之类的版本字符串作为键）。manifest 使用 SVG 图标（<code>favicon.svg</code>）并带有 <code>sizes="any"</code>。通过 <code>apple-mobile-web-app-capable</code> meta 标签启用 iOS 独立模式。',
    "The client deliberately avoids Redux / Zustand / Context. Each page owns its data and lifecycle. WebSocket events trigger a reload or append — no complex state merging.":
      "客户端刻意避免使用 Redux / Zustand / Context。每个页面拥有自己的数据和生命周期。WebSocket 事件触发重新加载或追加——没有复杂的状态合并。",
    "No global store — by design": "没有全局存储——这是有意为之的设计",
    "There is no cross-page shared state. Each page fetches and owns exactly the data it displays. This simplifies debugging and avoids stale-closure hazards that are common with global stores in long-running WebSocket apps.":
      "不存在跨页面共享的状态。每个页面只获取并拥有它所显示的数据。这简化了调试，并避免了在长时间运行的 WebSocket 应用中使用全局存储时常见的过期闭包隐患。",
    Index: "索引",
    Table: "表",
    "Column(s)": "列",
    "Fast agent lookup by session": "按会话快速查找代理",
    "Kanban column queries": "看板列查询",
    "Session detail event list": "会话详情事件列表",
    "Filter events by type": "按类型过滤事件",
    "Activity feed ordering": "活动流排序",
    "Status filter on sessions page": "会话页面上的状态过滤",
    "Default sort order": "默认排序顺序",
    Pragma: "Pragma",
    Value: "数值",
    Rationale: "理由",
    "Concurrent reads during writes. Far better for read-heavy dashboards.":
      "在写入期间支持并发读取。对于读取密集型仪表盘要好得多。",
    "Referential integrity — prevents orphaned agents/events.":
      "引用完整性——防止出现孤立的代理/事件。",
    "Wait up to 5s for write lock instead of failing immediately under load.":
      "等待写锁最多 5 秒，而不是在负载下立即失败。",
    'All endpoints return JSON. Errors follow <code>{ "error": { "code", "message" } }</code>. The OpenAPI 3.0 spec comprehensively documents every backend route - parameters, request/response schemas, field descriptions, and examples. It is served at <code>/api/openapi.json</code> (with a committed <code>openapi.yaml</code> mirror), rendered as interactive Swagger UI at <code>/api/docs</code>, and as a clean, read-optimized ReDoc reference at <code>/api/redoc</code>. ReDoc is self-hosted, so it works fully offline.':
      '所有端点都返回 JSON。错误遵循 <code>{ "error": { "code", "message" } }</code> 格式。OpenAPI 3.0 规范全面记录了每个后端路由——参数、请求/响应模式、字段说明以及示例。它在 <code>/api/openapi.json</code> 提供（并附带提交到仓库的 <code>openapi.yaml</code> 镜像），在 <code>/api/docs</code> 渲染为交互式 Swagger UI，并在 <code>/api/redoc</code> 渲染为简洁、便于阅读的 ReDoc 参考文档。ReDoc 为本地自托管，因此可完全离线使用。',
    '<span class="caption-icon">📘</span> <span>Swagger UI at <code>/api/docs</code> — auto-generated interactive playground for every REST endpoint. Try-it-out forms, request/response schema, auth headers, and curl snippets</span>':
      '<span class="caption-icon">📘</span> <span>位于 <code>/api/docs</code> 的 Swagger UI——为每个 REST 端点自动生成的交互式演练场。包含试用表单、请求/响应模式、认证标头以及 curl 代码片段</span>',
    Property: "属性",
    Path: "路径",
    Protocol: "协议",
    "Standard WebSocket (RFC 6455)": "标准 WebSocket（RFC 6455）",
    Heartbeat: "心跳",
    "Server pings every 30s — clients that don't pong are terminated":
      "服务器每隔 30s ping 一次——未回应 pong 的客户端将被终止",
    Reconnect: "重连",
    "Client retries every 2 seconds on disconnect": "断开连接后客户端每隔 2 秒重试一次",
    "Client WebSocket auto-reconnect state machine": "客户端 WebSocket 自动重连状态机",
    "<code>scripts/hook-handler.js</code> is a minimal, fail-safe forwarder. It always exits 0 so it can never block Claude Code regardless of server state.":
      "<code>scripts/hook-handler.js</code> 是一个极简的故障安全转发器。它始终以 0 退出，因此无论服务器处于何种状态都绝不会阻塞 Claude Code。",
    "hook-handler.js flow — always exits 0, never blocks Claude Code":
      "hook-handler.js 流程——始终以 0 退出，绝不阻塞 Claude Code",
    "Hook installation is idempotent — safe to run multiple times":
      "Hook 安装是幂等的——可以安全地多次运行",
    '<span class="caption-icon">📥</span> <span>Settings → Import History — rescan default paths, set a custom directory, or drag-and-drop <code>.gz</code> archives. Progress bar and result card show counts for every run</span>':
      '<span class="caption-icon">📥</span> <span>Settings → Import History——重新扫描默认路径、设置自定义目录，或拖放 <code>.gz</code> 归档文件。进度条和结果卡片会显示每次运行的计数</span>',
    "The dashboard ships with a first-class <b>history importer</b> that backfills sessions, agents, events, tokens, and costs from Claude Code JSONL transcripts. Live hook ingestion and manual import share the exact same parser — <code>parseSessionFile</code> + <code>importSession</code> in <code>scripts/import-history.js</code> — which is the architectural contract that guarantees imported token totals and cost values are identical to those captured in real time. Re-imports are idempotent: session IDs are the dedup key and compaction <code>baseline_*</code> columns preserve pre-compaction token totals.":
      "仪表盘内置了一流的<b>历史导入器</b>，可从 Claude Code 的 JSONL 转录文件回填会话、智能体、事件、token 和成本。实时 hook 摄取与手动导入共用完全相同的解析器——<code>scripts/import-history.js</code> 中的 <code>parseSessionFile</code> + <code>importSession</code>——这是一项架构契约，保证导入的 token 总量和成本值与实时捕获的完全一致。重新导入是幂等的：会话 ID 是去重键，而压缩后的 <code>baseline_*</code> 列会保留压缩前的 token 总量。",
    "All three modes funnel into the same parser and DB transaction — imported numbers match live capture bit-for-bit":
      "三种模式都汇入同一个解析器和数据库事务——导入的数字与实时捕获逐位一致",
    "Upload path: multipart → safe extract → walk → parse → import — every temp dir reclaimed in <code>finally</code>":
      "上传路径：multipart → 安全解压 → 遍历 → 解析 → 导入——每个临时目录都在 <code>finally</code> 中被回收",
    "The <code>baseline_*</code> columns make cost monotonic under re-imports — compacted sessions retain pre-compaction usage for billing":
      "<code>baseline_*</code> 列使成本在重新导入时保持单调——被压缩的会话会保留压缩前的用量以供计费",
    Layout: "布局",
    Example: "示例",
    Handling: "处理方式",
    "Default Claude Code": "默认 Claude Code",
    "Session transcript — extracts tokens, compactions, tool uses, turn durations":
      "会话转录——提取 token、压缩、工具使用和回合时长",
    "Default subagent": "默认子智能体",
    "Paired with parent on discovery via <code>findSessionSubagents</code>":
      "在发现时通过 <code>findSessionSubagents</code> 与父级配对",
    "Alternative subagent": "备用子智能体",
    "Paired with parent on discovery (second layout probed automatically)":
      "在发现时与父级配对（自动探测第二种布局）",
    "Orphan subagent": "孤立子智能体",
    "No parent JSONL in source, but <code>sid</code> exists in DB":
      "源中没有父级 JSONL，但 <code>sid</code> 存在于数据库中",
    "<code>importFromDirectory</code> probes both layouts; attaches if the parent is found":
      "<code>importFromDirectory</code> 会探测两种布局；若找到父级则进行关联",
    "Flat JSONL drop": "扁平 JSONL 投放",
    "Recognized as a loose session transcript": "被识别为松散的会话转录",
    Archives: "归档文件",
    "Extracted into a per-request temp dir, then walked by the same importer":
      "解压到每个请求的临时目录中，然后由同一个导入器遍历",
    "Single-file gzip": "单文件 gzip",
    "Gunzipped in streaming mode with running byte-counter size cap":
      "以流式模式解压 gzip，并使用运行中的字节计数器进行大小上限控制",
    Threat: "威胁",
    Mitigation: "缓解措施",
    "Path traversal via archive entries": "通过归档条目进行的路径穿越",
    "<code>archive.safeJoin</code> resolves under the extraction root; any <code>..</code> or absolute path returns <code>null</code>":
      "<code>archive.safeJoin</code> 在解压根目录下解析；任何 <code>..</code> 或绝对路径都会返回 <code>null</code>",
    "Zip / tar / gzip bombs": "Zip / tar / gzip 炸弹",
    "<code>MAX_EXTRACT_BYTES</code> (default 4 GB) enforced by running byte counter; aborts with <code>ExtractionLimitError</code> → HTTP 413":
      "由运行中的字节计数器强制执行 <code>MAX_EXTRACT_BYTES</code>（默认 4 GB）；以 <code>ExtractionLimitError</code> → HTTP 413 中止",
    "Per-file upload size abuse": "针对单个文件上传大小的滥用",
    "multer <code>limits.fileSize = MAX_UPLOAD_BYTES</code> (default 1 GB)":
      "multer <code>limits.fileSize = MAX_UPLOAD_BYTES</code>（默认 1 GB）",
    "Too many files per request": "每个请求的文件数过多",
    "multer <code>limits.files = MAX_UPLOAD_FILES</code> (default 2000)":
      "multer <code>limits.files = MAX_UPLOAD_FILES</code>（默认 2000）",
    "Unsupported file types": "不受支持的文件类型",
    "<code>fileFilter</code> drops them early and reports them in <code>rejected_files[]</code>":
      "<code>fileFilter</code> 会及早丢弃它们，并在 <code>rejected_files[]</code> 中报告",
    "Concurrent upload temp-dir collisions": "并发上传时的临时目录冲突",
    "Per-request temp dir on <code>req._ccamUploadDir</code>; created in multer <code>destination</code>, reclaimed in <code>finally</code>":
      "在 <code>req._ccamUploadDir</code> 上为每个请求设置临时目录；在 multer <code>destination</code> 中创建，在 <code>finally</code> 中回收",
    "Arbitrary absolute path on <code>scan-path</code>": "<code>scan-path</code> 上的任意绝对路径",
    "Validated: must be absolute (after <code>~</code> expansion), exist, and be a directory":
      "经过校验：必须是绝对路径（在 <code>~</code> 展开后）、存在且为目录",
    "Relative / traversal paths on <code>scan-path</code>":
      "<code>scan-path</code> 上的相对路径 / 穿越路径",
    "Rejected with <code>INVALID_INPUT</code>": "以 <code>INVALID_INPUT</code> 拒绝",
    "Maximum size per uploaded file on <code>/api/import/upload</code>":
      "<code>/api/import/upload</code> 上每个上传文件的最大大小",
    "Maximum files per upload request": "每个上传请求的最大文件数",
    "Ceiling on total uncompressed bytes from any single archive (zip-bomb defense)":
      "对任何单个归档文件解压后总字节数的上限（zip 炸弹防御）",
    "Every import emits <code>import.progress</code> messages on <code>/ws</code>. Messages are throttled to at most one every ~150 ms to avoid flooding the channel on multi-thousand-session imports; the terminal <code>complete</code> and <code>error</code> frames are never throttled.":
      "每次导入都会在 <code>/ws</code> 上发出 <code>import.progress</code> 消息。消息被节流为最多每 ~150 ms 一条，以避免在数千会话的导入中淹没通道；终止帧 <code>complete</code> 和 <code>error</code> 永远不会被节流。",
    "Phases: <code>start</code> → <code>scan</code> → <code>extract</code> (upload only) → <code>parse</code> → <code>complete</code>, with <code>error</code> / <code>extract_error</code> replacing <code>complete</code> on failure.":
      "各阶段：<code>start</code> → <code>scan</code> → <code>extract</code>（仅上传时）→ <code>parse</code> → <code>complete</code>，失败时由 <code>error</code> / <code>extract_error</code> 取代 <code>complete</code>。",
    "In addition to dashboard telemetry, this project includes a production-grade local MCP server and complete extension scaffolding for both Claude Code and Codex. This gives agents a richer local tool surface while keeping all execution local-first. The MCP server supports three transport modes: stdio for host integration, HTTP+SSE for remote clients, and an interactive REPL for operator debugging.":
      "除了仪表盘遥测之外，本项目还包含一个生产级的本地 MCP 服务器，以及面向 Claude Code 和 Codex 的完整扩展脚手架。这为智能体提供了更丰富的本地工具面，同时保持所有执行都以本地优先。MCP 服务器支持三种传输模式：用于宿主集成的 stdio、用于远程客户端的 HTTP+SSE，以及用于操作者调试的交互式 REPL。",
    '<span class="caption-icon">🔧</span> MCP Server REPL — interactive tool invocation terminal with colored JSON output, argument prompts, error formatting, and session-aware context for rapid testing':
      '<span class="caption-icon">🔧</span> MCP 服务器 REPL——交互式工具调用终端，具有彩色 JSON 输出、参数提示、错误格式化和会话感知上下文，便于快速测试',
    "Local extension architecture: host instructions + skills + multi-transport MCP sidecar":
      "本地扩展架构：宿主指令 + 技能 + 多传输 MCP 边车",
    "The <code>mcp/</code> package exposes dashboard-oriented tools for AI agents across three transport modes. Mutation and destructive operations are policy-gated by environment variables and disabled by default. HTTP mode serves both Streamable HTTP (protocol 2025-11-25) and legacy SSE (protocol 2024-11-05). REPL mode provides tab-completed interactive tool invocation with colored output and JSON syntax highlighting.":
      "<code>mcp/</code> 包通过三种传输模式向 AI 智能体公开面向仪表盘的工具。变更和破坏性操作由环境变量进行策略门控，并且默认禁用。HTTP 模式同时提供 Streamable HTTP（协议 2025-11-25）和旧版 SSE（协议 2024-11-05）。REPL 模式提供带 Tab 补全的交互式工具调用，并带有彩色输出和 JSON 语法高亮。",
    Component: "组件",
    Location: "位置",
    Notes: "备注",
    "MCP source": "MCP 源码",
    "TypeScript server, tools, policy guards, transport layer, CLI UI":
      "TypeScript 服务器、工具、策略守卫、传输层、CLI UI",
    "MCP build output": "MCP 构建产物",
    "Compiled JavaScript runtime for all transport modes":
      "适用于所有传输模式的已编译 JavaScript 运行时",
    "MCP docs": "MCP 文档",
    "Tool catalog, architecture diagrams, host integration examples, REPL guide":
      "工具目录、架构图、宿主集成示例、REPL 指南",
    "Transport layer": "传输层",
    "HTTP+SSE server, interactive REPL, tool handler collector":
      "HTTP+SSE 服务器、交互式 REPL、工具处理器收集器",
    "CLI UI": "CLI UI",
    "ANSI banner, colors, formatter with tables, boxes, JSON highlighting":
      "ANSI 横幅、配色、带表格、方框和 JSON 高亮的格式化器",
    "Runtime commands": "运行时命令",
    "Start MCP in stdio, HTTP+SSE, or REPL mode (production or dev)":
      "以 stdio、HTTP+SSE 或 REPL 模式启动 MCP（生产或开发）",
    Target: "目标",
    Files: "文件",
    "Claude Code": "Claude Code",
    "Persistent project instructions + path-scoped coding rules":
      "持久化的项目指令 + 按路径限定的编码规则",
    "Claude Code Skills": "Claude Code 技能",
    "Reusable workflows (onboarding, shipping, MCP ops, live debugging)":
      "可复用的工作流（上手引导、发布、MCP 运维、实时调试）",
    "Claude Code Subagents": "Claude Code 子代理",
    "Specialized reviewers for backend, frontend, and MCP code paths":
      "针对后端、前端和 MCP 代码路径的专用审查器",
    "Codex Base Instructions": "Codex 基础指令",
    "Project-wide guidance + execution policy defaults": "项目级指导 + 执行策略默认值",
    "Codex Skills": "Codex 技能",
    "Task-specific skills aligned to this repository": "与本仓库对齐的特定任务技能",
    "Codex Agents": "Codex 代理",
    "Reusable custom-agent templates for implementation and review":
      "用于实现和审查的可复用自定义代理模板",
    Role: "作用",
    "Receives Claude hook payloads over stdin and forwards them to dashboard API":
      "通过 stdin 接收 Claude 钩子负载并将其转发到仪表板 API",
    "Writes/updates hook registration in <code>~/.claude/settings.json</code>":
      "在 <code>~/.claude/settings.json</code> 中写入/更新钩子注册",
    "Batch history importer used by server startup auto-import, the <code>/api/import/*</code> routes, and the <code>import-history</code> CLI. Exposes <code>importAllSessions()</code> for the default projects dir and the generalized <code>importFromDirectory(dbModule, rootDir, {onProgress})</code> which walks any directory recursively, classifies session vs subagent JSONLs (probes both <code>&lt;proj&gt;/&lt;sid&gt;/subagents/*</code> and <code>&lt;proj&gt;/subagents/&lt;sid&gt;/*</code> layouts), and funnels everything through the shared <code>parseSessionFile</code> + <code>importSession</code> pipeline — identical to live ingest. <b>Re-import is fully incremental</b>: a per-event-type high-water mark (<code>MAX(created_at) GROUP BY event_type</code> for the session) drives <code>ts &gt; cutoff[type]</code> dedup for Stop / PostToolUse / TurnDuration / ToolError, so long-running sessions whose transcripts grow across multiple days keep receiving new events on every re-run. <code>sessions.ended_at</code> is rolled forward when the JSONL has progressed past the stored value, and message-count metadata is refreshed on every pass. Session-ID dedup and <code>baseline_*</code> preservation keep token totals stable. Extracts tokens, API errors, turn durations, thinking blocks, usage extras, and per-subagent breakdowns":
      "批量历史导入器，用于服务器启动时的自动导入、<code>/api/import/*</code> 路由以及 <code>import-history</code> CLI。为默认项目目录暴露了 <code>importAllSessions()</code>，并提供通用的 <code>importFromDirectory(dbModule, rootDir, {onProgress})</code>，它会递归遍历任意目录，区分会话与子代理 JSONL（同时探测 <code>&lt;proj&gt;/&lt;sid&gt;/subagents/*</code> 和 <code>&lt;proj&gt;/subagents/&lt;sid&gt;/*</code> 两种布局），并将一切汇入共享的 <code>parseSessionFile</code> + <code>importSession</code> 流水线——与实时摄取完全一致。<b>重新导入是完全增量的</b>：按事件类型划分的高水位线（针对会话的 <code>MAX(created_at) GROUP BY event_type</code>）驱动 Stop / PostToolUse / TurnDuration / ToolError 的 <code>ts &gt; cutoff[type]</code> 去重，因此那些转录内容跨多天增长的长时间运行会话会在每次重新运行时持续接收新事件。当 JSONL 进展超过已存储的值时，<code>sessions.ended_at</code> 会向前滚动，且每一遍都会刷新消息计数元数据。会话 ID 去重和 <code>baseline_*</code> 保留使令牌总量保持稳定。提取令牌、API 错误、轮次时长、思考块、用量附加项以及按子代理划分的明细",
    "Express router for Import History. Four endpoints: <code>GET /api/import/guide</code> (OS-aware instructions + default-dir stats), <code>POST /api/import/rescan</code> (default <code>~/.claude/projects</code>), <code>POST /api/import/scan-path</code> (arbitrary absolute dir with <code>~</code> expansion), <code>POST /api/import/upload</code> (multer multipart). Each request uses a per-request temp dir reclaimed in <code>finally</code>. Progress broadcast as throttled <code>import.progress</code> WebSocket messages. Limits tunable via <code>CCAM_IMPORT_MAX_BYTES</code>, <code>CCAM_IMPORT_MAX_FILES</code>, <code>CCAM_IMPORT_MAX_EXTRACT_BYTES</code>":
      "用于导入历史的 Express 路由。四个端点：<code>GET /api/import/guide</code>（识别操作系统的说明 + 默认目录统计）、<code>POST /api/import/rescan</code>（默认 <code>~/.claude/projects</code>）、<code>POST /api/import/scan-path</code>（带 <code>~</code> 展开的任意绝对目录）、<code>POST /api/import/upload</code>（multer multipart）。每个请求使用一个按请求划分、在 <code>finally</code> 中回收的临时目录。进度通过限流的 <code>import.progress</code> WebSocket 消息广播。限制可通过 <code>CCAM_IMPORT_MAX_BYTES</code>、<code>CCAM_IMPORT_MAX_FILES</code>、<code>CCAM_IMPORT_MAX_EXTRACT_BYTES</code> 调整",
    "Safe archive extraction: <code>.zip</code> via <code>adm-zip</code>, <code>.tar</code>/<code>.tar.gz</code>/<code>.tgz</code> via <code>tar</code>, plain <code>.gz</code> streaming via <code>zlib</code>. Every entry validated through <code>safeJoin</code> which rejects absolute paths and <code>..</code> traversal before any bytes are written. Enforces a hard <code>MAX_EXTRACT_BYTES</code> cap (default 4 GB) with <code>ExtractionLimitError</code> surfaced as HTTP 413 — defense against zip/tar/gzip bombs":
      "安全的归档解压：<code>.zip</code> 通过 <code>adm-zip</code>，<code>.tar</code>/<code>.tar.gz</code>/<code>.tgz</code> 通过 <code>tar</code>，纯 <code>.gz</code> 通过 <code>zlib</code> 流式处理。每个条目都经过 <code>safeJoin</code> 校验，在写入任何字节之前拒绝绝对路径和 <code>..</code> 穿越。强制执行硬性的 <code>MAX_EXTRACT_BYTES</code> 上限（默认 4 GB），并以 HTTP 413 形式抛出 <code>ExtractionLimitError</code>——用于防御 zip/tar/gzip 炸弹",
    "Loads deterministic demo data for testing and demos": "为测试和演示加载确定性的演示数据",
    "Removes persisted rows while preserving schema": "在保留数据库结构的同时移除已持久化的行",
    "The Agent Monitor ships with an official Claude Code plugin marketplace containing ten production-ready plugins (53 skills, 14 agents, 30 slash commands, 3 CLI tools, 3 hook configs, and 1 MCP server). These extend Claude Code with skills, agents, hooks, CLI tools, and MCP integration — all grounded in the real data model (token tracking with compaction baselines, cost calculation via pattern-matched pricing rules, workflow intelligence with 11 datasets per session, and session metadata including thinking blocks, turn counts, and inference geography).":
      "Agent Monitor 附带一个官方的 Claude Code 插件市场，包含十个生产就绪的插件（53 个技能、14 个智能体、30 个斜杠命令、3 个 CLI 工具、3 个 hook 配置以及 1 个 MCP 服务器）。它们通过技能、代理、钩子、CLI 工具和 MCP 集成来扩展 Claude Code——全部基于真实的数据模型构建（带压缩基线的令牌跟踪、通过模式匹配定价规则进行的成本计算、每个会话包含 11 个数据集的工作流智能，以及包含思考块、轮次计数和推理地理位置的会话元数据）。",
    Plugin: "插件",
    Skills: "技能",
    Agent: "Agent",
    "CLI Tools": "CLI 工具",
    Focus: "侧重点",
    "Token usage (4 types + baselines), cost via pricing engine, daily trends, productivity scoring":
      "令牌用量（4 种类型 + 基线）、通过定价引擎计算的成本、每日趋势、生产力评分",
    "Standup reports, sprint tracking, workflow optimization via 11 workflow intelligence datasets":
      "站会报告、冲刺跟踪、通过 11 个工作流智能数据集进行的工作流优化",
    "Session debugging, hook diagnostics, data export (JSON/CSV), system health":
      "会话调试、钩子诊断、数据导出（JSON/CSV）、系统健康状况",
    "Pattern detection via tool flow transitions, anomaly alerting, optimization, session comparison":
      "通过工具流转换进行的模式检测、异常告警、优化、会话对比",
    "Budget guardrails: set budgets, forecast week/month-end spend, cost-threshold alerts, model-routing savings (fail-safe Stop hook)":
      "预算护栏：设置预算、预测周末/月末支出、成本阈值告警、模型路由节省（故障安全的 Stop hook）",
    "Session forensics: search, timeline, transcript replay, per-cwd rollup, cleanup":
      "会话取证：搜索、时间线、transcript 回放、按 cwd 汇总、清理",
    "Multi-agent orchestration &amp; fleet intelligence: DAG map, delegation audit, concurrency, error propagation, fleet runs (11-dataset workflow intelligence API)":
      "多智能体编排与机群智能：DAG 图、委派审计、并发、错误传播、机群运行（11 个数据集的工作流智能 API）",
    "Reliability &amp; SLOs: error scan, API-error report, hook-failure audit, SLO check, regression alert":
      "可靠性与 SLO：错误扫描、API 错误报告、hook 失败审计、SLO 检查、回归告警",
    "Claude Code config &amp; memory governance: config audit, memory review, skill/MCP/hook inventory (via the Config Explorer API)":
      "Claude Code 配置与记忆治理：配置审计、记忆审查、技能/MCP/hook 清点（通过 Config Explorer API）",
    "Dashboard connector with MCP integration and one-line metric summaries":
      "带 MCP 集成的仪表板连接器以及单行指标摘要",
    "Each plugin follows the official Claude Code plugin specification. The marketplace manifest at <code>.claude-plugin/marketplace.json</code> catalogs all ten plugins. Each plugin directory contains:":
      "每个插件都遵循官方的 Claude Code 插件规范。位于 <code>.claude-plugin/marketplace.json</code> 的市场清单编录了全部十个插件。每个插件目录包含：",
    "All plugins query the Agent Monitor API at <code>http://localhost:4820</code>. Key capabilities they leverage:":
      "所有插件都在 <code>http://localhost:4820</code> 查询 Agent Monitor API。它们所利用的关键能力：",
    Capability: "能力",
    Details: "详情",
    "Token tracking": "令牌跟踪",
    "4 types (input, output, cache_read, cache_write) + 4 compaction baselines per model per session":
      "4 种类型（input、output、cache_read、cache_write）+ 每个会话每个模型 4 个压缩基线",
    "Cost calculation": "成本计算",
    "<code>(tokens / 1M) × rate_per_mtok</code> for each type; longest pattern match wins":
      "每种类型为 <code>(tokens / 1M) × rate_per_mtok</code>；最长模式匹配胜出",
    "Session metadata": "会话元数据",
    "Event types": "事件类型",
    "Workflow intelligence": "工作流智能",
    "11 datasets: stats, orchestration (DAG), toolFlow, effectiveness, patterns, modelDelegation, errorPropagation, concurrency, complexity, compaction, cooccurrence":
      "11 个数据集：stats、orchestration（DAG）、toolFlow、effectiveness、patterns、modelDelegation、errorPropagation、concurrency、complexity、compaction、cooccurrence",
    "Agent hierarchy": "代理层级",
    "Recursive parent/child tree with subagent_type, depth tracking via recursive CTE":
      "带 subagent_type 的递归父/子树，通过递归 CTE 进行深度跟踪",
    '📖 Full documentation: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/docs/PLUGINS.md"><code>docs/plugins.md</code></a>':
      '📖 完整文档：<a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/docs/PLUGINS.md"><code>docs/plugins.md</code></a>',
    '<span class="caption-icon">🖥️</span> Statusline — always-visible bar showing context window usage, token counts, active model, git branch, and session ID. Configurable segments with theme support':
      '<span class="caption-icon">🖥️</span> 状态栏——始终可见的栏，显示上下文窗口用量、令牌计数、活动模型、git 分支和会话 ID。可配置的分段并支持主题',
    "The <code>statusline/</code> directory contains a standalone CLI statusline for Claude Code — completely independent of the web dashboard. It renders a color-coded bar at the bottom of the Claude Code terminal showing context window usage, per-direction token counts, session cost in USD, and git branch.":
      "<code>statusline/</code> 目录包含一个用于 Claude Code 的独立 CLI 状态栏——完全独立于 Web 仪表板。它在 Claude Code 终端底部渲染一个带颜色编码的栏，显示上下文窗口用量、按方向划分的令牌计数、以 USD 计的会话成本以及 git 分支。",
    Segment: "分段",
    Source: "来源",
    "Color Logic": "颜色逻辑",
    "Always cyan": "始终为青色",
    "Always green": "始终为绿色",
    "Always yellow, <code>~</code> prefix for home": "始终为黄色，主目录加 <code>~</code> 前缀",
    "Always magenta, hidden outside git repos": "始终为洋红色，在 git 仓库之外隐藏",
    "Green &lt; 50%, Yellow 50–79%, Red ≥ 80%": "&lt; 50% 为绿色，50–79% 为黄色，≥ 80% 为红色",
    "Green <code>↑</code> input, cyan <code>↓</code> output, dim <code>c</code> cache reads":
      "绿色 <code>↑</code> 为输入，青色 <code>↓</code> 为输出，暗色 <code>c</code> 为缓存读取",
    "Green &lt; $5, Yellow $5–$20, Red ≥ $20 (shown on API and subscription plans)":
      "&lt; $5 为绿色，$5–$20 为黄色，≥ $20 为红色（在 API 和订阅计划上显示）",
    "Add this to <code>~/.claude/settings.json</code>:":
      "将此内容添加到 <code>~/.claude/settings.json</code>：",
    "No dependencies required": "无需任何依赖",
    "The statusline uses only Python 3.6+ stdlib (<code>sys</code>, <code>json</code>, <code>os</code>, <code>subprocess</code>). It fails silently on empty input or JSON errors and never blocks Claude Code.":
      "该状态栏仅使用 Python 3.6+ 标准库（<code>sys</code>、<code>json</code>、<code>os</code>、<code>subprocess</code>）。在空输入或 JSON 错误时会静默失败，且绝不会阻塞 Claude Code。",
    '<span class="caption-icon">🔌</span> Sidebar — live health, analytics, and deep navigation links':
      '<span class="caption-icon">🔌</span> 侧边栏 — 实时健康状态、分析和深度导航链接',
    "The <b>Claude Code Agent Monitor</b> is a premium, high-fidelity extension designed to minimize context switching for AI engineers. It brings the full power of the dashboard directly into VS Code, allowing you to monitor complex subagent orchestration without ever leaving your active code file.":
      "<b>Claude Code Agent Monitor</b> 是一款高品质、高保真的扩展，旨在为 AI 工程师减少上下文切换。它将仪表盘的全部能力直接带入 VS Code，让你无需离开当前代码文件即可监控复杂的子代理编排。",
    "A dedicated Activity Bar view that performs background polling every 5 seconds. Includes a real-time <b>Agent Health</b> monitor tracking all 5 states (Working, Connected, Idle, Completed, Error) with native VS Code theme-aware icons and colors.":
      "一个专属的活动栏视图，每 5 秒进行一次后台轮询。包含一个实时的 <b>Agent Health</b> 监视器，跟踪全部 5 种状态（Working、Connected、Idle、Completed、Error），并采用原生的、感知 VS Code 主题的图标和颜色。",
    "Aggregates data from multiple API endpoints to display high-signal metrics directly in the sidebar: <ul style=\"margin-top: 8px; color: var(--text-muted); font-size: 13px; list-style-type: '→ '; padding-left: 15px;\"> <li><b>Token Consumption</b>: Scaled tracking from 1k to 1.0B+ tokens.</li> <li><b>Live Cost Estimates</b>: Automatic USD cost calculation based on model pricing rules.</li> <li><b>Event Frequency</b>: Total events, daily sessions, and subagent spawning rates.</li> </ul>":
      "聚合来自多个 API 端点的数据，直接在侧边栏中显示高信号指标： <ul style=\"margin-top: 8px; color: var(--text-muted); font-size: 13px; list-style-type: '→ '; padding-left: 15px;\"> <li><b>Token Consumption</b>：从 1k 到 1.0B+ tokens 的分级跟踪。</li> <li><b>Live Cost Estimates</b>：根据模型定价规则自动计算美元成本。</li> <li><b>Event Frequency</b>：总事件数、每日会话数和子代理生成速率。</li> </ul>",
    "<b>Token Consumption</b>: Scaled tracking from 1k to 1.0B+ tokens.":
      "<b>Token Consumption</b>：从 1k 到 1.0B+ tokens 的分级跟踪。",
    "<b>Live Cost Estimates</b>: Automatic USD cost calculation based on model pricing rules.":
      "<b>Live Cost Estimates</b>：根据模型定价规则自动计算美元成本。",
    "<b>Event Frequency</b>: Total events, daily sessions, and subagent spawning rates.":
      "<b>Event Frequency</b>：总事件数、每日会话数和子代理生成速率。",
    "Renders the full React application within a native webview tab. Supports <b>Deep Linking</b>: one-click jump from the sidebar directly to specific views like the <i>Kanban Board</i>, <i>Analytics Hub</i>, or your <i>Last 10 Sessions</i>.":
      "在原生 webview 标签页中渲染完整的 React 应用。支持 <b>Deep Linking</b>：从侧边栏一键直达特定视图，例如 <i>Kanban Board</i>、<i>Analytics Hub</i> 或你的 <i>Last 10 Sessions</i>。",
    "Seamlessly scans ports <code>5173</code> (Vite Dev) and <code>4820</code> (Production) on localhost. Automatically toggles between <b>Online</b> and <b>Offline</b> modes in the sidebar as you start or stop your local server.":
      "无缝扫描 localhost 上的端口 <code>5173</code>（Vite Dev）和 <code>4820</code>（Production）。当你启动或停止本地服务器时，会在侧边栏中自动切换 <b>Online</b> 和 <b>Offline</b> 模式。",
    "<strong>Zero-Config Setup</strong>": "<strong>零配置安装</strong>",
    "The extension is designed to be plug-and-play. Once your server is running, the extension automatically discovers the API and begins streaming telemetry — no manual URL configuration required.":
      "该扩展设计为即插即用。一旦服务器运行，扩展会自动发现 API 并开始流式传输遥测数据 — 无需手动配置 URL。",
    '📖 Full developer guide: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/vscode-extension/README.md"><code>vscode-extension/README.md</code></a>':
      '📖 完整开发者指南：<a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/vscode-extension/README.md"><code>vscode-extension/README.md</code></a>',
    "The dashboard ships as an optional <strong>native desktop application</strong> — a <code>desktop/</code> workspace that wraps the existing server and client into a macOS <code>.app</code> (distributed as a <code>.dmg</code>) and a Windows <code>.exe</code> (an NSIS installer plus a no-install portable build) you install once and forget. <code>desktop/</code> is a sibling workspace to <code>client/</code>, <code>server/</code>, <code>mcp/</code>, and <code>vscode-extension/</code>, built with <strong>Electron 35</strong>. It <strong>embeds the Express server in-process</strong> — it <code>require()</code>s <code>server/index.js</code> directly in the same Node runtime as the Electron main process (no child process, no IPC) — and renders the already-built React client in a <code>BrowserWindow</code>. Everything you see in the browser at <code>localhost:4820</code> lives inside this window, with native OS lifecycle on top.":
      "仪表盘还以可选的<strong>原生桌面应用</strong>形式发布 — 一个 <code>desktop/</code> 工作区，将现有的服务器和客户端封装为 macOS <code>.app</code>（以 <code>.dmg</code> 形式分发）和 Windows <code>.exe</code>（一个 NSIS 安装程序外加一个免安装的便携版构建），你只需安装一次即可。<code>desktop/</code> 是 <code>client/</code>、<code>server/</code>、<code>mcp/</code> 和 <code>vscode-extension/</code> 的同级工作区，使用 <strong>Electron 35</strong> 构建。它<strong>在进程内嵌入 Express 服务器</strong> — 它在与 Electron 主进程相同的 Node 运行时中直接 <code>require()</code> <code>server/index.js</code>（没有子进程，没有 IPC） — 并在 <code>BrowserWindow</code> 中渲染已经构建好的 React 客户端。你在浏览器中通过 <code>localhost:4820</code> 看到的一切都存在于这个窗口内，并在其之上叠加了原生的操作系统生命周期。",
    '<span class="caption-icon">🍎🪟</span> <span>The full dashboard, natively on macOS <strong>and</strong> Windows — same React client, same Express server, real <code>BrowserWindow</code>. Menu-bar / notification-area (tray) icon included. Shipped as a macOS DMG and a Windows EXE (macOS shown) — see <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a>.</span>':
      '<span class="caption-icon">🍎🪟</span> <span>完整的仪表盘，原生运行于 macOS <strong>和</strong> Windows — 相同的 React 客户端，相同的 Express 服务器，真正的 <code>BrowserWindow</code>。包含菜单栏 / 通知区域（托盘）图标。以 macOS DMG 和 Windows EXE 形式发布（图中所示为 macOS） — 参见 <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a>。</span>',
    '<span class="caption-icon">🪟</span> <span>The same dashboard as a native <strong>Windows</strong> app — real <code>BrowserWindow</code> with the native Windows window menu, live Activity Feed, and the Tabby companion. A notification-area (system tray) icon sits beside the clock for quick access.</span>':
      '<span class="caption-icon">🪟</span> <span>同一个仪表盘作为原生 <strong>Windows</strong> 应用 — 真正的 <code>BrowserWindow</code>，带有原生 Windows 窗口菜单、实时 Activity Feed 以及 Tabby 伴侣。通知区域（系统托盘）图标位于时钟旁边，便于快速访问。</span>',
    "<strong>One-line mental model</strong>": "<strong>一句话心智模型</strong>",
    "<em>Electron is a window onto the same code.</em> The desktop app does not reimplement the dashboard — it hosts the exact server and client the standalone deployment runs. The only change outside <code>desktop/</code> is a behavior-preserving refactor of <code>server/index.js</code>: its post-listen bootstrap was extracted into an exported <code>startBackgroundServices()</code> so the embedded server runs exactly what <code>node server/index.js</code> runs.":
      "<em>Electron 只是通向同一套代码的一扇窗。</em> 桌面应用并没有重新实现仪表盘 — 它托管的正是独立部署所运行的同一套服务器和客户端。<code>desktop/</code> 之外唯一的改动是对 <code>server/index.js</code> 进行了一次保持行为不变的重构：它在监听之后的引导逻辑被提取为一个导出的 <code>startBackgroundServices()</code>，因此嵌入式服务器运行的内容与 <code>node server/index.js</code> 运行的内容完全一致。",
    "The Electron main process hosts the embedded server <em>and</em> manages the window, tray, and menus. The renderer is just Chromium loading <code>http://127.0.0.1:&lt;port&gt;</code> — the same origin a normal browser would use.":
      "Electron 主进程托管嵌入式服务器，<em>同时</em>管理窗口、托盘和菜单。渲染进程只是加载 <code>http://127.0.0.1:&lt;port&gt;</code> 的 Chromium — 与普通浏览器使用的源相同。",
    "The desktop app embeds the Express server in-process — no child process, no IPC":
      "桌面应用在进程内嵌入 Express 服务器 — 没有子进程，没有 IPC",
    "An always-on tray icon — the macOS menu bar (a tinted template glyph) or the Windows notification area (the colored <code>icon.ico</code>). A single click (left or right) opens a dropdown with a <strong>live status snapshot</strong> queried straight from SQLite at click time — server port, active sessions, working agents, events today — followed by <strong>Open Dashboard</strong>, <strong>Open in Browser</strong>, <strong>Restart Server</strong>, <strong>Show Logs</strong>, <strong>Open at Login</strong> (toggle), and <strong>Quit</strong>. The snapshot rows are clickable — they open the dashboard. The menu is rebuilt on each open so every value is current.":
      "一个常驻的托盘图标 — macOS 菜单栏中（一个着色的模板图形）或 Windows 通知区域中（彩色的 <code>icon.ico</code>）。单击（左键或右键）即可打开一个下拉菜单，其中包含点击时直接从 SQLite 查询的<strong>实时状态快照</strong> — 服务器端口、活动会话、工作中的代理、今日事件 — 随后是 <strong>Open Dashboard</strong>、<strong>Open in Browser</strong>、<strong>Restart Server</strong>、<strong>Show Logs</strong>、<strong>Open at Login</strong>（切换）和 <strong>Quit</strong>。快照行可点击 — 点击会打开仪表盘。菜单在每次打开时重建，因此每个值都是最新的。",
    "A standard native application menu — <code>About</code>, <code>Open at Login</code>, <code>File</code>, <code>Edit</code>, <code>View</code>, <code>Window</code>, <code>Help</code> — with <code>⌘R</code> / <code>Ctrl+R</code> wired to <em>View ▸ reload</em>. External links open in the system browser, never inside Electron. The <code>File ▸ Open Dashboard</code> item (<code>⌘1</code>) is macOS-only; on Windows/Linux the window-attached menu can't reopen a hidden window, so reopen from the tray's <strong>Open Dashboard</strong>.":
      "一个标准的原生应用菜单 — <code>About</code>、<code>Open at Login</code>、<code>File</code>、<code>Edit</code>、<code>View</code>、<code>Window</code>、<code>Help</code> — 其中 <code>⌘R</code> / <code>Ctrl+R</code> 绑定到 <em>View ▸ reload</em>。外部链接会在系统浏览器中打开，绝不会在 Electron 内部打开。<code>File ▸ Open Dashboard</code> 菜单项（<code>⌘1</code>）仅限 macOS；在 Windows/Linux 上，附属于窗口的菜单无法重新打开一个已隐藏的窗口，因此请从托盘的 <strong>Open Dashboard</strong> 重新打开。",
    "Flip <em>Open at Login</em> in the tray or app menu — both platforms go through Electron's first-party <code>app.*LoginItemSettings</code> API. On macOS it registers via the modern <code>SMAppService</code> API and appears under <strong>System Settings → General → Login Items</strong>; on Windows it writes a per-user <code>HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run</code> entry, visible in <strong>Task Manager → Startup</strong>. When the app is launched at login it starts tray-only, with no window jumping into view (on Windows the login launch is detected via a <code>--ccam-hidden</code> argument).":
      "在托盘或应用菜单中切换 <em>Open at Login</em> — 两个平台都通过 Electron 的第一方 <code>app.*LoginItemSettings</code> API 实现。在 macOS 上，它通过现代的 <code>SMAppService</code> API 注册，并出现在 <strong>System Settings → General → Login Items</strong> 下；在 Windows 上，它会写入一个按用户的 <code>HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run</code> 条目，可在 <strong>Task Manager → Startup</strong> 中看到。当应用在登录时启动时，它仅以托盘形式启动，不会有窗口跳出来（在 Windows 上，登录启动通过 <code>--ccam-hidden</code> 参数来检测）。",
    'Closing the window hides it — the embedded server keeps running, the tray icon stays, and the dock / taskbar icon stays too (a clickable "still alive" indicator). <strong>Quit</strong> (<code>⌘Q</code> / <code>Ctrl+Q</code>, app menu, or tray → Quit) pops a confirmation modal — press the Quit button or hit <code>⌘Q</code> / <code>Ctrl+Q</code> a second time to skip the prompt — and only then does the embedded server shut down, closing SQLite cleanly with a WAL checkpoint and removing this PID\'s entry from the discovery file.':
      "关闭窗口只会将其隐藏 — 嵌入式服务器继续运行，托盘图标保留，dock / 任务栏图标也保留（一个可点击的“仍在运行”指示器）。<strong>Quit</strong>（<code>⌘Q</code> / <code>Ctrl+Q</code>、应用菜单，或托盘 → Quit）会弹出一个确认对话框 — 按下 Quit 按钮或再次按 <code>⌘Q</code> / <code>Ctrl+Q</code> 可跳过该提示 — 只有这时嵌入式服务器才会关闭，通过 WAL 检查点干净地关闭 SQLite，并从发现文件中移除此 PID 的条目。",
    "Launch the desktop app and <code>npm run dev</code> at the same time and both stay real-time. Each server appends its <code>{port, pid, startedAt}</code> entry to <code>~/.claude/.agent-dashboard.json</code> on startup; the Claude Code hook handler reads that list and fan-outs every event to every live entry in parallel. Stale entries self-evict via a PID liveness check on read, so a crashed server can't misroute events to a dead port.":
      "同时启动桌面应用和 <code>npm run dev</code>，两者都能保持实时。每个服务器在启动时都会将其 <code>{port, pid, startedAt}</code> 条目追加到 <code>~/.claude/.agent-dashboard.json</code>；Claude Code 的 hook 处理程序读取该列表，并将每个事件并行扇出到每个存活的条目。陈旧的条目会在读取时通过 PID 存活检查自行清除，因此崩溃的服务器无法将事件误路由到已失效的端口。",
    "Double-launching the app just focuses the existing window — no second server, no port collision, on every platform. The lock is acquired via <code>requestSingleInstanceLock()</code> before any server boots.":
      "重复启动应用只会聚焦现有窗口 — 在每个平台上都不会出现第二个服务器、不会发生端口冲突。该锁在任何服务器启动之前通过 <code>requestSingleInstanceLock()</code> 获取。",
    "On its first owned-server boot the app auto-installs the Claude Code hooks into <code>~/.claude/settings.json</code> and starts the background services (update scheduler, config watcher, orphaned-run reconciliation) — so an install-only user (DMG or EXE) gets events flowing without ever running <code>npm run install-hooks</code> from a checkout.":
      "在首次启动自有服务器时，应用会自动将 Claude Code hooks 安装到 <code>~/.claude/settings.json</code> 中，并启动后台服务（更新调度器、配置监视器、孤立运行的对账） — 因此仅通过安装包使用的用户（DMG 或 EXE）无需从检出的代码中运行 <code>npm run install-hooks</code> 即可让事件流动起来。",
    "Two packaging realities — a read-only application bundle / install directory and (on macOS) the minimal <code>PATH</code> a Finder-launched app inherits — are handled automatically so installs survive updates and the <strong>Run Claude</strong> feature works out of the box on both macOS and Windows.":
      "两个打包方面的现实情况 — 只读的应用程序包 / 安装目录，以及（在 macOS 上）Finder 启动的应用所继承的最小化 <code>PATH</code> — 都会被自动处理，因此安装能够在更新中保留下来，并且 <strong>Run Claude</strong> 功能在 macOS 和 Windows 上都能开箱即用。",
    "<strong>Your data survives reinstalls and updates</strong>":
      "<strong>你的数据在重装和更新后依然保留</strong>",
    "The SQLite database and VAPID keys live in a per-user app-data directory <em>outside</em> the application bundle / install dir — <code>~/Library/Application Support/Claude Code Monitor/data/</code> on macOS, <code>%APPDATA%\\Claude Code Monitor\\data\\</code> on Windows. <code>server-host.ts</code> points <code>DASHBOARD_DATA_DIR</code> at that per-user directory on boot. Because a packaged, code-signed, or app-translocated bundle is read-only, older builds that stored the database inside the bundle broke History Import; with the data directory now in app-data, your imported history and events persist across app reinstalls and updates (the Windows NSIS uninstaller keeps this data by default). After upgrading from a pre-fix build, re-run <strong>Import History → Rescan</strong> once to bridge the one-time gap.":
      "SQLite 数据库和 VAPID 密钥存放在应用程序包 / 安装目录<em>之外</em>的一个按用户的应用数据目录中 — 在 macOS 上为 <code>~/Library/Application Support/Claude Code Monitor/data/</code>，在 Windows 上为 <code>%APPDATA%\\Claude Code Monitor\\data\\</code>。<code>server-host.ts</code> 在启动时将 <code>DASHBOARD_DATA_DIR</code> 指向该按用户的目录。由于打包的、经过代码签名的或被应用转移（app-translocated）的应用包是只读的，将数据库存放在包内的旧版本构建会破坏 History Import；现在数据目录位于应用数据中，你导入的历史记录和事件会在应用重装和更新后持续保留（Windows NSIS 卸载程序默认会保留这些数据）。从修复前的构建升级后，请重新运行一次 <strong>Import History → Rescan</strong> 以弥补这一次性的间隔。",
    "<strong>The <code>claude</code> CLI is found automatically</strong>":
      "<strong>会自动找到 <code>claude</code> CLI</strong>",
    "A Finder- or Dock-launched macOS app inherits only launchd's minimal <code>PATH</code>, not your login shell's. At startup <code>shell-path.ts</code> recovers the user's login-shell <code>PATH</code> so the <strong>Run Claude</strong> feature can locate and spawn the <code>claude</code> CLI. (On Windows the process already inherits the user <code>PATH</code>, so no recovery step is needed.) If it still cannot be found, make sure <code>claude</code> is a real executable on your <code>PATH</code> — a shell alias or function cannot be spawned — and check the <code>user PATH resolved</code> line in the desktop log (<code>~/Library/Logs/Claude Code Monitor/desktop.log</code> on macOS, <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> on Windows).":
      "由 Finder 或 Dock 启动的 macOS 应用只会继承 launchd 的最小化 <code>PATH</code>，而不是你登录 shell 的 <code>PATH</code>。在启动时，<code>shell-path.ts</code> 会恢复用户登录 shell 的 <code>PATH</code>，以便 <strong>Run Claude</strong> 功能能够定位并启动 <code>claude</code> CLI。（在 Windows 上，进程已经继承了用户的 <code>PATH</code>，因此无需恢复步骤。）如果仍然找不到，请确保 <code>claude</code> 是你 <code>PATH</code> 上的一个真正的可执行文件 — shell 别名或函数无法被启动 — 并检查桌面日志中的 <code>user PATH resolved</code> 行（在 macOS 上为 <code>~/Library/Logs/Claude Code Monitor/desktop.log</code>，在 Windows 上为 <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code>）。",
    "On launch the Electron main process picks a free port. If a healthy dashboard server already answers <code>/api/health</code> on port <code>4820</code> (for example, you ran <code>npm start</code> in a terminal), the app <strong>adopts</strong> that server instead of starting a second one — no double-binding, no SQLite contention. An adopted server is not owned by the app, so quitting leaves it running.":
      "在启动时，Electron 主进程会选择一个空闲端口。如果已经有一个健康的仪表盘服务器在端口 <code>4820</code> 上响应 <code>/api/health</code>（例如，你在终端中运行了 <code>npm start</code>），应用会<strong>采用</strong>该服务器，而不是启动第二个 — 不会重复绑定，也不会发生 SQLite 争用。被采用的服务器不归应用所有，因此退出应用后它仍会继续运行。",
    Step: "步骤",
    "Port choice": "端口选择",
    Adopt: "采用",
    "A healthy server already on <code>4820</code> is adopted as-is":
      "已经在 <code>4820</code> 上运行的健康服务器会被原样采用",
    Preferred: "首选",
    "<code>4820</code> when free": "空闲时使用 <code>4820</code>",
    Fallback: "回退",
    "The first free port in <code>4821</code>–<code>4829</code>":
      "<code>4821</code>–<code>4829</code> 中的第一个空闲端口",
    "Last resort": "最后手段",
    "A random high port when all of the above are taken":
      "当上述端口都被占用时，使用一个随机的高位端口",
    "Three ways to obtain the desktop app — the latest GitHub Release (best for most users), a per-commit CI artifact (fresher than the latest release), or a local build.":
      "获取桌面应用有三种方式 — 最新的 GitHub Release（适合大多数用户）、按提交生成的 CI 构件（比最新发布版本更新），或本地构建。",
    'Open <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Releases → latest </a> and download the asset for your platform. The macOS and Windows Desktop CI jobs auto-publish a new <code>vX.Y.Z</code> release every time the version in <code>package.json</code> is bumped on <code>master</code>, so this link always points at the current build. Releases are public — no GitHub sign-in required.':
      '打开 <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Releases → latest </a> 并下载适合你平台的资源。每当 <code>master</code> 上 <code>package.json</code> 中的版本号被提升时，macOS 和 Windows 的桌面 CI 作业都会自动发布一个新的 <code>vX.Y.Z</code> release，因此此链接始终指向当前构建。Release 是公开的 — 无需登录 GitHub。',
    Platform: "平台",
    Asset: "资源",
    "macOS (Apple Silicon)": "macOS（Apple Silicon）",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-arm64.dmg</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-arm64.dmg</code>",
    "Drag the <code>.app</code> into <code>/Applications</code>":
      "将 <code>.app</code> 拖入 <code>/Applications</code>",
    "macOS (Intel)": "macOS（Intel）",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64.dmg</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64.dmg</code>",
    "Windows (installer)": "Windows（安装程序）",
    "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>":
      "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>",
    "NSIS installer — per-user, no admin elevation": "NSIS 安装程序——按用户安装，无需管理员提权",
    "Windows (portable)": "Windows（便携版）",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>",
    "Run without installing": "无需安装即可运行",
    'Want a build straight off the tip of <code>master</code>, ahead of the next tagged release? Every green run of the <code>🍎 macOS Desktop (DMG)</code> job on <code>macos-latest</code> uploads the universal DMG as the <code>ClaudeCodeMonitor-dmg</code> workflow artifact, and the <code>🪟 Windows Desktop (EXE)</code> job on <code>windows-latest</code> uploads the installer + portable EXEs as the <code>ClaudeCodeMonitor-win</code> artifact. Open the <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> latest passing run </a>, scroll to its Artifacts section, and download <code>ClaudeCodeMonitor-dmg</code> or <code>ClaudeCodeMonitor-win</code>. (GitHub sign-in required; 14-day retention.)':
      '想要直接从 <code>master</code> 最新提交处构建、抢先于下一个打标签的发布版本？<code>macos-latest</code> 上 <code>🍎 macOS Desktop (DMG)</code> 任务的每次成功运行都会将通用 DMG 作为 <code>ClaudeCodeMonitor-dmg</code> 工作流制品上传，<code>windows-latest</code> 上 <code>🪟 Windows Desktop (EXE)</code> 任务则将安装程序 + 便携版 EXE 作为 <code>ClaudeCodeMonitor-win</code> 制品上传。打开 <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> 最近一次通过的运行 </a>，滚动到其 Artifacts（制品）区，然后下载 <code>ClaudeCodeMonitor-dmg</code> 或 <code>ClaudeCodeMonitor-win</code>。（需登录 GitHub；保留 14 天。）',
    "From the project root, after <code>git clone</code>:":
      "在项目根目录下，执行 <code>git clone</code> 之后：",
    "Use the arch-specific build on your own machine": "在你自己的机器上使用特定架构的构建",
    "The universal <code>desktop:dmg</code> build is intentionally slow: it builds the full app tree <em>twice</em> (once per architecture), merges both with <code>@electron/universal</code>, and ad-hoc-signs every binary in the merged bundle. For running on a single Mac, use <code>desktop:dmg:arm64</code> (Apple Silicon) or <code>desktop:dmg:x64</code> (Intel) — one architecture, no merge, finishing in roughly a minute instead of many. Reserve the universal build for release artifacts; CI already produces one as <code>ClaudeCodeMonitor-dmg</code>, so you rarely need to build it yourself.":
      "通用 <code>desktop:dmg</code> 构建有意设计得很慢：它会<em>两次</em>构建完整的应用树（每个架构一次），用 <code>@electron/universal</code> 合并两者，并对合并后包中的每个二进制文件进行临时签名。若只在一台 Mac 上运行，请使用 <code>desktop:dmg:arm64</code>（Apple Silicon）或 <code>desktop:dmg:x64</code>（Intel）——单一架构，无需合并，大约一分钟即可完成，而非很多分钟。请将通用构建保留给发布制品；CI 已经会生成一个名为 <code>ClaudeCodeMonitor-dmg</code> 的，因此你很少需要自己构建它。",
    "Double-click the downloaded <code>.dmg</code> to mount it":
      "双击下载的 <code>.dmg</code> 以挂载它",
    "Drag <code>Claude Code Monitor.app</code> into your <code>Applications</code> folder":
      "将 <code>Claude Code Monitor.app</code> 拖入你的 <code>Applications</code> 文件夹",
    "Run <code>xattr -cr</code> on the app to get past Gatekeeper (see below)":
      "对该应用运行 <code>xattr -cr</code> 以绕过 Gatekeeper（见下文）",
    "Open the app — the tray icon appears and the dashboard window loads":
      "打开应用——托盘图标出现，仪表盘窗口随之加载",
    "Gatekeeper warning on first launch": "首次启动时的 Gatekeeper 警告",
    'The DMG is ad-hoc signed by default — that is all the project can offer without a paid Apple Developer ID. macOS warns the first time you open it (<em>"Apple could not verify…"</em>). Strip the quarantine attribute to get past it:':
      "DMG 默认采用临时签名——在没有付费 Apple Developer ID 的情况下，这已是该项目所能提供的全部。macOS 会在你首次打开时发出警告（<em>“Apple could not verify…”</em>）。去除隔离属性即可绕过它：",
    "Alternatively, open <strong>System Settings → Privacy &amp; Security</strong>, find the blocked app, and click <em>Open Anyway</em>. Code signing and Apple notarization are opt-in for the maintainer — when configured, this warning goes away for everyone.":
      "或者，打开 <strong>System Settings → Privacy &amp; Security</strong>，找到被阻止的应用，然后点击 <em>Open Anyway</em>。代码签名和 Apple 公证对维护者而言是可选项——一旦配置完成，这条警告对所有人都会消失。",
    "Run <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> — a per-user NSIS install (no admin), or run the <code>*-portable.exe</code> to skip installing":
      "运行 <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>——按用户的 NSIS 安装（无需管理员），或运行 <code>*-portable.exe</code> 以跳过安装",
    "The EXE is unsigned by default, so SmartScreen may warn — click <em>More info → Run anyway</em>":
      "EXE 默认未签名，因此 SmartScreen 可能会发出警告——点击 <em>More info → Run anyway</em>",
    "Open from the Start menu / desktop shortcut — the notification-area (tray) icon appears and the dashboard window loads":
      "从开始菜单/桌面快捷方式打开——通知区域（托盘）图标出现，仪表盘窗口随之加载",
    '<span class="caption-icon">1️⃣</span> <span>NSIS installer, step 1 — <strong>Choose Installation Options</strong>: pick per-user setup and optional shortcuts.</span>':
      '<span class="caption-icon">1️⃣</span> <span>NSIS 安装程序，第 1 步——<strong>Choose Installation Options</strong>：选择按用户安装和可选的快捷方式。</span>',
    '<span class="caption-icon">2️⃣</span> <span>NSIS installer, step 2 — <strong>Choose Install Location</strong>: defaults to <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code>, or point it anywhere.</span>':
      '<span class="caption-icon">2️⃣</span> <span>NSIS 安装程序，第 2 步——<strong>Choose Install Location</strong>：默认为 <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code>，也可指向任意位置。</span>',
    '<span class="caption-icon">3️⃣</span> <span>NSIS installer, step 3 — <strong>Completing Setup</strong>: click <em>Finish</em> to launch the app and drop the tray icon in the notification area.</span>':
      '<span class="caption-icon">3️⃣</span> <span>NSIS 安装程序，第 3 步——<strong>Completing Setup</strong>：点击 <em>Finish</em> 启动应用并将托盘图标放入通知区域。</span>',
    "SmartScreen warning on first launch": "首次启动时的 SmartScreen 警告",
    'The installer and portable EXE are <strong>unsigned</strong> by default — that is all the project can offer without a paid code-signing certificate. Windows <strong>SmartScreen</strong> may show <em>"Windows protected your PC"</em> the first time you run it; click <strong>More info → Run anyway</strong>. The installer lays the app down <strong>per-user</strong> under <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code> (and lets you choose the install directory) and sets an <code>AppUserModelId</code> (<code>com.hoangsonww.ccam.desktop</code>) so native toast notifications are attributed correctly and the window groups under one taskbar entry.':
      "安装程序和便携版 EXE 默认<strong>未签名</strong>——在没有付费代码签名证书的情况下，这已是该项目所能提供的全部。Windows <strong>SmartScreen</strong> 可能会在你首次运行时显示 <em>“Windows protected your PC”</em>；点击 <strong>More info → Run anyway</strong>。安装程序会将应用<strong>按用户</strong>放置在 <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code> 下（并允许你选择安装目录），并设置一个 <code>AppUserModelId</code>（<code>com.hoangsonww.ccam.desktop</code>），以便原生的 toast 通知能被正确归属，且窗口会归入同一个任务栏条目下。",
    "Bundle size": "包大小",
    "The DMG is roughly 80&nbsp;MB, about 250&nbsp;MB installed on disk — the standard Electron tax; the Windows installer is comparable. The app runs natively on <strong>macOS and Windows</strong>; Linux is tracked as a follow-up. Logs live at <code>~/Library/Logs/Claude Code Monitor/desktop.log</code> on macOS or <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> on Windows (reach them from the tray menu → <em>Show Logs</em>).":
      "DMG 大约 80&nbsp;MB，安装到磁盘上约 250&nbsp;MB——这是标准的 Electron 代价；Windows 安装程序也相当。该应用在 <strong>macOS 和 Windows</strong> 上原生运行；Linux 作为后续项被跟踪。日志在 macOS 上位于 <code>~/Library/Logs/Claude Code Monitor/desktop.log</code>，在 Windows 上位于 <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code>（可从托盘菜单 → <em>Show Logs</em> 找到它们）。",
    '📖 User-facing guide: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a> · architecture &amp; contributor reference: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/desktop/README.md"><code>desktop/README.md</code></a>':
      '📖 面向用户的指南：<a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a> · 架构与贡献者参考：<a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/desktop/README.md"><code>desktop/README.md</code></a>',
    '<span class="caption-icon">⚙️</span> Settings — model pricing editor, hook installation toggle, JSON data export, session cleanup, browser notification preferences, and system info panel with DB stats':
      '<span class="caption-icon">⚙️</span> Settings——模型定价编辑器、hook 安装开关、JSON 数据导出、会话清理、浏览器通知偏好，以及带数据库统计的系统信息面板',
    "The <code>/settings</code> route provides a comprehensive management interface with six sections:":
      "<code>/settings</code> 路由提供了一个含六个部分的综合管理界面：",
    "Editable table of per-model pricing rules. Each Claude model variant has its own explicit pattern (e.g., <code>claude-opus-4-6%</code>). Rates cover input, output, cache read, and cache write tokens. Each rule's editor also has a collapsible <strong>Introductory rates</strong> block — a <code>YYYY-MM-DD</code> promo cutoff plus per-category intro prices (input / output / cache-read / cache-write 5m &amp; 1h); an empty date means no promo, and any future model-launch promo needs no code change. Reset to defaults or add custom models. The section header carries an info popover (the <code>i</code> icon) that explains how rule lookup works (first matching pattern wins), the SQL-style <code>%</code> wildcard syntax with concrete examples (<code>claude-opus-4-7%</code>, <code>claude-%-haiku</code>, exact ids), and reminds the user that prices must be updated manually when Anthropic publishes new rates — already-stored sessions keep the price applied at ingest time. The CLAUDE_HOME panel and Import History flow are fully i18n-driven across en/vi/zh.":
      "可编辑的按模型定价规则表。每个 Claude 模型变体都有自己明确的模式（例如 <code>claude-opus-4-6%</code>）。费率涵盖输入、输出、缓存读取和缓存写入 token。每条规则的编辑器还带有一个可折叠的 <strong>Introductory rates</strong>（引导期费率）区块——一个 <code>YYYY-MM-DD</code> 的促销截止日期，外加按类别设置的引导期价格（输入 / 输出 / 缓存读取 / 缓存写入 5m &amp; 1h）；日期留空即表示没有促销，而任何未来的模型发布促销都无需改动代码。可重置为默认值或添加自定义模型。该区块标题带有一个信息弹出框（<code>i</code> 图标），用于说明规则查找的工作方式（首个匹配的模式胜出）、SQL 风格的 <code>%</code> 通配符语法及具体示例（<code>claude-opus-4-7%</code>、<code>claude-%-haiku</code>、精确 id），并提醒用户在 Anthropic 公布新费率时必须手动更新价格——已存储的会话会保留入库时所应用的价格。CLAUDE_HOME 面板和 Import History 流程在 en/vi/zh 之间完全由 i18n 驱动。",
    "Shows per-hook installation status (SessionStart, PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionEnd). One-click reinstall if hooks are missing or outdated. Validates paths and permissions automatically.":
      "显示每个 hook 的安装状态（SessionStart、PreToolUse、PostToolUse、Stop、SubagentStop、Notification、SessionEnd）。若 hook 缺失或过时，可一键重新安装。自动验证路径和权限。",
    "View database row counts and size. Session cleanup: abandon stale active sessions after N hours, purge old completed sessions after N days. Danger zone: clear all data with confirmation dialog to prevent accidental loss.":
      "查看数据库行数和大小。会话清理：在 N 小时后放弃陈旧的活动会话，在 N 天后清除旧的已完成会话。危险区：通过确认对话框清除所有数据，以防意外丢失。",
    "Download all sessions, agents, events, token usage, and pricing rules as a single JSON file for backup or analysis. Includes full event history, model metadata, and cost breakdowns in one portable archive.":
      "将所有会话、智能体、事件、token 用量和定价规则下载为单个 JSON 文件，以供备份或分析。在一个可移植的归档中包含完整的事件历史、模型元数据和成本明细。",
    "Dedicated Health tab on the Dashboard with a composite health score (weighted from success rate, cache hit rate, error rate, and heap usage), storage engine donut chart, tool invocation frequency bars, subagent effectiveness, model token distribution, and compaction impact — all with cursor-following tooltips and 5-second auto-refresh.":
      "仪表盘上专门的 Health 选项卡，带有综合健康评分（由成功率、缓存命中率、错误率和堆内存使用加权得出）、存储引擎环形图、工具调用频率条形图、子智能体有效性、模型 token 分布以及压缩影响——全部配有跟随光标的提示框和 5 秒自动刷新。",
    "Configure native browser notifications with per-event toggles for session starts, completions, errors, and subagent spawns. Automatic permission management with test-send button and graceful fallback when denied.":
      "配置原生浏览器通知，针对会话开始、完成、错误和子智能体生成提供按事件的开关。自动权限管理，带测试发送按钮，并在被拒绝时优雅降级。",
    "Per-model pricing — no catch-all grouping": "按模型定价——没有一刀切的分组",
    "Each Claude model variant (e.g., Opus 4.6 vs Opus 4.1) has its own explicit pricing pattern because different model versions have different rates. The cost engine uses specificity sorting — longer patterns match before shorter ones.":
      "每个 Claude 模型变体（例如 Opus 4.6 与 Opus 4.1）都有自己明确的定价模式，因为不同的模型版本有不同的费率。成本引擎采用特异性排序——更长的模式优先于更短的模式进行匹配。",
    "Turns the dashboard from passive viewing into active monitoring. A rules-based alerting engine evaluates the live event stream <strong>server-side</strong>, and fired alerts fan out to outbound <strong>webhook channels</strong>. Everything lives in one place — <strong>Settings → Alerts</strong> — behind a segmented control with three tabs: <strong>Rules</strong> (what triggers an alert), <strong>Channels</strong> (where alerts are delivered), and <strong>Activity</strong> (the live fired-alert feed with acknowledge / acknowledge-all).":
      "将仪表盘从被动查看转变为主动监控。一个基于规则的告警引擎在<strong>服务器端</strong>评估实时事件流，触发的告警会扇出到出站的 <strong>webhook 通道</strong>。一切都集中于一处——<strong>Settings → Alerts</strong>——位于一个含三个选项卡的分段控件之后：<strong>Rules</strong>（什么会触发告警）、<strong>Channels</strong>（告警送往何处）和 <strong>Activity</strong>（实时的已触发告警信息流，带确认/全部确认）。",
    'Four condition types: <strong>event pattern</strong> (match <code>event_type</code> / <code>tool_name</code> / a summary substring, optionally requiring ≥ N matches within a rolling window — e.g. "5 errors in 2 minutes"), <strong>inactivity</strong> (an active session goes quiet for N minutes), <strong>status duration</strong> (an agent is stuck in <code>working</code> / <code>waiting</code> for N minutes), and <strong>token threshold</strong> (a session\'s cumulative tokens cross a limit). Each rule has a configurable <strong>cooldown</strong> that dedups repeat alerts per (rule, session, agent).':
      "四种条件类型：<strong>事件模式</strong>（匹配 <code>event_type</code> / <code>tool_name</code> / 摘要子串，可选地要求在滚动窗口内匹配 ≥ N 次——例如“2 分钟内 5 个错误”）、<strong>不活动</strong>（活动会话静默 N 分钟）、<strong>状态时长</strong>（智能体卡在 <code>working</code> / <code>waiting</code> 状态达 N 分钟）以及<strong>token 阈值</strong>（会话的累计 token 越过某个上限）。每条规则都有可配置的<strong>冷却时间</strong>，按（规则、会话、智能体）对重复告警去重。",
    "Event-driven rules (<code>event_pattern</code>, <code>token_threshold</code>) run on every hook ingest — <em>after</em> the transaction commits and the response is sent, fully try/catch-guarded, so alerting can never slow or fail hook delivery. Time-based rules (<code>inactivity</code>, <code>status_duration</code>) run on an unref'd 60-second sweep. Enabled rules are cached in memory and invalidated on every edit. Fired alerts persist to <code>alert_events</code> and broadcast an <code>alert_triggered</code> WebSocket message.":
      "事件驱动的规则（<code>event_pattern</code>、<code>token_threshold</code>）在每次 hook 入库时运行——在事务提交并发送响应<em>之后</em>，且完全由 try/catch 保护，因此告警绝不会拖慢或导致 hook 投递失败。基于时间的规则（<code>inactivity</code>、<code>status_duration</code>）在一个 unref 的 60 秒扫描中运行。已启用的规则缓存在内存中，并在每次编辑时失效。触发的告警会持久化到 <code>alert_events</code>，并广播一条 <code>alert_triggered</code> WebSocket 消息。",
    "Slack, Discord, Microsoft Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, and Pipedream — plus a generic JSON endpoint. A declarative <strong>provider registry</strong> describes each one's payload formatter, URL resolution, auth headers, and credential fields, so adding a provider is a single server-side entry that surfaces in the UI with no front-end change.":
      "Slack、Discord、Microsoft Teams、Google Chat、Mattermost、Rocket.Chat、Telegram、PagerDuty、Opsgenie、Splunk On-Call、Zapier、Make、n8n 和 Pipedream——外加一个通用的 JSON 端点。一个声明式的<strong>提供方注册表</strong>描述了每个提供方的载荷格式化器、URL 解析、认证头和凭据字段，因此添加一个提供方只是一个服务器端条目，便会在 UI 中呈现，无需任何前端改动。",
    'Each delivery POSTs with an <code>AbortController</code> timeout and bounded retry/backoff (retries transport errors, 429, and 5xx — never other 4xx), then records the attempt-chain in <code>webhook_deliveries</code>. A provider can also veto a 2xx whose body signals failure (Splunk On-Call returns 200 with <code>result:"failure"</code>). Delivery is <strong>detached and fail-safe</strong> — it never throws into, slows, or blocks the alert path.':
      '每次投递都带有 <code>AbortController</code> 超时和有界的重试/退避（对传输错误、429 和 5xx 重试——绝不对其他 4xx 重试），随后将尝试链记录到 <code>webhook_deliveries</code>。提供方也可以否决一个其响应体表示失败的 2xx（Splunk On-Call 返回 200 但带 <code>result:"failure"</code>）。投递是<strong>分离且故障安全</strong>的——它绝不会向告警路径抛出异常、拖慢或阻塞它。',
    "Target URLs are masked (host + last 4 chars), and secrets / credential fields (routing keys, API keys, bot tokens) plus custom-header values are redacted in every API response — the full URL and secrets are stored server-side and never leave it. Generic endpoints support optional <strong>HMAC-SHA256</strong> body signing (<code>X-Webhook-Signature</code> + <code>X-Webhook-Timestamp</code>) so receivers can verify authenticity.":
      "目标 URL 会被掩码（主机 + 后 4 个字符），且密钥/凭据字段（路由键、API 密钥、bot token）以及自定义头的值在每个 API 响应中都会被脱敏——完整的 URL 和密钥存储在服务器端，绝不离开它。通用端点支持可选的 <strong>HMAC-SHA256</strong> 请求体签名（<code>X-Webhook-Signature</code> + <code>X-Webhook-Timestamp</code>），以便接收方可以验证真实性。",
    'Every alert-rule field has a help tooltip — the event-type, tool-name, and summary-contains fields include example chips of real hook events and built-in tool names. Each webhook provider ships a collapsible step-by-step setup guide linking to the official docs. A one-click <strong>"Send test"</strong> probe fires a synthetic alert and reports the delivery result inline, and targets can be scoped to specific rules. Fully localized (en / zh / vi / ko).':
      "每个告警规则字段都有帮助提示——event-type、tool-name 和 summary-contains 字段包含真实 hook 事件和内置工具名称的示例标签。每个 webhook 提供方都附带一份可折叠的分步设置指南，并链接到官方文档。一键 <strong>“Send test”</strong> 探测会触发一个合成告警并就地报告投递结果，且目标可限定到特定规则。完全本地化（en / zh / vi / ko）。",
    "Provider(s)": "提供方",
    "Payload format": "载荷格式",
    "URL / credentials": "URL / 凭据",
    "Block Kit (header + section + context)": "Block Kit（header + section + context）",
    "Rich embed": "富嵌入（rich embed）",
    "Adaptive Card in a Workflows <code>message</code> envelope":
      "包装在 Workflows <code>message</code> 信封中的 Adaptive Card",
    "Power Automate Workflows URL": "Power Automate Workflows URL",
    "Text message (basic markdown)": "文本消息（基础 markdown）",
    "Space webhook URL": "Space webhook URL",
    "Slack-style legacy attachments": "Slack 风格的旧版附件",
    "Bot API <code>sendMessage</code> (HTML)": "Bot API <code>sendMessage</code>（HTML）",
    "Bot token + chat ID (URL derived)": "Bot token + chat ID（URL 由此推导）",
    "Events API v2 trigger (with <code>dedup_key</code>)":
      "Events API v2 触发（带 <code>dedup_key</code>）",
    "Routing key (URL prefilled)": "路由键（URL 预填）",
    "Alert API": "Alert API",
    "API key (GenieKey header) + region": "API 密钥（GenieKey 头）+ 区域",
    "VictorOps REST": "VictorOps REST",
    "REST endpoint URL (key embedded)": "REST 端点 URL（密钥内嵌）",
    "Stable <code>{ event, alert }</code> JSON envelope":
      "稳定的 <code>{ event, alert }</code> JSON 信封",
    "Endpoint URL (+ optional HMAC &amp; headers)": "端点 URL（+ 可选的 HMAC 与头）",
    "Additive &amp; non-blocking by design": "设计上为增量且非阻塞",
    "Two new tables — <code>webhook_targets</code> (config; survives Clear Data like alert rules) and <code>webhook_deliveries</code> (audit log) — with no changes to existing tables, response shapes, or WebSocket message types. Webhook dispatch is fire-and-forget off the alert path, so a slow or failing endpoint can never slow or break alert firing or hook ingestion.":
      "两个新表——<code>webhook_targets</code>（配置；像告警规则一样在 Clear Data 中保留）和 <code>webhook_deliveries</code>（审计日志）——对现有表、响应结构或 WebSocket 消息类型没有任何改动。Webhook 分发在告警路径之外采用即发即弃方式，因此一个缓慢或失败的端点绝不会拖慢或破坏告警触发或 hook 入库。",
    "Provider setup steps can drift": "提供方的设置步骤可能会变动",
    "Microsoft retired classic Office 365 connectors in 2025, so Teams uses an Adaptive Card delivered via Power Automate <strong>Workflows</strong>. More broadly, provider setup UIs change often — the in-app guides say so and link to each provider's official docs. Always confirm against the source.":
      "Microsoft 在 2025 年停用了经典的 Office 365 连接器，因此 Teams 使用通过 Power Automate <strong>Workflows</strong> 投递的 Adaptive Card。更广泛地说，提供方的设置界面经常变化——应用内的指南也这样说明，并链接到各提供方的官方文档。请始终对照源头进行确认。",
    '<span class="caption-icon">⬆</span> Update Notifier — version comparison modal with one-click copy of the update command. No automatic self-restart; you stay in control of when upgrades happen':
      '<span class="caption-icon">⬆</span> Update Notifier — 版本对比弹窗，可一键复制更新命令。没有自动自我重启；何时升级始终由你掌控',
    "A detection-only subsystem that tells the user when the dashboard's git checkout is behind the canonical default branch. <strong>Branch- and fork-aware:</strong> if an <code>upstream</code> remote is configured (the standard convention for forks), it takes priority over <code>origin</code>; the chosen remote's <code>master</code> / <code>main</code> / <code>HEAD</code> is the comparison ref. The printed command adapts to the user's situation — <code>git pull --ff-only</code> only when their branch actually tracks the canonical ref, otherwise <code>git fetch</code> (with a fast-forward merge in the fork case). The server <strong>never</strong> pulls or restarts itself — the user runs the command in a terminal — so the mechanism cannot break dev sessions, pm2/systemd/launchd/Docker supervision, or leave orphaned processes.":
      "一个仅做检测的子系统，当仪表盘的 git 检出落后于规范默认分支时通知用户。<strong>感知分支与 fork：</strong>如果配置了 <code>upstream</code> 远程（fork 的标准约定），它会优先于 <code>origin</code>；所选远程的 <code>master</code> / <code>main</code> / <code>HEAD</code> 即为对比基准。打印出的命令会根据用户的实际情况自适应——仅当其分支确实跟踪规范基准时才使用 <code>git pull --ff-only</code>，否则使用 <code>git fetch</code>（在 fork 情形下附带一次快进合并）。服务器<strong>绝不</strong>会自行拉取或重启——由用户在终端中运行该命令——因此该机制不会破坏开发会话、pm2/systemd/launchd/Docker 监管，也不会留下孤儿进程。",
    "A shell-less <code>git fetch</code> with a 120-second timeout, followed by a <code>rev-list</code> against the tracked upstream. Each call runs from <code>server/lib/update-check.js</code> and returns a structured payload — never throws — so a flaky remote can&apos;t stall the dashboard.":
      "一次无 shell 的 <code>git fetch</code>，带 120 秒超时，随后对所跟踪的上游执行 <code>rev-list</code>。每次调用都由 <code>server/lib/update-check.js</code> 发起并返回结构化的负载——绝不抛出异常——因此不稳定的远程无法卡住仪表盘。",
    "<code>update-scheduler.js</code> polls every five minutes with <code>.unref()</code> timers so it never blocks shutdown, de-duplicates with a fingerprint over the status payload, and announces up-to-date → behind transitions in a framed stdout block. Disable entirely with <code>DASHBOARD_UPDATE_CHECK=0</code>.":
      "<code>update-scheduler.js</code> 使用 <code>.unref()</code> 定时器每五分钟轮询一次，因此绝不会阻塞关闭流程，并通过状态负载的指纹去重，在带边框的 stdout 块中宣告从最新 → 落后的转变。使用 <code>DASHBOARD_UPDATE_CHECK=0</code> 可完全禁用。",
    "Each status payload carries a <code>manual_command</code> shaped for the user's actual situation: <code>git pull --ff-only</code> on a tracked canonical branch, <code>git fetch &amp;&amp; git merge --ff-only</code> for forks where local tracks the wrong remote, and a plain <code>git fetch</code> on a feature branch where pulling would update the wrong branch. Install / build steps are appended only when the working tree is actually being rewritten.":
      "每个状态负载都带有一个针对用户实际情况量身定制的 <code>manual_command</code>：在跟踪规范分支时为 <code>git pull --ff-only</code>，在本地跟踪了错误远程的 fork 情形下为 <code>git fetch &amp;&amp; git merge --ff-only</code>，而在拉取会更新错误分支的特性分支上则为纯粹的 <code>git fetch</code>。只有当工作树确实会被改写时，才会追加安装/构建步骤。",
    "A modal opens automatically when upstream is ahead; ESC or a backdrop click dismisses it. A persistent sidebar button stays in the footer — emerald when behind, amber when the last check errored — so users can always trigger a fresh check on demand.":
      "当上游领先时会自动打开一个弹窗；按 ESC 或点击背景即可关闭。一个常驻的侧边栏按钮留在页脚——落后时为翠绿色，上次检查出错时为琥珀色——因此用户随时都能按需触发一次新的检查。",
    "Non-git installs, no remotes configured, offline fetches, and unresolvable upstream refs all return tagged payloads instead of throwing. The sidebar badge turns amber on fetch errors and the modal stays suppressed until a successful check arrives — no spinners, no stuck state.":
      "非 git 安装、未配置远程、离线抓取以及无法解析的上游基准都会返回带标记的负载，而不是抛出异常。侧边栏徽标在抓取出错时变为琥珀色，弹窗会一直被抑制，直到收到一次成功的检查——没有加载转圈，也没有卡住的状态。",
    "Dismissal is keyed by the upstream SHA in <code>localStorage</code>, so closing the modal silences it only for <em>that</em> commit — a newer upstream commit re-opens it automatically. Clicking the sidebar button is an explicit intent signal and clears the stored dismissal before firing a fresh check.":
      "忽略状态以上游 SHA 为键存储在 <code>localStorage</code> 中，因此关闭弹窗只会针对<em>那个</em>提交将其静音——更新的上游提交会自动重新打开它。点击侧边栏按钮是一种明确的意图信号，会在发起新检查之前清除已存储的忽略状态。",
    "Read-only check — runs <code>git fetch</code>, compares, returns the payload.":
      "只读检查——运行 <code>git fetch</code>，进行对比，返回负载。",
    "Same check, and broadcasts <code>update_status</code> over WebSocket so every connected client re-syncs at once.":
      "相同的检查，并通过 WebSocket 广播 <code>update_status</code>，使每个已连接的客户端同时重新同步。",
    "<strong>Detection-only by design</strong>": "<strong>设计上仅做检测</strong>",
    "There is no <code>POST /api/updates/apply</code> and no in-process restart helper. A process cannot reliably replace itself without an external supervisor, and <code>npm run dev</code>, <code>npm start</code>, pm2, systemd, launchd, and Docker each need different restart logic. Detection-only keeps the mechanism portable across every supervisor and OS, and leaves the dashboard's lifecycle owned by whatever started it. The user runs the printed command in their own shell.":
      "不存在 <code>POST /api/updates/apply</code>，也没有进程内重启助手。进程在没有外部监管者的情况下无法可靠地替换自身，而 <code>npm run dev</code>、<code>npm start</code>、pm2、systemd、launchd 和 Docker 各自需要不同的重启逻辑。仅做检测让该机制在每种监管者和操作系统间都保持可移植，并把仪表盘的生命周期交还给启动它的那个程序。用户在自己的 shell 中运行打印出的命令。",
    '<span class="caption-icon">◈</span> Connection Status — sidebar-launched details modal with WebSocket endpoint, connection uptime, 60-second throughput sparkline, top event-type breakdown, and recent activity list':
      '<span class="caption-icon">◈</span> Connection Status — 从侧边栏启动的详情弹窗，包含 WebSocket 端点、连接已运行时长、60 秒吞吐量迷你折线图、热门事件类型分布以及近期活动列表',
    'The <strong>Live</strong> / <strong>Disconnected</strong> pill in the sidebar footer opens a small details panel about the dashboard\'s WebSocket transport. It surfaces the active <code>ws://</code> endpoint, how long the current socket has been up, total events received, the top event types as a horizontal bar chart, a 60-second throughput sparkline, and the most recent 8 events as an activity list. Cumulative stats (totals, type breakdown, recent list) persist across reloads via <code>localStorage</code> under <code>sidebar-connection-stats</code>; the rolling sparkline and "connected since" timer are intentionally ephemeral since they only make sense relative to "now". A <strong>Reset</strong> button clears everything on demand.':
      "侧边栏页脚中的 <strong>Live</strong> / <strong>Disconnected</strong> 胶囊按钮会打开一个关于仪表盘 WebSocket 传输的小型详情面板。它展示当前活跃的 <code>ws://</code> 端点、当前套接字已运行多久、接收到的事件总数、以水平条形图呈现的热门事件类型、一条 60 秒吞吐量迷你折线图，以及作为活动列表的最近 8 个事件。累计统计（总数、类型分布、近期列表）通过 <code>localStorage</code> 以 <code>sidebar-connection-stats</code> 为键在重新加载后持久保留；滚动的迷你折线图和“连接以来”计时器有意设计为短暂的，因为它们只有相对于“当前”才有意义。一个 <strong>Reset</strong> 按钮可按需清除一切。",
    "Implementation note: per-event state lives in <code>useRef</code> buffers on the sidebar so the WS firehose never re-renders the navigation tree — the modal does its own one-second tick to sample the refs while open. Writes are throttled (single-flight timer, 2 s window) and flushed on <code>pagehide</code> / <code>visibilitychange</code> so the latest events aren't lost to the throttle window. The modal itself is portalled to <code>document.body</code> so the sidebar's stacking context can't trap it.":
      "实现说明：逐事件状态保存在侧边栏的 <code>useRef</code> 缓冲区中，因此 WS 的高速事件流绝不会重新渲染导航树——弹窗打开时会以每秒一次的节拍自行采样这些引用。写入被节流（单飞定时器，2 秒窗口）并在 <code>pagehide</code> / <code>visibilitychange</code> 时刷新，因此最新事件不会因节流窗口而丢失。弹窗本身被传送到 <code>document.body</code>，因此侧边栏的层叠上下文无法困住它。",
    "The entire UI ships in <strong>four languages — English, 简体中文, Tiếng Việt, and 한국어</strong> — built on <code>i18next</code> + <code>react-i18next</code> with <code>i18next-browser-languagedetector</code>. Coverage is end-to-end: every page, chart tooltip, Settings flow, Workflow narrative, Config Explorer tab, Run page, and the Alerts rule-help tooltips + webhook setup guides are translated. Switch languages from the sidebar (EN / 中文 / VI / 한국어) — the choice persists in <code>localStorage</code>.":
      "整个 UI 提供<strong>四种语言——English、简体中文、Tiếng Việt 和 한국어</strong>——基于 <code>i18next</code> + <code>react-i18next</code> 并配合 <code>i18next-browser-languagedetector</code> 构建。覆盖是端到端的：每个页面、图表工具提示、Settings 流程、Workflow 叙述、Config Explorer 标签页、Run 页面，以及 Alerts 规则帮助工具提示 + webhook 设置指南都已翻译。从侧边栏切换语言（EN / 中文 / VI / 한국어）——选择会持久保存在 <code>localStorage</code> 中。",
    'Translations are split into per-area JSON namespaces (<code>common</code>, <code>nav</code>, <code>dashboard</code>, <code>sessions</code>, <code>analytics</code>, <code>workflows</code>, <code>settings</code>, <code>kanban</code>, <code>run</code>, <code>ccConfig</code>, <code>alerts</code>, <code>errors</code>, <code>updates</code>) under <code>client/src/i18n/locales/&lt;lng&gt;/</code>. Components load only the namespaces they need via <code>useTranslation("…")</code>.':
      '翻译按区域拆分为各个 JSON 命名空间（<code>common</code>、<code>nav</code>、<code>dashboard</code>、<code>sessions</code>、<code>analytics</code>、<code>workflows</code>、<code>settings</code>、<code>kanban</code>、<code>run</code>、<code>ccConfig</code>、<code>alerts</code>、<code>errors</code>、<code>updates</code>），位于 <code>client/src/i18n/locales/&lt;lng&gt;/</code> 之下。组件仅通过 <code>useTranslation("…")</code> 加载它们所需的命名空间。',
    "Language is detected from <code>localStorage</code> (<code>i18nextLng</code>) then the browser's <code>navigator</code> setting, and the choice is cached back to <code>localStorage</code>. <code>fallbackLng</code> is English and <code>nonExplicitSupportedLngs</code> resolves regional tags (e.g. <code>vi-VN</code> → <code>vi</code>), so any unmapped key falls back gracefully rather than rendering a raw key.":
      "语言首先从 <code>localStorage</code>（<code>i18nextLng</code>）检测，然后从浏览器的 <code>navigator</code> 设置检测，并将选择缓存回 <code>localStorage</code>。<code>fallbackLng</code> 为英语，<code>nonExplicitSupportedLngs</code> 会解析区域标签（例如 <code>vi-VN</code> → <code>vi</code>），因此任何未映射的键都会优雅地回退，而不是渲染出原始键。",
    "Numbers, costs, dates, and relative times format against the active locale via a shared <code>getCurrentLocale()</code> helper, and plurals use i18next's <code>_one</code> / <code>_other</code> suffixes. Interpolated values (<code>{{count}}</code>, <code>{{provider}}</code>, …) keep sentences natural across languages.":
      "数字、费用、日期和相对时间通过共享的 <code>getCurrentLocale()</code> 助手按当前区域设置进行格式化，而复数则使用 i18next 的 <code>_one</code> / <code>_other</code> 后缀。插值的值（<code>{{count}}</code>、<code>{{provider}}</code>、…）让句子在各种语言中都保持自然。",
    "Domain terms that are proper nouns or code stay untranslated in every locale — <em>Agent</em>, <em>Subagent</em>, hook event names (<code>PostToolUse</code>), tool names (<code>Bash</code>), and webhook provider names (Slack, PagerDuty). Only the surrounding prose is localized, so instructions stay accurate.":
      "属于专有名词或代码的领域术语在每种区域设置下都保持不翻译——<em>Agent</em>、<em>Subagent</em>、hook 事件名（<code>PostToolUse</code>）、工具名（<code>Bash</code>）以及 webhook 提供商名称（Slack、PagerDuty）。只有周围的散文文本会被本地化，因此说明保持准确。",
    "<strong>Adding a language</strong>": "<strong>添加一种语言</strong>",
    "Copy <code>client/src/i18n/locales/en/</code> to a new locale folder, translate the JSON values (leaving keys and technical terms intact), then register the bundle and add the tag to <code>supportedLngs</code> in <code>client/src/i18n/index.ts</code>. Missing keys fall back to English automatically, so even a partial translation ships cleanly.":
      "将 <code>client/src/i18n/locales/en/</code> 复制到一个新的区域设置文件夹，翻译其中的 JSON 值（保持键和技术术语不变），然后注册该捆绑包并在 <code>client/src/i18n/index.ts</code> 中将该标签添加到 <code>supportedLngs</code>。缺失的键会自动回退到英语，因此即使是部分翻译也能干净地发布。",
    "<strong>Tabby</strong> is a cute SVG cat companion pinned to the <strong>edges of every page</strong> of the dashboard. It is always present and turns the live session stream into glanceable, ambient feedback — calm when idle, alert when something needs attention, and celebratory when a run finishes. Tabby is built entirely on the existing <code>eventBus</code> WebSocket stream: <strong>no new backend, no API key, and no new dependencies</strong>. The component lives in <code>client/src/components/Tabby/</code> and can be toggled on or off in Settings page.":
      "<strong>Tabby</strong> 是一只可爱的 SVG 猫咪伙伴，固定在仪表盘<strong>每个页面的边缘</strong>。它始终在场，把实时会话流转化为可一眼看懂的环境式反馈——空闲时安静，有事需要关注时警觉，运行完成时欢庆。Tabby 完全构建在现有的 <code>eventBus</code> WebSocket 流之上：<strong>没有新的后端、没有 API key，也没有新的依赖</strong>。该组件位于 <code>client/src/components/Tabby/</code>，可在 Settings 页面中开启或关闭。",
    '<span class="caption-icon">📥</span> Tabby Companion — a cute SVG cat in the edges of every page, reacting in real time to the live session stream with eight distinct moods and animations, auto-surfacing speech bubbles for notable events, and serving as the gateway to a status panel and Ask box':
      '<span class="caption-icon">📥</span> Tabby Companion — 位于每个页面边缘的一只可爱 SVG 猫咪，以八种不同的心情和动画实时响应实时会话流，为值得注意的事件自动弹出对话气泡，并充当通往状态面板和 Ask 框的入口',
    "Tabby derives one of eight moods from the live session WebSocket stream, each with its own animation. The eyes track your cursor, and the active mood drives a distinct motion cue.":
      "Tabby 从实时会话 WebSocket 流中推导出八种心情之一，每种都有自己的动画。眼睛会追踪你的光标，而当前心情会驱动一个独特的动作提示。",
    "Notable events — session started or finished, errors, and run completed — automatically surface a speech bubble. Bubbles are <strong>throttled and coalesced</strong> so bursts of events never spam you, and they can be muted on demand. Everything reflects in real time over the existing <code>eventBus</code> WebSocket channel, with no polling and no extra services.":
      "值得注意的事件——会话开始或结束、错误以及运行完成——会自动弹出一个对话气泡。气泡经过<strong>节流与合并</strong>，因此密集的事件绝不会刷屏，并且可按需静音。一切都通过现有的 <code>eventBus</code> WebSocket 通道实时反映，无需轮询，也无需额外的服务。",
    "Click the cat — or press <code>⌘B</code> / <code>Ctrl+B</code> — to open Tabby's panel (<code>Esc</code> closes it). The panel groups a live status line, quick actions, and an Ask box.":
      "点击猫咪——或按 <code>⌘B</code> / <code>Ctrl+B</code>——即可打开 Tabby 的面板（<code>Esc</code> 将其关闭）。该面板汇集了一行实时状态、快捷操作和一个 Ask 框。",
    "<strong>Live status line:</strong> <em>N live · M errored · connection state</em>, updated from cached data.":
      "<strong>实时状态行：</strong><em>N live · M errored · connection state</em>，由缓存数据更新。",
    "<strong>Quick actions:</strong> jump to Run Claude, Activity, Sessions, or errored sessions; mute bubbles; clear alerts.":
      "<strong>快捷操作：</strong>跳转到 Run Claude、Activity、Sessions 或出错的会话；静音气泡；清除告警。",
    "<strong>Ask box:</strong> answers simple status questions locally from cached data (&ldquo;what's running&rdquo;, &ldquo;any errors&rdquo;, &ldquo;status&rdquo;).":
      "<strong>Ask 框：</strong>从缓存数据本地回答简单的状态问题（&ldquo;what's running&rdquo;、&ldquo;any errors&rdquo;、&ldquo;status&rdquo;）。",
    "The Ask box answers status questions instantly and offline from cached data. For anything beyond a simple status question, Tabby hands off to the existing <strong>Run Claude</strong> page (<code>/run?prompt=...</code>) to spawn a real Claude Code session — so there is never a separate model call, key, or service to manage.":
      "Ask 框从缓存数据即时且离线地回答状态问题。对于超出简单状态问题的任何内容，Tabby 会移交给现有的 <strong>Run Claude</strong> 页面（<code>/run?prompt=...</code>），以启动一个真实的 Claude Code 会话——因此从来不需要管理单独的模型调用、密钥或服务。",
    "Fully keyboard operable: <code>⌘B</code> / <code>Ctrl+B</code> to open, <code>Esc</code> to close.":
      "完全可用键盘操作：<code>⌘B</code> / <code>Ctrl+B</code> 打开，<code>Esc</code> 关闭。",
    "Status and bubbles announce via <code>aria-live</code> for screen readers.":
      "状态和气泡通过 <code>aria-live</code> 向屏幕阅读器播报。",
    "Respects <code>prefers-reduced-motion</code> to calm animations.":
      "遵从 <code>prefers-reduced-motion</code> 以减弱动画。",
    "Degrades gracefully to a calm, dimmed disconnected state when offline.":
      "离线时会优雅降级为一个安静、变暗的断连状态。",
    Endpoint: "端点",
    Mood: "心情",
    "When it appears": "何时出现",
    Animation: "动画",
    Idle: "Idle",
    "Nothing notable happening": "没有任何值得注意的事情发生",
    "Gentle tail flick": "轻轻甩尾",
    Watching: "Watching",
    "Sessions active, observing the stream": "会话活跃，正在观察事件流",
    "Ear perk, cursor-tracking eyes": "竖起耳朵，眼睛追踪光标",
    Happy: "Happy",
    "A run completed successfully": "一次运行成功完成",
    Sparkle: "闪光",
    Worried: "Worried",
    "Something looks off": "有些地方看起来不对劲",
    "Head bob": "点头",
    Stuck: "Stuck",
    "A session appears blocked": "某个会话似乎被阻塞",
    "Shake + alert <code>!</code>": "晃动 + 警示 <code>!</code>",
    Thinking: "Thinking",
    "Work in progress": "工作进行中",
    Sleeping: "Sleeping",
    "Quiet for a while": "已安静一段时间",
    Zzz: "Zzz",
    Disconnected: "Disconnected",
    "WebSocket offline": "WebSocket 离线",
    "Calm, dimmed state": "安静、变暗的状态",
    "Development vs production deployment topology": "开发与生产部署拓扑",
    Aspect: "方面",
    Development: "开发",
    Production: "生产",
    Processes: "进程",
    "2 (Express + Vite)": "2 个（Express + Vite）",
    "1 (Express only)": "1 个（仅 Express）",
    "Client URL": "客户端 URL",
    "API proxy": "API 代理",
    "Vite proxies <code>/api</code> + <code>/ws</code> to :4820":
      "Vite 将 <code>/api</code> + <code>/ws</code> 代理到 :4820",
    "Same origin, no proxy": "同源，无代理",
    "File watching": "文件监听",
    "<code>node --watch</code> + Vite HMR": "<code>node --watch</code> + Vite HMR",
    None: "无",
    "Source maps": "源映射",
    Inline: "内联",
    "External files": "外部文件",
    "<strong>A third way to run: the Desktop App (macOS &amp; Windows)</strong>":
      "<strong>第三种运行方式：桌面应用（macOS &amp; Windows）</strong>",
    'Beyond development and standalone production, the dashboard also ships as a native desktop app — a macOS <code>.app</code> and a Windows <code>.exe</code> — that embeds the same production server in-process, no terminal required. See the <a href="#desktop-app">Desktop App (macOS &amp; Windows)</a> section for download, build, and install instructions.':
      '除了开发模式和独立的生产模式之外，仪表盘还以原生桌面应用的形式发布——一个 macOS 的 <code>.app</code> 和一个 Windows 的 <code>.exe</code>——它在进程内嵌入了相同的生产服务器，无需终端。有关下载、构建和安装说明，请参阅<a href="#desktop-app">桌面应用（macOS &amp; Windows）</a>章节。',
    "The production image is OCI-compatible and works with both Docker and Podman. The server listens on <code>4820</code>, reads legacy Claude history from a read-only mount, and persists SQLite data under <code>/app/data</code>.":
      "生产镜像兼容 OCI，可同时配合 Docker 和 Podman 使用。服务器监听 <code>4820</code>，从只读挂载点读取旧版 Claude 历史记录，并将 SQLite 数据持久化到 <code>/app/data</code> 下。",
    "Container image build and runtime mounts": "容器镜像构建与运行时挂载",
    Mount: "挂载",
    "Read historical Claude session files for import without modifying them":
      "读取历史 Claude 会话文件以供导入，且不会对其进行修改",
    "Persist the SQLite database across rebuilds and container restarts":
      "在重新构建和容器重启之间持久化 SQLite 数据库",
    "<strong>Hooks still run on the host</strong>": "<strong>Hooks 仍在主机上运行</strong>",
    "Claude Code fires hooks from the host machine, not from inside the container. After the container is healthy on <code>http://localhost:4820</code>, run <code>npm run install-hooks</code> on the host so hook events post back to the containerized server.":
      "Claude Code 从主机上触发 hooks，而不是从容器内部触发。在容器于 <code>http://localhost:4820</code> 上运行正常后，请在主机上运行 <code>npm run install-hooks</code>，以便 hook 事件回传到容器化的服务器。",
    "A multi-stage <code>Dockerfile</code> and <code>docker-compose.yml</code> are included. Both <strong>Docker</strong> and <strong>Podman</strong> are fully supported — the image is OCI-compliant.":
      "项目包含一个多阶段的 <code>Dockerfile</code> 和 <code>docker-compose.yml</code>。<strong>Docker</strong> 和 <strong>Podman</strong> 均获得完全支持——该镜像符合 OCI 规范。",
    "Read-only access to legacy session history for automatic import on startup":
      "以只读方式访问旧版会话历史记录，以便在启动时自动导入",
    "Persists the SQLite database across container restarts": "在容器重启之间持久化 SQLite 数据库",
    "The Dockerfile uses three stages to minimize the final image size:":
      "Dockerfile 使用三个阶段来最小化最终镜像的体积：",
    Stage: "阶段",
    "Installs production <code>node_modules</code> on <code>node:22-alpine</code>. <code>better-sqlite3</code> is optional — if prebuilds are unavailable, the server falls back to built-in <code>node:sqlite</code>":
      "在 <code>node:22-alpine</code> 上安装生产环境的 <code>node_modules</code>。<code>better-sqlite3</code> 是可选的——如果预构建不可用，服务器会回退到内置的 <code>node:sqlite</code>",
    "Runs <code>npm ci</code> + <code>vite build</code> to produce optimized static assets":
      "运行 <code>npm ci</code> + <code>vite build</code> 以生成经过优化的静态资源",
    "Clean <code>node:22-alpine</code> with only <code>node_modules</code>, server code, and <code>client/dist</code>":
      "干净的 <code>node:22-alpine</code>，仅包含 <code>node_modules</code>、服务器代码和 <code>client/dist</code>",
    "<strong>Hook note</strong>": "<strong>Hook 说明</strong>",
    "Claude Code hooks run on the host, not inside the container. The containerized server receives hook events via HTTP on <code>localhost:4820</code>. Run <code>npm run install-hooks</code> on the host after starting the container.":
      "Claude Code 的 hooks 在主机上运行，而不是在容器内部运行。容器化的服务器通过 HTTP 在 <code>localhost:4820</code> 上接收 hook 事件。启动容器后，请在主机上运行 <code>npm run install-hooks</code>。",
    Metric: "指标",
    "Server startup": "服务器启动",
    "SQLite opens instantly; schema migration is idempotent": "SQLite 立即打开；架构迁移是幂等的",
    "Hook latency": "Hook 延迟",
    "Transaction + broadcast, no async I/O beyond SQLite": "事务 + 广播，除 SQLite 外无异步 I/O",
    "Client JS bundle": "客户端 JS 包",
    "WebSocket latency": "WebSocket 延迟",
    "Local loopback, JSON serialization only": "本地回环，仅 JSON 序列化",
    "SQLite write throughput": "SQLite 写入吞吐量",
    "WAL mode on SSD; far exceeds any hook event rate": "SSD 上的 WAL 模式；远超任何 hook 事件速率",
    "Max events before slowdown": "性能下降前的最大事件数",
    "Pagination prevents full-table scans": "分页可避免全表扫描",
    "Server memory": "服务器内存",
    "SQLite in-process, no ORM overhead": "SQLite 进程内运行，无 ORM 开销",
    "Client memory": "客户端内存",
    "React + Tailwind, minimal runtime deps": "React + Tailwind，运行时依赖极少",
    "Input validation": "输入校验",
    "Required fields checked before DB operations; CHECK constraints on status enums":
      "在数据库操作前检查必填字段；对状态枚举使用 CHECK 约束",
    "Hook safety": "Hook 安全",
    "Hook handler always exits 0; 5s max lifetime; uses <code>127.0.0.1</code> not external hosts":
      "Hook 处理器始终以 0 退出；最长存活 5s；使用 <code>127.0.0.1</code> 而非外部主机",
    CORS: "CORS",
    "Restricted to loopback origins, so cross-origin pages can't read responses; no-Origin clients like curl still work":
      "仅限于回环来源，因此跨源页面无法读取响应；像 curl 这样的无 Origin 客户端仍然可用",
    Authentication: "身份验证",
    "Off by default since the loopback bind is the trust boundary; set <code>DASHBOARD_TOKEN</code> to require a bearer token on every <code>/api/*</code> request and the WebSocket when exposing on a LAN.":
      "默认关闭，因为回环绑定即是信任边界；在局域网中暴露时，可设置 <code>DASHBOARD_TOKEN</code>，以要求每个 <code>/api/*</code> 请求和 WebSocket 都提供 bearer 令牌。",
    Secrets: "密钥",
    "No API keys, tokens, or credentials stored or transmitted anywhere":
      "不在任何地方存储或传输 API 密钥、令牌或凭据",
    "Dependency surface": "依赖面",
    "5 runtime server deps, 6 runtime client deps (includes D3.js for Workflows) — minimal attack surface":
      "5 个运行时服务端依赖，6 个运行时客户端依赖（包含用于 Workflows 的 D3.js）——攻击面极小",
    "Hooks only apply to sessions started <em>after</em> installation. Restart Claude Code after starting the dashboard.":
      "Hook 仅对安装<em>之后</em>启动的会话生效。启动仪表板后请重启 Claude Code。",
    "On some systems the shell environment when Claude Code fires hooks may not include the full PATH. Test with <code>node --version</code>. If not found, use the absolute path to <code>node</code> in the hook command.":
      "在某些系统上，Claude Code 触发 Hook 时的 shell 环境可能不包含完整的 PATH。可用 <code>node --version</code> 测试。如果找不到，请在 Hook 命令中使用 <code>node</code> 的绝对路径。",
    Problem: "问题",
    Solution: "解决方案",
    "<code>better-sqlite3</code> errors during install":
      "安装期间出现 <code>better-sqlite3</code> 错误",
    "This is non-fatal — <code>better-sqlite3</code> is an optional dependency. On Node 22+ the server automatically falls back to built-in <code>node:sqlite</code>. On older Node versions, install Python 3 + C++ build tools, then run <code>npm rebuild better-sqlite3</code>. For the desktop app, the <code>desktop:install</code> preflight prints copy-pasteable per-OS setup guidance (incl. a no-toolchain alternative) when the native build fails.":
      "这不是致命错误——<code>better-sqlite3</code> 是可选依赖。在 Node 22+ 上，服务器会自动回退到内置的 <code>node:sqlite</code>。在较旧的 Node 版本上，请安装 Python 3 + C++ 构建工具，然后运行 <code>npm rebuild better-sqlite3</code>。对于桌面应用，当原生构建失败时，<code>desktop:install</code> 预检会打印可复制粘贴的各操作系统设置指引（包括无需工具链的替代方案）。",
    'Dashboard shows "Disconnected"': "仪表板显示“已断开连接”",
    "Server is not running. Start it with <code>npm run dev</code>. Client auto-reconnects every 2s.":
      "服务器未运行。使用 <code>npm run dev</code> 启动。客户端每 2s 自动重连一次。",
    "Events Today shows 0": "Events Today 显示 0",
    "Ensure you are on the latest version (timezone bug was fixed). Restart the server.":
      "请确保你使用的是最新版本（时区错误已修复）。然后重启服务器。",
    "Port 4820 already in use": "端口 4820 已被占用",
    "Run <code>DASHBOARD_PORT=4821 npm run dev</code>, update Vite proxy in <code>client/vite.config.ts</code>, and re-run <code>npm run install-hooks</code>.":
      "运行 <code>DASHBOARD_PORT=4821 npm run dev</code>，更新 <code>client/vite.config.ts</code> 中的 Vite 代理，然后重新运行 <code>npm run install-hooks</code>。",
    "Stale seed data shown": "显示了过期的种子数据",
    "Run <code>npm run clear-data</code> to wipe all rows, then restart.":
      "运行 <code>npm run clear-data</code> 清除所有行，然后重启。",
    "Hooks show validation error about matcher": "Hook 显示关于 matcher 的校验错误",
    'Ensure you\'re on the latest version — the hook format was updated to use <code>matcher: "*"</code> string (not object).':
      '请确保你使用的是最新版本——Hook 格式已更新为使用 <code>matcher: "*"</code> 字符串（而非对象）。',
    '"SQLite backend not available" on startup': "启动时出现“SQLite backend not available”",
    "Neither <code>better-sqlite3</code> nor <code>node:sqlite</code> could load. Upgrade to Node.js 22+ (recommended), or install Python 3 + C++ build tools and run <code>npm rebuild better-sqlite3</code>.":
      "<code>better-sqlite3</code> 和 <code>node:sqlite</code> 都无法加载。请升级到 Node.js 22+（推荐），或安装 Python 3 + C++ 构建工具并运行 <code>npm rebuild better-sqlite3</code>。",
    "Docker container runs but no sessions appear": "Docker 容器在运行但没有出现会话",
    "Hooks run on the host, not inside the container. Run <code>npm run install-hooks</code> on the host after the container starts. Verify hooks in <code>~/.claude/settings.json</code> point to <code>localhost:4820</code>.":
      "Hook 在宿主机上运行，而不是在容器内。容器启动后，请在宿主机上运行 <code>npm run install-hooks</code>。确认 <code>~/.claude/settings.json</code> 中的 Hook 指向 <code>localhost:4820</code>。",
    Technology: "技术",
    "Why This Over Alternatives": "为何选择它而非替代方案",
    "Zero-config, embedded, no server process. WAL mode gives concurrent reads. Synchronous API is simpler than async for this use case. <code>better-sqlite3</code> is preferred when prebuilds are available; falls back to Node.js built-in <code>node:sqlite</code> on Node 22+ when the native module cannot be compiled.":
      "零配置、嵌入式、无服务器进程。WAL 模式提供并发读取。对于此用例，同步 API 比异步更简单。当有预构建可用时优先使用 <code>better-sqlite3</code>；当原生模块无法编译时，在 Node 22+ 上回退到 Node.js 内置的 <code>node:sqlite</code>。",
    "Battle-tested, minimal, well-understood. Fastify would be overkill; raw <code>http</code> module would require too much boilerplate for routing.":
      "久经考验、精简、易于理解。Fastify 会显得过度；原始的 <code>http</code> 模块在路由方面需要过多的样板代码。",
    "Fastest, most lightweight WebSocket library for Node. No Socket.IO overhead needed — we only push typed JSON messages one-way.":
      "Node 上最快、最轻量的 WebSocket 库。无需 Socket.IO 的额外开销——我们只单向推送带类型的 JSON 消息。",
    "Stable, widely known, strong TypeScript support. No Server Components or RSC needed for a client-rendered local SPA.":
      "稳定、广为人知、对 TypeScript 支持强。对于客户端渲染的本地 SPA，无需 Server Components 或 RSC。",
    "Fast builds, native ESM, excellent dev experience. Proxy config handles the dev server split cleanly with no ejection.":
      "构建快速、原生 ESM、出色的开发体验。代理配置可干净地处理开发服务器的拆分，无需弹出（eject）。",
    "Utility-first approach keeps styles colocated with markup. No CSS module boilerplate. Custom dark theme config for the dark UI.":
      "实用优先的方式让样式与标记就近放置。没有 CSS module 样板代码。为深色 UI 提供自定义深色主题配置。",
    "Standard routing for React SPAs. Layout routes with <code>&lt;Outlet&gt;</code> give clean shell composition without prop drilling.":
      "React SPA 的标准路由。使用 <code>&lt;Outlet&gt;</code> 的布局路由可在不进行属性透传（prop drilling）的情况下实现干净的外壳组合。",
    "Tree-shakeable icon library — only imports what's used (~20 icons). No heavy icon font.":
      "可摇树优化的图标库——只导入用到的部分（约 20 个图标）。没有沉重的图标字体。",
    "Catches null/undefined bugs at compile time. <code>noUncheckedIndexedAccess</code> prevents array bounds issues in analytics aggregations.":
      "在编译时捕获 null/undefined 错误。<code>noUncheckedIndexedAccess</code> 可防止分析聚合中的数组越界问题。",
    "Industry-standard data visualization library. Powers the Workflows page's 11 interactive sections — DAG layouts, Sankey diagrams, force-directed graphs, bubble charts, and swim-lane timelines. No wrapper libraries needed; direct SVG rendering keeps bundle impact minimal.":
      "行业标准的数据可视化库。为 Workflows 页面的 11 个交互式部分提供支撑——DAG 布局、桑基图、力导向图、气泡图和泳道时间线。无需任何封装库；直接进行 SVG 渲染，使打包体积的影响降到最低。",
    "Available on virtually all systems. Handles ANSI and JSON natively with stdlib only. No install step required.":
      "几乎在所有系统上都可用。仅用标准库即可原生处理 ANSI 和 JSON。无需任何安装步骤。",
    "Local-first monitoring for Claude Code sessions, agents, and tool events. Built for real-time visibility with zero external dependencies.":
      "面向 Claude Code 会话、代理和工具事件的本地优先监控。为实现实时可见性而构建，零外部依赖。",
    Install: "安装",
    Setup: "设置",
    "About the Creator": "关于创作者",
    '<span class="caption-icon">⭐</span> <span> Enjoying the project? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer">Give it a star on GitHub</a> and help more builders discover it. </span>':
      '<span class="caption-icon">⭐</span> <span> 喜欢这个项目吗？<a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer">在 GitHub 上给它一个 star</a>，帮助更多开发者发现它。 </span>',
    'Clears the waiting flag and promotes the main agent to <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>. The only reliable signal that text-only assistant turns have started — they emit no <code>PreToolUse</code> before <code>Stop</code>.':
      '清除等待标志，并将主智能体提升为 <span class="status-chip chip-working"><span class="chip-dot"></span>工作中</span>。这是纯文本助手回合已经开始的唯一可靠信号——它们在 <code>Stop</code> 之前不会发出 <code>PreToolUse</code>。',
    'Clears the waiting flag, sets agent → <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>, <code>current_tool</code> set. If tool is <code>Agent</code>, subagent record created.':
      '清除等待标志，将智能体设为 <span class="status-chip chip-working"><span class="chip-dot"></span>工作中</span>，并设置 <code>current_tool</code>。如果工具是 <code>Agent</code>，则创建子智能体记录。',
    'Clears the waiting flag (covers permission-prompt approvals mid-tool). <code>current_tool</code> cleared. Agent stays <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>.':
      '清除等待标志（涵盖工具执行中途的权限提示批准）。<code>current_tool</code> 被清除。智能体保持 <span class="status-chip chip-working"><span class="chip-dot"></span>工作中</span>。',
    'Non-error: main agent → <code>waiting</code> — UI shows <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> until the next user input. <code>stop_reason=error</code>: marks the agent and session <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>. Background subagents keep running.':
      '非错误情况：主智能体 → <code>waiting</code>——UI 显示 <span class="status-chip chip-waiting"><span class="chip-dot"></span>等待中</span>，直到下一次用户输入。<code>stop_reason=error</code>：将该智能体和会话标记为 <span class="status-chip chip-error"><span class="chip-dot"></span>错误</span>。后台子智能体继续运行。',
    'Matched subagent → <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Deliberately does <strong>not</strong> clear the waiting flag — a backgrounded subagent finishing tells us nothing about the human. Also kicks off a fire-and-forget JSONL scan (<code>scanAndImportSubagents</code>) that walks the session\'s <code>subagents/agent-*.jsonl</code> files, pairs <code>tool_use</code> ↔ <code>tool_result</code> blocks by <code>tool_use_id</code>, and emits per-tool <code>PreToolUse</code> + <code>PostToolUse</code> events under each subagent\'s own <code>agent_id</code> — surfaces tool calls that subagents make internally and which never fire any hooks.':
      '匹配到的子智能体 → <span class="status-chip chip-completed"><span class="chip-dot"></span>已完成</span>。它<strong>故意</strong>不清除等待标志——一个后台子智能体完成并不能告诉我们任何关于人类的信息。它还会启动一次即发即弃的 JSONL 扫描（<code>scanAndImportSubagents</code>），遍历会话的 <code>subagents/agent-*.jsonl</code> 文件，按 <code>tool_use_id</code> 将 <code>tool_use</code> ↔ <code>tool_result</code> 块配对，并在每个子智能体自己的 <code>agent_id</code> 下为每个工具发出 <code>PreToolUse</code> + <code>PostToolUse</code> 事件——从而呈现出子智能体在内部进行、却从不触发任何钩子的工具调用。',
    'Creates a compaction subagent → <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Detected via <code>isCompactSummary</code> entries in the transcript. Token baselines preserve pre-compaction totals. Periodic scanner (cadence ~¼ of <code>DASHBOARD_STALE_MINUTES</code>) catches compactions when no hooks fire.':
      '创建一个压缩子智能体 → <span class="status-chip chip-completed"><span class="chip-dot"></span>已完成</span>。通过转录中的 <code>isCompactSummary</code> 条目进行检测。Token 基线会保留压缩前的总量。当没有钩子触发时，周期性扫描器（频率约为 <code>DASHBOARD_STALE_MINUTES</code> 的 ¼）会捕捉到这些压缩。',
    'Drops the waiting flag. If the session is already in <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>, the error state is preserved; otherwise marks all agents and the session as <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Evicts the session\'s transcript from the shared cache.':
      '丢弃等待标志。如果会话已处于 <span class="status-chip chip-error"><span class="chip-dot"></span>错误</span> 状态，则保留该错误状态；否则将所有智能体和会话标记为 <span class="status-chip chip-completed"><span class="chip-dot"></span>已完成</span>。并将该会话的转录从共享缓存中逐出。',
    "SQLite connection, WAL/FK pragmas, schema migrations (<code>CREATE TABLE IF NOT EXISTS</code>), all prepared statements as a reusable <code>stmts</code> object. Tries <code>better-sqlite3</code> first, falls back to built-in <code>node:sqlite</code> via <code>compat-sqlite.js</code>":
      "SQLite 连接、WAL/FK pragma、schema 迁移（<code>CREATE TABLE IF NOT EXISTS</code>），以及作为可复用 <code>stmts</code> 对象的所有预处理语句。先尝试 <code>better-sqlite3</code>，再通过 <code>compat-sqlite.js</code> 回退到内置的 <code>node:sqlite</code>",
    "Each page pulls initial data from REST then subscribes to eventBus for live updates":
      "每个页面先从 REST 拉取初始数据，然后订阅 eventBus 以获取实时更新",
    "Entity Relationship Diagram — SQLite schema": "实体关系图——SQLite schema",
    "Working Dir": "工作目录",
    "Git Branch": "Git 分支",
    "Context Bar": "上下文栏",
    "Token Counts": "Token 计数",
    "Session Cost": "会话成本",
    "Statusline rendering pipeline — invoked on each Claude Code update":
      "状态栏渲染管线——在每次 Claude Code 更新时被调用",
    "Aggregates data from multiple API endpoints to display high-signal metrics directly in the sidebar:":
      "聚合来自多个 API 端点的数据，直接在侧边栏中显示高价值指标：",
    "Zero-Config Setup": "零配置安装",
    "One-line mental model": "一句话心智模型",
    "Your data survives reinstalls and updates": "你的数据在重装和更新后依然保留",
    "The <code>claude</code> CLI is found automatically": "<code>claude</code> CLI 会被自动找到",
    'Open <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Releases → latest </a> and download the asset for your platform. The macOS and Windows Desktop CI jobs auto-publish a new <code>vX.Y.Z</code> release every time the version in <code>package.json</code> is bumped on <code>master</code>, so this link always points at the current build. Releases are public — no GitHub sign-in required.':
      '打开 <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Releases → latest </a> 并下载适用于你平台的资源包。每当 <code>master</code> 上 <code>package.json</code> 中的版本号被提升时，macOS 与 Windows Desktop 的 CI 任务都会自动发布一个新的 <code>vX.Y.Z</code> 版本，因此该链接始终指向当前构建。这些发布是公开的——无需登录 GitHub。',
    'Want a build straight off the tip of <code>master</code>, ahead of the next tagged release? Every green run of the <code>🍎 macOS Desktop (DMG)</code> job on <code>macos-latest</code> uploads the universal DMG as the <code>ClaudeCodeMonitor-dmg</code> workflow artifact, and the <code>🪟 Windows Desktop (EXE)</code> job on <code>windows-latest</code> uploads the installer + portable EXEs as the <code>ClaudeCodeMonitor-win</code> artifact. Open the <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> latest passing run </a>, scroll to its Artifacts section, and download <code>ClaudeCodeMonitor-dmg</code> or <code>ClaudeCodeMonitor-win</code>. (GitHub sign-in required; 14-day retention.)':
      '想要直接从 <code>master</code> 最新提交构建、领先于下一个打标签的发布版本？<code>macos-latest</code> 上 <code>🍎 macOS Desktop (DMG)</code> 任务的每一次绿色运行都会将通用 DMG 作为 <code>ClaudeCodeMonitor-dmg</code> 工作流工件上传，而 <code>windows-latest</code> 上的 <code>🪟 Windows Desktop (EXE)</code> 任务会将安装程序 + 便携式 EXE 作为 <code>ClaudeCodeMonitor-win</code> 工件上传。打开 <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> latest passing run </a>，滚动到其 Artifacts 部分，下载 <code>ClaudeCodeMonitor-dmg</code> 或 <code>ClaudeCodeMonitor-win</code>。（需要登录 GitHub；保留 14 天。）',
    "Incoming Webhook URL": "传入 Webhook URL",
    "Webhook URL": "Webhook URL",
    "Detection pipeline from scheduler to UI": "从调度器到 UI 的检测管线",
    "A shell-less <code>git fetch</code> with a 120-second timeout, followed by a <code>rev-list</code> against the tracked upstream. Each call runs from <code>server/lib/update-check.js</code> and returns a structured payload — never throws — so a flaky remote can't stall the dashboard.":
      "一次无 shell 的 <code>git fetch</code>（120 秒超时），随后对所跟踪的上游执行一次 <code>rev-list</code>。每次调用都从 <code>server/lib/update-check.js</code> 运行，并返回结构化的载荷——绝不抛出异常——因此不稳定的远端无法拖垮仪表盘。",
    "Detection-only by design": "按设计仅做检测",
    "Adding a language": "添加一种语言",
    "<strong>Ask box:</strong> answers simple status questions locally from cached data (“what's running”, “any errors”, “status”).":
      "<strong>询问框：</strong>基于缓存数据在本地回答简单的状态问题（“正在运行什么”、“有没有错误”、“状态”）。",
    "A third way to run: the Desktop App (macOS &amp; Windows)":
      "第三种运行方式：桌面应用（macOS &amp; Windows）",
    "Hooks still run on the host": "钩子仍然在宿主机上运行",
    "Hook note": "钩子说明",
    "SQL injection": "SQL 注入",
    "All queries use prepared statements with parameterized values — no string interpolation":
      "所有查询都使用带参数化值的预处理语句——不进行字符串插值",
    "Request size": "请求大小",
    "Express JSON body parser limited to 1MB": "Express JSON 请求体解析器限制为 1MB",
    "Dashboard — stats, active agents, recent events":
      "Dashboard — 统计数据、活跃的智能体、近期事件",
    "KanbanBoard — agent status columns": "KanbanBoard — 智能体状态列",
    "Sessions — searchable, filterable table": "Sessions — 可搜索、可筛选的表格",
    "SessionDetail — agents + full event timeline": "SessionDetail — 智能体及完整事件时间线",
    "ActivityFeed — real-time streaming event log": "ActivityFeed — 实时流式事件日志",
    "Analytics — token usage, heatmap (day-of-week aligned), tool charts, donut charts":
      "Analytics — 令牌用量、热力图（按星期对齐）、工具图表、环形图",
    "Workflows — D3.js visualizations, cross-filtering, status filter, session drill-in":
      "Workflows — D3.js 可视化、交叉筛选、状态筛选、会话下钻",
    "Settings — model pricing, hook status, data export, session cleanup":
      "Settings — 模型定价、钩子状态、数据导出、会话清理",
    'Returns <code>{ "status": "ok", "timestamp": "..." }</code>':
      '返回 <code>{ "status": "ok", "timestamp": "..." }</code>',
    "List sessions with agent counts and per-session cost. Params: <code>status</code>, <code>q</code> (case-insensitive search across <code>id</code>/<code>name</code>/<code>cwd</code>), <code>limit</code> (default 50, max 10000), <code>offset</code>. Response includes <code>total</code> for paginators.":
      "列出会话，附带智能体数量及每个会话的成本。参数：<code>status</code>、<code>q</code>（在 <code>id</code>/<code>name</code>/<code>cwd</code> 上进行不区分大小写的搜索）、<code>limit</code>（默认 50，最大 10000）、<code>offset</code>。响应中包含 <code>total</code> 以供分页器使用。",
    "Session detail with agents and events": "会话详情，附带智能体和事件",
    "Create session (idempotent on <code>id</code>)": "创建会话（基于 <code>id</code> 幂等）",
    "Update session status / metadata": "更新会话状态 / 元数据",
    "List agents — params: <code>status</code>, <code>session_id</code>, <code>limit</code>, <code>offset</code>":
      "列出智能体 — 参数：<code>status</code>、<code>session_id</code>、<code>limit</code>、<code>offset</code>",
    "Single agent detail": "单个智能体详情",
    "Create agent": "创建智能体",
    "Update agent status / task / current_tool": "更新智能体的状态 / 任务 / current_tool",
    "List events newest-first — params: <code>session_id</code>, <code>limit</code>, <code>offset</code>":
      "按最新优先列出事件 — 参数：<code>session_id</code>、<code>limit</code>、<code>offset</code>",
    "Aggregate counts + status distributions + WS connections": "聚合计数 + 状态分布 + WS 连接数",
    "Token totals, tool usage, daily trends, agent types, event types, averages":
      "令牌总量、工具用量、每日趋势、智能体类型、事件类型、平均值",
    "Receive and process a Claude Code hook event (called by hook-handler.js)":
      "接收并处理 Claude Code 钩子事件（由 hook-handler.js 调用）",
    "List all model pricing rules": "列出所有模型定价规则",
    "Create or update a pricing rule": "创建或更新一条定价规则",
    "Delete a pricing rule": "删除一条定价规则",
    "Total cost across all sessions": "所有会话的总成本",
    "Cost breakdown for a specific session": "特定会话的成本明细",
    "System info, DB stats, hook installation status": "系统信息、DB 统计、钩子安装状态",
    "Delete all sessions, agents, events, token usage": "删除所有会话、智能体、事件、令牌用量",
    "Reinstall Claude Code hooks": "重新安装 Claude Code 钩子",
    "Reset pricing rules to defaults": "将定价规则重置为默认值",
    "Export all data as JSON download": "将所有数据导出为 JSON 下载",
    "Abandon stale sessions (by hours), purge old data (by days)":
      "放弃陈旧会话（按小时），清除旧数据（按天）",
    "OS-aware paths, archive command, supported extensions, step-by-step instructions; includes live stats for the default <code>~/.claude/projects</code> folder":
      "感知 OS 的路径、归档命令、支持的扩展名、分步说明；包含默认 <code>~/.claude/projects</code> 文件夹的实时统计",
    "Re-scan the default <code>~/.claude/projects</code> directory; safe to re-run (idempotent via session-ID dedup)":
      "重新扫描默认的 <code>~/.claude/projects</code> 目录；可安全重复运行（通过会话 ID 去重实现幂等）",
    "Scan any absolute directory (body <code>{ path }</code>); tilde (<code>~</code>) is expanded; walks subdirectories recursively and imports every <code>.jsonl</code> found":
      "扫描任意绝对路径目录（请求体 <code>{ path }</code>）；波浪号（<code>~</code>）会被展开；递归遍历子目录并导入找到的每个 <code>.jsonl</code>",
    "Multipart upload of <code>.jsonl</code>, <code>.meta.json</code>, <code>.zip</code>, <code>.tar</code>, <code>.tar.gz</code>, <code>.tgz</code>, <code>.gz</code>. Per-request staging dir, path-traversal and extraction-size guards. Returns 413 <code>EXTRACTION_LIMIT_EXCEEDED</code> on suspected bomb archives":
      "分块上传 <code>.jsonl</code>、<code>.meta.json</code>、<code>.zip</code>、<code>.tar</code>、<code>.tar.gz</code>、<code>.tgz</code>、<code>.gz</code>。为每个请求设置暂存目录，并提供路径穿越和解压大小防护。对疑似炸弹归档返回 413 <code>EXTRACTION_LIMIT_EXCEEDED</code>",
    "Aggregate workflow data — orchestration graphs, tool flows, effectiveness, patterns, model delegation, error propagation, concurrency, complexity, compaction impact. Accepts <code>?status=active|completed</code> query param to filter by workflow status":
      "聚合工作流数据 — 编排图、工具流、有效性、模式、模型委派、错误传播、并发、复杂度、压缩影响。接受 <code>?status=active|completed</code> 查询参数以按工作流状态筛选",
    "Per-session drill-in — agent tree, tool timeline, event details":
      "按会话下钻 — 智能体树、工具时间线、事件详情",
    "Fired-alert feed, newest first (<code>?unacked=true</code>, <code>limit</code>, <code>offset</code>; carries <code>total</code> and <code>unacked</code> counts)":
      "已触发告警的信息流，最新优先（<code>?unacked=true</code>、<code>limit</code>、<code>offset</code>；携带 <code>total</code> 和 <code>unacked</code> 计数）",
    "Acknowledge one alert": "确认一条告警",
    "Acknowledge every unacked alert": "确认每一条未确认的告警",
    "List alert rules": "列出告警规则",
    "Create a rule (<code>event_pattern</code> | <code>inactivity</code> | <code>status_duration</code> | <code>token_threshold</code>)":
      "创建一条规则（<code>event_pattern</code> | <code>inactivity</code> | <code>status_duration</code> | <code>token_threshold</code>）",
    "Update name / config / enabled / cooldown": "更新名称 / 配置 / 启用状态 / 冷却时间",
    "Delete a rule and its fired-alert history": "删除一条规则及其已触发告警的历史记录",
    "Supported providers + their config fields (drives the UI form)":
      "支持的提供方及其配置字段（驱动 UI 表单）",
    "List webhook targets (URLs masked, secrets redacted)":
      "列出 webhook 目标（URL 已掩码、密钥已脱敏）",
    "Create a target — 14 first-class providers (Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream) + a generic JSON endpoint":
      "创建一个目标 — 14 个一等支持的提供方（Slack、Discord、Teams、Google Chat、Mattermost、Rocket.Chat、Telegram、PagerDuty、Opsgenie、Splunk On-Call、Zapier、Make、n8n、Pipedream）以及一个通用 JSON 端点",
    "Update name / url / enabled / secret / headers / config / rule scope (<code>type</code> is immutable)":
      "更新名称 / url / 启用状态 / 密钥 / 请求头 / 配置 / 规则范围（<code>type</code> 不可变）",
    "Delete a target and its delivery log": "删除一个目标及其投递日志",
    "Send a synthetic test alert and report the result": "发送一条合成的测试告警并报告结果",
    "Recent delivery log for a target": "某个目标的近期投递日志",
    Documentation: "文档",
    Architecture: "架构",
    "Relevant Links": "相关链接",
    "GitHub Repo": "GitHub 仓库",
    '<span class="caption-icon">🔔</span> <span><strong>Settings · Alerts</strong> — rules-based alerting engine and outbound webhooks in one place: alert rules (event pattern / inactivity / stuck agent / token threshold) with per-rule cooldown, a live fired-alert feed, and 14 first-class webhook providers plus a generic JSON endpoint with optional HMAC signing</span>':
      '<span class="caption-icon">🔔</span> <span><strong>设置 · 告警</strong> — 集于一处的基于规则的告警引擎与出站 Webhook：告警规则（事件模式 / 不活动 / agent 卡住 / token 阈值）支持按规则冷却、实时的已触发告警流，以及 14 个一等公民 Webhook 提供方加一个支持可选 HMAC 签名的通用 JSON 端点</span>',
    '<span class="caption-icon">📗</span> <span><strong>API Docs · ReDoc</strong> — a self-hosted, read-optimized rendering of the full OpenAPI 3.0 spec at <code>/api/redoc</code>, served entirely offline with no CDN. Complements the interactive Swagger UI at <code>/api/docs</code>; every backend route is documented with parameters, schemas, and examples</span>':
      '<span class="caption-icon">📗</span> <span><strong>API 文档 · ReDoc</strong> — 在 <code>/api/redoc</code> 上自托管、便于阅读的完整 OpenAPI 3.0 规范渲染，完全离线、无 CDN。与 <code>/api/docs</code> 的交互式 Swagger UI 互补；每个后端路由都附带参数、模式与示例文档</span>',
    '<span class="caption-icon">📘</span> <span><strong>API Docs · Swagger UI</strong> — interactive OpenAPI 3.0 playground at <code>/api/docs</code>: collapsible endpoint groups, request/response schemas, auth headers, and try-it-out request execution against the live local server</span>':
      '<span class="caption-icon">📘</span> <span><strong>API 文档 · Swagger UI</strong> — 在 <code>/api/docs</code> 的交互式 OpenAPI 3.0 演练场：可折叠的端点分组、请求/响应模式、鉴权头，以及针对本地运行服务器的 try-it-out 请求执行</span>',
    '<span class="caption-icon">📗</span> <span>ReDoc at <code>/api/redoc</code> — a self-hosted, read-optimized three-panel rendering of the same OpenAPI spec: deep-linkable sections, search, and full schema/example detail. Works entirely offline (no CDN)</span>':
      '<span class="caption-icon">📗</span> <span>位于 <code>/api/redoc</code> 的 ReDoc — 同一 OpenAPI 规范的自托管、便于阅读的三栏式渲染：可深链的章节、搜索，以及完整的模式/示例细节。完全离线运行（无 CDN）</span>',
    '<span class="caption-icon">🔔</span> Settings · Alerts — the rules-based alerting engine, a live fired-alert feed, and outbound webhook channels (14 first-class providers + a generic JSON endpoint) managed together in one place':
      '<span class="caption-icon">🔔</span> 设置 · 告警 — 基于规则的告警引擎、实时的已触发告警流，以及出站 Webhook 通道（14 个一等公民提供方 + 一个通用 JSON 端点）集中管理于一处',
    'Surfaces "dynamic workflows" — the fleets of sub-agents spawned by the <code>Workflow</code> tool and self-paced <code>/loop</code> runs. These emit no hooks, so they are reconstructed from the on-disk run journal written when a workflow finishes (<code>workflows/wf_&lt;runId&gt;.json</code>) plus the inner <code>subagents/agent-*.jsonl</code> transcripts. Each run shows its phases and a per-agent token / tool-call / duration breakdown; a running workflow is detected from its launch script before the journal exists. Runs appear in a panel on the Workflows page and as a linked subsection on each session.':
      "呈现「动态工作流」——由 <code>Workflow</code> 工具和自定节奏的 <code>/loop</code> 运行派生的 sub-agent 群组。它们不触发任何 hook，因此依据工作流完成时写入的磁盘运行日志（<code>workflows/wf_&lt;runId&gt;.json</code>）以及内部的 <code>subagents/agent-*.jsonl</code> 转录重建。每次运行展示其阶段以及按 Agent 的 token / 工具调用 / 时长分解；运行中的工作流会在日志存在之前依据其启动脚本被检测到。运行会显示在工作流页面的面板中，并作为每个会话的关联子区块。",
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs</strong> — "dynamic workflows" spawned by the Workflow tool, reconstructed from on-disk run journals: status, agent count, tokens, and tool calls, expandable into a per-agent breakdown (phase, state, tokens, tools, duration) with humanized result previews</span>':
      '<span class="caption-icon">🧬</span> <span><strong>工作流运行</strong> — 由 Workflow 工具派生的「动态工作流」，依据磁盘上的运行日志重建：状态、Agent 数量、token 与工具调用，可展开为按 Agent 的明细（阶段、状态、token、工具、时长），并附经过人性化处理的结果预览</span>',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · in a session</strong> — the same fleets linked to their launching session, so a session\'s dynamic-workflow sub-agents and their folded-in token cost are visible inline</span>':
      '<span class="caption-icon">🧬</span> <span><strong>工作流运行 · 会话内</strong> — 同样的群组关联到其启动会话，因此会话的动态工作流子 Agent 及其已计入的 token 成本可在会话内直接查看</span>',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · expanded</strong> — a run opened up: clickable color-coded phase filters, the per-agent metrics table, and a full list of clickable result items that expand to each agent\'s complete prompt and result</span>':
      '<span class="caption-icon">🧬</span> <span><strong>工作流运行 · 展开</strong> — 展开的一次运行：可点击的彩色阶段筛选、按 Agent 的指标表，以及完整的可点击结果项列表，点击即可展开每个 Agent 的完整提示词与结果</span>',
  },
  vi: {
    '<span class="caption-icon">📡</span> Live dashboard — real-time agent cards, stats, and activity feed':
      '<span class="caption-icon">📡</span> Bảng điều khiển trực tiếp — thẻ agent, số liệu thống kê và luồng hoạt động theo thời gian thực',
    "Claude Code Agent Monitor integrates with Claude Code through its native hook system. When Claude Code performs any action — tool use, session start, subagent orchestration, session end — it fires a hook that calls a small Node.js script bundled with this project. That script forwards the event over HTTP to the dashboard server, which stores it in SQLite and broadcasts it to the browser over WebSocket.":
      "Claude Code Agent Monitor tích hợp với Claude Code thông qua hệ thống hook gốc của nó. Khi Claude Code thực hiện bất kỳ hành động nào — sử dụng công cụ, bắt đầu phiên, điều phối subagent, kết thúc phiên — nó sẽ kích hoạt một hook gọi đến một script Node.js nhỏ đi kèm với dự án này. Script đó chuyển tiếp sự kiện qua HTTP đến máy chủ bảng điều khiển, nơi lưu sự kiện vào SQLite và phát quảng bá nó đến trình duyệt qua WebSocket.",
    "End-to-end data pipeline from Claude Code to the browser":
      "Đường ống dữ liệu đầu-cuối từ Claude Code đến trình duyệt",
    "Local-first by design": "Ưu tiên cục bộ theo thiết kế",
    "The server binds <code>127.0.0.1</code> (loopback) by default, so it is not network-reachable and everything runs on your machine. No data leaves your system. No API keys. No external services. Exposing it more widely is opt-in via <code>DASHBOARD_HOST</code> and should be paired with <code>DASHBOARD_TOKEN</code>.":
      "Máy chủ mặc định liên kết với <code>127.0.0.1</code> (loopback), nên nó không thể truy cập qua mạng và mọi thứ đều chạy trên máy của bạn. Không có dữ liệu nào rời khỏi hệ thống của bạn. Không cần API key. Không có dịch vụ bên ngoài. Việc để lộ rộng hơn là tùy chọn bật qua <code>DASHBOARD_HOST</code> và nên đi kèm với <code>DASHBOARD_TOKEN</code>.",
    "Every feature is driven by real hook events — nothing is hardcoded or simulated in production mode.":
      "Mọi tính năng đều được điều khiển bởi các sự kiện hook thực — không có gì bị hardcode hoặc mô phỏng ở chế độ production.",
    "Two tabs: <strong>Monitor</strong> shows overview stats, active agent cards with collapsible subagent hierarchy, and a recent activity feed whose item count fills available viewport height. <strong>Health</strong> renders a composite system health score ring, storage engine donut chart, cache/error/success gauges, tool invocation bars, subagent effectiveness ratios, model token distribution, and compaction stats. Both tabs auto-refresh every 5 seconds via WebSocket push so the view is always current without manual reload.":
      "Hai tab: <strong>Monitor</strong> hiển thị số liệu tổng quan, các thẻ agent đang hoạt động với cây phân cấp subagent có thể thu gọn, và một luồng hoạt động gần đây có số lượng mục lấp đầy chiều cao viewport khả dụng. <strong>Health</strong> hiển thị một vòng điểm sức khỏe hệ thống tổng hợp, biểu đồ vành khuyên về storage engine, các đồng hồ đo cache/lỗi/thành công, các thanh lời gọi công cụ, tỷ lệ hiệu quả của subagent, phân bố token theo mô hình, và số liệu thống kê nén. Cả hai tab tự động làm mới mỗi 5 giây qua WebSocket push nên chế độ xem luôn cập nhật mà không cần tải lại thủ công.",
    "Toggle between <strong>Agents</strong> (Working / Waiting / Completed / Error) and <strong>Sessions</strong> (Active / Waiting / Completed / Error / Abandoned) swim lanes. A yellow <strong>Waiting</strong> column flags items sitting on the user — fresh prompt, between turns, or permission gate. Hover any column header for lifecycle tooltips explaining each state transition. Cards surface model name, cumulative cost, and the current tool being called. Counts update in real time via WebSocket so the board is always in sync with the live event store.":
      "Chuyển đổi giữa các làn <strong>Agents</strong> (Working / Waiting / Completed / Error) và <strong>Sessions</strong> (Active / Waiting / Completed / Error / Abandoned). Một cột <strong>Waiting</strong> màu vàng đánh dấu các mục đang chờ người dùng — lời nhắc mới, giữa các lượt, hoặc cổng cấp quyền. Di chuột qua bất kỳ tiêu đề cột nào để xem các chú giải về vòng đời giải thích từng lần chuyển trạng thái. Các thẻ hiển thị tên mô hình, chi phí tích lũy, và công cụ đang được gọi hiện tại. Số đếm cập nhật theo thời gian thực qua WebSocket nên bảng luôn đồng bộ với kho sự kiện trực tiếp.",
    "<strong>Server-paginated</strong> table of every recorded session — each page fetches only its slice so cost computation stays bounded no matter how many sessions exist. Case-insensitive search across <code>id</code>, <code>name</code>, and <code>cwd</code> runs server-side with a 300 ms debounce; the status filter composes with search for precise narrowing. Each row shows the session's real name (synced live from the transcript — a <code>/rename</code> or <code>claude -n</code> title, else the auto title, else the first user prompt, with a short-ID fallback), status badge, agent count, duration, model, and estimated cost. Click any row to drill into the full session detail view with conversation transcript and agent hierarchy.":
      "Bảng <strong>phân trang phía máy chủ</strong> của mọi phiên đã ghi — mỗi trang chỉ lấy phần dữ liệu của nó nên việc tính chi phí luôn bị giới hạn bất kể có bao nhiêu phiên tồn tại. Tìm kiếm không phân biệt hoa thường trên <code>id</code>, <code>name</code> và <code>cwd</code> chạy ở phía máy chủ với độ trễ chống dội 300 ms; bộ lọc trạng thái kết hợp với tìm kiếm để thu hẹp chính xác. Mỗi hàng hiển thị tên thật của phiên (đồng bộ trực tiếp từ bản ghi — tiêu đề <code>/rename</code> hoặc <code>claude -n</code>, nếu không thì dùng tiêu đề tự động, nếu vẫn không có thì prompt đầu tiên của người dùng, với dự phòng là ID ngắn), huy hiệu trạng thái, số lượng agent, thời lượng, mô hình và chi phí ước tính. Nhấp vào bất kỳ hàng nào để đi sâu vào chế độ xem chi tiết đầy đủ của phiên với bản ghi hội thoại và phân cấp agent.",
    "Per-session deep dive with a collapsible agent hierarchy tree and a full chronological event timeline showing every tool call name and summary. An overview panel at the top surfaces tile counters for events, tool calls, subagents, compactions, errors, and duration. Top-tool usage bars and a subagent type breakdown give quick distribution reads. The conversation viewer renders markdown with syntax highlighting, per-tool styled blocks, slash-command pills with their captured TUI output, and inline session-rename markers. Export the entire session as JSON or share the permalink for async review.":
      "Phân tích sâu theo từng phiên với một cây phân cấp agent có thể thu gọn và một dòng thời gian sự kiện đầy đủ theo trình tự thời gian, hiển thị tên và bản tóm tắt của mỗi lần gọi công cụ. Một bảng tổng quan ở trên cùng hiển thị các bộ đếm dạng ô cho sự kiện, lời gọi công cụ, subagent, lần nén, lỗi và thời lượng. Các thanh sử dụng công cụ hàng đầu và bảng phân tích theo loại subagent cho phép đọc nhanh phân bố. Trình xem hội thoại hiển thị markdown với tô sáng cú pháp, các khối có kiểu dáng riêng theo từng công cụ, pill lệnh gạch chéo kèm output TUI đã ghi lại, và chỉ báo đổi tên phiên nội tuyến. Xuất toàn bộ phiên dưới dạng JSON hoặc chia sẻ liên kết cố định để xem xét bất đồng bộ.",
    "A rules-based alerting engine evaluates the live event stream server-side: <strong>event pattern</strong> (match event type / tool / summary text, optionally N matches within a time window), <strong>inactivity</strong>, <strong>stuck agent</strong>, and <strong>token threshold</strong> — each with per-(rule, session, agent) cooldown dedup. Fired alerts surface in a live feed and fan out to <strong>14 first-class webhook providers</strong> — Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream — plus any generic JSON endpoint (with optional HMAC-SHA256 signing and custom headers). Delivery is detached and fail-safe with a request timeout, bounded retry/backoff, secret redaction, a one-click test probe, and a per-target delivery log. Rules and channels are managed together in <strong>Settings → Alerts</strong>.":
      "Một engine cảnh báo dựa trên quy tắc đánh giá luồng sự kiện trực tiếp ở phía máy chủ: <strong>mẫu sự kiện</strong> (khớp loại sự kiện / công cụ / văn bản tóm tắt, tùy chọn N lần khớp trong một khoảng thời gian), <strong>không hoạt động</strong>, <strong>agent bị kẹt</strong>, và <strong>ngưỡng token</strong> — mỗi loại đều có khử trùng lặp thời gian chờ theo từng (quy tắc, phiên, agent). Các cảnh báo được kích hoạt xuất hiện trong một luồng trực tiếp và lan tỏa đến <strong>14 nhà cung cấp webhook hạng nhất</strong> — Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream — cùng với bất kỳ endpoint JSON chung nào (với tùy chọn ký HMAC-SHA256 và header tùy chỉnh). Việc gửi là tách rời và an toàn khi lỗi với thời gian chờ yêu cầu, thử lại/backoff có giới hạn, che giấu bí mật, một đầu dò kiểm thử bằng một cú nhấp, và nhật ký gửi theo từng đích. Quy tắc và kênh được quản lý cùng nhau trong <strong>Settings → Alerts</strong>.",
    "A native desktop app — a macOS <code>.app</code> (shipped as a <code>.dmg</code>) and a Windows <code>.exe</code> (NSIS installer plus a no-install portable build) — built with Electron 35. It <strong>embeds the Express server in-process</strong> — <code>require()</code>-ing <code>server/index.js</code> directly, with no child process and no IPC — and renders the built React client in a <code>BrowserWindow</code>. Adds a menu-bar / notification-area (tray) icon, a native application menu, auto-start at login (macOS Login Items via <code>SMAppService</code>; Windows per-user <code>HKCU\\…\\Run</code>), and a single-instance lock. Closing the window hides it while the server keeps running, and the app auto-installs Claude Code hooks on first boot so an install-only user gets events flowing without a checkout.":
      "Một ứng dụng desktop gốc — một <code>.app</code> trên macOS (phát hành dưới dạng <code>.dmg</code>) và một <code>.exe</code> trên Windows (trình cài đặt NSIS cộng với một bản portable không cần cài đặt) — được xây dựng bằng Electron 35. Nó <strong>nhúng máy chủ Express trong cùng tiến trình</strong> — <code>require()</code> trực tiếp <code>server/index.js</code>, không có tiến trình con và không có IPC — và hiển thị client React đã build trong một <code>BrowserWindow</code>. Bổ sung một biểu tượng thanh menu / khu vực thông báo (khay), một menu ứng dụng gốc, tự khởi động khi đăng nhập (macOS dùng Login Items qua <code>SMAppService</code>; Windows dùng <code>HKCU\\…\\Run</code> theo từng người dùng), và một khóa đơn-thực-thể. Đóng cửa sổ sẽ ẩn nó trong khi máy chủ vẫn chạy, và ứng dụng tự động cài đặt các hook của Claude Code ngay ở lần khởi động đầu tiên nên người dùng chỉ cài đặt cũng có sự kiện chảy về mà không cần checkout mã nguồn.",
    "Real-time streaming event log showing tool calls, agent state changes, errors, and compaction events as they arrive. Pause/resume with automatic buffering, paginated history for scrollback, and auto-scrolling to the latest entry. Click any row to expand its full hook payload inline. A dedicated <strong>Session →</strong> button navigates directly to session detail without collapsing the expanded state. Every entry is color-coded by event type and grouped by session for quick scanning of concurrent work.":
      "Nhật ký sự kiện phát trực tiếp theo thời gian thực hiển thị các lời gọi công cụ, thay đổi trạng thái agent, lỗi và sự kiện nén ngay khi chúng đến. Tạm dừng/tiếp tục với bộ đệm tự động, lịch sử phân trang để cuộn lại, và tự động cuộn đến mục mới nhất. Nhấp vào bất kỳ hàng nào để mở rộng toàn bộ payload hook của nó ngay tại chỗ. Một nút <strong>Session →</strong> chuyên dụng điều hướng trực tiếp đến chi tiết phiên mà không thu gọn trạng thái đã mở rộng. Mọi mục đều được mã hóa màu theo loại sự kiện và nhóm theo phiên để quét nhanh các công việc đồng thời.",
    "Token usage breakdown by model with stacked bar charts, tool frequency rankings, agent type distribution donuts, and session outcome pie charts. A 52-week activity heatmap aligned by day-of-week shows density with hover tooltips. 30-day sparkline trends track cost and session volume at a glance. The cost summary panel totals input, output, and cache spend across all models. A live/offline indicator and auto-refresh via WebSocket keep everything current. All charts are responsive and adapt to mobile viewports.":
      "Phân tích mức sử dụng token theo mô hình với biểu đồ thanh xếp chồng, bảng xếp hạng tần suất công cụ, biểu đồ vành khuyên phân bố loại agent, và biểu đồ tròn kết quả phiên. Một bản đồ nhiệt hoạt động 52 tuần căn theo ngày trong tuần hiển thị mật độ với chú giải khi di chuột. Các đường xu hướng sparkline 30 ngày theo dõi chi phí và khối lượng phiên trong nháy mắt. Bảng tóm tắt chi phí cộng tổng chi phí đầu vào, đầu ra và cache trên tất cả các mô hình. Một chỉ báo trực tuyến/ngoại tuyến và tự động làm mới qua WebSocket giữ mọi thứ luôn cập nhật. Tất cả biểu đồ đều đáp ứng và thích ứng với viewport di động.",
    "Every UI update is pushed over a persistent WebSocket with sub-5 ms dispatch latency — zero polling anywhere. If the connection drops, automatic 2-second reconnect kicks in while a ping/pong heartbeat detects stale connections early. A sidebar indicator turns green/red so you always know whether you're live. The WebSocket carries typed JSON envelopes for new events, session updates, agent transitions, compaction results, and import progress — all parsed into the same eventBus the REST layer uses.":
      "Mọi cập nhật UI đều được đẩy qua một WebSocket bền vững với độ trễ điều phối dưới 5 ms — không hề có polling ở bất kỳ đâu. Nếu kết nối rớt, cơ chế tự động kết nối lại sau 2 giây sẽ kích hoạt trong khi nhịp tim ping/pong phát hiện sớm các kết nối cũ. Một chỉ báo ở thanh bên chuyển xanh/đỏ để bạn luôn biết mình có đang trực tuyến hay không. WebSocket mang các bao JSON có kiểu cho sự kiện mới, cập nhật phiên, chuyển trạng thái agent, kết quả nén và tiến độ nhập — tất cả đều được phân tích vào cùng một eventBus mà tầng REST sử dụng.",
    "Standalone CLI statusline for Claude Code that prints model name, user, working directory, git branch, and a color-coded context-window bar (green → yellow → red). Token counts show input (green ↑), output (cyan ↓), and cache (dim) separately. Session cost in USD shifts color by configurable thresholds. ANSI-colored output updates on every turn. Python-based with a thin shell wrapper — drop it into your prompt or tmux status line. Works with any terminal emulator that supports 256-color ANSI.":
      "Thanh trạng thái CLI độc lập cho Claude Code, in ra tên model, người dùng, thư mục làm việc, git branch và một thanh cửa sổ ngữ cảnh được mã màu (green → yellow → red). Số lượng token hiển thị riêng phần đầu vào (green ↑), đầu ra (cyan ↓) và cache (dim). Chi phí phiên tính bằng USD đổi màu theo các ngưỡng có thể cấu hình. Đầu ra tô màu ANSI cập nhật theo từng lượt. Dựa trên Python với một lớp bọc shell mỏng — chỉ cần thả nó vào prompt hoặc thanh trạng thái tmux của bạn. Hoạt động với bất kỳ trình giả lập terminal nào hỗ trợ ANSI 256 màu.",
    "Import existing Claude Code sessions from three sources — rescan the default <code>~/.claude/projects</code> folder, scan any absolute path on disk, or drag-drop <code>.jsonl</code>, <code>.zip</code>, <code>.tar.gz</code>, and <code>.gz</code> archives through <b>Settings → Import History</b>. All paths funnel into the same ingestion pipeline the server uses for live hooks, so imported tokens and per-model cost match real-time capture exactly. Re-imports are idempotent via session-ID dedup, and archive extraction is guarded against path traversal and zip-bomb expansion.":
      "Nhập các phiên Claude Code hiện có từ ba nguồn — quét lại thư mục mặc định <code>~/.claude/projects</code>, quét bất kỳ đường dẫn tuyệt đối nào trên đĩa, hoặc kéo-thả các tệp lưu trữ <code>.jsonl</code>, <code>.zip</code>, <code>.tar.gz</code> và <code>.gz</code> qua <b>Settings → Import History</b>. Tất cả các đường dẫn đều đổ vào cùng một đường ống nạp mà máy chủ dùng cho các hook trực tiếp, nên token đã nhập và chi phí theo từng model khớp chính xác với việc thu thập theo thời gian thực. Việc nhập lại là bất biến nhờ khử trùng lặp theo session-ID, và quá trình giải nén được bảo vệ chống path traversal cùng sự bùng nổ kiểu zip-bomb.",
    "The startup auto-import of <code>~/.claude/projects</code> is one-time and marker-gated, so a project folder created after first launch — whose sessions never flow through hooks (for example with host-only hooks disabled) — would stay invisible until a manual rescan. A background sync closes that gap with three triggers sharing one mtime cache and a single coalesced sweep: an immediate sweep at startup, a debounced <code>fs.watch</code> (recursive on macOS and Windows; root plus immediate child folders on Linux to avoid the userland recursive-watcher hazard) that fires the moment a new session file or project folder appears, and a periodic safety-net poll tunable via <code>DASHBOARD_SESSION_SYNC_MS</code> (default <code>30000</code> ms; <code>0</code> disables the poll while leaving the watcher running). Each sweep re-parses only files whose mtime advanced and broadcasts <code>session_created</code> / <code>session_updated</code> (plus the main agent) so the UI refreshes live, while an already-imported unchanged session is skipped without re-parsing.":
      "Việc tự động nhập <code>~/.claude/projects</code> lúc khởi động chỉ chạy một lần và được kiểm soát bằng marker, nên một thư mục dự án được tạo sau lần khởi chạy đầu tiên — mà các phiên của nó không bao giờ chảy qua hook (ví dụ khi đã tắt hook chỉ-dành-cho-máy-chủ) — sẽ không hiển thị cho tới khi quét lại thủ công. Một tiến trình đồng bộ nền lấp khoảng trống đó bằng ba trình kích hoạt cùng dùng chung một bộ nhớ đệm mtime và một lượt quét gộp duy nhất: một lượt quét tức thì lúc khởi động, một <code>fs.watch</code> có khử dội (đệ quy trên macOS và Windows; theo dõi thư mục gốc cộng từng thư mục con trực tiếp trên Linux để tránh hiểm họa của trình theo dõi đệ quy ở tầng người dùng) kích hoạt ngay khoảnh khắc một tệp phiên hoặc thư mục dự án mới xuất hiện, và một lượt thăm dò an toàn định kỳ có thể điều chỉnh qua <code>DASHBOARD_SESSION_SYNC_MS</code> (mặc định <code>30000</code> ms; <code>0</code> tắt thăm dò nhưng vẫn giữ trình theo dõi chạy). Mỗi lượt quét chỉ phân tích lại những tệp có mtime tiến lên và phát đi <code>session_created</code> / <code>session_updated</code> (cùng với agent chính) để UI làm mới trực tiếp, trong khi một phiên đã nhập và không thay đổi thì được bỏ qua mà không phân tích lại.",
    "Incremental JSONL reader shared across the hook handler, compaction scanner, conversation viewer, and import pipeline. Byte-offset tracking skips already-parsed content; cache hits short-circuit disk I/O so even sessions with tens of thousands of turns stay fast. It also extracts the live session title (<code>custom-title</code> / <code>ai-title</code>) so renames surface in real time, plus the first user prompt as a fallback descriptor for placeholder-named sessions and agents.":
      "Trình đọc JSONL tăng dần được chia sẻ giữa trình xử lý hook, trình quét nén, trình xem hội thoại và đường ống nhập. Việc theo dõi byte-offset bỏ qua nội dung đã phân tích; các lần trúng cache rút ngắn I/O đĩa nên ngay cả những phiên có hàng chục nghìn lượt vẫn chạy nhanh. Nó cũng trích xuất tiêu đề phiên trực tiếp (<code>custom-title</code> / <code>ai-title</code>) để việc đổi tên hiển thị theo thời gian thực, cùng prompt đầu tiên của người dùng làm mô tả dự phòng cho các phiên và agent còn mang tên placeholder.",
    "LRU eviction of cold session buffers plus a tail-cap on per-entry growable arrays (turn durations, API errors, compaction entries). A session that runs for days cannot grow a single cache entry without bound, and each entry stores its parsed result only once — no shadow copy.":
      "Loại bỏ theo LRU các bộ đệm phiên nguội cùng với một giới hạn đuôi trên các mảng có thể tăng trưởng theo từng mục (thời lượng lượt, lỗi API, mục nén). Một phiên chạy nhiều ngày cũng không thể làm một mục cache đơn lẻ tăng không giới hạn, và mỗi mục chỉ lưu kết quả đã phân tích của nó một lần — không có bản sao bóng.",
    "The periodic compaction sweep reads each active session's transcript path directly from <code>sessions.transcript_path</code> (a partial index covers exactly those rows), so the work is O(active sessions) instead of a <code>json_extract</code> scan over the whole events table.":
      "Lượt quét nén định kỳ đọc đường dẫn transcript của mỗi phiên đang hoạt động trực tiếp từ <code>sessions.transcript_path</code> (một chỉ mục bộ phận phủ đúng các hàng đó), nên khối lượng công việc là O(số phiên đang hoạt động) thay vì một lần quét <code>json_extract</code> trên toàn bộ bảng sự kiện.",
    "Collapsible parent–child agent tree rendered on both Dashboard and Session Detail. Agents with subagents display expand/collapse chevrons; leaf agents show a dot indicator. The tree auto-expands when any child transitions to active and correctly tracks backgrounded subagents without premature completion. Depth is unlimited — deeply nested chains render as indented rows with connecting lines. Each node shows model, current tool, status badge, and cumulative token cost for tracing spend down the spawn chain.":
      "Cây agent cha–con có thể thu gọn, được hiển thị trên cả Dashboard lẫn Session Detail. Các agent có subagent hiển thị mũi tên mở rộng/thu gọn; agent lá hiển thị một dấu chấm. Cây tự động mở rộng khi bất kỳ con nào chuyển sang hoạt động và theo dõi chính xác các subagent chạy nền mà không đánh dấu hoàn tất quá sớm. Độ sâu không giới hạn — các chuỗi lồng sâu được hiển thị thành những hàng thụt vào với đường nối. Mỗi nút hiển thị model, công cụ hiện tại, huy hiệu trạng thái và chi phí token tích lũy để truy vết mức chi xuống theo chuỗi sinh.",
    "Per-model cost estimation with configurable pricing rules — set input, output, and cache-read rates per model variant through the Settings UI. View total and per-session breakdowns on Sessions, Session Detail, and Analytics. Compaction- aware token accounting preserves baselines across context compressions so no usage is silently dropped. Cost chips appear on Kanban cards, session rows, and the sidebar summary. Subagent cards show each subagent's own cost, computed from that subagent's transcript token usage priced at current rates, so a subagent card no longer misleadingly reads as if it cost the whole session; main-agent cards still show the session total. Pricing changes retroactively recalculate all stored sessions, and imports apply the same rate table.":
      "Ước tính chi phí theo từng model với các quy tắc định giá có thể cấu hình — đặt mức phí cho đầu vào, đầu ra và đọc cache cho mỗi biến thể model qua Settings UI. Xem tổng chi phí và phân tích theo từng phiên trên Sessions, Session Detail và Analytics. Việc tính token có nhận biết nén giữ lại các mốc cơ sở qua các lần nén ngữ cảnh nên không có lượng dùng nào bị âm thầm bỏ qua. Các nhãn chi phí xuất hiện trên thẻ Kanban, hàng phiên và phần tóm tắt ở thanh bên. Thẻ subagent hiển thị chi phí của riêng từng subagent, được tính từ lượng dùng token trong transcript của subagent đó theo mức giá hiện hành, nên thẻ subagent không còn hiểu nhầm như thể nó tốn chi phí của cả phiên; thẻ agent chính vẫn hiển thị tổng của phiên. Thay đổi định giá sẽ tính lại hồi tố tất cả các phiên đã lưu, và việc nhập cũng áp dụng cùng bảng giá đó.",
    "Model pricing editor with per-token rate configuration for every Claude variant. Hook installation status with one-click reinstall and per-hook health checks. Full JSON data export covering sessions, agents, events, tokens, and pricing rules. Session cleanup controls to abandon stale sessions or purge old data by age. Browser notification preferences with per-event toggles. A system information panel shows database row counts, file sizes, server uptime, and WebSocket connection status at a glance.":
      "Trình chỉnh sửa định giá model với cấu hình mức phí theo từng token cho mọi biến thể Claude. Trạng thái cài đặt hook với việc cài lại bằng một cú nhấp và kiểm tra sức khỏe theo từng hook. Xuất dữ liệu JSON đầy đủ bao gồm phiên, agent, sự kiện, token và quy tắc định giá. Các điều khiển dọn dẹp phiên để bỏ các phiên cũ hoặc xóa dữ liệu cũ theo độ tuổi. Tùy chọn thông báo trình duyệt với công tắc theo từng sự kiện. Một bảng thông tin hệ thống hiển thị nhanh số hàng cơ sở dữ liệu, kích thước tệp, thời gian hoạt động của máy chủ và trạng thái kết nối WebSocket.",
    "Local MCP sidecar with three transport modes — stdio for Claude Code native integration, HTTP+SSE for remote clients, and an interactive REPL for ad-hoc terminal queries. Exposes 25 typed tools across 6 domains: sessions, agents, events, analytics, settings, and system health. Every mutation is gated behind a tiered policy so nothing dangerous fires without opt-in. Retry-aware API access handles transient failures. Runs as a standalone Node process with no Docker or cloud dependency.":
      "MCP sidecar cục bộ với ba chế độ truyền tải — stdio để tích hợp gốc với Claude Code, HTTP+SSE cho các client từ xa, và một REPL tương tác cho các truy vấn terminal tạm thời. Phơi bày 25 công cụ có kiểu trên 6 lĩnh vực: phiên, agent, sự kiện, phân tích, cài đặt và sức khỏe hệ thống. Mọi thao tác thay đổi đều được kiểm soát qua một chính sách phân tầng nên không có hành động nguy hiểm nào kích hoạt mà không có sự đồng ý trước. Truy cập API có nhận biết thử lại xử lý các lỗi nhất thời. Chạy như một tiến trình Node độc lập, không phụ thuộc Docker hay đám mây.",
    "Instruction, skills, rules, and custom-agent layers for both Claude Code and Codex. Path-scoped rules target backend, frontend, MCP, and docs directories with context-appropriate guidelines. Reusable skills cover onboarding, feature shipping, live-issue debugging, release-readiness, and MCP operations. Specialized subagents for backend, frontend, and MCP code review run in parallel with focused tooling. Everything lives in <code>.claude/</code> and is version-controlled alongside the codebase.":
      "Các lớp chỉ dẫn, kỹ năng, quy tắc và agent tùy chỉnh cho cả Claude Code lẫn Codex. Các quy tắc giới hạn theo đường dẫn nhắm vào các thư mục backend, frontend, MCP và docs với những hướng dẫn phù hợp ngữ cảnh. Các kỹ năng tái sử dụng bao gồm khâu nhập môn, phát hành tính năng, gỡ lỗi sự cố trực tiếp, kiểm tra sẵn sàng phát hành và vận hành MCP. Các subagent chuyên biệt cho việc review mã backend, frontend và MCP chạy song song với bộ công cụ tập trung. Mọi thứ nằm trong <code>.claude/</code> và được quản lý phiên bản cùng với mã nguồn.",
    "D3.js-powered visualizations: an agent orchestration DAG showing spawn patterns across sessions, a tool-execution Sankey diagram mapping tool-to- tool transitions, and a directed pipeline graph with frequency labels. Every chart title carries an info icon that opens a popover explaining what it shows and how to read it. Hovering nodes, edges, and bars surfaces tooltips with share-of-source percentages, success-rate buckets, and timing patterns. All labels are translated to English, Vietnamese, and Chinese.":
      "Các trực quan hóa do D3.js cung cấp: một DAG điều phối agent thể hiện các mẫu sinh qua các phiên, một biểu đồ Sankey thực thi công cụ ánh xạ các chuyển tiếp công cụ-sang-công cụ, và một đồ thị pipeline có hướng với nhãn tần suất. Mỗi tiêu đề biểu đồ đều có một biểu tượng thông tin, khi nhấp sẽ mở một popover giải thích nó thể hiện điều gì và cách đọc. Việc rê chuột lên các nút, cạnh và thanh sẽ hiện ra tooltip với tỷ lệ phần trăm theo nguồn, các nhóm tỷ lệ thành công và các mẫu thời gian. Tất cả nhãn đều được dịch sang tiếng Anh, tiếng Việt và tiếng Trung.",
    "Subagent effectiveness scorecards with success-rate rings and day-of-week sparklines. Auto-detected workflow patterns expand on click into a detail panel with the full step chain, stats grid, and a narrative with loop detection. Model delegation flow, error propagation bars with API error cards, concurrency swim-lanes, and complexity bubble charts round out the view. Six headline stat cards each include an info popover explaining the metric and its current value. Status filter applies globally.":
      "Bảng điểm hiệu quả của subagent với các vòng tỷ lệ thành công và biểu đồ tia theo ngày trong tuần. Các mẫu quy trình được tự động phát hiện sẽ mở rộng khi nhấp thành một bảng chi tiết với toàn bộ chuỗi bước, lưới thống kê và một phần tường thuật có phát hiện vòng lặp. Luồng ủy quyền model, các thanh lan truyền lỗi kèm thẻ lỗi API, các làn bơi đồng thời và các biểu đồ bong bóng độ phức tạp hoàn thiện khung nhìn. Sáu thẻ thống kê nổi bật, mỗi thẻ kèm một popover thông tin giải thích chỉ số và giá trị hiện tại của nó. Bộ lọc trạng thái áp dụng trên toàn cục.",
    "Searchable session selector with pagination to explore any session's agent tree, tool-call timeline, and event sequence. The detail page opens with a live-updating overview — tile counters for events, tool calls, subagents, compactions, errors, and duration. Top-tool usage bars and subagent breakdown give quick reads. The conversation viewer renders markdown with syntax highlighting. Cross-filter from DAG nodes, run compaction analysis, or export as JSON — all with real-time WebSocket auto-refresh.":
      "Bộ chọn phiên có thể tìm kiếm kèm phân trang để khám phá cây agent, dòng thời gian gọi công cụ và chuỗi sự kiện của bất kỳ phiên nào. Trang chi tiết mở ra với một phần tổng quan cập nhật trực tiếp — các bộ đếm dạng ô cho sự kiện, lần gọi công cụ, subagent, lần nén, lỗi và thời lượng. Các thanh sử dụng công cụ hàng đầu và phần phân tích subagent giúp xem nhanh. Trình xem hội thoại hiển thị markdown kèm tô sáng cú pháp. Lọc chéo từ các nút DAG, chạy phân tích nén, hoặc xuất ra JSON — tất cả đều có tự động làm mới WebSocket theo thời gian thực.",
    "Persistent browser notifications via Web Push (VAPID) for real-time alerts even when the tab is not focused or the browser is backgrounded. Includes macOS audio support so notifications are audible alongside system sounds. Per-event toggles let you choose which events fire — session starts, completions, errors, compactions, or agent spawns. Server-side subscription management ensures one push per event per browser. Works on Chrome, Edge, Firefox, and Safari 17+ with graceful degradation elsewhere.":
      "Thông báo trình duyệt bền vững qua Web Push (VAPID) cho các cảnh báo thời gian thực ngay cả khi tab không được lấy nét hoặc trình duyệt đang chạy nền. Bao gồm hỗ trợ âm thanh trên macOS để thông báo phát ra cùng với âm thanh hệ thống. Các công tắc theo từng sự kiện cho phép bạn chọn sự kiện nào sẽ kích hoạt — phiên bắt đầu, hoàn tất, lỗi, lần nén hoặc sinh agent. Việc quản lý đăng ký phía máy chủ đảm bảo mỗi sự kiện chỉ đẩy một lần cho mỗi trình duyệt. Hoạt động trên Chrome, Edge, Firefox và Safari 17+ với cơ chế suy giảm nhẹ nhàng ở những nơi khác.",
    "Ready-to-use Dockerfile and docker-compose.yml for one-command deployment. Supports both Docker and Podman with persistent volume mounts for the SQLite database and hook data. Configurable port mapping via environment variables and a health-check endpoint the container runtime can poll. Multi-stage build keeps the image lean — only production deps and the compiled bundle ship. Run <code>docker compose up -d --build</code> and the dashboard is live with zero additional setup or configuration required.":
      "Dockerfile và docker-compose.yml sẵn dùng để triển khai bằng một lệnh. Hỗ trợ cả Docker lẫn Podman với các volume mount bền vững cho cơ sở dữ liệu SQLite và dữ liệu hook. Ánh xạ cổng có thể cấu hình qua biến môi trường và một endpoint kiểm tra sức khỏe mà runtime container có thể thăm dò. Quá trình build nhiều giai đoạn giữ cho image gọn nhẹ — chỉ các phụ thuộc production và gói đã biên dịch được đưa vào. Chạy <code>docker compose up -d --build</code> và dashboard sẽ hoạt động ngay mà không cần bất kỳ thiết lập hay cấu hình bổ sung nào.",
    "Official Claude Code plugin marketplace shipping 10 plugins with 53 skills, 14 agents, 30 slash commands, 3 CLI tools, 3 hook configs, and 1 MCP server. Deep analytics with compaction-aware baselines, productivity automation, developer diagnostics, AI-powered workflow intelligence, and dashboard MCP integration. Five newer plugins go further: <code>ccam-cost-guard</code> (budget guardrails, spend forecasts, and cost-threshold alerts), <code>ccam-sessions</code> (session forensics — search, timeline, and transcript replay), <code>ccam-workflows</code> (multi-agent orchestration and fleet intelligence), <code>ccam-quality</code> (reliability and SLO checks), and <code>ccam-config</code> (Claude Code config and memory governance). Install with <code>claude plugin install</code> — no restart needed. Each listing shows author, license, homepage, and per-skill contribution breakdown. The Config Explorer's Plugins tab surfaces installed plugins with live status.":
      "Chợ plugin chính thức của Claude Code phát hành 10 plugin với 53 kỹ năng, 14 agent, 30 lệnh gạch chéo, 3 công cụ CLI, 3 cấu hình hook và 1 máy chủ MCP. Phân tích chuyên sâu với các mốc cơ sở có nhận biết nén, tự động hóa năng suất, chẩn đoán cho lập trình viên, trí tuệ quy trình được hỗ trợ bởi AI, và tích hợp MCP của dashboard. Năm plugin mới hơn còn đi xa hơn nữa: <code>ccam-cost-guard</code> (lan can ngân sách, dự báo chi tiêu và cảnh báo ngưỡng chi phí), <code>ccam-sessions</code> (pháp y phiên — tìm kiếm, dòng thời gian và phát lại transcript), <code>ccam-workflows</code> (điều phối đa agent và trí tuệ đội nhóm), <code>ccam-quality</code> (kiểm tra độ tin cậy và SLO), và <code>ccam-config</code> (quản trị cấu hình và bộ nhớ của Claude Code). Cài đặt bằng <code>claude plugin install</code> — không cần khởi động lại. Mỗi mục liệt kê hiển thị tác giả, giấy phép, trang chủ và phần phân tích đóng góp theo từng kỹ năng. Tab Plugins của Config Explorer hiển thị các plugin đã cài kèm trạng thái trực tiếp.",
    "Spawn <code>claude</code> subprocesses straight from the dashboard with a chat-style streaming UI — multi-turn <b>Conversation</b> or single-shot <b>Headless</b> mode. One-click <b>Resume</b> on any past conversation spawns <code>claude --resume</code> seeded with the prior transcript. Re- attach reconciles in-memory logs with the on-disk JSONL so navigating away never loses history. Slash-command autocomplete, file references, live token/context-window meter, and a thinking-effort dial bring TUI parity to the browser. Same-origin guard blocks drive-by spawns.":
      "Sinh các tiến trình con <code>claude</code> ngay từ dashboard với một UI luồng theo kiểu trò chuyện — chế độ <b>Conversation</b> nhiều lượt hoặc <b>Headless</b> một lần. Nhấp một lần <b>Resume</b> trên bất kỳ cuộc trò chuyện nào trong quá khứ sẽ sinh <code>claude --resume</code> được gieo mầm bằng transcript trước đó. Việc kết nối lại đối chiếu nhật ký trong bộ nhớ với JSONL trên đĩa nên rời khỏi trang không bao giờ làm mất lịch sử. Tự động hoàn thành lệnh gạch chéo, tham chiếu tệp, đồng hồ đo token/cửa sổ ngữ cảnh trực tiếp và một núm điều chỉnh mức độ suy nghĩ mang lại sự tương đương với TUI ngay trên trình duyệt. Cơ chế bảo vệ same-origin chặn các lần sinh lén lút.",
    "A 12-tab inspector at <code>/cc-config</code> for everything Claude Code knows about: skills, subagents, slash commands, output styles, plugins, marketplaces, MCP servers, hooks, settings, memory, keybindings, and statusline scripts. The Settings tab leads with a Current configuration summary of the options <code>/config</code> controls — model, verbose, theme, output style, auto-compact, notifications — resolved across scopes. The Memory tab surfaces both the user and project <code>CLAUDE.md</code> files and the per-project file-based memory store — every auto-memory <code>*.md</code> under <code>~/.claude/projects/&lt;slug&gt;/memory/</code> (a <code>MEMORY.md</code> index plus one file per remembered fact, often 100+), grouped by project, searchable, and editable. Create, edit, and delete the low-risk text-file surfaces with mandatory timestamped backups before every write. Plugins, MCP, hooks, and live settings stay read-only with explainer banners and copy-able CLI commands. Per-plugin contribution breakdowns show author and license.":
      "Một trình kiểm tra gồm 12 tab tại <code>/cc-config</code> cho mọi thứ mà Claude Code biết: kỹ năng, subagent, lệnh gạch chéo, kiểu đầu ra, plugin, chợ, máy chủ MCP, hook, cài đặt, bộ nhớ, gán phím và các script thanh trạng thái. Tab Cài đặt mở đầu bằng một bản tóm tắt Cấu hình hiện tại của các tùy chọn mà <code>/config</code> kiểm soát — model, verbose, theme, kiểu đầu ra, tự động nén, thông báo — được phân giải trên các phạm vi. Tab Bộ nhớ hiển thị cả tệp <code>CLAUDE.md</code> của người dùng lẫn của dự án, cùng kho bộ nhớ dựa trên tệp theo từng dự án — mỗi tệp auto-memory <code>*.md</code> nằm dưới <code>~/.claude/projects/&lt;slug&gt;/memory/</code> (một chỉ mục <code>MEMORY.md</code> cộng với một tệp cho mỗi sự kiện được ghi nhớ, thường hơn 100 tệp), được nhóm theo dự án, có thể tìm kiếm và chỉnh sửa. Tạo, chỉnh sửa và xóa các bề mặt tệp văn bản rủi ro thấp với việc sao lưu bắt buộc có dấu thời gian trước mỗi lần ghi. Plugin, MCP, hook và cài đặt trực tiếp vẫn ở chế độ chỉ đọc kèm các biểu ngữ giải thích và lệnh CLI có thể sao chép. Phần phân tích đóng góp theo từng plugin hiển thị tác giả và giấy phép.",
    "Mobile-first layouts with stacking grids, horizontally scrollable tables, and a collapsible sidebar that auto-hides below 1400 px. All pages adapt from phone to ultrawide with consistent navigation and readable typography. Kanban columns stack vertically on narrow screens, analytics charts reflow to single-column, and the activity feed stays fully swipeable. Touch targets meet 44 px minimum. Dark theme renders consistently across iOS Safari, Chrome, and Firefox with no flash of unstyled content.":
      "Bố cục ưu tiên di động với các lưới xếp chồng, bảng có thể cuộn ngang và một thanh bên có thể thu gọn tự động ẩn khi dưới 1400 px. Mọi trang đều thích ứng từ điện thoại đến màn hình siêu rộng với điều hướng nhất quán và kiểu chữ dễ đọc. Các cột Kanban xếp chồng theo chiều dọc trên màn hình hẹp, các biểu đồ phân tích sắp xếp lại thành một cột, và dòng hoạt động vẫn có thể vuốt hoàn toàn. Các vùng chạm đạt tối thiểu 44 px. Giao diện tối hiển thị nhất quán trên iOS Safari, Chrome và Firefox mà không có hiện tượng nhấp nháy nội dung chưa định kiểu.",
    "Visualize parallel agent execution with a Gantt-style timeline showing overlapping subagent lifetimes, tool-call concurrency windows, and wait gaps. Color-coded bars distinguish working, waiting, and errored states so bottlenecks are immediately visible. Hover any bar for exact timestamps and duration. Zoom and pan across long-running sessions with hundreds of agents. The timeline shares the Workflows status filter so you can isolate active, completed, or errored sessions without leaving the view.":
      "Trực quan hóa việc thực thi agent song song bằng một dòng thời gian kiểu Gantt thể hiện các vòng đời subagent chồng lấn, các cửa sổ đồng thời của lần gọi công cụ và các khoảng chờ. Các thanh được mã màu phân biệt trạng thái đang làm việc, đang chờ và bị lỗi nên các nút thắt cổ chai hiện ra ngay lập tức. Rê chuột lên bất kỳ thanh nào để xem dấu thời gian và thời lượng chính xác. Phóng to và kéo qua các phiên chạy dài với hàng trăm agent. Dòng thời gian này dùng chung bộ lọc trạng thái của Workflows nên bạn có thể tách riêng các phiên đang hoạt động, đã hoàn tất hoặc bị lỗi mà không cần rời khỏi khung nhìn.",
    "Professional VS Code extension with a real-time Activity Bar sidebar showing active sessions, agent counts, and recent events without leaving your editor. A status bar pulse monitor surfaces connection health and the latest event type at a glance. Deep navigation links open any session or analytics view directly in your browser. An embedded webview renders the full dashboard inside a VS Code tab with WebSocket push, theme sync, and responsive layout. Install from the marketplace or build from source.":
      "Tiện ích mở rộng VS Code chuyên nghiệp với một thanh bên Activity Bar theo thời gian thực hiển thị các phiên đang hoạt động, số lượng agent và các sự kiện gần đây mà không cần rời khỏi trình soạn thảo. Một bộ giám sát nhịp ở thanh trạng thái hiện ra sức khỏe kết nối và loại sự kiện mới nhất chỉ trong nháy mắt. Các liên kết điều hướng chuyên sâu mở bất kỳ phiên hoặc khung nhìn phân tích nào trực tiếp trong trình duyệt của bạn. Một webview nhúng hiển thị toàn bộ dashboard ngay trong một tab VS Code với WebSocket push, đồng bộ giao diện và bố cục đáp ứng. Cài đặt từ chợ hoặc build từ mã nguồn.",
    "Trace how errors cascade across agents and tool calls with a directed graph showing failure origins, retry paths, and recovery points. Each node displays the agent or tool that errored, the error message, and whether a retry succeeded or propagated upstream. Pinpoint root causes in deeply nested subagent chains. Horizontal bar charts rank the most error-prone tools and models. API error cards group failures by HTTP status and endpoint. Filter by session, time range, or error severity to narrow the view.":
      "Truy vết cách các lỗi lan truyền dây chuyền qua các agent và lần gọi công cụ bằng một đồ thị có hướng thể hiện nguồn gốc lỗi, đường thử lại và điểm phục hồi. Mỗi nút hiển thị agent hoặc công cụ bị lỗi, thông báo lỗi và việc thử lại đã thành công hay lan truyền lên thượng nguồn. Xác định chính xác nguyên nhân gốc trong các chuỗi subagent lồng sâu. Các biểu đồ thanh ngang xếp hạng những công cụ và model dễ lỗi nhất. Các thẻ lỗi API nhóm các thất bại theo trạng thái HTTP và endpoint. Lọc theo phiên, khoảng thời gian hoặc mức độ nghiêm trọng của lỗi để thu hẹp khung nhìn.",
    'Three independent PWAs — dashboard, landing page, and wiki — each with its own Web App Manifest and Service Worker. Install to your home screen or dock for a standalone, chrome-less experience. SVG icons with <code>sizes="any"</code> and iOS standalone meta tags included.':
      'Ba PWA độc lập — dashboard, trang đích và wiki — mỗi cái có Web App Manifest và Service Worker riêng. Cài đặt vào màn hình chính hoặc dock của bạn để có trải nghiệm độc lập, không khung trình duyệt. Bao gồm các biểu tượng SVG với <code>sizes="any"</code> và các thẻ meta standalone của iOS.',
    "The dashboard SW serves Vite's hashed <code>/assets/*</code> bundles cache-first (URLs are immutable per build) and treats everything else as network-first with cache fallback. Explicit <code>Cache-Control</code> headers on the production Express static middleware reinforce the policy, so a rebuild replaces the in-browser code without a hard refresh.":
      "SW của dashboard phục vụ các gói <code>/assets/*</code> đã băm của Vite theo kiểu cache-first (các URL là bất biến theo mỗi lần build) và xử lý mọi thứ khác theo kiểu network-first với cache làm phương án dự phòng. Các header <code>Cache-Control</code> tường minh trên middleware tĩnh Express ở môi trường production củng cố chính sách này, nên một lần build lại sẽ thay thế mã trong trình duyệt mà không cần làm mới cứng.",
    "A <code>controllerchange</code> listener in <code>client/src/main.tsx</code> reloads the page exactly once when a new SW takes over an already-controlled page. First installs do not reload, so the very first visit is never interrupted.":
      "Một trình lắng nghe <code>controllerchange</code> trong <code>client/src/main.tsx</code> tải lại trang đúng một lần khi một SW mới tiếp quản một trang đã được kiểm soát. Các lần cài đặt đầu tiên không tải lại, nên lần truy cập đầu tiên không bao giờ bị gián đoạn.",
    '<span class="caption-icon">📡</span> <span><strong>Dashboard · Monitor</strong> — live overview of active sessions and agents. Stats tiles, collapsible subagent hierarchy cards, and a recent activity feed. Auto-refreshes every 5 s via WebSocket</span>':
      '<span class="caption-icon">📡</span> <span><strong>Dashboard · Monitor</strong> — tổng quan trực tiếp về các phiên và agent đang hoạt động. Các ô thống kê, thẻ phân cấp subagent có thể thu gọn, và một nguồn cấp hoạt động gần đây. Tự động làm mới mỗi 5 s qua WebSocket</span>',
    '<span class="caption-icon">🩺</span> <span><strong>Dashboard · Health</strong> — composite health score ring, storage engine donut, cache/error/success gauges, tool invocation bars, subagent effectiveness, and model token distribution</span>':
      '<span class="caption-icon">🩺</span> <span><strong>Dashboard · Health</strong> — vòng điểm sức khỏe tổng hợp, biểu đồ vành khuyên về storage engine, các đồng hồ đo cache/lỗi/thành công, biểu đồ cột số lần gọi công cụ, hiệu quả của subagent, và phân bố token theo mô hình</span>',
    '<span class="caption-icon">📋</span> <span><strong>Kanban Board (agents)</strong> — agents swim-laned by status: Working, Waiting, Completed, Error. Cards show model, cost, and current tool call. Yellow column flags agents waiting on user input</span>':
      '<span class="caption-icon">📋</span> <span><strong>Kanban Board (agent)</strong> — các agent được xếp theo làn dựa trên trạng thái: Working, Waiting, Completed, Error. Thẻ hiển thị mô hình, chi phí và lời gọi công cụ hiện tại. Cột màu vàng đánh dấu các agent đang chờ người dùng nhập liệu</span>',
    '<span class="caption-icon">🗂️</span> <span><strong>Kanban Board (sessions)</strong> — sessions swim-laned across 5 columns: Active, Waiting, Completed, Error, Abandoned. Each card shows agent count, duration, model, and cumulative cost</span>':
      '<span class="caption-icon">🗂️</span> <span><strong>Kanban Board (session)</strong> — các session được xếp theo làn trên 5 cột: Active, Waiting, Completed, Error, Abandoned. Mỗi thẻ hiển thị số lượng agent, thời lượng, mô hình và chi phí tích lũy</span>',
    '<span class="caption-icon">📂</span> <span><strong>Sessions</strong> — searchable, filterable, server-paginated table. Each row shows status badge, agent count, duration, model, and cost. Click any row to drill into session detail</span>':
      '<span class="caption-icon">📂</span> <span><strong>Sessions</strong> — bảng có thể tìm kiếm, lọc và phân trang phía máy chủ. Mỗi hàng hiển thị huy hiệu trạng thái, số lượng agent, thời lượng, mô hình và chi phí. Nhấp vào bất kỳ hàng nào để xem chi tiết phiên</span>',
    '<span class="caption-icon">🤖</span> <span><strong>Session Detail · Agents</strong> — overview tiles (events, tool calls, subagents, errors, duration), top-tool usage bars, subagent type breakdown, and a collapsible parent–child agent hierarchy tree</span>':
      '<span class="caption-icon">🤖</span> <span><strong>Session Detail · Agents</strong> — các ô tổng quan (sự kiện, lời gọi công cụ, subagent, lỗi, thời lượng), biểu đồ cột công cụ dùng nhiều nhất, phân tích theo loại subagent, và một cây phân cấp agent cha–con có thể thu gọn</span>',
    '<span class="caption-icon">💬</span> <span><strong>Session Detail · Conversation</strong> — full transcript viewer with markdown rendering, syntax-highlighted code blocks, per-tool sections, and collapsible thinking blocks</span>':
      '<span class="caption-icon">💬</span> <span><strong>Session Detail · Conversation</strong> — trình xem bản ghi đầy đủ với kết xuất markdown, khối mã được tô sáng cú pháp, các phần theo từng công cụ, và các khối suy nghĩ có thể thu gọn</span>',
    '<span class="caption-icon">🔬</span> <span><strong>Session Detail · Timeline</strong> — chronological event timeline with multi-dimension filters, color-coded entries by type, expandable hook payloads, and direct links to the owning session and agent</span>':
      '<span class="caption-icon">🔬</span> <span><strong>Session Detail · Timeline</strong> — dòng thời gian sự kiện theo trình tự thời gian với bộ lọc đa chiều, các mục được mã hóa màu theo loại, payload hook có thể mở rộng, và liên kết trực tiếp đến phiên và agent sở hữu</span>',
    '<span class="caption-icon">📰</span> <span><strong>Activity Feed</strong> — real-time streaming event log with pause/resume buffering, multi-dimension filters, expandable hook payloads, color-coded entries, and per-row session navigation buttons</span>':
      '<span class="caption-icon">📰</span> <span><strong>Activity Feed</strong> — nhật ký sự kiện truyền trực tiếp theo thời gian thực với bộ đệm tạm dừng/tiếp tục, bộ lọc đa chiều, payload hook có thể mở rộng, các mục được mã hóa màu, và nút điều hướng phiên trên từng hàng</span>',
    '<span class="caption-icon">📊</span> <span><strong>Analytics</strong> — token usage by model, tool frequency bars, 52-week activity heatmap, 30-day sparkline trends, session outcome donuts, and cost summary with WebSocket auto-refresh</span>':
      '<span class="caption-icon">📊</span> <span><strong>Analytics</strong> — mức dùng token theo mô hình, biểu đồ cột tần suất công cụ, bản đồ nhiệt hoạt động 52 tuần, xu hướng sparkline 30 ngày, biểu đồ vành khuyên về kết quả phiên, và bản tóm tắt chi phí với tự động làm mới qua WebSocket</span>',
    '<span class="caption-icon">🔀</span> <span><strong>Workflows</strong> — D3.js agent orchestration DAG, tool-execution Sankey diagram, directed pipeline graph, effectiveness scorecards, concurrency swim-lanes, and complexity bubble charts</span>':
      '<span class="caption-icon">🔀</span> <span><strong>Workflows</strong> — DAG điều phối agent bằng D3.js, sơ đồ Sankey về thực thi công cụ, đồ thị pipeline có hướng, bảng điểm hiệu quả, làn bơi đồng thời, và biểu đồ bong bóng độ phức tạp</span>',
    '<span class="caption-icon">🧰</span> <span><strong>Claude Config Explorer</strong> — 12-tab inspector for skills, subagents, slash commands, plugins, MCP servers, hooks, settings, memory, keybindings, and statusline. Safe edits with backups</span>':
      '<span class="caption-icon">🧰</span> <span><strong>Claude Config Explorer</strong> — trình kiểm tra gồm 12 tab cho skill, subagent, lệnh slash, plugin, máy chủ MCP, hook, cài đặt, bộ nhớ, phím tắt và thanh trạng thái. Chỉnh sửa an toàn kèm sao lưu</span>',
    '<span class="caption-icon">▶️</span> <span><strong>Run Claude</strong> — spawn or resume Claude subprocesses from the browser. Pick Conversation or Headless mode, set cwd, model, permission level, and thinking effort. Same-origin guard included</span>':
      '<span class="caption-icon">▶️</span> <span><strong>Run Claude</strong> — khởi chạy hoặc tiếp tục các tiến trình con Claude từ trình duyệt. Chọn chế độ Conversation hoặc Headless, đặt cwd, mô hình, mức quyền và cường độ suy nghĩ. Có kèm bảo vệ same-origin</span>',
    '<span class="caption-icon">💬</span> <span><strong>Run Claude · live stream</strong> — character-by-character streaming output. Tool uses, tool results, and thinking blocks are collapsible. Active runs switcher juggles multiple sessions</span>':
      '<span class="caption-icon">💬</span> <span><strong>Run Claude · live stream</strong> — kết xuất truyền trực tiếp theo từng ký tự. Lời gọi công cụ, kết quả công cụ và khối suy nghĩ đều có thể thu gọn. Bộ chuyển đổi các lần chạy đang hoạt động giúp quản lý nhiều phiên cùng lúc</span>',
    '<span class="caption-icon">⚙️</span> <span><strong>Settings</strong> — model pricing editor with per-token rates, hook installation status, JSON data export, session cleanup controls, browser notification toggles, and system info panel with DB stats</span>':
      '<span class="caption-icon">⚙️</span> <span><strong>Settings</strong> — trình chỉnh sửa giá mô hình với mức phí theo từng token, trạng thái cài đặt hook, xuất dữ liệu JSON, các điều khiển dọn dẹp phiên, công tắc thông báo trình duyệt, và bảng thông tin hệ thống kèm thống kê DB</span>',
    "This chart tracks how interest in Claude Code Agent Monitor has grown over time. The curve keeps climbing as more developers discover the project, share it, and use it in real workflows. Each new star is a small vote of confidence from the community.":
      "Biểu đồ này theo dõi mức độ quan tâm đến Claude Code Agent Monitor đã tăng trưởng như thế nào theo thời gian. Đường cong tiếp tục đi lên khi ngày càng nhiều nhà phát triển khám phá dự án, chia sẻ nó và dùng nó trong các quy trình làm việc thực tế. Mỗi star mới là một lá phiếu tin tưởng nhỏ từ cộng đồng.",
    '<span class="caption-icon">⭐</span> <span> Enjoying the project? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer" >Give it a star on GitHub</a > and help more builders discover it. </span>':
      '<span class="caption-icon">⭐</span> <span> Bạn thích dự án này? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer" >Hãy gắn sao cho nó trên GitHub</a > và giúp nhiều nhà phát triển khác khám phá nó. </span>',
    "Hook Type": "Loại Hook",
    Trigger: "Điều kiện kích hoạt",
    "Dashboard Action": "Hành động trên Dashboard",
    "Claude Code session begins": "Phiên Claude Code bắt đầu",
    "Creates session and main agent. Stamps <code>awaiting_input_since</code> so the row lands in <strong>Waiting</strong> from the start (the CLI is at a prompt). Reactivates resumed sessions. Abandons orphaned sessions with no activity for <code>DASHBOARD_STALE_MINUTES</code> (default 180).":
      "Tạo phiên và agent chính. Đóng dấu thời gian <code>awaiting_input_since</code> để hàng đó nằm trong <strong>Waiting</strong> ngay từ đầu (CLI đang ở dấu nhắc). Kích hoạt lại các phiên được tiếp tục. Bỏ rơi các phiên mồ côi không có hoạt động trong <code>DASHBOARD_STALE_MINUTES</code> (mặc định 180).",
    "User hits enter on a prompt": "Người dùng nhấn enter tại dấu nhắc",
    'Clears the waiting flag and promotes the main agent to <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >. The only reliable signal that text-only assistant turns have started — they emit no <code>PreToolUse</code> before <code>Stop</code>.':
      'Xóa cờ chờ và nâng agent chính lên <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >. Đây là tín hiệu đáng tin cậy duy nhất cho biết các lượt trợ lý chỉ-văn-bản đã bắt đầu — chúng không phát ra <code>PreToolUse</code> trước <code>Stop</code>.',
    "Agent begins using a tool": "Agent bắt đầu sử dụng một công cụ",
    'Clears the waiting flag, sets agent → <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >, <code>current_tool</code> set. If tool is <code>Agent</code>, subagent record created.':
      'Xóa cờ chờ, đặt agent → <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >, đặt <code>current_tool</code>. Nếu công cụ là <code>Agent</code>, tạo bản ghi subagent.',
    "Tool execution completes": "Việc thực thi công cụ hoàn tất",
    'Clears the waiting flag (covers permission-prompt approvals mid-tool). <code>current_tool</code> cleared. Agent stays <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >.':
      'Xóa cờ chờ (bao quát các phê duyệt nhắc-quyền giữa chừng khi dùng công cụ). Xóa <code>current_tool</code>. Agent vẫn ở <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >.',
    "Claude finishes a turn": "Claude hoàn thành một lượt",
    'Non-error: main agent → <code>waiting</code> — UI shows <span class="status-chip chip-waiting" ><span class="chip-dot"></span>Waiting</span > until the next user input. <code>stop_reason=error</code>: marks the agent and session <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >. Background subagents keep running.':
      'Không lỗi: agent chính → <code>waiting</code> — UI hiển thị <span class="status-chip chip-waiting" ><span class="chip-dot"></span>Waiting</span > cho đến lần nhập liệu tiếp theo của người dùng. <code>stop_reason=error</code>: đánh dấu agent và phiên là <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >. Các subagent chạy nền vẫn tiếp tục chạy.',
    "Background agent finished": "Agent chạy nền đã hoàn thành",
    "Matched subagent → <span class=\"status-chip chip-completed\" ><span class=\"chip-dot\"></span>Completed</span >. Deliberately does <strong>not</strong> clear the waiting flag — a backgrounded subagent finishing tells us nothing about the human. Also kicks off a fire-and-forget JSONL scan (<code>scanAndImportSubagents</code>) that walks the session's <code>subagents/agent-*.jsonl</code> files, pairs <code>tool_use</code> ↔ <code>tool_result</code> blocks by <code>tool_use_id</code>, and emits per-tool <code>PreToolUse</code> + <code>PostToolUse</code> events under each subagent's own <code>agent_id</code> — surfaces tool calls that subagents make internally and which never fire any hooks. The same scan also rebuilds the nested-subagent hierarchy — it repoints each subagent's <code>parent_agent_id</code> to the true spawner recovered from the transcript's Task tool result (<code>toolUseResult.agentId</code>), so subagents that spawn their own subagents nest correctly instead of flattening under main.":
      'Subagent khớp → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Cố ý <strong>không</strong> xóa cờ chờ — việc một subagent chạy nền hoàn thành không cho ta biết gì về con người. Đồng thời khởi động một lượt quét JSONL kiểu phát-rồi-quên (<code>scanAndImportSubagents</code>) duyệt qua các tệp <code>subagents/agent-*.jsonl</code> của phiên, ghép cặp các khối <code>tool_use</code> ↔ <code>tool_result</code> theo <code>tool_use_id</code>, và phát ra các sự kiện <code>PreToolUse</code> + <code>PostToolUse</code> theo từng công cụ dưới <code>agent_id</code> riêng của mỗi subagent — làm lộ ra các lời gọi công cụ mà subagent thực hiện nội bộ và vốn không bao giờ kích hoạt bất kỳ hook nào. Cùng lượt quét đó còn dựng lại phân cấp subagent lồng nhau — nó trỏ lại <code>parent_agent_id</code> của mỗi subagent về đúng agent đã spawn, khôi phục từ kết quả tool Task trong transcript (<code>toolUseResult.agentId</code>), nên subagent tự spawn subagent con sẽ lồng đúng chỗ thay vì dồn phẳng dưới main.',
    "Agent sends notification": "Agent gửi thông báo",
    'Event logged to activity feed. Permission/input-prompt patterns (e.g. "needs your permission", "waiting for your input") set the agent to <code>waiting</code> and stamp <code>awaiting_input_since</code>. Compaction-related notifications tagged as <code>Compaction</code> events. Triggers a browser notification if enabled.':
      'Sự kiện được ghi vào nguồn cấp hoạt động. Các mẫu nhắc quyền/nhắc nhập liệu (ví dụ "needs your permission", "waiting for your input") đặt agent thành <code>waiting</code> và đóng dấu thời gian <code>awaiting_input_since</code>. Các thông báo liên quan đến nén được gắn thẻ là sự kiện <code>Compaction</code>. Kích hoạt thông báo trình duyệt nếu được bật.',
    "<code>/compact</code> detected in JSONL": "Phát hiện <code>/compact</code> trong JSONL",
    'Creates a compaction subagent → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Detected via <code>isCompactSummary</code> entries in the transcript. Token baselines preserve pre-compaction totals. Periodic scanner (cadence ~¼ of <code>DASHBOARD_STALE_MINUTES</code>) catches compactions when no hooks fire.':
      'Tạo một subagent nén → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Được phát hiện qua các mục <code>isCompactSummary</code> trong bản ghi. Các đường cơ sở token giữ lại tổng số trước khi nén. Bộ quét định kỳ (nhịp khoảng ¼ của <code>DASHBOARD_STALE_MINUTES</code>) bắt được các lần nén khi không có hook nào kích hoạt.',
    "API error detected in transcript": "Phát hiện lỗi API trong bản ghi",
    "Extracted from JSONL during history import, real-time transcript scanning, or the error detection watchdog. Captures quota limits, rate limits, auth failures, and other API errors. <strong>Immediately marks sessions and agents as error</strong> — previously recorded as events without changing status.":
      "Được trích xuất từ JSONL trong quá trình nhập lịch sử, quét bản ghi theo thời gian thực, hoặc bộ canh gác phát hiện lỗi. Bắt được các giới hạn hạn ngạch, giới hạn tốc độ, lỗi xác thực và các lỗi API khác. <strong>Lập tức đánh dấu phiên và agent là lỗi</strong> — trước đây chỉ được ghi nhận như sự kiện mà không thay đổi trạng thái.",
    "Turn cancelled by the user (<code>Esc</code>)": "Lượt bị người dùng hủy (<code>Esc</code>)",
    "Synthesized by the watchdog because pressing <code>Esc</code> fires no hook. Recovered either from the transcript <code>[Request interrupted by user]</code> marker (flagged as <code>pendingInterrupt</code>) or, when <code>Esc</code> preceded any output and left no marker, from the idle-working timeout (<code>DASHBOARD_WORKING_IDLE_SECONDS</code>, default 120). Moves the session to <strong>Waiting</strong> — the same state a normal <code>Stop</code> produces.":
      "Được tổng hợp bởi watchdog vì việc nhấn <code>Esc</code> không kích hoạt hook nào. Khôi phục hoặc từ dấu hiệu <code>[Request interrupted by user]</code> trong bản ghi (được gắn cờ là <code>pendingInterrupt</code>), hoặc khi <code>Esc</code> diễn ra trước bất kỳ đầu ra nào và không để lại dấu hiệu, từ thời gian chờ làm-việc-rảnh-rỗi (<code>DASHBOARD_WORKING_IDLE_SECONDS</code>, mặc định 120). Chuyển phiên sang <strong>Waiting</strong> — cùng trạng thái mà một <code>Stop</code> bình thường tạo ra.",
    "Per-turn timing recorded": "Ghi lại thời gian theo từng lượt",
    "Extracted from JSONL turn boundaries. Records the duration of each assistant turn for latency analysis.":
      "Được trích xuất từ các ranh giới lượt trong JSONL. Ghi lại thời lượng của mỗi lượt trợ lý để phân tích độ trễ.",
    "Claude Code CLI process exits": "Tiến trình Claude Code CLI thoát",
    'Drops the waiting flag. If the session is already in <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >, the error state is preserved; otherwise marks all agents and the session as <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Evicts the session\'s transcript from the shared cache.':
      'Bỏ cờ chờ. Nếu phiên đã ở trạng thái <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >, trạng thái lỗi được giữ nguyên; nếu không, đánh dấu tất cả agent và phiên là <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Loại bỏ bản ghi của phiên khỏi bộ nhớ đệm dùng chung.',
    "Clone the repository to your machine": "Sao chép kho lưu trữ về máy của bạn",
    "Run <code>npm run setup</code> to install all dependencies":
      "Chạy <code>npm run setup</code> để cài đặt tất cả phụ thuộc",
    "Run <code>npm run dev</code> — server + client launch automatically":
      "Chạy <code>npm run dev</code> — máy chủ + máy khách tự động khởi chạy",
    "Start a new Claude Code session — events appear in real-time":
      "Khởi động một phiên Claude Code mới — các sự kiện xuất hiện theo thời gian thực",
    "A multi-stage <code>Dockerfile</code> and <code>docker-compose.yml</code> are included. You can run the monitor with either Docker or Podman and keep the SQLite database in a named volume.":
      "Đã bao gồm một <code>Dockerfile</code> nhiều giai đoạn và <code>docker-compose.yml</code>. Bạn có thể chạy trình giám sát bằng Docker hoặc Podman và giữ cơ sở dữ liệu SQLite trong một named volume.",
    "Hooks auto-install in local mode": "Hooks tự động cài đặt ở chế độ cục bộ",
    "When you run the server directly on the host with <code>npm run dev</code> or <code>npm start</code>, it automatically writes Claude Code hook entries to <code>~/.claude/settings.json</code>. If you run the dashboard in Docker or Podman, install hooks from the host with <code>npm run install-hooks</code> after the container is up, then restart Claude Code. The installer refuses to run inside a container (issue #193) so it never writes a container-internal handler path into a bind-mounted host <code>~/.claude</code>; override with <code>CCAM_ALLOW_CONTAINER_HOOKS=1</code> only if Claude Code itself runs in the container.":
      "Khi bạn chạy máy chủ trực tiếp trên host bằng <code>npm run dev</code> hoặc <code>npm start</code>, nó tự động ghi các mục hook của Claude Code vào <code>~/.claude/settings.json</code>. Nếu bạn chạy bảng điều khiển trong Docker hoặc Podman, hãy cài đặt hooks từ host bằng <code>npm run install-hooks</code> sau khi container đã chạy, rồi khởi động lại Claude Code. Trình cài đặt từ chối chạy bên trong một container (issue #193) nên không bao giờ ghi đường dẫn handler nội bộ của container vào <code>~/.claude</code> của máy chủ được bind-mount; chỉ ghi đè bằng <code>CCAM_ALLOW_CONTAINER_HOOKS=1</code> nếu chính Claude Code chạy trong container.",
    "This repository also ships a local MCP server under <code>mcp/</code> and extension scaffolding for both Claude Code and Codex. These are optional for the dashboard UI, but recommended for complete local-agent workflows. The MCP server supports stdio (for host integration), HTTP+SSE (for remote clients), and an interactive REPL (for operator debugging).":
      "Kho lưu trữ này cũng đi kèm một máy chủ MCP cục bộ tại <code>mcp/</code> và bộ khung mở rộng cho cả Claude Code và Codex. Những thành phần này là tùy chọn đối với giao diện bảng điều khiển, nhưng được khuyến nghị cho các quy trình local-agent đầy đủ. Máy chủ MCP hỗ trợ stdio (để tích hợp với host), HTTP+SSE (cho các client từ xa) và một REPL tương tác (để vận hành viên gỡ lỗi).",
    "After starting a Claude Code session, you should see:":
      "Sau khi bắt đầu một phiên Claude Code, bạn sẽ thấy:",
    Page: "Trang",
    Expected: "Kết quả mong đợi",
    Sessions: "Phiên (Sessions)",
    'Your session listed with status <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> (a fresh CLI is sitting at the prompt) — flips to <span class="status-chip chip-active"><span class="chip-dot"></span>Active</span> the moment Claude starts a turn':
      'Phiên của bạn được liệt kê với trạng thái <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> (một CLI mới đang chờ ở dấu nhắc) — chuyển sang <span class="status-chip chip-active"><span class="chip-dot"></span>Active</span> ngay khi Claude bắt đầu một lượt',
    "Kanban Board": "Bảng Kanban",
    "A <em>Main Agent</em> card in the <strong>Waiting</strong> column until you type your first message; flips to <em>Working</em> on <code>UserPromptSubmit</code> / <code>PreToolUse</code> and back to <em>Waiting</em> after each <code>Stop</code>":
      "Một thẻ <em>Main Agent</em> nằm ở cột <strong>Waiting</strong> cho đến khi bạn nhập tin nhắn đầu tiên; chuyển sang <em>Working</em> khi có <code>UserPromptSubmit</code> / <code>PreToolUse</code> và trở lại <em>Waiting</em> sau mỗi <code>Stop</code>",
    "Activity Feed": "Luồng hoạt động",
    'Events streaming in; click any row to expand payload, use "Session →" to drill into session details':
      "Các sự kiện liên tục truyền vào; nhấp vào bất kỳ hàng nào để mở rộng payload, dùng “Session →” để đi sâu vào chi tiết phiên",
    Dashboard: "Bảng điều khiển",
    "Stats updating in real-time": "Số liệu thống kê cập nhật theo thời gian thực",
    "Start server before Claude Code": "Khởi động máy chủ trước Claude Code",
    "Hooks only fire to a running server. If Claude Code was already running when you started the dashboard, restart the Claude Code session.":
      "Hooks chỉ kích hoạt tới một máy chủ đang chạy. Nếu Claude Code đã chạy khi bạn khởi động bảng điều khiển, hãy khởi động lại phiên Claude Code.",
    Variable: "Biến",
    Default: "Mặc định",
    Description: "Mô tả",
    "Port the Express server listens on": "Cổng mà máy chủ Express lắng nghe",
    "Port used by the hook handler to reach the server (for custom port setups)":
      "Cổng mà trình xử lý hook dùng để kết nối đến máy chủ (dành cho cấu hình cổng tùy chỉnh)",
    "Base URL used by the local MCP server when calling dashboard APIs":
      "URL gốc mà máy chủ MCP cục bộ dùng khi gọi các API của bảng điều khiển",
    "MCP transport mode: <code>stdio</code>, <code>http</code>, <code>repl</code>":
      "Chế độ truyền tải MCP: <code>stdio</code>, <code>http</code>, <code>repl</code>",
    "Port for the MCP HTTP+SSE server (only when <code>MCP_TRANSPORT=http</code>)":
      "Cổng cho máy chủ MCP HTTP+SSE (chỉ khi <code>MCP_TRANSPORT=http</code>)",
    "Bind address for the MCP HTTP server": "Địa chỉ bind cho máy chủ MCP HTTP",
    "Path to the SQLite database file": "Đường dẫn tới tệp cơ sở dữ liệu SQLite",
    "Set to <code>0</code> to disable the dead-session liveness reap — the watchdog completes active sessions with no running <code>claude</code> process; auto-disabled on Windows and in containers":
      "Đặt <code>0</code> để tắt cơ chế thu dọn phiên đã chết — watchdog sẽ hoàn tất các phiên đang hoạt động không còn tiến trình <code>claude</code> nào chạy; tự động tắt trên Windows và trong container",
    "Idle gate for watchdog-tick liveness reaps — the transcript must not have been written for at least this long (last hook write is the fallback clock); startup passes skip the gate":
      "Ngưỡng nhàn rỗi cho thu dọn ở nhịp watchdog — transcript phải không được ghi trong ít nhất khoảng này (lấy lần ghi hook cuối làm đồng hồ dự phòng); các lượt thu dọn lúc khởi động bỏ qua ngưỡng này",
    "Idle-working timeout the watchdog uses to recover an <code>Esc</code> cancel that left no transcript marker":
      "Thời gian chờ làm-việc-rảnh-rỗi mà watchdog dùng để khôi phục một lần hủy <code>Esc</code> không để lại dấu hiệu trong bản ghi",
    "Poll interval for the background sync of <code>~/.claude/projects</code>; <code>0</code> disables the poll but keeps the filesystem watcher":
      "Khoảng thời gian thăm dò cho việc đồng bộ nền của <code>~/.claude/projects</code>; <code>0</code> tắt thăm dò nhưng vẫn giữ trình theo dõi hệ thống tệp",
    "Set to <code>production</code> to serve built client from <code>client/dist/</code>":
      "Đặt thành <code>production</code> để phục vụ client đã build từ <code>client/dist/</code>",
    "The server writes the following to <code>~/.claude/settings.json</code> on every startup:":
      "Máy chủ ghi nội dung sau vào <code>~/.claude/settings.json</code> mỗi khi khởi động:",
    "Existing hooks are preserved. The installer only adds or updates entries containing <code>hook-handler.js</code>.":
      "Các hooks hiện có được giữ nguyên. Trình cài đặt chỉ thêm hoặc cập nhật các mục có chứa <code>hook-handler.js</code>.",
    Script: "Script",
    Command: "Lệnh",
    "Install all dependencies (server + client)": "Cài đặt tất cả phụ thuộc (máy chủ + client)",
    "Start server + client in development mode with hot reload":
      "Khởi động máy chủ + client ở chế độ phát triển với hot reload",
    "Start only the Express server with <code>--watch</code>":
      "Chỉ khởi động máy chủ Express với <code>--watch</code>",
    "Start only the Vite dev server": "Chỉ khởi động máy chủ phát triển Vite",
    "TypeScript check + Vite production build to <code>client/dist/</code>":
      "Kiểm tra TypeScript + build production bằng Vite vào <code>client/dist/</code>",
    "Start Express in production mode serving built client":
      "Khởi động Express ở chế độ production để phục vụ client đã build",
    "Manually write Claude Code hooks to <code>~/.claude/settings.json</code>":
      "Ghi thủ công các hook của Claude Code vào <code>~/.claude/settings.json</code>",
    "Insert demo sessions, agents, and events (8 sessions / 23 agents / 106 events)":
      "Chèn các phiên, agent và sự kiện mẫu (8 phiên / 23 agent / 106 sự kiện)",
    "Import historical Claude Code sessions from <code>~/.claude</code> with deep JSONL extraction (API errors, turn durations, thinking blocks, subagent data)":
      "Nhập các phiên Claude Code trong lịch sử từ <code>~/.claude</code> với trích xuất JSONL sâu (lỗi API, thời lượng lượt, khối suy nghĩ, dữ liệu subagent)",
    "Delete all data from the database (keeps schema)":
      "Xóa toàn bộ dữ liệu khỏi cơ sở dữ liệu (giữ lại schema)",
    "Run all server and client tests": "Chạy tất cả các bài kiểm thử của máy chủ và client",
    "Server integration tests only (Node built-in test runner)":
      "Chỉ kiểm thử tích hợp máy chủ (trình chạy kiểm thử tích hợp sẵn của Node)",
    "Client unit tests only (Vitest + Testing Library)":
      "Chỉ kiểm thử đơn vị của client (Vitest + Testing Library)",
    "Install dependencies for the local MCP package under <code>mcp/</code>":
      "Cài đặt phụ thuộc cho gói MCP cục bộ tại <code>mcp/</code>",
    "Type-check MCP source without emitting build output":
      "Kiểm tra kiểu của mã nguồn MCP mà không tạo ra kết quả build",
    "Compile MCP server into <code>mcp/build/</code>":
      "Biên dịch máy chủ MCP vào <code>mcp/build/</code>",
    "Start MCP server (stdio transport — for MCP hosts)":
      "Khởi động máy chủ MCP (truyền tải stdio — dành cho các host MCP)",
    "Start MCP HTTP+SSE server on port 8819 (Streamable HTTP + legacy SSE)":
      "Khởi động máy chủ MCP HTTP+SSE trên cổng 8819 (Streamable HTTP + SSE kiểu cũ)",
    "Start interactive MCP REPL with tab completion and colored output":
      "Khởi động MCP REPL tương tác với tính năng hoàn thành bằng tab và đầu ra có màu",
    "Run MCP server in dev mode with <code>tsx</code> (stdio)":
      "Chạy máy chủ MCP ở chế độ dev với <code>tsx</code> (stdio)",
    "Run MCP HTTP server in dev mode with <code>tsx</code>":
      "Chạy máy chủ MCP HTTP ở chế độ dev với <code>tsx</code>",
    "Run MCP REPL in dev mode with <code>tsx</code>":
      "Chạy MCP REPL ở chế độ dev với <code>tsx</code>",
    "Build MCP container image with Docker (<code>agent-dashboard-mcp:local</code>)":
      "Build image container MCP bằng Docker (<code>agent-dashboard-mcp:local</code>)",
    "Build MCP container image with Podman (<code>localhost/agent-dashboard-mcp:local</code>)":
      "Build image container MCP bằng Podman (<code>localhost/agent-dashboard-mcp:local</code>)",
    "Run MCP server unit tests": "Chạy các bài kiểm thử đơn vị của máy chủ MCP",
    "Install Electron + electron-builder under <code>desktop/</code>; rebuilds <code>better-sqlite3</code> for Electron's ABI. Preflights the native <code>better-sqlite3</code> build; prints actionable setup help (incl. a no-toolchain alternative) on failure":
      "Cài đặt Electron + electron-builder tại <code>desktop/</code>; build lại <code>better-sqlite3</code> cho ABI của Electron. Tiền kiểm tra quá trình build <code>better-sqlite3</code> gốc; in ra hướng dẫn thiết lập khả thi (bao gồm một giải pháp thay thế không cần toolchain) khi thất bại",
    "Prebuild guard + <code>tsc</code> compile of the Electron main process into <code>desktop/out/</code>":
      "Kiểm tra trước khi build + biên dịch tiến trình chính Electron bằng <code>tsc</code> vào <code>desktop/out/</code>",
    "Build, then launch the desktop app against <code>desktop/out/main.js</code>":
      "Build, sau đó khởi chạy ứng dụng desktop dựa trên <code>desktop/out/main.js</code>",
    "Desktop smoke test — spawn Electron and probe <code>/api/health</code>":
      "Kiểm thử smoke cho desktop — khởi chạy Electron và thăm dò <code>/api/health</code>",
    "Build a <strong>universal</strong> (x64 + arm64) DMG. Correct for release — intentionally slow":
      "Build một DMG <strong>universal</strong> (x64 + arm64). Đúng cho việc phát hành — cố ý chậm",
    "Build an Apple-Silicon-only DMG — fast (~1 min), recommended for a single machine":
      "Build một DMG chỉ dành cho Apple Silicon — nhanh (~1 phút), khuyến nghị cho một máy duy nhất",
    "Build an Intel-only DMG — fast (macOS host)":
      "Build một DMG chỉ dành cho Intel — nhanh (host macOS)",
    "Build the Windows NSIS installer <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> (Windows host)":
      "Build trình cài đặt Windows NSIS <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> (host Windows)",
    "Build the no-install portable <code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code> (Windows host)":
      "Build phiên bản portable không cần cài <code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code> (host Windows)",
    "Regenerate <code>desktop/assets/icon.ico</code> from <code>icon.png</code> (PowerShell + .NET; Windows host)":
      "Tạo lại <code>desktop/assets/icon.ico</code> từ <code>icon.png</code> (PowerShell + .NET; host Windows)",
    "Format all files with Prettier": "Định dạng tất cả các tệp bằng Prettier",
    "Check formatting without writing": "Kiểm tra định dạng mà không ghi",
    "Core dashboard telemetry is composed of three processes (Claude hook source, dashboard server, browser UI). When the local MCP sidecar is enabled, it integrates with the same dashboard API via stdio, HTTP+SSE, or interactive REPL transport.":
      "Phép đo từ xa cốt lõi của dashboard gồm ba tiến trình (nguồn hook Claude, máy chủ dashboard, giao diện trình duyệt). Khi sidecar MCP cục bộ được bật, nó tích hợp với cùng một dashboard API qua stdio, HTTP+SSE, hoặc phương thức truyền tải REPL tương tác.",
    "Full system architecture — Claude Code process → Hook Layer → Server → Browser":
      "Kiến trúc hệ thống đầy đủ — tiến trình Claude Code → Lớp Hook → Máy chủ → Trình duyệt",
    "Agent status transitions driven by hook events. <code>waiting</code> is a real persisted status — agents start as <code>waiting</code> and return to it after each turn. Error recovery requires active user retry (<code>UserPromptSubmit</code> or <code>PreToolUse</code>). A background watchdog detects API errors in transcripts every 15 s. The same watchdog also recovers <code>Esc</code>-cancelled turns — via either the transcript <code>[Request interrupted by user]</code> marker or the idle-working timeout when <code>Esc</code> preceded any output — and moves the session to Waiting.":
      "Các chuyển trạng thái của agent được điều khiển bởi các sự kiện hook. <code>waiting</code> là một trạng thái được lưu trữ thực sự — các agent bắt đầu ở trạng thái <code>waiting</code> và quay lại trạng thái đó sau mỗi lượt. Việc khôi phục lỗi đòi hỏi người dùng chủ động thử lại (<code>UserPromptSubmit</code> hoặc <code>PreToolUse</code>). Một watchdog chạy nền phát hiện lỗi API trong bản ghi mỗi 15 s. Cùng watchdog đó cũng khôi phục các lượt bị hủy bằng <code>Esc</code> — thông qua dấu hiệu <code>[Request interrupted by user]</code> trong bản ghi hoặc thời gian chờ làm-việc-rảnh-rỗi khi <code>Esc</code> diễn ra trước bất kỳ đầu ra nào — và chuyển phiên sang Waiting.",
    "Session status lifecycle. <code>waiting</code> is a UI overlay — persisted as <code>active</code> with <code>awaiting_input_since</code> set. <code>SessionEnd</code> preserves error state. Error recovery requires <code>UserPromptSubmit</code> or <code>PreToolUse</code>. The watchdog also recovers <code>Esc</code>-cancelled turns (marker or idle-timeout path) and moves the session to Waiting.":
      "Vòng đời trạng thái của phiên. <code>waiting</code> là một lớp phủ giao diện — được lưu trữ dưới dạng <code>active</code> với <code>awaiting_input_since</code> đã được đặt. <code>SessionEnd</code> giữ nguyên trạng thái lỗi. Việc khôi phục lỗi đòi hỏi <code>UserPromptSubmit</code> hoặc <code>PreToolUse</code>. Watchdog cũng khôi phục các lượt bị hủy bằng <code>Esc</code> (đường dấu hiệu hoặc đường chờ rảnh-rỗi) và chuyển phiên sang Waiting.",
    "Complete event ingestion from hook fire to browser re-render":
      "Quy trình thu nhận sự kiện hoàn chỉnh từ khi hook kích hoạt đến khi trình duyệt render lại",
    "Initial load + WebSocket subscription lifecycle": "Tải ban đầu + vòng đời đăng ký WebSocket",
    "Server module dependency graph": "Đồ thị phụ thuộc giữa các module của máy chủ",
    Module: "Mô-đun",
    Responsibility: "Trách nhiệm",
    "Express app setup, middleware (CORS, JSON 1MB limit), route mounting, static serving in production, HTTP server, auto-hook installation on startup":
      "Thiết lập ứng dụng Express, middleware (CORS, giới hạn JSON 1MB), gắn kết route, phục vụ tệp tĩnh trong môi trường production, máy chủ HTTP, tự động cài đặt hook khi khởi động",
    "SQLite connection, WAL/FK pragmas, schema migrations (<code >CREATE TABLE IF NOT EXISTS</code >), all prepared statements as a reusable <code>stmts</code> object. Tries <code>better-sqlite3</code> first, falls back to built-in <code>node:sqlite</code> via <code>compat-sqlite.js</code>":
      "Kết nối SQLite, các pragma WAL/FK, di trú schema (<code >CREATE TABLE IF NOT EXISTS</code >), tất cả các câu lệnh đã chuẩn bị dưới dạng một đối tượng <code>stmts</code> có thể tái sử dụng. Thử <code>better-sqlite3</code> trước, quay về <code>node:sqlite</code> tích hợp sẵn qua <code>compat-sqlite.js</code>",
    "Compatibility wrapper giving Node.js built-in <code>node:sqlite</code> (<code>DatabaseSync</code>) the same API as <code>better-sqlite3</code> — pragma, transaction, prepare. Used as automatic fallback on Node 22+":
      "Lớp bao tương thích giúp <code>node:sqlite</code> tích hợp sẵn của Node.js (<code>DatabaseSync</code>) có cùng API với <code>better-sqlite3</code> — pragma, transaction, prepare. Được dùng làm phương án dự phòng tự động trên Node 22+",
    "WebSocket server on <code>/ws</code> path, 30s ping/pong heartbeat, typed <code>broadcast(type, data)</code> function":
      "Máy chủ WebSocket trên đường dẫn <code>/ws</code>, nhịp tim ping/pong 30s, hàm <code>broadcast(type, data)</code> có kiểu",
    "Core event processing inside SQLite transactions. Auto-creates sessions/agents. Switch-case dispatch by hook type. Extracts token usage from Stop events.":
      "Xử lý sự kiện cốt lõi bên trong các giao dịch SQLite. Tự động tạo phiên/agent. Phân phối theo switch-case dựa trên loại hook. Trích xuất mức sử dụng token từ các sự kiện Stop.",
    "CRUD with pagination. GET includes agent count via LEFT JOIN. POST is idempotent on session ID.":
      "CRUD có phân trang. GET bao gồm số lượng agent qua LEFT JOIN. POST có tính bất biến trên session ID.",
    "CRUD with status/session_id filtering. PATCH broadcasts <code>agent_updated</code>.":
      "CRUD có lọc theo status/session_id. PATCH phát đi <code>agent_updated</code>.",
    "Read-only event listing with session_id filter and pagination.":
      "Danh sách sự kiện chỉ đọc với bộ lọc session_id và phân trang.",
    "Single aggregate query — total/active counts, status distributions, WS connection count.":
      "Một truy vấn tổng hợp duy nhất — số lượng tổng/đang hoạt động, phân bố trạng thái, số kết nối WS.",
    "Extended analytics — token totals, tool usage counts, daily event/session trends, agent type distribution, event type breakdown, average events per session.":
      "Phân tích mở rộng — tổng token, số lần sử dụng công cụ, xu hướng sự kiện/phiên theo ngày, phân bố loại agent, phân tích loại sự kiện, số sự kiện trung bình mỗi phiên.",
    "Model pricing CRUD (list, upsert, delete). Per-session and global cost calculation with pattern-based model matching and specificity sorting.":
      "CRUD định giá mô hình (list, upsert, delete). Tính chi phí theo phiên và toàn cục với việc so khớp mô hình dựa trên mẫu và sắp xếp theo độ cụ thể.",
    "System info (DB size, row counts, hook status, server uptime). Data export as JSON. Session cleanup (abandon stale active sessions, purge old completed sessions). Clear all data. Reset pricing to defaults. Reinstall hooks.":
      "Thông tin hệ thống (kích thước DB, số hàng, trạng thái hook, thời gian hoạt động của máy chủ). Xuất dữ liệu dưới dạng JSON. Dọn dẹp phiên (bỏ các phiên đang hoạt động đã cũ, xóa các phiên đã hoàn tất cũ). Xóa toàn bộ dữ liệu. Đặt lại định giá về mặc định. Cài đặt lại các hook.",
    "Aggregate workflow visualization data (agent orchestration, tool transitions, collaboration networks, workflow patterns, model delegation, error propagation, concurrency, session complexity, compaction impact). Accepts <code>?status=active|completed</code> filter. Per-session drill-in with agent tree, tool timeline, and events.":
      "Dữ liệu trực quan hóa luồng công việc tổng hợp (điều phối agent, chuyển tiếp công cụ, mạng lưới cộng tác, các mẫu luồng công việc, ủy quyền mô hình, lan truyền lỗi, tính đồng thời, độ phức tạp của phiên, tác động của việc nén). Chấp nhận bộ lọc <code>?status=active|completed</code>. Đi sâu theo từng phiên với cây agent, dòng thời gian công cụ và các sự kiện.",
    "React component tree": "Cây thành phần React",
    Purpose: "Mục đích",
    "<code>lib/api.ts</code>": "<code>lib/api.ts</code>",
    "Typed fetch wrapper — one method per REST endpoint. All return typed promises.":
      "Trình bao bọc fetch có kiểu — mỗi điểm cuối REST một phương thức. Tất cả đều trả về promise có kiểu.",
    "<code>lib/types.ts</code>": "<code>lib/types.ts</code>",
    "TypeScript interfaces: <code>Session</code>, <code>Agent</code>, <code>DashboardEvent</code>, <code>Stats</code>, <code>Analytics</code>, <code>WSMessage</code>, plus all workflow-related types (<code>WorkflowData</code>, <code>SessionDrillIn</code>, etc). Status config maps.":
      "Các interface TypeScript: <code>Session</code>, <code>Agent</code>, <code>DashboardEvent</code>, <code>Stats</code>, <code>Analytics</code>, <code>WSMessage</code>, cùng tất cả các kiểu liên quan đến quy trình làm việc (<code>WorkflowData</code>, <code>SessionDrillIn</code>, v.v.). Cùng các bản đồ cấu hình trạng thái.",
    "<code>lib/eventBus.ts</code>": "<code>lib/eventBus.ts</code>",
    "Set-based pub/sub. <code>subscribe(fn)</code> returns an unsubscribe function for clean useEffect teardown.":
      "Pub/sub dựa trên Set. <code>subscribe(fn)</code> trả về một hàm hủy đăng ký để dọn dẹp useEffect gọn gàng.",
    "<code>lib/format.ts</code>": "<code>lib/format.ts</code>",
    "Date/time formatting helpers — relative time, duration, ISO display.":
      "Các hàm trợ giúp định dạng ngày/giờ — thời gian tương đối, thời lượng, hiển thị ISO.",
    "<code>hooks/useWebSocket.ts</code>": "<code>hooks/useWebSocket.ts</code>",
    "Auto-reconnecting WebSocket React hook. 2-second reconnect interval. Publishes messages to eventBus.":
      "React hook WebSocket tự động kết nối lại. Khoảng thời gian kết nối lại 2 giây. Phát các tin nhắn tới eventBus.",
    "The dashboard is a Progressive Web App with its own <code>manifest.json</code> and Service Worker (<code>client/public/sw.js</code>). The landing page and wiki are also independent PWAs with separate manifests and service workers.":
      "Bảng điều khiển là một Progressive Web App với <code>manifest.json</code> và Service Worker riêng (<code>client/public/sw.js</code>). Trang đích và wiki cũng là các PWA độc lập với các manifest và service worker riêng biệt.",
    Surface: "Bề mặt",
    Manifest: "Manifest",
    "Service Worker": "Service Worker",
    Strategy: "Chiến lược",
    "<code>client/public/manifest.json</code>": "<code>client/public/manifest.json</code>",
    "<code>client/public/sw.js</code>": "<code>client/public/sw.js</code>",
    "Precaches app shell. Cache-first for static assets (JS/CSS bundles). Network-first for navigation with offline fallback. Skips <code>/api/*</code>, <code>/ws</code>, and Vite HMR. Preserves push notification handlers.":
      "Tiền lưu vỏ ứng dụng. Ưu tiên cache cho tài nguyên tĩnh (gói JS/CSS). Ưu tiên mạng cho điều hướng với phương án dự phòng ngoại tuyến. Bỏ qua <code>/api/*</code>, <code>/ws</code> và Vite HMR. Bảo toàn các trình xử lý thông báo đẩy.",
    "Landing page": "Trang đích",
    "<code>manifest.json</code> (root)": "<code>manifest.json</code> (gốc)",
    "<code>sw.js</code> (root)": "<code>sw.js</code> (gốc)",
    "Precaches HTML shell, favicon, OG image. Lazy-caches screenshot PNGs on first view. Network-first HTML, cache-first assets.":
      "Tiền lưu vỏ HTML, favicon, ảnh OG. Lưu cache lười các ảnh PNG chụp màn hình khi xem lần đầu. HTML ưu tiên mạng, tài nguyên ưu tiên cache.",
    Wiki: "Wiki",
    "<code>wiki/manifest.json</code>": "<code>wiki/manifest.json</code>",
    "<code>wiki/sw.js</code>": "<code>wiki/sw.js</code>",
    "Precaches <code>index.html</code>, <code>style.css</code>, <code>script.js</code>. Fully offline after one visit.":
      "Tiền lưu <code>index.html</code>, <code>style.css</code>, <code>script.js</code>. Hoàn toàn ngoại tuyến sau một lần truy cập.",
    'All three SWs call <code>skipWaiting()</code> on install and delete stale caches on activate (keyed by version strings like <code>dashboard-v1</code>). Manifests use SVG icons (<code>favicon.svg</code>) with <code>sizes="any"</code>. iOS standalone mode is enabled via <code>apple-mobile-web-app-capable</code> meta tags.':
      'Cả ba SW đều gọi <code>skipWaiting()</code> khi cài đặt và xóa các cache cũ khi kích hoạt (được khóa bằng các chuỗi phiên bản như <code>dashboard-v1</code>). Các manifest sử dụng biểu tượng SVG (<code>favicon.svg</code>) với <code>sizes="any"</code>. Chế độ độc lập trên iOS được bật thông qua các thẻ meta <code>apple-mobile-web-app-capable</code>.',
    "The client deliberately avoids Redux / Zustand / Context. Each page owns its data and lifecycle. WebSocket events trigger a reload or append — no complex state merging.":
      "Phía client cố ý tránh dùng Redux / Zustand / Context. Mỗi trang sở hữu dữ liệu và vòng đời của riêng nó. Các sự kiện WebSocket kích hoạt việc tải lại hoặc nối thêm — không có việc hợp nhất trạng thái phức tạp.",
    "No global store — by design": "Không có kho lưu trữ toàn cục — đây là chủ ý thiết kế",
    "There is no cross-page shared state. Each page fetches and owns exactly the data it displays. This simplifies debugging and avoids stale-closure hazards that are common with global stores in long-running WebSocket apps.":
      "Không có trạng thái chia sẻ giữa các trang. Mỗi trang lấy và sở hữu chính xác dữ liệu mà nó hiển thị. Điều này đơn giản hóa việc gỡ lỗi và tránh được các nguy cơ stale-closure thường gặp với các kho lưu trữ toàn cục trong những ứng dụng WebSocket chạy lâu dài.",
    Index: "Chỉ mục",
    Table: "Bảng",
    "Column(s)": "Cột",
    "Fast agent lookup by session": "Tra cứu nhanh agent theo phiên",
    "Kanban column queries": "Truy vấn cột Kanban",
    "Session detail event list": "Danh sách sự kiện chi tiết phiên",
    "Filter events by type": "Lọc sự kiện theo loại",
    "Activity feed ordering": "Sắp xếp luồng hoạt động",
    "Status filter on sessions page": "Bộ lọc trạng thái trên trang phiên",
    "Default sort order": "Thứ tự sắp xếp mặc định",
    Pragma: "Pragma",
    Value: "Giá trị",
    Rationale: "Lý do",
    "Concurrent reads during writes. Far better for read-heavy dashboards.":
      "Đọc đồng thời trong khi ghi. Tốt hơn nhiều cho các bảng điều khiển nặng về đọc.",
    "Referential integrity — prevents orphaned agents/events.":
      "Toàn vẹn tham chiếu — ngăn chặn các agent/sự kiện mồ côi.",
    "Wait up to 5s for write lock instead of failing immediately under load.":
      "Chờ tối đa 5s để có khóa ghi thay vì lỗi ngay lập tức khi chịu tải.",
    'All endpoints return JSON. Errors follow <code>{ "error": { "code", "message" } }</code>. The OpenAPI 3.0 spec comprehensively documents every backend route - parameters, request/response schemas, field descriptions, and examples. It is served at <code>/api/openapi.json</code> (with a committed <code>openapi.yaml</code> mirror), rendered as interactive Swagger UI at <code>/api/docs</code>, and as a clean, read-optimized ReDoc reference at <code>/api/redoc</code>. ReDoc is self-hosted, so it works fully offline.':
      'Tất cả các điểm cuối đều trả về JSON. Lỗi tuân theo định dạng <code>{ "error": { "code", "message" } }</code>. Đặc tả OpenAPI 3.0 ghi lại toàn diện mọi tuyến backend - tham số, lược đồ yêu cầu/phản hồi, mô tả từng trường và ví dụ. Nó được phục vụ tại <code>/api/openapi.json</code> (kèm bản sao <code>openapi.yaml</code> đã commit), hiển thị dưới dạng Swagger UI tương tác tại <code>/api/docs</code>, và dưới dạng tài liệu tham khảo ReDoc gọn gàng, tối ưu cho việc đọc tại <code>/api/redoc</code>. ReDoc được tự lưu trữ cục bộ nên hoạt động hoàn toàn ngoại tuyến.',
    '<span class="caption-icon">📘</span> <span>Swagger UI at <code>/api/docs</code> — auto-generated interactive playground for every REST endpoint. Try-it-out forms, request/response schema, auth headers, and curl snippets</span>':
      '<span class="caption-icon">📘</span> <span>Swagger UI tại <code>/api/docs</code> — sân chơi tương tác được tạo tự động cho mọi điểm cuối REST. Biểu mẫu dùng thử, lược đồ yêu cầu/phản hồi, tiêu đề xác thực và đoạn mã curl</span>',
    Property: "Thuộc tính",
    Path: "Đường dẫn",
    Protocol: "Giao thức",
    "Standard WebSocket (RFC 6455)": "WebSocket tiêu chuẩn (RFC 6455)",
    Heartbeat: "Nhịp tim",
    "Server pings every 30s — clients that don't pong are terminated":
      "Máy chủ ping mỗi 30s — các client không phản hồi pong sẽ bị chấm dứt",
    Reconnect: "Kết nối lại",
    "Client retries every 2 seconds on disconnect": "Client thử lại mỗi 2 giây khi mất kết nối",
    "Client WebSocket auto-reconnect state machine":
      "Máy trạng thái tự động kết nối lại WebSocket của client",
    "<code>scripts/hook-handler.js</code> is a minimal, fail-safe forwarder. It always exits 0 so it can never block Claude Code regardless of server state.":
      "<code>scripts/hook-handler.js</code> là một bộ chuyển tiếp tối giản, an toàn khi lỗi. Nó luôn thoát với mã 0 nên không bao giờ có thể chặn Claude Code bất kể trạng thái máy chủ.",
    "hook-handler.js flow — always exits 0, never blocks Claude Code":
      "Luồng hook-handler.js — luôn thoát với mã 0, không bao giờ chặn Claude Code",
    "Hook installation is idempotent — safe to run multiple times":
      "Việc cài đặt hook là bất biến (idempotent) — an toàn khi chạy nhiều lần",
    '<span class="caption-icon">📥</span> <span>Settings → Import History — rescan default paths, set a custom directory, or drag-and-drop <code>.gz</code> archives. Progress bar and result card show counts for every run</span>':
      '<span class="caption-icon">📥</span> <span>Settings → Import History — quét lại các đường dẫn mặc định, đặt thư mục tùy chỉnh, hoặc kéo-thả các tệp lưu trữ <code>.gz</code>. Thanh tiến trình và thẻ kết quả hiển thị số lượng cho mỗi lần chạy</span>',
    "The dashboard ships with a first-class <b>history importer</b> that backfills sessions, agents, events, tokens, and costs from Claude Code JSONL transcripts. Live hook ingestion and manual import share the exact same parser — <code>parseSessionFile</code> + <code>importSession</code> in <code>scripts/import-history.js</code> — which is the architectural contract that guarantees imported token totals and cost values are identical to those captured in real time. Re-imports are idempotent: session IDs are the dedup key and compaction <code>baseline_*</code> columns preserve pre-compaction token totals.":
      "Bảng điều khiển đi kèm một <b>trình nhập lịch sử</b> hạng nhất, giúp bổ sung dữ liệu phiên, tác tử, sự kiện, token và chi phí từ các bản ghi JSONL của Claude Code. Việc thu nhận qua hook trực tiếp và nhập thủ công dùng chung chính xác cùng một bộ phân tích — <code>parseSessionFile</code> + <code>importSession</code> trong <code>scripts/import-history.js</code> — đây là giao kèo kiến trúc bảo đảm tổng số token và giá trị chi phí được nhập vào giống hệt với những gì được ghi nhận theo thời gian thực. Việc nhập lại là idempotent: ID phiên là khóa khử trùng lặp và các cột nén <code>baseline_*</code> giữ lại tổng số token trước khi nén.",
    "All three modes funnel into the same parser and DB transaction — imported numbers match live capture bit-for-bit":
      "Cả ba chế độ đều dồn vào cùng một bộ phân tích và giao dịch CSDL — các con số được nhập khớp với bản ghi trực tiếp theo từng bit",
    "Upload path: multipart → safe extract → walk → parse → import — every temp dir reclaimed in <code>finally</code>":
      "Đường dẫn tải lên: multipart → giải nén an toàn → duyệt → phân tích → nhập — mọi thư mục tạm đều được thu hồi trong <code>finally</code>",
    "The <code>baseline_*</code> columns make cost monotonic under re-imports — compacted sessions retain pre-compaction usage for billing":
      "Các cột <code>baseline_*</code> giúp chi phí đơn điệu khi nhập lại — các phiên đã nén vẫn giữ lại mức sử dụng trước khi nén để tính phí",
    Layout: "Bố cục",
    Example: "Ví dụ",
    Handling: "Cách xử lý",
    "Default Claude Code": "Claude Code mặc định",
    "Session transcript — extracts tokens, compactions, tool uses, turn durations":
      "Bản ghi phiên — trích xuất token, các lần nén, lượt dùng công cụ, thời lượng từng lượt",
    "Default subagent": "Tác tử con mặc định",
    "Paired with parent on discovery via <code>findSessionSubagents</code>":
      "Được ghép với tác tử cha khi phát hiện thông qua <code>findSessionSubagents</code>",
    "Alternative subagent": "Tác tử con thay thế",
    "Paired with parent on discovery (second layout probed automatically)":
      "Được ghép với tác tử cha khi phát hiện (bố cục thứ hai được dò tự động)",
    "Orphan subagent": "Tác tử con mồ côi",
    "No parent JSONL in source, but <code>sid</code> exists in DB":
      "Không có JSONL cha trong nguồn, nhưng <code>sid</code> tồn tại trong CSDL",
    "<code>importFromDirectory</code> probes both layouts; attaches if the parent is found":
      "<code>importFromDirectory</code> dò cả hai bố cục; gắn kết nếu tìm thấy tác tử cha",
    "Flat JSONL drop": "Thả JSONL phẳng",
    "Recognized as a loose session transcript": "Được nhận diện như một bản ghi phiên rời rạc",
    Archives: "Tệp lưu trữ",
    "Extracted into a per-request temp dir, then walked by the same importer":
      "Được giải nén vào một thư mục tạm cho mỗi yêu cầu, rồi được cùng trình nhập duyệt qua",
    "Single-file gzip": "gzip tệp đơn",
    "Gunzipped in streaming mode with running byte-counter size cap":
      "Được giải nén gzip ở chế độ luồng với giới hạn kích thước bằng bộ đếm byte đang chạy",
    Threat: "Mối đe dọa",
    Mitigation: "Biện pháp giảm thiểu",
    "Path traversal via archive entries": "Đi xuyên đường dẫn qua các mục trong tệp lưu trữ",
    "<code>archive.safeJoin</code> resolves under the extraction root; any <code>..</code> or absolute path returns <code>null</code>":
      "<code>archive.safeJoin</code> phân giải bên dưới gốc giải nén; bất kỳ <code>..</code> hoặc đường dẫn tuyệt đối nào đều trả về <code>null</code>",
    "Zip / tar / gzip bombs": "Bom Zip / tar / gzip",
    "<code>MAX_EXTRACT_BYTES</code> (default 4 GB) enforced by running byte counter; aborts with <code>ExtractionLimitError</code> → HTTP 413":
      "<code>MAX_EXTRACT_BYTES</code> (mặc định 4 GB) được thực thi bằng bộ đếm byte đang chạy; hủy bỏ với <code>ExtractionLimitError</code> → HTTP 413",
    "Per-file upload size abuse": "Lạm dụng kích thước tải lên cho từng tệp",
    "multer <code>limits.fileSize = MAX_UPLOAD_BYTES</code> (default 1 GB)":
      "multer <code>limits.fileSize = MAX_UPLOAD_BYTES</code> (mặc định 1 GB)",
    "Too many files per request": "Quá nhiều tệp trong mỗi yêu cầu",
    "multer <code>limits.files = MAX_UPLOAD_FILES</code> (default 2000)":
      "multer <code>limits.files = MAX_UPLOAD_FILES</code> (mặc định 2000)",
    "Unsupported file types": "Loại tệp không được hỗ trợ",
    "<code>fileFilter</code> drops them early and reports them in <code>rejected_files[]</code>":
      "<code>fileFilter</code> loại bỏ chúng sớm và báo cáo chúng trong <code>rejected_files[]</code>",
    "Concurrent upload temp-dir collisions": "Xung đột thư mục tạm khi tải lên đồng thời",
    "Per-request temp dir on <code>req._ccamUploadDir</code>; created in multer <code>destination</code>, reclaimed in <code>finally</code>":
      "Thư mục tạm cho mỗi yêu cầu trên <code>req._ccamUploadDir</code>; được tạo trong multer <code>destination</code>, được thu hồi trong <code>finally</code>",
    "Arbitrary absolute path on <code>scan-path</code>":
      "Đường dẫn tuyệt đối tùy ý trên <code>scan-path</code>",
    "Validated: must be absolute (after <code>~</code> expansion), exist, and be a directory":
      "Được kiểm tra: phải là tuyệt đối (sau khi mở rộng <code>~</code>), tồn tại và là một thư mục",
    "Relative / traversal paths on <code>scan-path</code>":
      "Đường dẫn tương đối / đi xuyên trên <code>scan-path</code>",
    "Rejected with <code>INVALID_INPUT</code>": "Bị từ chối với <code>INVALID_INPUT</code>",
    "Maximum size per uploaded file on <code>/api/import/upload</code>":
      "Kích thước tối đa cho mỗi tệp tải lên trên <code>/api/import/upload</code>",
    "Maximum files per upload request": "Số tệp tối đa cho mỗi yêu cầu tải lên",
    "Ceiling on total uncompressed bytes from any single archive (zip-bomb defense)":
      "Trần cho tổng số byte chưa nén từ bất kỳ tệp lưu trữ đơn lẻ nào (phòng vệ bom zip)",
    "Every import emits <code>import.progress</code> messages on <code>/ws</code>. Messages are throttled to at most one every ~150 ms to avoid flooding the channel on multi-thousand-session imports; the terminal <code>complete</code> and <code>error</code> frames are never throttled.":
      "Mỗi lần nhập đều phát ra các thông điệp <code>import.progress</code> trên <code>/ws</code>. Các thông điệp được điều tiết tối đa một thông điệp mỗi ~150 ms để tránh làm ngập kênh khi nhập hàng nghìn phiên; các khung kết thúc <code>complete</code> và <code>error</code> không bao giờ bị điều tiết.",
    "Phases: <code>start</code> → <code>scan</code> → <code>extract</code> (upload only) → <code>parse</code> → <code>complete</code>, with <code>error</code> / <code>extract_error</code> replacing <code>complete</code> on failure.":
      "Các giai đoạn: <code>start</code> → <code>scan</code> → <code>extract</code> (chỉ khi tải lên) → <code>parse</code> → <code>complete</code>, với <code>error</code> / <code>extract_error</code> thay thế <code>complete</code> khi thất bại.",
    "In addition to dashboard telemetry, this project includes a production-grade local MCP server and complete extension scaffolding for both Claude Code and Codex. This gives agents a richer local tool surface while keeping all execution local-first. The MCP server supports three transport modes: stdio for host integration, HTTP+SSE for remote clients, and an interactive REPL for operator debugging.":
      "Ngoài dữ liệu đo từ xa của bảng điều khiển, dự án này còn bao gồm một máy chủ MCP cục bộ cấp sản xuất và bộ khung mở rộng hoàn chỉnh cho cả Claude Code và Codex. Điều này mang lại cho các tác tử một bề mặt công cụ cục bộ phong phú hơn trong khi vẫn giữ mọi thực thi theo nguyên tắc cục bộ trước. Máy chủ MCP hỗ trợ ba chế độ truyền tải: stdio để tích hợp với máy chủ chính, HTTP+SSE cho các máy khách từ xa, và một REPL tương tác để người vận hành gỡ lỗi.",
    '<span class="caption-icon">🔧</span> MCP Server REPL — interactive tool invocation terminal with colored JSON output, argument prompts, error formatting, and session-aware context for rapid testing':
      '<span class="caption-icon">🔧</span> REPL máy chủ MCP — thiết bị đầu cuối gọi công cụ tương tác với đầu ra JSON có màu, lời nhắc tham số, định dạng lỗi và ngữ cảnh nhận biết phiên để kiểm thử nhanh',
    "Local extension architecture: host instructions + skills + multi-transport MCP sidecar":
      "Kiến trúc mở rộng cục bộ: chỉ dẫn cho máy chủ chính + kỹ năng + sidecar MCP đa truyền tải",
    "The <code>mcp/</code> package exposes dashboard-oriented tools for AI agents across three transport modes. Mutation and destructive operations are policy-gated by environment variables and disabled by default. HTTP mode serves both Streamable HTTP (protocol 2025-11-25) and legacy SSE (protocol 2024-11-05). REPL mode provides tab-completed interactive tool invocation with colored output and JSON syntax highlighting.":
      "Gói <code>mcp/</code> cung cấp các công cụ hướng tới bảng điều khiển cho các tác tử AI qua ba chế độ truyền tải. Các thao tác thay đổi và phá hủy được kiểm soát theo chính sách bằng các biến môi trường và bị tắt theo mặc định. Chế độ HTTP phục vụ cả Streamable HTTP (giao thức 2025-11-25) và SSE cũ (giao thức 2024-11-05). Chế độ REPL cung cấp việc gọi công cụ tương tác có hoàn tất bằng Tab với đầu ra có màu và làm nổi bật cú pháp JSON.",
    Component: "Thành phần",
    Location: "Vị trí",
    Notes: "Ghi chú",
    "MCP source": "Mã nguồn MCP",
    "TypeScript server, tools, policy guards, transport layer, CLI UI":
      "Máy chủ TypeScript, các công cụ, bộ bảo vệ chính sách, lớp truyền tải, CLI UI",
    "MCP build output": "Đầu ra build của MCP",
    "Compiled JavaScript runtime for all transport modes":
      "Runtime JavaScript đã biên dịch cho tất cả các chế độ truyền tải",
    "MCP docs": "Tài liệu MCP",
    "Tool catalog, architecture diagrams, host integration examples, REPL guide":
      "Danh mục công cụ, sơ đồ kiến trúc, ví dụ tích hợp máy chủ chính, hướng dẫn REPL",
    "Transport layer": "Lớp truyền tải",
    "HTTP+SSE server, interactive REPL, tool handler collector":
      "Máy chủ HTTP+SSE, REPL tương tác, bộ thu thập trình xử lý công cụ",
    "CLI UI": "CLI UI",
    "ANSI banner, colors, formatter with tables, boxes, JSON highlighting":
      "Biểu ngữ ANSI, màu sắc, bộ định dạng với bảng, hộp, làm nổi bật JSON",
    "Runtime commands": "Lệnh runtime",
    "Start MCP in stdio, HTTP+SSE, or REPL mode (production or dev)":
      "Khởi động MCP ở chế độ stdio, HTTP+SSE hoặc REPL (sản xuất hoặc phát triển)",
    Target: "Mục tiêu",
    Files: "Tệp",
    "Claude Code": "Claude Code",
    "Persistent project instructions + path-scoped coding rules":
      "Chỉ dẫn dự án bền vững + quy tắc lập trình theo phạm vi đường dẫn",
    "Claude Code Skills": "Kỹ năng Claude Code",
    "Reusable workflows (onboarding, shipping, MCP ops, live debugging)":
      "Các quy trình có thể tái sử dụng (làm quen, phát hành, vận hành MCP, gỡ lỗi trực tiếp)",
    "Claude Code Subagents": "Tác tử con Claude Code",
    "Specialized reviewers for backend, frontend, and MCP code paths":
      "Các trình duyệt xét chuyên biệt cho các đường mã backend, frontend và MCP",
    "Codex Base Instructions": "Chỉ dẫn cơ sở Codex",
    "Project-wide guidance + execution policy defaults":
      "Hướng dẫn toàn dự án + các mặc định chính sách thực thi",
    "Codex Skills": "Kỹ năng Codex",
    "Task-specific skills aligned to this repository":
      "Các kỹ năng đặc thù theo tác vụ được căn chỉnh với kho lưu trữ này",
    "Codex Agents": "Tác tử Codex",
    "Reusable custom-agent templates for implementation and review":
      "Các mẫu tác tử tùy chỉnh có thể tái sử dụng cho việc triển khai và rà soát",
    Role: "Vai trò",
    "Receives Claude hook payloads over stdin and forwards them to dashboard API":
      "Nhận payload hook của Claude qua stdin và chuyển tiếp chúng đến API bảng điều khiển",
    "Writes/updates hook registration in <code>~/.claude/settings.json</code>":
      "Ghi/cập nhật đăng ký hook trong <code>~/.claude/settings.json</code>",
    "Batch history importer used by server startup auto-import, the <code>/api/import/*</code> routes, and the <code>import-history</code> CLI. Exposes <code>importAllSessions()</code> for the default projects dir and the generalized <code>importFromDirectory(dbModule, rootDir, {onProgress})</code> which walks any directory recursively, classifies session vs subagent JSONLs (probes both <code>&lt;proj&gt;/&lt;sid&gt;/subagents/*</code> and <code>&lt;proj&gt;/subagents/&lt;sid&gt;/*</code> layouts), and funnels everything through the shared <code>parseSessionFile</code> + <code>importSession</code> pipeline — identical to live ingest. <b>Re-import is fully incremental</b>: a per-event-type high-water mark (<code>MAX(created_at) GROUP BY event_type</code> for the session) drives <code>ts &gt; cutoff[type]</code> dedup for Stop / PostToolUse / TurnDuration / ToolError, so long-running sessions whose transcripts grow across multiple days keep receiving new events on every re-run. <code>sessions.ended_at</code> is rolled forward when the JSONL has progressed past the stored value, and message-count metadata is refreshed on every pass. Session-ID dedup and <code>baseline_*</code> preservation keep token totals stable. Extracts tokens, API errors, turn durations, thinking blocks, usage extras, and per-subagent breakdowns":
      "Trình nhập lịch sử hàng loạt được dùng bởi tính năng tự động nhập khi khởi động máy chủ, các route <code>/api/import/*</code> và CLI <code>import-history</code>. Cung cấp <code>importAllSessions()</code> cho thư mục dự án mặc định và hàm tổng quát <code>importFromDirectory(dbModule, rootDir, {onProgress})</code> duyệt đệ quy bất kỳ thư mục nào, phân loại JSONL phiên với JSONL tác tử con (dò cả hai bố cục <code>&lt;proj&gt;/&lt;sid&gt;/subagents/*</code> và <code>&lt;proj&gt;/subagents/&lt;sid&gt;/*</code>), và đưa mọi thứ qua pipeline dùng chung <code>parseSessionFile</code> + <code>importSession</code> — giống hệt với việc thu nạp trực tiếp. <b>Việc nhập lại hoàn toàn tăng dần</b>: một mốc nước cao theo từng loại sự kiện (<code>MAX(created_at) GROUP BY event_type</code> cho phiên) điều khiển việc khử trùng lặp <code>ts &gt; cutoff[type]</code> cho Stop / PostToolUse / TurnDuration / ToolError, nên các phiên chạy dài có bản ghi tăng trưởng qua nhiều ngày vẫn tiếp tục nhận sự kiện mới ở mỗi lần chạy lại. <code>sessions.ended_at</code> được dời về phía trước khi JSONL đã tiến quá giá trị đã lưu, và siêu dữ liệu đếm tin nhắn được làm mới ở mỗi lượt. Việc khử trùng lặp theo ID phiên và giữ lại <code>baseline_*</code> giữ cho tổng số token ổn định. Trích xuất token, lỗi API, thời lượng lượt, khối suy nghĩ, các phần phụ về sử dụng và phân tích chi tiết theo từng tác tử con",
    "Express router for Import History. Four endpoints: <code>GET /api/import/guide</code> (OS-aware instructions + default-dir stats), <code>POST /api/import/rescan</code> (default <code>~/.claude/projects</code>), <code>POST /api/import/scan-path</code> (arbitrary absolute dir with <code>~</code> expansion), <code>POST /api/import/upload</code> (multer multipart). Each request uses a per-request temp dir reclaimed in <code>finally</code>. Progress broadcast as throttled <code>import.progress</code> WebSocket messages. Limits tunable via <code>CCAM_IMPORT_MAX_BYTES</code>, <code>CCAM_IMPORT_MAX_FILES</code>, <code>CCAM_IMPORT_MAX_EXTRACT_BYTES</code>":
      "Router Express cho Nhập Lịch sử. Bốn endpoint: <code>GET /api/import/guide</code> (hướng dẫn nhận biết hệ điều hành + thống kê thư mục mặc định), <code>POST /api/import/rescan</code> (mặc định <code>~/.claude/projects</code>), <code>POST /api/import/scan-path</code> (thư mục tuyệt đối tùy ý có mở rộng <code>~</code>), <code>POST /api/import/upload</code> (multer multipart). Mỗi yêu cầu dùng một thư mục tạm riêng theo yêu cầu được thu hồi trong <code>finally</code>. Tiến độ được phát đi dưới dạng các tin nhắn WebSocket <code>import.progress</code> bị tiết lưu. Các giới hạn có thể điều chỉnh qua <code>CCAM_IMPORT_MAX_BYTES</code>, <code>CCAM_IMPORT_MAX_FILES</code>, <code>CCAM_IMPORT_MAX_EXTRACT_BYTES</code>",
    "Safe archive extraction: <code>.zip</code> via <code>adm-zip</code>, <code>.tar</code>/<code>.tar.gz</code>/<code>.tgz</code> via <code>tar</code>, plain <code>.gz</code> streaming via <code>zlib</code>. Every entry validated through <code>safeJoin</code> which rejects absolute paths and <code>..</code> traversal before any bytes are written. Enforces a hard <code>MAX_EXTRACT_BYTES</code> cap (default 4 GB) with <code>ExtractionLimitError</code> surfaced as HTTP 413 — defense against zip/tar/gzip bombs":
      "Giải nén kho lưu trữ an toàn: <code>.zip</code> qua <code>adm-zip</code>, <code>.tar</code>/<code>.tar.gz</code>/<code>.tgz</code> qua <code>tar</code>, <code>.gz</code> thuần qua luồng <code>zlib</code>. Mọi mục đều được xác thực qua <code>safeJoin</code>, hàm này từ chối các đường dẫn tuyệt đối và việc duyệt <code>..</code> trước khi ghi bất kỳ byte nào. Áp đặt một mức trần cứng <code>MAX_EXTRACT_BYTES</code> (mặc định 4 GB) với <code>ExtractionLimitError</code> được phơi bày dưới dạng HTTP 413 — phòng vệ chống lại các bom zip/tar/gzip",
    "Loads deterministic demo data for testing and demos":
      "Nạp dữ liệu demo có tính tất định cho việc kiểm thử và trình diễn",
    "Removes persisted rows while preserving schema":
      "Loại bỏ các hàng đã lưu giữ trong khi vẫn bảo toàn lược đồ",
    "The Agent Monitor ships with an official Claude Code plugin marketplace containing ten production-ready plugins (53 skills, 14 agents, 30 slash commands, 3 CLI tools, 3 hook configs, and 1 MCP server). These extend Claude Code with skills, agents, hooks, CLI tools, and MCP integration — all grounded in the real data model (token tracking with compaction baselines, cost calculation via pattern-matched pricing rules, workflow intelligence with 11 datasets per session, and session metadata including thinking blocks, turn counts, and inference geography).":
      "Agent Monitor đi kèm một chợ plugin Claude Code chính thức chứa mười plugin sẵn sàng cho sản xuất (53 kỹ năng, 14 agent, 30 lệnh gạch chéo, 3 công cụ CLI, 3 cấu hình hook và 1 máy chủ MCP). Chúng mở rộng Claude Code bằng các kỹ năng, tác tử, hook, công cụ CLI và tích hợp MCP — tất cả đều dựa trên mô hình dữ liệu thực tế (theo dõi token với các đường cơ sở nén, tính toán chi phí qua các quy tắc định giá khớp mẫu, trí tuệ quy trình với 11 tập dữ liệu mỗi phiên, và siêu dữ liệu phiên bao gồm khối suy nghĩ, số lượt và vị trí địa lý suy luận).",
    Plugin: "Plugin",
    Skills: "Kỹ năng",
    Agent: "Agent",
    "CLI Tools": "Công cụ CLI",
    Focus: "Trọng tâm",
    "Token usage (4 types + baselines), cost via pricing engine, daily trends, productivity scoring":
      "Sử dụng token (4 loại + đường cơ sở), chi phí qua công cụ định giá, xu hướng hằng ngày, chấm điểm năng suất",
    "Standup reports, sprint tracking, workflow optimization via 11 workflow intelligence datasets":
      "Báo cáo standup, theo dõi sprint, tối ưu quy trình qua 11 tập dữ liệu trí tuệ quy trình",
    "Session debugging, hook diagnostics, data export (JSON/CSV), system health":
      "Gỡ lỗi phiên, chẩn đoán hook, xuất dữ liệu (JSON/CSV), tình trạng hệ thống",
    "Pattern detection via tool flow transitions, anomaly alerting, optimization, session comparison":
      "Phát hiện mẫu qua các chuyển tiếp luồng công cụ, cảnh báo bất thường, tối ưu hóa, so sánh phiên",
    "Budget guardrails: set budgets, forecast week/month-end spend, cost-threshold alerts, model-routing savings (fail-safe Stop hook)":
      "Lan can ngân sách: đặt ngân sách, dự báo chi tiêu cuối tuần/cuối tháng, cảnh báo ngưỡng chi phí, tiết kiệm nhờ định tuyến mô hình (Stop hook an toàn khi lỗi)",
    "Session forensics: search, timeline, transcript replay, per-cwd rollup, cleanup":
      "Pháp y phiên: tìm kiếm, dòng thời gian, phát lại transcript, tổng hợp theo cwd, dọn dẹp",
    "Multi-agent orchestration &amp; fleet intelligence: DAG map, delegation audit, concurrency, error propagation, fleet runs (11-dataset workflow intelligence API)":
      "Điều phối đa agent &amp; trí tuệ đội nhóm: bản đồ DAG, kiểm toán ủy quyền, đồng thời, lan truyền lỗi, lần chạy đội nhóm (API trí tuệ quy trình 11 tập dữ liệu)",
    "Reliability &amp; SLOs: error scan, API-error report, hook-failure audit, SLO check, regression alert":
      "Độ tin cậy &amp; SLO: quét lỗi, báo cáo lỗi API, kiểm toán lỗi hook, kiểm tra SLO, cảnh báo hồi quy",
    "Claude Code config &amp; memory governance: config audit, memory review, skill/MCP/hook inventory (via the Config Explorer API)":
      "Quản trị cấu hình &amp; bộ nhớ của Claude Code: kiểm toán cấu hình, rà soát bộ nhớ, kiểm kê kỹ năng/MCP/hook (qua Config Explorer API)",
    "Dashboard connector with MCP integration and one-line metric summaries":
      "Bộ kết nối bảng điều khiển với tích hợp MCP và tóm tắt chỉ số một dòng",
    "Each plugin follows the official Claude Code plugin specification. The marketplace manifest at <code>.claude-plugin/marketplace.json</code> catalogs all ten plugins. Each plugin directory contains:":
      "Mỗi plugin tuân theo đặc tả plugin chính thức của Claude Code. Bản kê chợ tại <code>.claude-plugin/marketplace.json</code> liệt kê tất cả mười plugin. Mỗi thư mục plugin chứa:",
    "All plugins query the Agent Monitor API at <code>http://localhost:4820</code>. Key capabilities they leverage:":
      "Tất cả plugin truy vấn API Agent Monitor tại <code>http://localhost:4820</code>. Các khả năng chính mà chúng tận dụng:",
    Capability: "Khả năng",
    Details: "Chi tiết",
    "Token tracking": "Theo dõi token",
    "4 types (input, output, cache_read, cache_write) + 4 compaction baselines per model per session":
      "4 loại (input, output, cache_read, cache_write) + 4 đường cơ sở nén mỗi mô hình mỗi phiên",
    "Cost calculation": "Tính toán chi phí",
    "<code>(tokens / 1M) × rate_per_mtok</code> for each type; longest pattern match wins":
      "<code>(tokens / 1M) × rate_per_mtok</code> cho mỗi loại; khớp mẫu dài nhất thắng",
    "Session metadata": "Siêu dữ liệu phiên",
    "Event types": "Loại sự kiện",
    "Workflow intelligence": "Trí tuệ quy trình",
    "11 datasets: stats, orchestration (DAG), toolFlow, effectiveness, patterns, modelDelegation, errorPropagation, concurrency, complexity, compaction, cooccurrence":
      "11 tập dữ liệu: stats, orchestration (DAG), toolFlow, effectiveness, patterns, modelDelegation, errorPropagation, concurrency, complexity, compaction, cooccurrence",
    "Agent hierarchy": "Phân cấp tác tử",
    "Recursive parent/child tree with subagent_type, depth tracking via recursive CTE":
      "Cây cha/con đệ quy với subagent_type, theo dõi độ sâu qua CTE đệ quy",
    '📖 Full documentation: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/docs/PLUGINS.md"><code>docs/plugins.md</code></a>':
      '📖 Tài liệu đầy đủ: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/docs/PLUGINS.md"><code>docs/plugins.md</code></a>',
    '<span class="caption-icon">🖥️</span> Statusline — always-visible bar showing context window usage, token counts, active model, git branch, and session ID. Configurable segments with theme support':
      '<span class="caption-icon">🖥️</span> Statusline — thanh luôn hiển thị cho thấy mức sử dụng cửa sổ ngữ cảnh, số lượng token, mô hình đang hoạt động, nhánh git và ID phiên. Các phân đoạn có thể cấu hình với hỗ trợ chủ đề',
    "The <code>statusline/</code> directory contains a standalone CLI statusline for Claude Code — completely independent of the web dashboard. It renders a color-coded bar at the bottom of the Claude Code terminal showing context window usage, per-direction token counts, session cost in USD, and git branch.":
      "Thư mục <code>statusline/</code> chứa một statusline CLI độc lập cho Claude Code — hoàn toàn tách biệt với bảng điều khiển web. Nó hiển thị một thanh được mã hóa màu ở cuối terminal Claude Code cho thấy mức sử dụng cửa sổ ngữ cảnh, số lượng token theo từng chiều, chi phí phiên tính bằng USD, và nhánh git.",
    Segment: "Phân đoạn",
    Source: "Nguồn",
    "Color Logic": "Logic màu",
    "Always cyan": "Luôn màu lục lam",
    "Always green": "Luôn màu lục",
    "Always yellow, <code>~</code> prefix for home":
      "Luôn màu vàng, tiền tố <code>~</code> cho thư mục home",
    "Always magenta, hidden outside git repos": "Luôn màu đỏ tươi, ẩn bên ngoài các kho git",
    "Green &lt; 50%, Yellow 50–79%, Red ≥ 80%": "Lục &lt; 50%, Vàng 50–79%, Đỏ ≥ 80%",
    "Green <code>↑</code> input, cyan <code>↓</code> output, dim <code>c</code> cache reads":
      "Lục <code>↑</code> đầu vào, lục lam <code>↓</code> đầu ra, mờ <code>c</code> cho các lần đọc cache",
    "Green &lt; $5, Yellow $5–$20, Red ≥ $20 (shown on API and subscription plans)":
      "Lục &lt; $5, Vàng $5–$20, Đỏ ≥ $20 (hiển thị trên các gói API và đăng ký)",
    "Add this to <code>~/.claude/settings.json</code>:":
      "Thêm nội dung này vào <code>~/.claude/settings.json</code>:",
    "No dependencies required": "Không cần phụ thuộc nào",
    "The statusline uses only Python 3.6+ stdlib (<code>sys</code>, <code>json</code>, <code>os</code>, <code>subprocess</code>). It fails silently on empty input or JSON errors and never blocks Claude Code.":
      "Statusline chỉ dùng thư viện chuẩn Python 3.6+ (<code>sys</code>, <code>json</code>, <code>os</code>, <code>subprocess</code>). Nó thất bại một cách im lặng khi đầu vào rỗng hoặc lỗi JSON và không bao giờ chặn Claude Code.",
    '<span class="caption-icon">🔌</span> Sidebar — live health, analytics, and deep navigation links':
      '<span class="caption-icon">🔌</span> Thanh bên — tình trạng trực tiếp, phân tích và các liên kết điều hướng sâu',
    "The <b>Claude Code Agent Monitor</b> is a premium, high-fidelity extension designed to minimize context switching for AI engineers. It brings the full power of the dashboard directly into VS Code, allowing you to monitor complex subagent orchestration without ever leaving your active code file.":
      "<b>Claude Code Agent Monitor</b> là một tiện ích mở rộng cao cấp, độ trung thực cao được thiết kế để giảm thiểu việc chuyển đổi ngữ cảnh cho các kỹ sư AI. Nó đưa toàn bộ sức mạnh của bảng điều khiển trực tiếp vào VS Code, cho phép bạn giám sát việc điều phối subagent phức tạp mà không cần rời khỏi tập tin mã đang hoạt động.",
    "A dedicated Activity Bar view that performs background polling every 5 seconds. Includes a real-time <b>Agent Health</b> monitor tracking all 5 states (Working, Connected, Idle, Completed, Error) with native VS Code theme-aware icons and colors.":
      "Một chế độ xem Activity Bar chuyên dụng thực hiện thăm dò nền mỗi 5 giây. Bao gồm một bộ giám sát <b>Agent Health</b> thời gian thực theo dõi cả 5 trạng thái (Working, Connected, Idle, Completed, Error) với biểu tượng và màu sắc gốc nhận biết theo chủ đề của VS Code.",
    "Aggregates data from multiple API endpoints to display high-signal metrics directly in the sidebar: <ul style=\"margin-top: 8px; color: var(--text-muted); font-size: 13px; list-style-type: '→ '; padding-left: 15px;\"> <li><b>Token Consumption</b>: Scaled tracking from 1k to 1.0B+ tokens.</li> <li><b>Live Cost Estimates</b>: Automatic USD cost calculation based on model pricing rules.</li> <li><b>Event Frequency</b>: Total events, daily sessions, and subagent spawning rates.</li> </ul>":
      "Tổng hợp dữ liệu từ nhiều điểm cuối API để hiển thị các chỉ số có tín hiệu cao trực tiếp trong thanh bên: <ul style=\"margin-top: 8px; color: var(--text-muted); font-size: 13px; list-style-type: '→ '; padding-left: 15px;\"> <li><b>Token Consumption</b>: Theo dõi theo tỷ lệ từ 1k đến hơn 1.0B tokens.</li> <li><b>Live Cost Estimates</b>: Tự động tính chi phí bằng USD dựa trên các quy tắc định giá của mô hình.</li> <li><b>Event Frequency</b>: Tổng số sự kiện, các phiên hằng ngày và tốc độ sinh ra subagent.</li> </ul>",
    "<b>Token Consumption</b>: Scaled tracking from 1k to 1.0B+ tokens.":
      "<b>Token Consumption</b>: Theo dõi theo tỷ lệ từ 1k đến hơn 1.0B tokens.",
    "<b>Live Cost Estimates</b>: Automatic USD cost calculation based on model pricing rules.":
      "<b>Live Cost Estimates</b>: Tự động tính chi phí bằng USD dựa trên các quy tắc định giá của mô hình.",
    "<b>Event Frequency</b>: Total events, daily sessions, and subagent spawning rates.":
      "<b>Event Frequency</b>: Tổng số sự kiện, các phiên hằng ngày và tốc độ sinh ra subagent.",
    "Renders the full React application within a native webview tab. Supports <b>Deep Linking</b>: one-click jump from the sidebar directly to specific views like the <i>Kanban Board</i>, <i>Analytics Hub</i>, or your <i>Last 10 Sessions</i>.":
      "Kết xuất toàn bộ ứng dụng React trong một tab webview gốc. Hỗ trợ <b>Deep Linking</b>: nhảy một cú nhấp từ thanh bên trực tiếp đến các chế độ xem cụ thể như <i>Kanban Board</i>, <i>Analytics Hub</i>, hoặc <i>Last 10 Sessions</i> của bạn.",
    "Seamlessly scans ports <code>5173</code> (Vite Dev) and <code>4820</code> (Production) on localhost. Automatically toggles between <b>Online</b> and <b>Offline</b> modes in the sidebar as you start or stop your local server.":
      "Quét liền mạch các cổng <code>5173</code> (Vite Dev) và <code>4820</code> (Production) trên localhost. Tự động chuyển đổi giữa chế độ <b>Online</b> và <b>Offline</b> trong thanh bên khi bạn khởi động hoặc dừng máy chủ cục bộ của mình.",
    "<strong>Zero-Config Setup</strong>": "<strong>Thiết lập không cần cấu hình</strong>",
    "The extension is designed to be plug-and-play. Once your server is running, the extension automatically discovers the API and begins streaming telemetry — no manual URL configuration required.":
      "Tiện ích mở rộng được thiết kế để cắm-và-chạy. Khi máy chủ của bạn đang chạy, tiện ích sẽ tự động phát hiện API và bắt đầu truyền phát dữ liệu đo từ xa — không cần cấu hình URL thủ công.",
    '📖 Full developer guide: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/vscode-extension/README.md"><code>vscode-extension/README.md</code></a>':
      '📖 Hướng dẫn đầy đủ cho nhà phát triển: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/vscode-extension/README.md"><code>vscode-extension/README.md</code></a>',
    "The dashboard ships as an optional <strong>native desktop application</strong> — a <code>desktop/</code> workspace that wraps the existing server and client into a macOS <code>.app</code> (distributed as a <code>.dmg</code>) and a Windows <code>.exe</code> (an NSIS installer plus a no-install portable build) you install once and forget. <code>desktop/</code> is a sibling workspace to <code>client/</code>, <code>server/</code>, <code>mcp/</code>, and <code>vscode-extension/</code>, built with <strong>Electron 35</strong>. It <strong>embeds the Express server in-process</strong> — it <code>require()</code>s <code>server/index.js</code> directly in the same Node runtime as the Electron main process (no child process, no IPC) — and renders the already-built React client in a <code>BrowserWindow</code>. Everything you see in the browser at <code>localhost:4820</code> lives inside this window, with native OS lifecycle on top.":
      "Bảng điều khiển còn được phát hành dưới dạng một <strong>ứng dụng máy tính để bàn gốc</strong> tùy chọn — một không gian làm việc <code>desktop/</code> đóng gói máy chủ và máy khách hiện có thành một <code>.app</code> của macOS (phân phối dưới dạng <code>.dmg</code>) và một <code>.exe</code> của Windows (một trình cài đặt NSIS cộng với một bản dựng di động không cần cài đặt) mà bạn chỉ cần cài đặt một lần rồi quên đi. <code>desktop/</code> là một không gian làm việc ngang hàng với <code>client/</code>, <code>server/</code>, <code>mcp/</code> và <code>vscode-extension/</code>, được xây dựng bằng <strong>Electron 35</strong>. Nó <strong>nhúng máy chủ Express trong tiến trình</strong> — nó <code>require()</code> trực tiếp <code>server/index.js</code> trong cùng một runtime Node với tiến trình chính của Electron (không có tiến trình con, không có IPC) — và kết xuất máy khách React đã được xây dựng sẵn trong một <code>BrowserWindow</code>. Mọi thứ bạn thấy trong trình duyệt tại <code>localhost:4820</code> đều nằm bên trong cửa sổ này, với vòng đời gốc của hệ điều hành ở bên trên.",
    '<span class="caption-icon">🍎🪟</span> <span>The full dashboard, natively on macOS <strong>and</strong> Windows — same React client, same Express server, real <code>BrowserWindow</code>. Menu-bar / notification-area (tray) icon included. Shipped as a macOS DMG and a Windows EXE (macOS shown) — see <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a>.</span>':
      '<span class="caption-icon">🍎🪟</span> <span>Bảng điều khiển đầy đủ, chạy gốc trên macOS <strong>và</strong> Windows — cùng một máy khách React, cùng một máy chủ Express, một <code>BrowserWindow</code> thực sự. Bao gồm biểu tượng thanh menu / khu vực thông báo (khay). Được phát hành dưới dạng DMG cho macOS và EXE cho Windows (hình minh họa là macOS) — xem <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a>.</span>',
    '<span class="caption-icon">🪟</span> <span>The same dashboard as a native <strong>Windows</strong> app — real <code>BrowserWindow</code> with the native Windows window menu, live Activity Feed, and the Tabby companion. A notification-area (system tray) icon sits beside the clock for quick access.</span>':
      '<span class="caption-icon">🪟</span> <span>Cùng một bảng điều khiển dưới dạng một ứng dụng <strong>Windows</strong> gốc — một <code>BrowserWindow</code> thực sự với menu cửa sổ gốc của Windows, Activity Feed trực tiếp và bạn đồng hành Tabby. Một biểu tượng khu vực thông báo (khay hệ thống) nằm cạnh đồng hồ để truy cập nhanh.</span>',
    "<strong>One-line mental model</strong>": "<strong>Mô hình tư duy một dòng</strong>",
    "<em>Electron is a window onto the same code.</em> The desktop app does not reimplement the dashboard — it hosts the exact server and client the standalone deployment runs. The only change outside <code>desktop/</code> is a behavior-preserving refactor of <code>server/index.js</code>: its post-listen bootstrap was extracted into an exported <code>startBackgroundServices()</code> so the embedded server runs exactly what <code>node server/index.js</code> runs.":
      "<em>Electron là một cửa sổ nhìn vào cùng một bộ mã.</em> Ứng dụng máy tính để bàn không triển khai lại bảng điều khiển — nó lưu trữ chính xác máy chủ và máy khách mà bản triển khai độc lập chạy. Thay đổi duy nhất bên ngoài <code>desktop/</code> là một lần tái cấu trúc giữ nguyên hành vi của <code>server/index.js</code>: phần khởi động sau khi lắng nghe của nó được tách ra thành một hàm <code>startBackgroundServices()</code> được xuất ra, để máy chủ nhúng chạy đúng những gì <code>node server/index.js</code> chạy.",
    "The Electron main process hosts the embedded server <em>and</em> manages the window, tray, and menus. The renderer is just Chromium loading <code>http://127.0.0.1:&lt;port&gt;</code> — the same origin a normal browser would use.":
      "Tiến trình chính của Electron lưu trữ máy chủ nhúng <em>và</em> quản lý cửa sổ, khay và các menu. Bộ kết xuất chỉ đơn giản là Chromium đang tải <code>http://127.0.0.1:&lt;port&gt;</code> — cùng một origin mà một trình duyệt thông thường sẽ sử dụng.",
    "The desktop app embeds the Express server in-process — no child process, no IPC":
      "Ứng dụng máy tính để bàn nhúng máy chủ Express trong tiến trình — không có tiến trình con, không có IPC",
    "An always-on tray icon — the macOS menu bar (a tinted template glyph) or the Windows notification area (the colored <code>icon.ico</code>). A single click (left or right) opens a dropdown with a <strong>live status snapshot</strong> queried straight from SQLite at click time — server port, active sessions, working agents, events today — followed by <strong>Open Dashboard</strong>, <strong>Open in Browser</strong>, <strong>Restart Server</strong>, <strong>Show Logs</strong>, <strong>Open at Login</strong> (toggle), and <strong>Quit</strong>. The snapshot rows are clickable — they open the dashboard. The menu is rebuilt on each open so every value is current.":
      "Một biểu tượng khay luôn bật — thanh menu macOS (một biểu tượng mẫu được tô màu) hoặc khu vực thông báo Windows (<code>icon.ico</code> có màu). Một cú nhấp đơn (trái hoặc phải) mở ra một danh sách thả xuống với một <strong>ảnh chụp trạng thái trực tiếp</strong> được truy vấn thẳng từ SQLite tại thời điểm nhấp — cổng máy chủ, các phiên đang hoạt động, các agent đang làm việc, các sự kiện hôm nay — tiếp theo là <strong>Open Dashboard</strong>, <strong>Open in Browser</strong>, <strong>Restart Server</strong>, <strong>Show Logs</strong>, <strong>Open at Login</strong> (chuyển đổi) và <strong>Quit</strong>. Các hàng ảnh chụp có thể nhấp được — chúng mở bảng điều khiển. Menu được dựng lại mỗi lần mở để mọi giá trị đều là hiện thời.",
    "A standard native application menu — <code>About</code>, <code>Open at Login</code>, <code>File</code>, <code>Edit</code>, <code>View</code>, <code>Window</code>, <code>Help</code> — with <code>⌘R</code> / <code>Ctrl+R</code> wired to <em>View ▸ reload</em>. External links open in the system browser, never inside Electron. The <code>File ▸ Open Dashboard</code> item (<code>⌘1</code>) is macOS-only; on Windows/Linux the window-attached menu can't reopen a hidden window, so reopen from the tray's <strong>Open Dashboard</strong>.":
      "Một menu ứng dụng gốc tiêu chuẩn — <code>About</code>, <code>Open at Login</code>, <code>File</code>, <code>Edit</code>, <code>View</code>, <code>Window</code>, <code>Help</code> — với <code>⌘R</code> / <code>Ctrl+R</code> được nối với <em>View ▸ reload</em>. Các liên kết bên ngoài mở trong trình duyệt hệ thống, không bao giờ bên trong Electron. Mục <code>File ▸ Open Dashboard</code> (<code>⌘1</code>) chỉ có trên macOS; trên Windows/Linux, menu gắn với cửa sổ không thể mở lại một cửa sổ đã ẩn, vì vậy hãy mở lại từ <strong>Open Dashboard</strong> của khay.",
    "Flip <em>Open at Login</em> in the tray or app menu — both platforms go through Electron's first-party <code>app.*LoginItemSettings</code> API. On macOS it registers via the modern <code>SMAppService</code> API and appears under <strong>System Settings → General → Login Items</strong>; on Windows it writes a per-user <code>HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run</code> entry, visible in <strong>Task Manager → Startup</strong>. When the app is launched at login it starts tray-only, with no window jumping into view (on Windows the login launch is detected via a <code>--ccam-hidden</code> argument).":
      "Bật <em>Open at Login</em> trong khay hoặc menu ứng dụng — cả hai nền tảng đều đi qua API <code>app.*LoginItemSettings</code> bên thứ nhất của Electron. Trên macOS, nó đăng ký thông qua API <code>SMAppService</code> hiện đại và xuất hiện trong <strong>System Settings → General → Login Items</strong>; trên Windows, nó ghi một mục <code>HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run</code> theo từng người dùng, hiển thị trong <strong>Task Manager → Startup</strong>. Khi ứng dụng được khởi chạy lúc đăng nhập, nó khởi động chỉ ở dạng khay, không có cửa sổ nào bật lên (trên Windows, lần khởi chạy khi đăng nhập được phát hiện qua một đối số <code>--ccam-hidden</code>).",
    'Closing the window hides it — the embedded server keeps running, the tray icon stays, and the dock / taskbar icon stays too (a clickable "still alive" indicator). <strong>Quit</strong> (<code>⌘Q</code> / <code>Ctrl+Q</code>, app menu, or tray → Quit) pops a confirmation modal — press the Quit button or hit <code>⌘Q</code> / <code>Ctrl+Q</code> a second time to skip the prompt — and only then does the embedded server shut down, closing SQLite cleanly with a WAL checkpoint and removing this PID\'s entry from the discovery file.':
      'Đóng cửa sổ chỉ ẩn nó đi — máy chủ nhúng vẫn tiếp tục chạy, biểu tượng khay vẫn ở đó, và biểu tượng dock / thanh tác vụ cũng vẫn còn (một chỉ báo "vẫn còn sống" có thể nhấp). <strong>Quit</strong> (<code>⌘Q</code> / <code>Ctrl+Q</code>, menu ứng dụng, hoặc khay → Quit) bật lên một hộp thoại xác nhận — nhấn nút Quit hoặc nhấn <code>⌘Q</code> / <code>Ctrl+Q</code> lần thứ hai để bỏ qua lời nhắc — và chỉ khi đó máy chủ nhúng mới tắt, đóng SQLite một cách sạch sẽ bằng một WAL checkpoint và xóa mục của PID này khỏi tập tin phát hiện.',
    "Launch the desktop app and <code>npm run dev</code> at the same time and both stay real-time. Each server appends its <code>{port, pid, startedAt}</code> entry to <code>~/.claude/.agent-dashboard.json</code> on startup; the Claude Code hook handler reads that list and fan-outs every event to every live entry in parallel. Stale entries self-evict via a PID liveness check on read, so a crashed server can't misroute events to a dead port.":
      "Khởi chạy ứng dụng máy tính để bàn và <code>npm run dev</code> cùng một lúc và cả hai đều giữ thời gian thực. Mỗi máy chủ thêm mục <code>{port, pid, startedAt}</code> của nó vào <code>~/.claude/.agent-dashboard.json</code> khi khởi động; trình xử lý hook của Claude Code đọc danh sách đó và phân phối song song mọi sự kiện đến mọi mục còn sống. Các mục cũ tự loại bỏ thông qua một kiểm tra tính sống của PID khi đọc, vì vậy một máy chủ bị sập không thể định tuyến sai các sự kiện đến một cổng đã chết.",
    "Double-launching the app just focuses the existing window — no second server, no port collision, on every platform. The lock is acquired via <code>requestSingleInstanceLock()</code> before any server boots.":
      "Khởi chạy ứng dụng hai lần chỉ tập trung vào cửa sổ hiện có — không có máy chủ thứ hai, không có xung đột cổng, trên mọi nền tảng. Khóa được giành lấy thông qua <code>requestSingleInstanceLock()</code> trước khi bất kỳ máy chủ nào khởi động.",
    "On its first owned-server boot the app auto-installs the Claude Code hooks into <code>~/.claude/settings.json</code> and starts the background services (update scheduler, config watcher, orphaned-run reconciliation) — so an install-only user (DMG or EXE) gets events flowing without ever running <code>npm run install-hooks</code> from a checkout.":
      "Trong lần khởi động máy chủ do nó sở hữu đầu tiên, ứng dụng tự động cài đặt các hook của Claude Code vào <code>~/.claude/settings.json</code> và khởi động các dịch vụ nền (trình lập lịch cập nhật, trình theo dõi cấu hình, đối soát các lần chạy mồ côi) — vì vậy một người dùng chỉ cài đặt (DMG hoặc EXE) có được luồng sự kiện mà không bao giờ phải chạy <code>npm run install-hooks</code> từ một bản checkout.",
    "Two packaging realities — a read-only application bundle / install directory and (on macOS) the minimal <code>PATH</code> a Finder-launched app inherits — are handled automatically so installs survive updates and the <strong>Run Claude</strong> feature works out of the box on both macOS and Windows.":
      "Hai thực tế về đóng gói — một bộ ứng dụng / thư mục cài đặt chỉ đọc và (trên macOS) <code>PATH</code> tối thiểu mà một ứng dụng được khởi chạy từ Finder thừa hưởng — được xử lý tự động để các bản cài đặt tồn tại qua các bản cập nhật và tính năng <strong>Run Claude</strong> hoạt động ngay lập tức trên cả macOS và Windows.",
    "<strong>Your data survives reinstalls and updates</strong>":
      "<strong>Dữ liệu của bạn tồn tại qua các lần cài đặt lại và cập nhật</strong>",
    "The SQLite database and VAPID keys live in a per-user app-data directory <em>outside</em> the application bundle / install dir — <code>~/Library/Application Support/Claude Code Monitor/data/</code> on macOS, <code>%APPDATA%\\Claude Code Monitor\\data\\</code> on Windows. <code>server-host.ts</code> points <code>DASHBOARD_DATA_DIR</code> at that per-user directory on boot. Because a packaged, code-signed, or app-translocated bundle is read-only, older builds that stored the database inside the bundle broke History Import; with the data directory now in app-data, your imported history and events persist across app reinstalls and updates (the Windows NSIS uninstaller keeps this data by default). After upgrading from a pre-fix build, re-run <strong>Import History → Rescan</strong> once to bridge the one-time gap.":
      "Cơ sở dữ liệu SQLite và các khóa VAPID nằm trong một thư mục dữ liệu ứng dụng theo từng người dùng <em>bên ngoài</em> bộ ứng dụng / thư mục cài đặt — <code>~/Library/Application Support/Claude Code Monitor/data/</code> trên macOS, <code>%APPDATA%\\Claude Code Monitor\\data\\</code> trên Windows. <code>server-host.ts</code> trỏ <code>DASHBOARD_DATA_DIR</code> tới thư mục theo từng người dùng đó khi khởi động. Vì một bộ ứng dụng đã được đóng gói, ký mã, hoặc bị di dời (app-translocated) là chỉ đọc, các bản dựng cũ lưu cơ sở dữ liệu bên trong bộ ứng dụng đã làm hỏng History Import; với thư mục dữ liệu giờ nằm trong app-data, lịch sử và các sự kiện bạn đã nhập vẫn tồn tại qua các lần cài đặt lại và cập nhật ứng dụng (trình gỡ cài đặt NSIS của Windows mặc định giữ lại dữ liệu này). Sau khi nâng cấp từ một bản dựng trước khi sửa lỗi, hãy chạy lại <strong>Import History → Rescan</strong> một lần để khắc phục khoảng trống một lần đó.",
    "<strong>The <code>claude</code> CLI is found automatically</strong>":
      "<strong><code>claude</code> CLI được tìm thấy tự động</strong>",
    "A Finder- or Dock-launched macOS app inherits only launchd's minimal <code>PATH</code>, not your login shell's. At startup <code>shell-path.ts</code> recovers the user's login-shell <code>PATH</code> so the <strong>Run Claude</strong> feature can locate and spawn the <code>claude</code> CLI. (On Windows the process already inherits the user <code>PATH</code>, so no recovery step is needed.) If it still cannot be found, make sure <code>claude</code> is a real executable on your <code>PATH</code> — a shell alias or function cannot be spawned — and check the <code>user PATH resolved</code> line in the desktop log (<code>~/Library/Logs/Claude Code Monitor/desktop.log</code> on macOS, <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> on Windows).":
      "Một ứng dụng macOS được khởi chạy từ Finder hoặc Dock chỉ thừa hưởng <code>PATH</code> tối thiểu của launchd, chứ không phải của login shell của bạn. Khi khởi động, <code>shell-path.ts</code> khôi phục <code>PATH</code> của login shell người dùng để tính năng <strong>Run Claude</strong> có thể định vị và khởi chạy <code>claude</code> CLI. (Trên Windows, tiến trình đã thừa hưởng <code>PATH</code> của người dùng, nên không cần bước khôi phục nào.) Nếu vẫn không tìm thấy, hãy đảm bảo <code>claude</code> là một tập tin thực thi thực sự trên <code>PATH</code> của bạn — một bí danh hoặc hàm của shell không thể được khởi chạy — và kiểm tra dòng <code>user PATH resolved</code> trong nhật ký máy tính để bàn (<code>~/Library/Logs/Claude Code Monitor/desktop.log</code> trên macOS, <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> trên Windows).",
    "On launch the Electron main process picks a free port. If a healthy dashboard server already answers <code>/api/health</code> on port <code>4820</code> (for example, you ran <code>npm start</code> in a terminal), the app <strong>adopts</strong> that server instead of starting a second one — no double-binding, no SQLite contention. An adopted server is not owned by the app, so quitting leaves it running.":
      "Khi khởi chạy, tiến trình chính của Electron chọn một cổng trống. Nếu đã có một máy chủ bảng điều khiển khỏe mạnh trả lời <code>/api/health</code> trên cổng <code>4820</code> (ví dụ, bạn đã chạy <code>npm start</code> trong một terminal), ứng dụng <strong>tiếp nhận</strong> máy chủ đó thay vì khởi động một máy chủ thứ hai — không ràng buộc trùng, không tranh chấp SQLite. Một máy chủ được tiếp nhận không thuộc sở hữu của ứng dụng, vì vậy việc thoát sẽ để nó tiếp tục chạy.",
    Step: "Bước",
    "Port choice": "Lựa chọn cổng",
    Adopt: "Tiếp nhận",
    "A healthy server already on <code>4820</code> is adopted as-is":
      "Một máy chủ khỏe mạnh đã có sẵn trên <code>4820</code> được tiếp nhận nguyên trạng",
    Preferred: "Ưu tiên",
    "<code>4820</code> when free": "<code>4820</code> khi trống",
    Fallback: "Dự phòng",
    "The first free port in <code>4821</code>–<code>4829</code>":
      "Cổng trống đầu tiên trong khoảng <code>4821</code>–<code>4829</code>",
    "Last resort": "Phương án cuối cùng",
    "A random high port when all of the above are taken":
      "Một cổng cao ngẫu nhiên khi tất cả các cổng trên đều bị chiếm",
    "Three ways to obtain the desktop app — the latest GitHub Release (best for most users), a per-commit CI artifact (fresher than the latest release), or a local build.":
      "Có ba cách để lấy ứng dụng máy tính để bàn — GitHub Release mới nhất (tốt nhất cho hầu hết người dùng), một CI artifact theo từng commit (mới hơn bản phát hành mới nhất), hoặc một bản dựng cục bộ.",
    'Open <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Releases → latest </a> and download the asset for your platform. The macOS and Windows Desktop CI jobs auto-publish a new <code>vX.Y.Z</code> release every time the version in <code>package.json</code> is bumped on <code>master</code>, so this link always points at the current build. Releases are public — no GitHub sign-in required.':
      'Mở <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Releases → latest </a> và tải xuống tài nguyên cho nền tảng của bạn. Các tác vụ CI Desktop của macOS và Windows tự động phát hành một bản <code>vX.Y.Z</code> mới mỗi khi phiên bản trong <code>package.json</code> được nâng trên <code>master</code>, vì vậy liên kết này luôn trỏ tới bản dựng hiện tại. Các bản phát hành là công khai — không cần đăng nhập GitHub.',
    Platform: "Nền tảng",
    Asset: "Tài nguyên",
    "macOS (Apple Silicon)": "macOS (Apple Silicon)",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-arm64.dmg</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-arm64.dmg</code>",
    "Drag the <code>.app</code> into <code>/Applications</code>":
      "Kéo <code>.app</code> vào <code>/Applications</code>",
    "macOS (Intel)": "macOS (Intel)",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64.dmg</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64.dmg</code>",
    "Windows (installer)": "Windows (trình cài đặt)",
    "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>":
      "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>",
    "NSIS installer — per-user, no admin elevation":
      "Trình cài đặt NSIS — theo từng người dùng, không cần nâng quyền quản trị",
    "Windows (portable)": "Windows (bản di động)",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>",
    "Run without installing": "Chạy mà không cần cài đặt",
    'Want a build straight off the tip of <code>master</code>, ahead of the next tagged release? Every green run of the <code>🍎 macOS Desktop (DMG)</code> job on <code>macos-latest</code> uploads the universal DMG as the <code>ClaudeCodeMonitor-dmg</code> workflow artifact, and the <code>🪟 Windows Desktop (EXE)</code> job on <code>windows-latest</code> uploads the installer + portable EXEs as the <code>ClaudeCodeMonitor-win</code> artifact. Open the <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> latest passing run </a>, scroll to its Artifacts section, and download <code>ClaudeCodeMonitor-dmg</code> or <code>ClaudeCodeMonitor-win</code>. (GitHub sign-in required; 14-day retention.)':
      'Muốn một bản dựng ngay từ đỉnh của <code>master</code>, trước cả bản phát hành được gắn thẻ kế tiếp? Mỗi lần chạy thành công của job <code>🍎 macOS Desktop (DMG)</code> trên <code>macos-latest</code> đều tải lên DMG đa kiến trúc dưới dạng artifact quy trình <code>ClaudeCodeMonitor-dmg</code>, còn job <code>🪟 Windows Desktop (EXE)</code> trên <code>windows-latest</code> tải lên trình cài đặt + các EXE di động dưới dạng artifact <code>ClaudeCodeMonitor-win</code>. Mở <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> lần chạy gần nhất đã vượt qua </a>, cuộn tới mục Artifacts của nó, rồi tải xuống <code>ClaudeCodeMonitor-dmg</code> hoặc <code>ClaudeCodeMonitor-win</code>. (Cần đăng nhập GitHub; lưu giữ 14 ngày.)',
    "From the project root, after <code>git clone</code>:":
      "Từ thư mục gốc của dự án, sau khi <code>git clone</code>:",
    "Use the arch-specific build on your own machine":
      "Hãy dùng bản dựng theo kiến trúc cụ thể trên máy của bạn",
    "The universal <code>desktop:dmg</code> build is intentionally slow: it builds the full app tree <em>twice</em> (once per architecture), merges both with <code>@electron/universal</code>, and ad-hoc-signs every binary in the merged bundle. For running on a single Mac, use <code>desktop:dmg:arm64</code> (Apple Silicon) or <code>desktop:dmg:x64</code> (Intel) — one architecture, no merge, finishing in roughly a minute instead of many. Reserve the universal build for release artifacts; CI already produces one as <code>ClaudeCodeMonitor-dmg</code>, so you rarely need to build it yourself.":
      "Bản dựng đa kiến trúc <code>desktop:dmg</code> cố tình chậm: nó dựng toàn bộ cây ứng dụng <em>hai lần</em> (mỗi kiến trúc một lần), hợp nhất cả hai bằng <code>@electron/universal</code>, và ký tạm thời (ad-hoc) cho mọi tệp nhị phân trong gói đã hợp nhất. Để chạy trên một máy Mac duy nhất, hãy dùng <code>desktop:dmg:arm64</code> (Apple Silicon) hoặc <code>desktop:dmg:x64</code> (Intel) — một kiến trúc, không hợp nhất, hoàn tất trong khoảng một phút thay vì nhiều phút. Hãy dành bản dựng đa kiến trúc cho artifact phát hành; CI đã tạo sẵn một bản dưới tên <code>ClaudeCodeMonitor-dmg</code>, nên bạn hiếm khi cần tự dựng nó.",
    "Double-click the downloaded <code>.dmg</code> to mount it":
      "Nhấp đúp vào tệp <code>.dmg</code> đã tải để gắn kết (mount) nó",
    "Drag <code>Claude Code Monitor.app</code> into your <code>Applications</code> folder":
      "Kéo <code>Claude Code Monitor.app</code> vào thư mục <code>Applications</code> của bạn",
    "Run <code>xattr -cr</code> on the app to get past Gatekeeper (see below)":
      "Chạy <code>xattr -cr</code> trên ứng dụng để vượt qua Gatekeeper (xem bên dưới)",
    "Open the app — the tray icon appears and the dashboard window loads":
      "Mở ứng dụng — biểu tượng khay xuất hiện và cửa sổ bảng điều khiển được nạp",
    "Gatekeeper warning on first launch": "Cảnh báo Gatekeeper ở lần khởi chạy đầu tiên",
    'The DMG is ad-hoc signed by default — that is all the project can offer without a paid Apple Developer ID. macOS warns the first time you open it (<em>"Apple could not verify…"</em>). Strip the quarantine attribute to get past it:':
      "DMG mặc định được ký tạm thời (ad-hoc) — đó là tất cả những gì dự án có thể cung cấp khi không có Apple Developer ID trả phí. macOS sẽ cảnh báo lần đầu tiên bạn mở nó (<em>“Apple could not verify…”</em>). Hãy gỡ thuộc tính cách ly (quarantine) để vượt qua nó:",
    "Alternatively, open <strong>System Settings → Privacy &amp; Security</strong>, find the blocked app, and click <em>Open Anyway</em>. Code signing and Apple notarization are opt-in for the maintainer — when configured, this warning goes away for everyone.":
      "Hoặc, mở <strong>System Settings → Privacy &amp; Security</strong>, tìm ứng dụng bị chặn, rồi nhấp <em>Open Anyway</em>. Việc ký mã và công chứng (notarization) của Apple là tùy chọn đối với người bảo trì — khi được cấu hình, cảnh báo này sẽ biến mất với tất cả mọi người.",
    "Run <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> — a per-user NSIS install (no admin), or run the <code>*-portable.exe</code> to skip installing":
      "Chạy <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> — một bản cài NSIS theo từng người dùng (không cần quản trị), hoặc chạy <code>*-portable.exe</code> để bỏ qua việc cài đặt",
    "The EXE is unsigned by default, so SmartScreen may warn — click <em>More info → Run anyway</em>":
      "EXE mặc định chưa được ký, nên SmartScreen có thể cảnh báo — nhấp <em>More info → Run anyway</em>",
    "Open from the Start menu / desktop shortcut — the notification-area (tray) icon appears and the dashboard window loads":
      "Mở từ menu Start / lối tắt trên desktop — biểu tượng vùng thông báo (khay) xuất hiện và cửa sổ bảng điều khiển được nạp",
    '<span class="caption-icon">1️⃣</span> <span>NSIS installer, step 1 — <strong>Choose Installation Options</strong>: pick per-user setup and optional shortcuts.</span>':
      '<span class="caption-icon">1️⃣</span> <span>Trình cài đặt NSIS, bước 1 — <strong>Choose Installation Options</strong>: chọn cài đặt theo từng người dùng và các lối tắt tùy chọn.</span>',
    '<span class="caption-icon">2️⃣</span> <span>NSIS installer, step 2 — <strong>Choose Install Location</strong>: defaults to <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code>, or point it anywhere.</span>':
      '<span class="caption-icon">2️⃣</span> <span>Trình cài đặt NSIS, bước 2 — <strong>Choose Install Location</strong>: mặc định là <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code>, hoặc trỏ tới bất kỳ đâu.</span>',
    '<span class="caption-icon">3️⃣</span> <span>NSIS installer, step 3 — <strong>Completing Setup</strong>: click <em>Finish</em> to launch the app and drop the tray icon in the notification area.</span>':
      '<span class="caption-icon">3️⃣</span> <span>Trình cài đặt NSIS, bước 3 — <strong>Completing Setup</strong>: nhấp <em>Finish</em> để khởi chạy ứng dụng và đặt biểu tượng khay vào vùng thông báo.</span>',
    "SmartScreen warning on first launch": "Cảnh báo SmartScreen ở lần khởi chạy đầu tiên",
    'The installer and portable EXE are <strong>unsigned</strong> by default — that is all the project can offer without a paid code-signing certificate. Windows <strong>SmartScreen</strong> may show <em>"Windows protected your PC"</em> the first time you run it; click <strong>More info → Run anyway</strong>. The installer lays the app down <strong>per-user</strong> under <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code> (and lets you choose the install directory) and sets an <code>AppUserModelId</code> (<code>com.hoangsonww.ccam.desktop</code>) so native toast notifications are attributed correctly and the window groups under one taskbar entry.':
      "Trình cài đặt và EXE di động mặc định <strong>chưa được ký</strong> — đó là tất cả những gì dự án có thể cung cấp khi không có chứng chỉ ký mã trả phí. Windows <strong>SmartScreen</strong> có thể hiển thị <em>“Windows protected your PC”</em> lần đầu tiên bạn chạy nó; nhấp <strong>More info → Run anyway</strong>. Trình cài đặt đặt ứng dụng <strong>theo từng người dùng</strong> dưới <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code> (và cho phép bạn chọn thư mục cài đặt) và thiết lập một <code>AppUserModelId</code> (<code>com.hoangsonww.ccam.desktop</code>) để các thông báo toast gốc được quy đúng nguồn và cửa sổ được nhóm dưới một mục trên thanh tác vụ.",
    "Bundle size": "Kích thước gói",
    "The DMG is roughly 80&nbsp;MB, about 250&nbsp;MB installed on disk — the standard Electron tax; the Windows installer is comparable. The app runs natively on <strong>macOS and Windows</strong>; Linux is tracked as a follow-up. Logs live at <code>~/Library/Logs/Claude Code Monitor/desktop.log</code> on macOS or <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> on Windows (reach them from the tray menu → <em>Show Logs</em>).":
      "DMG khoảng 80&nbsp;MB, khoảng 250&nbsp;MB khi đã cài trên đĩa — cái giá tiêu chuẩn của Electron; trình cài đặt Windows cũng tương đương. Ứng dụng chạy gốc trên <strong>macOS và Windows</strong>; Linux được theo dõi như một hạng mục tiếp theo. Nhật ký nằm ở <code>~/Library/Logs/Claude Code Monitor/desktop.log</code> trên macOS hoặc <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> trên Windows (truy cập chúng từ menu khay → <em>Show Logs</em>).",
    '📖 User-facing guide: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a> · architecture &amp; contributor reference: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/desktop/README.md"><code>desktop/README.md</code></a>':
      '📖 Hướng dẫn dành cho người dùng: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a> · tài liệu tham khảo kiến trúc &amp; người đóng góp: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/desktop/README.md"><code>desktop/README.md</code></a>',
    '<span class="caption-icon">⚙️</span> Settings — model pricing editor, hook installation toggle, JSON data export, session cleanup, browser notification preferences, and system info panel with DB stats':
      '<span class="caption-icon">⚙️</span> Settings — trình chỉnh sửa giá theo mô hình, công tắc cài đặt hook, xuất dữ liệu JSON, dọn dẹp phiên, tùy chọn thông báo của trình duyệt, và bảng thông tin hệ thống kèm thống kê DB',
    "The <code>/settings</code> route provides a comprehensive management interface with six sections:":
      "Tuyến <code>/settings</code> cung cấp một giao diện quản lý toàn diện gồm sáu phần:",
    "Editable table of per-model pricing rules. Each Claude model variant has its own explicit pattern (e.g., <code>claude-opus-4-6%</code>). Rates cover input, output, cache read, and cache write tokens. Each rule's editor also has a collapsible <strong>Introductory rates</strong> block — a <code>YYYY-MM-DD</code> promo cutoff plus per-category intro prices (input / output / cache-read / cache-write 5m &amp; 1h); an empty date means no promo, and any future model-launch promo needs no code change. Reset to defaults or add custom models. The section header carries an info popover (the <code>i</code> icon) that explains how rule lookup works (first matching pattern wins), the SQL-style <code>%</code> wildcard syntax with concrete examples (<code>claude-opus-4-7%</code>, <code>claude-%-haiku</code>, exact ids), and reminds the user that prices must be updated manually when Anthropic publishes new rates — already-stored sessions keep the price applied at ingest time. The CLAUDE_HOME panel and Import History flow are fully i18n-driven across en/vi/zh.":
      "Bảng có thể chỉnh sửa các quy tắc giá theo từng mô hình. Mỗi biến thể mô hình Claude có mẫu (pattern) riêng rõ ràng (ví dụ <code>claude-opus-4-6%</code>). Mức giá bao gồm token đầu vào, đầu ra, đọc cache và ghi cache. Trình chỉnh sửa của mỗi quy tắc còn có một khối <strong>Introductory rates</strong> (mức giá giới thiệu) có thể thu gọn — một mốc kết thúc khuyến mãi dạng <code>YYYY-MM-DD</code> cùng các mức giá giới thiệu theo từng danh mục (đầu vào / đầu ra / đọc cache / ghi cache 5m &amp; 1h); để trống ngày nghĩa là không có khuyến mãi, và bất kỳ khuyến mãi ra mắt mô hình nào trong tương lai đều không cần thay đổi mã. Đặt lại về mặc định hoặc thêm mô hình tùy chỉnh. Tiêu đề phần này có một popover thông tin (biểu tượng <code>i</code>) giải thích cách tra cứu quy tắc hoạt động (mẫu khớp đầu tiên thắng), cú pháp ký tự đại diện <code>%</code> kiểu SQL kèm ví dụ cụ thể (<code>claude-opus-4-7%</code>, <code>claude-%-haiku</code>, id chính xác), và nhắc người dùng rằng giá phải được cập nhật thủ công khi Anthropic công bố mức giá mới — các phiên đã lưu vẫn giữ mức giá được áp dụng tại thời điểm nhập. Bảng CLAUDE_HOME và luồng Import History được điều khiển hoàn toàn bằng i18n trên en/vi/zh.",
    "Shows per-hook installation status (SessionStart, PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionEnd). One-click reinstall if hooks are missing or outdated. Validates paths and permissions automatically.":
      "Hiển thị trạng thái cài đặt theo từng hook (SessionStart, PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionEnd). Cài đặt lại bằng một cú nhấp nếu hook bị thiếu hoặc lỗi thời. Tự động kiểm tra đường dẫn và quyền.",
    "View database row counts and size. Session cleanup: abandon stale active sessions after N hours, purge old completed sessions after N days. Danger zone: clear all data with confirmation dialog to prevent accidental loss.":
      "Xem số dòng và kích thước cơ sở dữ liệu. Dọn dẹp phiên: bỏ các phiên đang hoạt động bị cũ sau N giờ, xóa các phiên đã hoàn tất cũ sau N ngày. Vùng nguy hiểm: xóa toàn bộ dữ liệu kèm hộp thoại xác nhận để tránh mất mát ngoài ý muốn.",
    "Download all sessions, agents, events, token usage, and pricing rules as a single JSON file for backup or analysis. Includes full event history, model metadata, and cost breakdowns in one portable archive.":
      "Tải xuống tất cả phiên, tác nhân, sự kiện, lượng token sử dụng và quy tắc giá dưới dạng một tệp JSON duy nhất để sao lưu hoặc phân tích. Bao gồm toàn bộ lịch sử sự kiện, siêu dữ liệu mô hình và bảng phân tích chi phí trong một kho lưu trữ di động.",
    "Dedicated Health tab on the Dashboard with a composite health score (weighted from success rate, cache hit rate, error rate, and heap usage), storage engine donut chart, tool invocation frequency bars, subagent effectiveness, model token distribution, and compaction impact — all with cursor-following tooltips and 5-second auto-refresh.":
      "Tab Health chuyên dụng trên Dashboard với điểm sức khỏe tổng hợp (được tính trọng số từ tỷ lệ thành công, tỷ lệ trúng cache, tỷ lệ lỗi và mức dùng heap), biểu đồ vành khuyên về công cụ lưu trữ, các thanh tần suất gọi công cụ, hiệu quả của tác nhân con, phân bố token theo mô hình và tác động của việc nén — tất cả đều có chú giải đi theo con trỏ và tự động làm mới mỗi 5 giây.",
    "Configure native browser notifications with per-event toggles for session starts, completions, errors, and subagent spawns. Automatic permission management with test-send button and graceful fallback when denied.":
      "Cấu hình thông báo gốc của trình duyệt với các công tắc theo từng sự kiện cho việc bắt đầu phiên, hoàn tất, lỗi và sinh tác nhân con. Quản lý quyền tự động kèm nút gửi thử và phương án dự phòng nhẹ nhàng khi bị từ chối.",
    "Per-model pricing — no catch-all grouping": "Giá theo từng mô hình — không gộp chung một kiểu",
    "Each Claude model variant (e.g., Opus 4.6 vs Opus 4.1) has its own explicit pricing pattern because different model versions have different rates. The cost engine uses specificity sorting — longer patterns match before shorter ones.":
      "Mỗi biến thể mô hình Claude (ví dụ Opus 4.6 so với Opus 4.1) có mẫu giá riêng rõ ràng vì các phiên bản mô hình khác nhau có mức giá khác nhau. Bộ máy tính chi phí dùng cách sắp xếp theo độ cụ thể — các mẫu dài hơn được khớp trước các mẫu ngắn hơn.",
    "Turns the dashboard from passive viewing into active monitoring. A rules-based alerting engine evaluates the live event stream <strong>server-side</strong>, and fired alerts fan out to outbound <strong>webhook channels</strong>. Everything lives in one place — <strong>Settings → Alerts</strong> — behind a segmented control with three tabs: <strong>Rules</strong> (what triggers an alert), <strong>Channels</strong> (where alerts are delivered), and <strong>Activity</strong> (the live fired-alert feed with acknowledge / acknowledge-all).":
      "Biến bảng điều khiển từ việc xem thụ động thành giám sát chủ động. Một bộ máy cảnh báo dựa trên quy tắc đánh giá luồng sự kiện trực tiếp ở <strong>phía máy chủ</strong>, và các cảnh báo được kích hoạt sẽ tỏa ra các <strong>kênh webhook</strong> đầu ra. Mọi thứ nằm ở một nơi — <strong>Settings → Alerts</strong> — phía sau một điều khiển phân đoạn với ba tab: <strong>Rules</strong> (điều gì kích hoạt một cảnh báo), <strong>Channels</strong> (cảnh báo được gửi đến đâu) và <strong>Activity</strong> (luồng cảnh báo đã kích hoạt trực tiếp kèm xác nhận / xác nhận tất cả).",
    'Four condition types: <strong>event pattern</strong> (match <code>event_type</code> / <code>tool_name</code> / a summary substring, optionally requiring ≥ N matches within a rolling window — e.g. "5 errors in 2 minutes"), <strong>inactivity</strong> (an active session goes quiet for N minutes), <strong>status duration</strong> (an agent is stuck in <code>working</code> / <code>waiting</code> for N minutes), and <strong>token threshold</strong> (a session\'s cumulative tokens cross a limit). Each rule has a configurable <strong>cooldown</strong> that dedups repeat alerts per (rule, session, agent).':
      "Bốn loại điều kiện: <strong>mẫu sự kiện</strong> (khớp <code>event_type</code> / <code>tool_name</code> / một chuỗi con trong tóm tắt, tùy chọn yêu cầu ≥ N lần khớp trong một cửa sổ trượt — ví dụ “5 lỗi trong 2 phút”), <strong>không hoạt động</strong> (một phiên đang hoạt động im lặng trong N phút), <strong>thời lượng trạng thái</strong> (một tác nhân kẹt ở trạng thái <code>working</code> / <code>waiting</code> trong N phút), và <strong>ngưỡng token</strong> (token tích lũy của một phiên vượt qua một giới hạn). Mỗi quy tắc có một <strong>thời gian chờ (cooldown)</strong> có thể cấu hình, dùng để loại trùng các cảnh báo lặp theo từng (quy tắc, phiên, tác nhân).",
    "Event-driven rules (<code>event_pattern</code>, <code>token_threshold</code>) run on every hook ingest — <em>after</em> the transaction commits and the response is sent, fully try/catch-guarded, so alerting can never slow or fail hook delivery. Time-based rules (<code>inactivity</code>, <code>status_duration</code>) run on an unref'd 60-second sweep. Enabled rules are cached in memory and invalidated on every edit. Fired alerts persist to <code>alert_events</code> and broadcast an <code>alert_triggered</code> WebSocket message.":
      "Các quy tắc theo sự kiện (<code>event_pattern</code>, <code>token_threshold</code>) chạy mỗi khi có hook nhập vào — <em>sau khi</em> giao dịch được commit và phản hồi đã được gửi, được bảo vệ hoàn toàn bằng try/catch, nên việc cảnh báo không bao giờ có thể làm chậm hoặc làm hỏng việc gửi hook. Các quy tắc theo thời gian (<code>inactivity</code>, <code>status_duration</code>) chạy trên một lượt quét 60 giây được unref. Các quy tắc đã bật được lưu cache trong bộ nhớ và bị vô hiệu hóa sau mỗi lần chỉnh sửa. Các cảnh báo đã kích hoạt được lưu vào <code>alert_events</code> và phát đi một thông điệp WebSocket <code>alert_triggered</code>.",
    "Slack, Discord, Microsoft Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, and Pipedream — plus a generic JSON endpoint. A declarative <strong>provider registry</strong> describes each one's payload formatter, URL resolution, auth headers, and credential fields, so adding a provider is a single server-side entry that surfaces in the UI with no front-end change.":
      "Slack, Discord, Microsoft Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n và Pipedream — cùng với một điểm cuối JSON tổng quát. Một <strong>sổ đăng ký nhà cung cấp</strong> mang tính khai báo mô tả bộ định dạng payload, cách phân giải URL, các tiêu đề xác thực và các trường thông tin xác thực của mỗi nhà cung cấp, nên việc thêm một nhà cung cấp chỉ là một mục duy nhất ở phía máy chủ và sẽ xuất hiện trong giao diện mà không cần thay đổi front-end.",
    'Each delivery POSTs with an <code>AbortController</code> timeout and bounded retry/backoff (retries transport errors, 429, and 5xx — never other 4xx), then records the attempt-chain in <code>webhook_deliveries</code>. A provider can also veto a 2xx whose body signals failure (Splunk On-Call returns 200 with <code>result:"failure"</code>). Delivery is <strong>detached and fail-safe</strong> — it never throws into, slows, or blocks the alert path.':
      'Mỗi lần gửi đều thực hiện POST với một thời gian chờ <code>AbortController</code> và cơ chế thử lại/lùi (backoff) có giới hạn (thử lại với lỗi truyền tải, 429 và 5xx — không bao giờ với các 4xx khác), sau đó ghi lại chuỗi các lần thử vào <code>webhook_deliveries</code>. Một nhà cung cấp cũng có thể phủ quyết một mã 2xx mà thân phản hồi báo hiệu thất bại (Splunk On-Call trả về 200 kèm <code>result:"failure"</code>). Việc gửi là <strong>tách rời và an toàn khi lỗi</strong> — nó không bao giờ ném lỗi vào, làm chậm hay chặn đường dẫn cảnh báo.',
    "Target URLs are masked (host + last 4 chars), and secrets / credential fields (routing keys, API keys, bot tokens) plus custom-header values are redacted in every API response — the full URL and secrets are stored server-side and never leave it. Generic endpoints support optional <strong>HMAC-SHA256</strong> body signing (<code>X-Webhook-Signature</code> + <code>X-Webhook-Timestamp</code>) so receivers can verify authenticity.":
      "Các URL đích được che (host + 4 ký tự cuối), và các trường bí mật / thông tin xác thực (khóa định tuyến, khóa API, token bot) cùng các giá trị tiêu đề tùy chỉnh đều được ẩn trong mọi phản hồi API — URL đầy đủ và các bí mật được lưu ở phía máy chủ và không bao giờ rời khỏi đó. Các điểm cuối tổng quát hỗ trợ tùy chọn ký thân bằng <strong>HMAC-SHA256</strong> (<code>X-Webhook-Signature</code> + <code>X-Webhook-Timestamp</code>) để bên nhận có thể xác minh tính xác thực.",
    'Every alert-rule field has a help tooltip — the event-type, tool-name, and summary-contains fields include example chips of real hook events and built-in tool names. Each webhook provider ships a collapsible step-by-step setup guide linking to the official docs. A one-click <strong>"Send test"</strong> probe fires a synthetic alert and reports the delivery result inline, and targets can be scoped to specific rules. Fully localized (en / zh / vi / ko).':
      "Mỗi trường của quy tắc cảnh báo đều có chú giải trợ giúp — các trường event-type, tool-name và summary-contains bao gồm các chip ví dụ về sự kiện hook thật và tên công cụ tích hợp sẵn. Mỗi nhà cung cấp webhook đi kèm một hướng dẫn thiết lập từng bước có thể thu gọn, liên kết tới tài liệu chính thức. Một thăm dò <strong>“Send test”</strong> bằng một cú nhấp sẽ kích hoạt một cảnh báo tổng hợp và báo cáo kết quả gửi ngay tại chỗ, và các đích có thể được giới hạn theo các quy tắc cụ thể. Được bản địa hóa hoàn toàn (en / zh / vi / ko).",
    "Provider(s)": "Nhà cung cấp",
    "Payload format": "Định dạng payload",
    "URL / credentials": "URL / thông tin xác thực",
    "Block Kit (header + section + context)": "Block Kit (header + section + context)",
    "Rich embed": "Embed phong phú (rich embed)",
    "Adaptive Card in a Workflows <code>message</code> envelope":
      "Adaptive Card trong một phong bì <code>message</code> của Workflows",
    "Power Automate Workflows URL": "Power Automate Workflows URL",
    "Text message (basic markdown)": "Tin nhắn văn bản (markdown cơ bản)",
    "Space webhook URL": "Space webhook URL",
    "Slack-style legacy attachments": "Tệp đính kèm kiểu cũ theo phong cách Slack",
    "Bot API <code>sendMessage</code> (HTML)": "Bot API <code>sendMessage</code> (HTML)",
    "Bot token + chat ID (URL derived)": "Bot token + chat ID (URL được suy ra)",
    "Events API v2 trigger (with <code>dedup_key</code>)":
      "Kích hoạt Events API v2 (kèm <code>dedup_key</code>)",
    "Routing key (URL prefilled)": "Khóa định tuyến (URL điền sẵn)",
    "Alert API": "Alert API",
    "API key (GenieKey header) + region": "Khóa API (tiêu đề GenieKey) + vùng",
    "VictorOps REST": "VictorOps REST",
    "REST endpoint URL (key embedded)": "URL điểm cuối REST (khóa được nhúng)",
    "Stable <code>{ event, alert }</code> JSON envelope":
      "Phong bì JSON <code>{ event, alert }</code> ổn định",
    "Endpoint URL (+ optional HMAC &amp; headers)": "URL điểm cuối (+ HMAC &amp; tiêu đề tùy chọn)",
    "Additive &amp; non-blocking by design": "Mang tính bổ sung &amp; không chặn theo thiết kế",
    "Two new tables — <code>webhook_targets</code> (config; survives Clear Data like alert rules) and <code>webhook_deliveries</code> (audit log) — with no changes to existing tables, response shapes, or WebSocket message types. Webhook dispatch is fire-and-forget off the alert path, so a slow or failing endpoint can never slow or break alert firing or hook ingestion.":
      "Hai bảng mới — <code>webhook_targets</code> (cấu hình; tồn tại qua Clear Data giống như các quy tắc cảnh báo) và <code>webhook_deliveries</code> (nhật ký kiểm toán) — mà không thay đổi các bảng hiện có, hình dạng phản hồi hay các loại thông điệp WebSocket. Việc điều phối webhook là kiểu phát-rồi-quên nằm ngoài đường dẫn cảnh báo, nên một điểm cuối chậm hoặc lỗi không bao giờ có thể làm chậm hoặc phá vỡ việc kích hoạt cảnh báo hay việc nhập hook.",
    "Provider setup steps can drift":
      "Các bước thiết lập của nhà cung cấp có thể thay đổi theo thời gian",
    "Microsoft retired classic Office 365 connectors in 2025, so Teams uses an Adaptive Card delivered via Power Automate <strong>Workflows</strong>. More broadly, provider setup UIs change often — the in-app guides say so and link to each provider's official docs. Always confirm against the source.":
      "Microsoft đã ngừng các connector Office 365 cổ điển vào năm 2025, nên Teams dùng một Adaptive Card được gửi qua Power Automate <strong>Workflows</strong>. Rộng hơn, giao diện thiết lập của các nhà cung cấp thường xuyên thay đổi — các hướng dẫn trong ứng dụng cũng nói vậy và liên kết tới tài liệu chính thức của từng nhà cung cấp. Luôn xác nhận lại với nguồn gốc.",
    '<span class="caption-icon">⬆</span> Update Notifier — version comparison modal with one-click copy of the update command. No automatic self-restart; you stay in control of when upgrades happen':
      '<span class="caption-icon">⬆</span> Update Notifier — hộp thoại so sánh phiên bản với khả năng sao chép lệnh cập nhật chỉ bằng một cú nhấp. Không tự khởi động lại tự động; bạn luôn kiểm soát thời điểm nâng cấp diễn ra',
    "A detection-only subsystem that tells the user when the dashboard's git checkout is behind the canonical default branch. <strong>Branch- and fork-aware:</strong> if an <code>upstream</code> remote is configured (the standard convention for forks), it takes priority over <code>origin</code>; the chosen remote's <code>master</code> / <code>main</code> / <code>HEAD</code> is the comparison ref. The printed command adapts to the user's situation — <code>git pull --ff-only</code> only when their branch actually tracks the canonical ref, otherwise <code>git fetch</code> (with a fast-forward merge in the fork case). The server <strong>never</strong> pulls or restarts itself — the user runs the command in a terminal — so the mechanism cannot break dev sessions, pm2/systemd/launchd/Docker supervision, or leave orphaned processes.":
      "Một hệ thống con chỉ phát hiện, báo cho người dùng biết khi bản checkout git của bảng điều khiển bị tụt lại sau nhánh mặc định chính thức. <strong>Nhận biết nhánh và fork:</strong> nếu một remote <code>upstream</code> được cấu hình (quy ước tiêu chuẩn cho các fork), nó được ưu tiên hơn <code>origin</code>; <code>master</code> / <code>main</code> / <code>HEAD</code> của remote được chọn chính là tham chiếu so sánh. Lệnh được in ra thích ứng theo tình huống của người dùng — <code>git pull --ff-only</code> chỉ khi nhánh của họ thực sự theo dõi tham chiếu chính thức, ngược lại là <code>git fetch</code> (kèm một lần hợp nhất tua nhanh trong trường hợp fork). Máy chủ <strong>không bao giờ</strong> tự kéo về hay tự khởi động lại — người dùng chạy lệnh trong một terminal — nên cơ chế này không thể phá vỡ các phiên dev, sự giám sát của pm2/systemd/launchd/Docker, hay để lại các tiến trình mồ côi.",
    "A shell-less <code>git fetch</code> with a 120-second timeout, followed by a <code>rev-list</code> against the tracked upstream. Each call runs from <code>server/lib/update-check.js</code> and returns a structured payload — never throws — so a flaky remote can&apos;t stall the dashboard.":
      "Một lệnh <code>git fetch</code> không qua shell với thời gian chờ 120 giây, theo sau là một <code>rev-list</code> đối chiếu với upstream được theo dõi. Mỗi lệnh gọi chạy từ <code>server/lib/update-check.js</code> và trả về một payload có cấu trúc — không bao giờ ném ngoại lệ — nên một remote chập chờn không thể làm treo bảng điều khiển.",
    "<code>update-scheduler.js</code> polls every five minutes with <code>.unref()</code> timers so it never blocks shutdown, de-duplicates with a fingerprint over the status payload, and announces up-to-date → behind transitions in a framed stdout block. Disable entirely with <code>DASHBOARD_UPDATE_CHECK=0</code>.":
      "<code>update-scheduler.js</code> thăm dò mỗi năm phút bằng các bộ định thời <code>.unref()</code> nên không bao giờ chặn việc tắt, khử trùng lặp bằng một dấu vân tay trên payload trạng thái, và thông báo các chuyển đổi từ cập-nhật → tụt-lại trong một khối stdout có khung. Tắt hoàn toàn bằng <code>DASHBOARD_UPDATE_CHECK=0</code>.",
    "Each status payload carries a <code>manual_command</code> shaped for the user's actual situation: <code>git pull --ff-only</code> on a tracked canonical branch, <code>git fetch &amp;&amp; git merge --ff-only</code> for forks where local tracks the wrong remote, and a plain <code>git fetch</code> on a feature branch where pulling would update the wrong branch. Install / build steps are appended only when the working tree is actually being rewritten.":
      "Mỗi payload trạng thái mang theo một <code>manual_command</code> được định hình cho tình huống thực tế của người dùng: <code>git pull --ff-only</code> trên một nhánh chính thức được theo dõi, <code>git fetch &amp;&amp; git merge --ff-only</code> cho các fork mà bản cục bộ theo dõi sai remote, và một lệnh <code>git fetch</code> thuần túy trên một nhánh tính năng nơi việc kéo về sẽ cập nhật nhầm nhánh. Các bước cài đặt / build chỉ được thêm vào khi cây làm việc thực sự đang bị ghi đè lại.",
    "A modal opens automatically when upstream is ahead; ESC or a backdrop click dismisses it. A persistent sidebar button stays in the footer — emerald when behind, amber when the last check errored — so users can always trigger a fresh check on demand.":
      "Một hộp thoại tự động mở ra khi upstream đi trước; nhấn ESC hoặc nhấp vào nền sẽ đóng nó lại. Một nút thanh bên cố định nằm ở chân trang — màu lục bảo khi tụt lại, màu hổ phách khi lần kiểm tra trước bị lỗi — nên người dùng luôn có thể kích hoạt một lần kiểm tra mới theo nhu cầu.",
    "Non-git installs, no remotes configured, offline fetches, and unresolvable upstream refs all return tagged payloads instead of throwing. The sidebar badge turns amber on fetch errors and the modal stays suppressed until a successful check arrives — no spinners, no stuck state.":
      "Các bản cài đặt phi git, không cấu hình remote nào, các lần fetch ngoại tuyến, và các tham chiếu upstream không thể phân giải đều trả về payload có gắn thẻ thay vì ném ngoại lệ. Huy hiệu ở thanh bên chuyển sang màu hổ phách khi fetch bị lỗi và hộp thoại vẫn bị ẩn cho đến khi có một lần kiểm tra thành công — không có vòng xoay, không có trạng thái kẹt.",
    "Dismissal is keyed by the upstream SHA in <code>localStorage</code>, so closing the modal silences it only for <em>that</em> commit — a newer upstream commit re-opens it automatically. Clicking the sidebar button is an explicit intent signal and clears the stored dismissal before firing a fresh check.":
      "Việc bỏ qua được đánh khóa theo SHA upstream trong <code>localStorage</code>, nên đóng hộp thoại chỉ làm im lặng nó cho <em>commit đó</em> — một commit upstream mới hơn sẽ tự động mở lại nó. Nhấp vào nút thanh bên là một tín hiệu ý định rõ ràng và sẽ xóa trạng thái bỏ qua đã lưu trước khi kích hoạt một lần kiểm tra mới.",
    "Read-only check — runs <code>git fetch</code>, compares, returns the payload.":
      "Kiểm tra chỉ-đọc — chạy <code>git fetch</code>, so sánh, trả về payload.",
    "Same check, and broadcasts <code>update_status</code> over WebSocket so every connected client re-syncs at once.":
      "Cùng một lần kiểm tra, và phát sóng <code>update_status</code> qua WebSocket để mọi máy khách đang kết nối đồng bộ lại cùng lúc.",
    "<strong>Detection-only by design</strong>": "<strong>Chỉ phát hiện theo thiết kế</strong>",
    "There is no <code>POST /api/updates/apply</code> and no in-process restart helper. A process cannot reliably replace itself without an external supervisor, and <code>npm run dev</code>, <code>npm start</code>, pm2, systemd, launchd, and Docker each need different restart logic. Detection-only keeps the mechanism portable across every supervisor and OS, and leaves the dashboard's lifecycle owned by whatever started it. The user runs the printed command in their own shell.":
      "Không có <code>POST /api/updates/apply</code> và không có trợ thủ khởi động lại trong tiến trình. Một tiến trình không thể tự thay thế chính nó một cách đáng tin cậy nếu thiếu một trình giám sát bên ngoài, và <code>npm run dev</code>, <code>npm start</code>, pm2, systemd, launchd, cùng Docker mỗi cái cần một logic khởi động lại khác nhau. Việc chỉ phát hiện giữ cho cơ chế khả chuyển trên mọi trình giám sát và hệ điều hành, và để vòng đời của bảng điều khiển thuộc về thứ đã khởi chạy nó. Người dùng chạy lệnh được in ra trong shell của chính họ.",
    '<span class="caption-icon">◈</span> Connection Status — sidebar-launched details modal with WebSocket endpoint, connection uptime, 60-second throughput sparkline, top event-type breakdown, and recent activity list':
      '<span class="caption-icon">◈</span> Connection Status — hộp thoại chi tiết khởi chạy từ thanh bên với endpoint WebSocket, thời gian kết nối hoạt động, biểu đồ tia thông lượng 60 giây, phân tách các loại sự kiện hàng đầu, và danh sách hoạt động gần đây',
    'The <strong>Live</strong> / <strong>Disconnected</strong> pill in the sidebar footer opens a small details panel about the dashboard\'s WebSocket transport. It surfaces the active <code>ws://</code> endpoint, how long the current socket has been up, total events received, the top event types as a horizontal bar chart, a 60-second throughput sparkline, and the most recent 8 events as an activity list. Cumulative stats (totals, type breakdown, recent list) persist across reloads via <code>localStorage</code> under <code>sidebar-connection-stats</code>; the rolling sparkline and "connected since" timer are intentionally ephemeral since they only make sense relative to "now". A <strong>Reset</strong> button clears everything on demand.':
      'Viên thuốc <strong>Live</strong> / <strong>Disconnected</strong> ở chân thanh bên mở ra một bảng chi tiết nhỏ về tầng vận chuyển WebSocket của bảng điều khiển. Nó hiển thị endpoint <code>ws://</code> đang hoạt động, socket hiện tại đã hoạt động bao lâu, tổng số sự kiện đã nhận, các loại sự kiện hàng đầu dưới dạng biểu đồ thanh ngang, một biểu đồ tia thông lượng 60 giây, và 8 sự kiện gần nhất dưới dạng danh sách hoạt động. Các thống kê tích lũy (tổng số, phân tách theo loại, danh sách gần đây) được giữ qua các lần tải lại thông qua <code>localStorage</code> dưới khóa <code>sidebar-connection-stats</code>; biểu đồ tia cuộn và bộ đếm thời gian "kết nối từ" được cố ý làm tạm thời vì chúng chỉ có ý nghĩa so với "bây giờ". Một nút <strong>Reset</strong> xóa mọi thứ theo nhu cầu.',
    "Implementation note: per-event state lives in <code>useRef</code> buffers on the sidebar so the WS firehose never re-renders the navigation tree — the modal does its own one-second tick to sample the refs while open. Writes are throttled (single-flight timer, 2 s window) and flushed on <code>pagehide</code> / <code>visibilitychange</code> so the latest events aren't lost to the throttle window. The modal itself is portalled to <code>document.body</code> so the sidebar's stacking context can't trap it.":
      "Ghi chú triển khai: trạng thái theo từng sự kiện nằm trong các bộ đệm <code>useRef</code> trên thanh bên nên dòng sự kiện WS dồn dập không bao giờ render lại cây điều hướng — hộp thoại tự thực hiện một nhịp mỗi giây để lấy mẫu các ref khi đang mở. Việc ghi được điều tiết (bộ định thời chạy-đơn, cửa sổ 2 giây) và được xả ra khi <code>pagehide</code> / <code>visibilitychange</code> để các sự kiện mới nhất không bị mất vào cửa sổ điều tiết. Bản thân hộp thoại được portal sang <code>document.body</code> nên ngữ cảnh xếp lớp của thanh bên không thể giam giữ nó.",
    "The entire UI ships in <strong>four languages — English, 简体中文, Tiếng Việt, and 한국어</strong> — built on <code>i18next</code> + <code>react-i18next</code> with <code>i18next-browser-languagedetector</code>. Coverage is end-to-end: every page, chart tooltip, Settings flow, Workflow narrative, Config Explorer tab, Run page, and the Alerts rule-help tooltips + webhook setup guides are translated. Switch languages from the sidebar (EN / 中文 / VI / 한국어) — the choice persists in <code>localStorage</code>.":
      "Toàn bộ giao diện được phát hành bằng <strong>bốn ngôn ngữ — English, 简体中文, Tiếng Việt và 한국어</strong> — xây dựng trên <code>i18next</code> + <code>react-i18next</code> cùng <code>i18next-browser-languagedetector</code>. Phạm vi bao phủ là đầu-cuối: mọi trang, chú giải biểu đồ, luồng Settings, tường thuật Workflow, tab Config Explorer, trang Run, cùng các chú giải trợ giúp quy tắc Alerts + hướng dẫn thiết lập webhook đều được dịch. Chuyển ngôn ngữ từ thanh bên (EN / 中文 / VI / 한국어) — lựa chọn được giữ trong <code>localStorage</code>.",
    'Translations are split into per-area JSON namespaces (<code>common</code>, <code>nav</code>, <code>dashboard</code>, <code>sessions</code>, <code>analytics</code>, <code>workflows</code>, <code>settings</code>, <code>kanban</code>, <code>run</code>, <code>ccConfig</code>, <code>alerts</code>, <code>errors</code>, <code>updates</code>) under <code>client/src/i18n/locales/&lt;lng&gt;/</code>. Components load only the namespaces they need via <code>useTranslation("…")</code>.':
      'Các bản dịch được chia thành các không gian tên JSON theo từng khu vực (<code>common</code>, <code>nav</code>, <code>dashboard</code>, <code>sessions</code>, <code>analytics</code>, <code>workflows</code>, <code>settings</code>, <code>kanban</code>, <code>run</code>, <code>ccConfig</code>, <code>alerts</code>, <code>errors</code>, <code>updates</code>) dưới <code>client/src/i18n/locales/&lt;lng&gt;/</code>. Các thành phần chỉ tải các không gian tên mà chúng cần thông qua <code>useTranslation("…")</code>.',
    "Language is detected from <code>localStorage</code> (<code>i18nextLng</code>) then the browser's <code>navigator</code> setting, and the choice is cached back to <code>localStorage</code>. <code>fallbackLng</code> is English and <code>nonExplicitSupportedLngs</code> resolves regional tags (e.g. <code>vi-VN</code> → <code>vi</code>), so any unmapped key falls back gracefully rather than rendering a raw key.":
      "Ngôn ngữ được phát hiện từ <code>localStorage</code> (<code>i18nextLng</code>) rồi đến thiết lập <code>navigator</code> của trình duyệt, và lựa chọn được lưu vào lại <code>localStorage</code>. <code>fallbackLng</code> là tiếng Anh và <code>nonExplicitSupportedLngs</code> phân giải các thẻ vùng (ví dụ <code>vi-VN</code> → <code>vi</code>), nên bất kỳ khóa nào chưa được ánh xạ đều quay lui một cách uyển chuyển thay vì hiển thị một khóa thô.",
    "Numbers, costs, dates, and relative times format against the active locale via a shared <code>getCurrentLocale()</code> helper, and plurals use i18next's <code>_one</code> / <code>_other</code> suffixes. Interpolated values (<code>{{count}}</code>, <code>{{provider}}</code>, …) keep sentences natural across languages.":
      "Số, chi phí, ngày tháng, và thời gian tương đối được định dạng theo locale đang hoạt động thông qua một trợ thủ <code>getCurrentLocale()</code> dùng chung, và số nhiều dùng các hậu tố <code>_one</code> / <code>_other</code> của i18next. Các giá trị nội suy (<code>{{count}}</code>, <code>{{provider}}</code>, …) giữ cho câu văn tự nhiên qua các ngôn ngữ.",
    "Domain terms that are proper nouns or code stay untranslated in every locale — <em>Agent</em>, <em>Subagent</em>, hook event names (<code>PostToolUse</code>), tool names (<code>Bash</code>), and webhook provider names (Slack, PagerDuty). Only the surrounding prose is localized, so instructions stay accurate.":
      "Các thuật ngữ chuyên ngành là danh từ riêng hoặc mã sẽ không được dịch trong mọi locale — <em>Agent</em>, <em>Subagent</em>, tên sự kiện hook (<code>PostToolUse</code>), tên công cụ (<code>Bash</code>), và tên nhà cung cấp webhook (Slack, PagerDuty). Chỉ phần văn xuôi xung quanh được bản địa hóa, nên các hướng dẫn vẫn chính xác.",
    "<strong>Adding a language</strong>": "<strong>Thêm một ngôn ngữ</strong>",
    "Copy <code>client/src/i18n/locales/en/</code> to a new locale folder, translate the JSON values (leaving keys and technical terms intact), then register the bundle and add the tag to <code>supportedLngs</code> in <code>client/src/i18n/index.ts</code>. Missing keys fall back to English automatically, so even a partial translation ships cleanly.":
      "Sao chép <code>client/src/i18n/locales/en/</code> sang một thư mục locale mới, dịch các giá trị JSON (giữ nguyên các khóa và thuật ngữ kỹ thuật), rồi đăng ký bundle và thêm thẻ vào <code>supportedLngs</code> trong <code>client/src/i18n/index.ts</code>. Các khóa bị thiếu sẽ tự động quay lui về tiếng Anh, nên ngay cả một bản dịch một phần cũng phát hành gọn gàng.",
    "<strong>Tabby</strong> is a cute SVG cat companion pinned to the <strong>edges of every page</strong> of the dashboard. It is always present and turns the live session stream into glanceable, ambient feedback — calm when idle, alert when something needs attention, and celebratory when a run finishes. Tabby is built entirely on the existing <code>eventBus</code> WebSocket stream: <strong>no new backend, no API key, and no new dependencies</strong>. The component lives in <code>client/src/components/Tabby/</code> and can be toggled on or off in Settings page.":
      "<strong>Tabby</strong> là một chú mèo SVG dễ thương đồng hành, được ghim vào <strong>các rìa của mọi trang</strong> trong bảng điều khiển. Nó luôn hiện diện và biến luồng phiên trực tiếp thành phản hồi mang tính nền, dễ nhìn thoáng qua — bình thản khi rảnh rỗi, cảnh giác khi có điều gì cần chú ý, và ăn mừng khi một lần chạy hoàn tất. Tabby được xây dựng hoàn toàn trên luồng WebSocket <code>eventBus</code> hiện có: <strong>không có backend mới, không có API key, và không có phụ thuộc mới</strong>. Thành phần này nằm trong <code>client/src/components/Tabby/</code> và có thể bật hoặc tắt trong trang Settings.",
    '<span class="caption-icon">📥</span> Tabby Companion — a cute SVG cat in the edges of every page, reacting in real time to the live session stream with eight distinct moods and animations, auto-surfacing speech bubbles for notable events, and serving as the gateway to a status panel and Ask box':
      '<span class="caption-icon">📥</span> Tabby Companion — một chú mèo SVG dễ thương ở các rìa của mọi trang, phản ứng theo thời gian thực với luồng phiên trực tiếp bằng tám tâm trạng và hoạt ảnh khác biệt, tự động bật lên các bong bóng thoại cho các sự kiện đáng chú ý, và đóng vai trò cổng vào một bảng trạng thái và ô Ask',
    "Tabby derives one of eight moods from the live session WebSocket stream, each with its own animation. The eyes track your cursor, and the active mood drives a distinct motion cue.":
      "Tabby suy ra một trong tám tâm trạng từ luồng WebSocket phiên trực tiếp, mỗi cái có hoạt ảnh riêng. Đôi mắt dõi theo con trỏ của bạn, và tâm trạng đang hoạt động điều khiển một tín hiệu chuyển động riêng biệt.",
    "Notable events — session started or finished, errors, and run completed — automatically surface a speech bubble. Bubbles are <strong>throttled and coalesced</strong> so bursts of events never spam you, and they can be muted on demand. Everything reflects in real time over the existing <code>eventBus</code> WebSocket channel, with no polling and no extra services.":
      "Các sự kiện đáng chú ý — phiên bắt đầu hoặc kết thúc, lỗi, và lần chạy hoàn tất — tự động làm hiện lên một bong bóng thoại. Các bong bóng được <strong>điều tiết và gộp lại</strong> nên các đợt sự kiện dồn dập không bao giờ làm phiền bạn, và chúng có thể được tắt tiếng theo nhu cầu. Mọi thứ phản ánh theo thời gian thực qua kênh WebSocket <code>eventBus</code> hiện có, không thăm dò và không có dịch vụ phụ.",
    "Click the cat — or press <code>⌘B</code> / <code>Ctrl+B</code> — to open Tabby's panel (<code>Esc</code> closes it). The panel groups a live status line, quick actions, and an Ask box.":
      "Nhấp vào chú mèo — hoặc nhấn <code>⌘B</code> / <code>Ctrl+B</code> — để mở bảng của Tabby (<code>Esc</code> đóng nó lại). Bảng này nhóm một dòng trạng thái trực tiếp, các hành động nhanh, và một ô Ask.",
    "<strong>Live status line:</strong> <em>N live · M errored · connection state</em>, updated from cached data.":
      "<strong>Dòng trạng thái trực tiếp:</strong> <em>N live · M errored · connection state</em>, được cập nhật từ dữ liệu đã lưu vào bộ nhớ đệm.",
    "<strong>Quick actions:</strong> jump to Run Claude, Activity, Sessions, or errored sessions; mute bubbles; clear alerts.":
      "<strong>Hành động nhanh:</strong> nhảy tới Run Claude, Activity, Sessions, hoặc các phiên bị lỗi; tắt tiếng bong bóng; xóa cảnh báo.",
    "<strong>Ask box:</strong> answers simple status questions locally from cached data (&ldquo;what's running&rdquo;, &ldquo;any errors&rdquo;, &ldquo;status&rdquo;).":
      "<strong>Ô Ask:</strong> trả lời tại chỗ các câu hỏi trạng thái đơn giản từ dữ liệu đã lưu vào bộ nhớ đệm (&ldquo;what's running&rdquo;, &ldquo;any errors&rdquo;, &ldquo;status&rdquo;).",
    "The Ask box answers status questions instantly and offline from cached data. For anything beyond a simple status question, Tabby hands off to the existing <strong>Run Claude</strong> page (<code>/run?prompt=...</code>) to spawn a real Claude Code session — so there is never a separate model call, key, or service to manage.":
      "Ô Ask trả lời các câu hỏi trạng thái tức thì và ngoại tuyến từ dữ liệu đã lưu vào bộ nhớ đệm. Đối với bất cứ điều gì vượt ra ngoài một câu hỏi trạng thái đơn giản, Tabby chuyển giao cho trang <strong>Run Claude</strong> hiện có (<code>/run?prompt=...</code>) để khởi tạo một phiên Claude Code thực sự — nên không bao giờ có một lệnh gọi mô hình, khóa, hay dịch vụ riêng nào phải quản lý.",
    "Fully keyboard operable: <code>⌘B</code> / <code>Ctrl+B</code> to open, <code>Esc</code> to close.":
      "Hoàn toàn thao tác được bằng bàn phím: <code>⌘B</code> / <code>Ctrl+B</code> để mở, <code>Esc</code> để đóng.",
    "Status and bubbles announce via <code>aria-live</code> for screen readers.":
      "Trạng thái và bong bóng thông báo qua <code>aria-live</code> dành cho trình đọc màn hình.",
    "Respects <code>prefers-reduced-motion</code> to calm animations.":
      "Tôn trọng <code>prefers-reduced-motion</code> để làm dịu các hoạt ảnh.",
    "Degrades gracefully to a calm, dimmed disconnected state when offline.":
      "Suy giảm một cách uyển chuyển về một trạng thái mất kết nối bình thản, mờ đi khi ngoại tuyến.",
    Endpoint: "Endpoint",
    Mood: "Tâm trạng",
    "When it appears": "Khi nào nó xuất hiện",
    Animation: "Hoạt ảnh",
    Idle: "Idle",
    "Nothing notable happening": "Không có gì đáng chú ý đang xảy ra",
    "Gentle tail flick": "Phẩy đuôi nhẹ nhàng",
    Watching: "Watching",
    "Sessions active, observing the stream": "Có phiên đang hoạt động, đang quan sát luồng",
    "Ear perk, cursor-tracking eyes": "Vểnh tai, mắt dõi theo con trỏ",
    Happy: "Happy",
    "A run completed successfully": "Một lần chạy hoàn tất thành công",
    Sparkle: "Lấp lánh",
    Worried: "Worried",
    "Something looks off": "Có gì đó trông không ổn",
    "Head bob": "Gật đầu",
    Stuck: "Stuck",
    "A session appears blocked": "Một phiên có vẻ bị chặn",
    "Shake + alert <code>!</code>": "Rung lắc + cảnh báo <code>!</code>",
    Thinking: "Thinking",
    "Work in progress": "Công việc đang diễn ra",
    Sleeping: "Sleeping",
    "Quiet for a while": "Yên ắng trong một lúc",
    Zzz: "Zzz",
    Disconnected: "Disconnected",
    "WebSocket offline": "WebSocket ngoại tuyến",
    "Calm, dimmed state": "Trạng thái bình thản, mờ đi",
    "Development vs production deployment topology":
      "Cấu trúc triển khai phát triển so với sản xuất",
    Aspect: "Khía cạnh",
    Development: "Phát triển",
    Production: "Sản xuất",
    Processes: "Tiến trình",
    "2 (Express + Vite)": "2 (Express + Vite)",
    "1 (Express only)": "1 (chỉ Express)",
    "Client URL": "URL máy khách",
    "API proxy": "Proxy API",
    "Vite proxies <code>/api</code> + <code>/ws</code> to :4820":
      "Vite chuyển tiếp <code>/api</code> + <code>/ws</code> tới :4820",
    "Same origin, no proxy": "Cùng nguồn gốc, không có proxy",
    "File watching": "Theo dõi tệp",
    "<code>node --watch</code> + Vite HMR": "<code>node --watch</code> + Vite HMR",
    None: "Không có",
    "Source maps": "Source map",
    Inline: "Nội tuyến",
    "External files": "Tệp bên ngoài",
    "<strong>A third way to run: the Desktop App (macOS &amp; Windows)</strong>":
      "<strong>Một cách thứ ba để chạy: Ứng dụng máy tính để bàn (macOS &amp; Windows)</strong>",
    'Beyond development and standalone production, the dashboard also ships as a native desktop app — a macOS <code>.app</code> and a Windows <code>.exe</code> — that embeds the same production server in-process, no terminal required. See the <a href="#desktop-app">Desktop App (macOS &amp; Windows)</a> section for download, build, and install instructions.':
      'Ngoài chế độ phát triển và sản xuất độc lập, bảng điều khiển còn được phát hành dưới dạng ứng dụng máy tính để bàn gốc — một <code>.app</code> cho macOS và một <code>.exe</code> cho Windows — nhúng cùng một máy chủ sản xuất ngay trong tiến trình, không cần terminal. Xem phần <a href="#desktop-app">Ứng dụng máy tính để bàn (macOS &amp; Windows)</a> để biết hướng dẫn tải xuống, xây dựng và cài đặt.',
    "The production image is OCI-compatible and works with both Docker and Podman. The server listens on <code>4820</code>, reads legacy Claude history from a read-only mount, and persists SQLite data under <code>/app/data</code>.":
      "Image sản xuất tương thích OCI và hoạt động với cả Docker lẫn Podman. Máy chủ lắng nghe trên <code>4820</code>, đọc lịch sử Claude cũ từ một điểm gắn kết chỉ đọc, và lưu dữ liệu SQLite vào <code>/app/data</code>.",
    "Container image build and runtime mounts":
      "Quá trình xây dựng image container và các điểm gắn kết khi chạy",
    Mount: "Điểm gắn kết",
    "Read historical Claude session files for import without modifying them":
      "Đọc các tệp phiên Claude lịch sử để nhập vào mà không sửa đổi chúng",
    "Persist the SQLite database across rebuilds and container restarts":
      "Lưu giữ cơ sở dữ liệu SQLite qua các lần xây dựng lại và khởi động lại container",
    "<strong>Hooks still run on the host</strong>": "<strong>Hooks vẫn chạy trên máy chủ</strong>",
    "Claude Code fires hooks from the host machine, not from inside the container. After the container is healthy on <code>http://localhost:4820</code>, run <code>npm run install-hooks</code> on the host so hook events post back to the containerized server.":
      "Claude Code kích hoạt các hook từ máy chủ, không phải từ bên trong container. Sau khi container hoạt động bình thường trên <code>http://localhost:4820</code>, hãy chạy <code>npm run install-hooks</code> trên máy chủ để các sự kiện hook gửi trở lại máy chủ được container hóa.",
    "A multi-stage <code>Dockerfile</code> and <code>docker-compose.yml</code> are included. Both <strong>Docker</strong> and <strong>Podman</strong> are fully supported — the image is OCI-compliant.":
      "Dự án bao gồm một <code>Dockerfile</code> nhiều giai đoạn và <code>docker-compose.yml</code>. Cả <strong>Docker</strong> lẫn <strong>Podman</strong> đều được hỗ trợ đầy đủ — image tuân thủ OCI.",
    "Read-only access to legacy session history for automatic import on startup":
      "Quyền truy cập chỉ đọc vào lịch sử phiên cũ để tự động nhập khi khởi động",
    "Persists the SQLite database across container restarts":
      "Lưu giữ cơ sở dữ liệu SQLite qua các lần khởi động lại container",
    "The Dockerfile uses three stages to minimize the final image size:":
      "Dockerfile sử dụng ba giai đoạn để giảm thiểu kích thước image cuối cùng:",
    Stage: "Giai đoạn",
    "Installs production <code>node_modules</code> on <code>node:22-alpine</code>. <code>better-sqlite3</code> is optional — if prebuilds are unavailable, the server falls back to built-in <code>node:sqlite</code>":
      "Cài đặt <code>node_modules</code> sản xuất trên <code>node:22-alpine</code>. <code>better-sqlite3</code> là tùy chọn — nếu không có bản dựng sẵn, máy chủ sẽ quay về dùng <code>node:sqlite</code> tích hợp sẵn",
    "Runs <code>npm ci</code> + <code>vite build</code> to produce optimized static assets":
      "Chạy <code>npm ci</code> + <code>vite build</code> để tạo ra các tài nguyên tĩnh được tối ưu hóa",
    "Clean <code>node:22-alpine</code> with only <code>node_modules</code>, server code, and <code>client/dist</code>":
      "Bản <code>node:22-alpine</code> sạch chỉ với <code>node_modules</code>, mã máy chủ và <code>client/dist</code>",
    "<strong>Hook note</strong>": "<strong>Lưu ý về hook</strong>",
    "Claude Code hooks run on the host, not inside the container. The containerized server receives hook events via HTTP on <code>localhost:4820</code>. Run <code>npm run install-hooks</code> on the host after starting the container.":
      "Các hook của Claude Code chạy trên máy chủ, không phải bên trong container. Máy chủ được container hóa nhận các sự kiện hook qua HTTP trên <code>localhost:4820</code>. Hãy chạy <code>npm run install-hooks</code> trên máy chủ sau khi khởi động container.",
    Metric: "Chỉ số",
    "Server startup": "Khởi động máy chủ",
    "SQLite opens instantly; schema migration is idempotent":
      "SQLite mở ngay lập tức; việc di chuyển lược đồ là bất biến (idempotent)",
    "Hook latency": "Độ trễ hook",
    "Transaction + broadcast, no async I/O beyond SQLite":
      "Giao dịch + phát sóng, không có I/O bất đồng bộ ngoài SQLite",
    "Client JS bundle": "Gói JS máy khách",
    "WebSocket latency": "Độ trễ WebSocket",
    "Local loopback, JSON serialization only": "Vòng lặp cục bộ, chỉ tuần tự hóa JSON",
    "SQLite write throughput": "Thông lượng ghi SQLite",
    "WAL mode on SSD; far exceeds any hook event rate":
      "Chế độ WAL trên SSD; vượt xa mọi tốc độ sự kiện hook",
    "Max events before slowdown": "Số sự kiện tối đa trước khi chậm lại",
    "Pagination prevents full-table scans": "Phân trang ngăn việc quét toàn bộ bảng",
    "Server memory": "Bộ nhớ máy chủ",
    "SQLite in-process, no ORM overhead": "SQLite chạy trong tiến trình, không có chi phí ORM",
    "Client memory": "Bộ nhớ máy khách",
    "React + Tailwind, minimal runtime deps":
      "React + Tailwind, phụ thuộc thời gian chạy tối thiểu",
    "Input validation": "Kiểm tra dữ liệu đầu vào",
    "Required fields checked before DB operations; CHECK constraints on status enums":
      "Các trường bắt buộc được kiểm tra trước các thao tác DB; ràng buộc CHECK trên các enum trạng thái",
    "Hook safety": "An toàn của hook",
    "Hook handler always exits 0; 5s max lifetime; uses <code>127.0.0.1</code> not external hosts":
      "Trình xử lý hook luôn thoát với mã 0; vòng đời tối đa 5s; dùng <code>127.0.0.1</code> chứ không phải các host bên ngoài",
    CORS: "CORS",
    "Restricted to loopback origins, so cross-origin pages can't read responses; no-Origin clients like curl still work":
      "Giới hạn ở các nguồn loopback, nên các trang khác nguồn không thể đọc phản hồi; các client không có Origin như curl vẫn hoạt động",
    Authentication: "Xác thực",
    "Off by default since the loopback bind is the trust boundary; set <code>DASHBOARD_TOKEN</code> to require a bearer token on every <code>/api/*</code> request and the WebSocket when exposing on a LAN.":
      "Tắt theo mặc định vì việc liên kết loopback chính là ranh giới tin cậy; đặt <code>DASHBOARD_TOKEN</code> để yêu cầu một bearer token trên mọi yêu cầu <code>/api/*</code> và WebSocket khi để lộ trên mạng LAN.",
    Secrets: "Bí mật (secrets)",
    "No API keys, tokens, or credentials stored or transmitted anywhere":
      "Không lưu trữ hoặc truyền API key, token hay thông tin xác thực ở bất cứ đâu",
    "Dependency surface": "Bề mặt phụ thuộc",
    "5 runtime server deps, 6 runtime client deps (includes D3.js for Workflows) — minimal attack surface":
      "5 phụ thuộc runtime phía máy chủ, 6 phụ thuộc runtime phía client (bao gồm D3.js cho Workflows) — bề mặt tấn công tối thiểu",
    "Hooks only apply to sessions started <em>after</em> installation. Restart Claude Code after starting the dashboard.":
      "Hook chỉ áp dụng cho các phiên được khởi động <em>sau</em> khi cài đặt. Hãy khởi động lại Claude Code sau khi khởi động dashboard.",
    "On some systems the shell environment when Claude Code fires hooks may not include the full PATH. Test with <code>node --version</code>. If not found, use the absolute path to <code>node</code> in the hook command.":
      "Trên một số hệ thống, môi trường shell khi Claude Code kích hoạt hook có thể không bao gồm đầy đủ PATH. Hãy kiểm tra bằng <code>node --version</code>. Nếu không tìm thấy, hãy dùng đường dẫn tuyệt đối tới <code>node</code> trong lệnh hook.",
    Problem: "Vấn đề",
    Solution: "Giải pháp",
    "<code>better-sqlite3</code> errors during install":
      "Lỗi <code>better-sqlite3</code> trong quá trình cài đặt",
    "This is non-fatal — <code>better-sqlite3</code> is an optional dependency. On Node 22+ the server automatically falls back to built-in <code>node:sqlite</code>. On older Node versions, install Python 3 + C++ build tools, then run <code>npm rebuild better-sqlite3</code>. For the desktop app, the <code>desktop:install</code> preflight prints copy-pasteable per-OS setup guidance (incl. a no-toolchain alternative) when the native build fails.":
      "Đây không phải lỗi nghiêm trọng — <code>better-sqlite3</code> là một phụ thuộc tùy chọn. Trên Node 22+ máy chủ tự động chuyển sang dùng <code>node:sqlite</code> tích hợp sẵn. Trên các phiên bản Node cũ hơn, hãy cài Python 3 + công cụ build C++, rồi chạy <code>npm rebuild better-sqlite3</code>. Đối với ứng dụng desktop, bước kiểm tra trước <code>desktop:install</code> sẽ in ra hướng dẫn thiết lập theo từng hệ điều hành có thể sao chép-dán (kèm cả một phương án không cần toolchain) khi quá trình build native thất bại.",
    'Dashboard shows "Disconnected"': 'Dashboard hiển thị "Disconnected"',
    "Server is not running. Start it with <code>npm run dev</code>. Client auto-reconnects every 2s.":
      "Máy chủ chưa chạy. Hãy khởi động bằng <code>npm run dev</code>. Client tự động kết nối lại mỗi 2s.",
    "Events Today shows 0": "Events Today hiển thị 0",
    "Ensure you are on the latest version (timezone bug was fixed). Restart the server.":
      "Hãy đảm bảo bạn đang dùng phiên bản mới nhất (lỗi múi giờ đã được sửa). Sau đó khởi động lại máy chủ.",
    "Port 4820 already in use": "Cổng 4820 đã bị chiếm dụng",
    "Run <code>DASHBOARD_PORT=4821 npm run dev</code>, update Vite proxy in <code>client/vite.config.ts</code>, and re-run <code>npm run install-hooks</code>.":
      "Chạy <code>DASHBOARD_PORT=4821 npm run dev</code>, cập nhật proxy Vite trong <code>client/vite.config.ts</code>, rồi chạy lại <code>npm run install-hooks</code>.",
    "Stale seed data shown": "Hiển thị dữ liệu mẫu (seed) cũ",
    "Run <code>npm run clear-data</code> to wipe all rows, then restart.":
      "Chạy <code>npm run clear-data</code> để xóa toàn bộ các hàng, rồi khởi động lại.",
    "Hooks show validation error about matcher": "Hook hiển thị lỗi kiểm tra về matcher",
    'Ensure you\'re on the latest version — the hook format was updated to use <code>matcher: "*"</code> string (not object).':
      'Hãy đảm bảo bạn đang dùng phiên bản mới nhất — định dạng hook đã được cập nhật để dùng chuỗi <code>matcher: "*"</code> (không phải đối tượng).',
    '"SQLite backend not available" on startup': '"SQLite backend not available" khi khởi động',
    "Neither <code>better-sqlite3</code> nor <code>node:sqlite</code> could load. Upgrade to Node.js 22+ (recommended), or install Python 3 + C++ build tools and run <code>npm rebuild better-sqlite3</code>.":
      "Cả <code>better-sqlite3</code> lẫn <code>node:sqlite</code> đều không thể nạp được. Hãy nâng cấp lên Node.js 22+ (khuyến nghị), hoặc cài Python 3 + công cụ build C++ và chạy <code>npm rebuild better-sqlite3</code>.",
    "Docker container runs but no sessions appear":
      "Container Docker chạy nhưng không có phiên nào xuất hiện",
    "Hooks run on the host, not inside the container. Run <code>npm run install-hooks</code> on the host after the container starts. Verify hooks in <code>~/.claude/settings.json</code> point to <code>localhost:4820</code>.":
      "Hook chạy trên host, không phải bên trong container. Hãy chạy <code>npm run install-hooks</code> trên host sau khi container khởi động. Kiểm tra để chắc chắn hook trong <code>~/.claude/settings.json</code> trỏ tới <code>localhost:4820</code>.",
    Technology: "Công nghệ",
    "Why This Over Alternatives": "Vì sao chọn nó thay vì các lựa chọn khác",
    "Zero-config, embedded, no server process. WAL mode gives concurrent reads. Synchronous API is simpler than async for this use case. <code>better-sqlite3</code> is preferred when prebuilds are available; falls back to Node.js built-in <code>node:sqlite</code> on Node 22+ when the native module cannot be compiled.":
      "Không cần cấu hình, nhúng sẵn, không có tiến trình máy chủ. Chế độ WAL cho phép đọc đồng thời. API đồng bộ đơn giản hơn bất đồng bộ cho trường hợp sử dụng này. <code>better-sqlite3</code> được ưu tiên khi có sẵn bản dựng trước; chuyển sang dùng <code>node:sqlite</code> tích hợp sẵn của Node.js trên Node 22+ khi không thể biên dịch được mô-đun native.",
    "Battle-tested, minimal, well-understood. Fastify would be overkill; raw <code>http</code> module would require too much boilerplate for routing.":
      "Đã được kiểm chứng kỹ, tối giản, dễ hiểu. Fastify sẽ là quá mức cần thiết; mô-đun <code>http</code> thuần sẽ đòi hỏi quá nhiều mã soạn sẵn cho việc định tuyến.",
    "Fastest, most lightweight WebSocket library for Node. No Socket.IO overhead needed — we only push typed JSON messages one-way.":
      "Thư viện WebSocket nhanh nhất, nhẹ nhất cho Node. Không cần thêm chi phí của Socket.IO — chúng ta chỉ đẩy các thông điệp JSON có kiểu theo một chiều.",
    "Stable, widely known, strong TypeScript support. No Server Components or RSC needed for a client-rendered local SPA.":
      "Ổn định, được biết đến rộng rãi, hỗ trợ TypeScript mạnh mẽ. Không cần Server Components hay RSC cho một SPA cục bộ được render phía client.",
    "Fast builds, native ESM, excellent dev experience. Proxy config handles the dev server split cleanly with no ejection.":
      "Build nhanh, ESM gốc, trải nghiệm phát triển tuyệt vời. Cấu hình proxy xử lý việc tách máy chủ phát triển một cách gọn gàng mà không cần eject.",
    "Utility-first approach keeps styles colocated with markup. No CSS module boilerplate. Custom dark theme config for the dark UI.":
      "Cách tiếp cận ưu tiên tiện ích (utility-first) giữ cho style nằm cạnh markup. Không có mã soạn sẵn của CSS module. Cấu hình chủ đề tối tùy chỉnh cho giao diện tối.",
    "Standard routing for React SPAs. Layout routes with <code>&lt;Outlet&gt;</code> give clean shell composition without prop drilling.":
      "Định tuyến tiêu chuẩn cho các SPA React. Các route bố cục với <code>&lt;Outlet&gt;</code> mang lại sự kết hợp lớp vỏ gọn gàng mà không cần truyền prop xuyên cấp (prop drilling).",
    "Tree-shakeable icon library — only imports what's used (~20 icons). No heavy icon font.":
      "Thư viện biểu tượng có thể tree-shake — chỉ nhập những gì được dùng (~20 biểu tượng). Không có font biểu tượng nặng nề.",
    "Catches null/undefined bugs at compile time. <code>noUncheckedIndexedAccess</code> prevents array bounds issues in analytics aggregations.":
      "Bắt các lỗi null/undefined tại thời điểm biên dịch. <code>noUncheckedIndexedAccess</code> ngăn các vấn đề vượt giới hạn mảng trong các phép tổng hợp phân tích.",
    "Industry-standard data visualization library. Powers the Workflows page's 11 interactive sections — DAG layouts, Sankey diagrams, force-directed graphs, bubble charts, and swim-lane timelines. No wrapper libraries needed; direct SVG rendering keeps bundle impact minimal.":
      "Thư viện trực quan hóa dữ liệu tiêu chuẩn ngành. Cung cấp sức mạnh cho 11 phần tương tác của trang Workflows — bố cục DAG, biểu đồ Sankey, đồ thị định hướng theo lực, biểu đồ bong bóng và dòng thời gian theo làn (swim-lane). Không cần thư viện bao bọc nào; việc render SVG trực tiếp giữ cho tác động lên kích thước gói ở mức tối thiểu.",
    "Available on virtually all systems. Handles ANSI and JSON natively with stdlib only. No install step required.":
      "Có sẵn trên gần như mọi hệ thống. Xử lý ANSI và JSON một cách gốc chỉ với thư viện chuẩn. Không cần bước cài đặt nào.",
    "Local-first monitoring for Claude Code sessions, agents, and tool events. Built for real-time visibility with zero external dependencies.":
      "Giám sát ưu tiên cục bộ cho các phiên, agent và sự kiện công cụ của Claude Code. Được xây dựng để mang lại khả năng quan sát theo thời gian thực với không có phụ thuộc bên ngoài nào.",
    Install: "Cài đặt",
    Setup: "Thiết lập",
    "About the Creator": "Về người tạo ra",
    '<span class="caption-icon">⭐</span> <span> Enjoying the project? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer">Give it a star on GitHub</a> and help more builders discover it. </span>':
      '<span class="caption-icon">⭐</span> <span> Bạn thấy dự án hữu ích? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer">Hãy gắn sao cho nó trên GitHub</a> và giúp nhiều nhà phát triển khác biết đến nó. </span>',
    'Clears the waiting flag and promotes the main agent to <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>. The only reliable signal that text-only assistant turns have started — they emit no <code>PreToolUse</code> before <code>Stop</code>.':
      'Xóa cờ chờ và nâng agent chính lên trạng thái <span class="status-chip chip-working"><span class="chip-dot"></span>Đang làm việc</span>. Đây là tín hiệu đáng tin cậy duy nhất cho biết các lượt trợ lý chỉ có văn bản đã bắt đầu — chúng không phát ra <code>PreToolUse</code> trước <code>Stop</code>.',
    'Clears the waiting flag, sets agent → <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>, <code>current_tool</code> set. If tool is <code>Agent</code>, subagent record created.':
      'Xóa cờ chờ, đặt agent → <span class="status-chip chip-working"><span class="chip-dot"></span>Đang làm việc</span>, gán <code>current_tool</code>. Nếu công cụ là <code>Agent</code>, một bản ghi subagent được tạo.',
    'Clears the waiting flag (covers permission-prompt approvals mid-tool). <code>current_tool</code> cleared. Agent stays <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>.':
      'Xóa cờ chờ (bao gồm cả việc phê duyệt nhắc quyền giữa chừng khi đang dùng công cụ). <code>current_tool</code> được xóa. Agent vẫn ở trạng thái <span class="status-chip chip-working"><span class="chip-dot"></span>Đang làm việc</span>.',
    'Non-error: main agent → <code>waiting</code> — UI shows <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> until the next user input. <code>stop_reason=error</code>: marks the agent and session <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>. Background subagents keep running.':
      'Không phải lỗi: agent chính → <code>waiting</code> — UI hiển thị <span class="status-chip chip-waiting"><span class="chip-dot"></span>Đang chờ</span> cho đến lần nhập tiếp theo của người dùng. <code>stop_reason=error</code>: đánh dấu agent và phiên là <span class="status-chip chip-error"><span class="chip-dot"></span>Lỗi</span>. Các subagent chạy nền vẫn tiếp tục chạy.',
    'Matched subagent → <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Deliberately does <strong>not</strong> clear the waiting flag — a backgrounded subagent finishing tells us nothing about the human. Also kicks off a fire-and-forget JSONL scan (<code>scanAndImportSubagents</code>) that walks the session\'s <code>subagents/agent-*.jsonl</code> files, pairs <code>tool_use</code> ↔ <code>tool_result</code> blocks by <code>tool_use_id</code>, and emits per-tool <code>PreToolUse</code> + <code>PostToolUse</code> events under each subagent\'s own <code>agent_id</code> — surfaces tool calls that subagents make internally and which never fire any hooks.':
      'Subagent được khớp → <span class="status-chip chip-completed"><span class="chip-dot"></span>Hoàn tất</span>. Nó cố ý <strong>không</strong> xóa cờ chờ — việc một subagent chạy nền hoàn tất không cho ta biết gì về con người. Nó cũng khởi động một lượt quét JSONL kiểu fire-and-forget (<code>scanAndImportSubagents</code>) duyệt qua các tệp <code>subagents/agent-*.jsonl</code> của phiên, ghép các khối <code>tool_use</code> ↔ <code>tool_result</code> theo <code>tool_use_id</code>, và phát ra các sự kiện <code>PreToolUse</code> + <code>PostToolUse</code> cho từng công cụ dưới <code>agent_id</code> riêng của mỗi subagent — qua đó làm lộ ra các lệnh gọi công cụ mà subagent thực hiện nội bộ và vốn không bao giờ kích hoạt bất kỳ hook nào.',
    'Creates a compaction subagent → <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Detected via <code>isCompactSummary</code> entries in the transcript. Token baselines preserve pre-compaction totals. Periodic scanner (cadence ~¼ of <code>DASHBOARD_STALE_MINUTES</code>) catches compactions when no hooks fire.':
      'Tạo một subagent nén → <span class="status-chip chip-completed"><span class="chip-dot"></span>Hoàn tất</span>. Được phát hiện qua các mục <code>isCompactSummary</code> trong bản ghi. Các mốc nền token giữ lại tổng số trước khi nén. Bộ quét định kỳ (nhịp khoảng ¼ của <code>DASHBOARD_STALE_MINUTES</code>) bắt được các lần nén khi không có hook nào kích hoạt.',
    'Drops the waiting flag. If the session is already in <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>, the error state is preserved; otherwise marks all agents and the session as <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Evicts the session\'s transcript from the shared cache.':
      'Bỏ cờ chờ. Nếu phiên đã ở trạng thái <span class="status-chip chip-error"><span class="chip-dot"></span>Lỗi</span>, trạng thái lỗi được giữ nguyên; nếu không, đánh dấu tất cả agent và phiên là <span class="status-chip chip-completed"><span class="chip-dot"></span>Hoàn tất</span>. Đẩy bản ghi của phiên ra khỏi bộ nhớ đệm dùng chung.',
    "SQLite connection, WAL/FK pragmas, schema migrations (<code>CREATE TABLE IF NOT EXISTS</code>), all prepared statements as a reusable <code>stmts</code> object. Tries <code>better-sqlite3</code> first, falls back to built-in <code>node:sqlite</code> via <code>compat-sqlite.js</code>":
      "Kết nối SQLite, các pragma WAL/FK, di trú schema (<code>CREATE TABLE IF NOT EXISTS</code>), tất cả câu lệnh đã chuẩn bị dưới dạng đối tượng <code>stmts</code> có thể tái sử dụng. Thử <code>better-sqlite3</code> trước, rồi quay về dùng <code>node:sqlite</code> tích hợp sẵn thông qua <code>compat-sqlite.js</code>",
    "Each page pulls initial data from REST then subscribes to eventBus for live updates":
      "Mỗi trang lấy dữ liệu ban đầu từ REST rồi đăng ký eventBus để nhận cập nhật trực tiếp",
    "Entity Relationship Diagram — SQLite schema": "Sơ đồ quan hệ thực thể — schema SQLite",
    "Working Dir": "Thư mục làm việc",
    "Git Branch": "Nhánh Git",
    "Context Bar": "Thanh ngữ cảnh",
    "Token Counts": "Số lượng token",
    "Session Cost": "Chi phí phiên",
    "Statusline rendering pipeline — invoked on each Claude Code update":
      "Quy trình kết xuất thanh trạng thái — được gọi mỗi lần Claude Code cập nhật",
    "Aggregates data from multiple API endpoints to display high-signal metrics directly in the sidebar:":
      "Tổng hợp dữ liệu từ nhiều điểm cuối API để hiển thị các chỉ số quan trọng ngay trên thanh bên:",
    "Zero-Config Setup": "Cài đặt không cần cấu hình",
    "One-line mental model": "Mô hình tư duy trong một dòng",
    "Your data survives reinstalls and updates":
      "Dữ liệu của bạn vẫn được giữ lại sau khi cài lại và cập nhật",
    "The <code>claude</code> CLI is found automatically":
      "CLI <code>claude</code> được tìm thấy tự động",
    'Open <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Releases → latest </a> and download the asset for your platform. The macOS and Windows Desktop CI jobs auto-publish a new <code>vX.Y.Z</code> release every time the version in <code>package.json</code> is bumped on <code>master</code>, so this link always points at the current build. Releases are public — no GitHub sign-in required.':
      'Mở <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Releases → latest </a> và tải về tệp phù hợp với nền tảng của bạn. Các job CI Desktop trên macOS và Windows tự động phát hành một bản <code>vX.Y.Z</code> mới mỗi khi phiên bản trong <code>package.json</code> được tăng trên <code>master</code>, nên liên kết này luôn trỏ tới bản dựng hiện tại. Các bản phát hành là công khai — không cần đăng nhập GitHub.',
    'Want a build straight off the tip of <code>master</code>, ahead of the next tagged release? Every green run of the <code>🍎 macOS Desktop (DMG)</code> job on <code>macos-latest</code> uploads the universal DMG as the <code>ClaudeCodeMonitor-dmg</code> workflow artifact, and the <code>🪟 Windows Desktop (EXE)</code> job on <code>windows-latest</code> uploads the installer + portable EXEs as the <code>ClaudeCodeMonitor-win</code> artifact. Open the <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> latest passing run </a>, scroll to its Artifacts section, and download <code>ClaudeCodeMonitor-dmg</code> or <code>ClaudeCodeMonitor-win</code>. (GitHub sign-in required; 14-day retention.)':
      'Muốn một bản dựng ngay từ đầu nhánh <code>master</code>, trước cả bản phát hành được gắn thẻ tiếp theo? Mỗi lần chạy thành công của job <code>🍎 macOS Desktop (DMG)</code> trên <code>macos-latest</code> đều tải lên tệp DMG đa kiến trúc dưới dạng workflow artifact <code>ClaudeCodeMonitor-dmg</code>, và job <code>🪟 Windows Desktop (EXE)</code> trên <code>windows-latest</code> tải lên trình cài đặt + các EXE di động dưới dạng artifact <code>ClaudeCodeMonitor-win</code>. Mở <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> latest passing run </a>, cuộn đến phần Artifacts của nó, rồi tải về <code>ClaudeCodeMonitor-dmg</code> hoặc <code>ClaudeCodeMonitor-win</code>. (Cần đăng nhập GitHub; lưu giữ 14 ngày.)',
    "Incoming Webhook URL": "URL Webhook đến",
    "Webhook URL": "URL Webhook",
    "Detection pipeline from scheduler to UI": "Quy trình phát hiện từ bộ lập lịch đến UI",
    "A shell-less <code>git fetch</code> with a 120-second timeout, followed by a <code>rev-list</code> against the tracked upstream. Each call runs from <code>server/lib/update-check.js</code> and returns a structured payload — never throws — so a flaky remote can't stall the dashboard.":
      "Một lệnh <code>git fetch</code> không qua shell với thời gian chờ 120 giây, theo sau là một <code>rev-list</code> đối chiếu với upstream đang theo dõi. Mỗi lệnh gọi chạy từ <code>server/lib/update-check.js</code> và trả về một payload có cấu trúc — không bao giờ ném ngoại lệ — nên một remote chập chờn không thể làm treo dashboard.",
    "Detection-only by design": "Chỉ phát hiện theo thiết kế",
    "Adding a language": "Thêm một ngôn ngữ",
    "<strong>Ask box:</strong> answers simple status questions locally from cached data (“what's running”, “any errors”, “status”).":
      "<strong>Ô hỏi:</strong> trả lời cục bộ các câu hỏi trạng thái đơn giản từ dữ liệu đã lưu đệm (“đang chạy gì”, “có lỗi không”, “trạng thái”).",
    "A third way to run: the Desktop App (macOS &amp; Windows)":
      "Cách chạy thứ ba: Ứng dụng Desktop (macOS &amp; Windows)",
    "Hooks still run on the host": "Các hook vẫn chạy trên máy chủ",
    "Hook note": "Ghi chú về hook",
    "SQL injection": "Tấn công SQL injection",
    "All queries use prepared statements with parameterized values — no string interpolation":
      "Tất cả truy vấn đều dùng câu lệnh đã chuẩn bị với giá trị tham số hóa — không nối chuỗi",
    "Request size": "Kích thước yêu cầu",
    "Express JSON body parser limited to 1MB":
      "Bộ phân tích thân JSON của Express bị giới hạn ở 1MB",
    "Dashboard — stats, active agents, recent events":
      "Dashboard — số liệu thống kê, agent đang hoạt động, sự kiện gần đây",
    "KanbanBoard — agent status columns": "KanbanBoard — các cột trạng thái agent",
    "Sessions — searchable, filterable table": "Sessions — bảng có thể tìm kiếm và lọc",
    "SessionDetail — agents + full event timeline":
      "SessionDetail — các agent và dòng thời gian sự kiện đầy đủ",
    "ActivityFeed — real-time streaming event log":
      "ActivityFeed — nhật ký sự kiện truyền phát theo thời gian thực",
    "Analytics — token usage, heatmap (day-of-week aligned), tool charts, donut charts":
      "Analytics — mức dùng token, bản đồ nhiệt (căn theo ngày trong tuần), biểu đồ công cụ, biểu đồ vành khuyên",
    "Workflows — D3.js visualizations, cross-filtering, status filter, session drill-in":
      "Workflows — trực quan hóa D3.js, lọc chéo, lọc theo trạng thái, đi sâu vào phiên",
    "Settings — model pricing, hook status, data export, session cleanup":
      "Settings — định giá mô hình, trạng thái hook, xuất dữ liệu, dọn dẹp phiên",
    'Returns <code>{ "status": "ok", "timestamp": "..." }</code>':
      'Trả về <code>{ "status": "ok", "timestamp": "..." }</code>',
    "List sessions with agent counts and per-session cost. Params: <code>status</code>, <code>q</code> (case-insensitive search across <code>id</code>/<code>name</code>/<code>cwd</code>), <code>limit</code> (default 50, max 10000), <code>offset</code>. Response includes <code>total</code> for paginators.":
      "Liệt kê các phiên kèm số lượng agent và chi phí mỗi phiên. Tham số: <code>status</code>, <code>q</code> (tìm kiếm không phân biệt hoa thường trên <code>id</code>/<code>name</code>/<code>cwd</code>), <code>limit</code> (mặc định 50, tối đa 10000), <code>offset</code>. Phản hồi bao gồm <code>total</code> cho bộ phân trang.",
    "Session detail with agents and events": "Chi tiết phiên kèm các agent và sự kiện",
    "Create session (idempotent on <code>id</code>)": "Tạo phiên (idempotent theo <code>id</code>)",
    "Update session status / metadata": "Cập nhật trạng thái / metadata của phiên",
    "List agents — params: <code>status</code>, <code>session_id</code>, <code>limit</code>, <code>offset</code>":
      "Liệt kê các agent — tham số: <code>status</code>, <code>session_id</code>, <code>limit</code>, <code>offset</code>",
    "Single agent detail": "Chi tiết một agent",
    "Create agent": "Tạo agent",
    "Update agent status / task / current_tool":
      "Cập nhật trạng thái / tác vụ / current_tool của agent",
    "List events newest-first — params: <code>session_id</code>, <code>limit</code>, <code>offset</code>":
      "Liệt kê sự kiện mới nhất trước — tham số: <code>session_id</code>, <code>limit</code>, <code>offset</code>",
    "Aggregate counts + status distributions + WS connections":
      "Số liệu tổng hợp + phân bố trạng thái + kết nối WS",
    "Token totals, tool usage, daily trends, agent types, event types, averages":
      "Tổng số token, mức dùng công cụ, xu hướng theo ngày, loại agent, loại sự kiện, giá trị trung bình",
    "Receive and process a Claude Code hook event (called by hook-handler.js)":
      "Nhận và xử lý một sự kiện hook của Claude Code (được hook-handler.js gọi)",
    "List all model pricing rules": "Liệt kê tất cả quy tắc định giá mô hình",
    "Create or update a pricing rule": "Tạo hoặc cập nhật một quy tắc định giá",
    "Delete a pricing rule": "Xóa một quy tắc định giá",
    "Total cost across all sessions": "Tổng chi phí trên tất cả các phiên",
    "Cost breakdown for a specific session": "Phân tích chi phí cho một phiên cụ thể",
    "System info, DB stats, hook installation status":
      "Thông tin hệ thống, số liệu DB, trạng thái cài đặt hook",
    "Delete all sessions, agents, events, token usage":
      "Xóa tất cả phiên, agent, sự kiện, mức dùng token",
    "Reinstall Claude Code hooks": "Cài đặt lại các hook của Claude Code",
    "Reset pricing rules to defaults": "Đặt lại quy tắc định giá về mặc định",
    "Export all data as JSON download": "Xuất tất cả dữ liệu dưới dạng tải về JSON",
    "Abandon stale sessions (by hours), purge old data (by days)":
      "Bỏ các phiên cũ (theo giờ), xóa dữ liệu cũ (theo ngày)",
    "OS-aware paths, archive command, supported extensions, step-by-step instructions; includes live stats for the default <code>~/.claude/projects</code> folder":
      "Đường dẫn nhận biết OS, lệnh lưu trữ, các phần mở rộng được hỗ trợ, hướng dẫn từng bước; bao gồm số liệu trực tiếp cho thư mục mặc định <code>~/.claude/projects</code>",
    "Re-scan the default <code>~/.claude/projects</code> directory; safe to re-run (idempotent via session-ID dedup)":
      "Quét lại thư mục mặc định <code>~/.claude/projects</code>; an toàn để chạy lại (idempotent nhờ khử trùng lặp theo ID phiên)",
    "Scan any absolute directory (body <code>{ path }</code>); tilde (<code>~</code>) is expanded; walks subdirectories recursively and imports every <code>.jsonl</code> found":
      "Quét bất kỳ thư mục đường dẫn tuyệt đối nào (thân yêu cầu <code>{ path }</code>); dấu ngã (<code>~</code>) được mở rộng; duyệt đệ quy các thư mục con và nhập mọi <code>.jsonl</code> tìm thấy",
    "Multipart upload of <code>.jsonl</code>, <code>.meta.json</code>, <code>.zip</code>, <code>.tar</code>, <code>.tar.gz</code>, <code>.tgz</code>, <code>.gz</code>. Per-request staging dir, path-traversal and extraction-size guards. Returns 413 <code>EXTRACTION_LIMIT_EXCEEDED</code> on suspected bomb archives":
      "Tải lên nhiều phần các tệp <code>.jsonl</code>, <code>.meta.json</code>, <code>.zip</code>, <code>.tar</code>, <code>.tar.gz</code>, <code>.tgz</code>, <code>.gz</code>. Có thư mục tạm cho mỗi yêu cầu, cùng cơ chế bảo vệ chống path-traversal và giới hạn kích thước giải nén. Trả về 413 <code>EXTRACTION_LIMIT_EXCEEDED</code> đối với các kho lưu trữ nghi là bom",
    "Aggregate workflow data — orchestration graphs, tool flows, effectiveness, patterns, model delegation, error propagation, concurrency, complexity, compaction impact. Accepts <code>?status=active|completed</code> query param to filter by workflow status":
      "Tổng hợp dữ liệu quy trình làm việc — đồ thị điều phối, luồng công cụ, hiệu quả, mẫu hình, ủy thác mô hình, lan truyền lỗi, đồng thời, độ phức tạp, tác động của việc nén. Chấp nhận tham số truy vấn <code>?status=active|completed</code> để lọc theo trạng thái quy trình",
    "Per-session drill-in — agent tree, tool timeline, event details":
      "Đi sâu theo từng phiên — cây agent, dòng thời gian công cụ, chi tiết sự kiện",
    "Fired-alert feed, newest first (<code>?unacked=true</code>, <code>limit</code>, <code>offset</code>; carries <code>total</code> and <code>unacked</code> counts)":
      "Luồng cảnh báo đã kích hoạt, mới nhất trước (<code>?unacked=true</code>, <code>limit</code>, <code>offset</code>; kèm theo số đếm <code>total</code> và <code>unacked</code>)",
    "Acknowledge one alert": "Xác nhận một cảnh báo",
    "Acknowledge every unacked alert": "Xác nhận mọi cảnh báo chưa được xác nhận",
    "List alert rules": "Liệt kê các quy tắc cảnh báo",
    "Create a rule (<code>event_pattern</code> | <code>inactivity</code> | <code>status_duration</code> | <code>token_threshold</code>)":
      "Tạo một quy tắc (<code>event_pattern</code> | <code>inactivity</code> | <code>status_duration</code> | <code>token_threshold</code>)",
    "Update name / config / enabled / cooldown":
      "Cập nhật tên / cấu hình / trạng thái bật / thời gian chờ",
    "Delete a rule and its fired-alert history":
      "Xóa một quy tắc và lịch sử cảnh báo đã kích hoạt của nó",
    "Supported providers + their config fields (drives the UI form)":
      "Các nhà cung cấp được hỗ trợ cùng các trường cấu hình của chúng (điều khiển biểu mẫu UI)",
    "List webhook targets (URLs masked, secrets redacted)":
      "Liệt kê các đích webhook (URL được che, khóa bí mật được ẩn)",
    "Create a target — 14 first-class providers (Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream) + a generic JSON endpoint":
      "Tạo một đích — 14 nhà cung cấp được hỗ trợ hạng nhất (Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream) cùng một endpoint JSON tổng quát",
    "Update name / url / enabled / secret / headers / config / rule scope (<code>type</code> is immutable)":
      "Cập nhật tên / url / trạng thái bật / khóa bí mật / tiêu đề / cấu hình / phạm vi quy tắc (<code>type</code> là bất biến)",
    "Delete a target and its delivery log": "Xóa một đích và nhật ký gửi của nó",
    "Send a synthetic test alert and report the result":
      "Gửi một cảnh báo thử nghiệm tổng hợp và báo cáo kết quả",
    "Recent delivery log for a target": "Nhật ký gửi gần đây cho một đích",
    Documentation: "Tài liệu",
    Architecture: "Kiến trúc",
    "Relevant Links": "Liên kết liên quan",
    "GitHub Repo": "Kho GitHub",
    '<span class="caption-icon">🔔</span> <span><strong>Settings · Alerts</strong> — rules-based alerting engine and outbound webhooks in one place: alert rules (event pattern / inactivity / stuck agent / token threshold) with per-rule cooldown, a live fired-alert feed, and 14 first-class webhook providers plus a generic JSON endpoint with optional HMAC signing</span>':
      '<span class="caption-icon">🔔</span> <span><strong>Cài đặt · Cảnh báo</strong> — công cụ cảnh báo theo quy tắc và webhook gửi đi trong cùng một nơi: quy tắc cảnh báo (mẫu sự kiện / không hoạt động / agent bị treo / ngưỡng token) với cooldown theo từng quy tắc, nguồn cấp cảnh báo đã kích hoạt theo thời gian thực, và 14 nhà cung cấp webhook hạng nhất cùng một endpoint JSON tổng quát có tùy chọn ký HMAC</span>',
    '<span class="caption-icon">📗</span> <span><strong>API Docs · ReDoc</strong> — a self-hosted, read-optimized rendering of the full OpenAPI 3.0 spec at <code>/api/redoc</code>, served entirely offline with no CDN. Complements the interactive Swagger UI at <code>/api/docs</code>; every backend route is documented with parameters, schemas, and examples</span>':
      '<span class="caption-icon">📗</span> <span><strong>Tài liệu API · ReDoc</strong> — bản hiển thị toàn bộ đặc tả OpenAPI 3.0 tự lưu trữ, tối ưu cho việc đọc tại <code>/api/redoc</code>, phục vụ hoàn toàn ngoại tuyến, không CDN. Bổ sung cho Swagger UI tương tác tại <code>/api/docs</code>; mọi route backend đều được tài liệu hóa kèm tham số, schema và ví dụ</span>',
    '<span class="caption-icon">📘</span> <span><strong>API Docs · Swagger UI</strong> — interactive OpenAPI 3.0 playground at <code>/api/docs</code>: collapsible endpoint groups, request/response schemas, auth headers, and try-it-out request execution against the live local server</span>':
      '<span class="caption-icon">📘</span> <span><strong>Tài liệu API · Swagger UI</strong> — sân chơi OpenAPI 3.0 tương tác tại <code>/api/docs</code>: nhóm endpoint có thể thu gọn, schema yêu cầu/phản hồi, header xác thực, và thực thi yêu cầu try-it-out với máy chủ cục bộ đang chạy</span>',
    '<span class="caption-icon">📗</span> <span>ReDoc at <code>/api/redoc</code> — a self-hosted, read-optimized three-panel rendering of the same OpenAPI spec: deep-linkable sections, search, and full schema/example detail. Works entirely offline (no CDN)</span>':
      '<span class="caption-icon">📗</span> <span>ReDoc tại <code>/api/redoc</code> — bản hiển thị ba khung tự lưu trữ, tối ưu cho việc đọc của cùng đặc tả OpenAPI: các mục có thể liên kết sâu, tìm kiếm, và đầy đủ chi tiết schema/ví dụ. Hoạt động hoàn toàn ngoại tuyến (không CDN)</span>',
    '<span class="caption-icon">🔔</span> Settings · Alerts — the rules-based alerting engine, a live fired-alert feed, and outbound webhook channels (14 first-class providers + a generic JSON endpoint) managed together in one place':
      '<span class="caption-icon">🔔</span> Cài đặt · Cảnh báo — công cụ cảnh báo theo quy tắc, nguồn cấp cảnh báo đã kích hoạt theo thời gian thực, và các kênh webhook gửi đi (14 nhà cung cấp hạng nhất + một endpoint JSON tổng quát) được quản lý cùng một nơi',
    'Surfaces "dynamic workflows" — the fleets of sub-agents spawned by the <code>Workflow</code> tool and self-paced <code>/loop</code> runs. These emit no hooks, so they are reconstructed from the on-disk run journal written when a workflow finishes (<code>workflows/wf_&lt;runId&gt;.json</code>) plus the inner <code>subagents/agent-*.jsonl</code> transcripts. Each run shows its phases and a per-agent token / tool-call / duration breakdown; a running workflow is detected from its launch script before the journal exists. Runs appear in a panel on the Workflows page and as a linked subsection on each session.':
      'Hiển thị các "quy trình động" — những nhóm sub-agent do công cụ <code>Workflow</code> và các lần chạy <code>/loop</code> tự định nhịp tạo ra. Chúng không phát ra hook, nên được dựng lại từ nhật ký chạy trên đĩa được ghi khi quy trình kết thúc (<code>workflows/wf_&lt;runId&gt;.json</code>) cùng các bản ghi <code>subagents/agent-*.jsonl</code> bên trong. Mỗi lần chạy hiển thị các giai đoạn và bảng phân tích token / lệnh gọi công cụ / thời lượng theo từng agent; một quy trình đang chạy được phát hiện từ script khởi chạy trước khi nhật ký tồn tại. Các lần chạy xuất hiện trong một bảng trên trang Quy trình và dưới dạng mục liên kết trên mỗi phiên.',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs</strong> — "dynamic workflows" spawned by the Workflow tool, reconstructed from on-disk run journals: status, agent count, tokens, and tool calls, expandable into a per-agent breakdown (phase, state, tokens, tools, duration) with humanized result previews</span>':
      '<span class="caption-icon">🧬</span> <span><strong>Lần chạy quy trình</strong> — các "quy trình động" do công cụ Workflow tạo ra, được dựng lại từ nhật ký chạy trên đĩa: trạng thái, số agent, token và lệnh gọi công cụ, mở rộng thành bảng phân tích theo từng agent (giai đoạn, trạng thái, token, công cụ, thời lượng) kèm bản xem trước kết quả đã được làm gọn</span>',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · in a session</strong> — the same fleets linked to their launching session, so a session\'s dynamic-workflow sub-agents and their folded-in token cost are visible inline</span>':
      '<span class="caption-icon">🧬</span> <span><strong>Lần chạy quy trình · trong phiên</strong> — cùng các nhóm đó được liên kết tới phiên khởi chạy, nên các sub-agent của quy trình động và chi phí token đã được gộp vào của phiên đều hiển thị ngay trong phiên</span>',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · expanded</strong> — a run opened up: clickable color-coded phase filters, the per-agent metrics table, and a full list of clickable result items that expand to each agent\'s complete prompt and result</span>':
      '<span class="caption-icon">🧬</span> <span><strong>Lần chạy quy trình · mở rộng</strong> — một lần chạy được mở ra: bộ lọc giai đoạn có màu và bấm được, bảng số liệu theo từng agent, và danh sách đầy đủ các mục kết quả bấm được để mở ra lời nhắc và kết quả đầy đủ của từng agent</span>',
  },
  ko: {
    '<span class="caption-icon">📡</span> Live dashboard — real-time agent cards, stats, and activity feed':
      '<span class="caption-icon">📡</span> 라이브 대시보드 — 실시간 에이전트 카드, 통계, 활동 피드',
    "Claude Code Agent Monitor integrates with Claude Code through its native hook system. When Claude Code performs any action — tool use, session start, subagent orchestration, session end — it fires a hook that calls a small Node.js script bundled with this project. That script forwards the event over HTTP to the dashboard server, which stores it in SQLite and broadcasts it to the browser over WebSocket.":
      "Claude Code Agent Monitor는 Claude Code의 네이티브 훅(hook) 시스템을 통해 통합됩니다. Claude Code가 도구 사용, 세션 시작, 서브에이전트 오케스트레이션, 세션 종료 등 어떤 작업을 수행하면 훅이 발생하여 이 프로젝트에 포함된 작은 Node.js 스크립트를 호출합니다. 이 스크립트는 이벤트를 HTTP를 통해 대시보드 서버로 전달하며, 서버는 이를 SQLite에 저장하고 WebSocket을 통해 브라우저로 브로드캐스트합니다.",
    "End-to-end data pipeline from Claude Code to the browser":
      "Claude Code에서 브라우저까지의 엔드투엔드 데이터 파이프라인",
    "Local-first by design": "설계부터 로컬 우선(Local-first)",
    "The server binds <code>127.0.0.1</code> (loopback) by default, so it is not network-reachable and everything runs on your machine. No data leaves your system. No API keys. No external services. Exposing it more widely is opt-in via <code>DASHBOARD_HOST</code> and should be paired with <code>DASHBOARD_TOKEN</code>.":
      "서버는 기본적으로 <code>127.0.0.1</code>(루프백)에 바인딩되므로 네트워크에서 접근할 수 없으며 모든 것이 사용자의 컴퓨터에서 실행됩니다. 데이터가 시스템 밖으로 나가지 않습니다. API 키도 필요 없습니다. 외부 서비스도 없습니다. 더 넓게 노출하려면 <code>DASHBOARD_HOST</code>를 통해 선택적으로 설정해야 하며, 이때 <code>DASHBOARD_TOKEN</code>과 함께 사용해야 합니다.",
    "Every feature is driven by real hook events — nothing is hardcoded or simulated in production mode.":
      "모든 기능은 실제 훅 이벤트에 의해 구동되며, 프로덕션 모드에서는 하드코딩되거나 시뮬레이션되는 것이 없습니다.",
    "Two tabs: <strong>Monitor</strong> shows overview stats, active agent cards with collapsible subagent hierarchy, and a recent activity feed whose item count fills available viewport height. <strong>Health</strong> renders a composite system health score ring, storage engine donut chart, cache/error/success gauges, tool invocation bars, subagent effectiveness ratios, model token distribution, and compaction stats. Both tabs auto-refresh every 5 seconds via WebSocket push so the view is always current without manual reload.":
      "두 개의 탭으로 구성됩니다. <strong>Monitor</strong> 탭은 개요 통계, 접을 수 있는 서브에이전트 계층 구조가 포함된 활성 에이전트 카드, 그리고 뷰포트의 남은 높이를 채우는 개수만큼 표시되는 최근 활동 피드를 보여줍니다. <strong>Health</strong> 탭은 종합 시스템 상태 점수 링, 스토리지 엔진 도넛 차트, 캐시/오류/성공 게이지, 도구 호출 막대그래프, 서브에이전트 효율성 비율, 모델별 토큰 분포, 컴팩션 통계를 렌더링합니다. 두 탭 모두 WebSocket 푸시를 통해 5초마다 자동 새로고침되므로 수동으로 새로고침하지 않아도 항상 최신 상태를 유지합니다.",
    "Toggle between <strong>Agents</strong> (Working / Waiting / Completed / Error) and <strong>Sessions</strong> (Active / Waiting / Completed / Error / Abandoned) swim lanes. A yellow <strong>Waiting</strong> column flags items sitting on the user — fresh prompt, between turns, or permission gate. Hover any column header for lifecycle tooltips explaining each state transition. Cards surface model name, cumulative cost, and the current tool being called. Counts update in real time via WebSocket so the board is always in sync with the live event store.":
      "<strong>Agents</strong>(작업 중 / 대기 중 / 완료 / 오류)와 <strong>Sessions</strong>(활성 / 대기 중 / 완료 / 오류 / 중단됨) 스윔레인 사이를 전환할 수 있습니다. 노란색 <strong>Waiting</strong> 열은 새 프롬프트, 턴 사이, 또는 권한 게이트 등 사용자 입력을 기다리는 항목을 표시합니다. 열 제목에 마우스를 올리면 각 상태 전환을 설명하는 라이프사이클 툴팁이 표시됩니다. 카드에는 모델 이름, 누적 비용, 현재 호출 중인 도구가 표시됩니다. 개수는 WebSocket을 통해 실시간으로 업데이트되므로 보드는 항상 실시간 이벤트 저장소와 동기화된 상태를 유지합니다.",
    "<strong>Server-paginated</strong> table of every recorded session — each page fetches only its slice so cost computation stays bounded no matter how many sessions exist. Case-insensitive search across <code>id</code>, <code>name</code>, and <code>cwd</code> runs server-side with a 300 ms debounce; the status filter composes with search for precise narrowing. Each row shows the session's real name (synced live from the transcript — a <code>/rename</code> or <code>claude -n</code> title, else the auto title, else the first user prompt, with a short-ID fallback), status badge, agent count, duration, model, and estimated cost. Click any row to drill into the full session detail view with conversation transcript and agent hierarchy.":
      "기록된 모든 세션을 보여주는 <strong>서버 페이지네이션</strong> 테이블입니다. 각 페이지는 해당 구간만 가져오므로 세션 수가 아무리 많아도 비용 계산 범위가 제한됩니다. <code>id</code>, <code>name</code>, <code>cwd</code>에 대한 대소문자 구분 없는 검색은 300ms 디바운스와 함께 서버 측에서 실행되며, 상태 필터와 검색을 조합해 정확하게 좁힐 수 있습니다. 각 행은 세션의 실제 이름(트랜스크립트에서 실시간으로 동기화됨 — <code>/rename</code> 또는 <code>claude -n</code> 제목, 없으면 자동 생성된 제목, 그마저도 없으면 첫 사용자 프롬프트, 최종적으로 짧은 ID로 대체), 상태 배지, 에이전트 수, 지속 시간, 모델, 예상 비용을 표시합니다. 행을 클릭하면 대화 트랜스크립트와 에이전트 계층 구조가 포함된 전체 세션 상세 화면으로 이동합니다.",
    "Per-session deep dive with a collapsible agent hierarchy tree and a full chronological event timeline showing every tool call name and summary. An overview panel at the top surfaces tile counters for events, tool calls, subagents, compactions, errors, and duration. Top-tool usage bars and a subagent type breakdown give quick distribution reads. The conversation viewer renders markdown with syntax highlighting, per-tool styled blocks, slash-command pills with their captured TUI output, and inline session-rename markers. Export the entire session as JSON or share the permalink for async review.":
      "접을 수 있는 에이전트 계층 트리와 모든 도구 호출 이름 및 요약을 보여주는 전체 시간순 이벤트 타임라인을 통해 세션별로 깊이 있게 살펴볼 수 있습니다. 상단의 개요 패널은 이벤트, 도구 호출, 서브에이전트, 컴팩션, 오류, 지속 시간에 대한 타일 카운터를 표시합니다. 상위 도구 사용 막대그래프와 서브에이전트 유형 분석을 통해 분포를 빠르게 파악할 수 있습니다. 대화 뷰어는 구문 강조가 적용된 마크다운, 도구별 스타일이 지정된 블록, 캡처된 TUI 출력이 포함된 슬래시 명령 필, 인라인 세션 이름 변경 마커를 렌더링합니다. 전체 세션을 JSON으로 내보내거나 비동기 검토를 위해 고유 링크(permalink)를 공유할 수 있습니다.",
    "A rules-based alerting engine evaluates the live event stream server-side: <strong>event pattern</strong> (match event type / tool / summary text, optionally N matches within a time window), <strong>inactivity</strong>, <strong>stuck agent</strong>, and <strong>token threshold</strong> — each with per-(rule, session, agent) cooldown dedup. Fired alerts surface in a live feed and fan out to <strong>14 first-class webhook providers</strong> — Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream — plus any generic JSON endpoint (with optional HMAC-SHA256 signing and custom headers). Delivery is detached and fail-safe with a request timeout, bounded retry/backoff, secret redaction, a one-click test probe, and a per-target delivery log. Rules and channels are managed together in <strong>Settings → Alerts</strong>.":
      "규칙 기반 알림 엔진이 서버 측에서 실시간 이벤트 스트림을 평가합니다: <strong>이벤트 패턴</strong>(이벤트 유형/도구/요약 텍스트 일치, 선택적으로 특정 시간 창 내 N회 일치), <strong>비활성</strong>, <strong>정체된 에이전트</strong>, <strong>토큰 임계값</strong> — 각각 (규칙, 세션, 에이전트) 단위의 쿨다운 중복 제거를 적용합니다. 발생한 알림은 실시간 피드에 표시되며 <strong>14개의 공식 웹훅 제공자</strong> — Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream — 및 일반 JSON 엔드포인트(선택적 HMAC-SHA256 서명 및 사용자 지정 헤더 지원)로 전달됩니다. 전송은 요청 타임아웃, 제한된 재시도/백오프, 비밀 정보 마스킹, 원클릭 테스트 프로브, 대상별 전송 로그를 갖춘 분리된 안전 실패(fail-safe) 방식으로 이루어집니다. 규칙과 채널은 <strong>Settings → Alerts</strong>에서 함께 관리됩니다.",
    "A native desktop app — a macOS <code>.app</code> (shipped as a <code>.dmg</code>) and a Windows <code>.exe</code> (NSIS installer plus a no-install portable build) — built with Electron 35. It <strong>embeds the Express server in-process</strong> — <code>require()</code>-ing <code>server/index.js</code> directly, with no child process and no IPC — and renders the built React client in a <code>BrowserWindow</code>. Adds a menu-bar / notification-area (tray) icon, a native application menu, auto-start at login (macOS Login Items via <code>SMAppService</code>; Windows per-user <code>HKCU\\…\\Run</code>), and a single-instance lock. Closing the window hides it while the server keeps running, and the app auto-installs Claude Code hooks on first boot so an install-only user gets events flowing without a checkout.":
      "Electron 35로 빌드된 네이티브 데스크톱 앱 — macOS용 <code>.app</code>(<code>.dmg</code>로 배포)과 Windows용 <code>.exe</code>(NSIS 설치 프로그램 및 설치 없이 실행 가능한 포터블 빌드)입니다. <strong>Express 서버를 프로세스 내에 임베드</strong>하여 — 자식 프로세스나 IPC 없이 <code>server/index.js</code>를 직접 <code>require()</code>하고 — 빌드된 React 클라이언트를 <code>BrowserWindow</code>에 렌더링합니다. 메뉴바/알림 영역(트레이) 아이콘, 네이티브 애플리케이션 메뉴, 로그인 시 자동 시작(macOS는 <code>SMAppService</code>를 통한 로그인 항목, Windows는 사용자별 <code>HKCU\\…\\Run</code>), 단일 인스턴스 잠금 기능을 추가로 제공합니다. 창을 닫으면 서버는 계속 실행된 채로 창만 숨겨지며, 앱은 첫 실행 시 Claude Code 훅을 자동으로 설치하므로 설치만 한 사용자도 체크아웃 없이 이벤트를 바로 받아볼 수 있습니다.",
    "Real-time streaming event log showing tool calls, agent state changes, errors, and compaction events as they arrive. Pause/resume with automatic buffering, paginated history for scrollback, and auto-scrolling to the latest entry. Click any row to expand its full hook payload inline. A dedicated <strong>Session →</strong> button navigates directly to session detail without collapsing the expanded state. Every entry is color-coded by event type and grouped by session for quick scanning of concurrent work.":
      "도구 호출, 에이전트 상태 변경, 오류, 컴팩션 이벤트를 도착하는 즉시 보여주는 실시간 스트리밍 이벤트 로그입니다. 자동 버퍼링을 지원하는 일시정지/재개, 스크롤백을 위한 페이지네이션된 기록, 최신 항목으로의 자동 스크롤을 제공합니다. 행을 클릭하면 전체 훅 페이로드가 인라인으로 확장됩니다. 전용 <strong>Session →</strong> 버튼을 누르면 확장 상태를 접지 않고도 세션 상세 화면으로 바로 이동합니다. 모든 항목은 이벤트 유형별로 색상이 구분되고 세션별로 그룹화되어 동시에 진행 중인 작업을 빠르게 훑어볼 수 있습니다.",
    "Token usage breakdown by model with stacked bar charts, tool frequency rankings, agent type distribution donuts, and session outcome pie charts. A 52-week activity heatmap aligned by day-of-week shows density with hover tooltips. 30-day sparkline trends track cost and session volume at a glance. The cost summary panel totals input, output, and cache spend across all models. A live/offline indicator and auto-refresh via WebSocket keep everything current. All charts are responsive and adapt to mobile viewports.":
      "누적 막대그래프로 모델별 토큰 사용량을 분석하고, 도구 사용 빈도 순위, 에이전트 유형 분포 도넛 차트, 세션 결과 파이 차트를 제공합니다. 요일별로 정렬된 52주 활동 히트맵은 호버 툴팁과 함께 밀도를 보여줍니다. 30일 스파크라인 추세로 비용과 세션 수를 한눈에 확인할 수 있습니다. 비용 요약 패널은 모든 모델에 걸친 입력, 출력, 캐시 지출을 합산합니다. 실시간/오프라인 표시기와 WebSocket을 통한 자동 새로고침으로 항상 최신 상태를 유지합니다. 모든 차트는 반응형이며 모바일 뷰포트에 맞춰 조정됩니다.",
    "Every UI update is pushed over a persistent WebSocket with sub-5 ms dispatch latency — zero polling anywhere. If the connection drops, automatic 2-second reconnect kicks in while a ping/pong heartbeat detects stale connections early. A sidebar indicator turns green/red so you always know whether you're live. The WebSocket carries typed JSON envelopes for new events, session updates, agent transitions, compaction results, and import progress — all parsed into the same eventBus the REST layer uses.":
      "모든 UI 업데이트는 지속적인 WebSocket 연결을 통해 5ms 미만의 전달 지연으로 푸시되며, 어디에도 폴링이 없습니다. 연결이 끊기면 2초 후 자동으로 재연결이 시작되며, ping/pong 하트비트가 오래된 연결을 조기에 감지합니다. 사이드바 표시기가 초록색/빨간색으로 바뀌어 항상 연결 상태를 알 수 있습니다. WebSocket은 새 이벤트, 세션 업데이트, 에이전트 전환, 컴팩션 결과, 가져오기 진행 상황에 대한 타입이 지정된 JSON 봉투(envelope)를 전달하며, 이는 모두 REST 계층이 사용하는 것과 동일한 eventBus로 파싱됩니다.",
    "Standalone CLI statusline for Claude Code that prints model name, user, working directory, git branch, and a color-coded context-window bar (green → yellow → red). Token counts show input (green ↑), output (cyan ↓), and cache (dim) separately. Session cost in USD shifts color by configurable thresholds. ANSI-colored output updates on every turn. Python-based with a thin shell wrapper — drop it into your prompt or tmux status line. Works with any terminal emulator that supports 256-color ANSI.":
      "모델 이름, 사용자, 작업 디렉터리, git 브랜치, 색상으로 구분된 컨텍스트 윈도우 막대(초록 → 노랑 → 빨강)를 출력하는 Claude Code용 독립 실행형 CLI 상태줄입니다. 토큰 수는 입력(초록 ↑), 출력(시안 ↓), 캐시(흐림)로 구분하여 표시됩니다. USD 기준 세션 비용은 설정 가능한 임계값에 따라 색상이 바뀝니다. ANSI 색상 출력은 매 턴마다 갱신됩니다. Python 기반이며 얇은 셸 래퍼가 포함되어 있어 프롬프트나 tmux 상태줄에 바로 넣을 수 있습니다. 256색 ANSI를 지원하는 모든 터미널 에뮬레이터에서 작동합니다.",
    "Import existing Claude Code sessions from three sources — rescan the default <code>~/.claude/projects</code> folder, scan any absolute path on disk, or drag-drop <code>.jsonl</code>, <code>.zip</code>, <code>.tar.gz</code>, and <code>.gz</code> archives through <b>Settings → Import History</b>. All paths funnel into the same ingestion pipeline the server uses for live hooks, so imported tokens and per-model cost match real-time capture exactly. Re-imports are idempotent via session-ID dedup, and archive extraction is guarded against path traversal and zip-bomb expansion.":
      "기존 Claude Code 세션을 세 가지 방법으로 가져올 수 있습니다 — 기본 <code>~/.claude/projects</code> 폴더 재스캔, 디스크의 임의의 절대 경로 스캔, 또는 <b>Settings → Import History</b>에서 <code>.jsonl</code>, <code>.zip</code>, <code>.tar.gz</code>, <code>.gz</code> 아카이브를 드래그 앤 드롭. 모든 경로는 서버가 실시간 훅에 사용하는 것과 동일한 수집 파이프라인으로 통합되므로, 가져온 토큰과 모델별 비용이 실시간 캡처와 정확히 일치합니다. 재가져오기는 세션 ID 중복 제거를 통해 멱등적으로 처리되며, 아카이브 추출은 경로 순회(path traversal)와 zip 폭탄 확장으로부터 보호됩니다.",
    "The startup auto-import of <code>~/.claude/projects</code> is one-time and marker-gated, so a project folder created after first launch — whose sessions never flow through hooks (for example with host-only hooks disabled) — would stay invisible until a manual rescan. A background sync closes that gap with three triggers sharing one mtime cache and a single coalesced sweep: an immediate sweep at startup, a debounced <code>fs.watch</code> (recursive on macOS and Windows; root plus immediate child folders on Linux to avoid the userland recursive-watcher hazard) that fires the moment a new session file or project folder appears, and a periodic safety-net poll tunable via <code>DASHBOARD_SESSION_SYNC_MS</code> (default <code>30000</code> ms; <code>0</code> disables the poll while leaving the watcher running). Each sweep re-parses only files whose mtime advanced and broadcasts <code>session_created</code> / <code>session_updated</code> (plus the main agent) so the UI refreshes live, while an already-imported unchanged session is skipped without re-parsing.":
      "시작 시 수행되는 <code>~/.claude/projects</code> 자동 가져오기는 1회성이며 마커로 제어되므로, 첫 실행 이후 생성된 프로젝트 폴더(예: 호스트 전용 훅이 비활성화되어 세션이 훅을 통해 전달되지 않는 경우)는 수동으로 재스캔하기 전까지 보이지 않게 됩니다. 백그라운드 동기화는 하나의 mtime 캐시와 단일 통합 스윕을 공유하는 세 가지 트리거로 이 격차를 해소합니다: 시작 시 즉시 수행되는 스윕, 디바운스된 <code>fs.watch</code>(macOS와 Windows에서는 재귀적으로, Linux에서는 사용자 영역 재귀 워처의 위험을 피하기 위해 루트와 바로 아래 하위 폴더에 대해서만 적용)로 새 세션 파일이나 프로젝트 폴더가 나타나는 즉시 실행되며, <code>DASHBOARD_SESSION_SYNC_MS</code>(기본값 <code>30000</code>ms, <code>0</code>으로 설정하면 워처는 계속 실행하되 폴링만 비활성화)로 조정 가능한 주기적 안전망 폴링이 있습니다. 각 스윕은 mtime이 갱신된 파일만 다시 파싱하고 <code>session_created</code>/<code>session_updated</code>(및 메인 에이전트)를 브로드캐스트하여 UI가 실시간으로 갱신되며, 이미 가져와서 변경되지 않은 세션은 다시 파싱하지 않고 건너뜁니다.",
    "Incremental JSONL reader shared across the hook handler, compaction scanner, conversation viewer, and import pipeline. Byte-offset tracking skips already-parsed content; cache hits short-circuit disk I/O so even sessions with tens of thousands of turns stay fast. It also extracts the live session title (<code>custom-title</code> / <code>ai-title</code>) so renames surface in real time, plus the first user prompt as a fallback descriptor for placeholder-named sessions and agents.":
      "훅 핸들러, 컴팩션 스캐너, 대화 뷰어, 가져오기 파이프라인 전반에서 공유되는 점진적(incremental) JSONL 리더입니다. 바이트 오프셋 추적으로 이미 파싱된 콘텐츠를 건너뛰며, 캐시 히트 시 디스크 I/O를 생략하므로 수만 개의 턴이 있는 세션도 빠르게 처리됩니다. 또한 실시간 세션 제목(<code>custom-title</code> / <code>ai-title</code>)을 추출하여 이름 변경이 실시간으로 반영되며, 임시 이름으로 표시되는 세션과 에이전트를 위한 대체 설명으로 첫 사용자 프롬프트도 함께 추출합니다.",
    "LRU eviction of cold session buffers plus a tail-cap on per-entry growable arrays (turn durations, API errors, compaction entries). A session that runs for days cannot grow a single cache entry without bound, and each entry stores its parsed result only once — no shadow copy.":
      "비활성 세션 버퍼에 대한 LRU 축출과 항목별 가변 배열(턴 지속 시간, API 오류, 컴팩션 항목)에 대한 꼬리 제한(tail-cap)을 적용합니다. 며칠 동안 실행되는 세션이라도 단일 캐시 항목이 무한정 커질 수 없으며, 각 항목은 파싱된 결과를 단 한 번만 저장합니다 — 그림자 복사본은 없습니다.",
    "The periodic compaction sweep reads each active session's transcript path directly from <code>sessions.transcript_path</code> (a partial index covers exactly those rows), so the work is O(active sessions) instead of a <code>json_extract</code> scan over the whole events table.":
      "주기적인 컴팩션 스윕은 각 활성 세션의 트랜스크립트 경로를 <code>sessions.transcript_path</code>에서 직접 읽어오며(부분 인덱스가 정확히 해당 행들을 커버합니다), 이에 따라 작업량은 전체 events 테이블에 대한 <code>json_extract</code> 스캔이 아니라 O(활성 세션 수)가 됩니다.",
    "Collapsible parent–child agent tree rendered on both Dashboard and Session Detail. Agents with subagents display expand/collapse chevrons; leaf agents show a dot indicator. The tree auto-expands when any child transitions to active and correctly tracks backgrounded subagents without premature completion. Depth is unlimited — deeply nested chains render as indented rows with connecting lines. Each node shows model, current tool, status badge, and cumulative token cost for tracing spend down the spawn chain.":
      "Dashboard와 Session Detail 양쪽에서 렌더링되는 접을 수 있는 부모-자식 에이전트 트리입니다. 서브에이전트가 있는 에이전트는 펼치기/접기 화살표를 표시하며, 리프 에이전트는 점 표시기를 보여줍니다. 트리는 하위 항목이 활성 상태로 전환되면 자동으로 펼쳐지며, 백그라운드로 실행 중인 서브에이전트를 조기 완료 없이 정확하게 추적합니다. 깊이 제한은 없으며, 깊이 중첩된 체인은 연결선이 있는 들여쓰기된 행으로 렌더링됩니다. 각 노드는 모델, 현재 도구, 상태 배지, 그리고 생성 체인을 따라 지출을 추적할 수 있는 누적 토큰 비용을 표시합니다.",
    "Per-model cost estimation with configurable pricing rules — set input, output, and cache-read rates per model variant through the Settings UI. View total and per-session breakdowns on Sessions, Session Detail, and Analytics. Compaction- aware token accounting preserves baselines across context compressions so no usage is silently dropped. Cost chips appear on Kanban cards, session rows, and the sidebar summary. Subagent cards show each subagent's own cost, computed from that subagent's transcript token usage priced at current rates, so a subagent card no longer misleadingly reads as if it cost the whole session; main-agent cards still show the session total. Pricing changes retroactively recalculate all stored sessions, and imports apply the same rate table.":
      "설정 가능한 가격 책정 규칙에 따라 모델별 비용을 추정합니다 — Settings UI를 통해 모델 변형별로 입력, 출력, 캐시 읽기 요율을 설정할 수 있습니다. Sessions, Session Detail, Analytics에서 전체 및 세션별 분석을 확인할 수 있습니다. 컴팩션을 고려한 토큰 계산은 컨텍스트 압축 전반에 걸쳐 기준값을 보존하므로 사용량이 은연중에 누락되지 않습니다. 비용 칩은 칸반 카드, 세션 행, 사이드바 요약에 표시됩니다. 서브에이전트 카드는 현재 요율로 계산된 해당 서브에이전트 트랜스크립트의 토큰 사용량을 기반으로 각 서브에이전트 고유의 비용을 표시하므로, 서브에이전트 카드가 마치 전체 세션 비용인 것처럼 오해를 주지 않습니다. 메인 에이전트 카드는 여전히 세션 총합을 표시합니다. 가격 변경은 저장된 모든 세션에 소급 적용되어 재계산되며, 가져오기 역시 동일한 요율표를 적용합니다.",
    "Model pricing editor with per-token rate configuration for every Claude variant. Hook installation status with one-click reinstall and per-hook health checks. Full JSON data export covering sessions, agents, events, tokens, and pricing rules. Session cleanup controls to abandon stale sessions or purge old data by age. Browser notification preferences with per-event toggles. A system information panel shows database row counts, file sizes, server uptime, and WebSocket connection status at a glance.":
      "모든 Claude 변형에 대해 토큰당 요율을 설정할 수 있는 모델 가격 편집기입니다. 원클릭 재설치와 훅별 상태 점검이 가능한 훅 설치 상태를 제공합니다. 세션, 에이전트, 이벤트, 토큰, 가격 규칙을 아우르는 전체 JSON 데이터 내보내기가 가능합니다. 오래된 세션을 중단시키거나 기간별로 오래된 데이터를 삭제하는 세션 정리 기능도 있습니다. 이벤트별로 켜고 끌 수 있는 브라우저 알림 설정을 제공합니다. 시스템 정보 패널은 데이터베이스 행 수, 파일 크기, 서버 가동 시간, WebSocket 연결 상태를 한눈에 보여줍니다.",
    "Local MCP sidecar with three transport modes — stdio for Claude Code native integration, HTTP+SSE for remote clients, and an interactive REPL for ad-hoc terminal queries. Exposes 25 typed tools across 6 domains: sessions, agents, events, analytics, settings, and system health. Every mutation is gated behind a tiered policy so nothing dangerous fires without opt-in. Retry-aware API access handles transient failures. Runs as a standalone Node process with no Docker or cloud dependency.":
      "세 가지 전송 모드를 지원하는 로컬 MCP 사이드카입니다 — Claude Code 네이티브 통합을 위한 stdio, 원격 클라이언트를 위한 HTTP+SSE, 임시 터미널 쿼리를 위한 대화형 REPL. sessions, agents, events, analytics, settings, system health 등 6개 영역에 걸쳐 25개의 타입이 지정된 도구를 제공합니다. 모든 변경 작업은 단계별 정책에 의해 게이트되므로 명시적으로 허용하지 않으면 위험한 작업이 실행되지 않습니다. 재시도를 인식하는 API 접근으로 일시적인 장애를 처리합니다. Docker나 클라우드에 의존하지 않는 독립 실행형 Node 프로세스로 동작합니다.",
    "Instruction, skills, rules, and custom-agent layers for both Claude Code and Codex. Path-scoped rules target backend, frontend, MCP, and docs directories with context-appropriate guidelines. Reusable skills cover onboarding, feature shipping, live-issue debugging, release-readiness, and MCP operations. Specialized subagents for backend, frontend, and MCP code review run in parallel with focused tooling. Everything lives in <code>.claude/</code> and is version-controlled alongside the codebase.":
      "Claude Code와 Codex 양쪽을 위한 지침, 스킬, 규칙, 커스텀 에이전트 레이어입니다. 경로 범위 규칙은 backend, frontend, MCP, docs 디렉터리를 대상으로 상황에 맞는 가이드라인을 적용합니다. 재사용 가능한 스킬은 온보딩, 기능 배포, 실시간 이슈 디버깅, 릴리스 준비 상태 점검, MCP 운영을 다룹니다. backend, frontend, MCP 코드 리뷰를 위한 전문 서브에이전트가 특화된 도구와 함께 병렬로 실행됩니다. 모든 것이 <code>.claude/</code>에 위치하며 코드베이스와 함께 버전 관리됩니다.",
    "D3.js-powered visualizations: an agent orchestration DAG showing spawn patterns across sessions, a tool-execution Sankey diagram mapping tool-to- tool transitions, and a directed pipeline graph with frequency labels. Every chart title carries an info icon that opens a popover explaining what it shows and how to read it. Hovering nodes, edges, and bars surfaces tooltips with share-of-source percentages, success-rate buckets, and timing patterns. All labels are translated to English, Vietnamese, and Chinese.":
      "D3.js 기반 시각화입니다: 세션 전반의 생성 패턴을 보여주는 에이전트 오케스트레이션 DAG, 도구 간 전환을 매핑하는 도구 실행 생키(Sankey) 다이어그램, 빈도 레이블이 표시된 방향성 파이프라인 그래프를 제공합니다. 모든 차트 제목에는 무엇을 보여주는지와 읽는 방법을 설명하는 팝오버를 여는 정보 아이콘이 있습니다. 노드, 엣지, 막대에 마우스를 올리면 소스별 비율, 성공률 구간, 타이밍 패턴이 담긴 툴팁이 표시됩니다. 모든 레이블은 영어, 베트남어, 중국어로 번역되어 있습니다.",
    "Subagent effectiveness scorecards with success-rate rings and day-of-week sparklines. Auto-detected workflow patterns expand on click into a detail panel with the full step chain, stats grid, and a narrative with loop detection. Model delegation flow, error propagation bars with API error cards, concurrency swim-lanes, and complexity bubble charts round out the view. Six headline stat cards each include an info popover explaining the metric and its current value. Status filter applies globally.":
      "성공률 링과 요일별 스파크라인이 포함된 서브에이전트 효율성 스코어카드입니다. 자동 감지된 워크플로 패턴을 클릭하면 전체 단계 체인, 통계 그리드, 루프 감지 결과를 포함한 서술을 담은 상세 패널로 펼쳐집니다. 모델 위임 흐름, API 오류 카드가 포함된 오류 전파 막대그래프, 동시성 스윔레인, 복잡도 버블 차트가 화면을 완성합니다. 6개의 주요 통계 카드에는 각각 해당 지표와 현재 값을 설명하는 정보 팝오버가 포함되어 있습니다. 상태 필터는 전역적으로 적용됩니다.",
    "Searchable session selector with pagination to explore any session's agent tree, tool-call timeline, and event sequence. The detail page opens with a live-updating overview — tile counters for events, tool calls, subagents, compactions, errors, and duration. Top-tool usage bars and subagent breakdown give quick reads. The conversation viewer renders markdown with syntax highlighting. Cross-filter from DAG nodes, run compaction analysis, or export as JSON — all with real-time WebSocket auto-refresh.":
      "페이지네이션이 적용된 검색 가능한 세션 선택기로 모든 세션의 에이전트 트리, 도구 호출 타임라인, 이벤트 시퀀스를 살펴볼 수 있습니다. 상세 페이지는 실시간으로 업데이트되는 개요와 함께 열립니다 — 이벤트, 도구 호출, 서브에이전트, 컴팩션, 오류, 지속 시간에 대한 타일 카운터를 제공합니다. 상위 도구 사용 막대그래프와 서브에이전트 분석으로 빠르게 파악할 수 있습니다. 대화 뷰어는 구문 강조가 적용된 마크다운을 렌더링합니다. DAG 노드를 통한 교차 필터링, 컴팩션 분석 실행, JSON으로 내보내기 등을 모두 실시간 WebSocket 자동 새로고침과 함께 사용할 수 있습니다.",
    "Persistent browser notifications via Web Push (VAPID) for real-time alerts even when the tab is not focused or the browser is backgrounded. Includes macOS audio support so notifications are audible alongside system sounds. Per-event toggles let you choose which events fire — session starts, completions, errors, compactions, or agent spawns. Server-side subscription management ensures one push per event per browser. Works on Chrome, Edge, Firefox, and Safari 17+ with graceful degradation elsewhere.":
      "Web Push(VAPID)를 통한 지속적인 브라우저 알림으로, 탭이 포커스되어 있지 않거나 브라우저가 백그라운드에 있을 때도 실시간 알림을 받을 수 있습니다. macOS 오디오 지원이 포함되어 시스템 사운드와 함께 알림 소리를 들을 수 있습니다. 이벤트별 토글로 세션 시작, 완료, 오류, 컴팩션, 에이전트 생성 중 어떤 이벤트를 알릴지 선택할 수 있습니다. 서버 측 구독 관리로 브라우저당 이벤트당 하나의 푸시만 전송되도록 보장합니다. Chrome, Edge, Firefox, Safari 17 이상에서 동작하며, 그 외 환경에서는 점진적 성능 저하(graceful degradation) 방식으로 동작합니다.",
    "Ready-to-use Dockerfile and docker-compose.yml for one-command deployment. Supports both Docker and Podman with persistent volume mounts for the SQLite database and hook data. Configurable port mapping via environment variables and a health-check endpoint the container runtime can poll. Multi-stage build keeps the image lean — only production deps and the compiled bundle ship. Run <code>docker compose up -d --build</code> and the dashboard is live with zero additional setup or configuration required.":
      "한 번의 명령으로 배포할 수 있도록 바로 사용 가능한 Dockerfile과 docker-compose.yml을 제공합니다. Docker와 Podman을 모두 지원하며 SQLite 데이터베이스와 훅 데이터를 위한 영구 볼륨 마운트를 지원합니다. 환경 변수를 통해 포트 매핑을 설정할 수 있으며 컨테이너 런타임이 폴링할 수 있는 헬스 체크 엔드포인트를 제공합니다. 멀티스테이지 빌드로 이미지를 가볍게 유지합니다 — 프로덕션 의존성과 컴파일된 번들만 포함됩니다. <code>docker compose up -d --build</code>를 실행하면 추가 설정 없이 바로 대시보드가 실행됩니다.",
    "Official Claude Code plugin marketplace shipping 10 plugins with 53 skills, 14 agents, 30 slash commands, 3 CLI tools, 3 hook configs, and 1 MCP server. Deep analytics with compaction-aware baselines, productivity automation, developer diagnostics, AI-powered workflow intelligence, and dashboard MCP integration. Five newer plugins go further: <code>ccam-cost-guard</code> (budget guardrails, spend forecasts, and cost-threshold alerts), <code>ccam-sessions</code> (session forensics — search, timeline, and transcript replay), <code>ccam-workflows</code> (multi-agent orchestration and fleet intelligence), <code>ccam-quality</code> (reliability and SLO checks), and <code>ccam-config</code> (Claude Code config and memory governance). Install with <code>claude plugin install</code> — no restart needed. Each listing shows author, license, homepage, and per-skill contribution breakdown. The Config Explorer's Plugins tab surfaces installed plugins with live status.":
      "53개의 스킬, 14개의 에이전트, 30개의 슬래시 명령, 3개의 CLI 도구, 3개의 훅 설정, 1개의 MCP 서버를 포함한 10개의 플러그인을 제공하는 공식 Claude Code 플러그인 마켓플레이스입니다. 컴팩션을 고려한 기준값을 반영한 심층 분석, 생산성 자동화, 개발자 진단, AI 기반 워크플로 인텔리전스, 대시보드 MCP 통합을 제공합니다. 다섯 개의 최신 플러그인은 한 걸음 더 나아갑니다: <code>ccam-cost-guard</code>(예산 가드레일, 지출 예측, 비용 임계값 알림), <code>ccam-sessions</code>(세션 포렌식 — 검색, 타임라인, 트랜스크립트 재생), <code>ccam-workflows</code>(다중 에이전트 오케스트레이션과 플릿 인텔리전스), <code>ccam-quality</code>(신뢰성 및 SLO 점검), <code>ccam-config</code>(Claude Code 설정 및 메모리 거버넌스). <code>claude plugin install</code>로 설치할 수 있으며 재시작이 필요 없습니다. 각 항목에는 작성자, 라이선스, 홈페이지, 스킬별 기여도 분석이 표시됩니다. Config Explorer의 Plugins 탭은 설치된 플러그인을 실시간 상태와 함께 보여줍니다.",
    "Spawn <code>claude</code> subprocesses straight from the dashboard with a chat-style streaming UI — multi-turn <b>Conversation</b> or single-shot <b>Headless</b> mode. One-click <b>Resume</b> on any past conversation spawns <code>claude --resume</code> seeded with the prior transcript. Re- attach reconciles in-memory logs with the on-disk JSONL so navigating away never loses history. Slash-command autocomplete, file references, live token/context-window meter, and a thinking-effort dial bring TUI parity to the browser. Same-origin guard blocks drive-by spawns.":
      "대시보드에서 직접 채팅 스타일 스트리밍 UI로 <code>claude</code> 서브프로세스를 실행할 수 있습니다 — 여러 턴에 걸친 <b>Conversation</b> 모드 또는 단발성 <b>Headless</b> 모드입니다. 과거 대화에서 원클릭 <b>Resume</b>을 누르면 이전 트랜스크립트를 기반으로 <code>claude --resume</code>이 실행됩니다. 다시 연결(re-attach) 시 메모리 내 로그와 디스크상의 JSONL을 조정하므로 페이지를 벗어나도 기록이 손실되지 않습니다. 슬래시 명령 자동 완성, 파일 참조, 실시간 토큰/컨텍스트 윈도우 미터, 사고 노력(thinking-effort) 다이얼을 통해 브라우저에서도 TUI와 동등한 경험을 제공합니다. 동일 출처(same-origin) 가드가 무단 실행을 차단합니다.",
    "A 12-tab inspector at <code>/cc-config</code> for everything Claude Code knows about: skills, subagents, slash commands, output styles, plugins, marketplaces, MCP servers, hooks, settings, memory, keybindings, and statusline scripts. The Settings tab leads with a Current configuration summary of the options <code>/config</code> controls — model, verbose, theme, output style, auto-compact, notifications — resolved across scopes. The Memory tab surfaces both the user and project <code>CLAUDE.md</code> files and the per-project file-based memory store — every auto-memory <code>*.md</code> under <code>~/.claude/projects/&lt;slug&gt;/memory/</code> (a <code>MEMORY.md</code> index plus one file per remembered fact, often 100+), grouped by project, searchable, and editable. Create, edit, and delete the low-risk text-file surfaces with mandatory timestamped backups before every write. Plugins, MCP, hooks, and live settings stay read-only with explainer banners and copy-able CLI commands. Per-plugin contribution breakdowns show author and license.":
      "<code>/cc-config</code>에서 Claude Code가 알고 있는 모든 것을 보여주는 12개 탭짜리 검사 도구입니다: 스킬, 서브에이전트, 슬래시 명령, 출력 스타일, 플러그인, 마켓플레이스, MCP 서버, 훅, 설정, 메모리, 키바인딩, 상태줄 스크립트가 포함됩니다. Settings 탭은 <code>/config</code>가 제어하는 옵션 — 모델, verbose, 테마, 출력 스타일, 자동 컴팩트, 알림 — 을 범위별로 해석하여 보여주는 현재 설정 요약으로 시작합니다. Memory 탭은 사용자 및 프로젝트의 <code>CLAUDE.md</code> 파일과 프로젝트별 파일 기반 메모리 저장소 — <code>~/.claude/projects/&lt;slug&gt;/memory/</code> 아래의 모든 자동 메모리 <code>*.md</code>(<code>MEMORY.md</code> 인덱스와 기억된 사실마다 하나씩, 보통 100개 이상의 파일) — 를 프로젝트별로 그룹화하여 검색 및 편집할 수 있게 보여줍니다. 위험도가 낮은 텍스트 파일 영역은 생성, 편집, 삭제가 가능하며 모든 쓰기 작업 전에 타임스탬프가 찍힌 백업이 필수로 생성됩니다. 플러그인, MCP, 훅, 실시간 설정은 설명 배너와 복사 가능한 CLI 명령과 함께 읽기 전용으로 유지됩니다. 플러그인별 기여도 분석은 작성자와 라이선스를 보여줍니다.",
    "Mobile-first layouts with stacking grids, horizontally scrollable tables, and a collapsible sidebar that auto-hides below 1400 px. All pages adapt from phone to ultrawide with consistent navigation and readable typography. Kanban columns stack vertically on narrow screens, analytics charts reflow to single-column, and the activity feed stays fully swipeable. Touch targets meet 44 px minimum. Dark theme renders consistently across iOS Safari, Chrome, and Firefox with no flash of unstyled content.":
      "스태킹 그리드, 가로 스크롤이 가능한 테이블, 1400px 미만에서 자동으로 숨겨지는 접이식 사이드바를 갖춘 모바일 우선 레이아웃입니다. 모든 페이지는 스마트폰부터 울트라와이드 화면까지 일관된 내비게이션과 읽기 쉬운 타이포그래피로 적응합니다. 칸반 열은 좁은 화면에서 세로로 쌓이고, 분석 차트는 단일 열로 재배치되며, 활동 피드는 완전히 스와이프 가능한 상태를 유지합니다. 터치 대상은 최소 44px를 충족합니다. 다크 테마는 스타일이 적용되지 않은 콘텐츠가 잠깐 보이는 현상 없이 iOS Safari, Chrome, Firefox에서 일관되게 렌더링됩니다.",
    "Visualize parallel agent execution with a Gantt-style timeline showing overlapping subagent lifetimes, tool-call concurrency windows, and wait gaps. Color-coded bars distinguish working, waiting, and errored states so bottlenecks are immediately visible. Hover any bar for exact timestamps and duration. Zoom and pan across long-running sessions with hundreds of agents. The timeline shares the Workflows status filter so you can isolate active, completed, or errored sessions without leaving the view.":
      "겹치는 서브에이전트 수명, 도구 호출 동시성 구간, 대기 간격을 보여주는 간트 차트 스타일 타임라인으로 병렬 에이전트 실행을 시각화합니다. 색상으로 구분된 막대는 작업 중, 대기 중, 오류 상태를 구분하여 병목 지점을 즉시 확인할 수 있게 합니다. 막대에 마우스를 올리면 정확한 타임스탬프와 지속 시간을 확인할 수 있습니다. 수백 개의 에이전트가 포함된 장시간 실행 세션도 확대/축소 및 이동이 가능합니다. 타임라인은 Workflows 상태 필터를 공유하므로 화면을 벗어나지 않고도 활성, 완료, 오류 세션을 분리해서 볼 수 있습니다.",
    "Professional VS Code extension with a real-time Activity Bar sidebar showing active sessions, agent counts, and recent events without leaving your editor. A status bar pulse monitor surfaces connection health and the latest event type at a glance. Deep navigation links open any session or analytics view directly in your browser. An embedded webview renders the full dashboard inside a VS Code tab with WebSocket push, theme sync, and responsive layout. Install from the marketplace or build from source.":
      "에디터를 벗어나지 않고도 활성 세션, 에이전트 수, 최근 이벤트를 보여주는 실시간 액티비티 바 사이드바를 갖춘 전문가용 VS Code 확장입니다. 상태 표시줄 펄스 모니터는 연결 상태와 최신 이벤트 유형을 한눈에 보여줍니다. 딥 내비게이션 링크로 브라우저에서 바로 세션이나 분석 화면을 열 수 있습니다. 내장된 웹뷰는 WebSocket 푸시, 테마 동기화, 반응형 레이아웃과 함께 VS Code 탭 안에서 전체 대시보드를 렌더링합니다. 마켓플레이스에서 설치하거나 소스에서 직접 빌드할 수 있습니다.",
    "Trace how errors cascade across agents and tool calls with a directed graph showing failure origins, retry paths, and recovery points. Each node displays the agent or tool that errored, the error message, and whether a retry succeeded or propagated upstream. Pinpoint root causes in deeply nested subagent chains. Horizontal bar charts rank the most error-prone tools and models. API error cards group failures by HTTP status and endpoint. Filter by session, time range, or error severity to narrow the view.":
      "오류 발생 지점, 재시도 경로, 복구 지점을 보여주는 방향성 그래프로 오류가 에이전트와 도구 호출 전반에 어떻게 전파되는지 추적합니다. 각 노드는 오류가 발생한 에이전트 또는 도구, 오류 메시지, 재시도가 성공했는지 아니면 상위로 전파되었는지를 표시합니다. 깊이 중첩된 서브에이전트 체인에서도 근본 원인을 정확히 짚어낼 수 있습니다. 가로 막대그래프는 오류가 가장 자주 발생하는 도구와 모델의 순위를 보여줍니다. API 오류 카드는 HTTP 상태와 엔드포인트별로 실패를 그룹화합니다. 세션, 시간 범위, 오류 심각도로 필터링하여 범위를 좁힐 수 있습니다.",
    'Three independent PWAs — dashboard, landing page, and wiki — each with its own Web App Manifest and Service Worker. Install to your home screen or dock for a standalone, chrome-less experience. SVG icons with <code>sizes="any"</code> and iOS standalone meta tags included.':
      '각각 고유한 Web App Manifest와 Service Worker를 갖춘 세 개의 독립적인 PWA — 대시보드, 랜딩 페이지, 위키입니다. 홈 화면이나 독(dock)에 설치하면 브라우저 UI 없이 독립 실행형으로 사용할 수 있습니다. <code>sizes="any"</code> SVG 아이콘과 iOS 독립 실행형(standalone) 메타 태그가 포함되어 있습니다.',
    "The dashboard SW serves Vite's hashed <code>/assets/*</code> bundles cache-first (URLs are immutable per build) and treats everything else as network-first with cache fallback. Explicit <code>Cache-Control</code> headers on the production Express static middleware reinforce the policy, so a rebuild replaces the in-browser code without a hard refresh.":
      "대시보드 서비스 워커는 Vite가 해시를 붙인 <code>/assets/*</code> 번들을 캐시 우선(cache-first) 방식으로 제공하고(URL은 빌드마다 불변이므로), 그 외의 모든 것은 네트워크 우선(network-first)에 캐시 폴백을 적용합니다. 프로덕션 Express 정적 미들웨어의 명시적인 <code>Cache-Control</code> 헤더가 이 정책을 뒷받침하므로, 리빌드 시 강제 새로고침 없이도 브라우저 내 코드가 교체됩니다.",
    "A <code>controllerchange</code> listener in <code>client/src/main.tsx</code> reloads the page exactly once when a new SW takes over an already-controlled page. First installs do not reload, so the very first visit is never interrupted.":
      "<code>client/src/main.tsx</code>의 <code>controllerchange</code> 리스너는 이미 제어 중인 페이지를 새 서비스 워커가 인수할 때 정확히 한 번만 페이지를 새로고침합니다. 최초 설치 시에는 새로고침하지 않으므로 첫 방문이 중단되는 일은 없습니다.",
    '<span class="caption-icon">📡</span> <span><strong>Dashboard · Monitor</strong> — live overview of active sessions and agents. Stats tiles, collapsible subagent hierarchy cards, and a recent activity feed. Auto-refreshes every 5 s via WebSocket</span>':
      '<span class="caption-icon">📡</span> <span><strong>Dashboard · Monitor</strong> — 활성 세션 및 에이전트의 실시간 개요. 통계 타일, 접을 수 있는 서브에이전트 계층 카드, 최근 활동 피드. WebSocket을 통해 5초마다 자동 새로고침됩니다</span>',
    '<span class="caption-icon">🩺</span> <span><strong>Dashboard · Health</strong> — composite health score ring, storage engine donut, cache/error/success gauges, tool invocation bars, subagent effectiveness, and model token distribution</span>':
      '<span class="caption-icon">🩺</span> <span><strong>Dashboard · Health</strong> — 종합 상태 점수 링, 스토리지 엔진 도넛 차트, 캐시/오류/성공 게이지, 도구 호출 막대그래프, 서브에이전트 효율성, 모델별 토큰 분포</span>',
    '<span class="caption-icon">📋</span> <span><strong>Kanban Board (agents)</strong> — agents swim-laned by status: Working, Waiting, Completed, Error. Cards show model, cost, and current tool call. Yellow column flags agents waiting on user input</span>':
      '<span class="caption-icon">📋</span> <span><strong>Kanban Board (agents)</strong> — 상태별로 스윔레인 처리된 에이전트: 작업 중, 대기 중, 완료, 오류. 카드에는 모델, 비용, 현재 도구 호출이 표시됩니다. 노란색 열은 사용자 입력을 기다리는 에이전트를 표시합니다</span>',
    '<span class="caption-icon">🗂️</span> <span><strong>Kanban Board (sessions)</strong> — sessions swim-laned across 5 columns: Active, Waiting, Completed, Error, Abandoned. Each card shows agent count, duration, model, and cumulative cost</span>':
      '<span class="caption-icon">🗂️</span> <span><strong>Kanban Board (sessions)</strong> — 5개의 열로 스윔레인 처리된 세션: 활성, 대기 중, 완료, 오류, 중단됨. 각 카드는 에이전트 수, 지속 시간, 모델, 누적 비용을 표시합니다</span>',
    '<span class="caption-icon">📂</span> <span><strong>Sessions</strong> — searchable, filterable, server-paginated table. Each row shows status badge, agent count, duration, model, and cost. Click any row to drill into session detail</span>':
      '<span class="caption-icon">📂</span> <span><strong>Sessions</strong> — 검색 및 필터링이 가능한 서버 페이지네이션 테이블입니다. 각 행은 상태 배지, 에이전트 수, 지속 시간, 모델, 비용을 표시합니다. 행을 클릭하면 세션 상세 화면으로 이동합니다</span>',
    '<span class="caption-icon">🤖</span> <span><strong>Session Detail · Agents</strong> — overview tiles (events, tool calls, subagents, errors, duration), top-tool usage bars, subagent type breakdown, and a collapsible parent–child agent hierarchy tree</span>':
      '<span class="caption-icon">🤖</span> <span><strong>Session Detail · Agents</strong> — 개요 타일(이벤트, 도구 호출, 서브에이전트, 오류, 지속 시간), 상위 도구 사용 막대그래프, 서브에이전트 유형 분석, 접을 수 있는 부모-자식 에이전트 계층 트리</span>',
    '<span class="caption-icon">💬</span> <span><strong>Session Detail · Conversation</strong> — full transcript viewer with markdown rendering, syntax-highlighted code blocks, per-tool sections, and collapsible thinking blocks</span>':
      '<span class="caption-icon">💬</span> <span><strong>Session Detail · Conversation</strong> — 마크다운 렌더링, 구문 강조된 코드 블록, 도구별 섹션, 접을 수 있는 사고(thinking) 블록을 갖춘 전체 트랜스크립트 뷰어</span>',
    '<span class="caption-icon">🔬</span> <span><strong>Session Detail · Timeline</strong> — chronological event timeline with multi-dimension filters, color-coded entries by type, expandable hook payloads, and direct links to the owning session and agent</span>':
      '<span class="caption-icon">🔬</span> <span><strong>Session Detail · Timeline</strong> — 다차원 필터, 유형별 색상 구분 항목, 확장 가능한 훅 페이로드, 해당 세션 및 에이전트로의 직접 링크를 갖춘 시간순 이벤트 타임라인</span>',
    '<span class="caption-icon">📰</span> <span><strong>Activity Feed</strong> — real-time streaming event log with pause/resume buffering, multi-dimension filters, expandable hook payloads, color-coded entries, and per-row session navigation buttons</span>':
      '<span class="caption-icon">📰</span> <span><strong>Activity Feed</strong> — 일시정지/재개 버퍼링, 다차원 필터, 확장 가능한 훅 페이로드, 색상 구분 항목, 행별 세션 이동 버튼을 갖춘 실시간 스트리밍 이벤트 로그</span>',
    '<span class="caption-icon">📊</span> <span><strong>Analytics</strong> — token usage by model, tool frequency bars, 52-week activity heatmap, 30-day sparkline trends, session outcome donuts, and cost summary with WebSocket auto-refresh</span>':
      '<span class="caption-icon">📊</span> <span><strong>Analytics</strong> — 모델별 토큰 사용량, 도구 사용 빈도 막대그래프, 52주 활동 히트맵, 30일 스파크라인 추세, 세션 결과 도넛 차트, WebSocket 자동 새로고침이 적용된 비용 요약</span>',
    '<span class="caption-icon">🔀</span> <span><strong>Workflows</strong> — D3.js agent orchestration DAG, tool-execution Sankey diagram, directed pipeline graph, effectiveness scorecards, concurrency swim-lanes, and complexity bubble charts</span>':
      '<span class="caption-icon">🔀</span> <span><strong>Workflows</strong> — D3.js 기반 에이전트 오케스트레이션 DAG, 도구 실행 생키 다이어그램, 방향성 파이프라인 그래프, 효율성 스코어카드, 동시성 스윔레인, 복잡도 버블 차트</span>',
    '<span class="caption-icon">🧰</span> <span><strong>Claude Config Explorer</strong> — 12-tab inspector for skills, subagents, slash commands, plugins, MCP servers, hooks, settings, memory, keybindings, and statusline. Safe edits with backups</span>':
      '<span class="caption-icon">🧰</span> <span><strong>Claude Config Explorer</strong> — 스킬, 서브에이전트, 슬래시 명령, 플러그인, MCP 서버, 훅, 설정, 메모리, 키바인딩, 상태줄을 위한 12개 탭짜리 검사 도구입니다. 백업과 함께 안전하게 편집할 수 있습니다</span>',
    '<span class="caption-icon">▶️</span> <span><strong>Run Claude</strong> — spawn or resume Claude subprocesses from the browser. Pick Conversation or Headless mode, set cwd, model, permission level, and thinking effort. Same-origin guard included</span>':
      '<span class="caption-icon">▶️</span> <span><strong>Run Claude</strong> — 브라우저에서 Claude 서브프로세스를 실행하거나 재개합니다. Conversation 또는 Headless 모드를 선택하고 cwd, 모델, 권한 수준, 사고 노력을 설정할 수 있습니다. 동일 출처 가드가 포함되어 있습니다</span>',
    '<span class="caption-icon">💬</span> <span><strong>Run Claude · live stream</strong> — character-by-character streaming output. Tool uses, tool results, and thinking blocks are collapsible. Active runs switcher juggles multiple sessions</span>':
      '<span class="caption-icon">💬</span> <span><strong>Run Claude · live stream</strong> — 한 글자씩 스트리밍되는 출력입니다. 도구 사용, 도구 결과, 사고 블록은 접을 수 있습니다. 실행 중인 세션 전환기로 여러 세션을 오갈 수 있습니다</span>',
    '<span class="caption-icon">⚙️</span> <span><strong>Settings</strong> — model pricing editor with per-token rates, hook installation status, JSON data export, session cleanup controls, browser notification toggles, and system info panel with DB stats</span>':
      '<span class="caption-icon">⚙️</span> <span><strong>Settings</strong> — 토큰당 요율을 설정하는 모델 가격 편집기, 훅 설치 상태, JSON 데이터 내보내기, 세션 정리 기능, 브라우저 알림 토글, DB 통계가 포함된 시스템 정보 패널</span>',
    "This chart tracks how interest in Claude Code Agent Monitor has grown over time. The curve keeps climbing as more developers discover the project, share it, and use it in real workflows. Each new star is a small vote of confidence from the community.":
      "이 차트는 Claude Code Agent Monitor에 대한 관심이 시간이 지나면서 어떻게 성장했는지를 보여줍니다. 더 많은 개발자가 이 프로젝트를 발견하고, 공유하고, 실제 워크플로에서 사용함에 따라 곡선은 계속 상승합니다. 새로운 스타 하나하나가 커뮤니티의 작은 신뢰 표시입니다.",
    '<span class="caption-icon">⭐</span> <span> Enjoying the project? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer" >Give it a star on GitHub</a > and help more builders discover it. </span>':
      '<span class="caption-icon">⭐</span> <span> 이 프로젝트가 마음에 드시나요? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer" >GitHub에서 스타를 눌러주세요</a > 더 많은 개발자가 이 프로젝트를 발견할 수 있도록 도와주세요. </span>',
    "Hook Type": "훅 유형",
    Trigger: "트리거",
    "Dashboard Action": "대시보드 동작",
    "Claude Code session begins": "Claude Code 세션 시작",
    "Creates session and main agent. Stamps <code>awaiting_input_since</code> so the row lands in <strong>Waiting</strong> from the start (the CLI is at a prompt). Reactivates resumed sessions. Abandons orphaned sessions with no activity for <code>DASHBOARD_STALE_MINUTES</code> (default 180).":
      "세션과 메인 에이전트를 생성합니다. CLI가 프롬프트 상태이므로 처음부터 <strong>Waiting</strong>에 위치하도록 <code>awaiting_input_since</code>를 기록합니다. 재개된 세션을 다시 활성화합니다. <code>DASHBOARD_STALE_MINUTES</code>(기본값 180) 동안 활동이 없는 고아 세션은 중단 처리합니다.",
    "User hits enter on a prompt": "사용자가 프롬프트에서 엔터를 입력",
    'Clears the waiting flag and promotes the main agent to <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >. The only reliable signal that text-only assistant turns have started — they emit no <code>PreToolUse</code> before <code>Stop</code>.':
      '대기 플래그를 지우고 메인 에이전트를 <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >으로 전환합니다. 텍스트로만 이루어진 어시스턴트 턴이 시작되었음을 알 수 있는 유일하게 신뢰할 수 있는 신호입니다 — 이런 턴은 <code>Stop</code> 이전에 <code>PreToolUse</code>를 전혀 발생시키지 않습니다.',
    "Agent begins using a tool": "에이전트가 도구 사용을 시작",
    'Clears the waiting flag, sets agent → <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >, <code>current_tool</code> set. If tool is <code>Agent</code>, subagent record created.':
      '대기 플래그를 지우고 에이전트를 <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >으로 설정하며, <code>current_tool</code>을 지정합니다. 도구가 <code>Agent</code>인 경우 서브에이전트 레코드를 생성합니다.',
    "Tool execution completes": "도구 실행 완료",
    'Clears the waiting flag (covers permission-prompt approvals mid-tool). <code>current_tool</code> cleared. Agent stays <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span >.':
      '대기 플래그를 지웁니다(도구 실행 중 권한 프롬프트 승인도 포함). <code>current_tool</code>이 지워집니다. 에이전트는 계속 <span class="status-chip chip-working" ><span class="chip-dot"></span>Working</span > 상태를 유지합니다.',
    "Claude finishes a turn": "Claude가 턴을 종료",
    'Non-error: main agent → <code>waiting</code> — UI shows <span class="status-chip chip-waiting" ><span class="chip-dot"></span>Waiting</span > until the next user input. <code>stop_reason=error</code>: marks the agent and session <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >. Background subagents keep running.':
      '오류가 아닌 경우: 메인 에이전트 → <code>waiting</code> — 다음 사용자 입력이 있을 때까지 UI에 <span class="status-chip chip-waiting" ><span class="chip-dot"></span>Waiting</span >이 표시됩니다. <code>stop_reason=error</code>인 경우: 에이전트와 세션을 <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >로 표시합니다. 백그라운드 서브에이전트는 계속 실행됩니다.',
    "Background agent finished": "백그라운드 에이전트 완료",
    "Matched subagent → <span class=\"status-chip chip-completed\" ><span class=\"chip-dot\"></span>Completed</span >. Deliberately does <strong>not</strong> clear the waiting flag — a backgrounded subagent finishing tells us nothing about the human. Also kicks off a fire-and-forget JSONL scan (<code>scanAndImportSubagents</code>) that walks the session's <code>subagents/agent-*.jsonl</code> files, pairs <code>tool_use</code> ↔ <code>tool_result</code> blocks by <code>tool_use_id</code>, and emits per-tool <code>PreToolUse</code> + <code>PostToolUse</code> events under each subagent's own <code>agent_id</code> — surfaces tool calls that subagents make internally and which never fire any hooks. The same scan also rebuilds the nested-subagent hierarchy — it repoints each subagent's <code>parent_agent_id</code> to the true spawner recovered from the transcript's Task tool result (<code>toolUseResult.agentId</code>), so subagents that spawn their own subagents nest correctly instead of flattening under main.":
      '일치하는 서브에이전트 → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. 대기 플래그는 의도적으로 지우지 <strong>않습니다</strong> — 백그라운드 서브에이전트가 완료되었다는 사실은 사용자에 대해 아무것도 알려주지 않기 때문입니다. 또한 세션의 <code>subagents/agent-*.jsonl</code> 파일을 순회하며 <code>tool_use_id</code>로 <code>tool_use</code>와 <code>tool_result</code> 블록을 짝짓고, 각 서브에이전트 고유의 <code>agent_id</code> 아래에 도구별 <code>PreToolUse</code> + <code>PostToolUse</code> 이벤트를 발생시키는 fire-and-forget JSONL 스캔(<code>scanAndImportSubagents</code>)도 시작됩니다 — 이를 통해 서브에이전트가 내부적으로 수행하지만 어떤 훅도 발생시키지 않는 도구 호출을 드러냅니다. 같은 스캔은 중첩된 서브에이전트 계층도 재구성합니다 — 트랜스크립트의 Task 도구 결과(<code>toolUseResult.agentId</code>)에서 복구한 실제 생성자로 각 서브에이전트의 <code>parent_agent_id</code>를 다시 지정하므로, 자체적으로 서브에이전트를 생성하는 서브에이전트도 메인 아래로 평탄화되지 않고 올바르게 중첩됩니다.',
    "Agent sends notification": "에이전트가 알림 전송",
    'Event logged to activity feed. Permission/input-prompt patterns (e.g. "needs your permission", "waiting for your input") set the agent to <code>waiting</code> and stamp <code>awaiting_input_since</code>. Compaction-related notifications tagged as <code>Compaction</code> events. Triggers a browser notification if enabled.':
      '이벤트가 활동 피드에 기록됩니다. 권한/입력 프롬프트 패턴(예: "needs your permission", "waiting for your input")은 에이전트를 <code>waiting</code>으로 설정하고 <code>awaiting_input_since</code>를 기록합니다. 컴팩션 관련 알림은 <code>Compaction</code> 이벤트로 태그됩니다. 활성화되어 있으면 브라우저 알림을 트리거합니다.',
    "<code>/compact</code> detected in JSONL": "JSONL에서 <code>/compact</code> 감지됨",
    'Creates a compaction subagent → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Detected via <code>isCompactSummary</code> entries in the transcript. Token baselines preserve pre-compaction totals. Periodic scanner (cadence ~¼ of <code>DASHBOARD_STALE_MINUTES</code>) catches compactions when no hooks fire.':
      '컴팩션 서브에이전트를 생성합니다 → <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. 트랜스크립트의 <code>isCompactSummary</code> 항목을 통해 감지됩니다. 토큰 기준값은 컴팩션 이전 총합을 보존합니다. 주기적 스캐너(주기는 대략 <code>DASHBOARD_STALE_MINUTES</code>의 1/4)가 훅이 발생하지 않는 컴팩션도 포착합니다.',
    "API error detected in transcript": "트랜스크립트에서 API 오류 감지됨",
    "Extracted from JSONL during history import, real-time transcript scanning, or the error detection watchdog. Captures quota limits, rate limits, auth failures, and other API errors. <strong>Immediately marks sessions and agents as error</strong> — previously recorded as events without changing status.":
      "기록 가져오기, 실시간 트랜스크립트 스캔, 또는 오류 감지 워치독 중에 JSONL에서 추출됩니다. 할당량 한도, 속도 제한, 인증 실패 등 다양한 API 오류를 포착합니다. <strong>세션과 에이전트를 즉시 오류 상태로 표시합니다</strong> — 이전에는 상태를 변경하지 않고 이벤트로만 기록되었습니다.",
    "Turn cancelled by the user (<code>Esc</code>)": "사용자가 턴을 취소함(<code>Esc</code>)",
    "Synthesized by the watchdog because pressing <code>Esc</code> fires no hook. Recovered either from the transcript <code>[Request interrupted by user]</code> marker (flagged as <code>pendingInterrupt</code>) or, when <code>Esc</code> preceded any output and left no marker, from the idle-working timeout (<code>DASHBOARD_WORKING_IDLE_SECONDS</code>, default 120). Moves the session to <strong>Waiting</strong> — the same state a normal <code>Stop</code> produces.":
      "<code>Esc</code>를 누르면 훅이 전혀 발생하지 않으므로 워치독이 이 이벤트를 합성합니다. 트랜스크립트의 <code>[Request interrupted by user]</code> 마커(<code>pendingInterrupt</code>로 표시됨)로부터 복구되거나, 출력이 나오기 전에 <code>Esc</code>가 눌려 마커가 남지 않은 경우에는 유휴 작업 타임아웃(<code>DASHBOARD_WORKING_IDLE_SECONDS</code>, 기본값 120)을 통해 복구됩니다. 세션을 <strong>Waiting</strong> 상태로 전환합니다 — 일반적인 <code>Stop</code>이 발생시키는 것과 동일한 상태입니다.",
    "Per-turn timing recorded": "턴별 타이밍 기록됨",
    "Extracted from JSONL turn boundaries. Records the duration of each assistant turn for latency analysis.":
      "JSONL의 턴 경계에서 추출됩니다. 지연 시간 분석을 위해 각 어시스턴트 턴의 지속 시간을 기록합니다.",
    "Claude Code CLI process exits": "Claude Code CLI 프로세스 종료",
    'Drops the waiting flag. If the session is already in <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span >, the error state is preserved; otherwise marks all agents and the session as <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >. Evicts the session\'s transcript from the shared cache.':
      '대기 플래그를 제거합니다. 세션이 이미 <span class="status-chip chip-error" ><span class="chip-dot"></span>Error</span > 상태라면 오류 상태를 그대로 유지하고, 그렇지 않으면 모든 에이전트와 세션을 <span class="status-chip chip-completed" ><span class="chip-dot"></span>Completed</span >로 표시합니다. 공유 캐시에서 세션의 트랜스크립트를 축출합니다.',
    "Clone the repository to your machine": "저장소를 컴퓨터에 클론합니다",
    "Run <code>npm run setup</code> to install all dependencies":
      "<code>npm run setup</code>을 실행하여 모든 의존성을 설치합니다",
    "Run <code>npm run dev</code> — server + client launch automatically":
      "<code>npm run dev</code>를 실행합니다 — 서버와 클라이언트가 자동으로 실행됩니다",
    "Start a new Claude Code session — events appear in real-time":
      "새 Claude Code 세션을 시작합니다 — 이벤트가 실시간으로 표시됩니다",
    "A multi-stage <code>Dockerfile</code> and <code>docker-compose.yml</code> are included. You can run the monitor with either Docker or Podman and keep the SQLite database in a named volume.":
      "멀티스테이지 <code>Dockerfile</code>과 <code>docker-compose.yml</code>이 포함되어 있습니다. Docker 또는 Podman으로 모니터를 실행할 수 있으며 SQLite 데이터베이스는 명명된 볼륨에 보관할 수 있습니다.",
    "Hooks auto-install in local mode": "로컬 모드에서는 훅이 자동으로 설치됩니다",
    "When you run the server directly on the host with <code>npm run dev</code> or <code>npm start</code>, it automatically writes Claude Code hook entries to <code>~/.claude/settings.json</code>. If you run the dashboard in Docker or Podman, install hooks from the host with <code>npm run install-hooks</code> after the container is up, then restart Claude Code. The installer refuses to run inside a container (issue #193) so it never writes a container-internal handler path into a bind-mounted host <code>~/.claude</code>; override with <code>CCAM_ALLOW_CONTAINER_HOOKS=1</code> only if Claude Code itself runs in the container.":
      "<code>npm run dev</code> 또는 <code>npm start</code>로 서버를 호스트에서 직접 실행하면 Claude Code 훅 항목이 <code>~/.claude/settings.json</code>에 자동으로 기록됩니다. Docker나 Podman에서 대시보드를 실행하는 경우, 컨테이너가 실행된 후 호스트에서 <code>npm run install-hooks</code>로 훅을 설치한 다음 Claude Code를 재시작하세요. 설치 프로그램은 컨테이너 내부에서 실행되는 것을 거부하므로(이슈 #193) 바인드 마운트된 호스트의 <code>~/.claude</code>에 컨테이너 내부 핸들러 경로가 기록되는 일이 없습니다. Claude Code 자체가 컨테이너 안에서 실행되는 경우에만 <code>CCAM_ALLOW_CONTAINER_HOOKS=1</code>로 이 동작을 재정의하세요.",
    "This repository also ships a local MCP server under <code>mcp/</code> and extension scaffolding for both Claude Code and Codex. These are optional for the dashboard UI, but recommended for complete local-agent workflows. The MCP server supports stdio (for host integration), HTTP+SSE (for remote clients), and an interactive REPL (for operator debugging).":
      "이 저장소에는 <code>mcp/</code> 아래에 로컬 MCP 서버와 Claude Code 및 Codex를 위한 확장 스캐폴딩도 함께 제공됩니다. 이는 대시보드 UI에는 선택 사항이지만, 완전한 로컬 에이전트 워크플로를 위해서는 사용을 권장합니다. MCP 서버는 stdio(호스트 통합용), HTTP+SSE(원격 클라이언트용), 대화형 REPL(운영자 디버깅용)을 지원합니다.",
    "After starting a Claude Code session, you should see:":
      "Claude Code 세션을 시작하면 다음과 같은 모습을 확인할 수 있습니다.",
    Page: "페이지",
    Expected: "예상 결과",
    Sessions: "Sessions",
    'Your session listed with status <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> (a fresh CLI is sitting at the prompt) — flips to <span class="status-chip chip-active"><span class="chip-dot"></span>Active</span> the moment Claude starts a turn':
      '세션이 <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> 상태로 표시됩니다(새 CLI가 프롬프트 상태로 대기 중) — Claude가 턴을 시작하는 순간 <span class="status-chip chip-active"><span class="chip-dot"></span>Active</span>로 전환됩니다',
    "Kanban Board": "Kanban Board",
    "A <em>Main Agent</em> card in the <strong>Waiting</strong> column until you type your first message; flips to <em>Working</em> on <code>UserPromptSubmit</code> / <code>PreToolUse</code> and back to <em>Waiting</em> after each <code>Stop</code>":
      "첫 메시지를 입력하기 전까지는 <strong>Waiting</strong> 열에 <em>Main Agent</em> 카드가 표시되며, <code>UserPromptSubmit</code> / <code>PreToolUse</code> 시 <em>Working</em>으로 전환되었다가 매 <code>Stop</code> 이후 다시 <em>Waiting</em>으로 돌아갑니다",
    "Activity Feed": "Activity Feed",
    'Events streaming in; click any row to expand payload, use "Session →" to drill into session details':
      '이벤트가 실시간으로 스트리밍됩니다. 행을 클릭하면 페이로드가 확장되며, "Session →"를 사용해 세션 상세 정보로 이동할 수 있습니다',
    Dashboard: "Dashboard",
    "Stats updating in real-time": "통계가 실시간으로 업데이트됩니다",
    "Start server before Claude Code": "Claude Code보다 먼저 서버를 시작하세요",
    "Hooks only fire to a running server. If Claude Code was already running when you started the dashboard, restart the Claude Code session.":
      "훅은 실행 중인 서버로만 전송됩니다. 대시보드를 시작하기 전에 Claude Code가 이미 실행 중이었다면 Claude Code 세션을 재시작하세요.",
    Variable: "변수",
    Default: "기본값",
    Description: "설명",
    "Port the Express server listens on": "Express 서버가 수신 대기하는 포트",
    "Port used by the hook handler to reach the server (for custom port setups)":
      "훅 핸들러가 서버에 접근할 때 사용하는 포트(사용자 지정 포트 설정용)",
    "Base URL used by the local MCP server when calling dashboard APIs":
      "로컬 MCP 서버가 대시보드 API를 호출할 때 사용하는 기본 URL",
    "MCP transport mode: <code>stdio</code>, <code>http</code>, <code>repl</code>":
      "MCP 전송 모드: <code>stdio</code>, <code>http</code>, <code>repl</code>",
    "Port for the MCP HTTP+SSE server (only when <code>MCP_TRANSPORT=http</code>)":
      "MCP HTTP+SSE 서버용 포트(<code>MCP_TRANSPORT=http</code>인 경우에만 사용)",
    "Bind address for the MCP HTTP server": "MCP HTTP 서버의 바인드 주소",
    "Path to the SQLite database file": "SQLite 데이터베이스 파일 경로",
    "Set to <code>0</code> to disable the dead-session liveness reap — the watchdog completes active sessions with no running <code>claude</code> process; auto-disabled on Windows and in containers":
      "<code>0</code>으로 설정하면 죽은 세션에 대한 생존 확인 정리(reap) 기능이 비활성화됩니다 — 워치독은 실행 중인 <code>claude</code> 프로세스가 없는 활성 세션을 완료 처리합니다. Windows와 컨테이너에서는 자동으로 비활성화됩니다",
    "Idle gate for watchdog-tick liveness reaps — the transcript must not have been written for at least this long (last hook write is the fallback clock); startup passes skip the gate":
      "워치독 틱의 생존 확인 정리를 위한 유휴 게이트 — 트랜스크립트가 최소 이 시간 동안 기록되지 않아야 합니다(마지막 훅 기록 시각이 대체 기준이 됩니다). 시작 시점의 패스는 이 게이트를 건너뜁니다",
    "Idle-working timeout the watchdog uses to recover an <code>Esc</code> cancel that left no transcript marker":
      "트랜스크립트에 마커를 남기지 않은 <code>Esc</code> 취소를 복구하기 위해 워치독이 사용하는 유휴 작업 타임아웃",
    "Poll interval for the background sync of <code>~/.claude/projects</code>; <code>0</code> disables the poll but keeps the filesystem watcher":
      "<code>~/.claude/projects</code> 백그라운드 동기화의 폴링 간격입니다. <code>0</code>으로 설정하면 폴링은 비활성화되지만 파일 시스템 워처는 계속 유지됩니다",
    "Set to <code>production</code> to serve built client from <code>client/dist/</code>":
      "<code>production</code>으로 설정하면 <code>client/dist/</code>에서 빌드된 클라이언트를 제공합니다",
    "The server writes the following to <code>~/.claude/settings.json</code> on every startup:":
      "서버는 시작할 때마다 다음 내용을 <code>~/.claude/settings.json</code>에 기록합니다.",
    "Existing hooks are preserved. The installer only adds or updates entries containing <code>hook-handler.js</code>.":
      "기존 훅은 그대로 유지됩니다. 설치 프로그램은 <code>hook-handler.js</code>가 포함된 항목만 추가하거나 업데이트합니다.",
    Script: "스크립트",
    Command: "명령어",
    "Install all dependencies (server + client)": "모든 의존성 설치(서버 + 클라이언트)",
    "Start server + client in development mode with hot reload":
      "핫 리로드가 적용된 개발 모드로 서버와 클라이언트를 시작",
    "Start only the Express server with <code>--watch</code>":
      "<code>--watch</code> 옵션으로 Express 서버만 시작",
    "Start only the Vite dev server": "Vite 개발 서버만 시작합니다",
    "TypeScript check + Vite production build to <code>client/dist/</code>":
      "TypeScript 검사 후 <code>client/dist/</code>로 Vite 프로덕션 빌드를 수행합니다",
    "Start Express in production mode serving built client":
      "빌드된 클라이언트를 제공하는 프로덕션 모드로 Express를 시작합니다",
    "Manually write Claude Code hooks to <code>~/.claude/settings.json</code>":
      "Claude Code hook을 <code>~/.claude/settings.json</code>에 수동으로 기록합니다",
    "Insert demo sessions, agents, and events (8 sessions / 23 agents / 106 events)":
      "데모 세션, 에이전트, 이벤트를 삽입합니다 (세션 8개 / 에이전트 23개 / 이벤트 106개)",
    "Import historical Claude Code sessions from <code>~/.claude</code> with deep JSONL extraction (API errors, turn durations, thinking blocks, subagent data)":
      "<code>~/.claude</code>에서 과거 Claude Code 세션을 가져오며, JSONL을 심층 추출합니다 (API 오류, 턴 소요 시간, 생각 블록, Subagent 데이터)",
    "Delete all data from the database (keeps schema)":
      "데이터베이스의 모든 데이터를 삭제합니다 (스키마는 유지)",
    "Run all server and client tests": "서버 및 클라이언트 테스트를 모두 실행합니다",
    "Server integration tests only (Node built-in test runner)":
      "서버 통합 테스트만 실행합니다 (Node 내장 테스트 러너)",
    "Client unit tests only (Vitest + Testing Library)":
      "클라이언트 단위 테스트만 실행합니다 (Vitest + Testing Library)",
    "Install dependencies for the local MCP package under <code>mcp/</code>":
      "<code>mcp/</code> 하위의 로컬 MCP 패키지 의존성을 설치합니다",
    "Type-check MCP source without emitting build output":
      "빌드 결과물을 생성하지 않고 MCP 소스의 타입을 검사합니다",
    "Compile MCP server into <code>mcp/build/</code>":
      "MCP 서버를 <code>mcp/build/</code>로 컴파일합니다",
    "Start MCP server (stdio transport — for MCP hosts)":
      "MCP 서버를 시작합니다 (stdio 전송 방식 — MCP 호스트용)",
    "Start MCP HTTP+SSE server on port 8819 (Streamable HTTP + legacy SSE)":
      "포트 8819에서 MCP HTTP+SSE 서버를 시작합니다 (Streamable HTTP + 레거시 SSE)",
    "Start interactive MCP REPL with tab completion and colored output":
      "탭 자동완성과 컬러 출력을 지원하는 대화형 MCP REPL을 시작합니다",
    "Run MCP server in dev mode with <code>tsx</code> (stdio)":
      "<code>tsx</code>를 사용해 개발 모드로 MCP 서버를 실행합니다 (stdio)",
    "Run MCP HTTP server in dev mode with <code>tsx</code>":
      "<code>tsx</code>를 사용해 개발 모드로 MCP HTTP 서버를 실행합니다",
    "Run MCP REPL in dev mode with <code>tsx</code>":
      "<code>tsx</code>를 사용해 개발 모드로 MCP REPL을 실행합니다",
    "Build MCP container image with Docker (<code>agent-dashboard-mcp:local</code>)":
      "Docker로 MCP 컨테이너 이미지를 빌드합니다 (<code>agent-dashboard-mcp:local</code>)",
    "Build MCP container image with Podman (<code>localhost/agent-dashboard-mcp:local</code>)":
      "Podman으로 MCP 컨테이너 이미지를 빌드합니다 (<code>localhost/agent-dashboard-mcp:local</code>)",
    "Run MCP server unit tests": "MCP 서버 단위 테스트를 실행합니다",
    "Install Electron + electron-builder under <code>desktop/</code>; rebuilds <code>better-sqlite3</code> for Electron's ABI. Preflights the native <code>better-sqlite3</code> build; prints actionable setup help (incl. a no-toolchain alternative) on failure":
      "<code>desktop/</code> 하위에 Electron과 electron-builder를 설치하고, Electron의 ABI에 맞게 <code>better-sqlite3</code>를 다시 빌드합니다. 네이티브 <code>better-sqlite3</code> 빌드를 사전 점검하며, 실패 시 (툴체인이 없는 경우의 대안을 포함한) 실행 가능한 설정 도움말을 출력합니다",
    "Prebuild guard + <code>tsc</code> compile of the Electron main process into <code>desktop/out/</code>":
      "사전 빌드 가드 실행 후 Electron 메인 프로세스를 <code>tsc</code>로 컴파일하여 <code>desktop/out/</code>에 출력합니다",
    "Build, then launch the desktop app against <code>desktop/out/main.js</code>":
      "빌드한 뒤 <code>desktop/out/main.js</code>를 대상으로 데스크톱 앱을 실행합니다",
    "Desktop smoke test — spawn Electron and probe <code>/api/health</code>":
      "데스크톱 스모크 테스트 — Electron을 구동하고 <code>/api/health</code>를 점검합니다",
    "Build a <strong>universal</strong> (x64 + arm64) DMG. Correct for release — intentionally slow":
      "<strong>유니버설</strong>(x64 + arm64) DMG를 빌드합니다. 릴리스에 적합하며, 의도적으로 느립니다",
    "Build an Apple-Silicon-only DMG — fast (~1 min), recommended for a single machine":
      "Apple Silicon 전용 DMG를 빌드합니다 — 빠르며(약 1분), 단일 머신에서 사용을 권장합니다",
    "Build an Intel-only DMG — fast (macOS host)":
      "Intel 전용 DMG를 빌드합니다 — 빠름 (macOS 호스트)",
    "Build the Windows NSIS installer <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> (Windows host)":
      "Windows NSIS 설치 프로그램 <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>를 빌드합니다 (Windows 호스트)",
    "Build the no-install portable <code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code> (Windows host)":
      "설치가 필요 없는 포터블 <code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>를 빌드합니다 (Windows 호스트)",
    "Regenerate <code>desktop/assets/icon.ico</code> from <code>icon.png</code> (PowerShell + .NET; Windows host)":
      "<code>icon.png</code>로부터 <code>desktop/assets/icon.ico</code>를 재생성합니다 (PowerShell + .NET; Windows 호스트)",
    "Format all files with Prettier": "Prettier로 모든 파일의 서식을 정리합니다",
    "Check formatting without writing": "파일을 수정하지 않고 서식만 검사합니다",
    "Core dashboard telemetry is composed of three processes (Claude hook source, dashboard server, browser UI). When the local MCP sidecar is enabled, it integrates with the same dashboard API via stdio, HTTP+SSE, or interactive REPL transport.":
      "핵심 대시보드 텔레메트리는 세 개의 프로세스(Claude hook 소스, 대시보드 서버, 브라우저 UI)로 구성됩니다. 로컬 MCP 사이드카가 활성화되면 stdio, HTTP+SSE, 또는 대화형 REPL 전송 방식을 통해 동일한 대시보드 API와 통합됩니다.",
    "Full system architecture — Claude Code process → Hook Layer → Server → Browser":
      "전체 시스템 아키텍처 — Claude Code 프로세스 → Hook 계층 → 서버 → 브라우저",
    "Agent status transitions driven by hook events. <code>waiting</code> is a real persisted status — agents start as <code>waiting</code> and return to it after each turn. Error recovery requires active user retry (<code>UserPromptSubmit</code> or <code>PreToolUse</code>). A background watchdog detects API errors in transcripts every 15 s. The same watchdog also recovers <code>Esc</code>-cancelled turns — via either the transcript <code>[Request interrupted by user]</code> marker or the idle-working timeout when <code>Esc</code> preceded any output — and moves the session to Waiting.":
      "hook 이벤트에 의해 구동되는 에이전트 상태 전이입니다. <code>waiting</code>은 실제로 영속화되는 상태로, 에이전트는 <code>waiting</code>으로 시작하며 매 턴이 끝날 때마다 이 상태로 돌아옵니다. 오류 복구에는 사용자의 능동적인 재시도(<code>UserPromptSubmit</code> 또는 <code>PreToolUse</code>)가 필요합니다. 백그라운드 워치독이 15초마다 transcript에서 API 오류를 감지합니다. 동일한 워치독은 transcript의 <code>[Request interrupted by user]</code> 마커, 또는 <code>Esc</code> 입력 후 아무 출력도 없을 때의 유휴 작업 타임아웃을 통해 <code>Esc</code>로 취소된 턴도 복구하며, 세션을 Waiting 상태로 전환합니다.",
    "Session status lifecycle. <code>waiting</code> is a UI overlay — persisted as <code>active</code> with <code>awaiting_input_since</code> set. <code>SessionEnd</code> preserves error state. Error recovery requires <code>UserPromptSubmit</code> or <code>PreToolUse</code>. The watchdog also recovers <code>Esc</code>-cancelled turns (marker or idle-timeout path) and moves the session to Waiting.":
      "세션 상태 생명주기입니다. <code>waiting</code>은 UI 오버레이로, 실제로는 <code>awaiting_input_since</code>가 설정된 <code>active</code> 상태로 영속화됩니다. <code>SessionEnd</code>는 오류 상태를 그대로 유지합니다. 오류 복구에는 <code>UserPromptSubmit</code> 또는 <code>PreToolUse</code>가 필요합니다. 워치독은 (마커 또는 유휴 타임아웃 경로를 통해) <code>Esc</code>로 취소된 턴도 복구하여 세션을 Waiting 상태로 전환합니다.",
    "Complete event ingestion from hook fire to browser re-render":
      "hook 발생부터 브라우저 리렌더링까지 이어지는 전체 이벤트 수집 과정",
    "Initial load + WebSocket subscription lifecycle": "초기 로드 + WebSocket 구독 생명주기",
    "Server module dependency graph": "서버 모듈 의존성 그래프",
    Module: "모듈",
    Responsibility: "역할",
    "Express app setup, middleware (CORS, JSON 1MB limit), route mounting, static serving in production, HTTP server, auto-hook installation on startup":
      "Express 앱 설정, 미들웨어(CORS, JSON 1MB 제한), 라우트 마운트, 프로덕션 환경의 정적 파일 제공, HTTP 서버, 시작 시 hook 자동 설치",
    "SQLite connection, WAL/FK pragmas, schema migrations (<code >CREATE TABLE IF NOT EXISTS</code >), all prepared statements as a reusable <code>stmts</code> object. Tries <code>better-sqlite3</code> first, falls back to built-in <code>node:sqlite</code> via <code>compat-sqlite.js</code>":
      "SQLite 연결, WAL/FK 프래그마, 스키마 마이그레이션(<code >CREATE TABLE IF NOT EXISTS</code >), 재사용 가능한 <code>stmts</code> 객체로 관리되는 모든 프리페어드 스테이트먼트. 먼저 <code>better-sqlite3</code>를 시도하고, 실패하면 <code>compat-sqlite.js</code>를 통해 내장된 <code>node:sqlite</code>로 폴백합니다",
    "Compatibility wrapper giving Node.js built-in <code>node:sqlite</code> (<code>DatabaseSync</code>) the same API as <code>better-sqlite3</code> — pragma, transaction, prepare. Used as automatic fallback on Node 22+":
      "Node.js 내장 <code>node:sqlite</code>(<code>DatabaseSync</code>)에 <code>better-sqlite3</code>와 동일한 API(pragma, transaction, prepare)를 제공하는 호환성 래퍼입니다. Node 22 이상에서 자동 폴백으로 사용됩니다",
    "WebSocket server on <code>/ws</code> path, 30s ping/pong heartbeat, typed <code>broadcast(type, data)</code> function":
      "<code>/ws</code> 경로의 WebSocket 서버, 30초 ping/pong 하트비트, 타입이 지정된 <code>broadcast(type, data)</code> 함수",
    "Core event processing inside SQLite transactions. Auto-creates sessions/agents. Switch-case dispatch by hook type. Extracts token usage from Stop events.":
      "SQLite 트랜잭션 내에서 수행되는 핵심 이벤트 처리입니다. 세션/에이전트를 자동으로 생성합니다. hook 타입별로 switch-case 방식으로 분기합니다. Stop 이벤트에서 토큰 사용량을 추출합니다.",
    "CRUD with pagination. GET includes agent count via LEFT JOIN. POST is idempotent on session ID.":
      "페이지네이션을 지원하는 CRUD입니다. GET은 LEFT JOIN을 통해 에이전트 수를 포함합니다. POST는 세션 ID 기준으로 멱등성을 가집니다.",
    "CRUD with status/session_id filtering. PATCH broadcasts <code>agent_updated</code>.":
      "status/session_id 필터링을 지원하는 CRUD입니다. PATCH는 <code>agent_updated</code>를 브로드캐스트합니다.",
    "Read-only event listing with session_id filter and pagination.":
      "session_id 필터와 페이지네이션을 지원하는 읽기 전용 이벤트 목록입니다.",
    "Single aggregate query — total/active counts, status distributions, WS connection count.":
      "단일 집계 쿼리 — 전체/활성 개수, 상태 분포, WS 연결 수.",
    "Extended analytics — token totals, tool usage counts, daily event/session trends, agent type distribution, event type breakdown, average events per session.":
      "확장 분석 — 토큰 총합, 도구 사용 횟수, 일별 이벤트/세션 추이, 에이전트 유형 분포, 이벤트 유형별 분류, 세션당 평균 이벤트 수.",
    "Model pricing CRUD (list, upsert, delete). Per-session and global cost calculation with pattern-based model matching and specificity sorting.":
      "모델 가격 CRUD(목록 조회, upsert, 삭제)입니다. 패턴 기반 모델 매칭과 구체성 정렬을 통해 세션별 및 전체 비용을 계산합니다.",
    "System info (DB size, row counts, hook status, server uptime). Data export as JSON. Session cleanup (abandon stale active sessions, purge old completed sessions). Clear all data. Reset pricing to defaults. Reinstall hooks.":
      "시스템 정보(DB 크기, 행 수, hook 상태, 서버 가동 시간)입니다. 데이터를 JSON으로 내보냅니다. 세션 정리(오래된 활성 세션을 중단 처리하고, 오래된 완료 세션을 삭제)를 수행합니다. 모든 데이터를 삭제합니다. 가격을 기본값으로 초기화합니다. hook을 재설치합니다.",
    "Aggregate workflow visualization data (agent orchestration, tool transitions, collaboration networks, workflow patterns, model delegation, error propagation, concurrency, session complexity, compaction impact). Accepts <code>?status=active|completed</code> filter. Per-session drill-in with agent tree, tool timeline, and events.":
      "워크플로 시각화 데이터를 집계합니다(에이전트 오케스트레이션, 도구 전이, 협업 네트워크, 워크플로 패턴, 모델 위임, 오류 전파, 동시성, 세션 복잡도, 컴팩션 영향). <code>?status=active|completed</code> 필터를 지원합니다. 에이전트 트리, 도구 타임라인, 이벤트를 포함한 세션별 상세 드릴인을 제공합니다.",
    "React component tree": "React 컴포넌트 트리",
    Purpose: "목적",
    "<code>lib/api.ts</code>": "<code>lib/api.ts</code>",
    "Typed fetch wrapper — one method per REST endpoint. All return typed promises.":
      "타입이 지정된 fetch 래퍼 — REST 엔드포인트마다 메서드가 하나씩 있습니다. 모두 타입이 지정된 Promise를 반환합니다.",
    "<code>lib/types.ts</code>": "<code>lib/types.ts</code>",
    "TypeScript interfaces: <code>Session</code>, <code>Agent</code>, <code>DashboardEvent</code>, <code>Stats</code>, <code>Analytics</code>, <code>WSMessage</code>, plus all workflow-related types (<code>WorkflowData</code>, <code>SessionDrillIn</code>, etc). Status config maps.":
      "TypeScript 인터페이스: <code>Session</code>, <code>Agent</code>, <code>DashboardEvent</code>, <code>Stats</code>, <code>Analytics</code>, <code>WSMessage</code>와 워크플로 관련 타입 전체(<code>WorkflowData</code>, <code>SessionDrillIn</code> 등). 상태 설정 맵.",
    "<code>lib/eventBus.ts</code>": "<code>lib/eventBus.ts</code>",
    "Set-based pub/sub. <code>subscribe(fn)</code> returns an unsubscribe function for clean useEffect teardown.":
      "Set 기반 pub/sub입니다. <code>subscribe(fn)</code>은 useEffect를 깔끔하게 정리할 수 있도록 구독 해제 함수를 반환합니다.",
    "<code>lib/format.ts</code>": "<code>lib/format.ts</code>",
    "Date/time formatting helpers — relative time, duration, ISO display.":
      "날짜/시간 포맷팅 헬퍼 — 상대 시간, 기간, ISO 표시.",
    "<code>hooks/useWebSocket.ts</code>": "<code>hooks/useWebSocket.ts</code>",
    "Auto-reconnecting WebSocket React hook. 2-second reconnect interval. Publishes messages to eventBus.":
      "자동 재연결되는 WebSocket React hook입니다. 재연결 간격은 2초입니다. 메시지를 eventBus에 게시합니다.",
    "The dashboard is a Progressive Web App with its own <code>manifest.json</code> and Service Worker (<code>client/public/sw.js</code>). The landing page and wiki are also independent PWAs with separate manifests and service workers.":
      "대시보드는 자체 <code>manifest.json</code>과 서비스 워커(<code>client/public/sw.js</code>)를 갖춘 Progressive Web App입니다. 랜딩 페이지와 위키 또한 각각 별도의 매니페스트와 서비스 워커를 가진 독립적인 PWA입니다.",
    Surface: "영역",
    Manifest: "매니페스트",
    "Service Worker": "서비스 워커",
    Strategy: "전략",
    "<code>client/public/manifest.json</code>": "<code>client/public/manifest.json</code>",
    "<code>client/public/sw.js</code>": "<code>client/public/sw.js</code>",
    "Precaches app shell. Cache-first for static assets (JS/CSS bundles). Network-first for navigation with offline fallback. Skips <code>/api/*</code>, <code>/ws</code>, and Vite HMR. Preserves push notification handlers.":
      "앱 셸을 사전 캐싱합니다. 정적 자산(JS/CSS 번들)은 캐시 우선 방식입니다. 내비게이션은 오프라인 폴백을 포함한 네트워크 우선 방식입니다. <code>/api/*</code>, <code>/ws</code>, Vite HMR은 제외됩니다. 푸시 알림 핸들러는 유지됩니다.",
    "Landing page": "랜딩 페이지",
    "<code>manifest.json</code> (root)": "<code>manifest.json</code> (root)",
    "<code>sw.js</code> (root)": "<code>sw.js</code> (root)",
    "Precaches HTML shell, favicon, OG image. Lazy-caches screenshot PNGs on first view. Network-first HTML, cache-first assets.":
      "HTML 셸, 파비콘, OG 이미지를 사전 캐싱합니다. 스크린샷 PNG는 처음 볼 때 지연 캐싱됩니다. HTML은 네트워크 우선, 자산은 캐시 우선 방식입니다.",
    Wiki: "위키",
    "<code>wiki/manifest.json</code>": "<code>wiki/manifest.json</code>",
    "<code>wiki/sw.js</code>": "<code>wiki/sw.js</code>",
    "Precaches <code>index.html</code>, <code>style.css</code>, <code>script.js</code>. Fully offline after one visit.":
      "<code>index.html</code>, <code>style.css</code>, <code>script.js</code>를 사전 캐싱합니다. 한 번 방문하면 완전히 오프라인으로 동작합니다.",
    'All three SWs call <code>skipWaiting()</code> on install and delete stale caches on activate (keyed by version strings like <code>dashboard-v1</code>). Manifests use SVG icons (<code>favicon.svg</code>) with <code>sizes="any"</code>. iOS standalone mode is enabled via <code>apple-mobile-web-app-capable</code> meta tags.':
      '세 서비스 워커 모두 설치 시 <code>skipWaiting()</code>을 호출하고, 활성화 시 (<code>dashboard-v1</code>과 같은 버전 문자열을 키로 하는) 오래된 캐시를 삭제합니다. 매니페스트는 <code>sizes="any"</code>를 지정한 SVG 아이콘(<code>favicon.svg</code>)을 사용합니다. iOS 독립 실행형 모드는 <code>apple-mobile-web-app-capable</code> 메타 태그를 통해 활성화됩니다.',
    "The client deliberately avoids Redux / Zustand / Context. Each page owns its data and lifecycle. WebSocket events trigger a reload or append — no complex state merging.":
      "클라이언트는 의도적으로 Redux / Zustand / Context를 사용하지 않습니다. 각 페이지가 자신의 데이터와 생명주기를 직접 소유합니다. WebSocket 이벤트는 재로드 또는 추가(append)를 트리거할 뿐, 복잡한 상태 병합은 하지 않습니다.",
    "No global store — by design": "전역 스토어 없음 — 의도된 설계",
    "There is no cross-page shared state. Each page fetches and owns exactly the data it displays. This simplifies debugging and avoids stale-closure hazards that are common with global stores in long-running WebSocket apps.":
      "페이지 간에 공유되는 상태는 없습니다. 각 페이지는 자신이 표시할 데이터만 정확히 가져와 소유합니다. 이는 디버깅을 단순화하고, 장시간 실행되는 WebSocket 앱에서 전역 스토어를 사용할 때 흔히 발생하는 stale-closure 문제를 방지합니다.",
    Index: "인덱스",
    Table: "테이블",
    "Column(s)": "컬럼",
    "Fast agent lookup by session": "세션 기준 빠른 에이전트 조회",
    "Kanban column queries": "칸반 컬럼 쿼리",
    "Session detail event list": "세션 상세 이벤트 목록",
    "Filter events by type": "유형별 이벤트 필터링",
    "Activity feed ordering": "활동 피드 정렬",
    "Status filter on sessions page": "세션 페이지의 상태 필터",
    "Default sort order": "기본 정렬 순서",
    Pragma: "Pragma",
    Value: "값",
    Rationale: "근거",
    "Concurrent reads during writes. Far better for read-heavy dashboards.":
      "쓰기 중에도 동시 읽기가 가능합니다. 읽기 위주의 대시보드에 훨씬 유리합니다.",
    "Referential integrity — prevents orphaned agents/events.":
      "참조 무결성 — 고아 에이전트/이벤트 발생을 방지합니다.",
    "Wait up to 5s for write lock instead of failing immediately under load.":
      "부하 상황에서 즉시 실패하는 대신 쓰기 락을 최대 5초까지 대기합니다.",
    'All endpoints return JSON. Errors follow <code>{ "error": { "code", "message" } }</code>. The OpenAPI 3.0 spec comprehensively documents every backend route - parameters, request/response schemas, field descriptions, and examples. It is served at <code>/api/openapi.json</code> (with a committed <code>openapi.yaml</code> mirror), rendered as interactive Swagger UI at <code>/api/docs</code>, and as a clean, read-optimized ReDoc reference at <code>/api/redoc</code>. ReDoc is self-hosted, so it works fully offline.':
      '모든 엔드포인트는 JSON을 반환합니다. 오류는 <code>{ "error": { "code", "message" } }</code> 형식을 따릅니다. OpenAPI 3.0 스펙은 모든 백엔드 라우트 - 파라미터, 요청/응답 스키마, 필드 설명, 예제 - 를 빠짐없이 문서화합니다. 이 스펙은 <code>/api/openapi.json</code>에서 제공되며(커밋된 <code>openapi.yaml</code> 미러 포함), <code>/api/docs</code>에서 대화형 Swagger UI로, <code>/api/redoc</code>에서 읽기에 최적화된 깔끔한 ReDoc 레퍼런스로 렌더링됩니다. ReDoc은 자체 호스팅되므로 완전히 오프라인에서도 동작합니다.',
    '<span class="caption-icon">📘</span> <span>Swagger UI at <code>/api/docs</code> — auto-generated interactive playground for every REST endpoint. Try-it-out forms, request/response schema, auth headers, and curl snippets</span>':
      '<span class="caption-icon">📘</span> <span><code>/api/docs</code>의 Swagger UI — 모든 REST 엔드포인트에 대해 자동 생성되는 대화형 플레이그라운드입니다. Try-it-out 폼, 요청/응답 스키마, 인증 헤더, curl 스니펫을 제공합니다</span>',
    Property: "속성",
    Path: "경로",
    Protocol: "프로토콜",
    "Standard WebSocket (RFC 6455)": "표준 WebSocket (RFC 6455)",
    Heartbeat: "하트비트",
    "Server pings every 30s — clients that don't pong are terminated":
      "서버는 30초마다 핑을 보내며, pong으로 응답하지 않는 클라이언트는 연결이 종료됩니다",
    Reconnect: "재연결",
    "Client retries every 2 seconds on disconnect":
      "클라이언트는 연결이 끊기면 2초마다 재시도합니다",
    "Client WebSocket auto-reconnect state machine": "클라이언트 WebSocket 자동 재연결 상태 머신",
    "<code>scripts/hook-handler.js</code> is a minimal, fail-safe forwarder. It always exits 0 so it can never block Claude Code regardless of server state.":
      "<code>scripts/hook-handler.js</code>는 최소한의 기능만 갖춘 fail-safe 포워더입니다. 서버 상태와 무관하게 Claude Code를 절대 차단하지 않도록 항상 0으로 종료합니다.",
    "hook-handler.js flow — always exits 0, never blocks Claude Code":
      "hook-handler.js 흐름 — 항상 0으로 종료되며 Claude Code를 절대 차단하지 않습니다",
    "Hook installation is idempotent — safe to run multiple times":
      "Hook 설치는 멱등적이므로 여러 번 실행해도 안전합니다",
    '<span class="caption-icon">📥</span> <span>Settings → Import History — rescan default paths, set a custom directory, or drag-and-drop <code>.gz</code> archives. Progress bar and result card show counts for every run</span>':
      '<span class="caption-icon">📥</span> <span>설정 → 가져오기 기록 — 기본 경로를 다시 스캔하거나, 사용자 지정 디렉터리를 설정하거나, <code>.gz</code> 아카이브를 드래그 앤 드롭할 수 있습니다. 진행률 표시줄과 결과 카드에 매 실행의 집계 수치가 표시됩니다</span>',
    "The dashboard ships with a first-class <b>history importer</b> that backfills sessions, agents, events, tokens, and costs from Claude Code JSONL transcripts. Live hook ingestion and manual import share the exact same parser — <code>parseSessionFile</code> + <code>importSession</code> in <code>scripts/import-history.js</code> — which is the architectural contract that guarantees imported token totals and cost values are identical to those captured in real time. Re-imports are idempotent: session IDs are the dedup key and compaction <code>baseline_*</code> columns preserve pre-compaction token totals.":
      "대시보드는 Claude Code JSONL transcript로부터 세션, 에이전트, 이벤트, 토큰, 비용을 소급 채워주는 완전한 기능의 <b>기록 가져오기(history importer)</b>를 기본 제공합니다. 실시간 hook 수집과 수동 가져오기는 정확히 동일한 파서 — <code>scripts/import-history.js</code>의 <code>parseSessionFile</code> + <code>importSession</code> — 를 공유하며, 이것이 가져온 토큰 총합과 비용 값이 실시간으로 수집된 값과 동일함을 보장하는 아키텍처적 계약입니다. 재가져오기는 멱등적입니다: 세션 ID가 중복 제거 키로 사용되며, 컴팩션 <code>baseline_*</code> 컬럼이 컴팩션 이전의 토큰 총합을 보존합니다.",
    "All three modes funnel into the same parser and DB transaction — imported numbers match live capture bit-for-bit":
      "세 가지 모드 모두 동일한 파서와 DB 트랜잭션으로 수렴합니다 — 가져온 수치는 실시간 캡처 값과 완전히 일치합니다",
    "Upload path: multipart → safe extract → walk → parse → import — every temp dir reclaimed in <code>finally</code>":
      "업로드 경로: multipart → 안전한 압축 해제 → 순회 → 파싱 → 가져오기 — 모든 임시 디렉터리는 <code>finally</code>에서 회수됩니다",
    "The <code>baseline_*</code> columns make cost monotonic under re-imports — compacted sessions retain pre-compaction usage for billing":
      "<code>baseline_*</code> 컬럼은 재가져오기 시에도 비용이 단조 증가하도록 보장합니다 — 컴팩션된 세션도 청구를 위해 컴팩션 이전 사용량을 유지합니다",
    Layout: "레이아웃",
    Example: "예시",
    Handling: "처리 방식",
    "Default Claude Code": "기본 Claude Code",
    "Session transcript — extracts tokens, compactions, tool uses, turn durations":
      "세션 transcript — 토큰, 컴팩션, 도구 사용, 턴 소요 시간을 추출합니다",
    "Default subagent": "기본 서브에이전트",
    "Paired with parent on discovery via <code>findSessionSubagents</code>":
      "검색 시 <code>findSessionSubagents</code>를 통해 부모와 페어링됨",
    "Alternative subagent": "대체 서브에이전트",
    "Paired with parent on discovery (second layout probed automatically)":
      "검색 시 부모와 페어링됨(두 번째 레이아웃이 자동으로 탐색됨)",
    "Orphan subagent": "고아 서브에이전트",
    "No parent JSONL in source, but <code>sid</code> exists in DB":
      "소스에 부모 JSONL이 없지만 DB에 <code>sid</code>가 존재함",
    "<code>importFromDirectory</code> probes both layouts; attaches if the parent is found":
      "<code>importFromDirectory</code>가 두 레이아웃을 모두 탐색하며, 부모를 찾으면 연결함",
    "Flat JSONL drop": "평면 JSONL 드롭",
    "Recognized as a loose session transcript": "느슨한 세션 트랜스크립트로 인식됨",
    Archives: "아카이브",
    "Extracted into a per-request temp dir, then walked by the same importer":
      "요청별 임시 디렉터리로 압축 해제된 후 동일한 임포터가 순회함",
    "Single-file gzip": "단일 파일 gzip",
    "Gunzipped in streaming mode with running byte-counter size cap":
      "실행 중인 바이트 카운터 크기 제한을 적용해 스트리밍 방식으로 압축 해제됨",
    Threat: "위협",
    Mitigation: "완화 조치",
    "Path traversal via archive entries": "아카이브 항목을 통한 경로 순회 공격",
    "<code>archive.safeJoin</code> resolves under the extraction root; any <code>..</code> or absolute path returns <code>null</code>":
      "<code>archive.safeJoin</code>은 추출 루트 하위에서 경로를 해석하며, <code>..</code>나 절대 경로는 <code>null</code>을 반환함",
    "Zip / tar / gzip bombs": "Zip / tar / gzip 폭탄",
    "<code>MAX_EXTRACT_BYTES</code> (default 4 GB) enforced by running byte counter; aborts with <code>ExtractionLimitError</code> → HTTP 413":
      "실행 중인 바이트 카운터가 <code>MAX_EXTRACT_BYTES</code>(기본값 4GB)를 강제하며, 초과 시 <code>ExtractionLimitError</code>로 중단됨 → HTTP 413",
    "Per-file upload size abuse": "파일별 업로드 크기 남용",
    "multer <code>limits.fileSize = MAX_UPLOAD_BYTES</code> (default 1 GB)":
      "multer <code>limits.fileSize = MAX_UPLOAD_BYTES</code>(기본값 1GB)",
    "Too many files per request": "요청당 파일 수 초과",
    "multer <code>limits.files = MAX_UPLOAD_FILES</code> (default 2000)":
      "multer <code>limits.files = MAX_UPLOAD_FILES</code>(기본값 2000)",
    "Unsupported file types": "지원되지 않는 파일 형식",
    "<code>fileFilter</code> drops them early and reports them in <code>rejected_files[]</code>":
      "<code>fileFilter</code>가 이를 조기에 제외하고 <code>rejected_files[]</code>에 보고함",
    "Concurrent upload temp-dir collisions": "동시 업로드 임시 디렉터리 충돌",
    "Per-request temp dir on <code>req._ccamUploadDir</code>; created in multer <code>destination</code>, reclaimed in <code>finally</code>":
      "<code>req._ccamUploadDir</code>에 요청별 임시 디렉터리가 사용됨. multer <code>destination</code>에서 생성되고 <code>finally</code>에서 회수됨",
    "Arbitrary absolute path on <code>scan-path</code>":
      "<code>scan-path</code>에 임의의 절대 경로 입력",
    "Validated: must be absolute (after <code>~</code> expansion), exist, and be a directory":
      "검증됨: <code>~</code> 확장 후 절대 경로여야 하며, 존재해야 하고, 디렉터리여야 함",
    "Relative / traversal paths on <code>scan-path</code>":
      "<code>scan-path</code>의 상대 경로 / 순회 경로",
    "Rejected with <code>INVALID_INPUT</code>": "<code>INVALID_INPUT</code>으로 거부됨",
    "Maximum size per uploaded file on <code>/api/import/upload</code>":
      "<code>/api/import/upload</code>에서 업로드 파일당 최대 크기",
    "Maximum files per upload request": "업로드 요청당 최대 파일 수",
    "Ceiling on total uncompressed bytes from any single archive (zip-bomb defense)":
      "단일 아카이브에서 압축 해제된 총 바이트 수의 상한(zip 폭탄 방어)",
    "Every import emits <code>import.progress</code> messages on <code>/ws</code>. Messages are throttled to at most one every ~150 ms to avoid flooding the channel on multi-thousand-session imports; the terminal <code>complete</code> and <code>error</code> frames are never throttled.":
      "모든 임포트는 <code>/ws</code>에서 <code>import.progress</code> 메시지를 전송합니다. 수천 개 세션을 임포트할 때 채널이 넘치지 않도록 메시지는 최대 약 150ms에 한 번으로 제한되며, 최종 <code>complete</code> 및 <code>error</code> 프레임은 절대 제한되지 않습니다.",
    "Phases: <code>start</code> → <code>scan</code> → <code>extract</code> (upload only) → <code>parse</code> → <code>complete</code>, with <code>error</code> / <code>extract_error</code> replacing <code>complete</code> on failure.":
      "단계: <code>start</code> → <code>scan</code> → <code>extract</code>(업로드 전용) → <code>parse</code> → <code>complete</code>이며, 실패 시 <code>complete</code> 대신 <code>error</code> / <code>extract_error</code>가 대체됩니다.",
    "In addition to dashboard telemetry, this project includes a production-grade local MCP server and complete extension scaffolding for both Claude Code and Codex. This gives agents a richer local tool surface while keeping all execution local-first. The MCP server supports three transport modes: stdio for host integration, HTTP+SSE for remote clients, and an interactive REPL for operator debugging.":
      "대시보드 텔레메트리 외에도 이 프로젝트는 프로덕션 등급의 로컬 MCP 서버와 Claude Code 및 Codex 모두를 위한 완전한 확장 스캐폴딩을 포함합니다. 이를 통해 모든 실행을 로컬 우선으로 유지하면서도 에이전트에게 더 풍부한 로컬 도구 인터페이스를 제공합니다. MCP 서버는 호스트 통합을 위한 stdio, 원격 클라이언트를 위한 HTTP+SSE, 운영자 디버깅을 위한 대화형 REPL이라는 세 가지 전송 모드를 지원합니다.",
    '<span class="caption-icon">🔧</span> MCP Server REPL — interactive tool invocation terminal with colored JSON output, argument prompts, error formatting, and session-aware context for rapid testing':
      '<span class="caption-icon">🔧</span> MCP 서버 REPL — 색상이 적용된 JSON 출력, 인자 프롬프트, 오류 포맷팅, 빠른 테스트를 위한 세션 인식 컨텍스트를 갖춘 대화형 도구 호출 터미널',
    "Local extension architecture: host instructions + skills + multi-transport MCP sidecar":
      "로컬 확장 아키텍처: 호스트 지침 + 스킬 + 다중 전송 MCP 사이드카",
    "The <code>mcp/</code> package exposes dashboard-oriented tools for AI agents across three transport modes. Mutation and destructive operations are policy-gated by environment variables and disabled by default. HTTP mode serves both Streamable HTTP (protocol 2025-11-25) and legacy SSE (protocol 2024-11-05). REPL mode provides tab-completed interactive tool invocation with colored output and JSON syntax highlighting.":
      "<code>mcp/</code> 패키지는 세 가지 전송 모드에서 AI 에이전트를 위한 대시보드 지향 도구를 제공합니다. 변경 및 파괴적 작업은 환경 변수로 정책 제어되며 기본적으로 비활성화되어 있습니다. HTTP 모드는 Streamable HTTP(프로토콜 2025-11-25)와 레거시 SSE(프로토콜 2024-11-05)를 모두 지원합니다. REPL 모드는 탭 완성이 가능한 대화형 도구 호출을 색상 출력 및 JSON 구문 강조와 함께 제공합니다.",
    Component: "구성 요소",
    Location: "위치",
    Notes: "비고",
    "MCP source": "MCP 소스",
    "TypeScript server, tools, policy guards, transport layer, CLI UI":
      "TypeScript 서버, 도구, 정책 가드, 전송 계층, CLI UI",
    "MCP build output": "MCP 빌드 출력",
    "Compiled JavaScript runtime for all transport modes":
      "모든 전송 모드를 위한 컴파일된 JavaScript 런타임",
    "MCP docs": "MCP 문서",
    "Tool catalog, architecture diagrams, host integration examples, REPL guide":
      "도구 카탈로그, 아키텍처 다이어그램, 호스트 통합 예제, REPL 가이드",
    "Transport layer": "전송 계층",
    "HTTP+SSE server, interactive REPL, tool handler collector":
      "HTTP+SSE 서버, 대화형 REPL, 도구 핸들러 수집기",
    "CLI UI": "CLI UI",
    "ANSI banner, colors, formatter with tables, boxes, JSON highlighting":
      "ANSI 배너, 색상, 표·박스·JSON 강조 표시를 지원하는 포맷터",
    "Runtime commands": "런타임 명령",
    "Start MCP in stdio, HTTP+SSE, or REPL mode (production or dev)":
      "stdio, HTTP+SSE 또는 REPL 모드(프로덕션 또는 개발)로 MCP 시작",
    Target: "대상",
    Files: "파일",
    "Claude Code": "Claude Code",
    "Persistent project instructions + path-scoped coding rules":
      "영구 프로젝트 지침 + 경로 범위 코딩 규칙",
    "Claude Code Skills": "Claude Code 스킬",
    "Reusable workflows (onboarding, shipping, MCP ops, live debugging)":
      "재사용 가능한 워크플로(온보딩, 배포, MCP 운영, 라이브 디버깅)",
    "Claude Code Subagents": "Claude Code 서브에이전트",
    "Specialized reviewers for backend, frontend, and MCP code paths":
      "백엔드, 프런트엔드, MCP 코드 경로를 위한 전문 리뷰어",
    "Codex Base Instructions": "Codex 기본 지침",
    "Project-wide guidance + execution policy defaults":
      "프로젝트 전반의 가이드 + 실행 정책 기본값",
    "Codex Skills": "Codex 스킬",
    "Task-specific skills aligned to this repository": "이 저장소에 맞춘 작업별 스킬",
    "Codex Agents": "Codex 에이전트",
    "Reusable custom-agent templates for implementation and review":
      "구현 및 리뷰를 위한 재사용 가능한 커스텀 에이전트 템플릿",
    Role: "역할",
    "Receives Claude hook payloads over stdin and forwards them to dashboard API":
      "stdin을 통해 Claude 훅 페이로드를 수신하여 대시보드 API로 전달함",
    "Writes/updates hook registration in <code>~/.claude/settings.json</code>":
      "<code>~/.claude/settings.json</code>에 훅 등록을 작성/업데이트함",
    "Batch history importer used by server startup auto-import, the <code>/api/import/*</code> routes, and the <code>import-history</code> CLI. Exposes <code>importAllSessions()</code> for the default projects dir and the generalized <code>importFromDirectory(dbModule, rootDir, {onProgress})</code> which walks any directory recursively, classifies session vs subagent JSONLs (probes both <code>&lt;proj&gt;/&lt;sid&gt;/subagents/*</code> and <code>&lt;proj&gt;/subagents/&lt;sid&gt;/*</code> layouts), and funnels everything through the shared <code>parseSessionFile</code> + <code>importSession</code> pipeline — identical to live ingest. <b>Re-import is fully incremental</b>: a per-event-type high-water mark (<code>MAX(created_at) GROUP BY event_type</code> for the session) drives <code>ts &gt; cutoff[type]</code> dedup for Stop / PostToolUse / TurnDuration / ToolError, so long-running sessions whose transcripts grow across multiple days keep receiving new events on every re-run. <code>sessions.ended_at</code> is rolled forward when the JSONL has progressed past the stored value, and message-count metadata is refreshed on every pass. Session-ID dedup and <code>baseline_*</code> preservation keep token totals stable. Extracts tokens, API errors, turn durations, thinking blocks, usage extras, and per-subagent breakdowns":
      "서버 시작 시 자동 임포트, <code>/api/import/*</code> 라우트, <code>import-history</code> CLI에서 사용되는 배치 히스토리 임포터입니다. 기본 프로젝트 디렉터리를 위한 <code>importAllSessions()</code>와, 임의의 디렉터리를 재귀적으로 순회하며 세션과 서브에이전트 JSONL을 분류하고(<code>&lt;proj&gt;/&lt;sid&gt;/subagents/*</code> 및 <code>&lt;proj&gt;/subagents/&lt;sid&gt;/*</code> 두 레이아웃을 모두 탐색), 모든 것을 공유되는 <code>parseSessionFile</code> + <code>importSession</code> 파이프라인으로 전달하는 일반화된 <code>importFromDirectory(dbModule, rootDir, {onProgress})</code>를 제공하며 — 이는 실시간 수집과 동일합니다. <b>재임포트는 완전히 증분 방식입니다</b>: 이벤트 유형별 하이워터마크(세션에 대한 <code>MAX(created_at) GROUP BY event_type</code>)가 Stop / PostToolUse / TurnDuration / ToolError에 대한 <code>ts &gt; cutoff[type]</code> 중복 제거를 주도하므로, 여러 날에 걸쳐 트랜스크립트가 늘어나는 장시간 실행 세션도 재실행할 때마다 새 이벤트를 계속 수신합니다. JSONL이 저장된 값보다 진행된 경우 <code>sessions.ended_at</code>이 앞으로 갱신되며, 메시지 수 메타데이터는 매 실행마다 새로 고쳐집니다. 세션 ID 중복 제거와 <code>baseline_*</code> 보존은 토큰 합계를 안정적으로 유지합니다. 토큰, API 오류, 턴 지속 시간, 사고(thinking) 블록, 사용량 추가 정보, 서브에이전트별 세부 내역을 추출합니다.",
    "Express router for Import History. Four endpoints: <code>GET /api/import/guide</code> (OS-aware instructions + default-dir stats), <code>POST /api/import/rescan</code> (default <code>~/.claude/projects</code>), <code>POST /api/import/scan-path</code> (arbitrary absolute dir with <code>~</code> expansion), <code>POST /api/import/upload</code> (multer multipart). Each request uses a per-request temp dir reclaimed in <code>finally</code>. Progress broadcast as throttled <code>import.progress</code> WebSocket messages. Limits tunable via <code>CCAM_IMPORT_MAX_BYTES</code>, <code>CCAM_IMPORT_MAX_FILES</code>, <code>CCAM_IMPORT_MAX_EXTRACT_BYTES</code>":
      "임포트 히스토리를 위한 Express 라우터입니다. 네 가지 엔드포인트: <code>GET /api/import/guide</code>(OS 인식 지침 + 기본 디렉터리 통계), <code>POST /api/import/rescan</code>(기본값 <code>~/.claude/projects</code>), <code>POST /api/import/scan-path</code>(<code>~</code> 확장을 지원하는 임의의 절대 디렉터리), <code>POST /api/import/upload</code>(multer 멀티파트). 각 요청은 <code>finally</code>에서 회수되는 요청별 임시 디렉터리를 사용합니다. 진행 상황은 제한된 <code>import.progress</code> WebSocket 메시지로 브로드캐스트됩니다. 제한값은 <code>CCAM_IMPORT_MAX_BYTES</code>, <code>CCAM_IMPORT_MAX_FILES</code>, <code>CCAM_IMPORT_MAX_EXTRACT_BYTES</code>를 통해 조정할 수 있습니다.",
    "Safe archive extraction: <code>.zip</code> via <code>adm-zip</code>, <code>.tar</code>/<code>.tar.gz</code>/<code>.tgz</code> via <code>tar</code>, plain <code>.gz</code> streaming via <code>zlib</code>. Every entry validated through <code>safeJoin</code> which rejects absolute paths and <code>..</code> traversal before any bytes are written. Enforces a hard <code>MAX_EXTRACT_BYTES</code> cap (default 4 GB) with <code>ExtractionLimitError</code> surfaced as HTTP 413 — defense against zip/tar/gzip bombs":
      "안전한 아카이브 추출: <code>adm-zip</code>을 통한 <code>.zip</code>, <code>tar</code>를 통한 <code>.tar</code>/<code>.tar.gz</code>/<code>.tgz</code>, <code>zlib</code>을 통한 일반 <code>.gz</code> 스트리밍. 모든 항목은 바이트가 기록되기 전에 절대 경로와 <code>..</code> 순회를 거부하는 <code>safeJoin</code>을 통해 검증됩니다. 엄격한 <code>MAX_EXTRACT_BYTES</code> 상한(기본값 4GB)을 강제하며, 초과 시 <code>ExtractionLimitError</code>가 HTTP 413으로 표면화됩니다 — zip/tar/gzip 폭탄에 대한 방어책",
    "Loads deterministic demo data for testing and demos":
      "테스트 및 데모를 위한 결정론적 데모 데이터를 로드함",
    "Removes persisted rows while preserving schema": "스키마를 유지하면서 저장된 행을 제거함",
    "The Agent Monitor ships with an official Claude Code plugin marketplace containing ten production-ready plugins (53 skills, 14 agents, 30 slash commands, 3 CLI tools, 3 hook configs, and 1 MCP server). These extend Claude Code with skills, agents, hooks, CLI tools, and MCP integration — all grounded in the real data model (token tracking with compaction baselines, cost calculation via pattern-matched pricing rules, workflow intelligence with 11 datasets per session, and session metadata including thinking blocks, turn counts, and inference geography).":
      "Agent Monitor는 프로덕션 준비가 완료된 열 개의 플러그인(53개 스킬, 14개 에이전트, 30개 슬래시 명령, 3개 CLI 도구, 3개 훅 설정, 1개 MCP 서버)을 포함하는 공식 Claude Code 플러그인 마켓플레이스와 함께 제공됩니다. 이들은 스킬, 에이전트, 훅, CLI 도구, MCP 통합으로 Claude Code를 확장하며 — 모두 실제 데이터 모델(컴팩션 베이스라인을 포함한 토큰 추적, 패턴 매칭 가격 규칙을 통한 비용 계산, 세션당 11개 데이터셋을 갖춘 워크플로 인텔리전스, 사고 블록·턴 수·추론 지역을 포함한 세션 메타데이터)에 기반을 두고 있습니다.",
    Plugin: "플러그인",
    Skills: "스킬",
    Agent: "에이전트",
    "CLI Tools": "CLI 도구",
    Focus: "초점",
    "Token usage (4 types + baselines), cost via pricing engine, daily trends, productivity scoring":
      "토큰 사용량(4가지 유형 + 베이스라인), 가격 산정 엔진을 통한 비용 계산, 일별 트렌드, 생산성 점수",
    "Standup reports, sprint tracking, workflow optimization via 11 workflow intelligence datasets":
      "스탠드업 리포트, 스프린트 추적, 11개 워크플로 인텔리전스 데이터셋을 통한 워크플로 최적화",
    "Session debugging, hook diagnostics, data export (JSON/CSV), system health":
      "세션 디버깅, 훅 진단, 데이터 내보내기(JSON/CSV), 시스템 상태",
    "Pattern detection via tool flow transitions, anomaly alerting, optimization, session comparison":
      "도구 흐름 전이를 통한 패턴 탐지, 이상 징후 알림, 최적화, 세션 비교",
    "Budget guardrails: set budgets, forecast week/month-end spend, cost-threshold alerts, model-routing savings (fail-safe Stop hook)":
      "예산 가드레일: 예산 설정, 주간/월말 지출 예측, 비용 임계값 알림, 모델 라우팅을 통한 절감(장애 안전 Stop 훅)",
    "Session forensics: search, timeline, transcript replay, per-cwd rollup, cleanup":
      "세션 포렌식: 검색, 타임라인, 트랜스크립트 재생, cwd별 집계, 정리",
    "Multi-agent orchestration &amp; fleet intelligence: DAG map, delegation audit, concurrency, error propagation, fleet runs (11-dataset workflow intelligence API)":
      "멀티에이전트 오케스트레이션 &amp; 플릿 인텔리전스: DAG 맵, 위임 감사, 동시성, 오류 전파, 플릿 실행(11개 데이터셋 워크플로 인텔리전스 API)",
    "Reliability &amp; SLOs: error scan, API-error report, hook-failure audit, SLO check, regression alert":
      "안정성 &amp; SLO: 오류 스캔, API 오류 리포트, 훅 실패 감사, SLO 점검, 회귀 알림",
    "Claude Code config &amp; memory governance: config audit, memory review, skill/MCP/hook inventory (via the Config Explorer API)":
      "Claude Code 설정 &amp; 메모리 거버넌스: 설정 감사, 메모리 검토, 스킬/MCP/훅 인벤토리(Config Explorer API를 통해)",
    "Dashboard connector with MCP integration and one-line metric summaries":
      "MCP 통합과 한 줄 지표 요약을 갖춘 대시보드 커넥터",
    "Each plugin follows the official Claude Code plugin specification. The marketplace manifest at <code>.claude-plugin/marketplace.json</code> catalogs all ten plugins. Each plugin directory contains:":
      "각 플러그인은 공식 Claude Code 플러그인 사양을 따릅니다. <code>.claude-plugin/marketplace.json</code>의 마켓플레이스 매니페스트가 열 개 플러그인을 모두 카탈로그화합니다. 각 플러그인 디렉터리는 다음을 포함합니다.",
    "All plugins query the Agent Monitor API at <code>http://localhost:4820</code>. Key capabilities they leverage:":
      "모든 플러그인은 <code>http://localhost:4820</code>의 Agent Monitor API를 조회합니다. 이들이 활용하는 주요 기능은 다음과 같습니다.",
    Capability: "기능",
    Details: "세부 사항",
    "Token tracking": "토큰 추적",
    "4 types (input, output, cache_read, cache_write) + 4 compaction baselines per model per session":
      "4가지 유형(input, output, cache_read, cache_write) + 세션당 모델별 4개의 컴팩션 베이스라인",
    "Cost calculation": "비용 계산",
    "<code>(tokens / 1M) × rate_per_mtok</code> for each type; longest pattern match wins":
      "각 유형에 대해 <code>(tokens / 1M) × rate_per_mtok</code>; 가장 긴 패턴 매치가 우선함",
    "Session metadata": "세션 메타데이터",
    "Event types": "이벤트 유형",
    "Workflow intelligence": "워크플로 인텔리전스",
    "11 datasets: stats, orchestration (DAG), toolFlow, effectiveness, patterns, modelDelegation, errorPropagation, concurrency, complexity, compaction, cooccurrence":
      "11개 데이터셋: stats, orchestration(DAG), toolFlow, effectiveness, patterns, modelDelegation, errorPropagation, concurrency, complexity, compaction, cooccurrence",
    "Agent hierarchy": "에이전트 계층 구조",
    "Recursive parent/child tree with subagent_type, depth tracking via recursive CTE":
      "재귀 CTE를 통해 subagent_type과 깊이를 추적하는 재귀적 부모/자식 트리",
    '📖 Full documentation: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/docs/PLUGINS.md"><code>docs/plugins.md</code></a>':
      '📖 전체 문서: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/docs/PLUGINS.md"><code>docs/plugins.md</code></a>',
    '<span class="caption-icon">🖥️</span> Statusline — always-visible bar showing context window usage, token counts, active model, git branch, and session ID. Configurable segments with theme support':
      '<span class="caption-icon">🖥️</span> Statusline — 컨텍스트 윈도우 사용량, 토큰 수, 활성 모델, git 브랜치, 세션 ID를 표시하는 항상 표시되는 바. 테마를 지원하는 구성 가능한 세그먼트',
    "The <code>statusline/</code> directory contains a standalone CLI statusline for Claude Code — completely independent of the web dashboard. It renders a color-coded bar at the bottom of the Claude Code terminal showing context window usage, per-direction token counts, session cost in USD, and git branch.":
      "<code>statusline/</code> 디렉터리에는 Claude Code용 독립형 CLI statusline이 들어 있으며 — 웹 대시보드와는 완전히 별개입니다. 이는 컨텍스트 윈도우 사용량, 방향별 토큰 수, USD 기준 세션 비용, git 브랜치를 보여주는 색상 코드 바를 Claude Code 터미널 하단에 렌더링합니다.",
    Segment: "세그먼트",
    Source: "소스",
    "Color Logic": "색상 로직",
    "Always cyan": "항상 청록색(cyan)",
    "Always green": "항상 초록색",
    "Always yellow, <code>~</code> prefix for home":
      "항상 노란색, 홈 디렉터리는 <code>~</code> 접두사",
    "Always magenta, hidden outside git repos": "항상 마젠타색, git 저장소 밖에서는 숨김",
    "Green &lt; 50%, Yellow 50–79%, Red ≥ 80%": "초록 &lt; 50%, 노랑 50–79%, 빨강 ≥ 80%",
    "Green <code>↑</code> input, cyan <code>↓</code> output, dim <code>c</code> cache reads":
      "초록 <code>↑</code> 입력, 청록 <code>↓</code> 출력, 어두운 <code>c</code> 캐시 읽기",
    "Green &lt; $5, Yellow $5–$20, Red ≥ $20 (shown on API and subscription plans)":
      "초록 &lt; $5, 노랑 $5–$20, 빨강 ≥ $20 (API 및 구독 플랜에 표시)",
    "Add this to <code>~/.claude/settings.json</code>:":
      "다음을 <code>~/.claude/settings.json</code>에 추가하십시오.",
    "No dependencies required": "필요한 의존성 없음",
    "The statusline uses only Python 3.6+ stdlib (<code>sys</code>, <code>json</code>, <code>os</code>, <code>subprocess</code>). It fails silently on empty input or JSON errors and never blocks Claude Code.":
      "이 statusline은 Python 3.6+ 표준 라이브러리(<code>sys</code>, <code>json</code>, <code>os</code>, <code>subprocess</code>)만 사용합니다. 입력이 비어 있거나 JSON 오류가 발생해도 조용히 실패하며 Claude Code를 절대 차단하지 않습니다.",
    '<span class="caption-icon">🔌</span> Sidebar — live health, analytics, and deep navigation links':
      '<span class="caption-icon">🔌</span> 사이드바 — 실시간 상태, 분석, 심층 탐색 링크',
    "The <b>Claude Code Agent Monitor</b> is a premium, high-fidelity extension designed to minimize context switching for AI engineers. It brings the full power of the dashboard directly into VS Code, allowing you to monitor complex subagent orchestration without ever leaving your active code file.":
      "<b>Claude Code Agent Monitor</b>는 AI 엔지니어의 컨텍스트 전환을 최소화하도록 설계된 프리미엄 고정밀 확장 프로그램입니다. 대시보드의 모든 기능을 VS Code로 직접 가져와, 현재 작업 중인 코드 파일을 벗어나지 않고도 복잡한 서브에이전트 오케스트레이션을 모니터링할 수 있게 해줍니다.",
    "A dedicated Activity Bar view that performs background polling every 5 seconds. Includes a real-time <b>Agent Health</b> monitor tracking all 5 states (Working, Connected, Idle, Completed, Error) with native VS Code theme-aware icons and colors.":
      "5초마다 백그라운드 폴링을 수행하는 전용 Activity Bar 뷰입니다. VS Code 네이티브 테마를 인식하는 아이콘과 색상으로 5가지 상태(Working, Connected, Idle, Completed, Error)를 모두 추적하는 실시간 <b>Agent Health</b> 모니터를 포함합니다.",
    "Aggregates data from multiple API endpoints to display high-signal metrics directly in the sidebar: <ul style=\"margin-top: 8px; color: var(--text-muted); font-size: 13px; list-style-type: '→ '; padding-left: 15px;\"> <li><b>Token Consumption</b>: Scaled tracking from 1k to 1.0B+ tokens.</li> <li><b>Live Cost Estimates</b>: Automatic USD cost calculation based on model pricing rules.</li> <li><b>Event Frequency</b>: Total events, daily sessions, and subagent spawning rates.</li> </ul>":
      "여러 API 엔드포인트의 데이터를 취합하여 신호값이 높은 지표를 사이드바에 직접 표시합니다: <ul style=\"margin-top: 8px; color: var(--text-muted); font-size: 13px; list-style-type: '→ '; padding-left: 15px;\"> <li><b>토큰 소비량</b>: 1천 개부터 10억 개 이상의 토큰까지 확장 추적.</li> <li><b>실시간 비용 추정</b>: 모델 가격 규칙에 기반한 자동 USD 비용 계산.</li> <li><b>이벤트 빈도</b>: 총 이벤트 수, 일별 세션 수, 서브에이전트 생성 비율.</li> </ul>",
    "<b>Token Consumption</b>: Scaled tracking from 1k to 1.0B+ tokens.":
      "<b>토큰 소비량</b>: 1천 개부터 10억 개 이상의 토큰까지 확장 추적.",
    "<b>Live Cost Estimates</b>: Automatic USD cost calculation based on model pricing rules.":
      "<b>실시간 비용 추정</b>: 모델 가격 규칙을 기반으로 한 자동 USD 비용 계산입니다.",
    "<b>Event Frequency</b>: Total events, daily sessions, and subagent spawning rates.":
      "<b>이벤트 빈도</b>: 총 이벤트 수, 일별 세션 수, 서브에이전트 생성 비율입니다.",
    "Renders the full React application within a native webview tab. Supports <b>Deep Linking</b>: one-click jump from the sidebar directly to specific views like the <i>Kanban Board</i>, <i>Analytics Hub</i>, or your <i>Last 10 Sessions</i>.":
      "전체 React 애플리케이션을 네이티브 웹뷰 탭 안에 렌더링합니다. <b>딥 링크</b>를 지원하여 사이드바에서 <i>Kanban Board</i>, <i>Analytics Hub</i>, <i>Last 10 Sessions</i>와 같은 특정 화면으로 한 번의 클릭으로 바로 이동할 수 있습니다.",
    "Seamlessly scans ports <code>5173</code> (Vite Dev) and <code>4820</code> (Production) on localhost. Automatically toggles between <b>Online</b> and <b>Offline</b> modes in the sidebar as you start or stop your local server.":
      "localhost의 <code>5173</code>(Vite Dev) 포트와 <code>4820</code>(Production) 포트를 매끄럽게 스캔합니다. 로컬 서버를 시작하거나 중지하면 사이드바에서 <b>Online</b> 모드와 <b>Offline</b> 모드가 자동으로 전환됩니다.",
    "<strong>Zero-Config Setup</strong>": "<strong>제로 설정 구성</strong>",
    "The extension is designed to be plug-and-play. Once your server is running, the extension automatically discovers the API and begins streaming telemetry — no manual URL configuration required.":
      "이 확장 프로그램은 플러그 앤 플레이 방식으로 설계되었습니다. 서버가 실행되면 확장 프로그램이 API를 자동으로 감지하고 텔레메트리 스트리밍을 시작하므로, URL을 수동으로 설정할 필요가 없습니다.",
    '📖 Full developer guide: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/vscode-extension/README.md"><code>vscode-extension/README.md</code></a>':
      '📖 전체 개발자 가이드: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/vscode-extension/README.md"><code>vscode-extension/README.md</code></a>',
    "The dashboard ships as an optional <strong>native desktop application</strong> — a <code>desktop/</code> workspace that wraps the existing server and client into a macOS <code>.app</code> (distributed as a <code>.dmg</code>) and a Windows <code>.exe</code> (an NSIS installer plus a no-install portable build) you install once and forget. <code>desktop/</code> is a sibling workspace to <code>client/</code>, <code>server/</code>, <code>mcp/</code>, and <code>vscode-extension/</code>, built with <strong>Electron 35</strong>. It <strong>embeds the Express server in-process</strong> — it <code>require()</code>s <code>server/index.js</code> directly in the same Node runtime as the Electron main process (no child process, no IPC) — and renders the already-built React client in a <code>BrowserWindow</code>. Everything you see in the browser at <code>localhost:4820</code> lives inside this window, with native OS lifecycle on top.":
      "대시보드는 선택적 <strong>네이티브 데스크톱 애플리케이션</strong>으로도 제공됩니다 — 기존 서버와 클라이언트를 macOS <code>.app</code>(<code>.dmg</code>로 배포)과 Windows <code>.exe</code>(NSIS 설치 프로그램과 설치가 필요 없는 포터블 빌드)로 감싸는 <code>desktop/</code> 워크스페이스이며, 한 번 설치하면 신경 쓸 필요가 없습니다. <code>desktop/</code>은 <code>client/</code>, <code>server/</code>, <code>mcp/</code>, <code>vscode-extension/</code>과 나란히 위치한 워크스페이스이며, <strong>Electron 35</strong>로 빌드되었습니다. 이 앱은 <strong>Express 서버를 프로세스 내부에 내장</strong>합니다 — Electron 메인 프로세스와 동일한 Node 런타임에서 <code>server/index.js</code>를 직접 <code>require()</code>하며(자식 프로세스도, IPC도 없음), 이미 빌드된 React 클라이언트를 <code>BrowserWindow</code>에 렌더링합니다. 브라우저의 <code>localhost:4820</code>에서 보이는 모든 것이 이 창 안에 그대로 존재하며, 그 위에 네이티브 OS 라이프사이클이 얹혀 있습니다.",
    '<span class="caption-icon">🍎🪟</span> <span>The full dashboard, natively on macOS <strong>and</strong> Windows — same React client, same Express server, real <code>BrowserWindow</code>. Menu-bar / notification-area (tray) icon included. Shipped as a macOS DMG and a Windows EXE (macOS shown) — see <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a>.</span>':
      '<span class="caption-icon">🍎🪟</span> <span>macOS<strong>와</strong> Windows 양쪽에서 네이티브로 동작하는 전체 대시보드입니다 — 동일한 React 클라이언트, 동일한 Express 서버, 실제 <code>BrowserWindow</code>를 사용합니다. 메뉴 바 / 알림 영역(트레이) 아이콘이 포함되어 있습니다. macOS DMG와 Windows EXE로 제공됩니다(화면은 macOS 기준) — <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a>를 참고하세요.</span>',
    '<span class="caption-icon">🪟</span> <span>The same dashboard as a native <strong>Windows</strong> app — real <code>BrowserWindow</code> with the native Windows window menu, live Activity Feed, and the Tabby companion. A notification-area (system tray) icon sits beside the clock for quick access.</span>':
      '<span class="caption-icon">🪟</span> <span>동일한 대시보드를 네이티브 <strong>Windows</strong> 앱으로 구현한 모습입니다 — 네이티브 Windows 창 메뉴, 실시간 Activity Feed, Tabby 컴패니언을 갖춘 실제 <code>BrowserWindow</code>를 사용합니다. 시계 옆의 알림 영역(시스템 트레이) 아이콘으로 빠르게 접근할 수 있습니다.</span>',
    "<strong>One-line mental model</strong>": "<strong>한 줄로 요약한 개념 모델</strong>",
    "<em>Electron is a window onto the same code.</em> The desktop app does not reimplement the dashboard — it hosts the exact server and client the standalone deployment runs. The only change outside <code>desktop/</code> is a behavior-preserving refactor of <code>server/index.js</code>: its post-listen bootstrap was extracted into an exported <code>startBackgroundServices()</code> so the embedded server runs exactly what <code>node server/index.js</code> runs.":
      "<em>Electron은 동일한 코드를 비추는 창일 뿐입니다.</em> 데스크톱 앱은 대시보드를 다시 구현하지 않고, 독립 실행형 배포와 완전히 동일한 서버와 클라이언트를 그대로 호스팅합니다. <code>desktop/</code> 외부에서 이루어진 유일한 변경은 <code>server/index.js</code>에 대한 동작 보존 리팩터링뿐입니다 — listen 이후의 부트스트랩 로직을 <code>startBackgroundServices()</code>라는 이름으로 export하여, 내장 서버가 <code>node server/index.js</code>를 실행했을 때와 정확히 동일하게 동작하도록 했습니다.",
    "The Electron main process hosts the embedded server <em>and</em> manages the window, tray, and menus. The renderer is just Chromium loading <code>http://127.0.0.1:&lt;port&gt;</code> — the same origin a normal browser would use.":
      "Electron 메인 프로세스는 내장 서버를 호스팅하는 <em>동시에</em> 창, 트레이, 메뉴를 관리합니다. 렌더러는 <code>http://127.0.0.1:&lt;port&gt;</code>를 로드하는 단순한 Chromium일 뿐이며, 이는 일반 브라우저가 사용하는 것과 동일한 origin입니다.",
    "The desktop app embeds the Express server in-process — no child process, no IPC":
      "데스크톱 앱은 Express 서버를 프로세스 내부에 내장합니다 — 자식 프로세스도, IPC도 없습니다",
    "An always-on tray icon — the macOS menu bar (a tinted template glyph) or the Windows notification area (the colored <code>icon.ico</code>). A single click (left or right) opens a dropdown with a <strong>live status snapshot</strong> queried straight from SQLite at click time — server port, active sessions, working agents, events today — followed by <strong>Open Dashboard</strong>, <strong>Open in Browser</strong>, <strong>Restart Server</strong>, <strong>Show Logs</strong>, <strong>Open at Login</strong> (toggle), and <strong>Quit</strong>. The snapshot rows are clickable — they open the dashboard. The menu is rebuilt on each open so every value is current.":
      "항상 표시되는 트레이 아이콘입니다 — macOS 메뉴 바(색조가 적용된 템플릿 글리프)이거나 Windows 알림 영역(컬러 <code>icon.ico</code>)입니다. 한 번의 클릭(좌클릭 또는 우클릭)으로 드롭다운이 열리며, 클릭 시점에 SQLite에서 직접 조회한 <strong>실시간 상태 스냅샷</strong> — 서버 포트, 활성 세션, 작업 중인 에이전트, 오늘의 이벤트 수 — 이 표시되고, 이어서 <strong>Open Dashboard</strong>, <strong>Open in Browser</strong>, <strong>Restart Server</strong>, <strong>Show Logs</strong>, <strong>Open at Login</strong>(토글), <strong>Quit</strong>이 나타납니다. 스냅샷 항목은 클릭 가능하며 클릭하면 대시보드가 열립니다. 메뉴는 열 때마다 다시 생성되므로 모든 값이 항상 최신 상태입니다.",
    "A standard native application menu — <code>About</code>, <code>Open at Login</code>, <code>File</code>, <code>Edit</code>, <code>View</code>, <code>Window</code>, <code>Help</code> — with <code>⌘R</code> / <code>Ctrl+R</code> wired to <em>View ▸ reload</em>. External links open in the system browser, never inside Electron. The <code>File ▸ Open Dashboard</code> item (<code>⌘1</code>) is macOS-only; on Windows/Linux the window-attached menu can't reopen a hidden window, so reopen from the tray's <strong>Open Dashboard</strong>.":
      "표준 네이티브 애플리케이션 메뉴입니다 — <code>About</code>, <code>Open at Login</code>, <code>File</code>, <code>Edit</code>, <code>View</code>, <code>Window</code>, <code>Help</code>로 구성되며, <code>⌘R</code> / <code>Ctrl+R</code>은 <em>View ▸ reload</em>에 연결되어 있습니다. 외부 링크는 항상 시스템 브라우저에서 열리며, Electron 내부에서는 열리지 않습니다. <code>File ▸ Open Dashboard</code> 항목(<code>⌘1</code>)은 macOS 전용입니다. Windows/Linux에서는 창에 연결된 메뉴로 숨겨진 창을 다시 열 수 없으므로, 트레이의 <strong>Open Dashboard</strong>를 통해 다시 열어야 합니다.",
    "Flip <em>Open at Login</em> in the tray or app menu — both platforms go through Electron's first-party <code>app.*LoginItemSettings</code> API. On macOS it registers via the modern <code>SMAppService</code> API and appears under <strong>System Settings → General → Login Items</strong>; on Windows it writes a per-user <code>HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run</code> entry, visible in <strong>Task Manager → Startup</strong>. When the app is launched at login it starts tray-only, with no window jumping into view (on Windows the login launch is detected via a <code>--ccam-hidden</code> argument).":
      "트레이나 앱 메뉴에서 <em>Open at Login</em>을 전환하면 됩니다 — 두 플랫폼 모두 Electron의 자체 <code>app.*LoginItemSettings</code> API를 사용합니다. macOS에서는 최신 <code>SMAppService</code> API를 통해 등록되며 <strong>시스템 설정 → 일반 → 로그인 항목</strong>에 표시됩니다. Windows에서는 사용자별 <code>HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run</code> 항목을 기록하며, <strong>작업 관리자 → 시작 프로그램</strong>에서 확인할 수 있습니다. 로그인 시 앱이 실행되면 트레이 전용으로만 시작되고 창이 갑자기 나타나지 않습니다(Windows에서는 <code>--ccam-hidden</code> 인자를 통해 로그인 실행 여부를 감지합니다).",
    'Closing the window hides it — the embedded server keeps running, the tray icon stays, and the dock / taskbar icon stays too (a clickable "still alive" indicator). <strong>Quit</strong> (<code>⌘Q</code> / <code>Ctrl+Q</code>, app menu, or tray → Quit) pops a confirmation modal — press the Quit button or hit <code>⌘Q</code> / <code>Ctrl+Q</code> a second time to skip the prompt — and only then does the embedded server shut down, closing SQLite cleanly with a WAL checkpoint and removing this PID\'s entry from the discovery file.':
      '창을 닫아도 창이 숨겨질 뿐입니다 — 내장 서버는 계속 실행되고, 트레이 아이콘도 남아 있으며, 독 / 작업 표시줄 아이콘도 그대로 유지됩니다(클릭 가능한 "여전히 살아있음" 표시입니다). <strong>Quit</strong>(<code>⌘Q</code> / <code>Ctrl+Q</code>, 앱 메뉴, 또는 트레이 → Quit)을 실행하면 확인 모달이 나타나며 — Quit 버튼을 누르거나 <code>⌘Q</code> / <code>Ctrl+Q</code>를 한 번 더 눌러 확인창을 건너뛸 수 있습니다 — 이 확인이 이루어진 후에야 내장 서버가 종료되며, WAL 체크포인트로 SQLite를 안전하게 닫고 discovery 파일에서 해당 PID 항목을 제거합니다.',
    "Launch the desktop app and <code>npm run dev</code> at the same time and both stay real-time. Each server appends its <code>{port, pid, startedAt}</code> entry to <code>~/.claude/.agent-dashboard.json</code> on startup; the Claude Code hook handler reads that list and fan-outs every event to every live entry in parallel. Stale entries self-evict via a PID liveness check on read, so a crashed server can't misroute events to a dead port.":
      "데스크톱 앱과 <code>npm run dev</code>를 동시에 실행해도 둘 다 실시간으로 동작합니다. 각 서버는 시작 시 자신의 <code>{port, pid, startedAt}</code> 항목을 <code>~/.claude/.agent-dashboard.json</code>에 추가하며, Claude Code 훅 핸들러는 이 목록을 읽어 모든 이벤트를 살아있는 모든 항목에 병렬로 팬아웃합니다. 오래된 항목은 읽을 때 수행되는 PID 생존 확인을 통해 스스로 제거되므로, 크래시된 서버가 죽은 포트로 이벤트를 잘못 라우팅하는 일이 없습니다.",
    "Double-launching the app just focuses the existing window — no second server, no port collision, on every platform. The lock is acquired via <code>requestSingleInstanceLock()</code> before any server boots.":
      "앱을 두 번 실행해도 기존 창에 포커스만 맞춰질 뿐입니다 — 모든 플랫폼에서 두 번째 서버가 뜨지 않으며 포트 충돌도 발생하지 않습니다. 이 잠금은 어떤 서버도 부팅되기 전에 <code>requestSingleInstanceLock()</code>을 통해 획득됩니다.",
    "On its first owned-server boot the app auto-installs the Claude Code hooks into <code>~/.claude/settings.json</code> and starts the background services (update scheduler, config watcher, orphaned-run reconciliation) — so an install-only user (DMG or EXE) gets events flowing without ever running <code>npm run install-hooks</code> from a checkout.":
      "앱이 소유한 서버가 처음 부팅될 때, Claude Code 훅을 <code>~/.claude/settings.json</code>에 자동으로 설치하고 백그라운드 서비스(업데이트 스케줄러, 설정 워처, 고아 실행 정합화)를 시작합니다 — 그 결과 설치만 한 사용자(DMG 또는 EXE)도 체크아웃에서 <code>npm run install-hooks</code>를 실행하지 않고도 이벤트가 흐르기 시작합니다.",
    "Two packaging realities — a read-only application bundle / install directory and (on macOS) the minimal <code>PATH</code> a Finder-launched app inherits — are handled automatically so installs survive updates and the <strong>Run Claude</strong> feature works out of the box on both macOS and Windows.":
      "패키징에서 발생하는 두 가지 현실적인 문제 — 읽기 전용 애플리케이션 번들 / 설치 디렉터리, 그리고 (macOS의 경우) Finder로 실행한 앱이 상속받는 최소한의 <code>PATH</code> — 는 자동으로 처리되므로, 업데이트를 거쳐도 설치가 유지되고 <strong>Run Claude</strong> 기능이 macOS와 Windows 모두에서 별도 설정 없이 바로 동작합니다.",
    "<strong>Your data survives reinstalls and updates</strong>":
      "<strong>재설치와 업데이트에도 데이터가 유지됩니다</strong>",
    "The SQLite database and VAPID keys live in a per-user app-data directory <em>outside</em> the application bundle / install dir — <code>~/Library/Application Support/Claude Code Monitor/data/</code> on macOS, <code>%APPDATA%\\Claude Code Monitor\\data\\</code> on Windows. <code>server-host.ts</code> points <code>DASHBOARD_DATA_DIR</code> at that per-user directory on boot. Because a packaged, code-signed, or app-translocated bundle is read-only, older builds that stored the database inside the bundle broke History Import; with the data directory now in app-data, your imported history and events persist across app reinstalls and updates (the Windows NSIS uninstaller keeps this data by default). After upgrading from a pre-fix build, re-run <strong>Import History → Rescan</strong> once to bridge the one-time gap.":
      "SQLite 데이터베이스와 VAPID 키는 애플리케이션 번들 / 설치 디렉터리 <em>바깥</em>의 사용자별 앱 데이터 디렉터리에 저장됩니다 — macOS에서는 <code>~/Library/Application Support/Claude Code Monitor/data/</code>, Windows에서는 <code>%APPDATA%\\Claude Code Monitor\\data\\</code>입니다. <code>server-host.ts</code>는 부팅 시 <code>DASHBOARD_DATA_DIR</code>을 이 사용자별 디렉터리로 지정합니다. 패키징되거나 코드 서명되거나 앱 트랜스로케이션된 번들은 읽기 전용이기 때문에, 데이터베이스를 번들 내부에 저장했던 이전 빌드에서는 History Import가 제대로 동작하지 않았습니다. 이제 데이터 디렉터리가 앱 데이터 영역에 있으므로, 가져온 히스토리와 이벤트는 앱을 재설치하거나 업데이트해도 유지됩니다(Windows NSIS 제거 프로그램은 기본적으로 이 데이터를 보존합니다). 수정 이전 빌드에서 업그레이드한 경우, 한 번의 격차를 메우기 위해 <strong>Import History → Rescan</strong>을 한 번 다시 실행하세요.",
    "<strong>The <code>claude</code> CLI is found automatically</strong>":
      "<strong><code>claude</code> CLI가 자동으로 탐지됩니다</strong>",
    "A Finder- or Dock-launched macOS app inherits only launchd's minimal <code>PATH</code>, not your login shell's. At startup <code>shell-path.ts</code> recovers the user's login-shell <code>PATH</code> so the <strong>Run Claude</strong> feature can locate and spawn the <code>claude</code> CLI. (On Windows the process already inherits the user <code>PATH</code>, so no recovery step is needed.) If it still cannot be found, make sure <code>claude</code> is a real executable on your <code>PATH</code> — a shell alias or function cannot be spawned — and check the <code>user PATH resolved</code> line in the desktop log (<code>~/Library/Logs/Claude Code Monitor/desktop.log</code> on macOS, <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> on Windows).":
      "Finder나 Dock에서 실행한 macOS 앱은 로그인 셸의 <code>PATH</code>가 아니라 launchd의 최소한의 <code>PATH</code>만 상속받습니다. 시작 시 <code>shell-path.ts</code>가 사용자 로그인 셸의 <code>PATH</code>를 복원하여 <strong>Run Claude</strong> 기능이 <code>claude</code> CLI를 찾아 실행할 수 있도록 합니다. (Windows에서는 프로세스가 이미 사용자 <code>PATH</code>를 상속받으므로 별도의 복원 단계가 필요하지 않습니다.) 그래도 찾을 수 없다면, <code>claude</code>가 <code>PATH</code>상의 실제 실행 파일인지 확인하세요 — 셸 별칭(alias)이나 함수는 실행할 수 없습니다 — 그리고 데스크톱 로그(macOS의 <code>~/Library/Logs/Claude Code Monitor/desktop.log</code>, Windows의 <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code>)에서 <code>user PATH resolved</code> 줄을 확인하세요.",
    "On launch the Electron main process picks a free port. If a healthy dashboard server already answers <code>/api/health</code> on port <code>4820</code> (for example, you ran <code>npm start</code> in a terminal), the app <strong>adopts</strong> that server instead of starting a second one — no double-binding, no SQLite contention. An adopted server is not owned by the app, so quitting leaves it running.":
      "실행 시 Electron 메인 프로세스는 사용 가능한 포트를 선택합니다. 만약 정상적으로 동작하는 대시보드 서버가 이미 <code>4820</code> 포트에서 <code>/api/health</code>에 응답하고 있다면(예: 터미널에서 <code>npm start</code>를 실행한 경우), 앱은 두 번째 서버를 시작하는 대신 해당 서버를 <strong>채택(adopt)</strong>합니다 — 이중 바인딩도, SQLite 경합도 발생하지 않습니다. 채택된 서버는 앱이 소유한 것이 아니므로, 앱을 종료해도 계속 실행됩니다.",
    Step: "단계",
    "Port choice": "포트 선택",
    Adopt: "채택",
    "A healthy server already on <code>4820</code> is adopted as-is":
      "이미 <code>4820</code>에서 정상적으로 동작 중인 서버를 그대로 채택합니다",
    Preferred: "우선",
    "<code>4820</code> when free": "비어 있으면 <code>4820</code>",
    Fallback: "대체",
    "The first free port in <code>4821</code>–<code>4829</code>":
      "<code>4821</code>–<code>4829</code> 범위에서 처음으로 비어 있는 포트",
    "Last resort": "최후의 수단",
    "A random high port when all of the above are taken":
      "위 항목이 모두 사용 중일 때 임의의 높은 포트",
    "Three ways to obtain the desktop app — the latest GitHub Release (best for most users), a per-commit CI artifact (fresher than the latest release), or a local build.":
      "데스크톱 앱을 구하는 방법은 세 가지입니다 — 최신 GitHub Release(대부분의 사용자에게 최선), 커밋 단위 CI 아티팩트(최신 릴리스보다 더 신선함), 또는 로컬 빌드입니다.",
    'Open <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Releases → latest </a> and download the asset for your platform. The macOS and Windows Desktop CI jobs auto-publish a new <code>vX.Y.Z</code> release every time the version in <code>package.json</code> is bumped on <code>master</code>, so this link always points at the current build. Releases are public — no GitHub sign-in required.':
      '<a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 릴리스 → 최신 </a>을 열어 사용 중인 플랫폼에 맞는 애셋을 다운로드하세요. macOS와 Windows Desktop CI 작업은 <code>package.json</code>의 버전이 <code>master</code>에서 올라갈 때마다 새로운 <code>vX.Y.Z</code> 릴리스를 자동으로 게시하므로, 이 링크는 항상 현재 빌드를 가리킵니다. 릴리스는 공개되어 있으며 GitHub 로그인이 필요하지 않습니다.',
    Platform: "플랫폼",
    Asset: "애셋",
    "macOS (Apple Silicon)": "macOS (Apple Silicon)",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-arm64.dmg</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-arm64.dmg</code>",
    "Drag the <code>.app</code> into <code>/Applications</code>":
      "<code>.app</code>을 <code>/Applications</code>로 드래그하세요",
    "macOS (Intel)": "macOS (Intel)",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64.dmg</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64.dmg</code>",
    "Windows (installer)": "Windows (설치 프로그램)",
    "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>":
      "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>",
    "NSIS installer — per-user, no admin elevation":
      "NSIS 설치 프로그램 — 사용자별 설치, 관리자 권한 상승 불필요",
    "Windows (portable)": "Windows (포터블)",
    "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>":
      "<code>ClaudeCodeMonitor-&lt;ver&gt;-x64-portable.exe</code>",
    "Run without installing": "설치 없이 실행",
    'Want a build straight off the tip of <code>master</code>, ahead of the next tagged release? Every green run of the <code>🍎 macOS Desktop (DMG)</code> job on <code>macos-latest</code> uploads the universal DMG as the <code>ClaudeCodeMonitor-dmg</code> workflow artifact, and the <code>🪟 Windows Desktop (EXE)</code> job on <code>windows-latest</code> uploads the installer + portable EXEs as the <code>ClaudeCodeMonitor-win</code> artifact. Open the <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> latest passing run </a>, scroll to its Artifacts section, and download <code>ClaudeCodeMonitor-dmg</code> or <code>ClaudeCodeMonitor-win</code>. (GitHub sign-in required; 14-day retention.)':
      '다음 태그된 릴리스보다 앞선, <code>master</code> 최신 커밋을 그대로 반영한 빌드를 원하시나요? <code>macos-latest</code>에서 실행되는 <code>🍎 macOS Desktop (DMG)</code> 작업이 성공할 때마다 유니버설 DMG를 <code>ClaudeCodeMonitor-dmg</code> 워크플로 아티팩트로 업로드하며, <code>windows-latest</code>에서 실행되는 <code>🪟 Windows Desktop (EXE)</code> 작업은 설치 프로그램과 포터블 EXE를 <code>ClaudeCodeMonitor-win</code> 아티팩트로 업로드합니다. <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg> 최신 성공 실행 </a>을 열어 Artifacts 섹션까지 스크롤한 다음 <code>ClaudeCodeMonitor-dmg</code> 또는 <code>ClaudeCodeMonitor-win</code>을 다운로드하세요. (GitHub 로그인 필요, 14일간 보관됩니다.)',
    "From the project root, after <code>git clone</code>:":
      "프로젝트 루트에서 <code>git clone</code> 이후:",
    "Use the arch-specific build on your own machine":
      "본인 컴퓨터에서는 아키텍처별 빌드를 사용하세요",
    "The universal <code>desktop:dmg</code> build is intentionally slow: it builds the full app tree <em>twice</em> (once per architecture), merges both with <code>@electron/universal</code>, and ad-hoc-signs every binary in the merged bundle. For running on a single Mac, use <code>desktop:dmg:arm64</code> (Apple Silicon) or <code>desktop:dmg:x64</code> (Intel) — one architecture, no merge, finishing in roughly a minute instead of many. Reserve the universal build for release artifacts; CI already produces one as <code>ClaudeCodeMonitor-dmg</code>, so you rarely need to build it yourself.":
      "유니버설 <code>desktop:dmg</code> 빌드는 의도적으로 느립니다. 전체 앱 트리를 <em>두 번</em>(아키텍처별로 한 번씩) 빌드한 다음 <code>@electron/universal</code>로 병합하고, 병합된 번들 안의 모든 바이너리에 애드혹 서명을 수행하기 때문입니다. 단일 Mac에서 실행하려면 <code>desktop:dmg:arm64</code>(Apple Silicon) 또는 <code>desktop:dmg:x64</code>(Intel)를 사용하세요 — 아키텍처가 하나뿐이고 병합도 없으므로 수 분이 아니라 약 1분 만에 끝납니다. 유니버설 빌드는 릴리스 아티팩트용으로 남겨 두세요. CI가 이미 <code>ClaudeCodeMonitor-dmg</code>로 하나를 생성해 주므로, 직접 빌드해야 하는 경우는 거의 없습니다.",
    "Double-click the downloaded <code>.dmg</code> to mount it":
      "다운로드한 <code>.dmg</code>를 더블클릭하여 마운트하세요",
    "Drag <code>Claude Code Monitor.app</code> into your <code>Applications</code> folder":
      "<code>Claude Code Monitor.app</code>을 <code>Applications</code> 폴더로 드래그하세요",
    "Run <code>xattr -cr</code> on the app to get past Gatekeeper (see below)":
      "Gatekeeper를 통과하려면 앱에 <code>xattr -cr</code>을 실행하세요(아래 참고)",
    "Open the app — the tray icon appears and the dashboard window loads":
      "앱을 여세요 — 트레이 아이콘이 나타나고 대시보드 창이 로드됩니다",
    "Gatekeeper warning on first launch": "최초 실행 시 Gatekeeper 경고",
    'The DMG is ad-hoc signed by default — that is all the project can offer without a paid Apple Developer ID. macOS warns the first time you open it (<em>"Apple could not verify…"</em>). Strip the quarantine attribute to get past it:':
      'DMG는 기본적으로 애드혹 서명되어 있습니다 — 유료 Apple Developer ID 없이 프로젝트가 제공할 수 있는 것은 여기까지입니다. macOS는 처음 열 때 경고를 표시합니다(<em>"Apple에서 확인할 수 없습니다…"</em>). 이를 통과하려면 격리(quarantine) 속성을 제거하세요:',
    "Alternatively, open <strong>System Settings → Privacy &amp; Security</strong>, find the blocked app, and click <em>Open Anyway</em>. Code signing and Apple notarization are opt-in for the maintainer — when configured, this warning goes away for everyone.":
      "또는 <strong>시스템 설정 → 개인정보 보호 및 보안</strong>을 열어 차단된 앱을 찾은 다음 <em>확인 없이 열기</em>를 클릭하세요. 코드 서명과 Apple 공증은 유지관리자가 선택적으로 설정하는 항목입니다 — 설정이 완료되면 모든 사용자에게서 이 경고가 사라집니다.",
    "Run <code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code> — a per-user NSIS install (no admin), or run the <code>*-portable.exe</code> to skip installing":
      "<code>ClaudeCodeMonitor-Setup-&lt;ver&gt;-x64.exe</code>를 실행하세요 — 사용자별 NSIS 설치(관리자 권한 불필요)이며, 설치를 건너뛰려면 <code>*-portable.exe</code>를 실행하세요",
    "The EXE is unsigned by default, so SmartScreen may warn — click <em>More info → Run anyway</em>":
      "EXE는 기본적으로 서명되지 않았으므로 SmartScreen이 경고를 표시할 수 있습니다 — <em>추가 정보 → 실행</em>을 클릭하세요",
    "Open from the Start menu / desktop shortcut — the notification-area (tray) icon appears and the dashboard window loads":
      "시작 메뉴 / 바탕화면 바로 가기에서 여세요 — 알림 영역(트레이) 아이콘이 나타나고 대시보드 창이 로드됩니다",
    '<span class="caption-icon">1️⃣</span> <span>NSIS installer, step 1 — <strong>Choose Installation Options</strong>: pick per-user setup and optional shortcuts.</span>':
      '<span class="caption-icon">1️⃣</span> <span>NSIS 설치 프로그램, 1단계 — <strong>설치 옵션 선택</strong>: 사용자별 설치와 선택적 바로 가기를 지정합니다.</span>',
    '<span class="caption-icon">2️⃣</span> <span>NSIS installer, step 2 — <strong>Choose Install Location</strong>: defaults to <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code>, or point it anywhere.</span>':
      '<span class="caption-icon">2️⃣</span> <span>NSIS 설치 프로그램, 2단계 — <strong>설치 위치 선택</strong>: 기본값은 <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code>이며, 원하는 위치로 변경할 수도 있습니다.</span>',
    '<span class="caption-icon">3️⃣</span> <span>NSIS installer, step 3 — <strong>Completing Setup</strong>: click <em>Finish</em> to launch the app and drop the tray icon in the notification area.</span>':
      '<span class="caption-icon">3️⃣</span> <span>NSIS 설치 프로그램, 3단계 — <strong>설치 완료</strong>: <em>마침</em>을 클릭하면 앱이 실행되고 알림 영역에 트레이 아이콘이 표시됩니다.</span>',
    "SmartScreen warning on first launch": "최초 실행 시 SmartScreen 경고",
    'The installer and portable EXE are <strong>unsigned</strong> by default — that is all the project can offer without a paid code-signing certificate. Windows <strong>SmartScreen</strong> may show <em>"Windows protected your PC"</em> the first time you run it; click <strong>More info → Run anyway</strong>. The installer lays the app down <strong>per-user</strong> under <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code> (and lets you choose the install directory) and sets an <code>AppUserModelId</code> (<code>com.hoangsonww.ccam.desktop</code>) so native toast notifications are attributed correctly and the window groups under one taskbar entry.':
      '설치 프로그램과 포터블 EXE는 기본적으로 <strong>서명되지 않았습니다</strong> — 유료 코드 서명 인증서 없이 프로젝트가 제공할 수 있는 것은 여기까지입니다. Windows <strong>SmartScreen</strong>이 처음 실행할 때 <em>"Windows에서 PC를 보호했습니다"</em>라는 메시지를 표시할 수 있습니다. 이때 <strong>추가 정보 → 실행</strong>을 클릭하세요. 설치 프로그램은 앱을 <code>%LOCALAPPDATA%\\Programs\\Claude Code Monitor</code> 아래에 <strong>사용자별</strong>로 배치하며(설치 디렉터리를 직접 선택할 수도 있습니다), <code>AppUserModelId</code>(<code>com.hoangsonww.ccam.desktop</code>)를 설정하여 네이티브 토스트 알림이 올바르게 귀속되고 창이 하나의 작업 표시줄 항목으로 그룹화되도록 합니다.',
    "Bundle size": "번들 크기",
    "The DMG is roughly 80&nbsp;MB, about 250&nbsp;MB installed on disk — the standard Electron tax; the Windows installer is comparable. The app runs natively on <strong>macOS and Windows</strong>; Linux is tracked as a follow-up. Logs live at <code>~/Library/Logs/Claude Code Monitor/desktop.log</code> on macOS or <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code> on Windows (reach them from the tray menu → <em>Show Logs</em>).":
      "DMG 크기는 약 80&nbsp;MB이며, 디스크에 설치되면 약 250&nbsp;MB가 됩니다 — Electron을 사용할 때 흔히 발생하는 용량 부담이며, Windows 설치 프로그램도 비슷한 수준입니다. 앱은 <strong>macOS와 Windows</strong>에서 네이티브로 실행되며, Linux 지원은 후속 작업으로 추적 중입니다. 로그는 macOS의 경우 <code>~/Library/Logs/Claude Code Monitor/desktop.log</code>, Windows의 경우 <code>%APPDATA%\\Claude Code Monitor\\logs\\desktop.log</code>에 저장됩니다(트레이 메뉴 → <em>Show Logs</em>에서 바로 접근할 수 있습니다).",
    '📖 User-facing guide: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a> · architecture &amp; contributor reference: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/desktop/README.md"><code>desktop/README.md</code></a>':
      '📖 사용자용 가이드: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/DESKTOP.md"><code>DESKTOP.md</code></a> · 아키텍처 및 기여자 참고 자료: <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/blob/master/desktop/README.md"><code>desktop/README.md</code></a>',
    '<span class="caption-icon">⚙️</span> Settings — model pricing editor, hook installation toggle, JSON data export, session cleanup, browser notification preferences, and system info panel with DB stats':
      '<span class="caption-icon">⚙️</span> Settings — 모델 가격 편집기, 훅 설치 토글, JSON 데이터 내보내기, 세션 정리, 브라우저 알림 환경설정, DB 통계가 포함된 시스템 정보 패널',
    "The <code>/settings</code> route provides a comprehensive management interface with six sections:":
      "<code>/settings</code> 경로는 여섯 개의 섹션으로 구성된 종합 관리 인터페이스를 제공합니다.",
    "Editable table of per-model pricing rules. Each Claude model variant has its own explicit pattern (e.g., <code>claude-opus-4-6%</code>). Rates cover input, output, cache read, and cache write tokens. Each rule's editor also has a collapsible <strong>Introductory rates</strong> block — a <code>YYYY-MM-DD</code> promo cutoff plus per-category intro prices (input / output / cache-read / cache-write 5m &amp; 1h); an empty date means no promo, and any future model-launch promo needs no code change. Reset to defaults or add custom models. The section header carries an info popover (the <code>i</code> icon) that explains how rule lookup works (first matching pattern wins), the SQL-style <code>%</code> wildcard syntax with concrete examples (<code>claude-opus-4-7%</code>, <code>claude-%-haiku</code>, exact ids), and reminds the user that prices must be updated manually when Anthropic publishes new rates — already-stored sessions keep the price applied at ingest time. The CLAUDE_HOME panel and Import History flow are fully i18n-driven across en/vi/zh.":
      "모델별 가격 규칙을 편집할 수 있는 표입니다. 각 Claude 모델 변형은 고유한 명시적 패턴을 가집니다(예: <code>claude-opus-4-6%</code>). 요율은 입력, 출력, 캐시 읽기, 캐시 쓰기 토큰을 포함합니다. 각 규칙의 편집기에는 접을 수 있는 <strong>도입 요율(Introductory rates)</strong> 블록도 있습니다 — <code>YYYY-MM-DD</code> 형식의 프로모션 종료일과 카테고리별 도입 가격(입력 / 출력 / 캐시 읽기 / 캐시 쓰기 5분 &amp; 1시간)으로 구성되며, 날짜가 비어 있으면 프로모션이 없다는 뜻이고, 향후 새 모델 출시 프로모션에도 코드 변경이 필요하지 않습니다. 기본값으로 재설정하거나 사용자 지정 모델을 추가할 수 있습니다. 섹션 헤더에는 정보 팝오버(<code>i</code> 아이콘)가 있어 규칙 조회 방식(처음으로 일치하는 패턴이 우선함), SQL 스타일 <code>%</code> 와일드카드 구문과 구체적인 예시(<code>claude-opus-4-7%</code>, <code>claude-%-haiku</code>, 정확한 id), 그리고 Anthropic이 새 요율을 공개하면 가격을 수동으로 업데이트해야 한다는 점(이미 저장된 세션은 수집 시점에 적용된 가격을 그대로 유지함)을 설명합니다. CLAUDE_HOME 패널과 Import History 흐름은 en/vi/zh 전반에 걸쳐 완전히 i18n으로 처리됩니다.",
    "Shows per-hook installation status (SessionStart, PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionEnd). One-click reinstall if hooks are missing or outdated. Validates paths and permissions automatically.":
      "훅별 설치 상태(SessionStart, PreToolUse, PostToolUse, Stop, SubagentStop, Notification, SessionEnd)를 보여줍니다. 훅이 누락되었거나 오래된 경우 클릭 한 번으로 재설치할 수 있습니다. 경로와 권한을 자동으로 검증합니다.",
    "View database row counts and size. Session cleanup: abandon stale active sessions after N hours, purge old completed sessions after N days. Danger zone: clear all data with confirmation dialog to prevent accidental loss.":
      "데이터베이스의 행 수와 크기를 확인할 수 있습니다. 세션 정리: N시간이 지난 오래된 활성 세션을 종료 처리하고, N일이 지난 완료된 세션을 삭제합니다. 위험 구역: 실수로 인한 데이터 손실을 방지하기 위해 확인 대화상자와 함께 모든 데이터를 삭제할 수 있습니다.",
    "Download all sessions, agents, events, token usage, and pricing rules as a single JSON file for backup or analysis. Includes full event history, model metadata, and cost breakdowns in one portable archive.":
      "모든 세션, 에이전트, 이벤트, 토큰 사용량, 가격 규칙을 백업이나 분석을 위해 하나의 JSON 파일로 다운로드할 수 있습니다. 전체 이벤트 히스토리, 모델 메타데이터, 비용 내역을 하나의 이동 가능한 아카이브에 포함합니다.",
    "Dedicated Health tab on the Dashboard with a composite health score (weighted from success rate, cache hit rate, error rate, and heap usage), storage engine donut chart, tool invocation frequency bars, subagent effectiveness, model token distribution, and compaction impact — all with cursor-following tooltips and 5-second auto-refresh.":
      "대시보드에는 (성공률, 캐시 적중률, 오류율, 힙 사용량에 가중치를 부여한) 종합 상태 점수, 저장소 엔진 도넛 차트, 도구 호출 빈도 막대그래프, 서브에이전트 효과, 모델 토큰 분포, 압축(compaction) 영향을 보여 주는 전용 Health 탭이 있으며, 모두 커서를 따라다니는 툴팁과 5초 자동 새로고침을 지원합니다.",
    "Configure native browser notifications with per-event toggles for session starts, completions, errors, and subagent spawns. Automatic permission management with test-send button and graceful fallback when denied.":
      "세션 시작, 완료, 오류, 서브에이전트 생성에 대해 이벤트별로 토글할 수 있는 네이티브 브라우저 알림을 설정할 수 있습니다. 권한이 거부되었을 때도 우아하게 대체되며, 테스트 전송 버튼으로 권한을 자동 관리합니다.",
    "Per-model pricing — no catch-all grouping": "모델별 가격 책정 — 뭉뚱그린 그룹화 없음",
    "Each Claude model variant (e.g., Opus 4.6 vs Opus 4.1) has its own explicit pricing pattern because different model versions have different rates. The cost engine uses specificity sorting — longer patterns match before shorter ones.":
      "각 Claude 모델 변형(예: Opus 4.6과 Opus 4.1)은 모델 버전마다 요율이 다르기 때문에 각자 명시적인 가격 패턴을 가집니다. 비용 엔진은 구체성 기준 정렬을 사용하여, 더 긴 패턴이 더 짧은 패턴보다 먼저 일치합니다.",
    "Turns the dashboard from passive viewing into active monitoring. A rules-based alerting engine evaluates the live event stream <strong>server-side</strong>, and fired alerts fan out to outbound <strong>webhook channels</strong>. Everything lives in one place — <strong>Settings → Alerts</strong> — behind a segmented control with three tabs: <strong>Rules</strong> (what triggers an alert), <strong>Channels</strong> (where alerts are delivered), and <strong>Activity</strong> (the live fired-alert feed with acknowledge / acknowledge-all).":
      "대시보드를 수동적인 열람 도구에서 능동적인 모니터링 도구로 바꿔 줍니다. 규칙 기반 알림 엔진이 <strong>서버 측</strong>에서 실시간 이벤트 스트림을 평가하며, 발생한 알림은 외부 <strong>웹훅 채널</strong>로 팬아웃됩니다. 모든 기능은 <strong>Settings → Alerts</strong> 한 곳에 모여 있으며, 세 개의 탭으로 구성된 세그먼트 컨트롤 뒤에 배치됩니다: <strong>Rules</strong>(무엇이 알림을 발생시키는지), <strong>Channels</strong>(알림이 전달되는 곳), <strong>Activity</strong>(확인 / 모두 확인 기능이 있는 실시간 발생 알림 피드).",
    'Four condition types: <strong>event pattern</strong> (match <code>event_type</code> / <code>tool_name</code> / a summary substring, optionally requiring ≥ N matches within a rolling window — e.g. "5 errors in 2 minutes"), <strong>inactivity</strong> (an active session goes quiet for N minutes), <strong>status duration</strong> (an agent is stuck in <code>working</code> / <code>waiting</code> for N minutes), and <strong>token threshold</strong> (a session\'s cumulative tokens cross a limit). Each rule has a configurable <strong>cooldown</strong> that dedups repeat alerts per (rule, session, agent).':
      '네 가지 조건 유형이 있습니다: <strong>이벤트 패턴</strong>(<code>event_type</code> / <code>tool_name</code> / 요약 문자열 일부를 매칭하며, 필요 시 롤링 윈도우 내에서 N회 이상 일치하도록 설정 가능 — 예: "2분 내 오류 5회"), <strong>비활성</strong>(활성 세션이 N분 동안 조용해짐), <strong>상태 지속 시간</strong>(에이전트가 <code>working</code> / <code>waiting</code> 상태로 N분 동안 멈춰 있음), <strong>토큰 임계값</strong>(세션의 누적 토큰이 한도를 초과함)입니다. 각 규칙에는 (규칙, 세션, 에이전트) 조합별로 반복 알림을 중복 제거하는 설정 가능한 <strong>쿨다운</strong>이 있습니다.',
    "Event-driven rules (<code>event_pattern</code>, <code>token_threshold</code>) run on every hook ingest — <em>after</em> the transaction commits and the response is sent, fully try/catch-guarded, so alerting can never slow or fail hook delivery. Time-based rules (<code>inactivity</code>, <code>status_duration</code>) run on an unref'd 60-second sweep. Enabled rules are cached in memory and invalidated on every edit. Fired alerts persist to <code>alert_events</code> and broadcast an <code>alert_triggered</code> WebSocket message.":
      "이벤트 기반 규칙(<code>event_pattern</code>, <code>token_threshold</code>)은 모든 훅 수집 시마다 실행되며 — 트랜잭션이 커밋되고 응답이 전송된 <em>이후</em>에, 전체적으로 try/catch로 보호되어 실행되므로 알림 기능이 훅 전달을 절대 지연시키거나 실패하게 만들지 않습니다. 시간 기반 규칙(<code>inactivity</code>, <code>status_duration</code>)은 unref 처리된 60초 주기 스윕으로 실행됩니다. 활성화된 규칙은 메모리에 캐시되며 편집할 때마다 무효화됩니다. 발생한 알림은 <code>alert_events</code>에 영구 저장되고 <code>alert_triggered</code> WebSocket 메시지로 브로드캐스트됩니다.",
    "Slack, Discord, Microsoft Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, and Pipedream — plus a generic JSON endpoint. A declarative <strong>provider registry</strong> describes each one's payload formatter, URL resolution, auth headers, and credential fields, so adding a provider is a single server-side entry that surfaces in the UI with no front-end change.":
      "Slack, Discord, Microsoft Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream을 지원하며, 여기에 범용 JSON 엔드포인트도 추가되어 있습니다. 선언적 <strong>provider registry</strong>가 각 제공자의 페이로드 포맷터, URL 결정 방식, 인증 헤더, 자격 증명 필드를 기술하므로, 프로바이더를 추가하는 작업은 프런트엔드 변경 없이 UI에 자동으로 반영되는 서버 측 항목 하나만 추가하면 됩니다.",
    'Each delivery POSTs with an <code>AbortController</code> timeout and bounded retry/backoff (retries transport errors, 429, and 5xx — never other 4xx), then records the attempt-chain in <code>webhook_deliveries</code>. A provider can also veto a 2xx whose body signals failure (Splunk On-Call returns 200 with <code>result:"failure"</code>). Delivery is <strong>detached and fail-safe</strong> — it never throws into, slows, or blocks the alert path.':
      '각 전달은 <code>AbortController</code> 타임아웃과 제한된 재시도/백오프를 적용하여 POST 요청을 보내며(전송 오류, 429, 5xx는 재시도하지만 그 외 4xx는 재시도하지 않습니다), 시도 체인을 <code>webhook_deliveries</code>에 기록합니다. 프로바이더는 본문이 실패를 나타내는 2xx 응답도 거부(veto)할 수 있습니다(Splunk On-Call은 <code>result:"failure"</code>와 함께 200을 반환합니다). 전달은 <strong>분리되어 있고 페일세이프</strong>합니다 — 알림 경로에 예외를 던지거나 지연시키거나 차단하는 일이 결코 없습니다.',
    "Target URLs are masked (host + last 4 chars), and secrets / credential fields (routing keys, API keys, bot tokens) plus custom-header values are redacted in every API response — the full URL and secrets are stored server-side and never leave it. Generic endpoints support optional <strong>HMAC-SHA256</strong> body signing (<code>X-Webhook-Signature</code> + <code>X-Webhook-Timestamp</code>) so receivers can verify authenticity.":
      "대상 URL은 마스킹되어(호스트 + 마지막 4자) 표시되며, 시크릿 / 자격 증명 필드(라우팅 키, API 키, 봇 토큰)와 사용자 지정 헤더 값도 모든 API 응답에서 마스킹됩니다 — 전체 URL과 시크릿은 서버 측에만 저장되며 밖으로 나가지 않습니다. 범용 엔드포인트는 선택적으로 <strong>HMAC-SHA256</strong> 본문 서명(<code>X-Webhook-Signature</code> + <code>X-Webhook-Timestamp</code>)을 지원하여 수신자가 진위를 검증할 수 있습니다.",
    'Every alert-rule field has a help tooltip — the event-type, tool-name, and summary-contains fields include example chips of real hook events and built-in tool names. Each webhook provider ships a collapsible step-by-step setup guide linking to the official docs. A one-click <strong>"Send test"</strong> probe fires a synthetic alert and reports the delivery result inline, and targets can be scoped to specific rules. Fully localized (en / zh / vi / ko).':
      '모든 알림 규칙 필드에는 도움말 툴팁이 있습니다 — 이벤트 유형, 도구 이름, 요약 포함 필드에는 실제 훅 이벤트와 내장 도구 이름의 예시 칩이 함께 제공됩니다. 각 웹훅 프로바이더는 공식 문서로 연결되는 접을 수 있는 단계별 설정 가이드를 제공합니다. 클릭 한 번으로 실행하는 <strong>"테스트 전송"</strong> 기능은 가상의 알림을 발생시켜 전달 결과를 즉시 표시하며, 대상을 특정 규칙으로 범위를 제한할 수도 있습니다. en / zh / vi로 완전히 현지화되어 있습니다.',
    "Provider(s)": "프로바이더",
    "Payload format": "페이로드 형식",
    "URL / credentials": "URL / 자격 증명",
    "Block Kit (header + section + context)": "Block Kit (header + section + context)",
    "Rich embed": "리치 임베드(Rich embed)",
    "Adaptive Card in a Workflows <code>message</code> envelope":
      "Workflows <code>message</code> 봉투에 담긴 Adaptive Card",
    "Power Automate Workflows URL": "Power Automate Workflows URL",
    "Text message (basic markdown)": "텍스트 메시지(기본 마크다운)",
    "Space webhook URL": "스페이스 웹훅 URL",
    "Slack-style legacy attachments": "Slack 스타일의 레거시 attachments",
    "Bot API <code>sendMessage</code> (HTML)": "Bot API <code>sendMessage</code> (HTML)",
    "Bot token + chat ID (URL derived)": "봇 토큰 + 채팅 ID (URL에서 파생)",
    "Events API v2 trigger (with <code>dedup_key</code>)":
      "Events API v2 트리거(<code>dedup_key</code> 포함)",
    "Routing key (URL prefilled)": "라우팅 키(URL 사전 입력됨)",
    "Alert API": "Alert API",
    "API key (GenieKey header) + region": "API 키(GenieKey 헤더) + 리전",
    "VictorOps REST": "VictorOps REST",
    "REST endpoint URL (key embedded)": "REST 엔드포인트 URL(키 내장)",
    "Stable <code>{ event, alert }</code> JSON envelope":
      "안정적인 <code>{ event, alert }</code> JSON 봉투",
    "Endpoint URL (+ optional HMAC &amp; headers)": "엔드포인트 URL(+ 선택적 HMAC 및 헤더)",
    "Additive &amp; non-blocking by design": "설계상 추가적이며 논블로킹입니다",
    "Two new tables — <code>webhook_targets</code> (config; survives Clear Data like alert rules) and <code>webhook_deliveries</code> (audit log) — with no changes to existing tables, response shapes, or WebSocket message types. Webhook dispatch is fire-and-forget off the alert path, so a slow or failing endpoint can never slow or break alert firing or hook ingestion.":
      "새로 추가된 두 개의 테이블 — <code>webhook_targets</code>(설정 정보로, 알림 규칙과 마찬가지로 Clear Data 이후에도 유지됨)와 <code>webhook_deliveries</code>(감사 로그) — 외에 기존 테이블, 응답 형식, WebSocket 메시지 유형에는 어떠한 변경도 없습니다. 웹훅 전달은 알림 경로에서 벗어난 fire-and-forget 방식이므로, 느리거나 실패하는 엔드포인트가 알림 발생이나 훅 수집을 지연시키거나 망가뜨리는 일은 결코 없습니다.",
    "Provider setup steps can drift": "프로바이더 설정 절차는 변경될 수 있습니다",
    "Microsoft retired classic Office 365 connectors in 2025, so Teams uses an Adaptive Card delivered via Power Automate <strong>Workflows</strong>. More broadly, provider setup UIs change often — the in-app guides say so and link to each provider's official docs. Always confirm against the source.":
      "Microsoft가 2025년에 기존 Office 365 커넥터를 폐지했기 때문에, Teams는 Power Automate <strong>Workflows</strong>를 통해 전달되는 Adaptive Card를 사용합니다. 더 넓게 보면, 프로바이더의 설정 UI는 자주 바뀝니다 — 앱 내 가이드에도 이 점이 명시되어 있으며 각 프로바이더의 공식 문서로 연결됩니다. 항상 원본 문서를 통해 확인하시기 바랍니다.",
    '<span class="caption-icon">⬆</span> Update Notifier — version comparison modal with one-click copy of the update command. No automatic self-restart; you stay in control of when upgrades happen':
      '<span class="caption-icon">⬆</span> Update Notifier — 업데이트 명령을 클릭 한 번으로 복사할 수 있는 버전 비교 모달입니다. 자동 재시작은 없으며, 업그레이드 시점은 항상 사용자가 직접 결정합니다',
    "A detection-only subsystem that tells the user when the dashboard's git checkout is behind the canonical default branch. <strong>Branch- and fork-aware:</strong> if an <code>upstream</code> remote is configured (the standard convention for forks), it takes priority over <code>origin</code>; the chosen remote's <code>master</code> / <code>main</code> / <code>HEAD</code> is the comparison ref. The printed command adapts to the user's situation — <code>git pull --ff-only</code> only when their branch actually tracks the canonical ref, otherwise <code>git fetch</code> (with a fast-forward merge in the fork case). The server <strong>never</strong> pulls or restarts itself — the user runs the command in a terminal — so the mechanism cannot break dev sessions, pm2/systemd/launchd/Docker supervision, or leave orphaned processes.":
      "대시보드의 git 체크아웃이 표준 기본 브랜치보다 뒤처져 있을 때 사용자에게 알려 주기만 하는 탐지 전용 서브시스템입니다. <strong>브랜치 및 포크를 인식합니다:</strong> <code>upstream</code> 원격 저장소가 설정되어 있으면(포크에서의 표준 관례) <code>origin</code>보다 우선시되며, 선택된 원격 저장소의 <code>master</code> / <code>main</code> / <code>HEAD</code>가 비교 기준(ref)이 됩니다. 표시되는 명령은 사용자의 상황에 맞춰 달라집니다 — 브랜치가 실제로 표준 ref를 추적하는 경우에만 <code>git pull --ff-only</code>를 사용하고, 그렇지 않으면 <code>git fetch</code>를 사용합니다(포크의 경우 fast-forward 병합 포함). 서버는 <strong>절대</strong> 스스로 pull하거나 재시작하지 않으며 — 사용자가 터미널에서 직접 명령을 실행합니다 — 따라서 이 메커니즘이 개발 세션이나 pm2/systemd/launchd/Docker 관리 체계를 깨뜨리거나 고아 프로세스를 남길 수 없습니다.",
    "A shell-less <code>git fetch</code> with a 120-second timeout, followed by a <code>rev-list</code> against the tracked upstream. Each call runs from <code>server/lib/update-check.js</code> and returns a structured payload — never throws — so a flaky remote can&apos;t stall the dashboard.":
      "셸을 거치지 않는 <code>git fetch</code>를 120초 타임아웃으로 실행한 다음, 추적 중인 upstream을 대상으로 <code>rev-list</code>를 수행합니다. 각 호출은 <code>server/lib/update-check.js</code>에서 실행되며 구조화된 페이로드를 반환할 뿐 절대 예외를 던지지 않으므로, 불안정한 원격 저장소가 대시보드를 멈추게 할 수 없습니다.",
    "<code>update-scheduler.js</code> polls every five minutes with <code>.unref()</code> timers so it never blocks shutdown, de-duplicates with a fingerprint over the status payload, and announces up-to-date → behind transitions in a framed stdout block. Disable entirely with <code>DASHBOARD_UPDATE_CHECK=0</code>.":
      "<code>update-scheduler.js</code>는 종료를 절대 막지 않는 <code>.unref()</code> 타이머로 5분마다 폴링하며, 상태 페이로드에 대한 지문(fingerprint)으로 중복을 제거하고, 최신 → 뒤처짐으로의 전환을 테두리로 감싼 stdout 블록으로 알립니다. <code>DASHBOARD_UPDATE_CHECK=0</code>으로 완전히 비활성화할 수 있습니다.",
    "Each status payload carries a <code>manual_command</code> shaped for the user's actual situation: <code>git pull --ff-only</code> on a tracked canonical branch, <code>git fetch &amp;&amp; git merge --ff-only</code> for forks where local tracks the wrong remote, and a plain <code>git fetch</code> on a feature branch where pulling would update the wrong branch. Install / build steps are appended only when the working tree is actually being rewritten.":
      "각 상태 페이로드에는 사용자의 실제 상황에 맞춰진 <code>manual_command</code>가 포함됩니다: 추적 중인 표준 브랜치에서는 <code>git pull --ff-only</code>, 로컬이 잘못된 원격 저장소를 추적하고 있는 포크에서는 <code>git fetch &amp;&amp; git merge --ff-only</code>, pull이 잘못된 브랜치를 업데이트하게 되는 기능 브랜치에서는 단순한 <code>git fetch</code>가 사용됩니다. 설치 / 빌드 단계는 워킹 트리가 실제로 다시 작성될 때만 추가됩니다.",
    "A modal opens automatically when upstream is ahead; ESC or a backdrop click dismisses it. A persistent sidebar button stays in the footer — emerald when behind, amber when the last check errored — so users can always trigger a fresh check on demand.":
      "upstream이 앞서 있으면 모달이 자동으로 열리며, ESC 키나 배경 클릭으로 닫을 수 있습니다. 푸터에는 항상 표시되는 사이드바 버튼이 있어 — 뒤처져 있으면 에메랄드색, 마지막 확인에서 오류가 발생했으면 호박색으로 표시되며 — 사용자가 언제든 새로운 확인을 직접 실행할 수 있습니다.",
    "Non-git installs, no remotes configured, offline fetches, and unresolvable upstream refs all return tagged payloads instead of throwing. The sidebar badge turns amber on fetch errors and the modal stays suppressed until a successful check arrives — no spinners, no stuck state.":
      "git 설치가 아닌 경우, 원격 저장소가 설정되지 않은 경우, 오프라인 상태에서의 fetch, 해석할 수 없는 upstream ref는 모두 예외를 던지는 대신 태그가 지정된 페이로드를 반환합니다. 사이드바 배지는 fetch 오류 시 호박색으로 바뀌며, 성공적인 확인이 이루어지기 전까지 모달은 표시되지 않습니다 — 스피너도, 멈춘 상태도 없습니다.",
    "Dismissal is keyed by the upstream SHA in <code>localStorage</code>, so closing the modal silences it only for <em>that</em> commit — a newer upstream commit re-opens it automatically. Clicking the sidebar button is an explicit intent signal and clears the stored dismissal before firing a fresh check.":
      "닫기 상태는 <code>localStorage</code>에 upstream SHA를 키로 저장되므로, 모달을 닫아도 <em>해당</em> 커밋에 대해서만 잠잠해집니다 — 더 새로운 upstream 커밋이 생기면 자동으로 다시 열립니다. 사이드바 버튼을 클릭하는 것은 명시적인 의도 신호로 간주되어, 새로운 확인을 실행하기 전에 저장된 닫기 상태를 초기화합니다.",
    "Read-only check — runs <code>git fetch</code>, compares, returns the payload.":
      "읽기 전용 확인입니다 — <code>git fetch</code>를 실행하고 비교한 다음 페이로드를 반환합니다.",
    "Same check, and broadcasts <code>update_status</code> over WebSocket so every connected client re-syncs at once.":
      "동일한 확인을 수행하며, <code>update_status</code>를 WebSocket으로 브로드캐스트하여 연결된 모든 클라이언트가 즉시 다시 동기화되도록 합니다.",
    "<strong>Detection-only by design</strong>": "<strong>설계상 탐지 전용입니다</strong>",
    "There is no <code>POST /api/updates/apply</code> and no in-process restart helper. A process cannot reliably replace itself without an external supervisor, and <code>npm run dev</code>, <code>npm start</code>, pm2, systemd, launchd, and Docker each need different restart logic. Detection-only keeps the mechanism portable across every supervisor and OS, and leaves the dashboard's lifecycle owned by whatever started it. The user runs the printed command in their own shell.":
      "<code>POST /api/updates/apply</code>는 존재하지 않으며, 프로세스 내부의 재시작 도우미도 없습니다. 프로세스는 외부 감독자(supervisor) 없이는 스스로를 안정적으로 교체할 수 없으며, <code>npm run dev</code>, <code>npm start</code>, pm2, systemd, launchd, Docker는 각각 다른 재시작 로직을 필요로 합니다. 탐지 전용으로 설계함으로써 이 메커니즘은 모든 감독자와 OS에서 이식 가능하게 유지되며, 대시보드의 라이프사이클은 그것을 시작한 주체가 계속 소유하게 됩니다. 사용자는 표시된 명령을 자신의 셸에서 직접 실행합니다.",
    '<span class="caption-icon">◈</span> Connection Status — sidebar-launched details modal with WebSocket endpoint, connection uptime, 60-second throughput sparkline, top event-type breakdown, and recent activity list':
      '<span class="caption-icon">◈</span> Connection Status — WebSocket 엔드포인트, 연결 가동 시간, 60초 처리량 스파크라인, 상위 이벤트 유형 분석, 최근 활동 목록을 보여 주는 사이드바에서 실행되는 상세 정보 모달입니다',
    'The <strong>Live</strong> / <strong>Disconnected</strong> pill in the sidebar footer opens a small details panel about the dashboard\'s WebSocket transport. It surfaces the active <code>ws://</code> endpoint, how long the current socket has been up, total events received, the top event types as a horizontal bar chart, a 60-second throughput sparkline, and the most recent 8 events as an activity list. Cumulative stats (totals, type breakdown, recent list) persist across reloads via <code>localStorage</code> under <code>sidebar-connection-stats</code>; the rolling sparkline and "connected since" timer are intentionally ephemeral since they only make sense relative to "now". A <strong>Reset</strong> button clears everything on demand.':
      '사이드바 하단의 <strong>Live</strong> / <strong>Disconnected</strong> 알약형 버튼을 클릭하면 대시보드의 WebSocket 전송에 관한 작은 상세 패널이 열립니다. 이 패널에는 현재 활성화된 <code>ws://</code> 엔드포인트, 현재 소켓의 연결 유지 시간, 수신된 총 이벤트 수, 상위 이벤트 유형을 나타내는 가로 막대 차트, 60초 처리량 스파크라인, 그리고 가장 최근 8개 이벤트를 담은 활동 목록이 표시됩니다. 누적 통계(총계, 유형별 분류, 최근 목록)는 <code>localStorage</code>의 <code>sidebar-connection-stats</code> 키 아래에 저장되어 새로고침 후에도 유지되지만, 롤링 스파크라인과 "연결 이후" 타이머는 "현재 시점"을 기준으로만 의미가 있으므로 의도적으로 일시적인 상태로 유지됩니다. <strong>Reset</strong> 버튼을 누르면 필요할 때 언제든 모든 내용을 지울 수 있습니다.',
    "Implementation note: per-event state lives in <code>useRef</code> buffers on the sidebar so the WS firehose never re-renders the navigation tree — the modal does its own one-second tick to sample the refs while open. Writes are throttled (single-flight timer, 2 s window) and flushed on <code>pagehide</code> / <code>visibilitychange</code> so the latest events aren't lost to the throttle window. The modal itself is portalled to <code>document.body</code> so the sidebar's stacking context can't trap it.":
      "구현 참고 사항: 이벤트별 상태는 사이드바의 <code>useRef</code> 버퍼에 보관되므로 WS 이벤트 폭주가 내비게이션 트리를 다시 렌더링하는 일은 없습니다 — 모달이 열려 있는 동안에는 모달이 직접 1초 간격으로 해당 ref 값을 샘플링합니다. 쓰기 작업은 스로틀링되며(단일 실행 타이머, 2초 창), <code>pagehide</code> / <code>visibilitychange</code> 시점에 플러시되어 최신 이벤트가 스로틀링 구간 때문에 손실되지 않습니다. 모달 자체는 <code>document.body</code>로 포털링되어 있어 사이드바의 스태킹 컨텍스트에 갇히지 않습니다.",
    "The entire UI ships in <strong>four languages — English, 简体中文, Tiếng Việt, and 한국어</strong> — built on <code>i18next</code> + <code>react-i18next</code> with <code>i18next-browser-languagedetector</code>. Coverage is end-to-end: every page, chart tooltip, Settings flow, Workflow narrative, Config Explorer tab, Run page, and the Alerts rule-help tooltips + webhook setup guides are translated. Switch languages from the sidebar (EN / 中文 / VI / 한국어) — the choice persists in <code>localStorage</code>.":
      "전체 UI는 <strong>네 가지 언어 — English, 简体中文, Tiếng Việt, 한국어</strong> — 로 제공되며, <code>i18next</code> + <code>react-i18next</code>를 기반으로 <code>i18next-browser-languagedetector</code>와 함께 구축되었습니다. 번역 범위는 전 영역에 걸쳐 있습니다. 모든 페이지, 차트 툴팁, Settings 흐름, Workflow 내러티브, Config Explorer 탭, Run 페이지, 그리고 Alerts 규칙 도움말 툴팁과 webhook 설정 가이드까지 모두 번역되어 있습니다. 사이드바에서 언어를 전환할 수 있으며(EN / 中文 / VI / 한국어), 선택한 언어는 <code>localStorage</code>에 저장됩니다.",
    'Translations are split into per-area JSON namespaces (<code>common</code>, <code>nav</code>, <code>dashboard</code>, <code>sessions</code>, <code>analytics</code>, <code>workflows</code>, <code>settings</code>, <code>kanban</code>, <code>run</code>, <code>ccConfig</code>, <code>alerts</code>, <code>errors</code>, <code>updates</code>) under <code>client/src/i18n/locales/&lt;lng&gt;/</code>. Components load only the namespaces they need via <code>useTranslation("…")</code>.':
      '번역은 영역별 JSON 네임스페이스(<code>common</code>, <code>nav</code>, <code>dashboard</code>, <code>sessions</code>, <code>analytics</code>, <code>workflows</code>, <code>settings</code>, <code>kanban</code>, <code>run</code>, <code>ccConfig</code>, <code>alerts</code>, <code>errors</code>, <code>updates</code>)로 나뉘어 <code>client/src/i18n/locales/&lt;lng&gt;/</code> 아래에 위치합니다. 각 컴포넌트는 <code>useTranslation("…")</code>를 통해 필요한 네임스페이스만 불러옵니다.',
    "Language is detected from <code>localStorage</code> (<code>i18nextLng</code>) then the browser's <code>navigator</code> setting, and the choice is cached back to <code>localStorage</code>. <code>fallbackLng</code> is English and <code>nonExplicitSupportedLngs</code> resolves regional tags (e.g. <code>vi-VN</code> → <code>vi</code>), so any unmapped key falls back gracefully rather than rendering a raw key.":
      "언어는 먼저 <code>localStorage</code>(<code>i18nextLng</code>)에서 감지된 후 브라우저의 <code>navigator</code> 설정에서 감지되며, 선택한 값은 다시 <code>localStorage</code>에 캐시됩니다. <code>fallbackLng</code>는 영어이고, <code>nonExplicitSupportedLngs</code>는 지역 태그를 해석합니다(예: <code>vi-VN</code> → <code>vi</code>). 따라서 매핑되지 않은 키가 있어도 원시 키를 그대로 렌더링하지 않고 우아하게 폴백됩니다.",
    "Numbers, costs, dates, and relative times format against the active locale via a shared <code>getCurrentLocale()</code> helper, and plurals use i18next's <code>_one</code> / <code>_other</code> suffixes. Interpolated values (<code>{{count}}</code>, <code>{{provider}}</code>, …) keep sentences natural across languages.":
      "숫자, 비용, 날짜, 상대 시간은 공유된 <code>getCurrentLocale()</code> 헬퍼를 통해 현재 로케일에 맞춰 형식화되며, 복수형은 i18next의 <code>_one</code> / <code>_other</code> 접미사를 사용합니다. 보간된 값(<code>{{count}}</code>, <code>{{provider}}</code> 등)은 여러 언어에서도 문장이 자연스럽게 유지되도록 합니다.",
    "Domain terms that are proper nouns or code stay untranslated in every locale — <em>Agent</em>, <em>Subagent</em>, hook event names (<code>PostToolUse</code>), tool names (<code>Bash</code>), and webhook provider names (Slack, PagerDuty). Only the surrounding prose is localized, so instructions stay accurate.":
      "고유명사나 코드에 해당하는 도메인 용어는 모든 로케일에서 번역되지 않고 그대로 유지됩니다 — <em>Agent</em>, <em>Subagent</em>, hook 이벤트 이름(<code>PostToolUse</code>), 도구 이름(<code>Bash</code>), webhook 제공자 이름(Slack, PagerDuty) 등입니다. 주변의 설명 문구만 현지화되므로 안내 내용은 정확하게 유지됩니다.",
    "<strong>Adding a language</strong>": "<strong>언어 추가하기</strong>",
    "Copy <code>client/src/i18n/locales/en/</code> to a new locale folder, translate the JSON values (leaving keys and technical terms intact), then register the bundle and add the tag to <code>supportedLngs</code> in <code>client/src/i18n/index.ts</code>. Missing keys fall back to English automatically, so even a partial translation ships cleanly.":
      "<code>client/src/i18n/locales/en/</code>을 새 로케일 폴더로 복사하고, JSON 값을 번역합니다(키와 기술 용어는 그대로 유지). 그런 다음 번들을 등록하고 <code>client/src/i18n/index.ts</code>의 <code>supportedLngs</code>에 해당 태그를 추가합니다. 누락된 키는 자동으로 영어로 대체되므로, 부분적으로만 번역되어 있어도 문제없이 배포할 수 있습니다.",
    "<strong>Tabby</strong> is a cute SVG cat companion pinned to the <strong>edges of every page</strong> of the dashboard. It is always present and turns the live session stream into glanceable, ambient feedback — calm when idle, alert when something needs attention, and celebratory when a run finishes. Tabby is built entirely on the existing <code>eventBus</code> WebSocket stream: <strong>no new backend, no API key, and no new dependencies</strong>. The component lives in <code>client/src/components/Tabby/</code> and can be toggled on or off in Settings page.":
      "<strong>Tabby</strong>는 대시보드의 <strong>모든 페이지 가장자리</strong>에 고정되어 있는 귀여운 SVG 고양이 동반자입니다. Tabby는 항상 존재하며, 실시간 세션 스트림을 한눈에 파악할 수 있는 은은한 피드백으로 바꿔줍니다 — 유휴 상태일 때는 차분하고, 주의가 필요할 때는 경계하며, 실행이 완료되면 축하합니다. Tabby는 기존의 <code>eventBus</code> WebSocket 스트림 위에 완전히 구축되어 있습니다. <strong>새로운 백엔드도, API 키도, 새로운 의존성도 필요하지 않습니다.</strong> 이 컴포넌트는 <code>client/src/components/Tabby/</code>에 있으며 Settings 페이지에서 켜거나 끌 수 있습니다.",
    '<span class="caption-icon">📥</span> Tabby Companion — a cute SVG cat in the edges of every page, reacting in real time to the live session stream with eight distinct moods and animations, auto-surfacing speech bubbles for notable events, and serving as the gateway to a status panel and Ask box':
      '<span class="caption-icon">📥</span> Tabby Companion — 모든 페이지 가장자리에 있는 귀여운 SVG 고양이로, 여덟 가지 고유한 기분과 애니메이션으로 실시간 세션 스트림에 실시간으로 반응하고, 주목할 만한 이벤트에 대해 말풍선을 자동으로 표시하며, 상태 패널과 Ask 박스로 이어지는 관문 역할을 합니다',
    "Tabby derives one of eight moods from the live session WebSocket stream, each with its own animation. The eyes track your cursor, and the active mood drives a distinct motion cue.":
      "Tabby는 실시간 세션 WebSocket 스트림으로부터 여덟 가지 기분 중 하나를 도출하며, 각 기분마다 고유한 애니메이션을 가지고 있습니다. 눈은 커서를 따라 움직이며, 현재 활성화된 기분에 따라 고유한 동작 신호가 나타납니다.",
    "Notable events — session started or finished, errors, and run completed — automatically surface a speech bubble. Bubbles are <strong>throttled and coalesced</strong> so bursts of events never spam you, and they can be muted on demand. Everything reflects in real time over the existing <code>eventBus</code> WebSocket channel, with no polling and no extra services.":
      "세션 시작 또는 종료, 오류, 실행 완료와 같은 주목할 만한 이벤트가 발생하면 자동으로 말풍선이 표시됩니다. 말풍선은 <strong>스로틀링되고 병합되어</strong> 이벤트가 몰리더라도 스팸처럼 쏟아지지 않으며, 필요에 따라 음소거할 수도 있습니다. 모든 동작은 기존의 <code>eventBus</code> WebSocket 채널을 통해 실시간으로 반영되며, 폴링이나 추가 서비스는 전혀 필요하지 않습니다.",
    "Click the cat — or press <code>⌘B</code> / <code>Ctrl+B</code> — to open Tabby's panel (<code>Esc</code> closes it). The panel groups a live status line, quick actions, and an Ask box.":
      "고양이를 클릭하거나 <code>⌘B</code> / <code>Ctrl+B</code>를 눌러 Tabby의 패널을 엽니다(<code>Esc</code>로 닫습니다). 이 패널에는 실시간 상태 표시줄, 빠른 작업, Ask 박스가 함께 모여 있습니다.",
    "<strong>Live status line:</strong> <em>N live · M errored · connection state</em>, updated from cached data.":
      "<strong>실시간 상태 표시줄:</strong> <em>N live · M errored · connection state</em>로, 캐시된 데이터를 기반으로 갱신됩니다.",
    "<strong>Quick actions:</strong> jump to Run Claude, Activity, Sessions, or errored sessions; mute bubbles; clear alerts.":
      "<strong>빠른 작업:</strong> Run Claude, Activity, Sessions 또는 오류가 발생한 세션으로 바로 이동하기, 말풍선 음소거하기, 알림 지우기.",
    "<strong>Ask box:</strong> answers simple status questions locally from cached data (&ldquo;what's running&rdquo;, &ldquo;any errors&rdquo;, &ldquo;status&rdquo;).":
      "<strong>Ask 박스:</strong> 캐시된 데이터를 바탕으로 간단한 상태 질문에 로컬에서 답변합니다(&ldquo;what's running&rdquo;, &ldquo;any errors&rdquo;, &ldquo;status&rdquo; 등).",
    "The Ask box answers status questions instantly and offline from cached data. For anything beyond a simple status question, Tabby hands off to the existing <strong>Run Claude</strong> page (<code>/run?prompt=...</code>) to spawn a real Claude Code session — so there is never a separate model call, key, or service to manage.":
      "Ask 박스는 캐시된 데이터를 바탕으로 즉시, 오프라인 상태에서도 상태 질문에 답변합니다. 단순한 상태 질문을 넘어서는 요청의 경우, Tabby는 기존의 <strong>Run Claude</strong> 페이지(<code>/run?prompt=...</code>)로 넘겨 실제 Claude Code 세션을 실행시킵니다 — 따라서 별도로 관리해야 할 모델 호출, 키, 서비스는 결코 존재하지 않습니다.",
    "Fully keyboard operable: <code>⌘B</code> / <code>Ctrl+B</code> to open, <code>Esc</code> to close.":
      "완전한 키보드 조작이 가능합니다: 열려면 <code>⌘B</code> / <code>Ctrl+B</code>, 닫으려면 <code>Esc</code>.",
    "Status and bubbles announce via <code>aria-live</code> for screen readers.":
      "상태와 말풍선은 스크린 리더를 위해 <code>aria-live</code>를 통해 안내됩니다.",
    "Respects <code>prefers-reduced-motion</code> to calm animations.":
      "애니메이션을 줄이기 위해 <code>prefers-reduced-motion</code>을 준수합니다.",
    "Degrades gracefully to a calm, dimmed disconnected state when offline.":
      "오프라인 상태일 때는 차분하고 어두워진 연결 끊김 상태로 우아하게 저하됩니다.",
    Endpoint: "엔드포인트",
    Mood: "기분",
    "When it appears": "나타나는 시점",
    Animation: "애니메이션",
    Idle: "Idle",
    "Nothing notable happening": "특별히 주목할 만한 일이 없음",
    "Gentle tail flick": "부드러운 꼬리 흔들기",
    Watching: "Watching",
    "Sessions active, observing the stream": "세션이 활성 상태이며 스트림을 관찰 중",
    "Ear perk, cursor-tracking eyes": "귀를 쫑긋 세우고, 커서를 따라가는 눈",
    Happy: "Happy",
    "A run completed successfully": "실행이 성공적으로 완료됨",
    Sparkle: "반짝임",
    Worried: "Worried",
    "Something looks off": "무언가 이상해 보임",
    "Head bob": "고개 끄덕임",
    Stuck: "Stuck",
    "A session appears blocked": "세션이 막힌 것으로 보임",
    "Shake + alert <code>!</code>": "흔들림 + 경고 <code>!</code>",
    Thinking: "Thinking",
    "Work in progress": "작업 진행 중",
    Sleeping: "Sleeping",
    "Quiet for a while": "한동안 조용함",
    Zzz: "Zzz",
    Disconnected: "Disconnected",
    "WebSocket offline": "WebSocket 오프라인",
    "Calm, dimmed state": "차분하고 어두워진 상태",
    "Development vs production deployment topology": "개발 환경과 프로덕션 배포 구조 비교",
    Aspect: "항목",
    Development: "개발",
    Production: "프로덕션",
    Processes: "프로세스",
    "2 (Express + Vite)": "2개(Express + Vite)",
    "1 (Express only)": "1개(Express만)",
    "Client URL": "클라이언트 URL",
    "API proxy": "API 프록시",
    "Vite proxies <code>/api</code> + <code>/ws</code> to :4820":
      "Vite가 <code>/api</code> + <code>/ws</code>를 :4820으로 프록시",
    "Same origin, no proxy": "동일 출처, 프록시 없음",
    "File watching": "파일 감시",
    "<code>node --watch</code> + Vite HMR": "<code>node --watch</code> + Vite HMR",
    None: "없음",
    "Source maps": "소스 맵",
    Inline: "인라인",
    "External files": "외부 파일",
    "<strong>A third way to run: the Desktop App (macOS &amp; Windows)</strong>":
      "<strong>세 번째 실행 방법: 데스크톱 앱(macOS &amp; Windows)</strong>",
    'Beyond development and standalone production, the dashboard also ships as a native desktop app — a macOS <code>.app</code> and a Windows <code>.exe</code> — that embeds the same production server in-process, no terminal required. See the <a href="#desktop-app">Desktop App (macOS &amp; Windows)</a> section for download, build, and install instructions.':
      '개발 모드와 독립형 프로덕션 모드 외에도, 대시보드는 네이티브 데스크톱 앱 — macOS용 <code>.app</code>과 Windows용 <code>.exe</code> — 형태로도 제공되며, 동일한 프로덕션 서버를 프로세스 내에 내장하고 있어 터미널이 필요하지 않습니다. 다운로드, 빌드, 설치 방법은 <a href="#desktop-app">데스크톱 앱(macOS &amp; Windows)</a> 섹션을 참고하십시오.',
    "The production image is OCI-compatible and works with both Docker and Podman. The server listens on <code>4820</code>, reads legacy Claude history from a read-only mount, and persists SQLite data under <code>/app/data</code>.":
      "프로덕션 이미지는 OCI와 호환되며 Docker와 Podman 모두에서 동작합니다. 서버는 <code>4820</code> 포트에서 대기하고, 읽기 전용 마운트에서 레거시 Claude 기록을 읽으며, SQLite 데이터를 <code>/app/data</code> 아래에 영구 저장합니다.",
    "Container image build and runtime mounts": "컨테이너 이미지 빌드 및 런타임 마운트",
    Mount: "마운트",
    "Read historical Claude session files for import without modifying them":
      "과거 Claude 세션 파일을 수정하지 않고 가져오기 위해 읽음",
    "Persist the SQLite database across rebuilds and container restarts":
      "재빌드 및 컨테이너 재시작 전반에 걸쳐 SQLite 데이터베이스를 영구 저장",
    "<strong>Hooks still run on the host</strong>":
      "<strong>Hook은 여전히 호스트에서 실행됩니다</strong>",
    "Claude Code fires hooks from the host machine, not from inside the container. After the container is healthy on <code>http://localhost:4820</code>, run <code>npm run install-hooks</code> on the host so hook events post back to the containerized server.":
      "Claude Code는 컨테이너 내부가 아니라 호스트 머신에서 hook을 실행합니다. 컨테이너가 <code>http://localhost:4820</code>에서 정상적으로 동작하면, 호스트에서 <code>npm run install-hooks</code>를 실행하여 hook 이벤트가 컨테이너화된 서버로 다시 전달되도록 합니다.",
    "A multi-stage <code>Dockerfile</code> and <code>docker-compose.yml</code> are included. Both <strong>Docker</strong> and <strong>Podman</strong> are fully supported — the image is OCI-compliant.":
      "다단계 <code>Dockerfile</code>과 <code>docker-compose.yml</code>이 포함되어 있습니다. <strong>Docker</strong>와 <strong>Podman</strong> 모두 완전히 지원되며 — 이 이미지는 OCI를 준수합니다.",
    "Read-only access to legacy session history for automatic import on startup":
      "시작 시 자동 가져오기를 위한 레거시 세션 기록에 대한 읽기 전용 접근",
    "Persists the SQLite database across container restarts":
      "컨테이너 재시작 전반에 걸쳐 SQLite 데이터베이스를 영구 저장",
    "The Dockerfile uses three stages to minimize the final image size:":
      "Dockerfile은 최종 이미지 크기를 최소화하기 위해 세 단계를 사용합니다.",
    Stage: "단계",
    "Installs production <code>node_modules</code> on <code>node:22-alpine</code>. <code>better-sqlite3</code> is optional — if prebuilds are unavailable, the server falls back to built-in <code>node:sqlite</code>":
      "<code>node:22-alpine</code>에 프로덕션용 <code>node_modules</code>를 설치합니다. <code>better-sqlite3</code>는 선택 사항입니다 — 사전 빌드가 없을 경우 서버는 내장된 <code>node:sqlite</code>로 대체됩니다",
    "Runs <code>npm ci</code> + <code>vite build</code> to produce optimized static assets":
      "<code>npm ci</code> + <code>vite build</code>를 실행하여 최적화된 정적 자산을 생성합니다",
    "Clean <code>node:22-alpine</code> with only <code>node_modules</code>, server code, and <code>client/dist</code>":
      "<code>node_modules</code>, 서버 코드, <code>client/dist</code>만 포함한 깔끔한 <code>node:22-alpine</code>",
    "<strong>Hook note</strong>": "<strong>Hook 참고 사항</strong>",
    "Claude Code hooks run on the host, not inside the container. The containerized server receives hook events via HTTP on <code>localhost:4820</code>. Run <code>npm run install-hooks</code> on the host after starting the container.":
      "Claude Code의 hook은 컨테이너 내부가 아니라 호스트에서 실행됩니다. 컨테이너화된 서버는 <code>localhost:4820</code>에서 HTTP를 통해 hook 이벤트를 수신합니다. 컨테이너를 시작한 후 호스트에서 <code>npm run install-hooks</code>를 실행하십시오.",
    Metric: "지표",
    "Server startup": "서버 시작",
    "SQLite opens instantly; schema migration is idempotent":
      "SQLite는 즉시 열리며, 스키마 마이그레이션은 멱등적입니다",
    "Hook latency": "Hook 지연 시간",
    "Transaction + broadcast, no async I/O beyond SQLite":
      "트랜잭션 + 브로드캐스트, SQLite 이외의 비동기 I/O 없음",
    "Client JS bundle": "클라이언트 JS 번들",
    "WebSocket latency": "WebSocket 지연 시간",
    "Local loopback, JSON serialization only": "로컬 루프백, JSON 직렬화만 수행",
    "SQLite write throughput": "SQLite 쓰기 처리량",
    "WAL mode on SSD; far exceeds any hook event rate":
      "SSD에서의 WAL 모드; 어떤 hook 이벤트 발생률도 훨씬 능가함",
    "Max events before slowdown": "성능 저하가 시작되는 최대 이벤트 수",
    "Pagination prevents full-table scans": "페이지네이션으로 전체 테이블 스캔을 방지",
    "Server memory": "서버 메모리",
    "SQLite in-process, no ORM overhead": "프로세스 내 SQLite, ORM 오버헤드 없음",
    "Client memory": "클라이언트 메모리",
    "React + Tailwind, minimal runtime deps": "React + Tailwind, 최소한의 런타임 의존성",
    "Input validation": "입력 검증",
    "Required fields checked before DB operations; CHECK constraints on status enums":
      "DB 작업 전에 필수 필드를 검사; 상태 열거형에 대한 CHECK 제약 조건 적용",
    "Hook safety": "Hook 안전성",
    "Hook handler always exits 0; 5s max lifetime; uses <code>127.0.0.1</code> not external hosts":
      "Hook 핸들러는 항상 종료 코드 0으로 종료됨; 최대 수명 5초; 외부 호스트가 아닌 <code>127.0.0.1</code> 사용",
    CORS: "CORS",
    "Restricted to loopback origins, so cross-origin pages can't read responses; no-Origin clients like curl still work":
      "루프백 출처로 제한되어 있어 교차 출처 페이지는 응답을 읽을 수 없습니다. curl처럼 Origin이 없는 클라이언트는 계속 동작합니다",
    Authentication: "인증",
    "Off by default since the loopback bind is the trust boundary; set <code>DASHBOARD_TOKEN</code> to require a bearer token on every <code>/api/*</code> request and the WebSocket when exposing on a LAN.":
      "루프백 바인딩 자체가 신뢰 경계이므로 기본적으로 비활성화되어 있습니다. LAN에 노출할 때는 <code>DASHBOARD_TOKEN</code>을 설정하여 모든 <code>/api/*</code> 요청과 WebSocket에 bearer 토큰을 요구하도록 하십시오.",
    Secrets: "비밀 정보",
    "No API keys, tokens, or credentials stored or transmitted anywhere":
      "API 키, 토큰, 자격 증명이 어디에도 저장되거나 전송되지 않음",
    "Dependency surface": "의존성 표면",
    "5 runtime server deps, 6 runtime client deps (includes D3.js for Workflows) — minimal attack surface":
      "런타임 서버 의존성 5개, 런타임 클라이언트 의존성 6개(Workflows용 D3.js 포함) — 최소한의 공격 표면",
    "Hooks only apply to sessions started <em>after</em> installation. Restart Claude Code after starting the dashboard.":
      "Hook은 설치 <em>이후</em>에 시작된 세션에만 적용됩니다. 대시보드를 시작한 뒤에는 Claude Code를 재시작하십시오.",
    "On some systems the shell environment when Claude Code fires hooks may not include the full PATH. Test with <code>node --version</code>. If not found, use the absolute path to <code>node</code> in the hook command.":
      "일부 시스템에서는 Claude Code가 hook을 실행할 때의 셸 환경에 전체 PATH가 포함되어 있지 않을 수 있습니다. <code>node --version</code>으로 테스트해 보십시오. 찾을 수 없다면 hook 명령에 <code>node</code>의 절대 경로를 사용하십시오.",
    Problem: "문제",
    Solution: "해결 방법",
    "<code>better-sqlite3</code> errors during install":
      "설치 중 <code>better-sqlite3</code> 오류 발생",
    "This is non-fatal — <code>better-sqlite3</code> is an optional dependency. On Node 22+ the server automatically falls back to built-in <code>node:sqlite</code>. On older Node versions, install Python 3 + C++ build tools, then run <code>npm rebuild better-sqlite3</code>. For the desktop app, the <code>desktop:install</code> preflight prints copy-pasteable per-OS setup guidance (incl. a no-toolchain alternative) when the native build fails.":
      "이는 치명적인 오류가 아닙니다 — <code>better-sqlite3</code>는 선택적 의존성입니다. Node 22 이상에서는 서버가 자동으로 내장된 <code>node:sqlite</code>로 대체됩니다. 이전 버전의 Node를 사용하는 경우 Python 3와 C++ 빌드 도구를 설치한 다음 <code>npm rebuild better-sqlite3</code>를 실행하십시오. 데스크톱 앱의 경우, 네이티브 빌드가 실패하면 <code>desktop:install</code> 사전 점검 과정에서 운영체제별로 그대로 복사해 붙여넣을 수 있는 설정 안내(툴체인이 필요 없는 대안 포함)를 출력합니다.",
    'Dashboard shows "Disconnected"': '대시보드에 "Disconnected"가 표시됨',
    "Server is not running. Start it with <code>npm run dev</code>. Client auto-reconnects every 2s.":
      "서버가 실행되고 있지 않습니다. <code>npm run dev</code>로 서버를 시작하십시오. 클라이언트는 2초마다 자동으로 재연결을 시도합니다.",
    "Events Today shows 0": "Events Today가 0으로 표시됨",
    "Ensure you are on the latest version (timezone bug was fixed). Restart the server.":
      "최신 버전을 사용하고 있는지 확인하십시오(시간대 버그가 수정되었습니다). 서버를 재시작하십시오.",
    "Port 4820 already in use": "포트 4820이 이미 사용 중",
    "Run <code>DASHBOARD_PORT=4821 npm run dev</code>, update Vite proxy in <code>client/vite.config.ts</code>, and re-run <code>npm run install-hooks</code>.":
      "<code>DASHBOARD_PORT=4821 npm run dev</code>를 실행하고, <code>client/vite.config.ts</code>의 Vite 프록시를 업데이트한 다음 <code>npm run install-hooks</code>를 다시 실행하십시오.",
    "Stale seed data shown": "오래된 시드 데이터가 표시됨",
    "Run <code>npm run clear-data</code> to wipe all rows, then restart.":
      "<code>npm run clear-data</code>를 실행하여 모든 행을 지운 다음 재시작하십시오.",
    "Hooks show validation error about matcher": "Hook에 matcher 관련 검증 오류가 표시됨",
    'Ensure you\'re on the latest version — the hook format was updated to use <code>matcher: "*"</code> string (not object).':
      '최신 버전을 사용하고 있는지 확인하세요 — 훅 형식이 <code>matcher: "*"</code> 문자열을 사용하도록 업데이트되었습니다(객체가 아님).',
    '"SQLite backend not available" on startup': '시작 시 "SQLite backend not available" 오류',
    "Neither <code>better-sqlite3</code> nor <code>node:sqlite</code> could load. Upgrade to Node.js 22+ (recommended), or install Python 3 + C++ build tools and run <code>npm rebuild better-sqlite3</code>.":
      "<code>better-sqlite3</code>와 <code>node:sqlite</code> 모두 로드할 수 없습니다. Node.js 22+로 업그레이드하거나(권장), Python 3와 C++ 빌드 도구를 설치한 후 <code>npm rebuild better-sqlite3</code>를 실행하세요.",
    "Docker container runs but no sessions appear":
      "Docker 컨테이너는 실행되지만 세션이 표시되지 않음",
    "Hooks run on the host, not inside the container. Run <code>npm run install-hooks</code> on the host after the container starts. Verify hooks in <code>~/.claude/settings.json</code> point to <code>localhost:4820</code>.":
      "훅은 컨테이너 내부가 아니라 호스트에서 실행됩니다. 컨테이너가 시작된 후 호스트에서 <code>npm run install-hooks</code>를 실행하세요. <code>~/.claude/settings.json</code>의 훅이 <code>localhost:4820</code>을 가리키는지 확인하세요.",
    Technology: "기술",
    "Why This Over Alternatives": "대안 대신 이것을 선택한 이유",
    "Zero-config, embedded, no server process. WAL mode gives concurrent reads. Synchronous API is simpler than async for this use case. <code>better-sqlite3</code> is preferred when prebuilds are available; falls back to Node.js built-in <code>node:sqlite</code> on Node 22+ when the native module cannot be compiled.":
      "설정이 필요 없고, 내장형이며, 별도의 서버 프로세스가 없습니다. WAL 모드는 동시 읽기를 지원합니다. 이 사용 사례에서는 동기 API가 비동기보다 더 단순합니다. 프리빌드가 제공되는 경우 <code>better-sqlite3</code>를 우선 사용하며, 네이티브 모듈을 컴파일할 수 없는 경우 Node 22+에 내장된 <code>node:sqlite</code>로 대체됩니다.",
    "Battle-tested, minimal, well-understood. Fastify would be overkill; raw <code>http</code> module would require too much boilerplate for routing.":
      "검증되었고, 최소한이며, 널리 이해되고 있습니다. Fastify는 과할 수 있고, 원시 <code>http</code> 모듈은 라우팅에 너무 많은 보일러플레이트 코드가 필요합니다.",
    "Fastest, most lightweight WebSocket library for Node. No Socket.IO overhead needed — we only push typed JSON messages one-way.":
      "Node에서 가장 빠르고 가벼운 WebSocket 라이브러리입니다. 타입이 지정된 JSON 메시지를 단방향으로 전송하기만 하므로 Socket.IO의 오버헤드가 필요하지 않습니다.",
    "Stable, widely known, strong TypeScript support. No Server Components or RSC needed for a client-rendered local SPA.":
      "안정적이고, 널리 알려져 있으며, TypeScript 지원이 뛰어납니다. 클라이언트 렌더링 방식의 로컬 SPA에는 Server Components나 RSC가 필요하지 않습니다.",
    "Fast builds, native ESM, excellent dev experience. Proxy config handles the dev server split cleanly with no ejection.":
      "빌드 속도가 빠르고, 네이티브 ESM을 지원하며, 개발 경험이 뛰어납니다. 프록시 설정이 개발 서버 분리를 이젝트(eject) 없이 깔끔하게 처리합니다.",
    "Utility-first approach keeps styles colocated with markup. No CSS module boilerplate. Custom dark theme config for the dark UI.":
      "유틸리티 우선 접근 방식으로 스타일을 마크업과 함께 배치할 수 있습니다. CSS 모듈 보일러플레이트가 필요 없습니다. 다크 UI를 위한 커스텀 다크 테마 설정을 제공합니다.",
    "Standard routing for React SPAs. Layout routes with <code>&lt;Outlet&gt;</code> give clean shell composition without prop drilling.":
      "React SPA를 위한 표준 라우팅입니다. <code>&lt;Outlet&gt;</code>을 사용한 레이아웃 라우트는 prop drilling 없이 깔끔한 셸 구성을 제공합니다.",
    "Tree-shakeable icon library — only imports what's used (~20 icons). No heavy icon font.":
      "트리 셰이킹이 가능한 아이콘 라이브러리로, 사용되는 아이콘만 임포트합니다(약 20개). 무거운 아이콘 폰트가 필요 없습니다.",
    "Catches null/undefined bugs at compile time. <code>noUncheckedIndexedAccess</code> prevents array bounds issues in analytics aggregations.":
      "컴파일 타임에 null/undefined 버그를 잡아냅니다. <code>noUncheckedIndexedAccess</code>는 분석 집계에서 배열 범위 문제를 방지합니다.",
    "Industry-standard data visualization library. Powers the Workflows page's 11 interactive sections — DAG layouts, Sankey diagrams, force-directed graphs, bubble charts, and swim-lane timelines. No wrapper libraries needed; direct SVG rendering keeps bundle impact minimal.":
      "업계 표준 데이터 시각화 라이브러리입니다. Workflows 페이지의 11개 인터랙티브 섹션(DAG 레이아웃, Sankey 다이어그램, force-directed 그래프, 버블 차트, 스윔레인 타임라인)을 구동합니다. 래퍼 라이브러리가 필요 없으며, 직접 SVG 렌더링으로 번들 크기에 미치는 영향을 최소화합니다.",
    "Available on virtually all systems. Handles ANSI and JSON natively with stdlib only. No install step required.":
      "거의 모든 시스템에서 사용할 수 있습니다. stdlib만으로 ANSI와 JSON을 네이티브하게 처리합니다. 별도의 설치 단계가 필요하지 않습니다.",
    "Local-first monitoring for Claude Code sessions, agents, and tool events. Built for real-time visibility with zero external dependencies.":
      "Claude Code 세션, 에이전트, 도구 이벤트를 위한 로컬 우선 모니터링입니다. 외부 의존성 없이 실시간 가시성을 제공하도록 구축되었습니다.",
    Install: "설치",
    Setup: "설정",
    "About the Creator": "제작자 소개",
    '<span class="caption-icon">⭐</span> <span> Enjoying the project? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer">Give it a star on GitHub</a> and help more builders discover it. </span>':
      '<span class="caption-icon">⭐</span> <span> 이 프로젝트가 마음에 드시나요? <a class="star-history-caption-link" href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor" target="_blank" rel="noopener noreferrer">GitHub에서 별을 눌러주시면</a> 더 많은 개발자가 이 프로젝트를 발견하는 데 도움이 됩니다. </span>',
    'Clears the waiting flag and promotes the main agent to <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>. The only reliable signal that text-only assistant turns have started — they emit no <code>PreToolUse</code> before <code>Stop</code>.':
      '대기 플래그를 해제하고 메인 에이전트를 <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span> 상태로 전환합니다. 텍스트 전용 어시스턴트 턴이 시작되었음을 알리는 유일하게 신뢰할 수 있는 신호입니다 — 이러한 턴은 <code>Stop</code> 이전에 <code>PreToolUse</code>를 전혀 발생시키지 않습니다.',
    'Clears the waiting flag, sets agent → <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>, <code>current_tool</code> set. If tool is <code>Agent</code>, subagent record created.':
      '대기 플래그를 해제하고, 에이전트를 <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span> 상태로 설정하며, <code>current_tool</code>을 설정합니다. 도구가 <code>Agent</code>인 경우 서브에이전트 레코드가 생성됩니다.',
    'Clears the waiting flag (covers permission-prompt approvals mid-tool). <code>current_tool</code> cleared. Agent stays <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span>.':
      '대기 플래그를 해제합니다(도구 실행 중 권한 프롬프트 승인 케이스 포함). <code>current_tool</code>이 지워집니다. 에이전트는 <span class="status-chip chip-working"><span class="chip-dot"></span>Working</span> 상태를 유지합니다.',
    'Non-error: main agent → <code>waiting</code> — UI shows <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span> until the next user input. <code>stop_reason=error</code>: marks the agent and session <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>. Background subagents keep running.':
      '오류가 아닌 경우: 메인 에이전트가 <code>waiting</code> 상태가 되며, UI는 다음 사용자 입력이 있을 때까지 <span class="status-chip chip-waiting"><span class="chip-dot"></span>Waiting</span>을 표시합니다. <code>stop_reason=error</code>인 경우: 에이전트와 세션을 <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>로 표시합니다. 백그라운드 서브에이전트는 계속 실행됩니다.',
    'Matched subagent → <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Deliberately does <strong>not</strong> clear the waiting flag — a backgrounded subagent finishing tells us nothing about the human. Also kicks off a fire-and-forget JSONL scan (<code>scanAndImportSubagents</code>) that walks the session\'s <code>subagents/agent-*.jsonl</code> files, pairs <code>tool_use</code> ↔ <code>tool_result</code> blocks by <code>tool_use_id</code>, and emits per-tool <code>PreToolUse</code> + <code>PostToolUse</code> events under each subagent\'s own <code>agent_id</code> — surfaces tool calls that subagents make internally and which never fire any hooks.':
      '일치하는 서브에이전트가 <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span> 상태가 됩니다. 대기 플래그는 의도적으로 <strong>해제하지 않습니다</strong> — 백그라운드 서브에이전트의 완료는 사용자(human)에 대해 아무것도 알려주지 않기 때문입니다. 또한 세션의 <code>subagents/agent-*.jsonl</code> 파일을 순회하며 <code>tool_use_id</code>로 <code>tool_use</code> ↔ <code>tool_result</code> 블록을 짝짓고, 각 서브에이전트 고유의 <code>agent_id</code> 아래에 도구별 <code>PreToolUse</code> + <code>PostToolUse</code> 이벤트를 발생시키는 fire-and-forget 방식의 JSONL 스캔(<code>scanAndImportSubagents</code>)도 시작합니다 — 서브에이전트가 내부적으로 수행하며 훅을 전혀 발생시키지 않는 도구 호출을 드러냅니다.',
    'Creates a compaction subagent → <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Detected via <code>isCompactSummary</code> entries in the transcript. Token baselines preserve pre-compaction totals. Periodic scanner (cadence ~¼ of <code>DASHBOARD_STALE_MINUTES</code>) catches compactions when no hooks fire.':
      '압축(compaction) 서브에이전트를 생성하여 <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span> 상태로 표시합니다. 트랜스크립트의 <code>isCompactSummary</code> 항목을 통해 감지됩니다. 토큰 기준값은 압축 이전의 합계를 보존합니다. 주기적 스캐너(주기는 <code>DASHBOARD_STALE_MINUTES</code>의 약 1/4)가 훅이 발생하지 않는 압축을 포착합니다.',
    'Drops the waiting flag. If the session is already in <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span>, the error state is preserved; otherwise marks all agents and the session as <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>. Evicts the session\'s transcript from the shared cache.':
      '대기 플래그를 해제합니다. 세션이 이미 <span class="status-chip chip-error"><span class="chip-dot"></span>Error</span> 상태라면 오류 상태를 유지하고, 그렇지 않으면 모든 에이전트와 세션을 <span class="status-chip chip-completed"><span class="chip-dot"></span>Completed</span>로 표시합니다. 공유 캐시에서 세션의 트랜스크립트를 제거합니다.',
    "SQLite connection, WAL/FK pragmas, schema migrations (<code>CREATE TABLE IF NOT EXISTS</code>), all prepared statements as a reusable <code>stmts</code> object. Tries <code>better-sqlite3</code> first, falls back to built-in <code>node:sqlite</code> via <code>compat-sqlite.js</code>":
      "SQLite 연결, WAL/FK 프래그마, 스키마 마이그레이션(<code>CREATE TABLE IF NOT EXISTS</code>), 재사용 가능한 <code>stmts</code> 객체로 관리되는 모든 프리페어드 스테이트먼트를 담당합니다. <code>better-sqlite3</code>를 먼저 시도하고, <code>compat-sqlite.js</code>를 통해 내장 <code>node:sqlite</code>로 대체됩니다.",
    "Each page pulls initial data from REST then subscribes to eventBus for live updates":
      "각 페이지는 REST에서 초기 데이터를 가져온 후 실시간 업데이트를 위해 eventBus를 구독합니다",
    "Entity Relationship Diagram — SQLite schema": "엔터티 관계 다이어그램 — SQLite 스키마",
    "Working Dir": "작업 디렉터리",
    "Git Branch": "Git 브랜치",
    "Context Bar": "컨텍스트 바",
    "Token Counts": "토큰 수",
    "Session Cost": "세션 비용",
    "Statusline rendering pipeline — invoked on each Claude Code update":
      "상태줄(Statusline) 렌더링 파이프라인 — Claude Code가 업데이트될 때마다 호출됨",
    "Aggregates data from multiple API endpoints to display high-signal metrics directly in the sidebar:":
      "여러 API 엔드포인트의 데이터를 집계하여 사이드바에 핵심 지표를 직접 표시합니다:",
    "Zero-Config Setup": "제로 설정(Zero-Config)",
    "One-line mental model": "한 줄로 정리하는 개념 모델",
    "Your data survives reinstalls and updates": "데이터는 재설치 및 업데이트 후에도 유지됩니다",
    "The <code>claude</code> CLI is found automatically":
      "<code>claude</code> CLI가 자동으로 감지됩니다",
    'Open <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Releases → latest </a> and download the asset for your platform. The macOS and Windows Desktop CI jobs auto-publish a new <code>vX.Y.Z</code> release every time the version in <code>package.json</code> is bumped on <code>master</code>, so this link always points at the current build. Releases are public — no GitHub sign-in required.':
      '<a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/releases/latest" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Releases → 최신 버전 </a> 링크를 열어 사용 중인 플랫폼에 맞는 에셋을 다운로드하세요. macOS 및 Windows Desktop CI 작업은 <code>master</code> 브랜치에서 <code>package.json</code>의 버전이 올라갈 때마다 새로운 <code>vX.Y.Z</code> 릴리스를 자동으로 게시하므로, 이 링크는 항상 최신 빌드를 가리킵니다. 릴리스는 공개되어 있으므로 GitHub 로그인이 필요하지 않습니다.',
    'Want a build straight off the tip of <code>master</code>, ahead of the next tagged release? Every green run of the <code>🍎 macOS Desktop (DMG)</code> job on <code>macos-latest</code> uploads the universal DMG as the <code>ClaudeCodeMonitor-dmg</code> workflow artifact, and the <code>🪟 Windows Desktop (EXE)</code> job on <code>windows-latest</code> uploads the installer + portable EXEs as the <code>ClaudeCodeMonitor-win</code> artifact. Open the <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> latest passing run </a>, scroll to its Artifacts section, and download <code>ClaudeCodeMonitor-dmg</code> or <code>ClaudeCodeMonitor-win</code>. (GitHub sign-in required; 14-day retention.)':
      '다음 태그 릴리스보다 앞선, <code>master</code>의 최신 커밋에서 곧바로 빌드한 버전을 원하시나요? <code>macos-latest</code>에서 실행되는 <code>🍎 macOS Desktop (DMG)</code> 작업이 성공할 때마다 유니버설 DMG가 <code>ClaudeCodeMonitor-dmg</code> 워크플로 아티팩트로 업로드되고, <code>windows-latest</code>에서 실행되는 <code>🪟 Windows Desktop (EXE)</code> 작업은 인스톨러와 포터블 EXE를 <code>ClaudeCodeMonitor-win</code> 아티팩트로 업로드합니다. <a href="https://github.com/hoangsonww/Claude-Code-Agent-Monitor/actions/workflows/ci.yml?query=branch%3Amaster+is%3Asuccess" target="_blank" rel="noopener noreferrer" class="dl-chip"> <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline></svg> 최근 성공한 실행 </a> 페이지를 열어 Artifacts 섹션까지 스크롤한 다음 <code>ClaudeCodeMonitor-dmg</code> 또는 <code>ClaudeCodeMonitor-win</code>을 다운로드하세요. (GitHub 로그인 필요, 14일간 보관.)',
    "Incoming Webhook URL": "수신 웹훅 URL",
    "Webhook URL": "웹훅 URL",
    "Detection pipeline from scheduler to UI": "스케줄러에서 UI까지 이어지는 감지 파이프라인",
    "A shell-less <code>git fetch</code> with a 120-second timeout, followed by a <code>rev-list</code> against the tracked upstream. Each call runs from <code>server/lib/update-check.js</code> and returns a structured payload — never throws — so a flaky remote can't stall the dashboard.":
      "셸을 거치지 않는(shell-less) <code>git fetch</code>를 120초 타임아웃으로 실행한 뒤, 추적 중인 업스트림을 대상으로 <code>rev-list</code>를 수행합니다. 각 호출은 <code>server/lib/update-check.js</code>에서 실행되며 구조화된 페이로드를 반환합니다 — 절대 예외를 던지지 않으므로 원격 저장소가 불안정하더라도 대시보드가 멈추지 않습니다.",
    "Detection-only by design": "설계상 감지 전용",
    "Adding a language": "언어 추가하기",
    "<strong>Ask box:</strong> answers simple status questions locally from cached data (“what's running”, “any errors”, “status”).":
      "<strong>Ask 박스:</strong> 캐시된 데이터를 기반으로 로컬에서 간단한 상태 질문에 답합니다(“무엇이 실행 중인가요”, “오류가 있나요”, “상태”).",
    "A third way to run: the Desktop App (macOS &amp; Windows)":
      "실행하는 세 번째 방법: 데스크톱 앱(macOS 및 Windows)",
    "Hooks still run on the host": "훅은 여전히 호스트에서 실행됩니다",
    "Hook note": "훅 참고 사항",
    "SQL injection": "SQL 인젝션",
    "All queries use prepared statements with parameterized values — no string interpolation":
      "모든 쿼리는 매개변수화된 값을 사용하는 프리페어드 스테이트먼트를 사용합니다 — 문자열 보간을 사용하지 않습니다",
    "Request size": "요청 크기",
    "Express JSON body parser limited to 1MB": "Express JSON 본문 파서는 1MB로 제한됩니다",
    "Dashboard — stats, active agents, recent events":
      "Dashboard — 통계, 활성 에이전트, 최근 이벤트",
    "KanbanBoard — agent status columns": "KanbanBoard — 에이전트 상태별 열",
    "Sessions — searchable, filterable table": "Sessions — 검색 및 필터링이 가능한 테이블",
    "SessionDetail — agents + full event timeline":
      "SessionDetail — 에이전트 및 전체 이벤트 타임라인",
    "ActivityFeed — real-time streaming event log": "ActivityFeed — 실시간 스트리밍 이벤트 로그",
    "Analytics — token usage, heatmap (day-of-week aligned), tool charts, donut charts":
      "Analytics — 토큰 사용량, 히트맵(요일별 정렬), 도구 차트, 도넛 차트",
    "Workflows — D3.js visualizations, cross-filtering, status filter, session drill-in":
      "Workflows — D3.js 시각화, 교차 필터링, 상태 필터, 세션 드릴인",
    "Settings — model pricing, hook status, data export, session cleanup":
      "Settings — 모델 가격, 훅 상태, 데이터 내보내기, 세션 정리",
    'Returns <code>{ "status": "ok", "timestamp": "..." }</code>':
      '<code>{ "status": "ok", "timestamp": "..." }</code>를 반환합니다',
    "List sessions with agent counts and per-session cost. Params: <code>status</code>, <code>q</code> (case-insensitive search across <code>id</code>/<code>name</code>/<code>cwd</code>), <code>limit</code> (default 50, max 10000), <code>offset</code>. Response includes <code>total</code> for paginators.":
      "에이전트 수와 세션별 비용을 포함하여 세션 목록을 조회합니다. 매개변수: <code>status</code>, <code>q</code>(<code>id</code>/<code>name</code>/<code>cwd</code>에 대한 대소문자 구분 없는 검색), <code>limit</code>(기본값 50, 최대 10000), <code>offset</code>. 응답에는 페이지네이션을 위한 <code>total</code>이 포함됩니다.",
    "Session detail with agents and events": "에이전트와 이벤트를 포함한 세션 상세 정보",
    "Create session (idempotent on <code>id</code>)": "세션 생성(<code>id</code> 기준 멱등적)",
    "Update session status / metadata": "세션 상태/메타데이터 업데이트",
    "List agents — params: <code>status</code>, <code>session_id</code>, <code>limit</code>, <code>offset</code>":
      "에이전트 목록 조회 — 매개변수: <code>status</code>, <code>session_id</code>, <code>limit</code>, <code>offset</code>",
    "Single agent detail": "단일 에이전트 상세 정보",
    "Create agent": "에이전트 생성",
    "Update agent status / task / current_tool": "에이전트 상태/작업/current_tool 업데이트",
    "List events newest-first — params: <code>session_id</code>, <code>limit</code>, <code>offset</code>":
      "최신순으로 이벤트 목록 조회 — 매개변수: <code>session_id</code>, <code>limit</code>, <code>offset</code>",
    "Aggregate counts + status distributions + WS connections":
      "집계된 카운트, 상태 분포, WS 연결 수",
    "Token totals, tool usage, daily trends, agent types, event types, averages":
      "토큰 합계, 도구 사용량, 일별 추세, 에이전트 유형, 이벤트 유형, 평균값",
    "Receive and process a Claude Code hook event (called by hook-handler.js)":
      "Claude Code 훅 이벤트를 수신하고 처리합니다(hook-handler.js에서 호출)",
    "List all model pricing rules": "모든 모델 가격 규칙 조회",
    "Create or update a pricing rule": "가격 규칙 생성 또는 업데이트",
    "Delete a pricing rule": "가격 규칙 삭제",
    "Total cost across all sessions": "모든 세션에 대한 총 비용",
    "Cost breakdown for a specific session": "특정 세션의 비용 내역",
    "System info, DB stats, hook installation status": "시스템 정보, DB 통계, 훅 설치 상태",
    "Delete all sessions, agents, events, token usage":
      "모든 세션, 에이전트, 이벤트, 토큰 사용량 삭제",
    "Reinstall Claude Code hooks": "Claude Code 훅 재설치",
    "Reset pricing rules to defaults": "가격 규칙을 기본값으로 재설정",
    "Export all data as JSON download": "모든 데이터를 JSON 파일로 내보내기",
    "Abandon stale sessions (by hours), purge old data (by days)":
      "오래된 세션 중단 처리(시간 단위), 오래된 데이터 삭제(일 단위)",
    "OS-aware paths, archive command, supported extensions, step-by-step instructions; includes live stats for the default <code>~/.claude/projects</code> folder":
      "OS별 경로, 아카이브 명령어, 지원되는 확장자, 단계별 안내를 제공합니다. 기본 <code>~/.claude/projects</code> 폴더에 대한 실시간 통계도 포함됩니다",
    "Re-scan the default <code>~/.claude/projects</code> directory; safe to re-run (idempotent via session-ID dedup)":
      "기본 <code>~/.claude/projects</code> 디렉터리를 다시 스캔합니다. 세션 ID 기반 중복 제거로 멱등적이므로 반복 실행해도 안전합니다",
    "Scan any absolute directory (body <code>{ path }</code>); tilde (<code>~</code>) is expanded; walks subdirectories recursively and imports every <code>.jsonl</code> found":
      "임의의 절대 경로 디렉터리를 스캔합니다(요청 본문 <code>{ path }</code>). 물결표(<code>~</code>)는 확장되며, 하위 디렉터리를 재귀적으로 순회하여 발견되는 모든 <code>.jsonl</code> 파일을 임포트합니다",
    "Multipart upload of <code>.jsonl</code>, <code>.meta.json</code>, <code>.zip</code>, <code>.tar</code>, <code>.tar.gz</code>, <code>.tgz</code>, <code>.gz</code>. Per-request staging dir, path-traversal and extraction-size guards. Returns 413 <code>EXTRACTION_LIMIT_EXCEEDED</code> on suspected bomb archives":
      "<code>.jsonl</code>, <code>.meta.json</code>, <code>.zip</code>, <code>.tar</code>, <code>.tar.gz</code>, <code>.tgz</code>, <code>.gz</code> 파일의 멀티파트 업로드를 지원합니다. 요청별 스테이징 디렉터리, 경로 순회(path-traversal) 및 압축 해제 크기 방어 기능이 있습니다. 압축 폭탄(bomb archive)으로 의심되는 경우 413 <code>EXTRACTION_LIMIT_EXCEEDED</code>를 반환합니다",
    "Aggregate workflow data — orchestration graphs, tool flows, effectiveness, patterns, model delegation, error propagation, concurrency, complexity, compaction impact. Accepts <code>?status=active|completed</code> query param to filter by workflow status":
      "워크플로 데이터를 집계합니다 — 오케스트레이션 그래프, 도구 흐름, 효과성, 패턴, 모델 위임, 오류 전파, 동시성, 복잡도, 압축 영향 등을 포함합니다. 워크플로 상태로 필터링하기 위한 <code>?status=active|completed</code> 쿼리 매개변수를 지원합니다",
    "Per-session drill-in — agent tree, tool timeline, event details":
      "세션별 드릴인 — 에이전트 트리, 도구 타임라인, 이벤트 상세 정보",
    "Fired-alert feed, newest first (<code>?unacked=true</code>, <code>limit</code>, <code>offset</code>; carries <code>total</code> and <code>unacked</code> counts)":
      "발생한 알림 피드를 최신순으로 조회합니다(<code>?unacked=true</code>, <code>limit</code>, <code>offset</code>; <code>total</code> 및 <code>unacked</code> 개수를 포함)",
    "Acknowledge one alert": "알림 하나 확인 처리",
    "Acknowledge every unacked alert": "확인되지 않은 모든 알림 확인 처리",
    "List alert rules": "알림 규칙 목록 조회",
    "Create a rule (<code>event_pattern</code> | <code>inactivity</code> | <code>status_duration</code> | <code>token_threshold</code>)":
      "규칙 생성(<code>event_pattern</code> | <code>inactivity</code> | <code>status_duration</code> | <code>token_threshold</code>)",
    "Update name / config / enabled / cooldown": "이름/설정/활성화 여부/쿨다운 업데이트",
    "Delete a rule and its fired-alert history": "규칙과 해당 알림 발생 이력 삭제",
    "Supported providers + their config fields (drives the UI form)":
      "지원되는 제공업체 및 해당 설정 필드 목록(UI 폼을 구성하는 데 사용됨)",
    "List webhook targets (URLs masked, secrets redacted)":
      "웹훅 대상 목록 조회(URL은 마스킹, 시크릿은 삭제 표시됨)",
    "Create a target — 14 first-class providers (Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream) + a generic JSON endpoint":
      "대상 생성 — 14개의 기본 지원 제공업체(Slack, Discord, Teams, Google Chat, Mattermost, Rocket.Chat, Telegram, PagerDuty, Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream)와 범용 JSON 엔드포인트를 지원합니다",
    "Update name / url / enabled / secret / headers / config / rule scope (<code>type</code> is immutable)":
      "이름/URL/활성화 여부/시크릿/헤더/설정/규칙 범위 업데이트(<code>type</code>은 변경 불가)",
    "Delete a target and its delivery log": "대상과 해당 전송 로그 삭제",
    "Send a synthetic test alert and report the result":
      "테스트용 알림을 전송하고 결과를 보고합니다",
    "Recent delivery log for a target": "대상에 대한 최근 전송 로그",
    Documentation: "문서",
    Architecture: "아키텍처",
    "Relevant Links": "관련 링크",
    "GitHub Repo": "GitHub 저장소",
    '<span class="caption-icon">🔔</span> <span><strong>Settings · Alerts</strong> — rules-based alerting engine and outbound webhooks in one place: alert rules (event pattern / inactivity / stuck agent / token threshold) with per-rule cooldown, a live fired-alert feed, and 14 first-class webhook providers plus a generic JSON endpoint with optional HMAC signing</span>':
      '<span class="caption-icon">🔔</span> <span><strong>Settings · Alerts</strong> — 규칙 기반 알림 엔진과 아웃바운드 웹훅을 한곳에서 관리합니다: 규칙별 쿨다운이 설정된 알림 규칙(이벤트 패턴 / 비활성 / 정체된 에이전트 / 토큰 임계값), 실시간 알림 발생 피드, 그리고 선택적 HMAC 서명을 지원하는 14개의 기본 지원 웹훅 제공업체와 범용 JSON 엔드포인트를 제공합니다</span>',
    '<span class="caption-icon">📗</span> <span><strong>API Docs · ReDoc</strong> — a self-hosted, read-optimized rendering of the full OpenAPI 3.0 spec at <code>/api/redoc</code>, served entirely offline with no CDN. Complements the interactive Swagger UI at <code>/api/docs</code>; every backend route is documented with parameters, schemas, and examples</span>':
      '<span class="caption-icon">📗</span> <span><strong>API Docs · ReDoc</strong> — <code>/api/redoc</code>에서 제공되는, 읽기에 최적화된 자체 호스팅 방식의 전체 OpenAPI 3.0 스펙 렌더링으로, CDN 없이 완전히 오프라인에서 제공됩니다. <code>/api/docs</code>의 인터랙티브 Swagger UI를 보완하며, 모든 백엔드 라우트가 매개변수, 스키마, 예제와 함께 문서화되어 있습니다</span>',
    '<span class="caption-icon">📘</span> <span><strong>API Docs · Swagger UI</strong> — interactive OpenAPI 3.0 playground at <code>/api/docs</code>: collapsible endpoint groups, request/response schemas, auth headers, and try-it-out request execution against the live local server</span>':
      '<span class="caption-icon">📘</span> <span><strong>API Docs · Swagger UI</strong> — <code>/api/docs</code>에서 제공되는 인터랙티브 OpenAPI 3.0 플레이그라운드로, 접고 펼칠 수 있는 엔드포인트 그룹, 요청/응답 스키마, 인증 헤더, 그리고 실제 로컬 서버에 대해 실행해볼 수 있는 try-it-out 기능을 제공합니다</span>',
    '<span class="caption-icon">📗</span> <span>ReDoc at <code>/api/redoc</code> — a self-hosted, read-optimized three-panel rendering of the same OpenAPI spec: deep-linkable sections, search, and full schema/example detail. Works entirely offline (no CDN)</span>':
      '<span class="caption-icon">📗</span> <span><code>/api/redoc</code>의 ReDoc — 동일한 OpenAPI 스펙을 읽기에 최적화된 3단 패널로 자체 호스팅하여 렌더링합니다: 딥링크 가능한 섹션, 검색, 그리고 전체 스키마/예제 상세 정보를 제공합니다. CDN 없이 완전히 오프라인에서 동작합니다</span>',
    '<span class="caption-icon">🔔</span> Settings · Alerts — the rules-based alerting engine, a live fired-alert feed, and outbound webhook channels (14 first-class providers + a generic JSON endpoint) managed together in one place':
      '<span class="caption-icon">🔔</span> Settings · Alerts — 규칙 기반 알림 엔진, 실시간 알림 발생 피드, 그리고 아웃바운드 웹훅 채널(14개의 기본 지원 제공업체 + 범용 JSON 엔드포인트)을 한곳에서 함께 관리합니다',
    'Surfaces "dynamic workflows" — the fleets of sub-agents spawned by the <code>Workflow</code> tool and self-paced <code>/loop</code> runs. These emit no hooks, so they are reconstructed from the on-disk run journal written when a workflow finishes (<code>workflows/wf_&lt;runId&gt;.json</code>) plus the inner <code>subagents/agent-*.jsonl</code> transcripts. Each run shows its phases and a per-agent token / tool-call / duration breakdown; a running workflow is detected from its launch script before the journal exists. Runs appear in a panel on the Workflows page and as a linked subsection on each session.':
      '"동적 워크플로(dynamic workflows)" — <code>Workflow</code> 도구와 자체 페이싱되는 <code>/loop</code> 실행에 의해 생성되는 서브에이전트 플릿(fleet)을 표시합니다. 이들은 훅을 전혀 발생시키지 않으므로, 워크플로가 완료될 때 기록되는 온디스크 실행 저널(<code>workflows/wf_&lt;runId&gt;.json</code>)과 내부 <code>subagents/agent-*.jsonl</code> 트랜스크립트로부터 재구성됩니다. 각 실행은 자신의 단계(phase)와 에이전트별 토큰/도구 호출/소요 시간 내역을 보여주며, 실행 중인 워크플로는 저널이 생성되기 전에도 실행 스크립트를 통해 감지됩니다. 실행 내역은 Workflows 페이지의 패널과 각 세션에 연결된 하위 섹션으로 표시됩니다.',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs</strong> — "dynamic workflows" spawned by the Workflow tool, reconstructed from on-disk run journals: status, agent count, tokens, and tool calls, expandable into a per-agent breakdown (phase, state, tokens, tools, duration) with humanized result previews</span>':
      '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs</strong> — Workflow 도구에 의해 생성되고 온디스크 실행 저널로부터 재구성되는 "동적 워크플로": 상태, 에이전트 수, 토큰, 도구 호출을 보여주며, 사람이 읽기 쉬운 결과 미리보기와 함께 에이전트별 내역(단계, 상태, 토큰, 도구, 소요 시간)으로 펼쳐볼 수 있습니다</span>',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · in a session</strong> — the same fleets linked to their launching session, so a session\'s dynamic-workflow sub-agents and their folded-in token cost are visible inline</span>':
      '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · in a session</strong> — 동일한 플릿을 이를 실행한 세션에 연결하여, 세션의 동적 워크플로 서브에이전트와 그에 포함된 토큰 비용을 인라인으로 확인할 수 있습니다</span>',
    '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · expanded</strong> — a run opened up: clickable color-coded phase filters, the per-agent metrics table, and a full list of clickable result items that expand to each agent\'s complete prompt and result</span>':
      '<span class="caption-icon">🧬</span> <span><strong>Workflow Runs · expanded</strong> — 펼쳐본 실행 화면: 클릭 가능한 색상별 단계 필터, 에이전트별 지표 테이블, 그리고 클릭하면 각 에이전트의 전체 프롬프트와 결과로 펼쳐지는 결과 항목 전체 목록을 제공합니다</span>',
  },
  plain: {
    zh: {
      "System Overview": "系统概览",
      "What's Included": "包含哪些内容",
      "Live Dashboard": "实时仪表盘",
      "Kanban Board": "看板",
      "Sessions Table": "会话表格",
      "Session Detail": "会话详情",
      "Alerts & Webhooks": "告警与 Webhook",
      "Desktop App (macOS & Windows)": "桌面应用（macOS 和 Windows）",
      "Activity Feed": "活动流",
      Analytics: "分析",
      "WebSocket Push": "WebSocket 推送",
      Statusline: "状态栏",
      "History Import": "历史导入",
      "Transcript Cache": "Transcript 缓存",
      "Bounded Cache Memory": "有界的缓存内存",
      "Constant-Time Sweep": "常数时间扫描",
      "Subagent Hierarchy": "子智能体层级",
      "Cost Tracking": "成本跟踪",
      "Settings & Management": "设置与管理",
      "Local MCP Server": "本地 MCP 服务器",
      "Claude + Codex Extensions": "Claude + Codex 扩展",
      "Workflow Graphs": "工作流图",
      "Workflow Analytics": "工作流分析",
      "Session Drill-In": "会话深入",
      "Browser Notifications": "浏览器通知",
      "Docker Deployment": "Docker 部署",
      "Plugin Marketplace": "插件市场",
      "Run Claude": "运行 Claude",
      "Claude Config Explorer": "Claude 配置浏览器",
      "Responsive Design": "响应式设计",
      "Concurrency Timeline": "并发时间线",
      "VS Code Extension": "VS Code 扩展",
      "Error Propagation Map": "错误传播图",
      "Progressive Web App": "渐进式 Web 应用",
      "Fresh-by-Default Caching": "默认保持最新的缓存",
      "Auto-Reload on Update": "更新时自动重新加载",
      Screenshots: "屏幕截图",
      "GitHub Star History": "GitHub Star 历史",
      "Hook Events Captured": "捕获的 Hook 事件",
      "Quick Start": "快速开始",
      Clone: "克隆",
      Install: "安装",
      Start: "启动",
      "Use Claude": "使用 Claude",
      "Alternative: Docker / Podman": "备选方案：Docker / Podman",
      "Optional: Enable MCP and Agent Extensions": "可选：启用 MCP 与 Agent 扩展",
      Verification: "验证",
      Configuration: "配置",
      "Environment Variables": "环境变量",
      "Hook Configuration": "Hook 配置",
      "Scripts Reference": "脚本参考",
      "System Architecture": "系统架构",
      "Agent State Machine": "Agent 状态机",
      "Session State Machine": "会话状态机",
      "Data Flow": "数据流",
      "Event Ingestion Pipeline": "事件摄取流水线",
      "Client Data Loading Pattern": "客户端数据加载模式",
      "Server Architecture": "服务器架构",
      "Server Modules": "服务器模块",
      "Client Architecture": "客户端架构",
      "Client Routes": "客户端路由",
      "Key Client Modules": "关键客户端模块",
      "PWA & Service Worker": "PWA 与 Service Worker",
      "State Management": "状态管理",
      "Database Design": "数据库设计",
      Indexes: "索引",
      "SQLite Configuration": "SQLite 配置",
      "API Reference": "API 参考",
      Health: "健康检查",
      Sessions: "会话",
      Agents: "代理",
      "Events, Stats, Analytics": "事件、统计、分析",
      "Hooks Ingestion": "Hook 摄取",
      Pricing: "定价",
      Settings: "设置",
      "Import History": "导入历史",
      Workflows: "工作流",
      Alerts: "告警",
      Webhooks: "Webhooks",
      "WebSocket Protocol": "WebSocket 协议",
      "Message Envelope": "消息封装",
      "Hook Integration": "Hook 集成",
      "Hook Handler Design": "Hook 处理器设计",
      "Hook Installation Flow": "Hook 安装流程",
      "Import Pipeline": "导入管道",
      "Three Modes, One Pipeline": "三种模式，一条流水线",
      "Upload Request Sequence": "上传请求序列",
      "Idempotence & Cost Accuracy": "幂等性与成本准确性",
      "Supported Source Layouts": "支持的源布局",
      "Safety Model": "安全模型",
      "WebSocket Progress Events": "WebSocket 进度事件",
      "MCP & Agent Extensions": "MCP 与智能体扩展",
      "Local MCP Server Runtime": "本地 MCP 服务器运行时",
      "Agent Extension Layout": "智能体扩展布局",
      "Root Helper Scripts": "根目录辅助脚本",
      Installation: "安装",
      "Available Plugins": "可用插件",
      "Skill Usage Examples": "技能使用示例",
      "CLI Tools": "CLI 工具",
      "Plugin Architecture": "插件架构",
      "Data Model Reference": "数据模型参考",
      "Statusline Utility": "状态栏工具",
      "Detailed Components": "详细组件",
      "In-Process Architecture": "进程内架构",
      "What It Adds": "它带来了什么",
      "Menu-Bar / Notification-Area (Tray) Icon": "菜单栏 / 通知区域（托盘）图标",
      "Native Application Menu": "原生应用菜单",
      "Auto-Start at Login": "登录时自动启动",
      "Close Hides, Server Stays Up": "关闭即隐藏，服务器保持运行",
      "Runs Alongside the Web Dashboard": "与 Web 仪表盘并行运行",
      "Single-Instance Lock": "单实例锁",
      "First-Boot Bootstrap": "首次启动引导",
      "Data Persistence & CLI Reliability": "数据持久化与 CLI 可靠性",
      "Port Discovery": "端口发现",
      "How to Get It": "如何获取",
      "Option A — download the latest GitHub Release (recommended)":
        "选项 A — 下载最新的 GitHub Release（推荐）",
      "Option B — per-commit CI artifact": "选项 B——按提交的 CI 制品",
      "Option C — build locally": "选项 C——本地构建",
      macOS: "macOS",
      "Open the DMG": "打开 DMG",
      "Drag to Applications": "拖入 Applications",
      "Clear Quarantine": "清除隔离属性",
      Launch: "启动",
      Windows: "Windows",
      "Run the Installer": "运行安装程序",
      "Clear SmartScreen": "清除 SmartScreen 拦截",
      "Settings Page": "设置页面",
      "Model Pricing": "模型定价",
      "Data Management": "数据管理",
      "Data Export": "数据导出",
      "System Health": "系统健康",
      "Notification Preferences": "通知偏好",
      "Rule types": "规则类型",
      "Evaluation engine": "评估引擎",
      "14 first-class providers": "14 个一流提供方",
      "Delivery engine": "投递引擎",
      Security: "安全",
      "Guided setup": "引导式设置",
      "Provider payloads": "提供方载荷",
      "Update Notifier": "Update Notifier",
      "Non-Blocking Detection": "非阻塞检测",
      "5-min Scheduler": "5 分钟调度器",
      "Situation-Aware Command": "情境感知命令",
      "Two UI Surfaces": "两个 UI 界面",
      "Soft Failure Semantics": "软失败语义",
      "Dismissal Memory": "忽略记忆",
      "API Surface": "API 接口",
      "Connection Status": "Connection Status",
      "Internationalization (i18n)": "国际化（i18n）",
      "Namespaced resources": "命名空间化的资源",
      "Detection & fallback": "检测与回退",
      "Locale-aware formatting": "区域感知的格式化",
      "Technical terms preserved": "保留技术术语",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — 响应式猫咪伙伴",
      "Reactive Mascot — Eight Moods": "响应式吉祥物——八种心情",
      "Auto-Surface Speech Bubbles": "自动弹出对话气泡",
      "The ⌘B Panel": "⌘B 面板",
      "Ask → Run Claude Handoff": "Ask → Run Claude 移交",
      "Accessibility & Resilience": "无障碍与韧性",
      "Deployment Modes": "部署模式",
      "Container Runtime (Docker / Podman)": "容器运行时（Docker / Podman）",
      "Docker / Podman": "Docker / Podman",
      "Plain Docker / Podman (no Compose)": "纯 Docker / Podman（不使用 Compose）",
      "Volume Mounts": "卷挂载",
      "Multi-Stage Build": "多阶段构建",
      "Performance Characteristics": "性能特征",
      Troubleshooting: "故障排查",
      "No sessions appearing after starting Claude Code": "启动 Claude Code 后没有出现会话",
      "Check 1 — Is the server running?": "检查 1——服务器在运行吗？",
      "Check 2 — Are hooks installed?": "检查 2——Hook 是否已安装？",
      "Check 3 — Start a new Claude Code session": "检查 3——启动一个新的 Claude Code 会话",
      "Check 4 — Is Node.js in PATH?": "检查 4——Node.js 是否在 PATH 中？",
      "Common Issues": "常见问题",
      "Technology Choices": "技术选型",
      "Workflow Runs": "工作流运行",
    },
    vi: {
      "System Overview": "Tổng quan hệ thống",
      "What's Included": "Bao gồm những gì",
      "Live Dashboard": "Bảng điều khiển trực tiếp",
      "Kanban Board": "Bảng Kanban",
      "Sessions Table": "Bảng phiên",
      "Session Detail": "Chi tiết phiên",
      "Alerts & Webhooks": "Cảnh báo & Webhook",
      "Desktop App (macOS & Windows)": "Ứng dụng máy tính để bàn (macOS & Windows)",
      "Activity Feed": "Luồng hoạt động",
      Analytics: "Phân tích",
      "WebSocket Push": "Đẩy qua WebSocket",
      Statusline: "Thanh trạng thái",
      "History Import": "Nhập lịch sử",
      "Transcript Cache": "Cache transcript",
      "Bounded Cache Memory": "Bộ nhớ cache có giới hạn",
      "Constant-Time Sweep": "Quét thời gian hằng số",
      "Subagent Hierarchy": "Phân cấp subagent",
      "Cost Tracking": "Theo dõi chi phí",
      "Settings & Management": "Cài đặt & Quản lý",
      "Local MCP Server": "Máy chủ MCP cục bộ",
      "Claude + Codex Extensions": "Tiện ích mở rộng Claude + Codex",
      "Workflow Graphs": "Đồ thị quy trình",
      "Workflow Analytics": "Phân tích quy trình",
      "Session Drill-In": "Đào sâu phiên",
      "Browser Notifications": "Thông báo trình duyệt",
      "Docker Deployment": "Triển khai Docker",
      "Plugin Marketplace": "Chợ Plugin",
      "Run Claude": "Chạy Claude",
      "Claude Config Explorer": "Trình khám phá cấu hình Claude",
      "Responsive Design": "Thiết kế đáp ứng",
      "Concurrency Timeline": "Dòng thời gian đồng thời",
      "VS Code Extension": "Tiện ích mở rộng VS Code",
      "Error Propagation Map": "Bản đồ lan truyền lỗi",
      "Progressive Web App": "Ứng dụng Web Tiến bộ",
      "Fresh-by-Default Caching": "Bộ nhớ đệm luôn mới mặc định",
      "Auto-Reload on Update": "Tự động tải lại khi cập nhật",
      Screenshots: "Ảnh chụp màn hình",
      "GitHub Star History": "Lịch sử Star trên GitHub",
      "Hook Events Captured": "Các sự kiện Hook được ghi nhận",
      "Quick Start": "Bắt đầu nhanh",
      Clone: "Sao chép",
      Install: "Cài đặt",
      Start: "Khởi động",
      "Use Claude": "Dùng Claude",
      "Alternative: Docker / Podman": "Phương án thay thế: Docker / Podman",
      "Optional: Enable MCP and Agent Extensions": "Tùy chọn: Bật MCP và các phần mở rộng Agent",
      Verification: "Xác minh",
      Configuration: "Cấu hình",
      "Environment Variables": "Biến môi trường",
      "Hook Configuration": "Cấu hình Hook",
      "Scripts Reference": "Tham chiếu Scripts",
      "System Architecture": "Kiến trúc hệ thống",
      "Agent State Machine": "Máy trạng thái của Agent",
      "Session State Machine": "Máy trạng thái của phiên",
      "Data Flow": "Luồng dữ liệu",
      "Event Ingestion Pipeline": "Pipeline thu nhận sự kiện",
      "Client Data Loading Pattern": "Mẫu tải dữ liệu phía client",
      "Server Architecture": "Kiến trúc máy chủ",
      "Server Modules": "Các module máy chủ",
      "Client Architecture": "Kiến trúc client",
      "Client Routes": "Các route phía client",
      "Key Client Modules": "Các mô-đun client chính",
      "PWA & Service Worker": "PWA & Service Worker",
      "State Management": "Quản lý trạng thái",
      "Database Design": "Thiết kế cơ sở dữ liệu",
      Indexes: "Chỉ mục",
      "SQLite Configuration": "Cấu hình SQLite",
      "API Reference": "Tài liệu tham khảo API",
      Health: "Tình trạng",
      Sessions: "Phiên",
      Agents: "Agent",
      "Events, Stats, Analytics": "Sự kiện, Thống kê, Phân tích",
      "Hooks Ingestion": "Thu nạp Hook",
      Pricing: "Định giá",
      Settings: "Cài đặt",
      "Import History": "Nhập lịch sử",
      Workflows: "Quy trình làm việc",
      Alerts: "Cảnh báo",
      Webhooks: "Webhooks",
      "WebSocket Protocol": "Giao thức WebSocket",
      "Message Envelope": "Vỏ bọc thông điệp",
      "Hook Integration": "Tích hợp Hook",
      "Hook Handler Design": "Thiết kế bộ xử lý Hook",
      "Hook Installation Flow": "Luồng cài đặt Hook",
      "Import Pipeline": "Đường ống nhập",
      "Three Modes, One Pipeline": "Ba chế độ, một đường ống",
      "Upload Request Sequence": "Trình tự yêu cầu tải lên",
      "Idempotence & Cost Accuracy": "Tính idempotent và độ chính xác chi phí",
      "Supported Source Layouts": "Các bố cục nguồn được hỗ trợ",
      "Safety Model": "Mô hình an toàn",
      "WebSocket Progress Events": "Sự kiện tiến trình WebSocket",
      "MCP & Agent Extensions": "MCP và phần mở rộng tác tử",
      "Local MCP Server Runtime": "Runtime máy chủ MCP cục bộ",
      "Agent Extension Layout": "Bố cục phần mở rộng tác tử",
      "Root Helper Scripts": "Các script trợ giúp ở thư mục gốc",
      Installation: "Cài đặt",
      "Available Plugins": "Các plugin có sẵn",
      "Skill Usage Examples": "Ví dụ sử dụng kỹ năng",
      "CLI Tools": "Công cụ CLI",
      "Plugin Architecture": "Kiến trúc plugin",
      "Data Model Reference": "Tham chiếu mô hình dữ liệu",
      "Statusline Utility": "Tiện ích Statusline",
      "Detailed Components": "Các thành phần chi tiết",
      "In-Process Architecture": "Kiến trúc trong tiến trình",
      "What It Adds": "Những gì nó bổ sung",
      "Menu-Bar / Notification-Area (Tray) Icon":
        "Biểu tượng thanh menu / khu vực thông báo (khay)",
      "Native Application Menu": "Menu ứng dụng gốc",
      "Auto-Start at Login": "Tự động khởi động khi đăng nhập",
      "Close Hides, Server Stays Up": "Đóng để ẩn, máy chủ vẫn chạy",
      "Runs Alongside the Web Dashboard": "Chạy song song với bảng điều khiển web",
      "Single-Instance Lock": "Khóa một thực thể",
      "First-Boot Bootstrap": "Khởi động bootstrap lần đầu",
      "Data Persistence & CLI Reliability": "Tính bền vững của dữ liệu & độ tin cậy của CLI",
      "Port Discovery": "Phát hiện cổng",
      "How to Get It": "Cách lấy nó",
      "Option A — download the latest GitHub Release (recommended)":
        "Tùy chọn A — tải xuống GitHub Release mới nhất (khuyến nghị)",
      "Option B — per-commit CI artifact": "Phương án B — artifact CI theo từng commit",
      "Option C — build locally": "Phương án C — dựng cục bộ",
      macOS: "macOS",
      "Open the DMG": "Mở DMG",
      "Drag to Applications": "Kéo vào Applications",
      "Clear Quarantine": "Xóa thuộc tính cách ly",
      Launch: "Khởi chạy",
      Windows: "Windows",
      "Run the Installer": "Chạy trình cài đặt",
      "Clear SmartScreen": "Vượt qua SmartScreen",
      "Settings Page": "Trang Cài đặt",
      "Model Pricing": "Giá theo mô hình",
      "Data Management": "Quản lý dữ liệu",
      "Data Export": "Xuất dữ liệu",
      "System Health": "Sức khỏe hệ thống",
      "Notification Preferences": "Tùy chọn thông báo",
      "Rule types": "Các loại quy tắc",
      "Evaluation engine": "Bộ máy đánh giá",
      "14 first-class providers": "14 nhà cung cấp hạng nhất",
      "Delivery engine": "Bộ máy gửi",
      Security: "Bảo mật",
      "Guided setup": "Thiết lập có hướng dẫn",
      "Provider payloads": "Payload của nhà cung cấp",
      "Update Notifier": "Update Notifier",
      "Non-Blocking Detection": "Phát hiện không chặn",
      "5-min Scheduler": "Bộ lập lịch 5 phút",
      "Situation-Aware Command": "Lệnh nhận biết tình huống",
      "Two UI Surfaces": "Hai bề mặt giao diện",
      "Soft Failure Semantics": "Ngữ nghĩa lỗi mềm",
      "Dismissal Memory": "Bộ nhớ bỏ qua",
      "API Surface": "Bề mặt API",
      "Connection Status": "Connection Status",
      "Internationalization (i18n)": "Quốc tế hóa (i18n)",
      "Namespaced resources": "Tài nguyên theo không gian tên",
      "Detection & fallback": "Phát hiện & quay lui",
      "Locale-aware formatting": "Định dạng nhận biết locale",
      "Technical terms preserved": "Giữ nguyên thuật ngữ kỹ thuật",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — Mèo Đồng Hành Phản Ứng",
      "Reactive Mascot — Eight Moods": "Linh vật phản ứng — Tám tâm trạng",
      "Auto-Surface Speech Bubbles": "Tự động bật bong bóng thoại",
      "The ⌘B Panel": "Bảng ⌘B",
      "Ask → Run Claude Handoff": "Chuyển giao Ask → Run Claude",
      "Accessibility & Resilience": "Khả năng tiếp cận & Tính bền bỉ",
      "Deployment Modes": "Các chế độ triển khai",
      "Container Runtime (Docker / Podman)": "Môi trường chạy container (Docker / Podman)",
      "Docker / Podman": "Docker / Podman",
      "Plain Docker / Podman (no Compose)": "Docker / Podman thuần (không dùng Compose)",
      "Volume Mounts": "Gắn kết ổ đĩa",
      "Multi-Stage Build": "Xây dựng nhiều giai đoạn",
      "Performance Characteristics": "Đặc điểm hiệu năng",
      Troubleshooting: "Khắc phục sự cố",
      "No sessions appearing after starting Claude Code":
        "Không có phiên nào xuất hiện sau khi khởi động Claude Code",
      "Check 1 — Is the server running?": "Kiểm tra 1 — Máy chủ có đang chạy không?",
      "Check 2 — Are hooks installed?": "Kiểm tra 2 — Hook đã được cài đặt chưa?",
      "Check 3 — Start a new Claude Code session":
        "Kiểm tra 3 — Khởi động một phiên Claude Code mới",
      "Check 4 — Is Node.js in PATH?": "Kiểm tra 4 — Node.js có trong PATH không?",
      "Common Issues": "Các vấn đề thường gặp",
      "Technology Choices": "Lựa chọn công nghệ",
      "Workflow Runs": "Lần chạy quy trình",
    },
    ko: {
      "System Overview": "시스템 개요",
      "What's Included": "포함된 기능",
      "Live Dashboard": "실시간 대시보드",
      "Kanban Board": "Kanban 보드",
      "Sessions Table": "세션 테이블",
      "Session Detail": "세션 상세",
      "Alerts & Webhooks": "알림 & Webhook",
      "Desktop App (macOS & Windows)": "데스크톱 앱 (macOS & Windows)",
      "Activity Feed": "활동 피드",
      Analytics: "분석",
      "WebSocket Push": "WebSocket 푸시",
      Statusline: "Statusline",
      "History Import": "히스토리 가져오기",
      "Transcript Cache": "트랜스크립트 캐시",
      "Bounded Cache Memory": "제한된 캐시 메모리",
      "Constant-Time Sweep": "상수 시간 스윕",
      "Subagent Hierarchy": "서브에이전트 계층 구조",
      "Cost Tracking": "비용 추적",
      "Settings & Management": "설정 & 관리",
      "Local MCP Server": "로컬 MCP 서버",
      "Claude + Codex Extensions": "Claude + Codex 확장",
      "Workflow Graphs": "워크플로 그래프",
      "Workflow Analytics": "워크플로 분석",
      "Session Drill-In": "세션 드릴다운",
      "Browser Notifications": "브라우저 알림",
      "Docker Deployment": "Docker 배포",
      "Plugin Marketplace": "플러그인 마켓플레이스",
      "Run Claude": "Claude 실행",
      "Claude Config Explorer": "Claude 설정 탐색기",
      "Responsive Design": "반응형 디자인",
      "Concurrency Timeline": "동시성 타임라인",
      "VS Code Extension": "VS Code 확장",
      "Error Propagation Map": "오류 전파 맵",
      "Progressive Web App": "프로그레시브 웹 앱",
      "Fresh-by-Default Caching": "기본 신선 캐싱",
      "Auto-Reload on Update": "업데이트 시 자동 새로고침",
      Screenshots: "스크린샷",
      "GitHub Star History": "GitHub Star 히스토리",
      "Hook Events Captured": "캡처되는 Hook 이벤트",
      "Quick Start": "빠른 시작",
      Clone: "클론",
      Install: "설치",
      Start: "시작",
      "Use Claude": "Claude 사용",
      "Alternative: Docker / Podman": "대안: Docker / Podman",
      "Optional: Enable MCP and Agent Extensions": "선택 사항: MCP 및 에이전트 확장 활성화",
      Verification: "검증",
      Configuration: "설정",
      "Environment Variables": "환경 변수",
      "Hook Configuration": "Hook 설정",
      "Scripts Reference": "스크립트 참조",
      "System Architecture": "시스템 아키텍처",
      "Agent State Machine": "에이전트 상태 머신",
      "Session State Machine": "세션 상태 머신",
      "Data Flow": "데이터 흐름",
      "Event Ingestion Pipeline": "이벤트 수집 파이프라인",
      "Client Data Loading Pattern": "클라이언트 데이터 로딩 패턴",
      "Server Architecture": "서버 아키텍처",
      "Server Modules": "서버 모듈",
      "Client Architecture": "클라이언트 아키텍처",
      "Client Routes": "클라이언트 라우트",
      "Key Client Modules": "주요 클라이언트 모듈",
      "PWA & Service Worker": "PWA & 서비스 워커",
      "State Management": "상태 관리",
      "Database Design": "데이터베이스 설계",
      Indexes: "인덱스",
      "SQLite Configuration": "SQLite 설정",
      "API Reference": "API 참조",
      Health: "헬스 체크",
      Sessions: "세션",
      Agents: "에이전트",
      "Events, Stats, Analytics": "이벤트, 통계, 분석",
      "Hooks Ingestion": "Hook 수집",
      Pricing: "가격 책정",
      Settings: "설정",
      "Import History": "가져오기 기록",
      Workflows: "워크플로",
      Alerts: "알림",
      Webhooks: "Webhook",
      "WebSocket Protocol": "WebSocket 프로토콜",
      "Message Envelope": "메시지 엔벨로프",
      "Hook Integration": "Hook 통합",
      "Hook Handler Design": "Hook 핸들러 설계",
      "Hook Installation Flow": "Hook 설치 흐름",
      "Import Pipeline": "가져오기 파이프라인",
      "Three Modes, One Pipeline": "세 가지 모드, 하나의 파이프라인",
      "Upload Request Sequence": "업로드 요청 시퀀스",
      "Idempotence & Cost Accuracy": "멱등성 & 비용 정확성",
      "Supported Source Layouts": "지원되는 소스 레이아웃",
      "Safety Model": "안전 모델",
      "WebSocket Progress Events": "WebSocket 진행 이벤트",
      "MCP & Agent Extensions": "MCP & 에이전트 확장",
      "Local MCP Server Runtime": "로컬 MCP 서버 런타임",
      "Agent Extension Layout": "에이전트 확장 레이아웃",
      "Root Helper Scripts": "루트 헬퍼 스크립트",
      Installation: "설치",
      "Available Plugins": "사용 가능한 플러그인",
      "Skill Usage Examples": "스킬 사용 예시",
      "CLI Tools": "CLI 도구",
      "Plugin Architecture": "플러그인 아키텍처",
      "Data Model Reference": "데이터 모델 참조",
      "Statusline Utility": "Statusline 유틸리티",
      "Detailed Components": "세부 구성 요소",
      "In-Process Architecture": "인프로세스 아키텍처",
      "What It Adds": "추가되는 기능",
      "Menu-Bar / Notification-Area (Tray) Icon": "메뉴 바 / 알림 영역(트레이) 아이콘",
      "Native Application Menu": "네이티브 애플리케이션 메뉴",
      "Auto-Start at Login": "로그인 시 자동 시작",
      "Close Hides, Server Stays Up": "닫아도 숨김, 서버는 계속 실행",
      "Runs Alongside the Web Dashboard": "웹 대시보드와 함께 실행",
      "Single-Instance Lock": "단일 인스턴스 잠금",
      "First-Boot Bootstrap": "최초 부팅 부트스트랩",
      "Data Persistence & CLI Reliability": "데이터 지속성 & CLI 안정성",
      "Port Discovery": "포트 검색",
      "How to Get It": "받는 방법",
      "Option A — download the latest GitHub Release (recommended)":
        "방법 A — 최신 GitHub Release 다운로드 (권장)",
      "Option B — per-commit CI artifact": "방법 B — 커밋별 CI 아티팩트",
      "Option C — build locally": "방법 C — 로컬 빌드",
      macOS: "macOS",
      "Open the DMG": "DMG 파일 열기",
      "Drag to Applications": "Applications로 드래그",
      "Clear Quarantine": "격리 속성 제거",
      Launch: "실행",
      Windows: "Windows",
      "Run the Installer": "설치 프로그램 실행",
      "Clear SmartScreen": "SmartScreen 차단 해제",
      "Settings Page": "설정 페이지",
      "Model Pricing": "모델 가격",
      "Data Management": "데이터 관리",
      "Data Export": "데이터 내보내기",
      "System Health": "시스템 상태",
      "Notification Preferences": "알림 설정",
      "Rule types": "규칙 유형",
      "Evaluation engine": "평가 엔진",
      "14 first-class providers": "14개의 퍼스트클래스 프로바이더",
      "Delivery engine": "전달 엔진",
      Security: "보안",
      "Guided setup": "가이드 설정",
      "Provider payloads": "프로바이더 페이로드",
      "Update Notifier": "업데이트 알리미",
      "Non-Blocking Detection": "논블로킹 감지",
      "5-min Scheduler": "5분 스케줄러",
      "Situation-Aware Command": "상황 인식 명령",
      "Two UI Surfaces": "두 가지 UI 화면",
      "Soft Failure Semantics": "소프트 실패 시맨틱스",
      "Dismissal Memory": "닫힘 상태 기억",
      "API Surface": "API 표면",
      "Connection Status": "연결 상태",
      "Internationalization (i18n)": "국제화 (i18n)",
      "Namespaced resources": "네임스페이스화된 리소스",
      "Detection & fallback": "감지 & 폴백",
      "Locale-aware formatting": "로케일 인식 포맷팅",
      "Technical terms preserved": "보존되는 기술 용어",
      "🐾 Tabby — Reactive Cat Companion": "🐾 Tabby — 반응형 고양이 동반자",
      "Reactive Mascot — Eight Moods": "반응형 마스코트 — 여덟 가지 감정",
      "Auto-Surface Speech Bubbles": "말풍선 자동 표시",
      "The ⌘B Panel": "⌘B 패널",
      "Ask → Run Claude Handoff": "Ask → Run Claude 핸드오프",
      "Accessibility & Resilience": "접근성 & 복원력",
      "Deployment Modes": "배포 모드",
      "Container Runtime (Docker / Podman)": "컨테이너 런타임 (Docker / Podman)",
      "Docker / Podman": "Docker / Podman",
      "Plain Docker / Podman (no Compose)": "순수 Docker / Podman (Compose 미사용)",
      "Volume Mounts": "볼륨 마운트",
      "Multi-Stage Build": "멀티 스테이지 빌드",
      "Performance Characteristics": "성능 특성",
      Troubleshooting: "문제 해결",
      "No sessions appearing after starting Claude Code":
        "Claude Code 시작 후 세션이 나타나지 않음",
      "Check 1 — Is the server running?": "확인 1 — 서버가 실행 중인가요?",
      "Check 2 — Are hooks installed?": "확인 2 — Hook이 설치되어 있나요?",
      "Check 3 — Start a new Claude Code session": "확인 3 — 새 Claude Code 세션 시작",
      "Check 4 — Is Node.js in PATH?": "확인 4 — Node.js가 PATH에 있나요?",
      "Common Issues": "일반적인 문제",
      "Technology Choices": "기술 선택",
      "Workflow Runs": "워크플로 실행",
    },
  },
};
