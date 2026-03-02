<div align="center">
<img src="resources/icon.png" width="120" height="120" alt="ClawUI" />

# ClawUI

**OpenClaw 的桌面客户端 — 让你的 AI 助手拥有一个真正的控制台。**

[![Release](https://img.shields.io/github/v/release/SttFang/ClawUI?include_prereleases&style=flat-square&color=blue)](https://github.com/SttFang/ClawUI/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/SttFang/ClawUI/ci.yml?branch=master&style=flat-square)](https://github.com/SttFang/ClawUI/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)](#-从源码构建)

**English** · [简体中文](docs/README_ZH.md) · [文档](https://docs.openclaw.ai) · [更新日志](CHANGELOG.md)

[官网](https://openclaw.ai) · [OpenClaw Gateway](https://github.com/openclaw/openclaw) · [反馈问题](https://github.com/SttFang/ClawUI/issues)

</div>

<!-- TODO: 产品截图 -->
<!-- <p align="center"><img src="docs/assets/preview.png" width="800" /></p> -->

---

## 概述

[OpenClaw](https://github.com/openclaw/openclaw) 是一个运行在本地的个人 AI 助手网关 — 多模型接入、多渠道消息路由、Agent 编排、工具执行、定时任务调度，全部在你的机器上完成。

**ClawUI** 是 OpenClaw 的官方桌面客户端。它把 OpenClaw 的全部能力封装为原生桌面应用，提供完整的可视化管理界面：从对话交互到 Agent 配置，从渠道路由到用量追踪，不再需要手动编辑 JSON 或盯着终端。

> 一句话：OpenClaw 是引擎，ClawUI 是仪表盘。

---

## 核心功能

<br/>

<!-- <p align="center"><img src="docs/assets/onboarding.png" width="800" /></p> -->

### `01` 打开就能用

你不需要读文档，不需要改 JSON，不需要在终端里敲命令。

ClawUI 首次启动会自动进入引导流程：检测 OpenClaw 是否安装、确认 Runtime 版本、拉起 Gateway、建立连接。你只需要点几下「下一步」，就从零到一个完整可用的 AI 助手。如果 Gateway 意外退出，ClawUI 会自动帮你重启。

<br/>

<!-- <p align="center"><img src="docs/assets/chat.png" width="800" /></p> -->

### `02` 不只是聊天框

对话界面基于 Streamdown 引擎逐字流式输出，针对中日韩排版做了专门优化。代码块由 Shiki 渲染，支持 150+ 语言的语法高亮；数学公式走 KaTeX 实时排版；Mermaid 流程图直接在消息气泡里展开 — 不需要复制到别的工具里看。

侧边栏可以直接预览工作区里的 PDF、Word、Excel、代码文件和图片，不用离开对话窗口。每个 Agent 独立维护自己的会话历史，支持创建、归档、切换和上下文压缩。

<br/>

<!-- <p align="center"><img src="docs/assets/execution.png" width="800" /></p> -->

### `03` AI 做什么，你说了算

Agent 每一次工具调用都不会静默执行 — ClawUI 会弹出审批卡片，你可以选择放行、拒绝、或者修改参数后再执行。这不是事后通知，是事前审批。

执行结束后，整条调用链会渲染成一张交互式 DAG 图。如果 Agent 调用了 Sub-Agent，多级工作流也会完整展开。点击任意节点可以查看输入输出、耗时和 Token 消耗。你能清楚地看到 AI 做了什么、为什么做、花了多少。

<br/>

<!-- <p align="center"><img src="docs/assets/agents.png" width="800" /></p> -->

### `04` 一个面板管理整个 Agent

Agent 的所有配置集中在一个控制台里，分成四个 Tab：

- **Skills** — 技能网络图，用拓扑图展示 Agent 的能力结构和技能依赖关系
- **Channels** — 把 Agent 接入 Telegram / Discord / WhatsApp / Slack / Signal，一键绑定
- **Nodes** — 查看已连接的设备节点，管理多端协同
- **Cron** — 日历视图 + Cron 表达式，让 Agent 在指定时间自动执行任务

多个 Agent 之间可以自由切换，每个 Agent 独立维护会话、能力和渠道配置。

<br/>

<!-- <p align="center"><img src="docs/assets/channels.png" width="800" /></p> -->

### `05` 一个 AI，所有平台

在 ClawUI 里配好渠道信息，你的 AI 助手就会同时出现在 Telegram、Discord、WhatsApp、Slack 和 Signal 上。不需要为每个平台单独部署 Bot — 同一个 Agent 共享上下文和全部能力，桌面端和消息平台的对话完全互通。

配置方式很简单：填入 Bot Token 或 Webhook URL，选择路由策略，设好群组白名单就行。

<br/>

<!-- <p align="center"><img src="docs/assets/usage.png" width="800" /></p> -->

### `06` API 账单不再是黑箱

每个会话用了多少 Token、花了多少钱，ClawUI 帮你按模型、按 Provider、按天拆得清清楚楚。每日趋势图让你一眼看到消耗走势，异常消费直接定位到具体会话。不用再自己去各家 Provider 后台对账了。

<br/>

### `07` 主 Gateway 挂了也能自救

Rescue Agent 运行在一个独立的 Gateway 实例上，和主 Gateway 完全隔离。当主 Gateway 出现连接问题、配置错误或认证失败时，切到 Rescue Agent 就能在 App 内诊断问题 — 检查进程状态、读日志、验证配置、测试连接，不需要打开终端。

<br/>

### `08` 设置中心

| 模块 | 说明 |
|------|------|
| **通用** | 语言切换（中文 / English）、深色 / 浅色主题、自动更新 |
| **AI 服务** | Provider 认证（Anthropic OAuth、OpenAI、Google、自定义 API Key）、默认模型、参数调优 |
| **消息渠道** | Bot Token、Webhook、路由策略、群组白名单、消息过滤 |
| **能力** | 工具权限、插件管理、技能安装与卸载、MCP Server 配置 |

---

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│                      ClawUI (Electron)                       │
│                                                              │
│  ┌───────────────┐       ┌───────────────────────────────┐  │
│  │  Main Process  │       │      Renderer (React 19)      │  │
│  │                │       │                               │  │
│  │  Gateway 生命   │       │  对话 · Agent · 用量 · 设置    │  │
│  │  周期管理       │ ◄───► │  渠道 · 调度器 · Rescue       │  │
│  │  IPC 桥接      │       │                               │  │
│  │  自动更新       │       │  28 Zustand stores            │  │
│  │  RSA 设备认证   │       │  80+ React 组件               │  │
│  └───────┬────────┘       └───────────────────────────────┘  │
│          │                                                   │
└──────────┼───────────────────────────────────────────────────┘
           │ WebSocket (ACP 协议)
           ▼
┌────────────────────────────┐
│     OpenClaw Gateway       │
│     ws://127.0.0.1:18789   │
└──┬───┬───┬───┬───┬───┬─────┘
   │   │   │   │   │   │
   AI  TG  DC  WA  SK  Tools / Skills / Plugins / MCP
```

---

## 从源码构建

> 当前版本尚未上传预编译安装包，请通过源码构建。Release 下载将在后续版本提供。

**前置条件**：Node >= 22、pnpm、[OpenClaw](https://github.com/openclaw/openclaw) 已安装

```bash
git clone https://github.com/SttFang/ClawUI.git
cd ClawUI && pnpm install

pnpm build:mac       # macOS
pnpm build:win       # Windows
pnpm build:linux     # Linux
```

---

## 快速开始

```bash
# 1. 安装 OpenClaw
npm i -g openclaw@latest
openclaw onboard --install-daemon

# 2. 克隆并启动 ClawUI
git clone https://github.com/SttFang/ClawUI.git
cd ClawUI && pnpm install && pnpm dev
```

启动后 ClawUI 将自动检测 OpenClaw 安装、启动 Gateway 并建立 WebSocket 连接。Onboarding 向导会引导你完成首次配置。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 + electron-vite |
| 前端 | React 19 + React Router 7 + Tailwind CSS 4 |
| UI 组件 | shadcn/ui（[@clawui/ui](packages/ui)） |
| 状态管理 | Zustand 5（28 stores） |
| 代码渲染 | Shiki 语法高亮 · LaTeX (KaTeX) · Mermaid |
| 流式渲染 | Streamdown（CJK / Code / Math / Mermaid） |
| 文件预览 | pdfjs-dist · docx-preview · ExcelJS |
| DAG 可视化 | React Flow + dagre 自动布局 |
| 图标 | Lucide React |
| 国际化 | i18next（中文 + English） |
| 日志 | electron-log v5（敏感数据脱敏） |
| 测试 | Vitest + Playwright |

---

## 参与贡献

欢迎提交 Issue 和 Pull Request。

```bash
pnpm install       # 安装依赖
pnpm dev           # 启动开发环境
pnpm lint          # 代码检查
bun run type-check # 类型检查
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 路线图

- [ ] 知识库管理（RAG 文档索引与检索）
- [ ] Agent 市场（社区共享 Agent 模板）
- [ ] MCP Server 市场
- [ ] 多窗口 / 多实例支持
- [ ] 移动端适配（响应式布局）
- [ ] 插件系统（自定义面板扩展）

---

## 许可证

[MIT](LICENSE) © [SttFang](https://github.com/SttFang)

---

<div align="center">

如果 ClawUI 对你有帮助，请给一个 ⭐ Star，这是对我们最大的支持。

[![Star History Chart](https://api.star-history.com/svg?repos=SttFang/ClawUI&type=Date)](https://star-history.com/#SttFang/ClawUI&Date)

</div>
