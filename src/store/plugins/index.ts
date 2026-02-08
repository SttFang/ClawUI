import { create } from 'zustand'

export type PluginCategory = 'ai' | 'productivity' | 'integration' | 'utility'

export interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  enabled: boolean
  installed: boolean
  category: PluginCategory
  icon?: string
  configSchema?: PluginConfigSchema
  config?: Record<string, unknown>
}

export interface PluginConfigField {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  description?: string
  default?: unknown
  options?: { label: string; value: string }[]
  required?: boolean
}

export interface PluginConfigSchema {
  [key: string]: PluginConfigField
}

interface PluginsState {
  plugins: Plugin[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  categoryFilter: PluginCategory | 'all'
}

interface PluginsActions {
  loadPlugins: () => Promise<void>
  installPlugin: (id: string) => Promise<void>
  uninstallPlugin: (id: string) => Promise<void>
  enablePlugin: (id: string) => Promise<void>
  disablePlugin: (id: string) => Promise<void>
  updatePluginConfig: (id: string, config: Record<string, unknown>) => Promise<void>
  setSearchQuery: (query: string) => void
  setCategoryFilter: (category: PluginCategory | 'all') => void
}

type PluginsStore = PluginsState & PluginsActions

const defaultPlugins: Plugin[] = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Enable AI to search the web for real-time information',
    version: '1.0.0',
    author: 'OpenClaw',
    enabled: true,
    installed: true,
    category: 'ai',
    configSchema: {
      searchEngine: {
        type: 'select',
        label: 'Search Engine',
        description: 'Default search engine to use',
        default: 'google',
        options: [
          { label: 'Google', value: 'google' },
          { label: 'Bing', value: 'bing' },
          { label: 'DuckDuckGo', value: 'duckduckgo' },
        ],
      },
      maxResults: {
        type: 'number',
        label: 'Max Results',
        description: 'Maximum number of search results to return',
        default: 10,
      },
    },
    config: {
      searchEngine: 'google',
      maxResults: 10,
    },
  },
  {
    id: 'code-interpreter',
    name: 'Code Interpreter',
    description: 'Execute Python code in a sandboxed environment',
    version: '1.2.0',
    author: 'OpenClaw',
    enabled: false,
    installed: true,
    category: 'ai',
    configSchema: {
      timeout: {
        type: 'number',
        label: 'Execution Timeout',
        description: 'Maximum execution time in seconds',
        default: 30,
      },
      allowNetworkAccess: {
        type: 'boolean',
        label: 'Allow Network Access',
        description: 'Allow code to make network requests',
        default: false,
      },
    },
    config: {
      timeout: 30,
      allowNetworkAccess: false,
    },
  },
  {
    id: 'notion-sync',
    name: 'Notion Sync',
    description: 'Sync conversations and notes with Notion',
    version: '0.9.0',
    author: 'Community',
    enabled: false,
    installed: false,
    category: 'integration',
    configSchema: {
      apiKey: {
        type: 'string',
        label: 'Notion API Key',
        description: 'Your Notion integration API key',
        required: true,
      },
      databaseId: {
        type: 'string',
        label: 'Database ID',
        description: 'Notion database ID for syncing',
      },
    },
  },
  {
    id: 'image-generation',
    name: 'Image Generation',
    description: 'Generate images using DALL-E, Stable Diffusion, and more',
    version: '2.0.0',
    author: 'OpenClaw',
    enabled: false,
    installed: false,
    category: 'ai',
    configSchema: {
      provider: {
        type: 'select',
        label: 'Default Provider',
        default: 'dalle',
        options: [
          { label: 'DALL-E 3', value: 'dalle' },
          { label: 'Stable Diffusion', value: 'sd' },
          { label: 'Midjourney', value: 'mj' },
        ],
      },
    },
  },
  {
    id: 'github-integration',
    name: 'GitHub Integration',
    description: 'Connect to GitHub repositories, create issues, and manage PRs',
    version: '1.5.0',
    author: 'OpenClaw',
    enabled: false,
    installed: false,
    category: 'integration',
    configSchema: {
      token: {
        type: 'string',
        label: 'GitHub Token',
        description: 'Personal access token with repo permissions',
        required: true,
      },
    },
  },
  {
    id: 'markdown-export',
    name: 'Markdown Export',
    description: 'Export conversations to Markdown files',
    version: '1.0.0',
    author: 'Community',
    enabled: true,
    installed: true,
    category: 'productivity',
    configSchema: {
      includeMetadata: {
        type: 'boolean',
        label: 'Include Metadata',
        description: 'Include timestamps and model info in exports',
        default: true,
      },
    },
    config: {
      includeMetadata: true,
    },
  },
  {
    id: 'voice-input',
    name: 'Voice Input',
    description: 'Use voice commands and speech-to-text input',
    version: '0.8.0',
    author: 'Community',
    enabled: false,
    installed: false,
    category: 'utility',
    configSchema: {
      language: {
        type: 'select',
        label: 'Language',
        default: 'en-US',
        options: [
          { label: 'English (US)', value: 'en-US' },
          { label: 'English (UK)', value: 'en-GB' },
          { label: 'Spanish', value: 'es-ES' },
          { label: 'Chinese (Simplified)', value: 'zh-CN' },
        ],
      },
    },
  },
  {
    id: 'pomodoro-timer',
    name: 'Pomodoro Timer',
    description: 'Built-in productivity timer with focus sessions',
    version: '1.1.0',
    author: 'Community',
    enabled: false,
    installed: false,
    category: 'productivity',
    configSchema: {
      workDuration: {
        type: 'number',
        label: 'Work Duration (minutes)',
        default: 25,
      },
      breakDuration: {
        type: 'number',
        label: 'Break Duration (minutes)',
        default: 5,
      },
    },
  },
]

const initialState: PluginsState = {
  plugins: defaultPlugins,
  isLoading: false,
  error: null,
  searchQuery: '',
  categoryFilter: 'all',
}

export const usePluginsStore = create<PluginsStore>((set, get) => ({
  ...initialState,

  loadPlugins: async () => {
    set({ isLoading: true, error: null })
    try {
      // In a real implementation, this would load from storage/API
      await new Promise((resolve) => setTimeout(resolve, 300))
      set({ isLoading: false })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load plugins'
      set({ error: message, isLoading: false })
    }
  },

  installPlugin: async (id) => {
    const { plugins } = get()
    const plugin = plugins.find((p) => p.id === id)
    if (!plugin || plugin.installed) return

    set({ isLoading: true })
    try {
      // Simulate installation
      await new Promise((resolve) => setTimeout(resolve, 500))
      set({
        plugins: plugins.map((p) =>
          p.id === id ? { ...p, installed: true, enabled: true } : p
        ),
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to install plugin'
      set({ error: message, isLoading: false })
    }
  },

  uninstallPlugin: async (id) => {
    const { plugins } = get()
    const plugin = plugins.find((p) => p.id === id)
    if (!plugin || !plugin.installed) return

    set({ isLoading: true })
    try {
      // Simulate uninstallation
      await new Promise((resolve) => setTimeout(resolve, 300))
      set({
        plugins: plugins.map((p) =>
          p.id === id ? { ...p, installed: false, enabled: false, config: undefined } : p
        ),
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to uninstall plugin'
      set({ error: message, isLoading: false })
    }
  },

  enablePlugin: async (id) => {
    const { plugins } = get()
    set({
      plugins: plugins.map((p) => (p.id === id ? { ...p, enabled: true } : p)),
    })
  },

  disablePlugin: async (id) => {
    const { plugins } = get()
    set({
      plugins: plugins.map((p) => (p.id === id ? { ...p, enabled: false } : p)),
    })
  },

  updatePluginConfig: async (id, config) => {
    const { plugins } = get()
    set({
      plugins: plugins.map((p) => (p.id === id ? { ...p, config } : p)),
    })
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  setCategoryFilter: (category) => {
    set({ categoryFilter: category })
  },
}))

// Selectors
export const selectPlugins = (state: PluginsStore) => state.plugins
export const selectIsLoading = (state: PluginsStore) => state.isLoading
export const selectError = (state: PluginsStore) => state.error
export const selectSearchQuery = (state: PluginsStore) => state.searchQuery
export const selectCategoryFilter = (state: PluginsStore) => state.categoryFilter

// React 19 + useSyncExternalStore requires getSnapshot() to return a stable reference
// for the same store state, otherwise it can trigger an infinite update loop.
const filteredPluginsCache = new WeakMap<PluginsStore, Plugin[]>()
const installedPluginsCache = new WeakMap<PluginsStore, Plugin[]>()
const enabledPluginsCache = new WeakMap<PluginsStore, Plugin[]>()

export const selectFilteredPlugins = (state: PluginsStore) => {
  const cached = filteredPluginsCache.get(state)
  if (cached) return cached

  const { plugins, searchQuery, categoryFilter } = state
  const query = searchQuery.trim().toLowerCase()

  const result = plugins.filter((plugin) => {
    const matchesSearch =
      !query ||
      plugin.name.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query)
    const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  filteredPluginsCache.set(state, result)
  return result
}

export const selectInstalledPlugins = (state: PluginsStore) => {
  const cached = installedPluginsCache.get(state)
  if (cached) return cached

  const result = state.plugins.filter((p) => p.installed)
  installedPluginsCache.set(state, result)
  return result
}

export const selectEnabledPlugins = (state: PluginsStore) => {
  const cached = enabledPluginsCache.get(state)
  if (cached) return cached

  const result = state.plugins.filter((p) => p.enabled)
  enabledPluginsCache.set(state, result)
  return result
}

export const selectPluginById = (id: string) => (state: PluginsStore) =>
  state.plugins.find((p) => p.id === id)
