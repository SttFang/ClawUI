# OpenClaw Dashboard 页面与配置拆分

> 基于源码调研（`/Users/fanghanjun/openclaw`）  
> 主要参考：`ui/src/ui/navigation.ts`、`ui/src/ui/app-render.ts`、`ui/src/ui/controllers/*.ts`、`src/gateway/server-methods/config.ts`

## 1. 页面数量结论

OpenClaw Dashboard（Control UI）当前有 **13 个内部页面（Tab）**：

1. `chat`
2. `overview`
3. `channels`
4. `instances`
5. `sessions`
6. `usage`
7. `cron`
8. `agents`
9. `skills`
10. `nodes`
11. `config`
12. `debug`
13. `logs`

说明：

- 左侧 `Resources -> Docs` 是外链，不是内部页面 tab。

## 2. 逐页配置拆分（按“是否改配置”）

| 页面 | 主要 RPC / 操作 | 配置读写范围 | 是否写 `openclaw.json` |
|---|---|---|---|
| `chat` | `chat.*`、`messages.list` 等 | 会话运行态（sessionKey、消息流），不是配置文件字段编辑 | 否 |
| `overview` | `status`、`health`、`channels.status`、`sessions.list`、`cron.status` | 主要是状态聚合页 | 否 |
| `channels` | `channels.status`、`web.login.*`、`channels.logout` + `config.get/schema/set` | 频道配置（`channels.*`，含多账号/群组/DM/policy） | 是 |
| `instances` | `presence.list` | 实例/节点心跳状态 | 否 |
| `sessions` | `sessions.list`、`sessions.patch`、`sessions.delete` | 会话元数据（标签、thinking/verbose 等） | 否（不是写 `openclaw.json`） |
| `usage` | `usage.*` | 使用量统计视图 | 否 |
| `cron` | `cron.status/list/add/update/run/remove/runs` | 定时任务存储（cron jobs） | 否（写 cron store，不是 `openclaw.json`） |
| `agents` | `agents.*` + `config.get/set` | 代理相关配置：`agents.list.*`、`agents.defaults.*`、局部 `tools` 覆盖 | 是 |
| `skills` | `skills.status/update/install` | skills 开关/API key（skills 子系统） | 通常否（由 skills 子系统管理） |
| `nodes` | `node.list`、`devices.*`、`exec_approvals.*` + `config.get/set` | 节点绑定：`tools.exec.node`、`agents.list.*.tools.exec.node`；另有 exec approvals 文件 | 部分是（绑定写 `openclaw.json`） |
| `config` | `config.get/schema/set/apply`、`update.run` | 全量配置编辑（raw/form） | 是 |
| `debug` | `status`、`health`、`debug.call` | 调试调用面板 | 否 |
| `logs` | `logs.tail` | 日志查看 | 否 |

## 3. 真正会写 `openclaw.json` 的页面

1. `config`（全量）
2. `channels`（频道相关局部）
3. `agents`（代理相关局部）
4. `nodes`（exec 节点绑定局部）

这些页面最终都走 `config.set`（或 `config.apply`）链路，由 Gateway 进行校验并写盘。

## 4. `config` 页面内部的配置拆分

`config` 页是 schema 驱动表单，不是手写字段。它通过 `config.schema` 拉取：

- `schema`（JSON Schema）
- `uiHints`（label/help/order/sensitive）

然后按 root section 渲染。常见 section 可按职责这样理解：

| section | 作用 |
|---|---|
| `gateway` | 网关端口/绑定/鉴权、control-ui、remote、reload、http endpoints |
| `agents` | agent defaults、agent list、model/skills/sandbox/memorySearch |
| `tools` | 工具策略（profile/allow/deny/byProvider）、exec/web/media/message |
| `channels` | Telegram/Discord/Slack/WhatsApp 等渠道配置（支持多账号与扩展） |
| `auth` | auth profiles 与 failover/backoff |
| `models` | 模型目录与 provider/model 映射 |
| `session` | session scope/reset/sendPolicy/maintenance |
| `messages` | ack reaction、queue、responsePrefix、tts |
| `commands` | native/text/bash/config/debug/restart、allowFrom |
| `memory` | memory backend（builtin/qmd）、citation、qmd 更新与限制 |
| `plugins` | 插件启停、allow/deny、slots、entries、installs |
| `skills` | skills 扫描、watch、install 策略、entry 配置 |
| `nodeHost` | 节点侧 browser proxy 等 |
| `browser` | 浏览器行为配置 |
| `ui` | UI 偏好（seamColor/assistant） |
| `diagnostics` / `logging` | 观测、otel、日志级别与脱敏 |
| `cron` / `hooks` / `web` / `discovery` / `talk` / `canvasHost` | 子系统配置 |
| `update` / `wizard` / `meta` | 更新、向导状态、元信息 |

补充：

- 插件和频道扩展字段会在 schema 构建阶段动态合并进来，不是固定死在前端。
- 敏感字段（token/password/secret/apiKey）会被标记并在网关返回时做 redaction。

## 5. 并发与安全机制（Dashboard 保存链路）

`config.get` 返回快照 hash，`config.set/apply/patch` 要求带 `baseHash`：

1. hash 不匹配时拒绝写入（提示先 reload）
2. 写入前做 schema + plugin 校验
3. 敏感值支持 redacted sentinel 恢复，避免 UI 往返把密钥写坏

这也是 Dashboard 能“多人/多端并发编辑仍相对安全”的关键。

## 6. 对 ClawUI 的直接启发

如果 ClawUI 要实现“前端可视化改配置且真实生效”，建议对齐为：

1. 配置操作统一走中间层（不要让各 store 直接拼旧字段）
2. 中间层至少提供 `get + set/patch + schema + hash` 能力
3. 页面级别只关心“路径 patch”，不关心底层字段迁移

这能避免 `agent/config 字段不一致` 持续扩散到每个页面。
