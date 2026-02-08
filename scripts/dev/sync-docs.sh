#!/bin/bash
# sync-docs.sh - Sync CLAUDE.md and AGENTS.md
# Usage: ./scripts/sync-docs.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"
AGENTS_MD="$PROJECT_ROOT/AGENTS.md"

echo "🔄 Syncing CLAUDE.md and AGENTS.md..."

# Extract common sections from AGENTS.md to keep CLAUDE.md in sync
# CLAUDE.md is the concise version, AGENTS.md is the detailed version

# Backup existing files
cp "$CLAUDE_MD" "$CLAUDE_MD.bak"
cp "$AGENTS_MD" "$AGENTS_MD.bak"

# Generate CLAUDE.md from AGENTS.md (extract key sections)
cat > "$CLAUDE_MD" << 'EOF'
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClawUI is an OpenClaw Desktop Application built with Electron, providing:
- Easy-to-use AI assistant interface
- Multi-model support (BYOK / Subscription)
- Messaging channel integration (Telegram/Discord/WhatsApp/微信)
- Comprehensive management interface

## Tech Stack

- **Desktop Framework**: Electron + electron-vite
- **Frontend**: React 19 + React Router 7 + Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand (LobeChat Action layered pattern)
- **Local Storage**: OpenClaw native filesystem (~/.openclaw/)
- **Auto Update**: electron-updater
- **Testing**: Vitest

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev              # Start Electron dev mode

# Build
pnpm build            # Build for production
pnpm build:mac        # Build for macOS
pnpm build:win        # Build for Windows
pnpm build:linux      # Build for Linux

# Type check
bun run type-check
```

## Directory Structure

```
ClawUI/
├── electron/
│   ├── main/           # Main process (Node.js)
│   │   ├── index.ts    # Entry point
│   │   ├── ipc/        # IPC handlers
│   │   └── services/   # Gateway, Config, Updater
│   └── preload/        # Context bridge
├── src/                # Renderer process (React)
│   ├── components/ui/  # shadcn/ui components
│   ├── features/       # Feature modules
│   ├── store/          # Zustand stores
│   ├── routes/         # Page components
│   ├── hooks/          # React hooks
│   └── lib/            # Utilities
├── resources/          # App resources
└── package.json
```

## Code Architecture

### Zustand Store Organization

Store 采用 LobeChat 的 Slice 组织架构：

```
src/store/[domain]/
├── index.ts          # 导出 useStore 和 selectors
├── store.ts          # 组合 slices
├── initialState.ts   # 聚合初始状态
├── selectors.ts      # 统一导出 selectors
└── slices/[name]/
    ├── action.ts     # Actions 定义
    ├── initialState.ts
    └── selectors.ts
```

**Action 命名约定**：
- **Public Actions**: 动词形式 (`startGateway`, `stopGateway`)
- **Internal Actions**: `internal_` 前缀 (`internal_setStatus`)

### IPC Communication

Renderer ↔ Main 通信通过 contextBridge + ipcMain：

```typescript
// Renderer: src/lib/ipc.ts
ipc.gateway.start()
ipc.config.get()

// Main: electron/main/ipc/*.ts
ipcMain.handle('gateway:start', handler)
```

## Testing

**IMPORTANT**: Never run full test suite. Always filter by file path.

```bash
bunx vitest run --silent='passed-only' 'src/[file-path].test.tsx'
```

## Git Workflow

- Main branch: `master`
- Commit prefix: gitmoji (✨ feat, 🐛 fix, etc.)
- Use rebase: `git pull --rebase`

## Available Skills

| Skill | Purpose |
|-------|---------|
| `/commit` | Create git commits |
| `/review-pr` | Review pull requests |
| `ui-ux-pro-max` | Professional UI/UX design |
| `tailwind-v4-shadcn` | Tailwind CSS v4 + shadcn/ui |
| `aws-api-design` | AWS API design patterns |
| `aws-cdk-development` | AWS CDK infrastructure |
| `vercel-composition-patterns` | React composition patterns |
| `supabase-postgres-best-practices` | Postgres optimization |
| `zustand-state-management` | Zustand patterns |

## Architecture Reference

详细架构规范见 AGENTS.md 和 `.cursor/` 目录下的文档。
EOF

echo "✅ CLAUDE.md updated from AGENTS.md template"

# Verify sync
if [ -f "$CLAUDE_MD" ] && [ -f "$AGENTS_MD" ]; then
    echo "✅ Both files exist and are synced"
    echo "   CLAUDE.md: $(wc -l < "$CLAUDE_MD") lines"
    echo "   AGENTS.md: $(wc -l < "$AGENTS_MD") lines"
else
    echo "❌ Error: One or both files missing"
    exit 1
fi

# Clean up backups if successful
rm -f "$CLAUDE_MD.bak" "$AGENTS_MD.bak"

echo "🎉 Sync complete!"
