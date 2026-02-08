# 模型配置

> 来源：源码分析 (2026-02-09)

## 概述

模型配置涉及两个部分：
1. **Providers** - API Key 和基础 URL
2. **Agents** - 模型选择和默认参数

## Provider 配置

```json5
// ~/.openclaw/openclaw.json
{
  providers: {
    // Anthropic Claude
    anthropic: {
      apiKey: "${ANTHROPIC_API_KEY}",
      // 可选：自定义 base URL
      baseUrl: "https://api.anthropic.com"
    },

    // OpenAI
    openai: {
      apiKey: "${OPENAI_API_KEY}",
      baseUrl: "https://api.openai.com/v1"
    },

    // Google Gemini
    google: {
      apiKey: "${GOOGLE_API_KEY}"
    },

    // OpenRouter (多模型网关)
    openrouter: {
      apiKey: "${OPENROUTER_API_KEY}",
      baseUrl: "https://openrouter.ai/api/v1"
    },

    // 自定义 OpenAI 兼容 API
    custom: {
      apiKey: "${CUSTOM_API_KEY}",
      baseUrl: "https://your-api-endpoint.com/v1"
    }
  }
}
```

### 支持的 Provider

| Provider | 模型 ID 前缀 | 说明 |
|----------|-------------|------|
| anthropic | `anthropic/` | Claude 系列 |
| openai | `openai/` | GPT 系列 |
| google | `google/` | Gemini 系列 |
| openrouter | `openrouter/` | 多模型聚合 |

## Agent 配置

```json5
{
  agents: {
    // 默认配置（所有 Agent 继承）
    defaults: {
      workspace: "~/.openclaw/workspace",
      model: {
        // 主模型
        primary: "anthropic/claude-sonnet-4-5-20250929",
        // 备用模型列表
        fallbacks: [
          "openai/gpt-4o",
          "google/gemini-2.0-flash"
        ]
      },
      // 沙箱设置
      sandbox: {
        enabled: true
      }
    },

    // 特定 Agent 配置
    custom: {
      "coding-agent": {
        model: {
          primary: "anthropic/claude-sonnet-4-5-20250929"
        }
      }
    }
  }
}
```

## 模型 ID 格式

```
{provider}/{model-name}
```

示例：
- `anthropic/claude-sonnet-4-5-20250929`
- `openai/gpt-4o`
- `google/gemini-2.0-flash`
- `openrouter/anthropic/claude-3-opus`

## 双模式配置 (CatchClaw)

CatchClaw 支持两种模式：

### 1. 自带 Key (BYOK) 模式

用户提供自己的 API Key：

```json5
{
  providers: {
    anthropic: {
      apiKey: "sk-ant-..."  // 用户输入
    }
  }
}
```

### 2. 订阅模式

使用 CatchClaw 后端代理：

```json5
{
  providers: {
    catchclaw: {
      apiKey: "${CATCHCLAW_SUBSCRIPTION_TOKEN}",
      baseUrl: "https://api.catchclaw.ai/v1"
    }
  },
  agents: {
    defaults: {
      model: {
        primary: "catchclaw/claude-sonnet-4-5-20250929"
      }
    }
  }
}
```

## 模型参数

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5-20250929",
        // 温度 (0-2)
        temperature: 0.7,
        // 最大 token
        maxTokens: 4096,
        // Top P
        topP: 0.9
      }
    }
  }
}
```

## API Key 安全

**重要**：API Key 存储在本地配置文件中，CatchClaw 应该：

1. 使用操作系统的安全存储（macOS Keychain / Windows Credential Manager）
2. 配置文件中使用环境变量引用
3. 显示时遮盖敏感信息

```typescript
// electron/main/services/keychain.ts
import keytar from 'keytar';

export async function saveApiKey(provider: string, key: string) {
  await keytar.setPassword('catchclaw', provider, key);
}

export async function getApiKey(provider: string) {
  return await keytar.getPassword('catchclaw', provider);
}
```

## UI 设计参考

### 模型设置页面

```
┌─────────────────────────────────────────────────────┐
│ 模型设置                                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ API Key 配置                                         │
│ ┌─────────────────────────────────────────────────┐│
│ │ Anthropic   [sk-ant-****] [测试] [删除]          ││
│ │ OpenAI      [未配置]       [添加]                 ││
│ │ Google      [未配置]       [添加]                 ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ 默认模型                                             │
│ ┌─────────────────────────────────────────────────┐│
│ │ 主模型:    [Claude Sonnet 4.5        ▼]          ││
│ │ 备用模型:  [GPT-4o                   ▼]          ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ 模型参数                                             │
│ ┌─────────────────────────────────────────────────┐│
│ │ 温度:      [0.7            ]                     ││
│ │ 最大Token: [4096           ]                     ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```
