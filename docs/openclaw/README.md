# OpenClaw Docs（面向 ClawUI 集成）

本目录用于沉淀 ClawUI 对接 OpenClaw Gateway（WebSocket RPC + Events）时**需要关心的返回结构**与**执行语义**。

## 索引

- `docs/openclaw/gateway-protocol.md`：Gateway 帧结构、connect 握手、methods/events 速查
- `docs/openclaw/streaming-events.md`：`event chat` / `event agent` 的流式语义（delta/工具流）
- `docs/openclaw/agent-execution-flow.md`：Agent 执行链路（输入→会话→Prompt→工具→输出→落盘）
- `docs/openclaw/system-prompt.md`：System Prompt 结构、动态拼装点、与配置/工具/技能的关系
- `docs/openclaw/session-management.md`：SessionKey/SessionId、存储路径、Gateway 会话方法与 UI 对接建议
- `docs/openclaw/control-ui-nodes.md`：Control UI 的 `/nodes` 页面管理什么、对应 RPC/schema、配对与权限策略
- `docs/openclaw/persistence-and-policies.md`：身份/渠道/权限/拓展/定时任务/skills 的落盘 schema 与迁移/写入策略

## 来源

- DeepWiki：`openclaw/openclaw` 章节 5.1/5.2/5.3
- OpenClaw 源码（本机）：`/Users/fanghanjun/openclaw`
