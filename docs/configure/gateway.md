# Gateway 配置

> 来源：源码分析 + DeepWiki (2026-02-09)

## 概述

OpenClaw Gateway 是核心服务，提供：
- WebSocket 控制平面 (RPC 通信)
- HTTP REST API (OpenAI 兼容)
- Canvas 文件服务

默认端口：**18789**

## 配置结构

```json5
// ~/.openclaw/openclaw.json
{
  gateway: {
    // 监听端口
    port: 18789,

    // 绑定地址 (本地使用)
    bind: "127.0.0.1",

    // 认证 Token (必须设置)
    token: "${OPENCLAW_GATEWAY_TOKEN}",

    // 跨域设置
    cors: {
      enabled: true,
      origins: ["http://localhost:*"]
    },

    // TLS 设置 (可选)
    tls: {
      enabled: false,
      cert: "/path/to/cert.pem",
      key: "/path/to/key.pem"
    }
  }
}
```

## 认证 Token

**重要**：必须设置 Gateway Token 以确保安全。

### 生成 Token

```bash
# 生成随机 Token
openssl rand -hex 32
```

### 配置方式

**方式 1: 环境变量**
```bash
export OPENCLAW_GATEWAY_TOKEN="your-secure-token-here"
```

**方式 2: .env 文件**
```bash
# ~/.openclaw/.env
OPENCLAW_GATEWAY_TOKEN=your-secure-token-here
```

**方式 3: 配置文件**
```json5
{
  gateway: {
    token: "your-secure-token-here"
  }
}
```

## WebSocket API

### 连接

```javascript
const ws = new WebSocket('ws://127.0.0.1:18789');

// 认证
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'req',
    id: '1',
    method: 'connect',
    params: {
      token: 'your-gateway-token'
    }
  }));
};
```

### 消息格式

**请求**
```json
{
  "type": "req",
  "id": "unique-id",
  "method": "method-name",
  "params": {}
}
```

**响应**
```json
{
  "type": "res",
  "id": "unique-id",
  "ok": true,
  "payload": {}
}
```

**事件**
```json
{
  "type": "event",
  "event": "event-name",
  "payload": {},
  "seq": 1
}
```

### 核心方法

| 方法 | 功能 |
|------|------|
| `connect` | 握手认证 |
| `agent` | 执行 Agent 轮次 |
| `send` | 投递消息到频道 |
| `node.list` | 列出设备节点 |
| `node.invoke` | 调用设备操作 |
| `config.get` | 获取配置 |
| `config.patch` | 更新配置 |

## HTTP API

### OpenAI 兼容端点

```bash
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer your-gateway-token

{
  "model": "anthropic/claude-sonnet-4-5-20250929",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true
}
```

### 其他端点

| 端点 | 方法 | 功能 |
|------|------|------|
| `/` | GET | Dashboard UI |
| `/v1/chat/completions` | POST | OpenAI 兼容 Chat |
| `/canvas/*` | GET/POST | Canvas 文件服务 |
| `/health` | GET | 健康检查 |

## Cron 定时任务

### 配置

```json5
{
  cron: {
    enabled: true,
    store: "~/.openclaw/cron/jobs.json"
  }
}
```

### 任务定义

```json5
// ~/.openclaw/cron/jobs.json
{
  "jobs": [
    {
      "id": "daily-summary",
      "name": "每日总结",
      "enabled": true,
      "schedule": {
        "type": "cron",
        "expression": "0 9 * * *",
        "timezone": "Asia/Shanghai"
      },
      "execution": {
        "mode": "isolated",
        "payload": {
          "kind": "agentTurn",
          "message": "生成今日工作总结"
        }
      },
      "delivery": {
        "type": "announce",
        "channel": "telegram",
        "to": "123456789"
      }
    }
  ]
}
```

### Cron 表达式

```
┌──────────── 分钟 (0-59)
│ ┌────────── 小时 (0-23)
│ │ ┌──────── 日期 (1-31)
│ │ │ ┌────── 月份 (1-12)
│ │ │ │ ┌──── 星期 (0-7, 0和7都是周日)
│ │ │ │ │
* * * * *
```

常用示例：
- `0 9 * * *` - 每天 9:00
- `0 */2 * * *` - 每 2 小时
- `0 9 * * 1-5` - 周一到周五 9:00
- `0 9,18 * * *` - 每天 9:00 和 18:00

## CatchClaw 集成

### 启动 Gateway

```typescript
// electron/main/services/gateway.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export class GatewayService {
  private process: ChildProcess | null = null;
  private port = 18789;

  async start(): Promise<void> {
    // 检测系统 Node.js 或使用内嵌版本
    const nodePath = await this.getNodePath();
    const openclawPath = await this.getOpenClawPath();

    this.process = spawn(nodePath, [openclawPath, 'gateway'], {
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: await this.getToken(),
        PORT: String(this.port)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // 等待 Gateway 就绪
    await this.waitForReady();
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  getWebSocketUrl(): string {
    return `ws://localhost:${this.port}`;
  }

  private async waitForReady(): Promise<void> {
    // 轮询健康检查端点
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/health`);
        if (response.ok) return;
      } catch {
        // 继续等待
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Gateway startup timeout');
  }
}
```

### WebSocket 客户端

```typescript
// src/lib/gateway-client.ts
export class GatewayClient {
  private ws: WebSocket | null = null;
  private requestMap = new Map<string, { resolve: Function; reject: Function }>();
  private seq = 0;

  async connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        try {
          await this.call('connect', { token });
          resolve();
        } catch (e) {
          reject(e);
        }
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'res') {
          const handler = this.requestMap.get(msg.id);
          if (handler) {
            this.requestMap.delete(msg.id);
            if (msg.ok) {
              handler.resolve(msg.payload);
            } else {
              handler.reject(new Error(msg.error));
            }
          }
        }
      };

      this.ws.onerror = reject;
    });
  }

  async call<T>(method: string, params: object = {}): Promise<T> {
    const id = String(++this.seq);
    return new Promise((resolve, reject) => {
      this.requestMap.set(id, { resolve, reject });
      this.ws?.send(JSON.stringify({
        type: 'req',
        id,
        method,
        params
      }));
    });
  }

  close(): void {
    this.ws?.close();
  }
}
```

## UI 设计参考

### Gateway 状态显示

```
┌─────────────────────────────────────────────────────────────────┐
│ Gateway 状态                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 状态: ● 运行中                                                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 端口:     18789                                             │ │
│ │ 地址:     ws://127.0.0.1:18789                             │ │
│ │ 运行时间: 2 小时 15 分钟                                    │ │
│ │ 连接数:   3                                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 活动渠道                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ● Telegram   @my_bot      已连接                            │ │
│ │ ● Discord    MyBot#1234   已连接                            │ │
│ │ ○ WhatsApp   +1234...     未连接                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                          [查看日志] [重启 Gateway]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 定时任务管理

```
┌─────────────────────────────────────────────────────────────────┐
│ 定时任务                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [+ 新建任务]                                                    │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⏰ 每日总结                           [启用] [编辑] [删除]  │ │
│ │    每天 09:00 · Telegram @123456789                         │ │
│ │    上次执行: 今天 09:00 ✓                                   │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ⏰ 周报提醒                           [启用] [编辑] [删除]  │ │
│ │    每周五 18:00 · Discord #general                          │ │
│ │    上次执行: 上周五 18:00 ✓                                 │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ⏰ 备份提醒                           [禁用] [编辑] [删除]  │ │
│ │    每月 1 日 00:00 · Telegram @123456789                    │ │
│ │    上次执行: 从未                                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
