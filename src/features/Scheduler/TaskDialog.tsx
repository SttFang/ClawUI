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
import { useTranslation } from 'react-i18next'
import { schedulerLog } from '@/lib/logger'
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

function cronToHumanReadable(cron: string, t?: (key: string, params?: Record<string, unknown>) => string): string {
  const parts = cron.split(' ')
  if (parts.length !== 5) return cron

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts
  const dayKey = (n: number): string => {
    switch (n) {
      case 0: return 'sunday'
      case 1: return 'monday'
      case 2: return 'tuesday'
      case 3: return 'wednesday'
      case 4: return 'thursday'
      case 5: return 'friday'
      case 6: return 'saturday'
      default: return 'sunday'
    }
  }

  if (minute !== '*' && hour === '*') {
    return t ? t('scheduler.taskDialog.cronReadable.everyHourAtMinute', { minute }) : `Every hour at minute ${minute}`
  }

  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    return t ? t('scheduler.taskDialog.cronReadable.everyDayAtTime', { time }) : `Every day at ${time}`
  }

  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && dayOfWeek !== '*') {
    const dayNum = parseInt(dayOfWeek, 10)
    const day = t ? t(`scheduler.taskDialog.weekdays.${dayKey(dayNum)}`) : String(dayOfWeek)
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    return t ? t('scheduler.taskDialog.cronReadable.everyWeekdayAtTime', { day, time }) : `Every ${day} at ${time}`
  }

  if (minute !== '*' && hour !== '*' && dayOfMonth !== '*') {
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    return t ? t('scheduler.taskDialog.cronReadable.everyMonthDayAtTime', { dayOfMonth, time }) : `Day ${dayOfMonth} of each month at ${time}`
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
  const { t } = useTranslation('common')
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
      schedulerLog.error('Failed to save task:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const cronValue = cronPreset === 'custom' ? customCron : cronPreset
  const cronReadable = cronValue ? cronToHumanReadable(cronValue, t) : ''

  const CRON_PRESETS = [
    { label: t('scheduler.taskDialog.cronPresets.everyHour'), value: '0 * * * *' },
    { label: t('scheduler.taskDialog.cronPresets.everyDay0900'), value: '0 9 * * *' },
    { label: t('scheduler.taskDialog.cronPresets.everyDay1800'), value: '0 18 * * *' },
    { label: t('scheduler.taskDialog.cronPresets.everyMonday0900'), value: '0 9 * * 1' },
    { label: t('scheduler.taskDialog.cronPresets.everyFriday1800'), value: '0 18 * * 5' },
    { label: t('scheduler.taskDialog.cronPresets.firstDayOfMonth'), value: '0 0 1 * *' },
    { label: t('scheduler.taskDialog.cronPresets.custom'), value: 'custom' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{isEditing ? t('scheduler.taskDialog.titleEdit') : t('scheduler.taskDialog.titleCreate')}</DialogTitle>
          <DialogDescription>
            {isEditing ? t('scheduler.taskDialog.descEdit') : t('scheduler.taskDialog.descCreate')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('scheduler.taskDialog.fields.name')}</Label>
            <Input
              id="name"
              placeholder={t('scheduler.taskDialog.placeholders.name')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('scheduler.taskDialog.fields.description')}</Label>
            <Input
              id="description"
              placeholder={t('scheduler.taskDialog.placeholders.description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">{t('scheduler.taskDialog.fields.schedule')}</Label>
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
                placeholder={t('scheduler.taskDialog.placeholders.customCron')}
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
            <Label htmlFor="actionType">{t('scheduler.taskDialog.fields.actionType')}</Label>
            <Select
              id="actionType"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as typeof actionType)}
            >
              <option value="message">{t('scheduler.taskDialog.actionTypes.message')}</option>
              <option value="command">{t('scheduler.taskDialog.actionTypes.command')}</option>
              <option value="webhook">{t('scheduler.taskDialog.actionTypes.webhook')}</option>
            </Select>
          </div>

          {actionType === 'webhook' && (
            <div className="space-y-2">
              <Label htmlFor="target">{t('scheduler.taskDialog.fields.webhookUrl')}</Label>
              <Input
                id="target"
                type="url"
                placeholder={t('scheduler.taskDialog.placeholders.webhookUrl')}
                value={actionTarget}
                onChange={(e) => setActionTarget(e.target.value)}
              />
            </div>
          )}

          {actionType === 'message' && (
            <div className="space-y-2">
              <Label htmlFor="target">{t('scheduler.taskDialog.fields.channelIdOptional')}</Label>
              <Input
                id="target"
                placeholder={t('scheduler.taskDialog.placeholders.channelIdOptional')}
                value={actionTarget}
                onChange={(e) => setActionTarget(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="content">
              {actionType === 'message'
                ? t('scheduler.taskDialog.fields.messageContent')
                : actionType === 'command'
                  ? t('scheduler.taskDialog.fields.command')
                  : t('scheduler.taskDialog.fields.webhookPayload')}
            </Label>
            <Input
              id="content"
              placeholder={
                actionType === 'message'
                  ? t('scheduler.taskDialog.placeholders.messageContent')
                  : actionType === 'command'
                    ? t('scheduler.taskDialog.placeholders.command')
                    : t('scheduler.taskDialog.placeholders.webhookPayload')
              }
              value={actionContent}
              onChange={(e) => setActionContent(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !name.trim() || !cronValue.trim() || !actionContent.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('status.saving')}
              </>
            ) : isEditing ? (
              t('actions.save')
            ) : (
              t('actions.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { cronToHumanReadable }
