import { create } from 'zustand'
import { ipc } from '@/lib/ipc'
import { toolsLog } from '@/lib/logger'
import { createWeakCachedSelector } from '@/store/utils/createWeakCachedSelector'

export type ToolAccessMode = 'auto' | 'ask' | 'deny'

export interface Tool {
  id: string
  name: string
  description: string
  category: 'filesystem' | 'web' | 'command' | 'database' | 'media' | 'mcp'
  enabled: boolean
  requiresConfirmation: boolean
}

export interface ToolsConfig {
  accessMode: ToolAccessMode
  allowList: string[]
  denyList: string[]
  sandboxEnabled: boolean
}

interface ToolsState {
  tools: Tool[]
  config: ToolsConfig
  isLoading: boolean
  error: string | null
}

interface ToolsActions {
  loadTools: () => Promise<void>
  setAccessMode: (mode: ToolAccessMode) => Promise<void>
  enableTool: (toolId: string) => Promise<void>
  disableTool: (toolId: string) => Promise<void>
  toggleSandbox: (enabled: boolean) => Promise<void>
  addToAllowList: (toolId: string) => Promise<void>
  addToDenyList: (toolId: string) => Promise<void>
  removeFromAllowList: (toolId: string) => Promise<void>
  removeFromDenyList: (toolId: string) => Promise<void>
}

type ToolsStore = ToolsState & ToolsActions

// Default tools available in OpenClaw
const defaultTools: Tool[] = [
  {
    id: 'fs',
    name: 'File System',
    description: 'Read, write, and manage files on the system',
    category: 'filesystem',
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: 'web',
    name: 'Web Access',
    description: 'Browse websites and fetch web content',
    category: 'web',
    enabled: true,
    requiresConfirmation: false,
  },
  {
    id: 'bash',
    name: 'Command Execution',
    description: 'Execute shell commands and scripts',
    category: 'command',
    enabled: true,
    requiresConfirmation: true,
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Query and manage database connections',
    category: 'database',
    enabled: false,
    requiresConfirmation: true,
  },
  {
    id: 'media',
    name: 'Media Processing',
    description: 'Process images, audio, and video files',
    category: 'media',
    enabled: false,
    requiresConfirmation: false,
  },
]

const initialState: ToolsState = {
  tools: defaultTools,
  config: {
    accessMode: 'auto',
    allowList: [],
    denyList: [],
    sandboxEnabled: true,
  },
  isLoading: false,
  error: null,
}

export const useToolsStore = create<ToolsStore>((set, get) => ({
  ...initialState,

  loadTools: async () => {
    set({ isLoading: true, error: null })
    try {
      const config = await ipc.config.get()
      if (config?.tools) {
        const toolsConfig: ToolsConfig = {
          accessMode: config.tools.access || 'auto',
          allowList: config.tools.allow || [],
          denyList: config.tools.deny || [],
          sandboxEnabled: config.tools.sandbox?.enabled ?? true,
        }

        // Update tools enabled status based on allow/deny lists
        const tools = get().tools.map((tool) => ({
          ...tool,
          enabled: toolsConfig.denyList.includes(tool.id)
            ? false
            : toolsConfig.allowList.includes(tool.id) || tool.enabled,
        }))

        set({ config: toolsConfig, tools, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load tools config'
      set({ error: message, isLoading: false })
    }
  },

  setAccessMode: async (mode) => {
    const { config } = get()
    const newConfig = { ...config, accessMode: mode }
    set({ config: newConfig })

    try {
      await ipc.config.set({
        tools: {
          access: mode,
          allow: config.allowList,
          deny: config.denyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to save access mode:', error)
    }
  },

  enableTool: async (toolId) => {
    const { tools, config } = get()
    const newTools = tools.map((t) => (t.id === toolId ? { ...t, enabled: true } : t))
    const newDenyList = config.denyList.filter((id) => id !== toolId)
    const newAllowList = config.allowList.includes(toolId)
      ? config.allowList
      : [...config.allowList, toolId]

    set({
      tools: newTools,
      config: { ...config, allowList: newAllowList, denyList: newDenyList },
    })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: newAllowList,
          deny: newDenyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to enable tool:', error)
    }
  },

  disableTool: async (toolId) => {
    const { tools, config } = get()
    const newTools = tools.map((t) => (t.id === toolId ? { ...t, enabled: false } : t))
    const newAllowList = config.allowList.filter((id) => id !== toolId)
    const newDenyList = config.denyList.includes(toolId)
      ? config.denyList
      : [...config.denyList, toolId]

    set({
      tools: newTools,
      config: { ...config, allowList: newAllowList, denyList: newDenyList },
    })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: newAllowList,
          deny: newDenyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to disable tool:', error)
    }
  },

  toggleSandbox: async (enabled) => {
    const { config } = get()
    set({ config: { ...config, sandboxEnabled: enabled } })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: config.allowList,
          deny: config.denyList,
          sandbox: { enabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to toggle sandbox:', error)
    }
  },

  addToAllowList: async (toolId) => {
    const { config } = get()
    if (config.allowList.includes(toolId)) return

    const newAllowList = [...config.allowList, toolId]
    const newDenyList = config.denyList.filter((id) => id !== toolId)
    set({ config: { ...config, allowList: newAllowList, denyList: newDenyList } })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: newAllowList,
          deny: newDenyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to add to allow list:', error)
    }
  },

  addToDenyList: async (toolId) => {
    const { config } = get()
    if (config.denyList.includes(toolId)) return

    const newDenyList = [...config.denyList, toolId]
    const newAllowList = config.allowList.filter((id) => id !== toolId)
    set({ config: { ...config, allowList: newAllowList, denyList: newDenyList } })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: newAllowList,
          deny: newDenyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to add to deny list:', error)
    }
  },

  removeFromAllowList: async (toolId) => {
    const { config } = get()
    const newAllowList = config.allowList.filter((id) => id !== toolId)
    set({ config: { ...config, allowList: newAllowList } })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: newAllowList,
          deny: config.denyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to remove from allow list:', error)
    }
  },

  removeFromDenyList: async (toolId) => {
    const { config } = get()
    const newDenyList = config.denyList.filter((id) => id !== toolId)
    set({ config: { ...config, denyList: newDenyList } })

    try {
      await ipc.config.set({
        tools: {
          access: config.accessMode,
          allow: config.allowList,
          deny: newDenyList,
          sandbox: { enabled: config.sandboxEnabled },
        },
      })
    } catch (error) {
      toolsLog.error('Failed to remove from deny list:', error)
    }
  },
}))

// Selectors
export const selectTools = (state: ToolsStore) => state.tools
export const selectToolsConfig = (state: ToolsStore) => state.config
export const selectAccessMode = (state: ToolsStore) => state.config.accessMode
export const selectEnabledTools = createWeakCachedSelector((state: ToolsStore) =>
  state.tools.filter((t) => t.enabled)
)
export const selectToolById = (id: string) => (state: ToolsStore) =>
  state.tools.find((t) => t.id === id)
export const selectIsLoading = (state: ToolsStore) => state.isLoading
export const selectError = (state: ToolsStore) => state.error
