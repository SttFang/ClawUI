import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Switch,
} from '@clawui/ui'
import { Clock, Plus, Play, Trash2, Edit, CalendarClock } from 'lucide-react'
import { useSchedulerStore, selectTasks, selectIsLoading } from '@/store/scheduler'
import { TaskDialog, cronToHumanReadable } from '@/features/Scheduler'
import type { ScheduledTask } from '@/store/scheduler'

function formatNextRun(timestamp?: number): string {
  if (!timestamp) return 'Not scheduled'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = timestamp - now.getTime()

  if (diff < 0) return 'Overdue'
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.round(diff / (60 * 1000))
    return `In ${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.round(diff / (60 * 60 * 1000))
    return `In ${hours} hour${hours === 1 ? '' : 's'}`
  }
  return date.toLocaleString()
}

function formatLastRun(timestamp?: number): string {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export default function SchedulerPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null)

  const tasks = useSchedulerStore(selectTasks)
  const isLoading = useSchedulerStore(selectIsLoading)
  const loadTasks = useSchedulerStore((s) => s.loadTasks)
  const addTask = useSchedulerStore((s) => s.addTask)
  const updateTask = useSchedulerStore((s) => s.updateTask)
  const deleteTask = useSchedulerStore((s) => s.deleteTask)
  const toggleTask = useSchedulerStore((s) => s.toggleTask)
  const runTask = useSchedulerStore((s) => s.runTask)

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreateTask = () => {
    setEditingTask(null)
    setDialogOpen(true)
  }

  const handleEditTask = (task: ScheduledTask) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  const handleDeleteTask = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask(id)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Scheduler</h1>
            <p className="text-muted-foreground">
              Schedule automated tasks for your AI assistant
            </p>
          </div>
          <Button onClick={handleCreateTask}>
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarClock className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No scheduled tasks</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first scheduled task to automate repetitive actions.
              </p>
              <Button onClick={handleCreateTask}>
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-lg">{task.name}</CardTitle>
                        <CardDescription>{task.description}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={task.enabled}
                      onCheckedChange={() => toggleTask(task.id)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <code className="bg-muted px-2 py-1 rounded">{task.cron}</code>
                        <span className="ml-2">{cronToHumanReadable(task.cron)}</span>
                      </div>
                      <div className="flex gap-4">
                        <span>
                          Next: {task.enabled ? formatNextRun(task.nextRun) : 'Disabled'}
                        </span>
                        <span>Last run: {formatLastRun(task.lastRun)}</span>
                        <span>Runs: {task.runCount}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runTask(task.id)}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Run Now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTask(task)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSave={addTask}
        onUpdate={updateTask}
      />
    </div>
  )
}
