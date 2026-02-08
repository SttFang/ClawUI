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
      console.error('Failed to save config:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Configure Discord</DialogTitle>
          <DialogDescription>
            Set up your Discord bot integration
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <Input
              id="botToken"
              type="password"
              placeholder="Your Discord bot token"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appToken">Application ID</Label>
            <Input
              id="appToken"
              placeholder="Your Discord application ID"
              value={appToken}
              onChange={(e) => setAppToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Get credentials from{' '}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Discord Developer Portal
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
            <Label htmlFor="groupPolicy">Server Policy</Label>
            <Select
              id="groupPolicy"
              value={groupPolicy}
              onChange={(e) => setGroupPolicy(e.target.value)}
            >
              <option value="allowlist">Allowlist only</option>
              <option value="open">Open (all servers)</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require Mention</Label>
              <p className="text-xs text-muted-foreground">
                Bot must be mentioned in channels
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
