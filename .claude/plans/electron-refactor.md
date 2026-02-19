# Electron 主进程架构重构蓝图

> 基于三线并行调研（安全 / 服务架构 / DX），汇总产出。
> 日期：2026-02-16

---

## 全局目标

将 `electron/main/` 从当前的"能跑就行"状态升级为 **安全加固、职责清晰、模式统一** 的工程化架构，同时保持向后兼容、零功能回归。

---

## 一、新目录结构

```
electron/main/
├── index.ts                              # 入口（精简：工厂函数 + 生命周期）
├── constants.ts                          # 全局常量
├── utils/
│   ├── login-shell.ts                    # macOS login shell PATH 解析
│   ├── openclaw-cli.ts                   # CLI 输出解析
│   ├── type-guards.ts                    # 类型守卫
│   ├── safe-path.ts                      # [新] 路径遍历防护
│   └── safe-exec.ts                      # [新] 安全命令执行（无 shell 拼接）
├── window/
│   ├── create-main-window.ts             # 窗口创建
│   └── chrome-config.ts                  # 窗口配置常量
├── lib/logger/                           # 日志系统（增强 redact）
├── ipc/
│   ├── forward.ts                        # [新] 事件转发工具
│   └── *.ts                              # 各 handler 文件
├── preload/
│   ├── index.ts                          # preload 主文件（用 helpers 去重）
│   └── helpers.ts                        # [新] createEventListener / createInvoker
└── services/
    ├── chat/
    │   ├── run-state.ts                  # Run 生命周期（缩减至 ~280 行）
    │   ├── approval-state.ts             # [新] Approval 管理（~120 行）
    │   ├── transport.ts                  # WebSocket 连接（缩减至 ~280 行）
    │   ├── acp-connect.ts                # [新] ACP 握手协议（~130 行）
    │   ├── event-adapter.ts              # 事件归一化（暂不拆分）
    │   ├── event-parsers.ts              # 消息文本提取
    │   ├── device-auth.ts                # 设备认证
    │   ├── device-identity.ts            # 设备身份
    │   └── run-types.ts                  # 类型定义
    ├── config/                           # [新] 配置管理统一目录
    │   ├── config-store.ts               # [重命名] ConfigService → ConfigStore
    │   ├── config-orchestrator.ts        # Gateway/本地双通道
    │   ├── config-repository.ts          # 配置检查 + onboarding 视图
    │   ├── snapshot-redact.ts            # 脱敏/还原
    │   └── config-utils.ts              # [新] deepMerge / getNestedValue（去重）
    ├── credentials/                      # [新] 凭证管理统一目录
    │   ├── credential-service.ts         # CRUD 核心（缩减至 ~180 行）
    │   ├── encrypted-cache.ts            # [新] safeStorage 加密缓存
    │   ├── legacy-migration.ts           # [新] 旧格式迁移
    │   ├── credential-defs.ts            # 凭证定义常量
    │   ├── credential-helpers.ts         # 工具函数
    │   ├── tool-credential-registry.ts   # 工具凭证定义
    │   ├── auth-profile-adapter.ts       # auth-profiles.json CRUD
    │   ├── external-cli-sync.ts          # 外部 CLI 同步
    │   └── oauth-service.ts              # GitHub Copilot OAuth
    ├── gateway/                          # [新] Gateway 统一目录
    │   └── gateway-service.ts            # [移动] 进程管理 + 状态机
    ├── chat-websocket.ts                 # 组合层
    ├── openclaw-profiles.ts              # 多 profile 管理
    ├── clawui-state.ts                   # UI 状态持久化
    ├── runtime-detector.ts               # 运行时检测
    ├── installer.ts                      # npm install
    ├── updater.ts                        # 自动更新
    └── configurator.ts                   # Onboarding 配置器
```

**新增文件 6 个**，删除 0 个，移动/重命名 ~15 个。

---

## 二、四波迁移计划

### Wave 1 — 安全加固 + 基础设施（无依赖，可并行）

> 目标：消除所有 P0 安全问题 + 建立基础工具层

| # | 任务 | 新增文件 | 修改文件 | 风险 |
|---|------|---------|---------|------|
| 1.1 | **redact 栈溢出修复** — WeakSet 循环检测 + MAX_DEPTH=10 | — | `lib/logger/redact.ts` | 极低 |
| 1.2 | **safe-path 工具** — `resolve()` + 相对路径检查 | `utils/safe-path.ts` | `ipc/workspace.ts` (4处) | 低 |
| 1.3 | **safe-exec 工具** — `execFile` 直传参数数组 | `utils/safe-exec.ts` | `ipc/gateway.ts` (3处), `services/installer.ts` | 低* |
| 1.4 | **IPC 通道对齐** — 删除死 handler + 补 preload | — | `ipc/gateway.ts`, `preload/index.ts` | 极低 |
| 1.5 | **初始化分层** — critical/non-critical try-catch | — | `index.ts` | 行为变更 |
| 1.6 | **activate 窗口重建** — `createAndSetupMainWindow()` 工厂 | — | `index.ts`, `ipc/chat.ts`, `services/chat-websocket.ts` | 接口变更 |
| 1.7 | **preload helpers** — `createEventListener` / `createInvoker` | `preload/helpers.ts` | `preload/index.ts` | 低 |
| 1.8 | **IPC 转发工具** — `forwardToWindow` / `broadcastToWindows` | `ipc/forward.ts` | `ipc/chat.ts`, `ipc/rescue.ts`, `ipc/gateway.ts` | 低 |
| 1.9 | **空 catch 修复** — 全局 9 处空 catch 添加日志 | — | 7 个文件 | 极低 |
| 1.10 | **CSP 加固** — production 白名单端口 + 新增 object-src/base-uri | — | `index.ts` | 中（需验证 WS） |

*1.3 需验证 macOS 下通过绝对路径执行 openclaw/npm 是否正常。

### Wave 2 — 目录重组（依赖 Wave 1 完成）

> 目标：建立 config/ credentials/ gateway/ 子目录，移动文件

| # | 任务 | 操作 | 修改文件 |
|---|------|------|---------|
| 2.1 | 创建 `services/config/` 目录 | 移动 4 文件 + 新增 `config-utils.ts` | 所有 import 该模块的文件 |
| 2.2 | 创建 `services/credentials/` 目录 | 移动 8 文件 | 所有 import 该模块的文件 |
| 2.3 | 创建 `services/gateway/` 目录 | 移动 1 文件 | 所有 import 该模块的文件 |
| 2.4 | 消除文件级单例 | `installer.ts` 等底部的 `export const` 移到 `index.ts` | `index.ts` + 相关 ipc 文件 |
| 2.5 | 导入路径全量更新 | 所有 `ipc/*.ts` + `index.ts` 的 import 路径 | ~20 文件 |

### Wave 3 — 模块拆分（依赖 Wave 2 完成）

> 目标：拆分超长文件，建立清晰职责边界

| # | 任务 | 新增文件 | 源文件 | 目标行数 |
|---|------|---------|--------|---------|
| 3.1 | `run-state.ts` → + `approval-state.ts` | `approval-state.ts` (~120行) | `run-state.ts` 436→~280 | <300 |
| 3.2 | `transport.ts` → + `acp-connect.ts` | `acp-connect.ts` (~130行) | `transport.ts` 431→~280 | <300 |
| 3.3 | `credential-service.ts` → + `encrypted-cache.ts` + `legacy-migration.ts` | 2 个新文件 | `credential-service.ts` 307→~180 | <200 |
| 3.4 | `deepMerge` 去重 | 提取到 `config/config-utils.ts` | `config.ts` + `clawui-state.ts` | — |

### Wave 4 — 类型安全 + 规范统一（依赖 Wave 3 完成）

> 目标：消除 any，统一命名和模式

| # | 任务 | 涉及文件 |
|---|------|---------|
| 4.1 | `any` 类型清理 — `config.ts:152` 改 `Record<string, unknown>`；`clawui-state.ts` 用 `config-utils.deepMerge` | 2 文件 |
| 4.2 | `SENSITIVE_PATTERNS` 增强 — 5→20 个 regex | `lib/logger/redact.ts` |
| 4.3 | `secrets.ts` 单一数据源 — `SECRET_REGISTRY` 替代双数据结构 | `ipc/secrets.ts` |
| 4.4 | `node:` 前缀统一 | 6+ 文件 |
| 4.5 | handler 参数命名统一 `_` | 14 个 IPC 文件 |
| 4.6 | channel 命名修正 `isConnected` → `is-connected` | preload + main + renderer 三层 |

---

## 三、错误处理规范

### 分层策略

| 层级 | 策略 | 示例 |
|------|------|------|
| **I/O 边界** | catch → log → 返回安全默认值 或 re-throw with context | `ConfigStore.loadConfig` |
| **业务逻辑** | 不 catch，冒泡到上层 | `ChatRunState`, `ApprovalState` |
| **IPC Handler** | catch → log.error → 返回 `{ ok: false, error }` | 所有 `ipc/*.ts` |
| **生命周期** | critical: dialog + exit; non-critical: log.warn + 降级 | `index.ts` 初始化序列 |

### 硬规则

1. **禁止空 catch** — 每个 catch 至少 log.debug
2. **禁止 `.catch(() => {})`** — 改为 `.catch(err => log.debug("[xxx.ignored]", err))`
3. **统一错误消息提取**：`errorMessage(err: unknown): string`

---

## 四、关键设计决策

| 决策 | 结论 | 理由 |
|------|------|------|
| `event-adapter.ts` 是否拆分？ | **暂不拆分** | 417 行在阈值附近，4 个 ingest 方法操作同一 state，拆分破坏事务性 |
| `gateway.ts` 是否拆分？ | **仅移动目录，不拆** | 293 行低于阈值，职责内聚 |
| `ChatWebSocketService` 是否拆分？ | **不拆** | 它是正确的组合层（facade），legacy stream 映射未来可提取 |
| `execInLoginShell` 是否删除？ | **保留但收窄** | macOS 需要 login shell 的 PATH；仅用于 `resolveCommandPath`，实际执行走 `safeExecFile` |
| `ConfigService` 重命名？ | **→ ConfigStore** | 消除与 ConfigOrchestrator/ConfigRepository 的命名混淆 |
| channel `isConnected` 修正？ | **放 Wave 4** | 需同步三层（preload/main/renderer），风险中等 |

---

## 五、改动统计

| 指标 | 数量 |
|------|------|
| 新增文件 | 6 |
| 移动/重命名文件 | ~15 |
| 修改文件 | ~30 |
| 删除文件 | 0 |
| 消除的代码重复 | ~120 行（preload 监听器 + 转发 + deepMerge） |
| 消除的安全漏洞 | 6 个 P0 |
| 修复的空 catch | 9 处 |
| 清理的 any | 5 处 |

---

## 六、验证门禁

每波完成后必须通过：

```bash
bun run type-check                                    # 类型检查
bunx vitest run --silent='passed-only' 'electron/'    # 相关测试
pnpm lint                                             # 代码检查
pnpm format:check                                     # 格式检查
```

Wave 1.3（safe-exec）和 Wave 1.10（CSP）需要额外的手动 QA：
- macOS 下 `openclaw gateway install/start/stop` 通过绝对路径执行
- production 构建中 WebSocket 连接正常

---

## 七、里程碑

| Milestone | 包含 Wave | 核心交付 |
|-----------|----------|---------|
| **M1: 安全加固** | Wave 1 | 0 个 P0 安全问题 |
| **M2: 目录重组** | Wave 2 | 清晰的模块边界 |
| **M3: 模块拆分** | Wave 3 | 所有文件 <400 行 |
| **M4: 规范统一** | Wave 4 | 0 个 any + 统一命名 |
