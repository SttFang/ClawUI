# Control UI `/nodes`：管理什么？（Nodes 管理面与 RPC/Schema）

> 目标：给 ClawUI 对接 OpenClaw Gateway 管理后台时，明确 Control UI 的 `/nodes` 页面在“管理什么对象”，以及它背后的 RPC 方法、参数 schema、配对与权限策略。

## 1. `/nodes` 是什么

当你打开 `http://127.0.0.1:18789/nodes`，你访问的是 **Gateway 提供的浏览器 Control UI（Vite + Lit 的 SPA 路由）**里的 “Nodes” 页面，而不是某个独立的 HTTP API。

Control UI 本质上是静态资源（`dist/control-ui`）+ 同端口 WebSocket RPC 调用；`/nodes` 页面主要通过 Gateway WS 方法 `node.list`（以及 `node.describe` 等）展示/操作节点信息。

源码与文档入口：

- Control UI 能力概览：`../openclaw/docs/web/control-ui.md`
- Nodes 概念与 CLI：`../openclaw/docs/nodes/index.md`

## 2. Nodes 管理的对象：node（外设/伴随设备）

OpenClaw 里的 **node** 是连接到 Gateway WebSocket 的“伴随设备/外设”，典型包括：

- iOS/Android 节点（Canvas、camera、screen record、location、SMS 等能力）
- macOS menubar app 的 “node mode”
- headless node host（跨机器执行 `system.run/system.which` 等）

关键特征：

- node 以 `role: "node"`（或 `roles` 包含 `node`）连接到 Gateway（同端口 WS）
- node 暴露“命令面”（如 `canvas.*`、`camera.*`、`system.*`），Gateway 通过 `node.invoke` 转发调用

对应 docs：`../openclaw/docs/nodes/index.md`（开头 “A node is a companion device...”）。

## 3. `/nodes` 页背后的 RPC 方法（Gateway 侧）

Gateway 的 nodes 相关 handlers 在：

- `../openclaw/src/gateway/server-methods/nodes.ts`

常用方法：

- `node.list`：列出节点清单（合并“已配对设备列表”与“当前已连接 node sessions”）
- `node.describe`：查看某个 node 的详情（同样基于 paired + connected 合并）
- `node.invoke`：请求 node 执行某个 command（例如 `canvas.snapshot` / `system.run`）
- `node.invoke.result`：node 回传 `node.invoke` 的执行结果（Gateway 用于关联请求并完成 promise）
- `node.event`：node 主动上报事件（Gateway 内部会分发处理）

还有一组“legacy/兼容”方法（见下文第 5 节）：

- `node.pair.request/list/approve/reject/verify`
- `node.rename`

### 3.1 `node.list` 返回结构（源码语义）

`node.list` 的实现要点（`../openclaw/src/gateway/server-methods/nodes.ts`）：

- 从 **device pairing store** 读取 `paired` 列表，并筛出 `role/roles` 包含 `node` 的条目
- 从 `nodeRegistry` 读取当前 **connected** 的 nodes（活连接）
- 用 `nodeId` 合并两侧集合，生成 `nodes[]`，并补齐字段：
  - `paired: boolean`（来自 device pairing 是否存在）
  - `connected: boolean`（当前是否在线）
  - `caps: string[]`、`commands: string[]`（去重、排序）
  - `displayName/platform/version/.../remoteIp/pathEnv/permissions/connectedAtMs` 等

这也是 Control UI “Nodes” 页面通常展示的核心信息：在线、是否配对、能力与可调用命令集。

## 4. 参数与事件 schema（TypeBox）

nodes 相关的 TypeBox schema 在：

- `../openclaw/src/gateway/protocol/schema/nodes.ts`

其中包含（仅列关键字段）：

- `NodeListParamsSchema`：`{}`
- `NodeDescribeParamsSchema`：`{ nodeId }`
- `NodeInvokeParamsSchema`：`{ nodeId, command, params?, timeoutMs?, idempotencyKey }`
- `NodeInvokeResultParamsSchema`：`{ id, nodeId, ok, payload?, payloadJSON?, error? }`
- `NodeEventParamsSchema`：`{ event, payload?, payloadJSON? }`
- `NodeInvokeRequestEventSchema`（事件帧）：`{ id, nodeId, command, paramsJSON?, timeoutMs?, idempotencyKey? }`

> 这组 schema 是你在 ClawUI 里实现 nodes 面板交互时，对齐后端的最直接“协议真相来源”。

## 5. 配对：WS device pairing vs legacy `node.pair.*`

OpenClaw 的 nodes 在配对上存在两套机制，容易混淆：

### 5.1 WS nodes 使用 device pairing（决定 connect 是否被允许）

WS nodes 在 `connect` 时会携带 device identity，Gateway 会创建 device pairing request，批准后才认为该设备具备 `role: node` 权限。

对应文档明确写了：

- “WS nodes use device pairing ... approve via devices CLI/UI”
- 同时强调 `node.pair.*` 不 gate WS `connect`（见下一节）

参考：`../openclaw/docs/nodes/index.md`。

device pairing 的落盘在 `$OPENCLAW_STATE_DIR/devices/`（这点已在 `docs/openclaw/persistence-and-policies.md` 里沉淀过）。

### 5.2 legacy `node.pair.*` 是一套 gateway-owned pairing store（不 gate WS connect）

虽然 `../openclaw/src/gateway/server-methods/nodes.ts` 仍实现了 `node.pair.*`：

- `node.pair.request/list/approve/reject/verify`

但 docs 明确说明这是“单独的 gateway-owned pairing store”，不会决定 WS nodes 的 `connect` 是否允许。

该 legacy store 的落盘位置（源码）：

- `../openclaw/src/infra/node-pairing.ts`
- `$OPENCLAW_STATE_DIR/nodes/pending.json`
- `$OPENCLAW_STATE_DIR/nodes/paired.json`

实现要点：

- `pending` 有 TTL（源码为 5 分钟）
- 写入使用原子写（tmp -> rename）+ 尽力 `chmod 0600`

## 6. `node.invoke` 的权限策略（command allowlist + node 声明）

`node.invoke` 并不是“想调用什么就调用什么”。Gateway 侧至少有两层 gate（见 `../openclaw/src/gateway/server-methods/nodes.ts`）：

1. **allowlist**：根据 node 平台的默认 allowlist + config 的 `gateway.nodes.allowCommands`，再减去 `gateway.nodes.denyCommands`
2. **node 声明**：node session 必须在 `declaredCommands` 里声明该 command，否则拒绝

策略实现文件：

- `../openclaw/src/gateway/node-command-policy.ts`

配置字段定义：

- `gateway.nodes.allowCommands` / `gateway.nodes.denyCommands`：`../openclaw/src/config/types.gateway.ts`
- 配置文案索引：`../openclaw/src/config/schema.ts`

源码还把一批命令标成 “dangerous”（例如 `camera.snap`、`screen.record`、`sms.send` 等），需要显式加入 `gateway.nodes.allowCommands` 才会被 allowlist 放行（并且仍要满足 node 声明）。

## 7. ClawUI 对接建议（最小闭环）

如果你要在 ClawUI 里做 nodes 管理面板，最小闭环通常是：

- 列表页：调用 `node.list`，展示 `paired/connected`、`displayName`、`caps/commands`
- 详情页：调用 `node.describe`
- 动作页（调试/诊断）：调用 `node.invoke`（必须理解 allowlist 与声明限制）
- 配对入口：优先走 device pairing 的 “devices approve/reject” 流程（WS nodes 真正依赖它）

相关：`docs/openclaw/persistence-and-policies.md` 里也包含 device pairing 的落盘与策略，便于做备份/迁移/可视化。

