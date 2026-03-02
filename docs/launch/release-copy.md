# ClawUI 发布文案

---

## 小红书

### 标题（二选一）

A: 做了一个开源桌面 App，让你的 AI 助手同时出现在 TG / Discord / WhatsApp

B: 开源了一个 AI 助手管理器，终于不用手动改 JSON 配置了

### 封面文字建议

「一个 App 管理你所有的 AI 助手」

### 正文

我之前用 OpenClaw 搭了一套本地 AI 助手系统 —— 接了 Claude、GPT、DeepSeek，同一个助手可以同时出现在 Telegram、Discord、WhatsApp、Slack。

但有个问题：所有配置都要手动改 JSON，看日志要盯终端，API 花了多少钱只能自己算。

所以我做了 ClawUI。

一句话说清楚：OpenClaw 是引擎，ClawUI 是仪表盘。

它是一个原生桌面 App（Electron），把 OpenClaw 的全部能力变成了可视化界面：

🔹 开箱即用 — 自动检测 OpenClaw、自动启动 Gateway，Onboarding 向导几步完成配置
🔹 对话界面 — 流式渲染 + 代码高亮 + LaTeX + Mermaid，AI 调用工具前会先征求你的同意
🔹 Agent 管理 — 能力配置、渠道绑定、定时任务、技能网络图，一个页面搞定
🔹 多渠道路由 — 在 App 里配好 TG / Discord / WhatsApp，同一个 AI 同时响应所有平台
🔹 用量追踪 — 每个会话花了多少 Token、多少钱，按模型和 Provider 拆分，每日趋势图一目了然
🔹 执行透明 — 每次工具调用都有审批（允许/拒绝/修改），完成后用 DAG 图展示完整调用链
🔹 Rescue Agent — 内置排障会话，双 Gateway 架构隔离，主 Gateway 挂了也能自救

全部本地运行，数据不上云。

macOS / Windows / Linux 全平台支持。MIT 开源。

👉 GitHub: github.com/SttFang/ClawUI

### 标签

#开源 #AI助手 #桌面应用 #效率工具 #独立开发 #OpenClaw #Electron #本地部署 #AI工具 #程序员

---

## X (Twitter) 推文串

### Tweet 1（主推，配产品截图）

Open-sourcing ClawUI — a desktop client for OpenClaw.

OpenClaw is a local AI assistant gateway: multi-model, multi-channel (Telegram / Discord / WhatsApp / Slack / Signal), agents, tools, cron scheduling.

ClawUI turns all of that into a native desktop app with guided onboarding. No more JSON editing.

MIT · macOS / Windows / Linux
→ github.com/SttFang/ClawUI

### Tweet 2（功能亮点）

What you get with ClawUI:

→ Zero-config setup — auto-detects OpenClaw, starts Gateway, onboarding wizard handles the rest
→ Execution approval — every tool call requires your OK (allow / deny / modify), visualized as interactive DAGs with sub-agent tracing
→ Agent dashboard — 4 tabs: Skills network graph, Channels, Nodes, Cron calendar
→ Usage analytics — token costs per session, daily trends, provider breakdown, session timeline

### Tweet 3（技术栈，配架构图）

Built with Electron 33, React 19, Tailwind CSS 4, shadcn/ui, Zustand 5.

28 Zustand stores. 17 IPC modules. 80+ React components.

Streaming chat with Shiki syntax highlighting, LaTeX, Mermaid. Inline PDF / DOCX / XLSX preview. Dual-gateway architecture with RSA device auth. Auto-connects to local OpenClaw Gateway via WebSocket (ACP protocol).

### Tweet 4（CTA）

If you're running OpenClaw and tired of editing ~/.openclaw/openclaw.json by hand — this is for you.

Star it, try it, break it → github.com/SttFang/ClawUI

---

## 备注

### 截图准备清单

| 序号 | 内容 | 用途 |
|------|------|------|
| 1 | Onboarding 向导（首次启动引导流程） | README 功能区 · 小红书正文插图 |
| 2 | 聊天界面（深色主题，展示流式消息 + 代码高亮） | README hero · 小红书封面 · X 主推配图 |
| 3 | Agent 管理面板（Skills 网络图 Tab） | README 功能区 · 小红书正文插图 |
| 4 | 执行审批 DAG 图（含 Sub-Agent 追踪） | README 功能区 · X Tweet 2 配图 |
| 5 | 用量分析页面（日趋势图 + 成本拆分） | README 功能区 |
| 6 | 渠道配置页面 | README 功能区 |
| 7 | 设置中心（AI 服务 Tab，展示 Provider 认证） | README 功能区 |

### 发布建议

- 小红书封面：深色主题 App 截图 + 大字标题拼图风格
- X 主推：一张完整聊天界面截图（深色主题）
- Product Hunt：基于以上文案扩展，增加 maker comment
- 发布时间：工作日上午 10-11 点（小红书）/ 北美时间上午（X）
