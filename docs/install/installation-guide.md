# OpenClaw 安装指南

> 来源：源码分析 + DeepWiki 研究 (2026-02-09)

## 系统要求

| 要求 | 规格 | 说明 |
|------|------|------|
| Node.js | **>= 22.12.0** | 必需，启动时强制检查 |
| 磁盘空间 | ~200MB | 基础安装 |
| 内存 | 最低 512MB | 推荐 2GB+ |

### Node.js 版本检查

OpenClaw 在启动时通过 `src/infra/runtime-guard.ts` 强制检查 Node.js 版本：

```typescript
const MIN_NODE = '22.12.0';
// 版本不满足会抛出错误并退出
```

## 安装方式

### 方式 1: 自动安装器 (推荐)

```bash
curl -fsSL https://openclaw.bot/install.sh | bash
```

### 方式 2: npm 全局安装

```bash
npm install -g openclaw@latest
```

### 方式 3: 从源码构建

```bash
git clone https://github.com/openclaw/openclaw
cd openclaw
pnpm install
pnpm build
```

## 首次配置

安装完成后，运行设置向导：

```bash
openclaw setup
```

向导会引导你完成：
1. API Key 配置 (Anthropic/OpenAI/其他)
2. 创建首个 Agent
3. 可选的渠道绑定 (Telegram/Discord 等)

## 验证安装

```bash
# 检查版本
openclaw --version

# 启动 Gateway
openclaw gateway

# Gateway 将在 ws://127.0.0.1:18789 启动
```

## CatchClaw 集成挑战

对于电脑小白用户，主要挑战是 **Node.js >= 22** 的要求。

### 解决方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **子进程 spawn** | 最可靠，完全隔离 | 需用户安装 Node.js 或打包运行时 | ⭐⭐⭐⭐⭐ |
| 直接 import | 集成度高 | Node.js 版本绑定，打包复杂 | ⭐⭐ |
| Docker sidecar | 完全隔离 | 需要 Docker，体积大 | ⭐⭐ |

### 推荐方案：子进程 + 内嵌 Node.js

```
CatchClaw.app/
├── Contents/
│   ├── MacOS/
│   │   └── CatchClaw           # Electron 主进程
│   └── Resources/
│       ├── app/                # Renderer 代码
│       └── runtime/
│           ├── node            # 内嵌 Node.js 22
│           └── openclaw/       # OpenClaw 包
```

启动流程：
1. CatchClaw 启动时检测系统是否有 Node.js >= 22
2. 如果没有，使用内嵌的 Node.js 运行时
3. 通过 spawn 启动 OpenClaw Gateway
4. 通过 WebSocket 与 Gateway 通信

### 为什么不能单文件打包

OpenClaw **不支持**打包成单文件，原因：
- 包含多个 native modules 阻止单文件打包：
  - `@lydell/node-pty` (终端)
  - `sharp` (图像处理)
  - `sqlite-vec` (向量数据库)
  - `@napi-rs/canvas` (画布)
- 构建工具 tsdown 是多入口打包，不支持 bundle

### 直接 import Gateway（高级用法）

虽然 OpenClaw 没有官方导出 Gateway 函数，但可以直接 import 内部模块：

```typescript
// 非官方 API，可能在版本更新时变化
import { startGatewayServer } from 'openclaw/dist/gateway/server.js';

const gateway = await startGatewayServer(18789, {
  bind: 'loopback',
  auth: { mode: 'token', token: 'your-token' },
});

// 关闭 Gateway
await gateway.close();
```

**注意**：此方式需要 Node.js >= 22.12.0，且依赖内部 API

## 目录结构

安装后，OpenClaw 使用以下目录：

```
~/.openclaw/
├── openclaw.json          # 主配置文件 (JSON5 格式)
├── .env                   # 环境变量
├── agents/
│   └── {agentId}/
│       ├── sessions/
│       │   ├── sessions.json    # 会话索引
│       │   └── {sessionId}.jsonl # 会话转录
│       └── config.json          # Agent 专属配置
├── workspace/             # 工作区文件
├── skills/                # Skills 目录
├── plugins/               # Plugins 目录
└── cron/
    ├── jobs.json          # Cron 任务定义
    └── runs/              # 执行历史
```

## 下一步

- [配置指南](../configure/README.md)
- [模型配置](../configure/models.md)
- [渠道配置](../configure/channels.md)
