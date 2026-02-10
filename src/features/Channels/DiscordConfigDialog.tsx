import { useState, useEffect } from 'react'
import {
  Button,
  Input,
  Label,
  Switch,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
} from '@clawui/ui'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { channelsLog } from '@/lib/logger'
import type { ChannelConfig } from '@/lib/ipc'

interface DiscordConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ChannelConfig | null
  onSave: (config: ChannelConfig) => Promise<void>
}

export function DiscordConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: DiscordConfigDialogProps) {
  const { t } = useTranslation('common')
  const [isLoading, setIsLoading] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [appToken, setAppToken] = useState('')
  const [dmPolicy, setDmPolicy] = useState<string>('pairing')
  const [groupPolicy, setGroupPolicy] = useState<string>('allowlist')
  const [requireMention, setRequireMention] = useState(true)

  useEffect(() => {
    if (config) {
      setBotToken(config.botToken || '')
      setAppToken(config.appToken || '')
      setDmPolicy(config.dmPolicy || 'pairing')
      setGroupPolicy(config.groupPolicy || 'allowlist')
      setRequireMention(config.requireMention ?? true)
    }
  }, [config])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await onSave({
        enabled: true,
        botToken,
        appToken,
        dmPolicy: dmPolicy as ChannelConfig['dmPolicy'],
        groupPolicy: groupPolicy as ChannelConfig['groupPolicy'],
        requireMention,
      })
      onOpenChange(false)
    } catch (error) {
      channelsLog.error('Failed to save config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{t('channels.discord.configTitle')}</DialogTitle>
          <DialogDescription>
            {t('channels.discord.configDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">{t('channels.fields.botToken')}</Label>
            <Input
              id="botToken"
              type="password"
              placeholder={t('channels.fields.botToken')}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appToken">{t('channels.fields.applicationId')}</Label>
            <Input
              id="appToken"
              placeholder={t('channels.fields.applicationId')}
              value={appToken}
              onChange={(e) => setAppToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('channels.discord.applicationHelpPrefix')}{' '}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Discord Developer Portal
              </a>
              {t('channels.discord.applicationHelpSuffix')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dmPolicy">{t('channels.policies.dm')}</Label>
            <Select
              id="dmPolicy"
              value={dmPolicy}
              onChange={(e) => setDmPolicy(e.target.value)}
            >
              <option value="pairing">{t('channels.policies.pairing')}</option>
              <option value="allowlist">{t('channels.policies.allowlist')}</option>
              <option value="open">{t('channels.policies.open')}</option>
              <option value="disabled">{t('channels.policies.disabled')}</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupPolicy">{t('channels.policies.groupDiscord')}</Label>
            <Select
              id="groupPolicy"
              value={groupPolicy}
              onChange={(e) => setGroupPolicy(e.target.value)}
            >
              <option value="allowlist">{t('channels.policies.allowlist')}</option>
              <option value="open">{t('channels.policies.open')}</option>
              <option value="disabled">{t('channels.policies.disabled')}</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>{t('channels.fields.requireMention')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('channels.fields.requireMentionChannelsHint')}
              </p>
            </div>
            <Switch
              checked={requireMention}
              onCheckedChange={setRequireMention}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !botToken}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('status.saving')}
              </>
            ) : (
              t('actions.save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
