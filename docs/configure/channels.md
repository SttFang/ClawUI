# 渠道配置

> 来源：源码分析 (2026-02-09)

## 概述

OpenClaw 支持 20+ 消息渠道，常用的包括：

| 渠道 | 状态 | 说明 |
|------|------|------|
| Telegram | ✅ 推荐 | 最简单，Bot API |
| Discord | ✅ 推荐 | Bot API |
| WhatsApp | ✅ | 通过 Baileys 库 |
| Slack | ✅ | Bolt SDK |
| Signal | ⚠️ | 需要 signal-cli |
| 微信 | ⚠️ | 需要第三方桥接 |

## 配置结构

```json5
// ~/.openclaw/openclaw.json
{
  channels: {
    telegram: { /* ... */ },
    discord: { /* ... */ },
    whatsapp: { /* ... */ },
    slack: { /* ... */ }
  }
}
```

## Telegram 配置

### 1. 创建 Bot

1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot`
3. 按提示设置 Bot 名称和用户名
4. 获取 Bot Token

### 2. 配置

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",

      // DM 策略
      dmPolicy: "pairing",  // pairing | allowlist | open | disabled

      // 群组策略
      groupPolicy: "allowlist",  // allowlist | open | disabled

      // 群组中需要 @mention 才响应
      requireMention: true,

      // 允许列表 (dmPolicy/groupPolicy 为 allowlist 时)
      allowFrom: [
        "123456789",     // 用户 ID
        "-1001234567890"  // 群组 ID
      ]
    }
  }
}
```

### DM 策略说明

| 策略 | 说明 |
|------|------|
| `pairing` | 首次需要配对码验证 |
| `allowlist` | 仅允许列表中的用户 |
| `open` | 任何人都可以使用 |
| `disabled` | 禁用 DM |

## Discord 配置

### 1. 创建 Bot

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建 Application
3. 在 Bot 页面创建 Bot
4. 复制 Bot Token
5. 在 OAuth2 页面生成邀请链接

### 2. 配置

```json5
{
  channels: {
    discord: {
      enabled: true,
      // Token 通过环境变量设置
      // DISCORD_BOT_TOKEN=...

      // 群组策略
      groupPolicy: "open",  // allowlist | open | disabled

      // 历史消息限制
      historyLimit: 20,

      // 允许的服务器/频道 (groupPolicy 为 allowlist 时)
      allowFrom: [
        "server_id",
        "channel_id"
      ]
    }
  }
}
```

## WhatsApp 配置

WhatsApp 通过 [Baileys](https://github.com/WhiskeySockets/Baileys) 库实现，需要扫描二维码登录。

### 配置

```json5
{
  channels: {
    whatsapp: {
      enabled: true,

      // DM 策略
      dmPolicy: "allowlist",

      // 允许的号码
      allowFrom: [
        "+15551234567",
        "+8613800138000"
      ],

      // 媒体文件大小限制 (MB)
      mediaMaxMb: 50
    }
  }
}
```

### 首次登录

```bash
openclaw whatsapp:login
# 会显示二维码，使用 WhatsApp 手机 App 扫描
```

## Slack 配置

### 1. 创建 App

1. 访问 [Slack API](https://api.slack.com/apps)
2. 创建 App
3. 启用 Socket Mode
4. 添加 Bot Token Scopes
5. 安装到 Workspace

### 2. 配置

```json5
{
  channels: {
    slack: {
      enabled: true,
      appToken: "${SLACK_APP_TOKEN}",  // xapp-...
      botToken: "${SLACK_BOT_TOKEN}",  // xoxb-...

      // 响应设置
      requireMention: true
    }
  }
}
```

## 微信配置 (实验性)

微信需要通过第三方桥接服务，如 [WeChatFerry](https://github.com/lich0821/WeChatFerry)。

```json5
{
  channels: {
    wechat: {
      enabled: true,
      // 桥接服务地址
      bridgeUrl: "ws://localhost:10086",
      // 允许的用户
      allowFrom: ["wxid_xxx"]
    }
  }
}
```

## 会话管理

### 会话范围

```json5
{
  session: {
    // per-sender: 每个发送者独立会话
    // per-channel-peer: 每个渠道/群组独立
    // main: 所有消息共享会话
    scope: "per-sender",

    // 会话重置策略
    reset: {
      mode: "idle",      // idle | daily
      idleMinutes: 60    // idle 模式下的超时时间
    }
  }
}
```

### 会话 Key 格式

```
agent:{agentId}:{provider}:{scope}:{identifier}

示例:
- main:telegram:dm:123456789
- main:discord:channel:channel_id
- main:whatsapp:dm:+15551234567
```

## UI 设计参考

### 渠道配置页面

```
┌─────────────────────────────────────────────────────────┐
│ 渠道配置                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Telegram                                    [已连接] ✅ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Bot: @my_awesome_bot                                │ │
│ │ DM 策略: [配对模式 ▼]  群组策略: [允许列表 ▼]       │ │
│ │ [断开连接] [重新配置]                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Discord                                     [未连接] ⚪ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [连接 Discord Bot]                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ WhatsApp                                    [未连接] ⚪ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [扫描二维码登录]                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 配置向导流程

```
Telegram 配置向导

步骤 1/3: 输入 Bot Token
┌─────────────────────────────────────────────────────────┐
│ 请输入从 @BotFather 获取的 Bot Token:                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 123456789:ABCdefGHI...                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                        [取消] [下一步]  │
└─────────────────────────────────────────────────────────┘

步骤 2/3: 选择访问策略
┌─────────────────────────────────────────────────────────┐
│ 谁可以使用这个 Bot?                                     │
│                                                         │
│ ○ 仅限我自己 (推荐)                                     │
│ ○ 指定用户/群组                                         │
│ ○ 任何人 (不推荐)                                       │
│                                        [上一步] [下一步] │
└─────────────────────────────────────────────────────────┘

步骤 3/3: 测试连接
┌─────────────────────────────────────────────────────────┐
│ ✅ 连接成功!                                            │
│                                                         │
│ Bot: @my_awesome_bot                                    │
│ 状态: 在线                                              │
│                                                         │
│ 现在可以在 Telegram 中与 Bot 对话了                     │
│                                        [完成]            │
└─────────────────────────────────────────────────────────┘
```
