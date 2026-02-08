import { useState, useEffect } from 'react'
import {
  Button,
  Input,
  Label,
  Select,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@clawui/ui'
import { Loader2 } from 'lucide-react'
import type { ScheduledTask } from '@/store/scheduler'

interface TaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: ScheduledTask | null
  onSave: (
    task: Omit<ScheduledTask, 'id' | 'lastRun' | 'nextRun' | 'runCount'>
  ) => Promise<void>
  onUpdate?: (id: string, updates: Partial<ScheduledTask>) => Promise<void>
}

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9:00', value: '0 9 * * *' },
  { label: 'Every day at 18:00', value: '0 18 * * *' },
  { label: 'Every Monday at 9:00', value: '0 9 * * 1' },
  { label: 'Every Friday at 18:00', value: '0 18 * * 5' },
  { label: 'First day of month', value: '0 0 1 * *' },
  { label: 'Custom', value: 'custom' },
]

function cronToHumanReadable(cron: string): string {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  if (minute !== '*' && hour === '*') {
    return `Every hour at minute ${minute}`
  }

  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return `Every day at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && dayOfWeek !== '*') {
    const dayName = days[parseInt(dayOfWeek, 10)] || dayOfWeek
    return `Every ${dayName} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  if (minute !== '*' && hour !== '*' && dayOfMonth !== '*') {
    return `Day ${dayOfMonth} of each month at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  return cron
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSave,
  onUpdate,
}: TaskDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cronPreset, setCronPreset] = useState('0 9 * * *')
  const [customCron, setCustomCron] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [actionType, setActionType] = useState<'message' | 'command' | 'webhook'>('message')
  const [actionTarget, setActionTarget] = useState('')
  const [actionContent, setActionContent] = useState('')

  const isEditing = !!task

  useEffect(() => {
    if (task) {
      setName(task.name)
      setDescription(task.description)
      setEnabled(task.enabled)
      setActionType(task.action.type)
      setActionTarget(task.action.target || '')
      setActionContent(task.action.content)

      // Check if cron matches a preset
      const preset = CRON_PRESETS.find((p) => p.value === task.cron)
      if (preset && preset.value !== 'custom') {
        setCronPreset(task.cron)
        setCustomCron('')
      } else {
        setCronPreset('custom')
        setCustomCron(task.cron)
      }
    } else {
      // Reset form for new task
      setName('')
      setDescription('')
      setCronPreset('0 9 * * *')
      setCustomCron('')
      setEnabled(true)
      setActionType('message')
      setActionTarget('')
      setActionContent('')
    }
  }, [task, open])

  const handleSave = async () => {
    const cronValue = cronPreset === 'custom' ? customCron : cronPreset

    if (!name.trim() || !cronValue.trim() || !actionContent.trim()) {
      return
    }

    setIsLoading(true)
    try {
      if (isEditing && onUpdate && task) {
        await onUpdate(task.id, {
          name: name.trim(),
          description: description.trim(),
          cron: cronValue.trim(),
          enabled,
          action: {
            type: actionType,
            target: actionTarget.trim() || undefined,
            content: actionContent.trim(),
          },
        })
      } else {
        await onSave({
          name: name.trim(),
          description: description.trim(),
          cron: cronValue.trim(),
          enabled,
          action: {
            type: actionType,
            target: actionTarget.trim() || undefined,
            content: actionContent.trim(),
          },
        })
      }
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const cronValue = cronPreset === 'custom' ? customCron : cronPreset
  const cronReadable = cronValue ? cronToHumanReadable(cronValue) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the scheduled task configuration'
              : 'Set up a new scheduled task'}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Task Name</Label>
            <Input
              id="name"
              placeholder="Daily Summary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Generate a daily work summary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
            <Select
              id="schedule"
              value={cronPreset}
              onChange={(e) => setCronPreset(e.target.value)}
            >
              {CRON_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </Select>
            {cronPreset === 'custom' && (
              <Input
                placeholder="0 9 * * *"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                className="mt-2"
              />
            )}
            {cronReadable && cronPreset !== 'custom' && (
              <p className="text-xs text-muted-foreground">{cronReadable}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="actionType">Action Type</Label>
            <Select
              id="actionType"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as typeof actionType)}
            >
              <option value="message">Send Message</option>
              <option value="command">Run Command</option>
              <option value="webhook">Call Webhook</option>
            </Select>
          </div>

          {actionType === 'webhook' && (
            <div className="space-y-2">
              <Label htmlFor="target">Webhook URL</Label>
              <Input
                id="target"
                type="url"
                placeholder="https://example.com/webhook"
                value={actionTarget}
                onChange={(e) => setActionTarget(e.target.value)}
              />
            </div>
          )}

          {actionType === 'message' && (
            <div className="space-y-2">
              <Label htmlFor="target">Channel ID (optional)</Label>
              <Input
                id="target"
                placeholder="Leave empty for default channel"
                value={actionTarget}
                onChange={(e) => setActionTarget(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">
              {actionType === 'message'
                ? 'Message Content'
                : actionType === 'command'
                  ? 'Command'
                  : 'Webhook Body'}
            </Label>
            <Input
              id="content"
              placeholder={
                actionType === 'message'
                  ? 'Generate my daily summary'
                  : actionType === 'command'
                    ? 'npm run build'
                    : '{"event": "scheduled"}'
              }
              value={actionContent}
              onChange={(e) => setActionContent(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !name.trim() || !cronValue.trim() || !actionContent.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : isEditing ? (
              'Update'
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { cronToHumanReadable }
