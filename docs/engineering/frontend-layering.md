# Frontend 分层约束（component / feature / route）

## 目标

- 保持路由层轻量，避免业务副作用散落在页面入口。
- 让业务编排集中在 feature 层，降低重构成本。
- 让 component 保持纯展示与复用能力。

## 分层职责

### `src/routes/**`

- 负责：路由 path、query 解析、重定向、页面壳挂载。
- 不负责：复杂数据加载编排、跨 store 业务流程、IPC 直连。

### `src/features/**`

- 负责：页面级业务编排（store 聚合、状态流、交互流程）。
- 负责：把复杂状态与回调压缩为可维护的 feature API。
- 不负责：定义全局路由。

### `src/components/**`

- 负责：通用 UI 组件、展示组件、轻量交互组件。
- 不负责：业务 IPC 编排与跨域状态决策。

## 连接策略（Chat / Gateway）

- 全局统一入口：`src/services/chat/connection.ts`
  - `ensureChatConnected(url?)`
  - `disconnectChat()`
  - `isChatConnected()`
- 规则：禁止在 route/feature/component 中直接调用 `ipc.chat.connect()`。
- 若需新建连接逻辑，先扩展 connection service，再由上层调用。

## Settings 路由规范

- 单一事实源：`src/router/settingsRouteSchema.ts`
  - tabs、sections、alias 路由映射统一维护。
- 禁止在 `main.tsx`、`settings/page.tsx`、`ConfigTab.tsx` 重复硬编码 section 字符串。

## 新页面落地建议

1. 先建 `features/<Domain>/<Domain>Feature.tsx` 编排业务。
2. `routes/<domain>/page.tsx` 只返回 `<DomainFeature />`。
3. 可复用展示块放入 `components/`；业务私有块优先留在 `features/`。

