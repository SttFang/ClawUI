import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { useSecretsStore } from '../index'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    config: {
      get: vi.fn(),
    },
    secrets: {
      patch: vi.fn(),
    },
  },
}))

describe('SecretsStore', () => {
  beforeEach(() => {
    useSecretsStore.setState({
      discordBotToken: '',
      discordAppToken: '',
      telegramBotToken: '',
      slackBotToken: '',
      slackAppToken: '',
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads secrets from config.env', async () => {
    const { ipc } = await import('@/lib/ipc')
    ;(ipc.config.get as Mock).mockResolvedValue({
      env: {
        DISCORD_BOT_TOKEN: 'bot',
        DISCORD_APP_TOKEN: 'app',
      },
    })

    await useSecretsStore.getState().load()

    const state = useSecretsStore.getState()
    expect(state.discordBotToken).toBe('bot')
    expect(state.discordAppToken).toBe('app')
    expect(state.isLoading).toBe(false)
  })

  it('saves allowlisted secrets via ipc.secrets.patch', async () => {
    const { ipc } = await import('@/lib/ipc')
    ;(ipc.secrets.patch as Mock).mockResolvedValue(undefined)

    useSecretsStore.setState({
      discordBotToken: 'bot',
      discordAppToken: '',
      telegramBotToken: 'tg',
      slackBotToken: '',
      slackAppToken: '',
      isLoading: false,
      isSaving: false,
      error: null,
      saveSuccess: false,
    })

    await useSecretsStore.getState().save()

    expect(ipc.secrets.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        DISCORD_BOT_TOKEN: 'bot',
        TELEGRAM_BOT_TOKEN: 'tg',
      })
    )
    expect(useSecretsStore.getState().saveSuccess).toBe(true)

    vi.advanceTimersByTime(3000)
    expect(useSecretsStore.getState().saveSuccess).toBe(false)
  })
})
