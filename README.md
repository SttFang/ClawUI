# 🦞 ClawUI — OpenClaw Desktop Client

<p align="center">
  <strong>The desktop companion for your OpenClaw assistant.</strong>
</p>

<p align="center">
  <a href="https://github.com/SttFang/ClawUI/actions"><img src="https://img.shields.io/github/actions/workflow/status/SttFang/ClawUI/ci.yml?branch=master&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/SttFang/ClawUI/releases"><img src="https://img.shields.io/github/v/release/SttFang/ClawUI?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**ClawUI** is a native desktop client for [OpenClaw](https://github.com/openclaw/openclaw), the personal AI assistant gateway.
It connects to your local OpenClaw Gateway over WebSocket (ACP protocol) and gives you a full-featured chat interface, agent management, usage analytics, and configuration — all in one Electron app.

If you want a desktop-native way to talk to your OpenClaw assistant, this is it.

[OpenClaw](https://github.com/openclaw/openclaw) · [OpenClaw Docs](https://docs.openclaw.ai) · [Getting Started](#quick-start)

## Highlights

- **Chat interface** — streaming messages, session sidebar, workspace files, sub-agent panel, execution approval flow, and A2UI tool-call visualization.
- **Agent management** — capabilities, extensions, channels, cron jobs, skills, and node control.
- **Usage analytics** — session list, cost breakdown, daily trend charts, provider breakdown.
- **Settings** — AI service auth (OAuth + API key), messaging channels (Telegram / Discord / WhatsApp / Slack), capability config (tools, plugins, skills, MCP).
- **Rescue Agent** — dedicated rescue session for troubleshooting and configuration assistance.
- **Startup guard** — automatic OpenClaw installation check and Gateway lifecycle management.
- **Native feel** — macOS traffic lights, custom title bar, left navigation rail, dark/light theme.

## How it works

```
┌─────────────────────────────────────────────────────┐
│                    ClawUI (Electron)                 │
│                                                     │
│  ┌─────────────┐  ┌──────────────────────────────┐  │
│  │  Main Process│  │     Renderer (React)         │  │
│  │             │  │                              │  │
│  │  Gateway    │  │  Chat ─ Agents ─ Usage       │  │
│  │  lifecycle  │◄─┤  Settings ─ Rescue           │  │
│  │  IPC bridge │  │  Onboarding                  │  │
│  │  Config     │  │                              │  │
│  │  Updater    │  └──────────────────────────────┘  │
│  └──────┬──────┘                                    │
│         │ WebSocket (ACP)                           │
└─────────┼───────────────────────────────────────────┘
          │
          ▼
┌──────────────────────┐
│   OpenClaw Gateway   │
│  ws://127.0.0.1:18789│
└──────────┬───────────┘
           │
           ├─ Pi agent (RPC)
           ├─ Channels (WhatsApp / Telegram / Slack / Discord / …)
           ├─ Tools (browser, canvas, nodes, cron)
           └─ Skills (bundled / managed / workspace)
```

## Quick start

**Prerequisites:** Node ≥ 22, [OpenClaw](https://github.com/openclaw/openclaw) installed globally.

```bash
# 1. Install OpenClaw (if not already)
npm install -g openclaw@latest
openclaw onboard --install-daemon

# 2. Clone and install ClawUI
git clone https://github.com/SttFang/ClawUI.git
cd ClawUI
pnpm install

# 3. Start development
pnpm dev
```

ClawUI will detect your OpenClaw installation, start the Gateway automatically, and connect via WebSocket.

## Build

```bash
pnpm build           # Build for production
pnpm build:mac       # macOS (dmg + zip)
pnpm build:win       # Windows (nsis + portable)
pnpm build:linux     # Linux (AppImage + deb)
```

## Development

```bash
pnpm dev             # Start dev server (Electron + Vite HMR)
bun run type-check   # TypeScript type checking
pnpm lint            # Lint (oxlint)
pnpm format          # Format (oxfmt)

# Run a specific test
bunx vitest run --silent='passed-only' 'src/path/to/file.test.ts'
```

## Tech stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33 + electron-vite |
| Frontend | React 19 + React Router 7 + Tailwind CSS 4 |
| UI | shadcn/ui (@clawui/ui) |
| State | Zustand 5 |
| Icons | Lucide React |
| i18n | i18next + react-i18next (zh-CN source) |
| Logging | electron-log v5 (sensitive data redaction) |
| Testing | Vitest |
| Package manager | pnpm (monorepo workspaces) |

## Project structure

```
ClawUI/
├── electron/                # Electron main process
│   ├── main/
│   │   ├── ipc/            # IPC handlers (17 modules)
│   │   ├── services/       # Gateway, chat, config, credentials, updater
│   │   ├── lib/logger/     # Structured logging with redaction
│   │   ├── utils/          # Shared utilities
│   │   └── window/         # Window management (traffic lights)
│   └── preload/            # Preload scripts (context bridge)
├── src/                     # Renderer process (React)
│   ├── components/         # Shared components (AppShell, TitleBar, NavRail)
│   ├── features/           # Feature modules
│   │   ├── Chat/           # Chat interface (18 components)
│   │   ├── Agents/         # Agent management (13 components)
│   │   ├── Usage/          # Usage analytics (7 components)
│   │   ├── RescueAgent/    # Rescue agent session
│   │   ├── Settings/       # Provider cards, model config, OAuth
│   │   ├── Channels/       # Channel configuration
│   │   ├── Onboarding/     # First-run setup
│   │   └── Scheduler/      # Cron task management
│   ├── routes/             # Page routes
│   │   ├── chat/           # / (default)
│   │   ├── agents/         # /agents
│   │   ├── usage/          # /usage
│   │   ├── settings/       # /settings (?tab=general|ai|messaging|capabilities)
│   │   └── onboarding/     # /onboarding
│   ├── store/              # Zustand stores (~25 slices)
│   ├── hooks/              # React hooks
│   ├── lib/                # Utilities (logger, exec, ipc)
│   ├── locales/            # i18n (zh-CN + en-US)
│   └── services/           # Renderer-side services
├── packages/                # Monorepo workspace packages
│   ├── ui/                 # @clawui/ui — shadcn/ui primitives
│   ├── types/              # @clawui/types — shared TypeScript types
│   ├── constants/          # @clawui/constants — protocol & IPC constants
│   ├── config-core/        # @clawui/config-core — config logic
│   └── openclaw-chat-stream/ # @clawui/openclaw-chat-stream — stream parser
└── resources/               # Fonts, icons, app resources
```

## Features in detail

### Chat

The chat interface connects to the OpenClaw Gateway via WebSocket using the ACP (Agent Communication Protocol). It supports:

- Streaming message deltas with real-time rendering
- Session management (create, switch, reset, compact)
- Workspace file browsing alongside conversations
- Sub-agent panel for multi-agent workflows
- Execution approval flow (tool calls require user consent)
- A2UI visualization for agent-driven UI actions

### Agent management

Configure your OpenClaw agents directly from the desktop:

- **Capabilities** — tool permissions, sandbox mode, thinking level
- **Extensions** — plugins and MCP server configuration
- **Channels** — Telegram, Discord, WhatsApp, Slack routing
- **Cron** — scheduled tasks with cron expressions
- **Skills** — browse and manage installed skills
- **Nodes** — connected device nodes (macOS, iOS, Android)

### Usage analytics

Track your AI usage with built-in analytics:

- Session list with token counts and cost
- Daily trend charts
- Cost breakdown by model and provider
- Signal tables for monitoring

### Settings

Four configuration tabs:

| Tab | What it configures |
|-----|-------------------|
| General | Language, theme, auto-update |
| AI Services | Provider auth (Anthropic OAuth, OpenAI, API keys), model selection |
| Messaging | Channel setup (Telegram bot token, Discord token, etc.) |
| Capabilities | Tools, plugins, skills, MCP servers |

## Gateway connection

ClawUI manages the OpenClaw Gateway lifecycle automatically:

1. **StartupGuard** checks if OpenClaw is installed (via `runtime-detector`)
2. If not installed, the onboarding flow guides you through setup
3. The Gateway process is spawned and monitored by the main process
4. WebSocket connection is established at `ws://127.0.0.1:18789`
5. All IPC calls from the renderer are bridged to Gateway WS methods

Configuration is read from `~/.openclaw/openclaw.json`.

## Contributing

```bash
# Fork and clone
git clone https://github.com/<you>/ClawUI.git
cd ClawUI
pnpm install

# Create a feature branch
git checkout -b feat/my-feature

# Develop with hot reload
pnpm dev

# Before committing
bun run type-check
pnpm lint
pnpm format:check
```

Commit style: gitmoji prefix + concise message.

```
✨ feat: add session export
🐛 fix: handle WebSocket reconnect
♻️ refactor: extract chat service
```

## License

MIT
