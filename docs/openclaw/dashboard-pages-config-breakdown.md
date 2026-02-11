# OpenClaw Dashboard 13页配置与管理深度拆解

> 调研仓库：`/Users/fanghanjun/openclaw`  
> 调研目标：把 Dashboard 的 13 个页面按“字段级 + 用户视角 + 管理机制 + ClawUI 对接风险”拆开讲清楚。  
> 关键源码：
>
> - 页面与路由：`ui/src/ui/navigation.ts`
> - 页面渲染装配：`ui/src/ui/app-render.ts`
> - 页面状态：`ui/src/ui/app.ts`
> - 各页面 UI：`ui/src/ui/views/*.ts`
> - 各页面 RPC：`ui/src/ui/controllers/*.ts`
> - 配置写入与并发控制：`src/gateway/server-methods/config.ts`
> - 配置 schema/元数据：`src/config/zod-schema*.ts`、`src/config/schema.field-metadata.ts`

## 1. 总览结论（先给答案）

### 1.1 Dashboard 一共有 13 个页面

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

### 1.2 哪些页面“真的会改配置”

会写配置或审批文件的页面：

1. `config`（全量 `config.set/apply`）
2. `channels`（局部改 `channels.*`，最终也是 `config.set`）
3. `agents`（局部改 `agents.*` / `tools.*`，最终 `config.set`）
4. `nodes`（局部改 `tools.exec.node` 与 `agents.list.*.tools.exec.node`，最终 `config.set`）
5. `nodes` 里的 `Exec approvals`（写审批文件，不是 `openclaw.json`）
6. `skills`（`skills.update` 会写 `skills.entries.*` 到 `openclaw.json`）

不改 `openclaw.json` 的页面：`chat/overview/instances/sessions/usage/cron/debug/logs`（这些页面主要是运行态、统计态或子系统数据管理）。

### 1.3 Dashboard 配置管理的核心机制

1. `config.get` 返回快照 + `hash`。
2. `config.set/config.apply/config.patch` 必须带 `baseHash`。
3. hash 不匹配会拒绝写入，防止并发覆盖。
4. 写入前做 schema + 插件校验。
5. 密钥字段支持 redaction/restore，避免 UI 回写把密钥擦空。

这套机制是 Dashboard“可视化编辑可信”的底层关键。

---

## 2. 13 个页面逐页拆解（字段级 + 用户视角）

## 2.1 Chat

### 页面目标（用户视角）

- 直接和当前 session 对话，做在线调试、快速干预、复现问题。

### 页面字段与操作

| 字段/控件 | 技术含义 | 业务含义（用户语言） |
|---|---|---|
| `Message` 文本框 | `chatMessage` | 你给 agent 的当前输入。 |
| 图片粘贴附件 | `chatAttachments`（base64 data URL） | 可以直接把截图/图片喂给 agent。 |
| `Send` | `chat.send` | 发消息；若当前正在流式输出，则进入 queue。 |
| `Stop` | `chat.abort` | 遇到跑偏/成本过高时，立即中止本轮。 |
| `New session` | 发送 `/new` 或新 key | 开新上下文，避免历史污染当前问题。 |
| `Queued` 列表 | `chatQueue` | 网络慢或模型忙时，用户知道消息没有丢。 |
| `Focus mode` | 本地 UI 设置 | 只看对话主内容，减少干扰。 |
| Tool Sidebar | 工具结果 markdown/raw | 用户可追查工具调用细节，不只看最终回答。 |

### RPC / 数据流

- 读历史：`chat.history`
- 发消息：`chat.send`
- 中断：`chat.abort`

### 持久化

- 不写 `openclaw.json`。
- 写会话运行态（消息、队列、转录）。

### 典型风险

- 用户误以为 Chat 页改的是“全局配置”，实际上主要是 session 运行态。

---

## 2.2 Overview

### 页面目标（用户视角）

- 作为“控制台入口页”：先连上网关、看健康状态、看是否有认证问题。

### 页面字段与操作

| 字段/控件 | 技术含义 | 业务含义（用户语言） |
|---|---|---|
| `WebSocket URL` | 本地 Dashboard 连接地址 | 你要连哪台网关（本机/远程）。 |
| `Gateway Token` | 网关 token（UI设置） | 远程控制的凭证。填错会连不上。 |
| `Password (not stored)` | 临时密码 | 仅本次输入，不落地。 |
| `Default Session Key` | 默认 session key | 打开 Chat 默认进入哪个会话上下文。 |
| `Connect` | 触发重连 | 应用你刚填的连接参数。 |
| `Refresh` | 拉取 snapshot | 手动刷新当前握手与状态。 |
| Snapshot 指标 | uptime/tick/channels refresh | 一眼判断网关是否活着、节拍是否正常。 |

### RPC / 数据流

- 通过网关连接握手 + 状态拉取（`status/health` 聚合）。

### 持久化

- 不写 `openclaw.json`。
- 修改的是 Control UI 本地设置（URL/token/session 默认值）。

### 典型风险

- 用户把这里的 token 设置当成“服务器已永久更新”。实际是本地 UI 连接参数。

---

## 2.3 Channels

### 页面目标（用户视角）

- 把 OpenClaw 接入 Telegram/Discord/Slack/WhatsApp 等渠道，并查看每个渠道连通性。

### 页面结构

1. 渠道状态卡片（每渠道）
2. 渠道配置表单（schema 驱动）
3. 渠道健康 JSON 快照

### 核心字段（通用）

| 字段 | 技术含义 | 业务含义 |
|---|---|---|
| `enabled` | 是否启用渠道/账号 | 渠道开关。 |
| `dmPolicy` | 私聊准入策略 | 控制陌生人是否可直接私聊触发 agent。 |
| `groupPolicy` | 群聊准入策略 | 控制群内触发范围与风险。 |
| `allowFrom` / `groupAllowFrom` | 允许名单 | 白名单，限制谁能触发命令/对话。 |
| `requireMention` | 是否必须@ | 防止群里被每条消息都触发。 |
| `historyLimit` / `dmHistoryLimit` | 历史窗口 | 控制上下文长度与成本。 |
| `streamMode`/`blockStreaming*` | 流式分块策略 | 影响用户看到“边生成边发”的体验。 |
| `retry.*` / `timeoutSeconds` | 重试与超时 | 抗抖动，减少偶发发送失败。 |
| `configWrites` | 渠道内写配置权限 | 是否允许从渠道里触发配置写入类操作。 |

### 各渠道“用户最关心字段”

| 渠道 | 关键字段 | 业务解释 |
|---|---|---|
| Telegram | `botToken`、`customCommands`、`dmPolicy`、`streamMode`、`draftChunk.*` | 决定机器人是否能上线、命令是否好记、长回复是否可读。 |
| Discord | `token`、`dm.policy`、`intents.*`、`pluralkit.*`、`retry.*` | 决定机器人权限、私聊策略、网关稳定性。 |
| Slack | `botToken`/`appToken`/`userToken`、`mode(socket/http)`、`thread.*` | 决定是否能收发、是否走线程上下文、企业工作流兼容性。 |
| WhatsApp | `dmPolicy`、`selfChatMode`、`authDir`、`ackReaction`、`debounceMs` | 决定手机同号模式可用性、已读/回执体验、消息风暴防护。 |
| Signal | `account/httpUrl/httpPort/cliPath`、`dmPolicy` | 决定 signal-cli 接入是否能稳定工作。 |
| iMessage | `cliPath/dbPath/remoteHost/service/region`、`dmPolicy` | 决定 macOS 桥接是否可用、短信/iMessage 路由。 |
| Google Chat | `serviceAccount*`、`audience*`、`webhook*` | 决定企业 GCP 鉴权链路是否正确。 |
| Nostr | profile 字段（`name/displayName/about/picture/...`）+ relay相关配置 | 决定身份展示和去中心化 DM 体验。 |

### 页面专属操作

| 操作 | RPC | 业务价值 |
|---|---|---|
| `Probe/Refresh` | `channels.status` | 快速判断是配置问题还是运行问题。 |
| WhatsApp `Show QR/Relink/Wait/Logout` | `web.login.start` / `web.login.wait` / `channels.logout` | 完成扫码登录与重连恢复。 |
| Nostr `Edit Profile` | Nostr profile 相关 RPC | 维护公开身份，提升可识别度。 |
| `Save` | `config.set` | 将本页改动落到 `openclaw.json`。 |

### 持久化

- 写 `openclaw.json` 的 `channels.*`。

### 典型风险

1. 渠道字段非常多，容易“启用了渠道但权限没开全（token/intents/allowFrom不匹配）”。
2. 部分插件渠道是扩展字段，用户容易以为是固定内置字段。

---

## 2.4 Instances

### 页面目标（用户视角）

- 查看有哪些实例/节点在线，是否掉线，最近是否活跃。

### 页面字段与操作

| 字段/控件 | 技术含义 | 业务含义 |
|---|---|---|
| Host | 实例主机名 | 你在看哪台机器。 |
| `mode` | 运行模式 | 是 gateway/client/node 的哪类角色。 |
| `roles/scopes` | 权限角色与作用域 | 这个实例能做什么，权限边界在哪。 |
| `platform/device/version` | 环境信息 | 快速定位系统差异问题。 |
| `age/lastInput/reason` | 活跃度 | 判断是“断连”还是“闲置”。 |
| `Refresh` | 重新拉取 presence | 看当前在线是否恢复。 |

### RPC / 数据流

- `system-presence`

### 持久化

- 不写配置。

### 典型风险

- 只看“在线/离线”不够，实际还要看 scopes 是否满足当前操作需求。

---

## 2.5 Sessions

### 页面目标（用户视角）

- 管理会话层面的覆盖设置（标签、thinking、verbose、reasoning）。

### 页面字段与操作

| 字段/控件 | 技术字段 | 业务含义 |
|---|---|---|
| `Active within (minutes)` | `activeMinutes` | 只看最近活跃会话，减少噪音。 |
| `Limit` | `limit` | 限制列表规模，避免 UI 过重。 |
| `Include global` | `includeGlobal` | 是否把全局会话也展示。 |
| `Include unknown` | `includeUnknown` | 排障时看异常来源会话。 |
| `Label` | `sessions.patch.label` | 给会话打业务标签（例如“客户A-回归”）。 |
| `Thinking` | `sessions.patch.thinkingLevel` | 控制思考深度，影响质量/成本/时延。 |
| `Verbose` | `sessions.patch.verboseLevel` | 控制输出详略程度。 |
| `Reasoning` | `sessions.patch.reasoningLevel` | 控制 reasoning 展示模式。 |
| `Delete` | `sessions.delete(deleteTranscript=true)` | 清理会话与转录（谨慎）。 |

### RPC / 数据流

- `sessions.list` / `sessions.patch` / `sessions.delete`

### 持久化

- 写 session store，不写 `openclaw.json`。

### 典型风险

- 删除会话默认包含 transcript 删除，业务审计场景要谨慎。

---

## 2.6 Usage

### 页面目标（用户视角）

- 看清楚 token/cost 到底花在哪：按时间、会话、agent、渠道、模型、工具拆分。

### 主要筛选与分析字段

| 字段/控件 | 技术含义 | 业务含义 |
|---|---|---|
| `startDate/endDate` | 查询时间窗 | 成本分析的边界。 |
| `Today/7d/30d` | 快捷时间窗 | 快速看短期/中期趋势。 |
| `Time zone` | local/utc | 统一分析口径（团队跨时区很重要）。 |
| `Tokens/Cost` | chartMode | 同一数据看量（tokens）或看钱（cost）。 |
| `Filter query` | `usageQuery` DSL | 组合过滤（agent/channel/model/tool/errors等）。 |
| 多选过滤器 | agent/channel/provider/model/tool | 多维定位异常成本来源。 |
| `selectedDays/Hours/Sessions` | 交互筛选状态 | 从总览钻到局部。 |
| `dailyChartMode` | total/by-type | 看总量，或看输入/输出/cache 分摊。 |
| `timeSeriesMode` | cumulative/per-turn | 看累计趋势还是每轮波动。 |
| `timeSeriesBreakdownMode` | total/by-type | 看总成本还是类型拆分。 |
| `sessionSort/dir` | 列表排序 | 快速找“最贵/最新/错误最多”会话。 |
| `visibleColumns` | 列显示控制 | 按角色（运营/研发）定制视图。 |
| `logFilter*` | 会话日志过滤 | 精确查某一类角色/工具消息。 |
| `Export` | CSV/JSON 导出 | 给财务、BI、复盘文档复用。 |

### RPC / 数据流

- `sessions.usage`（limit=1000）
- `usage.cost`
- `sessions.usage.timeseries`
- `sessions.usage.logs`

### 持久化

- 不写配置。

### 典型风险

1. 默认上限 1000 sessions，超量时是“截断视图”。
2. 用户容易把“查询筛选后结果”当作全局真实总量。

---

## 2.7 Cron

### 页面目标（用户视角）

- 配置定时任务，让 agent 在固定时间自动执行工作流。

### 新建任务字段（最重要）

| 字段 | 技术含义 | 业务含义 |
|---|---|---|
| `Name` | `job.name` | 任务可识别名称。 |
| `Description` | `job.description` | 团队协作时避免“这个任务是干嘛的”。 |
| `Agent ID` | `job.agentId` | 指定由哪个 agent 执行。 |
| `Enabled` | `job.enabled` | 创建后立即生效或先关着。 |
| `Schedule` | `every/at/cron` | 调度方式（间隔/定点/cron表达式）。 |
| `everyAmount/everyUnit` | 间隔参数 | 例如每 30 分钟巡检。 |
| `scheduleAt` | 一次性触发时刻 | 例如今晚 22:00 报告。 |
| `cronExpr` + `cronTz` | cron 规则 | 复杂调度。 |
| `sessionTarget` | main/isolated | 复用主会话或隔离运行。 |
| `wakeMode` | now/next-heartbeat | 触发时机策略。 |
| `payloadKind` | systemEvent/agentTurn | 系统唤醒 or 真正跑一轮对话。 |
| `payloadText` | 文本内容 | 任务实际要让 agent 做什么。 |
| `deliveryMode/channel/to` | 投递配置 | 是否把结果回发到指定渠道/目标。 |
| `timeoutSeconds` | agentTurn 超时 | 防止任务卡死。 |

### 任务管理字段

| 字段/操作 | 业务意义 |
|---|---|
| `Enable/Disable` | 快速停启任务。 |
| `Run` | 立即强制执行，用于验证任务逻辑。 |
| `History` | 看最近执行成功/失败与耗时。 |
| `Remove` | 删除过期任务。 |

### RPC / 数据流

- `cron.status/list/add/update/run/remove/runs`

### 持久化

- 写 cron jobs 存储，不写 `openclaw.json`。

### 典型风险

- `payload` 文本和 `delivery` 策略没配清楚，容易出现“任务执行了但用户没收到”。

---

## 2.8 Agents

### 页面目标（用户视角）

- 以“单 agent”为中心做全链路管理：身份、模型、文件、工具、技能、渠道观察、定时任务观察。

### 页面结构（6 个子面板）

1. `Overview`
2. `Files`
3. `Tools`
4. `Skills`
5. `Channels`
6. `Cron`

### A) Overview 子面板字段

| 字段 | 技术路径 | 业务含义 |
|---|---|---|
| `Workspace` | `agents.defaults.workspace` / agent 覆盖 | agent 工作目录。 |
| `Primary model` | `agents.list[i].model` / default | 主模型选择，决定质量与成本。 |
| `Fallbacks` | `agents.list[i].model.fallbacks` | 主模型不可用时自动兜底。 |
| `Identity Name/Emoji` | agent identity | 面向用户可识别人格。 |
| `Skills Filter` | `agents.list[i].skills` | 这个 agent 只启用哪些技能。 |
| `Save/Reload Config` | `config.set/get` | 保存或回滚本页改动。 |

### B) Files 子面板字段

| 字段/操作 | 业务含义 |
|---|---|
| 文件列表（name/path/size/updated） | 快速定位核心提示文件。 |
| `Content` 编辑器 | 直接改 agent 引导词/规则文件。 |
| `Reset` | 撤销本次编辑草稿。 |
| `Save` | 将文件写回 agent workspace。 |

### C) Tools 子面板字段

| 字段 | 技术路径 | 业务含义 |
|---|---|---|
| `Profile` (`minimal/coding/messaging/full/inherit`) | `agents.list[i].tools.profile` | 快速切换工具能力档位。 |
| Tool 开关矩阵 | `alsoAllow/deny` 覆盖 | 在 profile 基础上微调权限。 |
| `Enable All/Disable All` | 批量覆写 | 灰度测试时很高效。 |

### D) Skills 子面板字段

| 字段 | 技术路径 | 业务含义 |
|---|---|---|
| `Use All` | 删除 `agents.list[i].skills` | 让 agent 继承全技能。 |
| `Disable All` | `skills=[]` | 做最小权限运行。 |
| 单技能开关 | `agents.list[i].skills` 列表维护 | 按业务角色定制能力边界。 |
| `Filter` | 仅 UI 过滤 | 快速定位某技能。 |

### E) Channels 子面板字段

- 这里是“只读观测聚合页”（来自 channels snapshot），帮助你从 agent 视角看渠道连通。
- 额外显示 `groupPolicy/streamMode/dmPolicy` 摘要，帮助判断回复策略是否合理。

### F) Cron 子面板字段

- 展示“绑定到该 agent”的 cron 任务，不在此面板创建任务。

### RPC / 数据流

- `agents.list`
- `agents.files.list/get/set`
- `skills.status`（按 agent）
- `config.get/set`（写 agent 模型、工具、技能过滤）
- `channels.status` / `cron.list/status`

### 持久化

- `Files` 子面板写 agent 文件。
- `Overview/Tools/Skills` 子面板写 `openclaw.json` 的 `agents.*`。

### 典型风险

1. 这里的许多改动不是即时生效（取决于 reload 策略）。
2. `skills` 为空数组与“未配置 skills 字段”含义不同（前者是禁用全部，后者是继承全部）。

---

## 2.9 Skills（全局）

### 页面目标（用户视角）

- 管理技能的启用状态、缺失依赖、安装动作、API Key 注入。

### 页面字段与操作

| 字段/控件 | 业务含义 |
|---|---|
| `Filter` | 快速检索技能。 |
| `Enable/Disable` | 开关某个技能。 |
| `Install` | 一键安装缺失依赖。 |
| `API key` + `Save key` | 给技能补密钥。 |
| `Missing: bin/env/config/os` | 解释技能为什么不可用。 |
| `Reason: disabled/blocked` | 告诉用户阻塞原因。 |

### RPC / 数据流

- `skills.status`
- `skills.update`
- `skills.install`

### 持久化

- 会写 `openclaw.json` 的 `skills.entries.<skillKey>.*`（例如 `enabled/apiKey/env`），同时影响技能子系统运行态。

### 典型风险

- 用户看到“技能存在”就以为能用，但缺 bin/env 时仍不可执行。

---

## 2.10 Nodes

### 页面目标（用户视角）

- 把“执行权限、节点绑定、设备配对”集中管理，解决远程执行安全与路由问题。

### 页面结构

1. `Exec approvals`
2. `Exec node binding`
3. `Devices`
4. `Nodes`

### A) Exec approvals 字段

| 字段 | 业务含义 |
|---|---|
| `Target Host` (`gateway/node`) | 编辑网关审批规则，或编辑某个节点审批规则。 |
| `Target Node` | 当 host=node 时必须选具体节点。 |
| `Scope` (`Defaults` + 每个 Agent) | 全局默认策略 + agent 级覆写。 |
| `Security` (`deny/allowlist/full`) | 执行白名单强度。 |
| `Ask` (`off/on-miss/always`) | 是否每次执行都弹审批。 |
| `Ask fallback` | UI 不可达时回退策略。 |
| `autoAllowSkills` | 是否自动放行技能声明的 CLI。 |
| `allowlist[].pattern` | 命令模式白名单（glob）。 |

### B) Exec node binding 字段

| 字段 | 技术路径 | 业务含义 |
|---|---|---|
| Default binding | `tools.exec.node` | 默认把 exec 路由到哪台节点。 |
| Agent binding | `agents.list[i].tools.exec.node` | 单 agent 绑固定节点，控制资源隔离。 |

### C) Devices 字段

| 字段/操作 | 业务含义 |
|---|---|
| Pending request | 待批准设备接入。 |
| `Approve/Reject` | 控制设备入网。 |
| Paired device roles/scopes | 设备有哪些权限。 |
| token `Rotate/Revoke` | 密钥轮换与失效，降低泄漏风险。 |

### D) Nodes 列表字段

| 字段 | 业务含义 |
|---|---|
| `nodeId/displayName/version/remoteIp` | 节点身份与版本对齐。 |
| `caps/commands` | 该节点实际可执行能力。 |
| `paired/connected` | 当前是否可路由任务。 |

### RPC / 数据流

- `node.list`
- `device.pair.*` / `device.token.*`
- `exec.approvals.*`（gateway / node）
- `config.get/set`（绑定写配置）

### 持久化

- 绑定写 `openclaw.json`。
- approvals 写审批文件（带 hash 并发保护）。

### 典型风险

1. `host=node` 未选 node 时无法保存审批。
2. 切到 raw mode 时绑定编辑会被禁用（防止冲突修改）。

---

## 2.11 Config

### 页面目标（用户视角）

- “全局配置总控台”：支持 Form（schema 驱动）和 Raw（JSON5 原文）双模式。

### 页面字段与交互

| 字段/控件 | 业务含义 |
|---|---|
| Search | 全局检索字段，快速定位配置项。 |
| Section Nav | 按功能域浏览配置（gateway/agents/tools/channels 等）。 |
| Subsection Nav | 在 section 内进一步分组，减少认知负担。 |
| Form/Raw 切换 | 普通用户用表单；复杂场景或未知字段用 raw。 |
| Diff 面板 | 保存前看改了什么，降低误改风险。 |
| `Reload/Save/Apply/Update` | 拉最新、写文件、写并触发重载、执行更新。 |
| Validation issues | 保存前提示 schema 错误。 |

### section 业务解读（用户思维，完整版）

> 这一段按“用户要达成什么业务目标”来读，不按技术目录读。  
> 每个 section 给出：典型字段、用户目标、常见误配、业务后果。

| section | 典型字段（示例） | 用户目标（用户语言） | 常见误配 | 业务后果 |
|---|---|---|---|---|
| `gateway` | `gateway.bind` `gateway.port` `gateway.auth.token/password` `gateway.controlUi.*` `gateway.reload.*` | 让网关能被正确访问，同时保证控制权限不泄露。 | 只改端口不改鉴权；远程暴露但 origin/basePath 配错。 | 连接失败、被拒绝访问，或暴露在错误网络边界。 |
| `auth` | `auth.profiles` `auth.order` `auth.cooldowns.*` | 多账号/多供应商自动切换，降低单账号风控或限流影响。 | 只配 profile 不配 order；cooldown 太激进。 | 频繁失败重试、切换失效、可用性下降。 |
| `channels` | `channels.*.enabled` `dmPolicy/groupPolicy` `allowFrom` `accounts` `retry/timeout` `configWrites` | 把机器人接到真实用户触点，并控制谁能触发它。 | 开 `open` 但没白名单；token 在错误账号层；重试参数不合理。 | 触发权限失控、消息丢失、渠道看似在线但业务不可用。 |
| `commands` | `commands.native/text/bash/config/debug/restart` `commands.allowFrom/ownerAllowFrom` | 控制“谁可以执行高风险命令”。 | 允许 `/config`、`/bash` 但未限制来源。 | 误操作甚至安全事故（远程执行/改配置）。 |
| `agents` | `agents.defaults.*` `agents.list[].model` `agents.list[].skills` `agents.list[].tools.*` | 定义 agent 的人格、能力边界、默认行为和工作目录。 | 默认与单 agent 覆写混在一起；skills 空数组语义误解。 | 某些 agent 突然“失能”或与预期人格不一致。 |
| `models` | `agents.defaults.models` `model.primary/fallbacks` `imageModel.*` | 控制“用哪个模型、什么时候兜底”。 | 只改 primary 不配 fallback；别名映射不完整。 | 单模型故障时全链路中断，或成本异常上升。 |
| `tools` | `tools.profile/allow/deny` `tools.exec.*` `tools.web.*` `tools.media.*` `tools.message.*` | 让 agent 有足够能力完成任务，同时不越权。 | profile 与显式 allow/deny 冲突；`exec` 安全策略过松。 | 要么任务做不成，要么权限过大风险升高。 |
| `memory` | `memory.backend` `memory.qmd.*` `agents.defaults.memorySearch.*` | 让 agent 具备长期记忆和检索能力。 | 只开开关不配路径/索引；更新间隔和超时不合理。 | 回答“失忆”、检索超时、延迟变高。 |
| `session` | `session.scope` `session.reset.*` `session.dmScope` | 控制会话隔离与生命周期，避免上下文串线。 | scope 设太宽；reset 条件设太弱。 | 不同用户/群聊上下文污染，答复跑偏。 |
| `messages` | `messages.ackReaction*` `messages.inbound.debounceMs` `responsePrefix` | 优化消息体验（确认、节流、格式一致）。 | debounce 太大或太小；ack 范围不合理。 | 用户感觉“卡顿”或“刷屏”。 |
| `skills` | `skills.load.watch` `skills.load.watchDebounceMs` `install` 相关 | 管理技能发现、热更新、安装节奏。 | watch 太频繁；依赖缺失未可视化。 | 技能状态抖动、体验不稳定。 |
| `plugins` | `plugins.enabled` `plugins.allow/deny` `plugins.entries/installs` | 扩展系统能力，同时可控地引入第三方模块。 | 直接全开插件，无 allow/deny 治理。 | 稳定性和安全边界不可控。 |
| `cron` | `cron.enabled`（及 jobs 存储） | 让“自动执行”稳定可靠。 | 任务有了但 session/channel 目标没定义清楚。 | 任务执行成功但业务侧“没收到结果”。 |
| `hooks` | `hooks.enabled` `hooks.path` `hooks.token` | 对接外部事件源（Webhook）。 | 路径开放但鉴权薄弱；token 管理混乱。 | 外部可伪造事件或合法事件进不来。 |
| `web` | `web.enabled` `web.heartbeatSeconds` `web.reconnect.*` | 控制 Web 客户端连接稳定性（心跳与重连）。 | 重连参数与网络条件不匹配。 | 频繁断连、恢复慢、用户感知不稳定。 |
| `discovery` | `discovery.*` | 让节点/能力自动发现，减少手工配置。 | 自动发现范围过宽。 | 引入意外节点，路由不稳定。 |
| `nodeHost` | `nodeHost.browserProxy.*` | 在 node 侧承载浏览器代理等能力。 | 允许 profile 过宽。 | 节点资源被错误消费，权限扩散。 |
| `browser` | `browser.enabled` `profiles` `cdpUrl/cdpPort` `headless` | 稳定地提供浏览器自动化能力。 | profile 命名/端口冲突；远程 cdp 超时配置不当。 | 浏览器工具间歇性不可用。 |
| `talk` | `talk.*` | 语音/对话扩展能力。 | 与消息/频道策略未对齐。 | 语音路径可用但业务行为不一致。 |
| `canvasHost` | `canvasHost.*` | 提供可视化画布协作能力。 | host 路由未对齐 gateway/basePath。 | 画布入口可见但不可操作。 |
| `ui` | `ui.seamColor` `ui.assistant.*` | 统一品牌和助手呈现（名字/头像/主题）。 | 只改 UI 不改真实 agent identity。 | 用户看到的“形象”和真实行为不一致。 |
| `update` | `update.channel` `update.checkOnStart` | 平衡稳定性与新功能获取速度。 | 生产环境误用 dev/beta。 | 升级风险升高或长期落后。 |
| `logging` | `logging.level` `consoleLevel/style` `redact*` | 让排障可观测，同时保护敏感信息。 | 日志级别过高或脱敏关闭。 | 成本增加、泄漏风险提高。 |
| `diagnostics` | `diagnostics.flags` `otel.*` `cacheTrace.*` | 深入诊断疑难问题（链路、缓存、性能）。 | 全量常开诊断。 | 性能抖动、日志噪声、排障反而变难。 |
| `wizard` | `wizard.lastRun*` | 记录引导流程状态。 | 误删或脏状态残留。 | 首次引导重复/跳过，影响部署体验。 |
| `meta` | `meta.lastTouched*` | 记录配置触达元信息。 | 手工改乱元数据。 | 变更追踪困难。 |
| `bindings` | `bindings[].agentId` `bindings[].match.*` | 按渠道/账号/会话对象把流量路由到指定 agent。 | 绑定规则命中条件写错（channel/account/peer）。 | 消息被错误 agent 处理，业务角色串线。 |
| `audio` / `voicewake` / `presence` | 各自子系统字段 | 音频能力、唤醒策略、在线心跳治理。 | 子系统开关和主链路策略不一致。 | 看起来“开了功能”，实际用户感知不可用。 |

### 按业务场景快速选 section

| 你现在想解决的问题 | 优先看的 section |
|---|---|
| “为什么连接不上/远程控制失败？” | `gateway` `auth` `channels` |
| “为什么 agent 回答质量突然差了？” | `agents` `models` `memory` |
| “为什么能聊天但不能执行动作？” | `tools` `commands` `bindings` `gateway.nodes` `nodeHost` |
| “为什么消息有时发不出去/重复发？” | `channels` `messages` `cron` |
| “为什么成本突然升高？” | `models` `memory` `tools.web` `usage`（页面） |
| “为什么线上偶发错误抓不到？” | `logging` `diagnostics` `debug`（页面） |

### section 字段字典（字段级，用户可直接对照）

> 下面是“高频且高影响字段”字典。  
> 读法：`字段 -> 业务作用 -> 什么时候改 -> 常见坑`。

### A. gateway / auth

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `gateway.bind` | 决定网关监听边界（loopback/0.0.0.0）。 | 从单机改远程访问时。 | 对公网开放但未加严格鉴权。 |
| `gateway.port` | 网关入口端口。 | 端口冲突或统一运维端口时。 | 只改网关不改客户端连接地址。 |
| `gateway.auth.token` | Dashboard/API 的核心凭证。 | 开启远程控制前必须配置。 | token 泄露到截图/日志。 |
| `gateway.auth.password` | 额外密码鉴权（部署策略相关）。 | 组织要求双层鉴权时。 | 误把本地临时密码当成持久配置。 |
| `gateway.controlUi.basePath` | Control UI 挂载子路径。 | 反向代理/子路径部署时。 | basePath 和代理规则不一致导致 404。 |
| `gateway.controlUi.allowedOrigins` | 限制允许访问控制台的源。 | 多域部署时。 | 为了“先跑起来”写成过宽白名单。 |
| `auth.profiles` | 定义供应商账号池。 | 多 key 轮换、组织账号并存时。 | profile 定义了但没放进 order。 |
| `auth.order` | 定义失败切换顺序。 | 某供应商配额紧张时。 | 顺序写错导致总是命中低优账号。 |

### B. channels（通用 + 渠道共性）

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `channels.<provider>.enabled` | 渠道总开关。 | 上线/下线渠道时。 | 开关开了但 token 未配，表现为“开了也不可用”。 |
| `channels.<provider>.accounts.*` | 多账号隔离（品牌/业务线/环境）。 | 一个渠道多个机器人账号时。 | token 配在 root 但实际走 account 配置。 |
| `channels.<provider>.dmPolicy` | 私聊触达策略。 | 要限制陌生触发时。 | 不同 provider 的 `open + allowFrom` 约束不同，直接照搬别的渠道配置导致策略失效。 |
| `channels.<provider>.groupPolicy` | 群聊触发策略。 | 群里误触发过多时。 | 忘记配 `requireMention`，导致群消息风暴。 |
| `channels.<provider>.allowFrom` | 白名单用户/来源。 | 合规或灰度阶段。 | 标识格式不统一（平台 ID/手机号混用）。 |
| `channels.<provider>.retry.*` | 失败重试策略。 | 网络抖动、平台限流时。 | retry 过大导致重复消息和长尾延迟。 |
| `channels.<provider>.timeoutSeconds` | 接口超时阈值。 | 平台响应慢时。 | 设置过短导致大量假失败。 |
| `channels.<provider>.configWrites` | 是否允许渠道内触发配置写入。 | 需要远程运维时。 | 生产误开，扩大误操作面。 |

### C. agents / models

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `agents.defaults.workspace` | 默认工作目录。 | 多环境/多仓库切换时。 | 路径不一致导致 agent 文件加载失败。 |
| `agents.list[].workspace` | 单 agent 工作目录覆写。 | 让 agent 专注某个项目时。 | 覆写后忘记同步知识索引路径。 |
| `agents.defaults.model.primary` | 默认主模型。 | 成本或质量策略调整时。 | 改了 primary 未配 fallback。 |
| `agents.defaults.model.fallbacks` | 默认兜底模型链。 | 可用性要求提高时。 | fallback 顺序与成本策略相反。 |
| `agents.list[].model.primary` | 单 agent 主模型。 | 某 agent 需要更强/更便宜模型时。 | agent 覆写后与全局升级策略脱节。 |
| `agents.list[].skills` | 单 agent 技能白名单。 | 做最小权限 agent 时。 | `[]` 被误解为“继承全部”，实际是“禁用全部”。 |
| `agents.list[].tools.profile` | 单 agent 工具档位。 | agent 角色切换（客服/开发）时。 | profile 与 alsoAllow/deny 冲突没排查。 |
| `agents.list[].identity.avatar/name` | 对外人格标识。 | 多 agent 面向用户时。 | UI 形象改了但真实路由还是旧 agent。 |

### D. tools / commands / session / messages

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `tools.profile` | 全局工具能力模板。 | 新环境初始化时。 | 直接用 `full` 进生产，权限过宽。 |
| `tools.alsoAllow` / `tools.deny` | 全局精细化白黑名单。 | 安全审计后精调。 | 用 deny 覆盖过猛导致关键功能失效。 |
| `tools.exec.security` | 执行安全模式。 | 要求强审批/白名单时。 | 误设 `full`，执行风险显著上升。 |
| `tools.exec.ask` | 执行前确认策略。 | 高风险命令治理时。 | 设 `always` 导致体验过重；设 `off` 风险过高。 |
| `tools.exec.node` | 默认 exec 路由节点。 | 多节点资源分层时。 | 绑定失效导致任务跑错机器。 |
| `commands.bash` | 是否允许聊天触发 shell。 | 受控环境需手工运维时。 | 开启后未配来源限制。 |
| `commands.config` | 是否允许聊天改配置。 | 远程运维流程成熟时。 | 灰度阶段误开到全体用户。 |
| `commands.allowFrom` | 命令可用来源。 | 组织权限分层时。 | 与渠道 allowFrom 叠加关系没搞清。 |
| `session.scope` | 会话隔离粒度。 | 出现跨会话串线时。 | scope 过宽导致上下文污染。 |
| `session.reset.mode/idleMinutes` | 自动重置策略。 | 长时间会话质量下降时。 | 重置太频繁导致上下文丢失。 |
| `messages.inbound.debounceMs` | 入站防抖。 | 消息风暴或平台回调抖动时。 | 数值太大造成“回复慢半拍”。 |
| `messages.ackReaction` | 到达确认反馈。 | 提升交互可见性时。 | 在群聊场景造成噪音。 |

### E. memory / skills / plugins

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `memory.backend` | 记忆引擎选择（builtin/qmd）。 | 知识规模扩大时。 | 切后端但不迁索引。 |
| `memory.qmd.paths` | QMD 扫描路径。 | 新增知识库目录时。 | 路径漏配，导致“以为记住了其实没索引”。 |
| `memory.qmd.update.*` | 索引更新节奏。 | 要平衡实时性与性能时。 | 更新太频繁拖慢整体吞吐。 |
| `agents.defaults.memorySearch.enabled` | agent 检索开关。 | 需要 RAG/长期记忆时。 | 开了但 query/minScore 参数不合理。 |
| `skills.load.watch` | 技能文件热更新。 | 本地快速迭代技能时。 | 生产常开导致抖动。 |
| `skills.load.watchDebounceMs` | 技能热更新防抖。 | 频繁改动技能文件时。 | 防抖太短触发反复重载。 |
| `plugins.enabled` | 插件系统总开关。 | 引入扩展能力时。 | 不分环境直接开启全部插件。 |
| `plugins.allow/deny` | 插件治理策略。 | 安全审计、灰度上线时。 | allow/deny 名单不维护导致状态漂移。 |

### F. cron / hooks / logging / diagnostics / update

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `cron.enabled` | 定时任务子系统开关。 | 运维窗口或迁移期。 | 关了 cron 但业务仍依赖自动任务。 |
| `hooks.enabled/path/token` | 外部事件接入。 | 对接三方系统时。 | path 暴露但 token 保护不足。 |
| `logging.level` | 全局日志级别。 | 排障与稳态切换时。 | 长期开 debug/trace，日志成本高。 |
| `logging.redactSensitive` | 敏感信息脱敏策略。 | 生产环境默认应开启。 | 为排障临时关闭后忘记恢复。 |
| `diagnostics.flags` | 精准诊断开关。 | 定位特定链路异常时。 | 一次性开太多 flag，噪音淹没信号。 |
| `diagnostics.otel.*` | 可观测上报到 OTel。 | 要接入监控平台时。 | endpoint/protocol 不匹配导致“看起来开了但没数据”。 |
| `update.channel` | 升级通道（stable/beta/dev）。 | 灰度尝鲜或稳定运营。 | 生产误用 dev 导致变更风险。 |
| `update.checkOnStart` | 启动即检查更新。 | 追求安全补丁及时性时。 | 与内网策略冲突导致启动报错。 |

### G. web / discovery / nodeHost

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `web.enabled` | 启用 Web 客户端侧连接能力（非 `tools.web`）。 | 需要浏览器/前端实时接入时。 | 与 `gateway` 暴露策略不一致，前端连不上。 |
| `web.heartbeatSeconds` | Web 连接心跳频率。 | 网络质量波动较大时。 | 设太小放大无效心跳流量，设太大故障发现变慢。 |
| `web.reconnect.initialMs` | 首次重连等待时间。 | 连接抖动导致短断线时。 | 初始间隔过大，用户体感“断线太久”。 |
| `web.reconnect.maxMs` | 重连退避上限。 | 后端间歇不可用时。 | 上限过大导致恢复后仍长时间不重连。 |
| `web.reconnect.factor/jitter/maxAttempts` | 重连退避曲线与随机抖动。 | 要平衡冲击与恢复速度时。 | 多端同时重连形成“惊群”。 |
| `discovery.wideArea.enabled` | 是否开启广域发现。 | 多节点跨网段部署时。 | 内网场景误开，增加噪声节点。 |
| `discovery.mdns.mode` | 局域网发现强度（`off/minimal/full`）。 | 设备自动发现策略调整时。 | 用 `full` 却没治理广播边界。 |
| `nodeHost.browserProxy.enabled` | 节点是否暴露本地浏览器代理。 | 需要把浏览器能力转发给 gateway 时。 | 默认开启导致节点暴露面扩大。 |
| `nodeHost.browserProxy.allowProfiles` | 节点允许暴露的浏览器 profile 列表。 | 多 profile 隔离时。 | 没配 allowlist，默认范围过宽。 |

### H. browser / ui

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `browser.enabled` | 浏览器自动化总开关。 | 启用/停用浏览器工具能力时。 | 关了还在页面里操作 browser 类功能。 |
| `browser.evaluateEnabled` | 是否允许浏览器执行 evaluate 类能力。 | 安全审计后按需开放时。 | 高风险环境误开，脚本执行边界变宽。 |
| `browser.cdpUrl` / `browser.profiles.*.cdpUrl` | 连接远程浏览器实例。 | 使用外部浏览器服务时。 | URL 可达但握手超时参数未同步。 |
| `browser.profiles.*.cdpPort` | 本地 profile 端口映射。 | 多 profile 并行调度时。 | 端口冲突导致 profile 间歇不可用。 |
| `browser.remoteCdpTimeoutMs` | 远程 CDP 总超时。 | 弱网或远程节点较远时。 | 超时过短导致频繁假失败。 |
| `browser.remoteCdpHandshakeTimeoutMs` | CDP 握手超时。 | 初次连接慢时。 | 只调总超时不调握手超时，首连仍失败。 |
| `browser.headless` / `browser.noSandbox` / `browser.attachOnly` | 浏览器运行方式。 | CI、容器、受限环境适配时。 | 生产开启 `noSandbox` 带来额外风险。 |
| `browser.defaultProfile` | 默认浏览器 profile。 | 统一入口 profile 时。 | 默认 profile 不存在，任务落到错误配置。 |
| `browser.snapshotDefaults.mode` | 截图/快照默认策略。 | 追求性能或精度时。 | 统一默认与单任务期望不一致。 |
| `ui.seamColor` | 控制台品牌主色/强调色。 | 视觉统一改版时。 | 色值不符合品牌规范影响可读性。 |
| `ui.assistant.name` | 助手展示名。 | 多助手/多品牌运营时。 | 名字改了但 agent 路由未改，用户认知错位。 |
| `ui.assistant.avatar` | 助手头像。 | 品牌统一或角色区分时。 | 资源路径不可访问导致头像缺失。 |

### I. wizard / meta

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `wizard.lastRunAt` | 记录引导最近执行时间。 | 审计首次部署流程时。 | 手工清理不当导致重复触发引导。 |
| `wizard.lastRunVersion` | 记录引导对应版本。 | 升级后验证引导迁移时。 | 版本信息滞后，排查升级问题困难。 |
| `wizard.lastRunCommit` | 记录引导对应提交。 | 需要精确追踪发布差异时。 | 只看版本不看 commit，定位不准确。 |
| `wizard.lastRunCommand` | 记录引导执行命令。 | 复盘部署路径时。 | 命令历史缺失，运维难复现。 |
| `wizard.lastRunMode` | 记录 local/remote 引导模式。 | 本地与远程流程混用时。 | 模式不明导致错误套用部署步骤。 |
| `meta.lastTouchedVersion` | 配置文件最近被 OpenClaw 写入的版本。 | 追踪谁在何版本改了配置时。 | 当作业务字段手动维护。 |
| `meta.lastTouchedAt` | 配置最近写入时间戳。 | 排查“什么时候被改动”时。 | 被外部脚本覆盖，审计价值下降。 |

### J. bindings / audio

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `bindings[].agentId` | 指定命中的会话应路由给哪个 agent。 | 多 agent 分流上线时。 | agentId 拼错导致回退到默认 agent。 |
| `bindings[].match.channel` | 按渠道做绑定。 | 同时接入多渠道时。 | 渠道名不一致（如别名）导致匹配不到。 |
| `bindings[].match.accountId` | 按账号细分绑定。 | 一个渠道多个账号运营时。 | 忘配 account 维度导致跨账号串线。 |
| `bindings[].match.peer.kind/id` | 按会话对象精确绑定（私聊/群/频道）。 | 重点客户、重点群定向服务时。 | `direct`/`group` 语义理解错，命中异常。 |
| `bindings[].match.guildId/teamId` | 按组织维度绑定。 | 企业协作平台分组织治理时。 | 组织 ID 填错，策略形同虚设。 |
| `audio.transcription.command` | 音频转写执行命令（数组，首项需安全可执行）。 | 接入本地/自定义转写器时。 | 命令可执行但参数不兼容，转写失败。 |
| `audio.transcription.timeoutSeconds` | 转写超时。 | 音频时长或环境性能变化时。 | 过短导致长音频被截断失败。 |

### K. talk / canvasHost / voicewake / presence

| 字段 | 业务作用 | 什么时候改 | 常见坑 |
|---|---|---|---|
| `talk.voiceId` | 默认语音 ID。 | 品牌音色或角色语气调整时。 | 声线 ID 与服务端可用模型不匹配。 |
| `talk.voiceAliases` | 语音别名映射。 | 多角色语音快速切换时。 | 别名冲突导致命中错误声音。 |
| `talk.modelId` | 语音合成/会话模型。 | 质量与延迟权衡调整时。 | 只换模型不评估成本和延迟。 |
| `talk.outputFormat` | 语音输出格式。 | 对接播放器/渠道格式要求时。 | 下游不支持该编码格式。 |
| `talk.apiKey` | 语音服务凭证。 | 首次开通或轮换密钥时。 | 密钥泄露到日志/截图。 |
| `talk.interruptOnSpeech` | 是否允许用户插话打断播报。 | 追求自然对话体验时。 | 对客服播报类场景误开，影响完整播报。 |
| `canvasHost.enabled` | 画布宿主服务开关。 | 开启可视化协作能力时。 | 打开后未同步网关路由策略。 |
| `canvasHost.root` | 画布资源目录。 | 自定义画布产物目录时。 | 路径错误导致页面可开但资源 404。 |
| `canvasHost.port` | 画布服务端口。 | 与现有服务端口避让时。 | 端口冲突引发启动失败。 |
| `canvasHost.liveReload` | 画布热更新。 | 本地开发调试时。 | 生产误开引入不稳定热更新行为。 |
| `channels.discord.intents.presence` | Discord Presence intent 开关（唯一常见 presence 配置位）。 | 需要状态感知能力时。 | intent 与 Discord 开发者后台权限不一致。 |

> 说明（避免误解）  
> `voicewake` 当前不是 `openclaw.json` 顶层 schema 字段，实际由 `$OPENCLAW_STATE_DIR/settings/voicewake.json` 管理，核心是 `triggers` 与 `updatedAtMs`。  
> `presence` 主要是系统运行态事件（`system-presence`）与渠道 intent 能力，不是独立的主配置 section。

### 配置可信性机制

- `config.get` 返回 `hash`。
- `config.set/apply` 带 `baseHash`。
- hash 冲突拒绝写入，防并发覆盖。
- 支持 redacted 密钥恢复。

### 典型风险

1. Form 模式遇到 schema 不支持路径时会警告，复杂项应改用 Raw。
2. 用户容易混淆 `Save` 与 `Apply`（前者写入，后者写入并触发应用流程）。

---

## 2.12 Debug

### 页面目标（用户视角）

- 排障与验收页面：看状态快照，手工发 RPC，读事件日志。

### 页面字段与操作

| 字段/控件 | 业务含义 |
|---|---|
| `Status/Health/Heartbeat` | 快速确认当前故障层级（配置/网络/节点/服务）。 |
| `Manual RPC Method` | 直接调用某个网关方法做验证。 |
| `Params (JSON)` | 自定义参数构造复现场景。 |
| `Call` | 执行手工 RPC。 |
| `Models` | 检查模型目录是否可见。 |
| `Event Log` | 看最近网关事件。 |

### RPC / 数据流

- `status` / `health` / `models.list` / `debug.call`

### 持久化

- 不写配置。

### 典型风险

- 手工 RPC 无字段保护，参数拼错会被当作系统错误。

---

## 2.13 Logs

### 页面目标（用户视角）

- 在线 tail 网关日志，按级别和关键字筛查问题。

### 页面字段与操作

| 字段/控件 | 业务含义 |
|---|---|
| `Filter` | 按关键词过滤日志内容。 |
| Level chips (`trace..fatal`) | 按级别过滤，聚焦高优先级错误。 |
| `Auto-follow` | 类似 `tail -f`，持续跟随。 |
| `Refresh` | 手动重拉最新日志。 |
| `Export visible/filtered` | 导出当前视图用于复盘。 |
| `truncated` 提示 | 告知当前只显示截断窗口。 |

### RPC / 数据流

- `logs.tail`

### 持久化

- 不写配置。

### 典型风险

- 过滤后只看到局部日志，容易忽略上下文链路。

---

## 3. 这 13 页“如何实现配置与管理”

### 3.1 实现模式总结

1. **运行态面板**：`chat/overview/instances/sessions/usage/debug/logs`
- 核心是“读状态 + 调动作”，不动配置文件。

2. **任务/能力面板**：`cron/skills`
- 管理的是子系统数据或能力状态，非 `openclaw.json` 主配置。

3. **配置面板**：`channels/agents/nodes/config`
- 本质统一落到 `config.get + config.set/apply`。
- 区别只是入口是“局部可视化”还是“全量可视化”。

### 3.2 Dashboard 当前存在的问题（不是崩溃 bug，而是工程/体验问题）

1. 页面边界对新用户不够直观：
- 用户难以分辨“这页改的是运行态还是配置态”。

2. 复杂页面认知负担高：
- `channels/agents/nodes/config` 字段极多，且有继承/覆盖语义。

3. 局部编辑与全局编辑并存：
- 同一字段既可在 `config` 页改，也可在 `channels/agents/nodes` 改，容易造成“在哪里改更对”的困惑。

4. Usage 有结果上限：
- 超过 1000 sessions 需要缩短时间窗，否则统计并非全量。

---

## 4. ClawUI 对接问题（现状）

> 结论：**有明显不一致，且会导致“前端显示可改，但后端实际语义不对或根本没写进去”。**

### 4.1 类型与真实配置结构不一致

- `packages/types/src/config.ts` 仍是 legacy 结构：
- `gateway.token`（真实是 `gateway.auth.token`）
- `tools.access/allow/deny`（真实主线是 `tools.profile/alsoAllow/deny/byProvider/...`）

### 4.2 IPC 白名单会丢字段

- `electron/main/ipc/config.ts` 的 `config:set` 只允许：
- `gateway/agents/session/channels/tools/cron/hooks`
- 像 `mcp` 会被拒绝。

### 4.3 Store 与桥接语义错位

- `src/store/mcp/index.ts` 在写 `mcp.servers`。
- 但 IPC 白名单不放行 `mcp`，用户在 UI 里改了可能不会落盘。

### 4.4 渠道模型简化过度

- `src/store/channels/index.ts` 使用统一 `ChannelConfig`，并包含 `wechat` 这类并非当前 Dashboard 核心路径。
- 无法表达 OpenClaw 渠道 schema 里大量嵌套字段（accounts/intents/retry/dm/group 等）。

### 4.5 缺少 Dashboard 的关键安全机制

- ClawUI 当前桥接未完整暴露：
- `config.schema/uiHints`（无法 schema 驱动渲染）
- `baseHash` 并发控制
- redacted 值恢复

---

## 5. 建议方案：统一“配置中间件”（强烈建议）

## 5.1 目标

- 前端任何配置操作都走同一条可信链路。
- 让“可视化操作 = 真实生效”，并且可并发、可回滚、可解释。

## 5.2 中间件能力（建议最小集）

1. `getSnapshot()`
- 返回 `{ config, raw, hash, schema, uiHints }`。

2. `patch(path, value)` / `remove(path)`
- 只改内存草稿，记录变更 diff。

3. `validateDraft()`
- 统一 schema 校验并回传字段级错误。

4. `saveDraft(baseHash)` / `applyDraft(baseHash)`
- 统一调用 `config.set` / `config.apply`，处理 hash 冲突。

5. `reload()`
- 强制拉最新快照并重建草稿。

6. `redactionSafeMerge()`
- 对敏感字段做 redacted 恢复，避免误清空。

## 5.3 前端分层建议

1. `ConfigDomain`（真实字段模型）
- 直接对齐 OpenClaw schema，不再维护 legacy 字段。

2. `ViewModel Adapter`（页面专用）
- 各页面把复杂字段映射成易懂 UI 结构。

3. `Page Stores`
- 只管理 UI 状态（展开/筛选/临时输入），不直接写文件。

4. `Config Middleware` 统一落盘
- 所有“保存”都经过 hash + validate + diff 流程。

## 5.4 迁移优先级

1. 先修 `config:set` 白名单（至少放行 `mcp` 与 schema 驱动需要的顶层项）。
2. 把 `packages/types/src/config.ts` 对齐真实结构（去 legacy 主路径）。
3. 先迁 `channels/agents/nodes` 三个高风险页面到中间件。
4. 最后迁剩余设置型 store（tools/settings/mcp）。

---

## 6. Dashboard ↔ CLI 对照（便于排障/回退）

| Dashboard 页面 | CLI 对照 |
|---|---|
| Overview（连接入口） | `openclaw dashboard --no-open`、`openclaw doctor --generate-gateway-token` |
| Config | `openclaw config get/set/unset` |
| Channels | `openclaw channels ...`（按渠道命令） |
| Cron | `openclaw cron ...` |
| Nodes / Devices | `openclaw nodes ...`、`openclaw devices ...` |
| Exec approvals | `openclaw approvals ...` |
| Skills | `openclaw skills ...` |
| Logs | `openclaw logs ...` |

CLI 的价值：当 UI 复杂或字段难懂时，可用 CLI 做“最小可复现改动”，再回 UI 验证。

---

## 7. 最终判断

1. OpenClaw Dashboard 的配置管理能力本身是成熟的（schema 驱动 + hash 并发 + redaction）。
2. 真正问题在于 ClawUI 当前仍在 legacy 语义层，和 OpenClaw 真实字段模型分叉。
3. 如果不先做“统一配置中间件”，前端每个页面都在重复造映射，长期一定继续错位。
