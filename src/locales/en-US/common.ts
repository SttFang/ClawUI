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
  language: {
    manage: 'Language',
    current: 'Current language',
    system: 'System',
    zhCN: 'Chinese (Simplified)',
    enUS: 'English (US)',
  },
} as const

export default common
