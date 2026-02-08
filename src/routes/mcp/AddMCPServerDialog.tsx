import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@clawui/ui'
import { Plus, Trash2 } from 'lucide-react'

interface EnvVar {
  key: string
  value: string
}

interface AddMCPServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (server: {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    enabled: boolean
  }) => void
}

export function AddMCPServerDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddMCPServerDialogProps) {
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [envVars, setEnvVars] = useState<EnvVar[]>([])
  const [errors, setErrors] = useState<{ name?: string; command?: string }>({})

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }])
  }

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index))
  }

  const handleEnvVarChange = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    const newEnvVars = [...envVars]
    newEnvVars[index][field] = value
    setEnvVars(newEnvVars)
  }

  const handleSubmit = () => {
    const newErrors: { name?: string; command?: string } = {}

    if (!name.trim()) {
      newErrors.name = 'Server name is required'
    }
    if (!command.trim()) {
      newErrors.command = 'Command is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Build env object from envVars
    const env: Record<string, string> = {}
    envVars.forEach(({ key, value }) => {
      if (key.trim()) {
        env[key.trim()] = value
      }
    })

    onSubmit({
      name: name.trim(),
      command: command.trim(),
      args: args
        .split(/\s+/)
        .filter(Boolean),
      env: Object.keys(env).length > 0 ? env : undefined,
      enabled: true,
    })

    // Reset form
    setName('')
    setCommand('')
    setArgs('')
    setEnvVars([])
    setErrors({})
  }

  const handleClose = () => {
    setName('')
    setCommand('')
    setArgs('')
    setEnvVars([])
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Configure a new Model Context Protocol server
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              placeholder="e.g., filesystem, github"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setErrors({ ...errors, name: undefined })
              }}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="command">Command</Label>
            <Input
              id="command"
              placeholder="e.g., npx, node, python"
              value={command}
              onChange={(e) => {
                setCommand(e.target.value)
                setErrors({ ...errors, command: undefined })
              }}
            />
            {errors.command && (
              <p className="text-sm text-destructive">{errors.command}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="args">Arguments (space-separated)</Label>
            <Input
              id="args"
              placeholder="e.g., -y @anthropic/mcp-server-filesystem"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Environment Variables</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddEnvVar}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>
            {envVars.map((envVar, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="KEY"
                  value={envVar.key}
                  onChange={(e) =>
                    handleEnvVarChange(index, 'key', e.target.value)
                  }
                  className="flex-1"
                />
                <Input
                  placeholder="value"
                  value={envVar.value}
                  onChange={(e) =>
                    handleEnvVarChange(index, 'value', e.target.value)
                  }
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveEnvVar(index)}
                  className="px-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {envVars.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No environment variables configured
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Server</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
