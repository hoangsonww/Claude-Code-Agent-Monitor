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
    "Idle gate before the liveness reap may complete a process-less session — both the last hook write and the transcript mtime must be at least this old":
      "存活性回收将无进程会话标记为完成前的空闲门槛——最后一次 hook 写入和 transcript 的 mtime 都必须至少达到该时长",
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
    'Every alert-rule field has a help tooltip — the event-type, tool-name, and summary-contains fields include example chips of real hook events and built-in tool names. Each webhook provider ships a collapsible step-by-step setup guide linking to the official docs. A one-click <strong>"Send test"</strong> probe fires a synthetic alert and reports the delivery result inline, and targets can be scoped to specific rules. Fully localized (en / zh / vi).':
      "每个告警规则字段都有帮助提示——event-type、tool-name 和 summary-contains 字段包含真实 hook 事件和内置工具名称的示例标签。每个 webhook 提供方都附带一份可折叠的分步设置指南，并链接到官方文档。一键 <strong>“Send test”</strong> 探测会触发一个合成告警并就地报告投递结果，且目标可限定到特定规则。完全本地化（en / zh / vi）。",
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
    "The entire UI ships in <strong>three languages — English, 简体中文, and Tiếng Việt</strong> — built on <code>i18next</code> + <code>react-i18next</code> with <code>i18next-browser-languagedetector</code>. Coverage is end-to-end: every page, chart tooltip, Settings flow, Workflow narrative, Config Explorer tab, Run page, and the Alerts rule-help tooltips + webhook setup guides are translated. Switch languages from the sidebar (EN / 中文 / VI) — the choice persists in <code>localStorage</code>.":
      "整个 UI 提供<strong>三种语言——English、简体中文和 Tiếng Việt</strong>——基于 <code>i18next</code> + <code>react-i18next</code> 并配合 <code>i18next-browser-languagedetector</code> 构建。覆盖是端到端的：每个页面、图表工具提示、Settings 流程、Workflow 叙述、Config Explorer 标签页、Run 页面，以及 Alerts 规则帮助工具提示 + webhook 设置指南都已翻译。从侧边栏切换语言（EN / 中文 / VI）——选择会持久保存在 <code>localStorage</code> 中。",
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
    "Idle gate before the liveness reap may complete a process-less session — both the last hook write and the transcript mtime must be at least this old":
      "Ngưỡng nhàn rỗi trước khi cơ chế thu dọn được phép hoàn tất một phiên không còn tiến trình — cả lần ghi hook cuối lẫn mtime của transcript đều phải cũ ít nhất bằng khoảng này",
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
    'Every alert-rule field has a help tooltip — the event-type, tool-name, and summary-contains fields include example chips of real hook events and built-in tool names. Each webhook provider ships a collapsible step-by-step setup guide linking to the official docs. A one-click <strong>"Send test"</strong> probe fires a synthetic alert and reports the delivery result inline, and targets can be scoped to specific rules. Fully localized (en / zh / vi).':
      "Mỗi trường của quy tắc cảnh báo đều có chú giải trợ giúp — các trường event-type, tool-name và summary-contains bao gồm các chip ví dụ về sự kiện hook thật và tên công cụ tích hợp sẵn. Mỗi nhà cung cấp webhook đi kèm một hướng dẫn thiết lập từng bước có thể thu gọn, liên kết tới tài liệu chính thức. Một thăm dò <strong>“Send test”</strong> bằng một cú nhấp sẽ kích hoạt một cảnh báo tổng hợp và báo cáo kết quả gửi ngay tại chỗ, và các đích có thể được giới hạn theo các quy tắc cụ thể. Được bản địa hóa hoàn toàn (en / zh / vi).",
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
    "The entire UI ships in <strong>three languages — English, 简体中文, and Tiếng Việt</strong> — built on <code>i18next</code> + <code>react-i18next</code> with <code>i18next-browser-languagedetector</code>. Coverage is end-to-end: every page, chart tooltip, Settings flow, Workflow narrative, Config Explorer tab, Run page, and the Alerts rule-help tooltips + webhook setup guides are translated. Switch languages from the sidebar (EN / 中文 / VI) — the choice persists in <code>localStorage</code>.":
      "Toàn bộ giao diện được phát hành bằng <strong>ba ngôn ngữ — English, 简体中文, và Tiếng Việt</strong> — xây dựng trên <code>i18next</code> + <code>react-i18next</code> cùng <code>i18next-browser-languagedetector</code>. Phạm vi bao phủ là đầu-cuối: mọi trang, chú giải biểu đồ, luồng Settings, tường thuật Workflow, tab Config Explorer, trang Run, cùng các chú giải trợ giúp quy tắc Alerts + hướng dẫn thiết lập webhook đều được dịch. Chuyển ngôn ngữ từ thanh bên (EN / 中文 / VI) — lựa chọn được giữ trong <code>localStorage</code>.",
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
  },
};
