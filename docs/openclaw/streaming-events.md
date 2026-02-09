# OpenClaw 流式事件（chat / agent）整理

本页整理 OpenClaw Gateway 在 WebSocket 上推送的“流式信息”，主要来源：
- `/Users/fanghanjun/openclaw/src/gateway/protocol/schema/logs-chat.ts`
- `/Users/fanghanjun/openclaw/src/gateway/protocol/schema/agent.ts`
- `/Users/fanghanjun/openclaw/src/gateway/server-chat.ts`
- `/Users/fanghanjun/openclaw/src/infra/agent-events.ts`

## 1. `event: chat`（面向聊天 UI 的流）

### 1.1 payload 结构
`event=chat` 的 payload 结构（schema 见 `logs-chat.ts`）：
- `runId: string`：本次运行 id（对 webchat 来说就是 `chat.send` 的 `idempotencyKey`）
- `sessionKey: string`
- `seq: number`
- `state: "delta" | "final" | "aborted" | "error"`
- `message?: unknown`：通常是 `role/content/timestamp` 结构
- `errorMessage?: string`
- `usage?: unknown`
- `stopReason?: string`

### 1.2 delta 的关键语义：累计快照
OpenClaw 的 `chat` delta 并不是“增量片段”，而是“累计文本快照”：
- `payload.message.content[0].text` 是当前时刻的**完整累积**文本
- UI 侧应使用“覆盖式更新”，而不是 append
- Gateway 内部会对 delta 发送做节流（源码中默认 150ms 左右），因此 delta 的频率并不等价于模型 token 流

### 1.3 结束态
- `state="final"`：一般会带最终 `message`，表示本次 run 完成
- `state="aborted"`：被 stop/abort 打断
- `state="error"`：出错，`errorMessage` 可用于 UI 展示

## 2. `event: agent`（更底层的 agent bus 流）

### 2.1 payload 结构
`event=agent` 的 payload 结构（schema 见 `agent.ts`）：
- `runId: string`
- `seq: number`：每个 runId 单调递增（OpenClaw 在 `emitAgentEvent` 内保证）
- `stream: string`：常见值见下文（lifecycle/tool/assistant/error/...）
- `ts: number`
- `data: Record<string, unknown>`
- `sessionKey?: string`：Gateway 侧会尽力补齐（便于 UI 过滤）

### 2.2 常见 stream 类型

#### lifecycle
典型字段（不完全）：
- `data.phase: "start" | "end" | "error"`
- `data.startedAt` / `data.endedAt`
- `data.error`（phase=error 时）

#### assistant
典型字段（不完全）：
- `data.text: string`：当前累计文本
- `data.delta: string`：本次增量（如果能计算出来）
- `data.mediaUrls?: string[]`

> 注意：OpenClaw 最终会把 `assistant.text` 映射到 `chat delta`（因此 chat delta 是累计快照）。

#### tool
工具事件是 OpenClaw “过程信息”的核心（见 `pi-embedded-subscribe.handlers.tools.ts`）：
- `data.phase: "start" | "update" | "result"`
- `data.name: string`：工具名（例如 read/exec/...)
- `data.toolCallId: string`
- `data.args?: object`（phase=start）
- `data.partialResult?: unknown`（phase=update）
- `data.result?: unknown` + `data.isError?: boolean`（phase=result）
- `data.meta?: string`（例如 exec 是否 pty/elevated）

### 2.3 tool-events capability
为了避免把 tool 流广播给所有 UI client，Gateway 会把 tool 流定向投递给“声明支持 tool-events”的连接：
- 客户端在 `connect.params.caps` 增加 `"tool-events"`
- gateway 在 agent run start 时为该 conn 注册 tool recipient，后续 tool stream 才会推送过来

## 3. ClawUI 的渲染策略建议

推荐把 OpenClaw 的两条流做分层展示：
- `chat`：用户主视图（答案流），覆盖式更新
- `agent.tool/lifecycle/...`：折叠的“过程/调试”面板（可选），展示工具参数与输出，利于排错与可观测性

