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
- Keep files under ~500 LOC; split when needed.
- Brief comments for tricky logic.

## Commit Guidelines

- Atomic commits: single responsibility, independently revertible.
- Prefix with gitmoji: `✨ feat:`, `🐛 fix:`, `♻️ refactor:`, `📝 docs:`.
- Type-check must pass before commit.
- Use `scripts/committer` or manual `git add <files> && git commit`.

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
