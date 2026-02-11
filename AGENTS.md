# Repository Guidelines
- 用中文回答我的问题
- Repo: https://github.com/SttFang/ClawUI
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` for real newlines; never embed "\n".

## Related Repositories

| 项目 | 路径 | 说明 |
|------|------|------|
| ClawUI | `.` (本仓库) | Electron 桌面客户端 |
| OpenClaw | `../openclaw` | Gateway 服务端源码 |

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

已安装的 Skills：

| Skill | 用途 |
|-------|------|
| `/commit` | 创建规范的 git commit |
| `/review-pr` | 审查 Pull Request |
| `ui-ux-pro-max` | UI/UX 设计最佳实践 |
| `tailwind-design-system` | Tailwind CSS v4 设计系统与组件库规范 |
| `vercel-composition-patterns` | React 组合模式与组件 API 设计（可维护性优先） |
| `vercel-react-best-practices` | React 性能与最佳实践（偏工程化与可观测性） |
| `vercel-react-native-skills` | React Native/Expo 性能与工程最佳实践 |
| `supabase-postgres-best-practices` | Postgres 性能与查询/建模最佳实践（Supabase 语境） |
| `playwright` | 需要浏览器自动化（导航/填表/截图/录制/抓取）时使用 |
| `agent-browser` | 需要在真实网站完成交互式操作（登录/点击/截图）时使用 |
| `better-auth-best-practices` | Better Auth 鉴权与安全最佳实践 |
| `web-artifacts-builder` | 构建/产出可发布的 Web 产物（静态页/截图/包）流程化 |

### 何时使用哪个 Skill（对标 OpenClaw 的“按场景选工具”）

- 在需要设计提交拆分、commit message 规范、提交策略时：使用 `/commit`；实际提交仍使用 `scripts/committer`。
- 在用户提供 PR 链接并要求审查时：使用 `/review-pr`（只读 review，不切分支）。
- 在做 UI/UX 设计、布局、信息层级、动效与可用性优化时：使用 `ui-ux-pro-max`。
- 在做 Tailwind v4 的设计系统、design tokens、组件库规范、主题与可访问性落地时：使用 `tailwind-design-system`。
- 在需要重构组件 API（compound components / render props / context 组合）、减少 boolean props 泛滥时：使用 `vercel-composition-patterns`。
- 在做 React 性能优化（渲染、memoization、数据流、bundle/交互延迟）与工程最佳实践时：使用 `vercel-react-best-practices`。
- 在做 React Native/Expo 的性能优化、列表/动画/原生模块最佳实践时：使用 `vercel-react-native-skills`。
- 在写/改 Postgres（表结构、索引、慢查询、SQL 优化、RLS）并希望对齐 Supabase 经验时：使用 `supabase-postgres-best-practices`。
- 在需要端到端 UI 自动化（页面操作、断言、截图、数据提取）时：使用 `playwright`。
- 在需要更偏“网站操作/流程自动化”的浏览器能力（登录、点击、表单、截图）时：使用 `agent-browser`。
- 在做 Better Auth 相关的鉴权/会话/安全策略设计与落地时：使用 `better-auth-best-practices`。
- 在需要把 Web 页面/组件输出成可交付物（静态产物、截图、报告）并流程化时：使用 `web-artifacts-builder`。

安装新 skill：
```bash
npx skills search <keyword>
npx skills add <owner/repo@skill> -y -g
```

## Agent Workflow

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
