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
  mcp: {
    title: 'MCP servers',
    description: 'Manage Model Context Protocol servers',
    actions: {
      addServer: 'Add server',
      add: 'Add',
      remove: 'Remove',
    },
    emptyTitle: 'No MCP servers',
    emptyDescription: 'Add your first MCP server to extend the AI capabilities',
    envVarsTitle: 'Environment variables',
    toolsTitle: 'Tools ({{n}})',
    toolsEmpty: 'Tools will be discovered when the server starts',
    deleteConfirm: 'Delete this server?',
    form: {
      title: 'Add MCP server',
      description: 'Configure a new Model Context Protocol server',
      serverName: 'Server name',
      serverNamePlaceholder: 'e.g., filesystem, github',
      command: 'Command',
      commandPlaceholder: 'e.g., npx, node, python',
      args: 'Arguments (space-separated)',
      argsPlaceholder: 'e.g., -y @anthropic/mcp-server-filesystem',
      envVars: 'Environment variables',
      envKeyPlaceholder: 'KEY',
      envValuePlaceholder: 'value',
      envEmpty: 'No environment variables configured',
      errors: {
        nameRequired: 'Server name is required',
        commandRequired: 'Command is required',
      },
    },
  },
  usage: {
    title: 'Usage',
    description: 'Token usage and cost analysis',
    actions: {
      refresh: 'Refresh',
    },
    presets: {
      today: 'Today',
      last7d: '7d',
      last30d: '30d',
    },
    modes: {
      tokens: 'Tokens',
      cost: 'Cost',
    },
    granularity: {
      hour: 'Hour',
      day: 'Day',
      month: 'Month',
    },
    metrics: {
      output: 'Output',
      input: 'Input',
      cacheWrite: 'Cache write',
      cacheRead: 'Cache read',
      cumulative: 'Cumulative',
    },
    summary: {
      totalTokens: 'Total tokens',
      totalCost: 'Total cost',
      sessions: 'Sessions',
      avgLatency: 'Avg latency',
    },
    trend: {
      title: 'Trend ({{mode}})',
      tokens: 'Tokens',
      cost: 'Cost',
      latency: 'Latency',
    },
    costBreakdown: {
      title: 'Cost breakdown',
      centerLabel: 'Total tokens',
    },
    providerBreakdown: {
      title: 'Provider distribution',
      centerLabel: 'Providers',
      unknown: 'Unknown',
    },
    sessionList: {
      title: 'Sessions',
      sortCost: 'Sort: cost',
      sortTokens: 'Sort: tokens',
      sortName: 'Sort: name',
      empty: 'No sessions found',
    },
    sessionDetail: {
      messages: 'Messages',
      toolCalls: 'Tool calls',
      errors: 'Errors',
      duration: 'Duration',
      messageSub: 'User: {{user}} / Asst: {{assistant}}',
      toolSub: '{{n}} unique tools',
      modelsUsed: 'Models used',
      modelUnknown: 'Unknown',
      modelCallsCost: '{{n}} calls / ${{cost}}',
      topTools: 'Top tools',
    },
    sessionTimeline: {
      title: 'Session timeline',
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
