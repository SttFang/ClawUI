import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { useSettingsStore } from '../index'

// Mock IPC
vi.mock('@/lib/ipc', () => ({
  ipc: {
    config: {
      get: vi.fn(),
    },
    profiles: {
      patchEnvBoth: vi.fn(),
    },
    models: {
      status: vi.fn(),
    },
    state: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  },
  getElectronAPI: vi.fn(() => ({})), // Mock as available by default
}))

const initialState = {
  apiKeys: {
    anthropic: '',
    openai: '',
    openrouter: '',
  },
  autoStartGateway: true,
  autoCheckUpdates: true,
  isLoading: false,
  isSaving: false,
  error: null,
  saveSuccess: false,
  modelsStatus: null,
  modelsLoading: false,
}

describe('SettingsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSettingsStore.setState(initialState)
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadSettings', () => {
    it('should load API keys from config', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.config.get as Mock).mockResolvedValue({
        env: {
          ANTHROPIC_API_KEY: 'sk-ant-xxx',
          OPENAI_API_KEY: 'sk-openai-xxx',
          OPENROUTER_API_KEY: 'sk-or-xxx',
        },
      })

      const { loadSettings } = useSettingsStore.getState()
      await loadSettings()

      const state = useSettingsStore.getState()
      expect(state.apiKeys.anthropic).toBe('sk-ant-xxx')
      expect(state.apiKeys.openai).toBe('sk-openai-xxx')
      expect(state.apiKeys.openrouter).toBe('sk-or-xxx')
      expect(state.isLoading).toBe(false)
    })

    it('should handle partial config', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.config.get as Mock).mockResolvedValue({
        env: {
          ANTHROPIC_API_KEY: 'sk-ant-xxx',
        },
      })

      const { loadSettings } = useSettingsStore.getState()
      await loadSettings()

      const state = useSettingsStore.getState()
      expect(state.apiKeys.anthropic).toBe('sk-ant-xxx')
      expect(state.apiKeys.openai).toBe('')
      expect(state.apiKeys.openrouter).toBe('')
    })

    it('should handle null config', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.config.get as Mock).mockResolvedValue(null)

      const { loadSettings } = useSettingsStore.getState()
      await loadSettings()

      const state = useSettingsStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.apiKeys.anthropic).toBe('')
    })

    it('should handle config without env', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.config.get as Mock).mockResolvedValue({})

      const { loadSettings } = useSettingsStore.getState()
      await loadSettings()

      const state = useSettingsStore.getState()
      expect(state.apiKeys.anthropic).toBe('')
      expect(state.apiKeys.openai).toBe('')
    })

    it('should handle load error', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.config.get as Mock).mockRejectedValue(new Error('Config read failed'))

      const { loadSettings } = useSettingsStore.getState()
      await loadSettings()

      const state = useSettingsStore.getState()
      expect(state.error).toBe('Config read failed')
      expect(state.isLoading).toBe(false)
    })

    it('should set loading state during load', async () => {
      const { ipc } = await import('@/lib/ipc')

      let capturedLoading = false
      ;(ipc.config.get as Mock).mockImplementation(() => {
        capturedLoading = useSettingsStore.getState().isLoading
        return Promise.resolve({})
      })

      const { loadSettings } = useSettingsStore.getState()
      await loadSettings()

      expect(capturedLoading).toBe(true)
    })
  })

  describe('setApiKey', () => {
    it('should update anthropic API key', () => {
      const { setApiKey } = useSettingsStore.getState()

      setApiKey('anthropic', 'sk-ant-new')

      expect(useSettingsStore.getState().apiKeys.anthropic).toBe('sk-ant-new')
    })

    it('should update openai API key', () => {
      const { setApiKey } = useSettingsStore.getState()

      setApiKey('openai', 'sk-openai-new')

      expect(useSettingsStore.getState().apiKeys.openai).toBe('sk-openai-new')
    })

    it('should update openrouter API key', () => {
      const { setApiKey } = useSettingsStore.getState()

      setApiKey('openrouter', 'sk-or-new')

      expect(useSettingsStore.getState().apiKeys.openrouter).toBe('sk-or-new')
    })

    it('should clear saveSuccess when key changes', () => {
      useSettingsStore.setState({ saveSuccess: true })

      const { setApiKey } = useSettingsStore.getState()
      setApiKey('anthropic', 'sk-ant-new')

      expect(useSettingsStore.getState().saveSuccess).toBe(false)
    })

    it('should preserve other keys when updating one', () => {
      useSettingsStore.setState({
        apiKeys: {
          anthropic: 'sk-ant-existing',
          openai: 'sk-openai-existing',
          openrouter: 'sk-or-existing',
        },
      })

      const { setApiKey } = useSettingsStore.getState()
      setApiKey('openai', 'sk-openai-new')

      const state = useSettingsStore.getState()
      expect(state.apiKeys.anthropic).toBe('sk-ant-existing')
      expect(state.apiKeys.openai).toBe('sk-openai-new')
      expect(state.apiKeys.openrouter).toBe('sk-or-existing')
    })
  })

  describe('saveApiKeys', () => {
    it('should save all API keys', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.profiles.patchEnvBoth as Mock).mockResolvedValue(undefined)

      useSettingsStore.setState({
        apiKeys: {
          anthropic: 'sk-ant-xxx',
          openai: 'sk-openai-xxx',
          openrouter: 'sk-or-xxx',
        },
      })

      const { saveApiKeys } = useSettingsStore.getState()
      await saveApiKeys()

      expect(ipc.profiles.patchEnvBoth).toHaveBeenCalledWith({
        ANTHROPIC_API_KEY: 'sk-ant-xxx',
        OPENAI_API_KEY: 'sk-openai-xxx',
        OPENROUTER_API_KEY: 'sk-or-xxx',
      })
    })

    it('should only save non-empty keys', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.profiles.patchEnvBoth as Mock).mockResolvedValue(undefined)

      useSettingsStore.setState({
        apiKeys: {
          anthropic: 'sk-ant-xxx',
          openai: '',
          openrouter: '',
        },
      })

      const { saveApiKeys } = useSettingsStore.getState()
      await saveApiKeys()

      expect(ipc.profiles.patchEnvBoth).toHaveBeenCalledWith({
        ANTHROPIC_API_KEY: 'sk-ant-xxx',
      })
    })

    it('should set saveSuccess on successful save', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.profiles.patchEnvBoth as Mock).mockResolvedValue(undefined)

      const { saveApiKeys } = useSettingsStore.getState()
      await saveApiKeys()

      expect(useSettingsStore.getState().saveSuccess).toBe(true)
      expect(useSettingsStore.getState().isSaving).toBe(false)
    })

    it('should clear saveSuccess after 3 seconds', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.profiles.patchEnvBoth as Mock).mockResolvedValue(undefined)

      const { saveApiKeys } = useSettingsStore.getState()
      await saveApiKeys()

      expect(useSettingsStore.getState().saveSuccess).toBe(true)

      vi.advanceTimersByTime(3000)

      expect(useSettingsStore.getState().saveSuccess).toBe(false)
    })

    it('should handle save error', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.profiles.patchEnvBoth as Mock).mockRejectedValue(new Error('Write failed'))

      const { saveApiKeys } = useSettingsStore.getState()
      await saveApiKeys()

      const state = useSettingsStore.getState()
      expect(state.error).toBe('Write failed')
      expect(state.isSaving).toBe(false)
      expect(state.saveSuccess).toBe(false)
    })

    it('should set isSaving during save', async () => {
      const { ipc } = await import('@/lib/ipc')

      let capturedSaving = false
      ;(ipc.profiles.patchEnvBoth as Mock).mockImplementation(() => {
        capturedSaving = useSettingsStore.getState().isSaving
        return Promise.resolve()
      })

      const { saveApiKeys } = useSettingsStore.getState()
      await saveApiKeys()

      expect(capturedSaving).toBe(true)
    })
  })

  describe('setAutoStartGateway', () => {
    it('should update autoStartGateway setting', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.state.patch as Mock).mockResolvedValue({})
      const { setAutoStartGateway } = useSettingsStore.getState()

      await setAutoStartGateway(false)
      expect(useSettingsStore.getState().autoStartGateway).toBe(false)

      await setAutoStartGateway(true)
      expect(useSettingsStore.getState().autoStartGateway).toBe(true)
    })
  })

  describe('setAutoCheckUpdates', () => {
    it('should update autoCheckUpdates setting', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.state.patch as Mock).mockResolvedValue({})
      const { setAutoCheckUpdates } = useSettingsStore.getState()

      await setAutoCheckUpdates(false)
      expect(useSettingsStore.getState().autoCheckUpdates).toBe(false)

      await setAutoCheckUpdates(true)
      expect(useSettingsStore.getState().autoCheckUpdates).toBe(true)
    })
  })

  describe('loadPreferences', () => {
    it('should hydrate preferences from clawui state', async () => {
      const { ipc } = await import('@/lib/ipc')
      ;(ipc.state.get as Mock).mockResolvedValue({
        openclaw: { autoStart: { main: false } },
        app: { autoCheckUpdates: false },
      })

      await useSettingsStore.getState().loadPreferences()

      expect(useSettingsStore.getState().autoStartGateway).toBe(false)
      expect(useSettingsStore.getState().autoCheckUpdates).toBe(false)
    })
  })

  describe('clearSaveSuccess', () => {
    it('should clear saveSuccess flag', () => {
      useSettingsStore.setState({ saveSuccess: true })

      const { clearSaveSuccess } = useSettingsStore.getState()
      clearSaveSuccess()

      expect(useSettingsStore.getState().saveSuccess).toBe(false)
    })
  })

  describe('selectors', () => {
    it('selectApiKeys should return API keys', async () => {
      const { selectApiKeys } = await import('../index')
      useSettingsStore.setState({
        apiKeys: {
          anthropic: 'sk-ant-xxx',
          openai: 'sk-openai-xxx',
          openrouter: 'sk-or-xxx',
        },
      })

      const apiKeys = selectApiKeys(useSettingsStore.getState())
      expect(apiKeys.anthropic).toBe('sk-ant-xxx')
      expect(apiKeys.openai).toBe('sk-openai-xxx')
      expect(apiKeys.openrouter).toBe('sk-or-xxx')
    })

    it('selectAutoStartGateway should return setting', async () => {
      const { selectAutoStartGateway } = await import('../index')
      useSettingsStore.setState({ autoStartGateway: false })

      expect(selectAutoStartGateway(useSettingsStore.getState())).toBe(false)
    })

    it('selectAutoCheckUpdates should return setting', async () => {
      const { selectAutoCheckUpdates } = await import('../index')
      useSettingsStore.setState({ autoCheckUpdates: false })

      expect(selectAutoCheckUpdates(useSettingsStore.getState())).toBe(false)
    })

    it('selectIsLoading should return loading state', async () => {
      const { selectIsLoading } = await import('../index')
      useSettingsStore.setState({ isLoading: true })

      expect(selectIsLoading(useSettingsStore.getState())).toBe(true)
    })

    it('selectIsSaving should return saving state', async () => {
      const { selectIsSaving } = await import('../index')
      useSettingsStore.setState({ isSaving: true })

      expect(selectIsSaving(useSettingsStore.getState())).toBe(true)
    })

    it('selectError should return error', async () => {
      const { selectError } = await import('../index')
      useSettingsStore.setState({ error: 'Test error' })

      expect(selectError(useSettingsStore.getState())).toBe('Test error')
    })

    it('selectSaveSuccess should return save success state', async () => {
      const { selectSaveSuccess } = await import('../index')
      useSettingsStore.setState({ saveSuccess: true })

      expect(selectSaveSuccess(useSettingsStore.getState())).toBe(true)
    })
  })
})
