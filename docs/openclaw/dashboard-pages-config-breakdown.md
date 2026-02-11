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

不改 `openclaw.json` 的页面：`chat/overview/instances/sessions/usage/cron/skills/debug/logs`（这些页面主要是运行态、统计态或子系统数据管理）。

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

- `presence.list`

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

- 主要是技能子系统状态，不直接等同 `openclaw.json` 顶层字段。

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

### section 业务解读（用户思维）

| section | 用户关心点 |
|---|---|
| `gateway` | 网关如何暴露、如何鉴权、Control UI 如何访问。 |
| `agents` | agent 默认模型、工作目录、记忆检索等“智能行为底座”。 |
| `tools` | 工具权限边界、安全级别、web/exec/media 能力。 |
| `channels` | 多渠道接入与策略。 |
| `auth` | 多账号轮换与失败回退。 |
| `models` | 模型目录与别名映射。 |
| `session/messages/commands` | 对话策略、回复行为、命令权限。 |
| `memory` | 长记忆/知识检索能力。 |
| `skills/plugins` | 能力扩展与生态。 |
| `cron/hooks/web/discovery` | 自动化与集成。 |
| `logging/diagnostics` | 可观测与排障。 |

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

