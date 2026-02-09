# OpenClaw System Prompt（结构与拼装点）

本页对齐 DeepWiki（5.2 System Prompt）与 OpenClaw 源码，说明 System Prompt 在 OpenClaw 中是如何被构建、哪些段落是“硬编码固定规则”、哪些来自配置/运行时信息。

主要参考：
- DeepWiki：`https://deepwiki.com/openclaw/openclaw/5.2-system-prompt`
- 源码：`/Users/fanghanjun/openclaw/src/agents/system-prompt.ts`
- 源码：`/Users/fanghanjun/openclaw/src/agents/pi-embedded-runner/system-prompt.ts`
- 源码：`/Users/fanghanjun/openclaw/src/config/sessions/types.ts`（systemPromptReport）

## 1. 目的：让 Agent “知道自己在哪、能做什么、该怎么答”

OpenClaw 的 System Prompt 不是一段固定文本，而是由多个 section 拼接而成，用于：
- 定义 agent 身份、输出格式与风格约束
- 描述工具（tool）能力与使用规范
- 注入 workspace/repo 信息（让 agent 能在正确目录工作）
- 给出 channel/消息投递规则（如果运行在 Telegram/Discord 等环境）
- 可选注入技能（skills）与 memory recall 指令

## 2. PromptMode：主 agent / 子 agent 的不同“硬编码段落集”

OpenClaw 用 `PromptMode` 控制哪些 section 会被包含（`system-prompt.ts` 顶部注释）：
- `"full"`：完整（主 agent 默认）
- `"minimal"`：精简（多用于 subagent）
- `"none"`：几乎只保留 identity 行

这对 ClawUI 的影响：
- 如果未来支持多 agent/subagent，UI 里“同一 run 的 prompt 展示/调试”需要知道当前 mode

## 3. 典型 section（按实际实现归类）

下面是 OpenClaw 中常见的 section 类型（不同场景可能缺失某些段落）：

### 3.1 Skills（可选，full 才会包含）

当配置/运行时提供了 `skillsPrompt`，System Prompt 会增加一段“必须先扫描 skills 列表并按规则读取 SKILL.md”的规范说明。

源码：`buildSkillsSection(...)`（`system-prompt.ts`）

### 3.2 Memory Recall（可选）

当 runtime 里存在 `memory_search` / `memory_get` 之类工具时，Prompt 会包含“回答前先检索 memory”的规则，并可配置 citations 行为（`citationsMode`）。

源码：`buildMemorySection(...)`

### 3.3 User Identity（可选）

如果传入 `ownerLine`，会将“用户身份”作为独立 section 注入。

源码：`buildUserIdentitySection(...)`

### 3.4 Current Date & Time（可选）

当有 `userTimezone` 时，会注入当前时区信息。

源码：`buildTimeSection(...)`

### 3.5 Reply Tags / Messaging（可选，full 才会包含）

OpenClaw 支持在 reply 里嵌入类似 `[[reply_to_current]]` 的 tag 以控制“原地回复/引用回复”，并且会描述跨 session 投递（`sessions_send(sessionKey, message)`）的规则。

如果 runtime 提供了 `message` tool，Prompt 还会包含更细的 message tool 使用说明（包括避免重复回复的 `SILENT_REPLY_TOKEN` 机制）。

源码：`buildReplyTagsSection(...)` / `buildMessagingSection(...)`

### 3.6 Documentation（可选，full 才会包含）

当传入 `docsPath` 时，会把 OpenClaw docs（本地路径 + mirror 地址）写进 prompt，指导 agent “先看本地 docs 再做决定”。

源码：`buildDocsSection(...)`

### 3.7 工具清单（Tool Names + Summaries + Schemas）

System Prompt 会把工具能力以“可读清单 + JSON schema”形式写入，确保 agent 能正确构造 tool call 参数。

源码：
- `buildAgentSystemPrompt(...)` 参数：`toolNames` / `toolSummaries`
- `buildToolSummaryMap(...)`（pi-embedded-runner 侧拼装 tool summaries）

## 4. Embedded Pi Runner 如何调用（Gateway / WebChat 相关）

Gateway 的 WebChat / agent 调度最终都会走 embedded Pi runner 的 prompt 生成：

- `buildEmbeddedSystemPrompt(...)`（`/Users/fanghanjun/openclaw/src/agents/pi-embedded-runner/system-prompt.ts`）
  - 收集 runtimeInfo（os/arch/node/model/provider/channel/capabilities…）
  - 注入 tools、model alias lines、timezone、workspace notes、sandbox info 等
  - 统一调用 `buildAgentSystemPrompt(...)`

这意味着：
- ClawUI 如果要“解释为什么 agent 这样回答”，最真实的来源是 embedded runner 的最终 prompt

## 5. systemPromptReport：用于调试/可观测性的提示词报告

OpenClaw 会把 system prompt 的体积、注入的 workspace files、tools schema 大小等统计信息保存到 session entry 中（`SessionSystemPromptReport`）。

源码：`/Users/fanghanjun/openclaw/src/config/sessions/types.ts`

ClawUI 对接建议（v1）：
- UI 先不用展示完整 prompt（太长），但可以展示 report（chars、注入文件、tool schema 体积等）
- 后续若引入“诊断面板”，可在 `event agent` 流里补充 prompt report 或通过 gateway sessions 接口拉取

