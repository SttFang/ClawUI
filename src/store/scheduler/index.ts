import { create } from 'zustand'
import { ipc } from '@/lib/ipc'

export interface ScheduledTask {
  id: string
  name: string
  description: string
  cron: string
  enabled: boolean
  action: {
    type: 'message' | 'command' | 'webhook'
    target?: string
    content: string
  }
  lastRun?: number
  nextRun?: number
  runCount: number
}

interface SchedulerState {
  tasks: ScheduledTask[]
  isLoading: boolean
  error: string | null
}

interface SchedulerActions {
  loadTasks: () => Promise<void>
  addTask: (task: Omit<ScheduledTask, 'id' | 'lastRun' | 'nextRun' | 'runCount'>) => Promise<void>
  updateTask: (id: string, updates: Partial<ScheduledTask>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  runTask: (id: string) => Promise<void>
}

type SchedulerStore = SchedulerState & SchedulerActions

const initialState: SchedulerState = {
  tasks: [],
  isLoading: false,
  error: null,
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function calculateNextRun(cron: string): number | undefined {
  // Simple calculation for common cron patterns
  // In production, use a library like cron-parser
  const now = new Date()
  const parts = cron.split(' ')
  if (parts.length !== 5) return undefined

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Handle "every hour" pattern: "0 * * * *"
  if (minute !== '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const nextHour = new Date(now)
    nextHour.setMinutes(parseInt(minute, 10))
    nextHour.setSeconds(0)
    nextHour.setMilliseconds(0)
    if (nextHour <= now) {
      nextHour.setHours(nextHour.getHours() + 1)
    }
    return nextHour.getTime()
  }

  // Handle "every day at X" pattern: "0 9 * * *"
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const nextDay = new Date(now)
    nextDay.setHours(parseInt(hour, 10))
    nextDay.setMinutes(parseInt(minute, 10))
    nextDay.setSeconds(0)
    nextDay.setMilliseconds(0)
    if (nextDay <= now) {
      nextDay.setDate(nextDay.getDate() + 1)
    }
    return nextDay.getTime()
  }

  // Handle "every week on day X" pattern: "0 9 * * 1"
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek, 10)
    const nextWeek = new Date(now)
    nextWeek.setHours(parseInt(hour, 10))
    nextWeek.setMinutes(parseInt(minute, 10))
    nextWeek.setSeconds(0)
    nextWeek.setMilliseconds(0)
    const currentDay = nextWeek.getDay()
    let daysToAdd = targetDay - currentDay
    if (daysToAdd < 0) daysToAdd += 7
    if (daysToAdd === 0 && nextWeek <= now) daysToAdd = 7
    nextWeek.setDate(nextWeek.getDate() + daysToAdd)
    return nextWeek.getTime()
  }

  // Handle "every month on day X" pattern: "0 0 1 * *"
  if (minute !== '*' && hour !== '*' && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const nextMonth = new Date(now)
    nextMonth.setDate(parseInt(dayOfMonth, 10))
    nextMonth.setHours(parseInt(hour, 10))
    nextMonth.setMinutes(parseInt(minute, 10))
    nextMonth.setSeconds(0)
    nextMonth.setMilliseconds(0)
    if (nextMonth <= now) {
      nextMonth.setMonth(nextMonth.getMonth() + 1)
    }
    return nextMonth.getTime()
  }

  return undefined
}

export const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  ...initialState,

  loadTasks: async () => {
    set({ isLoading: true, error: null })
    try {
      // Check if cron is enabled in config
      const config = await ipc.config.get()
      if (config?.cron?.enabled === false) {
        set({ isLoading: false })
        return
      }
      // Tasks would be stored in config or a separate file
      // For now, use localStorage as a simple persistence layer
      const storedTasks = localStorage.getItem('scheduler_tasks')
      if (storedTasks) {
        const tasks: ScheduledTask[] = JSON.parse(storedTasks)
        // Recalculate next run times
        const updatedTasks = tasks.map((task) => ({
          ...task,
          nextRun: task.enabled ? calculateNextRun(task.cron) : undefined,
        }))
        set({ tasks: updatedTasks, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load tasks'
      set({ error: message, isLoading: false })
    }
  },

  addTask: async (taskData) => {
    const { tasks } = get()
    const newTask: ScheduledTask = {
      ...taskData,
      id: generateId(),
      runCount: 0,
      nextRun: taskData.enabled ? calculateNextRun(taskData.cron) : undefined,
    }

    const newTasks = [...tasks, newTask]
    set({ tasks: newTasks })

    try {
      localStorage.setItem('scheduler_tasks', JSON.stringify(newTasks))
    } catch (error) {
      console.error('Failed to save task:', error)
    }
  },

  updateTask: async (id, updates) => {
    const { tasks } = get()
    const newTasks = tasks.map((task) => {
      if (task.id !== id) return task
      const updated = { ...task, ...updates }
      // Recalculate next run if cron or enabled changed
      if ('cron' in updates || 'enabled' in updates) {
        updated.nextRun = updated.enabled ? calculateNextRun(updated.cron) : undefined
      }
      return updated
    })

    set({ tasks: newTasks })

    try {
      localStorage.setItem('scheduler_tasks', JSON.stringify(newTasks))
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  },

  deleteTask: async (id) => {
    const { tasks } = get()
    const newTasks = tasks.filter((task) => task.id !== id)
    set({ tasks: newTasks })

    try {
      localStorage.setItem('scheduler_tasks', JSON.stringify(newTasks))
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  },

  toggleTask: async (id) => {
    const { tasks, updateTask } = get()
    const task = tasks.find((t) => t.id === id)
    if (task) {
      await updateTask(id, { enabled: !task.enabled })
    }
  },

  runTask: async (id) => {
    const { tasks, updateTask } = get()
    const task = tasks.find((t) => t.id === id)
    if (task) {
      // Update last run and run count
      await updateTask(id, {
        lastRun: Date.now(),
        runCount: task.runCount + 1,
        nextRun: calculateNextRun(task.cron),
      })
      // TODO: Actually execute the task action via IPC
      console.log('Running task:', task.name, task.action)
    }
  },
}))

// Selectors
export const selectTasks = (state: SchedulerStore) => state.tasks
export const selectEnabledTasks = (state: SchedulerStore) =>
  state.tasks.filter((t) => t.enabled)
export const selectTaskById = (id: string) => (state: SchedulerStore) =>
  state.tasks.find((t) => t.id === id)
export const selectIsLoading = (state: SchedulerStore) => state.isLoading
export const selectError = (state: SchedulerStore) => state.error
