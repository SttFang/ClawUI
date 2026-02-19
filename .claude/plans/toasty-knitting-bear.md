# Workspace 路径富化渲染

## Context

AI 回复中经常出现 workspace 文件路径（如 `/Users/fan/.openclaw/workspace/recent_screenshots/shot.png`），目前以纯文本显示，不可交互。用户希望：
- 图片路径 → 内联缩略图
- 其他文件 → 可点击 chip，点击在侧边栏打开
- 破坏性最小，在消息文本层实现

## 方案

两步：**文本预处理**（纯文本路径 → markdown 链接）+ **自定义链接渲染**（拦截 workspace 链接渲染为组件）。

### Step 1: 文本预处理函数

**文件**: `src/features/Chat/utils/markdown.ts`

新增 `linkifyWorkspacePaths(text: string): string`：
- 正则匹配包含 `/.openclaw/workspace/` 的绝对路径（需有文件名+扩展名）
- 跳过已在 `[...](...)` 或 `` ` `` 代码块中的路径
- 转为 `[filename](workspace-file:relative/path)`
- `workspace-file:` 自定义协议，供下游组件识别

示例：
```
输入: 截图在 /Users/fan/.openclaw/workspace/recent_screenshots/shot.png 中
输出: 截图在 [shot.png](workspace-file:recent_screenshots/shot.png) 中
```

接入点：在 `MessageText.tsx` 预处理链中加入（`stripTerminalControlSequences` 之后）。

### Step 2: 自定义链接组件

**文件**: `src/features/Chat/components/WorkspaceLink.tsx`（新建）

作为 Streamdown 的 `components.a` 覆盖：

```
href 以 workspace-file: 开头？
├── 是 → 提取 relativePath
│   ├── 图片扩展名 → <WorkspaceImageLink>
│   │   - 用 ipc.workspace.readFileBase64 加载缩略图
│   │   - 显示 h-16 圆角缩略图 + 文件名
│   │   - loading 态显示占位骨架
│   │   - 点击 openFile() 在侧边栏打开
│   └── 其他文件 → <WorkspaceFileChip>
│       - FileIcon + 文件名，chip 样式
│       - 点击 openFile() 在侧边栏打开
└── 否 → 渲染为普通 <a> 标签（保持默认行为）
```

复用现有：
- `classifyFile()` from `src/store/workspaceFiles` — 判断文件类型
- `useWorkspaceFilesStore.openFile()` — 在侧边栏打开
- `ipc.workspace.readFileBase64()` — 加载图片

### Step 3: 接入 Streamdown

**文件**: `src/features/Chat/components/MessageText.tsx`

仅两处改动：
1. 预处理链加入 `linkifyWorkspacePaths`
2. Streamdown 加 `components={{ a: WorkspaceLink }}`

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `src/features/Chat/utils/markdown.ts` | 新增 `linkifyWorkspacePaths()` |
| `src/features/Chat/components/WorkspaceLink.tsx` | **新建** |
| `src/features/Chat/components/MessageText.tsx` | 加预处理 + `components` prop |

## 不改动

- Streamdown 库本身
- 工具输出层（ToolItem / ExecTool）
- WorkspaceFilePanel（复用）
- IPC 层（复用）
- Electron 主进程

## 验证

1. `bun run type-check`
2. 在 dev 模式下，让 AI 回复包含 workspace 路径的消息，确认：
   - 纯文本路径被转为可交互链接
   - 已有的 markdown 链接路径也能正确渲染
   - 图片路径显示缩略图
   - 其他文件显示 chip
   - 点击可在侧边栏打开
   - 非 workspace 路径不受影响
   - 代码块中的路径不被转换
3. `pnpm lint && pnpm format:check`
