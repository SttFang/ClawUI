# 工程规范：可维护性与代码质量

本规范用于降低回归风险、提升可读性，并为 PR Review 提供统一标准。

## 1. 大文件治理（>300 行）

目标：避免“巨型文件”导致的 review 成本高、改动耦合重、回归难定位。

推荐拆分方式（按常见场景）：
- Routes 页面：拆成 `Filters` / `Grid(List)` / `Dialog(Modal)` / `EmptyState` 等小组件
- Store：拆成 `state/actions/selectors`（或至少把 selectors 抽到单独区域/文件）
- 表单：用“表单模型 + 视图组件”拆分，避免 8+ 个 `useState` 分散管理

例外与原则：
- 测试文件允许更长，但建议按领域拆：`actions.test.ts`、`selectors.test.ts`、`ipc.test.ts`
- 拆分不是目的：优先以“边界清晰”“可测试”“可复用”为准

## 2. Zustand selector 稳定引用（React 19）

背景：React 19 + `useSyncExternalStore` 场景下，如果 selector 在同一 snapshot 对象上返回新引用（新数组/新对象），可能导致不必要的重渲染，甚至无限更新。

规则：
- selector 返回 `Array/Object` 时，必须保证对“同一 snapshot 对象”返回稳定引用
- 推荐使用 `createWeakCachedSelector`（基于 `WeakMap` 按 snapshot identity 缓存结果）
- selectors 必须有稳定性测试（至少覆盖一次 “同 state 对象调用两次返回同引用”）

## 3. IPC 类型单一来源 + Chat 幂等键

规则：
- 跨进程 payload 类型优先来自 `@clawui/types/*`，避免 renderer/preload/main 三处手写结构漂移
- WebChat 必须使用 `messageId` 作为幂等键（OpenClaw: `chat.send.params.idempotencyKey`），并贯穿：
  - renderer 占位 assistant message 的 `id`
  - IPC `ChatRequest.messageId`
  - gateway `event chat.payload.runId`

收益：
- 消除“占位 id 替换”的竞态，避免流式 delta 找不到 message 而丢失更新
- 更容易把 tool/lifecycle 等事件归并到同一 runId 上（后续扩展）

## 4. 表单与值语义（避免 `|| ''`）

规则：
- number/string 的空值处理不要用 `|| ''`（会把 `0`、空串等合法值误判为空）
- 推荐用 `??` 或显式类型判断：
  - `typeof v === 'number' ? String(v) : ''`
  - `typeof v === 'string' ? v : ''`
- 表单 state 推荐集中管理（`useReducer` 或单对象 `useState(form)`），减少分散状态导致的 bug

## 5. UI 组件一致性

规则：
- 优先使用 `@clawui/ui` 提供的输入控件（`Input/Select/Switch/...`），减少原生控件与 UI 组件混用造成的样式/交互不一致。

