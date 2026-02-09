# OpenClaw 架构概览

> 来源：DeepWiki 研究 (2026-02-09)

## 1. 整体架构

OpenClaw 采用 **hub-and-spoke 架构**，核心是一个 Gateway 进程。

```
┌─────────────────────────────────────────────────────────────────┐
│                         Gateway (核心)                          │
│                    ws://127.0.0.1:18789                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Control     │  │ Channel     │  │ Agent       │              │
│  │ Plane       │  │ Adapters    │  │ Runtime     │              │
│  │ (WebSocket) │  │ (平台集成)   │  │ (Pi Agent)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐                               │
│  │ Tool Layer  │  │ Storage     │                               │
│  │ (策略过滤)   │  │ Layer       │                               │
│  └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

### 架构层次

| 层级 | 功能 |
|------|------|
| Control Plane | WebSocket 服务器，处理 RPC 请求 |
| Channel Adapters | WhatsApp、Telegram、Discord、Slack、Signal 集成 |
| Agent Runtime | Pi Agent Core，独立工作区和会话历史 |
| Tool Layer | 基于策略的工具执行 |
| Storage Layer | 配置、会话、认证、工作区文档 |

## 2. 系统要求

| 要求 | 规格 |
|------|------|
| Node.js | **>= 22.x** (必需) |
| 磁盘空间 | ~200MB (基础安装) |
| 内存 | 最低 512MB，推荐 2GB+ |

### 关键依赖

- `@mariozechner/pi-agent-core` — Agent 执行引擎
- `@whiskeysockets/baileys` — WhatsApp 集成
- `grammy` — Telegram 机器人框架
- `discord.js` — Discord 集成
- `@slack/bolt` — Slack 集成

## 3. 安装方式

```bash
# 方式 1: 自动安装器
curl -fsSL https://openclaw.bot/install.sh | bash

# 方式 2: npm 全局安装
npm install -g openclaw@latest

# 方式 3: 源码构建
git clone https://github.com/openclaw/openclaw
cd openclaw && pnpm install && pnpm build
```

## 4. Gateway 工作原理

### 消息处理管道

```
入站消息 → 访问控制 → 会话解析 → 配置加载 →
系统提示构建 → 模型 API 调用 → 工具执行 →
会话保存 → 频道投递
```

### 会话 Key 格式

> 更完整的 sessionKey 规则请看：`docs/openclaw/session-management.md`

```
agent:{agentId}:{mainKey}
示例: agent:main:main

# 常见扩展（按配置与 channel 不同会变化）
agent:{agentId}:{channel}:dm:{peerId}
agent:{agentId}:{channel}:{peerKind}:{peerId}   # peerKind=group/channel
```

## 5. API 协议

> 建议先读：`docs/openclaw/README.md`

### WebSocket RPC

```typescript
// Request
{ type: "req", id: string, method: string, params: object }

// Response
{ type: "res", id: string, ok: boolean, payload?: any, error?: any }

// Event
{ type: "event", event: string, payload: any, seq?: number }
```

### 核心方法

| 方法 | 功能 |
|------|------|
| `connect` | 握手认证 |
| `chat.send` | WebChat 发送消息（流式输出走 `event chat`） |
| `chat.abort` | 中断当前 run |
| `chat.history` | 拉取历史（用于 UI 回放/重建） |
| `agent` | 通用 Agent 调度（可选 deliver 到 channel） |
| `node.list` / `node.invoke` | 设备节点操作 |
| `config.get` / `config.patch` | 配置管理 |
| `sessions.*` | 会话管理（list/preview/patch/reset/compact/resolve） |

### HTTP 端点

| 端点 | 功能 |
|------|------|
| `GET /` | Dashboard UI |
| `POST /v1/chat/completions` | OpenAI 兼容 API |
| `GET/POST /canvas/*` | Canvas 文件服务 |

## 6. CatchClaw 集成方案

### 推荐方案：WebSocket 直连 + 嵌入式 Gateway

```
┌─────────────────────────────────────────────┐
│             ClawUI (Electron)               │
├─────────────────────────────────────────────┤
│  Main Process                               │
│  ┌─────────────────────────────────────┐   │
│  │ Gateway (子进程)                     │   │
│  │ ws://127.0.0.1:18789                │   │
│  └─────────────────────────────────────┘   │
│              ↑ WebSocket                    │
│  ┌─────────────────────────────────────┐   │
│  │ Renderer Process (React UI)         │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 优势

- ✅ 完全离线运行
- ✅ 利用已有工具执行策略
- ✅ 会话管理和多 Agent 支持
- ✅ OpenAI 兼容 API 可复用现有客户端

### 挑战

- ⚠️ 需要 Node.js >= 22（用户可能没有）
- ⚠️ Gateway 包体积较大

## 下一步

1. 研究如何在 Electron 中内嵌 Node.js runtime
2. 研究 OpenClaw 是否支持 programmatic API
3. 设计最小配置引导流程
