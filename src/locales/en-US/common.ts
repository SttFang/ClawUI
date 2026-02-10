const common = {
  actions: {
    newSession: 'New session',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
  },
  navigation: {
    toggleSidebar: 'Toggle sidebar',
    goBack: 'Back',
    goForward: 'Forward',
  },
  status: {
    loading: 'Loading...',
    saving: 'Saving...',
    error: 'Something went wrong',
    success: 'Success',
  },
  connection: {
    error: 'Error',
    offline: 'Offline',
    starting: 'Starting',
    connected: 'Connected',
    connecting: 'Connecting',
  },
  configBanner: {
    title: 'API key not configured',
    description: 'To start chatting, configure API keys for AI providers (Anthropic, OpenAI, etc.).',
    oneClick: 'One-click config',
    manual: 'Manual config',
  },
  plugins: {
    title: 'Plugins',
    description: 'Extend your AI assistant with additional capabilities',
    browseClawHub: 'Browse ClawHub',
    searchPlaceholder: 'Search plugins...',
    emptyTitle: 'No plugins found',
    emptyDescription: 'Try adjusting your search or filters',
    byAuthor: 'by {{author}}',
    actions: {
      configure: 'Configure',
      install: 'Install',
    },
    config: {
      title: 'Configure {{name}}',
      description: 'Adjust the settings for this plugin.',
    },
    categories: {
      all: 'All',
      ai: 'AI',
      productivity: 'Productivity',
      integration: 'Integration',
      utility: 'Utility',
    },
  },
  channels: {
    title: 'Channels',
    description: 'Connect messaging platforms to your AI assistant',
    status: {
      configured: 'Configured',
      notConfigured: 'Not configured',
    },
    actions: {
      configure: 'Configure',
    },
    items: {
      telegram: {
        name: 'Telegram',
        description: 'Connect your Telegram bot',
      },
      discord: {
        name: 'Discord',
        description: 'Connect your Discord bot',
      },
      whatsapp: {
        name: 'WhatsApp',
        description: 'Connect to WhatsApp',
      },
      slack: {
        name: 'Slack',
        description: 'Connect your Slack workspace',
      },
      wechat: {
        name: 'WeChat',
        description: 'Connect to WeChat',
      },
      signal: {
        name: 'Signal',
        description: 'Connect to Signal',
      },
    },
    policies: {
      dm: 'DM policy',
      groupTelegram: 'Group policy',
      groupDiscord: 'Server policy',
      pairing: 'Pairing (require code)',
      allowlist: 'Allowlist only',
      open: 'Open (anyone can DM)',
      disabled: 'Disabled',
    },
    fields: {
      botToken: 'Bot token',
      applicationId: 'Application ID',
      requireMention: 'Require mention',
      requireMentionGroupsHint: 'Bot must be mentioned in groups',
      requireMentionChannelsHint: 'Bot must be mentioned in channels',
      historyLimit: 'History limit',
      historyLimitHint: 'Maximum messages to include in context',
      envVarsEmpty: 'No environment variables configured',
    },
    telegram: {
      configTitle: 'Configure Telegram',
      configDescription: 'Set up your Telegram bot integration',
      botTokenHelpPrefix: 'Get your bot token from',
      botTokenHelpSuffix: '',
    },
    discord: {
      configTitle: 'Configure Discord',
      configDescription: 'Set up your Discord bot integration',
      applicationHelpPrefix: 'Get credentials from',
      applicationHelpSuffix: '',
    },
  },
  tools: {
    title: 'Tools',
    description: 'Configure which tools your AI assistant can use',
    accessControl: {
      title: 'Access control',
      description: 'Choose how the AI should request tool permissions',
    },
    accessModes: {
      auto: {
        label: 'Auto',
        description: 'Automatically allow safe tools',
      },
      ask: {
        label: 'Ask',
        description: 'Ask before using any tool',
      },
      deny: {
        label: 'Deny',
        description: 'Deny all tool access by default',
      },
    },
    sandbox: {
      title: 'Sandbox mode',
      description: 'Run tools in an isolated environment for added security',
      enableTitle: 'Enable sandbox',
      enableDescription: 'Recommended for untrusted operations',
    },
    list: {
      title: 'Available tools',
      description: 'Enable or disable individual tools',
    },
    badge: {
      requiresConfirmation: 'Requires confirmation',
    },
    builtins: {
      fs: {
        name: 'File system',
        description: 'Read, write, and manage files on the system',
      },
      web: {
        name: 'Web access',
        description: 'Browse websites and fetch web content',
      },
      bash: {
        name: 'Command execution',
        description: 'Execute shell commands and scripts',
      },
      database: {
        name: 'Database',
        description: 'Query and manage database connections',
      },
      media: {
        name: 'Media processing',
        description: 'Process images, audio, and video files',
      },
    },
  },
  language: {
    manage: 'Language',
    current: 'Current language',
    system: 'System',
    zhCN: 'Chinese (Simplified)',
    enUS: 'English (US)',
  },
} as const

export default common
