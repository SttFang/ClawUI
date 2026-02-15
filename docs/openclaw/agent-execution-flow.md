# OpenClaw Agent 执行流（Gateway / WebChat）

本页把 DeepWiki（5.1 Agent Execution Flow）与 OpenClaw 源码对齐，整理出 ClawUI 最需要理解的“输入→执行→流式输出→落盘”路径。

主要参考：
- DeepWiki：`https://deepwiki.com/openclaw/openclaw/5.1-agent-execution-flow`
- 源码：`/Users/fanghanjun/openclaw/src/gateway/server-methods/chat.ts`
- 源码：`/Users/fanghanjun/openclaw/src/gateway/server-methods/agent.ts`
- 源码：`/Users/fanghanjun/openclaw/src/auto-reply/dispatch.ts`
- 源码：`/Users/fanghanjun/openclaw/src/infra/agent-events.ts`
- 源码：`/Users/fanghanjun/openclaw/src/gateway/server-chat.ts`

## 1. 你在 UI 里会遇到的两条“入口”

### 1.1 `chat.send`（WebSocket-native WebChat）

- 调用：`method="chat.send"`
- 响应：立即返回 `res(ok=true)`（确认已接收）
- 流式：通过 `event="chat"` 推送 `delta/final/aborted/error`
- 典型用于：dashboard/webchat 这类“本地对话 UI”

对应 handler：`/Users/fanghanjun/openclaw/src/gateway/server-methods/chat.ts`

### 1.2 `agent`（通用 Agent 调度）

- 调用：`method="agent"`
- 响应：会先返回一次 `accepted`（避免重试产生重复 run），然后在执行完成后**再返回一次** `ok|error` 的最终 res
- 流式：同样会有 `event="agent"`（以及可能映射到 `event="chat"`）
- 典型用于：更通用的“执行一次 Agent 轮次”，可选 deliver 到具体 channel（Telegram/Discord…）

对应 handler：`/Users/fanghanjun/openclaw/src/gateway/server-methods/agent.ts`

## 2. 执行链路拆解（从输入到输出）

下面把 DeepWiki 的 4 阶段（Input → Context → Execution → Response）落到 OpenClaw 实现：

### 2.1 输入处理（Input Processing）

共同点：
- 校验 params（缺字段/类型不对会直接 `res(ok=false)` + `INVALID_REQUEST`）
- `idempotencyKey` 是关键：用于去重和 runId 关联

`chat.send` 里典型处理：
- 解析 attachments（图片/文件），将其整理成 agent 能消费的输入
- 注入 timestamp（仅针对 webchat 这条路径）
- 识别 stop/abort 指令（如 `/stop` 一类的文本）并触发 `chat.abort`

### 2.2 会话解析与上下文准备（Context Preparation）

核心概念：
- `sessionKey`：逻辑会话桶（用于路由、隔离、会话设置）
- `sessionId`：会话 transcript 文件的 id（落盘文件名的一部分），reset 后会变化

系统会：
- 读取 session store entry（决定该 session 的 model/provider override、thinkingLevel、sendPolicy…）
- 读取最近历史（`chat.history` 也走同一套读取与截断逻辑）
- 组装 System Prompt（详见 `docs/openclaw/system-prompt.md`）

### 2.3 Agent 执行（Agent Execution）

`dispatchInboundMessage(...)` 是 WebChat 调用 agent 的关键入口（代码：`/Users/fanghanjun/openclaw/src/auto-reply/dispatch.ts`）。

执行期间，OpenClaw 会通过 agent bus 发出 `event="agent"`：
- `stream="lifecycle"`：start/end/error
- `stream="assistant"`：文本流（有时是累计快照）
- `stream="tool"`：工具调用过程（start/update/result）

这些事件由 `emitAgentEvent(...)` 产生（代码：`/Users/fanghanjun/openclaw/src/infra/agent-events.ts`）。

### 2.4 响应与落盘（Response Handling + Persistence）

对 WebChat（`chat.send`）：
- Gateway 会把 agent 输出**映射**为 `event="chat"`（用于“对话 UI”更友好的 payload）
- 同时落盘到 session transcript（`.jsonl`），并更新 session entry（updatedAt/systemSent/abortedLastRun…）

对通用 `agent`：
- 会返回 `accepted` + 最终 res（`status: ok|error`）
- 可选 deliver 到外部 channel（取决于 `deliver`、to/replyTo、session 的 sendPolicy 等）

## 3. 流式事件对 UI 的关键语义（ClawUI 必读）

### 3.1 `event chat` 的 delta 是“累计快照”

`state="delta"` 时，`message.content[0].text` 是“当前完整累积文本”，不是增量片段。

UI 处理建议：
- “覆盖式更新”更稳：只更新为更长的文本（避免短文本回退）
- 如果你需要 token-delta 语义，可在 UI 侧做 suffix diff（见后续 `packages/openclaw-chat-stream`）

详见：`docs/openclaw/streaming-events.md`

### 3.2 tool 事件不是默认广播：需要声明 capability

OpenClaw 为避免把工具过程广播给所有 client，要求 client 在 `connect.params.caps` 声明支持：
- `caps: ["tool-events"]`

否则你只能看到 `chat` 文本流，看不到 `tool start/update/result`。

详见：
- `docs/openclaw/gateway-protocol.md`
- `/Users/fanghanjun/openclaw/src/gateway/server-chat.ts`（tool recipient registry）

### 3.3 runId 如何关联

一般情况下（尤其是 WebChat 路径）：
- 你发 `chat.send` 的 `idempotencyKey` 会变成 `event chat` 的 `runId`
- `event agent` 的 `runId` 通常也会沿用同一个 runId（或至少可通过 `sessionKey` 过滤）

ClawUI v1 的落地策略建议：
- 用 `sessionKey` 过滤出当前 UI session 的事件
- 在同一 session 内，再用 `runId` 把 tool events 归并到对应的 assistant message

