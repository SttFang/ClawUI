# ClawUI

An OpenClaw Desktop Application built with Electron + React.

## Features

- Simple installation - just download and run
- Auto-updates via electron-updater
- Session management - local conversations with AI
- Model configuration - bring your own API keys or use subscription
- Channel integration - Telegram, Discord, WhatsApp, Slack, and more
- Tool management - configure MCP tools and permissions
- Plugin system - extend functionality via ClawHub
- Scheduled tasks - cron-based automation

## Development

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build

# Build for specific platforms
pnpm build:mac    # macOS
pnpm build:win    # Windows
pnpm build:linux  # Linux
```

## Architecture

```
ClawUI/
├── electron/          # Electron main process
│   ├── main/         # Main process code
│   │   ├── ipc/      # IPC handlers
│   │   └── services/ # Gateway, Config, Updater
│   └── preload/      # Preload scripts
├── src/              # Renderer process (React)
│   ├── components/   # UI components
│   ├── features/     # Feature modules
│   ├── routes/       # Page components
│   ├── store/        # Zustand stores
│   ├── hooks/        # React hooks
│   └── lib/          # Utilities
└── resources/        # App resources
```

## Tech Stack

- **Electron**: electron-vite for bundling
- **Frontend**: React 19 + React Router 7 + Tailwind CSS v4
- **UI Components**: shadcn/ui (pure React + Tailwind)
- **State Management**: Zustand
- **Gateway**: OpenClaw Gateway (subprocess)
- **Storage**: Local filesystem (~/.openclaw/)
- **Theme**: Tomato Red (oklch color space)
- **Font**: ESBuild

## License

MIT
