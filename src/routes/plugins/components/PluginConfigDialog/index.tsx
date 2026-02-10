import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Switch,
} from '@clawui/ui'
import { useTranslation } from 'react-i18next'
import type { Plugin, PluginConfigSchema } from '@/store/plugins'

function getDefaultConfig(schema?: PluginConfigSchema): Record<string, unknown> {
  if (!schema) return {}
  const defaults: Record<string, unknown> = {}
  for (const [key, field] of Object.entries(schema)) {
    if (field.default !== undefined) defaults[key] = field.default
  }
  return defaults
}

export function PluginConfigDialog(props: {
  plugin: Plugin | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, config: Record<string, unknown>) => void
}) {
  const { plugin, open, onOpenChange, onSave } = props
  const { t } = useTranslation('common')
  const [config, setConfig] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!plugin) return
    const defaults = getDefaultConfig(plugin.configSchema)
    setConfig({ ...defaults, ...(plugin.config ?? {}) })
  }, [plugin, open])

  const handleSave = () => {
    if (!plugin) return
    onSave(plugin.id, config)
    onOpenChange(false)
  }

  if (!plugin?.configSchema) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t('plugins.config.title', { name: plugin.name })}</DialogTitle>
          <DialogDescription>{t('plugins.config.description')}</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {Object.entries(plugin.configSchema).map(([key, field]) => {
            const rawValue = config[key]
            const showDescription = field.description && field.type !== 'boolean'

            return (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>
                  {field.label}
                  {field.required ? <span className="text-destructive ml-1">*</span> : null}
                </Label>

                {field.type === 'string' ? (
                  <Input
                    id={key}
                    value={typeof rawValue === 'string' ? rawValue : ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={field.description}
                  />
                ) : null}

                {field.type === 'number' ? (
                  <Input
                    id={key}
                    type="number"
                    value={typeof rawValue === 'number' && Number.isFinite(rawValue) ? String(rawValue) : ''}
                    onChange={(e) => {
                      const next = e.target.value.trim()
                      setConfig((prev) => ({
                        ...prev,
                        [key]: next === '' ? undefined : Number(next),
                      }))
                    }}
                    placeholder={field.description}
                  />
                ) : null}

                {field.type === 'boolean' ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rawValue === true}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                    {field.description ? (
                      <span className="text-sm text-muted-foreground">{field.description}</span>
                    ) : null}
                  </div>
                ) : null}

                {field.type === 'select' && field.options ? (
                  <Select
                    id={key}
                    value={typeof rawValue === 'string' ? rawValue : ''}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : null}

                {showDescription ? (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                ) : null}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('actions.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
