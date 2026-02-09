# OpenClaw Gateway 协议速查（WebSocket RPC + Events）

本页聚焦 OpenClaw Gateway 对外“返回/推送”的结构：RPC 响应与事件（events）。内容主要来自源码：
- `/Users/fanghanjun/openclaw/src/gateway/protocol/schema/frames.ts`
- `/Users/fanghanjun/openclaw/src/gateway/protocol/schema/logs-chat.ts`
- `/Users/fanghanjun/openclaw/src/gateway/server/ws-connection.ts`
- `/Users/fanghanjun/openclaw/src/gateway/server-methods-list.ts`

## 1. 帧（Frame）结构

Gateway 使用统一的 JSON 帧格式：

### Request（客户端 → Gateway）
```json
{ "type": "req", "id": "uuid", "method": "chat.send", "params": {} }
```

### Response（Gateway → 客户端）
```json
{ "type": "res", "id": "uuid", "ok": true, "payload": {} }
```

失败时：
```json
{
  "type": "res",
  "id": "uuid",
  "ok": false,
  "error": { "code": "INVALID_REQUEST", "message": "..." }
}
```

`error`（ErrorShape）常见字段：
- `code: string`
- `message: string`
- `details?: unknown`
- `retryable?: boolean`
- `retryAfterMs?: number`

### Event（Gateway → 客户端）
```json
{ "type": "event", "event": "chat", "payload": {}, "seq": 123 }
```

`seq` 是事件序号（可用于 gap 检测）；部分事件还会带 `stateVersion`（例如 health/presence 的版本号）。

## 2. 连接与握手

### 2.1 connect.challenge（服务端主动）
WebSocket 连接建立后，服务端会立刻推送：
```json
{ "type": "event", "event": "connect.challenge", "payload": { "nonce": "...", "ts": 0 } }
```

### 2.2 connect（客户端请求）
客户端随后发送 `connect`：
```json
{
  "type": "req",
  "id": "uuid",
  "method": "connect",
  "params": {
    "minProtocol": 1,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "0.1.0",
      "platform": "darwin",
      "mode": "cli"
    },
    "caps": ["tool-events"],
    "scopes": ["operator.admin"],
    "auth": { "token": "..." }
  }
}
```

要点：
- `scopes` 不传时，OpenClaw 自带 client 默认会用 `["operator.admin"]`（见 openclaw 的 GatewayClient 实现）。
- `caps` 用于开启增强能力。想订阅 tool 事件，需要 `caps` 包含 `"tool-events"`。
- `auth.token` 通常来自 `~/.openclaw/openclaw.json` 的 `gateway.auth.token`（或 env 替换后的值）。

### 2.3 hello-ok（connect 响应 payload）
`connect` 成功时，`res.payload` 通常是 `hello-ok` 对象（注意：它不是顶层 frame，而是 response 的 payload）：
- `protocol: number`
- `server.version/commit/host/connId`
- `features.methods/events`
- `snapshot`（presence/health 等快照）
- `auth`（deviceToken/role/scopes 等，可能存在）
- `policy`（maxPayload/tickInterval 等）

## 3. 方法（methods）与事件（events）

### 3.1 常用 methods（节选）
方法清单以 `/Users/fanghanjun/openclaw/src/gateway/server-methods-list.ts` 为准。常用的几类：
- 配置：`config.get` / `config.patch` / `config.schema` / `config.apply`
- 会话：`sessions.list` / `sessions.preview` / `sessions.patch` / `sessions.reset` / `sessions.compact`
- Chat（WebSocket-native）：`chat.send` / `chat.abort` / `chat.history`
- Agent：`agent` / `agent.wait` / `agent.identity.get`
- 日志：`logs.tail`
- 健康：`health` / `status`

### 3.2 事件列表（节选）
同样以 `server-methods-list.ts` 为准：
- `connect.challenge`
- `chat`（chat.send 的流式输出）
- `agent`（agent/tool/lifecycle/assistant 等事件流）
- `presence` / `health` / `tick` / `shutdown`
- 设备/节点：`node.*` / `device.*`
- 审批：`exec.approval.*`

## 4. ClawUI 对接建议

ClawUI 若要替代 OpenClaw 自带 dashboard，建议：
- 连接时把 `caps` 加上 `"tool-events"`，以便拿到工具执行流（tool start/update/result）。
- 把 `event chat` 当作“主流 UI 流”（用户更关心的输出），`event agent` 作为“可展开的调试/过程信息”（工具调用、生命周期等）。

