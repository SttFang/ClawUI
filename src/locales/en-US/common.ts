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
  language: {
    manage: 'Language',
    current: 'Current language',
    system: 'System',
    zhCN: 'Chinese (Simplified)',
    enUS: 'English (US)',
  },
} as const

export default common

