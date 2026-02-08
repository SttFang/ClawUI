# OpenClaw 配置指南

> 来源：源码分析 (2026-02-09)

## 配置概览

OpenClaw 使用 **JSON5 格式**配置文件，支持注释和尾逗号。

主配置文件位置：`~/.openclaw/openclaw.json`

### 配置模块

| 模块 | 文档 | 说明 |
|------|------|------|
| [models](./models.md) | 模型配置 | API Key、Provider、默认模型 |
| [channels](./channels.md) | 渠道配置 | Telegram、Discord、WhatsApp 等 |
| [skills](./skills.md) | Skills 配置 | 官方/自定义 Skills |
| [plugins](./plugins.md) | Plugins 配置 | 工具扩展插件 |
| [gateway](./gateway.md) | Gateway 配置 | 端口、认证、网络 |

## 配置文件结构

```json5
// ~/.openclaw/openclaw.json
{
  // Gateway 设置
  gateway: { /* 见 gateway.md */ },

  // 模型与提供商
  providers: { /* 见 models.md */ },
  agents: { /* 见 models.md */ },

  // 消息渠道
  channels: { /* 见 channels.md */ },

  // Skills 与 Plugins
  skills: { /* 见 skills.md */ },
  plugins: { /* 见 plugins.md */ },

  // 定时任务
  cron: { /* 见 gateway.md */ },

  // 环境变量
  env: { /* API Keys 等 */ }
}
```

## 配置验证

OpenClaw 使用 **Zod Schema** 进行配置验证，无效配置会在启动时报错。

关键验证文件：
- `src/config/zod-schema.ts` - Schema 定义
- `src/config/types.openclaw.ts` - TypeScript 类型

## 配置热重载

部分配置支持热重载：

| 配置项 | 热重载 | 说明 |
|--------|--------|------|
| providers | ✅ | API Key 更改即时生效 |
| channels | ✅ | 渠道设置变更即时生效 |
| gateway.port | ❌ | 需重启 Gateway |
| skills | ✅ | 新 skill 即时可用 |

热重载监听文件：
- `~/.openclaw/openclaw.json`
- `~/.openclaw/agents/{agentId}/config.json`

## 环境变量支持

配置值支持环境变量插值：

```json5
{
  providers: {
    anthropic: {
      apiKey: "${ANTHROPIC_API_KEY}"  // 从环境变量读取
    }
  }
}
```

环境变量来源（按优先级）：
1. 系统环境变量
2. `~/.openclaw/.env` 文件
3. 配置文件中的 `env` 字段

## CatchClaw UI 映射

| 配置模块 | UI 页面 | 说明 |
|----------|---------|------|
| providers + agents.defaults.model | 设置 > 模型 | API Key 输入、模型选择 |
| channels | 渠道配置 | 各渠道开关与认证 |
| skills | 插件管理 | Skills 列表与启用 |
| plugins | 工具管理 | 工具权限控制 |
| gateway | 高级设置 | 端口、认证 |
