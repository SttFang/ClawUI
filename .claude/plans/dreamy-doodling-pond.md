# 定时任务面板重构：持久化 + 按 Job 分组 + 右侧详情

## Context

当前 `CronResultList` 在无数据时 `return null`，导致整个「定时任务」section 消失。且 `gatewayActivity` store 无持久化，刷新后数据丢失。用户希望：
1. 空状态仍显示 header
2. 持久化 cron entries
3. 侧边栏按 jobId 分组管理（一行一个 job），不再展示 started/finished 的原始事件
4. 点击 job → 右侧面板展示该 job 的完整执行历史

## 已有可复用的模式与组件

| 模式 | 位置 | 复用点 |
|------|------|--------|
| zustand persist | `src/store/subscription/index.ts` | `devtools(persist(..., { partialize }))` |
| 右侧面板渲染 | `src/features/Chat/ChatFeature.tsx` | `panel={hasOpenTabs ? <WorkspaceFilePanel /> : undefined}` |
| 三面板布局 | `src/features/Chat/layout/ChatShell.tsx` | `ChatShell({ sidebar, main, panel? })` |
| CronRuns RPC | `src/store/agents/slices/cron/action.ts:105` | `loadCronRuns(jobId)` → `cron.runs` RPC，返回 `CronRunsEntry[]` |
| CronRuns 展示 | `src/features/Agents/components/CronRunsDialog.tsx` | 已有渲染模式（时间 + 状态 + summary + error + session） |
| CronRunsEntry 类型 | `src/store/agents/types.ts:39` | `{ ts, jobId, status, durationMs?, error?, summary?, sessionId?, sessionKey? }` |
| i18n 空状态 key | `src/locales/default/common.ts` | `cronResults.empty: "暂无执行记录"`（已定义，未使用） |

## 修改清单

### 1. `src/store/gatewayActivity.ts` — 持久化 + 选中状态

**变更**：
- 引入 `persist` 中间件，`partialize` 仅持久化 `entries`（过滤 `event === "cron"` 的条目）
- 新增 state: `selectedCronJobId: string | null`
- 新增 action: `selectCronJob(jobId: string | null)`
- 新增 selector: `selectCronJobGroups` — 将 cron entries 按 jobId 分组，每组提取最新状态、运行次数、最近时间

```ts
// persist 模式（复用 subscription store 的 devtools+persist 组合）
devtools(
  persist(
    (set) => ({ ... }),
    {
      name: "clawui-gateway-activity",
      partialize: (s) => ({
        entries: s.entries.filter((e) => e.event === "cron"),
      }),
    },
  ),
  { name: "GatewayActivityStore" },
)
```

**新 selector `selectCronJobGroups`**：
```ts
type CronJobGroup = {
  jobId: string;
  lastAction: string;       // "started" | "finished"
  lastStatus?: string;       // "ok" | "error" | "skipped"
  lastTs: number;
  runCount: number;          // finished 事件的计数
  lastSummary?: string;
  lastDurationMs?: number;
};

// 从 cron entries 按 jobId 聚合
```

### 2. `src/features/Chat/sidebar/CronResultList.tsx` — 空状态 + Job 分组

**变更**：
- 删除 `if (cronEntries.length === 0) return null` → 始终渲染 Collapsible header
- 空状态显示 `t("cronResults.empty")`
- 列表项从展示单条事件改为展示 `CronJobGroup`（每个 jobId 一行）
- 每行显示：jobId 前 8 位、状态图标、最近运行时间、完成次数
- 每行可点击 → 调用 `selectCronJob(jobId)`
- 选中的 job 高亮
- 修复 TS 错误：`toReversed()` → `[...arr].reverse()` / 或添加 lib es2023

### 3. `src/features/Chat/panel/CronDetailPanel.tsx` — 新文件：右侧详情面板

**功能**：
- 头部：jobId + 关闭按钮（→ `selectCronJob(null)`）
- 内容：调用 `loadCronRuns(jobId)` 加载历史记录
- 列表：复用 `CronRunsDialog` 的渲染模式（时间 + 状态 + summary + error）
- 空状态：`t("agents.cron.runsEmpty")`
- 加载状态：`cronBusyJobId === jobId` 时显示 spinner

**模式参考**：`WorkspaceFilePanel.tsx` 的 flex 三段式（header + scrollable content）

### 4. `src/features/Chat/ChatFeature.tsx` — 面板优先级

```tsx
const selectedCronJobId = useGatewayActivityStore((s) => s.selectedCronJobId);
const hasOpenTabs = useWorkspaceFilesStore((s) => s.openTabs.length > 0);

const panel = selectedCronJobId
  ? <CronDetailPanel />
  : hasOpenTabs
    ? <WorkspaceFilePanel />
    : undefined;
```

### 5. `src/locales/default/common.ts` — 补充 i18n keys

新增：
```ts
cronResults: {
  // 已有 keys 保留
  jobRuns: "{{count}} 次运行",
  noJobs: "暂无定时任务",
},
```

## 不修改的文件

- `SessionSidebar.tsx` — 刚完成的两段式布局不变
- `WorkspaceFileList.tsx` — 不受影响
- `ChatShell.tsx` — 三面板布局已支持 panel 可选
- `CronRunsDialog.tsx` — agents 页面的 dialog 保留不动
- `agents store` — 只读使用 `loadCronRuns`、`cronRunsData`、`cronBusyJobId`

## 边界情况

| 场景 | 行为 |
|------|------|
| 无 cron entries（首次启动） | 显示 header + 空状态文案 |
| 刷新后 | persist 恢复已有 entries，section 保留 |
| Gateway 推送新 cron 事件 | 实时更新 job 分组 |
| 点击 job 后 WorkspaceFile 被打开 | CronDetailPanel 优先级更高，保持显示 |
| 关闭 CronDetailPanel | `selectCronJob(null)` → 如有 openTabs 则回到 WorkspaceFilePanel |
| 多个 jobId | sidebar 列表按最近活动排序 |

## 验证

1. `bun run type-check` — 类型检查
2. `pnpm lint` — 代码检查
3. `pnpm format:check` — 格式检查
4. 手动：刷新后定时任务 section 仍在 + 数据保留
5. 手动：点击 job → 右侧面板显示执行历史
6. 手动：关闭详情面板 → 恢复文件面板（如有）
