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
import type { ChannelConfig } from '@/lib/ipc'

interface TelegramConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ChannelConfig | null
  onSave: (config: ChannelConfig) => Promise<void>
}

export function TelegramConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: TelegramConfigDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [dmPolicy, setDmPolicy] = useState<string>('pairing')
  const [groupPolicy, setGroupPolicy] = useState<string>('allowlist')
  const [requireMention, setRequireMention] = useState(true)
  const [historyLimit, setHistoryLimit] = useState(50)

  useEffect(() => {
    if (config) {
      setBotToken(config.botToken || '')
      setDmPolicy(config.dmPolicy || 'pairing')
      setGroupPolicy(config.groupPolicy || 'allowlist')
      setRequireMention(config.requireMention ?? true)
      setHistoryLimit(config.historyLimit ?? 50)
    }
  }, [config])

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await onSave({
        enabled: true,
        botToken,
        dmPolicy: dmPolicy as ChannelConfig['dmPolicy'],
        groupPolicy: groupPolicy as ChannelConfig['groupPolicy'],
        requireMention,
        historyLimit,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Configure Telegram</DialogTitle>
          <DialogDescription>
            Set up your Telegram bot integration
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get your bot token from{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                @BotFather
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dmPolicy">DM Policy</Label>
            <Select
              id="dmPolicy"
              value={dmPolicy}
              onChange={(e) => setDmPolicy(e.target.value)}
            >
              <option value="pairing">Pairing (require code)</option>
              <option value="allowlist">Allowlist only</option>
              <option value="open">Open (anyone can DM)</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupPolicy">Group Policy</Label>
            <Select
              id="groupPolicy"
              value={groupPolicy}
              onChange={(e) => setGroupPolicy(e.target.value)}
            >
              <option value="allowlist">Allowlist only</option>
              <option value="open">Open (all groups)</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require Mention</Label>
              <p className="text-xs text-muted-foreground">
                Bot must be mentioned in groups
              </p>
            </div>
            <Switch
              checked={requireMention}
              onCheckedChange={setRequireMention}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="historyLimit">History Limit</Label>
            <Input
              id="historyLimit"
              type="number"
              min={1}
              max={200}
              value={historyLimit}
              onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 50)}
            />
            <p className="text-xs text-muted-foreground">
              Maximum messages to include in context
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !botToken}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
