import { create } from 'zustand'
import { ipc, ChannelConfig } from '@/lib/ipc'

export type ChannelType = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'wechat' | 'signal'

export interface Channel {
  type: ChannelType
  name: string
  description: string
  icon: string
  isConfigured: boolean
  isEnabled: boolean
  config: ChannelConfig | null
}

interface ChannelsState {
  channels: Channel[]
  isLoading: boolean
  error: string | null
}

interface ChannelsActions {
  loadChannels: () => Promise<void>
  enableChannel: (type: ChannelType) => Promise<void>
  disableChannel: (type: ChannelType) => Promise<void>
  configureChannel: (type: ChannelType, config: ChannelConfig) => Promise<void>
  setError: (error: string | null) => void
}

type ChannelsStore = ChannelsState & ChannelsActions

const defaultChannels: Channel[] = [
  {
    type: 'telegram',
    name: 'Telegram',
    description: 'Connect your Telegram bot',
    icon: '📱',
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: 'discord',
    name: 'Discord',
    description: 'Connect your Discord bot',
    icon: '🎮',
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: 'whatsapp',
    name: 'WhatsApp',
    description: 'Connect to WhatsApp',
    icon: '💬',
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: 'slack',
    name: 'Slack',
    description: 'Connect your Slack workspace',
    icon: '💼',
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: 'wechat',
    name: 'WeChat',
    description: 'Connect to WeChat',
    icon: '🟢',
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
  {
    type: 'signal',
    name: 'Signal',
    description: 'Connect to Signal',
    icon: '🔒',
    isConfigured: false,
    isEnabled: false,
    config: null,
  },
]

const initialState: ChannelsState = {
  channels: defaultChannels,
  isLoading: false,
  error: null,
}

export const useChannelsStore = create<ChannelsStore>((set, get) => ({
  ...initialState,

  loadChannels: async () => {
    set({ isLoading: true, error: null })
    try {
      const config = await ipc.config.get()
      if (config?.channels) {
        set((state) => ({
          channels: state.channels.map((channel) => {
            const channelConfig = config.channels[channel.type]
            return {
              ...channel,
              isConfigured: !!channelConfig,
              isEnabled: channelConfig?.enabled ?? false,
              config: channelConfig ?? null,
            }
          }),
          isLoading: false,
        }))
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load channels',
      })
    }
  },

  enableChannel: async (type) => {
    const channel = get().channels.find((c) => c.type === type)
    if (!channel?.config) return

    try {
      await ipc.config.set({
        channels: {
          [type]: { ...channel.config, enabled: true },
        },
      })
      set((state) => ({
        channels: state.channels.map((c) =>
          c.type === type ? { ...c, isEnabled: true } : c
        ),
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to enable channel' })
    }
  },

  disableChannel: async (type) => {
    try {
      await ipc.config.set({
        channels: {
          [type]: { enabled: false },
        },
      })
      set((state) => ({
        channels: state.channels.map((c) =>
          c.type === type ? { ...c, isEnabled: false } : c
        ),
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to disable channel' })
    }
  },

  configureChannel: async (type, config) => {
    try {
      await ipc.config.set({
        channels: {
          [type]: config,
        },
      })
      set((state) => ({
        channels: state.channels.map((c) =>
          c.type === type
            ? {
                ...c,
                isConfigured: true,
                isEnabled: config.enabled,
                config,
              }
            : c
        ),
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to configure channel' })
    }
  },

  setError: (error) => set({ error }),
}))

// Selectors
export const selectChannels = (state: ChannelsStore) => state.channels
export const selectEnabledChannels = (state: ChannelsStore) =>
  state.channels.filter((c) => c.isEnabled)
export const selectConfiguredChannels = (state: ChannelsStore) =>
  state.channels.filter((c) => c.isConfigured)
export const selectChannelByType = (type: ChannelType) => (state: ChannelsStore) =>
  state.channels.find((c) => c.type === type)
