import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { useSchedulerStore } from '../index'

vi.mock('@/lib/ipc', () => ({
  ipc: {
    config: {
      get: vi.fn(),
    },
    state: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  },
}))

describe('SchedulerStore', () => {
  beforeEach(() => {
    useSchedulerStore.setState({ tasks: [], isLoading: false, error: null })
    vi.clearAllMocks()
  })

  it('loads tasks from clawui.json via ipc.state.get', async () => {
    const { ipc } = await import('@/lib/ipc')
    ;(ipc.config.get as Mock).mockResolvedValue({ cron: { enabled: true } })
    ;(ipc.state.get as Mock).mockResolvedValue({
      scheduler: {
        tasks: [
          {
            id: 't1',
            name: 'Task',
            description: 'Desc',
            cron: '0 * * * *',
            enabled: true,
            action: { type: 'message', content: 'hi' },
            runCount: 0,
          },
        ],
      },
    })

    await useSchedulerStore.getState().loadTasks()

    const state = useSchedulerStore.getState()
    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]?.id).toBe('t1')
    expect(state.isLoading).toBe(false)
  })

  it('persists tasks via ipc.state.patch on add', async () => {
    const { ipc } = await import('@/lib/ipc')
    ;(ipc.state.patch as Mock).mockResolvedValue(undefined)

    await useSchedulerStore.getState().addTask({
      name: 'Task',
      description: 'Desc',
      cron: '0 * * * *',
      enabled: true,
      action: { type: 'message', content: 'hi' },
    })

    expect(ipc.state.patch).toHaveBeenCalled()
  })
})

