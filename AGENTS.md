# Repository Guidelines

- Repo: https://github.com/SttFang/ClawUI
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` for real newlines; never embed "\n".

## Project Structure

- Source code: `src/` (React renderer), `electron/` (main process).
- Tests: colocated `*.test.ts`.
- UI Components: `src/components/ui/` (shadcn/ui pattern).
- Layout: `src/components/layout/` (AppShell, NavRail, TitleBar).
- State: `src/store/` (Zustand stores).
- Routes: `src/routes/` (React Router pages).
- Locales: `src/locales/` (i18n, zh-CN source).
- Resources: `resources/` (fonts, icons).

## Tech Stack

- **Electron**: 33 + electron-vite
- **Frontend**: React 19 + React Router 7 + Tailwind CSS 4
- **UI**: shadcn/ui (pure React, no Radix)
- **State**: Zustand 5
- **Icons**: Lucide React
- **i18n**: i18next + react-i18next
- **Testing**: Vitest
- **Package Manager**: pnpm

## Build & Dev Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Type-check: `bun run type-check`
- Lint: `pnpm lint`
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

## Commit & Pull Request Guidelines

- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit` so staging stays scoped.
- Follow concise, action-oriented commit messages (e.g., `TitleBar: add bottom border`).
- Prefix with gitmoji when appropriate: `✨ feat:`, `🐛 fix:`, `♻️ refactor:`, `📝 docs:`, `💄 style:`.
- Group related changes; avoid bundling unrelated refactors.
- Type-check must pass before commit: `bun run type-check`.
- PRs should summarize scope, note testing performed, and mention any user-facing changes.
- PR review flow: when given a PR link, review via `gh pr view`/`gh pr diff` and do **not** change branches.
- Goal: merge PRs. Prefer **rebase** when commits are clean; **squash** when history is messy.
- When working on a GitHub Issue or PR, print the full URL at the end of the task.

## i18n

- Source: `src/locales/default/*.ts` (Chinese).
- Namespaces: `common`, `nav`, `chat`.
- Usage: `useTranslation('namespace')` → `t('key')`.

## Testing

- Never run full test suite; always filter by path.
- Use `vi.spyOn` over `vi.mock`.
- Test files: `*.test.ts` colocated with source.

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
| `tailwind-v4-shadcn` | Tailwind CSS v4 + shadcn/ui 模式 |

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
