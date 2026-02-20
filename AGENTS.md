# Repository Guidelines
- 用中文回答我的问题
- 避免冗余编程，你是 linus，致力于用优雅的代码解决稳定的问题
- Repo: https://github.com/SttFang/ClawUI
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` for real newlines; never embed "\n".

## Related Repositories

| 项目 | 路径 | 说明 |
|------|------|------|
| ClawUI | `.` (本仓库) | Electron 桌面客户端 |
| OpenClaw | `../openclaw` | Gateway 服务端源码 |
| 说明 | `../openclaw` | OpenClaw 是 ClawUI 的开发参考源码，禁止修改 OpenClaw 代码 |


## Project Structure

- Source code: `src/` (React renderer), `electron/` (main process).
- Packages: `packages/` (monorepo workspace packages).
  - `@clawui/ui`: UI primitives (shadcn/ui pattern).
- Tests: colocated `*.test.ts` or `__tests__/` folder.
- Components: `src/components/` (PascalCase folders, each with `index.tsx`).
- State: `src/store/` (Zustand stores).
- Routes: `src/routes/` (React Router pages).
- Locales: `src/locales/` (i18n, zh-CN source).
- Resources: `resources/` (fonts, icons).

## Tech Stack

- **Electron**: 33 + electron-vite
- **Frontend**: React 19 + React Router 7 + Tailwind CSS 4
- **UI**: shadcn/ui
- **State**: Zustand 5
- **Icons**: Lucide React
- **i18n**: i18next + react-i18next
- **Testing**: Vitest
- **Package Manager**: pnpm

## Build, Test, and Development Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Type-check: `bun run type-check`
- Lint: `pnpm lint` (oxlint)
- Format: `pnpm format`
- Format check: `pnpm format:check`
- Test: `bunx vitest run --silent='passed-only' 'src/[path].test.ts'`

## Electron Window Configuration

- macOS traffic lights centering formula:
  ```
  y = HEADER_HEIGHT / 2 - TRAFFIC_LIGHTS_HEIGHT / 2
  ```
  For h-11 (44px) TitleBar: `y = 44/2 - 14/2 = 15`
- Current config: `trafficLightPosition: { x: 20, y: 15 }`

## Coding Style

- TypeScript strict mode; avoid `any`.
- Use `cn()` from `@/lib/utils` for class merging.
- File naming: PascalCase for components, camelCase for utilities.
- Aim to keep files under ~400 LOC; guideline only (not a hard guardrail). Split/refactor when it improves clarity or testability.
- Brief comments for tricky logic.
- Lint/format baseline: prefer `pnpm lint` (oxlint) + `pnpm format:check` (oxfmt) before commits.

## Commit & Pull Request Guidelines

### Committing

- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `TitleBar: add bottom border`).
- Prefix with gitmoji when appropriate: `✨ feat:`, `🐛 fix:`, `♻️ refactor:`, `📝 docs:`, `💄 style:`.
- Group related changes; avoid bundling unrelated refactors.
- Type-check must pass before commit: `bun run type-check`.

### Pull Requests

- Read this when submitting a PR: `docs/help/submitting-a-pr.md`
- Read this when submitting an issue: `docs/help/submitting-an-issue.md`
- PRs should summarize scope, note testing performed, and mention any user-facing changes.

### PR Review Flow

- When given a PR link, review via `gh pr view`/`gh pr diff` and do **not** change branches.
- PR review calls: prefer a single `gh pr view --json ...` to batch metadata/comments; run `gh pr diff` only when needed.
- Before starting a review when a GH Issue/PR is pasted: run `git pull`; if there are local changes or unpushed commits, stop and alert the user before reviewing.

### PR Merge Flow

- Goal: merge PRs. Prefer **rebase** when commits are clean; **squash** when history is messy.
- PR merge flow: create a temp branch from `master`, merge the PR branch into it (prefer squash unless commit history is important; use rebase/merge when it is). If we squash, add the PR author as a co-contributor. Apply fixes, run full gate before the final commit, commit, merge back to `master`, delete the temp branch, and end on `master`.
- If you review a PR and later do work on it, land via merge/squash (no direct-master commits) and always add the PR author as a co-contributor.
- When merging a PR: leave a PR comment that explains exactly what we did and include the SHA hashes.

### Final Notes

- When working on a GitHub Issue or PR, print the full URL at the end of the task.

## i18n

- Source: `src/locales/default/*.ts` (Chinese).
- Namespaces: `common`, `nav`, `chat`.
- Usage: `useTranslation('namespace')` → `t('key')`.

## Testing

- Never run full test suite; always filter by path.
- Use `vi.spyOn` over `vi.mock`.
- Test files: `*.test.ts` colocated with source.
- 修复 bug 后记得引入回归测试。

## Store 规范（Zustand）

当你在 `src/store/**` 新增/重构 store（尤其是文件超过 ~300 行、actions 互相耦合明显、或需要乐观更新/复杂数据结构）时，按以下规范执行：

- Action 分层（public/internal/dispatch）：参考 `.claude/rules/zustand-action-patterns.mdc`
- Slice 组织方式（拆分 initialState/actions/selectors/reducer）：参考 `.claude/rules/zustand-slice-organization.mdc`
- Store action 的测试写法（最小依赖 mock、重置 store、分 validation/happy/error）：参考 `.claude/rules/testing_guide/zustand-store-action-test.mdc`

## Agent Commit Log

| Hash | Message | Date |
|------|---------|------|
| `cb0db5d` | ✨ feat(ui): add IconActionButton component | 2026-02-08 |
| `48798aa` | ✨ feat(ui): add UserAvatar component | 2026-02-08 |
| `c11e38c` | ✨ feat(layout): add TitleBar component | 2026-02-08 |
| `98865ba` | ✨ feat(i18n): add internationalization support | 2026-02-08 |
| `da8dc4a` | ♻️ refactor(layout): use native traffic lights | 2026-02-08 |

## Skills Integration

### 发行商网络

```
                      ┌──────────┐
            ┌────────>│  Vercel  │ react / composition / native / web-design
            │         └──────────┘
            │         ┌──────────┐
            ├────────>│ Supabase │ postgres-best-practices
            │         └──────────┘
  ┌─────────┴───┐     ┌──────────┐
  │   ClawUI    │────>│Community │ ui-ux / tailwind / playwright / auth / artifacts
  │   38 skills │     └──────────┘
  └─────────┬───┘     ┌──────────┐
            ├────────>│  Custom  │ aws-api / chakra / content / lottie / zustand
            │         └──────────┘
            │         ┌──────────┐
            └────────>│ Built-in │ superpowers / commit / review / feature-dev
                      └──────────┘
```

#### Vercel — React 工程体系 `~/.agents/skills/`

| Skill | 场景 |
|-------|------|
| `vercel-react-best-practices` | React/Next.js 性能优化（渲染、memoization、bundle） |
| `vercel-composition-patterns` | 组件 API 重构（compound components / render props） |
| `vercel-react-native-skills` | React Native/Expo 性能与原生模块 |
| `web-design-guidelines` | Web 界面设计规范审查（accessibility / UX） |

#### Supabase — 数据库工程 `~/.agents/skills/`

| Skill | 场景 |
|-------|------|
| `supabase-postgres-best-practices` | Postgres 查询/建模/RLS/索引优化（v1.1） |

#### Community — 社区生态 `~/.agents/skills/`

| Skill | 场景 |
|-------|------|
| `ui-ux-pro-max` | UI/UX 设计（50 styles / 97 palettes / 9 stacks） |
| `tailwind-v4-shadcn` | Tailwind v4 + shadcn/ui 初始化与排错 |
| `tailwind-design-system` | Tailwind v4 设计系统与 design tokens |
| `playwright-skill` | Playwright 浏览器自动化（优先使用） |
| `agent-browser` | 网站交互式操作（登录/点击/截图） |
| `aws-cdk-development` | AWS CDK 基础设施即代码 |
| `better-auth-best-practices` | Better Auth 鉴权与安全策略 |
| `web-artifacts-builder` | Web 产物构建（静态页/截图/包） |

#### Custom — 本地自建 `~/.claude/skills/`

| Skill | 场景 |
|-------|------|
| `aws-api-design` | AWS 风格 API 设计规范（端点/错误码/鉴权） |
| `chakra-ui-style` | Chakra UI styled-system 与 theme tokens |
| `content-system` | 内容创作系统搭建（素材库/工作流/选题） |
| `lottie-animation` | LottieFiles 动画集成（loading/micro-interaction） |
| `zustand-state-management` | Zustand 状态管理（slice/actions/SWR） |
| `store-best-practice` | ClawUI store 施工规范（action 分层/slice/test） |

#### Built-in — 系统内置 (system prompt)

| Skill | 场景 |
|-------|------|
| `/commit` | git commit（自动读 status/diff/log）。本项目优先 `scripts/committer` |
| `/commit-push-pr` | 一键 commit → push → `gh pr create` |
| `/clean-gone` | 清理 `[gone]` 标记的本地 stale 分支 |
| `/review-pr` | PR 审查（5 并行 agent，置信度 ≥80 才报告） |
| `code-simplifier` | 自动简化近期修改代码（只改写法不改功能） |
| `frontend-design` | 高质量前端界面设计与实现 |
| `feature-dev` | 引导式功能开发（codebase 理解 + 架构） |
| `superpowers:*` | brainstorming / TDD / debugging / plans / git-worktrees / verification / code-review / dispatching（12 子技能） |

### 场景速查

| 场景 | 首选 Skill | 备选 |
|------|-----------|------|
| React 性能 | `vercel-react-best-practices` | `vercel-composition-patterns` |
| UI/UX 设计 | `ui-ux-pro-max` | `tailwind-design-system` |
| Tailwind 初始化 | `tailwind-v4-shadcn` | `tailwind-design-system` |
| Postgres 优化 | `supabase-postgres-best-practices` | — |
| 浏览器自动化 | `playwright-skill` | `agent-browser` |
| Store 开发 | `store-best-practice` | `zustand-state-management` |
| 鉴权 | `better-auth-best-practices` | — |
| Git 提交 | `/commit` | `scripts/committer` |
| PR 审查 | `/review-pr` | — |
| 代码简化 | `code-simplifier` | — |

安装新 skill：
```bash
npx skills search <keyword>
npx skills add <owner/repo@skill> -y -g
```

### Skills Tab 布局设计

```
┌─ Skills Tab ──────────────────────────────────────────────────────────────────┐
│ [Capabilities] [Skills*] [Channels] [Nodes] [Cron]                           │
├───────────────────────────────┬────────────────────────────────────────────────┤
│                               │  Skills Summary              [Generate]       │
│   Network Graph               │ ┌──────────────┬─────────┬────────────────┐   │
│                               │ │ Name         │ Source  │ Description    │   │
│  clawhub      ←               │ ├──────────────┼─────────┼────────────────┤   │
│  coding-agent ← [Built-in]   │ │ clawhub      │ bundled │ Search skills  │   │
│  discord      ←               │ │ coding-agent │ bundled │ Delegate code  │   │
│  github       ←    [Vercel] → │ │ vercel-react │ agents  │ React perf     │   │
│  ...               react    → │ │ playwright   │ agents  │ Browser auto   │   │
│                    comp     → │ │ find-skills  │ wkspace │ Discover new   │   │
│  playwright   ←    design   → │ │ ...          │         │                │   │
│  tailwind     ← [Community]   │ └──────────────┴─────────┴────────────────┘   │
│  ui-ux        ←               │                                                │
│  ...               [Supabase] │  Quick Stats                                   │
│                    → pg-best  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  find-skills  ←               │ │  13  │ │   4  │ │   8  │ │   1  │ │   3  │ │
│  gaokao-eng   ← [Workspace]  │ │Built │ │Vercel│ │Commu │ │Supa  │ │Work  │ │
│  gaokao-sci   ←               │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│                               │                                                │
│                               │  Cache: ~/.openclaw/skills-summary.json        │
├───────────────────────────────┴────────────────────────────────────────────────┤
│ Data flow:                                                                     │
│   1. [Generate] → openclaw skills list --json --eligible                       │
│   2. Persist → ~/.openclaw/skills-summary.json                                 │
│   3. Table reads cache; Graph reads store (live)                               │
└────────────────────────────────────────────────────────────────────────────────┘
```

#### 关键文件

| 文件 | 职责 |
|------|------|
| `electron/main/ipc/skills.ts` | IPC handler，CLI 主路径 + 目录扫描回退 |
| `src/features/Agents/components/AgentSkills.tsx` | Skills tab 容器（lazy loaded） |
| `src/features/Agents/components/skills/SkillsNetworkGraph.tsx` | 左侧网络图 |
| `src/features/Agents/components/skills/useSkillsGraph.ts` | 图布局算法（2列并行） |
| `src/features/Agents/components/skills/classifySkillPublisher.ts` | source→publisher 分类 |
| `src/store/agents/slices/config/action.ts` | loadSkills action |
| `src/lib/ipc.ts` | SkillEntry / SkillsListResult 类型 |

#### 数据源

```
openclaw skills list --json --eligible
  → { skills: [{ name, description, source, eligible }] }

source 映射:
  openclaw-bundled     → "内置"   (indigo)
  agents-skills-personal → 按名称分类 Vercel/Supabase/Community/Other
  openclaw-workspace   → "工作区" (purple)
```

## Agent Workflow

### 迭代执行闭环

默认采用闭环迭代工作流：小步撰写代码并进行单元/端到端/Playwright 仿真测试，反馈可验证结果后继续迭代复测，直至通过质量门禁并完成需求。

### 固定动作清单

每次代码修改后，**必须按顺序执行**：

1. `bun run type-check` - 类型检查
2. `bunx vitest run --silent='passed-only' 'src/[相关文件].test.ts'` - 运行相关测试
3. `pnpm lint` - 代码检查
4. `pnpm format:check` - 格式检查（如失败，运行 `pnpm format` 再复查）

### 测试驱动开发 (TDD)

```
1. 编写测试用例 (Red) → 测试失败 ❌
2. 实现功能代码 (Green) → 测试通过 ✅
3. 重构优化 (Refactor) → 保持测试通过
4. 类型检查 → bun run type-check
5. 原子提交 → git commit
```

### 原子化提交 (Atomic Commits)

每个 commit 必须满足：
- **单一职责**：一个 commit 只做一件事
- **独立可回滚**：可以单独 revert
- **测试通过**：提交时所有相关测试必须通过
- **类型检查通过**：提交前必须通过 type-check

### 解耦提交 (Decoupled Commits)

禁止在一个 commit 中混合：

| 类型 | 示例 |
|------|------|
| 功能代码 | `✨ feat: 添加会话管理` |
| UI 组件 | `💄 style: 优化对话界面` |
| 测试代码 | `✅ test: 添加单元测试` |
| 配置文件 | `🔧 chore: 更新配置` |
| 文档 | `📝 docs: 更新文档` |
| 重构 | `♻️ refactor: 重构模块` |
