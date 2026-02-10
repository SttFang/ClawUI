# OpenClaw Session 管理（SessionKey / SessionId / Store / Transcript）

本页对齐 DeepWiki（5.3 Session Management）与 OpenClaw 源码，梳理会话体系的关键概念与 Gateway 方法，便于 ClawUI 替代 dashboard 后能正确展示/管理会话。

主要参考：
- DeepWiki：`https://deepwiki.com/openclaw/openclaw/5.3-session-management`
- 源码：`/Users/fanghanjun/openclaw/src/config/paths.ts`
- 源码：`/Users/fanghanjun/openclaw/src/config/sessions/paths.ts`
- 源码：`/Users/fanghanjun/openclaw/src/config/sessions/store.ts`
- 源码：`/Users/fanghanjun/openclaw/src/config/sessions/types.ts`
- 源码：`/Users/fanghanjun/openclaw/src/config/sessions/session-key.ts`
- 源码：`/Users/fanghanjun/openclaw/src/routing/session-key.ts`
- 源码：`/Users/fanghanjun/openclaw/src/gateway/server-methods/sessions.ts`

## 1. 两个 id：SessionKey vs SessionId

### 1.1 SessionKey（逻辑会话桶）

- 作用：把消息“归类到哪个会话上下文里”（对话历史、配置 override、投递策略等都挂在 sessionKey 上）
- 形式：一般是 `agent:...` 前缀的 key（也可能是 legacy/alias）

示例：
- 主会话：`agent:main:main`
- 全局会话（当 `session.scope="global"`）：`global`
- 群组/频道：`agent:main:discord:group:<id>` 这类（实际格式以 resolver 为准）

### 1.2 SessionId（落盘 transcript 的文件 id）

- 作用：对应 transcript `.jsonl` 文件名（以及 session store entry 的 `sessionId` 字段）
- reset 后变化：`sessions.reset` 会生成新 sessionId（保留部分 override 字段）

## 2. 存储：state dir / store.json / transcript.jsonl

### 2.1 State Dir（默认 ~/.openclaw）

OpenClaw 的可变状态目录默认是 `~/.openclaw`，可由 env 覆盖：
- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_PATH`（仅 config 文件路径）

源码：`/Users/fanghanjun/openclaw/src/config/paths.ts`

### 2.2 Session Store（sessions.json）

默认 session store 路径（按 agentId 分桶）：

```
~/.openclaw/agents/<agentId>/sessions/sessions.json
```

源码：`resolveDefaultSessionStorePath(...)`（`/Users/fanghanjun/openclaw/src/config/sessions/paths.ts`）

### 2.3 Transcript（jsonl）

每个 sessionId 对应一份 transcript（JSONL），默认路径：

```
~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl
```

源码：`resolveSessionTranscriptPath(...)`

## 3. SessionKey 的派生与规范化

### 3.1 scope：global vs per-sender

- `session.scope="global"`：所有对话都落在 `global`
- 否则（默认 per-sender）：会从 ctx（from、group、channel）派生 bucket

源码：`deriveSessionKey(...)` / `resolveSessionKey(...)`（`/Users/fanghanjun/openclaw/src/config/sessions/session-key.ts`）

### 3.2 “主会话”折叠规则

在 per-sender 模式下，OpenClaw 会把“非群组 direct chat”折叠到 canonical main sessionKey：

```
agent:main:<mainKey>
```

`mainKey` 默认是 `"main"`，可通过 `session.mainKey` 配置改写。

源码：
- `resolveMainSessionKey(...)`（`/Users/fanghanjun/openclaw/src/config/sessions/main-session.ts`）
- `buildAgentMainSessionKey(...)`（`/Users/fanghanjun/openclaw/src/routing/session-key.ts`）

这对 ClawUI 的含义：
- v1 若你想做“单界面配置 + 多系统管理”，chat UI 可以先只做 main sessionKey（稳定、简单）

## 4. SessionEntry（store 里每个 key 的内容）

SessionEntry 很大，但 ClawUI v1 主要关心这些字段：
- `sessionId`：指向 transcript
- `updatedAt`：列表排序/最近活跃
- `systemSent`：是否已发送过系统介绍（避免重复）
- `abortedLastRun`：上次是否中断（UI 可提示）
- `thinkingLevel` / `verboseLevel` / `reasoningLevel`：运行偏好
- `providerOverride` / `modelOverride`：模型选择 override
- `sendPolicy`：投递策略（allow/deny）
- `skillsSnapshot`：技能快照（可选）
- `systemPromptReport`：提示词体积/注入文件/工具 schema 体积（适合诊断面板）

源码：`/Users/fanghanjun/openclaw/src/config/sessions/types.ts`

## 5. Gateway 会话方法（sessions.*）

OpenClaw Gateway 对 session 的管理主要通过这些方法（源码：`/Users/fanghanjun/openclaw/src/gateway/server-methods/sessions.ts`）：

- `sessions.list`：列出 session keys（可过滤/分页）
- `sessions.preview`：读取 transcript 片段用于 UI 预览（不拉全量）
- `sessions.resolve`：把输入参数（如 channel/from/group）解析成 canonical key
- `sessions.patch`：更新 session entry（label、overrides、sendPolicy…）
- `sessions.reset`：创建新 sessionId（清空对话历史，保留部分偏好字段）
- `sessions.compact`：压缩/整理 transcript（用于长期会话的“瘦身”）

ClawUI v1 的落地建议：
- 不做全量 sessions 管理 UI 也没关系，但至少保留：
  - main session 的 reset（清空会话）
  - main session 的 model/thinking/verbose 选择（如果你想让 UI 可控）

## 6. ClawUI 如何区分 Discord session 和 UI session（避免混淆）

OpenClaw 的 sessionKey 允许自由扩展，但它在“渠道会话”上有一套稳定的命名约定（见 `buildAgentPeerSessionKey` 相关逻辑）：

- 渠道会话通常形如：
  - `agent:<agentId>:<channel>:<peerKind>:<peerId>`
  - 或带 accountId 的变体：`agent:<agentId>:<channel>:<accountId>:<peerKind>:<peerId>`
- 其中 `<channel>` 常见取值：`discord` / `telegram` / `slack` / `wechat` / `whatsapp` / `signal`
- `<peerKind>` 常见取值：`direct` / `group` / `channel`

这对 ClawUI 的含义：

1. **用 sessionKey 前缀做来源隔离（推荐）**
   - ClawUI 自己创建的会话统一使用固定前缀，例如：`agent:main:ui:<uuid>`
   - 这样在 `sessions.list` 里可以 100% 准确地按前缀过滤 UI 会话，避免与 Discord/Telegram 等渠道会话混在一起。

2. **把 ClawUI 内部“系统会话”隐藏**
   - 例如本项目 metadata 生成用到的：`clawui:meta:<sessionKey>`（落到 store 里往往会成为 `agent:main:clawui:meta:...`）
   - 这种会话只是 ClawUI 内部用途，不应出现在普通会话列表里（否则用户会误以为是“真实对话”）。

3. **不要把 `agent:main:main` 当作 UI 会话**
   - OpenClaw 的 DM scope 在一些配置下会折叠到 main sessionKey（`agent:main:main`）。
   - 如果把它当作 UI 会话展示，会导致“Discord 私聊”和“UI 对话”混写到同一个 bucket。

源码参考：
- sessionKey 结构与派生：`/Users/fanghanjun/openclaw/src/routing/session-key.ts`
- 解析工具：`/Users/fanghanjun/openclaw/src/sessions/session-key-utils.ts`
